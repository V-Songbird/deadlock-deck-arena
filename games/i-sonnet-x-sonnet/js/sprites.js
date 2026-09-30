/* Deadlock Deck: El Reloj Anatómico — sprites.js (W6)
 * Tiles 16x16 por tema, recursos, iconos 8x8 y fondos 640x360. Todo procedural:
 * init() pinta tiles, recursos, iconos y el fondo del título a canvases fuera de pantalla; el resto de
 * fondos se pintan la primera vez que se piden y quedan en caché. draw() solo copia.
 * chars.js extiende este mismo objeto DD.Sprites (jugador, enemigos, iconos de extremidad).
 */
(function () {
  'use strict';
  var DD = window.DD;
  var S = DD.Sprites = DD.Sprites || {};
  var C = DD.C;
  var OUT = C.bg;                       // contorno oscuro de los sprites sueltos

  /* ---------- Utilidades de color y dibujo ---------- */
  function rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function hex(r, g, b) {
    function q(v) { return Math.max(0, Math.min(255, Math.round(v))); }
    return '#' + ((1 << 24) | (q(r) << 16) | (q(g) << 8) | q(b)).toString(16).slice(1);
  }
  function mix(a, b, t) {
    var p = rgb(a), q = rgb(b);
    return hex(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
  }
  function lit(c, t) { return mix(c, '#ffffff', t); }
  function dk(c, t) { return mix(c, '#000000', t); }

  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function gx(c) { var g = c.getContext('2d'); g.imageSmoothingEnabled = false; return g; }
  function R(g, col, x, y, w, h) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  function P(g, col, x, y) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  function pic(g, rows, pal, x, y) {                 // mapa de caracteres; '.' = transparente
    for (var j = 0; j < rows.length; j++) {
      for (var i = 0; i < rows[j].length; i++) {
        var c = pal[rows[j].charAt(i)];
        if (c) P(g, c, x + i, y + j);
      }
    }
  }
  function line(g, col, x0, y0, x1, y1) {            // Bresenham
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) {
      P(g, col, x0, y0);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function speck(g, rnd, cols, n, x, y, w, h) {
    for (var i = 0; i < n; i++) P(g, cols[(rnd() * cols.length) | 0], x + ((rnd() * w) | 0), y + ((rnd() * h) | 0));
  }
  // Elipse rellena; fn(nx, ny, d) devuelve el color de cada píxel (o null) con nx,ny en [-1,1] y d = nx²+ny²
  function disc(g, cx, cy, rx, ry, fn) {
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        var nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
        if (d <= 1) { var c = fn(nx, ny, d); if (c) P(g, c, x, y); }
      }
    }
  }
  // Contorno oscuro de 1 px alrededor de lo pintado en un canvas pequeño de w×h
  function outline(g, w, h) {
    var im = g.getImageData(0, 0, w, h), d = im.data, a = new Uint8Array(w * h), i, j, o = rgb(OUT);
    for (i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    for (j = 0; j < h; j++) {
      for (i = 0; i < w; i++) {
        var k = j * w + i;
        if (a[k]) continue;
        if ((i > 0 && a[k - 1]) || (i < w - 1 && a[k + 1]) || (j > 0 && a[k - w]) || (j < h - 1 && a[k + w])) {
          d[k * 4] = o[0]; d[k * 4 + 1] = o[1]; d[k * 4 + 2] = o[2]; d[k * 4 + 3] = 255;
        }
      }
    }
    g.putImageData(im, 0, 0);
  }

  /* ---------- Paletas por tema ---------- */
  var BR = { hi: lit(C.brass, 0.45), mid: C.brass, lo: C.brassDk, dk: dk(C.brassDk, 0.55) };
  var TH = [
    { // 0 sótano de piedra azulada
      fl: '#242c3d', fl2: '#303b51', fl3: '#151a28', wl: '#3f4c66', wl2: '#5f7194', wl3: '#252e43', wlm: '#0f131e',
      acc: '#5a93b5', moss: '#2f5a4c'
    },
    { // 1 biblioteca de madera y ladrillo cálidos
      fl: '#53361f', fl2: '#70492a', fl3: '#2b1a0f', wl: '#5a3a22', wl2: '#94603a', wl3: '#2c1a0e', wlm: '#170d07',
      acc: C.acid, moss: '#2f5a26'
    },
    { // 2 observatorio de latón con luz roja
      fl: '#2a2530', fl2: '#3d3643', fl3: '#15111a', wl: '#5f4b27', wl2: '#9f8447', wl3: '#33260f', wlm: '#1a1208',
      acc: '#e0502a', moss: '#6a2117'
    }
  ];

  /* ---------- Suelos ---------- */
  function floor0(g, p, v) {
    var r = DD.mulberry32(11 + v * 7);
    R(g, p.fl, 0, 0, 16, 16);
    R(g, p.fl2, 1, 1, 15, 1); R(g, p.fl2, 1, 1, 1, 15);
    R(g, p.fl3, 0, 0, 16, 1); R(g, p.fl3, 0, 0, 1, 16);
    speck(g, r, [p.fl2, p.fl3, p.fl3], 9, 2, 2, 13, 13);
    if (v === 0) {
      line(g, p.fl3, 11, 12, 13, 13); P(g, p.fl3, 10, 12); P(g, p.fl2, 12, 11);
    } else {
      disc(g, 9.5, 10, 5, 3, function (nx, ny, d) { return d > 0.6 ? '#1a2638' : '#203650'; });
      P(g, p.acc, 7, 9); P(g, p.acc, 8, 9); P(g, '#8cc0dc', 11, 10); P(g, '#8cc0dc', 10, 11);
      P(g, p.moss, 2, 13); P(g, p.moss, 3, 13); P(g, p.moss, 2, 12); P(g, p.moss, 13, 3);
    }
  }
  function floor1(g, p, v) {
    var r = DD.mulberry32(23 + v * 5), i, y;
    var joints = v === 0 ? [3, 11, 7, 14] : [9, 2, 13, 5];
    R(g, p.fl, 0, 0, 16, 16);
    for (i = 0; i < 4; i++) {
      y = i * 4;
      R(g, p.fl2, 0, y + 1, 16, 1);
      R(g, p.fl3, 0, y, 16, 1);
      R(g, p.fl3, joints[i], y, 1, 4);
      P(g, C.brassDk, (joints[i] + 2) & 15, y + 2);
      speck(g, r, [p.fl2, p.fl3], 3, 0, y + 2, 16, 2);
      line(g, p.fl3, (joints[i] + 4) & 15, y + 2, ((joints[i] + 7) & 15), y + 2);
    }
    if (v === 1) {       // mancha de elixir que brilla
      R(g, '#2c4a1e', 5, 7, 5, 3); R(g, '#2c4a1e', 7, 6, 2, 5); R(g, '#2c4a1e', 4, 8, 1, 1);
      P(g, '#4f9a2c', 6, 8); P(g, '#4f9a2c', 8, 7); P(g, '#6fbf3a', 9, 9); P(g, '#9be05a', 7, 8);
      P(g, '#6fbf3a', 11, 11); P(g, '#4f9a2c', 3, 10); P(g, '#6fbf3a', 12, 5);
    }
  }
  function floor2(g, p, v) {
    var r = DD.mulberry32(37 + v), ox, oy;
    R(g, p.fl, 0, 0, 16, 16);
    for (oy = 0; oy < 16; oy += 8) {
      for (ox = 0; ox < 16; ox += 8) {
        R(g, p.moss, ox, oy, 8, 1); R(g, p.moss, ox, oy, 1, 8);                 // rendija con luz roja
        R(g, p.fl2, ox + 1, oy + 1, 7, 1); R(g, p.fl2, ox + 1, oy + 1, 1, 7);
        P(g, C.steel, ox + 2, oy + 2); P(g, p.fl3, ox + 6, oy + 6);             // remaches
        P(g, p.fl3, ox + 4, oy + 3); P(g, p.fl3, ox + 3, oy + 4);               // dibujo antideslizante
        P(g, p.fl3, ox + 5, oy + 4); P(g, p.fl3, ox + 4, oy + 5);
      }
    }
    speck(g, r, [p.fl2, p.fl3], 6, 1, 1, 14, 14);
    if (v === 1) {       // rejilla sobre el incendio
      R(g, '#0a0508', 9, 9, 7, 7);
      for (var k = 0; k < 4; k++) R(g, k % 2 ? '#ff7a2a' : '#b8321a', 9, 10 + k * 2 - (k ? 0 : 1), 7, 1);
      R(g, p.fl2, 8, 8, 8, 1); R(g, p.fl2, 8, 8, 1, 8);
    }
  }
  var FLOORS = [floor0, floor1, floor2];

  /* ---------- Muros ---------- */
  function wall0(g, p) {
    var r = DD.mulberry32(5), row, b, bx, y0, base;
    R(g, p.wlm, 0, 0, 16, 16);
    for (row = 0; row < 2; row++) {
      y0 = row * 8;
      for (b = 0; b < 3; b++) {
        bx = row ? -4 + b * 8 : b * 8;
        if (!row && b === 2) continue;
        base = mix(p.wl, r() < 0.5 ? p.wl2 : p.wl3, r() * 0.4);
        R(g, base, bx + 1, y0 + 1, 7, 7);
        R(g, lit(base, 0.22), bx + 1, y0 + 1, 7, 1);             // borde de luz
        R(g, dk(base, 0.3), bx + 1, y0 + 7, 7, 1);               // borde de sombra
        P(g, dk(base, 0.22), bx + 7, y0 + 3); P(g, lit(base, 0.12), bx + 3, y0 + 4);
      }
    }
    P(g, p.moss, 2, 7); P(g, p.moss, 3, 7); P(g, p.moss, 12, 15); P(g, p.moss, 11, 15);
  }
  var BOOKS = ['#8c2a2a', '#2f6b4a', '#b08a3a', '#2f4a7a', '#5a3a7a', '#a8562a', '#cdbf9f'];
  function shelfRow(g, r, y, h, gap) {
    var x = 1, w, hh, col;
    while (x < 15) {
      w = 2 + ((r() * 2) | 0); if (x + w > 15) w = 15 - x;
      if (gap && x >= gap[0] && x < gap[1]) { x++; continue; }
      hh = h - ((r() * 3) | 0);
      col = dk(BOOKS[(r() * BOOKS.length) | 0], 0.2);
      R(g, col, x, y + h - hh, w, hh);
      R(g, lit(col, 0.25), x, y + h - hh, 1, hh);
      if (w > 2) { P(g, C.brass, x + 1, y + h - hh + 1); P(g, C.brassDk, x + 1, y + h - hh + 3); }
      x += w;
    }
  }
  function wall1(g, p) {
    var r = DD.mulberry32(9);
    R(g, '#1a100a', 0, 0, 16, 16);
    shelfRow(g, r, 1, 6, null);
    shelfRow(g, r, 9, 6, [9, 13]);
    // matraz de brillo verde en el hueco de la balda baja
    R(g, '#3a7a2a', 10, 11, 3, 4); R(g, C.acid, 10, 12, 2, 3); P(g, '#e3ffb5', 10, 12); R(g, '#b7d8c8', 10, 10, 3, 1);
    R(g, p.wl, 0, 0, 16, 1); R(g, p.wl3, 0, 15, 16, 1);           // tablas superior e inferior
    R(g, p.wl2, 0, 7, 16, 1); R(g, dk(p.wl, 0.5), 0, 8, 16, 1);    // tabla intermedia
    P(g, C.brassDk, 1, 0); P(g, C.brassDk, 14, 0); P(g, C.brassDk, 1, 8); P(g, C.brassDk, 14, 8);
  }
  function wall2(g, p) {
    var x, k = mix(p.wl, p.wl3, 0.35);
    R(g, p.wl, 0, 0, 16, 16);
    for (x = 2; x < 15; x += 2) R(g, k, x, 1, 1, 14);                       // cepillado vertical
    R(g, p.wl2, 0, 0, 16, 1); R(g, p.wl2, 0, 0, 1, 16);                     // bisel de luz
    R(g, p.wl3, 0, 15, 16, 1); R(g, p.wl3, 15, 0, 1, 16);
    [[3, 3], [11, 3], [3, 11], [11, 11]].forEach(function (q) {              // remaches
      R(g, p.wl3, q[0], q[1] + 1, 2, 1); R(g, p.wl2, q[0], q[1], 2, 1); P(g, '#fff0c0', q[0], q[1]);
    });
    disc(g, 8, 8, 4.5, 4.5, function (nx, ny, d) {                             // relieve de engranaje
      if (d < 0.1) return p.wl3;
      if (d > 0.62) return nx + ny < 0 ? p.wl2 : p.wl3;
      return null;
    });
  }
  var WALLS = [wall0, wall1, wall2];

  /* ---------- Compuertas de latón ---------- */
  function hazard(g, y, a, b) {               // franja de peligro diagonal de 2 px de alto
    for (var x = 0; x < 16; x++) for (var j = 0; j < 2; j++) P(g, ((x + j) >> 1) & 1 ? a : b, x, y + j);
  }
  function gateFrame(g, inside, a, b) {
    R(g, inside, 0, 0, 16, 16);
    hazard(g, 0, a, b); hazard(g, 14, a, b);
    R(g, BR.hi, 0, 2, 1, 12); R(g, BR.mid, 1, 2, 1, 12);
    R(g, BR.mid, 14, 2, 1, 12); R(g, BR.lo, 15, 2, 1, 12);
  }
  function bars(g, y0, y1) {                   // barrotes verticales de latón
    [3, 7, 11].forEach(function (x) { R(g, BR.hi, x, y0, 1, y1 - y0); R(g, BR.mid, x + 1, y0, 1, y1 - y0); R(g, BR.dk, x + 2, y0, 1, y1 - y0); });
  }
  function gateClosed(g, p) {
    gateFrame(g, '#100c14', C.warn, '#2a2008');
    bars(g, 2, 14);
    R(g, BR.lo, 2, 5, 12, 1); R(g, BR.lo, 2, 10, 12, 1);
    R(g, BR.dk, 5, 5, 6, 6); R(g, BR.mid, 5, 5, 6, 1); R(g, BR.mid, 5, 5, 1, 6); R(g, BR.lo, 6, 10, 5, 1);
    R(g, C.blood, 7, 7, 2, 2); P(g, C.bloodHi, 7, 7);
  }
  function gateOpen(g, p, i, th) {
    FLOORS[th](g, p, 0);
    hazard(g, 0, C.warn, '#2a2008'); hazard(g, 14, C.warn, '#2a2008');
    R(g, BR.hi, 0, 2, 1, 12); R(g, BR.mid, 1, 2, 1, 12);
    R(g, BR.mid, 14, 2, 1, 12); R(g, BR.lo, 15, 2, 1, 12);
    bars(g, 2, 4);                              // barrotes recogidos arriba
    R(g, BR.dk, 2, 4, 12, 1);
    R(g, '#143a1c', 1, 7, 2, 2); R(g, C.integ, 1, 7, 1, 2);   // lámpara verde
  }
  function gateWarn(g, p, f) {
    var flash = f === 1;
    gateFrame(g, '#100c14', flash ? C.bloodHi : C.warn, flash ? '#3a0a0c' : '#2a2008');
    bars(g, 2, flash ? 11 : 8);                 // los barrotes suben y bajan
    R(g, BR.lo, 2, flash ? 11 : 8, 12, 1);
    R(g, flash ? '#ffe9c0' : C.warn, 6, 6, 4, 4);
    R(g, flash ? C.bloodHi : C.blood, 7, 7, 2, 2);
    if (flash) { P(g, '#ffffff', 7, 7); R(g, C.bloodHi, 0, 7, 1, 2); R(g, C.bloodHi, 15, 7, 1, 2); }
  }

  /* ---------- Escalera y salida ---------- */
  function stairs(g, p, f) {
    var i, y, c;
    R(g, p.wlm, 0, 0, 16, 16);
    R(g, p.wl3, 0, 0, 2, 16); R(g, p.wl3, 14, 0, 2, 16);
    R(g, p.wl2, 0, 0, 1, 16); R(g, p.wl, 15, 0, 1, 16);
    for (i = 0; i < 5; i++) {                   // peldaños: más claros cuanto más arriba
      y = 13 - i * 3;
      c = mix(p.wl, '#ffe2a8', 0.05 + i * 0.07);
      R(g, c, 2, y, 12, 2); R(g, lit(c, 0.3), 2, y, 12, 1); R(g, dk(c, 0.55), 2, y + 2, 12, 1);
    }
    R(g, '#ffd98a', 2, 0, 12, 1);              // luz del piso superior
    var cc = f ? lit(C.ether, 0.45) : C.ether, dy = f ? -1 : 0;
    [[5, 9], [9, 4]].forEach(function (q) {
      var yy = q[1] + dy;
      line(g, cc, 4, yy + 3, 7, yy); line(g, cc, 7, yy, 10, yy + 3);
      line(g, dk(cc, 0.45), 4, yy + 4, 7, yy + 1); line(g, dk(cc, 0.45), 7, yy + 1, 10, yy + 4);
    });
  }
  function archSpan(cx, w, r, dy) {             // arco apuntado: [izq, der] a dy píxeles sobre el arranque
    var c = r - w / 2, s2 = r * r - dy * dy;
    if (s2 < 0) return null;
    var s = Math.sqrt(s2), a = cx + c - s, b = cx - c + s;
    return a < b ? [a, b] : null;
  }
  function archFill(g, col, cx, w, r, yS, yTop, yBot) {
    if (yBot == null) { yBot = yTop; yTop = 0; }
    for (var y = yTop; y < yBot; y++) {
      var sp = y >= yS ? [cx - w / 2, cx + w / 2] : archSpan(cx, w, r, yS - y - 0.5);
      if (sp) { var x0 = Math.round(sp[0]), x1 = Math.round(sp[1]); R(g, typeof col === 'function' ? col(y) : col, x0, y, x1 - x0, 1); }
    }
  }
  function exitDoor(g, p, f) {
    archFill(g, p.wlm, 8, 15, 11, 10, 16);
    archFill(g, function (y) { return y < 5 ? BR.hi : BR.mid; }, 8, 14, 10.5, 10, 16);
    archFill(g, BR.lo, 8, 11.5, 8.4, 10, 16);
    var cols = f ? ['#fffbe6', '#ffeaa0', '#ffc860', '#ff9a2e'] : ['#ffeaa0', '#ffd15a', '#ffb040', '#ff8a28'];
    archFill(g, function (y) { return cols[Math.min(3, Math.floor((y + 1) / 4))]; }, 8, 9.6, 6.6, 10, 16);
    R(g, cols[0], 6, 7, 4, 7);                                             // núcleo brillante
    if (f) { [[4, 4], [11, 6], [6, 2], [9, 12], [4, 11]].forEach(function (q) { P(g, '#ffffff', q[0], q[1]); }); }
    else { [[5, 6], [10, 9], [7, 3]].forEach(function (q) { P(g, '#ffffff', q[0], q[1]); }); }
    R(g, BR.dk, 3, 15, 10, 1);
    P(g, BR.hi, 8, 0);
  }

  /* ---------- Fuego ---------- */
  var FLAME = ['#b3240f', C.fire1, C.fire2, C.fire3];
  function tongue(g, cx, base, h, w, layer) {
    var k = [1, 0.88, 0.64, 0.38][layer], ww = w * [1, 0.86, 0.62, 0.36][layer];
    for (var dx = -Math.ceil(ww); dx <= Math.ceil(ww); dx++) {
      var u = 1 - Math.pow(Math.abs(dx) / (ww + 0.7), 1.7), hh = Math.round(h * k * u);
      if (hh > 0) R(g, FLAME[layer], cx + dx, base - hh, 1, hh);
    }
  }
  var FIRE_T = [[3, 8, 2.3, 0], [7, 12, 3.2, 1.6], [11, 9, 2.7, 3.2], [13, 6, 1.6, 4.8], [5, 5, 1.6, 2.4]];
  function fire(g, p, f) {
    var r = DD.mulberry32(77), ph = f * Math.PI / 2, L;
    R(g, '#1a0c0c', 0, 0, 16, 16);
    speck(g, r, ['#3a1710', '#5a2412', '#2a1210'], 18, 0, 0, 16, 16);
    R(g, '#3a170f', 1, 9, 14, 6); R(g, '#5a2010', 2, 11, 12, 4); R(g, '#7a2a12', 4, 12, 8, 3);
    for (L = 0; L < 4; L++) {
      FIRE_T.forEach(function (t) {
        tongue(g, Math.round(t[0] + Math.sin(ph + t[3]) * 1.2), 15, Math.round(t[1] + Math.sin(ph + t[3] * 2) * 2.2), t[2], L);
      });
    }
    R(g, '#fff6c8', 6, 13, 4, 2);
    [[2, 3], [13, 2], [8, 0], [1, 7], [14, 8]].forEach(function (q, i) {          // chispas
      var o = (f + i) % 4;
      if (o < 3) P(g, o === 0 ? C.fire3 : C.fire2, q[0], q[1] - o);
    });
  }

  /* ---------- Trampas ---------- */
  function pyramid(g, x, y, blood) {           // pirámide de 6x6 vista desde arriba, luz arriba-izquierda
    var i, j, dx, dy, c, K = { T: '#f2f6fa', L: '#b0bdc9', R: '#6b7886', B: '#3c4654' };
    R(g, '#07060a', x + 1, y + 1, 6, 6);
    for (j = 0; j < 6; j++) {
      for (i = 0; i < 6; i++) {
        dx = i - 2.5; dy = j - 2.5;
        if (Math.abs(dx) + Math.abs(dy) > 3) continue;
        c = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? K.T : K.B) : (dx < 0 ? K.L : K.R);
        P(g, c, x + i, y + j);
      }
    }
    P(g, '#ffffff', x + 2, y + 2);
    if (blood) { P(g, C.blood, x + 3, y + 3); P(g, C.bloodHi, x + 3, y + 2); P(g, C.blood, x + 2, y + 3); }
  }
  function spikes(g, p, f, th) {
    FLOORS[th](g, p, 0);
    R(g, '#2b2f38', 0, 0, 16, 16);
    R(g, '#4a5462', 0, 0, 16, 1); R(g, '#4a5462', 0, 0, 1, 16);
    R(g, '#15181e', 0, 15, 16, 1); R(g, '#15181e', 15, 0, 1, 16);
    [[1, 1], [13, 1], [1, 13], [13, 13]].forEach(function (q) { P(g, C.warn, q[0], q[1]); P(g, C.warn, q[0] + 1, q[1] + 1); });
    [[1, 1], [8, 1], [1, 8], [8, 8]].forEach(function (q, i) {
      if (!f) {                                             // agujeros con un borde que brilla
        R(g, '#07060a', q[0] + 1, q[1] + 1, 5, 5);
        R(g, '#3a4250', q[0] + 1, q[1] + 1, 5, 1); R(g, '#3a4250', q[0] + 1, q[1] + 1, 1, 5);
        R(g, '#1c2028', q[0] + 2, q[1] + 2, 3, 3); P(g, '#8797a8', q[0] + 3, q[1] + 3);
      } else {
        pyramid(g, q[0], q[1], i === 1 || i === 2);
      }
    });
  }
  var BUBBLES = [[4, 5, 0], [11, 4, 1], [8, 10, 2], [3, 11, 1], [12, 11, 0]];
  function acid(g, p, f, th) {
    FLOORS[th](g, p, 0);
    R(g, '#22481a', 0, 1, 16, 14); R(g, '#22481a', 1, 0, 14, 16);
    R(g, '#3b7a24', 1, 2, 14, 12); R(g, '#3b7a24', 2, 1, 12, 14);
    R(g, '#4f9a2c', 2, 3, 12, 10); R(g, '#4f9a2c', 3, 2, 10, 12);
    R(g, '#6fbf3a', 4, 4, 8, 8);
    speck(g, DD.mulberry32(91), ['#8fdc4c', '#3b7a24'], 10, 2, 2, 12, 12);
    BUBBLES.forEach(function (b) {
      var s = (f + b[2]) % 3, x = b[0], y = b[1];
      if (s === 0) { P(g, '#c4f58a', x, y); }
      else if (s === 1) { R(g, '#c4f58a', x - 1, y - 1, 3, 3); P(g, '#4f9a2c', x, y); }
      else { P(g, '#eaffc0', x - 1, y - 1); P(g, '#eaffc0', x + 1, y - 1); P(g, '#eaffc0', x - 1, y + 1); P(g, '#eaffc0', x + 1, y + 1); P(g, '#c4f58a', x, y - 2); }
    });
    var w = f * 4;                                            // brillos que se desplazan
    R(g, '#b5ef6a', 3 + w % 9, 7, 2, 1); R(g, '#b5ef6a', 9 - (w % 7), 11, 2, 1);
    P(g, p.fl3, 0, 0); P(g, p.fl3, 15, 0); P(g, p.fl3, 0, 15); P(g, p.fl3, 15, 15);
  }
  function billow(g, cx, cy, r, hi, mid, lo, edge) {
    disc(g, cx, cy, r, r, function (nx, ny, d) {
      if (d > 0.8) return edge;
      var s = nx * -0.6 + ny * -0.8;
      return s > 0.25 ? hi : (s < -0.3 ? lo : mid);
    });
  }
  function steam(g, p, f, th) {
    FLOORS[th](g, p, 0);
    R(g, '#2b2f38', 1, 1, 14, 14); R(g, C.copper, 1, 1, 14, 1); R(g, C.copper, 1, 1, 1, 14);
    R(g, dk(C.copper, 0.5), 1, 14, 14, 1); R(g, dk(C.copper, 0.5), 14, 1, 1, 14);
    [[3, 3], [12, 3], [3, 12], [12, 12]].forEach(function (q) { P(g, C.brass, q[0], q[1]); });
    var slot = f === 0 ? '#07060a' : (f === 1 ? '#ff7a2a' : '#ffffff');
    for (var k = 0; k < 4; k++) R(g, slot, 4, 4 + k * 2, 8, 1);
    if (f === 0) { P(g, '#9fb0bc', 6, 2); P(g, '#7d8d99', 9, 1); P(g, '#7d8d99', 7, 0); }
    else if (f === 1) {
      R(g, '#ff9a2e', 4, 11, 8, 1);
      billow(g, 5, 4, 2.2, '#eef6fa', '#c5d5df', '#8ea3b3', '#6c8296');
      billow(g, 10, 3, 2.6, '#eef6fa', '#c5d5df', '#8ea3b3', '#6c8296');
      billow(g, 8, 1, 2, '#c5d5df', '#a9bccb', '#8ea3b3', '#6c8296');
    } else {
      billow(g, 4.5, 10, 4.5, '#f4fbff', '#d3e0e9', '#94a9b9', '#6c8296');
      billow(g, 11, 9, 4.8, '#f4fbff', '#d3e0e9', '#94a9b9', '#6c8296');
      billow(g, 8, 5.5, 5.2, '#ffffff', '#dfeaf1', '#a2b6c5', '#6c8296');
      billow(g, 4, 4, 3.2, '#f4fbff', '#d3e0e9', '#94a9b9', '#6c8296');
      billow(g, 12.5, 3.5, 3.2, '#f4fbff', '#d3e0e9', '#94a9b9', '#6c8296');
    }
  }

  /* ---------- Antorcha y mesa de salida ---------- */
  function torch(g, p, f, th) {
    WALLS[th](g, p);
    g.globalCompositeOperation = 'lighter';                          // calor sobre el muro
    disc(g, 8, 6, 8, 7, function (nx, ny, d) { return d > 0.5 ? '#160a02' : '#2c1505'; });
    g.globalCompositeOperation = 'source-over';
    R(g, '#0a0810', 6, 6, 4, 9); R(g, '#2a2233', 6, 6, 1, 9);
    R(g, BR.lo, 7, 10, 2, 5); P(g, BR.hi, 7, 10);
    R(g, BR.mid, 5, 8, 6, 2); R(g, BR.hi, 5, 8, 6, 1); R(g, BR.dk, 6, 10, 4, 1);
    var dx = [0, 1, -1][f], h = [7, 6, 8][f];
    [0, 1, 2, 3].forEach(function (L) { tongue(g, 8 + dx * (L > 1 ? 1 : 0), 8, h, 2.2, L); });
    P(g, C.fire3, 8 - dx, 8 - h - 1 + (f === 2 ? 1 : 0));
  }
  function start(g, p, f, th) {
    FLOORS[th](g, p, 0);
    disc(g, 8, 8, 8, 8, function (nx, ny, d) { return d > 0.62 ? '#10303f' : '#16485a'; });        // halo de éter bajo la mesa
    R(g, 'rgba(0,0,0,0.45)', 4, 3, 11, 13);
    R(g, '#3c4654', 3, 12, 10, 3);                                   // canto de la mesa
    R(g, '#5d6b79', 3, 12, 10, 1);
    R(g, '#56636f', 3, 1, 10, 11); R(g, '#9aa8b6', 4, 2, 8, 9);      // superficie
    R(g, '#b9c5d0', 4, 2, 8, 1); R(g, '#b9c5d0', 4, 2, 1, 9); R(g, '#7d8b99', 11, 3, 1, 8);
    R(g, '#6b7886', 7, 4, 2, 7);                                     // canal de desagüe
    R(g, C.blood, 7, 8, 2, 3); P(g, C.bloodHi, 7, 8); P(g, C.blood, 8, 11);
    R(g, '#d9cdb0', 5, 2, 6, 2); R(g, '#a89878', 5, 3, 6, 1);        // almohadilla
    R(g, '#6b4426', 2, 6, 12, 1); R(g, '#6b4426', 2, 9, 12, 1);       // correas abiertas
    P(g, C.brass, 3, 6); P(g, C.brass, 12, 9); P(g, '#3a2414', 2, 7); P(g, '#3a2414', 13, 10);
    R(g, BR.lo, 3, 15, 2, 1); R(g, BR.lo, 11, 15, 2, 1);
    P(g, C.ether, 1, 3); P(g, C.ether, 14, 6); P(g, C.ether, 1, 10); P(g, C.ether, 14, 12); P(g, '#ffffff', 1, 3);
  }

  /* ---------- Recursos (contorno oscuro; van sobre el suelo) ---------- */
  function vial(g) {
    R(g, '#7a4a26', 6, 1, 4, 2); R(g, '#b07a44', 6, 1, 4, 1);
    R(g, '#d8ecea', 5, 3, 6, 1);
    R(g, '#9ec4c4', 6, 4, 4, 3); R(g, '#e6f6f4', 6, 4, 1, 3);
    disc(g, 8, 10.6, 5.2, 4.6, function (nx, ny, d) {
      if (ny < -0.2) return d > 0.62 ? '#b5d4d2' : '#6f8f96';
      if (d > 0.72) return '#7a1420';
      return nx + ny < -0.3 ? C.bloodHi : (nx + ny > 0.45 ? '#7a1420' : C.blood);
    });
    R(g, '#f3fffd', 5, 8, 1, 3); P(g, '#ffd9d6', 6, 11);
    R(g, '#e86a66', 7, 8, 4, 1);
  }
  function coolant(g) {
    R(g, C.brass, 6, 1, 4, 2); R(g, BR.hi, 6, 1, 4, 1); P(g, C.copper, 10, 2); P(g, C.copper, 11, 2);
    R(g, '#5d6b79', 4, 3, 8, 12); R(g, '#aebccb', 4, 3, 2, 12); R(g, '#3c4654', 10, 3, 2, 12);
    R(g, '#2a3340', 4, 5, 8, 1); R(g, '#2a3340', 4, 12, 8, 1);
    R(g, '#0f2c4a', 6, 7, 4, 4); R(g, '#2f9ae0', 6, 8, 4, 3); R(g, '#9ee3ff', 6, 8, 1, 3); R(g, '#7fd6f6', 6, 7, 4, 1);
    P(g, '#ffffff', 8, 9); P(g, '#ffffff', 7, 8); P(g, '#ffffff', 9, 10);
    P(g, C.brass, 5, 4); P(g, C.brass, 10, 13);
  }
  function suture(g) {
    var i;
    disc(g, 7, 12, 5.6, 2.2, function (nx, ny) { return ny < 0 ? BR.mid : BR.lo; });         // pestaña inferior
    R(g, '#f3ead0', 3, 4, 3, 8); R(g, '#d9cdb0', 6, 4, 3, 8); R(g, '#a89878', 9, 4, 2, 8);     // hilo
    for (i = 5; i < 12; i += 2) R(g, '#8a7a5a', 3, i, 8, 1);
    R(g, '#b02a3a', 3, 8, 8, 1);
    disc(g, 7, 4, 5.6, 2.2, function (nx, ny) { return ny < 0 ? BR.hi : BR.mid; });          // pestaña superior
    P(g, '#fff0c0', 4, 3);
    line(g, '#8797a8', 10, 10, 14, 4); line(g, '#dde6ee', 11, 10, 15, 4); P(g, '#ffffff', 15, 3);
    line(g, '#d9cdb0', 11, 11, 12, 13); line(g, '#d9cdb0', 12, 13, 14, 13);
  }
  function etherGem(g) {
    var pal = { W: '#ffffff', c: '#b7f0f8', m: C.ether, d: '#3f9bb6', D: '#27677e' };
    pic(g, [
      '.......WW.......',
      '......WccW......',
      '.....WcccmW.....',
      '....cccmmmdd....',
      '...cccmmmmmdD...',
      '..cccmmmmmmddD..',
      '..ccmmmmmmmddD..',
      '..cmmmmmmmmddD..',
      '...cmmmmmmmdD...',
      '....mmmmmmdD....',
      '.....mmmmddD....',
      '......mmddD.....',
      '.......ddD......',
      '........D.......'
    ], pal, 0, 1);
    P(g, '#ffffff', 5, 5); P(g, '#ffffff', 5, 6); P(g, '#ffffff', 6, 5);
  }
  function etherPost(g) {                      // destello en cruz tras el contorno
    P(g, '#ffffff', 13, 2); P(g, C.ether, 13, 1); P(g, C.ether, 13, 3); P(g, C.ether, 12, 2); P(g, C.ether, 14, 2);
    P(g, C.ether, 2, 12); P(g, '#ffffff', 2, 13);
  }
  function jar(g, p, f) {
    // tapa y base de latón
    R(g, BR.dk, 3, 1, 10, 3); R(g, BR.hi, 3, 1, 10, 1); R(g, BR.mid, 3, 2, 10, 1);
    R(g, BR.dk, 3, 13, 10, 2); R(g, BR.mid, 3, 13, 10, 1);
    // vidrio y líquido
    R(g, '#2f6a4a', 4, 4, 8, 9); R(g, '#3f8a5c', 5, 4, 6, 9); R(g, '#5fae6a', 5, 4, 2, 9);
    R(g, '#2a5a3e', 10, 4, 2, 9);
    R(g, '#b9ffd0', 4, 4, 1, 9);
    // extremidad en el líquido: mano de dedos y antebrazo
    var dy = f ? 1 : 0;
    R(g, '#d9b89a', 7, 8 + dy, 3, 4); R(g, '#b89278', 9, 9 + dy, 1, 3);
    R(g, '#d9b89a', 6, 6 + dy, 1, 3); R(g, '#d9b89a', 7, 5 + dy, 1, 3); R(g, '#d9b89a', 8, 5 + dy, 1, 3); R(g, '#c8a284', 9, 6 + dy, 1, 3);
    P(g, '#8a2a30', 8, 12); P(g, '#8a2a30', 9, 12);
    // burbujas
    P(g, '#d6ffe2', f ? 10 : 11, f ? 6 : 9); P(g, '#d6ffe2', f ? 5 : 6, f ? 10 : 5); P(g, '#d6ffe2', 11, f ? 11 : 7);
    P(g, '#ffffff', 4, 5);
  }

  /* ---------- Iconos 8x8 ---------- */
  var IP = {
    W: '#e6eef5', s: '#8797a8', d: '#46525f', b: C.brass, B: C.brassDk, r: C.blood, R: C.bloodHi, o: C.heat,
    y: C.heatHi, Y: C.warn, g: C.integ, G: '#2f7a3a', c: C.ether, C: '#3f8fa6', p: '#b085e0', P: '#6a449a',
    k: OUT, w: C.bone, x: C.dim, n: '#7a4a26', i: C.ink
  };
  var ICONS = [
    ['i_attack', [
      '......WW', '.....WWs', '....WWs.', '...WWs..', '.bWWs...', '.bbs....', '.nbb....', 'n.......']],
    ['i_block', [
      '.bbbbbb.', 'bWWsssdb', 'bWsssddb', 'bWsssddb', '.bsssdb.', '.bsssdb.', '..bsdb..', '...bb...']],
    ['i_buff', [
      '...yy...', '..yyyy..', '.yyyyyy.', 'yyyyyyyy', '..yoo...', '..yoo...', '..yoo...', '..oo....']],
    ['i_debuff', [
      '...pp...', '...pp...', '...pp...', '...pP...', 'pp.pP.pP', '.pppppP.', '..pppP..', '...pP...']],
    ['i_limb', [
      'ww......', 'wwwx....', '.xwwx...', '..xwrx..', '...xrwx.', '....xwwx', '.....xww', '......ww']],
    ['i_heat', [
      '..dddd..', '..dWsd.x', '..dWRd..', '..dWRd.x', '..dWRd..', '.dWRRRd.', '.dRRRRd.', '..dddd..']],
    ['i_heal', [
      '...gg...', '...gg...', '...gG...', 'gggggggG', 'gggggggG', '...gG...', '...gG...', '...GG...']],
    ['i_burn', [
      '...o....', '...oo...', '..ooo.o.', '..ooyoo.', '.ooyyyo.', '.oyyyyoo', '.oyyyyo.', '..oooo..']],
    ['i_vuln', [
      '..RRRR..', '.RwwwwR.', 'RwRRRRwR', 'RwRwwRwR', 'RwRwwRwR', 'RwRRRRwR', '.RwwwwR.', '..RRRR..']],
    ['i_weak', [
      '.....ss.', '....ss..', '........', '...sd...', '.bssd...', '.bbd....', '.nbb....', 'n.......']],
    ['i_stun', [
      '...Y....', '..YWY..Y', '.YYWYY.Y', '..YWY...', '...Y..Y.', '.Y...YWY', 'YWY...Y.', '.Y......']],
    ['i_energy', [
      '....Yy..', '...Yy...', '..Yy....', '.YYYYy..', '...Yy...', '..Yy....', '.Yy.....', '.y......']],
    ['i_hp', [
      '.RR..RR.', 'RWRRRRRr', 'RRRRRRRr', 'RRRRRRrr', '.RRRRrr.', '..RRrr..', '...rr...', '........']],
    ['i_clock', [
      '..bbbb..', '.bwwkwb.', 'bwwwkwwb', 'bwwwkkwb', 'bwwwwwwb', 'bwwwwwwb', '.bwwwwb.', '..bbbb..']],
    ['i_ether', [
      '...WC...', '..WcCC..', '.WcccCC.', '.cccCCC.', '.cccCCC.', '..ccCC..', '...CC...', '........']],
    ['i_skull', [
      '.wwwwww.', 'wwwwwwww', 'wkkwwkkw', 'wkkwwkkw', 'wwwkkwww', '.wwwwww.', '.wkwkwk.', '..xxxx..']],
    ['i_sound', [
      '....w...', '...ww.c.', 'wwwww..c', 'wwwww..c', 'wwwww..c', '...ww.c.', '....w...', '........']],
    ['i_mute', [
      '....w...', '...ww...', 'wwwwwR.R', 'wwwww.R.', 'wwwwwR.R', '...ww...', '....w...', '........']],
    ['i_pause', [
      '........', '.ww..ww.', '.iw..iw.', '.iw..iw.', '.iw..iw.', '.iw..iw.', '.ii..ii.', '........']]
  ];

  /* ---------- Hojas de sprites ---------- */
  // defs: [{k, n (fotogramas), f(g, pal, i, th) pinta el fotograma i, o (contorno), post}]
  // Cada fotograma es su propio canvas: drawImage de 3 argumentos es lo más barato para pintar un mapa entero.
  function sheet(defs, cw, ch, pal, th) {
    var map = Object.create(null);
    defs.forEach(function (d) {
      var n = d.n || 1, frames = [], i, c, g;
      for (i = 0; i < n; i++) {
        c = cv(cw, ch);
        g = c.getContext('2d', { willReadFrequently: !!d.o });
        g.imageSmoothingEnabled = false;
        d.f(g, pal, i, th);
        if (d.o) outline(g, cw, ch);
        if (d.post) d.post(g, pal, i);
        frames.push(c);
      }
      map[d.k] = { f: frames, w: cw, n: n };
    });
    return map;
  }

  var TILE_DEFS = [
    { k: 'floor', f: function (g, p, i, th) { FLOORS[th](g, p, 0); } },
    { k: 'floorB', f: function (g, p, i, th) { FLOORS[th](g, p, 1); } },
    { k: 'wall', f: function (g, p, i, th) { WALLS[th](g, p); } },
    { k: 'gateClosed', f: gateClosed },
    { k: 'gateOpen', f: gateOpen },
    { k: 'gateWarn', n: 2, f: gateWarn },
    { k: 'stairs', n: 2, f: stairs },
    { k: 'exit', n: 2, f: exitDoor },
    { k: 'fire', n: 4, f: fire },
    { k: 'spikes', n: 2, f: spikes },
    { k: 'acid', n: 3, f: acid },
    { k: 'steam', n: 3, f: steam },
    { k: 'torch', n: 3, f: torch },
    { k: 'start', f: start }
  ];
  var RES_DEFS = [
    { k: 'vial', f: vial, o: true },
    { k: 'coolant', f: coolant, o: true },
    { k: 'suture', f: suture, o: true },
    { k: 'ether', f: etherGem, o: true, post: etherPost },
    { k: 'jar', n: 2, f: jar, o: true }
  ];
  var ICON_DEFS = ICONS.map(function (d) {
    return { k: d[0], f: function (g) { pic(g, d[1], IP, 0, 0); } };
  });

  /* ---------- API ---------- */
  var ready = false, theme = 0, maps = [], cur = null;

  S.init = function () {
    if (ready) return;
    var common = sheet(RES_DEFS, 16, 16, null, 0), icons = sheet(ICON_DEFS, 8, 8, null, 0), k, t;
    for (k in icons) common[k] = icons[k];
    for (t = 0; t < TH.length; t++) {
      var m = sheet(TILE_DEFS, 16, 16, TH[t], t);
      for (k in common) m[k] = common[k];
      maps.push(m);
    }
    ready = true;
    cur = maps[theme];
    ensure('title');
  };
  S.setTheme = function (i) {
    i = i | 0;
    theme = i >= 0 && i < TH.length ? i : 0;
    if (ready) cur = maps[theme];
  };
  S.frames = function (key) {
    var e = ready && cur[key];
    return e ? e.n : 1;
  };
  function missing(ctx, x, y) {
    var a = ctx.globalAlpha;
    ctx.globalAlpha = a * 0.5;
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, 15, 15);
    ctx.globalAlpha = a;
  }
  S.draw = function (ctx, key, x, y, opt) {
    if (!ready) S.init();
    var e = cur[key];
    if (!e) { missing(ctx, x, y); return; }
    var f = 0, a = 1, flip = false, ga = ctx.globalAlpha;
    if (opt) {
      f = opt.frame | 0; flip = !!opt.flip;
      if (opt.alpha != null) a = opt.alpha;
    }
    if (f < 0 || f >= e.n) f = ((f % e.n) + e.n) % e.n;
    x = Math.round(x); y = Math.round(y);
    if (a !== 1) ctx.globalAlpha = ga * a;
    if (flip) {
      ctx.save(); ctx.translate(x + e.w, y); ctx.scale(-1, 1);
      ctx.drawImage(e.f[f], 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(e.f[f], x, y);
    }
    if (a !== 1) ctx.globalAlpha = ga;
  };

  /* ============ Fondos 640x360 ============
   * Cada fondo = capa estática precalculada en un canvas + una función `live(g, t)` barata
   * (llamas, chispas, engranajes que giran, parpadeos) que dibuja encima cada fotograma.
   */
  var BD = Object.create(null);          // clave -> {img, live}
  var BDC = [];                          // fondo de combate por tema
  var BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bay(x, y) { return (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16; }
  function pk(col, a) { var c = rgb(col); return (((a == null ? 255 : a) << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  // Pinta w×h píxeles con fn(i, j) -> entero ABGR (0 = transparente); no lee el canvas
  function px32(g, x, y, w, h, fn) {
    var im = g.createImageData(w, h), d = new Uint32Array(im.data.buffer), i, j;
    for (j = 0; j < h; j++) for (i = 0; i < w; i++) d[j * w + i] = fn(i, j);
    g.putImageData(im, x, y);
  }
  function lutStops(stops, n) {
    var lut = [], k, t, i, a, b, u;
    for (k = 0; k < n; k++) {
      t = k / (n - 1);
      for (i = 1; i < stops.length - 1 && t > stops[i][0]; i++) { /* busca el tramo */ }
      a = stops[i - 1]; b = stops[i];
      u = b[0] === a[0] ? 0 : DD.clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
      lut.push(pk(mix(a[1], b[1], u)));
    }
    return lut;
  }
  // Degradado vertical con tramado ordenado entre n niveles de color
  function vgrad(g, x, y, w, h, stops, n) {
    var lut = lutStops(stops, n || 28), top = lut.length - 1;
    px32(g, x, y, w, h, function (i, j) {
      var v = j / (h - 1) * top, k = Math.floor(v);
      return k >= top ? lut[top] : (v - k > bay(i + x, j + y) ? lut[k + 1] : lut[k]);
    });
  }
  // Halo elíptico con alpha escalonado y tramado; se compone con 'lighter' (luz) o normal (sombra)
  function glowCv(rx, ry, col, amax, pw) {
    var w = rx * 2 + 1, h = ry * 2 + 1, c = cv(w, h), rc = rgb(col);
    px32(gx(c), 0, 0, w, h, function (i, j) {
      var nx = (i - rx) / (rx + 0.5), ny = (j - ry) / (ry + 0.5), d = Math.sqrt(nx * nx + ny * ny);
      if (d >= 1) return 0;
      var a = Math.floor(Math.pow(1 - d, pw) * 7 + bay(i, j)) / 7 * amax;
      return a <= 0 ? 0 : ((Math.round(a * 255) << 24) | (rc[2] << 16) | (rc[1] << 8) | rc[0]) >>> 0;
    });
    return c;
  }
  function blit(g, c, cx, cy, op, alpha) {
    g.save();
    if (op) g.globalCompositeOperation = op;
    g.globalAlpha = alpha == null ? 1 : alpha;
    g.drawImage(c, Math.round(cx - c.width / 2), Math.round(cy - c.height / 2));
    g.restore();
  }
  // Oscurece los bordes (viñeta con tramado); el canvas se calcula una vez y se reutiliza
  var VIG = null;
  function vignette(g, strength) {
    if (!VIG) {
      VIG = cv(640, 360);
      px32(gx(VIG), 0, 0, 640, 360, function (i, j) {
        var nx = (i - 320) / 330, ny = (j - 180) / 200, d = Math.sqrt(nx * nx * 0.8 + ny * ny * 1.1);
        var a = DD.clamp((d - 0.55) / 0.75, 0, 1);
        a = Math.floor(a * a * 9 + bay(i, j)) / 9;
        return a <= 0 ? 0 : ((Math.round(Math.min(1, a) * 255) << 24) | (10 << 16) | (3 << 8) | 5) >>> 0;
      });
    }
    g.save(); g.globalAlpha = strength; g.drawImage(VIG, 0, 0); g.restore();
  }
  // Atenúa el centro (zona de interfaz) para que el texto se lea
  function veil(g, cx, cy, rx, ry, col, a) { g.drawImage(glowCv(rx, ry, col, a, 0.55), Math.round(cx - rx), Math.round(cy - ry)); }

  // Engranaje rasterizado en n ángulos que cubren un periodo de simetría (giro "a saltos", sin suavizar)
  function gearSet(Rr, teeth, spokes, n, pal) {
    var size = Rr * 2 + 2, period = 2 * Math.PI / gcd(teeth, spokes), frames = [], k;
    var depth = Math.max(2, Math.round(Rr * 0.13)), hub = Math.max(3, Rr * 0.24), ri = Rr - depth - Math.max(2, Rr * 0.16);
    var pit = 2 * Math.PI / teeth, spit = 2 * Math.PI / spokes, sw = Math.max(1.3, Rr * 0.08);
    var cb = pk(pal.base), ch = pk(pal.hi), cl = pk(pal.lo), ce = pk(pal.edge);
    function one(rot) {
      var c = cv(size, size);
      px32(gx(c), 0, 0, size, size, function (i, j) {
        var dx = i + 0.5 - size / 2, dy = j + 0.5 - size / 2, d = Math.sqrt(dx * dx + dy * dy);
        if (d > Rr) return 0;
        var a = Math.atan2(dy, dx) - rot, ph = ((a / pit) % 1 + 1) % 1, rr = (ph > 0.1 && ph < 0.62) ? Rr : Rr - depth;
        if (d > rr || d < hub * 0.45) return 0;
        if (d > hub && d < ri) {
          var sp = ((a / spit) % 1 + 1) % 1;
          if (Math.abs(sp - 0.5) * spit * d > sw) return 0;
        }
        if (d > rr - 1.1 || (d > hub - 1.1 && d <= hub) || (d < hub * 0.45 + 1.2)) return ce;
        var s = -(dx + dy) / (d * 1.4142 + 0.001);
        return s > 0.35 ? ch : (s < -0.35 ? cl : cb);
      });
      return c;
    }
    for (k = 0; k < n; k++) frames.push(one(period * k / n));
    return { f: frames, period: period, size: size };
  }
  function drawGear(g, set, cx, cy, ang, alpha) {
    var n = set.f.length, i = Math.floor((((ang % set.period) + set.period) % set.period) / set.period * n) % n;
    if (alpha != null && alpha !== 1) { g.save(); g.globalAlpha = alpha; }
    g.drawImage(set.f[i], Math.round(cx - set.size / 2), Math.round(cy - set.size / 2));
    if (alpha != null && alpha !== 1) g.restore();
  }

  // Ángulo de un engranaje de n2 dientes que encaja con otro de n1 (en rot 0) cuyo centro queda en (dx, dy)
  function meshRot(n1, n2, dx, dy) {
    var th = Math.atan2(dy, dx), p1 = th / (2 * Math.PI / n1);
    p1 -= Math.floor(p1);
    return th + Math.PI - (2 * Math.PI / n2) * (0.22 - p1);
  }
  // Columnas de llamas (live): 4 capas anidadas, altura por ruido senoidal
  function flameRow(g, x0, x1, base, hmax, t, seed) {
    var x, u, env, n, h, L, hh;
    for (x = x0; x < x1; x++) {
      u = (x - x0) / (x1 - x0);
      env = Math.pow(Math.sin(u * Math.PI), 0.5);
      n = (Math.sin(x * 0.33 + t * 7.3 + seed) + Math.sin(x * 0.81 - t * 10.7 + seed * 2) * 0.6 + Math.sin(x * 0.17 + t * 3.1 + seed * 3) * 0.5) / 2.1;
      h = hmax * env * (0.42 + 0.58 * (n * 0.5 + 0.5));
      for (L = 0; L < 4; L++) {
        hh = Math.round(h * [1, 0.8, 0.56, 0.3][L]);
        if (hh > 0) { g.fillStyle = FLAME[L]; g.fillRect(x, base - hh, 1, hh); }
      }
    }
  }
  // Chispas/ascuas deterministas: posición = f(i, t). o:{x0,x1,y,n,rise,life,drift,sway,seed}
  function embers(g, t, o) {
    var i, r1, r2, r3, life, age, x, y, big;
    for (i = 0; i < o.n; i++) {
      r1 = hash(i * 3 + 1 + (o.seed || 0)); r2 = hash(i * 3 + 2 + (o.seed || 0)); r3 = hash(i * 3 + 3 + (o.seed || 0));
      life = o.life * (0.6 + 0.8 * r1);
      age = ((t / life + r2) % 1);
      x = o.x0 + r3 * (o.x1 - o.x0) + o.drift * age * life + Math.sin(age * 7 + r1 * 9) * o.sway;
      y = o.y - o.rise * age * life * (0.7 + 0.6 * r3);
      big = r1 > 0.72 && age < 0.55;
      g.fillStyle = age < 0.22 ? C.fire3 : (age < 0.55 ? C.fire2 : (age < 0.82 ? C.fire1 : '#7a2418'));
      g.fillRect(Math.round(x), Math.round(y), big ? 2 : 1, big ? 2 : 1);
    }
  }
  function line2(g, col, x0, y0, x1, y1) { line(g, col, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)); }

  function brickFill(g, x, y, w, h, bw, bh, base, vari, mortar, rnd) {
    var row = 0, yy, xx, off, bx, bx2, by2;
    R(g, mortar, x, y, w, h);
    for (yy = y; yy < y + h; yy += bh, row++) {
      off = row % 2 ? bw >> 1 : 0;
      for (xx = x - off; xx < x + w; xx += bw) {
        bx = Math.max(xx + 1, x); bx2 = Math.min(xx + bw, x + w); by2 = Math.min(yy + bh, y + h);
        if (bx2 > bx && by2 > yy + 1) R(g, mix(base, vari, rnd() * 0.7), bx, yy + 1, bx2 - bx, by2 - yy - 1);
      }
    }
  }
  function cloud(g, x, y, w, h, seed, dark, rim) {
    var rnd = DD.mulberry32(seed), discs = [], n = 5 + ((w / 26) | 0), i, c = cv(w, h);
    for (i = 0; i < n; i++) { var r = h * (0.2 + rnd() * 0.26); discs.push([r * 1.9 + rnd() * (w - 3.8 * r), h - r - rnd() * h * 0.3, r]); }
    function inside(px, py) {                        // elipses achatadas: nubes alargadas
      for (var k = 0; k < discs.length; k++) { var dx = (px - discs[k][0]) / 1.9, dy = py - discs[k][1]; if (dx * dx + dy * dy < discs[k][2] * discs[k][2]) return true; }
      return false;
    }
    var cd = pk(dark, 235), cr = pk(rim, 235), cm = pk(mix(dark, rim, 0.5), 235);
    px32(gx(c), 0, 0, w, h, function (i2, j) {
      if (!inside(i2, j)) return 0;
      if (!inside(i2, j + 3)) return cr;
      return !inside(i2, j + 7) && bay(i2, j) > 0.5 ? cm : cd;
    });
    g.drawImage(c, x, y);
  }
  function stars(g, rnd, n, y0, y1, cols) {
    for (var i = 0; i < n; i++) P(g, cols[(rnd() * cols.length) | 0], (rnd() * 640) | 0, y0 + ((rnd() * (y1 - y0)) | 0));
  }
  // Siluetas de edificios góticos a lo largo de la pantalla
  function skyline(g, rnd, baseY, col, hmin, hmax, lights) {
    var x = -4, w, h, roof, i;
    while (x < 644) {
      w = 14 + ((rnd() * 22) | 0); h = hmin + ((rnd() * (hmax - hmin)) | 0); roof = rnd();
      R(g, col, x, baseY - h, w, h + 40);
      if (roof < 0.5) { for (i = 0; i < w / 2; i++) R(g, col, x + i, baseY - h - ((i * 1.6) | 0), w - 2 * i, 1 + ((i * 1.6) | 0) - (i ? (((i - 1) * 1.6) | 0) : 0)); }
      else if (roof < 0.75) { R(g, col, x + (w >> 1) - 1, baseY - h - 12, 3, 12); P(g, col, x + (w >> 1), baseY - h - 13); }
      else { R(g, col, x + 2, baseY - h - 5, 3, 5); R(g, col, x + w - 6, baseY - h - 3, 3, 3); }
      if (lights) { for (i = 0; i < 3; i++) if (rnd() < lights[1]) P(g, lights[0], x + 3 + ((rnd() * (w - 6)) | 0), baseY - h + 5 + ((rnd() * (h - 8)) | 0)); }
      x += w - 2;
    }
  }

  // Polígono relleno por líneas de barrido
  function poly(g, col, pts) {
    var y0 = 1e9, y1 = -1e9, i, y, xs, a, b, t;
    for (i = 0; i < pts.length; i++) { y0 = Math.min(y0, pts[i][1]); y1 = Math.max(y1, pts[i][1]); }
    g.fillStyle = col;
    for (y = Math.ceil(y0); y < y1; y++) {
      xs = [];
      for (i = 0; i < pts.length; i++) {
        a = pts[i]; b = pts[(i + 1) % pts.length];
        if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5)) {
          t = (y + 0.5 - a[1]) / (b[1] - a[1]); xs.push(a[0] + (b[0] - a[0]) * t);
        }
      }
      xs.sort(function (p, q) { return p - q; });
      for (i = 0; i + 1 < xs.length; i += 2) g.fillRect(Math.round(xs[i]), y, Math.round(xs[i + 1]) - Math.round(xs[i]), 1);
    }
  }
  // Haz de luz (trapecio con caída suave y tramado); skew desplaza la base
  function coneCv(w, h, topW, botW, skew, col, amax) {
    var c = cv(w, h), rc = rgb(col);
    px32(gx(c), 0, 0, w, h, function (i, j) {
      var v = j / h, half = (topW + (botW - topW) * v) / 2, cx = w / 2 + skew * v, u = Math.abs(i + 0.5 - cx) / half;
      if (u >= 1) return 0;
      var a = Math.floor(Math.pow(1 - u, 1.3) * (1 - v * 0.55) * 7 + bay(i, j)) / 7 * amax;
      return a <= 0 ? 0 : ((Math.round(a * 255) << 24) | (rc[2] << 16) | (rc[1] << 8) | rc[0]) >>> 0;
    });
    return c;
  }
  function chain(g, x, y0, y1, col) {
    for (var y = y0, k = 0; y < y1; y += 3, k++) { if (k % 2) R(g, col, x - 1, y, 3, 2); else R(g, col, x, y, 1, 3); }
  }
  function pillar(g, x, y, w, h, base) {       // columna con volumen
    var k, cols = [dk(base, 0.35), base, lit(base, 0.18), base, dk(base, 0.3)];
    for (k = 0; k < w; k++) R(g, cols[Math.min(4, Math.floor(k / w * 5))], x + k, y, 1, h);
  }
  // Frasco de cristal con líquido y algo dentro (kind 0 cerebro, 1 ojo, 2 mano, 3 corazón, 4 hueso)
  function jarDraw(g, x, yb, w, h, liquid, kind) {
    var y = yb - h, cx = x + (w >> 1), cy = y + 3 + ((h - 6) >> 1);
    R(g, BR.dk, x, y, w, 3); R(g, BR.mid, x + 1, y, w - 2, 1);
    R(g, '#0a0c10', x - 1, y + 3, w + 2, h - 3);
    R(g, dk(liquid, 0.45), x, y + 3, w, h - 5); R(g, liquid, x + 1, y + 5, w - 2, h - 8);
    R(g, lit(liquid, 0.55), x + 1, y + 4, 1, h - 7);
    R(g, dk(liquid, 0.3), x + w - 2, y + 4, 1, h - 7);
    if (kind === 0) { disc(g, cx, cy, 4.5, 3.5, function (nx, ny) { return ny < 0 ? '#e0a0a8' : '#b8707a'; }); P(g, '#8a4a52', cx - 1, cy); P(g, '#8a4a52', cx + 1, cy - 1); }
    else if (kind === 1) { disc(g, cx, cy, 3.6, 3.6, function (nx, ny, d) { return d < 0.25 ? '#2a1a10' : (d < 0.5 ? '#3f9a5c' : '#e8e0d0'); }); P(g, '#ffffff', cx - 1, cy - 1); }
    else if (kind === 2) { R(g, '#d9b89a', cx - 2, cy - 1, 4, 5); R(g, '#d9b89a', cx - 3, cy - 3, 1, 3); R(g, '#d9b89a', cx - 1, cy - 4, 1, 3); R(g, '#d9b89a', cx + 1, cy - 4, 1, 3); R(g, '#b89278', cx + 2, cy - 2, 1, 4); }
    else if (kind === 3) { disc(g, cx, cy, 3.5, 3.5, function (nx, ny) { return nx + ny < -0.2 ? C.bloodHi : C.blood; }); R(g, '#7a1420', cx - 1, cy - 4, 2, 2); }
    else { line(g, C.bone, cx - 3, cy + 3, cx + 3, cy - 3); R(g, C.bone, cx - 4, cy + 2, 2, 2); R(g, C.bone, cx + 3, cy - 4, 2, 2); }
    R(g, BR.lo, x - 1, yb - 2, w + 2, 2);
  }
  // Burbujas que suben dentro de una caja (live)
  function bubbles(g, t, x0, x1, yb, yt, n, seed, col) {
    for (var i = 0; i < n; i++) {
      var ph = (t * (0.25 + hash(i + seed) * 0.3) + hash(i * 7 + seed)) % 1;
      P(g, col || '#d6ffe2', Math.round(x0 + hash(i * 3 + seed) * (x1 - x0) + Math.sin(ph * 9 + i) * 1.2), Math.round(yb - (yb - yt) * ph));
    }
  }
  // Gota que cae de (x, y0) hasta y1 cada `period` segundos, con salpicadura (live)
  function drip(g, t, x, y0, y1, period, seed, col) {
    var ph = ((t + seed) % period) / period, y;
    col = col || '#7fb2d0';
    if (ph < 0.55) { y = y0 + (y1 - y0) * (ph / 0.55) * (ph / 0.55); R(g, col, x, Math.round(y), 1, 2); }
    else if (ph < 0.65) { P(g, col, x - 2, y1 - 1); P(g, col, x + 2, y1 - 1); P(g, col, x - 1, y1 - 2); P(g, col, x + 1, y1 - 2); }
  }
  // Volutas de vapor/humo (live) con bolas de difuminado ya preparadas
  var PUFF = null;
  function wisps(g, t, x, y, n, rise, col) {
    if (!PUFF) PUFF = [glowCv(5, 4, '#dfe8ee', 0.5, 0.6), glowCv(8, 6, '#dfe8ee', 0.42, 0.6), glowCv(11, 8, '#dfe8ee', 0.34, 0.6)];
    for (var i = 0; i < n; i++) {
      var ph = (t * 0.35 + i / n) % 1;
      blit(g, PUFF[Math.min(2, (ph * 3) | 0)], x + Math.sin(i * 2.3 + ph * 4) * 6 + ph * 6, y - ph * rise, null, Math.sin(ph * Math.PI) * 0.9);
    }
  }
  // Arco eléctrico entre dos puntos (live)
  function arc(g, x0, y0, x1, y1, t, col) {
    var n = 9, i, px = x0, py = y0, nx, ny, k = Math.floor(t * 30);
    for (i = 1; i <= n; i++) {
      nx = x0 + (x1 - x0) * i / n; ny = y0 + (y1 - y0) * i / n;
      if (i < n) { nx += (hash(k * 13 + i) - 0.5) * 16; ny += (hash(k * 7 + i * 3) - 0.5) * 14; }
      line2(g, col || '#bff4ff', px, py, nx, ny); px = nx; py = ny;
    }
  }
  // Suelo en perspectiva de losas: y0..y1, punto de fuga en vx
  function floorPersp(g, y0, y1, vx, base, line1, lineCol, rows, cols, sp0, sp1) {
    var k, i, yy;
    vgrad(g, 0, y0, 640, y1 - y0, [[0, base[0]], [1, base[1]]], 14);
    for (k = 0; k <= rows; k++) { yy = y0 + Math.round((y1 - y0) * Math.pow(k / rows, 1.7)); R(g, lineCol, 0, yy, 640, 1); }
    for (i = -cols; i <= cols; i++) line2(g, line1, vx + i * sp0, y0, vx + i * sp1, y1);
  }

  /* ---------- Fondo: título (torre en llamas) ---------- */
  var TOWER_X = 488, TOWER_DX = TOWER_X - 472;   // eje de la torre del título (las cotas están medidas en x=472)
  function buildTitle() {
    var c = cv(640, 360), g = gx(c), rnd = DD.mulberry32(404), x, y, cx = TOWER_X;
    vgrad(g, 0, 0, 640, 360, [[0, '#05040a'], [0.38, '#110c1c'], [0.64, '#27121d'], [0.83, '#521d18'], [1, '#86381b']]);
    stars(g, rnd, 110, 0, 240, ['#5b5370', '#8a7f6a', '#8a7f6a', '#d9cdb0']);
    // luna
    g.drawImage(glowCv(60, 60, '#9a90c0', 0.35, 1.8), 104 - 60, 76 - 60);
    disc(g, 104, 76, 22, 22, function (nx, ny, d) { return d > 0.8 ? '#b9b09a' : (nx + ny < -0.3 ? '#efe7cf' : '#d6ccb0'); });
    [[-8, -6, 4], [6, 4, 5], [-2, 10, 3], [9, -9, 3]].forEach(function (q) {
      disc(g, 104 + q[0], 76 + q[1], q[2], q[2] * 0.8, function (nx, ny) { return nx + ny < 0 ? '#b3a98f' : '#cfc5a9'; });
    });
    // humo nocturno (oscuro, con el borde inferior teñido por el fuego)
    cloud(g, 330, 70, 260, 60, 3, '#140e1b', '#4a1c1c'); cloud(g, 150, 120, 220, 50, 5, '#150f1c', '#3c1a1e');
    cloud(g, 480, 28, 200, 44, 8, '#100b18', '#35161b'); cloud(g, 14, 6, 180, 34, 9, '#110c19', '#2a1520');
    // ciudad lejana
    skyline(g, rnd, 318, '#140d1a', 18, 58, ['#c97a2a', 0.5]);
    g.drawImage(glowCv(300, 60, '#ff6a2a', 0.3, 1.2), 320 - 300, 318 - 60);
    skyline(g, rnd, 338, '#0c0811', 14, 40, ['#8a4a20', 0.3]);
    // la torre del reloj
    titleTower(g, rnd);
    // primer plano: verja y escombros
    R(g, '#07050b', 0, 334, 640, 26);
    for (x = 0; x < 640; x += 2) { y = 334 - ((hash(x * 0.5) * 6) | 0); R(g, '#07050b', x, y, 2, 334 - y + 1); }
    for (x = 6; x < 190; x += 9) { R(g, '#0c0812', x, 306, 2, 40); P(g, '#0c0812', x, 304); R(g, '#0c0812', x - 1, 305, 4, 1); }
    R(g, '#0c0812', 0, 318, 190, 2); R(g, '#0c0812', 0, 332, 190, 2);
    for (x = 440; x < 640; x += 9) { R(g, '#0c0812', x, 312, 2, 34); P(g, '#0c0812', x, 310); R(g, '#0c0812', x - 1, 311, 4, 1); }
    R(g, '#0c0812', 440, 324, 200, 2); R(g, '#0c0812', 440, 338, 200, 2);
    // luz del incendio sobre la torre y el cielo
    g.save(); g.globalCompositeOperation = 'lighter';
    g.drawImage(glowCv(190, 150, '#7a2a08', 0.85, 1.4), cx - 190, 70 - 150);
    g.drawImage(glowCv(120, 90, '#ff7a2a', 0.35, 1.6), cx - 120, 60 - 90);
    g.restore();
    vignette(g, 0.85);
    veil(g, 300, 215, 190, 130, '#06040a', 0.42);
    var set1 = gearSet(30, 16, 4, 12, { base: '#6a5228', hi: '#a98a44', lo: '#3a2c14', edge: '#1a1208' });
    var set2 = gearSet(20, 12, 4, 12, { base: '#6a5228', hi: '#a98a44', lo: '#3a2c14', edge: '#1a1208' });
    var set3 = gearSet(26, 12, 6, 12, { base: '#56606c', hi: '#8797a8', lo: '#2c333c', edge: '#14181e' });
    var setBg = gearSet(70, 20, 5, 12, { base: '#1c1626', hi: '#2c2238', lo: '#100c18', edge: '#08060c' });
    var mesh12 = meshRot(16, 12, 455 - 418, 254 - 226), dx = TOWER_DX;
    var glowTop = glowCv(150, 110, '#ff6a20', 0.6, 1.3), glowWin = glowCv(16, 22, '#ffaa40', 0.8, 0.9);
    var puffs = [glowCv(14, 10, '#0c0812', 0.55, 0.5), glowCv(20, 14, '#0c0812', 0.5, 0.5), glowCv(28, 18, '#0c0812', 0.45, 0.5)];
    BD.title = {
      img: c,
      live: function (g2, t) {
        var fl = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3 + 1) + 0.1 * Math.sin(t * 23);
        // engranajes gigantes de fondo (abajo a la izquierda)
        drawGear(g2, setBg, 40, 356, t * 0.12, 0.9); drawGear(g2, setBg, 560, 360, -t * 0.1, 0.9);
        drawGear(g2, set1, 418 + dx, 226, t * 0.3); drawGear(g2, set2, 455 + dx, 254, mesh12 - t * 0.3 * 16 / 12);
        drawGear(g2, set3, 524 + dx, 244, -t * 0.22);
        // ventanas
        for (var k = 0; k < WINDOWS.length; k++) blit(g2, glowWin, WINDOWS[k][0], WINDOWS[k][1] + 1, 'lighter', 0.55 * (0.7 + 0.3 * Math.sin(t * (6 + k * 1.3) + k)));
        // reloj
        clockHands(g2, cx, 158, 19, t);
        // llamas de la torre
        flameRow(g2, 436 + dx, 508 + dx, 76, 54 * fl, t, 1.3); flameRow(g2, 446 + dx, 476 + dx, 82, 34, t + 0.4, 4.1); flameRow(g2, 484 + dx, 504 + dx, 80, 30, t + 0.9, 7.7);
        flameRow(g2, 448 + dx, 456 + dx, 104, 13, t, 2.2); flameRow(g2, 467 + dx, 477 + dx, 104, 14, t, 5.5); flameRow(g2, 488 + dx, 496 + dx, 104, 12, t, 3.7);
        blit(g2, glowTop, cx, 62, 'lighter', 0.55 * fl);
        // humo
        for (var s = 0; s < 7; s++) {
          var ph = ((t * 0.07 + s / 7) % 1), pc = puffs[s % 3];
          blit(g2, pc, cx - 10 + ph * -70 + Math.sin(s * 2 + t * 0.6) * 10, 56 - ph * 70, null, 0.9 * Math.sin(ph * Math.PI));
        }
        embers(g2, t, { x0: 440 + dx, x1: 505 + dx, y: 66, n: 46, rise: 34, life: 4.2, drift: -16, sway: 8 });
        embers(g2, t + 7, { x0: 420 + dx, x1: 530 + dx, y: 120, n: 10, rise: 26, life: 5, drift: -22, sway: 10, seed: 50 });
      }
    };
  }
  function clockHands(g, cx, cy, r, t) {
    var sa = Math.floor(t) / 60 * Math.PI * 2 - Math.PI / 2, ma = t / 40 * Math.PI * 2 - Math.PI / 2, ha = t / 480 * Math.PI * 2 - Math.PI / 2;
    line2(g, '#0a0710', cx, cy, cx + Math.cos(ha) * r * 0.5, cy + Math.sin(ha) * r * 0.5);
    line2(g, '#0a0710', cx, cy, cx + Math.cos(ma) * r * 0.8, cy + Math.sin(ma) * r * 0.8);
    line2(g, C.bloodHi, cx, cy, cx + Math.cos(sa) * r * 0.92, cy + Math.sin(sa) * r * 0.92);
    R(g, C.brass, cx - 1, cy - 1, 3, 3);
  }
  var WINDOWS = [[452, 212], [472, 212], [492, 212], [452, 250], [492, 250]].map(function (w) { return [w[0] + TOWER_DX, w[1]]; });
  function titleTower(g, rnd) {
    var cx = TOWER_X, i, x, y, stone = '#1c1626', stone2 = '#241a2e', edge = '#0d0913';
    // contrafuertes y fuste
    [[410 + TOWER_DX, 150, 24], [514 + TOWER_DX, 150, 24]].forEach(function (b) {
      brickFill(g, b[0], b[1], b[2], 210, 8, 6, '#1a1424', '#231a2c', edge, rnd);
      for (i = 0; i < 18; i++) R(g, '#1a1424', b[0] + (b[0] < TOWER_X - 22 ? 4 + i : 0), b[1] - 18 + i, b[2] - 4 - i, 1);
    });
    brickFill(g, cx - 42, 96, 84, 264, 10, 6, stone, stone2, edge, rnd);
    R(g, '#2c2238', cx - 42, 96, 2, 264); R(g, '#0a0710', cx + 40, 96, 2, 264);       // cantos
    // pináculos y aguja rota
    [[cx - 44, 10], [cx + 34, 10]].forEach(function (p) {
      brickFill(g, p[0], 44, p[1], 30, 5, 5, '#1d1728', '#271d32', edge, rnd);
      poly(g, '#1d1728', [[p[0] - 1, 44], [p[0] + p[1] / 2, 18], [p[0] + p[1] + 1, 44]]);
      P(g, '#2c2238', p[0] + 1, 40);
    });
    poly(g, '#140f1c', [[cx - 26, 66], [cx - 14, 34], [cx - 10, 40], [cx - 2, 22], [cx + 4, 36], [cx + 10, 30], [cx + 26, 66]]);
    line2(g, '#0a0710', cx - 14, 34, cx - 14, 66); line2(g, '#0a0710', cx + 10, 30, cx + 10, 66);
    // campanario con almenas
    brickFill(g, cx - 36, 66, 72, 34, 9, 6, '#1d1728', '#271d32', edge, rnd);
    for (x = cx - 38; x < cx + 36; x += 13) brickFill(g, x, 56, 8, 12, 8, 6, '#1d1728', '#271d32', edge, rnd);
    R(g, '#0a0710', cx - 42, 96, 84, 3);
    R(g, '#2c2238', cx - 40, 99, 80, 1);
    // aberturas ojivales del campanario (arden por dentro)
    [-24, -2, 20].forEach(function (dx) { archFill(g, '#ffb24a', cx + dx + 4, 9, 7, 92, 76, 99); archFill(g, '#ff6a20', cx + dx + 4, 5, 4, 92, 82, 99); });
    // reloj anatómico
    disc(g, cx, 158, 27, 27, function (nx, ny, d) { return d > 0.86 ? C.brassDk : (d > 0.7 ? (nx + ny < 0 ? '#e0c078' : C.brass) : '#3a3126'); });
    disc(g, cx, 158, 19.5, 19.5, function (nx, ny, d) { return d > 0.9 ? '#6a5a3a' : '#7d7052'; });
    for (i = 0; i < 12; i++) {
      var a = i / 12 * Math.PI * 2, rr = i % 3 === 0 ? 14 : 16;
      line2(g, '#2a2214', cx + Math.cos(a) * rr, 158 + Math.sin(a) * rr, cx + Math.cos(a) * 18, 158 + Math.sin(a) * 18);
    }
    // ventanas inferiores ojivales
    WINDOWS.forEach(function (w) {
      archFill(g, '#0a0710', w[0], 10, 8, w[1] + 6, w[1] - 8, w[1] + 14); archFill(g, '#8a3a18', w[0], 6, 5, w[1] + 6, w[1] - 4, w[1] + 13);
    });
    // puerta grande
    archFill(g, '#07050b', cx, 30, 24, 320, 290, 360); archFill(g, '#140e1a', cx, 22, 17, 322, 298, 360);
    // tuberías de cobre
    [[cx - 38, 110], [cx + 34, 110]].forEach(function (p) {
      R(g, '#4a2a14', p[0], p[1], 4, 250); R(g, '#8a4a20', p[0], p[1], 1, 250);
      for (y = p[1] + 30; y < 360; y += 50) R(g, '#6a3a1a', p[0] - 1, y, 6, 3);
    });
    // cornisas
    R(g, '#2c2238', cx - 44, 146, 88, 2); R(g, '#0a0710', cx - 44, 148, 88, 2);
    R(g, '#2c2238', cx - 44, 280, 88, 2); R(g, '#0a0710', cx - 44, 282, 88, 2);
  }

  /* ---------- Fondo: mesa de disección ---------- */
  function buildTable() {
    var c = cv(640, 360), g = gx(c), rnd = DD.mulberry32(21), i, x;
    brickFill(g, 0, 0, 640, 244, 16, 8, '#1c1726', '#282133', '#0f0c16', rnd);
    // nichos ciegos en el muro
    [[246, 100], [394, 100]].forEach(function (n) {
      archFill(g, '#2c2438', n[0], 92, 80, 200, 40, 244); archFill(g, '#0f0c16', n[0], 84, 72, 200, 46, 244);
      archFill(g, '#151020', n[0], 78, 66, 200, 52, 244);
    });
    // vigas del techo y tuberías de cobre
    R(g, '#0d0a12', 0, 0, 640, 16); R(g, '#241c2e', 0, 15, 640, 2);
    for (x = 40; x < 640; x += 120) { R(g, '#0d0a12', x, 0, 10, 34); R(g, '#241c2e', x, 0, 1, 34); }
    R(g, '#5a2f16', 0, 22, 640, 5); R(g, '#b8642f', 0, 22, 640, 1); R(g, '#3a1c0c', 0, 26, 640, 1);
    for (x = 30; x < 640; x += 90) { R(g, '#7a4220', x, 21, 4, 7); R(g, '#d98a4a', x, 21, 4, 1); }
    R(g, '#5a2f16', 166, 22, 5, 46); R(g, '#b8642f', 166, 22, 1, 46); R(g, '#7a4220', 164, 66, 9, 5);
    R(g, '#5a2f16', 470, 22, 5, 70); R(g, '#b8642f', 470, 22, 1, 70); R(g, '#7a4220', 468, 90, 9, 5);
    // suelo de losas
    floorPersp(g, 244, 360, 320, ['#17121e', '#0b0810'], '#0d0a12', '#0d0a12', 6, 9, 50, 130);
    // estantería con frascos (izquierda)
    R(g, '#1f140c', 12, 66, 144, 4); R(g, '#1f140c', 12, 66, 5, 184); R(g, '#1f140c', 151, 66, 5, 184);
    [110, 160, 210].forEach(function (yy, r) {
      R(g, '#3a2414', 12, yy, 144, 5); R(g, '#5a3a22', 12, yy, 144, 1); R(g, '#170e08', 12, yy + 5, 144, 2);
      var xx = 20, liqs = ['#3f8a5c', '#3f8fa6', '#b8842f', '#6a8a3a', '#7a4a8a'];
      while (xx < 142) {
        var w = 14 + ((rnd() * 8) | 0), h = 26 + ((rnd() * 12) | 0);
        if (xx + w > 144) break;
        jarDraw(g, xx, yy, w, Math.min(h, r ? 44 : 36), liqs[(rnd() * liqs.length) | 0], (rnd() * 5) | 0);
        xx += w + 4 + ((rnd() * 4) | 0);
      }
    });
    R(g, '#3a2414', 12, 250, 144, 4);
    // ventana ojival con el incendio
    archFill(g, '#3a2e48', 540, 84, 74, 138, 44, 184); archFill(g, '#0d0a12', 540, 76, 66, 140, 52, 184);
    archFill(g, function (yy) { return mix('#3a0f18', '#ff8a2a', DD.clamp((yy - 56) / 120, 0, 1) * 0.95); }, 540, 70, 60, 140, 58, 182);
    poly(g, '#170c12', [[506, 182], [506, 162], [512, 162], [514, 150], [524, 150], [526, 164], [534, 164], [536, 142], [546, 142], [546, 158], [556, 158], [558, 152], [568, 152], [568, 166], [575, 166], [575, 182]]);
    for (i = 0; i < 14; i++) P(g, rnd() < 0.5 ? C.fire2 : C.fire3, 508 + ((rnd() * 66) | 0), 160 + ((rnd() * 20) | 0));
    R(g, '#0d0a12', 539, 58, 3, 126); R(g, '#0d0a12', 500, 112, 80, 3); R(g, '#0d0a12', 500, 148, 80, 3);
    R(g, '#3a2e48', 492, 184, 96, 6); R(g, '#0d0a12', 492, 190, 96, 2);
    // herramientas colgadas bajo la ventana
    R(g, '#2a1c10', 492, 204, 96, 3);
    [[500, 28, 0], [516, 22, 1], [534, 30, 2], [552, 24, 3], [568, 26, 0]].forEach(function (tl) {
      line(g, '#0a0710', tl[0] + 1, 207, tl[0] + 1, 207 + tl[1]);
      line(g, tl[2] % 2 ? '#8797a8' : '#5a6878', tl[0], 207, tl[0], 207 + tl[1]);
      R(g, '#6b4426', tl[0] - 1, 207, 3, 6);
      if (tl[2] === 2) R(g, '#8797a8', tl[0] - 3, 207 + tl[1] - 4, 7, 2);
      if (tl[2] === 3) { R(g, '#8797a8', tl[0] - 2, 207 + tl[1] - 2, 5, 2); P(g, '#8797a8', tl[0] - 3, 207 + tl[1] - 3); }
    });
    // reloj de pared
    disc(g, 92, 46, 17, 17, function (nx, ny, d) { return d > 0.8 ? (nx + ny < 0 ? BR.hi : BR.lo) : (d > 0.68 ? BR.dk : '#b5a682'); });
    for (i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; line2(g, '#2a2214', 92 + Math.cos(a) * (i % 3 ? 11 : 9), 46 + Math.sin(a) * (i % 3 ? 11 : 9), 92 + Math.cos(a) * 12.5, 46 + Math.sin(a) * 12.5); }
    // mesa de disección
    R(g, 'rgba(0,0,0,0.45)', 196, 296, 252, 16);                                   // sombra
    poly(g, '#2a323c', [[246, 240], [394, 240], [452, 272], [188, 272]]);
    poly(g, '#3c4754', [[250, 243], [390, 243], [442, 270], [198, 270]]);
    line2(g, '#56636f', 246, 240, 394, 240); line2(g, '#6b7886', 188, 272, 452, 272);
    line2(g, '#232a33', 320, 244, 320, 270);
    for (i = 0; i < 3; i++) poly(g, '#3a2414', [[276 + i * 38, 242], [284 + i * 38, 242], [286 + i * 44 - 14, 271], [276 + i * 44 - 14, 271]]);
    R(g, BR.dk, 188, 272, 264, 14); R(g, BR.mid, 188, 272, 264, 2); R(g, BR.lo, 188, 284, 264, 2);
    for (x = 196; x < 448; x += 22) { P(g, BR.hi, x, 278); P(g, BR.hi, x + 1, 278); }
    R(g, C.blood, 300, 274, 2, 9); P(g, C.blood, 301, 284);
    pillar(g, 196, 286, 14, 34, BR.lo); pillar(g, 430, 286, 14, 34, BR.lo);
    R(g, BR.dk, 196, 286, 14, 3); R(g, BR.dk, 430, 286, 14, 3);
    R(g, '#5a2f16', 208, 304, 224, 4); R(g, '#b8642f', 208, 304, 224, 1);
    R(g, '#0a0710', 194, 320, 18, 3); R(g, '#0a0710', 428, 320, 18, 3);
    // electrodos de bobina
    [[152, 1], [488, -1]].forEach(function (e) {
      R(g, '#15101c', e[0] - 3, 216, 6, 70); pillar(g, e[0] - 2, 216, 4, 70, '#3c4654');
      for (i = 0; i < 4; i++) { R(g, BR.dk, e[0] - 6, 232 + i * 10, 12, 3); R(g, BR.mid, e[0] - 6, 232 + i * 10, 12, 1); }
      disc(g, e[0], 210, 8, 8, function (nx, ny, d) { return d > 0.8 ? BR.dk : (nx + ny < -0.2 ? BR.hi : BR.mid); });
    });
    // luz: ventana, lámpara
    g.save(); g.globalCompositeOperation = 'lighter';
    g.drawImage(glowCv(120, 100, '#7a2208', 0.8, 1.3), 540 - 120, 130 - 100);
    g.drawImage(glowCv(100, 40, '#551a08', 0.6, 1.2), 500 - 100, 268 - 40);
    g.drawImage(coneCv(260, 214, 46, 250, 0, '#6a5a3a', 0.6), 190, 56);
    g.restore();
    // lámpara quirúrgica
    chain(g, 320, 27, 40, '#5a6878');
    poly(g, BR.dk, [[290, 56], [300, 40], [340, 40], [350, 56]]); poly(g, BR.mid, [[293, 54], [302, 42], [338, 42], [347, 54]]);
    R(g, BR.hi, 304, 42, 10, 2); R(g, BR.dk, 288, 55, 64, 3); R(g, '#fff0c0', 304, 58, 32, 2);
    vignette(g, 0.9);
    veil(g, 320, 190, 200, 120, '#07050b', 0.4);
    var coneL = coneCv(260, 214, 46, 250, 0, '#ffd890', 0.3), glowLamp = glowCv(34, 22, '#ffe2a0', 0.9, 1.2), glowWin = glowCv(110, 90, '#ff7a2a', 0.5, 1.4);
    BD.table = {
      img: c,
      live: function (g2, t) {
        var fl = 0.8 + 0.2 * Math.sin(t * 8.3) * Math.sin(t * 3.1) + 0.08 * Math.sin(t * 27);
        blit(g2, coneL, 320, 56 + 107, 'lighter', 0.55 * fl);
        blit(g2, glowLamp, 320, 60, 'lighter', fl);
        blit(g2, glowWin, 540, 120, 'lighter', 0.5 * (0.7 + 0.3 * Math.sin(t * 6.7 + 1) * Math.sin(t * 2.3)));
        clockHands(g2, 92, 46, 11, t);
        bubbles(g2, t, 24, 140, 100, 84, 5, 11); bubbles(g2, t, 24, 140, 150, 130, 5, 23); bubbles(g2, t, 24, 140, 200, 180, 5, 37);
        drip(g2, t, 168, 70, 246, 3.4, 1.1); drip(g2, t, 472, 95, 246, 4.6, 2.3);
        wisps(g2, t, 168, 62, 3, 24); wisps(g2, t, 472, 88, 3, 26);
        var ph = (t % 5.5);
        if (ph < 0.35) {
          arc(g2, 152, 204, 488, 204, t, '#bff4ff'); arc(g2, 152, 210, 320, 236, t + 1, '#7fd6e6');
          blit(g2, glowLamp, 320, 215, 'lighter', 0.6);
        }
        embers(g2, t, { x0: 500, x1: 580, y: 184, n: 10, rise: 24, life: 4, drift: -8, sway: 6, seed: 9 });
      }
    };
  }

  /* ---------- Fondos de combate (uno por piso) ---------- */
  function torchLive(g, t, x, y, seed, glow) {
    var fl = 0.75 + 0.25 * Math.sin(t * 9 + seed) * Math.sin(t * 4.7 + seed * 2);
    flameRow(g, x - 4, x + 5, y, 15 * fl + 2, t, seed);
    blit(g, glow, x, y - 6, 'lighter', 0.55 * fl);
  }
  function motes(g, t, n, x0, x1, y0, y1, col, seed, vy) {
    for (var i = 0; i < n; i++) {
      var ph = (t * (vy || 0.05) * (0.6 + hash(i + seed)) + hash(i * 5 + seed)) % 1;
      var x = x0 + hash(i * 3 + seed) * (x1 - x0) + Math.sin(t * 0.7 + i * 1.9) * 8;
      var a = Math.sin(ph * Math.PI);
      if (a > 0.25) { g.globalAlpha = Math.min(1, a * 1.3); P(g, col, Math.round(x), Math.round(y1 - (y1 - y0) * ph)); }
    }
    g.globalAlpha = 1;
  }
  function buildCombat0() {
    var c = cv(640, 360), g = gx(c), rnd = DD.mulberry32(60), i, x;
    brickFill(g, 0, 0, 640, 210, 24, 12, '#262e42', '#34405a', '#0f131e', rnd);
    // nichos abovedados
    [[100, 0], [320, 1], [540, 0]].forEach(function (n) {
      archFill(g, '#3c4a66', n[0], 118, 102, 124, 34, 210); archFill(g, '#090c14', n[0], 106, 90, 124, 40, 210);
      if (n[1]) { for (x = n[0] - 48; x < n[0] + 50; x += 12) R(g, '#1c2436', x, 46, 3, 164); R(g, '#1c2436', n[0] - 50, 100, 100, 3); R(g, '#1c2436', n[0] - 50, 160, 100, 3); }
      else {
        for (i = 0; i < 4; i++) {           // estantes de catacumba con calaveras
          var sy = 84 + i * 34;
          R(g, '#1c2436', n[0] - 50, sy + 26, 100, 4); R(g, '#2a3850', n[0] - 50, sy + 26, 100, 1);
          for (x = n[0] - 42; x < n[0] + 40; x += 15 + ((rnd() * 5) | 0)) {
            disc(g, x + 4, sy + 18, 5, 5.5, function (nx, ny, d) { return d > 0.8 ? '#4a4a52' : (nx + ny < -0.3 ? '#8a8a8e' : '#66666e'); });
            R(g, '#050710', x + 1, sy + 16, 2, 2); R(g, '#050710', x + 5, sy + 16, 2, 2); R(g, '#66666e', x + 2, sy + 22, 5, 3);
          }
        }
      }
    });
    // pilares con capitel
    [212, 428].forEach(function (px) {
      pillar(g, px - 13, 22, 26, 188, '#34405a'); R(g, '#46547a', px - 17, 18, 34, 8); R(g, '#1b2233', px - 17, 26, 34, 2);
      R(g, '#46547a', px - 17, 202, 34, 8); R(g, '#1b2233', px - 17, 200, 34, 2);
      R(g, BR.dk, px - 3, 112, 6, 14); R(g, BR.mid, px - 5, 108, 10, 4); R(g, BR.dk, px - 4, 112, 8, 2);
    });
    // cadenas
    [[52, 40, 120], [588, 30, 150], [276, 18, 70]].forEach(function (ch) { chain(g, ch[0], ch[1], ch[2], '#46525f'); R(g, '#46525f', ch[0] - 3, ch[2], 7, 4); });
    // ventanuco alto y haz de luz fría
    archFill(g, '#3c4a66', 24, 26, 22, 44, 14, 66); archFill(g, '#9cc4ec', 24, 18, 15, 46, 20, 66);
    R(g, '#3c4a66', 23, 20, 2, 46);
    // suelo mojado
    floorPersp(g, 210, 360, 320, ['#1c2436', '#0b0e17'], '#0e121b', '#0e121b', 7, 9, 48, 120);
    [[120, 268, 54, 9], [430, 296, 76, 12], [568, 244, 30, 6], [270, 236, 26, 5]].forEach(function (p) {
      disc(g, p[0], p[1], p[2], p[3], function (nx, ny, d) { return d > 0.7 ? '#0a1018' : (ny < -0.3 ? '#1c2c44' : '#101a2c'); });
      disc(g, p[0] - p[2] * 0.3, p[1] - p[3] * 0.3, p[2] * 0.4, p[3] * 0.25, function () { return '#2e4a6a'; });
    });
    g.save(); g.globalCompositeOperation = 'lighter';
    g.drawImage(coneCv(250, 210, 28, 150, 70, '#6a9cc8', 0.45), 24 - 125 + 10, 40);
    [212, 428].forEach(function (px) { g.drawImage(glowCv(90, 80, '#8a3a08', 0.55, 1.4), px - 90, 118 - 80); g.drawImage(glowCv(26, 70, '#6a2a08', 0.45, 1.2), px - 26, 214); });
    g.restore();
    vignette(g, 0.9);
    veil(g, 320, 170, 190, 100, '#06080e', 0.38);
    var glow = glowCv(28, 28, '#ff9a40', 0.7, 1.1), fog = [glowCv(70, 9, '#8ea6c4', 0.22, 0.8), glowCv(90, 11, '#8ea6c4', 0.2, 0.8), glowCv(60, 8, '#8ea6c4', 0.24, 0.8)];
    BDC[0] = {
      img: c,
      live: function (g2, t) {
        torchLive(g2, t, 212, 106, 1.3, glow); torchLive(g2, t, 428, 106, 4.1, glow);
        motes(g2, t, 26, 30, 170, 30, 200, '#c8e0ff', 3, 0.04);
        drip(g2, t, 120, 0, 268, 3.7, 0.6); drip(g2, t, 430, 0, 296, 5.3, 2.2); drip(g2, t, 568, 0, 244, 4.3, 1.4);
        for (var k = 0; k < 3; k++) blit(g2, fog[k], ((t * (5 + k * 2) + k * 260) % 820) - 90, 226 + k * 14, null, 0.9);
      }
    };
  }

  var BOOKC = ['#8c2a2a', '#2f6b4a', '#b08a3a', '#2f4a7a', '#5a3a7a', '#a8562a', '#cdbf9f', '#6a2a3a'];
  function bookRow(g, x0, x1, yb, hmax, rnd) {
    var x = x0, w, h, col;
    R(g, '#120a06', x0, yb - hmax, x1 - x0, hmax);
    while (x < x1 - 3) {
      if (rnd() < 0.05) { x += 3 + ((rnd() * 4) | 0); continue; }
      w = 4 + ((rnd() * 4) | 0); if (x + w > x1) w = x1 - x;
      h = hmax - 4 - ((rnd() * (hmax * 0.4)) | 0);
      col = dk(BOOKC[(rnd() * BOOKC.length) | 0], 0.3);
      R(g, col, x, yb - h, w, h); R(g, lit(col, 0.25), x, yb - h, 1, h); R(g, dk(col, 0.35), x + w - 1, yb - h, 1, h);
      if (rnd() < 0.6) { R(g, dk(C.brass, 0.3), x, yb - h + 3, w, 1); R(g, dk(C.brass, 0.3), x, yb - 4, w, 1); }
      if (rnd() < 0.3) P(g, C.bone, x + 1 + ((rnd() * (w - 2)) | 0), yb - h + 7);
      x += w;
    }
  }
  function flask(g, cx, yb, r, liq) {                  // matraz de fondo redondo
    R(g, '#b7d8c8', cx - 1, yb - r * 2 - 7, 3, 7); R(g, '#e6f6f0', cx - 2, yb - r * 2 - 8, 5, 1);
    disc(g, cx, yb - r, r, r, function (nx, ny, d) {
      if (ny < -0.15) return d > 0.6 ? '#b7d8c8' : '#5a7a70';
      return d > 0.75 ? dk(liq, 0.5) : (nx + ny < -0.3 ? lit(liq, 0.4) : liq);
    });
    P(g, '#ffffff', cx - r + 2, yb - r - 1);
  }
  function buildCombat1() {
    var c = cv(640, 360), g = gx(c), rnd = DD.mulberry32(61), i, x, k;
    R(g, '#2a1a0f', 0, 0, 640, 210);
    for (x = 190; x < 450; x += 13) { R(g, '#21130a', x, 0, 1, 210); R(g, '#33200f', x + 1, 0, 1, 210); }
    // estanterías laterales
    [[0, 184], [456, 640]].forEach(function (b) {
      R(g, '#1a0f08', b[0], 10, b[1] - b[0], 200);
      for (k = 0; k < 6; k++) { bookRow(g, b[0] + 6, b[1] - 6, 44 + k * 33, 30, rnd); R(g, '#4a2e18', b[0], 44 + k * 33, b[1] - b[0], 4); R(g, '#6a4426', b[0], 44 + k * 33, b[1] - b[0], 1); R(g, '#120a06', b[0], 48 + k * 33, b[1] - b[0], 1); }
      R(g, '#4a2e18', b[0], 10, b[1] - b[0], 5); R(g, '#33200f', b[0], 15, b[1] - b[0], 2);
      R(g, '#4a2e18', b[0], 0, 6, 210); R(g, '#4a2e18', b[1] - 6, 0, 6, 210);
    });
    // moldura y friso
    R(g, '#4a2e18', 184, 0, 272, 6); R(g, '#6a4426', 184, 0, 272, 1);
    // rosetón
    disc(g, 320, 88, 48, 48, function (nx, ny, d) { return d > 0.88 ? '#2a1a0f' : (d > 0.8 ? '#6a4426' : '#3a2a1a'); });
    disc(g, 320, 88, 40, 40, function (nx, ny, d) {
      var a = (Math.atan2(ny, nx) + Math.PI) / (Math.PI * 2) * 12, sec = Math.floor(a), fr = a - sec;
      if (fr < 0.07 || fr > 0.93 || (d > 0.32 && d < 0.36) || (d > 0.64 && d < 0.68)) return '#2a1a0f';
      if (d < 0.1) return '#ffd15a';
      var pal = ['#2f8a4a', '#b8842f', '#a3202a', '#2f4a9a', '#6a3a9a', '#b8642f'];
      var cc = pal[(sec + (d > 0.66 ? 3 : (d > 0.34 ? 1 : 0))) % 6];
      return d > 0.66 ? dk(cc, 0.1) : cc;
    });
    // mesitas con matraces
    [[206, 1], [434, -1]].forEach(function (tb) {
      var tx = tb[0];
      disc(g, tx, 204, 22, 5, function (nx, ny) { return ny < 0 ? '#6a4426' : '#33200f'; }); R(g, '#2a1a0f', tx - 2, 206, 4, 8);
      flask(g, tx - 11, 203, 6, '#4f9a2c'); flask(g, tx + 2, 203, 5, '#6fbf3a'); flask(g, tx + 13, 203, 4, '#2f8a4a');
    });
    // suelo de tablones
    R(g, '#1e1209', 0, 210, 640, 150);
    for (i = -16; i < 16; i++) {
      var xa = 320 + i * 40, xb = 320 + i * 118, xa2 = 320 + (i + 1) * 40, xb2 = 320 + (i + 1) * 118;
      poly(g, mix('#3e2614', '#2f1c0e', hash(i + 4) * 0.8), [[xa, 210], [xa2, 210], [xb2, 360], [xb, 360]]);
      line2(g, '#170d06', xa, 210, xb, 360);
    }
    for (i = 0; i < 40; i++) {
      var yy = 214 + Math.pow(rnd(), 1.6) * 140, pi = Math.floor((rnd() - 0.5) * 24), f = (yy - 210) / 150;
      var x0 = 320 + pi * (40 + 78 * f); R(g, '#170d06', Math.round(x0), Math.round(yy), Math.max(2, Math.round(40 + 78 * f) - 2), 1);
    }
    R(g, '#140a05', 0, 208, 640, 3);
    // alfombra
    poly(g, '#5a1820', [[250, 226], [390, 226], [470, 340], [170, 340]]);
    poly(g, '#7a5a26', [[256, 229], [384, 229], [460, 334], [180, 334]]);
    poly(g, '#3a0f18', [[260, 232], [380, 232], [454, 330], [186, 330]]);
    for (i = 0; i < 26; i++) { var ry = 240 + ((rnd() * 88) | 0); P(g, '#7a5a26', Math.round(320 + (rnd() - 0.5) * (140 + (ry - 232) * 1.6)), ry); }
    // lámpara de araña
    chain(g, 320, 0, 30, '#6a4f20');
    R(g, BR.dk, 266, 32, 108, 4); R(g, BR.mid, 266, 32, 108, 1);
    for (i = 0; i < 6; i++) { R(g, C.bone, 270 + i * 20, 26, 3, 7); }
    g.fillStyle = 'rgba(8,4,2,0.4)'; g.fillRect(0, 10, 184, 200); g.fillRect(456, 10, 184, 200);       // estanterías más tenues
    g.save(); g.globalCompositeOperation = 'lighter';
    g.drawImage(glowCv(120, 100, '#4a2a08', 0.85, 1.3), 320 - 120, 40 - 100 + 40);
    g.drawImage(glowCv(170, 70, '#5a3008', 0.6, 1.2), 320 - 170, 130);
    g.drawImage(glowCv(60, 70, '#1c4a12', 0.8, 1.3), 206 - 60, 200 - 70); g.drawImage(glowCv(60, 70, '#1c4a12', 0.8, 1.3), 434 - 60, 200 - 70);
    g.restore();
    vignette(g, 0.9);
    veil(g, 320, 180, 190, 100, '#0a0604', 0.4);
    var gl = glowCv(34, 22, '#ffb860', 0.7, 1.1), gg = glowCv(52, 50, '#6fbf3a', 0.5, 1.4), rose = glowCv(60, 60, '#ff8a2a', 0.4, 1.2);
    BDC[1] = {
      img: c,
      live: function (g2, t) {
        var fl = 0.8 + 0.2 * Math.sin(t * 7.7) * Math.sin(t * 3.3);
        blit(g2, rose, 320, 88, 'lighter', 0.35 * (0.7 + 0.3 * Math.sin(t * 5.1)));
        for (var j = 0; j < 6; j++) {
          var h = 5 + 3 * (0.5 + 0.5 * Math.sin(t * (8 + j) + j * 2));
          flameRow(g2, 269 + j * 20, 274 + j * 20, 26, h, t, j);
          blit(g2, gl, 271 + j * 20, 22, 'lighter', 0.22 * fl);
        }
        var pulse = 0.6 + 0.4 * Math.sin(t * 2.1);
        blit(g2, gg, 206, 192, 'lighter', 0.6 * pulse); blit(g2, gg, 434, 192, 'lighter', 0.6 * (1.1 - pulse * 0.5));
        bubbles(g2, t, 196, 218, 200, 170, 5, 4, '#d6ffb0'); bubbles(g2, t, 424, 446, 200, 170, 5, 9, '#d6ffb0');
        motes(g2, t, 40, 40, 600, 30, 230, '#9be05a', 7, 0.035);
      }
    };
  }

  function buildCombat2() {
    var c = cv(640, 360), g = gx(c), rnd = DD.mulberry32(62), i, x, y;
    brickFill(g, 0, 0, 640, 212, 64, 44, '#46361a', '#5a4624', '#1b1309', rnd);
    for (y = 0; y < 212; y += 44) for (x = 0; x < 640; x += 64) { [[x + 5, y + 5], [x + 55, y + 5], [x + 5, y + 37], [x + 55, y + 37]].forEach(function (q) { R(g, BR.dk, q[0], q[1] + 1, 3, 2); R(g, BR.hi, q[0], q[1], 3, 2); }); }
    // ranura de la cúpula con el cielo rojo
    archFill(g, '#3a2c14', 320, 118, 100, 130, 0, 212); archFill(g, '#1b1309', 320, 106, 88, 132, 0, 212);
    archFill(g, function (yy) { return mix('#10061a', '#ff7a2a', Math.pow(DD.clamp(yy / 212, 0, 1), 2.2)); }, 320, 100, 84, 134, 0, 212);
    for (i = 0; i < 40; i++) P(g, rnd() < 0.3 ? '#ffd9a0' : '#8a5a6a', 272 + ((rnd() * 96) | 0), (rnd() * 120) | 0);
    skyline(g, rnd, 212, '#170a10', 10, 34, ['#ffb24a', 0.6]);
    g.save(); g.beginPath(); g.rect(0, 0, 272, 212); g.rect(368, 0, 272, 212); g.clip(); brickFill(g, 0, 150, 640, 62, 64, 44, '#46361a', '#5a4624', '#1b1309', rnd); g.restore();
    R(g, '#3a2c14', 256, 210, 128, 4);
    // telescopio
    poly(g, '#20170c', [[596, 204], [606, 196], [398, 34], [386, 44]]);
    poly(g, '#8a6a30', [[594, 200], [602, 194], [398, 38], [390, 46]]);
    poly(g, '#c9a24a', [[590, 197], [596, 192], [398, 38], [394, 42]]);
    for (i = 0; i < 6; i++) { var f = 0.12 + i * 0.16; R(g, BR.dk, Math.round(590 - 196 * f) - 3, Math.round(198 - 160 * f) - 3, 7, 7); }
    disc(g, 392, 40, 8, 8, function (nx, ny, d) { return d > 0.7 ? BR.dk : (nx + ny < -0.3 ? '#bff4ff' : '#3f8fa6'); });
    pillar(g, 592, 200, 14, 18, '#3a2c14');
    // tuberías de cobre y válvulas
    [18, 620].forEach(function (px2) { R(g, '#5a2f16', px2 - 3, 0, 7, 212); R(g, '#b8642f', px2 - 3, 0, 1, 212); R(g, '#3a1c0c', px2 + 3, 0, 1, 212); for (y = 20; y < 212; y += 46) { R(g, '#7a4220', px2 - 5, y, 11, 5); R(g, '#d98a4a', px2 - 5, y, 11, 1); } });
    // suelo de rejilla con brasas
    floorPersp(g, 212, 360, 320, ['#1a1219', '#0a0709'], '#6a2418', '#4a1810', 7, 11, 40, 96);
    for (i = 0; i < 60; i++) { var yy = 214 + Math.pow(rnd(), 1.5) * 140; P(g, rnd() < 0.5 ? '#ff7a2a' : '#c2391f', (rnd() * 640) | 0, Math.round(yy)); }
    R(g, '#0a0709', 0, 210, 640, 3);
    g.save(); g.globalCompositeOperation = 'lighter';
    g.drawImage(glowCv(200, 120, '#7a2208', 0.85, 1.3), 320 - 200, 60 - 60);
    g.drawImage(glowCv(330, 60, '#4a1408', 0.8, 1.0), 320 - 330, 290 - 60);
    g.restore();
    vignette(g, 0.9);
    veil(g, 320, 175, 190, 100, '#070406', 0.4);
    var setA = gearSet(54, 18, 6, 12, { base: '#4a3a1c', hi: '#8a6a30', lo: '#231a0c', edge: '#0f0a04' });
    var setB = gearSet(30, 12, 4, 12, { base: '#4a3a1c', hi: '#8a6a30', lo: '#231a0c', edge: '#0f0a04' });
    var setC = gearSet(40, 12, 6, 12, { base: '#3c4654', hi: '#6a7888', lo: '#1c222a', edge: '#0c0f12' });
    var red = glowCv(200, 50, '#ff4a1a', 0.45, 1.0), meshB = meshRot(18, 12, 124 - 70, 176 - 118);
    BDC[2] = {
      img: c,
      live: function (g2, t) {
        drawGear(g2, setA, 70, 118, t * 0.22); drawGear(g2, setB, 124, 176, meshB - t * 0.22 * 18 / 12, 1);
        drawGear(g2, setC, 590, 66, -t * 0.18);
        var fl = 0.7 + 0.3 * Math.sin(t * 2.4) * Math.sin(t * 7.1 + 1);
        blit(g2, red, 320, 300, 'lighter', 0.6 * fl);
        wisps(g2, t, 18, 66, 3, 34); wisps(g2, t + 2, 620, 160, 3, 34);
        embers(g2, t, { x0: 40, x1: 600, y: 330, n: 34, rise: 22, life: 5, drift: 2, sway: 6, seed: 5 });
        embers(g2, t, { x0: 280, x1: 360, y: 160, n: 8, rise: 14, life: 5, drift: -4, sway: 5, seed: 31 });
      }
    };
  }

  /* ---------- Fondo: cosecha (estantería oscura) ---------- */
  function buildHarvest() {
    var c = cv(640, 360), g = gx(c), rnd = DD.mulberry32(71), i;
    brickFill(g, 0, 0, 640, 250, 24, 12, '#1b1219', '#241923', '#0a0709', rnd);
    // estanterías laterales con frascos y calaveras
    [[0, 118], [522, 640]].forEach(function (b) {
      R(g, '#120a06', b[0], 14, b[1] - b[0], 240);
      [100, 160, 220].forEach(function (yy, r) {
        var xx = b[0] + 8;
        while (xx < b[1] - 26) {
          var w = 14 + ((rnd() * 8) | 0), k = (rnd() * 6) | 0;
          if (k === 5) { disc(g, xx + 8, yy - 9, 7, 7.5, function (nx, ny, d) { return d > 0.8 ? '#5a5248' : (nx + ny < -0.3 ? '#b9ad94' : '#8a7f6a'); }); R(g, '#0a0709', xx + 4, yy - 12, 3, 3); R(g, '#0a0709', xx + 9, yy - 12, 3, 3); R(g, '#8a7f6a', xx + 6, yy - 4, 5, 3); xx += 20; continue; }
          jarDraw(g, xx, yy, w, 30 + ((rnd() * 10) | 0), ['#2f6a4a', '#3a6a8a', '#7a4a3a', '#5a4a8a'][(rnd() * 4) | 0], (rnd() * 5) | 0);
          xx += w + 5;
        }
        R(g, '#2a1a10', b[0], yy, b[1] - b[0], 5); R(g, '#4a2e18', b[0], yy, b[1] - b[0], 1); R(g, '#0a0604', b[0], yy + 5, b[1] - b[0], 2);
      });
      R(g, '#2a1a10', b[0], 14, b[1] - b[0], 5); R(g, '#2a1a10', b[0] ? b[0] : 0, 14, 5, 240); R(g, '#2a1a10', b[1] - 5, 14, 5, 240);
    });
    // riel con ganchos y herramientas
    R(g, '#2a2030', 118, 16, 404, 4); R(g, '#46525f', 118, 16, 404, 1);
    [[150, 40, 0], [196, 56, 1], [244, 32, 2], [390, 44, 3], [440, 58, 1], [486, 36, 0]].forEach(function (h) {
      chain(g, h[0], 20, 20 + h[1], '#3c4654');
      var yb = 20 + h[1];
      if (h[2] === 0) { line(g, '#8797a8', h[0], yb, h[0], yb + 6); line(g, '#8797a8', h[0], yb + 6, h[0] + 4, yb + 9); line(g, '#8797a8', h[0] + 4, yb + 9, h[0] + 6, yb + 6); }
      else if (h[2] === 1) { R(g, '#6b4426', h[0] - 1, yb, 3, 10); poly(g, '#8797a8', [[h[0] - 6, yb + 10], [h[0] + 6, yb + 10], [h[0] + 5, yb + 28], [h[0] - 3, yb + 30]]); R(g, '#b9c5d0', h[0] - 5, yb + 10, 1, 18); }
      else if (h[2] === 2) { R(g, '#6b4426', h[0] - 2, yb, 5, 8); R(g, '#8797a8', h[0] - 1, yb + 8, 3, 26); for (i = 0; i < 12; i++) P(g, '#b9c5d0', h[0] + 2, yb + 10 + i * 2); }
      else { disc(g, h[0], yb + 6, 5, 5, function (nx, ny, d) { return d > 0.5 ? '#8797a8' : null; }); }
    });
    // suelo de losas
    floorPersp(g, 250, 360, 320, ['#140f19', '#09070c'], '#0c0910', '#0c0910', 5, 9, 50, 130);
    // losa de piedra central
    poly(g, '#0a070c', [[208, 262], [432, 262], [470, 300], [170, 300]]);
    poly(g, '#3a3a46', [[212, 264], [428, 264], [462, 298], [178, 298]]);
    poly(g, '#4e4e5c', [[216, 266], [424, 266], [452, 280], [188, 280]]);
    R(g, '#22222c', 170, 298, 300, 16); R(g, '#34343f', 170, 298, 300, 2);
    R(g, '#7a1420', 296, 270, 18, 3); R(g, '#7a1420', 300, 273, 10, 3); R(g, C.blood, 350, 272, 8, 2); R(g, C.blood, 306, 298, 3, 10); R(g, '#7a1420', 306, 308, 3, 4); P(g, C.bloodHi, 306, 299);
    disc(g, 308, 322, 26, 5, function (nx, ny, d) { return d > 0.6 ? '#3a0a10' : '#5a0f16'; });
    R(g, '#22222c', 184, 314, 18, 28); R(g, '#22222c', 438, 314, 18, 28);
    // foco de luz
    g.save(); g.globalCompositeOperation = 'lighter';
    g.drawImage(coneCv(340, 300, 26, 330, 0, '#8a7a5a', 0.6), 150, 0);
    g.drawImage(glowCv(170, 26, '#4a3a22', 0.8, 1.0), 320 - 170, 290 - 26);
    g.restore();
    vignette(g, 1);
    veil(g, 320, 170, 170, 90, '#050306', 0.3);
    var cone = coneCv(340, 300, 26, 330, 0, '#ffe2a8', 0.3), wick = glowCv(12, 12, '#ffe2a8', 0.9, 1.0);
    BD.harvest = {
      img: c,
      live: function (g2, t) {
        var fl = 0.75 + 0.25 * Math.sin(t * 6.3) * Math.sin(t * 2.9 + 1) + 0.1 * Math.sin(t * 19);
        blit(g2, cone, 320, 150, 'lighter', 0.6 * fl);
        blit(g2, wick, 320, 6, 'lighter', fl);
        motes(g2, t, 24, 210, 430, 20, 290, '#fff0c8', 5, 0.03);
        drip(g2, t, 150, 62, 320, 4.2, 0.4, '#a3202a'); drip(g2, t, 440, 78, 322, 5.6, 1.9, '#a3202a');
        bubbles(g2, t, 10, 110, 96, 70, 4, 3); bubbles(g2, t, 530, 630, 156, 130, 4, 12); bubbles(g2, t, 530, 630, 216, 190, 4, 21);
      }
    };
  }

  /* ---------- Fondo: códice (planos) ---------- */
  function buildCodex() {
    var c = cv(640, 360), g = gx(c), i, x, y;
    vgrad(g, 0, 0, 640, 360, [[0, '#121a2c'], [1, '#0b1020']]);
    for (x = 0; x < 640; x += 8) R(g, x % 40 ? '#151e34' : '#1d2a4a', x, 0, 1, 360);
    for (y = 0; y < 360; y += 8) R(g, y % 40 ? '#151e34' : '#1d2a4a', 0, y, 640, 1);
    // hombre de Vitruvio anatómico muy tenue
    var L = '#1e2c52';
    function ring(cx, cy, r) { var a; for (a = 0; a < 6.283; a += 0.5 / r) P(g, L, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)); }
    ring(320, 182, 150); ring(320, 182, 110); R(g, L, 214, 76, 212, 1); R(g, L, 214, 288, 212, 1); R(g, L, 214, 76, 1, 212); R(g, L, 426, 76, 1, 212);
    ring(320, 120, 16); line2(g, L, 320, 136, 320, 210); line2(g, L, 320, 146, 236, 166); line2(g, L, 320, 146, 404, 166);
    line2(g, L, 320, 210, 270, 290); line2(g, L, 320, 210, 370, 290); line2(g, L, 320, 100, 320, 60); line2(g, L, 170, 182, 470, 182);
    for (i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; line2(g, '#182446', 320 + Math.cos(a) * 150, 182 + Math.sin(a) * 150, 320 + Math.cos(a) * 158, 182 + Math.sin(a) * 158); }
    // pergaminos con bocetos
    var sheets = [[12, 26, 104, 132, -2, 0], [520, 20, 108, 118, 2, 1], [20, 196, 92, 112, 2, 2], [528, 208, 98, 116, -2, 3], [228, 4, 76, 40, 1, 4], [352, 306, 90, 46, -1, 5]];
    sheets.forEach(function (sh) {
      var x0 = sh[0], y0 = sh[1], w = sh[2], h = sh[3], sk = sh[4];
      poly(g, '#0a0810', [[x0 + 3, y0 + 3], [x0 + w + 3, y0 + 3 + sk], [x0 + w + 3, y0 + h + 3 + sk], [x0 + 3, y0 + h + 3]]);
      poly(g, '#5a5038', [[x0, y0], [x0 + w, y0 + sk], [x0 + w, y0 + h + sk], [x0, y0 + h]]);
      poly(g, '#6e6346', [[x0 + 2, y0 + 2], [x0 + w - 2, y0 + 2 + sk], [x0 + w - 2, y0 + h - 2 + sk], [x0 + 2, y0 + h - 2]]);
      var ink = '#2a2216', cx2 = x0 + w / 2, cy2 = y0 + h / 2 + 4;
      var paper = '#6e6346';
      function hollow(hx, hy, hw, hh) { R(g, ink, hx, hy, hw, hh); R(g, paper, hx + 1, hy + 1, hw - 2, hh - 2); }
      if (sh[5] === 0) {                                   // mano
        hollow(cx2 - 9, cy2 - 2, 18, 16);
        [[-9, 12], [-4, 16], [1, 15], [6, 11]].forEach(function (f) { hollow(cx2 + f[0], cy2 - 2 - f[1], 5, f[1] + 2); });
        hollow(cx2 - 15, cy2 + 2, 7, 5); line2(g, ink, cx2 - 6, cy2 + 14, cx2 - 6, cy2 + 24); line2(g, ink, cx2 + 4, cy2 + 14, cx2 + 4, cy2 + 24);
      }
      else if (sh[5] === 1) { ring2(cx2, cy2, 22); ring2(cx2, cy2, 10); for (var k = 0; k < 10; k++) { var aa = k / 10 * 6.283; line2(g, ink, cx2 + Math.cos(aa) * 22, cy2 + Math.sin(aa) * 22, cx2 + Math.cos(aa) * 28, cy2 + Math.sin(aa) * 28); } }
      else if (sh[5] === 2) {                              // cráneo
        disc(g, cx2, cy2 - 8, 15, 14, function (nx, ny, d) { return d > 0.82 ? ink : paper; });
        hollow(cx2 - 8, cy2 + 4, 16, 10); R(g, ink, cx2 - 9, cy2 - 12, 6, 6); R(g, ink, cx2 + 4, cy2 - 12, 6, 6); R(g, ink, cx2 - 1, cy2 - 4, 3, 4);
        for (var tt = -6; tt <= 6; tt += 3) R(g, ink, cx2 + tt, cy2 + 6, 1, 7);
      }
      else if (sh[5] === 3) { line2(g, ink, cx2 - 20, cy2 + 24, cx2 + 18, cy2 - 26); R(g, ink, cx2 - 24, cy2 + 22, 6, 5); R(g, ink, cx2 + 16, cy2 - 30, 6, 5); line2(g, ink, cx2 - 10, cy2 + 10, cx2 + 14, cy2 + 10); line2(g, ink, cx2 - 14, cy2 - 14, cx2 - 4, cy2 - 4); }
      for (var ln = 0; ln < 3; ln++) R(g, '#4a4028', x0 + 8, y0 + h - 18 + ln * 5, w - 16 - ((ln * 13) % 20), 1);
      R(g, '#a3202a', Math.round(cx2 - 1), y0 + 2, 3, 3); R(g, C.bloodHi, Math.round(cx2 - 1), y0 + 2, 1, 1);
    });
    function ring2(cx, cy, r) { var a; for (a = 0; a < 6.283; a += 0.6 / r) P(g, '#2a2216', Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)); }
    // cuerdas entre pergaminos
    line2(g, '#2a2034', 118, 40, 228, 12); line2(g, '#2a2034', 308, 12, 520, 30);
    // farol
    g.save(); g.globalCompositeOperation = 'lighter';
    g.drawImage(glowCv(180, 140, '#2a1c0a', 0.8, 1.3), 100 - 180, 20 - 140);
    g.drawImage(glowCv(160, 120, '#0e1c2a', 0.8, 1.3), 540 - 160, 350 - 120);
    g.restore();
    vignette(g, 0.8);
    veil(g, 320, 182, 180, 120, '#060a14', 0.28);
    var setG = gearSet(40, 12, 6, 12, { base: '#26345a', hi: '#3c4e80', lo: '#182040', edge: '#0c1226' });
    var dust = glowCv(26, 26, '#ffb860', 0.55, 1.1);
    BD.codex = {
      img: c,
      live: function (g2, t) {
        drawGear(g2, setG, 60, 340, t * 0.2, 0.8); drawGear(g2, setG, 590, 330, -t * 0.16, 0.8);
        blit(g2, dust, 100, 18, 'lighter', 0.5 * (0.75 + 0.25 * Math.sin(t * 7.1) * Math.sin(t * 2.3)));
        motes(g2, t, 34, 20, 620, 20, 340, '#7fd6e6', 15, 0.035);
        motes(g2, t, 14, 20, 620, 20, 340, '#e8c23a', 31, 0.025);
      }
    };
  }

  /* ---------- Fondo: tienda del alquimista ---------- */
  function bottle(g, cx, yb, w, h, liq, shape) {
    var y = yb - h;
    R(g, '#0a0c10', cx - (w >> 1) - 1, y + 5, w + 2, h - 4);
    if (shape) disc(g, cx, yb - w / 2 - 1, w / 2 + 1, w / 2 + 1, function (nx, ny, d) { return d > 0.75 ? dk(liq, 0.45) : (nx + ny < -0.3 ? lit(liq, 0.4) : liq); });
    R(g, dk(liq, 0.25), cx - (w >> 1), y + 6, w, h - 7); R(g, liq, cx - (w >> 1) + 1, y + 8, w - 2, h - 10);
    R(g, lit(liq, 0.5), cx - (w >> 1) + 1, y + 8, 1, h - 10);
    R(g, '#9ec4c4', cx - 1, y + 1, 3, 5); R(g, '#7a4a26', cx - 2, y - 1, 5, 3);
  }
  function buildShop() {
    var c = cv(640, 360), g = gx(c), rnd = DD.mulberry32(91), i, x, y;
    R(g, '#1f130d', 0, 0, 640, 360);
    for (x = 120; x < 520; x += 40) for (y = 40; y < 300; y += 40) { poly(g, '#26170f', [[x + 20, y], [x + 40, y + 20], [x + 20, y + 40], [x, y + 20]]); poly(g, '#1a0f09', [[x + 20, y + 4], [x + 36, y + 20], [x + 20, y + 36], [x + 4, y + 20]]); }
    // cortinajes
    [[0, 128, 1], [512, 640, -1]].forEach(function (cu) {
      for (x = cu[0]; x < cu[1]; x++) {
        var f = Math.sin((x - cu[0]) * 0.34) * 0.5 + 0.5, hh = 210 + (cu[2] > 0 ? (cu[1] - x) * 0.25 : (x - cu[0]) * 0.25);
        R(g, mix('#200a10', '#5a1822', f * 0.8), x, 0, 1, hh);
      }
    });
    // armarios de vidrio con botellas
    [[14, 106], [526, 106]].forEach(function (cab) {
      var x0 = cab[0], w = cab[1];
      R(g, '#0d0806', x0, 54, w, 196); R(g, '#4a2e18', x0 - 4, 50, w + 8, 6); R(g, '#4a2e18', x0 - 4, 250, w + 8, 6);
      R(g, '#4a2e18', x0 - 4, 50, 4, 206); R(g, '#4a2e18', x0 + w, 50, 4, 206);
      [110, 160, 210, 248].forEach(function (yy, r) {
        var xx = x0 + 12;
        while (xx < x0 + w - 12) {
          var bw = 10 + ((rnd() * 6) | 0), bh = 26 + ((rnd() * 12) | 0), liq = ['#a3202a', '#2f8a4a', '#3f8fa6', '#7a4a9a', '#b8842f', '#c2391f'][(rnd() * 6) | 0];
          bottle(g, xx + (bw >> 1), yy, bw, Math.min(bh, yy - 58 - (r ? 0 : 0)), liq, rnd() < 0.5);
          xx += bw + 6;
        }
        R(g, '#4a2e18', x0, yy, w, 4); R(g, '#6a4426', x0, yy, w, 1);
      });
      poly(g, 'rgba(255,255,255,0.05)', [[x0 + 6, 56], [x0 + 26, 56], [x0 + 6, 120]]);
    });
    // riel con balanza y hierbas secas
    R(g, BR.dk, 130, 14, 380, 5); R(g, BR.mid, 130, 14, 380, 1);
    for (i = 0; i < 7; i++) { var hx = 150 + i * 48; chain(g, hx, 19, 34 + (i % 3) * 8, '#3c2a1a'); R(g, '#4a5a2a', hx - 3, 34 + (i % 3) * 8, 7, 12); R(g, '#3a4a20', hx - 2, 46 + (i % 3) * 8, 5, 6); }
    // mostrador
    R(g, '#2a1a10', 0, 300, 640, 60); R(g, '#5a3a22', 0, 296, 640, 8); R(g, '#7a5232', 0, 296, 640, 1); R(g, BR.dk, 0, 304, 640, 3); R(g, BR.mid, 0, 304, 640, 1);
    for (x = 0; x < 640; x += 64) R(g, '#1f130d', x, 308, 2, 52);
    // objetos sobre el mostrador
    disc(g, 70, 286, 9, 9, function (nx, ny, d) { return d > 0.8 ? '#8a7f6a' : (nx + ny < -0.3 ? '#e8dcc0' : '#b9ad94'); }); R(g, '#0a0709', 65, 283, 3, 3); R(g, '#0a0709', 72, 283, 3, 3); R(g, '#8a7f6a', 67, 291, 7, 4);
    R(g, '#e8dcc0', 168, 272, 7, 22); R(g, '#b9ad94', 172, 272, 3, 22); R(g, '#e8dcc0', 168, 270, 7, 3);
    disc(g, 570, 288, 11, 7, function (nx, ny) { return ny < -0.2 ? '#56636f' : '#3c4654'; }); R(g, '#8797a8', 558, 281, 24, 2); line(g, '#b08a3a', 580, 270, 574, 288);
    for (i = 0; i < 4; i++) R(g, i % 2 ? BR.mid : BR.hi, 476, 290 - i * 3, 14, 3);
    g.save(); g.globalCompositeOperation = 'lighter';
    [[70, 130], [570, 130]].forEach(function (p) { g.drawImage(glowCv(90, 110, '#2a1a30', 0.8, 1.2), p[0] - 90, p[1] - 110 + 30); });
    g.drawImage(glowCv(110, 50, '#5a3010', 0.8, 1.2), 171 - 110, 266 - 50);
    g.drawImage(glowCv(200, 60, '#3a2208', 0.8, 1.1), 320 - 200, 306 - 60);
    g.restore();
    vignette(g, 0.9);
    veil(g, 320, 175, 185, 115, '#0a0508', 0.3);
    var flame = glowCv(26, 26, '#ffb860', 0.7, 1.1), sweep = coneCv(40, 210, 10, 10, 30, '#ffffff', 0.12);
    BD.shop = {
      img: c,
      live: function (g2, t) {
        var fl = 0.75 + 0.25 * Math.sin(t * 8.1) * Math.sin(t * 3.7);
        flameRow(g2, 169, 174, 271, 7 * fl + 2, t, 2.2); blit(g2, flame, 171, 266, 'lighter', 0.6 * fl);
        var sa = Math.sin(t * 0.9) * 0.25;                               // balanza que se mece
        line2(g2, BR.mid, 320, 19, 320, 30); R(g2, BR.mid, 319, 30, 3, 3);
        var bx = Math.cos(sa) * 26, by = Math.sin(sa) * 26;
        line2(g2, BR.hi, 320 - bx, 32 - by, 320 + bx, 32 + by);
        [-1, 1].forEach(function (sd) {
          var ex = 320 + sd * bx, ey = 32 + sd * by;
          line2(g2, '#7a5c22', ex, ey, ex - 7, ey + 14); line2(g2, '#7a5c22', ex, ey, ex + 7, ey + 14);
          R(g2, BR.mid, Math.round(ex - 9), Math.round(ey + 14), 18, 2); R(g2, BR.lo, Math.round(ex - 7), Math.round(ey + 16), 14, 1);
        });
        bubbles(g2, t, 20, 100, 248, 200, 4, 4); bubbles(g2, t, 532, 626, 246, 200, 4, 13);
        var sx = ((t * 40) % 420) - 60;                                   // destello que cruza el cristal
        g2.save(); g2.globalCompositeOperation = 'lighter'; g2.drawImage(sweep, Math.round(sx - 20), 50); g2.restore();
        motes(g2, t, 18, 140, 500, 30, 290, '#ffd98a', 21, 0.03);
      }
    };
  }

  /* ---------- Fondo: muerte ---------- */
  function buildDeath() {
    var c = cv(640, 360), g = gx(c), i, x, y;
    vgrad(g, 0, 0, 640, 360, [[0, '#050308'], [0.6, '#0b060c'], [1, '#1c0a0c']]);
    // reloj parado y roto (muy tenue)
    disc(g, 320, 150, 80, 80, function (nx, ny, d) { return d > 0.92 ? '#2a1c12' : (d > 0.82 ? '#3a2a16' : '#120c12'); });
    for (i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; line2(g, '#2a1c14', 320 + Math.cos(a) * 62, 150 + Math.sin(a) * 62, 320 + Math.cos(a) * 72, 150 + Math.sin(a) * 72); }
    line2(g, '#2a1c14', 320, 150, 320, 98); line2(g, '#2a1c14', 320, 150, 320, 90);
    line2(g, '#0a0508', 280, 108, 322, 152); line2(g, '#0a0508', 322, 152, 362, 210 - 50); line2(g, '#0a0508', 322, 152, 290, 196); line2(g, '#0a0508', 322, 152, 372, 138);
    // ruinas
    for (x = 0; x < 640; x += 6) { y = 318 - ((Math.sin(x * 0.03) * 10 + hash(x) * 14) | 0); R(g, '#050306', x, y, 6, 360 - y); }
    poly(g, '#050306', [[96, 340], [110, 268], [122, 286], [134, 250], [148, 340]]);
    poly(g, '#050306', [[470, 340], [486, 282], [498, 262], [506, 300], [520, 340]]);
    [[60, 346], [200, 340], [560, 344]].forEach(function (p) { R(g, '#0c0609', p[0], p[1], 40, 14); });
    g.save(); g.globalCompositeOperation = 'lighter';
    g.drawImage(glowCv(260, 70, '#3a0c0c', 0.85, 1.0), 320 - 260, 330 - 70);
    g.restore();
    vignette(g, 1);
    var setD = gearSet(64, 18, 6, 12, { base: '#140e14', hi: '#1f1520', lo: '#0a060a', edge: '#050306' });
    var red = glowCv(230, 60, '#8a1a10', 0.6, 1.0);
    BD.death = {
      img: c,
      live: function (g2, t) {
        drawGear(g2, setD, 40, 330, t * 0.03, 1); drawGear(g2, setD, 610, 120, -t * 0.025, 1);
        blit(g2, red, 320, 326, 'lighter', 0.55 + 0.3 * Math.sin(t * 1.3) * Math.sin(t * 0.6));
        [[104, 338], [134, 338], [490, 336], [510, 338]].forEach(function (p, k) { flameRow(g2, p[0] - 5, p[0] + 6, p[1], 7 + 4 * Math.sin(t * 5 + k), t, k * 3.1); });
        embers(g2, t, { x0: 40, x1: 600, y: 350, n: 46, rise: 14, life: 9, drift: 3, sway: 10, seed: 3 });
        g2.globalAlpha = 0.5; embers(g2, t + 3, { x0: 0, x1: 640, y: 360, n: 26, rise: 10, life: 12, drift: -3, sway: 14, seed: 40 }); g2.globalAlpha = 1;
      }
    };
  }

  /* ---------- Fondo: victoria (amanecer) ---------- */
  function hills(g, baseY, amp, col, seed, f1, f2) {
    for (var x = 0; x < 640; x++) {
      var y = Math.round(baseY - (Math.sin(x * f1 + seed) * 0.6 + Math.sin(x * f2 + seed * 2.3) * 0.4) * amp);
      R(g, col, x, y, 1, 360 - y);
    }
  }
  function buildWin() {
    var c = cv(640, 360), g = gx(c), rnd = DD.mulberry32(111), x, y;
    vgrad(g, 0, 0, 640, 340, [[0, '#14143c'], [0.26, '#3c2a6a'], [0.48, '#9a4a7a'], [0.66, '#e8805a'], [0.81, '#ffc878'], [0.88, '#ffe6a0'], [1, '#ffe6a0']], 36);
    stars(g, rnd, 50, 0, 90, ['#b9b0d8', '#8a80b0', '#e8dcc0']);
    g.drawImage(glowCv(220, 160, '#ffb860', 0.7, 1.3), 190 - 220, 290 - 160);
    disc(g, 190, 292, 38, 38, function (nx, ny, d) { return d > 0.82 ? '#ffd98a' : (d > 0.4 ? '#fff0b8' : '#fffbe6'); });
    [[60, 20, 160, 26, 1], [300, 60, 180, 30, 2], [470, 30, 150, 24, 3], [110, 132, 200, 28, 4], [380, 150, 210, 30, 5]].forEach(function (cl) {
      cloud(g, cl[0], cl[1], cl[2], cl[3], cl[4] * 7, '#5a3a78', '#ffb878');
    });
    hills(g, 300, 18, '#6a4a7a', 1.2, 0.011, 0.027); hills(g, 318, 16, '#4a3468', 3.1, 0.015, 0.033);
    // torre calcinada al fondo
    x = 500; y = 318;
    poly(g, '#2a1c40', [[x - 26, y], [x - 21, y - 96], [x - 13, y - 104], [x - 8, y - 93], [x - 2, y - 113], [x + 4, y - 98], [x + 12, y - 106], [x + 17, y - 92], [x + 22, y - 98], [x + 27, y]]);
    poly(g, '#20153a', [[x + 14, y], [x + 14, y - 92], [x + 22, y - 98], [x + 27, y]]);
    disc(g, x, y - 72, 10, 10, function (nx, ny, d) { return d > 0.6 ? '#7a5a40' : '#3a2a30'; });
    line2(g, '#1a1030', x - 6, y - 76, x + 2, y - 70); line2(g, '#1a1030', x + 2, y - 70, x + 5, y - 80);
    [y - 52, y - 28].forEach(function (wy) { archFill(g, '#150d28', x, 8, 6, wy, wy - 10, wy + 8); P(g, '#ff9a2e', x, wy + 4); P(g, '#c2391f', x + 1, wy + 3); });
    R(g, '#1a1030', x - 30, y - 6, 60, 6);
    hills(g, 338, 12, '#241a3c', 5.2, 0.02, 0.05);
    for (x = 0; x < 640; x += 3) { y = 346 - ((hash(x * 0.3) * 10) | 0); R(g, '#100a20', x, y, 3, 360 - y); }
    g.save(); g.globalCompositeOperation = 'lighter';
    g.drawImage(glowCv(300, 120, '#5a2a10', 0.9, 1.1), 190 - 300, 290 - 120);
    g.restore();
    vignette(g, 0.55);
    veil(g, 320, 175, 185, 115, '#14103a', 0.22);
    var clouds = [];
    [[120, 26, 1], [90, 22, 2], [140, 30, 3], [100, 24, 4]].forEach(function (cl) {
      var cc = cv(cl[0], cl[1]), cg = gx(cc);
      cloud(cg, 0, 0, cl[0], cl[1], cl[2] * 13, '#7a4a80', '#ffc890'); clouds.push(cc);
    });
    var smoke = glowCv(10, 8, '#3a2a48', 0.6, 0.6), rays = glowCv(260, 260, '#ffc070', 0.22, 0.7);
    BD.win = {
      img: c,
      live: function (g2, t) {
        for (var k = 0; k < 4; k++) g2.drawImage(clouds[k], Math.round(((t * (2 + k * 1.3) + k * 190) % 820) - 170), 40 + k * 34);
        var sh = 0.8 + 0.2 * Math.sin(t * 0.8);
        blit(g2, rays, 190, 292, 'lighter', 0.6 * sh);
        g2.save(); g2.globalCompositeOperation = 'lighter';
        for (var r = 0; r < 7; r++) {
          var ang = -Math.PI * (0.1 + r * 0.13) + Math.sin(t * 0.3 + r) * 0.03, a0 = ang - 0.035, a1 = ang + 0.035;
          g2.fillStyle = 'rgba(255,200,120,' + (0.05 + 0.03 * Math.sin(t * 0.7 + r * 2)) + ')';
          g2.beginPath(); g2.moveTo(190, 292); g2.lineTo(190 + Math.cos(a0) * 420, 292 + Math.sin(a0) * 420); g2.lineTo(190 + Math.cos(a1) * 420, 292 + Math.sin(a1) * 420); g2.closePath(); g2.fill();
        }
        g2.restore();
        for (var s = 0; s < 5; s++) { var ph = (t * 0.06 + s / 5) % 1; blit(g2, smoke, 500 + ph * 30 + Math.sin(s + t) * 3, 228 - ph * 70, null, 0.8 * Math.sin(ph * Math.PI)); }
        for (var b = 0; b < 3; b++) {           // aves lejanas
          var bx = ((t * (14 + b * 3) + b * 210) % 760) - 60, by = 70 + b * 22 + Math.sin(t * 0.9 + b) * 4, fl = Math.floor(t * 4 + b) % 2;
          P(g2, '#2a1c40', bx, by); P(g2, '#2a1c40', bx - 1, by - fl); P(g2, '#2a1c40', bx - 2, by - 1 - fl); P(g2, '#2a1c40', bx + 1, by - fl); P(g2, '#2a1c40', bx + 2, by - 1 - fl);
        }
        embers(g2, t, { x0: 492, x1: 510, y: 228, n: 6, rise: 14, life: 6, drift: 6, sway: 4, seed: 7 });
      }
    };
  }

  // Los fondos se pintan la primera vez que se piden (el de título, en init); luego quedan en caché
  var BUILD = {
    title: buildTitle, table: buildTable, harvest: buildHarvest, codex: buildCodex, shop: buildShop, death: buildDeath, win: buildWin,
    combat0: buildCombat0, combat1: buildCombat1, combat2: buildCombat2
  };
  function ensure(name) {
    var f = Object.prototype.hasOwnProperty.call(BUILD, name) ? BUILD[name] : null;
    if (f) { BUILD[name] = null; f(); }
  }

  S.backdrop = function (ctx, key, t) {
    if (!ready) S.init();
    var b;
    if (key === 'combat') { ensure('combat' + theme); b = BDC[theme]; }
    else { ensure(key); b = BD[key]; }
    if (t == null) t = DD.time || 0;
    if (!b) { ctx.fillStyle = C.bg; ctx.fillRect(0, 0, DD.W, DD.H); return; }
    ctx.drawImage(b.img, 0, 0);
    if (b.live) { ctx.save(); b.live(ctx, t); ctx.restore(); }
  };
})();
