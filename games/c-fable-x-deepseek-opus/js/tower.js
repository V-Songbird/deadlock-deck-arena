// The procedural burning tower: floors of maze cells with rooms. Owner: TOWER worker. Pure logic.
// Spec: PRODUCT.md §5.2. Depends only on DATA. Use Math.random.
const Tower = {
  DIRS: {
    n: { dx: 0, dy: -1, opp: 's' },
    e: { dx: 1, dy: 0, opp: 'w' },
    s: { dx: 0, dy: 1, opp: 'n' },
    w: { dx: -1, dy: 0, opp: 'e' },
  },

  /**
   * Build DATA.FLOORS floors of DATA.FLOOR_W x DATA.FLOOR_H cells.
   * @returns {{floors: {index:number, w:number, h:number, cells:Object[][], start:{x:number,y:number}, exit:{x:number,y:number}}[]}}
   * cell = { x, y, type: DATA.ROOM.*, walls:{n,e,s,w}, content: enemyId|resourceId|null, visited:false, seen:false }
   */
  generate() {
    const floors = [];
    for (let i = 0; i < DATA.FLOORS; i++) floors.push(this._makeFloor(i));
    return { floors: floors };
  },

  /** @returns {Object|null} the cell at (x,y) or null when outside */
  cell(F, x, y) {
    if (!F || !F.cells) return null;
    if (x < 0 || y < 0 || x >= F.w || y >= F.h) return null;
    const row = F.cells[y];
    return row ? row[x] : null;
  },

  /** @param {'n'|'e'|'s'|'w'} dir @returns {boolean} target inside bounds and no wall on that side */
  canMove(F, x, y, dir) {
    const here = this.cell(F, x, y);
    const d = this.DIRS[dir];
    if (!here || !d) return false;
    if (here.walls[dir]) return false;
    return this.cell(F, x + d.dx, y + d.dy) !== null;
  },

  /** Mark (x,y) visited and every cell within Chebyshev distance 1 (itself included) seen. */
  reveal(F, x, y) {
    const here = this.cell(F, x, y);
    if (!here) return;
    here.visited = true;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = this.cell(F, x + dx, y + dy);
        if (c) c.seen = true;
      }
    }
  },

  /** The labyrinth shifts: carve a brand-new perfect maze (walls only); types, contents, visited, seen, start and exit stay. */
  shift(F) {
    if (!F || !F.cells) return;
    for (let y = 0; y < F.h; y++) {
      for (let x = 0; x < F.w; x++) {
        const c = F.cells[y][x];
        if (!c || !c.walls) continue;
        c.walls.n = true;
        c.walls.e = true;
        c.walls.s = true;
        c.walls.w = true;
      }
    }
    this._carve(F);
  },

  /**
   * Turn a random EMPTY, unvisited cell that is not (px,py) into an ENEMY room with pickEnemy(F.index).
   * @returns {Object|null} the cell, or null when no cell qualifies
   */
  spawnEnemy(F, px, py) {
    const free = this._freeCells(F, px, py);
    if (free.length === 0) return null;
    const id = this.pickEnemy(F.index);
    if (!id) return null;
    const chosen = free[Math.floor(Math.random() * free.length)];
    chosen.type = DATA.ROOM.ENEMY;
    chosen.content = id;
    return chosen;
  },

  /** @returns {string} a random DATA.enemies id with floorMin <= floorIndex */
  pickEnemy(floorIndex) {
    const table = DATA.enemies || {};
    const ids = [];
    for (const id in table) {
      const enemy = table[id];
      if (enemy && (enemy.floorMin || 0) <= floorIndex) ids.push(id);
    }
    if (ids.length === 0) return null;
    return ids[Math.floor(Math.random() * ids.length)];
  },

  // ---- private helpers -------------------------------------------------------

  /** One floor: empty grid, perfect maze, loops, start, stairs/exit, population. */
  _makeFloor(index) {
    const w = DATA.FLOOR_W;
    const h = DATA.FLOOR_H;
    const cells = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        row.push({
          x: x,
          y: y,
          type: DATA.ROOM.EMPTY,
          walls: { n: true, e: true, s: true, w: true },
          content: null,
          visited: false,
          seen: false,
        });
      }
      cells.push(row);
    }
    const F = { index: index, w: w, h: h, cells: cells, start: { x: 0, y: 0 }, exit: { x: 0, y: 0 } };

    this._carve(F);       // perfect maze
    this._openLoops(F);   // ~15% of the remaining inner walls fall, creating loops

    // the run always begins on the bottom row
    const start = this.cell(F, Math.floor(Math.random() * w), h - 1);
    start.type = DATA.ROOM.START;
    F.start = { x: start.x, y: start.y };

    // the farthest cell from the start is the way up (or the way out on the last floor)
    const far = this._farCell(F, start);
    far.type = index >= DATA.FLOORS - 1 ? DATA.ROOM.EXIT : DATA.ROOM.STAIRS;
    F.exit = { x: far.x, y: far.y };

    this._populate(F);
    return F;
  },

  /** Recursive backtracker: open passages until every cell is part of one perfect maze. */
  _carve(F) {
    const order = ['n', 'e', 's', 'w'];
    const seen = [];
    for (let y = 0; y < F.h; y++) {
      const row = [];
      for (let x = 0; x < F.w; x++) row.push(false);
      seen.push(row);
    }
    const startX = Math.floor(Math.random() * F.w);
    const startY = Math.floor(Math.random() * F.h);
    const stack = [F.cells[startY][startX]];
    seen[startY][startX] = true;
    while (stack.length > 0) {
      const cur = stack[stack.length - 1];
      const options = [];
      for (let i = 0; i < order.length; i++) {
        const d = this.DIRS[order[i]];
        const nx = cur.x + d.dx;
        const ny = cur.y + d.dy;
        if (nx < 0 || ny < 0 || nx >= F.w || ny >= F.h) continue;
        if (seen[ny][nx]) continue;
        options.push(order[i]);
      }
      if (options.length === 0) {
        stack.pop();
        continue;
      }
      const dir = options[Math.floor(Math.random() * options.length)];
      const d = this.DIRS[dir];
      const next = F.cells[cur.y + d.dy][cur.x + d.dx];
      cur.walls[dir] = false;
      next.walls[d.opp] = false;
      seen[next.y][next.x] = true;
      stack.push(next);
    }
  },

  /** Open about 15% of the inner walls still standing, so the maze gets loops. */
  _openLoops(F) {
    const candidates = [];
    for (let y = 0; y < F.h; y++) {
      for (let x = 0; x < F.w; x++) {
        const c = F.cells[y][x];
        if (c.walls.e && this.cell(F, x + 1, y)) candidates.push({ x: x, y: y, dir: 'e' });
        if (c.walls.s && this.cell(F, x, y + 1)) candidates.push({ x: x, y: y, dir: 's' });
      }
    }
    this._shuffle(candidates);
    const open = Math.round(candidates.length * 0.15);
    for (let i = 0; i < open && i < candidates.length; i++) {
      const spot = candidates[i];
      const d = this.DIRS[spot.dir];
      const a = F.cells[spot.y][spot.x];
      const b = F.cells[spot.y + d.dy][spot.x + d.dx];
      a.walls[spot.dir] = false;
      b.walls[d.opp] = false;
    }
  },

  /** @returns {Object} the cell farthest from `from` walking open passages (BFS distance). */
  _farCell(F, from) {
    const dist = [];
    for (let y = 0; y < F.h; y++) {
      const row = [];
      for (let x = 0; x < F.w; x++) row.push(-1);
      dist.push(row);
    }
    const order = ['n', 'e', 's', 'w'];
    const queue = [from];
    dist[from.y][from.x] = 0;
    let best = from;
    let bestDist = 0;
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i];
      const step = dist[cur.y][cur.x] + 1;
      for (let k = 0; k < order.length; k++) {
        const dir = order[k];
        if (cur.walls[dir]) continue;
        const d = this.DIRS[dir];
        const nx = cur.x + d.dx;
        const ny = cur.y + d.dy;
        if (nx < 0 || ny < 0 || nx >= F.w || ny >= F.h) continue;
        if (dist[ny][nx] !== -1) continue;
        dist[ny][nx] = step;
        if (step > bestDist) {
          bestDist = step;
          best = F.cells[ny][nx];
        }
        queue.push(F.cells[ny][nx]);
      }
    }
    return best;
  },

  /** Fill the floor with DATA.FLOOR_POP[index] rooms on random EMPTY cells. */
  _populate(F) {
    const pop = DATA.FLOOR_POP && DATA.FLOOR_POP[F.index];
    if (!pop) return;
    const free = this._freeCells(F, null, null);
    this._shuffle(free);
    let taken = 0;
    for (let n = 0; n < (pop.enemies || 0); n++) {
      if (taken >= free.length) return;
      const id = this.pickEnemy(F.index);
      if (!id) break;
      const c = free[taken++];
      c.type = DATA.ROOM.ENEMY;
      c.content = id;
    }
    for (let n = 0; n < (pop.resources || 0); n++) {
      if (taken >= free.length) return;
      const id = this._pickResource();
      if (!id) break;
      const c = free[taken++];
      c.type = DATA.ROOM.RESOURCE;
      c.content = id;
    }
    for (let n = 0; n < (pop.traps || 0); n++) {
      if (taken >= free.length) return;
      const c = free[taken++];
      c.type = DATA.ROOM.TRAP;
      c.content = null;
    }
  },

  /** @param {number|null} px @param {number|null} py the cell to skip, when given */
  _freeCells(F, px, py) {
    const free = [];
    if (!F || !F.cells) return free;
    for (let y = 0; y < F.h; y++) {
      for (let x = 0; x < F.w; x++) {
        const c = F.cells[y][x];
        if (!c || c.type !== DATA.ROOM.EMPTY) continue;
        if (c.visited) continue;
        if (px !== null && py !== null && x === px && y === py) continue;
        free.push(c);
      }
    }
    return free;
  },

  /** @returns {string|null} a DATA.resources id, drawn with its `weight` as spawn weight */
  _pickResource() {
    const table = DATA.resources || {};
    const ids = [];
    let total = 0;
    for (const id in table) {
      const res = table[id];
      if (!res) continue;
      const weight = res.weight > 0 ? res.weight : 0;
      ids.push(id);
      total += weight;
    }
    if (ids.length === 0) return null;
    if (total <= 0) return ids[Math.floor(Math.random() * ids.length)];
    let roll = Math.random() * total;
    for (let i = 0; i < ids.length; i++) {
      roll -= table[ids[i]].weight > 0 ? table[ids[i]].weight : 0;
      if (roll < 0) return ids[i];
    }
    return ids[ids.length - 1];
  },

  /** Fisher-Yates, in place. */
  _shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  },
};
