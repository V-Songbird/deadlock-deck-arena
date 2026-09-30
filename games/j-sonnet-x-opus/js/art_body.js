// Player body art: stitched paper-doll abomination, overworld sprite and limb icons.
// Every piece is generated in code into a small pixel grid, cached as an offscreen canvas
// keyed by (type, blueprint or stump, size, skin), and composed per call.
(function () {
  window.DD = window.DD || {};

  // ---- fixed material colors (flesh comes from the equipped skin) ----
  const INK = '#0d0a12', BONE = '#e8dcc0', BANDAGE = '#d6c7a4', BANDAGE_D = '#9a8a6a';
  const BLOOD = '#8c1c2b', BLOOD2 = '#c8323f', LEATHER = '#4a3226', RAG = '#4d3b3b', RAG_D = '#33272a';
  const GLASS = '#a8d8e6', GLASS_D = '#4f7f93', STEEL = '#c2beb4', STEEL_D = '#6d6a66';
  const IRON = '#3e3538', IRON_L = '#5e5256', BRASS = '#b8892e', BRASS_D = '#7a5620', BRASS_L = '#e0b84a';
  const COPPER = '#a4532c', COPPER_L = '#d0703e', CAVITY = '#2a1a26', BRAIN = '#c98294', BRAIN_D = '#8d4f63';
  const GLOW = '#ffc23a', WORLD_OUTLINE = '#c9b98f';

  const MATERIAL = {
    beast: { base: '#6b4f3f', dark: '#3f2d26', light: '#8c6c55', tex: 0.3 },
    bone: { base: '#d9ccae', dark: '#978769', light: '#f2e8d2', tex: 0.06 },
    stone: { base: '#5b4d6b', dark: '#3d3149', light: '#7b6c8a', tex: 0.25 },
    brass: { base: BRASS, dark: BRASS_D, light: BRASS_L, tex: 0 }
  };

  // Paper-doll layout at scale 1 inside a 32x48 box, facing right (armL is on the screen left).
  const LAYOUT = {
    head: { x: 10, y: 0, w: 12, h: 12 },
    torso: { x: 9, y: 11, w: 14, h: 17 },
    armL: { x: 3, y: 12, w: 6, h: 16 },
    armR: { x: 23, y: 12, w: 6, h: 16 },
    legL: { x: 10, y: 28, w: 7, h: 20 },
    legR: { x: 16, y: 28, w: 7, h: 20 }
  };
  const DROP = 12; // with both legs missing the upper body sinks onto the leg stumps
  const ORDER = ['legL', 'legR', 'torso', 'armL', 'armR', 'head'];
  const SLOTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];
  const SLOT_TYPE = { head: 'head', torso: 'torso', armL: 'arm', armR: 'arm', legL: 'leg', legR: 'leg' };
  const STUMP_SIZE = { head: { w: 12, h: 12 }, torso: { w: 14, h: 17 }, arm: { w: 6, h: 8 }, leg: { w: 7, h: 8 } };
  const ICON_SIZE = { head: { w: 12, h: 12 }, torso: { w: 14, h: 14 }, arm: { w: 6, h: 14 }, leg: { w: 7, h: 14 } };
  const DEFAULT_LIMBS = { head: 'head_stitched', torso: 'torso_stitched', armL: 'arm_stitched', armR: 'arm_stitched', legL: 'leg_stitched', legR: 'leg_stitched' };

  const cache = {};

  // ---- color helpers ----
  function hex(c) {
    if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) return c;
    return (DD.Art.PAL && DD.Art.PAL[c]) || BLOOD2;
  }
  function rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function toHex(r, g, b) {
    const c = v => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + ((1 << 24) | (c(r) << 16) | (c(g) << 8) | c(b)).toString(16).slice(1);
  }
  function shade(h, f) { const c = rgb(h); return toHex(c[0] * f, c[1] * f, c[2] * f); }
  function mix(a, b, t) {
    const x = rgb(a), y = rgb(b);
    return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function noise(x, y, s) {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, -2048144777)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function skinOf(id) { return id || (DD.Core && DD.Core.meta && DD.Core.meta.skin) || 'classic'; }
  function skinColors(skin) {
    const S = DD.Data.SKINS, c = (S[skin] || S.classic).colors;
    return { skin: hex(c.skin), skinDark: hex(c.skinDark), stitch: hex(c.stitch), eye: hex(c.eye) };
  }
  function material(style, sk) {
    return MATERIAL[style] || { base: sk.skin, dark: sk.skinDark, light: mix(sk.skin, '#ffffff', 0.2), tex: 0.06 };
  }
  // A slot value may be a LimbInst, a blueprint id (e.g. the end summary) or null.
  function bpOf(v) { return typeof v === 'string' ? v : (v && v.bp) || null; }

  // ---- pixel grid (1 px margin on every side for the outline) ----
  function grid(w, h) { return { w: w, h: h, c: new Array((w + 2) * (h + 2)).fill(null) }; }
  function idx(g, x, y) { return x < -1 || y < -1 || x > g.w || y > g.h ? -1 : (y + 1) * (g.w + 2) + x + 1; }
  function put(g, x, y, col) { const i = idx(g, x, y); if (i >= 0) g.c[i] = col; }
  function get(g, x, y) { const i = idx(g, x, y); return i >= 0 ? g.c[i] : null; }
  function on(g, x, y, col) { if (get(g, x, y)) put(g, x, y, col); } // detail only over painted pixels
  function box(g, x, y, w, h, col) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(g, i, j, col); }
  function rr(x0, y0, x1, y1) { // rectangle with the four corners cut
    return (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && !((x === x0 || x === x1) && (y === y0 || y === y1));
  }
  function rect(x0, y0, x1, y1) { return (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1; }
  // Fill a shape lit from the top-left: right/bottom edges dark, left/top edges light, optional speckle texture.
  function fill(g, test, m, seed) {
    const ins = (x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h && test(x, y);
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        if (!ins(x, y)) continue;
        let col = !ins(x + 1, y) || !ins(x, y + 1) ? m.dark : !ins(x - 1, y) || !ins(x, y - 1) ? m.light : m.base;
        if (col === m.base && m.tex) {
          const n = noise(x, y, seed || 0);
          if (n < m.tex / 2) col = m.dark; else if (n > 1 - m.tex / 2) col = m.light;
        }
        put(g, x, y, col);
      }
    }
  }
  function outline(g, col) {
    const add = [];
    for (let y = -1; y <= g.h; y++) {
      for (let x = -1; x <= g.w; x++) {
        if (!get(g, x, y) && (get(g, x + 1, y) || get(g, x - 1, y) || get(g, x, y + 1) || get(g, x, y - 1))) add.push(x, y);
      }
    }
    for (let i = 0; i < add.length; i += 2) put(g, add[i], add[i + 1], col);
  }
  function line(g, x0, y0, x1, y1, col, col2) { // Bresenham; col2 paints a second pixel to the right
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      put(g, x0, y0, col);
      if (col2) put(g, x0 + 1, y0, col2);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
  // Stitched seam: a dark cut with thread ticks across it every 2 px.
  function seam(g, x0, y0, x1, y1, sk) {
    const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0)), vert = Math.abs(y1 - y0) > Math.abs(x1 - x0);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      on(g, x, y, sk.skinDark);
      if (i % 2) continue;
      if (vert) { on(g, x - 1, y, sk.stitch); on(g, x + 1, y, sk.stitch); } else { on(g, x, y - 1, sk.stitch); on(g, x, y + 1, sk.stitch); }
    }
  }
  function toCanvas(g, mirror) {
    const cw = g.w + 2, ch = g.h + 2, cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const c = cv.getContext('2d');
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const col = g.c[y * cw + x];
        if (col) { c.fillStyle = col; c.fillRect(mirror ? cw - 1 - x : x, y, 1, 1); }
      }
    }
    return cv;
  }

  // ---- heads (always 12x12, facing right) ----
  function genHead(k) {
    const g = k.g, m = k.m, sk = k.sk, a = k.a, al = k.al, ad = k.ad, v = k.v;
    switch (k.style) {
      case 'beast': {
        const skull = rr(1, 2, 8, 9);
        fill(g, (x, y) => skull(x, y) || (x >= 8 && y >= 5 && y <= 8 && !(x === 11 && y === 8)) || (x >= 3 && x <= 6 && y >= 9) ||
          (y < 2 && (x === 2 || x === 7 || (y === 1 && (x === 3 || x === 6)))), m, k.seed);
        on(g, 2, 1, ad); on(g, 7, 1, ad);
        on(g, 6, 3, m.dark); on(g, 7, 3, m.dark);
        on(g, 6, 4, a); on(g, 7, 4, al);
        on(g, 11, 5, INK);
        for (let x = 8; x <= 11; x++) on(g, x, 7, m.dark);
        on(g, 9, 8, BONE); on(g, 10, 8, BONE);
        put(g, 0, 4, m.dark); put(g, 0, 7, m.dark); // mane tufts
        if (v & 1) { put(g, 4, 1, BONE); put(g, 5, 0, BONE); } // horn
        if (v & 2) { on(g, 3, 3, m.dark); on(g, 3, 4, m.dark); on(g, 4, 6, m.dark); on(g, 4, 7, m.dark); }
        break;
      }
      case 'bone': {
        const cran = rr(1, 0, 10, 7), jaw = rr(3, 7, 10, 9);
        fill(g, (x, y) => cran(x, y) || jaw(x, y) || (x >= 5 && x <= 6 && y >= 10), m, k.seed);
        box(g, 5, 3, 2, 2, INK); box(g, 8, 3, 2, 2, INK);
        put(g, 6, 4, a); put(g, 9, 4, al);
        put(g, 9, 6, INK);
        for (let x = 4; x <= 9; x += 2) put(g, x, 8, INK);
        put(g, 3, 1, m.dark); put(g, 4, 2, m.dark); put(g, 3, 3, m.dark);
        on(g, 5, 11, m.dark); on(g, 6, 11, m.dark);
        if (v & 1) { put(g, 2, 4, ad); put(g, 2, 5, a); } // rune on the temple
        break;
      }
      case 'stone': {
        const head = rr(1, 2, 10, 10);
        fill(g, (x, y) => head(x, y) || (x >= 3 && x <= 8 && y >= 10) ||
          (y < 2 && (x === 1 || x === 10 || (y === 1 && (x === 2 || x === 9)))), m, k.seed);
        for (let x = 2; x <= 10; x++) on(g, x, 4, m.dark);
        on(g, 5, 5, a); on(g, 8, 5, a); on(g, 9, 5, al);
        for (let x = 5; x <= 10; x++) on(g, x, 8, INK);
        on(g, 6, 9, BONE); on(g, 9, 9, BONE);
        if (v & 1) { on(g, 3, 6, INK); on(g, 4, 7, INK); } else { on(g, 7, 2, INK); on(g, 6, 3, INK); }
        break;
      }
      case 'brass': {
        const dome = rr(1, 0, 10, 9);
        fill(g, (x, y) => dome(x, y) || (x >= 3 && x <= 8 && y >= 9), m, 0);
        box(g, 3, 10, 6, 2, IRON);
        for (let x = 4; x <= 10; x++) on(g, x, 5, INK);
        on(g, 8, 5, a); on(g, 9, 5, al);
        on(g, 2, 2, m.light); on(g, 2, 7, m.light); on(g, 9, 1, m.light);
        on(g, 7, 7, INK); on(g, 9, 7, INK); on(g, 7, 8, INK); on(g, 9, 8, INK);
        if (/clock/.test(k.id)) { // side gear
          box(g, 2, 3, 3, 3, m.dark); on(g, 3, 4, al);
          on(g, 3, 2, m.dark); on(g, 1, 4, m.dark); on(g, 3, 6, m.dark);
        } else { // crest
          for (let x = 3; x <= 8; x++) on(g, x, 0, x & 1 ? a : ad);
        }
        put(g, 0, 5, COPPER); put(g, 0, 6, COPPER_L); put(g, 0, 7, COPPER); // steam pipe
        break;
      }
      default: { // flesh, chem
        const skull = rr(1, 0, 10, 9);
        fill(g, (x, y) => skull(x, y) || (x === 11 && (y === 5 || y === 6)) || (x >= 4 && x <= 7 && y >= 9), m, k.seed);
        for (let x = 4; x <= 7; x++) on(g, x, 9, sk.skinDark);
        for (let x = 5; x <= 10; x++) on(g, x, 3, sk.skinDark);
        on(g, 6, 4, a); on(g, 9, 4, sk.eye); // mismatched grafted eye
        on(g, 3, 4, sk.skinDark); on(g, 3, 5, sk.skinDark);
        for (let x = 7; x <= 10; x++) on(g, x, 7, INK);
        if (k.style === 'chem') {
          if (/homunculus/.test(k.id)) { // exposed brain and a fluid tube
            for (let y = 0; y <= 1; y++) for (let x = 2; x <= 9; x++) on(g, x, y, noise(x, y, k.seed) < 0.3 ? BRAIN_D : BRAIN);
            seam(g, 2, 2, 9, 2, sk);
            put(g, 0, 3, GLASS); put(g, 0, 4, a); put(g, 0, 5, a); put(g, 0, 6, ad);
          } else { // goggles and respirator
            for (let x = 1; x <= 10; x++) on(g, x, 4, LEATHER);
            on(g, 5, 4, GLASS_D); on(g, 6, 4, a); on(g, 8, 4, GLASS_D); on(g, 9, 4, al);
            on(g, 5, 3, BRASS); on(g, 6, 3, BRASS); on(g, 8, 3, BRASS); on(g, 9, 3, BRASS);
            box(g, 8, 6, 3, 3, LEATHER); put(g, 9, 7, STEEL);
            put(g, 8, 9, GLASS); put(g, 8, 10, a); put(g, 8, 11, ad);
          }
        } else {
          if (v & 1) seam(g, 2, 2, 9, 2, sk); else seam(g, 4, 0, 4, 6, sk);
          if (v & 2) { on(g, 8, 6, sk.stitch); on(g, 8, 8, sk.stitch); on(g, 10, 6, sk.stitch); on(g, 10, 8, sk.stitch); } // sewn lips
          else { on(g, 8, 7, BONE); on(g, 10, 7, BONE); }
          seam(g, 4, 10, 7, 10, sk);
        }
      }
    }
  }

  // ---- torsos (14 wide, 17 tall on the body, 14 tall as an icon) ----
  function torsoTest(w, h, wide) {
    return (x, y) => {
      let mg = y < 3 ? 0 : y < h - 7 ? 1 : y < h - 3 ? 2 : 1;
      if (wide) mg = Math.max(0, mg - 1);
      return x >= mg && x < w - mg && !(y === 0 && (x === 0 || x === w - 1));
    };
  }
  function genTorso(k) {
    const g = k.g, w = k.w, h = k.h, m = k.m, sk = k.sk, a = k.a, al = k.al, ad = k.ad, v = k.v;
    const base = torsoTest(w, h, k.style === 'stone');
    switch (k.style) {
      case 'beast': {
        fill(g, base, m, k.seed);
        fill(g, (x, y) => base(x, y) && x >= 4 && x <= 9 && y >= 1 && y <= 6, { base: m.light, dark: m.base, light: m.light, tex: 0.3 }, k.seed + 1);
        for (let x = 3; x <= 10; x++) on(g, x, 1, x % 3 === 1 ? STEEL : ad); // studded collar
        [4, 6].forEach(y => { put(g, 0, y, m.dark); put(g, w - 1, y, m.dark); });
        const scar = mix(m.dark, BLOOD2, 0.6);
        on(g, 9, 8, scar); on(g, 10, 9, scar); on(g, 8, 9, scar); on(g, 9, 10, scar);
        put(g, 1, h - 6, m.dark); put(g, 1, h - 5, m.dark); put(g, 1, h - 4, m.dark); // tail
        put(g, 0, h - 3, m.dark); put(g, 0, h - 2, m.dark); put(g, 0, h - 1, m.light);
        break;
      }
      case 'bone': {
        const b = m;
        fill(g, base, { base: CAVITY, dark: '#1a0f18', light: '#3a2634', tex: 0 }, 0);
        for (let x = 0; x < w; x++) { on(g, x, 0, b.light); on(g, x, 1, b.base); }
        for (let y = 3; y <= h - 8; y += 2) for (let x = 1; x < w - 1; x++) on(g, x, y, x < 3 || x > w - 4 ? b.dark : b.base);
        for (let y = 1; y < h - 5; y++) { on(g, 6, y, b.base); on(g, 7, y, b.dark); }
        for (let y = h - 5; y < h - 3; y++) { on(g, 6, y, b.dark); on(g, 7, y, b.dark); }
        on(g, 9, 4, al); on(g, 10, 4, a); // glowing heart behind the ribs
        if (v & 1) on(g, 4, 6, ad);
        for (let y = h - 3; y < h; y++) for (let x = 1; x < w - 1; x++) on(g, x, y, y === h - 3 ? b.light : b.base);
        on(g, 4, h - 2, INK); on(g, 9, h - 2, INK);
        break;
      }
      case 'stone': {
        fill(g, base, m, k.seed);
        for (let x = 0; x < w; x++) { on(g, x, 3, m.dark); on(g, x, h - 4, m.dark); }
        on(g, 7, 5, al); on(g, 6, 6, a); on(g, 8, 6, a); on(g, 7, 7, a); on(g, 7, 6, ad); // rune
        const c = v & 1 ? 3 : 10;
        on(g, c, 5, INK); on(g, c + 1, 6, INK); on(g, c, 7, INK); on(g, c + 1, 8, INK);
        break;
      }
      case 'brass': {
        fill(g, base, m, 0);
        [3, h - 5].forEach(y => { for (let x = 0; x < w; x++) on(g, x, y, x % 3 === 1 ? m.light : m.dark); });
        for (let y = 4; y < h - 5; y++) { on(g, 1, y, COPPER); on(g, 2, y, COPPER_L); } // pipe
        if (/clock/.test(k.id)) { // exposed gear
          const cy = (h >> 1) + 1;
          for (let y = -3; y <= 3; y++) {
            for (let x = -3; x <= 3; x++) {
              const d = x * x + y * y;
              if (d <= 4) on(g, 7 + x, cy + y, d === 0 ? al : d <= 1 ? a : m.dark);
              else if (d <= 9 && (x === 0 || y === 0 || Math.abs(x) === Math.abs(y))) on(g, 7 + x, cy + y, m.dark);
            }
          }
        } else { // furnace window
          const fy = (h >> 1) - 1;
          for (let y = fy; y <= fy + 3; y++) {
            for (let x = 4; x <= 9; x++) on(g, x, y, y === fy || y === fy + 3 || x === 4 || x === 9 || x === 6 ? INK : y === fy + 1 ? al : a);
          }
        }
        for (let y = 0; y < 3; y++) for (let x = 10; x < 13; x++) on(g, x, y, BONE); // pressure gauge
        on(g, 11, 1, INK); on(g, 12, 0, BLOOD2);
        for (let y = h - 3; y < h; y++) for (let x = 0; x < w; x++) on(g, x, y, y === h - 2 && x % 3 === 1 ? m.light : IRON);
        break;
      }
      default: { // flesh, chem
        fill(g, base, m, k.seed);
        if (k.style === 'chem') {
          seam(g, 7, 2, 7, h - 5, sk);
          for (let i = 0; i < h - 4; i++) { on(g, 1 + i, i, LEATHER); on(g, 2 + i, i, LEATHER); } // harness strap
          on(g, 5, 4, BRASS); on(g, 6, 4, BRASS_L);
          for (let y = 2; y < h - 7; y++) on(g, 11, y, y % 3 ? GLASS : a); // tube
          for (let x = 1; x < w - 1; x++) on(g, x, h - 4, LEATHER);
          [3, 6, 9].forEach((x, i) => { on(g, x, h - 7, GLASS); on(g, x, h - 6, i === 1 ? al : a); on(g, x, h - 5, ad); });
        } else {
          seam(g, 2, 1, 6, 4, sk); seam(g, 11, 1, 7, 4, sk); seam(g, 7, 5, 7, h - 5, sk); // autopsy Y
          on(g, 3, 6, sk.skinDark); on(g, 4, 6, sk.skinDark); on(g, 10, 6, sk.skinDark); on(g, 11, 6, sk.skinDark);
          const px = v & 1 ? 2 : 8, py = h - 9, patch = mix(sk.skinDark, a, 0.35); // grafted patch
          for (let y = py; y < py + 3; y++) {
            for (let x = px; x < px + 4; x++) on(g, x, y, (x === px || x === px + 3 || y === py || y === py + 2) && (x + y) % 2 ? sk.stitch : patch);
          }
        }
        for (let y = h - 3; y < h; y++) for (let x = 0; x < w; x++) on(g, x, y, (x + y * 3) % 5 === 0 ? RAG_D : RAG);
        for (let x = 0; x < w; x++) on(g, x, h - 3, LEATHER);
        on(g, 7, h - 3, BRASS);
      }
    }
  }

  // ---- arms (6 wide, drawn as the right arm; the left arm is mirrored) ----
  function genArm(k) {
    const g = k.g, w = k.w, h = k.h, m = k.m, sk = k.sk, a = k.a, al = k.al, ad = k.ad, v = k.v, el = h >> 1;
    const cap = rr(0, 0, 5, 2);
    const base = (x, y) => cap(x, y) || (x >= 1 && x <= 4 && y <= h - 4) || (y > h - 5 && x <= 4 && !(y === h - 1 && (x === 0 || x === 4)));
    switch (k.style) {
      case 'beast': {
        fill(g, (x, y) => base(x, y) && y < h - 1, m, k.seed);
        [3, el, el + 3].forEach(y => put(g, 5, y, m.dark));
        on(g, 2, 4, m.dark); on(g, 3, 5, m.dark); on(g, 2, 6, m.dark);
        const claw = mix(BONE, a, 0.35);
        put(g, 0, h - 1, claw); put(g, 2, h - 1, claw); put(g, 4, h - 1, claw);
        if (v & 1) { put(g, 5, el + 1, BONE); put(g, 5, el + 2, BONE); } // forearm spikes
        break;
      }
      case 'bone': {
        fill(g, (x, y) => (y <= 1 && x >= 1 && x <= 4) || (y > 1 && y < el && (x === 2 || x === 3)) ||
          (y >= el && y <= el + 1 && x >= 1 && x <= 4) || (y > el + 1 && y < h - 4 && (x === 1 || x === 3)) ||
          (y === h - 4 && x >= 1 && x <= 4) || (y > h - 4 && (x === 0 || x === 2 || x === 4)), m, 0);
        on(g, 2, el, a); on(g, 3, el, al); // glowing marrow
        if (v & 1) on(g, 2, 0, ad);
        break;
      }
      case 'stone': {
        const top = rr(0, 0, 5, 3), fist = rr(0, h - 5, 5, h - 1);
        fill(g, (x, y) => top(x, y) || (y > 3 && y < h - 5 && x <= (y >= el ? 5 : 4)) || fist(x, y), m, k.seed);
        for (let x = 0; x < w; x++) on(g, x, el - 1, m.dark);
        on(g, 2, 4, INK); on(g, 3, 5, INK);
        on(g, 3, el + 1, al); on(g, 2, el + 2, a);
        on(g, 1, h - 3, m.dark); on(g, 3, h - 3, m.dark);
        break;
      }
      case 'brass': {
        if (/piston|steam/.test(k.id)) {
          const top = rr(0, 0, 5, 3);
          fill(g, (x, y) => top(x, y) || (x >= 1 && x <= 4 && y > 3 && y <= el + 3) || (x >= 2 && x <= 3 && y > el + 3 && y < h - 3) ||
            (y >= h - 3 && y < h - 1 && x <= 4) || (y === h - 1 && (x === 0 || x === 4)), m, 0);
          for (let y = el + 4; y < h - 3; y++) { put(g, 2, y, STEEL); put(g, 3, y, STEEL_D); } // piston rod
          for (let y = h - 3; y < h; y++) for (let x = 0; x <= 4; x++) on(g, x, y, x === 0 || y === h - 3 ? IRON_L : IRON); // pincer
          for (let x = 1; x <= 4; x++) on(g, x, el + 3, m.dark);
          on(g, 2, el, al); on(g, 3, el, a);
        } else {
          fill(g, base, m, 0);
          for (let y = 4; y < h - 4; y += 3) for (let x = 0; x < w; x++) on(g, x, y, m.dark);
          for (let x = 1; x <= 4; x++) on(g, x, el, m.dark);
          put(g, 0, el, m.dark); put(g, 5, el, m.dark); on(g, 2, el, a); on(g, 3, el, al); // elbow gear
          for (let y = h - 4; y < h; y++) for (let x = 0; x <= 4; x++) on(g, x, y, x & 1 ? STEEL_D : STEEL);
          if (v & 1) put(g, 5, 1, ad); // shoulder spike
        }
        for (let x = 0; x < w; x++) on(g, x, 2, a); // accent trim
        on(g, 1, 1, m.light); on(g, 4, 1, m.light);
        break;
      }
      default: { // flesh, chem
        fill(g, base, m, k.seed);
        seam(g, 1, 3, 4, 3, sk); // graft line at the shoulder
        on(g, 1, el, sk.skinDark); on(g, 4, el, sk.skinDark);
        on(g, 2, h - 1, sk.skinDark);
        if (k.style === 'chem') {
          on(g, 2, 4, STEEL); on(g, 3, 4, STEEL); // strapped vial
          for (let y = 5; y < el; y++) { on(g, 2, y, y === 5 ? GLASS : a); on(g, 3, y, ad); }
          for (let x = 1; x <= 4; x++) on(g, x, el, LEATHER);
          for (let y = el + 1; y < h - 4; y++) on(g, 4, y, y % 3 ? GLASS : a); // tube
          if (/surgeon/.test(k.id)) { put(g, 5, h - 3, STEEL_D); put(g, 5, h - 2, STEEL); put(g, 5, h - 1, '#f4f2ee'); } // scalpel
          else { on(g, 1, h - 2, GLASS); on(g, 2, h - 2, a); on(g, 3, h - 2, al); on(g, 2, h - 1, ad); on(g, 3, h - 1, a); } // flask
        } else {
          for (let x = 1; x <= 4; x++) on(g, x, el + 2, x & 1 ? a : ad); // sewn-in wire band
          if (v & 1) { on(g, 2, 5, sk.skinDark); on(g, 3, 5, sk.stitch); on(g, 2, 6, sk.stitch); on(g, 3, 6, sk.skinDark); }
        }
      }
    }
  }

  // ---- legs (7 wide, foot pointing right; 20 tall on the body, 14 as an icon) ----
  function genLeg(k) {
    const g = k.g, h = k.h, m = k.m, sk = k.sk, a = k.a, al = k.al, ad = k.ad, v = k.v, kn = Math.floor(h * 0.45);
    const foot = rr(0, h - 3, 6, h - 1);
    const base = (x, y) => (y <= kn && x <= 4) || (y > kn && y < h - 3 && x >= 1 && x <= 4) || foot(x, y);
    switch (k.style) {
      case 'beast': { // digitigrade
        const thigh = rr(0, 0, 5, kn + 1);
        fill(g, (x, y) => thigh(x, y) || (y > kn + 1 && y < h - 3 && x <= 2) || (y >= h - 3 && x <= 5 && !(y === h - 3 && x === 5)), m, k.seed);
        const claw = mix(BONE, a, 0.35);
        put(g, 6, h - 2, claw); put(g, 6, h - 1, claw);
        on(g, 1, 2, m.dark); on(g, 2, 3, m.dark); on(g, 1, 5, m.dark); on(g, 2, 6, m.dark);
        on(g, 3, 1, ad); on(g, 4, 2, ad);
        if (v & 1) for (let x = 0; x <= 2; x++) on(g, x, kn + 3, BANDAGE);
        break;
      }
      case 'bone': {
        fill(g, (x, y) => (y <= 1 && x >= 1 && x <= 4) || (y > 1 && y < kn && (x === 2 || x === 3)) ||
          (y >= kn && y <= kn + 1 && x >= 1 && x <= 4) || (y > kn + 1 && y < h - 3 && (x === 2 || x === 4)) ||
          (y >= h - 3 && y < h - 1 && x >= 1 && x <= 5) || (y === h - 1 && (x === 2 || x === 4 || x === 6)), m, 0);
        on(g, 2, kn, a); on(g, 3, kn, al);
        if (v & 1) on(g, 3, 0, ad);
        break;
      }
      case 'stone': {
        const thigh = rr(0, 0, 5, kn);
        fill(g, (x, y) => thigh(x, y) || (y > kn && y < h - 3 && x <= 5) || foot(x, y), m, k.seed);
        for (let x = 0; x <= 5; x++) on(g, x, kn, m.dark);
        on(g, 1, 2, INK); on(g, 2, 3, INK);
        on(g, 2, kn + 3, al); on(g, 3, kn + 4, a);
        on(g, 4, h - 1, INK); // split hoof
        break;
      }
      case 'brass': {
        if (/spider/.test(k.id)) { // spindly jointed legs
          line(g, 1, 1, 0, kn + 2, IRON); line(g, 0, kn + 2, 1, h - 1, IRON);
          box(g, 1, 0, 4, 2, m.base); put(g, 1, 0, m.light); put(g, 4, 1, m.dark);
          line(g, 2, 2, 5, kn, m.base, m.dark);
          box(g, 4, kn - 1, 3, 3, m.dark); put(g, 5, kn, a); put(g, 4, kn - 1, al);
          line(g, 5, kn + 2, 3, h - 2, STEEL, STEEL_D);
          put(g, 3, h - 1, IRON_L);
        } else if (/steam|piston/.test(k.id)) { // piston shin and exhaust vent
          const thigh = rr(0, 0, 5, kn);
          fill(g, (x, y) => thigh(x, y) || (y > kn && y <= kn + 3 && x >= 1 && x <= 4) || (y > kn + 3 && y < h - 3 && x >= 2 && x <= 3) || foot(x, y), m, 0);
          for (let y = kn + 4; y < h - 3; y++) { put(g, 2, y, STEEL); put(g, 3, y, STEEL_D); }
          for (let y = h - 3; y < h; y++) for (let x = 0; x <= 6; x++) on(g, x, y, y === h - 3 ? IRON_L : IRON);
          for (let x = 0; x <= 5; x++) on(g, x, kn, m.dark);
          put(g, 5, kn + 1, COPPER); put(g, 5, kn + 2, COPPER_L); on(g, 4, kn + 2, a);
          on(g, 1, 1, m.light); on(g, 4, 1, m.light);
        } else { // clockwork plates and knee gear
          fill(g, base, m, 0);
          for (let y = 3; y < h - 4; y += 3) for (let x = 0; x <= 4; x++) on(g, x, y, m.dark);
          for (let x = 0; x <= 4; x++) on(g, x, kn, m.dark);
          put(g, 5, kn, m.dark); on(g, 2, kn, a); on(g, 3, kn, al);
          for (let y = h - 3; y < h; y++) for (let x = 0; x <= 6; x++) on(g, x, y, y === h - 3 ? IRON_L : IRON);
          on(g, 6, h - 2, STEEL);
        }
        on(g, 2, 1, a); on(g, 3, 1, ad); // accent rivets
        break;
      }
      default: { // flesh, chem
        fill(g, base, m, k.seed);
        seam(g, 0, kn, 4, kn, sk);
        on(g, 4, h - 2, sk.skinDark);
        if (k.style === 'chem') {
          for (let y = 2; y < h - 4; y += 3) { on(g, 1, y, GLASS); on(g, 2, y, a); on(g, 3, y, al); on(g, 4, y, GLASS); } // coiled tube
        } else {
          for (let x = 1; x <= 4; x++) on(g, x, kn + 3, x & 1 ? a : ad);
          if (v & 1) seam(g, 2, 1, 2, kn - 2, sk);
        }
      }
    }
  }

  // ---- stumps: short bandaged ends of a missing piece ----
  const STUMP = {
    head(k) { // bandaged neck
      const g = k.g;
      fill(g, (x, y) => x >= 4 && x <= 7 && y >= 8, k.m, 1);
      box(g, 4, 8, 4, 2, BANDAGE); put(g, 5, 9, BANDAGE_D); put(g, 7, 8, BANDAGE_D);
      put(g, 6, 8, BLOOD2); put(g, 5, 7, BLOOD);
    },
    torso(k) { // bare spine hanging from an iron yoke
      const g = k.g, w = k.w, h = k.h, b = MATERIAL.bone;
      for (let x = 0; x < w; x++) { put(g, x, 0, x % 4 === 1 ? BRASS_L : BRASS); put(g, x, 1, BRASS_D); }
      for (let y = 2; y < h - 3; y++) { put(g, 6, y, y % 2 ? b.dark : b.base); put(g, 7, y, y % 2 ? b.dark : b.light); }
      [4, h - 7].forEach(y => { for (let x = 5; x <= 8; x++) put(g, x, y, x === 5 ? BANDAGE_D : BANDAGE); });
      put(g, 8, 5, BLOOD2);
      for (let y = h - 3; y < h; y++) for (let x = 2; x < w - 2; x++) put(g, x, y, y === h - 3 ? b.light : b.base);
      put(g, 4, h - 2, INK); put(g, 9, h - 2, INK);
    },
    arm(k) {
      const g = k.g, cap = rr(0, 0, 5, 2);
      fill(g, (x, y) => cap(x, y) || (x >= 1 && x <= 4 && y <= 4), k.m, 1);
      for (let x = 1; x <= 4; x++) { put(g, x, 3, BANDAGE); put(g, x, 4, x === 2 ? BANDAGE_D : BANDAGE); }
      put(g, 3, 5, BLOOD);
    },
    leg(k) {
      const g = k.g;
      fill(g, (x, y) => x <= 4 && y <= 4, k.m, 1);
      for (let x = 0; x <= 4; x++) { put(g, x, 3, BANDAGE); put(g, x, 4, x === 3 ? BANDAGE_D : BANDAGE); }
      put(g, 2, 5, BLOOD);
    }
  };
  const GEN = { head: genHead, torso: genTorso, arm: genArm, leg: genLeg };

  // bpId null = stump; an id missing from Data draws as a generic flesh limb.
  function buildGrid(type, bpId, w, h, skin, edge) {
    const sk = skinColors(skin), g = grid(w, h);
    if (!bpId) {
      STUMP[type]({ g: g, w: w, h: h, sk: sk, m: material('flesh', sk) });
    } else {
      const bp = DD.Data.LIMBS[bpId] || { id: bpId, style: 'flesh', accent: BLOOD2 };
      const a = hex(bp.accent), seed = hash(bp.id);
      GEN[type]({ g: g, w: w, h: h, sk: sk, id: bp.id, style: bp.style, m: material(bp.style, sk),
        a: a, ad: shade(a, 0.6), al: mix(a, '#ffffff', 0.45), v: seed & 3, seed: seed });
    }
    outline(g, edge || INK);
    return g;
  }
  function piece(type, bpId, w, h, skin, mirror) {
    const key = type + '|' + (bpId || '-') + '|' + w + 'x' + h + '|' + skin + (mirror ? '|m' : '');
    return cache[key] || (cache[key] = toCanvas(buildGrid(type, bpId, w, h, skin), mirror));
  }
  function cached16(key, draw) {
    let cv = cache[key];
    if (!cv) {
      cv = cache[key] = document.createElement('canvas');
      cv.width = cv.height = 16;
      draw(cv.getContext('2d'));
    }
    return cv;
  }
  function center(c, src, dx, dy) { c.drawImage(src, ((16 - src.width) >> 1) + (dx || 0), ((16 - src.height) >> 1) + (dy || 0)); }
  function blit(ctx, cv, x, y, scale) {
    const s = scale || 1;
    ctx.drawImage(cv, Math.round(x), Math.round(y), cv.width * s, cv.height * s);
  }

  // ---- anchors and paper doll ----
  // limbs (optional, contract extension) defaults to the current run's body; it only matters when both legs are missing.
  function bodySlotAnchors(cx, bottomY, scale, limbs) {
    const s = Math.max(1, Math.round(scale || 1));
    limbs = limbs || (DD.Core && DD.Core.run && DD.Core.run.player.limbs) || DEFAULT_LIMBS;
    const drop = !bpOf(limbs.legL) && !bpOf(limbs.legR) ? DROP : 0;
    const x0 = Math.round(cx) - 16 * s, y0 = Math.round(bottomY) - 48 * s, out = {};
    for (const slot in LAYOUT) {
      const r = LAYOUT[slot], leg = SLOT_TYPE[slot] === 'leg';
      out[slot] = { x: x0 + r.x * s, y: y0 + (r.y + drop) * s, w: r.w * s, h: (leg ? r.h - drop : r.h) * s };
    }
    return out;
  }

  function drawBody(ctx, cx, bottomY, limbs, opts) {
    opts = opts || {};
    limbs = limbs || DEFAULT_LIMBS;
    const s = Math.max(1, Math.round(opts.scale || 1)), t = opts.t || 0, hurt = opts.hurt || 0;
    const skin = skinOf(opts.skin), A = bodySlotAnchors(cx, bottomY, s, limbs), alpha = ctx.globalAlpha;
    const bob = Math.sin(t * 2.6) > 0.3 ? s : 0, sway = Math.sin(t * 2.6 - 1) > 0.3 ? s : 0;
    const hurtColor = hurt > 0.5 ? '#ffffff' : BLOOD2;
    let hi = null;
    ctx.save();
    if (opts.flip) { ctx.translate(Math.round(cx) * 2, 0); ctx.scale(-1, 1); }
    for (let i = 0; i < ORDER.length; i++) {
      const slot = ORDER[i], type = SLOT_TYPE[slot], id = bpOf(limbs[slot]);
      const size = id ? LAYOUT[slot] : STUMP_SIZE[type];
      const cv = piece(type, id, size.w, size.h, skin, slot === 'armL');
      const x = A[slot].x - s, y = A[slot].y - s + (type === 'arm' ? sway : type === 'leg' ? 0 : bob);
      const w = cv.width * s, h = cv.height * s;
      ctx.drawImage(cv, x, y, w, h);
      if (hurt > 0) {
        ctx.globalAlpha = alpha * Math.min(1, hurt * 1.5);
        ctx.drawImage(DD.Art.silhouetteOf(cv, hurtColor), x, y, w, h);
        ctx.globalAlpha = alpha;
      }
      if (slot === opts.highlight) hi = { cv: cv, x: x, y: y, w: w, h: h };
    }
    if (hi) { // pulsing glow around the highlighted piece, then the piece on top
      const sil = DD.Art.silhouetteOf(hi.cv, GLOW);
      ctx.globalAlpha = alpha * (0.45 + 0.4 * Math.sin(t * 8));
      ctx.drawImage(sil, hi.x - s, hi.y, hi.w, hi.h); ctx.drawImage(sil, hi.x + s, hi.y, hi.w, hi.h);
      ctx.drawImage(sil, hi.x, hi.y - s, hi.w, hi.h); ctx.drawImage(sil, hi.x, hi.y + s, hi.w, hi.h);
      ctx.globalAlpha = alpha;
      ctx.drawImage(hi.cv, hi.x, hi.y, hi.w, hi.h);
    }
    ctx.restore();
  }

  // ---- overworld sprite (14x14 figure + 1 px light outline = 16x16) ----
  function genWorld(limbs, dir, frame, skin) {
    const sk = skinColors(skin), g = grid(14, 14), flesh = material('flesh', sk), P = {};
    SLOTS.forEach(slot => {
      const id = bpOf(limbs[slot]);
      if (!id) return;
      const bp = DD.Data.LIMBS[id] || { style: 'flesh', accent: BLOOD2 };
      P[slot] = { m: material(bp.style, sk), a: hex(bp.accent), style: bp.style };
    });
    const side = dir === 1 || dir === 2, back = dir === 3;

    // legs
    const legX = side ? (frame === 1 ? { legL: 8, legR: 4 } : frame === 3 ? { legL: 4, legR: 8 } : { legL: 6, legR: 6 }) : { legL: 4, legR: 8 };
    const lifted = side ? null : frame === 1 ? 'legL' : frame === 3 ? 'legR' : null;
    ['legL', 'legR'].forEach(slot => {
      const x = legX[slot], p = P[slot], len = slot === lifted ? 3 : 4;
      if (p) {
        fill(g, rect(x, 10, x + 1, 9 + len), p.m, 5);
        if (p.style === 'brass' || p.style === 'stone') put(g, x + 1, 9 + len, IRON);
      } else {
        put(g, x, 10, flesh.base); put(g, x + 1, 10, flesh.dark); put(g, x, 11, BANDAGE); put(g, x + 1, 11, BANDAGE_D);
      }
    });

    // arms: the far arm (side view) goes behind the torso
    const arm = (p, x, y0, len) => {
      if (!p) { put(g, x, y0, flesh.base); put(g, x + 1, y0, flesh.dark); put(g, x, y0 + 1, BANDAGE); put(g, x + 1, y0 + 1, BANDAGE_D); return; }
      fill(g, rect(x, y0, x + 1, y0 + len - 1), p.m, 9);
      if (p.style === 'beast') { put(g, x, y0 + len, BONE); put(g, x + 1, y0 + len, BONE); }
      else if (p.style !== 'flesh') on(g, x, y0 + 2, p.a);
      else on(g, x, y0 + 1, sk.stitch);
    };
    if (side) arm(P.armL, frame === 1 ? 3 : frame === 3 ? 8 : 6, 5, 4);

    // torso
    const T = P.torso, tx0 = side ? 5 : 3, tx1 = side ? 9 : 10;
    if (T) {
      fill(g, rect(tx0, 5, tx1, 9), T.m, 3);
      const st = T.style;
      if (st === 'flesh' || st === 'chem') for (let y = 5; y <= 9; y++) on(g, 7, y, y % 2 ? sk.stitch : sk.skinDark);
      if (st === 'chem') { on(g, tx0 + 1, 8, T.a); on(g, tx0 + 1, 7, GLASS); }
      if (st === 'bone') for (let x = tx0 + 1; x < tx1; x++) { on(g, x, 6, CAVITY); on(g, x, 8, CAVITY); }
      if (st === 'beast' && !back) { on(g, 6, 6, T.m.light); on(g, 7, 6, T.m.light); on(g, 6, 7, T.m.light); }
      if (st === 'stone') { on(g, tx0 + 1, 6, INK); if (!back) on(g, 7, 7, T.a); }
      if (st === 'brass') { on(g, tx0, 6, T.m.light); on(g, tx1, 6, T.m.light); if (!back) { on(g, 6, 7, T.a); on(g, 7, 7, mix(T.a, '#ffffff', 0.45)); } }
    } else {
      for (let x = tx0; x <= tx1; x++) put(g, x, 5, BRASS);
      for (let y = 6; y <= 9; y++) { put(g, 6, y, BONE); put(g, 7, y, y % 2 ? MATERIAL.bone.dark : BONE); }
      for (let x = tx0 + 1; x < tx1; x++) put(g, x, 9, BONE);
    }

    if (side) arm(P.armR, frame === 1 ? 7 : frame === 3 ? 5 : 6, 5, 4);
    else { arm(P.armL, 1, 5, frame === 3 ? 5 : 4); arm(P.armR, 11, 5, frame === 1 ? 5 : 4); }

    // head
    const H = P.head;
    if (H) {
      const hx0 = side ? 5 : 4, hx1 = side ? 10 : 9, beast = H.style === 'beast';
      const shape = rr(hx0, beast ? 1 : 0, hx1, 4);
      fill(g, (x, y) => shape(x, y) || (beast && y === 0 && (x === hx0 + 1 || x === hx1 - 1)), H.m, 7);
      if (beast && side) { put(g, 11, 2, H.m.base); put(g, 11, 3, H.m.dark); put(g, 12, 2, INK); }
      if (back) {
        if (H.style === 'flesh' || H.style === 'chem') for (let y = 0; y <= 3; y++) on(g, 7, y, y % 2 ? sk.stitch : sk.skinDark);
        else on(g, 7, 2, H.m.dark);
      } else {
        const eyes = side ? [hx1 - 1] : [hx0 + 1, hx1 - 1];
        if (H.style === 'brass' || H.style === 'chem') for (let x = hx0 + 1; x < hx1; x++) on(g, x, 2, H.style === 'brass' ? INK : LEATHER);
        eyes.forEach((x, i) => on(g, x, 2, H.style === 'flesh' && (side || i === 1) ? sk.eye : H.a));
        if (H.style === 'flesh' && !side) for (let x = hx0 + 1; x < hx1; x++) on(g, x, 1, x % 2 ? sk.stitch : sk.skinDark);
      }
    } else { // bandaged neck stump
      const nx = side ? 7 : 6;
      put(g, nx, 3, BANDAGE); put(g, nx + 1, 3, BANDAGE_D); put(g, nx, 4, flesh.base); put(g, nx + 1, 4, flesh.dark); put(g, nx + 1, 2, BLOOD2);
    }

    outline(g, WORLD_OUTLINE);
    return toCanvas(g, dir === 1); // left = mirrored right
  }

  // step: walk phase in stride cycles (1.0 = one full 4-frame cycle); pass 0 when idle.
  function drawPlayerWorld(ctx, x, y, dir, step, limbs) {
    limbs = limbs || (DD.Core && DD.Core.run && DD.Core.run.player.limbs) || DEFAULT_LIMBS;
    const d = dir >= 0 && dir <= 3 ? dir | 0 : 0, frame = Math.floor((step || 0) * 4) & 3, skin = skinOf();
    let key = 'w|' + skin + '|' + d + '|' + frame;
    for (let i = 0; i < SLOTS.length; i++) key += '|' + (bpOf(limbs[SLOTS[i]]) || '-');
    const cv = cache[key] || (cache[key] = genWorld(limbs, d, frame, skin));
    ctx.drawImage(cv, Math.round(x), Math.round(y));
  }

  // ---- icons (16x16) ----
  function limbIcon(ctx, bpId, x, y, scale) {
    const bp = DD.Data.LIMBS[bpId];
    if (!bp) return;
    const skin = skinOf(), sz = ICON_SIZE[bp.type];
    blit(ctx, cached16('i|' + bpId + '|' + skin, c => center(c, piece(bp.type, bpId, sz.w, sz.h, skin))), x, y, scale);
  }

  // Bandaged stump over a dashed outline of the missing piece.
  function stumpIcon(ctx, type, x, y, scale) {
    const skin = skinOf(), sz = ICON_SIZE[type];
    blit(ctx, cached16('s|' + type + '|' + skin, c => {
      const g = buildGrid(type, null, sz.w, sz.h, skin), ghost = buildGrid(type, '~' + type, sz.w, sz.h, skin, 'X');
      const gw = sz.w + 2;
      for (let i = 0; i < g.c.length; i++) {
        if (ghost.c[i] === 'X' && !g.c[i] && ((i % gw) + Math.floor(i / gw)) % 2 === 0) g.c[i] = '#5b4d6b';
      }
      center(c, toCanvas(g));
    }), x, y, scale);
  }

  function silhouetteIcon(ctx, type, x, y, scale) {
    blit(ctx, cached16('q|' + type, c => {
      const sz = ICON_SIZE[type], src = piece(type, '~' + type, sz.w, sz.h, 'classic');
      const rim = DD.Art.silhouetteOf(src, '#5b4d6b');
      center(c, rim, -1, 0); center(c, rim, 1, 0); center(c, rim, 0, -1); center(c, rim, 0, 1);
      center(c, DD.Art.silhouetteOf(src, '#1a1424'));
    }), x, y, scale);
  }

  DD.Art = DD.Art || {};
  Object.assign(DD.Art, {
    drawBody: drawBody,
    bodySlotAnchors: bodySlotAnchors,
    drawPlayerWorld: drawPlayerWorld,
    limbIcon: limbIcon,
    stumpIcon: stumpIcon,
    silhouetteIcon: silhouetteIcon
  });
})();
