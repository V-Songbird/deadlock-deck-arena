// Run loop: dissection table, exploration, combat, harvest, the 6-minute clock, death/escape, shop, persistence.
// Owner: GAME worker. Spec: PRODUCT.md §5.4 (state) and §6 (rules). Uses DATA, Body, Tower, Combat, Snd. Never UI.
const Game = {
  /** The whole game state (PRODUCT.md §5.4). UI reads it every frame. */
  G: null,

  /** Load meta from localStorage ('deadlock-deck'), build G with screen 'title'. */
  init() {
    const meta = Game._loadMeta();
    Game.G = {
      screen: 'title',
      meta: meta,
      table: null,
      body: null,
      tower: null,
      floor: 0,
      pos: { x: 0, y: 0 },
      timeLeft: DATA.RUN_SECONDS,
      shiftIn: DATA.SHIFT_SECONDS,
      combat: null,
      harvest: null,
      run: Game._runStats(),
      message: null,
    };
    Snd.setMuted(meta.muted);
    Snd.music('title');   // no-op until the first gesture calls Snd.init(), which then starts it
  },

  /** To the dissection table: random base body, options from discovered blueprints (§6.1). */
  newRun() {
    const G = Game.G;
    if (!G) return;
    const bodies = DATA.baseBodies || [];
    const base = bodies[Math.floor(Math.random() * bodies.length)] || { name: '', slots: {} };
    const slots = {};
    DATA.SLOTS.forEach((slot) => { slots[slot] = base.slots[slot] || null; });
    G.table = { baseName: base.name, slots: slots, options: {} };
    Game._refreshOptions();
    G.body = null;
    G.tower = null;
    G.combat = null;
    G.harvest = null;
    G.floor = 0;
    G.pos = { x: 0, y: 0 };
    G.timeLeft = DATA.RUN_SECONDS;
    G.shiftIn = DATA.SHIFT_SECONDS;
    G.run = Game._runStats();
    G.message = null;
    G.screen = 'table';
    Snd.music('table');
  },

  /** Cycle table.slots[slot] through table.options[slot]. @param {1|-1} dir */
  tableCycle(slot, dir) {
    const G = Game.G;
    if (!G || G.screen !== 'table' || !G.table) return;
    const list = G.table.options[slot];
    if (!list || list.length === 0) return;
    const step = dir < 0 ? -1 : 1;
    const at = list.indexOf(G.table.slots[slot]);
    G.table.slots[slot] = list[((at < 0 ? 0 : at) + step + list.length) % list.length];
  },

  /** Table -> explore: build body and tower, reset the clock (§6.1). */
  rise() {
    const G = Game.G;
    if (!G || G.screen !== 'table' || !G.table) return;
    G.body = Body.create(G.table.slots);
    G.tower = Tower.generate();
    G.floor = 0;
    const F = G.tower.floors[0];
    G.pos = { x: F.start.x, y: F.start.y };
    Tower.reveal(F, G.pos.x, G.pos.y);
    G.timeLeft = DATA.RUN_SECONDS;
    G.shiftIn = DATA.SHIFT_SECONDS;
    G.combat = null;
    G.harvest = null;
    G.run = Game._runStats();
    G.message = null;
    G.meta.runs += 1;
    G.screen = 'explore';
    Snd.music('explore');
  },

  /** Move on the current floor and trigger the entered cell (§6.2). @param {'n'|'e'|'s'|'w'} dir */
  move(dir) {
    const G = Game.G;
    if (!G || G.screen !== 'explore') return;
    const F = Game._floor();
    const d = Tower.DIRS[dir];
    if (!F || !d || !Tower.canMove(F, G.pos.x, G.pos.y, dir)) {
      Snd.sfx('click');   // a wall: the move simply does not happen
      return;
    }
    G.pos.x += d.dx;
    G.pos.y += d.dy;
    Tower.reveal(F, G.pos.x, G.pos.y);
    Snd.sfx('step');
    const cell = Tower.cell(F, G.pos.x, G.pos.y);
    if (!cell) return;
    if (cell.type === DATA.ROOM.ENEMY) Game._enterEnemy(cell);
    else if (cell.type === DATA.ROOM.RESOURCE) Game._enterResource(cell);
    else if (cell.type === DATA.ROOM.TRAP) Game._enterTrap(cell);
    else if (cell.type === DATA.ROOM.STAIRS) Game._enterStairs();
    else if (cell.type === DATA.ROOM.EXIT) Game.escape();
  },

  /** Advance the clock, the labyrinth shift countdown and the message ttl (§6.3). @param {number} dt seconds */
  tick(dt) {
    const G = Game.G;
    if (!G) return;
    let step = Number(dt);
    if (!isFinite(step) || step <= 0) return;
    if (step > 0.1) step = 0.1;   // a long frame (tab in the background) never eats the clock

    if (Game._TICKING.indexOf(G.screen) >= 0) {
      const before = G.timeLeft;
      G.timeLeft -= step;
      // one tick per whole second crossed, only in the last half minute
      if (G.timeLeft > 0 && G.timeLeft < 30 && Math.ceil(G.timeLeft) !== Math.ceil(before)) Snd.sfx('tick');
      if (G.timeLeft <= 0) {
        G.timeLeft = 0;
        Game.die('el reloj');
      }
    }

    if (G.screen === 'explore') {
      G.shiftIn -= step;
      if (G.shiftIn <= 0) {
        const F = Game._floor();
        if (F) {
          Tower.shift(F);
          Tower.spawnEnemy(F, G.pos.x, G.pos.y);
          Game.say('¡El laberinto se retuerce!');
          Snd.sfx('shift');
        }
        G.shiftIn = DATA.SHIFT_SECONDS;
      }
    }

    if (G.message) {
      G.message.ttl -= step;
      if (G.message.ttl <= 0) G.message = null;
    }
  },

  /** Play hand[i] through Combat, map events to SFX, resolve win/loss (§6.4). */
  playCard(i) {
    const G = Game.G;
    if (!G || G.screen !== 'combat' || !G.combat) return;
    Game._afterCombat(Combat.play(G.combat, i));
  },

  /** End the combat turn through Combat, map events to SFX, resolve win/loss (§6.4). */
  endTurn() {
    const G = Game.G;
    if (!G || G.screen !== 'combat' || !G.combat) return;
    Game._afterCombat(Combat.endTurn(G.combat));
  },

  /** Graft a harvested limb into a slot of its type, discover the blueprint, back to explore (§6.5). */
  harvestPick(limbId, slot) {
    const G = Game.G;
    if (!G || G.screen !== 'harvest' || !G.harvest) return;
    if (G.harvest.limbs.indexOf(limbId) < 0) return;          // only what this corpse offers
    const limb = DATA.limbs[limbId];
    if (!limb || DATA.SLOTS.indexOf(slot) < 0 || DATA.slotType(slot) !== limb.type) return;
    Body.graft(G.body, slot, limbId);
    G.run.grafts += 1;
    if (G.meta.discovered.indexOf(limbId) < 0) G.meta.discovered.push(limbId);
    Snd.sfx('graft');
    Game.say(`Injertas ${limb.name} en tu ${String(DATA.SLOT_NAMES[slot]).toLowerCase()}`);
    Game._backToExplore();
  },

  /** Leave the harvest without grafting (§6.5). */
  harvestSkip() {
    const G = Game.G;
    if (!G || G.screen !== 'harvest') return;
    Game._backToExplore();
  },

  /** Table -> shop (§6.7). */
  openShop() {
    const G = Game.G;
    if (!G || G.screen !== 'table') return;
    G.screen = 'shop';
  },

  /** Shop -> table, refreshing table options (§6.7). */
  closeShop() {
    const G = Game.G;
    if (!G || G.screen !== 'shop') return;
    Game._refreshOptions();   // an unlock pack may have added blueprints
    G.screen = 'table';
  },

  /** Buy a cosmetic or an unlock pack with essence (§6.7). @param {string} id */
  buy(id) {
    const G = Game.G;
    if (!G || G.screen !== 'shop') return;
    const cosmetic = DATA.cosmetics[id];
    const unlock = cosmetic ? null : DATA.unlocks[id];
    const item = cosmetic || unlock;
    if (!item || !(item.price >= 0)) return;
    const owned = cosmetic ? G.meta.cosmetics.indexOf(id) >= 0 : G.meta.unlocks.indexOf(id) >= 0;
    if (owned) return;
    if (G.meta.essence < item.price) {
      Game.say('Esencia insuficiente');
      return;
    }
    G.meta.essence -= item.price;
    if (cosmetic) {
      G.meta.cosmetics.push(id);
    } else {
      G.meta.unlocks.push(id);
      (unlock.limbs || []).forEach((limbId) => {
        if (DATA.limbs[limbId] && G.meta.discovered.indexOf(limbId) < 0) G.meta.discovered.push(limbId);
      });
    }
    Game.say(`Compras ${item.name}`);
    Game.save();
    Snd.sfx('buy');
  },

  /** Equip an owned cosmetic tint. @param {string} cosmeticId */
  equip(cosmeticId) {
    const G = Game.G;
    if (!G || G.meta.cosmetics.indexOf(cosmeticId) < 0) return;
    const cosmetic = DATA.cosmetics[cosmeticId];
    G.meta.tint = cosmetic && cosmetic.tint ? cosmetic.tint : 'default';
    Game.save();
  },

  /** Any screen -> title (abandons the run). */
  toTitle() {
    const G = Game.G;
    if (!G) return;
    G.screen = 'title';
    Snd.music('title');
  },

  /** death/escape -> newRun(). */
  afterEnd() {
    const G = Game.G;
    if (!G || (G.screen !== 'death' && G.screen !== 'escape')) return;
    Game.newRun();
  },

  /** Flip meta.muted, Snd.setMuted, save. */
  toggleMute() {
    const G = Game.G;
    if (!G) return;
    G.meta.muted = !G.meta.muted;
    Snd.setMuted(G.meta.muted);
    Game.save();
  },

  /** Set G.message = { text, ttl }. @param {string} text @param {number} [ttl=3] */
  say(text, ttl = 3) {
    if (!Game.G) return;
    Game.G.message = { text: String(text), ttl: ttl };
  },

  /** Persist G.meta (§6.8). */
  save() {
    const store = Game._store();
    if (!store || !Game.G) return;
    try {
      store.setItem(Game._KEY, JSON.stringify(Game.G.meta));
    } catch (e) { /* quota or a blocked store: progress just is not persisted */ }
  },

  /** The run ends in death (§6.6). @param {string} cause Spanish text */
  die(cause) {
    const G = Game.G;
    if (!G || G.screen === 'death' || G.screen === 'escape') return;
    G.run.cause = cause;
    G.meta.essence += G.run.essence;
    Game.save();
    G.screen = 'death';
    Snd.sfx('death');
    Snd.music('off');
  },

  /** The run ends in escape (§6.6). */
  escape() {
    const G = Game.G;
    if (!G || !G.body || G.screen === 'death' || G.screen === 'escape') return;
    G.meta.escapes += 1;
    G.meta.essence += G.run.essence;
    Game.save();
    G.screen = 'escape';
    Snd.sfx('escape');
    Snd.music('title');
  },

  // ---------------------------------------------------------------------------
  // Private helpers. Only js/game.js touches these.
  // ---------------------------------------------------------------------------

  /** @private localStorage key holding the meta progress (§6.8). */
  _KEY: 'deadlock-deck',

  /** @private Screens where the anatomical clock runs down (§6.3). */
  _TICKING: ['explore', 'combat', 'harvest'],

  /** @private @returns {{essence:number, kills:number, grafts:number, cause:string|null}} a zeroed run */
  _runStats() {
    return { essence: 0, kills: 0, grafts: 0, cause: null };
  },

  /** @private @returns {Object|null} the Storage object, or null when missing or blocked */
  _store() {
    try {
      return typeof localStorage !== 'undefined' && localStorage ? localStorage : null;
    } catch (e) {
      return null;   // some privacy modes throw on the mere access
    }
  },

  /** @private @returns {Object} meta with every field at its default value */
  _defaultMeta() {
    return {
      discovered: [],
      essence: 0,
      cosmetics: ['default'],
      unlocks: [],
      tint: 'default',
      escapes: 0,
      runs: 0,
      muted: false,
    };
  },

  /** @private Read the save and merge it over the defaults, so an old save never lacks a field (§6.8). */
  _loadMeta() {
    const meta = Game._defaultMeta();
    let saved = null;
    try {
      const store = Game._store();
      const raw = store ? store.getItem(Game._KEY) : null;
      saved = raw ? JSON.parse(raw) : null;
    } catch (e) {
      saved = null;   // missing or corrupt: the defaults stand
    }
    if (!saved || typeof saved !== 'object') return meta;
    ['discovered', 'cosmetics', 'unlocks'].forEach((key) => {
      if (!Array.isArray(saved[key])) return;
      saved[key].forEach((id) => {
        if (typeof id === 'string' && meta[key].indexOf(id) < 0) meta[key].push(id);
      });
    });
    ['essence', 'escapes', 'runs'].forEach((key) => {
      const n = Number(saved[key]);
      if (isFinite(n) && n >= 0) meta[key] = Math.floor(n);
    });
    if (typeof saved.tint === 'string') meta.tint = saved.tint;
    meta.muted = !!saved.muted;
    return meta;
  },

  /** @private @returns {Object|null} the floor the player stands on */
  _floor() {
    const G = Game.G;
    return G && G.tower && G.tower.floors[G.floor] ? G.tower.floors[G.floor] : null;
  },

  /** @private table.options[slot] = [base limb, ...discovered limbs of that type], without duplicates (§6.1). */
  _refreshOptions() {
    const G = Game.G;
    const table = G && G.table;
    if (!table) return;
    // The base body is recovered by name so a refresh never drops it from the list.
    const base = (DATA.baseBodies || []).filter((b) => b.name === table.baseName)[0] || { slots: {} };
    DATA.SLOTS.forEach((slot) => {
      const type = DATA.slotType(slot);
      const list = [];
      const add = (id) => {
        if (id && DATA.limbs[id] && list.indexOf(id) < 0) list.push(id);
      };
      add(base.slots[slot]);
      G.meta.discovered.forEach((id) => {
        if (DATA.limbs[id] && DATA.limbs[id].type === type) add(id);
      });
      add(table.slots[slot]);
      table.options[slot] = list;
      if (list.indexOf(table.slots[slot]) < 0) table.slots[slot] = list.length ? list[0] : null;
    });
  },

  /** @private A random undiscovered tier >= 1 limb joins meta.discovered. @returns {string|null} its id */
  _discover() {
    const G = Game.G;
    const pool = [];
    for (const id in DATA.limbs) {
      const limb = DATA.limbs[id];
      if (limb && (limb.tier || 0) >= 1 && G.meta.discovered.indexOf(id) < 0) pool.push(id);
    }
    if (pool.length === 0) return null;
    const id = pool[Math.floor(Math.random() * pool.length)];
    G.meta.discovered.push(id);
    return id;
  },

  /** @private An enemy room: combat starts at once (§6.2). */
  _enterEnemy(cell) {
    const G = Game.G;
    G.combat = Combat.start(G.body, cell.content);
    G.screen = 'combat';
    Snd.music('combat');
  },

  /** @private A resource room: apply its fx, empty the cell, announce it (§6.2). */
  _enterResource(cell) {
    const G = Game.G;
    const res = DATA.resources[cell.content];
    const fx = (res && res.fx) || {};
    const name = (res && res.name) || 'Un hallazgo';
    let text = `${name}.`;
    if (fx.heal) {
      const before = G.body.hp;
      G.body.hp = Math.min(G.body.maxHp, G.body.hp + fx.heal);
      text = `${name}: recuperas ${G.body.hp - before} PV.`;
    }
    if (fx.cool) {
      Body.cool(G.body, fx.cool);
      text = `${name}: el frío recorre tus junturas.`;
    }
    if (fx.essence) {
      G.run.essence += fx.essence;
      text = `${name}: +${fx.essence} de esencia.`;
    }
    if (fx.blueprint) {
      const found = Game._discover();
      if (found) {
        text = `${name}: descubres ${DATA.limbs[found].name}.`;
      } else {
        G.run.essence += 10;   // nothing left to discover: the parchment is worth essence
        text = `${name}: ya no queda plano por descubrir; +10 de esencia.`;
      }
    }
    cell.type = DATA.ROOM.EMPTY;
    cell.content = null;
    Game.say(text);
    Snd.sfx('pickup');
  },

  /** @private A trap room: damage plus heat in both legs, which may break them (§6.2). */
  _enterTrap(cell) {
    const G = Game.G;
    G.body.hp -= DATA.TRAP_DAMAGE;
    const broken = [];
    ['legL', 'legR'].forEach((slot) => {
      const heat = Body.addHeat(G.body, slot, DATA.TRAP_HEAT);
      if (heat && heat.broke) broken.push(String(DATA.SLOT_NAMES[slot]).toLowerCase());
    });
    cell.type = DATA.ROOM.EMPTY;
    cell.content = null;
    let text = `¡Una trampa! Pierdes ${DATA.TRAP_DAMAGE} PV.`;
    if (broken.length) {
      text += ` Se te rompe la ${broken.join(' y la ')}`;
      Snd.sfx('break');
    }
    Game.say(text);
    Snd.sfx('trap');
    if (G.body.hp <= 0) {
      G.body.hp = 0;
      Game.die('una trampa');
    }
  },

  /** @private The stairs: up to the next floor's start (§6.2). */
  _enterStairs() {
    const G = Game.G;
    const next = G.tower.floors[G.floor + 1];
    if (!next) return;
    G.floor += 1;
    G.pos.x = next.start.x;
    G.pos.y = next.start.y;
    Tower.reveal(next, G.pos.x, G.pos.y);
    Game.say(`Subes al piso ${G.floor + 1}`);
    Snd.sfx('stairs');
  },

  /** @private Map combat events to SFX, then resolve a finished combat (§6.4). */
  _afterCombat(events) {
    const G = Game.G;
    (events || []).forEach((ev) => {
      if (ev.type === 'play') Snd.sfx('card');
      else if (ev.type === 'hit') Snd.sfx(ev.target === 'enemy' ? 'hit' : 'hurt');
      else if (ev.type === 'enemyAct' && ev.kind === 'attack') Snd.sfx('growl');
      else if (ev.type === 'break') Snd.sfx('break');
      else if (ev.type === 'heal') Snd.sfx('heal');
      else if (ev.type === 'cool') Snd.sfx('cool');
    });
    const C = G.combat;
    if (!C || C.phase === 'player') return;
    if (C.phase === 'won') {
      G.run.kills += 1;
      G.run.essence += C.essence || 0;
      const cell = Tower.cell(Game._floor(), G.pos.x, G.pos.y);
      if (cell) {
        cell.type = DATA.ROOM.EMPTY;
        cell.content = null;
      }
      const limbs = [];
      (C.loot || []).forEach((id) => {
        if (DATA.limbs[id] && limbs.indexOf(id) < 0) limbs.push(id);   // one row per distinct limb
      });
      G.harvest = { limbs: limbs, essence: C.essence || 0, enemyName: C.enemy.name };
      G.screen = 'harvest';
    } else if (C.phase === 'lost') {
      Game.die(C.enemy.name);
    }
  },

  /** @private Harvest -> explore (§6.5). */
  _backToExplore() {
    const G = Game.G;
    G.harvest = null;
    G.combat = null;
    G.screen = 'explore';
    Snd.music('explore');
  },
};
