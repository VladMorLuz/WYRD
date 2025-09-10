// REWORK

(function(){
  const TILE = window.TILE;
  const TILE_SIZE = window.TILE_SIZE;

  // Simple deterministic RNG (mulberry32) so each room can have a seed
  function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; }

  // small helpers
  function makeEmptyRoom(w, h, fill = TILE.FLOOR) {
    const room = new Array(h);
    for (let y = 0; y < h; y++) {
      room[y] = new Array(w).fill(fill);
    }
    // borders
    for (let x = 0; x < w; x++) { room[0][x] = TILE.WALL; room[h-1][x] = TILE.WALL; }
    for (let y = 0; y < h; y++) { room[y][0] = TILE.WALL; room[y][w-1] = TILE.WALL; }
    return room;
  }
  function copyRoom(room) { return room.map(r => r.slice()); }
  function centerCoord(w,h) { return { x: Math.floor(w/2), y: Math.floor(h/2) }; }
  function placeTile(tiles, x, y, tile) { if (y>=0 && y<tiles.length && x>=0 && x<tiles[0].length) tiles[y][x] = tile; }

  // --- Templates (>=10) ---
  // Each template returns: { tiles, meta: { tag, exits: [{x,y,dir}], seedless?:bool } }
  // Width/height chosen to be reasonably varied. Templates are deterministic given RNG input.
  const Templates = {
    startRoom: (rng) => {
      const w = 41, h = 25;
      const tiles = makeEmptyRoom(w,h);
      const c = centerCoord(w,h);
      tiles[c.y][c.x] = TILE.ENTRY;
      const exits = [
        { x: 1, y: c.y, dir: 'left' },
        { x: w-2, y: c.y, dir: 'right' },
        { x: c.x, y: 1, dir: 'top' },
        { x: c.x, y: h-2, dir: 'bottom' }
      ];
      exits.forEach(e => placeTile(tiles, e.x, e.y, TILE.EXIT));
      return { tiles, meta: { tag: 'start', exits } };
    },

    smallRoom: (rng) => {
      const w = 21, h = 15;
      const tiles = makeEmptyRoom(w,h);
      const c = centerCoord(w,h);
      // random interior obstacles
      for (let y = c.y-2; y <= c.y+2; y++){
        for (let x = c.x-4; x <= c.x+4; x++){
          if (rng() < 0.12) tiles[y][x] = TILE.WALL;
        }
      }
      const exits = [{ x:1,y:c.y,dir:'left' }, { x:w-2,y:c.y,dir:'right' }];
      exits.forEach(e => placeTile(tiles,e.x,e.y,TILE.EXIT));
      return { tiles, meta: { tag: 'small', exits } };
    },

    largeRoom: (rng) => {
      const w = 41, h = 25;
      const tiles = makeEmptyRoom(w,h);
      const c = centerCoord(w,h);
      for (let y=3;y<h-3;y+=4) for (let x=3;x<w-3;x+=6) tiles[y][x] = TILE.WALL;
      const exits = [];
      if (rng() < 0.9) exits.push({ x:1,y:c.y,dir:'left' });
      if (rng() < 0.9) exits.push({ x:w-2,y:c.y,dir:'right' });
      if (rng() < 0.7) exits.push({ x:c.x,y:1,dir:'top' });
      if (rng() < 0.7) exits.push({ x:c.x,y:h-2,dir:'bottom' });
      if (exits.length===0) exits.push({ x:w-2,y:c.y,dir:'right' });
      exits.forEach(e => placeTile(tiles,e.x,e.y,TILE.EXIT));
      return { tiles, meta: { tag: 'large', exits } };
    },

    corridorH: (rng, length=25) => {
      const h = 7, w = Math.max(7,length);
      const tiles = makeEmptyRoom(w,h);
      const midY = Math.floor(h/2);
      for (let x=1;x<w-1;x++) tiles[midY][x] = TILE.FLOOR;
      const exits = [{ x:1,y:midY,dir:'left'}, { x:w-2,y:midY,dir:'right'}];
      exits.forEach(e => placeTile(tiles,e.x,e.y,TILE.EXIT));
      return { tiles, meta: { tag: 'corridorH', exits } };
    },

    corridorV: (rng, length=15) => {
      const w = 7, h = Math.max(7,length);
      const tiles = makeEmptyRoom(w,h);
      const midX = Math.floor(w/2);
      for (let y=1;y<h-1;y++) tiles[y][midX] = TILE.FLOOR;
      const exits = [{ x:midX,y:1,dir:'top'}, { x:midX,y:h-2,dir:'bottom'}];
      exits.forEach(e => placeTile(tiles,e.x,e.y,TILE.EXIT));
      return { tiles, meta: { tag: 'corridorV', exits } };
    },

    treasureRoom: (rng) => {
      const w = 17, h = 13;
      const tiles = makeEmptyRoom(w,h);
      const c = centerCoord(w,h);
      tiles[c.y][c.x] = TILE.FLOOR;
      // chest position
      const chest = { x: c.x, y:c.y };
      const exits = [{ x:1,y:c.y,dir:'left' }, { x:w-2,y:c.y,dir:'right' }];
      exits.forEach(e => placeTile(tiles,e.x,e.y,TILE.EXIT));
      return { tiles, meta: { tag: 'treasure', exits, contents: [{type:'chest', pos:chest}] } };
    },

    trapRoom: (rng) => {
      const w = 19, h = 13;
      const tiles = makeEmptyRoom(w,h);
      const c = centerCoord(w,h);
      // place some trap markers (just meta for now)
      const traps = [];
      for (let i=0;i<3;i++){
        const tx = randInt(rng, c.x-3, c.x+3);
        const ty = randInt(rng, c.y-3, c.y+3);
        traps.push({x:tx,y:ty, type: 'spike'});
      }
      const exits = [{ x:1,y:c.y,dir:'left'}, { x:w-2,y:c.y,dir:'right'}];
      exits.forEach(e => placeTile(tiles,e.x,e.y,TILE.EXIT));
      return { tiles, meta: { tag: 'trap', exits, contents: traps } };
    },

    enemyLair: (rng) => {
      const w=23,h=17;
      const tiles = makeEmptyRoom(w,h);
      const c = centerCoord(w,h);
      // spawn 1-4 enemies
      const enemies = [];
      const count = randInt(rng,1,4);
      for (let i=0;i<count;i++){
        enemies.push({ type: 'gob', x: randInt(rng,2,w-3), y: randInt(rng,2,h-3) });
      }
      const exits = [{ x:1,y:c.y,dir:'left' }, { x:w-2,y:c.y,dir:'right'}];
      exits.forEach(e => placeTile(tiles,e.x,e.y,TILE.EXIT));
      return { tiles, meta: { tag: 'lair', exits, contents: enemies } };
    },

    library: (rng) => {
      const w=29,h=19;
      const tiles = makeEmptyRoom(w,h);
      const c = centerCoord(w,h);
      // bookshelf pattern
      for (let y=2;y<h-2;y+=2) for (let x=3;x<w-3;x+=4) tiles[y][x] = TILE.WALL;
      const exits = [{ x:1,y:c.y,dir:'left' }, { x:w-2,y:c.y,dir:'right'}, { x:c.x,y:1,dir:'top'}];
      exits.forEach(e=>placeTile(tiles,e.x,e.y,TILE.EXIT));
      return { tiles, meta: { tag: 'library', exits } };
    },

    armory: (rng) => {
      const w=27,h=17;
      const tiles = makeEmptyRoom(w,h);
      const c = centerCoord(w,h);
      // put weapon racks as walls
      for (let x=3;x<w-3;x+=4) tiles[c.y-2][x] = TILE.WALL;
      const exits = [{ x:1,y:c.y,dir:'left' }, { x:w-2,y:c.y,dir:'right'}];
      exits.forEach(e => placeTile(tiles,e.x,e.y,TILE.EXIT));
      return { tiles, meta: { tag: 'armory', exits } };
    },

    bossAnte: (rng) => {
      const w=33,h=21;
      const tiles = makeEmptyRoom(w,h);
      const c = centerCoord(w,h);
      // big open space with pillars
      for (let y=4;y<h-4;y+=4) for (let x=4;x<w-4;x+=6) tiles[y][x] = TILE.WALL;
      const exits = [{ x:c.x, y:1, dir:'top' }, { x:c.x, y:h-2, dir:'bottom' }];
      exits.forEach(e=>placeTile(tiles,e.x,e.y,TILE.EXIT));
      return { tiles, meta: { tag: 'bossAnte', exits } };
    },

    stairRoom: (rng) => {
      // special room that contains "stair" tile - acts as mandatory to go to next floor
      const w = 21, h = 15;
      const tiles = makeEmptyRoom(w,h);
      const c = centerCoord(w,h);
      // place stair tile in center (we'll use TILE.EXIT so engine treats it like exit)
      tiles[c.y][c.x] = TILE.EXIT; // standing on it should trigger transition
      // normally also allow an ENTRY somewhere
      const exits = [{ x:1,y:c.y,dir:'left' }, { x:w-2,y:c.y,dir:'right' }];
      exits.forEach(e => placeTile(tiles,e.x,e.y,TILE.EXIT));
      return { tiles, meta: { tag: 'stair', exits, contents: [{type:'stair', pos:c}] } };
    }
  };

  // helper: pick a template by weighted randomness
  function pickTemplate(rng, bias = null) {
    // list of template names except start and stair which are chosen deterministically
    const names = ['smallRoom','largeRoom','corridorH','corridorV','treasureRoom','trapRoom','enemyLair','library','armory','bossAnte'];
    const roll = rng();
    // bias can be used for weighting corridors, etc.
    if (bias === 'corridor' && roll < 0.35) return 'corridorH';
    if (bias === 'corridor' && roll < 0.7) return 'corridorV';
    // generic pick
    return names[Math.floor(rng() * names.length)];
  }

  // find tile by direction within a given tileset
  function findTileByDir(tiles, dir) {
    const w = tiles[0].length, h = tiles.length;
    const c = centerCoord(w,h);
    switch (dir) {
      case 'left': return { x:1, y:c.y };
      case 'right': return { x:w-2, y:c.y };
      case 'top': return { x:c.x, y:1 };
      case 'bottom': return { x:c.x, y:h-2 };
    }
    return centerCoord(w,h);
  }

  // connect two rooms: we will mark one side's exit and the other's entry accordingly and return mapping
  function connectRooms(prevRoom, nextRoom, exitInfo) {
    // exitInfo: {x,y,dir} on prevRoom.tiles where there is an EXIT tile
    // determine entry on nextRoom using opposite dir
    const opp = { left:'right', right:'left', top:'bottom', bottom:'top' };
    const wanted = opp[exitInfo.dir] || 'left';
    const entry = findTileByDir(nextRoom.tiles, wanted) || centerCoord(nextRoom.tiles[0].length, nextRoom.tiles.length);
    // mark entry as ENTRY tile
    nextRoom.tiles[entry.y][entry.x] = TILE.ENTRY;
    return { exitPos: { x: exitInfo.x, y: exitInfo.y, dir: exitInfo.dir }, entryPos: entry };
  }

  // --- Core: generate a single floor (andar) ---
  // options:
  //   seedBase: number (for deterministic floors)
  //   roomCount: number total rooms in this floor (including start & stair)
  //   mandatory: array of template names that must exist (e.g. ['startRoom','stairRoom'])
  //   complementCount: number of complementary rooms (auto)
  function generateFloor(opts = {}) {
    const seedBase = opts.seedBase || Math.floor(Math.random()*0xFFFFFFFF);
    const roomCount = Math.max(2, opts.roomCount || 6); // at least start + stair
    const mandatory = opts.mandatory || ['startRoom','stairRoom'];
    const floorIndex = opts.floorIndex || 0;

    // local arrays
    const rooms = []; // { tiles, meta, connection: { parent, fromExit, toEntry }, seed }
    const freeExits = []; // {roomIndex, exitIndex, exitInfo}

    // instantiate start room first
    const startSeed = (seedBase ^ (floorIndex+1) ^ 0x9e3779b9) >>> 0;
    const startRng = mulberry32(startSeed);
    const startTpl = Templates.startRoom(startRng);
    startTpl.meta = startTpl.meta || {};
    startTpl.meta.id = `F${floorIndex}_R0`;
    startTpl.meta.parentFloor = floorIndex;
    startTpl.seed = startSeed;
    rooms.push({ tiles: startTpl.tiles, meta: startTpl.meta, seed: startSeed, contents: startTpl.meta.contents || [] });

    // push its exits to freeExits
    for (let i=0;i<startTpl.meta.exits.length;i++) freeExits.push({ roomIndex: 0, exitIndex: i, exitInfo: startTpl.meta.exits[i] });

    let nextId = 1;
    // prepare to add (roomCount - 1) additional rooms (including stair)
    while (rooms.length < roomCount && freeExits.length > 0) {
      // pick random free exit
      const pickIdx = Math.floor(Math.random() * freeExits.length);
      const slot = freeExits.splice(pickIdx,1)[0];
      const parentRoom = rooms[slot.roomIndex];
      const exitInfo = slot.exitInfo;

      // decide template for new room
      // ensure we place mandatory templates somewhere: if near end guarantee stairRoom
      let chooseName;
      const roomsLeft = roomCount - rooms.length;
      const mustPlaceStair = roomsLeft === 1 && !rooms.some(r=>r.meta.tag==='stair');
      if (mustPlaceStair) chooseName = 'stairRoom';
      else {
        const localSeed = (seedBase ^ (floorIndex+1) ^ (nextId<<8)) >>> 0;
        const rng = mulberry32(localSeed);
        if (rng() < 0.12) chooseName = pickTemplate(rng,'corridor');
        else chooseName = pickTemplate(rng);
      }

      // instantiate template with its own seed
      const tplSeed = (seedBase ^ (floorIndex+1) ^ (nextId*2654435761)) >>> 0;
      const tplRng = mulberry32(tplSeed);
      const tplFactory = Templates[chooseName];
      const tpl = tplFactory ? tplFactory(tplRng) : Templates.smallRoom(tplRng);
      tpl.meta = tpl.meta || {};
      tpl.meta.id = `F${floorIndex}_R${nextId}`;
      tpl.meta.parentFloor = floorIndex;
      tpl.seed = tplSeed;

      // connect prevRoom <-> tpl using exitInfo
      const conn = connectRooms(parentRoom, tpl, exitInfo);
      // store room
      const roomObj = { tiles: tpl.tiles, meta: tpl.meta, seed: tplSeed, connection: { parent: slot.roomIndex, fromExit: conn.exitPos, toEntry: conn.entryPos }, contents: tpl.meta.contents || [] };
      rooms.push(roomObj);
      const newIndex = rooms.length - 1;

      // for each exit of new tpl, if that exit coincides with entry we just made, skip; otherwise add to freeExits
      if (tpl.meta.exits && tpl.meta.exits.length) {
        for (let i=0;i<tpl.meta.exits.length;i++){
          const e = tpl.meta.exits[i];
          if (e.x === conn.entryPos.x && e.y === conn.entryPos.y) continue;
          // ensure exit tile marked
          tpl.tiles[e.y][e.x] = TILE.EXIT;
          freeExits.push({ roomIndex: newIndex, exitIndex: i, exitInfo: e });
        }
      }

      nextId++;
    }

    // If we ended and stair not present, ensure one room is turned into stair
    if (!rooms.some(r => r.meta.tag === 'stair')) {
      // try to pick a random room (not start) to convert into stairRoom
      const candIdx = Math.max(1, Math.floor(Math.random() * rooms.length));
      const room = rooms[candIdx];
      const c = centerCoord(room.tiles[0].length, room.tiles.length);
      room.tiles[c.y][c.x] = TILE.EXIT; // stair tile (engine treats EXIT as transition)
      room.meta.tag = 'stair';
      room.contents = room.contents || [];
      room.contents.push({ type: 'stair', pos: c });
    }

    // final guarantee: every room has at least one EXIT (if not, add one)
    rooms.forEach(r => {
      let hasExit = false;
      for (let y=0;y<r.tiles.length;y++) for (let x=0;x<r.tiles[0].length;x++) if (r.tiles[y][x] === TILE.EXIT) hasExit = true;
      if (!hasExit) {
        const c = centerCoord(r.tiles[0].length, r.tiles.length);
        r.tiles[c.y][r.tiles[0].length-2] = TILE.EXIT;
      }
    });

    // prepare meta for floor
    const floorMeta = rooms.map((r, idx) => ({
      id: r.meta.id || `F${floorIndex}_R${idx}`,
      tag: r.meta.tag || 'room',
      parentFloor: floorIndex,
      connection: r.connection || null,
      seed: r.seed || null,
      contents: r.contents || []
    }));
    return { rooms, meta: floorMeta, seedBase };
  }

  // --- Multi-floor generator ---
  // generate count floors, each with roomCount range (or fixed)
  // returns global structure and also sets window.* compatibility objects
  function generateDungeonFloors(options = {}) {
    const floorsCount = Math.max(1, options.floors || 3);
    const minRooms = Math.max(2, options.minRooms || 4);
    const maxRooms = Math.max(minRooms, options.maxRooms || 8);
    const seedGlobal = options.seed || Math.floor(Math.random()*0xFFFFFFFF);

    const floors = [];
    let globalRoomIndex = 0;
    const flatRooms = []; // flattened tiles
    const flatMeta = [];
    const floorOffsets = []; // start index of each floor in flatRooms

    for (let f = 0; f < floorsCount; f++) {
      const floorSeed = (seedGlobal ^ ((f+1)*0x9e3779b9)) >>> 0;
      const rng = mulberry32(floorSeed);
      const roomCount = options.roomCounts && options.roomCounts[f] ? options.roomCounts[f] : randInt(rng, minRooms, maxRooms);
      const floor = generateFloor({ seedBase: floorSeed, roomCount, floorIndex: f });
      floorOffsets.push(flatRooms.length);
      // append floor rooms to flat list
      for (let r = 0; r < floor.rooms.length; r++) {
        flatRooms.push(copyRoom(floor.rooms[r].tiles));
        flatMeta.push({
          id: floor.meta[r].id,
          tag: floor.meta[r].tag,
          parentFloor: floor.meta[r].parentFloor,
          connection: floor.rooms[r].connection || null,
          seed: floor.rooms[r].seed || null,
          contents: floor.rooms[r].contents || []
        });
        globalRoomIndex++;
      }
      floors.push({ rooms: floor.rooms, meta: floor.meta, seedBase: floor.seedBase });
    }

    // set global window structures expected by engine code
    window.dungeonFloors = floors;               // richer per-floor structure
    window.floorOffsets = floorOffsets;          // mapping floor -> start index in flat arrays
    window.dungeonData = flatRooms;              // backward-compatible array of tile arrays (rooms)
    window.dungeonMeta = flatMeta;
    window.dungeonSeed = seedGlobal;

    // start at floor 0, start room index is floorOffsets[0] (we assume first room of each floor is start)
    window.currentFloorIndex = 0;
    window.currentRoomIndex = window.floorOffsets[0] || 0;
    window.mapData = window.dungeonData[window.currentRoomIndex];
    window.roomWidth = window.mapData[0].length;
    window.roomHeight = window.mapData.length;

    // update UI floor display if element exists
    const floorDom = document.getElementById('dungeon-floor');
    if (floorDom) floorDom.textContent = String(window.currentFloorIndex + 1);

    return {
      floorsCount,
      roomCountTotal: window.dungeonData.length,
      seed: seedGlobal
    };
  }

  // expose API
  window.generateDungeonFloors = generateDungeonFloors;
  window.TEMPLATES = Templates;

  // auto-generate at least one floor to keep behavior similar to before
  if (!window.dungeonData || !window.dungeonData.length) {
    generateDungeonFloors({ floors: 3, minRooms: 5, maxRooms: 8 });
  }
})();
