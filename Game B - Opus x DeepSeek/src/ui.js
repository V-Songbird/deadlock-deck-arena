// DD.UI — the DOM layer of Deadlock Deck: HUD, anatomy panel, hand, explore bar,
// dialogs and toasts. It owns every element in index.html except the canvas.
// It holds no game rules: it reads DD.state and calls back into game.js through the
// handlers given to init(). See PRODUCT.md 5.7.
window.DD = window.DD || {};

(function (DD) {
  'use strict';

  // Player-facing Spanish. Code and comments stay English.
  const SLOT_LABEL = {
    head: 'Cabeza', torso: 'Torso', armL: 'Brazo izq.', armR: 'Brazo der.',
    legL: 'Pierna izq.', legR: 'Pierna der.'
  };
  const STUMP_NAME = 'Muñón';
  const HOT_RATIO = 0.7;   // from here up a card warns that its limb is about to break
  const LOG_LINES = 3;     // combat log lines kept visible
  const TOAST_MS = 2400;

  const MOVE_KEYS = {
    arrowup: 'n', arrowdown: 's', arrowleft: 'w', arrowright: 'e',
    w: 'n', s: 's', a: 'w', d: 'e'
  };

  let el = null;           // cached elements
  let dirBtns = {};        // direction -> button
  let slotViews = {};      // slotKey -> { root, limb, fill, num, mark }
  let handlers = {};
  let playable = [];       // per hand index: can it be played right now
  let handSig = '';        // signature of the last built hand
  let logSig = '';
  let phase = 'title';
  let dialogCancel = null;
  let toastTimer = 0;

  const byId = (id) => document.getElementById(id);

  // Every piece of state text goes in through textContent, so nothing the game prints
  // can ever be parsed as HTML.
  function mk(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function call(fn, arg) {
    if (typeof fn === 'function') fn(arg);
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  // ---------------------------------------------------------------- build

  function buildAnatomy() {
    el.anatomy.textContent = '';
    slotViews = {};
    (DD.DATA.SLOTS || []).forEach(function (key) {
      const root = mk('div', 'slot');
      root.setAttribute('data-slot', key);
      const label = mk('span', 'slot-label', SLOT_LABEL[key] || key);
      const limb = mk('span', 'slot-limb', STUMP_NAME);
      const heat = mk('span', 'heat');
      const fill = mk('i', 'heat-fill');
      const num = mk('b', 'heat-num', '0/0');
      heat.appendChild(fill);
      heat.appendChild(num);
      const mark = mk('span', 'mark');
      mark.hidden = true;
      root.appendChild(label);
      root.appendChild(limb);
      root.appendChild(heat);
      root.appendChild(mark);
      el.anatomy.appendChild(root);
      slotViews[key] = { root: root, limb: limb, fill: fill, num: num, mark: mark };
    });
  }

  function init(h) {
    handlers = h || {};
    el = {
      app: byId('app'),
      clock: byId('clock'), clockValue: byId('clock-value'),
      hpBar: byId('hp-bar'), hpFill: byId('hp-fill'), hpText: byId('hp-text'),
      cycle: byId('cycle-text'), sound: byId('btn-sound'),
      anatomy: byId('anatomy'),
      combatBar: byId('combat-bar'), energy: byId('energy-text'),
      hand: byId('hand'), endTurn: byId('btn-end-turn'), log: byId('combat-log'),
      exploreBar: byId('explore-bar'), room: byId('room-label'),
      dialog: byId('dialog'), dialogTitle: byId('dialog-title'),
      dialogBody: byId('dialog-body'), dialogOptions: byId('dialog-options'),
      toast: byId('toast')
    };
    dirBtns = { n: byId('btn-n'), s: byId('btn-s'), e: byId('btn-e'), w: byId('btn-w') };

    buildAnatomy();

    Object.keys(dirBtns).forEach(function (dir) {
      if (dirBtns[dir]) {
        dirBtns[dir].addEventListener('click', function () { call(handlers.onMove, dir); });
      }
    });
    if (el.sound) el.sound.addEventListener('click', function () { call(handlers.onToggleSound); });
    if (el.endTurn) el.endTurn.addEventListener('click', function () { call(handlers.onEndTurn); });
    if (el.hand) el.hand.addEventListener('click', onHandClick);
    document.addEventListener('keydown', onKey);

    setMode('title');
  }

  // ---------------------------------------------------------------- render

  function render(state) {
    if (!el || !el.hand || !state) return;   // render before init is a no-op, never a throw
    renderClock(state.timeLeft);
    renderVitals(state);
    renderSound();
    renderAnatomy(state.body);
    renderCombat(state);
    renderExplore(state);
  }

  function renderClock(timeLeft) {
    const total = Math.max(0, Math.ceil(timeLeft || 0));
    const text = Math.floor(total / 60) + ':' + pad(total % 60);
    if (el.clockValue.textContent !== text) el.clockValue.textContent = text;
    el.clock.classList.toggle('low', total < 60);
  }

  function renderVitals(state) {
    const body = state.body;
    if (!body) return;
    const max = Math.max(1, body.maxHp || 1);
    const hp = Math.max(0, Math.round(body.hp || 0));
    el.hpFill.style.width = (Math.min(100, (hp / max) * 100)).toFixed(1) + '%';
    const text = hp + '/' + max;
    if (el.hpText.textContent !== text) el.hpText.textContent = text;
    el.hpBar.classList.toggle('low', hp / max <= 0.3);
    const cycle = 'Ciclo ' + (state.runIndex || 1);
    if (el.cycle.textContent !== cycle) el.cycle.textContent = cycle;
  }

  function renderSound() {
    const on = !(DD.Audio && typeof DD.Audio.isEnabled === 'function') || DD.Audio.isEnabled();
    el.sound.classList.toggle('off', !on);
    el.sound.setAttribute('aria-pressed', on ? 'true' : 'false');
    el.sound.title = on ? 'Sonido activado (M)' : 'Sonido silenciado (M)';
  }

  // The thermal readout: it must stay legible while fighting, so it is one line of
  // name + heat bar + numbers per slot, with a hard marker when the limb is gone.
  function renderAnatomy(body) {
    if (!body) return;
    const bound = DD.Body;
    (DD.DATA.SLOTS || []).forEach(function (key) {
      const view = slotViews[key];
      const slot = body.slots ? body.slots[key] : null;
      if (!view || !slot) return;
      const limb = bound.limbOf(body, key);
      const ratio = bound.heatRatio(body, key);
      const stump = bound.isStump(body, key);

      view.limb.textContent = limb ? limb.name : STUMP_NAME;
      view.root.style.setProperty('--tint', (limb && limb.tint) || '#4b4356');
      view.root.classList.toggle('stump', stump);
      view.root.classList.toggle('hot', ratio >= HOT_RATIO);
      view.fill.style.width = Math.round(ratio * 100) + '%';
      view.num.textContent = limb ? (slot.heat || 0) + '/' + limb.integrity : '—';
      view.root.title = (SLOT_LABEL[key] || key) + ': ' + (limb ? limb.name : STUMP_NAME);

      let mark = '';
      if (stump) mark = slot.broken ? 'ROTA' : 'VACÍA';
      view.mark.hidden = !mark;
      if (mark) view.mark.textContent = mark;
    });
  }

  function handSignature(state, combat) {
    const slots = state.body && state.body.slots ? state.body.slots : null;
    let sig = (combat.over ? 'x' : 'o') + combat.energy + '/' + combat.maxEnergy;
    for (let i = 0; i < combat.hand.length; i++) {
      const slot = combat.hand[i];
      const src = slot.source && slots ? slots[slot.source] : null;
      sig += '|' + slot.cardId + ':' + (src ? (src.heat || 0) + (src.broken ? 'B' : '') : '-');
    }
    return sig;
  }

  function cardOf(slot) {
    if (DD.Combat && typeof DD.Combat.cardOf === 'function') return DD.Combat.cardOf(slot);
    return (DD.DATA.CARDS || {})[slot.cardId] || null;
  }

  function buildHand(state, combat) {
    el.hand.textContent = '';
    playable = [];
    for (let i = 0; i < combat.hand.length; i++) {
      const slot = combat.hand[i];
      const card = cardOf(slot);
      if (!card) continue;
      const cost = card.cost || 0;
      const heat = card.heat || 0;
      const ok = !combat.over && combat.energy >= cost;
      const hot = !!slot.source && !!state.body
        && DD.Body.heatRatio(state.body, slot.source) >= HOT_RATIO;

      const btn = mk('button', 'card');
      btn.type = 'button';
      btn.setAttribute('data-index', String(i));
      btn.disabled = !ok;
      if (hot) btn.classList.add('warn');
      const label = card.name + '. Coste ' + cost + '. Calor ' + heat + '. ' + (card.text || '');
      btn.setAttribute('aria-label', label);
      btn.title = label;

      const top = mk('span', 'card-top');
      top.appendChild(mk('b', 'card-cost', String(cost)));
      top.appendChild(mk('span', 'card-name', card.name));
      top.appendChild(mk('span', 'card-heat', '°' + heat));
      btn.appendChild(top);
      btn.appendChild(mk('span', 'card-text', card.text || ''));
      el.hand.appendChild(btn);
      playable[i] = ok;
    }
  }

  function renderCombat(state) {
    const combat = state.combat;
    if (!combat) {
      if (handSig !== '') {   // leaving combat: wipe the bar once
        handSig = '';
        logSig = '';
        playable = [];
        el.hand.textContent = '';
        el.log.textContent = '';
        el.energy.textContent = '';
      }
      return;
    }
    const energy = 'Energía ' + (combat.energy || 0) + '/' + (combat.maxEnergy || 0);
    if (el.energy.textContent !== energy) el.energy.textContent = energy;

    const sig = handSignature(state, combat);
    if (sig !== handSig) {
      handSig = sig;
      buildHand(state, combat);
    }

    const lines = (combat.log || []).slice(-LOG_LINES);
    const lsig = lines.join('\n');
    if (lsig !== logSig) {
      logSig = lsig;
      el.log.textContent = '';
      lines.forEach(function (line) {
        el.log.appendChild(mk('div', 'logline', line));
      });
    }
  }

  function renderExplore(state) {
    const tower = state.tower;
    const room = tower && tower.rooms ? tower.rooms[state.posId] : null;
    const label = room ? (room.label || '') : '';
    if (el.room.textContent !== label) el.room.textContent = label;

    const open = {};
    if (tower && room && DD.Tower && typeof DD.Tower.neighbors === 'function') {
      DD.Tower.neighbors(tower, state.posId).forEach(function (n) { open[n.dir] = true; });
    }
    Object.keys(dirBtns).forEach(function (dir) {
      const btn = dirBtns[dir];
      if (!btn) return;
      const on = !!open[dir];
      btn.disabled = !on;
      btn.classList.toggle('open', on);
    });
  }

  // ---------------------------------------------------------------- input

  function onHandClick(ev) {
    const btn = ev.target && ev.target.closest ? ev.target.closest('button[data-index]') : null;
    if (!btn || btn.disabled) return;
    call(handlers.onPlayCard, Number(btn.getAttribute('data-index')));
  }

  function onKey(ev) {
    if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const key = ev.key || '';

    // An open dialog owns the keyboard: Escape backs out, Enter/Space activate the
    // focused option natively.
    if (el.dialog && !el.dialog.hidden) {
      if (key === 'Escape' && dialogCancel != null) {
        ev.preventDefault();
        pick(dialogCancel);
      }
      return;
    }

    if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
      ev.preventDefault();   // never scroll the page with Space
      if (phase === 'combat') call(handlers.onEndTurn);
      else call(handlers.onPrimary);
      return;
    }
    if (key >= '1' && key <= '9') {
      if (phase !== 'combat') return;
      const i = Number(key) - 1;
      if (playable[i]) {
        ev.preventDefault();
        call(handlers.onPlayCard, i);
      }
      return;
    }
    if (key === 'm' || key === 'M') {
      call(handlers.onToggleSound);
      return;
    }
    if (phase === 'explore') {
      const dir = MOVE_KEYS[key.toLowerCase()];
      if (dir) {
        ev.preventDefault();
        call(handlers.onMove, dir);
      }
    }
  }

  // ---------------------------------------------------------------- dialogs, toasts

  function showDialog(cfg) {
    const conf = cfg || {};
    el.dialogTitle.textContent = conf.title || '';
    el.dialogBody.textContent = conf.body || '';
    el.dialogBody.hidden = !conf.body;
    dialogCancel = conf.cancel == null ? null : conf.cancel;

    el.dialogOptions.textContent = '';
    (conf.options || []).forEach(function (opt) {
      const btn = mk('button', 'option');
      btn.type = 'button';
      btn.appendChild(mk('span', 'option-label', opt.label != null ? opt.label : String(opt.value)));
      if (opt.sub) btn.appendChild(mk('span', 'option-sub', opt.sub));
      btn.addEventListener('click', function () { pick(opt.value); });
      el.dialogOptions.appendChild(btn);
    });

    el.dialog.hidden = false;
    const first = el.dialogOptions.firstChild;
    if (first) first.focus({ preventScroll: true });
  }

  function pick(value) {
    hideDialog();
    call(handlers.onDialogPick, value);
  }

  function hideDialog() {
    if (!el || !el.dialog) return;
    el.dialog.hidden = true;
    el.dialogOptions.textContent = '';
    dialogCancel = null;
  }

  function toast(text) {
    el.toast.textContent = text == null ? '' : String(text);
    el.toast.hidden = false;
    el.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastTimer = 0;
      el.toast.classList.remove('show');
      el.toast.hidden = true;
    }, TOAST_MS);
  }

  // ---------------------------------------------------------------- modes

  function setMode(next) {
    phase = next || 'title';
    const combat = phase === 'combat';
    const explore = phase === 'explore';
    if (el.combatBar) el.combatBar.hidden = !combat;
    if (el.exploreBar) el.exploreBar.hidden = !explore;
    if (el.app) el.app.setAttribute('data-phase', phase);
  }

  DD.UI = {
    init: init,
    render: render,
    showDialog: showDialog,
    hideDialog: hideDialog,
    toast: toast,
    setMode: setMode
  };
})(window.DD);
