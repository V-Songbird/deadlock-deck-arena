/* End: dead, timed out or escaped. A second of silence, then the two ways out —
 * a new dissection table, or the vestibule. */
(function () {
  'use strict';
  var DD = window.DD;

  var GUARD = 1;                    // seconds before input is accepted
  var RESULTS = ['dead', 'timedout', 'escaped'];
  var KEYS = ['Enter', 'Space', 'Escape'];

  var result = 'dead';
  var t = 0;
  var scene;

  function wake() {
    /* replace('run') finds a finished run, so it builds a fresh body and keeps
     * every blueprint in the codex. */
    DD.Scenes.replace('run');
  }

  function pump() {
    var I = DD.Input;
    if (!I || !I.consume) return;
    for (var i = 0; i < KEYS.length; i++) {
      if (I.consume(KEYS[i])) scene.key({ code: KEYS[i] });
    }
    if (I.pointer && I.pointer.justDown) scene.pointer('down');
  }

  scene = DD.Scenes.define('end', {
    enter: function (p) {
      var r = p && p.result;
      result = (RESULTS.indexOf(r) >= 0) ? r : 'dead';
      t = 0;
      if (DD.Progress && DD.Progress.recordRun) DD.Progress.recordRun(result);
    },

    update: function (dt) {
      t += (dt || 0);
      pump();
    },

    draw: function () {
      var U = DD.View && DD.View.ui;
      if (!U || !U.end) {
        if (DD.Canvas && DD.Canvas.clear) DD.Canvas.clear();
        return;
      }
      U.end(result);
      if (DD.Pixel && DD.Pixel.text && t >= GUARD) {
        DD.Pixel.text(DD.t('ESC - Volver al vestíbulo'), DD.VW / 2, 322, {
          align: 'center', color: DD.C.textFaint
        });
      }
    },

    key: function (e) {
      if (t < GUARD) return;
      var code = e && e.code;
      if (!code) return;
      if (code === 'Escape') { DD.Scenes.replace('menu'); return; }
      if (code === 'Enter' || code === 'Space') wake();
    },

    /* A tap does what ENTER does: the end screen has to be leavable on a
     * device with no keyboard at all. */
    pointer: function (phase) {
      if (phase === 'down' && t >= GUARD) wake();
    }
  });
})();
