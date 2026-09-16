/* Menu: the lobby. Four doors, and the meta line that remembers every run. */
(function () {
  'use strict';
  var DD = window.DD;

  var ITEMS = [DD.t('NUEVA PARTIDA'), DD.t('CÓDIGO ANATÓMICO'), DD.t('TIENDA DE COSMÉTICOS'), DD.t('CÓMO JUGAR')];

  /* Mirrors DD.View.ui.menu's own defaults so the pointer can hit the rows. */
  var MENU = { x: 214, y: 186, w: 212, rowH: 22, gap: 2 };

  var KEYS = ['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'Enter', 'Escape'];

  var index = 0;
  var scene;

  function sfx(name) {
    if (DD.Audio && DD.Audio.sfx && DD.Audio.sfx.play) DD.Audio.sfx.play(name);
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function rowAt(p) {
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return -1;
    for (var i = 0; i < ITEMS.length; i++) {
      var y = MENU.y + i * (MENU.rowH + MENU.gap);
      if (p.y >= y && p.y <= y + MENU.rowH && p.x >= MENU.x - 8 && p.x <= MENU.x + MENU.w + 8) return i;
    }
    return -1;
  }

  function move(d) {
    var n = clamp(index + d, 0, ITEMS.length - 1);
    if (n === index) return;
    index = n;
    sfx('ui_move');
  }

  function activate(i) {
    sfx('ui_select');
    if (i === 0) { DD.Scenes.replace('run'); return; }
    if (i === 1) { DD.Scenes.push('codex'); return; }
    if (i === 2) { DD.Scenes.push('shop'); return; }
    if (i === 3) { DD.Scenes.push('codex', { tab: 'help' }); return; }
  }

  /* DD.Scenes never dispatches key()/pointer(), so the scene polls the input
   * edges and feeds them to its own handlers: one press, handled once. */
  function pump() {
    var I = DD.Input;
    if (!I || !I.consume) return;
    for (var i = 0; i < KEYS.length; i++) {
      if (I.consume(KEYS[i])) scene.key({ code: KEYS[i] });
    }
    if (I.pointer && I.pointer.justDown) scene.pointer('down');
  }

  function metaLine() {
    if (!DD.Pixel || !DD.Pixel.text) return;
    var m = (DD.Run && DD.Run.meta) || {};
    var limbs = 0, k;
    for (k in (m.codexLimbs || {})) if (m.codexLimbs[k]) limbs++;
    var total = ((DD.Data && DD.Data.limbs) || []).length;
    var best = m.bestTime ? DD.clock(m.bestTime) : DD.t('aún ninguna');
    DD.Pixel.text(DD.t('Carreras: ') + (m.runs || 0) + DD.t('   Huidas: ') + (m.escapes || 0) +
      DD.t('   Mejor huida: ') + best + DD.t('   Planos: ') + limbs + '/' + total,
      DD.VW / 2, 316, { align: 'center', color: DD.C.textDim });
  }

  scene = DD.Scenes.define('menu', {
    enter: function () {
      index = 0;
      if (DD.Audio && DD.Audio.music && DD.Audio.music.play) DD.Audio.music.play('menu');
    },

    update: function () { pump(); },

    draw: function () {
      var U = DD.View && DD.View.ui;
      if (!U || !U.bg) {
        if (DD.Canvas && DD.Canvas.clear) DD.Canvas.clear();
        return;
      }
      U.bg();
      if (U.title) U.title();
      if (U.menu) U.menu(ITEMS, index, { hint: DD.t('ENTER para elegir') });
      if (U.langToggle) U.langToggle(16, 330);
      metaLine();
    },

    key: function (e) {
      var code = e && e.code;
      if (!code) return;
      if (code === 'ArrowUp' || code === 'KeyW') { move(-1); return; }
      if (code === 'ArrowDown' || code === 'KeyS') { move(1); return; }
      if (code === 'Enter') activate(index);
    },

    pointer: function (phase) {
      var i = rowAt(DD.Input && DD.Input.pointer);
      if (i < 0) return;
      index = i;
      if (phase === 'down') activate(i);
    }
  });
})();
