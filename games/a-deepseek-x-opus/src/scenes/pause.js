/* Pause: transparent, so the fight (or the corridor) stays visible behind it.
 * The clock does not pause — and the overlay says so. */
(function () {
  'use strict';
  var DD = window.DD;

  var ITEMS = ['CONTINUAR', 'CÓDIGO ANATÓMICO', 'ABANDONAR LA TORRE'];
  var KEYS = ['Escape', 'Backspace', 'Enter', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'];

  /* Mirrors DD.View.ui.pause: the panel, and the row box DD.View.ui.menu draws
   * inside it (its own defaults are 22 px rows with a 2 px gap and an 8 px
   * overhang either side). */
  var PANEL = { x: 180, y: 84, w: 280, h: 210 };
  var ROW = { x: 214, y: 126, w: 212, rowH: 22, gap: 2 };
  var CLOCK_Y = 300;

  var index = 0;
  var live = false;
  var lastP = { x: -1, y: -1 };
  var scene;

  /* Hover only follows a pointer that actually moved, so a mouse parked over
   * the panel does not fight the keyboard. */
  function pointerMoved() {
    var p = DD.Input && DD.Input.pointer;
    if (!p || typeof p.x !== 'number') return false;
    if (p.x === lastP.x && p.y === lastP.y) return false;
    lastP.x = p.x;
    lastP.y = p.y;
    return true;
  }

  function sfx(name) {
    if (DD.Audio && DD.Audio.sfx && DD.Audio.sfx.play) DD.Audio.sfx.play(name);
  }

  function terminal(status) {
    return status === 'dead' || status === 'timedout' || status === 'escaped';
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function rowAt(p) {
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return -1;
    for (var i = 0; i < ITEMS.length; i++) {
      var y = ROW.y + i * (ROW.rowH + ROW.gap);
      if (p.y >= y && p.y <= y + ROW.rowH && p.x >= ROW.x && p.x <= ROW.x + ROW.w) return i;
    }
    return -1;
  }

  function move(d) {
    var n = clamp(index + d, 0, ITEMS.length - 1);
    if (n === index) return;
    index = n;
    sfx('ui_move');
  }

  function abandon() {
    if (DD.Run && DD.Run.die) DD.Run.die();
    var s = DD.Run && DD.Run.state;
    DD.Scenes.replace('end', { result: (s && s.status) || 'dead' });
  }

  function activate(i) {
    if (i === 0) { sfx('ui_select'); DD.Scenes.pop(); return; }
    if (i === 1) { sfx('ui_select'); DD.Scenes.push('codex', { from: 'run' }); return; }
    if (i === 2) abandon();
  }

  function pump() {
    var I = DD.Input;
    if (!I || !I.consume) return;
    for (var i = 0; i < KEYS.length; i++) {
      if (I.consume(KEYS[i])) scene.key({ code: KEYS[i] });
    }
    if (I.pointer && I.pointer.justDown) scene.pointer('down');
  }

  scene = DD.Scenes.define('pause', {
    transparent: true,

    enter: function () {
      index = 0;
      lastP.x = -1;
      lastP.y = -1;
      var s = DD.Run && DD.Run.state;
      live = !!(s && !terminal(s.status));
    },

    update: function (dt) {
      dt = dt || 0;
      if (DD.Run && DD.Run.tick) DD.Run.tick(dt);          // the clock never stops
      var s = DD.Run && DD.Run.state;
      if (live && s && terminal(s.status)) { DD.Scenes.replace('end', { result: s.status }); return; }
      if (pointerMoved()) scene.pointer('move');
      pump();
    },

    draw: function () {
      var U = DD.View && DD.View.ui;
      if (!U || !U.pause) {
        if (DD.Canvas && DD.Canvas.clear) DD.Canvas.clear();
        return;
      }
      U.pause(ITEMS, index);
      if (!DD.Pixel || !DD.Pixel.text) return;
      var s = DD.Run && DD.Run.state;
      var left = (s && DD.clock) ? DD.clock(s.timeLeft) : '--:--';
      DD.Pixel.dim(PANEL.x, CLOCK_Y, PANEL.w, 16, 0.8, DD.C.void);
      DD.Pixel.text('El reloj no se detiene - quedan ' + left, DD.VW / 2, CLOCK_Y + 5, {
        align: 'center', color: DD.C.gold
      });
    },

    key: function (e) {
      var code = e && e.code;
      if (!code) return;
      if (code === 'Escape' || code === 'Backspace') { DD.Scenes.pop(); return; }
      if (code === 'ArrowUp' || code === 'KeyW') { move(-1); return; }
      if (code === 'ArrowDown' || code === 'KeyS') { move(1); return; }
      if (code === 'Enter') activate(index);
    },

    pointer: function (phase) {
      var i = rowAt(DD.Input && DD.Input.pointer);
      if (i < 0) return;
      index = i;
      if (phase === 'down') activate(i);
    }
  });
})();
