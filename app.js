// Main application logic

let Module = null;
let canvas = null;
let ctx = null;
let performanceMonitor = null;
let mouseX = 0;
let mouseY = 0;
let lastTimestamp = 0;
let isRunning = false;

// Initialize application
async function init() {
    try {
        // Setup canvas
        canvas = document.getElementById('particleCanvas');
        ctx = canvas.getContext('2d');
        resizeCanvas();

        // Initialize performance monitor
        performanceMonitor = new PerformanceMonitor();

        // Load WebAssembly module
        console.log('Loading WebAssembly module...');
        Module = await ParticleModule();
        console.log('WebAssembly module loaded successfully!');

        // Initialize particle system
        Module.init(canvas.width, canvas.height);
        Module.addParticles(500);

        // Setup event listeners
        setupEventListeners();

        // Hide loading screen
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.classList.add('hidden');
        setTimeout(() => loadingScreen.remove(), 500);

        // Start animation loop
        isRunning = true;
        requestAnimationFrame(gameLoop);

        console.log('Application initialized successfully!');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        alert('Failed to load WebAssembly module. Please check the console for details.');
    }
}

// Game loop (uncapped FPS)
function gameLoop() {
    if (!isRunning) return;

    const now = performance.now();
    const deltaTime = lastTimestamp ? (now - lastTimestamp) / 1000 : 0.016;
    lastTimestamp = now;

    // Clamp delta time to prevent instability
    const clampedDeltaTime = Math.min(deltaTime, 0.1);

    // Update particle system
    Module.update(clampedDeltaTime, mouseX, mouseY);

    // Render
    render();

    // Update performance metrics
    performanceMonitor.update();
    updatePerformanceDisplay(performanceMonitor, Module.getParticleCount());

    // Continue loop immediately (uncapped)
    setTimeout(gameLoop, 0);
}

// Render particles
function render() {
    // Clear canvas
    ctx.fillStyle = 'rgba(10, 10, 10, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Get particle data (already a typed array from C++)
    const data = Module.getParticleData();
    if (!data || data.length === 0) return;

    const dataLength = data.length;

    // Draw particles (optimized - no gradients)
    for (let i = 0; i < dataLength; i += 7) {
        const x = data[i];
        const y = data[i + 1];
        const radius = data[i + 2];
        const r = Math.floor(data[i + 3] * 255);
        const g = Math.floor(data[i + 4] * 255);
        const b = Math.floor(data[i + 5] * 255);
        const a = data[i + 6];

        // Simple circle - much faster!
        ctx.beginPath();
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Window resize
    window.addEventListener('resize', resizeCanvas);

    // Mouse movement
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
        mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    });

    // Mouse click to add particle
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        Module.addParticle(x, y);
    });

    // Particle count slider
    const particleCountSlider = document.getElementById('particle-count');
    const countValueDisplay = document.getElementById('count-value');

    particleCountSlider.addEventListener('input', (e) => {
        const targetCount = parseInt(e.target.value);
        const currentCount = Module.getParticleCount();
        countValueDisplay.textContent = targetCount;

        if (targetCount > currentCount) {
            Module.addParticles(targetCount - currentCount);
        } else if (targetCount < currentCount) {
            Module.clearParticles();
            Module.addParticles(targetCount);
        }
    });

    // Attraction strength slider
    const attractionSlider = document.getElementById('attraction-strength');
    const attractionValueDisplay = document.getElementById('attraction-value');

    attractionSlider.addEventListener('input', (e) => {
        const strength = parseFloat(e.target.value);
        attractionValueDisplay.textContent = strength.toFixed(1);
        Module.setAttractionStrength(strength);
    });

    // Mouse enabled checkbox
    const mouseEnabledCheckbox = document.getElementById('mouse-enabled');
    mouseEnabledCheckbox.addEventListener('change', (e) => {
        Module.setMouseEnabled(e.target.checked);
    });

    // Collisions enabled checkbox
    const collisionsEnabledCheckbox = document.getElementById('collisions-enabled');
    collisionsEnabledCheckbox.addEventListener('change', (e) => {
        Module.setCollisionsEnabled(e.target.checked);
    });

    // Add particles button
    const addParticlesButton = document.getElementById('add-particles');
    addParticlesButton.addEventListener('click', () => {
        Module.addParticles(100);
        updateParticleCountSlider();
    });

    // Clear particles button
    const clearParticlesButton = document.getElementById('clear-particles');
    clearParticlesButton.addEventListener('click', () => {
        Module.clearParticles();
        updateParticleCountSlider();
    });

    // Close instructions button
    const closeInstructionsButton = document.getElementById('close-instructions');
    closeInstructionsButton.addEventListener('click', () => {
        document.getElementById('instructions').classList.add('hidden');
    });
}

// Resize canvas to window size
function resizeCanvas() {
    // Use 1:1 pixel ratio for better performance (no DPR scaling)
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';

    if (Module) {
        Module.init(canvas.width, canvas.height);
    }
}

// Update particle count slider to match actual count
function updateParticleCountSlider() {
    const slider = document.getElementById('particle-count');
    const display = document.getElementById('count-value');
    const count = Module.getParticleCount();
    slider.value = count;
    display.textContent = count;
}

// Start application when page loads
window.addEventListener('load', init);
