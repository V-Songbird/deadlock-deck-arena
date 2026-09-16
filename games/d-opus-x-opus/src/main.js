// Entry point: canvas boot, input pump, the six minute clock, scene dispatch.
import { initCanvas, toGame, clear, W, H, PAL } from './render.js';
import { state, loadMeta, toast, RUN_SECONDS } from './state.js';
import { shuffleTower } from './tower.js';
import { audio } from './audio.js';
import * as explore from './explore.js';
import * as combat from './combat.js';
import * as ui from './ui.js';

const canvas = document.getElementById('game');
const ctx = initCanvas(canvas);

loadMeta();

// ---------------------------------------------------------------- input pump

function setMouse(ev) {
  const p = toGame(canvas, ev.clientX, ev.clientY);
  state.input.mx = p.x;
  state.input.my = p.y;
}

canvas.addEventListener('mousemove', setMouse);
canvas.addEventListener('mousedown', (ev) => {
  setMouse(ev);
  state.input.down = true;
  audio.init();
});
window.addEventListener('mouseup', () => {
  if (state.input.down) state.input.clicked = true;
  state.input.down = false;
});
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

// Touch maps onto the same click model so phones work.
canvas.addEventListener('touchstart', (ev) => {
  ev.preventDefault();
  setMouse(ev.changedTouches[0]);
  state.input.down = true;
  audio.init();
}, { passive: false });
canvas.addEventListener('touchend', (ev) => {
  ev.preventDefault();
  setMouse(ev.changedTouches[0]);
  state.input.down = false;
  state.input.clicked = true;
}, { passive: false });

window.addEventListener('keydown', (ev) => {
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  if (k === ' ' || k.startsWith('Arrow')) ev.preventDefault();
  if (!state.input.keys.has(k)) state.input.pressed.add(k);
  state.input.keys.add(k);
  audio.init();
  if (k === 'm') toast(audio.toggleMute() ? 'SILENCIO' : 'SONIDO');
});
window.addEventListener('keyup', (ev) => {
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  state.input.keys.delete(k);
});
window.addEventListener('blur', () => {
  state.input.keys.clear();
  state.input.down = false;
});

// ------------------------------------------------------------------ the clock

const TICKING = new Set(['explore', 'combat']);

function tickClock(dt) {
  const run = state.run;
  if (!run || !TICKING.has(state.scene)) return;

  run.timeLeft = Math.max(0, run.timeLeft - dt);
  audio.setTension(1 - run.timeLeft / RUN_SECONDS);

  // The maze in constant flux: relink the corridors every 45 seconds.
  if (run.timeLeft <= run.shuffleAt && run.timeLeft > 0) {
    run.shuffleAt -= 45;
    shuffleTower(run.tower, run.rng, run.roomId);
    toast('LA TORRE SE REORDENA', 2.6);
    audio.sfx('trap');
  }

  if (run.timeLeft <= 0 || run.hp <= 0) die();
}

function die() {
  state.combat = null;
  state.harvest = null;
  state.scene = 'death';
  audio.stopMusic();
  audio.sfx('death');
  state.toast = null; // the death screen states the reason itself; a toast would sit on its title
}

// ------------------------------------------------------------------ main loop

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.t += dt;

  tickClock(dt);

  clear(ctx, PAL.void);

  switch (state.scene) {
    case 'title':
      ui.drawTitle(ctx, state);
      break;
    case 'slab':
      ui.drawSlab(ctx, state);
      break;
    case 'explore':
      explore.update(state, dt);
      explore.draw(ctx, state);
      ui.drawBody(ctx, state, 330, 20); // explore.js owns x 0..329 only
      ui.drawHud(ctx, state);
      break;
    case 'combat':
      combat.tick(state, dt);
      ui.drawCombat(ctx, state);
      ui.drawHud(ctx, state);
      break;
    case 'harvest':
      ui.drawHarvest(ctx, state);
      break;
    case 'death':
      ui.drawDeath(ctx, state);
      break;
    case 'escape':
      ui.drawEscape(ctx, state);
      break;
    default:
      state.scene = 'title';
  }

  if (state.toast) {
    state.toast.ttl -= dt;
    if (state.toast.ttl <= 0) state.toast = null;
  }
  ui.drawToast(ctx, state);

  // Unconsumed input expires at the end of the frame.
  state.input.clicked = false;
  state.input.pressed.clear();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Surface module errors on the canvas instead of dying silently.
window.addEventListener('error', (ev) => {
  console.error(ev.error || ev.message);
});

export { ctx, canvas, die };
