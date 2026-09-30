// Procedural tower: 3 labyrinth floors of rooms and winding corridors, plus the runtime labyrinth shift.
(function () {
  'use strict';
  window.DD = window.DD || {};

  var W = 40, H = 26;
  var KEEP_AWAY = 4;        // no entity within this many tiles (Chebyshev) of start/stairs/exit
  var ENEMY_MIN_STEPS = 10; // enemies spawn at least this many walking steps from start
  var EXTRA_ITEMS = ['elixir', 'essence', 'elixir', 'essence', 'thread', 'gear'];
  var ALL_ITEMS = ['elixir', 'essence', 'thread', 'gear', 'blueprint'];

  var queue = null, scratch = null;

  // BFS walking distances over non-wall tiles from (sx, sy); -1 = unreachable.
  // Writes into `out` (Int16Array of w*h) or into a shared internal buffer.
  function distances(floor, sx, sy, out) {
    var w = floor.w, n = w * floor.h, t = floor.tiles, WALL = DD.Data.TILE.WALL;
    if (!queue || queue.length < n) { queue = new Int32Array(n); scratch = new Int16Array(n); }
    var d = out || scratch, head = 0, tail = 0, s = sy * w + sx;
    d.fill(-1, 0, n);
    d[s] = 0; queue[tail++] = s;
    while (head < tail) {
      var i = queue[head++], nd = d[i] + 1, x = i % w;
      if (x > 0 && d[i - 1] < 0 && t[i - 1] !== WALL) { d[i - 1] = nd; queue[tail++] = i - 1; }
      if (x < w - 1 && d[i + 1] < 0 && t[i + 1] !== WALL) { d[i + 1] = nd; queue[tail++] = i + 1; }
      if (i >= w && d[i - w] < 0 && t[i - w] !== WALL) { d[i - w] = nd; queue[tail++] = i - w; }
      if (i + w < n && d[i + w] < 0 && t[i + w] !== WALL) { d[i + w] = nd; queue[tail++] = i + w; }
    }
    return d;
  }

  function carve(floor, x, y, w, h) {
    for (var yy = y; yy < y + h; yy++) {
      for (var xx = x; xx < x + w; xx++) floor.tiles[yy * W + xx] = DD.Data.TILE.FLOOR;
    }
  }

  function center(r) { return { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) }; }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // L-shaped segment between two points.
  function segment(floor, rng, x0, y0, x1, y1) {
    var hx = Math.min(x0, x1), hw = Math.abs(x1 - x0) + 1, vy = Math.min(y0, y1), vh = Math.abs(y1 - y0) + 1;
    if (rng.chance(0.5)) { carve(floor, hx, y0, hw, 1); carve(floor, x1, vy, 1, vh); }
    else { carve(floor, x0, vy, 1, vh); carve(floor, hx, y1, hw, 1); }
  }

  // Winding corridor: two L-segments through a random waypoint near the two rooms.
  function corridor(floor, rng, a, b) {
    var p = center(a), q = center(b);
    var mx = clamp(rng.int(Math.min(p.x, q.x) - 3, Math.max(p.x, q.x) + 3), 1, W - 2);
    var my = clamp(rng.int(Math.min(p.y, q.y) - 3, Math.max(p.y, q.y) + 3), 1, H - 2);
    segment(floor, rng, p.x, p.y, mx, my);
    segment(floor, rng, mx, my, q.x, q.y);
  }

  // The rank-th nearest room to rooms[i] among rooms[0..limit), excluding i.
  function nearest(rooms, i, limit, rank) {
    var c = center(rooms[i]), list = [];
    for (var j = 0; j < limit; j++) {
      if (j === i) continue;
      var o = center(rooms[j]);
      list.push({ r: rooms[j], d: (o.x - c.x) * (o.x - c.x) + (o.y - c.y) * (o.y - c.y) });
    }
    list.sort(function (a, b) { return a.d - b.d; });
    return list[Math.min(rank, list.length - 1)].r;
  }

  function carveRooms(floor, rng) {
    var rooms = floor.rooms, want = rng.int(8, 11);
    for (var tries = 0; rooms.length < want && tries < 400; tries++) {
      var rw = rng.int(4, 8), rh = rng.int(3, 6);
      var r = { x: rng.int(1, W - rw - 1), y: rng.int(1, H - rh - 1), w: rw, h: rh };
      var overlaps = rooms.some(function (o) {
        return r.x < o.x + o.w + 2 && r.x + r.w + 2 > o.x && r.y < o.y + o.h + 2 && r.y + r.h + 2 > o.y;
      });
      if (overlaps) continue;
      rooms.push(r);
      carve(floor, r.x, r.y, r.w, r.h);
    }
    for (var i = 1; i < rooms.length; i++) corridor(floor, rng, rooms[i], nearest(rooms, i, i, 0));
    for (var k = rng.int(3, 5); k > 0; k--) {
      var a = rng.int(0, rooms.length - 1);
      corridor(floor, rng, rooms[a], nearest(rooms, a, rooms.length, rng.int(1, 2)));
    }
  }

  function pickEnemy(rng, pool) {
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i].weight || 1;
    var r = rng.next() * total;
    for (i = 0; i < pool.length; i++) { r -= pool[i].weight || 1; if (r < 0) return pool[i]; }
    return pool[pool.length - 1];
  }

  function makeFloor(index, seed) {
    var D = DD.Data, T = D.TILE, rng = DD.Core.rng(seed), last = index === D.CONST.FLOORS - 1;
    var floor = {
      index: index, name: D.FLOOR_NAME[index], w: W, h: H, tiles: new Uint8Array(W * H).fill(T.WALL),
      start: null, stairsDown: null, stairsUp: null, exit: null, rooms: [], entities: [], fires: []
    };
    var tiles = floor.tiles;
    carveRooms(floor, rng);

    floor.start = center(floor.rooms[0]);
    var d = distances(floor, floor.start.x, floor.start.y);
    var far = floor.rooms[0];
    floor.rooms.forEach(function (r) {
      var c = center(r), fc = center(far);
      if (d[c.y * W + c.x] > d[fc.y * W + fc.x]) far = r;
    });
    var goal = center(far);
    if (last) { floor.exit = goal; tiles[goal.y * W + goal.x] = T.EXIT; }
    else { floor.stairsDown = goal; tiles[goal.y * W + goal.x] = T.STAIRS_DOWN; }
    if (index > 0) {
      floor.stairsUp = { x: floor.start.x, y: floor.start.y };
      tiles[floor.start.y * W + floor.start.x] = T.STAIRS_UP;
    }

    var used = new Uint8Array(W * H);
    function mark(x, y) {
      for (var yy = y - 1; yy <= y + 1; yy++) for (var xx = x - 1; xx <= x + 1; xx++) used[yy * W + xx] = 1;
    }

    // Boss guard on the exit's neighbor closest (in steps) to the start.
    if (last) {
      var g = null, gd = 1e9;
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (o) {
        var x = goal.x + o[0], y = goal.y + o[1], v = d[y * W + x];
        if (tiles[y * W + x] === T.FLOOR && v >= 0 && v < gd) { gd = v; g = { x: x, y: y }; }
      });
      if (g) { floor.entities.push({ kind: 'enemy', enemyId: 'clockmaker', x: g.x, y: g.y, guard: true }); mark(g.x, g.y); }
    }

    // Candidate cells: reachable plain floor, away from start/stairs/exit. Shuffled once.
    var keep = [floor.start, floor.stairsDown, floor.exit].filter(Boolean);
    var cells = [];
    for (var i = 0; i < W * H; i++) {
      if (d[i] <= 0 || tiles[i] !== T.FLOOR) continue;
      var cx = i % W, cy = (i / W) | 0;
      if (keep.every(function (p) { return Math.max(Math.abs(cx - p.x), Math.abs(cy - p.y)) > KEEP_AWAY; })) cells.push(i);
    }
    rng.shuffle(cells);
    function take(minSteps) {
      for (var k = 0; k < cells.length; k++) {
        var c = cells[k];
        if (used[c] || d[c] < minSteps) continue;
        cells.splice(k, 1);
        var pos = { x: c % W, y: (c / W) | 0 };
        mark(pos.x, pos.y);
        return pos;
      }
      return null;
    }
    function add(entity, minSteps) {
      var pos = take(minSteps);
      if (!pos) return;
      entity.x = pos.x; entity.y = pos.y;
      floor.entities.push(entity);
    }

    var pool = Object.keys(D.ENEMIES).map(function (id) { return D.ENEMIES[id]; }).filter(function (e) {
      return e.kind !== 'boss' && e.floors[0] <= index && index <= e.floors[1] && (index > 0 || e.kind !== 'elite');
    });
    for (var n = rng.int(4, 7); n > 0 && pool.length; n--) {
      var e = pickEnemy(rng, pool);
      if (e.kind === 'elite') pool = pool.filter(function (o) { return o.kind !== 'elite'; });
      add({ kind: 'enemy', enemyId: e.id }, ENEMY_MIN_STEPS);
    }

    var items = ALL_ITEMS.slice();
    for (var m = rng.int(6, 8) - items.length; m > 0; m--) items.push(rng.pick(EXTRA_ITEMS));
    items.forEach(function (item) { add({ kind: 'pickup', item: item }, 1); });

    for (var q = rng.int(6, 10); q > 0; q--) {
      add({ kind: 'trap', trap: rng.chance(0.55) ? 'spikes' : 'steam', phase: rng.next() * 3 }, 1);
    }
    return floor;
  }

  function generate(seed) {
    var master = DD.Core.rng(seed), floors = [];
    for (var i = 0; i < DD.Data.CONST.FLOORS; i++) floors.push(makeFloor(i, master.int(1, 2147483646)));
    return { seed: seed, floors: floors };
  }

  // Closing tile c is safe if the goal and every walkable neighbor of c stay reachable from the player,
  // which keeps every previously reachable tile reachable.
  function stillConnected(floor, player, goal, c) {
    var w = floor.w, t = floor.tiles, WALL = DD.Data.TILE.WALL;
    var d = distances(floor, player.x, player.y);
    if (d[goal.y * w + goal.x] < 0) return false;
    var nb = [c - 1, c + 1, c - w, c + w];
    for (var k = 0; k < 4; k++) if (t[nb[k]] !== WALL && d[nb[k]] < 0) return false;
    return true;
  }

  function shift(floor, rng, playerTile) {
    var T = DD.Data.TILE, w = floor.w, h = floor.h, t = floor.tiles, changes = [];
    var locked = new Uint8Array(w * h);
    function lock(x, y, r) {
      for (var yy = y - r; yy <= y + r; yy++) {
        for (var xx = x - r; xx <= x + r; xx++) if (xx >= 0 && yy >= 0 && xx < w && yy < h) locked[yy * w + xx] = 1;
      }
    }
    [floor.start, floor.stairsDown, floor.stairsUp, floor.exit].forEach(function (p) { if (p) lock(p.x, p.y, 0); });
    floor.entities.forEach(function (e) { lock(e.x, e.y, 0); });
    (floor.fires || []).forEach(function (f) { lock(f.x, f.y, 0); });
    lock(playerTile.x, playerTile.y, 3);
    var goal = floor.exit || floor.stairsDown;

    var opens = [], closes = [], x, y, i;
    for (y = 1; y < h - 1; y++) {
      for (x = 1; x < w - 1; x++) {
        i = y * w + x;
        if (locked[i]) continue;
        if (t[i] === T.FLOOR) closes.push(i);
        else if (t[i] === T.WALL &&
          ((t[i - 1] !== T.WALL && t[i + 1] !== T.WALL) || (t[i - w] !== T.WALL && t[i + w] !== T.WALL))) opens.push(i);
      }
    }
    rng.shuffle(opens);
    rng.shuffle(closes);
    var total = rng.int(8, 14), wantOpen = total >> 1, wantClose = total - wantOpen;

    // Opening a wall between two walkable tiles never disconnects anything (it adds a shortcut).
    for (i = 0; i < opens.length && wantOpen > 0; i++, wantOpen--) {
      t[opens[i]] = T.FLOOR;
      changes.push({ x: opens[i] % w, y: (opens[i] / w) | 0, to: T.FLOOR });
    }
    for (i = 0; i < closes.length && i < 80 && wantClose > 0; i++) {
      var c = closes[i];
      t[c] = T.WALL;
      if (stillConnected(floor, playerTile, goal, c)) {
        changes.push({ x: c % w, y: (c / w) | 0, to: T.WALL });
        wantClose--;
      } else {
        t[c] = T.FLOOR;
      }
    }
    return changes;
  }

  DD.Tower = { generate: generate, shift: shift, distances: distances };
})();
