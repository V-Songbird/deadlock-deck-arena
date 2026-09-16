/* DD.Tower — generation, queries and in-place relayout for one tower floor.
 * Room-and-corridor layout carved into a wall grid (SPEC.md 5.6). */
(function () {
  'use strict';
  var DD = window.DD;
  var Tower = DD.Tower = DD.Tower || {};

  var W = 48, H = 36;                      // map size in tiles (frozen by SPEC 5.6)
  var ROOMS_MIN = 9, ROOMS_MAX = 14;
  var RW_MIN = 5, RW_MAX = 11, RH_MIN = 4, RH_MAX = 8;
  var PLACE_TRIES = 900;
  var GRATE_RATE = 0.02;                   // share of floor tiles that become grate
  var START_CLEAR = 3;                     // entities never spawn closer than this to start
  var ALTAR_DIST = 8;
  var BLOOD_CHANCE = 0.32;
  var CORRIDOR_LOOPS_MIN = 2, CORRIDOR_LOOPS_MAX = 3;

  /* Props are drawn by sprite key, so the entity id is the sprite id (SPEC 4.2). */
  var PROPS = [
    'prop_table', 'prop_shelf', 'prop_candle', 'prop_brazier', 'prop_jar', 'prop_cage',
    'prop_book', 'prop_crystal', 'prop_coffin', 'prop_chain', 'prop_tube'
  ];

  /* ==================================================================== API */

  Tower.at = function (map, x, y) {
    if (!map || !map.tiles) return DD.TILE_WALL;
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return DD.TILE_WALL;
    return map.tiles[y * map.w + x];
  };

  Tower.walkable = function (map, x, y) {
    var t = Tower.at(map, x, y);
    return t === DD.TILE_FLOOR || t === DD.TILE_DOOR || t === DD.TILE_GRATE ||
           t === DD.TILE_BLOOD || t === DD.TILE_STAIRS || t === DD.TILE_EXIT;
  };

  Tower.set = function (map, x, y, tile) {
    if (!map || !map.tiles) return false;
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
    map.tiles[y * map.w + x] = tile;
    return true;
  };

  /* Bresenham walk. Walls and void block the line; the origin tile never does. */
  Tower.lineOfSight = function (map, x0, y0, x1, y1) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    var dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    var err = dx + dy, e2, x = x0, y = y0, guard = 0;
    while (guard++ < 512) {
      if (x === x1 && y === y1) return true;
      e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
      var t = Tower.at(map, x, y);
      if (t === DD.TILE_WALL || t === DD.TILE_VOID) return false;
    }
    return true;
  };

  /* A random walkable tile, never on start/exit, never inside `avoid`,
   * at least `minDistFrom.d` tiles away from (minDistFrom.x, minDistFrom.y). */
  Tower.freeTile = function (map, rng, minDistFrom, avoid) {
    if (!map || !map.tiles) return null;
    rng = rng || (DD.rng ? DD.rng(1) : null);
    if (!rng) return null;

    var minD2 = minDistFrom ? minDistFrom.d * minDistFrom.d : -1;
    var i, x, y, cand = [];

    function ok(px, py) {
      if (!Tower.walkable(map, px, py)) return false;
      if (minD2 > 0) {
        var ax = px - minDistFrom.x, ay = py - minDistFrom.y;
        if (ax * ax + ay * ay <= minD2) return false;
      }
      if (avoid) {
        for (var k = 0; k < avoid.length; k++) {
          if (avoid[k] && avoid[k].x === px && avoid[k].y === py) return false;
        }
      }
      return true;
    }

    for (i = 0; i < 200; i++) {
      x = rng.int(1, map.w - 2);
      y = rng.int(1, map.h - 2);
      if (ok(x, y)) return { x: x, y: y };
    }
    // Deterministic sweep so a crowded map still yields a tile.
    for (y = 1; y < map.h - 1; y++) {
      for (x = 1; x < map.w - 1; x++) if (ok(x, y)) cand.push({ x: x, y: y });
    }
    return cand.length ? rng.pick(cand) : null;
  };

  /* ============================================================= generation */

  Tower.generate = function (seed, floor, floorCount) {
    floor = floor || 0;
    floorCount = floorCount || DD.FLOOR_COUNT || 4;
    if (seed === undefined) seed = DD.hash(floor + 1, 7919);

    var rng = DD.rng(seed);
    var lay = carveLayout(W, H, rng, floor, floorCount);
    var map = {
      w: W, h: H,
      tiles: lay.tiles,
      floor: floor,
      floorCount: floorCount,
      rooms: lay.rooms,
      entities: [],
      start: lay.start,
      exit: lay.exit,
      seed: seed
    };
    stampExit(map);
    populate(map, rng, floor, floorCount);
    return map;
  };

  /* Re-carves the current map in place. Tiles, rooms, start, exit and the
   * entity objects all keep their identity; only the coordinates move. */
  Tower.relayout = function (map, seed) {
    if (!map || !map.tiles) return map;
    if (!map.rooms) map.rooms = [];
    if (!map.entities) map.entities = [];
    if (!map.start) map.start = { x: 1, y: 1 };
    if (!map.exit) map.exit = { x: 1, y: 1 };

    var rng = DD.rng(seed === undefined ? 1 : seed);
    var lay = carveLayout(map.w, map.h, rng, map.floor || 0, floorCountOf(map));

    map.tiles.set(lay.tiles);

    var n = lay.rooms.length, i, src, dst;
    while (map.rooms.length > n) map.rooms.pop();
    while (map.rooms.length < n) map.rooms.push({ x: 0, y: 0, w: 0, h: 0, type: 'lab' });
    for (i = 0; i < n; i++) {
      src = lay.rooms[i]; dst = map.rooms[i];
      dst.x = src.x; dst.y = src.y; dst.w = src.w; dst.h = src.h; dst.type = src.type;
    }

    // start and exit are re-placed into the new layout, then verified walkable.
    var s = nearestWalkable(map, lay.start.x, lay.start.y, null);
    map.start.x = s.x; map.start.y = s.y;
    var x = nearestWalkable(map, lay.exit.x, lay.exit.y, null);
    map.exit.x = x.x; map.exit.y = x.y;
    stampExit(map);

    // Every living entity must land on a walkable tile.
    var taken = [{ x: map.start.x, y: map.start.y }, { x: map.exit.x, y: map.exit.y }];
    for (i = 0; i < map.entities.length; i++) {
      var e = map.entities[i];
      if (!e || e.dead) continue;
      var p = nearestWalkable(map, e.x, e.y, taken);
      e.x = p.x; e.y = p.y;
      taken.push(p);
    }

    // The player keeps their position across a shift — but never inside a wall.
    var st = DD.Run && DD.Run.state;
    if (st && st.player && st.map === map) {
      var pp = nearestWalkable(map, st.player.x, st.player.y, taken);
      st.player.x = pp.x; st.player.y = pp.y;
    }
    return map;
  };

  /* ================================================================ layout */

  function carveLayout(w, h, rng, floor, floorCount) {
    var tiles = new Int8Array(w * h), i;
    for (i = 0; i < tiles.length; i++) tiles[i] = DD.TILE_WALL;

    var rooms = placeRooms(w, h, rng);
    assignTypes(rooms, rng);

    for (i = 0; i < rooms.length; i++) carveRect(tiles, w, h, rooms[i]);

    // Connect the rooms in sequence…
    for (i = 0; i + 1 < rooms.length; i++) connect(tiles, w, h, rooms[i], rooms[i + 1], rng);
    // …then add a few loops, so the floor is not a pure tree.
    var loops = rng.int(CORRIDOR_LOOPS_MIN, CORRIDOR_LOOPS_MAX);
    for (i = 0; i < loops && rooms.length > 2; i++) {
      var a = rng.int(0, rooms.length - 1), b = rng.int(0, rooms.length - 1);
      if (a !== b) connect(tiles, w, h, rooms[a], rooms[b], rng);
    }

    classifyWalls(tiles, w, h);
    for (i = 0; i < rooms.length; i++) markDoors(tiles, w, h, rooms[i]);
    sprinkleGrates(tiles, w, h, rng);

    var start = centreOf(rooms[0]);
    var exit = centreOf(rooms[rooms.length - 1]);
    for (i = 0; i < rooms.length; i++) {
      if (rooms[i].type === 'vault') bloodAround(tiles, w, h, centreOf(rooms[i]), 3, rng);
    }
    bloodAround(tiles, w, h, exit, 3, rng);

    return { tiles: tiles, rooms: rooms, start: start, exit: exit };
  }

  function placeRooms(w, h, rng) {
    var rooms = [], target = rng.int(ROOMS_MIN, ROOMS_MAX), tries = 0;
    var maxW = RW_MAX, maxH = RH_MAX, sinceLast = 0;
    while (rooms.length < target && tries < PLACE_TRIES) {
      tries++;
      var rw = rng.int(RW_MIN, maxW), rh = rng.int(RH_MIN, maxH);
      var rx = rng.int(2, Math.max(2, w - 2 - rw));
      var ry = rng.int(2, Math.max(2, h - 2 - rh));
      if (fits(rooms, rx, ry, rw, rh)) {
        rooms.push({ x: rx, y: ry, w: rw, h: rh, type: 'lab' });
        sinceLast = 0;
        continue;
      }
      // A crowded map still has to reach its room count: ask for smaller rooms.
      if (++sinceLast > 40) {
        sinceLast = 0;
        if (maxW > RW_MIN) maxW--;
        else if (maxH > RH_MIN) maxH--;
      }
    }
    // Guarantee at least one room even on a pathological draw.
    if (!rooms.length) rooms.push({ x: 2, y: 2, w: 10, h: 8, type: 'lab' });
    return rooms;
  }

  /* Rooms keep one tile of solid wall between them (room padding 1). */
  function fits(rooms, x, y, w, h) {
    for (var i = 0; i < rooms.length; i++) {
      var r = rooms[i];
      if (x - 1 <= r.x + r.w && x + w >= r.x - 1 && y - 1 <= r.y + r.h && y + h >= r.y - 1) return false;
    }
    return true;
  }

  function assignTypes(rooms, rng) {
    var i, pool = ['lab', 'hall', 'cell'];
    for (i = 0; i < rooms.length; i++) rooms[i].type = rng.pick(pool);
    rooms[0].type = 'lab';
    rooms[rooms.length - 1].type = 'exit';
    if (rooms.length > 2) rooms[rng.int(1, rooms.length - 2)].type = 'vault';
  }

  function centreOf(r) { return { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) }; }

  function carveRect(tiles, w, h, r) {
    for (var y = r.y; y < r.y + r.h; y++) {
      if (y < 0 || y >= h) continue;
      for (var x = r.x; x < r.x + r.w; x++) {
        if (x < 0 || x >= w) continue;
        tiles[y * w + x] = DD.TILE_FLOOR;
      }
    }
  }

  function carveH(tiles, w, h, ax, bx, y, width) {
    var lo = Math.min(ax, bx), hi = Math.max(ax, bx), x, i;
    for (x = lo; x <= hi; x++) {
      for (i = 0; i < width; i++) {
        if (x < 0 || x >= w || y + i < 0 || y + i >= h) continue;
        tiles[(y + i) * w + x] = DD.TILE_FLOOR;
      }
    }
  }

  function carveV(tiles, w, h, x, ay, by, width) {
    var lo = Math.min(ay, by), hi = Math.max(ay, by), y, i;
    for (y = lo; y <= hi; y++) {
      for (i = 0; i < width; i++) {
        if (y < 0 || y >= h || x + i < 0 || x + i >= w) continue;
        tiles[y * w + x + i] = DD.TILE_FLOOR;
      }
    }
  }

  function connect(tiles, w, h, ra, rb, rng) {
    var a = centreOf(ra), b = centreOf(rb);
    var wide = rng.chance(0.5) ? 2 : 1;
    if (rng.chance(0.5)) {
      carveH(tiles, w, h, a.x, b.x, a.y, wide);
      carveV(tiles, w, h, b.x, a.y, b.y, wide);
    } else {
      carveV(tiles, w, h, a.x, a.y, b.y, wide);
      carveH(tiles, w, h, a.x, b.x, b.y, wide);
    }
  }

  /* Anything that is not touching a floor becomes void. */
  function classifyWalls(tiles, w, h) {
    var out = new Int8Array(w * h), x, y;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        if (tiles[y * w + x] !== DD.TILE_WALL) { out[y * w + x] = tiles[y * w + x]; continue; }
        out[y * w + x] = touchesFloor(tiles, w, h, x, y) ? DD.TILE_WALL : DD.TILE_VOID;
      }
    }
    tiles.set(out);
  }

  function touchesFloor(tiles, w, h, x, y) {
    var d = [[1, 0], [-1, 0], [0, 1], [0, -1]], i, nx, ny;
    for (i = 0; i < 4; i++) {
      nx = x + d[i][0]; ny = y + d[i][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (tiles[ny * w + nx] === DD.TILE_FLOOR) return true;
    }
    return false;
  }

  /* A door sits where a corridor crosses a room's wall ring. */
  function markDoors(tiles, w, h, r) {
    var x, y, t;
    for (x = r.x - 1; x <= r.x + r.w; x++) {
      t = raw(tiles, w, h, x, r.y - 1);
      if (t === DD.TILE_FLOOR && raw(tiles, w, h, x, r.y - 2) === DD.TILE_FLOOR) tiles[(r.y - 1) * w + x] = DD.TILE_DOOR;
      t = raw(tiles, w, h, x, r.y + r.h);
      if (t === DD.TILE_FLOOR && raw(tiles, w, h, x, r.y + r.h + 1) === DD.TILE_FLOOR) tiles[(r.y + r.h) * w + x] = DD.TILE_DOOR;
    }
    for (y = r.y - 1; y <= r.y + r.h; y++) {
      t = raw(tiles, w, h, r.x - 1, y);
      if (t === DD.TILE_FLOOR && raw(tiles, w, h, r.x - 2, y) === DD.TILE_FLOOR) tiles[y * w + r.x - 1] = DD.TILE_DOOR;
      t = raw(tiles, w, h, r.x + r.w, y);
      if (t === DD.TILE_FLOOR && raw(tiles, w, h, r.x + r.w + 1, y) === DD.TILE_FLOOR) tiles[y * w + r.x + r.w] = DD.TILE_DOOR;
    }
  }

  function raw(tiles, w, h, x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return DD.TILE_WALL;
    return tiles[y * w + x];
  }

  /* 2% of the floor tiles, only where they touch a wall. */
  function sprinkleGrates(tiles, w, h, rng) {
    var spots = [], x, y;
    for (y = 1; y < h - 1; y++) {
      for (x = 1; x < w - 1; x++) {
        if (tiles[y * w + x] !== DD.TILE_FLOOR) continue;
        if (touchesWall(tiles, w, h, x, y)) spots.push({ x: x, y: y });
      }
    }
    rng.shuffle(spots);
    var n = Math.floor(spots.length * GRATE_RATE);
    for (var i = 0; i < n; i++) tiles[spots[i].y * w + spots[i].x] = DD.TILE_GRATE;
  }

  function touchesWall(tiles, w, h, x, y) {
    var d = [[1, 0], [-1, 0], [0, 1], [0, -1]], i, nx, ny;
    for (i = 0; i < 4; i++) {
      nx = x + d[i][0]; ny = y + d[i][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (tiles[ny * w + nx] === DD.TILE_WALL) return true;
    }
    return false;
  }

  function bloodAround(tiles, w, h, c, r, rng) {
    for (var y = c.y - r; y <= c.y + r; y++) {
      for (var x = c.x - r; x <= c.x + r; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (tiles[y * w + x] !== DD.TILE_FLOOR) continue;
        if (rng.chance(BLOOD_CHANCE)) tiles[y * w + x] = DD.TILE_BLOOD;
      }
    }
  }

  function stampExit(map) {
    var last = (map.floor || 0) >= floorCountOf(map) - 1;
    Tower.set(map, map.exit.x, map.exit.y, last ? DD.TILE_EXIT : DD.TILE_STAIRS);
  }

  function floorCountOf(map) {
    var st = DD.Run && DD.Run.state;
    return (st && st.floorCount) || map.floorCount || DD.FLOOR_COUNT || 4;
  }

  /* =========================================================== entity infill */

  function populate(map, rng, floor, floorCount) {
    var avoid = [{ x: map.start.x, y: map.start.y }, { x: map.exit.x, y: map.exit.y }];
    var near = { x: map.start.x, y: map.start.y, d: START_CLEAR };
    var list = map.entities;
    var i, pos;

    var epool = enemyPool(floor, floorCount);
    var nEnemies = 3 + floor;
    var boss = bossFor(floor, floorCount);
    if (boss) {
      pos = Tower.freeTile(map, rng, near, avoid);
      if (pos) { avoid.push(pos); list.push(entity('enemy', pos.x, pos.y, boss)); nEnemies--; }
    }
    for (i = 0; i < nEnemies; i++) {
      var edef = rng.weighted(epool, weightOf);
      if (!edef) break;
      pos = Tower.freeTile(map, rng, near, avoid);
      if (!pos) break;
      avoid.push(pos);
      list.push(entity('enemy', pos.x, pos.y, edef.id));
    }

    var tpool = trapPool(floor);
    for (i = 0; i < 4 + floor * 2; i++) {
      var tdef = rng.pick(tpool);
      if (!tdef) break;
      pos = Tower.freeTile(map, rng, near, avoid);
      if (!pos) break;
      avoid.push(pos);
      list.push(entity('trap', pos.x, pos.y, tdef.id));
    }

    var rpool = dataList('resources', 'resById');
    for (i = 0; i < 3 + floor; i++) {
      var rdef = rng.weighted(rpool, weightOf);
      if (!rdef) break;
      pos = Tower.freeTile(map, rng, near, avoid);
      if (!pos) break;
      avoid.push(pos);
      list.push(entity('resource', pos.x, pos.y, rdef.id));
    }

    var nProps = rng.int(2, 4);
    for (i = 0; i < nProps; i++) {
      pos = Tower.freeTile(map, rng, near, avoid);
      if (!pos) break;
      avoid.push(pos);
      list.push(entity('prop', pos.x, pos.y, rng.pick(PROPS)));
    }

    pos = Tower.freeTile(map, rng, { x: map.start.x, y: map.start.y, d: ALTAR_DIST }, avoid);
    if (pos) list.push(entity('altar', pos.x, pos.y, 'altar'));
  }

  /* floor 0 pulls tier 1, floor 1 mixes 1 and 2, floor 2 pulls tier 2,
   * floor 3+ pulls tiers 2 and 3. */
  function tierWeights(floor) {
    if (floor <= 0) return [1, 0, 0];
    if (floor === 1) return [1, 1, 0];
    if (floor === 2) return [0, 1, 0];
    return [0, 1, 1];
  }

  /* The boss is always alone in its tier: it shows up once, on the last floor. */
  function bossFor(floor, floorCount) {
    if (floor < floorCount - 1) return null;
    var all = dataList('enemies', 'enemyById'), i;
    for (i = 0; i < all.length; i++) if (all[i].boss || all[i].id === 'harvester') return all[i].id;
    return null;
  }

  function enemyPool(floor, floorCount) {
    var all = dataList('enemies', 'enemyById');
    var tw = tierWeights(floor);
    var last = floor >= floorCount - 1;
    var pool = [], i, d, w;
    for (i = 0; i < all.length; i++) {
      d = all[i];
      if (d.boss || d.id === 'harvester') continue;        // placed separately
      if (last && (d.tier || 1) >= 3) continue;            // the boss is the only tier-3 enemy on the last floor
      w = tw[(d.tier || 1) - 1] || 0;
      if (w > 0) pool.push({ id: d.id, w: w });
    }
    return pool;
  }

  function trapPool(floor) {
    var all = dataList('traps', 'trapById'), out = [], i;
    for (i = 0; i < all.length; i++) if ((all[i].minFloor || 0) <= floor) out.push(all[i]);
    return out;
  }

  function weightOf(d) { return (d && d.weight) || 1; }

  function dataList(name, indexName) {
    var D = DD.Data || {};
    if (D[name] && D[name].length) return D[name];
    var idx = D[indexName], out = [], k;
    for (k in idx) if (idx.hasOwnProperty(k)) out.push(idx[k]);
    return out;
  }

  function entity(kind, x, y, id, data) {
    return { kind: kind, x: x, y: y, id: id, data: data || {}, dead: false, active: false, timer: 0 };
  }

  /* ================================================================ rescue */

  function nearestWalkable(map, x, y, taken) {
    var p = scanRing(map, x, y, taken, true);
    if (p) return p;
    p = scanRing(map, x, y, taken, false);
    return p || { x: x, y: y };
  }

  function scanRing(map, cx, cy, taken, strict) {
    if (isFree(map, cx, cy, taken, strict)) return { x: cx, y: cy };
    var maxR = Math.max(map.w, map.h), r, dx, dy, x, y;
    for (r = 1; r <= maxR; r++) {
      for (dy = -r; dy <= r; dy++) {
        for (dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          x = cx + dx; y = cy + dy;
          if (isFree(map, x, y, taken, strict)) return { x: x, y: y };
        }
      }
    }
    return null;
  }

  function isFree(map, x, y, taken, strict) {
    if (!Tower.walkable(map, x, y)) return false;
    if (!strict || !taken) return true;
    for (var i = 0; i < taken.length; i++) {
      if (taken[i] && taken[i].x === x && taken[i].y === y) return false;
    }
    return true;
  }
})();
