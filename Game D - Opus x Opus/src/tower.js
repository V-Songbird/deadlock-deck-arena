// Procedural tower: 4 floors (3 = laboratory on top, 0 = exit at the bottom),
// 5..7 rooms per floor on a small grid, corridors that can be re-wired mid-run.
import { ENEMIES, LIMBS } from './cards.js';

const FLOORS = 4;
const GRID_W = 4; // x 0..3
const GRID_H = 3; // y 0..2
const GUARDIAN = 'archialquimista'; // guards the exit, never placed in a normal combat room

// Filler types for the rooms left over after the mandatory mix.
const FILLER = ['trap', 'forge', 'trap', 'forge', 'combat'];

// Spanish, themed room names; one pool per room type.
const NAMES = {
  slab: ['Losa de Despertar'],
  exit: ['Portón Sellado'],
  combat: [
    'Sala de Disección', 'Osario Húmedo', 'Galería de Ganchos', 'Pabellón de Gritos',
    'Nave de Cadenas', 'Celda Supurante', 'Claustro de Vísceras', 'Anfiteatro Rojo',
    'Corredor Tendinoso', 'Capilla Desollada',
  ],
  salvage: [
    'Archivo de Carne', 'Despensa de Órganos', 'Alacena de Tendones', 'Cripta de Repuestos',
    'Cubeta de Hallazgos', 'Nicho de Reliquias', 'Depósito de Miembros',
  ],
  trap: [
    'Pasillo de Cuchillas', 'Fosa de Vapor', 'Bóveda Agrietada', 'Tramo Hundido',
    'Garganta de Agujas', 'Túnel Silbante', 'Rejilla Traicionera',
  ],
  forge: [
    'Fragua de Injertos', 'Yunque de Huesos', 'Horno de Suturas', 'Taller de Costuras',
    'Crisol de Cartílago', 'Banco de Ensamblaje', 'Mesa de Suturas',
  ],
  stairs: [
    'Escalera en Espiral', 'Pozo de Peldaños', 'Caracol de Piedra', 'Descenso Estrecho',
    'Grada de Hierro', 'Bajada Enmohecida', 'Vano de Escalones',
  ],
};

function idsByTier(table, tiers, exclude) {
  const all = Object.keys(table).filter((id) => id !== exclude);
  const tiered = all.filter((id) => tiers.includes(table[id].tier));
  return tiered.length ? tiered : all;
}

const ENEMIES_SHALLOW = idsByTier(ENEMIES, [1], GUARDIAN); // floors 3..2
const ENEMIES_DEEP = idsByTier(ENEMIES, [2], GUARDIAN); // floors 1..0
const LIMBS_SHALLOW = idsByTier(LIMBS, [1, 2]);
const LIMBS_DEEP = idsByTier(LIMBS, [2, 3]);

function payloadFor(rng, floor, type) {
  const shallow = floor >= 2;
  if (type === 'combat') return { enemyId: rng.pick(shallow ? ENEMIES_SHALLOW : ENEMIES_DEEP) };
  if (type === 'salvage') {
    const kind = rng.pick(['limb', 'limb', 'elixir', 'coolant']);
    if (kind !== 'limb') return { kind };
    return { kind, blueprintId: rng.pick(shallow ? LIMBS_SHALLOW : LIMBS_DEEP) };
  }
  if (type === 'trap') {
    const base = 3 + (FLOORS - 1 - floor); // deeper floors hurt more: 3..8 overall
    return { kind: rng.pick(['blades', 'steam', 'collapse']), amount: rng.range(base, base + 2) };
  }
  return null;
}

// Mandatory mix: >= 2 combat and >= 1 salvage everywhere, >= 1 stairs on floors 1..3,
// the slab on the top floor and the exit on floor 0.
function floorTypes(rng, floor, count) {
  const types = ['combat', 'combat', 'salvage'];
  if (floor === FLOORS - 1) types.push('slab');
  if (floor === 0) types.push('exit');
  else types.push('stairs');
  while (types.length < count) types.push(rng.pick(FILLER));
  return rng.shuffle(types);
}

function makeRooms(rng, floor) {
  const count = rng.range(5, 7);
  const cells = [];
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) cells.push({ x, y });
  rng.shuffle(cells); // distinct grid cells, so rooms never overlap on a floor
  const pools = {};
  const seen = {};
  return floorTypes(rng, floor, count).map((type, idx) => {
    if (!pools[type]) pools[type] = rng.shuffle(NAMES[type].slice());
    const n = (seen[type] = (seen[type] || 0) + 1);
    return {
      id: `f${floor}r${idx}`,
      floor,
      idx,
      type,
      x: cells[idx].x,
      y: cells[idx].y,
      name: pools[type][(n - 1) % pools[type].length],
      cleared: false,
      payload: payloadFor(rng, floor, type),
      exits: [],
    };
  });
}

function link(a, b) {
  if (!a.exits.includes(b.id)) a.exits.push(b.id);
  if (!b.exits.includes(a.id)) b.exits.push(a.id);
}

// Random spanning tree (keeps the floor connected) plus 1..3 extra edges.
// Every intra-floor link is bidirectional.
function relinkFloor(rng, floor) {
  for (const room of floor.rooms) room.exits = [];
  const order = rng.shuffle(floor.rooms.slice());
  for (let i = 1; i < order.length; i++) link(order[i], order[rng.int(i)]);
  const extra = rng.range(1, 3);
  for (let i = 0; i < extra; i++) {
    const a = rng.pick(floor.rooms);
    const b = rng.pick(floor.rooms);
    if (a !== b) link(a, b);
  }
}

// `room.down` is a ONE-WAY link to a room on the floor below, set only on `stairs` rooms.
// It is deliberately kept OUT of `room.exits` so explore.js can tell descending apart from
// walking to an adjacent room, and so shuffleTower never breaks the way down.
function linkStairs(rng, tower) {
  for (const floor of tower.floors) {
    const below = tower.floors[floor.index - 1];
    if (!below) continue;
    for (const room of floor.rooms) {
      if (room.type === 'stairs') room.down = rng.pick(below.rooms).id;
    }
  }
}

function navigable(tower, currentRoomId) {
  const room = roomById(tower, currentRoomId);
  return !!room && room.exits.length > 0 && pathExists(tower, currentRoomId, tower.exitRoomId);
}

export function generateTower(rng) {
  const floors = [];
  for (let index = 0; index < FLOORS; index++) floors.push({ index, rooms: makeRooms(rng, index) });
  const tower = {
    floors,
    startRoomId: floors[FLOORS - 1].rooms.find((r) => r.type === 'slab').id,
    exitRoomId: floors[0].rooms.find((r) => r.type === 'exit').id,
    shuffles: 0,
  };
  for (const floor of floors) relinkFloor(rng, floor);
  linkStairs(rng, tower);
  return tower;
}

// Re-wires the corridors of every floor. Guarantees the current room keeps at least one exit
// and that the exit room stays reachable from it.
export function shuffleTower(tower, rng, currentRoomId) {
  tower.shuffles++;
  for (let attempt = 0; attempt < 40; attempt++) {
    for (const floor of tower.floors) relinkFloor(rng, floor);
    if (navigable(tower, currentRoomId)) return tower;
  }
  // Repair instead of handing back an unnavigable tower: a plain corridor per floor is
  // connected by construction, and the `down` links were never touched.
  for (const floor of tower.floors) {
    for (const room of floor.rooms) room.exits = [];
    for (let i = 1; i < floor.rooms.length; i++) link(floor.rooms[i - 1], floor.rooms[i]);
  }
  return tower;
}

export function roomById(tower, id) {
  for (const floor of tower.floors) {
    for (const room of floor.rooms) if (room.id === id) return room;
  }
  return null;
}

// Walks both `exits` and the one-way `down` links.
export function pathExists(tower, fromId, toId) {
  const seen = new Set([fromId]);
  const queue = [fromId];
  while (queue.length) {
    const id = queue.shift();
    if (id === toId) return true;
    const room = roomById(tower, id);
    if (!room) continue;
    const links = room.down ? room.exits.concat(room.down) : room.exits;
    for (const next of links) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

// Rooms reachable by walking; `down` is not included on purpose.
export function neighbors(tower, roomId) {
  const room = roomById(tower, roomId);
  return room ? room.exits.map((id) => roomById(tower, id)).filter(Boolean) : [];
}
