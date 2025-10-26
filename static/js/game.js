const socket = io();
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
    dy: 5
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
    ArrowDown: false
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
    // Move player 1 paddle
    if (keys.ArrowUp && gameState.player1.y > 0) {
        gameState.player1.y -= paddle.speed;
    }
    if (keys.ArrowDown && gameState.player1.y < canvas.height - paddle.height) {
        gameState.player1.y += paddle.speed;
    }

    // AI for player 2 paddle
    const paddleCenter = gameState.player2.y + paddle.height / 2;
    const aiSpeed = 3.5;
    
    if (paddleCenter < gameState.ball.y - 10) {
        gameState.player2.y += aiSpeed;
    } else if (paddleCenter > gameState.ball.y + 10) {
        gameState.player2.y -= aiSpeed;
    }
    
    // Keep AI paddle within bounds
    if (gameState.player2.y < 0) {
        gameState.player2.y = 0;
    }
    if (gameState.player2.y > canvas.height - paddle.height) {
        gameState.player2.y = canvas.height - paddle.height;
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
    // Left paddle
    if (gameState.ball.x <= paddle.width &&
        gameState.ball.y >= gameState.player1.y &&
        gameState.ball.y <= gameState.player1.y + paddle.height) {
        return true;
    }
    
    // Right paddle
    if (gameState.ball.x >= canvas.width - paddle.width &&
        gameState.ball.y >= gameState.player2.y &&
        gameState.ball.y <= gameState.player2.y + paddle.height) {
        return true;
    }
    
    return false;
}

function resetBall() {
    gameState.ball.x = canvas.width / 2;
    gameState.ball.y = canvas.height / 2;
    ball.dx = (Math.random() > 0.5 ? 1 : -1) * ball.speed;
    ball.dy = (Math.random() > 0.5 ? 1 : -1) * ball.speed;
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

    // Draw ball
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, ball.size / 2, 0, Math.PI * 2);
    ctx.fill();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();