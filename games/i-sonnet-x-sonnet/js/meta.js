/* Deadlock Deck: El Reloj Anatómico — pantallas de meta (W5)
 * Escenas title, table, codex, shop y results. Contrato: docs/design.md §12.
 * Todas a 640x360 completos, navegables con flechas + ok/back, ratón y táctil.
 */
(function () {
  'use strict';
  var DD = window.DD;
  var C = DD.C, CFG = DD.CFG;

  /* =====================================================================
   * Helpers de dibujo y audio
   * ===================================================================== */
  function sfx(n, v) { if (DD.Audio && DD.Audio.sfx) DD.Audio.sfx(n, v); }
  function music(n) { if (DD.Audio && DD.Audio.music) DD.Audio.music(n); }
  function isMuted() { return DD.Audio && DD.Audio.muted != null ? !!DD.Audio.muted : !!DD.save.mute; }

  function rect(ctx, c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function box(ctx, x, y, w, h, fill, line) { rect(ctx, line, x, y, w, h); rect(ctx, fill, x + 1, y + 1, w - 2, h - 2); }
  function T(ctx, s, x, y, color, size, align) {
    DD.text(ctx, s, x, y, { color: color || C.ink, size: size || 1, align: align || 'left', shadow: C.bg });
  }
  function spr(ctx, key, x, y) { if (DD.Sprites && DD.Sprites.draw) DD.Sprites.draw(ctx, key, x, y); }
  function backdrop(ctx, key) {
    if (DD.Sprites && DD.Sprites.backdrop) DD.Sprites.backdrop(ctx, key, DD.time);
    else rect(ctx, C.bg, 0, 0, DD.W, DD.H);
  }
  function dim(ctx, a) { ctx.globalAlpha = a; rect(ctx, C.bg, 0, 0, DD.W, DD.H); ctx.globalAlpha = 1; }
  function scaled(ctx, x, y, s, fn) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); fn(); ctx.restore(); }

  function limbIcon(ctx, id, x, y, s, silhouette) {       // icono 16x16 ampliado s veces
    var S = DD.Sprites;
    if (S && S.drawLimbIcon) scaled(ctx, x, y, s, function () { S.drawLimbIcon(ctx, id, 0, 0, { silhouette: !!silhouette }); });
    else box(ctx, x, y, 16 * s, 16 * s, C.steelDk, C.line);
  }
  function stumpIcon(ctx, type, x, y) {
    if (DD.Sprites && DD.Sprites.drawStumpIcon) DD.Sprites.drawStumpIcon(ctx, type, x, y);
    else box(ctx, x, y, 16, 16, C.bg, C.blood);
  }
  function player(ctx, body, cx, by, s, equip, frame) {    // cuerpo grande (≈48x88) ampliado s veces
    var S = DD.Sprites;
    if (S && S.drawPlayerBig) {
      scaled(ctx, cx, by, s, function () { S.drawPlayerBig(ctx, body, 0, 0, { frame: frame || 0, equip: equip }); });
    } else {
      rect(ctx, C.steelDk, cx - 12 * s, by - 44 * s, 24 * s, 44 * s);
    }
  }

  var wrapMemo = {};
  function wrapM(s, w, size) {
    var k = w + '|' + (size || 1) + '|' + s;
    return wrapMemo[k] || (wrapMemo[k] = DD.wrap(s, w, size || 1));
  }

  function shortNum(n) { return n < 1e5 ? String(n) : (n < 1e8 ? Math.floor(n / 1e3) + 'k' : Math.floor(n / 1e6) + 'M'); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function known(id) { return !!(DD.save.blueprints && DD.save.blueprints[id]); }
  function knownCount() {
    var n = 0;
    for (var i = 0; i < DD.LIMB_ORDER.length; i++) if (known(DD.LIMB_ORDER[i])) n++;
    return n;
  }

  // Las transiciones de escena se hacen al final de draw (el fundido copia un fotograma completo)
  var pend = null;
  function later(fn) { pend = fn; }
  function flush() { var f = pend; pend = null; if (f) f(); }

  var uiLocked = false;      // fondo bajo un modal: entrada bloqueada y sin registrar foco
  function lockUI(b) { uiLocked = b; DD.Input.lock(b); }
  function underModal(active, fn) {
    if (!active) { fn(); return; }
    lockUI(true);
    try { fn(); } finally { lockUI(false); }
  }

  var lastResults = null;    // para volver a los resultados desde Códice/Tienda
  function backTo(from) {
    sfx('uiBack');
    if (from === 'results' && lastResults) later(function () { DD.setScene('results', lastResults); });
    else later(function () { DD.setScene('title'); });
  }
  function go(name, params) { sfx('ui'); later(function () { DD.setScene(name, params); }); }

  /* =====================================================================
   * Navegación por foco: rectángulos registrados en el fotograma anterior,
   * flechas → el más cercano en esa dirección. Una «lista» ({sel,n}) gasta
   * arriba/abajo por dentro; pref = se prefiere al entrar (pestaña activa).
   * ===================================================================== */
  function makeNav(def) { return { items: [], prev: [], focus: def || null, keyMoved: false }; }
  function navBegin(n) { n.prev = n.items; n.items = []; }
  function navAdd(n, id, x, y, w, h, o) {
    if (uiLocked) return false;
    n.items.push({ id: id, x: x, y: y, w: w, h: h, list: o && o.list, pref: o && o.pref });
    var m = DD.Input.mouse;
    if ((m.moved || m.clicked) && DD.ui.hit(x, y, w, h)) n.focus = id;
    return n.focus === id;
  }
  function gapOf(a, al, b, bl) { return Math.max(0, Math.max(a - (b + bl), b - (a + al))); }
  function navStep(n, dir) {
    var cur = null, best = null, bs = 1e9, i, o;
    for (i = 0; i < n.prev.length; i++) if (n.prev[i].id === n.focus) cur = n.prev[i];
    if (!cur) {
      if (!n.prev.length) return false;
      n.focus = n.prev[0].id; return true;
    }
    var L = cur.list;
    if (L && (dir === 'up' || dir === 'down')) {
      var s = L.sel + (dir === 'up' ? -1 : 1);
      if (s >= 0 && s < L.n) { L.sel = s; return true; }
    }
    var cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2, horiz = dir === 'left' || dir === 'right';
    for (var pass = 0; pass < 2 && !best; pass++) {
      for (i = 0; i < n.prev.length; i++) {
        o = n.prev[i];
        if (o === cur) continue;
        var ox = o.x + o.w / 2, oy = o.y + o.h / 2, gp, gs;
        if (dir === 'right') { if (ox <= cx) continue; gp = Math.max(0, o.x - (cur.x + cur.w)); gs = gapOf(o.y, o.h, cur.y, cur.h); }
        else if (dir === 'left') { if (ox >= cx) continue; gp = Math.max(0, cur.x - (o.x + o.w)); gs = gapOf(o.y, o.h, cur.y, cur.h); }
        else if (dir === 'down') { if (oy <= cy) continue; gp = Math.max(0, o.y - (cur.y + cur.h)); gs = gapOf(o.x, o.w, cur.x, cur.w); }
        else { if (oy >= cy) continue; gp = Math.max(0, cur.y - (o.y + o.h)); gs = gapOf(o.x, o.w, cur.x, cur.w); }
        // primera pasada: solo los que se solapan en el otro eje (misma fila/columna); la segunda (solo vertical) lo relaja
        if (pass === 0 && gs > 0) continue;
        var sc = gp + 3 * gs + 0.02 * Math.sqrt((ox - cx) * (ox - cx) + (oy - cy) * (oy - cy));
        if (sc < bs) { bs = sc; best = o; }
      }
      if (horiz) break;
    }
    if (best && !horiz) {             // al entrar en una fila de pestañas se cae en la activa
      for (i = 0; i < n.prev.length; i++) {
        o = n.prev[i];
        if (o.pref && o.y === best.y && (dir === 'down' ? o.y > cy : o.y + o.h < cy)) best = o;
      }
    }
    if (!best) return false;
    n.focus = best.id;
    return true;
  }
  function navUpdate(n) {
    var In = DD.Input, dirs = ['up', 'down', 'left', 'right'];
    n.keyMoved = false;
    for (var i = 0; i < 4; i++) {
      if (In.pressed(dirs[i]) && navStep(n, dirs[i])) { n.keyMoved = true; sfx('ui', 0.3); }
    }
  }

  // Botón con foco. opt: {size, color, disabled, soft}. soft = se ve apagado pero avisa al pulsarlo.
  function nbtn(n, ctx, id, x, y, w, h, label, opt) {
    opt = opt || {};
    var foc = navAdd(n, id, x, y, w, h), fired;
    if (opt.soft) {
      DD.ui.button(ctx, x, y, w, h, label, { disabled: true, size: opt.size });
      fired = (DD.ui.hit(x, y, w, h) && DD.Input.mouse.clicked) || (foc && DD.Input.pressed('ok'));
    } else {
      fired = DD.ui.button(ctx, x, y, w, h, label, { selected: foc && !opt.disabled, disabled: opt.disabled, size: opt.size, color: opt.color });
      if (!fired && foc && !opt.disabled && DD.Input.pressed('ok')) fired = true;
    }
    if (fired) n.focus = id;
    return fired;
  }

  // Pestaña: activa = marcada; con teclado, moverse hasta ella la activa
  function tab(n, ctx, id, x, y, w, h, label, active) {
    var foc = navAdd(n, id, x, y, w, h, { pref: active });
    var hov = !uiLocked && DD.ui.hit(x, y, w, h);
    box(ctx, x, y, w, h, active ? C.panelHi : (hov || foc ? C.panel : C.bg2), foc ? C.heatHi : (active ? C.brass : C.line));
    if (active) rect(ctx, C.heat, x + 2, y + h - 3, w - 4, 2);
    T(ctx, label, x + (w >> 1), y + ((h - 7) >> 1) + (active ? 0 : 1), active ? C.bone : (hov || foc ? C.ink : C.dim), 1, 'center');
    return (hov && DD.Input.mouse.clicked) || (foc && (DD.Input.pressed('ok') || (n.keyMoved && !active)));
  }

  function focusRing(ctx, x, y, w, h) {
    var on = Math.floor(DD.time * 4) % 2 === 0, c = on ? C.heatHi : C.brass;
    rect(ctx, c, x - 2, y - 2, w + 4, 2); rect(ctx, c, x - 2, y + h, w + 4, 2);
    rect(ctx, c, x - 2, y, 2, h); rect(ctx, c, x + w, y, 2, h);
  }

  /* =====================================================================
   * Chispas (brasas que suben)
   * ===================================================================== */
  function makeSparks(n, cfg) {
    var a = [], i;
    function reset(p, fresh) {
      p.x = cfg.x0 + Math.random() * (cfg.x1 - cfg.x0);
      p.y = fresh ? cfg.y0 + Math.random() * (cfg.y1 - cfg.y0) : cfg.y1;
      p.vx = (Math.random() - 0.5) * cfg.drift;
      p.vy = -cfg.rise * (0.5 + Math.random());
      p.max = p.life = 1.5 + Math.random() * 3.5;
      p.c = cfg.cols[Math.floor(Math.random() * cfg.cols.length)];
      p.s = Math.random() < 0.2 ? 2 : 1;
      p.ph = Math.random() * 6.28;
    }
    for (i = 0; i < n; i++) { var p = {}; reset(p, true); a.push(p); }
    return {
      update: function (dt) {
        for (var k = 0; k < a.length; k++) {
          var q = a[k];
          q.x += (q.vx + Math.sin(DD.time * 2 + q.ph) * 6) * dt; q.y += q.vy * dt; q.life -= dt;
          if (q.life <= 0 || q.y < cfg.y0 - 10) reset(q, false);
        }
      },
      draw: function (ctx) {
        for (var k = 0; k < a.length; k++) {
          var q = a[k], f = Math.min(1, q.life / 0.8, (q.max - q.life) / 0.3 + 0.2);
          ctx.globalAlpha = Math.max(0, f) * (0.6 + 0.4 * Math.sin(DD.time * 13 + q.ph));
          rect(ctx, q.c, Math.round(q.x), Math.round(q.y), q.s, q.s);
        }
        ctx.globalAlpha = 1;
      }
    };
  }

  /* =====================================================================
   * Ficha de extremidad (Códice y mesa): icono grande, datos, pasivas, 3 cartas
   * ===================================================================== */
  var FX_ICON = { dmg: 'i_attack', block: 'i_block', heal: 'i_heal', draw: 'i_energy', energy: 'i_energy', burn: 'i_burn',
    vuln: 'i_vuln', weak: 'i_weak', stun: 'i_stun', cool: 'i_heat', repair: 'i_limb', selfdmg: 'i_hp' };

  function droppedBy(id) {
    var out = [];
    Object.keys(DD.ENEMIES).forEach(function (k) {
      if (DD.ENEMIES[k].drops.indexOf(id) >= 0) out.push(DD.ENEMIES[k].name);
    });
    return out.join(', ');
  }

  function firstFloor(id) {        // primer piso (1-3) en el que hay un enemigo que suelta esta extremidad
    var f = CFG.FLOORS;
    Object.keys(DD.ENEMIES).forEach(function (k) {
      var e = DD.ENEMIES[k];
      if (e.drops.indexOf(id) >= 0 && e.floors[0] + 1 < f) f = e.floors[0] + 1;
    });
    return f;
  }

  function statRun(ctx, xr, y, items) {        // pares icono+número alineados a la derecha
    var x = xr;
    for (var i = items.length - 1; i >= 0; i--) {
      var s = String(items[i][1]);
      x -= s.length * 6;
      T(ctx, s, x, y, items[i][2]);
      x -= 9;
      spr(ctx, items[i][0], x, y);
      x -= 5;
    }
  }

  function tierPips(ctx, x, y, tier) {
    for (var i = 0; i < 3; i++) rect(ctx, i < tier ? C.brass : C.line, x + i * 5, y, 3, 3);
  }

  // isKnown=false → silueta «???». own=true dibuja su propio marco con el nombre como título.
  function fiche(ctx, id, x, y, w, h, isKnown, own) {
    var L = DD.LIMBS[id];
    if (!L) return;
    var top;
    if (own) { DD.ui.panel(ctx, x, y, w, h, { title: isKnown ? L.name : '???' }); top = y + 26; x += 12; w -= 24; }
    else { T(ctx, isKnown ? L.name : '???', x + (w >> 1), y, C.bone, 1, 'center'); rect(ctx, C.line, x, y + 11, w, 1); top = y + 17; }
    box(ctx, x, top, 52, 52, C.bg, C.line);
    limbIcon(ctx, id, x + 2, top + 2, 3, !isKnown);
    var tx = x + 60, ty = top, i;
    T(ctx, DD.TYPE_NAME[L.type], tx, ty, C.brass);
    if (!isKnown) {
      var lines = wrapM('Plano sin descubrir. Cosecha esta extremidad en la torre e injértala para registrarla en el Códice.', w - 62, 1);
      for (i = 0; i < lines.length; i++) T(ctx, lines[i], tx, ty + 14 + i * 9, C.dim);
      T(ctx, 'Pista: la llevan enemigos a partir del piso ' + firstFloor(id) + '.', x, top + 62, C.steel);
      return;
    }
    T(ctx, 'Nivel ' + L.tier, tx + (DD.TYPE_NAME[L.type].length + 1) * 6, ty, C.dim);
    tierPips(ctx, tx + (DD.TYPE_NAME[L.type].length + 9) * 6 + 2, ty + 2, L.tier);
    spr(ctx, 'i_limb', tx, ty + 12);
    T(ctx, 'Integridad máx. ' + L.integ, tx + 12, ty + 12, C.ink);
    var ps = DD.passiveText(L.passive);
    if (!ps.length) T(ctx, 'Sin pasivas', tx, ty + 24, C.dim);
    for (i = 0; i < ps.length; i++) T(ctx, ps[i], tx, ty + 24 + i * 9, C.acid);

    var cy = top + 58;
    for (i = 0; i < L.cards.length; i++) {
      var cd = DD.CARDS[L.cards[i]];
      if (!cd) continue;
      var tl = wrapM(DD.cardText(cd), w - 14, 1);
      rect(ctx, C.bg2, x, cy, w, 12 + tl.length * 9);
      spr(ctx, FX_ICON[cd.fx[0] && cd.fx[0].t] || 'i_attack', x + 3, cy + 2);
      T(ctx, cd.name, x + 15, cy + 2, C.bone);
      var st = [['i_energy', cd.cost, C.ether], ['i_heat', cd.heat, C.heat]];
      if (cd.wear > 0) st.push(['i_limb', cd.wear, C.bloodHi]);
      statRun(ctx, x + w - 4, cy + 2, st);
      for (var j = 0; j < tl.length; j++) T(ctx, tl[j], x + 15, cy + 12 + j * 9, C.ink);
      cy += 15 + tl.length * 9;
    }
    var fl = wrapM(L.flavor || '', w, 1);
    cy += 2;
    for (i = 0; i < fl.length; i++) T(ctx, fl[i], x, cy + i * 9, C.dim);
    cy += fl.length * 9 + 3;
    var dl = wrapM('Cae de: ' + droppedBy(id), w, 1);
    for (i = 0; i < dl.length; i++) T(ctx, dl[i], x, cy + i * 9, C.steel);
  }

  function ficheLegend(ctx, x, y) {
    spr(ctx, 'i_energy', x, y); T(ctx, 'Coste', x + 11, y, C.dim);
    spr(ctx, 'i_heat', x + 58, y); T(ctx, 'Calor', x + 69, y, C.dim);
    spr(ctx, 'i_limb', x + 116, y); T(ctx, 'Desgaste', x + 127, y, C.dim);
  }

  /* =====================================================================
   * TÍTULO
   * ===================================================================== */
  var HELP_TABS = ['Historia', 'Mecánicas', 'Controles'];
  var HELP = [
    [
      ['SINOPSIS', 'Eres una abominación recién reanimada en un laboratorio alquímico al borde del colapso. La torre arde y tienes exactamente 6:00 de reloj para escapar. Tres pisos de laberintos que cambian sin parar, llenos de monstruosidades y científicos corruptos, te separan de la salida.'],
      ['EXPLORAR', 'Recorre los pasillos, recoge viales, refrigerante, suturas y Éter. Esquiva trampas y fuego.'],
      ['COMBATIR', 'Toca a un enemigo para luchar por turnos con las cartas de tu cuerpo.'],
      ['COSECHAR', 'Al vencer, arranca una extremidad: injértala, devórala o déjala.'],
      ['ESCAPAR', 'Llega a la salida del piso 3 antes de que el reloj marque 0:00.']
    ],
    [
      ['MAZO = CUERPO', 'Seis huecos: cabeza, torso, dos brazos y dos piernas. Cada extremidad aporta 3 cartas y pasivas. Cambiar extremidades cambia tu estilo.'],
      ['CALOR Y DESGASTE', 'Las cartas potentes calientan la extremidad que las juega. Si pasa de 100 se sobrecalienta y pierde integridad; algunas cartas también la desgastan.'],
      ['MUÑONES', 'Con integridad 0 la extremidad se rompe: pierdes sus cartas y luchas con un muñón flojo hasta injertar un reemplazo.'],
      ['BUCLE DE MUERTE', 'Si mueres o se acaba el tiempo, despiertas en otra mesa con un cuerpo base nuevo. Conservas los planos descubiertos y la torre se regenera.'],
      ['LABERINTO CAMBIANTE', 'Las compuertas de latón se abren y cierran cada pocos segundos. Vigila el parpadeo de aviso.']
    ]
  ];
  var CONTROLS = [
    ['TECLADO', [['Mover', 'Flechas o WASD'], ['Aceptar', 'Enter o Espacio'], ['Volver', 'Retroceso o Esc'],
      ['Terminar turno', 'E'], ['Jugar carta', '1-9'], ['Pausa / Sonido', 'P o Esc / M']]],
    ['RATÓN Y TÁCTIL', [['Botones y cartas', 'Clic o toque'], ['Caminar por la torre', 'Mantén pulsado hacia el destino']]],
    ['MANDO', [['Mover', 'Stick o cruceta'], ['Aceptar / Volver', 'A / B'], ['Terminar turno / Pausa', 'X / Start']]]
  ];

  function paragraph(ctx, x, y, w, head, text) {     // «TÍTULO texto…» con el título en latón; devuelve la y siguiente
    var lines = wrapM(head + ' ' + text, w, 1), off = (head.length + 1) * 6, first = true;
    for (var i = 0; i < lines.length; i++) {
      if (first) {
        T(ctx, head, x, y, C.brass);
        T(ctx, lines[0].slice(head.length + 1), x + off, y, C.ink);
        first = false;
      } else T(ctx, lines[i], x, y + i * 9, C.ink);
    }
    return y + lines.length * 9 + 14;
  }

  function drawHelp(ctx, st, nav) {
    dim(ctx, 0.7);
    DD.ui.panel(ctx, 50, 22, 540, 316, { title: 'CÓMO SE JUEGA' });
    var i, y;
    for (i = 0; i < 3; i++) {
      if (tab(nav, ctx, 'ht' + i, 70 + i * 152, 48, 144, 20, HELP_TABS[i], st.page === i)) { if (st.page !== i) sfx('ui', 0.5); st.page = i; }
    }
    if (st.page < 2) {
      y = 82;
      var blocks = HELP[st.page];
      for (i = 0; i < blocks.length; i++) y = paragraph(ctx, 70, y, 500, blocks[i][0], blocks[i][1]);
    } else {
      y = 80;
      for (i = 0; i < CONTROLS.length; i++) {
        T(ctx, CONTROLS[i][0], 70, y, C.brass);
        rect(ctx, C.line, 70 + CONTROLS[i][0].length * 6 + 6, y + 4, 500 - CONTROLS[i][0].length * 6 - 6, 1);
        y += 13;
        for (var j = 0; j < CONTROLS[i][1].length; j++) {
          T(ctx, CONTROLS[i][1][j][0], 82, y, C.dim);
          T(ctx, CONTROLS[i][1][j][1], 240, y, C.ink);
          y += 11;
        }
        y += 7;
      }
    }
    if (nbtn(nav, ctx, 'hclose', 250, 302, 140, 26, 'Cerrar')) { sfx('uiBack'); st.help = false; nav.focus = 'wake'; }
  }

  function makeTitle() {
    var st, nav, sparks, sparks2;
    var logo = null;

    function buildGlow() {           // halo cálido detrás del título
      var c = document.createElement('canvas'), g;
      c.width = 400; c.height = 120;
      g = c.getContext('2d');
      var gr = g.createRadialGradient(200, 60, 4, 200, 60, 190);
      gr.addColorStop(0, 'rgba(255,150,50,0.55)'); gr.addColorStop(0.5, 'rgba(200,70,20,0.18)'); gr.addColorStop(1, 'rgba(120,30,10,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 400, 120);
      return c;
    }

    function shine(ctx, str, cx, y, size, base, hi, bandX) {     // texto con un destello que lo recorre
      T(ctx, str, cx, y, base, size, 'center');
      ctx.save();
      ctx.beginPath(); ctx.rect(bandX, y - 4, 30, size * 8 + 8); ctx.clip();
      DD.text(ctx, str, cx, y, { color: hi, size: size, align: 'center' });
      ctx.restore();
    }

    function pending() { return !!(DD.run && !DD.run.started && !DD.run.ended); }

    function records(ctx) {
      var s = DD.save, X = 100, Y = 254, W = 300, H = 62;
      DD.ui.panel(ctx, X, Y, W, H, { title: 'RÉCORDS', alpha: 0.94 });
      if (!s.runs) {
        T(ctx, 'Aún no has despertado.', X + W / 2, Y + 24, C.ink, 1, 'center');
        T(ctx, 'Tus récords y planos se anotarán aquí.', X + W / 2, Y + 36, C.dim, 1, 'center');
        return;
      }
      var cells = [
        ['Escapes', shortNum(s.escapes), C.acid], ['Récord', s.bestTime == null ? '--' : DD.fmtTime(s.bestTime), C.warn], ['Partidas', shortNum(s.runs), C.ink],
        ['Planos', knownCount() + '/' + DD.LIMB_ORDER.length, C.brass], ['Éter', shortNum(s.ether), C.ether], ['Piso máx.', (s.bestFloor || 0) + '/' + CFG.FLOORS, C.ink]
      ];
      for (var i = 0; i < 6; i++) {
        var cx = X + 14 + (i % 3) * 96, cy = Y + 22 + Math.floor(i / 3) * 14;
        T(ctx, cells[i][0], cx, cy, C.dim);
        T(ctx, String(cells[i][1]), cx + cells[i][0].length * 6 + 5, cy, cells[i][2]);
      }
    }

    return {
      enter: function () {
        st = { help: false, page: 0 };
        nav = makeNav('wake');
        pend = null;
        sparks = makeSparks(34, { x0: 360, x1: 580, y0: 40, y1: 330, rise: 16, drift: 10, cols: [C.fire1, C.fire2, C.fire3, C.fire3] });
        sparks2 = makeSparks(18, { x0: 20, x1: 440, y0: 120, y1: 345, rise: 10, drift: 14, cols: [C.fire2, C.fire3, C.brass] });
        if (!logo) logo = buildGlow();
        music('title');
      },
      update: function (dt) {
        sparks.update(dt); sparks2.update(dt);
        var In = DD.Input;
        if (st.help) {
          if (In.pressed('back')) { sfx('uiBack'); st.help = false; nav.focus = 'wake'; return; }
          if (In.pressed('left') && st.page > 0) { st.page--; sfx('ui', 0.5); }
          else if (In.pressed('right') && st.page < 2) { st.page++; sfx('ui', 0.5); }
          else if (In.pressed('up') || In.pressed('down')) navUpdate(nav);
          return;
        }
        navUpdate(nav);
      },
      draw: function (ctx) {
        backdrop(ctx, 'title');
        sparks2.draw(ctx);
        sparks.draw(ctx);
        var t = DD.time, pulse = 0.5 + 0.5 * Math.sin(t * 1.7);
        navBegin(nav);
        underModal(st.help, function () {
          // título con halo y destello
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.55 + 0.35 * pulse;
          ctx.drawImage(logo, 50, -14);
          ctx.restore();
          var bandX = 94 + ((t * 80) % 440) - 60;
          T(ctx, 'DEADLOCK DECK', 252, 20, '#2a0d06', 4, 'center');
          T(ctx, 'DEADLOCK DECK', 250, 18, C.copper, 4, 'center');
          shine(ctx, 'DEADLOCK DECK', 250, 14, 4, C.brass, '#fff4c8', bandX);
          T(ctx, 'EL RELOJ ANATÓMICO', 250, 54, C.bone, 2, 'center');
          rect(ctx, C.brassDk, 140, 74, 220, 1);
          rect(ctx, C.brass, 200, 74, 100, 1);

          var foc = pending();
          if (nbtn(nav, ctx, 'wake', 150, 84, 200, 34, foc ? 'Volver a la mesa' : 'Despertar', { size: foc ? 1 : 2 })) {
            sfx('ui');
            later(function () { if (foc) DD.setScene('table'); else if (DD.Run && DD.Run.begin) DD.Run.begin(); });
          }
          if (nbtn(nav, ctx, 'codex', 150, 124, 200, 26, 'Códice')) go('codex', { from: 'title' });
          if (nbtn(nav, ctx, 'shop', 150, 154, 200, 26, 'Tienda')) go('shop', { from: 'title' });
          if (nbtn(nav, ctx, 'help', 150, 184, 200, 26, 'Cómo se juega')) { sfx('ui'); st.help = true; st.page = 0; nav.focus = 'ht0'; }
          if (nbtn(nav, ctx, 'snd', 150, 214, 200, 26, 'Sonido: ' + (isMuted() ? 'no' : 'sí'))) {
            var m = DD.Audio && DD.Audio.toggleMute ? DD.Audio.toggleMute() : !DD.save.mute;
            DD.save.mute = !!m; DD.saveNow(); sfx('ui');
          }
          records(ctx);
          T(ctx, 'Flechas + Enter, ratón, toque o mando', 250, 332, C.dim, 1, 'center');
        });
        if (st.help) drawHelp(ctx, st, nav);
        flush();
      }
    };
  }

  /* =====================================================================
   * MESA DE DISECCIÓN
   * ===================================================================== */
  var tbl = { run: null, log: [] };     // injertos hechos en la mesa, ligados al objeto DD.run
  var SLOT_POS = { head: [8, 44], torso: [440, 44], armL: [8, 114], armR: [440, 114], legL: [8, 184], legR: [440, 184] };
  var STAT_ROWS = [
    ['i_hp', 'Vida máx.', function (s) { return s.hpMax; }],
    ['i_energy', 'Energía', function (s) { return s.energy; }],
    ['i_limb', 'Mano', function (s) { return s.hand; }],
    ['i_attack', 'Daño', function (s) { return '+' + s.dmg; }],
    ['i_block', 'Bloqueo', function (s) { return '+' + s.block; }],
    ['i_heat', 'Enfría', function (s) { return s.cool + '/t'; }],
    ['i_clock', 'Vel.', function (s) { return '×' + s.speed.toFixed(2).replace(/0$/, ''); }],
    ['i_debuff', 'Visión', function (s) { return s.vision; }],
    ['i_burn', 'Res.fuego', function (s) { return Math.round(s.fireRes * 100) + '%'; }]
  ];

  function reincarnation(run) {
    var tail = ' Conservas ' + plural(knownCount(), 'plano', 'planos') + '.';
    if (!run || run.n <= 1) return 'Primera reanimación. Cada plano que injertes quedará anotado en el Códice.';
    switch (run.prevReason) {
      case 'death': return 'Has muerto. Tu espíritu despierta en otro cuerpo y la torre se regenera.' + tail;
      case 'time': return 'El reloj llegó a 0:00. Despiertas en otro cuerpo; la torre se regenera.' + tail;
      case 'victory': return 'Escapaste, pero el laboratorio te reanima: cuerpo nuevo, torre nueva.' + tail;
      case 'quit': return 'Abandonaste la torre. Despiertas en otro cuerpo; la torre se regenera.' + tail;
    }
    return 'Tu espíritu despierta en otro cuerpo. La torre se ha regenerado.' + tail;
  }

  function knownOfType(type, exceptId) {
    return DD.LIMB_ORDER.filter(function (id) { return DD.LIMBS[id].type === type && known(id) && id !== exceptId; });
  }

  // Cambios en las pasivas totales si se injerta limbId en slot (p. ej. «Vida máx. 64>67»)
  function effectText(run, slot, limbId) {
    var tmp = JSON.parse(JSON.stringify(run.body)), a = DD.Body.stats(run.body), out = [];
    DD.Body.graft(tmp, slot, limbId);
    var b = DD.Body.stats(tmp);
    STAT_ROWS.forEach(function (r) {
      var x = String(r[2](a)), y = String(r[2](b));
      if (x !== y) out.push(r[1] + ' ' + x + '→' + y);
    });
    return out.length ? out.join(' · ') : 'Sin cambios en las pasivas totales.';
  }

  function makeTable() {
    var st, nav;

    function grafted() { return tbl.log.length; }
    function left() { return Math.max(0, CFG.TABLE_GRAFTS - grafted()); }
    function say(s, col) { st.msg = s; st.msgCol = col || C.acid; st.msgT = 3; }

    function doGraft(slot, limbId) {
      var run = DD.run, body = run.body, s = body.slots[slot];
      tbl.log.push({ slot: slot, prev: { id: s.id, integ: s.integ, heat: s.heat } });
      DD.Body.graft(body, slot, limbId, CFG.GRAFT_FRAC);
      if (DD.Run && DD.Run.refreshStats) DD.Run.refreshStats();
      sfx('graft'); DD.fx.flash(C.acid, 0.25, 0.25);
      say('Injertado: ' + DD.LIMBS[limbId].name + ' al ' + Math.round(CFG.GRAFT_FRAC * 100) + '% de integridad.');
    }
    function undoGraft() {
      var e = tbl.log.pop(), s = DD.run.body.slots[e.slot];
      s.id = e.prev.id; s.integ = e.prev.integ; s.heat = e.prev.heat;
      if (DD.Run && DD.Run.refreshStats) DD.Run.refreshStats();
      sfx('uiBack');
      say('Injerto deshecho.', C.warn);
    }

    function slotCard(ctx, run, slot) {
      var p = SLOT_POS[slot], x = p[0], y = p[1], W = 192, H = 66;
      var foc = navAdd(nav, 's_' + slot, x, y, W, H), s = run.body.slots[slot], limb = DD.Body.limbAt(run.body, slot);
      var hov = !uiLocked && DD.ui.hit(x, y, W, H);
      ctx.globalAlpha = 0.94;
      box(ctx, x, y, W, H, foc || hov ? C.panelHi : C.panel, foc ? C.heatHi : (hov ? C.brass : C.line));
      ctx.globalAlpha = 1;
      rect(ctx, C.brassDk, x + 1, y + 1, 3, 3);
      if (foc) focusRing(ctx, x, y, W, H);
      T(ctx, DD.SLOT_NAME[slot].toUpperCase(), x + 28, y + 5, C.dim);
      var i, cards;
      if (!limb) {
        stumpIcon(ctx, DD.SLOT_TYPE[slot], x + 6, y + 6);
        T(ctx, 'MUÑÓN', x + 28, y + 16, C.blood);
        cards = [DD.STUMP_CARDS[DD.SLOT_TYPE[slot]]];
      } else {
        limbIcon(ctx, limb.id, x + 6, y + 6, 1);
        T(ctx, limb.name, x + 28, y + 16, C.bone);
        var im = limb.integ, f = s.integ / im;
        DD.ui.bar(ctx, x + 28, y + 27, 100, 6, f, f < 0.6 ? C.warn : C.integ);
        T(ctx, s.integ + '/' + im, x + 134, y + 26, f < 0.99 ? C.warn : C.dim);
        cards = limb.cards.map(function (cid) { return DD.CARDS[cid]; });
      }
      for (i = 0; i < cards.length; i++) {
        var cd = cards[i];
        spr(ctx, FX_ICON[cd.fx[0] && cd.fx[0].t] || 'i_attack', x + 8, y + 37 + i * 9);
        T(ctx, cd.name, x + 20, y + 37 + i * 9, C.ink);
        T(ctx, String(cd.cost), x + W - 12, y + 37 + i * 9, C.ether);
      }
      var fired = (hov && DD.Input.mouse.clicked) || (foc && DD.Input.pressed('ok'));
      if (fired) { nav.focus = 's_' + slot; return true; }
      return false;
    }

    function openModal(slot) {
      var run = DD.run, cur = run.body.slots[slot].id, type = DD.SLOT_TYPE[slot];
      var list = knownOfType(type, cur);
      st.modal = { slot: slot, ids: list, L: { sel: 0, n: list.length, top: 0 } };
      nav.focus = list.length ? 'mlist' : 'mcancel';
    }

    function drawModal(ctx, run) {
      var m = st.modal, slot = m.slot, L = m.L, i, empty = !m.ids.length;
      var cur = DD.Body.limbAt(run.body, slot);
      dim(ctx, 0.72);
      if (empty) {
        DD.ui.panel(ctx, 130, 96, 380, 156, { title: 'INJERTAR: ' + DD.SLOT_NAME[slot].toUpperCase() });
        T(ctx, 'Sustituye: ' + (cur ? cur.name : 'muñón'), 146, 122, C.dim);
        var ml = wrapM('No conoces otros planos de este tipo. Cosecha e injerta extremidades en la torre para descubrirlos.', 348, 1);
        for (i = 0; i < ml.length; i++) T(ctx, ml[i], 146, 140 + i * 9, C.ink);
        if (nbtn(nav, ctx, 'mcancel', 250, 212, 140, 26, 'Volver')) { sfx('uiBack'); st.modal = null; nav.focus = 's_' + slot; }
        return;
      }
      DD.ui.panel(ctx, 60, 14, 520, 332, { title: 'INJERTAR: ' + DD.SLOT_NAME[slot].toUpperCase() });
      T(ctx, 'Sustituye: ' + (cur ? cur.name + ' (se pierde)' : 'muñón (no pierdes nada)'), 76, 40, C.dim);
      var ry = 56, rh = 28, rows = 8, lx = 76, lw = 174;
      var foc = navAdd(nav, 'mlist', lx, ry, lw, rows * rh, { list: L });
      if (L.sel < L.top) L.top = L.sel;
      if (L.sel >= L.top + rows) L.top = L.sel - rows + 1;
      for (i = 0; i < rows && L.top + i < m.ids.length; i++) {
        var idx = L.top + i, id = m.ids[idx], ly = ry + i * rh, sel = idx === L.sel;
        if (!uiLocked && (DD.Input.mouse.moved || DD.Input.mouse.clicked) && DD.ui.hit(lx, ly, lw, rh - 2)) { L.sel = idx; nav.focus = 'mlist'; sel = true; }
        box(ctx, lx, ly, lw, rh - 2, sel ? C.panelHi : C.bg2, sel ? (foc ? C.heatHi : C.brass) : C.line);
        limbIcon(ctx, id, lx + 4, ly + 4, 1);
        T(ctx, DD.LIMBS[id].name, lx + 25, ly + 4, sel ? C.bone : C.ink);
        T(ctx, 'Nivel ' + DD.LIMBS[id].tier + ' · Integ. ' + DD.LIMBS[id].integ, lx + 25, ly + 14, C.dim);
      }
      if (L.top > 0) T(ctx, '↑', lx + lw - 8, ry - 10, C.brass);
      if (L.top + rows < m.ids.length) T(ctx, '↓', lx + lw - 8, ry + rows * rh + 1, C.brass);
      var gi = m.ids[L.sel], gl = DD.LIMBS[gi];
      fiche(ctx, gi, 266, 52, 300, 250, true, false);
      T(ctx, 'Se injerta con ' + Math.max(1, Math.ceil(gl.integ * CFG.GRAFT_FRAC)) + '/' + gl.integ + ' de integridad.', 266, 255, C.warn);
      var ef = wrapM(effectText(run, slot, gi), 300, 1);
      for (i = 0; i < ef.length && i < 3; i++) T(ctx, ef[i], 266, 266 + i * 9, C.ether);
      ficheLegend(ctx, 268, 300);
      var ok = left() > 0;
      if (ok && foc && DD.Input.pressed('ok')) { doGraft(slot, gi); st.modal = null; nav.focus = 's_' + slot; return; }
      if (nbtn(nav, ctx, 'mgo', 266, 312, 150, 26, 'Injertar (' + left() + ' quedan)', { disabled: !ok })) {
        doGraft(slot, gi); st.modal = null; nav.focus = 's_' + slot; return;
      }
      if (nbtn(nav, ctx, 'mcancel', 424, 312, 142, 26, 'Cancelar')) { sfx('uiBack'); st.modal = null; nav.focus = 's_' + slot; }
      if (!ok) T(ctx, 'Sin injertos disponibles.', 76, 318, C.warn);
    }

    function background(ctx, run) {
      var i, stats = DD.Body.stats(run.body), base = DD.BASES[run.base] || DD.BASES.jornalero;
      // cabecera
      T(ctx, 'MESA DE DISECCIÓN', 12, 7, C.bone, 2);
      T(ctx, 'Reanimación #' + run.n, 548, 8, C.dim, 1, 'right');
      if (nbtn(nav, ctx, 'title', 556, 3, 76, 20, 'Título')) backTo('title');
      var msg = st.msgT > 0 ? st.msg : reincarnation(run), mc = st.msgT > 0 ? st.msgCol : C.ether;
      T(ctx, msg, 12, 28, mc);
      // cuerpo base y figura
      ctx.globalAlpha = 0.86;
      box(ctx, 208, 44, 224, 52, C.bg, C.brassDk);
      ctx.globalAlpha = 1;
      T(ctx, base.name.toUpperCase(), 320, 50, C.brass, 2, 'center');
      var fl = wrapM(base.flavor, 212, 1);
      for (i = 0; i < fl.length; i++) T(ctx, fl[i], 320, 70 + i * 9, C.ink, 1, 'center');
      player(ctx, run.body, 320, 298, 2, null, Math.floor(DD.time * 2.5) & 3);
      // huecos
      for (i = 0; i < DD.SLOTS.length; i++) {
        if (slotCard(ctx, run, DD.SLOTS[i])) {
          var sl = DD.SLOTS[i];
          if (left() > 0) { sfx('ui'); openModal(sl); }
          else { sfx('error'); say('No quedan injertos de mesa. Usa «Deshacer» para cambiar uno.', C.warn); }
        }
      }
      // pasivas totales
      DD.ui.panel(ctx, 8, 258, 192, 94, { title: 'PASIVAS TOTALES', alpha: 0.94 });
      for (i = 0; i < STAT_ROWS.length; i++) {
        var col = i < 5 ? 0 : 1, row = i < 5 ? i : i - 5, sx = 18 + col * 90, sy = 284 + row * 11;
        spr(ctx, STAT_ROWS[i][0], sx, sy);
        T(ctx, STAT_ROWS[i][1], sx + 11, sy, C.dim);
        T(ctx, String(STAT_ROWS[i][2](stats)), sx + 11 + STAT_ROWS[i][1].length * 6 + 4, sy, C.ink);
      }
      // injertos
      DD.ui.panel(ctx, 440, 258, 192, 94, { title: 'INJERTOS DE PLANO', alpha: 0.94 });
      T(ctx, left() + '/' + CFG.TABLE_GRAFTS, 536, 282, left() ? C.acid : C.blood, 2, 'center');
      var gl = wrapM('Pulsa un hueco para injertar un plano del Códice (' + Math.round(CFG.GRAFT_FRAC * 100) + '% de integridad).', 170, 1);
      for (i = 0; i < gl.length && i < 3; i++) T(ctx, gl[i], 536, 300 + i * 9, C.dim, 1, 'center');
      if (nbtn(nav, ctx, 'undo', 466, 329, 140, 18, 'Deshacer injerto', { disabled: !grafted() })) undoGraft();
      // recordatorio y despertar
      var rem = 'Tienes ' + DD.fmtTime(CFG.RUN_TIME) + ' para escapar de la torre en llamas.';
      var rl = wrapM(rem, 232, 1);
      ctx.globalAlpha = 0.8; rect(ctx, C.bg, 208, 303, 224, 19); ctx.globalAlpha = 1;
      for (i = 0; i < rl.length; i++) T(ctx, rl[i], 320, 306 + i * 9, C.warn, 1, 'center');
      if (nbtn(nav, ctx, 'go', 210, 324, 220, 28, '¡DESPERTAR!', { size: 2 })) {
        sfx('ui');
        later(function () { if (DD.Run && DD.Run.launch) DD.Run.launch(); });
      }
    }

    return {
      enter: function () {
        if (!DD.run) { if (DD.Run && DD.Run.begin) DD.Run.begin(); return; }
        if (tbl.run !== DD.run) { tbl.run = DD.run; tbl.log = []; }
        st = { modal: null, msg: '', msgT: 0, msgCol: C.acid };
        nav = makeNav('go');
        pend = null;
        music('table');
      },
      update: function (dt) {
        if (!st) return;
        if (st.msgT > 0) st.msgT -= dt;
        var In = DD.Input;
        if (st.modal) {
          if (In.pressed('back')) { sfx('uiBack'); var sl = st.modal.slot; st.modal = null; nav.focus = 's_' + sl; return; }
          navUpdate(nav);
          return;
        }
        if (In.pressed('back')) { backTo('title'); return; }
        navUpdate(nav);
      },
      draw: function (ctx) {
        if (!st) { backdrop(ctx, 'table'); return; }
        var run = DD.run;
        backdrop(ctx, 'table');
        navBegin(nav);
        underModal(!!st.modal, function () { background(ctx, run); });
        if (st.modal) drawModal(ctx, run);
        flush();
      }
    };
  }

  /* =====================================================================
   * CÓDICE
   * ===================================================================== */
  var FILTERS = [['all', 'Todas'], ['head', 'Cabezas'], ['torso', 'Torsos'], ['arm', 'Brazos'], ['leg', 'Piernas']];

  function makeCodex() {
    var st, nav;

    function list() {
      return DD.LIMB_ORDER.filter(function (id) { return st.filter === 'all' || DD.LIMBS[id].type === st.filter; });
    }
    function countOf(f) {
      var n = 0, t = 0;
      DD.LIMB_ORDER.forEach(function (id) { if (f === 'all' || DD.LIMBS[id].type === f) { t++; if (known(id)) n++; } });
      return n + '/' + t;
    }

    return {
      enter: function (p) {
        st = { filter: 'all', sel: DD.LIMB_ORDER[0], from: (p && p.from) || 'title' };
        nav = makeNav('c0');
        pend = null;
        music('title');
      },
      update: function () {
        if (DD.Input.pressed('back')) { backTo(st.from); return; }
        navUpdate(nav);
      },
      draw: function (ctx) {
        backdrop(ctx, 'codex');
        navBegin(nav);
        var i, ids;
        T(ctx, 'CÓDICE DE PLANOS', 14, 7, C.bone, 2);
        T(ctx, 'Planos ' + knownCount() + '/' + DD.LIMB_ORDER.length, 626, 10, C.brass, 1, 'right');
        for (i = 0; i < FILTERS.length; i++) {
          if (tab(nav, ctx, 'f' + i, 14 + i * 106, 30, 100, 22, FILTERS[i][1] + ' ' + countOf(FILTERS[i][0]), st.filter === FILTERS[i][0])) {
            if (st.filter !== FILTERS[i][0]) { st.filter = FILTERS[i][0]; sfx('ui', 0.5); if (!nav.focus || /^c\d+$/.test(nav.focus)) nav.focus = 'c0'; }
          }
        }
        ids = list();
        if (ids.indexOf(st.sel) < 0) st.sel = ids[0];
        // cuadrícula
        var GX = 14, GY = 62, CS = 46, G = 4;
        for (i = 0; i < ids.length; i++) {
          var id = ids[i], x = GX + (i % 5) * (CS + G), y = GY + Math.floor(i / 5) * (CS + G);
          var foc = navAdd(nav, 'c' + i, x, y, CS, CS), kn = known(id);
          if (foc) st.sel = id;
          var hov = !uiLocked && DD.ui.hit(x, y, CS, CS);
          ctx.globalAlpha = 0.94;
          box(ctx, x, y, CS, CS, foc || hov ? C.panelHi : C.panel, foc ? C.heatHi : (hov ? C.brass : C.line));
          ctx.globalAlpha = 1;
          limbIcon(ctx, id, x + 7, y + 6, 2, !kn);
          if (kn) tierPips(ctx, x + 6, y + 39, DD.LIMBS[id].tier);
          else T(ctx, '???', x + CS / 2, y + 37, C.dim, 1, 'center');
          if (foc) focusRing(ctx, x, y, CS, CS);
        }
        // ficha
        fiche(ctx, st.sel, 272, 58, 354, 282, known(st.sel), true);
        if (known(st.sel)) ficheLegend(ctx, 286, 324);
        // abajo izquierda
        if (nbtn(nav, ctx, 'back', 14, 300, 110, 26, st.from === 'results' ? 'Resultados' : 'Título')) backTo(st.from);
        if (nbtn(nav, ctx, 'shop', 132, 300, 110, 26, 'Tienda')) go('shop', { from: st.from });
        ctx.globalAlpha = 0.88; rect(ctx, C.bg, 14, 266, 238, 26); ctx.globalAlpha = 1;
        T(ctx, 'Un plano se descubre al injertar su', 20, 269, C.dim);
        T(ctx, 'extremidad. Se conservan entre runs.', 20, 279, C.dim);
        flush();
      }
    };
  }

  /* =====================================================================
   * TIENDA DEL ALQUIMISTA
   * ===================================================================== */
  var SHOP_TABS = [['skin', 'Pieles'], ['stitch', 'Puntadas'], ['eyes', 'Ojos'], ['base', 'Cuerpos base']];
  var CAT_DESC = {
    skin: 'Cambia el tono de tu carne cosida. Solo estético.',
    stitch: 'El hilo con el que te remendaron. Solo estético.',
    eyes: 'La chispa que vuelve a brillar en tu mirada. Solo estético.'
  };
  var DEMO_ETHER = 150;

  function makeShop() {
    var st, nav;

    function items() {
      if (SHOP_TABS[st.tab][0] === 'base') {
        return DD.BASE_ORDER.map(function (id) { var b = DD.BASES[id]; return { id: id, name: b.name, price: b.price, base: b }; });
      }
      return (DD.COSMETICS[SHOP_TABS[st.tab][0]] || []).slice();
    }
    function ownedItem(it, cat) {
      if (cat === 'base') return !it.base.locked || !!DD.save.owned[it.id];
      return !!DD.save.owned[it.id] || it.price === 0;
    }
    function say(s, col) { st.msg = s; st.msgCol = col || C.acid; st.msgT = 3; }

    function swatch(ctx, cat, it, x, y) {
      box(ctx, x, y, 26, 26, C.bg, C.line);
      if (cat === 'skin') { rect(ctx, it.c[0], x + 2, y + 2, 22, 11); rect(ctx, it.c[1], x + 2, y + 13, 11, 11); rect(ctx, it.c[2], x + 13, y + 13, 11, 11); }
      else if (cat === 'stitch') { for (var i = 0; i < 4; i++) { rect(ctx, it.c[0], x + 3 + i * 6, y + 4, 2, 18); rect(ctx, C.bg2, x + 3 + i * 6, y + 12, 2, 2); } rect(ctx, it.c[0], x + 3, y + 12, 20, 2); }
      else if (cat === 'eyes') {
        rect(ctx, it.c[0], x + 3, y + 8, 8, 10); rect(ctx, it.c[0], x + 15, y + 8, 8, 10);
        rect(ctx, it.c[1], x + 4, y + 9, 3, 3); rect(ctx, it.c[1], x + 16, y + 9, 3, 3);
        rect(ctx, C.bg, x + 7, y + 12, 3, 5); rect(ctx, C.bg, x + 19, y + 12, 3, 5);
      } else limbIcon(ctx, it.base.limbs.head, x + 5, y + 5, 1);
    }

    function buy(it, cat) {
      var s = DD.save;
      if (s.ether < it.price) { sfx('error'); say('Te faltan ' + (it.price - s.ether) + ' de Éter.', C.warn); return; }
      s.ether -= it.price; s.owned[it.id] = true;
      if (cat !== 'base') s.equip[cat] = it.id;
      DD.saveNow(); sfx('ether'); DD.fx.flash(C.ether, 0.2, 0.2);
      say(cat === 'base' ? '¡' + it.name + ' desbloqueado!' : '¡Comprado y equipado!');
    }
    function equip(it, cat) {
      DD.save.equip[cat] = it.id; DD.saveNow(); sfx('ui'); say('Equipado: ' + it.name + '.');
    }
    function primary(it, cat) {          // acción de la fila: comprar o equipar
      if (cat === 'base') { if (!ownedItem(it, cat)) buy(it, cat); return; }
      if (ownedItem(it, cat)) { if (DD.save.equip[cat] !== it.id) equip(it, cat); }
      else buy(it, cat);
    }

    return {
      enter: function (p) {
        st = { tab: 0, L: { sel: 0, n: 0, top: 0 }, from: (p && p.from) || 'title', msg: '', msgT: 0, msgCol: C.acid };
        nav = makeNav('list');
        pend = null;
        music('title');
      },
      update: function (dt) {
        if (st.msgT > 0) st.msgT -= dt;
        if (DD.Input.pressed('back')) { backTo(st.from); return; }
        navUpdate(nav);
      },
      draw: function (ctx) {
        backdrop(ctx, 'shop');
        navBegin(nav);
        var s = DD.save, i, cat = SHOP_TABS[st.tab][0], list = items(), L = st.L;
        T(ctx, 'TIENDA DEL ALQUIMISTA', 14, 7, C.bone, 2);
        var bal = String(s.ether), bx0 = 626 - bal.length * 6;
        T(ctx, bal, 626, 10, C.ether, 1, 'right');
        T(ctx, 'Éter', bx0 - 30, 10, C.dim);
        spr(ctx, 'i_ether', bx0 - 41, 10);
        for (i = 0; i < SHOP_TABS.length; i++) {
          if (tab(nav, ctx, 't' + i, 14 + i * 102, 30, 96, 22, SHOP_TABS[i][1], st.tab === i)) {
            if (st.tab !== i) { st.tab = i; L.sel = 0; L.top = 0; sfx('ui', 0.5); list = items(); cat = SHOP_TABS[i][0]; }
          }
        }
        if (nbtn(nav, ctx, 'back', 522, 30, 104, 22, st.from === 'results' ? 'Resultados' : 'Título')) backTo(st.from);
        L.n = list.length;
        if (L.sel >= L.n) L.sel = L.n - 1;
        // lista
        var RX = 14, RY = 60, RW = 232, RH = 40, ROWS = 5;
        var foc = navAdd(nav, 'list', RX, RY, RW, ROWS * RH, { list: L });
        if (L.sel < L.top) L.top = L.sel;
        if (L.sel >= L.top + ROWS) L.top = L.sel - ROWS + 1;
        for (i = 0; i < ROWS && L.top + i < list.length; i++) {
          var idx = L.top + i, it = list[idx], y = RY + i * RH, sel = idx === L.sel;
          if (!uiLocked && DD.ui.hit(RX, y, RW, RH - 3) && (DD.Input.mouse.moved || DD.Input.mouse.clicked)) { L.sel = idx; nav.focus = 'list'; sel = true; }
          var own = ownedItem(it, cat), eq = cat !== 'base' && s.equip[cat] === it.id;
          ctx.globalAlpha = 0.94;
          box(ctx, RX, y, RW, RH - 3, sel ? C.panelHi : C.panel, sel ? (foc ? C.heatHi : C.brass) : C.line);
          ctx.globalAlpha = 1;
          if (sel && foc) focusRing(ctx, RX, y, RW, RH - 3);
          swatch(ctx, cat, it, RX + 6, y + 5);
          T(ctx, it.name, RX + 38, y + 7, sel ? C.bone : C.ink);
          if (eq) T(ctx, 'EQUIPADO', RX + 38, y + 20, C.acid);
          else if (own) T(ctx, cat === 'base' ? (it.base.locked ? 'Desbloqueado' : 'De serie') : 'En propiedad', RX + 38, y + 20, C.steel);
          else {
            spr(ctx, 'i_ether', RX + 38, y + 20);
            T(ctx, it.price + ' Éter', RX + 49, y + 20, s.ether >= it.price ? C.ether : C.bloodHi);
          }
        }
        if (L.top > 0) T(ctx, '↑', RX + RW + 3, RY, C.brass);
        if (L.top + ROWS < list.length) T(ctx, '↓', RX + RW + 3, RY + ROWS * RH - 10, C.brass);
        var cur = list[L.sel];
        if (foc && DD.Input.pressed('ok') && cur) primary(cur, cat);
        // vista previa
        var equipPrev = { skin: s.equip.skin, stitch: s.equip.stitch, eyes: s.equip.eyes };
        if (cat !== 'base' && cur) equipPrev[cat] = cur.id;
        var pb = DD.Body.create(cat === 'base' && cur ? cur.id : (DD.run && DD.BASES[DD.run.base] ? DD.run.base : 'jornalero'));
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = C.bg;
        ctx.beginPath(); ctx.ellipse(330, 268, 52, 9, 0, 0, 6.3); ctx.fill();
        ctx.globalAlpha = 1;
        player(ctx, pb, 330, 270, 2, equipPrev, Math.floor(DD.time * 2.5) & 3);
        // ficha del artículo
        var IX = 420, IY = 60, IW = 208, IH = 200;
        DD.ui.panel(ctx, IX, IY, IW, IH, { title: cur ? cur.name : '', alpha: 0.94 });
        if (cur) {
          var ix = IX + 12, iw = IW - 24, yy = IY + 26;
          var lines = wrapM(cat === 'base' ? cur.base.flavor : CAT_DESC[cat], iw, 1);
          for (i = 0; i < lines.length; i++) T(ctx, lines[i], ix, yy + i * 9, C.ink);
          yy += lines.length * 9 + 6;
          if (cat === 'base') {
            var stt = DD.Body.stats(pb);
            T(ctx, 'Vida máx. ' + stt.hpMax + ' · Energía ' + stt.energy, ix, yy, C.brass); yy += 12;
            for (i = 0; i < DD.SLOTS.length; i++) {
              T(ctx, DD.SLOT_NAME[DD.SLOTS[i]], ix, yy, C.dim);
              var ln = DD.LIMBS[cur.base.limbs[DD.SLOTS[i]]].name;
              T(ctx, ln, ix + 72, yy, C.ink);
              yy += 10;
            }
          } else {
            for (i = 0; i < cur.c.length; i++) rect(ctx, cur.c[i], ix + i * 22, yy, 18, 10);
          }
          // estado / precio y acción
          var own2 = ownedItem(cur, cat), eq2 = cat !== 'base' && s.equip[cat] === cur.id;
          var by = IY + IH - 34, bx = IX + 14, bw = IW - 28, sy = by - 26;
          if (eq2) T(ctx, 'EQUIPADO', IX + IW / 2, sy, C.acid, 2, 'center');
          else if (own2) T(ctx, cat === 'base' ? (cur.base.locked ? 'DESBLOQUEADO' : 'DE SERIE') : 'EN PROPIEDAD', IX + IW / 2, sy, C.steel, 2, 'center');
          else {
            var ptxt = cur.price + ' Éter', px = IX + IW / 2 - (ptxt.length * 12 + 20) / 2;
            scaled(ctx, px, sy, 2, function () { spr(ctx, 'i_ether', 0, 0); });
            T(ctx, ptxt, px + 20, sy, s.ether >= cur.price ? C.ether : C.bloodHi, 2);
          }
          if (cat === 'base' && own2) nbtn(nav, ctx, 'act', bx, by, bw, 26, cur.base.locked ? 'Desbloqueado' : 'De serie', { disabled: true });
          else if (eq2) nbtn(nav, ctx, 'act', bx, by, bw, 26, 'Equipado', { disabled: true });
          else if (own2) { if (nbtn(nav, ctx, 'act', bx, by, bw, 26, 'Equipar')) equip(cur, cat); }
          else {
            var afford = s.ether >= cur.price;
            var lab = (cat === 'base' ? 'Desbloquear' : 'Comprar') + ' (' + cur.price + ')';
            if (nbtn(nav, ctx, 'act', bx, by, bw, 26, afford ? lab : 'Faltan ' + (cur.price - s.ether) + ' Éter', { soft: !afford, color: afford ? C.ether : undefined })) buy(cur, cat);
          }
        }
        if (st.msgT > 0) {
          var mw = st.msg.length * 6 + 14;
          ctx.globalAlpha = 0.85; rect(ctx, C.bg, 524 - (mw >> 1), IY + IH + 3, mw, 14); ctx.globalAlpha = 1;
          T(ctx, st.msg, 524, IY + IH + 6, st.msgCol, 1, 'center');
        }
        // paquete DEMO
        var DY = 290;
        DD.ui.panel(ctx, 14, DY, 612, 52, { border: C.warn, alpha: 0.95 });
        T(ctx, 'PAQUETE DEL ALQUIMISTA', 28, DY + 10, C.warn);
        box(ctx, 28 + 23 * 6 + 4, DY + 8, 28, 11, C.warn, C.warn);
        T(ctx, 'DEMO', 28 + 23 * 6 + 18, DY + 10, C.bg, 1, 'center');
        spr(ctx, 'i_ether', 28, DY + 24);
        T(ctx, DEMO_ETHER + ' Éter de prueba · precio simulado: 2,99 EUR', 41, DY + 24, C.ether);
        T(ctx, 'Demostración: no se cobra nada ni hay pagos reales.', 28, DY + 36, C.dim);
        if (nbtn(nav, ctx, 'demo', 452, DY + 10, 160, 32, 'Probar paquete\n(DEMO, gratis)', { color: C.warn })) {
          s.ether += DEMO_ETHER; DD.saveNow(); sfx('ether'); DD.fx.flash(C.warn, 0.2, 0.15);
          say('+' + DEMO_ETHER + ' Éter de prueba (simulado).', C.warn);
        }
        flush();
      }
    };
  }

  /* =====================================================================
   * RESULTADOS
   * ===================================================================== */
  var ENDINGS = {
    victory: { title: '¡ESCAPASTE!', color: C.fire3, sub: 'Dejas la torre ardiendo a tus espaldas. Amanece.', bd: 'win', mus: 'win' },
    death: { title: 'TE DESTRUYERON', color: C.bloodHi, sub: 'Tu cuerpo cosido no aguantó más.', bd: 'death', mus: 'death' },
    time: { title: 'EL RELOJ LLEGÓ A 0:00', color: C.fire2, sub: 'La torre se derrumba entre llamas y engranajes.', bd: 'death', mus: 'death' },
    quit: { title: 'ABANDONASTE', color: C.steel, sub: 'Dejas la mesa... pero la torre seguirá ardiendo.', bd: 'death', mus: 'death' }
  };

  function makeResults() {
    var st, nav, sparks;

    function row(ctx, y, ic, label, value, col) {
      if (ic) spr(ctx, ic, 76, y);
      T(ctx, label, 88, y, C.dim);
      T(ctx, String(value), 272, y, col || C.ink, 1, 'right');
    }

    return {
      enter: function (sum) {
        sum = sum || {};
        var r = ENDINGS[sum.reason] ? sum.reason : 'quit';
        st = {
          r: r, e: ENDINGS[r], cause: sum.cause || null, floor: sum.floor || 1, timeLeft: Math.max(0, Math.round(sum.timeLeft || 0)),
          kills: sum.kills || 0, grafts: sum.grafts || 0, bp: (sum.newBlueprints || []).filter(function (id) { return DD.LIMBS[id]; }),
          gained: sum.ether || 0, bonus: sum.bonus || 0
        };
        lastResults = sum;
        nav = makeNav('new');
        pend = null;
        var win = r === 'victory';
        sparks = makeSparks(win ? 26 : 34, win
          ? { x0: 0, x1: 640, y0: 180, y1: 350, rise: 14, drift: 12, cols: [C.fire3, '#fff0b8', C.brass] }
          : { x0: 0, x1: 640, y0: 150, y1: 352, rise: 14, drift: 16, cols: [C.fire1, C.fire2, C.fire3] });
        music(st.e.mus);
      },
      update: function (dt) {
        sparks.update(dt);
        if (DD.Input.pressed('back')) { backTo('title'); return; }
        navUpdate(nav);
      },
      draw: function (ctx) {
        var e = st.e, s = DD.save, i, t = DD.time;
        backdrop(ctx, e.bd);
        sparks.draw(ctx);
        navBegin(nav);
        var used = Math.max(0, CFG.RUN_TIME - st.timeLeft);
        // título
        var pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
        T(ctx, e.title, 322, 19, '#000', 3, 'center');
        T(ctx, e.title, 320, 16, e.color, 3, 'center');
        if (st.r === 'victory') { ctx.save(); ctx.globalAlpha = 0.3 * pulse; T(ctx, e.title, 320, 16, '#fff', 3, 'center'); ctx.restore(); }
        T(ctx, st.cause ? 'Causa: ' + st.cause : e.sub, 320, 48, C.ink, 1, 'center');
        // informe
        var PX = 50, PY = 66, PW = 540, PH = 200;
        DD.ui.panel(ctx, PX, PY, PW, PH, { title: 'INFORME DE LA RUN', alpha: 0.94 });
        var y = PY + 28;
        row(ctx, y, 'i_burn', 'Piso alcanzado', st.floor + '/' + CFG.FLOORS, C.ink); y += 14;
        row(ctx, y, 'i_clock', 'Tiempo restante', DD.fmtTime(st.timeLeft), st.r === 'victory' ? C.acid : C.ink); y += 14;
        row(ctx, y, 'i_clock', 'Tiempo usado', DD.fmtTime(used), C.dim); y += 14;
        row(ctx, y, 'i_attack', 'Enemigos derrotados', st.kills, C.ink); y += 14;
        row(ctx, y, 'i_limb', 'Injertos', st.grafts, C.ink); y += 14;
        row(ctx, y, 'i_ether', 'Éter ganado', '+' + st.gained, C.ether); y += 14;
        if (st.bonus > 0) { row(ctx, y, 'i_ether', 'Bono de escape', '+' + st.bonus, C.warn); y += 14; }
        rect(ctx, C.line, 76, y + 2, 198, 1); y += 8;
        row(ctx, y, 'i_ether', 'Saldo de Éter', shortNum(s.ether), C.ether); y += 14;
        if (st.r === 'victory' && s.bestTime != null && s.bestTime === st.timeLeft) T(ctx, '¡Mejor tiempo de escape!', 76, y + 2, C.warn);
        // planos nuevos
        rect(ctx, C.line, 286, PY + 28, 1, PH - 58);
        T(ctx, 'PLANOS NUEVOS', 298, PY + 28, C.brass);
        T(ctx, 'Códice ' + knownCount() + '/' + DD.LIMB_ORDER.length, PX + PW - 14, PY + 28, C.dim, 1, 'right');
        if (!st.bp.length) {
          var nl = wrapM('Ningún plano nuevo esta vez. Cosecha e injerta extremidades que no conozcas para anotarlas en el Códice.', 270, 1);
          for (i = 0; i < nl.length; i++) T(ctx, nl[i], 298, PY + 46 + i * 9, C.dim);
        } else {
          for (i = 0; i < st.bp.length && i < 12; i++) {
            var bx = 298 + (i % 2) * 144, by = PY + 44 + Math.floor(i / 2) * 20;
            box(ctx, bx, by, 18, 18, C.bg, C.brassDk);
            limbIcon(ctx, st.bp[i], bx + 1, by + 1, 1);
            var nm = DD.LIMBS[st.bp[i]].name;
            T(ctx, nm, bx + 22, by + 5, C.bone);
          }
        }
        T(ctx, 'Tu espíritu despertará en otra mesa, con un cuerpo base nuevo. Conservas tus planos.', PX + PW / 2, PY + PH - 16, C.ether, 1, 'center');
        // botones
        var by2 = PY + PH + 10;
        if (nbtn(nav, ctx, 'new', 60, by2, 216, 34, 'Nueva mesa de disección')) { sfx('ui'); later(function () { if (DD.Run && DD.Run.begin) DD.Run.begin(); }); }
        if (nbtn(nav, ctx, 'codex', 284, by2, 100, 34, 'Códice')) go('codex', { from: 'results' });
        if (nbtn(nav, ctx, 'shop', 392, by2, 100, 34, 'Tienda')) go('shop', { from: 'results' });
        if (nbtn(nav, ctx, 'title', 500, by2, 80, 34, 'Título')) go('title');
        flush();
      }
    };
  }

  DD.scenes.title = makeTitle();
  DD.scenes.table = makeTable();
  DD.scenes.codex = makeCodex();
  DD.scenes.shop = makeShop();
  DD.scenes.results = makeResults();
})();
