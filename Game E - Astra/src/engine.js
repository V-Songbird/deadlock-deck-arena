/* Reglas, torre procedural, reloj y guardado local. */
'use strict';

window.DDGame = class extends EventTarget {
  constructor() {
    super();
    this.key = 'deadlock-deck.v1';
    this.storageAvailable = true;
    this.meta = {
      version: 1, runs: 0, deaths: 0, wins: 0, souls: 0, best: null,
      blueprints: ['skull', 'sutures', 'bone', 'legs'], skins: ['suture'],
      skin: 'suture', expansion: false, volume: 0.3, sfx: true,
      motion: !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    };
    this.state = null;
    this.load();
    this.timer = window.setInterval(() => this.tick(), 200);
  }

  emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  notice(text, tone = 'info') {
    this.emit('notice', { text, tone });
  }

  sound(name) {
    this.emit('sound', { name });
  }

  log(text) {
    if (!this.state) return;
    this.state.log.unshift(text);
    this.state.log = this.state.log.slice(0, 24);
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (stored.version !== 1 || !stored.meta) return;
      this.meta = { ...this.meta, ...stored.meta };
      this.meta.blueprints = this.meta.blueprints.filter(id => DDData.parts[id]);
      this.meta.skins = this.meta.skins.filter(id => DDData.skins[id]);
      if (!this.meta.skins.includes(this.meta.skin)) this.meta.skin = 'suture';
      const s = stored.state;
      if (s && s.body && s.map?.length === 16 && Number.isFinite(s.deadline)
          && Array.isArray(s.hand) && Array.isArray(s.inventory) && s.version === 1) {
        this.state = s;
      }
    } catch (_) {
      this.storageAvailable = false;
    }
  }

  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify({ version: 1, meta: this.meta, state: this.state }));
    } catch (_) {
      if (this.storageAvailable) {
        this.storageAvailable = false;
        this.notice('El navegador no permite guardar. Esta sesión sigue siendo jugable.', 'warning');
      }
    }
  }

  change() {
    this.save();
    this.emit('change');
  }

  random() {
    let t = this.state.rng += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    this.state.rng >>>= 0;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  pick(items) {
    return items[Math.floor(this.random() * items.length)];
  }

  shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  active() {
    return this.state && !['dead', 'won'].includes(this.state.phase);
  }

  remaining() {
    if (!this.state) return 360000;
    if (this.state.phase === 'won') return this.state.remainingAtEnd;
    if (this.state.phase === 'dead') return this.state.remainingAtEnd || 0;
    return Math.max(0, this.state.deadline - Date.now());
  }

  guard() {
    if (!this.active()) return false;
    if (this.remaining() <= 0) {
      this.finish(false, 'La torre se derrumbó. El reloj no concede segundas oportunidades; tu espíritu, sí.');
      return false;
    }
    return true;
  }

  start() {
    const bytes = new Uint32Array(1);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    else bytes[0] = Date.now() >>> 0;
    const seed = bytes[0] || 1;
    this.meta.runs++;
    this.state = {
      version: 1, seed, rng: seed, startedAt: Date.now(), deadline: Date.now() + 360000,
      phase: 'explore', floor: 0, current: 12, previous: 12, map: [],
      hp: 80, maxHp: 80, block: 0, energy: 3, body: {}, inventory: [],
      scraps: 16, potions: 2, coolants: 2, hand: [], draw: [], discard: [],
      enemy: null, turn: 1, uid: 0, shiftStage: 0, reward: null,
      stats: { kills: 0, grafts: 0, broken: 0, rooms: 1, discovered: 0 },
      log: [], origin: '', awarded: false
    };
    const bases = [
      { name: 'El ensamblado', hp: 80, arm: 'scalpel', torso: 'sutures', head: 'skull', leg: 'legs' },
      { name: 'El estibador', hp: 88, arm: 'bone', torso: 'iron', head: 'skull', leg: 'legs' },
      { name: 'El hambriento', hp: 76, arm: 'bone', torso: 'sutures', head: 'jaw', leg: 'funeral' }
    ];
    const base = this.meta.runs === 1 ? bases[0] : this.pick(bases);
    this.state.origin = base.name;
    this.state.hp = this.state.maxHp = base.hp;
    const bodyIds = { head: base.head, torso: base.torso, armL: 'bone', armR: base.arm, legL: 'legs', legR: base.leg };
    for (const slot of DDData.slots) {
      const id = bodyIds[slot.id];
      this.state.body[slot.id] = { id, heat: 0, integrity: 100 };
      this.discover(id, false);
    }
    this.state.map = this.generateFloor(0);
    this.reveal(12);
    this.log('Has despertado. Encuentra la escalera al noreste. El reloj ya corre.');
    this.log(`${base.name}: otro cuerpo para un espíritu que se niega a morir.`);
    this.sound('revive');
    this.change();
  }

  tick() {
    if (this.active()) {
      if (!this.guard()) return;
      const stage = this.remaining() < 120000 ? 2 : this.remaining() < 240000 ? 1 : 0;
      if (stage > this.state.shiftStage) {
        this.state.shiftStage = stage;
        this.shiftTower();
      }
    }
    this.emit('clock', { ms: this.remaining() });
  }

  neighbours(index) {
    const x = index % 4;
    const y = Math.floor(index / 4);
    return [y > 0 ? index - 4 : null, x < 3 ? index + 1 : null,
      y < 3 ? index + 4 : null, x > 0 ? index - 1 : null].filter(v => v !== null);
  }

  connect(map, a, b) {
    if (!map[a].links.includes(b)) map[a].links.push(b);
    if (!map[b].links.includes(a)) map[b].links.push(a);
  }

  path(map, start, end) {
    const queue = [start];
    const parent = new Map([[start, null]]);
    while (queue.length) {
      const current = queue.shift();
      if (current === end) break;
      for (const next of map[current].links) {
        if (!parent.has(next)) {
          parent.set(next, current);
          queue.push(next);
        }
      }
    }
    if (!parent.has(end)) return [];
    const result = [];
    for (let n = end; n !== null; n = parent.get(n)) result.unshift(n);
    return result;
  }

  generateFloor(floor) {
    const map = Array.from({ length: 16 }, (_, id) => ({
      id, links: [], type: 'corridor', visited: false, seen: false, resolved: false
    }));
    const visited = new Set([12]);
    const stack = [12];
    while (stack.length) {
      const current = stack[stack.length - 1];
      const choices = this.neighbours(current).filter(n => !visited.has(n));
      if (!choices.length) { stack.pop(); continue; }
      const next = this.pick(choices);
      this.connect(map, current, next);
      visited.add(next);
      stack.push(next);
    }
    for (let k = 0; k < 3; k++) {
      const a = Math.floor(this.random() * 16);
      this.connect(map, a, this.pick(this.neighbours(a)));
    }
    const route = this.path(map, 12, 3);
    for (const room of map) {
      const r = this.random();
      room.type = r < 0.25 ? 'combat' : r < 0.39 ? 'cache' : r < 0.5 ? 'trap'
        : r < 0.61 ? 'workshop' : r < 0.71 ? 'archive' : 'corridor';
    }
    // Two encounters on the escape route; optional rooms offer other risks and rewards.
    for (let i = 1; i < route.length - 1; i++) {
      map[route[i]].type = i === Math.floor(route.length * 0.35)
        || i === Math.floor(route.length * 0.68) ? 'combat' : 'corridor';
    }
    if (route.length > 4) {
      map[route[1]].type = floor === 0 ? 'cache' : 'workshop';
      map[route[route.length - 2]].type = floor === 2 ? 'cache' : 'archive';
    }
    map[12].type = 'start';
    map[12].visited = map[12].seen = map[12].resolved = true;
    map[3].type = floor === 2 ? 'boss' : 'stairs';
    map[3].seen = true;
    return map;
  }

  shiftTower() {
    const map = this.state.map;
    const closed = [];
    for (let a = 0; a < 16; a++) {
      for (const b of this.neighbours(a)) {
        if (a < b && !map[a].links.includes(b)) closed.push([a, b]);
      }
    }
    if (closed.length) {
      const added = this.pick(closed);
      this.connect(map, ...added);
      const edges = [];
      for (const room of map) {
        for (const b of room.links) {
          if (room.id < b && !(room.id === added[0] && b === added[1])) edges.push([room.id, b]);
        }
      }
      for (const [a, b] of this.shuffle(edges)) {
        map[a].links = map[a].links.filter(n => n !== b);
        map[b].links = map[b].links.filter(n => n !== a);
        if (this.path(map, a, b).length) break;
        this.connect(map, a, b);
      }
    }
    this.reveal(this.state.current);
    this.log('¡El derrumbe ha cambiado los pasillos! La salida sigue siendo accesible.');
    this.notice('La torre se retuerce. Los pasillos han cambiado.', 'warning');
    this.sound('collapse');
    this.emit('effect', { type: 'shake' });
    this.change();
  }

  reveal(index) {
    const map = this.state.map;
    map[index].seen = map[index].visited = true;
    for (const next of map[index].links) map[next].seen = true;
  }

  move(index) {
    if (!this.guard()) return;
    const s = this.state;
    if (s.phase !== 'explore') {
      this.notice(s.phase === 'combat' ? 'Resuelve el combate para seguir explorando.' : 'Resuelve esta sala antes de avanzar.');
      return;
    }
    if (!s.map[s.current].links.includes(index)) return;
    s.previous = s.current;
    s.current = index;
    const room = s.map[index];
    if (!room.visited) s.stats.rooms++;
    this.reveal(index);
    for (const part of Object.values(s.body)) part.heat = Math.max(0, part.heat - 7);
    this.sound('step');
    if (!room.resolved) {
      if (room.type === 'combat' || room.type === 'boss') this.beginCombat(room.type === 'boss');
      else if (['cache', 'trap', 'workshop', 'archive'].includes(room.type)) s.phase = 'event';
      else room.resolved = true;
    }
    this.log(`${DDData.roomNames[room.type]} · ${DDData.floors[s.floor].small}.`);
    this.change();
  }

  moveDirection(direction) {
    if (!this.state) return;
    const current = this.state.current;
    const delta = { north: -4, east: 1, south: 4, west: -1 }[direction];
    const next = current + delta;
    if (this.neighbours(current).includes(next)) this.move(next);
  }

  ascend() {
    if (!this.guard()) return;
    const s = this.state;
    if (s.phase !== 'explore' || s.map[s.current].type !== 'stairs' || s.floor >= 2) return;
    s.floor++;
    s.map = this.generateFloor(s.floor);
    s.current = s.previous = 12;
    s.stats.rooms++;
    this.reveal(12);
    for (const part of Object.values(s.body)) part.heat = Math.max(0, part.heat - 15);
    this.log(`Has alcanzado ${DDData.floors[s.floor].name}.`);
    this.sound('stairs');
    this.change();
  }

  discover(id, notify = true) {
    if (this.meta.blueprints.includes(id)) return false;
    this.meta.blueprints.push(id);
    if (this.state) this.state.stats.discovered++;
    if (notify) {
      this.notice(`Plano descubierto: ${DDData.parts[id].name}. Lo conservarás al morir.`, 'good');
      this.log(`Plano permanente descubierto: ${DDData.parts[id].name}.`);
    }
    return true;
  }

  addPart(id) {
    this.discover(id);
    const item = { uid: ++this.state.uid, id, heat: 0, integrity: 100 };
    this.state.inventory.push(item);
    return item;
  }

  collectCache() {
    if (!this.guard()) return;
    const s = this.state;
    const room = s.map[s.current];
    if (s.phase !== 'event' || room.type !== 'cache' || room.resolved) return;
    const amount = 9 + Math.floor(this.random() * 7);
    s.scraps += amount;
    s.potions++;
    s.coolants++;
    const ids = s.floor === 0 ? ['claw', 'scalpel', 'spider', 'iron'] : ['cannon', 'pistons', 'boiler', 'oracle'];
    const item = this.addPart(this.pick(ids));
    this.log(`Recoges ${amount} de chatarra, un suero, un refrigerante y ${DDData.parts[item.id].name}.`);
    this.notice(`+${amount} chatarra · +1 suero · +1 refrigerante · injerto en la bolsa`, 'good');
    room.resolved = true;
    s.phase = 'explore';
    this.sound('loot');
    this.change();
  }

  resolveTrap(choice) {
    if (!this.guard()) return;
    const s = this.state;
    const room = s.map[s.current];
    if (s.phase !== 'event' || room.type !== 'trap' || room.resolved) return;
    if (choice === 'scraps') {
      if (s.scraps < 5) { this.notice('Necesitas 5 de chatarra.'); return; }
      s.scraps -= 5;
      this.log('Desvías el vapor con una válvula improvisada.');
    } else if (choice === 'legs') {
      const legs = ['legL', 'legR'].filter(key => s.body[key].id);
      if (!legs.length) { this.notice('Necesitas al menos una pierna intacta.'); return; }
      for (const key of legs) this.stress(key, 30, 12);
      this.log('Saltas sobre el vapor. Tus piernas absorben el esfuerzo.');
    } else if (choice === 'cross') {
      s.hp -= 9 + s.floor * 2;
      this.log('Atraviesas el vapor. Tu carne paga el precio.');
      this.sound('hurt');
    } else return;
    room.resolved = true;
    s.phase = 'explore';
    if (s.hp <= 0) this.finish(false, 'El vapor ha deshecho tus últimas suturas.');
    else this.change();
  }

  searchArchive() {
    if (!this.guard()) return;
    const s = this.state;
    const room = s.map[s.current];
    if (s.phase !== 'event' || room.type !== 'archive' || room.resolved) return;
    const unknown = Object.keys(DDData.parts).filter(id => !this.meta.blueprints.includes(id)
      && (!DDData.parts[id].expansion || this.meta.expansion));
    if (unknown.length) this.discover(this.pick(unknown));
    else {
      s.scraps += 10;
      this.notice('Ya conoces estos planos. Recuperas 10 de chatarra.', 'good');
    }
    room.resolved = true;
    s.phase = 'explore';
    this.sound('discover');
    this.change();
  }

  leaveWorkshop() {
    if (!this.guard()) return;
    const s = this.state;
    if (s.phase !== 'event' || s.map[s.current].type !== 'workshop') return;
    s.map[s.current].resolved = true;
    s.phase = 'explore';
    this.change();
  }

  atWorkshop() {
    return this.active() && this.state.map[this.state.current].type === 'workshop'
      && ['explore', 'event'].includes(this.state.phase);
  }

  craft(id) {
    if (!this.guard() || !this.atWorkshop()) { this.notice('Solo puedes fabricar en una estación de injertos.'); return; }
    const def = DDData.parts[id];
    if (!def || !this.meta.blueprints.includes(id) || (def.expansion && !this.meta.expansion)) return;
    const cost = 6 + def.tier * 5;
    if (this.state.scraps < cost) { this.notice(`Necesitas ${cost} de chatarra.`, 'warning'); return; }
    this.state.scraps -= cost;
    this.addPart(id);
    this.log(`Has fabricado ${def.name}. Está en tu bolsa de injertos.`);
    this.notice(`${def.name} añadido a la bolsa.`, 'good');
    this.sound('graft');
    this.change();
  }

  repair() {
    if (!this.guard() || !this.atWorkshop()) return;
    if (this.state.scraps < 8) { this.notice('Necesitas 8 de chatarra.'); return; }
    const parts = Object.values(this.state.body).filter(p => p.id);
    if (!parts.some(p => p.integrity < 100 || p.heat > 0)) { this.notice('Tus injertos intactos ya están en perfecto estado.'); return; }
    this.state.scraps -= 8;
    for (const part of parts) {
      part.integrity = Math.min(100, part.integrity + 40);
      part.heat = 0;
    }
    this.log('La estación repara 40 de integridad y enfría tus injertos intactos.');
    this.sound('graft');
    this.change();
  }

  equip(uid, slotId) {
    if (!this.guard()) return;
    const s = this.state;
    const slot = DDData.slots.find(v => v.id === slotId);
    const index = s.inventory.findIndex(item => item.uid === Number(uid));
    if (index < 0 || !slot) return;
    const item = s.inventory[index];
    if (DDData.parts[item.id].kind !== slot.kind) return;
    if (s.phase === 'combat' && s.energy < 1) { this.notice('Injertar durante el combate cuesta 1 de energía.'); return; }
    const old = s.body[slotId];
    s.inventory.splice(index, 1);
    if (old.id) s.inventory.push({ ...old, uid: ++s.uid });
    s.body[slotId] = { id: item.id, heat: item.heat, integrity: item.integrity };
    this.purgeSlot(slotId);
    if (s.phase === 'combat') {
      s.energy--;
      for (const card of this.cardsForSlot(slotId)) {
        if (s.hand.length < 7) s.hand.push(card);
        else s.draw.push(card);
      }
    }
    s.stats.grafts++;
    this.log(`Injertas ${DDData.parts[item.id].name} en ${slot.label.toLowerCase()}.`);
    this.notice('Injerto conectado. Tu cuerpo y tu mazo han cambiado.', 'good');
    this.sound('graft');
    this.change();
  }

  salvage(uid) {
    if (!this.guard()) return;
    const s = this.state;
    const index = s.inventory.findIndex(item => item.uid === Number(uid));
    if (index < 0) return;
    const item = s.inventory.splice(index, 1)[0];
    const amount = DDData.parts[item.id].tier * 3;
    s.scraps += amount;
    this.notice(`Injerto desguazado: +${amount} de chatarra.`, 'good');
    this.sound('loot');
    this.change();
  }

  useItem(kind) {
    if (!this.guard()) return;
    const s = this.state;
    if (kind === 'heal') {
      if (s.potions <= 0) { this.notice('No te quedan sueros.'); return; }
      if (s.hp >= s.maxHp) { this.notice('Tu vida ya está al máximo.'); return; }
      s.potions--;
      s.hp = Math.min(s.maxHp, s.hp + 28);
      this.log('Suero vital: recuperas hasta 28 de vida.');
      this.sound('heal');
    } else if (kind === 'cool') {
      if (s.coolants <= 0) { this.notice('No te queda refrigerante.'); return; }
      if (!Object.values(s.body).some(p => p.id && (p.heat > 0 || p.integrity < 100))) {
        this.notice('No necesitas enfriar ni reparar ningún injerto.'); return;
      }
      s.coolants--;
      for (const part of Object.values(s.body)) {
        if (!part.id) continue;
        part.heat = Math.max(0, part.heat - 38);
        part.integrity = Math.min(100, part.integrity + 12);
      }
      this.log('Refrigerante: −38° y +12 de integridad en todos los injertos intactos.');
      this.sound('cool');
    } else return;
    this.change();
  }

  cardsForSlot(slotId) {
    const slot = DDData.slots.find(v => v.id === slotId);
    const part = this.state.body[slotId];
    const fallback = { head: 'stumpHead', torso: 'stumpTorso', arm: 'stumpArm', leg: 'stumpLeg' };
    const ids = part.id ? DDData.parts[part.id].cards : [fallback[slot.kind]];
    return ids.map(id => ({ uid: ++this.state.uid, id, slot: slotId, part: part.id }));
  }

  fullDeck() {
    return DDData.slots.flatMap(slot => this.cardsForSlot(slot.id));
  }

  purgeSlot(slotId) {
    for (const zone of ['hand', 'draw', 'discard']) {
      this.state[zone] = this.state[zone].filter(card => card.slot !== slotId);
    }
  }

  stress(slotId, heat, wear) {
    const part = this.state.body[slotId];
    if (!part.id) return;
    part.heat = Math.min(100, part.heat + heat);
    part.integrity = Math.max(0, part.integrity - wear - (part.heat >= 75 ? 7 : 0));
    if (part.heat >= 100 || part.integrity <= 0) {
      const name = DDData.parts[part.id].name;
      this.state.body[slotId] = { id: null, heat: 0, integrity: 0 };
      this.state.stats.broken++;
      this.purgeSlot(slotId);
      if (this.state.phase === 'combat') this.state.draw.push(...this.cardsForSlot(slotId));
      this.notice(`¡${name} se ha roto! Sus cartas desaparecen. Injerta un reemplazo.`, 'danger');
      this.log(`${name} se rompe. Solo queda un muñón.`);
      this.sound('break');
      this.emit('effect', { type: 'break', slot: slotId });
    }
  }

  beginCombat(boss = false) {
    const s = this.state;
    let choices = s.floor === 0 ? ['orderly', 'scientist', 'stitched']
      : s.floor === 1 ? ['furnace', 'scientist', 'stitched'] : ['furnace', 'oracle', 'stitched'];
    if (this.meta.expansion) choices = [...choices, 'archivist'];
    const id = boss ? 'boss' : this.pick(choices);
    const def = DDData.enemies[id];
    const hp = def.hp + (boss ? 0 : s.floor * 7);
    s.enemy = { id, hp, maxHp: hp, block: 0, burn: 0, weak: 0, stun: 0, move: 0 };
    s.phase = 'combat';
    s.turn = 1;
    s.block = 0;
    s.energy = 3;
    s.hand = [];
    s.discard = [];
    s.draw = this.shuffle(this.fullDeck());
    this.drawCards(5);
    this.log(`${def.name} te bloquea el paso. La intención enemiga está a la vista.`);
    this.sound(boss ? 'boss' : 'combat');
  }

  drawCards(amount) {
    const s = this.state;
    for (let i = 0; i < amount && s.hand.length < 7; i++) {
      if (!s.draw.length) {
        if (!s.discard.length) break;
        s.draw = this.shuffle(s.discard);
        s.discard = [];
      }
      s.hand.push(s.draw.pop());
    }
  }

  intent() {
    const s = this.state;
    if (!s?.enemy) return null;
    const e = s.enemy;
    const def = DDData.enemies[e.id];
    const kind = def.pattern[e.move % def.pattern.length];
    const base = def.attack + (def.boss ? 0 : s.floor * 2) + (this.remaining() < 120000 ? 2 : 0);
    const damage = Math.floor(base * (kind === 'fury' ? 1.6 : 1) * (e.weak > 0 ? 0.6 : 1));
    if (e.stun > 0) return { kind: 'stunned', label: 'Aturdido · no actuará', value: 0, icon: 'bolt' };
    if (kind === 'guard') return { kind, label: 'Se protegerá · 12 defensa', value: 12, icon: 'shield' };
    if (kind === 'heat') return { kind, label: 'Vapor · +22° a un injerto', value: 22, icon: 'flame' };
    return { kind, label: `${kind === 'fury' ? 'Golpe brutal' : 'Atacará'} · ${damage} de daño`, value: damage, icon: 'blade' };
  }

  play(uid) {
    if (!this.guard() || this.state.phase !== 'combat') return;
    const s = this.state;
    const index = s.hand.findIndex(card => card.uid === Number(uid));
    if (index < 0) return;
    const card = s.hand[index];
    if (s.body[card.slot].id !== card.part) { this.purgeSlot(card.slot); this.change(); return; }
    const def = DDData.cards[card.id];
    if (def.cost > s.energy) { this.notice('No tienes suficiente energía. Termina el turno para recuperar 3.'); return; }
    s.energy -= def.cost;
    s.hand.splice(index, 1);
    if (def.damage) {
      let hit = def.damage;
      if (!def.pierce) {
        const blocked = Math.min(s.enemy.block, hit);
        s.enemy.block -= blocked;
        hit -= blocked;
      }
      s.enemy.hp = Math.max(0, s.enemy.hp - hit);
      this.emit('effect', { type: 'hit', amount: hit, target: 'enemy' });
    }
    if (def.block) s.block += def.block;
    if (def.heal) s.hp = Math.min(s.maxHp, s.hp + def.heal);
    if (def.energy) s.energy += def.energy;
    if (def.burn) s.enemy.burn += def.burn;
    if (def.weak) s.enemy.weak = Math.max(s.enemy.weak, def.weak);
    if (def.stun) s.enemy.stun = 1;
    if (def.cool) {
      for (const part of Object.values(s.body)) part.heat = Math.max(0, part.heat - def.cool);
    }
    this.stress(card.slot, def.heat, def.wear);
    // A broken/replaced part must not return through the discard pile.
    if (s.body[card.slot].id === card.part) s.discard.push(card);
    if (def.draw) this.drawCards(def.draw);
    this.log(`${def.name}: ${def.text}`);
    this.sound(def.damage ? 'attack' : def.heal ? 'heal' : def.block ? 'guard' : 'card');
    if (s.enemy.hp <= 0) this.victory();
    this.change();
  }

  endTurn() {
    if (!this.guard() || this.state.phase !== 'combat') return;
    const s = this.state;
    const e = s.enemy;
    if (e.burn > 0) {
      e.hp = Math.max(0, e.hp - e.burn);
      this.emit('effect', { type: 'hit', target: 'enemy', amount: e.burn });
      this.log(`La quemadura inflige ${e.burn} de daño.`);
      e.burn = Math.max(0, e.burn - 1);
      if (e.hp <= 0) { this.victory(); this.change(); return; }
    }
    const intent = this.intent();
    if (intent.kind === 'stunned') {
      this.log('El enemigo está aturdido. Su intención queda cancelada.');
      e.stun = 0;
    } else if (intent.kind === 'guard') {
      e.block = Math.min(24, e.block + intent.value);
      this.log('El enemigo se protege con 12 de defensa.');
      this.sound('guard');
    } else if (intent.kind === 'heat') {
      const slots = DDData.slots.filter(slot => s.body[slot.id].id);
      if (slots.length) {
        const slot = this.pick(slots);
        this.stress(slot.id, intent.value, 3);
        this.log(`Una descarga de vapor recalienta tu ${slot.label.toLowerCase()}.`);
        this.sound('burn');
      }
    } else {
      const damage = Math.max(0, intent.value - s.block);
      s.hp = Math.max(0, s.hp - damage);
      this.log(`El enemigo inflige ${damage} de daño; tu defensa absorbe ${Math.min(s.block, intent.value)}.`);
      this.emit('effect', { type: 'hit', target: 'player', amount: damage });
      this.sound(damage ? 'hurt' : 'guard');
    }
    if (s.hp <= 0) { this.finish(false, 'Tus suturas han cedido. La carne se queda; el espíritu continúa.'); return; }
    e.move++;
    e.weak = Math.max(0, e.weak - 1);
    for (const part of Object.values(s.body)) part.heat = Math.max(0, part.heat - 12);
    s.discard.push(...s.hand);
    s.hand = [];
    s.block = 0;
    s.energy = 3;
    s.turn++;
    this.drawCards(5);
    this.change();
  }

  victory() {
    const s = this.state;
    const def = DDData.enemies[s.enemy.id];
    const amount = 7 + s.floor * 3;
    const item = this.addPart(this.pick(def.loot));
    s.scraps += amount;
    s.hp = Math.min(s.maxHp, s.hp + 5);
    s.stats.kills++;
    s.map[s.current].resolved = true;
    s.reward = { id: item.id, uid: item.uid, scraps: amount, enemy: def.name, boss: Boolean(def.boss) };
    s.phase = 'loot';
    s.block = 0;
    this.log(`${def.name} cae. Cosechas ${DDData.parts[item.id].name}, ${amount} de chatarra y 5 de vida.`);
    this.sound('victory');
  }

  continueAfterLoot() {
    if (!this.guard() || this.state.phase !== 'loot') return;
    const s = this.state;
    s.phase = 'explore';
    s.hand = s.draw = s.discard = [];
    s.enemy = null;
    this.change();
  }

  escape() {
    if (!this.guard()) return;
    const s = this.state;
    if (s.floor !== 2 || s.current !== 3 || !s.map[3].resolved || s.phase !== 'explore') return;
    this.finish(true, 'Sales de la torre mientras el cielo se llena de ceniza. Este cuerpo, por fin, te pertenece.');
  }

  finish(won, reason) {
    if (!this.active()) return;
    const s = this.state;
    s.remainingAtEnd = Math.max(0, s.deadline - Date.now());
    s.phase = won ? 'won' : 'dead';
    s.reason = reason;
    if (!s.awarded) {
      s.awarded = true;
      s.earnedSouls = 3 + s.stats.kills + s.floor * 2 + (won ? 15 : 0);
      this.meta.souls += s.earnedSouls;
      if (won) {
        this.meta.wins++;
        const elapsed = 360000 - s.remainingAtEnd;
        this.meta.best = this.meta.best === null ? elapsed : Math.min(this.meta.best, elapsed);
      } else this.meta.deaths++;
    }
    this.log(reason);
    this.sound(won ? 'escape' : 'death');
    this.change();
  }

  buy(id) {
    if (id === 'expansion') {
      if (this.meta.expansion) return;
      if (this.meta.souls < 30) { this.notice('Necesitas 30 ecos. Los obtienes al terminar cada intento.'); return; }
      this.meta.souls -= 30;
      this.meta.expansion = true;
      this.notice('Ala prohibida abierta. Su archivista puede aparecer en los próximos encuentros.', 'good');
    } else {
      const skin = DDData.skins[id];
      if (!skin) return;
      if (!this.meta.skins.includes(id)) {
        if (this.meta.souls < skin.cost) { this.notice(`Necesitas ${skin.cost} ecos.`); return; }
        this.meta.souls -= skin.cost;
        this.meta.skins.push(id);
      }
      this.meta.skin = id;
      this.notice(`Apariencia equipada: ${skin.name}.`, 'good');
    }
    this.sound('discover');
    this.change();
  }

  setPreference(name, value) {
    if (!['volume', 'sfx', 'motion'].includes(name)) return;
    this.meta[name] = name === 'volume' ? Math.max(0, Math.min(1, Number(value))) : Boolean(value);
    this.save();
    this.emit('preference');
  }
};
