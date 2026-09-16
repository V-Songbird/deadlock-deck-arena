/* DD.Body — the anatomical container: six sockets, one limb each.
 * The deck (DD.Deck) and the heat system (DD.Heat) read this object directly.
 * The body is a plain data record; nothing here writes to DD.Run.stats. */
(function () {
  'use strict';
  var DD = window.DD;

  /* socket -> limb slot (2.2) */
  var SLOT_OF = { head: 'head', torso: 'torso', armL: 'arm', armR: 'arm', legL: 'leg', legR: 'leg' };
  /* limb slot -> sockets, in body order */
  var SLOTS = { head: ['head'], torso: ['torso'], arm: ['armL', 'armR'], leg: ['legL', 'legR'] };

  var Body = DD.Body = DD.Body || {};

  /* --------------------------------------------------------------- lookups */
  function allLimbs() { return (DD.Data && DD.Data.limbs) || []; }

  function limbDef(id) {
    var by = DD.Data && DD.Data.limbById;
    return (by && by[id]) || null;
  }

  Body.socketsFor = function (slot) { return SLOTS[slot] ? SLOTS[slot].slice() : []; };
  Body.slotOf = function (socket) { return SLOT_OF[socket] || null; };

  /* Deterministic-free random pick of a tier-N limb for a slot.
   * Falls back to any tier of that slot, then to null (socket stays a stump). */
  function pickLimb(rng, slot, tier) {
    var list = allLimbs(), i, exact = [], loose = [];
    for (i = 0; i < list.length; i++) {
      if (!list[i] || list[i].slot !== slot) continue;
      loose.push(list[i]);
      if ((list[i].tier || 1) === tier) exact.push(list[i]);
    }
    var pool = exact.length ? exact : loose;
    if (!pool.length) return null;
    return pool[Math.floor(rng.next() * pool.length)];
  }

  /* ---------------------------------------------------------------- create */
  Body.create = function (tier) {
    tier = tier || 1;
    var rng = DD.rng();
    var body = { sockets: {}, integrity: {}, heat: {}, heatCap: {}, coolRate: {} };
    for (var i = 0; i < DD.SOCKETS.length; i++) {
      var socket = DD.SOCKETS[i];
      var limb = pickLimb(rng, SLOT_OF[socket], tier);
      body.sockets[socket] = limb ? limb.id : null;
      body.integrity[socket] = limb ? (limb.integrity || 0) : 0;
      body.heat[socket] = 0;
      body.heatCap[socket] = limb ? (limb.heatCap || 100) : 0;
      body.coolRate[socket] = limb ? (limb.coolRate || 0) : 0;
    }
    return body;
  };

  /* --------------------------------------------------------------- queries */
  Body.limbOf = function (body, socket) {
    if (!body || !body.sockets) return null;
    return limbDef(body.sockets[socket]);
  };

  Body.isStump = function (body, socket) {
    return !Body.limbOf(body, socket);
  };

  Body.integrityOf = function (body, socket) {
    if (!body || !body.integrity) return 0;
    return body.integrity[socket] || 0;
  };

  Body.missingCount = function (body) {
    var n = 0;
    if (!body || !body.sockets) return 0;
    for (var i = 0; i < DD.SOCKETS.length; i++) if (Body.isStump(body, DD.SOCKETS[i])) n++;
    return n;
  };

  /* ----------------------------------------------------------------- equip */
  Body.equip = function (body, socket, limbId) {
    if (!body || !body.sockets) return false;
    var limb = limbDef(limbId);
    if (!limb) return false;
    if (Body.socketsFor(limb.slot).indexOf(socket) < 0) return false;
    body.sockets[socket] = limb.id;
    body.integrity[socket] = limb.integrity || 0;
    body.heat[socket] = 0;
    body.heatCap[socket] = limb.heatCap || 100;
    body.coolRate[socket] = limb.coolRate || 0;
    return true;
  };

  Body.breakSocket = function (body, socket) {
    if (!body || !body.sockets || body.sockets[socket] === undefined) return;
    body.sockets[socket] = null;
    body.integrity[socket] = 0;
    body.heat[socket] = 0;
  };

  /* ------------------------------------------------------------------ heat */
  Body.addHeat = function (body, socket, amount) {
    if (!body || !body.heat || !socket) return 0;
    if (body.heat[socket] === undefined) return 0;
    var cap = body.heatCap[socket] || 0;
    body.heat[socket] = DD.clamp((body.heat[socket] || 0) + (amount || 0), 0, cap > 0 ? cap : 0);
    return body.heat[socket];
  };

  Body.overheated = function (body, socket) {
    if (!body || !body.heat || Body.isStump(body, socket)) return false;
    var cap = body.heatCap[socket] || 0;
    return cap > 0 && (body.heat[socket] || 0) >= cap;
  };

  /* Per-frame cooling. Limbs recover three times faster while walking. */
  Body.cool = function (body, dt) {
    if (!body || !body.heat || !(dt > 0)) return;
    var mult = 1.0;
    if (DD.Run && DD.Run.state && DD.Run.state.status === 'explore') mult = 3.0;
    for (var i = 0; i < DD.SOCKETS.length; i++) {
      var s = DD.SOCKETS[i];
      var h = body.heat[s];
      if (!(h > 0)) continue;
      body.heat[s] = Math.max(0, h - (body.coolRate[s] || 0) * dt * mult);
    }
  };

  /* End-of-combat-turn cooling: coolRate plus the coolBonus passive.
   * Omit the socket to cool the whole body. */
  Body.coolTurn = function (body, socket) {
    if (!body || !body.heat) return;
    var bonus = Body.passiveTotals(body).coolBonus || 0;
    var list = socket ? [socket] : DD.SOCKETS;
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (body.heat[s] === undefined || !(body.heat[s] > 0)) continue;
      body.heat[s] = Math.max(0, body.heat[s] - (body.coolRate[s] || 0) - bonus);
    }
  };

  /* -------------------------------------------------------------- passives */
  Body.passiveTotals = function (body) {
    var out = {};
    if (!body || !body.sockets) return out;
    for (var i = 0; i < DD.SOCKETS.length; i++) {
      var limb = Body.limbOf(body, DD.SOCKETS[i]);
      if (!limb) continue;
      if (limb.maxHpBonus) out.maxHpBonus = (out.maxHpBonus || 0) + limb.maxHpBonus;
      var p = limb.passive;
      if (p && p.id) out[p.id] = (out[p.id] || 0) + (p.v || 0);
    }
    return out;
  };

  /* Limb bonus plus the maxHpBonus passive — both folded into passiveTotals. */
  Body.maxHpBonus = function (body) {
    return Body.passiveTotals(body).maxHpBonus || 0;
  };

  /* ------------------------------------------------------------------- HUD */
  Body.describe = function (body) {
    var out = [];
    if (!body || !body.sockets) return out;
    for (var i = 0; i < DD.SOCKETS.length; i++) {
      var socket = DD.SOCKETS[i];
      var limb = Body.limbOf(body, socket);
      var cap = (body.heatCap && body.heatCap[socket]) || 0;
      var heat = (body.heat && body.heat[socket]) || 0;
      out.push({
        socket: socket,
        limb: limb,
        heat: heat,
        heatFrac: cap > 0 ? DD.clamp(heat / cap, 0, 1) : 0,
        integrity: (body.integrity && body.integrity[socket]) || 0,
        intact: !!limb
      });
    }
    return out;
  };
})();
