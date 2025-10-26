git remote add replit https://replit.com/@username/replname.gitconst socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 800;
canvas.height = 400;

// Game objects
const paddle = {
    width: 10,
    height: 60,
    speed: 5
};

const ball = {
    size: 10,
    speed: 5,
    dx: 5,
    dy: 5,
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
    ArrowUp: false,
    ArrowDown: false,
    ArrowRight: false, // Smash key for player 1
    ArrowLeft: false,  // Chop key for player 1
    d: false,          // Smash key for player 2
    a: false           // Chop key for player 2
};

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

// Game loop
function update() {
    // Move paddles
    if (keys.ArrowUp && gameState.player1.y > 0) {
        gameState.player1.y -= paddle.speed;
    }
    if (keys.ArrowDown && gameState.player1.y < canvas.height - paddle.height) {
        gameState.player1.y += paddle.speed;
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
    
    // Draw controls reminder
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.fillText('P1: ← (Chop) → (Smash)', 10, 20);
    ctx.fillText('P2: A (Chop) D (Smash)', canvas.width - 150, 20);
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();