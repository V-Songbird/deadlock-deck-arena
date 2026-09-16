// Deadlock Deck: El Reloj Anatómico — body helpers (DD.body).
// A body is { head, torso, armL, armR, legL, legR }, each { id, heat } or null (stump).
DD.body = {
  BASE_HP: 30,

  newBase() {
    const body = {};
    for (const slot of DD.SLOTS) {
      const options = Object.values(DD.data.limbs).filter(l => l.base && l.type === DD.SLOT_TYPE[slot]);
      body[slot] = { id: DD.pick(options).id, heat: 0 };
    }
    return body;
  },

  maxHp(body) {
    let hp = DD.body.BASE_HP;
    for (const slot of DD.SLOTS) if (body[slot]) hp += DD.data.limbs[body[slot].id].hpBonus || 0;
    return hp;
  },

  deck(body) {
    const cards = [];
    for (const slot of DD.SLOTS) {
      const limb = body[slot];
      if (limb) for (const cardId of DD.data.limbs[limb.id].cards) cards.push({ cardId, slot });
      else cards.push({ cardId: DD.data.STUMP_CARD, slot });
    }
    return cards;
  },

  fits(slot, limbId) {
    const limb = DD.data.limbs[limbId];
    return !!limb && limb.type === DD.SLOT_TYPE[slot];
  },

  graft(run, slot, limbId) {
    const missing = run.maxHp - run.hp;
    run.body[slot] = { id: limbId, heat: 0 };
    run.maxHp = DD.body.maxHp(run.body);
    run.hp = DD.clamp(run.maxHp - missing, 1, run.maxHp);
    DD.log('Injertas ' + DD.data.limbs[limbId].name + ' (' + DD.SLOT_NAME[slot] + ')');
    DD.audio.sfx('graft');
  },

  // Returns true when the limb breaks (slot becomes a stump).
  heat(run, slot, amount) {
    const limb = run.body[slot];
    if (!limb || !(amount > 0)) return false;
    const def = DD.data.limbs[limb.id];
    limb.heat = Math.min(def.maxHeat, limb.heat + amount);
    if (limb.heat < def.maxHeat) return false;
    run.body[slot] = null;
    run.maxHp = DD.body.maxHp(run.body);
    run.hp = Math.min(run.hp, run.maxHp);
    DD.log('¡' + def.name + ' se rompe! Ahora es un muñón.');
    DD.audio.sfx('break');
    return true;
  },

  cool(run, amount, slot) {
    for (const s of slot ? [slot] : DD.SLOTS) {
      const limb = run.body[s];
      if (limb) limb.heat = Math.max(0, limb.heat - amount);
    }
  },

  intact(body) {
    return DD.SLOTS.filter(s => body[s]).length;
  },
};
