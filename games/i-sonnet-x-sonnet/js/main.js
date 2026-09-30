/* Deadlock Deck: El Reloj Anatómico — arranque y bucle principal */
(function () {
  'use strict';
  var DD = window.DD;
  var canvas, ctx, last = 0;

  function safe(fn) {
    try { fn(); } catch (e) { DD.reportError(e); }
  }

  // Hay una run en marcha y la escena actual la hace correr (explore, combat, harvest)
  function runActive() {
    return !!(DD.scene && DD.scene.run && DD.run && DD.run.started);
  }

  function toggleMute() {
    var m;
    if (DD.Audio && DD.Audio.toggleMute) m = DD.Audio.toggleMute();
    else m = !DD.save.mute;
    DD.save.mute = !!m;
    DD.saveNow();
  }

  // El canvas ocupa todo lo que quepa manteniendo 16:9 (el CSS hace lo mismo si no hay JS)
  function fit() {
    var s = Math.min(window.innerWidth / DD.W, window.innerHeight / DD.H);
    if (!(s > 0)) return;
    canvas.style.width = Math.floor(DD.W * s) + 'px';
    canvas.style.height = Math.floor(DD.H * s) + 'px';
  }

  function fitSoon() {                  // en móvil el tamaño tarda en actualizarse tras girar
    fit();
    setTimeout(fit, 120);
    setTimeout(fit, 400);
  }

  // Escena + HUD. frozen = pausa: sin sacudida, y la entrada ya viene bloqueada
  function drawWorld(frozen) {
    var sc = DD.scene;
    if (!sc) return;
    ctx.save();
    if (!frozen && (DD.fx.ox || DD.fx.oy)) ctx.translate(DD.fx.ox, DD.fx.oy);
    if (sc.draw) safe(function () { sc.draw(ctx); });
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    if (runActive() && DD.Run && DD.Run.drawHUD) safe(function () { DD.Run.drawHUD(ctx); });
  }

  function step(dt) {
    var In = DD.Input;
    DD.time += dt;
    DD.fx.update(dt);

    ctx.setTransform(1, 0, 0, 1, 0, 0);       // un fallo de una escena no debe dejar el contexto a medias
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = DD.C.bg;
    ctx.fillRect(0, 0, DD.W, DD.H);

    if (In.pressed('mute')) safe(toggleMute);

    var toggled = false;
    if (runActive() && In.pressed('pause')) {
      DD.run.paused = !DD.run.paused;
      toggled = true;
    }
    var paused = runActive() && !!DD.run.paused;

    if (paused || toggled) {
      // Escena congelada bajo el menú: sin clics para ella, y la tecla que acaba de abrir/cerrar la pausa no se reutiliza
      In.lock(true);
      drawWorld(true);
      In.lock(false);
      if (paused) {
        if (!toggled && DD.Run && DD.Run.updatePause) safe(function () { DD.Run.updatePause(dt); });
        if (DD.Run && DD.Run.drawPause) safe(function () { DD.Run.drawPause(ctx); });
      }
    } else {
      if (runActive() && DD.Run && DD.Run.tick) safe(function () { DD.Run.tick(dt); });
      if (DD.scene && DD.scene.update) safe(function () { DD.scene.update(dt); });
      drawWorld(false);
    }
    DD.fx.drawOverlay(ctx);
  }

  function frame(ts) {
    requestAnimationFrame(frame);             // primero: pase lo que pase, el bucle sigue
    if (!last) last = ts;
    var dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
    last = ts;
    safe(function () { step(dt); });
    safe(function () { DD.Input.endFrame(); });
  }

  // Escena de emergencia si falta alguna pieza imprescindible (p. ej. meta.js aún sin escribir)
  function fallbackScene(msg) {
    DD.scenes._fallback = {
      draw: function (c) {
        DD.text(c, 'DEADLOCK DECK', DD.W / 2, 120, { align: 'center', size: 3, color: DD.C.brass, shadow: DD.C.bg });
        DD.text(c, msg, DD.W / 2, 170, { align: 'center', color: DD.C.ink });
      }
    };
    DD.setScene('_fallback');
  }

  function boot() {
    canvas = document.getElementById('screen');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    safe(function () { DD.loadSave(); });
    if (DD.Sprites && DD.Sprites.init) safe(function () { DD.Sprites.init(); });
    if (DD.Audio && DD.Audio.setMuted) safe(function () { DD.Audio.setMuted(!!DD.save.mute); });

    fitSoon();
    window.addEventListener('resize', fitSoon);
    window.addEventListener('orientationchange', fitSoon);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);

    // Sin menú contextual, sin selección ni arrastre, sin zoom táctil
    window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('selectstart', function (e) { e.preventDefault(); });
    window.addEventListener('dragstart', function (e) { e.preventDefault(); });
    window.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    window.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) {
      window.addEventListener(n, function (e) { e.preventDefault(); });
    });

    // Al ocultar la pestaña en una run activa, pausa
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && runActive()) DD.run.paused = true;
    });

    try {
      DD.setScene('title');
    } catch (e) {
      DD.reportError(e);
      fallbackScene('Falta la escena "title".');
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
