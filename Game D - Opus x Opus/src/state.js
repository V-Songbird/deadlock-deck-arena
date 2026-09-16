// Global mutable game state plus the small helpers every scene shares.
import { makeRng } from './rng.js';
import { makeBody, maxHp } from './body.js';
import { generateTower } from './tower.js';

export const RUN_SECONDS = 360; // the six minute anatomical clock

const SAVE_KEY = 'deadlock-deck-meta';

export const state = {
  scene: 'title',
  meta: { blueprints: {}, runs: 0, escapes: 0, bestTime: null },
  run: null,
  combat: null,
  harvest: null,
  input: {
    mx: 0,
    my: 0,
    down: false,
    clicked: false,
    keys: new Set(),
    pressed: new Set(),
  },
  t: 0,
  toast: null,
};

// picks: { slot: blueprintId } chosen by the player on the slab.
export function newRun(seed = Date.now() % 1e9, picks = {}) {
  const rng = makeRng(seed);
  const body = makeBody(rng, picks);
  const tower = generateTower(rng);
  state.run = {
    seed,
    rng,
    tower,
    roomId: tower.startRoomId,
    body,
    hp: maxHp(body),
    maxHp: maxHp(body),
    timeLeft: RUN_SECONDS,
    shuffleAt: RUN_SECONDS - 45, // next tower reshuffle, counted down
    elixirs: 0,
    guardAlive: true, // the archialchemist still holds the exit
    kills: 0,
    grafts: 0,
  };
  state.combat = null;
  state.harvest = null;
  state.meta.runs += 1;
  saveMeta();
  return state.run;
}

export function toast(text, ttl = 2.2) {
  state.toast = { text, ttl, max: ttl };
}

export function consumeClick() {
  if (!state.input.clicked) return false;
  state.input.clicked = false;
  return true;
}

export function hit(x, y, w, h) {
  const { mx, my } = state.input;
  return mx >= x && mx < x + w && my >= y && my < y + h;
}

export function clickIn(x, y, w, h) {
  return hit(x, y, w, h) && consumeClick();
}

export function pressed(key) {
  return state.input.pressed.has(key);
}

export function discover(blueprintId) {
  if (!blueprintId || state.meta.blueprints[blueprintId]) return false;
  state.meta.blueprints[blueprintId] = true;
  saveMeta();
  return true;
}

export function saveMeta() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state.meta));
  } catch {
    /* storage unavailable, meta stays in memory only */
  }
}

export function loadMeta() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return state.meta;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      state.meta.blueprints = parsed.blueprints && typeof parsed.blueprints === 'object' ? parsed.blueprints : {};
      state.meta.runs = Number(parsed.runs) || 0;
      state.meta.escapes = Number(parsed.escapes) || 0;
      state.meta.bestTime = typeof parsed.bestTime === 'number' ? parsed.bestTime : null;
    }
  } catch {
    /* corrupt save, start fresh */
  }
  return state.meta;
}
