// Classe do jogador

export class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.health = 100;
        this.xp = 0;
        this.floor = 1;
        this.inventory = [];
    }

    move(dx, dy) {
        this.x += dx;
        this.y += dy;
        // Limites do canvas
        this.x = Math.max(10, Math.min(630, this.x));
        this.y = Math.max(10, Math.min(470, this.y));
    }

    addItem(item) {
        this.inventory.push(item);
    }
}