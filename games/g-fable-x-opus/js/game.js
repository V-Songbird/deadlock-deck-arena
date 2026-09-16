// P7 Game: meta persistence, run state, every screen and the HUD (spec 5.7).
window.Game = (function () {
  'use strict';

  var G = Core.gfx, UI = Core.ui, PAL = Core.PAL;
  var CFG = Data.CONFIG, TT = Tower.T;
  var W = Core.W, H = Core.H;
  var TILE = 16, MAPW = Tower.W * TILE, MAPH = Tower.H * TILE;
  var META_KEY = 'deadlock_meta';

  var PART_W = { head: 12, torso: 16, arm: 8, leg: 8 };   // part sprite widths, for centring
  var HEAT_LABEL = { head: 'Cab', torso: 'Tor', armL: 'B.I', armR: 'B.D', legL: 'P.I', legR: 'P.D' };
  var FLOOR_TILES = ['floor', 'floor2', 'floor3'];

  var state = 'title';
  var meta = null;
  var run = null;
  var frameDt = 0;
  var previewLimbs = null;      // body shown on title/shop previews
  var firstInput = false;       // hides the "activate sound" hint
  var graftPage = 0;            // initial-graft pager
  var sidePrompt = null;        // { id } while asking which arm/leg to replace
  var modal = false;            // suppresses background buttons while a prompt is open
  var holdTimer = 0;            // key-repeat timer for held movement keys

  // ------------------------------------------------------------ meta / saves

  function defaultMeta() {
    return {
      blueprints: [], ichor: 0, cosmetics: ['skin_default'], skin: 'skin_default',
      packs: [], escapes: 0, loops: 0, bestTime: null
    };
  }

  function loadMeta() {
    var def = defaultMeta();
    var raw = Core.load(META_KEY, def) || def;
    var out = defaultMeta();
    for (var k in out) if (raw[k] !== undefined && raw[k] !== null) out[k] = raw[k];
    if (out.cosmetics.indexOf('skin_default') < 0) out.cosmetics.push('skin_default');
    return out;
  }

  function saveMeta() { Core.save(META_KEY, meta); }

  function tint() {
    for (var i = 0; i < Data.COSMETICS.length; i++) {
      var c = Data.COSMETICS[i];
      if (c.id === meta.skin) {
        for (var k in c.tint) return c.tint;   // non-empty tint
        return null;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ helpers

  function clip(s, n) {
    s = String(s);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function fmtTime(s) {
    s = Math.max(0, Math.floor(s));
    var m = Math.floor(s / 60), ss = s % 60;
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function famsOf(limbs) {
    var out = {};
    for (var i = 0; i < Data.SLOTS.length; i++) {
      var k = Data.SLOTS[i], inst = limbs ? limbs[k] : null;
      out[k] = (inst && Data.LIMBS[inst.id]) ? Data.LIMBS[inst.id].family : null;
    }
    return out;
  }

  function limbName(inst) { return (inst && Data.LIMBS[inst.id]) ? Data.LIMBS[inst.id].name : 'muñón'; }

  function cardSummary(limbId) {
    var L = Data.LIMBS[limbId], out = [];
    if (!L) return '';
    for (var i = 0; i < L.cards.length; i++) {
      var c = L.cards[i], def = Data.CARDS[c.id];
      out.push((def ? def.name : c.id) + ' ×' + c.count);
    }
    return out.join(', ');
  }

  function heatColor(ratio) { return ratio >= 0.75 ? PAL.heat : (ratio >= 0.4 ? PAL.fire3 : PAL.sick); }

  function log(line) {
    if (!run) return;
    run.log.push(line);
    while (run.log.length > 6) run.log.shift();
  }

  function btn(x, y, w, h, label, o) {   // background buttons are disabled while a prompt is open
    o = o || {};
    if (modal) { var c = {}; for (var k in o) c[k] = o[k]; c.disabled = true; o = c; }
    return UI.button(x, y, w, h, label, o);
  }

  function muteButton(x, y) {
    var hit = btn(x, y, 20, 20, '');
    G.icon(Sound.muted ? 'mute' : 'sound', x + 6, y + 6);
    if (hit) Sound.toggleMute();
  }

  function setState(s) {
    state = s;
    if (s === 'explore') Sound.music('run');
    else if (s === 'death') Sound.music('death');
    else if (s === 'victory') Sound.music('victory');
    else if (s === 'title' || s === 'table' || s === 'codex' || s === 'shop') Sound.music('title');
    // 'combat' is set by Combat.start; 'harvest' keeps the combat track until "Continuar".
  }

  // --------------------------------------------------------------- run setup

  function newRun() {
    var seed = Date.now() >>> 0;
    var rnd = Core.rng(seed);
    var limbs = Data.newBaseBody(rnd);
    var player = { hp: 0, maxHp: Data.maxHp(limbs), limbs: limbs, block: 0, poison: 0, ichor: 0 };
    player.hp = player.maxHp;
    run = {
      seed: seed, rnd: rnd, floorIndex: 0, floor: null, player: player,
      pos: { x: 0, y: 0 }, prevPos: { x: 0, y: 0 },
      timeLeft: CFG.startTime, mutateTimer: 0, log: [], kills: 0, initialGraftUsed: false,
      enemyEnt: null, enemyDef: null, harvest: null, summary: null, deathReason: 'time',
      lastSecond: Math.ceil(CFG.startTime)
    };
  }

  function newFloor() {
    run.floor = Tower.generate(run.rnd, run.floorIndex);
    run.pos = { x: run.floor.start.x, y: run.floor.start.y };
    run.prevPos = { x: run.pos.x, y: run.pos.y };
    run.mutateTimer = 0;
    Tower.reveal(run.floor, run.pos.x, run.pos.y, CFG.fogRadius);
  }

  function startRun() {
    if (!run) newRun();
    run.floorIndex = 0;
    newFloor();
    setState('explore');
  }

  function toTable() {
    newRun();
    graftPage = 0;
    sidePrompt = null;
    setState('table');
  }

  // ------------------------------------------------------- limbs, breaks, fx

  function breakCheck(slot) {
    if (!run) return false;
    var p = run.player, inst = p.limbs[slot];
    if (!inst) return false;
    var def = Data.LIMBS[inst.id];
    if (!def || inst.heat < def.maxHeat) return false;
    p.limbs[slot] = null;
    log('¡Se rompe: ' + Data.SLOT_NAMES[slot] + ' (' + def.name + ')!');
    Core.toast('¡Se rompe: ' + Data.SLOT_NAMES[slot] + '!');
    Sound.sfx('break');
    Core.shake(4, 0.4);
    p.maxHp = Data.maxHp(p.limbs);
    if (p.hp > p.maxHp) p.hp = p.maxHp;
    return true;
  }

  function randomLimbSlot() {
    var pool = [];
    for (var i = 0; i < Data.SLOTS.length; i++) if (run.player.limbs[Data.SLOTS[i]]) pool.push(Data.SLOTS[i]);
    if (!pool.length) return null;
    return pool[Math.floor(run.rnd() * pool.length)];
  }

  function coolAll(value) {
    for (var i = 0; i < Data.SLOTS.length; i++) {
      var inst = run.player.limbs[Data.SLOTS[i]];
      if (inst) inst.heat = Math.max(0, inst.heat - value);
    }
  }

  function applyResource(ent) {
    var def = Data.RESOURCES[ent.id];
    Tower.removeEntity(run.floor, ent);
    if (!def) return;
    var p = run.player, fx = def.effect;
    if (fx.kind === 'coolAll') coolAll(fx.value);
    else if (fx.kind === 'heal') p.hp = Math.min(p.maxHp, p.hp + fx.value);
    else if (fx.kind === 'time') run.timeLeft += fx.value;
    else if (fx.kind === 'ichor') p.ichor += fx.value;
    Sound.sfx('pickup');
    Core.toast(def.name + ': ' + def.desc);
    log(def.name + ': ' + def.desc);
  }

  function applyTrap(ent) {
    var def = Data.TRAPS[ent.id];
    Tower.removeEntity(run.floor, ent);
    if (!def) return;
    var p = run.player, fx = def.effect;
    Sound.sfx('trap');
    Core.shake(3, 0.3);
    Core.toast(def.name + ': ' + def.desc);
    log(def.name + ': ' + def.desc);
    if (fx.kind === 'damage') {
      p.hp -= fx.value;                          // traps ignore block
      if (p.hp <= 0) { p.hp = 0; death('killed'); }
    } else if (fx.kind === 'heat') {
      var slot = randomLimbSlot();
      if (slot) { p.limbs[slot].heat += fx.value; breakCheck(slot); }
    }
  }

  // ------------------------------------------------------------------ moving

  function fight(ent) {
    run.enemyEnt = ent;
    run.enemyDef = Data.ENEMIES[ent.id];
    Combat.start(run.player, run.enemyDef, run.rnd);
    setState('combat');
  }

  function guardianEnt(f) {   // the Quimera while it still lives on the last floor
    if (run.floorIndex !== CFG.floors - 1) return null;
    return f.entities.filter(function (e) { return e.type === 'enemy' && e.id === Data.GUARDIAN; })[0] || null;
  }

  function movePlayer(dx, dy) {
    var f = run.floor, nx = run.pos.x + dx, ny = run.pos.y + dy;
    if (!Tower.walkable(f, nx, ny)) return;
    run.prevPos = { x: run.pos.x, y: run.pos.y };
    run.pos = { x: nx, y: ny };
    Sound.sfx('step');
    Tower.reveal(f, nx, ny, CFG.fogRadius);
    var ent = Tower.entityAt(f, nx, ny);
    if (ent) {
      if (ent.type === 'enemy') fight(ent);
      else if (ent.type === 'resource') applyResource(ent);
      else if (ent.type === 'trap') applyTrap(ent);
      return;   // entities never sit on the exit tile
    }
    if (Tower.get(f, nx, ny) !== TT.EXIT) return;
    var guard = guardianEnt(f);
    if (!guard) { nextFloor(); return; }
    run.pos = { x: run.prevPos.x, y: run.prevPos.y };   // barred: the player never enters the exit tile
    log('¡La Quimera bloquea la salida!');
    Core.toast('¡La Quimera bloquea la salida!');
    Sound.sfx('growl');
    fight(guard);
  }

  function moveTo(x, y) {   // debug/step helper: one step when adjacent, otherwise a teleport
    var dx = x - run.pos.x, dy = y - run.pos.y;
    if (Math.abs(dx) + Math.abs(dy) === 1) { movePlayer(dx, dy); return; }
    run.prevPos = { x: run.pos.x, y: run.pos.y };
    run.pos = { x: x, y: y };
    Tower.reveal(run.floor, x, y, CFG.fogRadius);
  }

  function nextFloor() {
    if (run.floorIndex < CFG.floors - 1) {
      run.floorIndex++;
      newFloor();
      Core.toast('Subes al piso ' + (run.floorIndex + 1));
      log('Subes al piso ' + (run.floorIndex + 1));
      if (run.floorIndex === CFG.floors - 1) Core.toast('La Quimera guarda la salida', 3);
      Sound.sfx('step');
    } else {
      victory();
    }
  }

  // ------------------------------------------------------------ run outcomes

  function death(reason) {
    if (state === 'death') return;
    run.deathReason = reason;
    meta.loops++;
    meta.ichor += run.player.ichor;
    saveMeta();
    Sound.sfx('death');
    setState('death');
  }

  function victory() {
    var bonus = Math.floor(run.timeLeft / 10);
    run.summary = { time: run.timeLeft, kills: run.kills, ichor: run.player.ichor, bonus: bonus };
    meta.escapes++;
    meta.ichor += run.player.ichor + bonus;
    if (meta.bestTime === null || run.timeLeft > meta.bestTime) meta.bestTime = run.timeLeft;
    saveMeta();
    Sound.sfx('victory');
    setState('victory');
  }

  // ------------------------------------------------------------ combat/graft

  function endCombat() {
    var r = Combat.result;
    if (!r) return;
    if (r === 'win') {
      run.kills++;
      for (var i = 0; i < Data.SLOTS.length; i++) {
        var inst = run.player.limbs[Data.SLOTS[i]];
        if (inst && Data.LIMBS[inst.id]) {
          inst.heat = Math.max(0, inst.heat - Data.LIMBS[inst.id].cool * CFG.endCombatCoolMult);
        }
      }
      if (run.enemyEnt) Tower.removeEntity(run.floor, run.enemyEnt);
      run.player.ichor += run.enemyDef.ichor;
      log('Cae: ' + run.enemyDef.name + ' (+' + run.enemyDef.ichor + ' icor)');
      run.harvest = { def: run.enemyDef, offers: makeOffers(run.enemyDef) };
      setState('harvest');
    } else if (r === 'lose') {
      death('killed');
    } else {
      run.pos = { x: run.prevPos.x, y: run.prevPos.y };
      log('Huyes de ' + run.enemyDef.name + '.');
      setState('explore');
    }
  }

  function makeOffers(def) {
    var pool = def.drops.slice();
    Core.shuffle(pool, run.rnd);
    var out = [], used = {};
    for (var i = 0; i < pool.length && out.length < CFG.harvestOffers; i++) {
      var L = Data.LIMBS[pool[i]];
      if (!L || used[L.slot]) continue;
      used[L.slot] = true;
      out.push({ id: pool[i], gone: false });
    }
    return out;
  }

  function discover(id) {
    var L = Data.LIMBS[id];
    if (!L || L.family === 'base' || meta.blueprints.indexOf(id) >= 0) return;
    meta.blueprints.push(id);
    saveMeta();
    Core.toast('¡Nuevo plano anatómico: ' + L.name + '!');
    Sound.sfx('unlock');
  }

  function graft(id, slot) {
    var p = run.player;
    p.limbs[slot] = { id: id, heat: 0 };
    p.maxHp = Data.maxHp(p.limbs);
    if (p.hp > p.maxHp) p.hp = p.maxHp;
    Sound.sfx('graft');
    log('Injertas: ' + Data.LIMBS[id].name + ' (' + Data.SLOT_NAMES[slot] + ')');
    discover(id);
  }

  // ------------------------------------------------------------------ update

  function update(dt) {
    frameDt = dt;
    modal = false;
    if (run && (state === 'explore' || state === 'combat' || state === 'harvest')) {
      run.timeLeft -= dt;
      Sound.urgency(Math.max(0, Math.min(1, 1 - run.timeLeft / CFG.startTime)));
      var s = Math.ceil(Math.max(0, run.timeLeft));
      if (s !== run.lastSecond) {
        run.lastSecond = s;
        if (s > 0 && s < 60) Sound.sfx('tick');
        if (s === 30 || s === 10) Sound.sfx('alarm');
      }
      if (run.timeLeft <= 0) { run.timeLeft = 0; death('time'); return; }
    }
    if (state === 'explore') {
      run.mutateTimer += dt;
      if (run.mutateTimer >= CFG.mutateEvery) {
        run.mutateTimer = 0;
        Tower.mutate(run.floor, run.rnd, run.pos);
        Tower.reveal(run.floor, run.pos.x, run.pos.y, CFG.fogRadius);
        Core.toast('El laboratorio se reconfigura…');
        log('El laboratorio se reconfigura…');
        Sound.sfx('shift');
        Core.shake(3, 0.5);
      }
    } else if (state === 'combat') {
      Combat.update(dt);
      endCombat();
    }
  }

  // -------------------------------------------------------------------- HUD

  function drawHud() {
    if (!run) return;
    var ctx = Core.ctx, t = Math.max(0, run.timeLeft);
    Sprites.fireOverlay(Math.max(0.1, 1 - t / CFG.startTime), Core.time);
    if (t < 60) {
      var a = 0.05 + 0.15 * (0.5 + 0.5 * Math.sin(Core.time * 6));
      ctx.save();
      ctx.globalAlpha = a;
      G.rect(0, 0, W, 6, PAL.blood); G.rect(0, H - 6, W, 6, PAL.blood);
      G.rect(0, 0, 6, H, PAL.blood); G.rect(W - 6, 0, 6, H, PAL.blood);
      ctx.restore();
    }
    var color = t < 60 ? PAL.heat : (t < 120 ? PAL.fire3 : PAL.bone);
    var visible = t >= 60 || Math.floor(Core.time / 0.25) % 2 === 0;
    if (visible) G.text(fmtTime(t), 384, 4, { size: 16, color: color });
  }

  // ------------------------------------------------------------------- title

  function titleScreen() {
    G.clear(PAL.bg);
    Sprites.logo(240, 30);
    G.text('El Reloj Anatómico', 240, 60, { align: 'center', color: PAL.dim });
    Sprites.drawBody(famsOf(previewLimbs), 200, 72, {
      scale: 2, tint: tint(), bob: Math.round(Math.sin(Core.time * 3))
    });
    if (UI.button(160, 150, 160, 22, 'Despertar [Enter]', { key: 'Enter' })) toTable();
    if (UI.button(160, 178, 76, 20, 'Planos')) setState('codex');
    if (UI.button(244, 178, 76, 20, 'Tienda')) setState('shop');
    muteButton(456, 246);

    if (!firstInput) {
      G.text('Toca o pulsa una tecla para activar el sonido', 240, 216, { align: 'center', color: PAL.dim });
    }
    var best = meta.bestTime === null ? '—' : fmtTime(meta.bestTime);
    G.text('Huidas: ' + meta.escapes + ' · Bucles: ' + meta.loops + ' · Mejor: ' + best,
      240, 236, { align: 'center', color: PAL.bone });
    Sprites.fireOverlay(0.15, Core.time);

    var p = Core.input.pointer;
    if (p.justDown || Core.input.dir() || Core.input.pressed('Enter') || Core.input.pressed(' ')) firstInput = true;
  }

  // ------------------------------------------------------------------- table

  function tableScreen() {
    if (!run) newRun();
    modal = !!sidePrompt;
    G.clear(PAL.bg);
    G.text('Mesa de disección', 8, 6, { size: 16, color: PAL.bone });
    G.wrap('Despiertas sobre una mesa de disección. Nuevo cuerpo. Mismo reloj.', 8, 30, 160, { color: PAL.dim });

    for (var t = 0; t < 4; t++) G.sprite(Sprites.tiles.table, 68 + t * 16, 166, {});
    Sprites.drawBody(famsOf(run.player.limbs), 60, 86, { scale: 2, tint: tint() });
    G.text('PV ' + run.player.hp + '/' + run.player.maxHp, 8, 186, { color: PAL.hp });

    // six slots with their card summary
    for (var i = 0; i < Data.SLOTS.length; i++) {
      var slot = Data.SLOTS[i], inst = run.player.limbs[slot], y = 26 + i * 20;
      G.text(Data.SLOT_NAMES[slot] + ': ' + clip(limbName(inst), 24), 176, y, { color: PAL.text });
      G.text(clip(inst ? cardSummary(inst.id) : 'Muñonazo ×1', 37), 176, y + 9, { color: PAL.dim });
    }

    tableGraftPanel();
    if (btn(24, 240, 148, 22, 'Levántate [Enter]', { key: 'Enter' })) startRun();
    if (sidePrompt) sidePromptPanel();
  }

  function graftList() {
    var out = [];
    for (var i = 0; i < meta.blueprints.length; i++) {
      var L = Data.LIMBS[meta.blueprints[i]];
      if (L && L.family !== 'base') out.push(L);
    }
    return out;
  }

  function tableGraftPanel() {
    var list = graftList();
    if (!list.length) return;
    G.panel(176, 148, 296, 94, {});
    G.text('Injerto inicial', 180, 152, { color: PAL.bone });
    var pages = Math.ceil(list.length / 6);
    if (graftPage >= pages) graftPage = 0;
    if (pages > 1) {
      G.text((graftPage + 1) + '/' + pages, 388, 152, { color: PAL.dim });
      if (btn(416, 150, 24, 12, '<')) graftPage = (graftPage + pages - 1) % pages;
      if (btn(444, 150, 24, 12, '>')) graftPage = (graftPage + 1) % pages;
    }
    if (run.initialGraftUsed) {
      G.text('Ya has usado el injerto de este bucle.', 180, 172, { color: PAL.dim });
      return;
    }
    for (var i = 0; i < 6; i++) {
      var L = list[graftPage * 6 + i];
      if (!L) break;
      var cx = 180 + (i % 2) * 146, cy = 168 + Math.floor(i / 2) * 24;
      G.text(clip(L.name, 17), cx, cy, { color: PAL.text });
      if (btn(cx, cy + 10, 76, 14, 'Injertar')) {
        if (L.slot === 'arm' || L.slot === 'leg') sidePrompt = { id: L.id };
        else { graft(L.id, L.slot); run.initialGraftUsed = true; }
      }
    }
  }

  function sidePromptPanel() {
    var L = Data.LIMBS[sidePrompt.id];
    var isArm = L.slot === 'arm';
    var slotL = isArm ? 'armL' : 'legL', slotR = isArm ? 'armR' : 'legR';
    G.panel(160, 96, 160, 62, {});
    G.text(isArm ? '¿Qué brazo?' : '¿Qué pierna?', 240, 100, { align: 'center', color: PAL.bone });
    var taken = false;
    if (UI.button(168, 112, 68, 18, 'Izq.')) { graft(L.id, slotL); taken = true; }
    if (UI.button(244, 112, 68, 18, 'Der.')) { graft(L.id, slotR); taken = true; }
    if (taken) { run.initialGraftUsed = true; sidePrompt = null; return; }
    if (UI.button(168, 134, 144, 18, 'Cancelar')) sidePrompt = null;
  }

  // ----------------------------------------------------------------- explore

  function heldDir() {
    var I = Core.input;
    if (I.down('ArrowUp') || I.down('w')) return 'up';
    if (I.down('ArrowDown') || I.down('s')) return 'down';
    if (I.down('ArrowLeft') || I.down('a')) return 'left';
    if (I.down('ArrowRight') || I.down('d')) return 'right';
    return null;
  }

  function stepDir(d) {
    if (d === 'up') movePlayer(0, -1);
    else if (d === 'down') movePlayer(0, 1);
    else if (d === 'left') movePlayer(-1, 0);
    else if (d === 'right') movePlayer(1, 0);
  }

  function exploreInput(dt) {
    var d = Core.input.dir();
    if (d) { holdTimer = 0; stepDir(d); return; }
    var hd = heldDir();
    if (hd) {
      holdTimer += dt;
      if (holdTimer >= 0.14) { holdTimer -= 0.14; stepDir(hd); }
      return;
    }
    holdTimer = 0;
    var p = Core.input.pointer;
    // tap-to-step on release (a swipe already moved through Core.input.dir)
    if (p.justUp && !Core.input.swipe && p.x >= 0 && p.x < MAPW && p.y >= 0 && p.y < MAPH) {
      var dx = p.x - (run.pos.x * TILE + 8), dy = p.y - (run.pos.y * TILE + 8);
      if (dx * dx + dy * dy > 64) {
        if (Math.abs(dx) >= Math.abs(dy)) movePlayer(dx > 0 ? 1 : -1, 0);
        else movePlayer(0, dy > 0 ? 1 : -1);
      }
    }
  }

  function entitySprite(e) {
    if (e.type === 'enemy') return Sprites.tokens[e.id];
    var def = e.type === 'resource' ? Data.RESOURCES[e.id] : Data.TRAPS[e.id];
    return def ? Sprites.tiles[def.tile] : null;
  }

  function drawMap() {
    var ctx = Core.ctx, f = run.floor, i, x, y;
    var last = run.floorIndex === CFG.floors - 1;
    var r2 = CFG.fogRadius * CFG.fogRadius;
    for (y = 0; y < f.h; y++) {
      for (x = 0; x < f.w; x++) {
        i = y * f.w + x;
        if (!f.seen[i]) continue;   // unseen stays black
        var t = f.tiles[i], spr;
        if (t === TT.WALL) spr = Sprites.tiles.wall;
        else if (t === TT.EXIT) spr = last ? Sprites.tiles.exit : Sprites.tiles.stairs;
        else spr = Sprites.tiles[FLOOR_TILES[f.decor[i] || 0]];
        G.sprite(spr, x * TILE, y * TILE, {});
      }
    }
    for (i = 0; i < f.entities.length; i++) {
      var e = f.entities[i];
      if (!f.seen[e.y * f.w + e.x]) continue;
      G.sprite(entitySprite(e), e.x * TILE, e.y * TILE, {});
    }
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (y = 0; y < f.h; y++) {
      for (x = 0; x < f.w; x++) {
        i = y * f.w + x;
        if (!f.seen[i]) continue;
        var ddx = x - run.pos.x, ddy = y - run.pos.y;
        if (ddx * ddx + ddy * ddy > r2) G.rect(x * TILE, y * TILE, TILE, TILE, PAL.ink);
      }
    }
    ctx.restore();
    var bob = Math.floor(Core.time / 0.4) % 2 ? 1 : 0;
    G.sprite(Sprites.tokens.player, run.pos.x * TILE, run.pos.y * TILE - bob, {});
  }

  function drawSidebar() {
    var p = run.player;
    G.text('Piso ' + (run.floorIndex + 1) + '/' + CFG.floors, 388, 24, { color: PAL.bone });
    G.text('PV ' + p.hp + '/' + p.maxHp, 388, 36, { color: PAL.hp });
    G.bar(388, 46, 84, 6, p.hp / p.maxHp, PAL.hp, PAL.ink);
    Sprites.drawBody(famsOf(p.limbs), 412, 88, { scale: 1, tint: tint() });
    for (var i = 0; i < Data.SLOTS.length; i++) {
      var slot = Data.SLOTS[i], inst = p.limbs[slot], y = 144 + i * 9;
      G.text(HEAT_LABEL[slot], 388, y, { color: inst ? PAL.dim : PAL.blood });
      if (inst && Data.LIMBS[inst.id]) {
        var ratio = inst.heat / Data.LIMBS[inst.id].maxHeat;
        G.bar(414, y + 3, 58, 2, ratio, heatColor(ratio), PAL.panel);
      } else {
        G.bar(414, y + 3, 58, 2, 0, PAL.blood, PAL.blood);   // stump: solid red track
      }
    }
    G.icon('ichor', 388, 200);
    G.text(String(p.ichor), 400, 200, { color: PAL.sick });
    G.icon('skull', 388, 212);
    G.text(String(run.kills), 400, 212, { color: PAL.dim });
    muteButton(456, 246);
  }

  function exploreScreen(dt) {
    G.clear(PAL.ink);
    drawMap();
    drawSidebar();
    var n = run.log.length;
    if (n > 1) G.text(clip(run.log[n - 2], 46), 4, 228, { color: PAL.dim });
    if (n > 0) G.text(clip(run.log[n - 1], 46), 4, 240, { color: PAL.text });
    G.text('Flechas/WASD o desliza · Llega a la salida', 4, 254, { color: PAL.dim });
    drawHud();
    exploreInput(dt);
  }

  // ------------------------------------------------------------------ combat

  function combatScreen() {
    Combat.draw(Core.ctx);
    drawHud();
  }

  // ----------------------------------------------------------------- harvest

  function offerPanel(offer, px) {
    var py = 64, pw = 228, cardsEnd = py + 118;
    G.panel(px, py, pw, 168, {});
    if (!offer || offer.gone) {
      G.text(offer ? 'Descartado' : '—', px + 8, py + 76, { color: PAL.dim });
      return;
    }
    var L = Data.LIMBS[offer.id], type = L.slot;
    Sprites.drawPart(L.family, type, px + 8 + (40 - PART_W[type] * 2) / 2, py + 6, { scale: 2 });
    G.wrap(clip(L.name, 21), px + 52, py + 6, 168, { color: PAL.bone });
    G.text(type === 'head' ? 'Cabeza' : type === 'torso' ? 'Torso' : type === 'arm' ? 'Brazo' : 'Pierna',
      px + 52, py + 28, { color: PAL.dim });
    if (L.hp > 0) G.text('+' + L.hp + ' PV', px + 52, py + 40, { color: PAL.sick });
    G.text('Calor máx. ' + L.maxHeat + ' · Enfría ' + L.cool, px + 8, py + 52, { color: PAL.dim });
    var cy = py + 64;
    for (var i = 0; i < L.cards.length; i++) {
      var c = L.cards[i], def = Data.CARDS[c.id];
      if (!def) continue;
      if (cy + 30 > cardsEnd) break;                 // a clipped text is at most 2 lines: 10 + 18 + 2
      G.text(clip(def.name, 13) + ' x' + c.count, px + 8, cy, { color: PAL.text });
      G.icon('bolt', px + 140, cy); G.text(String(def.cost), px + 150, cy, { color: PAL.energy });
      G.icon('flame', px + 166, cy); G.text(String(def.heat), px + 176, cy, { color: PAL.heat });
      cy += 10;
      cy += G.wrap(clip(def.text, 50), px + 12, cy, pw - 24, { color: PAL.dim, lineHeight: 9, size: 8 }) * 9 + 2;
    }

    var isSide = type === 'arm' || type === 'leg';
    var slotL = type === 'arm' ? 'armL' : 'legL', slotR = type === 'arm' ? 'armR' : 'legR';
    if (isSide) {
      G.text(clip('I:' + limbName(run.player.limbs[slotL]) + ' D:' + limbName(run.player.limbs[slotR]), 26),
        px + 8, py + 124, { color: PAL.dim });
      // short labels: "Brazo izq. (muñón)" does not fit a 104 px button
      var lab = function (slot, side) {
        return run.player.limbs[slot] ? Data.SLOT_NAMES[slot] : side + ' (muñón)';
      };
      if (btn(px + 8, py + 134, 104, 16, lab(slotL, 'Izq.'))) { graft(offer.id, slotL); offer.gone = true; }
      if (btn(px + 116, py + 134, 104, 16, lab(slotR, 'Der.'))) { graft(offer.id, slotR); offer.gone = true; }
    } else {
      G.text(clip('Actual: ' + limbName(run.player.limbs[type]), 26), px + 8, py + 124, { color: PAL.dim });
      if (btn(px + 8, py + 134, 212, 16, 'Injertar')) { graft(offer.id, type); offer.gone = true; }
    }
    if (btn(px + 8, py + 152, 212, 15, 'Descartar')) offer.gone = true;
  }

  function harvestScreen() {
    var ctx = Core.ctx, h = run.harvest, def = h.def;
    G.clear(PAL.bg);
    G.text('Cosecha: ' + def.name, 8, 8, { color: PAL.bone });
    var fams = {};
    for (var i = 0; i < Data.SLOTS.length; i++) fams[Data.SLOTS[i]] = def.family;
    Sprites.drawBody(fams, 16, 20, { scale: 1 });
    ctx.save();
    ctx.globalAlpha = 0.45;                      // dead body: darkened
    G.rect(16, 20, 40, 48, PAL.ink);
    ctx.restore();
    G.text('Arranca un miembro del cadáver.', 64, 32, { color: PAL.dim });
    G.text('Injertar repara un muñón.', 64, 44, { color: PAL.dim });

    offerPanel(h.offers[0], 8);
    offerPanel(h.offers[1], 244);
    if (UI.button(168, 240, 144, 22, 'Continuar [Enter]', { key: 'Enter' })) setState('explore');
    drawHud();
  }

  // --------------------------------------------------------- victory / death

  function victoryScreen() {
    var s = run.summary;
    G.clear(PAL.bg);
    G.text('Has escapado', 240, 24, { size: 16, align: 'center', color: PAL.bone });
    G.text('de la torre', 240, 44, { size: 16, align: 'center', color: PAL.bone });
    Sprites.drawBody(famsOf(run.player.limbs), 220, 70, {
      scale: 2, tint: tint(), bob: Math.round(Math.sin(Core.time * 3))
    });
    G.text('Tiempo restante: ' + fmtTime(s.time), 240, 176, { align: 'center', color: PAL.fire3 });
    G.text('Bajas: ' + s.kills, 240, 190, { align: 'center', color: PAL.dim });
    G.text('Icor: ' + s.ichor + ' (+' + s.bonus + ' de bonus)', 240, 204, { align: 'center', color: PAL.sick });
    Sprites.fireOverlay(0.2, Core.time);
    if (UI.button(200, 232, 80, 22, 'Volver', { key: 'Enter' })) setState('title');
  }

  function deathScreen() {
    G.clear(PAL.bg);
    G.text('Has muerto', 240, 20, { size: 16, align: 'center', color: PAL.blood });
    var reason = run.deathReason === 'time'
      ? 'El reloj marcó las seis. La torre se derrumba sobre ti.'
      : 'Tu cuerpo cae. La torre sigue ardiendo.';
    G.wrap(reason, 240, 56, 360, { color: PAL.text, lineHeight: 12, align: 'center' });
    G.wrap('Tu espíritu se transporta a una nueva mesa de disección. La torre se regenera. Conservas tus planos.',
      240, 104, 360, { color: PAL.dim, lineHeight: 12, align: 'center' });
    G.text('Bajas: ' + run.kills + ' · Icor: ' + run.player.ichor + ' · Bucles: ' + meta.loops,
      240, 184, { align: 'center', color: PAL.dim });
    Sprites.fireOverlay(0.5, Core.time);
    if (UI.button(160, 240, 160, 22, 'Nueva mesa [Enter]', { key: 'Enter' })) toTable();
  }

  // ------------------------------------------------------------------- codex

  function known(id) {
    var L = Data.LIMBS[id];
    return !!L && (L.family === 'base' || meta.blueprints.indexOf(id) >= 0);
  }

  function shortName(name) {
    var parts = String(name).split(' ');
    return clip(parts[parts.length - 1], 7);
  }

  // Two 7-glyph lines, so a name never spills into the neighbouring codex column/row.
  function cellLines(name) {
    var words = String(name).split(' ').filter(function (w) { return w !== 'de' && w !== 'del' && w !== 'la'; });
    var out = [clip(words[0] || '', 7)];
    if (words.length > 1) out.push(clip(words[words.length - 1], 7));
    return out;
  }

  function codexCell(cx, cy, family, type) {
    var ids = [];
    if (family === 'base') ids = Data.BASE_POOL[type].slice();
    else ids = [family + '_' + type];
    if (!known(ids[0])) {
      G.panel(cx + 14, cy, 34, 20, { fill: PAL.ink, border: PAL.dim });
      G.text('???', cx + 31, cy + 6, { align: 'center', color: PAL.dim });
      return;
    }
    Sprites.drawPart(family, type, cx + (62 - PART_W[type]) / 2, cy, { scale: 1 });
    if (family === 'base') {   // two variants share one sprite: both names, shortened
      G.text(shortName(Data.LIMBS[ids[0]].name), cx + 1, cy + 22, { color: PAL.text });
      G.text(shortName(Data.LIMBS[ids[1]].name), cx + 1, cy + 31, { color: PAL.text });
    } else {
      var ln = cellLines(Data.LIMBS[ids[0]].name);
      G.text(ln[0], cx + 1, cy + 22, { color: PAL.text });
      if (ln[1]) G.text(ln[1], cx + 1, cy + 31, { color: PAL.text });
    }
  }

  function codexScreen() {
    G.clear(PAL.bg);
    var total = 0, found = 0;
    for (var id in Data.LIMBS) { total++; if (known(id)) found++; }
    G.text('Planos anatómicos', 8, 6, { color: PAL.bone });
    G.text('Planos: ' + found + '/' + total, 472, 6, { align: 'right', color: PAL.sick });
    var types = ['head', 'torso', 'arm', 'leg'];
    for (var i = 0; i < Data.FAMILIES.length; i++) {
      var fam = Data.FAMILIES[i], cx = 8 + i * 66;
      G.text(clip(fam.name, 7), cx, 26, { color: PAL.brass });
      for (var r = 0; r < types.length; r++) codexCell(cx, 42 + r * 44, fam.id, types[r]);
    }
    if (UI.button(184, 240, 112, 22, 'Volver [Esc]', { key: 'Escape' })) setState('title');
  }

  // -------------------------------------------------------------------- shop

  function shopRowCosmetic(c, y) {
    var ctx = Core.ctx;
    G.panel(8, y, 464, 38, {});
    ctx.save();
    ctx.beginPath(); ctx.rect(12, y + 1, 40, 36); ctx.clip();   // the 48 px body is clipped to the row
    Sprites.drawBody(famsOf(previewLimbs), 12, y - 2, { scale: 1, tint: c.tint });
    ctx.restore();
    G.text(c.name, 58, y + 5, { color: PAL.bone });
    G.wrap(c.desc, 58, y + 17, 270, { color: PAL.dim, lineHeight: 9 });
    var owned = meta.cosmetics.indexOf(c.id) >= 0;
    if (meta.skin === c.id) {
      UI.button(336, y + 10, 136, 18, 'Equipado', { disabled: true, active: true });
    } else if (owned) {
      if (UI.button(336, y + 10, 136, 18, 'Equipar')) { meta.skin = c.id; saveMeta(); }
    } else if (UI.button(336, y + 10, 136, 18, 'Comprar (' + c.price + ')', { disabled: meta.ichor < c.price })) {
      meta.ichor -= c.price;
      meta.cosmetics.push(c.id);
      meta.skin = c.id;
      saveMeta();
      Sound.sfx('unlock');
      Core.toast('Comprado: ' + c.name);
    }
  }

  function shopRowPack(p, y) {
    G.panel(8, y, 464, 38, {});
    G.icon('lock', 28, y + 14);
    G.text(p.name, 58, y + 5, { color: PAL.bone });
    G.wrap(p.desc, 58, y + 17, 270, { color: PAL.dim, lineHeight: 9 });
    if (meta.packs.indexOf(p.id) >= 0) {
      UI.button(336, y + 10, 136, 18, 'Desbloqueado', { disabled: true, active: true });
    } else if (UI.button(336, y + 10, 136, 18, 'Desbloquear (' + p.price + ')', { disabled: meta.ichor < p.price })) {
      meta.ichor -= p.price;
      meta.packs.push(p.id);
      for (var i = 0; i < p.blueprints.length; i++) {
        if (meta.blueprints.indexOf(p.blueprints[i]) < 0) meta.blueprints.push(p.blueprints[i]);
      }
      saveMeta();
      Sound.sfx('unlock');
      Core.toast('Desbloqueado: ' + p.name);
    }
  }

  function shopScreen() {
    G.clear(PAL.bg);
    G.text('Tienda', 8, 4, { size: 16, color: PAL.bone });
    if (UI.button(366, 4, 108, 18, 'Volver [Esc]', { key: 'Escape' })) setState('title');
    G.text('Demo gratuita: sin pagos reales. El Icor se gana jugando.', 8, 26, { color: PAL.dim });
    G.icon('ichor', 8, 38);
    G.text('Icor: ' + meta.ichor, 20, 38, { color: PAL.sick });
    for (var i = 0; i < Data.COSMETICS.length; i++) shopRowCosmetic(Data.COSMETICS[i], 50 + i * 42);
    for (var j = 0; j < Data.PACKS.length; j++) shopRowPack(Data.PACKS[j], 50 + (Data.COSMETICS.length + j) * 42);
  }

  // -------------------------------------------------------------------- draw

  function draw(ctx) {
    if (state === 'title') titleScreen();
    else if (state === 'table') tableScreen();
    else if (state === 'explore') exploreScreen(frameDt);
    else if (state === 'combat') combatScreen();
    else if (state === 'harvest') harvestScreen();
    else if (state === 'victory') victoryScreen();
    else if (state === 'death') deathScreen();
    else if (state === 'codex') codexScreen();
    else if (state === 'shop') shopScreen();
  }

  // -------------------------------------------------------------------- init

  function init() {
    meta = loadMeta();
    previewLimbs = Data.newBaseBody(Core.rng(7));
    setState('title');
    Core.init({ update: update, draw: draw });
  }

  var api = {
    init: init,
    tint: tint,
    breakCheck: breakCheck,
    drawHud: drawHud,
    _debug: { startRun: startRun, moveTo: moveTo, setState: setState }
  };
  Object.defineProperty(api, 'state', {
    enumerable: true,
    get: function () { return state; },
    set: function (v) { setState(v); }
  });
  Object.defineProperty(api, 'meta', { enumerable: true, get: function () { return meta; } });
  Object.defineProperty(api, 'run', { enumerable: true, get: function () { return run; } });
  return api;
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { Game.init(); });
} else {
  Game.init();
}
