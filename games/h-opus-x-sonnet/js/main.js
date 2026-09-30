/* main.js — boot, main loop, clock, pause overlay (contract §4). */
(function () {
  'use strict';
  const DD = window.DD;
  const PAL = DD.PAL;
  const D = DD.draw;

  const RUN_SCENES = { explore: true, combat: true, harvest: true };
  const SCENE_MUSIC = { title: 'title', table: 'table', codex: 'title', shop: 'title', victory: 'victory', loopEnd: 'silence' };
  const PAUSE_BTN = { x: 610, y: 28, w: 26, h: 16 };

  DD.paused = false;
  let last = 0;
  let lastRun = null, lastWhole = null;
  let audioCalls = 0;
  let snap = null;
  let abandonArmed = false;
  const pms = { focus: 0 };
  const seenErrors = {};

  function sfx(n) { if (DD.audio && DD.audio.sfx) DD.audio.sfx(n); }

  // ---- audio init on the first user gesture (init() must be idempotent: it may be called twice)
  function onGesture() {
    if (!DD.audio || !DD.audio.init) return;
    audioCalls++;
    try {
      DD.audio.init();
      if (audioCalls === 1) {
        if (DD.audio.setMuted) DD.audio.setMuted(!!DD.save.data.muted);
        const m = SCENE_MUSIC[DD.sceneName];
        if (m && DD.audio.music) DD.audio.music(m);
      }
    } catch (e) { report(e); }
    if (audioCalls >= 2) {
      ['keydown', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click'].forEach(function (ev) {
        window.removeEventListener(ev, onGesture, true);
      });
    }
  }
  ['keydown', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click'].forEach(function (ev) {
    window.addEventListener(ev, onGesture, true);
  });

  function report(e) {
    const k = String(e && e.message);
    if (!seenErrors[k]) { seenErrors[k] = true; console.error(e); }
  }

  function inRunScene() {
    return !!(DD.run && DD.run.active && RUN_SCENES[DD.sceneName]);
  }

  // ---- pause
  function pauseGame() {
    if (DD.paused || !inRunScene()) return;
    if (!snap) { snap = document.createElement('canvas'); snap.width = DD.W; snap.height = DD.H; }
    const sc = snap.getContext('2d');
    sc.drawImage(DD.canvas, 0, 0);
    DD.paused = true; abandonArmed = false; pms.focus = 0;
    DD.input.consume('pause'); DD.input.consume('cancel');
    sfx('select');
  }
  function resumeGame() { DD.paused = false; abandonArmed = false; }

  function fmtTime(t) {
    t = Math.max(0, Math.ceil(t));
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  }

  function drawPause(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    if (snap) ctx.drawImage(snap, 0, 0);
    D.rect(0, 0, DD.W, DD.H, 'rgba(6,4,10,0.7)');
    D.panel(190, 70, 260, 220);
    D.text('PAUSA', 320, 84, { size: 16, align: 'center', color: PAL.brass });
    if (DD.run) D.text('Tiempo restante ' + fmtTime(DD.run.timeLeft), 320, 108, { size: 10, align: 'center', color: PAL.bone });
    const muted = DD.save.data.muted;
    const items = [
      { label: 'Continuar', x: 220, y: 130, w: 200, h: 30, size: 12, color: PAL.fire },
      { label: muted ? 'Activar sonido' : 'Silenciar sonido', x: 220, y: 168, w: 200, h: 30, size: 10 },
      { label: abandonArmed ? '¿Seguro? Pulsa otra vez' : 'Abandonar bucle', x: 220, y: 206, w: 200, h: 30, size: 10,
        color: PAL.bloodLight }
    ];
    const a = DD.ui.menu(pms, items);
    D.text('P / Esc / Inicio: continuar', 320, 256, { size: 8, align: 'center', color: PAL.dim });
    if (a === 0) resumeGame();
    else if (a === 1) { abandonArmed = false; if (DD.game.toggleMute) DD.game.toggleMute(); }
    else if (a === 2) {
      if (!abandonArmed) abandonArmed = true;
      else { resumeGame(); DD.game.endLoop('abandon'); }
    } else if (DD.input.hit('pause') || DD.input.hit('cancel')) resumeGame();
  }

  // ---- clock
  function clock(dt) {
    const run = DD.run;
    if (run !== lastRun) { lastRun = run; lastWhole = null; }
    run.timeLeft -= dt;
    if (run.timeLeft < 60) {
      const w = Math.ceil(run.timeLeft);
      if (w !== lastWhole && w > 0) { lastWhole = w; sfx('tick'); }
    } else lastWhole = null;
    if (run.timeLeft <= 0) {
      run.timeLeft = 0;
      DD.game.endLoop('time');
    }
  }

  function drawRunOverlays(ctx) {
    const run = DD.run;
    if (run && run.active && run.timeLeft < 60) {
      const p = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 8);
      ctx.fillStyle = 'rgba(163,32,42,' + (0.12 + 0.18 * p).toFixed(2) + ')';
      ctx.fillRect(0, 25, DD.W, 4); ctx.fillRect(0, DD.H - 4, DD.W, 4);
      ctx.fillRect(0, 25, 4, DD.H - 25); ctx.fillRect(DD.W - 4, 25, 4, DD.H - 25);
    }
    // touch-friendly pause button
    const b = PAUSE_BTN, hov = DD.input.mouseIn(b.x, b.y, b.w, b.h);
    ctx.globalAlpha = hov ? 1 : 0.6;
    D.panel(b.x, b.y, b.w, b.h, { fill: hov ? '#3a2a24' : '#1a1520', rivets: false });
    D.rect(b.x + 9, b.y + 4, 3, 8, PAL.bone); D.rect(b.x + 14, b.y + 4, 3, 8, PAL.bone);
    ctx.globalAlpha = 1;
  }

  function drawScene(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
    D.rect(0, 0, DD.W, DD.H, PAL.bg);
    const sc = DD.scenes[DD.sceneName];
    if (!sc || !sc.draw) return;
    const off = DD.fx.offset();
    ctx.save();
    ctx.translate(off.x, off.y);
    try { sc.draw(ctx); } catch (e) { report(e); }
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  function step(dt) {
    const ctx = DD.ctx;
    DD.input._poll();

    if (DD.paused) {
      drawPause(ctx);
    } else {
      let handled = false;
      // on-screen pause button (touch / mouse)
      const b = PAUSE_BTN;
      if (inRunScene() && DD.input.mouse.clicked && DD.input.mouseIn(b.x, b.y, b.w, b.h)) {
        DD.input.mouse.clicked = false; DD.input.mouse.down = false;
        pauseGame();
        if (DD.paused) { drawPause(ctx); handled = true; }
      }
      if (!handled) {
        if (inRunScene()) clock(dt);
        const sc = DD.scenes[DD.sceneName];
        if (sc && sc.update) { try { sc.update(dt); } catch (e) { report(e); } }
        if (inRunScene() && DD.input.hit('pause')) {
          pauseGame();
          if (DD.paused) drawPause(ctx);
        } else {
          drawScene(ctx);
          if (inRunScene()) drawRunOverlays(ctx);
        }
      }
    }

    // tension follows the clock
    if (DD.audio && DD.audio.setTension) {
      const r = DD.run;
      DD.audio.setTension(r && r.active ? DD.clamp(1 - r.timeLeft / DD.CONFIG.runSeconds, 0, 1) : 0);
    }

    DD.fx.update(dt);
    DD.fx.draw(ctx);
  }

  function frame(ts) {
    requestAnimationFrame(frame);
    let dt = (ts - last) / 1000;
    last = ts;
    if (!(dt > 0)) dt = 0.016;
    if (dt > 0.05) dt = 0.05;
    try { step(dt); } catch (e) { report(e); }
    DD.input._endFrame();
  }

  window.addEventListener('load', function () {
    DD.initCanvas();
    DD.save.load();
    DD.setScene('title');
    // auto-pause when the tab or window loses focus during a run
    document.addEventListener('visibilitychange', function () { if (document.hidden) pauseGame(); });
    window.addEventListener('blur', function () { pauseGame(); });
    requestAnimationFrame(function (ts) { last = ts; frame(ts); });
  });
})();
