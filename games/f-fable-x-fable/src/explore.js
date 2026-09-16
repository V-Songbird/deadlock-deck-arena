// Deadlock Deck: El Reloj Anatómico — DD.explore: the exploration screen.
// Maze navigation (tap/click or arrows/WASD), room triggers, stairs, the exit guard and the periodic tower mutation.
(function () {
  const CELL = 48, GAP = 16, GAP_AT = (CELL - GAP) / 2;
  const GX = (DD.W - 7 * CELL) / 2, GY = 40;        // grid origin: the HUD owns y 0-22, the floor title sits at y 27
  const MOVE_TIME = 0.2, BANNER_TIME = 1.5;
  const KEYS = { n: ['ArrowUp', 'KeyW'], s: ['ArrowDown', 'KeyS'], w: ['ArrowLeft', 'KeyA'], e: ['ArrowRight', 'KeyD'] };
  const DELTA = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
  const ONCE = ['enemy', 'elite', 'vial', 'coolant', 'ichor', 'trap'];   // drawn faded once cleared
  const COLOR = { fog: '#07060b', fogLine: '#0e0b15', floor: '#1a1522', seen: '#2c2538', wall: '#6b5d7e', door: '#a8782c', gold: '#e0b64c', dim: '#8a8098', red: '#e8483c' };

  let run = null, cb = null, move = null, banner = 0, prevBucket = 0, anim = 0;

  const here = () => DD.tower.cellAt(run.floor, run.floor.px, run.floor.py);
  const cx = c => GX + c.x * CELL + CELL / 2;
  const cy = c => GY + c.y * CELL + CELL / 2;
  const inside = (c, x, y) => x >= GX + c.x * CELL && x < GX + (c.x + 1) * CELL && y >= GY + c.y * CELL && y < GY + (c.y + 1) * CELL;

  function reveal(cell) { for (const n of DD.tower.neighbors(run.floor, cell)) n.revealed = true; }

  function begin(r, callbacks) {
    run = r; cb = callbacks; move = null; banner = 0; anim = 0;
    if (!run.floor) run.floor = DD.tower.generateFloor(run.floorIndex);
    reveal(here());
    prevBucket = Math.ceil(run.timeLeft / DD.MUTATE_EVERY);
    DD.log('Despiertas en la mesa de disección. ¡Huye!');
    DD.setScreen(DD.explore);
  }

  // Called by main.js after a combat that started from `cell`.
  function resume(cell, won) {
    if (!won) return;
    DD.setScreen(DD.explore);
    cell.cleared = true;
    if (cell.type === 'exit') cb.onEscape();
  }

  function update(dt) {
    anim += dt;
    banner -= dt;
    const bucket = Math.ceil(run.timeLeft / DD.MUTATE_EVERY);
    if (bucket < prevBucket && run.timeLeft > 0) {
      DD.tower.mutate(run.floor);
      DD.audio.sfx('mutate');
      DD.log('La torre se retuerce');
      banner = BANNER_TIME;
    }
    prevBucket = bucket;
    if (move) {
      move.t += dt;
      if (move.t >= MOVE_TIME) { const to = move.to; move = null; arrive(to); }
      return;
    }
    const cell = here();
    let target = null;
    for (const k in KEYS) {
      if (cell.doors[k] && KEYS[k].some(code => DD.input.keyPressed(code))) target = DD.tower.cellAt(run.floor, cell.x + DELTA[k][0], cell.y + DELTA[k][1]);
    }
    if (!target && DD.input.clicked) target = DD.tower.neighbors(run.floor, cell).find(c => inside(c, DD.input.x, DD.input.y));
    if (target) { move = { from: cell, to: target, t: 0 }; DD.audio.sfx('step'); }
  }

  function arrive(cell) {
    run.floor.px = cell.x;
    run.floor.py = cell.y;
    cell.visited = cell.revealed = true;
    reveal(cell);
    if (cell.cleared) { if (cell.type === 'exit') cb.onEscape(); return; }
    trigger(cell);
  }

  // Applies a room once; combat rooms are cleared later by resume().
  function trigger(cell) {
    switch (cell.type) {
      case 'vial': cell.cleared = true; run.hp = Math.min(run.maxHp, run.hp + 10); DD.log('Bebes un vial: +10 PV'); DD.audio.sfx('heal'); break;
      case 'coolant': cell.cleared = true; DD.body.cool(run, 5); DD.log('Refrigerante: -5 de calor en cada miembro'); DD.audio.sfx('pickup'); break;
      case 'ichor': { cell.cleared = true; const n = 5 + DD.rand(6); run.ichor += n; DD.log('Recoges ' + n + ' de Ichor'); DD.audio.sfx('pickup'); break; }
      case 'trap': cell.cleared = true; springTrap(cell.trapId); break;
      case 'enemy': case 'elite': cb.onCombat(cell.enemyId, cell); break;
      case 'exit': cb.onCombat('maestro', cell); break;              // the guard; resume(cell, true) -> onEscape()
      case 'stairs':
        run.floorIndex++;
        run.floor = DD.tower.generateFloor(run.floorIndex);        // the player starts at the new floor's 'start'
        DD.audio.sfx('stairs');
        DD.log('Subes a la planta ' + (run.floorIndex + 1) + ': ' + run.floor.name);
        break;
      default: cell.cleared = true;                                   // start, empty
    }
  }

  function springTrap(id) {
    const name = DD.data.traps[id].name, intact = DD.SLOTS.filter(s => run.body[s]);
    DD.audio.sfx('trap');
    if (id === 'cuchillas') { run.hp -= 6; DD.log('¡' + name + '! -6 PV'); }
    else if (id === 'reloj') { run.timeLeft -= 20; DD.log('¡' + name + '! -20 segundos'); }
    else if (id === 'acido') { DD.log('¡' + name + '! +2 de calor en cada miembro'); for (const s of intact) DD.body.heat(run, s, 2); }
    else if (id === 'vapor') { const s = DD.pick(intact); DD.log('¡' + name + '!' + (s ? ' +3 de calor en ' + DD.SLOT_NAME[s] : '')); if (s) DD.body.heat(run, s, 3); }
  }

  function wall(ctx, x, y, w, h, door) {
    ctx.fillStyle = COLOR.wall;
    ctx.fillRect(x, y, w, h);
    if (!door) return;
    ctx.fillStyle = COLOR.door;                                      // lit threshold in the middle of the wall
    if (w > h) ctx.fillRect(x + GAP_AT, y, GAP, h); else ctx.fillRect(x, y + GAP_AT, w, GAP);
  }

  function outline(ctx, c, color) {
    const x0 = GX + c.x * CELL, y0 = GY + c.y * CELL;
    ctx.fillStyle = color;
    ctx.fillRect(x0 + 2, y0 + 2, CELL - 4, 2);
    ctx.fillRect(x0 + 2, y0 + CELL - 4, CELL - 4, 2);
    ctx.fillRect(x0 + 2, y0 + 2, 2, CELL - 4);
    ctx.fillRect(x0 + CELL - 4, y0 + 2, 2, CELL - 4);
  }

  function drawCell(ctx, c) {
    const x0 = GX + c.x * CELL, y0 = GY + c.y * CELL;
    if (!c.revealed) {
      ctx.fillStyle = COLOR.fogLine; ctx.fillRect(x0, y0, CELL, CELL);
      ctx.fillStyle = COLOR.fog; ctx.fillRect(x0 + 1, y0 + 1, CELL - 2, CELL - 2);
      return;
    }
    ctx.fillStyle = c.visited ? COLOR.seen : COLOR.floor;
    ctx.fillRect(x0, y0, CELL, CELL);
    wall(ctx, x0, y0, CELL, 2, c.doors.n);
    wall(ctx, x0, y0 + CELL - 2, CELL, 2, c.doors.s);
    wall(ctx, x0, y0, 2, CELL, c.doors.w);
    wall(ctx, x0 + CELL - 2, y0, 2, CELL, c.doors.e);
    ctx.globalAlpha = c.cleared && ONCE.includes(c.type) ? 0.35 : 1;
    DD.ui.icon(ctx, c.type, x0 + CELL / 2 - 8, y0 + CELL / 2 - 8, { scale: 1 });
    ctx.globalAlpha = 1;
  }

  function draw(ctx) {
    DD.ui.background(ctx, 'corridor');
    const floor = run.floor, cell = here();
    for (const c of floor.cells) drawCell(ctx, c);
    if (!move) {
      const pulse = 0.5 + 0.5 * Math.abs(Math.sin(anim * 4));
      for (const c of DD.tower.neighbors(floor, cell)) {
        ctx.globalAlpha = inside(c, DD.input.x, DD.input.y) ? 1 : pulse;
        outline(ctx, c, COLOR.gold);
      }
      ctx.globalAlpha = 1;
    }
    let px = cx(cell), py = cy(cell);
    if (move) {
      const k = Math.min(1, move.t / MOVE_TIME);
      px = cx(move.from) + (cx(move.to) - cx(move.from)) * k;
      py = cy(move.from) + (cy(move.to) - cy(move.from)) * k;
    }
    DD.ui.drawBody(ctx, Math.round(px), Math.round(py + CELL / 2 - 3), run.body, { scale: 1, palette: run.palette });
    DD.ui.text(ctx, 'Planta ' + (run.floorIndex + 1) + '/' + DD.FLOORS + ' - ' + floor.name, DD.W / 2, 27, { size: 1, color: COLOR.gold, align: 'center' });
    DD.ui.log(ctx, run, GX, GY + 4 * CELL + 8, 7 * CELL);
    DD.ui.text(ctx, 'Toca una sala contigua o usa las flechas', DD.W / 2, 349, { size: 1, color: COLOR.dim, align: 'center' });
    DD.ui.hud(ctx, run);
    if (banner > 0) {
      DD.ui.panel(ctx, 160, 118, 320, 36, { color: COLOR.red });
      DD.ui.text(ctx, 'LA TORRE SE RETUERCE', DD.W / 2, 129, { size: 2, color: COLOR.red, align: 'center' });
    }
  }

  DD.explore = { begin, resume, update, draw };
})();
