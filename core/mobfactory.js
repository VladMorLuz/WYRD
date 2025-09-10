(function() {
    let MOB_DATA = window.MOBS;
    if (!MOB_DATA) {
        fetch('data/mobs.json')
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                MOB_DATA = data;
                console.log('Mobs carregados:', MOB_DATA.length, 'tipos:', MOB_DATA.map(m => m.id));
            })
            .catch(err => {
                console.warn('Falha ao carregar mobs.json:', err);
                MOB_DATA = [
                    { id: "rat", char: "r", trait: "animal", color: "gray", maxHp: [10,14], atk: [2,4], def: [0,2], hit: [70,75], eva: [8,10], critChance: 3, critMult: 1.2, xpReward: 2, loot: { chance: 50, items: [] } },
                    { id: "goblin", char: "g", trait: "humanoid", color: "green", maxHp: [10,14], atk: [2,4], def: [0,2], hit: [70,75], eva: [8,10], critChance: 5, critMult: 1.8, xpReward: 5, loot: { chance: 50, items: [] } },
                    { id: "skeleton", char: "s", trait: "undead", color: "white", maxHp: [10,14], atk: [2,4], def: [0,2], hit: [70,75], eva: [8,10], critChance: 10, critMult: 2, xpReward: 10, loot: { chance: 50, items: [] } }
                ];
                console.log('Usando fallback MOB_DATA:', MOB_DATA.map(m => m.id));
            });
    }

    window.pickMobForFloor = function(floorNumber) {
        if (!MOB_DATA || !MOB_DATA.length) {
            console.warn('Nenhum mob disponível em MOB_DATA');
            return null;
        }
        const rng = Math.random();
        let candidates = MOB_DATA.filter(mob => {
            // Reduzido levelReq para testes
            const levelReq = { rat: 1, goblin: 1, skeleton: 3 }[mob.id] || 1;
            return floorNumber >= levelReq;
        });
        if (!candidates.length) {
            console.log('Sem candidatos, usando todos:', MOB_DATA.map(m => m.id));
            candidates = MOB_DATA;
        }
        console.log('Candidatos para andar', floorNumber, ':', candidates.map(m => m.id)); // Log para depuração
        const picked = candidates[Math.floor(rng * candidates.length)];
        if (floorNumber % 5 === 0 && rng < 0.05) {
            console.log('BOSS SPAWN:', picked.id);
            return `boss_${picked.id}`;
        }
        console.log('Mob escolhido:', picked.id, 'para andar', floorNumber);
        return picked.id;
    };

    window.MobFactory = {
        create: function(mobId, x, y) {
            if (!MOB_DATA || !MOB_DATA.length) {
                console.warn('MOB_DATA vazio, criando Monster genérico');
                return new window.Monster(x, y, {});
            }
            const isBoss = mobId.startsWith('boss_');
            const baseId = isBoss ? mobId.replace('boss_', '') : mobId;
            const config = MOB_DATA.find(m => m.id === baseId);
            if (!config) {
                console.warn('Mob não encontrado:', mobId, 'usando genérico');
                return new window.Monster(x, y, {});
            }
            const monster = new window.Monster(x, y, config);
            monster.maxHp = window.rollStat(config.maxHp);
            monster.hp = monster.maxHp;
            monster.atk = window.rollStat(config.atk);
            monster.def = window.rollStat(config.def);
            monster.hit = window.rollStat(config.hit);
            monster.eva = window.rollStat(config.eva);
            monster.critChance = window.rollStat(config.critChance);
            monster.critMult = window.rollStat(config.critMult);
            monster.xpReward = config.xpReward;
            monster.loot = config.loot;
            if (isBoss) {
                monster.maxHp *= 2;
                monster.hp = monster.maxHp;
                monster.atk *= 1.5;
                monster.xpReward *= 2;
                monster.isBoss = true;
            }
            console.log('Mob criado:', monster.char, 'em', x, y, isBoss ? '(BOSS)' : '');
            return monster;
        }
    };

    if (!window.rollStat) {
        window.rollStat = function(stat) {
            if (Array.isArray(stat)) {
                const [min, max] = stat;
                return Math.floor(Math.random() * (max - min + 1)) + min;
            }
            return stat;
        };
    }

    async function loadMobs() {
        try {
            const response = await fetch('data/mobs.json');
            if (!response.ok) throw new Error('Não foi possível carregar mobs.json');
            const mobs = await response.json();
            return mobs;
        } catch(e) {
            console.error('Falha ao carregar mobs.json:', e);
            return [];
        }
    }

    console.log('MobFactory inicializado! 🐀👻');
})();