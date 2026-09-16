/* Graft: sewing a dead thing's arm onto yourself while the clock runs.
 * DD.View.ui.graft draws the whole screen; this scene drives the cursor. */
(function () {
  'use strict';
  var DD = window.DD;

  /* DD.View.ui.graft draws the anatomical diagram at this origin, and its
   * socketRect() expects the content origin inside that box (panel padding
   * plus the title band), so both have to be mirrored here. */
  var DIAG = { x: 300, y: 56, pad: 4, head: 16 };

  /* Where each socket sits in the diagram, for directional movement. */
  var POS = {
    head: [1, 0], torso: [1, 1], armL: [0, 1], armR: [2, 1], legL: [0, 2], legR: [2, 2]
  };
  var DIRS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'
  };
  var KEYS = ['Escape', 'Enter', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyA', 'KeyS', 'KeyD'];

  var cur = null;        // socket under the cursor
  var limb = null;       // the limb waiting on the table
  var gone = false;
  var scene;

  function sfx(name) {
    if (DD.Audio && DD.Audio.sfx && DD.Audio.sfx.play) DD.Audio.sfx.play(name);
  }

  function limbById(id) {
    var by = DD.Data && DD.Data.limbById;
    return (by && id && by[id]) || null;
  }

  function terminal(status) {
    return status === 'dead' || status === 'timedout' || status === 'escaped';
  }

  /* The sockets this limb may legally fill: arm fits armL and armR, and so on. */
  function legal() {
    if (!limb) return [];
    if (DD.Body && DD.Body.socketsFor) return DD.Body.socketsFor(limb.slot);
    return [];
  }

  function canFill(socket) { return legal().indexOf(socket) >= 0; }

  function rectOf(socket) {
    var h = DD.View && DD.View.hud;
    if (!h || !h.socketRect || !socket) return null;
    var r = h.socketRect(socket, DIAG.x + DIAG.pad, DIAG.y + DIAG.head, 1);
    return (r && r.w) ? r : null;
  }

  function socketAt(x, y) {
    var all = DD.SOCKETS || [];
    if (typeof x !== 'number' || typeof y !== 'number') return null;
    for (var i = 0; i < all.length; i++) {
      var r = rectOf(all[i]);
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return all[i];
    }
    return null;
  }

  /* Nearest legal socket in a direction, in diagram space: straight neighbours
   * win, and an illegal one is stepped over rather than blocking the cursor. */
  function move(dir) {
    var from = POS[cur];
    if (!from) return false;
    var dx = dir === 'left' ? -1 : (dir === 'right' ? 1 : 0);
    var dy = dir === 'up' ? -1 : (dir === 'down' ? 1 : 0);
    var list = legal(), best = null, bestD = 0, i, p, along, across, d;
    for (i = 0; i < list.length; i++) {
      p = POS[list[i]];
      if (!p || list[i] === cur) continue;
      var vx = p[0] - from[0], vy = p[1] - from[1];
      along = dx ? vx * dx : vy * dy;
      if (along <= 0) continue;
      across = dx ? Math.abs(vy) : Math.abs(vx);
      d = along + across * 2;
      if (best === null || d < bestD) { best = list[i]; bestD = d; }
    }
    if (best === null) return false;
    cur = best;
    sfx('ui_move');
    return true;
  }

  function confirm() {
    if (gone || !limb || !cur || !canFill(cur)) { if (!gone) sfx('ui_move'); return; }
    var ok = (DD.Run && DD.Run.graft) ? DD.Run.graft(cur, limb.id) : false;
    if (!ok) { sfx('ui_move'); return; }
    gone = true;
    sfx('graft');
    if (DD.Explore) DD.Explore.pendingGraft = null;
    DD.Scenes.pop();
  }

  /* Cancelling loses the limb for good, and it has to feel like that. */
  function cancel() {
    if (gone) return;
    gone = true;
    if (DD.Explore) DD.Explore.pendingGraft = null;
    if (DD.Run && DD.Run.say) DD.Run.say(DD.t('Dejas el miembro en el suelo. Se pierde.'));
    sfx('ui_move');
    DD.Scenes.pop();
  }

  function pump() {
    var I = DD.Input;
    if (!I || !I.consume) return;
    for (var i = 0; i < KEYS.length; i++) {
      if (I.consume(KEYS[i])) scene.key({ code: KEYS[i] });
    }
    if (I.pointer && I.pointer.justDown) scene.pointer('down');
  }

  scene = DD.Scenes.define('graft', {
    enter: function () {
      gone = false;
      limb = limbById(DD.Explore && DD.Explore.pendingGraft);
      var list = legal();
      cur = list.length ? list[0] : (DD.SOCKETS && DD.SOCKETS[0]) || null;
    },

    update: function (dt) {
      dt = dt || 0;
      if (DD.Run && DD.Run.tick) DD.Run.tick(dt);          // the clock never stops
      var s = DD.Run && DD.Run.state;
      if (s && terminal(s.status)) { DD.Scenes.replace('end', { result: s.status }); return; }
      if (gone) return;

      var p = DD.Input && DD.Input.pointer;
      if (p && typeof p.x === 'number') {
        var hover = socketAt(p.x, p.y);
        if (hover && canFill(hover)) cur = hover;          // the pointer owns the cursor
      }
      if (DD.View && DD.View.ui) DD.View.ui.cursorSocket = cur;
      pump();
    },

    draw: function () {
      var U = DD.View && DD.View.ui;
      if (!U || !U.graft) {
        if (DD.Canvas && DD.Canvas.clear) DD.Canvas.clear();
        return;
      }
      /* The frozen view resolves the highlighted socket from DD.Input.pointer
       * and overwrites DD.View.ui.cursorSocket, so the pointer is pinned to
       * this scene's cursor for the draw and put back afterwards. */
      var p = DD.Input && DD.Input.pointer;
      var px = p ? p.x : 0, py = p ? p.y : 0;
      var r = cur ? rectOf(cur) : null;
      if (p && r) { p.x = r.x + r.w / 2; p.y = r.y + r.h / 2; }
      try { U.graft(); } finally { if (p) { p.x = px; p.y = py; } }
    },

    key: function (e) {
      var code = e && e.code;
      if (!code || gone) return;
      if (code === 'Escape') { cancel(); return; }
      if (code === 'Enter' || code === 'Space') { confirm(); return; }
      if (DIRS[code]) move(DIRS[code]);
    },

    pointer: function (phase) {
      if (phase !== 'down' || gone) return;
      var p = DD.Input && DD.Input.pointer;
      var s = socketAt(p && p.x, p && p.y);
      if (!s || !canFill(s)) return;
      cur = s;
      confirm();
    }
  });
})();
