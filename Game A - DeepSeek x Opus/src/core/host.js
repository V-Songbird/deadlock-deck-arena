/* Browser host layer: virtual canvas, input (keyboard/gamepad/pointer/touch), storage. */
(function () {
  'use strict';
  var DD = window.DD;

  /* =======================================================================
   * DD.Canvas — virtual 640x360 screen, integer-scaled and letterboxed.
   * ===================================================================== */
  var Canvas = DD.Canvas = {
    w: DD.VW,
    h: DD.VH,
    el: null,
    ctx: null,
    scale: 1,
    ox: 0,
    oy: 0
  };

  Canvas.init = function (el) {
    Canvas.el = el;
    Canvas.ctx = el.getContext('2d', { alpha: false });
    Canvas.ctx.imageSmoothingEnabled = false;
    Canvas.fit();
    window.addEventListener('resize', Canvas.fit);
    window.addEventListener('orientationchange', function () { setTimeout(Canvas.fit, 120); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', Canvas.fit);
    return Canvas.ctx;
  };

  Canvas.fit = function () {
    if (!Canvas.el) return;
    var vw = window.innerWidth || document.documentElement.clientWidth || DD.VW;
    var vh = window.innerHeight || document.documentElement.clientHeight || DD.VH;

    // Prefer integer scaling so pixels stay square and crisp.
    var s = Math.min(vw / Canvas.w, vh / Canvas.h);
    var intScale = Math.floor(s);
    Canvas.scale = intScale >= 1 ? intScale : s;

    Canvas.el.style.width = Math.round(Canvas.w * Canvas.scale) + 'px';
    Canvas.el.style.height = Math.round(Canvas.h * Canvas.scale) + 'px';

    var rect = Canvas.el.getBoundingClientRect();
    Canvas.ox = rect.left;
    Canvas.oy = rect.top;
  };

  Canvas.toVirtual = function (clientX, clientY) {
    if (!Canvas.el) return { x: 0, y: 0 };
    var rect = Canvas.el.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (Canvas.w / rect.width),
      y: (clientY - rect.top) * (Canvas.h / rect.height)
    };
  };

  Canvas.clear = function (color) {
    Canvas.ctx.fillStyle = color || DD.C.void;
    Canvas.ctx.fillRect(0, 0, Canvas.w, Canvas.h);
  };

  /* =======================================================================
   * DD.Input — one place for every device.
   * ===================================================================== */
  var Input = DD.Input = {
    downMap: {},
    edgeMap: {},
    pointer: { x: 0, y: 0, down: false, justDown: false, justUp: false },
    touches: [],
    btns: {},
    vaxis: { x: 0, y: 0 },
    virtual: false,
    lastDevice: 'key',
    _prevDown: false
  };

  var MOVE_CODES = {
    KeyW: [0, -1], ArrowUp: [0, -1],
    KeyS: [0, 1], ArrowDown: [0, 1],
    KeyA: [-1, 0], ArrowLeft: [-1, 0],
    KeyD: [1, 0], ArrowRight: [1, 0]
  };

  Input.init = function (el) {
    Input.el = el;

    window.addEventListener('keydown', function (e) {
      if (e.repeat) { if (MOVE_CODES[e.code]) { Input.downMap[e.code] = true; } e.preventDefault(); return; }
      Input.downMap[e.code] = true;
      Input.edgeMap[e.code] = true;
      Input.lastDevice = 'key';
      // Stop the browser from scrolling / tabbing away from the game.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace', 'Enter'].indexOf(e.code) >= 0) e.preventDefault();
    }, { passive: false });

    window.addEventListener('keyup', function (e) {
      Input.downMap[e.code] = false;
    });

    window.addEventListener('blur', function () {
      Input.downMap = {};
    });

    el.addEventListener('mousedown', function (e) {
      var p = Canvas.toVirtual(e.clientX, e.clientY);
      Input.pointer.x = p.x; Input.pointer.y = p.y;
      Input.pointer.down = true; Input.pointer.justDown = true;
      Input.lastDevice = 'mouse';
      e.preventDefault();
    });

    window.addEventListener('mousemove', function (e) {
      var p = Canvas.toVirtual(e.clientX, e.clientY);
      Input.pointer.x = p.x; Input.pointer.y = p.y;
    });

    window.addEventListener('mouseup', function () {
      if (Input.pointer.down) Input.pointer.justUp = true;
      Input.pointer.down = false;
    });

    var touchHandler = function (e) {
      Input.virtual = true;
      Input.lastDevice = 'touch';
      Input.touches.length = 0;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        var p = Canvas.toVirtual(t.clientX, t.clientY);
        Input.touches.push({ id: t.identifier, x: p.x, y: p.y });
        if (i === 0) { Input.pointer.x = p.x; Input.pointer.y = p.y; }
      }
      if (e.type === 'touchstart') {
        Input.pointer.down = true; Input.pointer.justDown = true;
      } else if (e.type === 'touchend' || e.type === 'touchcancel') {
        Input.pointer.down = false; Input.pointer.justUp = true;
      }
      e.preventDefault();
    };
    el.addEventListener('touchstart', touchHandler, { passive: false });
    el.addEventListener('touchmove', touchHandler, { passive: false });
    el.addEventListener('touchend', touchHandler, { passive: false });
    el.addEventListener('touchcancel', touchHandler, { passive: false });

    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // Touch devices get on-screen controls.
    if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) Input.virtual = true;
  };

  /* Gamepad mapping: 0=A confirm, 1=B cancel, 2=X interact, 3=Y codex. */
  var PAD_BUTTONS = { 0: 'Enter', 1: 'Escape', 2: 'KeyE', 3: 'Tab' };
  Input._padPrev = {};

  /* Polled once per frame by DD.Loop, before the scene updates. */
  Input.poll = function () {
    var pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    Input.pad = null;
    for (var i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) { Input.pad = pads[i]; break; }
    }
    if (!Input.pad) return;
    for (var k in PAD_BUTTONS) {
      var btn = Input.pad.buttons[k];
      var pressed = !!(btn && btn.pressed);
      if (pressed && !Input._padPrev[k]) { Input.edgeMap[PAD_BUTTONS[k]] = true; Input.lastDevice = 'pad'; }
      Input._padPrev[k] = pressed;
    }
    var ax = Input.pad.axes[0] || 0, ay = Input.pad.axes[1] || 0;
    if (Math.abs(ax) > 0.3 || Math.abs(ay) > 0.3) Input.lastDevice = 'pad';
  };

  Input.down = function (code) { return !!Input.downMap[code]; };
  Input.pressed = function (code) { return !!Input.edgeMap[code]; };
  Input.consume = function (code) { var v = !!Input.edgeMap[code]; Input.edgeMap[code] = false; return v; };
  Input.anyPressed = function () {
    for (var k in Input.edgeMap) { if (Input.edgeMap[k]) return true; }
    return Input.pointer.justDown;
  };

  Input.axis = function () {
    var x = Input.vaxis.x, y = Input.vaxis.y;
    for (var code in MOVE_CODES) {
      if (Input.downMap[code]) { x += MOVE_CODES[code][0]; y += MOVE_CODES[code][1]; }
    }
    if (Input.pad) {
      var ax = Input.pad.axes[0] || 0, ay = Input.pad.axes[1] || 0;
      if (Math.abs(ax) > 0.3) x += ax;
      if (Math.abs(ay) > 0.3) y += ay;
    }
    return { x: DD.clamp(x, -1, 1), y: DD.clamp(y, -1, 1) };
  };

  Input.setVirtualEnabled = function (on) { Input.virtual = !!on; };

  /* On-screen button. Returns true only on the frame it is activated.
   * Scenes draw their own button art and read Input.btns[id] for state. */
  Input.button = function (id, x, y, w, h) {
    var st = Input.btns[id] || (Input.btns[id] = { hover: false, held: false, active: false, tap: 0 });
    var px = Input.pointer.x, py = Input.pointer.y;
    var inside = px >= x && px <= x + w && py >= y && py <= y + h;
    st.hover = inside;
    st.active = false;
    if (inside && Input.pointer.justDown) {
      st.held = true;
      st.active = true;
      st.tap = 0.14;
      DD.Input.vaxis = DD.Input.vaxis; // keep reference stable
    }
    if (!Input.pointer.down) {
      if (st.held && !inside) st.held = false;
      if (!Input.pointer.down && !Input.pointer.justUp) { /* keep */ }
    }
    if (Input.pointer.justUp) st.held = false;
    if (st.tap > 0) st.tap -= 1 / 60;
    return st.active;
  };

  Input.endFrame = function () {
    Input.edgeMap = {};
    Input.pointer.justDown = false;
    Input.pointer.justUp = false;
    Input.anyEdge = false;
  };

  /* Frame-start bookkeeping, called by DD.Loop before update. */
  Input.beginFrame = function () {
    Input.poll();
  };

  /* =======================================================================
   * DD.Storage — localStorage with every failure swallowed.
   * ===================================================================== */
  DD.Storage = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        if (raw == null) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove: function (key) {
      try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };
})();
