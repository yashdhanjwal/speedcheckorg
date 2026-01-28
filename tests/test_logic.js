const { InternetSpeedTest } = require('../js/speedtest.js');

// Mocking browser globals
global.performance = { now: () => Date.now() };
global.fetch = async (url) => {
    return {
        json: async () => ({
            ipAddress: '127.0.0.1',
            cityName: 'New Delhi',
            regionName: 'Delhi',
            countryName: 'India'
        })
    };
};

class MockXHR {
    constructor() {
        this.onload = null;
        this.onprogress = null;
        this.onerror = null;
        this.upload = { onprogress: null };
        this.method = '';
        this.url = '';
    }
    open(method, url) { this.method = method; this.url = url; }
    send(data) {
        setTimeout(() => {
            if (this.method === 'GET') {
                if (this.onprogress) this.onprogress({ loaded: 7 * 1024 * 1024, total: 15 * 1024 * 1024 });
                setTimeout(() => {
                    if (this.onload) {
                        this.onload();
                    }
                }, 100);
            } else {
                if (this.upload.onprogress) this.upload.onprogress({ loaded: 2 * 1024 * 1024, total: 5 * 1024 * 1024 });
                setTimeout(() => {
                    if (this.onload) {
                        this.onload();
                    }
                }, 100);
            }
        }, 100);
    }
}
global.XMLHttpRequest = MockXHR;
global.Blob = class { constructor(data) { this.size = data[0].length; } };
global.Uint8Array = Uint8Array;
global.isFinite = isFinite;
global.navigator = {
    geolocation: {
        getCurrentPosition: (success) => success({ coords: { latitude: 0, longitude: 0 } })
    }
};

async function runTest() {
    const test = new InternetSpeedTest();
    console.log("Starting Tests...");

    console.log("Testing Metadata...");
    await test.getMetadata();
    if (test.results.ip === '127.0.0.1') {
        console.log("✅ Metadata test passed");
    } else {
        console.error("❌ Metadata test failed", test.results);
        process.exit(1);
    }

    console.log("Testing Ping...");
    const ping = await test.runPing();
    if (ping >= 0) {
        console.log(`✅ Ping test passed: ${ping}ms`);
    } else {
        console.error("❌ Ping test failed");
        process.exit(1);
    }

    console.log("Testing Download...");
    const dl = await test.runDownload((s, p) => {});
    if (dl > 0) {
        console.log(`✅ Download test passed: ${dl.toFixed(2)}Mbps`);
    } else {
        console.error("❌ Download test failed");
        process.exit(1);
    }

    console.log("Testing Upload...");
    const ul = await test.runUpload((s, p) => {});
    if (ul > 0) {
        console.log(`✅ Upload test passed: ${ul.toFixed(2)}Mbps`);
    } else {
        console.error("❌ Upload test failed");
        process.exit(1);
    }

    console.log("Final Results Summary:");
    console.log(JSON.stringify(test.results, null, 2));
    console.log("ALL LOGIC TESTS PASSED!");
}

runTest().catch(e => {
    console.error(e);
    process.exit(1);
});
