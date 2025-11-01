const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game settings
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;

// Set canvas size
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Initialize canvas and rendering context
ctx.imageSmoothingEnabled = true;

// Game modes and difficulty
let gameMode = 'ai'; // 'ai' or 'multiplayer'
let difficulty = 'medium'; // 'easy', 'medium', 'hard'

// Ping pong rules
const POINTS_TO_WIN = 11; // Points needed to win
const POINTS_LEAD_NEEDED = 2; // Points lead needed to win
const TABLE = {
    width: CANVAS_WIDTH * 0.8,
    height: CANVAS_HEIGHT * 0.8,
    left: CANVAS_WIDTH * 0.1,
    top: CANVAS_HEIGHT * 0.1,
    netX: CANVAS_WIDTH / 2
};

// Game state
let serving = true;
let serverSide = 'player1';
let serveBounces = 0;
let rallyBounces = 0;
let lastBounceX = 0;
let gamePoint = false;

// Game objects
const paddle = {
    width: 15,      // Face width
    height: 70,     // Total paddle height
    headRadius: 28, // Visual paddle head radius
    speed: 6
};

const ball = {
    size: 8,
    baseSpeed: 5,    // Base speed that we'll return to after hits
    speed: 5,        // Current speed
    dx: 5,          // Horizontal speed
    dy: 5,          // Vertical speed
    isChopped: false,
    lastHitBy: null, // 'player1' or 'player2'
    chopReturned: false, // Track if a chop has been successfully returned
    altitude: 0,     // Height above table (for 3D effect)
    verticalSpeed: 0, // Vertical movement speed
    serveType: 'normal' // Can be 'fast', 'normal', or 'slow'
};

let gameState = {
    player1: {
        y: canvas.height / 2 - paddle.height / 2,
        score: 0
    },
    player2: {
        y: canvas.height / 2 - paddle.height / 2,
        score: 0
    },
    ball: {
        x: canvas.width / 2,
        y: canvas.height / 2
    }
};

// Input handling
const keys = {
    ArrowUp: false,    // Player 1 up
    ArrowDown: false,  // Player 1 down
    ArrowRight: false, // Smash key for player 1
    ArrowLeft: false,  // Chop key for player 1
    w: false,          // Player 2 up (in multiplayer)
    s: false,          // Player 2 down (in multiplayer)
    d: false,          // Smash key for player 2
    a: false           // Chop key for player 2
};

// AI action flags (used to request a chop/smash on behalf of the AI)
const aiAction = {
    chop: false,
    smash: false,
    // countdown frames until AI should press chop/smash
    chopCountdown: -1,
    smashCountdown: -1
};

// Simple hit effects for visual feedback
const hitEffects = []; // {x,y,type,start}

// Audio helper (Web Audio API) - created on first user interaction
let audioCtx = null;
function ensureAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('WebAudio not supported:', e);
            audioCtx = null;
        }
    }
}

function playHitSound(type) {
    ensureAudio();
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    
    switch(type) {
        case 'smash':
            o.type = 'sawtooth';
            o.frequency.value = 800;
            g.gain.value = 0.15;
            break;
        case 'bounce':
            o.type = 'triangle';
            o.frequency.value = 600;
            g.gain.value = 0.08;
            break;
        default:
            o.type = 'sine';
            o.frequency.value = 400;
            g.gain.value = 0.1;
    }
    
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    // quick envelope
    g.gain.setValueAtTime(g.gain.value, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
    o.stop(audioCtx.currentTime + 0.13);
}

// Add event listeners for mode and difficulty buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        gameMode = btn.dataset.mode;
        document.getElementById('difficulty-selector').classList.toggle('hidden', gameMode === 'multiplayer');
        document.getElementById('player2-help').classList.toggle('hidden', gameMode === 'ai');
        resetGame();
    });
});

document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        difficulty = btn.dataset.difficulty;
        updateAIDifficulty();
        resetGame();
    });
});

document.addEventListener('keydown', (e) => {
    // Initialize audio context on first user interaction
    ensureAudio();

    if (e.key in keys) {
        keys[e.key] = true;
        socket.emit('paddle_move', {
            key: e.key,
            pressed: true
        });
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key in keys) {
        keys[e.key] = false;
        socket.emit('paddle_move', {
            key: e.key,
            pressed: false
        });
    }
});

// Socket events
socket.on('paddle_update', (data) => {
    if (data.player === 'player2') {
        gameState.player2.y = data.y;
    }
});

function updateAIDifficulty() {
    switch(difficulty) {
        case 'easy':
            paddle.speed = 5;
            break;
        case 'medium':
            paddle.speed = 8;
            break;
        case 'hard':
            paddle.speed = 12;
            break;
    }
}

// AI movement
function predictBallPosition() {
    // Predict position and time to reach the AI paddle.
    // Returns an object { predictedY, timeToReach }
    if (ball.dx <= 0) return { predictedY: gameState.ball.y, timeToReach: Infinity };

    const distanceToTravel = canvas.width - paddle.width - gameState.ball.x;
    const timeToReach = distanceToTravel / Math.abs(ball.dx);

    let predictedY = gameState.ball.y + (ball.dy * timeToReach);

    // Account for bounces off the top/bottom walls.
    // Normalize prediction into [0, canvas.height]
    if (predictedY < 0 || predictedY > canvas.height) {
        // Use mirror method: fold into range by reflecting across boundaries
        const period = canvas.height * 2;
        let p = predictedY % period;
        if (p < 0) p += period;
        predictedY = (p <= canvas.height) ? p : period - p;
    }

    return { predictedY: Math.min(Math.max(predictedY, 0), canvas.height), timeToReach };
}

function updateAI() {
    if (gameMode === 'ai') {
        // Reset transient action each tick; countdowns drive the actual press
        aiAction.chop = false;
        aiAction.smash = false;

        // AI serve decision
        if (serving && serverSide === 'player2') {
            const serveTypes = ['fast', 'normal', 'slow'];
            const randomIndex = Math.floor(Math.random() * serveTypes.length);
            const chosenServe = serveTypes[randomIndex];
            
            if (chosenServe === 'fast') {
                ball.serveType = 'fast';
                ball.speed = ball.baseSpeed * 1.5;
                ball.verticalSpeed = 3;
            } else if (chosenServe === 'slow') {
                ball.serveType = 'slow';
                ball.speed = ball.baseSpeed * 0.7;
                ball.verticalSpeed = 1.5;
                ball.isChopped = true;
            } else {
                ball.serveType = 'normal';
                ball.speed = ball.baseSpeed;
                ball.verticalSpeed = 2;
            }
            
            serving = false;
            ball.dx = -ball.speed;
            ball.dy = -ball.speed/2;
            return;
        }

        const info = predictBallPosition();
        const predictedY = info.predictedY;
        const timeToReach = info.timeToReach;

        const targetY = predictedY - paddle.height / 2;
        const currentY = gameState.player2.y;
        const diff = targetY - currentY;
        
        let aiSpeed = paddle.speed;
        let reactionDelay = 1.0;
        
        let specialMoveChance = 0;
        switch(difficulty) {
            case 'easy':
                aiSpeed *= 0.5;
                reactionDelay = 0.3;
                specialMoveChance = 0.15; // 15% chance of special move
                // Sometimes move in wrong direction on easy
                if (Math.random() < 0.2) {
                    gameState.player2.y -= Math.sign(diff) * aiSpeed;
                    return;
                }
                break;
            case 'medium':
                aiSpeed *= 0.7;
                reactionDelay = 0.6;
                specialMoveChance = 0.35; // 35% chance of special move
                break;
            case 'hard':
                aiSpeed *= 0.9;
                reactionDelay = 0.9;
                specialMoveChance = 0.6; // 60% chance of special move
                break;
        }
        
        // Ball is approaching and within planning distance
        if (ball.dx > 0 && isFinite(timeToReach) && timeToReach < 60) {
            // If it's a chopped ball, always try to return with chop on medium/hard
            if (ball.isChopped && ball.lastHitBy === 'player1') {
                if (difficulty !== 'easy' || Math.random() < 0.5) { // 50% chance on easy, 100% on others
                    const leadFrames = 2;
                    const schedule = Math.max(0, Math.round(timeToReach) - leadFrames);
                    aiAction.chopCountdown = schedule;
                }
            }
            // Consider special moves based on game state
            else if (Math.random() < specialMoveChance) {
                const ballSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                const leadFrames = 2;
                const schedule = Math.max(0, Math.round(timeToReach) - leadFrames);
                
                // Prefer smash if ball is slow or we're behind
                if (ballSpeed < ball.baseSpeed * 1.2 || gameState.player1.score > gameState.player2.score) {
                    aiAction.smashCountdown = schedule;
                }
                // Otherwise maybe chop
                else {
                    aiAction.chopCountdown = schedule;
                }
            }
        }

        // Only move if the ball is far enough from the predicted position
        if (Math.abs(diff) > paddle.height / 4) {
            const moveAmount = Math.sign(diff) * aiSpeed * reactionDelay;
            const newY = gameState.player2.y + moveAmount;
            
            // Keep paddle within canvas bounds
            if (newY >= 0 && newY + paddle.height <= canvas.height) {
                gameState.player2.y = newY;
            }
        }
    }
}

function resetGame() {
    gameState.player1.score = 0;
    gameState.player2.score = 0;
    updateScore();
    resetBall();
}

// Game loop
function update() {
    // Move paddles
    if (keys.ArrowUp && gameState.player1.y > 0) {
        gameState.player1.y -= paddle.speed;
        if (gameMode === 'multiplayer') socket.emit('paddle_move', { player: 'player1', y: gameState.player1.y });
    }
    if (keys.ArrowDown && gameState.player1.y < canvas.height - paddle.height) {
        gameState.player1.y += paddle.speed;
        if (gameMode === 'multiplayer') socket.emit('paddle_move', { player: 'player1', y: gameState.player1.y });
    }
    
    // Player 2 movement (in multiplayer mode)
    if (gameMode === 'multiplayer') {
        if (keys.w && gameState.player2.y > 0) {
            gameState.player2.y -= paddle.speed;
            socket.emit('paddle_move', { player: 'player2', y: gameState.player2.y });
        }
        if (keys.s && gameState.player2.y < canvas.height - paddle.height) {
            gameState.player2.y += paddle.speed;
            socket.emit('paddle_move', { player: 'player2', y: gameState.player2.y });
        }
    } else {
        updateAI();
    }

    // Handle serve inputs for player 1
    if (serving && serverSide === 'player1') {
        if (keys.ArrowRight && !prevKeys.ArrowRight) {
            // Smash serve
            ball.serveType = 'fast';
            serving = false;
            ball.speed = ball.baseSpeed * 1.5;
            ball.dx = ball.speed;
            ball.dy = -ball.speed/2;
            ball.verticalSpeed = 3;
        } else if (keys.ArrowUp && !prevKeys.ArrowUp) {
            // Normal serve
            ball.serveType = 'normal';
            serving = false;
            ball.speed = ball.baseSpeed;
            ball.dx = ball.speed;
            ball.dy = -ball.speed/2;
            ball.verticalSpeed = 2;
        } else if (keys.ArrowLeft && !prevKeys.ArrowLeft) {
            // Chop serve
            ball.serveType = 'slow';
            serving = false;
            ball.speed = ball.baseSpeed * 0.7;
            ball.dx = ball.speed;
            ball.dy = -ball.speed/2;
            ball.verticalSpeed = 1.5;
            ball.isChopped = true;
        }
    }
    
    // Handle serve inputs for player 2 (multiplayer mode)
    if (serving && serverSide === 'player2' && gameMode === 'multiplayer') {
        if (keys.d && !prevKeys.d) {
            // Smash serve
            ball.serveType = 'fast';
            serving = false;
            ball.speed = ball.baseSpeed * 1.5;
            ball.dx = -ball.speed;
            ball.dy = -ball.speed/2;
            ball.verticalSpeed = 3;
        } else if (keys.w && !prevKeys.w) {
            // Normal serve
            ball.serveType = 'normal';
            serving = false;
            ball.speed = ball.baseSpeed;
            ball.dx = -ball.speed;
            ball.dy = -ball.speed/2;
            ball.verticalSpeed = 2;
        } else if (keys.a && !prevKeys.a) {
            // Chop serve
            ball.serveType = 'slow';
            serving = false;
            ball.speed = ball.baseSpeed * 0.7;
            ball.dx = -ball.speed;
            ball.dy = -ball.speed/2;
            ball.verticalSpeed = 1.5;
            ball.isChopped = true;
        }
    }
    
    // Calculate next ball position with gravity and bouncing
    let nextX = gameState.ball.x + ball.dx;
    let nextY = gameState.ball.y + ball.dy;
    
    // Apply gravity to ball's altitude
    ball.verticalSpeed -= 0.5; // Gravity effect
    ball.altitude += ball.verticalSpeed;
    
    // Check for table bounce
    if (ball.altitude <= 0 && 
        nextX >= TABLE.left && 
        nextX <= TABLE.left + TABLE.width && 
        nextY >= TABLE.top && 
        nextY <= TABLE.top + TABLE.height) {
        
        // Handle serve rules
        if (serving) {
            const ballSide = nextX < TABLE.netX ? 'left' : 'right';
            const serverIsLeft = serverSide === 'player1';
            
            if (serveBounces === 0) {
                // First bounce must be on server's side
                if ((serverIsLeft && ballSide === 'left') || (!serverIsLeft && ballSide === 'right')) {
                    serveBounces++;
                    lastBounceX = nextX;
                } else {
                    // Point loss - wrong side first bounce
                    awardPoint(serverIsLeft ? 'player2' : 'player1');
                    return;
                }
            } else if (serveBounces === 1) {
                // Second bounce must be on receiver's side
                if ((serverIsLeft && ballSide === 'right') || (!serverIsLeft && ballSide === 'left')) {
                    serving = false;
                    serveBounces = 0;
                } else {
                    // Point loss - wrong side second bounce
                    awardPoint(serverIsLeft ? 'player2' : 'player1');
                    return;
                }
            }
        } else {
            // During rally, ball must bounce on receiving player's side
            if (ball.lastHitBy === 'player1' && nextX < TABLE.netX) {
                // Point loss - ball bounced on wrong side
                awardPoint('player2');
                return;
            } else if (ball.lastHitBy === 'player2' && nextX > TABLE.netX) {
                // Point loss - ball bounced on wrong side
                awardPoint('player1');
                return;
            }
            rallyBounces++;
        }
        
        // Bounce physics
        ball.altitude = 0;
        ball.verticalSpeed = Math.abs(ball.verticalSpeed) * 0.8; // 80% bounce efficiency
        hitEffects.push({ 
            x: nextX, 
            y: nextY, 
            type: 'bounce', 
            start: Date.now() 
        });
        playHitSound('bounce');
    }
    
    // Ball out of bounds (missed table or hit walls)
    if (nextY - ball.size/2 <= 0 || nextY + ball.size/2 >= canvas.height || 
        nextX <= 0 || nextX >= canvas.width) {
        // Award point to opposite player
        awardPoint(ball.lastHitBy === 'player1' ? 'player2' : 'player1');
        return;
    }

    // Update ball position
    gameState.ball.x = nextX;
    gameState.ball.y = nextY;

    // Add trail points for the ball
    if (ball.trails.length === 0 || Date.now() - ball.trails[ball.trails.length-1].time > 32) {
        ball.trails.push({
            x: gameState.ball.x,
            y: gameState.ball.y,
            time: Date.now()
        });
        // Limit trail length
        if (ball.trails.length > 5) {
            ball.trails.shift();
        }
    }

    // Add trail points for paddles
    ['player1', 'player2'].forEach(player => {
        const isLeft = player === 'player1';
        const faceX = isLeft ? paddle.width : (canvas.width - paddle.width);
        const centerX = isLeft ? (faceX + paddle.headRadius) : (faceX - paddle.headRadius);
        const y = gameState[player].y + paddle.height / 2;
        
        const trails = paddle.trails[player];
        if (trails.length === 0 || Date.now() - trails[trails.length-1].time > 32) {
            trails.push({
                centerX,
                y,
                time: Date.now()
            });
            // Limit trail length
            if (trails.length > 5) {
                trails.shift();
            }
        }
    });

    // Decrement AI countdowns and set transient actions when they hit zero
    if (aiAction.chopCountdown >= 0) {
        aiAction.chopCountdown -= 1;
        if (aiAction.chopCountdown <= 0) {
            aiAction.chop = true;
            // hold chop for one tick — will be consumed by checkPaddleCollision
            aiAction.chopCountdown = -1;
        }
    }
    if (aiAction.smashCountdown >= 0) {
        aiAction.smashCountdown -= 1;
        if (aiAction.smashCountdown <= 0) {
            aiAction.smash = true;
            aiAction.smashCountdown = -1;
        }
    }

    // Check paddle collisions
    if (checkPaddleCollision()) {
        // Ball direction is handled in checkPaddleCollision
        // Reverse horizontal direction and apply speed changes
        nextX = gameState.ball.x; // Use updated position after collision
    }

    // Ball out of bounds
    if (gameState.ball.x <= 0 || gameState.ball.x >= canvas.width) {
        if (gameState.ball.x <= 0) {
            gameState.player2.score++;
        } else {
            gameState.player1.score++;
        }
        updateScore();
        resetBall();
    }
}

function checkPaddleCollision() {
    const smashSpeedMultiplier = 1.5; // How much faster the ball goes when smashed
    const chopSpeedMultiplier = 0.85;  // How much slower the ball goes when chopped (now 0.85x)
    
    // Left paddle (Player 1) collision check — use paddle face X so it matches visual face
    const leftFaceX = paddle.width; // inner face x coordinate for left paddle
    if (gameState.ball.x - ball.size/2 <= leftFaceX && // ball left edge reaches paddle face
        gameState.ball.x + ball.size/2 >= 0 && // ball hasn't gone past left canvas edge
        gameState.ball.y + ball.size/2 >= gameState.player1.y && // Ball bottom edge >= paddle top
        gameState.ball.y - ball.size/2 <= gameState.player1.y + paddle.height) { // Ball top edge <= paddle bottom
        
        // Check if this is a chopped ball that hasn't been returned yet
        if (ball.isChopped && !ball.chopReturned && ball.lastHitBy === 'player2' && !keys.ArrowLeft) {
            gameState.player2.score++;
            updateScore();
            resetBall();
            return false;
        }
        
        ball.lastHitBy = 'player1';
        
        // If player successfully returns a chop with a chop, mark it as returned
        if (ball.isChopped && !ball.chopReturned && keys.ArrowLeft) {
            ball.chopReturned = true;
        }
        
        // Apply smash if right arrow is pressed
        if (keys.ArrowRight) {
            ball.isChopped = false;
            // Apply smash: increase speed and ensure direction
            ball.speed = ball.baseSpeed * smashSpeedMultiplier;
            ball.dx = Math.abs(ball.dx) * smashSpeedMultiplier;
            ball.dy = ball.dy * smashSpeedMultiplier;
            // Visual and audio feedback
            hitEffects.push({ x: gameState.ball.x, y: gameState.ball.y, type: 'smash', start: Date.now() });
            playHitSound('smash');
        }
        // Apply chop if left arrow is pressed
        else if (keys.ArrowLeft) {
            ball.isChopped = true;
            // Apply chop: slightly slower but close to normal speed
            ball.speed = ball.baseSpeed * chopSpeedMultiplier;
            ball.dx = Math.abs(ball.dx) * chopSpeedMultiplier;
            ball.dy = ball.dy * chopSpeedMultiplier;
            // Visual and audio feedback
            hitEffects.push({ x: gameState.ball.x, y: gameState.ball.y, type: 'chop', start: Date.now() });
            playHitSound('chop');
        } else {
            ball.isChopped = false;
            // Regular hit: reset to base speed
            ball.speed = ball.baseSpeed;
            ball.dx = Math.abs(ball.dx);
            // Maintain current y direction but normalize to base speed
            ball.dy = Math.sign(ball.dy) * ball.baseSpeed;
        }
        return true;
    }
    
    // Right paddle (Player 2) collision check
    const rightFaceX = canvas.width - paddle.width;
    if (gameState.ball.x + ball.size/2 >= rightFaceX && // ball right edge reaches paddle face
        gameState.ball.x - ball.size/2 <= canvas.width && // ball hasn't gone past right canvas edge
        gameState.ball.y + ball.size/2 >= gameState.player2.y && // Ball bottom edge >= paddle top
        gameState.ball.y - ball.size/2 <= gameState.player2.y + paddle.height) { // Ball top edge <= paddle bottom
        
        // Check if this is a chopped ball that hasn't been returned yet
        // Consider AI-requested chops (aiAction.chop) as equivalent to pressing 'a'
        if (ball.isChopped && !ball.chopReturned && ball.lastHitBy === 'player1' && !(keys.a || aiAction.chop)) {
            gameState.player1.score++;
            updateScore();
            resetBall();
            return false;
        }
        
        ball.lastHitBy = 'player2';
        
        // If AI/player2 successfully returns a chop with a chop, mark it as returned
        if (ball.isChopped && !ball.chopReturned && (keys.a || aiAction.chop)) {
            ball.chopReturned = true;
        }
        
        // Apply smash if D key is pressed (or AI requested)
        if (keys.d || aiAction.smash) {
            ball.isChopped = false;
            ball.speed = ball.baseSpeed * smashSpeedMultiplier;
            ball.dx = -Math.abs(ball.dx) * smashSpeedMultiplier; // Ensure it goes left
            // feedback
            hitEffects.push({ x: gameState.ball.x, y: gameState.ball.y, type: 'smash', start: Date.now() });
            playHitSound('smash');
            aiAction.smash = false;
        }
        // Apply chop if A key is pressed (or AI requested)
        else if (keys.a || aiAction.chop) {
            ball.isChopped = true;
            ball.speed = ball.baseSpeed * chopSpeedMultiplier;
            ball.dx = -Math.abs(ball.dx) * chopSpeedMultiplier; // Go left on chop for right paddle
            // feedback
            hitEffects.push({ x: gameState.ball.x, y: gameState.ball.y, type: 'chop', start: Date.now() });
            playHitSound('chop');
            aiAction.chop = false;
        } else {
            ball.isChopped = false;
            ball.speed = ball.baseSpeed; // Reset to normal speed for regular hits
            ball.dx = -Math.abs(ball.dx); // Ensure it goes left
        }
        return true;
    }
    
    return false;
}

// Message display system
let message = '';
let messageTimeout = null;

function showMessage(text, duration = 3000) {
    message = text;
    if (messageTimeout) clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
        message = '';
        messageTimeout = null;
    }, duration);
}

function resetBall() {
    serving = true;
    serveBounces = 0;
    rallyBounces = 0;
    
    // Set ball position based on server
    if (serverSide === 'player1') {
        gameState.ball.x = paddle.width + 20;
        ball.dx = ball.baseSpeed;
    } else {
        gameState.ball.x = canvas.width - paddle.width - 20;
        ball.dx = -ball.baseSpeed;
    }
    
    gameState.ball.y = canvas.height / 2;
    ball.speed = ball.baseSpeed;
    ball.dy = 0;
    ball.altitude = 0;
    ball.verticalSpeed = 2;
    ball.isChopped = false;
    ball.lastHitBy = null;
    ball.chopReturned = false;
    ball.serveType = 'normal';
    
    if (serverSide === 'player1') {
        showMessage("Press UP for fast serve, RIGHT for normal serve, or DOWN for slow serve");
    }

// Draw a pseudo-3D table using a trapezoid and center net
function drawTable3D() {
    // Calculate perspective distortion
    const margin = TABLE.left;
    const topInset = 120; // how much narrower the top edge is
    const leftTop = margin + topInset;
    const rightTop = canvas.width - margin - topInset;
    const leftBottom = margin;
    const rightBottom = canvas.width - margin;

    // Draw table surface with court lines
    const grad = ctx.createLinearGradient(0, TABLE.top, 0, TABLE.top + TABLE.height);
    grad.addColorStop(0, '#1b5e20');
    grad.addColorStop(1, '#145214');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(leftTop, TABLE.top);
    ctx.lineTo(rightTop, TABLE.top);
    ctx.lineTo(rightBottom, TABLE.top + TABLE.height);
    ctx.lineTo(leftBottom, TABLE.top + TABLE.height);
    ctx.closePath();
    ctx.fill();

    // Draw court lines (service lines)
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    
    // Draw vertical center line
    const centerTop = (leftTop + rightTop) / 2;
    const centerBottom = (leftBottom + rightBottom) / 2;
    ctx.beginPath();
    ctx.moveTo(centerTop, TABLE.top);
    ctx.lineTo(centerBottom, TABLE.top + TABLE.height);
    ctx.stroke();

    // Draw center line (perspective)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo((leftTop + rightTop) / 2, 40);
    ctx.lineTo((leftBottom + rightBottom) / 2, canvas.height - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw net as a thin darker rectangle in middle
    const netX1 = (leftTop + rightTop) / 2 - 2;
    const netX2 = (leftTop + rightTop) / 2 + 2;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(netX1, 40, netX2 - netX1, canvas.height - 60);

    // Draw subtle floor/shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, canvas.height - 6, canvas.width, 6);
}

// Draw a realistic ping-pong paddle for player 'player1' or 'player2'
function drawPaddleReal(player) {
    const isLeft = player === 'player1';
    const y = gameState[player].y + paddle.height / 2;
    const faceX = isLeft ? paddle.width : (canvas.width - paddle.width);
    const centerX = isLeft ? (faceX + paddle.headRadius) : (faceX - paddle.headRadius);
    
    // Draw motion trails with fade
    const trails = paddle.trails[player];
    for (let i = trails.length - 1; i >= 0; i--) {
        const trail = trails[i];
        const age = Date.now() - trail.time;
        if (age > 120) { // Remove old trails
            trails.splice(i, 1);
            continue;
        }
        const alpha = Math.max(0, 0.15 * (1 - age/120));
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.fillStyle = isLeft ? '#b71c1c' : '#0d47a1';
        ctx.arc(trail.centerX, trail.y, paddle.headRadius * 0.9, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw head (rubber)
    ctx.beginPath();
    ctx.fillStyle = isLeft ? '#b71c1c' : '#0d47a1'; // different color for each player
    ctx.arc(centerX, y, paddle.headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#222';
    ctx.stroke();

    // Draw handle - a small rounded rectangle extending from the head
    ctx.save();
    ctx.translate(centerX, y);
    ctx.rotate(isLeft ? Math.PI : 0);
    ctx.fillStyle = '#6d4c41';
    const hw = 6; // handle width
    const hl = paddle.headRadius + 6; // handle length
    ctx.beginPath();
    ctx.rect(-hl, -hw, hl - (paddle.headRadius * 0.2), hw * 2);
    ctx.fill();
    ctx.restore();

    // Draw small edge highlight on the face
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.2;
    ctx.arc(centerX - (isLeft ? paddle.headRadius * 0.2 : -paddle.headRadius * 0.2), y - paddle.headRadius * 0.25, paddle.headRadius * 0.6, 0, Math.PI * 2);
    ctx.stroke();
}

function awardPoint(player) {
    gameState[player].score++;
    
    // Check for win condition
    const p1Score = gameState.player1.score;
    const p2Score = gameState.player2.score;
    
    if ((p1Score >= POINTS_TO_WIN && p1Score - p2Score >= POINTS_LEAD_NEEDED) ||
        (p2Score >= POINTS_TO_WIN && p2Score - p1Score >= POINTS_LEAD_NEEDED)) {
        // Game over
        const winner = p1Score > p2Score ? 'Player 1' : 'Player 2';
        alert(`Game Over! ${winner} wins ${p1Score}-${p2Score}!`);
        resetGame();
    } else {
        updateScore();
        resetBall();
    }
}

function updateScore() {
    document.getElementById('player1-score').textContent = gameState.player1.score;
    document.getElementById('player2-score').textContent = gameState.player2.score;
    
    // Show game point status
    if (gamePoint) {
        const leader = gameState.player1.score > gameState.player2.score ? 'Player 1' : 'Player 2';
        ctx.fillStyle = '#ff0';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('GAME POINT', canvas.width/2 - 60, 30);
    }
}

function draw() {
    // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw a pseudo-3D table
    drawTable3D();

    // Draw middle line
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw paddles (realistic ping-pong paddle shapes)
    drawPaddleReal('player1');
    drawPaddleReal('player2');

    // Draw message if present
    if (message) {
        ctx.save();
        ctx.font = '16px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(message, canvas.width / 2, 30);
        ctx.restore();
    }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ball.isChopped ? '#ff0' : '#fff';
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, ball.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw ball shadow on table
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.ellipse(
        gameState.ball.x, 
        gameState.ball.y, 
        ball.size * 0.4, 
        ball.size * 0.2, 
        0, 0, Math.PI * 2
    );
    ctx.fill();

    // Draw ball with height offset
    const heightScale = Math.max(0.5, 1 - (ball.altitude / 100));
    ctx.beginPath();
    if (ball.isChopped) {
        ctx.fillStyle = '#ff0'; // Yellow for chopped balls
    } else {
        ctx.fillStyle = '#fff';
    }
    // Draw the ball offset by its altitude
    ctx.arc(
        gameState.ball.x, 
        gameState.ball.y - ball.altitude, 
        ball.size * heightScale, 
        0, Math.PI * 2
    );
    ctx.fill();

    // Add a slight highlight for 3D effect
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.arc(
        gameState.ball.x - ball.size/4, 
        gameState.ball.y - ball.altitude - ball.size/4, 
        ball.size/4 * heightScale, 
        0, Math.PI * 2
    );
    ctx.fill();
    
        // Draw hit effects (expand/fade)
        const now = Date.now();
        for (let i = hitEffects.length - 1; i >= 0; i--) {
            const ef = hitEffects[i];
            const t = (now - ef.start) / 400; // 0..1 over 400ms
            if (t >= 1) {
                hitEffects.splice(i, 1);
                continue;
            }
            ctx.beginPath();
            const radius = (ball.size * 1.5) + (t * 20);
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = (ef.type === 'smash') ? '#f44' : '#ff0';
            ctx.lineWidth = 2;
            ctx.arc(ef.x, ef.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    
    // Draw game mode and controls
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.fillText(`Mode: ${gameMode.toUpperCase()}${gameMode === 'ai' ? ` (${difficulty.toUpperCase()})` : ''}`, 10, 25);
    ctx.fillText('P1: ← (Chop) → (Smash)', 10, 50);
    if (gameMode === 'multiplayer') {
        ctx.fillText('P2: A (Chop) D (Smash)', canvas.width - 200, 50);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function startGame() {
    resetBall();
    updateScore();
    // Start the game loop
    requestAnimationFrame(gameLoop);
    console.log('Game started');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGame);
} else {
    startGame();
}