// Fast turn-based card combat. Owner: COMBAT worker. Pure logic.
// Spec: PRODUCT.md §5.3 (state, order of effects, events, log). Depends on DATA and Body.
const Combat = {
  /** private: running id handed to every deck entry */
  _uid: 0,

  /** private @returns {{uid:number, cardId:string, slot:string}} a fresh deck entry */
  _entry(cardId, slot) {
    Combat._uid += 1;
    return { uid: Combat._uid, cardId, slot };
  },

  /** private: Fisher-Yates, in place. */
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  },

  /** private: push a log line, keeping the last 8. */
  _say(C, line) {
    C.log.push(line);
    if (C.log.length > 8) C.log.shift();
  },

  /** private: translated name of a slot, for the log. */
  _slotName(slot) {
    return String(((DATA.SLOT_NAMES || {})[slot] || slot)).toLowerCase();
  },

  /** private: draw n cards, reshuffling the discard when the deck runs dry; what is missing is simply not drawn. */
  _drawCards(C, n) {
    for (let k = 0; k < n; k++) {
      if (!C.deck.length) {
        if (!C.discard.length) return;
        C.deck = Combat._shuffle(C.discard);
        C.discard = [];
      }
      C.hand.push(C.deck.pop());
    }
  },

  /** private: hit a side, block absorbing first. @returns {number} hp actually lost */
  _strike(C, target, base) {
    const toEnemy = target === 'enemy';
    const attacker = toEnemy ? C.player : C.enemy;
    const victim = toEnemy ? C.enemy : C.player;
    const raw = Combat.damage(base, attacker, victim);
    const absorbed = Math.min(victim.block, raw);
    victim.block -= absorbed;
    const rest = raw - absorbed;
    if (toEnemy) C.enemy.hp -= rest;
    else C.body.hp -= rest;
    return rest;
  },

  /** private: end the combat when either side is down. @returns {boolean} the combat is over */
  _resolve(C, events) {
    if (C.phase !== 'player') return true;
    if (C.enemy.hp <= 0) {
      C.enemy.hp = 0;
      C.phase = 'won';
      const limbs = C.enemy.limbs || {};
      C.loot = DATA.SLOTS.map((s) => limbs[s]).filter((id) => !!id);
      C.essence = (DATA.enemies[C.enemy.id] || {}).essence || 0;
      events.push({ type: 'won' });
      Combat._say(C, I18N.t('¡{0} cae!', C.enemy.name));
      return true;
    }
    if (C.body.hp <= 0) {
      C.body.hp = 0;
      C.phase = 'lost';
      events.push({ type: 'lost' });
      Combat._say(C, I18N.t('Tu cuerpo se desmorona.'));
      return true;
    }
    return false;
  },

  /**
   * Start a combat: shuffled deck from Body.cardsOf(body), first hand drawn.
   * @param {Object} body the player's Body (mutated in place during combat)
   * @param {string} enemyId key of DATA.enemies
   * @returns {Object} C — see PRODUCT.md §5.3
   */
  start(body, enemyId) {
    const e = DATA.enemies[enemyId] || {};
    const C = {
      body,
      enemy: {
        id: e.id || enemyId,
        name: e.name || I18N.t('Algo'),
        hp: e.hp || 0,
        maxHp: e.hp || 0,
        block: 0,
        status: { vuln: 0, weak: 0, poison: 0, stun: 0 },
        limbs: e.limbs || {},
        intents: e.intents || [],
        step: 0,
      },
      player: { block: 0, energy: DATA.ENERGY, status: { vuln: 0, weak: 0, poison: 0, stun: 0 } },
      deck: [],
      hand: [],
      discard: [],
      turn: 1,
      phase: 'player',
      loot: [],
      essence: 0,
      log: [],
    };
    C.deck = Combat._shuffle(Body.cardsOf(body).map((c) => Combat._entry(c.cardId, c.slot)));
    Combat._say(C, I18N.t('Te enfrentas a {0}.', C.enemy.name));
    Combat._drawCards(C, DATA.HAND_SIZE);
    return C;
  },

  /** @returns {boolean} phase is 'player', hand[i] exists and its cost <= player energy */
  canPlay(C, i) {
    if (!C || C.phase !== 'player') return false;
    const entry = C.hand[i];
    if (!entry) return false;
    const card = DATA.cards[entry.cardId];
    return !!card && (card.cost || 0) <= C.player.energy;
  },

  /**
   * Play hand[i]: pay cost, apply fx in the contract order, add heat to the source limb, handle breaks and win/loss.
   * @returns {Object[]} events
   */
  play(C, i) {
    const events = [];
    if (!Combat.canPlay(C, i)) return events;
    const entry = C.hand.splice(i, 1)[0];
    const card = DATA.cards[entry.cardId];
    const fx = card.fx || {};
    C.player.energy -= card.cost || 0;
    C.discard.push(entry);
    events.push({ type: 'play', cardId: entry.cardId, slot: entry.slot });
    Combat._say(C, I18N.t('Juegas {0}.', card.name));

    if (fx.dmg) {
      let total = 0;
      for (let h = 0; h < (fx.hits || 1); h++) {
        const n = Combat._strike(C, 'enemy', fx.dmg);
        total += n;
        events.push({ type: 'hit', target: 'enemy', amount: n });
      }
      Combat._say(C, I18N.t('{0} recibe {1} de daño.', C.enemy.name, total));
    }
    if (fx.block) {
      C.player.block += fx.block;
      events.push({ type: 'block', target: 'player' });
    }
    if (fx.heal) {
      const before = C.body.hp;
      C.body.hp = Math.min(C.body.maxHp, C.body.hp + fx.heal);
      const gained = C.body.hp - before;
      events.push({ type: 'heal', amount: gained });
      Combat._say(C, I18N.t('Recuperas {0} PV.', gained));
    }
    if (fx.draw) Combat._drawCards(C, fx.draw);
    if (fx.energy) C.player.energy += fx.energy;
    if (fx.cool) {
      Body.cool(C.body, fx.cool);
      events.push({ type: 'cool' });
    }
    if (fx.vuln) C.enemy.status.vuln += fx.vuln;
    if (fx.weak) C.enemy.status.weak += fx.weak;
    if (fx.poison) C.enemy.status.poison += fx.poison;
    if (fx.stun) C.enemy.status.stun += fx.stun;
    if (fx.selfDmg) {
      C.body.hp -= fx.selfDmg;
      events.push({ type: 'hit', target: 'player', amount: fx.selfDmg });
      Combat._say(C, I18N.t('Te cuesta {0} PV.', fx.selfDmg));
    }

    const heat = Body.addHeat(C.body, entry.slot, card.heat || 0);
    if (heat && heat.broke) {
      const limb = C.body.slots[entry.slot];
      const limbId = limb ? limb.id : null;
      const other = (x) => x.slot !== entry.slot;
      C.deck = C.deck.filter(other);
      C.hand = C.hand.filter(other);
      C.discard = C.discard.filter(other);
      C.discard.push(Combat._entry(DATA.STUMP_CARD, entry.slot));
      events.push({ type: 'break', slot: entry.slot, limbId });
      Combat._say(C, I18N.t('¡Tu {0} se parte!', Combat._slotName(entry.slot)));
    }

    Combat._resolve(C, events);
    return events;
  },

  /**
   * End the player's turn: enemy acts, statuses tick, limbs cool, new hand is drawn.
   * @returns {Object[]} events
   */
  endTurn(C) {
    const events = [];
    if (!C || C.phase !== 'player') return events;
    const en = C.enemy;
    while (C.hand.length) C.discard.push(C.hand.pop());

    // Enemy turn: its block from last turn is gone, poison bites, then it acts.
    en.block = 0;
    if (en.status.poison > 0) {
      en.hp -= en.status.poison;
      events.push({ type: 'hit', target: 'enemy', amount: en.status.poison });
      Combat._say(C, I18N.t('El veneno consume a {0} ({1}).', en.name, en.status.poison));
      en.status.poison -= 1;
    }
    if (Combat._resolve(C, events)) return events;

    if (en.status.stun > 0) {
      en.status.stun -= 1;
      Combat._say(C, I18N.t('{0} está aturdido.', en.name));
    } else {
      const it = Combat.intent(C);
      events.push({ type: 'enemyAct', kind: it.kind, value: it.value });
      if (it.kind === 'attack') {
        let total = 0;
        for (let h = 0; h < it.hits; h++) {
          const n = Combat._strike(C, 'player', it.value);
          total += n;
          events.push({ type: 'hit', target: 'player', amount: n });
        }
        Combat._say(C, I18N.t('{0} te golpea por {1}.', en.name, total));
      } else if (it.kind === 'block') {
        en.block += it.value;
        events.push({ type: 'block', target: 'enemy' });
        Combat._say(C, I18N.t('{0} se protege.', en.name));
      } else if (it.kind === 'heal') {
        const before = en.hp;
        en.hp = Math.min(en.maxHp, en.hp + it.value);
        events.push({ type: 'heal', amount: en.hp - before });
        Combat._say(C, I18N.t('{0} se cose las heridas.', en.name));
      } else if (it.kind === 'poison') {
        C.player.status.poison += it.value;
        Combat._say(C, I18N.t('{0} te envenena ({1}).', en.name, it.value));
      } else if (it.kind === 'weak') {
        C.player.status.weak += it.value;
        Combat._say(C, I18N.t('{0} te debilita.', en.name));
      }
      if (en.intents.length) en.step = (en.step + 1) % en.intents.length;
    }
    en.status.vuln = Math.max(0, en.status.vuln - 1);
    en.status.weak = Math.max(0, en.status.weak - 1);
    if (Combat._resolve(C, events)) return events;

    // New player turn.
    C.player.block = 0;
    if (C.player.status.poison > 0) {
      C.body.hp -= C.player.status.poison;
      events.push({ type: 'hit', target: 'player', amount: C.player.status.poison });
      Combat._say(C, I18N.t('El veneno te consume ({0}).', C.player.status.poison));
      C.player.status.poison -= 1;
      if (Combat._resolve(C, events)) return events;
    }
    Body.cool(C.body, DATA.COOL_PER_TURN);
    C.player.energy = DATA.ENERGY;
    C.player.status.vuln = Math.max(0, C.player.status.vuln - 1);
    C.player.status.weak = Math.max(0, C.player.status.weak - 1);
    Combat._drawCards(C, DATA.HAND_SIZE);
    C.turn += 1;
    return events;
  },

  /** @returns {{kind:string, value:number, hits:number, text:string}} the enemy's current intent with translated text */
  intent(C) {
    const list = (C && C.enemy && C.enemy.intents) || [];
    const it = list.length ? list[C.enemy.step % list.length] : null;
    if (!it) return { kind: 'none', value: 0, hits: 1, text: '' };
    const value = it.value || 0;
    const hits = it.hits || 1;
    let text = '';
    if (it.kind === 'attack') text = hits > 1 ? I18N.t('Ataca {0}×{1}', value, hits) : I18N.t('Ataca {0}', value);
    else if (it.kind === 'block') text = I18N.t('Se protege {0}', value);
    else if (it.kind === 'heal') text = I18N.t('Se cose {0}', value);
    else if (it.kind === 'poison') text = I18N.t('Envenena {0}', value);
    else if (it.kind === 'weak') text = I18N.t('Debilita {0}', value);
    return { kind: it.kind, value, hits, text };
  },

  /** @returns {number} floor(base * (attacker weak ? 0.5 : 1) * (target vuln ? 1.5 : 1)) — before block */
  damage(base, attacker, target) {
    const weak = attacker && attacker.status && attacker.status.weak > 0 ? 0.5 : 1;
    const vuln = target && target.status && target.status.vuln > 0 ? 1.5 : 1;
    return Math.floor((base || 0) * weak * vuln);
  },
};
