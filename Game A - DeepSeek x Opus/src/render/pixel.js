/* The only drawing API in the game.
 * Sprite data (DD.Sprites / DD.Avatar) is rasterised into small offscreen
 * canvases on first use, then blitted. Bitmap font lives in DD.Font. */
(function () {
  'use strict';
  var DD = window.DD;

  var images = {};        // cacheKey -> canvas
  var missing = {};       // keys already reported, so we warn once
  var fontAtlases = {};   // color -> {canvas, index:{char:{x}}}
  var glyphList = null;

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0);
    c.height = Math.max(1, h | 0);
    return c;
  }

  function rgbOf(c) { return DD.hexToRgb(c); }

  /* Rasterise one {w,h,pal,rows} definition. paletteOverride replaces channels 1..3. */
  function raster(def, paletteOverride) {
    var w = def.w | 0, h = def.h | 0;
    var rows = def.rows || [];
    var pal = def.pal || [];
    var src = [];
    var i;
    for (i = 0; i < 6; i++) src[i] = pal[i] || '#ff00ff';
    if (paletteOverride && paletteOverride.length >= 3) {
      src[1] = paletteOverride[0] || src[1];
      src[2] = paletteOverride[1] || src[2];
      src[3] = paletteOverride[2] || src[3];
    }
    var rgb = [];
    for (i = 0; i < 6; i++) rgb[i] = rgbOf(src[i]);

    var cv = makeCanvas(w, h);
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(w, h);
    var d = img.data;

    for (var y = 0; y < h; y++) {
      var row = rows[y] || '';
      for (var x = 0; x < w; x++) {
        var ch = row.charAt(x);
        if (ch === '' || ch === '.' || ch === ' ') continue;
        var n = ch.charCodeAt(0) - 48;
        if (n < 0 || n > 5) continue;
        var c = rgb[n];
        var o = (y * w + x) * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  function defOf(key) {
    if (DD.Sprites && DD.Sprites[key]) return DD.Sprites[key];
    if (DD.Avatar && DD.Avatar[key]) return DD.Avatar[key];
    return null;
  }

  function tintCanvas(src, color, amount) {
    var cv = makeCanvas(src.width, src.height);
    var c = cv.getContext('2d');
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    c.globalAlpha = DD.clamp(amount, 0, 1);
    c.fillStyle = color;
    c.fillRect(0, 0, cv.width, cv.height);
    return cv;
  }

  function flipCanvas(src) {
    var cv = makeCanvas(src.width, src.height);
    var c = cv.getContext('2d');
    c.translate(src.width, 0);
    c.scale(-1, 1);
    c.drawImage(src, 0, 0);
    return cv;
  }

  function getImage(key, opts) {
    opts = opts || {};
    var palette = opts.palette && opts.palette.length >= 3 ? opts.palette.join(',') : '';
    var flip = opts.flip ? 1 : 0;
    var flash = opts.flash ? Math.round(DD.clamp(opts.flash, 0, 1) * 4) / 4 : 0;
    var ck = key + '|' + palette + '|' + flip + '|' + flash;
    if (images[ck]) return images[ck];

    var def = defOf(key);
    if (!def) {
      if (!missing[key]) { missing[key] = 1; console.warn('DD.Pixel: unknown sprite "' + key + '"'); }
      return null;
    }
    var cv = raster(def, opts.palette);
    if (flip) cv = flipCanvas(cv);
    if (flash > 0) cv = tintCanvas(cv, '#ffffff', flash);
    images[ck] = cv;
    return cv;
  }

  /* ---------------------------------------------------------------- atlas */
  function buildFontAtlas(color) {
    if (fontAtlases[color]) return fontAtlases[color];
    var chars = [];
    var ch;
    if (DD.Font) { for (ch in DD.Font) chars.push(ch); }
    chars.sort();
    var cellW = 6, cellH = 8;
    var cv = makeCanvas(Math.max(1, chars.length * cellW), cellH);
    var c = cv.getContext('2d');
    var index = {};
    var rgb = rgbOf(color);
    c.fillStyle = color;
    for (var i = 0; i < chars.length; i++) {
      var g = DD.Font[chars[i]];
      if (!g || !g.length) continue;
      index[chars[i]] = i * cellW;
      var top = cellH - g.length;               // bottom-aligned inside the cell
      for (var y = 0; y < g.length; y++) {
        var row = g[y] || '';
        for (var x = 0; x < 5; x++) {
          if (row.charAt(x) === '#') c.fillRect(i * cellW + x, top + y, 1, 1);
        }
      }
    }
    fontAtlases[color] = { canvas: cv, index: index, cellW: cellW, cellH: cellH, rgb: rgb };
    return fontAtlases[color];
  }

  function glyphKeys() {
    if (glyphList) return glyphList;
    glyphList = [];
    if (DD.Font) { for (var k in DD.Font) glyphList.push(k); }
    return glyphList;
  }

  /* ---------------------------------------------------------------- API */
  var Pixel = DD.Pixel = {
    build: function () {
      var keys = [], k;
      if (DD.Sprites) for (k in DD.Sprites) keys.push(k);
      if (DD.Avatar) for (k in DD.Avatar) keys.push(k);
      for (var i = 0; i < keys.length; i++) getImage(keys[i], null);
      return keys.length;
    },

    hasSprite: function (key) { return !!defOf(key); },

    sprite: function (key, x, y, opts) {
      opts = opts || {};
      var cv = getImage(key, opts);
      var scale = opts.scale || 1;
      if (!cv) {
        var C = DD.Canvas.ctx;
        C.fillStyle = '#ff00ff';
        C.fillRect(x | 0, y | 0, 16 * scale, 16 * scale);
        C.fillStyle = '#300030';
        C.fillRect((x | 0) + scale, (y | 0) + scale, 14 * scale, 14 * scale);
        return;
      }
      var w = cv.width * scale, h = cv.height * scale;
      var dx = x, dy = y;
      if (opts.anchor === 'center') { dx = Math.round(x - w / 2); dy = Math.round(y - h / 2); }
      else if (opts.anchor === 'bottom') { dx = Math.round(x - w / 2); dy = Math.round(y - h); }
      else { dx = Math.round(x); dy = Math.round(y); }

      var C = DD.Canvas.ctx;
      var prev = C.globalAlpha;
      if (opts.alpha !== undefined) C.globalAlpha = DD.clamp(opts.alpha, 0, 1) * prev;
      C.drawImage(cv, dx, dy, w, h);
      C.globalAlpha = prev;
      return { x: dx, y: dy, w: w, h: h };
    },

    spriteSize: function (key, scale) {
      var def = defOf(key);
      scale = scale || 1;
      if (!def) return { w: 16 * scale, h: 16 * scale };
      return { w: def.w * scale, h: def.h * scale };
    },

    rect: function (x, y, w, h, color) {
      var C = DD.Canvas.ctx;
      C.fillStyle = color || '#ffffff';
      C.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    },

    frame: function (x, y, w, h, color) {
      var C = DD.Canvas.ctx;
      C.fillStyle = color || '#ffffff';
      x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
      C.fillRect(x, y, w, 1);
      C.fillRect(x, y + h - 1, w, 1);
      C.fillRect(x, y, 1, h);
      C.fillRect(x + w - 1, y, 1, h);
    },

    dim: function (x, y, w, h, alpha, color) {
      var C = DD.Canvas.ctx;
      var prev = C.globalAlpha;
      C.globalAlpha = DD.clamp(alpha, 0, 1);
      C.fillStyle = color || '#07060a';
      C.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
      C.globalAlpha = prev;
    },

    /* Gothic panel: dark fill, double border, corner studs, optional title. */
    panel: function (x, y, w, h, opts) {
      opts = opts || {};
      x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
      var C = DD.Canvas.ctx;
      var fill = opts.fill || DD.C.panel;
      var border = opts.border || DD.C.line;
      var accent = opts.accent || DD.C.lineHi;
      var pv = C.globalAlpha;
      if (opts.alpha !== undefined) C.globalAlpha = DD.clamp(opts.alpha, 0, 1);

      C.fillStyle = fill;
      C.fillRect(x, y, w, h);

      // inner shading
      C.fillStyle = DD.C.panelLo;
      C.fillRect(x + 1, y + h - 3, w - 2, 2);
      C.fillStyle = DD.C.panelHi;
      C.fillRect(x + 1, y + 1, w - 2, 1);

      Pixel.frame(x, y, w, h, border);
      Pixel.frame(x + 1, y + 1, w - 2, h - 2, DD.mix(border, fill, 0.5));

      // corner studs
      C.fillStyle = accent;
      var corners = [[x + 2, y + 2], [x + w - 4, y + 2], [x + 2, y + h - 4], [x + w - 4, y + h - 4]];
      for (var i = 0; i < corners.length; i++) C.fillRect(corners[i][0], corners[i][1], 2, 2);

      if (opts.title) {
        var sc = opts.titleScale || 1;
        var tw = Pixel.textW(opts.title, sc);
        C.fillStyle = DD.C.panelLo;
        C.fillRect(x + 1, y + 1, w - 2, 8 * sc + 3);
        C.fillStyle = border;
        C.fillRect(x + 1, y + 8 * sc + 3, w - 2, 1);
        Pixel.text(opts.title, x + w / 2, y + 3, {
          scale: sc, color: opts.titleColor || DD.C.text, align: 'center'
        });
      }
      if (opts.alpha !== undefined) C.globalAlpha = pv;
    },

    bar: function (x, y, w, h, frac, opts) {
      opts = opts || {};
      x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
      var C = DD.Canvas.ctx;
      var bg = opts.bg || '#1a1424';
      var fg = opts.fg || DD.C.hp;
      frac = DD.clamp(frac || 0, 0, 1);

      C.fillStyle = bg;
      C.fillRect(x, y, w, h);

      if (h >= 5) {
        C.fillStyle = DD.shade(bg, -0.3);
        C.fillRect(x, y + h - 2, w, 2);
      }
      var fw = Math.round(w * frac);
      if (fw > 0) {
        C.fillStyle = fg;
        if (opts.vertical) C.fillRect(x, y + h - Math.round(h * frac), w, Math.round(h * frac));
        else C.fillRect(x, y, fw, h);
        if (!opts.vertical && h >= 3) {
          C.fillStyle = DD.shade(fg, 0.35);
          C.fillRect(x, y, fw, 1);
        }
      }
      if (opts.border !== false) Pixel.frame(x, y, w, h, opts.borderColor || DD.C.ink);
      if (opts.ghost !== undefined && opts.ghost > frac) {
        C.fillStyle = opts.ghostColor || '#ffffff';
        var gw = Math.round(w * DD.clamp(opts.ghost, 0, 1));
        C.globalAlpha = 0.35;
        C.fillRect(x, y, gw, h);
        C.globalAlpha = 1;
      }
    },

    wrap: function (str, maxW, scale) {
      scale = scale || 1;
      var maxChars = Math.max(1, Math.floor((maxW + scale) / (6 * scale)));
      var lines = [];
      var raw = String(str == null ? '' : str).split('\n');
      for (var i = 0; i < raw.length; i++) {
        var words = raw[i].split(' ');
        var line = '';
        for (var j = 0; j < words.length; j++) {
          var w = words[j];
          if (!line.length) { line = w; }
          else if (line.length + 1 + w.length <= maxChars) { line += ' ' + w; }
          else { lines.push(line); line = w; }
          while (line.length > maxChars) { lines.push(line.substring(0, maxChars)); line = line.substring(maxChars); }
        }
        lines.push(line);
      }
      return lines;
    },

    textW: function (str, scale) {
      scale = scale || 1;
      var n = String(str == null ? '' : str).length;
      return n <= 0 ? 0 : (n * 6 - 1) * scale;
    },

    text: function (str, x, y, opts) {
      opts = opts || {};
      var scale = opts.scale || 1;
      var color = opts.color || DD.C.text;
      var atlas = buildFontAtlas(color);
      var lineH = (opts.lineH || 8) * scale;
      var raw = String(str == null ? '' : str);
      var lines = opts.wrap ? Pixel.wrap(raw, opts.wrap, scale) : raw.split('\n');
      var C = DD.Canvas.ctx;
      var idx = atlas.index;
      var prev = C.globalAlpha;
      if (opts.alpha !== undefined) C.globalAlpha = DD.clamp(opts.alpha, 0, 1) * prev;

      for (var li = 0; li < lines.length; li++) {
        var line = lines[li];
        var tw = Pixel.textW(line, scale);
        var lx = x;
        if (opts.align === 'center') lx = Math.round(x - tw / 2);
        else if (opts.align === 'right') lx = Math.round(x - tw);
        else lx = Math.round(x);
        var ly = Math.round(y + li * lineH);

        if (opts.shadow !== false) {
          var sh = buildFontAtlas(opts.shadowColor || '#08060d');
          drawGlyphs(C, sh, line, lx + scale, ly + scale, scale, idx);
        }
        drawGlyphs(C, atlas, line, lx, ly, scale, idx);
      }
      C.globalAlpha = prev;
    },

    clipPush: function (x, y, w, h) {
      var C = DD.Canvas.ctx;
      C.save();
      C.beginPath();
      C.rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
      C.clip();
    },

    clipPop: function () {
      DD.Canvas.ctx.restore();
    },

    /* Screen shake, in virtual pixels. */
    shake: function (t, amount) {
      if (amount <= 0) return { x: 0, y: 0 };
      return {
        x: Math.round(Math.sin(t * 47.3) * amount),
        y: Math.round(Math.cos(t * 61.7) * amount)
      };
    }
  };

  function drawGlyphs(C, atlas, line, lx, ly, scale, idx) {
    var cw = atlas.cellW, chh = atlas.cellH;
    // The cell's bottom row is the baseline; a 7-row glyph sits on rows 1..7.
    var dy = ly - scale;
    for (var i = 0; i < line.length; i++) {
      var gx = atlas.index[line.charAt(i)];
      if (gx === undefined) gx = atlas.index['?'];
      if (gx === undefined) continue;
      C.drawImage(atlas.canvas, gx, 0, cw, chh, lx + i * 6 * scale, dy, cw * scale, chh * scale);
    }
  }
})();
