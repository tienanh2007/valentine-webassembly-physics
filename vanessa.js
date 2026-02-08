// Vanessa - Text Gravity Effect

let Module = null;
let canvas = null;
let ctx = null;
let performanceMonitor = null;
let lastTimestamp = 0;
let isRunning = false;
let textAttractionPoints = [];
let collisionHistory = []; // Track recent collisions with timestamps
let letterGroups = []; // Each letter's collection of points
let collisionPointToLetter = new Map(); // Map collision points to letter indices

// Clickable boxes that particles bounce off
let yesBox = null;
let noBox = null;
let mouseX = 0;
let mouseY = 0;

// Constants for text collision-reveal effect
const TEXT_LINES = ["Vanessa", "Will you be my Valentine?"];
const FONT_SIZE = 120; // Size for both lines
const LINE_SPACING = 140; // Vertical spacing between lines
const ATTRACTION_STRENGTH = 0.0; // DISABLED - no gravity attraction
const PARTICLE_COUNT = 1500; // More particles for better coverage
const SAMPLE_RATE = 3; // Denser sampling for smoother collision

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
        Module.setAttractionStrength(0.0); // DISABLE gravity attraction
        Module.setMouseEnabled(false); // DISABLE mouse attraction
        Module.addParticles(PARTICLE_COUNT);

        // Calculate text attraction points
        calculateTextAttractionPoints();

        // Initialize Yes/No boxes
        initializeBoxes();

        // Setup event listeners
        setupEventListeners();

        // Hide loading screen
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.classList.add('hidden');
        setTimeout(() => loadingScreen.remove(), 500);

        // Start animation loop
        isRunning = true;
        requestAnimationFrame(gameLoop);

        console.log('Vanessa page initialized successfully!');
        console.log(`Text attraction points: ${textAttractionPoints.length}`);
    } catch (error) {
        console.error('Failed to initialize application:', error);
        alert('Failed to load WebAssembly module. Please check the console for details.');
    }
}

// Calculate collision points grouped by letter
function calculateTextAttractionPoints() {
    textAttractionPoints = [];
    letterGroups = [];
    collisionPointToLetter.clear();

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    tempCtx.font = `bold ${FONT_SIZE}px Arial`;
    tempCtx.textAlign = 'center';
    tempCtx.textBaseline = 'middle';

    // Calculate starting Y position for centered multi-line text
    const totalHeight = TEXT_LINES.length * LINE_SPACING;
    const startY = (canvas.height - totalHeight) / 2 + LINE_SPACING / 2;

    let globalCharIndex = 0;

    // Process each line
    TEXT_LINES.forEach((line, lineIndex) => {
        const centerY = startY + (lineIndex * LINE_SPACING);
        const fullWidth = tempCtx.measureText(line).width;
        const startX = (canvas.width - fullWidth) / 2;
        let currentX = startX;

        // Process each character in the line
        for (let charIndex = 0; charIndex < line.length; charIndex++) {
            const char = line[charIndex];
            const charWidth = tempCtx.measureText(char).width;

            // Clear canvas for this character
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

            // Draw single character
            tempCtx.strokeStyle = 'white';
            tempCtx.lineWidth = 4;
            tempCtx.strokeText(char, currentX + charWidth / 2, centerY);

            // Extract points for this character
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = imageData.data;
            const letterPoints = [];

            for (let y = 0; y < tempCanvas.height; y += SAMPLE_RATE) {
                for (let x = 0; x < tempCanvas.width; x += SAMPLE_RATE) {
                    const i = (y * tempCanvas.width + x) * 4;
                    const alpha = data[i + 3];

                    if (alpha > 128) {
                        const point = { x, y };
                        letterPoints.push(point);
                        textAttractionPoints.push(point);

                        // Map this collision point to this letter
                        collisionPointToLetter.set(`${x},${y}`, globalCharIndex);
                    }
                }
            }

            // Store letter group
            letterGroups.push({
                char: char,
                points: letterPoints,
                line: lineIndex
            });

            currentX += charWidth;
            globalCharIndex++;
        }
    });
}

// Initialize Yes/No boxes
function initializeBoxes() {
    const yesBoxWidth = 150;
    const yesBoxHeight = 80;
    const noBoxWidth = 70;   // Tiny!
    const noBoxHeight = 40;  // Tiny!
    const bottomMargin = 100;
    const spacing = 200;

    const centerX = canvas.width / 2;
    const yesBoxY = canvas.height - bottomMargin - yesBoxHeight;
    const noBoxY = canvas.height - bottomMargin - noBoxHeight;

    yesBox = {
        x: centerX - spacing - yesBoxWidth,
        y: yesBoxY,
        width: yesBoxWidth,
        height: yesBoxHeight,
        label: "Yes",
        color: 'rgba(255, 105, 180, 0.8)',
        hoverColor: 'rgba(255, 105, 180, 1.0)'
    };

    noBox = {
        x: centerX + spacing,
        y: noBoxY,
        width: noBoxWidth,
        height: noBoxHeight,
        label: "No",
        color: 'rgba(255, 50, 50, 0.8)',
        hoverColor: 'rgba(255, 50, 50, 1.0)',
        vx: 0, // velocity X
        vy: 0, // velocity Y
        ax: 0, // acceleration X
        ay: 0  // acceleration Y
    };
}

// Handle particle collisions with boxes (bounce)
// We'll add box points to the text collision system for simplicity
function getBoxCollisionPoints(box) {
    const points = [];
    const step = 3;

    // Top and bottom edges
    for (let x = box.x; x <= box.x + box.width; x += step) {
        points.push({ x, y: box.y }); // Top
        points.push({ x, y: box.y + box.height }); // Bottom
    }

    // Left and right edges
    for (let y = box.y; y <= box.y + box.height; y += step) {
        points.push({ x: box.x, y }); // Left
        points.push({ x: box.x + box.width, y }); // Right
    }

    return points;
}

function getAllCollisionPoints() {
    // Combine text points and box points
    let allPoints = [...textAttractionPoints];

    if (yesBox) {
        allPoints = allPoints.concat(getBoxCollisionPoints(yesBox));
    }
    if (noBox) {
        allPoints = allPoints.concat(getBoxCollisionPoints(noBox));
    }

    return allPoints;
}

// Update No box position (runs away from cursor)
function updateNoBoxPosition(deltaTime) {
    if (!noBox) return;

    // Calculate direction away from cursor
    const boxCenterX = noBox.x + noBox.width / 2;
    const boxCenterY = noBox.y + noBox.height / 2;

    const dx = boxCenterX - mouseX;
    const dy = boxCenterY - mouseY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // TELEPORT if cursor gets too close!
    if (distance < 30) {
        // Find a random position far from cursor
        let newX, newY, attempts = 0;
        do {
            newX = Math.random() * (canvas.width - noBox.width);
            newY = Math.random() * (canvas.height - noBox.height);
            const distFromCursor = Math.sqrt((newX - mouseX) ** 2 + (newY - mouseY) ** 2);
            attempts++;
            // Keep trying until we find a spot at least 400px away from cursor
            if (distFromCursor > 400 || attempts > 10) break;
        } while (true);

        noBox.x = newX;
        noBox.y = newY;
        noBox.vx = 0; // Reset velocity
        noBox.vy = 0;
        return; // Skip normal physics this frame
    }

    // Apply VERY strong repulsion force from long distance
    if (distance < 10000) { // Large repulsion radius
        const force = 10000000 / (distance * distance + 1); // VERY strong inverse square law (50x stronger!)
        const normalizedDx = dx / distance;
        const normalizedDy = dy / distance;

        // Apply acceleration
        noBox.ax = normalizedDx * force;
        noBox.ay = normalizedDy * force;
    } else {
        // Gradually return to center when far from cursor
        const targetX = canvas.width / 2 + 200;
        const targetY = canvas.height - 180;

        noBox.ax = (targetX - boxCenterX) * 0.5;
        noBox.ay = (targetY - boxCenterY) * 0.5;
    }

    // Update velocity
    noBox.vx += noBox.ax * deltaTime;
    noBox.vy += noBox.ay * deltaTime;

    // Less damping = more frantic movement
    noBox.vx *= 0.98;
    noBox.vy *= 0.98;

    // Limit velocity to very high speed
    const maxSpeed = 2000;
    const speed = Math.sqrt(noBox.vx * noBox.vx + noBox.vy * noBox.vy);
    if (speed > maxSpeed) {
        noBox.vx = (noBox.vx / speed) * maxSpeed;
        noBox.vy = (noBox.vy / speed) * maxSpeed;
    }

    // Update position
    noBox.x += noBox.vx * deltaTime;
    noBox.y += noBox.vy * deltaTime;

    // Check collision with Yes box (AABB collision)
    if (yesBox) {
        const noLeft = noBox.x;
        const noRight = noBox.x + noBox.width;
        const noTop = noBox.y;
        const noBottom = noBox.y + noBox.height;

        const yesLeft = yesBox.x;
        const yesRight = yesBox.x + yesBox.width;
        const yesTop = yesBox.y;
        const yesBottom = yesBox.y + yesBox.height;

        // Check if boxes overlap
        if (noRight > yesLeft && noLeft < yesRight &&
            noBottom > yesTop && noTop < yesBottom) {

            // Calculate overlap on each axis
            const overlapLeft = noRight - yesLeft;
            const overlapRight = yesRight - noLeft;
            const overlapTop = noBottom - yesTop;
            const overlapBottom = yesBottom - noTop;

            // Find minimum overlap (collision side)
            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

            // Bounce based on which side was hit
            if (minOverlap === overlapLeft) {
                noBox.x = yesLeft - noBox.width - 1;
                noBox.vx = -Math.abs(noBox.vx) * 1.2; // Bounce left with boost
            } else if (minOverlap === overlapRight) {
                noBox.x = yesRight + 1;
                noBox.vx = Math.abs(noBox.vx) * 1.2; // Bounce right with boost
            } else if (minOverlap === overlapTop) {
                noBox.y = yesTop - noBox.height - 1;
                noBox.vy = -Math.abs(noBox.vy) * 1.2; // Bounce up with boost
            } else if (minOverlap === overlapBottom) {
                noBox.y = yesBottom + 1;
                noBox.vy = Math.abs(noBox.vy) * 1.2; // Bounce down with boost
            }
        }
    }

    // Wrap around screen edges (teleport to opposite side)
    if (noBox.x + noBox.width < 0) {
        // Went off left edge - teleport to right
        noBox.x = canvas.width;
    }
    if (noBox.x > canvas.width) {
        // Went off right edge - teleport to left
        noBox.x = -noBox.width;
    }
    if (noBox.y + noBox.height < 0) {
        // Went off top edge - teleport to bottom
        noBox.y = canvas.height;
    }
    if (noBox.y > canvas.height) {
        // Went off bottom edge - teleport to top
        noBox.y = -noBox.height;
    }
}

// Update collision history for visual feedback (permanent)
function updateCollisionHistory() {
    // Get collision points from C++
    const collisionData = Module.getCollisionPoints();
    if (collisionData && collisionData.length > 0) {
        // Process each collision
        for (let i = 0; i < collisionData.length; i += 2) {
            const collisionX = Math.round(collisionData[i]);
            const collisionY = Math.round(collisionData[i + 1]);

            // Find which letter this collision belongs to
            const letterIndex = collisionPointToLetter.get(`${collisionX},${collisionY}`);

            if (letterIndex !== undefined && letterGroups[letterIndex]) {
                const letter = letterGroups[letterIndex];

                // Light up 3 random points from this letter's collection
                if (letter.points.length > 0) {
                    for (let j = 0; j < 3; j++) {
                        const randomPoint = letter.points[Math.floor(Math.random() * letter.points.length)];

                        // Check if already lit
                        const isDuplicate = collisionHistory.some(c => {
                            const dx = c.x - randomPoint.x;
                            const dy = c.y - randomPoint.y;
                            return Math.sqrt(dx * dx + dy * dy) < 2;
                        });

                        if (!isDuplicate) {
                            collisionHistory.push({
                                x: randomPoint.x,
                                y: randomPoint.y
                            });
                        }
                    }
                }
            }
        }
    }
    // No filtering - keep collisions permanently!
}

// Game loop
function gameLoop() {
    if (!isRunning) return;

    const now = performance.now();
    const deltaTime = lastTimestamp ? (now - lastTimestamp) / 1000 : 0.016;
    lastTimestamp = now;

    // Clamp delta time to prevent instability
    const clampedDeltaTime = Math.min(deltaTime, 0.1);

    // Update No box position (runs away from cursor)
    updateNoBoxPosition(clampedDeltaTime);

    // Update particle system with text collision
    Module.updateWithTextCollision(clampedDeltaTime, textAttractionPoints);

    // Handle box collisions (bounce)
    if (yesBox) {
        Module.handleBoxCollision(yesBox.x, yesBox.y, yesBox.width, yesBox.height);
    }
    if (noBox) {
        Module.handleBoxCollision(noBox.x, noBox.y, noBox.width, noBox.height);
    }

    // Track collision points for visual feedback
    updateCollisionHistory();

    // Render
    render();

    // Update performance metrics
    performanceMonitor.update();

    // Update FPS display
    updatePerformanceDisplay(performanceMonitor, Module.getParticleCount());

    // Continue loop immediately (uncapped)
    setTimeout(gameLoop, 0);
}

// Render particles and collision-reveal text effect
function render() {
    // Clear canvas completely - Valentine's dark pink background
    ctx.fillStyle = '#1a0a14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Get particle data
    const data = Module.getParticleData();
    if (data && data.length > 0) {
        // Draw particles
        for (let i = 0; i < data.length; i += 7) {
            const x = data[i];
            const y = data[i + 1];
            const radius = data[i + 2];
            const r = Math.floor(data[i + 3] * 255);
            const g = Math.floor(data[i + 4] * 255);
            const b = Math.floor(data[i + 5] * 255);
            const a = data[i + 6];

            ctx.beginPath();
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Render text reveal effect at collision points (permanent)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // NO base text outline - completely invisible until revealed by collisions

    // Draw fine permanent glowing circles at collision points
    collisionHistory.forEach(collision => {
        // Very fine, bright, permanent glow - Valentine's pink/rose theme
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(255, 105, 180, 0.9)';
        ctx.fillStyle = 'rgba(255, 182, 193, 1.0)';

        ctx.beginPath();
        ctx.arc(collision.x, collision.y, 1.5, 0, Math.PI * 2); // Fine 1.5px radius
        ctx.fill();
    });

    ctx.shadowBlur = 0; // Reset shadow

    // Draw Yes/No boxes
    if (yesBox) {
        ctx.fillStyle = yesBox.color;
        ctx.fillRect(yesBox.x, yesBox.y, yesBox.width, yesBox.height);

        // Draw label
        ctx.fillStyle = 'white';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(yesBox.label, yesBox.x + yesBox.width / 2, yesBox.y + yesBox.height / 2);
    }

    if (noBox) {
        ctx.fillStyle = noBox.color;
        ctx.fillRect(noBox.x, noBox.y, noBox.width, noBox.height);

        // Draw label (smaller font for tiny box)
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(noBox.label, noBox.x + noBox.width / 2, noBox.y + noBox.height / 2);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Window resize
    window.addEventListener('resize', () => {
        resizeCanvas();
        calculateTextAttractionPoints(); // Recalculate on resize
        initializeBoxes(); // Recalculate box positions
    });

    // Click handler for boxes
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Check if Yes box was clicked
        if (yesBox && clickX >= yesBox.x && clickX <= yesBox.x + yesBox.width &&
            clickY >= yesBox.y && clickY <= yesBox.y + yesBox.height) {
            console.log('Yes clicked! 💚');
            alert('Thank you for being my Valentine. I love u buddy 💚💝');
        }

        // Check if No box was clicked
        if (noBox && clickX >= noBox.x && clickX <= noBox.x + noBox.width &&
            clickY >= noBox.y && clickY <= noBox.y + noBox.height) {
            console.log('No clicked! 💔');
            alert('Aww... maybe next time? 💔');
        }
    });

    // Track mouse position and hover effect
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;

        let hoveringBox = false;

        // Check if hovering over Yes box
        if (yesBox && mouseX >= yesBox.x && mouseX <= yesBox.x + yesBox.width &&
            mouseY >= yesBox.y && mouseY <= yesBox.y + yesBox.height) {
            canvas.style.cursor = 'pointer';
            hoveringBox = true;
        }
        // Check if hovering over No box (harder to click since it runs away!)
        else if (noBox && mouseX >= noBox.x && mouseX <= noBox.x + noBox.width &&
            mouseY >= noBox.y && mouseY <= noBox.y + noBox.height) {
            canvas.style.cursor = 'pointer';
            hoveringBox = true;
        }

        if (!hoveringBox) {
            canvas.style.cursor = 'default';
        }
    });
}

// Resize canvas to window size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';

    if (Module) {
        Module.init(canvas.width, canvas.height);
    }
}

// Start application when page loads
window.addEventListener('load', init);
