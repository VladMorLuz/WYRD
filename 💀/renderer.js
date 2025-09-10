// renderer.js - Renderizador 2.5D WYRD
(function(){
    const TILE_SIZE = 16;
    const COLORS = {
        floor: '#444',
        wall: '#222',
        exit: '#f00',
        entry: '#0ff',
        player: '#0f0',
        mob: '#f00'
    };

    // Draws the map tiles
    function drawMap(ctx, mapData, offsetX = 0, offsetY = 0) {
        if (!ctx || !mapData) return;
        for (let y = 0; y < mapData.length; y++) {
            for (let x = 0; x < mapData[0].length; x++) {
                let tile = mapData[y][x];
                let color;
                switch(tile){
                    case 0: color = COLORS.floor; break;
                    case 1: color = COLORS.wall; break;
                    case 2: color = COLORS.exit; break;
                    case 3: color = COLORS.entry; break;
                    default: color = '#666';
                }
                ctx.fillStyle = color;
                ctx.fillRect(x*TILE_SIZE - offsetX, y*TILE_SIZE - offsetY, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    // Draws all entities, sorting by y for pseudo-3D depth
    function drawEntities(ctx, entities, offsetX = 0, offsetY = 0) {
        if (!ctx || !entities) return;
        const allEntities = [entities.player, ...entities.mobs];
        // sort by bottom y (y + h) for depth
        allEntities.sort((a,b) => (a.y + a.h) - (b.y + b.h));
        allEntities.forEach(ent => {
            ctx.fillStyle = ent.type === 'player' ? COLORS.player : COLORS.mob;
            ctx.fillRect(ent.x - offsetX, ent.y - offsetY, ent.w, ent.h);
        });
    }

    // optional debug overlay: show grid and room tag
    function debugOverlay(ctx, mapData, roomMeta, offsetX = 0, offsetY = 0){
        if(!ctx || !mapData) return;
        ctx.strokeStyle = '#888';
        for (let y=0;y<mapData.length;y++){
            for (let x=0;x<mapData[0].length;x++){
                ctx.strokeRect(x*TILE_SIZE - offsetX, y*TILE_SIZE - offsetY, TILE_SIZE, TILE_SIZE);
            }
        }
        if(roomMeta && roomMeta.tag){
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.fillText('Room: '+roomMeta.tag, 5, 15);
        }
    }

    window.renderer = {
        drawMap,
        drawEntities,
        debugOverlay
    };
})();
