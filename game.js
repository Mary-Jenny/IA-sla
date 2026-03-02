/**
 * Forest Bird - Game Logic
 * Desenvolvido por Antigravity para Jennifer Lacerda.
 * 
 * Siga os comentários para personalizar as cores e os elementos do jogo!
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Configurações Globais (Aqui você altera o tamanho do jogo)
canvas.width = 400;
canvas.height = 600;

// Elementos da UI (Interface do Usuário)
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreBoard = document.getElementById('score-board');
const currentScoreEl = document.getElementById('current-score');
const currentCoinsEl = document.getElementById('current-coins');
const finalScoreEl = document.getElementById('final-score');
const finalCoinsEl = document.getElementById('final-coins');

// Variáveis do Estado do Jogo
let gameState = 'START'; // START, PLAYING, GAME_OVER
let animationId;
let frames = 0;
let score = 0;
let coins = 0;
let gameSpeed = 3; // Velocidade inicial do jogo
let difficultyFactor = 0.001; // Quão rápido a velocidade aumenta

// --- CONFIGURAÇÕES DO JOGADOR ---
const playerConfig = {
    x: 50,
    y: 150,
    radius: 15,
    gravity: 0.25,  // Reduzido para 0.25 (extrema flutuação)
    jump: -5,       // Pulo mais suave para combinar com a leveza
    color: '#FFD700',
};

class Player {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = playerConfig.x;
        this.y = playerConfig.y;
        this.radius = playerConfig.radius;
        this.velocity = 0;
    }

    draw() {
        // Desenha o pássaro (Pode trocar por imagem depois)
        ctx.save();
        ctx.translate(this.x, this.y);

        // Rotação baseada na velocidade (Dá sensação de peso)
        let rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.velocity * 0.1));
        ctx.rotate(rotation);

        // Corpo
        ctx.fillStyle = playerConfig.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Olho
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(8, -5, 3, 0, Math.PI * 2);
        ctx.fill();

        // Bico
        ctx.fillStyle = '#FFA500';
        ctx.beginPath();
        ctx.moveTo(this.radius - 2, 0);
        ctx.lineTo(this.radius + 8, 2);
        ctx.lineTo(this.radius - 2, 8);
        ctx.fill();

        ctx.restore();
    }

    update() {
        this.velocity += playerConfig.gravity;
        this.y += this.velocity;

        // Limite do Chão
        if (this.y + this.radius >= canvas.height) {
            this.y = canvas.height - this.radius;
            gameOver();
        }

        // Limite do Teto
        if (this.y - this.radius <= 0) {
            this.y = this.radius;
            this.velocity = 0; // Opcional: GameOver ou apenas bloqueia
        }
    }

    jump() {
        this.velocity = playerConfig.jump;
    }
}

// --- OBSTÁCULOS (ÁRVORES) ---
const obstacles = [];
const obstacleConfig = {
    width: 60,
    gap: 160, // Espaço entre a árvore de cima e de baixo
    minHeight: 50,
    spawnRate: 100, // Gera uma nova a cada X frames
};

class Obstacle {
    constructor() {
        this.x = canvas.width;
        this.passed = false;

        // Define a altura da árvore de cima e o buraco
        this.topHeight = Math.random() * (canvas.height - obstacleConfig.gap - 100) + 50;
        this.bottomY = this.topHeight + obstacleConfig.gap;
        this.width = obstacleConfig.width;
    }

    draw() {
        // Árvore de Cima (Galhos descendentes)
        this.drawTree(this.x, 0, this.width, this.topHeight, true);

        // Árvore de Baixo (Tronco com folhas)
        this.drawTree(this.x, this.bottomY, this.width, canvas.height - this.bottomY, false);
    }

    drawTree(x, y, w, h, isTop) {
        // Tronco
        ctx.fillStyle = '#8B4513';
        let trunkWidth = w * 0.4;
        ctx.fillRect(x + (w - trunkWidth) / 2, y, trunkWidth, h);

        // Folhas
        ctx.fillStyle = '#228B22';
        if (isTop) {
            // Galhos de cima para baixo (Pendurados)
            this.drawPine(x, y + h, w, -h, true);
        } else {
            // Árvore normal (Do chão para cima)
            this.drawPine(x, y, w, h, false);
        }
    }

    drawPine(x, y, w, h, isTop) {
        // Camadas de folhas
        for (let i = 0; i < 3; i++) {
            let offset = i * (h / 3);
            ctx.beginPath();
            if (isTop) {
                // Triângulos invertidos para galhos superiores
                ctx.moveTo(x - 10, y - offset);
                ctx.lineTo(x + w + 10, y - offset);
                ctx.lineTo(x + w / 2, y - offset + (h / 2));
            } else {
                // Triângulos normais para árvores inferiores
                ctx.moveTo(x - 10, y + h - offset);
                ctx.lineTo(x + w + 10, y + h - offset);
                ctx.lineTo(x + w / 2, y + h - offset - (h / 2));
            }
            ctx.fill();
        }
    }

    update() {
        this.x -= gameSpeed;
    }

    checkCollision(player) {
        // Margem de erro (buffer) para colisão ser mais amigável
        const buffer = 5;

        // Colisão com árvore de cima
        if (player.x + player.radius - buffer > this.x &&
            player.x - player.radius + buffer < this.x + this.width &&
            player.y - player.radius + buffer < this.topHeight) {
            return true;
        }

        // Colisão com árvore de baixo
        if (player.x + player.radius - buffer > this.x &&
            player.x - player.radius + buffer < this.x + this.width &&
            player.y + player.radius - buffer > this.bottomY) {
            return true;
        }

        return false;
    }
}

// --- ITENS (MOEDAS) ---
const coinItems = [];
class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.collected = false;
    }

    draw() {
        if (this.collected) return;

        ctx.fillStyle = '#FFD700'; // Dourado
        ctx.strokeStyle = '#DAA520';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Detalhe brilhante
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(this.x - 3, this.y - 3, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    update() {
        this.x -= gameSpeed;
    }

    checkCollection(player) {
        if (this.collected) return false;

        const dist = Math.sqrt(Math.pow(player.x - this.x, 2) + Math.pow(player.y - this.y, 2));
        if (dist < player.radius + this.radius) {
            this.collected = true;
            return true;
        }
        return false;
    }
}

// --- INSTÂNCIAS ---
const player = new Player();

// --- LOOP PRINCIPAL ---
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenha Fundo Decorativo (Pode colocar imagens aqui)
    drawBackground();

    if (gameState === 'PLAYING') {
        frames++;

        // Aumenta dificuldade
        gameSpeed += difficultyFactor;

        // Gerar Obstáculos
        if (frames % Math.floor(obstacleConfig.spawnRate * (3 / gameSpeed)) === 0) {
            const obs = new Obstacle();
            obstacles.push(obs);

            // Gerar Moeda entre os obstáculos (50% de chance)
            if (Math.random() > 0.5) {
                const coinY = obs.topHeight + (obstacleConfig.gap / 2);
                coinItems.push(new Coin(canvas.width + 100, coinY));
            }
        }

        // Atualizar e Desenhar Obstáculos
        for (let i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].update();
            obstacles[i].draw();

            // Ganhar Ponto ao passar
            if (!obstacles[i].passed && obstacles[i].x + obstacles[i].width < player.x) {
                obstacles[i].passed = true;
                score++;
                currentScoreEl.innerText = score;
            }

            // Colisão
            if (obstacles[i].checkCollision(player)) {
                gameOver();
            }

            // Remover fora da tela
            if (obstacles[i].x + obstacles[i].width < 0) {
                obstacles.splice(i, 1);
            }
        }

        // Atualizar e Desenhar Moedas
        for (let i = coinItems.length - 1; i >= 0; i--) {
            coinItems[i].update();
            coinItems[i].draw();

            if (coinItems[i].checkCollection(player)) {
                coins++;
                currentCoinsEl.innerText = coins;
                // Opcional: Add sound effect here
            }

            if (coinItems[i].x + coinItems[i].radius < 0 || coinItems[i].collected) {
                coinItems.splice(i, 1);
            }
        }

        player.update();
    }

    player.draw();

    if (gameState !== 'GAME_OVER') {
        animationId = requestAnimationFrame(gameLoop);
    }
}

function drawBackground() {
    // Céu com gradiente
    let skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGradient.addColorStop(0, '#1a2a6c'); // Azul profundo
    skyGradient.addColorStop(0.5, '#b21f1f'); // Vermelho pôr do sol
    skyGradient.addColorStop(1, '#fdbb2d'); // Dourado
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Montanhas Distantes (Paralaxe lento)
    drawMountains(0.2, '#4b6cb7', 150);
    // Montanhas Próximas (Paralaxe médio)
    drawMountains(0.5, '#182848', 100);

    // Nuvens
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    drawCloud(100 + (frames * 0.2) % (canvas.width + 100) - 50, 80);
    drawCloud(250 + (frames * 0.15) % (canvas.width + 100) - 50, 120);

    // Chão
    ctx.fillStyle = '#2d5a27'; // Verde escuro para combinar com o pôr do sol
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);
}

function drawMountains(speed, color, heightOffset) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);

    // Gerar picos baseados no frame para movimento sutil
    let move = (frames * speed) % 200;
    for (let i = -200; i <= canvas.width + 200; i += 100) {
        let x = i - move;
        let y = canvas.height - heightOffset - (Math.sin(i * 0.01) * 30);
        ctx.lineTo(x, y);
        ctx.lineTo(x + 50, y - 40);
        ctx.lineTo(x + 100, y);
    }

    ctx.lineTo(canvas.width, canvas.height);
    ctx.fill();
}

function drawCloud(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.arc(x + 15, y - 10, 20, 0, Math.PI * 2);
    ctx.arc(x + 30, y, 20, 0, Math.PI * 2);
    ctx.fill();
}

// --- CONTROLES E FLUXO ---
function startGame() {
    if (gameState === 'PLAYING') return;

    // Reset de Variáveis
    gameState = 'PLAYING';
    score = 0;
    coins = 0;
    gameSpeed = 3;
    frames = 0;
    obstacles.length = 0;
    coinItems.length = 0;
    player.reset();

    // UI Update
    currentScoreEl.innerText = '0';
    currentCoinsEl.innerText = '0';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreBoard.classList.remove('hidden');
}

function gameOver() {
    gameState = 'GAME_OVER';
    cancelAnimationFrame(animationId);

    // UI Update
    finalScoreEl.innerText = score;
    finalCoinsEl.innerText = coins;
    gameOverScreen.classList.remove('hidden');
}

// Event Listeners
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (gameState === 'START' || gameState === 'GAME_OVER') {
            startGame();
            gameLoop();
        } else if (gameState === 'PLAYING') {
            player.jump();
        }
    }
});

// Suporte para Mobile/Clique
canvas.addEventListener('mousedown', () => {
    if (gameState === 'START' || gameState === 'GAME_OVER') {
        startGame();
        gameLoop();
    } else if (gameState === 'PLAYING') {
        player.jump();
    }
});

// Inicia o Loop Visual (Fica parado na tela inicial)
gameLoop();
