/* DD.Heat — the clock inside the body. Heat is the price of every card.
 * Reaching heatCap burns integrity and the player; at zero integrity the
 * socket breaks and becomes a stump. */
(function () {
  'use strict';
  var DD = window.DD;

  var Heat = DD.Heat = DD.Heat || {};

  var OVERHEAT_INTEGRITY = 8;   /* integrity lost per overheat */
  var OVERHEAT_DAMAGE = 4;      /* HP lost per overheat */
  var HEAT_UNIT = 25;           /* heat per unit used by damagePerHeat / gainBlockPerHeat */

  function runState() { return (DD.Run && DD.Run.state) || null; }
  function body() { var s = runState(); return (s && s.body) || null; }
  function label(socket) { return (DD.SOCKET_LABEL && DD.SOCKET_LABEL[socket]) || socket; }

  function say(text) { if (DD.Run && DD.Run.say) DD.Run.say(text); }
  function sfx(name) { if (DD.Audio && DD.Audio.sfx && DD.Audio.sfx.play) DD.Audio.sfx.play(name); }

  /* ----------------------------------------------------------- overheat */
  function overheat(socket, b) {
    var s = runState();
    b = b || body();
    if (!s || !b) return;
    var cap = b.heatCap[socket] || 0;
    b.integrity[socket] = Math.max(0, (b.integrity[socket] || 0) - OVERHEAT_INTEGRITY);
    b.heat[socket] = cap * 0.5;
    sfx('overheat');
    say('¡' + label(socket) + ' se sobrecalienta! Pierdes ' + OVERHEAT_DAMAGE + ' de vida.');
    if (DD.Run.damage) DD.Run.damage(OVERHEAT_DAMAGE);
    if ((b.integrity[socket] || 0) <= 0) breakSocket(socket, b);
  }

  /* The limb tears off: the socket becomes a stump and its cards leave the
   * current fight (the hand keeps whatever is already held). */
  function breakSocket(socket, b) {
    var s = runState();
    b = b || body();
    if (!s || !b || !DD.Body) return;
    DD.Body.breakSocket(b, socket);
    if (s.stats) s.stats.lost = (s.stats.lost || 0) + 1;
    sfx('break');
    say(label(socket) + ' se desprende y queda un muñón.');
    var e = s.encounter;
    if (e) {
      e.drawPile = filterSocket(e.drawPile, socket);
      e.discardPile = filterSocket(e.discardPile, socket);
    }
    if (DD.Run.refreshMaxHp) DD.Run.refreshMaxHp();
  }

  function filterSocket(pile, socket) {
    var out = [];
    if (!pile) return out;
    for (var i = 0; i < pile.length; i++) if (pile[i] && pile[i].socket !== socket) out.push(pile[i]);
    return out;
  }

  /* ------------------------------------------------------------ public API */
  /* Returns the socket's heat after the change. Negative amounts are plain
   * cooling and skip heatResist. */
  Heat.add = function (socket, amount) {
    var b = body();
    if (!b || !socket || !DD.Body) return 0;
    if (b.heat[socket] === undefined || DD.Body.isStump(b, socket)) return 0;
    var v = amount || 0;
    if (v > 0) {
      var resist = DD.Body.passiveTotals(b).heatResist || 0;
      v -= resist;
      if (v <= 0) return b.heat[socket] || 0;
    }
    DD.Body.addHeat(b, socket, v);
    if (DD.Body.overheated(b, socket)) overheat(socket, b);
    return b.heat[socket] || 0;
  };

  Heat.overheatCheck = function (socket) {
    var b = body();
    if (!b || !DD.Body.overheated(b, socket)) return false;
    overheat(socket, b);
    return true;
  };

  Heat.frac = function (socket) {
    var b = body();
    if (!b || !b.heat || b.heat[socket] === undefined) return 0;
    var cap = b.heatCap[socket] || 0;
    if (cap <= 0) return 0;
    return DD.clamp(b.heat[socket] / cap, 0, 1);
  };

  /* 0 calm, 1 warm, 2 hot, 3 critical (>= 0.85 of heatCap). */
  Heat.tier = function (socket) {
    var f = Heat.frac(socket);
    if (f >= 0.85) return 3;
    if (f >= 0.6) return 2;
    if (f >= 0.3) return 1;
    return 0;
  };

  /* Heat unit count used by damagePerHeat / gainBlockPerHeat. */
  Heat.units = function (socket) {
    var b = body();
    if (!b || !b.heat || b.heat[socket] === undefined) return 0;
    return Math.floor((b.heat[socket] || 0) / HEAT_UNIT);
  };
})();
