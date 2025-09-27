(function(){
    // Utilitários globais: PRNG, helpers para MapGen/Renderer/etc.
    const Utils = {
        // FNV-1a para seed numérica de string
        xfnv1a: function(str) {
            let h = 2166136261 >>> 0;
            for (let i = 0; i < str.length; i++) {
                h = Math.imul(h ^ str.charCodeAt(i), 16777619);
            }
            return h >>> 0;
        },

        // Mulberry32 PRNG (rápido e determinístico)
        mulberry32: function(seed) {
            return function() {
                let t = (seed += 0x6D2B79F5) >>> 0;
                t = Math.imul(t ^ t >>> 15, t | 1);
                t ^= t + Math.imul(t ^ t >>> 7, t | 61);
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
        },

        // RNG seeded de string
        seededRngFrom: function(seedStr) {
            const seed = this.xfnv1a(seedStr);
            return this.mulberry32(seed);
        },

        // Int rand [a,b] inclusive
        rndInt: function(rng, a, b) {
            return Math.floor(rng() * (b - a + 1)) + a;
        },

        // Shuffle in-place
        shuffleArray: function(rng, arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        },

        // Clamp
        clamp: function(v, a, b) {
            return Math.max(a, Math.min(b, v));
        },

        // % de floor tiles (FLOOR/ENTRY/EXIT)
        computeFloorPct: function(tiles) {
            if (!Array.isArray(tiles) || tiles.length === 0) return 0;
            let count = 0, total = 0;
            for (let y = 0; y < tiles.length; y++) {
                const row = tiles[y];
                if (!Array.isArray(row)) continue;
                for (let x = 0; x < row.length; x++) {
                    total++;
                    const t = row[x];
                    if (t === window.TILE?.FLOOR || t === window.TILE?.ENTRY || t === window.TILE?.EXIT) {
                        count++;
                    }
                }
            }
            return total === 0 ? 0 : (count / total);
        }
    };

    

    // Evita sobrescrita se já existir
    if (!window.Utils) {
        window.Utils = Utils;
    } else {
        // Merge só o que falta
        for (const key in Utils) {
            if (window.Utils[key] === undefined) {
                window.Utils[key] = Utils[key];
            }
        }
    }
})();