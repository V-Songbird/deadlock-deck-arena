// DD.Tower — procedural 5x5 tower generation (PRODUCT.md 5.4).
// Pure data + deterministic RNG: no DOM, no dependencies.
window.DD = window.DD || {};

(function (DD) {
  'use strict';

  const W = 5;
  const H = 5;

  // Grid coordinates: x grows east, y grows south.
  const DIRS = [
    { dir: 'n', dx: 0, dy: -1 },
    { dir: 's', dx: 0, dy: 1 },
    { dir: 'e', dx: 1, dy: 0 },
    { dir: 'w', dx: -1, dy: 0 }
  ];

  // The elite and the exit guardian are placed by hand, never rolled.
  const EXCLUDED_ENEMIES = ['brass_guard', 'brass_porter'];

  // Spanish flavour names, one pool per room type. Picked per seed so two towers read
  // differently even when their layout matches.
  const LABELS = {
    slab: [DD.T('Mesa de disección')],
    exit: [DD.T('Portón en llamas')],
    combat: [DD.T('Pasillo de jaulas'), DD.T('Sala de vivisección'), DD.T('Galería de tarros'),
             DD.T('Alcoba de cobayas'), DD.T('Depósito de cadáveres'), DD.T('Taller de prótesis')],
    elite: [DD.T('Armería de latón'), DD.T('Cámara del guardia')],
    cache: [DD.T('Alacena de injertos'), DD.T('Armario de reactivos'), DD.T('Estante de frascos')],
    trap: [DD.T('Corredor de sierras'), DD.T('Foso de ácido'), DD.T('Trampa de vapor')],
    empty: [DD.T('Pasillo desierto'), DD.T('Hueco de escaleras'), DD.T('Celda saqueada'),
            DD.T('Rincón de ceniza')]
  };

  // ---------------------------------------------------------------- helpers

  function data() {
    return DD.DATA || {};
  }

  function roomId(x, y) {
    return 'r_' + x + '_' + y;
  }

  // Deterministic mulberry32: same seed, same tower.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(r, list) {
    return list[Math.floor(r() * list.length)];
  }

  function shuffled(r, list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = list[i];
      list[i] = list[j];
      list[j] = t;
    }
    return list;
  }

  function at(rooms, x, y) {
    return rooms[roomId(x, y)] || null;
  }

  function link(a, b) {
    a.links.push(b.id);
    b.links.push(a.id);
  }

  function enemyPool() {
    return Object.keys(data().ENEMIES || {}).filter(function (id) {
      return EXCLUDED_ENEMIES.indexOf(id) < 0;
    });
  }

  function rollCache(r) {
    const roll = Math.floor(r() * 3);
    if (roll === 0) return { kind: 'heal', amount: 10 };
    if (roll === 1) {
      const limbs = Object.keys(data().LIMBS || {});
      if (limbs.length) return { kind: 'blueprint', limbId: pick(r, limbs) };
    }
    return { kind: 'cool' };
  }

  function rollTrap(r) {
    return r() < 0.5 ? { kind: 'time', amount: -12 } : { kind: 'hp', amount: -6 };
  }

  // ---------------------------------------------------------------- public API

  function generate(seed) {
    const r = rng(seed);
    const rooms = {};
    const all = [];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const room = {
          id: roomId(x, y), x: x, y: y, type: 'empty', enemyId: null, loot: null,
          label: '', cleared: false, visited: false, seen: false, links: []
        };
        rooms[room.id] = room;
        all.push(room);
      }
    }

    const start = pick(r, all);

    // Random spanning walk: a randomised depth-first backtracker from the start room.
    // Every edge it opens becomes a link, so all 25 rooms end up reachable from startId.
    const inTree = {};
    inTree[start.id] = true;
    const stack = [start];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const open = [];
      for (let i = 0; i < DIRS.length; i++) {
        const n = at(rooms, cur.x + DIRS[i].dx, cur.y + DIRS[i].dy);
        if (n && !inTree[n.id]) open.push(n);
      }
      if (!open.length) {
        stack.pop();
        continue;
      }
      const next = pick(r, open);
      link(cur, next);
      inTree[next.id] = true;
      stack.push(next);
    }

    // ~4 extra links between grid neighbours that are still unconnected: loops, so the
    // maze is not a pure tree and different seeds read differently.
    const pairs = [];
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      const east = at(rooms, a.x + 1, a.y);
      const south = at(rooms, a.x, a.y + 1);
      if (east && a.links.indexOf(east.id) < 0) pairs.push([a, east]);
      if (south && a.links.indexOf(south.id) < 0) pairs.push([a, south]);
    }
    shuffled(r, pairs);
    const extra = Math.min(3 + Math.floor(r() * 3), pairs.length);
    for (let i = 0; i < extra; i++) link(pairs[i][0], pairs[i][1]);

    // Exit: the reachable room farthest (Manhattan) from the slab. Ties keep the first
    // room in scan order, which stays deterministic for a given seed.
    let exit = start;
    let best = -1;
    for (let i = 0; i < all.length; i++) {
      const d = Math.abs(all[i].x - start.x) + Math.abs(all[i].y - start.y);
      if (d > best) {
        best = d;
        exit = all[i];
      }
    }

    start.type = 'slab';
    exit.type = 'exit';
    exit.enemyId = data().GUARDIAN || null;

    // Everything that is neither slab nor exit gets a type from this queue, in order.
    // A 5x5 grid always holds them all; if the grid were ever smaller, the trailing
    // (least essential) kinds are simply dropped and generation still succeeds.
    const rest = all.filter(function (room) {
      return room !== start && room !== exit;
    });
    shuffled(r, rest);

    const pool = enemyPool();
    const queue = [];
    for (let i = 0; i < 6; i++) queue.push({ type: 'combat', enemyId: pool.length ? pick(r, pool) : null });
    queue.push({ type: 'elite', enemyId: 'brass_guard' });
    queue.push({ type: 'cache' });
    queue.push({ type: 'cache' });
    queue.push({ type: 'trap' });
    queue.push({ type: 'trap' });

    for (let i = 0; i < queue.length && i < rest.length; i++) {
      const room = rest[i];
      room.type = queue[i].type;
      if (queue[i].enemyId !== undefined) room.enemyId = queue[i].enemyId;
      if (room.type === 'cache') room.loot = rollCache(r);
      if (room.type === 'trap') room.loot = rollTrap(r);
    }

    for (let i = 0; i < all.length; i++) all[i].label = pick(r, LABELS[all[i].type]);

    const tower = { seed: seed, w: W, h: H, startId: start.id, exitId: exit.id, rooms: rooms };
    // The player wakes up on the slab, so that room is already visited and its doors seen.
    reveal(tower, start.id);
    return tower;
  }

  function neighbors(tower, roomId_) {
    const room = tower && tower.rooms ? tower.rooms[roomId_] : null;
    if (!room) return [];
    const out = [];
    for (let i = 0; i < DIRS.length; i++) {
      const id = roomId(room.x + DIRS[i].dx, room.y + DIRS[i].dy);
      if (room.links.indexOf(id) >= 0) out.push({ dir: DIRS[i].dir, id: id });
    }
    return out;
  }

  function roomAt(tower, x, y) {
    if (!tower || !tower.rooms) return null;
    return tower.rooms[roomId(x, y)] || null;
  }

  function reveal(tower, roomId_) {
    const room = tower && tower.rooms ? tower.rooms[roomId_] : null;
    if (!room) return null;
    room.visited = true;
    room.seen = true;
    for (let i = 0; i < room.links.length; i++) {
      const n = tower.rooms[room.links[i]];
      if (n) n.seen = true;
    }
    return room;
  }

  DD.Tower = {
    rng: rng,
    generate: generate,
    neighbors: neighbors,
    roomAt: roomAt,
    reveal: reveal
  };
})(window.DD);
