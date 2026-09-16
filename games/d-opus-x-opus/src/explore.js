// Exploration scene: the floor map, room resolution and walking the tower.
// Owns the screen area x 0..329, y 20..251. The HUD (y 0..19) and the anatomy
// panel (x 330..447) belong to ui.js; nothing here draws outside that box.
// The clock and the tower reshuffle live in main.js on purpose.
import { PAL, rect, line, frame, text, textCenter } from './render.js';
import { toast, pressed, clickIn, discover } from './state.js';
import { roomById, neighbors } from './tower.js';
import { SLOTS, family, maxHp, coolAll, addHeat, damageLimb, repairLimb, graft } from './body.js';
import { LIMBS } from './cards.js';
import { startCombat } from './combat.js';
import { audio } from './audio.js';
import * as sprites from './sprites.js';

/* ----------------------------------------------------------------- layout */

const MAP = { x: 4, y: 24, w: 204, h: 96 };
const INFO = { x: 96, y: 124, w: 230, h: 124 };
const NODE_W = 24, NODE_H = 16;
const MAX_EXITS = 6; // keys 1..6
const SETTLE = 0.22; // seconds of deaf input after a move, so one click is one room

// Grid cell (x 0..3, y 0..2) -> node centre inside the map panel.
function centre(room) {
  return { cx: 28 + room.x * 50, cy: 48 + room.y * 24 };
}

function nodeBox(room) {
  const c = centre(room);
  return { x: c.cx - NODE_W / 2, y: c.cy - NODE_H / 2, cx: c.cx, cy: c.cy };
}

const DESCEND = { x: INFO.x + 5, y: INFO.y + 100, w: 82, h: 9 };

/* ------------------------------------------------------------------ labels */

const LABEL = {
  slab: 'LOSA', combat: 'COMBATE', salvage: 'BOTÍN', trap: 'TRAMPA',
  forge: 'FRAGUA', stairs: 'ESCALERA', exit: 'SALIDA',
};

const ICON = {
  slab: 'LO', combat: 'CO', salvage: 'BO', trap: 'TR',
  forge: 'FR', stairs: 'ES', exit: 'SA',
};

const DESC = {
  slab: ['La losa fría donde despertaste.'],
  combat: ['Algo respira en la penumbra y', 'no piensa dejarte pasar.'],
  salvage: ['Restos aprovechables entre', 'la mugre y los frascos rotos.'],
  trap: ['El mecanismo aguarda cebado', 'bajo las losas flojas.'],
  forge: ['Yunques tibios, suturas frescas', 'y aceite para tus junturas.'],
  stairs: ['Los peldaños descienden', 'hacia un aire más frío.'],
  exit: ['El portón sellado. Tras él,', 'la noche y la libertad.'],
};

const cut = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}.` : String(s));

/* ------------------------------------------------------ room side effects */

// Every attached slot, as [slot, limb] pairs.
function attached(body) {
  return SLOTS.filter((slot) => body[slot]).map((slot) => [slot, body[slot]]);
}

function resolveTrap(run, room) {
  const p = room.payload || { kind: 'collapse', amount: 4 };
  const base = Math.max(1, Math.round(p.amount) || 3);
  const dmg = p.kind === 'collapse' ? base * 2 : base;
  run.hp -= dmg;

  let msg;
  if (p.kind === 'blades') {
    const live = attached(run.body);
    if (live.length) {
      const [slot, limb] = run.rng.pick(live);
      const { broke } = damageLimb(run.body, slot, 3);
      msg = `CUCHILLAS: -${dmg} PV Y ${limb.name} ${broke ? 'ARRANCADO' : 'ABIERTO'}`;
    } else {
      msg = `CUCHILLAS: -${dmg} PV SOBRE CARNE VIVA`;
    }
  } else if (p.kind === 'steam') {
    for (const [slot] of attached(run.body)) addHeat(run.body, slot, 3);
    msg = `VAPOR HIRVIENTE: -${dmg} PV Y TODO SE RECALIENTA`;
  } else {
    msg = `LA BÓVEDA CEDE: -${dmg} PV DE ESCOMBROS`;
  }

  toast(msg, 2.8);
  audio.sfx('trap');
  room.cleared = true;
}

// Prefer a stump of the blueprint's family; otherwise the slot of that family
// with the least integrity left.
function slotFor(body, fam) {
  const slots = SLOTS.filter((slot) => family(slot) === fam);
  const stump = slots.find((slot) => !body[slot]);
  if (stump) return stump;
  let best = slots[0];
  for (const slot of slots) if (body[slot].integrity < body[best].integrity) best = slot;
  return best;
}

function resolveSalvage(run, room) {
  const p = room.payload || { kind: 'elixir' };
  const body = run.body;

  if (p.kind === 'limb' && LIMBS[p.blueprintId]) {
    const bp = LIMBS[p.blueprintId];
    const slot = slotFor(body, bp.slot);
    if (graft(body, slot, bp.id) !== false) {
      run.grafts = (run.grafts || 0) + 1;
      discover(bp.id);
      audio.sfx('graft');
      toast(`INJERTAS: ${bp.name}`, 2.6);
    } else {
      toast('EL INJERTO NO ENCAJA EN TU CARNE', 2.4);
    }
  } else if (p.kind === 'coolant') {
    coolAll(body, 99);
    for (const [slot] of attached(body)) repairLimb(body, slot, 3);
    audio.sfx('heat');
    toast('REFRIGERANTE: CALOR PURGADO, +3 INTEGRIDAD', 2.6);
  } else {
    const before = run.hp;
    run.hp = Math.min(run.maxHp, run.hp + 12);
    run.elixirs = (run.elixirs || 0) + 1;
    audio.sfx('squelch');
    toast(`ELIXIR VISCOSO: +${Math.round(run.hp - before)} PV`, 2.4);
  }

  room.cleared = true;
}

function resolveForge(run, room) {
  const body = run.body;
  const live = attached(body);
  if (live.length) {
    let worst = live[0];
    for (const pair of live) {
      const a = pair[1], b = worst[1];
      if (a.integrity / a.maxIntegrity < b.integrity / b.maxIntegrity) worst = pair;
    }
    repairLimb(body, worst[0], 99);
    toast(`LA FRAGUA REHACE: ${worst[1].name}`, 2.6);
  } else {
    toast('LA FRAGUA SÓLO TE ENFRÍA: NO QUEDA NADA', 2.6);
  }
  coolAll(body, 99);
  audio.sfx('graft');
  room.cleared = true;
}

function resolveRoom(state, run, room) {
  switch (room.type) {
    case 'combat':
      // combat.js marks the room cleared when the player wins.
      startCombat(state, room.payload ? room.payload.enemyId : null);
      break;
    case 'trap':
      resolveTrap(run, room);
      break;
    case 'salvage':
      resolveSalvage(run, room);
      break;
    case 'forge':
      resolveForge(run, room);
      break;
    case 'exit':
      if (run.guardAlive) {
        startCombat(state, 'archialquimista');
        toast('EL ARCHIALQUIMISTA BLOQUEA LA SALIDA', 3);
      } else {
        // combat.js already counted the escape; only walk through the door.
        audio.sfx('escape');
        state.scene = 'escape';
      }
      break;
    default:
      break; // slab and stairs are plain rooms
  }
}

/* -------------------------------------------------------------------- api */

let settle = 0;

export function enterRoom(state, roomId) {
  const run = state.run;
  if (!run) return;
  const room = roomById(run.tower, roomId);
  if (!room) return;

  run.roomId = room.id;
  room.seen = true;
  settle = SETTLE;
  audio.sfx('step');

  if (!room.cleared) resolveRoom(state, run, room);

  // A graft can move the ceiling in either direction.
  run.maxHp = maxHp(run.body);
  if (run.hp > run.maxHp) run.hp = run.maxHp;
  // hp <= 0 is main.js's business; never switch scenes from here.
}

export function update(state, dt) {
  const run = state.run;
  if (!run) return;
  const room = roomById(run.tower, run.roomId);
  if (!room) return;
  room.seen = true;

  settle -= dt;
  if (settle > 0) return;

  const adj = neighbors(run.tower, run.roomId).slice(0, MAX_EXITS);

  for (let i = 0; i < adj.length; i++) {
    if (pressed(String(i + 1))) {
      enterRoom(state, adj[i].id);
      return;
    }
  }

  if (room.type === 'stairs' && room.down) {
    if (pressed('f') || clickIn(DESCEND.x, DESCEND.y, DESCEND.w, DESCEND.h)) {
      enterRoom(state, room.down);
      toast('DESCIENDES');
      return;
    }
  }

  const floor = run.tower.floors[room.floor];
  if (!floor) return;
  for (const r of floor.rooms) {
    const b = nodeBox(r);
    if (!clickIn(b.x, b.y, NODE_W, NODE_H)) continue;
    if (r.id === room.id) return;
    if (adj.some((a) => a.id === r.id)) enterRoom(state, r.id);
    else {
      audio.sfx('deny');
      toast('NO HAY CORREDOR');
    }
    return;
  }
}

/* ------------------------------------------------------------------ drawing */

function drawMap(ctx, state, run, room, adjOrder) {
  frame(ctx, MAP.x, MAP.y, MAP.w, MAP.h, PAL.ash, PAL.ink);
  text(ctx, `PISO ${room.floor + 1}`, MAP.x + 5, MAP.y + 4, PAL.brass);
  text(ctx, 'MAPA', MAP.x + MAP.w - 26, MAP.y + 4, PAL.stone);

  const floor = run.tower.floors[room.floor];
  if (!floor) return;

  // Corridors first, so the nodes paint over their ends.
  for (const r of floor.rooms) {
    const a = centre(r);
    for (const id of r.exits) {
      const o = roomById(run.tower, id);
      if (!o || o.floor !== r.floor || o.idx <= r.idx) continue;
      const b = centre(o);
      line(ctx, a.cx, a.cy, b.cx, b.cy, PAL.stone);
    }
  }

  const pulse = 0.5 + 0.5 * Math.sin(state.t * 5);

  for (const r of floor.rooms) {
    const b = nodeBox(r);
    const here = r.id === room.id;
    const nth = adjOrder.get(r.id);

    let fill = r.cleared ? PAL.ink : r.seen ? PAL.stone : PAL.grave;
    let border = PAL.ash;
    let ink = r.cleared ? PAL.ash : r.seen ? PAL.bone : PAL.ash;

    if (here) {
      fill = pulse > 0.5 ? PAL.blood : PAL.gore;
      border = PAL.pale;
      ink = PAL.pale;
      if (pulse > 0.6) frame(ctx, b.x - 1, b.y - 1, NODE_W + 2, NODE_H + 2, PAL.gore, null);
    } else if (nth) {
      border = PAL.brass;
      ink = PAL.spark;
    }

    frame(ctx, b.x, b.y, NODE_W, NODE_H, border, fill);
    textCenter(ctx, here || r.seen ? ICON[r.type] || '??' : '?', b.cx, b.y + 8, ink);
    if (nth) text(ctx, String(nth), b.x + 2, b.y + 2, PAL.spark);

    if (r.down) {
      // Arrow down: this room drops a floor.
      const ax = b.x + NODE_W - 7, ay = b.y + 2;
      rect(ctx, ax, ay, 5, 1, PAL.acid);
      rect(ctx, ax + 1, ay + 1, 3, 1, PAL.acid);
      rect(ctx, ax + 2, ay + 2, 1, 1, PAL.acid);
    }
  }
}

function drawInfo(ctx, run, room, adj) {
  frame(ctx, INFO.x, INFO.y, INFO.w, INFO.h, PAL.ash, PAL.ink);
  const x = INFO.x + 5;

  text(ctx, cut(room.name, 28), x, INFO.y + 4, PAL.pale);
  text(ctx, `PISO ${room.floor + 1} - ${LABEL[room.type] || room.type}`, x, INFO.y + 13, PAL.brass);

  const lines = DESC[room.type] || [''];
  for (let i = 0; i < lines.length; i++) text(ctx, lines[i], x, INFO.y + 24 + i * 7, PAL.bone);

  text(ctx, 'SALIDAS', x, INFO.y + 40, PAL.copper);
  if (!adj.length) {
    text(ctx, 'NINGUNA. LOS MUROS SE CIERRAN.', x, INFO.y + 50, PAL.gore);
  } else {
    for (let i = 0; i < adj.length; i++) {
      const r = adj[i];
      const dim = r.cleared ? PAL.ash : PAL.bone;
      text(ctx, `${i + 1} ${cut(r.name, 24)}`, x, INFO.y + 50 + i * 8, dim);
    }
  }

  if (room.type === 'stairs' && room.down) {
    text(ctx, '[F] BAJAR', DESCEND.x, DESCEND.y, PAL.acid);
  }

  text(
    ctx,
    room.cleared ? 'SALA AGOTADA' : 'TECLAS 1-6 O CLICK EN EL MAPA',
    x,
    INFO.y + 112,
    PAL.stone,
  );
}

export function draw(ctx, state) {
  const run = state.run;
  if (!run) return;
  const room = roomById(run.tower, run.roomId);
  if (!room) return;

  if (typeof sprites.drawBackdrop === 'function') {
    sprites.drawBackdrop(ctx, 0, 20, 330, 232, room.type, room.floor, state.t);
  } else {
    rect(ctx, 0, 20, 330, 232, PAL.ink);
  }

  // The player stands bottom-left, clear of both panels. (x, y) is the centred
  // foot position of a ~48x64 sprite, so this occupies x 24..72, y 196..244.
  if (typeof sprites.drawAbomination === 'function') {
    sprites.drawAbomination(ctx, 48, 244, run.body, state.t, {
      hurt: run.maxHp > 0 ? Math.max(0, 1 - run.hp / run.maxHp) : 0,
    });
  }

  const adj = neighbors(run.tower, run.roomId).slice(0, MAX_EXITS);
  const adjOrder = new Map(adj.map((r, i) => [r.id, i + 1]));

  drawMap(ctx, state, run, room, adjOrder);
  drawInfo(ctx, run, room, adj);
}
