/* DD.Explore — exploration logic over the tower grid: movement, traps, pickups,
 * enemies, loot and interactions. Pure logic, no drawing (SPEC.md 5.7). */
(function () {
  'use strict';
  var DD = window.DD;
  var Explore = DD.Explore = DD.Explore || {};

  var STEP_TIME = 1 / 6;      // a held direction moves one tile every 1/6 s
  var BUMP_TIME = 0.14;       // wall-bump feedback timer
  var ENEMY_STEP = 0.35;      // seconds per enemy tile
  var ENEMY_SIGHT = 7;        // tiles
  var MSG_LIFE = 1.6;
  var MSG_MAX = 24;
  var LOOT_RADIUS = 3;        // how far combat loot lands from the player
  var ALTAR_COST = 10;        // residue per altar favour
  var ALTAR_HEAL = 20;
  var ALTAR_REPAIR = 10;

  var messages = Explore.messages = [];
  var trapsArmed = Explore.trapsArmed = [];
  Explore.pendingGraft = null;
  Explore.bump = 0;

  var stepT = 0, lastDx = 0, lastDy = 0, _rng = null;

  /* ================================================================ helpers */

  function state() { return DD.Run && DD.Run.state; }

  function rng() {
    if (!_rng) _rng = DD.rng();
    return _rng;
  }

  function sfx(name) {
    if (DD.Audio && DD.Audio.sfx && DD.Audio.sfx.play) DD.Audio.sfx.play(name);
  }

  function log(text) { if (DD.Run && DD.Run.say) DD.Run.say(text); }

  function say(text, x, y, color) {
    messages.push({ text: text, x: x, y: y, t: MSG_LIFE, color: color || null });
    while (messages.length > MSG_MAX) messages.shift();
  }

  function col(name) {
    var C = DD.C || {};
    return C[name] || C.text || '#e2d9f0';
  }

  function resColor(id) {
    var C = DD.C || {};
    if (id === 'residue') return C.residue;
    if (id === 'oil') return C.rust;
    if (id === 'bandage') return C.bone;
    if (id === 'shard') return C.gold;
    if (id === 'limb') return C.integrity;
    return C.text;
  }

  function entityAt(map, x, y) {
    var list = (map && map.entities) || [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e && !e.dead && e.x === x && e.y === y) return e;
    }
    return null;
  }

  function removeEntity(map, e) {
    var list = (map && map.entities) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] === e) { list.splice(i, 1); return true; }
    }
    return false;
  }

  /* Props and altars are furniture, enemies are bodies: all of them block. */
  function blocks(e) {
    if (!e || e.dead) return false;
    return e.kind === 'prop' || e.kind === 'altar' || e.kind === 'enemy';
  }

  function resDef(id) {
    return (DD.Data && DD.Data.resById && DD.Data.resById[id]) || null;
  }

  function trapDef(id) {
    return (DD.Data && DD.Data.trapById && DD.Data.trapById[id]) || null;
  }

  function enemyDef(id) {
    return (DD.Data && DD.Data.enemyById && DD.Data.enemyById[id]) || null;
  }

  function sockets() { return DD.SOCKETS || ['head', 'torso', 'armL', 'armR', 'legL', 'legR']; }

  function isStump(s, socket) {
    if (DD.Body && DD.Body.isStump) return DD.Body.isStump(s.body, socket);
    return !(s.body && s.body.sockets && s.body.sockets[socket]);
  }

  function limbOf(s, socket) {
    var id = (s.body && s.body.sockets) ? s.body.sockets[socket] : null;
    if (!id || !DD.Data || !DD.Data.limbById) return null;
    return DD.Data.limbById[id] || null;
  }

  function clamp(v, lo, hi) {
    if (DD.clamp) return DD.clamp(v, lo, hi);
    return v < lo ? lo : (v > hi ? hi : v);
  }

  /* ============================================================== lifecycle */

  Explore.reset = function () {
    messages.length = 0;
    trapsArmed.length = 0;
    Explore.pendingGraft = null;
    Explore.bump = 0;
    stepT = 0; lastDx = 0; lastDy = 0;
  };

  Explore.update = function (dt) {
    var s = state();
    if (!s || !s.map || !DD.Tower || s.status !== 'explore') return;
    dt = dt || 0;

    if (Explore.bump > 0) Explore.bump -= dt;
    if (s.player.flash > 0) s.player.flash -= dt;
    if (s.player.invuln > 0) s.player.invuln -= dt;
    decayMessages(dt);

    if (DD.Body && DD.Body.cool && s.body) DD.Body.cool(s.body, dt);

    moveStep(s, dt);
    updateTraps(s, dt);
    if (s.status !== 'explore') return;

    updateEnemies(s, dt);
    if (s.status !== 'explore') return;

    spawnLoot(s);
    Explore.pickupAt(s.player.x, s.player.y);

    if (interactPressed()) Explore.interact();

    if (s.hp <= 0) DD.Run.die();
  };

  function decayMessages(dt) {
    for (var i = messages.length - 1; i >= 0; i--) {
      messages[i].t -= dt;
      if (messages[i].t <= 0) messages.splice(i, 1);
    }
  }

  /* =============================================================== movement */

  function moveStep(s, dt) {
    var dx = 0, dy = 0;
    if (DD.Input && DD.Input.axis) {
      var ax = DD.Input.axis();
      if (ax.x || ax.y) {
        if (Math.abs(ax.x) >= Math.abs(ax.y)) dx = ax.x > 0 ? 1 : -1;
        else dy = ax.y > 0 ? 1 : -1;
      }
    }

    if (!dx && !dy) {
      s.player.moving = false;
      s.player.anim = 0;
      stepT = 0; lastDx = 0; lastDy = 0;
      return;
    }

    s.player.moving = true;
    s.player.anim += dt;
    s.player.dir = dy > 0 ? 'down' : (dy < 0 ? 'up' : 'side');

    // A fresh direction steps at once, so a tap moves exactly one tile.
    if (dx !== lastDx || dy !== lastDy) {
      lastDx = dx; lastDy = dy;
      if (!Explore.tryMove(dx, dy)) Explore.bump = BUMP_TIME;
      stepT = STEP_TIME;
      return;
    }

    stepT -= dt;
    if (stepT <= 0) {
      if (!Explore.tryMove(dx, dy)) Explore.bump = BUMP_TIME;
      stepT = STEP_TIME;
    }
  }

  Explore.tryMove = function (dx, dy) {
    var s = state();
    if (!s || !s.map || !DD.Tower) return false;
    if (!dx && !dy) return false;
    var nx = s.player.x + dx, ny = s.player.y + dy;
    if (!DD.Tower.walkable(s.map, nx, ny)) return false;
    var e = entityAt(s.map, nx, ny);
    if (blocks(e)) return false;

    s.player.x = nx;
    s.player.y = ny;
    s.player.moving = true;
    sfx('step');
    return true;
  };

  /* ================================================================== traps */

  function updateTraps(s, dt) {
    var list = s.map.entities || [], i, e, def;
    trapsArmed.length = 0;
    var px = s.player.x, py = s.player.y;

    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (!e || e.kind !== 'trap' || e.dead) continue;
      if (!e.data) e.data = {};
      if (e.data.phase === undefined) e.data.phase = 0;
      def = trapDef(e.id);
      if (!def) { e.data.phase = 0; e.active = false; continue; }

      if (e.data.phase === 0) {
        if (trapTriggered(s, e, px, py)) {
          e.data.phase = 1;
          e.active = true;
          e.timer = def.telegraph || 0.4;
        }
      } else if (e.data.phase === 1) {
        e.timer -= dt;
        trapsArmed.push(e);
        if (e.timer <= 0) {
          fireTrap(s, e, def);
          e.data.phase = 2;
          e.active = true;
          e.timer = def.cooldown || 2;
        }
      } else {
        e.timer -= dt;
        if (e.timer <= 0) { e.data.phase = 0; e.active = false; }
      }
    }
  }

  /* On the tile, or adjacent with a clear line to the player. */
  function trapTriggered(s, e, px, py) {
    if (e.x === px && e.y === py) return true;
    if (Math.abs(e.x - px) > 1 || Math.abs(e.y - py) > 1) return false;
    return DD.Tower.lineOfSight(s.map, e.x, e.y, px, py);
  }

  function fireTrap(s, e, def) {
    sfx('trap');
    var dmg = def.damage || 0;
    if (dmg > 0) {
      s.player.flash = 0.3;
      s.player.invuln = 0.5;
      DD.Run.damage(dmg);
      say((def.name || 'Trampa') + ': -' + dmg, e.x, e.y, col('hp'));
    }
    var heat = def.heat || 0;
    if (heat > 0 && DD.Heat && DD.Heat.add && s.body) {
      var all = sockets();
      for (var i = 0; i < all.length; i++) {
        if (isStump(s, all[i])) continue;
        DD.Heat.add(all[i], heat);
      }
    }
    var integ = def.integrity || 0;
    if (integ > 0) damageIntegrity(s, integ);
  }

  /* Integrity damage is split across random non-stump sockets. */
  function damageIntegrity(s, amount) {
    if (!s.body || !DD.Body || !s.body.integrity) return;
    var all = sockets(), pool = [], i;
    for (i = 0; i < all.length; i++) if (!isStump(s, all[i])) pool.push(all[i]);
    if (!pool.length) return;

    shuffle(pool);
    var share = Math.max(1, Math.floor(amount / pool.length));
    var left = amount;
    for (i = 0; i < pool.length && left > 0; i++) {
      var socket = pool[i];
      var d = (i === pool.length - 1) ? left : Math.min(share, left);
      left -= d;
      var cur = s.body.integrity[socket] || 0;
      var nv = cur - d;
      s.body.integrity[socket] = nv > 0 ? nv : 0;
      if (nv <= 0 && DD.Body.breakSocket) {
        DD.Body.breakSocket(s.body, socket);
        if (s.stats) s.stats.lost = (s.stats.lost || 0) + 1;
        say((DD.SOCKET_LABEL && DD.SOCKET_LABEL[socket]) || socket, s.player.x, s.player.y, col('blood'));
        sfx('break');
      }
    }
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng().next() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* =============================================================== enemies */

  function updateEnemies(s, dt) {
    var list = s.map.entities || [], i, e, dx, dy;
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (!e || e.kind !== 'enemy' || e.dead) continue;

      dx = s.player.x - e.x;
      dy = s.player.y - e.y;
      var sees = (dx * dx + dy * dy) <= (ENEMY_SIGHT * ENEMY_SIGHT) &&
                 DD.Tower.lineOfSight(s.map, e.x, e.y, s.player.x, s.player.y);
      e.active = sees;

      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) { startCombat(s, e); return; }
      if (!sees) continue;

      e.timer -= dt;
      if (e.timer <= 0) {
        e.timer = ENEMY_STEP;
        stepEnemy(s, e, dx, dy);
      }
    }
  }

  function stepEnemy(s, e, dx, dy) {
    var sx = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
    var sy = dy > 0 ? 1 : (dy < 0 ? -1 : 0);
    var opts = [];
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (sx) opts.push([sx, 0]);
      if (sy) opts.push([0, sy]);
    } else {
      if (sy) opts.push([0, sy]);
      if (sx) opts.push([sx, 0]);
    }
    for (var i = 0; i < opts.length; i++) {
      var nx = e.x + opts[i][0], ny = e.y + opts[i][1];
      if (nx === s.player.x && ny === s.player.y) continue;
      if (!DD.Tower.walkable(s.map, nx, ny)) continue;
      var other = entityAt(s.map, nx, ny);
      if (other && other !== e && blocks(other)) continue;
      e.x = nx; e.y = ny;
      return true;
    }
    return false;
  }

  function startCombat(s, e) {
    if (DD.Combat && DD.Combat.start) DD.Combat.start({ enemies: [e.id], floor: s.floor });
    s.status = 'combat';
    s.player.moving = false;
    s.player.anim = 0;
    removeEntity(s.map, e);
    sfx('growl');
    var def = enemyDef(e.id);
    log('¡' + ((def && def.name) || 'Algo') + ' te corta el paso!');
  }

  /* ================================================================== loot */

  function spawnLoot(s) {
    var pending = s.pendingLoot;
    if (!pending || !pending.length || !s.map.entities) return;
    var i, entry, limbId, pos;
    for (i = 0; i < pending.length; i++) {
      entry = pending[i];
      limbId = (typeof entry === 'string') ? entry : (entry && (entry.limbId || entry.id));
      if (!limbId) continue;
      pos = freeNear(s, s.player.x, s.player.y, LOOT_RADIUS);
      if (!pos) continue;
      s.map.entities.push({
        kind: 'resource', x: pos.x, y: pos.y, id: 'limb',
        data: { limbId: limbId }, dead: false, active: false, timer: 0
      });
      say('Restos en el suelo.', pos.x, pos.y, col('integrity'));
    }
    pending.length = 0;
  }

  /* Nearest walkable tile without a blocking entity, spiralling outwards. */
  function freeNear(s, cx, cy, maxR) {
    for (var r = 0; r <= maxR; r++) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          var x = cx + dx, y = cy + dy;
          if (!DD.Tower.walkable(s.map, x, y)) continue;
          var e = entityAt(s.map, x, y);
          if (e && (blocks(e) || e.kind === 'resource')) continue;
          return { x: x, y: y };
        }
      }
    }
    return null;
  }

  /* ============================================================== pickups */

  Explore.pickupAt = function (x, y) {
    var s = state();
    if (!s || !s.map) return false;
    var e = entityAt(s.map, x, y);
    if (!e || e.kind !== 'resource' || e.dead) return false;

    // A severed limb opens the graft screen instead of being consumed here.
    if (e.id === 'limb' || (e.data && e.data.limbId)) {
      var limbId = (e.data && e.data.limbId) || null;
      removeEntity(s.map, e);
      Explore.pendingGraft = limbId;
      sfx('loot');
      say('Un miembro cercenado.', x, y, col('integrity'));
      if (DD.Scenes && DD.Scenes.has && DD.Scenes.push && DD.Scenes.has('graft')) DD.Scenes.push('graft');
      return true;
    }

    var def = resDef(e.id);
    if (!def) return false;

    var gains = [], n;
    if (def.heal) { n = DD.Run.heal(def.heal); if (n > 0) gains.push('+' + n + ' PV'); }
    if (def.cool) { n = coolAll(s, def.cool); if (n > 0) gains.push('-' + n + ' calor'); }
    if (def.integrity) { n = repairMost(s, def.integrity); if (n > 0) gains.push('+' + n + ' integridad'); }

    n = (e.id === 'shard') ? (def.shard || def.amount || 1) : (def.amount || 1);
    if (e.id === 'residue') { s.residue += n; gains.push('+' + n + ' residuo'); }
    else if (e.id === 'oil') { s.oils += n; gains.push('+' + n + ' aceite'); }
    else if (e.id === 'bandage') { s.bandages += n; gains.push('+' + n + ' venda'); }
    else if (e.id === 'shard') { s.shards += n; gains.push('+' + n + ' esquirla'); }

    removeEntity(s.map, e);
    sfx('pickup');
    say(gains.length ? gains.join('  ') : (def.name || 'Hallazgo'), x, y, resColor(e.id));
    return true;
  };

  /* ============================================================ body repair */

  function coolAll(s, amount) {
    if (!DD.Body || !DD.Body.addHeat || !s.body || !s.body.heat) return 0;
    var all = sockets(), cooled = 0;
    for (var i = 0; i < all.length; i++) {
      if (isStump(s, all[i])) continue;
      var before = s.body.heat[all[i]] || 0;
      if (before <= 0) continue;
      DD.Body.addHeat(s.body, all[i], -amount);
      cooled += before - (s.body.heat[all[i]] || 0);
    }
    return Math.round(cooled);
  }

  function integrityRatio(s, socket) {
    var cur = (s.body.integrity && s.body.integrity[socket]) || 0;
    var limb = limbOf(s, socket);
    var max = (limb && limb.integrity) || 0;
    if (max <= 0) return 1;
    return clamp(cur / max, 0, 1);
  }

  function worstSocket(s) {
    if (!s.body) return null;
    var all = sockets(), worst = null, worstR = 1.1;
    for (var i = 0; i < all.length; i++) {
      if (isStump(s, all[i])) continue;
      var r = integrityRatio(s, all[i]);
      if (r < worstR) { worstR = r; worst = all[i]; }
    }
    return worst;
  }

  function repairMost(s, amount) {
    var socket = worstSocket(s);
    if (!socket || !s.body.integrity) return 0;
    var cur = s.body.integrity[socket] || 0;
    var limb = limbOf(s, socket);
    var max = (limb && limb.integrity) || (cur + amount);
    var nv = Math.min(max, cur + amount);
    s.body.integrity[socket] = nv;
    return nv - cur;
  }

  function maxHeatFrac(s) {
    if (!s.body || !s.body.heat) return 0;
    var all = sockets(), worst = 0;
    for (var i = 0; i < all.length; i++) {
      if (isStump(s, all[i])) continue;
      var cap = (s.body.heatCap && s.body.heatCap[all[i]]) || 0;
      if (cap <= 0) continue;
      var f = clamp((s.body.heat[all[i]] || 0) / cap, 0, 1);
      if (f > worst) worst = f;
    }
    return worst;
  }

  /* =========================================================== interaction */

  function interactPressed() {
    var inp = DD.Input;
    if (!inp) return false;
    if (inp.consume && inp.consume('KeyE')) return true;
    if (inp.btns && inp.btns.vact && inp.btns.vact.active) return true;
    return false;
  }

  Explore.interact = function () {
    var s = state();
    if (!s || !s.map || !DD.Tower) return false;

    var tile = DD.Tower.at(s.map, s.player.x, s.player.y);
    if (tile === DD.TILE_STAIRS && DD.Run.nextFloor) {
      sfx('door');
      DD.Run.nextFloor();
      return true;
    }
    if (tile === DD.TILE_EXIT && DD.Run.escape) {
      DD.Run.escape();
      return true;
    }

    var altar = altarNear(s);
    if (altar) return useAltar(s, altar);
    return false;
  };

  function altarNear(s) {
    var list = s.map.entities || [], px = s.player.x, py = s.player.y;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || e.dead || e.kind !== 'altar') continue;
      if (Math.abs(e.x - px) <= 1 && Math.abs(e.y - py) <= 1) return e;
    }
    return null;
  }

  /* Spends residue on whichever favour hurts least to skip. */
  function useAltar(s, altar) {
    var msg;
    if (s.residue < ALTAR_COST) {
      msg = 'El altar pide ' + ALTAR_COST + ' de residuo.';
      log(msg);
      say(msg, altar.x, altar.y, col('textDim'));
      return true;
    }
    var choice = bestAltarOption(s);
    if (!choice) {
      msg = 'Nada que reparar en tu cuerpo.';
      log(msg);
      say(msg, altar.x, altar.y, col('textDim'));
      return true;
    }

    s.residue -= ALTAR_COST;
    if (choice === 'heal') {
      var h = DD.Run.heal(ALTAR_HEAL);
      msg = 'El altar te devuelve ' + h + ' de vida.';
    } else if (choice === 'cool') {
      coolAll(s, 999);
      msg = 'El altar enfría tus miembros.';
    } else {
      var socket = worstSocket(s);
      var n = repairMost(s, ALTAR_REPAIR);
      msg = 'El altar repara ' + ((DD.SOCKET_LABEL && DD.SOCKET_LABEL[socket]) || socket) + ' (+' + n + ').';
    }
    sfx('levelup');
    log(msg);
    say(msg, altar.x, altar.y, col('integrity'));
    return true;
  }

  function bestAltarOption(s) {
    var best = null, bestScore = 0, score;
    score = 1 - clamp(s.maxHp > 0 ? s.hp / s.maxHp : 1, 0, 1);
    if (score > bestScore) { best = 'heal'; bestScore = score; }

    var socket = worstSocket(s);
    if (socket) {
      score = 1 - integrityRatio(s, socket);
      if (score > bestScore) { best = 'repair'; bestScore = score; }
    }
    score = maxHeatFrac(s);
    if (score > bestScore) { best = 'cool'; bestScore = score; }
    return best;
  }
})();
