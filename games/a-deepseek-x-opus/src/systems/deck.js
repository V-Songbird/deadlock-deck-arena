/* DD.Deck — the deck is a projection of the body.
 * Six sockets walk in order; every equipped limb contributes its cards,
 * every stump contributes the stump hand. Entries are {uid, id, socket}. */
(function () {
  'use strict';
  var DD = window.DD;

  var Deck = DD.Deck = DD.Deck || {};

  /* The extra stump card, chosen by socket name so a given stump always
   * deals the same third card. */
  var STUMP_EXTRA = ['stump_guard', 'stump_scrabble', 'stump_lurch', 'stump_screech', 'stump_bite'];

  /* Uids stay unique across rebuilds: a stale card in hand can never
   * collide with a freshly drawn one. */
  var uidSeq = 0;
  function nextUid() { uidSeq++; return 'k' + uidSeq; }

  Deck.stumpCards = function (socket) {
    var h = DD.hashStr(String(socket === undefined || socket === null ? '' : socket));
    return ['stump_punch', 'stump_punch', STUMP_EXTRA[h % STUMP_EXTRA.length]];
  };

  Deck.build = function (body) {
    var out = [];
    if (!body || !body.sockets || !DD.Body) return out;
    for (var i = 0; i < DD.SOCKETS.length; i++) {
      var socket = DD.SOCKETS[i];
      var ids;
      if (DD.Body.isStump(body, socket)) {
        ids = Deck.stumpCards(socket);
      } else {
        var limb = DD.Body.limbOf(body, socket);
        ids = (limb && limb.cards) || [];
      }
      for (var k = 0; k < ids.length; k++) {
        if (!ids[k]) continue;
        out.push({ uid: nextUid(), id: ids[k], socket: socket });
      }
    }
    return out;
  };
})();
