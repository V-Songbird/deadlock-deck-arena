/* Run: the live game. Exploration and combat share one clock, and this scene
 * owns the hand-off between them, the overlays and the way out. */
(function () {
  'use strict';
  var DD = window.DD;

  /* KeyE is deliberately absent: DD.Explore.update owns it (stairs, altar, exit). */
  var KEYS = ['Escape', 'Tab', 'Space', 'KeyF', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
    'Digit6', 'Digit7', 'Digit8', 'Digit9'];

  var curTrack = null;
  var lastClick = -1;
  var scene;

  function st() { return DD.Run && DD.Run.state; }

  function sfx(name) {
    if (DD.Audio && DD.Audio.sfx && DD.Audio.sfx.play) DD.Audio.sfx.play(name);
  }

  function terminal(status) {
    return status === 'dead' || status === 'timedout' || status === 'escaped';
  }

  /* Music only changes when the track actually changes: DD.Run's own stings
   * (death, escape) must not be fought by a scene that re-plays every frame. */
  function track(name, force) {
    if (!force && curTrack === name) return;
    curTrack = name;
    var m = DD.Audio && DD.Audio.music;
    if (m && m.play) m.play(name);
  }

  /* ------------------------------------------------------------- hand-off */
  /* DD.Combat.start sets 'combat' and nothing ever sets it back. */
  function handOff(s, e) {
    if (!e || e.result === 'lose') return;      // DD.Run.die() already ran
    s.status = 'explore';
    s.encounter = null;
    s.block = 0;
  }

  function playCard(i) {
    var res = (DD.Combat && DD.Combat.playCard) ? DD.Combat.playCard(i) : null;
    if (res && res.ok) { sfx('card_play'); return true; }
    sfx('ui_move');
    return false;
  }

  function stepTarget(dir) {
    var s = st();
    var e = s && s.encounter;
    var list = (e && e.enemies) || [];
    var n = list.length;
    if (!n || !DD.Combat || !DD.Combat.selectTarget) return;
    var from = DD.Combat.target | 0;
    for (var k = 1; k <= n; k++) {
      var j = ((from + dir * k) % n + n) % n;
      if (list[j] && !list[j].dead) {
        DD.Combat.selectTarget(j);
        sfx('ui_move');
        return;
      }
    }
  }

  /* Topmost card under the pointer, or -1. Enemies are the view's business. */
  function handAt() {
    var s = st();
    var e = s && s.encounter;
    var p = DD.Input && DD.Input.pointer;
    if (!e || !e.hand || !e.hand.length || !p || typeof p.x !== 'number') return -1;
    if (!DD.View || !DD.View.combat || !DD.View.combat.handRect) return -1;
    for (var i = e.hand.length - 1; i >= 0; i--) {
      var r = DD.View.combat.handRect(i);
      if (r && r.w > 0 && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) return i;
    }
    return -1;
  }

  function combatFrame(s) {
    var e = s.encounter;
    if (!e) { s.status = 'explore'; return; }
    e.selected = handAt();
    if (DD.Input && DD.Input.pointer && DD.Input.pointer.justDown) scene.pointer('down');
    if (e.over) handOff(st(), e);
  }

  /* --------------------------------------------------------------- input */
  function pump() {
    var I = DD.Input;
    if (!I || !I.consume) return;
    for (var i = 0; i < KEYS.length; i++) {
      if (I.consume(KEYS[i])) scene.key({ code: KEYS[i] });
    }
    if (I.pointer && I.pointer.justDown) scene.pointer('down');
  }

  /* ------------------------------------------------------------ overlays */
  function vbutton(id, x, label) {
    var r = { x: x, y: 334, w: 66, h: 20 };
    var hit = DD.Input.button(id, r.x, r.y, r.w, r.h);
    DD.Pixel.panel(r.x, r.y, r.w, r.h, { alpha: 0.9 });
    DD.Pixel.text(label, r.x + r.w / 2, r.y + 7, { align: 'center', color: DD.C.textDim });
    return hit;
  }

  /* Touch devices have no Tab and no Escape, so they get two buttons. Only the
   * scene on top may act on them: a transparent scene draws this one under it. */
  function overlay() {
    var I = DD.Input;
    if (!I || !DD.Pixel || DD.Scenes.name !== 'run') return;
    if (I.virtual && I.button) {
      if (vbutton('vcod', 200, DD.t('CÓDICE'))) {
        if (DD.Scenes.has('codex')) DD.Scenes.push('codex', { from: 'run' });
      }
      if (vbutton('vpause', 274, DD.t('PAUSA'))) {
        if (DD.Scenes.has('pause')) DD.Scenes.push('pause');
      }
      return;
    }
    /* Bottom line: the combat view labels its draw and discard piles at y 334,
     * so this hint sits below them rather than through them. */
    DD.Pixel.text(DD.t('TAB códice - ESC pausa'), DD.VW - 8, 352, {
      align: 'right', color: DD.C.textFaint, alpha: 0.85
    });
  }

  function empty() {
    if (DD.View && DD.View.ui && DD.View.ui.bg) DD.View.ui.bg();
    if (DD.Pixel && DD.Pixel.text) {
      DD.Pixel.text(DD.t('No hay ninguna partida en curso.'), DD.VW / 2, 176, {
        align: 'center', color: DD.C.textDim
      });
    }
  }

  /* ----------------------------------------------------------------- scene */
  scene = DD.Scenes.define('run', {
    enter: function () {
      var s = st();
      if (!s || terminal(s.status)) {
        if (DD.Run && DD.Run.newRun) { DD.Run.newRun(); s = st(); }
      }
      if (s && DD.Run.say && s.log && !s.log.length) {
        DD.Run.say(DD.t('Despiertas en una mesa de disección. Seis minutos.'));
      }
      track('explore', true);
    },

    update: function (dt) {
      dt = dt || 0;
      var s = st();
      if (!s) return;
      if (DD.Run.tick) DD.Run.tick(dt);

      s = st();
      if (!s) return;
      if (s.status === 'explore') {
        if (DD.Explore && DD.Explore.update) DD.Explore.update(dt);
        s = st();
        if (s && s.status === 'explore') {
          track('explore');
          if (DD.Explore && DD.Explore.pendingGraft && DD.Scenes.name !== 'graft' && DD.Scenes.has('graft')) {
            DD.Scenes.push('graft');
          }
        }
      } else if (s.status === 'combat') {
        if (DD.View && DD.View.combat && DD.View.combat.update) DD.View.combat.update(dt);
        combatFrame(s);
        s = st();
        if (s && s.status === 'combat') track('combat');
      }

      pump();

      s = st();
      if (s && terminal(s.status)) DD.Scenes.replace('end', { result: s.status });
    },

    draw: function () {
      var s = st();
      if (!s) { empty(); return; }
      var V = DD.View;
      if (s.status === 'combat' && s.encounter && V && V.combat && V.combat.draw) {
        V.combat.draw();                    // the combat view draws its own HUD
      } else {
        if (V && V.explore && V.explore.draw) V.explore.draw();
        if (V && V.hud && V.hud.draw) V.hud.draw();
      }
      overlay();
    },

    key: function (e) {
      var code = e && e.code;
      var s = st();
      if (!code || !s) return;
      if (code === 'Escape') { if (DD.Scenes.has('pause')) DD.Scenes.push('pause'); return; }
      if (code === 'Tab') { if (DD.Scenes.has('codex')) DD.Scenes.push('codex', { from: 'run' }); return; }
      if (s.status !== 'combat') return;

      var enc = s.encounter;
      if (!enc || enc.over) return;
      if (code === 'Space') { if (DD.Combat.endTurn) DD.Combat.endTurn(); return; }
      if (code === 'KeyF') { if (DD.Combat.flee) DD.Combat.flee(); return; }
      if (code === 'ArrowLeft' || code === 'KeyA') { stepTarget(-1); return; }
      if (code === 'ArrowRight' || code === 'KeyD') { stepTarget(1); return; }
      if (code.indexOf('Digit') === 0) {
        var n = parseInt(code.slice(5), 10);
        if (n >= 1 && n <= 9) playCard(n - 1);
      }
    },

    pointer: function (phase) {
      if (phase !== 'down') return;
      var frame = DD.Loop ? DD.Loop.t : -1;
      if (frame >= 0 && lastClick === frame) return;      // one click, one card
      lastClick = frame;
      var i = handAt();
      if (i >= 0) playCard(i);
    },

    /* Called by DD.Scenes.pop() when a graft table, codex or pause closes. */
    resume: function () { lastClick = -1; }
  });
})();
