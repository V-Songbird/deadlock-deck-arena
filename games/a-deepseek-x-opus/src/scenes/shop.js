/* Shop: the vestibule's cosmetics. Shards come out of the tower, so nothing
 * here touches a run — no clock, no ticking. */
(function () {
  'use strict';
  var DD = window.DD;

  var KEYS = ['Escape', 'Backspace', 'Enter', 'Space'];

  /* Mirrors DD.View.ui.shop's row layout, so the pointer can hit a row. */
  var ROW_H = 48;
  var CONTENT = { x: 16, y: 64, w: 608, h: 270 };
  var HEAD_HINT = { x: 400, y: 15 };

  var HOLD_DELAY = 0.3;
  var HOLD_REPEAT = 0.07;

  var selected = 0;
  var scroll = 0;
  var hold = { dir: 0, t: 0 };
  var lastP = { x: -1, y: -1 };
  var scene;

  /* Hover only follows a pointer that actually moved, so a mouse parked over
   * the list does not fight the keyboard. */
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

  function list() { return (DD.Data && DD.Data.cosmetics) || []; }

  function owned(id) {
    if (DD.Progress && DD.Progress.owned) return !!DD.Progress.owned(id);
    var m = DD.Run && DD.Run.meta;
    var un = m && m.cosmetics && m.cosmetics.unlocked;
    return !!(un && un.indexOf(id) >= 0);
  }

  function maxScroll() {
    return Math.max(0, list().length * ROW_H - CONTENT.h);
  }

  function keepVisible() {
    var top = selected * ROW_H, bot = top + ROW_H;
    if (top - scroll < 0) scroll = top;
    else if (bot - scroll > CONTENT.h) scroll = bot - CONTENT.h;
    var max = maxScroll();
    if (scroll < 0) scroll = 0;
    if (scroll > max) scroll = max;
  }

  function move(d) {
    var n = list().length;
    if (!n) return;
    var next = selected + d;
    if (next < 0) next = 0;
    if (next > n - 1) next = n - 1;
    if (next === selected) return;
    selected = next;
    sfx('ui_move');
    keepVisible();
  }

  /* Held arrows walk the list: one row on the press, then a steady repeat. */
  function held(dt) {
    var I = DD.Input;
    var d = 0;
    if (I && I.down) {
      d = (I.down('ArrowDown') || I.down('KeyS')) ? 1 : ((I.down('ArrowUp') || I.down('KeyW')) ? -1 : 0);
    }
    if (!d) { hold.dir = 0; hold.t = 0; return 0; }
    if (d !== hold.dir) { hold.dir = d; hold.t = HOLD_DELAY; return d; }
    hold.t -= dt;
    if (hold.t <= 0) { hold.t = HOLD_REPEAT; return d; }
    return 0;
  }

  function activate() {
    var cos = list()[selected];
    if (!cos) return;
    if (owned(cos.id)) {
      var eq = (DD.Progress && DD.Progress.equipCosmetic) ? DD.Progress.equipCosmetic(cos.id) : false;
      sfx(eq ? 'ui_select' : 'ui_move');
      return;
    }
    var bought = (DD.Progress && DD.Progress.unlockCosmetic) ? DD.Progress.unlockCosmetic(cos.id) : false;
    if (!bought) { sfx('ui_move'); return; }
    sfx('loot');
    if (DD.Progress.equipCosmetic) DD.Progress.equipCosmetic(cos.id);   // wear what you paid for
  }

  function rowAt(p) {
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return -1;
    if (p.x < CONTENT.x || p.x > CONTENT.x + CONTENT.w) return -1;
    for (var i = 0; i < list().length; i++) {
      var y = CONTENT.y + i * ROW_H - scroll;
      if (p.y >= y && p.y <= y + ROW_H - 4) return i;
    }
    return -1;
  }

  function pump() {
    var I = DD.Input;
    if (!I || !I.consume) return;
    for (var i = 0; i < KEYS.length; i++) {
      if (I.consume(KEYS[i])) scene.key({ code: KEYS[i] });
    }
    if (I.pointer && I.pointer.justDown) scene.pointer('down');
  }

  scene = DD.Scenes.define('shop', {
    enter: function () {
      selected = 0;
      scroll = 0;
      hold.dir = 0;
      hold.t = 0;
      lastP.x = -1;
      lastP.y = -1;
    },

    update: function (dt) {
      var d = held(dt || 0);
      if (d) move(d);
      if (pointerMoved()) scene.pointer('move');
      pump();
    },

    draw: function () {
      var U = DD.View && DD.View.ui;
      if (!U || !U.shop) {
        if (DD.Canvas && DD.Canvas.clear) DD.Canvas.clear();
        return;
      }
      U.shop(selected, scroll);
      if (DD.Pixel && DD.Pixel.text) {
        DD.Pixel.text(DD.t('ENTER: elegir - ESC: volver'), HEAD_HINT.x, HEAD_HINT.y, {
          align: 'center', color: DD.C.textDim
        });
      }
    },

    key: function (e) {
      var code = e && e.code;
      if (!code) return;
      if (code === 'Escape' || code === 'Backspace') { DD.Scenes.pop(); return; }
      if (code === 'Enter' || code === 'Space') activate();
    },

    pointer: function (phase) {
      var i = rowAt(DD.Input && DD.Input.pointer);
      if (i < 0) return;
      selected = i;
      keepVisible();
      if (phase === 'down') activate();
    }
  });
})();
