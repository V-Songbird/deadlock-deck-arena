/* Deadlock Deck: El Reloj Anatómico — tower.js (W3)
 * Procedural floor generation: rooms + corridors (with loops), start, stairs/exit,
 * precomputed critical path, shiftwall candidates (never on the critical path),
 * enemies, traps, pickups, fire seeds. Always solvable.
 *
 * map = {
 *   w, h, floor,
 *   tiles[y][x]   : 'wall' | 'floor' | 'shiftwall' (closed) | 'shiftwall_open' | 'stairs' | 'exit'
 *   rooms[]       : {x,y,w,h,cx,cy}
 *   start {x,y}, goal {x,y,kind:'stairs'|'exit'}
 *   crit[]        : [{x,y}] BFS path start -> goal (never contains a shiftwall)
 *   critSet       : Uint8Array(w*h) 1 on critical path cells
 *   shifts[]      : [{x,y,kind:'wall'|'door'}] toggleable cells
 *   enemies[]     : {id,enemyId,x,y,fx,fy,sx,sy,tx,ty,moving,t,dur,idle,dead,boss,chasing,home,phase}
 *   traps[]       : {x,y,type:'spike'|'acid'|'steam',armed,rearm,known}
 *   pickups[]     : {x,y,kind:'vial'|'coolant'|'suture'|'ether'|'jar',limbId?,taken,phase}
 *   fire, seen, deco : Uint8Array(w*h)   fireList[] : flat indices (may hold stale entries)
 *   player {x,y,facing}, shiftTimer, time, boss
 * }
 */
(function () {
  'use strict';
  const DD = window.DD;

  const W = 41, H = 25;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const WALKABLE = { floor: true, shiftwall_open: true, stairs: true, exit: true };

  function inb(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }

  function walkable(map, x, y) {
    return x >= 0 && y >= 0 && x < map.w && y < map.h && WALKABLE[map.tiles[y][x]] === true;
  }

  function opaque(map, x, y) {
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true;
    const t = map.tiles[y][x];
    return t === 'wall' || t === 'shiftwall';
  }

  // BFS over walkable tiles. Returns { dist:Int16Array(-1 = unreachable), prev:Int32Array }
  function bfs(map, sx, sy) {
    const w = map.w, h = map.h;
    const dist = new Int16Array(w * h).fill(-1);
    const prev = new Int32Array(w * h).fill(-1);
    if (!walkable(map, sx, sy)) return { dist, prev };
    const q = [sy * w + sx];
    dist[sy * w + sx] = 0;
    for (let i = 0; i < q.length; i++) {
      const c = q[i], cx = c % w, cy = (c / w) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
        if (!walkable(map, nx, ny)) continue;
        const n = ny * w + nx;
        if (dist[n] >= 0) continue;
        dist[n] = dist[c] + 1;
        prev[n] = c;
        q.push(n);
      }
    }
    return { dist, prev };
  }

  function pathBetween(map, a, b) {
    const r = bfs(map, a.x, a.y), w = map.w;
    const goal = b.y * w + b.x;
    if (r.dist[goal] < 0) return null;
    const path = [];
    for (let c = goal; c !== -1; c = r.prev[c]) path.push({ x: c % w, y: (c / w) | 0 });
    return path.reverse();
  }

  // ---------------------------------------------------------------- layout

  function mkRoom(x, y, w, h) { return { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) }; }

  function randomRooms(rng) {
    const rooms = [];
    for (let a = 0; a < 400 && rooms.length < 12; a++) {
      const w = rng.int(4, 8), h = rng.int(3, 6);
      const x = rng.int(1, W - 1 - w), y = rng.int(1, H - 1 - h);
      let ok = true;
      for (let i = 0; i < rooms.length; i++) {
        const r = rooms[i];
        if (x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y) { ok = false; break; }
      }
      if (ok) rooms.push(mkRoom(x, y, w, h));
    }
    return rooms.length >= 8 ? rooms : null;
  }

  function gridRooms() { // deterministic fallback: 4x3 grid of 6x4 rooms
    const rooms = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) rooms.push(mkRoom(2 + i * 10, 2 + j * 8, 6, 4));
    return rooms;
  }

  function carveL(tiles, ax, ay, bx, by, horizFirst, out) {
    let x = ax, y = ay;
    function step(nx, ny) {
      x = nx; y = ny;
      if (tiles[y][x] === 'wall') { tiles[y][x] = 'floor'; out.push({ x, y }); }
    }
    if (horizFirst) {
      while (x !== bx) step(x + Math.sign(bx - x), y);
      while (y !== by) step(x, y + Math.sign(by - y));
    } else {
      while (y !== by) step(x, y + Math.sign(by - y));
      while (x !== bx) step(x + Math.sign(bx - x), y);
    }
  }

  function manhattan(a, b) { return Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy); }

  function buildLayout(rng, rooms) {
    const tiles = [];
    for (let y = 0; y < H; y++) { const row = []; for (let x = 0; x < W; x++) row.push('wall'); tiles.push(row); }
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) tiles[y][x] = 'floor';

    const n = rooms.length;
    const linked = {};                       // "i,j" -> true
    const key = (i, j) => (i < j ? i + ',' + j : j + ',' + i);
    const essential = [];                    // cells carved by the spanning tree
    const extra = [];                        // [{cells}] carved by loop corridors

    // spanning tree (Prim, nearest room first)
    const inTree = [0];
    const inSet = { 0: true };
    while (inTree.length < n) {
      let bi = -1, bj = -1, bd = 1e9;
      for (const i of inTree) for (let j = 0; j < n; j++) {
        if (inSet[j]) continue;
        const d = manhattan(rooms[i], rooms[j]) + rng.next() * 6;
        if (d < bd) { bd = d; bi = i; bj = j; }
      }
      inSet[bj] = true; inTree.push(bj);
      linked[key(bi, bj)] = true;
      carveL(tiles, rooms[bi].cx, rooms[bi].cy, rooms[bj].cx, rooms[bj].cy, rng.chance(0.5), essential);
    }

    // loop corridors: each room may link to its nearest room it is not yet linked to
    let loops = 0;
    for (let i = 0; i < n; i++) {
      if (!rng.chance(0.45)) continue;
      let bj = -1, bd = 1e9;
      for (let j = 0; j < n; j++) {
        if (j === i || linked[key(i, j)]) continue;
        const d = manhattan(rooms[i], rooms[j]) + rng.next() * 8;
        if (d < bd) { bd = d; bj = j; }
      }
      if (bj < 0) continue;
      linked[key(i, bj)] = true;
      const cells = [];
      carveL(tiles, rooms[i].cx, rooms[i].cy, rooms[bj].cx, rooms[bj].cy, rng.chance(0.5), cells);
      extra.push({ cells }); loops++;
    }
    for (let a = 0; loops < 3 && a < 40; a++) { // guarantee a few loops
      const i = rng.int(0, n - 1), j = rng.int(0, n - 1);
      if (i === j || linked[key(i, j)]) continue;
      linked[key(i, j)] = true;
      const cells = [];
      carveL(tiles, rooms[i].cx, rooms[i].cy, rooms[j].cx, rooms[j].cy, rng.chance(0.5), cells);
      extra.push({ cells }); loops++;
    }
    return { tiles, essential, extra };
  }

  // ---------------------------------------------------------------- generate

  function generate(floor, rng) {
    rng = rng || DD.rand || DD.RNG(Date.now());
    floor = floor || 1;

    for (let attempt = 0; attempt < 14; attempt++) {
      const rooms = attempt < 12 ? randomRooms(rng) : gridRooms();
      if (!rooms) continue;
      const map = build(floor, rng, rooms);
      if (map) return map;
    }
    return build(floor, rng, gridRooms(), true); // cannot really fail
  }

  function build(floor, rng, rooms, force) {
    const lay = buildLayout(rng, rooms);
    const tiles = lay.tiles;
    const map = {
      w: W, h: H, floor, tiles, rooms,
      start: null, goal: null, crit: [], critSet: new Uint8Array(W * H),
      shifts: [], enemies: [], traps: [], pickups: [],
      fire: new Uint8Array(W * H), fireList: [], seen: new Uint8Array(W * H), deco: new Uint8Array(W * H),
      player: { x: 0, y: 0, facing: 1 }, shiftTimer: 20, time: 0, boss: null
    };

    // start room + farthest room for the goal
    const startRoom = rooms[rng.int(0, rooms.length - 1)];
    map.start = { x: startRoom.cx, y: startRoom.cy };
    const d0 = bfs(map, map.start.x, map.start.y).dist;
    let goalRoom = null, best = -1;
    for (const r of rooms) {
      const d = d0[r.cy * W + r.cx];
      if (d < 0) { if (!force) return null; continue; }
      if (r !== startRoom && d > best) { best = d; goalRoom = r; }
    }
    if (!goalRoom) return null;
    const isExit = floor >= 3;
    map.goal = { x: goalRoom.cx, y: goalRoom.cy, kind: isExit ? 'exit' : 'stairs' };
    tiles[map.goal.y][map.goal.x] = map.goal.kind;

    // critical path start -> goal
    const path = pathBetween(map, map.start, map.goal);
    if (!path) return null;
    map.crit = path;
    for (const c of path) map.critSet[c.y * W + c.x] = 1;

    placeShiftwalls(map, rng, lay, floor);

    // sanity: everything still reachable in the initial state
    const dist = bfs(map, map.start.x, map.start.y).dist;
    if (dist[map.goal.y * W + map.goal.x] < 0) return null;
    for (const r of rooms) if (dist[r.cy * W + r.cx] < 0) return null;

    map.player = { x: map.start.x, y: map.start.y, facing: 1 };
    placeThings(map, rng, floor, d0);
    return map;
  }

  // ---------------------------------------------------------------- shiftwalls

  function straightCell(tiles, x, y, wallKind) {
    // cell must be a 1-wide straight passage: walls on two opposite sides, floor on the other two.
    if (x < 1 || y < 1 || x > W - 2 || y > H - 2) return false;
    const t = (a, b) => tiles[b][a];
    const self = tiles[y][x];
    if (wallKind === 'wall' && self !== 'wall') return false;
    if (wallKind === 'door' && self !== 'floor') return false;
    const L = t(x - 1, y), R = t(x + 1, y), U = t(x, y - 1), D = t(x, y + 1);
    return (L === 'wall' && R === 'wall' && U === 'floor' && D === 'floor') ||
           (U === 'wall' && D === 'wall' && L === 'floor' && R === 'floor');
  }

  function placeShiftwalls(map, rng, lay, floor) {
    const tiles = map.tiles, crit = map.critSet;
    const free = (c) => !crit[c.y * W + c.x];

    // A) thin walls between two floors: opening them creates shortcuts / loops
    const wallCands = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (!crit[y * W + x] && straightCell(tiles, x, y, 'wall')) wallCands.push({ x, y });
    }
    // B) doors inside corridors (essential ones start open, loop ones start closed)
    const essCands = lay.essential.filter(free).filter(c => straightCell(tiles, c.x, c.y, 'door'));
    const extraCands = [];
    for (const corr of lay.extra) for (const c of corr.cells) {
      if (free(c) && straightCell(tiles, c.x, c.y, 'door')) extraCands.push(c);
    }
    rng.shuffle(wallCands); rng.shuffle(essCands); rng.shuffle(extraCands);

    function take(list, cap, kind, state) {
      let placed = 0;
      for (const c of list) {
        if (placed >= cap) break;
        // re-check: neighbours must not already be shiftwalls (keeps them spread out)
        if (!straightCell(tiles, c.x, c.y, kind)) continue;
        const st = typeof state === 'function' ? state() : state;
        tiles[c.y][c.x] = st;
        map.shifts.push({ x: c.x, y: c.y, kind });
        placed++;
      }
    }
    take(wallCands, 9 + floor * 3, 'wall', () => (rng.chance(0.5) ? 'shiftwall' : 'shiftwall_open'));
    take(essCands, 5, 'door', 'shiftwall_open');
    take(extraCands, 6, 'door', 'shiftwall');
  }

  // ---------------------------------------------------------------- entities

  function placeThings(map, rng, floor, d0) {
    const tiles = map.tiles;
    const used = {};
    const idx = (x, y) => y * W + x;
    const mark = (x, y) => { used[idx(x, y)] = true; };
    mark(map.start.x, map.start.y); mark(map.goal.x, map.goal.y);

    // candidate cells: plain floor only (never shiftwall / stairs)
    const roomCells = [], allCells = [];
    const inRoom = new Uint8Array(W * H);
    for (const r of map.rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) inRoom[idx(x, y)] = 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (tiles[y][x] !== 'floor') continue;
      if (d0[idx(x, y)] < 0) continue;
      allCells.push({ x, y });
      if (inRoom[idx(x, y)]) roomCells.push({ x, y });
    }
    const near = (c, o, d) => Math.abs(c.x - o.x) + Math.abs(c.y - o.y) < d;

    function pick(cells, ok) {
      const list = cells.filter(c => !used[idx(c.x, c.y)] && ok(c));
      if (!list.length) return null;
      const c = rng.pick(list);
      mark(c.x, c.y);
      return c;
    }

    // --- boss (floor 3): next to the exit, on the approach cell
    if (floor >= 3 && DD.ENEMIES && DD.ENEMIES.rector) {
      let bc = null;
      const p = map.crit;
      if (p.length >= 2) {
        const c = p[p.length - 2];
        if (tiles[c.y][c.x] === 'floor') bc = c;
      }
      if (!bc) {
        for (const d of DIRS) {
          const nx = map.goal.x + d[0], ny = map.goal.y + d[1];
          if (tiles[ny][nx] === 'floor') { bc = { x: nx, y: ny }; break; }
        }
      }
      if (bc) { mark(bc.x, bc.y); map.boss = makeEnemy(map, 'rector', bc.x, bc.y, true, rng); map.enemies.push(map.boss); }
    }

    // --- enemies
    const pool = [];
    if (DD.ENEMIES) for (const k of Object.keys(DD.ENEMIES)) {
      const e = DD.ENEMIES[k];
      if (e && !e.boss && (e.floorMin || 1) <= floor) pool.push(e.id || k);
    }
    if (!pool.length) pool.push('homunculo');
    const nEnemies = 4 + 2 * floor;
    for (let i = 0; i < nEnemies; i++) {
      let c = pick(roomCells, c => d0[idx(c.x, c.y)] >= 9 && !near(c, map.goal, 3));
      if (!c) c = pick(allCells, c => d0[idx(c.x, c.y)] >= 6);
      if (!c) break;
      map.enemies.push(makeEnemy(map, rng.pick(pool), c.x, c.y, false, rng));
    }

    // --- traps
    const nTraps = 5 + 2 * floor, types = ['spike', 'acid', 'steam'];
    for (let i = 0; i < nTraps; i++) {
      const c = pick(allCells, c => !near(c, map.start, 4) && !near(c, map.goal, 2));
      if (!c) break;
      map.traps.push({ x: c.x, y: c.y, type: types[rng.int(0, 2)], armed: true, rearm: 0, known: false });
    }

    // --- pickups
    function addPickup(kind, ok, limbId) {
      const c = pick(roomCells, ok) || pick(allCells, ok);
      if (!c) return;
      const p = { x: c.x, y: c.y, kind, taken: false, phase: rng.next() * 6.28 };
      if (limbId) p.limbId = limbId;
      map.pickups.push(p);
    }
    const any = () => true;
    for (let i = 0; i < 3; i++) addPickup('vial', any);
    for (let i = 0; i < 2; i++) addPickup('coolant', any);
    for (let i = 0; i < 2; i++) addPickup('suture', any);
    for (let i = 0; i < 4 + floor; i++) addPickup('ether', any);
    const limbIds = DD.LIMBS ? Object.keys(DD.LIMBS) : [];
    const jars = rng.int(1, 2);
    for (let i = 0; i < jars && limbIds.length; i++) {
      addPickup('jar', c => d0[idx(c.x, c.y)] >= 6 && !near(c, map.goal, 2), rng.pick(limbIds));
    }

    // --- fire seeds, far from the start
    const nFire = 2 + floor;
    for (let i = 0; i < nFire; i++) {
      const c = pick(allCells, c => d0[idx(c.x, c.y)] >= 14 && !near(c, map.goal, 3));
      if (!c) break;
      map.fire[idx(c.x, c.y)] = 1; map.fireList.push(idx(c.x, c.y));
    }

    // --- rubble decoration (cosmetic)
    for (const c of roomCells) {
      if (!used[idx(c.x, c.y)] && rng.chance(0.06)) map.deco[idx(c.x, c.y)] = 1;
    }
  }

  let enemyCounter = 0;
  function makeEnemy(map, enemyId, x, y, boss, rng) {
    return {
      id: 'e' + (++enemyCounter), enemyId, x, y, fx: x, fy: y, sx: x, sy: y, tx: x, ty: y,
      moving: false, t: 0, dur: 0.5, idle: 0.3 + rng.next() * 1.2, dead: false, boss: !!boss,
      chasing: false, home: { x, y }, phase: rng.next() * 6.28, dirx: 0, diry: 0
    };
  }

  DD.tower = { W, H, generate, walkable, opaque, bfs, pathBetween, DIRS };
})();
