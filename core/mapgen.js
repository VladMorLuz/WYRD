(function(){
    const Utils = window.Utils;
    if (!Utils) {
        console.error('MapGen: Carregue utils.js primeiro!');
        return;
    }

    if (!window.RoomTypes || Object.keys(window.RoomTypes).length === 0) {
        console.warn('MapGen: RoomTypes não encontrado. Usando fallbacks internos.');
        window.MapGen = { registerTag: () => {}, TAGS: { empty_room: Utils => Array.from({length: Utils}, () => Array.from({length: Utils}, () => window.TILE.FLOOR)) } };
        return;
    }

    const DEFAULTS = {
        MIN_ROOMS: 12, MAX_ROOMS: 48,
        ROOM_MIN_W: 16, ROOM_MAX_W: 32,
        ROOM_MIN_H: 16, ROOM_MAX_H: 32,
        EXTRA_CONNECTION_CHANCE: 0.25,
        WALL_THICKNESS: 2,
        MIN_DOOR_SPACING: 3,
        MIN_FLOOR_PCT: 0.20
    };

    const TAGS = window.RoomTypes || {};

    function registerTag(name, generatorFn) {
        if (typeof generatorFn === 'function') {
            TAGS[name] = generatorFn;
        }
        return TAGS[name];
    }

    function applyWallBorder(tiles, thickness = DEFAULTS.WALL_THICKNESS) {
        const h = tiles.length, w = tiles[0].length;
        for (let t = 0; t < thickness; t++) {
            const top = t, bottom = h - 1 - t;
            for (let x = 0; x < w; x++) {
                tiles[top][x] = window.TILE.WALL;
                tiles[bottom][x] = window.TILE.WALL;
            }
            const left = t, right = w - 1 - t;
            for (let y = 0; y < h; y++) {
                tiles[y][left] = window.TILE.WALL;
                tiles[y][right] = window.TILE.WALL;
            }
        }
    }

    function computeDoorSlotsForRoom(w, h) {
        const t = DEFAULTS.WALL_THICKNESS;
        const slots = [];
        // Norte/Sul
        const northY = t - 1, southY = h - t;
        for (let x = t; x < w - t; x++) {
            slots.push({side: 'N', x, y: northY});
            slots.push({side: 'S', x, y: southY});
        }
        // Oeste/Leste
        const westX = t - 1, eastX = w - t;
        for (let y = t; y < h - t; y++) {
            slots.push({side: 'W', x: westX, y});
            slots.push({side: 'E', x: eastX, y});
        }
        return slots;
    }

    function pickFreeDoorSlot(rng, room, doorsTaken) {
        const allSlots = computeDoorSlotsForRoom(room.w, room.h);
        const sidesOffset = {N: [0,1], S: [0,-1], W: [1,0], E: [-1,0]};
        const minSpacing = DEFAULTS.MIN_DOOR_SPACING;

        function tooClose(slot) {
            if (!room.doors) return false;
            for (const d of room.doors) {
                const dist = Math.abs(d.x - slot.x) + Math.abs(d.y - slot.y);
                if (dist < minSpacing) return true;
            }
            for (const key of doorsTaken) {
                const [side, xs, ys] = key.split(':');
                const xi = parseInt(xs), yi = parseInt(ys);
                if (Math.abs(xi - slot.x) + Math.abs(yi - slot.y) < minSpacing) return true;
            }
            return false;
        }

        let preferred = allSlots.filter(slot => {
            const key = `${slot.side}:${slot.x}:${slot.y}`;
            if (doorsTaken.has(key) || tooClose(slot)) return false;
            const off = sidesOffset[slot.side] || [0,0];
            const ix = slot.x + off[0], iy = slot.y + off[1];
            const inBounds = ix >= 0 && iy >= 0 && ix < room.w && iy < room.h;
            if (!inBounds) return false;
            const inwardTile = room.tiles[iy][ix];
            return inwardTile === window.TILE.FLOOR || inwardTile === window.TILE.ENTRY || inwardTile === window.TILE.EXIT;
        });

        if (preferred.length > 0) {
            return preferred[Utils.rndInt(rng, 0, preferred.length - 1)];
        }

        let any = allSlots.filter(slot => {
            const key = `${slot.side}:${slot.x}:${slot.y}`;
            return !doorsTaken.has(key) && !tooClose(slot);
        });
        if (any.length > 0) {
            return any[Utils.rndInt(rng, 0, any.length - 1)];
        }

        any = allSlots.filter(slot => !doorsTaken.has(`${slot.side}:${slot.x}:${slot.y}`));
        return any.length > 0 ? any[Utils.rndInt(rng, 0, any.length - 1)] : null;
    }

    let gid = 1;
    function nextId(prefix = 'id') {
        return `${prefix}_${gid++}_${Date.now().toString(36).slice(-4)}`;
    }

    function populateRoom(room, floorNumber, rng) {
        room.metadata = room.metadata || { entities: [] };
        try {
            if (typeof window.pickMobForFloor === 'function' && window.MobFactory?.create) {
                if (rng() < 0.6) { // Chance de mob
                    const mobId = window.pickMobForFloor(floorNumber);
                    if (mobId) {
                        const spawn = getRandomFloorTile(room, rng);
                        const mob = window.MobFactory.create(mobId, spawn.x, spawn.y);
                        if (mob) room.metadata.entities.push(mob);
                    }
                }
            }
        } catch (err) {
            console.warn('MapGen.populateRoom: Ignorando populate (entities não pronto):', err);
        }
    }

    function generateFloor(floorNumber = 1, opts = {}) {
        const floorSeed = opts.seed || `WYRD_floor_${floorNumber}`;
        const floorRng = Utils.seededRngFrom(floorSeed);

        const roomCount = Utils.rndInt(floorRng, opts.minRooms || DEFAULTS.MIN_ROOMS, opts.maxRooms || DEFAULTS.MAX_ROOMS);

        const essential = ['start', 'stairs','fountain'];
        const complementary = ['empty_room', 'corridor_h', 'corridor_v', 'treasure', 'monster_room', 'treasure_room','choke_point','circular_room','cavern'];
        let tags = [...essential];
        for (let i = 0; i < roomCount - essential.length; i++) {
            tags.push(complementary[Utils.rndInt(floorRng, 0, complementary.length - 1)]);
        }
        Utils.shuffleArray(floorRng, tags);

        const rooms = [];
        for (let i = 0; i < roomCount; i++) {
            const tag = tags[i] || 'empty_room';
            const roomSeed = `${floorSeed}:room:${i}:${tag}`;
            const rng = Utils.seededRngFrom(roomSeed);

            const w = Utils.rndInt(rng, Math.max(DEFAULTS.ROOM_MIN_W, 6), DEFAULTS.ROOM_MAX_W);
            const h = Utils.rndInt(rng, Math.max(DEFAULTS.ROOM_MIN_H, 6), DEFAULTS.ROOM_MAX_H);

            let tiles = (TAGS[tag] || TAGS.empty_room)(rng, w, h, roomSeed);
            applyWallBorder(tiles); // Aplica borda aqui, pós-geração

            if (Utils.computeFloorPct(tiles) < DEFAULTS.MIN_FLOOR_PCT) {
                tiles = (TAGS.empty_room || (() => Array.from({length: h}, () => Array.from({length: w}, () => window.TILE.FLOOR))))(rng, w, h, roomSeed + ':fallback');
                applyWallBorder(tiles);
            }

            const room = {
                id: nextId('room'),
                tag,
                seed: roomSeed,
                w, h,
                tiles,
                doors: [],
                metadata: { entities: [] }
            };

            populateRoom(room, floorNumber, rng);
            rooms.push(room);
        }

        const connections = [];
        const doorsTakenMap = {};

        function ensureDoorsTakenSet(roomId) {
            if (!doorsTakenMap[roomId]) doorsTakenMap[roomId] = new Set();
            return doorsTakenMap[roomId];
        }

        const order = rooms.map(r => r.id);
        Utils.shuffleArray(floorRng, order);
        for (let i = 1; i < order.length; i++) {
            const targetId = order[i];
            const sourceIdx = Utils.rndInt(floorRng, 0, i - 1);
            const sourceId = order[sourceIdx];
            const roomA = rooms.find(r => r.id === sourceId);
            const roomB = rooms.find(r => r.id === targetId);

            const rngA = Utils.seededRngFrom(roomA.seed + ':doors');
            const rngB = Utils.seededRngFrom(roomB.seed + ':doors');

            let slotA = pickFreeDoorSlot(rngA, roomA, ensureDoorsTakenSet(roomA.id));
            let slotB = pickFreeDoorSlot(rngB, roomB, ensureDoorsTakenSet(roomB.id));

            // Fallback se null
            if (!slotA) slotA = computeDoorSlotsForRoom(roomA.w, roomA.h).find(s => !ensureDoorsTakenSet(roomA.id).has(`${s.side}:${s.x}:${s.y}`));
            if (!slotB) slotB = computeDoorSlotsForRoom(roomB.w, roomB.h).find(s => !ensureDoorsTakenSet(roomB.id).has(`${s.side}:${s.x}:${s.y}`));

            if (slotA && slotB) {
                createPairedDoors(roomA, slotA, roomB, slotB, connections, ensureDoorsTakenSet);
            }
        }

        const extraAttempts = Math.floor(roomCount * 1.2);
        for (let t = 0; t < extraAttempts; t++) {
            if (floorRng() > DEFAULTS.EXTRA_CONNECTION_CHANCE) continue;
            const a = rooms[Utils.rndInt(floorRng, 0, rooms.length - 1)];
            const b = rooms[Utils.rndInt(floorRng, 0, rooms.length - 1)];
            if (a.id === b.id) continue;
            const slotA = pickFreeDoorSlot(floorRng, a, ensureDoorsTakenSet(a.id));
            const slotB = pickFreeDoorSlot(floorRng, b, ensureDoorsTakenSet(b.id));
            if (slotA && slotB) {
                createPairedDoors(a, slotA, b, slotB, connections, ensureDoorsTakenSet);
            }
        }

        function createPairedDoors(roomA, slotA, roomB, slotB, connections, ensureDoorsTakenSet) {
            const doorA = { id: nextId('door'), x: slotA.x, y: slotA.y, side: slotA.side, targetRoomId: roomB.id, targetDoorId: null };
            const doorB = { id: nextId('door'), x: slotB.x, y: slotB.y, side: slotB.side, targetRoomId: roomA.id, targetDoorId: null };
            doorA.targetDoorId = doorB.id;
            doorB.targetDoorId = doorA.id;

            const inwardOffset = { N: [0,1], S: [0,-1], W: [1,0], E: [-1,0] };
            if (roomA.tiles[slotA.y]) {
                roomA.tiles[slotA.y][slotA.x] = window.TILE.FLOOR;
                const off = inwardOffset[slotA.side] || [0,0];
                const ix = slotA.x + off[0], iy = slotA.y + off[1];
                if (ix >= 0 && iy >= 0 && ix < roomA.w && iy < roomA.h) {
                    roomA.tiles[iy][ix] = window.TILE.FLOOR;
                }
            }

            roomA.doors.push(doorA);
            roomB.doors.push(doorB);

            ensureDoorsTakenSet(roomA.id).add(`${slotA.side}:${slotA.x}:${slotA.y}`);
            ensureDoorsTakenSet(roomB.id).add(`${slotB.side}:${slotB.x}:${slotB.y}`);

            connections.push({ id: nextId('conn'), roomA: roomA.id, doorAId: doorA.id, roomB: roomB.id, doorBId: doorB.id });
        }

        const entryRoom = rooms.find(r => r.tag === 'start') || rooms[0];
        const exitRoom = rooms.find(r => r.tag === 'stairs') || rooms[rooms.length - 1];

        return {
            seed: floorSeed,
            floorNumber,
            rooms,
            connections,
            entryRoomId: entryRoom.id,
            exitRoomId: exitRoom.id,
            getRoomById: id => rooms.find(r => r.id === id)
        };
    }

    function getRandomFloorTile(room, rng = Math.random) {
        if (!room.tiles) return { x: Math.floor(room.w / 2), y: Math.floor(room.h / 2) };
        const candidates = [];
        for (let y = 0; y < room.h; y++) {
            for (let x = 0; x < room.w; x++) {
                const t = room.tiles[y][x];
                if (t === window.TILE.FLOOR || t === window.TILE.ENTRY || t === window.TILE.EXIT) {
                    candidates.push({x, y});
                }
            }
        }
        return candidates.length > 0 ? candidates[Math.floor(rng() * candidates.length)] : { x: Math.floor(room.w / 2), y: Math.floor(room.h / 2) };
    }

    function getSpawnForDoor(room, door) {
        const offset = {N: [0,1], S: [0,-1], W: [1,0], E: [-1,0]};
        const off = offset[door.side] || [0,0];

        const candidates = [
            { x: door.x + off[0], y: door.y + off[1] },
            { x: door.x + off[0] * 2, y: door.y + off[1] * 2 },
            { x: Math.floor(room.w / 2), y: Math.floor(room.h / 2) }
        ];

        function inBounds(x, y) { return x >= 0 && y >= 0 && x < room.w && y < room.h; }
        function isFloor(x, y) {
            if (!inBounds(x, y)) return false;
            const t = room.tiles[y][x];
            return t === window.TILE.FLOOR || t === window.TILE.ENTRY || t === window.TILE.EXIT;
        }

        for (const c of candidates) {
            if (inBounds(c.x, c.y) && isFloor(c.x, c.y)) return c;
        }

        const cx = Math.floor(room.w / 2), cy = Math.floor(room.h / 2);
        const radius = Math.max(3, Math.floor(Math.min(room.w, room.h) / 4));
        for (let r = 1; r <= radius; r++) {
            for (let yy = Math.max(0, cy - r); yy <= Math.min(room.h - 1, cy + r); yy++) {
                for (let xx = Math.max(0, cx - r); xx <= Math.min(room.w - 1, cx + r); xx++) {
                    if (isFloor(xx, yy)) return { x: xx, y: yy };
                }
            }
        }

        const fb = candidates[0];
        return { x: Utils.clamp(fb.x, 1, room.w - 2), y: Utils.clamp(fb.y, 1, room.h - 2) };
    }

    window.MapGen = {
        generateFloor,
        registerTag,
        TAGS,
        getSpawnForDoor,
        getRandomFloorTile
    };
})();