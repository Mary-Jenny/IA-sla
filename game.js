/**
 * Forest Bird - Game Logic v2.1 (Correção de Seleção de Skin)
 */
console.log("Game Logic v2.1 Carregada!");

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
let gameSpeed = 3.5;
let difficultyFactor = 0.002; // Aumentado para ser mais perceptível
let maxSpeed = 10;

// --- SISTEMA DE LOGA E PERSISTÊNCIA ---
let totalCoins = localStorage.getItem('forestBird_totalCoins');
if (totalCoins === null) {
    totalCoins = 5; // Presente de início para comprar a primeira skin mais rápido!
    localStorage.setItem('forestBird_totalCoins', totalCoins);
} else {
    totalCoins = parseInt(totalCoins);
}

let highScore = parseInt(localStorage.getItem('forestBird_highScore')) || 0;
let deathCount = parseInt(localStorage.getItem('forestBird_deathCount')) || 0;
let ownedSkins = JSON.parse(localStorage.getItem('forestBird_ownedSkins')) || ['yellow'];
let selectedSkin = localStorage.getItem('forestBird_selectedSkin') || 'yellow';

const skins = {
    yellow: { color1: '#FFD700', color2: '#FFA500', beak: '#FFA500' },
    red: { color1: '#ff4d4d', color2: '#8b0000', beak: '#ffd700' },
    blue: { color1: '#4da6ff', color2: '#004080', beak: '#ffffff' },
    purple: { color1: '#a64dff', color2: '#4b0082', beak: '#ff4da6' },
    rainbow: { color1: '#ff0000', color2: '#0000ff', beak: '#ffff00', isRainbow: true },
    emerald: { color1: '#50c878', color2: '#006400', beak: '#ffd700' },
    sunset: { color1: '#ff7e5f', color2: '#feb47b', beak: '#ffffff' }
};

const themes = [
    { skyTop: '#1a2a6c', skyMid: '#b21f1f', skyBottom: '#fdbb2d', mountain1: '#4b6cb7', mountain2: '#182848', ground: '#2d5a27' }, // Sunset
    { skyTop: '#000000', skyMid: '#0f0c29', skyBottom: '#302b63', mountain1: '#24243e', mountain2: '#000000', ground: '#0a1a0a' }, // Night
    { skyTop: '#4ca1af', skyMid: '#c4e0e5', skyBottom: '#ffffff', mountain1: '#757f9a', mountain2: '#2c3e50', ground: '#1e3c1e' }, // Day
    { skyTop: '#e96443', skyMid: '#904e95', skyBottom: '#ffcc33', mountain1: '#654ea3', mountain2: '#eaafc8', ground: '#3e1e1e' }  // Alien
];

function saveGameData() {
    localStorage.setItem('forestBird_totalCoins', totalCoins);
    localStorage.setItem('forestBird_ownedSkins', JSON.stringify(ownedSkins));
    localStorage.setItem('forestBird_selectedSkin', selectedSkin);
    localStorage.setItem('forestBird_highScore', highScore);
    localStorage.setItem('forestBird_deathCount', deathCount);
}

// --- CONFIGURAÇÕES DO JOGADOR ---
const playerConfig = {
    x: 50,
    y: 150,
    radius: 15,
    gravity: 0.25,
    jump: -6
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
        ctx.save();
        ctx.translate(this.x, this.y);

        let rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.velocity * 0.1));
        ctx.rotate(rotation);

        const currentSkinData = skins[selectedSkin];

        // Corpo Principal (Gradiente se for multi-cor)
        let gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        if (currentSkinData.isRainbow) {
            let hue = (frames * 5) % 360;
            ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
        } else {
            gradient.addColorStop(0, currentSkinData.color1);
            gradient.addColorStop(1, currentSkinData.color2 || currentSkinData.color1);
            ctx.fillStyle = gradient;
        }

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Asa (mais de uma cor na mesma skin)
        ctx.fillStyle = currentSkinData.color2 || '#fff';
        ctx.beginPath();
        ctx.ellipse(-5, 0, 8, 5, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        // Olho
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(8, -5, 3, 0, Math.PI * 2);
        ctx.fill();

        // Bico
        ctx.fillStyle = currentSkinData.beak;
        ctx.beginPath();
        ctx.moveTo(this.radius - 2, 0);
        ctx.lineTo(this.radius + 10, 2);
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
    gap: 165, // Aumentado levemente o buraco vertical
    minHeight: 50,
    spawnRate: 140, // Aumentado para dar mais espaço horizontal
};

let lastTopHeight = 200; // Para evitar saltos verticais impossíveis

class Obstacle {
    constructor() {
        this.x = canvas.width;
        this.passed = false;

        // Define a altura da árvore evitando variações exageradas
        // O novo topo pode variar no máximo 150px em relação ao anterior
        const minH = Math.max(50, lastTopHeight - 150);
        const maxH = Math.min(canvas.height - obstacleConfig.gap - 50, lastTopHeight + 150);

        this.topHeight = Math.random() * (maxH - minH) + minH;
        lastTopHeight = this.topHeight; // Salva para a próxima árvore

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
        ctx.fillStyle = '#8B4513'; // Marrom
        let trunkWidth = w * 0.3;

        if (isTop) {
            // ÁRVORE DE CIMA (Pendurada no teto)
            // Tronco saindo do teto (y=0) até a altura h
            ctx.fillRect(x + (w - trunkWidth) / 2, 0, trunkWidth, h * 0.5);
            // Folhas (Triângulos descendo)
            ctx.fillStyle = '#1e5a1e';
            this.drawPine(x, h * 0.3, w, h * 0.7, true);
        } else {
            // ÁRVORE DE BAIXO (Nascendo do chão)
            // Tronco saindo do chão até a altura h
            ctx.fillRect(x + (w - trunkWidth) / 2, y + h * 0.5, trunkWidth, h * 0.5);
            // Folhas (Triângulos subindo)
            ctx.fillStyle = '#228B22';
            this.drawPine(x, y, w, h * 0.7, false);
        }
    }

    drawPine(x, y, w, h, isTop) {
        ctx.beginPath();
        if (isTop) {
            // Triângulo apontando para BAIXO
            ctx.moveTo(x - 15, y);
            ctx.lineTo(x + w + 15, y);
            ctx.lineTo(x + w / 2, y + h);
        } else {
            // Triângulo apontando para CIMA
            ctx.moveTo(x - 15, y + h);
            ctx.lineTo(x + w + 15, y + h);
            ctx.lineTo(x + w / 2, y);
        }
        ctx.fill();
    }

    update() {
        this.x -= gameSpeed;
    }

    checkCollision(player) {
        // Margem de "perdão" para o jogador
        const pR = player.radius * 0.7; // Usa um raio menor para colisão ser mais justa
        const pX = player.x;
        const pY = player.y;

        // Trunk collision (Tronco) - Muito mais fino que a árvore
        const trunkWidth = this.width * 0.25;
        const trunkX = this.x + (this.width - trunkWidth) / 2;

        // Arvore de Cima (Top Tree)
        const topH = this.topHeight;
        const topTrunkH = topH * 0.5;
        const topPineStart = topH * 0.3;

        // 1. Colisão com Tronco de Cima
        if (pX + pR > trunkX && pX - pR < trunkX + trunkWidth && pY - pR < topTrunkH) {
            return true;
        }

        // 2. Colisão com Pine de Cima (Triângulo)
        // Base em topPineStart (y), largura base = width + 30
        // Ponta em topH (y), largura = 0
        if (pY + pR > topPineStart && pY - pR < topH) {
            const relativeY = (pY - topPineStart) / (topH - topPineStart);
            const halfWidthAtY = (1 - relativeY) * (this.width / 2 + 15);
            const centerX = this.x + this.width / 2;
            if (pX + pR > centerX - halfWidthAtY && pX - pR < centerX + halfWidthAtY) {
                return true;
            }
        }

        // Arvore de Baixo (Bottom Tree)
        const botY = this.bottomY;
        const botH = canvas.height - botY;
        const botTrunkStart = botY + botH * 0.5;
        const botPineEnd = botY + botH * 0.7;

        // 3. Colisão com Tronco de Baixo
        if (pX + pR > trunkX && pX - pR < trunkX + trunkWidth && pY + pR > botTrunkStart) {
            return true;
        }

        // 4. Colisão com Pine de Baixo (Triângulo)
        // Ponta em botY (y), largura = 0
        // Base em botPineEnd (y), largura base = width + 30
        if (pY + pR > botY && pY - pR < botPineEnd) {
            const relativeY = (pY - botY) / (botPineEnd - botY);
            const halfWidthAtY = relativeY * (this.width / 2 + 15);
            const centerX = this.x + this.width / 2;
            if (pX + pR > centerX - halfWidthAtY && pX - pR < centerX + halfWidthAtY) {
                return true;
            }
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

        // Aumenta dificuldade de forma gradual mas perceptível
        if (gameSpeed < maxSpeed) {
            gameSpeed += difficultyFactor;
        }

        // Gerar Obstáculos
        if (frames % Math.floor(obstacleConfig.spawnRate * (3 / gameSpeed)) === 0) {
            const obs = new Obstacle();
            obstacles.push(obs);

            // Gerar Moeda entre os obstáculos (80% de chance para coletar mais rápido)
            if (Math.random() > 0.2) {
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
    const themeIdx = deathCount % themes.length;
    const theme = themes[themeIdx];

    // Céu com gradiente dinâmico
    let skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGradient.addColorStop(0, theme.skyTop);
    skyGradient.addColorStop(0.5, theme.skyMid);
    skyGradient.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Montanhas Distantes (Paralaxe lento)
    drawMountains(0.2, theme.mountain1, 150);
    // Montanhas Próximas (Paralaxe médio)
    drawMountains(0.5, theme.mountain2, 100);

    // Nuvens
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    drawCloud(100 + (frames * 0.2) % (canvas.width + 100) - 50, 80);
    drawCloud(250 + (frames * 0.15) % (canvas.width + 100) - 50, 120);

    // Chão
    ctx.fillStyle = theme.ground;
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
    gameSpeed = 3.5;
    frames = 0;
    obstacles.length = 0;
    coinItems.length = 0;
    lastTopHeight = 200; // Reseta a altura base
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

    // Atualiza recorde
    if (score > highScore) {
        highScore = score;
    }

    // Incrementa contador de mortes para mudar cenario
    deathCount++;

    // Atualiza moedas totais
    totalCoins += coins;
    saveGameData();

    // UI Update
    finalScoreEl.innerText = score;
    finalCoinsEl.innerText = coins;
    document.getElementById('total-coins').innerText = totalCoins;
    document.getElementById('high-score').innerText = highScore; // Novo campo
    updateShopUI();
    gameOverScreen.classList.remove('hidden');
}

// --- LÓGICA DA LOJA ---
function updateShopUI() {
    const shopItems = document.querySelectorAll('.shop-item');
    shopItems.forEach(item => {
        const skinName = item.dataset.skin;
        const price = parseInt(item.dataset.price);

        // Limpar classes
        item.classList.remove('owned', 'selected');

        if (selectedSkin === skinName) {
            item.classList.add('selected');
        }

        if (ownedSkins.includes(skinName)) {
            item.classList.add('owned');
            const span = item.querySelector('span');
            span.innerText = (selectedSkin === skinName) ? "EM USO" : "TER";
        } else {
            const span = item.querySelector('span');
            span.innerText = `🪙 ${price}`;
        }
    });
}

// Delegar cliques da loja
document.addEventListener('click', (e) => {
    const shopItem = e.target.closest('.shop-item');
    if (!shopItem) return;

    // Impedir que o clique reinicie o jogo ao clicar na loja
    e.stopPropagation();

    const skinName = shopItem.dataset.skin;
    const price = parseInt(shopItem.dataset.price);

    if (ownedSkins.includes(skinName)) {
        selectedSkin = skinName;
        saveGameData();
        updateShopUI();

        // FORÇAR REDESENHO quando o jogo estiver parado no Game Over
        if (gameState === 'GAME_OVER' || gameState === 'START') {
            drawFrame();
        }
    } else {
        if (totalCoins >= price) {
            totalCoins -= price;
            ownedSkins.push(skinName);
            selectedSkin = skinName;
            saveGameData();
            updateShopUI();
            document.getElementById('total-coins').innerText = totalCoins;

            // Forçar redesenho após compra
            if (gameState === 'GAME_OVER' || gameState === 'START') {
                drawFrame();
            }
        } else {
            alert("Moedas insuficientes!");
        }
    }
});

// Função auxiliar para desenhar apenas um frame parado (util para a loja)
function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    obstacles.forEach(obs => obs.draw());
    coinItems.forEach(coin => coin.draw());
    player.draw();
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
