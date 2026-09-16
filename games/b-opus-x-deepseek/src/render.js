// Deadlock Deck: El Reloj Anatómico — ART worker (DD.Render). See PRODUCT.md §5.5.
// Every pixel is drawn procedurally with fillRect on the 384x216 backing canvas.
// No images, no web fonts, no fetch, no dependencies. Nothing here mutates state.
window.DD = window.DD || {};
(function () {
  'use strict';

  var W = 384, H = 216, GROUND = 178;

  // Alchemical gothic palette (§5.5) plus a few derived stone shades.
  var P = {
    bone: '#d9cdb4', rot: '#3f5c46', verd: '#4e8c7a', brass: '#b08d3f',
    ember: '#d8622b', blood: '#7a1f22', void: '#0d0b12', violet: '#5b3a72',
    stone: '#241f2e', stoneLit: '#3b3450', stoneDark: '#14101b',
    iron: '#4a4450', ash: '#8b8494', boneDark: '#a2937a'
  };
  var ROOMCOL = {
    slab: P.bone, combat: P.blood, elite: P.violet, cache: P.verd,
    trap: P.rot, exit: P.ember, empty: P.stoneLit
  };

  // ------------------------------------------------------------------ helpers
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function now() { return (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) / 1000; }
  function hash(i) { var x = Math.sin(i * 127.1 + 3.7) * 43758.5453; return x - Math.floor(x); }
  var _s = 20240915;
  function rnd() { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; }
  // Accepts '#rrggbb' and the 'rgb(r,g,b)' strings shade() itself returns.
  function hex(c) {
    if (typeof c !== 'string' || !c) return [255, 0, 255];
    if (c.charAt(0) === '#') { var n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    var m = c.match(/\d+/g);
    return m ? [+m[0], +m[1], +m[2]] : [255, 0, 255];
  }
  function shade(c, amt) {
    var v = hex(c), t = amt < 0 ? 0 : 255, k = Math.abs(amt);
    return 'rgb(' + ((v[0] + (t - v[0]) * k) | 0) + ',' + ((v[1] + (t - v[1]) * k) | 0) + ',' + ((v[2] + (t - v[2]) * k) | 0) + ')';
  }
  function mixCol(a, b, k) {
    var x = hex(a), y = hex(b);
    return 'rgb(' + ((x[0] + (y[0] - x[0]) * k) | 0) + ',' + ((x[1] + (y[1] - x[1]) * k) | 0) + ',' + ((x[2] + (y[2] - x[2]) * k) | 0) + ')';
  }

  // --------------------------------------------------------------- primitives
  var ctx = null, canvasEl = null;
  var T = 0, last = 0, LOW = 0, shakeAmt = 0, sx = 0, sy = 0;
  var hitA = { x: W / 2, y: 120 }, bodyA = { x: W / 2, y: 140 };

  function rect(x, y, w, h, c) { if (w <= 0 || h <= 0) return; ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); }
  function frame(x, y, w, h, c, t) {
    t = t || 1;
    rect(x, y, w, t, c); rect(x, y + h - t, w, t, c); rect(x, y + t, t, h - t * 2, c); rect(x + w - t, y + t, t, h - t * 2, c);
  }
  function fade(x, y, w, h, c, a) { ctx.globalAlpha = a; rect(x, y, w, h, c); ctx.globalAlpha = 1; }
  // Additive banded disc — the workhorse for every alchemical glow. Band height grows
  // with the radius so a huge glow costs ~26 rects instead of 300.
  function glow(x, y, r, c, a) {
    r = r | 0;
    if (r < 2 || a <= 0) return;
    x = x | 0; y = y | 0;
    var step = Math.max(1, Math.round(r / 26));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = c;
    for (var d = -r; d <= r; d += step) {
      var w = Math.sqrt(Math.max(0, r * r - d * d));
      ctx.globalAlpha = clamp(a * (1 - Math.abs(d) / r), 0, 1);
      ctx.fillRect((x - w) | 0, (y + d) | 0, (w * 2) | 0, step);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // Soft banded disc that darkens instead of lighting: used to sink the backdrop.
  function dark(x, y, r, a) {
    r = r | 0; x = x | 0; y = y | 0;
    if (r < 2 || a <= 0) return;
    var step = Math.max(1, Math.round(r / 26));
    ctx.fillStyle = P.void;
    for (var d = -r; d <= r; d += step) {
      var w = Math.sqrt(Math.max(0, r * r - d * d));
      ctx.globalAlpha = clamp(a * (1 - Math.abs(d) / r), 0, 1);
      ctx.fillRect((x - w) | 0, (y + d) | 0, (w * 2) | 0, step);
    }
    ctx.globalAlpha = 1;
  }
  function vignette(s) {
    var i, a;
    for (i = 0; i < 48; i++) {
      a = 0.34 * s * Math.pow(1 - i / 48, 2.2); if (a < 0.012) continue;
      ctx.globalAlpha = a; ctx.fillStyle = P.void;
      ctx.fillRect(i, 0, 1, H); ctx.fillRect(W - 1 - i, 0, 1, H);
    }
    for (i = 0; i < 32; i++) {
      a = 0.34 * s * Math.pow(1 - i / 32, 2.2); if (a < 0.012) continue;
      ctx.globalAlpha = a; ctx.fillStyle = P.void;
      ctx.fillRect(0, i, W, 1); ctx.fillRect(0, H - 1 - i, W, 1);
    }
    ctx.globalAlpha = 1;
  }
  function flick(k) { return 0.5 + 0.5 * Math.sin(T * 11 + k * 2.1) * Math.sin(T * 3.7 + k * 0.9); }
  function lamp(k) { return 0.8 + 0.2 * flick(k) + 0.5 * LOW * flick(k + 3); }
  function blink(p) { return (T % p) < p * 0.62; }
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  // ------------------------------------------------------------- pixel font
  // 5x5 block glyphs; rows separated by '|'. Spanish accents are added above the glyph.
  var GLYPHS = {
    A: '.###.|#...#|#####|#...#|#...#', B: '####.|#...#|####.|#...#|####.',
    C: '.####|#....|#....|#....|.####', D: '####.|#...#|#...#|#...#|####.',
    E: '#####|#....|####.|#....|#####', F: '#####|#....|####.|#....|#....',
    G: '.####|#....|#..##|#...#|.####', H: '#...#|#...#|#####|#...#|#...#',
    I: '#####|..#..|..#..|..#..|#####', J: '..###|...#.|...#.|#..#.|.##..',
    K: '#...#|#..#.|###..|#..#.|#...#', L: '#....|#....|#....|#....|#####',
    M: '#...#|##.##|#.#.#|#...#|#...#', N: '#...#|##..#|#.#.#|#..##|#...#',
    O: '.###.|#...#|#...#|#...#|.###.', P: '####.|#...#|####.|#....|#....',
    Q: '.###.|#...#|#.#.#|.###.|....#', R: '####.|#...#|####.|#..#.|#...#',
    S: '.####|#....|.###.|....#|####.', T: '#####|..#..|..#..|..#..|..#..',
    U: '#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|.#.#.|..#..',
    W: '#...#|#...#|#.#.#|##.##|#...#', X: '#...#|.#.#.|..#..|.#.#.|#...#',
    Y: '#...#|.#.#.|..#..|..#..|..#..', Z: '#####|...#.|..#..|.#...|#####',
    0: '.###.|#..##|#.#.#|##..#|.###.', 1: '..#..|.##..|..#..|..#..|.###.',
    2: '.###.|#...#|..##.|.#...|#####', 3: '####.|....#|.###.|....#|####.',
    4: '#..#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|####.',
    6: '.###.|#....|####.|#...#|.###.', 7: '#####|...#.|..#..|..#..|..#..',
    8: '.###.|#...#|.###.|#...#|.###.', 9: '.###.|#...#|.####|....#|.###.',
    ':': '.....|..#..|.....|..#..|.....', '.': '.....|.....|.....|.....|..#..',
    ',': '.....|.....|.....|..#..|.#...', '!': '..#..|..#..|..#..|.....|..#..',
    '-': '.....|.....|.###.|.....|.....', '/': '....#|...#.|..#..|.#...|#....',
    '+': '.....|..#..|.###.|..#..|.....', '?': '.###.|#...#|..#..|.....|..#..'
  };
  var FONT = {}, kk;
  for (kk in GLYPHS) FONT[kk] = GLYPHS[kk].split('|');
  var ACC = { 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N', 'Ü': 'U' };
  var ACCENTED = { 'Á': 1, 'É': 1, 'Í': 1, 'Ó': 1, 'Ú': 1, 'Ñ': 1, 'Ü': 1 };

  // Glyph rows are emitted as runs of lit pixels: one fillRect per run instead of
  // one per pixel. The drop shadow is only worth its cost on the big type.
  function text(s, x, y, sc, col, align, shad) {
    s = String(s == null ? '' : s).toUpperCase();
    if (sc < 2) shad = null;
    var w = s.length * 6 * sc - sc;
    var cx = align === 'center' ? x - (w >> 1) : align === 'right' ? x - w : x;
    for (var pass = shad ? 0 : 1; pass < 2; pass++) {
      ctx.fillStyle = pass === 0 ? shad : col;
      var ox = pass === 0 ? sc : 0, oy = pass === 0 ? sc : 0, bx = cx;
      for (var i = 0; i < s.length; i++) {
        var raw = s.charAt(i);
        if (raw !== ' ') {
          var g = FONT[ACC[raw] || raw] || FONT['?'];
          for (var r = 0; r < 5; r++) {
            var row = g[r], c = 0;
            while (c < 5) {
              if (row.charAt(c) !== '#') { c++; continue; }
              var c0 = c;
              while (c < 5 && row.charAt(c) === '#') c++;
              ctx.fillRect(bx + c0 * sc + ox, y + r * sc + oy, (c - c0) * sc, sc);
            }
          }
          if (pass === 1 && ACCENTED[raw]) {
            var tx = bx + sc, ty = y - 4 * sc;
            if (raw === 'Ñ' || raw === 'Ü') { ctx.fillRect(tx, ty + sc, sc, sc); ctx.fillRect(tx + sc, ty, sc, sc); ctx.fillRect(tx + 2 * sc, ty + sc, sc, sc); }
            else { ctx.fillRect(tx, ty + sc, sc, sc); ctx.fillRect(tx + sc, ty, sc, sc); }
          }
        }
        bx += 6 * sc;
      }
    }
  }

  // Centered text broken over as many rows as it needs: a Spanish message can be wider
  // than the 384 px screen at scale 1.
  function wrapText(s, x, y, sc, col, maxW) {
    var words = String(s == null ? '' : s).split(' '), line = '', row = 0, i;
    for (i = 0; i < words.length; i++) {
      var next = line ? line + ' ' + words[i] : words[i];
      if (line && next.length * 6 * sc - sc > maxW) {
        text(line, x, y + row * 7 * sc, sc, col, 'center', P.void);
        row++;
        line = words[i];
      } else {
        line = next;
      }
    }
    if (line) text(line, x, y + row * 7 * sc, sc, col, 'center', P.void);
  }

  // ------------------------------------------------------------------ ambience
  var motes = [], sparks = [], pending = [];

  function makeMote() {
    return { x: rnd() * W, y: rnd() * H, vx: -4 - rnd() * 9, vy: -3 - rnd() * 8, s: rnd() < 0.25 ? 2 : 1, p: rnd() * 6.283, e: rnd() < 0.16 };
  }
  function initMotes() { motes.length = 0; for (var i = 0; i < 46; i++) motes.push(makeMote()); }
  function updateMotes(dt) {
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      m.x += (m.vx + Math.sin(T * 0.7 + m.p) * 7) * dt;
      m.y += m.vy * dt;
      if (m.y < -6 || m.x < -6 || m.y > H + 6) { m.x = rnd() * W; m.y = H + 4; }
    }
  }
  function drawMotes(a) {
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      ctx.globalAlpha = clamp((m.e ? 0.85 : 0.34) * a * (1 + LOW * 0.8), 0, 1);
      ctx.fillStyle = m.e ? P.ember : P.ash;
      ctx.fillRect(m.x | 0, m.y | 0, m.s, m.s);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------- sparks
  var PS = {
    hit: { n: 16, sp: 95, g: 200, life: 0.5, s: 2, c: [P.blood, shade(P.blood, 0.35), P.bone] },
    break: { n: 22, sp: 130, g: 220, life: 0.8, s: 2, c: [P.blood, P.bone, shade(P.bone, -0.3), P.blood] },
    heal: { n: 18, sp: 42, g: -55, life: 0.9, s: 2, c: [P.verd, shade(P.verd, 0.35), P.bone] },
    steam: { n: 22, sp: 34, g: -85, life: 1.2, s: 3, grow: 7, c: ['#cfd6d0', '#9fb0a8', P.ash] },
    harvest: { n: 20, sp: 80, g: 55, life: 0.9, s: 2, c: [P.brass, P.violet, P.ember] }
  };
  function emit(kind, x, y) {
    var s = PS[kind];
    if (!s) return;
    for (var i = 0; i < s.n; i++) {
      var a = rnd() * 6.283, v = s.sp * (0.3 + rnd());
      var up = kind === 'steam' ? -24 : 0;
      sparks.push({
        x: x + rnd() * 18 - 9, y: y + rnd() * 14 - 7,
        vx: Math.cos(a) * v * (kind === 'steam' ? 0.7 : 1), vy: Math.sin(a) * v * (kind === 'steam' ? 0.5 : 0.85) + up,
        g: s.g, life: s.life * (0.6 + rnd() * 0.7), max: s.life,
        s: s.s * (rnd() < 0.3 ? 2 : 1), grow: s.grow || 0, c: s.c[(rnd() * s.c.length) | 0]
      });
    }
    if (sparks.length > 260) sparks.splice(0, sparks.length - 260);
  }
  function drawSparks(dt) {
    var drag = Math.pow(0.12, dt);
    for (var i = sparks.length - 1; i >= 0; i--) {
      var p = sparks[i];
      p.life -= dt;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.s = Math.min(10, p.s + p.grow * dt);
      var a = clamp(p.life / p.max, 0, 1);
      if (p.g > 0) p.vx *= drag;
      ctx.globalAlpha = a;
      rect(p.x, p.y, p.s, p.s, p.c);
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------- lab backdrop
  function stoneWall(x, y, w, h, lit) {
    rect(x, y, w, h, shade(P.stone, lit || 0));
    for (var r = 0; r * 10 < h; r++) {
      var ry = y + r * 10;
      rect(x, ry, w, 1, P.stoneDark);
      for (var c = 0; c * 26 + (r % 2) * 13 < w; c++) rect(x + c * 26 + (r % 2) * 13, ry + 1, 1, 9, shade(P.stone, -0.28));
    }
    for (var i = 0; i < 14; i++) rect(x + hash(i * 3.7 + x) * w, y + hash(i * 7.1 + y) * h, 7, 3, shade(P.stone, 0.1));
  }
  function arch(cx, baseY, w, h, ring, inner, t) {
    t = t || 5;
    var r = w / 2, top = baseY - h, cy = top + r, y, d, hw;
    for (y = top; y < cy; y++) { d = cy - y; hw = Math.sqrt(Math.max(0, r * r - d * d)); rect(cx - hw, y, hw * 2, 1, ring); }
    rect(cx - r, cy, w, baseY - cy, ring);
    var ri = r - t;
    for (y = top + t; y < cy; y++) { d = cy - y; hw = Math.sqrt(Math.max(0, ri * ri - d * d)); rect(cx - hw, y, hw * 2, 1, inner); }
    rect(cx - ri, cy, ri * 2, baseY - cy, inner);
  }
  function floorTiles() {
    rect(0, GROUND, W, H - GROUND, shade(P.stone, -0.45));
    var y = GROUND;
    for (var i = 0; i < 6; i++) {
      var h = 4 + i * 1.8, step = 30 + i * 13;
      rect(0, y, W, 1, shade(P.stone, 0.06));
      for (var x = (i % 2) * (step / 2); x < W; x += step) rect(x, y, 1, h, shade(P.stone, -0.58));
      y += h;
    }
  }
  function backdrop() {
    rect(0, 0, W, H, P.void);
    rect(0, 0, W, 20, shade(P.stone, -0.55));
    for (var i = 0; i < 9; i++) rect(i * 44 + 6, 0, 3, 20, shade(P.stone, -0.3));
    rect(0, 19, W, 2, shade(P.stone, -0.15));
    stoneWall(0, 21, W, GROUND - 21, 0);
    arch(64, GROUND, 74, 120, shade(P.stone, 0.12), P.void, 5);
    arch(192, GROUND, 98, 152, shade(P.stone, 0.14), P.void, 6);
    arch(320, GROUND, 74, 120, shade(P.stone, 0.12), P.void, 5);
    rect(0, 28, W, 5, shade(P.brass, -0.38));
    for (var j = 0; j < 10; j++) rect(10 + j * 40, 27, 6, 7, shade(P.brass, -0.12));
    rect(0, 46, W, 3, shade(P.brass, -0.5));
    floorTiles();
  }
  function sconce(x, y, fl) {
    rect(x - 2, y, 5, 12, shade(P.iron, -0.15));
    rect(x - 6, y - 4, 13, 5, shade(P.brass, -0.1));
    var f = flick(x * 0.11);
    rect(x - 4, y - 8 - f * 4, 8, 7 + f * 4, P.ember);
    rect(x - 2, y - 13 - f * 6, 4, 7 + f * 5, shade(P.ember, 0.3));
    rect(x - 1, y - 17 - f * 7, 2, 5, shade(P.bone, 0.12));
    glow(x, y - 6, 34, P.ember, 0.13 * fl * (0.75 + 0.5 * f));
  }
  function brazier(x, y, fl) {
    rect(x - 2, y, 5, 16, shade(P.iron, -0.18));
    rect(x - 8, y + 14, 17, 4, shade(P.iron, 0));
    rect(x - 9, y - 8, 19, 9, shade(P.brass, -0.12));
    rect(x - 7, y - 6, 15, 6, shade(P.brass, -0.4));
    rect(x - 6, y - 9, 13, 2, P.ember);
    var f = flick(x * 0.13);
    rect(x - 5, y - 14 - f * 5, 11, 8 + f * 5, P.ember);
    rect(x - 3, y - 20 - f * 7, 7, 8 + f * 6, shade(P.ember, 0.3));
    rect(x - 1, y - 26 - f * 8, 3, 7, shade(P.bone, 0.18));
    glow(x, y - 16, 46, P.ember, 0.16 * fl * (0.7 + 0.5 * f));
  }

  // -------------------------------------------------------------- room props
  function propSlab(fl) {
    var y = 176;
    rect(112, y, 160, 8, shade(P.stone, 0.5));
    rect(112, y - 3, 160, 3, shade(P.stone, 0.78));
    rect(112, y + 8, 160, 2, shade(P.stone, -0.35));
    rect(120, y + 10, 10, 16, shade(P.iron, 0.1));
    rect(254, y + 10, 10, 16, shade(P.iron, 0.1));
    rect(140, y - 6, 7, 15, P.boneDark); rect(240, y - 6, 7, 15, P.boneDark);
    rect(168, y - 3, 46, 4, P.blood);
    rect(176, y - 16, 40, 13, shade(P.bone, -0.14));
    rect(176, y - 18, 40, 3, shade(P.bone, 0.06));
    rect(182, y - 12, 26, 2, shade(P.blood, -0.05));
    rect(66, y + 4, 36, 4, shade(P.stone, 0.45));
    rect(70, y - 1, 3, 6, shade(P.bone, 0.15)); rect(78, y - 2, 2, 7, shade(P.iron, 0.2)); rect(86, y - 1, 9, 2, shade(P.iron, 0.2));
    glow(196, y - 22, 42, P.verd, 0.05 * fl);
  }
  function propBones() {
    for (var i = 0; i < 10; i++) {
      var x = 36 + hash(i * 5.3) * 310, y = 184 + hash(i * 2.1) * 26;
      rect(x, y, 8 + hash(i * 1.7) * 9, 2, P.boneDark);
      if (hash(i * 9.1) > 0.55) { rect(x, y - 6, 7, 7, P.bone); rect(x + 1, y - 4, 2, 2, P.void); rect(x + 4, y - 4, 2, 2, P.void); }
    }
  }
  function propCombat(fl) {
    for (var i = 0; i < 2; i++) {
      var r = 42 + i * 19;
      for (var a = 0; a < 44; a++) {
        var an = a / 44 * 6.283;
        rect(192 + Math.cos(an) * r, 196 + Math.sin(an) * r * 0.3, 2, 2, i ? shade(P.violet, -0.25) : P.violet);
      }
    }
    glow(192, 196, 74, P.violet, 0.09 * fl);
    propBones();
  }
  function propElite(fl) {
    for (var i = 0; i < 3; i++) {
      var x = 118 + i * 66;
      for (var y = 22; y < 92 + i * 14; y += 6) rect(x + (((y / 6) | 0) % 2) * 3, y, 3, 5, shade(P.iron, 0.06));
    }
    rect(96, 150, 10, 30, shade(P.iron, 0.16)); rect(96, 147, 62, 5, shade(P.iron, 0.34));
    rect(104, 118, 46, 30, shade(P.brass, -0.25));
    rect(104, 118, 46, 4, shade(P.brass, 0.1));
    for (var j = 0; j < 3; j++) rect(108, 126 + j * 7, 38, 3, shade(P.brass, -0.45));
    rect(250, 106, 46, 74, shade(P.void, 0.14));
    rect(262, 94, 20, 16, shade(P.void, 0.18));
    rect(265, 100, 4, 4, P.ember); rect(275, 100, 4, 4, P.ember);
    glow(270, 104, 28, P.ember, 0.11 * fl);
  }
  function propCache(fl) {
    rect(84, 104, 216, 4, shade(P.stone, 0.55));
    rect(84, 148, 216, 4, shade(P.stone, 0.55));
    rect(84, 100, 4, 52, shade(P.stone, 0.3)); rect(296, 100, 4, 52, shade(P.stone, 0.3));
    for (var i = 0; i < 6; i++) {
      var x = 96 + i * 32, y = (i % 2) ? 130 : 86;
      rect(x + 4, y + 2, 3, 5, shade(P.verd, 0.2));
      rect(x, y + 7, 11, 10, P.verd);
      rect(x + 1, y + 9, 9, 6, shade(P.verd, 0.3));
      glow(x + 5, y + 12, 14, P.verd, (0.07 + 0.03 * flick(i)) * fl);
    }
    rect(150, 162, 84, 30, shade(P.stone, 0.26));
    rect(150, 162, 84, 6, shade(P.stone, 0.5));
    rect(150, 176, 84, 3, shade(P.brass, -0.1));
    rect(186, 170, 10, 14, P.brass); rect(188, 177, 6, 5, P.void);
    fade(136, 188, 118, 12, P.void, 0.4);
  }
  function propTrap(fl) {
    rect(140, 180, 104, 26, shade(P.stone, -0.1));
    for (var i = 0; i < 7; i++) rect(146 + i * 15, 180, 3, 26, shade(P.iron, 0.3));
    for (var s = 0; s < 5; s++) {
      var x = 158 + s * 18;
      for (var k = 0; k < 9; k++) rect(x + k * 0.4, 178 - k, 9 - k * 0.8, 1, shade(P.iron, 0.45));
    }
    glow(192, 172, 62, P.rot, 0.15 * fl * (0.8 + 0.4 * flick(3)));
    for (var r = 0; r < 5; r++) rect(116 + r * 32, 208, 12, 2, shade(P.rot, 0.28));
  }
  function propExit(fl, room) {
    var cx = 192, w = 98, top = 32, bot = 176, i, x;
    rect(cx - w / 2, top, w, bot - top, P.void);
    for (i = 0; i < 9; i++) {
      x = cx - w / 2 + 5 + i * 11;
      var f = flick(i * 1.7), hh = 12 + f * 36;
      rect(x, bot - hh, 9, hh, i % 2 ? shade(P.ember, -0.28) : shade(P.ember, -0.1));
      rect(x + 2, bot - hh - 8 - f * 16, 5, 11 + f * 18, shade(P.ember, 0.3));
      rect(x + 3, bot - 7, 3, 7, shade(P.bone, 0.3));
    }
    glow(cx, bot - 56, 118, P.ember, 0.24 * (0.7 + 0.5 * flick(2)) * fl);
    if (!(room && room.cleared)) {
      for (i = 0; i <= 6; i++) rect(cx - w / 2 + i * (w / 6), top, 5, bot - top, shade(P.brass, -0.12));
      rect(cx - w / 2, top, w, 6, shade(P.brass, 0.05));
      rect(cx - w / 2, bot - 9, w, 9, shade(P.brass, -0.22));
      rect(cx - 12, 96, 24, 24, shade(P.brass, -0.06));
      rect(cx - 8, 100, 16, 16, shade(P.brass, -0.4));
      rect(cx - 2, 96, 4, 24, shade(P.brass, 0.12));
      rect(cx - 12, 106, 24, 4, shade(P.brass, 0.12));
    } else {
      fade(cx - w / 2, top, w, bot - top, shade(P.ember, -0.1), 0.3);
      glow(cx, bot - 80, 60, shade(P.bone, 0.2), 0.08);
    }
  }
  function propEmpty(fl) {
    rect(56, 152, 26, 28, shade(P.stone, 0.3));
    rect(52, 146, 34, 7, shade(P.stone, 0.55));
    rect(300, 158, 30, 22, shade(P.stone, 0.26));
    rect(296, 152, 38, 7, shade(P.stone, 0.52));
    for (var i = 0; i < 9; i++) rect(80 + hash(i * 4.1) * 240, 186 + hash(i * 6.3) * 22, 4 + hash(i) * 8, 3, shade(P.stone, hash(i * 2.9) * 0.3 - 0.2));
    glow(192, 130, 50, P.rot, 0.05 * fl);
  }
  function propFor(type, room, fl) {
    switch (type) {
      case 'slab': return propSlab(fl);
      case 'combat': return propCombat(fl);
      case 'elite': return propElite(fl);
      case 'cache': return propCache(fl);
      case 'trap': return propTrap(fl);
      case 'exit': return propExit(fl, room);
      default: return propEmpty(fl);
    }
  }

  // ------------------------------------------------------------------ minimap
  function drawMinimap(state) {
    var tw = state && state.tower;
    if (!tw || !tw.rooms) return;
    var gw = tw.w || 5, gh = tw.h || 5, cell = 7, gap = 3, pad = 4;
    var iw = gw * cell + (gw - 1) * gap, ih = gh * cell + (gh - 1) * gap;
    var x0 = W - iw - pad - 8, y0 = pad + 8, key, i;
    fade(x0 - pad - 1, y0 - pad - 1, iw + pad * 2 + 2, ih + pad * 2 + 2, P.void, 0.75);
    frame(x0 - pad - 1, y0 - pad - 1, iw + pad * 2 + 2, ih + pad * 2 + 2, shade(P.brass, -0.4), 1);
    for (key in tw.rooms) {
      var r = tw.rooms[key];
      if (!r || !r.seen) continue;
      var rx = x0 + r.x * (cell + gap), ry = y0 + r.y * (cell + gap);
      var col = ROOMCOL[r.type] || P.stoneLit;
      rect(rx, ry, cell, cell, r.visited ? col : shade(col, -0.52));
      frame(rx, ry, cell, cell, shade(col, -0.65), 1);
      var links = r.links || [];
      for (i = 0; i < links.length; i++) {
        var nb = tw.rooms[links[i]];
        if (!nb || !nb.seen) continue;
        if (nb.x > r.x) rect(rx + cell, ry + 3, gap, 1, shade(P.brass, -0.25));
        else if (nb.y > r.y) rect(rx + 3, ry + cell, 1, gap, shade(P.brass, -0.25));
      }
      if (r.id === tw.exitId) {
        var ex = rx + 3, ey = ry + 3;
        rect(ex - 2, ey, 2, 1, P.ember); rect(ex + 1, ey, 2, 1, P.ember);
        rect(ex, ey - 2, 1, 2, P.ember); rect(ex, ey + 1, 1, 2, P.ember);
        glow(rx + 3, ry + 3, 9, P.ember, 0.18);
      }
    }
    var p = tw.rooms[state.posId];
    if (p && p.seen) {
      var mx = x0 + p.x * (cell + gap) + 3, my = y0 + p.y * (cell + gap) + 3;
      frame(mx - 2, my - 2, 5, 5, P.void, 1);
      if (blink(0.8)) rect(mx - 1, my - 1, 3, 3, P.bone);
      else rect(mx, my, 1, 1, P.bone);
    }
  }

  // ----------------------------------------------------------- body / anatomy
  function slotOf(body, key) { return body && body.slots ? body.slots[key] : null; }
  function isStump(body, key) { var s = slotOf(body, key); return !s || !!s.broken || !s.limbId; }
  function limbData(limbId) { return limbId && DD.DATA && DD.DATA.LIMBS ? DD.DATA.LIMBS[limbId] : null; }
  // Limb tints are lifted a little: the vault is dark and the body must read as the hero.
  function tintOf(body, key) { var s = slotOf(body, key), L = limbData(s && s.limbId); return shade((L && L.tint) || P.ash, 0.18); }
  function heatOf(body, key) {
    if (isStump(body, key)) return 0;
    if (DD.Body && typeof DD.Body.heatRatio === 'function') {
      try { return clamp(DD.Body.heatRatio(body, key) || 0, 0, 1); } catch (e) { /* fall through */ }
    }
    var s = slotOf(body, key), L = limbData(s.limbId);
    return L && L.integrity ? clamp((s.heat || 0) / L.integrity, 0, 1) : 0;
  }
  // Heat reads as a ring of light bleeding off the limb: hollow centre so stacked
  // glows from neighbouring limbs cannot blow the whole body out to white.
  function heatGlow(x, y, w, h, hr) {
    if (hr <= 0.05) return;
    var cx = x + (w >> 1), cy = y + (h >> 1), d, ww;
    var r = (Math.max(w, h) * 0.85) | 0, a = (0.04 + 0.22 * hr * hr) * lamp(3);
    var step = Math.max(1, Math.round(r / 20));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hr > 0.72 ? shade(P.ember, 0.45) : P.ember;
    for (d = -r; d <= r; d += step) {
      ww = Math.sqrt(Math.max(0, r * r - d * d));
      ctx.globalAlpha = clamp(a * (Math.abs(d) / r), 0, 1);
      ctx.fillRect((cx - ww) | 0, (cy + d) | 0, (ww * 2) | 0, step);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function stump(x, y, w, h, vertical) {
    var sw = vertical ? w : w - 8, sh = vertical ? h - 10 : h - 5;
    var ox = x + (w - sw) / 2, oy = y + (vertical ? 8 : 3);
    rect(ox, oy, sw, sh, P.blood);
    rect(ox + 1, oy + 1, sw - 2, sh - 2, shade(P.blood, -0.3));
    for (var i = 0; i < sw; i += 2) rect(ox + i, oy - 1 - ((hash(i * 3.1 + x) * 2) | 0), 2, 3, P.blood);
    rect(ox + sw / 2 - 2, oy + 2, 4, 3, P.bone);
    var drip = (T * 26) % 18;
    rect(ox + 2, oy + sh + drip - 9, 1, 5, shade(P.blood, 0.12));
    rect(ox + sw - 4, oy + sh + ((drip + 9) % 18) - 9, 1, 4, shade(P.blood, 0.06));
    fade(ox - 1, oy - 1, sw + 2, sh + 2, P.blood, 0.22);
  }
  function limbHead(x, y, tint, hr, id) {
    rect(x + 1, y + 2, 16, 13, tint);
    rect(x + 2, y + 3, 14, 4, shade(tint, 0.2));
    rect(x - 1, y + 8, 3, 6, shade(tint, -0.15)); rect(x + 16, y + 8, 3, 6, shade(tint, -0.15));
    rect(x + 3, y + 7, 5, 5, P.void); rect(x + 10, y + 7, 5, 5, P.void);
    var eye = hr > 0.5 ? P.ember : P.verd;
    rect(x + 4, y + 8, 3, 3, eye); rect(x + 11, y + 8, 3, 3, eye);
    rect(x + 4, y + 13, 10, 3, shade(tint, -0.32));
    for (var i = 0; i < 5; i++) rect(x + 4 + i * 2, y + 13, 1, 2, P.bone);
    if (id === 'head_hound') { rect(x + 1, y - 2, 5, 5, shade(tint, -0.2)); rect(x + 12, y - 2, 5, 5, shade(tint, -0.2)); rect(x + 6, y + 14, 6, 3, shade(tint, -0.45)); }
    else if (id === 'head_furnace') { rect(x + 6, y - 7, 6, 10, shade(P.brass, -0.1)); rect(x + 5, y - 9, 8, 3, shade(P.brass, 0.2)); }
    else if (id === 'head_scholar') { // brass spectacles straddling both sockets
      rect(x + 1, y + 5, 16, 2, shade(P.brass, 0.05));
      rect(x + 1, y + 5, 2, 9, shade(P.brass, 0.05));
      rect(x + 15, y + 5, 2, 9, shade(P.brass, 0.05));
      rect(x + 8, y + 6, 2, 2, shade(P.brass, 0.05));
    }
    else { for (var j = 0; j < 4; j++) rect(x + 4 + j * 3, y, 1, 3, P.boneDark); }
  }
  function limbTorso(x, y, tint, id) {
    rect(x, y + 2, 26, 26, tint);
    rect(x + 1, y + 4, 24, 22, shade(tint, -0.14));
    for (var i = 0; i < 4; i++) rect(x + 3, y + 7 + i * 5, 20, 2, P.bone);
    rect(x + 12, y + 2, 2, 26, shade(tint, -0.42));
    rect(x + 6, y + 25, 14, 4, shade(tint, -0.32));
    if (id === 'torso_brass') { rect(x - 1, y + 4, 4, 24, shade(P.brass, -0.18)); rect(x + 23, y + 4, 4, 24, shade(P.brass, -0.18)); rect(x + 8, y + 9, 10, 8, P.brass); rect(x + 11, y + 11, 4, 4, P.ember); }
    else if (id === 'torso_alembic') { rect(x + 7, y + 8, 12, 15, shade(P.verd, -0.25)); rect(x + 8, y + 10, 10, 11, P.verd); }
    else if (id === 'torso_wretch') { rect(x + 9, y + 17, 8, 9, shade(P.blood, -0.12)); }
    else { for (var j = 0; j < 6; j++) rect(x + 1 + (j % 2) * 17, y + 6 + j * 3, 4, 1, P.boneDark); }
  }
  function limbArm(x, y, w, h, tint, id) {
    rect(x, y, w, h - 4, tint);
    rect(x + 1, y + 1, w - 2, h - 6, shade(tint, -0.1));
    rect(x - 1, y + 2, w + 2, 4, shade(tint, 0.1));            // shoulder/elbow bulge
    rect(x - 1, y + h - 6, w + 2, 7, shade(tint, -0.04));      // hand
    for (var i = 0; i < 3; i++) rect(x + i * 3, y + h + 1, 2, 4, shade(tint, -0.26));
    if (id === 'arm_cleaver') { rect(x + w - 2, y + h - 3, 4, 14, P.bone); rect(x + w - 1, y + h + 9, 8, 5, shade(P.bone, -0.25)); }
    else if (id === 'arm_bellows') { rect(x - 2, y + 6, w + 6, 10, shade(P.blood, 0.14)); rect(x - 2, y + 8, w + 6, 1, P.boneDark); }
    else if (id === 'arm_needle') { rect(x + w - 2, y + h + 1, 2, 11, shade(P.bone, 0.2)); }
    else if (id === 'arm_gauntlet') { rect(x - 1, y + 2, w + 2, 6, P.brass); rect(x - 2, y + h - 7, w + 4, 10, P.brass); }
    else { for (var j = 0; j < 3; j++) rect(x + 2, y + 6 + j * 6, 1, 3, P.boneDark); }
  }
  function limbLeg(x, y, w, h, tint, id) {
    rect(x, y, w, 16, tint);
    rect(x + 1, y + 1, w - 2, 14, shade(tint, -0.12));
    rect(x, y + 15, w - 1, 9, shade(tint, -0.22));
    rect(x - 3, y + 21, w + 6, 5, shade(tint, -0.34));
    if (id === 'leg_piston') { rect(x + 1, y + 6, 3, 14, P.brass); rect(x - 1, y + 15, w + 2, 4, P.brass); }
    else if (id === 'leg_hound') { rect(x - 4, y + 19, w + 8, 4, shade(tint, -0.4)); rect(x - 6, y + 21, 4, 4, shade(P.bone, -0.12)); }
    else if (id === 'leg_root') { for (var i = 0; i < 4; i++) rect(x - 3 + i * 4, y + 22, 2, 6 + (i % 2) * 3, shade(tint, -0.32)); }
    else { rect(x + 2, y + 8, w - 3, 2, P.boneDark); }
  }
  function drawSlot(body, key, x, y, w, h) {
    if (isStump(body, key)) { stump(x, y, w, h, key !== 'head' && key !== 'torso'); return; }
    var s = slotOf(body, key), tint = tintOf(body, key), hr = heatOf(body, key);
    var kind = s.limbId.split('_')[0];
    rect(x - 1, y - 1, w + 2, h + 2, P.void); // 1px dark outline so every limb reads apart
    if (kind === 'head') limbHead(x, y, tint, hr, s.limbId);
    else if (kind === 'torso') limbTorso(x, y, tint, s.limbId);
    else if (kind === 'arm') limbArm(x, y, w, h, tint, s.limbId);
    else limbLeg(x, y, w, h, tint, s.limbId);
    if (kind !== 'head') rect(x, y + 2, 1, h - 7, shade(tint, 0.34)); // lit left edge, reads volume
    if (kind === 'torso') rect(x + w - 1, y + 3, 1, h - 9, shade(tint, -0.45));
    heatGlow(x, y, w, h, hr);
  }
  function drawAbomination(body, cx) {
    var legY = GROUND - 27, torY = GROUND - 52, headY = GROUND - 68, armY = GROUND - 51;
    fade(cx - 30, GROUND - 2, 60, 6, P.void, 0.55);
    drawSlot(body, 'legL', cx - 12, legY, 9, 26);
    drawSlot(body, 'legR', cx + 3, legY, 9, 26);
    drawSlot(body, 'torso', cx - 13, torY, 26, 28);
    drawSlot(body, 'armL', cx - 23, armY, 9, 28);
    drawSlot(body, 'armR', cx + 14, armY, 9, 28);
    drawSlot(body, 'head', cx - 9, headY, 18, 16);
  }

  // ------------------------------------------------------------ enemy sprites
  function enemyTint(e) {
    var d = DD.DATA && DD.DATA.ENEMIES ? DD.DATA.ENEMIES[e.id] : null;
    return (d && d.tint) || e.tint || P.ash;
  }
  function drawEnemy(e, cx) {
    var t = enemyTint(e), id = e.id || '', g = GROUND, i, j;
    switch (id) {
      case 'assistant': // hunched, stitched servant
        rect(cx - 14, g - 26, 9, 26, shade(t, -0.3)); rect(cx + 5, g - 26, 9, 26, shade(t, -0.3));
        rect(cx - 6, g - 26, 5, 26, shade(t, -0.44)); rect(cx + 1, g - 26, 5, 26, shade(t, -0.44));
        rect(cx - 23, g - 52, 11, 30, shade(t, -0.2)); rect(cx + 12, g - 50, 11, 26, shade(t, -0.2));
        rect(cx - 15, g - 58, 30, 34, t);
        rect(cx - 15, g - 58, 30, 5, shade(t, 0.14));
        for (i = 0; i < 4; i++) rect(cx - 10, g - 50 + i * 8, 20, 1, shade(t, -0.46));
        rect(cx - 1, g - 58, 2, 34, shade(t, -0.52));
        for (i = 0; i < 5; i++) rect(cx - 4, g - 54 + i * 7, 8, 1, P.boneDark);
        rect(cx - 9, g - 74, 18, 16, shade(t, 0.06));
        rect(cx - 6, g - 69, 4, 4, P.void); rect(cx + 2, g - 69, 4, 4, P.void);
        rect(cx - 5, g - 68, 2, 2, P.ember); rect(cx + 3, g - 68, 2, 2, P.ember);
        rect(cx - 6, g - 59, 12, 2, P.boneDark);
        rect(cx - 10, g - 54, 20, 30, shade(P.blood, -0.42));   // butcher's apron
        rect(cx - 10, g - 54, 20, 2, shade(P.blood, -0.1));
        rect(cx - 8, g - 46, 16, 2, shade(P.bone, -0.25));
        rect(cx - 6, g - 40, 12, 2, shade(P.bone, -0.3));
        break;
      case 'scientist': // robed, beak mask
        rect(cx - 13, g - 12, 26, 12, shade(P.violet, -0.35));
        rect(cx - 11, g - 42, 22, 32, P.violet);
        rect(cx - 11, g - 42, 22, 4, shade(P.violet, 0.16));
        rect(cx - 25, g - 42, 9, 26, shade(P.violet, -0.12)); rect(cx + 16, g - 42, 9, 26, shade(P.violet, -0.12));
        rect(cx - 26, g - 18, 10, 9, shade(P.bone, -0.08)); rect(cx + 16, g - 18, 10, 9, shade(P.bone, -0.08));
        rect(cx - 8, g - 60, 16, 17, P.boneDark);
        rect(cx - 8, g - 60, 16, 4, shade(P.boneDark, 0.15));
        rect(cx - 6, g - 55, 4, 4, P.void); rect(cx + 2, g - 55, 4, 4, P.void);
        rect(cx - 5, g - 54, 2, 2, P.verd); rect(cx + 3, g - 54, 2, 2, P.verd);
        rect(cx - 2, g - 51, 5, 8, shade(P.brass, 0.06));
        rect(cx + 12, g - 16, 9, 10, P.verd); rect(cx + 13, g - 14, 7, 6, shade(P.verd, 0.3));
        glow(cx + 16, g - 12, 14, P.verd, 0.14 * lamp(1));
        break;
      case 'homunculus': // glass boiler with brass fittings
        rect(cx - 16, g - 46, 32, 30, shade(P.verd, -0.38));
        rect(cx - 16, g - 46, 32, 6, shade(P.verd, -0.12));
        rect(cx - 12, g - 40, 24, 20, shade(P.verd, -0.2));
        rect(cx - 16, g - 20, 32, 6, P.brass);
        rect(cx - 20, g - 44, 5, 22, shade(P.brass, -0.28)); rect(cx + 15, g - 44, 5, 22, shade(P.brass, -0.28));
        rect(cx - 4, g - 54, 8, 8, P.brass); rect(cx - 2, g - 60, 4, 7, P.brass);
        rect(cx - 7, g - 65, 14, 4, shade(P.brass, 0.2));
        rect(cx - 12, g - 14, 8, 14, shade(P.iron, -0.12)); rect(cx + 4, g - 14, 8, 14, shade(P.iron, -0.12));
        rect(cx - 14, g - 2, 12, 3, P.iron); rect(cx + 2, g - 2, 12, 3, P.iron);
        glow(cx, g - 30, 18, P.verd, 0.22 * lamp(1));
        break;
      case 'ash_hound': // low quadruped, ember eyes
        rect(cx - 24, g - 26, 44, 16, shade(t, -0.12));
        rect(cx - 24, g - 26, 44, 4, shade(t, 0.14));
        rect(cx - 16, g - 21, 30, 2, P.bone);
        rect(cx - 22, g - 12, 6, 12, shade(t, -0.34)); rect(cx - 6, g - 12, 6, 12, shade(t, -0.34));
        rect(cx + 8, g - 12, 6, 12, shade(t, -0.34)); rect(cx + 16, g - 12, 6, 12, shade(t, -0.34));
        rect(cx + 18, g - 40, 18, 16, shade(t, 0.06));
        rect(cx + 32, g - 34, 12, 8, shade(t, -0.14));
        rect(cx + 30, g - 32, 13, 2, P.void);
        rect(cx + 37, g - 30, 3, 3, P.bone);
        rect(cx + 22, g - 36, 5, 4, P.ember); rect(cx + 30, g - 36, 4, 4, P.ember);
        rect(cx + 19, g - 44, 5, 8, shade(t, -0.22)); rect(cx + 29, g - 44, 5, 8, shade(t, -0.22));
        rect(cx - 34, g - 22, 12, 6, shade(t, -0.4));
        glow(cx + 27, g - 34, 14, P.ember, 0.12 * lamp(2));
        break;
      case 'wretch': // crawling torso
        rect(cx - 26, g - 30, 52, 22, shade(t, -0.06));
        rect(cx - 26, g - 30, 52, 4, shade(t, 0.16));
        for (i = 0; i < 4; i++) rect(cx - 20, g - 24 + i * 5, 40, 1, shade(P.bone, -0.22));
        rect(cx - 30, g - 22, 10, 22, shade(t, -0.26)); rect(cx + 20, g - 22, 10, 22, shade(t, -0.26));
        rect(cx - 34, g - 8, 16, 8, shade(t, -0.38)); rect(cx + 18, g - 8, 16, 8, shade(t, -0.38));
        rect(cx - 8, g - 40, 22, 14, shade(t, 0.02));
        rect(cx - 4, g - 35, 4, 4, P.ember); rect(cx + 6, g - 35, 4, 4, P.ember);
        rect(cx - 22, g - 8, 44, 5, shade(P.blood, -0.22));
        rect(cx - 26, g - 5, 14, 3, P.blood); rect(cx + 8, g - 4, 16, 3, P.blood);
        break;
      case 'brass_guard':
      case 'brass_porter':
        var big = id === 'brass_porter', bw = big ? 40 : 34, bh = big ? 42 : 34;
        rect(cx - bw / 2 - 6, g - 24, 12, 24, shade(P.iron, -0.12)); rect(cx + bw / 2 - 6, g - 24, 12, 24, shade(P.iron, -0.12));
        rect(cx - bw / 2 - 8, g - 4, 17, 4, P.iron); rect(cx + bw / 2 - 9, g - 4, 17, 4, P.iron);
        rect(cx - bw / 2, g - 24 - bh, bw, bh, t);
        rect(cx - bw / 2, g - 24 - bh, bw, 6, shade(t, 0.18));
        rect(cx - bw / 2 + 3, g - 12 - bh, bw - 6, 3, shade(t, -0.32));
        rect(cx - 2, g - 24 - bh, 4, bh, shade(t, -0.42));
        rect(cx - bw / 2 - 11, g - 22 - bh, 11, 22, shade(t, -0.16)); rect(cx + bw / 2, g - 22 - bh, 11, 22, shade(t, -0.16));
        rect(cx - bw / 2 - 13, g - 20 - bh, 13, 6, shade(t, 0.1)); rect(cx + bw / 2, g - 20 - bh, 13, 6, shade(t, 0.1));
        rect(cx - 12, g - 42 - bh, 24, 18, shade(t, -0.06));
        rect(cx - 9, g - 38 - bh, 18, 3, P.void);
        rect(cx - 6, g - 38 - bh, 3, 3, P.ember); rect(cx + 3, g - 38 - bh, 3, 3, P.ember);
        rect(cx - 10, g - 46 - bh, 20, 4, shade(P.brass, 0.06));
        rect(cx - bw / 2 - 24, g - 30 - bh, 6, 36, shade(P.iron, 0.08));
        rect(cx - bw / 2 - 31, g - 36 - bh, 20, 9, shade(P.brass, 0.06));
        if (big) { rect(cx - 7, g - 20 - bh, 14, 11, shade(P.ember, -0.25)); glow(cx, g - 15 - bh, 18, P.ember, 0.16 * lamp(4)); }
        glow(cx, g - 36 - bh, 16, P.ember, 0.09 * lamp(3));
        break;
      default:
        rect(cx - 18, g - 42, 36, 42, t);
        rect(cx - 18, g - 42, 36, 5, shade(t, 0.16));
        rect(cx - 16, g - 30, 32, 3, P.bone);
        rect(cx - 6, g - 32, 5, 5, P.ember); rect(cx + 4, g - 32, 5, 5, P.ember);
        rect(cx - 14, g - 12, 30, 4, shade(P.blood, -0.12));
        break;
    }
  }

  // --------------------------------------------------------------- combat UI
  function bar(x, y, w, h, ratio, fill) {
    rect(x - 1, y - 1, w + 2, h + 2, P.void);
    frame(x - 1, y - 1, w + 2, h + 2, shade(P.bone, -0.4), 1);
    rect(x, y, w, h, shade(P.void, 0.16));
    var fw = Math.round(w * clamp(ratio, 0, 1));
    rect(x, y, fw, h, fill);
    if (fw > 1) rect(x, y, fw, 1, shade(fill, 0.35));
  }
  function shieldIcon(x, y, col) {
    rect(x + 1, y, 12, 2, col);
    rect(x, y + 2, 14, 7, col);
    rect(x + 2, y + 9, 10, 3, col);
    rect(x + 4, y + 12, 6, 2, shade(col, -0.15));
    rect(x + 6, y + 14, 2, 2, shade(col, -0.25));
    rect(x + 6, y + 3, 2, 7, shade(col, -0.45));
  }
  function intentIcon(it, x, y) {
    var type = it && it.type, n = it && it.amount ? it.amount : 0, lbl = '', i;
    switch (type) {
      case 'attack':
        rect(x + 5, y, 2, 10, P.bone); rect(x + 3, y + 10, 6, 2, P.brass); rect(x + 5, y + 12, 2, 3, P.bone);
        lbl = String(n); break;
      case 'multi':
        for (i = 0; i < 3; i++) rect(x + 1 + i * 3, y + 2, 2, 9, P.ember);
        lbl = n + 'X' + (it.times || 1); break;
      case 'block':
        shieldIcon(x, y + 1, P.brass); lbl = String(n); break;
      case 'heat':
        rect(x + 4, y, 3, 4, shade(P.ember, 0.25)); rect(x + 2, y + 3, 7, 5, P.ember); rect(x + 3, y + 8, 5, 4, shade(P.ember, -0.3));
        lbl = String(n); break;
      case 'bleed':
        rect(x + 4, y, 3, 4, P.blood); rect(x + 2, y + 3, 7, 6, P.blood); rect(x + 3, y + 9, 5, 3, shade(P.blood, 0.2));
        lbl = String(n); break;
      case 'weak':
        rect(x + 2, y + 1, 7, 2, P.violet); rect(x + 3, y + 3, 5, 2, P.violet); rect(x + 4, y + 5, 3, 3, P.violet);
        rect(x + 4, y + 9, 3, 3, shade(P.violet, -0.2));
        lbl = String(n); break;
      default:
        text('?', x + 4, y + 3, 1, P.ash); return;
    }
    if (lbl) text(lbl, x + 15, y + 3, 1, type === 'block' ? P.brass : P.bone);
  }

  // ------------------------------------------------------------------- scenes
  function currentRoom(state) {
    var tw = state && state.tower;
    return tw && tw.rooms ? tw.rooms[state.posId] || null : null;
  }
  function drawExplore(state) {
    var room = currentRoom(state), type = room ? room.type : 'empty';
    var fl = lamp(0);
    backdrop();
    sconce(50, 116, fl);
    sconce(334, 116, fl * 0.92);
    propFor(type, room, fl);
    fade(0, H - 14, W, 14, P.void, 0.4);
    drawMotes(0.55 + 0.45 * fl);
    vignette(1.15);
    drawMinimap(state);
    hitA = { x: 192, y: 150 }; bodyA = { x: 192, y: 156 };
  }
  function drawCombat(state) {
    var c = state.combat || {}, e = c.enemy || {};
    var fl = lamp(0), ex = 296, pxx = 88;
    backdrop();
    brazier(168, 152, fl);
    brazier(216, 152, fl * 0.95);
    glow(192, 150, 120, P.ember, 0.09 * fl);
    dark(ex, GROUND - 36, 56, 0.42);                       // sink the wall so the fighters pop
    glow(ex, GROUND - 34, 48, shade(enemyTint(e), 0.3), 0.05 * lamp(1));
    dark(pxx, GROUND - 34, 50, 0.42);
    drawEnemy(e, ex);
    if (e.hp != null && e.maxHp) bar(ex - 34, 96, 68, 5, e.hp / e.maxHp, shade(P.blood, 0.14));
    text(e.name || '?', ex, 88, 1, P.bone, 'center', P.void);
    if (e.intent) intentIcon(e.intent, ex - 17, 66);
    if ((e.block | 0) > 0) { shieldIcon(ex - 56, GROUND - 62, P.brass); text(String(e.block | 0), ex - 49, GROUND - 48, 1, P.brass); }
    if ((e.bleed | 0) > 0) { px(ex - 6, GROUND - 4, P.blood); px(ex + 14, GROUND - 2, shade(P.blood, 0.2)); }
    drawAbomination(state.body, pxx);
    if ((c.block | 0) > 0) {
      glow(pxx, GROUND - 34, 42, P.verd, 0.11 * lamp(2));
      shieldIcon(pxx - 50, GROUND - 64, P.verd);
      text(String(c.block | 0), pxx - 43, GROUND - 50, 1, P.verd);
    }
    drawMotes(0.4 + 0.5 * fl);
    vignette(1.05);
    hitA = { x: ex, y: GROUND - 44 };
    bodyA = { x: pxx, y: GROUND - 40 };
  }
  function drawTitle(state) {
    var fl = lamp(0);
    backdrop();
    rect(178, 116, 28, 36, shade(P.verd, -0.35));
    rect(181, 120, 22, 28, P.verd);
    rect(184, 124, 16, 18, shade(P.verd, 0.28));
    rect(188, 102, 8, 16, shade(P.brass, -0.12));
    rect(183, 98, 18, 5, shade(P.brass, 0.1));
    glow(192, 132, 84, P.verd, (0.16 + 0.05 * flick(1)) * fl);
    glow(192, 194, 150, P.ember, 0.09 * fl);
    drawMotes(1);
    vignette(1.35);
    text('DEADLOCK DECK', 192, 40, 4, P.bone, 'center', P.void);
    text(DD.T('EL RELOJ ANATÓMICO'), 192, 74, 2, P.brass, 'center', P.void);
    text(DD.T('SEIS MINUTOS. UN CUERPO PRESTADO.'), 192, 96, 1, shade(P.bone, -0.32), 'center', P.void);
    if (blink(1.4)) text(DD.T('PULSA O TOCA PARA EMPEZAR'), 192, 176, 2, P.bone, 'center', P.void);
    // §5.8: the escape screen reports it; the title is where the player looks for a target.
    var best = state && state.stats ? Math.floor(state.stats.bestTimeLeft || 0) : 0;
    if (best > 0) text(DD.T('MEJOR ESCAPE: {0}', fmt(best)), 192, 190, 1, P.verd, 'center', P.void);
    if (state && state.runIndex > 1) text(DD.T('CICLO {0}', state.runIndex), 192, 202, 1, P.ash, 'center', P.void);
    hitA = { x: 192, y: 140 }; bodyA = { x: 192, y: 156 };
  }
  function drawDead(state) {
    rect(0, 0, W, H, P.void);
    rect(0, 0, W, 22, shade(P.stone, -0.6));
    stoneWall(0, 22, W, 138, -0.1);
    arch(192, 160, 98, 132, shade(P.stone, 0.04), P.void, 6);
    rect(0, 160, W, H - 160, shade(P.stone, -0.5));
    rect(48, 126, 288, 14, shade(P.stone, 0.14));
    rect(48, 140, 288, 10, shade(P.stone, -0.24));
    rect(60, 150, 14, 30, shade(P.iron, -0.28)); rect(310, 150, 14, 30, shade(P.iron, -0.28));
    rect(176, 122, 40, 14, shade(P.bone, -0.16));
    rect(176, 120, 40, 3, shade(P.bone, 0.04));
    var g = clamp(0.3 + T * 0.1, 0, 1), i;
    for (i = 0; i < 6; i++) rect(150 - i * 9 * g, 140 + i * 2, 100 + i * 18 * g, 3, mixCol(P.blood, P.void, i * 0.13));
    for (i = 0; i < 8; i++) rect(90 + hash(i * 3.3) * 200, 150 + hash(i * 5.1) * 30, 2, 1, shade(P.blood, 0.15));
    glow(192, 118, 116, P.ember, 0.07 * (1 - clamp(T * 0.08, 0, 0.6)) * lamp(0));
    drawMotes(0.5);
    vignette(1.9);
    text(DD.T('HAS MUERTO'), 192, 40, 3, shade(P.blood, 0.38), 'center', P.void);
    if (state && state.message) text(state.message, 192, 76, 1, shade(P.bone, -0.15), 'center', P.void);
    text(DD.T('EL RELOJ ANATÓMICO TE VUELVE A MONTAR'), 192, 90, 1, shade(P.bone, -0.38), 'center', P.void);
    text(DD.T('CICLO {0}', (state && state.runIndex) || 1), 192, 106, 1, P.ash, 'center', P.void);
    if (blink(1.3)) text(DD.T('PULSA O TOCA PARA RENACER'), 192, 190, 2, P.bone, 'center', P.void);
    hitA = { x: 192, y: 130 }; bodyA = { x: 192, y: 130 };
  }
  function drawEscaped(state) {
    var st = (state && state.stats) || {}, bp = (state && state.blueprints) || [], i;
    for (i = 0; i < 30; i++) rect(0, i * 4, W, 4, mixCol(P.violet, P.ember, Math.pow(i / 29, 1.6) * 0.92));
    for (var x = 0; x < W; x += 8) rect(x, 118 + ((hash(x) * 6) | 0), 8, 10, shade(P.stone, -0.4));
    rect(0, 126, W, H - 126, mixCol(P.stoneDark, P.violet, 0.35));
    rect(284, 32, 68, 94, shade(P.stone, -0.4));
    rect(294, 14, 48, 20, shade(P.stone, -0.5));
    rect(310, 0, 16, 16, shade(P.stone, -0.56));
    for (i = 0; i < 5; i++) rect(292 + i * 13, 48 + (i % 2) * 22, 7, 10, P.ember);
    for (i = 0; i < 6; i++) { var f = flick(i * 1.3); rect(292 + i * 11, 8 - f * 8, 6, 12 + f * 10, shade(P.ember, i % 2 ? 0.22 : 0)); }
    glow(318, 40, 96, P.ember, 0.2 * lamp(0));
    rect(28, 118, 74, 62, shade(P.brass, -0.22));
    rect(37, 128, 56, 52, P.void);
    glow(65, 150, 60, shade(P.ember, 0.25), 0.12);
    // the escapee, walking away, rim-lit by the burning tower
    rect(190, 92, 18, 26, shade(P.void, 0.26));
    rect(194, 78, 11, 15, shade(P.void, 0.3));
    rect(184, 94, 5, 20, shade(P.void, 0.2)); rect(209, 94, 5, 20, shade(P.void, 0.2));
    rect(192, 118, 5, 15, shade(P.void, 0.16)); rect(203, 118, 5, 15, shade(P.void, 0.16));
    rect(214, 80, 2, 14, shade(P.ember, -0.15)); rect(191, 92, 1, 26, shade(P.ember, -0.3));
    rect(198, 82, 3, 3, P.ember);
    drawMotes(0.8);
    vignette(1.6);
    text(DD.T('HAS ESCAPADO'), 192, 24, 3, P.bone, 'center', P.void);
    text(DD.T('TIEMPO RESTANTE {0}', fmt(state && state.timeLeft)), 192, 56, 1, P.brass, 'center', P.void);
    text(DD.T('PLANOS ANATÓMICOS {0}', bp.length), 192, 68, 1, P.verd, 'center', P.void);
    text(DD.T('BAJAS {0} - CICLO {1}', [st.kills | 0, (state && state.runIndex) || 1]), 192, 80, 1, P.ash, 'center', P.void);
    // §5.8 wants the body that escaped named here: the toast that carried it is long gone.
    if (state && state.message) wrapText(state.message, 192, 148, 1, P.bone, 340);
    if (blink(1.4)) text(DD.T('PULSA O TOCA PARA UN NUEVO CICLO'), 192, 194, 2, P.bone, 'center', P.void);
    hitA = { x: 196, y: 108 }; bodyA = { x: 196, y: 108 };
  }

  // --------------------------------------------------------------------- API
  function spawnPending() {
    for (var i = 0; i < pending.length; i++) {
      var kind = pending[i];
      var a = (kind === 'hit' || kind === 'harvest') ? hitA : bodyA;
      emit(kind, a.x, a.y);
    }
    pending.length = 0;
  }

  function draw(state) {
    if (!ctx) return;
    var t = now(), dt = clamp(t - last, 0, 0.05);
    last = t; T += dt;
    LOW = state && typeof state.timeLeft === 'number' ? clamp((60 - state.timeLeft) / 60, 0, 1) : 0;

    shakeAmt *= Math.pow(0.86, dt * 60);
    if (shakeAmt < 0.08) shakeAmt = 0;
    sx = shakeAmt ? Math.round((hash(T * 91.3) * 2 - 1) * shakeAmt) : 0;
    sy = shakeAmt ? Math.round((hash(T * 57.7 + 3) * 2 - 1) * shakeAmt) : 0;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    rect(0, 0, W, H, P.void);
    updateMotes(dt);
    spawnPending();

    ctx.save();
    ctx.translate(sx, sy);
    var phase = state ? state.phase : null;
    if (phase === 'title') drawTitle(state);
    else if (phase === 'combat') drawCombat(state);
    else if (phase === 'harvest') { if (state.combat) drawCombat(state); else drawExplore(state); }
    else if (phase === 'dead') drawDead(state);
    else if (phase === 'escaped') drawEscaped(state);
    else drawExplore(state); // 'explore', 'slab' and anything unknown
    drawSparks(dt);
    ctx.restore();

    if (LOW > 0) fade(0, 0, W, H, P.ember, (0.07 + 0.17 * LOW) * (0.8 + 0.3 * flick(2)));
  }

  function init(canvas) {
    canvasEl = canvas || null;
    if (!canvasEl || typeof canvasEl.getContext !== 'function') { ctx = null; return; }
    ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    last = now();
    if (motes.length === 0) initMotes();
    resize();
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvasEl || !canvasEl.style) return;
    var host = canvasEl.parentElement, cw = 0, ch = 0;
    if (host && host.clientWidth && host.clientHeight) { cw = host.clientWidth; ch = host.clientHeight; }
    if (!cw || !ch) {
      cw = (typeof window !== 'undefined' ? window.innerWidth : W) || W;
      ch = (typeof window !== 'undefined' ? window.innerHeight : H) || H;
    }
    var s = Math.min(cw / W, ch / H);
    s = s >= 1 ? Math.floor(s) : Math.max(s, 0.2);
    canvasEl.style.width = Math.round(W * s) + 'px';
    canvasEl.style.height = Math.round(H * s) + 'px';
  }

  function shake(strength) { shakeAmt = Math.min(7, shakeAmt + (Number(strength) || 0)); }
  function spark(kind) { if (pending.length < 16) pending.push(kind); }

  DD.Render = { init: init, resize: resize, draw: draw, shake: shake, spark: spark };
})();
