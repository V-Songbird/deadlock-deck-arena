/* Deadlock Deck: El Reloj Anatómico — torre (W4)
 * Lógica pura, sin DOM: genera cada piso y cambia sus compuertas. Contrato: docs/design.md §10.1.
 *
 * API (todas las coordenadas son casillas; la rejilla es MAP_W × MAP_H = 31×17):
 *   DD.Tower.T = { FLOOR:0, WALL:1, GATE_C:2 (compuerta cerrada), GATE_O:3 (abierta) }
 *   generate(floorIndex, rng) -> world
 *     { floor, w, h, tiles:Uint8Array(w*h), gates:[{x,y,open,warn}], rooms:[{x,y,w,h}],
 *       start:{x,y}, exit:{x,y,kind:'stairs'|'exit'}, pathLen (camino más corto inicio→salida con todo abierto),
 *       enemies:[{id,x,y}], traps:[{kind:'spikes'|'acid'|'steam',x,y,phase}],
 *       items:[{kind:'vial'|'coolant'|'suture'|'ether'|'jar',x,y}], torches:[{x,y}], pending:[] }
 *   planShift(world, playerTile, rng)        -> gates elegidas; las marca con warn=true (el aviso de ~2 s)
 *   applyShift(world, playerTile, occupied)  -> {opened, closed, cancelled}: aplica lo planeado. Un cierre se cancela si
 *                                               la casilla está en `occupied` ([{x,y}]; el jugador siempre cuenta) o si
 *                                               dejaría sin camino playerTile → salida (validado con BFS).
 *   shift(world, playerTile, rng, occupied)  -> planShift + applyShift en un paso
 *   dist(world, x, y, maxD?)                 -> Int16Array(w*h) con la distancia BFS por casillas transitables (-1 = no llega)
 *   connected(world, ax, ay, bx, by)         -> bool
 *   passable(world, x, y)                    -> suelo o compuerta abierta (false fuera de la rejilla)
 *   gateAt(world, x, y)                      -> gate o null
 */
(function () {
  'use strict';
  var DD = window.DD;
  var CFG = DD.CFG;
  var Tower = DD.Tower = {};

  var T = Tower.T = { FLOOR: 0, WALL: 1, GATE_C: 2, GATE_O: 3 };
  var MW = CFG.MAP_W, MH = CFG.MAP_H;
  var CW = (MW - 1) >> 1, CH = (MH - 1) >> 1;           // laberinto de 15×8 celdas

  /* ---------- Rangos (§10.1) ---------- */
  var ENEMY_N = [[4, 5], [5, 6], [6, 7]];                // por piso
  var TRAP_N = [6, 10];
  var RES_N = { vial: [3, 4], coolant: [2, 3], suture: [2, 3], ether: [4, 6], jar: [1, 2] };
  var GATE_N = [10, 16];
  var ROOM_N = [2, 4];
  var LOOPS_N = [6, 10];                                 // muros extra que se quitan (bucles)
  var ROOM_SIZES = [[3, 2], [3, 2], [3, 2], [2, 2], [4, 2], [3, 3]];   // en celdas: 3×2 celdas = sala de 5×3 casillas
  var MIN_PATH = 84;                                     // camino mínimo inicio→salida (casillas) para aceptar un piso
var EXIT_MANH = 18;                                    // distancia mínima (Manhattan, casillas) entre inicio y salida
var START_TRIES = 6;                                   // esquinas candidatas para el inicio
  var GATE_LOOP_SHARE = 0.6;                             // fracción de compuertas sobre bucles (cerrarlas nunca desconecta)
  var GATE_CLOSED_P = 0.4;                               // probabilidad de empezar cerrada
  var P_CLOSE = 0.3, P_OPEN = 0.5;                       // probabilidad de cambiar en cada cambio de laberinto
  var FLIPS_MIN = 3, FLIPS_MAX = 9;
  var FALLBACK_POOL = [['sabueso', 'ayudante', 'golem'],
    ['sabueso', 'ayudante', 'golem', 'alquimista', 'arana', 'cirujano', 'automata'],
    ['golem', 'alquimista', 'arana', 'cirujano', 'automata', 'quimera', 'relojero', 'vivisector']];

  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function idx(x, y) { return y * MW + x; }
  function inb(x, y) { return x >= 0 && y >= 0 && x < MW && y < MH; }
  function walk(t) { return t === T.FLOOR || t === T.GATE_O; }
  function manh(ax, ay, bx, by) { return Math.abs(ax - bx) + Math.abs(ay - by); }
  function range(rng, r) { return DD.randInt(rng, r[0], r[1]); }

  /* ---------- Consultas (también las usa explore) ---------- */
  Tower.passable = function (world, x, y) { return inb(x, y) && walk(world.tiles[idx(x, y)]); };

  Tower.gateAt = function (world, x, y) {
    for (var i = 0; i < world.gates.length; i++) if (world.gates[i].x === x && world.gates[i].y === y) return world.gates[i];
    return null;
  };

  var QUEUE = new Int16Array(MW * MH);                   // buffers compartidos (la lógica es síncrona)
  var MARK = new Int32Array(MW * MH), stamp = 0;

  // BFS por casillas transitables. Con d (Int16Array) rellena distancias; sin d solo marca visitadas y devuelve si llega a (tx,ty)
  function bfs(world, x, y, maxD, d, tx, ty) {
    var tiles = world.tiles, h = 0, t = 0, i, k, target = tx == null ? -1 : idx(tx, ty);
    if (!inb(x, y)) return false;
    stamp++;
    var s0 = idx(x, y);
    MARK[s0] = stamp; QUEUE[t++] = s0;
    if (d) d[s0] = 0;
    if (s0 === target) return true;
    while (h < t) {
      i = QUEUE[h++];
      var di = d ? d[i] : 0;
      if (d && di >= maxD) continue;
      var cx = i % MW, cy = (i / MW) | 0;
      for (k = 0; k < 4; k++) {
        var nx = cx + DIRS[k][0], ny = cy + DIRS[k][1];
        if (!inb(nx, ny)) continue;
        var ni = idx(nx, ny);
        if (MARK[ni] === stamp || !walk(tiles[ni])) continue;
        MARK[ni] = stamp;
        if (ni === target) return true;
        if (d) d[ni] = di + 1;
        QUEUE[t++] = ni;
      }
    }
    return false;
  }

  Tower.dist = function (world, x, y, maxD) {
    var d = new Int16Array(MW * MH);
    for (var i = 0; i < d.length; i++) d[i] = -1;
    bfs(world, x, y, maxD == null ? 9999 : maxD, d);
    return d;
  };

  Tower.connected = function (world, ax, ay, bx, by) {
    return inb(bx, by) && bfs(world, ax, ay, 0, null, bx, by);
  };

  /* ---------- Laberinto ---------- */
  function carveMaze(tiles, rng) {                       // backtracker recursivo (iterativo) sobre las celdas
    var seen = new Uint8Array(CW * CH), stack = [], sx = DD.randInt(rng, 0, CW - 1), sy = DD.randInt(rng, 0, CH - 1);
    seen[sy * CW + sx] = 1; tiles[idx(2 * sx + 1, 2 * sy + 1)] = T.FLOOR;
    stack.push([sx, sy]);
    while (stack.length) {
      var c = stack[stack.length - 1], opts = [], k;
      for (k = 0; k < 4; k++) {
        var nx = c[0] + DIRS[k][0], ny = c[1] + DIRS[k][1];
        if (nx >= 0 && ny >= 0 && nx < CW && ny < CH && !seen[ny * CW + nx]) opts.push(DIRS[k]);
      }
      if (!opts.length) { stack.pop(); continue; }
      var o = DD.pick(rng, opts), ex = c[0] + o[0], ey = c[1] + o[1];
      tiles[idx(2 * c[0] + 1 + o[0], 2 * c[1] + 1 + o[1])] = T.FLOOR;     // pasaje entre celdas
      tiles[idx(2 * ex + 1, 2 * ey + 1)] = T.FLOOR;
      seen[ey * CW + ex] = 1;
      stack.push([ex, ey]);
    }
  }

  function addLoops(tiles, rng, n) {                     // quita muros entre celdas; devuelve las casillas abiertas
    var walls = [], out = [], x, y;
    for (y = 0; y < CH; y++) {
      for (x = 0; x < CW; x++) {
        if (x < CW - 1 && tiles[idx(2 * x + 2, 2 * y + 1)] === T.WALL) walls.push(idx(2 * x + 2, 2 * y + 1));
        if (y < CH - 1 && tiles[idx(2 * x + 1, 2 * y + 2)] === T.WALL) walls.push(idx(2 * x + 1, 2 * y + 2));
      }
    }
    DD.shuffle(rng, walls);
    for (var i = 0; i < n && i < walls.length; i++) { tiles[walls[i]] = T.FLOOR; out.push(walls[i]); }
    return out;
  }

  function pickStart(rng) {                              // celda cercana a una esquina al azar
    var corner = DD.randInt(rng, 0, 3), jx = DD.randInt(rng, 0, 2), jy = DD.randInt(rng, 0, 1);
    return { cx: (corner & 1) ? CW - 1 - jx : jx, cy: (corner & 2) ? CH - 1 - jy : jy };
  }

  function addRooms(w, rng, startC, exitC) {
    var want = range(rng, ROOM_N), rects = [], tries = 0;
    function clear(r, o, m) {                            // ¿r y o (en celdas) quedan separados por m celdas?
      return r.cx + r.cw + m <= o.cx || o.cx + o.cw + m <= r.cx || r.cy + r.ch + m <= o.cy || o.cy + o.ch + m <= r.cy;
    }
    while (rects.length < want && tries++ < 60) {
      var s = DD.pick(rng, ROOM_SIZES);
      var r = { cx: DD.randInt(rng, 0, CW - s[0]), cy: DD.randInt(rng, 0, CH - s[1]), cw: s[0], ch: s[1] };
      var ok = clear(r, { cx: startC.cx, cy: startC.cy, cw: 1, ch: 1 }, 2) && clear(r, { cx: exitC.cx, cy: exitC.cy, cw: 1, ch: 1 }, 2);
      for (var i = 0; ok && i < rects.length; i++) ok = clear(r, rects[i], 1);
      if (ok) rects.push(r);
    }
    rects.forEach(function (r) {
      var x0 = 2 * r.cx + 1, y0 = 2 * r.cy + 1, x1 = 2 * (r.cx + r.cw - 1) + 1, y1 = 2 * (r.cy + r.ch - 1) + 1;
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) { w.tiles[idx(x, y)] = T.FLOOR; w.roomMask[idx(x, y)] = 1; }
      w.rooms.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
    });
  }

  /* ---------- Compuertas ---------- */
  function addGates(w, rng, doors) {                     // doors = {loop:[idx], tree:[idx]} (solo casillas abiertas fuera de salas)
    var n = range(rng, GATE_N), nLoop = Math.min(doors.loop.length, Math.round(n * GATE_LOOP_SHARE));
    var pick = DD.shuffle(rng, doors.loop.slice()).slice(0, nLoop);
    pick = pick.concat(DD.shuffle(rng, doors.tree.slice()).slice(0, n - pick.length));
    pick.forEach(function (i) {
      w.tiles[i] = T.GATE_O;
      w.gates.push({ x: i % MW, y: (i / MW) | 0, open: true, warn: false });
    });
    DD.shuffle(rng, w.gates.slice()).forEach(function (g) {             // cierra algunas, sin desconectar inicio y salida
      if (rng() >= GATE_CLOSED_P) return;
      setGate(w, g, false);
      if (!Tower.connected(w, w.start.x, w.start.y, w.exit.x, w.exit.y)) setGate(w, g, true);
    });
  }

  function setGate(w, g, open) {
    g.open = open;
    w.tiles[idx(g.x, g.y)] = open ? T.GATE_O : T.GATE_C;
  }

  /* ---------- Contenido ---------- */
  function enemyPool(f) {
    var fl = DD.FLOORS && DD.FLOORS[f];
    return fl && fl.enemies && fl.enemies.length ? fl.enemies : FALLBACK_POOL[f] || FALLBACK_POOL[0];
  }

  function isElite(id) { return !!(DD.ENEMIES && DD.ENEMIES[id] && DD.ENEMIES[id].elite); }

  function fillContent(w, rng, startDist) {
    var f = w.floor, occ = new Uint8Array(MW * MH), cand = [], dead = [], inRoom = [], i;
    for (i = 0; i < MW * MH; i++) {
      if (w.tiles[i] !== T.FLOOR) continue;
      var x = i % MW, y = (i / MW) | 0;
      if (manh(x, y, w.start.x, w.start.y) < 3 || manh(x, y, w.exit.x, w.exit.y) < 3) continue;
      cand.push(i);
      if (w.roomMask[i]) inRoom.push(i);
      var open = 0;
      for (var k = 0; k < 4; k++) if (walk(w.tiles[idx(x + DIRS[k][0], y + DIRS[k][1])])) open++;
      if (open === 1) dead.push(i);
    }
    DD.shuffle(rng, cand); DD.shuffle(rng, dead); DD.shuffle(rng, inRoom);
    var px = [], py = [];                                // casillas ocupadas por cualquier cosa

    function take(list, ok) {                            // primera casilla libre de list que cumpla ok
      for (var j = 0; j < list.length; j++) {
        var t = list[j];
        if (occ[t] || (ok && !ok(t % MW, (t / MW) | 0, t))) continue;
        occ[t] = 1; px.push(t % MW); py.push((t / MW) | 0);
        return t;
      }
      return -1;
    }
    function far(x, y, min) {                            // a ≥ min casillas (Manhattan) de todo lo ya colocado
      for (var j = 0; j < px.length; j++) if (manh(x, y, px[j], py[j]) < min) return false;
      return true;
    }
    function put(list, ok, min) {                        // intenta con separación min y la relaja si no hay sitio
      var t = take(list, function (x, y, tt) { return far(x, y, min) && (!ok || ok(x, y, tt)); });
      return t >= 0 ? t : take(list, ok);
    }

    // Enemigos: lejos del inicio; a lo sumo un élite, y en el piso 2 siempre uno (si el pool lo trae)
    var pool = enemyPool(f), normal = pool.filter(function (id) { return !isElite(id); });
    var elite = pool.filter(isElite)[0];
    var nEn = range(rng, ENEMY_N[f] || ENEMY_N[0]), counts = {}, ids = [];
    if (elite && f === CFG.FLOORS - 1) { ids.push(elite); nEn--; }
    while (nEn-- > 0) {
      var wts = normal.map(function (id) { return 1 / (1 + (counts[id] || 0)); }), sum = 0, r;
      wts.forEach(function (v) { sum += v; });
      r = rng() * sum;
      var pickId = normal[normal.length - 1];
      for (i = 0; i < normal.length; i++) { r -= wts[i]; if (r <= 0) { pickId = normal[i]; break; } }
      counts[pickId] = (counts[pickId] || 0) + 1; ids.push(pickId);
    }
    ids.forEach(function (id) {
      var minD = isElite(id) ? Math.round(w.pathLen * 0.5) : 12;
      var t = put(cand, function (x, y, tt) { return startDist[tt] >= minD; }, 5);
      if (t >= 0) w.enemies.push({ id: id, x: t % MW, y: (t / MW) | 0 });
    });

    // Trampas: ácido en salas (se puede rodear); pinchos y vapor, cíclicos, en cualquier parte
    var nTr = range(rng, TRAP_N), kinds = [];
    for (i = 0; i < nTr; i++) kinds.push(i % 10 < 4 ? 'spikes' : (i % 10 < 7 ? 'acid' : 'steam'));
    DD.shuffle(rng, kinds);
    kinds.forEach(function (kind) {
      var list = kind === 'acid' && inRoom.length ? inRoom : cand;
      var t = put(list, function (x, y, tt) { return startDist[tt] >= 6; }, 3);
      if (t >= 0) w.traps.push({ kind: kind, x: t % MW, y: (t / MW) | 0, phase: Math.round(rng() * 1000) / 1000 });
    });

    // Recursos: los valiosos prefieren callejones sin salida
    Object.keys(RES_N).forEach(function (kind) {
      var n = range(rng, RES_N[kind]);
      for (var j = 0; j < n; j++) {
        var wantDead = kind !== 'ether' && rng() < 0.6;
        var t = wantDead ? put(dead, null, 2) : -1;
        if (t < 0) t = put(cand, null, 2);
        if (t >= 0) w.items.push({ kind: kind, x: t % MW, y: (t / MW) | 0 });
      }
    });
  }

  function addTorches(w, rng) {                          // antorchas en muros con suelo al sur, bien repartidas
    var list = [];
    for (var y = 0; y < MH - 1; y++) {
      for (var x = 1; x < MW - 1; x++) {
        if (w.tiles[idx(x, y)] === T.WALL && w.tiles[idx(x, y + 1)] === T.FLOOR) list.push({ x: x, y: y });
      }
    }
    DD.shuffle(rng, list);
    var want = DD.randInt(rng, 9, 13);
    for (var i = 0; i < list.length && w.torches.length < want; i++) {
      var c = list[i], ok = true;
      for (var j = 0; ok && j < w.torches.length; j++) ok = manh(c.x, c.y, w.torches[j].x, w.torches[j].y) >= 6;
      if (ok) w.torches.push(c);
    }
  }

  /* ---------- Generación ---------- */
  function layout(f, rng) {                              // laberinto + bucles + inicio/salida + salas
    var w = {
      floor: f, w: MW, h: MH, tiles: new Uint8Array(MW * MH), roomMask: new Uint8Array(MW * MH),
      gates: [], rooms: [], start: null, exit: null, pathLen: 0,
      enemies: [], traps: [], items: [], torches: [], pending: [], shifts: 0
    };
    var x, y;
    for (var i = 0; i < w.tiles.length; i++) w.tiles[i] = T.WALL;
    carveMaze(w.tiles, rng);
    w.loops = addLoops(w.tiles, rng, range(rng, LOOPS_N));

    // Inicio cerca de una esquina; salida en la celda más lejana por camino (probamos varios inicios y nos quedamos con el mejor)
    var sc = null, ex = 0, ey = 0, best = -1;
    for (var n = 0; n < START_TRIES; n++) {
      var c = pickStart(rng), sx = 2 * c.cx + 1, sy = 2 * c.cy + 1, d0 = Tower.dist(w, sx, sy);
      for (y = 0; y < CH; y++) {
        for (x = 0; x < CW; x++) {
          var dd = d0[idx(2 * x + 1, 2 * y + 1)];
          if (dd > best && manh(2 * x + 1, 2 * y + 1, sx, sy) >= EXIT_MANH) { best = dd; sc = c; ex = x; ey = y; }
        }
      }
    }
    w.start = { x: 2 * sc.cx + 1, y: 2 * sc.cy + 1 };
    w.exit = { x: 2 * ex + 1, y: 2 * ey + 1, kind: f >= CFG.FLOORS - 1 ? 'exit' : 'stairs' };
    addRooms(w, rng, sc, { cx: ex, cy: ey });
    w.pathLen = Tower.dist(w, w.start.x, w.start.y)[idx(w.exit.x, w.exit.y)];
    return w;
  }

  function populate(w, rng) {                            // compuertas, enemigos, trampas, recursos y antorchas
    // Casillas candidatas a compuerta: pasajes abiertos fuera de salas y lejos de inicio/salida
    var loopSet = {}, doors = { loop: [], tree: [] }, x, y, i;
    w.loops.forEach(function (t) { loopSet[t] = true; });
    for (y = 1; y < MH - 1; y++) {
      for (x = 1; x < MW - 1; x++) {
        i = idx(x, y);
        if ((x & 1) === (y & 1) || w.tiles[i] !== T.FLOOR || w.roomMask[i]) continue;      // solo casillas "puerta"
        if (manh(x, y, w.start.x, w.start.y) < 3 || manh(x, y, w.exit.x, w.exit.y) < 3) continue;
        (loopSet[i] ? doors.loop : doors.tree).push(i);
      }
    }
    addGates(w, rng, doors);
    fillContent(w, rng, Tower.dist(w, w.start.x, w.start.y));
    addTorches(w, rng);
    delete w.roomMask; delete w.loops;
    return w;
  }

  Tower.generate = function (floorIndex, rng) {
    var f = DD.clamp(floorIndex | 0, 0, CFG.FLOORS - 1), best = null;
    rng = rng || DD.rng;
    for (var n = 0; n < 12; n++) {                       // reintenta hasta que el camino sea lo bastante largo
      var w = layout(f, rng);
      if (!best || w.pathLen > best.pathLen) best = w;
      if (w.pathLen >= MIN_PATH) break;
    }
    return populate(best, rng);
  };

  /* ---------- Cambios de laberinto ---------- */
  function pathGates(w, pt) {                            // compuertas abiertas sobre un camino más corto jugador → salida
    var d = Tower.dist(w, w.exit.x, w.exit.y), x = pt.x, y = pt.y, out = [];
    if (!inb(x, y) || d[idx(x, y)] < 0) return out;
    while (d[idx(x, y)] > 0) {
      var cur = d[idx(x, y)], moved = false;
      for (var k = 0; k < 4 && !moved; k++) {
        var nx = x + DIRS[k][0], ny = y + DIRS[k][1];
        if (inb(nx, ny) && d[idx(nx, ny)] === cur - 1) { x = nx; y = ny; moved = true; }
      }
      var g = Tower.gateAt(w, x, y);
      if (g && g.open) out.push(g);
    }
    return out;
  }

  Tower.planShift = function (w, pt, rng) {
    w.gates.forEach(function (g) { g.warn = false; });
    var flips = w.gates.filter(function (g) { return rng() < (g.open ? P_CLOSE : P_OPEN); });
    if (rng() < 0.5) {                                   // a veces toca la ruta más corta: obliga a replantear el camino
      var onPath = pathGates(w, pt);
      if (onPath.length) {
        var g0 = DD.pick(rng, onPath);
        if (flips.indexOf(g0) < 0) flips.push(g0);
      }
    }
    var rest = DD.shuffle(rng, w.gates.filter(function (g) { return flips.indexOf(g) < 0; }));
    while (flips.length < FLIPS_MIN && rest.length) flips.push(rest.pop());
    DD.shuffle(rng, flips);
    flips = flips.slice(0, FLIPS_MAX);
    flips.forEach(function (g) { g.warn = true; });
    w.pending = flips;
    return flips;
  };

  Tower.applyShift = function (w, pt, occupied) {
    var res = { opened: [], closed: [], cancelled: [] }, busy = {};
    (occupied || []).forEach(function (o) { busy[idx(o.x, o.y)] = true; });
    busy[idx(pt.x, pt.y)] = true;
    var pend = w.pending || [];
    pend.forEach(function (g) { g.warn = false; });
    pend.forEach(function (g) {                          // primero abrir: nunca perjudica
      if (!g.open) { setGate(w, g, true); res.opened.push(g); }
    });
    pend.forEach(function (g) {
      if (!g.open || res.opened.indexOf(g) >= 0) return;
      setGate(w, g, false);
      if (busy[idx(g.x, g.y)] || !Tower.connected(w, pt.x, pt.y, w.exit.x, w.exit.y)) {
        setGate(w, g, true); res.cancelled.push(g);
      } else {
        res.closed.push(g);
      }
    });
    w.pending = [];
    w.shifts++;
    return res;
  };

  Tower.shift = function (w, pt, rng, occupied) {
    Tower.planShift(w, pt, rng);
    return Tower.applyShift(w, pt, occupied);
  };
})();
