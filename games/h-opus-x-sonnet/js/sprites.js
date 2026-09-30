/* Deadlock Deck: El Reloj Anatomico - sprites.js (W4)
 * All art is procedural pixel art: string pixel maps and painter primitives are rendered once
 * to offscreen canvases, cached, and blitted with imageSmoothingEnabled=false at integer scales.
 * Data (DD.LIMBS, DD.COSMETICS, DD.ENEMIES) is looked up lazily at draw time. */
(function () {
  'use strict';
  window.DD = window.DD || {};
  const DD = window.DD;

  // ---------------------------------------------------------------- utilities
  function mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d', { willReadFrequently: true }); // sprite canvases are read back (outline/dissolve)
    return c;
  }

  // Deterministic integer hash -> [0,1)
  function hash(x, y, s) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ---- colour helpers (hex strings only; anything unparsable becomes mid grey)
  const rgbCache = {};
  function rgb(h) {
    if (rgbCache[h]) return rgbCache[h];
    let s = String(h || '').replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const n = parseInt(s, 16);
    const v = (s.length === 6 && !isNaN(n)) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [128, 128, 128];
    rgbCache[h] = v;
    return v;
  }
  function toHex(r, g, b) {
    const f = function (v) {
      v = Math.max(0, Math.min(255, Math.round(v)));
      return (v < 16 ? '0' : '') + v.toString(16);
    };
    return '#' + f(r) + f(g) + f(b);
  }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  function shade(c, f) { return f >= 0 ? mix(c, '#ffffff', f) : mix(c, '#000000', -f); }
  const pal4Cache = {};
  // 4-tone ramp [dark, mid, light, highlight] from one base colour
  function pal4(base) {
    if (Array.isArray(base)) return base;
    if (!pal4Cache[base]) pal4Cache[base] = [shade(base, -0.42), base, shade(base, 0.26), shade(base, 0.52)];
    return pal4Cache[base];
  }

  // ---- canvas helpers
  function fromMap(rows, pal) {
    const h = rows.length;
    let w = 0;
    for (let i = 0; i < h; i++) w = Math.max(w, rows[i].length);
    const c = mkCanvas(w, h), g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const col = pal[rows[y][x]];
        if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
      }
    }
    return c;
  }

  // Draws (nearest neighbour) an offscreen image; never throws on bad input.
  function blit(ctx, img, x, y, sc) {
    if (!img) return;
    sc = sc || 1;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(x), Math.round(y), img.width * sc, img.height * sc);
    ctx.imageSmoothingEnabled = prev;
  }

  // Adds a 1px outline around opaque pixels (into transparent neighbours).
  function outline(c, col) {
    const g = c.getContext('2d'), w = c.width, h = c.height;
    const id = g.getImageData(0, 0, w, h), d = id.data, C = rgb(col), add = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] >= 128) continue;
        if ((x > 0 && d[i - 1] >= 128) || (x < w - 1 && d[i + 7] >= 128) ||
            (y > 0 && d[i - w * 4 + 3] >= 128) || (y < h - 1 && d[i + w * 4 + 3] >= 128)) add.push(i);
      }
    }
    for (let k = 0; k < add.length; k++) {
      const i = add[k];
      d[i] = C[0]; d[i + 1] = C[1]; d[i + 2] = C[2]; d[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
  }

  // ---- painter: small pixel-art drawing toolkit around a canvas
  function painter(c) {
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const P = {
      c: c, g: g,
      px: function (x, y, col) { g.fillStyle = col; g.fillRect(Math.floor(x), Math.floor(y), 1, 1); },
      r: function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h)); },
      line: function (x0, y0, x1, y1, col, th) {
        th = th || 1;
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        g.fillStyle = col;
        for (let n = 0; n < 500; n++) {
          g.fillRect(x0, y0, th, th);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      },
      // flat filled ellipse
      e: function (cx, cy, rx, ry, col) {
        g.fillStyle = col;
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
          for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
            if (nx * nx + ny * ny <= 1) g.fillRect(x, y, 1, 1);
          }
        }
      },
      // shaded ellipse (light from the top-left), pal = hex or 4-tone array
      ball: function (cx, cy, rx, ry, pal, clip) {
        pal = pal4(pal);
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
          for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
            if (nx * nx + ny * ny > 1) continue;
            if (clip && (x < clip[0] || y < clip[1] || x >= clip[2] || y >= clip[3])) continue;
            const l = -0.55 * nx - 0.75 * ny + (((x + y) & 1) ? 0.07 : -0.07);
            g.fillStyle = l > 0.72 ? pal[3] : l > 0.15 ? pal[2] : l > -0.5 ? pal[1] : pal[0];
            g.fillRect(x, y, 1, 1);
          }
        }
      },
      // bevelled rectangle
      box: function (x, y, w, h, pal, rivets) {
        pal = pal4(pal);
        g.fillStyle = pal[1]; g.fillRect(x, y, w, h);
        g.fillStyle = pal[2]; g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, h);
        g.fillStyle = pal[0]; g.fillRect(x, y + h - 1, w, 1); g.fillRect(x + w - 1, y, 1, h);
        if (rivets && w > 5 && h > 5) {
          P.px(x + 2, y + 2, pal[3]); P.px(x + w - 3, y + 2, pal[3]);
          P.px(x + 2, y + h - 3, pal[3]); P.px(x + w - 3, y + h - 3, pal[3]);
        }
      },
      // toothed wheel
      gear: function (cx, cy, ro, ri, teeth, hole, pal, rot) {
        pal = pal4(pal);
        for (let y = Math.floor(cy - ro - 1); y <= Math.ceil(cy + ro + 1); y++) {
          for (let x = Math.floor(cx - ro - 1); x <= Math.ceil(cx + ro + 1); x++) {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy);
            if (d > ro + 0.4) continue;
            if (d > ri && Math.cos((Math.atan2(dy, dx) + (rot || 0)) * teeth) <= 0) continue;
            let col;
            if (d < hole) col = pal[0];
            else {
              const l = -(dx * 0.55 + dy * 0.75) / ro;
              col = l > 0.45 ? pal[3] : l > 0.0 ? pal[2] : l > -0.5 ? pal[1] : pal[0];
            }
            g.fillStyle = col; g.fillRect(x, y, 1, 1);
          }
        }
      },
      atop: function (fn) {
        g.globalCompositeOperation = 'source-atop';
        fn(P);
        g.globalCompositeOperation = 'source-over';
      }
    };
    return P;
  }

  function newPainter(w, h) { return painter(mkCanvas(w, h)); }

  // ================================================================= TILES (16x16)
  const TILES = {};
  function defTile(name, frames, rate, paint) {
    TILES[name] = { n: frames, rate: rate, paint: paint, frames: null };
  }
  function tileDef(name) {
    const d = TILES[name] || TILES.floor;
    if (!d.frames) {
      d.frames = [];
      for (let f = 0; f < d.n; f++) {
        const p = newPainter(16, 16);
        d.paint(p, f);
        d.frames.push(p.c);
      }
    }
    return d;
  }

  function floorBase(p, dark) {
    const base = dark ? '#1a1520' : '#231d2c', hi = dark ? '#211b2a' : '#2e2639', mortar = dark ? '#0f0b14' : '#141019';
    p.r(0, 0, 16, 16, base);
    for (let row = 0; row < 2; row++) {
      const oy = row * 8, off = row ? 5 : 0;
      p.r(0, oy + 1, 16, 1, hi);
      p.r(0, oy, 16, 1, mortar);
      p.r(off % 16, oy, 1, 8, mortar);
      p.r((off + 8) % 16, oy, 1, 8, mortar);
      p.r((off + 1) % 16, oy + 1, 1, 6, hi);
      p.r((off + 9) % 16, oy + 1, 1, 6, hi);
    }
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const h = hash(x, y, dark ? 3 : 5);
        if (h < 0.05) p.px(x, y, dark ? '#2a2236' : '#372e45');
        else if (h > 0.94) p.px(x, y, dark ? '#120e18' : '#191320');
      }
    }
  }

  function shadowDot(p, cx, cy, rx, ry) { p.e(cx, cy, rx, ry, 'rgba(0,0,0,0.35)'); }

  defTile('floor', 1, 1, function (p) {
    floorBase(p, false);
    p.line(3, 11, 6, 13, '#141019');
    p.px(7, 13, '#141019');
  });

  defTile('wall', 1, 1, function (p) {
    const tones = ['#3a3046', '#41364e', '#352c40', '#453a53'];
    p.r(0, 0, 16, 16, '#17121e');
    // top face (lighter cap) then brick face
    p.r(0, 0, 16, 3, '#5e5070');
    p.r(0, 0, 16, 1, '#7a6a8c');
    for (let row = 0; row < 3; row++) {
      const oy = 4 + row * 4, off = row % 2 ? 4 : 0;
      for (let b = -1; b < 3; b++) {
        const bx = off + b * 8;
        const x0 = Math.max(0, bx + 1), x1 = Math.min(16, bx + 8);
        if (x1 <= x0) continue;
        p.r(x0, oy, x1 - x0, 3, tones[Math.floor(hash(b + 4, row, 2) * 4)]);
        p.r(x0, oy, x1 - x0, 1, '#544763');
      }
    }
    p.r(0, 15, 16, 1, '#0d0a12');
    p.px(11, 9, '#3fa38a'); p.px(3, 13, '#2c6a5a');
  });

  function shiftFrame(p, open) {
    if (!open) {
      p.r(0, 0, 16, 16, '#3d2a0c');
      p.box(0, 0, 16, 16, ['#3d2a0c', '#7a5a1e', '#c89b3c', '#f0d080']);
      // inset panel
      p.r(2, 2, 12, 12, '#6b4e1c');
      p.r(2, 2, 12, 1, '#a07a2c'); p.r(2, 2, 1, 12, '#a07a2c');
      p.r(2, 13, 12, 1, '#3d2a0c'); p.r(13, 2, 1, 12, '#3d2a0c');
      p.gear(8, 8, 4.4, 3, 6, 1.4, ['#2c1e08', '#8a6a24', '#c89b3c', '#f0d080'], 0);
      p.px(1, 1, '#f0d080'); p.px(14, 1, '#f0d080'); p.px(1, 14, '#f0d080'); p.px(14, 14, '#f0d080');
    } else {
      floorBase(p, true);
      p.r(0, 0, 16, 2, '#7a5a1e'); p.r(0, 14, 16, 2, '#7a5a1e');
      p.r(0, 0, 16, 1, '#c89b3c'); p.r(0, 14, 16, 1, '#c89b3c');
      p.r(0, 2, 16, 1, '#241a08'); p.r(0, 13, 16, 1, '#241a08');
      for (let x = 2; x < 16; x += 4) { p.px(x, 1, '#f0d080'); p.px(x, 14, '#f0d080'); }
      p.gear(8, 8, 3.2, 2.2, 6, 0.8, ['#0d0a12', '#1a1408', '#2c2210', '#3d2a0c'], 0.3);
    }
  }
  defTile('shiftwall', 1, 1, function (p) { shiftFrame(p, false); });
  defTile('shiftwall_open', 1, 1, function (p) { shiftFrame(p, true); });

  defTile('stairs', 1, 1, function (p) {
    floorBase(p, true);
    p.r(0, 0, 2, 16, '#7a5a1e'); p.r(14, 0, 2, 16, '#7a5a1e');
    p.r(0, 0, 1, 16, '#c89b3c'); p.r(14, 0, 1, 16, '#c89b3c');
    const cols = ['#5a4e68', '#463c52', '#33293f', '#221b2c', '#150f1d'];
    for (let i = 0; i < 5; i++) {
      const y = 1 + i * 3;
      p.r(2, y, 12, 3, cols[i]);
      p.r(2, y, 12, 1, i < 4 ? '#7a6c8a' : '#2a2236');
    }
    // downward chevron in ember
    p.px(6, 6, '#ff7a1a'); p.px(7, 7, '#ff7a1a'); p.px(8, 7, '#ff7a1a'); p.px(9, 6, '#ff7a1a');
    p.px(7, 8, '#ffb830'); p.px(8, 8, '#ffb830');
  });

  function archFrame(p) {
    p.r(0, 0, 16, 16, '#15101c');
    p.r(0, 0, 3, 16, '#4a3f58'); p.r(13, 0, 3, 16, '#3a3046');
    p.r(0, 0, 1, 16, '#6a5c7a');
    p.r(0, 0, 16, 3, '#5e5070'); p.r(0, 0, 16, 1, '#7a6a8c');
    p.px(3, 3, '#3a3046'); p.px(12, 3, '#3a3046');
    p.r(4, 2, 8, 1, '#3a3046');
    // brass keystone + threshold
    p.r(7, 0, 2, 3, '#c89b3c');
    p.r(2, 14, 12, 2, '#7a5a1e'); p.r(2, 14, 12, 1, '#c89b3c');
  }
  defTile('exit', 4, 6, function (p, f) {
    archFrame(p);
    const cols = ['#ffb830', '#ffd868', '#ff9a30', '#ffe89a'];
    p.r(3, 3, 10, 11, cols[f % 4]);
    p.r(4, 4, 8, 9, cols[(f + 1) % 4]);
    p.r(6, 5, 4, 7, '#fff4d0');
    // light rays
    for (let i = 0; i < 4; i++) p.px(4 + ((i * 3 + f * 2) % 8), 4 + ((i * 5 + f) % 9), '#ffffff');
  });
  defTile('exit_locked', 2, 2, function (p, f) {
    archFrame(p);
    p.r(3, 3, 10, 11, '#0d0810');
    for (let x = 4; x < 13; x += 3) {
      p.r(x, 3, 1, 11, '#6c7a89'); p.px(x, 3, '#b8c4d0');
    }
    p.r(3, 6, 10, 1, '#4a5563'); p.r(3, 10, 10, 1, '#4a5563');
    // red padlock
    const lock = f ? '#ff4a3a' : '#c02a2a';
    p.r(6, 8, 4, 4, lock); p.r(6, 8, 4, 1, '#ff8a70');
    p.r(7, 6, 2, 2, '#b8c4d0'); p.px(7, 6, '#ffffff');
    p.px(7, 10, '#1a0808'); p.px(8, 10, '#1a0808');
  });

  defTile('fire', 4, 8, function (p, f) {
    floorBase(p, true);
    p.r(0, 0, 16, 16, 'rgba(120,30,10,0.35)');
    for (let x = 0; x < 16; x++) {
      const hgt = Math.round(4 + 5 * Math.abs(Math.sin(x * 0.85 + f * 1.6)) + 3 * hash(x, f, 9));
      for (let k = 0; k < hgt; k++) {
        const y = 15 - k, r = k / hgt;
        if (r > 0.75 && hash(x, y, f + 20) < 0.5) continue;
        p.px(x, y, r < 0.28 ? '#fff0b0' : r < 0.55 ? '#ffb830' : r < 0.82 ? '#ff7a1a' : '#c8340e');
      }
    }
    for (let i = 0; i < 3; i++) {
      p.px(Math.floor(hash(i, f, 4) * 16), Math.floor(hash(i, f, 5) * 5), '#ffd868');
    }
  });

  defTile('trap_spike', 1, 1, function (p) {
    floorBase(p, false);
    const pts = [[3, 3], [10, 3], [3, 10], [10, 10]];
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i][0], y = pts[i][1];
      p.r(x - 1, y - 1, 5, 5, '#0d0a12');
      p.px(x + 1, y - 2 + 0, '#e8f0f8');
      p.r(x + 1, y - 1, 1, 3, '#b8c4d0');
      p.px(x, y + 1, '#6c7a89'); p.px(x + 2, y + 1, '#4a5563');
      p.px(x + 1, y + 2, '#3a4450');
    }
    p.px(8, 8, '#a3202a');
  });

  defTile('trap_acid', 2, 2, function (p, f) {
    floorBase(p, false);
    p.e(8, 8, 6.5, 5.5, '#12381a');
    p.e(8, 8, 5.5, 4.5, '#2e8a3a');
    p.e(8, 8.5, 4, 3, '#3fa34a');
    const b = f ? [[6, 7], [10, 9], [8, 6]] : [[9, 7], [6, 9], [7, 10]];
    for (let i = 0; i < b.length; i++) { p.px(b[i][0], b[i][1], '#c8ff90'); p.px(b[i][0] + 1, b[i][1], '#7bd35a'); }
    p.px(4, 5, '#7bd35a');
  });

  defTile('trap_steam', 2, 3, function (p, f) {
    floorBase(p, false);
    p.box(3, 4, 10, 9, ['#241a08', '#5a4216', '#a07a2c', '#c89b3c']);
    for (let y = 6; y < 12; y += 2) p.r(4, y, 8, 1, '#0d0a12');
    const w = f ? 1 : 0;
    p.px(5 + w, 3, '#dfeef5'); p.px(8 - w, 2, '#cfe6f0'); p.px(10 + w, 3, '#dfeef5');
    p.px(6 - w, 1, 'rgba(207,230,240,0.7)'); p.px(9 + w, 0, 'rgba(207,230,240,0.6)');
    p.px(7, 4, '#ffffff');
  });

  defTile('trap_spent', 1, 1, function (p) {
    floorBase(p, false);
    const pts = [[3, 3], [10, 3], [3, 10], [10, 10]];
    for (let i = 0; i < pts.length; i++) {
      p.r(pts[i][0], pts[i][1], 3, 3, '#0d0a12');
      p.px(pts[i][0], pts[i][1], '#1a1520');
    }
    p.r(2, 7, 12, 1, 'rgba(0,0,0,0.25)');
  });

  // ---- pickups (transparent backgrounds so they sit on any floor)
  defTile('vial', 1, 1, function (p) {
    shadowDot(p, 8, 14, 4, 1.2);
    p.r(6, 2, 4, 2, '#8a5a2a'); p.px(6, 2, '#b8804a');            // cork
    p.r(7, 4, 2, 2, '#cfe6f0');                                   // neck glass
    p.r(5, 6, 6, 7, '#dfeef5');                                   // glass body
    p.r(6, 7, 4, 5, '#c0282e'); p.r(6, 7, 4, 1, '#e04848');       // blood
    p.r(6, 11, 4, 1, '#7a1018');
    p.px(6, 8, '#ffb0b0'); p.px(6, 9, '#ffb0b0');
    p.r(5, 13, 6, 1, '#8aa0ae');
  });
  defTile('coolant', 2, 3, function (p, f) {
    shadowDot(p, 8, 14, 4.5, 1.2);
    p.r(6, 2, 4, 2, '#6c7a89'); p.px(6, 2, '#b8c4d0');
    p.r(7, 4, 2, 2, '#cfe6f0');
    p.r(4, 6, 8, 7, '#dfeef5');
    p.r(5, 7, 6, 5, '#2f8ad0'); p.r(5, 7, 6, 1, '#4ab8ff');
    p.r(6, 9, 3, 2, '#4ab8ff');
    p.px(5, 8, '#ffffff'); p.px(5, 9, '#ffffff');
    p.r(4, 13, 8, 1, '#8aa0ae');
    const s = f ? [[3, 4], [12, 9]] : [[12, 4], [3, 9]];
    for (let i = 0; i < 2; i++) p.px(s[i][0], s[i][1], '#ffffff');
  });
  defTile('suture', 1, 1, function (p) {
    shadowDot(p, 8, 14, 5, 1.2);
    const rows = [
      '................', '............ssS.', '...........sSwS.', '..........sSwS..', '.........sSwS...',
      '........sSwS....', '.......sSwS.....', '......sSwS......', '.....sSwS.......', '....sSwS........',
      '...sSwS.........', '..rrSs..........', '.rr.rrr.........', '.r...rr.........', 'rr....rrr.......', '........rrrr....'
    ];
    p.g.drawImage(fromMap(rows, { s: '#6c7a89', S: '#b8c4d0', w: '#ffffff', r: '#c8343a' }), 0, 0);
  });
  defTile('ether', 2, 3, function (p, f) {
    const glow = f ? 'rgba(123,211,90,0.28)' : 'rgba(123,211,90,0.16)';
    p.e(8, 8, 7, 7, glow);
    p.e(8, 8, 5, 5, f ? 'rgba(123,211,90,0.22)' : 'rgba(123,211,90,0.12)');
    // crystal cluster
    const rows = [
      '.......gg.......',
      '......gwwg......',
      '.....gwwGGg.....',
      '.....gwgGGg.....',
      '....gwwgGGGg.g..',
      '....gwgggGGgGg..',
      '...ggwgggGGgGGg.',
      '...gGGgggGGGGGg.',
      '....gGGGGGGGGg..',
      '.....ggGGGGgg...'
    ];
    const img = fromMap(rows, { g: '#7bd35a', w: '#e8ffd0', G: '#3fa38a' });
    p.g.drawImage(img, 0, 3);
    shadowDot(p, 8, 14, 4, 1);
  });
  defTile('jar', 2, 2, function (p, f) {
    shadowDot(p, 8, 15, 5, 1);
    p.r(4, 1, 8, 2, '#c89b3c'); p.r(4, 1, 8, 1, '#f0d080'); p.r(4, 2, 8, 1, '#7a5a1e'); // lid
    p.r(3, 3, 10, 11, '#8fd8c8');
    p.r(4, 3, 8, 11, '#1f6a58');
    p.r(4, 3, 8, 2, '#2e8a72');
    // limb silhouette inside
    p.r(7, 6, 3, 5, '#d9a892'); p.r(6, 5, 5, 2, '#e0b8a2');
    p.r(6, 11, 2, 1, '#d9a892'); p.px(10, 5, '#a87a6a');
    p.px(5, 6, '#c8ffe8'); p.px(5, 7, '#c8ffe8'); p.px(5, 8, '#c8ffe8');
    const b = f ? [[10, 9], [5, 12]] : [[5, 10], [10, 12]];
    for (let i = 0; i < 2; i++) p.px(b[i][0], b[i][1], '#c8ffe8');
    p.r(3, 14, 10, 2, '#7a5a1e'); p.r(3, 14, 10, 1, '#c89b3c');
  });
  defTile('rubble', 1, 1, function (p) {
    floorBase(p, false);
    const stones = [[3, 9, 5, 4], [9, 6, 4, 3], [7, 11, 5, 3], [4, 4, 3, 3]];
    for (let i = 0; i < stones.length; i++) {
      const s = stones[i];
      p.box(s[0], s[1], s[2], s[3], ['#2a2434', '#5a5266', '#7a7288', '#9a92a8']);
    }
    p.px(11, 13, '#5a5266'); p.px(2, 6, '#5a5266'); p.px(13, 3, '#3a3446');
  });

  // ================================================================= LIMB PARTS
  // Every part is a width profile (centred rows) filled with a style texture, so any
  // (slot type x style x colour) combination can be rendered on demand and cached.
  const STYLE_VARIANT = { brass: 'mech', chitin: 'spiky', bone: 'spiky' };
  function variantOf(style) { return STYLE_VARIANT[style] || 'organic'; }

  const PART = {
    head: { W: 14, H: 14, y0: 2, t: {
      organic: [6, 8, 10, 10, 10, 10, 10, 10, 8, 8, 6, 4],
      mech: [8, 10, 10, 10, 10, 10, 10, 10, 10, 8, 6, 4],
      spiky: [8, 10, 10, 10, 10, 8, 8, 8, 8, 6, 6, 4] } },
    torso: { W: 14, H: 16, y0: 0, t: {
      organic: [8, 12, 14, 14, 14, 14, 12, 12, 12, 12, 12, 12, 12, 12, 12, 10],
      mech: [10, 14, 14, 14, 14, 14, 14, 14, 14, 14, 12, 12, 12, 12, 12, 10],
      spiky: [8, 12, 14, 14, 12, 12, 10, 10, 10, 10, 10, 10, 10, 10, 10, 8] } },
    arm: { W: 10, H: 22, y0: 0, t: {
      organic: [8, 10, 8, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 4, 4, 6, 8, 8, 8, 6],
      mech: [10, 10, 10, 8, 6, 6, 6, 8, 8, 6, 6, 6, 6, 6, 6, 6, 8, 8, 10, 10, 8, 6],
      spiky: [8, 8, 6, 4, 4, 4, 4, 6, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 2, 2, 2] } },
    leg: { W: 8, H: 20, y0: 0, t: {
      organic: [6, 8, 8, 6, 6, 6, 6, 6, 6, 6, 4, 4, 4, 6, 6, 6, 6, 8, 8, 8],
      mech: [8, 8, 8, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 8, 8, 8, 8],
      spiky: [6, 6, 6, 6, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 6, 8, 8] } }
  };
  const ICON_PART = {
    head: { W: 12, H: 11, y0: 0, t: [4, 6, 8, 8, 8, 8, 8, 8, 6, 6, 4] },
    torso: { W: 12, H: 13, y0: 0, t: [6, 10, 12, 12, 10, 10, 10, 10, 10, 10, 10, 8, 8] },
    arm: { W: 8, H: 15, y0: 0, t: [6, 8, 6, 4, 4, 4, 4, 4, 4, 4, 4, 6, 6, 6, 4] },
    leg: { W: 8, H: 15, y0: 0, t: [6, 6, 6, 4, 4, 4, 4, 4, 4, 4, 6, 6, 8, 8, 8] }
  };
  const STUMP_PART = {
    arm: { W: 10, H: 9, y0: 0, t: [8, 8, 6, 6, 6, 6, 6, 6, 4] },
    leg: { W: 8, H: 9, y0: 0, t: [6, 8, 6, 6, 6, 6, 6, 6, 4] },
    head: { W: 14, H: 14, y0: 8, t: [4, 6, 6, 6, 6, 4] },
    torso: { W: 14, H: 16, y0: 0, t: PART.torso.t.organic }
  };

  function styleTones(style, color) {
    let base = color || '#c8a08a';
    switch (style) {
      case 'brass': base = mix(base, '#c89b3c', 0.6); break;
      case 'chitin': base = shade(base, -0.25); break;
      case 'bone': base = mix(base, '#d9ceb0', 0.65); break;
      case 'slime': base = mix(base, '#7bd35a', 0.35); break;
      case 'bandage': base = '#d9ceb0'; break;
      default: break;
    }
    return {
      dark: shade(base, -0.42), mid: base, light: shade(base, 0.28), hi: shade(base, 0.55),
      line: style === 'bandage' ? '#3a2e28' : shade(base, -0.74)
    };
  }

  // Texture tone (0 dark .. 3 highlight) for a pixel of a part.
  function toneAt(style, x, y) {
    switch (style) {
      case 'brass':
        if (y % 6 === 5) return 0;
        if (y % 6 === 1 && x % 5 === 2) return 3;
        return (x % 4 === 0) ? 2 : 1;
      case 'chitin': {
        const q = y % 5;
        return q === 0 ? 2 : q === 3 ? 0 : q === 4 ? 0 : 1;
      }
      case 'bone': {
        const h = hash(x, y, 11);
        if (h < 0.07) return 0;
        return (x % 3 === 0) ? 2 : 1;
      }
      case 'slime': {
        const v = Math.sin(x * 0.9 + y * 0.5) + Math.cos(y * 0.8 - x * 0.4);
        if (hash(x, y, 13) > 0.965) return 3;
        return v > 1.1 ? 2 : v < -1.1 ? 0 : 1;
      }
      case 'scaled': {
        const xx = (x + ((y >> 1) & 1) * 2) % 4;
        return xx === 0 ? 0 : xx === 1 ? 2 : 1;
      }
      case 'bandage': {
        const q = (x + y) % 4;
        return q === 0 ? 0 : q === 1 ? 2 : 1;
      }
      default: {
        const h = hash(x, y, 17);
        return h < 0.1 ? 0 : h > 0.93 ? 2 : 1;
      }
    }
  }

  function paintMask(spec, widths, style, color) {
    const W = spec.W, H = spec.H, y0 = spec.y0 || 0;
    const c = mkCanvas(W, H), g = c.getContext('2d');
    const mask = [];
    for (let y = 0; y < H; y++) { mask.push(new Array(W).fill(false)); }
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i], x0 = (W - w) >> 1;
      if (y0 + i >= H) break;
      for (let x = x0; x < x0 + w; x++) mask[y0 + i][x] = true;
    }
    const at = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H && mask[y][x]; };
    const isRing = function (x, y) { return at(x, y) && !(at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1)); };
    const tn = styleTones(style, color);
    const cols = [tn.dark, tn.mid, tn.light, tn.hi];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!mask[y][x]) continue;
        if (isRing(x, y)) { g.fillStyle = tn.line; g.fillRect(x, y, 1, 1); continue; }
        let t = toneAt(style, x, y);
        if (isRing(x, y - 1) || isRing(x - 1, y)) t += 1;
        if (isRing(x, y + 1) || isRing(x + 1, y)) t -= 1;
        g.fillStyle = cols[Math.max(0, Math.min(3, t))];
        g.fillRect(x, y, 1, 1);
      }
    }
    return { c: c, tn: tn, mask: mask };
  }

  const EYE = { flesh: '#3a1018', brass: '#ffb830', chitin: '#ff3030', bone: '#ff7a1a', slime: '#c8ff90', scaled: '#ffe040' };

  function decorHead(p, style, tn, small) {
    const eye = EYE[style] || EYE.flesh;
    if (small) {
      p.px(4, 4, eye); p.px(7, 4, eye);
      if (style === 'flesh') { p.px(4, 4, '#f0e6d0'); p.px(7, 4, '#f0e6d0'); p.px(4, 5, eye); p.px(7, 5, eye); }
      return;
    }
    switch (style) {
      case 'brass':
        p.r(3, 6, 8, 2, '#120c04'); p.r(4, 6, 2, 2, eye); p.r(8, 6, 2, 2, eye);
        p.px(5, 10, tn.line); p.px(7, 10, tn.line); p.px(9, 10, tn.line);
        p.px(5, 11, tn.line); p.px(7, 11, tn.line);
        p.px(3, 9, tn.hi); p.px(10, 9, tn.hi);
        p.r(6, 0, 2, 2, '#7a5a1e'); p.px(6, 0, '#ff7a1a'); p.px(7, 1, '#c89b3c');
        break;
      case 'chitin':
        p.px(4, 6, eye); p.px(5, 5, eye); p.px(8, 5, eye); p.px(9, 6, eye);
        p.px(4, 5, '#ffb0a0'); p.px(9, 5, '#ffb0a0');
        p.px(4, 10, tn.hi); p.px(9, 10, tn.hi); p.px(5, 11, tn.line); p.px(8, 11, tn.line);
        p.px(4, 1, tn.line); p.px(3, 0, tn.line); p.px(9, 1, tn.line); p.px(10, 0, tn.line);
        break;
      case 'bone':
        p.r(4, 6, 2, 3, '#120c10'); p.r(8, 6, 2, 3, '#120c10'); p.px(5, 7, eye); p.px(8, 7, eye);
        p.r(6, 9, 2, 1, '#120c10');
        p.px(5, 11, '#f0e8d0'); p.px(6, 11, '#120c10'); p.px(7, 11, '#f0e8d0'); p.px(8, 11, '#120c10');
        p.px(2, 1, '#e8dcc0'); p.px(1, 0, '#e8dcc0'); p.px(11, 1, '#e8dcc0'); p.px(12, 0, '#e8dcc0');
        p.px(2, 2, '#e8dcc0'); p.px(11, 2, '#e8dcc0');
        break;
      case 'slime':
        p.r(4, 6, 2, 2, eye); p.r(8, 6, 2, 2, eye); p.px(5, 7, '#1a4a1a'); p.px(8, 7, '#1a4a1a');
        p.px(4, 4, tn.hi); p.px(5, 4, tn.hi);
        p.px(5, 10, '#1a4a1a'); p.px(6, 11, '#1a4a1a'); p.px(7, 10, '#1a4a1a'); p.px(8, 11, '#1a4a1a');
        break;
      case 'scaled':
        p.r(4, 6, 2, 1, eye); p.r(8, 6, 2, 1, eye); p.px(5, 6, '#120c10'); p.px(8, 6, '#120c10');
        p.px(6, 9, tn.line); p.px(7, 9, tn.line);
        p.r(6, 0, 2, 2, tn.dark); p.px(5, 2, tn.light); p.px(8, 2, tn.light);
        break;
      default:
        p.r(4, 5, 2, 1, tn.dark); p.r(8, 5, 2, 1, tn.dark);
        p.r(4, 6, 2, 2, '#f0e6d0'); p.r(8, 6, 2, 2, '#f0e6d0');
        p.px(5, 6, eye); p.px(5, 7, eye); p.px(8, 6, eye); p.px(8, 7, eye);
        p.r(5, 10, 4, 1, '#3a1418');
        p.px(6, 9, '#c8b89a'); p.px(6, 11, '#c8b89a'); p.px(8, 9, '#c8b89a'); p.px(8, 11, '#c8b89a');
    }
  }

  function decorTorso(p, style, tn) {
    switch (style) {
      case 'brass':
        p.r(5, 4, 4, 4, '#120c04'); p.r(6, 5, 2, 2, '#ffb830'); p.px(5, 4, tn.hi);
        p.px(2, 2, tn.hi); p.px(11, 2, tn.hi); p.px(2, 12, tn.hi); p.px(11, 12, tn.hi);
        p.r(2, 10, 10, 1, tn.dark);
        break;
      case 'chitin':
        p.r(6, 2, 1, 12, tn.dark); p.r(7, 2, 1, 12, tn.light);
        p.r(3, 5, 8, 1, tn.dark); p.r(3, 8, 8, 1, tn.dark); p.r(3, 11, 8, 1, tn.dark);
        break;
      case 'bone':
        p.r(6, 2, 2, 12, '#c8b89a');
        for (let y = 3; y < 12; y += 2) { p.r(3, y, 8, 1, '#efe6cc'); p.r(3, y + 1, 8, 1, '#2a2028'); }
        p.r(6, 2, 2, 12, '#c8b89a');
        break;
      case 'slime':
        p.r(6, 6, 2, 2, '#e04848'); p.px(6, 6, '#ffb0b0');
        p.r(3, 9, 2, 2, tn.light); p.px(9, 4, tn.hi); p.r(9, 10, 2, 2, tn.light); p.px(4, 4, tn.hi);
        break;
      case 'scaled':
        p.r(5, 3, 4, 12, tn.light);
        for (let y = 4; y < 14; y += 2) p.r(5, y, 4, 1, tn.mid);
        break;
      default:
        p.r(6, 3, 1, 11, '#3a1418');
        for (let y = 4; y < 14; y += 3) { p.px(5, y, '#c8b89a'); p.px(7, y, '#c8b89a'); }
    }
  }

  function decorStump(p, spec, type) {
    // blood on the bottom of a bandaged stump; a hollow for a gutted torso
    const W = spec.W, H = spec.H;
    if (type === 'torso') {
      p.r(4, 4, 6, 8, '#2a080e'); p.r(5, 5, 4, 6, '#4a0c14');
      for (let y = 5; y < 11; y += 2) p.r(5, y, 4, 1, '#d9ceb0');
      p.px(6, 6, '#a3202a'); p.px(8, 9, '#a3202a');
      return;
    }
    const y0 = spec.y0 || 0;
    for (let x = 2; x < W - 2; x++) {
      if (hash(x, type.length, 23) < 0.6) p.px(x, H - 3, '#a3202a');
      if (hash(x, type.length, 29) < 0.45) p.px(x, H - 2, '#7a1018');
    }
    p.px(Math.floor(W / 2), H - 2, '#e04848');
    if (type === 'head') p.px(6, y0 + 2, '#a3202a');
  }

  const partCache = {};
  // kind: 'doll' | 'icon' | 'stump'; type: head|torso|arm|leg
  function partImg(kind, type, style, color) {
    const key = kind + '|' + type + '|' + style + '|' + color;
    if (partCache[key]) return partCache[key];
    let spec, widths, res;
    if (kind === 'stump') {
      spec = STUMP_PART[type];
      res = paintMask(spec, spec.t, 'bandage', '#d9ceb0');
      decorStump(painter(res.c), spec, type);
    } else if (kind === 'icon') {
      spec = ICON_PART[type];
      res = paintMask(spec, spec.t, style, color);
      const p = painter(res.c);
      if (type === 'head') decorHead(p, style, res.tn, true);
    } else {
      spec = PART[type];
      widths = spec.t[variantOf(style)];
      res = paintMask(spec, widths, style, color);
      const p = painter(res.c);
      if (type === 'head') decorHead(p, style, res.tn, false);
      else if (type === 'torso') decorTorso(p, style, res.tn);
    }
    partCache[key] = res.c;
    return res.c;
  }

  const SLOT_ORDER = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];
  const SLOT_TYPE = { head: 'head', torso: 'torso', armL: 'arm', armR: 'arm', legL: 'leg', legR: 'leg' };
  const DOLL_POS = { head: [9, 0], torso: [9, 13], armL: [0, 14], armR: [22, 14], legL: [8, 28], legR: [16, 28] };
  const DOLL_CENTER = { head: [16, 8], torso: [16, 21], armL: [5, 24], armR: [27, 24], legL: [12, 38], legR: [20, 38] };

  function limbDef(id) { return (id && DD.LIMBS && DD.LIMBS[id]) || null; }
  function lookOf(id) {
    const d = limbDef(id);
    const l = (d && d.look) || {};
    return { style: l.style || 'flesh', color: l.color || '#c8a08a' };
  }
  // slot type of a limb instance: the limb definition's own .slot, else the slot key's type
  function typeOf(inst, slotKey) {
    const d = inst && limbDef(inst.id);
    const t = d && d.slot;
    return (t === 'head' || t === 'torso' || t === 'arm' || t === 'leg') ? t : SLOT_TYPE[slotKey];
  }
  function skinTint(skin) {
    try {
      if (skin === undefined) skin = DD.save && DD.save.data && DD.save.data.skin;
      const list = DD.COSMETICS || [];
      for (let i = 0; i < list.length; i++) if (list[i].id === skin) return list[i].tint || null;
    } catch (e) { /* ignore */ }
    return null;
  }

  // ---- heat colouring
  const HEAT_STOPS = [[0, '#a3202a'], [0.35, '#e0401a'], [0.6, '#ff7a1a'], [0.82, '#ffc040'], [1, '#fff6d8']];
  function heatColor(h) {
    h = Math.max(0, Math.min(1, h));
    for (let i = 1; i < HEAT_STOPS.length; i++) {
      if (h <= HEAT_STOPS[i][0]) {
        const a = HEAT_STOPS[i - 1], b = HEAT_STOPS[i];
        return mix(a[1], b[1], (h - a[0]) / (b[0] - a[0]));
      }
    }
    return HEAT_STOPS[HEAT_STOPS.length - 1][1];
  }
  function rgba(hexCol, a) {
    const c = rgb(hexCol);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  const fxTmp = mkCanvas(32, 48), fxTmpG = fxTmp.getContext('2d');
  const hiTmp = mkCanvas(32, 48), hiTmpG = hiTmp.getContext('2d');
  const scratch = mkCanvas(36, 52), scratchG = scratch.getContext('2d');
  const SCR = 2; // doll offset inside scratch (room for the highlight outline)

  // Applies heat tint + crack marks to a part; returns the canvas to draw.
  function partWithFx(part, inst, t) {
    const heat = inst ? Math.max(0, Math.min(100, inst.heat || 0)) : 0;
    const cracked = inst && inst.maxIntegrity > 1 && inst.integrity <= 1;
    if (heat < 4 && !cracked) return part;
    const g = fxTmpG;
    g.clearRect(0, 0, 32, 48);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(part, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    if (heat >= 4) {
      const h = heat / 100;
      let a = 0.16 + 0.62 * h;
      if (h > 0.8) a += 0.08 * Math.sin(t * 14);
      g.fillStyle = rgba(heatColor(h), Math.min(0.72, a));
      g.fillRect(0, 0, part.width, part.height);
    }
    if (cracked) {
      g.fillStyle = '#120c10';
      const w = part.width, h2 = part.height;
      const cx = Math.floor(w / 2), cy = Math.floor(h2 * 0.3);
      const pts = [[0, 0], [1, 1], [1, 2], [2, 3], [1, 4], [1, 5], [2, 6]];
      for (let i = 0; i < pts.length; i++) g.fillRect(cx - 1 + pts[i][0], cy + pts[i][1], 1, 1);
    }
    g.globalCompositeOperation = 'source-over';
    return fxTmp;
  }

  // ---------------------------------------------------------------- drawBody
  function drawBody(ctx, body, x, y, scale, t, opts) {
    try {
      opts = opts || {};
      scale = scale || 1; t = t || 0;
      const slots = (body && body.slots) || {};
      const breath = Math.sin(t * 2.2) > 0.2 ? 1 : 0;
      const g = scratchG;
      g.clearRect(0, 0, scratch.width, scratch.height);
      g.imageSmoothingEnabled = false;
      const order = ['legL', 'legR', 'torso', 'armL', 'armR', 'head'];
      const heats = {};
      for (let i = 0; i < order.length; i++) {
        const k = order[i], inst = slots[k] || null, type = typeOf(inst, k);
        let part;
        if (inst) {
          const lk = lookOf(inst.id);
          part = partImg('doll', type, lk.style, lk.color);
        } else part = partImg('stump', SLOT_TYPE[k], 'bandage', '#d9ceb0');
        heats[k] = inst ? Math.max(0, Math.min(100, inst.heat || 0)) : 0;
        const dy = (k === 'head' || k === 'armL' || k === 'armR') ? -breath : 0;
        g.drawImage(partWithFx(part, inst, t), SCR + DOLL_POS[k][0], SCR + DOLL_POS[k][1] + dy);
      }
      // skin cosmetic tint (source-atop keeps it inside the silhouette)
      const tint = skinTint(opts.skin);
      if (tint) {
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = 0.38;
        g.fillStyle = tint;
        g.fillRect(0, 0, scratch.width, scratch.height);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
      // highlight: pulsing white silhouette outline, drawn behind everything
      if (opts.highlight && DOLL_POS[opts.highlight]) {
        const k = opts.highlight, inst = slots[k] || null, type = typeOf(inst, k);
        let part;
        if (inst) { const lk = lookOf(inst.id); part = partImg('doll', type, lk.style, lk.color); }
        else part = partImg('stump', SLOT_TYPE[k], 'bandage', '#d9ceb0');
        hiTmpG.globalCompositeOperation = 'source-over';
        hiTmpG.clearRect(0, 0, 32, 48);
        hiTmpG.drawImage(part, 0, 0);
        hiTmpG.globalCompositeOperation = 'source-in';
        hiTmpG.fillStyle = '#fff2b0';
        hiTmpG.fillRect(0, 0, 32, 48);
        hiTmpG.globalCompositeOperation = 'source-over';
        const px = SCR + DOLL_POS[k][0], py = SCR + DOLL_POS[k][1];
        g.globalCompositeOperation = 'destination-over';
        g.globalAlpha = 0.55 + 0.45 * Math.sin(t * 6);
        for (let n = 0; n < 4; n++) {
          const ox = n === 0 ? -1 : n === 1 ? 1 : 0, oy = n === 2 ? -1 : n === 3 ? 1 : 0;
          g.drawImage(hiTmp, 0, 0, part.width, part.height, px + ox, py + oy, part.width, part.height);
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
      // shadow under the feet
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(Math.round(x - 12 * scale), Math.round(y - 1.5 * scale), 24 * scale, 2 * scale);
      ctx.fillRect(Math.round(x - 9 * scale), Math.round(y + 0.5 * scale), 18 * scale, 1 * scale);
      // heat halos (additive, behind the doll)
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < SLOT_ORDER.length; i++) {
        const k = SLOT_ORDER[i], h = heats[k] / 100;
        if (h < 0.25) continue;
        const cx = x - 16 * scale + DOLL_CENTER[k][0] * scale, cy = y - 48 * scale + DOLL_CENTER[k][1] * scale;
        const r = (9 + 8 * h) * scale;
        const col = heatColor(h);
        const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        gr.addColorStop(0, rgba(col, 0.16 + 0.34 * h));
        gr.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = gr;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(scratch, Math.round(x - (16 + SCR) * scale), Math.round(y - (48 + SCR) * scale),
        scratch.width * scale, scratch.height * scale);
      ctx.restore();
    } catch (e) { /* never throw from draw code */ }
  }

  // ================================================================= ICONS (8x8)
  const IP = {
    k: '#1a1520', r: '#e04848', R: '#a3202a', o: '#ff7a1a', y: '#ffb830', Y: '#ffe08a',
    w: '#e8dcc0', W: '#ffffff', g: '#7bd35a', G: '#3fa38a', b: '#4ab8ff', B: '#2f6fb0',
    s: '#6c7a89', S: '#b8c4d0', z: '#c89b3c', Z: '#7a5a1e', p: '#a070e0', P: '#6b3fa0',
    c: '#b8643a', m: '#d9a892', M: '#a87a6a', n: '#5a3a1e'
  };
  const ICONS = {
    attack: ['......SW', '.....SWS', '....SWS.', 'z..SWS..', '.zSWS...', '..zzs...', '.nzz....', 'n.......'],
    skill: ['...bb...', '...bb...', '..bWWb..', 'bbWWWWbb', 'bbWWWWbb', '..bWWb..', '...bb...', '...bb...'],
    power: ['...pp...', '..pPPp..', '.pPWWPp.', 'pPWppWPp', 'pPWppWPp', '.pPWWPp.', '..pPPp..', '...pp...'],
    block: ['ssssssss', 'sSSSSSSs', 'sSWSSSSs', 'sSSSSSSs', '.sSSSSs.', '.sSSSSs.', '..sSSs..', '...ss...'],
    heat: ['...SS...', '..SrrS..', '..SrrS..', '..SrrS..', '..SoyS..', '.SrooyS.', '.SrooyS.', '..SSSS..'],
    wear: ['.ssssss.', 'sSSSkSSs', 'sSSkSSSs', 'sSSSkSSs', '.sSkSSs.', '.sSSkSs.', '..sSkS..', '...sk...'],
    energy: ['....yyY.', '...yyY..', '..yyY...', '.yyyyyy.', '...yyY..', '..yyY...', '.yyY....', '.yY.....'],
    heart: ['.rr..rr.', 'rWrrrrrr', 'rrrrrrrr', 'rrrrrrrR', '.rrrrrR.', '..rrrR..', '...rR...', '........'],
    clock: ['..zzzz..', '.zwwkwwz', 'zwwwkwwZ', 'zwwwkkwZ', 'zwwwwwwZ', 'zwwwwwwZ', '.zwwwwZ.', '..ZZZZ..'],
    gear: ['...zz...', '.z.zz.z.', '..zzzz..', 'zzzkkzzZ', 'zzzkkzzZ', '..zzzZ..', '.Z.zZ.Z.', '...ZZ...'],
    head: ['..mmmm..', '.mmmmmm.', 'mmkmmkmm', 'mmmmmmmm', '.mmmmmM.', '..mmmM..', '...MM...', '........'],
    torso: ['mmmmmmmm', 'mmmmmmmm', '.mmmmmM.', '.mmMMmM.', '.mmmmmM.', '.mmmmmM.', '.mmmmmM.', '..mmmM..'],
    arm: ['..mmm...', '..mmm...', '..mmm...', '..mmM...', '..mmM...', '.mmmmm..', '.mmmmM..', '..mMM...'],
    leg: ['..mmm...', '..mmm...', '..mmM...', '..mmM...', '..mmM...', '..mmmm..', '..mmmmm.', '.MMMMMM.'],
    stump: ['wwwwwwww', 'wMwMwMwM', '.wwwwww.', '.wRwwww.', '.wwRRww.', '.wwwwww.', '..rrrr..', '..RRRR..'],
    burn: ['...o....', '..oo....', '..ooo.o.', '.oooyoo.', '.ooyyoo.', '.oyyyyo.', '..oyyo..', '...oo...'],
    bleed: ['...r....', '..rr....', '..rrr...', '.rrrrr..', '.rrWrr..', '.rrrrR..', '..rrR...', '........'],
    weak: ['...pp...', '...pp...', '...pp...', 'pp.pp.pp', '.pppppp.', '..pppp..', '...pp...', '........'],
    vuln: ['..rrrr..', '.rWWWWr.', 'rWrrrrWr', 'rWrWWrWr', 'rWrWWrWr', 'rWrrrrWr', '.rWWWWr.', '..rrrr..'],
    stun: ['..yyyy..', '.y....y.', 'y..yy..y', 'y.y..y.y', 'y.y.yy.y', 'y..yyy..', '.y......', '..yyyy..'],
    strength: ['.rrrrr..', 'rrWrWrr.', 'rrrrrrrr', 'rrrrrrrR', 'rrrrrrrR', '.rrrrrR.', '..rRRr..', '..RRRR..'],
    thorns: ['g..gg..g', '.g.gg.g.', '..gggg..', 'gggGGggg', 'gggGGggg', '..gggg..', '.g.gg.g.', 'g..gg..g'],
    heal: ['..gggg..', '..gwwg..', 'gggwwggg', 'gwwwwwwg', 'gwwwwwwg', 'gggwwggg', '..gwwg..', '..gggg..'],
    buff: ['...rr...', '..rWWr..', '.rWWWWr.', 'rrrWWrrr', '...WW...', '...rr...', '...rr...', '...RR...'],
    scald: ['..s..s..', '.s..s...', '...o....', '..ooo...', '.oooyo..', '.ooyyo..', '.oyyyo..', '..ooo...'],
    sever: ['S.....S.', '.S...S..', '..SrS...', '...r....', '..rSr...', '.r...r..', 'r.....r.', '........'],
    ether: ['...gg...', '..gwwg..', '.gwwggG.', 'gwwgggGG', 'gwggggGG', '.gggGGG.', '..gGGG..', '...GG...'],
    skull: ['.wwwwww.', 'wwwwwwww', 'wkkwwkkw', 'wkkwwkkw', 'wwwkkwww', '.wwwwww.', '.wkwkwk.', '..wkwk..']
  };
  const iconCache = {};
  function icon(ctx, name, x, y, scale) {
    try {
      const rows = ICONS[name];
      if (!rows) return;
      if (!iconCache[name]) iconCache[name] = fromMap(rows, IP);
      blit(ctx, iconCache[name], x, y, scale || 1);
    } catch (e) { /* ignore */ }
  }

  // ================================================================= LIMB ICON (16x16)
  const limbIconCache = {};
  const UNKNOWN_LIMB = [
    '................', '.....kkkkkk.....', '....kssssssk....', '...ksSSSSSSk....', '...ksSkkSSsk....',
    '....kkkSSsk.....', '......kSSsk.....', '.....kSSsk......', '.....kssk.......', '.....kkk........',
    '.....kSSk.......', '.....kssk.......', '.....kkkk.......', '................', '................', '................'
  ];
  function limbIconImg(limbId) {
    const d = limbDef(limbId);
    if (!d) {
      if (!limbIconCache.__unknown) limbIconCache.__unknown = fromMap(UNKNOWN_LIMB, IP);
      return limbIconCache.__unknown;
    }
    if (limbIconCache[limbId]) return limbIconCache[limbId];
    const lk = lookOf(limbId);
    const type = (d.slot === 'head' || d.slot === 'torso' || d.slot === 'arm' || d.slot === 'leg') ? d.slot : 'torso';
    const part = partImg('icon', type, lk.style, lk.color);
    const c = mkCanvas(16, 16), g = c.getContext('2d');
    g.drawImage(part, (16 - part.width) >> 1, (16 - part.height) >> 1);
    limbIconCache[limbId] = c;
    return c;
  }
  function limbIcon(ctx, limbId, x, y, scale) {
    try { blit(ctx, limbIconImg(limbId), x, y, scale || 1); } catch (e) { /* ignore */ }
  }

  // ================================================================= PLAYER AVATAR (16x16)
  const avatarCache = {};
  let avatarCount = 0;
  const LAY = {
    front: { legL: [5, 11, 3, 4], legR: [8, 11, 3, 4], torso: [4, 6, 8, 5], armL: [2, 6, 2, 6], armR: [12, 6, 2, 6], head: [5, 1, 6, 5] },
    right: { legL: [5, 11, 3, 4], legR: [8, 11, 3, 4], torso: [6, 6, 5, 5], armL: [4, 7, 2, 5], armR: [8, 6, 2, 6], head: [6, 1, 5, 5] }
  };

  function toneRect(p, r, tn) {
    const x = r[0], y = r[1], w = r[2], h = r[3];
    p.r(x, y, w, h, tn.mid);
    if (h >= 2) p.r(x, y, w, 1, tn.light);
    if (h >= 3) p.r(x, y + h - 1, w, 1, tn.dark);
    if (w >= 2) { p.r(x, y, 1, h, tn.light); p.r(x + w - 1, y, 1, h, tn.dark); }
  }
  function bandRect(p, r) {
    p.r(r[0], r[1], r[2], r[3], '#d9ceb0');
    for (let j = 1; j < r[3]; j += 2) p.r(r[0], r[1] + j, r[2], 1, '#a89a7c');
    p.px(r[0] + (r[2] >> 1), r[1] + r[3] - 1, '#a3202a');
  }

  function paintAvatar(view, slots) {
    const c = mkCanvas(16, 16), p = painter(c);
    const lay = LAY[view === 'back' ? 'front' : view === 'right' ? 'right' : 'front'];
    const T = {}, ST = {};
    SLOT_ORDER.forEach(function (k) {
      const inst = slots[k];
      if (inst) { const lk = lookOf(inst.id); ST[k] = lk.style; T[k] = styleTones(lk.style, lk.color); }
    });
    const order = view === 'right' ? ['armL', 'legL', 'legR', 'torso', 'armR', 'head'] : ['legL', 'legR', 'torso', 'armL', 'armR', 'head'];
    order.forEach(function (k) {
      const r = lay[k];
      if (T[k]) {
        let tn = T[k];
        if (view === 'right' && k === 'armL') tn = { mid: tn.dark, light: tn.mid, dark: shade(tn.dark, -0.3) };
        toneRect(p, r, tn);
        return;
      }
      const type = SLOT_TYPE[k];
      if (type === 'leg') bandRect(p, [r[0], r[1], r[2], 2]);
      else if (type === 'arm') bandRect(p, [r[0], r[1], r[2], 3]);
      else if (type === 'head') bandRect(p, [r[0] + 1, r[1] + 3, r[2] - 2, 2]);
      else { bandRect(p, r); p.r(r[0] + 2, r[1] + 1, Math.max(1, r[2] - 4), r[3] - 2, '#3a0c12'); }
    });
    // face + per-style details
    if (T.head) {
      const hr = lay.head, eye = EYE[ST.head] || EYE.flesh;
      if (view === 'front') { p.px(hr[0] + 1, 3, eye); p.px(hr[0] + 4, 3, eye); if (ST.head === 'bone') p.r(hr[0] + 2, 5, 2, 1, '#120c10'); }
      else if (view === 'right') { p.px(hr[0] + 3, 3, eye); }
      else p.r(hr[0], hr[1], hr[2], 2, T.head.dark);
    }
    if (T.torso) {
      const tr = lay.torso, cx = tr[0] + (tr[2] >> 1) - 1;
      if (view === 'back') { p.r(cx, tr[1] + 1, 2, 3, T.torso.dark); }
      else if (ST.torso === 'brass') { p.r(cx, tr[1] + 2, 2, 1, '#ffb830'); }
      else if (ST.torso === 'bone') { p.r(tr[0] + 1, tr[1] + 1, tr[2] - 2, 1, '#efe6cc'); p.r(tr[0] + 1, tr[1] + 3, tr[2] - 2, 1, '#efe6cc'); }
      else if (ST.torso === 'chitin') { p.r(cx, tr[1], 2, tr[3], T.torso.dark); }
      else if (ST.torso === 'scaled') { p.r(cx, tr[1] + 1, 2, tr[3] - 2, T.torso.light); }
      else if (ST.torso === 'slime') { p.px(cx, tr[1] + 2, '#e04848'); }
      else { p.px(cx, tr[1] + 1, '#3a1418'); p.px(cx, tr[1] + 3, '#3a1418'); }
    }
    ['armL', 'armR'].forEach(function (k) {
      if (T[k] && ST[k] === 'brass' && !(view === 'right' && k === 'armL')) p.px(lay[k][0], lay[k][1] + 2, '#ffe08a');
    });
    ['legL', 'legR'].forEach(function (k) {
      if (T[k] && ST[k] === 'brass') p.px(lay[k][0], lay[k][1] + 1, '#ffe08a');
    });
    // skin cosmetic
    const tint = skinTint();
    if (tint) p.atop(function (q) { q.g.globalAlpha = 0.36; q.r(0, 0, 16, 16, tint); q.g.globalAlpha = 1; });
    outline(c, '#120e16');
    if (view === 'left') {
      const f = mkCanvas(16, 16), fg = f.getContext('2d');
      fg.translate(16, 0); fg.scale(-1, 1); fg.drawImage(c, 0, 0);
      return f;
    }
    return c;
  }

  function facingView(facing) {
    if (typeof facing === 'number') return facing < 0 ? 'left' : facing > 0 ? 'right' : 'front';
    const f = String(facing || 'down').toLowerCase().charAt(0);
    return f === 'u' ? 'back' : f === 'l' ? 'left' : f === 'r' ? 'right' : 'front';
  }

  function player(ctx, body, x, y, scale, t, facing) {
    try {
      scale = scale || 1; t = t || 0;
      const view = facingView(facing);
      const slots = (body && body.slots) || {};
      const key = view + '|' + SLOT_ORDER.map(function (k) { return slots[k] ? slots[k].id : '-'; }).join(',') + '|' + (skinTint() || '');
      let img = avatarCache[key];
      if (!img) {
        if (avatarCount > 250) { for (const k in avatarCache) delete avatarCache[k]; avatarCount = 0; }
        img = avatarCache[key] = paintAvatar(view, slots);
        avatarCount++;
      }
      const bob = Math.sin(t * 3.2) > 0.4 ? -1 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(Math.round(x + 3 * scale), Math.round(y + 14 * scale), 10 * scale, scale);
      ctx.fillRect(Math.round(x + 4 * scale), Math.round(y + 15 * scale), 8 * scale, scale);
      blit(ctx, img, x, y + bob * scale, scale);
    } catch (e) { /* ignore */ }
  }

  // ================================================================= ENEMIES
  const OUTC = '#120e16';
  const STEEL = ['#3a4450', '#8a98a8', '#c8d4e0', '#f0f8ff'];
  const BRASS = ['#3d2a0c', '#a07a2c', '#c89b3c', '#f0d080'];
  const IRON = ['#0d0a12', '#2c2a36', '#4a4858', '#6a6878'];
  const GLASS = ['#8aa0ae', '#cfe6f0', '#e6f4fa', '#ffffff'];
  const ICHOR = ['#1a5a1a', '#3fa34a', '#7bd35a', '#c8ff90'];
  const EYEBLK = ['#050205', '#120a10', '#1a1018', '#2a1a24'];

  // ---- 16x16 explore sprites (feet on row 14, outline on row 15)
  const MINI = {
    homunculo: function (p) {
      p.ball(8, 5, 5, 4, '#d9a892');
      p.r(5, 4, 2, 3, '#120a10'); p.r(9, 4, 2, 3, '#120a10'); p.px(5, 4, '#ffffff'); p.px(9, 4, '#ffffff');
      p.r(6, 8, 4, 1, '#a3202a');
      p.ball(8, 11, 3, 3, '#d9a892');
      p.r(5, 14, 2, 1, '#a87a6a'); p.r(9, 14, 2, 1, '#a87a6a');
    },
    quimera: function (p) {
      p.line(13, 9, 13, 4, '#4a8a4a'); p.px(13, 3, '#4a8a4a'); p.px(14, 3, '#ff3030');
      p.ball(9, 9, 5, 3, '#b08a5a');
      p.ball(12, 9, 3, 3, '#7a7a86', [12, 0, 16, 16]);
      p.ball(8, 10, 2, 3, '#5f7a4a', [7, 0, 10, 16]);
      p.r(5, 11, 2, 4, '#9a7a4a'); p.r(11, 11, 2, 4, '#3a2a2a');
      p.ball(4, 7, 3.4, 3.4, '#8a4a1e');
      p.ball(4, 7, 2.2, 2.2, '#c09a62');
      p.px(3, 6, '#ff3030'); p.px(2, 8, '#ffffff');
      p.px(2, 4, '#e8dcc0'); p.px(2, 3, '#e8dcc0'); p.px(5, 4, '#e8dcc0');
    },
    golem: function (p) {
      p.box(4, 12, 3, 3, BRASS); p.box(9, 12, 3, 3, BRASS);
      p.box(1, 6, 2, 6, ['#3d2a0c', '#7a5a1e', '#a07a2c', '#c89b3c']); p.box(13, 6, 2, 6, ['#3d2a0c', '#7a5a1e', '#a07a2c', '#c89b3c']);
      p.r(1, 11, 2, 2, '#4a4858'); p.r(13, 11, 2, 2, '#4a4858');
      p.box(3, 5, 10, 7, BRASS, true);
      p.r(7, 7, 2, 3, '#ff7a1a'); p.px(7, 8, '#ffd868');
      p.box(5, 1, 6, 4, BRASS);
      p.r(6, 2, 4, 1, '#120c04'); p.px(7, 2, '#ffb830'); p.px(8, 2, '#ffb830');
    },
    sanguijuela: function (p) {
      const seg = [[12, 13, 2], [10, 13, 2.4], [8, 12, 2.8], [6, 10, 3], [5, 7, 3]];
      seg.forEach(function (s, i) { p.ball(s[0], s[1], s[2], s[2], i % 2 ? '#5a1e2a' : '#3a1420'); });
      p.px(11, 12, '#ff7a1a'); p.px(9, 11, '#ff7a1a'); p.px(7, 9, '#ff7a1a');
      p.ball(5, 4, 3.2, 3.2, '#a3202a'); p.px(5, 4, '#120408'); p.px(4, 4, '#120408');
      p.px(3, 3, '#ffffff'); p.px(7, 3, '#ffffff'); p.px(5, 1, '#ffffff'); p.px(3, 6, '#ffffff'); p.px(7, 5, '#ffffff');
    },
    alquimista: function (p) {
      for (let y = 7; y <= 14; y++) {
        const w = 4 + (y - 7), x0 = Math.round(8 - w / 2);
        p.r(x0, y, w, 1, y < 10 ? '#2f6a74' : '#1f4a52');
        p.px(x0, y, '#4a8a94');
      }
      p.r(7, 10, 2, 4, '#b8a884');
      p.ball(8, 4, 3, 3, '#d9b09a');
      p.r(5, 3, 2, 2, '#c89b3c'); p.r(9, 3, 2, 2, '#c89b3c'); p.px(6, 4, '#7bd35a'); p.px(9, 4, '#7bd35a');
      p.r(7, 6, 2, 2, '#c8c0b0');
      p.line(11, 9, 13, 7, '#2f6a74'); p.r(12, 3, 3, 4, '#dfeef5'); p.r(13, 5, 1, 2, '#7bd35a'); p.px(13, 2, '#8a5a2a');
    },
    cirujano: function (p) {
      p.r(6, 11, 2, 4, '#2a3038'); p.r(9, 11, 2, 4, '#2a3038');
      for (let y = 6; y <= 12; y++) {
        const w = 6 + Math.floor((y - 6) / 3), x0 = Math.round(8.5 - w / 2);
        p.r(x0, y, w, 1, '#a8a898'); p.px(x0, y, '#c8c8b8');
      }
      p.px(8, 9, '#a3202a'); p.px(9, 10, '#a3202a'); p.px(7, 11, '#6a1018');
      p.ball(8.5, 4, 3, 2.6, '#cfc0b0');
      p.r(6, 1, 5, 2, '#3f7a6a'); p.px(8, 1, '#fff4d0');
      p.r(6, 5, 4, 2, '#b8d8d0'); p.px(6, 4, '#120c10'); p.px(9, 4, '#a3202a');
      p.ball(3, 8, 3, 3, ['#3a4450', '#8a98a8', '#c8d4e0', '#f0f8ff']); p.px(3, 8, '#120c10');
      p.px(0, 8, '#c8d4e0'); p.px(6, 8, '#c8d4e0'); p.px(3, 5, '#c8d4e0'); p.px(2, 11, '#a3202a');
      p.line(6, 8, 6, 8, '#a8a898');
    },
    acolito: function (p) {
      for (let y = 5; y <= 14; y++) {
        const w = 4 + (y - 5), x0 = Math.round(8 - w / 2);
        p.r(x0, y, Math.min(w, 13), 1, y < 10 ? '#5a2048' : '#3a1430');
        p.px(x0, y, '#7a3060');
      }
      p.r(7, 8, 2, 7, '#7a5a1e'); p.px(7, 8, '#c89b3c');
      p.ball(8, 4, 3, 4, '#2a0f26');
      p.r(7, 4, 2, 2, '#08050a'); p.px(7, 5, '#ff7a1a'); p.px(8, 5, '#ff7a1a');
      p.line(11, 8, 13, 6, '#3a1430'); p.r(13, 3, 2, 3, '#7bd35a'); p.px(13, 2, '#dfeef5');
    },
    rector: function (p) {
      p.r(5, 12, 2, 3, '#1c1418'); p.r(9, 12, 2, 3, '#1c1418');
      p.box(3, 5, 10, 8, ['#1a0a0e', '#5a1e24', '#7a303a', '#9a4048']);
      p.r(6, 9, 4, 4, '#c8bda0'); p.px(7, 11, '#a3202a'); p.px(9, 10, '#a3202a');
      p.ball(3, 5, 1.6, 1.6, BRASS); p.ball(13, 5, 1.6, 1.6, BRASS);
      p.ball(8, 4, 2.6, 2.6, '#b8b8a0');
      p.r(6, 1, 5, 2, '#15101a'); p.px(7, 4, '#ff3030'); p.px(9, 4, '#ffb830');
      p.r(7, 6, 3, 1, '#c89b3c');
      p.box(0, 6, 3, 7, BRASS); p.px(0, 13, '#b8c4d0'); p.px(2, 13, '#b8c4d0');
      p.r(13, 6, 2, 7, '#b8c4d0'); p.r(14, 6, 1, 7, '#e8f0f8');
    }
  };
  const miniCache = {};
  function miniImg(id) {
    if (miniCache[id]) return miniCache[id];
    const p = newPainter(16, 16);
    if (MINI[id]) MINI[id](p);
    else { p.ball(8, 8, 5, 5, '#4a3a5a'); p.px(6, 7, '#ff7a1a'); p.px(10, 7, '#ff7a1a'); p.r(6, 10, 4, 1, '#120e16'); }
    outline(p.c, OUTC);
    return (miniCache[id] = p.c);
  }
  function enemyMini(ctx, id, x, y, scale, t) {
    try {
      scale = scale || 1; t = t || 0;
      const img = miniImg(id);
      let ph = 0;
      for (let i = 0; i < String(id).length; i++) ph += String(id).charCodeAt(i);
      const bob = Math.sin(t * 4.5 + ph) > 0.3 ? -1 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(Math.round(x + 3 * scale), Math.round(y + 14 * scale), 10 * scale, scale);
      blit(ctx, img, x, y + bob * scale, scale);
    } catch (e) { /* ignore */ }
  }

  // ---- big combat sprites (48x48, boss 60x60), facing left, feet near the bottom row

  const BIG = {};
  BIG.homunculo = function (p) {
    const skin = '#d9a892', dk = '#c89a84';
    p.e(24, 45, 13, 1.5, '#3a0c14'); p.e(24, 45, 9, 1, '#5a1420');
    p.ball(19, 40, 3, 5, skin); p.ball(29, 40, 3, 5, skin);
    p.ball(19, 44, 4, 2, dk); p.ball(29, 44, 4, 2, dk);
    p.line(15, 31, 9, 37, dk, 2); p.ball(8, 38, 2.5, 2.5, skin);
    p.line(33, 31, 39, 36, dk, 2); p.ball(40, 37, 2.5, 2.5, skin);
    p.ball(24, 34, 9, 9, skin);
    p.line(24, 39, 29, 42, '#a3506a', 2); p.box(28, 41, 3, 3, BRASS);
    p.ball(11, 21, 2.5, 3.5, dk); p.ball(37, 21, 2.5, 3.5, dk);
    p.ball(24, 20, 13, 12, skin);
    p.ball(18, 21, 3.5, 4.5, EYEBLK); p.ball(30, 21, 4, 5, EYEBLK);
    p.px(17, 19, '#ffffff'); p.px(16, 20, '#ffffff'); p.px(29, 18, '#ffffff'); p.px(28, 19, '#ffffff'); p.px(30, 18, '#ffffff');
    p.px(19, 24, '#a3202a'); p.px(31, 25, '#a3202a');
    p.r(17, 28, 14, 1, '#4a1218');
    for (let x = 18; x <= 30; x += 2) p.r(x, 27, 1, 3, '#2a0a10');
    p.line(24, 9, 22, 14, '#a3202a'); p.line(22, 14, 19, 15, '#a3202a'); p.line(30, 10, 32, 15, '#a3202a');
    p.line(22, 8, 21, 5, '#6a4a3a'); p.line(25, 8, 26, 4, '#6a4a3a'); p.line(28, 9, 30, 6, '#6a4a3a');
  };

  BIG.quimera = function (p) {
    const tan = '#b08a5a';
    const path = [[37, 34], [41, 32], [43, 28], [43, 23], [41, 19], [39, 15], [40, 11], [42, 8]];
    path.forEach(function (s, i) { p.ball(s[0], s[1], 2.6, 2.6, i % 2 ? '#4a8a4a' : '#3a7040'); });
    p.ball(42, 6, 3, 2.6, '#4a8a4a'); p.px(43, 5, '#ff3030'); p.px(45, 7, '#e04848'); p.px(46, 7, '#e04848');
    p.r(22, 39, 4, 7, '#7a6040'); p.r(28, 39, 4, 7, '#7a6040');
    p.r(33, 37, 5, 9, '#5a4a3a'); p.r(32, 45, 7, 2, '#2a1a1a');
    p.ball(16, 40, 4, 5, '#c09a62'); p.ball(14, 45, 5, 2, '#d0aa72');
    p.ball(26, 31, 15, 10, tan);
    p.ball(26, 31, 15, 10, '#7a7a86', [34, 0, 48, 48]);
    p.ball(26, 31, 15, 10, '#5f7a4a', [21, 0, 28, 48]);
    p.ball(26, 31, 15, 10, '#8a4a4a', [12, 33, 19, 48]);
    p.line(34, 23, 34, 40, '#2a1a1a'); p.line(21, 24, 22, 41, '#2a1a1a'); p.line(19, 33, 19, 41, '#2a1a1a');
    for (let y = 25; y < 40; y += 3) { p.px(33, y, '#2a1a1a'); p.px(35, y, '#2a1a1a'); p.px(20, y, '#2a1a1a'); p.px(22, y, '#2a1a1a'); }
    for (let x = 22; x <= 38; x += 3) {
      const yt = Math.round(31 - 10 * Math.sqrt(Math.max(0, 1 - Math.pow((x - 26) / 15, 2))));
      p.line(x, yt, x + 1, yt - 4, '#5a3a2a');
    }
    p.ball(13, 25, 9, 10, '#8a4a1e');
    p.ball(9, 25, 7, 6, '#c09a62');
    p.ball(4, 28, 3.5, 3, '#d0aa72');
    p.r(1, 27, 2, 2, '#2a1418'); p.r(3, 31, 5, 1, '#2a1418'); p.r(4, 32, 1, 2, '#ffffff'); p.r(7, 32, 1, 2, '#ffffff');
    p.r(8, 22, 3, 2, '#ff3030'); p.px(8, 22, '#ffd0c0'); p.px(5, 24, '#ffe040');
    p.line(6, 20, 10, 27, '#2a1418');
    p.line(11, 19, 9, 13, '#d9ceb0', 2); p.line(9, 13, 12, 9, '#d9ceb0', 2);
    p.line(15, 19, 17, 12, '#d9ceb0', 2); p.line(17, 12, 20, 10, '#d9ceb0', 2);
    p.box(17, 27, 3, 3, BRASS); p.px(18, 28, '#f0d080');
  };

  BIG.golem = function (p) {
    const B = '#c89b3c', D = ['#2c1e08', '#7a5a1e', '#a07a2c', '#c89b3c'];
    p.box(14, 34, 8, 10, B, true); p.box(26, 34, 8, 10, B, true);
    p.box(12, 42, 11, 4, IRON); p.box(25, 42, 11, 4, IRON);
    p.r(19, 36, 1, 6, '#b8643a'); p.r(29, 36, 1, 6, '#b8643a');
    p.box(3, 17, 8, 17, D, true); p.box(37, 17, 8, 17, D, true);
    p.box(1, 32, 12, 10, IRON, true); p.box(35, 32, 12, 10, IRON, true);
    p.px(4, 35, '#c89b3c'); p.px(8, 35, '#c89b3c'); p.px(38, 35, '#c89b3c'); p.px(42, 35, '#c89b3c');
    p.ball(8, 17, 6, 5, B); p.ball(40, 17, 6, 5, B);
    p.box(11, 14, 26, 22, B, true);
    p.r(12, 33, 24, 1, D[1]);
    p.box(19, 18, 10, 11, ['#0d0a12', '#1a1208', '#2c2210', '#4a3a1c']);
    p.r(20, 20, 8, 8, '#ff7a1a'); p.r(21, 22, 6, 5, '#ffb830'); p.r(23, 24, 2, 3, '#fff0b0');
    p.r(22, 19, 1, 9, '#1a1208'); p.r(25, 19, 1, 9, '#1a1208');
    p.gear(24, 31, 3, 2, 6, 0.8, D);
    p.r(13, 18, 2, 14, '#b8643a'); p.r(13, 18, 1, 14, '#e0905a');
    p.r(33, 18, 2, 14, '#b8643a'); p.r(33, 18, 1, 14, '#e0905a');
    p.box(30, 1, 5, 5, IRON);
    p.px(31, 0, 'rgba(230,240,245,0.6)'); p.px(33, 0, 'rgba(230,240,245,0.5)');
    p.box(18, 3, 12, 11, B, true);
    p.r(20, 7, 8, 3, '#0d0a12'); p.r(22, 8, 4, 1, '#ffb830'); p.px(21, 8, '#ff7a1a'); p.px(26, 8, '#ff7a1a');
    p.line(15, 20, 17, 25, '#3a2a08'); p.line(17, 25, 16, 29, '#3a2a08');
    p.line(36, 22, 33, 26, '#3a2a08');
  };

  BIG.sanguijuela = function (p) {
    const pts = [[42, 45], [37, 45], [32, 44], [27, 42], [22, 38], [18, 32], [15, 26], [14, 20], [15, 14]];
    const path = [];
    for (let i = 0; i < pts.length - 1; i++) {
      for (let k = 0; k < 3; k++) {
        const f = k / 3;
        path.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]);
      }
    }
    path.push(pts[pts.length - 1]);
    const A = ['#1a0810', '#3a1420', '#5a1e2a', '#8a3040'], B = ['#2a0c18', '#4a1a28', '#6a2a38', '#9a4050'];
    p.e(30, 46, 16, 1.5, '#3a0c14');
    path.forEach(function (s, i) {
      const u = i / (path.length - 1);
      const r = 3 + 5 * Math.sin(Math.min(1, u * 1.25) * Math.PI * 0.55);
      p.ball(s[0], Math.min(s[1], 45 - r * 0.2), r, r, (i >> 1) % 2 ? A : B);
    });
    path.forEach(function (s, i) {
      if (i % 2) return;
      const u = i / (path.length - 1);
      const r = 3 + 5 * Math.sin(Math.min(1, u * 1.25) * Math.PI * 0.55);
      p.px(s[0] + r * 0.2, Math.min(s[1], 45 - r * 0.2) - r * 0.65, '#ff7a1a');
    });
    p.ball(11, 11, 8, 9, '#8a1a24');
    p.ball(10, 11, 5, 6, ['#0a0204', '#1a0408', '#2a0810', '#3a1018']);
    for (let a = 0; a < 10; a++) {
      const ang = a / 10 * Math.PI * 2;
      const tx = 10.5 + 5.6 * Math.cos(ang), ty = 11.5 + 6.6 * Math.sin(ang);
      p.px(tx, ty, '#f0e8d0'); p.px(tx, ty + 1, '#c8c0b0');
    }
    p.px(10, 11, '#a3202a'); p.px(9, 13, '#a3202a'); p.px(11, 9, '#a3202a');
    p.px(19, 6, '#c8c0b0'); p.px(21, 9, '#c8c0b0');
    p.r(9, 20, 1, 4, '#a3202a'); p.px(9, 25, '#e04848'); p.r(6, 22, 1, 3, '#a3202a');
  };

  BIG.alquimista = function (p) {
    const teal = ['#12282c', '#1f4a52', '#2f6a74', '#4a8a94'];
    for (let y = 20; y <= 45; y++) {
      const w = Math.round(16 + (y - 20) * 0.65), x0 = Math.round(24 - w / 2);
      for (let x = x0; x < x0 + w; x++) {
        if (y >= 43 && hash(x, y, 31) < 0.4) continue;
        const t = (x - x0) / w;
        p.px(x, y, t < 0.25 ? teal[2] : t > 0.75 ? teal[0] : teal[1]);
      }
    }
    p.line(20, 26, 17, 44, teal[0]); p.line(28, 26, 31, 44, teal[0]);
    for (let y = 27; y <= 44; y++) {
      const w = Math.round(9 + (y - 27) * 0.35), x0 = Math.round(24 - w / 2);
      p.r(x0, y, w, 1, '#b8a884'); p.px(x0, y, '#d8c8a0'); p.px(x0 + w - 1, y, '#8a7a5a');
      if (hash(y, 3, 41) < 0.3) p.px(x0 + 2 + (y % 4), y, '#7bd35a');
      if (hash(y, 7, 43) < 0.25) p.px(x0 + 1 + (y % 5), y, '#a3202a');
    }
    p.r(15, 31, 18, 2, '#5a3a1e'); p.r(23, 31, 2, 2, '#c89b3c');
    p.r(17, 33, 2, 4, '#7bd35a'); p.r(23, 34, 2, 4, '#e04848'); p.r(29, 33, 2, 4, '#4ab8ff');
    p.px(17, 33, '#ffffff'); p.px(23, 34, '#ffffff'); p.px(29, 33, '#ffffff');
    p.line(17, 24, 11, 27, teal[1], 3); p.ball(10, 28, 2.5, 2.5, '#d9b09a');
    p.r(7, 14, 3, 5, '#cfe6f0'); p.r(6, 12, 5, 3, '#8a5a2a'); p.px(6, 12, '#b8804a');
    p.ball(8, 22, 5, 5, GLASS); p.ball(8, 23, 4, 4, ICHOR);
    p.px(7, 20, '#c8ffc0'); p.px(9, 22, '#c8ffc0'); p.px(6, 24, '#c8ffc0');
    p.line(31, 24, 37, 28, teal[1], 3); p.ball(38, 29, 2.5, 2.5, '#d9b09a');
    p.r(38, 18, 3, 12, '#c89b3c'); p.r(38, 18, 1, 12, '#f0d080');
    p.ball(39, 16, 3, 3, STEEL); p.px(39, 14, '#7bd35a'); p.px(40, 13, '#c8ffc0');
    p.r(19, 19, 10, 2, teal[3]);
    p.ball(17, 13, 2, 3, '#e8e0d0'); p.ball(31, 13, 2, 3, '#e8e0d0');
    p.ball(24, 13, 7, 7, '#d9b09a');
    p.r(17, 12, 14, 2, '#4a2a1a');
    p.ball(21, 13, 3.6, 3.6, BRASS); p.ball(27, 13, 3.6, 3.6, BRASS);
    p.ball(21, 13, 2, 2, ICHOR); p.ball(27, 13, 2, 2, ICHOR);
    p.px(20, 12, '#ffffff'); p.px(26, 12, '#ffffff');
    p.px(24, 16, '#b88a76'); p.px(24, 17, '#b88a76');
    const bw = [8, 7, 5, 3, 1];
    bw.forEach(function (w, i) { p.r(24 - w / 2, 18 + i, w, 1, i < 2 ? '#c8c0b0' : '#a8a090'); });
    p.r(18, 45, 5, 2, '#2a1a1a'); p.r(26, 45, 5, 2, '#2a1a1a');
  };

  BIG.cirujano = function (p) {
    const coat = ['#78786c', '#a8a898', '#c8c8b8'];
    p.r(18, 34, 5, 11, '#2a3038'); p.r(26, 34, 5, 11, '#2a3038');
    p.r(18, 34, 1, 11, '#3a4450'); p.r(26, 34, 1, 11, '#3a4450');
    p.box(16, 43, 8, 4, ['#050308', '#15101a', '#2a2030', '#3a3040']); p.box(25, 43, 8, 4, ['#050308', '#15101a', '#2a2030', '#3a3040']);
    for (let y = 16; y <= 38; y++) {
      const w = Math.round(15 + (y - 16) * 0.25), x0 = Math.round(24.5 - w / 2);
      for (let x = x0; x < x0 + w; x++) {
        const t = (x - x0) / w;
        let col = t < 0.25 ? coat[2] : t > 0.75 ? coat[0] : coat[1];
        const sx = (x - 22) / 4.5, sy = (y - 30) / 5;
        if (sx * sx + sy * sy < 1) col = '#8a1a24';
        else if (hash(x, y, 51) < 0.07) col = hash(x, y, 52) > 0.5 ? '#a3202a' : '#6a1018';
        p.px(x, y, col);
      }
    }
    p.line(22, 17, 27, 27, '#78786c');
    p.gear(9, 20, 9, 7, 12, 2, STEEL, 0);
    p.px(3, 24, '#a3202a'); p.px(4, 27, '#a3202a'); p.px(7, 12, '#a3202a'); p.px(13, 28, '#6a1018');
    p.line(19, 21, 11, 22, coat[1], 4); p.ball(10, 22, 3, 3, '#cfc0b0');
    p.r(12, 28, 1, 4, '#a3202a'); p.px(12, 33, '#e04848');
    p.line(30, 20, 35, 32, coat[1], 4); p.ball(36, 33, 2.5, 2.5, '#cfc0b0');
    p.line(37, 33, 41, 27, '#e8f0f8'); p.px(41, 26, '#ffffff');
    p.r(18, 17, 14, 3, coat[1]);
    p.r(23, 15, 4, 3, '#b0a090');
    p.ball(25, 9, 6.5, 6.5, '#cfc0b0');
    p.ball(25, 9, 7, 7, '#3f7a6a', [0, 0, 48, 8]);
    p.r(20, 11, 11, 4, '#b8d8d0'); p.px(19, 12, '#b8d8d0'); p.px(31, 12, '#b8d8d0');
    p.line(18, 9, 19, 13, '#78786c'); p.line(32, 9, 31, 13, '#78786c');
    p.r(21, 9, 3, 2, '#f0e8e0'); p.r(26, 9, 3, 2, '#f0e8e0');
    p.px(22, 10, '#a3202a'); p.px(27, 10, '#a3202a');
    p.r(21, 8, 3, 1, '#120c10'); p.r(26, 8, 3, 1, '#120c10');
    p.r(19, 7, 13, 1, '#5a4216');
    p.ball(25, 4, 3, 3, BRASS); p.px(25, 4, '#fff4d0');
  };

  BIG.acolito = function (p) {
    const rb = ['#1c0a18', '#3a1430', '#5a2048', '#7a3060'];
    p.e(24, 45, 16, 2, '#6b3fa0'); p.e(24, 45, 14, 1, '#1a0d2a');
    p.px(14, 45, '#a070e0'); p.px(19, 46, '#a070e0'); p.px(29, 46, '#a070e0'); p.px(34, 45, '#a070e0');
    for (let y = 18; y <= 44; y++) {
      const w = Math.round(14 + (y - 18) * 0.62), x0 = Math.round(24 - w / 2);
      for (let x = x0; x < x0 + w; x++) {
        if (y >= 42 && hash(x, y, 61) < 0.4) continue;
        const t = (x - x0) / w;
        p.px(x, y, t < 0.22 ? rb[3] : t > 0.75 ? rb[0] : t > 0.5 ? rb[1] : rb[2]);
      }
    }
    p.r(23, 24, 3, 20, '#c89b3c'); p.r(23, 24, 1, 20, '#f0d080'); p.r(25, 24, 1, 20, '#7a5a1e');
    p.px(24, 30, '#a3202a'); p.px(24, 36, '#a3202a'); p.px(24, 41, '#a3202a');
    p.line(18, 22, 13, 33, rb[1], 5); p.ball(12, 35, 2.5, 2.5, '#d9b09a');
    p.ball(9, 37, 3, 3, '#e8dcc0'); p.px(8, 37, '#120c10'); p.px(10, 37, '#120c10'); p.px(9, 39, '#120c10');
    p.e(39, 6, 6, 7, 'rgba(123,211,90,0.25)');
    p.line(30, 22, 37, 14, rb[1], 5); p.ball(38, 12, 4, 3, rb[2]); p.ball(39, 10, 2, 2, '#d9b09a');
    p.r(38, 1, 3, 2, '#8a5a2a');
    p.ball(39, 6, 3, 4, GLASS); p.ball(39, 7, 2, 3, ICHOR);
    for (let y = 1; y <= 8; y++) {
      const w = Math.min(16, 2 + (y - 1) * 2), x0 = Math.round(24 - w / 2);
      p.r(x0, y, w, 1, y < 5 ? rb[1] : rb[0]);
    }
    p.ball(24, 15, 10, 9, [rb[0], '#2a0f26', '#3a1430', '#4a1a3c']);
    p.ball(24, 16, 6, 6, ['#000000', '#08050a', '#0e0812', '#160e1a']);
    p.r(21, 15, 3, 2, '#ff7a1a'); p.r(26, 15, 3, 2, '#ff7a1a');
    p.px(22, 15, '#ffe08a'); p.px(27, 15, '#ffe08a');
    p.line(21, 25, 24, 29, '#c89b3c'); p.line(27, 25, 24, 29, '#c89b3c');
    p.r(23, 29, 3, 3, '#e8dcc0'); p.px(23, 30, '#120c10'); p.px(25, 30, '#120c10');
  };

  BIG.rector = function (p) {
    const coat = ['#1a0a0e', '#3a1418', '#5a2028', '#7a303a'];
    const flesh = '#b8b8a0';
    p.box(12, 4, 5, 20, IRON, true); p.box(43, 4, 5, 20, IRON, true);
    p.r(11, 2, 7, 3, '#c89b3c'); p.r(42, 2, 7, 3, '#c89b3c');
    p.px(14, 1, '#ff7a1a'); p.px(45, 1, '#ff7a1a'); p.px(13, 0, '#ffb830');
    p.r(20, 44, 8, 14, '#1c1418'); p.r(32, 44, 8, 14, '#1c1418');
    p.r(20, 44, 1, 14, '#3a2c34'); p.r(32, 44, 1, 14, '#3a2c34');
    p.box(17, 54, 12, 5, ['#0a0608', '#1c1418', '#3a2c34', '#5a4a54']); p.box(31, 54, 12, 5, ['#0a0608', '#1c1418', '#3a2c34', '#5a4a54']);
    p.r(17, 56, 3, 3, '#c89b3c'); p.r(40, 56, 3, 3, '#c89b3c');
    for (let y = 20; y <= 56; y++) {
      const w = Math.round(26 + (y - 20) * 0.35), x0 = Math.round(30 - w / 2);
      for (let x = x0; x < x0 + w; x++) {
        if (y >= 54 && hash(x, y, 71) < 0.4) continue;
        const t = (x - x0) / w;
        p.px(x, y, t < 0.2 ? coat[3] : t > 0.78 ? coat[0] : t > 0.5 ? coat[1] : coat[2]);
      }
    }
    p.line(24, 21, 28, 36, coat[0], 3); p.line(36, 21, 32, 36, coat[0], 3);
    const stains = [[26, 44, 4, 6], [34, 50, 5, 5], [30, 38, 3, 3]];
    for (let y = 32; y <= 57; y++) {
      const w = Math.round(12 + (y - 32) * 0.24), x0 = Math.round(30 - w / 2);
      for (let x = x0; x < x0 + w; x++) {
        let col = x === x0 ? '#e8dcc0' : x === x0 + w - 1 ? '#988c6c' : '#c8bda0';
        for (let s = 0; s < stains.length; s++) {
          const dx = (x - stains[s][0]) / stains[s][2], dy = (y - stains[s][1]) / stains[s][3];
          if (dx * dx + dy * dy < 1) col = dx * dx + dy * dy < 0.4 ? '#7a1018' : '#a3202a';
        }
        if (hash(x, y, 73) < 0.05) col = '#a3202a';
        p.px(x, y, col);
      }
    }
    p.ball(30, 28, 6, 6, BRASS);
    p.ball(30, 28, 4.5, 4.5, ['#c8bda0', '#e8dcc0', '#f4ecd8', '#ffffff']);
    p.line(30, 28, 30, 25, '#120c10'); p.line(30, 28, 33, 29, '#a3202a'); p.px(30, 28, '#120c10');
    p.px(30, 24, '#120c10'); p.px(34, 28, '#120c10'); p.px(30, 32, '#120c10'); p.px(26, 28, '#120c10');
    for (let i = 0; i < 14; i++) {
      const u = i / 13;
      const cx = 17 + 26 * u, cy = 24 + 10 * Math.sin(u * Math.PI);
      if (i % 2 === 0) p.px(cx, cy, '#8a98a8'); else p.px(cx, cy + 1, '#4a5563');
    }
    // mechanical left arm
    p.box(4, 24, 9, 12, BRASS, true); p.r(8, 26, 1, 9, '#6c7a89');
    p.box(3, 35, 11, 12, ['#3a2a08', '#7a5a1e', '#a07a2c', '#c89b3c'], true);
    p.gear(8, 35, 5, 3.5, 8, 1.5, BRASS);
    p.line(6, 47, 3, 56, STEEL[2], 2); p.line(11, 47, 13, 56, STEEL[2], 2);
    p.px(3, 57, '#ffffff'); p.px(13, 57, '#ffffff');
    p.r(13, 28, 4, 1, '#b8643a'); p.r(13, 29, 1, 3, '#b8643a');
    p.ball(15, 23, 6, 5, BRASS); p.ball(45, 23, 6, 5, BRASS);
    p.line(12, 19, 11, 14, '#c89b3c', 2); p.line(16, 18, 16, 12, '#c89b3c', 2);
    p.line(48, 19, 49, 14, '#c89b3c', 2); p.line(44, 18, 44, 12, '#c89b3c', 2);
    // cleaver arm
    p.line(48, 26, 52, 40, coat[1], 7); p.ball(53, 42, 3.5, 3.5, flesh);
    p.r(52, 40, 3, 5, '#5a3a1e');
    p.box(46, 45, 12, 12, STEEL);
    p.r(47, 53, 10, 3, '#a3202a'); p.r(49, 56, 1, 2, '#a3202a'); p.r(54, 56, 1, 2, '#e04848');
    // head
    p.ball(30, 14, 9, 10, flesh);
    p.box(21, 3, 18, 6, ['#050308', '#15101a', '#2a2030', '#3a3040']);
    p.r(19, 8, 22, 2, '#15101a');
    p.line(39, 4, 42, 10, '#c89b3c'); p.ball(42, 11, 1.6, 1.6, BRASS);
    p.r(23, 10, 7, 1, '#120c10'); p.r(33, 10, 5, 1, '#120c10');
    p.r(25, 12, 3, 3, '#ff3030'); p.px(25, 12, '#ffd0c0'); p.px(24, 13, '#ff8070');
    p.ball(35, 13, 4.5, 4.5, BRASS); p.ball(35, 13, 3, 3, ['#1a1208', '#3a2a08', '#ffb830', '#fff0b0']);
    p.line(39, 15, 41, 24, '#c89b3c');
    p.line(23, 11, 25, 17, '#7a4a4a');
    p.box(23, 18, 14, 6, BRASS);
    for (let x = 25; x < 36; x += 2) p.r(x, 20, 1, 3, '#120c04');
    p.r(27, 24, 2, 3, '#b8643a'); p.r(32, 24, 2, 3, '#b8643a');
  };

  function bigSize(id) { return id === 'rector' ? 60 : 48; }
  const bigCache = {}, noiseCache = {};
  function bigImg(id) {
    if (bigCache[id]) return bigCache[id];
    const n = bigSize(id);
    const p = newPainter(n, n);
    if (BIG[id]) BIG[id](p);
    else {
      // unknown enemy: a brooding shadow with ember eyes
      p.e(24, 45, 12, 1.5, '#1a0d24');
      p.ball(24, 30, 14, 15, ['#0d0714', '#1c1226', '#2c1e3c', '#42305a']);
      p.ball(24, 40, 12, 6, ['#0d0714', '#1c1226', '#2c1e3c', '#42305a']);
      p.r(17, 26, 5, 4, '#ff7a1a'); p.r(27, 26, 5, 4, '#ff7a1a'); p.px(18, 26, '#ffe08a'); p.px(28, 26, '#ffe08a');
      p.r(19, 35, 11, 2, '#0d0714');
    }
    outline(p.c, OUTC);
    return (bigCache[id] = p.c);
  }

  const enemyTmp = mkCanvas(64, 64), enemyTmpG = enemyTmp.getContext('2d');
  const srcDataCache = {};
  function dissolveImg(id, img, dead) {
    const w = img.width, h = img.height;
    if (!srcDataCache[id]) srcDataCache[id] = img.getContext('2d').getImageData(0, 0, w, h);
    const src = srcDataCache[id];
    const out = enemyTmpG.createImageData(w, h);
    const s = src.data, d = out.data;
    const th = dead * 1.35 - 0.15;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (s[i + 3] === 0) continue;
        const score = hash(x, y, 91) * 0.62 + (y / h) * 0.38;
        if (score < th) continue;
        if (score < th + 0.1) { d[i] = 255; d[i + 1] = 122; d[i + 2] = 26; d[i + 3] = 255; }
        else if (score < th + 0.18) { d[i] = 90; d[i + 1] = 40; d[i + 2] = 30; d[i + 3] = 255; }
        else { d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = s[i + 3]; }
      }
    }
    enemyTmpG.clearRect(0, 0, 64, 64);
    enemyTmpG.putImageData(out, 0, 0);
    return enemyTmp;
  }

  function enemy(ctx, id, x, y, scale, t, opts) {
    try {
      opts = opts || {};
      scale = scale || 1; t = t || 0;
      const img = bigImg(id), w = img.width, h = img.height;
      const dead = Math.max(0, Math.min(1, opts.dead || 0));
      const hurt = Math.max(0, Math.min(1, opts.hurt || 0));
      let px = x - (w * scale) / 2, py = y - h * scale;
      let src = img, srcH = h;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (dead > 0) {
        src = dissolveImg(id, img, dead);
        py += Math.round(dead * 3) * scale;
        ctx.globalAlpha = 1 - dead * 0.35;
        ctx.drawImage(src, 0, 0, w, h, Math.round(px), Math.round(py), w * scale, h * scale);
      } else {
        if (hurt > 0) {
          const g = enemyTmpG;
          g.globalCompositeOperation = 'source-over';
          g.clearRect(0, 0, 64, 64);
          g.drawImage(img, 0, 0);
          g.globalCompositeOperation = 'source-atop';
          g.fillStyle = hurt > 0.55 ? '#ffffff' : '#ff3a2a';
          g.globalAlpha = Math.min(0.78, hurt * 1.1);
          g.fillRect(0, 0, w, h);
          g.globalAlpha = 1;
          g.globalCompositeOperation = 'source-over';
          src = enemyTmp;
          px += Math.round(Math.sin(t * 90) * 2 * hurt) * scale;
        }
        let ph = 0;
        for (let i = 0; i < String(id).length; i++) ph += String(id).charCodeAt(i);
        const boss = id === 'rector';
        const b = Math.sin(t * (boss ? 1.6 : 2.4) + ph) > (boss ? 0.35 : 0.1) ? 1 : 0;
        const split = Math.floor(h * 0.55);
        // lower body (overlaps one row into the upper body), then the breathing upper body
        ctx.drawImage(src, 0, split - 1, w, h - split + 1, Math.round(px), Math.round(py + (split - 1) * scale), w * scale, (h - split + 1) * scale);
        ctx.drawImage(src, 0, 0, w, split, Math.round(px), Math.round(py - b * scale), w * scale, split * scale);
      }
      ctx.restore();
    } catch (e) { /* ignore */ }
  }
  function enemySize(id) { const n = bigSize(id); return { w: n, h: n }; }

  // ================================================================= BACKGROUNDS
  // Static layers are painted once at 320x180 and blitted at 2x; the animated parts
  // (window fire, embers, flames, lamp flicker, clock hands) are drawn per frame at 640x360.
  const BGW = 320, BGH = 180;
  const bgLayers = {};
  const EMBER_COLS = ['#ff7a1a', '#ffb830', '#ff4a1a', '#ffd868'];

  function brickWall(p, x, y, w, h, tones, mortar, seed) {
    p.r(x, y, w, h, mortar);
    for (let row = 0; row * 8 < h; row++) {
      const oy = y + row * 8, off = (row % 2) * 8;
      const hh = Math.min(7, y + h - oy - 1);
      if (hh <= 0) continue;
      for (let bx = -16; bx < w; bx += 16) {
        const x0 = x + bx + off, wx0 = Math.max(x, x0 + 1), wx1 = Math.min(x + w, x0 + 16);
        if (wx1 <= wx0) continue;
        const tone = tones[Math.floor(hash(bx + off, row, seed) * tones.length)];
        p.r(wx0, oy + 1, wx1 - wx0, hh, tone);
        p.r(wx0, oy + 1, wx1 - wx0, 1, shade(tone, 0.12));
        p.r(wx0, oy + hh, wx1 - wx0, 1, shade(tone, -0.2));
        if (hash(bx, row, seed + 1) < 0.3) p.px(wx0 + Math.floor(hash(bx, row, seed + 2) * 10), oy + 3, shade(tone, -0.3));
      }
    }
  }
  function hpipe(p, x, y, w, th) {
    p.r(x, y, w, th, '#7a5a1e'); p.r(x, y, w, 1, '#f0d080'); p.r(x, y + 1, w, 1, '#c89b3c'); p.r(x, y + th - 1, w, 1, '#3d2a0c');
    for (let fx = x + 10; fx < x + w - 4; fx += 52) {
      p.r(fx, y - 2, 4, th + 4, '#a07a2c'); p.r(fx, y - 2, 4, 1, '#f0d080'); p.r(fx, y + th + 1, 4, 1, '#3d2a0c');
    }
  }
  function vpipe(p, x, y, h, th) {
    p.r(x, y, th, h, '#7a5a1e'); p.r(x, y, 1, h, '#f0d080'); p.r(x + 1, y, 1, h, '#c89b3c'); p.r(x + th - 1, y, 1, h, '#3d2a0c');
    for (let fy = y + 14; fy < y + h - 4; fy += 40) {
      p.r(x - 2, fy, th + 4, 4, '#a07a2c'); p.r(x - 2, fy, th + 4, 1, '#f0d080'); p.r(x - 2, fy + 4, th + 4, 1, '#3d2a0c');
    }
  }
  function gauge(p, cx, cy, r) {
    p.ball(cx, cy, r, r, BRASS);
    p.ball(cx, cy, r - 2, r - 2, ['#c8bda0', '#e8dcc0', '#f4ecd8', '#ffffff']);
    p.line(cx, cy, cx + r - 3, cy - 2, '#a3202a'); p.px(cx, cy, '#120c10');
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (0.8 + i * 0.28);
      p.px(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3), '#3a2a18');
    }
  }
  function valveWheel(p, cx, cy, r) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
        if (d <= r && d >= r - 1.6) p.px(x, y, '#a3202a');
      }
    }
    p.r(cx - r, cy, r * 2, 1, '#7a1018'); p.r(cx, cy - r, 1, r * 2, '#7a1018');
    p.r(cx - 1, cy - 1, 3, 3, '#c89b3c');
  }
  function column(p, x, w, y0, y1) {
    p.r(x, y0, w, y1 - y0, '#2e2538');
    p.r(x, y0, 2, y1 - y0, '#41364e'); p.r(x + w - 3, y0, 3, y1 - y0, '#17111d');
    for (let fx = x + 6; fx < x + w - 4; fx += 6) p.r(fx, y0, 1, y1 - y0, '#231b2d');
    [22, 64, 104].forEach(function (by) {
      p.r(x - 2, by, w + 4, 4, '#a07a2c'); p.r(x - 2, by, w + 4, 1, '#f0d080'); p.r(x - 2, by + 3, w + 4, 1, '#3d2a0c');
      p.px(x, by + 1, '#f0d080'); p.px(x + w - 1, by + 1, '#f0d080');
    });
    p.r(x - 3, y0, w + 6, 6, '#41364e'); p.r(x - 3, y0, w + 6, 1, '#5a4c6a');
    p.r(x - 3, y1 - 8, w + 6, 8, '#3a3046'); p.r(x - 3, y1 - 8, w + 6, 1, '#5a4c6a');
  }
  function jarBg(p, x, y, fluid) {
    p.r(x, y, 7, 11, '#8fd8c8'); p.r(x + 1, y + 1, 5, 9, fluid);
    p.r(x, y - 2, 7, 2, '#c89b3c'); p.r(x, y - 2, 7, 1, '#f0d080');
    p.r(x + 2, y + 4, 3, 4, '#c8908a'); p.px(x + 1, y + 2, '#c8ffe8'); p.px(x + 1, y + 3, '#c8ffe8');
  }
  function shelf(p, x, y, w, seed) {
    p.r(x, y, w, 3, '#4a3420'); p.r(x, y, w, 1, '#6a4c30'); p.r(x, y + 2, w, 1, '#2a1c10');
    p.r(x + 3, y + 3, 2, 5, '#7a5a1e'); p.r(x + w - 5, y + 3, 2, 5, '#7a5a1e');
    const fl = ['#1f5a4a', '#4a1a2a', '#1a3a5a', '#3a4a1a'];
    let cx = x + 5, i = 0;
    while (cx < x + w - 10) {
      if (hash(i, seed, 5) < 0.6) { jarBg(p, cx, y - 11, fl[Math.floor(hash(i, seed, 6) * 4)]); cx += 10; }
      else {
        const col = fl[Math.floor(hash(i, seed, 7) * 4)];
        p.r(cx, y - 7, 4, 7, '#dfeef5'); p.r(cx + 1, y - 6, 2, 5, col === '#1f5a4a' ? '#7bd35a' : col === '#1a3a5a' ? '#4ab8ff' : '#e04848');
        p.r(cx + 1, y - 9, 2, 2, '#8a5a2a'); cx += 7;
      }
      i++;
    }
  }
  function chain(p, x, y0, y1) {
    for (let y = y0; y < y1; y += 3) {
      const a = ((y - y0) / 3) % 2;
      p.r(x + a, y, 2, 2, '#6c7a89'); p.px(x + a, y, '#b8c4d0');
      p.r(x + 1 - a, y + 1, 1, 2, '#3a4450');
    }
    p.r(x - 1, y1, 4, 1, '#6c7a89'); p.px(x - 1, y1 + 1, '#6c7a89'); p.px(x + 2, y1 + 1, '#6c7a89'); p.px(x, y1 + 2, '#6c7a89'); p.px(x + 1, y1 + 2, '#6c7a89');
  }
  function archTest(cx, top, halfW, bottom, x, y) {
    if (y < top || y >= bottom) return false;
    const cy = top + halfW;
    if (y >= cy) return Math.abs(x + 0.5 - cx) <= halfW;
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    return dx * dx + dy * dy <= halfW * halfW;
  }
  function archFill(p, cx, top, halfW, bottom, col) {
    for (let y = top; y < bottom; y++) for (let x = cx - halfW; x <= cx + halfW; x++) if (archTest(cx, top, halfW, bottom, x, y)) p.px(x, y, col);
  }
  function archClear(p, cx, top, halfW, bottom) {
    for (let y = top; y < bottom; y++) for (let x = cx - halfW; x <= cx + halfW; x++) if (archTest(cx, top, halfW, bottom, x, y)) p.g.clearRect(x, y, 1, 1);
  }
  function vignette(p, cx, cy, r0, r1, a) {
    const gr = p.g.createRadialGradient(cx, cy, r0, cx, cy, r1);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,' + a + ')');
    p.g.fillStyle = gr; p.g.fillRect(0, 0, BGW, BGH);
  }

  function buildLab() {
    const p = newPainter(BGW, BGH);
    brickWall(p, 0, 0, 320, 126, ['#211a2b', '#261e32', '#1d1725', '#2b2238'], '#0f0b14', 3);
    p.r(0, 126, 320, 54, '#1a1520');
    const ys = [126, 131, 138, 147, 159, 174];
    ys.forEach(function (y) { p.r(0, y, 320, 1, '#0f0b14'); p.r(0, y + 1, 320, 1, '#261e30'); });
    for (let i = -10; i <= 10; i++) p.line(160 + i * 7, 126, 160 + i * 36, 179, '#0f0b14');
    p.r(0, 126, 320, 2, '#3a2e48');
    // pillars
    column(p, 6, 22, 0, 126); column(p, 292, 22, 0, 126);
    // shelves with jars
    shelf(p, 40, 96, 78, 1); shelf(p, 46, 66, 66, 2); shelf(p, 202, 96, 78, 3); shelf(p, 208, 66, 66, 4);
    // chains
    chain(p, 128, 14, 70); chain(p, 190, 14, 58); chain(p, 100, 14, 40);
    // arched window
    archFill(p, 160, 14, 36, 100, '#2a2234');
    archFill(p, 160, 16, 33, 100, '#41364e');
    archFill(p, 160, 18, 30, 100, '#17111d');
    archClear(p, 160, 18, 30, 98);
    p.r(126, 98, 68, 4, '#4a3e5a'); p.r(126, 98, 68, 1, '#6a5c7a'); p.r(124, 102, 72, 3, '#2a2234');
    p.r(159, 18, 2, 80, '#7a5a1e'); p.r(159, 18, 1, 80, '#f0d080');
    p.r(130, 60, 60, 2, '#7a5a1e'); p.r(130, 60, 60, 1, '#c89b3c');
    p.r(134, 80, 52, 2, '#7a5a1e');
    // pipes and gauges (drawn over the wall, under the vignette)
    hpipe(p, 0, 8, 320, 6);
    vpipe(p, 52, 14, 112, 5); valveWheel(p, 54, 74, 6); gauge(p, 88, 46, 8);
    vpipe(p, 262, 14, 112, 5); gauge(p, 234, 46, 8); valveWheel(p, 264, 50, 5);
    // floor puddle sheen and grate
    p.r(140, 140, 40, 1, '#31283f'); p.r(146, 150, 28, 1, '#2a2236');
    vignette(p, 160, 90, 60, 200, 0.6);
    return p.c;
  }

  function tank(p, x, y, w, h, kind) {
    p.box(x - 3, y - 3, w + 6, h + 6, BRASS, true);
    for (let j = 0; j < h; j++) {
      const f = j / h;
      p.r(x, y + j, w, 1, mix('#1b6a54', '#0a2a22', f));
    }
    p.r(x + 2, y + 2, 1, h - 4, 'rgba(200,255,232,0.35)');
    p.r(x + w - 4, y + 4, 1, h - 8, 'rgba(200,255,232,0.15)');
    const cx = x + (w >> 1);
    const flesh = ['#7a4a44', '#b88a7a', '#d9a892', '#efc8b0'];
    if (kind === 0) {
      p.ball(cx, y + 24, 9, 10, flesh);
      p.r(cx - 5, y + 22, 3, 1, '#2a1418'); p.r(cx + 2, y + 22, 3, 1, '#2a1418'); p.r(cx - 3, y + 30, 6, 1, '#4a1218');
      p.line(cx - 3, y + 34, cx - 5, y + 44, '#a3202a'); p.line(cx + 2, y + 34, cx + 3, y + 46, '#a3202a');
    } else if (kind === 1) {
      p.ball(cx, y + 30, 4, 20, flesh); p.ball(cx, y + 52, 6, 5, flesh);
      for (let i = 0; i < 4; i++) p.px(cx - 5 + i * 3, y + 56, '#efc8b0');
    } else {
      p.ball(cx, y + 26, 5, 22, flesh); p.ball(cx + 2, y + 50, 8, 4, flesh);
      p.r(cx - 1, y + 20, 2, 12, '#8a3a3a');
    }
    p.r(x - 5, y + h + 3, w + 10, 5, '#7a5a1e'); p.r(x - 5, y + h + 3, w + 10, 1, '#f0d080');
    p.r(cx - 2, y + h + 8, 4, 3, '#c89b3c');
    p.r(x - 5, y - 8, w + 10, 5, '#7a5a1e'); p.r(x - 5, y - 8, w + 10, 1, '#f0d080');
  }
  const TABLE_TANKS = [[24, 34, 40, 62, 0], [140, 34, 40, 62, 1], [256, 34, 40, 62, 2]];

  function buildTable() {
    const p = newPainter(BGW, BGH);
    brickWall(p, 0, 0, 320, 122, ['#1a2026', '#1e262c', '#171d22', '#222b32'], '#0c1014', 7);
    p.r(0, 122, 320, 58, '#1a1520');
    const rows = [122, 127, 135, 146, 160, 180];
    for (let r = 0; r < rows.length - 1; r++) {
      const cw = 14 + r * 8, off = (r % 2) * (cw >> 1);
      for (let x = -cw; x < 320; x += cw) {
        const dark = (Math.floor((x + cw) / cw) + r) % 2 === 0;
        p.r(Math.max(0, x + off), rows[r], cw, rows[r + 1] - rows[r], dark ? '#1c1723' : '#241e2e');
      }
      p.r(0, rows[r], 320, 1, '#0d0a12');
    }
    p.r(0, 122, 320, 2, '#33293f');
    hpipe(p, 0, 4, 320, 5);
    vpipe(p, 8, 9, 113, 4); vpipe(p, 308, 9, 113, 4);
    gauge(p, 84, 24, 7); gauge(p, 236, 24, 7);
    TABLE_TANKS.forEach(function (t) { tank(p, t[0], t[1], t[2], t[3], t[4]); });
    // wall clock-eye above the table
    p.ball(160, 18, 5, 5, BRASS); p.px(160, 18, '#a3202a');
    // lamp
    p.r(159, 9, 2, 20, '#3a4450'); p.r(159, 9, 1, 20, '#8a98a8');
    for (let y = 28; y < 40; y++) {
      const w = 6 + (y - 28) * 3;
      p.r(160 - w, y, w * 2, 1, y < 30 ? '#f0d080' : y < 37 ? '#c89b3c' : '#7a5a1e');
    }
    p.r(120, 39, 80, 2, '#3d2a0c');
    p.e(160, 43, 10, 3, '#fff0b0'); p.e(160, 43, 6, 2, '#ffffff');
    // dissection table
    p.r(96, 128, 128, 9, '#8a98a8'); p.r(96, 128, 128, 2, '#d8e4ee'); p.r(96, 135, 128, 2, '#4a5563');
    p.r(100, 137, 120, 12, '#3a4450'); p.r(100, 137, 120, 1, '#6c7a89'); p.r(100, 148, 120, 1, '#1a2028');
    [124, 160, 196].forEach(function (x) { p.r(x, 126, 6, 13, '#3a2418'); p.r(x, 126, 6, 1, '#5a3a28'); p.px(x + 2, 132, '#c89b3c'); });
    p.r(112, 129, 96, 1, '#5a1420'); p.r(208, 129, 4, 1, '#5a1420'); p.r(212, 129, 1, 8, '#5a1420');
    p.r(104, 149, 8, 26, '#7a5a1e'); p.r(104, 149, 2, 26, '#f0d080'); p.r(208, 149, 8, 26, '#7a5a1e'); p.r(208, 149, 2, 26, '#f0d080');
    p.r(104, 168, 112, 3, '#7a5a1e'); p.r(104, 168, 112, 1, '#c89b3c');
    p.gear(160, 169, 6, 4, 8, 1.5, BRASS);
    p.r(96, 175, 24, 5, '#241a08'); p.r(200, 175, 24, 5, '#241a08');
    // blood bucket
    p.box(226, 156, 12, 16, ['#1a2028', '#3a4450', '#6c7a89', '#8a98a8']); p.r(227, 158, 10, 2, '#7a1018');
    p.r(212, 137, 1, 20, '#7a1018'); p.px(212, 157, '#a3202a');
    // instrument tray
    p.r(252, 138, 44, 3, '#3a4450'); p.r(252, 138, 44, 1, '#8a98a8'); p.r(256, 141, 2, 30, '#7a5a1e'); p.r(290, 141, 2, 30, '#7a5a1e');
    p.r(252, 128, 44, 3, '#6c7a89'); p.r(252, 128, 44, 1, '#b8c4d0');
    for (let i = 0; i < 6; i++) { p.r(256 + i * 7, 122, 1, 6, '#c8d4e0'); p.px(256 + i * 7, 121, '#ffffff'); }
    p.r(254, 131, 8, 6, '#dfeef5'); p.r(255, 132, 6, 4, '#7bd35a');
    vignette(p, 160, 96, 70, 210, 0.62);
    return p.c;
  }

  function buildTitle() {
    const p = newPainter(BGW, BGH);
    const bands = ['#07050c', '#0d0714', '#150a1e', '#1f0c26', '#2e102c', '#4a1428', '#6e1a20', '#a02a14', '#d0480e'];
    const bh = 16;
    for (let i = 0; i < bands.length; i++) p.r(0, i * bh, 320, bh, bands[i]);
    for (let i = 1; i < bands.length; i++) {
      for (let x = 0; x < 320; x++) {
        for (let k = 0; k < 4; k++) {
          const y = i * bh - 4 + k;
          const thr = (k + 1) / 5;
          if (((x * 7 + k * 13) % 8) / 8 < thr) p.px(x, y, bands[i]);
        }
      }
    }
    for (let i = 0; i < 60; i++) {
      p.px(hash(i, 1, 81) * 320, hash(i, 2, 81) * 80, hash(i, 3, 81) > 0.7 ? '#e8dcc0' : '#6a607a');
    }
    // moon with halo
    p.e(250, 44, 36, 36, 'rgba(255,214,170,0.05)'); p.e(250, 44, 30, 30, 'rgba(255,214,170,0.07)'); p.e(250, 44, 26, 26, 'rgba(255,214,170,0.10)');
    p.ball(250, 44, 22, 22, ['#a89878', '#d8ccb0', '#f2e8d0', '#fffaf0']);
    [[243, 38, 5], [256, 50, 4], [252, 33, 3], [240, 52, 3], [262, 40, 3]].forEach(function (c) { p.ball(c[0], c[1], c[2], c[2], ['#8a7a5a', '#b8a888', '#c8b898', '#d8ccb0']); });
    // cloud streaks
    for (let k = 0; k < 9; k++) {
      const y = 22 + k * 8, x = 160 + hash(k, 1, 82) * 120, w = 30 + hash(k, 2, 82) * 60;
      p.r(x, y, w, 2, 'rgba(24,10,32,0.6)');
    }
    // far hills
    for (let x = 0; x < 320; x++) {
      const y = Math.round(136 + 5 * Math.sin(x * 0.04) + 3 * Math.sin(x * 0.13 + 1));
      p.r(x, y, 1, 180 - y, '#170a1a');
    }
    // secondary towers
    p.r(40, 92, 18, 60, '#100915'); for (let y = 76; y < 92; y++) { const w = (y - 76) * 18 / 16 + 1; p.r(49 - w / 2, y, w, 1, '#100915'); }
    p.r(170, 106, 22, 46, '#100915'); [0, 4, 8, 12, 16].forEach(function (o, i) { p.r(170 + o, 100 - (i % 2) * 5, 4, 8, '#100915'); });
    p.r(275, 116, 14, 36, '#100915'); p.r(277, 110, 10, 6, '#100915');
    // main tower
    const TC = '#0e0812';
    for (let y = 12; y < 60; y++) { const w = 2 + (y - 12) * 28 / 48; p.r(Math.round(112 - w / 2), y, Math.round(w), 1, TC); }
    p.r(98, 60, 28, 90, TC);
    for (let y = 118; y < 150; y++) { const e = Math.round((y - 118) * 0.5); p.r(98 - e, y, 28 + e * 2, 1, TC); }
    [[92, 44], [124, 44]].forEach(function (t) {
      p.r(t[0], t[1], 8, 26, TC);
      for (let y = 30; y < 44; y++) { const w = (y - 30) * 8 / 14 + 1; p.r(t[0] + 4 - w / 2, y, w, 1, TC); }
    });
    for (let x = 98; x < 126; x += 5) p.r(x, 56, 3, 4, TC);
    p.line(98, 90, 86, 132, TC, 3); p.line(126, 90, 138, 132, TC, 3);
    p.line(98, 70, 90, 100, TC, 2); p.line(126, 70, 134, 100, TC, 2);
    p.r(98, 60, 1, 60, '#2a1420'); p.r(125, 60, 1, 60, '#4a2418'); p.r(111, 12, 1, 48, '#241018');
    // windows (dark; glow is animated)
    TITLE_WINDOWS.forEach(function (w) { p.r(w[0], w[1] + 2, 4, 6, '#050308'); p.r(w[0] + 1, w[1], 2, 2, '#050308'); });
    // anatomical clock
    p.ball(112, 72, 13, 13, BRASS);
    p.ball(112, 72, 10, 10, ['#0e0a10', '#1a1218', '#2a2028', '#3a3038']);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      p.px(112 + Math.cos(a) * 8.5, 72 + Math.sin(a) * 8.5, i % 3 === 0 ? '#ffe08a' : '#c8bda0');
    }
    p.r(111, 71, 2, 2, '#c89b3c');
    // ground + foreground silhouettes
    for (let x = 0; x < 320; x++) {
      const y = Math.round(152 + 2 * Math.sin(x * 0.09) + 2 * Math.sin(x * 0.31));
      p.r(x, y, 1, 180 - y, '#07040a');
    }
    [[14, 160], [302, 158]].forEach(function (t) {
      p.r(t[0], t[1] - 44, 3, 44, '#07040a');
      p.line(t[0] + 1, t[1] - 30, t[0] - 12, t[1] - 52, '#07040a', 2); p.line(t[0] + 1, t[1] - 38, t[0] + 12, t[1] - 58, '#07040a', 2);
      p.line(t[0] - 8, t[1] - 46, t[0] - 16, t[1] - 44, '#07040a'); p.line(t[0] + 8, t[1] - 52, t[0] + 16, t[1] - 50, '#07040a');
    });
    for (let x = 60; x < 240; x += 9) p.r(x, 149 + (x % 3), 2, 8, '#07040a');
    vignette(p, 160, 90, 90, 220, 0.5);
    return p.c;
  }
  const TITLE_WINDOWS = [[104, 94], [116, 94], [104, 108], [116, 108], [104, 122], [116, 122], [106, 46], [126, 50]];

  // ---- animated overlays (640x360 coordinates)
  function embers(ctx, t, count, seed, speedMul) {
    for (let i = 0; i < count; i++) {
      const sp = (14 + hash(i, 1, seed) * 26) * (speedMul || 1);
      const y = 360 - ((t * sp + hash(i, 3, seed) * 400) % 400);
      const x = hash(i, 2, seed) * 640 + Math.sin(t * 0.8 + i * 1.3) * 12;
      const a = Math.max(0, Math.min(1, (y / 360) * 1.3));
      ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(t * 5 + i));
      ctx.fillStyle = EMBER_COLS[i % 4];
      const s = hash(i, 4, seed) > 0.8 ? 4 : 2;
      ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, s, s);
    }
    ctx.globalAlpha = 1;
  }
  function flame(ctx, x, y, w, h, t, seed) {
    for (let c = 0; c < w; c += 4) {
      const u = c / w;
      const env = 1 - Math.abs(u - 0.5) * 1.5;
      const hh = Math.max(4, h * env * (0.55 + 0.45 * Math.abs(Math.sin(t * 6 + c * 0.7 + seed))));
      ctx.fillStyle = '#c8340e'; ctx.fillRect(x + c, Math.round(y - hh), 4, Math.round(hh));
      ctx.fillStyle = '#ff7a1a'; ctx.fillRect(x + c, Math.round(y - hh * 0.72), 4, Math.round(hh * 0.72));
      ctx.fillStyle = '#ffb830'; ctx.fillRect(x + c + (c % 8 ? 0 : 1), Math.round(y - hh * 0.42), 3, Math.round(hh * 0.42));
    }
  }
  function windowFire(ctx, t) {
    // fiery sky seen through the lab's arched window (centre 320, top 36, half-width 60, bottom 196)
    const cx = 320, top = 36, hw = 60, bottom = 196;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - hw - 2, bottom + 2);
    ctx.lineTo(cx - hw - 2, top + hw);
    ctx.arc(cx, top + hw, hw + 2, Math.PI, 0);
    ctx.lineTo(cx + hw + 2, bottom + 2);
    ctx.closePath();
    ctx.clip();
    for (let y = top - 4; y < bottom + 4; y += 6) {
      const f = (y - top) / (bottom - top);
      ctx.fillStyle = mix('#2a0a18', '#ff9a30', Math.pow(Math.max(0, Math.min(1, f)), 1.4));
      ctx.fillRect(cx - hw - 2, y, hw * 2 + 4, 6);
    }
    ctx.fillStyle = '#12080e';
    [[268, 130, 14, 70], [296, 96, 18, 104], [338, 114, 12, 86], [362, 146, 16, 54]].forEach(function (b, i) {
      ctx.fillRect(b[0], b[1], b[2], b[3]);
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = 'rgba(255,' + (140 + Math.floor(60 * Math.sin(t * 8 + i + k))) + ',40,0.85)';
        ctx.fillRect(b[0] + 3 + (k % 2) * 6, b[1] + 8 + k * 14, 3, 5);
      }
      ctx.fillStyle = '#12080e';
    });
    for (let k = 0; k < 8; k++) flame(ctx, 262 + k * 14, bottom + 2, 16, 34 + 12 * Math.sin(k * 1.9), t, k * 2.3);
    ctx.restore();
  }
  function heartbeat(t, rate) { const s = Math.sin(t * rate); return Math.pow(Math.max(0, s), 4); }

  function drawLayer(ctx, key, build) {
    if (!bgLayers[key]) bgLayers[key] = build();
    ctx.drawImage(bgLayers[key], 0, 0, 640, 360);
  }

  function background(ctx, kind, t) {
    try {
      t = t || 0;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (kind === 'title') {
        drawLayer(ctx, 'title', buildTitle);
        // window glow
        TITLE_WINDOWS.forEach(function (w, i) {
          const f = 0.55 + 0.45 * Math.sin(t * 9 + i * 2.1) * Math.sin(t * 3.7 + i);
          ctx.fillStyle = 'rgba(255,' + (110 + Math.floor(90 * f)) + ',30,' + (0.6 + 0.4 * f).toFixed(2) + ')';
          ctx.fillRect(w[0] * 2, w[1] * 2 + 4, 8, 12); ctx.fillRect(w[0] * 2 + 2, w[1] * 2, 4, 4);
        });
        // clock: pulsing red glow + hands
        ctx.globalCompositeOperation = 'lighter';
        const hb = heartbeat(t, 4.2);
        const cg = ctx.createRadialGradient(224, 144, 6, 224, 144, 60);
        cg.addColorStop(0, 'rgba(255,60,40,' + (0.12 + 0.28 * hb).toFixed(3) + ')');
        cg.addColorStop(1, 'rgba(255,60,40,0)');
        ctx.fillStyle = cg; ctx.fillRect(160, 80, 128, 128);
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'butt';
        ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(224, 144); ctx.lineTo(224 + Math.cos(t * 0.05 - 1.57) * 13, 144 + Math.sin(t * 0.05 - 1.57) * 13); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(224, 144); ctx.lineTo(224 + Math.cos(t * 0.6 - 1.57) * 19, 144 + Math.sin(t * 0.6 - 1.57) * 19); ctx.stroke();
        ctx.strokeStyle = '#ff4a3a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(224, 144); ctx.lineTo(224 + Math.cos(t * 6 - 1.57) * 20, 144 + Math.sin(t * 6 - 1.57) * 20); ctx.stroke();
        ctx.fillStyle = '#ffb830'; ctx.fillRect(222, 142, 4, 4);
        // flames licking the tower
        flame(ctx, 176, 300, 100, 36, t, 0.5);
        flame(ctx, 150, 300, 40, 24, t, 3.1);
        flame(ctx, 256, 300, 40, 26, t, 5.7);
        flame(ctx, 180, 92, 20, 26, t, 1.9);
        flame(ctx, 246, 96, 20, 26, t, 4.4);
        flame(ctx, 248, 214, 12, 18, t, 2.2);
        flame(ctx, 192, 236, 12, 14, t, 6.6);
        // smoke plume drifting to the right
        for (let i = 0; i < 9; i++) {
          const u = ((t * 0.12 + i / 9) % 1);
          const y = 100 - u * 90, x = 224 + u * 60 + Math.sin(t * 0.6 + i) * 8, s = 10 + u * 26;
          ctx.fillStyle = 'rgba(16,8,22,' + (0.5 * (1 - u)).toFixed(2) + ')';
          ctx.fillRect(Math.round(x), Math.round(y), Math.round(s), Math.round(s * 0.7));
        }
        embers(ctx, t, 46, 11, 1.4);
      } else if (kind === 'table') {
        drawLayer(ctx, 'table', buildTable);
        // bubbles in the specimen tanks
        TABLE_TANKS.forEach(function (tk, ti) {
          for (let k = 0; k < 6; k++) {
            const bx = (tk[0] + 4 + hash(k, ti, 21) * (tk[2] - 8)) * 2;
            const by = (tk[1] + tk[3]) * 2 - ((t * (14 + hash(k, ti, 22) * 14) + hash(k, ti, 23) * 200) % (tk[3] * 2));
            ctx.fillStyle = 'rgba(160,255,220,' + (0.35 + 0.35 * hash(k, ti, 24)).toFixed(2) + ')';
            ctx.fillRect(Math.round(bx / 2) * 2, Math.round(by / 2) * 2, 2, 2);
          }
        });
        // flickering surgical lamp light cone
        let fl = 0.85 + 0.15 * Math.sin(t * 23) * Math.sin(t * 7.3);
        if ((t % 9) < 0.12) fl *= 0.35;
        ctx.globalCompositeOperation = 'lighter';
        const lg = ctx.createLinearGradient(0, 84, 0, 270);
        lg.addColorStop(0, 'rgba(255,230,160,' + (0.2 * fl).toFixed(3) + ')');
        lg.addColorStop(1, 'rgba(255,200,120,' + (0.05 * fl).toFixed(3) + ')');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.moveTo(304, 88); ctx.lineTo(336, 88); ctx.lineTo(440, 268); ctx.lineTo(200, 268); ctx.closePath(); ctx.fill();
        const gl = ctx.createRadialGradient(320, 86, 0, 320, 86, 36);
        gl.addColorStop(0, 'rgba(255,240,180,' + (0.5 * fl).toFixed(3) + ')'); gl.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = gl; ctx.fillRect(280, 50, 80, 80);
        ctx.globalCompositeOperation = 'source-over';
        embers(ctx, t, 10, 31, 0.6);
      } else {
        // 'lab' (combat) and any unknown kind
        ctx.fillStyle = '#0d0912'; ctx.fillRect(0, 0, 640, 360);
        windowFire(ctx, t);
        drawLayer(ctx, 'lab', buildLab);
        const fl = 0.8 + 0.2 * Math.sin(t * 11) * Math.sin(t * 4.3);
        ctx.globalCompositeOperation = 'lighter';
        const fg = ctx.createRadialGradient(320, 270, 10, 320, 270, 230);
        fg.addColorStop(0, 'rgba(255,110,30,' + (0.13 * fl).toFixed(3) + ')'); fg.addColorStop(1, 'rgba(255,110,30,0)');
        ctx.fillStyle = fg; ctx.fillRect(0, 100, 640, 260);
        ctx.globalCompositeOperation = 'source-over';
        embers(ctx, t, 22, 41, 1);
      }
      ctx.restore();
    } catch (e) { try { ctx.restore(); } catch (e2) { /* ignore */ } }
  }

  // ================================================================= tile() + export
  function tile(ctx, name, x, y, scale, t) {
    try {
      const d = tileDef(name);
      const i = d.n > 1 ? Math.floor(Math.abs(t || 0) * d.rate) % d.n : 0;
      blit(ctx, d.frames[i], x, y, scale || 1);
    } catch (e) { /* ignore */ }
  }

  DD.sprites = {
    tile: tile,
    player: player,
    enemyMini: enemyMini,
    enemy: enemy,
    enemySize: enemySize,
    drawBody: drawBody,
    limbIcon: limbIcon,
    icon: icon,
    background: background
  };
})();
