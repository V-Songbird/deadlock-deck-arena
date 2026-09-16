// combat.js - Deadlock Deck: turn based anatomical deck building combat.
//
// Every card in the deck remembers the body slot it came from, so its heat lands
// on that limb: spam one arm and the arm tears off, taking its cards with it.
//
// Code and comments are English; log lines, toasts and intentText are Spanish.

import { CARDS, LIMBS, ENEMIES } from './cards.js';
import {
  SLOTS, family, deck, handSize, maxHp, apMax, incomingMultiplier,
  addHeat, coolAll, damageLimb, repairLimb, graft, stumps,
} from './body.js';
import { toast, discover, saveMeta, RUN_SECONDS } from './state.js';
import { audio } from './audio.js';

const ENEMY_DELAY = 0.5;   // seconds of enemy animation before the intent lands
const WIN_DELAY = 0.6;     // seconds on the corpse before harvest or escape
const LOG_LINES = 6;
const LOG_WIDTH = 34;
const FALLBACK_ENEMY = 'injertado';

const STATUSES = ['weak', 'frail', 'burn', 'strength', 'thorns'];
const TIMED = ['weak', 'frail', 'burn']; // statuses that count down each round

const SLOT_NAMES = {
  head: 'CRÁNEO', torso: 'TORSO',
  armL: 'BRAZO IZQ', armR: 'BRAZO DER',
  legL: 'PIERNA IZQ', legR: 'PIERNA DER',
};

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const up = (s) => String(s == null ? '' : s).toUpperCase();
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function blankStatus() {
  return { weak: 0, frail: 0, burn: 0, strength: 0, thorns: 0 };
}

function stumpSet(body) {
  const list = stumps(body);
  return new Set(Array.isArray(list) ? list : []);
}

function occupied(body, slot) {
  return SLOTS.includes(slot) && !stumpSet(body).has(slot);
}

function limbName(blueprintId) {
  const bp = LIMBS[blueprintId];
  return bp && bp.name ? bp.name : blueprintId;
}

// The limb's own name when body.js keys limbs by slot, else the slot label.
function limbLabel(body, slot) {
  const limb = body && body[slot];
  return up(limb && limb.name ? limb.name : SLOT_NAMES[slot] || slot);
}

function pushLog(combat, line) {
  combat.log.push(up(line).slice(0, LOG_WIDTH));
  if (combat.log.length > LOG_LINES) combat.log.splice(0, combat.log.length - LOG_LINES);
}

function deny(reason) {
  audio.sfx('deny');
  return { ok: false, reason };
}

/* ------------------------------------------------------------------ */
/* Damage maths                                                        */
/* ------------------------------------------------------------------ */

// Outgoing damage of whoever owns `st`: strength adds, weak cuts a quarter.
function outgoing(amount, st) {
  const s = st || blankStatus();
  return Math.max(0, Math.round((num(amount) + num(s.strength)) * (s.weak > 0 ? 0.75 : 1)));
}

// Raw hit on the enemy: frail amplifies, its own block soaks first.
// `retaliate` false breaks the thorns ping-pong.
function damageEnemy(state, raw, retaliate) {
  const c = state.combat;
  let dmg = Math.max(0, Math.round(num(raw) * (c.foe.frail > 0 ? 1.25 : 1)));
  if (dmg > 0) {
    const absorbed = Math.min(c.foeBlock, dmg);
    c.foeBlock -= absorbed;
    dmg -= absorbed;
    if (dmg > 0) {
      c.enemy.hp -= dmg;
      audio.sfx('hit');
    }
    c.anim.flashFoe = 0.18;
  }
  if (retaliate && c.foe.thorns > 0) hurtPlayer(state, c.foe.thorns, false);
  checkWin(state);
  return dmg;
}

// Raw hit on the player: frail and missing legs amplify, block soaks first.
function hurtPlayer(state, raw, retaliate) {
  const c = state.combat;
  const run = state.run;
  let dmg = Math.max(0, Math.round(num(raw) * (c.self.frail > 0 ? 1.25 : 1) * incomingMultiplier(run.body)));
  if (dmg > 0) {
    const absorbed = Math.min(c.block, dmg);
    c.block -= absorbed;
    dmg -= absorbed;
    if (dmg > 0) {
      run.hp -= dmg;
      audio.sfx('hurt');
    }
    c.anim.flashSelf = 0.2;
    c.anim.shake = 0.3;
  }
  if (retaliate && c.self.thorns > 0) damageEnemy(state, c.self.thorns, false);
  checkLoss(state);
  return dmg;
}

/* ------------------------------------------------------------------ */
/* Deck handling                                                       */
/* ------------------------------------------------------------------ */

function drawCards(state, count) {
  const c = state.combat;
  const cap = handSize(state.run.body);
  for (let i = 0; i < num(count); i++) {
    if (c.hand.length >= cap) return;
    if (!c.drawPile.length) {
      if (!c.discard.length) return; // both piles dry: never loop waiting for a card
      c.drawPile = state.run.rng.shuffle(c.discard);
      c.discard = [];
    }
    c.hand.push(c.drawPile.pop());
  }
}

// Losing an arm shrinks the hand, so any surplus falls into the discard.
function trimHand(state) {
  const c = state.combat;
  const cap = handSize(state.run.body);
  while (c.hand.length > cap) c.discard.push(c.hand.pop());
}

// A torn limb takes every card it granted out of the whole deck.
function purgeSlot(combat, slot) {
  const keep = (entry) => !entry || entry.slot !== slot;
  combat.hand = combat.hand.filter(keep);
  combat.drawPile = combat.drawPile.filter(keep);
  combat.discard = combat.discard.filter(keep);
}

function breakSlot(state, slot, label) {
  const c = state.combat;
  purgeSlot(c, slot);
  trimHand(state);
  pushLog(c, `${label} SE DESGARRA`);
  toast(`${label} SE DESGARRA`);
  audio.sfx('break');
}

// -> true when the limb tore off, so the card that did it is gone for good.
function applyHeat(state, slot, heat) {
  const amount = num(heat);
  const body = state.run.body;
  if (amount <= 0 || !occupied(body, slot)) return false;
  const label = limbLabel(body, slot);
  const res = addHeat(body, slot, amount) || {};
  if (res.broke) breakSlot(state, slot, label);
  else if (res.overheated) audio.sfx('heat');
  return !!res.broke;
}

/* ------------------------------------------------------------------ */
/* Card effects - exactly the twelve kinds of the contract              */
/* ------------------------------------------------------------------ */

function addStatus(combat, target, status, amount) {
  if (!STATUSES.includes(status) || amount <= 0) return;
  target[status] += amount;
}

function hurtEnemyLimb(state, amount) {
  const c = state.combat;
  const pool = c.enemy.limbs.filter((l) => l.integrity > 0);
  if (amount <= 0 || !pool.length) return;
  const limb = state.run.rng.pick(pool);
  limb.integrity = Math.max(0, limb.integrity - amount);
  if (limb.integrity === 0) pushLog(c, `${limbName(limb.blueprint)} INSERVIBLE`);
}

// Returns the damage dealt to the enemy, for the log line.
function applyEffect(state, fx, slot) {
  const c = state.combat;
  const run = state.run;
  const amount = num(fx.amount);
  switch (fx.kind) {
    case 'damage':
      return damageEnemy(state, outgoing(amount, c.self), true);

    case 'hits': {
      let total = 0;
      const times = Math.max(1, num(fx.times) || 1);
      for (let i = 0; i < times; i++) {
        total += damageEnemy(state, outgoing(amount, c.self), true);
        if (c.phase !== 'player') break;
      }
      return total;
    }

    case 'block':
      c.block += Math.max(0, amount);
      return 0;

    case 'heal':
      run.hp = Math.min(run.maxHp, run.hp + Math.max(0, amount));
      return 0;

    case 'cool':
      coolAll(run.body, Math.max(0, amount));
      return 0;

    case 'repair':
      if (occupied(run.body, slot)) repairLimb(run.body, slot, Math.max(0, amount));
      return 0;

    case 'draw':
      drawCards(state, amount);
      return 0;

    case 'ap':
      c.ap += Math.max(0, amount);
      return 0;

    case 'limbDamage':
      hurtEnemyLimb(state, amount);
      return 0;

    case 'status':
      addStatus(c, fx.to === 'self' ? c.self : c.foe, fx.status, amount);
      return 0;

    case 'selfHarm':
      run.hp -= Math.max(0, amount);
      c.anim.flashSelf = 0.2;
      checkLoss(state);
      return 0;

    case 'exhaust': // handled when the card is disposed of
      return 0;

    default:
      return 0;
  }
}

/* ------------------------------------------------------------------ */
/* Enemy intents                                                       */
/* ------------------------------------------------------------------ */

function chooseIntent(state) {
  const c = state.combat;
  const def = ENEMIES[c.enemy.id] || ENEMIES[FALLBACK_ENEMY];
  const moves = ((def && def.moves) || []).filter((m) => m && m.kind);
  if (!moves.length) {
    c.intent = { kind: 'attack', amount: 5, times: 1, name: 'Golpe' };
    return;
  }

  // Never let the same move come up three times running.
  let pool = moves;
  if (c.streak.count >= 2) {
    const others = moves.filter((m) => m.name !== c.streak.name);
    if (others.length) pool = others;
  }

  const weight = (m) => Math.max(0, num(m.weight));
  let total = 0;
  for (const m of pool) total += weight(m);
  const flat = total <= 0; // every weight missing: uniform draw
  let roll = state.run.rng.next() * (flat ? pool.length : total);
  let picked = pool[pool.length - 1];
  for (const m of pool) {
    roll -= flat ? 1 : weight(m);
    if (roll < 0) { picked = m; break; }
  }

  c.intent = {
    kind: picked.kind,
    amount: Math.max(0, num(picked.amount)),
    times: Math.max(1, num(picked.times) || 1),
    name: picked.name || 'Golpe',
  };
  if (c.streak.name === c.intent.name) c.streak.count += 1;
  else { c.streak.name = c.intent.name; c.streak.count = 1; }
}

// limbstrike: hp damage plus a bite out of one limb's integrity.
function tearLimb(state, amount) {
  const c = state.combat;
  const body = state.run.body;
  const targets = SLOTS.filter((slot) => occupied(body, slot));
  if (!targets.length) return;
  const slot = state.run.rng.pick(targets);
  const label = limbLabel(body, slot);
  const res = damageLimb(body, slot, amount) || {};
  if (res.broke) breakSlot(state, slot, label);
  else pushLog(c, `${label} -${amount} CARNE`);
}

function runIntent(state) {
  const c = state.combat;
  const it = c.intent;
  if (!it) return;
  const name = up(it.name || 'GOLPE');

  switch (it.kind) {
    case 'attack':
      pushLog(c, `${name}: -${hurtPlayer(state, outgoing(it.amount, c.foe), true)}`);
      break;

    case 'multi': {
      let total = 0;
      const times = Math.max(1, num(it.times) || 1);
      for (let i = 0; i < times; i++) {
        total += hurtPlayer(state, outgoing(it.amount, c.foe), true);
        if (c.phase !== 'enemy') break;
      }
      pushLog(c, `${name} X${times}: -${total}`);
      break;
    }

    case 'limbstrike': {
      pushLog(c, `${name}: -${hurtPlayer(state, outgoing(it.amount, c.foe), true)}`);
      if (c.phase === 'enemy') tearLimb(state, Math.max(1, Math.round(num(it.amount) / 4)));
      break;
    }

    case 'block':
      c.foeBlock += Math.max(0, num(it.amount));
      pushLog(c, `${name}: SE PROTEGE`);
      break;

    case 'buff':
      c.foe.strength += Math.max(1, num(it.amount) || 1);
      pushLog(c, `${name}: SE ENFURECE`);
      break;

    case 'debuff': {
      const which = state.run.rng.chance(0.5) ? 'weak' : 'frail';
      c.self[which] += Math.max(1, num(it.amount) || 1);
      pushLog(c, which === 'weak' ? `${name}: TE DEBILITA` : `${name}: TE VUELVE FRÁGIL`);
      break;
    }

    default:
      pushLog(c, name);
  }
}

/* ------------------------------------------------------------------ */
/* Turn flow                                                           */
/* ------------------------------------------------------------------ */

function burnTick(state, side) {
  const c = state.combat;
  const dmg = side === 'self' ? c.self.burn : c.foe.burn;
  if (dmg <= 0) return;
  if (side === 'self') {
    state.run.hp -= dmg;
    c.anim.flashSelf = 0.2;
    pushLog(c, `ARDES: -${dmg}`);
    checkLoss(state);
  } else {
    c.enemy.hp -= dmg;
    c.anim.flashFoe = 0.18;
    pushLog(c, `${c.enemy.name} ARDE: -${dmg}`);
    checkWin(state);
  }
}

function tickStatus(st) {
  for (const key of TIMED) if (st[key] > 0) st[key] -= 1;
}

function startPlayerTurn(state) {
  const c = state.combat;
  const body = state.run.body;
  c.block = 0;
  c.apMax = Math.max(1, num(apMax(body)));
  c.ap = c.apMax;
  drawCards(state, handSize(body));
  c.turn += 1;
  chooseIntent(state);
  c.phase = 'player';
  c.pending = null;
  c.delay = 0;
}

function resolveEnemy(state) {
  const c = state.combat;
  if (!c || c.phase !== 'enemy') return;
  c.foeBlock = 0; // its guard lapses the moment it moves again
  runIntent(state);
  if (c.phase === 'enemy') burnTick(state, 'foe');
  tickStatus(c.self);
  tickStatus(c.foe);
  if (c.phase === 'enemy') startPlayerTurn(state);
}

function clearRoom(state) {
  const tower = state.run.tower;
  for (const floor of (tower && tower.floors) || []) {
    for (const room of (floor && floor.rooms) || []) {
      if (room && room.id === state.run.roomId) {
        room.cleared = true;
        return;
      }
    }
  }
}

function checkWin(state) {
  const c = state.combat;
  if (!c || c.phase === 'won' || c.phase === 'lost' || c.enemy.hp > 0) return false;
  c.enemy.hp = 0;
  c.foeBlock = 0;
  c.phase = 'won';
  c.pending = 'win';
  c.delay = WIN_DELAY;
  pushLog(c, `${c.enemy.name} SE DESPLOMA`);
  audio.sfx('death');
  state.run.kills += 1;
  clearRoom(state);
  return true;
}

// Death only flips the phase: main.js sees hp <= 0 and moves to the death scene.
function checkLoss(state) {
  const c = state.combat;
  if (!c || c.phase === 'won' || c.phase === 'lost' || state.run.hp > 0) return false;
  state.run.hp = 0;
  c.phase = 'lost';
  c.pending = null;
  c.delay = 0;
  pushLog(c, 'TU CARNE CEDE');
  return true;
}

function finishWin(state) {
  const c = state.combat;
  if (!c) return;
  if (c.enemy.id === 'archialquimista') {
    state.run.guardAlive = false;
    state.meta.escapes += 1;
    const spent = Math.max(0, Math.round(RUN_SECONDS - num(state.run.timeLeft)));
    if (state.meta.bestTime === null || spent < state.meta.bestTime) state.meta.bestTime = spent;
    saveMeta();
    audio.sfx('escape');
    state.scene = 'escape';
    return;
  }
  beginHarvest(state);
  state.scene = 'harvest';
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function startCombat(state, enemyId) {
  const run = state.run;
  if (!run) return null;

  let def = ENEMIES[enemyId];
  if (!def) {
    console.warn(`combat: enemigo desconocido "${enemyId}"; se usa ${FALLBACK_ENEMY}`);
    def = ENEMIES[FALLBACK_ENEMY];
  }

  const body = run.body;
  const ap = Math.max(1, num(apMax(body)));
  const combat = {
    enemy: {
      id: def.id,
      name: def.name,
      hp: num(def.hp) || 1,
      maxHp: num(def.hp) || 1,
      color: def.color,
      limbs: ((def.limbs) || []).map((bp) => ({
        blueprint: bp,
        integrity: Math.max(1, num(LIMBS[bp] && LIMBS[bp].integrity) || 6),
      })),
      quip: def.quip || '',
    },
    hand: [],
    drawPile: run.rng.shuffle(deck(body)),
    discard: [],
    ap,
    apMax: ap,
    block: 0,
    foeBlock: 0,
    self: blankStatus(),
    foe: blankStatus(),
    intent: null,
    turn: 1,
    phase: 'player',
    log: [],
    anim: { shake: 0, flashFoe: 0, flashSelf: 0 },
    // internal: phase delay driven by tick(), and the anti repeat move streak
    pending: null,
    delay: 0,
    streak: { name: null, count: 0 },
  };

  state.combat = combat;
  state.harvest = null;
  // The only passive cooling: a breather between fights. Heat persists turn to
  // turn and from combat to combat, so thermal decay actually bites.
  coolAll(body, 1);
  drawCards(state, handSize(body));
  chooseIntent(state);
  pushLog(combat, def.quip || `APARECE ${def.name}`);
  state.scene = 'combat';
  audio.sfx('enemy');
  return combat;
}

export function playCard(state, handIndex) {
  const c = state.combat;
  if (!c) return deny('NO HAY COMBATE');
  if (c.phase !== 'player') return deny('NO ES TU TURNO');

  const entry = c.hand[handIndex];
  if (!entry) return deny('NO HAY CARTA AHÍ');

  const card = CARDS[entry.cardId];
  if (!card) {
    c.hand.splice(handIndex, 1);
    return deny('CARTA ILEGIBLE');
  }

  const cost = Math.max(0, num(card.ap));
  if (c.ap < cost) return deny('SIN ACCIONES');

  c.ap -= cost;
  c.hand.splice(handIndex, 1);
  audio.sfx('card');

  const effects = card.effects || [];
  const exhaust = effects.some((fx) => fx && fx.kind === 'exhaust');
  let dealt = 0;
  for (const fx of effects) {
    if (!fx) continue;
    dealt += applyEffect(state, fx, entry.slot);
    if (c.phase !== 'player') break; // the fight ended mid card
  }
  pushLog(c, dealt > 0 ? `${card.name} -${dealt}` : card.name);

  // A card whose own limb just tore off goes with it, not to the discard.
  const torn = applyHeat(state, entry.slot, card.heat);
  if (!exhaust && !torn) c.discard.push(entry);
  return { ok: true };
}

export function endTurn(state) {
  const c = state.combat;
  if (!c || c.phase !== 'player') return;
  while (c.hand.length) c.discard.push(c.hand.pop());
  burnTick(state, 'self');
  if (c.phase !== 'player') return; // burn closed the fight
  c.phase = 'enemy';
  c.pending = 'enemy';
  c.delay = ENEMY_DELAY;
  audio.sfx('select');
}

export function tick(state, dt) {
  const c = state.combat;
  if (!c) return;
  const step = Math.max(0, num(dt));

  const a = c.anim;
  a.shake = Math.max(0, a.shake - step);
  a.flashFoe = Math.max(0, a.flashFoe - step);
  a.flashSelf = Math.max(0, a.flashSelf - step);

  if (!c.pending) return;
  c.delay -= step;
  if (c.delay > 0) return;
  c.delay = 0;
  const pending = c.pending;
  c.pending = null;
  if (pending === 'enemy') resolveEnemy(state);
  else if (pending === 'win') finishWin(state);
}

export function beginHarvest(state) {
  const c = state.combat;
  const limbs = ((c && c.enemy.limbs) || []).map((l) => ({
    blueprint: l.blueprint,
    integrity: l.integrity,
    ruined: l.integrity <= 0, // harvested in pieces: useless for grafting
  }));
  state.harvest = {
    limbs,
    done: false,
    enemyName: c ? c.enemy.name : '',
  };
  return state.harvest;
}

export function applyHarvest(state, limbIndex, slot) {
  const h = state.harvest;
  if (!h) return deny('NO HAY CADÁVER');
  if (h.done) return deny('YA HAS INJERTADO');

  const limb = h.limbs[limbIndex];
  if (!limb) return deny('ESA PIEZA NO EXISTE');
  if (limb.ruined || limb.integrity <= 0) return deny('LA PIEZA ESTÁ DESTROZADA');

  const bp = LIMBS[limb.blueprint];
  if (!bp) return deny('PLANO ILEGIBLE');
  if (!SLOTS.includes(slot) || family(slot) !== bp.slot) return deny('NO ENCAJA AHÍ');

  const run = state.run;
  if (!run) return deny('NO HAY CUERPO');

  graft(run.body, slot, limb.blueprint);
  discover(limb.blueprint);
  run.grafts += 1;
  run.maxHp = maxHp(run.body);
  run.hp = Math.min(run.hp, run.maxHp);
  audio.sfx('graft');
  toast(`INJERTAS ${up(bp.name)}`);

  h.done = true;
  state.scene = 'explore';
  state.combat = null;
  return { ok: true };
}

// Leave the corpse where it fell.
export function skipHarvest(state) {
  state.harvest = null;
  state.combat = null;
  state.scene = 'explore';
}

// Short Spanish label for the HUD intent badge.
export function intentText(combat) {
  const it = combat && combat.intent;
  if (!it) return 'ESPERA';
  const foe = combat.foe || blankStatus();
  switch (it.kind) {
    case 'attack': return `ATACA ${outgoing(it.amount, foe)}`;
    case 'multi': return `X${Math.max(1, num(it.times) || 1)} POR ${outgoing(it.amount, foe)}`;
    case 'limbstrike': return 'ARRANCA MIEMBRO';
    case 'block': return 'SE PROTEGE';
    case 'buff': return 'SE ENFURECE';
    case 'debuff': return 'TE DEBILITA';
    default: return 'TRAMA ALGO';
  }
}
