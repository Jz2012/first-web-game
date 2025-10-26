git remote add replit https://replit.com/@username/replname.gitconst socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game settings
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 600;

// Set canvas size
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Game modes and difficulty
let gameMode = 'ai'; // 'ai' or 'multiplayer'
let difficulty = 'medium'; // 'easy', 'medium', 'hard'

// Game objects
const paddle = {
    width: 15,
    height: 80,
    speed: 8
};

const ball = {
    size: 12,
    speed: 6,
    dx: 6,
    dy: 6,
    isChopped: false,
    lastHitBy: null // 'player1' or 'player2'
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
function updateAI() {
    if (gameMode === 'ai') {
        // AI follows the ball with some delay
        const targetY = gameState.ball.y - paddle.height / 2;
        const currentY = gameState.player2.y;
        const diff = targetY - currentY;
        
        // Add some randomness and delay based on difficulty
        let aiSpeed = paddle.speed;
        switch(difficulty) {
            case 'easy':
                aiSpeed *= 0.5;
                if (Math.abs(diff) > paddle.height) {
                    gameState.player2.y += Math.sign(diff) * aiSpeed;
                }
                break;
            case 'medium':
                aiSpeed *= 0.7;
                if (Math.abs(diff) > paddle.height / 2) {
                    gameState.player2.y += Math.sign(diff) * aiSpeed;
                }
                break;
            case 'hard':
                if (Math.abs(diff) > paddle.height / 4) {
                    gameState.player2.y += Math.sign(diff) * aiSpeed;
                }
                break;
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

    // Move ball
    gameState.ball.x += ball.dx;
    gameState.ball.y += ball.dy;

    // Ball collision with top and bottom
    if (gameState.ball.y <= 0 || gameState.ball.y >= canvas.height) {
        ball.dy *= -1;
    }

    // Ball collision with paddles
    if (checkPaddleCollision()) {
        ball.dx *= -1;
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
    
    // Left paddle (Player 1)
    if (gameState.ball.x <= paddle.width &&
        gameState.ball.y >= gameState.player1.y &&
        gameState.ball.y <= gameState.player1.y + paddle.height) {
        
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
            ball.speed *= smashSpeedMultiplier;
            ball.dx = Math.abs(ball.dx) * smashSpeedMultiplier; // Ensure it goes right
        }
        // Apply chop if left arrow is pressed
        else if (keys.ArrowLeft) {
            ball.isChopped = true;
            ball.speed *= chopSpeedMultiplier;
            ball.dx = Math.abs(ball.dx) * chopSpeedMultiplier; // Ensure it goes right
        } else {
            ball.isChopped = false;
            ball.speed = 5; // Reset to normal speed for regular hits
            ball.dx = Math.abs(ball.dx); // Ensure it goes right
        }
        return true;
    }
    
    // Right paddle (Player 2)
    if (gameState.ball.x >= canvas.width - paddle.width &&
        gameState.ball.y >= gameState.player2.y &&
        gameState.ball.y <= gameState.player2.y + paddle.height) {
        
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
            ball.dx = -Math.abs(ball.dx) * chopSpeedMultiplier; // Ensure it goes left
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
    ball.speed = 5; // Reset ball speed to default
    ball.dx = (Math.random() > 0.5 ? 1 : -1) * ball.speed;
    ball.dy = (Math.random() > 0.5 ? 1 : -1) * ball.speed;
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