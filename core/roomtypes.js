(function(){
    function rndIntLocal(rng, a, b) {
        return Math.floor(rng() * (b - a + 1)) + a;
    }

    const RoomTypes = {
        empty_room: function(rng, w, h, seed) {
            return Array.from({length: h}, () => Array.from({length: w}, () => window.TILE.FLOOR));
        },

        corridor_h: function(rng, w, h, seed) {
            const tiles = Array.from({length: h}, () => Array.from({length: w}, () => window.TILE.WALL));
            const innerHeight = h - 4; // Assume thickness 2, ajusta inner
            if (innerHeight < 3) return RoomTypes.empty_room(rng, w, h, seed); // Fallback se muito estreito

            const band = Math.max(1, Math.floor(innerHeight / 3));
            const mid = Math.floor(innerHeight / 2) + 2; // Offset pra thickness
            const bandStart = Math.max(2, mid - Math.floor(band / 2));
            const bandEnd = Math.min(h - 3, bandStart + band - 1);

            for (let y = bandStart; y <= bandEnd; y++) {
                for (let x = 2; x < w - 2; x++) {
                    tiles[y][x] = window.TILE.FLOOR;
                }
            }

            if (rng() < 0.4) {
                const rx = rndIntLocal(rng, 3, w - 4);
                const branchLen = rndIntLocal(rng, 2, Math.min(4, bandEnd - bandStart + 1));
                for (let off = 1; off <= branchLen; off++) {
                    const ny1 = bandStart - off;
                    const ny2 = bandEnd + off;
                    if (ny1 >= 2) tiles[ny1][rx] = window.TILE.FLOOR;
                    if (ny2 < h - 2) tiles[ny2][rx] = window.TILE.FLOOR;
                }
            }

            return tiles;
        },

        corridor_v: function(rng, w, h, seed) {
            const tiles = Array.from({length: h}, () => Array.from({length: w}, () => window.TILE.WALL));
            const innerWidth = w - 4;
            if (innerWidth < 3) return RoomTypes.empty_room(rng, w, h, seed);

            const band = Math.max(1, Math.floor(innerWidth / 3));
            const mid = Math.floor(innerWidth / 2) + 2;
            const bandStart = Math.max(2, mid - Math.floor(band / 2));
            const bandEnd = Math.min(w - 3, bandStart + band - 1);

            // Banda vertical principal
            for (let x = bandStart; x <= bandEnd; x++) {
                for (let y = 2; y < h - 2; y++) {
                    tiles[y][x] = window.TILE.FLOOR;
                }
            }

            // Ramificação horizontal randômica
            if (rng() < 0.4) {
                const ry = rndIntLocal(rng, 3, h - 4);
                const branchLen = rndIntLocal(rng, 2, Math.min(4, bandEnd - bandStart + 1));
                for (let off = 1; off <= branchLen; off++) {
                    const nx1 = bandStart - off;
                    const nx2 = bandEnd + off;
                    if (nx1 >= 2) tiles[ry][nx1] = window.TILE.FLOOR;
                    if (nx2 < w - 2) tiles[ry][nx2] = window.TILE.FLOOR;
                }
            }

            return tiles;
        },

        treasure: function(rng, w, h, seed) {
            const tiles = RoomTypes.empty_room(rng, w, h, seed);
            const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
            // Marca centro como "tesouro" mas mantém floor (lógica de loot no engine)
            return tiles;
        },

        start: function(rng, w, h, seed) {
    const minW = Math.max(w, 10), minH = Math.max(h, 8);
    const tiles = RoomTypes.empty_room(rng, minW, minH, seed);
    // Marca centro como ENTRY
    const cx = Math.floor(minW / 2), cy = Math.floor(minH / 2);
    tiles[cy][cx] = window.TILE.ENTRY;
    return tiles;
},


        stairs: function(rng, w, h, seed) {
    const minW = Math.max(w, 10), minH = Math.max(h, 8);
    const tiles = RoomTypes.empty_room(rng, minW, minH, seed);
    const cx = Math.floor(minW / 2), cy = Math.floor(minH / 2);
    tiles[cy][cx] = window.TILE.EXIT;
    return tiles;
},


        monster_room: function(rng, w, h, seed) {
            const tiles = RoomTypes.empty_room(rng, w, h, seed);
            const count = Math.max(1, Math.floor((w * h) / 40)); 
            for (let i = 0; i < count; i++) {
                const rx = rndIntLocal(rng, 2, w - 3);
                const ry = rndIntLocal(rng, 2, h - 3);
                if (tiles[ry][rx] !== window.TILE.FLOOR) continue; 
                tiles[ry][rx] = window.TILE.WALL; // Pilar
            }
            return tiles;
        }
    };

    if (!window.RoomTypes) window.RoomTypes = {};
    Object.assign(window.RoomTypes, RoomTypes);

    if (window.MapGen && typeof window.MapGen.registerTag === 'function') {
        for (const key in RoomTypes) {
            window.MapGen.registerTag(key, RoomTypes[key]);
        }
    }
})();