/* Boot: the title card. One warning, one clock, one prompt; it can never get
 * stuck because it also advances on its own after a few seconds. */
(function () {
  'use strict';
  var DD = window.DD;

  var AUTO = 9;                 // seconds the card lives before it advances alone

  var WARN_A ='Aviso: horror corporal. Aquí se cosen miembros y se desmontan cuerpos.';
  var WARN_B = 'Tienes seis minutos para escapar de la torre. El reloj no se detiene.';
  var PROMPT = 'PULSA CUALQUIER TECLA';

  var t = 0;
  var done = false;

  function center(text, y, color, scale) {
    if (!DD.Pixel || !DD.Pixel.text) return y;
    var lines = DD.Pixel.wrap ? DD.Pixel.wrap(text, 520, scale || 1) : [text];
    for (var i = 0; i < lines.length; i++) {
      DD.Pixel.text(lines[i], DD.VW / 2, y + i * 10, {
        align: 'center', color: color, scale: scale || 1
      });
    }
    return y + lines.length * 10;
  }

  /* The AudioContext may only be created from a gesture, so this is the first
   * place the score can start. */
  function go() {
    if (done) return;
    done = true;
    if (DD.Audio && DD.Audio.init) DD.Audio.init();
    if (DD.Audio && DD.Audio.music && DD.Audio.music.play) DD.Audio.music.play('menu');
    DD.Scenes.replace('menu');
  }

  DD.Scenes.define('boot', {
    enter: function () {
      t = 0;
      done = false;
    },

    update: function (dt) {
      t += (dt || 0);
      if (t >= AUTO) { go(); return; }
      if (DD.Input && DD.Input.anyPressed && DD.Input.anyPressed()) go();
      else if (DD.Input && DD.Input.pointer && DD.Input.pointer.justDown) go();
    },

    draw: function () {
      var U = DD.View && DD.View.ui;
      if (!U || !U.bg) {
        if (DD.Canvas && DD.Canvas.clear) DD.Canvas.clear();
        center('DEADLOCK DECK', 140, DD.C.text, 3);
        return;
      }
      U.bg();
      if (U.title) U.title();
      var y = center(WARN_A, 196, DD.C.textDim);
      center(WARN_B, y + 6, DD.C.textDim);

      var pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 3));
      if (DD.Pixel && DD.Pixel.text) {
        DD.Pixel.text(PROMPT, DD.VW / 2, 303, { align: 'center', scale: 2, color: DD.C.gold, alpha: pulse });
      }
    }
  });
})();
