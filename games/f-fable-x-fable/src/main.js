// Deadlock Deck: El Reloj Anatómico — boot, frame loop and run flow (DD.game).
// The 6-minute clock lives here: it only runs while DD.game.running (explore + combat screens).
(function () {
  'use strict';
  let last = 0, lastTick = -1, newIds = [];   // newIds: blueprints first discovered during this run

  // Persist the run's discoveries now (they must survive a mid-run crash), remembering which were new.
  function bank() {
    for (const id of DD.run.discovered) if (DD.meta.discover(id)) newIds.push(id);
    DD.meta.save();
  }

  const game = {
    running: false,

    newRun() {
      const body = DD.body.newBase(), maxHp = DD.body.maxHp(body);
      DD.run = { hp: maxHp, maxHp, body, timeLeft: DD.RUN_SECONDS, floorIndex: 0, floor: null, ichor: 0, discovered: [], kills: 0, palette: DD.meta.state.palette, log: [] };
      game.running = false;
      newIds = [];
      lastTick = -1;
      DD.screens.show('dissection');
      DD.audio.music('title');
    },

    startRun() {
      DD.meta.state.runs++;
      DD.meta.save();
      game.running = true;
      DD.audio.music('explore');
      DD.explore.begin(DD.run, { onCombat: game.startCombat, onEscape: game.escape });
    },

    startCombat(enemyId, cell) {
      DD.audio.music('combat');
      DD.combat.begin(DD.run, enemyId, {
        onEnd(result) {
          bank();
          if (!result.won) { game.die('Has muerto'); return; }
          DD.audio.music('explore');
          DD.explore.resume(cell, true);          // sets the explore screen; may call onEscape synchronously
        },
      });
      DD.setScreen(DD.combat);
    },

    die(why) {
      if (!game.running) return;                // combat callback and clock check may both report it
      game.running = false;
      const run = DD.run, m = DD.meta.state;
      bank();
      m.ichor += run.ichor;
      m.bestFloor = Math.max(m.bestFloor, run.floorIndex + 1);
      DD.meta.save();
      DD.audio.music('death');
      DD.audio.sfx('death');
      DD.screens.show('death', why, newIds);
    },

    escape() {
      if (!game.running) return;
      game.running = false;
      const run = DD.run, m = DD.meta.state, bonus = 30 + Math.floor(Math.max(0, run.timeLeft) / 10);
      bank();
      m.escapes++;
      m.ichor += run.ichor + bonus;
      m.bestFloor = DD.FLOORS;
      m.bestTime = Math.max(m.bestTime || 0, run.timeLeft);
      DD.meta.save();
      DD.audio.music('escape');
      DD.audio.sfx('escape');
      DD.screens.show('escape', bonus, newIds);
    },

    toTitle() {
      DD.screens.show('title');
      DD.audio.music('title');
    },
  };

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (DD.input.anyInteraction) DD.audio.init();   // cheap once running; unlocks the context after a gesture
    DD.input.beginFrame();
    const run = DD.run;
    if (game.running) {
      run.timeLeft -= dt;
      DD.audio.setIntensity(1 - run.timeLeft / DD.RUN_SECONDS);
      const second = Math.ceil(run.timeLeft);
      if (run.timeLeft < 10 && second !== lastTick) { lastTick = second; DD.audio.sfx('tick'); }
    }
    DD.screen.update(dt);
    if (game.running) {                             // after update: a death reported by combat's callback is not doubled
      if (run.timeLeft <= 0) game.die('El reloj se detuvo');
      else if (run.hp <= 0) game.die('Has muerto');
    }
    DD.screen.draw(DD.render.ctx);
    DD.input.endFrame();
    DD.render.present();
  }

  function boot() {
    DD.meta.load();
    DD.audio.muted = DD.meta.state.muted;
    const canvas = document.getElementById('game');
    DD.render.init(canvas);
    DD.input.init(canvas);
    game.toTitle();
    requestAnimationFrame(frame);
  }

  DD.game = game;
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot);
})();
