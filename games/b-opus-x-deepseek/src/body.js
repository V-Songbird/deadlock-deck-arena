// Deadlock Deck — DD.Body: the body is the deck.
// Limbs supply the cards, heat degrades them and a broken limb leaves only a stump card.
// Everything is a plain object; DD.DATA is read on every call so load order never matters.
window.DD = window.DD || {};

(function () {
  'use strict';

  const DD = window.DD;

  const STUMP_NAME = DD.T('muñón');

  // Plural forms for the names that can appear twice (both arms or both legs).
  // Any other limb falls back to pluralizing its first word.
  const PLURALS = {
    arm_withered: DD.T('Brazos Marchitos'),
    arm_cleaver: DD.T('Brazos Cuchilla'),
    arm_bellows: DD.T('Brazos Fuelle'),
    arm_needle: DD.T('Brazos Aguja'),
    arm_gauntlet: DD.T('Guanteletes de Latón'),
    leg_limping: DD.T('Piernas Renqueantes'),
    leg_hound: DD.T('Zancas de Sabueso'),
    leg_piston: DD.T('Piernas de Pistón'),
    leg_root: DD.T('Piernas Raíz')
  };

  const data = () => window.DD.DATA || {};
  const slotKeys = (body) => data().SLOTS || (body && body.slots ? Object.keys(body.slots) : []);
  const slotOf = (body, key) => (body && body.slots && body.slots[key]) || null;
  // Integrity never divides by zero, even with malformed data.
  const integrityOf = (limb) => (limb.integrity > 0 ? limb.integrity : 1);

  function create(limbIds) {
    const ids = limbIds || {};
    const body = { hp: 0, maxHp: 0, slots: {} };
    slotKeys(body).forEach(function (key) {
      const id = ids[key];
      body.slots[key] = { limbId: id == null ? null : id, heat: 0, broken: false };
    });
    body.maxHp = maxHp(body);
    body.hp = body.maxHp; // a fresh body starts at full hp
    return body;
  }

  function maxHp(body) {
    let total = data().BASE_HP || 0;
    slotKeys(body).forEach(function (key) {
      const limb = limbOf(body, key);
      if (limb) total += limb.hpBonus || 0;
    });
    return total;
  }

  // Two cards per intact limb, one stump card per broken or empty slot.
  function buildDeck(body) {
    const d = data();
    const deck = [];
    slotKeys(body).forEach(function (key) {
      const limb = limbOf(body, key);
      if (limb) {
        (limb.cards || []).forEach(function (cardId) {
          deck.push({ cardId: cardId, source: key });
        });
      } else {
        const stumpId = (d.STUMPS || {})[(d.SLOT_KIND || {})[key]];
        if (stumpId) deck.push({ cardId: stumpId, source: null }); // stumps generate no heat
      }
    });
    return deck;
  }

  // Heat clamps at the limb's integrity. `broken` is true only on the call that breaks it.
  function applyHeat(body, slotKey, amount) {
    const slot = slotOf(body, slotKey);
    const limb = limbOf(body, slotKey);
    if (!slot || !limb) return { broken: false }; // nothing there to overheat
    const cap = integrityOf(limb);
    slot.heat = Math.min(cap, (slot.heat || 0) + Math.max(0, amount || 0));
    if (slot.heat >= cap) {
      slot.broken = true;
      // The breaking limb leaves with its hpBonus, so the stored maxHp is now stale:
      // resync it and clamp hp, exactly like graft() does.
      body.maxHp = maxHp(body);
      if (body.hp > body.maxHp) body.hp = body.maxHp;
      return { broken: true };
    }
    return { broken: false };
  }

  function cool(body, amount) {
    const n = Math.max(0, amount || 0);
    slotKeys(body).forEach(function (key) {
      const slot = slotOf(body, key);
      if (slot) slot.heat = Math.max(0, (slot.heat || 0) - n); // broken never goes back
    });
  }

  function graft(body, slotKey, limbId) {
    const slot = slotOf(body, slotKey);
    const limb = (data().LIMBS || {})[limbId];
    const kind = (data().SLOT_KIND || {})[slotKey];
    if (!slot || !limb || limb.kind !== kind) return { replaced: null, ok: false };
    const replaced = slot.limbId || null;
    slot.limbId = limbId;
    slot.heat = 0;
    slot.broken = false;
    body.maxHp = maxHp(body);
    if (body.hp > body.maxHp) body.hp = body.maxHp;
    return { replaced: replaced, ok: true };
  }

  function isStump(body, slotKey) {
    const slot = slotOf(body, slotKey);
    return !slot || slot.broken === true || slot.limbId == null;
  }

  function limbOf(body, slotKey) {
    const slot = slotOf(body, slotKey);
    if (!slot || slot.broken || slot.limbId == null) return null; // a broken slot has no limb
    return (data().LIMBS || {})[slot.limbId] || null;
  }

  function intactSlots(body) {
    return slotKeys(body).filter(function (key) {
      return !isStump(body, key);
    });
  }

  function heatRatio(body, slotKey) {
    const limb = limbOf(body, slotKey);
    const slot = slotOf(body, slotKey);
    if (!limb || !slot) return 0; // stumps never read as hot
    return Math.max(0, Math.min(1, (slot.heat || 0) / integrityOf(limb)));
  }

  function compatibleSlots(limbId) {
    const limb = (data().LIMBS || {})[limbId];
    if (!limb) return [];
    const kinds = data().SLOT_KIND || {};
    return slotKeys(null).filter(function (key) {
      return kinds[key] === limb.kind;
    });
  }

  // One short Spanish line, e.g. "Cráneo del Erudito, Torso Cosido, dos Brazos Cuchilla,
  // muñón, Pierna de Pistón" — adjacent identical limbs are counted instead of repeated.
  function describe(body) {
    const grouped = [];
    slotKeys(body).forEach(function (key) {
      const limb = limbOf(body, key);
      const name = (limb && limb.name) || STUMP_NAME;
      const last = grouped[grouped.length - 1];
      if (last && last.name === name) last.count += 1;
      else grouped.push({ name: name, count: 1, id: limb ? limb.id : null });
    });
    if (!grouped.length) return DD.T('Cuerpo vacío');
    return grouped
      .map(function (g) {
        return g.count > 1 ? DD.T('dos {0}', pluralOf(g)) : g.name;
      })
      .join(', ');
  }

  function pluralOf(group) {
    if (group.id && PLURALS[group.id]) return PLURALS[group.id];
    if (group.name === STUMP_NAME) return DD.T('muñones');
    const words = group.name.split(' ');
    words[0] = /[aeiouáéíóú]$/i.test(words[0]) ? words[0] + 's' : words[0] + 'es';
    return words.join(' ');
  }

  window.DD.Body = {
    create: create,
    maxHp: maxHp,
    buildDeck: buildDeck,
    applyHeat: applyHeat,
    cool: cool,
    graft: graft,
    isStump: isStump,
    limbOf: limbOf,
    intactSlots: intactSlots,
    heatRatio: heatRatio,
    compatibleSlots: compatibleSlots,
    describe: describe
  };
})();
