/* Codex: the blueprints of everything you have killed or worn. This is the
 * progress that survives death, and it keeps ticking while you read it. */
(function () {
  'use strict';
  var DD = window.DD;

  var TABS = ['limbs', 'enemies', 'help'];
  var KEYS = ['Escape', 'Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'KeyQ', 'KeyE'];

  /* Mirrors DD.View.ui.codex's content box and row pitches: the view never
   * reports how tall a tab is, and the scroll needs a bottom. */
  var CONTENT_H = 270;
  var COLS = { limbs: 2, enemies: 3 };
  var PITCH = { limbs: 274, enemies: 166 };
  var HELP_MAX = 220;               // estimated: the help tab is prose, not a grid

  var ROW = 36;                     // px per scroll step
  var HOLD_DELAY = 0.3;
  var HOLD_REPEAT = 0.07;

  var tab = 'limbs';
  var scroll = 0;
  var live = false;                 // a run is under this screen, so it ticks
  var hold = { dir: 0, t: 0 };
  var wheel = 0;
  var scene;

  if (window.addEventListener) {
    window.addEventListener('wheel', function (e) { wheel += (e.deltaY || 0); }, { passive: true });
  }

  function terminal(status) {
    return status === 'dead' || status === 'timedout' || status === 'escaped';
  }

  function maxScroll() {
    if (tab === 'help') return HELP_MAX;
    var list = tab === 'enemies' ? (DD.Data && DD.Data.enemies) : (DD.Data && DD.Data.limbs);
    var n = (list && list.length) || 0;
    var rows = Math.ceil(n / (COLS[tab] || 2));
    return Math.max(0, rows * (PITCH[tab] || PITCH.limbs) - CONTENT_H);
  }

  function setTab(next) {
    if (TABS.indexOf(next) < 0 || next === tab) return;
    tab = next;
    scroll = 0;
    sfx('ui_move');
  }

  function sfx(name) {
    if (DD.Audio && DD.Audio.sfx && DD.Audio.sfx.play) DD.Audio.sfx.play(name);
  }

  /* Held arrows scroll: one row on the press, then a steady repeat. */
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

  function pump() {
    var I = DD.Input;
    if (!I || !I.consume) return;
    for (var i = 0; i < KEYS.length; i++) {
      if (I.consume(KEYS[i])) scene.key({ code: KEYS[i] });
    }
  }

  scene = DD.Scenes.define('codex', {
    enter: function (p) {
      tab = (p && TABS.indexOf(p.tab) >= 0) ? p.tab : 'limbs';
      scroll = 0;
      wheel = 0;
      hold.dir = 0;
      hold.t = 0;
      /* Ticking is only honest when a run is actually under this screen. */
      var s = DD.Run && DD.Run.state;
      live = !!(s && !terminal(s.status));
    },

    update: function (dt) {
      dt = dt || 0;
      if (live && DD.Run && DD.Run.tick) DD.Run.tick(dt);
      var s = DD.Run && DD.Run.state;
      if (live && s && terminal(s.status)) { DD.Scenes.replace('end', { result: s.status }); return; }

      if (wheel) { scroll += wheel > 0 ? ROW : -ROW; wheel = 0; }
      var d = held(dt);
      if (d) scroll += d * ROW;

      var max = maxScroll();
      if (scroll < 0) scroll = 0;
      if (scroll > max) scroll = max;

      pump();
    },

    draw: function () {
      var U = DD.View && DD.View.ui;
      if (!U || !U.codex) {
        if (DD.Canvas && DD.Canvas.clear) DD.Canvas.clear();
        return;
      }
      U.codex(tab, scroll);
    },

    key: function (e) {
      var code = e && e.code;
      if (!code) return;
      if (code === 'Escape' || code === 'Backspace' || code === 'Tab') { DD.Scenes.pop(); return; }
      var i = TABS.indexOf(tab);
      if (code === 'ArrowLeft' || code === 'KeyA' || code === 'KeyQ') {
        setTab(TABS[(i + TABS.length - 1) % TABS.length]);
        return;
      }
      if (code === 'ArrowRight' || code === 'KeyD' || code === 'KeyE') {
        setTab(TABS[(i + 1) % TABS.length]);
      }
    }
  });
})();
