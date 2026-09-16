// Core: canvas + scaling, input, drawing helpers, storage, RNG, shake/toast and the main loop.
window.Core = (function () {
  'use strict';

  var W = 480, H = 270;

  var PAL = {
    ink: '#080508', bg: '#0b0710', panel: '#160e1f', wall: '#2a1b3d', wallLit: '#3d2a55',
    floor: '#1a1226', floor2: '#1f1630', brass: '#b08d57', copper: '#8c4a2f', blood: '#7a1f2b',
    bone: '#e8dcc8', text: '#e8dcc8', dim: '#8a7f8f', sick: '#6fbf3f', poison: '#9c4dcc',
    fire1: '#ff9a2a', fire2: '#ff3b1f', fire3: '#ffd25a', heat: '#ff5a36', hp: '#c0392b',
    energy: '#ffd25a', skin: '#9aa77a', skinDark: '#5f6b4a', stitch: '#d9c9a5', white: '#ffffff',
    black: '#000000'
  };

  // Button fills: panel, a touch lighter on hover, lighter still when active.
  var FILL_HOVER = '#1e1429', FILL_ACTIVE = '#251739';

  var canvas = null, ctx = null;
  var api = { W: W, H: H, PAL: PAL, ctx: null, time: 0 };

  // ---------------------------------------------------------------- scaling

  function resize() {
    var s = Math.min(window.innerWidth / W, window.innerHeight / H);
    if (s >= 2) s = Math.floor(s); // integer scale on desktop; fractional between 1x and 2x so phones fill the screen
    if (!(s > 0)) s = 1;
    canvas.style.width = (W * s) + 'px';
    canvas.style.height = (H * s) + 'px';
  }

  // ------------------------------------------------------------------ input

  var held = {}, pressedKeys = {};
  var pointer = { x: -1, y: -1, down: false, justDown: false, justUp: false };
  var swipeStart = null, clearPointerAfterFrame = false;
  var soundUnlocked = false;

  function normKey(k) { return (typeof k === 'string' && k.length === 1) ? k.toLowerCase() : k; }
  function down(key) { return !!held[normKey(key)]; }
  function pressed(key) { return !!pressedKeys[normKey(key)]; }

  function unlockSound() {
    if (soundUnlocked) return;
    soundUnlocked = true;
    if (window.Sound && Sound.unlock) { try { Sound.unlock(); } catch (e) { /* audio is optional */ } }
  }

  function toLogical(e) {
    var r = canvas.getBoundingClientRect();
    var sx = r.width / W, sy = r.height / H;
    return { x: (e.clientX - r.left) / (sx || 1), y: (e.clientY - r.top) / (sy || 1) };
  }

  function onPointerDown(e) {
    var p = toLogical(e);
    pointer.x = p.x; pointer.y = p.y;
    pointer.down = true; pointer.justDown = true;
    swipeStart = { x: p.x, y: p.y };
    clearPointerAfterFrame = false;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is best effort */ }
    unlockSound();
  }

  function onPointerMove(e) {
    var p = toLogical(e);
    pointer.x = p.x; pointer.y = p.y;
  }

  function onPointerUp(e) {
    var p = toLogical(e);
    pointer.x = p.x; pointer.y = p.y;
    pointer.down = false; pointer.justUp = true;
    if (swipeStart) {
      var dx = p.x - swipeStart.x, dy = p.y - swipeStart.y;
      if (Math.abs(dx) >= 20 && Math.abs(dx) >= Math.abs(dy)) api.input.swipe = dx > 0 ? 'right' : 'left';
      else if (Math.abs(dy) >= 20) api.input.swipe = dy > 0 ? 'down' : 'up';
      swipeStart = null;
    }
    // A finger leaves no hover behind, a mouse does.
    clearPointerAfterFrame = !!(e.pointerType && e.pointerType !== 'mouse');
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }

  function onPointerCancel() {
    pointer.down = false;
    swipeStart = null;
    clearPointerAfterFrame = true;
  }

  function onKeyDown(e) {
    var k = normKey(e.key);
    if (k === ' ' || (typeof k === 'string' && k.indexOf('Arrow') === 0)) e.preventDefault();
    if (!e.repeat) pressedKeys[k] = true;   // auto-repeat never counts as "pressed"
    held[k] = true;
    unlockSound();
  }

  function onKeyUp(e) {
    var k = normKey(e.key);
    if (k === ' ' || (typeof k === 'string' && k.indexOf('Arrow') === 0)) e.preventDefault();
    delete held[k];
  }

  function dir() {
    if (pressed('ArrowUp') || pressed('w')) return 'up';
    if (pressed('ArrowDown') || pressed('s')) return 'down';
    if (pressed('ArrowLeft') || pressed('a')) return 'left';
    if (pressed('ArrowRight') || pressed('d')) return 'right';
    return api.input.swipe;
  }

  function consume() {
    pressedKeys = {};
    pointer.justDown = false;
    pointer.justUp = false;
    api.input.swipe = null;
    if (clearPointerAfterFrame) { pointer.x = -1; pointer.y = -1; clearPointerAfterFrame = false; }
  }

  function bindInput() {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('pointerleave', onPointerCancel);
    // Touch scrolling and double-tap zoom must never fight the canvas.
    var stop = function (e) { e.preventDefault(); };
    canvas.addEventListener('touchstart', stop, { passive: false });
    canvas.addEventListener('touchmove', stop, { passive: false });
    canvas.addEventListener('contextmenu', stop);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  // --------------------------------------------------------------- graphics

  function setFont(size) { ctx.font = size + 'px "Press Start 2P", monospace'; }

  function measure(str, size) {
    setFont(size);
    var m = ctx.measureText ? ctx.measureText(str) : null;
    return (m && m.width) ? m.width : String(str).length * size;
  }

  function clear(color) {
    ctx.fillStyle = color || PAL.bg;
    ctx.fillRect(0, 0, W, H);
  }

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function frame(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y + 1, 1, h - 2);
    ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
  }

  function panel(x, y, w, h, o) {
    o = o || {};
    rect(x, y, w, h, o.fill === undefined ? PAL.panel : o.fill);
    frame(x, y, w, h, o.border === undefined ? PAL.brass : o.border);
  }

  function text(str, x, y, o) {
    o = o || {};
    var size = o.size || 8;
    setFont(size);
    ctx.textBaseline = 'top';
    ctx.textAlign = o.align || 'left';
    ctx.fillStyle = o.color || PAL.text;
    ctx.fillText(String(str), x, y);
    ctx.textAlign = 'left';
  }

  function wrap(str, x, y, maxWidth, o) {
    o = o || {};
    var size = o.size || 8, lh = o.lineHeight || 10;
    var words = String(str).split(' ');
    var lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var next = line ? line + ' ' + words[i] : words[i];
      if (line && measure(next, size) > maxWidth) { lines.push(line); line = words[i]; }
      else line = next;
    }
    if (line) lines.push(line);
    for (var j = 0; j < lines.length; j++) {
      text(lines[j], x, y + j * lh, { color: o.color, size: size, align: o.align });
    }
    return lines.length;
  }

  function bar(x, y, w, h, ratio, fg, bg) {
    ratio = Math.max(0, Math.min(1, ratio || 0));
    rect(x, y, w, h, bg || PAL.ink);
    rect(x, y, Math.round(w * ratio), h, fg || PAL.hp);
  }

  // Rasterized sprites, cached per sprite object and per tint.
  var spriteCache = new WeakMap();

  function raster(spr, tint) {
    var byTint = spriteCache.get(spr);
    if (!byTint) { byTint = new Map(); spriteCache.set(spr, byTint); }
    var key = JSON.stringify(tint || null);
    var cached = byTint.get(key);
    if (cached) return cached;

    var map = {};
    if (tint) for (var k in tint) map[String(k).toLowerCase()] = tint[k];

    var cv = document.createElement('canvas');
    cv.width = spr.w; cv.height = spr.h;
    var c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    for (var y = 0; y < spr.h; y++) {
      var row = spr.rows[y] || '';
      for (var x = 0; x < spr.w; x++) {
        var ch = row.charAt(x);
        if (!ch || ch === '.') continue;
        var col = spr.pal[ch];
        if (!col) continue;
        var repl = map[String(col).toLowerCase()];
        c.fillStyle = repl || col;
        c.fillRect(x, y, 1, 1);
      }
    }
    byTint.set(key, cv);
    return cv;
  }

  function sprite(spr, x, y, o) {
    if (!spr || !spr.rows) return;
    o = o || {};
    var s = o.scale || 1;
    var w = spr.w * s, h = spr.h * s;
    var img = raster(spr, o.tint || null);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha);
    if (o.flip) {
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w, h);
    } else {
      ctx.drawImage(img, x, y, w, h);
    }
    ctx.restore();
  }

  function icon(name, x, y) {
    if (window.Sprites && Sprites.icons) sprite(Sprites.icons[name], x, y);
  }

  // --------------------------------------------------------------------- ui

  function button(x, y, w, h, label, o) {
    o = o || {};
    var inside = pointer.x >= x && pointer.x < x + w && pointer.y >= y && pointer.y < y + h;
    var border = o.disabled ? PAL.dim : (o.active ? PAL.bone : (o.color || PAL.brass));
    var fill = o.active ? FILL_ACTIVE : PAL.panel;
    if (!o.disabled && inside && !o.active) fill = FILL_HOVER;
    panel(x, y, w, h, { fill: fill, border: border });
    text(label, Math.round(x + w / 2), Math.round(y + (h - 8) / 2), {
      color: o.disabled ? PAL.dim : PAL.text, size: 8, align: 'center'
    });
    var hit = !o.disabled && ((pointer.justDown && inside) || (o.key ? pressed(o.key) : false));
    if (hit && window.Sound && Sound.sfx) Sound.sfx('click');
    return !!hit;
  }

  // ---------------------------------------------------------------- storage

  function save(key, obj) {
    try { window.localStorage.setItem(key, JSON.stringify(obj)); return true; }
    catch (e) { return false; }
  }

  function load(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }

  // -------------------------------------------------------------------- rng

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rand() { return Math.random(); }
  function pick(arr, rnd) { return arr[Math.floor((rnd || Math.random)() * arr.length)]; }

  function shuffle(arr, rnd) {
    rnd = rnd || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function irange(rnd, min, max) { return min + Math.floor(rnd() * (max - min + 1)); }

  // ------------------------------------------------------------ shake/toast

  var shakeAmount = 0, shakeTime = 0;

  function shake(intensity, seconds) {
    intensity = (intensity === undefined) ? 3 : intensity;
    seconds = (seconds === undefined) ? 0.3 : seconds;
    shakeAmount = Math.max(shakeAmount, intensity);
    shakeTime = Math.max(shakeTime, seconds);
  }

  var toasts = [];

  function toast(txt, seconds) {
    toasts.push({ text: String(txt), t: (seconds === undefined) ? 2 : seconds });
    while (toasts.length > 3) toasts.shift();
  }

  // Toasts stay left of x = 380 so the run clock at (384, 4) is never covered.
  var TOAST_CX = 190, TOAST_MAX = 372;

  function drawToasts(dt) {
    var y = 4;
    for (var i = 0; i < toasts.length; i++) {
      var it = toasts[i];
      it.t -= dt;
      if (it.t <= 0) continue;
      var str = it.text;
      while (str.length > 1 && measure(str, 8) + 12 > TOAST_MAX) str = str.slice(0, -1);
      if (str !== it.text) str = str.slice(0, -1) + '…';            // never spill out of the panel
      var w = Math.min(TOAST_MAX, Math.round(measure(str, 8)) + 12);
      var x = Math.round(TOAST_CX - w / 2);
      ctx.save();
      ctx.globalAlpha = it.t < 0.3 ? Math.max(0, it.t / 0.3) : 1;   // fade out over the last 0.3 s
      panel(x, y, w, 14, {});
      text(str, TOAST_CX, y + 3, { align: 'center', color: PAL.bone });
      ctx.restore();
      y += 16;
    }
    for (var j = toasts.length - 1; j >= 0; j--) if (toasts[j].t <= 0) toasts.splice(j, 1);
  }

  // ------------------------------------------------------------------- loop

  var seenErrors = {};

  function guard(fn, arg) {
    try { fn(arg); }
    catch (e) {
      var msg = (e && e.message) ? e.message : String(e);
      if (!seenErrors[msg]) { seenErrors[msg] = true; console.error(e); }
    }
  }

  function init(hooks) {
    hooks = hooks || {};
    var update = hooks.update || function () {};
    var draw = hooks.draw || function () {};

    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    api.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    // The window can change size before the first frame (font wait, late layout).
    if (window.ResizeObserver) {
      try { new window.ResizeObserver(resize).observe(document.body); } catch (e) { /* optional */ }
    }
    bindInput();

    var last = 0, running = false, firstFrame = true;

    function frameStep(now) {
      window.requestAnimationFrame(frameStep);
      if (firstFrame) { firstFrame = false; resize(); }
      var dt = Math.min(0.1, (now - last) / 1000);
      if (!(dt > 0)) dt = 0;
      last = now;
      api.time += dt;

      guard(update, dt);

      ctx.save();
      if (shakeTime > 0) {
        shakeTime -= dt;
        var k = shakeAmount;
        ctx.translate(Math.round((Math.random() * 2 - 1) * k), Math.round((Math.random() * 2 - 1) * k));
        if (shakeTime <= 0) { shakeTime = 0; shakeAmount = 0; }
      }
      guard(draw, ctx);
      ctx.restore();

      drawToasts(dt);
      consume();
    }

    function start() {
      if (running) return;
      running = true;
      last = (window.performance && performance.now) ? performance.now() : Date.now();
      window.requestAnimationFrame(frameStep);
    }

    // Wait for the pixel font, but never longer than 2 s (offline or blocked CDN).
    if (document.fonts && document.fonts.load) {
      window.setTimeout(start, 2000);
      try { document.fonts.load('8px "Press Start 2P"').then(start, start); }
      catch (e) { start(); }
    } else {
      start();
    }
  }

  api.init = init;
  api.input = {
    down: down, pressed: pressed, pointer: pointer, swipe: null, dir: dir, consume: consume
  };
  api.gfx = {
    clear: clear, rect: rect, frame: frame, panel: panel, text: text, wrap: wrap,
    bar: bar, sprite: sprite, icon: icon
  };
  api.ui = { button: button };
  api.save = save;
  api.load = load;
  api.rng = rng;
  api.rand = rand;
  api.pick = pick;
  api.shuffle = shuffle;
  api.irange = irange;
  api.shake = shake;
  api.toast = toast;

  return api;
})();
