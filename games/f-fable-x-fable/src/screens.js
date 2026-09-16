// Deadlock Deck: El Reloj Anatómico — menu and interstitial screens (DD.screens).
// title, dissection, death, escape, codex, shop: each { begin(...), update(dt), draw(ctx) }.
// Immediate-mode UI: buttons and list rows are hit-tested while they are drawn.
(function () {
  'use strict';
  const ui = DD.ui;
  const COLOR = { bone: '#e6dcc4', gold: '#f2e468', dim: '#8a8494', blood: '#e03040', silhouette: '#2c2434' };
  const TYPE_NAME = { head: 'Cabeza', torso: 'Torso', arm: 'Brazo', leg: 'Pierna' };
  const TYPE_SLOT = { head: 'head', torso: 'torso', arm: 'armL', leg: 'legL' };     // slot whose colour badges a card
  const TYPES = [['head', 'Cabezas'], ['torso', 'Torsos'], ['arm', 'Brazos'], ['leg', 'Piernas']];
  const PREVIEW = {                                                                 // fixed body for cosmetic previews
    head: { id: 'cabeza_reanimada', heat: 0 }, torso: { id: 'torso_suturado', heat: 0 },
    armL: { id: 'brazo_cadaver', heat: 0 }, armR: { id: 'brazo_cadaver', heat: 0 },
    legL: { id: 'pierna_cadaver', heat: 0 }, legR: { id: 'pierna_cadaver', heat: 0 },
  };
  const HOWTO = 'Tu cuerpo es tu mazo: cada extremidad aporta sus cartas.\n' +
    'Las cartas calientan la extremidad que las juega; si se sobrecalienta, se rompe y pierdes sus cartas.\n' +
    'Cosecha extremidades de los enemigos caídos e injértalas en tu cuerpo.\n' +
    'Escapa de la torre en llamas antes de que el reloj llegue a cero: tienes 6 minutos.';

  const hover = (x, y, w, h) => DD.input.x >= x && DD.input.x < x + w && DD.input.y >= y && DD.input.y < y + h;
  const clicked = (x, y, w, h) => DD.input.clicked && hover(x, y, w, h);
  const known = id => DD.data.limbs[id].base || DD.meta.state.blueprints.includes(id);
  const limbs = () => Object.values(DD.data.limbs);
  function dim(ctx, alpha) { ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')'; ctx.fillRect(0, 0, DD.W, DD.H); }

  // Blueprint names in `cols` columns of `rows`; ids in `fresh` get a "¡nuevo!" tag.
  function blueprintList(ctx, ids, fresh, x, y, cols, rows) {
    if (!ids.length) { ui.text(ctx, 'ninguno', x, y, { color: COLOR.dim }); return; }
    ids.forEach((id, i) => {
      if (i >= cols * rows) return;
      const cx = x + Math.floor(i / rows) * 200, cy = y + (i % rows) * 11;
      if (i === cols * rows - 1 && ids.length > cols * rows) { ui.text(ctx, '+' + (ids.length - i) + ' más', cx, cy, { color: COLOR.dim }); return; }
      const name = DD.data.limbs[id].name;
      ui.text(ctx, name, cx, cy);
      if (fresh.includes(id)) ui.text(ctx, '¡nuevo!', cx + ui.textWidth(name) + 6, cy, { color: COLOR.gold });
    });
  }

  function endButtons(ctx) {
    if (ui.button(ctx, 70, 306, 300, 28, 'Nueva mesa de disección')) DD.game.newRun();
    else if (ui.button(ctx, 390, 306, 180, 28, 'Título')) DD.game.toTitle();
  }

  // ---------------------------------------------------------------------- title
  let sample = null;
  const title = {
    begin() { sample = DD.body.newBase(); },
    update() { if (DD.input.keyPressed('Enter')) DD.game.newRun(); },
    draw(ctx) {
      const m = DD.meta.state;
      ui.background(ctx, 'title');
      ui.text(ctx, 'DEADLOCK DECK', 320, 20, { size: 3, align: 'center' });
      ui.text(ctx, 'El Reloj Anatómico', 320, 48, { size: 2, align: 'center', color: COLOR.gold });
      ui.panel(ctx, 20, 78, 310, 126, { title: 'Cómo jugar' });
      ui.text(ctx, HOWTO, 30, 98, { maxWidth: 290 });
      ui.drawBody(ctx, 480, 198, sample, { scale: 3, palette: m.palette });
      if (ui.button(ctx, 60, 222, 160, 28, 'Reanimar')) return DD.game.newRun();
      if (ui.button(ctx, 240, 222, 160, 28, 'Planos')) return DD.screens.show('codex');
      if (ui.button(ctx, 420, 222, 160, 28, 'Cosméticos')) return DD.screens.show('shop');
      if (ui.button(ctx, 524, 4, 110, 16, 'Sonido: ' + (DD.audio.muted ? 'no' : 'sí'), { small: true })) {
        DD.audio.toggleMute();
        m.muted = DD.audio.muted;
        DD.meta.save();
      }
      const total = limbs().filter(l => !l.base).length;
      ui.text(ctx, 'Partidas: ' + m.runs + '   Escapes: ' + m.escapes + '   Mejor planta: ' + m.bestFloor + '/' + DD.FLOORS +
        '   Planos: ' + m.blueprints.length + '/' + total + '   Ichor: ' + m.ichor, 320, 308, { align: 'center' });
      if (m.bestTime !== null) ui.text(ctx, 'Mejor escape: ' + DD.fmtTime(m.bestTime) + ' restantes', 320, 320, { align: 'center', color: COLOR.dim });
      ui.text(ctx, 'Pulsa Intro o Reanimar para despertar en la mesa de disección', 320, 340, { align: 'center', color: COLOR.dim });
    },
  };

  // ----------------------------------------------------------------- dissection
  let selected = null, grafted = null;     // blueprint id chosen / already grafted this run
  const dissection = {
    begin() { selected = null; grafted = null; },
    update() { if (DD.input.keyPressed('Enter')) DD.game.startRun(); },
    draw(ctx) {
      const run = DD.run, bps = DD.meta.state.blueprints;
      ui.background(ctx, 'table');
      ui.text(ctx, 'Mesa de disección', 10, 6, { size: 2, color: COLOR.gold });
      ui.icon(ctx, 'clock', 566, 5);
      ui.text(ctx, DD.fmtTime(run.timeLeft), 584, 4, { size: 2, color: COLOR.gold });
      ui.drawBody(ctx, 320, 252, run.body, { scale: 3, palette: run.palette });
      ui.text(ctx, 'PV ' + run.hp + '/' + run.maxHp + '   Cartas: ' + DD.body.deck(run.body).length, 320, 272, { align: 'center' });

      // The six slots; when a blueprint is selected the fitting ones become graft targets.
      ui.panel(ctx, 372, 30, 258, 166, { title: 'Tu cuerpo' });
      DD.SLOTS.forEach((slot, i) => {
        const ry = 48 + i * 24, fits = selected && !grafted && DD.body.fits(slot, selected);
        if (fits) {
          ctx.fillStyle = hover(376, ry - 3, 250, 23) ? 'rgba(242,228,104,0.35)' : 'rgba(242,228,104,0.15)';
          ctx.fillRect(376, ry - 3, 250, 23);
          if (clicked(376, ry - 3, 250, 23)) { DD.body.graft(run, slot, selected); grafted = selected; selected = null; }
        }
        const limb = run.body[slot], def = limb && DD.data.limbs[limb.id];
        ui.text(ctx, DD.SLOT_NAME[slot], 380, ry, { color: ui.SLOT_COLOR[slot] });
        ui.text(ctx, def ? def.name + (def.hpBonus ? ' (+' + def.hpBonus + ' PV)' : '') : 'muñón', 452, ry);
        ui.text(ctx, def ? def.cards.map(c => DD.data.cards[c].name).join(', ') : DD.data.cards[DD.data.STUMP_CARD].name, 380, ry + 10, { color: COLOR.dim });
      });
      if (ui.button(ctx, 372, 206, 258, 30, 'Despertar')) return DD.game.startRun();

      // Discovered blueprints: pick one, then a fitting slot. One graft per table.
      ui.panel(ctx, 10, 30, 262, 214, { title: grafted ? 'Plano injertado' : bps.length ? 'Injertar un plano' : 'Planos' });
      if (!bps.length) ui.text(ctx, 'Aún no conoces ningún plano. Cosecha extremidades de los enemigos de la torre para descubrirlos.', 18, 52, { color: COLOR.dim, maxWidth: 246 });
      bps.forEach((id, i) => {
        const ry = 48 + i * 12, def = DD.data.limbs[id];
        if (id === selected || id === grafted) { ctx.fillStyle = 'rgba(242,228,104,0.25)'; ctx.fillRect(14, ry - 2, 254, 12); }
        else if (!grafted && hover(14, ry - 2, 254, 12)) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(14, ry - 2, 254, 12); }
        if (!grafted && clicked(14, ry - 2, 254, 12)) { selected = selected === id ? null : id; DD.audio.sfx('click'); }
        ui.text(ctx, def.name, 18, ry, { color: grafted && id !== grafted ? COLOR.dim : COLOR.bone });
        ui.text(ctx, TYPE_NAME[def.type], 264, ry, { align: 'right', color: COLOR.dim });
      });
      const status = grafted ? 'Injertado: ' + DD.data.limbs[grafted].name + '. Solo un injerto por mesa.'
        : selected ? 'Elige un hueco compatible en "Tu cuerpo" para injertar ' + DD.data.limbs[selected].name
        : bps.length ? 'Puedes injertar un plano descubierto antes de despertar.' : '';
      ui.text(ctx, status, 320, 288, { align: 'center', color: COLOR.gold, maxWidth: 600 });
      ui.text(ctx, 'El reloj no corre hasta que despiertes.   Intro: despertar', 320, 340, { align: 'center', color: COLOR.dim });
    },
  };

  // ---------------------------------------------------------------- death / escape
  let reason = '', fresh = [], bonus = 0;
  const death = {
    begin(why, newIds) { reason = why; fresh = newIds || []; },
    update() { if (DD.input.keyPressed('Enter')) DD.game.newRun(); },
    draw(ctx) {
      const run = DD.run;
      ui.background(ctx, 'lab');
      dim(ctx, 0.55);
      ui.text(ctx, reason.toUpperCase(), 320, 26, { size: 3, align: 'center', color: COLOR.blood });
      ui.panel(ctx, 110, 66, 420, 206, { title: 'Informe de autopsia' });
      ui.text(ctx, 'Planta alcanzada: ' + (run.floorIndex + 1) + '/' + DD.FLOORS, 124, 88);
      ui.text(ctx, 'Enemigos derrotados: ' + run.kills, 124, 100);
      ui.text(ctx, 'Ichor obtenido: +' + run.ichor, 124, 112);
      ui.text(ctx, 'Planos descubiertos en esta partida:', 124, 128, { color: COLOR.gold });
      blueprintList(ctx, run.discovered, fresh, 124, 140, 2, 6);
      ui.text(ctx, 'Tu espíritu regresa a la mesa de disección...', 320, 284, { align: 'center', color: COLOR.dim });
      endButtons(ctx);
    },
  };

  const escape = {
    begin(ichorBonus, newIds) { bonus = ichorBonus; fresh = newIds || []; },
    update() { if (DD.input.keyPressed('Enter')) DD.game.newRun(); },
    draw(ctx) {
      const run = DD.run;
      ui.background(ctx, 'roof');
      ui.text(ctx, 'HAS ESCAPADO DE LA TORRE', 320, 26, { size: 3, align: 'center', color: COLOR.gold });
      ui.panel(ctx, 110, 66, 420, 206, { title: 'Libertad' });
      ui.text(ctx, 'Tiempo restante: ' + DD.fmtTime(run.timeLeft), 124, 88);
      ui.text(ctx, 'Enemigos derrotados: ' + run.kills, 124, 100);
      ui.text(ctx, 'Ichor de la torre: +' + run.ichor + '   Bonificación por tiempo: +' + bonus, 124, 112);
      ui.text(ctx, 'Planos descubiertos en esta partida:', 124, 128, { color: COLOR.gold });
      blueprintList(ctx, run.discovered, fresh, 124, 140, 2, 6);
      ui.text(ctx, 'El amanecer quema tus suturas, pero eres libre.', 320, 284, { align: 'center', color: COLOR.dim });
      endButtons(ctx);
    },
  };

  // ---------------------------------------------------------------------- codex
  let detail = null;                       // limb id shown in the detail overlay
  function drawDetail(ctx, id) {
    const l = DD.data.limbs[id];
    dim(ctx, 0.5);
    ui.panel(ctx, 90, 40, 460, 280, { title: l.name });
    ui.text(ctx, l.desc, 104, 62, { maxWidth: 432 });
    ui.text(ctx, TYPE_NAME[l.type] + '   Calor máx. ' + l.maxHeat + (l.hpBonus ? '   +' + l.hpBonus + ' PV máx.' : '') +
      '   Origen: ' + (l.source ? DD.data.enemies[l.source].name : 'cuerpo base'), 104, 84, { color: COLOR.dim, maxWidth: 432 });
    l.cards.forEach((c, i) => ui.drawCard(ctx, DD.data.cards[c], 204 + i * 80, 104, { slot: TYPE_SLOT[l.type] }));
    if (ui.button(ctx, 260, 280, 120, 26, 'Cerrar')) detail = null;
  }

  const codex = {
    begin() { detail = null; },
    update() { if (DD.input.keyPressed('Escape')) { if (detail) detail = null; else DD.game.toTitle(); } },
    draw(ctx) {
      const m = DD.meta.state, all = limbs();
      ui.background(ctx, 'lab');
      dim(ctx, 0.35);
      ui.text(ctx, 'Planos anatómicos', 10, 6, { size: 2, color: COLOR.gold });
      ui.text(ctx, 'Conocidos: ' + all.filter(l => known(l.id)).length + '/' + all.length, 630, 10, { align: 'right' });
      TYPES.forEach(([type, label], r) => {
        const y = 32 + r * 62;
        ui.text(ctx, label, 8, y + 24, { color: COLOR.dim });
        all.filter(l => l.type === type).forEach((l, c) => {
          const x = 56 + c * 82, k = known(l.id), spr = DD.sprites.index[l.id];
          ctx.fillStyle = k && !detail && hover(x, y, 80, 58) ? 'rgba(242,228,104,0.18)' : 'rgba(20,16,26,0.6)';
          ctx.fillRect(x, y, 80, 58);
          ui.sprite(ctx, l.id, x + 40 - spr.w, y + 3 + (28 - spr.h * 2) / 2, { scale: 2, palette: m.palette, tint: k ? undefined : COLOR.silhouette });
          ui.text(ctx, k ? l.name : '???', x + 40, y + 34, { align: 'center', color: k ? COLOR.bone : COLOR.dim, maxWidth: 78 });
          if (k && !detail && clicked(x, y, 80, 58)) { detail = l.id; DD.audio.sfx('click'); }
        });
      });
      ui.text(ctx, 'Pulsa un plano conocido para ver sus cartas', 320, 284, { align: 'center', color: COLOR.dim });
      if (!detail && ui.button(ctx, 250, 302, 140, 28, 'Volver')) return DD.game.toTitle();
      if (detail) drawDetail(ctx, detail);
    },
  };

  // ----------------------------------------------------------------------- shop
  const shop = {
    begin() {},
    update() { if (DD.input.keyPressed('Escape')) DD.game.toTitle(); },
    draw(ctx) {
      const m = DD.meta.state;
      ui.background(ctx, 'lab');
      dim(ctx, 0.35);
      ui.text(ctx, 'Cosméticos', 10, 6, { size: 2, color: COLOR.gold });
      ui.text(ctx, String(m.ichor), 608, 4, { size: 2, align: 'right', color: COLOR.gold });
      ui.icon(ctx, 'ichor', 614, 5);
      DD.data.palettes.forEach((p, i) => {
        const x = 20 + i * 152, y = 36, inUse = m.palette === p.id, usable = DD.meta.canUsePalette(p.id);
        ui.panel(ctx, x, y, 140, 212, { title: p.name, color: inUse ? COLOR.gold : undefined });
        ui.drawBody(ctx, x + 70, y + 108, PREVIEW, { scale: 2, palette: p.id });
        let status, label, enabled = true, action = null;
        if (inUse) { status = 'Aspecto actual'; label = 'En uso'; enabled = false; }
        else if (usable) { status = p.price ? 'Comprado' : 'Desbloqueado'; label = 'Usar'; action = () => { m.palette = p.id; DD.meta.save(); }; }
        else if (p.price > 0) { status = 'Precio: ' + p.price + ' Ichor'; label = 'Comprar (' + p.price + ' Ichor)'; enabled = m.ichor >= p.price; action = () => { if (DD.meta.buyPalette(p.id)) { m.palette = p.id; DD.meta.save(); } }; }
        else { status = 'Se desbloquea con ' + p.unlock + ' planos (' + m.blueprints.length + '/' + p.unlock + ')'; label = p.unlock + ' planos'; enabled = false; }
        ui.text(ctx, status, x + 70, y + 120, { align: 'center', color: COLOR.dim, maxWidth: 128 });
        if (ui.button(ctx, x + 10, y + 176, 120, 26, label, { disabled: !enabled }) && action) action();
      });
      ui.text(ctx, 'Microtransacciones simuladas: se pagan con Ichor obtenido en la torre; no hay pagos reales.', 320, 262, { align: 'center', color: COLOR.dim, maxWidth: 560 });
      if (ui.button(ctx, 250, 302, 140, 28, 'Volver')) return DD.game.toTitle();
    },
  };

  DD.screens = {
    title, dissection, death, escape, codex, shop,
    show(name, ...args) { const s = DD.screens[name]; s.begin(...args); DD.setScreen(s); },
  };
})();
