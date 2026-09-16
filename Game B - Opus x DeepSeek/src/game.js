// Deadlock Deck: El Reloj Anatómico — DD.Game (PRODUCT.md §5.8).
// The glue: run lifecycle, the real-time clock, input and persistence.
// Plain browser JavaScript on the global DD namespace: no modules, no dependencies.
window.DD = window.DD || {};

(function (DD) {
  'use strict';

  const RUN_SECONDS = 360;
  const GRAFT_SECONDS = 4;   // stitching a harvested limb on costs that much clock
  const COOL_ALL = 99;       // "a large amount" for the slab and the cool cache
  const SAVE_KEY = 'dd_save';

  // Spanish slot names for the dialogs. Code and comments stay English.
  const SLOT_ES = {
    head: 'la cabeza', torso: 'el torso', armL: 'el brazo izquierdo',
    armR: 'el brazo derecho', legL: 'la pierna izquierda', legR: 'la pierna derecha'
  };
  const MOVE_KEYS = {
    arrowup: 'n', w: 'n', arrowdown: 's', s: 's',
    arrowleft: 'w', a: 'w', arrowright: 'e', d: 'e'
  };
  const STATUS_SFX = { bleed: 'hurt', stun: 'heavy', weak: 'ui', vulnerable: 'ui' };
  const DEATH_HP = 'Tus costuras ceden y el cuerpo se desarma.';
  const DEATH_CLOCK = 'El reloj anatómico llega a 0:00 y tu carne se deshace.';

  // ------------------------------------------------------------------ state (§4)

  const state = {
    phase: 'title',
    timeLeft: RUN_SECONDS,
    runIndex: 1,
    body: null,
    tower: null,
    posId: '',
    combat: null,
    blueprints: [],
    stats: { escapes: 0, bestTimeLeft: 0, kills: 0 },
    message: ''
  };

  let hasUI = false;         // false when src/ui.js is missing or broken (see boot)
  let combatRng = null;      // the rng of the room currently being fought
  let dialogFree = false;    // the open graft dialog charges no clock
  let lastT = 0;
  let lastSig = null;
  let lastPhase = null;
  let warned = false;

  // ------------------------------------------------------------------ helpers

  const byId = (id) => document.getElementById(id);

  function note(err) {
    if (warned) return;      // one loud line, never a flood
    warned = true;
    if (window.console && console.error) console.error('[DD.Game]', err);
  }

  function sfx(name) { if (DD.Audio && DD.Audio.sfx) DD.Audio.sfx(name); }
  function shake(n) { if (DD.Render && DD.Render.shake) DD.Render.shake(n); }
  function spark(kind) { if (DD.Render && DD.Render.spark) DD.Render.spark(kind); }

  // DD.UI owns the DOM. Every call is funnelled through these so a missing or broken
  // DOM layer can never take the run down with it.
  function uiRender() { if (hasUI) { try { DD.UI.render(state); } catch (e) { note(e); } } }
  function uiMode(phase) { if (hasUI) { try { DD.UI.setMode(phase); } catch (e) { note(e); } } }
  function uiHide() { if (hasUI) { try { DD.UI.hideDialog(); } catch (e) { note(e); } } }
  function uiToast(text) { if (hasUI) { try { DD.UI.toast(text); } catch (e) { note(e); } } }
  function uiShow(cfg) {
    if (!hasUI) return false;
    try { DD.UI.showDialog(cfg); return true; } catch (e) { note(e); return false; }
  }

  function currentRoom() {
    return state.tower && state.tower.rooms ? state.tower.rooms[state.posId] || null : null;
  }

  function newSeed() { return Math.floor(Math.random() * 0xffffffff) >>> 0; }

  function runSeconds() { return (DD.DATA && DD.DATA.RUN_SECONDS) || RUN_SECONDS; }

  function limbName(limbId) {
    const limb = DD.DATA.LIMBS[limbId];
    return limb ? limb.name : String(limbId);
  }

  // 'a' / 'a y b' / 'a, b y c'
  function listEs(items) {
    if (!items.length) return '';
    if (items.length === 1) return items[0];
    return items.slice(0, -1).join(', ') + ' y ' + items[items.length - 1];
  }

  function countsDown() {
    return state.phase !== 'title' && state.phase !== 'dead' && state.phase !== 'escaped';
  }

  // ------------------------------------------------------------------ persistence

  function addBlueprint(limbId) {
    if (!limbId || !DD.DATA.LIMBS[limbId]) return;
    if (state.blueprints.indexOf(limbId) < 0) state.blueprints.push(limbId);
  }

  // file:// and private windows can throw on every localStorage call: never let that
  // break a run, the save is a bonus.
  function loadSave() {
    try {
      const raw = window.localStorage ? window.localStorage.getItem(SAVE_KEY) : null;
      if (!raw) return;
      const data = JSON.parse(raw) || {};
      (data.blueprints || []).forEach(addBlueprint);
      const stats = data.stats || {};
      state.stats.escapes = stats.escapes | 0;
      state.stats.bestTimeLeft = Number(stats.bestTimeLeft) || 0;
      state.stats.kills = stats.kills | 0;
    } catch (e) { /* play on without a save */ }
  }

  function saveGame() {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        blueprints: state.blueprints,
        stats: state.stats
      }));
    } catch (e) { /* play on without a save */ }
  }

  // ------------------------------------------------------------------ run lifecycle

  function startRun() {
    state.body = DD.Body.create(DD.DATA.BASE_BODY);
    state.tower = DD.Tower.generate(newSeed());
    state.posId = state.tower.startId;
    state.combat = null;
    state.timeLeft = runSeconds();
    state.message = 'La mesa de disección te recibe.';
    uiHide();
    if (DD.Audio && DD.Audio.startMusic) DD.Audio.startMusic();
    if (state.blueprints.length) openSlabDialog();
    else state.phase = 'explore';
  }

  // Any key or tap on the title/death/escape screens.
  function gesture() {
    if (state.phase === 'title') begin();
    else if (state.phase === 'dead' || state.phase === 'escaped') restart();
  }

  function begin() {
    if (DD.Audio && DD.Audio.init) DD.Audio.init();   // first user gesture: build the context
    if (DD.Audio && DD.Audio.startMusic) DD.Audio.startMusic();
    startRun();
  }

  function restart() {
    state.runIndex = (state.runIndex | 0) + 1;
    startRun();
  }

  function die(text) {
    if (state.phase === 'dead') return;
    state.phase = 'dead';
    state.combat = null;
    state.message = text;
    uiHide();
    sfx('death');
    if (DD.Audio && DD.Audio.stopMusic) DD.Audio.stopMusic();
    saveGame();
  }

  function checkDeath() {
    if (!countsDown()) return;
    if (state.body && state.body.hp <= 0) die(DEATH_HP);
    else if (state.timeLeft <= 0) die(DEATH_CLOCK);
  }

  function escape() {
    state.phase = 'escaped';
    state.combat = null;
    state.stats.escapes = (state.stats.escapes | 0) + 1;
    if (state.timeLeft > (state.stats.bestTimeLeft || 0)) state.stats.bestTimeLeft = state.timeLeft;
    state.message = 'Escapas con: ' + DD.Body.describe(state.body) + '.';
    uiHide();
    saveGame();
    sfx('escape');
    if (DD.Audio && DD.Audio.stopMusic) DD.Audio.stopMusic();
    uiToast(state.message);
  }

  // ------------------------------------------------------------------ movement

  function onMove(dir) {
    if (state.phase !== 'explore') return;
    const links = DD.Tower.neighbors(state.tower, state.posId);
    let next = null;
    for (let i = 0; i < links.length; i++) {
      if (links[i].dir === dir) next = links[i].id;
    }
    if (!next) { sfx('ui'); return; }
    state.posId = next;
    DD.Tower.reveal(state.tower, next);
    sfx('step');
    enterRoom(state.tower.rooms[next]);
  }

  function enterRoom(room) {
    if (!room) return;
    state.message = room.label || '';

    if (room.type === 'slab') {
      // Coming back to the table always cools the body down.
      let hot = false;
      (DD.DATA.SLOTS || []).forEach(function (key) {
        const slot = state.body.slots[key];
        if (slot && slot.heat > 0) hot = true;
      });
      DD.Body.cool(state.body, COOL_ALL);
      room.cleared = true;
      if (hot) {
        sfx('steam');
        spark('steam');
        uiToast('La mesa de disección enfría tu carne.');
      }
      return;
    }

    if (room.cleared) return;

    if (room.type === 'combat' || room.type === 'elite' || room.type === 'exit') {
      startCombat(room);
      return;
    }
    if (room.type === 'cache') { resolveCache(room); return; }
    if (room.type === 'trap') { resolveTrap(room); return; }
    room.cleared = true;   // an empty room has nothing to resolve
  }

  // ------------------------------------------------------------------ rooms

  function resolveTrap(room) {
    const loot = room.loot || {};
    room.cleared = true;
    sfx('trap');
    shake(5);
    if (loot.kind === 'hp') {
      state.body.hp = Math.max(0, state.body.hp + (loot.amount || 0));
      uiToast('¡Trampa! Pierdes ' + Math.abs(loot.amount || 0) + ' PV.');
    } else {
      state.timeLeft = Math.max(0, state.timeLeft + (loot.amount || 0));
      uiToast('¡Trampa! El reloj pierde ' + Math.abs(loot.amount || 0) + ' s.');
    }
    checkDeath();
  }

  function resolveCache(room) {
    const loot = room.loot || {};
    room.cleared = true;

    if (loot.kind === 'heal') {
      const before = state.body.hp;
      state.body.hp = Math.min(DD.Body.maxHp(state.body), state.body.hp + (loot.amount || 0));
      sfx('heal');
      spark('heal');
      uiToast('Alacena: te coses ' + (state.body.hp - before) + ' PV.');
      return;
    }

    if (loot.kind === 'cool') { coolAndRepair(); return; }

    if (loot.kind === 'blueprint') {
      const limbId = loot.limbId;
      if (!limbId || !DD.DATA.LIMBS[limbId]) { uiToast('La alacena está vacía.'); return; }
      addBlueprint(limbId);        // a discovered blueprint is kept even if not grafted
      saveGame();
      sfx('harvest');
      spark('harvest');
      state.message = 'Plano anatómico: ' + limbName(limbId);
      uiToast('Plano anatómico: ' + limbName(limbId) + '.');
      openGraftDialog([limbId], 'Plano anatómico',
        'Un injerto entero, todavía tibio. Puedes cosértelo aquí mismo.', false);
      return;
    }
  }

  function coolAndRepair() {
    DD.Body.cool(state.body, COOL_ALL);
    let fixed = '';
    (DD.DATA.SLOTS || []).forEach(function (key) {
      if (fixed) return;
      const slot = state.body.slots[key];
      if (slot && slot.broken) {
        DD.Body.graft(state.body, key, DD.DATA.BASE_BODY[key]);
        fixed = key;
      }
    });
    sfx('steam');
    spark('steam');
    uiToast(fixed
      ? 'La alacena enfría tus injertos y repara ' + SLOT_ES[fixed] + '.'
      : 'La alacena enfría todos tus injertos.');
  }

  // ------------------------------------------------------------------ combat

  function startCombat(room) {
    const enemyId = room.enemyId || (room.type === 'exit' ? DD.DATA.GUARDIAN : null);
    if (!enemyId || !DD.DATA.ENEMIES[enemyId]) { room.cleared = true; return; }
    // Seeded per room, so the same room always shuffles the same way.
    combatRng = DD.Tower.rng((state.tower.seed + room.x * 7919 + room.y * 104729) >>> 0);
    state.combat = DD.Combat.start(state.body, enemyId, combatRng);
    state.phase = 'combat';
    state.message = '';
  }

  function playCard(index) {
    if (state.phase !== 'combat' || !state.combat) return;
    const res = DD.Combat.playCard(state.combat, state.body, index);
    if (!res || !res.ok) { sfx('ui'); return; }
    sfx('card');
    handleEvents(res.events);
    afterAction();
  }

  function endTurn() {
    if (state.phase !== 'combat' || !state.combat) return;
    sfx('ui');
    const res = DD.Combat.endTurn(state.combat, state.body);
    handleEvents(res ? res.events : null);
    afterAction();
  }

  // Clock first, then the verdict: dying at 0:00 beats winning at 0:00.
  function afterAction() {
    if (state.body.hp <= 0) { die(DEATH_HP); return; }
    if (state.timeLeft <= 0) { die(DEATH_CLOCK); return; }
    if (state.combat && state.combat.over) finishCombat();
  }

  function handleEvents(events) {
    if (!events) return;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      switch (ev.type) {
        case 'damage':
          if (ev.target === 'enemy') { sfx('hit'); shake(3); spark('hit'); }
          else { sfx('hurt'); shake(4); }
          break;
        case 'block': sfx('block'); break;
        case 'heal': sfx('heal'); spark('heal'); break;
        case 'heat': sfx('steam'); break;
        case 'break': sfx('break'); shake(5); spark('break'); break;
        case 'status': sfx(STATUS_SFX[ev.name] || 'ui'); break;
        case 'time': state.timeLeft = Math.min(runSeconds(), state.timeLeft + (ev.amount || 0)); break;
        default: break;   // 'draw' is silent, 'end' is read from combat.over below
      }
    }
  }

  function finishCombat() {
    const combat = state.combat;
    const room = currentRoom();
    if (!combat || !combat.over || !room) return;
    if (combat.result !== 'win') { die(DEATH_HP); return; }

    room.cleared = true;
    state.stats.kills = (state.stats.kills | 0) + 1;
    saveGame();

    if (room.type === 'exit') { escape(); return; }
    if (!openHarvest(combat)) leaveDialog();   // no DOM layer: the run simply goes on
  }

  // ------------------------------------------------------------------ harvest

  // Two of the corpse's drops, or all of them when a `harvest` card was played.
  function harvestLimbs(combat) {
    const def = DD.DATA.ENEMIES[combat.enemy.id];
    const drops = def && def.drops ? def.drops.slice() : [];
    if (combat.harvestAll || drops.length <= 2) return drops;
    const out = [];
    for (let i = 0; i < 2 && drops.length; i++) {
      let j = Math.floor((combatRng ? combatRng() : Math.random()) * drops.length);
      if (j >= drops.length) j = drops.length - 1;
      out.push(drops.splice(j, 1)[0]);
    }
    return out;
  }

  function graftOptions(limbIds) {
    const options = [];
    const seen = {};
    limbIds.forEach(function (limbId) {
      const limb = DD.DATA.LIMBS[limbId];
      if (!limb) return;
      DD.Body.compatibleSlots(limbId).forEach(function (slot) {
        const value = 'graft|' + limbId + '|' + slot;
        if (seen[value]) return;
        seen[value] = true;
        options.push({
          value: value,
          label: 'Injertar en ' + SLOT_ES[slot],
          sub: limb.name + '. ' + (limb.desc || '')
        });
      });
    });
    options.push({
      value: 'close',
      label: 'Dejar',
      sub: 'Te lo piensas y sigues tu camino.'
    });
    return options;
  }

  function openGraftDialog(limbIds, title, body, free) {
    dialogFree = free;
    const opened = uiShow({ title: title, body: body, options: graftOptions(limbIds), cancel: 'close' });
    if (!opened) return false;
    state.phase = free ? 'slab' : 'harvest';
    return true;
  }

  // At the start of a run the slab offers one known limb for free.
  function openSlabDialog() {
    const n = state.blueprints.length;
    const body = n === 1
      ? 'Recuerdas un plano anatómico. La mesa puede cosértelo gratis antes de que salgas.'
      : 'Recuerdas ' + n + ' planos anatómicos. La mesa puede coserte uno gratis antes de que salgas.';
    if (!openGraftDialog(state.blueprints, 'Mesa de disección', body, true)) {
      state.phase = 'explore';
    }
  }

  function openHarvest(combat) {
    const limbs = harvestLimbs(combat);
    if (!limbs.length) return false;
    const body = 'Arrancas ' + listEs(limbs.map(limbName)) +
      ' del cadáver. Coserte algo cuesta ' + GRAFT_SECONDS + ' s de reloj.';
    dialogFree = false;
    if (!uiShow({
      title: 'Cosecha: ' + combat.enemy.name,
      body: body,
      options: graftOptions(limbs),
      cancel: 'close'
    })) return false;
    state.phase = 'harvest';
    return true;
  }

  function onDialogPick(value) {
    let ok = false;
    if (typeof value === 'string' && value.indexOf('graft|') === 0) {
      const parts = value.split('|');
      ok = doGraft(parts[1], parts[2], dialogFree);
    }
    if (!ok) sfx('ui');
    leaveDialog();
  }

  function doGraft(limbId, slotKey, free) {
    const res = DD.Body.graft(state.body, slotKey, limbId);
    if (!res || res.ok === false) return false;
    addBlueprint(limbId);
    if (!free) state.timeLeft = Math.max(0, state.timeLeft - GRAFT_SECONDS);
    saveGame();
    sfx('harvest');
    spark('harvest');
    const text = 'Injertas ' + limbName(limbId) + ' en ' + SLOT_ES[slotKey] +
      (free ? '. La mesa no te cobra reloj.' : '. -' + GRAFT_SECONDS + ' s de reloj.');
    state.message = text;
    uiToast(text);
    checkDeath();
    return true;
  }

  // A dialog is always closed by leaving it: back to walking the halls - unless the clock
  // ran out while it was open, in which case the death screen keeps the run.
  function leaveDialog() {
    uiHide();
    state.combat = null;
    if (state.phase === 'harvest' || state.phase === 'slab') state.phase = 'explore';
  }

  // ------------------------------------------------------------------ UI refresh

  // Everything DD.UI shows, packed into one string. The clock is part of it, so the HUD
  // is repainted at least once per second and otherwise only when something moved.
  function signature() {
    let s = state.phase + '|' + state.posId + '|' + state.runIndex + '|' +
      Math.ceil(state.timeLeft) + '|' + state.message;
    if (state.body) {
      s += '|' + state.body.hp + '/' + state.body.maxHp;
      (DD.DATA.SLOTS || []).forEach(function (key) {
        const slot = state.body.slots[key] || {};
        s += '|' + (slot.limbId || '-') + ',' + (slot.heat || 0) + ',' + (slot.broken ? 'B' : '');
      });
    }
    const c = state.combat;
    if (c) {
      s += '|' + c.turn + ',' + c.energy + ',' + c.hand.length + ',' + c.discard.length +
        ',' + c.enemy.hp + ',' + c.enemy.block + ',' + c.block + ',' + (c.over ? 'x' : 'o') +
        ',' + (c.log[c.log.length - 1] || '');
    }
    return s;
  }

  // ------------------------------------------------------------------ main loop

  function tick(now) {
    // The six minutes are real elapsed seconds (§1, §4), so the clock takes the raw
    // wall-clock delta: requestAnimationFrame stops in a hidden tab, and a stalled frame
    // must still spend its time. Only the visuals are clamped, and DD.Render.draw clamps
    // its own delta, so nothing on screen jumps after a long stall.
    const raw = lastT ? Math.max(0, now - lastT) : 0;
    lastT = now;

    if (countsDown()) {
      state.timeLeft = Math.max(0, state.timeLeft - raw);
      checkDeath();
    }
    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      uiMode(state.phase);
    }
    const sig = signature();
    if (sig !== lastSig) {
      lastSig = sig;
      uiRender();
    }
    if (DD.Render && DD.Render.draw) DD.Render.draw(state);
    if (DD.Audio && DD.Audio.setTension) DD.Audio.setTension(1 - state.timeLeft / runSeconds());
  }

  function frame(ts) {
    window.requestAnimationFrame(frame);
    try { tick((typeof ts === 'number' ? ts : Date.now()) / 1000); } catch (e) { note(e); }
  }

  // ------------------------------------------------------------------ input

  function toggleSound() {
    if (!DD.Audio || !DD.Audio.setEnabled) return;
    DD.Audio.setEnabled(!DD.Audio.isEnabled());
    uiToast(DD.Audio.isEnabled() ? 'Sonido activado.' : 'Sonido silenciado.');
    lastSig = null;   // repaint the sound button right away
  }

  function primary() {
    if (state.phase === 'combat') endTurn();
    else gesture();
  }

  // DD.UI takes the keys that need a DOM element behind them (arrows, 1-9, Space,
  // M) while its own handler is installed. game.js adds only what nobody else does:
  // the any-key gesture on the title, death and escape screens - plus the whole
  // keyboard again if src/ui.js is missing, so the game stays playable without it.
  function onKey(ev) {
    const key = ev.key;
    if (!key) return;
    const low = key.toLowerCase();
    const screen = state.phase === 'title' || state.phase === 'dead' || state.phase === 'escaped';

    if (screen) {
      if (hasUI && (key === ' ' || key === 'Enter' || key === 'Spacebar' || low === 'm')) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      gesture();
      return;
    }
    if (hasUI) return;

    if (low === 'm') { toggleSound(); return; }
    if (state.phase === 'combat' && state.combat) {
      if (key >= '1' && key <= '9') { playCard(Number(key) - 1); return; }
      if (key === ' ' || key === 'Enter') { ev.preventDefault(); endTurn(); }
      return;
    }
    if (state.phase === 'explore') {
      const dir = MOVE_KEYS[low];
      if (dir) { ev.preventDefault(); onMove(dir); }
    }
  }

  function onTap(ev) {
    if (state.phase !== 'title' && state.phase !== 'dead' && state.phase !== 'escaped') return;
    const t = ev.target;
    if (t && t.closest && t.closest('button')) return;   // the sound button stays a sound button
    gesture();
  }

  // Without DD.UI the cards and the dialogs have no buttons, but walking, ending a turn
  // and muting still work: the fixed ids of index.html §7 are wired by hand.
  function wireFallbackControls() {
    ['n', 's', 'e', 'w'].forEach(function (dir) {
      const btn = byId('btn-' + dir);
      if (btn) btn.addEventListener('click', function () { onMove(dir); });
    });
    const end = byId('btn-end-turn');
    if (end) end.addEventListener('click', endTurn);
    const sound = byId('btn-sound');
    if (sound) sound.addEventListener('click', toggleSound);
  }

  const HANDLERS = {
    onPlayCard: playCard,
    onEndTurn: endTurn,
    onMove: onMove,
    onToggleSound: toggleSound,
    onDialogPick: onDialogPick,
    onPrimary: primary
  };

  // ------------------------------------------------------------------ boot

  function boot() {
    hasUI = !!(DD.UI && DD.UI.init && DD.UI.render && DD.UI.showDialog &&
      DD.UI.hideDialog && DD.UI.toast && DD.UI.setMode);

    loadSave();
    // A body and a tower exist from the first frame on, so the title screen can never
    // render against a half-built state.
    state.body = DD.Body.create(DD.DATA.BASE_BODY);
    state.tower = DD.Tower.generate(newSeed());
    state.posId = state.tower.startId;
    state.phase = 'title';
    state.timeLeft = runSeconds();

    if (DD.Render && DD.Render.init) DD.Render.init(byId('scene'));
    if (hasUI) {
      try { DD.UI.init(HANDLERS); } catch (e) { note(e); hasUI = false; }
    }
    if (!hasUI) wireFallbackControls();

    // First paint during boot, not on the first animation frame: the HUD must never show
    // a placeholder clock, and the anatomy panel is already filled when the page settles.
    lastPhase = state.phase;
    lastSig = signature();
    uiMode(state.phase);
    uiRender();

    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onTap);
    window.requestAnimationFrame(frame);
  }

  DD.Game = { boot: boot, state: state };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.DD);
