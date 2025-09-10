// Funções para atualizar a interface (HUD)

export function updateHUD(player) {
    document.getElementById('player-health').textContent = player.health;
    document.getElementById('player-xp').textContent = player.xp;
    document.getElementById('dungeon-floor').textContent = player.floor;
}

export function updateInventory(inventory) {
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';
    if (inventory.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Vazio';
        list.appendChild(li);
    } else {
        inventory.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            list.appendChild(li);
        });
    }
}

export function addLogMessage(msg) {
    const log = document.getElementById('game-log');
    const li = document.createElement('li');
    li.textContent = msg;
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
}