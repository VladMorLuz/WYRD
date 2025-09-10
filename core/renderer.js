(function(){
    const DEFAULTS = {
        canvasId: 'game-canvas',
        tileSize: window.TILE_SIZE || 16,
        bgColor: '#111',
        floorColor: '#2b2b2b',
        wallColor: '#444',
        entryColor: '#4ade80',
        exitColor: '#ef4444',
        doorColor: '#f59e0b',
        gridColor: '#2228',
        playerColor: '#38bdf8',
        entityColor: '#f97316', // Fallback se entity.color undefined
        showGrid: !!(window.DEBUG && window.DEBUG.SHOW_GRID)
    };

    let canvas, ctx, devicePixelRatioCached = 1;
    let opts = Object.assign({}, DEFAULTS);

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
        ctx.imageSmoothingEnabled = false;
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

        // Draw tiles
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

        // Draw doors
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

        // Draw grid (debug)
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

        // Draw entities
        if (Array.isArray(entities)) {
            for (const e of entities) {
                drawEntity(e, offsetX, offsetY);
            }
        }

        // Draw player
        if (player) drawPlayer(player, offsetX, offsetY);

        ctx.strokeStyle = '#0008';
        ctx.lineWidth = 2;
        ctx.strokeRect(offsetX - 1, offsetY - 1, room.w * tileSize + 2, room.h * tileSize + 2);
    }

    function drawPlayer(player, offsetX, offsetY) {
        if (!player) return;
        const tileSize = opts.tileSize;
        const px = offsetX + (player.x * tileSize);
        const py = offsetY + (player.y * tileSize);

        ctx.fillStyle = shadeColor(opts.playerColor, 8);
        ctx.fillRect(px, py, tileSize, tileSize);

        const cx = px + tileSize / 2;
        const cy = py + tileSize / 2;
        const r = Math.max(2, tileSize * 0.35);
        ctx.beginPath();
        ctx.fillStyle = player.color || opts.playerColor;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0008';
        ctx.fillRect(cx - r*0.2, cy - r*0.1, r*0.4, r*0.2);
    }

    function drawEntity(entity, offsetX, offsetY) {
        if (!entity || !entity.alive) return;
        const tileSize = opts.tileSize;
        const px = offsetX + (entity.x * tileSize);
        const py = offsetY + (entity.y * tileSize);

        // Usa entity.color se disponível, senão fallback
        ctx.fillStyle = entity.color || opts.entityColor;
        ctx.fillRect(px + tileSize*0.15, py + tileSize*0.15, tileSize*0.7, tileSize*0.7);

        // HP bar
        if (entity.hp != null && entity.maxHp != null) {
            const barW = tileSize * 0.9;
            const barH = 3;
            const pct = Math.max(0, Math.min(1, entity.hp / entity.maxHp));
            ctx.fillStyle = '#0008';
            ctx.fillRect(px + (tileSize-barW)/2, py - 6, barW, barH);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(px + (tileSize-barW)/2, py - 6, barW * pct, barH);
        }

        // Desenha char (opcional, pra debug ou visual)
        if (entity.char) {
            ctx.fillStyle = '#fff';
            ctx.font = `${tileSize * 0.6}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(entity.char, px + tileSize/2, py + tileSize/2);
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

    window.Renderer = {
        init: function(options = {}) {
            opts = Object.assign({}, opts, options);
            ensureCanvas();
            _setupPixelRatio();
        },
        setDebug,
        clear,
        drawRoom,
        tileToScreen,
        screenToTile,
        _internal: {
            _opts: opts
        }
    };
})();