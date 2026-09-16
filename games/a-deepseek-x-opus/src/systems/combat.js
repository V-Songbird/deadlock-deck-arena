/* DD.Combat — turn-based fights. The body is the deck: cards carry a socket,
 * and paying for a card heats that socket until the limb cooks or breaks.
 * Everything reads the encounter at DD.Run.state.encounter. */
(function () {
  'use strict';
  var DD = window.DD;

  var Combat = DD.Combat = DD.Combat || {};
  Combat.target = 0;                 /* index of the selected enemy (mirrors state.target) */

  var BASE_ENERGY = 3;
  var OPENING_HAND = 5;
  var PER_TURN_DRAW = 5;
  var FX_DUR = 0.7;
  var HEAT_UNIT = 25;
  var FLEE_BASE = 0.5;
  var FLEE_PER_STUMP = 0.1;
  var FLEE_HP_COST = 15;
  var ENEMY_HP_PER_FLOOR = 0.08;
  var REVIVE_HP = 0.4;               /* share of maxHp a reviving enemy comes back with */

  /* Verbs that aim at an enemy unless flagged all:true, and verbs scaled by heat. */
  var TARGET_VERBS = { damage: 1, bleed: 1, weak: 1, vulnerable: 1, poison: 1, stun: 1 };
  var HEAT_VERBS = { damagePerHeat: 1, gainBlockPerHeat: 1 };

  /* ---------------------------------------------------------------- plumbing */
  function runState() { return (DD.Run && DD.Run.state) || null; }
  function enc() { var s = runState(); return (s && s.encounter) || null; }
  function cardById(id) { var by = DD.Data && DD.Data.cardById; return (by && by[id]) || null; }
  function enemyById(id) { var by = DD.Data && DD.Data.enemyById; return (by && by[id]) || null; }
  function rnd() { return Math.random(); }
  function sfx(name) { if (DD.Audio && DD.Audio.sfx && DD.Audio.sfx.play) DD.Audio.sfx.play(name); }
  function say(text) {
    var e = enc();
    if (e) { e.log.unshift(text); if (e.log.length > 6) e.log.pop(); }
    if (DD.Run && DD.Run.say) DD.Run.say(text);
  }
  function totals() {
    var s = runState();
    return (DD.Body && s && s.body) ? DD.Body.passiveTotals(s.body) : {};
  }
  function missingCount() {
    var s = runState();
    return (DD.Body && s && s.body) ? DD.Body.missingCount(s.body) : 0;
  }
  function heatUnits(socket) {
    return (DD.Heat && DD.Heat.units) ? DD.Heat.units(socket) : 0;
  }
  function hasVerb(def, key) {
    var list = (def && def.effects) || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].k === key) return true;
    return false;
  }
  function needsTarget(def) {
    var list = (def && def.effects) || [];
    for (var i = 0; i < list.length; i++) {
      var ef = list[i];
      if (ef && ef.all !== true && TARGET_VERBS[ef.k]) return true;
    }
    return false;
  }
  function heatScaled(def) {
    var list = (def && def.effects) || [];
    for (var i = 0; i < list.length; i++) if (list[i] && HEAT_VERBS[list[i].k]) return true;
    return false;
  }

  /* Arena anchors. The combat view may reuse these so floaters line up. */
  Combat.enemySlot = function (i) { return { x: 356 + (i % 3) * 88, y: 112 + (i % 3) * 8 }; };
  Combat.playerSlot = function () { return { x: 132, y: 182 }; };

  /* Floating numbers for the view: {kind, v, t, dur, x, y, target}. */
  function fx(e, kind, v, pos, target) {
    if (!e || !(v > 0)) return;
    e.fx.push({
      kind: kind, v: Math.round(v), t: 0, dur: FX_DUR,
      x: pos.x + (rnd() * 12 - 6), y: pos.y, target: target
    });
  }

  /* ------------------------------------------------------------------ start */
  function makeEnemy(def, i, floor) {
    var hp = Math.max(1, Math.round((def.hp || 10) * (1 + floor * ENEMY_HP_PER_FLOOR)));
    return {
      i: i,
      id: def.id,
      name: def.name || def.id,
      hp: hp,
      maxHp: hp,
      block: 0,
      sprite: def.sprite || ('enemy_' + def.id),
      intents: def.intents || [],
      intent: null,
      status: {},
      dead: false,
      anim: { shake: 0, lunge: 0, death: 0 },
      heatAttack: def.heatAttack || 0,
      drops: def.drops || [],
      tier: def.tier || 1,
      boss: !!def.boss,
      cycle: 0,
      usedRevive: false
    };
  }

  function intentList(en) {
    var def = enemyById(en.id);
    return (def && def.intents) || en.intents || [];
  }

  /* Uniform pick. A revive intent is a death trigger, never a turn action,
   * so it stays out of the pool. */
  function pickIntent(en) {
    var list = intentList(en);
    if (!list.length) return { type: 'attack', v: 4, text: 'Ataca' };
    var def = enemyById(en.id);
    if (def && def.intentPattern === 'cycle') {
      var it = list[(en.cycle || 0) % list.length];
      en.cycle = (en.cycle || 0) + 1;
      return it;
    }
    var pool = [], i;
    for (i = 0; i < list.length; i++) if (list[i] && !list[i].revive) pool.push(list[i]);
    if (!pool.length) return { type: 'attack', v: 4, text: 'Ataca' };
    return pool[Math.floor(rnd() * pool.length)];
  }

  Combat.start = function (spec) {
    var s = runState();
    if (!s) return null;
    spec = spec || {};
    var t = totals();
    var deck = DD.Deck ? DD.Deck.build(s.body) : [];
    DD.rng().shuffle(deck);

    var e = {
      turn: 1,
      energy: BASE_ENERGY + (t.energyBonus || 0),
      maxEnergy: BASE_ENERGY + (t.energyBonus || 0),
      block: 0,
      hand: [],
      drawPile: deck,
      discardPile: [],
      exhaustPile: [],
      enemies: [],
      target: 0,
      over: false,
      result: null,
      log: [],
      fx: [],
      player: { shake: 0, lunge: 0, status: {} },
      scavenge: false
    };

    var list = spec.enemies || [];
    for (var i = 0; i < list.length; i++) {
      var def = enemyById(list[i]);
      if (!def) continue;
      e.enemies.push(makeEnemy(def, e.enemies.length, spec.floor || 0));
      if (DD.Progress) DD.Progress.discoverEnemy(def.id);
    }
    for (i = 0; i < e.enemies.length; i++) e.enemies[i].intent = pickIntent(e.enemies[i]);

    s.encounter = e;
    s.status = 'combat';
    Combat.target = 0;

    if (!e.enemies.length) {
      e.over = true;
      e.result = 'win';
      say(DD.t('No hay nada contra lo que luchar.'));
      return e;
    }
    draw(e, OPENING_HAND + (t.openingDraw || 0));
    sfx('growl');
    say(DD.t('¡Comienza el combate! ') + DD.plural(e.enemies.length, DD.t('enemigo'), DD.t('enemigos')) + '.');
    return e;
  };

  /* -------------------------------------------------------------- targeting */
  function firstAlive(e) {
    for (var i = 0; i < e.enemies.length; i++) if (!e.enemies[i].dead) return e.enemies[i];
    return null;
  }

  function retarget(e) {
    var a = firstAlive(e);
    if (a) { e.target = a.i; Combat.target = a.i; }
  }

  Combat.selectTarget = function (i) {
    var e = enc();
    if (!e) return;
    i = i | 0;
    if (i < 0 || i >= e.enemies.length || e.enemies[i].dead) return;
    e.target = i;
    Combat.target = i;
  };

  /* ------------------------------------------------------------------- draw */
  function draw(e, n) {
    if (!e || !(n > 0)) return;
    var limit = DD.HAND_LIMIT || 8;
    for (var k = 0; k < n; k++) {
      if (e.hand.length >= limit) break;
      if (!e.drawPile.length) {
        if (!e.discardPile.length) break;
        e.drawPile = e.discardPile.slice();
        e.discardPile = [];
        DD.rng().shuffle(e.drawPile);
      }
      var card = e.drawPile.pop();
      if (card) e.hand.push(card);
    }
    sfx('draw');
  }

  /* ----------------------------------------------------------------- damage */
  function addStatus(map, key, v) {
    if (!map || !key || !(v > 0)) return;
    map[key] = (map[key] || 0) + v;
  }

  /* lifesteal and bleedOnHit fire on every point of damage the player deals. */
  function playerOnHit(en) {
    var t = totals();
    if (t.lifesteal) healPlayer(enc(), t.lifesteal);
    if (t.bleedOnHit) addStatus(en.status, 'bleed', t.bleedOnHit);
  }

  function dealToEnemy(e, en, base, cardName) {
    if (!e || !en || en.dead || !(base > 0)) return 0;
    var t = totals();
    var dmg = base;
    if ((e.player.status.weak || 0) > 0) dmg *= 0.75;
    if (e.turn === 1) dmg += t.firstStrike || 0;
    if ((en.status.vulnerable || 0) > 0) dmg *= 1.5;
    dmg = Math.floor(dmg);
    if (dmg <= 0) return 0;

    var blocked = Math.min(en.block || 0, dmg);
    en.block = Math.max(0, (en.block || 0) - blocked);
    var through = dmg - blocked;
    en.hp = Math.max(0, en.hp - through);
    en.anim.shake = 0.28;
    fx(e, 'damage', through, Combat.enemySlot(en.i), en.i);
    if (blocked > 0) fx(e, 'block', blocked, Combat.enemySlot(en.i), en.i);
    if (cardName && through > 0) say(cardName + DD.t(' inflige ') + through + DD.t(' a ') + en.name + '.');

    var s = runState();
    if (s && s.stats) s.stats.damage = (s.stats.damage || 0) + through;
    playerOnHit(en);
    killIfDead(e, en);
    return through;
  }

  /* The revenant's revive intent gives it one second wind, once. */
  function tryRevive(e, en) {
    if (en.usedRevive) return false;
    var list = intentList(en), i;
    for (i = 0; i < list.length; i++) if (list[i] && list[i].revive) break;
    if (i >= list.length) return false;
    en.usedRevive = true;
    en.hp = Math.max(1, Math.round(en.maxHp * REVIVE_HP));
    en.anim.shake = 0.3;
    sfx('graft');
    say(DD.t('¡') + en.name + DD.t(' se levanta de nuevo!'));
    fx(e, 'heal', en.hp, Combat.enemySlot(en.i), en.i);
    return true;
  }

  function killIfDead(e, en) {
    if (!en || en.dead || en.hp > 0) return;
    if (tryRevive(e, en)) return;
    en.hp = 0;
    en.dead = true;
    en.block = 0;
    en.anim.death = 0.4;
    sfx('death');
    say(en.name + DD.t(' cae desplomado.'));
    if (e.target === en.i) retarget(e);
    checkWin(e);
  }

  function damagePlayer(e, n) {
    if (!e || !(n > 0)) return 0;
    var dmg = n;
    if ((e.player.status.vulnerable || 0) > 0) dmg *= 1.5;
    dmg = Math.floor(dmg);
    if (dmg <= 0) return 0;
    var through = DD.Run && DD.Run.damage ? DD.Run.damage(dmg) : 0;
    e.player.shake = 0.28;
    fx(e, 'damage', through, Combat.playerSlot(), 'player');
    var s = runState();
    if (s && s.hp <= 0) lose(e);
    return through;
  }

  /* Direct HP loss: bleed, poison, a failed escape. Block does not help. */
  function loseHp(n) {
    var s = runState();
    if (!s || !(n > 0)) return 0;
    var before = s.hp;
    s.hp = DD.clamp(s.hp - n, 0, s.maxHp);
    if (s.hp <= 0 && DD.Run.die) DD.Run.die();
    return before - s.hp;
  }

  function healPlayer(e, v) {
    if (!e || !(v > 0)) return 0;
    var got = DD.Run && DD.Run.heal ? DD.Run.heal(v) : 0;
    if (got > 0) fx(e, 'heal', got, Combat.playerSlot(), 'player');
    return got;
  }

  /* -------------------------------------------------------------- card verbs */
  function blockAmount(v) {
    var e = enc();
    var out = v;
    if (e && (e.player.status.frail || 0) > 0) out *= 0.75;
    return Math.max(0, Math.floor(out) + (totals().blockBonus || 0));
  }

  function gainBlock(e, v) {
    if (!e || !(v > 0)) return 0;
    e.block = (e.block || 0) + v;
    fx(e, 'block', v, Combat.playerSlot(), 'player');
    return v;
  }

  function damageVerb(e, tgt, v, all, cardName) {
    if (!(v > 0)) return 0;
    var total = 0, i;
    if (all) {
      for (i = 0; i < e.enemies.length; i++) {
        if (!e.enemies[i].dead) total += dealToEnemy(e, e.enemies[i], v, cardName);
      }
    } else if (tgt && !tgt.dead) {
      total = dealToEnemy(e, tgt, v, cardName);
    }
    return total;
  }

  function statusVerb(e, tgt, kind, v, all) {
    if (!(v > 0)) return;
    var i;
    if (all) {
      for (i = 0; i < e.enemies.length; i++) {
        if (!e.enemies[i].dead) addStatus(e.enemies[i].status, kind, v);
      }
    } else if (tgt && !tgt.dead) {
      addStatus(tgt.status, kind, v);
    }
  }

  function coolSocket(socket, v) {
    var s = runState();
    if (!s || !s.body || !DD.Body || !socket || !(v > 0)) return;
    DD.Body.addHeat(s.body, socket, -v);
  }

  function restoreIntegrity(e, socket, v) {
    var s = runState();
    if (!s || !s.body || !DD.Body || !socket || !(v > 0)) return;
    if (DD.Body.isStump(s.body, socket)) return;
    var limb = DD.Body.limbOf(s.body, socket);
    var max = (limb && limb.integrity) || 0;
    if (max <= 0) return;
    var cur = s.body.integrity[socket] || 0;
    var next = Math.min(max, cur + v);
    s.body.integrity[socket] = next;
    if (next > cur) fx(e, 'heal', next - cur, Combat.playerSlot(), 'player');
  }

  function discardRandom(e, v) {
    for (var n = 0; n < v; n++) {
      if (!e.hand.length) return;
      var i = Math.floor(rnd() * e.hand.length);
      e.discardPile.push(e.hand[i]);
      e.hand.splice(i, 1);
    }
  }

  function applyEffects(e, card, def, tgt) {
    var list = def.effects || [];
    var s = runState();
    for (var i = 0; i < list.length; i++) {
      var ef = list[i];
      if (!ef) continue;
      var v = ef.v || 0;
      var socket = ef.socket || card.socket;
      switch (ef.k) {
        case 'damage': damageVerb(e, tgt, v, ef.all, def.name); break;
        case 'block': gainBlock(e, blockAmount(v)); break;
        case 'draw': draw(e, v); break;
        case 'energy': e.energy += v; break;
        case 'heal': healPlayer(e, v); break;
        case 'heat':
          if (DD.Heat && socket) DD.Heat.add(socket, v);
          if (socket && DD.Body && s.body && !DD.Body.isStump(s.body, socket)) {
            fx(e, 'heat', v, Combat.playerSlot(), 'player');
          }
          break;
        case 'cool': coolSocket(socket, v); break;
        case 'integrity': restoreIntegrity(e, socket, v); break;
        case 'bleed': case 'weak': case 'vulnerable': case 'poison': case 'stun':
          statusVerb(e, tgt, ef.k, v, ef.all); break;
        case 'frail': addStatus(e.player.status, 'frail', v); break;
        case 'selfDamage': damagePlayer(e, v); break;
        case 'lifesteal': healPlayer(e, v); break;
        case 'residue': if (s) s.residue = (s.residue || 0) + v; break;
        case 'discardRandom': discardRandom(e, v); break;
        case 'exhaustSelf': break;                       /* handled by playCard */
        case 'gainBlockPerHeat': gainBlock(e, blockAmount(v * heatUnits(socket))); break;
        case 'damagePerHeat': damageVerb(e, tgt, v * heatUnits(socket), ef.all, def.name); break;
        case 'damagePerMissingLimb': damageVerb(e, tgt, v * missingCount(), ef.all, def.name); break;
        case 'scavenge': e.scavenge = true; break;
        default: break;
      }
    }
  }

  /* -------------------------------------------------------------- playCard */
  Combat.playCard = function (index) {
    var e = enc();
    var s = runState();
    if (!e || e.over || !s) return { ok: false, reason: 'target' };
    index = index | 0;
    var card = e.hand[index];
    if (!card) return { ok: false, reason: 'target' };
    var def = cardById(card.id) || { id: card.id, name: card.id, cost: 0, heat: 0, effects: [] };
    if (e.energy < (def.cost || 0)) return { ok: false, reason: 'energy' };

    var tgt = null;
    if (needsTarget(def)) {
      tgt = firstAlive(e);
      if (!tgt) return { ok: false, reason: 'target' };
      var chosen = e.enemies[e.target];
      tgt = (chosen && !chosen.dead) ? chosen : tgt;
      e.target = tgt.i;
      Combat.target = tgt.i;
    }
    /* A heat-scaled card needs a live socket to channel through. */
    if (heatScaled(def) && (!card.socket || !DD.Body || DD.Body.isStump(s.body, card.socket))) {
      return { ok: false, reason: 'heat' };
    }

    e.hand.splice(index, 1);
    e.energy -= (def.cost || 0);
    if (s.stats) s.stats.played = (s.stats.played || 0) + 1;
    sfx('card_play');
    say(DD.t('Juegas ') + (def.name || card.id) + '.');

    applyEffects(e, card, def, tgt);

    if (hasVerb(def, 'exhaustSelf')) e.exhaustPile.push(card);
    else e.discardPile.push(card);

    /* The card's own heat is paid last, win or lose — a broken socket simply
     * has nowhere to put it. */
    if ((def.heat || 0) > 0) {
      if (DD.Heat && card.socket) DD.Heat.add(card.socket, def.heat);
      if (card.socket && DD.Body && !DD.Body.isStump(s.body, card.socket)) {
        fx(e, 'heat', def.heat, Combat.playerSlot(), 'player');
      }
    }
    return { ok: true };
  };

  /* ---------------------------------------------------------------- endTurn */
  function decay(map) {
    if (!map) return;
    var keys = ['weak', 'vulnerable', 'frail'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!(map[k] > 0)) continue;
      map[k]--;
      if (map[k] <= 0) delete map[k];
    }
  }

  function tickBleedPlayer(e) {
    var s = runState();
    var map = e.player.status;
    if (!(map.bleed > 0)) return;
    var n = map.bleed;
    map.bleed--;
    if (map.bleed <= 0) delete map.bleed;
    loseHp(n);
    e.player.shake = 0.2;
    fx(e, 'damage', n, Combat.playerSlot(), 'player');
    say(DD.t('La hemorragia te cuesta ') + n + DD.t(' de vida.'));
    if (s && s.hp <= 0) lose(e);
  }

  function tickBleedEnemy(e, en) {
    if (!(en.status.bleed > 0)) return;
    var n = en.status.bleed;
    en.status.bleed--;
    if (en.status.bleed <= 0) delete en.status.bleed;
    en.hp = Math.max(0, en.hp - n);
    en.anim.shake = 0.2;
    fx(e, 'damage', n, Combat.enemySlot(en.i), en.i);
    killIfDead(e, en);
  }

  function tickPoisonPlayer(e) {
    var s = runState();
    var map = e.player.status;
    if (!(map.poison > 0)) return;
    var n = map.poison;
    map.poison--;
    if (map.poison <= 0) delete map.poison;
    loseHp(n);
    fx(e, 'damage', n, Combat.playerSlot(), 'player');
    say(DD.t('El veneno te corroe: pierdes ') + n + DD.t(' de vida.'));
    if (s && s.hp <= 0) lose(e);
  }

  function heatAttack(e, en) {
    var amount = en.heatAttack || 0;
    var s = runState();
    if (!(amount > 0) || !DD.Heat || !s || !s.body || !DD.Body) return;
    var list = [], i;
    for (i = 0; i < DD.SOCKETS.length; i++) {
      if (!DD.Body.isStump(s.body, DD.SOCKETS[i])) list.push(DD.SOCKETS[i]);
    }
    if (!list.length) return;
    var socket = list[Math.floor(rnd() * list.length)];
    var before = s.body.heat[socket] || 0;
    DD.Heat.add(socket, amount);
    if ((s.body.heat[socket] || 0) > before) fx(e, 'heat', amount, Combat.playerSlot(), 'player');
  }

  function enemyAct(e, en) {
    var it = en.intent;
    en.anim.lunge = 0.3;
    if (!it) return;
    var v = it.v || 0;
    if (it.type === 'attack') {
      var dmg = v;
      if ((en.status.weak || 0) > 0) dmg *= 0.75;
      dmg = Math.floor(dmg);
      say(en.name + ': ' + (it.text || DD.t('ataca')) + '.');
      sfx(dmg >= 10 ? 'hit_heavy' : 'hit');
      damagePlayer(e, dmg);
      if (e.over) return;
      var th = totals().thorns || 0;          /* thorns reflect melee attacks */
      if (th > 0) {
        dealToEnemy(e, en, th, null);
        if (e.over) return;
      }
      heatAttack(e, en);
    } else if (it.type === 'block') {
      en.block = (en.block || 0) + v;
      fx(e, 'block', v, Combat.enemySlot(en.i), en.i);
      say(en.name + ': ' + (it.text || DD.t('se protege')) + '.');
    } else if (it.type === 'heal') {
      var before = en.hp;
      en.hp = Math.min(en.maxHp, en.hp + v);
      if (en.hp > before) fx(e, 'heal', en.hp - before, Combat.enemySlot(en.i), en.i);
      say(en.name + ': ' + (it.text || DD.t('se regenera')) + '.');
    } else if (it.type === 'debuff') {
      addStatus(e.player.status, it.status, v);
      say(en.name + ': ' + (it.text || DD.t('te maldice')) + '.');
    } else if (it.type === 'buff') {
      /* A "buff" that names a status marks the player (the plague nurse
       * brands the herd); one without a status strengthens the enemy. */
      if (it.status) {
        addStatus(e.player.status, it.status, v);
        say(en.name + ': ' + (it.text || DD.t('te marca')) + '.');
      } else {
        en.block = (en.block || 0) + v;
        fx(e, 'block', v, Combat.enemySlot(en.i), en.i);
        say(en.name + ': ' + (it.text || DD.t('se refuerza')) + '.');
      }
    }
  }

  Combat.endTurn = function () {
    var s = runState();
    var e = enc();
    if (!e || e.over || !s) return;
    var i;

    /* --- end of the player's turn --- */
    tickBleedPlayer(e);
    if (e.over) return;
    var t = totals();
    if (t.regen) healPlayer(e, t.regen);

    while (e.hand.length) e.discardPile.push(e.hand.pop());

    /* --- the enemy phase, in order --- */
    for (i = 0; i < e.enemies.length; i++) {
      var en = e.enemies[i];
      if (en.dead) continue;
      tickBleedEnemy(e, en);
      if (en.dead || e.over) continue;
      if ((en.status.stun || 0) > 0) {
        en.status.stun--;
        if (en.status.stun <= 0) delete en.status.stun;
        say(en.name + DD.t(' está aturdido y no llega a actuar.'));
        continue;
      }
      enemyAct(e, en);
      if (e.over) return;
      decay(en.status);
    }

    /* --- the new player turn --- */
    e.block = 0;
    var t2 = totals();
    e.maxEnergy = BASE_ENERGY + (t2.energyBonus || 0);
    e.energy = e.maxEnergy;
    if (DD.Body && s.body) DD.Body.coolTurn(s.body);
    decay(e.player.status);
    tickPoisonPlayer(e);
    if (e.over) return;
    for (i = 0; i < e.enemies.length; i++) {
      if (!e.enemies[i].dead) e.enemies[i].intent = pickIntent(e.enemies[i]);
    }
    e.turn++;
    draw(e, PER_TURN_DRAW + (totals().drawBonus || 0));
    say(DD.t('Turno ') + e.turn + '.');
  };

  /* ------------------------------------------------------------- outcomes */
  function pickDrop(en) {
    var def = enemyById(en.id);
    var list = (def && def.drops) || en.drops || [];
    if (!list.length) return null;
    return list[Math.floor(rnd() * list.length)];
  }

  function win(e) {
    if (e.over) return;
    var s = runState();
    e.over = true;
    e.result = 'win';
    var reward = 0, drops = [], dead = [], i;

    for (i = 0; i < e.enemies.length; i++) {
      var en = e.enemies[i];
      if (!en.dead) continue;
      dead.push(en);
      if (s && s.stats) s.stats.kills = (s.stats.kills || 0) + 1;
      reward += 3 + (en.tier || 1) * 2;
      if (en.boss) reward += 12;
      var def = enemyById(en.id);
      var chance = (def && def.dropChance) || 0;
      if (en.boss || rnd() < chance) drops.push(pickDrop(en));
    }
    /* scavenge gives one extra limb for the fight; scavengeBonus is a flat chance at one more. */
    if (dead.length) {
      var donor = dead[Math.floor(rnd() * dead.length)];
      if (e.scavenge) drops.push(pickDrop(donor));
      if (rnd() < (totals().scavengeBonus || 0) / 100) drops.push(pickDrop(donor));
    }

    if (s) {
      s.residue = (s.residue || 0) + reward;
      var loot = s.pendingLoot || (s.pendingLoot = []);
      for (i = 0; i < drops.length; i++) if (drops[i]) loot.push(drops[i]);
    }
    sfx('levelup');
    say(DD.t('Victoria. Recoges ') + reward + DD.t(' de residuo.'));
    if (drops.length) say(DD.t('Entre los restos quedan ') + DD.plural(drops.length, DD.t('miembro'), DD.t('miembros')) + '.');
  }

  function lose(e) {
    if (!e || e.over) return;
    e.over = true;
    e.result = 'lose';
    say(DD.t('Tu cuerpo se apaga. El reloj sigue corriendo.'));
    if (DD.Run && DD.Run.die) DD.Run.die();
  }

  function checkWin(e) {
    if (!e || e.over) return false;
    for (var i = 0; i < e.enemies.length; i++) if (!e.enemies[i].dead) return false;
    win(e);
    return true;
  }

  Combat.flee = function () {
    var e = enc();
    if (!e || e.over) return false;
    var s = runState();
    var p = FLEE_BASE + FLEE_PER_STUMP * missingCount();
    if (rnd() < p) {
      e.over = true;
      e.result = 'flee';
      sfx('escape');
      say(DD.t('Escapas cojeando. El reloj no perdona.'));
      return true;
    }
    sfx('hit_heavy');
    say(DD.t('No consigues escapar: pierdes ') + FLEE_HP_COST + DD.t(' de vida.'));
    loseHp(FLEE_HP_COST);
    fx(e, 'damage', FLEE_HP_COST, Combat.playerSlot(), 'player');
    if (s && s.hp <= 0) lose(e);
    return false;
  };

  /* ------------------------------------------------------------------ frame */
  Combat.update = function (dt) {
    var e = enc();
    if (!e) return;
    dt = dt || 0;
    var i;
    for (i = e.fx.length - 1; i >= 0; i--) {
      var f = e.fx[i];
      f.t += dt;
      if (f.t >= f.dur) e.fx.splice(i, 1);
    }
    e.player.shake = Math.max(0, (e.player.shake || 0) - dt);
    e.player.lunge = Math.max(0, (e.player.lunge || 0) - dt);
    for (i = 0; i < e.enemies.length; i++) {
      var a = e.enemies[i].anim;
      if (!a) continue;
      a.shake = Math.max(0, (a.shake || 0) - dt);
      a.lunge = Math.max(0, (a.lunge || 0) - dt);
      a.death = Math.max(0, (a.death || 0) - dt);
    }
  };
})();
