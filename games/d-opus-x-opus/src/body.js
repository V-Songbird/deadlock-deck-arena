// Anatomy: limb instances, the deck derived from them, and thermal degradation.
// A body is a flat object with one entry per slot; `null` means the slot is a stump.
import { CARDS, LIMBS, BASIC, STUMP_CARDS } from './cards.js';

export const SLOTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];

// Own-property lookup: plain object literals still inherit `constructor`, `toString`, etc.
const has = (obj, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);
const num = (v) => (Number.isFinite(v) ? v : 0);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Live limb in `slot`, or null for a stump, an unknown slot or a missing body.
function limbAt(body, slot) {
  return body && SLOTS.indexOf(slot) >= 0 ? body[slot] || null : null;
}

// Blueprint family of a slot: 'armL'/'armR' -> 'arm', 'legL'/'legR' -> 'leg', rest unchanged.
export function family(slot) {
  if (slot === 'armL' || slot === 'armR') return 'arm';
  if (slot === 'legL' || slot === 'legR') return 'leg';
  return slot;
}

let nextLimbId = 1;

// Instantiate a blueprint. The only function here that throws: an unknown blueprint is a data bug.
export function makeLimb(blueprintId) {
  if (!has(LIMBS, blueprintId)) throw new Error(`makeLimb: unknown limb blueprint "${blueprintId}"`);
  const bp = LIMBS[blueprintId];
  return {
    id: nextLimbId++,
    blueprint: bp.id,
    slot: bp.slot,
    name: bp.name,
    integrity: bp.integrity,
    maxIntegrity: bp.integrity,
    heat: 0,
    heatCap: bp.heatCap,
  };
}

// Full body: `picks[slot]` when it is a blueprint of the right family, else a random tier 1 one.
export function makeBody(rng, picks = {}) {
  const body = {};
  for (const slot of SLOTS) {
    const fam = family(slot);
    const wanted = picks ? picks[slot] : null;
    const ok = has(LIMBS, wanted) && LIMBS[wanted].slot === fam;
    body[slot] = makeLimb(ok ? wanted : rng.pick(BASIC[fam]));
  }
  return body;
}

// Deck derived from the anatomy, in SLOTS order. Stumps contribute STUMP_CARDS instead.
export function deck(body) {
  const out = [];
  for (const slot of SLOTS) {
    const limb = limbAt(body, slot);
    const ids = (limb && has(LIMBS, limb.blueprint) ? LIMBS[limb.blueprint].cards : STUMP_CARDS) || [];
    for (const cardId of ids) if (has(CARDS, cardId)) out.push({ cardId, slot });
  }
  return out;
}

// Cards drawn per turn: fewer arms, smaller hand.
export function handSize(body) {
  const arms = (limbAt(body, 'armL') ? 1 : 0) + (limbAt(body, 'armR') ? 1 : 0);
  return Math.max(2, Math.min(6, 3 + arms));
}

// 30 + hpBonus of every attached limb, minus 8 while the torso is missing.
export function maxHp(body) {
  let hp = 30;
  for (const slot of SLOTS) {
    const limb = limbAt(body, slot);
    if (limb && has(LIMBS, limb.blueprint)) hp += num(LIMBS[limb.blueprint].hpBonus);
  }
  if (!limbAt(body, 'torso')) hp -= 8;
  return Math.max(1, hp);
}

const OVERHEAT_DAMAGE = 4;

// Heat a limb. At heatCap it overheats: -4 integrity, heat back to 0, and it breaks off at <= 0.
// The penalty is 4, not 2: at 2 a limb survived 4-6 overheats and thermal wear never bit inside a run.
export function addHeat(body, slot, amount) {
  const limb = limbAt(body, slot);
  if (!limb) return { overheated: false, broke: false };
  limb.heat = Math.max(0, limb.heat + num(amount));
  if (limb.heat < limb.heatCap) return { overheated: false, broke: false };
  limb.integrity -= OVERHEAT_DAMAGE;
  limb.heat = 0;
  const broke = limb.integrity <= 0;
  if (broke) body[slot] = null;
  return { overheated: true, broke };
}

// Structural damage; at <= 0 integrity the limb breaks off and the slot becomes a stump.
export function damageLimb(body, slot, amount) {
  const limb = limbAt(body, slot);
  if (!limb) return { broke: false };
  limb.integrity -= Math.max(0, num(amount));
  const broke = limb.integrity <= 0;
  if (broke) body[slot] = null;
  return { broke };
}

// Restore integrity up to maxIntegrity. Stumps stay stumps. -> true when a limb was repaired.
export function repairLimb(body, slot, amount) {
  const limb = limbAt(body, slot);
  if (!limb) return false;
  limb.integrity = Math.min(limb.maxIntegrity, limb.integrity + Math.max(0, num(amount)));
  return true;
}

// Bleed heat off every attached limb.
export function coolAll(body, amount) {
  const a = Math.max(0, num(amount));
  for (const slot of SLOTS) {
    const limb = limbAt(body, slot);
    if (limb) limb.heat = Math.max(0, limb.heat - a);
  }
}

// Attach a blueprint to a slot of the same family.
// -> the replaced blueprint id, or null when the slot was a stump; false when it does not fit.
export function graft(body, slot, blueprintId) {
  if (!body || SLOTS.indexOf(slot) < 0 || !has(LIMBS, blueprintId)) return false;
  if (family(slot) !== LIMBS[blueprintId].slot) return false;
  const limb = body[slot];
  const replaced = limb ? limb.blueprint : null;
  body[slot] = makeLimb(blueprintId);
  return replaced;
}

// Empty slots.
export function stumps(body) {
  return SLOTS.filter((slot) => !limbAt(body, slot));
}

// Attached limbs.
export function intact(body) {
  return SLOTS.map((slot) => limbAt(body, slot)).filter(Boolean);
}

// The enemy hits 25% harder per missing leg.
export function incomingMultiplier(body) {
  const lost = (limbAt(body, 'legL') ? 0 : 1) + (limbAt(body, 'legR') ? 0 : 1);
  return 1 + 0.25 * lost;
}

// Actions per turn: 3, one less without a head.
export function apMax(body) {
  return 3 - (limbAt(body, 'head') ? 0 : 1);
}

// HUD gauges, 0..1 and null-safe.
export function heatPct(limb) {
  return limb && limb.heatCap > 0 ? clamp01(limb.heat / limb.heatCap) : 0;
}

export function integrityPct(limb) {
  return limb && limb.maxIntegrity > 0 ? clamp01(limb.integrity / limb.maxIntegrity) : 0;
}
