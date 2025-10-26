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

// Difficulty configurations
const difficulties = {
    easy: {
        name: 'Easy',
        maxSpeed: 2.5,
        reactionFrames: 15,
        predictionError: 40,
        mistakeChance: 0.15
    },
    medium: {
        name: 'Medium',
        maxSpeed: 3.5,
        reactionFrames: 8,
        predictionError: 20,
        mistakeChance: 0.08
    },
    hard: {
        name: 'Hard',
        maxSpeed: 5,
        reactionFrames: 3,
        predictionError: 5,
        mistakeChance: 0.02
    }
};

let currentDifficulty = 'easy';
let gameMode = 'ai'; // 'ai' or 'multiplayer'
let aiReactionTimer = 0;
let aiTargetY = canvas.height / 2;
let canSmash = true;
let smashCooldown = 0;

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
    ArrowRight: false,
    KeyD: false,
    KeyW: false,
    KeyS: false
};

document.addEventListener('keydown', (e) => {
    const keyCode = e.code || e.key;
    
    if (keyCode in keys) {
        if (!keys[keyCode]) {
            keys[keyCode] = true;
            
            // Handle smash
            if ((keyCode === 'ArrowRight' || keyCode === 'KeyD') && canSmash) {
                performSmash();
            }
        }
    }
    
    // Legacy support for arrow keys
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        keys[e.key] = true;
    }
});

document.addEventListener('keyup', (e) => {
    const keyCode = e.code || e.key;
    
    if (keyCode in keys) {
        keys[keyCode] = false;
    }
    
    // Legacy support for arrow keys
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        keys[e.key] = false;
    }
});

// Socket events
socket.on('paddle_update', (data) => {
    if (data.player === 'player2') {
        gameState.player2.y = data.y;
    }
});

// Smash mechanic
function performSmash() {
    if (!canSmash || smashCooldown > 0) return;
    
    // Only smash if ball is close to player 1's paddle and moving toward them
    const ballDistance = Math.abs(gameState.ball.x - paddle.width);
    if (ballDistance < 100 && ball.dx < 0) {
        // Make ball go straight forward and fast (toward player 2)
        ball.dx = Math.abs(ball.speed * 2.5); // Much faster, always positive (right)
        ball.dy = (Math.random() - 0.5) * 2; // Mostly straight with slight variation
        
        canSmash = false;
        smashCooldown = 60; // Cooldown frames (1 second at 60fps)
        
        console.log('SMASH!');
    }
}

// Predict where ball will land on AI's side
function predictBallLanding() {
    const difficulty = difficulties[currentDifficulty];
    
    // Only predict if ball is moving toward AI
    if (ball.dx <= 0) {
        return gameState.ball.y;
    }
    
    // Simulate ball trajectory
    let simX = gameState.ball.x;
    let simY = gameState.ball.y;
    let simDx = ball.dx;
    let simDy = ball.dy;
    
    // Simulate until ball reaches AI's x position
    let iterations = 0;
    const maxIterations = 500;
    
    while (simX < canvas.width - paddle.width && iterations < maxIterations) {
        simX += simDx;
        simY += simDy;
        iterations++;
        
        // Handle top/bottom wall bounces
        if (simY <= 0 || simY >= canvas.height) {
            simDy *= -1;
            simY = Math.max(0, Math.min(canvas.height, simY));
        }
        
        // Safety check
        if (simX > canvas.width * 2) break;
    }
    
    // Add prediction error based on difficulty
    const error = (Math.random() - 0.5) * difficulty.predictionError;
    let targetY = simY + error;
    
    // Random mistakes
    if (Math.random() < difficulty.mistakeChance) {
        targetY += (Math.random() - 0.5) * 100;
    }
    
    // Keep target within bounds
    targetY = Math.max(paddle.height / 2, Math.min(canvas.height - paddle.height / 2, targetY));
    
    return targetY;
}

// Game loop
function update() {
    // Update smash cooldown
    if (smashCooldown > 0) {
        smashCooldown--;
        if (smashCooldown === 0) {
            canSmash = true;
        }
    }
    
    // Move player 1 paddle
    if (keys.ArrowUp && gameState.player1.y > 0) {
        gameState.player1.y -= paddle.speed;
    }
    if (keys.ArrowDown && gameState.player1.y < canvas.height - paddle.height) {
        gameState.player1.y += paddle.speed;
    }

    // Player 2 control (AI or human)
    if (gameMode === 'ai') {
        // AI for player 2 paddle with prediction
        const difficulty = difficulties[currentDifficulty];
        
        // Update AI target with reaction delay
        if (aiReactionTimer <= 0) {
            aiTargetY = predictBallLanding();
            aiReactionTimer = difficulty.reactionFrames;
        } else {
            aiReactionTimer--;
        }
        
        // Move AI paddle toward predicted position
        const paddleCenter = gameState.player2.y + paddle.height / 2;
        const aiSpeed = difficulty.maxSpeed;
        
        if (Math.abs(paddleCenter - aiTargetY) > 5) {
            if (paddleCenter < aiTargetY) {
                gameState.player2.y += aiSpeed;
            } else {
                gameState.player2.y -= aiSpeed;
            }
        }
        
        // Keep AI paddle within bounds
        if (gameState.player2.y < 0) {
            gameState.player2.y = 0;
        }
        if (gameState.player2.y > canvas.height - paddle.height) {
            gameState.player2.y = canvas.height - paddle.height;
        }
    } else {
        // Multiplayer: W/S keys for player 2
        if (keys.KeyW && gameState.player2.y > 0) {
            gameState.player2.y -= paddle.speed;
        }
        if (keys.KeyS && gameState.player2.y < canvas.height - paddle.height) {
            gameState.player2.y += paddle.speed;
        }
        
        // Keep player 2 paddle within bounds
        if (gameState.player2.y < 0) {
            gameState.player2.y = 0;
        }
        if (gameState.player2.y > canvas.height - paddle.height) {
            gameState.player2.y = canvas.height - paddle.height;
        }
    }

    // Move ball
    gameState.ball.x += ball.dx;
    gameState.ball.y += ball.dy;

    // Ball collision with top and bottom
    if (gameState.ball.y <= 0 || gameState.ball.y >= canvas.height) {
        ball.dy *= -1;
        // Clamp ball position to prevent going out of bounds
        gameState.ball.y = Math.max(0, Math.min(canvas.height, gameState.ball.y));
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

// Mode selector event handlers
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const newMode = btn.dataset.mode;
        
        // Update active button
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update mode
        gameMode = newMode;
        
        // Toggle difficulty selector and help text visibility
        const difficultySelector = document.getElementById('difficulty-selector');
        const player2Help = document.getElementById('player2-help');
        
        if (gameMode === 'multiplayer') {
            difficultySelector.classList.add('hidden');
            player2Help.classList.remove('hidden');
        } else {
            difficultySelector.classList.remove('hidden');
            player2Help.classList.add('hidden');
        }
        
        console.log(`Mode changed to: ${newMode}`);
    });
});

// Difficulty selector event handlers
document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const newDifficulty = btn.dataset.difficulty;
        
        // Update active button
        document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update difficulty
        currentDifficulty = newDifficulty;
        aiReactionTimer = 0;
        
        console.log(`Difficulty changed to: ${difficulties[currentDifficulty].name}`);
    });
});

// Start the game
gameLoop();