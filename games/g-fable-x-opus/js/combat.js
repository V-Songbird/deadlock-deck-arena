// Combat: turn-based card duel between the player body and one enemy (spec 5.6).
window.Combat = (function () {
  'use strict';

  var PAL = Core.PAL, T = I18N.t;

  // ------------------------------------------------------------------ layout
  var HAND_X = 8, HAND_Y = 186, CARD_W = 88, CARD_H = 78, CARD_STEP = 92, MAX_HAND = 8;
  var HAND_RIGHT = 464;                            // right edge the last card may reach
  var RAISE = 6;                                   // hovered card lifts this many pixels
  var BTN_X = 362, BTN_Y = 160, BTN_W = 110, BTN_H = 20;
  var BODY_Y = 52, BODY_W = 80, BODY_H = 96;       // 40x48 body box at scale 2
  var P_BODY_X = 32, E_BODY_X = 300;
  var HEAT_X = 136, HEAT_BAR_X = 232, HEAT_Y = 40, HEAT_STEP = 16, HEAT_W = 56;
  var LOG_Y = 150, LOG_Y2 = 160, ENERGY_Y = 172;

  // ------------------------------------------------------------------- state
  var player = null, rnd = Math.random, st = null, result = null;
  var uid = 0;
  var enemyDelay = 0, winDelay = 0, flashP = 0, flashE = 0;
  var overheated = {};                             // slots that already hissed this turn

  function sfx(name) { if (window.Sound && Sound.sfx) Sound.sfx(name); }

  function log(msg) {
    st.log.push(msg);
    while (st.log.length > 12) st.log.shift();
  }

  function limbDef(slot) {
    var inst = player.limbs[slot];
    return (inst && Data.LIMBS[inst.id]) ? Data.LIMBS[inst.id] : null;
  }

  function familyOfSlot(slot) {
    var def = limbDef(slot);
    return def ? def.family : null;
  }

  // ------------------------------------------------------------------- cards

  function makeCard(def, source, stump) {
    return { uid: ++uid, def: def, source: source, stump: !!stump };
  }

  function buildDeck() {
    var deck = [], i, j, k;
    for (i = 0; i < Data.SLOTS.length; i++) {
      var slot = Data.SLOTS[i], def = limbDef(slot);
      if (!def) { deck.push(makeCard(Data.STUMP_CARD, slot, true)); continue; }
      for (j = 0; j < def.cards.length; j++) {
        var entry = def.cards[j], cdef = Data.CARDS[entry.id];
        if (!cdef) continue;
        for (k = 0; k < entry.count; k++) deck.push(makeCard(cdef, slot, false));
      }
    }
    return deck;
  }

  function drawFromPile(n) {
    for (var i = 0; i < n; i++) {
      if (st.hand.length >= MAX_HAND) return;      // the hand row shows at most 8 cards
      if (!st.drawPile.length) {
        if (!st.discard.length) return;
        while (st.discard.length) st.drawPile.push(st.discard.pop());
        Core.shuffle(st.drawPile, rnd);
      }
      st.hand.push(st.drawPile.pop());
    }
  }

  function removeSlotCards(slot) {
    var piles = [st.hand, st.drawPile, st.discard];
    for (var p = 0; p < piles.length; p++) {
      var pile = piles[p];
      for (var i = pile.length - 1; i >= 0; i--) if (pile[i].source === slot) pile.splice(i, 1);
    }
  }

  // ------------------------------------------------------------- heat/breaks

  // Returns true when the limb in `slot` broke.
  function breakCheck(slot) {
    var inst = player.limbs[slot], def = limbDef(slot);
    if (!inst || !def) return false;
    if (inst.heat >= def.maxHeat) {
      player.limbs[slot] = null;
      removeSlotCards(slot);
      st.discard.push(makeCard(Data.STUMP_CARD, slot, true));
      log(T('¡Se rompe: {0} ({1})!', [Data.SLOT_NAMES[slot], def.name]));
      sfx('break');
      Core.shake(4, 0.4);
      return true;
    }
    if (inst.heat >= def.maxHeat * 0.75 && !overheated[slot]) {
      overheated[slot] = true;
      sfx('overheat');
    }
    return false;
  }

  function addHeat(slot, value) {
    var inst = player.limbs[slot];
    if (!inst) return false;
    inst.heat += value;
    return breakCheck(slot);
  }

  // ------------------------------------------------------------- end of life

  function checkLose() {
    if (result || player.hp > 0) return false;
    player.hp = 0;
    result = 'lose';
    log(T('Tu cuerpo se desploma.'));
    sfx('death');
    return true;
  }

  function enemyDies() {
    if (result || winDelay > 0) return;
    log(T('¡{0} cae!', st.enemy.def.name));
    sfx('death');
    Core.shake(3, 0.3);
    winDelay = 0.4;                                 // rule 3: win lands ~0.4 s later
  }

  // ---------------------------------------------------------------- effects

  function hitEnemy(value) {
    var e = st.enemy, dmg = value;
    if (e.block > 0) {
      var absorbed = Math.min(e.block, dmg);
      e.block -= absorbed;
      dmg -= absorbed;
    }
    if (dmg > 0) e.hp -= dmg;
    flashE = 0.1;
    if (value >= 8) Core.shake(2, 0.15);
  }

  function applyEffect(fx, card) {
    var e = st.enemy, v = fx.value || 0, times = fx.times || 1, i;
    switch (fx.kind) {
      case 'damage':
        for (i = 0; i < times; i++) hitEnemy(v);
        sfx('hit');
        break;
      case 'block':
        player.block += v;
        sfx('block');
        break;
      case 'heal':
        player.hp = Math.min(player.maxHp, player.hp + v);
        sfx('heal');
        break;
      case 'draw':
        drawFromPile(v);
        break;
      case 'energy':
        st.energy += v;
        break;
      case 'cool':
        var inst = player.limbs[card.source];       // stump source: no-op
        if (inst) inst.heat = Math.max(0, inst.heat - v);
        break;
      case 'coolAll':
        for (i = 0; i < Data.SLOTS.length; i++) {
          var li = player.limbs[Data.SLOTS[i]];
          if (li) li.heat = Math.max(0, li.heat - v);
        }
        break;
      case 'poison':
        e.poison += v;
        sfx('poison');
        break;
      case 'weaken':
        e.weak += v;
        break;
      case 'stun':
        e.stunned = true;
        break;
      case 'flee':
        result = 'fled';
        log(T('¡Huyes del combate!'));
        sfx('flee');
        break;
      case 'selfDamage':
        player.hp -= v;                             // unblockable
        flashP = 0.1;
        checkLose();
        break;
      default:
        break;                                      // unknown kinds are ignored
    }
  }

  // ------------------------------------------------------------ playing cards

  function play(index) {
    if (!st || result || st.busy) return false;
    var card = st.hand[index];
    if (!card || st.energy < card.def.cost) return false;

    st.energy -= card.def.cost;
    st.hand.splice(index, 1);
    log(T('Juegas {0}.', card.def.name));
    sfx('card');

    var fx = card.def.effects || [];
    for (var i = 0; i < fx.length; i++) {
      applyEffect(fx[i], card);
      if (result) break;                            // flee or death ends it at once
    }

    var broke = addHeat(card.source, card.def.heat || 0);
    // A broken limb takes the card that broke it: it never returns to the discard.
    if (!card.def.exhaust && !broke) st.discard.push(card);

    if (!result && st.enemy.hp <= 0) enemyDies();
    checkLose();
    return true;
  }

  // -------------------------------------------------------------- enemy turn

  function doIntent(it) {
    var e = st.enemy, v = it.value || 0, times = it.times || 1, i;
    if (it.kind === 'attack') {
      var weakened = e.weak > 0;
      if (weakened) e.weak--;                       // once per intent
      var dmg = weakened ? Math.floor(v / 2) : v, total = 0;
      for (i = 0; i < times; i++) {
        var rest = dmg;
        if (player.block > 0) {
          var absorbed = Math.min(player.block, rest);
          player.block -= absorbed;
          rest -= absorbed;
        }
        if (rest > 0) { player.hp -= rest; total += rest; }
      }
      flashP = 0.1;
      if (dmg >= 8) Core.shake(2, 0.15);
      if (total > 0) { sfx('hit'); log(T('{0} te golpea {1}.', [e.def.name, total])); }
      else { sfx('block'); log(T('Tu bloqueo aguanta el golpe.')); }
      checkLose();
    } else if (it.kind === 'block') {
      e.block += v;
      sfx('block');
      log(T('{0} se cubre {1}.', [e.def.name, v]));
    } else if (it.kind === 'heat') {
      var open = [];
      for (i = 0; i < Data.SLOTS.length; i++) if (player.limbs[Data.SLOTS[i]]) open.push(Data.SLOTS[i]);
      if (open.length) {
        var slot = open[Math.floor(rnd() * open.length)];
        log(T('Calor +{0} en {1}', [v, Data.SLOT_NAMES[slot]]));
        sfx('overheat');
        addHeat(slot, v);
      } else {
        log(T('No queda miembro que calentar.'));
      }
    } else if (it.kind === 'poison') {
      player.poison += v;
      sfx('poison');
      log(T('{0} te envenena {1}.', [e.def.name, v]));
    } else if (it.kind === 'heal') {
      e.hp = Math.min(e.maxHp, e.hp + v);
      sfx('heal');
      log(T('{0} se cura {1}.', [e.def.name, v]));
    }
  }

  function enemyTurn() {
    var e = st.enemy;
    e.block = 0;
    if (e.poison > 0) {
      e.hp -= e.poison;
      log(T('El veneno hace {0} a {1}.', [e.poison, e.def.name]));
      e.poison--;
      flashE = 0.1;
      if (e.hp <= 0) { enemyDies(); return; }
    }
    if (e.stunned) {
      e.stunned = false;
      log(T('{0} está aturdido.', e.def.name));
    } else if (e.def.intents && e.def.intents.length) {
      var intent = e.def.intents[e.intentIndex % e.def.intents.length];
      e.intentIndex = (e.intentIndex + 1) % e.def.intents.length;
      doIntent(intent);
    }
    if (result) return;
    if (st.enemy.hp <= 0) { enemyDies(); return; }
    enemyDelay = 0.35;                              // rule 8: show the action before control returns
  }

  function startPlayerTurn() {
    player.block = 0;
    if (player.poison > 0) {
      player.hp -= player.poison;
      log(T('El veneno te hace {0}.', player.poison));
      player.poison--;
      flashP = 0.1;
      if (checkLose()) return;
    }
    for (var i = 0; i < Data.SLOTS.length; i++) {
      var slot = Data.SLOTS[i], inst = player.limbs[slot], def = limbDef(slot);
      if (inst && def) inst.heat = Math.max(0, inst.heat - def.cool);
    }
    overheated = {};
    st.energy = Data.CONFIG.energy;
    while (st.hand.length) st.discard.push(st.hand.pop());
    drawFromPile(Data.CONFIG.handSize);
    st.turn++;
  }

  function endTurn() {
    if (!st || result || st.busy) return false;
    enemyTurn();
    return true;
  }

  // ------------------------------------------------------------------ input

  // Up to 5 cards sit side by side; a bigger hand overlaps so the row still ends at HAND_RIGHT.
  function cardStep() {
    var n = Math.min(st.hand.length, MAX_HAND);
    return n > 5 ? (HAND_RIGHT - CARD_W) / (n - 1) : CARD_STEP;
  }

  function cardX(i) { return HAND_X + i * cardStep(); }

  function hoverIndex() {
    var p = Core.input.pointer;
    if (p.x < 0) return -1;
    // Later cards are drawn on top, so hit-test from the last one backwards.
    for (var i = Math.min(st.hand.length, MAX_HAND) - 1; i >= 0; i--) {
      var x = cardX(i);
      // The raised card sticks out 6 px, so the hit box covers both positions.
      if (p.x >= x && p.x < x + CARD_W && p.y >= HAND_Y - RAISE && p.y < HAND_Y + CARD_H) return i;
    }
    return -1;
  }

  function handleInput() {
    var inp = Core.input, p = inp.pointer, i;
    for (i = 0; i < 9; i++) {
      if (inp.pressed(String(i + 1))) { play(i); inp.consume(); return; }
    }
    if (inp.pressed('e') || inp.pressed('Enter')) { endTurn(); inp.consume(); return; }
    if (!p.justDown) return;
    if (p.x >= BTN_X && p.x < BTN_X + BTN_W && p.y >= BTN_Y && p.y < BTN_Y + BTN_H) {
      sfx('click');
      endTurn();
      inp.consume();
      return;
    }
    var idx = hoverIndex();
    if (idx >= 0) { play(idx); inp.consume(); }
  }

  function update(dt) {
    if (!st) return;
    dt = dt || 0;
    if (flashP > 0) flashP -= dt;
    if (flashE > 0) flashE -= dt;
    if (result) return;
    if (winDelay > 0) {
      winDelay -= dt;
      if (winDelay <= 0) { winDelay = 0; result = 'win'; }
      return;
    }
    if (enemyDelay > 0) {
      enemyDelay -= dt;
      if (enemyDelay <= 0) { enemyDelay = 0; startPlayerTurn(); }
      return;
    }
    handleInput();
  }

  // ---------------------------------------------------------------- drawing

  function heatColor(ratio) {
    if (ratio < 0.5) return PAL.sick;
    if (ratio < 0.75) return PAL.fire3;
    return PAL.heat;
  }

  function drawBackground() {
    var g = Core.gfx;
    g.clear(PAL.bg);
    g.rect(0, 24, 480, 122, PAL.panel);                       // back wall of the lab
    for (var x = 60; x < 480; x += 120) g.rect(x, 24, 1, 122, PAL.wall);   // stone seams
    g.rect(0, 146, 480, 2, PAL.wall);                         // floor line
    g.rect(0, 148, 480, 32, PAL.floor);
    g.rect(8, 132, 26, 14, PAL.wall);                         // a crate and a shelf
    g.rect(440, 120, 32, 26, PAL.wall);
  }

  function flashBox(ctx, x, y, w, h) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    Core.gfx.rect(x, y, w, h, PAL.white);
    ctx.restore();
  }

  function intentIcon(it) {
    if (it.kind === 'heat') return 'flame';
    if (it.kind === 'heal') return 'heart';
    if (it.kind === 'block') return 'check';
    return 'skull';                                            // attack and poison
  }

  function drawIntent() {
    var e = st.enemy;
    if (!e.def.intents || !e.def.intents.length) return;
    var it = e.def.intents[e.intentIndex % e.def.intents.length];
    var v = it.value || 0, times = it.times || 1;
    Core.gfx.icon(intentIcon(it), 300, 6);
    Core.gfx.text(times > 1 ? (v + '×' + times) : String(v), 312, 6, {
      color: it.kind === 'poison' ? PAL.poison : PAL.bone
    });
  }

  function enemyTags() {
    var e = st.enemy, t = [];
    if (e.block > 0) t.push(T('Bloq {0}', e.block));
    if (e.poison > 0) t.push(T('Ven {0}', e.poison));
    if (e.weak > 0) t.push(T('Déb {0}', e.weak));
    if (e.stunned) t.push(T('Aturd.'));
    return t.join(' ');
  }

  function drawEnemy(ctx) {
    var e = st.enemy, g = Core.gfx;
    drawIntent();
    g.bar(300, 16, 76, 6, e.hp / e.maxHp, PAL.hp, PAL.ink);
    g.text(Math.max(0, e.hp) + '/' + e.maxHp, 300, 26, { color: PAL.bone });
    var tags = enemyTags();
    if (tags) g.text(tags, 476, 26, { color: PAL.dim, align: 'right' });
    g.text(e.def.name, 300, 36, { color: PAL.text });
    var fams = {};
    for (var i = 0; i < Data.SLOTS.length; i++) fams[Data.SLOTS[i]] = e.def.family;
    if (window.Sprites) Sprites.drawBody(fams, E_BODY_X, BODY_Y, { scale: 2, flip: true, bob: Math.round(Math.sin(Core.time * 2)) });
    if (flashE > 0) flashBox(ctx, E_BODY_X, BODY_Y, BODY_W, BODY_H);
  }

  function drawPlayer(ctx) {
    var g = Core.gfx;
    g.bar(8, 16, 104, 6, player.hp / player.maxHp, PAL.hp, PAL.ink);
    g.text(Math.max(0, player.hp) + '/' + player.maxHp, 8, 26, { color: PAL.bone });
    if (player.block > 0) g.text(T('Bloq {0}', player.block), 128, 26, { color: PAL.brass, align: 'right' });
    if (player.poison > 0) g.text(T('Veneno {0}', player.poison), 8, 36, { color: PAL.poison });
    var fams = {};
    for (var i = 0; i < Data.SLOTS.length; i++) fams[Data.SLOTS[i]] = familyOfSlot(Data.SLOTS[i]);
    if (window.Sprites) {
      Sprites.drawBody(fams, P_BODY_X, BODY_Y, {
        scale: 2, tint: (window.Game && Game.tint()) || null, bob: Math.round(Math.sin(Core.time * 2 + 1))
      });
    }
    if (flashP > 0) flashBox(ctx, P_BODY_X, BODY_Y, BODY_W, BODY_H);
  }

  function drawHeatBars() {
    var g = Core.gfx;
    g.text(T('Calor'), HEAT_X, 28, { color: PAL.dim });
    for (var i = 0; i < Data.SLOTS.length; i++) {
      var slot = Data.SLOTS[i], y = HEAT_Y + i * HEAT_STEP;
      var inst = player.limbs[slot], def = limbDef(slot);
      g.text(Data.SLOT_NAMES[slot], HEAT_X, y, { color: PAL.dim });
      if (!inst || !def) {
        g.text(T('muñón'), HEAT_BAR_X, y, { color: PAL.blood });
      } else {
        var ratio = inst.heat / def.maxHeat;
        g.bar(HEAT_BAR_X, y, HEAT_W, 6, ratio, heatColor(ratio), PAL.ink);
      }
    }
  }

  // 44 glyphs keep the log clear of the end-turn button at x = 362.
  function clipLog(s) { return s.length > 44 ? s.slice(0, 43) + '…' : s; }

  function drawLog() {
    var n = st.log.length;
    if (n > 1) Core.gfx.text(clipLog(st.log[n - 2]), 8, LOG_Y, { color: PAL.dim });
    if (n > 0) Core.gfx.text(clipLog(st.log[n - 1]), 8, LOG_Y2, { color: PAL.text });
  }

  function drawEnergy() {
    Core.gfx.icon('bolt', 8, ENERGY_Y);
    Core.gfx.text(st.energy + '/' + Data.CONFIG.energy, 20, ENERGY_Y, { color: PAL.energy });
  }

  function drawCard(ctx, card, x, y) {
    var g = Core.gfx, def = card.def;
    g.panel(x, y, CARD_W, CARD_H, { border: def.type === 'attack' ? PAL.blood : PAL.brass });
    if (window.Sprites) {
      Sprites.drawPart(familyOfSlot(card.source), Data.slotType(card.source),
        x + CARD_W - 18, y + CARD_H - 22, { scale: 1, tint: (window.Game && Game.tint()) || null });
    }
    g.icon('bolt', x + 2, y + 2);
    g.text(String(def.cost), x + 11, y + 2, { color: PAL.energy });
    g.icon('flame', x + 30, y + 2);
    g.text(String(def.heat), x + 39, y + 2, { color: PAL.fire1 });
    var lines = g.wrap(def.name, x + 2, y + 12, 84, { color: PAL.bone, size: 8, lineHeight: 9 });
    g.wrap(def.text, x + 2, y + 14 + lines * 9, 84, { color: PAL.text, size: 8, lineHeight: 9 });
    if (st.energy < def.cost) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      g.rect(x, y, CARD_W, CARD_H, PAL.ink);
      ctx.restore();
    }
  }

  function drawHand(ctx) {
    var hover = st.busy ? -1 : hoverIndex();
    var n = Math.min(st.hand.length, MAX_HAND);
    for (var i = 0; i < n; i++) {
      if (i !== hover) drawCard(ctx, st.hand[i], cardX(i), HAND_Y);
    }
    // The hovered card goes last so an overlapping hand still shows it whole.
    if (hover >= 0 && hover < n) drawCard(ctx, st.hand[hover], cardX(hover), HAND_Y - RAISE);
  }

  function draw(ctx) {
    if (!st) return;
    drawBackground();
    drawEnemy(ctx);
    drawPlayer(ctx);
    drawHeatBars();
    drawLog();
    drawEnergy();
    Core.ui.button(BTN_X, BTN_Y, BTN_W, BTN_H, T('Fin turno [E]'), { key: 'e', disabled: st.busy });
    drawHand(ctx);
  }

  // --------------------------------------------------------------------- api

  var api = {
    start: start,
    update: update,
    draw: draw,
    _play: play,        // internal, used by the headless simulation
    _endTurn: endTurn
  };

  Object.defineProperty(api, 'result', { enumerable: true, get: function () { return result; } });
  Object.defineProperty(api, 'state', { enumerable: true, get: function () { return st; } });

  function start(p, enemyDef, r) {
    player = p;
    rnd = r || Math.random;
    result = null;
    enemyDelay = 0; winDelay = 0; flashP = 0; flashE = 0;
    overheated = {};
    player.block = 0;
    player.poison = 0;
    if (!player.maxHp) player.maxHp = Data.maxHp(player.limbs);   // Game owns maxHp; never run with NaN
    st = {
      enemy: {
        def: enemyDef, hp: enemyDef.hp, maxHp: enemyDef.hp,
        block: 0, poison: 0, weak: 0, stunned: false, intentIndex: 0
      },
      hand: [], drawPile: [], discard: [],
      energy: Data.CONFIG.energy, turn: 1, log: []
    };
    Object.defineProperty(st, 'busy', {
      enumerable: true,
      get: function () { return winDelay > 0 || enemyDelay > 0 || result !== null; }
    });
    var deck = Core.shuffle(buildDeck(), rnd);
    for (var i = 0; i < deck.length; i++) st.drawPile.push(deck[i]);
    drawFromPile(Data.CONFIG.handSize);
    log(T('Te enfrentas a {0}.', enemyDef.name));
    if (window.Sound && Sound.music) Sound.music('combat');
    sfx('growl');
  }

  return api;
})();
