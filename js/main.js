class Speedometer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.speed = 0;
        this.maxSpeed = 100; // Default max
        this.targetSpeed = 0;
        this.animationId = null;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.draw();
    }

    setSpeed(value) {
        this.targetSpeed = value;
        if (this.targetSpeed > this.maxSpeed) {
            this.maxSpeed = Math.ceil(this.targetSpeed / 50) * 50;
        }
        this.animate();
    }

    animate() {
        if (this.animationId) cancelAnimationFrame(this.animationId);

        const step = () => {
            const diff = this.targetSpeed - this.speed;
            if (Math.abs(diff) < 0.05) {
                this.speed = this.targetSpeed;
                this.draw();
                return;
            }
            this.speed += diff * 0.1;
            this.draw();
            this.animationId = requestAnimationFrame(step);
        };
        step();
    }

    draw() {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(centerX, centerY) - 20;

        this.ctx.clearRect(0, 0, width, height);

        // Draw background arc
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 2.25 * Math.PI);
        this.ctx.lineWidth = 12;
        this.ctx.strokeStyle = '#eeeeee';
        this.ctx.lineCap = 'round';
        this.ctx.stroke();

        // Draw active speed arc
        const speedRatio = Math.min(this.speed / this.maxSpeed, 1);
        const endAngle = 0.75 * Math.PI + (speedRatio * 1.5 * Math.PI);

        if (speedRatio > 0) {
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, endAngle);
            this.ctx.lineWidth = 12;
            this.ctx.strokeStyle = '#007bff';
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
        }

        // Draw ticks and labels
        this.drawTicks(centerX, centerY, radius);

        // Update DOM speed value
        const speedDisplay = document.getElementById('current-speed');
        if (speedDisplay) speedDisplay.innerText = this.speed.toFixed(1);
    }

    drawTicks(centerX, centerY, radius) {
        const numTicks = 11;
        for (let i = 0; i < numTicks; i++) {
            const angle = 0.75 * Math.PI + (i / (numTicks - 1) * 1.5 * Math.PI);
            const startX = centerX + (radius - 10) * Math.cos(angle);
            const startY = centerY + (radius - 10) * Math.sin(angle);
            const endX = centerX + radius * Math.cos(angle);
            const endY = centerY + radius * Math.sin(angle);

            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = '#ccc';
            this.ctx.stroke();

            // Draw numbers
            const textX = centerX + (radius - 30) * Math.cos(angle);
            const textY = centerY + (radius - 30) * Math.sin(angle);
            this.ctx.fillStyle = '#999';
            this.ctx.font = '10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            const val = Math.round(i / (numTicks - 1) * this.maxSpeed);
            this.ctx.fillText(val, textX, textY);
        }
    }
}

// Global instances
let speedometer;
let downloadChart;
let uploadChart;
let speedTest;

function initCharts() {
    const chartConfig = (label, color) => ({
        type: 'line',
        data: {
            labels: Array(20).fill(''),
            datasets: [{
                label: label,
                data: Array(20).fill(0),
                borderColor: color,
                backgroundColor: color + '22',
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: false },
                y: {
                    beginAtZero: true,
                    ticks: {
                        maxTicksLimit: 5
                    }
                }
            },
            plugins: {
                legend: { display: false }
            },
            animation: {
                duration: 200
            }
        }
    });

    const dlCanvas = document.getElementById('downloadGraph');
    if (dlCanvas) {
        const dlCtx = dlCanvas.getContext('2d');
        downloadChart = new Chart(dlCtx, chartConfig('Download', '#007bff'));
    }

    const ulCanvas = document.getElementById('uploadGraph');
    if (ulCanvas) {
        const ulCtx = ulCanvas.getContext('2d');
        uploadChart = new Chart(ulCtx, chartConfig('Upload', '#28a745'));
    }
}

function updateChart(chart, value) {
    if (!chart) return;
    chart.data.datasets[0].data.push(value);
    chart.data.datasets[0].data.shift();
    chart.update('none');
}

function resetCharts() {
    if (downloadChart) {
        downloadChart.data.datasets[0].data = Array(20).fill(0);
        downloadChart.update();
    }
    if (uploadChart) {
        uploadChart.data.datasets[0].data = Array(20).fill(0);
        uploadChart.update();
    }
}

async function startTest() {
    const startBtn = document.getElementById('start-btn');
    const statusText = document.getElementById('status-text');
    const resultsPanel = document.getElementById('results-panel');
    const progressFill = document.getElementById('progress-fill');

    if (startBtn) {
        startBtn.disabled = true;
        startBtn.style.display = 'none';
    }
    if (resultsPanel) resultsPanel.style.display = 'none';
    resetCharts();

    speedTest = new InternetSpeedTest();

    // Step 1: Metadata & Security
    statusText.innerText = "Detecting IP and ISP...";
    const isHttps = window.location.protocol === 'https:';
    document.getElementById('security-val').innerText = isHttps ? "Protected" : "Unprotected";
    document.getElementById('security-val').style.color = isHttps ? "green" : "red";

    await speedTest.getMetadata();
    // Try to get precise location if user allows
    await speedTest.getPreciseLocation();

    document.getElementById('ip-val').innerText = speedTest.results.ip;
    document.getElementById('isp-val').innerText = speedTest.results.isp;

    // Step 2: Ping
    statusText.innerText = "Measuring Latency...";
    progressFill.style.width = '10%';
    const ping = await speedTest.runPing();
    document.getElementById('ping-val').innerText = ping;

    // Step 3: Download
    statusText.innerText = "Testing Download Speed...";
    progressFill.style.width = '30%';
    await speedTest.runDownload((speed, progress) => {
        speedometer.setSpeed(speed);
        updateChart(downloadChart, speed);
        progressFill.style.width = (30 + progress * 0.4) + '%';
    });
    document.getElementById('download-val').innerText = speedTest.results.download.toFixed(2);
    document.getElementById('stability-val').innerText = speedTest.results.stability;

    // Step 4: Upload
    statusText.innerText = "Testing Upload Speed...";
    speedometer.setSpeed(0);
    progressFill.style.width = '70%';
    await speedTest.runUpload((speed, progress) => {
        speedometer.setSpeed(speed);
        updateChart(uploadChart, speed);
        progressFill.style.width = (70 + progress * 0.3) + '%';
    });
    document.getElementById('upload-val').innerText = speedTest.results.upload.toFixed(2);

    // Finalize
    statusText.innerText = "Test Complete!";
    progressFill.style.width = '100%';
    document.getElementById('data-val').innerText = speedTest.results.dataTransferred.toFixed(2);

    if (resultsPanel) {
        resultsPanel.style.display = 'block';
        resultsPanel.scrollIntoView({ behavior: 'smooth' });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    speedometer = new Speedometer('speedometerCanvas');
    initCharts();

    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', startTest);

    const testAgainBtn = document.getElementById('test-again-btn');
    if (testAgainBtn) testAgainBtn.addEventListener('click', () => {
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.style.display = 'block';
        }
        document.getElementById('results-panel').style.display = 'none';
        document.getElementById('progress-fill').style.width = '0%';
        document.getElementById('status-text').innerText = "Ready to test your speed";
        speedometer.setSpeed(0);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});
