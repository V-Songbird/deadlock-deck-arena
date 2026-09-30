/* Deadlock Deck: El Reloj Anatómico — chars.js (W7)
 * Personajes: la abominación (pequeña y grande), los 10 enemigos, iconos de extremidades y muñones.
 * Extiende DD.Sprites (lo crea sprites.js). Todo es procedural y se construye y cachea la primera vez que se usa.
 * Convención de orientación: jugador y sprites grandes de enemigo miran a la IZQUIERDA (enemigo) / DERECHA (jugador);
 * los enemigos pequeños 16×16 miran a la DERECHA y `flip` los vuelve hacia la izquierda.
 */
(function () {
  'use strict';
  var DD = window.DD;
  var S = DD.Sprites = DD.Sprites || {};
  var C = DD.C;

  var OL = '#14101b';   // contorno
  var M = 3;            // margen de los lienzos de extremidad (contorno 1 + halo 2)

  /* ---------- Materiales [base, luz, sombra] ---------- */
  var MAT = {
    brass: [C.brass, '#e9cb76', C.brassDk],
    copper: [C.copper, '#e89356', '#7d3c1a'],
    steel: [C.steel, '#bccad9', C.steelDk],
    iron: ['#56626f', '#8b99a8', '#2b323c'],
    bone: [C.bone, '#f4ecd6', '#a39879'],
    leather: ['#6b4f3a', '#8f6d50', '#3d2a1c'],
    rag: ['#5a4632', '#7a6045', '#3a2c1e'],
    cloth: ['#55677a', '#7b90a6', '#34404e'],
    fur: ['#85705a', '#a48d72', '#54463a'],
    furLt: ['#b39c7e', '#d6c3a2', '#7a6a58'],
    scale: ['#c4461e', '#ff7a2a', '#7c2412'],
    stone: ['#7b7468', '#a39b8a', '#4d473f'],
    plum: ['#7a3f8c', '#b478c8', '#45224f'],
    wood: ['#6e4a2c', '#94683f', '#3f2916'],
    rubber: ['#2c2a33', '#4a4756', '#17151c']
  };

  /* ---------- Primitivas de dibujo ---------- */
  function own(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null; }   // ids raros como 'constructor' no deben colarse
  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { c: c, g: g, w: w, h: h };
  }
  function R(g, col, x, y, w, h) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  function P(g, col, x, y) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  // óvalo relleno; (cx,cy) es el centro en coordenadas de celda (puede ser x.5)
  function ov(g, col, cx, cy, rx, ry) {
    ry = ry || rx;
    g.fillStyle = col;
    for (var y = Math.floor(cy - ry); y < Math.ceil(cy + ry); y++) {
      for (var x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++) {
        var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
      }
    }
  }
  function lineCells(x0, y0, x1, y1) {
    var out = [], dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx - dy;
    for (;;) {
      out.push([x0, y0]);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e;
      if (e2 > -dy) { e -= dy; x0 += sx; }
      if (e2 < dx) { e += dx; y0 += sy; }
    }
    return out;
  }
  // línea de grosor t (cuadrados t×t centrados)
  function tline(g, col, x0, y0, x1, y1, t) {
    var c = lineCells(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)), o = Math.floor((t - 1) / 2);
    g.fillStyle = col;
    for (var i = 0; i < c.length; i++) g.fillRect(c[i][0] - o, c[i][1] - o, t, t);
  }
  function poly(g, col, p) {
    var miny = 1e9, maxy = -1e9, i;
    for (i = 0; i < p.length; i++) { miny = Math.min(miny, p[i][1]); maxy = Math.max(maxy, p[i][1]); }
    g.fillStyle = col;
    for (var y = Math.floor(miny); y < Math.ceil(maxy); y++) {
      var yy = y + 0.5, xs = [];
      for (i = 0; i < p.length; i++) {
        var a = p[i], b = p[(i + 1) % p.length];
        if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) xs.push(a[0] + (yy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort(function (u, v) { return u - v; });
      for (i = 0; i + 1 < xs.length; i += 2) {
        var x0 = Math.round(xs[i]), x1 = Math.round(xs[i + 1]);
        if (x1 > x0) g.fillRect(x0, y, x1 - x0, 1);
      }
    }
  }
  // caja sombreada con material m=[base,luz,sombra]: luz arriba/izquierda, sombra abajo/derecha
  function box(g, m, x, y, w, h) {
    R(g, m[0], x, y, w, h);
    if (w > 2 && h > 1) { R(g, m[1], x, y, 1, h - 1); R(g, m[2], x + w - 1, y, 1, h); }
    if (h > 2 && w > 1) { R(g, m[1], x, y, w - 1, 1); R(g, m[2], x, y + h - 1, w, 1); }
  }
  function paint(g, rows, pal, x, y, flip) {     // mapa de caracteres; '.' y desconocidos = transparente
    for (var j = 0; j < rows.length; j++) {
      var row = rows[j];
      for (var i = 0; i < row.length; i++) {
        var col = pal[row.charAt(i)];
        if (col) { g.fillStyle = col; g.fillRect(x + (flip ? row.length - 1 - i : i), y + j, 1, 1); }
      }
    }
  }
  function silh(src, col) {
    var o = mk(src.width, src.height);
    o.g.drawImage(src, 0, 0);
    o.g.globalCompositeOperation = 'source-in';
    o.g.fillStyle = col; o.g.fillRect(0, 0, o.w, o.h);
    return o.c;
  }
  function outline(o, col) {     // contorno de 1 px (4 vecinos) por detrás
    var s = silh(o.c, col), g = o.g;
    g.globalCompositeOperation = 'destination-over';
    g.drawImage(s, -1, 0); g.drawImage(s, 1, 0); g.drawImage(s, 0, -1); g.drawImage(s, 0, 1);
    g.globalCompositeOperation = 'source-over';
  }
  function dilate(src, col, r) {
    var s = silh(src, col), o = mk(src.width, src.height);
    for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) if (x * x + y * y <= r * r + 1) o.g.drawImage(s, x, y);
    return o.c;
  }
  function hexRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixc(a, b, t) {
    var p = hexRgb(a), q = hexRgb(b), o = '#';
    for (var i = 0; i < 3; i++) { var v = Math.round(p[i] + (q[i] - p[i]) * t); o += (v < 16 ? '0' : '') + v.toString(16); }
    return o;
  }
  // tinte de destello sobre lo ya dibujado en g (rojo suave → blanco)
  function tint(g, w, h, f) {
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = Math.min(1, f * 0.75); g.fillStyle = '#ff3a30'; g.fillRect(0, 0, w, h);
    if (f > 0.4) { g.globalAlpha = Math.min(1, (f - 0.4) * 1.5); g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  // costura: herida oscura con puntadas cruzadas del color de las puntadas del cosmético
  function seam(g, k, pts) {
    var cells = [], i;
    for (i = 0; i + 1 < pts.length; i++) {
      var seg = lineCells(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      var vert = Math.abs(pts[i + 1][1] - pts[i][1]) >= Math.abs(pts[i + 1][0] - pts[i][0]);
      for (var j = (i ? 1 : 0); j < seg.length; j++) cells.push([seg[j][0], seg[j][1], vert]);
    }
    for (i = 0; i < cells.length; i++) P(g, '#1c1117', cells[i][0], cells[i][1]);
    for (i = 1; i < cells.length; i += 2) {
      var c = cells[i];
      if (c[2]) { P(g, k.st, c[0] - 1, c[1]); P(g, k.st, c[0] + 1, c[1]); } else { P(g, k.st, c[0], c[1] - 1); P(g, k.st, c[0], c[1] + 1); }
    }
  }
  function seamH(g, k, x0, x1, y) { seam(g, k, [[x0, y], [x1, y]]); }
  function seamV(g, k, x, y0, y1) { seam(g, k, [[x, y0], [x, y1]]); }

  /* ---------- Cosméticos (DD.save.equip + DD.COSMETICS, con valores por defecto) ---------- */
  var DEF = { skin: ['#b3bca0', '#7c876b', '#d3dbbe'], stitch: ['#c0392b'], eyes: ['#6fe06f', '#eaffea'] };
  var HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
  var cosCache = {};
  function cosColors(cat, id) {
    var list = DD.COSMETICS && DD.COSMETICS[cat], c = null, d = DEF[cat], out = [], i;
    if (list && list.length) {
      c = list[0].c;
      for (i = 0; i < list.length; i++) if (list[i].id === id) { c = list[i].c; break; }
    }
    for (i = 0; i < d.length; i++) out.push(c && typeof c[i] === 'string' && HEX.test(c[i]) ? c[i] : d[i]);
    return out;
  }
  function cosmetics(eq) {
    eq = eq || (DD.save && DD.save.equip) || {};
    var sk = cosColors('skin', eq.skin), st = cosColors('stitch', eq.stitch), ey = cosColors('eyes', eq.eyes);
    var key = sk.join() + st.join() + ey.join();
    return cosCache[key] || (cosCache[key] = { sk: sk, sm: [sk[0], sk[2], sk[1]], st: st[0], ey: ey, key: key });
  }

  /* ====================================================================== */
  /*  ABOMINACIÓN GRANDE: cada hueco se dibuja según su extremidad           */
  /*  Los pintores usan coordenadas locales al pivote de la pieza:            */
  /*  cabeza/torso → centro de la base del cuello; brazo → hombro; pierna → cadera. */
  /* ====================================================================== */
  var TORSO_ROWS = 26;
  function torsoW(y) {      // [x0, x1] de la silueta del torso en la fila y
    if (y === 0) return [-10, 9];
    if (y < 4) return [-12, 11];
    if (y < 16) return [-11, 10];
    if (y < 22) return [-10, 9];
    return [-9, 8];
  }
  function torsoBase(g, m) {
    for (var y = 0; y < TORSO_ROWS; y++) {
      var w = torsoW(y);
      R(g, m[0], w[0], y, w[1] - w[0] + 1, 1);
      P(g, m[1], w[0], y); P(g, m[2], w[1], y);
    }
    R(g, m[2], torsoW(TORSO_ROWS - 1)[0], TORSO_ROWS - 1, 18, 1);
  }
  function eye3(g, k, x, y) {         // ojo 3×2 en (x,y) con cuenca; estados: open|attack|hurt|dead
    var s = k.state;
    if (s === 'dead') {
      R(g, OL, x, y, 1, 1); R(g, OL, x + 2, y, 1, 1); R(g, OL, x + 1, y + 1, 1, 1); R(g, OL, x, y + 2, 1, 1); R(g, OL, x + 2, y + 2, 1, 1);
      return;
    }
    R(g, '#241a26', x - 1, y - 1, 5, 4);
    if (s === 'hurt') { R(g, k.ey[0], x, y + 1, 3, 1); return; }
    R(g, k.ey[0], x, y, 3, 2);
    P(g, k.ey[1], x, y);
    if (s === 'attack') P(g, k.ey[1], x + 2, y);
  }
  function neckPiece(g, k) { box(g, k.sm, -3, -4, 6, 8); }

  /* ---------- Cabezas ---------- */
  function headCosido(g, k) {
    var sm = k.sm, hair = '#2a2230', open = k.state === 'attack', i;
    neckPiece(g, k);
    box(g, MAT.steel, -10, -11, 3, 4); box(g, MAT.steel, 7, -11, 3, 4);       // tornillos del cuello
    box(g, sm, -8, -19, 16, 16);
    g.clearRect(-8, -19, 1, 1); g.clearRect(7, -19, 1, 1);
    R(g, hair, -8, -20, 16, 3); g.clearRect(-8, -20, 1, 1); g.clearRect(7, -20, 1, 1);
    R(g, hair, -8, -17, 2, 1); R(g, hair, -3, -17, 2, 1); R(g, hair, 3, -17, 3, 1);
    seamH(g, k, -8, 7, -17);                                                    // cuero cabelludo cosido
    R(g, k.sk[1], -8, -14, 16, 2);                                              // ceja pesada
    eye3(g, k, -6, -11); eye3(g, k, 3, -11);
    if (open) { P(g, k.sk[1], -4, -12); P(g, k.sk[1], 3, -12); }
    R(g, k.sk[1], 0, -9, 1, 3); R(g, k.sk[1], -1, -7, 3, 1);                    // nariz
    if (open) {
      R(g, '#2b1016', -5, -8, 10, 4);
      for (i = -5; i < 5; i += 2) P(g, MAT.bone[0], i, -8);
      R(g, '#8a2a30', -3, -5, 6, 1);
    } else {
      R(g, '#1c1117', -5, -6, 10, 1);                                           // boca cosida
      for (i = -5; i < 5; i += 2) { P(g, k.st, i, -7); P(g, k.st, i, -5); }
    }
    seamV(g, k, 6, -12, -5);                                                    // costura de la mejilla
  }

  function headSabueso(g, k) {
    var F = MAT.fur, L = MAT.furLt, open = k.state === 'attack', dead = k.state === 'dead', W = MAT.bone[1], i;
    box(g, F, -5, -4, 10, 8);
    poly(g, F[0], [[-11, -24], [-3, -18], [-9, -10]]); poly(g, F[0], [[10, -24], [2, -18], [8, -10]]);
    poly(g, '#7a3a4a', [[-9, -21], [-5, -17], [-8, -13]]); poly(g, '#7a3a4a', [[8, -21], [4, -17], [7, -13]]);
    box(g, F, -8, -18, 16, 12);
    g.clearRect(-8, -18, 1, 1); g.clearRect(7, -18, 1, 1);
    R(g, F[2], -8, -14, 5, 3); R(g, F[2], 3, -14, 5, 3);                         // antifaz oscuro
    box(g, L, -4, -13, 8, 13);                                                  // hocico largo
    R(g, L[1], -1, -13, 2, 5);
    R(g, '#0f0b10', -3, -13, 6, 3); R(g, '#5a5068', -2, -13, 2, 1); R(g, '#0f0b10', -2, -10, 4, 1);   // trufa
    eye3(g, k, -7, -15); eye3(g, k, 4, -15);
    R(g, F[2], -8, -17, 5, 1); R(g, F[2], 3, -17, 5, 1);
    if (open) {
      R(g, '#2b1016', -4, -8, 8, 7);
      for (i = -4; i < 4; i += 2) { P(g, W, i, -8); P(g, W, i, -7); P(g, W, i + 1, -2); }
      R(g, '#b03a48', -2, -5, 4, 3);
    } else if (!dead) {
      R(g, '#1c1117', -4, -7, 8, 2);
      P(g, W, -4, -7); P(g, W, -4, -6); P(g, W, -3, -7); P(g, W, 3, -7); P(g, W, 3, -6); P(g, W, 2, -7); P(g, W, -2, -5); P(g, W, 1, -5);
    } else { R(g, '#1c1117', -4, -7, 8, 2); R(g, '#b03a48', 1, -5, 2, 4); }
    seamV(g, k, 0, -18, -14);
    seamH(g, k, -5, 4, -1);
    P(g, F[2], -6, -10); P(g, F[2], -7, -9); P(g, F[2], 6, -9); P(g, F[1], 5, -17); P(g, F[1], -6, -17);
  }

  function cog(g, k, x, y) {     // engranaje pequeño de latón; gira con el fotograma
    R(g, MAT.brass[0], x - 2, y - 2, 4, 4);
    R(g, MAT.brass[2], x - 1, y - 1, 2, 2);
    if (k.fr & 1) { P(g, MAT.brass[1], x - 3, y - 3); P(g, MAT.brass[1], x + 2, y - 3); P(g, MAT.brass[1], x - 3, y + 2); P(g, MAT.brass[1], x + 2, y + 2); }
    else { R(g, MAT.brass[1], x - 1, y - 3, 2, 1); R(g, MAT.brass[1], x - 1, y + 2, 2, 1); R(g, MAT.brass[1], x - 3, y - 1, 1, 2); R(g, MAT.brass[1], x + 2, y - 1, 1, 2); }
  }
  function headRelojero(g, k) {
    var sm = k.sm, dk = '#2f2836', B = MAT.brass;
    neckPiece(g, k); box(g, B, -5, -2, 10, 3);
    box(g, sm, -7, -19, 14, 17);
    g.clearRect(-7, -19, 2, 1); g.clearRect(5, -19, 2, 1); g.clearRect(-7, -2, 1, 1); g.clearRect(6, -2, 1, 1);
    R(g, sm[2], -8, -11, 1, 3); R(g, sm[2], 7, -11, 1, 3);                      // orejas
    box(g, B, -8, -16, 16, 3); R(g, B[2], -8, -14, 16, 1);                       // cinta de latón
    for (var i = -6; i < 7; i += 4) P(g, B[1], i, -15);
    R(g, B[2], -1, -22, 2, 4); cog(g, k, 0, -24);
    eye3(g, k, -5, -11);                                                        // ojo izquierdo
    ov(g, B[2], 3.5, -10, 5, 5); ov(g, B[0], 3.5, -10, 4.2, 4.2); ov(g, '#9fe6f2', 3.5, -10, 3.2, 3.2);   // lupa
    if (k.state === 'dead') { R(g, OL, 2, -11, 1, 1); R(g, OL, 4, -11, 1, 1); R(g, OL, 3, -10, 1, 1); R(g, OL, 2, -9, 1, 1); R(g, OL, 4, -9, 1, 1); }
    else { R(g, k.ey[0], 2, -12, 3, 3); P(g, k.ey[1], 2, -12); P(g, OL, 3, -11); }
    P(g, '#eafcff', 1, -12); P(g, '#eafcff', 1, -11);
    tline(g, B[2], 6, -14, 8, -9, 1);
    R(g, dk, -6, -7, 5, 1); R(g, dk, 1, -7, 5, 1); P(g, dk, -7, -8); P(g, dk, 6, -8);   // bigote
    if (k.state === 'attack') R(g, '#2b1016', -2, -5, 4, 2); else R(g, sm[2], -2, -5, 4, 1);
    seamV(g, k, -6, -19, -13);
  }

  function flameTongue(g, x, y, w, h) {    // llama: base ancha en y, punta arriba
    poly(g, C.fire1, [[x - w, y], [x + w, y], [x, y - h]]);
    poly(g, C.fire2, [[x - w + 1, y], [x + w - 1, y], [x, y - h + 3]]);
    poly(g, C.fire3, [[x - 1, y], [x + 1, y], [x, y - h + 6]]);
  }
  function flameDir(g, x, y, deg, len, w) {    // llama que sale de (x,y) en la dirección deg (0 = derecha, -90 = arriba)
    var a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), cols = [C.fire1, C.fire2, C.fire3], l = [1, 0.75, 0.45], ww = [1, 0.66, 0.33];
    for (var i = 0; i < 3; i++) {
      var L = len * l[i], W = w * ww[i];
      poly(g, cols[i], [[x - sn * W, y + c * W], [x + sn * W, y - c * W], [x + c * L, y + sn * L]]);
    }
  }
  function headQuimera(g, k) {
    var F = MAT.scale, Mz = ['#e8a060', '#ffd09a', '#b06a3a'], fr = k.fr, i, h, hs = [10, 14, 19, 23, 19, 14, 10];
    for (i = 0; i < 7; i++) { h = hs[i] + ((i * 5 + fr * 3) % 4); flameTongue(g, -12 + i * 4, -4 - (i === 0 || i === 6 ? 0 : 3), 3 + (i === 3 ? 1 : 0), h); }   // melena en llamas
    neckPiece(g, k); box(g, F, -5, -4, 10, 8);
    tline(g, MAT.bone[0], -7, -17, -10, -20, 3); tline(g, MAT.bone[0], -10, -20, -11, -25, 2); P(g, MAT.bone[1], -11, -27);   // cuernos
    tline(g, MAT.bone[0], 6, -17, 9, -20, 3); tline(g, MAT.bone[0], 9, -20, 10, -25, 2); P(g, MAT.bone[1], 10, -27);
    P(g, MAT.bone[1], -8, -18); P(g, MAT.bone[1], 7, -18);
    box(g, F, -8, -18, 16, 15);
    g.clearRect(-8, -18, 1, 1); g.clearRect(7, -18, 1, 1);
    box(g, Mz, -4, -11, 8, 8);
    R(g, '#3a1410', -2, -11, 4, 2);
    eye3(g, k, -7, -14); eye3(g, k, 4, -14);
    if (k.state !== 'dead' && k.state !== 'hurt') { P(g, OL, -6, -14); P(g, OL, -6, -13); P(g, OL, 5, -14); P(g, OL, 5, -13); }
    R(g, F[2], -8, -17, 4, 1); R(g, F[2], 4, -17, 4, 1);
    if (k.state === 'attack') {
      R(g, '#2b1016', -4, -8, 8, 5); R(g, C.fire2, -3, -5, 6, 2);
      for (i = -4; i < 4; i += 3) P(g, MAT.bone[1], i, -8);
    } else { R(g, '#2b1016', -4, -6, 8, 1); P(g, MAT.bone[1], -4, -5); P(g, MAT.bone[1], 3, -5); P(g, MAT.bone[1], -4, -4); P(g, MAT.bone[1], 3, -4); }
    P(g, F[2], -5, -16); P(g, F[2], 4, -16); P(g, F[1], -3, -17); P(g, F[1], 2, -17);
    // serpiente pegada a la melena
    tline(g, '#3a8a3a', -11, -2, -12, -8, 2); tline(g, '#3a8a3a', -12, -8, -11, -11, 2);
    R(g, '#59b84a', -13, -14, 4, 3); P(g, '#ffd15a', -12, -13); P(g, '#ff3a30', -13, -15 + (fr & 1));
  }

  function headPlaga(g, k) {
    var LE = MAT.leather, hat = ['#2e2630', '#4a4050', '#17121a'], B = MAT.bone, i;
    box(g, hat, -7, -4, 14, 8);                                                 // capa
    box(g, hat, -6, -22, 12, 9);
    box(g, hat, -12, -14, 24, 3);
    g.clearRect(-12, -14, 1, 1); g.clearRect(11, -14, 1, 1);
    R(g, '#6a1f28', -6, -15, 12, 1);
    box(g, LE, -7, -12, 14, 9);                                                 // máscara de cuero
    g.clearRect(-7, -4, 1, 1); g.clearRect(6, -4, 1, 1);
    for (i = 0; i < 12; i++) {                                                  // pico
      var hw = Math.max(0.5, 3.2 - i * 0.26), x0 = Math.round(-hw), x1 = Math.round(hw);
      R(g, B[0], x0, -10 + i, x1 - x0, 1);
      R(g, B[1], x0, -10 + i, Math.max(1, Math.round((x1 - x0) / 2)), 1);
      P(g, B[2], x1 - 1, -10 + i);
    }
    R(g, B[2], 0, -10, 1, 3);
    var glow = k.state === 'dead' ? '#241a26' : k.ey[0], halo = mixc(k.ey[0], '#14101b', 0.55);
    for (i = 0; i < 2; i++) {
      var lx = i ? 3.5 : -4.5;
      ov(g, MAT.brass[2], lx, -9, 3.6, 3.6); ov(g, MAT.brass[0], lx, -9, 2.9, 2.9); ov(g, halo, lx, -9, 2.2, 2.2);
      if (k.state === 'hurt') R(g, glow, lx - 1.5, -9, 3, 1); else { R(g, glow, lx - 1, -10, 2, 2); P(g, k.ey[1], lx - 1, -10); }
    }
    R(g, LE[2], -7, -11, 1, 6); R(g, LE[2], 6, -11, 1, 6);
    seamV(g, k, -6, -8, -4);
    P(g, B[1], -1, -10);
  }

  /* ---------- Torsos ---------- */
  function torsoRemendado(g, k) {
    var sm = k.sm;
    torsoBase(g, sm);
    R(g, sm[1], -9, 2, 6, 1); R(g, sm[1], 2, 2, 6, 1);                          // clavículas
    R(g, sm[2], -8, 8, 7, 1); R(g, sm[2], 1, 8, 7, 1);
    box(g, MAT.leather, 2, 4, 8, 8);                                            // parche de cuero
    for (var i = 2; i < 10; i += 2) { P(g, k.st, i, 4); P(g, k.st, i, 11); }
    for (i = 6; i < 11; i += 2) { P(g, k.st, 2, i); P(g, k.st, 9, i); }
    box(g, MAT.cloth, -10, 13, 7, 6);                                           // parche de tela
    for (i = -10; i < -3; i += 2) { P(g, k.st, i, 13); P(g, k.st, i, 18); }
    seam(g, k, [[-7, 2], [-1, 8], [0, 8], [0, 21]]);                            // incisión en Y
    box(g, MAT.leather, -9, 22, 18, 4);                                         // cinturón
    box(g, MAT.brass, -2, 22, 4, 4); R(g, OL, -1, 23, 2, 2);
    P(g, sm[2], 6, 14); P(g, sm[2], 7, 15); P(g, sm[2], 5, 17);
  }

  function torsoCaldera(g, k) {
    var Cu = MAT.copper, B = MAT.brass, fr = k.fr, i, r;
    box(g, MAT.iron, -11, -6, 4, 8); box(g, MAT.iron, 7, -6, 4, 8);             // chimeneas
    R(g, B[0], -12, -7, 6, 2); R(g, B[0], 6, -7, 6, 2);
    var puffs = [[-10, -9], [-9, -11], [-11, -13], [9, -9], [10, -11], [8, -13]];
    for (i = 0; i < puffs.length; i++) {
      if (((i + fr) & 1) === 0) { R(g, 'rgba(200,205,215,0.75)', puffs[i][0] + (fr >> 1), puffs[i][1] - (fr & 1), 2, 2); }
    }
    box(g, Cu, -13, 0, 26, 25);
    g.clearRect(-13, 0, 2, 1); g.clearRect(11, 0, 2, 1); g.clearRect(-13, 24, 1, 1); g.clearRect(12, 24, 1, 1);
    R(g, B[2], -13, 5, 26, 2); R(g, B[0], -13, 5, 26, 1);
    R(g, B[2], -13, 19, 26, 2); R(g, B[0], -13, 19, 26, 1);
    for (i = -11; i < 12; i += 4) { P(g, B[1], i, 6); P(g, B[1], i, 20); }
    ov(g, B[2], 0, 12.5, 6.6, 6.6); ov(g, B[0], 0, 12.5, 5.6, 5.6); ov(g, '#1a0f0a', 0, 12.5, 4.2, 4.2);
    r = 2.7 + (fr & 1) * 0.8;
    ov(g, C.fire1, 0, 13, r + 0.6, r + 0.6); ov(g, C.fire2, 0, 13, r, r); ov(g, C.fire3, 0, 13.5, r - 1.4, r - 1.4);
    P(g, '#ffffff', -3, 10); P(g, '#ffffff', -2, 10);
    ov(g, B[2], -9.5, 11, 2.6, 2.6); ov(g, '#e8dcc0', -9.5, 11, 1.8, 1.8); P(g, C.blood, -9, 10); P(g, C.blood, -9, 11);   // manómetro
    box(g, B, 7, 10, 5, 5); P(g, B[2], 9, 12);                                  // válvula
    for (i = -8; i < 8; i += 5) { R(g, '#1a0f0a', i, 22, 3, 2); P(g, C.fire2, i + 1, 23); }
    R(g, Cu[1], -12, 2, 1, 2); R(g, Cu[2], 11, 8, 1, 10);
  }

  function torsoCostillar(g, k) {
    var St = MAT.steel, i;
    torsoBase(g, ['#1b1420', '#2a2036', '#100c14']);
    box(g, St, -12, 0, 24, 3);
    g.clearRect(-12, 0, 1, 1); g.clearRect(11, 0, 1, 1);
    R(g, k.sk[1], -12, 3, 2, 12); R(g, k.sk[1], 10, 3, 2, 12);                  // carne cosida a las costillas
    seamV(g, k, -11, 4, 14); seamV(g, k, 10, 4, 14);
    R(g, '#2e2438', -1, 3, 2, 18);
    var ends = [-10, -10, -9, -8, -7];
    for (i = 0; i < 5; i++) {
      var y = 4 + i * 3, e = ends[i];
      R(g, St[1], e, y, -1 - e, 1); R(g, St[0], e, y + 1, -1 - e, 1); R(g, St[2], e + 1, y + 2, -2 - e, 1);
      R(g, St[1], 1, y, -1 - e, 1); R(g, St[0], 1, y + 1, -1 - e, 1); R(g, St[2], 1, y + 2, -2 - e, 1);
      P(g, St[0], e, y + 2); P(g, St[0], -e - 1, y + 2);
    }
    box(g, St, -1, 3, 2, 17);
    R(g, C.blood, 2, 8, 4, 4); R(g, C.bloodHi, 2, 8, 2, 2); P(g, '#5a0f16', 5, 11);      // corazón
    box(g, St, -9, 21, 18, 5);
    for (i = -8; i < 8; i += 4) P(g, St[1], i, 23);
  }

  function torsoAlambique(g, k) {
    var B = MAT.brass, liq = '#5fbf3a', liqLt = '#b6ef7a', glassDk = '#16302c', fr = k.fr, i;
    torsoBase(g, [k.sm[2], k.sm[0], mixc(k.sm[2], '#000000', 0.35)]);
    box(g, MAT.leather, -12, 0, 3, 23); box(g, MAT.leather, 9, 0, 3, 23);      // correas
    box(g, B, -12, 0, 24, 3);
    tline(g, MAT.copper[0], -3, 3, -8, 1, 1); tline(g, MAT.copper[0], 3, 3, 8, 1, 1);   // tubos
    P(g, B[1], -8, 1); P(g, B[1], 8, 1);
    ov(g, B[2], 0, 13, 10, 10); ov(g, B[0], 0, 13, 9.3, 9.3);                   // marco de latón
    ov(g, glassDk, 0, 13, 8.4, 8.4);
    g.save(); g.beginPath(); g.rect(-10, 9, 20, 15); g.clip();
    ov(g, liq, 0, 13, 8.4, 8.4);
    g.restore();
    R(g, liqLt, -6, 9, 12, 1);
    R(g, mixc(liq, '#14101b', 0.3), -6, 19, 12, 1);
    P(g, liqLt, -3 + (fr & 1), 17 - fr * 2 + (fr > 1 ? 6 : 0)); P(g, liqLt, 2, 19 - ((fr + 2) & 3) * 2 + 2); P(g, '#e8ffd0', 0, 15 - fr + 2);
    P(g, '#ffffff', -6, 11); P(g, '#ffffff', -7, 12); P(g, '#c8f4f0', -7, 13); P(g, '#c8f4f0', -6, 10);
    box(g, B, -3, 2, 6, 3);                                                     // cuello del matraz
    R(g, '#b8f0f0', -2, 5, 4, 2); R(g, MAT.leather[0], -2, 0, 4, 2);
    box(g, B, -2, 22, 4, 3); P(g, B[2], 0, 23);
    box(g, MAT.leather, -9, 22, 18, 4); box(g, B, -2, 22, 4, 4); R(g, OL, -1, 23, 2, 2);
    for (i = 0; i < 2; i++) { R(g, MAT.leather[0], -12 + i * 21, 5, 3, 1); }
  }

  /* ---------- Brazos (hombro en el origen, cuelgan hacia +y; mitad izquierda, la derecha se espeja) ---------- */
  function shoulder(g, k, y) {
    ov(g, k.sm[0], 0, (y || 1) + 0.5, 5, 4.5);
    R(g, k.sm[1], -4, (y || 1) - 2, 3, 1);
  }
  function armMuerto(g, k) {
    var sm = k.sm;
    box(g, sm, -4, 0, 8, 14);
    shoulder(g, k, 1);
    R(g, MAT.rag[0], -4, 0, 8, 4); R(g, MAT.rag[2], -4, 4, 8, 1); R(g, MAT.rag[0], -4, 4, 2, 1); R(g, MAT.rag[0], 0, 4, 2, 1);   // manga rota
    seamH(g, k, -4, 3, 7);
    box(g, sm, -3, 13, 6, 14);
    seamH(g, k, -4, 3, 13);
    box(g, sm, -3, 27, 6, 5);
    R(g, sm[0], -3, 32, 1, 4); R(g, sm[0], -1, 32, 1, 5); R(g, sm[0], 1, 32, 1, 4); R(g, sm[0], 2, 28, 1, 3);
    P(g, sm[1], -3, 32); P(g, sm[1], -1, 32); P(g, sm[1], 1, 32);
    P(g, '#3a2c2c', -3, 35); P(g, '#3a2c2c', -1, 36); P(g, '#3a2c2c', 1, 35);
    P(g, sm[2], 2, 30); R(g, sm[2], 1, 20, 1, 4);
  }
  function armSierra(g, k) {
    var B = MAT.brass, St = MAT.steel, fr = k.fr, i;
    box(g, k.sm, -4, 0, 8, 10);
    shoulder(g, k, 1);
    seamH(g, k, -4, 3, 9);
    box(g, B, -4, 10, 8, 10);
    R(g, B[2], -4, 13, 8, 1);
    P(g, B[1], -3, 11); P(g, B[1], 2, 11); P(g, B[1], -3, 18); P(g, B[1], 2, 18);
    box(g, St, -6, 11, 2, 6);                                                   // escape
    P(g, 'rgba(210,215,225,0.8)', -6, 8 - (fr & 1)); P(g, 'rgba(210,215,225,0.6)', -5, 6 - (fr >> 1));
    box(g, St, -5, 19, 10, 2);
    box(g, St, -3, 21, 6, 19);
    g.clearRect(-3, 39, 1, 1); g.clearRect(2, 39, 1, 1);
    R(g, St[2], -1, 22, 1, 17);
    for (i = 22; i < 39; i++) if ((i + fr) % 3 === 0) { P(g, '#1c2028', -1, i); P(g, '#1c2028', 0, i); }
    for (i = 0; i < 6; i++) {                                                   // dientes del filo exterior
      var y = 23 + ((i * 3 + fr) % 18);
      P(g, St[1], -4, y); P(g, St[1], -5, y + 1); P(g, St[0], -4, y + 1);
    }
    P(g, C.blood, 0, 35); P(g, C.blood, -2, 28); P(g, '#7a1a20', 1, 31);
  }
  function armGolem(g, k) {
    var st = MAT.stone, ir = MAT.iron;
    shoulder(g, k, 1);
    box(g, st, -5, 3, 10, 11);
    box(g, MAT.leather, -5, 5, 5, 5);
    seamV(g, k, -1, 4, 13);
    R(g, st[2], 2, 4, 1, 4); R(g, st[2], 3, 7, 1, 3);
    box(g, ir, -6, 13, 12, 3);
    P(g, ir[1], -4, 14); P(g, ir[1], 0, 14); P(g, ir[1], 4, 14);
    box(g, st, -6, 16, 12, 10);
    R(g, st[2], -4, 18, 1, 5); R(g, st[2], 1, 20, 1, 4);
    box(g, ir, -7, 25, 14, 3);
    P(g, ir[1], -5, 26); P(g, ir[1], -1, 26); P(g, ir[1], 3, 26);
    box(g, st, -7, 28, 14, 11);
    R(g, st[2], -4, 32, 1, 6); R(g, st[2], -1, 32, 1, 6); R(g, st[2], 2, 32, 1, 6);     // nudillos
    R(g, st[1], -6, 29, 12, 1);
    g.clearRect(-7, 38, 1, 1); g.clearRect(6, 38, 1, 1);
    seam(g, k, [[-7, 35], [-4, 34]]); P(g, st[1], 4, 30); P(g, st[1], 5, 31);
  }
  function armTijera(g, k) {
    var St = MAT.steel, B = MAT.brass, i;
    box(g, k.sm, -4, 0, 8, 7);
    shoulder(g, k, 1);
    seamH(g, k, -4, 3, 6);
    // fórceps colgando: anillas para los dedos, pivote de latón y mordazas largas
    ov(g, St[2], -2.5, 12, 3.6, 4.2); ov(g, St[0], -2.5, 12, 2.8, 3.4); ov(g, '#1c2028', -2.5, 12, 1.4, 2);
    ov(g, St[2], 2.5, 12, 3.6, 4.2); ov(g, St[0], 2.5, 12, 2.8, 3.4); ov(g, '#1c2028', 2.5, 12, 1.4, 2);
    tline(g, St[2], -2, 15, 1, 21, 3); tline(g, St[2], 1, 15, -2, 21, 3);
    tline(g, St[2], -3, 21, -2, 33, 4); tline(g, St[2], 2, 21, 1, 33, 4);
    tline(g, St[2], -2, 33, -1, 40, 3); tline(g, St[2], 1, 33, 0, 40, 3);
    tline(g, St[0], -3, 21, -2, 33, 3); tline(g, St[0], 2, 21, 1, 33, 3);
    tline(g, St[0], -2, 33, -1, 39, 2); tline(g, St[0], 1, 33, 0, 39, 2);
    tline(g, St[1], -4, 22, -3, 32, 1);
    R(g, '#1c2028', -1, 22, 1, 12);
    for (i = 0; i < 3; i++) { P(g, St[2], -2, 35 + i * 2); P(g, St[2], 1, 36 + i * 2); }
    box(g, B, -2, 17, 4, 4); P(g, B[2], 0, 19);
    P(g, C.blood, -1, 40); P(g, C.blood, 0, 39); P(g, '#7a1a20', -2, 36);
  }
  function armPiston(g, k) {
    var B = MAT.brass, St = MAT.steel, ext = [0, 1, 2, 1][k.fr];
    box(g, k.sm, -4, 0, 8, 8);
    shoulder(g, k, 1);
    seamH(g, k, -4, 3, 7);
    tline(g, MAT.rubber[1], -6, 3, -7, 8, 2); tline(g, MAT.rubber[0], -7, 8, -6, 13, 2); tline(g, MAT.rubber[0], -6, 13, -4, 15, 2);
    box(g, B, -4, 8, 8, 16);
    R(g, B[2], -4, 11, 8, 1); R(g, B[2], -4, 17, 8, 1); R(g, B[2], -4, 22, 8, 1);
    P(g, B[1], -3, 9); P(g, B[1], 2, 9); P(g, B[1], -3, 20); P(g, B[1], 2, 20);
    ov(g, '#e8dcc0', 0, 14.5, 2, 2); P(g, C.blood, 0, 14); P(g, C.blood, 0, 15);
    P(g, 'rgba(215,220,230,0.8)', 5 - (k.fr & 1), 12); P(g, 'rgba(215,220,230,0.6)', 6, 10 - (k.fr >> 1));
    box(g, St, -1, 24, 2, 7 + ext);
    box(g, St, -5, 30 + ext, 10, 8);
    R(g, MAT.iron[2], -5, 36 + ext, 10, 2);
    P(g, St[1], -4, 32 + ext); P(g, St[1], 3, 32 + ext);
  }
  function armTentaculo(g, k) {
    var P4 = MAT.plum, fr = k.fr, N = 70, i, pts = [];
    shoulder(g, k, 1);
    seamH(g, k, -4, 3, 6);
    for (i = 0; i <= N; i++) {
      var t = i / N, y = 4 + t * 34, x = Math.sin(t * 5.2 + fr * 1.57) * (0.4 + t * 3.2) - 0.5;
      if (t > 0.86) x += (t - 0.86) * 28;
      pts.push([x, y, 4.3 - 3.0 * t]);
    }
    for (i = 0; i < pts.length; i++) ov(g, P4[0], pts[i][0], pts[i][1], pts[i][2], pts[i][2]);
    for (i = 0; i < pts.length; i++) if (pts[i][2] > 1.3) ov(g, P4[1], pts[i][0] - 0.9, pts[i][1] - 0.4, pts[i][2] * 0.45, pts[i][2] * 0.45);
    for (i = 6; i < pts.length - 6; i += 7) { P(g, '#f0c8e0', Math.round(pts[i][0] + pts[i][2] * 0.5), Math.round(pts[i][1])); P(g, '#f0c8e0', Math.round(pts[i][0] + pts[i][2] * 0.5), Math.round(pts[i][1]) + 1); }
    var e = pts[pts.length - 1];
    P(g, '#7fe04a', Math.round(e[0]) + 1, Math.round(e[1]) + 2); P(g, '#b6ef7a', Math.round(e[0]) + 1, Math.round(e[1]) + 4);
  }

  /* ---------- Piernas (cadera en el origen, suelo en y=43; mitad izquierda, la derecha se espeja) ---------- */
  function legMuerta(g, k) {
    var sm = k.sm;
    box(g, sm, -5, -2, 10, 20);
    R(g, MAT.rag[0], -5, -2, 10, 11); R(g, MAT.rag[2], -5, 9, 10, 1);
    R(g, MAT.rag[0], -5, 9, 3, 2); R(g, MAT.rag[0], 0, 9, 2, 1); R(g, MAT.rag[0], 3, 9, 2, 3);
    seamH(g, k, -5, 4, 17);
    box(g, sm, -4, 18, 8, 20);
    seamH(g, k, -4, 3, 28);
    box(g, sm, -5, 38, 10, 6);
    P(g, sm[2], -3, 43); P(g, sm[2], -1, 43); P(g, sm[2], 1, 43); P(g, sm[2], 3, 43);
    P(g, sm[2], -3, 42); P(g, sm[2], 1, 42);
  }
  function legSabueso(g, k) {
    var F = MAT.fur, L = MAT.furLt, i;
    box(g, F, -5, -2, 10, 17);
    for (i = 0; i < 5; i++) { P(g, F[2], -4 + i * 2, 2 + (i % 2) * 4); P(g, F[1], -3 + i * 2, 6 + (i % 2) * 3); }
    P(g, F[0], -6, 4); P(g, F[0], -6, 9); P(g, F[0], 5, 6);
    seamH(g, k, -5, 4, 14);
    box(g, F, -6, 15, 9, 7);
    P(g, F[1], -7, 18); P(g, F[0], -7, 19);
    box(g, F, -3, 22, 6, 12);
    box(g, L, -5, 34, 10, 10);
    R(g, F[2], -2, 38, 1, 5); R(g, F[2], 1, 38, 1, 5);
    for (i = -5; i < 5; i += 3) { P(g, MAT.bone[1], i, 43); P(g, MAT.bone[0], i, 42); }
    seamH(g, k, -4, 3, 28);
  }
  function legResorte(g, k) {
    var St = MAT.steel, B = MAT.brass, y, ph;
    box(g, k.sm, -4, -2, 8, 9);
    seamH(g, k, -4, 3, 6);
    box(g, B, -5, 7, 10, 5); P(g, B[1], -4, 9); P(g, B[1], 3, 9);
    R(g, '#14181e', -3, 12, 6, 22);
    for (y = 12; y < 34; y++) {
      ph = (y + k.fr) % 4;
      if (ph === 0) { R(g, St[1], -4, y, 8, 1); P(g, St[1], -5, y); }
      else if (ph === 1) R(g, St[0], -4, y, 8, 1);
      else if (ph === 2) { R(g, St[2], -4, y, 8, 1); P(g, St[2], 4, y); }
    }
    box(g, B, -6, 34, 12, 4);
    box(g, MAT.rubber, -6, 38, 12, 6);
    R(g, MAT.rubber[2], -5, 41, 10, 1); P(g, MAT.rubber[1], -4, 40); P(g, MAT.rubber[1], 0, 40); P(g, MAT.rubber[1], 4, 40);
  }
  function legArana(g, k) {
    var St = MAT.steel, B = MAT.brass, kx = [-9, -10, -9, -8][k.fr];
    tline(g, St[2], -1, 3, kx, 13, 5); tline(g, St[2], kx, 13, -3, 33, 4); tline(g, St[2], -3, 34, -2, 43, 3);
    tline(g, St[0], -1, 3, kx, 13, 3); tline(g, St[0], kx, 13, -3, 33, 2); tline(g, St[0], -3, 34, -2, 42, 1);
    tline(g, St[1], 0, 3, kx + 1, 12, 1);
    tline(g, B[0], 2, 4, kx + 4, 11, 1);
    ov(g, B[2], -0.5, 2, 4.4, 4.4); ov(g, B[0], -0.5, 2, 3.6, 3.6); P(g, B[1], -2, 1); P(g, B[2], 0, 2);
    ov(g, B[2], kx + 0.5, 13, 3.4, 3.4); ov(g, B[0], kx + 0.5, 13, 2.6, 2.6); P(g, B[1], kx, 12);
    ov(g, B[2], -2.5, 33.5, 2.6, 2.6); ov(g, B[0], -2.5, 33.5, 1.8, 1.8);
    P(g, MAT.bone[1], -2, 43); P(g, MAT.bone[0], -2, 42);
    P(g, C.blood, kx + 1, 15);
  }
  function legPesada(g, k) {
    var I = MAT.iron, B = MAT.brass, LE = MAT.leather, i;
    box(g, k.sm, -5, -2, 10, 12);
    box(g, LE, -5, 3, 10, 3); box(g, B, -1, 3, 3, 3); P(g, LE[2], 0, 4);
    box(g, I, -6, 10, 12, 8);
    R(g, I[1], -1, 7, 2, 4); R(g, I[0], -1, 8, 2, 3); P(g, I[1], -1, 7);
    for (i = -5; i < 5; i += 4) P(g, B[1], i, 12);
    box(g, I, -5, 18, 10, 17);
    R(g, I[2], -5, 24, 10, 1); R(g, I[2], -5, 29, 10, 1); R(g, I[1], -4, 19, 1, 15);
    for (i = 0; i < 3; i++) { P(g, B[1], 3, 21 + i * 5); }
    box(g, B, -6, 34, 12, 2);
    box(g, I, -7, 36, 14, 8);
    R(g, OL, -7, 41, 14, 3); R(g, I[2], -7, 41, 14, 1); P(g, I[1], -6, 37); P(g, I[1], -5, 37); P(g, B[1], -5, 38); P(g, B[1], 3, 38);
  }

  /* ---------- Muñones vendados ---------- */
  var BAND = MAT.bone;
  function wrapFill(g, x, y, w, h) {       // vendaje en diagonal
    R(g, BAND[0], x, y, w, h);
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) if (((i + j) & 3) === 0) P(g, BAND[2], x + i, y + j);
    R(g, BAND[1], x, y, 1, h);
  }
  function wrapOv(g, cx, cy, rx, ry) {
    for (var y = Math.floor(cy - ry); y < Math.ceil(cy + ry); y++) {
      for (var x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++) {
        var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) P(g, (((x + y) & 3) === 0) ? BAND[2] : (dx < -0.5 ? BAND[1] : BAND[0]), x, y);
      }
    }
  }
  function blot(g, x, y) { R(g, C.blood, x, y, 3, 2); R(g, C.blood, x + 1, y - 1, 2, 1); R(g, C.blood, x + 1, y + 2, 1, 1); P(g, C.bloodHi, x, y); }
  function stumpHead(g, k) {
    box(g, k.sm, -3, -4, 6, 7);
    wrapFill(g, -4, -5, 8, 6);
    wrapOv(g, 0, -10, 7, 7);
    R(g, BAND[2], -6, -5, 12, 1);
    blot(g, 1, -12); P(g, C.blood, 2, -8);
    R(g, BAND[0], 6, -6, 4, 1); R(g, BAND[2], 9, -5, 1, 3); R(g, BAND[0], 8, -3, 2, 1);
  }
  function stumpTorso(g, k) {
    for (var y = 0; y < TORSO_ROWS; y++) {
      var w = torsoW(y);
      for (var x = w[0]; x <= w[1]; x++) P(g, (((x + y) & 3) === 0) ? BAND[2] : (x === w[0] ? BAND[1] : BAND[0]), x, y);
    }
    R(g, BAND[2], -9, TORSO_ROWS - 1, 18, 1);
    R(g, MAT.leather[0], -9, 21, 18, 2); P(g, MAT.brass[0], -1, 21); P(g, MAT.brass[0], 0, 21);
    blot(g, -5, 7); blot(g, 3, 12); R(g, C.blood, 4, 15, 2, 1);
    R(g, BAND[0], 9, 18, 4, 1); R(g, BAND[2], 12, 18, 1, 4); R(g, BAND[0], 11, 21, 2, 1);
    seamH(g, k, -6, 5, 3);
  }
  function stumpArm(g, k) {
    shoulder(g, k, 1);
    box(g, k.sm, -4, 0, 8, 6);
    wrapFill(g, -4, 5, 8, 11);
    wrapOv(g, 0, 16, 4, 3);
    R(g, BAND[2], -4, 5, 8, 1);
    blot(g, -1, 15);
    R(g, BAND[0], 3, 9, 4, 1); R(g, BAND[2], 6, 10, 1, 4);
  }
  function stumpLeg(g, k) {
    box(g, k.sm, -5, -2, 10, 13);
    seamH(g, k, -5, 4, 10);
    wrapFill(g, -4, 10, 8, 11);
    wrapOv(g, 0, 21, 4, 3);
    R(g, BAND[2], -4, 10, 8, 1);
    blot(g, -1, 17);
    R(g, MAT.leather[0], -5, 13, 10, 2);
    box(g, MAT.wood, -2, 23, 4, 16);
    box(g, MAT.iron, -3, 39, 6, 5);
    R(g, MAT.leather[0], -3, 26, 6, 2);
  }

  /* ---------- Registro de piezas ---------- */
  var BOXES = {
    head: { x: -16, y: -30, w: 32, h: 34 },
    torso: { x: -16, y: -16, w: 32, h: 46 },
    arm: { x: -12, y: -5, w: 24, h: 48 },
    leg: { x: -12, y: -3, w: 24, h: 50 }
  };
  var LIMB_ART = {
    cab_cosido: ['head', headCosido], cab_sabueso: ['head', headSabueso], cab_relojero: ['head', headRelojero, 1], cab_quimera: ['head', headQuimera, 1], cab_plaga: ['head', headPlaga],
    tor_remendado: ['torso', torsoRemendado], tor_caldera: ['torso', torsoCaldera, 1], tor_costillar: ['torso', torsoCostillar], tor_alambique: ['torso', torsoAlambique, 1],
    bra_muerto: ['arm', armMuerto], bra_sierra: ['arm', armSierra, 1], bra_golem: ['arm', armGolem], bra_tijera: ['arm', armTijera], bra_piston: ['arm', armPiston, 1], bra_tentaculo: ['arm', armTentaculo, 1],
    pie_muerta: ['leg', legMuerta], pie_sabueso: ['leg', legSabueso], pie_resorte: ['leg', legResorte, 1], pie_arana: ['leg', legArana, 1], pie_pesada: ['leg', legPesada],
    stump_head: ['head', stumpHead], stump_torso: ['torso', stumpTorso], stump_arm: ['arm', stumpArm], stump_leg: ['leg', stumpLeg]
  };
  var DEFAULT_LIMB = { head: 'cab_cosido', torso: 'tor_remendado', armL: 'bra_muerto', armR: 'bra_muerto', legL: 'pie_muerta', legR: 'pie_muerta' };
  var limbCache = {};
  function limbSprite(artId, cos, fr, state) {
    var art = LIMB_ART[artId], type = art[0], animated = art[2], isHead = type === 'head';
    var key = artId + '|' + (animated ? fr : 0) + '|' + (isHead ? state : '') + '|' + cos.key;
    var L = limbCache[key];
    if (L) return L;
    var b = BOXES[type];
    L = mk(b.w + 2 * M, b.h + 2 * M);
    L.px = -b.x + M; L.py = -b.y + M;
    L.g.translate(L.px, L.py);
    art[1](L.g, { sk: cos.sk, sm: cos.sm, st: cos.st, ey: cos.ey, fr: animated ? fr : 0, state: state });
    L.g.setTransform(1, 0, 0, 1, 0, 0);
    outline(L, OL);
    return (limbCache[key] = L);
  }
  function glowOf(L) {
    if (!L.gO) { L.gO = silh(L.c, '#ff3a1c'); L.gY = silh(L.c, '#ffd27a'); L.hal = dilate(L.c, '#ff5a22', 2); }
    return L;
  }

  /* ---------- Composición del jugador grande ---------- */
  var FX = 44, FY = 20;                       // origen del cuerpo 48×88 dentro del lienzo de trabajo
  var SC = mk(136, 116);
  var ORIGIN = { head: [24, 20], torso: [24, 20], armL: [9, 23], armR: [39, 23], legL: [18, 44], legR: [30, 44] };
  var BOB = [0, 1, 1, 0];
  function artOf(body, slot) {
    var s = body && body.slots && body.slots[slot], id = s && s.id, type = DD.SLOT_TYPE[slot];
    if (s && id === null) return 'stump_' + type;
    var art = own(LIMB_ART, id);
    if (art && art[0] === type) return id;
    return DEFAULT_LIMB[slot];
  }
  function poseOffsets(pose, fr) {
    var b = BOB[fr], hb = BOB[(fr + 3) & 3], ab = BOB[(fr + 2) & 3];
    if (pose === 'attack') return { head: [5 + (fr & 1), 2], torso: [3, 1], armL: [2, 2], armR: [3, 1], rotR: true, legL: [-3, 0], legR: [3, 0] };
    if (pose === 'hurt') return { head: [-5, 1], torso: [-3, 0], armL: [-4, -2], armR: [-3, -3], legL: [-2, 0], legR: [-1, 0] };
    if (pose === 'dead') return { head: [0, 1], torso: [0, 0], armL: [-2, 1], armR: [2, 1], legL: [-1, 0], legR: [1, 0] };
    return { head: [0, b + hb], torso: [0, b], armL: [0, ab], armR: [0, ab], legL: [0, 0], legR: [0, 0] };
  }
  function putLimb(g, L, slot, off, rot, h, t) {
    var o = ORIGIN[slot], mirror = slot === 'armR' || slot === 'legR';
    g.save();
    g.translate(FX + o[0] + off[0], FY + o[1] + off[1]);
    if (rot) g.transform(0, -1, 1, 0, 0, 0);
    if (mirror) g.scale(-1, 1);
    if (h > 0.05) {
      glowOf(L);
      var pulse = h >= 0.7 ? 0.82 + 0.18 * Math.sin(t * 9 + o[0]) : 1;
      g.globalAlpha = (0.16 + 0.44 * h) * pulse; g.drawImage(L.hal, -L.px, -L.py); g.globalAlpha = 1;
    }
    g.drawImage(L.c, -L.px, -L.py);
    if (h > 0.05) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.1 + 0.5 * h; g.drawImage(L.gO, -L.px, -L.py);
      if (h > 0.85) { g.globalAlpha = Math.min(0.45, (h - 0.85) * 3.6); g.drawImage(L.gY, -L.px, -L.py); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    g.restore();
  }
  function embers(g, slot, h, t, off) {       // chispas que suben de las extremidades muy calientes
    var o = ORIGIN[slot], n = h >= 0.9 ? 3 : 2, i, tt = Math.floor(t * 8);
    for (i = 0; i < n; i++) {
      var ph = (tt + i * 5 + o[0]) % 11, x = FX + o[0] + off[0] + ((i * 7 + tt * 3) % 9) - 4, y = FY + o[1] + off[1] + 6 - ph * 2;
      g.fillStyle = ph < 6 ? C.fire3 : C.fire2; g.fillRect(x, y, 1, 1);
    }
  }
  function shadowEll(ctx, cx, by, rx, ry) { ov(ctx, 'rgba(0,0,0,0.38)', cx, by - 1, rx, ry); }

  S.drawPlayerBig = function (ctx, body, cx, by, opt) {
    opt = opt || {};
    cx = Math.round(cx); by = Math.round(by);
    var pose = opt.pose || 'idle', fr = (opt.frame | 0) & 3, cos = cosmetics(opt.equip), t = DD.time || 0, g = SC.g;
    var state = pose === 'attack' || pose === 'hurt' || pose === 'dead' ? pose : 'open';
    var o = poseOffsets(pose, fr), heat = pose === 'dead' ? null : opt.heat, slots = DD.SLOTS, i, h, slot, hs = {};
    g.clearRect(0, 0, SC.w, SC.h);
    var order = ['legL', 'legR', 'torso', 'armL', 'armR', 'head'];
    for (i = 0; i < order.length; i++) {
      slot = order[i];
      h = heat && heat[slot] > 0 ? Math.min(1, heat[slot]) : 0;
      hs[slot] = h;
      putLimb(g, limbSprite(artOf(body, slot), cos, fr, state), slot, o[slot], slot === 'armR' && o.rotR, h, t);
    }
    for (i = 0; i < slots.length; i++) if (hs[slots[i]] >= 0.7) embers(g, slots[i], hs[slots[i]], t, o[slots[i]]);
    if (opt.flash > 0) tint(g, SC.w, SC.h, opt.flash);
    ctx.save();
    if (opt.alpha != null) ctx.globalAlpha *= opt.alpha;
    ctx.translate(cx, by);
    if (opt.flip) ctx.scale(-1, 1);
    if (pose === 'dead') {
      if (opt.shadow !== false) shadowEll(ctx, 0, 0, 40, 4);
      ctx.translate(44, -13); ctx.transform(0, -1, 1, 0, 0, 0);
      ctx.drawImage(SC.c, -(FX + 24), -(FY + 88));
    } else {
      if (opt.shadow !== false) shadowEll(ctx, 0, 0, 18, 3);
      ctx.drawImage(SC.c, -(FX + 24), -(FY + 88));
    }
    ctx.restore();
  };


  /* ====================================================================== */
  /*  ENEMIGOS GRANDES (≤64×64). Se pintan mirando a la IZQUIERDA.           */
  /*  Origen local: centro horizontal y suelo (y=0); hacia arriba y<0.       */
  /* ====================================================================== */
  var TH = { st: '#e6dcc0' };            // hilo claro de las costuras de monstruos
  var THD = { st: '#2a1f2a' };           // hilo oscuro
  var FLESH = ['#a8755f', '#c79075', '#6e4636'];
  var EMBER = '#ff3a30';
  function eyeE(g, s, x, y, col, hi, w) {    // ojo de enemigo: abierto / entornado / aspa
    w = w || 3;
    if (s.dead) { R(g, OL, x, y, 1, 1); R(g, OL, x + w - 1, y, 1, 1); R(g, OL, x + 1, y + 1, w - 2, 1); R(g, OL, x, y + 2, 1, 1); R(g, OL, x + w - 1, y + 2, 1, 1); return; }
    if (s.hurt) { R(g, OL, x, y + 1, w, 1); return; }
    R(g, col, x, y, w, 2); P(g, hi, x, y);
    if (s.atk) P(g, hi, x + w - 1, y);
  }
  function limbE(g, m, x0, y0, x1, y1, t) {        // segmento con luz
    tline(g, m[2], x0 + 1, y0, x1 + 1, y1, t); tline(g, m[0], x0, y0, x1, y1, t);
    if (t > 3) tline(g, m[1], x0 - 1, y0, x1 - 1, y1, 1);
  }
  function drip(g, x, y, n, col) { for (var i = 0; i < n; i++) P(g, col, x, y + i * 2); }

  function paintSabueso(g, s) {
    var F = MAT.fur, L = MAT.furLt, D = ['#3c3128', '#4a3d31', '#241c16'], W = MAT.bone[1], atk = s.atk, b = s.bob, sw = s.sw, i;
    var dx = atk ? -2 : 0, ln = atk ? 4 : 0, Y = -22 + b + ln;
    var hx = -16 + dx - (atk ? 1 : 0) + (s.hurt ? 2 : 0), hy = -28 + b + ln + (atk ? 3 : 0) - (s.hurt ? 5 : 0) + (s.dead ? 2 : 0);
    // patas lejanas (oscuras)
    limbE(g, D, -2 + dx, Y + 4, -3 + dx - (atk ? 4 : 0) - sw, -2, 4);
    limbE(g, D, 8 + dx, Y + 3, 3 + dx + sw * 2, -10, 5); limbE(g, D, 3 + dx + sw * 2, -10, 5 + dx + sw, -2, 3);
    box(g, D, -6 + dx - (atk ? 4 : 0) - sw, -2, 7, 2); box(g, D, 1 + dx + sw, -2, 7, 2);
    // cola
    var tw = s.hurt ? 12 : 0;
    tline(g, F[0], 21 + dx, Y - 1, 26 + dx, Y - 6 + tw, 3); tline(g, F[0], 26 + dx, Y - 6 + tw, 28 + dx, Y - 12 + tw * 1.5 + (b ? 1 : 0), 3);
    poly(g, L[0], [[26 + dx, Y - 12 + tw * 1.5], [31 + dx, Y - 17 + tw * 1.5], [30 + dx, Y - 10 + tw * 1.5]]);
    // cuerpo
    ov(g, D[0], 4 + dx, Y + 1, 15, 10); ov(g, F[0], 4 + dx, Y - 1, 15, 9.5);
    ov(g, F[0], 14 + dx, Y - 1, 10, 10.5); ov(g, F[0], -7 + dx, Y - 1, 9, 10);
    ov(g, L[0], 15 + dx, Y - 3, 6, 6);                                          // parche de pelo claro en la grupa
    for (i = 0; i < 5; i++) P(g, TH.st, 10 + dx + i * 2, Y - 8 + (i % 2));
    box(g, ['#4a2a2e', '#6a3a3e', '#2c1518'], 0 + dx, Y - 6, 9, 9);              // flanco desgarrado
    for (i = 0; i < 3; i++) { tline(g, MAT.bone[0], 1 + dx + i * 3, Y - 5, 2 + dx + i * 3, Y + 1, 1); P(g, MAT.bone[1], 1 + dx + i * 3, Y - 5); }     // costillas
    for (i = -8; i < 20; i += 4) poly(g, D[0], [[i + dx, Y - 9 + b], [i + 2 + dx, Y - 13 + b - (i % 8 === 0 ? 1 : 0)], [i + 4 + dx, Y - 9 + b]]);
    seam(g, TH, [[6 + dx, Y - 9], [8 + dx, Y - 3], [10 + dx, Y + 4]]);
    // patas cercanas
    var fx = -8 + dx - (atk ? 5 : 0) + sw * 2;
    limbE(g, F, -8 + dx, Y + 4, fx, -3, 5); box(g, L, fx - 4, -3, 8, 3); P(g, W, fx - 5, -1);
    limbE(g, F, 14 + dx, Y + 1, 19 + dx - sw * 2, -10, 7); limbE(g, F, 19 + dx - sw * 2, -10, 17 + dx + sw, -2, 3);
    box(g, L, 13 + dx + sw, -3, 8, 3); P(g, W, 12 + dx + sw, -1);
    seam(g, TH, [[-9 + dx, Y + 4], [-8 + dx, Y + 9]]);
    // cabeza
    poly(g, D[1], [[hx + 8, hy - 5], [hx + 12, hy - 14], [hx + 14, hy - 4]]);
    poly(g, F[0], [[hx + 1, hy - 5], [hx + 2, hy - 17], [hx + 9, hy - 5]]); poly(g, '#7a3a4a', [[hx + 3, hy - 6], [hx + 3, hy - 13], [hx + 7, hy - 6]]);
    ov(g, F[0], hx + 5, hy, 8.5, 7.5);
    box(g, L, hx - 10, hy - 2, 12, 5); R(g, L[1], hx - 9, hy - 2, 9, 1);
    R(g, '#0f0b10', hx - 11, hy - 3, 3, 4); P(g, '#6a6070', hx - 11, hy - 3);
    var jy = atk ? 6 : (s.hurt ? 4 : 3);
    if (atk || s.hurt) R(g, '#2b1016', hx - 8, hy + 2, 11, jy - 1);
    box(g, F, hx - 6, hy + jy, 10, 3);
    if (atk) R(g, '#b03a48', hx - 4, hy + 3, 6, 2);
    for (i = 0; i < 3; i++) R(g, W, hx - 9 + i * 3, hy + 2, 1, atk ? 3 : 2);                      // colmillos superiores
    P(g, W, hx - 7, hy + jy - 1); P(g, W, hx - 3, hy + jy - 1);
    eyeE(g, s, hx - 3, hy - 4, EMBER, '#ffd0a0', 3); R(g, D[0], hx - 5, hy - 6, 6, 1); P(g, D[0], hx - 6, hy - 5);
    seam(g, TH, [[hx + 9, hy - 6], [hx + 10, hy + 1], [hx + 9, hy + 8]]);
    box(g, ['#6a5a48', '#8a7a66', '#3a3024'], hx + 1, hy + 2, 5, 5); for (i = 0; i < 3; i++) P(g, TH.st, hx + 1 + i * 2, hy + 2);
  }

  function paintAyudante(g, s) {
    var z = ['#d8d0b8', '#efe8d2', '#a79f86'], sk = ['#c9b79a', '#e0d0b4', '#9a8a70'], atk = s.atk, b = s.bob, sw = s.sw, i;
    var dx = atk ? -2 : (s.hurt ? 3 : 0), hx = -9 + dx + (s.hurt ? 3 : 0), hy = -51 + b + (s.hurt ? 2 : 0);
    var trousers = ['#3a3248', '#4f4560', '#221c2c'];
    g.translate(2, 0);
    // piernas flexionadas
    limbE(g, trousers, 6 + dx, -20, 7 + dx - sw, -11, 5); limbE(g, trousers, 7 + dx - sw, -11, 6 + dx - sw, -3, 4);
    box(g, MAT.leather, 2 + dx - sw, -4, 9, 4);
    limbE(g, trousers, 1 + dx, -20, -2 + dx + sw, -11, 5); limbE(g, trousers, -2 + dx + sw, -11, -5 + dx + sw * 2, -3, 4);
    box(g, MAT.leather, -11 + dx + sw * 2, -4, 9, 4); P(g, MAT.leather[1], -11 + dx + sw * 2, -3);
    g.translate(0, 6);       // el tronco va más bajo: está encorvado
    // bata encorvada
    poly(g, z[2], [[-2 + dx, -42 + b], [10 + dx, -38 + b], [13 + dx, -16], [4 + dx, -14]]);
    poly(g, z[0], [[-13 + dx, -42 + b], [3 + dx, -42 + b], [10 + dx, -16], [-9 + dx, -15]]);
    for (i = 0; i < 5; i++) poly(g, z[0], [[-9 + dx + i * 4, -16], [-7 + dx + i * 4, -12 - (i % 2) * 2], [-5 + dx + i * 4, -16]]);   // dobladillo roto
    R(g, z[1], -12 + dx, -41 + b, 3, 14);
    ov(g, '#8fbf3a', -4 + dx, -28, 3, 2.5); ov(g, '#b6ef7a', -5 + dx, -29, 1.2, 1);                 // mancha ácida
    R(g, C.blood, 2 + dx, -34, 3, 2); R(g, C.blood, 4 + dx, -32, 1, 3); P(g, C.blood, -6 + dx, -20); R(g, '#6a1a20', 0 + dx, -23, 2, 3);
    R(g, '#7a6a30', -8 + dx, -19, 4, 2);
    seamV(g, THD, 1 + dx, -40 + b, -17);
    box(g, MAT.leather, -9 + dx, -31, 16, 2);
    for (i = 0; i < 3; i++) { R(g, ['#6fbf3a', '#e0453f', '#7fd6e6'][i], -7 + dx + i * 5, -29, 3, 5); R(g, '#d8d0b8', -7 + dx + i * 5, -29, 3, 1); }   // viales al cinto
    // brazo trasero con jeringa
    limbE(g, z, 1 + dx, -40 + b, 4 + dx, -31, 4); limbE(g, sk, 4 + dx, -31, -2 + dx, -28 + (atk ? -4 : 0), 3);
    tline(g, MAT.steel[0], -2 + dx, -28 + (atk ? -4 : 0), -15 + dx, -24 + (atk ? -8 : 0), 2); P(g, '#e0e8f0', -17 + dx, -24 + (atk ? -8 : 0));
    tline(g, '#6fbf3a', -5 + dx, -27 + (atk ? -4 : 0), -10 + dx, -25 + (atk ? -6 : 0), 1); R(g, MAT.steel[2], 0 + dx, -30 + (atk ? -4 : 0), 1, 4);
    // cabeza
    var hair = '#b8b8c4';
    for (i = 0; i < 7; i++) poly(g, i % 2 ? '#8a8a96' : hair, [[hx - 7 + i * 2.5, hy - 4], [hx - 10 + i * 3.2 - (i > 3 ? 0 : 1), hy - 12 - (i % 3) * 2], [hx - 4 + i * 2.5, hy - 5]]);
    ov(g, sk[0], hx, hy, 7, 7.5); ov(g, sk[1], hx - 2, hy - 2, 3, 3);
    R(g, sk[2], hx + 2, hy - 3, 4, 7);
    ov(g, MAT.brass[2], hx - 4, hy - 2, 4.3, 4.3); ov(g, MAT.brass[0], hx - 4, hy - 2, 3.6, 3.6); ov(g, s.dead ? '#2a2030' : '#8fe06a', hx - 4, hy - 2, 2.6, 2.6);
    ov(g, MAT.brass[2], hx + 3, hy - 2, 3.6, 3.6); ov(g, MAT.brass[0], hx + 3, hy - 2, 3, 3); ov(g, s.dead ? '#2a2030' : '#ff6a5a', hx + 3, hy - 2, 2, 2);
    if (!s.dead) { P(g, '#fff', hx - 5, hy - 3); P(g, '#fff', hx + 2, hy - 3); P(g, OL, hx - 4, hy - 2); P(g, OL, hx + 3, hy - 1); }
    tline(g, OL, hx - 4, hy - 4, hx - 6, hy - 1, 1);                                             // grieta de la lente
    R(g, MAT.leather[2], hx - 8, hy - 3, 16, 1);
    R(g, '#2b1016', hx - 6, hy + 3, atk ? 10 : 8, atk ? 4 : 2);
    for (i = 0; i < (atk ? 5 : 4); i++) P(g, '#f0e8d0', hx - 6 + i * 2, hy + 3);
    P(g, sk[2], hx - 8, hy + 1); seam(g, THD, [[hx + 3, hy + 1], [hx + 6, hy + 4]]);
    R(g, sk[0], hx - 1, hy + 6, 4, 4);
    // brazo delantero con matraz
    var hx2 = atk ? -22 : -21, hy2 = atk ? -36 : -45 + b;
    limbE(g, z, -10 + dx, -40 + b, -16 + dx, -35 + (atk ? 2 : 0), 4); limbE(g, z, -16 + dx, -35 + (atk ? 2 : 0), hx2 + dx, hy2 + 2, 4);
    ov(g, sk[0], hx2 + dx, hy2 + 1, 2.5, 2.5);
    ov(g, MAT.brass[2], hx2 + dx - 2, hy2 - 6, 6.4, 6.4); ov(g, '#1c3a24', hx2 + dx - 2, hy2 - 6, 5.6, 5.6); ov(g, '#5fbf3a', hx2 + dx - 2, hy2 - 5, 5, 4.6);
    R(g, '#b6ef7a', hx2 + dx - 6, hy2 - 8, 1, 1); P(g, '#ffffff', hx2 + dx - 6, hy2 - 9); P(g, '#e8ffd0', hx2 + dx - 1 + (s.fr & 1), hy2 - 8 - (s.fr >> 1));
    R(g, MAT.leather[0], hx2 + dx - 3, hy2 - 14, 3, 3); R(g, MAT.brass[1], hx2 + dx - 4, hy2 - 12, 5, 1);
    R(g, '#5fbf3a', hx2 + dx - 5, hy2 - 11, 3, 1);
  }

  function paintGolem(g, s) {
    var st = MAT.stone, ir = MAT.iron, fl = FLESH, atk = s.atk, b = s.bob, i;
    var dx = atk ? -1 : 0, hd = s.hurt ? 3 : 0, ty = -50 + b;
    // piernas
    box(g, st, 2 + dx, -24, 12, 24); box(g, ir, 1 + dx, -16, 14, 3); box(g, st, 1 + dx, -6, 15, 6);
    box(g, st, -14 + dx, -24, 12, 24); box(g, ir, -15 + dx, -16, 14, 3); box(g, st, -16 + dx, -6, 15, 6);
    R(g, st[2], 8 + dx, -22, 1, 5); R(g, st[2], -9 + dx, -10, 1, 4); box(g, fl, -13 + dx, -24, 9, 7);
    seam(g, THD, [[-9 + dx, -24], [-9 + dx, -17]]); seam(g, TH, [[-16 + dx, -4], [-2 + dx, -3]]);
    for (i = 0; i < 3; i++) { P(g, ir[1], -12 + dx + i * 5, -15); P(g, ir[1], 4 + dx + i * 5, -15); }
    // torso
    poly(g, st[2], [[-22 + dx, ty + 1], [22 + dx, ty + 1], [16 + dx, -24], [-16 + dx, -24]]);
    poly(g, st[0], [[-23 + dx, ty], [21 + dx, ty], [15 + dx, -25], [-17 + dx, -25]]);
    poly(g, st[1], [[-23 + dx, ty], [-10 + dx, ty], [-12 + dx, -25], [-17 + dx, -25]]);
    box(g, fl, 5 + dx, ty + 4, 15, 14); box(g, ir, -17 + dx, ty + 18, 13, 12);
    for (i = 0; i < 3; i++) { P(g, ir[1], -15 + dx + i * 5, ty + 20); P(g, ir[1], -15 + dx + i * 5, ty + 28); }
    seam(g, THD, [[4 + dx, ty + 3], [4 + dx, ty + 19], [20 + dx, ty + 19]]);
    seam(g, THD, [[-4 + dx, ty + 18], [-4 + dx, ty + 30], [-16 + dx, ty + 30]]);
    seam(g, THD, [[-12 + dx, ty + 2], [-8 + dx, ty + 16]]);
    ov(g, '#1a0f0a', dx, ty + 23, 5, 5); ov(g, C.fire1, dx, ty + 23, 3.6 + (s.fr & 1) * 0.6, 3.6 + (s.fr & 1) * 0.6); ov(g, C.fire3, dx, ty + 23, 1.6, 1.6);
    tline(g, C.fire2, -4 + dx, ty + 20, -8 + dx, ty + 14, 1); tline(g, C.fire2, 4 + dx, ty + 26, 9 + dx, ty + 30, 1);
    for (i = 0; i < 11; i++) { var cx = -17 + dx + i * 3, cy = ty + 4 + i * 2.3; R(g, ir[1], cx, Math.round(cy), 2, 2); R(g, ir[2], cx + 1, Math.round(cy) + 1, 1, 1); }   // bandolera de cadena
    // cabeza
    var hh = dx + hd;
    box(g, st, -9 + hh, ty - 12, 18, 14); R(g, st[2], -9 + hh, ty - 1, 18, 1);
    R(g, ir[0], -10 + hh, ty - 8, 20, 2); P(g, ir[1], -9 + hh, ty - 8);
    eyeE(g, s, -7 + hh, ty - 5, '#ffb02e', '#fff0b0', 5); eyeE(g, s, 2 + hh, ty - 4, '#ffb02e', '#fff0b0', 3);
    R(g, '#1c1117', -5 + hh, ty - 1, 10, 2); for (i = 0; i < 5; i++) { P(g, MAT.bone[1], -5 + hh + i * 2, ty - 1); P(g, TH.st, -4 + hh + i * 2, ty); }
    box(g, ir, -12 + hh, ty - 7, 3, 3); box(g, ir, 9 + hh, ty - 7, 3, 3);
    P(g, st[2], -2 + hh, ty - 11); P(g, st[2], 4 + hh, ty - 10);
    // brazos
    var ay = ty + 2;
    box(g, st, 20 + dx, ay, 10, 20); box(g, st, 19 + dx, ay + 18, 12, 14); box(g, ir, 18 + dx, ay + 17, 13, 3);
    R(g, st[2], 24 + dx, ay + 22, 1, 7); R(g, st[1], 20 + dx, ay + 1, 10, 1);
    if (atk) {
      box(g, st, -28 + dx, ay - 2, 10, 28); box(g, ir, -29 + dx, ay + 9, 12, 3);
      box(g, st, -30 + dx, ay - 14, 14, 13); R(g, st[2], -26 + dx, ay - 9, 1, 6); R(g, st[2], -21 + dx, ay - 9, 1, 6);
      seam(g, THD, [[-28 + dx, ay + 15], [-20 + dx, ay + 16]]); box(g, fl, -28 + dx, ay + 1, 6, 6);
    } else {
      box(g, st, -29 + dx, ay, 10, 18); box(g, ir, -30 + dx, ay + 17, 12, 3);
      box(g, st, -31 + dx, ay + 20, 13, 15 - (s.hurt ? 2 : 0));
      R(g, st[2], -27 + dx, ay + 26, 1, 8); R(g, st[2], -22 + dx, ay + 26, 1, 8); R(g, st[1], -30 + dx, ay + 21, 11, 1);
      seam(g, THD, [[-30 + dx, ay + 8], [-21 + dx, ay + 9]]);
      box(g, fl, -30 + dx, ay + 2, 6, 6);
    }
  }

  function paintAlquimista(g, s) {
    var Rb = ['#4a2f66', '#6a4690', '#2a1a3c'], B = MAT.brass, GL = ['#2a5a58', '#6fb7b7', '#16302c'], atk = s.atk, b = s.bob, fr = s.fr, i;
    var dx = atk ? -1 : (s.hurt ? 3 : 0), ty = -46 + b;
    g.translate(2, 0);
    // zapatos puntiagudos bajo la túnica
    box(g, MAT.leather, -15 + dx, -3, 10, 3); box(g, MAT.leather, 2 + dx, -3, 10, 3);
    // mochila-depósito con líquido burbujeante
    box(g, GL, 9 + dx, ty + 2, 10, 24); R(g, '#5fbf3a', 10 + dx, ty + 9, 8, 16); R(g, '#b6ef7a', 10 + dx, ty + 9, 8, 1);
    P(g, '#e8ffd0', 12 + dx, ty + 22 - fr * 3); P(g, '#e8ffd0', 15 + dx, ty + 18 - ((fr + 2) & 3) * 3); P(g, '#e8ffd0', 13 + dx, ty + 14 - ((fr + 1) & 3) * 2);
    box(g, B, 8 + dx, ty, 12, 3); box(g, B, 8 + dx, ty + 25, 12, 3);
    // túnica
    poly(g, Rb[2], [[-10 + dx, ty + 3], [11 + dx, ty + 3], [16 + dx, -2], [-16 + dx, -2]]);
    poly(g, Rb[0], [[-11 + dx, ty + 2], [9 + dx, ty + 2], [14 + dx, -2], [-17 + dx, -2]]);
    poly(g, Rb[1], [[-11 + dx, ty + 2], [-5 + dx, ty + 2], [-8 + dx, -2], [-17 + dx, -2]]);
    for (i = 0; i < 5; i++) poly(g, Rb[0], [[-17 + dx + i * 6.5, -3], [-14 + dx + i * 6.5, 1], [-11 + dx + i * 6.5, -3]]);
    for (i = -8; i < 12; i += 6) R(g, Rb[2], i + dx, ty + 14, 1, 40 - 14 - 4 + (i & 1));
    R(g, B[0], -16 + dx, -9, 30, 2); for (i = -14; i < 14; i += 4) P(g, B[1], i + dx, -9);
    ov(g, '#6fbf3a', -10 + dx, -6, 3.2, 2.2); ov(g, '#b6ef7a', -11 + dx, -7, 1.2, 1); drip(g, -10 + dx, -4, 2, '#6fbf3a');
    box(g, MAT.leather, -10 + dx, ty + 24, 20, 3); box(g, B, -2 + dx, ty + 24, 4, 3);
    for (i = 0; i < 3; i++) { R(g, ['#6fbf3a', '#e0453f', '#7fd6e6'][i], -8 + dx + i * 6, ty + 27, 3, 5); R(g, '#e8dcc0', -8 + dx + i * 6, ty + 27, 3, 1); }
    // capucha y máscara
    poly(g, Rb[2], [[-10 + dx, ty + 6], [-8 + dx, ty - 7], [-1 + dx, ty - 14], [6 + dx, ty - 9], [10 + dx, ty + 4]]);
    poly(g, Rb[0], [[-11 + dx, ty + 5], [-9 + dx, ty - 7], [-2 + dx, ty - 15], [5 + dx, ty - 9], [8 + dx, ty + 4]]);
    poly(g, Rb[1], [[-9 + dx, ty - 6], [-2 + dx, ty - 15], [0 + dx, ty - 13], [-7 + dx, ty - 4]]);
    ov(g, MAT.iron[2], -5 + dx, ty - 1, 7.5, 7); ov(g, MAT.iron[0], -5 + dx, ty - 1.5, 6.8, 6.3);
    box(g, MAT.iron, -17 + dx, ty + 1, 9, 6); R(g, MAT.iron[2], -15 + dx, ty + 1, 1, 6); R(g, MAT.iron[2], -12 + dx, ty + 1, 1, 6);
    var lg = s.dead ? '#1c2a1c' : '#7dff5a';
    for (i = 0; i < 2; i++) {
      ov(g, B[2], -8.5 + dx + i * 6, ty - 3, 3.4, 3.4); ov(g, B[0], -8.5 + dx + i * 6, ty - 3, 2.8, 2.8);
      ov(g, s.hurt ? '#243824' : lg, -8.5 + dx + i * 6, ty - 3, 1.9, 1.9);
      if (!s.hurt && !s.dead) P(g, '#eaffd8', -9 + dx + i * 6, ty - 4);
    }
    tline(g, MAT.rubber[0], -9 + dx, ty + 6, -5 + dx, ty + 12, 2); tline(g, MAT.rubber[0], -5 + dx, ty + 12, 9 + dx, ty + 12, 2); tline(g, MAT.rubber[1], -5 + dx, ty + 11, 8 + dx, ty + 11, 1);
    // brazo delantero con retorta
    var fx = atk ? -20 : -21, fy = atk ? -36 : -45 + b;
    limbE(g, Rb, -8 + dx, ty + 5, -15 + dx, ty + 12 + (atk ? 2 : 0), 5); limbE(g, Rb, -15 + dx, ty + 12 + (atk ? 2 : 0), fx + dx, fy + 3, 5);
    R(g, B[0], fx + dx - 3, fy + 3, 6, 2); ov(g, '#2f6a2f', fx + dx, fy + 1, 2.6, 2.6);
    ov(g, B[2], fx + dx - 1, fy - 7, 6.2, 6.2); ov(g, GL[2], fx + dx - 1, fy - 7, 5.4, 5.4); ov(g, '#5fe040', fx + dx - 1, fy - 6, 4.8, 4.4);
    R(g, '#b6ef7a', fx + dx - 5, fy - 9, 2, 1); P(g, '#fff', fx + dx - 5, fy - 10); P(g, '#e8ffd0', fx + dx + (fr & 1), fy - 8 - (fr >> 1));
    box(g, GL, fx + dx - 3, fy - 16, 4, 6); R(g, MAT.leather[0], fx + dx - 4, fy - 17, 6, 2);
    if (atk) { for (i = 0; i < 3; i++) P(g, '#7dff5a', fx + dx - 7 - i * 2, fy - 8 + i * 2 - (i & 1)); }
    // corrupción: venas verdes
    if (!s.dead) { tline(g, '#7dff5a', 4 + dx, ty + 14, 7 + dx, ty + 22, 1); tline(g, '#4fbf3a', 7 + dx, ty + 22, 5 + dx, ty + 28, 1); }
  }

  function paintArana(g, s) {
    var B = MAT.brass, Cu = MAT.copper, St = MAT.steel, atk = s.atk, b = s.bob, sw = s.sw, fr = s.fr, i;
    var dx = atk ? -1 : (s.hurt ? 2 : 0), Y = -21 + b + (atk ? 2 : 0) + (s.hurt ? 1 : 0), up = atk ? 1 : 0;
    var LN = ['#5d6c7d', '#8d9db0', '#2f3742'], LF = ['#323a46', '#46505e', '#1c2129'];
    function leg(hx, kx, ky, fx, fy, m) {
      limbE(g, m, hx + dx, Y + 2, kx + dx, ky, 3); limbE(g, m, kx + dx, ky, fx + dx, fy, 3);
      ov(g, B[2], kx + dx, ky, 2.6, 2.6); ov(g, B[0], kx + dx, ky, 1.8, 1.8); P(g, B[1], kx + dx - 1, ky - 1);
      P(g, MAT.bone[1], fx + dx, fy); P(g, MAT.bone[0], fx + dx, fy - 1);
    }
    // patas lejanas (oscuras) y cercanas (claras), bien separadas
    leg(-3, -12, -41, -15 + sw * 2, 0, LF); leg(5, 13, -41, 16 - sw * 2, 0, LF);
    leg(-8, -23, -37 - up * 3, -29 + sw * 2 + up * 3, up ? -27 : 0, LN); leg(-4, -13, -44, -21 - sw * 2, 0, LN);
    leg(6, 15, -44, 22 + sw * 2, 0, LN); leg(10, 23, -38, 27 - sw * 2, 0, LN);
    // abdomen con engranaje
    ov(g, Cu[2], 10 + dx, Y + 1, 13, 11); ov(g, B[0], 10 + dx, Y, 12.5, 10.5); ov(g, B[1], 6 + dx, Y - 5, 6, 3);
    ov(g, B[2], 10 + dx, Y - 1, 7.5, 7.5); ov(g, Cu[0], 10 + dx, Y - 1, 6.6, 6.6); ov(g, '#2a1a10', 10 + dx, Y - 1, 2.4, 2.4);
    for (i = 0; i < 8; i++) { var a = i * Math.PI / 4 + (fr & 1) * Math.PI / 8; R(g, B[1], 10 + dx + Math.round(Math.cos(a) * 6.6) - 1, Y - 1 + Math.round(Math.sin(a) * 6.6) - 1, 2, 2); tline(g, B[2], 10 + dx, Y - 1, 10 + dx + Math.round(Math.cos(a) * 4.6), Y - 1 + Math.round(Math.sin(a) * 4.6), 1); }
    for (i = 0; i < 4; i++) P(g, B[1], 2 + dx + i * 5, Y + 8);
    box(g, St, 18 + dx, Y - 16, 3, 7); P(g, 'rgba(215,220,230,0.85)', 19 + dx + (fr & 1), Y - 19); P(g, 'rgba(215,220,230,0.6)', 20 + dx, Y - 22 - (fr >> 1));
    // cefalotórax y cabeza
    ov(g, Cu[2], -9 + dx, Y + 1, 9, 8); ov(g, Cu[0], -9 + dx, Y, 8.5, 7.5); ov(g, Cu[1], -11 + dx, Y - 3, 3.5, 2.5);
    box(g, B, -6 + dx, Y - 6, 6, 3);
    var eyc = s.dead ? '#2a1a10' : EMBER;
    ov(g, eyc, -14 + dx, Y - 2, 2.3, 2.3); ov(g, eyc, -10 + dx, Y - 5, 1.6, 1.6); ov(g, eyc, -15 + dx, Y + 2, 1.3, 1.3); ov(g, eyc, -12 + dx, Y - 6, 1.1, 1.1);
    if (!s.dead) { P(g, '#ffd0a0', -15 + dx, Y - 3); P(g, '#ffd0a0', -10 + dx, Y - 6); }
    var op = atk ? 4 : 0;   // mandíbulas como bisturíes
    poly(g, St[0], [[-16 + dx, Y + 3], [-12 + dx, Y + 4], [-19 + dx - op, Y + 12]]); poly(g, St[1], [[-16 + dx, Y + 3], [-15 + dx, Y + 4], [-19 + dx - op, Y + 12]]);
    poly(g, St[0], [[-12 + dx, Y + 5], [-8 + dx, Y + 5], [-10 + dx + op, Y + 13]]); P(g, C.blood, -19 + dx - op, Y + 11); P(g, C.blood, -10 + dx + op, Y + 12);
    seam(g, TH, [[-1 + dx, Y - 7], [1 + dx, Y + 1], [0 + dx, Y + 8]]);
  }

  function paintCirujano(g, s) {
    var T = ['#3f8f8a', '#62b5ae', '#2a5f66'], AP = ['#5a4630', '#7a6045', '#3a2c1e'], GLV = ['#d8c060', '#f0dc88', '#9a8638'], atk = s.atk, b = s.bob, sw = s.sw, i;
    var dx = atk ? -3 : (s.hurt ? 3 : 0), ty = -46 + b, hd = atk ? -3 : (s.hurt ? 2 : -1);
    g.translate(5, 0);
    // botas y piernas
    limbE(g, T, 2 + dx, -26, 4 + dx - sw, -12, 5); limbE(g, T, 4 + dx - sw, -12, 4 + dx - sw, -3, 4); box(g, MAT.rubber, 0 + dx - sw, -5, 10, 5);
    limbE(g, T, -2 + dx, -26, -5 + dx + sw, -12, 5); limbE(g, T, -5 + dx + sw, -12, -6 + dx + sw * 2, -3, 4); box(g, MAT.rubber, -12 + dx + sw * 2, -5, 10, 5);
    // brazo trasero con bisturí
    limbE(g, T, 5 + dx, ty + 4, 9 + dx, ty + 14, 4); limbE(g, GLV, 9 + dx, ty + 14, 6 + dx, ty + 20 + (atk ? -5 : 0), 3);
    tline(g, MAT.steel[0], 6 + dx, ty + 20 + (atk ? -5 : 0), 1 + dx, ty + 27 + (atk ? -6 : 0), 1);
    // torso con ropa de quirófano
    poly(g, T[2], [[-9 + dx, ty + 4], [9 + dx, ty + 4], [8 + dx, -24], [-8 + dx, -24]]);
    poly(g, T[0], [[-10 + dx, ty + 3], [7 + dx, ty + 3], [7 + dx, -24], [-9 + dx, -24]]);
    // delantal
    poly(g, AP[2], [[-8 + dx, ty + 7], [9 + dx, ty + 7], [11 + dx, -10], [-10 + dx, -10]]);
    poly(g, AP[0], [[-9 + dx, ty + 6], [8 + dx, ty + 6], [10 + dx, -11], [-11 + dx, -11]]);
    for (i = -9; i < 10; i += 4) poly(g, AP[0], [[i + dx, -11], [i + 2 + dx, -8], [i + 4 + dx, -11]]);
    R(g, AP[1], -9 + dx, ty + 6, 2, 28);
    R(g, C.blood, -5 + dx, ty + 12, 7, 5); R(g, C.blood, -7 + dx, ty + 17, 4, 7); R(g, C.bloodHi, -5 + dx, ty + 12, 2, 1); R(g, '#6a1a20', 1 + dx, ty + 20, 6, 4); R(g, C.blood, 3 + dx, ty + 26, 3, 6);
    drip(g, -5 + dx, ty + 24, 3, C.blood);
    R(g, AP[2], -8 + dx, ty + 4, 2, 4); R(g, AP[2], 6 + dx, ty + 4, 2, 4);
    // cabeza: gorro, máscara y espejo frontal
    var sk = ['#d8c8b0', '#eee0c8', '#a89880'];
    ov(g, sk[0], -3 + dx + hd, ty - 4, 6.5, 7); R(g, sk[0], -3 + dx + hd, ty + 2, 4, 3);
    ov(g, T[0], -3 + dx + hd, ty - 8, 7.2, 5.5); R(g, T[0], -9 + dx + hd, ty - 8, 13, 4); R(g, T[2], -10 + dx + hd, ty - 5, 14, 1);
    box(g, ['#d8dde0', '#f4f8fa', '#9aa4ac'], -9 + dx + hd, ty - 2, 13, 8);                        // mascarilla
    R(g, C.blood, -8 + dx + hd, ty + 1, 4, 3); drip(g, -7 + dx + hd, ty + 4, 2, C.blood); R(g, '#9aa4ac', 0 + dx + hd, ty - 1, 1, 6);
    eyeE(g, s, -8 + dx + hd, ty - 5, '#fdfdf0', '#ffffff', 4); eyeE(g, s, -1 + dx + hd, ty - 5, '#fdfdf0', '#ffffff', 4);
    if (!s.dead && !s.hurt) { P(g, '#a32a1a', -7 + dx + hd, ty - 5); P(g, '#a32a1a', 0 + dx + hd, ty - 5); P(g, OL, -7 + dx + hd, ty - 4); P(g, OL, 0 + dx + hd, ty - 4); }
    R(g, OL, -9 + dx + hd, ty - 7, 5, 1); R(g, OL, -2 + dx + hd, ty - 7, 5, 1);
    R(g, MAT.iron[0], -9 + dx + hd, ty - 10, 13, 2);                                              // cinta del espejo
    ov(g, MAT.steel[1], -5 + dx + hd, ty - 12, 3.6, 3.6); ov(g, '#e8f4ff', -5 + dx + hd, ty - 12, 2.6, 2.6); ov(g, '#2a3038', -5 + dx + hd, ty - 12, 1, 1); P(g, '#ffffff', -7 + dx + hd, ty - 14);
    // brazo delantero con sierra
    var ax = atk ? -12 : -12, ay = atk ? ty + 12 : ty + 18;
    limbE(g, T, -8 + dx, ty + 4, -12 + dx, ty + 11, 4); limbE(g, T, -12 + dx, ty + 11, ax + dx, ay, 4);
    ov(g, GLV[0], ax + dx, ay, 3, 3); P(g, GLV[1], ax + dx - 1, ay - 1); R(g, C.blood, ax + dx - 1, ay, 2, 2);
    if (atk) {
      poly(g, MAT.steel[0], [[ax + dx + 1, ay - 3], [ax + dx - 18, ay + 8], [ax + dx - 18, ay + 14], [ax + dx + 1, ay + 3]]);
      for (i = 0; i < 6; i++) P(g, MAT.steel[1], ax + dx - 2 - i * 3, ay + 4 + i + 1 - (i & 1)); tline(g, MAT.steel[1], ax + dx, ay - 2, ax + dx - 17, ay + 8, 1);
    } else {
      poly(g, MAT.steel[0], [[ax + dx - 1, ay - 2], [ax + dx - 16, ay - 6], [ax + dx - 16, ay + 2], [ax + dx - 1, ay + 3]]);
      for (i = 0; i < 5; i++) { P(g, MAT.steel[2], ax + dx - 3 - i * 3, ay + 3 + (i & 1)); }
      tline(g, MAT.steel[1], ax + dx - 1, ay - 2, ax + dx - 15, ay - 5, 1); P(g, C.blood, ax + dx - 7, ay); P(g, C.blood, ax + dx - 12, ay - 2);
    }
    box(g, MAT.brass, ax + dx - 1, ay - 3, 4, 7);
  }

  function paintAutomata(g, s) {
    var B = MAT.brass, St = MAT.steel, I = MAT.iron, atk = s.atk, b = s.bob, sw = s.sw, fr = s.fr, i;
    var dx = atk ? -1 : 0, ty = -48 + b;
    g.translate(2, 0);
    // llave de cuerda en la espalda
    R(g, St[2], 16 + dx, ty + 14, 6, 3); box(g, B, 21 + dx, ty + 8 + (fr & 1), 5, 6); box(g, B, 21 + dx, ty + 17 - (fr & 1), 5, 6);
    // piernas de pistón
    for (i = 0; i < 2; i++) {
      var lx = i ? 3 : -13, o = i ? sw : -sw;
      box(g, B, lx + dx, -27, 10, 14); R(g, B[2], lx + dx, -22, 10, 1); R(g, St[1], lx + 4 + dx, -13, 2, 6 + o);
      ov(g, I[2], lx + 5 + dx, -13, 4, 4); ov(g, I[0], lx + 5 + dx, -13, 3, 3); P(g, B[1], lx + 4 + dx, -14);
      box(g, B, lx - 2 + dx + o, -6, 14, 6); R(g, I[2], lx - 2 + dx + o, -2, 14, 2); P(g, B[1], lx - 1 + dx + o, -5); P(g, B[1], lx + 10 + dx + o, -5);
    }
    box(g, I, -13 + dx, -30, 26, 5);
    // torso de latón con ventana de engranajes
    box(g, B, -16 + dx, ty + 4, 32, 25); R(g, B[2], -16 + dx, ty + 12, 32, 1);
    for (i = -14; i < 15; i += 6) { P(g, B[1], i + dx, ty + 6); P(g, B[1], i + dx, ty + 26); }
    box(g, ['#140e12', '#2a1f26', '#0a070a'], -9 + dx, ty + 7, 18, 16);
    var cr = 5;
    ov(g, B[0], -3 + dx, ty + 15, cr, cr); ov(g, '#140e12', -3 + dx, ty + 15, 1.6, 1.6);
    for (i = 0; i < 8; i++) { var a = i * Math.PI / 4 + (fr & 1) * Math.PI / 8; R(g, B[1], -3 + dx + Math.round(Math.cos(a) * 5.4), ty + 15 + Math.round(Math.sin(a) * 5.4), 1, 1); }
    ov(g, C.copper, 5 + dx, ty + 19, 3, 3); P(g, '#140e12', 5 + dx, ty + 19);
    for (i = 0; i < 4; i++) { var a2 = -i * Math.PI / 2 + (fr & 1) * Math.PI / 4; P(g, B[1], 5 + dx + Math.round(Math.cos(a2) * 3.4), ty + 19 + Math.round(Math.sin(a2) * 3.4)); }
    R(g, C.fire2, -8 + dx, ty + 21, 16, 1); R(g, C.fire3, -6 + dx + (fr * 3 % 10), ty + 21, 4, 1);
    // hombreras, chimeneas y vapor
    ov(g, B[2], -18 + dx, ty + 6, 6, 5.5); ov(g, B[0], -18 + dx, ty + 6, 5.3, 4.8); P(g, B[1], -20 + dx, ty + 4);
    ov(g, B[2], 18 + dx, ty + 6, 6, 5.5); ov(g, B[0], 18 + dx, ty + 6, 5.3, 4.8);
    box(g, I, -13 + dx, ty - 3, 4, 8); box(g, I, 9 + dx, ty - 3, 4, 8);
    P(g, 'rgba(215,220,230,0.8)', -12 + dx + (fr & 1), ty - 6); P(g, 'rgba(215,220,230,0.6)', -11 + dx, ty - 9 - (fr >> 1)); P(g, 'rgba(215,220,230,0.7)', 10 + dx - (fr & 1), ty - 6 - (fr >> 1));
    // cabeza con visor
    box(g, B, -9 + dx, ty - 10, 18, 13); g.clearRect(-9 + dx, ty - 10, 1, 1); g.clearRect(8 + dx, ty - 10, 1, 1);
    R(g, '#140e12', -8 + dx, ty - 6, 16, 4); R(g, s.dead ? '#3a2a10' : (s.hurt ? '#7a4a10' : '#ffb02e'), -7 + dx, ty - 5, 14, 2);
    if (!s.dead && !s.hurt) R(g, '#fff0b0', -7 + dx + ((fr * 4) % 11), ty - 5, 3, 1);
    R(g, I[2], -5 + dx, ty, 10, 2); for (i = -4; i < 5; i += 2) P(g, B[1], i + dx, ty);
    R(g, St[2], 0 + dx, ty - 12, 1, 3); ov(g, s.hurt ? C.warn : C.blood, 0.5 + dx, ty - 13.5, 1.4, 1.4);
    P(g, B[1], -8 + dx, ty - 9); P(g, B[2], 7 + dx, ty - 3);
    // brazo trasero
    box(g, B, 19 + dx, ty + 11, 8, 13); R(g, B[2], 19 + dx, ty + 17, 8, 1); box(g, I, 20 + dx, ty + 24, 6, 7); box(g, St, 19 + dx, ty + 31, 9, 8);
    // brazo delantero: hidráulico, el antebrazo se extiende al golpear
    box(g, B, -25 + dx, ty + 8, 8, 12); R(g, B[2], -25 + dx, ty + 13, 8, 1);
    if (atk) {
      ov(g, I[0], -21 + dx, ty + 21, 4, 4);
      box(g, I, -25 + dx, ty + 19, 7, 5); R(g, St[1], -28 + dx, ty + 20, 4, 3);
      box(g, St, -31 + dx, ty + 15, 11, 12); R(g, St[2], -29 + dx, ty + 17, 1, 8); R(g, St[2], -26 + dx, ty + 17, 1, 8); R(g, St[2], -23 + dx, ty + 17, 1, 8);
    } else {
      box(g, I, -24 + dx, ty + 20, 6, 10); R(g, St[1], -23 + dx, ty + 30, 4, 4 + (fr & 1));
      box(g, St, -27 + dx, ty + 33 + (fr & 1), 11, 11); R(g, St[2], -25 + dx, ty + 36 + (fr & 1), 1, 7); R(g, St[2], -22 + dx, ty + 36 + (fr & 1), 1, 7); R(g, St[2], -19 + dx, ty + 36 + (fr & 1), 1, 7);
    }
    if (s.hurt) { P(g, C.warn, -10 + dx, ty + 2); P(g, C.warn, 12 + dx, ty - 4); P(g, '#fff6b0', 5 + dx, ty + 12); P(g, C.warn, -19 + dx, ty + 14); }
  }

  function paintQuimera(g, s) {
    var Fz = MAT.scale, Dk = ['#7c2412', '#9a3018', '#4a1208'], Mz = ['#e8a060', '#ffd09a', '#b06a3a'], atk = s.atk, b = s.bob, sw = s.sw, fr = s.fr, i;
    g.translate(1, 0);
    var dx = atk ? -2 : (s.hurt ? 1 : 0), ln = atk ? 3 : 0, Y = -27 + b + ln;
    var hx = -14 + dx - (atk ? 1 : 0), hy = -33 + b + ln - (s.hurt ? 5 : 0);
    // patas lejanas
    limbE(g, Dk, -3 + dx, Y + 5, -4 + dx - (atk ? 3 : 0) - sw, -2, 5); limbE(g, Dk, 7 + dx, Y + 4, 6 + dx + sw * 2, -2, 6);
    box(g, Dk, -8 + dx - sw, -3, 8, 3); box(g, Dk, 2 + dx + sw * 2, -3, 8, 3);
    // serpiente-cola
    var tx = 19 + dx;
    tline(g, '#2f7a34', tx, Y, tx + 7, Y - 5, 4); tline(g, '#3f9a44', tx + 7, Y - 5, tx + 8, Y - 14, 4); tline(g, '#2f7a34', tx + 8, Y - 14, tx + 3, Y - 19 - (fr & 1), 4);
    for (i = 0; i < 4; i++) P(g, '#8fdc6a', tx + 7 + (i & 1), Y - 6 - i * 2);
    ov(g, '#3f9a44', tx + 1, Y - 21 - (fr & 1), 4.2, 3.4); P(g, '#ffd15a', tx - 1, Y - 22 - (fr & 1)); R(g, '#ff3a30', tx - 6, Y - 20 - (fr & 1), 4, 1); P(g, '#ff3a30', tx - 7, Y - 21 - (fr & 1));
    // cuerpo de león
    ov(g, Dk[0], 4 + dx, Y + 1, 18, 11.5); ov(g, Fz[0], 4 + dx, Y - 1, 18, 11);
    ov(g, Fz[0], 15 + dx, Y - 1, 11, 12); ov(g, Fz[0], -8 + dx, Y - 1, 11, 11.5);
    ov(g, Mz[0], 1 + dx, Y + 6, 12, 4);
    for (i = 0; i < 4; i++) { tline(g, Dk[0], 3 + dx + i * 4, Y - 11, 6 + dx + i * 4, Y - 1, 2); }     // rayas
    for (i = 0; i < 5; i++) P(g, Fz[1], 0 + dx + i * 4, Y - 6 + (i & 1) * 2);
    seam(g, TH, [[-6 + dx, Y - 11], [-4 + dx, Y - 3], [-5 + dx, Y + 5]]);
    // llamas del lomo
    for (i = 0; i < 6; i++) flameTongue(g, -6 + dx + i * 4, Y - 11 + b, 3, 8 + ((i * 5 + fr * 3) % 5));
    // patas cercanas
    var fx = -9 + dx - (atk ? 4 : 0) + sw * 2;
    limbE(g, Fz, -9 + dx, Y + 5, fx, -3, 6); box(g, Mz, fx - 5, -3, 10, 3); P(g, MAT.bone[1], fx - 6, -1);
    limbE(g, Fz, 13 + dx, Y + 3, 18 + dx - sw * 2, -10, 8); limbE(g, Fz, 18 + dx - sw * 2, -10, 16 + dx + sw, -2, 4);
    box(g, Mz, 11 + dx + sw, -3, 9, 3); P(g, MAT.bone[1], 10 + dx + sw, -1);
    // cabra en el lomo
    var gx = 8 + dx, gy = Y - 19 + b;
    tline(g, '#d8c8a8', gx + 2, Y - 10, gx - 1, gy + 4, 5);
    ov(g, '#d8c8a8', gx - 2, gy, 5, 4.4); box(g, ['#f0e4c8', '#fff8e0', '#a89878'], gx - 8, gy - 1, 6, 4);
    tline(g, MAT.bone[0], gx, gy - 4, gx + 4, gy - 9, 2); tline(g, MAT.bone[0], gx + 4, gy - 9, gx + 8, gy - 8, 2);
    R(g, s.dead ? OL : '#ffd15a', gx - 4, gy - 2, 2, 1); P(g, '#f0e4c8', gx - 6, gy + 4); P(g, '#f0e4c8', gx - 6, gy + 5);
    // cabeza de león y melena
    var angs = [-150, -120, -90, -60, -30, 10, 40, 70, 100, 130];
    for (i = 0; i < angs.length; i++) flameDir(g, hx + 5 + Math.cos(angs[i] * Math.PI / 180) * 6, hy + Math.sin(angs[i] * Math.PI / 180) * 6, angs[i] + ((i + fr) & 1 ? 8 : -8), 15 + ((i * 3 + fr * 2) % 5), 4.5);
    ov(g, Fz[2], hx + 5, hy, 11, 10); ov(g, Fz[0], hx + 5, hy, 10.4, 9.4);
    tline(g, MAT.bone[0], hx + 7, hy - 7, hx + 12, hy - 11, 3); tline(g, MAT.bone[0], hx + 12, hy - 11, hx + 15, hy - 7, 2);
    box(g, Mz, hx - 9, hy - 2, 13, 7); R(g, Mz[1], hx - 8, hy - 2, 10, 1);
    R(g, '#3a1410', hx - 10, hy - 3, 3, 4); P(g, '#7a5a5a', hx - 10, hy - 3);
    if (atk) {
      R(g, '#2b1016', hx - 7, hy + 3, 12, 6); R(g, C.fire2, hx - 6, hy + 5, 10, 3);
      poly(g, C.fire1, [[hx - 8, hy + 3], [hx - 14, hy - 1], [hx - 14, hy + 12], [hx - 8, hy + 9]]); poly(g, C.fire2, [[hx - 8, hy + 4], [hx - 13, hy + 2], [hx - 13, hy + 10], [hx - 8, hy + 8]]); poly(g, C.fire3, [[hx - 8, hy + 5], [hx - 11, hy + 5], [hx - 8, hy + 7]]);
    } else { R(g, '#2b1016', hx - 7, hy + 3, 11, 1); box(g, Fz, hx - 6, hy + 4, 9, 3); }
    for (i = 0; i < 3; i++) R(g, MAT.bone[1], hx - 8 + i * 4, hy + 3, 1, atk ? 3 : 2);
    eyeE(g, s, hx - 2, hy - 5, '#ffd15a', '#fff6b0', 3); if (!s.dead && !s.hurt) { P(g, OL, hx - 1, hy - 5); P(g, OL, hx - 1, hy - 4); }
    R(g, Fz[2], hx - 4, hy - 7, 6, 1);
    if (!s.dead) { P(g, C.fire3, hx + 14 + (fr & 1), hy - 16 - fr); P(g, C.fire2, hx + 18, hy - 12 + (fr >> 1)); }
  }

  function paintRelojero(g, s) {
    var CT = ['#2f2538', '#473a54', '#1c1524'], B = MAT.brass, sk = ['#d8c8b0', '#eee0c8', '#a89880'], atk = s.atk, b = s.bob, sw = s.sw, fr = s.fr, i;
    var dx = atk ? -2 : (s.hurt ? 3 : 0), ty = -41 + b, hd = atk ? -2 : (s.hurt ? 2 : 0);
    g.translate(3, 0);
    var tr = ['#3a3046', '#574a66', '#221a2c'];
    // piernas y botas
    limbE(g, tr, 3 + dx, -22, 4 + dx - sw, -12, 4); limbE(g, tr, 4 + dx - sw, -12, 3 + dx - sw, -3, 4); box(g, MAT.rubber, 0 + dx - sw, -4, 10, 4); R(g, B[0], -2 + dx - sw, -3, 3, 3);
    limbE(g, tr, -2 + dx, -22, -4 + dx + sw, -12, 4); limbE(g, tr, -4 + dx + sw, -12, -6 + dx + sw * 2, -3, 4); box(g, MAT.rubber, -13 + dx + sw * 2, -4, 10, 4); R(g, B[0], -15 + dx + sw * 2, -3, 3, 3);
    // faldones del frac
    poly(g, CT[2], [[2 + dx, ty + 12], [14 + dx, ty + 12], [13 + dx, -12 + (b ? 1 : 0)], [8 + dx, -14], [3 + dx, -10]]);
    poly(g, CT[0], [[-10 + dx, ty + 4], [10 + dx, ty + 4], [14 + dx, -10], [9 + dx, -13], [5 + dx, -8], [0 + dx, -13], [-4 + dx, -10], [-11 + dx, -16]]);
    poly(g, CT[1], [[-10 + dx, ty + 4], [-4 + dx, ty + 4], [-6 + dx, -14], [-11 + dx, -16]]);
    // chaleco y reloj en el pecho
    poly(g, '#8a7a8e', [[-4 + dx, ty + 5], [4 + dx, ty + 5], [3 + dx, ty + 20], [-3 + dx, ty + 20]]);
    ov(g, B[2], 0 + dx, ty + 12, 7, 7); ov(g, B[0], 0 + dx, ty + 12, 6.2, 6.2); ov(g, '#efe6cc', 0 + dx, ty + 12, 5, 5);
    for (i = 0; i < 12; i += 3) { var a = i * Math.PI / 6; P(g, '#3a3046', dx + Math.round(Math.cos(a) * 4 - 0.5), ty + 12 + Math.round(Math.sin(a) * 4 - 0.5)); }
    var ma = -Math.PI / 2 + fr * Math.PI / 2 + 0.3; tline(g, '#1c1524', dx, ty + 12, dx + Math.round(Math.cos(ma) * 4), ty + 12 + Math.round(Math.sin(ma) * 4), 1);
    tline(g, '#7a1a20', dx, ty + 12, dx + 2, ty + 10, 1);
    for (i = 0; i < 4; i++) { P(g, B[1], -1 + dx, ty + 6 + i * 4 + (i > 0 ? 7 : 0)); }
    tline(g, B[1], 4 + dx, ty + 6, 9 + dx, ty + 16, 1);                          // cadena del reloj
    seam(g, TH, [[-6 + dx, ty + 16], [-6 + dx, ty + 26]]);
    // cabeza: cara delgada, lupa y sombrero de copa con esfera
    var hx = -3 + dx + hd, hy = ty - 7;
    for (i = 0; i < 3; i++) { R(g, '#c8c8d0', hx - 8, hy - 1 + i * 2, 3 - (i & 1), 1); R(g, '#c8c8d0', hx + 5, hy - 1 + i * 2, 3 - (i & 1), 1); }
    ov(g, sk[0], hx, hy, 6.5, 7.5); R(g, sk[2], hx + 2, hy - 2, 4, 8); ov(g, sk[1], hx - 2, hy - 2, 3, 3);
    R(g, sk[0], hx - 2, hy + 6, 5, 6); R(g, sk[2], hx + 2, hy + 6, 1, 6); R(g, '#efe6cc', hx - 3, hy + 9, 7, 3); R(g, C.blood, hx - 1, hy + 10, 3, 2);
    tline(g, sk[2], hx - 7, hy + 1, hx - 9, hy + 3, 2);
    ov(g, B[2], hx - 3.5, hy - 1, 5, 5); ov(g, B[0], hx - 3.5, hy - 1, 4.2, 4.2); ov(g, '#a8e8f4', hx - 3.5, hy - 1, 3.2, 3.2);
    if (s.dead) { R(g, OL, hx - 5, hy - 2, 1, 1); R(g, OL, hx - 3, hy - 2, 1, 1); R(g, OL, hx - 4, hy - 1, 1, 1); R(g, OL, hx - 5, hy, 1, 1); R(g, OL, hx - 3, hy, 1, 1); }
    else if (s.hurt) R(g, OL, hx - 5, hy - 1, 4, 1); else { R(g, '#fdfdf0', hx - 5, hy - 2, 3, 3); P(g, '#a32a1a', hx - 4, hy - 1); P(g, OL, hx - 4, hy - 1); }
    P(g, '#ffffff', hx - 6, hy - 3);
    eyeE(g, s, hx + 1, hy - 2, '#fdfdf0', '#ffffff', 3); if (!s.dead && !s.hurt) P(g, '#a32a1a', hx + 1, hy - 1);
    R(g, OL, hx + 2, hy + 3, 4, 1); if (atk) R(g, '#2b1016', hx, hy + 4, 5, 2);
    tline(g, OL, hx - 6, hy + 3, hx - 4, hy + 5, 1);
    box(g, ['#221a2c', '#3a3046', '#120c18'], hx - 10, hy - 5, 20, 3);                                  // ala
    box(g, ['#221a2c', '#3a3046', '#120c18'], hx - 7, hy - 14, 14, 10);
    R(g, B[0], hx - 7, hy - 7, 14, 2);
    ov(g, B[2], hx - 2.5, hy - 10.5, 3.4, 3.4); ov(g, '#efe6cc', hx - 2.5, hy - 10.5, 2.6, 2.6);
    tline(g, OL, hx - 2, hy - 10, hx - 2 + ((fr & 1) ? 1 : -1), hy - 12, 1); P(g, OL, hx - 2, hy - 10);
    P(g, B[1], hx + 3, hy - 13); P(g, B[1], hx + 4, hy - 12);
    // brazo de engranajes con cetro-péndulo
    var ax = atk ? -16 : -17, ay = atk ? ty + 14 : ty + 18;
    limbE(g, CT, -9 + dx, ty + 6, -14 + dx, ty + 12, 4); box(g, B, ax + dx - 2, ay - 4, 6, 8); P(g, CT[2], ax + dx, ay); P(g, B[1], ax + dx - 1, ay - 3);
    limbE(g, B, -14 + dx, ty + 12, ax + dx + 1, ay - 4, 4); ov(g, B[2], -14 + dx, ty + 12, 2.5, 2.5); ov(g, B[0], -14 + dx, ty + 12, 1.6, 1.6);
    ov(g, sk[0], ax + dx, ay + 3, 2.5, 2.5);
    if (atk) {
      tline(g, B[0], ax + dx, ay + 2, ax + dx - 9, ay - 4, 2); ov(g, B[2], ax + dx - 11, ay - 5, 4.4, 4.4); ov(g, B[0], ax + dx - 11, ay - 5, 3.6, 3.6); ov(g, '#2a1a10', ax + dx - 11, ay - 5, 1.2, 1.2);
    } else {
      tline(g, B[0], ax + dx, ay + 3, ax + dx - 3, ty - 14, 2); ov(g, B[2], ax + dx - 3, ty - 16, 4.4, 4.4); ov(g, B[0], ax + dx - 3, ty - 16, 3.6, 3.6); ov(g, '#2a1a10', ax + dx - 3, ty - 16, 1.2, 1.2);
      var px = ax + dx - 4 + (fr === 0 ? -3 : fr === 2 ? 3 : 0);
      tline(g, B[2], ax + dx - 2, ty - 6, px, ty + 4, 1); ov(g, B[2], px, ty + 6, 3.2, 3.2); ov(g, B[0], px, ty + 6, 2.6, 2.6); P(g, B[1], px - 1, ty + 5);
    }
    // brazo trasero con reloj de bolsillo
    limbE(g, CT, 8 + dx, ty + 6, 11 + dx, ty + 15, 4); ov(g, sk[0], 11 + dx, ty + 18, 2.4, 2.4);
    tline(g, B[1], 11 + dx, ty + 19, 12 + dx, ty + 24, 1); ov(g, B[0], 12 + dx, ty + 26, 2.5, 2.5); P(g, '#efe6cc', 12 + dx, ty + 26);
  }

  function paintVivisector(g, s) {
    var LE = ['#46322a', '#6a4c3a', '#241911'], AP = ['#5e4330', '#85604a', '#33231a'], St = MAT.steel, atk = s.atk, b = s.bob, sw = s.sw, fr = s.fr, i;
    var dx = atk ? -3 : (s.hurt ? 2 : 0), ty = -46 + b, sk = ['#c79a8a', '#e0b8a8', '#8a5f52'];
    g.translate(2, 0);
    // brazos mecánicos traseros (detrás del cuerpo)
    var up = atk ? -3 : (s.hurt ? 3 : 0) + ((fr & 1) ? -1 : 0);
    tline(g, St[2], 8 + dx, ty + 6, 15 + dx, ty - 2, 3); tline(g, St[0], 15 + dx, ty - 2, 19 + dx, ty - 10 + up, 2);
    tline(g, St[2], 19 + dx, ty - 10 + up, 14 + dx, ty - 11 + up + (atk ? 8 : 0), 2);
    ov(g, MAT.brass[0], 15 + dx, ty - 2, 2.4, 2.4); ov(g, MAT.brass[0], 19 + dx, ty - 10 + up, 2, 2);
    poly(g, St[1], [[14 + dx, ty - 11 + up + (atk ? 8 : 0)], [12 + dx, ty - 17 + up + (atk ? 10 : 0)], [15 + dx, ty - 12 + up + (atk ? 8 : 0)]]); P(g, C.blood, 12 + dx, ty - 17 + up + (atk ? 10 : 0));
    tline(g, St[2], 10 + dx, ty + 10, 20 + dx, ty + 6, 3); tline(g, St[0], 20 + dx, ty + 6, 24 + dx, ty - 2 + up, 2);
    ov(g, MAT.brass[0], 20 + dx, ty + 6, 2.4, 2.4);
    tline(g, St[1], 24 + dx, ty - 2 + up, 25 + dx, ty - 10 + up, 1); tline(g, St[1], 24 + dx, ty - 2 + up, 28 + dx, ty - 9 + up, 1);
    // piernas
    limbE(g, LE, 5 + dx, -24, 7 + dx - sw, -12, 8); limbE(g, LE, 7 + dx - sw, -12, 6 + dx - sw, -4, 6); box(g, MAT.rubber, 0 + dx - sw, -6, 14, 6); R(g, St[0], -1 + dx - sw, -3, 4, 3);
    limbE(g, LE, -6 + dx, -24, -8 + dx + sw, -12, 8); limbE(g, LE, -8 + dx + sw, -12, -10 + dx + sw * 2, -4, 6); box(g, MAT.rubber, -19 + dx + sw * 2, -6, 14, 6); R(g, St[0], -20 + dx + sw * 2, -3, 4, 3);
    // torso y delantal de carnicero
    poly(g, LE[2], [[-19 + dx, ty + 5], [15 + dx, ty + 5], [14 + dx, -22], [-16 + dx, -22]]);
    poly(g, LE[0], [[-20 + dx, ty + 4], [13 + dx, ty + 4], [13 + dx, -23], [-17 + dx, -23]]);
    poly(g, AP[2], [[-14 + dx, ty + 8], [12 + dx, ty + 8], [14 + dx, -5], [-16 + dx, -5]]);
    poly(g, AP[0], [[-15 + dx, ty + 7], [11 + dx, ty + 7], [13 + dx, -6], [-17 + dx, -6]]);
    R(g, AP[1], -15 + dx, ty + 7, 3, 32);
    for (i = -16; i < 14; i += 6) poly(g, AP[0], [[i + dx, -6], [i + 3 + dx, -2], [i + 6 + dx, -6]]);
    R(g, C.blood, -10 + dx, ty + 14, 9, 6); R(g, C.blood, -12 + dx, ty + 20, 5, 9); R(g, '#6a1a20', 0 + dx, ty + 24, 8, 6); R(g, C.bloodHi, -10 + dx, ty + 14, 3, 1); R(g, C.blood, 4 + dx, ty + 12, 4, 3);
    drip(g, -10 + dx, ty + 29, 3, C.blood); drip(g, 3 + dx, ty + 30, 2, C.blood);
    box(g, MAT.iron, -19 + dx, ty + 4, 7, 10); box(g, MAT.iron, 7 + dx, ty + 4, 7, 10);                        // hombreras
    for (i = 0; i < 4; i++) { tline(g, St[1], -6 + dx + i * 3, ty + 8, -6 + dx + i * 3, ty + 14, 1); P(g, C.blood, -6 + dx + i * 3, ty + 14); }   // bandolera de bisturíes
    tline(g, MAT.iron[1], -16 + dx, ty + 6, 12 + dx, ty + 24, 1);
    box(g, MAT.leather, -17 + dx, -24, 30, 4); box(g, MAT.brass, -3 + dx, -24, 5, 4);
    for (i = 0; i < 3; i++) { tline(g, MAT.iron[0], -14 + dx + i * 4, -20, -15 + dx + i * 4, -8 + i * 2 + ((fr + i) & 1), 1); poly(g, St[1], [[-16 + dx + i * 4, -8 + i * 2 + ((fr + i) & 1)], [-13 + dx + i * 4, -8 + i * 2 + ((fr + i) & 1)], [-15 + dx + i * 4, -4 + i * 2 + ((fr + i) & 1)]]); }
    // cabeza: capucha de cuero, máscara metálica, lente roja de cíclope
    poly(g, LE[2], [[-10 + dx, ty + 4], [-11 + dx, ty - 8], [-5 + dx, ty - 16], [5 + dx, ty - 14], [10 + dx, ty - 5], [9 + dx, ty + 4]]);
    poly(g, LE[1], [[-11 + dx, ty + 3], [-11 + dx, ty - 8], [-5 + dx, ty - 17], [3 + dx, ty - 15], [7 + dx, ty - 5], [7 + dx, ty + 3]]);
    ov(g, MAT.iron[2], -5 + dx, ty - 4, 7.5, 7.5); ov(g, MAT.iron[0], -5 + dx, ty - 4.5, 6.8, 6.8);
    ov(g, MAT.brass[2], -7 + dx, ty - 5, 4.2, 4.2); ov(g, MAT.brass[0], -7 + dx, ty - 5, 3.4, 3.4);
    ov(g, s.dead ? '#3a1410' : (s.hurt ? '#a02a24' : EMBER), -7 + dx, ty - 5, 2.4, 2.4); if (!s.dead && !s.hurt) { P(g, '#ffe0c0', -8 + dx, ty - 6); P(g, '#ff9a8a', -7 + dx, ty - 4); }
    box(g, MAT.iron, -10 + dx, ty, 10, 7); for (i = -9; i < 0; i += 2) R(g, MAT.iron[2], i + dx, ty + 1, 1, 5);
    if (atk) { R(g, '#2b1016', -10 + dx, ty + 7, 10, 2); for (i = -9; i < 0; i += 2) P(g, MAT.bone[1], i + dx, ty + 7); }
    tline(g, MAT.rubber[0], -2 + dx, ty + 4, 4 + dx, ty + 12, 2); tline(g, MAT.rubber[1], 4 + dx, ty + 12, 7 + dx, ty + 8, 1);
    P(g, LE[1], -6 + dx, ty - 12); P(g, LE[1], 0 + dx, ty - 13);
    // brazo trasero humano con aguja gigante
    limbE(g, LE, 10 + dx, ty + 6, 14 + dx, ty + 18, 6); ov(g, sk[0], 14 + dx, ty + 21, 3.2, 3.2);
    tline(g, St[0], 14 + dx, ty + 21, 14 + dx, ty + 37, 1); R(g, '#6fbf3a', 13 + dx, ty + 24, 3, 7); R(g, St[2], 12 + dx, ty + 23, 5, 1);
    // brazo delantero con cuchilla
    var ax = atk ? -18 : -24, ay = atk ? ty + 4 : ty + 22;
    limbE(g, LE, -17 + dx, ty + 7, -22 + dx, ty + 15, 7); limbE(g, LE, -22 + dx, ty + 15, ax + dx, ay, 6);
    box(g, MAT.iron, ax + dx - 4, ay - 4, 8, 6);
    ov(g, sk[0], ax + dx, ay + 3, 3.5, 3.2); R(g, sk[2], ax + dx - 2, ay + 4, 4, 1);
    if (atk) {
      box(g, MAT.leather, ax + dx - 2, ay - 8, 4, 9);
      poly(g, St[0], [[ax + dx - 10, ay - 12], [ax + dx + 4, ay - 14], [ax + dx + 4, ay - 8], [ax + dx - 9, ay - 4]]);
      tline(g, St[1], ax + dx - 9, ay - 11, ax + dx + 3, ay - 13, 1); R(g, St[2], ax + dx - 9, ay - 5, 13, 1); P(g, C.blood, ax + dx - 9, ay - 4); P(g, C.blood, ax + dx - 5, ay - 7);
    } else {
      box(g, MAT.leather, ax + dx - 2, ay + 4, 4, 9);
      poly(g, St[0], [[ax + dx - 7, ay - 4], [ax + dx + 6, ay - 4], [ax + dx + 6, ay - 26], [ax + dx - 3, ay - 26], [ax + dx - 7, ay - 20]]);
      tline(g, St[1], ax + dx - 6, ay - 4, ax + dx - 6, ay - 19, 1); R(g, St[2], ax + dx + 5, ay - 25, 1, 21); P(g, C.blood, ax + dx - 4, ay - 10); R(g, C.blood, ax + dx - 5, ay - 7, 2, 3); P(g, OL, ax + dx + 2, ay - 22);
    }
  }

  var GEN_Q = ['.ggg.', 'g...g', '....g', '...g.', '..g..', '.....', '..g..'];
  function paintGenerico(g, s) {
    var d = ['#3a3048', '#4f4266', '#241c30'], b = s.bob, dx = s.atk ? -5 : (s.hurt ? 3 : 0);
    ov(g, d[2], dx, -18 + b, 14, 17); ov(g, d[0], dx, -19 + b, 13, 16); ov(g, d[1], dx - 4, -25 + b, 6, 6);
    paint(g, GEN_Q, { g: '#8a7f9a' }, dx - 2, -30 + b, false);
    eyeE(g, s, dx - 8, -26 + b, '#e8c23a', '#fff6b0', 3); eyeE(g, s, dx + 3, -26 + b, '#e8c23a', '#fff6b0', 3);
    box(g, d, dx - 10, -6, 6, 6); box(g, d, dx + 4, -6, 6, 6);
  }

  var ENEMY_ART = {
    sabueso: { w: 64, h: 48, sh: 22, fn: paintSabueso, dead: 'flip' },
    ayudante: { w: 64, h: 64, sh: 14, fn: paintAyudante, dead: 'rot' },
    golem: { w: 64, h: 64, sh: 24, fn: paintGolem, dead: 'rot' },
    alquimista: { w: 64, h: 64, sh: 17, fn: paintAlquimista, dead: 'rot' },
    arana: { w: 64, h: 52, sh: 24, fn: paintArana, dead: 'flip' },
    cirujano: { w: 64, h: 64, sh: 14, fn: paintCirujano, dead: 'rot' },
    automata: { w: 64, h: 64, sh: 21, fn: paintAutomata, dead: 'rot' },
    quimera: { w: 64, h: 60, sh: 24, fn: paintQuimera, dead: 'flip' },
    relojero: { w: 64, h: 64, sh: 14, fn: paintRelojero, dead: 'rot' },
    vivisector: { w: 64, h: 64, sh: 22, fn: paintVivisector, dead: 'rot' }
  };
  var GENERIC_ART = { w: 40, h: 40, sh: 15, fn: paintGenerico, dead: 'rot' };
  var enemyCache = {}, SW = [0, 1, 0, -1];
  function enemySprite(id, pose, fr) {
    var key = id + '|' + pose + '|' + fr, E = enemyCache[key];
    if (E) return E;
    var art = own(ENEMY_ART, id) || GENERIC_ART, o = mk(art.w, art.h), g = o.g;
    o.sh = art.sh;
    var st = { pose: pose, fr: fr, atk: pose === 'attack', hurt: pose === 'hurt', dead: pose === 'dead', bob: BOB[fr], sw: SW[fr] };
    g.translate(art.w >> 1, art.h - 1);
    try { art.fn(g, st); } catch (err) { st.failed = err; }       // un pintor roto deja un sprite vacío, no rompe el bucle
    g.setTransform(1, 0, 0, 1, 0, 0);
    outline(o, OL);
    if (st.dead) {
      var d, h = art.h, w = art.w;
      if (art.dead === 'flip') {
        d = mk(w, h); d.g.translate(0, h); d.g.scale(1, -1); d.g.drawImage(o.c, 0, 0);
      } else {
        d = mk(h, w); d.g.transform(0, 1, -1, 0, h, 0); d.g.drawImage(o.c, 0, 0);
      }
      d.sh = Math.min(28, Math.round(d.w * 0.4)); o = d;
    }
    return (enemyCache[key] = o);
  }
  var FS = mk(64, 64);
  S.drawEnemyBig = function (ctx, id, cx, by, opt) {
    opt = opt || {};
    cx = Math.round(cx); by = Math.round(by);
    var pose = opt.pose === 'attack' || opt.pose === 'hurt' || opt.pose === 'dead' ? opt.pose : 'idle';
    var E = enemySprite(id, pose, (opt.frame | 0) & 3), src = E.c;
    ctx.save();
    if (opt.alpha != null) ctx.globalAlpha *= opt.alpha;
    ctx.translate(cx, by);
    if (opt.flip) ctx.scale(-1, 1);
    if (opt.shadow !== false) shadowEll(ctx, 0, 0, E.sh || 14, 3);
    if (opt.flash > 0) {
      FS.g.clearRect(0, 0, 64, 64); FS.g.drawImage(src, 0, 0); tint(FS.g, E.w, E.h, opt.flash); src = FS.c;
    }
    ctx.drawImage(src, -(E.w >> 1), -E.h);
    ctx.restore();
  };


  /* ====================================================================== */
  /*  SPRITES PEQUEÑOS 16×16 (exploración): 4 fotogramas de caminar           */
  /* ====================================================================== */
  function hline(g, col, x0, y0, x1, y1) {       // línea de 1 px
    var c = lineCells(x0, y0, x1, y1);
    g.fillStyle = col;
    for (var i = 0; i < c.length; i++) g.fillRect(c[i][0], c[i][1], 1, 1);
  }
  function wrapS(g, x, y, w, h) {       // vendaje pequeño
    R(g, BAND[0], x, y, w, h);
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) if (((i + j) & 3) === 0) P(g, BAND[2], x + i, y + j);
  }
  // --- abominación pequeña: se compone con lo que lleva el cuerpo (cabeza, torso, brazos, piernas) ---
  function smHead(g, id, k, b) {
    var y = 1 + b, sm = k.sm, e = k.ey[0], F = MAT.fur, hair = '#2a2230', Fz = MAT.scale;
    if (id === 'cab_sabueso') {
      R(g, F[0], 4, y + 1, 8, 5); R(g, F[2], 4, y, 2, 2); R(g, F[2], 10, y, 2, 2); R(g, MAT.furLt[0], 6, y + 3, 4, 3);
      R(g, e, 5, y + 2, 2, 1); R(g, e, 9, y + 2, 2, 1); R(g, '#0f0b10', 7, y + 3, 2, 1); P(g, MAT.bone[1], 6, y + 5); P(g, MAT.bone[1], 9, y + 5);
    } else if (id === 'cab_relojero') {
      R(g, sm[0], 4, y + 1, 8, 5); R(g, MAT.brass[0], 4, y, 8, 2); R(g, MAT.brass[2], 4, y + 1, 8, 1); cog(g, { fr: 0 }, 8, y - 1);
      R(g, e, 5, y + 2, 2, 1); R(g, MAT.brass[0], 8, y + 2, 3, 3); R(g, '#9fe6f2', 9, y + 3, 1, 1); P(g, k.ey[1], 9, y + 3); R(g, sm[1], 5, y + 5, 6, 1);
    } else if (id === 'cab_quimera') {
      R(g, Fz[0], 4, y + 1, 8, 5); R(g, C.fire2, 3, y, 10, 1); R(g, C.fire1, 4, y - 1, 2, 1); R(g, C.fire3, 7, y - 1, 2, 1); R(g, C.fire1, 10, y - 1, 2, 1);
      R(g, MAT.bone[0], 3, y + 1, 1, 2); R(g, MAT.bone[0], 12, y + 1, 1, 2); R(g, '#e8a060', 6, y + 3, 4, 3);
      R(g, e, 5, y + 2, 2, 1); R(g, e, 9, y + 2, 2, 1); P(g, '#3a1410', 7, y + 3); P(g, MAT.bone[1], 6, y + 5); P(g, MAT.bone[1], 9, y + 5);
    } else if (id === 'cab_plaga') {
      R(g, '#2e2630', 4, y + 1, 8, 2); R(g, '#2e2630', 5, y, 6, 1); R(g, '#2e2630', 3, y + 2, 10, 1); R(g, MAT.leather[0], 4, y + 3, 8, 3);
      R(g, e, 5, y + 3, 2, 1); R(g, e, 9, y + 3, 2, 1); R(g, MAT.bone[0], 7, y + 4, 2, 2); P(g, MAT.bone[2], 8, y + 5);
    } else if (id === 'stump_head') {
      wrapS(g, 4, y + 1, 8, 5); R(g, BAND[2], 4, y + 3, 8, 1); R(g, C.blood, 8, y + 1, 2, 2); P(g, BAND[0], 12, y + 4);
    } else {       // cab_cosido y desconocidas
      R(g, sm[0], 4, y + 1, 8, 5); R(g, sm[2], 4, y + 1, 1, 4); R(g, hair, 4, y, 8, 2); R(g, MAT.steel[0], 3, y + 4, 1, 2); R(g, MAT.steel[0], 12, y + 4, 1, 2);
      for (var i = 4; i < 12; i += 2) P(g, k.st, i, y + 1);
      R(g, e, 5, y + 3, 2, 1); R(g, e, 9, y + 3, 2, 1); R(g, sm[1], 5, y + 2, 6, 1); R(g, k.st, 6, y + 5, 4, 1);
    }
  }
  function smTorso(g, id, k, b) {
    var y = 7 + b, sm = k.sm;
    if (id === 'tor_caldera') {
      R(g, MAT.copper[0], 4, y, 8, 4); R(g, MAT.brass[0], 4, y, 8, 1); R(g, MAT.brass[0], 4, y + 3, 8, 1); R(g, '#1a0f0a', 6, y + 1, 4, 2); R(g, C.fire2, 7, y + 1, 2, 2); P(g, C.fire3, 7, y + 2);
      R(g, MAT.iron[0], 4, y - 1, 1, 2); R(g, MAT.iron[0], 11, y - 1, 1, 2);
    } else if (id === 'tor_costillar') {
      R(g, '#1b1420', 4, y, 8, 4); R(g, MAT.steel[0], 4, y, 8, 1); R(g, MAT.steel[1], 5, y + 1, 6, 1); R(g, MAT.steel[0], 5, y + 2, 6, 1); R(g, MAT.steel[0], 4, y + 3, 8, 1);
      R(g, MAT.steel[2], 7, y + 1, 2, 2); P(g, C.blood, 9, y + 1);
    } else if (id === 'tor_alambique') {
      R(g, sm[1], 4, y, 8, 4); R(g, MAT.brass[0], 4, y, 8, 1); R(g, '#16302c', 5, y + 1, 6, 3); R(g, '#5fbf3a', 5, y + 1, 6, 2); R(g, '#b6ef7a', 5, y + 1, 6, 1);
      P(g, '#ffffff', 6, y + 2); R(g, MAT.brass[0], 7, y - 1, 2, 1); R(g, MAT.leather[0], 4, y + 3, 8, 1);
    } else if (id === 'stump_torso') {
      wrapS(g, 4, y, 8, 4); R(g, C.blood, 6, y + 1, 3, 2); P(g, C.bloodHi, 6, y + 1);
    } else {       // tor_remendado
      R(g, sm[0], 4, y, 8, 4); R(g, sm[2], 4, y, 1, 3); R(g, sm[1], 11, y, 1, 3);
      R(g, MAT.leather[0], 8, y + 1, 3, 2); R(g, MAT.cloth[0], 5, y + 1, 2, 2); P(g, k.st, 7, y); P(g, k.st, 7, y + 1); P(g, k.st, 7, y + 2);
      R(g, MAT.leather[1], 4, y + 3, 8, 1); P(g, MAT.brass[0], 8, y + 3);
    }
  }
  function smArm(g, id, k, b, side, swing) {      // side: 0 izquierdo (x 1..3), 1 derecho (x 12..14)
    var x = side ? 12 : 1, y = 7 + b + swing, sm = k.sm, o = side ? 1 : 0;
    if (id === 'bra_sierra') {
      R(g, sm[0], x + 1 - o, y, 2, 2); R(g, MAT.brass[0], x + 1 - o, y + 2, 2, 2); R(g, MAT.steel[1], x + 1 - o, y + 4, 2, 4); P(g, MAT.steel[0], x + (side ? 3 : 0), y + 5); P(g, MAT.steel[0], x + (side ? 3 : 0), y + 7);
    } else if (id === 'bra_golem') {
      R(g, MAT.stone[0], x + 1 - o, y, 2, 3); R(g, MAT.stone[0], x, y + 3, 3, 4); R(g, MAT.stone[2], x + (side ? 0 : 2), y + 3, 1, 4); R(g, MAT.iron[0], x, y + 3, 3, 1);
    } else if (id === 'bra_tijera') {
      R(g, sm[0], x + 1 - o, y, 2, 2); R(g, MAT.steel[0], x + 1 - o, y + 2, 2, 2); R(g, MAT.steel[1], x + (side ? 1 : 0), y + 4, 1, 4); R(g, MAT.steel[1], x + (side ? 3 : 2), y + 4, 1, 4 - 1);
    } else if (id === 'bra_piston') {
      R(g, sm[0], x + 1 - o, y, 2, 1); R(g, MAT.brass[0], x + 1 - o, y + 1, 2, 4); P(g, MAT.brass[2], x + 1 - o, y + 3); R(g, MAT.steel[0], x + 1 + (side ? 0 : 0), y + 5, 1, 2); R(g, MAT.steel[1], x, y + 7, 3, 1);
    } else if (id === 'stump_arm') {
      R(g, sm[0], x + 1 - o, y, 2, 2); wrapS(g, x + 1 - o, y + 2, 2, 3); P(g, C.blood, x + 1 - o, y + 4);
    } else if (id === 'bra_tentaculo') {
      R(g, MAT.plum[0], x + 1 - o, y, 2, 4); R(g, MAT.plum[0], x + (side ? 0 : 2) , y + 3, 1, 3); R(g, MAT.plum[0], x + 1 , y + 6, 2, 1); P(g, '#f0c8e0', x + 1 - o, y + 2); P(g, '#7fe04a', x + (side ? 3 : 0), y + 7);
    } else {       // bra_muerto
      R(g, sm[0], x + 1 - o, y, 2, 5); R(g, sm[0], x + (side ? 0 : 1) - 0, y + 5, 2, 2); P(g, sm[1], x + 1 - o, y + 2); P(g, k.st, x + 1 - o, y + 2); P(g, k.st, x + 2 - o, y + 2);
    }
  }
  function smLeg(g, id, k, x, up) {       // x = columna izquierda de la pierna (2 px), up = 1 si está levantada un píxel
    var sm = k.sm, top = 11, bot = 15 - up;
    if (id === 'pie_sabueso') {
      R(g, MAT.fur[0], x, top, 2, bot - top); R(g, MAT.furLt[0], x - 1, bot, 3, 1); P(g, MAT.bone[1], x - 1, bot);
    } else if (id === 'pie_resorte') {
      for (var y = top; y < bot - 1; y++) R(g, (y & 1) ? MAT.steel[1] : MAT.steel[2], x, y, 2, 1);
      R(g, MAT.brass[0], x - 1, bot - 1, 4, 1); R(g, MAT.rubber[0], x - 1, bot, 4, 1);
    } else if (id === 'pie_arana') {
      hline(g, MAT.steel[0], x, top, x - 1, top + 1); hline(g, MAT.steel[0], x - 1, top + 1, x, bot); P(g, MAT.brass[0], x - 1, top + 1);
    } else if (id === 'pie_pesada') {
      R(g, MAT.iron[0], x, top, 2, bot - top - 1); R(g, MAT.iron[1], x, top, 1, bot - top - 1); R(g, MAT.iron[0], x - 1, bot - 2, 4, 2); R(g, MAT.brass[0], x - 1, bot - 2, 4, 1); R(g, MAT.rubber[0], x - 1, bot, 4, 1);
    } else if (id === 'stump_leg') {
      R(g, sm[0], x, top, 2, 2); wrapS(g, x, top + 2, 2, 2); R(g, MAT.wood[0], x, top + 4, 2, bot - top - 4 + 1); P(g, MAT.iron[0], x, bot); P(g, C.blood, x, top + 3);
    } else {       // pie_muerta
      R(g, sm[0], x, top, 2, bot - top); R(g, sm[1], x + 1, top, 1, bot - top); R(g, sm[0], x - 1, bot, 3, 1); P(g, k.st, x, top + 1);
    }
  }
  var SP_STEP = [[1, 0], [0, 0], [0, 1], [0, 0]];       // pierna izquierda/derecha levantada por fotograma
  function paintSmallPlayer(g, ids, k, fr) {
    var b = (fr & 1) ? 0 : 1, sp = SP_STEP[fr], sw = [1, 0, -1, 0][fr];
    smLeg(g, ids.legL, k, 5, sp[0]); smLeg(g, ids.legR, k, 9, sp[1]);
    smTorso(g, ids.torso, k, b);
    smArm(g, ids.armL, k, b, 0, sw); smArm(g, ids.armR, k, b, 1, -sw);
    smHead(g, ids.head, k, b);
  }
  var smallCache = {};
  function smallSprite(key, fn) {
    var o = smallCache[key];
    if (!o) { o = mk(16, 16); fn(o.g); outline(o, OL); smallCache[key] = o; }
    return o;
  }
  var SF = mk(16, 16);
  function blit16(ctx, src, x, y, flip, flash, alpha) {
    ctx.save();
    if (alpha != null) ctx.globalAlpha *= alpha;
    x = Math.round(x); y = Math.round(y);
    if (flash > 0) { SF.g.clearRect(0, 0, 16, 16); SF.g.drawImage(src, 0, 0); tint(SF.g, 16, 16, flash); src = SF.c; }
    if (flip) { ctx.translate(x + 16, y); ctx.scale(-1, 1); ctx.drawImage(src, 0, 0); } else ctx.drawImage(src, x, y);
    ctx.restore();
  }
  S.drawPlayer = function (ctx, body, x, y, opt) {
    opt = opt || {};
    var cos = cosmetics(opt.equip), fr = (opt.frame | 0) & 3, ids = {}, key = 'P', i;
    for (i = 0; i < DD.SLOTS.length; i++) { ids[DD.SLOTS[i]] = artOf(body, DD.SLOTS[i]); key += '|' + ids[DD.SLOTS[i]]; }
    var o = smallSprite(key + '|' + fr + '|' + cos.key, function (g) {
      paintSmallPlayer(g, ids, { sk: cos.sk, sm: cos.sm, st: cos.st, ey: cos.ey }, fr);
    });
    blit16(ctx, o.c, x, y, opt.dir === -1, opt.flash, opt.alpha);
  };


  // --- enemigos pequeños (miran a la derecha; b = rebote del cuerpo, sw = paso) ---
  function smSabueso(g, fr) {
    var F = MAT.fur, L = MAT.furLt, D = '#3c3128', b = (fr & 1) ? 0 : 1, sw = SW[fr];
    R(g, D, 4 + sw, 11, 2, 4); R(g, D, 10 - sw, 11, 2, 4); R(g, D, 3 + sw, 15, 3, 1); R(g, D, 9 - sw, 15, 3, 1);
    R(g, F[0], 1, 4 + b, 1, 2); R(g, F[0], 2, 6 + b, 2, 2);                               // cola
    R(g, F[0], 3, 6 + b, 9, 5); R(g, F[1], 4, 6 + b, 7, 1); R(g, F[2], 3, 10 + b, 9, 1);
    R(g, '#4a2a2e', 6, 7 + b, 4, 3); R(g, MAT.bone[1], 6, 7 + b, 1, 3); R(g, MAT.bone[1], 8, 7 + b, 1, 3);
    P(g, D, 5, 5 + b); P(g, D, 7, 5 + b); P(g, D, 9, 5 + b); P(g, TH.st, 4, 8 + b); P(g, TH.st, 4, 9 + b);
    R(g, F[0], 10, 4 + b, 5, 5); R(g, L[0], 13, 6 + b, 3, 3); P(g, '#0f0b10', 15, 6 + b);
    R(g, D, 10, 2 + b, 1, 2); R(g, D, 12, 2 + b, 1, 2); P(g, EMBER, 12, 5 + b); P(g, MAT.bone[1], 14, 9 + b); P(g, TH.st, 10, 7 + b);
    R(g, F[0], 10 + sw, 11, 2, 4); R(g, L[0], 10 + sw, 15, 3, 1);
    R(g, F[0], 4 - sw, 11, 2, 4); R(g, L[0], 3 - sw, 15, 3, 1);
  }
  function smAyudante(g, fr) {
    var z = ['#d8d0b8', '#efe8d2', '#a79f86'], b = (fr & 1) ? 0 : 1, sw = SW[fr], sk = '#c9b79a', hair = '#b8b8c4', i;
    R(g, '#3a3248', 5 + sw, 13, 2, 2); R(g, '#3a3248', 9 - sw, 13, 2, 2); R(g, MAT.leather[0], 4 + sw, 15, 3, 1); R(g, MAT.leather[0], 9 - sw, 15, 3, 1);
    R(g, z[0], 4, 7 + b, 8, 6); R(g, z[2], 10, 7 + b, 2, 6); R(g, z[1], 4, 7 + b, 1, 5);
    P(g, z[0], 4, 13); P(g, z[0], 6, 13); P(g, z[0], 9, 13); P(g, z[0], 11, 13);
    P(g, '#6fbf3a', 6, 9 + b); P(g, C.blood, 8, 10 + b); P(g, C.blood, 5, 11 + b); R(g, MAT.leather[0], 4, 10 + b, 8, 1);
    R(g, z[0], 12, 8 + b, 2, 3); P(g, sk, 13, 11 + b); R(g, MAT.steel[1], 14, 10 + b, 1, 3);
    R(g, z[0], 2, 8 + b, 2, 2); P(g, sk, 2, 7 + b);                                        // brazo con matraz
    R(g, '#5fbf3a', 0, 3 + b, 3, 3); R(g, '#b6ef7a', 0, 3 + b, 3, 1); R(g, MAT.leather[0], 1, 2 + b, 1, 1);
    R(g, hair, 4, 2 + b, 8, 1); P(g, hair, 3, 3 + b); P(g, hair, 12, 3 + b); for (i = 4; i < 12; i += 2) P(g, i & 2 ? '#8a8a96' : hair, i, 1 + b); P(g, hair, 3, 1 + b); P(g, hair, 12, 1 + b);
    R(g, sk, 5, 3 + b, 6, 4); R(g, MAT.brass[0], 5, 4 + b, 6, 2); R(g, '#8fe06a', 6, 4 + b, 2, 1); R(g, '#ff6a5a', 9, 4 + b, 1, 1); P(g, OL, 7, 5 + b);
    R(g, '#2b1016', 6, 6 + b, 4, 1); P(g, '#f0e8d0', 6, 6 + b); P(g, '#f0e8d0', 9, 6 + b);
  }
  function smGolem(g, fr) {
    var st = MAT.stone, b = (fr & 1) ? 0 : 1, sw = SW[fr];
    R(g, st[0], 4 + sw, 11, 3, 5); R(g, st[0], 9 - sw, 11, 3, 5); R(g, st[2], 4 + sw, 15, 3, 1); R(g, st[2], 9 - sw, 15, 3, 1); R(g, MAT.iron[0], 4 + sw, 13, 3, 1); R(g, MAT.iron[0], 9 - sw, 13, 3, 1);
    R(g, st[0], 3, 5 + b, 10, 6); R(g, st[1], 3, 5 + b, 10, 1); R(g, st[2], 3, 10 + b, 10, 1);
    R(g, FLESH[0], 9, 6 + b, 3, 3); R(g, MAT.iron[0], 4, 8 + b, 3, 2); P(g, C.fire2, 7, 8 + b); P(g, C.fire3, 8, 9 + b);
    P(g, TH.st, 8, 6 + b); P(g, TH.st, 8, 7 + b); P(g, TH.st, 4, 6 + b); P(g, TH.st, 5, 7 + b);
    R(g, st[0], 6, 2 + b, 4, 4); R(g, st[2], 6, 5 + b, 4, 1); P(g, '#ffb02e', 6, 3 + b); P(g, '#ffb02e', 9, 3 + b); R(g, MAT.iron[0], 5, 2 + b, 6, 1);
    R(g, st[0], 1, 6 + b, 2, 5); R(g, st[0], 13, 6 + b, 2, 5); R(g, st[0], 0, 11 + b, 3, 3); R(g, st[0], 13, 11 + b, 3, 3); R(g, st[2], 0, 13 + b, 3, 1); R(g, st[2], 13, 13 + b, 3, 1);
  }
  function smAlquimista(g, fr) {
    var Rb = ['#4a2f66', '#6a4690', '#2a1a3c'], b = (fr & 1) ? 0 : 1, sw = SW[fr];
    R(g, MAT.leather[0], 4 + sw, 15, 3, 1); R(g, MAT.leather[0], 9 - sw, 15, 3, 1);
    R(g, Rb[0], 4, 6 + b, 8, 3); R(g, Rb[0], 3, 9 + b, 10, 5); R(g, Rb[1], 3, 9 + b, 1, 5); R(g, Rb[2], 12, 9 + b, 1, 5); R(g, MAT.brass[0], 3, 13, 10, 1);
    R(g, Rb[0], 5, 1 + b, 6, 2); R(g, Rb[0], 4, 3 + b, 8, 3); R(g, Rb[1], 5, 1 + b, 1, 3);
    R(g, MAT.iron[0], 5, 3 + b, 6, 3); R(g, '#7dff5a', 6, 4 + b, 1, 1); R(g, '#7dff5a', 9, 4 + b, 1, 1); R(g, MAT.iron[2], 7, 5 + b, 2, 2);
    R(g, '#2a5a58', 12, 5 + b, 2, 5); R(g, '#5fbf3a', 12, 7 + b, 2, 3); P(g, '#b6ef7a', 12, 7 + b);
    P(g, '#6fbf3a', 5, 10 + b); P(g, C.blood, 7, 10 + b); P(g, '#7fd6e6', 9, 10 + b); R(g, MAT.leather[0], 4, 9 + b, 8, 1);
    R(g, Rb[0], 2, 7 + b, 2, 3); R(g, '#5fe040', 0, 3 + b, 3, 3); R(g, '#b6ef7a', 0, 3 + b, 3, 1); R(g, '#2a5a58', 1, 2 + b, 1, 1);
  }
  function smArana(g, fr) {
    var B = MAT.brass, Cu = MAT.copper, L = '#8d9db0', sw = SW[fr], b = (fr & 1) ? 0 : 1, i;
    var legs = [[[5, 6], [3, 2], [1, 4 + sw]], [[5, 7], [2, 6], [0, 8 - sw]], [[5, 9], [2, 10], [1, 13 + sw]], [[6, 10], [4, 13], [3, 15 - sw]]];
    for (i = 0; i < 4; i++) {
      var l = legs[i];
      hline(g, L, l[0][0], l[0][1] + b * (i ? 0 : 0), l[1][0], l[1][1]); hline(g, L, l[1][0], l[1][1], l[2][0], l[2][1]);
      hline(g, L, 15 - l[0][0], l[0][1], 15 - l[1][0], l[1][1]); hline(g, L, 15 - l[1][0], l[1][1], 15 - l[2][0], l[2][1]);
      P(g, B[0], l[1][0], l[1][1]); P(g, B[0], 15 - l[1][0], l[1][1]);
    }
    ov(g, B[0], 8, 9 + b, 4, 3.5); ov(g, Cu[0], 8, 6 + b, 3, 2.5); ov(g, B[2], 8, 10 + b, 2, 2); P(g, B[1], 7, 8 + b);
    P(g, EMBER, 6, 5 + b); P(g, EMBER, 9, 5 + b); P(g, '#ffd0a0', 6, 5 + b); P(g, MAT.steel[1], 6, 8 + b - 1 + 1); P(g, MAT.steel[1], 9, 8 + b);
    P(g, B[1], 8, 7 + b);
  }
  function smCirujano(g, fr) {
    var T = ['#3f8f8a', '#62b5ae', '#2a5f66'], b = (fr & 1) ? 0 : 1, sw = SW[fr];
    R(g, T[2], 5 + sw, 13, 2, 2); R(g, T[2], 9 - sw, 13, 2, 2); R(g, MAT.rubber[0], 4 + sw, 15, 3, 1); R(g, MAT.rubber[0], 9 - sw, 15, 3, 1);
    R(g, T[0], 4, 7 + b, 8, 6); R(g, MAT.leather[0], 5, 8 + b, 6, 5); R(g, C.blood, 6, 9 + b, 3, 2); P(g, C.blood, 9, 11 + b); P(g, '#6a1a20', 6, 12 + b);
    R(g, T[0], 12, 8 + b, 2, 4); P(g, '#d8c060', 13, 12 + b); P(g, MAT.steel[1], 13, 13 + b);
    R(g, T[0], 2, 8 + b, 2, 2); P(g, '#d8c060', 2, 10 + b); R(g, MAT.steel[0], 0, 10 + b, 3, 2); P(g, MAT.steel[1], 0, 12 + b); P(g, MAT.steel[1], 2, 12 + b); P(g, C.blood, 0, 11 + b);
    R(g, T[0], 5, 1 + b, 6, 3); R(g, T[2], 5, 3 + b, 6, 1); ov(g, '#e8f4ff', 6.5, 1 + b, 1.2, 1.2); P(g, '#2a3038', 6, 1 + b);
    R(g, '#d8c8b0', 5, 4 + b, 6, 1); P(g, '#a32a1a', 6, 4 + b); P(g, '#a32a1a', 9, 4 + b); R(g, '#d8dde0', 5, 5 + b, 6, 2); P(g, C.blood, 6, 6 + b);
  }
  function smAutomata(g, fr) {
    var B = MAT.brass, b = (fr & 1) ? 0 : 1, sw = SW[fr];
    R(g, B[0], 4 + sw, 12, 3, 3); R(g, B[0], 9 - sw, 12, 3, 3); R(g, B[2], 3 + sw, 15, 4, 1); R(g, B[2], 9 - sw, 15, 4, 1);
    R(g, B[0], 3, 6 + b, 10, 6); R(g, B[1], 3, 6 + b, 10, 1); R(g, B[2], 3, 11 + b, 10, 1);
    R(g, '#140e12', 5, 7 + b, 6, 3); P(g, B[1], 6, 8 + b); P(g, B[1], 7, 9 + b); P(g, C.copper, 9, 8 + b); R(g, C.fire2, 5, 10 + b, 6, 1);
    R(g, B[0], 1, 7 + b, 2, 5); R(g, MAT.steel[0], 1, 12 + b, 2, 2); R(g, B[0], 13, 7 + b, 2, 5); R(g, MAT.steel[0], 13, 12 + b, 2, 2);
    R(g, B[0], 5, 2 + b, 6, 4); R(g, B[1], 5, 2 + b, 6, 1); R(g, '#140e12', 6, 3 + b, 4, 2); R(g, '#ffb02e', 6 + ((fr * 2) % 3), 3 + b, 2, 1);
    P(g, C.blood, 8, 1 + b); P(g, MAT.steel[2], 8, 2 + b); P(g, 'rgba(215,220,230,0.8)', 3 + (fr & 1), 4 + b); P(g, 'rgba(215,220,230,0.8)', 12, 4 + b - (fr >> 1));
  }
  function smQuimera(g, fr) {
    var Fz = MAT.scale, D = '#7c2412', Mz = '#e8a060', b = (fr & 1) ? 0 : 1, sw = SW[fr];
    R(g, D, 4 + sw, 11, 2, 4); R(g, D, 10 - sw, 11, 2, 4);
    R(g, '#3f9a44', 1, 7 + b, 2, 1); R(g, '#3f9a44', 1, 4 + b, 1, 4); P(g, '#ffd15a', 1, 3 + b); P(g, '#ff3a30', 0, 3 + b);                  // cola-serpiente
    R(g, Fz[0], 3, 6 + b, 9, 5); R(g, Fz[1], 4, 6 + b, 7, 1); R(g, D, 3, 10 + b, 9, 1);
    R(g, D, 5, 7 + b, 1, 3); R(g, D, 7, 7 + b, 1, 3); R(g, D, 9, 7 + b, 1, 3);
    P(g, C.fire2, 4, 5 + b - (fr & 1)); P(g, C.fire3, 6, 4 + b); P(g, C.fire2, 8, 5 + b - (fr >> 1)); P(g, C.fire1, 10, 4 + b); P(g, C.fire3, 5, 5 + b); P(g, C.fire1, 7, 5 + b);
    R(g, C.fire1, 9, 2 + b, 2, 2); R(g, C.fire2, 10, 1 + b, 1, 2); R(g, C.fire3, 11, 2 + b, 1, 1);                                          // melena
    R(g, Fz[0], 10, 4 + b, 5, 5); R(g, Mz, 13, 6 + b, 3, 3); P(g, '#3a1410', 15, 6 + b);
    R(g, MAT.bone[0], 10, 3 + b, 1, 1); R(g, MAT.bone[0], 13, 3 + b, 1, 1); P(g, '#ffd15a', 12, 5 + b); P(g, MAT.bone[1], 14, 9 + b);
    R(g, Fz[0], 10 + sw, 11, 2, 4); R(g, Mz, 10 + sw, 15, 3, 1); R(g, Fz[0], 4 - sw, 11, 2, 4); R(g, Mz, 3 - sw, 15, 3, 1);
  }
  function smRelojero(g, fr) {
    var D = ['#2f2538', '#473a54', '#1c1524'], B = MAT.brass, b = (fr & 1) ? 0 : 1, sw = SW[fr], sk = '#d8c8b0';
    R(g, D[2], 5 + sw, 13, 2, 2); R(g, D[2], 9 - sw, 13, 2, 2); R(g, MAT.rubber[0], 4 + sw, 15, 3, 1); R(g, MAT.rubber[0], 9 - sw, 15, 3, 1);
    R(g, D[0], 4, 8 + b, 8, 5); R(g, D[1], 4, 8 + b, 1, 4); P(g, D[0], 3, 13); P(g, D[0], 12, 13); R(g, D[0], 12, 12, 1, 2);
    R(g, '#efe6cc', 7, 9 + b, 3, 3); R(g, B[0], 7, 9 + b, 3, 1); R(g, B[0], 7, 11 + b, 3, 1); P(g, '#1c1524', 8, 10 + b); P(g, C.blood, 9, 10 + b);
    R(g, D[0], 12, 9 + b, 2, 3); P(g, sk, 13, 12 + b);
    R(g, B[0], 2, 3 + b, 1, 9); P(g, B[1], 2, 2 + b); R(g, B[0], 1, 2 + b, 3, 1); R(g, B[0], 3, 9 + b, 1, 2); P(g, B[1], 3, 12 + b); R(g, D[0], 3, 8 + b, 1, 2);
    R(g, D[2], 5, 1 + b, 6, 3); R(g, D[2], 4, 4 + b, 8, 1); P(g, '#efe6cc', 6, 2 + b); R(g, B[0], 5, 3 + b, 6, 1);
    R(g, sk, 5, 5 + b, 6, 3); P(g, B[0], 6, 6 + b); P(g, '#9fe6f2', 6, 6 + b); P(g, '#a32a1a', 9, 6 + b); R(g, '#c8c8d0', 4, 6 + b, 1, 2); R(g, '#c8c8d0', 11, 6 + b, 1, 2); R(g, OL, 7, 7 + b, 3, 1);
  }
  function smVivisector(g, fr) {
    var LE = ['#46322a', '#6a4c3a', '#241911'], AP = ['#5e4330', '#85604a', '#33231a'], b = (fr & 1) ? 0 : 1, sw = SW[fr], St = MAT.steel;
    R(g, LE[2], 4 + sw, 13, 3, 2); R(g, LE[2], 9 - sw, 13, 3, 2); R(g, MAT.rubber[0], 3 + sw, 15, 4, 1); R(g, MAT.rubber[0], 9 - sw, 15, 4, 1);
    hline(g, St[0], 12, 7 + b, 14, 3 + (fr & 1)); hline(g, St[1], 13, 4, 15, 2); P(g, MAT.brass[0], 14, 3 + (fr & 1)); hline(g, St[0], 12, 9 + b, 15, 6 + b); P(g, St[1], 15, 5 + b);
    R(g, LE[0], 3, 6 + b, 10, 7); R(g, LE[1], 3, 6 + b, 1, 6); R(g, AP[0], 5, 8 + b, 6, 5); R(g, C.blood, 6, 9 + b, 3, 2); P(g, C.blood, 9, 11 + b); P(g, C.blood, 7, 12 + b);
    R(g, MAT.iron[0], 3, 6 + b, 2, 2); R(g, MAT.iron[0], 11, 6 + b, 2, 2);
    R(g, St[0], 0, 4 + b, 3, 7); R(g, St[1], 0, 4 + b, 1, 6); P(g, C.blood, 1, 9 + b); R(g, MAT.leather[0], 1, 11 + b, 1, 2);
    R(g, LE[0], 4, 1 + b, 8, 5); R(g, LE[1], 4, 1 + b, 1, 4); R(g, MAT.iron[0], 5, 3 + b, 6, 3); R(g, EMBER, 6, 3 + b, 2, 2); P(g, '#ffd0a0', 6, 3 + b); R(g, MAT.iron[2], 8, 4 + b, 3, 1); R(g, MAT.iron[2], 6, 5 + b, 5, 1);
  }
  function smGenerico(g, fr) {
    var d = ['#3a3048', '#4f4266', '#241c30'], b = (fr & 1) ? 0 : 1, sw = SW[fr];
    R(g, d[2], 4 + sw, 13, 3, 3); R(g, d[2], 9 - sw, 13, 3, 3);
    ov(g, d[0], 8, 8 + b, 5.5, 5.5); ov(g, d[1], 6, 6 + b, 2.5, 2.5);
    R(g, '#e8c23a', 5, 6 + b, 2, 2); R(g, '#e8c23a', 9, 6 + b, 2, 2); P(g, '#8a7f9a', 8, 9 + b); P(g, '#8a7f9a', 9, 10 + b); P(g, '#8a7f9a', 8, 12 + b - 1);
  }
  var SMALL_ART = { sabueso: smSabueso, ayudante: smAyudante, golem: smGolem, alquimista: smAlquimista, arana: smArana, cirujano: smCirujano, automata: smAutomata, quimera: smQuimera, relojero: smRelojero, vivisector: smVivisector };
  S.drawEnemy = function (ctx, id, x, y, opt) {
    opt = opt || {};
    var fr = (opt.frame | 0) & 3, fn = own(SMALL_ART, id) || smGenerico;
    var o = smallSprite('E|' + (own(SMALL_ART, id) ? id : '?') + '|' + fr, function (g) { fn(g, fr); });
    blit16(ctx, o.c, x, y, opt.flip, opt.flash, opt.alpha);
  };


  /* ====================================================================== */
  /*  ICONOS 16×16 de extremidades y muñones                                  */
  /* ====================================================================== */
  var IK = { sm: ['#b9a98c', '#d9cdb0', '#8a7a66'], st: '#a3202a', ey: ['#6fbf3a', '#d6ff9a'] };   // piel de serie (icono = color del tema)
  function iHeadCosido(g) {
    var sm = IK.sm, i;
    R(g, sm[0], 6, 13, 4, 2); box(g, MAT.steel, 1, 7, 2, 3); box(g, MAT.steel, 13, 7, 2, 3);
    box(g, sm, 3, 3, 10, 10); g.clearRect(3, 3, 1, 1); g.clearRect(12, 3, 1, 1); g.clearRect(3, 12, 1, 1); g.clearRect(12, 12, 1, 1);
    R(g, '#2a2230', 3, 2, 10, 3); g.clearRect(3, 2, 1, 1); g.clearRect(12, 2, 1, 1);
    R(g, '#1c1117', 3, 5, 10, 1); for (i = 4; i < 12; i += 2) { P(g, IK.st, i, 4); P(g, IK.st, i, 6); }
    R(g, sm[2], 4, 7, 8, 1); R(g, IK.ey[0], 5, 8, 2, 2); R(g, IK.ey[0], 9, 8, 2, 2); P(g, IK.ey[1], 5, 8); P(g, IK.ey[1], 9, 8);
    P(g, sm[2], 8, 10); R(g, '#1c1117', 5, 11, 6, 1); for (i = 5; i < 11; i += 2) { P(g, IK.st, i, 10); P(g, IK.st, i, 12); }
  }
  function iHeadSabueso(g) {
    var F = MAT.fur, L = MAT.furLt;
    poly(g, F[0], [[1, 1], [7, 5], [3, 9]]); poly(g, F[0], [[15, 1], [9, 5], [13, 9]]); poly(g, '#7a3a4a', [[2, 3], [5, 5], [3, 7]]); poly(g, '#7a3a4a', [[14, 3], [11, 5], [13, 7]]);
    box(g, F, 3, 4, 10, 7); g.clearRect(3, 4, 1, 1); g.clearRect(12, 4, 1, 1);
    R(g, F[2], 3, 6, 3, 2); R(g, F[2], 10, 6, 3, 2);
    box(g, L, 5, 8, 6, 6); R(g, '#0f0b10', 6, 8, 4, 2); P(g, '#6a6070', 6, 8);
    R(g, EMBER, 4, 6, 2, 1); R(g, EMBER, 10, 6, 2, 1); P(g, '#ffd0a0', 4, 6); P(g, '#ffd0a0', 11, 6);
    R(g, '#1c1117', 6, 12, 4, 1); P(g, MAT.bone[1], 6, 12); P(g, MAT.bone[1], 9, 12); P(g, IK.st, 8, 5); P(g, IK.st, 8, 7);
  }
  function iHeadRelojero(g) {
    var B = MAT.brass, sm = IK.sm;
    R(g, B[0], 6, 2, 4, 4); R(g, B[1], 7, 1, 2, 1); R(g, B[1], 5, 3, 1, 2); R(g, B[1], 10, 3, 1, 2); P(g, B[2], 7, 3); P(g, B[2], 8, 4);
    box(g, B, 3, 5, 10, 3); R(g, B[2], 3, 7, 10, 1); P(g, B[1], 5, 6); P(g, B[1], 10, 6);
    box(g, sm, 4, 8, 8, 5); R(g, IK.ey[0], 5, 9, 2, 1);
    ov(g, B[2], 10, 10, 3, 3); ov(g, B[0], 10, 10, 2.5, 2.5); ov(g, '#9fe6f2', 10, 10, 1.8, 1.8); P(g, IK.ey[0], 10, 10); P(g, '#ffffff', 9, 9);
    R(g, '#2f2836', 5, 12, 6, 1); box(g, B, 5, 13, 6, 2);
  }
  function iHeadQuimera(g) {
    var F = MAT.scale, Mz = ['#e8a060', '#ffd09a', '#b06a3a'];
    flameTongue(g, 3, 9, 2, 7); flameTongue(g, 8, 6, 3, 6); flameTongue(g, 13, 9, 2, 7); flameTongue(g, 5, 6, 2, 5); flameTongue(g, 11, 6, 2, 5);
    tline(g, MAT.bone[0], 4, 6, 2, 3, 1); P(g, MAT.bone[1], 2, 2); tline(g, MAT.bone[0], 11, 6, 13, 3, 1); P(g, MAT.bone[1], 13, 2);
    box(g, F, 4, 6, 8, 8); g.clearRect(4, 6, 1, 1); g.clearRect(11, 6, 1, 1);
    box(g, Mz, 6, 9, 4, 5); R(g, '#3a1410', 7, 9, 2, 1);
    R(g, '#ffd15a', 5, 8, 2, 1); R(g, '#ffd15a', 9, 8, 2, 1); P(g, OL, 6, 8); P(g, OL, 10, 8);
    P(g, MAT.bone[1], 6, 12); P(g, MAT.bone[1], 9, 12); R(g, '#2b1016', 7, 12, 2, 1);
  }
  function iHeadPlaga(g) {
    var hat = ['#2e2630', '#4a4050', '#17121a'], B = MAT.bone, LE = MAT.leather, i;
    box(g, hat, 4, 1, 8, 4); R(g, '#6a1f28', 4, 4, 8, 1); box(g, hat, 1, 5, 14, 2); g.clearRect(1, 5, 1, 1); g.clearRect(14, 5, 1, 1);
    box(g, LE, 4, 7, 8, 6);
    for (i = 0; i < 2; i++) { ov(g, MAT.brass[2], 5.5 + i * 5, 9, 2.3, 2.3); ov(g, MAT.brass[0], 5.5 + i * 5, 9, 1.8, 1.8); R(g, IK.ey[0], 5 + i * 5, 8, 1, 2); R(g, IK.ey[0], 6 + i * 5, 9, 1, 1); P(g, IK.ey[1], 5 + i * 5, 8); }
    R(g, B[0], 7, 9, 2, 3); R(g, B[1], 7, 9, 1, 3); R(g, B[0], 7, 12, 2, 2); P(g, B[2], 8, 12); P(g, B[0], 8, 14);
    box(g, hat, 4, 12, 3, 3); box(g, hat, 9, 12, 3, 3);
  }
  function iTorRemendado(g) {
    var sm = IK.sm, i;
    box(g, sm, 2, 2, 12, 12); g.clearRect(2, 2, 2, 1); g.clearRect(12, 2, 2, 1);
    seam(g, IK, [[4, 3], [8, 7], [8, 12]]); seam(g, IK, [[12, 3], [9, 6]]);
    box(g, MAT.leather, 9, 7, 4, 3); box(g, MAT.cloth, 3, 9, 4, 3);
    for (i = 9; i < 13; i += 2) { P(g, IK.st, i, 7); P(g, IK.st, i, 9); }
    box(g, MAT.leather, 2, 12, 12, 3); box(g, MAT.brass, 7, 12, 2, 3); P(g, OL, 7, 13);
  }
  function iTorCaldera(g) {
    var Cu = MAT.copper, B = MAT.brass;
    box(g, MAT.iron, 3, 0, 2, 4); box(g, MAT.iron, 11, 0, 2, 4); P(g, 'rgba(215,220,230,0.85)', 4, 0);
    box(g, Cu, 1, 3, 14, 12); g.clearRect(1, 3, 1, 1); g.clearRect(14, 3, 1, 1); g.clearRect(1, 14, 1, 1); g.clearRect(14, 14, 1, 1);
    R(g, B[2], 1, 5, 14, 1); R(g, B[0], 1, 4, 14, 1); R(g, B[2], 1, 12, 14, 1); R(g, B[0], 1, 11, 14, 1);
    ov(g, B[2], 8, 8, 3.8, 3.8); ov(g, B[0], 8, 8, 3.2, 3.2); ov(g, '#1a0f0a', 8, 8, 2.4, 2.4); ov(g, C.fire2, 8, 8.5, 1.9, 1.9); P(g, C.fire3, 8, 8); P(g, '#ffffff', 7, 7);
    P(g, B[1], 3, 7); P(g, B[1], 3, 9); P(g, B[1], 12, 7); P(g, B[1], 12, 9);
  }
  function iTorCostillar(g) {
    var St = MAT.steel, i;
    R(g, '#1b1420', 3, 3, 10, 11); box(g, St, 2, 2, 12, 2); box(g, St, 7, 4, 2, 9);
    for (i = 0; i < 4; i++) { var y = 5 + i * 2; R(g, St[1], 3 + i, y, 4 - i, 1); R(g, St[0], 3 + i, y + 1, 4 - i, 1); R(g, St[1], 9, y, 4 - i, 1); R(g, St[0], 9, y + 1, 4 - i, 1); }
    R(g, C.blood, 9, 6, 2, 2); P(g, C.bloodHi, 9, 6);
    box(g, St, 3, 13, 10, 2); R(g, IK.sm[0], 2, 4, 1, 6); R(g, IK.sm[0], 13, 4, 1, 6);
  }
  function iTorAlambique(g) {
    var B = MAT.brass;
    box(g, MAT.leather, 2, 2, 2, 12); box(g, MAT.leather, 12, 2, 2, 12); box(g, B, 2, 2, 12, 2);
    ov(g, B[2], 8, 9, 5.6, 5.6); ov(g, '#16302c', 8, 9, 4.8, 4.8);
    g.save(); g.beginPath(); g.rect(0, 8, 16, 8); g.clip(); ov(g, '#5fbf3a', 8, 9, 4.8, 4.8); g.restore();
    R(g, '#b6ef7a', 5, 8, 6, 1); P(g, '#ffffff', 5, 7); P(g, '#c8f4f0', 4, 9); P(g, '#e8ffd0', 9, 11); P(g, '#e8ffd0', 7, 12);
    box(g, B, 6, 3, 4, 2); R(g, '#b8f0f0', 7, 5, 2, 2); R(g, MAT.leather[0], 7, 2, 2, 1);
    box(g, MAT.leather, 3, 13, 10, 2); box(g, B, 7, 13, 2, 2);
  }
  function iArmMuerto(g) {
    var sm = IK.sm;
    box(g, sm, 6, 1, 4, 7); R(g, MAT.rag[0], 6, 1, 4, 2); P(g, MAT.rag[2], 7, 3);
    seamH(g, IK, 6, 9, 7); box(g, sm, 6, 8, 4, 4);
    box(g, sm, 5, 12, 6, 2); R(g, sm[0], 5, 14, 1, 1); R(g, sm[0], 7, 14, 1, 1); R(g, sm[0], 9, 14, 1, 1); R(g, sm[0], 11, 12, 1, 2); P(g, sm[2], 7, 13);
  }
  function iArmSierra(g) {
    var St = MAT.steel, B = MAT.brass, i;
    box(g, IK.sm, 6, 0, 4, 3); seamH(g, IK, 6, 9, 3);
    box(g, B, 4, 4, 8, 4); R(g, B[2], 4, 6, 8, 1); box(g, St, 2, 5, 2, 2); P(g, B[1], 5, 5); P(g, B[1], 10, 5);
    box(g, St, 5, 8, 6, 7); R(g, St[2], 7, 9, 1, 5); R(g, '#1c2028', 8, 9, 1, 5);
    for (i = 0; i < 3; i++) { P(g, St[1], 4, 9 + i * 2); P(g, St[0], 3, 10 + i * 2); P(g, St[1], 11, 10 + i * 2); P(g, St[0], 12, 11 + i * 2); }
    P(g, C.blood, 10, 12); P(g, C.blood, 6, 10);
  }
  function iArmGolem(g) {
    var st = MAT.stone, ir = MAT.iron;
    box(g, IK.sm, 6, 0, 4, 2); box(g, st, 5, 2, 6, 5); box(g, MAT.leather, 5, 3, 3, 2); box(g, ir, 4, 6, 8, 2);
    box(g, st, 3, 8, 10, 7); R(g, st[2], 6, 10, 1, 4); R(g, st[2], 9, 10, 1, 4); R(g, st[1], 4, 9, 8, 1);
    P(g, ir[1], 5, 7); P(g, ir[1], 10, 7); P(g, IK.st, 4, 13);
  }
  function iArmTijera(g) {
    var St = MAT.steel, B = MAT.brass;
    ov(g, St[2], 5, 3, 2.8, 2.8); ov(g, St[0], 5, 3, 2.2, 2.2); ov(g, '#1c2028', 5, 3, 1.1, 1.1);
    ov(g, St[2], 11, 3, 2.8, 2.8); ov(g, St[0], 11, 3, 2.2, 2.2); ov(g, '#1c2028', 11, 3, 1.1, 1.1);
    tline(g, St[2], 6, 5, 9, 8, 3); tline(g, St[2], 10, 5, 7, 8, 3); tline(g, St[0], 6, 5, 9, 8, 2); tline(g, St[0], 10, 5, 7, 8, 2);
    box(g, B, 7, 6, 2, 2);
    box(g, St, 5, 8, 3, 6); box(g, St, 9, 8, 3, 6); R(g, '#1c2028', 8, 9, 1, 5); R(g, St[1], 5, 9, 1, 4); P(g, St[2], 7, 14); P(g, St[2], 9, 14);
    P(g, C.blood, 7, 14); P(g, C.blood, 8, 14);
  }
  function iArmPiston(g) {
    var B = MAT.brass, St = MAT.steel;
    box(g, IK.sm, 6, 0, 4, 2);
    tline(g, MAT.rubber[1], 4, 2, 3, 6, 2); tline(g, MAT.rubber[0], 3, 6, 5, 8, 2);
    box(g, B, 5, 2, 6, 8); R(g, B[2], 5, 4, 6, 1); R(g, B[2], 5, 8, 6, 1); ov(g, '#e8dcc0', 8, 6, 1.4, 1.4); P(g, C.blood, 8, 6);
    box(g, St, 7, 10, 2, 3); box(g, St, 4, 12, 8, 3); R(g, MAT.iron[2], 4, 14, 8, 1); P(g, St[1], 5, 13); P(g, St[1], 10, 13);
  }
  function iArmTentaculo(g) {
    var P4 = MAT.plum, N = 50, i, pts = [];
    for (i = 0; i <= N; i++) {
      var t = i / N, x = 7 + Math.sin(t * 5) * (1.2 + t * 2.6), y = 1.5 + t * 12;
      if (t > 0.8) x += (t - 0.8) * 16;
      pts.push([x, y, 3.1 - 2.1 * t]);
    }
    for (i = 0; i < pts.length; i++) ov(g, P4[0], pts[i][0], pts[i][1], pts[i][2], pts[i][2]);
    for (i = 0; i < pts.length; i += 2) if (pts[i][2] > 1) ov(g, P4[1], pts[i][0] - 0.8, pts[i][1] - 0.3, pts[i][2] * 0.4, pts[i][2] * 0.4);
    for (i = 8; i < pts.length - 4; i += 6) P(g, '#f0c8e0', Math.round(pts[i][0] + pts[i][2] * 0.5), Math.round(pts[i][1]));
    P(g, '#7fe04a', Math.round(pts[N][0]) + 1, 14); P(g, '#b6ef7a', Math.round(pts[N][0]) + 1, 15);
  }
  function iLegMuerta(g) {          // vista lateral: la pierna mira a la derecha
    var sm = IK.sm;
    box(g, sm, 4, 0, 5, 7); R(g, MAT.rag[0], 4, 0, 5, 3); R(g, MAT.rag[2], 4, 3, 5, 1); P(g, MAT.rag[0], 5, 4); P(g, MAT.rag[0], 7, 4);
    seamH(g, IK, 4, 8, 7); box(g, sm, 5, 8, 4, 4);
    box(g, sm, 4, 12, 9, 3); P(g, sm[2], 10, 14); P(g, sm[2], 12, 14); P(g, sm[2], 11, 13);
  }
  function iLegSabueso(g) {         // pata trasera de perro: muslo hacia delante, corvejón atrás, zarpa
    var F = MAT.fur, L = MAT.furLt;
    tline(g, F[2], 6, 2, 11, 6, 5); tline(g, F[0], 5, 1, 10, 5, 5); tline(g, F[1], 4, 0, 9, 4, 1);
    tline(g, F[2], 11, 6, 6, 10, 3); tline(g, F[0], 10, 5, 5, 9, 3);
    tline(g, F[0], 5, 9, 7, 13, 2);
    box(g, L, 5, 13, 9, 2); P(g, MAT.bone[1], 14, 14); P(g, MAT.bone[1], 12, 15); P(g, F[2], 9, 14); P(g, F[2], 11, 14);
  }
  function iLegResorte(g) {
    var St = MAT.steel, B = MAT.brass, y;
    box(g, IK.sm, 6, 0, 4, 2); box(g, B, 4, 2, 8, 2);
    R(g, '#14181e', 6, 4, 4, 8);
    for (y = 4; y < 12; y++) { var ph = y & 3; if (ph === 0) R(g, St[1], 5, y, 6, 1); else if (ph === 1) R(g, St[0], 5, y, 6, 1); else if (ph === 2) R(g, St[2], 5, y, 6, 1); }
    box(g, B, 3, 12, 10, 2); box(g, MAT.rubber, 3, 14, 10, 2);
  }
  function iLegArana(g) {
    var St = MAT.steel, B = MAT.brass;
    tline(g, St[2], 9, 2, 3, 5, 3); tline(g, St[2], 3, 5, 6, 11, 3); tline(g, St[2], 6, 11, 7, 14, 2);
    tline(g, St[0], 9, 2, 3, 5, 2); tline(g, St[0], 3, 5, 6, 11, 2); tline(g, St[1], 8, 1, 3, 4, 1);
    ov(g, B[2], 10, 2, 2.6, 2.6); ov(g, B[0], 10, 2, 2, 2); ov(g, B[2], 3, 5, 2, 2); ov(g, B[0], 3, 5, 1.4, 1.4); ov(g, B[0], 6, 11, 1.6, 1.6);
    P(g, MAT.bone[1], 7, 15);
  }
  function iLegPesada(g) {          // bota de hierro en vista lateral
    var I = MAT.iron, B = MAT.brass;
    box(g, IK.sm, 4, 0, 5, 2); box(g, I, 3, 2, 7, 3); R(g, I[1], 5, 0, 2, 3); P(g, I[1], 5, 0);
    box(g, I, 4, 5, 5, 5); R(g, I[2], 4, 7, 5, 1); R(g, I[1], 5, 6, 1, 3); P(g, B[1], 8, 6); P(g, B[1], 8, 9);
    box(g, B, 3, 9, 7, 1); box(g, I, 3, 10, 11, 4); R(g, I[1], 4, 11, 2, 1); R(g, OL, 3, 14, 11, 1); P(g, B[1], 12, 11);
  }
  function iStumpHead(g) {
    wrapS(g, 6, 11, 4, 4); wrapOv(g, 8, 7, 5.5, 5.5); R(g, BAND[2], 5, 10, 6, 1);
    R(g, C.blood, 8, 4, 3, 2); P(g, C.bloodHi, 8, 4); P(g, C.blood, 9, 6); R(g, BAND[0], 12, 8, 3, 1); P(g, BAND[2], 14, 9);
  }
  function iStumpTorso(g) {
    for (var y = 2; y < 15; y++) { var w = y < 4 ? 6 : (y < 11 ? 5 : 4); for (var x = 8 - w; x < 8 + w; x++) P(g, (((x + y) & 3) === 0) ? BAND[2] : (x === 8 - w ? BAND[1] : BAND[0]), x, y); }
    R(g, BAND[2], 4, 14, 8, 1); R(g, MAT.leather[0], 4, 11, 8, 1);
    R(g, C.blood, 5, 5, 3, 2); P(g, C.bloodHi, 5, 5); R(g, C.blood, 9, 8, 2, 2); R(g, BAND[0], 12, 10, 3, 1);
  }
  function iStumpArm(g) {
    box(g, IK.sm, 6, 1, 4, 3); seamH(g, IK, 6, 9, 4); wrapS(g, 6, 5, 4, 6); wrapOv(g, 8, 11, 2, 2); R(g, BAND[2], 6, 5, 4, 1);
    R(g, C.blood, 7, 10, 2, 2); P(g, C.bloodHi, 7, 10); R(g, BAND[0], 10, 7, 3, 1); P(g, BAND[2], 12, 8);
  }
  function iStumpLeg(g) {
    box(g, IK.sm, 5, 1, 6, 4); seamH(g, IK, 5, 10, 5); wrapS(g, 5, 6, 6, 5); wrapOv(g, 8, 11, 3, 2); R(g, BAND[2], 5, 6, 6, 1);
    R(g, C.blood, 6, 9, 3, 2); box(g, MAT.wood, 7, 12, 2, 3); R(g, MAT.iron[0], 6, 14, 4, 1); R(g, MAT.leather[0], 5, 8, 6, 1);
  }
  var ICON_ART = {
    cab_cosido: iHeadCosido, cab_sabueso: iHeadSabueso, cab_relojero: iHeadRelojero, cab_quimera: iHeadQuimera, cab_plaga: iHeadPlaga,
    tor_remendado: iTorRemendado, tor_caldera: iTorCaldera, tor_costillar: iTorCostillar, tor_alambique: iTorAlambique,
    bra_muerto: iArmMuerto, bra_sierra: iArmSierra, bra_golem: iArmGolem, bra_tijera: iArmTijera, bra_piston: iArmPiston, bra_tentaculo: iArmTentaculo,
    pie_muerta: iLegMuerta, pie_sabueso: iLegSabueso, pie_resorte: iLegResorte, pie_arana: iLegArana, pie_pesada: iLegPesada,
    stump_head: iStumpHead, stump_torso: iStumpTorso, stump_arm: iStumpArm, stump_leg: iStumpLeg
  };
  var QMARK = ['.xxx.', 'x...x', '....x', '...x.', '..x..', '.....', '..x..'];
  var iconCache = {};
  function iconOf(id, silhouette) {
    var fn = own(ICON_ART, id), key = (fn ? id : '?') + (silhouette || !fn ? '|s' : ''), o = iconCache[key];
    if (o) return o;
    o = mk(16, 16);
    if (fn && !silhouette) { fn(o.g); outline(o, OL); }
    else {
      if (fn) { var t = mk(16, 16); fn(t.g); o.g.drawImage(silh(t.c, '#2a2136'), 0, 0); outline(o, '#4a3b5c'); }
      else { ov(o.g, '#2a2136', 8, 8, 6, 6); outline(o, '#4a3b5c'); }
      paint(o.g, QMARK, { x: '#8a7f6a' }, 6, 4, false);
    }
    return (iconCache[key] = o);
  }
  S.drawLimbIcon = function (ctx, limbId, x, y, opt) {
    opt = opt || {};
    var o = iconOf(limbId, opt.silhouette);
    if (opt.alpha != null && opt.alpha !== 1) { ctx.save(); ctx.globalAlpha *= opt.alpha; ctx.drawImage(o.c, Math.round(x), Math.round(y)); ctx.restore(); }
    else ctx.drawImage(o.c, Math.round(x), Math.round(y));
  };
  S.drawStumpIcon = function (ctx, type, x, y) {
    var o = iconOf('stump_' + type);
    ctx.drawImage(o.c, Math.round(x), Math.round(y));
  };

})();
