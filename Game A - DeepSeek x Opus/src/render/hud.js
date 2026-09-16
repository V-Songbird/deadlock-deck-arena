/* Deadlock Deck: El Reloj Anatómico — HUD.
 * Loads first: creates DD.View and owns DD.View.hud.
 * The anatomical diagram, the clock, the vitals and the log ticker.
 * Every read of game state is defensive — a frame draws at any point of a run. */
(function () {
  'use strict';
  var DD = window.DD;
  if (!DD) return;

  var V = DD.View = DD.View || { hud: {}, explore: {}, combat: {}, ui: {} };
  var H = V.hud = V.hud || {};

  function P() { return DD.Pixel; }

  /* --------------------------------------------------------------- layout */
  /* The 3x3 grid of the anatomical diagram, in virtual pixels, plus the
   * vertical offset of each socket's name in the legend column. */
  var CELL = 24;                 // column width; limb boxes are 18 wide inside it
  var COLS = [0, 36, 72];
  var ROWS = [0, 36, 72];
  var DIAG_W = 96, DIAG_H = 98;  // content box of the diagram
  var BAR_BAND = 4;              // room above each box for the integrity bar
  var LEGEND_W = 88;
  var VITALS_Y = 124;            // first row under the body panel
  var TICKER_Y = 194;

  /* Frozen socket order, placed like a body: head on top, torso under it,
   * arms flanking the torso, legs at the bottom. The legend column repeats
   * this order, one row per socket, so no two labels can ever collide. */
  var CELLS = [
    { s: 'head',  c: 1, r: 0 },
    { s: 'torso', c: 1, r: 1 },
    { s: 'armL',  c: 0, r: 1 },
    { s: 'armR',  c: 2, r: 1 },
    { s: 'legL',  c: 0, r: 2 },
    { s: 'legR',  c: 2, r: 2 }
  ];

  var PART_OF = { head: 'head', torso: 'torso', armL: 'arm', armR: 'arm', legL: 'leg', legR: 'leg' };
  var PART_BOX = { head: [16, 16], torso: [16, 16], arm: [8, 12], leg: [8, 8] };

  function boxW(socket) { return (socket === 'head' || socket === 'torso') ? 24 : 18; }

  /* The single layout table: drawBody and socketRect both come through here. */
  function slotRect(socket, x, y, sc) {
    sc = sc || 1;
    for (var i = 0; i < CELLS.length; i++) {
      if (CELLS[i].s !== socket) continue;
      var w = boxW(socket);
      return {
        x: Math.round(x + (COLS[CELLS[i].c] + (CELL - w) / 2) * sc),
        y: Math.round(y + (ROWS[CELLS[i].r] + BAR_BAND) * sc),
        w: Math.round(w * sc),
        h: Math.round(w * sc)
      };
    }
    return { x: Math.round(x), y: Math.round(y), w: 0, h: 0 };
  }

  /* --------------------------------------------------------------- state */
  function state() { return DD.Run ? DD.Run.state : null; }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d === undefined ? 0 : d); }

  function limbOf(b, socket) {
    if (!b) return null;
    if (DD.Body && DD.Body.limbOf) return DD.Body.limbOf(b, socket);
    var id = b.sockets ? b.sockets[socket] : null;
    return (id && DD.Data && DD.Data.limbById) ? (DD.Data.limbById[id] || null) : null;
  }

  function heatTier(socket, info) {
    if (DD.Heat && DD.Heat.tier) {
      var t = DD.Heat.tier(socket);
      if (typeof t === 'number' && isFinite(t)) return DD.clamp(Math.round(t), 0, 3);
    }
    var f = info ? info.hf : 0;
    return f >= 0.98 ? 3 : (f >= 0.66 ? 2 : (f >= 0.33 ? 1 : 0));
  }

  /* Everything one socket needs to be drawn: limb, form, palette, heat, integrity. */
  function socketInfo(socket) {
    var b = state() ? state().body : null;
    var limb = limbOf(b, socket);
    var info = {
      limb: limb, stump: !limb, form: 'gaunt', palette: null,
      heat: 0, heatCap: 100, hf: 0, integ: 0, integMax: 1, ifr: 0, tier: 0
    };
    if (limb) {
      info.form = limb.form || 'gaunt';
      if (limb.palette && limb.palette.length >= 3) info.palette = limb.palette;
      info.integMax = num(limb.integrity, 1) || 1;
    }
    if (b) {
      info.heat = num(b.heat ? b.heat[socket] : 0);
      info.heatCap = num(b.heatCap ? b.heatCap[socket] : 0, 100) || 100;
      info.hf = DD.clamp(info.heat / info.heatCap, 0, 1);
      info.integ = num(b.integrity ? b.integrity[socket] : 0);
    }
    if (info.integMax <= 0) info.integMax = 1;
    info.ifr = DD.clamp(info.integ / info.integMax, 0, 1);
    info.tier = heatTier(socket, info);
    return info;
  }

  function clipText(str, maxW, scale) {
    str = String(str == null ? '' : str);
    if (P().textW(str, scale) <= maxW) return str;
    var s = str;
    while (s.length > 1 && P().textW(s, scale) > maxW) s = s.substring(0, s.length - 1);
    return s.length > 1 ? s.substring(0, s.length - 1) + '.' : s;
  }

  function isSelected(sel, socket, idx) {
    if (sel === undefined || sel === null || sel === false) return false;
    if (typeof sel === 'number') return sel === idx;
    if (typeof sel === 'string') return sel === socket;
    return false;
  }

  /* --------------------------------------------------------- one socket */
  function drawPart(socket, info, r, sc) {
    var part = PART_OF[socket] || 'torso';
    var d = PART_BOX[part] || [8, 8];
    var ox = r.x + Math.round((r.w - d[0] * sc) / 2);
    var oy = r.y + Math.round((r.h - d[1] * sc) / 2);
    var key = null;
    if (info.stump) {
      if (part === 'arm') key = 'av_stump_arm_down';
      else if (part === 'leg') key = 'av_stump_leg_down';
    } else {
      key = 'av_' + part + '_' + info.form + '_down';
    }
    if (key && P().hasSprite(key)) {
      var o = { scale: sc };
      if (info.palette) o.palette = info.palette;
      P().sprite(key, ox, oy, o);
      return;
    }
    if (!info.stump && P().hasSprite('icon_limb')) {
      P().sprite('icon_limb', r.x + Math.round((r.w - 16 * sc) / 2), r.y + Math.round((r.h - 16 * sc) / 2), { scale: sc });
      return;
    }
    if (!info.stump) {
      P().rect(ox, oy, Math.round(d[0] * sc), Math.round(d[1] * sc),
        (info.palette && info.palette[1]) || DD.C.line);
    }
  }

  function hoveredSocket(ox, oy, sc) {
    if (!DD.Input || !DD.Input.pointer) return null;
    var pt = DD.Input.pointer;
    if (typeof pt.x !== 'number' || typeof pt.y !== 'number') return null;
    for (var i = 0; i < CELLS.length; i++) {
      var r = slotRect(CELLS[i].s, ox, oy, sc);
      if (pt.x >= r.x && pt.x < r.x + r.w && pt.y >= r.y && pt.y < r.y + r.h) return CELLS[i].s;
    }
    return null;
  }

  function drawSocket(entry, ox, oy, sc, opts, idx, show, hov, lx, ly) {
    var s = entry.s;
    var info = socketInfo(s);
    var r = slotRect(s, ox, oy, sc);
    var t = DD.now() / 1000;
    var crit = info.tier >= 3;
    var glow = crit || !!opts.hot;
    var pulse = 0.5 + 0.5 * Math.sin(t * 8);
    var sel = isSelected(opts.selected, s, idx);
    var hh = Math.max(2, Math.round(3 * sc));
    var bb = Math.max(2, Math.round(BAR_BAND * sc));

    /* integrity above the box */
    P().bar(r.x, r.y - bb, r.w, hh, info.ifr, {
      fg: info.stump ? DD.C.line : DD.C.integrity,
      bg: DD.C.panelLo
    });

    /* the framed socket */
    P().rect(r.x, r.y, r.w, r.h, DD.C.panelLo);
    P().frame(r.x, r.y, r.w, r.h,
      sel ? DD.C.gold : (hov === s ? DD.C.text : (info.stump ? DD.C.blood : DD.C.line)));
    drawPart(s, info, r, sc);
    if (info.stump) {
      P().sprite('icon_skull', r.x + r.w - Math.round(8 * sc), r.y - Math.round(2 * sc), { scale: Math.max(0.5, sc * 0.5) });
    }

    /* heat below the box */
    var hc = (DD.C.heat && DD.C.heat[info.tier]) || '#ffffff';
    if (glow) hc = DD.mix(hc, '#ffffff', 0.2 + pulse * 0.55);
    P().bar(r.x, r.y + r.h + Math.max(1, Math.round(sc)), r.w, hh, info.hf, { fg: hc, bg: DD.C.panelLo });
    if (crit) P().frame(r.x - 1, r.y - 1, r.w + 2, r.h + 2, DD.mix(DD.C.heat[3], DD.C.bloodHi, pulse));

    if (sel) {
      P().sprite('ui_selector', r.x + (r.w >> 1), r.y + (r.h >> 1),
        { scale: Math.max(1, Math.round(2 * sc)), anchor: 'center' });
    }

    if (show) {
      var label = info.stump
        ? (DD.SOCKET_LABEL[s] || s) + ' (muñón)'
        : ((info.limb && info.limb.name) || DD.SOCKET_LABEL[s] || s);
      P().text(clipText(label, LEGEND_W * sc, 1), lx, ly, {
        color: sel ? DD.C.text : (info.stump ? DD.C.textFaint : DD.C.textDim)
      });
    }
  }

  /* -------------------------------------------------------------- public */
  H.socketRect = function (socket, x, y, scale) {
    return slotRect(socket, x, y, scale || 1);
  };

  H.drawBody = function (x, y, opts) {
    opts = opts || {};
    var sc = opts.scale || 1;
    var show = !!opts.showCards;
    var px = Math.round(x), py = Math.round(y);
    var pad = Math.round(4 * sc);
    var head = Math.round(8 * sc) + 8;                       // title band + rule + gap
    var legend = show ? Math.round(6 * sc) + Math.round(LEGEND_W * sc) : 0;
    var w = pad * 2 + Math.round(DIAG_W * sc) + legend;
    var h = head + Math.round(DIAG_H * sc) + pad;

    P().panel(px, py, w, h, { title: 'Cuerpo', titleScale: sc });

    var ox = px + pad, oy = py + head;
    var hov = opts.interactive ? hoveredSocket(ox, oy, sc) : null;
    var lx = ox + Math.round(DIAG_W * sc) + Math.round(6 * sc);
    /* Legend rows are spread over the diagram's own height, so a long limb
     * name shortens with an ellipsis instead of running into its neighbour. */
    var lh = Math.round((DIAG_H / CELLS.length) * sc);
    for (var i = 0; i < CELLS.length; i++) {
      drawSocket(CELLS[i], ox, oy, sc, opts, i, show, hov, lx, oy + Math.round(2 * sc) + i * lh);
    }
    return { x: px, y: py, w: w, h: h };
  };

  /* The anatomical clock. warn defaults to "under a minute left". */
  H.drawClock = function (x, y, secs, warn) {
    var st = state();
    if (typeof secs !== 'number' || !isFinite(secs)) secs = st ? num(st.timeLeft) : 0;
    var danger = (warn === undefined) ? (secs < 60) : !!warn;
    var t = DD.now() / 1000;
    var panic = danger ? DD.clamp(1 - secs / 60, 0, 1) : 0;
    var pulse = 0.5 + 0.5 * Math.sin(t * (danger ? 9 : 2.4));
    var sh = danger ? DD.Pixel.shake(t, 1 + panic * 2) : { x: 0, y: 0 };
    var x0 = Math.round(x) + sh.x, y0 = Math.round(y) + sh.y;

    P().sprite('ui_clock_face', x0, y0, { flash: danger ? 0.12 + pulse * 0.3 : 0 });

    /* the hand swings once per minute */
    var frac = (((secs % 60) + 60) % 60) / 60;
    var C = DD.Canvas.ctx;
    C.save();
    C.translate(x0 + 16, y0 + 16);
    C.rotate(-Math.PI / 2 + frac * Math.PI * 2);
    P().sprite('ui_clock_hand', -6, -1);
    C.restore();

    if (danger) P().dim(x0, y0, 32, 32, 0.14 + pulse * 0.2, DD.C.blood);

    var str = DD.clock ? DD.clock(secs) : ('' + Math.floor(secs / 60) + ':' + DD.pad2(secs % 60));
    P().text(str, x0 - 8, y0 + 8, {
      scale: 2, align: 'right',
      color: danger ? DD.mix(DD.C.bloodHi, '#ffffff', pulse * 0.45) : DD.C.text
    });
    return { x: x0, y: y0, danger: danger };
  };

  H.ticker = function () {
    var st = state();
    if (!st) return;
    var log = (st.encounter && st.encounter.log && st.encounter.log.length) ? st.encounter.log : st.log;
    if (!log || !log.length) return;
    var n = Math.min(log.length, 5);
    for (var i = 0; i < n; i++) {
      var line = log[i];
      if (line == null) continue;
      P().text(clipText(line, 108, 1), 4, TICKER_Y + i * 9, {
        color: i === 0 ? DD.C.text : (i === 1 ? DD.C.textDim : DD.C.textFaint),
        alpha: 1 - i * 0.12
      });
    }
  };

  /* ------------------------------------------------------------ vitals */
  function drawVitals(st) {
    var enc = st.encounter;
    var hp = num(st.hp), maxHp = Math.max(1, num(st.maxHp, 1));
    var frac = DD.clamp(hp / maxHp, 0, 1);

    P().sprite('icon_hp', 4, VITALS_Y);
    P().bar(22, VITALS_Y + 2, 72, 9, frac, { fg: DD.C.hp, bg: DD.C.panelLo, ghost: frac });
    P().text(hp + '/' + maxHp, 98, VITALS_Y + 3, { color: DD.C.text });

    var block = num(enc ? enc.block : st.block);
    if (block > 0) {
      P().sprite('icon_shield', 132, VITALS_Y + 1);
      P().text(String(block), 150, VITALS_Y + 3, { color: DD.C.integrity });
    }

    P().sprite('icon_energy', 4, VITALS_Y + 19);
    var maxE = enc ? Math.max(1, num(enc.maxEnergy, 3)) : 3;
    var e = enc ? num(enc.energy) : 0;
    for (var i = 0; i < maxE && i < 8; i++) {
      var px = 22 + i * 12;
      P().rect(px, VITALS_Y + 21, 10, 8, i < e ? DD.C.energy : DD.C.panelLo);
      P().frame(px, VITALS_Y + 21, 10, 8, i < e ? DD.mix(DD.C.energy, '#ffffff', 0.3) : DD.C.line);
    }

    P().sprite('icon_residue', 4, VITALS_Y + 36);
    P().text(String(num(st.residue)), 22, VITALS_Y + 38, { color: DD.C.residue });
    P().sprite('icon_shard', 60, VITALS_Y + 36);
    P().text(String(num(st.shards)), 78, VITALS_Y + 38, { color: DD.C.gold });

    P().text('Piso ' + (num(st.floor) + 1) + '/' + Math.max(1, num(st.floorCount, 4)), 4, VITALS_Y + 55, { color: DD.C.textDim });
  }

  /* Banner while any socket sits at tier 3: the limb is about to break. */
  function drawHeatBanner(st, t) {
    var crit = 0;
    for (var i = 0; i < CELLS.length; i++) {
      if (socketInfo(CELLS[i].s).tier >= 3) crit++;
    }
    if (!crit) return;
    var pulse = 0.5 + 0.5 * Math.sin(t * 8);
    var label = '¡CALOR CRÍTICO! Un miembro va a estallar';
    var w = P().textW(label, 1) + 26;
    var x = Math.round(320 - w / 2);
    P().panel(x, 2, w, 15, {
      fill: DD.mix(DD.C.panel, DD.C.blood, 0.3 + pulse * 0.25),
      border: DD.C.bloodHi, accent: DD.C.heat[3]
    });
    P().sprite('icon_heat', x + 2, 2);
    P().text(label, x + 22, 6, { color: DD.mix(DD.C.heat[3], '#ffffff', pulse * 0.5) });
  }

  H.draw = function () {
    var st = state();
    if (!st) return;
    var t = DD.now() / 1000;

    H.drawBody(2, 2, {});
    drawVitals(st);
    H.drawClock(588, 8, num(st.timeLeft), num(st.timeLeft) < 60);
    H.ticker();
    drawHeatBanner(st, t);
  };
})();
