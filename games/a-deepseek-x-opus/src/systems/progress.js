/* DD.Progress — the meta layer that survives death: codex, shards, cosmetics.
 * Everything is stored on DD.Run.meta and saved on every mutation. */
(function () {
  'use strict';
  var DD = window.DD;

  var P = DD.Progress = DD.Progress || {};

  function meta() {
    if (!DD.Run) return null;
    if (!DD.Run.meta && DD.Run.loadMeta) DD.Run.loadMeta();
    return DD.Run.meta || null;
  }
  function save() { if (DD.Run && DD.Run.saveMeta) DD.Run.saveMeta(); }

  function cosmeticById(id) {
    var by = DD.Data && DD.Data.cosmeticById;
    return (by && by[id]) || null;
  }

  /* ---------------------------------------------------------------- codex */
  P.discoverLimb = function (id) {
    var m = meta();
    if (!m || !id) return false;
    if (!m.codexLimbs) m.codexLimbs = {};
    if (m.codexLimbs[id]) return false;
    m.codexLimbs[id] = true;
    save();
    return true;
  };

  P.discoverEnemy = function (id) {
    var m = meta();
    if (!m || !id) return false;
    if (!m.codexEnemies) m.codexEnemies = {};
    if (m.codexEnemies[id]) return false;
    m.codexEnemies[id] = true;
    save();
    return true;
  };

  P.knownLimb = function (id) {
    var m = meta();
    return !!(m && m.codexLimbs && id && m.codexLimbs[id]);
  };

  P.knownEnemy = function (id) {
    var m = meta();
    return !!(m && m.codexEnemies && id && m.codexEnemies[id]);
  };

  /* ---------------------------------------------------------------- shards */
  P.addShards = function (n) {
    var m = meta();
    if (!m) return 0;
    m.shards = Math.max(0, (m.shards || 0) + (n || 0));
    save();
    return m.shards;
  };

  P.shards = function () {
    var m = meta();
    return (m && m.shards) || 0;
  };

  /* ------------------------------------------------------------ cosmetics */
  function cosmeticsOf(m) {
    if (!m.cosmetics) m.cosmetics = { equipped: 'default', unlocked: ['default'] };
    if (!m.cosmetics.unlocked) m.cosmetics.unlocked = ['default'];
    if (!m.cosmetics.equipped) m.cosmetics.equipped = 'default';
    return m.cosmetics;
  }

  /* Refuses when the player cannot pay. Already-owned skins are free. */
  P.unlockCosmetic = function (id) {
    var m = meta();
    if (!m || !id) return false;
    var cos = cosmeticById(id);
    if (!cos) return false;
    var c = cosmeticsOf(m);
    if (c.unlocked.indexOf(id) >= 0) return true;
    var cost = cos.cost || 0;
    if ((m.shards || 0) < cost) return false;
    m.shards -= cost;
    c.unlocked.push(id);
    save();
    return true;
  };

  P.equipCosmetic = function (id) {
    var m = meta();
    if (!m || !id) return false;
    var c = cosmeticsOf(m);
    if (c.unlocked.indexOf(id) < 0 || !cosmeticById(id)) return false;
    c.equipped = id;
    save();
    return true;
  };

  P.cosmetic = function () {
    var m = meta();
    var id = (m && m.cosmetics && m.cosmetics.equipped) || 'default';
    return cosmeticById(id) || cosmeticById('default') || null;
  };

  P.owned = function (id) {
    var m = meta();
    return !!(m && m.cosmetics && m.cosmetics.unlocked && m.cosmetics.unlocked.indexOf(id) >= 0);
  };

  /* ------------------------------------------------------------ run record */
  /* Idempotent per run index: DD.Run.recordRun already owns runs/deaths/
   * escapes/shards when the run ends, so this only fills in what is left
   * (the escape best time) and is safe for the end scene to call. */
  P.recordRun = function (result) {
    var m = meta();
    if (!m) return;
    var s = DD.Run.state;
    var idx = s ? s.runIndex : null;
    if (idx !== null && m.lastRunRecorded === idx) return;
    if (idx !== null) m.lastRunRecorded = idx;
    if (idx !== null) m.runs = Math.max(m.runs || 0, idx);
    if (result === 'escaped' && s) {
      var left = Math.round(s.timeLeft);
      if (m.bestTime === null || m.bestTime === undefined || left > m.bestTime) m.bestTime = left;
    }
    save();
  };
})();
