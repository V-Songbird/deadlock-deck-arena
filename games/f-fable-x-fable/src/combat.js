// Deadlock Deck: El Reloj Anatómico — turn-based combat engine and screen (DD.combat).
// Usage: DD.setScreen(DD.combat); DD.combat.begin(run, enemyId, { onEnd(result) });
// result = { won: false } | { won: true, drops: [limbId] }. The 6-minute clock is owned by main.js.
(function () {
  const ENERGY = 3, DRAW = 5, HAND_CAP = 8, GAP = 4;
  const PLAYER_X = 120, ENEMY_X = 500;
  const TYPE_NAME = { head: 'Cabeza', torso: 'Torso', arm: 'Brazo', leg: 'Pierna' };
  let S = null;   // active combat state; null when no combat is running
  let uid = 0;

  const inst = (cardId, slot) => ({ uid: ++uid, cardId, slot });
  const inside = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

  function begin(run, enemyId, opts) {
    const def = DD.data.enemies[enemyId];
    S = {
      run, onEnd: opts && opts.onEnd,
      enemy: { id: enemyId, def, hp: def.hp, maxHp: def.hp, block: 0, weak: 0, vuln: 0, step: 0, hurt: 0 },
      draw: DD.shuffle(DD.body.deck(run.body).map(c => inst(c.cardId, c.slot))),
      hand: [], discard: [],
      energy: ENERGY, block: 0, weak: 0, turn: 0,
      phase: 'player', wait: 0, hurt: 0, floats: [], hover: -1, harvest: null,
    };
    DD.log('¡' + def.name + ' te cierra el paso!');
    DD.audio.sfx('growl');
    startTurn();
  }

  function finish(result) {
    if (!S) return;
    const cb = S.onEnd;
    S = null;
    if (cb) cb(result);
  }

  // ---- player turn -------------------------------------------------------
  function startTurn() {
    S.turn++;
    S.energy = ENERGY;
    S.block = 0;
    DD.body.cool(S.run, 1);
    drawCards(DRAW);
    S.phase = 'player';
  }

  function drawCards(n) {
    for (let i = 0; i < n && S.hand.length < HAND_CAP; i++) {
      if (!S.draw.length) {
        if (!S.discard.length) break;
        S.draw = DD.shuffle(S.discard);
        S.discard = [];
      }
      S.hand.push(S.draw.pop());
    }
  }

  function addFloat(x, y, text, color) { S.floats.push({ x, y, text, color, t: 0.3 }); }

  function hitEnemy(amount) {
    const e = S.enemy;
    if (e.vuln > 0) amount = Math.round(amount * 1.25);
    if (S.weak > 0) amount = Math.round(amount * 0.75);
    const blocked = Math.min(e.block, amount);
    e.block -= blocked;
    amount -= blocked;
    e.hp -= amount;
    if (amount > 0) e.hurt = 0.2;
    addFloat(ENEMY_X, 120, amount > 0 ? '-' + amount : 'Bloqueado', amount > 0 ? '#ff5a4a' : '#8fb4ff');
    DD.audio.sfx(amount > 0 ? 'hit' : 'block');
    return amount;
  }

  function playCard(i) {
    const card = S.hand[i];
    if (!card || S.phase !== 'player') return;
    const def = DD.data.cards[card.cardId];
    if (def.cost > S.energy) {
      DD.audio.sfx('error');
      DD.log('No tienes energía para ' + def.name + '.');
      return;
    }
    S.energy -= def.cost;
    S.hand.splice(i, 1);
    S.discard.push(card);
    DD.audio.sfx('card');
    const fx = def.fx, run = S.run, e = S.enemy, msgs = [];
    if (fx.dmg) {
      let total = 0;
      for (let h = 0; h < (fx.hits || 1); h++) total += hitEnemy(fx.dmg);
      msgs.push(total + ' de daño');
    }
    if (fx.block) { S.block += fx.block; msgs.push('+' + fx.block + ' de bloqueo'); DD.audio.sfx('block'); }
    if (fx.heal) {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + fx.heal);
      msgs.push('+' + (run.hp - before) + ' PV');
      DD.audio.sfx('heal');
    }
    if (fx.energy) { S.energy += fx.energy; msgs.push('+' + fx.energy + ' de energía'); }
    if (fx.draw) drawCards(fx.draw);
    if (fx.cool) DD.body.cool(run, fx.cool, card.slot);
    if (fx.coolAll) DD.body.cool(run, fx.coolAll);
    if (fx.weak) { e.weak += fx.weak; msgs.push('enemigo débil ' + fx.weak); }
    if (fx.vuln) { e.vuln += fx.vuln; msgs.push('enemigo vulnerable ' + fx.vuln); }
    DD.log(def.name + ': ' + (msgs.join(', ') || 'efecto') + '.');
    if (def.heat > 0 && DD.body.heat(run, card.slot, def.heat)) breakSlot(card.slot);
    if (e.hp <= 0) win();
  }

  // A limb broke: its cards leave hand, draw and discard; the stump card enters the discard.
  function breakSlot(slot) {
    const keep = c => c.slot !== slot;
    S.hand = S.hand.filter(keep);
    S.draw = S.draw.filter(keep);
    S.discard = S.discard.filter(keep);
    S.discard.push(inst(DD.data.STUMP_CARD, slot));
  }

  function endTurn() {
    if (S.phase !== 'player') return;
    S.discard.push(...S.hand);
    S.hand = [];
    if (S.weak > 0) S.weak--;
    if (S.enemy.vuln > 0) S.enemy.vuln--;
    S.phase = 'enemy';
    S.wait = 0.3;
    enemyAct();
  }

  // ---- enemy turn --------------------------------------------------------
  function enemyAct() {
    const e = S.enemy, run = S.run, it = e.def.pattern[e.step];
    e.block = 0;                      // enemy block lasts until its next action
    e.step = (e.step + 1) % e.def.pattern.length;
    if (it.type === 'attack') {
      let total = 0;
      for (let h = 0; h < (it.hits || 1); h++) {
        let d = e.weak > 0 ? Math.round(it.dmg * 0.75) : it.dmg;
        const blocked = Math.min(S.block, d);
        S.block -= blocked;
        d -= blocked;
        run.hp -= d;
        total += d;
      }
      if (total > 0) S.hurt = 0.2;
      addFloat(PLAYER_X, 90, total > 0 ? '-' + total : 'Bloqueado', total > 0 ? '#ff5a4a' : '#8fb4ff');
      DD.audio.sfx(total > 0 ? 'hit' : 'block');
      DD.log(e.def.name + ' ataca: ' + total + ' de daño.');
      if (run.hp <= 0) { run.hp = 0; finish({ won: false }); return; }
    } else if (it.type === 'block') {
      e.block += it.amt;
      DD.audio.sfx('block');
      DD.log(e.def.name + ' se cubre: ' + it.amt + ' de bloqueo.');
    } else if (it.type === 'heat') {
      const slots = DD.SLOTS.filter(s => run.body[s]);
      if (slots.length) {
        const slot = DD.pick(slots);
        DD.audio.sfx('heat');
        DD.log('El vapor calienta tu ' + DD.SLOT_NAME[slot].toLowerCase() + ' (+' + it.amt + ').');
        if (DD.body.heat(run, slot, it.amt)) breakSlot(slot);
      }
    } else if (it.type === 'weak') {
      S.weak += it.turns;
      DD.audio.sfx('growl');
      DD.log(e.def.name + ' te debilita ' + it.turns + ' turno' + (it.turns > 1 ? 's' : '') + '.');
    } else if (it.type === 'heal') {
      e.hp = Math.min(e.maxHp, e.hp + it.amt);
      DD.audio.sfx('heal');
      DD.log(e.def.name + ' se cura ' + it.amt + ' PV.');
    }
    if (e.weak > 0) e.weak--;
  }

  function intentText() {
    const e = S.enemy, it = e.def.pattern[e.step];
    switch (it.type) {
      case 'attack': {
        const d = e.weak > 0 ? Math.round(it.dmg * 0.75) : it.dmg;
        return 'Intención: ataque ' + d + (it.hits > 1 ? ' x' + it.hits : '');
      }
      case 'block': return 'Intención: bloqueo ' + it.amt;
      case 'heat': return 'Intención: vapor +' + it.amt + ' calor';
      case 'weak': return 'Intención: debilitar';
      case 'heal': return 'Intención: curación ' + it.amt;
    }
    return 'Intención: ?';
  }

  // ---- victory / harvest -------------------------------------------------
  function win() {
    const run = S.run, def = S.enemy.def;
    S.phase = 'harvest';
    S.hover = -1;
    run.kills++;
    for (const id of def.drops) if (!run.discovered.includes(id)) run.discovered.push(id);
    S.harvest = { drops: def.drops.slice(), picked: null };
    DD.log('¡' + def.name + ' cae! Cosecha sus restos.');
    DD.audio.sfx('harvest');
  }

  // ---- screen ------------------------------------------------------------
  function handRects() {
    const n = S.hand.length, w = DD.ui.CARD_W, h = DD.ui.CARD_H;
    const step = n > 1 ? Math.min(w + GAP, Math.floor((DD.W - 8 - w) / (n - 1))) : 0;
    const x0 = Math.floor((DD.W - (w + (n - 1) * step)) / 2), y = DD.H - h - 2;
    return S.hand.map((c, i) => ({ x: x0 + i * step, y, w, h }));
  }

  function update(dt) {
    if (!S) return;
    for (const f of S.floats) { f.t -= dt; f.y -= 40 * dt; }
    S.floats = S.floats.filter(f => f.t > 0);
    if (S.enemy.hurt > 0) S.enemy.hurt -= dt;
    if (S.hurt > 0) S.hurt -= dt;
    if (S.phase === 'enemy') {
      S.wait -= dt;
      if (S.wait <= 0) startTurn();
      return;
    }
    if (S.phase !== 'player') return;
    const rects = handRects();
    S.hover = -1;
    for (let i = rects.length - 1; i >= 0; i--) if (inside(rects[i], DD.input.x, DD.input.y)) { S.hover = i; break; }
    if (DD.input.clicked && S.hover >= 0) { playCard(S.hover); return; }
    for (let i = 0; i < HAND_CAP; i++) if (DD.input.keyPressed('Digit' + (i + 1))) { playCard(i); return; }
    if (DD.input.keyPressed('Space') || DD.input.keyPressed('Enter')) endTurn();
  }

  function draw(ctx) {
    if (!S) return;
    const ui = DD.ui, run = S.run, e = S.enemy;
    ui.background(ctx, 'lab');

    // Player (left).
    ui.drawBody(ctx, PLAYER_X, 214, run.body, { scale: 3, palette: run.palette, showHeat: true, labels: true });
    if (S.hurt > 0) { ctx.fillStyle = 'rgba(255,40,40,0.25)'; ctx.fillRect(0, 22, 300, 212); }
    const pst = [];
    if (S.block > 0) pst.push('Bloqueo ' + S.block);
    if (S.weak > 0) pst.push('Débil ' + S.weak);
    if (pst.length) ui.text(ctx, pst.join('  '), 8, 26, { size: 1, color: '#8fb4ff' });

    // Enemy (right).
    ui.text(ctx, e.def.name, ENEMY_X, 28, { size: 2, align: 'center', color: '#e8d9b0' });
    ui.bar(ctx, ENEMY_X - 70, 46, 140, 8, DD.clamp(e.hp / e.maxHp, 0, 1), '#c8323c', '#2a1218');
    ui.text(ctx, Math.max(0, e.hp) + '/' + e.maxHp + ' PV', ENEMY_X, 57, { size: 1, align: 'center', color: '#e8d9b0' });
    const est = [];
    if (e.block > 0) est.push('Bloqueo ' + e.block);
    if (e.weak > 0) est.push('Débil ' + e.weak);
    if (e.vuln > 0) est.push('Vulnerable ' + e.vuln);
    if (est.length) ui.text(ctx, est.join('  '), ENEMY_X, 68, { size: 1, align: 'center', color: '#8fb4ff' });
    ui.text(ctx, intentText(), ENEMY_X, 80, { size: 1, align: 'center', color: '#ffd166' });
    ui.drawEnemy(ctx, e.id, ENEMY_X, 214, { scale: 3, hurt: e.hurt > 0 });

    ui.log(ctx, run, 292, 100, 136);
    for (const f of S.floats) ui.text(ctx, f.text, f.x, f.y, { size: 2, align: 'center', color: f.color });

    // Bottom strip: energy, piles, end turn.
    ui.text(ctx, 'Energía ' + S.energy + '/' + ENERGY, 8, 238, { size: 2, color: '#ffd166' });
    ui.text(ctx, 'Mazo ' + S.draw.length + '   Descarte ' + S.discard.length + '   Turno ' + S.turn, 150, 244, { size: 1, color: '#bfb3a0' });
    if (ui.button(ctx, 516, 236, 116, 20, 'Fin de turno', { small: true, disabled: S.phase !== 'player' })) {
      endTurn();
      if (!S) return;
    }

    // Hand.
    const rects = handRects();
    S.hand.forEach((c, i) => {
      const def = DD.data.cards[c.cardId], r = rects[i];
      ui.drawCard(ctx, def, r.x, r.y, {
        slot: c.slot, selected: i === S.hover, disabled: S.phase !== 'player',
        playable: S.phase === 'player' && def.cost <= S.energy,
      });
      ui.text(ctx, String(i + 1), r.x + 2, r.y - 8, { size: 1, color: '#8a7f6e' });
    });

    if (S.phase === 'harvest') drawHarvest(ctx);
    ui.hud(ctx, run);
  }

  function drawHarvest(ctx) {
    const ui = DD.ui, run = S.run, h = S.harvest;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, DD.W, DD.H);
    ui.panel(ctx, 40, 30, 560, 300, { title: 'Cosecha' });
    if (!h.picked) {
      ui.text(ctx, 'Restos de ' + S.enemy.def.name + '. Elige una extremidad para injertar:', 56, 52, { size: 1, color: '#e8d9b0', maxWidth: 528 });
      for (let i = 0; i < h.drops.length; i++) {
        const limb = DD.data.limbs[h.drops[i]], y = 68 + i * 60;
        if (ui.button(ctx, 56, y, 190, 20, limb.name, { small: true })) h.picked = limb.id;
        ui.text(ctx, TYPE_NAME[limb.type] + ' - calor máx. ' + limb.maxHeat + (limb.hpBonus ? ' - +' + limb.hpBonus + ' PV máx.' : ''), 256, y + 2, { size: 1, color: '#bfb3a0' });
        const names = limb.cards.map(id => DD.data.cards[id].name).join(', ');
        ui.wrap('Cartas: ' + names, 328, 1).slice(0, 2).forEach((line, j) => ui.text(ctx, line, 256, y + 14 + j * 10, { size: 1, color: '#e8d9b0' }));
        ui.text(ctx, limb.desc, 56, y + 36, { size: 1, color: '#8fa88f', maxWidth: 528 });
      }
      if (ui.button(ctx, 250, 296, 140, 22, 'Descartar', { small: true })) finish({ won: true, drops: h.drops });
      return;
    }
    const limb = DD.data.limbs[h.picked];
    ui.text(ctx, 'Injertar ' + limb.name + ' en:', 56, 52, { size: 1, color: '#e8d9b0', maxWidth: 528 });
    const slots = DD.SLOTS.filter(s => DD.body.fits(s, h.picked));
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i], cur = run.body[slot];
      const label = DD.SLOT_NAME[slot] + ': ' + (cur
        ? DD.data.limbs[cur.id].name + ' (calor ' + cur.heat + '/' + DD.data.limbs[cur.id].maxHeat + ')'
        : 'muñón (vacío)');
      if (ui.button(ctx, 90, 72 + i * 30, 460, 22, label, { small: true })) {
        DD.body.graft(run, slot, h.picked);
        finish({ won: true, drops: h.drops });
        return;
      }
    }
    if (ui.button(ctx, 250, 296, 140, 22, 'Atrás', { small: true })) h.picked = null;
  }

  DD.combat = { begin, update, draw };
})();
