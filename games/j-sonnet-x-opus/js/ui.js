/* Deadlock Deck - DD.UI shared widgets and the menu scenes:
   title, table, graft, codex, cosmetics, settings, help, end, pause. */
(function () {
  'use strict';
  window.DD = window.DD || {};
  var DD = window.DD;

  // ---------------------------------------------------------------------------
  // 1. Helpers
  // ---------------------------------------------------------------------------
  var W = 384, H = 216;
  var DIRS = ['up', 'down', 'left', 'right'];
  var TYPES = ['head', 'torso', 'arm', 'leg'];
  var SHORT_SLOT = { head: 'Cabeza', torso: 'Torso', armL: 'Brazo I', armR: 'Brazo D', legL: 'Pierna I', legR: 'Pierna D' };

  function noop() {}
  function now() { return performance.now() / 1000; }
  function blink(hz) { return Math.floor(now() * hz) % 2 === 0; }
  function pal(c) { return DD.Art.PAL[c] || c; }
  function rect(ctx, x, y, w, h, c) {
    ctx.fillStyle = pal(c);
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function shade(ctx, x, y, w, h, a) {
    ctx.fillStyle = 'rgba(13,10,18,' + a + ')';
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function outline(ctx, x, y, w, h, c) {
    rect(ctx, x, y, w, 1, c); rect(ctx, x, y + h - 1, w, 1, c);
    rect(ctx, x, y, 1, h, c); rect(ctx, x + w - 1, y, 1, h, c);
  }
  function tx(ctx, s, x, y, c, scale, align, shadow) {
    DD.Art.text(ctx, String(s), Math.round(x), Math.round(y), c || 'bone', scale || 1, align || 'left',
      shadow === undefined ? 'ink' : shadow);
  }
  // Shortens a string to fit maxW pixels at scale 1, dropping whole words first (safety net only).
  function fit(s, maxW) {
    s = String(s);
    while (s.length > 1 && DD.Art.textWidth(s, 1) > maxW) {
      var sp = s.lastIndexOf(' ');
      s = sp > 0 ? s.slice(0, sp) : s.slice(0, -1);
    }
    return s;
  }
  // Wrapped text block (paragraphs split by \n); returns the height used.
  function para(ctx, str, x, y, maxW, c, maxLines, align) {
    var ls = [];
    String(str).split('\n').forEach(function (p, i) {
      if (i > 0) ls.push('');
      ls = ls.concat(DD.Art.wrap(p, maxW, 1));
    });
    ls = ls.slice(0, maxLines || 99);
    ls.forEach(function (l, i) { if (l) tx(ctx, l, x, y + i * 9, c, 1, align); });
    return ls.length * 9;
  }
  function tag(ctx, label, x, y, c) {           // small filled label, right edge at x
    var w = DD.Art.textWidth(label, 1) + 4;
    rect(ctx, x - w, y, w, 9, c);
    tx(ctx, label, x - w + 2, y + 1, 'ink', 1, 'left', null);
  }
  function sfx(n) { DD.Audio.sfx(n); }
  function bp(id) { return DD.Data.LIMBS[id]; }
  function rarityColor(b) { return DD.Data.RARITY[b.rarity].color; }
  function known(id) { return DD.Core.meta.blueprints.indexOf(id) >= 0; }
  function inside(r, x, y) { return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h; }
  function backPressed() { var I = DD.Core.input; return I.pressed('cancel') || I.pressed('menu'); }
  function slotsOfType(type) { return DD.Data.SLOTS.filter(function (s) { return DD.Data.SLOT_TYPE[s] === type; }); }
  function names(cards) { return cards.map(function (c) { return c.name; }).join(', '); }
  function heatColor(f) { return f < 0.5 ? 'ice' : f < 0.85 ? 'flame2' : 'blood2'; }
  function integrityColor(f) { return f > 0.6 ? 'verdi2' : f > 0.3 ? 'copper' : 'blood2'; }
  function essenceCorner(ctx, n) {
    var s = String(n);
    tx(ctx, s, 380, 4, 'acid', 1, 'right');
    DD.Art.icon(ctx, 'essence', 370 - DD.Art.textWidth(s, 1), 3, 1);
  }

  // ---------------------------------------------------------------------------
  // 2. Menu navigation (keyboard/gamepad directions, confirm, pointer hover/tap)
  // ---------------------------------------------------------------------------
  // Items are rects { x, y, w, h, act, disabled, sound }; st holds { sel, px, py }.
  function btn(label, x, y, w, h, act, disabled, sound) {
    return { kind: 'button', label: label, x: x, y: y, w: w, h: h, act: act, disabled: !!disabled, sound: sound };
  }
  // Index of the closest item in direction dir from item `from`, or -1.
  function nearest(items, from, dir) {
    var a = items[from], ax = a.x + a.w / 2, ay = a.y + a.h / 2, best = -1, bestScore = Infinity;
    items.forEach(function (b, i) {
      if (i === from) return;
      var dx = b.x + b.w / 2 - ax, dy = b.y + b.h / 2 - ay;
      var main = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
      var side = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
      if (main <= 0) return;
      var score = main + side * 2;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    return best;
  }
  // Moves st.sel and runs the activated item's act(). Returns the activated item or null.
  function navigate(st, items, dirs) {
    var I = DD.Core.input, p = DD.Core.pointer;
    if (!items.length) return null;
    st.sel = Math.max(0, Math.min(st.sel || 0, items.length - 1));
    (dirs || DIRS).forEach(function (d) {
      if (I.pressed(d) || I.repeat(d)) {
        var n = nearest(items, st.sel, d);
        if (n >= 0) { st.sel = n; sfx('click'); }
      }
    });
    var hit = -1;
    for (var i = 0; i < items.length; i++) if (inside(items[i], p.x, p.y)) hit = i;
    if (hit >= 0 && (p.x !== st.px || p.y !== st.py || p.pressed)) st.sel = hit;
    st.px = p.x; st.py = p.y;
    var go = p.pressed && hit >= 0 ? hit : I.pressed('confirm') ? st.sel : -1;
    if (go < 0) return null;
    var it = items[go];
    if (it.disabled || !it.act) { sfx('error'); return null; }
    sfx(it.sound || 'confirm');
    it.act();
    return it;
  }
  function drawButtons(ctx, st, items) {
    var p = DD.Core.pointer;
    items.forEach(function (it, i) {
      if (it.kind === 'button') {
        UI.drawButton(ctx, it.label, it.x, it.y, it.w, it.h,
          { selected: i === st.sel, disabled: it.disabled, pressed: p.down && inside(it, p.x, p.y) });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Shared widgets (DD.UI)
  // ---------------------------------------------------------------------------
  var UI = DD.UI = {
    drawPanel: function (ctx, x, y, w, h, title) {
      rect(ctx, x, y, w, h, 'ink');
      rect(ctx, x + 1, y + 1, w - 2, h - 2, 'brass');
      rect(ctx, x + 1, y + 1, w - 2, 1, 'brass2');
      rect(ctx, x + 1, y + 1, 1, h - 2, 'brass2');
      rect(ctx, x + 2, y + 2, w - 4, h - 4, 'ink');
      rect(ctx, x + 3, y + 3, w - 6, h - 6, 'stone');
      rect(ctx, x + 3, y + 3, w - 6, 1, 'stone2');
      [[1, 1], [w - 3, 1], [1, h - 3], [w - 3, h - 3]].forEach(function (c) { rect(ctx, x + c[0], y + c[1], 2, 2, 'bone'); });
      if (title) {
        rect(ctx, x + 3, y + 3, w - 6, 10, 'stone2');
        rect(ctx, x + 3, y + 13, w - 6, 1, 'brass');
        tx(ctx, fit(title, w - 10), x + w / 2, y + 5, 'brass2', 1, 'center');
      }
    },

    drawButton: function (ctx, label, x, y, w, h, state) {
      state = state || {};
      var sel = state.selected, dis = state.disabled, dy = state.pressed ? 1 : 0;
      rect(ctx, x, y, w, h, 'ink');
      rect(ctx, x + 1, y + 1, w - 2, h - 2, sel ? (dis ? 'mist' : 'brass2') : dis ? 'stone2' : 'brass');
      rect(ctx, x + 2, y + 2, w - 4, h - 4, dis ? 'night' : sel ? 'stone2' : 'stone');
      if (!dis) rect(ctx, x + 2, y + 2 + dy, w - 4, 1, sel ? 'mist' : 'stone2');
      if (sel) {
        rect(ctx, x + 3, y + Math.floor(h / 2) - 1, 2, 3, 'brass2');
        rect(ctx, x + w - 5, y + Math.floor(h / 2) - 1, 2, 3, 'brass2');
      }
      tx(ctx, fit(label, w - 12), x + w / 2, y + Math.floor((h - 7) / 2) + dy, dis ? 'mist' : sel ? 'bone' : 'parch', 1, 'center');
    },

    drawBar: function (ctx, x, y, w, h, frac, colorKey) {
      frac = Math.max(0, Math.min(1, frac || 0));
      rect(ctx, x, y, w, h, 'ink');
      rect(ctx, x + 1, y + 1, w - 2, h - 2, 'night');
      var fw = Math.round((w - 2) * frac);
      if (fw <= 0) return;
      rect(ctx, x + 1, y + 1, fw, h - 2, colorKey);
      if (h > 3) { ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(Math.round(x + 1), Math.round(y + 1), fw, 1); }
    },

    // Scales from ~56x64 (combat hand) to ~100x120 (menus).
    drawCard: function (ctx, card, x, y, w, h, opts) {
      opts = opts || {};
      if (typeof card === 'string') card = DD.Data.CARDS[card];
      if (!card) return;
      var A = DD.Art, big = w >= 90, cx = x + Math.floor(w / 2), on = blink(6);
      if (opts.selected) {
        y -= 3;
        ctx.fillStyle = 'rgba(224,184,74,0.35)';
        ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      }
      rect(ctx, x, y, w, h, 'ink');
      rect(ctx, x + 1, y + 1, w - 2, h - 2, opts.hot ? (on ? 'blood2' : 'flame') : opts.selected ? 'brass2' : 'brass');
      rect(ctx, x + 2, y + 2, w - 4, h - 4, 'stone');
      rect(ctx, x + 2, y + 2, w - 4, 1, 'stone2');
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 2, y + 2, w - 4, h - 4);
      ctx.clip();
      A.icon(ctx, 'bolt', x + 3, y + 3, 1);
      tx(ctx, card.cost, x + 12, y + 3, 'brass2');
      A.icon(ctx, 'flame', x + w - 11, y + (opts.hot && on ? 2 : 3), 1);
      tx(ctx, card.heat, x + w - 12, y + 3, card.heat === 0 ? 'ice' : opts.hot ? 'blood2' : 'flame', 1, 'right');
      var ny = y + 13;
      if (big) { A.icon(ctx, card.icon, cx - 8, y + 12, 2); ny = y + 31; } else A.icon(ctx, card.icon, cx - 4, y + 3, 1);
      var nameLines = A.wrap(card.name, w - 6, 1).slice(0, 2);
      nameLines.forEach(function (l, i) { tx(ctx, l, cx, ny + i * 8, 'bone', 1, 'center'); });
      var ty = ny + nameLines.length * 8 + 1, bottom = y + h - (opts.slot ? 12 : 3);
      rect(ctx, x + 4, ty, w - 8, 1, 'stone2');
      A.wrap(card.text || DD.Data.cardText(card), w - 6, 1).forEach(function (l, i) {
        var ly = ty + 3 + i * 8;
        if (ly + 7 <= bottom) tx(ctx, l, cx, ly, 'parch', 1, 'center');
      });
      if (opts.slot) {
        rect(ctx, x + 2, y + h - 10, w - 4, 8, 'night');
        tx(ctx, big ? DD.Data.SLOT_NAME[opts.slot] : SHORT_SLOT[opts.slot], cx, y + h - 9, 'parch', 1, 'center', null);
        if (opts.limbHeatMax) {
          var f = Math.min(1, (opts.limbHeat || 0) / opts.limbHeatMax);
          rect(ctx, x + 2, y + h - 11, Math.round((w - 4) * f), 1, heatColor(f));
        }
      }
      ctx.restore();
      if (opts.disabled) shade(ctx, x, y, w, h, 0.55);
    },

    drawLimbGauge: function (ctx, slot, limb, x, y, w, h) {
      h = h || 18;
      var A = DD.Art, b = limb && bp(limb.bp), bx = x + 18, bw = w - 20, bh = Math.max(2, Math.floor((h - 6) / 2));
      var iy = y + Math.floor((h - 16) / 2);
      rect(ctx, x, y, w, h, 'ink');
      rect(ctx, x + 1, y + 1, w - 2, h - 2, 'night');
      if (b) A.limbIcon(ctx, limb.bp, x + 1, iy, 1); else A.stumpIcon(ctx, DD.Data.SLOT_TYPE[slot], x + 1, iy, 1);
      var fi = b ? limb.integrity / limb.maxIntegrity : 0, fh = b ? limb.heat / b.heatMax : 0;
      UI.drawBar(ctx, bx, y + 2, bw, bh, fi, integrityColor(fi));
      UI.drawBar(ctx, bx, y + h - 2 - bh, bw, bh, fh, heatColor(fh));
      if (b && limb.heat >= b.heatMax && blink(4)) rect(ctx, bx + bw - 3, y + h - 3 - bh, 3, bh + 2, 'bone');
    },

    drawHud: function (ctx, opts) {
      opts = opts || {};
      var C = DD.Core, A = DD.Art, run = C.run;
      if (!run) return;
      var p = run.player, on = function (k) { return opts[k] !== false; };
      if (on('hp')) {
        UI.drawBar(ctx, 4, 4, 100, 9, p.hp / p.maxHp, 'blood2');
        tx(ctx, Math.max(0, Math.ceil(p.hp)) + '/' + p.maxHp, 54, 5, 'bone', 1, 'center');
        if (p.block > 0) { A.icon(ctx, 'shield', 108, 4, 1); tx(ctx, p.block, 118, 5, 'ice'); }
      }
      if (on('clock')) {
        var s = C.fmtTime(run.timeLeft), low = run.timeLeft < 60;
        A.icon(ctx, 'hourglass', 192 - Math.ceil(A.textWidth(s, 2) / 2) - 11, 7, 1);
        tx(ctx, s, 192, 3, low ? (blink(2) ? 'blood2' : 'blood') : 'bone', 2, 'center');
      }
      if (on('essence')) essenceCorner(ctx, run.essence);
      if (on('floor')) tx(ctx, DD.Data.FLOOR_NAME[run.floor] || '', 380, 14, 'parch', 1, 'right');
      if (on('limbs')) {
        DD.Data.SLOTS.forEach(function (s, i) { UI.drawLimbGauge(ctx, s, p.limbs[s], 4 + i * 42, 194, 40, 18); });
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 4. Shared blocks
  // ---------------------------------------------------------------------------
  // List row: 16x16 icon via icon(x, y), the name wrapped to up to 2 lines, then an optional sub line.
  function drawRow(ctx, r, sel, icon, name, nameCol, sub, subCol) {
    rect(ctx, r.x, r.y, r.w, r.h, sel ? 'brass2' : 'ink');
    rect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, sel ? 'stone2' : 'night');
    icon(r.x + 3, r.y + Math.floor((r.h - 16) / 2));
    var ls = DD.Art.wrap(String(name), r.w - 26, 1).slice(0, 2), n = ls.length + (sub ? 1 : 0);
    var y = r.y + Math.floor((r.h - (n * 8 - 1)) / 2);
    ls.forEach(function (l, i) { tx(ctx, l, r.x + 22, y + i * 8, nameCol); });
    if (sub) tx(ctx, fit(sub, r.w - 26), r.x + 22, y + ls.length * 8, subCol);
    if (r.disabled) shade(ctx, r.x, r.y, r.w, r.h, 0.5);
  }
  // Blueprint info: name, rarity/origin, stats, passive, then its cards (cw x ch) at y + 56.
  function drawBpInfo(ctx, id, x, y, w, cw, ch, limb) {
    var D = DD.Data, b = bp(id), cards = D.cardsOfLimb(id), pas = D.describePassive(b);
    tx(ctx, fit(b.name, w), x, y, rarityColor(b));
    tx(ctx, fit(D.RARITY[b.rarity].name + (b.origin ? ' - ' + b.origin : ''), w), x, y + 9, 'mist');
    tx(ctx, 'Integridad ' + (limb ? limb.integrity + '/' + limb.maxIntegrity : b.integrity), x, y + 19, 'verdi2');
    tx(ctx, 'Calor máx. ' + b.heatMax + '  Enfr. ' + b.cool, x, y + 28, 'flame');
    para(ctx, pas || 'Sin pasiva', x, y + 37, w, pas ? 'brass2' : 'mist', 2);
    var total = cards.length * cw + (cards.length - 1) * 4, cx = x + Math.floor((w - total) / 2);
    cards.forEach(function (c, i) { UI.drawCard(ctx, c, cx + i * (cw + 4), y + 56, cw, ch); });
  }
  function limbIconFn(ctx, slot, limb) {
    return function (x, y) {
      if (limb) DD.Art.limbIcon(ctx, limb.bp, x, y, 1); else DD.Art.stumpIcon(ctx, DD.Data.SLOT_TYPE[slot], x, y, 1);
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Scene: title
  // ---------------------------------------------------------------------------
  var Title = {
    st: null,
    enter: function () {
      var C = DD.Core;
      DD.Audio.music('title');
      Title.st = { sel: 0 };
      Title.st.items = [
        ['Jugar', function () { C.newRun(); C.go('table'); }],
        ['Planos', function () { C.push('codex'); }],
        ['Gabinete', function () { C.push('cosmetics'); }],
        ['Ajustes', function () { C.push('settings'); }],
        ['Cómo jugar', function () { C.push('help'); }]
      ].map(function (m, i) { return btn(m[0], 142, 98 + i * 19, 100, 16, m[1]); });
    },
    resume: function () { DD.Audio.music('title'); },
    exit: noop,
    update: function () { navigate(Title.st, Title.st.items); },
    draw: function (ctx) {
      var A = DD.Art, m = DD.Core.meta, t = now(), total = Object.keys(DD.Data.LIMBS).length;
      A.drawBackground(ctx, 'title', t);
      A.vignette(ctx);
      A.drawLogo(ctx, 192, 16, t);
      drawButtons(ctx, Title.st, Title.st.items);
      A.icon(ctx, 'scroll', 6, 183, 1);
      tx(ctx, 'Planos ' + m.blueprints.length + '/' + total, 17, 184, 'parch');
      A.icon(ctx, 'essence', 6, 193, 1);
      tx(ctx, 'Esencia ' + m.essence, 17, 194, 'acid');
      tx(ctx, 'Ciclos ' + (m.runs || 0) + '  Escapes ' + (m.escapes || 0), 378, 194, 'parch', 1, 'right');
      tx(ctx, 'v0.1 - preproducción', 6, 206, 'mist');
      tx(ctx, 'Enter: elegir  X: volver  Esc: pausa', 378, 206, 'mist', 1, 'right');
    }
  };

  // ---------------------------------------------------------------------------
  // 6. Scene: table (dissection table + print flow)
  // ---------------------------------------------------------------------------
  function printable(slot) {
    var type = DD.Data.SLOT_TYPE[slot];
    return DD.Core.meta.blueprints
      .filter(function (id) { return bp(id) && bp(id).type === type; })
      .sort(function (a, b) { return bp(a).rarity - bp(b).rarity; });
  }
  function openPrint(st, slot) { st.slot = slot; st.back = st.sel; st.mode = 'print'; st.sel = 0; }
  function closePrint(st) { st.mode = 'limbs'; st.sel = st.back; }
  function tableItems(st) {
    var C = DD.Core, items = [];
    if (st.mode === 'print') {
      var cur = C.run.player.limbs[st.slot];
      printable(st.slot).forEach(function (id, i) {
        var cost = DD.Data.CONST.PRINT_COST[bp(id).rarity];
        var same = !!cur && cur.bp === id && cur.integrity >= cur.maxIntegrity;
        items.push({ kind: 'bp', id: id, cost: cost, same: same, x: 22, y: 42 + i * 14, w: 156, h: 13, sound: 'graft',
          disabled: same || cost > C.meta.essence,
          act: function () {
            if (C.printLimb(st.slot, id)) { C.toast('Impreso: ' + bp(id).name, 'verdi2'); closePrint(st); } else sfx('error');
          } });
      });
      items.push(btn('Volver', 150, 196, 84, 16, function () { closePrint(st); }, false, 'back'));
      return items;
    }
    DD.Data.SLOTS.forEach(function (s, i) {
      items.push({ kind: 'limb', slot: s, x: 8, y: 40 + i * 25, w: 96, h: 23, act: function () { openPrint(st, s); } });
    });
    items.push(btn('Imprimir', 4, 196, 104, 16, function () { openPrint(st, st.slot); }));
    items.push(btn('Despertar', 276, 196, 104, 16, function () { C.startRun(); }));
    return items;
  }
  function drawPrint(ctx, st) {
    var C = DD.Core, A = DD.Art, f = st.items[st.sel];
    shade(ctx, 0, 0, W, H, 0.6);
    UI.drawPanel(ctx, 16, 26, 352, 166, 'Imprimir: ' + DD.Data.SLOT_NAME[st.slot]);
    var any = false;
    st.items.forEach(function (it, i) {
      if (it.kind !== 'bp') return;
      var sel = i === st.sel, b = bp(it.id), label = String(it.cost);
      any = true;
      rect(ctx, it.x, it.y, it.w, it.h, sel ? 'brass2' : 'ink');
      rect(ctx, it.x + 1, it.y + 1, it.w - 2, it.h - 2, sel ? 'stone2' : 'night');
      tx(ctx, fit(b.name, it.w - 27), it.x + 3, it.y + 3, it.disabled ? 'mist' : rarityColor(b));
      if (it.same) A.icon(ctx, 'check', it.x + it.w - 11, it.y + 2, 1);
      else {
        tx(ctx, label, it.x + it.w - 3, it.y + 3, it.cost > C.meta.essence ? 'blood2' : 'acid', 1, 'right');
        A.icon(ctx, 'essence', it.x + it.w - 13 - A.textWidth(label, 1), it.y + 2, 1);
      }
    });
    if (!any) para(ctx, 'Aún no descubres planos de este tipo. Cosecha extremidades en la torre.', 24, 46, 150, 'mist');
    if (f && f.id) drawBpInfo(ctx, f.id, 186, 44, 176, 56, 72, null);
    drawButtons(ctx, st, st.items);
  }
  var Table = {
    st: null,
    enter: function () {
      DD.Audio.music('table');
      Table.st = { sel: 0, slot: 'head', mode: 'limbs', back: 0 };
      Table.st.items = tableItems(Table.st);
    },
    exit: noop,
    update: function () {
      var st = Table.st;
      st.items = tableItems(st);
      if (st.mode === 'print' && backPressed()) { sfx('back'); closePrint(st); }
      else navigate(st, st.items);
      st.items = tableItems(st);
      var f = st.items[st.sel];
      if (st.mode === 'limbs' && f && f.slot) st.slot = f.slot;
    },
    draw: function (ctx) {
      var A = DD.Art, C = DD.Core, D = DD.Data, st = Table.st, t = now(), limbs = C.run.player.limbs, stats = C.getStats();
      A.drawBackground(ctx, 'table', t);
      tx(ctx, 'Mesa de disección', 4, 4, 'brass2');
      essenceCorner(ctx, C.meta.essence);
      tx(ctx, 'Tu espíritu despierta en una nueva mesa de disección...', 192, 14, 'parch', 1, 'center');
      UI.drawPanel(ctx, 4, 24, 104, 168, 'Extremidades');
      D.SLOTS.forEach(function (s, i) {
        var l = limbs[s], b = l && bp(l.bp);
        drawRow(ctx, { x: 8, y: 40 + i * 25, w: 96, h: 23 }, s === st.slot, limbIconFn(ctx, s, l),
          b ? b.name : 'Muñón', b ? rarityColor(b) : 'blood2');
      });
      A.drawBody(ctx, 147, 180, limbs, { scale: 2, t: t, highlight: st.slot });
      var anchors = A.bodySlotAnchors(147, 180, 2);
      D.SLOTS.forEach(function (s) {
        var r = anchors[s];
        if (s === st.slot) { if (blink(3)) outline(ctx, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 'brass2'); }
        else rect(ctx, r.x + r.w / 2 - 1, r.y + r.h / 2 - 1, 2, 2, 'brass');
      });
      UI.drawPanel(ctx, 188, 24, 192, 168, D.SLOT_NAME[st.slot]);
      var cur = limbs[st.slot];
      if (cur) drawBpInfo(ctx, cur.bp, 194, 40, 180, 56, 88, cur);
      else {
        tx(ctx, 'Muñón', 194, 40, 'blood2');
        para(ctx, 'Ranura vacía. Imprime un plano o injerta una extremidad del mismo tipo.', 194, 50, 180, 'parch', 3);
        UI.drawCard(ctx, D.STUMP_CARD[D.SLOT_TYPE[st.slot]], 256, 96, 56, 88);
      }
      tx(ctx, 'Vida ' + stats.maxHp + '  Energía ' + stats.energy + '  Robo ' + stats.draw, 192, 201, 'bone', 1, 'center');
      if (st.mode === 'print') drawPrint(ctx, st);
      else drawButtons(ctx, st, st.items);
    }
  };

  // ---------------------------------------------------------------------------
  // 7. Scene: graft (harvest after a won combat; the clock keeps running)
  // ---------------------------------------------------------------------------
  function graftItems(st) {
    if (st.mode === 'slot') {
      var o = st.offers[st.offer], items = [];
      slotsOfType(bp(o.limb.bp).type).forEach(function (s, i) {
        var it = btn(DD.Data.SLOT_NAME[s], 4 + i * 95, 196, 91, 16, function () { doGraft(st, s); }, false, 'graft');
        it.slot = s;
        items.push(it);
      });
      items.push(btn('Descartar', 194, 196, 91, 16, function () { o.done = 'Descartado'; toOffers(st); }, false, 'harvest'));
      items.push(btn('Volver', 289, 196, 91, 16, function () { toOffers(st); }, false, 'back'));
      return items;
    }
    items = st.offers.map(function (o, i) {
      return { kind: 'offer', index: i, x: 8, y: 40 + i * 30, w: 118, h: 28, disabled: !!o.done,
        act: function () { st.mode = 'slot'; st.offer = i; st.slot = slotsOfType(bp(o.limb.bp).type)[0]; st.sel = 0; } };
    });
    items.push(btn('Terminar', 276, 196, 104, 16, function () { finishGraft(st); }, false, 'back'));
    return items;
  }
  function doGraft(st, slot) {
    var o = st.offers[st.offer];
    DD.Core.graft(slot, o.limb);
    DD.Core.toast('Injertado: ' + bp(o.limb.bp).name, 'verdi2');
    o.done = 'Injertado';
    toOffers(st);
  }
  function toOffers(st) {
    var next = st.offers.findIndex(function (o) { return !o.done; });
    if (next < 0) { finishGraft(st); return; }
    st.mode = 'offers';
    st.sel = next;
  }
  function finishGraft(st) {
    if (st.finished) return;
    st.finished = true;
    DD.Core.pop();
    if (st.onDone) st.onDone();
  }
  function drawCompare(ctx, st) {
    var D = DD.Data, o = st.offers[st.offer], cur = DD.Core.run.player.limbs[st.slot];
    var nb = bp(o.limb.bp), ob = cur && bp(cur.bp), x0 = 140, x1 = 204, x2 = 292, y = 40;
    UI.drawPanel(ctx, 134, 24, 246, 168, 'Injertar en: ' + D.SLOT_NAME[st.slot]);
    tx(ctx, 'Actual', x1, y, 'mist');
    tx(ctx, 'Nuevo', x2, y, 'mist');
    para(ctx, ob ? ob.name : 'Muñón', x1, y + 10, 84, ob ? rarityColor(ob) : 'blood2', 2);
    para(ctx, nb.name, x2, y + 10, 84, rarityColor(nb), 2);
    y += 8;
    [
      ['Integridad', cur ? cur.integrity : 0, o.limb.integrity, cur ? '/' + cur.maxIntegrity : '', '/' + o.limb.maxIntegrity],
      ['Calor máx.', ob ? ob.heatMax : 0, nb.heatMax, '', ''],
      ['Enfr.', ob ? ob.cool : 0, nb.cool, '', '']
    ].forEach(function (r, i) {
      var ry = y + 22 + i * 10;
      tx(ctx, r[0], x0, ry, 'parch');
      tx(ctx, ob ? r[1] + r[3] : '-', x1, ry, 'bone');
      tx(ctx, r[2] + r[4], x2, ry, r[2] > r[1] ? 'verdi2' : r[2] < r[1] ? 'blood2' : 'bone');
    });
    tx(ctx, 'Pasiva', x0, y + 52, 'parch');
    para(ctx, (ob && D.describePassive(ob)) || '-', x1, y + 52, 84, 'brass2', 2);
    para(ctx, D.describePassive(nb) || '-', x2, y + 52, 84, 'brass2', 2);
    var oldCards = ob ? D.cardsOfLimb(ob.id) : [D.CARDS[D.STUMP_CARD[nb.type]]];
    var ly = y + 74;
    ly += para(ctx, 'Pierdes: ' + names(oldCards), x0, ly, 234, 'blood2', 3) + 4;
    para(ctx, 'Ganas: ' + names(D.cardsOfLimb(nb.id)), x0, ly, 234, 'verdi2', 3);
  }
  var Graft = {
    ticksClock: true,
    st: null,
    enter: function (params) {
      params = params || {};
      var st = Graft.st = { sel: 0, mode: 'offers', offer: 0, slot: null, onDone: params.onDone, finished: false };
      st.offers = (params.offers || []).map(function (l) { return { limb: l, isNew: DD.Core.discover(l.bp), done: '' }; });
      st.items = graftItems(st);
    },
    exit: noop,
    update: function () {
      var st = Graft.st;
      if (!st.offers.length) { finishGraft(st); return; }
      st.items = graftItems(st);
      if (st.mode === 'slot' && DD.Core.input.pressed('cancel')) { sfx('back'); toOffers(st); }
      else navigate(st, st.items);
      st.items = graftItems(st);
      var f = st.items[st.sel];
      if (f && f.slot) st.slot = f.slot;
      if (f && f.kind === 'offer') st.offer = f.index;
    },
    draw: function (ctx) {
      var D = DD.Data, st = Graft.st, o = st.offers[st.offer];
      rect(ctx, 0, 0, W, H, 'night');
      tx(ctx, 'Cosecha', 6, 4, 'brass2', 2);
      UI.drawHud(ctx, { clock: true, hp: false, limbs: false, essence: false, floor: false });
      tx(ctx, st.mode === 'slot' ? 'Elige dónde injertar' : 'Elige rápido', 378, 8, 'parch', 1, 'right');
      UI.drawPanel(ctx, 4, 24, 126, 168, 'Botín');
      st.offers.forEach(function (of, i) {
        var b = bp(of.limb.bp);
        drawRow(ctx, { x: 8, y: 40 + i * 30, w: 118, h: 28, disabled: !!of.done }, i === st.offer,
          limbIconFn(ctx, null, of.limb), b.name, rarityColor(b),
          of.done || (of.isNew ? 'Nuevo - ' : '') + D.TYPE_NAME[b.type], of.done ? 'mist' : of.isNew ? 'acid' : 'parch');
      });
      if (!o) return;
      if (st.mode === 'slot') drawCompare(ctx, st);
      else {
        UI.drawPanel(ctx, 134, 24, 246, 168, D.TYPE_NAME[bp(o.limb.bp).type]);
        drawBpInfo(ctx, o.limb.bp, 140, 40, 234, 76, 84, o.limb);
        if (o.isNew) tag(ctx, 'Nuevo', 374, 39, 'acid');
      }
      drawButtons(ctx, st, st.items);
    }
  };

  // ---------------------------------------------------------------------------
  // 8. Scene: codex
  // ---------------------------------------------------------------------------
  function dropSources(id) {
    var E = DD.Data.ENEMIES;
    return Object.keys(E).filter(function (k) {
      return (E[k].drops || []).some(function (d) { return d.limb === id; });
    }).map(function (k) { return E[k].name; }).join(', ') || 'Solo cuerpo base';
  }
  function codexItems(st) {
    var items = TYPES.map(function (t, i) {
      var it = btn(DD.Data.TYPE_NAME[t], 4 + i * 47, 22, 45, 16, noop, false, 'click');
      it.type = t;
      return it;
    });
    DD.Data.limbsOfType(st.type).forEach(function (b, i) {
      items.push({ kind: 'cell', id: b.id, x: 4 + (i % 5) * 37, y: 42 + Math.floor(i / 5) * 37, w: 35, h: 35, act: noop, sound: 'click' });
    });
    items.push(btn('Volver', 4, 196, 80, 16, function () { DD.Core.pop(); }, false, 'back'));
    return items;
  }
  var Codex = {
    st: null,
    enter: function () {
      Codex.st = { sel: 4, type: 'head', cell: DD.Data.limbsOfType('head')[0].id };
      Codex.st.items = codexItems(Codex.st);
    },
    exit: noop,
    update: function () {
      var st = Codex.st;
      if (backPressed()) { sfx('back'); DD.Core.pop(); return; }
      st.items = codexItems(st);
      navigate(st, st.items);
      var f = st.items[st.sel];
      if (f && f.type && f.type !== st.type) { st.type = f.type; st.cell = DD.Data.limbsOfType(f.type)[0].id; }
      if (f && f.id) st.cell = f.id;
      st.items = codexItems(st);
    },
    draw: function (ctx) {
      var A = DD.Art, D = DD.Data, st = Codex.st, t = now();
      var total = Object.keys(D.LIMBS).length, found = Object.keys(D.LIMBS).filter(known).length;
      A.drawBackground(ctx, 'codex', t);
      tx(ctx, 'Planos anatómicos', 4, 4, 'brass2', 2);
      tx(ctx, found + '/' + total, 380, 8, 'bone', 1, 'right');
      drawButtons(ctx, st, st.items);
      rect(ctx, 4 + TYPES.indexOf(st.type) * 47 + 2, 38, 41, 2, 'brass2');
      st.items.forEach(function (it, i) {
        if (it.kind !== 'cell') return;
        var b = bp(it.id), k = known(it.id);
        rect(ctx, it.x, it.y, it.w, it.h, i === st.sel ? 'brass2' : it.id === st.cell ? 'brass' : k ? rarityColor(b) : 'stone2');
        rect(ctx, it.x + 1, it.y + 1, it.w - 2, it.h - 2, 'night');
        if (k) A.limbIcon(ctx, it.id, it.x + 2, it.y + 2, 2);
        else { A.silhouetteIcon(ctx, b.type, it.x + 2, it.y + 2, 2); tx(ctx, '???', it.x + 18, it.y + 26, 'mist', 1, 'center'); }
      });
      var cur = bp(st.cell), ck = known(st.cell);
      para(ctx, ck ? cur.desc || '' : 'Derrota a quien lo porta o encuentra un plano para descubrirlo.', 4, 120, 186, 'parch', 7);
      UI.drawPanel(ctx, 196, 22, 184, 170, 'Plano');
      if (ck) drawBpInfo(ctx, st.cell, 202, 38, 172, 56, 76, null);
      else {
        A.silhouetteIcon(ctx, cur.type, 256, 46, 4);
        tx(ctx, '???', 288, 118, 'mist', 2, 'center');
        tx(ctx, 'Plano no descubierto', 288, 138, 'parch', 1, 'center');
      }
      para(ctx, 'Lo suelta: ' + dropSources(st.cell), 202, 173, 172, 'mist', 2);
    }
  };

  // ---------------------------------------------------------------------------
  // 9. Scene: cosmetics
  // ---------------------------------------------------------------------------
  function skinOwned(id) { return DD.Data.SKINS[id].cost === 0 || !!DD.Core.meta.skins[id]; }
  function skinAct(id) {
    var C = DD.Core, name = DD.Data.SKINS[id].name;
    if (skinOwned(id)) { C.equipSkin(id); C.toast('Equipada: ' + name, 'verdi2'); }
    else if (C.buySkin(id)) { C.equipSkin(id); sfx('essence'); C.toast('Comprada: ' + name, 'acid'); }
    else { sfx('error'); C.toast('Esencia insuficiente', 'blood2'); }
  }
  function cosmeticsItems() {
    var items = Object.keys(DD.Data.SKINS).map(function (id, i) {
      return { kind: 'skin', id: id, x: 4, y: 42 + i * 26, w: 170, h: 24, act: function () { skinAct(id); } };
    });
    items.push(btn('Premium', 78, 22, 70, 16, null, true));
    items.push(btn('Volver', 4, 196, 80, 16, function () { DD.Core.pop(); }, false, 'back'));
    return items;
  }
  var Cosmetics = {
    st: null,
    enter: function () {
      Cosmetics.st = { sel: 0, body: DD.Core.rollBaseBody(), items: cosmeticsItems() };
      Cosmetics.st.preview = DD.Core.meta.skin;
    },
    exit: noop,
    update: function () {
      var st = Cosmetics.st;
      if (backPressed()) { sfx('back'); DD.Core.pop(); return; }
      navigate(st, st.items);
      var f = st.items[st.sel];
      st.preview = f && f.id ? f.id : DD.Core.meta.skin;
    },
    draw: function (ctx) {
      var A = DD.Art, C = DD.Core, S = DD.Data.SKINS, st = Cosmetics.st, t = now();
      A.drawBackground(ctx, 'codex', t);
      tx(ctx, 'Gabinete de curiosidades', 4, 4, 'brass2', 2);
      essenceCorner(ctx, C.meta.essence);
      UI.drawButton(ctx, 'Pieles', 4, 22, 70, 16, {});
      rect(ctx, 6, 38, 66, 2, 'brass2');
      drawButtons(ctx, st, st.items);
      A.icon(ctx, 'lock', 84, 26, 1);
      st.items.forEach(function (it, i) {
        if (it.kind !== 'skin') return;
        var s = S[it.id], own = skinOwned(it.id), eq = C.meta.skin === it.id;
        var status = eq ? 'Equipada' : own ? 'Tuya: toca para equipar' : 'Cuesta ' + s.cost + ' de esencia';
        drawRow(ctx, it, i === st.sel, function (x, y) {
          rect(ctx, x, y, 8, 8, s.colors.skin); rect(ctx, x + 8, y, 8, 8, s.colors.skinDark);
          rect(ctx, x, y + 8, 8, 8, s.colors.stitch); rect(ctx, x + 8, y + 8, 8, 8, s.colors.eye);
        }, s.name, 'bone', status, eq ? 'verdi2' : own ? 'parch' : s.cost > C.meta.essence ? 'blood2' : 'acid');
      });
      para(ctx, 'Microtransacciones no disponibles en esta versión.', 4, 174, 172, 'mist', 2);
      UI.drawPanel(ctx, 180, 22, 200, 170, S[st.preview] ? S[st.preview].name : '');
      A.drawBody(ctx, 280, 184, st.body, { scale: 2, t: t, skin: st.preview });
    }
  };

  // ---------------------------------------------------------------------------
  // 10. Scene: settings (overlay; pushed from title or pause)
  // ---------------------------------------------------------------------------
  var VOLUME_ROWS = [['master', 'General'], ['music', 'Música'], ['sfx', 'Efectos']];
  function saveVolumes(v) {
    DD.Audio.setVolumes(v);
    DD.Core.meta.volumes = { master: v.master, music: v.music, sfx: v.sfx };
    DD.Core.saveMeta();
  }
  function toggleMute() {
    var m = !DD.Audio.isMuted();
    DD.Audio.mute(m);
    DD.Core.meta.muted = m;
    DD.Core.saveMeta();
  }
  function settingsItems() {
    var items = VOLUME_ROWS.map(function (r, i) {
      return { kind: 'slider', key: r[0], label: r[1], x: 104, y: 62 + i * 22, w: 176, h: 18, act: noop, sound: 'click' };
    });
    items.push({ kind: 'toggle', label: 'Silencio', x: 104, y: 128, w: 176, h: 18, act: toggleMute });
    items.push(btn('Volver', 152, 158, 80, 18, function () { DD.Core.pop(); }, false, 'back'));
    return items;
  }
  function sliderBar(it) { return { x: it.x + 60, y: it.y, w: 86, h: it.h }; }
  var Settings = {
    st: null,
    enter: function () { Settings.st = { sel: 0, items: settingsItems() }; },
    exit: noop,
    update: function () {
      var st = Settings.st, I = DD.Core.input, p = DD.Core.pointer;
      if (backPressed()) { sfx('back'); DD.Core.pop(); return; }
      var f = st.items[st.sel], v = DD.Audio.getVolumes(), step = 0;
      if (f.kind === 'slider') {
        if (I.pressed('left') || I.repeat('left')) step = -0.1;
        if (I.pressed('right') || I.repeat('right')) step = 0.1;
        if (step) { v[f.key] = Math.round(Math.max(0, Math.min(1, v[f.key] + step)) * 10) / 10; saveVolumes(v); sfx('click'); }
      } else if (f.kind === 'toggle' && (I.pressed('left') || I.pressed('right'))) { toggleMute(); sfx('click'); }
      st.items.forEach(function (it) {
        var bar = it.kind === 'slider' && sliderBar(it);
        if (bar && p.down && inside(bar, p.x, p.y)) {
          v[it.key] = Math.round(Math.max(0, Math.min(1, (p.x - bar.x) / bar.w)) * 20) / 20;
          saveVolumes(v);
        }
      });
      navigate(st, st.items, ['up', 'down']);
    },
    draw: function (ctx) {
      var st = Settings.st, v = DD.Audio.getVolumes();
      shade(ctx, 0, 0, W, H, 0.7);
      UI.drawPanel(ctx, 96, 44, 192, 140, 'Ajustes');
      st.items.forEach(function (it, i) {
        if (it.kind === 'button') return;
        if (i === st.sel) outline(ctx, it.x, it.y, it.w, it.h, 'brass2');
        tx(ctx, it.label, it.x + 4, it.y + 6, i === st.sel ? 'bone' : 'parch');
        if (it.kind === 'slider') {
          var bar = sliderBar(it);
          UI.drawBar(ctx, bar.x, it.y + 5, bar.w, 8, v[it.key], 'brass2');
          tx(ctx, Math.round(v[it.key] * 100), it.x + it.w - 4, it.y + 6, 'bone', 1, 'right');
        } else {
          var m = DD.Audio.isMuted();
          tx(ctx, m ? 'Sí' : 'No', it.x + it.w - 4, it.y + 6, m ? 'blood2' : 'verdi2', 1, 'right');
        }
      });
      drawButtons(ctx, st, st.items);
      tx(ctx, 'Izquierda / derecha: ajustar', 192, 190, 'mist', 1, 'center');
    }
  };

  // ---------------------------------------------------------------------------
  // 11. Scene: help
  // ---------------------------------------------------------------------------
  var HELP = [
    { title: 'Objetivo y reloj',
      text: 'Eres una abominación recién reanimada en una torre alquímica en llamas. Baja los 3 pisos, derrota al Relojero Mayor que custodia la salida y escapa.\n' +
        'El reloj de 6 minutos corre al explorar, combatir y cosechar, y solo se detiene en pausa. Los engranajes te dan tiempo extra.\n' +
        'Si mueres o se acaba el tiempo, despiertas en una nueva mesa de disección con otro cuerpo y otra torre. Conservas los planos descubiertos y la esencia.' },
    { title: 'Controles',
      text: 'Teclado: flechas o WASD para moverte, Enter, Espacio o Z para confirmar, X o Retroceso para cancelar, Esc o P para pausar, M silencia y F pone pantalla completa.\n' +
        'Control: cruceta o stick para moverte, A confirma, B cancela y Start pausa.\n' +
        'Táctil: usa la cruceta en pantalla, toca botones y cartas, y el botón de pausa.' },
    { title: 'Combate y cosecha',
      text: 'Tu mazo es tu cuerpo: cada extremidad aporta sus cartas. Tocar a un enemigo inicia un combate por turnos.\n' +
        'Cada turno recibes energía y robas cartas. El rayo indica el costo. El enemigo muestra su intención: úsala para decidir.\n' +
        'Al vencer cosechas sus extremidades. Injértalas en una ranura del mismo tipo para cambiar tus cartas, o imprime planos con esencia en la mesa.' },
    { title: 'Calor y desgaste',
      text: 'Cada carta suma su calor, la llama, a la extremidad de la que viene. Hasta el calor máximo es seguro. Cada punto de más desgasta su integridad.\n' +
        'Con integridad 0 la extremidad se rompe: pierdes sus cartas y te queda un muñón débil hasta que injertes otra.\n' +
        'Las extremidades se enfrían al final de cada turno. El hilo de sutura repara la integridad.' }
  ];
  function helpTurn(st, d) {
    var p = st.page + d;
    if (p >= HELP.length) { DD.Core.pop(); return; }
    st.page = Math.max(0, p);
  }
  var Help = {
    st: null,
    enter: function () {
      var st = Help.st = { sel: 1, page: 0 };
      st.items = [
        btn('Anterior', 24, 196, 90, 16, function () { helpTurn(st, -1); }, false, 'click'),
        btn('Siguiente', 270, 196, 90, 16, function () { helpTurn(st, 1); }, false, 'click')
      ];
    },
    exit: noop,
    update: function () {
      var st = Help.st, I = DD.Core.input;
      if (backPressed()) { sfx('back'); DD.Core.pop(); return; }
      if (I.pressed('left')) { sfx('click'); helpTurn(st, -1); }
      else if (I.pressed('right')) { sfx('click'); helpTurn(st, 1); }
      else navigate(st, st.items, []);
      st.items[0].disabled = st.page === 0;
      st.items[1].label = st.page === HELP.length - 1 ? 'Cerrar' : 'Siguiente';
    },
    draw: function (ctx) {
      var st = Help.st, pg = HELP[st.page];
      DD.Art.drawBackground(ctx, 'codex', now());
      UI.drawPanel(ctx, 24, 12, 336, 178, pg.title);
      para(ctx, pg.text, 32, 32, 320, 'bone', 16);
      tx(ctx, (st.page + 1) + '/' + HELP.length, 192, 201, 'parch', 1, 'center');
      drawButtons(ctx, st, st.items);
    }
  };

  // ---------------------------------------------------------------------------
  // 12. Scene: end
  // ---------------------------------------------------------------------------
  var END_STYLE = {
    death: { title: 'Has muerto', color: 'blood2', bg: 'end_death', music: 'death', sfx: 'death',
      line: 'Tu carne cede, pero tu espíritu persiste.' },
    timeout: { title: 'Se acabó el tiempo', color: 'flame', bg: 'end_timeout', music: 'death', sfx: 'timeout',
      line: 'El reloj anatómico marcó tu final.' },
    escape: { title: '¡Escapaste!', color: 'brass2', bg: 'end_win', music: 'win', sfx: 'win',
      line: 'Sales tambaleándote de la torre en llamas.' }
  };
  var End = {
    st: null,
    enter: function (summary) {
      var C = DD.Core, s = summary || {}, style = END_STYLE[s.reason] || END_STYLE.death, body = {};
      DD.Data.SLOTS.forEach(function (slot) {
        var id = s.limbs && s.limbs[slot];
        body[slot] = id ? C.makeLimb(id) : null;
      });
      End.st = { sel: 0, s: s, style: style, body: body, items: [
        btn('Reencarnar', 96, 196, 92, 16, function () { C.newRun(); C.go('table'); }),
        btn('Menú', 196, 196, 92, 16, function () { C.go('title'); }, false, 'back')
      ] };
      DD.Audio.music(style.music);
      sfx(style.sfx);
    },
    exit: noop,
    update: function () { navigate(End.st, End.st.items); },
    draw: function (ctx) {
      var A = DD.Art, C = DD.Core, D = DD.Data, st = End.st, s = st.s, t = now();
      A.drawBackground(ctx, st.style.bg, t);
      A.vignette(ctx);
      tx(ctx, st.style.title, 192, 8, st.style.color, 3, 'center');
      tx(ctx, st.style.line, 192, 34, 'parch', 1, 'center');
      UI.drawPanel(ctx, 12, 46, 232, 144, 'Resumen del ciclo');
      var rows = [
        ['Tiempo', C.fmtTime(s.timeUsed || 0)],
        ['Piso', ((s.floor || 0) + 1) + ' - ' + (D.FLOOR_NAME[s.floor || 0] || '')],
        ['Enemigos derrotados', s.kills || 0],
        ['Esencia ganada', s.essenceGained || 0]
      ];
      if (s.bonus) rows.push(['Bono de escape', '+' + s.bonus]);
      rows.push(['Esencia total', C.meta.essence]);
      rows.forEach(function (r, i) {
        tx(ctx, r[0], 20, 64 + i * 10, 'parch');
        tx(ctx, r[1], 236, 64 + i * 10, 'bone', 1, 'right');
      });
      var ny = 68 + rows.length * 10, found = (s.newBlueprints || []).map(function (id) { return bp(id) ? bp(id).name : id; });
      tx(ctx, 'Planos nuevos: ' + found.length, 20, ny, 'brass2');
      para(ctx, found.length ? found.join(', ') : 'Ninguno', 20, ny + 10, 216, found.length ? 'acid' : 'mist', 4);
      tx(ctx, 'Tu cuerpo final', 312, 60, 'parch', 1, 'center');
      A.drawBody(ctx, 312, 182, st.body, { scale: 2, t: t });
      drawButtons(ctx, st, st.items);
    }
  };

  // ---------------------------------------------------------------------------
  // 13. Scene: pause (overlay pushed by Core over a ticksClock scene)
  // ---------------------------------------------------------------------------
  var Pause = {
    st: null,
    enter: function () {
      var C = DD.Core;
      sfx('click');
      Pause.st = { sel: 0, age: 0, items: [
        btn('Continuar', 124, 66, 136, 18, function () { C.pop(); }, false, 'back'),
        btn('Ajustes', 124, 88, 136, 18, function () { C.push('settings'); }),
        btn('Abandonar ciclo', 124, 110, 136, 18, function () { C.endRun('death'); }, false, 'back')
      ] };
    },
    exit: noop,
    update: function () {
      var st = Pause.st;
      if (st.age++ > 0 && backPressed()) { sfx('back'); DD.Core.pop(); return; }
      navigate(st, st.items);
    },
    draw: function (ctx) {
      var run = DD.Core.run;
      shade(ctx, 0, 0, W, H, 0.65);
      UI.drawPanel(ctx, 112, 46, 160, 124, 'Pausa');
      drawButtons(ctx, Pause.st, Pause.st.items);
      if (run) tx(ctx, 'Quedan ' + DD.Core.fmtTime(run.timeLeft), 192, 138, 'bone', 1, 'center');
      tx(ctx, 'Esc: continuar', 192, 152, 'mist', 1, 'center');
    }
  };

  // ---------------------------------------------------------------------------
  // 14. Registration
  // ---------------------------------------------------------------------------
  var C = DD.Core;
  C.registerScene('title', Title);
  C.registerScene('table', Table);
  C.registerScene('graft', Graft);
  C.registerScene('codex', Codex);
  C.registerScene('cosmetics', Cosmetics);
  C.registerScene('settings', Settings);
  C.registerScene('help', Help);
  C.registerScene('end', End);
  C.registerScene('pause', Pause);
})();
