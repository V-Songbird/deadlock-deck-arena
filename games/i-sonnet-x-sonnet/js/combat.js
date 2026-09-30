/* Deadlock Deck: El Reloj Anatómico — combate por turnos y cosecha de extremidades (W3)
 * Escenas `combat` y `harvest` (ambas run:true). Reglas: docs/design.md §4.2, §4.3 y §11.
 */
(function () {
  'use strict';
  var DD = window.DD, C = DD.C, CFG = DD.CFG, Body = DD.Body;

  /* =====================================================================
   * Utilidades compartidas
   * ===================================================================== */
  function sfx(name, vol) { if (DD.Audio && DD.Audio.sfx) DD.Audio.sfx(name, vol); }
    function rect(ctx, c, x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function mix(a, b, t) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), out = 0;
    for (var s = 16; s >= 0; s -= 8) {
      var ca = (x >> s) & 255, cb = (y >> s) & 255;
      out = (out << 8) | Math.round(ca + (cb - ca) * t);
    }
    return '#' + ('000000' + out.toString(16)).slice(-6);
  }
  function txt(ctx, s, x, y, color, o) {
    o = o || {};
    DD.text(ctx, s, x, y, { color: color || C.ink, shadow: o.shadow === undefined ? C.bg : o.shadow,
      size: o.size, align: o.align, alpha: o.alpha });
  }
  function icon(ctx, key, x, y, k) {           // iconos 8x8 (k = ampliación entera)
    var SP = DD.Sprites;
    if (!SP || !SP.draw) return;
    if (k > 1) { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(k, k); SP.draw(ctx, key, 0, 0); ctx.restore(); }
    else SP.draw(ctx, key, x, y);
  }
  function limbIcon(ctx, limbId, slot, x, y, k) {    // limbId null = muñón del tipo del hueco
    var SP = DD.Sprites;
    if (!SP) return;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (k > 1) ctx.scale(k, k);
    if (limbId) { if (SP.drawLimbIcon) SP.drawLimbIcon(ctx, limbId, 0, 0); }
    else if (SP.drawStumpIcon) SP.drawStumpIcon(ctx, DD.SLOT_TYPE[slot], 0, 0);
    ctx.restore();
  }
  function heatColor(f) { return mix(C.heat, C.bloodHi, DD.clamp(f, 0, 1)); }
  function integColor(f) { return f < 0.5 ? mix(C.bloodHi, C.warn, f * 2) : mix(C.warn, C.integ, (f - 0.5) * 2); }
  // «Brazo de Sierra» -> «Sierra»; «Cabeza Cosida» -> «Cosida»
  function limbShort(name, max) {
    var s = String(name), i = s.lastIndexOf(' de ');
    if (i >= 0) s = s.slice(i + 4).replace(/^(la|el|los|las) /i, '');
    else s = s.replace(/^(Cabeza|Torso|Brazo|Pierna) /, '');
    if (s.length > max && s.indexOf(' ') > 3) s = s.slice(0, s.indexOf(' '));
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }
  function slotWord(slot) { return DD.SLOT_NAME[slot]; }       // «Brazo izq.»
  function isFem(slot) { var t = DD.SLOT_TYPE[slot]; return t === 'head' || t === 'leg'; }
  function rnd(a, b) { return a + Math.floor(DD.rng() * (b - a + 1)); }

  function veil(ctx, x, y, w, h, a) {           // recuadro oscuro translúcido
    ctx.globalAlpha = a; rect(ctx, C.bg, x, y, w, h); ctx.globalAlpha = 1;
  }
  // Barra de PV con el número dentro
  function hpBar(ctx, x, y, w, h, frac, color, label) {
    DD.ui.bar(ctx, x, y, w, h, frac, color, C.bg);
    txt(ctx, label, x + Math.floor(w / 2), y + Math.floor((h - 7) / 2), C.ink, { align: 'center' });
  }

  /* =====================================================================
   * COMBATE
   * ===================================================================== */
  var PX = 160, EX = 512, FLOOR_Y = 199;          // posición de los luchadores (centro y pies)
  var HAND_Y = 207, CARD_H = 112, RAISE = 9;      // mano: y de reposo, alto de carta, elevación al seleccionar
  var PANEL = { x: 404, y: 27, w: 232, h: 100 };   // ficha del enemigo
  var END_BTN = { x: 548, y: 168, w: 86, h: 30 };
  var ANCHOR = { head: [0, -76], torso: [0, -52], armL: [-16, -52], armR: [16, -52], legL: [-7, -22], legR: [7, -22] };
  var STATUS_COL = { block: '#9fb4cc', burn: C.fire2, vuln: C.warn, weak: '#b9a3e0', stun: C.ether, buff: C.copper };
  var STATUS_ICON = { block: 'i_block', burn: 'i_burn', vuln: 'i_vuln', weak: 'i_weak', stun: 'i_stun', buff: 'i_buff' };
  var STATUS_TIP = {
    block: { name: 'Bloqueo', desc: 'Absorbe daño antes que la vida. Se pierde al empezar su turno.' },
    buff: { name: 'Furia', desc: 'Sus golpes hacen más daño el resto del combate.' }
  };
  var ACCENT = { atk: C.bloodHi, deb: C.warn, def: '#8fa8c8', heal: C.acid, util: C.ether };
  var ENEMY_FX = { dmg: 1, burn: 1, vuln: 1, weak: 1, stun: 1 };

  var S = null;                                   // estado del combate (un solo objeto)

  function alive() {
    return !!(S && !S.over && DD.run && DD.run.started && DD.scene === DD.scenes.combat);
  }
  function busy() { return S.clock < S.lock; }
  function after(d, fn) {
    S.q.push({ t: S.clock + d, n: S.seq++, fn: fn });
    S.q.sort(function (a, b) { return a.t - b.t || a.n - b.n; });
  }
  function later(d, fn) { if (d > 0.001) after(d, fn); else fn(); }

  /* ---------- efectos visuales ---------- */
  function fl(x, y, text, color, size, delay) {
    S.floats.push({ x: x, y: y, text: text, color: color, size: size || 1, t: -(delay || 0), life: 1 });
  }
  function burst(x, y, color, n, pw) {
    for (var i = 0; i < n; i++) {
      var a = DD.rng() * 6.283, v = (0.3 + DD.rng() * 0.7) * pw;
      S.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - pw * 0.25, t: 0, life: 0.35 + DD.rng() * 0.3, c: color, g: 160 });
    }
  }
  function steam(x, y, n) {
    for (var i = 0; i < n; i++) {
      S.parts.push({ x: x + rnd(-6, 6), y: y + rnd(-4, 4), vx: rnd(-8, 8), vy: -24 - DD.rng() * 26, t: 0, life: 0.7 + DD.rng() * 0.5, c: DD.rng() < 0.5 ? '#d9d2c4' : '#8a7f6a', g: -10, big: true });
    }
  }
  function say(head, sub, color) {
    for (var i = 0; i < S.msgs.length; i++) if (S.msgs[i].h === head) { S.msgs[i].t = 0; S.msgs[i].s = sub; return; }
    S.msgs.push({ h: head, s: sub || '', col: color || C.ink, t: 0, life: 1.9 });
    if (S.msgs.length > 2) S.msgs.shift();
  }
  function note(text) { S.note = { text: text, t: 0 }; }
  function pose(who, name, dur) { if (who.pose === 'dead') return; who.pose = name; who.until = S.clock + dur; who.t0 = S.clock; who.dur = dur; }
  function pself() { return [PX + 38, FLOOR_Y - 66]; }                       // flotantes propios (bloqueo, curación...)
  function anchor(slot) { var a = ANCHOR[slot]; return [PX + a[0] + S.pp.dx, FLOOR_Y + a[1]]; }

  /* ---------- reglas ---------- */
  function calc(base, weak, vuln) { return Math.max(0, Math.floor(base * (weak ? 0.75 : 1) * (vuln ? 1.5 : 1))); }
  function mkInst(card, slot) {
    return { uid: S.uid++, card: card, slot: slot, x: 12, dy: 30, a: 0, wait: 0, lost: false, txtKey: '', lines: null };
  }
  function kindOf(card) {
    var t = {};
    card.fx.forEach(function (f) { t[f.t] = 1; });
    if (t.dmg) return 'atk';
    if (t.burn || t.vuln || t.weak || t.stun) return 'deb';
    if (t.block) return 'def';
    if (t.heal || t.repair || t.cool) return 'heal';
    return 'util';
  }
  // Previsión de calor/integridad si se juega la carta (null si el hueco es un muñón)
  function heatInfo(inst) {
    var body = DD.run.body, s = body.slots[inst.slot], limb = Body.limbAt(body, inst.slot), c = inst.card;
    if (!limb) return null;
    var h1 = s.heat + c.heat, over = h1 > CFG.HEAT_MAX;
    var left = s.integ - (over ? CFG.OVERHEAT_DMG : 0) - (c.wear || 0);
    return { h0: s.heat, h1: h1, over: over, left: left, breaks: left <= 0, integ: s.integ, max: limb.integ, limb: limb };
  }
  function risky(inst) { var hi = heatInfo(inst); return !!(hi && (hi.over || hi.breaks)); }

  // Mazo: cuando se agota se baraja el descarte. Devuelve las cartas robadas.
  function drawCards(n) {
    var got = 0;
    for (var i = 0; i < n; i++) {
      if (S.hand.length >= 8) { note('Mano llena'); break; }
      if (!S.draw.length) {
        if (!S.disc.length) break;
        S.draw = DD.shuffle(DD.rng, S.disc); S.disc = [];
        note('Descarte barajado');
      }
      var inst = S.draw.pop();
      inst.wait = got * 0.05; inst.a = 0; inst.dy = 30; inst.x = 12;
      S.hand.push(inst); got++;
    }
    if (got) sfx('card', 0.4);
    return got;
  }

  // Quita de mano, mazo y descarte las cartas de un hueco
  function purge(slot) {
    ['draw', 'hand', 'disc'].forEach(function (k) {
      S[k] = S[k].filter(function (i) {
        if (i.slot !== slot) return true;
        if (k === 'hand') S.ghosts.push({ inst: i, x: i.x, y: HAND_Y + i.dy, t: 0, dur: 0.4, kind: 'break', w: handGeom(S.hand.length).w });
        return false;
      });
    });
    if (S.playing && S.playing.slot === slot && S.playing.card.limb) S.playing.lost = true;
  }

  function breakLimb(slot, cause) {
    purge(slot);
    S.disc.push(mkInst(DD.STUMP_CARDS[DD.SLOT_TYPE[slot]], slot));
    DD.Run.refreshStats();
    var p = anchor(slot);
    say('¡' + slotWord(slot) + (isFem(slot) ? ' rota!' : ' roto!'), cause + ' Pierdes sus cartas.', C.bloodHi);
    burst(p[0], p[1], C.bone, 14, 90); burst(p[0], p[1], C.bloodHi, 8, 60);
    sfx('break'); DD.fx.shake(7, 0.35);
    pose(S.pp, 'hurt', 0.3); S.pp.flash = 1;
    if (S.sel >= S.hand.length) S.sel = Math.max(0, S.hand.length - 1);
  }

  function overheatFx(slot, limbId) {
    var p = anchor(slot), l = DD.LIMBS[limbId];
    say('¡' + slotWord(slot) + (isFem(slot) ? ' sobrecalentada!' : ' sobrecalentado!'),
      (l ? l.name + ': ' : '') + '-' + CFG.OVERHEAT_DMG + ' de integridad.', C.heat);
    fl(p[0], p[1] - 10, '-' + CFG.OVERHEAT_DMG + ' integ.', C.bloodHi, 1, 0.1);
    steam(p[0], p[1], 10);
    sfx('overheat'); DD.fx.flash(C.heat, 0.3, 0.3); DD.fx.shake(5, 0.3);
  }

  function applyHeat(inst) {
    var body = DD.run.body, card = inst.card, slot = inst.slot, p = anchor(slot);
    if (!Body.limbAt(body, slot)) return;
    if (card.heat > 0) {
      var lostName = Body.limbAt(body, slot).id;
      var r = Body.addHeat(body, slot, card.heat);
      fl(p[0], p[1] - 4, '+' + card.heat, C.heat, 1);
      if (r.overheated && !r.broke) overheatFx(slot, lostName);
      else if (r.overheated) { steam(p[0], p[1], 8); sfx('overheat'); }
      if (r.broke) breakLimb(slot, 'Se sobrecalentó.');
    }
    if ((card.wear || 0) > 0 && Body.limbAt(body, slot)) {
      var w = Body.hurtLimb(body, slot, card.wear);
      fl(p[0], p[1] + 6, '-' + card.wear + ' integ.', C.copper, 1, 0.1);
      if (w.broke) breakLimb(slot, 'Se desgastó.');
    }
  }

  /* ---------- efectos de carta (tabla de despacho) ---------- */
  function hitEnemy(dmg, d, k) {
    var e = S.en, ab = Math.min(e.block, dmg), lost = dmg - ab;
    var x = EX + (k % 3 - 1) * 14, y = FLOOR_Y - 34 - k * 7;
    e.block -= ab; e.hp = Math.max(0, e.hp - lost);
    later(d, function () {
      if (!alive()) return;
      if (lost > 0) {
        pose(S.ep, 'hurt', 0.22); S.ep.flash = 1;
        fl(x, y, '-' + lost, lost >= 15 ? C.heatHi : C.ink, 2);
        burst(x, y, C.bloodHi, 5, 70);
        sfx(dmg >= 14 ? 'hitHeavy' : 'hit'); DD.fx.shake(Math.min(5, 1 + lost / 5), 0.14);
        if (ab > 0) fl(x + 18, y + 10, 'bloq -' + ab, STATUS_COL.block, 1);
      } else {
        fl(x, y, dmg > 0 ? 'Bloqueado' : '0', STATUS_COL.block, 1);
        sfx('block');
      }
    });
  }

  var FX = {
    dmg: function (f, c) {
      var n = f.n || 1, per = calc(f.v + c.st.dmg, S.pl.weak > 0, S.en.vuln > 0);
      for (var i = 0; i < n; i++) hitEnemy(per, c.d + i * 0.09, i);
      c.d += n * 0.09; c.hits += n;
    },
    block: function (f, c) {
      var g = f.v + c.st.block;
      S.pl.block += g; S.pl.blockFlash = 1;
      fl(pself()[0], pself()[1], '+' + g + ' bloqueo', STATUS_COL.block, 1, c.d);
      later(c.d, function () { sfx('block'); });
    },
    heal: function (f, c) {
      var got = DD.Run.heal(f.v);
      fl(pself()[0], pself()[1], '+' + got + ' PV', C.acid, 2, c.d);
      later(c.d, function () { sfx('heal'); });
    },
    draw: function (f, c) {
      var got = drawCards(f.v);
      fl(pself()[0], pself()[1], got ? '+' + got + (got === 1 ? ' carta' : ' cartas') : 'Sin cartas', C.ether, 1, c.d);
    },
    energy: function (f, c) {
      S.pl.energy += f.v; S.pl.energyFlash = 1;
      fl(pself()[0], pself()[1], '+' + f.v + ' energía', C.warn, 1, c.d);
    },
    burn: function (f, c) {
      S.en.burn += f.v;
      fl(EX, FLOOR_Y - 56, '+' + f.v + ' quemadura', C.fire2, 1, c.d);
      later(c.d, function () { sfx('burn'); });
    },
    vuln: function (f, c) {
      S.en.vuln += f.v;
      fl(EX, FLOOR_Y - 66, 'Vulnerable ' + f.v, STATUS_COL.vuln, 1, c.d);
      later(c.d, function () { sfx('debuff'); });
    },
    weak: function (f, c) {
      S.en.weak += f.v;
      fl(EX, FLOOR_Y - 76, 'Débil ' + f.v, STATUS_COL.weak, 1, c.d);
      later(c.d, function () { sfx('debuff'); });
    },
    stun: function (f, c) {
      S.en.stun = true;
      fl(EX, FLOOR_Y - 86, '¡Aturdido!', STATUS_COL.stun, 1, c.d);
      later(c.d, function () { sfx('stun'); });
    },
    cool: function (f, c) {
      var slots = f.all ? Body.intactSlots(DD.run.body) : [c.slot];
      slots.forEach(function (s, i) {
        if (!Body.limbAt(DD.run.body, s)) return;
        var had = DD.run.body.slots[s].heat, got = Math.min(had, f.v);
        Body.coolSlot(DD.run.body, s, f.v);
        if (got > 0) { var p = anchor(s); fl(p[0], p[1] - 6, '-' + got, C.ether, 1, c.d + i * 0.03); }
      });
      later(c.d, function () { sfx('coolant', 0.6); });
    },
    repair: function (f, c) {
      var got = Body.repairSlot(DD.run.body, c.slot, f.v);
      if (got > 0) { var p = anchor(c.slot); fl(p[0], p[1] + 4, '+' + got + ' integ.', C.integ, 1, c.d); }
    },
    selfdmg: function (f, c) {
      fl(PX, FLOOR_Y - 60, '-' + f.v, C.bloodHi, 2, c.d);
      DD.Run.hurt(f.v, 'Tu propio cuerpo');
    }
  };

  function playCard(inst) {
    var body = DD.run.body, card = inst.card, st = Body.stats(body), hi = heatInfo(inst);
    S.hand.splice(S.hand.indexOf(inst), 1);
    S.pl.energy -= card.cost;
    S.playing = inst;
    sfx(hi && hi.h1 >= CFG.HEAT_HOT ? 'cardHot' : 'card');
    var kind = kindOf(card), tgt = kind === 'atk' || kind === 'deb' ? [EX, FLOOR_Y - 40] : [PX, FLOOR_Y - 40];
    S.ghosts.push({ inst: inst, x: inst.x, y: HAND_Y + inst.dy, t: 0, dur: 0.26, kind: 'fly', tx: tgt[0] - 30, ty: tgt[1] - 40, w: handGeom(S.hand.length + 1).w });
    var c = { inst: inst, st: st, slot: inst.slot, d: 0.04, hits: 0 };
    card.fx.forEach(function (f) {
      if (!alive()) return;
      if (ENEMY_FX[f.t] && S.en.hp <= 0) return;
      if (FX[f.t]) FX[f.t](f, c);
    });
    if (!alive()) return;
    applyHeat(inst);
    if (!alive()) return;
    S.playing = null;
    if (!inst.lost) S.disc.push(inst);
    if (c.hits) { pose(S.pp, 'attack', 0.28); }
    S.lock = S.clock + (c.hits ? 0.3 : 0.17);
    if (S.sel >= S.hand.length) S.sel = Math.max(0, S.hand.length - 1);   // con la mano vacía queda el botón de terminar turno
    if (S.en.hp <= 0) win();
  }

  /* ---------- flujo de turnos ---------- */
  function startPlayerTurn() {
    if (!alive() || S.phase === 'won') return;
    S.turn++; S.phase = 'player'; S.fast = false; S.armed = null;
    S.pl.block = 0;
    if (S.pl.burn > 0) {
      var b = S.pl.burn;
      S.pl.burn--;
      fl(PX, FLOOR_Y - 60, '-' + b, STATUS_COL.burn, 2);
      sfx('burn');
      if (DD.Run.hurt(b, 'Quemaduras')) return;
    }
    var st = Body.stats(DD.run.body);
    S.pl.energy = st.energy;
    drawCards(st.hand);
    S.sel = DD.clamp(S.sel, 0, Math.max(0, S.hand.length - 1));
    if (S.buf) S.buf = null;
  }

  function endTurn() {
    if (S.phase !== 'player') return;
    S.phase = 'enemy'; S.armed = null; S.buf = null;
    S.hand.forEach(function (i) { S.ghosts.push({ inst: i, x: i.x, y: HAND_Y + i.dy, t: 0, dur: 0.3, kind: 'fall', w: handGeom(S.hand.length).w }); });
    S.disc = S.disc.concat(S.hand); S.hand = [];
    var body = DD.run.body, st = Body.stats(body);
    DD.SLOTS.forEach(function (s) {
      var had = body.slots[s].heat;
      if (had > 0 && Body.limbAt(body, s)) { var p = anchor(s); fl(p[0], p[1], '-' + Math.min(had, st.cool), C.ether, 1, 0.05); }
    });
    Body.coolAll(body, st.cool);
    S.pl.vuln = Math.max(0, S.pl.vuln - 1);
    S.pl.weak = Math.max(0, S.pl.weak - 1);
    after(0.15, enemyStart);
  }

  function curMove() { return S.def.moves[S.en.mv % S.def.moves.length]; }

  function enemyStart() {
    var e = S.en;
    e.block = 0;
    if (e.burn > 0) {
      var b = e.burn;
      e.burn--; e.hp = Math.max(0, e.hp - b);
      fl(EX, FLOOR_Y - 50, '-' + b, STATUS_COL.burn, 2);
      sfx('burn'); S.ep.flash = 0.6;
      if (e.hp <= 0) { win(); return; }
    }
    if (e.stun) {
      e.stun = false;
      fl(EX, FLOOR_Y - 70, '¡Aturdido!', STATUS_COL.stun, 1);
      sfx('stun');
      after(0.3, enemyEnd);
      return;
    }
    after(0.05, enemyAct);
  }

  function enemyAct() {
    var mv = curMove();
    pose(S.ep, 'attack', 0.3);
    sfx('enemyAttack', 0.7);
    after(MOVES[mv.t] ? MOVES[mv.t](mv) : 0.3, enemyEnd);
  }

  function enemyEnd() {
    var e = S.en;
    e.vuln = Math.max(0, e.vuln - 1); e.weak = Math.max(0, e.weak - 1);
    e.mv = (e.mv + 1) % S.def.moves.length;
    startPlayerTurn();
  }

  // Golpe del enemigo: el bloqueo se consume primero
  function hitPlayer(dmg, k) {
    if (!alive()) return;
    var p = S.pl, ab = Math.min(p.block, dmg), lost = dmg - ab, x = PX + ((k || 0) % 3 - 1) * 14, y = FLOOR_Y - 50 - (k || 0) * 7;
    p.block -= ab;
    pose(S.pp, 'hurt', 0.25); S.pp.flash = 1;
    if (ab > 0 && lost > 0) fl(x + 18, y + 10, 'bloq -' + ab, STATUS_COL.block, 1);
    if (lost > 0) {
      fl(x, y, '-' + lost, C.bloodHi, 2);
      burst(x, y, C.bloodHi, 6, 70);
      DD.Run.hurt(lost, S.def.name);
    } else {
      fl(x, y, dmg > 0 ? 'Bloqueado' : '0', STATUS_COL.block, 1);
      sfx('block'); DD.fx.shake(2, 0.12);
    }
  }

  function randomIntact() { return DD.pick(DD.rng, Body.intactSlots(DD.run.body)); }

  // Cada movimiento devuelve lo que tarda (s) hasta que termina el turno del enemigo
  var MOVES = {
    attack: function (mv) {
      var n = mv.n || 1, per = enemyHit(mv.v);
      for (var i = 0; i < n; i++) after(0.1 + i * 0.11, hitPlayer.bind(null, per, i));
      return 0.1 + (n - 1) * 0.11 + 0.2;
    },
    block: function (mv) {
      S.en.block += mv.v;
      fl(EX, FLOOR_Y - 60, '+' + mv.v + ' bloqueo', STATUS_COL.block, 1);
      sfx('block');
      return 0.35;
    },
    buff: function (mv) {
      S.en.buff += mv.v;
      fl(EX, FLOOR_Y - 60, '+' + mv.v + ' daño', STATUS_COL.buff, 1);
      sfx('buff'); burst(EX, FLOOR_Y - 30, C.warn, 8, 50);
      return 0.35;
    },
    limb: function (mv) {
      after(0.1, function () {
        if (!alive()) return;
        if (!Body.intactSlots(DD.run.body).length) { hitPlayer(mv.v); return; }
        var slot = randomIntact(), p = anchor(slot), r = Body.hurtLimb(DD.run.body, slot, mv.v);
        pose(S.pp, 'hurt', 0.25); S.pp.flash = 1;
        fl(p[0], p[1], '-' + mv.v + ' integ.', C.copper, 2);
        burst(p[0], p[1], C.bone, 8, 70);
        sfx('hit', 0.6); DD.fx.shake(3, 0.15);
        if (r.broke) breakLimb(slot, isFem(slot) ? 'Te la arrancan.' : 'Te lo arrancan.');
      });
      return 0.4;
    },
    heat: function (mv) {
      after(0.1, function () {
        if (!alive()) return;
        var body = DD.run.body, slots = mv.all ? Body.intactSlots(body) : (Body.intactSlots(body).length ? [randomIntact()] : []);
        if (!slots.length) return;
        slots.forEach(function (slot) {
          var lostName = Body.limbAt(body, slot) ? Body.limbAt(body, slot).id : null, p = anchor(slot);
          var r = Body.addHeat(body, slot, mv.v);
          fl(p[0], p[1] - 4, '+' + mv.v, C.heat, 1);
          if (r.overheated && !r.broke) overheatFx(slot, lostName);
          else if (r.overheated) { steam(p[0], p[1], 8); sfx('overheat'); }
          if (r.broke) breakLimb(slot, 'Se sobrecalentó.');
        });
        sfx('debuff'); DD.fx.flash(C.heat, 0.2, 0.15);
      });
      return 0.4;
    },
    debuff: function (mv) {
      var p = S.pl, key = mv.status;
      p[key] = (p[key] || 0) + mv.v;
      var label = { burn: 'Quemadura ', vuln: 'Vulnerable ', weak: 'Débil ' }[key] || '';
      fl(pself()[0], pself()[1], label + mv.v, STATUS_COL[key] || C.ink, 1);
      sfx(key === 'burn' ? 'burn' : 'debuff');
      return 0.35;
    },
    heal: function (mv) {
      var e = S.en, got = Math.min(mv.v, S.def.hp[1] - e.hp);
      e.hp += Math.max(0, got);
      fl(EX, FLOOR_Y - 60, '+' + Math.max(0, got), C.acid, 2);
      sfx('heal');
      return 0.35;
    }
  };

  // preview: durante el turno del jugador su vulnerable bajará 1 antes de que el enemigo actúe
  function enemyHit(v, preview) {
    var vuln = preview && S.phase === 'player' ? S.pl.vuln - 1 : S.pl.vuln;
    return calc(v + S.en.buff, S.en.weak > 0, vuln > 0);
  }

  // Icono, valor y texto de la intención (mv = movimiento del enemigo)
  function intentOf(mv) {
    var e = S.en, it = { name: mv.name, icon: 'i_attack', val: String(mv.v), col: C.bloodHi, desc: '' };
    if (mv.t === 'attack') {
      var per = enemyHit(mv.v, true), n = mv.n || 1;
      it.val = n > 1 ? per + '×' + n : String(per);
      it.desc = n > 1 ? n + ' golpes de ' + per + ' de daño' : 'Golpe de ' + per + ' de daño';
      if (e.buff) it.desc += ' (furia)';
    } else if (mv.t === 'block') {
      it.icon = 'i_block'; it.col = STATUS_COL.block; it.desc = 'Gana bloqueo: frena tu daño';
    } else if (mv.t === 'buff') {
      it.icon = 'i_buff'; it.val = '+' + mv.v; it.col = STATUS_COL.buff; it.desc = 'Sus golpes hacen +' + mv.v + ' de daño';
    } else if (mv.t === 'limb') {
      it.icon = 'i_limb'; it.col = C.copper; it.desc = 'Daña la integridad de 1 extremidad';
    } else if (mv.t === 'heat') {
      it.icon = 'i_heat'; it.val = '+' + mv.v; it.col = C.heat;
      it.desc = mv.all ? 'Calienta todas tus extremidades' : 'Calienta 1 extremidad al azar';
    } else if (mv.t === 'debuff') {
      var k = mv.status;
      it.icon = STATUS_ICON[k] || 'i_debuff'; it.col = STATUS_COL[k] || C.ink;
      it.desc = k === 'weak' ? 'Débil ' + mv.v + ': haces -25% de daño' : k === 'vuln' ? 'Vulnerable ' + mv.v + ': recibes +50% daño' : 'Quemadura ' + mv.v + ': daño al empezar turno';
    } else if (mv.t === 'heal') {
      it.icon = 'i_heal'; it.val = '+' + mv.v; it.col = C.acid; it.desc = 'Recupera vida';
    }
    return it;
  }

  function win() {
    if (S.phase === 'won') return;
    S.phase = 'won'; S.buf = null; S.armed = null;
    S.ep.pose = 'dead'; S.ep.until = 1e9; S.ep.dieT = S.clock;
    S.hand.forEach(function (i) { S.ghosts.push({ inst: i, x: i.x, y: HAND_Y + i.dy, t: 0, dur: 0.35, kind: 'fall', w: handGeom(S.hand.length).w }); });
    S.hand = [];
    sfx('enemyDie'); DD.fx.flash('#ffffff', 0.18, 0.3); DD.fx.shake(6, 0.3);
    burst(EX, FLOOR_Y - 30, C.bone, 16, 110); burst(EX, FLOOR_Y - 30, C.blood, 10, 70);
    after(0.85, function () { S.phase = 'done'; DD.Run.combatWon(S.entity); });
  }

  /* ---------- mano: geometría y entrada ---------- */
  function handGeom(n) {
    n = Math.max(1, n);
    var gap = n >= 8 ? 1 : (n >= 7 ? 2 : 4);
    var w = Math.min(92, Math.floor((628 - (n - 1) * gap) / n));
    return { w: w, gap: gap, x0: Math.round((640 - (n * w + (n - 1) * gap)) / 2) };
  }
  function cardAt(mx, my) {
    var n = S.hand.length, g = handGeom(n);
    if (my < HAND_Y - RAISE || my >= HAND_Y + CARD_H) return -1;
    for (var i = n - 1; i >= 0; i--) {
      var x = g.x0 + i * (g.w + g.gap);
      if (mx >= x && mx < x + g.w) return i;
    }
    return -1;
  }
  function overEnd() { return DD.ui.hit(END_BTN.x, END_BTN.y, END_BTN.w, END_BTN.h); }

  function deny(inst) {
    sfx('error', 0.6);
    note('Sin energía');
    S.deny = { uid: inst.uid, t: 0 };
  }

  function attemptPlay(inst, viaPointer) {
    if (S.pl.energy < inst.card.cost) { deny(inst); return; }
    // en táctil no hay «hover»: una jugada que sobrecalienta pide un segundo toque
    if (viaPointer && DD.Input.mouse.touch && risky(inst) && S.armed !== inst.uid) {
      S.armed = inst.uid; S.sel = S.hand.indexOf(inst); sfx('ui');
      return;
    }
    S.armed = null;
    playCard(inst);
  }

  function findInst(uid) {
    for (var i = 0; i < S.hand.length; i++) if (S.hand[i].uid === uid) return S.hand[i];
    return null;
  }

  function execute(req) {
    if (!req) return;
    if (req.end) { sfx('ui'); endTurn(); return; }
    var inst = findInst(req.uid);
    if (inst) attemptPlay(inst, req.pointer);
  }

  function readInput() {
    var In = DD.Input, m = In.mouse, n = S.hand.length, req = null, num = In.num();
    if (m.moved && m.inside) S.hover = true;                     // el ratón manda hasta que se use el teclado
    if (S.hover && m.inside && !m.touch) {
      var h = cardAt(m.x, m.y);
      S.sel = h >= 0 ? h : (overEnd() ? n : -1);
    }
    if (In.pressed('left') || In.pressed('right')) {
      S.hover = false;
      S.sel = In.pressed('left') ? (S.sel <= 0 ? n : S.sel - 1) : (S.sel < 0 || S.sel >= n ? 0 : S.sel + 1);
    }
    if (S.sel > n) S.sel = n;
    if (S.armed !== null && (In.pressed('back') || !S.hand[S.sel] || S.hand[S.sel].uid !== S.armed)) S.armed = null;
    if (In.pressed('endTurn')) req = { end: true };
    else if (num && num <= n) req = { uid: S.hand[num - 1].uid };
    else if (In.pressed('ok')) req = S.sel >= 0 && S.sel < n ? { uid: S.hand[S.sel].uid } : (S.sel === n ? { end: true } : null);
    else if (m.clicked) {
      var c = cardAt(m.x, m.y);
      if (c >= 0) req = { uid: S.hand[c].uid, pointer: true };
      else if (overEnd()) req = { end: true };
      else S.armed = null;
    }
    if (req && busy()) { S.buf = req; req = null; }       // una sola petición en cola durante la animación
    if (!req && !busy() && S.buf) { req = S.buf; S.buf = null; }
    execute(req);
  }

  /* ---------- actualización ---------- */
  function animate(dt) {
    var i, o, g = handGeom(S.hand.length);
    for (i = S.floats.length - 1; i >= 0; i--) {
      o = S.floats[i]; o.t += dt;
      if (o.t > 0.9) S.floats.splice(i, 1);
    }
    for (i = S.parts.length - 1; i >= 0; i--) {
      o = S.parts[i]; o.t += dt; o.x += o.vx * dt; o.y += o.vy * dt; o.vy += o.g * dt;
      if (o.t > o.life) S.parts.splice(i, 1);
    }
    for (i = S.ghosts.length - 1; i >= 0; i--) { S.ghosts[i].t += dt; if (S.ghosts[i].t > S.ghosts[i].dur) S.ghosts.splice(i, 1); }
    for (i = S.msgs.length - 1; i >= 0; i--) { S.msgs[i].t += dt; if (S.msgs[i].t > S.msgs[i].life) S.msgs.splice(i, 1); }
    if (S.note) { S.note.t += dt; if (S.note.t > 1.1) S.note = null; }
    if (S.deny) { S.deny.t += dt; if (S.deny.t > 0.3) S.deny = null; }
    var k = Math.min(1, dt * 12);
    S.en.shown += (S.en.hp - S.en.shown) * k;
    S.pl.shown += (DD.run.hp - S.pl.shown) * k;
    ['pp', 'ep'].forEach(function (w) {
      var p = S[w];
      if (p.pose !== 'idle' && p.pose !== 'dead' && S.clock >= p.until) p.pose = 'idle';
      p.flash = Math.max(0, p.flash - dt * 5);
      var off = 0, t = p.dur ? (S.clock - p.t0) / p.dur : 1, dir = w === 'pp' ? 1 : -1;
      if (p.pose === 'attack') off = Math.sin(Math.min(1, t) * Math.PI) * 16 * dir;
      else if (p.pose === 'hurt') off = -5 * dir * (1 - Math.min(1, t));
      p.dx = off;
    });
    S.pl.blockFlash = Math.max(0, S.pl.blockFlash - dt * 3);
    S.pl.energyFlash = Math.max(0, S.pl.energyFlash - dt * 3);
    for (i = 0; i < S.hand.length; i++) {
      o = S.hand[i];
      if (o.wait > 0) { o.wait -= dt; continue; }
      var tx = g.x0 + i * (g.w + g.gap), ty = S.sel === i && S.phase === 'player' ? -RAISE : 0;
      o.x += (tx - o.x) * Math.min(1, dt * 16);
      o.dy += (ty - o.dy) * Math.min(1, dt * 18);
      o.a = Math.min(1, o.a + dt * 6);
    }
  }

  function update(dt) {
    if (!S || !alive()) return;
    if (S.phase === 'enemy' && (DD.Input.mouse.clicked || DD.Input.pressed('ok') || DD.Input.pressed('endTurn'))) S.fast = true;
    S.clock += dt * (S.fast ? 3 : 1);
    while (S.q.length && S.q[0].t <= S.clock && alive()) S.q.shift().fn();
    if (!alive()) return;
    animate(dt);
    if (S.phase === 'player') readInput();
  }

  /* ---------- dibujo ---------- */
  function cardLines(inst, st, w) {
    var key = st.dmg + ':' + st.block + ':' + (S.pl.weak > 0) + ':' + (S.en.vuln > 0) + ':' + w;
    if (inst.txtKey === key) return inst.lines;
    var fx = inst.card.fx.map(function (f) {
      if (f.t === 'dmg') return { t: 'dmg', n: f.n, v: calc(f.v + st.dmg, S.pl.weak > 0, S.en.vuln > 0) };
      if (f.t === 'block') return { t: 'block', v: f.v + st.block };
      return f;
    });
    inst.txtKey = key;
    inst.lines = DD.wrap(DD.cardText({ fx: fx }), w - 8, 1);
    return inst.lines;
  }

  function heatBar(ctx, x, y, w, h0, add, over) {
    var iw = w - 2, f0 = Math.round(Math.min(h0, CFG.HEAT_MAX) / CFG.HEAT_MAX * iw), f1 = Math.round(Math.min(h0 + add, CFG.HEAT_MAX) / CFG.HEAT_MAX * iw);
    rect(ctx, C.line, x, y, w, 6);
    rect(ctx, C.bg, x + 1, y + 1, iw, 4);
    rect(ctx, heatColor(h0 / CFG.HEAT_MAX), x + 1, y + 1, f0, 4);
    if (f1 > f0) rect(ctx, over ? C.bloodHi : C.heatHi, x + 1 + f0, y + 1, f1 - f0, 4);
    rect(ctx, C.brassDk, x + 1 + Math.round(CFG.HEAT_HOT / CFG.HEAT_MAX * iw), y, 1, 6);          // marca de «caliente»
    if (over && Math.floor(DD.time * 6) % 2 === 0) rect(ctx, '#ffffff', x + w - 3, y - 1, 2, 8);
  }

  function drawCard(ctx, inst, x, y, w, sel, st) {
    var card = inst.card, slot = inst.slot, body = DD.run.body, hi = heatInfo(inst), h = CARD_H;
    var afford = S.pl.energy >= card.cost, playable = S.phase === 'player' && afford;
    var acc = ACCENT[kindOf(card)], blink = Math.floor(DD.time * 6) % 2 === 0, prevA = ctx.globalAlpha, i;
    var armed = S.armed === inst.uid, dn = S.deny && S.deny.uid === inst.uid ? Math.round(Math.sin(S.deny.t * 60) * 2) : 0;
    x += dn;
    ctx.globalAlpha = prevA * inst.a;
    var bord = sel ? C.heatHi : (hi && hi.over ? (blink ? C.bloodHi : C.blood) : mix(acc, C.bg, 0.5));
    if (armed) bord = blink ? '#ffffff' : C.heatHi;
    rect(ctx, C.bg, x - 1, y - 1, w + 2, h + 2);
    rect(ctx, bord, x, y, w, h);
    rect(ctx, sel ? C.panelHi : C.panel, x + 1, y + 1, w - 2, h - 2);
    ctx.globalAlpha *= 0.2; rect(ctx, acc, x + 1, y + 1, w - 2, 21); ctx.globalAlpha = prevA * inst.a;
    // extremidad dueña: icono y hueco
    limbIcon(ctx, hi ? hi.limb.id : null, slot, x + 3, y + 3, 1);
    var words = slotWord(slot).split(' ');
    txt(ctx, words[0], x + 21, words[1] ? y + 5 : y + 9, C.bone);
    if (words[1]) txt(ctx, words[1], x + 21, y + 14, C.dim);
    // coste
    rect(ctx, C.bg, x + w - 19, y + 4, 16, 11);
    rect(ctx, afford ? C.steelDk : C.blood, x + w - 18, y + 5, 14, 9);
    icon(ctx, 'i_energy', x + w - 18, y + 5);
    txt(ctx, String(card.cost), x + w - 9, y + 6, afford ? C.ink : '#ffffff', { shadow: null });
    // nombre y efecto
    var nm = DD.wrap(card.name, w - 6, 1);
    for (i = 0; i < nm.length && i < 2; i++) txt(ctx, nm[i], x + 4, y + 24 + i * 9, sel ? C.heatHi : C.bone);
    rect(ctx, C.line, x + 3, y + 42, w - 6, 1);
    var tl = cardLines(inst, st, w);
    for (i = 0; i < tl.length && i < 4; i++) txt(ctx, tl[i], x + 4, y + 46 + i * 9, C.ink);
    // calor y desgaste
    if (hi && (card.heat > 0 || hi.h0 > 0)) {
      heatBar(ctx, x + 4, y + 86, w - 8, hi.h0, card.heat, hi.over);
      var hcol = hi.over ? C.bloodHi : (hi.h1 >= CFG.HEAT_HOT ? C.heatHi : C.ink);
      txt(ctx, card.heat > 0 ? hi.h0 + '→' + hi.h1 : 'Calor ' + hi.h0, x + 4, y + 95, hcol);
      if (card.wear > 0) {
        var wt = '-' + card.wear;
        txt(ctx, wt, x + w - 4 - wt.length * 6 + 1, y + 95, C.copper);
        icon(ctx, 'i_limb', x + w - 4 - wt.length * 6 - 8, y + 95);
      }
    } else {
      txt(ctx, 'Sin calor', x + 4, y + 95, C.dim);
    }
    if (hi && (hi.over || hi.breaks)) {                      // aviso rojo
      rect(ctx, blink ? C.blood : '#6e1219', x + 2, y + h - 22, w - 4, 20);
      if (hi.breaks) txt(ctx, '¡SE ROMPE!', x + (w >> 1), y + h - 16, '#ffffff', { align: 'center', shadow: null });
      else {
        txt(ctx, '¡SOBRE-', x + (w >> 1), y + h - 21, '#ffffff', { align: 'center', shadow: null });
        txt(ctx, 'CALIENTA!', x + (w >> 1), y + h - 12, '#ffffff', { align: 'center', shadow: null });
      }
    }
    if (!playable) { ctx.globalAlpha = prevA * inst.a * 0.5; rect(ctx, C.bg, x, y, w, h); }
    ctx.globalAlpha = prevA;
  }

  function drawGhost(ctx, g) {
    var t = g.t / g.dur, inst = g.inst, w = g.w, x = g.x, y = g.y, prevA = ctx.globalAlpha;
    if (g.kind === 'fly') { x += (g.tx - x) * t; y += (g.ty - y) * t; ctx.globalAlpha = prevA * (1 - t) * 0.9; }
    else if (g.kind === 'fall') { y += 30 * t; ctx.globalAlpha = prevA * (1 - t) * 0.6; }
    else { x += Math.sin(t * 40) * 3; ctx.globalAlpha = prevA * (1 - t); }
    rect(ctx, g.kind === 'break' ? C.bloodHi : C.bg, x - 1, y - 1, w + 2, 38);
    rect(ctx, g.kind === 'break' ? C.blood : C.panelHi, x, y, w, 36);
    var nm = DD.wrap(inst.card.name, w - 6, 1);
    txt(ctx, nm[0], x + 3, y + 5, C.ink);
    if (nm[1]) txt(ctx, nm[1], x + 3, y + 14, C.ink);
    ctx.globalAlpha = prevA;
  }

  function badge(ctx, x, y, key, n, tipKey) {     // icono + número; devuelve el ancho
    var col = STATUS_COL[key] || C.ink, s = n === null ? '' : String(n), w = 12 + s.length * 6;
    icon(ctx, STATUS_ICON[key], x, y);
    if (s) txt(ctx, s, x + 10, y, col);
    S.tips.push({ x: x, y: y - 1, w: w, h: 10, key: tipKey || key });
    return w + 2;
  }
  function statusRow(ctx, x, y, who) {
    var o = who === 'en' ? S.en : S.pl;
    if (o.block > 0) x += badge(ctx, x, y, 'block', o.block);
    if (o.burn > 0) x += badge(ctx, x, y, 'burn', o.burn);
    if (o.vuln > 0) x += badge(ctx, x, y, 'vuln', o.vuln);
    if (o.weak > 0) x += badge(ctx, x, y, 'weak', o.weak);
    if (who === 'en') {
      if (o.stun) x += badge(ctx, x, y, 'stun', null);
      if (o.buff > 0) x += badge(ctx, x, y, 'buff', '+' + o.buff);
    }
  }

  function drawEnemyPanel(ctx) {
    var P = PANEL, e = S.en, d = S.def, x = P.x, y = P.y, w = P.w;
    DD.ui.panel(ctx, x, y, w, P.h, { title: d.name });
    icon(ctx, 'i_hp', x + 8, y + 25);
    hpBar(ctx, x + 20, y + 23, w - 30, 12, e.shown / e.hpMax, C.blood, e.hp + '/' + e.hpMax);
    statusRow(ctx, x + 10, y + 39, 'en');
    txt(ctx, d.elite ? 'Élite' : (d.kind === 'scientist' ? 'Científico' : 'Monstruo'), x + w - 10, y + 39, d.elite ? C.warn : C.dim, { align: 'right' });
    rect(ctx, C.line, x + 8, y + 51, w - 16, 1);
    var mv = curMove(), it = intentOf(mv), st = e.stun;
    txt(ctx, 'Intención', x + w - 10, y + 55, C.dim, { align: 'right' });
    if (st) {
      icon(ctx, 'i_stun', x + 10, y + 56, 3);
      txt(ctx, 'ATURDIDO', x + 40, y + 60, STATUS_COL.stun, { size: 2 });
      txt(ctx, 'Pierde: ' + mv.name, x + 40, y + 76, C.dim);
      txt(ctx, 'No actuará este turno', x + 10, y + 86, C.ink);
      return;
    }
    icon(ctx, it.icon, x + 10, y + 56, 3);
    txt(ctx, it.val, x + 40, y + 55, it.col, { size: 2 });
    txt(ctx, it.name, x + 40, y + 73, C.bone);
    txt(ctx, it.desc, x + 10, y + 86, C.ink);
  }

  function drawPlayerInfo(ctx) {
    var x = PX - 52, y = 88, run = DD.run, low = run.hp / run.hpMax < 0.3;
    veil(ctx, x - 2, y - 2, 108, 26, 0.5);
    hpBar(ctx, x, y, 104, 12, S.pl.shown / run.hpMax, low ? C.bloodHi : C.blood, run.hp + '/' + run.hpMax);
    statusRow(ctx, x + 1, y + 15, 'pl');
  }

  function pileIcon(ctx, x, y, col) {           // carta boca abajo en miniatura
    rect(ctx, C.bg, x, y, 7, 8); rect(ctx, col, x + 1, y + 1, 5, 6); rect(ctx, C.panelHi, x + 2, y + 2, 3, 4);
  }

  function drawPiles(ctx) {
    var x = 6, y = 150;
    veil(ctx, x, y, 94, 50, 0.6);
    rect(ctx, C.line, x, y, 94, 1); rect(ctx, C.line, x, y + 49, 94, 1); rect(ctx, C.line, x, y, 1, 50); rect(ctx, C.line, x + 93, y, 1, 50);
    var glow = S.pl.energyFlash, ecol = S.pl.energy > 0 ? mix(C.ether, '#ffffff', glow) : C.dim, st = Body.stats(DD.run.body);
    icon(ctx, 'i_energy', x + 6, y + 7, 2);
    txt(ctx, String(S.pl.energy), x + 28, y + 5, ecol, { size: 3 });
    txt(ctx, '/' + st.energy, x + (S.pl.energy > 9 ? 64 : 46), y + 15, C.dim, { size: 2 });
    pileIcon(ctx, x + 6, y + 31, C.brass); pileIcon(ctx, x + 6, y + 40, C.brassDk);
    txt(ctx, 'Mazo ' + S.draw.length, x + 17, y + 32, C.bone);
    txt(ctx, 'Descarte ' + S.disc.length, x + 17, y + 41, C.bone);
  }

  function drawMsgs(ctx) {
    var y = 39;
    S.msgs.forEach(function (m) {
      var a = Math.max(0, Math.min(1, m.t * 10, (m.life - m.t) * 2.5)), size = m.h.length * 12 <= 380 ? 2 : 1;
      var w = Math.max(DD.textWidth(m.h, size), DD.textWidth(m.s, 1)) + 14, h = (size === 2 ? 27 : 19);
      ctx.globalAlpha = a;
      veil(ctx, 204 - w / 2, y - 3, w, h, 0.62 * a);
      ctx.globalAlpha = a;
      txt(ctx, m.h, 204, y, m.col, { size: size, align: 'center' });
      if (m.s) txt(ctx, m.s, 204, y + (size === 2 ? 17 : 10), C.bone, { align: 'center' });
      y += h + 3;
    });
    ctx.globalAlpha = 1;
  }

  function drawFloats(ctx) {
    S.floats.forEach(function (f) {
      if (f.t < 0) return;
      var a = f.t > 0.6 ? 1 - (f.t - 0.6) / 0.3 : 1, yy = f.y - Math.min(1, f.t * 5) * 14 - f.t * 12;
      ctx.globalAlpha = Math.max(0, a);
      txt(ctx, f.text, f.x, yy, f.color, { size: f.size, align: 'center' });
    });
    ctx.globalAlpha = 1;
    S.parts.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life) * (p.big ? 0.6 : 1);
      rect(ctx, p.c, p.x, p.y, p.big ? 3 : 2, p.big ? 3 : 2);
    });
    ctx.globalAlpha = 1;
  }

  function tipBox(ctx, x, y, w, lines) {           // recuadro de ayuda: lines = [[texto, color], ...]
    var h = lines.length * 9 + 8;
    rect(ctx, C.line, x - 1, y - 1, w + 2, h + 2);
    rect(ctx, C.bg2, x, y, w, h);
    lines.forEach(function (l, i) { txt(ctx, l[0], x + 4, y + 4 + i * 9, l[1] || C.ink); });
  }

  function drawCardTip(ctx, inst) {
    var hi = heatInfo(inst), lines = [], n;
    if (!hi) {
      lines.push(['Muñón (' + slotWord(inst.slot) + ')', C.bone], ['Hueco vacío: sin calor ni desgaste.', C.dim]);
    } else {
      lines.push([hi.limb.name + ' (' + slotWord(inst.slot) + ')', C.bone]);
      lines.push(['Calor ' + hi.h0 + '→' + hi.h1 + '/' + CFG.HEAT_MAX + '  Integridad ' + hi.integ + '/' + hi.max, hi.over ? C.bloodHi : C.ink]);
      if (hi.breaks) lines.push(['¡Se romperá! Pierdes sus cartas.', C.bloodHi]);
      else if (hi.over) lines.push(['¡Sobrecalienta! -' + CFG.OVERHEAT_DMG + ' integ., calor a ' + CFG.OVERHEAT_RESET, C.bloodHi]);
      else if (inst.card.wear > 0) lines.push(['Desgaste: -' + inst.card.wear + ' integridad.', C.copper]);
      else if (hi.h1 >= CFG.HEAT_HOT) lines.push(['Muy caliente: cuidado con el siguiente.', C.heatHi]);
    }
    if (S.armed === inst.uid) lines.push(['Toca otra vez para jugarla.', '#ffffff']);
    n = lines.length;
    tipBox(ctx, 202, 200 - n * 9 - 8, 264, lines);
  }

  function drawStatusTip(ctx) {
    var m = DD.Input.mouse;
    for (var i = 0; i < S.tips.length; i++) {
      var t = S.tips[i];
      if (!DD.ui.hit(t.x, t.y, t.w, t.h)) continue;
      var info = STATUS_TIP[t.key] || DD.STATUS_INFO[t.key];
      if (!info) return;
      var lines = [[info.name, C.bone]];
      DD.wrap(info.desc, 190, 1).forEach(function (l) { lines.push([l, C.ink]); });
      var w = 204, x = Math.min(640 - w - 4, Math.max(4, m.x - 40)), y = Math.min(200 - lines.length * 9 - 8, m.y + 12);
      tipBox(ctx, x, y, w, lines);
      return;
    }
  }

  function drawHand(ctx, st) {
    var n = S.hand.length, g = handGeom(n), i, selI = S.phase === 'player' && S.sel < n ? S.sel : -1;
    for (i = 0; i < n; i++) {
      if (i === selI) continue;
      var c = S.hand[i];
      drawCard(ctx, c, Math.round(c.x), HAND_Y + Math.round(c.dy), g.w, false, st);
    }
    if (selI >= 0) drawCard(ctx, S.hand[selI], Math.round(S.hand[selI].x), HAND_Y + Math.round(S.hand[selI].dy), g.w, true, st);
  }

  function drawTurnControls(ctx) {
    var ep = S.phase === 'enemy', canEnd = S.phase === 'player';
    var stuck = canEnd && !S.hand.some(function (c) { return c.card.cost <= S.pl.energy; }) && Math.floor(DD.time * 3) % 2 === 0;
    DD.ui.button(ctx, END_BTN.x, END_BTN.y, END_BTN.w, END_BTN.h, 'Terminar\nturno (E)', { disabled: !canEnd, selected: canEnd && S.sel === S.hand.length, color: stuck ? C.heatHi : (canEnd ? C.brass : undefined) });
    var label = ep ? 'Turno enemigo' : (S.phase === 'player' ? 'Tu turno ' + S.turn : '');
    if (label) {
      veil(ctx, 320 - DD.textWidth(label, 1) / 2 - 6, 26, DD.textWidth(label, 1) + 12, 12, 0.6);
      txt(ctx, label, 320, 28, ep ? C.bloodHi : C.brass, { align: 'center' });
    }
  }

  function draw(ctx) {
    if (!S) return;
    var SP = DD.Sprites, run = DD.run, body = run.body, st = Body.stats(body), heat = {}, fr = Math.floor(DD.time * 4) & 3, i;
    if (SP && SP.backdrop) SP.backdrop(ctx, 'combat', DD.time);
    ctx.globalAlpha = 0.72; rect(ctx, C.bg, 0, HAND_Y - 10, 640, 123); ctx.globalAlpha = 1;
    S.tips = [];
    // luchadores
    DD.SLOTS.forEach(function (s) { heat[s] = Math.min(1, body.slots[s].heat / CFG.HEAT_MAX); });
    if (SP && SP.drawPlayerBig) SP.drawPlayerBig(ctx, body, Math.round(PX + S.pp.dx), FLOOR_Y, { frame: fr, pose: S.pp.pose, flash: S.pp.flash, heat: heat });
    if (SP && SP.drawEnemyBig) {
      var dead = S.ep.pose === 'dead', fade = dead ? DD.clamp(1 - (S.clock - S.ep.dieT - 0.3) / 0.5, 0, 1) : 1;
      SP.drawEnemyBig(ctx, S.entity.id, Math.round(EX + S.ep.dx), FLOOR_Y, { frame: fr, pose: S.ep.pose, flash: S.ep.flash, alpha: fade });
    }
    drawEnemyPanel(ctx);
    drawPlayerInfo(ctx);
    drawPiles(ctx);
    drawTurnControls(ctx);
    drawFloats(ctx);
    drawHand(ctx, st);
    for (i = 0; i < S.ghosts.length; i++) drawGhost(ctx, S.ghosts[i]);
    var sel = S.phase === 'player' && S.sel >= 0 && S.sel < S.hand.length ? S.hand[S.sel] : null;
    if (sel) drawCardTip(ctx, sel);
    else if (S.phase === 'player' && S.turn <= 2) txt(ctx, 'Clic/toque o 1-8: jugar · E: terminar', 330, 190, C.dim, { align: 'center' });
    if (S.note) {                                 // avisos junto a la energía y las pilas
      var nw = DD.textWidth(S.note.text, 1) + 10;
      veil(ctx, 53 - nw / 2, 136, nw, 12, 0.75);
      txt(ctx, S.note.text, 53, 138, S.note.text === 'Sin energía' ? C.bloodHi : C.warn, { align: 'center' });
    }
    drawMsgs(ctx);
    drawStatusTip(ctx);
  }

  /* ---------- escena ---------- */
  function mkPose() { return { pose: 'idle', until: 0, t0: 0, dur: 0, dx: 0, flash: 0, dieT: 0 }; }

  function enter(params) {
    S = null;
    if (!DD.run || !DD.run.body || !params || !params.enemy) return;
    if (DD.Sprites && DD.Sprites.setTheme) DD.Sprites.setTheme(DD.run.floor);
    var entity = params.enemy, def = DD.ENEMIES[entity.id] || DD.ENEMIES.sabueso;
    var hp = DD.randInt(DD.rng, def.hp[0], def.hp[1]);
    S = {
      entity: entity, def: def, over: false, phase: 'player', turn: 0, clock: 0, lock: 0, q: [], seq: 0, uid: 1,
      buf: null, fast: false, sel: 0, hover: false, armed: null, playing: null,
      en: { hp: hp, hpMax: def.hp[1], shown: hp, block: 0, burn: 0, vuln: 0, weak: 0, stun: false, buff: 0, mv: 0 },
      pl: { block: 0, burn: 0, vuln: 0, weak: 0, energy: 0, shown: DD.run.hp, blockFlash: 0, energyFlash: 0 },
      draw: [], hand: [], disc: [], floats: [], parts: [], ghosts: [], msgs: [], tips: [], note: null, deny: null,
      pp: mkPose(), ep: mkPose()
    };
    Body.deck(DD.run.body).forEach(function (d) { S.draw.push(mkInst(d.card, d.slot)); });
    DD.shuffle(DD.rng, S.draw);
    startPlayerTurn();
  }

  DD.scenes.combat = {
    run: true,
    enter: enter,
    update: update,
    draw: draw,
    exit: function () { if (S) { S.over = true; S.q = []; } },
    debug: function () { return S; }                 // solo para verificación externa
  };

  /* =====================================================================
   * COSECHA
   * ===================================================================== */
  var H = null;                                   // estado de la cosecha
  var PANEL_W = 308, PANEL_Y = 43, PANEL_H = 214;
  var CELL_W = 84, CELL_H = 58, STRIP_Y = 260;
  var LEAVE_BTN = { x: 526, y: STRIP_Y, w: 106, h: CELL_H };
  var SLOT_SHORT = { head: 'Cabeza', torso: 'Torso', armL: 'Brazo I', armR: 'Brazo D', legL: 'Pierna I', legR: 'Pierna D' };

  function panelX(i) { return H.opts.length === 2 ? (i === 0 ? 8 : 324) : 166; }
  function btnRect(i, which) {                    // which: 0 Injertar, 1 Devorar
    return { x: panelX(i) + 8 + which * 150, y: PANEL_Y + PANEL_H - 27, w: 142, h: 22 };
  }
  function cellRect(slot) { return { x: 8 + DD.SLOTS.indexOf(slot) * (CELL_W + 2), y: STRIP_Y, w: CELL_W, h: CELL_H }; }
  function hCandidates(i) { return DD.TYPE_SLOTS[DD.LIMBS[H.opts[i]].type] || []; }

  // Qué pasa en ese hueco al injertar (nombre completo si cabe en una línea de la ficha)
  function slotDesc(slot) {
    var body = DD.run.body, l = Body.limbAt(body, slot), s = body.slots[slot];
    if (!l) return slotWord(slot) + ': muñón, se rellena sin pérdida.';
    var tail = ' (' + s.integ + '/' + l.integ + ').', full = slotWord(slot) + ': pierdes ' + l.name + tail;
    return full.length <= 47 ? full : slotWord(slot) + ': pierdes ' + limbShort(l.name, 14) + tail;
  }

  var STAT_NAMES = [['hpMax', 'Vida máx.', 1], ['energy', 'Energía', 1], ['hand', 'Mano', 1], ['cool', 'Enfriamiento', 1],
    ['dmg', 'Daño', 1], ['block', 'Bloqueo', 1], ['vision', 'Visión', 1], ['speed', 'Velocidad', 100, '%'], ['fireRes', 'Res. fuego', 100, '%']];
  // «Vida máx. +3, Daño +1»: cómo cambian tus estadísticas al injertar limbId en slot
  function statDiff(slot, limbId) {
    var b2 = JSON.parse(JSON.stringify(DD.run.body)), a = Body.stats(DD.run.body), out = '', more = false;
    try { Body.graft(b2, slot, limbId, CFG.GRAFT_FRAC); } catch (e) { return ''; }
    var b = Body.stats(b2);
    STAT_NAMES.forEach(function (n) {
      var d = Math.round((b[n[0]] - a[n[0]]) * n[2]), piece = n[1] + ' ' + (d > 0 ? '+' : '') + d + (n[3] || '');
      if (!d) return;
      if ((out + ', ' + piece).length > 40) more = true;
      else out += (out ? ', ' : '') + piece;
    });
    return out ? out + (more ? '…' : '') : 'sin cambios en tus estadísticas';
  }

  function hEnter(params) {
    H = null;
    if (!DD.run || !DD.run.body) return;
    if (DD.Sprites && DD.Sprites.setTheme) DD.Sprites.setTheme(DD.run.floor);
    var opts = ((params && params.options) || []).filter(function (id) { return !!DD.LIMBS[id]; }).slice(0, 2);
    H = { opts: opts, label: (params && params.label) || 'Extremidad', col: 0, row: 0, mode: 'choose',
      slotOpt: 0, slotIdx: 0, t: 0, done: null, leave: !opts.length };
  }

  function hFinish(text, col, slot) {
    H.done = { t: 0, text: text, col: col, slot: slot };
    H.mode = 'done';
  }
  function doGraft(i, slot) {
    var id = H.opts[i];
    try { Body.graft(DD.run.body, slot, id, CFG.GRAFT_FRAC); } catch (e) { DD.reportError(e); return; }
    DD.Run.discover(id);
    DD.run.grafts++;
    DD.Run.refreshStats();
    sfx('graft'); DD.fx.flash(C.acid, 0.3, 0.25);
    hFinish('¡Injertado!', C.acid, slot);
  }
  function doDevour() {
    DD.Run.heal(CFG.DEVOUR_HEAL);
    Body.coolAll(DD.run.body, CFG.DEVOUR_COOL);
    sfx('devour'); DD.fx.flash(C.blood, 0.3, 0.25);
    hFinish('¡Devorado! +' + CFG.DEVOUR_HEAL + ' PV', C.bloodHi, null);
  }
  function doLeave() { H.mode = 'gone'; sfx('uiBack'); DD.Run.backToExplore(); }

  // Injertar: con un solo hueco es directo; con dos se elige (por defecto, el muñón: no se pierde nada)
  function pickGraft(i) {
    var cand = hCandidates(i);
    if (cand.length === 1) { doGraft(i, cand[0]); return; }
    H.mode = 'slot'; H.slotOpt = i; H.slotIdx = 0; sfx('ui');
    for (var k = 0; k < cand.length; k++) if (!Body.limbAt(DD.run.body, cand[k])) { H.slotIdx = k; break; }
  }

  function hitRect(r) { return DD.ui.hit(r.x, r.y, r.w, r.h); }

  function updateSlotMode() {
    var In = DD.Input, m = In.mouse, cand = hCandidates(H.slotOpt), k;
    if (In.pressed('left')) { H.slotIdx = (H.slotIdx + cand.length - 1) % cand.length; sfx('ui', 0.5); }
    if (In.pressed('right')) { H.slotIdx = (H.slotIdx + 1) % cand.length; sfx('ui', 0.5); }
    var over = -1;
    for (k = 0; k < cand.length; k++) if (hitRect(cellRect(cand[k]))) over = k;
    if (over >= 0 && m.moved) H.slotIdx = over;
    if (m.clicked && over >= 0) { doGraft(H.slotOpt, cand[over]); return; }
    if (In.pressed('ok')) { doGraft(H.slotOpt, cand[H.slotIdx]); return; }
    if (In.pressed('back') || (m.clicked && over < 0)) { H.mode = 'choose'; H.row = 0; sfx('uiBack', 0.6); }
  }

  function updateChoose() {
    var In = DD.Input, m = In.mouse, n = H.opts.length, i, k;
    for (i = 0; i < n; i++) for (k = 0; k < 2; k++) {
      if (!hitRect(btnRect(i, k))) continue;
      if (m.moved) { H.col = i; H.row = k; }
      if (m.clicked) { H.col = i; H.row = k; sfx('ui'); if (k === 0) pickGraft(i); else doDevour(); return; }
    }
    if (hitRect(LEAVE_BTN)) {
      if (m.moved) H.row = 2;
      if (m.clicked) { doLeave(); return; }
    }
    if (In.pressed('left')) H.col = Math.max(0, H.col - 1);
    if (In.pressed('right')) H.col = Math.min(n - 1, H.col + 1);
    if (In.pressed('up')) H.row = Math.max(0, H.row - 1);
    if (In.pressed('down')) H.row = Math.min(2, H.row + 1);
    if (In.pressed('ok')) {
      if (H.row === 2) doLeave();
      else if (H.row === 0) pickGraft(H.col);
      else doDevour();
    }
  }

  function hUpdate(dt) {
    if (!H) return;
    if (H.leave) { H.leave = false; H.mode = 'gone'; DD.Run.backToExplore(); return; }
    if (!DD.run || !DD.run.started) return;
    H.t += dt;
    if (H.mode === 'done') {
      H.done.t += dt;
      if (H.done.t > 0.35) { H.mode = 'gone'; DD.Run.backToExplore(); }
    } else if (H.mode === 'slot' && H.t > 0.2) updateSlotMode();
    else if (H.mode === 'choose' && H.t > 0.2) updateChoose();         // un instante de gracia: evita toques sobrantes
  }

  // Celda del cuerpo: extremidad actual con integridad y calor
  function hCell(ctx, slot, focus, dim) {
    var r = cellRect(slot), body = DD.run.body, s = body.slots[slot], l = Body.limbAt(body, slot), x = r.x, y = r.y;
    rect(ctx, focus ? C.heatHi : C.line, x, y, r.w, r.h);
    rect(ctx, l ? C.panel : C.bg, x + 1, y + 1, r.w - 2, r.h - 2);
    if (dim) ctx.globalAlpha = 0.4;
    limbIcon(ctx, l ? l.id : null, slot, x + 3, y + 3, 1);
    txt(ctx, SLOT_SHORT[slot], x + 22, y + 4, C.bone);
    txt(ctx, l ? limbShort(l.name, 10) : 'MUÑÓN', x + 22, y + 14, l ? C.dim : C.blood);
    if (l) {
      var inf = DD.clamp(s.integ / l.integ, 0, 1), hf = DD.clamp(s.heat / CFG.HEAT_MAX, 0, 1);
      icon(ctx, 'i_limb', x + 3, y + 29);
      DD.ui.bar(ctx, x + 13, y + 30, 36, 6, inf, integColor(inf));
      txt(ctx, s.integ + '/' + l.integ, x + 52, y + 29, C.ink);
      icon(ctx, 'i_heat', x + 3, y + 43);
      DD.ui.bar(ctx, x + 13, y + 44, 36, 6, hf, heatColor(hf));
      txt(ctx, String(s.heat), x + 52, y + 43, hf >= 0.7 ? C.heatHi : C.ink);
    }
    ctx.globalAlpha = 1;
  }

  // Ficha de una extremidad caída
  function hFicha(ctx, i) {
    var id = H.opts[i], l = DD.LIMBS[id], x = panelX(i), y = PANEL_Y, w = PANEL_W, cx = x + 8, j;
    DD.ui.panel(ctx, x, y, w, PANEL_H, { title: l.name });
    rect(ctx, C.line, cx, y + 23, 52, 52); rect(ctx, C.bg, cx + 1, y + 24, 50, 50);
    limbIcon(ctx, id, null, cx + 2, y + 25, 3);
    var tx = cx + 60, ps = DD.passiveText(l.passive);
    txt(ctx, DD.TYPE_NAME[l.type] + ' · Nivel ' + l.tier, tx, y + 26, C.bone);
    txt(ctx, 'Integridad máx. ' + l.integ, tx, y + 36, C.integ);
    if (!ps.length) txt(ctx, 'Sin pasivas', tx, y + 48, C.dim);
    for (j = 0; j < ps.length && j < 3; j++) txt(ctx, ps[j], tx, y + 48 + j * 9, C.acid);
    if (!DD.save.blueprints[id]) txt(ctx, '¡Plano nuevo!', x + w - 10, y + 26, C.warn, { align: 'right' });
    rect(ctx, C.line, x + 8, y + 78, w - 16, 1);
    for (j = 0; j < 3; j++) {                       // las tres cartas
      var cd = DD.CARDS[l.cards[j]], yy = y + 82 + j * 24;
      if (!cd) continue;
      rect(ctx, C.bg, cx, yy, 17, 11); rect(ctx, C.steelDk, cx + 1, yy + 1, 15, 9);
      icon(ctx, 'i_energy', cx + 1, yy + 1);
      txt(ctx, String(cd.cost), cx + 11, yy + 2, C.ink, { shadow: null });
      txt(ctx, cd.name, cx + 22, yy + 2, C.brass);
      txt(ctx, 'Calor ' + cd.heat + (cd.wear ? '  Desg. ' + cd.wear : ''), x + w - 10, yy + 2, cd.heat >= 40 ? C.heatHi : C.heat, { align: 'right' });
      txt(ctx, DD.cardText(cd), cx + 22, yy + 12, C.ink);
    }
    rect(ctx, C.line, x + 8, y + 154, w - 16, 1);
    var cand = hCandidates(i), body = DD.run.body;              // dónde se injerta y qué se pierde
    if (cand.length === 1) {
      txt(ctx, slotDesc(cand[0]), cx, y + 158, Body.limbAt(body, cand[0]) ? C.warn : C.acid);
      txt(ctx, 'Cambios: ' + statDiff(cand[0], id), cx, y + 167, C.ink);
    } else {
      cand.forEach(function (s, q) { txt(ctx, slotDesc(s), cx, y + 158 + q * 9, Body.limbAt(body, s) ? C.warn : C.acid); });
    }
    txt(ctx, 'Devorar: +' + CFG.DEVOUR_HEAL + ' PV y -' + CFG.DEVOUR_COOL + ' calor a todas.', cx, y + 176, C.dim);
  }

  function hDraw(ctx) {
    if (!H) return;
    var SP = DD.Sprites, n = H.opts.length, i, k, act = H.mode === 'choose';
    if (SP && SP.backdrop) SP.backdrop(ctx, 'harvest', DD.time);
    veil(ctx, 0, 24, 640, 296, 0.6);
    txt(ctx, 'COSECHA · ' + H.label, 8, 30, C.brass);
    txt(ctx, n > 1 ? 'Solo puedes quedarte con UNA.' : 'Injerta, devora o deja.', 632, 30, C.ink, { align: 'right' });
    for (i = 0; i < n; i++) {
      hFicha(ctx, i);
      for (k = 0; k < 2; k++) {
        var b = btnRect(i, k), two = DD.TYPE_SLOTS[DD.LIMBS[H.opts[i]].type].length === 2;
        DD.ui.button(ctx, b.x, b.y, b.w, b.h, k === 0 ? (two ? 'Injertar (hueco)' : 'Injertar') : 'Devorar',
          { disabled: !act, selected: act && H.col === i && H.row === k, color: k === 1 ? C.bloodHi : undefined });
      }
    }
    var slotMode = H.mode === 'slot', cand = slotMode ? hCandidates(H.slotOpt) : [];
    DD.SLOTS.forEach(function (s) {                 // tu cuerpo
      var isC = cand.indexOf(s) >= 0;
      hCell(ctx, s, (isC && cand[H.slotIdx] === s) || (H.done && H.done.slot === s), slotMode && !isC);
    });
    DD.ui.button(ctx, LEAVE_BTN.x, LEAVE_BTN.y, LEAVE_BTN.w, LEAVE_BTN.h, 'Dejar\n(seguir)', { disabled: !act, selected: act && H.row === 2 });
    if (slotMode) {                                 // aviso sobre los botones (desactivados): qué hueco y qué se pierde
      var cs = cand[H.slotIdx], id = H.opts[H.slotOpt], by = PANEL_Y + PANEL_H - 66;
      rect(ctx, C.bg2, 0, by - 4, 640, 54);
      rect(ctx, C.brass, 0, by - 4, 640, 1); rect(ctx, C.brass, 0, by + 49, 640, 1);
      txt(ctx, 'Injertar ' + DD.LIMBS[id].name + ' en ' + slotWord(cs), 320, by + 2, C.heatHi, { align: 'center' });
      txt(ctx, slotDesc(cs), 320, by + 13, Body.limbAt(DD.run.body, cs) ? C.warn : C.acid, { align: 'center' });
      txt(ctx, 'Cambios: ' + statDiff(cs, id), 320, by + 24, C.ink, { align: 'center' });
      txt(ctx, '←/→ o toca un hueco · Enter: injertar · Atrás: cancelar', 320, by + 36, C.dim, { align: 'center' });
    }
    if (H.done) {
      ctx.globalAlpha = Math.max(0, Math.min(1, (0.35 - H.done.t) * 6));
      txt(ctx, H.done.text, 320, 120, H.done.col, { size: 3, align: 'center' });
      ctx.globalAlpha = 1;
    }
  }

  DD.scenes.harvest = {
    run: true,
    enter: hEnter,
    update: hUpdate,
    draw: hDraw,
    exit: function () { if (H) H.mode = 'gone'; },
    debug: function () { return H; }
  };
})();
