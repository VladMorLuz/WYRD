(function(){
    const DEFAULTS = {
        canvasId: 'game-canvas',
        tileSize: window.TILE_SIZE || 32, // Aumentado de 16 para 32
        bgColor: '#0b0b0c',
        floorColor: '#2b2b2b',
        wallColor: '#444',
        entryColor: '#4ade80',
        exitColor: '#ef4444',
        doorColor: '#f59e0b',
        gridColor: '#2228',
        playerColor: '#38bdf8',
        entityColor: '#f97316',
        showGrid: !!(window.DEBUG && window.DEBUG.SHOW_GRID),
        sprites: {} // nome -> Image
    };

    let canvas, ctx, devicePixelRatioCached = 1;
    let opts = Object.assign({}, DEFAULTS);
    let spriteCache = {}; // path -> Image

    function ensureCanvas() {
        if (!canvas) {
            canvas = document.getElementById(opts.canvasId);
            if (!canvas) {
                console.error('Renderer: canvas not found:', opts.canvasId);
                return false;
            }
            ctx = canvas.getContext('2d');
            _setupPixelRatio();
        }
        return !!canvas;
    }

    function _setupPixelRatio() {
        devicePixelRatioCached = window.devicePixelRatio || 1;
        const w = window.CANVAS_WIDTH || canvas.clientWidth || 800;
        const h = window.CANVAS_HEIGHT || canvas.clientHeight || 600;

        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';

        canvas.width = Math.floor(w * devicePixelRatioCached);
        canvas.height = Math.floor(h * devicePixelRatioCached);

        ctx.setTransform(devicePixelRatioCached, 0, 0, devicePixelRatioCached, 0, 0);
        ctx.imageSmoothingEnabled = false; // Garantido para pixel art
    }

    function setDebug(flag) {
        opts.showGrid = !!flag;
    }

    function clear() {
        if (!ensureCanvas()) return;
        ctx.fillStyle = opts.bgColor;
        ctx.fillRect(0, 0, canvas.width / devicePixelRatioCached, canvas.height / devicePixelRatioCached);
    }

    function computeRoomOffset(room) {
        const tileSize = opts.tileSize;
        const canvasW = canvas.width / devicePixelRatioCached;
        const canvasH = canvas.height / devicePixelRatioCached;
        const roomWpx = room.w * tileSize;
        const roomHpx = room.h * tileSize;

        const offsetX = Math.floor((canvasW - roomWpx) / 2);
        const offsetY = Math.floor((canvasH - roomHpx) / 2);
        return { offsetX, offsetY, canvasW, canvasH, roomWpx, roomHpx };
    }

    function loadSprite(name, path) {
        if (opts.sprites[name]) return opts.sprites[name];
        const img = new Image();
        img.src = path;
        img.onload = () => { /* ready */ };
        opts.sprites[name] = img;
        return img;
    }

    function getSpriteFor(entityOrName) {
        if (!entityOrName) return null;
        if (typeof entityOrName === 'string') return opts.sprites[entityOrName] || null;
        if (entityOrName.sprite) {
            if (typeof entityOrName.sprite === 'string') {
                if (entityOrName.sprite.indexOf('/') !== -1) {
                    if (!spriteCache[entityOrName.sprite]) {
                        const img = new Image();
                        img.src = entityOrName.sprite;
                        spriteCache[entityOrName.sprite] = img;
                    }
                    return spriteCache[entityOrName.sprite];
                }
                return opts.sprites[entityOrName.sprite] || null;
            }
            if (entityOrName.sprite instanceof Image) return entityOrName.sprite;
        }
        return null;
    }

    function drawRoom(room, player = null, entities = []) {
        if (!ensureCanvas()) return;
        if (!room || !room.tiles) {
            clear();
            ctx.fillStyle = '#fff';
            ctx.fillText('No room to draw', 10, 20);
            return;
        }

        clear();
        const tileSize = opts.tileSize;
        const { offsetX, offsetY, roomWpx, roomHpx } = computeRoomOffset(room);

        for (let y = 0; y < room.h; y++) {
            for (let x = 0; x < room.w; x++) {
                const tile = (room.tiles[y] && room.tiles[y][x]) !== undefined ? room.tiles[y][x] : window.TILE.FLOOR;
                let color = opts.floorColor;
                if (tile === window.TILE.WALL) color = opts.wallColor;
                else if (tile === window.TILE.ENTRY) color = opts.entryColor;
                else if (tile === window.TILE.EXIT) color = opts.exitColor;

                ctx.fillStyle = color;
                ctx.fillRect(offsetX + x * tileSize, offsetY + y * tileSize, tileSize, tileSize);
            }
        }

        if (Array.isArray(room.doors)) {
            ctx.fillStyle = opts.doorColor;
            for (const d of room.doors) {
                ctx.fillRect(offsetX + d.x * tileSize, offsetY + d.y * tileSize, tileSize, tileSize);
                ctx.fillStyle = shadeColor(opts.doorColor, -20);
                const pad = Math.max(1, Math.floor(tileSize * 0.2));
                ctx.fillRect(offsetX + d.x * tileSize + pad, offsetY + d.y * tileSize + pad, tileSize - pad*2, tileSize - pad*2);
                ctx.fillStyle = opts.doorColor;
            }
        }

        if (opts.showGrid) {
            ctx.strokeStyle = opts.gridColor;
            ctx.lineWidth = 1;
            for (let gx = 0; gx <= room.w; gx++) {
                const x = offsetX + gx * tileSize - 0.5;
                ctx.beginPath();
                ctx.moveTo(x, offsetY);
                ctx.lineTo(x, offsetY + room.h * tileSize);
                ctx.stroke();
            }
            for (let gy = 0; gy <= room.h; gy++) {
                const y = offsetY + gy * tileSize - 0.5;
                ctx.beginPath();
                ctx.moveTo(offsetX, y);
                ctx.lineTo(offsetX + room.w * tileSize, y);
                ctx.stroke();
            }
        }

        if (Array.isArray(entities)) {
            for (const e of entities) {
                drawEntity(e, offsetX, offsetY, 1); // Adicionado scale=1
            }
        }

        if (player) drawPlayer(player, offsetX, offsetY, 1); // Adicionado scale=1
    }

    function _getShakeOffset(obj) {
        if (!obj || !obj._shakeEnd) return {ox:0, oy:0};
        const now = performance.now();
        if (now > obj._shakeEnd) {
            delete obj._shakeEnd;
            delete obj._shakeAmt;
            return {ox:0, oy:0};
        }
        const a = obj._shakeAmt || 4;
        const ox = (Math.random()*2-1) * a;
        const oy = (Math.random()*2-1) * a;
        return {ox, oy};
    }

    function _getFlashAlpha(obj) {
        if (!obj || !obj._flashEnd) return 0;
        const now = performance.now();
        const rem = Math.max(0, obj._flashEnd - now);
        const dur = obj._flashDur || 120;
        return Math.max(0, rem / dur);
    }

    function drawPlayer(player, offsetX, offsetY, scale = 1) { // Adicionado scale
        if (!player) return;
        const tileSize = opts.tileSize;
        const px = offsetX + (player.x * tileSize);
        const py = offsetY + (player.y * tileSize);

        const {ox, oy} = _getShakeOffset(player);

        const img = getSpriteFor(player) || opts.sprites.player || null;
        if (img && img.complete && img.naturalWidth) {
            try {
                ctx.drawImage(img, px + ox, py + oy, tileSize * scale, tileSize * scale); 
            } catch(e) {
                ctx.fillStyle = player.color || opts.playerColor;
                ctx.fillRect(px + ox, py + oy, tileSize * scale, tileSize * scale);
            }
        } else {
            ctx.fillStyle = shadeColor(opts.playerColor, 8);
            ctx.fillRect(px + ox, py + oy, tileSize * scale, tileSize * scale); 

            const cx = px + tileSize * scale / 2 + ox;
            const cy = py + tileSize * scale / 2 + oy;
            const r = Math.max(2, tileSize * 0.5 * scale); 
            ctx.beginPath();
            ctx.fillStyle = player.color || opts.playerColor;
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#0008';
            ctx.fillRect(cx - r*0.2, cy - r*0.1, r*0.4, r*0.2);
        }

        const alpha = _getFlashAlpha(player);
        if (alpha > 0) {
            ctx.fillStyle = `rgba(255,80,80,${alpha*0.7})`;
            ctx.fillRect(px, py, tileSize * scale, tileSize * scale); 
        }
    }

    function drawEntity(entity, offsetX, offsetY, scale = 1) { 
        if (!entity || !entity.alive) return;
        const tileSize = opts.tileSize;
        const px = offsetX + (entity.x * tileSize);
        const py = offsetY + (entity.y * tileSize);

        const {ox, oy} = _getShakeOffset(entity);

        const img = getSpriteFor(entity);
        if (img && img.complete && img.naturalWidth) {
            try {
                ctx.drawImage(img, px + ox, py + oy, tileSize * scale, tileSize * scale); 
            } catch(e){
                ctx.fillStyle = entity.color || opts.entityColor;
                ctx.fillRect(px + tileSize*0.15 + ox, py + tileSize*0.15 + oy, tileSize*0.8 * scale, tileSize*0.8 * scale);
            }
        } else {
            ctx.fillStyle = entity.color || opts.entityColor;
            ctx.fillRect(px + tileSize*0.15 + ox, py + tileSize*0.15 + oy, tileSize*0.8 * scale, tileSize*0.8 * scale); 
        }

        if (entity.hp != null && entity.maxHp != null) {
            const barW = tileSize * 0.9 * scale;
            const barH = 3 * scale;
            const pct = Math.max(0, Math.min(1, entity.hp / entity.maxHp));
            ctx.fillStyle = '#0008';
            ctx.fillRect(px + (tileSize * scale - barW) / 2, py - 6 * scale, barW, barH);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(px + (tileSize * scale - barW) / 2, py - 6 * scale, barW * pct, barH);
        }

        if (entity.char) {
            ctx.fillStyle = '#fff';
            ctx.font = `${tileSize * 0.6 * scale}px ${opts.mono || 'monospace'}`; 
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(entity.char, px + tileSize * scale / 2 + ox, py + tileSize * scale / 2 + oy);
        }

        const alpha = _getFlashAlpha(entity);
        if (alpha > 0) {
            ctx.fillStyle = `rgba(255,80,80,${alpha*0.7})`;
            ctx.fillRect(px, py, tileSize * scale, tileSize * scale); 
        }
    }

    function tileToScreen(room, tx, ty) {
        if (!canvas) ensureCanvas();
        const { offsetX, offsetY } = computeRoomOffset(room);
        return {
            x: offsetX + tx * opts.tileSize,
            y: offsetY + ty * opts.tileSize
        };
    }

    function screenToTile(room, sx, sy) {
        if (!canvas) ensureCanvas();
        const { offsetX, offsetY, roomWpx, roomHpx } = computeRoomOffset(room);
        const localX = sx - offsetX;
        const localY = sy - offsetY;
        if (localX < 0 || localY < 0 || localX >= roomWpx || localY >= roomHpx) return null;
        return {
            x: Math.floor(localX / opts.tileSize),
            y: Math.floor(localY / opts.tileSize)
        };
    }

    function shadeColor(hex, percent) {
        const c = hex.replace('#','');
        const num = parseInt(c,16);
        let r = (num >> 16) + percent;
        let g = ((num >> 8) & 0x00FF) + percent;
        let b = (num & 0x0000FF) + percent;
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        return '#' + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
    }

    function shakeEntity(entity, amount = 4, duration = 250) {
        if (!entity) return;
        entity._shakeAmt = amount;
        entity._shakeEnd = performance.now() + duration;
    }
    function shakePlayer(amount = 4, duration = 250) {
        if (!window.Game || !window.Game.player) return;
        shakeEntity(window.Game.player, amount, duration);
    }
    function flashEntity(entity, duration = 120) {
        if (!entity) return;
        entity._flashDur = duration;
        entity._flashEnd = performance.now() + duration;
    }

    function drawBattleEntity(entity, x, y, scale = 2) {
        if (!entity || !entity.alive) return;
        const tileSize = opts.tileSize;
        const px = x;
        const py = y;
        const { ox, oy } = _getShakeOffset(entity);

        const img = getSpriteFor(entity);
        if (img && img.complete && img.naturalWidth) {
            try {
                ctx.drawImage(img, px + ox, py + oy, tileSize * scale, tileSize * scale);
            } catch (e) {
                ctx.fillStyle = entity.color || opts.entityColor;
                ctx.fillRect(px + ox, py + oy, tileSize * scale, tileSize * scale);
            }
        } else {
            ctx.fillStyle = entity.color || opts.entityColor;
            ctx.fillRect(px + ox, py + oy, tileSize * scale, tileSize * scale);
        }

        // HP bar maior para batalha
        if (entity.hp != null && entity.maxHp != null) {
            const barW = tileSize * scale * 0.9;
            const barH = 6;
            const pct = Math.max(0, Math.min(1, entity.hp / entity.maxHp));
            ctx.fillStyle = '#0008';
            ctx.fillRect(px + (tileSize * scale - barW) / 2, py - 10, barW, barH);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(px + (tileSize * scale - barW) / 2, py - 10, barW * pct, barH);
        }

        const alpha = _getFlashAlpha(entity);
        if (alpha > 0) {
            ctx.fillStyle = `rgba(255,80,80,${alpha * 0.7})`;
            ctx.fillRect(px, py, tileSize * scale, tileSize * scale);
        }
    }

    function preloadDefaultSprites() {
        const defaultPlayerPath = (window.ASSETS && window.ASSETS.player) || 'assets/wander/player.png';
        if (!opts.sprites.player) {
            const img = new Image();
            img.src = defaultPlayerPath;
            opts.sprites.player = img;
        }
    }

    window.Renderer = {
        init: function(options = {}) {
            opts = Object.assign({}, opts, options);
            ensureCanvas();
            _setupPixelRatio();
            preloadDefaultSprites();
        },
        setDebug,
        clear,
        drawRoom,
        tileToScreen,
        screenToTile,
        loadSprite,
        shakeEntity,
        shakePlayer,
        flashEntity,
        drawBattleEntity, 
        _internal: {
            _opts: opts
        }
    };
})();