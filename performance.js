// Performance monitoring utilities

class PerformanceMonitor {
    constructor() {
        this.frameTimes = [];
        this.maxSamples = 60;
        this.lastFrameTime = performance.now();
    }

    update() {
        const now = performance.now();
        const deltaTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        this.frameTimes.push(deltaTime);
        if (this.frameTimes.length > this.maxSamples) {
            this.frameTimes.shift();
        }
    }

    getFPS() {
        if (this.frameTimes.length === 0) return 60;

        const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        return Math.round(1000 / avgFrameTime);
    }

    getAverageFrameTime() {
        if (this.frameTimes.length === 0) return 0;

        const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        return Math.round(avgFrameTime * 10) / 10;
    }

    getMinFPS() {
        if (this.frameTimes.length === 0) return 60;

        const maxFrameTime = Math.max(...this.frameTimes);
        return Math.round(1000 / maxFrameTime);
    }

    getMaxFPS() {
        if (this.frameTimes.length === 0) return 60;

        const minFrameTime = Math.min(...this.frameTimes);
        return Math.round(1000 / minFrameTime);
    }

    reset() {
        this.frameTimes = [];
        this.lastFrameTime = performance.now();
    }
}

// Performance display updater
function updatePerformanceDisplay(monitor, particleCount) {
    const fpsDisplay = document.getElementById('fps-display');
    const particleDisplay = document.getElementById('particle-display');
    const frameTimeDisplay = document.getElementById('frame-time-display');

    if (fpsDisplay) {
        const fps = monitor.getFPS();
        fpsDisplay.textContent = fps;

        // Color-code FPS
        if (fps >= 50) {
            fpsDisplay.style.color = '#00ff88';
        } else if (fps >= 30) {
            fpsDisplay.style.color = '#ffaa00';
        } else {
            fpsDisplay.style.color = '#ff4444';
        }
    }

    if (particleDisplay) {
        particleDisplay.textContent = particleCount.toLocaleString();
    }

    if (frameTimeDisplay) {
        frameTimeDisplay.textContent = monitor.getAverageFrameTime() + 'ms';
    }
}
