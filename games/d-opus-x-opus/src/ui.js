// All of the interface: HUD, anatomy panel, combat screen, card hand and the
// full-screen menus. Every screen draws itself, reads its own input and sets
// state.scene; main.js only dispatches (see the integration addenda).
// Never ctx.fillText: all text goes through render.js's bitmap font.
import { W, H, PAL, rect, line, frame, text, textW, textCenter, bar, dither } from './render.js';
import { clickIn, hit, consumeClick, pressed, toast, newRun, RUN_SECONDS } from './state.js';
import { SLOTS, family, makeBody, apMax, heatPct, integrityPct } from './body.js';
import { CARDS, LIMBS } from './cards.js';
import { roomById } from './tower.js';
import { makeRng } from './rng.js';
import { audio } from './audio.js';
import * as sprites from './sprites.js';
import * as combat from './combat.js';
import { getLang, setLang, t } from './lang.js';

/* ------------------------------------------------------------------ labels */

const SLOT_LABEL = {
  head: 'CABEZA', torso: 'TORSO', armL: 'BRAZO IZQ',
  armR: 'BRAZO DER', legL: 'PIERNA IZQ', legR: 'PIERNA DER',
};
const FAMILY_LABEL = { head: 'CABEZA', torso: 'TORSO', arm: 'BRAZO', leg: 'PIERNA' };
const FAMILY_ORDER = ['head', 'torso', 'arm', 'leg'];
const FAMILY_SLOTS = { head: ['head'], torso: ['torso'], arm: ['armL', 'armR'], leg: ['legL', 'legR'] };

const TYPE_LABEL = { attack: 'ATAQUE', skill: 'HABILIDAD', power: 'PODER' };
const TYPE_COLOR = { attack: PAL.gore, skill: PAL.cold, power: PAL.arcane };

const STATUS_KEYS = ['weak', 'frail', 'burn', 'strength', 'thorns'];
const STATUS_COLOR = {
  weak: PAL.violet, frail: PAL.flesh, burn: PAL.ember,
  strength: PAL.gore, thorns: PAL.bile,
};

/* ----------------------------------------------------------- tiny utilities */

const has = (obj, key) => !!obj && typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);
const limbBp = (id) => (has(LIMBS, id) ? LIMBS[id] : null);
const cardBp = (id) => (has(CARDS, id) ? CARDS[id] : null);
const num = (v) => (Number.isFinite(v) ? v : 0);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Hard truncation so no string can ever overflow its frame.
function clip(str, n) {
  const s = str === null || str === undefined ? '' : String(str);
  if (n <= 0) return '';
  return s.length <= n ? s : n > 1 ? s.slice(0, n - 1) + '.' : s.slice(0, 1);
}

// Words that carry no meaning once a name has to be shortened.
const FILLER_WORDS = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y']);
// Family words: the slot icon already says "arm" or "head", so the qualifier wins.
const GENERIC_WORDS = new Set([
  'CRÁNEO', 'CABEZA', 'MÁSCARA', 'TESTA', 'ROSTRO',
  'TORSO', 'PECHO', 'CAJA', 'TRONCO',
  'BRAZO', 'MANO', 'GARRA', 'PIERNA', 'PATA', 'PIE', 'ZANCA',
]);

// Deliberate abbreviation instead of a cut mid-letter: drop filler words, then
// the generic family word, and only then trim on a word boundary with a stop.
function abbrev(str, n) {
  const s = str === null || str === undefined ? '' : String(str);
  if (s.length <= n) return s;
  const words = s.split(/\s+/).filter((w) => w && !FILLER_WORDS.has(w.toUpperCase()));
  const tight = words.join(' ');
  if (tight.length <= n) return tight;
  if (words.length > 1 && GENERIC_WORDS.has(words[0].toUpperCase())) {
    const rest = words.slice(1).join(' ');
    if (rest.length <= n) return rest;
  }
  let out = '';
  for (const w of words) {
    const next = out ? out + ' ' + w : w;
    if (next.length > n - 1) break;
    out = next;
  }
  return out ? out + '.' : clip(s, n);
}

// Greedy word wrap into lines of at most n characters; long words are cut.
function wrap(str, n) {
  const out = [];
  if (n <= 0) return [''];
  let cur = '';
  for (let word of String(str === null || str === undefined ? '' : str).split(/\s+/)) {
    if (!word) continue;
    while (word.length > n) {
      if (cur) { out.push(cur); cur = ''; }
      out.push(word.slice(0, n));
      word = word.slice(n);
    }
    if (!word) continue;
    if (!cur) cur = word;
    else if (cur.length + 1 + word.length <= n) cur += ' ' + word;
    else { out.push(cur); cur = word; }
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(num(sec)));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' + r : String(r));
}

// bone over 2:00, fire under it, gore under 0:30, blinking under 0:10.
function clockColor(left, t) {
  if (left > 120) return PAL.bone;
  if (left > 30) return PAL.fire;
  if (left > 10) return PAL.gore;
  return Math.floor(num(t) * 6) % 2 === 0 ? PAL.gore : PAL.pale;
}

function currentRoom(run) {
  if (!run || !run.tower || !Array.isArray(run.tower.floors)) return null;
  return roomById(run.tower, run.roomId);
}

function limbColor(limb) {
  const bp = limb ? limbBp(limb.blueprint) : null;
  return bp && has(PAL, bp.color) ? PAL[bp.color] : PAL.ash;
}

function anyKeyPressed(state) {
  const set = state && state.input ? state.input.pressed : null;
  if (!set || !set.size) return false;
  for (const k of set) if (k !== 'm') return true;
  return false;
}

// Panel button. Draws hover/disabled states and returns true on a real click.
function button(ctx, x, y, w, h, label, accent, enabled = true) {
  const over = enabled && hit(x, y, w, h);
  const border = !enabled ? PAL.ash : over ? PAL.pale : accent || PAL.brass;
  frame(ctx, x, y, w, h, border, over ? PAL.stone : PAL.ink);
  const room = Math.max(1, Math.floor((w - 6) / 5));
  textCenter(ctx, clip(label, room), x + w / 2, y + Math.floor((h - 6) / 2), !enabled ? PAL.ash : over ? PAL.pale : PAL.bone);
  return enabled && clickIn(x, y, w, h);
}

// ES/EN switch, built from the same panel button as every other control.
// The active language keeps the bright accent; clicking it is a no-op.
function langToggle(ctx, x, y) {
  const cur = getLang();
  if (button(ctx, x, y, 30, 18, 'ES', cur === 'es' ? PAL.spark : PAL.stone) && cur !== 'es') setLang('es');
  if (button(ctx, x + 34, y, 30, 18, 'EN', cur === 'en' ? PAL.spark : PAL.stone) && cur !== 'en') setLang('en');
}

// 7x4 solid triangle; the bitmap font has no up/down arrows.
function arrow(ctx, x, y, up, col) {
  for (let i = 0; i < 4; i++) {
    const w = up ? 1 + i * 2 : 7 - i * 2;
    rect(ctx, x + 3 - (w >> 1), y + i, w, 1, col);
  }
}

// 7x7 pictogram per status, so the pairs read without words.
function statusIcon(ctx, kind, x, y) {
  const col = STATUS_COLOR[kind] || PAL.bone;
  if (kind === 'strength' || kind === 'weak') {
    arrow(ctx, x, y, kind === 'strength', col);
  } else if (kind === 'burn') {
    rect(ctx, x + 3, y, 1, 2, col);
    rect(ctx, x + 2, y + 2, 3, 2, col);
    rect(ctx, x + 1, y + 4, 5, 3, col);
  } else if (kind === 'frail') {
    rect(ctx, x + 1, y, 2, 3, col);
    rect(ctx, x + 4, y + 1, 2, 3, col);
    rect(ctx, x + 1, y + 4, 2, 3, col);
    rect(ctx, x + 4, y + 5, 2, 2, col);
  } else {
    rect(ctx, x + 3, y, 1, 7, col);
    rect(ctx, x, y + 3, 7, 1, col);
    rect(ctx, x + 1, y + 1, 1, 1, col);
    rect(ctx, x + 5, y + 1, 1, 1, col);
    rect(ctx, x + 1, y + 5, 1, 1, col);
    rect(ctx, x + 5, y + 5, 1, 1, col);
  }
}

// Icon + number pairs for one combatant's statuses, non-zero only.
// vertical stacks them in a narrow column instead of a row.
function drawStatusRow(ctx, box, x, y, vertical) {
  let cx = x, cy = y;
  for (const k of STATUS_KEYS) {
    const n = box && Number.isFinite(box[k]) ? Math.round(box[k]) : 0;
    if (n <= 0) continue;
    statusIcon(ctx, k, cx, cy);
    text(ctx, clip(String(n), 3), cx + 9, cy + 1, STATUS_COLOR[k]);
    if (vertical) cy += 8; else cx += 26;
  }
}

// Player block as a shield with the amount inside it.
function drawBlockShield(ctx, amount, x, y) {
  const n = Math.round(num(amount));
  if (n <= 0) return;
  rect(ctx, x, y, 13, 9, PAL.cold);
  rect(ctx, x + 1, y + 9, 11, 2, PAL.cold);
  rect(ctx, x + 3, y + 11, 7, 2, PAL.cold);
  rect(ctx, x + 5, y + 13, 3, 1, PAL.cold);
  textCenter(ctx, clip(String(n), 2), x + 7, y + 2, PAL.void);
}

/* ------------------------------------------------- module scene bookkeeping */

// True on the first frame the given scene is active. drawToast keeps this in
// sync for scenes with no ui.js screen (explore), so re-entering resets picks.
let seenScene = null;
function entered(scene) {
  if (seenScene === scene) return false;
  seenScene = scene;
  return true;
}

// Sample anatomy for the title screen, built once with a fixed seed.
const TITLE_RNG = makeRng(0x0deadd0c);
const TITLE_BODY = makeBody(TITLE_RNG, {});

// Slab state: chosen blueprints, list scroll and the cached preview body.
let slabPicks = [];
let slabScroll = 0;
let slabBody = null;
let slabBodyKey = null;
let wheelDelta = 0;

// Harvest state: which fallen limb is selected.
let harvestPick = -1;

// Deepest floor this run has reached (floor 0 is the bottom, so the minimum).
// Tracked here because state.run does not record it; reset when the run object changes.
let deepestRun = null;
let deepestFloor = 3;
function trackDepth(run, room) {
  if (run !== deepestRun) {
    deepestRun = run;
    deepestFloor = room ? room.floor : 3;
  } else if (room && room.floor < deepestFloor) {
    deepestFloor = room.floor;
  }
}

// The wheel is not part of state.input, so the scrollable list owns it here.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('wheel', (ev) => {
    wheelDelta += ev.deltaY > 0 ? 1 : ev.deltaY < 0 ? -1 : 0;
  }, { passive: true });
}

/* ------------------------------------------------------------- top bar: HUD */

export function drawHud(ctx, state) {
  const run = state.run;
  const left = run ? Math.max(0, num(run.timeLeft)) : RUN_SECONDS;
  const col = clockColor(left, state.t);

  rect(ctx, 0, 0, W, 18, PAL.ink);
  rect(ctx, 0, 17, W, 1, PAL.grave);

  // Left: hit points.
  const hp = run ? Math.max(0, Math.round(num(run.hp))) : 0;
  const mhp = run ? Math.max(1, Math.round(num(run.maxHp))) : 1;
  text(ctx, clip('HP ' + hp + '/' + mhp, 17), 4, 2, hp <= mhp * 0.3 ? PAL.gore : PAL.bone);
  bar(ctx, 4, 10, 93, 6, hp / mhp, PAL.gore, PAL.grave);

  // Centre: the anatomical clock.
  textCenter(ctx, fmtTime(left), 224, 3, col, 2);

  // Right: floor, short room name and how often the tower has re-wired itself.
  // Same numbering as the explore panel: floor 3 is PISO 4, floor 0 is PISO 1.
  const room = currentRoom(run);
  trackDepth(run, room);
  text(ctx, clip(t('PISO {0}', room ? room.floor + 1 : 1), 10), 300, 2, PAL.brass);
  const sh = clip(t('REORDEN {0}', run && run.tower ? Math.max(0, num(run.tower.shuffles)) : 0), 12);
  text(ctx, sh, W - 4 - textW(sh), 2, PAL.arcane);
  const nm = clip(room ? t(room.name) : t('SIN SALA'), 28);
  text(ctx, nm, W - 4 - textW(nm), 10, PAL.ash);

  // Thin draining time bar across the whole width.
  rect(ctx, 0, 19, W, 1, PAL.grave);
  const tw = Math.round(W * clamp01(left / RUN_SECONDS));
  if (tw > 0) rect(ctx, 0, 19, tw, 1, col);

  ctx.globalAlpha = 1;
}

/* -------------------------------------------------------- anatomy panel */

// 116 px wide, six 22 px rows. Called at (330, 20) in explore and in combat.
export function drawBody(ctx, state, x, y) {
  const body = state.run ? state.run.body : null;
  rect(ctx, x, y, 116, 132, PAL.ink);
  rect(ctx, x, y, 1, 132, PAL.grave);

  for (let i = 0; i < SLOTS.length; i++) {
    const slot = SLOTS[i];
    const ry = y + i * 22;
    const limb = body && body[slot] ? body[slot] : null;
    if (i > 0) rect(ctx, x + 1, ry, 114, 1, PAL.grave);

    if (typeof sprites.drawSlotIcon === 'function') {
      sprites.drawSlotIcon(ctx, x + 3, ry + 7, slot, !!limb);
    } else {
      rect(ctx, x + 3, ry + 7, 10, 10, limb ? limbColor(limb) : PAL.grave);
    }

    text(ctx, limb ? clip(abbrev(t(limb.name), 13), 13) : t('MUÑÓN'), x + 18, ry + 3, limb ? PAL.bone : PAL.ash);

    const ip = integrityPct(limb);
    text(ctx, t('I'), x + 18, ry + 10, PAL.flesh);
    bar(ctx, x + 24, ry + 10, 58, 5, ip, PAL.gore, PAL.grave);
    text(ctx, clip(limb ? limb.integrity + '/' + limb.maxIntegrity : '-', 5), x + 84, ry + 10, limb ? PAL.flesh : PAL.ash);

    const hpc = heatPct(limb);
    const hot = hpc > 0.75 ? PAL.fire : PAL.ember;
    text(ctx, t('C'), x + 18, ry + 16, hot);
    bar(ctx, x + 24, ry + 16, 58, 5, hpc, hot, PAL.grave);
    text(ctx, clip(limb ? limb.heat + '/' + limb.heatCap : '-', 5), x + 84, ry + 16, limb ? hot : PAL.ash);
  }

  ctx.globalAlpha = 1;
}

/* ---------------------------------------------------------------- combat */

function cardDef(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return cardBp(entry);
  if (entry.name && entry.type) return entry;
  return cardBp(entry.cardId || entry.id);
}

function intentLabel(c) {
  if (typeof combat.intentText === 'function') {
    const s = combat.intentText(c);
    if (s) return String(s);
  }
  const it = c ? c.intent : null;
  if (!it) return t('INTENCIÓN OCULTA');
  const times = num(it.times) > 1 ? ' X' + Math.round(it.times) : '';
  return t(it.name || 'ATAQUE') + ' ' + Math.round(num(it.amount)) + times;
}

function drawCard(ctx, state, entry, x, y, hover, active, c) {
  const def = cardDef(entry);
  const cost = def ? Math.round(num(def.ap)) : 0;
  const heat = def ? Math.round(num(def.heat)) : 0;
  const poor = c ? cost > Math.round(num(c.ap)) : true;
  const cy = hover ? y - 4 : y;
  const type = def && has(TYPE_COLOR, def.type) ? def.type : 'skill';

  ctx.save();
  ctx.globalAlpha = !active || poor ? 0.45 : 1;

  frame(ctx, x, cy, 70, 90, hover ? PAL.pale : TYPE_COLOR[type], PAL.grave);

  // Action cost, top left.
  frame(ctx, x + 3, cy + 3, 11, 11, PAL.brass, PAL.ink);
  textCenter(ctx, clip(String(cost), 2), x + 9, cy + 6, PAL.pale);

  // Heat, top right.
  statusIcon(ctx, 'burn', x + 56, cy + 4, PAL.ember);
  text(ctx, clip(String(heat), 1), x + 64, cy + 5, PAL.ember);

  rect(ctx, x + 2, cy + 15, 66, 1, PAL.stone);
  const nameLines = wrap(t(def ? def.name : 'CARTA'), 13).slice(0, 2);
  for (let i = 0; i < nameLines.length; i++) {
    text(ctx, nameLines[i], x + 2, cy + 17 + i * 7, PAL.pale);
  }

  rect(ctx, x + 2, cy + 31, 66, 1, PAL.stone);
  const descLines = wrap(def ? t(def.desc) : '', 13).slice(0, 5);
  for (let i = 0; i < descLines.length; i++) {
    text(ctx, descLines[i], x + 2, cy + 34 + i * 7, PAL.bone);
  }

  // Origin limb colour, then the card type.
  const body = state.run ? state.run.body : null;
  const slot = entry && typeof entry === 'object' ? entry.slot : null;
  rect(ctx, x + 4, cy + 80, 3, 3, body && slot && body[slot] ? limbColor(body[slot]) : PAL.ash);
  textCenter(ctx, clip(t(TYPE_LABEL[type] || 'CARTA'), 12), x + 35, cy + 79, TYPE_COLOR[type]);

  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawCombat(ctx, state) {
  entered(state.scene);
  const c = state.combat;
  const run = state.run;
  const room = currentRoom(run);
  const floor = room ? room.floor : 0;

  if (typeof sprites.drawBackdrop === 'function') {
    sprites.drawBackdrop(ctx, 0, 20, 330, 130, 'combat', floor, state.t);
  } else {
    rect(ctx, 0, 20, 330, 130, PAL.grave);
    dither(ctx, 0, 20, 330, 130, PAL.ink, 0.35);
  }
  rect(ctx, 0, 150, W, 4, PAL.ink);
  rect(ctx, 0, 154, 448, 98, PAL.void);
  drawBody(ctx, state, 330, 20);

  if (run && run.body && typeof sprites.drawAbomination === 'function') {
    const anim = c && c.anim ? c.anim : null;
    sprites.drawAbomination(ctx, 146, 114, run.body, state.t, { hurt: anim ? num(anim.flashSelf) : 0 });
  }

  if (!c) {
    textCenter(ctx, t('SIN COMBATE'), 165, 80, PAL.ash);
    ctx.globalAlpha = 1;
    return;
  }

  const foe = c.enemy || null;
  if (foe && typeof sprites.drawEnemy === 'function') {
    sprites.drawEnemy(ctx, 214, 114, foe.id, state.t, {
      hurt: c.anim ? num(c.anim.flashFoe) : 0,
      dead: c.phase === 'won' ? 1 : 0,
    });
  }

  // Enemy name, life and the telegraphed intent, above the enemy sprite.
  const nm = clip(t(foe ? foe.name : 'ENEMIGO'), 28);
  text(ctx, nm, 326 - textW(nm), 22, PAL.pale);
  const ehp = foe ? Math.max(0, Math.round(num(foe.hp))) : 0;
  const emax = foe ? Math.max(1, Math.round(num(foe.maxHp) || num(foe.hp))) : 1;
  bar(ctx, 186, 30, 140, 6, ehp / emax, PAL.gore, PAL.grave);
  const hpTxt = clip(ehp + '/' + emax, 9);
  text(ctx, hpTxt, 322 - textW(hpTxt), 30, PAL.pale);
  frame(ctx, 176, 37, 152, 13, PAL.brass, PAL.ink);
  text(ctx, clip(intentLabel(c), 29), 180, 41, PAL.fire);

  // Player block and statuses in the top left corner; the enemy's stack in the
  // narrow strip above the turn panel, so neither sits on a sprite.
  drawBlockShield(ctx, c.block, 4, 22);
  drawStatusRow(ctx, c.self, 20, 24, false);
  drawStatusRow(ctx, c.foe, 246, 56, true);

  // Harvestable enemy limbs: own opaque panel on the left, just above the log.
  const foeLimbs = foe && Array.isArray(foe.limbs) ? foe.limbs : [];
  if (foeLimbs.length) {
    frame(ctx, 2, 82, 120, 36, PAL.stone, PAL.ink);
    text(ctx, t('COSECHABLE'), 5, 84, PAL.ash);
    for (let i = 0; i < Math.min(4, foeLimbs.length); i++) {
      const L = foeLimbs[i] || {};
      const bp = limbBp(L.blueprint);
      const integ = Math.max(0, Math.round(num(L.integrity)));
      const dead = L.ruined || integ <= 0;
      const label = abbrev(t(bp ? bp.name : 'RESTO'), 19) + ' ' + integ;
      text(ctx, clip(label, 23), 5, 92 + i * 7, dead ? PAL.ash : PAL.flesh);
    }
  }

  // Last four log lines, kept inside x 4..240.
  const log = Array.isArray(c.log) ? c.log.slice(-4) : [];
  for (let i = 0; i < log.length; i++) {
    text(ctx, clip(log[i], 47), 4, 120 + i * 7, i === log.length - 1 ? PAL.bone : PAL.ash);
  }

  /* ------------------------------------------------------------ card hand */

  // Full width row: six 70x90 cards with a 3 px gap span x 4..439.
  const active = c.phase === 'player';
  const hand = Array.isArray(c.hand) ? c.hand : [];
  const n = Math.min(6, hand.length);
  const handW = n > 0 ? n * 70 + (n - 1) * 3 : 0;
  const hx0 = n >= 6 ? 4 : n > 0 ? Math.round(224 - handW / 2) : 4;

  let hoverIdx = -1;
  if (active) {
    for (let i = 0; i < n; i++) {
      if (hit(hx0 + i * 73, 154, 70, 90)) hoverIdx = i;
    }
  }
  for (let i = 0; i < n; i++) {
    drawCard(ctx, state, hand[i], hx0 + i * 73, 154, i === hoverIdx, active, c);
  }
  if (n === 0) {
    text(ctx, t('MANO VACÍA'), 8, 196, PAL.ash);
  }

  /* -------------------------------------------------- end turn and counters */

  const ap = Math.round(num(c.ap));
  const apTop = Math.round(num(c.apMax)) || (run && run.body ? apMax(run.body) : 3);
  const pile = Array.isArray(c.drawPile) ? c.drawPile.length : 0;
  const disc = Array.isArray(c.discard) ? c.discard.length : 0;
  const phaseTxt = t(active ? 'TU TURNO' : c.phase === 'enemy' ? 'ENEMIGO ACTÚA' : c.phase === 'won' ? 'HA CAÍDO' : 'FIN');

  // Opaque turn panel at x 246..327, y 96..124: it must hide whatever is behind,
  // so the plate itself is painted at full alpha even while the block is dimmed.
  frame(ctx, 246, 96, 82, 29, PAL.stone, PAL.ink);
  ctx.save();
  ctx.globalAlpha = active ? 1 : 0.45;
  const column = [
    [t('ACCIONES: {0}/{1}', ap, apTop), PAL.spark],
    [t('MAZO: {0}', pile), PAL.bone],
    [t('DESCARTE: {0}', disc), PAL.bone],
    [phaseTxt, active ? PAL.ichor : PAL.gore],
  ];
  for (let i = 0; i < column.length; i++) {
    const s = clip(column[i][0], 15);
    text(ctx, s, 325 - textW(s), 98 + i * 7, column[i][1]);
  }
  const overBtn = active && hit(246, 126, 81, 23);
  frame(ctx, 246, 126, 81, 23, active ? (overBtn ? PAL.pale : PAL.brass) : PAL.ash, overBtn ? PAL.stone : PAL.ink);
  textCenter(ctx, t('FIN DE TURNO'), 286, 134, active ? (overBtn ? PAL.pale : PAL.bone) : PAL.ash);
  ctx.restore();
  ctx.globalAlpha = 1;

  /* ------------------------------------------------------------------ input */

  if (!active) return;

  if (clickIn(246, 126, 81, 23) || pressed(' ')) {
    if (typeof combat.endTurn === 'function') combat.endTurn(state);
    return;
  }
  for (let i = 0; i < n; i++) {
    if (!clickIn(hx0 + i * 73, 154, 70, 90)) continue;
    if (typeof combat.playCard !== 'function') break;
    const res = combat.playCard(state, i);
    if (res && res.ok === false) toast(res.reason || t('NO PUEDES JUGAR ESA CARTA'));
    break;
  }
}

/* ----------------------------------------------------------------- title */

export function drawTitle(ctx, state) {
  entered(state.scene);
  rect(ctx, 0, 0, W, H, PAL.void);
  if (typeof sprites.drawBackdrop === 'function') {
    sprites.drawBackdrop(ctx, 0, 0, W, H, 'slab', 3, state.t);
  }
  dither(ctx, 0, 170, W, 82, PAL.grave, 0.45);

  // Dark plates under every text block: the brick backdrop eats grey on grey.
  frame(ctx, 92, 0, 264, 42, PAL.stone, PAL.ink);
  textCenter(ctx, 'DEADLOCK DECK', 224, 12, PAL.gore, 2);
  textCenter(ctx, t('EL RELOJ ANATÓMICO'), 224, 30, PAL.brass, 1);

  if (typeof sprites.drawAbomination === 'function') {
    sprites.drawAbomination(ctx, 86, 198, TITLE_BODY, state.t);
  }
  if (typeof sprites.drawFlame === 'function') {
    sprites.drawFlame(ctx, 22, 206, 22, state.t);
    sprites.drawFlame(ctx, 150, 206, 22, state.t + 0.7);
  }

  frame(ctx, 170, 46, 214, 130, PAL.stone, PAL.ink);
  const synopsis = [
    'DESPIERTAS COSIDO EN LA TORRE DEL',
    'ALQUIMISTA, CON PIEZAS QUE NO SON TUYAS.',
    'SEIS MINUTOS ANTES DE QUE TODO FALLE.',
  ];
  for (let i = 0; i < synopsis.length; i++) {
    text(ctx, clip(t(synopsis[i]), 40), 176, 52 + i * 9, PAL.bone);
  }

  const meta = state.meta || {};
  const found = meta.blueprints ? Object.keys(meta.blueprints).filter((k) => limbBp(k)).length : 0;
  const total = Object.keys(LIMBS).length;
  text(ctx, clip(t('PLANOS DESCUBIERTOS: {0}/{1}', found, total), 40), 176, 88, PAL.ichor);
  text(ctx, clip(t('FUGAS: {0}   MESAS: {1}', Math.round(num(meta.escapes)), Math.round(num(meta.runs))), 40), 176, 98, PAL.acid);
  if (Number.isFinite(meta.bestTime)) {
    text(ctx, clip(t('MEJOR FUGA: {0}', fmtTime(meta.bestTime)), 40), 176, 108, PAL.spark);
  }

  text(ctx, t('CONTROLES'), 176, 126, PAL.pale);
  const keys = [
    'RATÓN: ELEGIR SALA Y JUGAR CARTAS',
    'ESPACIO: FIN DE TURNO',
    '1-6: SALAS VECINAS    F: BAJAR',
    'FLECHAS: LISTAS    M: SILENCIO',
  ];
  for (let i = 0; i < keys.length; i++) {
    text(ctx, clip(t(keys[i]), 40), 176, 138 + i * 9, PAL.ash);
  }

  // The language switch goes first: it eats its own click so it can never wake the body.
  langToggle(ctx, 378, 4);

  const blink = Math.floor(num(state.t) * 2) % 2 === 0;
  const overWake = hit(160, 218, 128, 20);
  frame(ctx, 160, 218, 128, 20, overWake || blink ? PAL.spark : PAL.brass, PAL.ink);
  textCenter(ctx, t('[ DESPERTAR ]'), 224, 225, overWake || blink ? PAL.pale : PAL.bone);

  // The concrete rect is tested first; the catch-all click comes last, so the
  // button can never be starved by the single click this frame allows.
  let wake = clickIn(160, 218, 128, 20);
  if (!wake) wake = consumeClick();
  if (!wake) wake = anyKeyPressed(state);
  if (wake) {
    state.scene = 'slab'; // scene first: a failing audio stack must not strand the title
    audio.init();
    audio.startMusic();
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------ dissection slab */

// picks as { slot: blueprintId }: arms fill armL then armR, legs legL then legR.
function picksMap(list) {
  const out = {};
  for (const id of list) {
    const bp = limbBp(id);
    if (!bp) continue;
    const slots = FAMILY_SLOTS[bp.slot] || [];
    for (const slot of slots) {
      if (!has(out, slot)) { out[slot] = id; break; }
    }
  }
  return out;
}

function freeSlotFor(id) {
  const bp = limbBp(id);
  if (!bp) return null;
  const taken = picksMap(slabPicks);
  const slots = FAMILY_SLOTS[bp.slot] || [];
  for (const slot of slots) if (!has(taken, slot)) return slot;
  return null;
}

function togglePick(id) {
  const at = slabPicks.indexOf(id);
  if (at >= 0) { slabPicks.splice(at, 1); return; }
  if (slabPicks.length >= 3) { toast(t('YA HAS ELEGIDO TRES PLANOS')); return; }
  if (!freeSlotFor(id)) { toast(t('NO QUEDA HUECO DE ESA FAMILIA')); return; }
  slabPicks.push(id);
}

// Preview anatomy, rebuilt only when the picks change.
function previewBody() {
  const key = slabPicks.join(',');
  if (key !== slabBodyKey || !slabBody) {
    slabBodyKey = key;
    slabBody = makeBody(makeRng(0x51ab0deb), picksMap(slabPicks));
  }
  return slabBody;
}

export function drawSlab(ctx, state) {
  if (entered(state.scene)) {
    slabPicks = [];
    slabScroll = 0;
    slabBodyKey = null;
    wheelDelta = 0;
  }

  rect(ctx, 0, 0, W, H, PAL.void);
  if (typeof sprites.drawBackdrop === 'function') {
    sprites.drawBackdrop(ctx, 0, 0, W, H, 'slab', 3, state.t);
  }
  dither(ctx, 0, 0, W, H, PAL.ink, 0.25);

  frame(ctx, 92, 0, 264, 26, PAL.stone, PAL.ink);
  textCenter(ctx, t('MESA DE DISECCIÓN'), 224, 2, PAL.bone, 2);

  // Anatomy preview on the left.
  frame(ctx, 4, 26, 112, 174, PAL.stone, PAL.ink);
  textCenter(ctx, t('CUERPO NUEVO'), 60, 30, PAL.ash);
  if (typeof sprites.drawAbomination === 'function') {
    sprites.drawAbomination(ctx, 60, 192, previewBody(), state.t);
  }

  const meta = state.meta || {};
  const known = meta.blueprints || {};
  const ids = Object.keys(known).filter((id) => known[id] && limbBp(id));
  const lx = 120, ly = 26, lw = 324, lh = 174;
  frame(ctx, lx, ly, lw, lh, PAL.stone, PAL.ink);

  if (!ids.length) {
    textCenter(ctx, t('AÚN NO GUARDAS PLANOS: COSECHA UN CADÁVER PARA RETENERLOS.'), 282, 100, PAL.ash);
    textCenter(ctx, t('ESTA VEZ DESPERTARÁS CON PIEZAS DE TIER 1 AL AZAR.'), 282, 112, PAL.ash);
  } else {
    // Flat row list: one header per family, then its blueprints.
    const rows = [];
    for (const fam of FAMILY_ORDER) {
      const group = ids.filter((id) => LIMBS[id].slot === fam)
        .sort((a, b) => LIMBS[a].tier - LIMBS[b].tier || (t(LIMBS[a].name) < t(LIMBS[b].name) ? -1 : 1));
      if (!group.length) continue;
      rows.push({ header: t(FAMILY_LABEL[fam]) + ' (' + group.length + ')' });
      for (const id of group) rows.push({ id });
    }

    const rowH = 10, visible = Math.floor((lh - 4) / rowH);

    // Scrolling: wheel, arrow keys, or the two arrow buttons.
    const maxScroll = Math.max(0, rows.length - visible);
    if (wheelDelta) { slabScroll += wheelDelta; wheelDelta = 0; }
    if (pressed('ArrowUp')) slabScroll -= 1;
    if (pressed('ArrowDown')) slabScroll += 1;
    if (maxScroll > 0) {
      if (clickIn(lx + lw - 11, ly + 2, 10, 10)) slabScroll -= 1;
      if (clickIn(lx + lw - 11, ly + lh - 12, 10, 10)) slabScroll += 1;
      arrow(ctx, lx + lw - 10, ly + 5, true, PAL.brass);
      arrow(ctx, lx + lw - 10, ly + lh - 9, false, PAL.brass);
    }
    slabScroll = Math.max(0, Math.min(maxScroll, slabScroll));

    const rowW = lw - 14;
    for (let i = 0; i < visible; i++) {
      const row = rows[slabScroll + i];
      if (!row) break;
      const ry = ly + 3 + i * rowH;
      if (row.header) {
        text(ctx, clip(row.header, 62), lx + 3, ry + 2, PAL.brass);
        continue;
      }
      const bp = LIMBS[row.id];
      const picked = slabPicks.indexOf(row.id) >= 0;
      const over = hit(lx + 2, ry, rowW, rowH);
      if (picked) rect(ctx, lx + 2, ry, rowW, rowH, PAL.violet);
      else if (over) rect(ctx, lx + 2, ry, rowW, rowH, PAL.grave);
      const info = (picked ? '*' : ' ') + clip(t(bp.name), 18)
        + t('  T{0}  INT {1}  CAL {2}', bp.tier, bp.integrity, bp.heatCap)
        + (num(bp.hpBonus) > 0 ? '  HP+' + bp.hpBonus : '');
      text(ctx, clip(info, 60), lx + 4, ry + 2, picked ? PAL.pale : PAL.bone);
      if (clickIn(lx + 2, ry, rowW, rowH)) togglePick(row.id);
    }
  }

  // Chosen summary. Everything stays above y=230: that band is the button's.
  frame(ctx, 0, 200, W, 28, PAL.stone, PAL.ink);
  text(ctx, clip(t('ELEGIDOS {0}/3', slabPicks.length), 20), 4, 202, PAL.spark);
  const map = picksMap(slabPicks);
  const parts = [];
  for (const slot of SLOTS) {
    if (!has(map, slot)) continue;
    const bp = limbBp(map[slot]);
    parts.push(t(SLOT_LABEL[slot]) + '=' + clip(bp ? t(bp.name) : '?', 14));
  }
  text(ctx, clip(parts.length ? parts.join('  ') : t('EL RESTO SERÁ TIER 1 AL AZAR'), 86), 4, 211, PAL.bone);
  text(ctx, clip(t('VUELVE A PULSAR UN PLANO PARA DESCARTARLO. EL RESTO DE SLOTS SERÁ TIER 1.'), 86), 4, 220, PAL.ash);

  langToggle(ctx, 8, 231);

  if (button(ctx, 300, 231, 140, 18, t('[ REANIMAR ]'), PAL.gore) || pressed('Enter')) {
    newRun(Date.now() % 1e9, picksMap(slabPicks));
    state.scene = 'explore';
    audio.startMusic();
  }
  ctx.globalAlpha = 1;
}

/* ---------------------------------------------------------------- harvest */

export function drawHarvest(ctx, state) {
  if (entered(state.scene)) harvestPick = -1;

  rect(ctx, 0, 0, W, H, PAL.void);
  const room = currentRoom(state.run);
  if (typeof sprites.drawBackdrop === 'function') {
    sprites.drawBackdrop(ctx, 0, 0, W, H, room ? room.type : 'combat', room ? room.floor : 0, state.t);
  }
  dither(ctx, 0, 0, W, H, PAL.ink, 0.3);

  const h = state.harvest;
  const limbs = h && Array.isArray(h.limbs) ? h.limbs : [];
  const fallen = t((h && (h.enemyName || (h.enemy && h.enemy.name)))
    || (state.combat && state.combat.enemy && state.combat.enemy.name)
    || 'EL CADÁVER');

  frame(ctx, 60, 0, 328, 40, PAL.stone, PAL.ink);
  textCenter(ctx, t('COSECHA'), 224, 4, PAL.gore, 2);
  textCenter(ctx, clip(t('HA CAÍDO: {0}', fallen), 40), 224, 20, PAL.bone);
  textCenter(ctx, t('EL RELOJ ESTÁ PARADO MIENTRAS CORTAS'), 224, 30, PAL.ichor);

  const body = state.run ? state.run.body : null;
  if (harvestPick >= limbs.length) harvestPick = -1;

  // Wide selectable cards, one per salvageable limb.
  for (let i = 0; i < Math.min(4, limbs.length); i++) {
    const L = limbs[i] || {};
    const bp = limbBp(L.blueprint);
    const integ = Math.max(0, Math.round(num(L.integrity)));
    const ruined = !!L.ruined || integ <= 0;
    const cy = 42 + i * 37;
    const sel = harvestPick === i;
    const over = !ruined && hit(8, cy, 212, 34);

    frame(ctx, 8, cy, 212, 34, ruined ? PAL.ash : sel ? PAL.spark : over ? PAL.pale : PAL.brass, sel ? PAL.stone : PAL.ink);
    text(ctx, clip(t(bp ? bp.name : 'RESTO SIN NOMBRE'), 22), 12, cy + 3, ruined ? PAL.ash : PAL.pale);
    if (ruined) text(ctx, t('INSERVIBLE'), 152, cy + 3, PAL.gore);

    const fam = t(bp ? FAMILY_LABEL[bp.slot] || '?' : '?');
    const maxI = bp ? bp.integrity : integ;
    text(ctx, clip(fam + '   TIER ' + (bp ? bp.tier : 1) + '   INT ' + integ + '/' + maxI, 40), 12, cy + 12, ruined ? PAL.ash : PAL.flesh);

    const names = bp && Array.isArray(bp.cards)
      ? bp.cards.map((id) => (cardBp(id) ? t(CARDS[id].name) : id)).join(', ')
      : '';
    text(ctx, clip(t('CARTAS: {0}', names), 40), 12, cy + 21, ruined ? PAL.ash : PAL.cold);

    if (ruined) line(ctx, 10, cy + 17, 217, cy + 17, PAL.gore);
    else if (clickIn(8, cy, 212, 34)) harvestPick = harvestPick === i ? -1 : i;
  }
  if (!limbs.length) {
    frame(ctx, 8, 42, 212, 20, PAL.stone, PAL.ink);
    text(ctx, t('NO QUEDA NADA APROVECHABLE.'), 12, 48, PAL.ash);
  }

  // Destination picker: the six slots with their current occupant.
  const chosen = harvestPick >= 0 ? limbs[harvestPick] : null;
  const chosenBp = chosen ? limbBp(chosen.blueprint) : null;
  frame(ctx, 224, 38, 220, 14, PAL.stone, PAL.ink);
  if (chosenBp) {
    text(ctx, t('ELIGE DÓNDE INJERTARLO'), 228, 42, PAL.pale);
    for (let i = 0; i < SLOTS.length; i++) {
      const slot = SLOTS[i];
      const ry = 54 + i * 22;
      const ok = family(slot) === chosenBp.slot;
      const limb = body && body[slot] ? body[slot] : null;
      const over = ok && hit(228, ry, 212, 20);
      frame(ctx, 228, ry, 212, 20, ok ? (over ? PAL.pale : PAL.ichor) : PAL.grave, over ? PAL.stone : PAL.ink);
      text(ctx, clip(t(SLOT_LABEL[slot]), 14), 232, ry + 3, ok ? PAL.bone : PAL.ash);
      text(ctx, clip(t(limb ? limb.name : 'LIBRE'), 18), 232, ry + 11, !ok ? PAL.ash : limb ? PAL.flesh : PAL.acid);
      if (limb) {
        const iTxt = clip(limb.integrity + '/' + limb.maxIntegrity, 5);
        text(ctx, iTxt, 436 - textW(iTxt), ry + 11, ok ? PAL.flesh : PAL.ash);
      }
      if (ok && clickIn(228, ry, 212, 20) && typeof combat.applyHarvest === 'function') {
        combat.applyHarvest(state, harvestPick, slot);
        harvestPick = -1;
      }
    }
  } else {
    text(ctx, t('ELIGE UNA EXTREMIDAD DE LA IZQUIERDA'), 228, 42, PAL.ash);
    const hintLines = wrap(t('LO QUE CORTAS QUEDA ANOTADO EN TUS PLANOS Y PODRÁS ELEGIRLO EN LA PRÓXIMA MESA DE DISECCIÓN.'), 40).slice(0, 4);
    frame(ctx, 224, 54, 220, 8 + hintLines.length * 9, PAL.stone, PAL.ink);
    for (let i = 0; i < hintLines.length; i++) {
      text(ctx, hintLines[i], 228, 58 + i * 9, PAL.ash);
    }
  }

  if (button(ctx, 140, 228, 168, 18, t('[ DEJAR EL CADÁVER ]'), PAL.stone)) {
    if (typeof combat.skipHarvest === 'function') combat.skipHarvest(state);
    else { state.harvest = null; state.scene = 'explore'; }
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------ run summary */

function runStats(state, escaped) {
  const run = state.run;
  const meta = state.meta || {};
  const spent = run ? RUN_SECONDS - Math.max(0, num(run.timeLeft)) : 0;
  const room = currentRoom(run);
  // Deepest floor reached, numbered like the rest of the game: floor 0 is PISO 1.
  const reached = (run && run === deepestRun ? deepestFloor : room ? room.floor : 3) + 1;
  const found = meta.blueprints ? Object.keys(meta.blueprints).filter((k) => limbBp(k)).length : 0;
  return [
    t(escaped ? 'TIEMPO EN LA TORRE: {0}' : 'TIEMPO SOBREVIVIDO: {0}', fmtTime(spent)),
    t('PISO ALCANZADO: {0}', reached),
    t('ENEMIGOS COSECHADOS: {0}', run ? Math.round(num(run.kills)) : 0),
    t('INJERTOS: {0}', run ? Math.round(num(run.grafts)) : 0),
    t('PLANOS DESCUBIERTOS: {0}/{1}', found, Object.keys(LIMBS).length),
  ];
}

export function drawDeath(ctx, state) {
  entered(state.scene);
  rect(ctx, 0, 0, W, H, PAL.void);
  dither(ctx, 0, 0, W, H, PAL.blood, 0.18);

  textCenter(ctx, t('TU CUERPO FALLA'), 224, 26, PAL.gore, 2);
  frame(ctx, 72, 38, 304, 132, PAL.stone, PAL.ink);
  const timeout = state.run ? num(state.run.timeLeft) <= 0 : true;
  textCenter(ctx, t(timeout ? 'EL RELOJ LLEGÓ A CERO' : 'TE DESTRUYERON'), 224, 46, PAL.fire);

  const stats = runStats(state, false);
  for (let i = 0; i < stats.length; i++) {
    textCenter(ctx, clip(stats[i], 40), 224, 72 + i * 11, PAL.bone);
  }

  textCenter(ctx, t('TU ESPÍRITU SE TRASLADA A UNA MESA NUEVA.'), 224, 146, PAL.arcane);
  textCenter(ctx, t('LOS PLANOS QUE CORTASTE TE SIGUEN.'), 224, 158, PAL.ichor);

  if (button(ctx, 140, 198, 168, 20, t('[ NUEVA MESA DE DISECCIÓN ]'), PAL.gore) || pressed('Enter')) {
    state.scene = 'slab';
  }
  ctx.globalAlpha = 1;
}

export function drawEscape(ctx, state) {
  entered(state.scene);
  rect(ctx, 0, 0, W, H, PAL.void);
  dither(ctx, 0, 0, W, H, PAL.violet, 0.2);

  textCenter(ctx, t('HAS ESCAPADO'), 224, 26, PAL.ichor, 2);
  frame(ctx, 72, 38, 304, 132, PAL.stone, PAL.ink);
  const left = state.run ? Math.max(0, num(state.run.timeLeft)) : 0;
  textCenter(ctx, clip(t('EL RELOJ SE DETUVO EN {0}', fmtTime(left)), 40), 224, 46, PAL.acid);

  const stats = runStats(state, true);
  for (let i = 0; i < stats.length; i++) {
    textCenter(ctx, clip(stats[i], 40), 224, 72 + i * 11, PAL.bone);
  }

  // meta.bestTime stores the time SPENT on the fastest escape, not what was left.
  const meta = state.meta || {};
  const best = Number.isFinite(meta.bestTime) ? fmtTime(meta.bestTime) : t('NINGUNA');
  textCenter(ctx, clip(t('MEJOR FUGA: {0}', best), 40), 224, 146, PAL.spark);
  textCenter(ctx, clip(t('FUGAS: {0}', Math.round(num(meta.escapes))), 40), 224, 158, PAL.arcane);

  if (button(ctx, 164, 198, 120, 20, t('[ OTRA VEZ ]'), PAL.ichor) || pressed('Enter')) {
    state.scene = 'slab';
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ toast */

export function drawToast(ctx, state) {
  entered(state.scene); // keeps scene tracking alive for scenes ui.js does not draw
  const t = state.toast;
  if (!t || !t.text) { ctx.globalAlpha = 1; return; }

  const max = num(t.max) > 0 ? num(t.max) : num(t.ttl) > 0 ? num(t.ttl) : 1;
  const txt = clip(t.text, 42);
  const w = textW(txt) + 12;
  const x = Math.round(224 - w / 2);
  // The end screens own the top of the canvas, so the toast drops below them.
  const y = state.scene === 'death' || state.scene === 'escape' ? 176 : 30;

  ctx.save();
  ctx.globalAlpha = Math.max(0.12, clamp01(num(t.ttl) / max));
  frame(ctx, x, y, w, 14, PAL.brass, PAL.ink);
  textCenter(ctx, txt, 224, y + 4, PAL.pale);
  ctx.restore();
  ctx.globalAlpha = 1;
}
