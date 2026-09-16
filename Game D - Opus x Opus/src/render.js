// Low-level drawing layer for the fixed 448x252 pixel-art canvas.
// Own 4x6 bitmap font and 1px primitives. No imports, no assets, no canvas text API.

export const W = 448, H = 252;

export const PAL = {
  void:'#0b0a10', ink:'#15121c', grave:'#221c2b', stone:'#332a3d', ash:'#4a3f55',
  bone:'#d9cfb8', pale:'#f2ead9', blood:'#8c1c2b', gore:'#c2354a', flesh:'#a8596b',
  brass:'#b98b3c', copper:'#8a5a2b', rust:'#6b3a24', bile:'#7fa84a', acid:'#b7d94a',
  ichor:'#4ad9a5', arcane:'#8a5cd9', violet:'#5c3d8a', spark:'#d9d24a',
  ember:'#e07a2b', fire:'#f2b03c', cold:'#4a7fd9'
};

/* ------------------------------------------------------------------ canvas */

// Integer css pixels per game pixel. Kept module-local for toGame().
let viewScale = 1;

export function initCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;
  canvas.style.imageRendering = 'pixelated';
  canvas.style.display = 'block';
  canvas.style.position = 'fixed';
  const fit = () => {
    viewScale = Math.max(1, Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H)));
    const w = W * viewScale, h = H * viewScale;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.style.left = Math.max(0, Math.floor((window.innerWidth - w) / 2)) + 'px';
    canvas.style.top = Math.max(0, Math.floor((window.innerHeight - h) / 2)) + 'px';
  };
  fit();
  window.addEventListener('resize', fit);
  return ctx;
}

// Mouse client coords -> game space. Reads the live rect, so any scale works.
export function toGame(canvas, clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const sx = r.width > 0 ? r.width / W : viewScale;
  const sy = r.height > 0 ? r.height / H : viewScale;
  return { x: Math.floor((clientX - r.left) / sx), y: Math.floor((clientY - r.top) / sy) };
}

/* -------------------------------------------------------------- primitives */

export function clear(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
}

export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

// 1x1 shortcut for other modules.
export function pixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
}

// 1px Bresenham.
export function line(ctx, x0, y0, x1, y1, color) {
  ctx.fillStyle = color;
  let x = Math.floor(x0), y = Math.floor(y0);
  const xe = Math.floor(x1), ye = Math.floor(y1);
  const dx = Math.abs(xe - x), dy = -Math.abs(ye - y);
  const sx = x < xe ? 1 : -1, sy = y < ye ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x, y, 1, 1);
    if (x === xe && y === ye) break;
    const e2 = err * 2;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

// 1px panel with the four corner pixels left empty. fill may be null.
export function frame(ctx, x, y, w, h, border, fill) {
  x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
  if (w < 2 || h < 2) return;
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  }
  ctx.fillStyle = border;
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillRect(x + 1, y + h - 1, w - 2, 1);
  ctx.fillRect(x, y + 1, 1, h - 2);
  ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
}

// Progress bar. bg paints the whole box, so it reads as an implicit 1px border.
export function bar(ctx, x, y, w, h, pct, fg, bg) {
  x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
  const p = pct > 0 ? (pct < 1 ? pct : 1) : 0;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  const iw = Math.round((w - 2) * p);
  if (iw > 0 && h > 2) {
    ctx.fillStyle = fg;
    ctx.fillRect(x + 1, y + 1, iw, h - 2);
  }
}

// Ordered 4x4 Bayer matrix, indexed in world space so patches tile seamlessly.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function dither(ctx, x, y, w, h, color, density) {
  const d = density > 0 ? (density < 1 ? density : 1) : 0;
  if (d <= 0) return;
  const t = d * 16;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = x0 + Math.floor(w), y1 = y0 + Math.floor(h);
  ctx.fillStyle = color;
  for (let py = y0; py < y1; py++) {
    const row = (((py % 4) + 4) % 4) * 4;
    for (let px = x0; px < x1; px++) {
      if (BAYER[row + (((px % 4) + 4) % 4)] < t) ctx.fillRect(px, py, 1, 1);
    }
  }
}

/* ---------------------------------------------------------------- 4x6 font */

// Every glyph is 6 rows of exactly 4 cells: '#' lit, '.' off.
// Accented capitals spend their top row on the mark and squash the letter below.
const GLYPHS = {
  ' ': ['....', '....', '....', '....', '....', '....'],

  A: ['.##.', '#..#', '#..#', '####', '#..#', '#..#'],
  B: ['###.', '#..#', '###.', '#..#', '#..#', '###.'],
  C: ['.###', '#...', '#...', '#...', '#...', '.###'],
  D: ['###.', '#..#', '#..#', '#..#', '#..#', '###.'],
  E: ['####', '#...', '###.', '#...', '#...', '####'],
  F: ['####', '#...', '###.', '#...', '#...', '#...'],
  G: ['.###', '#...', '#...', '#.##', '#..#', '.###'],
  H: ['#..#', '#..#', '####', '#..#', '#..#', '#..#'],
  I: ['###.', '.#..', '.#..', '.#..', '.#..', '###.'],
  J: ['..##', '...#', '...#', '...#', '#..#', '.##.'],
  K: ['#..#', '#.#.', '##..', '#.#.', '#..#', '#..#'],
  L: ['#...', '#...', '#...', '#...', '#...', '####'],
  M: ['#..#', '####', '####', '#..#', '#..#', '#..#'],
  N: ['#..#', '##.#', '##.#', '#.##', '#.##', '#..#'],
  O: ['.##.', '#..#', '#..#', '#..#', '#..#', '.##.'],
  P: ['###.', '#..#', '#..#', '###.', '#...', '#...'],
  Q: ['.##.', '#..#', '#..#', '#..#', '#.#.', '.#.#'],
  R: ['###.', '#..#', '#..#', '###.', '#.#.', '#..#'],
  S: ['.###', '#...', '.##.', '...#', '...#', '###.'],
  T: ['####', '.#..', '.#..', '.#..', '.#..', '.#..'],
  U: ['#..#', '#..#', '#..#', '#..#', '#..#', '.##.'],
  V: ['#..#', '#..#', '#..#', '#..#', '.##.', '.##.'],
  W: ['#..#', '#..#', '#..#', '####', '####', '#..#'],
  X: ['#..#', '#..#', '.##.', '.##.', '#..#', '#..#'],
  Y: ['#..#', '#..#', '.##.', '.#..', '.#..', '.#..'],
  Z: ['####', '...#', '..#.', '.#..', '#...', '####'],

  0: ['.##.', '#..#', '#.##', '##.#', '#..#', '.##.'],
  1: ['.#..', '##..', '.#..', '.#..', '.#..', '###.'],
  2: ['.##.', '#..#', '...#', '..#.', '.#..', '####'],
  3: ['###.', '...#', '.##.', '...#', '...#', '###.'],
  4: ['#..#', '#..#', '#..#', '####', '...#', '...#'],
  5: ['####', '#...', '###.', '...#', '...#', '###.'],
  6: ['.##.', '#...', '###.', '#..#', '#..#', '.##.'],
  7: ['####', '...#', '..#.', '..#.', '.#..', '.#..'],
  8: ['.##.', '#..#', '.##.', '#..#', '#..#', '.##.'],
  9: ['.##.', '#..#', '#..#', '.###', '...#', '.##.'],

  '.': ['....', '....', '....', '....', '....', '.#..'],
  ',': ['....', '....', '....', '....', '.#..', '#...'],
  ':': ['....', '.#..', '....', '....', '.#..', '....'],
  ';': ['....', '.#..', '....', '....', '.#..', '#...'],
  '!': ['.#..', '.#..', '.#..', '.#..', '....', '.#..'],
  '?': ['.##.', '#..#', '..#.', '.#..', '....', '.#..'],
  "'": ['.#..', '.#..', '....', '....', '....', '....'],
  '"': ['#.#.', '#.#.', '....', '....', '....', '....'],
  '-': ['....', '....', '....', '###.', '....', '....'],
  '+': ['....', '....', '.#..', '###.', '.#..', '....'],
  '/': ['...#', '...#', '..#.', '.#..', '#...', '#...'],
  '%': ['#..#', '...#', '..#.', '.#..', '#...', '#..#'],
  '(': ['..#.', '.#..', '.#..', '.#..', '.#..', '..#.'],
  ')': ['.#..', '..#.', '..#.', '..#.', '..#.', '.#..'],
  '<': ['....', '..#.', '.#..', '#...', '.#..', '..#.'],
  '>': ['....', '.#..', '..#.', '...#', '..#.', '.#..'],
  '*': ['....', '#.#.', '.#..', '#.#.', '....', '....'],
  '=': ['....', '....', '###.', '....', '###.', '....'],
  '[': ['.##.', '.#..', '.#..', '.#..', '.#..', '.##.'],
  ']': ['.##.', '..#.', '..#.', '..#.', '..#.', '.##.'],
  '_': ['....', '....', '....', '....', '....', '####'],
  '#': ['.#.#', '####', '.#.#', '####', '.#.#', '....'],

  'Á': ['..#.', '.##.', '#..#', '####', '#..#', '#..#'],
  'É': ['..#.', '####', '#...', '###.', '#...', '####'],
  'Í': ['..#.', '###.', '.#..', '.#..', '.#..', '###.'],
  'Ó': ['..#.', '.##.', '#..#', '#..#', '#..#', '.##.'],
  'Ú': ['..#.', '#..#', '#..#', '#..#', '#..#', '.##.'],
  'Ñ': ['####', '#..#', '##.#', '##.#', '#.##', '#..#'],
  'Ü': ['#..#', '....', '#..#', '#..#', '#..#', '.##.'],
  '¡': ['..#.', '....', '..#.', '..#.', '..#.', '..#.'],
  '¿': ['..#.', '....', '..#.', '.#..', '#..#', '.##.']
};

// Anything not covered draws as a hollow filler block.
const FALLBACK = ['####', '#..#', '#..#', '#..#', '#..#', '####'];

function glyphOf(ch) {
  return GLYPHS[ch] || GLYPHS[ch.toUpperCase()] || FALLBACK;
}

function step(scale) {
  const s = Math.floor(scale);
  return s > 1 ? s : 1;
}

// 4x6 font, 5*scale advance, 7*scale line height, '\n' supported.
export function text(ctx, str, x, y, color, scale = 1) {
  const s = step(scale);
  const src = String(str);
  ctx.fillStyle = color;
  const ox = Math.floor(x);
  let cx = ox, cy = Math.floor(y);
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\n') { cx = ox; cy += 7 * s; continue; }
    const g = glyphOf(ch);
    for (let r = 0; r < 6; r++) {
      const row = g[r];
      for (let c = 0; c < 4; c++) {
        if (row[c] === '#') ctx.fillRect(cx + c * s, cy + r * s, s, s);
      }
    }
    cx += 5 * s;
  }
}

// Width of the longest line, in pixels.
export function textW(str, scale = 1) {
  const s = step(scale);
  const t = String(str);
  let best = 0, n = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '\n') { if (n > best) best = n; n = 0; } else n++;
  }
  if (n > best) best = n;
  return best * 5 * s;
}

export function textCenter(ctx, str, cx, y, color, scale = 1) {
  const s = step(scale);
  const lines = String(str).split('\n');
  for (let i = 0; i < lines.length; i++) {
    text(ctx, lines[i], Math.round(cx - textW(lines[i], s) / 2), y + i * 7 * s, color, s);
  }
}
