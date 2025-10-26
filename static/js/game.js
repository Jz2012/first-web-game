const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game settings
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;

// Set canvas size
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Game modes and difficulty
let gameMode = 'ai'; // 'ai' or 'multiplayer'
let difficulty = 'medium'; // 'easy', 'medium', 'hard'

// Game objects
const paddle = {
    width: 10,
    height: 60,
    speed: 6
};

const ball = {
    size: 8,
    baseSpeed: 5,    // Base speed that we'll return to after hits
    speed: 5,        // Current speed
    dx: 5,          // Horizontal speed
    dy: 5,          // Vertical speed
    isChopped: false,
    lastHitBy: null  // 'player1' or 'player2'
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
    // Only predict if ball is moving towards AI
    if (ball.dx <= 0) return gameState.ball.y;
    
    // Calculate time to reach paddle
    const distanceToTravel = canvas.width - paddle.width - gameState.ball.x;
    const timeToReach = distanceToTravel / Math.abs(ball.dx);
    
    // Calculate Y position when ball reaches paddle
    let predictedY = gameState.ball.y + (ball.dy * timeToReach);
    
    // Account for bounces
    const bounces = Math.floor(Math.abs(predictedY) / canvas.height);
    if (bounces > 0) {
        const remainder = predictedY % canvas.height;
        predictedY = (bounces % 2 === 0) ? remainder : canvas.height - remainder;
    }
    
    return Math.min(Math.max(predictedY, 0), canvas.height);
}

function updateAI() {
    if (gameMode === 'ai') {
        const predictedY = predictBallPosition();
        const targetY = predictedY - paddle.height / 2;
        const currentY = gameState.player2.y;
        const diff = targetY - currentY;
        
        let aiSpeed = paddle.speed;
        let reactionDelay = 1.0;
        
        switch(difficulty) {
            case 'easy':
                aiSpeed *= 0.5;
                reactionDelay = 0.3;
                // Sometimes move in wrong direction on easy
                if (Math.random() < 0.2) {
                    gameState.player2.y -= Math.sign(diff) * aiSpeed;
                    return;
                }
                break;
            case 'medium':
                aiSpeed *= 0.7;
                reactionDelay = 0.6;
                break;
            case 'hard':
                aiSpeed *= 0.9;
                reactionDelay = 0.9;
                break;
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
    }
    if (keys.ArrowDown && gameState.player1.y < canvas.height - paddle.height) {
        gameState.player1.y += paddle.speed;
    }
    
    // Player 2 movement (in multiplayer mode)
    if (gameMode === 'multiplayer') {
        if (keys.w && gameState.player2.y > 0) {
            gameState.player2.y -= paddle.speed;
        }
        if (keys.s && gameState.player2.y < canvas.height - paddle.height) {
            gameState.player2.y += paddle.speed;
        }
    } else {
        updateAI();
    }

    // Calculate next ball position
    let nextX = gameState.ball.x + ball.dx;
    let nextY = gameState.ball.y + ball.dy;

    // Ball collision with top and bottom walls
    if (nextY - ball.size/2 <= 0) {
        nextY = ball.size/2;
        ball.dy = Math.abs(ball.dy); // Ensure ball moves downward
    } else if (nextY + ball.size/2 >= canvas.height) {
        nextY = canvas.height - ball.size/2;
        ball.dy = -Math.abs(ball.dy); // Ensure ball moves upward
    }

    // Update ball position
    gameState.ball.x = nextX;
    gameState.ball.y = nextY;

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
    const chopSpeedMultiplier = 0.6;  // How much slower the ball goes when chopped
    
    // Left paddle (Player 1) collision check
    if (gameState.ball.x <= paddle.width && // Ball reaches paddle x position
        gameState.ball.x >= 0 && // Ball hasn't gone past paddle
        gameState.ball.y + ball.size/2 >= gameState.player1.y && // Ball bottom edge >= paddle top
        gameState.ball.y - ball.size/2 <= gameState.player1.y + paddle.height) { // Ball top edge <= paddle bottom
        
        // Check if this is a chopped ball that wasn't returned with a chop
        if (ball.isChopped && ball.lastHitBy === 'player2' && !keys.ArrowLeft) {
            gameState.player2.score++;
            updateScore();
            resetBall();
            return false;
        }
        
        ball.lastHitBy = 'player1';
        
        // Apply smash if right arrow is pressed
        if (keys.ArrowRight) {
            ball.isChopped = false;
            // Apply smash: increase speed and ensure direction
            ball.speed = ball.baseSpeed * smashSpeedMultiplier;
            ball.dx = Math.abs(ball.dx) * smashSpeedMultiplier;
            ball.dy = ball.dy * smashSpeedMultiplier;
        }
        // Apply chop if left arrow is pressed
        else if (keys.ArrowLeft) {
            ball.isChopped = true;
            // Apply chop: decrease speed and ensure direction
            ball.speed = ball.baseSpeed * chopSpeedMultiplier;
            ball.dx = Math.abs(ball.dx) * chopSpeedMultiplier;
            ball.dy = ball.dy * chopSpeedMultiplier;
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
    if (gameState.ball.x >= canvas.width - paddle.width && // Ball reaches paddle x position
        gameState.ball.x <= canvas.width && // Ball hasn't gone past paddle
        gameState.ball.y + ball.size/2 >= gameState.player2.y && // Ball bottom edge >= paddle top
        gameState.ball.y - ball.size/2 <= gameState.player2.y + paddle.height) { // Ball top edge <= paddle bottom
        
        // Check if this is a chopped ball that wasn't returned with a chop
        if (ball.isChopped && ball.lastHitBy === 'player1' && !keys.a) {
            gameState.player1.score++;
            updateScore();
            resetBall();
            return false;
        }
        
        ball.lastHitBy = 'player2';
        
        // Apply smash if D key is pressed
        if (keys.d) {
            ball.isChopped = false;
            ball.speed *= smashSpeedMultiplier;
            ball.dx = -Math.abs(ball.dx) * smashSpeedMultiplier; // Ensure it goes left
        }
        // Apply chop if A key is pressed
        else if (keys.a) {
            ball.isChopped = true;
            ball.speed *= chopSpeedMultiplier;
            ball.dx = -Math.abs(ball.dx) * chopSpeedMultiplier; // Go left on chop for right paddle
        } else {
            ball.isChopped = false;
            ball.speed = 5; // Reset to normal speed for regular hits
            ball.dx = -Math.abs(ball.dx); // Ensure it goes left
        }
        return true;
    }
    
    return false;
}

function resetBall() {
    gameState.ball.x = canvas.width / 2;
    gameState.ball.y = canvas.height / 2;
    ball.speed = ball.baseSpeed; // Reset to base speed
    // Set initial direction with slightly randomized angle
    const angle = (Math.random() * Math.PI/4) - Math.PI/8; // Random angle between -22.5 and 22.5 degrees
    ball.dx = (Math.random() > 0.5 ? 1 : -1) * (ball.speed * Math.cos(angle));
    ball.dy = (Math.random() > 0.5 ? 1 : -1) * (ball.speed * Math.sin(angle));
    ball.isChopped = false;
    ball.lastHitBy = null;
}

function updateScore() {
    document.getElementById('player1-score').textContent = gameState.player1.score;
    document.getElementById('player2-score').textContent = gameState.player2.score;
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw middle line
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw paddles
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, gameState.player1.y, paddle.width, paddle.height);
    ctx.fillRect(canvas.width - paddle.width, gameState.player2.y, paddle.width, paddle.height);

    // Draw ball with indicator for chopped shots
    ctx.beginPath();
    if (ball.isChopped) {
        ctx.fillStyle = '#ff0'; // Yellow for chopped balls
        // Draw a slightly larger ball for chopped shots
        ctx.arc(gameState.ball.x, gameState.ball.y, ball.size / 1.5, 0, Math.PI * 2);
    } else {
        ctx.fillStyle = '#fff';
        ctx.arc(gameState.ball.x, gameState.ball.y, ball.size / 2, 0, Math.PI * 2);
    }
    ctx.fill();
    
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

// Start the game
gameLoop();