// Scene 'explore': real-time top-down exploration of the current tower floor.
(function () {
  'use strict';
  window.DD = window.DD || {};

  var TS = 16, HALF = 5, WALK = 70, GRACE = 2, TELEGRAPH = 1.5, HINT_TIME = 6, REVEAL = 5, FIRE_CAP = 40, FADE = 0.6;
  var HEADINGS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  var HUD_OPTS = { limbs: true };
  var STEP_SFX = { vol: 0.35 };

  var run, fl, tiles, w, h, TILE, active = false;
  var p = { x: 0, y: 0, dir: 0, step: 0 };
  var ptx = -1, pty = -1;
  var enemies = [], pickups = [], traps = [];
  var fireGrid, seen, flow, mini, miniCtx, dark;
  var t = 0, floorTime = 0, grace = 0, shiftClock = 0, telegraph = false, fireClock = 0, fireAcc = 0;
  var stepClock = 0, fade = 0, flash = 0, exitMsg = 0;

  function here() { return active && DD.Core.sceneName() === 'explore'; }

  function walkable(x, y) { return x >= 0 && y >= 0 && x < w && y < h && tiles[y * w + x] !== TILE.WALL; }

  // True if a 10x10 box centered at (cx, cy) overlaps a wall.
  function solid(cx, cy) {
    var x0 = Math.floor((cx - HALF) / TS), x1 = Math.floor((cx + HALF - 0.01) / TS);
    var y0 = Math.floor((cy - HALF) / TS), y1 = Math.floor((cy + HALF - 0.01) / TS);
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) if (!walkable(x, y)) return true;
    return false;
  }

  function tryMove(e, dx, dy) {
    if (solid(e.x + dx, e.y + dy)) return false;
    e.x += dx; e.y += dy;
    return true;
  }

  function clampAbs(v, d) { return v < -d ? -d : v > d ? d : v; }

  // Corner assist: blocked while moving along one axis, slide toward the lane of the open tile ahead.
  function assist(e, ax, ay, d) {
    var cx = (e.x / TS) | 0, cy = (e.y / TS) | 0;
    if (!walkable(cx + ax, cy + ay)) return;
    tryMove(e, ay ? clampAbs(cx * TS + 8 - e.x, d) : 0, ax ? clampAbs(cy * TS + 8 - e.y, d) : 0);
  }

  // Move an entity whose box overlaps a wall (after a shift) to the nearest walkable tile center.
  function unstick(e) {
    if (!solid(e.x, e.y)) return;
    var tx = (e.x / TS) | 0, ty = (e.y / TS) | 0;
    for (var r = 0; r < 10; r++) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !walkable(tx + dx, ty + dy)) continue;
          e.x = (tx + dx) * TS + 8; e.y = (ty + dy) * TS + 8;
          return;
        }
      }
    }
  }

  // ---- minimap and fog of war ----

  function miniTile(i) {
    var code = tiles[i], PAL = DD.Art.PAL;
    miniCtx.fillStyle = code === TILE.WALL ? PAL.stone : code === TILE.FLOOR ? PAL.mist : code === TILE.EXIT ? PAL.blood2 : PAL.brass2;
    miniCtx.fillRect((i % w) * 2, ((i / w) | 0) * 2, 2, 2);
  }

  function reveal() {
    for (var dy = -REVEAL; dy <= REVEAL; dy++) {
      for (var dx = -REVEAL; dx <= REVEAL; dx++) {
        var x = ptx + dx, y = pty + dy;
        if (dx * dx + dy * dy > REVEAL * REVEAL + 1 || x < 0 || y < 0 || x >= w || y >= h) continue;
        var i = y * w + x;
        if (!seen[i]) { seen[i] = 1; miniTile(i); }
      }
    }
  }

  function trackTile() {
    var tx = (p.x / TS) | 0, ty = (p.y / TS) | 0;
    if (tx === ptx && ty === pty) return;
    ptx = tx; pty = ty;
    reveal();
    DD.Tower.distances(fl, ptx, pty, flow);
  }

  // ---- floor loading ----

  function canBurn(x, y) {
    return x > 0 && y > 0 && x < w - 1 && y < h - 1 && tiles[y * w + x] === TILE.FLOOR && !fireGrid[y * w + x] &&
      !(x === fl.start.x && y === fl.start.y) && Math.abs(x - ptx) + Math.abs(y - pty) > 2;
  }

  // Fire spreads from existing fires half of the time, otherwise ignites a random floor tile.
  function spawnFire() {
    if (fl.fires.length >= FIRE_CAP) return;
    for (var k = 0; k < 16; k++) {
      var x, y;
      if (fl.fires.length && Math.random() < 0.5) {
        var f = fl.fires[(Math.random() * fl.fires.length) | 0], o = HEADINGS[1 + ((Math.random() * 4) | 0)];
        x = f.x + o[0]; y = f.y + o[1];
      } else {
        x = 1 + ((Math.random() * (w - 2)) | 0); y = 1 + ((Math.random() * (h - 2)) | 0);
      }
      if (canBurn(x, y)) { fl.fires.push({ x: x, y: y }); fireGrid[y * w + x] = 1; return; }
    }
  }

  function loadFloor(i) {
    run.floor = i;
    fl = run.tower.floors[i]; tiles = fl.tiles; w = fl.w; h = fl.h;
    fl.fires = fl.fires || [];
    fireGrid = new Uint8Array(w * h);
    fl.fires.forEach(function (f) { fireGrid[f.y * w + f.x] = 1; });
    seen = new Uint8Array(w * h);
    flow = new Int16Array(w * h);
    mini = document.createElement('canvas');
    mini.width = w * 2; mini.height = h * 2;
    miniCtx = mini.getContext('2d');

    enemies = []; pickups = []; traps = [];
    fl.entities.forEach(function (e) {
      if (e.kind === 'enemy') {
        enemies.push({ id: e.enemyId, def: DD.Data.ENEMIES[e.enemyId], x: e.x * TS + 8, y: e.y * TS + 8,
          guard: !!e.guard, alive: true, vx: 0, vy: 0, timer: 0 });
      } else if (e.kind === 'pickup') {
        pickups.push({ item: e.item, x: e.x, y: e.y, taken: false });
      } else if (e.kind === 'trap') {
        traps.push({ trap: e.trap, x: e.x, y: e.y, phase: e.phase || 0, state: 'idle', hit: -1 });
      }
    });

    p.x = fl.start.x * TS + 8; p.y = fl.start.y * TS + 8; p.dir = 0; p.step = 0;
    ptx = -1; trackTile();
    floorTime = 0; grace = GRACE; shiftClock = 0; telegraph = false; fireClock = 0; fireAcc = 0.7; fade = FADE;
    for (var k = 0; k < i * 5; k++) spawnFire(); // lower floors are already burning
    DD.Core.toast(DD.Data.FLOOR_NAME[i], 'brass2');
  }

  // ---- gameplay ----

  function movePlayer(dt) {
    var inp = DD.Core.input, mx = 0, my = 0;
    if (inp.held('left')) mx -= 1;
    if (inp.held('right')) mx += 1;
    if (inp.held('up')) my -= 1;
    if (inp.held('down')) my += 1;
    if (!mx && !my) { p.step = 0; stepClock = 0; return; }
    var d = WALK * DD.Core.getStats().speed * dt;
    if (mx && my) d *= 0.7071;
    p.dir = mx ? (mx < 0 ? 1 : 2) : (my < 0 ? 3 : 0);
    if (mx && !tryMove(p, mx * d, 0) && !my) assist(p, mx, 0, d);
    if (my && !tryMove(p, 0, my * d) && !mx) assist(p, 0, my, d);
    p.step += dt * 8;
    stepClock -= dt;
    if (stepClock <= 0) { stepClock = 0.34; DD.Audio.sfx('step', STEP_SFX); }
  }

  function hurt(dmg, heat) {
    var slot = heat ? DD.Core.randomLimbSlot() : null;
    if (slot) DD.Core.heatLimb(slot, heat);
    flash = 0.3;
    DD.Core.shake(2, 0.2);
    DD.Core.damagePlayer(dmg, true);
  }

  function applyItem(item) {
    var C = DD.Core, A = DD.Audio, name = DD.Data.ITEMS[item].name;
    if (item === 'elixir') { C.healPlayer(10); C.toast(name + ': +10 vida', 'verdi2'); A.sfx('elixir'); }
    else if (item === 'thread') { C.repairLimbs(2); C.toast(name + ': +2 integridad', 'bone'); A.sfx('pickup'); }
    else if (item === 'gear') { C.addTime(12); C.toast(name + ': +12 s', 'brass2'); A.sfx('gear'); }
    else if (item === 'essence') { run.essence += 5; C.toast(name + ': +5', 'flame2'); A.sfx('essence'); }
    else if (item === 'blueprint') {
      var id = C.discoverRandom();
      C.toast(id ? 'Plano descubierto: ' + DD.Data.LIMBS[id].name : 'Ya conoces todos los planos', 'verdi2');
      A.sfx('blueprint');
    }
  }

  function collect() {
    for (var i = 0; i < pickups.length; i++) {
      var k = pickups[i];
      if (k.taken || Math.abs(k.x * TS + 8 - p.x) > 10 || Math.abs(k.y * TS + 8 - p.y) > 10) continue;
      k.taken = true;
      applyItem(k.item);
    }
  }

  function updateTraps() {
    for (var i = 0; i < traps.length; i++) {
      var tr = traps[i], spikes = tr.trap === 'spikes', per = spikes ? 3 : 4, local = (t + tr.phase) % per;
      var st = spikes ? (local < 1.2 ? 'idle' : local < 1.8 ? 'warn' : 'active')
        : (local < 2.6 ? 'idle' : local < 3.2 ? 'warn' : 'active');
      if (st === 'active' && tr.state !== 'active' && Math.abs(tr.x - ptx) <= 6 && Math.abs(tr.y - pty) <= 4) DD.Audio.sfx(tr.trap);
      tr.state = st;
      if (st !== 'active' || tr.x !== ptx || tr.y !== pty) continue;
      var cycle = Math.floor((t + tr.phase) / per);
      if (tr.hit === cycle) continue;
      tr.hit = cycle;
      if (spikes) hurt(4, 0); else hurt(2, 3);
      if (!here()) return;
    }
  }

  function updateFire(dt) {
    if (fireGrid[pty * w + ptx]) {
      fireAcc += dt;
      if (fireAcc >= 1) { fireAcc -= 1; DD.Audio.sfx('fire_hit'); hurt(2, 1); }
    } else {
      fireAcc = 0.7; // first burn comes 0.3 s after stepping in
    }
    fireClock += dt;
    if (fireClock >= 7 - 5.5 * Math.min(1, run.time / DD.Data.CONST.RUN_SECONDS)) { fireClock = 0; spawnFire(); }
  }

  function applyShift() {
    var changes = DD.Tower.shift(fl, DD.Core.rng((Math.random() * 2147483647) | 0), { x: ptx, y: pty });
    for (var i = 0; i < changes.length; i++) {
      var j = changes[i].y * w + changes[i].x;
      if (seen[j]) miniTile(j);
    }
    unstick(p);
    for (i = 0; i < enemies.length; i++) if (enemies[i].alive) unstick(enemies[i]);
    ptx = -1; trackTile();
    DD.Audio.sfx('door');
  }

  function updateShift(dt) {
    var every = DD.Data.CONST.SHIFT_EVERY;
    shiftClock += dt;
    if (!telegraph && shiftClock >= every - TELEGRAPH) {
      telegraph = true;
      DD.Core.toast('La torre se reordena', 'blood2');
      DD.Audio.sfx('shift');
      DD.Core.shake(2, TELEGRAPH);
    }
    if (shiftClock >= every) { shiftClock = 0; telegraph = false; applyShift(); }
  }

  function newHeading(e) {
    var hd = HEADINGS[(Math.random() * 5) | 0];
    e.vx = hd[0]; e.vy = hd[1]; e.timer = 0.8 + Math.random() * 1.7;
  }

  function moveEnemy(e, dt) {
    var dx = p.x - e.x, dy = p.y - e.y, sense = e.def.sense * TS, sp = e.def.speed * dt;
    if (dx * dx + dy * dy <= sense * sense) {
      // Chase along the walking-distance field toward the player.
      var tx = (e.x / TS) | 0, ty = (e.y / TS) | 0, best = flow[ty * w + tx];
      if (best > 0) {
        var gx = tx, gy = ty;
        for (var k = 1; k < 5; k++) {
          var nx = tx + HEADINGS[k][0], ny = ty + HEADINGS[k][1], v = walkable(nx, ny) ? flow[ny * w + nx] : -1;
          if (v >= 0 && v < best) { best = v; gx = nx; gy = ny; }
        }
        dx = gx * TS + 8 - e.x; dy = gy * TS + 8 - e.y;
      }
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      tryMove(e, dx / len * sp, 0);
      tryMove(e, 0, dy / len * sp);
      return;
    }
    e.timer -= dt;
    if (e.timer <= 0) newHeading(e);
    if (!e.vx && !e.vy) return;
    if (!tryMove(e, e.vx * sp * 0.5, e.vy * sp * 0.5)) newHeading(e);
  }

  function combatDone(e, result) {
    if (!result || !result.won) return;
    e.alive = false;
    if (e.id === 'clockmaker') { run.bossDead = true; DD.Core.toast('¡La salida se ha abierto!', 'verdi2'); }
    if (result.drops && result.drops.length) DD.Core.push('graft', { offers: result.drops, onDone: resume });
  }

  // Returns true if a combat was started.
  function updateEnemies(dt) {
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) continue;
      if (!e.guard) moveEnemy(e, dt);
      var reach = e.guard ? 16 : 11;
      if (grace > 0 || Math.abs(e.x - p.x) >= reach || Math.abs(e.y - p.y) >= reach) continue;
      DD.Audio.sfx('growl');
      DD.Core.push('combat', { enemyId: e.id, onDone: combatDone.bind(null, e) });
      return true;
    }
    return false;
  }

  function update(dt) {
    t += dt; floorTime += dt;
    if (grace > 0) grace -= dt;
    if (fade > 0) fade -= dt;
    if (flash > 0) flash -= dt;
    if (exitMsg > 0) exitMsg -= dt;

    movePlayer(dt);
    trackTile();
    collect();

    var code = tiles[pty * w + ptx];
    if (code === TILE.STAIRS_DOWN && run.floor + 1 < run.tower.floors.length) {
      DD.Audio.sfx('stairs');
      loadFloor(run.floor + 1);
      return;
    }
    if (code === TILE.EXIT) {
      if (run.bossDead) { DD.Core.endRun('escape'); return; }
      if (exitMsg <= 0) { DD.Core.toast('La salida está sellada', 'blood2'); DD.Audio.sfx('error'); }
      exitMsg = 2.5;
    }

    updateTraps();
    if (!here()) return;
    updateFire(dt);
    if (!here()) return;
    updateShift(dt);
    updateEnemies(dt);
  }

  // ---- drawing ----

  function darkness() {
    if (dark) return dark;
    dark = document.createElement('canvas');
    dark.width = 768; dark.height = 432;
    var c = dark.getContext('2d'), g = c.createRadialGradient(384, 216, 40, 384, 216, 210);
    g.addColorStop(0, 'rgba(13,10,18,0)');
    g.addColorStop(1, 'rgba(13,10,18,0.88)');
    c.fillStyle = g;
    c.fillRect(0, 0, 768, 432);
    return dark;
  }

  function drawMinimap(ctx) {
    var PAL = DD.Art.PAL, mx = 380 - w * 2, my = 32, blink = ((t * 3) | 0) % 2;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(mx - 1, my - 1, w * 2 + 2, h * 2 + 2);
    ctx.globalAlpha = 1;
    ctx.drawImage(mini, mx, my);
    ctx.strokeStyle = PAL.brass;
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 1.5, my - 1.5, w * 2 + 3, h * 2 + 3);
    var goal = fl.stairsDown || fl.exit;
    if (goal && seen[goal.y * w + goal.x]) {
      ctx.fillStyle = blink ? PAL.bone : (fl.exit ? PAL.blood2 : PAL.brass2);
      ctx.fillRect(mx + goal.x * 2 - 1, my + goal.y * 2 - 1, 4, 4);
    }
    ctx.fillStyle = PAL.flame2;
    ctx.fillRect(mx + ptx * 2, my + pty * 2, 2, 2);
  }

  function draw(ctx) {
    var A = DD.Art, PAL = A.PAL, x, y, i, sx, sy;
    var camX = Math.round(Math.max(0, Math.min(p.x - 192, w * TS - 384)));
    var camY = Math.round(Math.max(0, Math.min(p.y - 108, h * TS - 216)));
    var x0 = (camX / TS) | 0, y0 = (camY / TS) | 0;
    var x1 = Math.min(w - 1, ((camX + 383) / TS) | 0), y1 = Math.min(h - 1, ((camY + 215) / TS) | 0);

    ctx.fillStyle = PAL.ink;
    ctx.fillRect(0, 0, 384, 216);
    for (y = y0; y <= y1; y++) {
      for (x = x0; x <= x1; x++) A.tile(ctx, tiles[y * w + x], x * TS - camX, y * TS - camY, x * 131 + y * 17, t);
    }
    for (i = 0; i < traps.length; i++) {
      var tr = traps[i];
      if (tr.x >= x0 && tr.x <= x1 && tr.y >= y0 && tr.y <= y1) A.trap(ctx, tr.trap, tr.x * TS - camX, tr.y * TS - camY, tr.state, t);
    }
    for (i = 0; i < fl.fires.length; i++) {
      var f = fl.fires[i];
      if (f.x >= x0 && f.x <= x1 && f.y >= y0 && f.y <= y1) A.fire(ctx, f.x * TS - camX, f.y * TS - camY, t);
    }
    for (i = 0; i < pickups.length; i++) {
      var k = pickups[i];
      if (!k.taken && k.x >= x0 && k.x <= x1 && k.y >= y0 && k.y <= y1) A.item(ctx, k.item, k.x * TS - camX, k.y * TS - camY, t);
    }
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i], half = e.guard ? 16 : 8;
      sx = Math.round(e.x - camX); sy = Math.round(e.y - camY);
      if (!e.alive || sx < -half || sy < -half || sx > 384 + half || sy > 216 + half) continue;
      ctx.drawImage(A.enemySprite(e.id, e.guard ? 'big' : 'small'), sx - half, sy - half);
    }
    sx = Math.round(p.x - camX); sy = Math.round(p.y - camY);
    if (!(grace > 0 && ((t * 12) | 0) % 2)) A.drawPlayerWorld(ctx, sx - 8, sy - 10, p.dir, p.step, run.player.limbs);

    ctx.drawImage(darkness(), sx - 384, sy - 216);
    if (flash > 0) {
      ctx.globalAlpha = Math.min(0.35, flash);
      ctx.fillStyle = PAL.blood2;
      ctx.fillRect(0, 0, 384, 216);
    }
    if (fade > 0) {
      ctx.globalAlpha = fade / FADE;
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(0, 0, 384, 216);
    }
    ctx.globalAlpha = 1;

    DD.UI.drawHud(ctx, HUD_OPTS);
    drawMinimap(ctx);
    if (floorTime < HINT_TIME) {
      ctx.globalAlpha = Math.min(1, HINT_TIME - floorTime);
      A.text(ctx, fl.exit ? 'Llega a la salida' : 'Encuentra las escaleras', 192, 52, 'bone', 1, 'center', 'ink');
      ctx.globalAlpha = 1;
    }
  }

  // ---- scene ----

  function enter(params) {
    run = DD.Core.run;
    TILE = DD.Data.TILE;
    active = true;
    t = 0;
    loadFloor(params && params.floor ? params.floor : 0);
    DD.Audio.music('explore');
  }

  function exit() { active = false; }

  function resume() {
    grace = GRACE;
    DD.Audio.music('explore');
  }

  DD.Core.registerScene('explore', {
    ticksClock: true, touchPad: true,
    enter: enter, exit: exit, update: update, draw: draw, resume: resume
  });
})();
