(function(){
    function rollStat(stat) {
        if (Array.isArray(stat)) {
            const [min, max] = stat;
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        return stat;
    }

    function safeLog(...args) {
        if (window.UI && typeof window.UI.log === 'function') {
            window.UI.log(args.join(' '));
        } else {
            console.log(...args);
        }
    }

    function tryAutoLoadSprite(entity, id) {
    if (!id) return;
    const basePaths = [
    'assets/wander/',
    'assets/battle/'
];

    function tryLoadBattleSprite(entity, id) {
    if (!id) return;
    const path = 'assets/battle/' + id + '.png';
    const img = new Image();
    img.onload = function() {
        entity.sprite = img;
        safeLog(`Renderer: sprite (battle) carregado para ${id} -> ${path}`);
    };
    img.onerror = function() {
        console.warn(`Sprite battle não encontrado: ${path}`);
    };
    img.src = path;
}


    const exts = ['.png'];
    let idxPath = 0, idxExt = 0;

    function attempt() {
        if (idxPath >= basePaths.length || idxExt >= exts.length) return;
        const path = basePaths[idxPath] + id + exts[idxExt];
        const img = new Image();
        img.onload = function() {
            entity.sprite = img;
            safeLog(`Renderer: sprite carregado para ${id} -> ${path}`);
        };
        img.onerror = function() {
            if (++idxExt < exts.length) attempt();
            else if (++idxPath < basePaths.length) { idxExt = 0; attempt(); }
        };
        img.src = path;
    }
    attempt();
}

    function applyHitEffects(target, amount) {
        try {
            if (window.Renderer) {
                const intensity = Math.min(10, Math.max(2, Math.floor((amount || 1) / 1.2)));
                if (target && typeof target === 'object') {
                    if (typeof Renderer.flashEntity === 'function') Renderer.flashEntity(target, 140);
                    if (typeof Renderer.shakeEntity === 'function') Renderer.shakeEntity(target, intensity, 220);
                }
                if (target && target instanceof Player) {
                    if (typeof Renderer.shakePlayer === 'function') Renderer.shakePlayer(Math.max(4, intensity), 260);
                }
            }
        } catch (e) {
            console.warn('Erro aplicando efeitos visuais:', e);
        }
    }

    class Entity {
        constructor(x, y, char = "?", trait = "entity", color = "white", opts = {}) {
            this.x = x || 0;
            this.y = y || 0;
            this.char = char;
            this.trait = trait;
            this.color = color;

            this.maxHp = opts.maxHp ?? 10;
            this.hp = opts.hp ?? this.maxHp;
            this.atk = opts.atk ?? 2;
            this.def = opts.def ?? 0;
            this.speed = opts.speed ?? 5;
            this.turnSPD = 0;
            this.hit = opts.hit ?? 75;
            this.eva = opts.eva ?? 5;
            this.critChance = opts.critChance ?? 5;
            this.critMult = opts.critMult ?? 2;

            this.alive = true;

            this.id = opts.id || null;  
            this.xpReward = opts.xpReward || 0;
            this.loot = opts.loot || null;
            this.sprite = opts.sprite instanceof Image ? opts.sprite : null;
        }

        move(dx, dy, room) {
            const nx = this.x + dx;
            const ny = this.y + dy;

            if (!room || !room.tiles || !room.tiles[ny] || room.tiles[ny][nx] === window.TILE.WALL) return;

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
            const dmg = Math.max(0, amount - (this.def || 0));
            this.hp -= dmg;
            applyHitEffects(this, dmg);

            if (this.hp <= 0) {
                this.alive = false;
                this.hp = 0;
            }
            return dmg;
        }
    }

    class Player extends Entity {
        constructor(x, y, config = {}) {
            const char = config.char ?? "player";
            const trait = config.trait ?? "humanoid";
            const color = config.color ?? "cyan";
            super(x, y, char, trait, color);

            this.maxHp = rollStat(config.maxHp ?? config.hp ?? 20);
            this.hp = config.hp ?? this.maxHp;
            this.atk = rollStat(config.atk ?? 5);
            this.def = rollStat(config.def ?? 0);
            this.hit = rollStat(config.hit ?? 75);
            this.eva = rollStat(config.eva ?? 5);
            this.critChance = rollStat(config.critChance ?? 5);
            this.critMult = rollStat(config.critMult ?? 5);

            this.xp = config.xp ?? 0;
            this.level = config.level ?? 1; // Adicionando nível inicial
            this.id = config.id ?? config.name ?? this.id;

            // sprite from config.path or auto
            if (config.sprite) {
                if (typeof config.sprite === 'string') {
                    const img = new Image();
                    img.src = config.sprite;
                    this.sprite = img;
                } else if (config.sprite instanceof Image) {
                    this.sprite = config.sprite;
                }
            } else if (this.id) {
                tryAutoLoadSprite(this, this.id);
            } else {
                tryAutoLoadSprite(this, 'player');
            }
        }

        attack(target) {
            if (!target || !target.alive) return;
            AudioSys.playSfx('attack');
            resolveAttack(this, target);
        }

        gainXP(amount) {
            this.xp += amount;
            if (this.xp >= this.getXpToNextLevel()) { // Verificação de level up
                this.levelUp();
            }
            if (window.UI && typeof window.UI.updateXP === 'function') window.UI.updateXP(this.xp);
        }

        getXpToNextLevel() {
            return 25 * this.level; // Exemplo simples: 100 XP por nível
        }

        levelUp() {
            this.level += 1;
            this.maxHp += rollStat([5, 15]);
            this.hp = this.maxHp;
            this.atk += rollStat([1, 3]);
            this.def += rollStat([1, 2]);
            this.speed += rollStat([1, 2]);
            safeLog(`🎉 Você subiu para o nível ${this.level}!`);
            if (window.UI) window.UI.updateStats(this);
        }
    }

    class Monster extends Entity {
        constructor(x, y, config = {}) {
            const char = config.char ?? "M";
            const trait = config.trait ?? "monster";
            const color = config.color ?? "red";
            super(x, y, char, trait, color, { id: config.id ?? null });

            this.maxHp = rollStat(config.maxHp ?? 8);
            this.hp = config.hp ?? this.maxHp;
            this.atk = rollStat(config.atk ?? 2);
            this.def = rollStat(config.def ?? 1);
            this.hit = rollStat(config.hit ?? 65);
            this.eva = rollStat(config.eva ?? 5);
            this.critChance = rollStat(config.critChance ?? 5);
            this.critMult = rollStat(config.critMult ?? 2);
            this.xpReward = config.xpReward ?? 5;
            this.loot = config.loot ?? null;
            this.isBoss = config.isBoss ?? false;

            this.id = this.id || config.id || null;

            if (config.sprite) {
                if (typeof config.sprite === 'string') {
                    const img = new Image();
                    img.src = config.sprite;
                    this.sprite = img;
                } else if (config.sprite instanceof Image) {
                    this.sprite = config.sprite;
                }
            } else if (this.id) {
                tryAutoLoadSprite(this, this.id);
            }
        }

        droploot() {
            if (!this.loot) return null;
            if (Math.random() * 100 < (this.loot.chance || 0)) {
                const itemID = this.loot.items[Math.floor(Math.random() * this.loot.items.length)];
                return window.getItemById?.(itemID) ?? null;
            }
            return null;
        }

        act(player, room) {
            if (!this.alive) return;
            const dx = player.x - this.x, dy = player.y - this.y;
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist === 1 || window.Combat?.isActive?.()) {
                safeLog(`Mob ${this.char} (${this.x},${this.y}) agindo contra player em (${player.x},${player.y}), dist: ${dist}`);
            }
            if (dist === 1) {
                resolveAttack(this, player);
            } else {
                this.move(Math.sign(dx), Math.sign(dy), room);
            }
        }
    }

    function resolveAttack(attacker, defender) {
        if (!defender || !defender.alive) return;

        const chance = (attacker.hit || 0) / ((attacker.hit || 0) + (defender.eva || 0));
        if (Math.random() > chance) {
            safeLog(`${attacker.char} errou o ataque em ${defender.char}!`);
            return;
        }

        let dmg = attacker.atk || 0;
        if (Math.random() * 100 < (attacker.critChance || 0)) {
            dmg = Math.floor(dmg * (attacker.critMult || 1));
            safeLog(`💥 Ataque crítico de ${attacker.char}!`);
        }

        const dealt = defender.takeDamage(dmg);
        safeLog(`${attacker.char} atingiu ${defender.char} causando ${dealt} de dano!`);

        if (!defender.alive) {
            safeLog(`💀 ${defender.char} foi derrotado!`);
            // XP & loot
            if (attacker instanceof Player) attacker.gainXP(defender.xpReward || 1);
            if (typeof defender.droploot === 'function') {
                const dropped = defender.droploot();
                if (dropped && window.UI) window.UI.log(`🎁 Dropped: ${dropped.name || dropped.id || 'item'}`);
            }
        }

        if (window.UI) {
            if (window.Game && window.Game.player) window.UI.updateStats(window.Game.player);
        }
    }

    const MobDefs = {};
    function registerMobDefinitions(defsArray) {
        if (!Array.isArray(defsArray)) return;
        for (const d of defsArray) {
            if (!d.id) continue;
            MobDefs[d.id] = d;
        }
    }

    function spawnMonster(idOrConfig, x, y, override = {}) {
        let cfg = null;
        if (typeof idOrConfig === 'string') {
            cfg = MobDefs[idOrConfig];
            if (!cfg) {
                console.warn('spawnMonster: definição não encontrada para id', idOrConfig);
                cfg = { id: idOrConfig, char: idOrConfig[0] || 'M' };
            }
        } else if (typeof idOrConfig === 'object') {
            cfg = idOrConfig;
        } else {
            console.error('spawnMonster: tipo inválido', idOrConfig);
            return null;
        }
        const merged = Object.assign({}, cfg, override);
        const mob = new Monster(x, y, merged);
        return mob;
    }

    function createPlayerFromConfig(config = {}, x = 2, y = 2) {
        if (!State.player.id) State.player.id = "player";
        const player = new Player(x, y, config);
        if (window.UI) {
            window.UI.updateStats(player);
            window.UI.updateXP(player.xp || 0);
            window.UI.updateHP(player.hp || player.maxHp, player.maxHp);
        }
        return player;
    }

    // Expose globals
    window.Entity = Entity;
    window.Player = Player;
    window.Monster = Monster;
    window.rollStat = rollStat;
    window.resolveAttack = resolveAttack;
    window.registerMobDefinitions = registerMobDefinitions;
    window.spawnMonster = spawnMonster;
    window.createPlayerFromConfig = createPlayerFromConfig;
    window._MOBDEFS = MobDefs; // for debug
})();