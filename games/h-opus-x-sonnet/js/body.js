/* Deadlock Deck: El Reloj Anatómico — body.js
   The body model: slots, heat, integrity, breaking, grafting and the deck. */
(function () {
  'use strict';
  const DD = window.DD;

  const B = DD.body = DD.body || {};
  B.onBreak = null;                 // optional callback(slotKey, limbId)
  B.fxAnchor = null;                // optional {x,y} screen position for floating texts (set by combat)

  function sfx(name) { try { if (DD.audio && DD.audio.sfx) DD.audio.sfx(name); } catch (e) { /* ignore */ } }
  function anchor() { return B.fxAnchor || { x: DD.W ? DD.W / 2 : 320, y: DD.H ? DD.H / 2 : 180 }; }
  function floatText(text, color, dy) {
    try {
      const a = anchor();
      if (DD.fx && DD.fx.float) DD.fx.float(text, a.x, a.y + (dy || 0), color);
    } catch (e) { /* ignore */ }
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function makeInst(limbId) {
    const def = DD.LIMBS[limbId];
    if (!def) return null;
    return { id: limbId, integrity: def.integrity, maxIntegrity: def.integrity, heat: 0 };
  }

  function passiveSum(body, key) {
    let s = 0;
    for (const k of DD.SLOTS) {
      const l = body.slots[k];
      if (l) {
        const p = DD.LIMBS[l.id].passive;
        if (p && p[key]) s += p[key];
      }
    }
    return s;
  }

  function computeMaxHp(body) { return 40 + passiveSum(body, 'maxHp'); }

  // Recompute maxHp; when it rises, hp rises by the difference; always clamp hp.
  function recompute(body) {
    const old = body.maxHp || 0;
    const nu = computeMaxHp(body);
    body.maxHp = nu;
    if (nu > old && old > 0) body.hp += nu - old;
    body.hp = clamp(body.hp, 0, nu);
  }

  B.create = function (baseId) {
    let base = null;
    for (const b of DD.BASE_BODIES) if (b.id === baseId) base = b;
    if (!base) base = DD.BASE_BODIES[0];
    const body = { baseId: base.id, slots: {}, hp: 0, maxHp: 0 };
    for (const k of DD.SLOTS) body.slots[k] = makeInst(base.slots[k]);
    body.maxHp = computeMaxHp(body);
    body.hp = body.maxHp;
    return body;
  };

  B.slotsFor = function (limbId) {
    const def = DD.LIMBS[limbId];
    if (!def) return [];
    return DD.SLOTS.filter(function (k) { return DD.SLOT_TYPE[k] === def.slot; });
  };

  B.limbDef = function (body, slotKey) {
    const l = body.slots[slotKey];
    return l ? DD.LIMBS[l.id] : null;
  };

  B.graft = function (body, slotKey, limbId) {
    const def = DD.LIMBS[limbId];
    if (!def || DD.SLOT_TYPE[slotKey] !== def.slot) return false;
    body.slots[slotKey] = makeInst(limbId);
    recompute(body);
    return true;
  };

  B.stat = function (body, name) {
    switch (name) {
      case 'maxHp': return computeMaxHp(body);
      case 'draw': return Math.max(2, 5 + passiveSum(body, 'draw'));
      case 'energy': return Math.max(1, 3 + passiveSum(body, 'energy'));
      case 'vision': return Math.max(1, (body.slots.head ? 4 : 2) + passiveSum(body, 'vision'));
      case 'cool': return Math.max(2, 10 + passiveSum(body, 'cool'));
      case 'speed': {
        let stumps = 0;
        if (!body.slots.legL) stumps++;
        if (!body.slots.legR) stumps++;
        const base = stumps === 0 ? 1.0 : (stumps === 1 ? 0.65 : 0.4);
        return Math.max(0.2, base * (1 + passiveSum(body, 'speed')));
      }
      default: return 0;
    }
  };

  B.deck = function (body) {
    const out = [];
    for (const k of DD.SLOTS) {
      const l = body.slots[k];
      if (l) {
        for (const cid of DD.LIMBS[l.id].cards) out.push({ cardId: cid, slot: k });
      } else {
        out.push({ cardId: DD.STUMPS[DD.SLOT_TYPE[k]], slot: k });
      }
    }
    return out;
  };

  // The slot whose limb has lost the largest fraction of integrity (null if none damaged).
  B.mostDamaged = function (body) {
    let best = null, bestFrac = 1;
    for (const k of DD.SLOTS) {
      const l = body.slots[k];
      if (l && l.integrity < l.maxIntegrity) {
        const f = l.integrity / l.maxIntegrity;
        if (f < bestFrac || (f === bestFrac && best === null)) { best = k; bestFrac = f; }
      }
    }
    return best;
  };

  function breakLimb(body, slotKey) {
    const l = body.slots[slotKey];
    if (!l) return;
    const def = DD.LIMBS[l.id];
    body.slots[slotKey] = null;
    recompute(body);
    sfx('break');
    try { if (DD.fx) { DD.fx.shake(6, 0.35); DD.fx.flash('#ffffff', 0.12); } } catch (e) { /* ignore */ }
    floatText('¡' + def.name + ' se rompe!', DD.PAL ? DD.PAL.bloodLight : '#e04848', -10);
    if (typeof B.onBreak === 'function') B.onBreak(slotKey, l.id);
  }

  // Returns true if the limb broke.
  B.wear = function (body, slotKey, n) {
    const l = body.slots[slotKey];
    if (!l || !(n > 0)) return false;
    l.integrity -= n;
    if (l.integrity <= 0) { l.integrity = 0; breakLimb(body, slotKey); return true; }
    return false;
  };

  // Returns true if the limb overheated (it may also have broken).
  B.addHeat = function (body, slotKey, n) {
    const l = body.slots[slotKey];
    if (!l || !(n > 0)) return false;
    l.heat = Math.min(140, l.heat + n);
    if (l.heat >= 100) {
      l.heat = 60;
      sfx('overheat');
      try { if (DD.fx) { DD.fx.shake(4, 0.25); DD.fx.flash('#ff4a1a', 0.15); } } catch (e) { /* ignore */ }
      floatText('¡SOBRECALENTADO!', DD.PAL ? DD.PAL.heat : '#ff4a1a', 6);
      B.wear(body, slotKey, 1);
      return true;
    }
    return false;
  };

  B.cool = function (body, n) {
    for (const k of DD.SLOTS) {
      const l = body.slots[k];
      if (l) l.heat = Math.max(0, l.heat - n);
    }
  };

  // slotKey null/'auto' => most damaged limb.
  B.repair = function (body, slotKey, n) {
    if (!slotKey || slotKey === 'auto') slotKey = B.mostDamaged(body);
    const l = slotKey ? body.slots[slotKey] : null;
    if (!l) return false;
    l.integrity = Math.min(l.maxIntegrity, l.integrity + n);
    return true;
  };

  B.heal = function (body, n) {
    const before = body.hp;
    body.hp = Math.min(body.maxHp, body.hp + n);
    return body.hp - before;
  };

  // Returns the hp actually lost.
  B.hurt = function (body, n) {
    n = Math.max(0, Math.round(n));
    const before = body.hp;
    body.hp = Math.max(0, body.hp - n);
    if (n > 0) sfx('hurt');
    return before - body.hp;
  };
})();
