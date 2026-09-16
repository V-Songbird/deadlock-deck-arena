/* DD.View.ui — every screen that is not exploration or combat: backdrop, title,
 * menus, card faces, blueprints, the graft table, the codex, the shop, the
 * result and the pause overlay. SPEC.md 6.7. Read state directly, never throw. */
(function () {
  'use strict';
  var DD = window.DD;
  var V = DD.View = DD.View || { hud: {}, explore: {}, combat: {}, ui: {} };
  var U = V.ui = V.ui || {};

  /* ----------------------------------------------------------- layout */
  var VW = DD.VW || 640;
  var VH = DD.VH || 360;
  var GUT = 16;                                     // screen gutter
  var HEAD = { x: GUT, y: 4, w: VW - GUT * 2, h: 28 };
  var TAB = { x: GUT, y: 36, h: 22, w: 96 };        // tab buttons
  var CONTENT = { x: GUT, y: 64, w: VW - GUT * 2, h: VH - 64 - 26 };
  var FOOT_Y = VH - 18;
  var TITLE = { cx: VW / 2, logoY: 104, titleY: 84, subY: 116, lineY: 158 };
  var MENU = { x: 214, y: 186, w: 212, rowH: 22, gap: 2 };
  var PANEL_PAUSE = { x: 180, y: 84, w: 280, h: 210 };
  var LIMB_W = 292, LIMB_H = 266;                   // blueprint card
  var ENEMY_C = { w: 196, h: 158, gap: 10, pitch: 166 };
  var SHOP_ROW = 48;
  var SCROLLBAR = { w: 3 };

  /* ---------------------------------------------------------- vocabulary */
  var TYPE_ES = { attack: 'Ataque', block: 'Defensa', skill: 'Habilidad', power: 'Poder' };
  var TYPE_COL = { attack: DD.C.bloodHi, block: DD.C.steel, skill: DD.C.bile, power: DD.C.poison };
  var RARITY_ES = { common: 'Común', uncommon: 'Poco común', rare: 'Rara' };
  var RARITY_COL = { common: DD.C.textDim, uncommon: DD.C.integrity, rare: DD.C.gold };
  var SLOT_ES = { head: 'Cabeza', torso: 'Torso', arm: 'Brazo', leg: 'Pierna' };
  var PASSIVE_ES = {
    thorns: 'Espinas', regen: 'Regeneración', drawBonus: 'Cartas extra', energyBonus: 'Energía extra',
    blockBonus: 'Bloqueo extra', heatResist: 'Resiste calor', coolBonus: 'Enfriamiento extra',
    lifesteal: 'Robavida', firstStrike: 'Golpe inicial', bleedOnHit: 'Sangrado al golpear',
    maxHpBonus: 'Vida máxima', scavengeBonus: 'Botín extra', openingDraw: 'Mano inicial'
  };
  var RESULT = {
    dead: { title: 'HAS MUERTO', col: DD.C.steel, tint: '#0e1420',
      sub: 'La torre te ha desmontado pieza a pieza.' },
    timedout: { title: 'SE ACABÓ EL TIEMPO', col: DD.C.bloodHi, tint: '#1c0408',
      sub: 'El reloj anatómico se detuvo. Y tú con él.' },
    escaped: { title: 'HAS ESCAPADO', col: DD.C.gold, tint: '#1c1404',
      sub: 'Saliste por la puerta con el cuerpo que te queda.' }
  };

  /* ------------------------------------------------------------- clock */
  var lastNow = 0;
  var nowT = 0;

  function frame() {
    var n = (DD.now ? DD.now() : Date.now()) / 1000;
    var d = lastNow ? n - lastNow : 0;
    lastNow = n;
    if (!(d > 0)) return 0;
    if (d > 0.06) d = 0.06;
    nowT += d;
    return d;
  }

  /* ------------------------------------------------------------ helpers */
  /* Top of an 8*scale-tall glyph block centred in a row. */
  function vmid(top, h, scale) { return top + Math.round((h - 8 * scale) / 2); }

  function line(s, x, top, color, scale) {
    scale = scale || 1;
    DD.Pixel.text(s, x, top + scale, { color: color || DD.C.text, scale: scale });
    return top + 8 * scale;
  }

  function center(s, cx, top, color, scale) {
    scale = scale || 1;
    DD.Pixel.text(s, cx, top + scale, { color: color || DD.C.text, scale: scale, align: 'center' });
    return top + 8 * scale;
  }

  /* Wrapped paragraph; returns the top of the line below it. */
  function para(s, x, top, w, color, scale, lineH) {
    scale = scale || 1;
    lineH = lineH || 8 * scale;
    var lines = DD.Pixel.wrap(s, w, scale);
    for (var i = 0; i < lines.length; i++) {
      DD.Pixel.text(lines[i], x, top + i * lineH + scale, { color: color || DD.C.textDim, scale: scale });
    }
    return top + lines.length * lineH;
  }

  function stat(label, value, x, top) {
    line(label, x, top, DD.C.textFaint, 1);
    DD.Pixel.text(value, x + 112, top + 1, { color: DD.C.text, align: 'right' });
    return top + 11;
  }

  function vignette(color, strength) {
    var n = 10, band = 3, i, a;
    for (i = 0; i < n; i++) {
      a = strength * Math.pow(1 - i / n, 2);
      if (a <= 0.005) continue;
      DD.Pixel.dim(0, i * band, VW, band, a, color);
      DD.Pixel.dim(0, VH - (i + 1) * band, VW, band, a, color);
      DD.Pixel.dim(i * band, 0, band, VH, a, color);
      DD.Pixel.dim(VW - (i + 1) * band, 0, band, VH, a, color);
    }
  }

  function cardById(id) { return (DD.Data && DD.Data.cardById && DD.Data.cardById[id]) || null; }
  function limbById(id) { return (DD.Data && DD.Data.limbById && DD.Data.limbById[id]) || null; }
  function meta() { return (DD.Run && DD.Run.meta) || null; }

  function knownLimb(id) {
    if (DD.Progress && DD.Progress.knownLimb) return DD.Progress.knownLimb(id);
    var m = meta();
    return !!(m && m.codexLimbs && m.codexLimbs[id]);
  }
  function knownEnemy(id) {
    if (DD.Progress && DD.Progress.knownEnemy) return DD.Progress.knownEnemy(id);
    var m = meta();
    return !!(m && m.codexEnemies && m.codexEnemies[id]);
  }
  function codexCount(kind) {
    var m = meta();
    var src = kind === 'limbs' ? (m && m.codexLimbs) : (m && m.codexEnemies);
    var n = 0;
    for (var k in (src || {})) if (src[k]) n++;
    return n;
  }
  function codexTotal(kind) {
    var list = kind === 'limbs' ? (DD.Data && DD.Data.limbs) : (DD.Data && DD.Data.enemies);
    return (list && list.length) || 0;
  }

  function passiveText(p) {
    if (!p || !p.id) return 'Sin pasiva';
    return (PASSIVE_ES[p.id] || p.id) + ' ' + (p.v || 0);
  }

  function limbAvatarKey(limb) {
    var slot = limb.slot === 'arm' ? 'arm' : (limb.slot === 'leg' ? 'leg' : (limb.slot || 'head'));
    return 'av_' + slot + '_' + (limb.form || 'gaunt') + '_down';
  }

  /* One card, 48x64, name over cost and heat. Only used when the combat view
   * cannot draw it: the graft table must never show a blank back. */
  function miniCard(id, def, x, y) {
    DD.Pixel.panel(x, y, 48, 64, { fill: DD.C.panelLo, accent: TYPE_COL[(def && def.type) || 'skill'] });
    DD.Pixel.text(String(def ? def.cost : 0), x + 4, y + 10, { color: DD.C.energy });
    DD.Pixel.text(String(def ? def.heat : 0), x + 44, y + 10, { align: 'right', color: DD.C.heat[2] });
    DD.Pixel.rect(x + 4, y + 14, 40, 1, DD.C.line);
    var lines = DD.Pixel.wrap((def && def.name) || id || '?', 40, 1);
    for (var i = 0; i < lines.length && i < 4; i++) {
      DD.Pixel.text(lines[i], x + 4, y + 26 + i * 9, { color: DD.C.text });
    }
  }

  /* ---------------------------------------------------------- backdrop */
  U.bg = function () {
    frame();
    DD.Pixel.rect(0, 0, VW, VH, DD.C.void);
    var x, y, i;
    for (y = 0; y < VH; y += 64) {
      for (x = 0; x < VW; x += 64) DD.Pixel.sprite('bg_wall', x, y);
    }
    DD.Pixel.dim(0, 0, VW, VH, 0.64, DD.C.void);

    /* slow drift of motes, so a menu is never a still image */
    var span = VH + 60;
    for (i = 0; i < 28; i++) {
      var h = DD.hash ? DD.hash(i * 13 + 5, 91) : (i * 2654435761);
      var speed = 3 + (h % 7);
      var my = (((h >> 8) % span) - 30 - nowT * speed) % span;
      if (my < 0) my += span;
      my -= 30;
      var a = 0.09 + 0.07 * Math.sin(nowT * 2 + i);
      var gold = (h % 5) === 0;
      DD.Pixel.rect(h % VW, my, gold ? 2 : 1, gold ? 2 : 1,
        gold ? DD.C.gold : DD.C.textFaint);
      if (gold) DD.Pixel.dim(h % VW, my, 2, 2, 0.5 + a * 2, DD.C.gold);
    }
    DD.Pixel.dim(0, 0, VW, VH, 0.05 + 0.03 * Math.sin(nowT * 1.7), '#000000');
    vignette(DD.C.void, 0.75);
  };

  /* -------------------------------------------------------------- title */
  U.title = function (sub) {
    frame();
    var i, x, h;
    if (DD.Pixel.hasSprite('ui_drip')) {
      for (i = 0; i < 9; i++) {
        h = DD.hash ? DD.hash(i * 71 + 3, 17) : (i * 97);
        if (h % 3 === 0) continue;
        x = 40 + (h % (VW - 80));
        DD.Pixel.sprite('ui_drip', x, -4, { alpha: 0.55 + 0.3 * ((h >> 4) % 3) / 2 });
      }
    }
    if (DD.Pixel.hasSprite('ui_logo')) DD.Pixel.sprite('ui_logo', TITLE.cx, TITLE.logoY, { anchor: 'center', scale: 2 });
    DD.Pixel.text('DEADLOCK DECK', TITLE.cx, TITLE.titleY + 3, { scale: 3, align: 'center', color: DD.C.text });
    DD.Pixel.text('El Reloj Anatómico', TITLE.cx, TITLE.subY + 1, { align: 'center', color: DD.C.gold });
    DD.Pixel.rect(TITLE.cx - 90, TITLE.lineY, 180, 1, DD.C.line);
    DD.Pixel.rect(TITLE.cx - 20, TITLE.lineY - 1, 40, 3, DD.C.lineHi);
    if (sub) center(sub, TITLE.cx, TITLE.lineY + 10, DD.C.textDim, 1);
  };

  /* --------------------------------------------------------------- menu */
  var menuKey = { n: -1, text: '', t: 0 };
  var menuNow = 0;

  /* The menu is often drawn after U.bg() has already consumed the frame, so it
   * keeps its own clock rather than sharing frame()'s. */
  function menuDelta() {
    var n = (DD.now ? DD.now() : Date.now()) / 1000;
    var d = menuNow ? n - menuNow : 0;
    menuNow = n;
    if (!(d > 0)) return 0;
    return d > 0.06 ? 0.06 : d;
  }

  U.menu = function (items, index, opts) {
    opts = opts || {};
    var d = menuDelta();
    var list = items || [];
    var key = list.join('|');
    if (key !== menuKey.text || list.length !== menuKey.n) { menuKey.text = key; menuKey.n = list.length; menuKey.t = 0; }
    menuKey.t += d;

    var x = opts.x === undefined ? MENU.x : opts.x;
    var y = opts.y === undefined ? MENU.y : opts.y;
    var w = opts.w || MENU.w;
    var rowH = MENU.rowH, gap = MENU.gap, i;

    for (i = 0; i < list.length; i++) {
      var rev = DD.clamp((menuKey.t + 0.06 - i * 0.06) / 0.22, 0, 1);
      if (rev <= 0) continue;
      var sel = i === index;
      var s = sel ? 2 : 1;
      var rowY = y + i * (rowH + gap);
      var rx = x + (1 - DD.easeOut(rev)) * 16;
      var alpha = rev * (sel ? 1 : 0.7);
      if (sel) {
        DD.Pixel.dim(rx - 8, rowY, w + 16, rowH, 0.55 * rev, DD.C.panelHi);
        DD.Pixel.frame(rx - 8, rowY, w + 16, rowH, DD.C.lineHi);
        if (DD.Pixel.hasSprite('ui_selector')) {
          DD.Pixel.sprite('ui_selector', rx - 24, rowY + (rowH - 16) / 2, { alpha: alpha });
        }
      }
      DD.Pixel.text(list[i], rx + (sel ? 4 : 8), vmid(rowY, rowH, s) + s, {
        scale: s, color: sel ? DD.C.text : DD.C.textDim, alpha: alpha
      });
    }
    if (opts.hint) {
      DD.Pixel.text(opts.hint, x + w / 2, y + list.length * (rowH + gap) + 14, {
        align: 'center', color: DD.C.textDim
      });
    }
  };

  /* ---------------------------------------------------------- card face */
  U.cardFull = function (card, x, y, opts) {
    opts = opts || {};
    frame();
    if (!card) return;
    var s = opts.scale || 2;
    var w = 48 * s, h = 64 * s;
    var type = TYPE_ES[card.type] ? card.type : 'skill';
    var stump = card.id && String(card.id).indexOf('stump_') === 0;
    var key = stump ? 'card_frame_stump' : 'card_frame_' + type;
    if (DD.Pixel.hasSprite(key)) DD.Pixel.sprite(key, x, y, { scale: s });
    else DD.Pixel.panel(x, y, w, h, { accent: TYPE_COL[type] });

    var pad = Math.round(4 * s);
    var cw = w - pad * 2;
    var cx = x + w / 2;
    var top = y + pad;
    var i;

    if (DD.Pixel.hasSprite(card.art)) {
      DD.Pixel.sprite(card.art, cx, top + 8 * s, { anchor: 'center', scale: s });
    }
    top += 16 * s + 4;

    var nameLines = DD.Pixel.wrap(card.name || '?', cw, 1);
    for (i = 0; i < nameLines.length && i < 2; i++) {
      DD.Pixel.text(nameLines[i], cx, top + i * 9, { align: 'center', color: DD.C.text });
    }
    top += Math.min(nameLines.length, 2) * 9 + 3;

    var typeTop = y + h - pad - 10;      // type and rarity, on the last line
    var heatTop = typeTop - 18;          // heat, just above it
    var sepY = heatTop - 8;

    var descLines = DD.Pixel.wrap(card.desc || '', cw, 1);
    var room = Math.floor((sepY - top) / 9);
    for (i = 0; i < descLines.length && i < room; i++) {
      DD.Pixel.text(descLines[i], cx, top + i * 9, { align: 'center', color: DD.C.textDim });
    }

    DD.Pixel.rect(x + pad, sepY, cw, 1, DD.C.line);
    line(TYPE_ES[type] || type, x + pad, typeTop, TYPE_COL[type], 1);
    DD.Pixel.text(RARITY_ES[card.rarity] || card.rarity || '', x + w - pad, typeTop + 1, {
      align: 'right', color: RARITY_COL[card.rarity] || DD.C.textDim
    });
    if (DD.Pixel.hasSprite('icon_heat')) DD.Pixel.sprite('icon_heat', x + pad, heatTop);
    DD.Pixel.text(String(card.heat || 0), x + pad + 18, heatTop + 14, { color: DD.C.heat[2] });
    if (DD.Pixel.hasSprite('icon_energy')) DD.Pixel.sprite('icon_energy', x + w - pad - 30, y + 2);
    DD.Pixel.text(String(card.cost === undefined ? 0 : card.cost), x + w - pad - 4, y + 8, {
      align: 'right', color: DD.C.energy
    });
  };

  /* -------------------------------------------------------- blueprint */
  /* One entry layout, driven by opts.w / opts.h so the codex and the graft
   * table share it. */
  U.limbCard = function (limb, x, y, opts) {
    opts = opts || {};
    frame();
    if (!limb) return;
    var w = opts.w || LIMB_W;
    var h = opts.h || LIMB_H;
    DD.Pixel.panel(x, y, w, h, { accent: tierColor(limb.tier) });

    /* avatar part in a mould */
    DD.Pixel.dim(x + 8, y + 6, 48, 56, 1, DD.C.panelLo);
    DD.Pixel.frame(x + 8, y + 6, 48, 56, DD.C.line);
    DD.Pixel.sprite(limbAvatarKey(limb), x + 32, y + 58, {
      anchor: 'bottom', scale: 2, palette: limb.palette
    });

    var nx = x + 64, nw = w - 72, i;
    var nameScale = DD.Pixel.textW(limb.name || '?', 2) <= nw ? 2 : 1;
    var nameLines = DD.Pixel.wrap(limb.name || '?', nw, nameScale);
    if (nameLines.length > 2) nameLines = [nameLines[0], nameLines[1]];
    var ny = y + 10;
    for (i = 0; i < nameLines.length; i++) {
      DD.Pixel.text(nameLines[i], nx, ny + i * 8 * nameScale + nameScale, { color: DD.C.text, scale: nameScale });
    }
    ny += nameLines.length * 8 * nameScale + 2;
    line((SLOT_ES[limb.slot] || limb.slot || '?') + ' -Nivel ' + (limb.tier || 1), nx, ny, tierColor(limb.tier), 1);

    var st = y + 74, half = Math.round(w / 2);
    stat('Integridad', String(limb.integrity || 0), x + 10, st);
    stat('Calor máx.', String(limb.heatCap || 0), x + 10, st + 11);
    stat('Enfriamiento', String(limb.coolRate || 0), x + half, st);
    stat('Vida', '+' + (limb.maxHpBonus || 0), x + half, st + 11);

    var py = y + 100;
    var lw = DD.Pixel.textW('Pasiva: ', 1);
    DD.Pixel.text('Pasiva: ', x + 10, py + 1, { color: DD.C.textFaint });
    para(passiveText(limb.passive), x + 10 + lw, py, w - 20 - lw, DD.C.gold, 1);

    /* the limb's cards, drawn as the faces the player will actually hold: the
     * combat view owns that renderer, so a graft preview matches the hand. */
    var cardsY = y + h - 138;
    line('CARTAS', x + 10, cardsY - 12, DD.C.textFaint, 1);
    var cards = limb.cards || [];
    var face = (V.combat && V.combat.drawCard) ? V.combat : null;
    for (i = 0; i < cards.length; i++) {
      var bx = x + 10 + i * 52;
      if (bx + 48 > x + w - 8) break;
      /* The fallback is a compact face of our own, never a blank back. */
      if (face) face.drawCard({ id: cards[i], socket: null }, bx, cardsY, { scale: 1 });
      else miniCard(cards[i], cardById(cards[i]), bx, cardsY);
    }

    para(limb.flavor || '', x + 10, y + h - 66, w - 20, DD.C.textFaint, 1, 10);
  };

  function tierColor(tier) {
    if (tier >= 3) return DD.C.gold;
    if (tier === 2) return DD.C.integrity;
    return DD.C.textDim;
  }

  /* -------------------------------------------------------------- graft */
  var GRAFT = { cardX: 12, cardY: 46, cardW: 268, cardH: 286, dx: 300, dy: 56 };

  function hud() { return (V.hud && V.hud.drawBody) ? V.hud : null; }

  /* DD.View.hud draws the panel at (x, y) but its socketRect() takes the
   * content origin inside that panel, so the padding has to be mirrored. */
  function diagramOrigin(box, sc) {
    if (!box || box.w === undefined) return null;
    return { x: box.x + Math.round(4 * sc), y: box.y + Math.round(8 * sc) + 8 };
  }

  function socketRects(origin, sc) {
    var h = hud();
    if (!h || !h.socketRect || !origin) return null;
    var out = {}, i, s, r;
    for (i = 0; i < DD.SOCKETS.length; i++) {
      s = DD.SOCKETS[i];
      r = h.socketRect(s, origin.x, origin.y, sc);
      if (!r || !r.w) return null;
      out[s] = r;
    }
    return out;
  }

  /* Prefer the box drawBody reports; fall back to the sockets themselves. */
  function diagramBounds(box, rects) {
    if (box && box.w !== undefined) return box;
    if (rects) {
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (var i = 0; i < DD.SOCKETS.length; i++) {
        var r = rects[DD.SOCKETS[i]];
        x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
        x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    return { x: GRAFT.dx, y: GRAFT.dy, w: 300, h: 160 };
  }

  function legalSockets(limb) {
    if (DD.Body && DD.Body.socketsFor) return DD.Body.socketsFor(limb.slot);
    if (limb.slot === 'arm') return ['armL', 'armR'];
    if (limb.slot === 'leg') return ['legL', 'legR'];
    return [limb.slot];
  }

  function socketUnderPointer(rects) {
    if (!rects || !DD.Input || !DD.Input.pointer) return null;
    var p = DD.Input.pointer;
    for (var i = 0; i < DD.SOCKETS.length; i++) {
      var s = DD.SOCKETS[i], r = rects[s];
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return s;
    }
    return null;
  }

  U.cursorSocket = null;   // the socket the graft cursor sits on, for the scene

  U.graft = function () {
    frame();
    U.bg();
    var st = DD.Run && DD.Run.state;
    var limb = limbById(DD.Explore && DD.Explore.pendingGraft);
    var h = hud();

    DD.Pixel.panel(GUT, 6, VW - GUT * 2, 34, { title: null });
    line('INJERTO', GUT + 12, 14, DD.C.text, 2);
    var clockX = VW - GUT - 40;
    if (h && h.drawClock) h.drawClock(clockX, 8, st ? st.timeLeft : 0, !!(st && st.timeLeft < 60));
    DD.Pixel.text('EL TIEMPO CORRE', clockX - 8, 42, { align: 'right', color: DD.C.bloodHi });

    if (!limb) {
      center('No hay ningún injerto preparado.', VW / 2, 170, DD.C.textDim, 1);
      center('El reloj no se detiene.', VW / 2, FOOT_Y, DD.C.gold, 1);
      return;
    }

    U.limbCard(limb, GRAFT.cardX, GRAFT.cardY, { w: GRAFT.cardW, h: GRAFT.cardH });

    var legal = legalSockets(limb);
    var bodyOpts = { selected: legal[0], scale: 1, showCards: true, interactive: true };
    var box = (h && h.drawBody) ? h.drawBody(GRAFT.dx, GRAFT.dy, bodyOpts) : null;
    var rects = socketRects(diagramOrigin(box, 1), 1);
    var cursor = socketUnderPointer(rects);
    if (!cursor && legal.length) cursor = legal[0];
    U.cursorSocket = cursor;
    if (box && h && h.drawBody && cursor !== legal[0]) {
      bodyOpts.selected = cursor;
      box = h.drawBody(GRAFT.dx, GRAFT.dy, bodyOpts);
    }
    var bounds = diagramBounds(box, rects);
    var i, s, r;

    /* light the sockets this limb can fill, sink the rest */
    if (rects) {
      for (i = 0; i < DD.SOCKETS.length; i++) {
        s = DD.SOCKETS[i];
        r = rects[s];
        var ok = legal.indexOf(s) >= 0;
        if (ok) DD.Pixel.frame(r.x - 1, r.y - 1, r.w + 2, r.h + 2, DD.C.gold);
        else DD.Pixel.dim(r.x, r.y, r.w, r.h, 0.45, DD.C.void);
      }
    }

    /* what the cursor socket loses against what it gains */
    var cy = Math.min(bounds.y + bounds.h + 6, VH - 90);
    var cw = Math.max(300, bounds.w + 8);
    var cx = Math.min(bounds.x, VW - GUT - cw);
    DD.Pixel.panel(cx, cy, cw, 66, { alpha: 0.95 });
    var colW = Math.round((cw - 24) / 2);
    line('PIERDES', cx + 10, cy + 8, DD.C.bloodHi, 1);
    line('GANAS', cx + 10 + colW + 12, cy + 8, DD.C.bile, 1);

    var out = (st && st.body && DD.Body && cursor) ? DD.Body.limbOf(st.body, cursor) : null;
    var outCards = out ? (out.cards || []).length : 0;
    var left = out ? out.name : (cursor ? 'Nada: el muñón.' : '-');
    var leftLines = DD.Pixel.wrap(left, colW - 6, 1);
    for (i = 0; i < leftLines.length && i < 2; i++) line(leftLines[i], cx + 10, cy + 22 + i * 10, DD.C.textDim, 1);
    if (out) {
      line(outCards + ' cartas -' + passiveText(out.passive), cx + 10, cy + 44, DD.C.textFaint, 1);
    }

    var gLines = DD.Pixel.wrap(limb.name, colW - 6, 1);
    for (i = 0; i < gLines.length && i < 2; i++) {
      line(gLines[i], cx + 10 + colW + 12, cy + 22 + i * 10, DD.C.text, 1);
    }
    line((limb.cards || []).length + ' cartas -' + passiveText(limb.passive),
      cx + 10 + colW + 12, cy + 44, DD.C.textFaint, 1);

    center('El reloj no se detiene.', VW / 2, FOOT_Y, DD.C.gold, 1);
  };

  /* -------------------------------------------------------------- codex */
  var TABS = [
    { id: 'limbs', label: 'Planos' },
    { id: 'enemies', label: 'Bestias' },
    { id: 'help', label: 'Ayuda' }
  ];

  U.codex = function (tab, scroll) {
    frame();
    U.bg();
    tab = tab || 'limbs';
    scroll = Math.max(0, scroll || 0);
    var i;

    DD.Pixel.panel(HEAD.x, HEAD.y, HEAD.w, HEAD.h, {});
    line('CÓDICE ANATÓMICO', HEAD.x + 10, HEAD.y + 6, DD.C.text, 2);
    var count = codexCount(tab === 'enemies' ? 'enemies' : 'limbs');
    var total = codexTotal(tab === 'enemies' ? 'enemies' : 'limbs');
    if (tab !== 'help') {
      var unit = tab === 'enemies' ? 'bestias' : 'planos';
      DD.Pixel.text(count + '/' + total + ' ' + unit, HEAD.x + HEAD.w - 10, HEAD.y + 20, {
        align: 'right', color: (count >= total && total > 0) ? DD.C.gold : DD.C.textDim
      });
    }

    for (i = 0; i < TABS.length; i++) {
      var tx = TAB.x + i * (TAB.w + 6);
      var on = TABS[i].id === tab;
      DD.Pixel.panel(tx, TAB.y, TAB.w, TAB.h, { alpha: on ? 1 : 0.82, accent: on ? DD.C.gold : DD.C.line });
      center(TABS[i].label, tx + TAB.w / 2, vmid(TAB.y, TAB.h, 1), on ? DD.C.text : DD.C.textFaint, 1);
      if (on) DD.Pixel.rect(tx + 6, TAB.y + TAB.h - 4, TAB.w - 12, 2, DD.C.gold);
      if (on && tab !== 'help') {
        DD.Pixel.bar(tx + 10, TAB.y + TAB.h + 2, TAB.w - 20, 3, total ? count / total : 0, { fg: DD.C.gold });
      }
    }

    DD.Pixel.clipPush(CONTENT.x, CONTENT.y, CONTENT.w, CONTENT.h);
    var contentH = 0;
    if (tab === 'enemies') contentH = codexEnemies(scroll);
    else if (tab === 'help') contentH = codexHelp(scroll);
    else contentH = codexLimbs(scroll);
    DD.Pixel.clipPop();

    if (contentH > CONTENT.h) {
      var frac = DD.clamp(scroll / contentH, 0, 1);
      var bh = Math.max(12, Math.round(CONTENT.h * CONTENT.h / contentH));
      DD.Pixel.rect(VW - GUT + 4, CONTENT.y, SCROLLBAR.w, CONTENT.h, DD.C.panelLo);
      DD.Pixel.rect(VW - GUT + 4, CONTENT.y + Math.round((CONTENT.h - bh) * frac), SCROLLBAR.w, bh, DD.C.lineHi);
    }
    center('Flechas para mover -RETROCESO para volver', VW / 2, FOOT_Y, DD.C.textFaint, 1);
  };

  function codexLimbs(scroll) {
    var list = (DD.Data && DD.Data.limbs) || [];
    if (!list.length) { center('Catálogo no disponible.', VW / 2, 150, DD.C.textFaint, 1); return 0; }
    var cols = 2, pitch = LIMB_H + 8, i, row, col;
    var cw = Math.floor((CONTENT.w - 8) / cols);
    for (i = 0; i < list.length; i++) {
      row = Math.floor(i / cols);
      col = i % cols;
      var x = CONTENT.x + col * (cw + 8);
      var y = CONTENT.y + row * pitch - scroll;
      if (y > CONTENT.y + CONTENT.h || y + LIMB_H < CONTENT.y) continue;
      if (knownLimb(list[i].id)) U.limbCard(list[i], x, y, { w: cw, h: LIMB_H });
      else limbSilhouette(list[i], x, y, cw, LIMB_H);
    }
    return Math.ceil(list.length / cols) * pitch;
  }

  function limbSilhouette(limb, x, y, w, h) {
    DD.Pixel.panel(x, y, w, h, { fill: '#06050b', border: '#241c30', accent: '#241c30' });
    var key = limbAvatarKey(limb);
    if (DD.Pixel.hasSprite(key)) {
      DD.Pixel.sprite(key, x + w / 2, y + 84, { anchor: 'bottom', scale: 3 });
      DD.Pixel.dim(x + w / 2 - 28, y + 30, 56, 56, 0.93, '#000000');
    }
    line('???', x + 10, y + 100, DD.C.textFaint, 2);
    line(SLOT_ES[limb.slot] || limb.slot || '?', x + 10, y + 124, DD.C.lineHi, 1);
    /* the break is deliberate: greedy wrapping strands "cuerpo." on its own line */
    para('Un plano que aún no has arrancado\nde ningún cuerpo.', x + 10, y + 140, w - 20, DD.C.textFaint, 1, 10);
    line('Nivel ' + (limb.tier || 1), x + 10, y + h - 22, DD.C.textFaint, 1);
  }

  function codexEnemies(scroll) {
    var list = (DD.Data && DD.Data.enemies) || [];
    if (!list.length) { center('Catálogo no disponible.', VW / 2, 150, DD.C.textFaint, 1); return 0; }
    var cols = 3, i, row, col, x, y;
    var cw = ENEMY_C.w, ch = ENEMY_C.h;
    for (i = 0; i < list.length; i++) {
      row = Math.floor(i / cols);
      col = i % cols;
      x = CONTENT.x + col * (cw + ENEMY_C.gap);
      y = CONTENT.y + row * ENEMY_C.pitch - scroll;
      if (y > CONTENT.y + CONTENT.h || y + ch < CONTENT.y) continue;
      enemyCell(list[i], x, y, cw, ch);
    }
    return Math.ceil(list.length / cols) * ENEMY_C.pitch;
  }

  function enemyCell(e, x, y, w, h) {
    var known = knownEnemy(e.id);
    DD.Pixel.panel(x, y, w, h, { fill: known ? DD.C.panel : '#06050b', accent: known ? tierColor(e.tier) : '#241c30' });
    if (DD.Pixel.hasSprite(e.sprite)) {
      DD.Pixel.sprite(e.sprite, x + w / 2, y + 22, { anchor: 'center' });
      if (!known) DD.Pixel.dim(x + w / 2 - 20, y + 4, 40, 40, 0.94, '#000000');
    }
    var t = y + 44;
    if (!known) {
      center('???', x + w / 2, t, DD.C.textFaint, 2);
      center('Nivel ' + (e.tier || 1), x + w / 2, t + 20, DD.C.lineHi, 1);
      para('Todavía no la has visto de cerca. Mejor así.', x + 10, t + 36, w - 20, DD.C.textFaint, 1, 10);
      return;
    }
    center(e.name, x + w / 2, t, DD.C.text, 2);
    center('Nivel ' + (e.tier || 1) + ' -' + (e.hp || 0) + ' PV' + (e.boss ? ' -JEFE' : ''),
      x + w / 2, t + 18, tierColor(e.tier), 1);
    var intents = e.intents || [];
    var iy = t + 32;
    for (var i = 0; i < intents.length && i < 2; i++) {
      var it = intents[i] || {};
      var v = it.v ? ' ' + it.v : (it.status ? ' ' + it.status : '');
      line('- ' + (it.text || it.type || '?') + v, x + 10, iy + i * 10, DD.C.textDim, 1);
    }
    var fy = t + 32 + Math.min(intents.length, 2) * 10 + 4;
    para(e.flavor || '', x + 10, fy, w - 20, DD.C.textFaint, 1, 9);
  }

  function codexHelp(scroll) {
    var x = CONTENT.x + 8, w = CONTENT.w - 40;
    var y = CONTENT.y - scroll;
    y = helpBlock(x, w, y, 'EL RELOJ', 'Tienes 360 segundos para todo: explorar, pelear y huir. ' +
      'El reloj corre también durante el combate, y no se detiene nunca. Cuando llega a cero, la torre ' +
      'te reclama.');
    y = helpBlock(x, w, y, 'EL CUERPO ES EL MAZO', 'No hay mazo aparte. Tus seis injertos son tus cartas: ' +
      'cabeza, torso, brazo izquierdo, brazo derecho, pierna izquierda y pierna derecha. Cada miembro aporta ' +
      'sus propias cartas, y una extremidad arrancada solo deja los golpes de muñón.');
    y = helpBlock(x, w, y, 'EL CALOR', 'Cada carta calienta el miembro que la presta. El calor no baja solo: ' +
      'se enfría despacio mientras caminas. Si un injerto llega a su tope, pierde integridad, te quema y ' +
      'puede desprenderse. Jugar fuerte tiene un precio anatómico.');
    y = helpBlock(x, w, y, 'INJERTOS', 'Al matar a un enemigo puede caer un miembro. Recógelo y accede a la ' +
      'mesa de injerto: sustituirás el miembro de un hueco por el nuevo, con sus cartas y su pasiva. ' +
      'Los planos que descubras quedan en este códice para siempre, aunque mueras.');
    y = helpBlock(x, w, y, 'ALTARES Y RESIDUO', 'El residuo alquímico se gasta en los altares para reparar ' +
      'integridad, enfriar el cuerpo o curarte. El aceite enfría, las vendas curan, y las esquirlas de reloj ' +
      'se guardan para la tienda.');
    y = helpBlock(x, w, y, 'LA TORRE SE REORDENA', 'Cada sesenta segundos el piso se vuelve a trazar a tu ' +
      'alrededor. La escalera y la salida siguen ahí, pero el camino no. Si la alarma suena, muévete.');
    y = helpBlock(x, w, y, 'ESCAPAR', 'Hay cuatro pisos. En los tres primeros, la escalera sube. En el ' +
      'último está la puerta de salida: llegar a ella con vida es la única victoria.');
    return y + scroll - CONTENT.y;
  }

  function helpBlock(x, w, y, title, body) {
    if (y >= CONTENT.y - 14 && y < CONTENT.y + CONTENT.h) line(title, x, y, DD.C.gold, 2);
    y += 18;
    var lines = DD.Pixel.wrap(body, w, 1);
    for (var i = 0; i < lines.length; i++) {
      if (y + i * 10 >= CONTENT.y - 8 && y + i * 10 < CONTENT.y + CONTENT.h) {
        DD.Pixel.text(lines[i], x, y + i * 10 + 1, { color: DD.C.textDim });
      }
    }
    return y + lines.length * 10 + 10;
  }

  /* --------------------------------------------------------------- shop */
  U.shop = function (selected, scroll) {
    frame();
    U.bg();
    scroll = Math.max(0, scroll || 0);
    selected = selected || 0;

    DD.Pixel.panel(HEAD.x, HEAD.y, HEAD.w, HEAD.h, {});
    line('TIENDA DE RELIQUIAS', HEAD.x + 10, HEAD.y + 6, DD.C.text, 2);
    var shards = DD.Progress && DD.Progress.shards ? DD.Progress.shards() : ((meta() && meta().shards) || 0);
    if (DD.Pixel.hasSprite('icon_shard')) DD.Pixel.sprite('icon_shard', HEAD.x + HEAD.w - 62, HEAD.y + 8);
    DD.Pixel.text(String(shards), HEAD.x + HEAD.w - 10, HEAD.y + 20, { align: 'right', color: DD.C.gold });

    var list = (DD.Data && DD.Data.cosmetics) || [];
    var owned = (meta() && meta().cosmetics && meta().cosmetics.unlocked) || ['default'];
    var equipped = (meta() && meta().cosmetics && meta().cosmetics.equipped) || 'default';

    DD.Pixel.clipPush(CONTENT.x, CONTENT.y, CONTENT.w, CONTENT.h);
    var i, x, y;
    for (i = 0; i < list.length; i++) {
      y = CONTENT.y + i * SHOP_ROW - scroll;
      if (y > CONTENT.y + CONTENT.h || y + SHOP_ROW < CONTENT.y) continue;
      x = CONTENT.x;
      var cos = list[i];
      var has = owned.indexOf(cos.id) >= 0;
      var isSel = i === selected;
      var canPay = shards >= (cos.cost || 0);

      DD.Pixel.panel(x, y, CONTENT.w, SHOP_ROW - 4, {
        fill: isSel ? DD.C.panelHi : DD.C.panel, accent: isSel ? DD.C.gold : DD.C.line
      });
      if (isSel && DD.Pixel.hasSprite('ui_selector')) DD.Pixel.sprite('ui_selector', x + 4, y + SHOP_ROW / 2 - 12);

      /* palette preview */
      var pal = cos.palette || ['#2b2130', '#6b5a7a', '#c9b8d8'];
      var px = x + 22, py = y + 6;
      DD.Pixel.rect(px, py, 64, 32, pal[0]);
      DD.Pixel.rect(px, py + 11, 64, 10, pal[1]);
      DD.Pixel.rect(px + 22, py + 6, 20, 20, pal[2]);
      DD.Pixel.frame(px, py, 64, 32, cos.tint || DD.C.lineHi);
      if (!has) DD.Pixel.dim(px, py, 64, 32, 0.6, DD.C.void);

      line(cos.name, x + 98, y + 6, has ? DD.C.text : DD.C.textDim, isSel ? 2 : 1);
      para(cos.desc || '', x + 98, y + (isSel ? 24 : 18), CONTENT.w - 260, DD.C.textFaint, 1, 10);

      var rx = x + CONTENT.w - 14;
      var stateTxt, stateCol;
      if (equipped === cos.id) { stateTxt = 'EQUIPADO'; stateCol = DD.C.bile; }
      else if (has) { stateTxt = 'DISPONIBLE'; stateCol = DD.C.integrity; }
      else if (canPay) { stateTxt = 'DESBLOQUEAR'; stateCol = DD.C.gold; }
      else { stateTxt = 'BLOQUEADO'; stateCol = DD.C.textFaint; }
      DD.Pixel.text(stateTxt, rx, y + 14, { align: 'right', color: stateCol });
      if (has) DD.Pixel.text('-', rx, y + 30, { align: 'right', color: DD.C.textFaint });
      else {
        DD.Pixel.text(String(cos.cost || 0), rx, y + 30, { align: 'right', color: canPay ? DD.C.gold : DD.C.textFaint });
        if (DD.Pixel.hasSprite('icon_shard')) DD.Pixel.sprite('icon_shard', rx - DD.Pixel.textW(String(cos.cost || 0), 1) - 18, y + 23);
      }
    }
    DD.Pixel.clipPop();

    DD.Pixel.rect(CONTENT.x, FOOT_Y - 4, CONTENT.w, 1, DD.C.line);
    line('Prototipo: la tienda no cobra dinero real y las esquirlas solo salen de la torre.',
      CONTENT.x, FOOT_Y, DD.C.textFaint, 1);
  };

  /* ---------------------------------------------------------------- end */
  U.end = function (result) {
    frame();
    U.bg();
    var st = DD.Run && DD.Run.state;
    var res = RESULT[result] || RESULT.dead;
    DD.Pixel.dim(0, 0, VW, VH, 0.34, res.tint);
    vignette(res.tint, 0.9);

    center(res.title, VW / 2, 34, res.col, 3);
    center(res.sub, VW / 2, 66, DD.C.textDim, 1);
    DD.Pixel.rect(VW / 2 - 120, 82, 240, 1, res.col);

    var stats = (st && st.stats) || {};
    var m = meta() || {};
    var base = (V._codexBase && st && V._codexBase.key === st.runIndex) ? V._codexBase : null;
    var left = 104, right = 328, y0 = 104;
    var panelW = 208;

    DD.Pixel.panel(left, y0, panelW, 150, { title: 'LA HUÍDA', titleColor: res.col });
    var y = y0 + 18;
    y = stat('Bajas', String(stats.kills || 0), left + 12, y);
    y = stat('Injertos', String(stats.grafted || 0), left + 12, y);
    y = stat('Miembros perdidos', String(stats.lost || 0), left + 12, y);
    y = stat('Pisos superados', (stats.floors || 0) + ' / ' + ((st && st.floorCount) || DD.FLOOR_COUNT || 4), left + 12, y);
    y = stat('Tiempo restante', DD.clock ? DD.clock(st ? st.timeLeft : 0) : '0', left + 12, y);
    if (result === 'escaped') {
      y = stat('Mejor huida', m.bestTime ? DD.clock(m.bestTime) : '-', left + 12, y);
    } else {
      y = stat('Mejor huida', m.bestTime ? DD.clock(m.bestTime) : 'aún ninguna', left + 12, y);
    }

    DD.Pixel.panel(right, y0, panelW, 150, { title: 'RECOMPENSAS', titleColor: res.col });
    var ry = y0 + 18;
    if (DD.Pixel.hasSprite('icon_shard')) DD.Pixel.sprite('icon_shard', right + 12, ry - 6);
    ry = stat('Esquirlas', String((st && st.shards) || 0), right + 30, ry);
    var newLimbs = base ? Math.max(0, codexCount('limbs') - base.limbs) : 0;
    var newEnemies = base ? Math.max(0, codexCount('enemies') - base.enemies) : 0;
    ry = stat('Planos nuevos', base ? '+' + newLimbs : '-', right + 12, ry);
    ry = stat('Bestias nuevas', base ? '+' + newEnemies : '-', right + 12, ry);
    ry = stat('Códice', codexCount('limbs') + '/' + codexTotal('limbs') + ' planos', right + 12, ry);
    ry = stat('Carreras', String(m.runs || 0), right + 12, ry);
    ry = stat('Huidas', String(m.escapes || 0), right + 12, ry);

    var tail = result === 'escaped'
      ? 'Los planos que has arrancado se quedan en el códice. La torre, también.'
      : 'Lo que has aprendido se queda en el códice. El cuerpo, no.';
    center(tail, VW / 2, 268, DD.C.textFaint, 1);
    center('ENTER para volver al vestíbulo', VW / 2, FOOT_Y, res.col, 1);
  };

  /* -------------------------------------------------------------- pause */
  U.pause = function (items, index) {
    frame();
    DD.Pixel.dim(0, 0, VW, VH, 0.66, DD.C.void);
    DD.Pixel.panel(PANEL_PAUSE.x, PANEL_PAUSE.y, PANEL_PAUSE.w, PANEL_PAUSE.h, { title: 'PAUSA' });
    U.menu(items, index, {
      x: PANEL_PAUSE.x + 42, y: PANEL_PAUSE.y + 42, w: PANEL_PAUSE.w - 84,
      hint: 'ESC - Seguir jugando'
    });
  };
})();
