/* Deadlock Deck: El Reloj Anatómico — combat.js
   Scenes: 'combat' (turn-based card fight; the deck IS the body) and 'harvest' (graft a limb). */
(function () {
  'use strict';
  const DD = window.DD;
  const PAL = DD.PAL;

  // ======================================================================
  // shared helpers
  // ======================================================================
  let cx = null; // current 2D context (set at the start of each draw)

  function sfx(n) { try { if (DD.audio && DD.audio.sfx) DD.audio.sfx(n); } catch (e) { /* ignore */ } }
  function txt(s, x, y, o) { DD.draw.text(s, x, y, o); }
  function ico(name, x, y, s) { if (DD.sprites && DD.sprites.icon) DD.sprites.icon(cx, name, x, y, s || 1); }
  function inRect(x, y, w, h) { return DD.input.mouseIn(x, y, w, h); }
  function sgn(n) { return (n > 0 ? '+' : '') + n; }
  function eatClick() { DD.input.mouse.clicked = false; }
  function rnd(a, b) { return DD.rand.int(a, b); }

  function wrapStr(str, maxChars) {
    const words = String(str).split(' ');
    const out = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (line && t.length > maxChars) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out;
  }

  function passiveLines(p) {
    const out = [];
    if (!p) return out;
    if (p.maxHp) out.push(sgn(p.maxHp) + ' PV máx');
    if (p.draw) out.push(sgn(p.draw) + ' robo');
    if (p.energy) out.push(sgn(p.energy) + ' energía');
    if (p.vision) out.push(sgn(p.vision) + ' visión');
    if (p.speed) out.push(sgn(Math.round(p.speed * 100)) + '% velocidad');
    if (p.cool) out.push(sgn(p.cool) + ' enfriamiento');
    return out;
  }

  const STATUS = {
    burn: ['Quemadura', 'Daño al inicio del turno; baja 1 cada vez.', PAL.ember],
    bleed: ['Sangrado', 'Daño al final del turno; baja 1 cada vez.', PAL.bloodLight],
    weak: ['Debilidad', 'Inflige un 25% menos de daño.', PAL.dim],
    vuln: ['Vulnerable', 'Recibe un 50% más de daño.', PAL.copper],
    stun: ['Aturdido', 'Pierde su próxima acción.', PAL.fire],
    strength: ['Fuerza', 'Suma su valor al daño de cada golpe.', PAL.brass],
    thorns: ['Espinas', 'Devuelve su valor en daño al ser golpeado.', PAL.ichor]
  };
  const STATUS_ORDER = ['strength', 'thorns', 'burn', 'bleed', 'weak', 'vuln', 'stun'];

  const TYPE_COLOR = { attack: '#a3202a', skill: '#4a6a78', power: '#6b3fa0' };
  const TYPE_LABEL = { head: 'Cabeza', torso: 'Torso', arm: 'Brazo', leg: 'Pierna' };
  const TYPE_NAME = { attack: 'Ataque', skill: 'Habilidad', power: 'Poder' };

  // tooltip (drawn last). lines: [string | {t, color}]
  function drawTip(tip) {
    if (!tip) return;
    const size = 8, lh = 11;
    cx.font = 'bold ' + size + 'px ' + DD.FONT;
    let w = 0;
    for (const l of tip.lines) {
      const s = typeof l === 'string' ? l : l.t;
      w = Math.max(w, cx.measureText(s).width);
    }
    w += 14;
    const h = tip.lines.length * lh + 10;
    let x = tip.x, y = tip.y;
    if (tip.center) x -= w / 2;
    x = DD.clamp(x, 4, DD.W - w - 4);
    if (tip.above) y -= h;
    y = DD.clamp(y, 26, DD.H - h - 4);
    DD.draw.panel(x, y, w, h, { fill: '#120d16', edge: PAL.brass, rivets: false });
    for (let i = 0; i < tip.lines.length; i++) {
      const l = tip.lines[i];
      const s = typeof l === 'string' ? l : l.t;
      txt(s, x + 7, y + 6 + i * lh, { size: size, color: (typeof l === 'string' ? PAL.ink : l.color) || PAL.ink });
    }
  }

  function mouseTipPos() {
    const m = DD.input.mouse;
    let x = m.x + 12, y = m.y + 12;
    if (x > DD.W - 200) x = m.x - 200;
    return { x: x, y: y };
  }

  // ======================================================================
  // COMBAT SCENE
  // ======================================================================
  const DOLL_X = 130, DOLL_Y = 186, DOLL_SCALE = 3;
  const ENEMY_X = 500, ENEMY_Y = 186, ENEMY_SCALE = 3;
  const ROW_X = 188, ROW_Y = 46, ROW_DY = 19;
  const CARD_W = 74, CARD_H = 100, HAND_Y = 256;
  const END_BTN = { x: 528, y: 232, w: 104, h: 20 };
  const MAX_HAND = 8;

  let S = null;

  function log(msg) { S.log.push(msg); if (S.log.length > 6) S.log.shift(); }
  function floatE(text, color) { DD.fx.float(text, ENEMY_X + rnd(-24, 24), 80 + rnd(-8, 8), color); }
  function floatP(text, color) { DD.fx.float(text, DOLL_X + rnd(-24, 24), 90 + rnd(-8, 8), color); }

  function calcDamage(n, atkSt, defSt) {
    let d = n + (atkSt.strength || 0);
    if (atkSt.weak > 0) d *= 0.75;
    if (defSt.vuln > 0) d *= 1.5;
    return Math.max(0, Math.floor(d));
  }

  // player -> enemy. Returns hp actually removed.
  function hitEnemy(n, pierce) {
    const E = S.E;
    let rem = calcDamage(n, S.P.st, E.st);
    if (!pierce && E.block > 0) {
      const ab = Math.min(E.block, rem);
      E.block -= ab; rem -= ab;
    }
    if (rem > 0) {
      E.hp = Math.max(0, E.hp - rem);
      E.hurt = 1;
      sfx('hit');
      floatE(String(rem), '#ffe8c0');
      DD.fx.particles(ENEMY_X + rnd(-20, 20), 110 + rnd(-20, 20), PAL.bloodLight, 5);
      DD.fx.shake(2, 0.1);
    } else {
      sfx('block');
      floatE('Bloqueado', PAL.steel);
    }
    return rem;
  }

  // enemy -> player. Returns hp actually lost.
  function hitPlayer(n) {
    const P = S.P, E = S.E;
    let rem = calcDamage(n, E.st, P.st);
    if (P.block > 0) {
      const ab = Math.min(P.block, rem);
      P.block -= ab; rem -= ab;
    }
    if (rem > 0) {
      DD.body.hurt(S.body, rem);
      P.hitT = 1;
      floatP('-' + rem, PAL.bloodLight);
      DD.fx.shake(4, 0.2);
      DD.fx.particles(DOLL_X + rnd(-16, 16), 100 + rnd(-20, 20), PAL.blood, 6);
    } else {
      sfx('block');
      floatP('Bloqueado', PAL.steel);
    }
    if (P.st.thorns > 0) {
      E.hp = Math.max(0, E.hp - P.st.thorns);
      E.hurt = 1;
      floatE(String(P.st.thorns), PAL.ichor);
    }
    return rem;
  }

  function applyStatus(who, id, n) {
    if (!STATUS[id] || !(n > 0)) return;
    who.st[id] = (who.st[id] || 0) + n;
    const txtS = STATUS[id][0] + ' +' + n;
    if (who === S.E) floatE(txtS, STATUS[id][2]); else floatP(txtS, STATUS[id][2]);
    if (id === 'burn') sfx('burn');
  }

  function drawCards(n) {
    let drew = 0;
    for (let i = 0; i < n; i++) {
      if (S.hand.length >= MAX_HAND) break;
      if (!S.pile.length) {
        if (!S.discard.length) break;
        S.pile = DD.rand.shuffle(S.discard);
        S.discard = [];
      }
      S.hand.push(S.pile.pop());
      drew++;
    }
    if (drew) sfx('draw');
    return drew;
  }

  function intactSlots() {
    const out = [];
    for (const k of DD.SLOTS) if (S.body.slots[k]) out.push(k);
    return out;
  }

  // called by DD.body when a limb breaks: purge its cards, add the stump card
  function onBreak(slotKey, limbId) {
    const keep = function (c) { return c.slot !== slotKey; };
    S.hand = S.hand.filter(keep);
    S.pile = S.pile.filter(keep);
    S.discard = S.discard.filter(keep);
    if (S.playing && S.playing.slot === slotKey) S.playing.dead = true;
    S.discard.push({ uid: S.uid++, cardId: DD.STUMPS[DD.SLOT_TYPE[slotKey]], slot: slotKey });
    if (S.sel >= S.hand.length) S.sel = Math.max(0, S.hand.length - 1);
    log('¡' + DD.LIMBS[limbId].name + ' se rompe!');
  }

  function makeCtx(inst) {
    const P = S.P, E = S.E;
    return {
      slot: inst.slot, enemy: E, player: P, body: S.body,
      damage: function (n) { return hitEnemy(n, false); },
      pierce: function (n) { return hitEnemy(n, true); },
      hits: function (n, times) {
        let s = 0;
        for (let i = 0; i < times && E.hp > 0; i++) s += hitEnemy(n, false);
        return s;
      },
      block: function (n) {
        P.block += n; sfx('block');
        floatP('+' + n + ' guardia', PAL.steel);
      },
      heal: function (n) {
        if (!(n > 0)) return 0;
        const h = DD.body.heal(S.body, n);
        if (h > 0) { sfx('heal'); floatP('+' + h + ' PV', PAL.ichor); }
        return h;
      },
      draw: function (n) { drawCards(n); },
      energy: function (n) { P.energy += n; floatP('+' + n + ' energía', PAL.fire); },
      status: function (target, id, n) { applyStatus(target === 'enemy' ? E : P, id, n); },
      coolSelf: function (n) {
        DD.body.cool(S.body, n);
        floatP('-' + n + ' calor', PAL.cold);
      },
      repair: function (n) {
        if (DD.body.repair(S.body, null, n)) floatP('Reparado', PAL.verdigris);
      },
      heatSelf: function (slot, n) {
        if (slot === 'random') {
          const opts = intactSlots();
          if (!opts.length) return;
          slot = opts[rnd(0, opts.length - 1)];
        }
        if (S.body.slots[slot]) DD.body.addHeat(S.body, slot, n);
      },
      hurtSelf: function (n) {
        const lost = DD.body.hurt(S.body, n);
        if (lost > 0) { floatP('-' + lost, PAL.bloodLight); P.hitT = 1; }
      },
      has: function (target, id) { return ((target === 'enemy' ? E : P).st[id]) || 0; },
      heatOf: function (slot) { const l = S.body.slots[slot || inst.slot]; return l ? l.heat : 0; }
    };
  }

  function checkEnd() {
    if (S.state === 'win' || S.state === 'lose') return true;
    if (S.body.hp <= 0) {
      S.state = 'lose'; S.timer = 1.6;
      sfx('death'); DD.fx.shake(8, 0.5);
      return true;
    }
    if (S.E.hp <= 0) {
      S.state = 'win'; S.timer = 1.3;
      sfx('enemyDie'); DD.fx.shake(5, 0.3);
      DD.fx.particles(ENEMY_X, 120, PAL.bloodLight, 24);
      return true;
    }
    return false;
  }

  function playCard(i) {
    if (S.state !== 'player' || i < 0 || i >= S.hand.length) return;
    const inst = S.hand[i];
    const def = DD.CARDS[inst.cardId];
    if (def.cost > S.P.energy) {
      sfx('error');
      DD.fx.float('Sin energía', DOLL_X, 60, PAL.dim);
      return;
    }
    S.P.energy -= def.cost;
    S.hand.splice(i, 1);
    inst.dead = false;
    S.playing = inst;
    sfx('card');
    log('Usas ' + def.name);
    const limbBefore = S.body.slots[inst.slot];
    def.play(makeCtx(inst));
    if (limbBefore && S.body.slots[inst.slot] === limbBefore) {
      if (def.heat > 0) DD.body.addHeat(S.body, inst.slot, def.heat);
      if (S.body.slots[inst.slot] === limbBefore && def.wear > 0) DD.body.wear(S.body, inst.slot, def.wear);
    }
    S.playing = null;
    if (!inst.dead) S.discard.push(inst);
    if (S.sel >= S.hand.length) S.sel = Math.max(0, S.hand.length - 1);
    checkEnd();
  }

  function pickIntent() {
    const list = S.def.intents;
    let idx;
    if (S.E.intentIdx == null) idx = rnd(0, Math.min(1, list.length - 1));
    else if (list.length > 1 && DD.rand.chance(0.3)) {
      do { idx = rnd(0, list.length - 1); } while (idx === S.E.intentIdx);
    } else idx = (S.E.intentIdx + 1) % list.length;
    S.E.intentIdx = idx;
    S.E.intent = list[idx];
  }

  function startPlayerTurn() {
    const body = S.body, P = S.P;
    S.turn++;
    DD.body.cool(body, DD.body.stat(body, 'cool'));
    P.block = 0;
    if (P.st.burn > 0) {
      const d = P.st.burn;
      P.st.burn--;
      DD.body.hurt(body, d);
      floatP('-' + d + ' quemadura', PAL.ember);
      P.hitT = 1;
      if (checkEnd()) return;
    }
    P.energy = DD.body.stat(body, 'energy');
    if (P.st.stun > 0) {
      P.st.stun--;
      P.energy = 0;
      log('Estás aturdido');
      floatP('¡Aturdido!', PAL.fire);
    }
    drawCards(DD.body.stat(body, 'draw'));
    S.sel = 0;
    S.state = 'player';
  }

  function endTurn() {
    if (S.state !== 'player') return;
    sfx('select');
    const P = S.P;
    if (P.st.bleed > 0) {
      const d = P.st.bleed;
      P.st.bleed--;
      DD.body.hurt(S.body, d);
      floatP('-' + d + ' sangrado', PAL.bloodLight);
      P.hitT = 1;
    }
    // weak/vuln on the player tick at the end of the enemy's action (see enemyAct)
    S.discard = S.discard.concat(S.hand);
    S.hand = [];
    S.state = 'enemy'; S.phase = 0; S.timer = 0.5;
    checkEnd();
  }

  function execIntent(it) {
    const P = S.P, E = S.E, body = S.body;
    switch (it.type) {
      case 'attack': {
        const times = it.times || 1;
        E.lunge = 1;
        for (let i = 0; i < times; i++) {
          hitPlayer(it.dmg);
          if (body.hp <= 0 || E.hp <= 0) break;
        }
        break;
      }
      case 'block':
        E.block += it.n; sfx('block');
        floatE('+' + it.n + ' guardia', PAL.steel);
        break;
      case 'buff':
        applyStatus(E, 'strength', it.strength);
        sfx('select');
        break;
      case 'scald': {
        const opts = intactSlots();
        if (opts.length) {
          const s = opts[rnd(0, opts.length - 1)];
          sfx('burn');
          floatP('+' + it.heat + ' calor: ' + DD.SLOT_NAME[s], PAL.heat);
          DD.body.addHeat(body, s, it.heat);
        }
        break;
      }
      case 'sever': {
        const opts = intactSlots();
        if (opts.length) {
          const s = opts[rnd(0, opts.length - 1)];
          E.lunge = 1;
          sfx('hit');
          floatP('¡Cercena ' + DD.SLOT_NAME[s] + '!', PAL.bloodLight);
          DD.body.wear(body, s, it.n);
        }
        break;
      }
      case 'debuff':
        applyStatus(P, it.status, it.n);
        break;
      case 'heal': {
        const h = Math.min(it.n, E.maxHp - E.hp);
        E.hp += h;
        sfx('heal');
        floatE('+' + h + ' PV', PAL.ichor);
        break;
      }
      default: break;
    }
  }

  function enemyAct() {
    const E = S.E, P = S.P;
    let skipped = false;
    E.block = 0;
    if (E.st.burn > 0) {
      const d = E.st.burn;
      E.st.burn--;
      E.hp = Math.max(0, E.hp - d);
      E.hurt = 1;
      floatE('-' + d + ' quemadura', PAL.ember);
      if (checkEnd()) return;
    }
    if (E.st.stun > 0) {
      skipped = true;
      E.st.stun--;
      floatE('¡Aturdido!', PAL.fire);
      log(S.def.name + ' está aturdido');
    } else {
      execIntent(E.intent);
      if (checkEnd()) return;
    }
    if (E.st.bleed > 0) {
      const d = E.st.bleed;
      E.st.bleed--;
      E.hp = Math.max(0, E.hp - d);
      E.hurt = 1;
      floatE('-' + d + ' sangrado', PAL.bloodLight);
    }
    for (const who of [E, P]) {
      if (who.st.weak > 0) who.st.weak--;
      if (who.st.vuln > 0) who.st.vuln--;
    }
    if (checkEnd()) return;
    // a stunned action was skipped: keep the same intent; otherwise choose the next one
    if (!skipped) pickIntent();
  }

  // ---------- scene: enter / update / draw / exit
  function enter(params) {
    const id = params && params.enemyId;
    const def = DD.ENEMIES[id] || DD.ENEMIES.homunculo;
    const floor = DD.run ? DD.run.floor : 1;
    const body = DD.run ? DD.run.body : DD.body.create(DD.BASE_BODIES[0].id);
    const maxHp = Math.round(def.hp * (1 + 0.25 * (floor - 1)));
    S = {
      enemyId: def.id, def: def, floor: floor, body: body,
      E: { hp: maxHp, maxHp: maxHp, block: 0, st: {}, intent: null, intentIdx: null, hurt: 0, lunge: 0 },
      P: { block: 0, energy: 0, st: {}, hitT: 0 },
      pile: [], hand: [], discard: [], playing: null, uid: 1,
      state: 'intro', timer: 0.9, phase: 0, turn: 0, t: 0, log: [],
      sel: 0, keyMode: false, hover: -1, mx: -1, my: -1, tip: null
    };
    const deck = DD.body.deck(body).map(function (d) { return { uid: S.uid++, cardId: d.cardId, slot: d.slot }; });
    S.pile = DD.rand.shuffle(deck);
    DD.body.onBreak = onBreak;
    DD.body.fxAnchor = { x: DOLL_X, y: 100 };
    pickIntent();
    log(def.boss ? '¡' + def.name + ' te corta el paso!' : '¡' + def.name + ' te ataca!');
    if (DD.audio && DD.audio.music) DD.audio.music(def.boss ? 'boss' : 'combat');
  }

  function exit() {
    if (DD.body.onBreak === onBreak) DD.body.onBreak = null;
    DD.body.fxAnchor = null;
  }

  function handRect(i, n) {
    const gap = n > 7 ? 3 : 6;
    const total = n * CARD_W + (n - 1) * gap;
    const x0 = Math.round((DD.W - total) / 2);
    return { x: x0 + i * (CARD_W + gap), y: HAND_Y, w: CARD_W, h: CARD_H };
  }

  function update(dt) {
    if (!S) return;
    dt = Math.min(dt, 0.1);
    S.t += dt;
    const E = S.E, P = S.P;
    E.hurt = Math.max(0, E.hurt - dt * 4);
    E.lunge = Math.max(0, E.lunge - dt * 4);
    P.hitT = Math.max(0, P.hitT - dt * 4);

    if (S.state === 'intro') {
      S.timer -= dt;
      if (S.timer <= 0) startPlayerTurn();
    } else if (S.state === 'player') {
      updatePlayer();
    } else if (S.state === 'enemy') {
      S.timer -= dt;
      if (S.timer <= 0) {
        if (S.phase === 0) {
          enemyAct();
          S.phase = 1; S.timer = 0.8;
        } else if (S.state === 'enemy') {
          startPlayerTurn();
        }
      }
    } else if (S.state === 'win') {
      S.timer -= dt;
      if (S.timer <= 0) {
        DD.body.cool(S.body, 30);
        S.state = 'done';
        if (DD.game && DD.game.combatWon) DD.game.combatWon(S.enemyId);
      }
    } else if (S.state === 'lose') {
      S.timer -= dt;
      if (S.timer <= 0) {
        S.state = 'done';
        if (DD.game && DD.game.endLoop) DD.game.endLoop('death');
      }
    }
  }

  function updatePlayer() {
    const inp = DD.input, m = inp.mouse;
    const n = S.hand.length;
    // mouse hover
    if (m.x !== S.mx || m.y !== S.my) {
      S.mx = m.x; S.my = m.y;
      S.keyMode = false;
    }
    S.hover = -1;
    for (let i = 0; i < n; i++) {
      const r = handRect(i, n);
      if (inRect(r.x, r.y - 10, r.w, r.h + 10)) { S.hover = i; break; }
    }
    if (S.hover >= 0 && !S.keyMode) S.sel = S.hover;

    // keyboard / gamepad
    for (let i = 0; i < 9; i++) {
      if (inp.hit(String(i + 1))) {
        S.keyMode = true;
        if (i < S.hand.length) { S.sel = i; playCard(i); }
        return;
      }
    }
    if (inp.hit('left') && n) { S.sel = (S.sel + n - 1) % n; S.keyMode = true; sfx('select'); }
    if (inp.hit('right') && n) { S.sel = (S.sel + 1) % n; S.keyMode = true; sfx('select'); }
    if (inp.hit('end')) { endTurn(); return; }
    if (inp.hit('confirm')) {
      S.keyMode = true;
      if (n) playCard(S.sel); else endTurn();
      return;
    }
    if (m.clicked && S.hover >= 0) {
      eatClick();
      playCard(S.hover);
    }
  }

  // ---------- drawing
  function heatColor(h) {
    if (h >= 80) return PAL.heat;
    if (h >= 50) return PAL.ember;
    return PAL.brass;
  }

  function drawStatuses(who, x, y) {
    let px = x;
    for (const id of STATUS_ORDER) {
      const v = who.st[id];
      if (!(v > 0)) continue;
      ico(id, px, y, 2);
      txt(String(v), px + 17, y + 5, { size: 8, color: STATUS[id][2] });
      if (inRect(px, y, 26, 16)) {
        S.tip = Object.assign({ lines: [{ t: STATUS[id][0] + ' ' + v, color: STATUS[id][2] }].concat(wrapStr(STATUS[id][1], 34)) }, mouseTipPos());
      }
      px += 30;
    }
  }

  function intentInfo(it) {
    const E = S.E, P = S.P;
    switch (it.type) {
      case 'attack': {
        const d = calcDamage(it.dmg, E.st, P.st);
        const t = it.times || 1;
        return { icon: 'attack', label: 'Ataque ' + d + (t > 1 ? 'x' + t : ''), color: PAL.bloodLight,
          tip: 'Atacará ' + (t > 1 ? t + ' veces por ' + d + ' de daño.' : 'por ' + d + ' de daño.') };
      }
      case 'block': return { icon: 'block', label: 'Guardia ' + it.n, color: PAL.steel, tip: 'Se protegerá con ' + it.n + ' de guardia.' };
      case 'buff': return { icon: 'buff', label: 'Furia +' + it.strength, color: PAL.brass, tip: 'Ganará ' + it.strength + ' de Fuerza.' };
      case 'scald': return { icon: 'scald', label: 'Escaldar +' + it.heat, color: PAL.heat, tip: 'Añadirá ' + it.heat + ' de calor a uno de tus miembros al azar.' };
      case 'sever': return { icon: 'sever', label: 'Cercenar ' + it.n, color: PAL.bloodLight, tip: 'Dañará ' + it.n + ' de integridad a un miembro al azar.' };
      case 'debuff': {
        const s = STATUS[it.status];
        return { icon: it.status, label: s[0] + ' ' + it.n, color: s[2], tip: 'Te aplicará ' + s[0] + ' ' + it.n + '. ' + s[1] };
      }
      case 'heal': return { icon: 'heal', label: 'Regenera ' + it.n, color: PAL.ichor, tip: 'Recuperará ' + it.n + ' PV.' };
      default: return { icon: 'skull', label: '???', color: PAL.dim, tip: '' };
    }
  }

  function drawEnemy() {
    const E = S.E, def = S.def;
    const lunge = Math.sin(E.lunge * Math.PI) * 26;
    const dead = S.state === 'win' ? DD.clamp(1 - S.timer / 1.3, 0, 1) : 0;
    if (DD.sprites && DD.sprites.enemy) {
      DD.sprites.enemy(cx, def.id, ENEMY_X - lunge, ENEMY_Y, ENEMY_SCALE, S.t, { hurt: E.hurt, dead: dead });
    }
    // intent telegraph
    if (S.state !== 'win' && S.state !== 'lose' && E.intent) {
      const info = intentInfo(E.intent);
      const bx = ENEMY_X - 62, by = 27, bw = 124, bh = 18;
      DD.draw.panel(bx, by, bw, bh, { fill: '#1a1014', edge: info.color, rivets: false });
      ico(info.icon, bx + 6, by + 1, 2);
      txt(info.label, bx + 26, by + 5, { size: 10, color: info.color });
      if (E.st.stun > 0) txt('ZZZ', bx + bw - 4, by + 5, { size: 8, color: PAL.fire, align: 'right' });
      if (inRect(bx, by, bw, bh)) S.tip = Object.assign({ lines: [{ t: 'Intención', color: PAL.brass }].concat(wrapStr(info.tip, 34)) }, mouseTipPos());
    }
    // name + hp
    txt(def.name, ENEMY_X, ENEMY_Y + 3, { size: 10, align: 'center', color: def.boss ? PAL.fire : PAL.ink });
    const bx = ENEMY_X - 62, by = ENEMY_Y + 15;
    DD.draw.bar(bx, by, 124, 11, E.hp / E.maxHp, PAL.blood);
    txt('PV ' + E.hp + '/' + E.maxHp, ENEMY_X, by + 2, { size: 8, align: 'center' });
    if (E.block > 0) {
      ico('block', bx + 128, by + 1, 1);
      txt(String(E.block), bx + 138, by + 2, { size: 8, color: PAL.steel });
    }
    drawStatuses(E, bx, ENEMY_Y + 30);
    if (inRect(bx, by, 124, 11)) {
      S.tip = Object.assign({ lines: [{ t: def.name, color: PAL.brass }].concat(wrapStr(def.desc, 34)) }, mouseTipPos());
    }
  }

  function drawDoll(activeSlot) {
    const ox = Math.round(Math.sin(S.t * 60) * 3 * S.P.hitT);
    const dead = S.state === 'lose';
    if (DD.sprites && DD.sprites.drawBody) {
      const prev = cx.globalAlpha;
      if (dead) cx.globalAlpha = DD.clamp(S.timer / 1.6, 0.15, 1);
      DD.sprites.drawBody(cx, S.body, DOLL_X + ox, DOLL_Y, DOLL_SCALE, S.t,
        { skin: DD.save && DD.save.data ? DD.save.data.skin : 'none', highlight: activeSlot || undefined });
      cx.globalAlpha = prev;
    }
    const body = S.body;
    const bx = DOLL_X - 56, by = DOLL_Y + 4;
    DD.draw.bar(bx, by, 112, 11, body.hp / body.maxHp, PAL.blood);
    txt('PV ' + body.hp + '/' + body.maxHp, DOLL_X, by + 2, { size: 8, align: 'center' });
    if (S.P.block > 0) {
      ico('block', bx + 116, by + 1, 1);
      txt(String(S.P.block), bx + 126, by + 2, { size: 8, color: PAL.steel });
    }
    drawStatuses(S.P, bx, DOLL_Y + 18);
    if (inRect(bx, by, 112, 11)) {
      S.tip = Object.assign({ lines: [{ t: 'Tu cuerpo', color: PAL.brass }, 'Si tus PV llegan a 0, mueres.', 'La guardia se pierde cada turno.'] }, mouseTipPos());
    }
  }

  const SLOT_SHORT = { head: 'Cabeza', torso: 'Torso', armL: 'Br.Izq', armR: 'Br.Der', legL: 'Pi.Izq', legR: 'Pi.Der' };

  function drawSlotRows(activeSlot, addHeat) {
    // panel behind the limb column so it stays readable over the backdrop
    const px = ROW_X - 6, pw = 114, ph = 6 * ROW_DY + 16;
    DD.draw.panel(px, ROW_Y - 20, pw, ph + 4, { fill: 'rgba(14,10,18,0.92)', edge: PAL.panelEdge, rivets: false });
    txt('MIEMBROS', px + pw / 2, ROW_Y - 15, { size: 8, align: 'center', color: PAL.brass });
    for (let i = 0; i < DD.SLOTS.length; i++) {
      const k = DD.SLOTS[i];
      const y = ROW_Y + i * ROW_DY;
      const l = S.body.slots[k];
      const type = DD.SLOT_TYPE[k];
      const hot = activeSlot === k;
      if (i > 0) DD.draw.rect(px + 4, y - 3, pw - 8, 1, '#2a2028');
      if (hot) DD.draw.rect(px + 3, y - 2, pw - 6, ROW_DY - 1, 'rgba(200,155,60,0.28)');
      ico(l ? type : 'stump', ROW_X, y + 1, 2);
      txt(SLOT_SHORT[k], ROW_X + 19, y, { size: 8, color: l ? PAL.bone : PAL.bloodLight });
      if (l) {
        const bx = ROW_X + 19, bw = 76;
        DD.draw.bar(bx, y + 9, bw, 5, l.heat / 100, heatColor(l.heat), '#241a20');
        if (hot && addHeat > 0) {
          const w = Math.floor((bw - 2) * DD.clamp(addHeat / 100, 0, 1 - l.heat / 100));
          DD.draw.rect(bx + 1 + Math.floor((bw - 2) * l.heat / 100), y + 10, w, 3,
            l.heat + addHeat >= 100 ? 'rgba(255,255,255,0.9)' : 'rgba(255,220,120,0.7)');
        }
        for (let p = 0; p < l.maxIntegrity; p++) {
          DD.draw.rect(bx + 36 + p * 6 - 0, y + 1, 4, 4, p < l.integrity ? PAL.bone : '#2a2228');
        }
        if (l.heat >= 80 && Math.floor(S.t * 4) % 2 === 0) txt('!', bx + bw + 3, y + 7, { size: 8, color: PAL.heat });
      } else {
        txt('MUÑÓN', ROW_X + 55, y, { size: 8, color: PAL.bloodLight });
        DD.draw.rect(ROW_X + 19, y + 11, 76, 1, '#5a1a20');
      }
      if (inRect(px + 3, y - 2, pw - 6, ROW_DY - 1)) {
        const lines = [];
        if (l) {
          const def = DD.LIMBS[l.id];
          lines.push({ t: def.name + ' (' + DD.SLOT_NAME[k] + ')', color: PAL.brass });
          lines.push('Calor ' + Math.round(l.heat) + '/100');
          lines.push('Integridad ' + l.integrity + '/' + l.maxIntegrity);
          if (l.heat >= 100 - 20) lines.push({ t: '¡Cerca de sobrecalentarse!', color: PAL.heat });
          const ps = passiveLines(def.passive);
          if (ps.length) lines.push({ t: ps.join(', '), color: PAL.verdigris });
        } else {
          lines.push({ t: 'Muñón (' + DD.SLOT_NAME[k] + ')', color: PAL.bloodLight });
          lines.push('Sin miembro: solo una carta débil.');
          lines.push('Injerta uno nuevo al cosechar.');
        }
        S.tip = Object.assign({ lines: lines }, mouseTipPos());
      }
    }
  }

  function drawCard(inst, x, y, opts) {
    const def = DD.CARDS[inst.cardId];
    const limb = S.body.slots[inst.slot];
    const limbDef = limb ? DD.LIMBS[limb.id] : null;
    const afford = def.cost <= S.P.energy && S.state === 'player';
    const a = afford ? 1 : 0.5;
    const risky = limb && limb.heat + def.heat >= 100;
    const breaks = limb && def.wear > 0 && limb.integrity - def.wear <= 0;
    const edge = opts.active ? PAL.fire : ((risky || breaks) && afford && Math.floor(S.t * 4) % 2 === 0 ? PAL.heat : (TYPE_COLOR[def.type] || PAL.panelEdge));
    const prev = cx.globalAlpha;
    cx.globalAlpha = prev * a;
    DD.draw.panel(x, y, CARD_W, CARD_H, { fill: opts.active ? '#2a2030' : '#1a1520', edge: edge, rivets: false });
    DD.draw.rect(x + 4, y + 4, CARD_W - 8, 3, limbDef ? limbDef.look.color : '#777777');
    // cost orb
    cx.fillStyle = '#000'; cx.beginPath(); cx.arc(x + 12, y + 17, 9, 0, 7); cx.fill();
    cx.fillStyle = PAL.brassDark; cx.beginPath(); cx.arc(x + 12, y + 17, 8, 0, 7); cx.fill();
    cx.fillStyle = PAL.brass; cx.beginPath(); cx.arc(x + 12, y + 17, 6, 0, 7); cx.fill();
    // icons
    ico(def.type, x + CARD_W - 31, y + 13, 1);
    ico(limb ? DD.SLOT_TYPE[inst.slot] : 'stump', x + CARD_W - 21, y + 9, 2);
    cx.globalAlpha = prev;
    txt(String(def.cost), x + 12, y + 12, { size: 10, align: 'center', color: '#1a1008', shadow: false, alpha: a });
    const h1 = DD.draw.textWrap(def.name, x + 4, y + 27, CARD_W - 8, { size: 8, color: PAL.ink, alpha: a });
    DD.draw.textWrap(def.desc, x + 4, y + 28 + h1, CARD_W - 8, { size: 8, color: PAL.bone, alpha: a * 0.85, bold: false });
    // heat / wear row
    cx.globalAlpha = prev * a;
    ico('heat', x + 4, y + 87, 1);
    cx.globalAlpha = prev;
    txt(String(def.heat), x + 14, y + 86, { size: 8, color: risky ? PAL.heat : PAL.ember, alpha: a });
    if (def.wear > 0) {
      cx.globalAlpha = prev * a;
      ico('wear', x + 32, y + 87, 1);
      cx.globalAlpha = prev;
      txt(String(def.wear), x + 42, y + 86, { size: 8, color: breaks ? PAL.bloodLight : PAL.bone, alpha: a });
    }
    if (opts.index < 9) txt(String(opts.index + 1), x + CARD_W - 7, y + 86, { size: 8, color: PAL.dim, align: 'center', alpha: a });
    // limb heat bar along the bottom
    if (limb) {
      DD.draw.bar(x + 5, y + CARD_H - 8, CARD_W - 10, 4, limb.heat / 100, heatColor(limb.heat));
    }
  }

  function cardTip(inst, x, y) {
    const def = DD.CARDS[inst.cardId];
    const limb = S.body.slots[inst.slot];
    const lines = [];
    lines.push({ t: def.name + '  (coste ' + def.cost + ')', color: PAL.fire });
    lines.push({ t: TYPE_NAME[def.type] || '', color: PAL.dim });
    if (limb) {
      lines.push({ t: 'Miembro: ' + DD.LIMBS[limb.id].name, color: PAL.brass });
      lines.push('(' + DD.SLOT_NAME[inst.slot] + ')');
      const after = Math.round(limb.heat + def.heat);
      lines.push('Calor ' + Math.round(limb.heat) + ' -> ' + after + '/100');
      if (limb.heat + def.heat >= 100) lines.push({ t: '¡SOBRECALENTARÁ! (-1 integridad)', color: PAL.heat });
      lines.push('Integridad ' + limb.integrity + '/' + limb.maxIntegrity + (def.wear ? ' (-' + def.wear + ' al usar)' : ''));
      if (def.wear > 0 && limb.integrity - def.wear <= 0) lines.push({ t: '¡EL MIEMBRO SE ROMPERÁ!', color: PAL.bloodLight });
    } else {
      lines.push({ t: 'Muñón (' + DD.SLOT_NAME[inst.slot] + ')', color: PAL.bloodLight });
      lines.push('Carta débil de un miembro perdido.');
    }
    return { lines: lines, x: x, y: y, center: true, above: true };
  }

  function draw(ctx) {
    cx = ctx;
    if (!S) return;
    S.tip = null;
    if (DD.sprites && DD.sprites.background) DD.sprites.background(ctx, 'lab', S.t);
    else DD.draw.rect(0, 0, DD.W, DD.H, PAL.bg);

    const n = S.hand.length;
    const activeIdx = S.state === 'player' ? (S.keyMode ? S.sel : S.hover) : -1;
    const activeInst = activeIdx >= 0 && activeIdx < n ? S.hand[activeIdx] : null;
    const activeSlot = activeInst ? activeInst.slot : null;
    const addHeat = activeInst ? DD.CARDS[activeInst.cardId].heat : 0;

    drawEnemy();
    drawDoll(activeSlot);
    drawSlotRows(activeSlot, addHeat);

    // middle: turn counter + log
    txt('Turno ' + Math.max(1, S.turn), 335, 30, { size: 10, align: 'center', color: PAL.dim });
    {
      const lines = [];
      for (let i = 0; i < S.log.length; i++) {
        const w = wrapStr(S.log[i], 22);
        for (const l of w) lines.push({ t: l, last: i === S.log.length - 1 });
      }
      const shown = lines.slice(-5);
      if (shown.length) {
        const lh = 11, lx = 304, lw = 112, lh2 = shown.length * lh + 8, ly = 172 - lh2;
        DD.draw.panel(lx, ly, lw, lh2, { fill: 'rgba(14,10,18,0.85)', edge: PAL.panelEdge, rivets: false });
        for (let i = 0; i < shown.length; i++) {
          txt(shown[i].t, lx + 5, ly + 5 + i * lh, { size: 8, color: shown[i].last ? PAL.ink : PAL.dim });
        }
      }
    }

    // energy orb
    const ex = 30, ey = 240;
    cx.fillStyle = '#000'; cx.beginPath(); cx.arc(ex, ey, 16, 0, 7); cx.fill();
    cx.fillStyle = PAL.brassDark; cx.beginPath(); cx.arc(ex, ey, 14, 0, 7); cx.fill();
    cx.fillStyle = S.P.energy > 0 ? PAL.fire : '#4a3a20'; cx.beginPath(); cx.arc(ex, ey, 11, 0, 7); cx.fill();
    txt(S.P.energy + '/' + DD.body.stat(S.body, 'energy'), ex, ey - 5, { size: 10, align: 'center', color: '#1a1008', shadow: false });
    if (inRect(ex - 16, ey - 16, 32, 32)) {
      S.tip = Object.assign({ lines: [{ t: 'Energía', color: PAL.fire }, 'Cada carta cuesta energía.', 'Se recupera al inicio del turno.'] }, mouseTipPos());
    }
    txt('Mazo ' + S.pile.length, 52, 231, { size: 8, color: PAL.bone });
    txt('Descarte ' + S.discard.length, 52, 243, { size: 8, color: PAL.dim });
    if (n && !activeInst) txt('1-9 / clic: jugar   E: fin de turno', 330, 246, { size: 8, color: PAL.dim, align: 'center' });

    // end turn button
    const canEnd = S.state === 'player';
    const endClicked = DD.draw.button('Fin de turno', END_BTN.x, END_BTN.y, END_BTN.w, END_BTN.h,
      { disabled: !canEnd, size: 10, selected: canEnd && n === 0 });

    // hand
    for (let i = 0; i < n; i++) {
      if (i === activeIdx) continue;
      const r = handRect(i, n);
      drawCard(S.hand[i], r.x, r.y, { index: i, active: false });
    }
    if (activeInst) {
      const r = handRect(activeIdx, n);
      drawCard(activeInst, r.x, r.y - 10, { index: activeIdx, active: true });
      S.tip = cardTip(activeInst, r.x + r.w / 2, HAND_Y - 14);
    }

    drawTip(S.tip);
    if (endClicked) endTurn(); // after the hand was drawn: endTurn empties it

    // banners
    if (S.state === 'intro') {
      const a = DD.clamp(S.timer / 0.9, 0, 1);
      DD.draw.rect(0, 100, DD.W, S.def.boss ? 66 : 42, 'rgba(8,4,10,' + (0.8 * Math.min(1, a * 2)).toFixed(2) + ')');
      txt(S.def.name.toUpperCase(), DD.W / 2, 110, { size: 24, align: 'center', color: S.def.boss ? PAL.fire : PAL.bloodLight, alpha: Math.min(1, a * 2) });
      if (S.def.boss) txt('¡Combate contra el jefe!', DD.W / 2, 143, { size: 12, align: 'center', color: PAL.brass, alpha: Math.min(1, a * 2) });
    } else if (S.state === 'win') {
      DD.draw.rect(0, 104, DD.W, 36, 'rgba(8,4,10,0.75)');
      txt('¡VENCIDO!', DD.W / 2, 110, { size: 24, align: 'center', color: PAL.fire });
    } else if (S.state === 'lose') {
      cx.fillStyle = 'rgba(20,0,0,' + (0.6 * (1 - S.timer / 1.6)).toFixed(2) + ')';
      cx.fillRect(0, 0, DD.W, DD.H);
      txt('HAS MUERTO', DD.W / 2, 140, { size: 24, align: 'center', color: PAL.bloodLight });
    } else if (S.state === 'enemy' && S.phase === 0) {
      txt('Turno del enemigo...', DD.W / 2, 60, { size: 10, align: 'center', color: PAL.dim });
    }

    if (DD.ui && DD.ui.drawHUD) DD.ui.drawHUD(ctx);
  }

  DD.scenes.combat = { enter: enter, update: update, draw: draw, exit: exit };

  // ======================================================================
  // HARVEST SCENE
  // ======================================================================
  let H = null;
  const PANEL_W = 200, PANEL_H = 196, PANEL_Y = 48;

  function pickLayout() {
    const n = H.limbs.length;
    const gap = 10;
    const total = n * PANEL_W + (n - 1) * gap;
    const x0 = Math.round((DD.W - total) / 2);
    const items = [];
    for (let i = 0; i < n; i++) items.push({ kind: 'limb', i: i, x: x0 + i * (PANEL_W + gap), y: PANEL_Y, w: PANEL_W, h: PANEL_H });
    items.push({ kind: 'devour', x: 320 - 200, y: 262, w: 190, h: 28 });
    items.push({ kind: 'leave', x: 320 + 10, y: 262, w: 190, h: 28 });
    return items;
  }

  function slotLayout() {
    const items = [];
    const k = H.slotOpts.length;
    for (let i = 0; i < k; i++) items.push({ kind: 'slot', i: i, x: 224, y: 74 + i * 52, w: 402, h: 46 });
    items.push({ kind: 'graft', x: 224, y: 74 + k * 52 + 6, w: 196, h: 28 });
    items.push({ kind: 'back', x: 430, y: 74 + k * 52 + 6, w: 196, h: 28 });
    return items;
  }

  function slotOptions(limbId) {
    const slots = DD.body.slotsFor(limbId);
    const body = DD.run.body;
    const arr = slots.map(function (k, idx) { return { key: k, idx: idx, stump: !body.slots[k] }; });
    arr.sort(function (a, b) {
      if (a.stump !== b.stump) return a.stump ? -1 : 1;
      return a.idx - b.idx;
    });
    return arr;
  }

  function harvestEnter(params) {
    params = params || {};
    H = {
      limbs: (params.limbs || []).filter(function (id) { return DD.LIMBS[id]; }),
      source: params.source || 'enemy', enemyId: params.enemyId,
      phase: 'pick', chosen: -1, slotOpts: [], slotSel: 0, focus: 0,
      t: 0, timer: 0, msg: [], newBp: false, mx: -1, my: -1
    };
    if (!H.limbs.length) { H.phase = 'done'; H.timer = 1.2; H.msg = [{ t: 'No queda nada que cosechar.', color: PAL.dim }]; }
  }

  function harvestFinish() {
    if (H.finished) return;
    H.finished = true;
    if (DD.game && DD.game.returnToExplore) DD.game.returnToExplore();
  }

  function doDevour() {
    const healed = DD.body.heal(DD.run.body, 8);
    sfx('squelch');
    DD.fx.float('+' + healed + ' PV', 140, 120, PAL.ichor);
    H.msg = [{ t: 'Devoras los restos...', color: PAL.ichor }, { t: '+' + healed + ' PV', color: PAL.ichor }];
    H.phase = 'done'; H.timer = 1.4;
  }

  function doLeave() {
    sfx('select');
    H.msg = [{ t: 'Dejas los restos atrás.', color: PAL.dim }];
    H.phase = 'done'; H.timer = 0.8;
  }

  function doGraft() {
    const id = H.limbs[H.chosen];
    const slot = H.slotOpts[H.slotSel].key;
    const def = DD.LIMBS[id];
    DD.body.graft(DD.run.body, slot, id);
    sfx('graft');
    DD.fx.flash('#7bd35a', 0.2);
    DD.fx.shake(4, 0.25);
    DD.fx.particles(320, 150, PAL.bloodLight, 24);
    const isNew = DD.game && DD.game.discover ? DD.game.discover(id) : false;
    H.newBp = !!isNew;
    H.msg = [{ t: '¡' + def.name + ' injertado!', color: PAL.fire }, { t: DD.SLOT_NAME[slot], color: PAL.dim }];
    if (isNew) H.msg.push({ t: '¡Nuevo plano anatómico!', color: PAL.brass });
    H.phase = 'done'; H.timer = isNew ? 2.6 : 1.6;
  }

  function activate(it) {
    switch (it.kind) {
      case 'limb':
        sfx('select');
        H.chosen = it.i;
        H.slotOpts = slotOptions(H.limbs[it.i]);
        H.slotSel = 0;
        H.phase = 'slot';
        H.focus = H.slotOpts.length; // the "Injertar" button
        break;
      case 'devour': doDevour(); break;
      case 'leave': doLeave(); break;
      case 'slot':
        sfx('select');
        H.slotSel = it.i;
        H.focus = H.slotOpts.length;
        break;
      case 'graft': doGraft(); break;
      case 'back':
        sfx('select');
        H.phase = 'pick'; H.focus = H.chosen;
        break;
      default: break;
    }
  }

  function harvestUpdate(dt) {
    if (!H) return;
    dt = Math.min(dt, 0.1);
    H.t += dt;
    const inp = DD.input, m = inp.mouse;

    if (H.phase === 'done') {
      H.timer -= dt;
      const skip = H.t > 0.35 && (inp.hit('confirm') || m.clicked);
      if (skip) { inp.consume('confirm'); eatClick(); }
      if (H.timer <= 0 || skip) harvestFinish();
      return;
    }

    const items = H.phase === 'pick' ? pickLayout() : slotLayout();
    const n = items.length;
    if (H.focus >= n) H.focus = n - 1;
    if (H.focus < 0) H.focus = 0;
    if (H.t < 0.3) return; // ignore the click/keys that ended combat

    // mouse hover moves focus
    if (m.x !== H.mx || m.y !== H.my) {
      H.mx = m.x; H.my = m.y;
      for (let i = 0; i < n; i++) {
        const it = items[i];
        if (inRect(it.x, it.y, it.w, it.h)) { H.focus = i; break; }
      }
    }
    // keyboard / gamepad navigation
    let move = 0;
    if (inp.hit('left') || inp.hit('up')) move = -1;
    if (inp.hit('right') || inp.hit('down')) move = 1;
    if (H.phase === 'pick') {
      const nl = H.limbs.length;
      if (inp.hit('up')) { if (H.focus >= nl) H.focus = Math.min(nl - 1, H.chosen >= 0 ? H.chosen : 0); move = 0; sfx('select'); }
      else if (inp.hit('down')) { if (H.focus < nl) H.focus = nl; move = 0; sfx('select'); }
    }
    if (move) { H.focus = (H.focus + move + n) % n; sfx('select'); }
    if (H.phase === 'slot' && inp.hit('cancel')) {
      inp.consume('cancel'); inp.consume('pause');
      activate({ kind: 'back' });
      return;
    }
    // activation
    if (inp.hit('confirm')) {
      inp.consume('confirm');
      activate(items[H.focus]);
      return;
    }
    if (m.clicked) {
      for (let i = 0; i < n; i++) {
        const it = items[i];
        if (inRect(it.x, it.y, it.w, it.h)) {
          eatClick();
          H.focus = i;
          activate(it);
          return;
        }
      }
    }
  }

  function drawLimbPanel(id, x, y, w, h, focused, chosen) {
    const def = DD.LIMBS[id];
    DD.draw.panel(x, y, w, h, { fill: chosen ? '#241a2a' : '#1a1520', edge: focused ? PAL.fire : (chosen ? PAL.brass : PAL.panelEdge) });
    if (DD.sprites && DD.sprites.limbIcon) DD.sprites.limbIcon(cx, id, x + 8, y + 8, 3);
    DD.draw.textWrap(def.name, x + 62, y + 10, w - 68, { size: 10, color: PAL.fire });
    txt(TYPE_LABEL[def.slot], x + 62, y + 36, { size: 8, color: PAL.dim });
    for (let p = 0; p < def.integrity; p++) DD.draw.rect(x + 62 + p * 8, y + 48, 6, 6, PAL.bone);
    txt('Int.', x + 62 + def.integrity * 8 + 2, y + 47, { size: 8, color: PAL.dim });
    const ps = passiveLines(def.passive);
    let py = y + 60;
    if (ps.length) py += DD.draw.textWrap(ps.join(', '), x + 8, py, w - 16, { size: 8, color: PAL.verdigris });
    else { txt('Sin pasiva', x + 8, py, { size: 8, color: PAL.dim }); py += 11; }
    py += 3;
    for (const cid of def.cards) {
      const c = DD.CARDS[cid];
      txt(c.name, x + 8, py, { size: 8, color: TYPE_COLOR[c.type] === '#a3202a' ? PAL.bloodLight : (c.type === 'power' ? '#b48af0' : PAL.ink) });
      ico('energy', x + w - 66, py, 1); txt(String(c.cost), x + w - 56, py, { size: 8 });
      ico('heat', x + w - 44, py, 1); txt(String(c.heat), x + w - 34, py, { size: 8, color: PAL.ember });
      ico('wear', x + w - 22, py, 1); txt(String(c.wear), x + w - 12, py, { size: 8, color: PAL.bone });
      py += 11;
      py += DD.draw.textWrap(c.desc, x + 12, py, w - 20, { size: 8, color: PAL.dim, bold: false });
      py += 2;
    }
  }

  function harvestDraw(ctx) {
    cx = ctx;
    if (!H) return;
    if (DD.sprites && DD.sprites.background) DD.sprites.background(ctx, 'table', H.t);
    else DD.draw.rect(0, 0, DD.W, DD.H, PAL.bg);
    DD.draw.rect(0, 0, DD.W, DD.H, 'rgba(6,4,10,0.55)');

    txt('COSECHA', DD.W / 2, 28, { size: 16, align: 'center', color: PAL.fire });

    if (H.phase === 'pick') {
      const items = pickLayout();
      for (const it of items) {
        const foc = items[H.focus] === it;
        if (it.kind === 'limb') {
          drawLimbPanel(H.limbs[it.i], it.x, it.y, it.w, it.h, foc, false);
        } else if (it.kind === 'devour') {
          DD.draw.button('Devorar (+8 PV)', it.x, it.y, it.w, it.h, { selected: foc, color: PAL.ichor });
        } else {
          DD.draw.button('Dejar', it.x, it.y, it.w, it.h, { selected: foc });
        }
      }
      txt('Elige un miembro para injertar. Los muñones se reemplazan primero.', DD.W / 2, 300, { size: 8, color: PAL.dim, align: 'center' });
      txt(H.source === 'jar' ? 'Un frasco de conservación se abre...' : 'Los restos del vencido aún palpitan.', DD.W / 2, 313, { size: 8, color: PAL.dim, align: 'center' });
      txt('Flechas + Enter, o clic', DD.W / 2, 326, { size: 8, color: PAL.dim, align: 'center' });
    } else if (H.phase === 'slot') {
      const id = H.limbs[H.chosen];
      drawLimbPanel(id, 10, PANEL_Y, PANEL_W, PANEL_H, false, true);
      txt('¿Dónde injertarlo?', 224, 52, { size: 12, color: PAL.brass });
      const items = slotLayout();
      const body = DD.run.body;
      for (const it of items) {
        const foc = items[H.focus] === it;
        if (it.kind === 'slot') {
          const opt = H.slotOpts[it.i];
          const sel = H.slotSel === it.i;
          DD.draw.panel(it.x, it.y, it.w, it.h, { fill: sel ? '#2a2030' : '#1a1520', edge: foc ? PAL.fire : (sel ? PAL.brass : PAL.panelEdge), rivets: false });
          txt(DD.SLOT_NAME[opt.key], it.x + 10, it.y + 8, { size: 10, color: sel ? PAL.fire : PAL.ink });
          if (opt.stump) {
            ico('stump', it.x + 10, it.y + 26, 1);
            txt('MUÑÓN vacío: ¡prioridad!', it.x + 22, it.y + 27, { size: 8, color: PAL.bloodLight });
          } else {
            const l = body.slots[opt.key];
            const ld = DD.LIMBS[l.id];
            txt('Reemplaza: ' + ld.name + ' (Int. ' + l.integrity + '/' + l.maxIntegrity + ')', it.x + 10, it.y + 22, { size: 8, color: PAL.bone });
            const names = ld.cards.map(function (c) { return DD.CARDS[c].name; }).join(', ');
            txt('Pierdes: ' + names, it.x + 10, it.y + 33, { size: 8, color: PAL.dim });
          }
          if (sel) txt('>', it.x + it.w - 14, it.y + 8, { size: 10, color: PAL.fire });
        } else if (it.kind === 'graft') {
          DD.draw.button('Injertar', it.x, it.y, it.w, it.h, { selected: foc, color: PAL.ichor });
        } else {
          DD.draw.button('Atrás', it.x, it.y, it.w, it.h, { selected: foc });
        }
      }
      txt('Esc / B: volver', 224, 74 + H.slotOpts.length * 52 + 42, { size: 8, color: PAL.dim });
    } else {
      // result
      DD.draw.panel(120, 100, 400, 110, { fill: '#1a1520', edge: PAL.brass });
      for (let i = 0; i < H.msg.length; i++) {
        txt(H.msg[i].t, DD.W / 2, 122 + i * 22, { size: i === 0 ? 12 : 10, align: 'center', color: H.msg[i].color });
      }
      txt('Enter / clic para continuar', DD.W / 2, 192, { size: 8, color: PAL.dim, align: 'center' });
    }

    if (DD.ui && DD.ui.drawHUD) DD.ui.drawHUD(ctx);
  }

  DD.scenes.harvest = { enter: harvestEnter, update: harvestUpdate, draw: harvestDraw, exit: function () { } };
})();
