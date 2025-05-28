// Game constants
const GRAVITY = 0.25; // Reduced from 0.5 to make falling slower
const PIPE_GAP = 250; // Slightly wider gap
const FLAP_FORCE = -8; // Original
const PIPE_SPAWN_INTERVAL = 1500; // Reduced from 3000 to make gaps between pipes half the distance
const GROUND_HEIGHT = 50;
const PIPE_SPEED_START = 100; // Reduced from 200 to make game slower
const PIPE_SPEED_INCREMENT = 5; // Reduced from 30 to make progression very gradual
const PIPE_SPEED_SCORE_STEP = 1; // Changed to 1 to increase speed with every point

// Leaderboard helpers
const LEADERBOARD_KEY = 'flappy_leaderboard';
function getLeaderboard() {
    return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
}
function saveLeaderboard(lb) {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(lb));
}
function addScoreToLeaderboard(initials, score) {
    let lb = getLeaderboard();
    lb.push({ initials, score });
    lb = lb.sort((a, b) => b.score - a.score).slice(0, 10);
    saveLeaderboard(lb);
}

function isHighScore(score) {
    const lb = getLeaderboard();
    if (lb.length < 10) return true;
    return score > lb[lb.length - 1].score;
}

function getBestScore() {
    const lb = getLeaderboard();
    return lb.length > 0 ? lb[0].score : 0;
}

function renderLeaderboard() {
    const lb = getLeaderboard();
    const ol = document.getElementById('leaderboard');
    ol.innerHTML = '';
    lb.forEach(entry => {
        const li = document.createElement('li');
        li.textContent = `${entry.initials} - ${entry.score}`;
        ol.appendChild(li);
    });
}

// Game class to manage the overall game state
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        this.init();
        this.setupEventListeners();
        this.lastTime = 0;
        requestAnimationFrame(this.gameLoop.bind(this));
        console.log('Game initialized');
    }
    
    init() {
        this.smiley = new SmileyFace();
        this.pipes = [];
        this.score = 0;
        this.gameOver = false;
        this.gameStarted = false;
        this.lastPipeSpawn = 0;
        this.pipeSpeed = PIPE_SPEED_START;
        this.setupGameOverScreen();
        this.setupStartScreen();
    }
    
    setupCanvas() {
        this.canvas.width = Math.min(800, window.innerWidth - 40);
        this.canvas.height = 600;
        console.log('Canvas size:', this.canvas.width, 'x', this.canvas.height);
    }
    
    setupEventListeners() {
        // Space bar and mouse/touch controls
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault(); // Prevent page scrolling
                this.handleFlap();
            }
        });
        
        this.canvas.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleFlap();
        });
        
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleFlap();
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
        });
    }
    
    setupGameOverScreen() {
        this.restartButton = document.getElementById('restartButton');
        this.restartButton.addEventListener('click', () => this.restart());
        this.initialsEntry = document.getElementById('initialsEntry');
        this.initialsInput = document.getElementById('initialsInput');
        this.submitInitials = document.getElementById('submitInitials');
        this.submitInitials.addEventListener('click', () => this.submitHighScore());
        this.initialsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.submitHighScore();
        });
    }

    setupStartScreen() {
        this.startButton = document.getElementById('startButton');
        this.countdownOverlay = document.getElementById('countdownOverlay');
        this.startButton.addEventListener('click', () => this.startCountdown());
    }
    
    startCountdown() {
        let count = 3;
        this.countdownOverlay.textContent = count;
        this.countdownOverlay.classList.remove('hidden');
        const tick = () => {
            if (count > 1) {
                count--;
                this.countdownOverlay.textContent = count;
                setTimeout(tick, 700);
            } else {
                this.countdownOverlay.textContent = 'Go!';
                setTimeout(() => {
                    this.countdownOverlay.classList.add('hidden');
                    this.startGame();
                }, 700);
            }
        };
        setTimeout(tick, 700);
    }
    
    startGame() {
        this.gameStarted = true;
        this.gameOver = false;
        document.getElementById('startScreen').classList.add('hidden');
        this.smiley = new SmileyFace();
        this.pipes = [];
        this.score = 0;
        this.pipeSpeed = PIPE_SPEED_START;
        document.getElementById('score').textContent = 'Score: 0';
        this.lastPipeSpawn = Date.now();
        this.spawnPipe();
    }
    
    handleFlap() {
        if (!this.gameOver && this.gameStarted) {
            console.log('Flap!');
            this.smiley.flap();
        }
    }
    
    spawnPipe() {
        const minHeight = 50;
        const maxHeight = this.canvas.height - GROUND_HEIGHT - PIPE_GAP - minHeight;
        const height = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
        
        this.pipes.push(new Pipe(this.canvas.width, height));
        console.log('New pipe spawned at height:', height);
    }
    
    update(deltaTime) {
        if (this.gameOver || !this.gameStarted) return;
        this.smiley.update();
        // Consistent pipe spawn interval
        const now = Date.now();
        if (now - this.lastPipeSpawn >= PIPE_SPAWN_INTERVAL) {
            this.spawnPipe();
            this.lastPipeSpawn = now;
        }
        this.pipes = this.pipes.filter(pipe => {
            pipe.update(this.pipeSpeed);
            if (!pipe.scored && pipe.x + pipe.width < this.smiley.x) {
                this.score++;
                pipe.scored = true;
                document.getElementById('score').textContent = `Score: ${this.score}`;
                // Increase pipe speed every 10 points
                if (this.score % PIPE_SPEED_SCORE_STEP === 0) {
                    this.pipeSpeed += PIPE_SPEED_INCREMENT;
                }
            }
            return pipe.x + pipe.width > 0;
        });
        if (this.checkCollisions()) {
            this.endGame();
        }
    }
    
    checkCollisions() {
        // Check ground collision
        if (this.smiley.y + this.smiley.height > this.canvas.height - GROUND_HEIGHT) {
            console.log('Ground collision');
            return true;
        }
        
        // Check pipe collisions
        const collision = this.pipes.some(pipe => pipe.checkCollision(this.smiley));
        if (collision) {
            console.log('Pipe collision');
        }
        return collision;
    }
    
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background
        this.drawBackground();
        
        // Draw pipes
        this.pipes.forEach(pipe => pipe.draw(this.ctx));
        
        // Draw ground
        this.drawGround();
        
        // Draw airplane
        this.smiley.draw(this.ctx);
    }
    
    drawBackground() {
        // Sky gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#ffb6c1');
        gradient.addColorStop(1, '#ffe4ec');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw multiple clouds
        this.drawCloud(100, 100, 1);
        this.drawCloud(300, 70, 0.8);
        this.drawCloud(600, 120, 1.2);
        this.drawCloud(200, 200, 0.7);
        this.drawCloud(500, 180, 1);
        this.drawCloud(700, 60, 0.9);
        this.drawCloud(400, 250, 0.6);
    }
    
    drawCloud(x, y, scale) {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 30 * scale, 0, Math.PI * 2);
        this.ctx.arc(x + 30 * scale, y - 15 * scale, 40 * scale, 0, Math.PI * 2);
        this.ctx.arc(x + 60 * scale, y, 28 * scale, 0, Math.PI * 2);
        this.ctx.arc(x + 30 * scale, y + 15 * scale, 25 * scale, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }
    
    drawGround() {
        this.ctx.fillStyle = '#95BF47';
        this.ctx.fillRect(0, this.canvas.height - GROUND_HEIGHT, this.canvas.width, GROUND_HEIGHT);
    }
    
    gameLoop(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        this.update(deltaTime);
        this.draw();
        
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    endGame() {
        console.log('Game Over! Score:', this.score);
        this.gameOver = true;
        document.getElementById('gameOver').classList.remove('hidden');
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('bestScore').textContent = Math.max(this.score, getBestScore());
        if (isHighScore(this.score)) {
            this.initialsEntry.classList.remove('hidden');
            this.initialsInput.value = '';
            this.initialsInput.focus();
        } else {
            this.initialsEntry.classList.add('hidden');
        }
    }
    
    submitHighScore() {
        const initials = (this.initialsInput.value || '').toUpperCase().slice(0, 3);
        if (!initials.match(/^[A-Z0-9]{1,3}$/)) {
            alert('Please enter 1-3 letters or numbers for your initials.');
            return;
        }
        addScoreToLeaderboard(initials, this.score);
        this.initialsEntry.classList.add('hidden');
        document.getElementById('bestScore').textContent = getBestScore();
    }
    
    restart() {
        console.log('Restarting game');
        document.getElementById('gameOver').classList.add('hidden');
        document.getElementById('startScreen').classList.remove('hidden');
        this.score = 0;
        document.getElementById('score').textContent = 'Score: 0';
    }
}

// SmileyFace class (replaces Airplane)
class SmileyFace {
    constructor() {
        this.width = 50;
        this.height = 50;
        this.x = 100;
        this.y = 300;
        this.velocity = 0;
        this.rotation = 0;
    }
    update() {
        this.velocity += GRAVITY;
        this.y += this.velocity;
        if (this.y < 0) {
            this.y = 0;
            this.velocity = 0;
        }
        this.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.velocity * 0.1));
    }
    flap() {
        this.velocity = FLAP_FORCE;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);
        // Draw yellow face
        ctx.beginPath();
        ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD600';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#222';
        ctx.stroke();
        // Draw eyes
        ctx.beginPath();
        ctx.arc(-12, -8, 4, 0, Math.PI * 2);
        ctx.arc(12, -8, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#222';
        ctx.fill();
        // Draw smile
        ctx.beginPath();
        ctx.arc(0, 6, 14, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#222';
        ctx.stroke();
        ctx.restore();
    }
}

// Pipe class
class Pipe {
    constructor(x, topHeight) {
        this.width = 80;
        this.x = x;
        this.topHeight = topHeight;
        this.scored = false;
    }
    
    update(speed) {
        this.x -= speed * (1/60); // Adjust for frame rate (assuming ~60fps)
    }
    
    draw(ctx) {
        // Draw top pipe (air traffic control tower)
        ctx.fillStyle = '#2C3E50';
        ctx.fillRect(this.x, 0, this.width, this.topHeight);
        
        // Draw bottom pipe
        const bottomY = this.topHeight + PIPE_GAP;
        ctx.fillRect(this.x, bottomY, this.width, ctx.canvas.height - bottomY);
        
        // Draw runway lights
        ctx.fillStyle = '#F1C40F';
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.topHeight + PIPE_GAP / 2, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    checkCollision(logo) {
        return (
            logo.x < this.x + this.width &&
            logo.x + logo.width > this.x &&
            (logo.y < this.topHeight || logo.y + logo.height > this.topHeight + PIPE_GAP)
        );
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
}); 