class Speedometer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.speed = 0;
        this.maxSpeed = 100;
        this.targetSpeed = 0;
        this.animationId = null;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width) return;
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
        const radius = Math.max(0, Math.min(centerX, centerY) - 15);

        this.ctx.clearRect(0, 0, width, height);

        // Background arc
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 2.25 * Math.PI);
        this.ctx.lineWidth = 10;
        this.ctx.strokeStyle = '#f0f0f0';
        this.ctx.lineCap = 'round';
        this.ctx.stroke();

        // Active speed arc
        const speedRatio = Math.min(this.speed / this.maxSpeed, 1);
        const endAngle = 0.75 * Math.PI + (speedRatio * 1.5 * Math.PI);

        if (speedRatio > 0) {
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, endAngle);
            this.ctx.lineWidth = 10;
            this.ctx.strokeStyle = '#007bff';
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
        }

        this.drawTicks(centerX, centerY, radius);

        const speedDisplay = document.getElementById('current-speed');
        if (speedDisplay) speedDisplay.innerText = this.speed.toFixed(1);
    }

    drawTicks(centerX, centerY, radius) {
        const numTicks = 11;
        for (let i = 0; i < numTicks; i++) {
            const angle = 0.75 * Math.PI + (i / (numTicks - 1) * 1.5 * Math.PI);
            const startX = centerX + (radius - 8) * Math.cos(angle);
            const startY = centerY + (radius - 8) * Math.sin(angle);
            const endX = centerX + radius * Math.cos(angle);
            const endY = centerY + radius * Math.sin(angle);

            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
            this.ctx.lineWidth = 1.5;
            this.ctx.strokeStyle = '#ddd';
            this.ctx.stroke();

            const textX = centerX + (radius - 22) * Math.cos(angle);
            const textY = centerY + (radius - 22) * Math.sin(angle);
            this.ctx.fillStyle = '#bbb';
            this.ctx.font = '9px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            const val = Math.round(i / (numTicks - 1) * this.maxSpeed);
            this.ctx.fillText(val, textX, textY);
        }
    }
}

let speedometer;
let downloadChart;
let uploadChart;
let speedTest;

function initCharts() {
    const chartConfig = (label, color) => ({
        type: 'line',
        data: {
            labels: Array(30).fill(''),
            datasets: [{
                label: label,
                data: Array(30).fill(0),
                borderColor: color,
                backgroundColor: color + '11',
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
                    ticks: { display: false },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false }
            },
            animation: { duration: 100 }
        }
    });

    const dlCanvas = document.getElementById('downloadGraph');
    if (dlCanvas) downloadChart = new Chart(dlCanvas.getContext('2d'), chartConfig('DL', '#007bff'));

    const ulCanvas = document.getElementById('uploadGraph');
    if (ulCanvas) uploadChart = new Chart(ulCanvas.getContext('2d'), chartConfig('UL', '#28a745'));
}

function updateChart(chart, value) {
    if (!chart) return;
    chart.data.datasets[0].data.push(value);
    chart.data.datasets[0].data.shift();
    chart.update('none');
}

async function startTest() {
    const startBtn = document.getElementById('start-btn');
    const statusText = document.getElementById('status-text');
    const progressFill = document.getElementById('progress-fill');
    const testView = document.getElementById('test-view');
    const resultsView = document.getElementById('results-view');

    startBtn.style.display = 'none';
    testView.style.display = 'block';
    resultsView.style.display = 'none';

    speedTest = new InternetSpeedTest();

    try {
        statusText.innerText = "Detecting connection details...";
        const isHttps = window.location.protocol === 'https:';
        document.getElementById('security-val').innerText = isHttps ? "Protected (SSL)" : "Unprotected";
        document.getElementById('security-val').style.color = isHttps ? "green" : "red";

        await speedTest.getMetadata();
        document.getElementById('ip-val').innerText = speedTest.results.ip;
        document.getElementById('isp-val').innerText = speedTest.results.isp;
        document.getElementById('loc-val').innerText = speedTest.results.location;

        statusText.innerText = "Testing Latency (Ping)...";
        progressFill.style.width = '5%';
        const ping = await speedTest.runPing();
        document.getElementById('ping-val').innerText = ping;

        statusText.innerText = "Testing Download Speed...";
        await speedTest.runDownload((speed, progress) => {
            speedometer.setSpeed(speed);
            updateChart(downloadChart, speed);
            progressFill.style.width = (5 + progress * 0.45) + '%';
        });
        document.getElementById('download-val').innerText = speedTest.results.download.toFixed(1);
        document.getElementById('stability-val').innerText = speedTest.results.stability;

        statusText.innerText = "Testing Upload Speed...";
        speedometer.setSpeed(0);
        await speedTest.runUpload((speed, progress) => {
            speedometer.setSpeed(speed);
            updateChart(uploadChart, speed);
            progressFill.style.width = (50 + progress * 0.45) + '%';
        });
        document.getElementById('upload-val').innerText = speedTest.results.upload.toFixed(1);

        document.getElementById('data-val').innerText = speedTest.results.dataTransferred.toFixed(1);
        progressFill.style.width = '100%';
        statusText.innerText = "Test Complete!";

        setTimeout(() => {
            testView.style.display = 'none';
            resultsView.style.display = 'block';
            if (downloadChart) downloadChart.update();
            if (uploadChart) uploadChart.update();
        }, 1000);
    } catch (e) {
        console.error("Test failed:", e);
        statusText.innerText = "Test failed. Please try again.";
        startBtn.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    speedometer = new Speedometer('speedometerCanvas');
    initCharts();

    document.getElementById('start-btn').addEventListener('click', startTest);
    document.getElementById('test-again-btn').addEventListener('click', () => {
        document.getElementById('test-view').style.display = 'block';
        document.getElementById('results-view').style.display = 'none';
        document.getElementById('start-btn').style.display = 'block';
        document.getElementById('progress-fill').style.width = '0%';
        document.getElementById('status-text').innerText = "Ready to test your speed";
        speedometer.setSpeed(0);
        speedometer.resize();
    });
});
