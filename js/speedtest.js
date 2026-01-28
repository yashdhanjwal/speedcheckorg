class InternetSpeedTest {
    constructor() {
        this.endpoint = 'backend/speedtest.php';
        this.pingSamples = 5;
        this.downloadSize = 100 * 1024 * 1024; // 100MB to ensure enough data for time-based test
        this.uploadSize = 20 * 1024 * 1024; // 20MB
        this.testDuration = 12000; // 12 seconds per test

        this.results = {
            ping: 0,
            download: 0,
            upload: 0,
            stability: 0,
            dataTransferred: 0,
            ip: '',
            isp: '',
            location: ''
        };
    }

    async fetchWithTimeout(url, options = {}, timeout = 5000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (e) {
            clearTimeout(id);
            throw e;
        }
    }

    async getMetadata() {
        const apis = [
            {
                url: 'https://ipapi.co/json/',
                map: (data) => ({
                    ip: data.ip,
                    isp: data.org || "Unknown ISP",
                    location: `${data.city}, ${data.region}, ${data.country_name}`
                })
            },
            {
                url: 'https://freeipapi.com/api/json',
                map: (data) => ({
                    ip: data.ipAddress,
                    isp: "Detected via IP",
                    location: `${data.cityName}, ${data.regionName}, ${data.countryName}`
                })
            }
        ];

        for (const api of apis) {
            try {
                const response = await this.fetchWithTimeout(api.url);
                const data = await response.json();
                const mapped = api.map(data);
                this.results.ip = mapped.ip;
                this.results.isp = mapped.isp;
                this.results.location = mapped.location;
                return data;
            } catch (e) {
                console.error(`Metadata fetch failed for ${api.url}:`, e);
            }
        }

        // Fallback
        this.results.ip = "Unknown";
        this.results.isp = "Unknown";
        this.results.location = "Unknown";
        return null;
    }

    async getPreciseLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lon: position.coords.longitude
                    });
                },
                () => resolve(null),
                { timeout: 5000 }
            );
        });
    }

    async runPing() {
        let total = 0;
        for (let i = 0; i < this.pingSamples; i++) {
            const start = performance.now();
            try {
                await this.fetchWithTimeout(this.endpoint + '?t=' + Date.now(), { cache: 'no-store' }, 2000);
                const end = performance.now();
                total += (end - start);
            } catch (e) {
                total += 1000; // Penalty for timeout
            }
        }
        this.results.ping = Math.round(total / this.pingSamples);
        return this.results.ping;
    }

    async runDownload(onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const start = performance.now();
            let lastUpdate = start;
            let lastLoaded = 0;
            const speeds = [];
            let isFinished = false;

            const timeout = setTimeout(() => {
                if (!isFinished) {
                    isFinished = true;
                    xhr.abort();
                    finalize();
                }
            }, this.testDuration);

            const finalize = () => {
                const end = performance.now();
                const totalDuration = (end - start) / 1000;
                const finalLoaded = lastLoaded;
                this.results.download = (finalLoaded * 8) / totalDuration / 1000000;
                this.results.dataTransferred += finalLoaded / (1024 * 1024);
                // Discard first 5 samples for stability
                this.results.stability = this.calculateStability(speeds.slice(5));
                resolve(this.results.download);
            };

            xhr.open('GET', `${this.endpoint}?size=${this.downloadSize}&t=${Date.now()}`, true);

            xhr.onprogress = (e) => {
                if (isFinished) return;
                const now = performance.now();
                const durationSinceLast = (now - lastUpdate) / 1000;

                if (durationSinceLast > 0.05) {
                    const loaded = e.loaded;
                    const instantSpeed = ((loaded - lastLoaded) * 8) / durationSinceLast / 1000000;
                    if (isFinite(instantSpeed) && instantSpeed > 0) {
                        speeds.push(instantSpeed);
                        onProgress(instantSpeed, Math.min(100, (now - start) / this.testDuration * 100));
                    }

                    lastUpdate = now;
                    lastLoaded = loaded;
                }
            };

            xhr.onload = () => {
                if (!isFinished) {
                    isFinished = true;
                    clearTimeout(timeout);
                    finalize();
                }
            };

            xhr.onerror = () => {
                if (!isFinished) {
                    isFinished = true;
                    clearTimeout(timeout);
                    finalize(); // Resolve with what we have instead of rejecting
                }
            };
            xhr.send();
        });
    }

    async runUpload(onProgress) {
        const data = new Uint8Array(this.uploadSize);
        for (let i = 0; i < data.length; i++) data[i] = Math.floor(Math.random() * 256);
        const blob = new Blob([data], { type: 'application/octet-stream' });

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const start = performance.now();
            let lastUpdate = start;
            let lastLoaded = 0;
            const speeds = [];
            let isFinished = false;

            const timeout = setTimeout(() => {
                if (!isFinished) {
                    isFinished = true;
                    xhr.abort();
                    finalize();
                }
            }, this.testDuration);

            const finalize = () => {
                const end = performance.now();
                const totalDuration = (end - start) / 1000;
                const finalLoaded = lastLoaded;
                this.results.upload = (finalLoaded * 8) / totalDuration / 1000000;
                this.results.dataTransferred += finalLoaded / (1024 * 1024);
                resolve(this.results.upload);
            };

            xhr.open('POST', this.endpoint, true);

            xhr.upload.onprogress = (e) => {
                if (isFinished) return;
                const now = performance.now();
                const durationSinceLast = (now - lastUpdate) / 1000;

                if (durationSinceLast > 0.05) {
                    const loaded = e.loaded;
                    const instantSpeed = ((loaded - lastLoaded) * 8) / durationSinceLast / 1000000;
                    if (isFinite(instantSpeed) && instantSpeed > 0) {
                        speeds.push(instantSpeed);
                        onProgress(instantSpeed, Math.min(100, (now - start) / this.testDuration * 100));
                    }

                    lastUpdate = now;
                    lastLoaded = loaded;
                }
            };

            xhr.onload = () => {
                if (!isFinished) {
                    isFinished = true;
                    clearTimeout(timeout);
                    finalize();
                }
            };

            xhr.onerror = () => {
                if (!isFinished) {
                    isFinished = true;
                    clearTimeout(timeout);
                    finalize();
                }
            };
            xhr.send(blob);
        });
    }

    calculateStability(speeds) {
        if (speeds.length < 5) return 100;
        const avg = speeds.reduce((a, b) => a + b) / speeds.length;
        const variance = speeds.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / speeds.length;
        const stdDev = Math.sqrt(variance);
        const cv = stdDev / avg;
        const stability = Math.max(0, 100 - (cv * 100));
        return Math.round(stability);
    }
}

if (typeof module !== 'undefined') {
    module.exports = { InternetSpeedTest };
}
