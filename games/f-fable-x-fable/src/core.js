// Deadlock Deck: El Reloj Anatómico — shared namespace, constants and helpers.
// Every other script attaches to window.DD. Loaded right after src/i18n.js (which creates
// window.DD and DD.t), so it merges into the namespace instead of replacing it.
window.DD = Object.assign(window.DD, {
  W: 640, H: 360,                 // logical resolution (pixel-art buffer)
  RUN_SECONDS: 360,               // the 6-minute clock
  MUTATE_EVERY: 45,               // seconds between tower mutations
  FLOORS: 3,
  SLOTS: ['head', 'torso', 'armL', 'armR', 'legL', 'legR'],
  SLOT_TYPE: { head: 'head', torso: 'torso', armL: 'arm', armR: 'arm', legL: 'leg', legR: 'leg' },
  SLOT_NAME: { head: DD.t('Cabeza'), torso: DD.t('Torso'), armL: DD.t('Brazo izq.'), armR: DD.t('Brazo der.'), legL: DD.t('Pierna izq.'), legR: DD.t('Pierna der.') },
  run: null,                      // current run state (see docs/architecture.md)
  screen: null,                   // active screen: { update(dt), draw(ctx) }
  setScreen(s) { DD.screen = s; },
  rand(n) { return Math.floor(Math.random() * n); },
  pick(a) { return a[Math.floor(Math.random() * a.length)]; },
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  chance(p) { return Math.random() < p; },
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
  log(msg) { if (!DD.run) return; DD.run.log.push(msg); if (DD.run.log.length > 6) DD.run.log.shift(); },
});
