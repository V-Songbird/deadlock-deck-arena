/**
 * sprites.js -- every pixel of the game's art, drawn by code.
 * Gothic alchemy, body horror and brass steampunk.
 * Only render.js primitives are used: no bitmap fonts here, no images, no ctx.arc.
 */

import * as R from './render.js';
import * as C from './cards.js';

/* ------------------------------------------------------------------ wiring */
/* Resolved through the namespace so that a primitive missing from render.js
   degrades into a no-op instead of breaking module evaluation for the game. */

const PAL = R.PAL || {};
const FALLBACK_COLOR = '#a8596b';
const NOOP = function () {};

const rect = typeof R.rect === 'function' ? R.rect : NOOP;
const line = typeof R.line === 'function' ? R.line : NOOP;
const ditherArea = typeof R.dither === 'function' ? R.dither : NOOP;
const panel = typeof R.frame === 'function' ? R.frame : NOOP;
const pixel = typeof R.pixel === 'function'
  ? R.pixel
  : function (ctx, x, y, c) { rect(ctx, x, y, 1, 1, c); };

const LIMBS = (C && C.LIMBS) || {};
const ENEMIES = (C && C.ENEMIES) || {};

/** Palette lookup; unknown keys fall back to flesh instead of throwing. */
function col(key) {
  const c = key && PAL[key];
  return typeof c === 'string' ? c : (typeof PAL.flesh === 'string' ? PAL.flesh : FALLBACK_COLOR);
}

const VOID = col('void'), INK = col('ink'), GRAVE = col('grave'), STONE = col('stone');
const ASH = col('ash'), BONE = col('bone'), PALE = col('pale'), BLOOD = col('blood');
const GORE = col('gore'), FLESH = col('flesh'), BRASS = col('brass'), COPPER = col('copper');
const RUST = col('rust'), BILE = col('bile'), ACID = col('acid'), ICHOR = col('ichor');
const ARCANE = col('arcane'), VIOLET = col('violet'), SPARK = col('spark');
const EMBER = col('ember'), FIRE = col('fire'), COLD = col('cold');

/* ------------------------------------------------------------ tiny helpers */

function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : (d || 0); }
function clamp01(v) { const n = num(v); return n < 0 ? 0 : n > 1 ? 1 : n; }
function ri(v) { return Math.round(num(v)); }

/** Deterministic integer hash -> uint32. */
function hash(n) {
  let h = (n | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
/** Deterministic 0..1 from an integer seed. */
function rnd(n) { return hash(n) / 4294967296; }
/** FNV-1a over a string -> uint32, for blueprint ids. */
function hashStr(s) {
  const str = String(s == null ? '' : s);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/* --------------------------------------------------------------- colour mix */

const mixMemo = new Map();
function parseHex(hex) {
  if (typeof hex !== 'string') return [168, 89, 107];
  let s = hex.charAt(0) === '#' ? hex.slice(1) : hex;
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  if (!isFinite(n)) return [168, 89, 107];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Blend two hex colours; quantised to 17 steps and memoised (bounded set). */
function mix(a, b, f) {
  const q = Math.max(0, Math.min(16, Math.round(num(f) * 16)));
  const key = a + b + q;
  const cached = mixMemo.get(key);
  if (cached) return cached;
  const A = parseHex(a), B = parseHex(b), g = q / 16;
  const out = '#' + ((1 << 24)
    | (Math.round(A[0] + (B[0] - A[0]) * g) << 16)
    | (Math.round(A[1] + (B[1] - A[1]) * g) << 8)
    | Math.round(A[2] + (B[2] - A[2]) * g)).toString(16).slice(1);
  mixMemo.set(key, out);
  return out;
}
function dark(c, f) { return mix(c, INK, f === undefined ? 0.35 : f); }
function lite(c, f) { return mix(c, PALE, f === undefined ? 0.3 : f); }

/* ------------------------------------------------------------- draw helpers */

/** Dither wrapper: skips degenerate rects, clamps density, and caps the area
 *  scanned per call so no single haze can blow the per-frame pixel budget. */
const FOG_MAX_AREA = 6000;
function fog(ctx, x, y, w, h, color, density) {
  const ww = ri(w), d = clamp01(density);
  let hh = ri(h);
  if (ww <= 0 || hh <= 0 || d <= 0.01) return;
  if (ww * hh > FOG_MAX_AREA) hh = Math.max(1, Math.floor(FOG_MAX_AREA / ww));
  ditherArea(ctx, ri(x), ri(y), ww, hh, color, d);
}

/** Row-span shape: rows = [[xOffset, width], ...] from the top. */
function spans(ctx, x, y, rows, color) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r && r[1] > 0) rect(ctx, x + r[0], y + i, r[1], 1, color);
  }
}

/** Centred silhouette from a width profile, with contour, top light and floor shadow. */
function silhouette(ctx, cx, topY, widths, color) {
  const n = widths.length;
  if (!n) return;
  const hi = lite(color, 0.24), lo = dark(color, 0.42), floorC = dark(color, 0.5);
  rect(ctx, cx - (widths[0] >> 1), topY - 1, widths[0], 1, INK);
  for (let i = 0; i < n; i++) {
    const w = widths[i];
    if (w <= 0) continue;
    const x0 = cx - (w >> 1), yy = topY + i;
    rect(ctx, x0, yy, w, 1, i === n - 1 ? floorC : color);
    pixel(ctx, x0, yy, hi);
    pixel(ctx, x0 + w - 1, yy, lo);
    pixel(ctx, x0 - 1, yy, INK);
    pixel(ctx, x0 + w, yy, INK);
  }
  rect(ctx, cx - (widths[n - 1] >> 1), topY + n, widths[n - 1], 1, INK);
}

/** Linear width profile from control points [[frac, width], ...]. */
function ramp(n, pts) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const f = n > 1 ? i / (n - 1) : 0;
    let a = pts[0], b = pts[pts.length - 1];
    for (let j = 0; j < pts.length - 1; j++) {
      if (f >= pts[j][0] && f <= pts[j + 1][0]) { a = pts[j]; b = pts[j + 1]; break; }
    }
    const span = (b[0] - a[0]) || 1;
    out[i] = Math.max(1, Math.round(a[1] + (b[1] - a[1]) * ((f - a[0]) / span)));
  }
  return out;
}

/** Filled circle by row spans (no ctx.arc). */
function disc(ctx, cx, cy, rad, color) {
  const r = Math.max(0, ri(rad));
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    rect(ctx, cx - w, cy + dy, w * 2 + 1, 1, color);
  }
}

/** Midpoint (Bresenham) circle outline. */
function ring(ctx, cx, cy, rad, color) {
  let x = Math.max(0, ri(rad)), y = 0, err = 1 - x;
  while (x >= y) {
    pixel(ctx, cx + x, cy + y, color); pixel(ctx, cx - x, cy + y, color);
    pixel(ctx, cx + x, cy - y, color); pixel(ctx, cx - x, cy - y, color);
    pixel(ctx, cx + y, cy + x, color); pixel(ctx, cx - y, cy + x, color);
    pixel(ctx, cx + y, cy - x, color); pixel(ctx, cx - y, cy - x, color);
    y++;
    if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
  }
}

/** Shaded box: fill, lit top-left, shaded right, shadow row at the bottom. */
function slab(ctx, x, y, w, h, color, outline) {
  if (w <= 0 || h <= 0) return;
  rect(ctx, x, y, w, h, color);
  rect(ctx, x, y, w, 1, lite(color, 0.26));
  rect(ctx, x, y, 1, h, lite(color, 0.12));
  rect(ctx, x + w - 1, y, 1, h, dark(color, 0.3));
  rect(ctx, x, y + h - 1, w, 1, dark(color, 0.48));
  if (outline !== false) {
    rect(ctx, x - 1, y, 1, h, INK); rect(ctx, x + w, y, 1, h, INK);
    rect(ctx, x, y - 1, w, 1, INK); rect(ctx, x, y + h, w, 1, INK);
  }
}

/** Tapered limb segment with its own contour, highlight and shadow edge. */
function taper(ctx, x0, y0, x1, y1, w0, w1, color, outline) {
  const dx = x1 - x0, dy = y1 - y0;
  const n = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy))));
  const vert = Math.abs(dy) >= Math.abs(dx);
  const hi = lite(color, 0.22), lo = dark(color, 0.4);
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const cx = Math.round(x0 + dx * f), cy = Math.round(y0 + dy * f);
    const w = Math.max(1, Math.round(w0 + (w1 - w0) * f));
    if (vert) {
      const sx = cx - (w >> 1);
      if (outline !== false) { pixel(ctx, sx - 1, cy, INK); pixel(ctx, sx + w, cy, INK); }
      rect(ctx, sx, cy, w, 1, color);
      pixel(ctx, sx, cy, hi);
      if (w > 1) pixel(ctx, sx + w - 1, cy, lo);
    } else {
      const sy = cy - (w >> 1);
      if (outline !== false) { pixel(ctx, cx, sy - 1, INK); pixel(ctx, cx, sy + w, INK); }
      rect(ctx, cx, sy, 1, w, color);
      pixel(ctx, cx, sy, hi);
      if (w > 1) pixel(ctx, cx, sy + w - 1, lo);
    }
  }
}

/** Surgical seam: thread dashes with perpendicular stitch ticks. */
function seam(ctx, x, y, len, horiz, color) {
  const th = color || BONE, sh = dark(th, 0.55);
  for (let i = 0; i < len; i++) {
    const on = (i % 3) !== 2;
    if (horiz) {
      if (on) pixel(ctx, x + i, y, th);
      if (i % 3 === 0) { pixel(ctx, x + i, y - 1, sh); pixel(ctx, x + i, y + 1, sh); }
    } else {
      if (on) pixel(ctx, x, y + i, th);
      if (i % 3 === 0) { pixel(ctx, x - 1, y + i, sh); pixel(ctx, x + 1, y + i, sh); }
    }
  }
}

/** 2x2 brass screw at a joint. */
function bolt(ctx, x, y) {
  rect(ctx, x, y, 2, 2, BRASS);
  pixel(ctx, x, y, SPARK);
  pixel(ctx, x + 1, y + 1, RUST);
}

/** Falling droplet whose length cycles with t. */
function drip(ctx, x, y, t, seed, color) {
  const phase = (num(t) * 1.6 + rnd(seed)) % 1;
  const len = 1 + Math.floor(phase * 4);
  rect(ctx, x, y, 1, len, color);
  pixel(ctx, x, y + len, lite(color, 0.35));
  if (phase > 0.72) pixel(ctx, x, y + len + 2 + Math.floor(phase * 3), color);
}

/** Small glass glint used on lenses, blades and crystals. */
function glint(ctx, x, y, t, seed) {
  if (Math.sin(num(t) * 3.1 + rnd(seed) * 6.28) > 0.2) pixel(ctx, x, y, PALE);
}

/* ---------------------------------------------------------- limb resolving */

/* Blueprint ids are Spanish (e.g. 'brazoGuillotina'), so a keyword hit picks a
   matching silhouette and anything unknown falls back to a hashed variant. */
const ARM_WORDS = [
  [/guillotin|cuchill|hoja|sierra|filo|espad|navaj|hach/, 1],           // blade
  [/bisturi|escalpel|aguja|jering|inyect|vial|ampoll|vener|toxin/, 4],   // syringe
  [/piston|martill|ariete|maza|yunque|forj|embol/, 2],                   // piston
  [/sanguijuel|tentacul|zarcill|latig|serpien|anguil/, 3],               // tentacle
  [/carnicer|pinza|tenaz|garfi|ganch|torno|grap/, 5],                    // pincer
  [/crisol|sopl|antorch|bras|fuego|llam|horn|ascua/, 6],                 // burner
  [/huesud|garra|zarpa|talon|unglar|felin/, 0],                          // talons
  [/zurcid|remend|mano|dedo|palm|puno/, 7],                              // hand
];
const LEG_WORDS = [
  [/quitin|insect|artrop|anilla|espir|tentacul|serpien|reptil/, 5],       // coil
  [/zarpa|sabues|pata|canin|lobo|bestia|corve/, 1],                      // digitigrade
  [/zanc|estac|clav|alfil|espig|aguja/, 2],                              // stilt
  [/resort|piston|hidraul|embol|muell|maquin/, 3],                       // hydraulic
  [/sepulcr|tumb|cripta|casco|pezu|cabra|macho|ungul/, 4],               // hoof
  [/nudos|carne|basic|humana|musl/, 0],                                  // flesh
];
const HEAD_WORDS = [
  [/vident|orac|mirad|tercer|ojo|ocul/, 1],                              // seer
  [/alqui|alambi|frasc|tarro|vidri|cristal|cerebr|vaso/, 5],             // brain jar
  [/yelmo|casco|helm|laton|escaf|buzo|mascar/, 2],                       // brass helm
  [/sabues|testa|hocic|fauc|boca|mandib|colmill|dient|devor|sanguij/, 3],// maw
  [/horno|forj|bras|ascua|cuern|asta|corn|demon|chiv/, 4],               // horned furnace
  [/craneo|calav|hueso|osar|desoll/, 0],                                 // skull
];
const TORSO_WORDS = [
  [/osari|costill|torax|esquel|jaul/, 0],                                // ribcage
  [/calder|boiler|vapor|horno|brasa/, 1],                                // boiler
  [/reliqui|relicar|vitrin|cavid|hueco|corazon/, 2],                     // reliquary
  [/remend|zurcid|parche|saco|vientr|tumor|bilis|hinch|larv|nido/, 3],    // bloated
  [/fuell|caja|coraz|placa|armad|planch|blind|hierro/, 4],               // plated
];

function pickVariant(key, table, count) {
  const k = String(key).toLowerCase();
  for (let i = 0; i < table.length; i++) if (table[i][0].test(k)) return table[i][1];
  return hashStr(k) % count;
}

/**
 * Normalises whatever body.js stores in a slot into drawing data.
 * Accepts a limb object, a raw blueprint id or an inline blueprint object.
 */
function limbInfo(limb, family, hurt, heatOpt) {
  if (!limb) return null;
  let bpId = null, bp = null;
  if (typeof limb === 'string') bpId = limb;
  else {
    const b = limb.blueprint;
    if (typeof b === 'string') bpId = b;
    else if (b && typeof b === 'object') { bp = b; bpId = b.id; }
    else bpId = limb.id;
  }
  if (!bp) bp = (bpId && LIMBS[bpId]) || null;
  const key = String(bpId || (bp && bp.id) || family || 'flesh');
  const base = col(bp && bp.color);
  const tier = Math.max(1, Math.min(3, num(bp && bp.tier, 1)));
  const heatCap = Math.max(1, num(limb && limb.heatCap, num(bp && bp.heatCap, 8)));
  const heatRatio = clamp01(num(limb && limb.heat, 0) / heatCap);
  const maxInt = Math.max(1, num(limb && limb.maxIntegrity, num(bp && bp.integrity, 8)));
  const wounded = num(limb && limb.integrity, maxInt) <= maxInt * 0.5;
  const glow = Math.max(clamp01(heatOpt) * 0.85, heatRatio);
  let table, count;
  if (family === 'arm') { table = ARM_WORDS; count = 8; }
  else if (family === 'leg') { table = LEG_WORDS; count = 6; }
  else if (family === 'head') { table = HEAD_WORDS; count = 6; }
  else { table = TORSO_WORDS; count = 5; }
  let c = base;
  if (glow > 0.02) c = mix(c, FIRE, Math.min(0.62, glow * 0.62));
  if (hurt > 0.02) c = mix(c, GORE, Math.min(0.8, hurt * 0.8));
  return {
    key: key, color: c, base: base, tier: tier, glow: glow, wounded: wounded,
    shape: pickVariant(key, table, count),
    seed: hashStr(key) & 0xffff,
  };
}

/** Bandaged, dripping stump: what a slot with no limb looks like. */
function drawStump(ctx, jx, jy, dx, dy, len, w, t, seed) {
  const ex = Math.round(jx + dx * len), ey = Math.round(jy + dy * len);
  const meat = mix(FLESH, BLOOD, 0.35);
  taper(ctx, jx, jy, ex, ey, w, Math.max(2, w - 2), meat);
  const vert = Math.abs(dy) >= Math.abs(dx);
  for (let i = 1; i < len; i += 2) {                        // bandage wraps
    const bx = Math.round(jx + dx * i), by = Math.round(jy + dy * i);
    const bw = Math.max(2, w - Math.round((i / len) * 2));
    if (vert) {
      rect(ctx, bx - (bw >> 1), by, bw, 1, i % 4 === 1 ? PALE : BONE);
      pixel(ctx, bx - (bw >> 1), by, dark(BONE, 0.3));
    } else {
      rect(ctx, bx, by - (bw >> 1), 1, bw, i % 4 === 1 ? PALE : BONE);
      pixel(ctx, bx, by - (bw >> 1), dark(BONE, 0.3));
    }
  }
  pixel(ctx, ex, ey, GORE);                                 // seepage
  pixel(ctx, ex - 1, ey - 1, BLOOD);
  pixel(ctx, ex + 1, ey, mix(GORE, PALE, 0.2));
  seam(ctx, jx - (w >> 1), jy, w, true, BONE);
  drip(ctx, ex, ey + 1, t, seed, GORE);
  if (((seed + 1) & 3) === 0) drip(ctx, ex - 1, ey + 1, num(t) * 0.7, seed + 5, BLOOD);
}

/* ------------------------------------------------------------------- heads */

const HEAD_SKULL = [6, 10, 12, 13, 13, 13, 13, 12, 11, 10, 9, 8, 8, 7, 6, 5];
const HEAD_HELM = [6, 10, 12, 14, 14, 14, 14, 14, 13, 13, 12, 12, 11, 10, 8, 6];
const HEAD_JAR = [8, 12, 14, 14, 14, 14, 13, 12, 10, 8, 8, 10, 12, 12, 10, 8];
const HEAD_PROFILES = [HEAD_SKULL, HEAD_SKULL, HEAD_HELM, HEAD_SKULL, HEAD_SKULL, HEAD_JAR];

function drawHead(ctx, cx, baseY, info, t) {
  const shape = info.shape;
  const prof = HEAD_PROFILES[shape] || HEAD_SKULL;
  const topY = baseY - (prof.length - 1);
  let body = info.color;
  if (shape === 2) body = mix(body, BRASS, 0.55);
  if (shape === 5) body = mix(body, STONE, 0.3);
  silhouette(ctx, cx, topY, prof, body);
  const eyeY = topY + 5, socket = dark(body, 0.85);
  const blink = Math.sin(num(t) * 1.9 + info.seed) > 0.96;

  if (shape === 0 || shape === 1 || shape === 4) {           // skull faces
    rect(ctx, cx - 5, eyeY, 3, 3, socket);
    rect(ctx, cx + 2, eyeY, 3, 3, socket);
    if (!blink) { pixel(ctx, cx - 4, eyeY + 1, SPARK); pixel(ctx, cx + 3, eyeY + 1, SPARK); }
    rect(ctx, cx - 1, eyeY + 4, 2, 2, socket);               // nasal pit
    rect(ctx, cx - 4, baseY - 4, 9, 1, dark(body, 0.6));     // jaw line
    for (let i = 0; i < 4; i++) pixel(ctx, cx - 3 + i * 2, baseY - 3, BONE);
    seam(ctx, cx - 5, topY + 2, 10, true, BONE);             // cranial suture
  }
  if (shape === 1) {                                         // seer: third eye
    disc(ctx, cx, topY + 2, 2, PALE);
    ring(ctx, cx, topY + 2, 2, INK);
    pixel(ctx, cx, topY + 2, ARCANE);
    pixel(ctx, cx, topY + 2 - (Math.sin(num(t) * 2) > 0 ? 1 : 0), VIOLET);
    for (let i = 0; i < 4; i++) {
      const a = num(t) * 1.2 + i * 1.57;
      pixel(ctx, cx + Math.round(Math.cos(a) * 4), topY + 2 + Math.round(Math.sin(a) * 3), SPARK);
    }
  }
  if (shape === 4) {                                         // horns
    for (let s = -1; s <= 1; s += 2) {
      const hx = cx + s * 5;
      taper(ctx, hx, topY + 1, hx + s * 4, topY - 5, 3, 1, BONE);
      pixel(ctx, hx + s * 5, topY - 6, dark(BONE, 0.4));
      bolt(ctx, hx - (s < 0 ? 1 : 0), topY + 2);
    }
  }
  if (shape === 2) {                                         // riveted brass helm
    rect(ctx, cx - 7, eyeY, 14, 1, COPPER);
    rect(ctx, cx - 6, eyeY + 1, 12, 3, INK);
    rect(ctx, cx - 5, eyeY + 2, 10, 1, blink ? RUST : SPARK);
    for (let i = 0; i < 5; i++) bolt(ctx, cx - 6 + i * 3, topY + 2);
    rect(ctx, cx + 5, eyeY + 4, 3, 5, COPPER);               // breathing pipe
    rect(ctx, cx + 6, eyeY + 4, 1, 5, BRASS);
    seam(ctx, cx - 6, baseY - 3, 12, true, COPPER);
  }
  if (shape === 3) {                                         // lamprey maw
    seam(ctx, cx - 5, eyeY, 11, true, BONE);
    seam(ctx, cx - 5, eyeY + 2, 11, true, BONE);
    const gape = 3 + (Math.sin(num(t) * 2.3) > 0 ? 1 : 0);
    disc(ctx, cx, baseY - 5, gape, dark(BLOOD, 0.45));
    ring(ctx, cx, baseY - 5, gape, INK);
    ring(ctx, cx, baseY - 5, gape - 1, BONE);
    pixel(ctx, cx, baseY - 5, GORE);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + num(t) * 0.6;
      pixel(ctx, cx + Math.round(Math.cos(a) * (gape - 2)),
        baseY - 5 + Math.round(Math.sin(a) * (gape - 2)), PALE);
    }
  }
  if (shape === 5) {                                         // brain in a jar
    disc(ctx, cx, topY + 6, 5, mix(FLESH, VIOLET, 0.25));
    for (let i = 0; i < 4; i++) rect(ctx, cx - 4 + i * 2, topY + 3 + (i & 1), 1, 5, dark(FLESH, 0.45));
    ring(ctx, cx, topY + 6, 6, mix(COLD, PALE, 0.25));
    ring(ctx, cx, topY + 6, 7, INK);
    for (let i = 0; i < 3; i++) {                            // bubbles
      const by = topY + 11 - Math.floor((num(t) * 7 + i * 4 + (info.seed % 5)) % 10);
      pixel(ctx, cx - 3 + i * 3, by, PALE);
    }
    rect(ctx, cx - 6, baseY - 4, 13, 4, BRASS);
    rect(ctx, cx - 6, baseY - 1, 13, 1, RUST);
    for (let i = 0; i < 4; i++) bolt(ctx, cx - 5 + i * 4, baseY - 3);
    glint(ctx, cx - 4, topY + 3, t, info.seed);
  }
  if (info.tier >= 3) {                                      // rare-graft halo
    pixel(ctx, cx, topY - 2, ARCANE);
    pixel(ctx, cx - 2, topY - 1, VIOLET);
    pixel(ctx, cx + 2, topY - 1, VIOLET);
  }
  if (info.glow > 0.45) { pixel(ctx, cx - 6, eyeY + 3, EMBER); pixel(ctx, cx + 6, eyeY + 5, FIRE); }
  if (info.wounded) { pixel(ctx, cx + 4, topY + 3, GORE); pixel(ctx, cx + 3, topY + 4, BLOOD); }
}

/* ------------------------------------------------------------------ torsos */

const TORSO_H = 26;
const TORSO_PROFILES = [
  ramp(TORSO_H, [[0, 16], [0.08, 22], [0.5, 19], [0.72, 17], [1, 18]]),   // ribcage
  ramp(TORSO_H, [[0, 15], [0.1, 22], [0.85, 22], [1, 16]]),               // boiler
  ramp(TORSO_H, [[0, 16], [0.1, 22], [0.55, 20], [1, 17]]),               // cavity
  ramp(TORSO_H, [[0, 14], [0.2, 17], [0.62, 24], [0.86, 24], [1, 19]]),   // bloated
  ramp(TORSO_H, [[0, 20], [0.12, 22], [0.8, 21], [1, 19]]),               // plated
];

function drawTorso(ctx, cx, topY, info, t) {
  const shape = info.shape;
  const prof = TORSO_PROFILES[shape] || TORSO_PROFILES[0];
  const baseY = topY + TORSO_H - 1;
  let body = info.color;
  if (shape === 1) body = mix(body, BRASS, 0.5);
  if (shape === 4) body = mix(body, STONE, 0.45);
  silhouette(ctx, cx, topY, prof, body);
  const pulse = Math.sin(num(t) * 2.6) * 0.5 + 0.5;

  if (shape === 0 || shape === 2) {                          // exposed ribcage
    rect(ctx, cx - 1, topY + 3, 2, 14, BONE);                // sternum
    rect(ctx, cx, topY + 3, 1, 14, dark(BONE, 0.3));
    for (let i = 0; i < 4; i++) {
      const ry = topY + 4 + i * 3, len = 7 - i;
      rect(ctx, cx - 2 - len, ry, len, 1, BONE);
      rect(ctx, cx + 3, ry, len, 1, BONE);
      pixel(ctx, cx - 2 - len, ry + 1, dark(BONE, 0.45));
      pixel(ctx, cx + 2 + len, ry + 1, dark(BONE, 0.45));
    }
    rect(ctx, cx - 6, topY + 18, 12, 6, dark(body, 0.3));    // belly in shadow
    seam(ctx, cx, topY + 18, 6, false, BONE);
  }
  if (shape === 2) {                                         // heart in a cavity
    const r = 2 + Math.round(pulse);
    rect(ctx, cx - 4, topY + 8, 9, 8, INK);
    disc(ctx, cx, topY + 12, r, GORE);
    pixel(ctx, cx - 1, topY + 11, mix(GORE, PALE, 0.4));
    for (let i = 0; i < 3; i++) rect(ctx, cx - 4 + i * 4, topY + 8, 1, 8, mix(STONE, BRASS, 0.3));
    line(ctx, cx + 4, topY + 8, cx + 9, topY + 4, mix(STONE, ASH, 0.4));
  }
  if (shape === 1) {                                         // alchemical boiler
    for (let i = 0; i < 3; i++) {                            // hoop bands
      rect(ctx, cx - 11, topY + 4 + i * 8, 22, 1, COPPER);
      bolt(ctx, cx - 10, topY + 4 + i * 8);
      bolt(ctx, cx + 8, topY + 4 + i * 8);
    }
    const firebox = mix(EMBER, FIRE, pulse);                 // firebox door
    rect(ctx, cx - 5, topY + 11, 10, 8, INK);
    rect(ctx, cx - 4, topY + 12, 8, 6, firebox);
    fog(ctx, cx - 4, topY + 12, 8, 6, SPARK, 0.25 + pulse * 0.3);
    for (let i = 0; i < 3; i++) rect(ctx, cx - 4, topY + 13 + i * 2, 8, 1, dark(RUST, 0.2));
    rect(ctx, cx + 6, topY + 1, 4, 4, BRASS);                // gauge
    ring(ctx, cx + 8, topY + 3, 2, INK);
    pixel(ctx, cx + 8, topY + 3, SPARK);
    rect(ctx, cx - 10, topY - 3, 3, 4, COPPER);              // exhaust pipe
    drawSmoke(ctx, cx - 11, topY - 12, 6, 10, t, 0.5);
  }
  if (shape === 3) {                                         // bloated sac
    for (let i = 0; i < 4; i++) {
      const bx = cx - 7 + ((info.seed >> (i * 2)) & 3) * 4;
      const by = topY + 9 + i * 4;
      disc(ctx, bx, by, 2 + (i & 1), mix(body, BILE, 0.35));
      pixel(ctx, bx - 1, by - 1, lite(BILE, 0.3));
      ring(ctx, bx, by, 2 + (i & 1), dark(body, 0.5));
    }
    seam(ctx, cx, topY + 6, 16, false, BONE);                // Y incision
    seam(ctx, cx - 6, topY + 2, 7, true, BONE);
    seam(ctx, cx, topY + 2, 7, true, BONE);
    drip(ctx, cx + 5, baseY - 2, t, info.seed, BILE);
  }
  if (shape === 4) {                                         // riveted plate armour
    for (let i = 0; i < 3; i++) {
      const py = topY + 2 + i * 8;
      slab(ctx, cx - 10, py, 20, 7, mix(STONE, i & 1 ? ASH : GRAVE, 0.4), false);
      bolt(ctx, cx - 9, py + 2); bolt(ctx, cx + 8, py + 2);
    }
    rect(ctx, cx - 11, topY + 12, 22, 2, mix(RUST, COPPER, 0.4));   // strap
    rect(ctx, cx - 2, topY + 11, 4, 4, BRASS);
    drawSigil(ctx, cx - 4, topY + 17, 8, info.seed);
  }
  // shoulder plates and the seams that hold the whole thing together
  for (let s = -1; s <= 1; s += 2) {
    const sx = cx + s * 9;
    disc(ctx, sx, topY + 4, 3, dark(body, 0.18));
    ring(ctx, sx, topY + 4, 3, INK);
    bolt(ctx, sx - 1, topY + 3);
  }
  seam(ctx, cx - 8, topY + 1, 17, true, BONE);               // neck seam
  seam(ctx, cx - 7, baseY - 1, 15, true, BONE);              // hip seam
  if (info.wounded) {
    pixel(ctx, cx - 5, topY + 15, GORE);
    rect(ctx, cx - 6, topY + 16, 3, 1, BLOOD);
    drip(ctx, cx - 5, topY + 17, t, info.seed + 3, GORE);
  }
  if (info.glow > 0.4) fog(ctx, cx - 10, topY + 4, 20, TORSO_H - 6, EMBER, info.glow * 0.35);
}

/* -------------------------------------------------------------------- arms */

/** side: -1 left (drawn behind), +1 right. (sx,sy) is the shoulder joint. */
function drawArm(ctx, sx, sy, side, info, t, back) {
  const shape = info.shape;
  let c = info.color;
  if (back) c = dark(c, 0.22);
  const swing = Math.sin(num(t) * 1.25 + (side > 0 ? 0 : 1.9));
  const ex = sx + side * 6, ey = sy + 9 + Math.round(swing);           // elbow
  const wx = sx + side * 10, wy = ey + 9 + Math.round(swing * 1.5);    // wrist

  if (shape === 3) {                                                    // tentacle
    let px0 = sx, py0 = sy, w = 5;
    for (let i = 1; i <= 5; i++) {
      const f = i / 5;
      const px1 = Math.round(sx + side * (4 + f * 12) + Math.sin(num(t) * 2.2 + i * 0.9) * 3);
      const py1 = Math.round(sy + f * 26);
      taper(ctx, px0, py0, px1, py1, w, w - 1, c);
      pixel(ctx, px1 - side, py1, mix(c, PALE, 0.35));                  // sucker
      px0 = px1; py0 = py1; w = Math.max(2, w - 1);
    }
    bolt(ctx, sx - 1, sy - 1);
    seam(ctx, sx - 3, sy + 1, 6, true, BONE);
    return;
  }

  taper(ctx, sx, sy, ex, ey, 6, 5, c);                                  // upper arm
  disc(ctx, ex, ey, 2, dark(c, 0.15));                                  // elbow
  ring(ctx, ex, ey, 2, INK);
  bolt(ctx, ex - 1, ey - 1);
  taper(ctx, ex, ey, wx, wy, 5, 4, c);                                  // forearm
  seam(ctx, sx - 3, sy, 6, true, BONE);
  const hi = lite(c, 0.3);

  switch (shape) {
    case 0: {                                                           // talons
      disc(ctx, wx, wy, 2, c);
      for (let i = 0; i < 3; i++) {
        const tx = wx + side * (i - 1), ty = wy + 2;
        taper(ctx, tx, ty, tx + side * (i * 2 - 1), ty + 6, 2, 1, BONE);
        pixel(ctx, tx + side * (i * 2 - 1), ty + 7, PALE);
      }
      break;
    }
    case 1: {                                                           // guillotine blade
      rect(ctx, wx - 2, wy, 5, 3, BRASS);                               // collar
      rect(ctx, wx - 2, wy + 2, 5, 1, RUST);
      taper(ctx, wx, wy + 3, wx + side * 3, wy + 15, 6, 1, mix(PALE, STONE, 0.25));
      taper(ctx, wx, wy + 3, wx + side * 3, wy + 14, 2, 1, PALE);
      line(ctx, wx - side * 2, wy + 3, wx + side * 2, wy + 15, INK);
      glint(ctx, wx + side, wy + 9, t, info.seed);
      pixel(ctx, wx + side * 3, wy + 16, BLOOD);
      break;
    }
    case 2: {                                                           // steam piston
      const kick = Math.sin(num(t) * 3.4 + info.seed) > 0.75 ? 2 : 0;
      slab(ctx, wx - 3, wy, 6, 7, BRASS);
      rect(ctx, wx - 3, wy + 3, 6, 1, RUST);
      rect(ctx, wx - 1, wy + 7, 2, 3 + kick, mix(STONE, PALE, 0.3));    // rod
      slab(ctx, wx - 4, wy + 10 + kick, 9, 4, mix(STONE, ASH, 0.3));
      bolt(ctx, wx - 3, wy + 11 + kick);
      bolt(ctx, wx + 2, wy + 11 + kick);
      if (kick) drawSmoke(ctx, wx - side * 5, wy + 2, 6, 8, t, 0.6);
      break;
    }
    case 4: {                                                           // syringe
      rect(ctx, wx - 2, wy, 4, 8, mix(PALE, COLD, 0.35));               // barrel
      rect(ctx, wx - 1, wy + 2, 2, 5, ICHOR);
      rect(ctx, wx - 2, wy, 4, 1, BRASS);
      rect(ctx, wx - 1, wy + 8, 1, 6, mix(PALE, STONE, 0.2));           // needle
      pixel(ctx, wx - 1, wy + 14, SPARK);
      drip(ctx, wx - 1, wy + 15, t, info.seed, ICHOR);
      break;
    }
    case 5: {                                                           // pincer
      const open = Math.sin(num(t) * 2.1 + info.seed) > 0 ? 2 : 0;
      slab(ctx, wx - 3, wy, 6, 4, mix(STONE, BRASS, 0.35));
      taper(ctx, wx - 1, wy + 4, wx - 1 - open, wy + 10, 3, 1, mix(STONE, PALE, 0.2));
      taper(ctx, wx + 1, wy + 4, wx + 1 + open, wy + 10, 3, 1, mix(STONE, PALE, 0.2));
      bolt(ctx, wx - 1, wy + 1);
      pixel(ctx, wx - 1 - open, wy + 11, RUST);
      break;
    }
    case 6: {                                                           // burner
      slab(ctx, wx - 2, wy, 5, 5, COPPER);
      rect(ctx, wx - 1, wy + 5, 3, 3, BRASS);
      drawFlame(ctx, wx, wy + 9, 9, t, 'fire');
      break;
    }
    default: {                                                          // hand
      disc(ctx, wx, wy + 1, 3, c);
      ring(ctx, wx, wy + 1, 3, INK);
      for (let i = 0; i < 4; i++) {
        rect(ctx, wx - 2 + i, wy + 3, 1, 3 + (i === 1 || i === 2 ? 1 : 0), c);
        pixel(ctx, wx - 2 + i, wy + 6 + (i === 1 || i === 2 ? 1 : 0), dark(c, 0.5));
      }
      rect(ctx, wx + side * 3, wy + 1, 1, 3, c);                        // thumb
      pixel(ctx, wx - 1, wy, hi);
      break;
    }
  }
  if (info.wounded) { pixel(ctx, ex + side, ey + 3, GORE); pixel(ctx, ex, ey + 4, BLOOD); }
  if (info.glow > 0.45) {
    pixel(ctx, wx + side * 2, wy - 2, EMBER);
    pixel(ctx, ex - side * 2, ey + 2, FIRE);
  }
}

/* -------------------------------------------------------------------- legs */

/** (hx,hy) hip joint, footY the ground line. side: -1 left, +1 right. */
function drawLeg(ctx, hx, hy, footY, side, info, t, back) {
  const shape = info.shape;
  let c = info.color;
  if (back) c = dark(c, 0.22);
  const shift = Math.sin(num(t) * 1.6 + (side > 0 ? 0.6 : 0)) > 0.8 ? 1 : 0;
  const kneeY = hy + Math.round((footY - hy) * 0.5);
  const kx = hx + side;

  switch (shape) {
    case 1: {                                                          // digitigrade
      taper(ctx, hx, hy, kx + side * 3, kneeY - 1, 7, 5, c);
      taper(ctx, kx + side * 3, kneeY - 1, kx - side * 2, footY - 5, 5, 3, c);
      taper(ctx, kx - side * 2, footY - 5, kx + side * 2, footY - 1, 3, 3, c);
      rect(ctx, kx + (side > 0 ? 0 : -4), footY - 1, 5, 1, dark(c, 0.5));
      for (let i = 0; i < 3; i++) pixel(ctx, kx + side * (2 + i), footY, BONE);
      bolt(ctx, kx + side * 2, kneeY - 2);
      break;
    }
    case 2: {                                                          // stilt
      taper(ctx, hx, hy, kx, kneeY, 5, 3, c);
      rect(ctx, kx - 1, kneeY, 3, 3, BRASS);
      bolt(ctx, kx - 1, kneeY);
      taper(ctx, kx, kneeY + 3, kx, footY - 2, 2, 1, mix(STONE, PALE, 0.25));
      rect(ctx, kx - 1, footY - 2, 3, 1, mix(STONE, ASH, 0.3));
      pixel(ctx, kx, footY - 1, ASH);
      break;
    }
    case 3: {                                                          // hydraulic leg
      slab(ctx, hx - 3, hy, 7, 9, mix(BRASS, c, 0.4), false);
      rect(ctx, hx - 3, hy + 4, 7, 1, RUST);
      rect(ctx, hx - 1, hy + 9, 3, kneeY - hy, mix(STONE, PALE, 0.25));
      slab(ctx, hx - 3, kneeY + 2, 7, footY - kneeY - 4, mix(STONE, ASH, 0.35), false);
      bolt(ctx, hx - 2, kneeY + 3);
      rect(ctx, hx - 5, footY - 2, 11, 2, mix(STONE, GRAVE, 0.3));     // foot plate
      rect(ctx, hx - 5, footY, 11, 1, INK);
      break;
    }
    case 4: {                                                          // hoof
      taper(ctx, hx, hy, kx, kneeY, 8, 5, c);
      taper(ctx, kx, kneeY, kx, footY - 3, 4, 3, c);
      slab(ctx, kx - 2, footY - 3, 5, 3, mix(BONE, GRAVE, 0.45), false);
      pixel(ctx, kx, footY - 1, INK);
      seam(ctx, hx - 3, hy + 1, 7, true, BONE);
      break;
    }
    case 5: {                                                          // coil
      let px0 = hx, py0 = hy, w = 7;
      for (let i = 1; i <= 4; i++) {
        const f = i / 4;
        const px1 = Math.round(hx + Math.sin(num(t) * 1.7 + i) * 2 + side * f * 2);
        const py1 = Math.round(hy + (footY - hy) * f);
        taper(ctx, px0, py0, px1, py1, w, w - 1, c);
        pixel(ctx, px1 + side, py1 - 1, mix(c, PALE, 0.3));
        px0 = px1; py0 = py1; w = Math.max(3, w - 1);
      }
      rect(ctx, px0 - 2, footY - 1, 5, 1, dark(c, 0.5));
      break;
    }
    default: {                                                         // flesh leg
      taper(ctx, hx, hy, kx, kneeY, 7, 5, c);
      disc(ctx, kx, kneeY, 2, dark(c, 0.12));
      ring(ctx, kx, kneeY, 2, INK);
      taper(ctx, kx, kneeY, kx, footY - 2 - shift, 5, 4, c);
      rect(ctx, kx - 2, footY - 2 - shift, 7, 2, dark(c, 0.25));       // foot
      rect(ctx, kx - 2, footY - shift, 7, 1, INK);
      seam(ctx, kx - 3, kneeY + 3, 6, true, BONE);
      break;
    }
  }
  bolt(ctx, hx - 1, hy - 1);
  if (info.wounded) { pixel(ctx, kx + 1, kneeY + 2, GORE); pixel(ctx, kx, kneeY + 3, BLOOD); }
  if (info.glow > 0.45) pixel(ctx, kx + side, kneeY - 2, EMBER);
}

/* ------------------------------------------------------------- abomination */

/**
 * The player's abomination, about 48x64, (x,y) is the centred foot position.
 * Built slot by slot from body.head/torso/armL/armR/legL/legR; a null slot is a
 * bandaged stump. opts: { hurt:0..1 red flash, heat:0..1 orange glow }.
 */
export function drawAbomination(ctx, x, y, body, t, opts = {}) {
  if (!ctx) return;
  const o = opts || {};
  const b = (body && typeof body === 'object') ? body : {};
  const tt = num(t);
  const hurt = clamp01(o.hurt), heatOpt = clamp01(o.heat);
  const fx = ri(x), fy = ri(y);
  const breath = Math.sin(tt * 1.7);
  const bob = breath > 0.35 ? -1 : 0;
  const cx = fx + (Math.sin(tt * 0.55) > 0.7 ? 1 : 0);

  const head = limbInfo(b.head, 'head', hurt, heatOpt);
  const torso = limbInfo(b.torso, 'torso', hurt, heatOpt);
  const armL = limbInfo(b.armL, 'arm', hurt, heatOpt);
  const armR = limbInfo(b.armR, 'arm', hurt, heatOpt);
  const legL = limbInfo(b.legL, 'leg', hurt, heatOpt);
  const legR = limbInfo(b.legR, 'leg', hurt, heatOpt);

  const footY = fy - 1;
  const hipY = fy - 21;
  const torsoTop = fy - 47 + bob;
  const torsoBot = torsoTop + TORSO_H - 1;
  const shoulderY = torsoTop + 4;
  const headBase = torsoTop + 2;

  // ground shadow
  spans(ctx, cx - 11, fy - 1, [[0, 22], [2, 18]], mix(VOID, GRAVE, 0.45));

  // far side first for depth
  if (legL) drawLeg(ctx, cx - 6, hipY, footY, -1, legL, tt, true);
  else drawStump(ctx, cx - 6, hipY, -0.15, 1, 9, 7, tt, 11);
  if (armL) drawArm(ctx, cx - 9, shoulderY, -1, armL, tt, true);
  else drawStump(ctx, cx - 9, shoulderY + 1, -0.35, 1, 9, 6, tt, 23);

  if (legR) drawLeg(ctx, cx + 6, hipY, footY, 1, legR, tt, false);
  else drawStump(ctx, cx + 6, hipY, 0.15, 1, 9, 7, tt, 31);

  if (torso) drawTorso(ctx, cx, torsoTop, torso, tt);
  else {                                                     // hollow, torn ribcage
    const shell = ramp(TORSO_H - 6, [[0, 14], [0.2, 17], [1, 12]]);
    silhouette(ctx, cx, torsoTop + 6, shell, mix(FLESH, BLOOD, 0.5));
    for (let i = 0; i < 3; i++) rect(ctx, cx - 6, torsoTop + 9 + i * 4, 12, 1, BONE);
    fog(ctx, cx - 6, torsoTop + 8, 12, 12, INK, 0.5);
    seam(ctx, cx - 7, torsoTop + 6, 15, true, BONE);
    drip(ctx, cx + 2, torsoBot - 2, tt, 5, GORE);
  }

  if (armR) drawArm(ctx, cx + 9, shoulderY, 1, armR, tt, false);
  else drawStump(ctx, cx + 9, shoulderY + 1, 0.35, 1, 9, 6, tt, 7);

  if (head) drawHead(ctx, cx, headBase, head, tt);
  else {                                                     // headless: raw neck
    drawStump(ctx, cx, headBase, 0, -1, 7, 8, tt, 3);
    seam(ctx, cx - 5, headBase - 1, 11, true, BONE);
  }

  // brass joinery over every junction, so the thing reads as sewn together
  bolt(ctx, cx - 11, shoulderY - 1);
  bolt(ctx, cx + 10, shoulderY - 1);
  bolt(ctx, cx - 8, hipY - 1);
  bolt(ctx, cx + 7, hipY - 1);
  seam(ctx, cx - 4, headBase + 1, 9, true, BONE);

  if (heatOpt > 0.25) {                                      // heat haze
    fog(ctx, cx - 20, torsoTop - 6, 40, 20, EMBER, heatOpt * 0.3);
  }
  if (hurt > 0.02) {                                         // damage flash
    fog(ctx, cx - 24, fy - 63, 48, 63, GORE, hurt * 0.75);
    drawGore(ctx, cx, torsoTop + 12, 4 + Math.round(hurt * 4), tt, 17);
  }
}

/* ----------------------------------------------------------------- enemies */

/** Grafted thrall: patchwork brute, mismatched shoulder, rusted hook. */
function drawInjertado(ctx, ex, ey, c, t, seed) {
  const sway = Math.sin(t * 1.1);
  const bob = sway > 0.5 ? -1 : 0;
  const hipY = ey - 21, topY = ey - 43 + bob;
  taper(ctx, ex - 6, hipY, ex - 8, ey - 3, 8, 5, c);                 // flesh leg
  rect(ctx, ex - 12, ey - 3, 9, 2, dark(c, 0.3));
  rect(ctx, ex - 12, ey - 1, 9, 1, INK);
  taper(ctx, ex + 6, hipY, ex + 7, ey - 3, 8, 5, dark(c, 0.15));     // braced leg
  for (let i = 0; i < 3; i++) {
    rect(ctx, ex + 3, hipY + 4 + i * 5, 9, 1, mix(STONE, ASH, 0.3));
    bolt(ctx, ex + 4, hipY + 4 + i * 5);
  }
  rect(ctx, ex + 3, ey - 3, 9, 2, mix(STONE, GRAVE, 0.3));
  rect(ctx, ex + 3, ey - 1, 9, 1, INK);

  silhouette(ctx, ex, topY, ramp(22, [[0, 17], [0.15, 21], [0.6, 19], [1, 16]]), c);
  seam(ctx, ex, topY + 5, 14, false, BONE);                          // Y incision
  seam(ctx, ex - 6, topY + 2, 7, true, BONE);
  seam(ctx, ex, topY + 2, 7, true, BONE);
  for (let i = 0; i < 3; i++) rect(ctx, ex - 9, topY + 6 + i * 3, 6, 1, BONE);
  disc(ctx, ex - 10, topY + 3, 5, mix(BILE, c, 0.35));               // grafted hump
  ring(ctx, ex - 10, topY + 3, 5, INK);
  seam(ctx, ex - 14, topY + 2, 9, true, BONE);
  bolt(ctx, ex - 11, topY + 1);

  taper(ctx, ex - 12, topY + 5, ex - 17, ey - 20, 6, 4, mix(BILE, c, 0.3));
  taper(ctx, ex - 17, ey - 20, ex - 19 + Math.round(sway), ey - 11, 4, 3, mix(BILE, c, 0.3));
  taper(ctx, ex - 19 + Math.round(sway), ey - 11, ex - 15 + Math.round(sway), ey - 6, 3, 2, RUST);
  pixel(ctx, ex - 14 + Math.round(sway), ey - 7, mix(RUST, PALE, 0.4));
  taper(ctx, ex + 10, topY + 6, ex + 14, ey - 24, 6, 4, c);          // stubby arm
  disc(ctx, ex + 15, ey - 22, 3, c);
  for (let i = 0; i < 3; i++) rect(ctx, ex + 13 + i, ey - 20, 1, 3, c);

  const hx = ex + 2 + (sway > 0 ? 1 : 0);                            // lolling head
  silhouette(ctx, hx, topY - 12, [6, 9, 11, 11, 11, 10, 9, 8, 7, 6, 5], c);
  rect(ctx, hx - 4, topY - 8, 3, 3, INK);
  pixel(ctx, hx - 3, topY - 7, SPARK);
  seam(ctx, hx + 1, topY - 8, 4, true, BONE);                        // stitched eye
  pixel(ctx, hx + 2, topY - 9, BONE); pixel(ctx, hx + 4, topY - 7, BONE);
  rect(ctx, hx - 3, topY - 4, 7, 2, dark(BLOOD, 0.4));               // hanging jaw
  rect(ctx, hx - 1, topY - 3, 2, 2, GORE);
  drip(ctx, hx, topY - 1, t, seed, GORE);
}

/** Apprentice: hooded robe, goggles, a flask of something alive. */
function drawAprendiz(ctx, ex, ey, c, t, seed) {
  const sway = Math.round(Math.sin(t * 0.9) * 1);
  const robe = mix(c, VIOLET, 0.35);
  const hemY = ey - 3;
  rect(ctx, ex - 5, ey - 5, 4, 4, dark(BONE, 0.45));                 // boots
  rect(ctx, ex + 2, ey - 5, 4, 4, dark(BONE, 0.45));
  silhouette(ctx, ex, ey - 43, ramp(40, [[0, 10], [0.12, 15], [0.45, 19], [1, 25]]), robe);
  for (let i = 0; i < 4; i++) {                                      // folds
    rect(ctx, ex - 9 + i * 6 + sway, ey - 26, 1, 22, dark(robe, 0.35));
  }
  rect(ctx, ex - 12, hemY, 25, 1, dark(robe, 0.55));
  fog(ctx, ex - 13, ey - 10, 27, 9, INK, 0.45);
  rect(ctx, ex - 9, ey - 30, 19, 2, mix(BRASS, robe, 0.3));          // belt
  bolt(ctx, ex - 1, ey - 30);

  silhouette(ctx, ex, ey - 55, [4, 8, 12, 14, 14, 14, 13, 13, 12, 12, 13, 14], mix(robe, ARCANE, 0.3));
  rect(ctx, ex - 5, ey - 48, 11, 6, INK);                            // face void
  const lit = Math.sin(t * 2.4 + seed) > -0.3;
  rect(ctx, ex - 4, ey - 47, 3, 3, lit ? SPARK : RUST);              // goggles
  rect(ctx, ex + 2, ey - 47, 3, 3, lit ? SPARK : RUST);
  rect(ctx, ex - 1, ey - 46, 2, 1, BRASS);
  pixel(ctx, ex - 4, ey - 47, PALE); pixel(ctx, ex + 2, ey - 47, PALE);

  taper(ctx, ex - 8, ey - 36, ex - 5, ey - 26, 5, 4, robe);          // sleeves
  taper(ctx, ex + 8, ey - 36, ex + 5, ey - 26, 5, 4, robe);
  rect(ctx, ex - 6, ey - 26, 3, 2, BONE);
  rect(ctx, ex + 4, ey - 26, 3, 2, BONE);
  const pulse = Math.sin(t * 3) * 0.5 + 0.5;                         // flask
  disc(ctx, ex, ey - 25, 4, mix(ICHOR, ACID, pulse * 0.5));
  ring(ctx, ex, ey - 25, 4, mix(PALE, COLD, 0.4));
  ring(ctx, ex, ey - 25, 5, INK);
  rect(ctx, ex - 1, ey - 31, 3, 3, mix(PALE, COLD, 0.3));
  rect(ctx, ex - 1, ey - 32, 3, 1, BRASS);
  for (let i = 0; i < 3; i++) {
    const by = ey - 22 - Math.floor((t * 6 + i * 3) % 7);
    pixel(ctx, ex - 2 + i * 2, by, PALE);
  }
  for (let i = 0; i < 3; i++) {                                      // orbiting sparks
    const a = t * 1.4 + i * 2.09;
    pixel(ctx, ex + Math.round(Math.cos(a) * 9), ey - 25 + Math.round(Math.sin(a) * 6), ARCANE);
  }
}

/** Hound: flayed quadruped with an iron muzzle. */
function drawSabueso(ctx, ex, ey, c, t, seed) {
  const breath = Math.sin(t * 2.4) > 0.6 ? 1 : 0;
  const backY = ey - 26 - breath;
  for (let i = 0; i < 2; i++) {                                      // rear legs
    const lx = ex - 13 + i * 5;
    taper(ctx, lx, ey - 22, lx - 2, ey - 13, 6, 4, dark(c, i ? 0 : 0.2));
    taper(ctx, lx - 2, ey - 13, lx + 2, ey - 4, 4, 3, dark(c, i ? 0 : 0.2));
    rect(ctx, lx, ey - 4, 5, 2, dark(c, 0.35));
    rect(ctx, lx, ey - 2, 5, 1, INK);
    for (let j = 0; j < 3; j++) pixel(ctx, lx + 1 + j, ey - 1, BONE);
  }
  for (let i = 0; i < 2; i++) {                                      // front legs
    const lx = ex + 8 + i * 5;
    taper(ctx, lx, ey - 22, lx + 1, ey - 12, 5, 4, dark(c, i ? 0 : 0.2));
    taper(ctx, lx + 1, ey - 12, lx, ey - 4, 4, 3, dark(c, i ? 0 : 0.2));
    rect(ctx, lx - 2, ey - 4, 5, 2, dark(c, 0.35));
    rect(ctx, lx - 2, ey - 2, 5, 1, INK);
    for (let j = 0; j < 3; j++) pixel(ctx, lx - 1 + j, ey - 1, BONE);
  }
  slab(ctx, ex - 16, backY, 31, 13, c);                              // barrel body
  for (let i = 0; i < 5; i++) {                                      // ribs
    rect(ctx, ex - 4 + i * 4, backY + 2, 1, 9, BONE);
    pixel(ctx, ex - 4 + i * 4, backY + 11, dark(BONE, 0.5));
  }
  for (let i = 0; i < 6; i++) {                                      // spine spikes
    const sx = ex - 14 + i * 5;
    taper(ctx, sx, backY, sx + 1, backY - 4, 3, 1, BONE);
  }
  seam(ctx, ex - 10, backY + 6, 14, true, BONE);
  taper(ctx, ex - 18, backY + 4, ex - 26, backY + 1 + Math.round(Math.sin(t * 2.2) * 4), 4, 1, c);
  taper(ctx, ex + 14, backY + 3, ex + 20, backY - 3, 8, 6, c);       // neck
  silhouette(ctx, ex + 22, backY - 9, [5, 8, 10, 11, 11, 10, 9, 8, 7], c);
  rect(ctx, ex + 18, backY - 4, 12, 4, dark(c, 0.15));               // snout
  rect(ctx, ex + 18, backY - 1, 12, 1, INK);
  for (let i = 0; i < 3; i++) {                                      // muzzle bands
    rect(ctx, ex + 19 + i * 4, backY - 6, 1, 7, mix(STONE, ASH, 0.25));
    bolt(ctx, ex + 19 + i * 4, backY - 6);
  }
  rect(ctx, ex + 18, backY - 5, 12, 1, mix(STONE, PALE, 0.2));
  for (let i = 0; i < 5; i++) pixel(ctx, ex + 19 + i * 2, backY - 2, PALE);
  seam(ctx, ex + 21, backY - 7, 6, true, BONE);                      // stitched eyes
  pixel(ctx, ex + 23, backY - 8, SPARK);
  drip(ctx, ex + 26, backY, t, seed, mix(BILE, PALE, 0.2));
  fog(ctx, ex - 16, ey - 13, 31, 11, INK, 0.3);
}

/** Surgeon: tall, aproned, four tool arms and a mirror lamp for a face. */
function drawCirujano(ctx, ex, ey, c, t, seed) {
  const twitch = Math.sin(t * 5.2 + seed) > 0.8 ? 1 : 0;
  const shoulderY = ey - 44;
  taper(ctx, ex - 4, ey - 24, ex - 5, ey - 3, 5, 4, mix(STONE, GRAVE, 0.4));
  taper(ctx, ex + 4, ey - 24, ex + 5, ey - 3, 5, 4, mix(STONE, GRAVE, 0.4));
  rect(ctx, ex - 9, ey - 3, 6, 2, INK); rect(ctx, ex + 2, ey - 3, 6, 2, INK);
  silhouette(ctx, ex, shoulderY, ramp(22, [[0, 15], [0.3, 17], [1, 15]]), c);
  const apron = mix(PALE, BONE, 0.4);                                // bloodied apron
  silhouette(ctx, ex, ey - 38, ramp(28, [[0, 12], [0.2, 16], [1, 20]]), apron);
  fog(ctx, ex - 10, ey - 30, 20, 18, GORE, 0.3);
  for (let i = 0; i < 4; i++) {
    const gx = ex - 7 + ((seed >> (i * 3)) & 7) * 2, gy = ey - 32 + i * 6;
    disc(ctx, gx, gy, 1 + (i & 1), BLOOD);
    pixel(ctx, gx + 1, gy + 1, GORE);
  }
  rect(ctx, ex - 6, ey - 40, 13, 1, dark(apron, 0.3));               // apron straps
  line(ctx, ex - 5, ey - 40, ex - 2, ey - 44, dark(apron, 0.35));
  line(ctx, ex + 5, ey - 40, ex + 2, ey - 44, dark(apron, 0.35));

  for (let s = -1; s <= 1; s += 2) {                                 // four arms
    const hi = s > 0 ? 0 : 1;
    taper(ctx, ex + s * 7, shoulderY + 2, ex + s * 17, ey - 34 + twitch, 4, 3, c);
    taper(ctx, ex + s * 7, shoulderY + 8, ex + s * 15, ey - 22 - twitch, 4, 3, dark(c, 0.15));
    rect(ctx, ex + s * 17 - 1, ey - 35 + twitch, 3, 3, BONE);
    rect(ctx, ex + s * 15 - 1, ey - 23 - twitch, 3, 3, BONE);
    if (hi) {                                                        // scalpel + forceps
      taper(ctx, ex - 17, ey - 32 + twitch, ex - 19, ey - 24 + twitch, 2, 1, PALE);
      pixel(ctx, ex - 19, ey - 23 + twitch, BLOOD);
      taper(ctx, ex - 15, ey - 20 - twitch, ex - 18, ey - 13 - twitch, 3, 1, mix(STONE, PALE, 0.3));
      taper(ctx, ex - 15, ey - 20 - twitch, ex - 13, ey - 13 - twitch, 3, 1, mix(STONE, PALE, 0.3));
    } else {                                                         // bone saw + syringe
      rect(ctx, ex + 16, ey - 32 + twitch, 2, 9, mix(PALE, STONE, 0.2));
      for (let i = 0; i < 5; i++) pixel(ctx, ex + 18, ey - 31 + twitch + i * 2, PALE);
      rect(ctx, ex + 14, ey - 20 - twitch, 3, 6, mix(PALE, COLD, 0.35));
      rect(ctx, ex + 15, ey - 18 - twitch, 1, 3, ICHOR);
      rect(ctx, ex + 15, ey - 14 - twitch, 1, 4, mix(PALE, STONE, 0.2));
    }
  }
  ring(ctx, ex, ey - 52, 7, BRASS);                                  // mirror lamp
  ring(ctx, ex, ey - 52, 6, mix(BRASS, SPARK, 0.4));
  for (let i = 0; i < 4; i++) {
    const a = t * 0.9 + i * 1.57;
    pixel(ctx, ex + Math.round(Math.cos(a) * 7), ey - 52 + Math.round(Math.sin(a) * 7), SPARK);
  }
  silhouette(ctx, ex, ey - 54, [6, 9, 10, 10, 10, 9, 8, 7, 6, 6], mix(c, PALE, 0.25));
  rect(ctx, ex - 4, ey - 50, 9, 4, dark(BONE, 0.2));                 // surgical mask
  rect(ctx, ex - 4, ey - 47, 9, 1, dark(BONE, 0.45));
  rect(ctx, ex - 3, ey - 52, 3, 2, INK);
  disc(ctx, ex + 3, ey - 51, 2, mix(COLD, PALE, 0.3));               // lens eye
  ring(ctx, ex + 3, ey - 51, 2, BRASS);
  glint(ctx, ex + 2, ey - 52, t, seed);
}

/** Librarian: a bloated mass of books, quills and unblinking eyes. */
function drawBibliotecario(ctx, ex, ey, c, t, seed) {
  const body = mix(c, GRAVE, 0.2);
  silhouette(ctx, ex, ey - 40, ramp(39, [[0, 13], [0.18, 21], [0.5, 30], [0.85, 34], [1, 30]]), body);
  fog(ctx, ex - 15, ey - 12, 31, 10, INK, 0.4);
  for (let i = 0; i < 7; i++) {                                      // embedded spines
    const h = hash(seed + i * 7);
    const bx = ex - 13 + (h % 22), by = ey - 30 + ((h >> 5) % 22);
    const bh = 5 + (h >> 11) % 4;
    const bc = [BLOOD, COPPER, BILE, VIOLET][(h >> 3) & 3];
    rect(ctx, bx, by, 3, bh, bc);
    rect(ctx, bx, by, 1, bh, lite(bc, 0.25));
    rect(ctx, bx, by + 1, 3, 1, BRASS);
    rect(ctx, bx, by + bh - 2, 3, 1, BRASS);
    rect(ctx, bx - 1, by, 1, bh, INK);
    rect(ctx, bx + 3, by, 1, bh, INK);
  }
  for (let i = 0; i < 5; i++) {                                      // eyes out of phase
    const h = hash(seed * 3 + i * 13);
    const px0 = ex - 11 + (h % 20), py0 = ey - 37 + ((h >> 6) % 12);
    const open = Math.sin(t * 1.6 + i * 1.3) > -0.4;
    rect(ctx, px0, py0, 3, open ? 3 : 1, open ? PALE : dark(body, 0.5));
    if (open) { pixel(ctx, px0 + 1, py0 + 1, INK); pixel(ctx, px0, py0, ACID); }
  }
  seam(ctx, ex - 6, ey - 22, 13, true, BONE);                        // sewn mouth
  for (let i = 0; i < 3; i++) {                                      // quills
    const qx = ex - 8 + i * 8, qy = ey - 33 + i * 3;
    const flutter = Math.round(Math.sin(t * 2.1 + i) * 1);
    line(ctx, qx, qy, qx + 3 + flutter, qy - 9, BONE);
    pixel(ctx, qx + 3 + flutter, qy - 10, PALE);
    pixel(ctx, qx, qy + 1, INK);
  }
  for (let i = 0; i < 3; i++) drip(ctx, ex - 9 + i * 9, ey - 8, t * 0.8, seed + i, mix(VIOLET, INK, 0.3));
  const fx = ex + 19 + Math.round(Math.sin(t * 1.3) * 2);            // chained tome
  const fy = ey - 34 + Math.round(Math.cos(t * 1.1) * 3);
  line(ctx, ex + 12, ey - 28, fx, fy + 3, mix(STONE, ASH, 0.3));
  slab(ctx, fx - 3, fy, 7, 6, COPPER, true);
  rect(ctx, fx - 3, fy, 2, 6, BLOOD);
  pixel(ctx, fx + 1, fy + 2, SPARK);
  drawSigil(ctx, fx - 2, fy + 1, 5, seed + 4);
}

/** Archalchemist: the boss. ~72x80, crystal crown, six arms, a caged heart. */
function drawArchialquimista(ctx, ex, ey, c, t, seed) {
  const hover = Math.round(Math.sin(t * 1.05) * 2);
  const base = ey - 4 + hover;
  const robe = mix(c, VIOLET, 0.3);
  fog(ctx, ex - 16, ey - 10, 33, 10, ARCANE, 0.35);                  // wisp under the hem
  silhouette(ctx, ex, base - 48, ramp(48, [[0, 14], [0.15, 22], [0.55, 30], [1, 34]]), robe);
  for (let i = 0; i < 5; i++) rect(ctx, ex - 13 + i * 6, base - 26, 1, 22, dark(robe, 0.4));
  rect(ctx, ex - 17, base - 2, 35, 1, dark(robe, 0.6));
  rect(ctx, ex - 15, base - 6, 31, 2, BRASS);                        // gold trim
  rect(ctx, ex - 15, base - 5, 31, 1, RUST);
  drawSigil(ctx, ex - 13, base - 20, 9, seed + 1);
  drawSigil(ctx, ex + 5, base - 20, 9, seed + 2);

  const chestY = base - 46;                                          // opened ribcage
  rect(ctx, ex - 8, chestY, 17, 16, INK);
  for (let i = 0; i < 4; i++) {
    rect(ctx, ex - 8, chestY + 1 + i * 4, 4, 1, BONE);
    rect(ctx, ex + 5, chestY + 1 + i * 4, 4, 1, BONE);
  }
  const pulse = Math.sin(t * 2.8) * 0.5 + 0.5;
  disc(ctx, ex, chestY + 7, 3 + Math.round(pulse), mix(FIRE, SPARK, pulse));
  ring(ctx, ex, chestY + 7, 5, BRASS);
  fog(ctx, ex - 10, chestY, 21, 16, EMBER, 0.25 + pulse * 0.25);
  drawClockFace(ctx, ex, chestY + 7, 5, (Math.sin(t * 0.25) * 0.5 + 0.5), t);

  for (let s = -1; s <= 1; s += 2) {                                 // six arms
    for (let i = 0; i < 3; i++) {
      const wave = Math.sin(t * 1.3 + i * 1.1 + (s > 0 ? 0 : 2)) * 2;
      const sy = chestY + 2 + i * 5;
      const hx = ex + s * (18 + i * 4), hy = sy + 10 + i * 5 + Math.round(wave);
      taper(ctx, ex + s * 8, sy, ex + s * 14, sy + 7, 5, 4, mix(c, FLESH, 0.3));
      taper(ctx, ex + s * 14, sy + 7, hx, hy, 4, 3, mix(c, FLESH, 0.3));
      rect(ctx, ex + s * 14 - 1, sy + 6, 3, 2, BRASS);
      disc(ctx, hx, hy, 2, mix(c, PALE, 0.2));
      if (i === 0 && s < 0) {                                        // flask
        disc(ctx, hx - 2, hy + 4, 3, ICHOR);
        ring(ctx, hx - 2, hy + 4, 3, mix(PALE, COLD, 0.3));
        rect(ctx, hx - 3, hy + 1, 3, 2, BRASS);
      } else if (i === 0) {                                          // curved blade
        taper(ctx, hx, hy + 2, hx + 4, hy + 13, 4, 1, mix(PALE, STONE, 0.2));
        glint(ctx, hx + 2, hy + 7, t, seed + i);
      } else if (i === 1 && s < 0) {                                 // sigil orb
        disc(ctx, hx - 1, hy + 4, 4, mix(ARCANE, VIOLET, 0.4));
        ring(ctx, hx - 1, hy + 4, 4, SPARK);
        drawSigil(ctx, hx - 4, hy + 1, 7, seed + 3);
      } else if (i === 1) {                                          // censer
        slab(ctx, hx - 2, hy + 3, 5, 4, BRASS, true);
        drawSmoke(ctx, hx - 3, hy - 6, 7, 9, t, 0.55);
      } else if (s < 0) {                                            // bone sceptre
        taper(ctx, hx, hy - 6, hx, hy + 8, 2, 2, BONE);
        disc(ctx, hx, hy - 7, 2, PALE);
        pixel(ctx, hx, hy - 7, ARCANE);
      } else {                                                       // talons
        for (let k = 0; k < 3; k++) taper(ctx, hx + k - 1, hy + 2, hx + (k - 1) * 3, hy + 7, 2, 1, BONE);
      }
    }
  }

  const headY = base - 62;                                           // gaunt face
  silhouette(ctx, ex, headY, [8, 12, 15, 16, 16, 16, 15, 14, 13, 12, 11, 10, 9, 8], mix(c, BONE, 0.35));
  rect(ctx, ex - 6, headY + 5, 4, 4, INK);
  rect(ctx, ex + 3, headY + 5, 4, 4, INK);
  pixel(ctx, ex - 5, headY + 6, ARCANE); pixel(ctx, ex + 4, headY + 6, ARCANE);
  pixel(ctx, ex - 4, headY + 7, VIOLET); pixel(ctx, ex + 5, headY + 7, VIOLET);
  rect(ctx, ex - 4, headY + 11, 9, 1, dark(BONE, 0.55));
  for (let i = 0; i < 4; i++) pixel(ctx, ex - 3 + i * 2, headY + 12, BONE);
  seam(ctx, ex - 7, headY + 3, 15, true, BONE);
  for (let i = 0; i < 5; i++) {                                      // crystal crown
    const kx = ex - 8 + i * 4, kh = i === 2 ? 9 : 6 - Math.abs(i - 2);
    taper(ctx, kx, headY - 1, kx, headY - kh, 3, 1, mix(ARCANE, COLD, 0.35));
    pixel(ctx, kx, headY - kh, PALE);
    if (Math.sin(t * 2.6 + i * 1.4) > 0.3) pixel(ctx, kx, headY - kh + 1, SPARK);
  }
  rect(ctx, ex - 9, headY - 1, 19, 2, BRASS);
  rect(ctx, ex - 9, headY, 19, 1, RUST);
  for (let i = 0; i < 4; i++) {                                      // orbiting motes
    const a = t * 0.8 + i * 1.57;
    pixel(ctx, ex + Math.round(Math.cos(a) * 24), headY + 6 + Math.round(Math.sin(a) * 10), ARCANE);
  }
}

/**
 * One distinct sprite per enemy id, about 56x64 (the boss is ~72x80).
 * (x,y) is the centred foot position. opts: { hurt:0..1, dead:0..1 }.
 */
export function drawEnemy(ctx, x, y, enemyId, t, opts = {}) {
  if (!ctx) return;
  const o = opts || {};
  const tt = num(t);
  const hurt = clamp01(o.hurt), dead = clamp01(o.dead);
  const id = String(enemyId == null ? '' : enemyId);
  const def = ENEMIES[id] || null;
  const boss = id === 'archialquimista';
  const sink = Math.round(dead * 10);
  const ex = ri(x), ey = ri(y) + sink;
  const seed = hashStr(id) & 0x7fff;
  let c = col(def && def.color);
  if (hurt > 0.02) c = mix(c, GORE, Math.min(0.85, hurt * 0.85));
  if (dead > 0.02) c = mix(c, GRAVE, dead * 0.5);

  const halfW = boss ? 36 : 28, height = boss ? 80 : 64;
  spans(ctx, ex - (boss ? 15 : 12), ey - 1,
    [[0, boss ? 30 : 24], [2, boss ? 26 : 20]], mix(VOID, GRAVE, 0.45));

  switch (id) {
    case 'injertado': drawInjertado(ctx, ex, ey, c, tt, seed); break;
    case 'aprendiz': drawAprendiz(ctx, ex, ey, c, tt, seed); break;
    case 'sabueso': drawSabueso(ctx, ex, ey, c, tt, seed); break;
    case 'cirujano': drawCirujano(ctx, ex, ey, c, tt, seed); break;
    case 'bibliotecario': drawBibliotecario(ctx, ex, ey, c, tt, seed); break;
    case 'archialquimista': drawArchialquimista(ctx, ex, ey, c, tt, seed); break;
    default: {                                                       // unknown id
      const bob = Math.sin(tt * 1.4) > 0.4 ? -1 : 0;
      silhouette(ctx, ex, ey - 40 + bob, ramp(39, [[0, 10], [0.2, 18], [1, 24]]), c);
      rect(ctx, ex - 4, ey - 33 + bob, 3, 3, INK);
      rect(ctx, ex + 2, ey - 33 + bob, 3, 3, INK);
      pixel(ctx, ex - 3, ey - 32 + bob, SPARK);
      pixel(ctx, ex + 3, ey - 32 + bob, SPARK);
      seam(ctx, ex - 6, ey - 26 + bob, 13, true, BONE);
      fog(ctx, ex - 12, ey - 12, 25, 11, INK, 0.4);
      break;
    }
  }

  if (hurt > 0.02) fog(ctx, ex - halfW, ey - height, halfW * 2, height, GORE, hurt * 0.6);
  if (dead > 0.02) {
    fog(ctx, ex - halfW, ey - height, halfW * 2, height, VOID, dead * 0.55);
    drawGore(ctx, ex, ey - 4, 5 + Math.round(dead * 7), tt, seed);
  }
}

/* --------------------------------------------------------------- backdrops */

/** Upper half of a circle, plotted column by column (no ctx.arc). */
function archTop(ctx, cx, cy, r, color) {
  for (let dx = -r; dx <= r; dx++) {
    const dy = Math.round(Math.sqrt(Math.max(0, r * r - dx * dx)));
    pixel(ctx, cx + dx, cy - dy, color);
  }
}

/** Deterministic stone courses. */
function masonry(ctx, x, y, w, h, seed) {
  const bh = 8, bw = 16;
  for (let r = 0; r * bh < h; r++) {
    const yy = y + r * bh;
    const hh = Math.min(bh, y + h - yy);
    if (hh <= 1) break;
    const off = (r & 1) ? -8 : 0;
    for (let cxx = x + off; cxx < x + w; cxx += bw) {
      const k = hash(seed + r * 131 + cxx * 7);
      const shade = mix(STONE, (k & 1) ? GRAVE : ASH, 0.2 + (k % 5) * 0.07);
      const x0 = Math.max(x, cxx), x1 = Math.min(x + w, cxx + bw - 1);
      if (x1 - x0 < 2) continue;
      rect(ctx, x0, yy, x1 - x0, hh - 1, shade);
      rect(ctx, x0, yy + hh - 2, x1 - x0, 1, dark(shade, 0.45));
    }
  }
}

/** Wall bracket plus flame, flickering with t. */
function torch(ctx, x, y, t, seed) {
  rect(ctx, x - 1, y, 3, 5, COPPER);
  rect(ctx, x, y, 1, 5, BRASS);
  rect(ctx, x - 2, y + 5, 5, 2, RUST);
  const h = 7 + Math.round(Math.sin(t * 9.1 + seed) * 2 + Math.sin(t * 5.3) * 1);
  drawFlame(ctx, x, y - 1, h, t + seed * 0.3, 'fire');
  fog(ctx, x - 9, y - 14, 19, 20, EMBER, 0.14 + Math.abs(Math.sin(t * 3 + seed)) * 0.1);
}

/**
 * Atmospheric room art, clipped to the given rect. One distinct look per room
 * type; the upper floors burn harder. Layout is deterministic in `floor`.
 */
export function drawBackdrop(ctx, x, y, w, h, roomType, floor, t) {
  if (!ctx) return;
  const bx = ri(x), by = ri(y), bw = ri(w), bh = ri(h);
  if (bw < 8 || bh < 8) return;
  const tt = num(t);
  const fl = Math.max(0, Math.min(3, Math.round(num(floor))));
  const type = String(roomType == null ? '' : roomType);
  const heat = fl / 3;
  const seed = 1000 + fl * 7919 + hashStr(type);
  const canClip = typeof ctx.save === 'function' && typeof ctx.clip === 'function'
    && typeof ctx.beginPath === 'function' && typeof ctx.rect === 'function';
  if (canClip) { ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip(); }

  const floorY = by + bh - Math.max(4, Math.round(bh * 0.24));
  const cx = bx + (bw >> 1);
  rect(ctx, bx, by, bw, bh, VOID);
  masonry(ctx, bx, by, bw, floorY - by, seed);
  fog(ctx, bx, by, bw, Math.min(14, Math.max(2, Math.round(bh * 0.13))), VOID, 0.42);  // ceiling gloom
  rect(ctx, bx, floorY, bw, bh - (floorY - by), mix(GRAVE, INK, 0.35));     // floor
  rect(ctx, bx, floorY, bw, 1, dark(STONE, 0.2));
  for (let i = 0; i * 18 < bw + 18; i++) {                                  // flagstones
    rect(ctx, bx + i * 18, floorY + 2, 1, bh, mix(ASH, INK, 0.5));
  }

  switch (type) {
    case 'slab': {                                                          // dissection table
      const tw = Math.max(20, Math.round(bw * 0.4)), th = 6;
      const ty = floorY - 2;
      slab(ctx, cx - (tw >> 1), ty, tw, th, mix(STONE, PALE, 0.22));
      rect(ctx, cx - (tw >> 1) + 2, ty + th, 3, 8, mix(STONE, ASH, 0.3));
      rect(ctx, cx + (tw >> 1) - 5, ty + th, 3, 8, mix(STONE, ASH, 0.3));
      for (let i = 0; i < 3; i++) {                                         // leather straps
        const sx = cx - (tw >> 1) + 4 + Math.round(i * (tw - 10) / 2);
        rect(ctx, sx, ty - 1, 2, th + 1, RUST);
        bolt(ctx, sx, ty + 1);
      }
      rect(ctx, cx - (tw >> 2), ty - 1, tw >> 1, 1, mix(BLOOD, STONE, 0.4));
      drawGore(ctx, cx, ty + 1, 7, tt, seed);
      for (let i = 0; i < 5; i++) {                                         // ceiling drips
        const dx = bx + 8 + ((hash(seed + i * 17) % Math.max(1, bw - 16)));
        drip(ctx, dx, by + 2 + (hash(seed + i) % 5), tt * 0.6, seed + i, mix(BILE, ICHOR, 0.3));
      }
      const lampY = by + Math.round(bh * 0.12);                             // hanging lamp
      line(ctx, cx + 14, by, cx + 14, lampY, mix(ASH, STONE, 0.4));
      slab(ctx, cx + 10, lampY, 9, 4, BRASS, true);
      rect(ctx, cx + 11, lampY + 4, 7, 1, SPARK);
      fog(ctx, cx + 4, lampY + 5, 21, 18, SPARK, 0.13);
      break;
    }
    case 'combat': {                                                        // arched corridor
      for (let i = 2; i >= 0; i--) {
        const f = 0.45 + i * 0.27;
        const aw = Math.round(bw * 0.4 * f), ah = Math.round((floorY - by) * f);
        const ay = floorY - ah;
        const acol = mix(STONE, INK, 0.25 + i * 0.18);
        rect(ctx, cx - (aw >> 1), ay, 3, ah, acol);
        rect(ctx, cx + (aw >> 1) - 2, ay, 3, ah, acol);
        archTop(ctx, cx, ay + (aw >> 1), aw >> 1, lite(acol, 0.15));
        archTop(ctx, cx, ay + (aw >> 1) + 1, aw >> 1, dark(acol, 0.3));
        if (i === 0) {                                                    // depth of the far arch
          rect(ctx, cx - (aw >> 1) + 3, ay, Math.max(1, aw - 6), ah, VOID);
          fog(ctx, cx - (aw >> 1), ay, aw, Math.min(ah, 12), VOID, 0.5);
        }
      }
      for (let i = 0; i < 4; i++) {                                         // hanging chains
        const chx = bx + 10 + Math.round(i * (bw - 20) / 3);
        line(ctx, chx, by, chx, by + 6 + (hash(seed + i) % 10), mix(ASH, RUST, 0.4));
        pixel(ctx, chx, by + 7 + (hash(seed + i) % 10), RUST);
      }
      break;
    }
    case 'salvage': {                                                       // shelves of jars
      const rows = Math.max(1, Math.min(3, Math.floor((floorY - by) / 16)));
      for (let r = 0; r < rows; r++) {
        const sy = by + 8 + r * 16;
        rect(ctx, bx + 4, sy + 10, bw - 8, 2, mix(COPPER, RUST, 0.5));
        rect(ctx, bx + 4, sy + 12, bw - 8, 1, INK);
        const jars = Math.max(1, Math.floor((bw - 12) / 9));
        for (let j = 0; j < jars; j++) {
          const k = hash(seed + r * 61 + j * 13);
          if ((k & 7) === 0) continue;
          const jx = bx + 7 + j * 9;
          const jc = [ICHOR, BILE, BLOOD, ARCANE, ACID][k % 5];
          rect(ctx, jx, sy + 3, 6, 7, mix(jc, INK, 0.45));
          rect(ctx, jx, sy + 5, 6, 5, jc);
          rect(ctx, jx, sy + 3, 1, 7, mix(PALE, jc, 0.5));
          rect(ctx, jx + 1, sy + 1, 4, 2, BRASS);
          rect(ctx, jx - 1, sy + 3, 1, 7, INK);
          rect(ctx, jx + 6, sy + 3, 1, 7, INK);
          pixel(ctx, jx + 3, sy + 6 - Math.floor((tt * 4 + j) % 4), PALE);   // specimen bubble
        }
      }
      panel(ctx, bx + 3, by + 3, bw - 6, floorY - by - 4, mix(COPPER, INK, 0.5), null);
      break;
    }
    case 'trap': {                                                          // blades and valves
      const swing = Math.sin(tt * 1.6);
      const px0 = cx + Math.round(swing * bw * 0.22);
      line(ctx, cx, by, px0, by + Math.round(bh * 0.4), mix(ASH, STONE, 0.35));
      const by0 = by + Math.round(bh * 0.4);
      taper(ctx, px0, by0, px0 + Math.round(swing * 6), by0 + 12, 11, 2, mix(PALE, STONE, 0.3));
      line(ctx, px0 - 5, by0, px0 + 5, by0, INK);
      glint(ctx, px0, by0 + 6, tt, seed);
      for (let i = 0; i < 3; i++) {                                         // steam valves
        const vx = bx + 12 + Math.round(i * (bw - 24) / 2), vy = floorY - 16;
        ring(ctx, vx, vy, 4, BRASS);
        ring(ctx, vx, vy, 3, dark(BRASS, 0.4));
        for (let k = 0; k < 4; k++) {
          const a = tt * 0.7 + k * 1.57 + i;
          pixel(ctx, vx + Math.round(Math.cos(a) * 3), vy + Math.round(Math.sin(a) * 3), COPPER);
        }
        rect(ctx, vx - 1, vy + 4, 3, 12, COPPER);
        if (Math.sin(tt * 1.3 + i * 2) > 0.4) drawSmoke(ctx, vx - 5, vy - 16, 11, 14, tt, 0.65);
      }
      for (let i = 0; i * 7 < bw; i++) {                                    // floor spikes
        taper(ctx, bx + 3 + i * 7, floorY + 5, bx + 3 + i * 7, floorY, 3, 1, mix(STONE, PALE, 0.25));
      }
      break;
    }
    case 'forge': {                                                         // furnace at red heat
      const fw = Math.max(16, Math.min(96, Math.round(bw * 0.34)));
      const fh = Math.max(12, Math.min(64, Math.round(bh * 0.4)));
      const fx0 = cx - (fw >> 1), fy0 = floorY - fh;
      slab(ctx, fx0 - 3, fy0 - 3, fw + 6, fh + 3, mix(STONE, RUST, 0.3));
      rect(ctx, fx0, fy0, fw, fh, INK);
      archTop(ctx, cx, fy0 + (fw >> 1), fw >> 1, RUST);
      const glow = Math.sin(tt * 2.2) * 0.5 + 0.5;
      rect(ctx, fx0 + 2, fy0 + 3, fw - 4, fh - 4, mix(EMBER, FIRE, glow * 0.6));
      fog(ctx, fx0 + 2, fy0 + 3, fw - 4, fh - 4, SPARK, 0.3 + glow * 0.3);
      for (let i = 0; i < 4; i++) drawFlame(ctx, fx0 + 4 + i * ((fw - 8) / 3), floorY - 2, 8 + (i & 1) * 4, tt + i, 'fire');
      fog(ctx, fx0 - 6, fy0 - 6, fw + 12, Math.min(fh + 10, 30), EMBER, 0.18);
      slab(ctx, bx + 6, floorY - 6, 14, 5, mix(STONE, ASH, 0.2));           // anvil
      rect(ctx, bx + 9, floorY - 1, 8, 1, INK);
      for (let i = 0; i < 6; i++) {                                         // sparks
        const p = (tt * 1.3 + i * 0.31) % 1;
        pixel(ctx, cx + Math.round(Math.sin(i * 2.7 + tt) * fw * 0.5),
          floorY - Math.round(p * bh * 0.6), p < 0.5 ? SPARK : EMBER);
      }
      break;
    }
    case 'stairs': {                                                        // spiral descent
      const steps = Math.max(4, Math.min(9, Math.floor(bh / 7)));
      for (let i = 0; i < steps; i++) {
        const f = i / steps;
        const sw = Math.round(bw * (0.5 - f * 0.3));
        const sxx = cx - (sw >> 1) + Math.round(Math.sin(f * 3.1) * bw * 0.12);
        const syy = floorY - 2 - i * Math.max(3, Math.round(bh * 0.09));
        slab(ctx, sxx, syy, sw, 3, mix(STONE, i & 1 ? GRAVE : ASH, 0.3), false);
        rect(ctx, sxx, syy + 3, sw, 1, INK);
      }
      rect(ctx, cx - 2, by, 5, floorY - by, mix(STONE, INK, 0.4));          // newel
      rect(ctx, cx - 2, by, 1, floorY - by, mix(ASH, PALE, 0.15));
      line(ctx, bx + 4, floorY - 4, cx, by + Math.round(bh * 0.2), mix(COPPER, RUST, 0.4));
      fog(ctx, bx, floorY - 6, bw, Math.min(bh, 18), VOID, 0.45);           // darkness below
      break;
    }
    case 'exit': {                                                          // sealed gate
      const gw = Math.max(24, Math.round(bw * 0.46)), gh = floorY - by - 6;
      const gx = cx - (gw >> 1), gy = by + 6;
      slab(ctx, gx - 4, gy - 4, gw + 8, gh + 4, mix(STONE, GRAVE, 0.3));
      rect(ctx, gx, gy, gw, gh, mix(RUST, INK, 0.35));
      archTop(ctx, cx, gy + (gw >> 1), gw >> 1, mix(COPPER, RUST, 0.4));
      rect(ctx, cx - 1, gy, 2, gh, INK);
      for (let i = 0; i * 10 < gh; i++) {                                   // rivets
        bolt(ctx, gx + 2, gy + 4 + i * 10);
        bolt(ctx, gx + gw - 4, gy + 4 + i * 10);
      }
      rect(ctx, gx - 2, gy + Math.round(gh * 0.55), gw + 4, 3, mix(ASH, STONE, 0.3));  // bar
      rect(ctx, gx - 2, gy + Math.round(gh * 0.55) + 3, gw + 4, 1, INK);
      for (let i = 0; i < 3; i++) {
        const sy = gy + 8 + i * Math.round(gh * 0.28);
        fog(ctx, cx - 10, sy - 3, 21, 17, ARCANE, 0.14 + Math.abs(Math.sin(tt * 1.2 + i)) * 0.12);
        drawSigil(ctx, cx - 5, sy, 11, seed + i * 3);
      }
      fog(ctx, gx - 4, gy + gh - 12, gw + 8, 12, ARCANE, 0.1 + Math.abs(Math.sin(tt * 1.2)) * 0.1);
      break;
    }
    default: {                                                              // bare corridor
      for (let i = 0; i < 3; i++) {
        const dx0 = bx + 6 + Math.round(i * (bw - 12) / 2);
        rect(ctx, dx0, by + 4, 2, Math.round(bh * 0.3), mix(ASH, INK, 0.45));
      }
      break;
    }
  }

  // torches on both walls
  torch(ctx, bx + Math.max(6, Math.round(bw * 0.09)), by + Math.round(bh * 0.34), tt, 1);
  torch(ctx, bx + bw - Math.max(6, Math.round(bw * 0.09)), by + Math.round(bh * 0.4), tt, 5);

  // the upper floors burn: soot, embers and smoke, thicker the higher you are
  if (heat > 0) {
    fog(ctx, bx, by, bw, Math.min(12, Math.max(3, Math.round(bh * 0.08 + heat * bh * 0.06))),
      ASH, 0.2 + heat * 0.25);
    if (fl >= 2) {
      const n = fl === 3 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const gx = bx + 10 + Math.round(i * (bw - 20) / Math.max(1, n - 1 || 1));
        drawFlame(ctx, gx, floorY + 2, 6 + ((hash(seed + i) % 4)), tt + i * 0.7, 'ember');
        drawSmoke(ctx, gx - 5, floorY - 22, 11, 20, tt + i, 0.35 + heat * 0.3);
      }
    }
  }
  const vig = Math.min(10, Math.max(2, Math.round(bh * 0.12)));             // vignette bands
  fog(ctx, bx, by, bw, vig, VOID, 0.1 + (1 - heat) * 0.08);
  fog(ctx, bx, by + bh - vig, bw, vig, VOID, 0.1 + (1 - heat) * 0.08);

  // falling ash
  const ashN = Math.max(4, Math.min(26, Math.round(bw * bh / 900)));
  for (let i = 0; i < ashN; i++) {
    const ax = bx + (hash(seed + i * 29) % bw);
    const spd = 5 + (hash(seed + i * 13) % 12);
    const ay = by + Math.floor((((hash(seed + i * 7) % bh) + tt * spd) % bh));
    pixel(ctx, ax + Math.round(Math.sin(tt * 0.9 + i) * 1.5), ay, (i % 4) ? ASH : EMBER);
  }

  if (canClip) ctx.restore();
}

/* ------------------------------------------------------------- slot icons */

/** 10x10 icon per slot; filled=false draws the bandaged stump instead. */
export function drawSlotIcon(ctx, x, y, slot, filled) {
  if (!ctx) return;
  const ix = ri(x), iy = ri(y);
  const s = String(slot == null ? '' : slot);
  const left = s === 'armL' || s === 'legL';
  const dir = left ? -1 : 1;
  if (!filled) {                                                            // stump
    const meat = mix(FLESH, BLOOD, 0.35);
    spans(ctx, ix + 2, iy + 2, [[1, 5], [0, 7], [0, 7], [1, 5]], meat);
    rect(ctx, ix + 2, iy + 6, 7, 1, BONE);
    rect(ctx, ix + 2, iy + 7, 7, 1, PALE);
    pixel(ctx, ix + 5, iy + 3, GORE);
    pixel(ctx, ix + 4, iy + 8, GORE);
    pixel(ctx, ix + 6, iy + 9, BLOOD);
    return;
  }
  switch (s) {
    case 'head':
      spans(ctx, ix + 2, iy + 1, [[1, 5], [0, 7], [0, 7], [0, 7], [1, 5], [1, 5], [2, 3]], BONE);
      pixel(ctx, ix + 3, iy + 4, INK); pixel(ctx, ix + 6, iy + 4, INK);
      pixel(ctx, ix + 4, iy + 6, INK); pixel(ctx, ix + 6, iy + 6, INK);
      rect(ctx, ix + 3, iy + 1, 5, 1, PALE);
      break;
    case 'torso':
      rect(ctx, ix + 2, iy + 1, 7, 8, FLESH);
      rect(ctx, ix + 2, iy + 8, 7, 1, dark(FLESH, 0.45));
      rect(ctx, ix + 2, iy + 1, 7, 1, lite(FLESH, 0.25));
      for (let i = 0; i < 3; i++) rect(ctx, ix + 3, iy + 3 + i * 2, 5, 1, BONE);
      rect(ctx, ix + 5, iy + 2, 1, 6, dark(FLESH, 0.55));
      break;
    case 'armL': case 'armR': {
      const ax = ix + (left ? 6 : 3);
      rect(ctx, ax, iy + 1, 2, 5, FLESH);
      rect(ctx, ax, iy + 1, 1, 5, lite(FLESH, 0.22));
      rect(ctx, ax + dir, iy + 5, 2, 3, FLESH);
      for (let i = 0; i < 3; i++) pixel(ctx, ax + dir * 2 + (left ? 0 : i - 1), iy + 8 + (i & 1), BONE);
      pixel(ctx, ax, iy + 4, BRASS);
      break;
    }
    case 'legL': case 'legR': {
      const lx = ix + (left ? 5 : 4);
      rect(ctx, lx, iy + 1, 3, 5, FLESH);
      rect(ctx, lx, iy + 1, 1, 5, lite(FLESH, 0.22));
      rect(ctx, lx, iy + 6, 2, 2, dark(FLESH, 0.2));
      rect(ctx, lx - (left ? 2 : 0), iy + 8, 4, 2, BONE);
      pixel(ctx, lx + 1, iy + 5, BRASS);
      break;
    }
    default:
      rect(ctx, ix + 2, iy + 2, 6, 6, FLESH);
      rect(ctx, ix + 2, iy + 7, 6, 1, dark(FLESH, 0.45));
      break;
  }
}

/* ----------------------------------------------------------------- effects */

/** Animated flame of height h, based at (x,y). hue: a PAL key or a number. */
export function drawFlame(ctx, x, y, h, t, hue) {
  if (!ctx) return;
  const cx = ri(x), by = ri(y);
  const hh = Math.max(2, Math.min(72, ri(h)));
  const tt = num(t);
  const outer = typeof hue === 'string' ? col(hue)
    : hue === 1 ? ICHOR : hue === 2 ? ARCANE : hue === 3 ? COLD : FIRE;
  const mid = mix(outer, SPARK, 0.4), core = mix(outer, PALE, 0.5), tip = mix(outer, BLOOD, 0.35);
  for (let i = 0; i < hh; i++) {
    const f = i / hh;
    const flick = Math.sin(tt * 9.3 + i * 0.7) + Math.sin(tt * 14.1 + i * 1.3) * 0.5;
    const w = Math.max(1, Math.round((1 - f) * hh * 0.55 + flick * (1 - f) * 1.3));
    const ox = Math.round(Math.sin(tt * 6 + f * 3.2) * f * 2);
    const yy = by - i;
    rect(ctx, cx - (w >> 1) + ox, yy, w, 1, f > 0.72 ? tip : f > 0.42 ? outer : mid);
    if (w > 2 && f < 0.62) rect(ctx, cx - (w >> 2) + ox, yy, Math.max(1, w >> 1), 1, core);
  }
  for (let i = 0; i < 3; i++) {
    const p = (tt * 1.7 + i * 0.37) % 1;
    pixel(ctx, cx + Math.round(Math.sin(tt * 4 + i * 2.1) * 3), by - hh - Math.round(p * 6),
      p < 0.6 ? SPARK : EMBER);
  }
}

/** Rising dithered smoke inside the given box; the source is the bottom edge. */
export function drawSmoke(ctx, x, y, w, h, t, density) {
  if (!ctx) return;
  const sx = ri(x), sy = ri(y), sw = Math.max(1, ri(w)), sh = Math.max(1, ri(h));
  const d = density === undefined ? 0.5 : clamp01(density);
  if (d <= 0.02) return;
  const tt = num(t);
  const bands = Math.max(1, Math.min(6, Math.round(sh / 4)));
  const bandH = Math.max(1, Math.round(sh / bands));
  let budget = 5200;
  for (let i = 0; i < bands; i++) {
    const f = bands > 1 ? i / (bands - 1) : 1;                 // 0 top .. 1 source
    const bw2 = Math.max(1, Math.round(sw * (1 - f * 0.5)));
    const drift = Math.round(Math.sin(tt * 0.9 + i * 0.8) * (1 - f) * 3);
    const area = bw2 * bandH;
    if (area > budget) break;
    budget -= area;
    fog(ctx, sx + Math.round((sw - bw2) / 2) + drift, sy + i * bandH, bw2, bandH,
      f < 0.5 ? mix(ASH, VOID, 0.35) : ASH, d * (0.35 + f * 0.65));
  }
}

/** Clock dial: pct is the fraction of time remaining. */
export function drawClockFace(ctx, cx, cy, r, pct, t) {
  if (!ctx) return;
  const x = ri(cx), y = ri(cy), rad = Math.max(3, Math.min(48, ri(r)));
  const p = clamp01(pct), tt = num(t);
  const blink = p < 1 / 36 && Math.sin(tt * 11) < 0;
  const hand = p > 1 / 3 ? BONE : p > 1 / 12 ? FIRE : GORE;
  disc(ctx, x, y, rad, mix(GRAVE, INK, 0.4));
  ring(ctx, x, y, rad, BRASS);
  ring(ctx, x, y, rad - 1, dark(BRASS, 0.5));
  const ticks = 24;
  for (let i = 0; i < ticks; i++) {
    const a = -Math.PI / 2 + (i / ticks) * Math.PI * 2;
    const rx = x + Math.round(Math.cos(a) * (rad - 2));
    const ry = y + Math.round(Math.sin(a) * (rad - 2));
    const left = (i / ticks) < p;
    pixel(ctx, rx, ry, left ? (blink ? INK : hand) : mix(STONE, INK, 0.4));
  }
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + i * (Math.PI / 2);
    pixel(ctx, x + Math.round(Math.cos(a) * (rad - 4)), y + Math.round(Math.sin(a) * (rad - 4)), BONE);
  }
  const sa = -Math.PI / 2 + ((tt % 4) / 4) * Math.PI * 2;
  line(ctx, x, y, x + Math.round(Math.cos(sa) * Math.max(1, rad - 5)),
    y + Math.round(Math.sin(sa) * Math.max(1, rad - 5)), mix(BONE, INK, 0.45));
  if (!blink) {
    const a = -Math.PI / 2 + (1 - p) * Math.PI * 2;
    line(ctx, x, y, x + Math.round(Math.cos(a) * Math.max(1, rad - 3)),
      y + Math.round(Math.sin(a) * Math.max(1, rad - 3)), hand);
  }
  pixel(ctx, x, y, BRASS);
  pixel(ctx, x - Math.round(rad * 0.5), y - Math.round(rad * 0.5), mix(PALE, COLD, 0.4));
}

/** Procedural alchemical sigil in a size x size box at (x,y), stable per seed. */
export function drawSigil(ctx, x, y, size, seedNum) {
  if (!ctx) return;
  const s = Math.max(4, Math.min(64, ri(size)));
  const cx = ri(x) + (s >> 1), cy = ri(y) + (s >> 1), r = Math.max(1, (s >> 1) - 1);
  const h = hash((num(seedNum) | 0) * 2654435761 + 17);
  const c1 = [ARCANE, ICHOR, SPARK, ACID, VIOLET][h % 5];
  const c2 = mix(c1, PALE, 0.4);
  ring(ctx, cx, cy, r, c1);
  if ((h & 8) && r > 2) ring(ctx, cx, cy, r - 2, dark(c1, 0.35));
  const sides = 3 + ((h >> 4) % 4);
  const rot = ((h >> 8) % 16) / 16 * Math.PI * 2;
  let prevX = 0, prevY = 0;
  for (let i = 0; i <= sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const vx = cx + Math.round(Math.cos(a) * Math.max(1, r - 1));
    const vy = cy + Math.round(Math.sin(a) * Math.max(1, r - 1));
    if (i) line(ctx, prevX, prevY, vx, vy, c2);
    prevX = vx; prevY = vy;
    if ((h >> (i + 2)) & 1) pixel(ctx, vx, vy, SPARK);
  }
  if (h & 1) line(ctx, cx - r + 1, cy, cx + r - 1, cy, c1);
  if (h & 2) line(ctx, cx, cy - r + 1, cx, cy + r - 1, c1);
  if (h & 4) { pixel(ctx, cx, cy, SPARK); pixel(ctx, cx - 1, cy - 1, c2); }
  const sat = (h >> 12) % 4;
  for (let i = 0; i < sat; i++) {
    const a = rot + i * 1.9;
    pixel(ctx, cx + Math.round(Math.cos(a) * (r + 1)), cy + Math.round(Math.sin(a) * (r + 1)), c1);
  }
}

/** n blood splatters around (x,y); layout stable per seed, drips animate with t. */
export function drawGore(ctx, x, y, n, t, seedNum) {
  if (!ctx) return;
  const cx = ri(x), cy = ri(y), tt = num(t);
  const count = Math.max(0, Math.min(48, Math.round(num(n, 6))));
  const s = ((num(seedNum) | 0) * 131 + 7) | 0;
  for (let i = 0; i < count; i++) {
    const a = rnd(s + i * 3) * Math.PI * 2;
    const rad = 2 + rnd(s + i * 3 + 1) * 11;
    const bx = cx + Math.round(Math.cos(a) * rad);
    const by = cy + Math.round(Math.sin(a) * rad * 0.6);
    const big = rnd(s + i * 3 + 2) > 0.62;
    if (big) {
      disc(ctx, bx, by, 2, GORE);
      pixel(ctx, bx - 1, by - 1, mix(GORE, PALE, 0.25));
      pixel(ctx, bx + 2, by + 1, BLOOD);
      drip(ctx, bx, by + 2, tt, s + i, BLOOD);
    } else {
      pixel(ctx, bx, by, BLOOD);
      pixel(ctx, bx + 1, by, GORE);
      if ((i & 1) === 0) pixel(ctx, bx - 1, by + 1, dark(BLOOD, 0.3));
    }
  }
}
