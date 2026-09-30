/* Deadlock Deck: El Reloj Anatómico — partida: estado, reloj, flujo entre escenas, HUD y pausa (W1b)
 * Contrato: docs/design.md §7. Las escenas (table, explore, combat, harvest, results) las escriben otros:
 * aquí solo se llama a DD.setScene(nombre, params).
 */
(function () {
  'use strict';
  var DD = window.DD;
  var C = DD.C, CFG = DD.CFG;
  var Run = DD.Run = {};
  DD.run = null;

  /* ---------- utilidades ---------- */
  function sfx(name, vol) { if (DD.Audio && DD.Audio.sfx) DD.Audio.sfx(name, vol); }
  function music(name) { if (DD.Audio && DD.Audio.music) DD.Audio.music(name); }
  function isMuted() { return DD.Audio && DD.Audio.muted != null ? !!DD.Audio.muted : !!DD.save.mute; }

  function toggleMute() {
    var m = DD.Audio && DD.Audio.toggleMute ? DD.Audio.toggleMute() : !DD.save.mute;
    DD.save.mute = !!m;
    DD.saveNow();
  }

  function rect(ctx, c, x, y, w, h) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  }

  function mix(a, b, t) {                    // mezcla dos colores #rrggbb
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), out = 0;
    for (var s = 16; s >= 0; s -= 8) {
      var ca = (x >> s) & 255, cb = (y >> s) & 255;
      out = (out << 8) | Math.round(ca + (cb - ca) * t);
    }
    return '#' + ('000000' + out.toString(16)).slice(-6);
  }

  function icon(ctx, key, x, y) {
    if (DD.Sprites && DD.Sprites.draw) DD.Sprites.draw(ctx, key, x, y);
  }

  function causeText(src) {
    if (!src) return null;
    if (typeof src === 'string') return src;
    return src.name || (src.id && DD.ENEMIES && DD.ENEMIES[src.id] ? DD.ENEMIES[src.id].name : null);
  }

  /* ---------- flujo de la partida ---------- */
  function pickBase(first, prevBase) {
    if (first) return 'jornalero';
    var order = DD.BASE_ORDER || Object.keys(DD.BASES);
    var avail = order.filter(function (id) {
      var b = DD.BASES[id];
      return b && (!b.locked || DD.save.owned[id]);
    });
    if (!avail.length) return 'jornalero';
    var pool = avail.filter(function (id) { return id !== prevBase; });   // «cuerpo base nuevo»
    return DD.pick(DD.rng, pool.length ? pool : avail);
  }

  Run.begin = function () {
    var prev = DD.run;
    DD.save.runs++;
    var base = pickBase(DD.save.runs === 1, prev && prev.base);
    var body = DD.Body.create(base);
    var st = DD.Body.stats(body);
    DD.run = {
      n: DD.save.runs, seed: (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0,
      base: base, body: body, hp: st.hpMax, hpMax: st.hpMax, time: CFG.RUN_TIME, floor: 0,
      ether: 0, kills: 0, grafts: 0, newBlueprints: [], started: false, paused: false, world: null,
      ended: false, prevReason: prev && prev.endReason ? prev.endReason : null   // para el mensaje de reencarnación
    };
    DD.SLOTS.forEach(function (slot) {                    // los planos del cuerpo base no cuentan como nuevos
      if (body.slots[slot].id) Run.discover(body.slots[slot].id, true);
    });
    DD.saveNow();
    music('table');
    DD.setScene('table');
  };

  Run.launch = function () {
    var run = DD.run;
    if (!run) return;
    Run.refreshStats();
    run.started = true; run.paused = false; run.ended = false;
    run.floor = 0; run.world = null;
    if (DD.Audio && DD.Audio.setTension) DD.Audio.setTension(0);
    music('explore');
    DD.setScene('explore', { new: true });
  };

  function timeWarn() {
    sfx('timeWarn');
    DD.fx.flash(C.blood, 0.3, 0.18);
  }

  Run.tick = function (dt) {
    var run = DD.run;
    if (!run || !run.started || run.ended || run.paused) return;
    var before = run.time;
    run.time = Math.max(0, before - dt);
    if (DD.Audio && DD.Audio.setTension) DD.Audio.setTension(Run.fireLevel());
    if (before > 60 && run.time <= 60) timeWarn();
    if (before > 30 && run.time <= 30) timeWarn();
    var sec = Math.ceil(run.time);
    if (sec < Math.ceil(before) && sec >= 1 && sec <= 10) sfx('tick');   // cuenta atrás final
    if (run.time <= 0) Run.end('time');
  };

  Run.fireLevel = function () {
    var run = DD.run;
    return run ? DD.clamp(1 - run.time / CFG.RUN_TIME, 0, 1) : 0;
  };

  Run.refreshStats = function () {
    var run = DD.run;
    var st = DD.Body.stats(run.body), old = run.hpMax;
    run.hpMax = st.hpMax;
    if (st.hpMax > old) run.hp += st.hpMax - old;
    else run.hp = Math.min(run.hp, st.hpMax);
    return st;
  };

  // n ya viene sin bloqueo. Devuelve true si el golpe mata.
  Run.hurt = function (n, src) {
    var run = DD.run;
    n = Math.round(n) || 0;
    if (!run || !run.started || run.ended || n <= 0) return false;
    run.hp -= n;
    DD.fx.shake(Math.min(8, 2 + n / 3), 0.25);
    DD.fx.flash(C.blood, 0.25, 0.35);
    if (run.hp <= 0) {
      run.hp = 0;
      Run.end('death', src);
      return true;
    }
    sfx('hit', 0.5);
    return false;
  };

  // Devuelve los PV realmente recuperados
  Run.heal = function (n) {
    var run = DD.run;
    if (!run) return 0;
    var before = run.hp;
    run.hp = Math.min(run.hpMax, run.hp + Math.max(0, Math.round(n) || 0));
    return run.hp - before;
  };

  Run.addEther = function (n) {
    if (DD.run) DD.run.ether += Math.max(0, Math.round(n) || 0);
  };

  // Marca el plano. quiet = true: no cuenta como nuevo de esta run (planos del cuerpo base)
  Run.discover = function (limbId, quiet) {
    var bp = DD.save.blueprints;
    if (!limbId || bp[limbId]) return false;
    bp[limbId] = true;
    var run = DD.run;
    if (!quiet && run && run.newBlueprints.indexOf(limbId) < 0) run.newBlueprints.push(limbId);
    DD.saveNow();
    return true;
  };

  Run.startCombat = function (entity) {
    music('combat');
    DD.setScene('combat', { enemy: entity });
  };

  Run.combatWon = function (entity) {
    var run = DD.run, def = DD.ENEMIES && DD.ENEMIES[entity.id];
    entity.dead = true;
    run.kills++;
    if (!def) { Run.backToExplore(); return; }
    var e = def.ether || [0, 0];
    Run.addEther(DD.randInt(DD.rng, e[0], e[1]));
    var opts = DD.shuffle(DD.rng, (def.drops || []).slice()).slice(0, def.dropCount || 1);
    if (!opts.length) { Run.backToExplore(); return; }
    music('harvest');
    DD.setScene('harvest', { options: opts, source: 'enemy', label: def.name });
  };

  Run.startHarvest = function (options, label) {
    music('harvest');
    DD.setScene('harvest', { options: options, source: 'jar', label: label });
  };

  Run.backToExplore = function () {
    music('explore');
    DD.setScene('explore', { resume: true });
  };

  Run.nextFloor = function () {
    var run = DD.run;
    if (run.floor + 1 >= CFG.FLOORS) { Run.end('victory'); return; }
    run.floor++;
    run.world = null;
    DD.setScene('explore', { new: true });
  };

  // reason: 'death' | 'time' | 'victory' | 'quit'. Idempotente.
  Run.end = function (reason, cause) {
    var run = DD.run, save = DD.save;
    if (!run || run.ended) return;
    run.ended = true; run.started = false; run.paused = false;
    run.endReason = reason;
    var win = reason === 'victory';
    var floor = Math.min(run.floor + 1, CFG.FLOORS);       // 1..3 (run.floor es 0..2)
    var timeLeft = Math.max(0, Math.ceil(run.time));
    var bonus = win ? CFG.ETHER_ESCAPE_BONUS : 0;

    save.ether += run.ether + bonus;
    save.kills += run.kills;
    save.bestFloor = Math.max(save.bestFloor, floor);
    if (win) {
      save.escapes++;
      if (save.bestTime == null || timeLeft > save.bestTime) save.bestTime = timeLeft;
    }
    DD.saveNow();

    if (DD.Audio && DD.Audio.setTension) DD.Audio.setTension(0);
    music(win ? 'win' : 'death');
    if (win) { sfx('victory'); DD.fx.flash(C.fire3, 0.6, 0.5); }
    else if (reason === 'time') { sfx('explosion'); DD.fx.flash(C.fire2, 0.6, 0.6); DD.fx.shake(10, 0.5); }
    else if (reason === 'death') { sfx('death'); DD.fx.shake(6, 0.4); }

    DD.setScene('results', {
      reason: reason, cause: causeText(cause), floor: floor, timeLeft: timeLeft, kills: run.kills,
      grafts: run.grafts, newBlueprints: run.newBlueprints.slice(), ether: run.ether, bonus: bonus,
      total: run.ether + bonus, base: run.base, n: run.n
    });
  };

  /* ---------- HUD ---------- */
  var SHORT = { head: 'Cabeza', torso: 'Torso', armL: 'Brazo I', armR: 'Brazo D', legL: 'Pierna I', legR: 'Pierna D' };

  // «Brazo de Sierra» -> «Sierra»: el tipo ya lo dice la etiqueta del hueco
  function limbShort(name, max) {
    var s = String(name), i = s.lastIndexOf(' de ');
    if (i >= 0) s = s.slice(i + 4).replace(/^(la|el|los|las) /i, '');
    else s = s.replace(/^(Cabeza|Torso|Brazo|Pierna) /, '');
    if (s.length > max && s.indexOf(' ') > 3) s = s.slice(0, s.indexOf(' '));
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  function drawTop(ctx, run) {
    var t = DD.time, muted = isMuted();
    rect(ctx, C.bg2, 0, 0, 640, 24);
    rect(ctx, C.line, 0, 0, 640, 1);
    rect(ctx, C.brassDk, 0, 22, 640, 1);
    rect(ctx, C.brass, 0, 23, 640, 1);

    // Reloj: parpadea en rojo < 60 s y late < 30 s
    var col = C.ink;
    if (run.time < 30) {
      var k = 0.5 + 0.5 * Math.sin(t * 9);
      ctx.globalAlpha = 0.18 + 0.3 * k;
      rect(ctx, C.blood, 12, 3, 58, 18);
      ctx.globalAlpha = 1;
      col = C.bloodHi;
    } else if (run.time < 60) {
      col = Math.floor(t * 2) % 2 === 0 ? C.bloodHi : C.ink;
    }
    icon(ctx, 'i_clock', 4, 8);
    DD.text(ctx, DD.fmtTime(run.time), 16, 4, { size: 2, color: col, shadow: C.bg });

    // Vida
    var frac = run.hpMax > 0 ? run.hp / run.hpMax : 0;
    var low = frac < 0.3 && Math.floor(t * 4) % 2 === 0;
    icon(ctx, 'i_hp', 78, 8);
    DD.ui.bar(ctx, 88, 6, 104, 12, frac, low ? C.bloodHi : C.blood);
    DD.text(ctx, run.hp + '/' + run.hpMax, 198, 8, { color: low ? C.bloodHi : C.ink });

    DD.text(ctx, 'PISO ' + (run.floor + 1) + '/' + CFG.FLOORS, 262, 8, { color: C.brass });

    // Éter de la run
    icon(ctx, 'i_ether', 334, 8);
    DD.text(ctx, String(run.ether), 345, 8, { color: C.ether });

    // Avance del fuego
    icon(ctx, 'i_burn', 410, 8);
    DD.ui.bar(ctx, 421, 8, 90, 8, Run.fireLevel(), C.fire1);

    // Botones 20x20: sonido y pausa
    var hasIcons = !!(DD.Sprites && DD.Sprites.draw);
    if (DD.ui.button(ctx, 592, 2, 20, 20, hasIcons ? '' : (muted ? 'x' : 'S'), {})) { toggleMute(); sfx('ui'); }
    icon(ctx, muted ? 'i_mute' : 'i_sound', 598, 8);
    if (DD.ui.button(ctx, 616, 2, 20, 20, hasIcons ? '' : 'II', {})) { run.paused = true; sfx('ui'); }
    icon(ctx, 'i_pause', 622, 8);
  }

  function heatColor(f) { return mix(C.heat, C.bloodHi, DD.clamp(f, 0, 1)); }
  function integColor(f) {
    return f < 0.5 ? mix(C.bloodHi, C.warn, f * 2) : mix(C.warn, C.integ, (f - 0.5) * 2);
  }

  function drawCell(ctx, run, slot, cx, cy, cw) {
    var t = DD.time, s = run.body.slots[slot], limb = DD.Body.limbAt(run.body, slot);
    var type = DD.SLOT_TYPE[slot];
    if (!limb) {                                        // muñón: celda apagada
      rect(ctx, C.bg, cx, cy, cw, 36);
      rect(ctx, C.line, cx, cy, cw, 1); rect(ctx, C.line, cx, cy + 35, cw, 1);
      rect(ctx, C.line, cx, cy, 1, 36); rect(ctx, C.line, cx + cw - 1, cy, 1, 36);
      ctx.globalAlpha = 0.5;
      if (DD.Sprites && DD.Sprites.drawStumpIcon) DD.Sprites.drawStumpIcon(ctx, type, cx + 3, cy + 2);
      ctx.globalAlpha = 1;
      DD.text(ctx, SHORT[slot], cx + 22, cy + 3, { color: C.dim });
      DD.text(ctx, 'MUÑÓN', cx + 22, cy + 13, { color: C.blood });
      return;
    }
    var hf = DD.clamp(s.heat / CFG.HEAT_MAX, 0, 1), hot = s.heat >= CFG.HEAT_HOT;
    var integMax = limb.integ, inf = integMax > 0 ? DD.clamp(s.integ / integMax, 0, 1) : 0;
    var pulse = 0.5 + 0.5 * Math.sin(t * (s.heat >= CFG.HEAT_MAX * 0.9 ? 16 : 9));
    rect(ctx, C.panel, cx, cy, cw, 36);
    if (hot) {                                          // aviso: la celda late en naranja/rojo
      ctx.globalAlpha = 0.12 + 0.22 * pulse;
      rect(ctx, C.heat, cx, cy, cw, 36);
      ctx.globalAlpha = 1;
    }
    var border = hot ? mix(C.brassDk, C.heatHi, pulse) : C.line;
    rect(ctx, border, cx, cy, cw, 1); rect(ctx, border, cx, cy + 35, cw, 1);
    rect(ctx, border, cx, cy, 1, 36); rect(ctx, border, cx + cw - 1, cy, 1, 36);

    if (DD.Sprites && DD.Sprites.drawLimbIcon) DD.Sprites.drawLimbIcon(ctx, limb.id, cx + 3, cy + 2);
    else { rect(ctx, C.line, cx + 3, cy + 2, 16, 16); }
    DD.text(ctx, SHORT[slot], cx + 22, cy + 3, { color: C.bone });
    DD.text(ctx, limbShort(limb.name, 13), cx + 22, cy + 13, { color: inf < 0.25 ? C.bloodHi : (hot ? C.bone : C.dim) });

    var bw = cw - 18;
    icon(ctx, 'i_heat', cx + 3, cy + 19);
    DD.ui.bar(ctx, cx + 13, cy + 20, bw, 6, hf, hot && pulse > 0.5 ? C.heatHi : heatColor(hf));
    icon(ctx, 'i_limb', cx + 3, cy + 27);
    var lowI = inf < 0.25 && Math.floor(t * 4) % 2 === 0;
    DD.ui.bar(ctx, cx + 13, cy + 28, bw, 6, inf, lowI ? C.bloodHi : integColor(inf));
  }

  function drawBottom(ctx, run) {
    rect(ctx, C.bg2, 0, 320, 640, 40);
    rect(ctx, C.brass, 0, 320, 640, 1);
    rect(ctx, C.brassDk, 0, 321, 640, 1);
    if (!run.body || !DD.Body) return;
    for (var i = 0; i < DD.SLOTS.length; i++) drawCell(ctx, run, DD.SLOTS[i], 2 + i * 106, 323, 104);
  }

  Run.drawHUD = function (ctx) {
    var run = DD.run;
    if (!run) return;
    drawTop(ctx, run);
    drawBottom(ctx, run);
  };

  /* ---------- Pausa: Continuar / Sonido / Abandonar ---------- */
  var pauseSel = 0, quitArm = 0, lastPauseT = -1;
  var CONTROLS = [
    ['Mover', 'Flechas, WASD, cruceta o tocar'],
    ['Aceptar', 'Enter, Espacio o botón A'],
    ['Volver', 'Retroceso, Esc o botón B'],
    ['Terminar turno', 'E o botón X'],
    ['Cartas', '1-9 o tocar la carta'],
    ['Pausa', 'Esc, P o Start'],
    ['Sonido', 'M']
  ];

  function pauseLabels() {
    return ['Continuar', 'Sonido: ' + (isMuted() ? 'no' : 'sí'),
      quitArm > 0 ? '¿Seguro? Pulsa otra vez' : 'Abandonar'];
  }

  function openPause() {                      // la pausa se abre de nuevo cuando pasa un rato sin dibujarse
    if (DD.time - lastPauseT > 0.25) { pauseSel = 0; quitArm = 0; }
    lastPauseT = DD.time;
  }

  function activate(i) {
    var run = DD.run;
    sfx('ui');
    if (i === 0) run.paused = false;
    else if (i === 1) toggleMute();
    else if (quitArm > 0) { quitArm = 0; Run.end('quit'); }
    else quitArm = 3;                         // primer toque: pide confirmación
  }

  function select(i) {
    if (i !== pauseSel) { pauseSel = i; quitArm = 0; }
  }

  Run.updatePause = function (dt) {
    var run = DD.run, In = DD.Input;
    if (!run || !run.started || !run.paused) return;
    openPause();
    if (quitArm > 0) quitArm = Math.max(0, quitArm - dt);
    if (In.pressed('up')) { select((pauseSel + 2) % 3); sfx('ui', 0.5); }
    if (In.pressed('down')) { select((pauseSel + 1) % 3); sfx('ui', 0.5); }
    if (In.pressed('ok')) activate(pauseSel);
    else if (In.pressed('back')) { run.paused = false; sfx('uiBack'); }
  };

  Run.drawPause = function (ctx) {
    var run = DD.run;
    if (!run || !run.started || !run.paused) return;
    openPause();
    ctx.globalAlpha = 0.68;
    rect(ctx, C.bg, 0, 0, 640, 360);
    ctx.globalAlpha = 1;

    DD.ui.panel(ctx, 140, 30, 360, 284, { title: 'PAUSA' });
    var labels = pauseLabels();
    for (var i = 0; i < 3; i++) {
      var y = 58 + i * 32;
      if (DD.Input.mouse.moved && DD.ui.hit(220, y, 200, 26)) select(i);
      var accent = i === 2 && quitArm > 0 ? C.bloodHi : null;
      if (DD.ui.button(ctx, 220, y, 200, 26, labels[i], { selected: pauseSel === i, color: accent || undefined })) {
        select(i);
        activate(i);
      }
    }
    rect(ctx, C.line, 156, 162, 328, 1);
    DD.text(ctx, 'CONTROLES', 320, 168, { align: 'center', color: C.brass });
    for (var j = 0; j < CONTROLS.length; j++) {
      DD.text(ctx, CONTROLS[j][0], 160, 184 + j * 11, { color: C.dim });
      DD.text(ctx, CONTROLS[j][1], 254, 184 + j * 11, { color: C.ink });
    }
    DD.text(ctx, 'El reloj está detenido.', 320, 292, { align: 'center', color: C.dim });
  };
})();
