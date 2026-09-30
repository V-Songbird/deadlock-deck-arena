// Scene 'combat': fast turn-based card combat against one enemy (architecture sections 3.3, 3.4, 5.5).
(function () {
  window.DD = window.DD || {};

  var W = 384;
  var EX = 256, EY = 44;                                  // enemy sprite center x, top y (drawn at x2 = 64x64)
  var BODY = { cx: 94, bottom: 138, scale: 2 };           // player paper-doll
  var PX = 94, PY = 76;                                   // origin of player floating numbers
  var GAUGE = { x: 4, y: 24, w: 44, h: 18, gap: 19 };     // limb gauge column
  var HAND = { x: 4, y: 150, w: 288, cw: 56, ch: 64, raise: 8 };  // cards end at x <= 292
  var BTN = { x: 296, y: 176, w: 84, h: 22 };                      // UI.drawButton fits labels to w - 12 (71 px needed)
  var MAX_HAND = 10;
  var FLOAT_LIFE = 1.0, LUNGE = 0.5, BANNER = 0.8;
  var TURN_STATUSES = ['weak', 'vulnerable', 'stun'];
  var INTENT_ICON = { attack: 'sword', defend: 'shield', buff: 'strength', debuff: 'weak', heat: 'flame' };
  var INTENT_COLOR = { attack: 'blood2', defend: 'ice', heat: 'flame' };

  var S = null;   // combat state; null when the scene is not active

  // ---------- helpers ----------

  function limbs() { return DD.Core.run.player.limbs; }
  function alive() { return !!S && !!DD.Core.run && DD.Core.run.player.hp > 0; }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function blink(rate) { return Math.floor(S.t * rate) % 2 === 0; }

  function calcDamage(base, attacker, defender) {
    var d = (base + (attacker.strength || 0)) * (attacker.weak > 0 ? 0.75 : 1) * (defender.vulnerable > 0 ? 1.5 : 1);
    return Math.max(0, Math.floor(d));
  }

  function addFloat(text, x, y, color, scale) {
    scale = scale || 1;
    var stacked = S.floats.filter(function (f) {
      return f.t < 0.3 && Math.abs(f.ox - x) < 40 && Math.abs(f.oy - y) < 20;
    }).length;
    var half = DD.Art.textWidth(text, scale) / 2;
    S.floats.push({
      text: text, color: color, scale: scale, t: 0, ox: x, oy: y,
      x: Math.round(Math.max(half + 2, Math.min(W - half - 2, x))),
      y: y - (stacked % 4) * 9
    });
  }

  function anchorCenter(slot) {
    var a = DD.Art.bodySlotAnchors(BODY.cx, BODY.bottom, BODY.scale)[slot];
    return { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  }

  function tickStatuses(st) {
    TURN_STATUSES.forEach(function (k) { if (st[k] > 0) st[k]--; });
  }

  function isHot(e) {
    var limb = limbs()[e.slot], card = DD.Data.CARDS[e.card];
    return !!limb && card.heat > 0 && limb.heat + card.heat > DD.Data.LIMBS[limb.bp].heatMax;
  }

  function selectedEntry() {
    return S.phase === 'player' && S.sel < S.hand.length ? S.hand[S.sel] : null;
  }

  // ---------- state ----------

  function enter(params) {
    var Core = DD.Core, def = DD.Data.ENEMIES[params.enemyId];
    Core.coolLimbs(Infinity);
    Core.run.player.block = 0;
    S = {
      enemyId: params.enemyId, def: def, onDone: params.onDone,
      rng: Core.rng((Math.random() * 1e9) | 0),
      ehp: def.hp, emax: def.hp, eblock: 0, est: {}, pst: {},
      moveIdx: 0, move: null,
      draw: Core.buildDeck().slice(), discard: [], hand: [],
      energy: 0, maxEnergy: 0, sel: 0,
      phase: 'intro', timer: BANNER, queue: [], wait: 0,
      t: 0, floats: [], pulse: {}, eFlash: 0, pFlash: 0, pileFx: 0, lungeT: -1
    };
    S.rng.shuffle(S.draw);
    pickMove();
    DD.Audio.music(def.kind === 'boss' ? 'boss' : 'combat');
    DD.Audio.sfx('growl');
  }

  function exit() { S = null; }

  function pickMove() {
    var moves = S.def.moves;
    if (S.def.pattern === 'random') S.move = S.rng.pick(moves);
    else S.move = moves[S.moveIdx++ % moves.length];
  }

  function drawCards(n) {
    var drew = 0;
    while (drew < n && S.hand.length < MAX_HAND) {
      if (!S.draw.length) {
        if (!S.discard.length) break;
        S.rng.shuffle(S.discard);
        S.draw = S.discard;
        S.discard = [];
      }
      S.hand.push(S.draw.pop());
      drew++;
    }
    if (drew) DD.Audio.sfx('draw');
  }

  // ---------- player side ----------

  function startPlayerTurn() {
    var stats = DD.Core.getStats();
    if (S.pst.burn > 0) {
      var n = S.pst.burn;
      S.pst.burn--;
      DD.Audio.sfx('burn');
      if (!hurtPlayer(n, true)) return;
      heatSlot(DD.Core.randomLimbSlot(), 1);
    }
    DD.Core.run.player.block = stats.startBlock || 0;
    S.energy = S.maxEnergy = stats.energy;
    drawCards(stats.draw);
    S.sel = 0;
    S.phase = 'player';
  }

  function playCard(i) {
    var e = S.hand[i], card = DD.Data.CARDS[e.card];
    if (card.cost > S.energy) {
      DD.Audio.sfx('error');
      addFloat('SIN ENERGÍA', 160, 112, 'blood2');
      return;
    }
    S.energy -= card.cost;
    S.hand.splice(i, 1);
    DD.Audio.sfx('card');
    var hadLimb = !!limbs()[e.slot];
    for (var k = 0; k < card.effects.length; k++) {
      applyEffect(card.effects[k], e.slot);
      if (!alive() || S.ehp <= 0) break;
    }
    if (!alive()) return;
    if (card.heat > 0) heatSlot(e.slot, card.heat);
    if (!hadLimb || limbs()[e.slot]) S.discard.push(e);   // a card of a limb that just broke leaves the combat
    S.sel = Math.min(i, S.hand.length);
    if (S.ehp <= 0) win();
  }

  function applyEffect(eff, slot) {
    var Core = DD.Core, v = eff.v || 0;
    switch (eff.k) {
      case 'damage':
        for (var h = 0; h < (eff.hits || 1) && S.ehp > 0; h++) hitEnemy(v);
        break;
      case 'block':
        Core.run.player.block += v;
        DD.Audio.sfx('block');
        addFloat('+' + v, PX, PY, 'ice');
        break;
      case 'heal':
        Core.healPlayer(v);
        DD.Audio.sfx('heal');
        addFloat('+' + v, PX, PY, 'verdi2');
        break;
      case 'draw':
        drawCards(v);
        break;
      case 'energy':
        S.energy += v;
        DD.Audio.sfx('buff');
        addFloat('+' + v + ' ENERGÍA', 160, 112, 'flame2');
        break;
      case 'status':
        applyStatus(eff.target === 'self' ? 'player' : 'enemy', eff.status, v);
        break;
      case 'cool':
        if (eff.scope === 'all') Core.coolLimbs(v);
        else if (limbs()[slot]) Core.coolLimbs(v, slot);
        DD.Audio.sfx('buff');
        addFloat('-' + v + ' CALOR', PX, PY, 'ice');
        break;
      case 'repair':
        if (eff.scope === 'all') Core.repairLimbs(v);
        else if (limbs()[slot]) Core.repairLimbs(v, slot);
        DD.Audio.sfx('heal');
        addFloat('+' + v + ' INTEGRIDAD', PX, PY, 'brass2');
        break;
      case 'selfdamage':
        hurtPlayer(v, true);
        break;
    }
  }

  function hitEnemy(base) {
    var dmg = calcDamage(base, S.pst, S.est);
    var absorbed = Math.min(S.eblock, dmg), lost = dmg - absorbed, big = lost >= 10;
    S.eblock -= absorbed;
    S.ehp = Math.max(0, S.ehp - lost);
    S.eFlash = 0.15;
    DD.Audio.sfx(big ? 'hit_big' : (lost > 0 ? 'hit' : 'block'));
    if (big) DD.Core.shake(3, 0.2);
    addFloat(lost > 0 ? '-' + lost : 'BLOQUEADO', EX, EY + 24, lost > 0 ? 'blood2' : 'ice', big ? 2 : 1);
  }

  // Returns false when the player died (the run has ended and S is gone).
  function hurtPlayer(n, ignoreBlock) {
    var lost = DD.Core.damagePlayer(n, ignoreBlock);
    if (!alive()) return false;
    if (lost > 0) {
      S.pFlash = 0.25;
      DD.Audio.sfx('player_hurt');
      if (lost >= 8) DD.Core.shake(4, 0.25);
      addFloat('-' + lost, PX, PY, 'blood2', lost >= 8 ? 2 : 1);
    } else {
      DD.Audio.sfx('block');
      addFloat('BLOQUEADO', PX, PY, 'ice');
    }
    return true;
  }

  function applyStatus(who, k, v) {
    var st = who === 'enemy' ? S.est : S.pst, good = k === 'strength';
    st[k] = (st[k] || 0) + v;
    DD.Audio.sfx(k === 'burn' ? 'burn' : (good ? 'buff' : 'debuff'));
    addFloat(DD.Data.STATUS[k].name + ' ' + v,
      who === 'enemy' ? EX : PX, who === 'enemy' ? EY + 40 : PY + 12,
      good ? 'brass2' : (k === 'burn' ? 'flame' : 'acid'));
  }

  // Thermal rule 3.3 through Core, plus feedback and deck surgery on a break.
  function heatSlot(slot, n) {
    if (!slot || n <= 0 || !limbs()[slot]) return;
    var res = DD.Core.heatLimb(slot, n), a = anchorCenter(slot);
    if (res.overheated) {
      S.pulse[slot] = 1;
      DD.Core.shake(2, 0.15);
      addFloat('¡SOBRECALENTADA!' + (res.wear ? ' -' + res.wear : ''), a.x, a.y, 'flame');
    }
    if (res.broken) {
      if (limbs()[slot]) DD.Core.breakLimb(slot);
      onBreak(slot, a);
    }
  }

  function onBreak(slot, a) {
    var keep = function (e) { return e.slot !== slot; };
    S.hand = S.hand.filter(keep);
    S.draw = S.draw.filter(keep);
    S.discard = S.discard.filter(keep);
    var stump = { card: DD.Data.STUMP_CARD[DD.Data.SLOT_TYPE[slot]], slot: slot };
    S.discard.splice(S.rng.int(0, S.discard.length), 0, stump);
    S.sel = Math.min(S.sel, S.hand.length);
    S.pulse[slot] = 1.2;
    S.pileFx = 1.2;
    DD.Core.shake(4, 0.3);
    addFloat('¡SE ROMPIÓ!', a.x, a.y + 10, 'blood2', 2);
    addFloat('+MUÑÓN', 336, 150, 'parch');
  }

  function endTurn() {
    var stats = DD.Core.getStats(), L = limbs();
    DD.Audio.sfx('turn_end');
    DD.Data.SLOTS.forEach(function (slot) {
      if (L[slot]) DD.Core.coolLimbs(DD.Data.LIMBS[L[slot].bp].cool + stats.coolBonus, slot);
    });
    S.discard = S.discard.concat(S.hand);
    S.hand = [];
    tickStatuses(S.pst);
    S.phase = 'enemy';
    S.wait = 0.1;
    S.queue = [enemyStart, enemyWindup, enemyImpact, enemyEnd];
  }

  function win() {
    var run = DD.Core.run;
    S.phase = 'win';
    S.timer = BANNER;
    S.queue = [];
    S.eFlash = 0.3;
    DD.Audio.sfx('enemy_die');
    run.kills++;
    run.essence += S.def.essence || 0;
  }

  function finish() {
    var Core = DD.Core, id = S.enemyId, onDone = S.onDone, essence = S.def.essence || 0;
    Core.coolLimbs(Infinity);
    Core.run.player.block = 0;
    var drops = Core.rollDrops(id);
    Core.pop();
    if (onDone) onDone({ won: true, enemyId: id, drops: drops, essence: essence });
  }

  // ---------- enemy turn (queued steps; each returns the delay before the next) ----------

  function runQueue(dt) {
    S.wait -= dt;
    while (S && S.wait <= 0 && S.queue.length) {
      var d = S.queue.shift()();
      if (!S) return;
      S.wait += d;
    }
  }

  function enemyStart() {
    S.eblock = 0;
    if (!(S.est.burn > 0)) return 0;
    var n = S.est.burn;
    S.est.burn--;
    S.ehp = Math.max(0, S.ehp - n);
    S.eFlash = 0.15;
    DD.Audio.sfx('burn');
    addFloat('-' + n, EX, EY + 24, 'flame');
    if (S.ehp <= 0) { win(); return 0; }
    return 0.3;
  }

  function enemyWindup() {
    if (S.est.stun > 0) {
      addFloat(DD.Data.STATUS.stun.name, EX, EY + 24, 'ice');
      return 0.35;
    }
    S.lungeT = 0;
    return 0.25;
  }

  function enemyImpact() {
    if (S.est.stun > 0) return 0;
    var m = S.move;
    if (m.dmg) {
      DD.Audio.sfx('enemy_attack');
      for (var i = 0; i < (m.hits || 1); i++) {
        if (!hurtPlayer(calcDamage(m.dmg, S.est, S.pst), false)) return 0;
      }
    }
    if (m.block) {
      S.eblock += m.block;
      DD.Audio.sfx('block');
      addFloat('+' + m.block, EX, EY + 24, 'ice');
    }
    if (m.status) applyStatus(m.status.target === 'self' ? 'enemy' : 'player', m.status.status, m.status.v);
    if (m.heat) heatSlot(DD.Core.randomLimbSlot(), m.heat);
    return 0.3;
  }

  function enemyEnd() {
    tickStatuses(S.est);
    pickMove();
    startPlayerTurn();
    return 0;
  }

  // ---------- update ----------

  function updateFx(dt) {
    S.floats.forEach(function (f) { f.t += dt; });
    S.floats = S.floats.filter(function (f) { return f.t < FLOAT_LIFE; });
    S.eFlash -= dt;
    S.pFlash -= dt;
    S.pileFx -= dt;
    for (var k in S.pulse) S.pulse[k] -= dt;
    if (S.lungeT >= 0) {
      S.lungeT += dt;
      if (S.lungeT > LUNGE) S.lungeT = -1;
    }
  }

  function handRects() {
    var n = S.hand.length, rects = [];
    var step = n > 1 ? Math.min(HAND.cw + 2, Math.floor((HAND.w - HAND.cw) / (n - 1))) : 0;
    var x0 = HAND.x + Math.floor((HAND.w - HAND.cw - step * (n - 1)) / 2);
    for (var i = 0; i < n; i++) {
      var up = S.phase === 'player' && i === S.sel ? HAND.raise : 0;
      rects.push({ x: x0 + i * step, y: HAND.y - up, w: HAND.cw, h: HAND.ch });
    }
    return rects;
  }

  // -> card index, S.hand.length for the end-turn button, or -1
  function hitTest(x, y) {
    var rects = handRects();
    var inside = function (r) { return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; };
    if (S.sel < rects.length && inside(rects[S.sel])) return S.sel;   // selected card is drawn on top
    for (var i = rects.length - 1; i >= 0; i--) if (inside(rects[i])) return i;
    return inside(BTN) ? S.hand.length : -1;
  }

  function playerInput(input, ptr) {
    var n = S.hand.length + 1, prev = S.sel;
    if (input.repeat('left')) S.sel = (S.sel + n - 1) % n;
    if (input.repeat('right')) S.sel = (S.sel + 1) % n;
    if (S.sel !== prev) DD.Audio.sfx('click');
    if (ptr.pressed) {
      var hit = hitTest(ptr.x, ptr.y);
      if (hit < 0) return;
      S.sel = hit;
    } else if (!input.pressed('confirm')) {
      return;
    }
    if (S.sel === S.hand.length) endTurn();
    else playCard(S.sel);
  }

  function update(dt) {
    if (!S || !DD.Core.run) return;
    S.t += dt;
    updateFx(dt);
    var input = DD.Core.input, ptr = DD.Core.pointer, skip = input.pressed('confirm') || ptr.pressed;
    if (S.phase === 'intro') {
      S.timer -= dt;
      if (S.timer <= 0 || skip) startPlayerTurn();
    } else if (S.phase === 'win') {
      S.timer -= dt;
      if (S.timer <= 0 || (S.timer < BANNER - 0.3 && skip)) finish();
    } else if (S.phase === 'enemy') {
      runQueue(dt);
    } else {
      playerInput(input, ptr);
    }
  }

  // ---------- draw ----------

  function frame(ctx, x, y, w, h, color) {
    ctx.strokeStyle = DD.Art.PAL[color] || color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function band(ctx, y, h) {
    ctx.fillStyle = 'rgba(13,10,18,0.82)';
    ctx.fillRect(0, y, W, h);
    ctx.fillStyle = DD.Art.PAL.brass;
    ctx.fillRect(0, y, W, 1);
    ctx.fillRect(0, y + h - 1, W, 1);
  }

  function drawStatuses(ctx, st, x, y, center) {
    var A = DD.Art;
    var keys = Object.keys(DD.Data.STATUS).filter(function (k) { return st[k] > 0; });
    var width = keys.reduce(function (s, k) { return s + 12 + A.textWidth(String(st[k]), 1); }, 0);
    if (center) x -= Math.round(width / 2);
    keys.forEach(function (k) {
      A.icon(ctx, DD.Data.STATUS[k].icon, x, y);
      A.text(ctx, String(st[k]), x + 9, y, 'bone', 1, 'left', 'ink');
      x += 12 + A.textWidth(String(st[k]), 1);
    });
  }

  function lungeOffset() {
    if (S.lungeT < 0) return 0;
    var p = S.lungeT / LUNGE;
    return p < 0.35 ? (p / 0.35) * 5 : -Math.sin(((p - 0.35) / 0.65) * Math.PI) * 20;
  }

  function drawPlayer(ctx) {
    var A = DD.Art, L = limbs(), sel = selectedEntry(), selSlot = sel ? sel.slot : null;
    var hotSlots = {};
    S.hand.forEach(function (e) { if (isHot(e)) hotSlots[e.slot] = true; });
    A.drawBody(ctx, BODY.cx, BODY.bottom, L, { scale: BODY.scale, t: S.t, hurt: clamp01(S.pFlash / 0.25), highlight: selSlot });
    var anchors = A.bodySlotAnchors(BODY.cx, BODY.bottom, BODY.scale);
    DD.Data.SLOTS.forEach(function (slot, i) {
      var y = GAUGE.y + i * GAUGE.gap, a = anchors[slot], pulse = S.pulse[slot] || 0;
      DD.UI.drawLimbGauge(ctx, slot, L[slot], GAUGE.x, y, GAUGE.w, GAUGE.h);
      if (pulse > 0) {
        ctx.globalAlpha = clamp01(pulse) * (0.4 + 0.3 * Math.sin(S.t * 25));
        ctx.fillStyle = A.PAL.blood2;
        ctx.fillRect(a.x, a.y, a.w, a.h);
        ctx.globalAlpha = 1;
        if (blink(10)) frame(ctx, GAUGE.x - 1, y - 1, GAUGE.w + 2, GAUGE.h + 2, 'blood2');
      } else if (slot === selSlot) {
        var hot = hotSlots[slot];
        frame(ctx, GAUGE.x - 1, y - 1, GAUGE.w + 2, GAUGE.h + 2, hot ? (blink(6) ? 'flame' : 'blood2') : 'brass2');
      }
      if (hotSlots[slot] && blink(4)) A.icon(ctx, 'flame', GAUGE.x + GAUGE.w + 2, y + 5);
    });
  }

  function intentNumber(m) {
    if (m.intent === 'attack' && m.dmg) {
      var d = calcDamage(m.dmg, S.est, S.pst);
      return m.hits > 1 ? d + 'x' + m.hits : String(d);
    }
    if (m.intent === 'defend' && m.block) return String(m.block);
    if (m.intent === 'heat' && m.heat) return String(m.heat);
    return '';
  }

  function drawIntent(ctx) {
    var A = DD.Art, m = S.move, stunned = S.est.stun > 0;
    var icon = stunned ? 'stun' : (INTENT_ICON[m.intent] || 'sword');
    var num = stunned ? '' : intentNumber(m);
    var w = 16 + (num ? 2 + A.textWidth(num, 2) : 0), x = EX - Math.round(w / 2);
    var bob = Math.round(Math.sin(S.t * 5));
    A.icon(ctx, icon, x, 26 + bob, 2);
    if (num) A.text(ctx, num, x + 18, 27 + bob, INTENT_COLOR[m.intent] || 'bone', 2, 'left', 'ink');
    var desc = stunned ? DD.Data.STATUS.stun.name : DD.Data.describeMove(m);
    A.wrap(desc, 80, 1).forEach(function (ln, i) {
      A.text(ctx, ln, EX + 38, 50 + i * 9, 'parch', 1, 'left', 'ink');
    });
  }

  function drawEnemy(ctx) {
    var A = DD.Art, spr = A.enemySprite(S.enemyId, 'big');
    var x = EX - 32 + Math.round(lungeOffset()), y = EY + Math.round(Math.sin(S.t * 3) * 2);
    var fade = S.phase === 'win' ? clamp01(S.timer / BANNER) : 1;
    ctx.globalAlpha = fade;
    ctx.drawImage(spr, x, y, 64, 64);
    if (S.eFlash > 0) {
      ctx.globalAlpha = clamp01(S.eFlash / 0.15) * fade;
      ctx.drawImage(A.silhouetteOf(spr, '#ffffff'), x, y, 64, 64);
    }
    if (S.lungeT >= 0 && S.lungeT < 0.15) {
      ctx.globalAlpha = 0.6;
      ctx.drawImage(A.silhouetteOf(spr, A.PAL.blood2), x, y, 64, 64);
    }
    ctx.globalAlpha = 1;
    A.text(ctx, S.def.name, EX, 18, 'bone', 1, 'center', 'ink');
    if (S.phase !== 'win') drawIntent(ctx);
    DD.UI.drawBar(ctx, EX - 36, 112, 72, 7, S.ehp / S.emax, 'blood2');
    A.text(ctx, S.ehp + '/' + S.emax, EX + 40, 112, 'bone', 1, 'left', 'ink');
    if (S.eblock > 0) {
      A.icon(ctx, 'shield', EX - 46, 112);
      A.text(ctx, String(S.eblock), EX - 48, 112, 'ice', 1, 'right', 'ink');
    }
    drawStatuses(ctx, S.est, EX, 123, true);
  }

  function drawTopBar(ctx) {
    var A = DD.Art, p = DD.Core.run.player;
    A.icon(ctx, 'heart', 4, 4);
    DD.UI.drawBar(ctx, 14, 4, 64, 7, p.hp / p.maxHp, 'blood2');
    A.text(ctx, p.hp + '/' + p.maxHp, 82, 4, 'bone', 1, 'left', 'ink');
    if (p.block > 0) {
      A.icon(ctx, 'shield', 116, 4);
      A.text(ctx, String(p.block), 126, 4, 'ice', 1, 'left', 'ink');
    }
    drawStatuses(ctx, S.pst, 4, 14, false);
    DD.UI.drawHud(ctx, { clock: true, hp: false, limbs: false, essence: false, floor: false });
  }

  function drawSide(ctx) {
    var A = DD.Art, playing = S.phase === 'player';
    A.icon(ctx, 'bolt', 132, 122, 2);
    A.text(ctx, S.energy + '/' + S.maxEnergy, 150, 124, S.energy > 0 ? 'flame2' : 'mist', 2, 'left', 'ink');
    A.icon(ctx, 'cards', BTN.x + 2, 154);
    A.text(ctx, 'MAZO ' + S.draw.length, BTN.x + 12, 154, 'parch', 1, 'left', 'ink');
    A.text(ctx, 'DESCARTE ' + S.discard.length, BTN.x + 2, 165, S.pileFx > 0 && blink(8) ? 'flame2' : 'parch', 1, 'left', 'ink');
    DD.UI.drawButton(ctx, 'FIN DE TURNO', BTN.x, BTN.y, BTN.w, BTN.h,
      { selected: playing && S.sel === S.hand.length, disabled: !playing, pressed: false });
  }

  function drawHand(ctx) {
    var rects = handRects(), L = limbs(), playing = S.phase === 'player';
    var order = S.hand.map(function (e, i) { return i; }).filter(function (i) { return i !== S.sel; });
    if (S.sel < S.hand.length) order.push(S.sel);   // selected card on top
    order.forEach(function (i) {
      var e = S.hand[i], card = DD.Data.CARDS[e.card], limb = L[e.slot], r = rects[i];
      DD.UI.drawCard(ctx, card, r.x, r.y, r.w, r.h, {
        selected: playing && i === S.sel,
        disabled: !playing || card.cost > S.energy,
        limbHeat: limb ? limb.heat : 0,
        limbHeatMax: limb ? DD.Data.LIMBS[limb.bp].heatMax : 0,
        slot: e.slot,
        hot: isHot(e)
      });
    });
  }

  function drawFloats(ctx) {
    S.floats.forEach(function (f) {
      ctx.globalAlpha = clamp01((FLOAT_LIFE - f.t) / 0.3);
      DD.Art.text(ctx, f.text, f.x, Math.round(f.y - f.t * 20), f.color, f.scale, 'center', 'ink');
    });
    ctx.globalAlpha = 1;
  }

  function drawBanner(ctx) {
    var A = DD.Art;
    if (S.phase === 'intro') {
      band(ctx, 76, 48);
      A.text(ctx, S.def.name, W / 2, 82, 'flame2', 2, 'center', 'ink');
      A.wrap(S.def.flavor || '', 360, 1).slice(0, 2).forEach(function (ln, i) {
        A.text(ctx, ln, W / 2, 102 + i * 9, 'parch', 1, 'center', 'ink');
      });
    } else if (S.phase === 'win') {
      band(ctx, 78, 44);
      A.text(ctx, 'COSECHA', W / 2, 84, 'blood2', 3, 'center', 'ink');
      A.text(ctx, '+' + (S.def.essence || 0) + ' ESENCIA', W / 2, 110, 'brass2', 1, 'center', 'ink');
    }
  }

  function draw(ctx) {
    if (!S || !DD.Core.run) return;
    DD.Art.drawBackground(ctx, 'combat', S.t, { floor: DD.Core.run.floor });
    drawPlayer(ctx);
    drawEnemy(ctx);
    drawTopBar(ctx);
    drawSide(ctx);
    drawHand(ctx);
    drawFloats(ctx);
    drawBanner(ctx);
  }

  DD.Core.registerScene('combat', {
    ticksClock: true,
    enter: enter,
    exit: exit,
    update: update,
    draw: draw
  });
})();
