// REWORK

(function () {
  const TILE = window.TILE;
  const TILE_SIZE = window.TILE_SIZE;

  class GameEngine {
    constructor() {
      this.state = {
        scene: "village",
        log: [],
        visitedRooms: new Set(),
      };

      this.canvas = null;
      this.ctx = null;
      this.logElement = null;
      this.keys = {};

      this.lastTime = 0;
      this.lastTile = null;
    }

    clamp(v, a, b) {
      return Math.max(a, Math.min(b, v));
    }

    addToLog(message) {
      if (!this.logElement) return;

      const last = this.state.log[this.state.log.length - 1];
      if (last === message) return;

      this.state.log.push(message);
      if (this.state.log.length > 12) this.state.log.shift();

      this.logElement.innerHTML = this.state.log
        .map((m) => `<p>${m}</p>`)
        .join("");
      this.logElement.scrollTop = this.logElement.scrollHeight;
    }

    init() {
      this.canvas = document.getElementById("game-canvas");
      this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
      this.logElement = document.getElementById("ui-log");

      if (!this.canvas || !this.ctx || !this.logElement) {
        console.error("Elementos do DOM não encontrados!");
        return;
      }

      this.canvas.width = window.CANVAS_WIDTH || this.canvas.width;
      this.canvas.height = window.CANVAS_HEIGHT || this.canvas.height;

      if (window.Renderer) {
        window.Renderer.init(this.canvas);
        window.Renderer.setCameraTarget(window.entities.player);
      }

      window.addEventListener("keydown", (e) => {
        this.keys[e.key] = true;
      });
      window.addEventListener("keyup", (e) => {
        this.keys[e.key] = false;
      });

      if (typeof window.initEntities === "function") {
        window.initEntities();
      } else {
        console.warn("initEntities não disponível no momento.");
      }

      this.addToLog("Você está na vila. Use as setas/WASD para mover.");

      this.lastTime = performance.now();
      requestAnimationFrame((ts) => this.loop(ts));
    }

    update(dt) {
      const player = window.entities.player;
      let dx = 0,
        dy = 0;

      if (this.keys.ArrowUp || this.keys.w || this.keys.W) dy -= 1;
      if (this.keys.ArrowDown || this.keys.s || this.keys.S) dy += 1;
      if (this.keys.ArrowLeft || this.keys.a || this.keys.A) dx -= 1;
      if (this.keys.ArrowRight || this.keys.d || this.keys.D) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy) || 1;
        const newX =
          player.x + (dx / len) * player.speed * dt;
        const newY =
          player.y + (dy / len) * player.speed * dt;

        if (!this.checkCollision(newX - player.w / 2, newY - player.h / 2, player.w, player.h)) {
          player.x = this.clamp(newX, 0 + player.w / 2, this.canvas.width - player.w / 2);
          player.y = this.clamp(newY, 0 + player.h / 2, this.canvas.height - player.h / 2);
        }

        const tx = Math.floor(player.x / TILE_SIZE),
          ty = Math.floor(player.y / TILE_SIZE);

        if (!this.lastTile || this.lastTile[0] !== tx || this.lastTile[1] !== ty) {
          this.lastTile = [tx, ty];
          this.addToLog(`Você se moveu para (${Math.round(player.x)}, ${Math.round(player.y)}).`);
          this.checkRoomTransition(player.x, player.y);
        }
      }

      if (typeof window.updateEntities === "function") {
        window.updateEntities(dt);
      }
    }

    render() {
      if (!this.ctx) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      renderer.drawMap(this.ctx, window.mapData);
      renderer.drawEntities(this.ctx, window.entities);
      // renderer.debugOverlay(this.ctx, window.mapData, window.dungeonMeta[window.currentRoomIndex]);
    }

    loop(timestamp) {
      const dt = Math.min(0.05, (timestamp - this.lastTime) / 1000);
      this.lastTime = timestamp;

      this.update(dt);
      this.render();

      requestAnimationFrame((ts) => this.loop(ts));
    }

    checkCollision(x, y, w, h) {
      const tileSize = TILE_SIZE;
      const startX = Math.floor(x / tileSize);
      const endX = Math.floor((x + w) / tileSize);
      const startY = Math.floor(y / tileSize);
      const endY = Math.floor((y + h) / tileSize);

      const grid = window.mapData;
      if (!grid) return false;

      for (let ty = startY; ty <= endY; ty++) {
        for (let tx = startX; tx <= endX; tx++) {
          if (
            ty < 0 ||
            ty >= grid.length ||
            tx < 0 ||
            tx >= grid[0].length
          )
            return true;
          if (grid[ty][tx] === TILE.WALL) return true;
        }
      }
      return false;
    }

    checkRoomTransition(px, py) {
      const tx = Math.floor(px / TILE_SIZE);
      const ty = Math.floor(py / TILE_SIZE);
      const grid = window.mapData;

      if (!grid) return;

      if (tx >= 0 && tx < grid[0].length && ty >= 0 && ty < grid.length) {
        const tile = grid[ty][tx];

        if (tile === TILE.EXIT) {
          this.handleRoomAdvance();
        } else if (
          tile === TILE.ENTRY &&
          this.state.visitedRooms.has(window.currentRoomIndex - 1)
        ) {
          this.handleRoomReturn();
        }
      }
    }

    handleRoomAdvance() {
      const nextIndex = (window.currentRoomIndex || 0) + 1;

      if (nextIndex < (window.dungeonData ? window.dungeonData.length : 0)) {
        this.state.visitedRooms.add(window.currentRoomIndex);
        window.currentRoomIndex = nextIndex;
        window.mapData = window.dungeonData[window.currentRoomIndex];

        this.placePlayerAtEntry() || this.placePlayerAtCenter();

        this.addToLog("Você entrou em uma nova sala!");
        if (typeof window.initEntities === "function") window.initEntities();
      } else {
        this.addToLog("Fim da dungeon alcançado!");
      }
    }

    handleRoomReturn() {
      window.currentRoomIndex -= 1;
      window.mapData = window.dungeonData[window.currentRoomIndex];

      const prevRoom = window.dungeonMeta[window.currentRoomIndex];
      if (prevRoom && prevRoom.connection) {
        window.entities.player.x =
          prevRoom.connection.toEntry.x * TILE_SIZE + TILE_SIZE / 2;
        window.entities.player.y =
          prevRoom.connection.toEntry.y * TILE_SIZE + TILE_SIZE / 2;
      }

      this.addToLog("Você voltou à sala anterior!");
      if (typeof window.initEntities === "function") window.initEntities();
    }

    placePlayerAtEntry() {
      for (let y = 0; y < window.mapData.length; y++) {
        for (let x = 0; x < window.mapData[0].length; x++) {
          if (window.mapData[y][x] === TILE.ENTRY) {
            window.entities.player.x = x * TILE_SIZE + TILE_SIZE / 2;
            window.entities.player.y = y * TILE_SIZE + TILE_SIZE / 2;
            this.lastTile = [x, y];
            return true;
          }
        }
      }
      return false;
    }

    placePlayerAtCenter() {
      const cx = Math.floor(window.mapData[0].length / 2);
      const cy = Math.floor(window.mapData.length / 2);
      window.entities.player.x = cx * TILE_SIZE + TILE_SIZE / 2;
      window.entities.player.y = cy * TILE_SIZE + TILE_SIZE / 2;
      this.lastTile = [cx, cy];
    }
  }

  const engine = new GameEngine();
  window.initGame = () => engine.init();
})();
