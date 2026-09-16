// The body is the deck: six limb slots, heat, breaking, grafting. Owner: BODY worker. Pure logic.
// Spec: PRODUCT.md §5.1 and §6. Depends only on DATA.
const Body = {
  /**
   * @param {Object<string,string|null>} slots limbId per slot in DATA.SLOTS; missing or null = stump
   * @returns {{slots:Object<string,{id:string,heat:number,broken:boolean}|null>, hp:number, maxHp:number}}
   */
  create(slots) {
    const src = slots || {};
    const body = { slots: {}, hp: 0, maxHp: 0 };
    DATA.SLOTS.forEach((slot) => {
      const id = src[slot];
      // An unknown blueprint id is not fatal: the slot simply starts as a stump.
      body.slots[slot] = id && DATA.limbs[id] ? { id: id, heat: 0, broken: false } : null;
    });
    body.maxHp = Body.maxHp(body);
    body.hp = body.maxHp;
    return body;
  },

  /** @returns {boolean} true when the slot is null or its limb is broken */
  isStump(body, slot) {
    const limb = body.slots[slot];
    return !(limb && !limb.broken && DATA.limbs[limb.id]);
  },

  /** @returns {number} DATA.BASE_HP + hp of every healthy limb */
  maxHp(body) {
    return DATA.SLOTS.reduce((total, slot) => (
      Body.isStump(body, slot) ? total : total + (DATA.limbs[body.slots[slot].id].hp || 0)
    ), DATA.BASE_HP);
  },

  /**
   * Put a fresh limb (heat 0, not broken) into the slot; recompute maxHp; move hp by the same difference (min 1).
   * @returns {{id:string,heat:number,broken:boolean}|null} the removed limb
   */
  graft(body, slot, limbId) {
    const removed = body.slots[slot] || null;
    const before = body.maxHp;
    body.slots[slot] = limbId && DATA.limbs[limbId] ? { id: limbId, heat: 0, broken: false } : null;
    body.maxHp = Body.maxHp(body);
    body.hp = Math.max(1, body.hp + (body.maxHp - before));
    return removed;
  },

  /** @returns {{cardId:string, slot:string}[]} healthy limbs' cards plus one DATA.STUMP_CARD per stump slot */
  cardsOf(body) {
    const cards = [];
    DATA.SLOTS.forEach((slot) => {
      if (Body.isStump(body, slot)) {
        cards.push({ cardId: DATA.STUMP_CARD, slot: slot });
        return;
      }
      (DATA.limbs[body.slots[slot].id].cards || []).forEach((cardId) => {
        cards.push({ cardId: cardId, slot: slot });
      });
    });
    return cards;
  },

  /**
   * Add heat to a slot; the limb breaks at heat >= maxHeat. Stumps ignore heat.
   * @returns {{broke:boolean, heat:number, max:number}}
   */
  addHeat(body, slot, amount) {
    if (Body.isStump(body, slot)) return { broke: false, heat: 0, max: 0 };
    const limb = body.slots[slot];
    const max = DATA.limbs[limb.id].maxHeat;
    limb.heat = Math.max(0, limb.heat + (amount || 0));
    // Reached only while the limb is still healthy, so a break is always a transition.
    const broke = limb.heat >= max;
    if (broke) limb.broken = true;
    return { broke: broke, heat: limb.heat, max: max };
  },

  /** Every healthy limb: heat = max(0, heat - amount). */
  cool(body, amount) {
    DATA.SLOTS.forEach((slot) => {
      if (Body.isStump(body, slot)) return;
      const limb = body.slots[slot];
      limb.heat = Math.max(0, limb.heat - (amount || 0));
    });
  },

  /** @returns {Object<string,string|null>} limbId per slot, null for stumps (input for Sprites.creature) */
  spriteSlots(body) {
    const out = {};
    DATA.SLOTS.forEach((slot) => {
      out[slot] = Body.isStump(body, slot) ? null : body.slots[slot].id;
    });
    return out;
  },

  /** @returns {number} heat / maxHeat clamped to 0..1; 0 for stumps */
  heatRatio(body, slot) {
    if (Body.isStump(body, slot)) return 0;
    const limb = body.slots[slot];
    return Math.max(0, Math.min(1, limb.heat / DATA.limbs[limb.id].maxHeat));
  },
};
