(function() {
    const Game = window.Game || {};
    Game.player = null;
    Game.entities = [];
    Game.floor = null;
    Game.currentRoomId = null;
    Game.running = false;

    

    const Input = {
        up: false,
        down: false,
        left: false,
        right: false,
        interact: false
    };

    let lastPlayerAction = 0;
    const PLAYER_MOVE_COOLDOWN = 100;
    const MOB_MOVE_COOLDOWN = 200;

    function getCurrentRoom() {
        return Game.floor?.getRoomById(Game.currentRoomId);
    }

    function tryMovePlayer(dx, dy, now) {
        const room = getCurrentRoom();
        if (!room || !Game.player) return false;
        const nx = Game.player.x + dx;
        const ny = Game.player.y + dy;

        if (nx < 0 || ny < 0 || nx >= room.w || ny >= room.h || room.tiles[ny]?.[nx] === window.TILE.WALL) return false;

        const hitMob = Game.entities.find(e => e.alive && e.x === nx && e.y === ny);
        if (hitMob && !window.Combat?.isActive?.()) {
            console.log(`Colisão com ${hitMob.char}! Iniciando combate... ⚔️`);
            window.Combat?.start(Game.player, hitMob, room);
            return false;
        }

        Game.player.x = nx;
        Game.player.y = ny;
        return true;
    }

    function findAdjacentDoor(room, x, y) {
        if (!room?.doors) return null;
        const dirs = [{dx:0,dy:-1}, {dx:0,dy:1}, {dx:-1,dy:0}, {dx:1,dy:0}];
        for (const {dx, dy} of dirs) {
            const door = room.doors.find(d => d.x === x + dx && d.y === y + dy);
            if (door) return door;
        }
        return null;
    }

    function handleDoorTransition(door) {
        if (!Game.floor || !door) return;
        const room = getCurrentRoom();
        if (!room) return;

        const connection = Game.floor.connections?.find(c => 
            (c.roomA === room.id && c.doorAId === door.id) ||
            (c.roomB === room.id && c.doorBId === door.id)
        ) || null;

        if (!connection) {
            window.UI?.log?.('Porta trancada ou bugada... 😵');
            console.warn('Connection não encontrada para door:', door.id);
            return;
        }

        const isRoomA = connection.roomA === room.id;
        const nextRoomId = isRoomA ? connection.roomB : connection.roomA;
        const nextDoorId = isRoomA ? connection.doorBId : connection.doorAId;
        const nextRoom = Game.floor.getRoomById(nextRoomId);
        const nextDoor = nextRoom?.doors?.find(d => d.id === nextDoorId);

        if (!nextRoom || !nextDoor) {
            window.UI?.log?.('Sala além da porta não existe! ?');
            console.warn('Next room/door null:', nextRoomId, nextDoorId);
            return;
        }

        Game.currentRoomId = nextRoomId;
        Game.entities = nextRoom.metadata?.entities || [];
        const spawn = window.MapGen?.getSpawnForDoor(nextRoom, nextDoor) || {x: Math.floor(nextRoom.w/2), y: Math.floor(nextRoom.h/2)};
        Game.player.x = spawn.x;
        Game.player.y = spawn.y;

        window.UI?.log?.(`Entrando em ${nextRoom.tag} (${nextRoomId})... 🚪`);
        console.log('Transição bem-sucedida para:', nextRoomId);
    }

    function updateUI() {
        window.UI?.updateHP?.(Game.player?.hp, Game.player?.maxHp);
        window.UI?.updateXP?.(Game.player?.xp);
        window.UI?.updateFloor?.(Game.floor?.floorNumber);
        window.UI?.updateStats?.(Game.player); // Atualizar stats
    }

    function gameTick(now) {
        if (!Game.running) return;
        const room = getCurrentRoom();
        if (!room || !Game.player) return;

        if (!window.Combat?.isActive?.()) {
            if (now - lastPlayerAction > PLAYER_MOVE_COOLDOWN) {
                const moves = [
                    [0,-1, Input.up && !Input.down && !Input.left && !Input.right],
                    [0,1, Input.down && !Input.up && !Input.left && !Input.right],
                    [-1,0, Input.left && !Input.right && !Input.up && !Input.down],
                    [1,0, Input.right && !Input.left && !Input.up && !Input.down]
                ];
                for (const [dx, dy, cond] of moves) {
                    if (cond) {
                        if (tryMovePlayer(dx, dy, now)) {
                            lastPlayerAction = now;
                            break;
                        }
                    }
                }

                if (Input.interact) {
                    const door = findAdjacentDoor(room, Game.player.x, Game.player.y);
                    if (door) {
                        handleDoorTransition(door);
                    }
                    Input.interact = false;
                }
            }

            for (const entity of Game.entities) {
                if (!entity.alive || !entity.act) continue;
                entity.lastAction = entity.lastAction || 0;
                if (now - entity.lastAction > MOB_MOVE_COOLDOWN) {
                    entity.act(Game.player, room);
                    entity.lastAction = now;
                }
            }
        }

        if (!window.Combat?.isActive?.()) {
            window.Renderer?.drawRoom?.(room, Game.player, Game.entities.filter(e => e.alive));
        }
        updateUI();

        requestAnimationFrame(gameTick);
    }

    window.initGame = function(opts = {}) {
        if (!window.MapGen?.generateFloor) {
            console.error('MapGen não carregado!');
            return;
        }
        Game.floor = window.MapGen.generateFloor(opts.floorNumber || 1, opts);

const Engine = {
    running: false,
    floor: 1, 
    init(player) {
        this.player = player;
        this.running = true;
        this.loop();
    },

    loop() {
        if (!this.running) return;

        this.update();

        Renderer.render(this.player);

        requestAnimationFrame(this.loop.bind(this));
    },

    update() {
        if (this.player.hp <= 0) {
            this.gameOver();
            return;
        }

        if (this.player.room?.type === "stairs") {
            this.nextFloor();
            return;
        }

        if (this.player.room?.metadata?.entities) {
            this.player.room.metadata.entities.forEach(e => {
                if (e !== this.player) {
                    e.act(this.player, this.player.room);
                }
            });
        }
    },

    gameOver() {
        this.running = false;
        UI.showGameOver(); // chama UI pra exibir tela
    },

    nextFloor() {
        this.floor++;
        safeLog(`Descendo para o andar ${this.floor}...`);

        // Gera novo andar
        const newMap = MapGen.generateFloor(20, 20); // tamanho fixo (pode ser escalado por floor)
        Renderer.setMap(newMap);

        // Teleporta player para a nova sala inicial
        this.player.room = newMap.start;
        this.player.x = this.player.room.centerX;
        this.player.y = this.player.room.centerY;

        // Dá um "refresh" visual
        Renderer.render(this.player);
    }
};

        Game.currentRoomId = Game.floor.entryRoomId;
        const startRoom = getCurrentRoom();
        if (!startRoom) return;

        const spawn = window.MapGen?.getRandomFloorTile?.(startRoom) || {x: Math.floor(startRoom.w/2), y: Math.floor(startRoom.h/2)};
        Game.player = new window.Player(spawn.x, spawn.y);
        Game.entities = startRoom.metadata?.entities || [];
        Game.running = true;
        window.Renderer?.init?.();
        window.UI?.updateFloor?.(Game.floor.floorNumber);
        window.Renderer?.drawRoom?.(startRoom, Game.player, Game.entities.filter(e => e.alive));
        updateUI();
        window.UI?.log?.(`Bem-vindo ao Andar ${Game.floor.floorNumber}! 🏰`);
        requestAnimationFrame(gameTick);
        
    };

    window.Game = Game;

    document.addEventListener('keydown', e => {
        if (window.Combat?.isActive?.()) {
            window.Combat?.handleInput?.(e);
            return;
        }
        const key = e.key.toLowerCase();
        if (['w','arrowup'].includes(key)) Input.up = true;
        if (['s','arrowdown'].includes(key)) Input.down = true;
        if (['a','arrowleft'].includes(key)) Input.left = true;
        if (['d','arrowright'].includes(key)) Input.right = true;
        if (['e',' '].includes(key)) Input.interact = true;
        e.preventDefault();
    });

    document.addEventListener('keyup', e => {
        const key = e.key.toLowerCase();
        if (['w','arrowup'].includes(key)) Input.up = false;
        if (['s','arrowdown'].includes(key)) Input.down = false;
        if (['a','arrowleft'].includes(key)) Input.left = false;
        if (['d','arrowright'].includes(key)) Input.right = false;
        if (['e',' '].includes(key)) Input.interact = false;
    });

    window.debugListFloor = () => {
        if (!Game.floor) return console.log('Nenhum floor');
        console.log('Floor:', Game.floor.floorNumber, 'Rooms:', Game.floor.rooms.length);
        Game.floor.rooms.forEach(r => console.log(`Room ${r.id} (${r.tag}): ${r.metadata?.entities?.length || 0} entities`));
    };
})();