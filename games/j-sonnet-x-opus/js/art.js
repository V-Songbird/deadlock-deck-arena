/* Deadlock Deck — DD.Art: palette, bitmap font, icons, tiles, items, traps, backgrounds, logo and fx.
   Everything static is rendered once into offscreen canvases on first use and reused. */
(function () {
  window.DD = window.DD || {};

  var W = 384, H = 216, TILE = 16;
  var PAL = {
    ink: '#0d0a12', night: '#1a1424', stone: '#2b2236', stone2: '#3d3149', mist: '#5b4d6b', bone: '#e8dcc0', parch: '#c9b98f',
    brass: '#b8892e', brass2: '#e0b84a', copper: '#a4532c', blood: '#8c1c2b', blood2: '#c8323f', flame: '#f07a1e', flame2: '#ffc23a',
    verdi: '#2f7d6d', verdi2: '#58c2a0', acid: '#9be04a', flesh: '#b07a6a', flesh2: '#7d4f52', ice: '#7fb8d6',
    steel: '#a9a6b8', rust: '#5e2c18', glow: '#fff1b8'
  };

  // ---------- helpers ----------
  function col(c) { return PAL[c] || c; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  var rgbCache = {};
  function rgb(c) {
    var v = rgbCache[c];
    if (!v) {
      var h = col(c);
      v = rgbCache[c] = [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
    }
    return v;
  }
  // Canvas whose pixels come from fn(x, y) -> '#rrggbb' | PAL key | null (transparent).
  function paint(w, h, fn) {
    var c = mk(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var k = fn(x, y);
        if (!k) continue;
        var v = rgb(k), i = (y * w + x) * 4;
        d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  function px(g, c, x, y, w, h) { g.fillStyle = col(c); g.fillRect(x, y, w || 1, h || 1); }
  function hash(n) {
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    return (n ^ (n >>> 16)) >>> 0;
  }
  function h2(x, y, s) { return hash((x * 73856093) ^ (y * 19349663) ^ ((s || 0) * 83492791)); }
  function rng(a) {
    return function () {
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  // Ordered-dither pick along a color ramp, f in 0..1.
  function ramp(colors, f, x, y) {
    var p = Math.max(0, Math.min(0.999, f)) * (colors.length - 1), i = p | 0;
    return (p - i) * 16 > BAYER[(y & 3) * 4 + (x & 3)] + 0.5 ? colors[i + 1] : colors[i];
  }
  function line(g, x0, y0, x1, y1, w) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); w = w || 1;
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) {
      g.fillRect(x0, y0, w, w);
      if (x0 === x1 && y0 === y1) return;
      var e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function inArch(x, y, cx, hw, sy, by) { // pointed (equilateral) gothic arch
    var dx = Math.abs(x - cx);
    if (y > by || dx > hw) return false;
    if (y >= sy) return true;
    var ex = hw + dx, ey = sy - y;
    return ex * ex + ey * ey <= 4 * hw * hw;
  }
  function brickMortar(x, y, bw, bh) {
    var off = ((y / bh | 0) & 1) * (bw >> 1);
    return y % bh === bh - 1 || (x + off) % bw === bw - 1;
  }

  // Soft radial light sprites, drawn additively.
  var glowCache = {};
  function glow(color, r) {
    var key = color + r, c = glowCache[key];
    if (!c) {
      c = glowCache[key] = mk(r * 2, r * 2);
      var g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r), v = rgb(color);
      gr.addColorStop(0, 'rgba(' + v + ',0.9)');
      gr.addColorStop(0.4, 'rgba(' + v + ',0.35)');
      gr.addColorStop(1, 'rgba(' + v + ',0)');
      g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
    }
    return c;
  }
  function light(ctx, color, r, x, y, alpha) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(glow(color, r), Math.round(x - r), Math.round(y - r));
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Gear pixel classifier: 0 empty, 1 edge, 2 body, 3 lit body. `spokes` 0 = solid disc.
  function gearPx(dx, dy, r, teeth, spokes, phase, hole) {
    var d = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx), td = Math.max(1.5, r * 0.16);
    var out = Math.cos(teeth * (a - phase)) > 0 ? r : r - td;
    if (d > out || d < hole) return 0;
    var edge = d > out - 1 || d < hole + 1;
    if (spokes) {
      var rimIn = r - td * 2.2, hub = hole + Math.max(2, r * 0.15);
      if (d < rimIn && d > hub) {
        var step = 2 * Math.PI / spokes, th = phase + Math.round((a - phase) / step) * step;
        var perp = Math.abs(dx * Math.sin(th) - dy * Math.cos(th)), sw = Math.max(1.5, r * 0.08);
        if (perp > sw) return 0;
        edge = edge || perp > sw - 1;
      } else if ((d >= rimIn && d < rimIn + 1) || (d <= hub && d > hub - 1)) edge = true;
    }
    return edge ? 1 : (dx + dy < -r * 0.3 ? 3 : 2);
  }
  // Rotation frames of a gear (rendered lazily); the frames span one symmetry period so the loop is seamless.
  // `teeth` must be a multiple of `spokes`. cols = [edge, body, lit].
  var gearCache = {};
  function gearFrame(r, teeth, spokes, frames, cols, i) {
    var key = r + ':' + teeth + ':' + spokes + ':' + frames + ':' + cols.join(), set = gearCache[key] || (gearCache[key] = []);
    i = ((i % frames) + frames) % frames;
    if (!set[i]) {
      var phase = i / frames * 2 * Math.PI / (spokes || teeth), hole = Math.max(1, r * 0.1);
      set[i] = paint(r * 2 + 1, r * 2 + 1, function (x, y) {
        var k = gearPx(x - r, y - r, r, teeth, spokes, phase, hole);
        return k ? cols[k - 1] : null;
      });
    }
    return set[i];
  }

  // ---------- bitmap font (5x7, 1 px spacing, 2 rows of headroom for accents) ----------
  var GLYPHS = {
    A: '.###. #...# #...# ##### #...# #...# #...#', B: '####. #...# #...# ####. #...# #...# ####.',
    C: '.###. #...# #.... #.... #.... #...# .###.', D: '####. #...# #...# #...# #...# #...# ####.',
    E: '##### #.... #.... ####. #.... #.... #####', F: '##### #.... #.... ####. #.... #.... #....',
    G: '.###. #...# #.... #.### #...# #...# .####', H: '#...# #...# #...# ##### #...# #...# #...#',
    I: '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.', J: '..### ...#. ...#. ...#. ...#. #..#. .##..',
    K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#', L: '#.... #.... #.... #.... #.... #.... #####',
    M: '#...# ##.## #.#.# #.#.# #...# #...# #...#', N: '#...# #...# ##..# #.#.# #..## #...# #...#',
    O: '.###. #...# #...# #...# #...# #...# .###.', P: '####. #...# #...# ####. #.... #.... #....',
    Q: '.###. #...# #...# #...# #.#.# #..#. .##.#', R: '####. #...# #...# ####. #.#.. #..#. #...#',
    S: '.#### #.... #.... .###. ....# ....# ####.', T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
    U: '#...# #...# #...# #...# #...# #...# .###.', V: '#...# #...# #...# #...# #...# .#.#. ..#..',
    W: '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.', X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
    Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..', Z: '##### ....# ...#. ..#.. .#... #.... #####',
    0: '.###. #...# #..## #.#.# ##..# #...# .###.', 1: '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
    2: '.###. #...# ....# ...#. ..#.. .#... #####', 3: '####. ....# ....# .###. ....# ....# ####.',
    4: '...#. ..##. .#.#. #..#. ##### ...#. ...#.', 5: '##### #.... ####. ....# ....# #...# .###.',
    6: '..##. .#... #.... ####. #...# #...# .###.', 7: '##### ....# ...#. ..#.. .#... .#... .#...',
    8: '.###. #...# #...# .###. #...# #...# .###.', 9: '.###. #...# #...# .#### ....# ...#. .##..',
    '.': '..... ..... ..... ..... ..... .##.. .##..', ',': '..... ..... ..... ..... .##.. ..#.. .#...',
    ':': '..... .##.. .##.. ..... .##.. .##.. .....', ';': '..... .##.. .##.. ..... .##.. ..#.. .#...',
    '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..', '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
    '¡': '..#.. ..... ..#.. ..#.. ..#.. ..#.. ..#..', '¿': '..#.. ..... ..#.. .#... #.... #...# .###.',
    "'": '..#.. ..#.. .#... ..... ..... ..... .....', '"': '.#.#. .#.#. .#.#. ..... ..... ..... .....',
    '-': '..... ..... ..... .###. ..... ..... .....', '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
    '/': '....# ....# ...#. ..#.. .#... #.... #....', '\\': '#.... #.... .#... ..#.. ...#. ....# ....#',
    '(': '...#. ..#.. .#... .#... .#... ..#.. ...#.', ')': '.#... ..#.. ...#. ...#. ...#. ..#.. .#...',
    '[': '.###. .#... .#... .#... .#... .#... .###.', ']': '.###. ...#. ...#. ...#. ...#. ...#. .###.',
    '%': '##..# ##..# ...#. ..#.. .#... #..## #..##', '*': '..... ..#.. #.#.# .###. #.#.# ..#.. .....',
    '<': '...#. ..#.. .#... #.... .#... ..#.. ...#.', '>': '.#... ..#.. ...#. ....# ...#. ..#.. .#...',
    '=': '..... ..... ##### ..... ##### ..... .....', '_': '..... ..... ..... ..... ..... ..... #####',
    '#': '.#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.', '&': '.##.. #..#. #.#.. .#... #.#.# #..#. .##.#',
    '|': '..#.. ..#.. ..#.. ..#.. ..#.. ..#.. ..#..', '~': '..... ..... .#... #.#.# ...#. ..... .....',
    '·': '..... ..... ..... .##.. .##.. ..... .....'
  };
  var ACUTE = '...#. ..#.. ';
  GLYPHS['Á'] = ACUTE + GLYPHS.A; GLYPHS['É'] = ACUTE + GLYPHS.E; GLYPHS['Í'] = ACUTE + GLYPHS.I;
  GLYPHS['Ó'] = ACUTE + GLYPHS.O; GLYPHS['Ú'] = ACUTE + GLYPHS.U;
  GLYPHS['Ü'] = '..... .#.#. ' + GLYPHS.U; GLYPHS['Ñ'] = '.##.# #..#. ' + GLYPHS.N;
  var ALIAS = { '—': '-', '–': '-', '×': 'X', '“': '"', '”': '"', '‘': "'", '’': "'", '…': '.', 'º': '·' };
  var GW = 6, GH = 9, GKEYS = Object.keys(GLYPHS), GI = {}, GROWS = [], atlases = {};
  GKEYS.forEach(function (k, i) {
    var r = GLYPHS[k].split(' ');
    GI[k] = i;
    GROWS.push(r.length === 7 ? ['.....', '.....'].concat(r) : r);
  });
  function atlas(color) { // one strip of every glyph in one color
    return atlases[color] || (atlases[color] = paint(GW * GROWS.length, GH, function (x, y) {
      return GROWS[(x / GW) | 0][y].charAt(x % GW) === '#' ? color : null;
    }));
  }
  function textWidth(str, scale) { var n = String(str).length; return n ? (n * GW - 1) * (scale || 1) : 0; }
  function glyphRun(ctx, str, x, y, img, s) {
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      if (ch === ' ') continue;
      var gi = GI[ch];
      if (gi === undefined) gi = GI[ALIAS[ch]];
      if (gi === undefined) gi = GI['?'];
      ctx.drawImage(img, gi * GW, 0, GW, GH, x + i * GW * s, y - 2 * s, GW * s, GH * s);
    }
  }
  function text(ctx, str, x, y, color, scale, align, shadow) {
    str = String(str).toUpperCase(); scale = Math.max(1, Math.round(scale || 1));
    var w = textWidth(str, scale);
    x = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x); y = Math.round(y);
    ctx.imageSmoothingEnabled = false;
    if (shadow) glyphRun(ctx, str, x + scale, y + scale, atlas(col(shadow)), scale);
    glyphRun(ctx, str, x, y, atlas(col(color || 'bone')), scale);
  }
  function wrap(str, maxWidth, scale) {
    var s = scale || 1, max = Math.max(1, Math.floor((maxWidth + s) / (GW * s))), out = [];
    String(str).split('\n').forEach(function (para) {
      var cur = '';
      para.split(' ').forEach(function (word) {
        while (word.length > max) {
          if (cur) { out.push(cur); cur = ''; }
          out.push(word.slice(0, max)); word = word.slice(max);
        }
        if (!cur) cur = word;
        else if (cur.length + 1 + word.length <= max) cur += ' ' + word;
        else { out.push(cur); cur = word; }
      });
      out.push(cur);
    });
    return out;
  }

  // ---------- pixel grids (icons, pickups) ----------
  var CMAP = {
    k: 'ink', n: 'night', t: 'stone', s: 'stone2', m: 'mist', w: 'bone', p: 'parch', b: 'brass', B: 'brass2', c: 'copper',
    r: 'blood', R: 'blood2', f: 'flame', F: 'flame2', v: 'verdi', V: 'verdi2', a: 'acid', l: 'flesh', L: 'flesh2',
    i: 'ice', S: 'steel', g: 'glow', u: 'rust'
  };
  function grid(rows) { return paint(rows[0].length, rows.length, function (x, y) { return CMAP[rows[y].charAt(x)] || null; }); }

  var ICON_ROWS = { // 8x8, rows separated by spaces, in the contract order (6.5)
    sword: '.......w ......wm .....wm. .b..wm.. ..bwm... ..cb.... .c..b... B.......',
    shield: 'bbbbbbbb bmmwwmmb bwwwwwwb bmmwwmmb bmmwwmmb .bmwwmb. ..bwwb.. ...bb...',
    flame: '....f... ...ff... ..ffF.f. .ffFFff. .fFFFFf. ffFFwFff .fFwwFf. ..ffff..',
    heart: '.rr..rr. rRRrrRRr rRwRRRRr rRRRRRRr .rRRRRr. ..rRRr.. ...rr... ........',
    bolt: '....FFF. ...FFF.. ..FFF... .FFFFFF. ...FFF.. ..FFf... .FF..... F.......',
    gear: '.b.bb.b. bbBBBBbb .BBbbBB. bBb..bBb bBb..bBb .BBbbBB. bbBBBBbb .b.bb.b.',
    skull: '.wwwwww. wwwwwwww wkkwwkkw wkkwwkkw wwwkkwww .wwwwww. .wkwwkw. ..wwww..',
    snow: '...ii... .i.ii.i. ..iiii.. iiiwwiii iiiwwiii ..iiii.. .i.ii.i. ...ii...',
    wrench: '....w..w ....w..w ....wwww ....www. ...pp... ..pp.... .pp..... pp......',
    hourglass: 'bbbbbbbb .wFFFFw. ..wFFw.. ...ww... ...F.... ..w.Fw.. .wFFFFw. bbbbbbbb',
    essence: '...VV... ..VwVv.. .VwVVvv. VwVVVVvv vVVVVVvv .vVVVvv. ..vVvv.. ...vv...',
    scroll: '........ cppppppc .wwwwww. .wccccw. .wwwwww. .wcccww. .wwwwww. cppppppc',
    cards: '...ppppp ...pcccp wwwwwccp wRRRwccp wRwRwccp wRRRwppp wRRRw... wwwww...',
    weak: '..aaaa.. ..akaa.. ..aaka.. aaaaaaaa .aaaaaa. ..aaaa.. ...aa... ........',
    vulnerable: '..RRRR.. .R....R. R..ww..R R.wRRw.R R.wRRw.R R..ww..R .R....R. ..RRRR..',
    stun: '.F...... FwF...F. .F...FwF ......F. ...F.... ..FwF... ...F.... ........',
    strength: '...RR... ..RwRR.. .RRRRRR. RRRRRRRR ..RRRR.. ..RRRR.. ..RRRR.. ..rrrr..',
    arrow: '....w... ....ww.. wwwwwww. wwwwwwww wwwwwww. ....ww.. ....w... ........',
    lock: '..pppp.. .p....p. .p....p. bbbbbbbb bBBkkBBb bBBkkBBb bBBBBBBb bbbbbbbb',
    check: '........ .......a ......aa .....aa. a...aa.. aa.aa... .aaa.... ..a.....',
    star: '...FF... ...FF... FFFFFFFF .FFFFFF. ..FFFF.. .FFFFFF. .FF..FF. F......F',
    broken: 'ww...... www..... .www.... ..ww.R.. ..R.ww.. ....www. .....www ......ww',
    boot: '.cccc... .cpcc... .cccc... .bbbb... .ccccc.. .cccccc. .ccccccc .bbbbbbb',
    eye: '........ ..wwww.. .wwRRww. wwRkkRww wwRkkRww .wwRRww. ..wwww.. ........',
    brain: '..llll.. .lLllLl. llLlLlll lLllLlLl llLllLll .lllllL. ...LLl.. ....l...',
    fist: '.ll.ll.. lllllll. lLlLlLl. lllllll. LLLLlll. .lllll.. .lllll.. .cccc...',
    bone: '........ ww....ww www..www .wwwwww. .pppppp. ppp..ppp pp....pp ........',
    drop: '...RR... ...RR... ..RRRR.. .RRwRRR. .RwRRRR. .RRRRRr. ..rRRr.. ...rr...'
  };
  var ICONS = Object.keys(ICON_ROWS), iconCache = {};
  function icon(ctx, name, x, y, scale) {
    var rows = ICON_ROWS[name];
    if (!rows) return;
    var c = iconCache[name] || (iconCache[name] = grid(rows.split(' '))), s = Math.max(1, Math.round(scale || 1));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, Math.round(x), Math.round(y), 8 * s, 8 * s);
  }

  var ITEM_ROWS = {
    elixir: ['...cccc...', '...bbbb...', '...i.wi...', '...i.wi...', '..ii..ii..', '.iaaaaaai.', 'iaaaaaaaai',
      'iRwRRRRRRi', 'iRwRRRRRRi', 'iRRRRRRrRi', 'iRRRRRrrRi', '.iRRRrrRi.', '..iiiiii..'],
    thread: ['...........w', '..........S.', '.bbbbbbb.S..', '..RrRrR.S...', '..rRrRrS....', '..RrRrS.....',
      '..rRrSr.....', '..RrSrR.....', '..rSrRr.....', '.bSbbbbb....', '.S....R.....', 'S......RR...'],
    essence: ['....VV....', '...VwVv...', '..VwVVvv..', '.VwVVVVvv.', 'VwVVVVVVvv', 'VVVVVVVvvv',
      'vVVVVVVvvv', '.vVVVVvvv.', '..vVVvvv..', '...vVvv...', '....vv....'],
    blueprint: ['cw........wc', 'cwppppppppwc', 'cwpppvvpppwc', 'cwpppvvpppwc', 'cwpvvvvvvpwc', 'cwpppvRpppwc',
      'cwpppvvpppwc', 'cwppvppvppwc', 'cwpvppppvpwc', 'cwppppppppwc', 'cw........wc']
  };
  var ITEM_GLOW = { elixir: 'blood2', thread: 'bone', gear: 'flame2', essence: 'verdi2', blueprint: 'parch' };
  var itemCache = {}, gearItemCache = [];
  function makeGearItem(i) { // brass gear with a tiny glowing hourglass hub
    return paint(13, 13, function (x, y) {
      var dx = x - 6, dy = y - 6, k = gearPx(dx, dy, 6, 8, 0, i / 4 * Math.PI / 4, 0);
      if (!k) return null;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 2) return Math.abs(dy) === 2 || dx === 0 ? 'ink' : 'flame2';
      return ['rust', 'brass', 'brass2'][k - 1];
    });
  }
  function item(ctx, id, x, y, t) {
    var gc = ITEM_GLOW[id];
    if (!gc) return;
    t = t || 0; x = Math.round(x); y = Math.round(y);
    var ph = t * 2.6 + (x + y) * 0.07, bob = Math.round(Math.sin(ph) * 1.5), s;
    ctx.globalAlpha = 0.45; ctx.fillStyle = PAL.ink;
    ctx.fillRect(x + 4, y + 13, 8, 1); ctx.fillRect(x + 5, y + 14, 6, 1);
    ctx.globalAlpha = 1;
    light(ctx, PAL[gc], 10, x + 8, y + 7 + bob, 0.3 + 0.15 * Math.sin(ph * 1.7));
    if (id === 'gear') { var fi = ((t * 5) | 0) & 3; s = gearItemCache[fi] || (gearItemCache[fi] = makeGearItem(fi)); }
    else s = itemCache[id] || (itemCache[id] = grid(ITEM_ROWS[id]));
    ctx.drawImage(s, x + ((16 - s.width) >> 1), y + ((15 - s.height) >> 1) + bob - 1);
  }

  // ---------- tiles (codes: 0 WALL, 1 FLOOR, 2 STAIRS_DOWN, 3 STAIRS_UP, 4 EXIT) ----------
  var BRICKS = ['#3d3149', '#382c44', '#43364f', '#34293f'];
  function wallPx(x, y, v) {
    var course = y >> 2, off = (course & 1) * 4, ly = y & 3;
    if (ly === 3 || ((x + off) & 7) === 7) return '#120d19';
    var hs = h2((x + off) >> 3, course, v), c = BRICKS[hs & 3];
    if (ly === 0) c = hs & 4 ? '#54466a' : '#4b3e5d';
    else if (ly === 2 && (hs & 8)) c = '#2e2439';
    return h2(x, y, v + 7) % 17 === 0 ? '#2a2034' : c;
  }
  function crack(g, r, x, y, n, c) {
    for (var i = 0; i < n; i++) { px(g, c, x, y); x += (r() * 3 | 0) - 1; y += r() < 0.7 ? 1 : 0; }
  }
  function makeWall(v) { // 0-2 plain, 3 cracked, 4 pipe, 5 gear, 6 torch sconce, 7 vent
    var c = paint(16, 16, function (x, y) { return wallPx(x, y, v); }), g = c.getContext('2d'), r = rng(v * 977 + 5);
    if (v === 3) { crack(g, r, 4 + (r() * 8 | 0), 0, 10, '#120d19'); px(g, '#23443e', 10, 13, 2, 1); px(g, 'verdi', 11, 12); }
    if (v === 4) {
      px(g, 'rust', 3, 6, 10, 1); px(g, '#d07a48', 3, 7, 10, 1); px(g, 'copper', 3, 8, 10, 1); px(g, 'rust', 3, 9, 10, 1);
      px(g, 'ink', 3, 10, 10, 1);
      [2, 12].forEach(function (fx) { px(g, 'brass', fx, 5, 2, 6); px(g, 'brass2', fx, 5, 2, 1); px(g, 'rust', fx, 10, 2, 1); });
      px(g, 'steel', 7, 5, 2, 1); px(g, 'blood2', 6, 4, 4, 1);
    }
    if (v === 5) { px(g, 'ink', 3, 3, 11, 11); g.drawImage(gearFrame(5, 8, 0, 1, ['#2a1c0c', '#6b4a18', '#8a6424'], 0), 3, 3); }
    if (v === 6) {
      g.globalAlpha = 0.4; px(g, 'ink', 5, 0, 6, 8); g.globalAlpha = 1;
      px(g, 'ink', 7, 10, 2, 5); px(g, 'steel', 7, 10, 1, 4); px(g, 'brass', 5, 8, 6, 2); px(g, 'brass2', 5, 8, 6, 1); px(g, 'rust', 6, 10, 4, 1);
    }
    if (v === 7) {
      px(g, '#54466a', 3, 4, 10, 1); px(g, 'ink', 4, 5, 8, 6); px(g, 'blood', 4, 9, 8, 2); px(g, '#2a2034', 3, 11, 10, 1);
      [5, 7, 9].forEach(function (bx) { px(g, '#4a4454', bx, 5, 1, 6); });
    }
    return c;
  }
  function wallVariant(seed) {
    var r = hash(seed) % 24;
    return r < 15 ? r % 3 : r < 18 ? 4 : r < 19 ? 5 : r < 20 ? 6 : r < 21 ? 7 : 3;
  }
  var FLOORS = ['#2a2135', '#272031', '#2d2439', '#251d2e'];
  var LAYOUTS = [[0, 0, 8, 8, 8, 0, 8, 8, 0, 8, 8, 8, 8, 8, 8, 8], [0, 0, 16, 8, 0, 8, 8, 8, 8, 8, 8, 8],
    [0, 0, 8, 16, 8, 0, 8, 8, 8, 8, 8, 8], [0, 0, 16, 16]];
  function floorPx(x, y, v) { // flagstones with grout on the tile's top/left edges so tiles join seamlessly
    var L = LAYOUTS[v & 3];
    for (var i = 0; i < L.length; i += 4) {
      var sx = x - L[i], sy = y - L[i + 1];
      if (sx < 0 || sy < 0 || sx >= L[i + 2] || sy >= L[i + 3]) continue;
      if (sx === 0 || sy === 0) return '#16111d';
      if (sx === 1 || sy === 1) return '#342a41';
      if (sx === L[i + 2] - 1 || sy === L[i + 3] - 1) return '#211a29';
      return h2(x, y, v) % 13 === 0 ? '#211a29' : FLOORS[h2(i, v, 3) & 3];
    }
    return '#16111d';
  }
  function makeFloor(v) { // 8 variants: cracks, a blood stain, moss, a bone chip
    var c = paint(16, 16, function (x, y) { return floorPx(x, y, v); }), g = c.getContext('2d'), r = rng(v * 131 + 9);
    if (v === 3 || r() < 0.4) crack(g, r, 3 + (r() * 10 | 0), 2 + (r() * 6 | 0), 6, '#16111d');
    if (v === 5) { px(g, '#3a1220', 9, 9, 4, 3); px(g, '#3a1220', 10, 8, 2, 5); px(g, '#4a1624', 10, 10, 2, 1); }
    if (v === 6) { px(g, '#23443e', 3, 12, 2, 1); px(g, '#23443e', 4, 13); }
    if (v === 7) { px(g, '#8a8270', 10, 11, 3, 1); px(g, '#8a8270', 11, 10); }
    return c;
  }
  function makeStairs(up) { // spiral stair well: dark pit going down, light well going up
    var R = up ? ['#c9b98f', '#8a7a5a', '#5b4d6b', '#3d3149'] : ['#0d0a12', '#1c1526', '#2e2439', '#43364f'];
    return paint(16, 16, function (x, y) {
      var dx = x - 7.5, dy = y - 7.5, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 7.6) return floorPx(x, y, 0);
      if (d > 6.4) return dx + dy < 0 ? 'brass' : '#6b4a18';
      if (d < 1.8) return up ? 'glow' : 'ink';
      var s = ((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI) * 8 + d * 0.45) % 1;
      if (s < 0.16) return up ? '#2b2236' : 'ink';
      return R[Math.min(3, ((d - 1.8) / 4.6 * 4) | 0)];
    });
  }
  function makeExit() { // heavy iron door in a brass frame; the seam glow is animated in tile()
    var c = paint(16, 16, function (x, y) {
      if (y < 2 || x < 2 || x > 13) {
        if (y === 0 || x === 0 || x === 15) return 'rust';
        return ((x === 1 || x === 14) && (y === 4 || y === 10)) || (y === 1 && (x === 4 || x === 11)) ? 'brass2' : 'brass';
      }
      if (x === 7 || x === 8) return 'ink';
      if (y === 5 || y === 11) return x === 3 || x === 5 || x === 10 || x === 12 ? 'brass2' : '#8a6424';
      if (x === 2 || x === 9) return '#4f4a5c';
      if (x === 6 || x === 13) return '#2a2632';
      return (x + (y >> 2)) % 3 === 0 ? '#353040' : '#3f3a4a';
    }), g = c.getContext('2d');
    px(g, 'brass', 6, 7, 4, 3); px(g, 'brass2', 6, 7, 4, 1); px(g, 'ink', 7, 8, 2, 1);
    return c;
  }
  var wallC = [], floorC = [], stairC = [], exitC = null;
  function tile(ctx, code, x, y, seed, t) {
    seed = seed | 0; t = t || 0; x = Math.round(x); y = Math.round(y);
    if (code === 0) {
      var v = wallVariant(seed);
      ctx.drawImage(wallC[v] || (wallC[v] = makeWall(v)), x, y);
      if (v === 6) { // torch flicker
        var f = ((t * 10 + (seed & 7)) | 0) % 3;
        light(ctx, PAL.flame, 7, x + 8, y + 7, 0.3 + f * 0.06);
        px(ctx, 'flame', x + 6, y + 5, 4, 3);
        px(ctx, 'flame2', x + 7, y + 4 - (f & 1), 2, 3 + (f & 1));
        px(ctx, 'blood2', x + 6 + f, y + 3 - (f & 1));
        px(ctx, 'glow', x + 7 + (f >> 1), y + 6);
      }
    } else if (code === 2 || code === 3) {
      ctx.drawImage(stairC[code] || (stairC[code] = makeStairs(code === 3)), x, y);
    } else if (code === 4) {
      ctx.drawImage(exitC || (exitC = makeExit()), x, y);
      var a = 0.55 + 0.45 * Math.sin(t * 3);
      ctx.globalAlpha = a * 0.35; ctx.fillStyle = PAL.flame;
      ctx.fillRect(x + 6, y + 2, 4, 5); ctx.fillRect(x + 6, y + 10, 4, 6);
      ctx.globalAlpha = a; ctx.fillStyle = PAL.flame2;
      ctx.fillRect(x + 7, y + 2, 2, 5); ctx.fillRect(x + 7, y + 10, 2, 6);
      ctx.globalAlpha = 1;
    } else {
      var fv = hash(seed) & 7;
      ctx.drawImage(floorC[fv] || (floorC[fv] = makeFloor(fv)), x, y);
    }
  }

  // ---------- traps and fire ----------
  function platePx(x, y) {
    if (x < 1 || y < 1 || x > 14 || y > 14) return null;
    if (x === 1 || y === 1) return '#4a4454';
    if (x === 14 || y === 14) return '#221e29';
    return '#35303d';
  }
  var HOLES = [3, 7, 11];
  function makeSpikes(stage) { // 0 retracted holes, 1 tips showing, 2 full spikes
    var c = paint(16, 16, function (x, y) {
      var p = platePx(x, y);
      if (!p) return null;
      var hx = HOLES.indexOf(x) >= 0 || HOLES.indexOf(x - 1) >= 0, top = HOLES.indexOf(y) >= 0;
      if (hx && (top || HOLES.indexOf(y - 1) >= 0)) return stage === 1 && top ? 'steel' : 'ink';
      return p;
    }), g = c.getContext('2d');
    if (stage === 2) {
      HOLES.forEach(function (hx, i) {
        HOLES.forEach(function (hy, j) {
          px(g, (i + j) % 3 ? 'bone' : 'blood2', hx, hy - 3); px(g, 'bone', hx, hy - 2); px(g, 'steel', hx + 1, hy - 2);
          px(g, 'steel', hx, hy - 1); px(g, 'mist', hx + 1, hy - 1); px(g, 'steel', hx, hy); px(g, 'stone2', hx + 1, hy);
        });
      });
    }
    return c;
  }
  function makeGrate() {
    return paint(16, 16, function (x, y) {
      var p = platePx(x, y);
      if (!p || x < 3 || y < 3 || x > 12 || y > 12) return p;
      if (x === 3 || y === 3) return '#221e29';
      return (y & 1) === 0 && x < 12 && y < 12 ? 'ink' : '#5a5466';
    });
  }
  function makePuff() {
    return paint(12, 12, function (x, y) {
      var d = Math.sqrt((x - 5.5) * (x - 5.5) + (y - 5.5) * (y - 5.5));
      return d > 5.8 ? null : d < 3.6 ? '#e8e4ee' : (x + y) & 1 || d < 5 ? '#b9b2c6' : null;
    });
  }
  var spikeC = [], grateC = null, puffC = null;
  function trap(ctx, id, x, y, state, t) {
    x = Math.round(x); y = Math.round(y); t = t || 0;
    var blink = ((t * 8) | 0) & 1, i, k;
    if (id === 'spikes') {
      var st = state === 'active' ? 2 : state === 'warn' && blink ? 1 : 0;
      ctx.drawImage(spikeC[st] || (spikeC[st] = makeSpikes(st)), x, y);
      if (state === 'warn' && blink) {
        ctx.fillStyle = PAL.blood2;
        ctx.fillRect(x + 1, y + 1, 14, 1); ctx.fillRect(x + 1, y + 14, 14, 1); ctx.fillRect(x + 1, y + 2, 1, 12); ctx.fillRect(x + 14, y + 2, 1, 12);
      }
      return;
    }
    ctx.drawImage(grateC || (grateC = makeGrate()), x, y);
    if (state !== 'warn' && state !== 'active') return;
    var hot = state === 'active';
    ctx.globalAlpha = hot ? 0.75 : 0.3 + 0.35 * blink;
    ctx.fillStyle = hot ? PAL.flame : PAL.blood2;
    for (i = 4; i <= 10; i += 2) ctx.fillRect(x + 4, y + i, 8, 1);
    ctx.fillStyle = PAL.bone;
    if (!hot) { // hissing wisps
      for (i = 0; i < 4; i++) {
        k = (t * 1.8 + i * 0.25) % 1;
        ctx.globalAlpha = 0.8 * (1 - k);
        ctx.fillRect(x + 4 + i * 2 + Math.round(Math.sin(t * 9 + i * 2)), y + 8 - Math.round(k * 12), 1, 2);
      }
    } else { // steam plume rising above the tile
      puffC = puffC || makePuff();
      for (i = 0; i < 7; i++) {
        k = (t * 1.5 + i / 7) % 1;
        var sz = Math.round(6 + k * 12);
        ctx.globalAlpha = 0.85 * (1 - k);
        ctx.drawImage(puffC, Math.round(x + 8 - sz / 2 + Math.sin(t * 3 + i) * 2), Math.round(y + 8 - k * 30 - sz / 2), sz, sz);
      }
    }
    ctx.globalAlpha = 1;
  }
  var fireC = [];
  function makeFire(f) {
    var r = rng(f * 7919 + 3), hs = [], i;
    for (i = 0; i < 16; i++) hs.push(5 + r() * 6 + 3 * Math.sin(i * 0.9 + f * 1.7) + (i > 3 && i < 12 ? 2 : 0));
    var c = paint(16, 16, function (x, y) {
      var k = y - (16 - hs[x]);
      if (k < 0) return null;
      if (k < 1) return 'blood2';
      if (k < 3) return 'flame';
      return y > 12 && x > 4 && x < 11 ? 'glow' : 'flame2';
    }), g = c.getContext('2d');
    for (i = 0; i < 3; i++) px(g, r() < 0.5 ? 'flame2' : 'flame', (r() * 14 + 1) | 0, (r() * 6) | 0);
    return c;
  }
  function flames(ctx, x, y, t) {
    var f = ((((t || 0) * 8) | 0) + ((x * 7 + y * 13) >> 4)) & 3;
    ctx.drawImage(fireC[f] || (fireC[f] = makeFire(f)), x, y);
  }
  function fire(ctx, x, y, t) {
    x = Math.round(x); y = Math.round(y);
    ctx.globalAlpha = 0.25; ctx.fillStyle = PAL.flame; ctx.fillRect(x, y, 16, 16); ctx.globalAlpha = 1;
    flames(ctx, x, y, t);
  }

  // ---------- backgrounds (static part cached, a few animated elements per call) ----------
  function candle(ctx, x, y, t, i) {
    var f = ((t * 9 + i * 3) | 0) % 3;
    light(ctx, PAL.flame, 36, x, y, 0.28 + f * 0.04);
    px(ctx, 'flame', x - 1, y - 1, 3, 3);
    px(ctx, 'flame2', x, y - 3 + (f & 1), 1, 4 - (f & 1));
    px(ctx, 'blood2', x - 1 + f, y - 4);
    px(ctx, 'glow', x, y);
  }

  function makeTitle() {
    var sky = ['#07050c', '#110b18', '#1c1024', '#34121e', '#5a1c1a'];
    var c = paint(W, H, function (x, y) {
      var tw = Math.abs(x - 312);
      if ((y >= 96 && tw <= 24) || (y >= 46 && y < 96 && tw <= 30) || (y >= 6 && y < 46 && tw <= (y - 6) * 0.75)) {
        var dx = x - 312, dy = y - 70, d = Math.sqrt(dx * dx + dy * dy);
        if (d <= 20) {
          if (d > 18) return '#6b4a18';
          var m = (Math.atan2(dy, dx) / (Math.PI / 6) + 12) % 1;
          if (d > 14 && (m < 0.12 || m > 0.88)) return 'ink';
          return ramp(['#b87a2e', '#8a5a24', '#6b4214'], d / 18, x, y);
        }
        if ((x === 301 || x === 302 || x === 322 || x === 323) && ((y > 113 && y < 126) || (y > 151 && y < 164))) return 'flame2';
        if ((x >= 300 && x <= 303 || x >= 321 && x <= 324) && ((y > 111 && y < 127) || (y > 149 && y < 165))) return 'flame';
        if (y === 46 || y === 47 || y === 96 || y === 97) return '#1a1320';
        return brickMortar(x, y, 8, 4) ? '#07050a' : (h2(x >> 3, y >> 2, 1) & 1 ? '#0b0810' : '#0e0a14');
      }
      var bi = (x / 13) | 0, bh = 150 + h2(bi, 0, 3) % 40, lx = x % 13;
      var top = h2(bi, 1, 3) % 3 === 0 ? bh - Math.max(0, 6 - Math.abs(lx - 6)) * 3 : bh;
      if (y >= top) {
        var win = (lx === 3 || lx === 4 || lx === 8 || lx === 9) && y % 9 > 1 && y % 9 < 5 && h2(x >> 2, y / 9 | 0, 5) % 7 === 0;
        return win ? '#8a3a14' : '#0f0a15';
      }
      if (y < 120 && h2(x, y, 9) % 900 === 0) return '#8a7f94';
      return ramp(sky, y / H, x, y);
    }), g = c.getContext('2d');
    g.fillStyle = PAL.ink; line(g, 312, 70, 307, 61, 2); line(g, 312, 70, 312, 54); px(g, 'ink', 311, 69, 3, 3);
    return c;
  }
  function animTitle(ctx, t) {
    ctx.drawImage(gearFrame(84, 12, 6, 5, ['#07050a', '#130d1a', '#1c1426'], Math.floor(t)), 36 - 84, 180 - 84);
    light(ctx, PAL.flame, 70, 312, 40, 0.35 + 0.1 * Math.sin(t * 2.3));
    light(ctx, PAL.flame2, 12, 312, 138, 0.2 + 0.15 * Math.sin(t * 7.1));
    flames(ctx, 292, 28, t); flames(ctx, 316, 20, t + 0.3); flames(ctx, 330, 80, t + 0.6); flames(ctx, 282, 132, t + 0.9);
    embers(ctx, t);
  }

  function makeTable() {
    var r = rng(4242), jars = [], JC = ['verdi', 'verdi2', 'acid', 'blood', 'flesh2', 'ice'];
    [[16, 58], [16, 102], [288, 58], [288, 102]].forEach(function (s) {
      for (var jx = s[0] + 3; jx < s[0] + 72;) {
        var jw = 5 + (r() * 5 | 0);
        jars.push([jx, s[1] - 7 - (r() * 8 | 0), jw, s[1], JC[r() * JC.length | 0]]);
        jx += jw + 2 + (r() * 3 | 0);
      }
    });
    return paint(W, H, function (x, y) {
      var i, j;
      if (y >= 148 && y < 164) { // slab top
        var inset = (163 - y) * 1.2;
        if (x >= 60 + inset && x <= 324 - inset) {
          if ((x >= 112 && x <= 116) || (x >= 268 && x <= 272)) return '#4a2418';
          if (y === 148) return '#5b4d6b';
          if ((y === 152 || y === 159) && x > 66 + inset && x < 318 - inset) return '#1c1220';
          if ((x - 200) * (x - 200) + (y - 156) * (y - 156) * 6 < 110) return ramp(['#3a1220', '#34293f'], ((x * 7 + y * 3) % 10) / 10, x, y);
          return ramp(['#3d3149', '#34293f'], (y - 148) / 15, x, y);
        }
      }
      if (y >= 164 && y < 176 && x >= 60 && x <= 324) { // slab front
        if ((x >= 112 && x <= 116) || (x >= 268 && x <= 272)) return y === 168 || y === 169 ? 'brass' : '#3a1c14';
        return y === 164 ? '#2e2439' : y === 175 ? '#120d18' : '#241c2e';
      }
      if (y >= 176 && x >= 150 && x <= 234) return brickMortar(x, y, 12, 6) ? '#0d0a12' : (h2(x / 12 | 0, y / 6 | 0, 2) & 1 ? '#1c1524' : '#211a2b');
      if (y >= 176) return y % 10 === 0 || (x + (y / 10 | 0) * 20) % 40 === 0 ? '#0a070e' : '#0f0b14';
      for (i = 0; i < 2; i++) { // candle stands and candles
        var cx = i ? 344 : 40, adx = Math.abs(x - cx);
        if (y >= 172 && adx <= 5) return y === 172 ? 'brass' : '#6b4a18';
        if (y >= 120 && adx <= 1) return '#2a1c10';
        if (y >= 110 && y < 120 && adx <= 1) return x === cx - 1 ? 'bone' : 'parch';
      }
      if (x === 192 && y < 13) return y & 1 ? '#4a4454' : 'ink'; // alchemical lamp
      if (y >= 13 && y <= 26 && x >= 186 && x <= 198) return y === 13 || y === 26 || x === 186 || x === 198 ? 'brass' : (x + y) % 5 ? 'verdi' : 'verdi2';
      for (j = 0; j < jars.length; j++) {
        var q = jars[j];
        if (x >= q[0] && x < q[0] + q[2] && y >= q[1] && y < q[3]) {
          if (y === q[1]) return '#6b4a18';
          if (x === q[0] || x === q[0] + q[2] - 1) return '#5b4d6b';
          if (x === q[0] + 1) return '#8a7f94';
          return y > q[1] + (q[3] - q[1]) * 0.4 ? q[4] : '#1a1424';
        }
      }
      if (((y >= 58 && y <= 60) || (y >= 102 && y <= 104)) && ((x >= 16 && x <= 96) || (x >= 288 && x <= 368))) return y === 58 || y === 102 ? '#5a3a24' : '#3a2418';
      return brickMortar(x, y, 16, 8) ? '#08060c' : ramp(['#0e0a14', '#151019', '#1c1524'], y / 160, x, y);
    });
  }
  function animTable(ctx, t) {
    candle(ctx, 40, 106, t, 0); candle(ctx, 344, 106, t, 1);
    light(ctx, PAL.verdi2, 60, 192, 22, 0.25 + 0.08 * Math.sin(t * 1.3));
    light(ctx, PAL.verdi, 90, 192, 150, 0.12 + 0.04 * Math.sin(t * 0.9));
  }

  var ARCH_GLOW = [['#0d0a12', '#10201f', '#1d3d36', '#2f7d6d'], ['#0d0a12', '#221a10', '#3d2c12', '#7a5a22'], ['#0d0a12', '#2a0e10', '#5a1a14', '#a4401c']];
  var ARCH_GEAR = [['#0f1f1c', '#1d3d36', '#2f5d52'], ['#2a1c0c', '#4a3414', '#6b4a18'], ['#2a0e0c', '#4a1a12', '#6b2a18']];
  var ARCH_LIGHT = ['verdi2', 'brass2', 'flame'];
  var FLOOR_BANDS = [152, 158, 166, 177, 192, 217];
  function makeCombat(fl) {
    var gl = ARCH_GLOW[fl];
    return paint(W, H, function (x, y) {
      var i;
      if (y >= 133 && y <= 141 && x % 64 < 3) return y === 133 ? 'brass2' : 'brass'; // pipe flanges
      if (y >= 134 && y <= 140) return ['rust', '#d07a48', 'copper', 'copper', 'copper', 'rust', 'ink'][y - 134];
      if (y >= 150) { // perspective flagstones
        if (y < 152) return 'ink';
        for (i = 0; FLOOR_BANDS[i + 1] <= y; i++);
        var bw = 20 + i * 14;
        if (y === FLOOR_BANDS[i] || (x + i * 9) % bw === 0) return '#120d19';
        return h2((x + i * 9) / bw | 0, i, fl) % 5 === 0 ? '#1f1829' : ramp(['#1a1424', '#241c2e', '#2b2236'], (y - 150) / 66, x, y);
      }
      if (y < 133 && (x >= 124 && x <= 128 || x >= 256 && x <= 260)) { // vertical pipes on the pillars
        if (y % 40 < 3) return 'brass';
        return ['rust', 'copper', '#d07a48', 'copper', 'rust'][(x - 124) % 132];
      }
      for (i = 0; i < 3; i++) {
        var cx = 64 + i * 128;
        if (inArch(x, y, cx, 44, 84, 150)) {
          var dx = (x - cx) * 1.1, dy = 150 - y, f = 1 - Math.sqrt(dx * dx + dy * dy) / 125;
          var mortar = y % 5 === 4 || (x + ((y / 5 | 0) & 1) * 5) % 10 === 9;
          return ramp(gl, mortar ? f - 0.2 : f, x, y);
        }
        if (inArch(x, y, cx, 45, 84, 150)) return '#1a1424';
        if (inArch(x, y, cx, 47, 84, 150)) return x < cx ? '#54466a' : '#3d3149';
      }
      if (brickMortar(x, y, 16, 8)) return '#120d19';
      if (y < 40 && (y / 40) * 16 < BAYER[(y & 3) * 4 + (x & 3)]) return '#120d19';
      return ['#241c2e', '#2b2236', '#221a2b'][h2((x + ((y >> 3) & 1) * 8) >> 4, y >> 3, 4) % 3];
    });
  }
  function animCombat(ctx, t, fl) {
    ctx.drawImage(gearFrame(36, 12, 6, 10, ARCH_GEAR[fl], Math.floor(t * 2)), 192 - 36, 96 - 36);
    var lc = PAL[ARCH_LIGHT[fl]];
    light(ctx, lc, 110, 192, 200, 0.16 + 0.06 * Math.sin(t * 2.1));
    light(ctx, lc, 50, 64, 140, 0.12 + 0.05 * Math.sin(t * 3.3));
    light(ctx, lc, 50, 320, 140, 0.12 + 0.05 * Math.sin(t * 2.7 + 1));
    if (fl === 2) { flames(ctx, 48, 118, t); flames(ctx, 72, 118, t + 0.4); flames(ctx, 304, 118, t + 0.2); flames(ctx, 328, 118, t + 0.6); }
  }

  function makeCodex() {
    return paint(W, H, function (x, y) {
      if (x < 6 || y < 6 || x > 377 || y > 209) return ramp(['#0c080c', '#120c10'], y / H, x, y);
      var page = y >= 12 && y <= 203 && ((x >= 14 && x <= 189) || (x >= 194 && x <= 369));
      if (!page) { // leather cover with brass corners
        if ((x < 22 || x > 361) && (y < 22 || y > 193) && (x < 9 || x > 374 || y < 9 || y > 206)) return 'brass';
        return ramp(['#2e1616', '#3a1c1a'], ((x * 3 + y * 5) % 17) / 17, x, y);
      }
      if (y >= 200) return y & 1 ? '#4a3f30' : '#2c241b';
      var gx = Math.abs(x - 191.5), lx = x < 192 ? x - 14 : x - 194;
      if (y % 10 === 0 && lx > 12 && lx < 164 && h2(lx >> 3, y, x < 192 ? 1 : 2) % 4) return '#3e3426';
      var sd = Math.sqrt((x - 102) * (x - 102) + (y - 96) * (y - 96));
      if (Math.abs(sd - 34) < 0.6 || (x === 102 && Math.abs(y - 96) < 44) || (y === 96 && Math.abs(x - 102) < 44)) return '#43382a';
      return ramp(['#1e1812', '#2c241b', '#352c21'], gx / 60, x, y);
    });
  }

  function makeDeath() {
    return paint(W, H, function (x, y) {
      var hs = h2(x >> 1, 0, 11);
      if (hs % 9 === 0 && y < 10 + hs % 40 && (x & 1) === 0) return y < 6 + hs % 30 ? 'blood' : '#5a1220';
      if (y > 196 + 8 * Math.sin(x * 0.07) + 4 * Math.sin(x * 0.23)) return '#140407';
      return ramp(['#0a0306', '#1c050b', '#2e0810', '#4a0e16'], y / H, x, y);
    });
  }
  function animDeath(ctx, t) {
    light(ctx, PAL.blood, 140, 192, 108, 0.1 + 0.2 * Math.pow(Math.abs(Math.sin(t * 2.2)), 8));
    for (var i = 0; i < 8; i++) {
      var dx = 24 + i * 47 + (i * 13) % 17, yy = Math.round(((t * (30 + i * 7) + i * 61) % 260) - 30);
      px(ctx, 'blood', dx, yy - 4, 1, 4); px(ctx, 'blood2', dx, yy, 2, 2);
    }
  }

  function makeTimeout() {
    var c = paint(W, H, function (x, y) {
      var dx = x - 192, dy = y - 100, d = Math.sqrt(dx * dx + dy * dy);
      if (d <= 66) {
        if (d > 61) return dx + dy < 0 ? '#6a5428' : '#4a3a1e';
        if (d > 59) return '#2a2016';
        var a = Math.atan2(dy, dx), m = (a / (Math.PI / 6) + 12) % 1, near = Math.min(m, 1 - m) * (Math.PI / 6) * d;
        var bold = Math.round(a / (Math.PI / 6)) % 3 === 0;
        if (d < 57 && d > (bold ? 44 : 49) && near < (bold ? 1.6 : 0.8)) return '#8a8070';
        return ramp(['#24212f', '#1c1a26', '#16141e'], d / 60, x, y);
      }
      if (x >= 191 && x <= 192 && y > 166 && y < 196) return '#4a3a1e'; // stuck pendulum
      if ((x - 191.5) * (x - 191.5) + (y - 202) * (y - 202) < 42) return x < 191 ? '#6a5428' : '#4a3a1e';
      return ramp(['#060509', '#0f0d17', '#17141f'], y / H, x, y);
    }), g = c.getContext('2d');
    text(g, 'XII', 192, 53, '#8a8070', 1, 'center'); text(g, 'VI', 192, 134, '#8a8070', 1, 'center');
    text(g, 'III', 238, 97, '#8a8070', 1, 'right'); text(g, 'IX', 146, 97, '#8a8070', 1);
    g.fillStyle = '#8a8070'; line(g, 192, 100, 192, 64, 2); line(g, 191, 100, 191, 128, 3);
    px(g, '#6a5428', 189, 97, 7, 7); px(g, 'ink', 191, 99, 3, 3);
    g.fillStyle = '#3a3648'; line(g, 150, 60, 172, 84); line(g, 172, 84, 166, 110); line(g, 172, 84, 200, 90);
    return c;
  }
  function animTimeout(ctx, t) { // the second hand twitches but never advances
    var a = -Math.PI / 2 + 0.4 * Math.PI + ((t | 0) & 1 ? 0.05 : 0);
    ctx.fillStyle = PAL.blood2;
    line(ctx, 192, 100, 192 + Math.cos(a) * 54, 100 + Math.sin(a) * 54);
  }

  function makeWin() {
    return paint(W, H, function (x, y) {
      var adx = Math.abs(x - 192);
      if (inArch(x, y, 192, 34, 90, 172)) { // dawn seen through the open door
        var hill = 140 + 4 * Math.sin(x * 0.15) + 3 * Math.sin(x * 0.37);
        if (y >= hill) return ramp(['#b86a4a', '#6a3a2e'], (y - 140) / 32, x, y);
        var sd = (x - 192) * (x - 192) + (y - 139) * (y - 139);
        if (sd < 81) return sd < 36 ? '#fffbe8' : 'glow';
        return ramp(['#3a4a7a', '#8a6a8a', '#e0906a', '#ffd28a', '#fff1c8'], (y - 30) / 110, x, y);
      }
      if (inArch(x, y, 192, 39, 90, 172)) return x < 192 ? '#6a5a70' : '#4a3e56';
      var k = (152 - x) / 34, kr = (x - 232) / 34, lk = k >= 0 && k <= 1 ? k : kr >= 0 && kr <= 1 ? kr : -1;
      if (lk >= 0 && y >= 70 - lk * 16 && y <= 172 + lk * 12) { // open door leaves
        var ry = (y - (70 - lk * 16)) / (102 + lk * 28);
        if (Math.abs(ry - 0.25) < 0.02 || Math.abs(ry - 0.75) < 0.02) return 'brass';
        return lk > 0.9 ? '#1a1620' : ((x >> 2) & 1 ? '#2a2432' : '#322b3c');
      }
      if (y >= 172) {
        var hw = 34 + (y - 172) * 2.2;
        if (adx < hw) return ramp(['#e0a060', '#8a5a3a', '#4a3028', '#1a1218'], (y - 172) / 60 + adx / hw * 0.6, x, y);
        return y % 11 === 0 ? '#07050a' : '#120d14';
      }
      var dd = Math.sqrt(adx * adx + (y - 120) * (y - 120));
      return brickMortar(x, y, 16, 8) ? '#07050a' : ramp(['#0b0810', '#171220', '#2a1e26', '#4a3430'], 1 - dd / 200, x, y);
    });
  }
  function animWin(ctx, t) {
    light(ctx, PAL.flame2, 90, 192, 130, 0.22 + 0.05 * Math.sin(t * 1.2));
    ctx.fillStyle = PAL.glow;
    for (var i = 0; i < 14; i++) {
      var k = (t * 0.05 + i * 0.071) % 1;
      ctx.globalAlpha = 0.6 * Math.sin(k * Math.PI);
      ctx.fillRect(Math.round(150 + (i * 53) % 84 + Math.sin(t * 0.7 + i) * 6), Math.round(190 - k * 120), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function noop() {}
  var BG = {
    title: [makeTitle, animTitle], table: [makeTable, animTable], combat: [makeCombat, animCombat], codex: [makeCodex, noop],
    end_death: [makeDeath, animDeath], end_timeout: [makeTimeout, animTimeout], end_win: [makeWin, animWin]
  };
  var bgCache = {};
  function drawBackground(ctx, name, t, opts) {
    var bg = BG[name], fl = Math.max(0, Math.min(2, (opts && opts.floor) | 0)), key = name === 'combat' ? name + fl : name;
    if (!bg) { ctx.fillStyle = PAL.ink; ctx.fillRect(0, 0, W, H); return; }
    ctx.drawImage(bgCache[key] || (bgCache[key] = bg[0](fl)), 0, 0);
    bg[1](ctx, t || 0, fl);
  }

  // ---------- logo and fx ----------
  var silCache = new WeakMap();
  function silhouetteOf(canvas, color) {
    var c = col(color || '#ffffff'), m = silCache.get(canvas);
    if (!m) { m = {}; silCache.set(canvas, m); }
    if (!m[c]) {
      var s = mk(canvas.width, canvas.height), g = s.getContext('2d');
      g.drawImage(canvas, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = c; g.fillRect(0, 0, s.width, s.height);
      m[c] = s;
    }
    return m[c];
  }

  var LOGO_TITLE = 'DEADLOCK DECK', LOGO_SUB = 'EL RELOJ ANATÓMICO', LOGO_GEAR = ['#4a3414', 'brass', 'brass2'], logoC = null;
  function makeLogo() { // brass gradient letters with an ink outline and a blood drop shadow, at scale 1
    var w = textWidth(LOGO_TITLE, 1), base = mk(w, 7), g = base.getContext('2d');
    text(g, LOGO_TITLE, 0, 0, 'brass2', 1);
    g.globalCompositeOperation = 'source-atop';
    ['glow', '#ffe07a', 'brass2', 'brass2', 'brass', 'brass', 'copper'].forEach(function (c, i) { px(g, c, 0, i, w, 1); });
    var out = mk(w + 2, 10), o = out.getContext('2d'), ink = silhouetteOf(base, PAL.ink);
    o.drawImage(silhouetteOf(base, PAL.blood), 1, 3);
    for (var dy = 0; dy < 3; dy++) for (var dx = 0; dx < 3; dx++) o.drawImage(ink, dx, dy);
    o.drawImage(base, 1, 1);
    return out;
  }
  function drawLogo(ctx, cx, y, t) {
    t = t || 0;
    logoC = logoC || makeLogo();
    var s = 4, w = logoC.width * s, sy = Math.round(y + 46), half = Math.round(textWidth(LOGO_SUB, 2) / 2), f = Math.floor(t * 6);
    light(ctx, PAL.flame, 90, cx, y + 18, 0.16 + 0.05 * Math.sin(t * 2));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(logoC, Math.round(cx - w / 2), Math.round(y), w, logoC.height * s);
    ctx.drawImage(gearFrame(8, 8, 4, 8, LOGO_GEAR, f), Math.round(cx - half - 24), sy - 1);
    ctx.drawImage(gearFrame(8, 8, 4, 8, LOGO_GEAR, -f), Math.round(cx + half + 7), sy - 1);
    text(ctx, LOGO_SUB, cx, sy, 'parch', 2, 'center', 'ink');
  }

  function embers(ctx, t) {
    t = t || 0;
    for (var i = 0; i < 28; i++) {
      var y = H + 8 - ((t * (10 + (i * 37) % 23) + i * 53) % (H + 24));
      var x = ((((i * 97 + 13) % W + Math.sin(t * 1.3 + i) * 6 + (H - y) * 0.08) % W) + W) % W;
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 6 + i * 2.1);
      ctx.fillStyle = i % 3 ? PAL.flame : PAL.flame2;
      ctx.fillRect(x | 0, y | 0, i % 5 ? 1 : 2, i % 5 ? 1 : 2);
    }
    ctx.globalAlpha = 1;
  }

  var vignetteC = null;
  function vignette(ctx) {
    if (!vignetteC) {
      vignetteC = mk(W, H);
      var g = vignetteC.getContext('2d'), gr = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
      gr.addColorStop(0, 'rgba(13,10,18,0)');
      gr.addColorStop(1, 'rgba(13,10,18,0.75)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    ctx.drawImage(vignetteC, 0, 0);
  }

  window.DD.Art = {
    W: W, H: H, TILE: TILE, PAL: PAL,
    text: text, textWidth: textWidth, wrap: wrap,
    ICONS: ICONS, icon: icon,
    tile: tile, item: item, trap: trap, fire: fire,
    drawBackground: drawBackground, drawLogo: drawLogo, embers: embers, vignette: vignette, silhouetteOf: silhouetteOf
  };
})();
