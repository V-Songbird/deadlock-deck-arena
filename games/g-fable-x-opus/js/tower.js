// P5 Tower: procedural floors (rooms + corridors), fog of war and pathing. Pure logic, no drawing.
window.Tower = (function () {
  var W = 24, H = 14;
  var T = { WALL: 0, FLOOR: 1, EXIT: 2 };
  var DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
  var RESOURCE_WEIGHTS = [['coolant', 35], ['suture', 30], ['ichor', 25], ['clockwork', 10]];
  var MIN_ENEMY_DIST = 4;   // BFS distance from start required for enemies (spec 5.5)

  // --- local rnd helpers (Tower depends on Data only; rnd is always the passed function) ---
  function irange(rnd, min, max) { return min + Math.floor(rnd() * (max - min + 1)); }
  function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }
  function shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)), t = arr[i];
      arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function weighted(rnd, table) {
    var total = 0, i;
    for (i = 0; i < table.length; i++) total += table[i][1];
    var r = rnd() * total;
    for (i = 0; i < table.length; i++) { r -= table[i][1]; if (r < 0) return table[i][0]; }
    return table[table.length - 1][0];
  }

  // --- grid helpers ---
  function idx(x, y) { return y * W + x; }
  function get(floor, x, y) {
    if (x < 0 || y < 0 || x >= floor.w || y >= floor.h) return T.WALL;
    return floor.tiles[y * floor.w + x];
  }
  function walkable(floor, x, y) { var t = get(floor, x, y); return t === T.FLOOR || t === T.EXIT; }

  function bfs(floor, sx, sy) {
    var n = floor.w * floor.h, dist = new Array(n).fill(-1);
    if (!walkable(floor, sx, sy)) return dist;
    var q = [sy * floor.w + sx];
    dist[q[0]] = 0;
    for (var h = 0; h < q.length; h++) {
      var i = q[h], x = i % floor.w, y = (i / floor.w) | 0, d = dist[i] + 1;
      for (var k = 0; k < 4; k++) {
        var nx = x + DX[k], ny = y + DY[k];
        if (!walkable(floor, nx, ny)) continue;
        var ni = ny * floor.w + nx;
        if (dist[ni] >= 0) continue;
        dist[ni] = d; q.push(ni);
      }
    }
    return dist;
  }

  function reachable(floor, from, to) {
    if (!walkable(floor, from.x, from.y) || !walkable(floor, to.x, to.y)) return false;
    if (from.x === to.x && from.y === to.y) return true;
    return bfs(floor, from.x, from.y)[to.y * floor.w + to.x] >= 0;
  }

  function reveal(floor, x, y, radius) {
    var r2 = radius * radius;
    var y0 = Math.max(0, y - radius), y1 = Math.min(floor.h - 1, y + radius);
    var x0 = Math.max(0, x - radius), x1 = Math.min(floor.w - 1, x + radius);
    for (var yy = y0; yy <= y1; yy++) {
      for (var xx = x0; xx <= x1; xx++) {
        var dx = xx - x, dy = yy - y;
        if (dx * dx + dy * dy <= r2) floor.seen[yy * floor.w + xx] = true;
      }
    }
  }

  // --- carving (keeps the outer ring WALL and never overwrites the exit) ---
  function setFloor(tiles, x, y) {
    if (x < 1 || y < 1 || x > W - 2 || y > H - 2) return;
    var i = idx(x, y);
    if (tiles[i] !== T.EXIT) tiles[i] = T.FLOOR;
  }
  function carveH(tiles, x0, x1, y) {
    var a = Math.min(x0, x1), b = Math.max(x0, x1);
    for (var x = a; x <= b; x++) setFloor(tiles, x, y);
  }
  function carveV(tiles, y0, y1, x) {
    var a = Math.min(y0, y1), b = Math.max(y0, y1);
    for (var y = a; y <= b; y++) setFloor(tiles, x, y);
  }
  function carveL(tiles, a, b, rnd) {
    if (rnd() < 0.5) { carveH(tiles, a.x, b.x, a.y); carveV(tiles, a.y, b.y, b.x); }
    else { carveV(tiles, a.y, b.y, a.x); carveH(tiles, a.x, b.x, b.y); }
  }

  // --- rooms ---
  function center(r) { return { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) }; }
  function tooClose(a, b) {   // needs at least one wall tile between rooms
    return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
  }
  function placeRooms(rnd) {
    var target = irange(rnd, 5, 8), rooms = [], attempts = 0;
    while (rooms.length < target && attempts++ < 200) {
      var r = { w: irange(rnd, 3, 7), h: irange(rnd, 3, 5), x: 0, y: 0 };
      r.x = irange(rnd, 1, W - 1 - r.w);
      r.y = irange(rnd, 1, H - 1 - r.h);
      var bad = false;
      for (var i = 0; i < rooms.length; i++) if (tooClose(r, rooms[i])) { bad = true; break; }
      if (!bad) rooms.push(r);
    }
    return rooms;
  }

  // Full room/corridor layout on an empty grid.
  function buildLayout(rnd) {
    var rooms = [], i;
    for (i = 0; i < 10 && rooms.length < 2; i++) rooms = placeRooms(rnd);
    var tiles = new Array(W * H).fill(T.WALL);
    for (i = 0; i < rooms.length; i++) {
      var r = rooms[i];
      for (var y = r.y; y < r.y + r.h; y++) for (var x = r.x; x < r.x + r.w; x++) setFloor(tiles, x, y);
    }
    for (i = 1; i < rooms.length; i++) carveL(tiles, center(rooms[i - 1]), center(rooms[i]), rnd);
    var extra = irange(rnd, 1, 2);   // extra corridors create loops
    for (i = 0; i < extra; i++) {
      var a = pick(rooms, rnd), b = pick(rooms, rnd);
      if (a !== b) carveL(tiles, center(a), center(b), rnd);
    }
    return { tiles: tiles, rooms: rooms };
  }

  function makeDecor(rnd) {
    var d = new Array(W * H);
    for (var i = 0; i < d.length; i++) { var r = rnd(); d[i] = r < 0.7 ? 0 : (r < 0.9 ? 1 : 2); }
    return d;
  }

  function corridorTile(floor, i) {
    var x = i % W, y = (i / W) | 0, n = 0;
    for (var k = 0; k < 4; k++) if (walkable(floor, x + DX[k], y + DY[k])) n++;
    return n === 2;
  }

  // Take a random pool entry matching pred (the pool is pre-shuffled). -1 when none matches.
  function take(pool, pred) {
    for (var i = 0; i < pool.length; i++) if (!pred || pred(pool[i])) return pool.splice(i, 1)[0];
    return -1;
  }

  function build(rnd, floorIndex) {
    var layout = buildLayout(rnd), rooms = layout.rooms, i, x, y;
    var floor = {
      w: W, h: H, tiles: layout.tiles,
      seen: new Array(W * H).fill(false),
      decor: makeDecor(rnd),
      start: null, exit: null, entities: [], floorIndex: floorIndex
    };

    var r0 = rooms[0];
    floor.start = { x: irange(rnd, r0.x, r0.x + r0.w - 1), y: irange(rnd, r0.y, r0.y + r0.h - 1) };
    var dist = bfs(floor, floor.start.x, floor.start.y);

    // Exit room: the room whose center is farthest from start; exit: its farthest floor tile.
    var exitRoom = rooms[0], best = -1;
    for (i = 0; i < rooms.length; i++) {
      var c = center(rooms[i]), d = dist[idx(c.x, c.y)];
      if (d > best) { best = d; exitRoom = rooms[i]; }
    }
    var ex = null, bestTile = -1;
    for (y = exitRoom.y; y < exitRoom.y + exitRoom.h; y++) {
      for (x = exitRoom.x; x < exitRoom.x + exitRoom.w; x++) {
        var ri = idx(x, y);
        if (floor.tiles[ri] !== T.FLOOR || (x === floor.start.x && y === floor.start.y)) continue;
        if (dist[ri] > bestTile) { bestTile = dist[ri]; ex = { x: x, y: y }; }
      }
    }
    if (!ex) {   // fallback: farthest floor tile anywhere
      for (i = 0; i < floor.tiles.length; i++) {
        if (floor.tiles[i] !== T.FLOOR) continue;
        x = i % W; y = (i / W) | 0;
        if (x === floor.start.x && y === floor.start.y) continue;
        if (dist[i] > bestTile) { bestTile = dist[i]; ex = { x: x, y: y }; }
      }
    }
    floor.exit = ex;
    floor.tiles[idx(ex.x, ex.y)] = T.EXIT;

    var last = floorIndex === Data.CONFIG.floors - 1;
    var counts = Data.FLOOR_COUNTS[floorIndex] || { enemies: 0, resources: 0, traps: 0 };
    var pool = [];
    for (i = 0; i < floor.tiles.length; i++) {
      if (floor.tiles[i] !== T.FLOOR) continue;   // walls and the exit are out
      x = i % W; y = (i / W) | 0;
      if (x === floor.start.x && y === floor.start.y) continue;
      // keep the exit neighbourhood free so the guardian always gets its own tile
      if (last && Math.abs(x - ex.x) + Math.abs(y - ex.y) === 1) continue;
      pool.push(i);
    }
    shuffle(pool, rnd);

    function push(type, id, at) { floor.entities.push({ type: type, id: id, x: at % W, y: (at / W) | 0 }); }
    function farEnough(p) { return dist[p] >= MIN_ENEMY_DIST; }
    function isCorridor(p) { return corridorTile(floor, p); }

    var enemyIds = Data.FLOOR_ENEMIES[floorIndex] || [];
    for (i = 0; i < counts.enemies && enemyIds.length; i++) {
      var ei = take(pool, farEnough);
      if (ei < 0) break;
      push('enemy', pick(enemyIds, rnd), ei);
    }
    for (i = 0; i < counts.resources; i++) {
      var si = take(pool, null);
      if (si < 0) break;
      push('resource', weighted(rnd, RESOURCE_WEIGHTS), si);
    }
    var trapIds = Object.keys(Data.TRAPS);
    for (i = 0; i < counts.traps && trapIds.length; i++) {
      var ti = take(pool, isCorridor);   // traps prefer corridors
      if (ti < 0) ti = take(pool, null);
      if (ti < 0) break;
      push('trap', pick(trapIds, rnd), ti);
    }

    if (last) {
      var gx = -1, gy = -1, wx = -1, wy = -1;
      for (i = 0; i < 4; i++) {
        var nx = ex.x + DX[i], ny = ex.y + DY[i];
        if (nx < 1 || ny < 1 || nx > W - 2 || ny > H - 2) continue;
        if (walkable(floor, nx, ny)) { if (gx < 0) { gx = nx; gy = ny; } }
        else if (wx < 0) { wx = nx; wy = ny; }
      }
      if (gx < 0 && wx >= 0) { floor.tiles[idx(wx, wy)] = T.FLOOR; gx = wx; gy = wy; }   // carve one if needed
      if (gx >= 0) floor.entities.push({ type: 'enemy', id: Data.GUARDIAN, x: gx, y: gy });
    }
    return floor;
  }

  function expected(floorIndex) {
    var c = Data.FLOOR_COUNTS[floorIndex] || { enemies: 0, resources: 0, traps: 0 };
    return c.enemies + c.resources + c.traps + (floorIndex === Data.CONFIG.floors - 1 ? 1 : 0);
  }

  function generate(rnd, floorIndex) {
    var floor = null;
    for (var i = 0; i < 10; i++) {   // regenerate with the same rnd while the layout is not usable
      floor = build(rnd, floorIndex);
      if (reachable(floor, floor.start, floor.exit) && floor.entities.length === expected(floorIndex)) break;
    }
    return floor;
  }

  function mutate(floor, rnd, playerPos) {
    var layout = buildLayout(rnd), i;
    for (i = 0; i < floor.tiles.length; i++) floor.tiles[i] = layout.tiles[i];
    floor.tiles[idx(floor.exit.x, floor.exit.y)] = T.EXIT;

    var keep = [playerPos, floor.start, floor.exit];
    for (i = 0; i < floor.entities.length; i++) keep.push(floor.entities[i]);
    for (i = 0; i < keep.length; i++) {
      var p = keep[i];
      if (!walkable(floor, p.x, p.y)) floor.tiles[idx(p.x, p.y)] = T.FLOOR;
    }
    for (i = 0; i < keep.length; i++) {
      if (!reachable(floor, playerPos, keep[i])) carveL(floor.tiles, playerPos, keep[i], rnd);
    }

    for (i = 0; i < floor.seen.length; i++) floor.seen[i] = false;
    floor.decor = makeDecor(rnd);
    reveal(floor, playerPos.x, playerPos.y, Data.CONFIG.fogRadius);
    return floor;
  }

  function entityAt(floor, x, y) {
    for (var i = 0; i < floor.entities.length; i++) {
      var e = floor.entities[i];
      if (e.x === x && e.y === y) return e;
    }
    return null;
  }
  function removeEntity(floor, ent) {
    var i = floor.entities.indexOf(ent);
    if (i >= 0) floor.entities.splice(i, 1);
  }

  return {
    W: W, H: H, T: T,
    generate: generate, mutate: mutate,
    idx: idx, get: get, walkable: walkable,
    entityAt: entityAt, removeEntity: removeEntity,
    reveal: reveal, reachable: reachable
  };
})();
