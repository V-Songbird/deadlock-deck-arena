// Deadlock Deck: El Reloj Anatómico — DD.tower: procedural floors (a 7×4 maze of rooms) and their mutation.
// Touches DD.data only inside functions (run time), as required by the load order.
(function () {
  const W = 7, H = 4;
  const DIRS = [
    { key: 'n', opp: 's', dx: 0, dy: -1 },
    { key: 's', opp: 'n', dx: 0, dy: 1 },
    { key: 'e', opp: 'w', dx: 1, dy: 0 },
    { key: 'w', opp: 'e', dx: -1, dy: 0 },
  ];
  const floorNames = ['Sótano de Disección', 'Galería de Especímenes', 'Laboratorio Superior'].map(n => DD.t(n));

  function cellAt(floor, x, y) {
    return x >= 0 && y >= 0 && x < floor.w && y < floor.h ? floor.cells[y * floor.w + x] : null;
  }

  function neighbors(floor, cell) {
    const out = [];
    for (const d of DIRS) {
      const n = cell.doors[d.key] && cellAt(floor, cell.x + d.dx, cell.y + d.dy);
      if (n) out.push(n);
    }
    return out;
  }

  // Opens the symmetric door between two orthogonally adjacent cells.
  function link(a, b) {
    const d = DIRS.find(d => a.x + d.dx === b.x && a.y + d.dy === b.y);
    a.doors[d.key] = true;
    b.doors[d.opp] = true;
  }

  // Re-rolls every door: a randomized-DFS spanning tree (so the maze is always connected)
  // plus 2-4 extra doors that create loops. Cell contents are untouched.
  function carve(floor) {
    for (const c of floor.cells) c.doors = { n: false, s: false, e: false, w: false };
    const first = DD.pick(floor.cells), seen = new Set([first]), stack = [first];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const open = DIRS.map(d => cellAt(floor, cur.x + d.dx, cur.y + d.dy)).filter(n => n && !seen.has(n));
      if (!open.length) { stack.pop(); continue; }
      const next = DD.pick(open);
      link(cur, next);
      seen.add(next);
      stack.push(next);
    }
    for (let extra = 2 + DD.rand(3), tries = 0; extra > 0 && tries < 200; tries++) {
      const a = DD.pick(floor.cells), d = DD.pick(DIRS), b = cellAt(floor, a.x + d.dx, a.y + d.dy);
      if (b && !a.doors[d.key]) { link(a, b); extra--; }
    }
  }

  // Walking distance (in rooms) from `from` to every reachable cell.
  function distances(floor, from) {
    const dist = new Map([[from, 0]]), queue = [from];
    for (let i = 0; i < queue.length; i++) {
      for (const n of neighbors(floor, queue[i])) if (!dist.has(n)) { dist.set(n, dist.get(queue[i]) + 1); queue.push(n); }
    }
    return dist;
  }

  function generateFloor(index) {
    const floor = { index, name: floorNames[index], w: W, h: H, cells: [], px: 0, py: 0, mutations: 0 };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      floor.cells.push({ x, y, type: 'empty', enemyId: null, trapId: null, visited: false, revealed: false, cleared: false, doors: { n: false, s: false, e: false, w: false } });
    }
    carve(floor);

    const start = cellAt(floor, 0, DD.rand(H));
    start.type = 'start';
    start.visited = start.revealed = true;
    floor.px = start.x;
    floor.py = start.y;

    // Stairs/exit: the right-column cell with the longest walk from the start.
    const dist = distances(floor, start);
    let goal = null;
    for (let y = 0; y < H; y++) { const c = cellAt(floor, W - 1, y); if (!goal || dist.get(c) > dist.get(goal)) goal = c; }
    const last = index >= DD.FLOORS - 1;
    goal.type = last ? 'exit' : 'stairs';
    goal.enemyId = last ? 'maestro' : null;
    goal.revealed = true;                           // the destination is known from the start; the route is not

    const near = neighbors(floor, start);
    for (const c of near) c.revealed = true;
    const all = Object.values(DD.data.enemies).filter(e => e.id !== 'maestro');
    const roster = all.filter(e => e.floors.includes(index + 1));
    const normal = roster.filter(e => !e.elite), elites = roster.filter(e => e.elite === true);
    let pool = DD.shuffle(floor.cells.filter(c => c.type === 'empty' && !near.includes(c)));   // hazards never next to the start
    const take = (n, fn) => { while (n-- > 0 && pool.length) fn(pool.shift()); };
    take(4 + DD.rand(2), c => { c.type = 'enemy'; c.enemyId = DD.pick(normal.length ? normal : all).id; });
    if (index >= 1 && elites.length && DD.chance(0.5)) take(1, c => { c.type = 'elite'; c.enemyId = DD.pick(elites).id; });
    take(2, c => { c.type = 'trap'; c.trapId = DD.pick(Object.keys(DD.data.traps)); });
    pool = DD.shuffle(pool.concat(near));           // resources may sit next to the start
    take(2 + DD.rand(2), c => { c.type = DD.pick(['vial', 'coolant', 'ichor']); });
    return floor;
  }

  // Re-rolls all doors as a fresh connected maze; contents, flags and the player position are kept.
  function mutate(floor) {
    carve(floor);
    floor.mutations++;
    for (const n of neighbors(floor, cellAt(floor, floor.px, floor.py))) n.revealed = true;
  }

  DD.tower = { floorNames, generateFloor, cellAt, neighbors, mutate };
})();
