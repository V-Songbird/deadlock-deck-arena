/* Deadlock Deck: El Reloj Anatómico — modelo del cuerpo (W2)
 * body = { base, slots:{ head:{id, integ, heat}, torso, armL, armR, legL, legR } }. Muñón = hueco con id:null.
 * Es JSON plano; todas las funciones lo modifican en sitio. Reglas en docs/design.md §5.
 */
(function () {
  'use strict';
  var DD = window.DD;
  var CFG = DD.CFG;
  var Body = DD.Body = {};

  function stump() { return { id: null, integ: 0, heat: 0 }; }
  function slotOf(body, slot) {
    var s = body && body.slots && body.slots[slot];
    if (!s) throw new Error('Hueco desconocido: ' + slot);
    return s;
  }
  function round(n) { return Math.round(n) || 0; }
  function round2(n) { return Math.round(n * 100) / 100; }

  Body.limbAt = function (body, slot) {
    var s = body.slots[slot];
    return (s && s.id && DD.LIMBS[s.id]) || null;
  };

  Body.integMax = function (body, slot) {
    var l = Body.limbAt(body, slot);
    return l ? l.integ : 0;
  };

  Body.intactSlots = function (body) {
    return DD.SLOTS.filter(function (s) { return Body.limbAt(body, s) !== null; });
  };
  Body.stumpSlots = function (body) {
    return DD.SLOTS.filter(function (s) { return Body.limbAt(body, s) === null; });
  };

  // Coloca una extremidad. Devuelve el id reemplazado (o null si el hueco era un muñón).
  Body.graft = function (body, slot, limbId, frac) {
    var s = slotOf(body, slot), l = DD.LIMBS[limbId];
    if (!l) throw new Error('Extremidad desconocida: ' + limbId);
    if (l.type !== DD.SLOT_TYPE[slot]) {
      throw new Error('La extremidad ' + limbId + ' (' + l.type + ') no encaja en el hueco ' + slot);
    }
    if (frac === undefined || frac === null) frac = CFG.GRAFT_FRAC;
    var old = s.id || null;
    s.id = limbId;
    s.integ = DD.clamp(Math.ceil(l.integ * frac), 1, l.integ);
    s.heat = 0;
    return old;
  };

  // extraGrafts: array de {slot, id} (o {slot, limb}) u objeto {slot: limbId}; se injertan a GRAFT_FRAC.
  Body.create = function (baseId, extraGrafts) {
    var base = DD.BASES[baseId] || DD.BASES.jornalero;
    var body = { base: base.id, slots: {} };
    DD.SLOTS.forEach(function (slot) {
      var id = base.limbs[slot];
      body.slots[slot] = id ? { id: id, integ: DD.LIMBS[id].integ, heat: 0 } : stump();
    });
    if (extraGrafts) {
      if (Array.isArray(extraGrafts)) {
        extraGrafts.forEach(function (g) { Body.graft(body, g.slot, g.id || g.limb || g.limbId); });
      } else {
        Object.keys(extraGrafts).forEach(function (slot) { Body.graft(body, slot, extraGrafts[slot]); });
      }
    }
    return body;
  };

  // Resta integridad; a 0 la extremidad se rompe y queda un muñón.
  Body.hurtLimb = function (body, slot, n) {
    var s = slotOf(body, slot);
    if (!s.id) return { broke: false, lost: null };
    s.integ -= Math.max(0, round(n));
    if (s.integ > 0) return { broke: false, lost: null };
    var lost = s.id;
    s.id = null; s.integ = 0; s.heat = 0;
    return { broke: true, lost: lost };
  };

  // Suma calor. Pasar de HEAT_MAX sobrecalienta: daño de integridad y el calor baja a OVERHEAT_RESET.
  Body.addHeat = function (body, slot, n) {
    var s = slotOf(body, slot);
    if (!s.id) return { overheated: false, broke: false, lost: null };
    s.heat = Math.max(0, s.heat + round(n));
    if (s.heat <= CFG.HEAT_MAX) return { overheated: false, broke: false, lost: null };
    var r = Body.hurtLimb(body, slot, CFG.OVERHEAT_DMG);
    if (!r.broke) s.heat = CFG.OVERHEAT_RESET;
    return { overheated: true, broke: r.broke, lost: r.lost };
  };

  Body.coolSlot = function (body, slot, n) {
    var s = slotOf(body, slot);
    s.heat = Math.max(0, s.heat - Math.max(0, round(n)));
  };
  Body.coolAll = function (body, n) {
    DD.SLOTS.forEach(function (slot) { Body.coolSlot(body, slot, n); });
  };

  // Devuelve la integridad realmente recuperada.
  Body.repairSlot = function (body, slot, n) {
    var s = slotOf(body, slot), max = Body.integMax(body, slot);
    if (!s.id) return 0;
    var before = s.integ;
    s.integ = Math.min(max, s.integ + Math.max(0, round(n)));
    return s.integ - before;
  };

  // Repara la extremidad intacta con más daño relativo. Devuelve su hueco, o null si no hay ninguna dañada.
  Body.repairWorst = function (body, n) {
    var best = null, bestFrac = 0;
    Body.intactSlots(body).forEach(function (slot) {
      var frac = 1 - body.slots[slot].integ / Body.integMax(body, slot);
      if (frac > bestFrac) { best = slot; bestFrac = frac; }
    });
    if (best) Body.repairSlot(body, best, n);
    return best;
  };

  // Hueco intacto más caliente ({slot:null, heat:0} si no queda ninguno).
  Body.hottest = function (body) {
    var best = { slot: null, heat: 0 };
    Body.intactSlots(body).forEach(function (slot) {
      var h = body.slots[slot].heat;
      if (best.slot === null || h > best.heat) best = { slot: slot, heat: h };
    });
    return best;
  };

  // Pasivas de las extremidades intactas, con los topes del diseño.
  Body.stats = function (body) {
    var sum = { hp: 0, energy: 0, draw: 0, cool: 0, dmg: 0, block: 0, speed: 0, vision: 0, fireRes: 0 };
    Body.intactSlots(body).forEach(function (slot) {
      var p = Body.limbAt(body, slot).passive || {};
      for (var k in sum) if (p[k]) sum[k] += p[k];
    });
    var base = DD.BASES[body.base];
    return {
      hpMax: CFG.HP_BASE + (base ? base.hpBonus : 0) + sum.hp,
      energy: Math.min(5, CFG.ENERGY + sum.energy),
      hand: Math.min(8, CFG.HAND + sum.draw),
      cool: CFG.COOL_TURN + sum.cool,
      dmg: sum.dmg,
      block: sum.block,
      speed: round2(1 + sum.speed),
      vision: CFG.VISION + sum.vision,
      fireRes: round2(DD.clamp(sum.fireRes, 0, 0.75))
    };
  };

  // Mazo de combate: las 3 cartas de cada extremidad intacta, o la carta de muñón del tipo por cada hueco vacío.
  Body.deck = function (body) {
    var deck = [];
    DD.SLOTS.forEach(function (slot) {
      var l = Body.limbAt(body, slot);
      if (l) {
        l.cards.forEach(function (id) { deck.push({ card: DD.CARDS[id], slot: slot }); });
      } else {
        deck.push({ card: DD.STUMP_CARDS[DD.SLOT_TYPE[slot]], slot: slot });
      }
    });
    return deck;
  };
})();
