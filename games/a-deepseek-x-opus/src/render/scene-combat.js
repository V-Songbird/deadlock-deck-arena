/* Deadlock Deck: El Reloj Anatómico — the combat screen.
 * Background, enemies with their intents, the player's assembled body, the hand
 * of cards and the floating numbers, with the HUD drawn on top. */
(function () {
  'use strict';
  var DD = window.DD;
  if (!DD) return;

  var V = DD.View = DD.View || { hud: {}, explore: {}, combat: {}, ui: {} };
  var C = V.combat = V.combat || {};

  function P() { return DD.Pixel; }
  function state() { return DD.Run ? DD.Run.state : null; }
  function enc() { var st = state(); return st ? st.encounter : null; }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d === undefined ? 0 : d); }

  /* --------------------------------------------------------------- layout
   * Every coordinate of the fight lives here: the enemy row, the player and
   * the fan of cards. Nothing below re-derives a position by hand. */
  var L = {
    ground: 152,          // y of the enemies' feet
    nameY: 156,           // enemy name, up to two lines
    playerCx: 154,        // player avatar centre
    playerFeet: 252,
    playerScale: 2,       // the avatar is 24x32, so it reads at 48x64
    handY: 274,           // top edge of an un-lifted card
    cardW: 60,
    cardH: 80,
    cardScale: 1.25,      // the 48x64 frame art, drawn at 60x80
    cardSp: 60,           // px between two card left edges
    lift: 12,             // how far the hovered / selected card rises
    handSpan: 480,        // widest hand block: 8 cards at 60 px apart
    pileY: 300,
    pileX: 566,           // draw pile, clear of an eight-card hand (ends at 560)
    pileX2: 608,          // discard pile
    enemySpacing: 96,     // three enemies
    enemySpacing2: 124    // two enemies
  };

  /* Own timers: pulses, shake, the lagging HP ghosts and the death fades. */
  C.anim = C.anim || { t: 0, shake: 0, flash: 0, hover: -1, ghost: {}, dead: {} };
  var anim = C.anim;
  var driven = false;     // true once a scene calls update(dt)
  var lastNow = 0;
  var lastHp = null;

  function advance(dt) {
    if (!(dt > 0)) return;
    if (dt > 0.1) dt = 0.1;
    anim.t += dt;
    if (anim.shake > 0) anim.shake = Math.max(0, anim.shake - dt * 16);
    if (anim.flash > 0) anim.flash = Math.max(0, anim.flash - dt * 3);

    var st = state();
    if (st && lastHp !== null && num(st.hp) < lastHp) { anim.shake = 5; anim.flash = 1; }
    if (st) lastHp = num(st.hp);

    var e = enc();
    var list = (e && e.enemies) ? e.enemies : [];
    for (var i = 0; i < list.length; i++) {
      var en = list[i];
      if (!en) continue;
      var f = DD.clamp(num(en.hp) / Math.max(1, num(en.maxHp, 1)), 0, 1);
      var g = anim.ghost[i];
      if (g === undefined || g < f) g = f;              // healed or fresh: snap
      else if (g > f) g = Math.max(f, g - dt * 0.9);    // damage drains away
      anim.ghost[i] = g;
      if (en.dead) anim.dead[i] = (anim.dead[i] === undefined ? 0 : anim.dead[i]) + dt;
    }
  }

  function selfAdvance() {
    var now = DD.now();
    var dt = lastNow ? (now - lastNow) / 1000 : 0.016;
    lastNow = now;
    advance(dt);
  }

  C.update = function (dt) {
    driven = true;
    lastNow = DD.now();
    advance(num(dt, 0.016));
    clickTarget();
  };

  /* --------------------------------------------------------------- bodies */
  function limbOf(b, socket) {
    if (!b) return null;
    if (DD.Body && DD.Body.limbOf) return DD.Body.limbOf(b, socket);
    var id = b.sockets ? b.sockets[socket] : null;
    return (id && DD.Data && DD.Data.limbById) ? (DD.Data.limbById[id] || null) : null;
  }

  /* The avatar assembly, same parts and offsets as the explore view. */
  var PARTS = [
    { s: 'armL', part: 'arm', ox: 0, oy: 10, w: 8, h: 12, flip: true },
    { s: 'armR', part: 'arm', ox: 16, oy: 10, w: 8, h: 12, flip: false },
    { s: 'legL', part: 'leg', ox: 4, oy: 24, w: 8, h: 8, flip: true },
    { s: 'legR', part: 'leg', ox: 12, oy: 24, w: 8, h: 8, flip: false },
    { s: 'torso', part: 'torso', ox: 4, oy: 8, w: 16, h: 16, flip: false },
    { s: 'head', part: 'head', ox: 4, oy: 0, w: 16, h: 16, flip: false }
  ];

  function drawAvatar(x, y, dir, scale) {
    var st = state();
    var b = st ? st.body : null;
    dir = (dir === 'up' || dir === 'side') ? dir : 'down';
    for (var i = 0; i < PARTS.length; i++) {
      var pt = PARTS[i];
      var limb = limbOf(b, pt.s);
      var px = Math.round(x + pt.ox * scale);
      var py = Math.round(y + pt.oy * scale);
      var key = null, pal = null;
      if (limb) {
        key = 'av_' + pt.part + '_' + (limb.form || 'gaunt') + '_' + dir;
        if (limb.palette && limb.palette.length >= 3) pal = limb.palette;
      } else if (pt.part === 'arm' || pt.part === 'leg') {
        key = 'av_stump_' + pt.part + '_' + dir;
      }
      if (key && P().hasSprite(key)) {
        var o = { scale: scale };
        if (pal) o.palette = pal;
        if (pt.flip) o.flip = true;
        P().sprite(key, px, py, o);
      } else if (limb) {
        P().rect(px, py, Math.round(pt.w * scale), Math.round(pt.h * scale),
          (pal && pal[1]) || DD.C.line);
      }
    }
  }

  /* ---------------------------------------------------------------- clock */
  var ST_ICON = {
    bleed: 'icon_hp', weak: 'icon_sword', vulnerable: 'icon_skull',
    frail: 'icon_shield', poison: 'icon_residue', stun: 'icon_clock'
  };
  var ST_ORDER = ['bleed', 'weak', 'vulnerable', 'frail', 'poison', 'stun'];
  var ST_COLOR = {
    bleed: '#e0344a', weak: '#8fa2b8', vulnerable: '#c86ad8',
    frail: '#4a9fd8', poison: '#7fc23a', stun: '#e8b23a'
  };

  function drawStatuses(status, x, y, maxDx) {
    if (!status) return;
    var dx = 0;
    for (var i = 0; i < ST_ORDER.length; i++) {
      var k = ST_ORDER[i];
      var v = status[k];
      if (!v || typeof v !== 'number' || v <= 0) continue;
      if (dx > 0 && dx > maxDx - 24) break;
      P().sprite(ST_ICON[k] || 'icon_skull', Math.round(x + dx), y);
      P().text(String(v), Math.round(x + dx + 17), y + 4, { color: ST_COLOR[k] || DD.C.text });
      dx += 30;
    }
  }

  /* -------------------------------------------------------------- enemies */
  function enemyCx(i, n) {
    if (n <= 1) return 320;
    var sp = n >= 3 ? L.enemySpacing : L.enemySpacing2;
    return Math.round(320 + (i - (n - 1) / 2) * sp);
  }

  function enemyBox(e, i, n) {
    var key = (e && e.sprite) ? e.sprite : ('enemy_' + ((e && e.id) || 'crawler'));
    var sz = P().spriteSize ? P().spriteSize(key, 1) : { w: 32, h: 32 };
    var w = sz.w || 32, h = sz.h || 32;
    var cx = enemyCx(i, n);
    return { cx: cx, x: cx - w / 2, y: L.ground - h, w: w, h: h, key: key };
  }

  function enemyCount() {
    var e = enc();
    return (e && e.enemies) ? e.enemies.length : 0;
  }

  C.enemyRect = function (i) {
    var e = enc();
    var list = (e && e.enemies) ? e.enemies : [];
    if (!list[i]) return { x: 0, y: 0, w: 0, h: 0 };
    var b = enemyBox(list[i], i, list.length);
    return { x: Math.round(b.x - 4), y: Math.round(b.y - 4), w: Math.round(b.w + 8), h: Math.round(b.h + 8) };
  };

  function targetIndex() {
    if (!DD.Combat) return -1;
    return num(DD.Combat.target, -1);
  }

  function clickTarget() {
    if (!DD.Combat || !DD.Combat.selectTarget || !DD.Input || !DD.Input.pointer) return;
    var pt = DD.Input.pointer;
    if (!pt.justDown) return;
    var list = (enc() && enc().enemies) || [];
    for (var i = 0; i < list.length; i++) {
      if (!list[i] || list[i].dead) continue;
      var r = C.enemyRect(i);
      if (r.w > 0 && pt.x >= r.x && pt.x < r.x + r.w && pt.y >= r.y && pt.y < r.y + r.h) {
        DD.Combat.selectTarget(i);
        return;
      }
    }
  }

  function shadow(cx, y, w, alpha) {
    if (alpha <= 0.02) return;
    P().dim(cx - w / 2, y - 3, w, 5, 0.3 * alpha, '#000000');
    P().dim(cx - w / 2 + 3, y - 4, w - 6, 7, 0.18 * alpha, '#000000');
  }

  var INTENT_ICON = {
    attack: 'icon_sword', block: 'icon_shield', heal: 'icon_bandage',
    buff: 'icon_dna', debuff: 'icon_skull'
  };
  var INTENT_COLOR = {
    attack: '#e0344a', block: '#4a9fd8', heal: '#7fc23a',
    buff: '#e8b23a', debuff: '#a06ad8'
  };

  /* One telegraph, sized to its own text and never wider than the enemy's
   * column: the value and its icon are the part the player plans with, so they
   * are fixed and only the wrapped text gives way. */
  function drawIntent(e, b, t, colW) {
    var it = e.intent;
    if (!it || !it.type) return;
    var maxW = Math.min(colW - 6, 150);
    var txtW = maxW - 26;                            // icon gutter + right padding
    var lines = DD.Pixel.wrap(it.text || '', txtW, 1);
    if (lines.length > 2) { lines.length = 2; lines[1] = ellipsize(lines[1] + '..', txtW, 1); }
    var tw = 0;
    for (var i = 0; i < lines.length; i++) tw = Math.max(tw, DD.Pixel.textW(lines[i], 1));
    var w = Math.max(56, Math.min(maxW, 26 + tw));
    var h = 28;
    var x = Math.round(b.cx - w / 2);
    var y = Math.round(b.y - h - 4);
    var col = INTENT_COLOR[it.type] || DD.C.textDim;
    var pulse = 0.5 + 0.5 * Math.sin(t * 4);

    P().panel(x, y, w, h, {
      fill: DD.C.panel, border: DD.mix(DD.C.line, col, 0.6),
      accent: col, alpha: 0.94
    });
    P().sprite(INTENT_ICON[it.type] || 'icon_sword', x + 3, y + 2);
    if (typeof it.v === 'number' && it.v > 0) {
      P().text(String(it.v), x + 11, y + 18, { align: 'center', color: DD.mix(col, '#ffffff', pulse * 0.3) });
    }
    for (var k = 0; k < lines.length; k++) {
      P().text(lines[k], x + 21, y + 4 + k * 8, { color: DD.C.textDim, alpha: 0.95 });
    }
  }

  /* The width one enemy may claim: its own column, whatever the row holds. */
  function columnW(n) {
    if (n >= 3) return L.enemySpacing;
    if (n === 2) return L.enemySpacing2;
    return 240;
  }

  function drawEnemies(e, t) {
    var list = e.enemies || [];
    var n = list.length;
    var sh = DD.Pixel.shake(anim.t, anim.shake);
    for (var i = 0; i < n; i++) {
      var en = list[i];
      if (!en) continue;
      var b = enemyBox(en, i, n);
      var deadT = anim.dead[i];
      var fade = en.dead ? DD.clamp(num(deadT) / 0.7, 0, 1) : 0;
      var alpha = 1 - fade;

      shadow(b.cx, L.ground + Math.round(fade * 6), b.w + 6, alpha);
      P().sprite(b.key, Math.round(b.x + sh.x), Math.round(b.y + sh.y + fade * 8), { alpha: alpha });
      if (en.dead) continue;

      var selected = (targetIndex() === i);
      if (selected) {
        var gl = DD.mix(DD.C.gold, '#ffffff', 0.2 + 0.3 * Math.sin(t * 5));
        P().frame(Math.round(b.x) - 2, Math.round(b.y) - 2, b.w + 4, b.h + 4, gl);
        P().sprite('ui_selector', b.cx, L.ground + 6, { anchor: 'center', scale: 2 });
      }

      /* name, hit points and block under the feet */
      var name = en.name || ((DD.Data && DD.Data.enemyById && DD.Data.enemyById[en.id]) ? DD.Data.enemyById[en.id].name : en.id) || '';
      var nlines = DD.Pixel.wrap(String(name), 92, 1);
      for (var k = 0; k < nlines.length && k < 2; k++) {
        P().text(nlines[k], b.cx, L.nameY + k * 8, {
          align: 'center', color: selected ? DD.C.text : DD.C.textDim
        });
      }

      var frac = DD.clamp(num(en.hp) / Math.max(1, num(en.maxHp, 1)), 0, 1);
      P().bar(b.cx - 30, L.ground + 24, 60, 7, frac, {
        fg: DD.C.hp, bg: '#2e0d14',
        ghost: num(anim.ghost[i], frac), ghostColor: '#8c1a28'
      });
      P().text(num(en.hp) + '/' + num(en.maxHp, num(en.hp)), b.cx + 34, L.ground + 23, { color: DD.C.textFaint });

      var blk = num(en.block);
      if (blk > 0) {
        P().sprite('icon_shield', b.cx - 30, L.ground + 33);
        P().text(String(blk), b.cx - 12, L.ground + 38, { color: DD.C.integrity });
      }
      drawStatuses(en.status, b.cx + 2, L.ground + 33, 56);

      drawIntent(en, b, t, columnW(n));
    }
  }

  /* --------------------------------------------------------------- player */
  function drawPlayer(e, t) {
    var st = state();
    var body = st ? st.body : null;
    var pl = e.player || {};
    var sh = DD.Pixel.shake(anim.t, anim.shake);
    var lunge = num(pl.lunge);
    var bx = L.playerCx - 12 * L.playerScale + Math.round(lunge * 8) + sh.x;
    var by = L.playerFeet - 32 * L.playerScale + sh.y;

    shadow(L.playerCx, L.playerFeet + 2, 24 * L.playerScale + 4, 1);
    drawAvatar(bx, by, 'side', L.playerScale);

    if (num(pl.shake) > 0) P().dim(bx, by, 24 * L.playerScale, 32 * L.playerScale, 0.25, DD.C.blood);

    var block = num(e.block, num(st ? st.block : 0));
    var x = 118;
    if (block > 0) {
      P().sprite('icon_shield', x, 138);
      P().text(String(block), x + 18, 142, { color: DD.C.integrity });
      x += 44;
    }
    drawStatuses(pl.status, x, 138, 96);
  }

  /* ------------------------------------------------------------------ fx */
  var FX_COLOR = { damage: '#e0344a', block: '#4a9fd8', heat: '#c2672a', heal: '#7fc23a' };

  function fxPos(e, f) {
    if (typeof f.x === 'number' && isFinite(f.x) && f.x >= 0 && f.x <= 640 &&
        typeof f.y === 'number' && isFinite(f.y) && f.y >= 0 && f.y <= 360) {
      return { x: f.x, y: f.y };
    }
    var list = e.enemies || [];
    var i = num(f.target, -1);
    if (i >= 0 && list[i]) {
      var b = enemyBox(list[i], i, list.length);
      return { x: b.cx, y: b.y + 8 };
    }
    return { x: L.playerCx, y: L.playerFeet - 60 };
  }

  function drawFx(e) {
    var fx = e.fx;
    if (!fx || !fx.length) return;
    for (var i = 0; i < fx.length; i++) {
      var f = fx[i];
      if (!f || !f.kind) continue;
      var v = num(f.v);
      if (!v && f.kind !== 'damage') continue;
      var p = DD.clamp(num(f.t), 0, 1);
      var sign = (f.kind === 'damage') ? '-' : '+';
      var pos = fxPos(e, f);
      var sc = 1 + 0.6 * Math.exp(-p * 7);            // pop with a scale overshoot
      P().text(sign + Math.abs(v), pos.x, pos.y - p * 26, {
        scale: sc, align: 'center',
        color: FX_COLOR[f.kind] || DD.C.text,
        alpha: 1 - p * p
      });
    }
  }

  /* ----------------------------------------------------------------- hand */
  function handLayout(n) {
    var out = [];
    if (!(n > 0)) return out;
    var sp = L.cardSp;
    if (n > 1) {
      var maxSp = (L.handSpan - L.cardW) / (n - 1);
      if (sp > maxSp) sp = maxSp;
    }
    var total = L.cardW + sp * (n - 1);
    var x0 = Math.round((640 - total) / 2);
    for (var i = 0; i < n; i++) {
      var arc = n > 1 ? Math.round(4 * Math.sin(Math.PI * (i + 0.5) / n)) : 0;
      out.push({ x: Math.round(x0 + i * sp), y: L.handY - arc, w: L.cardW, h: L.cardH });
    }
    return out;
  }

  function handLen() {
    var e = enc();
    return (e && e.hand) ? e.hand.length : 0;
  }

  C.handRect = function (i) {
    var slots = handLayout(handLen());
    var r = slots[i];
    return r ? { x: r.x, y: r.y, w: r.w, h: r.h } : { x: 0, y: 0, w: 0, h: 0 };
  };

  function cardDef(card) {
    if (!card || !DD.Data || !DD.Data.cardById) return null;
    return DD.Data.cardById[card.id] || null;
  }

  function pickHand() {
    if (!DD.Input || !DD.Input.pointer) return -1;
    var pt = DD.Input.pointer;
    if (typeof pt.x !== 'number' || typeof pt.y !== 'number') return -1;
    var slots = handLayout(handLen());
    for (var i = slots.length - 1; i >= 0; i--) {   // topmost card first
      var r = slots[i];
      if (pt.x >= r.x && pt.x < r.x + r.w && pt.y >= r.y && pt.y < r.y + r.h) return i;
    }
    return -1;
  }

  function ellipsize(str, maxW, sc) {
    str = String(str == null ? '' : str);
    if (DD.Pixel.textW(str, sc) <= maxW) return str;
    var s = str;
    while (s.length > 1 && DD.Pixel.textW(s + '..', sc) > maxW) s = s.substring(0, s.length - 1);
    return s + '..';
  }

  /* The card face carries a compact summary of card.effects; the full Spanish
   * card.desc is what the tooltip is for. One token per effect verb, kept short
   * enough for a card width and joined with a separator when two fit. */
  function effToken(e) {
    if (!e || !e.k) return '';
    var v = num(e.v);
    switch (e.k) {
      case 'damage': return v + (e.all ? DD.t(' a todos') : DD.t(' daño'));
      case 'block': return v + DD.t(' bloq');
      case 'draw': return '+' + v + DD.t(' cartas');
      case 'energy': return '+' + v + DD.t(' energ.');
      case 'heal': return '+' + v + DD.t(' vida');
      case 'heat': return v + DD.t(' calor');
      case 'cool': return '-' + v + DD.t(' calor');
      case 'integrity': return '+' + v + DD.t(' integ.');
      case 'bleed': return v + DD.t(' sangr.');
      case 'weak': return v + DD.t(' débil');
      case 'vulnerable': return v + DD.t(' vuln.');
      case 'frail': return v + DD.t(' frágil');
      case 'poison': return v + DD.t(' veneno');
      case 'stun': return v + DD.t(' aturde');
      case 'selfDamage': return '-' + v + DD.t(' vida');
      case 'lifesteal': return '+' + v + DD.t(' robo');
      case 'residue': return '+' + v + DD.t(' resid.');
      case 'discardRandom': return DD.t('desc. ') + v;
      case 'exhaustSelf': return DD.t('agota');
      case 'gainBlockPerHeat': return DD.t('bloq/calor');
      case 'damagePerHeat': return DD.t('daño/calor');
      case 'damagePerMissingLimb': return DD.t('daño/muñón');
      case 'scavenge': return DD.t('botín');
    }
    return '';
  }

  function effectLines(def, maxW) {
    var fx = (def && def.effects) || [];
    var toks = [], i, t;
    for (i = 0; i < fx.length && toks.length < 4; i++) {
      t = effToken(fx[i]);
      if (t) toks.push(ellipsize(t, maxW, 1));
    }
    var lines = [];
    for (i = 0; i < toks.length; i++) {
      if (!lines.length) { lines.push(toks[i]); continue; }
      var joined = lines[lines.length - 1] + ' · ' + toks[i];
      if (DD.Pixel.textW(joined, 1) <= maxW) lines[lines.length - 1] = joined;
      else if (lines.length < 2) lines.push(toks[i]);
      else break;
    }
    return lines;
  }

  /* One card face. opts: {selected, playable, scale} */
  C.drawCard = function (card, x, y, opts) {
    if (!DD.Pixel) return;
    opts = opts || {};
    var k = opts.scale || 1;                        // relative zoom
    var x0 = Math.round(x), y0 = Math.round(y);
    var w = Math.round(L.cardW * k), h = Math.round(L.cardH * k);
    var u = function (v) { return Math.round(v * k); };
    var id = card ? card.id : null;
    var def = cardDef(card);
    var isStump = typeof id === 'string' && id.indexOf('stump_') === 0;

    var frame = isStump ? 'card_frame_stump' : ('card_frame_' + ((def && def.type) || 'skill'));
    if (!P().hasSprite(frame)) frame = 'card_frame_skill';
    P().sprite(frame, x0, y0, { scale: L.cardScale * k });

    if (!def && !isStump) {
      P().text(ellipsize(id || '?', w - 8, 1), x0 + w / 2, y0 + u(30),
        { align: 'center', color: DD.C.textDim, alpha: 0.7 });
      return;
    }

    /* Everything on the face is clipped to the card's own rectangle. */
    P().clipPush(x0, y0, w, h);
    var innerW = w - 6;

    /* cost pip, top-left corner */
    var pip = u(12);
    P().rect(x0 + u(2), y0 + u(2), pip, pip, DD.C.panelLo);
    P().frame(x0 + u(2), y0 + u(2), pip, pip, DD.C.gold);
    P().text(String(num(def ? def.cost : 0)), x0 + u(8), y0 + u(4), {
      align: 'center', color: DD.C.energy
    });

    /* card art in the window */
    if (def && def.art) P().sprite(def.art, x0 + u((L.cardW - 16) / 2), y0 + u(14), { scale: k });

    /* heat it will add to its socket, top-right */
    var heat = num(def ? def.heat : 0);
    if (heat > 0) {
      P().text(String(heat), x0 + w - u(3), y0 + u(3), { align: 'right', color: DD.C.heat[1] });
      if (P().hasSprite('icon_heat')) {
        P().sprite('icon_heat', x0 + w - u(11), y0 + u(2), { scale: 0.5 * k });
      }
    }

    /* name, at most two lines, then the compact effect line */
    var nameLines = DD.Pixel.wrap(def ? def.name : (id || ''), innerW, 1);
    for (var i = 0; i < nameLines.length && i < 2; i++) {
      P().text(ellipsize(nameLines[i], innerW, 1), x0 + w / 2, y0 + u(32 + i * 8),
        { align: 'center', color: DD.C.text });
    }
    var fx = effectLines(def, innerW);
    for (var j = 0; j < fx.length && j < 2; j++) {
      P().text(fx[j], x0 + w / 2, y0 + u(50 + j * 8), { align: 'center', color: DD.C.textDim });
    }
    P().clipPop();

    if (opts.playable === false) P().dim(x0, y0, w, h, 0.55, DD.C.void);
    if (opts.selected) P().frame(x0, y0, w, h, DD.C.gold);
  };

  /* The full Spanish description, in a panel above the hand. */
  var TT_W = 236;
  function drawTooltip(def, slot, liftTop) {
    if (!def || !def.desc) return;
    var pad = 6;
    var inner = TT_W - pad * 2;
    var lines = DD.Pixel.wrap(def.desc, inner, 1);
    var h = 13 + pad + lines.length * 8 + pad;
    var x = DD.clamp(Math.round(slot.x + slot.w / 2 - TT_W / 2), 4, 640 - TT_W - 4);
    var y = Math.max(4, Math.round(liftTop) - h - 4);
    P().panel(x, y, TT_W, h, { title: def.name, titleScale: 1, alpha: 0.97 });
    P().text(def.desc, x + pad, y + 13 + pad, { wrap: inner, color: DD.C.textDim });
  }

  function drawHand(e, t) {
    var hand = e.hand || [];
    var n = hand.length;
    if (!n) return;
    var slots = handLayout(n);
    var energy = num(e.energy);
    var selected = typeof e.selected === 'number' ? e.selected : -1;

    anim.hover = pickHand();

    var last = -1;
    for (var i = 0; i < n; i++) {
      var isUp = (i === anim.hover) || (i === selected);
      if (isUp) { last = i; continue; }
      var def = cardDef(hand[i]);
      var playable = !e.over && num(def ? def.cost : 0) <= energy;
      C.drawCard(hand[i], slots[i].x, slots[i].y, { playable: playable });
    }
    if (last >= 0) {
      var d = cardDef(hand[last]);
      var ok = !e.over && num(d ? d.cost : 0) <= energy;
      var r = slots[last];
      var sc = 1.2;
      var ly = r.y - L.lift - (L.cardH * (sc - 1));
      C.drawCard(hand[last],
        r.x - (L.cardW * (sc - 1)) / 2,
        ly,
        { playable: ok, scale: sc, selected: last === selected });
      drawTooltip(d, r, ly);
    }

    /* energy on the left */
    var maxE = Math.max(1, num(e.maxEnergy, 3));
    P().sprite('icon_energy', 22, 296);
    for (var k = 0; k < maxE && k < 8; k++) {
      var px = 40 + k * 12;
      P().rect(px, 299, 11, 10, k < energy ? DD.C.energy : DD.C.panelLo);
      P().frame(px, 299, 11, 10, k < energy ? DD.mix(DD.C.energy, '#ffffff', 0.3) : DD.C.line);
    }

    /* draw and discard piles on the right, outside the hand's block */
    pile(L.pileX, num((e.drawPile || []).length), DD.t('Robo'), 'left');
    pile(L.pileX2, num((e.discardPile || []).length), DD.t('Descarte'), 'right');
  }

  function pile(x, count, label, align) {
    for (var i = 2; i >= 0; i--) {
      P().sprite('card_back', x + i, L.pileY - i * 2, { scale: 0.5, alpha: i ? 0.55 : 1 });
    }
    P().text(String(count), x + 12, L.pileY - 14, { align: 'center', color: DD.C.text });
    P().text(label, align === 'right' ? x + 24 : x, L.pileY + 34, {
      align: align || 'left', color: DD.C.textFaint
    });
  }

  /* ---------------------------------------------------------------- frame */
  /* The chamber is pushed back so that nothing in it outshines an enemy: a flat
   * wash over the whole hall, a heavier one over the brazier's glow in the
   * middle of the nave, then the usual floor gradient. */
  function drawBackdrop() {
    if (P().hasSprite('bg_combat')) P().sprite('bg_combat', 0, 0);
    else P().rect(0, 0, 640, 360, DD.C.void);
    P().dim(0, 0, 640, 360, 0.42, '#0a0912');
    P().dim(140, 165, 360, 150, 0.09, '#0a0912');
    P().dim(210, 185, 220, 140, 0.09, '#0a0912');
    P().dim(270, 205, 100, 110, 0.09, '#0a0912');
    for (var i = 0; i < 8; i++) {
      P().dim(0, i * 45, 640, 45, 0.04 + i * 0.035, DD.C.void);
    }
  }

  C.draw = function () {
    if (!DD.Pixel) return;
    if (!driven) selfAdvance();
    var st = state();
    var e = enc();
    var t = anim.t;

    drawBackdrop();
    if (!e) {
      if (V.hud && V.hud.draw) V.hud.draw();
      return;
    }

    drawEnemies(e, t);
    drawPlayer(e, t);
    drawFx(e);
    drawHand(e, t);

    if (V.hud && V.hud.draw) V.hud.draw();
  };
})();
