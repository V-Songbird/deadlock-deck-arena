// Deadlock Deck: El Reloj Anatómico — combat rules (PRODUCT.md §5.3).
// Plain browser JavaScript on the global DD namespace: no DOM, no modules.
window.DD = window.DD || {};

(function (DD) {
  'use strict';

  const MAX_LOG = 6;
  const TURN_DRAW = 5;
  const TURN_ENERGY = 3;
  const VULN_MULT = 1.5;   // vulnerable: +50% damage taken
  const WEAK_MULT = 0.67;  // weak: -33% damage dealt

  const SLOT_ES = {
    head: 'cabeza', torso: 'torso', armL: 'brazo izquierdo',
    armR: 'brazo derecho', legL: 'pierna izquierda', legR: 'pierna derecha'
  };
  const STATUS_ES = { bleed: 'Sangrado', vulnerable: 'Vulnerable', weak: 'Débil' };

  // start() receives the rng and CombatState has no field for it, so it lives here.
  // Only one combat runs at a time.
  let rng = Math.random;

  // --- helpers ---------------------------------------------------------------

  function randInt(n) {
    if (n <= 1) return 0;
    const v = Math.floor(rng() * n);
    return v < 0 ? 0 : (v >= n ? n - 1 : v);
  }

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function log(state, line) {
    state.log.push(line);
    while (state.log.length > MAX_LOG) state.log.shift();
  }

  function cardOf(slot) {
    if (!slot) return null;
    return DD.DATA.CARDS[slot.cardId] || null;
  }

  function intentsOf(enemyId) {
    const def = DD.DATA.ENEMIES[enemyId];
    return (def && def.intents) || [];
  }

  // --- deck ------------------------------------------------------------------

  function draw(state, amount, events) {
    let drawn = 0;
    for (let i = 0; i < amount; i++) {
      if (!state.deck.length) {
        if (!state.discard.length) break;      // nothing left anywhere
        state.deck = shuffle(state.discard);   // deck ran out: recycle the discard
        state.discard = [];
      }
      state.hand.push(state.deck.pop());
      drawn += 1;
    }
    if (drawn > 0) {
      events.push({ type: 'draw', amount: drawn });
      log(state, 'Robas ' + drawn + '.');
    }
    return drawn;
  }

  // A broken limb leaves the deck instantly: its cards go from deck, hand and
  // discard, and its stump card takes their place.
  function purgeSlot(state, slotKey) {
    const keep = (s) => s.source !== slotKey;
    state.deck = state.deck.filter(keep);
    state.hand = state.hand.filter(keep);
    state.discard = state.discard.filter(keep);
    const stumpId = DD.DATA.STUMPS[DD.DATA.SLOT_KIND[slotKey]];
    if (stumpId) state.discard.push({ cardId: stumpId, source: null });
  }

  function breakLimb(state, body, slotKey, limbId, events) {
    purgeSlot(state, slotKey);
    if (limbId) events.push({ type: 'break', slot: slotKey, limbId: limbId });
    const def = limbId ? DD.DATA.LIMBS[limbId] : null;
    log(state, (def ? def.name : SLOT_ES[slotKey] || slotKey) + ' se rompe.');
  }

  function heatSlot(state, body, slotKey, amount, events) {
    if (!slotKey || !amount) return;                 // stump cards carry no heat
    if (DD.Body.isStump(body, slotKey)) return;      // already a stump, nothing left to burn
    const limbId = body.slots[slotKey] ? body.slots[slotKey].limbId : null;
    const res = DD.Body.applyHeat(body, slotKey, amount);
    events.push({ type: 'heat', slot: slotKey, amount: amount });
    log(state, 'Calor +' + amount + ' en ' + (SLOT_ES[slotKey] || slotKey) + '.');
    if (res && res.broken) breakLimb(state, body, slotKey, limbId, events);
  }

  // --- damage ----------------------------------------------------------------

  function finish(state, result, events) {
    state.over = true;
    state.result = result;
    events.push({ type: 'end', result: result });
    log(state, result === 'win' ? '¡El enemigo cae!' : 'Tu cuerpo se deshace.');
  }

  function hurtEnemy(state, amount, events) {
    if (state.over) return;
    // Both modifiers multiply, then round down once.
    let dmg = amount;
    if (state.enemy.vulnerable > 0) dmg *= VULN_MULT;
    if (state.weak > 0) dmg *= WEAK_MULT;
    dmg = Math.max(0, Math.floor(dmg));
    if (dmg <= 0) return;
    const absorbed = Math.min(state.enemy.block, dmg);
    if (absorbed > 0) {
      state.enemy.block -= absorbed;
      dmg -= absorbed;
      events.push({ type: 'block', target: 'enemy', amount: absorbed });
      log(state, 'El enemigo bloquea ' + absorbed + '.');
    }
    if (dmg > 0) {
      state.enemy.hp = Math.max(0, state.enemy.hp - dmg);
      events.push({ type: 'damage', target: 'enemy', amount: dmg });
      log(state, dmg + ' de daño al enemigo.');
    }
    if (state.enemy.hp <= 0) finish(state, 'win', events);
  }

  function hurtPlayer(state, body, amount, events) {
    if (state.over) return;
    let dmg = amount;
    if (state.vulnerable > 0) dmg *= VULN_MULT;
    if (state.enemy.weak > 0) dmg *= WEAK_MULT;
    dmg = Math.max(0, Math.floor(dmg));
    if (dmg <= 0) return;
    const absorbed = Math.min(state.block, dmg);
    if (absorbed > 0) {
      state.block -= absorbed;
      dmg -= absorbed;
      events.push({ type: 'block', target: 'player', amount: absorbed });
      log(state, 'Bloqueas ' + absorbed + '.');
    }
    if (dmg > 0) {
      body.hp = Math.max(0, body.hp - dmg);
      events.push({ type: 'damage', target: 'player', amount: dmg });
      log(state, 'Recibes ' + dmg + ' de daño.');
    }
    if (body.hp <= 0) finish(state, 'lose', events);
  }

  // Bleed is a wound: it ignores block.
  function bleedBody(state, body, amount, events) {
    body.hp = Math.max(0, body.hp - amount);
    events.push({ type: 'damage', target: 'player', amount: amount });
    log(state, 'Sangras ' + amount + '.');
    if (body.hp <= 0) finish(state, 'lose', events);
  }

  // --- effects ---------------------------------------------------------------

  function applyEffect(state, body, effect, events) {
    if (!effect) return;
    const amount = effect.amount || 0;

    switch (effect.op) {
      case 'damage':
        hurtEnemy(state, amount, events);
        break;

      case 'block':
        state.block += amount;
        events.push({ type: 'block', target: 'player', amount: amount });
        log(state, 'Ganas ' + amount + ' de bloque.');
        break;

      case 'heal': {
        const before = body.hp;
        // Never lowers hp, even if body.maxHp still carries a bonus the body lost.
        body.hp = Math.max(body.hp, Math.min(DD.Body.maxHp(body), body.hp + amount));
        const healed = body.hp - before;
        if (healed > 0) {
          events.push({ type: 'heal', amount: healed });
          log(state, 'Te coses ' + healed + ' PV.');
        }
        break;
      }

      case 'draw':
        draw(state, amount, events);
        break;

      case 'energy':
        state.energy += amount;
        log(state, 'Energía +' + amount + '.');
        break;

      case 'cool':
        DD.Body.cool(body, amount);
        log(state, 'Se enfría tu carne.');
        break;

      case 'bleed':
      case 'vulnerable':
      case 'weak':
        state.enemy[effect.op] += amount;
        events.push({ type: 'status', name: effect.op, target: 'enemy', amount: amount });
        log(state, 'Aplicas ' + STATUS_ES[effect.op] + ' ' + amount + '.');
        break;

      case 'stun':
        state.enemy.stun += 1;
        events.push({ type: 'status', name: 'stun', target: 'enemy', amount: 1 });
        log(state, 'El enemigo queda aturdido.');
        break;

      case 'harvest':
        state.harvestAll = true;
        log(state, 'Puedes cosechar todo el cuerpo.');
        break;

      case 'time':
        events.push({ type: 'time', amount: amount });
        log(state, 'El reloj retrocede ' + amount + ' s.');
        break;

      default:
        break;
    }
  }

  // --- turns -----------------------------------------------------------------

  // start() deals the opening hand before game.js can hear about it, so those events wait
  // on the state until the first playCard/endTurn hands them over. One combat at a time.
  function takePending(state, events) {
    const pending = state.pending;
    if (!pending || !pending.length) return;
    for (let i = 0; i < pending.length; i++) events.push(pending[i]);
    pending.length = 0;
  }

  function startPlayerTurn(state, body, events) {
    log(state, 'Turno ' + state.turn + '.');
    state.block = 0;
    if (state.bleed > 0) {
      const tick = state.bleed;
      state.bleed -= 1;
      bleedBody(state, body, tick, events);
    }
    if (state.over) return;
    state.energy = state.maxEnergy;
    DD.Body.cool(body, 1);
    draw(state, TURN_DRAW, events);
  }

  function resolveIntent(state, body, intent, events) {
    const enemy = state.enemy;
    switch (intent.type) {
      case 'attack':
        log(state, enemy.name + ' ataca.');
        hurtPlayer(state, body, intent.amount || 0, events);
        break;

      case 'multi': {
        const times = intent.times || 1;
        log(state, enemy.name + ' ataca ' + times + ' veces.');
        for (let i = 0; i < times && !state.over; i++) {
          hurtPlayer(state, body, intent.amount || 0, events);
        }
        break;
      }

      case 'block':
        enemy.block += intent.amount || 0;
        events.push({ type: 'block', target: 'enemy', amount: intent.amount || 0 });
        log(state, 'El enemigo se protege.');
        break;

      case 'heat': {
        const intact = DD.Body.intactSlots(body);
        if (!intact.length) {
          log(state, 'No queda carne que quemar.');
          break;
        }
        log(state, 'El enemigo te recalienta.');
        heatSlot(state, body, intact[randInt(intact.length)], intent.amount || 0, events);
        break;
      }

      case 'bleed':
      case 'weak':
        state[intent.type] += intent.amount || 0;
        events.push({ type: 'status', name: intent.type, target: 'player', amount: intent.amount || 0 });
        log(state, 'Sufres ' + STATUS_ES[intent.type] + ' ' + (intent.amount || 0) + '.');
        break;

      default:
        break;
    }
  }

  function enemyTurn(state, body, events) {
    const enemy = state.enemy;

    // Bleed ticks at the start of the enemy's turn and loses one stack.
    if (enemy.bleed > 0) {
      const tick = enemy.bleed;
      enemy.bleed -= 1;
      enemy.hp = Math.max(0, enemy.hp - tick);
      events.push({ type: 'damage', target: 'enemy', amount: tick });
      log(state, 'El enemigo sangra ' + tick + '.');
      if (enemy.hp <= 0) {
        finish(state, 'win', events);
        return;
      }
    }

    if (enemy.stun > 0) {
      enemy.stun -= 1;
      log(state, 'El enemigo está aturdido.');
      return;
    }

    enemy.block = 0;                       // its own action starts: block resets
    if (enemy.intent) resolveIntent(state, body, enemy.intent, events);
    if (state.over) return;

    const intents = intentsOf(enemy.id);
    if (intents.length) {
      enemy.intentIndex = (enemy.intentIndex + 1) % intents.length;
      enemy.intent = intents[enemy.intentIndex];
    }
    if (enemy.vulnerable > 0) enemy.vulnerable -= 1;
    if (enemy.weak > 0) enemy.weak -= 1;
  }

  // --- public API ------------------------------------------------------------

  function start(body, enemyId, rngFn) {
    if (typeof rngFn === 'function') rng = rngFn;
    const def = DD.DATA.ENEMIES[enemyId] || { id: enemyId, name: enemyId, hp: 1, intents: [] };
    const intents = def.intents || [];

    const state = {
      enemy: {
        id: def.id,
        name: def.name,
        hp: def.hp,
        maxHp: def.hp,
        block: 0, bleed: 0, vulnerable: 0, weak: 0,
        stun: 0,                       // not in §4: the stun effect needs somewhere to live
        intentIndex: 0,
        intent: intents.length ? intents[0] : null
      },
      energy: TURN_ENERGY, maxEnergy: TURN_ENERGY,
      block: 0, bleed: 0, vulnerable: 0, weak: 0,
      deck: shuffle(DD.Body.buildDeck(body)),
      hand: [], discard: [],
      turn: 1,
      log: [],
      over: false,
      result: null,
      harvestAll: false,
      pending: []            // not in §4: the opening draw's events, see takePending
    };

    log(state, '¡' + state.enemy.name + ' te cierra el paso!');
    startPlayerTurn(state, body, state.pending);
    return state;
  }

  function canPlay(state, handIndex) {
    if (!state || state.over) return false;
    const card = cardOf(state.hand[handIndex]);
    return !!card && state.energy >= (card.cost || 0);
  }

  function playCard(state, body, handIndex) {
    const events = [];
    if (!state || state.over) return { ok: false, events: events };

    const slot = state.hand[handIndex];
    const card = cardOf(slot);
    if (!slot || !card) return { ok: false, events: events };
    if (state.energy < (card.cost || 0)) return { ok: false, events: events };

    takePending(state, events);
    state.hand.splice(handIndex, 1);
    state.energy -= card.cost || 0;
    log(state, 'Juegas ' + card.name + '.');

    const effects = card.effects || [];
    for (let i = 0; i < effects.length; i++) {
      applyEffect(state, body, effects[i], events);
      if (state.over) break;
    }

    heatSlot(state, body, slot.source, card.heat || 0, events);

    // A card whose own limb just broke leaves play with it (it was already purged
    // from deck, hand and discard); everything else goes to the discard.
    if (!slot.source || !DD.Body.isStump(body, slot.source)) state.discard.push(slot);
    return { ok: true, events: events };
  }

  function endTurn(state, body) {
    const events = [];
    if (!state || state.over) return { events: events };

    takePending(state, events);
    // Player's turn ends: the hand is discarded and its statuses tick down.
    state.discard = state.discard.concat(state.hand);
    state.hand = [];
    if (state.vulnerable > 0) state.vulnerable -= 1;
    if (state.weak > 0) state.weak -= 1;
    log(state, 'Terminas el turno.');

    enemyTurn(state, body, events);
    if (state.over) return { events: events };

    state.turn += 1;
    startPlayerTurn(state, body, events);
    return { events: events };
  }

  DD.Combat = {
    start: start,
    playCard: playCard,
    endTurn: endTurn,
    canPlay: canPlay,
    cardOf: cardOf
  };
})(window.DD);
