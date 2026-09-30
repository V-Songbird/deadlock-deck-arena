/* meta.js — game flow, HUD and the title/table/loopEnd/victory/codex/shop scenes (contract §4). */
(function () {
  'use strict';
  const DD = window.DD;
  const PAL = DD.PAL;
  const D = DD.draw;

  DD.CONFIG = { runSeconds: 360, floors: 3 };
  DD.run = null;
  DD.game = DD.game || {};
  DD.ui = DD.ui || {};
  DD.paused = false;

  // ------------------------------------------------------------ small helpers
  function sv() { return DD.save.data; }
  function sfx(n) { if (DD.audio && DD.audio.sfx) DD.audio.sfx(n); }
  function music(m) { if (DD.audio && DD.audio.music) DD.audio.music(m); }
  function icon(name, x, y, s) {
    if (DD.sprites && DD.sprites.icon) DD.sprites.icon(DD.ctx, name, x, y, s || 1);
  }
  function limbIcon(id, x, y, s) {
    if (DD.sprites && DD.sprites.limbIcon) DD.sprites.limbIcon(DD.ctx, id, x, y, s || 1);
  }
  function background(kind, t) {
    if (DD.sprites && DD.sprites.background) DD.sprites.background(DD.ctx, kind, t);
    else { D.rect(0, 0, DD.W, DD.H, PAL.bg); }
  }
  function dim(a) { D.rect(0, 0, DD.W, DD.H, 'rgba(6,4,10,' + a + ')'); }
  function fmtTime(t) {
    t = Math.max(0, Math.ceil(t));
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  }
  function hex2rgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function mix(a, b, t) {
    const x = hex2rgb(a), y = hex2rgb(b);
    return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) +
      ',' + Math.round(x[2] + (y[2] - x[2]) * t) + ')';
  }
  function sgn(n) { return (n > 0 ? '+' : '') + n; }
  function passiveText(p) {
    if (!p) return 'sin pasivo';
    const o = [];
    if (p.maxHp) o.push(sgn(p.maxHp) + ' PV máx.');
    if (p.draw) o.push(sgn(p.draw) + ' robo');
    if (p.energy) o.push(sgn(p.energy) + ' energía');
    if (p.vision) o.push(sgn(p.vision) + ' visión');
    if (p.speed) o.push(sgn(Math.round(p.speed * 100)) + '% velocidad');
    if (p.cool) o.push(sgn(p.cool) + ' enfriamiento');
    return o.length ? o.join(', ') : 'sin pasivo';
  }
  function limbIds() { return Object.keys(DD.LIMBS || {}); }
  function limbName(id) { return DD.LIMBS[id] ? DD.LIMBS[id].name : id; }
  function cardName(id) { return DD.CARDS && DD.CARDS[id] ? DD.CARDS[id].name : id; }
  function blueprintCount() {
    const b = sv().blueprints;
    return limbIds().filter(function (id) { return b[id]; }).length;
  }
  function blueprintsOfType(type) {
    const b = sv().blueprints;
    return limbIds().filter(function (id) { return DD.LIMBS[id].slot === type && b[id]; });
  }
  function graftSlots() {
    const n = blueprintCount();
    return n > 0 ? Math.min(3, 1 + Math.floor(n / 4)) : 0;
  }
  function unlockedBodies() {
    const o = sv().owned;
    return (DD.BASE_BODIES || []).filter(function (b) { return b.unlock === 'free' || o[b.id]; });
  }
  function toggleMute() {
    const d = sv();
    d.muted = !d.muted;
    if (DD.audio && DD.audio.setMuted) DD.audio.setMuted(d.muted);
    DD.save.write();
  }
  DD.game.toggleMute = toggleMute;

  // ------------------------------------------------------------ game flow
  function pickHarvest(enemyId) {
    const e = DD.ENEMIES[enemyId];
    const pool = ((e && e.limbs) || []).filter(function (id) { return DD.LIMBS[id]; });
    const uniq = pool.filter(function (id, i) { return pool.indexOf(id) === i; });
    const rng = (DD.run && DD.run.rng) || DD.rand;
    rng.shuffle(uniq);
    let out = uniq.slice(0, 3);
    if (!out.length) { const all = limbIds(); if (all.length) out = [rng.pick(all)]; }
    return out;
  }

  DD.game.last = null;

  DD.game.newRun = function (bodyInit) {
    bodyInit = bodyInit || {};
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    const body = DD.body.create(bodyInit.baseId);
    const grafts = bodyInit.grafts || {};
    for (const slot in grafts) if (grafts[slot]) DD.body.graft(body, slot, grafts[slot]);
    DD.paused = false;
    DD.fx.clear();
    DD.run = {
      active: true, timeLeft: DD.CONFIG.runSeconds, floor: 1, body: body, seed: seed,
      rng: DD.RNG(seed), ether: 0, kills: 0, loop: sv().loops + 1, currentEnemy: null,
      map: null, log: [], bossDead: false, newBlueprints: []
    };
    music('explore');
    DD.setScene('explore', { newFloor: true });
  };

  DD.game.startCombat = function (entity) {
    if (!DD.run) return;
    DD.run.currentEnemy = entity;
    DD.setScene('combat', { enemyId: entity.enemyId });
  };

  DD.game.combatWon = function (enemyId) {
    const run = DD.run;
    if (!run) return;
    const e = DD.ENEMIES[enemyId] || {};
    const eth = e.ether || 0;
    run.kills++;
    run.ether += eth;
    if (run.currentEnemy) run.currentEnemy.dead = true;
    if (e.boss) run.bossDead = true;
    if (eth) DD.fx.float('+' + eth + ' Éter', 320, 70, PAL.verdigris);
    run.log.push('Derrotado: ' + (e.name || enemyId));
    DD.setScene('harvest', { limbs: pickHarvest(enemyId), source: 'enemy', enemyId: enemyId });
  };

  DD.game.openJar = function (limbId) {
    DD.setScene('harvest', { limbs: [limbId], source: 'jar' });
  };

  DD.game.returnToExplore = function () {
    DD.setScene('explore', { newFloor: false });
    if (DD.run) DD.run.currentEnemy = null;
  };

  DD.game.discover = function (limbId) {
    const d = sv();
    if (d.blueprints[limbId]) return false;
    d.blueprints[limbId] = true;
    if (DD.run && DD.run.newBlueprints) DD.run.newBlueprints.push(limbId);
    DD.save.write();
    return true;
  };

  DD.game.nextFloor = function () {
    const run = DD.run;
    if (!run || !run.active) return;
    run.floor++;
    if (run.floor > DD.CONFIG.floors) { DD.game.escape(); return; }
    sfx('door');
    DD.setScene('explore', { newFloor: true });
  };

  function summary(reason, banked, extra) {
    const run = DD.run;
    const s = {
      reason: reason,
      elapsed: DD.CONFIG.runSeconds - run.timeLeft,
      kills: run.kills,
      ether: run.ether,
      banked: banked,
      floor: Math.min(run.floor, DD.CONFIG.floors),
      loop: run.loop,
      newBlueprints: (run.newBlueprints || []).slice()
    };
    for (const k in (extra || {})) s[k] = extra[k];
    return s;
  }

  DD.game.escape = function () {
    const run = DD.run;
    if (!run || !run.active) return;
    const d = sv();
    const used = DD.CONFIG.runSeconds - run.timeLeft;
    const bonus = 25;
    const banked = run.ether + bonus;
    d.escapes++; d.loops++;
    d.ether += banked;
    const newBest = d.bestTime == null || used < d.bestTime;
    if (newBest) d.bestTime = used;
    DD.game.last = summary('escape', banked, { bonus: bonus, newBest: newBest });
    run.active = false;
    DD.paused = false;
    DD.save.write();
    DD.setScene('victory');
  };

  DD.game.endLoop = function (reason) {
    const run = DD.run;
    if (!run || !run.active) return;
    const d = sv();
    d.loops++;
    if (reason === 'time') d.timeouts++; else d.deaths++;
    const banked = Math.floor(run.ether * 0.5);
    d.ether += banked;
    DD.game.last = summary(reason || 'death', banked);
    run.active = false;
    DD.paused = false;
    DD.save.write();
    DD.setScene('loopEnd', { reason: reason || 'death' });
  };

  // ------------------------------------------------------------ HUD
  function heatColor(h, t) {
    if (h < 35) return PAL.cold;
    if (h < 70) return PAL.fire;
    if (h < 90) return PAL.ember;
    return Math.sin(t * 14) > 0 ? PAL.heat : PAL.bloodLight;
  }

  DD.ui.drawHUD = function (ctx) {
    const run = DD.run;
    if (!run) return;
    const body = run.body;
    const t = performance.now() / 1000;
    const low = run.timeLeft < 60;
    const pulse = 0.5 + 0.5 * Math.sin(t * 8);

    D.rect(0, 0, DD.W, 24, '#0a070d');
    D.rect(0, 0, DD.W, 1, '#2a2020');
    D.rect(0, 23, DD.W, 1, '#000');
    D.rect(0, 24, DD.W, 1, PAL.brassDark);
    if (low) D.rect(0, 0, 76, 24, 'rgba(163,32,42,' + (0.15 + 0.3 * pulse).toFixed(2) + ')');

    // anatomical clock
    icon(low ? 'clock' : 'gear', 4, 4, 2);
    D.text(fmtTime(run.timeLeft), 24, 4, { size: 16, color: low ? mix(PAL.blood, PAL.bloodLight, pulse) : PAL.ink });

    // HP
    if (body) {
      const frac = body.maxHp > 0 ? body.hp / body.maxHp : 0;
      icon('heart', 76, 8, 1);
      D.bar(86, 7, 84, 10, frac, frac < 0.3 ? PAL.bloodLight : PAL.blood);
      D.text(Math.ceil(body.hp) + '/' + body.maxHp, 128, 8, { size: 8, align: 'center' });
    }

    // floor + ether
    D.text('Piso ' + run.floor + '/' + DD.CONFIG.floors, 178, 3, { size: 8, color: PAL.brass });
    icon('ether', 178, 14, 1);
    D.text('Éter ' + run.ether, 188, 13, { size: 8, color: PAL.verdigris });

    // body strip
    if (!body) return;
    let tip = null;
    for (let i = 0; i < DD.SLOTS.length; i++) {
      const slot = DD.SLOTS[i];
      const x = 250 + i * 64, y = 1, w = 62, h = 22;
      const inst = body.slots[slot];
      D.rect(x, y, w, h, inst ? '#17111a' : '#2a0e12');
      D.stroke(x, y, w, h, inst ? '#3a2c22' : '#5a1a20');
      if (inst) {
        icon(DD.SLOT_TYPE[slot], x + 3, y + 3, 1);
        const maxI = inst.maxIntegrity || inst.integrity || 1;
        for (let k = 0; k < maxI; k++) {
          D.rect(x + 13 + k * 5, y + 4, 4, 4,
            k < inst.integrity ? (inst.integrity === 1 ? PAL.bloodLight : PAL.brass) : '#3a2c22');
        }
        D.bar(x + 3, y + 13, 56, 6, inst.heat / 100, heatColor(inst.heat, t), '#221418');
      } else {
        icon('stump', x + 3, y + 3, 1);
        D.text('muñón', x + 14, y + 4, { size: 8, color: PAL.bloodLight });
        ctx.save();
        ctx.strokeStyle = 'rgba(224,72,72,0.75)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + w - 2, y + h - 2);
        ctx.moveTo(x + w - 2, y + 2); ctx.lineTo(x + 2, y + h - 2); ctx.stroke();
        ctx.restore();
      }
      if (DD.input.mouseIn(x, y, w, h)) {
        tip = { x: x, text: DD.SLOT_NAME[slot] + ': ' + (inst ? limbName(inst.id) + ' · Calor ' + Math.round(inst.heat) +
          ' · Integ. ' + inst.integrity + '/' + inst.maxIntegrity : 'muñón (sin miembro)') };
      }
    }
    if (tip) {
      const tw = D.textWidth(tip.text, 8) + 10;
      const tx = DD.clamp(tip.x - tw / 2 + 31, 2, DD.W - tw - 2);
      D.panel(tx, 27, tw, 16, { rivets: false });
      D.text(tip.text, tx + 5, 32, { size: 8 });
    }
  };

  // ------------------------------------------------------------ decorative drawing
  function drawFlames(ctx, t, height, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let x = 0; x < DD.W; x += 8) {
      const h = height * (0.5 + 0.28 * Math.sin(t * 5 + x * 0.31) + 0.22 * Math.sin(t * 9 + x * 0.73));
      ctx.fillStyle = PAL.blood; ctx.fillRect(x, DD.H - h, 8, h);
      ctx.fillStyle = PAL.ember; ctx.fillRect(x + 1, DD.H - h * 0.7, 6, h * 0.7);
      ctx.fillStyle = PAL.fire; ctx.fillRect(x + 2, DD.H - h * 0.4, 4, h * 0.4);
    }
    ctx.restore();
  }

  function drawClockFace(ctx, cx, cy, r, t) {
    ctx.save();
    ctx.translate(cx, cy);
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    ctx.fillStyle = 'rgba(163,32,42,' + (0.12 + 0.12 * pulse).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(0, 0, r + 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#120d16'; ctx.strokeStyle = PAL.brass; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = PAL.brassDark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = PAL.brass; ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6));
      ctx.lineTo(Math.cos(a) * (r - (i % 3 === 0 ? 14 : 10)), Math.sin(a) * (r - (i % 3 === 0 ? 14 : 10)));
      ctx.stroke();
    }
    ctx.lineCap = 'round';
    const ha = t * 0.15 - Math.PI / 2, ma = t * 1.2 - Math.PI / 2;
    ctx.strokeStyle = PAL.bone; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ha) * r * 0.5, Math.sin(ha) * r * 0.5); ctx.stroke();
    ctx.strokeStyle = PAL.bloodLight; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ma) * r * 0.78, Math.sin(ma) * r * 0.78); ctx.stroke();
    ctx.fillStyle = PAL.brass; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawGear(ctx, cx, cy, r, t, dir) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(t * 0.4 * dir);
    ctx.fillStyle = PAL.brassDark; ctx.strokeStyle = PAL.brass; ctx.lineWidth = 2;
    const teeth = 12;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a = i * Math.PI / teeth;
      const rr = (i % 2 === 0) ? r : r * 0.82;
      const a0 = a - Math.PI / teeth / 2 * 0.9, a1 = a + Math.PI / teeth / 2 * 0.9;
      ctx.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
      ctx.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#120d16';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------ title
  DD.scenes.title = (function () {
    let t = 0;
    const ms = { focus: 0 };
    return {
      enter: function () { t = 0; ms.focus = 0; DD.run = null; music('title'); },
      update: function (dt) { t += dt; },
      draw: function (ctx) {
        background('title', t);
        drawFlames(ctx, t, 30, 0.6);
        drawClockFace(ctx, 96, 190, 46, t);
        drawGear(ctx, 548, 190, 44, t, -1);
        drawGear(ctx, 590, 236, 24, t, 1);

        D.text('DEADLOCK DECK', 320, 24, { size: 24, align: 'center', color: PAL.brass });
        D.text('EL RELOJ ANATÓMICO', 320, 54, { size: 16, align: 'center', color: mix(PAL.blood, PAL.bloodLight, 0.5 + 0.5 * Math.sin(t * 2.4)) });
        D.rect(0, 78, DD.W, 16, 'rgba(8,4,10,0.6)');
        D.text('Seis minutos. Una torre en llamas. Tu cuerpo es tu mazo.', 320, 82, { size: 8, align: 'center', color: PAL.bone });

        const muted = sv().muted;
        const items = [
          { label: 'Jugar', x: 240, y: 118, w: 160, h: 28, size: 12, color: PAL.fire },
          { label: 'Planos anatómicos', x: 240, y: 152, w: 160, h: 28 },
          { label: 'Tienda', x: 240, y: 186, w: 160, h: 28 },
          { label: muted ? 'Sonido: no' : 'Sonido: sí', x: 240, y: 220, w: 160, h: 28 }
        ];
        const a = DD.ui.menu(ms, items);

        const d = sv();
        D.rect(0, 264, DD.W, 16, 'rgba(8,4,10,0.6)');
        D.rect(0, 292, DD.W, 28, 'rgba(8,4,10,0.6)');
        D.text('Bucles: ' + d.loops + '  ·  Fugas: ' + d.escapes + '  ·  Mejor tiempo: ' +
          (d.bestTime != null ? fmtTime(d.bestTime) : '--:--') + '  ·  Éter: ' + d.ether,
          320, 268, { size: 8, align: 'center', color: PAL.bone });
        D.text('WASD/Flechas: mover · Enter/Espacio: aceptar · 1-9: cartas · E: fin de turno · P/Esc: pausa',
          320, 296, { size: 8, align: 'center', color: PAL.bone });
        D.text('Ratón, pantalla táctil y mando compatibles', 320, 308, { size: 8, align: 'center', color: PAL.bone });

        if (a === 0) DD.setScene('table', { fresh: true });
        else if (a === 1) DD.setScene('codex', { back: 'title' });
        else if (a === 2) DD.setScene('shop', { back: 'title' });
        else if (a === 3) toggleMute();
      }
    };
  })();

  // ------------------------------------------------------------ dissection table
  DD.scenes.table = (function () {
    let t = 0, st = null, body = null, dirty = true;
    let intro = false, introSeen = false;
    const ms = { focus: 0 }, mm = { focus: 0 }, mi = { focus: 0 };
    const PER_PAGE = 8;

    function rebuild() {
      body = null;
      try {
        body = DD.body.create(st.baseId);
        for (let i = 0; i < DD.SLOTS.length; i++) {
          const s = DD.SLOTS[i];
          if (st.grafts[s] && DD.LIMBS[st.grafts[s]]) DD.body.graft(body, s, st.grafts[s]);
        }
      } catch (e) { console.error(e); }
      dirty = false;
    }
    function graftCount() { return Object.keys(st.grafts).length; }
    function bodyById(id) { return (DD.BASE_BODIES || []).filter(function (b) { return b.id === id; })[0]; }

    function deckLine(slot) {
      const def = body ? DD.body.limbDef(body, slot) : null;
      let names;
      if (def) names = def.cards.map(cardName).join(', ');
      else { const id = DD.STUMPS && DD.STUMPS[DD.SLOT_TYPE[slot]]; names = '(muñón) ' + (id ? cardName(id) : ''); }
      return DD.SLOT_NAME[slot] + ': ' + names;
    }

    function drawModal(ctx) {
      const slot = st.modal.slot, type = DD.SLOT_TYPE[slot];
      const list = blueprintsOfType(type);
      const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
      st.modal.page = DD.clamp(st.modal.page, 0, pages - 1);
      D.panel(50, 34, 540, 296);
      D.text('PLANOS: ' + DD.SLOT_NAME[slot].toUpperCase(), 320, 42, { size: 12, align: 'center', color: PAL.brass });
      D.text('Elige un plano anatómico para injertar en este hueco.', 320, 58, { size: 8, align: 'center', color: PAL.dim });
      const items = [], cells = [];
      const first = st.modal.page * PER_PAGE;
      for (let i = 0; i < PER_PAGE && first + i < list.length; i++) {
        const id = list[first + i];
        const it = { x: 60 + (i % 2) * 264, y: 72 + Math.floor(i / 2) * 58, w: 254, h: 54, label: '', id: id };
        items.push(it); cells.push(it);
      }
      const nCells = items.length;
      items.push({ label: 'Sin injerto (cuerpo base)', x: 60, y: 300, w: 200, h: 24, size: 8, disabled: !st.grafts[slot] });
      items.push({ label: '<', x: 280, y: 300, w: 30, h: 24, disabled: st.modal.page <= 0 });
      items.push({ label: '>', x: 360, y: 300, w: 30, h: 24, disabled: st.modal.page >= pages - 1 });
      items.push({ label: 'Cerrar', x: 490, y: 300, w: 90, h: 24 });
      const a = DD.ui.menu(mm, items);
      D.text((st.modal.page + 1) + '/' + pages, 335, 306, { size: 8, align: 'center', color: PAL.dim });
      for (let i = 0; i < nCells; i++) {
        const c = cells[i], def = DD.LIMBS[c.id];
        limbIcon(c.id, c.x + 8, c.y + 11, 2);
        D.text(def.name, c.x + 48, c.y + 7, { size: 10, color: st.grafts[slot] === c.id ? PAL.fire : PAL.ink });
        D.text('Integ. ' + def.integrity + ' · ' + passiveText(def.passive), c.x + 48, c.y + 21, { size: 8, color: PAL.bone });
        let cl = def.cards.map(cardName).join(', ');
        if (cl.length > 40) { cl = cl.slice(0, 39); cl = cl.slice(0, Math.max(cl.lastIndexOf(','), 10)) + '…'; }
        D.text(cl, c.x + 48, c.y + 33, { size: 8, color: PAL.dim });
        if (st.grafts[slot] === c.id) D.text('EN USO', c.x + c.w - 6, c.y + 7, { size: 8, align: 'right', color: PAL.ember });
      }
      if (!list.length) D.text('Aún no conoces ningún plano de este tipo.', 320, 150, { size: 10, align: 'center', color: PAL.dim });
      if (a >= 0) {
        if (a < nCells) {
          st.grafts[slot] = cells[a].id; dirty = true; st.modal = null; sfx('graft');
        } else if (a === nCells) { delete st.grafts[slot]; dirty = true; st.modal = null; }
        else if (a === nCells + 1) st.modal.page--;
        else if (a === nCells + 2) st.modal.page++;
        else st.modal = null;
      }
    }

    function drawIntro() {
      D.panel(80, 50, 480, 250);
      D.text('DESPIERTAS…', 320, 64, { size: 16, align: 'center', color: PAL.bloodLight });
      const lines = [
        'Has sido reanimado sobre una mesa de disección. La torre alquímica arde y se derrumba a tu alrededor.',
        'Tienes exactamente 6 minutos para escapar de su laberinto, que no deja de cambiar.',
        'Derrota monstruos y científicos, cosecha sus miembros e injértalos: tu cuerpo es tu mazo de cartas.',
        'Si mueres o el reloj se agota, tu espíritu despierta en una nueva mesa con otro cuerpo. Conservas los planos anatómicos.'
      ];
      let y = 92;
      for (let i = 0; i < lines.length; i++) y += D.textWrap(lines[i], 104, y, 432, { size: 10, color: i === 1 ? PAL.fire : PAL.ink }) + 8;
      const a = DD.ui.menu(mi, [{ label: 'Entendido', x: 250, y: 256, w: 140, h: 30, size: 12 }]);
      if (a === 0) { intro = false; introSeen = true; }
    }

    return {
      enter: function (p) {
        p = p || {};
        t = 0; DD.run = null;
        music('table');
        const unl = unlockedBodies();
        if (p.fresh || !st) {
          st = { baseId: unl.length ? DD.rand.pick(unl).id : (DD.BASE_BODIES[0] && DD.BASE_BODIES[0].id), grafts: {}, modal: null };
          if (sv().loops === 0 && !introSeen) intro = true;
          ms.focus = 0; dirty = true;
        }
        if (!unl.some(function (b) { return b.id === st.baseId; }) && unl.length) { st.baseId = unl[0].id; dirty = true; }
        st.modal = null;
        dirty = true;
      },
      update: function (dt) {
        t += dt;
        if (st && st.modal && DD.input.hit('cancel')) { DD.input.consume('cancel'); st.modal = null; }
      },
      draw: function (ctx) {
        background('table', t);
        if (!st) return;
        if (dirty) rebuild();
        const d = sv();
        const drawDoll = function () {
          if (body && DD.sprites && DD.sprites.drawBody) {
            DD.sprites.drawBody(ctx, body, 320, 272, 3, t, { skin: d.skin, highlight: st.modal ? st.modal.slot : undefined });
          }
        };
        if (intro) {
          dim(0.55); drawDoll(); drawIntro(); return;
        }
        if (st.modal) {
          dim(0.5); drawDoll(); drawModal(ctx); return;
        }

        D.rect(120, 2, 400, 34, 'rgba(8,4,10,0.7)');
        D.text('MESA DE DISECCIÓN', 320, 6, { size: 16, align: 'center', color: PAL.brass });
        D.text('Bucle ' + (d.loops + 1) + ' · un nuevo cuerpo base te espera', 320, 25, { size: 8, align: 'center', color: PAL.dim });

        // left panel: base body + deck
        D.panel(6, 38, 206, 270);
        D.text('CUERPO BASE', 109, 45, { size: 8, align: 'center', color: PAL.brass });
        const unl = unlockedBodies();
        const items = [];
        const idx = Math.max(0, unl.map(function (b) { return b.id; }).indexOf(st.baseId));
        items.push({ label: '<', x: 12, y: 56, w: 24, h: 22, disabled: unl.length < 2, key: 'prev' });
        items.push({ label: '>', x: 182, y: 56, w: 24, h: 22, disabled: unl.length < 2, key: 'next' });
        const base = bodyById(st.baseId);
        D.text(base ? base.name : '?', 109, 62, { size: 10, align: 'center', color: PAL.ink });
        if (base) D.textWrap(base.desc || '', 14, 84, 192, { size: 8, color: PAL.dim });
        D.text('MAZO (' + (body ? DD.body.deck(body).length : 0) + ' cartas)', 109, 128, { size: 8, align: 'center', color: PAL.brass });
        let y = 141;
        for (let i = 0; i < DD.SLOTS.length; i++) {
          const s = DD.SLOTS[i];
          y += D.textWrap(deckLine(s), 14, y, 192, { size: 8, color: st.grafts[s] ? PAL.fire : PAL.ink }) + 3;
        }

        // right panel: blueprints
        D.panel(428, 38, 206, 270);
        D.text('PLANOS ANATÓMICOS', 531, 45, { size: 8, align: 'center', color: PAL.brass });
        const gs = graftSlots(), used = graftCount();
        D.text('Injertos: ' + used + '/' + gs, 531, 58, { size: 8, align: 'center', color: gs ? PAL.fire : PAL.dim });
        if (gs === 0) {
          D.textWrap('Aún no conoces ningún plano. Cosecha miembros en la torre: quedan registrados para siempre y podrás injertarlos al despertar.',
            438, 76, 186, { size: 8, color: PAL.dim });
        } else {
          for (let i = 0; i < DD.SLOTS.length; i++) {
            const s = DD.SLOTS[i];
            const g = st.grafts[s];
            const avail = blueprintsOfType(DD.SLOT_TYPE[s]).length;
            items.push({
              label: DD.SLOT_NAME[s] + ': ' + (g ? limbName(g) : 'base'), size: 8,
              x: 434, y: 72 + i * 24, w: 194, h: 20, key: 'slot', slot: s,
              color: g ? PAL.fire : undefined, disabled: !avail || (!g && used >= gs)
            });
          }
        }
        D.text('Planos descubiertos: ' + blueprintCount() + '/' + limbIds().length, 531, 224, { size: 8, align: 'center', color: PAL.bone });
        D.text('Éter: ' + d.ether, 531, 238, { size: 8, align: 'center', color: PAL.verdigris });
        items.push({ label: 'Planos', x: 434, y: 256, w: 94, h: 22, key: 'codex' });
        items.push({ label: 'Tienda', x: 534, y: 256, w: 94, h: 22, key: 'shop' });

        drawDoll();

        items.push({ label: '¡DESPERTAR!', x: 232, y: 314, w: 176, h: 36, size: 16, color: PAL.fire, key: 'go' });
        items.push({ label: 'Título', x: 6, y: 322, w: 80, h: 28, size: 8, key: 'title' });
        items.push({ label: d.muted ? 'Sonido: no' : 'Sonido: sí', x: 554, y: 322, w: 80, h: 28, size: 8, key: 'mute' });

        const a = DD.ui.menu(ms, items);
        if (a < 0) return;
        const it = items[a];
        if (it.key === 'prev' || it.key === 'next') {
          const n = unl.length;
          st.baseId = unl[(idx + (it.key === 'next' ? 1 : n - 1)) % n].id; dirty = true;
        } else if (it.key === 'slot') { st.modal = { slot: it.slot, page: 0 }; mm.focus = 0; }
        else if (it.key === 'codex') DD.setScene('codex', { back: 'table' });
        else if (it.key === 'shop') DD.setScene('shop', { back: 'table' });
        else if (it.key === 'title') { st = null; DD.setScene('title'); }
        else if (it.key === 'mute') toggleMute();
        else if (it.key === 'go') {
          const init = { baseId: st.baseId, grafts: Object.assign({}, st.grafts) };
          st = null;
          DD.game.newRun(init);
        }
      }
    };
  })();

  // ------------------------------------------------------------ loop end
  DD.scenes.loopEnd = (function () {
    let t = 0, reason = 'death';
    const ms = { focus: 0 };
    return {
      enter: function (p) {
        t = 0; ms.focus = 0; reason = (p && p.reason) || 'death';
        music('silence');
        sfx('death');
        DD.fx.flash(PAL.blood, 0.6);
      },
      update: function (dt) { t += dt; },
      draw: function (ctx) {
        background('lab', t);
        dim(0.65);
        const s = DD.game.last || { elapsed: 0, kills: 0, ether: 0, banked: 0, floor: 1, newBlueprints: [] };
        const title = reason === 'time' ? 'EL RELOJ SE DETUVO' : (reason === 'abandon' ? 'HAS ABANDONADO EL CUERPO' : 'HAS MUERTO');
        D.text(title, 320, 30, { size: 24, align: 'center', color: PAL.bloodLight });
        D.text('Tu espíritu viaja a una nueva mesa de disección…', 320, 64, { size: 10, align: 'center', color: PAL.dim });
        D.panel(150, 92, 340, 178);
        const rows = [
          ['Tiempo sobrevivido', fmtTime(s.elapsed)],
          ['Piso alcanzado', s.floor + '/' + DD.CONFIG.floors],
          ['Enemigos derrotados', String(s.kills)],
          ['Éter recogido', String(s.ether)],
          ['Éter depositado (50%)', String(s.banked)]
        ];
        for (let i = 0; i < rows.length; i++) {
          D.text(rows[i][0], 168, 106 + i * 15, { size: 10, color: PAL.bone });
          D.text(rows[i][1], 472, 106 + i * 15, { size: 10, align: 'right', color: PAL.fire });
        }
        D.rect(166, 184, 308, 1, PAL.brassDark);
        const nb = s.newBlueprints || [];
        D.text('Planos anatómicos descubiertos: ' + nb.length, 168, 192, { size: 10, color: PAL.brass });
        if (nb.length) D.textWrap(nb.map(limbName).join(', '), 168, 208, 304, { size: 8, color: PAL.ink });
        else D.text('Ninguno esta vez. La torre guarda sus secretos.', 168, 208, { size: 8, color: PAL.dim });
        const a = DD.ui.menu(ms, [{ label: 'Continuar', x: 250, y: 290, w: 140, h: 32, size: 12, color: PAL.fire }]);
        if (a === 0) DD.setScene('table', { fresh: true });
      }
    };
  })();

  // ------------------------------------------------------------ victory
  DD.scenes.victory = (function () {
    let t = 0, spark = 0;
    const ms = { focus: 0 };
    return {
      enter: function () {
        t = 0; spark = 0; ms.focus = 0;
        music('victory'); sfx('victory');
        DD.fx.flash(PAL.fire, 0.6);
      },
      update: function (dt) {
        t += dt; spark -= dt;
        if (spark <= 0) {
          spark = 0.12;
          const cols = [PAL.fire, PAL.ember, PAL.brass, PAL.verdigris, PAL.bone];
          DD.fx.particles(60 + Math.random() * 520, 60 + Math.random() * 120, cols[Math.floor(Math.random() * cols.length)], 14);
        }
      },
      draw: function (ctx) {
        background('title', t);
        drawFlames(ctx, t, 26, 0.5);
        dim(0.35);
        const s = DD.game.last || { elapsed: 0, kills: 0, ether: 0, banked: 0, newBlueprints: [] };
        const pulse = 0.5 + 0.5 * Math.sin(t * 3);
        D.text('¡HAS ESCAPADO!', 320, 28, { size: 24, align: 'center', color: mix(PAL.brass, PAL.fire, pulse) });
        D.rect(0, 58, DD.W, 16, 'rgba(8,4,10,0.6)');
        D.text('Cruzas las puertas mientras la torre se derrumba a tu espalda.', 320, 62, { size: 8, align: 'center', color: PAL.bone });
        D.panel(150, 86, 340, 180);
        const best = sv().bestTime;
        const rows = [
          ['Tiempo empleado', fmtTime(s.elapsed)],
          ['Mejor tiempo', best != null ? fmtTime(best) : '--:--'],
          ['Enemigos derrotados', String(s.kills)],
          ['Éter recogido', String(s.ether)],
          ['Éter depositado (+' + (s.bonus || 25) + ' bono)', String(s.banked)]
        ];
        for (let i = 0; i < rows.length; i++) {
          D.text(rows[i][0], 168, 100 + i * 15, { size: 10, color: PAL.bone });
          D.text(rows[i][1], 472, 100 + i * 15, { size: 10, align: 'right', color: PAL.fire });
        }
        if (s.newBest) D.text('¡NUEVO RÉCORD!', 320, 178, { size: 10, align: 'center', color: PAL.ichor });
        D.rect(166, 194, 308, 1, PAL.brassDark);
        const nb = s.newBlueprints || [];
        D.text('Planos nuevos: ' + nb.length, 168, 202, { size: 10, color: PAL.brass });
        if (nb.length) D.textWrap(nb.map(limbName).join(', '), 168, 218, 304, { size: 8, color: PAL.ink });
        const a = DD.ui.menu(ms, [{ label: 'Volver al título', x: 240, y: 286, w: 160, h: 32, size: 12, color: PAL.fire }]);
        if (a === 0) DD.setScene('title');
      }
    };
  })();

  // ------------------------------------------------------------ codex
  const silCache = {};
  function silhouette(id) {
    if (silCache[id] !== undefined) return silCache[id];
    let c = null;
    try {
      if (DD.sprites && DD.sprites.limbIcon) {
        c = document.createElement('canvas'); c.width = 16; c.height = 16;
        const cx = c.getContext('2d');
        DD.sprites.limbIcon(cx, id, 0, 0, 1);
        cx.globalCompositeOperation = 'source-in';
        cx.fillStyle = '#2b2236'; cx.fillRect(0, 0, 16, 16);
      }
    } catch (e) { c = null; }
    silCache[id] = c;
    return c;
  }

  DD.scenes.codex = (function () {
    let t = 0, back = 'title', last = 0;
    const ms = { focus: 0 };
    const TYPES = ['head', 'torso', 'arm', 'leg'];
    const TYPE_NAME = { head: 'Cabezas', torso: 'Torsos', arm: 'Brazos', leg: 'Piernas' };
    const TYPE_ONE = { head: 'Cabeza', torso: 'Torso', arm: 'Brazo', leg: 'Pierna' };
    let ids = [];

    function leave() { DD.setScene(back, back === 'table' ? { keep: true } : {}); }

    return {
      enter: function (p) {
        t = 0; back = (p && p.back) || 'title'; ms.focus = 0; last = 0;
        ids = [];
        TYPES.forEach(function (ty) { limbIds().forEach(function (id) { if (DD.LIMBS[id].slot === ty) ids.push(id); }); });
        const b = sv().blueprints;
        for (let i = 0; i < ids.length; i++) if (b[ids[i]]) { ms.focus = i; break; }
      },
      update: function (dt) {
        t += dt;
        if (DD.input.hit('cancel')) { DD.input.consume('cancel'); leave(); }
      },
      draw: function (ctx) {
        background('lab', t);
        dim(0.7);
        const bp = sv().blueprints;
        D.rect(170, 2, 300, 34, 'rgba(8,4,10,0.6)');
        D.text('PLANOS ANATÓMICOS', 320, 6, { size: 16, align: 'center', color: PAL.brass });
        D.text('Descubiertos: ' + blueprintCount() + '/' + ids.length, 320, 25, { size: 8, align: 'center', color: PAL.dim });

        D.panel(6, 38, 294, 282);
        // grid layout
        const groups = TYPES.map(function (ty) { return ids.filter(function (id) { return DD.LIMBS[id].slot === ty; }); });
        let dense = false;
        let rowsN = groups.reduce(function (s, g) { return s + Math.ceil(g.length / 7); }, 0);
        if (rowsN * 36 + 4 * 14 > 254) dense = true;
        const cell = dense ? 22 : 36, per = dense ? 11 : 7, sc = dense ? 1 : 2;
        const items = [];
        let y = 46;
        for (let g = 0; g < groups.length; g++) {
          D.text(TYPE_NAME[TYPES[g]], 14, y, { size: 8, color: PAL.brass });
          y += 11;
          for (let i = 0; i < groups[g].length; i++) {
            items.push({
              label: '', id: groups[g][i], x: 12 + (i % per) * (cell + 2), y: y + Math.floor(i / per) * (cell + 2),
              w: cell, h: cell
            });
          }
          y += Math.ceil(groups[g].length / per) * (cell + 2) + 3;
        }
        const nCells = items.length;
        items.push({ label: 'Volver', x: 6, y: 326, w: 90, h: 26 });
        const a = DD.ui.menu(ms, items);
        for (let i = 0; i < nCells; i++) {
          const it = items[i];
          const off = Math.floor((cell - 16 * sc) / 2);
          if (bp[it.id]) limbIcon(it.id, it.x + off, it.y + off, sc);
          else {
            const s = silhouette(it.id);
            if (s) { ctx.imageSmoothingEnabled = false; ctx.drawImage(s, it.x + off, it.y + off, 16 * sc, 16 * sc); }
            D.text('?', it.x + cell / 2, it.y + cell / 2 - 5, { size: 10, align: 'center', color: PAL.dim });
          }
        }
        if (ms.focus < nCells) last = ms.focus;
        if (a === nCells) leave();

        // detail
        D.panel(306, 38, 328, 282);
        const id = nCells ? ids[Math.min(last, nCells - 1)] : null;
        const def = id ? DD.LIMBS[id] : null;
        if (!def) return;
        if (!bp[id]) {
          D.text('???', 470, 60, { size: 24, align: 'center', color: PAL.dim });
          D.text(TYPE_ONE[def.slot] + ' no descubierto', 470, 96, { size: 10, align: 'center', color: PAL.dim });
          D.textWrap('Cosecha este miembro en la torre (de un enemigo caído o de un tarro) para registrar su plano anatómico.',
            322, 120, 296, { size: 10, color: PAL.dim, align: 'center' });
          return;
        }
        limbIcon(id, 316, 46, 3);
        D.text(def.name, 372, 48, { size: 12, color: PAL.brass });
        D.text(TYPE_ONE[def.slot] + ' · Integridad ' + def.integrity, 372, 64, { size: 8, color: PAL.bone });
        D.text('Pasivo: ' + passiveText(def.passive), 372, 76, { size: 8, color: PAL.ichor });
        let cy = 100;
        if (def.desc) cy += D.textWrap(def.desc, 316, cy, 310, { size: 8, color: PAL.dim }) + 4;
        for (let i = 0; i < def.cards.length; i++) {
          const c = DD.CARDS[def.cards[i]];
          if (!c) continue;
          D.rect(316, cy, 310, 1, '#33271e');
          icon(c.type, 318, cy + 4, 1);
          D.text(c.name, 330, cy + 3, { size: 10, color: PAL.ink });
          D.text('Coste ' + c.cost + ' · Calor ' + c.heat + ' · Desgaste ' + c.wear, 624, cy + 5, { size: 8, align: 'right', color: PAL.dim });
          cy += 16 + D.textWrap(c.desc || '', 330, cy + 16, 294, { size: 8, color: PAL.bone }) + 4;
        }
      }
    };
  })();

  // ------------------------------------------------------------ shop
  DD.scenes.shop = (function () {
    let t = 0, back = 'title', pbody = null;
    const ms = { focus: 0 };

    function leave() { DD.setScene(back, back === 'table' ? { keep: true } : {}); }
    function say(text, color) { DD.fx.float(text, 320, 190, color || PAL.fire); }

    function buyCosmetic(c) {
      const d = sv();
      if (d.owned[c.id] || !c.price) { d.owned[c.id] = true; d.skin = c.id; sfx('select'); DD.save.write(); return; }
      if (d.ether < c.price) { sfx('error'); say('Éter insuficiente', PAL.bloodLight); return; }
      d.ether -= c.price; d.owned[c.id] = true; d.skin = c.id;
      sfx('pickup'); say('¡' + c.name + ' adquirida!', PAL.ichor); DD.save.write();
    }
    function buyBody(b) {
      const d = sv();
      if (d.owned[b.id]) return;
      if (d.ether < (b.price || 0)) { sfx('error'); say('Éter insuficiente', PAL.bloodLight); return; }
      d.ether -= (b.price || 0); d.owned[b.id] = true;
      sfx('graft'); say('¡' + b.name + ' desbloqueado!', PAL.ichor); DD.save.write();
    }

    return {
      enter: function (p) {
        t = 0; back = (p && p.back) || 'title'; ms.focus = 0;
        if (!pbody) {
          try {
            const free = (DD.BASE_BODIES || []).filter(function (b) { return b.unlock === 'free'; })[0] || DD.BASE_BODIES[0];
            pbody = DD.body.create(free.id);
          } catch (e) { pbody = null; }
        }
      },
      update: function (dt) {
        t += dt;
        if (DD.input.hit('cancel')) { DD.input.consume('cancel'); leave(); }
      },
      draw: function (ctx) {
        background('lab', t);
        dim(0.7);
        const d = sv();
        D.rect(150, 2, 340, 26, 'rgba(8,4,10,0.6)');
        D.text('TIENDA DE LA TORRE', 320, 6, { size: 16, align: 'center', color: PAL.brass });
        icon('ether', 520, 10, 1);
        D.text('Éter: ' + d.ether, 632, 9, { size: 12, align: 'right', color: PAL.verdigris });

        const cos = DD.COSMETICS || [];
        const bodies = (DD.BASE_BODIES || []).filter(function (b) { return b.unlock === 'shop'; });
        const items = [];

        // skins
        D.panel(6, 34, 236, 270);
        D.text('PIELES', 124, 41, { size: 8, align: 'center', color: PAL.brass });
        const gap = cos.length > 8 ? Math.floor(240 / cos.length) : 26, rh = gap - 4;
        for (let i = 0; i < cos.length; i++) {
          const c = cos[i];
          const owned = d.owned[c.id] || !c.price;
          const status = d.skin === c.id ? 'EQUIPADA' : (owned ? 'equipar' : c.price + ' Éter');
          items.push({
            label: '   ' + c.name + ' · ' + status, size: 8, x: 12, y: 54 + i * gap, w: 224, h: rh,
            kind: 'skin', c: c, color: d.skin === c.id ? PAL.fire : (owned || d.ether >= c.price ? undefined : PAL.dim)
          });
        }
        // base bodies
        D.panel(404, 34, 230, 270);
        D.text('CUERPOS BASE', 519, 41, { size: 8, align: 'center', color: PAL.brass });
        const bh = Math.min(76, Math.floor(244 / Math.max(1, bodies.length)));
        for (let i = 0; i < bodies.length; i++) {
          const b = bodies[i], by = 54 + i * bh;
          const owned = !!d.owned[b.id];
          D.text(b.name, 412, by, { size: 10, color: owned ? PAL.ichor : PAL.ink });
          D.textWrap(b.desc || '', 412, by + 13, 214, { size: 8, color: PAL.dim });
          items.push({
            label: owned ? 'Adquirido' : 'Comprar · ' + b.price + ' Éter', size: 8, x: 412, y: by + bh - 28, w: 214, h: 20,
            kind: 'body', b: b, disabled: owned
          });
        }
        if (!bodies.length) D.text('Sin cuerpos a la venta.', 519, 80, { size: 8, align: 'center', color: PAL.dim });
        // premium demo
        D.panel(104, 308, 530, 46);
        D.text('PREMIUM · DEMO — sin pagos reales. No se cobra nada: solo otorga Éter.', 112, 313, { size: 8, color: PAL.brass });
        items.push({ label: 'Paquete de Éter +100 — DEMO, sin pagos reales', size: 8, x: 112, y: 327, w: 514, h: 22, kind: 'premium' });
        items.push({ label: 'Volver', x: 6, y: 318, w: 90, h: 30, kind: 'back' });

        const a = DD.ui.menu(ms, items);

        // preview doll
        D.panel(248, 34, 150, 270);
        const cur = items[ms.focus];
        const skinId = cur && cur.kind === 'skin' ? cur.c.id : d.skin;
        const sk = cos.filter(function (c) { return c.id === skinId; })[0];
        D.text(sk ? sk.name : 'Carne Original', 323, 41, { size: 8, align: 'center', color: PAL.bone });
        if (pbody && DD.sprites && DD.sprites.drawBody) DD.sprites.drawBody(ctx, pbody, 323, 262, 3, t, { skin: skinId });
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.kind === 'skin' && it.c.tint) D.rect(it.x + 5, it.y + 4, 8, it.h - 8, it.c.tint);
        }

        if (a >= 0) {
          const it = items[a];
          if (it.kind === 'skin') buyCosmetic(it.c);
          else if (it.kind === 'body') buyBody(it.b);
          else if (it.kind === 'premium') {
            d.ether += 100; DD.save.write(); sfx('pickup'); say('+100 Éter (DEMO)', PAL.verdigris);
          } else if (it.kind === 'back') leave();
        }
      }
    };
  })();
})();
