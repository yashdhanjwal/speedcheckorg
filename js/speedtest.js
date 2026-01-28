class InternetSpeedTest {
    constructor() {
        this.endpoint = 'backend/speedtest.php';
        this.pingSamples = 5;
        this.downloadSize = 15 * 1024 * 1024; // 15MB default
        this.uploadSize = 5 * 1024 * 1024; // 5MB to stay within PHP post_max_size

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

    async getMetadata() {
        try {
            // Using freeipapi.com for HTTPS support
            const response = await fetch('https://freeipapi.com/api/json');
            const data = await response.json();
            this.results.ip = data.ipAddress;
            // Note: freeipapi.com might have different fields
            // Fields: ipAddress, continent, countryName, regionName, cityName, zipCode, latitude, longitude
            this.results.isp = "Detected via IP"; // freeipapi doesn't provide ISP in free tier sometimes
            this.results.location = `${data.cityName}, ${data.regionName}, ${data.countryName}`;

            // Try to get ISP from a different source if needed, but let's stick to this for HTTPS
            return data;
        } catch (e) {
            console.error("Metadata fetch failed", e);
            this.results.ip = "Unknown";
            this.results.isp = "Unknown";
            return null;
        }
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
                await fetch(this.endpoint + '?t=' + Date.now(), { cache: 'no-store' });
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

            // Add cache busting
            xhr.open('GET', `${this.endpoint}?size=${this.downloadSize}&t=${Date.now()}`, true);

            xhr.onprogress = (e) => {
                const now = performance.now();
                const durationSinceLast = (now - lastUpdate) / 1000;

                if (durationSinceLast > 0.05) { // Update every 50ms
                    const loaded = e.loaded;
                    const total = e.total || this.downloadSize;

                    const instantSpeed = ((loaded - lastLoaded) * 8) / durationSinceLast / 1000000; // Mbps
                    if (isFinite(instantSpeed) && instantSpeed > 0) {
                        speeds.push(instantSpeed);
                        onProgress(instantSpeed, (loaded / total) * 100);
                    }

                    lastUpdate = now;
                    lastLoaded = loaded;
                }
            };

            xhr.onload = () => {
                const end = performance.now();
                const totalDuration = (end - start) / 1000;
                const finalLoaded = lastLoaded > 0 ? lastLoaded : this.downloadSize;
                this.results.download = (finalLoaded * 8) / totalDuration / 1000000;
                this.results.dataTransferred += finalLoaded / (1024 * 1024);
                this.results.stability = this.calculateStability(speeds);
                resolve(this.results.download);
            };

            xhr.onerror = reject;
            xhr.send();
        });
    }

    async runUpload(onProgress) {
        const data = new Uint8Array(this.uploadSize);
        // Fill with random data to prevent compression
        for (let i = 0; i < data.length; i++) data[i] = Math.floor(Math.random() * 256);
        const blob = new Blob([data], { type: 'application/octet-stream' });

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const start = performance.now();
            let lastUpdate = start;
            let lastLoaded = 0;
            const speeds = [];

            xhr.open('POST', this.endpoint, true);

            xhr.upload.onprogress = (e) => {
                const now = performance.now();
                const durationSinceLast = (now - lastUpdate) / 1000;

                if (durationSinceLast > 0.05) {
                    const loaded = e.loaded;
                    const total = e.total;

                    const instantSpeed = ((loaded - lastLoaded) * 8) / durationSinceLast / 1000000;
                    if (isFinite(instantSpeed) && instantSpeed > 0) {
                        speeds.push(instantSpeed);
                        onProgress(instantSpeed, (loaded / total) * 100);
                    }

                    lastUpdate = now;
                    lastLoaded = loaded;
                }
            };

            xhr.onload = () => {
                const end = performance.now();
                const totalDuration = (end - start) / 1000;
                const finalLoaded = lastLoaded > 0 ? lastLoaded : this.uploadSize;
                this.results.upload = (finalLoaded * 8) / totalDuration / 1000000;
                this.results.dataTransferred += finalLoaded / (1024 * 1024);
                resolve(this.results.upload);
            };

            xhr.onerror = reject;
            xhr.send(blob);
        });
    }

    calculateStability(speeds) {
        if (speeds.length < 5) return 100;
        // Simple stability metric: 100 - Coefficient of Variation
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
