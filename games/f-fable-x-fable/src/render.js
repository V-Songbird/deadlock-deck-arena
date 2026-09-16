// Deadlock Deck: El Reloj Anatómico — render pipeline and gothic UI toolkit (Worker C).
// DD.render: 640×360 offscreen buffer, blitted to the visible canvas with smoothing off.
// DD.ui: pixel font, panels, buttons, cards, body/enemy drawing, HUD, backgrounds.
(function () {
  'use strict';
  const W = 640, H = 360;

  // ---------------------------------------------------------------------- DD.render
  const render = {
    canvas: null, screenCtx: null, buffer: null, ctx: null, scale: 1,
    init(canvas) {
      render.canvas = canvas;
      canvas.width = W; canvas.height = H;
      render.screenCtx = canvas.getContext('2d');
      render.buffer = document.createElement('canvas');
      render.buffer.width = W; render.buffer.height = H;
      render.ctx = render.buffer.getContext('2d');
      render.ctx.imageSmoothingEnabled = false;
      render.fit();
      window.addEventListener('resize', render.fit);
      window.addEventListener('orientationchange', render.fit);
    },
    // Fit the window keeping 16:9. Integer scale keeps pixels even, but only when it does not waste more
    // than 20 % of the available size; otherwise scale fractionally (letterboxed by the flex body).
    fit() {
      let s = Math.min(window.innerWidth / W, window.innerHeight / H);
      if (s >= 1 && Math.floor(s) / s >= 0.8) s = Math.floor(s);
      render.scale = s;
      render.canvas.style.width = Math.floor(W * s) + 'px';
      render.canvas.style.height = Math.floor(H * s) + 'px';
    },
    present() {
      const g = render.screenCtx;
      g.imageSmoothingEnabled = false;
      g.drawImage(render.buffer, 0, 0);
    },
    toLogical(clientX, clientY) {
      const r = render.canvas.getBoundingClientRect();
      return { x: (clientX - r.left) * W / r.width, y: (clientY - r.top) * H / r.height };
    },
  };

  // ------------------------------------------------------------------ color helpers
  const C = {
    ink: '#14101a', stone: '#2a2430', stoneLight: '#3c3644', stoneDark: '#1c1822', iron: '#606870',
    ironDark: '#3a3f48', brass: '#c8a464', brassDark: '#7a5a2c', bone: '#e6dcc4', parchment: '#d8c8a0',
    parchDark: '#a89468', blood: '#a02030', glow: '#7cf0d8', gold: '#f2e468', ember: '#ff6a3c', dim: '#8a8494',
  };
  function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function shade(hex, amt) { // amt in -1..1: darken / lighten
    const c = hexToRgb(hex).map((v) => DD.clamp(Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt), 0, 255));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ------------------------------------------------------------------ sprite cache
  // Sprites are rasterised once per (key, palette, flip, tint) into a tiny canvas.
  const spriteCache = new Map();
  function paletteOf(id) { return DD.sprites.palettes[id] || DD.sprites.palettes.palido; }
  function rasterise(spr, paletteId, flip, tint) {
    const key = spr.rows.join('|') + '|' + paletteId + '|' + (flip ? 1 : 0) + '|' + (tint || '');
    let c = spriteCache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = spr.w; c.height = spr.h;
    const g = c.getContext('2d'), pal = paletteOf(paletteId);
    for (let y = 0; y < spr.h; y++) {
      const row = spr.rows[y];
      for (let x = 0; x < spr.w; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        let col = tint || spr.map[ch] || '#ff00ff';
        if (col[0] !== '#') col = pal[col] || '#ff00ff';
        g.fillStyle = col;
        g.fillRect(flip ? spr.w - 1 - x : x, y, 1, 1);
      }
    }
    spriteCache.set(key, c);
    return c;
  }
  function blit(ctx, spr, x, y, o) {
    const s = (o && o.scale) || 1;
    const img = rasterise(spr, (o && o.palette) || 'palido', !!(o && o.flip), o && o.tint);
    ctx.drawImage(img, Math.round(x), Math.round(y), spr.w * s, spr.h * s);
    return { w: spr.w * s, h: spr.h * s };
  }

  // --------------------------------------------------------------------- pixel font
  // Glyph cell 5×8 (row 7 = descenders), advance 6 px, line height 9 px; all × size.
  const F = DD.sprites.font;
  const glyphCache = new Map();
  function glyphImg(ch, color) {
    const key = ch + '|' + color;
    let c = glyphCache.get(key);
    if (c) return c;
    const rows = (F.glyphs[ch] || F.glyphs['?']).split('/');
    c = document.createElement('canvas'); c.width = F.w; c.height = F.h;
    const g = c.getContext('2d'); g.fillStyle = color;
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < F.w; x++) if (rows[y][x] === '#') g.fillRect(x, y, 1, 1);
    glyphCache.set(key, c);
    return c;
  }

  const ui = {};
  ui.FONT = { w: F.w, h: F.h, adv: F.adv, lineH: F.lineH };
  ui.textWidth = (str, size) => { str = String(str); size = size || 1; return str.length ? (str.length * F.adv - 1) * size : 0; };

  // Greedy word wrap; words longer than maxWidth are split by characters. '\n' forces a break.
  ui.wrap = (str, maxWidth, size) => {
    size = size || 1;
    const perLine = Math.max(1, Math.floor((maxWidth + size) / (F.adv * size)));
    const out = [];
    for (const para of String(str).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        let w = word;
        while (w.length > perLine) { // overlong word: hard split
          if (line) { out.push(line); line = ''; }
          out.push(w.slice(0, perLine)); w = w.slice(perLine);
        }
        const cand = line ? line + ' ' + w : w;
        if (cand.length <= perLine) line = cand; else { out.push(line); line = w; }
      }
      out.push(line);
    }
    return out;
  };

  // Draws str at (x, y) = top-left of the first line (x is the anchor for align).
  // With maxWidth the text wraps (never truncates). Returns the number of lines drawn.
  ui.text = (ctx, str, x, y, o) => {
    o = o || {};
    const size = o.size || 1, color = o.color || C.bone, align = o.align || 'left';
    str = String(str);
    const lines = o.maxWidth ? ui.wrap(str, o.maxWidth, size) : str.split('\n');
    let ly = Math.round(y);
    for (const line of lines) {
      const w = ui.textWidth(line, size);
      let lx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
      for (const ch of line) {
        if (ch !== ' ') ctx.drawImage(glyphImg(ch, color), lx, ly, F.w * size, F.h * size);
        lx += F.adv * size;
      }
      ly += F.lineH * size;
    }
    return lines.length;
  };

  // ------------------------------------------------------------------ sprites/icons
  // Top-left anchored. palette = palette id (string). tint = literal color for every opaque pixel.
  ui.sprite = (ctx, key, x, y, o) => {
    const spr = DD.sprites.index[key];
    if (!spr) return { w: 0, h: 0 };
    return blit(ctx, spr, x, y, o);
  };
  ui.icon = (ctx, name, x, y, o) => ui.sprite(ctx, 'icon_' + name, x, y, o);

  // ------------------------------------------------------------------ primitives
  ui.bar = (ctx, x, y, w, h, ratio, fg, bg) => {
    ctx.fillStyle = bg || C.stoneDark;
    ctx.fillRect(x, y, w, h);
    const fw = Math.round((w - 2) * DD.clamp(ratio || 0, 0, 1));
    if (fw > 0) { ctx.fillStyle = fg || C.blood; ctx.fillRect(x + 1, y + 1, fw, h - 2); }
  };

  // Dark stone panel, thin double border, brass corner studs, optional title bar (12 px).
  ui.panel = (ctx, x, y, w, h, o) => {
    o = o || {};
    const edge = o.color || C.brassDark;
    ctx.fillStyle = rgba(C.stoneDark, 0.94); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = edge; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
    ctx.fillStyle = C.stoneLight; ctx.fillRect(x + 2, y + 2, w - 4, 1); ctx.fillRect(x + 2, y + h - 3, w - 4, 1); ctx.fillRect(x + 2, y + 2, 1, h - 4); ctx.fillRect(x + w - 3, y + 2, 1, h - 4);
    ctx.fillStyle = C.brass;
    for (const [cx, cy] of [[x, y], [x + w - 2, y], [x, y + h - 2], [x + w - 2, y + h - 2]]) ctx.fillRect(cx, cy, 2, 2);
    if (o.title) {
      ctx.fillStyle = C.stone; ctx.fillRect(x + 3, y + 3, w - 6, 12);
      ctx.fillStyle = edge; ctx.fillRect(x + 3, y + 15, w - 6, 1);
      ui.text(ctx, o.title, x + w / 2, y + 5, { color: C.gold, align: 'center' });
    }
  };

  // Immediate-mode button: draws, returns true when clicked this frame (never when disabled).
  ui.button = (ctx, x, y, w, h, label, o) => {
    o = o || {};
    const inp = DD.input;
    const inside = inp.x >= x && inp.x < x + w && inp.y >= y && inp.y < y + h;
    const hover = !o.disabled && inside, pressed = hover && inp.down;
    const base = o.color || '#4a4452';
    ctx.fillStyle = C.ink; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = hover ? shade(base, 0.18) : base; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = pressed ? shade(base, -0.4) : shade(base, 0.45); ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillRect(x + 1, y + 1, 1, h - 2);
    ctx.fillStyle = pressed ? shade(base, 0.45) : shade(base, -0.4); ctx.fillRect(x + 1, y + h - 2, w - 2, 1); ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
    ctx.fillStyle = C.brassDark; ctx.fillRect(x + 2, y + 2, 1, 1); ctx.fillRect(x + w - 3, y + 2, 1, 1); ctx.fillRect(x + 2, y + h - 3, 1, 1); ctx.fillRect(x + w - 3, y + h - 3, 1, 1);
    const size = !o.small && h >= 18 && ui.textWidth(label, 2) <= w - 6 ? 2 : 1;
    const off = pressed ? 1 : 0;
    ui.text(ctx, label, x + w / 2 + off, y + Math.floor((h - F.h * size) / 2) + off, { size, align: 'center', color: o.disabled ? C.dim : C.bone });
    if (o.disabled) { ctx.fillStyle = 'rgba(10,8,14,0.45)'; ctx.fillRect(x, y, w, h); }
    const clicked = hover && inp.clicked;
    if (clicked && DD.audio && DD.audio.sfx) DD.audio.sfx('click');
    return clicked;
  };

  // ---------------------------------------------------------------------- HUD / log
  ui.hud = (ctx, run) => {
    ctx.fillStyle = 'rgba(12,10,16,0.92)'; ctx.fillRect(0, 0, W, 22);
    ctx.fillStyle = C.brassDark; ctx.fillRect(0, 22, W, 1);
    ui.icon(ctx, 'hp', 4, 5);
    ui.text(ctx, run.hp + '/' + run.maxHp, 19, 3, { size: 2, color: run.hp <= run.maxHp * 0.3 ? C.ember : C.bone });
    const floorName = run.floor ? run.floor.name : (DD.tower && DD.tower.floorNames ? DD.tower.floorNames[run.floorIndex] : '');
    if (floorName) ui.text(ctx, floorName, 96, 7, { color: C.dim });
    const urgent = run.timeLeft < 30;
    ctx.save();
    if (urgent) ctx.globalAlpha = 0.65 + 0.35 * Math.sin(now() / 90);
    ui.icon(ctx, 'clock', 290, 5);
    ui.text(ctx, DD.fmtTime(run.timeLeft), 332, 3, { size: 2, align: 'center', color: urgent ? '#ff3030' : C.gold });
    ctx.restore();
    ui.text(ctx, String(run.ichor), W - 20, 3, { size: 2, align: 'right', color: C.gold });
    ui.icon(ctx, 'ichor', W - 16, 5);
  };

  ui.log = (ctx, run, x, y, w) => {
    const lines = run.log || [];
    const shades = ['#4e4858', '#6a6472', '#8a8494', '#a8a2b0', '#c8c2c8', C.bone];
    let ly = y;
    for (let i = 0; i < lines.length; i++) {
      const color = shades[Math.max(0, shades.length - lines.length + i)];
      ly += ui.text(ctx, lines[i], x, ly, { color, maxWidth: w }) * F.lineH;
    }
    return ly - y;
  };

  // --------------------------------------------------------------------------- cards
  ui.CARD_W = 72; ui.CARD_H = 96;
  ui.SLOT_COLOR = { head: '#8a5ac8', torso: '#b02840', armL: '#d89a30', armR: '#d89a30', legL: '#4ea850', legR: '#4ea850' };

  ui.drawCard = (ctx, card, x, y, o) => {
    o = o || {};
    const cw = ui.CARD_W, ch = ui.CARD_H;
    x = Math.round(x); y = Math.round(y);
    if (o.selected) { ctx.fillStyle = C.gold; ctx.fillRect(x - 2, y - 2, cw + 4, ch + 4); }
    else if (o.playable && !o.disabled) { ctx.fillStyle = rgba(C.gold, 0.4); ctx.fillRect(x - 1, y - 1, cw + 2, ch + 2); }
    ctx.fillStyle = C.ink; ctx.fillRect(x, y, cw, ch);
    ctx.fillStyle = C.parchment; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
    ctx.fillStyle = C.parchDark; // inner ornament line
    ctx.fillRect(x + 3, y + 3, cw - 6, 1); ctx.fillRect(x + 3, y + ch - 4, cw - 6, 1); ctx.fillRect(x + 3, y + 3, 1, ch - 6); ctx.fillRect(x + cw - 4, y + 3, 1, ch - 6);
    ctx.fillStyle = C.brassDark; // corner flourishes
    for (const [cx, cy] of [[x + 3, y + 3], [x + cw - 5, y + 3], [x + 3, y + ch - 5], [x + cw - 5, y + ch - 5]]) ctx.fillRect(cx, cy, 2, 2);
    const slotColor = ui.SLOT_COLOR[o.slot] || C.dim;
    // cost circle (top-left)
    ctx.fillStyle = C.brass; ctx.beginPath(); ctx.arc(x + 10, y + 10, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.stoneDark; ctx.beginPath(); ctx.arc(x + 10, y + 10, 6, 0, Math.PI * 2); ctx.fill();
    ui.text(ctx, String(card.cost), x + 10, y + 6, { align: 'center', color: C.gold });
    // heat (top-right)
    ui.icon(ctx, 'heat', x + cw - 25, y + 3);
    ui.text(ctx, String(card.heat || 0), x + cw - 6, y + 6, { align: 'right', color: card.heat >= 3 ? C.blood : C.ink });
    // name (up to 2 lines) and slot band
    const nameLines = ui.wrap(card.name, cw - 8, 1).slice(0, 2);
    ui.text(ctx, nameLines.join('\n'), x + cw / 2, nameLines.length > 1 ? y + 18 : y + 22, { align: 'center', color: C.ink });
    ctx.fillStyle = slotColor; ctx.fillRect(x + 4, y + 37, cw - 8, 2);
    // description
    const desc = ui.wrap(card.desc || '', cw - 6, 1).slice(0, 5);
    ui.text(ctx, desc.join('\n'), x + 3, y + 41, { color: '#3a2630' });
    // slot badge (bottom-right)
    ctx.fillStyle = C.ink; ctx.fillRect(x + cw - 12, y + ch - 10, 8, 6);
    ctx.fillStyle = slotColor; ctx.fillRect(x + cw - 11, y + ch - 9, 6, 4);
    if (o.disabled) { ctx.fillStyle = 'rgba(20,16,26,0.6)'; ctx.fillRect(x, y, cw, ch); }
  };

  // --------------------------------------------------------------------------- body
  // Figure = 22×38 logical pixels (× scale), anchored at bottom-center (x, y).
  // Layout: head 10×10 on top, torso 12×14, arms 5×14 at the torso's sides (right arm flipped),
  // legs 5×14 under the torso (right leg flipped). Returns the figure rect.
  ui.BODY_W = 22; ui.BODY_H = 38;
  ui.drawBody = (ctx, x, y, body, o) => {
    o = o || {};
    const s = o.scale || 1, pal = o.palette || (DD.run && DD.run.palette) || 'palido';
    const left = Math.round(x - 11 * s), top = Math.round(y - 38 * s);
    const part = (slot) => { const l = body[slot]; return l ? l.id : 'stump_' + DD.SLOT_TYPE[slot]; };
    const draw = (slot, px, py, flip) => ui.sprite(ctx, part(slot), px, py, { scale: s, palette: pal, flip });
    draw('legL', left + 6 * s, top + 24 * s, false);
    draw('legR', left + 11 * s, top + 24 * s, true);
    draw('armL', left, top + 11 * s, false);
    draw('armR', left + 17 * s, top + 11 * s, true);
    draw('torso', left + 5 * s, top + 10 * s, false);
    draw('head', left + 6 * s, top, false);
    if (o.showHeat || o.labels) {
      const bx = left + 22 * s + 4, rowH = o.labels ? 19 : 10;
      let by = Math.max(0, top);
      for (const slot of DD.SLOTS) {
        const limb = body[slot];
        ui.text(ctx, DD.SLOT_NAME[slot], bx, by, { color: C.dim });
        if (limb) {
          const def = DD.data.limbs[limb.id];
          const ratio = def ? limb.heat / def.maxHeat : 0;
          if (o.showHeat) ui.bar(ctx, bx + 68, by + 2, 32, 5, ratio, ratio < 0.5 ? '#5cc85c' : ratio < 0.8 ? '#e8a030' : '#e03030');
          if (o.labels) ui.text(ctx, def ? def.name : limb.id, bx, by + 9, { color: C.bone });
        } else {
          ui.text(ctx, 'MUÑÓN', bx + 68, by, { color: C.blood });
        }
        by += rowH;
      }
    }
    return { x: left, y: top, w: 22 * s, h: 38 * s };
  };

  // Enemy anchored at bottom-center (x, y); idle bob of 1 px; hurt = white/red flash. Returns the rect.
  ui.drawEnemy = (ctx, enemyId, x, y, o) => {
    o = o || {};
    const s = o.scale || 1;
    const spr = DD.sprites.enemies[enemyId] || DD.sprites.icons.skull;
    const bob = Math.floor(now() / 500) % 2;
    const left = Math.round(x - spr.w * s / 2), top = Math.round(y - spr.h * s - bob * s);
    const tint = o.hurt ? (Math.floor(now() / 70) % 2 ? '#ffffff' : '#ff5050') : undefined;
    blit(ctx, spr, left, top, { scale: s, flip: !!o.flip, tint });
    return { x: left, y: top, w: spr.w * s, h: spr.h * s };
  };

  // --------------------------------------------------------------------- backgrounds
  // Each backdrop is generated once into an offscreen 640×360 canvas; drawing it is one drawImage
  // plus a cheap animated glow overlay.
  const bgCache = {};
  function prng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  function stoneWall(g, x, y, w, h, base, seed) {
    const rnd = prng(seed);
    g.fillStyle = shade(base, -0.45); g.fillRect(x, y, w, h);
    for (let by = y, row = 0; by < y + h; by += 8, row++) {
      for (let bx = x - (row % 2 ? 8 : 0); bx < x + w; bx += 16) {
        const v = (rnd() - 0.5) * 0.3;
        g.fillStyle = shade(base, v);
        g.fillRect(Math.max(bx, x), by, Math.min(15, x + w - bx), 7);
        if (rnd() < 0.08) { g.fillStyle = shade(base, -0.35); g.fillRect(Math.max(bx, x) + 3, by + 2, 4, 1); } // crack
      }
    }
  }
  function pipe(g, x, y, len, vertical, color) {
    const w = 6;
    g.fillStyle = shade(color, -0.4); g.fillRect(x, y, vertical ? w : len, vertical ? len : w);
    g.fillStyle = color; g.fillRect(x + 1, y + 1, vertical ? w - 3 : len - 2, vertical ? len - 2 : w - 3);
    g.fillStyle = shade(color, 0.35); g.fillRect(x + 1, y + 1, vertical ? 1 : len - 2, vertical ? len - 2 : 1);
    for (let i = 12; i < len - 6; i += 28) { // rings
      g.fillStyle = shade(color, -0.25);
      if (vertical) g.fillRect(x - 1, y + i, w + 2, 3); else g.fillRect(x + i, y - 1, 3, w + 2);
    }
  }
  function chain(g, x, y, len) {
    for (let i = 0; i < len; i += 6) blit(g, DD.sprites.misc.chain, x, y + i, {});
  }
  function glow(g, x, y, r, color, alpha) {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, rgba(color, alpha)); grd.addColorStop(1, rgba(color, 0));
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function flames(g, x, y, w, count, seed, scale) {
    const rnd = prng(seed);
    for (let i = 0; i < count; i++) {
      const fx = x + rnd() * w, s = scale + Math.floor(rnd() * 2);
      glow(g, fx + 4 * s, y - 4 * s, 18 * s, C.ember, 0.35);
      blit(g, DD.sprites.misc.flame, fx, y - 12 * s, { scale: s });
    }
  }
  function vignette(g, strength) {
    const grd = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, `rgba(0,0,0,${strength})`);
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
  }
  function sky(g, top, bottom, horizonY) {
    const grd = g.createLinearGradient(0, 0, 0, horizonY);
    grd.addColorStop(0, top); grd.addColorStop(1, bottom);
    g.fillStyle = grd; g.fillRect(0, 0, W, horizonY);
  }
  function battlements(g, x, y, w, h, base, seed) {
    stoneWall(g, x, y, w, h, base, seed);
    for (let bx = x; bx < x + w; bx += 16) stoneWall(g, bx, y - 8, 8, 8, base, seed + bx);
  }

  const builders = {
    title(g) {
      sky(g, '#07040c', '#4a1018', 300);
      glow(g, 320, 330, 260, '#ff5a20', 0.55);
      const rnd = prng(7); // embers
      for (let i = 0; i < 60; i++) { g.fillStyle = rgba(rnd() < 0.5 ? C.ember : C.gold, 0.4 + rnd() * 0.6); g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * 300), 1, 1); }
      g.fillStyle = '#0c0810'; // far rooftops
      for (let x = 0; x < W; x += 24) g.fillRect(x, 286 + ((x / 24) % 3) * 6, 24, 80);
      const tower = (x, w, top) => { // silhouette with crenellations and windows
        g.fillStyle = '#0a0710'; g.fillRect(x, top, w, H - top);
        for (let bx = x; bx < x + w; bx += 10) g.fillRect(bx, top - 6, 5, 6);
        const r = prng(x);
        for (let wy = top + 16; wy < 280; wy += 24) for (let wx = x + 6; wx < x + w - 6; wx += 14) if (r() < 0.45) { g.fillStyle = r() < 0.5 ? C.ember : '#ffb040'; g.fillRect(wx, wy, 3, 5); }
      };
      tower(236, 60, 120); tower(344, 60, 120); tower(270, 100, 60);
      g.fillStyle = '#0a0710'; g.fillRect(300, 20, 40, 42); g.fillRect(316, 4, 8, 20); // spire
      flames(g, 250, 300, 140, 7, 11, 2);
      chain(g, 40, 0, 130); chain(g, 596, 0, 100); chain(g, 110, 0, 60);
      vignette(g, 0.55);
    },
    lab(g) {
      stoneWall(g, 0, 0, W, 300, '#302838', 21);
      g.fillStyle = '#1a161e'; g.fillRect(0, 300, W, 60); // flagstone floor
      g.fillStyle = '#242028'; for (let x = 0; x < W; x += 32) for (let y = 300; y < H; y += 12) g.fillRect(x + ((y / 12) % 2) * 16, y, 30, 10);
      pipe(g, 0, 26, W, false, C.brass); pipe(g, 452, 26, 274, true, C.brass); pipe(g, 8, 26, 274, true, C.iron);
      g.fillStyle = '#3a2618'; g.fillRect(40, 92, 190, 4); g.fillRect(40, 140, 190, 4); // shelves
      const jars = ['jar_green', 'jar_red', 'jar_amber'];
      for (let i = 0; i < 9; i++) { const k = jars[i % 3]; glow(g, 52 + i * 21 + 8, 84 - (i % 2 ? 48 : 0), 12, DD.sprites.misc[k].map.g, 0.35); blit(g, DD.sprites.misc[k], 46 + i * 21, i % 2 ? 76 : 124, { scale: 2 }); }
      glow(g, 560, 250, 70, '#8fd47a', 0.45);
      blit(g, DD.sprites.misc.alembic, 528, 246, { scale: 3 });
      chain(g, 250, 26, 110); chain(g, 620, 26, 150); chain(g, 400, 26, 70);
      glow(g, 130, 60, 60, C.ember, 0.3); blit(g, DD.sprites.misc.torch, 124, 50, { scale: 2 });
      vignette(g, 0.6);
    },
    corridor(g) {
      stoneWall(g, 0, 0, W, H, '#2a2430', 33);
      pipe(g, 10, 0, H, true, C.iron); pipe(g, 624, 0, H, true, C.iron); pipe(g, 0, 344, W, false, C.brassDark);
      chain(g, 40, 0, 80); chain(g, 596, 0, 120);
      for (const [x, y] of [[70, 40], [560, 40], [70, 260], [560, 260]]) { glow(g, x + 6, y + 6, 50, C.ember, 0.3); blit(g, DD.sprites.misc.torch, x, y, { scale: 2 }); }
      vignette(g, 0.7);
    },
    table(g) {
      stoneWall(g, 0, 0, W, 240, '#241e2a', 45);
      g.fillStyle = '#16121a'; g.fillRect(0, 240, W, 120);
      g.fillStyle = '#1e1a22'; for (let x = 0; x < W; x += 40) for (let y = 240; y < H; y += 16) g.fillRect(x + ((y / 16) % 2) * 20, y, 38, 14);
      // hanging lamp and light cone
      chain(g, 318, 0, 30); g.fillStyle = C.brassDark; g.fillRect(306, 30, 28, 6); g.fillStyle = C.gold; g.fillRect(312, 36, 16, 3);
      const cone = g.createLinearGradient(0, 36, 0, 260); cone.addColorStop(0, rgba(C.gold, 0.28)); cone.addColorStop(1, rgba(C.gold, 0));
      g.fillStyle = cone; g.beginPath(); g.moveTo(310, 38); g.lineTo(330, 38); g.lineTo(470, 260); g.lineTo(170, 260); g.closePath(); g.fill();
      // the slab
      g.fillStyle = '#2c2a34'; g.fillRect(180, 262, 20, 70); g.fillRect(440, 262, 20, 70);
      g.fillStyle = C.ironDark; g.fillRect(160, 236, 320, 30);
      g.fillStyle = C.iron; g.fillRect(162, 238, 316, 22);
      g.fillStyle = shade(C.iron, 0.25); g.fillRect(162, 238, 316, 2);
      g.fillStyle = C.blood; g.fillRect(300, 246, 40, 4); g.fillRect(360, 250, 24, 3); g.fillRect(220, 252, 14, 2);
      g.fillStyle = '#5a3a28'; for (const x of [210, 300, 400]) { g.fillRect(x, 232, 10, 34); g.fillStyle = C.brass; g.fillRect(x + 3, 244, 4, 4); g.fillStyle = '#5a3a28'; } // straps + buckles
      // instrument tray
      g.fillStyle = C.ironDark; g.fillRect(500, 246, 70, 16); g.fillStyle = '#4c5058'; g.fillRect(502, 248, 66, 12);
      g.fillStyle = '#c8d0d8'; g.fillRect(508, 252, 20, 1); g.fillRect(534, 250, 1, 8); g.fillRect(544, 251, 16, 2); g.fillRect(506, 256, 14, 1);
      g.fillStyle = '#3a2618'; g.fillRect(30, 100, 110, 4);
      for (let i = 0; i < 5; i++) blit(g, DD.sprites.misc[['jar_red', 'jar_green', 'jar_amber'][i % 3]], 34 + i * 21, 84, { scale: 2 });
      chain(g, 100, 0, 60); chain(g, 560, 0, 90);
      vignette(g, 0.65);
    },
    roof(g) {
      sky(g, '#0a0614', '#5a1a1a', 250);
      const rnd = prng(99);
      for (let i = 0; i < 80; i++) { g.fillStyle = rgba(rnd() < 0.6 ? C.ember : C.gold, 0.3 + rnd() * 0.7); g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * 240), 1, 1); }
      for (let i = 0; i < 6; i++) glow(g, 60 + i * 110, 200 - (i % 2) * 30, 70, '#3a3038', 0.45); // smoke
      g.fillStyle = '#0c0812'; for (let x = 0; x < W; x += 20) g.fillRect(x, 236 + ((x / 20) % 4) * 7, 20, 60); // city below
      battlements(g, 0, 262, W, 98, '#3a2e34', 55);
      g.fillStyle = '#0e0a12'; g.fillRect(0, 300, W, 60); stoneWall(g, 0, 300, W, 60, '#26202a', 56); // walkway
      stoneWall(g, 40, 120, 60, 150, '#3a2e34', 57); g.fillStyle = C.ember; g.fillRect(58, 160, 6, 10); g.fillRect(74, 190, 6, 10); // burning turret
      flames(g, 30, 122, 80, 6, 61, 2); flames(g, 0, 262, W, 14, 62, 2); flames(g, 380, 262, 200, 5, 63, 3);
      glow(g, 320, 330, 340, '#ff6020', 0.3);
      vignette(g, 0.5);
    },
  };

  ui.background = (ctx, kind) => {
    let c = bgCache[kind];
    if (!c) {
      c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      (builders[kind] || builders.corridor)(g);
      bgCache[kind] = c;
    }
    ctx.drawImage(c, 0, 0);
    if (kind === 'title' || kind === 'roof' || kind === 'lab') { // fire flicker
      ctx.fillStyle = rgba(C.ember, 0.04 + 0.04 * Math.sin(now() / 130) + 0.03 * Math.sin(now() / 47));
      ctx.fillRect(0, 0, W, H);
    }
  };

  window.DD.render = render;
  window.DD.ui = ui;
})();
