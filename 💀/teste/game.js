// Lógica principal do jogo

import { Player } from './player.js';
import { updateHUD, addLogMessage, updateInventory } from './hud.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let player;
let gameRunning = true;

function initGame() {
    player = new Player(320, 240);
    updateHUD(player);
    updateInventory(player.inventory);
    addLogMessage('Bem-vindo ao Dungeon Crawler!');
    draw();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Exemplo: desenha o jogador como um quadrado
    ctx.fillStyle = '#a3e635';
    ctx.fillRect(player.x - 10, player.y - 10, 20, 20);

    // Aqui você pode desenhar inimigos, itens, etc.
}

function gameLoop() {
    if (!gameRunning) return;
    draw();
    requestAnimationFrame(gameLoop);
}

function handleKeyDown(e) {
    if (!gameRunning) return;
    switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
            player.move(0, -20);
            break;
        case 'arrowdown':
        case 's':
            player.move(0, 20);
            break;
        case 'arrowleft':
        case 'a':
            player.move(-20, 0);
            break;
        case 'arrowright':
        case 'd':
            player.move(20, 0);
            break;
        case ' ':
            addLogMessage('Você atacou!');
            break;
        case 'i':
            document.getElementById('inventory').classList.toggle('open');
            break;
    }
    updateHUD(player);
    draw();
}

window.addEventListener('keydown', handleKeyDown);

window.onload = () => {
    initGame();
    gameLoop();
};