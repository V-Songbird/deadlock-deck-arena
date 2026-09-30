/* Deadlock Deck: El Reloj Anatómico — explore.js (W3)
 * The 'explore' scene: grid movement, fog of war, shifting labyrinth, spreading fire,
 * traps, pickups, wandering/chasing enemies, stairs/exit.
 */
(function () {
  'use strict';
  const DD = window.DD;

  const TS = 32;            // drawn tile size (16 px sprite x2)
  const SC = 2;
  const HUD_H = 24;
  const VIEW_CX = 320, VIEW_CY = HUD_H + 168;   // screen point the camera centres on
  const DV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const DIR_LIST = ['up', 'down', 'left', 'right'];
  const FLOOR_NAMES = ['Laboratorio en Llamas', 'Galería de Especímenes', 'Cámara del Rector'];
  const PICKUP_TILE = { vial: 'vial', coolant: 'coolant', suture: 'suture', ether: 'ether', jar: 'jar' };
  const MINI_COL = {
    wall: '#2c2536', floor: '#6a5a44', shiftwall: '#c89b3c', shiftwall_open: '#7a5a1e',
    stairs: '#3fa38a', exit: '#ffb830'
  };

  let S = null;             // per-visit scene state (persistent things live in DD.run.map)

  // ------------------------------------------------------------ small helpers
  function sfx(n) { if (DD.audio && DD.audio.sfx) DD.audio.sfx(n); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function tensionNow() {
    const total = (DD.CONFIG && DD.CONFIG.runSeconds) || 360;
    return clamp01(1 - DD.run.timeLeft / total);
  }
  function idx(x, y) { return y * S.map.w + x; }
  function walk(x, y) { return DD.tower.walkable(S.map, x, y); }
  function say(text, color, secs) { S.msg = { text, color: color || DD.PAL.ink, t: 0, dur: secs || 2.2 }; }
  function sayOnce(key, text, color) {           // rate-limited message
    if ((S.msgCd[key] || 0) > S.t) return;
    S.msgCd[key] = S.t + 2.5;
    say(text, color);
  }
  function origin() { return { x: Math.round(VIEW_CX - S.cam.x), y: Math.round(VIEW_CY - S.cam.y) }; }
  function screenOf(fx, fy) { const o = origin(); return { x: o.x + fx * TS, y: o.y + fy * TS }; }

  function saveState() {
    if (!S) return;
    const m = S.map, p = S.p;
    m.player = { x: p.x, y: p.y, facing: p.facing };
    m.time = S.mapTime;
  }

  function livingSlots(body, types) {
    const out = [];
    for (const k of DD.SLOTS || ['head', 'torso', 'armL', 'armR', 'legL', 'legR']) {
      if (!body.slots[k]) continue;
      if (types && types.indexOf(k) < 0) continue;
      out.push(k);
    }
    return out;
  }

  function checkDeath() {
    const body = DD.run.body;
    if (body.hp <= 0 && !S.ended) {
      S.ended = true;
      saveState();
      DD.game.endLoop('death');
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ scene enter
  function enter(params) {
    params = params || {};
    const run = DD.run;
    if (!run) { S = null; return; }
    let map = run.map;
    let fresh = false;
    if (params.newFloor || !map) {
      map = DD.tower.generate(run.floor || 1, run.rng || DD.rand);
      run.map = map;
      run.bossDead = false;
      fresh = true;
    } else {
      for (const e of map.enemies) if (e.dead && e.boss) run.bossDead = true;
      map.enemies = map.enemies.filter(e => !e.dead);
    }

    const pl = map.player;
    S = {
      map, t: 0, mapTime: map.time || 0,
      cam: { x: 0, y: 0 },
      p: { x: pl.x, y: pl.y, fx: pl.x, fy: pl.y, sx: pl.x, sy: pl.y, tx: pl.x, ty: pl.y, moving: false, t: 0, dur: 0.14, facing: pl.facing || 1 },
      grace: fresh ? 0.5 : 1.0,
      msg: null, msgCd: {}, banner: null,
      lastDir: null,
      vis: new Uint8Array(map.w * map.h),
      field: new Int16Array(map.w * map.h).fill(-1), fieldKey: -1, fieldT: 0,
      fireT: 1.5, embers: [],
      mini: null, miniDirty: true,
      leaving: false, ended: false, vision: 4
    };
    S.vision = DD.body.stat(run.body, 'vision');
    computeVision(pl.x, pl.y);
    S.cam.x = clampCamX(pl.x * TS + TS / 2);
    S.cam.y = clampCamY(pl.y * TS + TS / 2);

    if (fresh) {
      const f = run.floor || 1;
      S.banner = {
        t: 0, dur: 3.6,
        title: 'Piso ' + f + ' — ' + (FLOOR_NAMES[f - 1] || 'La Torre'),
        sub: f >= 3 ? 'El Rector Carnicero guarda la salida.' : 'Encuentra las escaleras antes de que todo arda.'
      };
    }
    if (DD.audio && DD.audio.music) DD.audio.music('explore');
  }

  function exit() { saveState(); }

  function clampCamX(x) { return DD.clamp(x, VIEW_CX, S.map.w * TS - VIEW_CX); }
  function clampCamY(y) { return DD.clamp(y, VIEW_CY, S.map.h * TS - (360 - VIEW_CY)); }

  // ------------------------------------------------------------ vision (fog of war)
  function computeVision(px, py) {
    const map = S.map, w = map.w, vis = S.vis;
    vis.fill(0);
    const r = S.vision, R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const x = px + dx, y = py + dy;
        if (x < 0 || y < 0 || x >= w || y >= map.h) continue;
        if (dx * dx + dy * dy > (r + 0.5) * (r + 0.5)) continue;
        if (!lineClear(px, py, x, y)) continue;
        const i = y * w + x;
        vis[i] = 1;
        if (!map.seen[i]) { map.seen[i] = 1; S.miniDirty = true; }
      }
    }
  }

  function lineClear(x0, y0, x1, y1) { // Bresenham; the end cell itself may be opaque
    const map = S.map;
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    while (x !== x1 || y !== y1) {
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      if ((x !== x1 || y !== y1) && DD.tower.opaque(map, x, y)) return false;
    }
    return true;
  }

  // ------------------------------------------------------------ update
  function update(dt) {
    if (!S || !DD.run || !DD.run.active || DD.paused) return;
    if (S.map !== DD.run.map) return;
    dt = Math.min(dt, 0.1);
    S.t += dt; S.mapTime += dt;
    if (S.grace > 0) S.grace -= dt;
    if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.dur) S.msg = null; }
    if (S.banner) { S.banner.t += dt; if (S.banner.t > S.banner.dur) S.banner = null; }
    S.vision = DD.body.stat(DD.run.body, 'vision');

    updatePlayer(dt);
    if (S.leaving || S.ended) return;
    updateEnemies(dt);
    if (S.leaving || S.ended) return;
    updateFire(dt);
    updateTraps(dt);
    updateShift(dt);
    updateCamera(dt);
    updateEmbers(dt);
  }

  // ---- player
  function readDirs() {
    const I = DD.input;
    for (const a of DIR_LIST) if (I.hit(a)) S.lastDir = a;
    if (S.lastDir && I.held(S.lastDir)) return [S.lastDir];
    for (const a of DIR_LIST) if (I.held(a)) { S.lastDir = a; return [a]; }
    const m = I.mouse;
    if (m && m.down && m.y > HUD_H) {           // hold to move (mouse / touch)
      const c = screenOf(S.p.fx, S.p.fy);
      const dx = m.x - (c.x + TS / 2), dy = m.y - (c.y + TS / 2);
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax < 12 && ay < 12) return null;
      const h = dx > 0 ? 'right' : 'left', v = dy > 0 ? 'down' : 'up';
      if (ax >= ay) return ay > 10 ? [h, v] : [h];
      return ax > 10 ? [v, h] : [v];
    }
    return null;
  }

  function tryStep(dirs) {
    const p = S.p;
    for (const d of dirs) {
      const dx = DV[d][0], dy = DV[d][1];
      if (dx !== 0) p.facing = dx;
      const nx = p.x + dx, ny = p.y + dy;
      if (!walk(nx, ny)) continue;
      p.sx = p.x; p.sy = p.y; p.tx = nx; p.ty = ny;
      p.moving = true; p.t = 0;
      const speed = Math.max(0.25, DD.body.stat(DD.run.body, 'speed') || 1);
      p.dur = 0.14 / speed;
      computeVision(nx, ny);
      sfx('step');
      return true;
    }
    return false;
  }

  function updatePlayer(dt) {
    const p = S.p;
    let rem = dt;
    for (let guard = 0; guard < 4 && rem > 0; guard++) {
      if (p.moving) {
        const need = p.dur - p.t;
        let arrived = false;
        if (rem < need) { p.t += rem; rem = 0; } else { p.t = p.dur; rem -= need; arrived = true; }
        const k = p.t / p.dur;
        p.fx = p.sx + (p.tx - p.sx) * k;
        p.fy = p.sy + (p.ty - p.sy) * k;
        if (arrived) {
          p.x = p.tx; p.y = p.ty; p.fx = p.x; p.fy = p.y; p.moving = false;
          S.fieldKey = -1;
          arrive();
          if (S.leaving || S.ended) return;
        }
      } else {
        standingChecks();
        if (S.leaving) return;
        const dirs = readDirs();
        if (!dirs || !tryStep(dirs)) break;
      }
    }
  }

  function standingChecks() { // exit opens while standing on it
    const p = S.p, map = S.map;
    if (map.tiles[p.y][p.x] === 'exit' && DD.run.bossDead) leaveFloor();
  }

  function leaveFloor() {
    if (S.leaving) return;
    S.leaving = true;
    saveState();
    sfx('door');
    DD.game.nextFloor();
  }

  function arrive() {
    const p = S.p, map = S.map, run = DD.run, body = run.body;
    const i = idx(p.x, p.y);
    const scr = screenOf(p.fx, p.fy);
    const cx = scr.x + TS / 2, cy = scr.y;

    // fire
    if (map.fire[i]) {
      DD.body.hurt(body, 3);
      const legs = livingSlots(body, ['legL', 'legR']);
      if (legs.length) DD.body.addHeat(body, legs[(Math.random() * legs.length) | 0], 15);
      sfx('burn');
      DD.fx.float('-3', cx, cy, DD.PAL.heat);
      DD.fx.particles(cx, cy + 16, DD.PAL.fire, 8);
      if (checkDeath()) return;
    }

    // traps
    for (const tr of map.traps) {
      if (tr.x !== p.x || tr.y !== p.y || !tr.armed) continue;
      tr.armed = false; tr.rearm = 5; tr.known = true;
      if (tr.type === 'spike') {
        DD.body.hurt(body, 4);
        const legs = livingSlots(body, ['legL', 'legR']);
        if (legs.length) DD.body.wear(body, legs[(Math.random() * legs.length) | 0], 1);
        sfx('trap'); DD.fx.float('¡Pinchos! -4', cx, cy, DD.PAL.bloodLight);
        DD.fx.shake(3, 0.2);
      } else if (tr.type === 'acid') {
        const ls = livingSlots(body);
        if (ls.length) DD.body.addHeat(body, ls[(Math.random() * ls.length) | 0], 35);
        sfx('acid'); DD.fx.float('¡Ácido! +35 calor', cx, cy, DD.PAL.ichor);
        DD.fx.particles(cx, cy + 16, DD.PAL.ichor, 10);
      } else {
        for (const k of livingSlots(body)) DD.body.addHeat(body, k, 15);
        sfx('steam'); DD.fx.float('¡Vapor! +15 calor', cx, cy, DD.PAL.bone);
        DD.fx.particles(cx, cy + 16, DD.PAL.bone, 10);
      }
      if (checkDeath()) return;
      break;
    }

    // pickups
    for (const pk of map.pickups) {
      if (pk.taken || pk.x !== p.x || pk.y !== p.y) continue;
      if (collect(pk, cx, cy)) return;
    }

    // stairs / exit
    const tile = map.tiles[p.y][p.x];
    if (tile === 'stairs') { leaveFloor(); return; }
    if (tile === 'exit') {
      if (run.bossDead) leaveFloor();
      else sayOnce('exit', 'La salida está sellada. Derrota al Rector Carnicero.', DD.PAL.bloodLight);
    }
  }

  // returns true when the scene is being left
  function collect(pk, cx, cy) {
    const body = DD.run.body, PAL = DD.PAL;
    if (pk.kind === 'vial') {
      if (body.hp >= body.maxHp) { sayOnce('full', 'Aún no lo necesitas: PV al máximo.', PAL.dim); return false; }
      DD.body.heal(body, 10);
      DD.fx.float('+10 PV', cx, cy, PAL.bloodLight);
      say('Vial de sangre: +10 PV', PAL.bloodLight);
    } else if (pk.kind === 'coolant') {
      const hot = livingSlots(body).some(k => body.slots[k].heat > 0);
      if (!hot) { sayOnce('cold', 'Aún no lo necesitas: nada se sobrecalienta.', PAL.dim); return false; }
      DD.body.cool(body, 40);
      DD.fx.float('-40 calor', cx, cy, PAL.cold);
      say('Refrigerante: extremidades enfriadas', PAL.cold);
    } else if (pk.kind === 'suture') {
      let worst = null, gap = 0;
      for (const k of livingSlots(body)) {
        const l = body.slots[k], g = l.maxIntegrity - l.integrity;
        if (g > gap) { gap = g; worst = k; }
      }
      if (!worst) { sayOnce('intact', 'Aún no lo necesitas: todo está intacto.', PAL.dim); return false; }
      DD.body.repair(body, worst, 1);
      DD.fx.float('+1 integridad', cx, cy, PAL.verdigris);
      say('Sutura: ' + (DD.SLOT_NAME ? DD.SLOT_NAME[worst] : worst) + ' reparado', PAL.verdigris);
    } else if (pk.kind === 'ether') {
      DD.run.ether = (DD.run.ether || 0) + 3;
      DD.fx.float('+3 Éter', cx, cy, PAL.violet);
      DD.fx.particles(cx, cy + 16, PAL.violet, 8);
    } else if (pk.kind === 'jar') {
      pk.taken = true;
      sfx('pickup');
      DD.fx.float('¡Frasco!', cx, cy, PAL.verdigris);
      S.leaving = true;
      saveState();
      DD.game.openJar(pk.limbId);
      return true;
    }
    pk.taken = true;
    sfx('pickup');
    return false;
  }

  // ---- enemies
  function enemyAt(x, y, except) {
    for (const e of S.map.enemies) {
      if (e === except || e.dead) continue;
      if ((e.x === x && e.y === y) || (e.moving && e.tx === x && e.ty === y)) return e;
    }
    return null;
  }

  function enemyOK(x, y, except) {   // tile an enemy may step onto
    const map = S.map;
    if (!walk(x, y)) return false;
    const t = map.tiles[y][x];
    if (t === 'stairs' || t === 'exit') return false;
    if (map.fire[idx(x, y)]) return false;
    return !enemyAt(x, y, except);
  }

  function refreshField() {
    const p = S.p, map = S.map, w = map.w;
    const sx = p.moving ? p.tx : p.x, sy = p.moving ? p.ty : p.y;
    const key = sy * w + sx;
    if (key === S.fieldKey && S.fieldT < 0.4) return;
    S.fieldKey = key; S.fieldT = 0;
    const f = S.field;
    f.fill(-1);
    f[key] = 0;
    const q = [key];
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      if (f[c] >= 9) continue;
      const cx = c % w, cy = (c / w) | 0;
      for (const d of DIR_LIST) {
        const nx = cx + DV[d][0], ny = cy + DV[d][1];
        if (!walk(nx, ny)) continue;
        const n = ny * w + nx;
        if (f[n] >= 0 || map.fire[n]) continue;
        const t = map.tiles[ny][nx];
        if (t === 'stairs' || t === 'exit') continue;
        f[n] = f[c] + 1;
        q.push(n);
      }
    }
  }

  function startEnemyStep(e, nx, ny, dur) {
    e.sx = e.x; e.sy = e.y; e.tx = nx; e.ty = ny; e.moving = true; e.t = 0; e.dur = dur;
    e.dirx = nx - e.x; e.diry = ny - e.y;
  }

  function updateEnemies(dt) {
    const map = S.map, p = S.p, w = map.w;
    S.fieldT += dt;
    refreshField();
    for (const e of map.enemies) {
      if (e.dead) continue;
      if (e.boss) { e.fx = e.x; e.fy = e.y; continue; }   // the guard never leaves his post
      if (e.moving) {
        e.t += dt;
        const k = Math.min(1, e.t / e.dur);
        e.fx = e.sx + (e.tx - e.sx) * k; e.fy = e.sy + (e.ty - e.sy) * k;
        if (k >= 1) { e.x = e.tx; e.y = e.ty; e.fx = e.x; e.fy = e.y; e.moving = false; e.idle = e.chasing ? 0 : 0.35 + Math.random() * 1.0; }
        continue;
      }
      e.idle -= dt;
      const here = e.y * w + e.x;
      // flee from fire that has reached this tile
      if (map.fire[here]) {
        const opts = DIR_LIST.filter(d => enemyOK(e.x + DV[d][0], e.y + DV[d][1], e));
        if (opts.length) { const d = opts[(Math.random() * opts.length) | 0]; startEnemyStep(e, e.x + DV[d][0], e.y + DV[d][1], 0.22); }
        continue;
      }
      const fd = S.field[here];
      const eu = Math.hypot(e.x - p.fx, e.y - p.fy);
      if (fd > 0 && eu <= 5) {
        e.chasing = true;
        let bestD = null, bestV = fd;
        for (const d of DIR_LIST) {
          const nx = e.x + DV[d][0], ny = e.y + DV[d][1];
          const v = nx >= 0 && ny >= 0 && nx < w && ny < map.h ? S.field[ny * w + nx] : -1;
          if (v >= 0 && v < bestV && enemyOK(nx, ny, e)) { bestV = v; bestD = d; }
        }
        if (bestD) startEnemyStep(e, e.x + DV[bestD][0], e.y + DV[bestD][1], Math.max(0.2, 0.34 - 0.02 * map.floor));
        continue;
      }
      e.chasing = false;
      if (e.idle > 0) continue;
      // wander (prefer to keep walking the same way)
      let opts = DIR_LIST.filter(d => enemyOK(e.x + DV[d][0], e.y + DV[d][1], e));
      if (!opts.length) { e.idle = 0.5; continue; }
      const same = opts.filter(d => DV[d][0] === e.dirx && DV[d][1] === e.diry);
      const d = same.length && Math.random() < 0.6 ? same[0] : opts[(Math.random() * opts.length) | 0];
      startEnemyStep(e, e.x + DV[d][0], e.y + DV[d][1], 0.5);
    }

    // contact
    if (S.grace > 0) return;
    for (const e of map.enemies) {
      if (e.dead) continue;
      const dist = Math.hypot(e.fx - p.fx, e.fy - p.fy);
      if (dist < (e.boss ? 1.15 : 0.75)) { contact(e); return; }
    }
  }

  function contact(e) {
    const p = S.p;
    if (p.moving) { p.moving = false; p.tx = p.x; p.ty = p.y; }   // settle on the tile we came from
    p.fx = p.x; p.fy = p.y;
    S.leaving = true;
    saveState();
    sfx('hit');
    DD.game.startCombat(e);
  }

  // ---- fire
  function canBurn(x, y) {
    const map = S.map, p = S.p;
    if (!walk(x, y)) return false;
    const t = map.tiles[y][x];
    if (t !== 'floor' && t !== 'shiftwall_open') return false;
    if (map.fire[idx(x, y)]) return false;
    if ((p.x === x && p.y === y) || (p.moving && p.tx === x && p.ty === y)) return false;
    for (const pk of map.pickups) if (!pk.taken && pk.x === x && pk.y === y) return false;
    return true;
  }

  function ignite(x, y) {
    const map = S.map, i = idx(x, y);
    map.fire[i] = 1; map.fireList.push(i);
  }

  function spreadOne() {
    const map = S.map, w = map.w, list = map.fireList;
    for (let a = 0; a < 10 && list.length; a++) {
      const li = (Math.random() * list.length) | 0, src = list[li];
      if (!map.fire[src]) { list[li] = list[list.length - 1]; list.pop(); continue; }   // stale entry
      const d = DIR_LIST[(Math.random() * 4) | 0];
      const nx = (src % w) + DV[d][0], ny = ((src / w) | 0) + DV[d][1];
      if (canBurn(nx, ny)) { ignite(nx, ny); return true; }
    }
    return false;
  }

  function updateFire(dt) {
    const map = S.map, tension = tensionNow();
    S.fireT -= dt;
    if (S.fireT > 0) return;
    S.fireT = DD.lerp(2.4, 0.3, Math.pow(tension, 1.3)) * (0.75 + Math.random() * 0.5);
    const n = tension > 0.92 ? 3 : tension > 0.7 ? 2 : 1;
    for (let k = 0; k < n; k++) spreadOne();
    if (tension > 0.6 && Math.random() < 0.25) {          // flare-ups far from the player
      for (let a = 0; a < 12; a++) {
        const x = (Math.random() * map.w) | 0, y = (Math.random() * map.h) | 0;
        if (Math.hypot(x - S.p.x, y - S.p.y) > 6 && canBurn(x, y) && map.tiles[y][x] === 'floor') { ignite(x, y); break; }
      }
    }
  }

  // ---- traps
  function updateTraps(dt) {
    for (const tr of S.map.traps) {
      if (tr.armed) continue;
      tr.rearm -= dt;
      if (tr.rearm <= 0) tr.armed = true;
    }
  }

  // ---- shifting labyrinth
  function occupied(x, y) {
    const p = S.p;
    if ((p.x === x && p.y === y) || (p.moving && p.tx === x && p.ty === y)) return true;
    return !!enemyAt(x, y, null);
  }

  function updateShift(dt) {
    const map = S.map;
    map.shiftTimer -= dt;
    if (map.shiftTimer > 0) return;
    map.shiftTimer = 18 + Math.random() * 4;
    const cands = map.shifts.slice();
    for (let i = cands.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = cands[i]; cands[i] = cands[j]; cands[j] = t; }
    const n = Math.max(3, Math.ceil(cands.length * 0.4));
    const closed = [], opened = [];
    for (let i = 0; i < cands.length && closed.length + opened.length < n; i++) {
      const c = cands[i];
      if (map.critSet[idx(c.x, c.y)] || occupied(c.x, c.y)) continue;
      const t = map.tiles[c.y][c.x];
      if (t === 'shiftwall') { map.tiles[c.y][c.x] = 'shiftwall_open'; opened.push(c); }
      else if (t === 'shiftwall_open') { map.tiles[c.y][c.x] = 'shiftwall'; map.fire[idx(c.x, c.y)] = 0; closed.push(c); }
    }
    // safety net: the player must still be able to reach the stairs/exit
    const p = S.p, sx = p.moving ? p.tx : p.x, sy = p.moving ? p.ty : p.y;
    const dist = DD.tower.bfs(map, sx, sy).dist;
    if (dist[map.goal.y * map.w + map.goal.x] < 0) {
      for (const c of closed) map.tiles[c.y][c.x] = 'shiftwall_open';
      closed.length = 0;
    }
    if (closed.length + opened.length === 0) return;
    say('La torre se reconfigura…', DD.PAL.brass, 2.6);
    sfx('shift');
    DD.fx.shake(3, 0.4);
    S.fieldKey = -1; S.miniDirty = true;
    computeVision(sx, sy);
  }

  // ---- camera & ambience
  function updateCamera(dt) {
    const p = S.p, k = 1 - Math.exp(-dt * 9);
    S.cam.x = clampCamX(S.cam.x + (p.fx * TS + TS / 2 - S.cam.x) * k);
    S.cam.y = clampCamY(S.cam.y + (p.fy * TS + TS / 2 - S.cam.y) * k);
  }

  function updateEmbers(dt) {
    const map = S.map, list = S.embers;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.life -= dt; e.x += e.vx * dt; e.y += e.vy * dt; e.vx += (Math.random() - 0.5) * 30 * dt;
      if (e.life <= 0) list.splice(i, 1);
    }
    if (list.length > 70) return;
    let rate = 3 + tensionNow() * 14;
    S.emberAcc = (S.emberAcc || 0) + rate * dt;
    while (S.emberAcc >= 1) {
      S.emberAcc -= 1;
      // prefer spawning on a visible fire tile, otherwise anywhere on screen
      let x, y, ok = false;
      const fl = map.fireList;
      for (let a = 0; a < 6 && fl.length; a++) {
        const i = fl[(Math.random() * fl.length) | 0];
        if (!map.fire[i] || !S.vis[i]) continue;
        x = (i % map.w) * TS + Math.random() * TS; y = ((i / map.w) | 0) * TS + Math.random() * TS * 0.5; ok = true; break;
      }
      if (!ok) {
        if (Math.random() < 0.6) continue;
        x = S.cam.x - VIEW_CX + Math.random() * 640; y = S.cam.y + 120 + Math.random() * 60;
      }
      list.push({ x, y, vx: (Math.random() - 0.5) * 12, vy: -(14 + Math.random() * 26), life: 1 + Math.random() * 1.6, max: 2.6, c: Math.random() < 0.5 ? DD.PAL.ember : DD.PAL.fire });
    }
  }

  // ------------------------------------------------------------ draw
  function draw(ctx) {
    const PAL = DD.PAL;
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, DD.W, DD.H);
    if (!S || !DD.run || S.map !== DD.run.map) { if (DD.ui && DD.ui.drawHUD) DD.ui.drawHUD(ctx); return; }
    const map = S.map, p = S.p, t = S.t, w = map.w;
    const o = origin();
    const x0 = Math.max(0, Math.floor(-o.x / TS)), x1 = Math.min(map.w - 1, Math.floor((640 - o.x) / TS));
    const y0 = Math.max(0, Math.floor((HUD_H - o.y) / TS)), y1 = Math.min(map.h - 1, Math.floor((360 - o.y) / TS));
    const bossDead = !!DD.run.bossDead;
    const body = DD.run.body;
    const rev = S.vision >= 5;
    const shaking = map.shiftTimer < 1.4;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, HUD_H, 640, 360 - HUD_H); ctx.clip();
    ctx.imageSmoothingEnabled = false;

    // --- terrain, fire, traps, pickups
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (!map.seen[i]) continue;
        const sx = o.x + x * TS, sy = o.y + y * TS;
        const tile = map.tiles[y][x];
        let name = tile;
        if (tile === 'exit' && !bossDead) name = 'exit_locked';
        if (tile === 'stairs' || tile === 'exit' || tile === 'shiftwall_open') DD.sprites.tile(ctx, 'floor', sx, sy, SC, t);
        let jx = 0;
        if (shaking && (tile === 'shiftwall' || tile === 'shiftwall_open')) jx = ((t * 40) | 0) % 2 ? 1 : -1;
        DD.sprites.tile(ctx, name, sx + jx, sy, SC, t);
        if (tile === 'floor' && map.deco[i]) DD.sprites.tile(ctx, 'rubble', sx, sy, SC, t);
        if (map.fire[i] && S.vis[i]) DD.sprites.tile(ctx, 'fire', sx, sy, SC, t);
      }
    }
    for (const tr of map.traps) {
      const i = tr.y * w + tr.x;
      if (!map.seen[i] || map.fire[i]) continue;
      const near = S.vis[i] && (Math.hypot(tr.x - p.fx, tr.y - p.fy) <= 2.2 || rev);
      if (!near && !(tr.known && map.seen[i])) continue;
      DD.sprites.tile(ctx, tr.armed ? 'trap_' + tr.type : 'trap_spent', o.x + tr.x * TS, o.y + tr.y * TS, SC, t);
    }
    for (const pk of map.pickups) {
      if (pk.taken) continue;
      const i = pk.y * w + pk.x;
      if (!map.seen[i]) continue;
      const bob = Math.round(Math.sin(t * 3 + pk.phase) * 1.5);
      DD.sprites.tile(ctx, PICKUP_TILE[pk.kind], o.x + pk.x * TS, o.y + pk.y * TS + bob, SC, t);
    }

    // --- enemies (only where we currently see)
    for (const e of map.enemies) {
      if (e.dead) continue;
      const ti = Math.round(e.fy) * w + Math.round(e.fx);
      if (!S.vis[ti] && !S.vis[e.y * w + e.x]) continue;
      const ex = Math.round(o.x + e.fx * TS), ey = Math.round(o.y + e.fy * TS + Math.sin(t * 4 + e.phase) * 1);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(ex + 6, ey + TS - 5, TS - 12, 3);
      DD.sprites.enemyMini(ctx, e.enemyId, ex, ey, SC, t);
      if (e.boss) { if (DD.sprites.icon) DD.sprites.icon(ctx, 'skull', ex + 12, ey - 10, 1); }
      else if (e.chasing) DD.draw.text('!', ex + TS / 2, ey - 10, { color: PAL.bloodLight, size: 12, align: 'center' });
    }

    // --- player
    {
      const px = Math.round(o.x + p.fx * TS), py = Math.round(o.y + p.fy * TS);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(px + 6, py + TS - 5, TS - 12, 3);
      const blink = S.grace > 0 && ((t * 12) | 0) % 2 === 0;
      if (blink) ctx.globalAlpha = 0.45;
      DD.sprites.player(ctx, body, px, py, SC, t, p.facing);
      ctx.globalAlpha = 1;
    }

    // --- light / fog overlay
    const vr = S.vision + 1;
    const flick = 0.85 + 0.15 * Math.sin(t * 9) + 0.06 * Math.sin(t * 23 + 1.7);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (!map.seen[i]) continue;
        const sx = o.x + x * TS, sy = o.y + y * TS;
        if (!S.vis[i]) { ctx.fillStyle = 'rgba(8,5,14,0.62)'; ctx.fillRect(sx, sy, TS, TS); continue; }
        const d = Math.hypot(x - p.fx, y - p.fy);
        let dark = clamp01((d - 1.2) / vr) * 0.62;
        // flickering light from nearby fire
        let L = 0;
        for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) {
          if (xx < 0 || yy < 0 || xx >= map.w || yy >= map.h || !map.fire[yy * w + xx]) continue;
          L += 1 - Math.hypot(xx - x, yy - y) / 3;
        }
        L = Math.min(1, L * 0.5) * flick;
        dark *= 1 - 0.85 * L;
        if (dark > 0.02) { ctx.fillStyle = 'rgba(8,5,14,' + dark.toFixed(2) + ')'; ctx.fillRect(sx, sy, TS, TS); }
        if (L > 0.03) { ctx.fillStyle = 'rgba(255,110,20,' + (L * 0.2).toFixed(3) + ')'; ctx.fillRect(sx, sy, TS, TS); }
      }
    }
    ctx.restore();

    // --- ambient embers
    for (const e of S.embers) {
      const a = clamp01(e.life / e.max) * 0.9;
      ctx.globalAlpha = a;
      ctx.fillStyle = e.c;
      ctx.fillRect(Math.round(o.x + e.x), Math.round(o.y + e.y), 2, 2);
    }
    ctx.globalAlpha = 1;

    // --- rising panic tint
    const tension = tensionNow();
    if (tension > 0.05) {
      const pulse = DD.run.timeLeft < 60 ? 0.5 + 0.5 * Math.sin(t * 6) : 1;
      ctx.fillStyle = 'rgba(160,20,0,' + (tension * 0.10 * pulse).toFixed(3) + ')';
      ctx.fillRect(0, HUD_H, 640, 360 - HUD_H);
    }

    drawMinimap(ctx);
    drawOverlayText(ctx);
    if (DD.ui && DD.ui.drawHUD) DD.ui.drawHUD(ctx);
  }

  function drawMinimap(ctx) {
    const map = S.map, w = map.w, h = map.h;
    if (typeof document === 'undefined') return;
    if (!S.mini) { S.mini = document.createElement('canvas'); S.mini.width = w; S.mini.height = h; S.miniDirty = true; }
    if (S.miniDirty) {
      const m = S.mini.getContext('2d');
      m.clearRect(0, 0, w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!map.seen[y * w + x]) continue;
        let tile = map.tiles[y][x];
        m.fillStyle = tile === 'exit' && !DD.run.bossDead ? DD.PAL.blood : MINI_COL[tile];
        m.fillRect(x, y, 1, 1);
      }
      S.miniDirty = false;
    }
    const mx = 640 - w * 2 - 6, my = HUD_H + 4;
    ctx.fillStyle = 'rgba(8,5,14,0.6)';
    ctx.fillRect(mx - 2, my - 2, w * 2 + 4, h * 2 + 4);
    ctx.strokeStyle = DD.PAL.panelEdge; ctx.lineWidth = 1;
    ctx.strokeRect(mx - 1.5, my - 1.5, w * 2 + 3, h * 2 + 3);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(S.mini, mx, my, w * 2, h * 2);
    ctx.globalAlpha = 1;
    // fire in view, enemies in view, player
    ctx.fillStyle = DD.PAL.heat;
    for (const i of map.fireList) if (map.fire[i] && S.vis[i]) ctx.fillRect(mx + (i % w) * 2, my + ((i / w) | 0) * 2, 2, 2);
    ctx.fillStyle = DD.PAL.bloodLight;
    for (const e of map.enemies) if (!e.dead && S.vis[e.y * w + e.x]) ctx.fillRect(mx + e.x * 2, my + e.y * 2, 2, 2);
    if (((S.t * 3) | 0) % 2 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(mx + S.p.x * 2 - 1, my + S.p.y * 2 - 1, 4, 4); }
    // objective
    let obj = 'Objetivo: encuentra las escaleras';
    if (map.goal.kind === 'exit') obj = DD.run.bossDead ? '¡La salida está abierta!' : 'Objetivo: derrota al Rector';
    DD.draw.text(obj, 634, my + h * 2 + 6, { color: DD.PAL.dim, size: 8, align: 'right' });
  }

  function drawOverlayText(ctx) {
    const PAL = DD.PAL;
    // banner
    if (S.banner) {
      const b = S.banner;
      const a = clamp01(Math.min(b.t / 0.4, (b.dur - b.t) / 0.7));
      ctx.fillStyle = 'rgba(8,5,14,' + (0.7 * a).toFixed(2) + ')';
      ctx.fillRect(0, 110, 640, 62);
      DD.draw.text(b.title, 320, 122, { color: PAL.brass, size: 16, align: 'center', alpha: a });
      DD.draw.text(b.sub, 320, 148, { color: PAL.ink, size: 10, align: 'center', alpha: a });
    }
    // message
    if (S.msg) {
      const m = S.msg;
      const a = clamp01(Math.min(m.t / 0.15, (m.dur - m.t) / 0.5));
      ctx.fillStyle = 'rgba(8,5,14,' + (0.6 * a).toFixed(2) + ')';
      ctx.fillRect(0, 30, 640, 18);
      DD.draw.text(m.text, 320, 34, { color: m.color, size: 12, align: 'center', alpha: a });
    }
    // hint line
    ctx.fillStyle = 'rgba(8,5,14,0.6)';
    ctx.fillRect(0, 346, 640, 14);
    DD.draw.text('WASD/Flechas o cruceta: moverse · Mantén pulsado (ratón/táctil): avanzar · P: pausa', 320, 350, { color: PAL.dim, size: 8, align: 'center' });
  }

  DD.scenes = DD.scenes || {};
  DD.scenes.explore = { enter, update, draw, exit };
})();
