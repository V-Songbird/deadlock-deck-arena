/* Deadlock Deck: El Reloj Anatómico — exploración (W4)
 * Escena `explore`: mapa de la torre, niebla, movimiento, fuego, trampas, enemigos, recursos y salida (§10.2).
 * Todo el estado vive en DD.run.world (lo crea DD.Tower.generate y aquí se le añade el estado de ejecución):
 * un combate o una cosecha en medio ni lo pierden ni lo hacen avanzar, porque update() no corre durante ellos.
 * Coordenadas: píxeles del mapa (0..PW, 0..PH), origen en (MAP_X, MAP_Y) de la pantalla; casilla = 16 px.
 */
(function () {
  'use strict';
  var DD = window.DD;
  var C = DD.C, CFG = DD.CFG;
  var TS = DD.TILE, MW = CFG.MAP_W, MH = CFG.MAP_H, MX = CFG.MAP_X, MY = CFG.MAP_Y, PW = MW * TS, PH = MH * TS;

  /* ---------- Ajustes ---------- */
  var PLAYER_SPEED = 58;                       // px/s × stats.speed
  var HALF = 5;                                // semicaja del jugador (10×10)
  var ENEMY_SPEED = 42, WANDER_MUL = 0.55;     // px/s × enemigo.speed al perseguir; deambular es más lento
  var CONTACT = 11;                            // px entre centros para iniciar combate
  var INVULN = 1.5;                            // s sin contacto tras volver de un combate
  var SHIFT_EVERY = 18, SHIFT_FIRST = 13, SHIFT_WARN = 2;
  var FIRE_CAP = 0.18, FIRE_LIFE = [20, 45];   // tope de fuego (fracción del piso) y duración de cada casilla (s)
  var FIRE_DMG = 4, FIRE_CD = 0.7, FIRE_LEG_HEAT = 6;
  var SPIKE_DMG = 5, SPIKE_CD = 1.2, ACID_DMG = 3, ACID_WEAR = 6, ACID_CD = 1.5, STEAM_HEAT = 18, STEAM_CD = 1.2;
  var TIER_W = [[6, 3, 1], [3, 5, 2], [1, 4, 6]];          // peso de los tarros por tier (1..3) según el piso
  var BROKE = { head: '¡Cabeza rota!', torso: '¡Torso roto!', arm: '¡Brazo roto!', leg: '¡Pierna rota!' };
  var D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var MULT = [[1, 0, 0, -1, -1, 0, 0, 1], [0, 1, -1, 0, 0, -1, 1, 0], [0, 1, 1, 0, 0, -1, -1, 0], [1, 0, 0, 1, -1, 0, 0, -1]];
  var FOG = '#05030a';

  var W = null;                                // mundo actual (= DD.run.world)
  var T = null;                                // DD.Tower.T
  var floats = [], parts = [], glows = {};

  function sfx(n, v) { if (DD.Audio && DD.Audio.sfx) DD.Audio.sfx(n, v); }
  function idx(x, y) { return y * MW + x; }
  function tileOf(v) { return Math.floor(v / TS); }
  function rnd() { return W.rng(); }
  function alive() { return !!(W && DD.scene === scene && DD.run && DD.run.started && DD.run.world === W); }

  function solid(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true;
    var t = W.tiles[ty * MW + tx];
    return t === T.WALL || t === T.GATE_C;
  }
  function boxHit(cx, cy) {
    var x0 = tileOf(cx - HALF), x1 = tileOf(cx + HALF - 0.01), y0 = tileOf(cy - HALF), y1 = tileOf(cy + HALF - 0.01);
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) if (solid(x, y)) return true;
    return false;
  }

  /* ---------- Textos flotantes y partículas ---------- */
  function say(str, x, y, color) {
    var dy = 0;
    floats.forEach(function (f) { if (f.t < 0.5 && Math.abs(f.x - x) < 40 && Math.abs(f.y - y) < 10) dy = Math.max(dy, 9); });
    floats.push({ s: str, x: x, y: y - dy, t: 0, c: color || C.ink });
  }
  function sayAtPlayer(str, color) { say(str, W.p.x, W.p.y - 10, color); }

  function ember(x, y) {
    if (parts.length > 90) return;
    parts.push({ x: x + rnd() * TS, y: y + rnd() * TS * 0.6, vx: (rnd() - 0.5) * 8, vy: -(9 + rnd() * 16), t: 0, max: 0.7 + rnd() * 1.3,
      c: [C.fire1, C.fire2, C.fire3][(rnd() * 3) | 0] });
  }

  function glowImg(key, r, rgb, amax) {          // halo de luz con alpha escalonado (se compone con 'lighter')
    if (glows[key]) return glows[key];
    var c = document.createElement('canvas'), g, im, d, x, y;
    c.width = c.height = r * 2;
    g = c.getContext('2d'); im = g.createImageData(r * 2, r * 2); d = im.data;
    for (y = 0; y < r * 2; y++) {
      for (x = 0; x < r * 2; x++) {
        var dist = Math.sqrt((x + 0.5 - r) * (x + 0.5 - r) + (y + 0.5 - r) * (y + 0.5 - r)) / r;
        if (dist >= 1) continue;
        var a = Math.floor(Math.pow(1 - dist, 1.6) * 6) / 6 * amax, o = (y * r * 2 + x) * 4;
        d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = Math.round(a * 255);
      }
    }
    g.putImageData(im, 0, 0);
    return (glows[key] = c);
  }

  /* ---------- Creación del piso ---------- */
  function startFloor() {
    var run = DD.run;
    var rng = DD.mulberry32((run.seed ^ Math.imul(run.floor + 1, 0x9E3779B1)) >>> 0);
    var w = DD.Tower.generate(run.floor, rng);
    initRuntime(w, rng);
    run.world = w;
    W = w;
  }

  function initRuntime(w, rng) {
    var n = MW * MH, i;
    w.built = true; w.rng = rng; w.t = 0; w.ver = 0;
    w.seen = new Uint8Array(n); w.vis = new Uint8Array(n);
    w.p = { x: w.start.x * TS + TS / 2, y: w.start.y * TS + TS / 2, dir: 1, walked: 0, step: 0, moving: false, invuln: 0, vx: -1, vy: -1, vr: -1 };
    w.shiftT = SHIFT_FIRST; w.warning = false; w.beeped = false;
    w.torchAt = new Uint8Array(n);
    w.torches.forEach(function (t) { w.torchAt[idx(t.x, t.y)] = 1; });
    w.enemies.forEach(function (e) {
      e.tx = e.x; e.ty = e.y; e.px = e.x * TS + TS / 2; e.py = e.y * TS + TS / 2; e.nx = -1; e.ny = -1;
      e.state = 'wander'; e.wait = rng() * 2; e.alert = 0; e.face = rng() < 0.5 ? 1 : -1; e.anim = rng() * 4; e.dead = false; e.direct = false;
    });
    w.traps.forEach(function (t) { t.cd = 0; });
    w.items.forEach(function (it) { it.taken = false; it.ph = rng() * 6.28; });
    w.field = null; w.fieldT = 0; w.fieldAt = -1; w.pf = null;
    w.fireCd = 0; w.noteCd = 0; w.cool = 0;
    w.banner = 3.4; w.hint = w.floor === 0 ? 11 : 0;
    w.count = 0;
    for (i = 0; i < n; i++) if (w.tiles[i] !== T.WALL) w.count++;
    initFire(w);
  }

  /* ---------- Fuego ---------- */
  function initFire(w) {
    var n = MW * MH, i, k, tries;
    w.fire = new Float32Array(n); w.fireAge = new Float32Array(n); w.fireList = []; w.fireAcc = 0; w.noFire = new Uint8Array(n);
    function block(x, y, r) { for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < MW && y + dy < MH) w.noFire[idx(x + dx, y + dy)] = 1; }
    block(w.start.x, w.start.y, 1); block(w.exit.x, w.exit.y, 1);
    w.gates.forEach(function (g) { w.noFire[idx(g.x, g.y)] = 1; });
    w.traps.forEach(function (t) { w.noFire[idx(t.x, t.y)] = 1; });
    w.items.forEach(function (t) { w.noFire[idx(t.x, t.y)] = 1; });
    var fl = DD.Run && DD.Run.fireLevel ? DD.Run.fireLevel() : 0;
    var seeds = 4 + w.floor, extra = Math.round(fireCap(w) * fl * 0.5);
    var near = [], d = DD.Tower.dist(w, w.start.x, w.start.y, 14);          // las dos primeras, a la vista de los primeros pasos
    for (i = 0; i < n; i++) if (d[i] >= 6 && d[i] <= 14) near.push(i);
    DD.shuffle(w.rng, near);
    for (k = 0; k < 2 && k < near.length; k++) igniteAt(w, near[k], true);
    for (k = w.fireList.length; k < seeds + extra; k++) {
      for (tries = 0; tries < 40; tries++) {
        if (k < seeds || !w.fireList.length) i = randomFireTile(w); else i = fireNeighbor(w);
        if (i >= 0 && igniteAt(w, i, true)) break;
      }
    }
  }
  function fireCap(w) { return Math.floor(w.count * FIRE_CAP); }
  function farFromStart(w, i) {                  // nunca a menos de 3 casillas del inicio al entrar
    var x = i % MW, y = (i / MW) | 0;
    return Math.abs(x - w.start.x) + Math.abs(y - w.start.y) > 4;
  }
  function randomFireTile(w) {
    return idx(1 + ((w.rng() * (MW - 2)) | 0), 1 + ((w.rng() * (MH - 2)) | 0));
  }
  function fireNeighbor(w) {                     // vecina de una casilla en llamas
    var b = w.fireList[(w.rng() * w.fireList.length) | 0], d = D4[(w.rng() * 4) | 0];
    var x = (b % MW) + d[0], y = ((b / MW) | 0) + d[1];
    return x > 0 && y > 0 && x < MW - 1 && y < MH - 1 ? idx(x, y) : -1;
  }
  function igniteAt(w, i, fresh) {
    if (w.fire[i] > 0 || w.noFire[i] || w.tiles[i] !== T.FLOOR) return false;
    if (fresh && !farFromStart(w, i)) return false;
    if (!fresh) {                                // durante la partida tampoco prende encima del jugador
      var dx = (i % MW) - w.p.x / TS, dy = ((i / MW) | 0) - w.p.y / TS;
      if (dx * dx + dy * dy < 6) return false;
    }
    var life = FIRE_LIFE[0] + w.rng() * (FIRE_LIFE[1] - FIRE_LIFE[0]);
    w.fire[i] = fresh ? life * (0.3 + 0.7 * w.rng()) : life;
    w.fireAge[i] = fresh ? 2 : 0;
    w.fireList.push(i);
    return true;
  }
  function updateFire(dt) {
    var fl = DD.Run.fireLevel(), i, k;
    for (k = W.fireList.length - 1; k >= 0; k--) {           // se consumen solas: el fuego "viaja" en vez de tapar el piso
      i = W.fireList[k];
      W.fire[i] -= dt; W.fireAge[i] += dt;
      if (W.fire[i] <= 0) { W.fire[i] = 0; W.fireList.splice(k, 1); }
    }
    W.fireAcc += (0.15 + 1.5 * Math.pow(fl, 1.3)) * dt;            // ignición por segundo: sube con el reloj
    while (W.fireAcc >= 1) {
      W.fireAcc -= 1;
      if (W.fireList.length >= fireCap(W)) continue;
      for (k = 0; k < 8; k++) {
        i = W.fireList.length && rnd() < 0.85 ? fireNeighbor(W) : randomFireTile(W);
        if (i >= 0 && igniteAt(W, i, false)) break;
      }
    }
  }

  /* ---------- Visión (sombras recursivas) ---------- */
  function light(cx, cy, row, start, end, r, xx, xy, yx, yy) {
    if (start < end) return;
    var r2 = (r + 0.5) * (r + 0.5), newStart = start;
    for (var j = row; j <= r; j++) {
      var dx = -j - 1, dy = -j, blocked = false;
      while (dx <= 0) {
        dx++;
        var X = cx + dx * xx + dy * xy, Y = cy + dx * yx + dy * yy;
        var lSlope = (dx - 0.5) / (dy + 0.5), rSlope = (dx + 0.5) / (dy - 0.5);
        if (start < rSlope) continue;
        if (end > lSlope) break;
        if (X >= 0 && Y >= 0 && X < MW && Y < MH && dx * dx + dy * dy <= r2) W.vis[idx(X, Y)] = 1;
        if (blocked) {
          if (solid(X, Y)) { newStart = rSlope; continue; }
          blocked = false; start = newStart;
        } else if (solid(X, Y) && j < r) {
          blocked = true;
          light(cx, cy, j + 1, start, lSlope, r, xx, xy, yx, yy);
          newStart = rSlope;
        }
      }
      if (blocked) break;
    }
  }
  function updateVision(force, st) {
    var p = W.p, tx = tileOf(p.x), ty = tileOf(p.y), r = Math.max(1, Math.round(st.vision));
    if (!force && tx === p.vx && ty === p.vy && r === p.vr) return;
    p.vx = tx; p.vy = ty; p.vr = r;
    W.vis.fill(0);
    W.vis[idx(tx, ty)] = 1;
    for (var o = 0; o < 8; o++) light(tx, ty, 1, 1.0, 0.0, r, MULT[0][o], MULT[1][o], MULT[2][o], MULT[3][o]);
    for (var i = 0; i < W.vis.length; i++) if (W.vis[i]) W.seen[i] = 1;
  }

  /* ---------- Jugador ---------- */
  function tryMove(p, dx, dy) {                  // avanza con colisión en pasos de ≤1 px; devuelve lo que se movió
    var n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)))), sx = dx / n, sy = dy / n, moved = 0;
    for (var i = 0; i < n; i++) {
      if (sx && !boxHit(p.x + sx, p.y)) { p.x += sx; moved += Math.abs(sx); }
      if (sy && !boxHit(p.x, p.y + sy)) { p.y += sy; moved += Math.abs(sy); }
    }
    return moved;
  }
  function assist(p, vx, vy, want, got) {        // si choca en una esquina, desliza hacia el centro del pasillo
    if (got >= want - 0.05) return;
    var off;
    if (vx && !vy) { off = tileOf(p.y) * TS + TS / 2 - p.y; if (Math.abs(off) <= 6) tryMove(p, 0, DD.clamp(off, -want, want)); }
    else if (vy && !vx) { off = tileOf(p.x) * TS + TS / 2 - p.x; if (Math.abs(off) <= 6) tryMove(p, DD.clamp(off, -want, want), 0); }
  }

  function pathField(gx, gy) {                   // distancias BFS hacia una casilla (se reutiliza mientras no cambie nada)
    var pf = W.pf;
    if (!pf || pf.gx !== gx || pf.gy !== gy || pf.ver !== W.ver) pf = W.pf = { gx: gx, gy: gy, ver: W.ver, f: DD.Tower.dist(W, gx, gy) };
    return pf.f;
  }
  function nearestPassable(gx, gy, tx, ty) {
    var best = null, bd = 1e9;
    for (var r = 0; r <= 2 && !best; r++) {
      for (var y = gy - r; y <= gy + r; y++) {
        for (var x = gx - r; x <= gx + r; x++) {
          if (!DD.Tower.passable(W, x, y)) continue;
          var d = (x * TS + 8 - tx) * (x * TS + 8 - tx) + (y * TS + 8 - ty) * (y * TS + 8 - ty);
          if (d < bd) { bd = d; best = { x: x, y: y }; }
        }
      }
    }
    return best;
  }
  function pointerVec() {                        // puntero mantenido en el área de juego: camina hacia él por el laberinto
    var m = DD.Input.mouse, p = W.p;
    W.ptr = null;
    if (!m.down || m.y < DD.SAFE.top || m.y >= DD.SAFE.bottom) return null;
    var tx = DD.clamp(m.x - MX, 0, PW - 1), ty = DD.clamp(m.y - MY, 0, PH - 1);
    W.ptr = { x: tx, y: ty };
    var g = DD.Tower.passable(W, tileOf(tx), tileOf(ty)) ? { x: tileOf(tx), y: tileOf(ty) } : nearestPassable(tileOf(tx), tileOf(ty), tx, ty);
    if (!g) return { x: tx - p.x, y: ty - p.y };
    if (g.x !== tileOf(tx) || g.y !== tileOf(ty)) { tx = g.x * TS + TS / 2; ty = g.y * TS + TS / 2; }
    var px = tileOf(p.x), py = tileOf(p.y);
    if (px === g.x && py === g.y) return { x: tx - p.x, y: ty - p.y };
    var f = pathField(g.x, g.y), d = f[idx(px, py)];
    if (d < 0) return { x: tx - p.x, y: ty - p.y };          // no hay camino ahora mismo: empuja hacia allí
    for (var k = 0; k < 4; k++) {
      var nx = px + D4[k][0], ny = py + D4[k][1];
      if (nx >= 0 && ny >= 0 && nx < MW && ny < MH && f[idx(nx, ny)] === d - 1) return { x: nx * TS + TS / 2 - p.x, y: ny * TS + TS / 2 - p.y };
    }
    return null;
  }

  function movePlayer(dt, st) {
    var p = W.p, In = DD.Input;
    var vx = (In.down('right') ? 1 : 0) - (In.down('left') ? 1 : 0), vy = (In.down('down') ? 1 : 0) - (In.down('up') ? 1 : 0);
    var pv = pointerVec();
    if (!vx && !vy && pv) {
      var len = Math.sqrt(pv.x * pv.x + pv.y * pv.y);
      if (len > 1.5) { vx = pv.x / len; vy = pv.y / len; }
    } else if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
    p.moving = false;
    if (!vx && !vy) return;
    var want = PLAYER_SPEED * st.speed * dt;
    var got = tryMove(p, vx * want, vy * want);
    assist(p, vx, vy, want, got);
    if (vx) p.dir = vx > 0 ? 1 : -1;
    if (got > 0.05) {
      p.moving = true; p.walked += got; p.step += got;
      if (p.step >= 13) { p.step = 0; sfx('step', 0.35); }
    }
  }

  /* ---------- Enemigos ---------- */
  function claimed(e, x, y) {
    for (var i = 0; i < W.enemies.length; i++) {
      var o = W.enemies[i];
      if (o !== e && !o.dead && ((o.tx === x && o.ty === y) || (o.nx === x && o.ny === y))) return true;
    }
    return false;
  }
  function refreshField(dt) {                    // un solo BFS desde el jugador sirve a todos los que persiguen
    var p = W.p, at = idx(tileOf(p.x), tileOf(p.y));
    W.fieldT -= dt;
    if (W.field && at === W.fieldAt && W.fieldT > 0) return;
    W.field = DD.Tower.dist(W, tileOf(p.x), tileOf(p.y), 14);
    W.fieldAt = at; W.fieldT = 0.25;
  }
  function chooseNext(e, def) {
    var f = W.field, d = f[idx(e.tx, e.ty)], sight = def.sight || 5, k, c = [], chasing = d >= 0 && d <= sight;
    if (chasing && e.state !== 'chase') { e.state = 'chase'; e.alert = 0.9; }
    if (!chasing && e.state === 'chase') e.state = 'wander';
    if (chasing && d === 0) { e.direct = true; return; }
    for (k = 0; k < 4; k++) {
      var nx = e.tx + D4[k][0], ny = e.ty + D4[k][1];
      if (!DD.Tower.passable(W, nx, ny) || claimed(e, nx, ny)) continue;
      if (chasing ? f[idx(nx, ny)] === d - 1 : !(nx === e.lx && ny === e.ly)) c.push([nx, ny]);
    }
    if (!c.length && !chasing) {                 // callejón: da la vuelta
      for (k = 0; k < 4; k++) if (DD.Tower.passable(W, e.tx + D4[k][0], e.ty + D4[k][1]) && !claimed(e, e.tx + D4[k][0], e.ty + D4[k][1])) c.push([e.tx + D4[k][0], e.ty + D4[k][1]]);
    }
    if (!c.length) { e.wait = 0.2 + rnd() * 0.3; return; }
    var pick = c[(rnd() * c.length) | 0];
    e.lx = e.tx; e.ly = e.ty; e.nx = pick[0]; e.ny = pick[1];
  }
  function updateEnemy(e, dt) {
    var def = (DD.ENEMIES && DD.ENEMIES[e.id]) || {}, chase = e.state === 'chase';
    var sp = ENEMY_SPEED * (def.speed || 1) * (chase ? 1 : WANDER_MUL), tx, ty, p = W.p;
    e.alert = Math.max(0, e.alert - dt);
    if (e.wait > 0) { e.wait -= dt; return; }
    if (e.nx < 0) {
      if (e.direct && W.field[idx(tileOf(e.px), tileOf(e.py))] !== 0) { e.direct = false; e.tx = tileOf(e.px); e.ty = tileOf(e.py); }
      if (!e.direct) chooseNext(e, def);
      if (e.wait > 0) return;
    }
    if (e.direct) { tx = p.x; ty = p.y; } else { tx = e.nx * TS + TS / 2; ty = e.ny * TS + TS / 2; }
    var dx = tx - e.px, dy = ty - e.py, dist = Math.sqrt(dx * dx + dy * dy), step = sp * dt;
    if (Math.abs(dx) > 0.4) e.face = dx > 0 ? 1 : -1;
    e.anim += dt * (chase ? 9 : 5);
    if (dist <= step) {
      e.px = tx; e.py = ty;
      if (!e.direct) { e.tx = e.nx; e.ty = e.ny; e.nx = -1; e.ny = -1; if (!chase && rnd() < 0.3) e.wait = 0.3 + rnd(); }
    } else { e.px += dx / dist * step; e.py += dy / dist * step; }
    if (e.direct) { e.tx = tileOf(e.px); e.ty = tileOf(e.py); }
  }
  function updateEnemies(dt) {
    refreshField(dt);
    W.enemies.forEach(function (e) { if (!e.dead) updateEnemy(e, dt); });
  }
  function checkContact() {
    var p = W.p;
    if (p.invuln > 0) return false;
    for (var i = 0; i < W.enemies.length; i++) {
      var e = W.enemies[i];
      if (e.dead) continue;
      var dx = e.px - p.x, dy = e.py - p.y;
      if (dx * dx + dy * dy < CONTACT * CONTACT) {
        e.alert = 0;
        DD.Run.startCombat(e);
        return true;
      }
    }
    return false;
  }

  /* ---------- Daño del entorno ---------- */
  function afterBody(res) {                      // anuncia roturas / sobrecalentamientos de Body.addHeat / hurtLimb
    if (res.broke) {
      var slot = res.slot || null;
      sayAtPlayer(BROKE[slot ? DD.SLOT_TYPE[slot] : 'arm'] || '¡Rota!', C.bloodHi);
      sfx('break');
      DD.fx.flash(C.bloodHi, 0.25, 0.3);
      DD.Run.refreshStats();
    } else if (res.overheated) {
      sayAtPlayer('¡Sobrecalentada!', C.heatHi);
      sfx('overheat');
    }
  }
  function harm(base, src, st) {                 // PV con fireRes; true si la run terminó
    var n = Math.max(1, Math.round(base * (1 - st.fireRes)));
    sayAtPlayer('-' + n + ' PV', C.bloodHi);
    return DD.Run.hurt(n, src) || !alive();
  }
  function heatAll(n, st) {
    var body = DD.run.body, res = { overheated: false, broke: false, slot: null }, h = Math.max(1, Math.round(n * (1 - st.fireRes)));
    DD.SLOTS.forEach(function (s) {
      var r = DD.Body.addHeat(body, s, h);
      if (r.overheated) res.overheated = true;
      if (r.broke && !res.broke) { res.broke = true; res.slot = s; }
    });
    return res;
  }

  var CYCLE = { spikes: 2.8, steam: 3.6 };
  function trapState(tr) {                       // { frame, on } según el ciclo
    var m;
    if (tr.kind === 'acid') return { frame: ((DD.time * 3) | 0) % 3, on: true };
    m = (W.t + tr.phase * CYCLE[tr.kind]) % CYCLE[tr.kind];
    if (tr.kind === 'spikes') {
      if (m < 1.5) return { frame: 0, on: false };
      if (m < 1.85) return { frame: ((DD.time * 14) | 0) & 1, on: false };
      return { frame: 1, on: true };
    }
    if (m < 1.8) return { frame: 0, on: false };
    return m < 2.6 ? { frame: 1, on: false } : { frame: 2, on: true };
  }
  function updateTraps(dt, st) {
    var p = W.p, i;
    for (i = 0; i < W.traps.length; i++) {
      var tr = W.traps[i];
      tr.cd = Math.max(0, tr.cd - dt);
      var dx = p.x - (tr.x * TS + TS / 2), dy = p.y - (tr.y * TS + TS / 2);
      if (tr.cd > 0 || Math.abs(dx) > 6 || Math.abs(dy) > 6 || !trapState(tr).on) continue;
      sfx('trap');
      if (tr.kind === 'spikes') {
        tr.cd = SPIKE_CD;
        if (harm(SPIKE_DMG, 'los pinchos', st)) return true;
      } else if (tr.kind === 'acid') {
        tr.cd = ACID_CD;
        if (harm(ACID_DMG, 'el ácido', st)) return true;
        var slots = DD.Body.intactSlots(DD.run.body);
        if (slots.length) {
          var s = slots[(rnd() * slots.length) | 0], r = DD.Body.hurtLimb(DD.run.body, s, Math.max(1, Math.round(ACID_WEAR * (1 - st.fireRes))));
          afterBody({ broke: r.broke, slot: s });
        }
      } else {
        tr.cd = STEAM_CD;
        sayAtPlayer('¡Vapor!', C.steel);
        afterBody(heatAll(STEAM_HEAT, st));
        if (harm(1, 'el vapor', st)) return true;
      }
    }
    return false;
  }
  function updateBurning(dt, st) {
    var p = W.p, i = idx(tileOf(p.x), tileOf(p.y));
    W.fireCd = Math.max(0, W.fireCd - dt);
    if (W.fire[i] <= 0 || W.fireCd > 0) return false;
    W.fireCd = FIRE_CD;
    sfx('fire');
    var h = Math.max(1, Math.round(FIRE_LEG_HEAT * (1 - st.fireRes))), a = DD.Body.addHeat(DD.run.body, 'legL', h), b = DD.Body.addHeat(DD.run.body, 'legR', h);
    if (harm(FIRE_DMG, 'el fuego', st)) return true;
    afterBody({ overheated: a.overheated || b.overheated, broke: a.broke || b.broke, slot: a.broke ? 'legL' : 'legR' });
    return false;
  }

  /* ---------- Recursos ---------- */
  function jarLimb() {
    var body = DD.run.body, have = {}, list = [], total = 0, ids = DD.LIMB_ORDER || Object.keys(DD.LIMBS), w = TIER_W[Math.min(W.floor, 2)];
    DD.SLOTS.forEach(function (s) { if (body.slots[s].id) have[body.slots[s].id] = true; });
    ids.forEach(function (id) {
      if (have[id]) return;
      var wt = w[(DD.LIMBS[id].tier || 1) - 1] || 1;
      list.push([id, wt]); total += wt;
    });
    if (!list.length) return ids[(rnd() * ids.length) | 0];
    var r = rnd() * total;
    for (var i = 0; i < list.length; i++) { r -= list[i][1]; if (r <= 0) return list[i][0]; }
    return list[list.length - 1][0];
  }
  function note(str, it, color) {                // aviso de "no hace falta", sin repetirse
    if (W.noteCd > 0) return;
    W.noteCd = 2;
    say(str, it.x * TS + TS / 2, it.y * TS, color || C.dim);
  }
  function collect(it, st) {                     // true si se recoge (el tarro cambia de escena)
    var run = DD.run, body = run.body, x = it.x * TS + TS / 2, y = it.y * TS, n;
    if (it.kind === 'vial') {
      if (run.hp >= run.hpMax) { note('PV al máximo', it); return false; }
      n = DD.Run.heal(CFG.VIAL_HEAL); say('+' + n + ' PV', x, y, C.integ); sfx('vial');
    } else if (it.kind === 'coolant') {
      if (DD.Body.hottest(body).heat < 5) { note('Todo frío', it); return false; }
      DD.Body.coolAll(body, CFG.COOLANT_COOL); say('-' + CFG.COOLANT_COOL + ' calor', x, y, C.ether); sfx('coolant');
    } else if (it.kind === 'suture') {
      if (!DD.Body.repairWorst(body, CFG.SUTURE_REPAIR)) { note('Sin daños', it); return false; }
      say('+' + CFG.SUTURE_REPAIR + ' integridad', x, y, C.integ); sfx('suture');
    } else if (it.kind === 'ether') {
      n = DD.randInt(W.rng, 3, 8); DD.Run.addEther(n); say('+' + n + ' Éter', x, y, C.ether); sfx('ether');
    } else {
      it.taken = true; sfx('jar');
      DD.Run.startHarvest([jarLimb()], 'Frasco de extremidad');
      return true;
    }
    it.taken = true;
    return true;
  }
  function pickups(st) {
    var p = W.p;
    for (var i = 0; i < W.items.length; i++) {
      var it = W.items[i];
      if (it.taken) continue;
      var dx = p.x - (it.x * TS + TS / 2), dy = p.y - (it.y * TS + TS / 2);
      if (dx * dx + dy * dy < 9 * 9 && collect(it, st) && it.kind === 'jar') return true;
    }
    return false;
  }

  /* ---------- Compuertas ---------- */
  function occupied() {
    var out = [], p = W.p;
    function box(cx, cy) {
      for (var y = tileOf(cy - HALF - 2); y <= tileOf(cy + HALF + 1.99); y++) for (var x = tileOf(cx - HALF - 2); x <= tileOf(cx + HALF + 1.99); x++) out.push({ x: x, y: y });
    }
    box(p.x, p.y);
    W.enemies.forEach(function (e) {
      if (e.dead) return;
      box(e.px, e.py); out.push({ x: e.tx, y: e.ty });
      if (e.nx >= 0) out.push({ x: e.nx, y: e.ny });
    });
    return out;
  }
  function updateShift(dt, st) {
    var p = W.p, pt = { x: tileOf(p.x), y: tileOf(p.y) };
    W.shiftT -= dt;
    if (!W.warning && W.shiftT <= SHIFT_WARN) {
      DD.Tower.planShift(W, pt, rnd);
      W.warning = true; W.beeped = false;
      sfx('gateWarn');
    }
    if (W.warning && !W.beeped && W.shiftT <= SHIFT_WARN * 0.5) { W.beeped = true; sfx('gateWarn'); }
    if (W.shiftT > 0) return;
    var res = DD.Tower.applyShift(W, pt, occupied());
    W.warning = false; W.shiftT = SHIFT_EVERY; W.ver++;
    sfx('gate');
    DD.fx.shake(2.5, 0.35);
    updateVision(true, st);
    W.field = null;
    return res;
  }

  /* ---------- Salida ---------- */
  function checkExit() {
    var p = W.p, ex = W.exit.x * TS + TS / 2, ey = W.exit.y * TS + TS / 2;
    if (Math.abs(p.x - ex) < 7 && Math.abs(p.y - ey) < 7) {
      sfx('stairs');
      DD.fx.flash(C.ether, 0.3, 0.3);
      DD.Run.nextFloor();
      return true;
    }
    return false;
  }

  /* ---------- Escena ---------- */
  function update(dt) {
    if (!W || !DD.run || !DD.run.started || DD.run.world !== W) return;
    dt = Math.min(dt, 0.05);
    var p = W.p, st = DD.Body.stats(DD.run.body);
    W.t += dt; W.banner = Math.max(0, W.banner - dt); W.hint = Math.max(0, W.hint - dt); W.noteCd = Math.max(0, W.noteCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    movePlayer(dt, st);
    updateVision(false, st);
    updateEnemies(dt);
    if (checkContact()) return;
    if (updateTraps(dt, st) || !alive()) return;
    updateFire(dt);
    if (updateBurning(dt, st) || !alive()) return;
    if (pickups(st) || !alive()) return;
    if (checkExit()) return;
    updateShift(dt, st);
    W.cool += CFG.COOL_SEC * dt;                 // enfriamiento fuera de combate (Body.coolAll redondea: se acumula aquí)
    if (W.cool >= 1) { var whole = Math.floor(W.cool); DD.Body.coolAll(DD.run.body, whole); W.cool -= whole; }
    updateFx(dt, st);
  }

  function updateFx(dt, st) {
    var i, k;
    for (k = floats.length - 1; k >= 0; k--) { floats[k].t += dt; if (floats[k].t > 1.2) floats.splice(k, 1); }
    for (k = parts.length - 1; k >= 0; k--) {
      var q = parts[k];
      q.t += dt; q.x += (q.vx + Math.sin(q.t * 6 + k) * 4) * dt; q.y += q.vy * dt;
      if (q.t > q.max) parts.splice(k, 1);
    }
    for (k = 0; k < W.fireList.length; k++) {
      i = W.fireList[k];
      if (W.vis[i] && rnd() < dt * 0.9) ember((i % MW) * TS, ((i / MW) | 0) * TS);
    }
    if (rnd() < dt * (2 + 12 * DD.Run.fireLevel())) {          // ceniza y brasas por toda la torre
      var ax = W.p.x + (rnd() - 0.5) * 200, ay = W.p.y + (rnd() - 0.5) * 120;
      if (ax > 0 && ay > 0 && ax < PW && ay < PH && W.vis[idx(tileOf(ax), tileOf(ay))]) ember(ax - TS / 2, ay - TS / 2);
    }
    for (k = 0; k < W.torches.length; k++) {
      var t = W.torches[k];
      if (W.vis[idx(t.x, t.y)] && rnd() < dt * 1.6) parts.push({ x: t.x * TS + 6 + rnd() * 4, y: t.y * TS + 6, vx: (rnd() - 0.5) * 6, vy: -(8 + rnd() * 10), t: 0, max: 0.5 + rnd(), c: C.fire2 });
    }
  }

  function enter(params) {
    var run = DD.run;
    if (!run) return;
    T = DD.Tower.T;
    floats = []; parts = [];
    if (params && params.resume && run.world && run.world.built) {
      W = run.world;
      W.enemies = W.enemies.filter(function (e) { return !e.dead; });
      W.items = W.items.filter(function (it) { return !it.taken; });
      W.p.invuln = INVULN; W.ptr = null; W.field = null;
    } else {
      startFloor();
    }
    if (DD.Sprites && DD.Sprites.setTheme) DD.Sprites.setTheme(W.floor);
    if (DD.Audio && DD.Audio.music) DD.Audio.music('explore');
    updateVision(true, DD.Body.stats(run.body));
  }

  function exit() { if (W) W.ptr = null; }

  /* ---------- Dibujo ---------- */
  function floorKey(x, y) { return (((x * 73856093) ^ (y * 19349663)) >>> 0) % 5 === 0 ? 'floorB' : 'floor'; }

  function drawMap(ctx, S, t) {
    var tiles = W.tiles, seen = W.seen, vis = W.vis, x, y, i, k;
    for (y = 0; y < MH; y++) {
      for (x = 0; x < MW; x++) {
        i = idx(x, y);
        if (!seen[i]) continue;
        k = tiles[i];
        if (k === T.WALL) {
          if (W.torchAt[i]) S.draw(ctx, 'torch', x * TS, y * TS, { frame: (((t * 7) | 0) + x * 3) % 3 });
          else S.draw(ctx, 'wall', x * TS, y * TS);
        } else if (k === T.GATE_C) S.draw(ctx, 'gateClosed', x * TS, y * TS);
        else if (k === T.GATE_O) S.draw(ctx, 'gateOpen', x * TS, y * TS);
        else S.draw(ctx, floorKey(x, y), x * TS, y * TS);
      }
    }
    if (seen[idx(W.start.x, W.start.y)]) S.draw(ctx, 'start', W.start.x * TS, W.start.y * TS);
    if (seen[idx(W.exit.x, W.exit.y)]) S.draw(ctx, W.exit.kind === 'exit' ? 'exit' : 'stairs', W.exit.x * TS, W.exit.y * TS, { frame: ((t * 3) | 0) & 1 });
    W.gates.forEach(function (g) {
      if (!g.warn || !seen[idx(g.x, g.y)]) return;
      S.draw(ctx, 'gateWarn', g.x * TS, g.y * TS, { frame: ((t * 6) | 0) & 1 });
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 12);
      ctx.fillStyle = g.open ? C.bloodHi : C.acid;      // rojo: va a cerrarse; verde: va a abrirse
      ctx.fillRect(g.x * TS, g.y * TS, TS, TS);
      ctx.globalAlpha = 1;
    });
    W.traps.forEach(function (tr) {
      if (seen[idx(tr.x, tr.y)]) S.draw(ctx, tr.kind, tr.x * TS, tr.y * TS, { frame: trapState(tr).frame });
    });
  }

  function drawFire(ctx, S, t) {
    var g = glowImg('fire', 20, [255, 120, 40], 0.5);
    ctx.globalCompositeOperation = 'lighter';
    W.fireList.forEach(function (i) {
      if (!W.vis[i]) return;
      var a = Math.min(1, W.fireAge[i] / 0.7, W.fire[i] / 1.5);
      ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(t * 9 + i));
      ctx.drawImage(g, (i % MW) * TS + 8 - 20, ((i / MW) | 0) * TS + 8 - 20);
    });
    ctx.globalCompositeOperation = 'source-over';
    W.fireList.forEach(function (i) {
      if (!W.vis[i]) return;
      ctx.globalAlpha = Math.min(1, W.fireAge[i] / 0.7, W.fire[i] / 1.5);
      S.draw(ctx, 'fire', (i % MW) * TS, ((i / MW) | 0) * TS, { frame: (((t * 8) | 0) + i) & 3 });
    });
    ctx.globalAlpha = 1;
  }

  function drawItems(ctx, S, t) {
    W.items.forEach(function (it) {
      if (it.taken || !W.vis[idx(it.x, it.y)]) return;
      var bob = Math.round(Math.sin(t * 3 + it.ph) * 1.2);
      S.draw(ctx, it.kind, it.x * TS, it.y * TS + bob, { frame: ((t * 2) | 0) & 1 });
    });
  }

  function shadow(ctx, cx, cy, w) {
    ctx.globalAlpha = 0.4; ctx.fillStyle = '#000';
    ctx.fillRect(Math.round(cx - w / 2) + 1, Math.round(cy + 5), w - 2, 3);
    ctx.fillRect(Math.round(cx - w / 2), Math.round(cy + 6), w, 1);
    ctx.globalAlpha = 1;
  }

  function drawEnemy(ctx, S, e, t) {
    var x = Math.round(e.px) - 8, y = Math.round(e.py) - 10;
    if (e.state === 'chase') {                   // aura roja para que se distinga quien te persigue
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45;
      ctx.drawImage(glowImg('chase', 16, [200, 30, 30], 0.6), Math.round(e.px) - 16, Math.round(e.py) - 14);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    shadow(ctx, e.px, e.py, 12);
    if (S.drawEnemy) S.drawEnemy(ctx, e.id, x, y, { frame: ((e.anim | 0) & 3), flip: e.face < 0 });
    else { ctx.fillStyle = C.blood; ctx.fillRect(x + 3, y + 3, 10, 10); }
  }
  function drawPlayer(ctx, S, t) {
    var p = W.p, x = Math.round(p.x) - 8, y = Math.round(p.y) - 10;
    if (p.invuln > 0 && ((t * 10) | 0) % 2 === 0) { shadow(ctx, p.x, p.y, 12); return; }
    shadow(ctx, p.x, p.y, 12);
    if (S.drawPlayer) S.drawPlayer(ctx, DD.run.body, x, y, { dir: p.dir, frame: p.moving ? ((p.walked / 5) | 0) & 3 : 0 });
    else { ctx.fillStyle = C.bone; ctx.fillRect(x + 3, y + 3, 10, 10); }
  }

  function drawFog(ctx, st) {
    var p = W.p, r = Math.max(1, Math.round(st.vision)), x, y, i, a, d, exitI = idx(W.exit.x, W.exit.y);
    ctx.fillStyle = FOG;
    for (y = 0; y < MH; y++) {
      for (x = 0; x < MW; x++) {
        i = idx(x, y);
        if (!W.seen[i]) continue;
        if (W.vis[i]) {
          d = Math.sqrt((x * TS + 8 - p.x) * (x * TS + 8 - p.x) + (y * TS + 8 - p.y) * (y * TS + 8 - p.y)) / TS;
          a = DD.clamp((d - (r - 2.2)) / 2.6, 0, 1) * 0.55;
        } else a = i === exitI ? 0.2 : 0.66;    // la salida vista se recuerda casi a plena luz
        if (a > 0.02) { ctx.globalAlpha = a; ctx.fillRect(x * TS, y * TS, TS, TS); }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawLights(ctx, t) {
    var g = glowImg('torch', 24, [255, 140, 50], 0.4), i;
    ctx.globalCompositeOperation = 'lighter';
    W.torches.forEach(function (q) {
      if (!W.seen[idx(q.x, q.y)]) return;
      ctx.globalAlpha = W.vis[idx(q.x, q.y)] ? 0.7 + 0.3 * Math.sin(t * 8 + q.x) : 0.25;
      ctx.drawImage(g, q.x * TS + 8 - 24, q.y * TS + 8 - 24);
    });
    if (W.seen[idx(W.exit.x, W.exit.y)]) {       // pista de la salida: brillo que late
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 3.2);
      ctx.drawImage(glowImg('exit', 26, W.exit.kind === 'exit' ? [255, 210, 110] : [120, 214, 230], 0.55), W.exit.x * TS + 8 - 26, W.exit.y * TS + 8 - 26);
    }
    ctx.globalAlpha = 0.28;                      // farol del jugador
    ctx.drawImage(glowImg('lantern', 30, [255, 210, 140], 0.5), Math.round(W.p.x) - 30, Math.round(W.p.y) - 30);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function drawParts(ctx) {
    parts.forEach(function (q) {
      ctx.globalAlpha = Math.max(0, 1 - q.t / q.max);
      ctx.fillStyle = q.c;
      ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
    });
    ctx.globalAlpha = 1;
  }

  function drawFloats(ctx) {
    floats.forEach(function (f) {
      var half = f.s.length * 3, x = DD.clamp(f.x, half + 2, PW - half - 2), y = f.y - f.t * 14;
      DD.text(ctx, f.s, x, y, { align: 'center', color: f.c, shadow: C.bg, alpha: Math.min(1, (1.2 - f.t) * 3) });
    });
  }

  function drawMarks(ctx, t) {                   // destino del puntero mantenido
    if (!W.ptr) return;
    var r = 3 + ((t * 8) & 1);
    ctx.globalAlpha = 0.8; ctx.strokeStyle = C.heatHi; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(W.ptr.x) - r + 0.5, Math.round(W.ptr.y) - r + 0.5, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  function drawHud(ctx, t) {                     // marco del mapa, temporizador de compuertas, rótulos
    var f = Math.floor(t * 4) % 2 === 0, left = Math.max(0, W.shiftT), warn = W.warning;
    DD.text(ctx, 'LABERINTO', 6, 40, { color: C.brass, shadow: C.bg });
    DD.ui.bar(ctx, 6, 50, 58, 7, warn ? 1 : 1 - left / SHIFT_EVERY, warn && f ? C.bloodHi : (warn ? C.blood : C.brassDk));
    DD.text(ctx, warn ? '¡CAMBIA!' : 'en ' + Math.ceil(left) + ' s', 6, 60, { color: warn ? (f ? C.bloodHi : C.warn) : C.dim, shadow: C.bg });
    if (warn) {
      DD.text(ctx, '¡LAS COMPUERTAS VAN A CAMBIAR!', 320, 25, { align: 'center', color: f ? C.warn : C.bloodHi, shadow: C.bg });
    }
    if (W.hint > 0) {
      DD.text(ctx, 'Flechas o WASD para moverte · o mantén pulsado para ir hacia el puntero', 320, 310, { align: 'center', color: C.dim, alpha: Math.min(1, W.hint / 2) });
    }
    if (W.banner > 0) {
      var fl = DD.FLOORS && DD.FLOORS[W.floor], a = Math.min(1, W.banner / 0.8);
      if (fl) {
        DD.text(ctx, fl.name, 320, MY + 96, { align: 'center', size: 2, color: C.brass, shadow: C.bg, alpha: a });
        DD.text(ctx, fl.sub, 320, MY + 118, { align: 'center', color: C.bone, shadow: C.bg, alpha: a });
      }
    }
  }

  function draw(ctx) {
    if (!W) return;
    var S = DD.Sprites, t = DD.time, st = W.st = DD.Body.stats(DD.run.body);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = C.brassDk; ctx.fillRect(MX - 3, MY - 3, PW + 6, PH + 6);
    ctx.fillStyle = C.bg; ctx.fillRect(MX - 2, MY - 2, PW + 4, PH + 4);
    ctx.save();
    ctx.translate(MX, MY);
    ctx.beginPath(); ctx.rect(0, 0, PW, PH); ctx.clip();
    drawMap(ctx, S, t);
    drawItems(ctx, S, t);
    drawFire(ctx, S, t);
    drawFog(ctx, st);
    drawLights(ctx, t);
    W.enemies.forEach(function (e) { if (!e.dead && W.vis[idx(tileOf(e.px), tileOf(e.py))]) drawEnemy(ctx, S, e, t); });
    drawPlayer(ctx, S, t);
    W.enemies.forEach(function (e) {
      if (!e.dead && e.alert > 0 && W.vis[idx(tileOf(e.px), tileOf(e.py))]) DD.text(ctx, '!', Math.round(e.px), Math.round(e.py) - 20, { align: 'center', color: C.bloodHi, shadow: C.bg });
    });
    drawParts(ctx);
    drawMarks(ctx, t);
    drawFloats(ctx);
    ctx.restore();
    drawHud(ctx, t);
  }

  var scene = DD.scenes.explore = { run: true, enter: enter, update: update, draw: draw, exit: exit };
})();
