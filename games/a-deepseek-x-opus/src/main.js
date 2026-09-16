/* Bootstrap: wire the host, warm the art, unlock audio on the first gesture, run. */
(function () {
  'use strict';
  var DD = window.DD;

  function unlockAudio() {
    if (DD.Audio && DD.Audio.init) DD.Audio.init();
  }

  function boot() {
    var canvasEl = document.getElementById('screen');
    if (!canvasEl) { console.error('Deadlock Deck: #screen canvas is missing'); return; }

    DD.Canvas.init(canvasEl);
    DD.Input.init(canvasEl);
    DD.Run.loadMeta();
    DD.Pixel.build();

    // The AudioContext may only be created from a user gesture.
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('mousedown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('pointerdown', unlockAudio);

    DD.Scenes.replace('boot');
    DD.Loop.start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
