class Entity {
    constructor(x, y, char = "?", trait = "entity", color = "white") {
        this.x = x;
        this.y = y;
        this.char = char;
        this.trait = trait;
        this.color = color;

        this.maxHp = 10;
        this.hp = 10;
        this.atk = 2;
        this.def = 0;
        this.speed = 5;
        this.turnSPD = 0;
        this.hit = 75;
        this.eva = 5;
        this.critChance = 5;
        this.critMult = 2;

        this.alive = true;
    }

    move(dx, dy, room) {
        const nx = this.x + dx;
        const ny = this.y + dy;

        if (!room.tiles[ny] || room.tiles[ny][nx] === window.TILE.WALL) return;

        for (const e of room.metadata?.entities || []) {
            if (e !== this && e.x === nx && e.y === ny && e.alive) {
                return;
            }
        }

        this.x = nx;
        this.y = ny;
    }

    gainTurn(){
        this.turnSPD += this.speed;
        if (this.turnSPD >= 100) {
            this.turnSPD = 100;
            return true;
        }
        return false;
    }

    resetTurn(){
        this.turnSPD = 0;
    }

    takeDamage(amount) {
        const dmg = Math.max(0, amount - this.def);
        this.hp -= dmg;
        if (this.hp <= 0) {
            this.alive = false;
        }
        return dmg;
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, "JOGADOR", "humanoid", "cyan");
        this.maxHp = 20;
        this.hp = 20;
        this.atk = 5;
        this.def = 0;
        this.hit = 75;
        this.eva = 5;
        this.critChance = 10;
        this.critMult = 2;

        this.xp = 0;
    }

    attack(target) {
        if (!target.alive) return;

        if (Math.random() * 100 > this.hit - target.eva) {
            window.UI.log(`😶 Você errou o ataque em ${target.char}!`);
            return;
        }

        const dmg = target.takeDamage(this.atk);
        window.UI.log(`⚔️ Você atingiu ${target.char}! ${dmg} de dano causado!`);
        if (!target.alive) {
            window.UI.log(`💀 ${target.char} foi derrotado!`);
            this.gainXP(target.xpReward || 1);
        }
    }

    gainXP(amount) {
        this.xp += amount;
        window.UI.updateXP(this.xp);
    }
}

function rollStat(stat) {
    if (Array.isArray(stat)) {
        const [min, max] = stat;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    return stat;
}

function resolveAttack(attacker, defender) {
    if (!defender.alive) return;

    const chance = attacker.hit / (attacker.hit + defender.eva);
    if (Math.random() > chance) {
        window.UI.log(`${attacker.char} errou o ataque em ${defender.char}!`);
        return;
    }

    let dmg = attacker.atk;
    if (Math.random() * 100 < attacker.critChance) {
        dmg = Math.floor(dmg * attacker.critMult);
        window.UI.log(`💥 Ataque crítico de ${attacker.char}!`);
    }

    const dealt = defender.takeDamage(dmg);
    window.UI.log(`${attacker.char} atingiu ${defender.char} causando ${dealt} de dano!`);

    if (!defender.alive) {
        window.UI.log(`💀 ${defender.char} foi derrotado!`);
        if (attacker instanceof Player) attacker.gainXP(defender.xpReward || 1);
        if (defender instanceof Monster) defender.droploot?.();
    }
}

class Monster extends Entity {
    constructor(x, y, config = {}) {
        super(x, y, config.char || "M", config.trait || "monster", config.color || "red");
        this.maxHp = rollStat(config.maxHp || 8);
        this.hp = this.maxHp;
        this.atk = rollStat(config.atk || 2);
        this.def = rollStat(config.def || 1);
        this.hit = rollStat(config.hit || 65);
        this.eva = rollStat(config.eva || 5);
        this.critChance = rollStat(config.critChance || 5);
        this.critMult = rollStat(config.critMult || 2);
        this.xpReward = config.xpReward || 5;
        this.loot = config.loot || null;
        this.isBoss = config.isBoss || false;
    }

    droploot() {
        if (!this.loot) return null;
        if (Math.random() * 100 < this.loot.chance) {
            const itemID = this.loot.items[Math.floor(Math.random() * this.loot.items.length)];
            return window.getItemById?.(itemID);
        }
        return null;
    }

    act(player, room) {
        if (!this.alive) return;
        const dx = player.x - this.x, dy = player.y - this.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        console.log(`Mob ${this.char} (${this.x},${this.y}) agindo, player em (${player.x},${player.y}), dist: ${dist}`);
        if (dist === 1) {
            resolveAttack(this, player);
        } else {
            this.move(Math.sign(dx), Math.sign(dy), room);
        }
    }
}

window.Entity = Entity;
window.Player = Player;
window.Monster = Monster;
window.rollStat = rollStat;
window.resolveAttack = resolveAttack;