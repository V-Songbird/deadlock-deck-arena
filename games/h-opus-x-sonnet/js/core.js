/* core.js — shared namespace, input, scenes, draw helpers, fx, save (contract §3). */
window.DD = window.DD || {};
(function () {
  'use strict';
  const DD = window.DD;

  DD.W = 640;
  DD.H = 360;
  DD.FONT = '"Courier New", Courier, monospace';
  DD.canvas = null;
  DD.ctx = null;

  DD.PAL = {
    bg: '#0d0b12', ink: '#e8dcc0', dim: '#8a7f6a', blood: '#a3202a', bloodLight: '#e04848',
    brass: '#c89b3c', brassDark: '#7a5a1e', copper: '#b8643a', verdigris: '#3fa38a', ember: '#ff7a1a',
    fire: '#ffb830', ichor: '#7bd35a', violet: '#6b3fa0', steel: '#6c7a89', bone: '#d9ceb0',
    heat: '#ff4a1a', cold: '#4ab8ff', panel: '#1a1520', panelEdge: '#4a3a2a'
  };
  const PAL = DD.PAL;

  DD.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  DD.lerp = function (a, b, t) { return a + (b - a) * t; };

  // ---------------------------------------------------------------- RNG (mulberry32)
  DD.RNG = function (seed) {
    let s = (Math.floor(Number(seed) || 0) >>> 0) || 0x9e3779b9;
    function next() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next: next,
      int: function (a, b) { return a + Math.floor(next() * (b - a + 1)); },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      chance: function (p) { return next() < p; },
      shuffle: function (arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      }
    };
  };
  DD.rand = DD.RNG(Date.now());

  // ---------------------------------------------------------------- input
  const KEYMAP = {
    KeyW: ['up'], ArrowUp: ['up'], KeyS: ['down'], ArrowDown: ['down'],
    KeyA: ['left'], ArrowLeft: ['left'], KeyD: ['right'], ArrowRight: ['right'],
    Enter: ['confirm'], NumpadEnter: ['confirm'], Space: ['confirm'],
    Escape: ['cancel', 'pause'], Backspace: ['cancel'], KeyP: ['pause'], KeyE: ['end']
  };
  for (let i = 1; i <= 9; i++) { KEYMAP['Digit' + i] = [String(i)]; KEYMAP['Numpad' + i] = [String(i)]; }
  const DIRS = { up: 1, down: 1, left: 1, right: 1 };

  const codesDown = new Set();
  const codesUp = [];               // key releases deferred to end of frame so quick taps register as held
  let hits = {};
  let padHeld = {}, padPrev = {}, padNext = {};
  let pointerUp = false, pointerTouch = false;

  const mouse = { x: -1000, y: -1000, down: false, clicked: false, rclicked: false, wheel: 0 };

  DD.input = {
    mouse: mouse,
    held: function (a) {
      if (padHeld[a]) return true;
      for (const c of codesDown) { const l = KEYMAP[c]; if (l && l.indexOf(a) >= 0) return true; }
      return false;
    },
    hit: function (a) { return !!hits[a]; },
    consume: function (a) { delete hits[a]; },
    mouseIn: function (x, y, w, h) {
      return mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;
    },
    // called by main loop at the start of each frame
    _poll: function () {
      padPrev = padHeld; padHeld = {};
      let pads = [];
      try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { pads = []; }
      for (let i = 0; i < pads.length; i++) {
        const p = pads[i];
        if (!p || !p.connected) continue;
        const b = function (n) { return p.buttons[n] && p.buttons[n].pressed; };
        const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
        if (b(12) || ay < -0.5) padHeld.up = true;
        if (b(13) || ay > 0.5) padHeld.down = true;
        if (b(14) || ax < -0.5) padHeld.left = true;
        if (b(15) || ax > 0.5) padHeld.right = true;
        if (b(0)) padHeld.confirm = true;
        if (b(1)) padHeld.cancel = true;
        if (b(3)) padHeld.end = true;
        if (b(9)) padHeld.pause = true;
      }
      const now = performance.now();
      for (const a in padHeld) {
        if (!padPrev[a]) {
          hits[a] = true;
          if (DIRS[a]) padNext[a] = now + 350;
        } else if (DIRS[a] && now >= padNext[a]) {
          hits[a] = true;
          padNext[a] = now + 110;
        }
      }
    },
    // called by main loop at the end of each frame
    _endFrame: function () {
      hits = {};
      mouse.clicked = false; mouse.rclicked = false; mouse.wheel = 0;
      for (let i = 0; i < codesUp.length; i++) codesDown.delete(codesUp[i]);
      codesUp.length = 0;
      if (pointerUp) {
        mouse.down = false; pointerUp = false;
        if (pointerTouch) { mouse.x = -1000; mouse.y = -1000; }
      }
    },
    anyGamepadInput: function () { for (const k in padHeld) return true; return false; }
  };
  const input = DD.input;

  function setMouseXY(e) {
    const c = DD.canvas;
    if (!c) return;
    const r = c.getBoundingClientRect();
    if (!r.width || !r.height) return;
    mouse.x = (e.clientX - r.left) * (DD.W / r.width);
    mouse.y = (e.clientY - r.top) * (DD.H / r.height);
  }

  let inputBound = false;
  function bindInput() {
    if (inputBound) return;
    inputBound = true;
    const c = DD.canvas;

    window.addEventListener('keydown', function (e) {
      const acts = KEYMAP[e.code];
      if (!acts || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (!e.repeat) {
        codesDown.add(e.code);
        for (let i = 0; i < acts.length; i++) hits[acts[i]] = true;
      } else {
        for (let i = 0; i < acts.length; i++) if (DIRS[acts[i]]) hits[acts[i]] = true;
      }
    });
    window.addEventListener('keyup', function (e) {
      if (KEYMAP[e.code]) { e.preventDefault(); codesUp.push(e.code); }
    });
    window.addEventListener('blur', function () {
      codesDown.clear(); codesUp.length = 0;
      mouse.down = false;
    });

    c.addEventListener('pointerdown', function (e) {
      if (e.isPrimary === false) return;
      setMouseXY(e);
      if (e.button === 2) { mouse.rclicked = true; return; }
      mouse.down = true; mouse.clicked = true; pointerUp = false;
      pointerTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });
    c.addEventListener('pointermove', function (e) {
      if (e.isPrimary === false) return;
      setMouseXY(e);
    });
    const up = function (e) {
      if (e.isPrimary === false) return;
      if (e.button === 2) return;
      setMouseXY(e);
      pointerUp = true;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    c.addEventListener('wheel', function (e) {
      mouse.wheel += e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0);
      e.preventDefault();
    }, { passive: false });
    // stop the browser from scrolling / zooming on touch
    c.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    c.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  }

  // ---------------------------------------------------------------- canvas
  DD.initCanvas = function () {
    const c = document.getElementById('game');
    c.width = DD.W; c.height = DD.H;
    DD.canvas = c;
    DD.ctx = c.getContext('2d');
    DD.ctx.imageSmoothingEnabled = false;
    bindInput();
    return DD.ctx;
  };

  // ---------------------------------------------------------------- scenes
  const FADE_TIME = 0.25;
  let fadeT = 0;
  DD.scenes = {};
  DD.sceneName = null;
  DD.setScene = function (name, params) {
    const old = DD.scenes[DD.sceneName];
    if (old && old.exit) old.exit();
    let sc = DD.scenes[name];
    if (!sc) {
      console.warn('DD.setScene: unknown scene "' + name + '"');
      if (name !== 'title' && DD.scenes.title) { name = 'title'; sc = DD.scenes.title; } else return;
    }
    DD.sceneName = name;
    fadeT = FADE_TIME;
    if (sc.enter) sc.enter(params || {});
  };

  // ---------------------------------------------------------------- drawing
  const D = DD.draw = {};
  function ctxOf() { return DD.ctx; }
  function fontStr(size, bold) { return (bold ? 'bold ' : '') + size + 'px ' + DD.FONT; }

  D.rect = function (x, y, w, h, color) {
    const c = ctxOf(); c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  D.stroke = function (x, y, w, h, color) {
    const c = ctxOf(); x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    c.fillStyle = color;
    c.fillRect(x, y, w, 1); c.fillRect(x, y + h - 1, w, 1);
    c.fillRect(x, y, 1, h); c.fillRect(x + w - 1, y, 1, h);
  };
  D.textWidth = function (str, size, bold) {
    const c = ctxOf(); c.font = fontStr(size || 10, bold !== false);
    return c.measureText(String(str)).width;
  };
  D.text = function (str, x, y, o) {
    o = o || {};
    const c = ctxOf();
    const size = o.size || 10;
    const bold = o.bold !== false;
    const lines = String(str).split('\n');
    const prevA = c.globalAlpha;
    if (o.alpha != null) c.globalAlpha = prevA * o.alpha;
    c.font = fontStr(size, bold);
    c.textBaseline = 'top';
    c.textAlign = o.align || 'left';
    x = Math.round(x); y = Math.round(y);
    for (let i = 0; i < lines.length; i++) {
      const ly = y + i * (size + 3);
      if (o.shadow !== false) { c.fillStyle = '#000'; c.fillText(lines[i], x + 1, ly + 1); }
      c.fillStyle = o.color || PAL.ink;
      c.fillText(lines[i], x, ly);
    }
    c.globalAlpha = prevA;
  };
  D.textWrap = function (str, x, y, w, o) {
    o = o || {};
    const size = o.size || 10;
    const c = ctxOf();
    c.font = fontStr(size, o.bold !== false);
    const lh = size + 3;
    const paras = String(str).split('\n');
    const lines = [];
    for (let p = 0; p < paras.length; p++) {
      const words = paras[p].split(' ');
      let line = '';
      for (let i = 0; i < words.length; i++) {
        const test = line ? line + ' ' + words[i] : words[i];
        if (line && c.measureText(test).width > w) { lines.push(line); line = words[i]; }
        else line = test;
      }
      lines.push(line);
    }
    const align = o.align || 'left';
    const ax = align === 'center' ? x + w / 2 : (align === 'right' ? x + w : x);
    for (let i = 0; i < lines.length; i++) D.text(lines[i], ax, y + i * lh, o);
    return lines.length * lh;
  };
  D.panel = function (x, y, w, h, o) {
    o = o || {};
    const fill = o.fill || PAL.panel;
    const edge = o.edge || PAL.panelEdge;
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    const c = ctxOf();
    c.fillStyle = '#050308'; c.fillRect(x, y, w, h);
    c.fillStyle = edge; c.fillRect(x + 1, y + 1, w - 2, h - 2);
    c.fillStyle = fill; c.fillRect(x + 3, y + 3, w - 6, h - 6);
    c.fillStyle = 'rgba(232,200,120,0.35)';
    c.fillRect(x + 1, y + 1, w - 2, 1); c.fillRect(x + 1, y + 1, 1, h - 2);
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.fillRect(x + 3, y + 3, w - 6, 1); c.fillRect(x + 3, y + 3, 1, h - 6);
    if (o.rivets !== false && w >= 20 && h >= 14) {
      const rv = function (rx, ry) {
        c.fillStyle = PAL.brassDark; c.fillRect(rx, ry, 3, 3);
        c.fillStyle = PAL.brass; c.fillRect(rx, ry, 2, 2);
        c.fillStyle = '#f3dc9a'; c.fillRect(rx, ry, 1, 1);
      };
      rv(x + 1, y + 1); rv(x + w - 4, y + 1); rv(x + 1, y + h - 4); rv(x + w - 4, y + h - 4);
      if (w > 120) { rv(Math.round(x + w / 2) - 1, y + 1); rv(Math.round(x + w / 2) - 1, y + h - 4); }
    }
  };
  D.bar = function (x, y, w, h, frac, color, bg) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    const c = ctxOf();
    c.fillStyle = '#000'; c.fillRect(x, y, w, h);
    c.fillStyle = bg || '#2a1c20'; c.fillRect(x + 1, y + 1, w - 2, h - 2);
    const fw = Math.floor((w - 2) * DD.clamp(frac, 0, 1));
    if (fw > 0) {
      c.fillStyle = color || PAL.blood; c.fillRect(x + 1, y + 1, fw, h - 2);
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(x + 1, y + 1, fw, 1);
    }
  };
  D.button = function (label, x, y, w, h, o) {
    o = o || {};
    const m = mouse;
    const over = input.mouseIn(x, y, w, h);
    const hover = over && !o.disabled;
    const down = hover && m.down;
    let fill, edge;
    if (o.disabled) { fill = '#120e16'; edge = '#2c2420'; }
    else if (down) { fill = '#4a2a18'; edge = PAL.fire; }
    else if (hover) { fill = '#3a2a24'; edge = PAL.brass; }
    else { fill = '#241a1e'; edge = o.selected ? PAL.brass : PAL.brassDark; }
    D.panel(x, y, w, h, { fill: fill, edge: edge, rivets: w >= 40 && h >= 18 });
    if (o.selected && !o.disabled) D.stroke(x - 1, y - 1, w + 2, h + 2, PAL.ember);
    const size = o.size || 10;
    if (label) {
      D.text(label, x + w / 2, y + Math.round((h - size) / 2) + (down ? 1 : 0), {
        size: size, align: 'center',
        color: o.disabled ? '#5a5040' : (o.color || (hover ? PAL.fire : PAL.ink))
      });
    }
    if (over && m.clicked) {
      if (o.disabled) {
        if (DD.audio && DD.audio.sfx) DD.audio.sfx('error');
        return false;
      }
      m.clicked = false; // a click activates one button only
      if (DD.audio && DD.audio.sfx) DD.audio.sfx('select');
      return true;
    }
    return false;
  };

  // ---------------------------------------------------------------- menu helper (keyboard/gamepad/mouse focus)
  // items: [{label,x,y,w,h,disabled,color,size}] — state: {focus}. Returns activated index or -1.
  DD.ui = DD.ui || {};
  function firstEnabled(items) {
    for (let i = 0; i < items.length; i++) if (!items[i].disabled) return i;
    return 0;
  }
  function neighbor(items, f, dir) {
    const a = items[f];
    const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
    let best = -1, bs = 1e9;
    for (let j = 0; j < items.length; j++) {
      if (j === f || items[j].disabled) continue;
      const dx = items[j].x + items[j].w / 2 - cx, dy = items[j].y + items[j].h / 2 - cy;
      let p, s;
      if (dir === 'down') { if (dy <= 1) continue; p = dy; s = Math.abs(dx); }
      else if (dir === 'up') { if (dy >= -1) continue; p = -dy; s = Math.abs(dx); }
      else if (dir === 'left') { if (dx >= -1) continue; p = -dx; s = Math.abs(dy); }
      else { if (dx <= 1) continue; p = dx; s = Math.abs(dy); }
      const sc = p + s * 2;
      if (sc < bs) { bs = sc; best = j; }
    }
    if (best < 0 && (dir === 'up' || dir === 'down')) { // wrap around
      let bc = dir === 'down' ? 1e9 : -1e9;
      for (let j = 0; j < items.length; j++) {
        if (j === f || items[j].disabled) continue;
        const cyj = items[j].y + items[j].h / 2;
        if (dir === 'down' ? cyj < bc : cyj > bc) { bc = cyj; best = j; }
      }
    }
    return best;
  }
  DD.ui.menu = function (state, items) {
    const n = items.length;
    if (!n) return -1;
    if (state.focus == null || state.focus < 0 || state.focus >= n || items[state.focus].disabled) {
      state.focus = firstEnabled(items);
    }
    if (state.mx !== mouse.x || state.my !== mouse.y) {
      state.mx = mouse.x; state.my = mouse.y;
      for (let i = 0; i < n; i++) {
        if (!items[i].disabled && input.mouseIn(items[i].x, items[i].y, items[i].w, items[i].h)) { state.focus = i; break; }
      }
    }
    const dirs = ['up', 'down', 'left', 'right'];
    for (let k = 0; k < 4; k++) {
      if (input.hit(dirs[k])) {
        const j = neighbor(items, state.focus, dirs[k]);
        if (j >= 0 && j !== state.focus) {
          state.focus = j;
          if (DD.audio && DD.audio.sfx) DD.audio.sfx('select');
        }
        input.consume(dirs[k]);
      }
    }
    let act = -1;
    for (let i = 0; i < n; i++) {
      const it = items[i];
      const clicked = D.button(it.label || '', it.x, it.y, it.w, it.h,
        { disabled: it.disabled, color: it.color, size: it.size, selected: i === state.focus });
      if (clicked && act < 0) { act = i; state.focus = i; }
    }
    if (act < 0 && input.hit('confirm') && !items[state.focus].disabled) {
      act = state.focus;
      input.consume('confirm');
      if (DD.audio && DD.audio.sfx) DD.audio.sfx('select');
    }
    return act;
  };

  // ---------------------------------------------------------------- fx
  const fx = DD.fx = {};
  let shakeI = 0, shakeT = 0, shakeMax = 1;
  let flashC = null, flashT = 0, flashMax = 1;
  const floats = [];
  const parts = [];

  fx.shake = function (intensity, time) {
    const cur = shakeT > 0 ? shakeI * (shakeT / shakeMax) : 0;
    if (intensity >= cur) { shakeI = intensity; shakeT = time; shakeMax = Math.max(time, 0.001); }
  };
  fx.flash = function (color, time) { flashC = color; flashT = flashMax = Math.max(time || 0.2, 0.001); };
  fx.float = function (text, x, y, color) {
    floats.push({ text: String(text), x: x, y: y, color: color || PAL.ink, t: 0, life: 1.2 });
    if (floats.length > 40) floats.shift();
  };
  fx.particles = function (x, y, color, count) {
    count = count == null ? 10 : count;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 70;
      parts.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        t: 0, life: 0.4 + Math.random() * 0.6, color: color || PAL.ember, s: Math.random() < 0.3 ? 2 : 1
      });
    }
    if (parts.length > 500) parts.splice(0, parts.length - 500);
  };
  fx.offset = function () {
    if (shakeT <= 0) return { x: 0, y: 0 };
    const mag = shakeI * (shakeT / shakeMax);
    return { x: Math.round((Math.random() * 2 - 1) * mag), y: Math.round((Math.random() * 2 - 1) * mag) };
  };
  fx.clear = function () {
    floats.length = 0; parts.length = 0; shakeT = 0; flashT = 0;
  };
  fx.update = function (dt) {
    if (shakeT > 0) { shakeT -= dt; if (shakeT <= 0) { shakeT = 0; shakeI = 0; } }
    if (flashT > 0) flashT -= dt;
    if (fadeT > 0) fadeT -= dt;
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.t += dt; f.y -= 22 * dt;
      if (f.t >= f.life) floats.splice(i, 1);
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt;
      p.vy += 170 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t >= p.life) parts.splice(i, 1);
    }
  };
  fx.draw = function (ctx) {
    ctx.save();
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < floats.length; i++) {
      const f = floats[i];
      const a = f.t < f.life * 0.6 ? 1 : 1 - (f.t - f.life * 0.6) / (f.life * 0.4);
      D.text(f.text, f.x, f.y, { color: f.color, align: 'center', alpha: Math.max(0, a) });
    }
    if (flashT > 0 && flashC) {
      ctx.globalAlpha = 0.55 * (flashT / flashMax);
      ctx.fillStyle = flashC; ctx.fillRect(0, 0, DD.W, DD.H);
    }
    if (fadeT > 0) {
      ctx.globalAlpha = fadeT / FADE_TIME;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, DD.W, DD.H);
    }
    ctx.restore();
  };

  // ---------------------------------------------------------------- save
  function defaults() {
    return { blueprints: {}, loops: 0, escapes: 0, deaths: 0, timeouts: 0, ether: 0,
             owned: {}, skin: 'none', bestTime: null, muted: false };
  }
  DD.save = {
    data: defaults(),
    write: function () {
      try { localStorage.setItem('ddh-save', JSON.stringify(DD.save.data)); } catch (e) { /* storage unavailable */ }
    },
    load: function () {
      const d = DD.save.data;
      try {
        const raw = localStorage.getItem('ddh-save');
        if (!raw) return d;
        const o = JSON.parse(raw);
        if (!o || typeof o !== 'object') return d;
        ['loops', 'escapes', 'deaths', 'timeouts', 'ether'].forEach(function (k) {
          if (typeof o[k] === 'number' && isFinite(o[k]) && o[k] >= 0) d[k] = Math.floor(o[k]);
        });
        if (o.blueprints && typeof o.blueprints === 'object') d.blueprints = o.blueprints;
        if (o.owned && typeof o.owned === 'object') d.owned = o.owned;
        if (typeof o.skin === 'string') d.skin = o.skin;
        if (typeof o.bestTime === 'number' && isFinite(o.bestTime)) d.bestTime = o.bestTime;
        if (typeof o.muted === 'boolean') d.muted = o.muted;
      } catch (e) { /* corrupt or unavailable: keep defaults */ }
      return d;
    }
  };
})();
