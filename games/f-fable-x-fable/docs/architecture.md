# Deadlock Deck: El Reloj Anatómico — architecture and module contract

Single-page HTML5 game. Vanilla JavaScript (ES2020), Canvas 2D, Web Audio API.
No build step, no dependencies, no tests, no ES modules. `index.html` is opened
directly from disk (`file://`), so every script is a classic `<script>` that
attaches to the global `window.DD` namespace. Works on desktop (mouse/keyboard)
and mobile browsers (touch), which covers the "PC, consoles, mobile" platforms
of the concept as far as a prototype goes.

Language rules: code identifiers, comments and docs in **English**; every
string the player sees in **Spanish** (with proper accents: á é í ó ú ñ ¿ ¡).

## Files, load order and owners

`index.html` loads the scripts in exactly this order:

| # | file | global | owner |
|---|------|--------|-------|
| 1 | `src/core.js` | `DD` (namespace, constants, helpers) | orchestrator (done) |
| 2 | `src/data.js` | `DD.data` | Worker A |
| 3 | `src/sprites.js` | `DD.sprites` | Worker C |
| 4 | `src/input.js` | `DD.input` | Worker C |
| 5 | `src/render.js` | `DD.render`, `DD.ui` | Worker C |
| 6 | `src/audio.js` | `DD.audio` | Worker D |
| 7 | `src/body.js` | `DD.body` | Worker A |
| 8 | `src/tower.js` | `DD.tower` | Worker B |
| 9 | `src/explore.js` | `DD.explore` | Worker B |
| 10 | `src/combat.js` | `DD.combat` | Worker A |
| 11 | `src/meta.js` | `DD.meta` | Worker E |
| 12 | `src/screens.js` | `DD.screens` | Worker E |
| 13 | `src/main.js` | `DD.game` | Worker E |

Rule: at **load time** a file may only touch globals defined by files above it.
At **run time** (inside functions) any module may call any other. Each worker
edits only the files it owns. No other files are created (no package.json, no
assets folder: all art and audio are generated in code).

## core.js (already written, read it)

```js
DD.W = 640; DD.H = 360;             // logical pixel-art resolution, 16:9
DD.RUN_SECONDS = 360;               // the 6-minute clock
DD.MUTATE_EVERY = 45;               // seconds between tower mutations
DD.FLOORS = 3;
DD.SLOTS = ['head','torso','armL','armR','legL','legR'];
DD.SLOT_TYPE = { head:'head', torso:'torso', armL:'arm', armR:'arm', legL:'leg', legR:'leg' };
DD.SLOT_NAME = { head:'Cabeza', torso:'Torso', armL:'Brazo izq.', ... };
DD.run, DD.screen, DD.setScreen(screen)
DD.rand(n) DD.pick(arr) DD.shuffle(arr) DD.chance(p) DD.clamp(v,a,b)
DD.fmtTime(seconds) -> 'm:ss'
DD.log(msg)                         // pushes to DD.run.log (max 6 lines)
```

## Run state — `DD.run` (created by main.js when a run starts)

```js
DD.run = {
  hp: 30, maxHp: 30,
  body: {                     // one entry per DD.SLOTS key
    head:  { id: 'cabeza_reanimada', heat: 0 },
    torso: { id: 'torso_suturado',   heat: 0 },
    armL:  { id: 'brazo_cadaver',    heat: 0 },
    armR:  null,              // null === stump (broken limb, nothing grafted yet)
    legL:  { ... }, legR: { ... }
  },
  timeLeft: 360,              // seconds (float). main.js decrements it on EVERY screen of a run.
  floorIndex: 0,              // 0 .. DD.FLOORS-1
  floor: null,                // current floor object (see tower.js)
  ichor: 0,                   // currency collected this run (banked into meta at the end)
  discovered: [],             // limb ids discovered this run (blueprints), no duplicates
  kills: 0,
  palette: 'palido',          // cosmetic palette id for the player's body
  log: []                     // recent messages, newest last, <= 6 (use DD.log)
};
```

A limb instance is `{ id, heat }`. `heat` goes from 0 to the blueprint's
`maxHeat`; reaching `maxHeat` breaks the limb: the slot becomes `null`
(a stump) and the limb's cards disappear from the deck.

## Concept → features (everything must exist)

| Concept | Implementation |
|---------|----------------|
| Deck = body, 6 slots (head, torso, 2 arms, 2 legs), each limb has its own cards | `DD.body.deck(body)` is the union of the cards of the intact limbs; grafting a limb changes the deck |
| Thermal degradation: powerful cards overheat limbs; broken limb = lose its cards, fight with a stump | cards have `heat`; `DD.body.heat()` breaks limbs at `maxHeat`; a stump contributes one weak card `golpe_munon` |
| 6-minute loop: die or time out → new dissection table, new base body, keep blueprints, tower regenerates | `main.js` clock; death/timeout → death screen → dissection screen with `DD.body.newBase()`; `DD.meta.blueprints` persists in localStorage; floors are procedurally generated every run |
| Explore procedural corridors, collect resources, avoid traps | `tower.js` maze grid per floor, `explore.js` screen; resources: vial, coolant, ichor; traps visible when revealed so they can be avoided |
| Ever-changing labyrinth | every `DD.MUTATE_EVERY` seconds `DD.tower.mutate(floor)` re-rolls the doors |
| Fast turn-based combat with limb cards | `combat.js`: 3 energy, draw 5, enemy intents, real-time clock keeps running |
| Harvest limbs from defeated enemies | victory overlay: enemy `drops`, graft one into a fitting slot (or skip); every drop seen becomes a discovered blueprint |
| Escape before the clock hits 0 | floor 3 has the exit guarded by the `maestro`; reaching it after the guard falls → escape screen |
| Gothic-alchemical pixel art | `sprites.js` string-array sprites, `render.js` pixel buffer scaled with smoothing off |
| Ominous synthesized soundtrack, guttural SFX | `audio.js` procedural Web Audio music + noise/oscillator SFX, no audio files |
| Free-to-play with cosmetic microtransactions / content unlocks | `screens.shop`: palettes bought with Ichor (simulated, no real payments) or unlocked by blueprint count; codex screen shows unlocked blueprints |

## Fixed roster (ids are shared by data.js and sprites.js — do not rename)

Limb types: `head`, `torso`, `arm` (fits `armL`/`armR`), `leg` (fits `legL`/`legR`).

Base limbs (`base: true`, `source: null`; the dissection table picks one random
base limb per slot):

| id | name | type |
|----|------|------|
| `cabeza_reanimada` | Cabeza Reanimada | head |
| `cabeza_ahorcado` | Cabeza de Ahorcado | head |
| `torso_suturado` | Torso Suturado | torso |
| `torso_mendigo` | Torso de Mendigo | torso |
| `brazo_cadaver` | Brazo de Cadáver | arm |
| `brazo_sepulturero` | Brazo de Sepulturero | arm |
| `pierna_cadaver` | Pierna de Cadáver | leg |
| `pierna_bailarina` | Pierna de Bailarina | leg |

Enemies and their harvestable limbs (`source: enemyId`):

| enemy id | name | elite | floors | drops |
|----------|------|-------|--------|-------|
| `homunculo` | Homúnculo | no | 1,2 | `brazo_homunculo` (arm) Brazo de Homúnculo, `pierna_homunculo` (leg) Pierna de Homúnculo |
| `sabueso` | Sabueso Suturado | no | 1,2 | `cabeza_sabueso` (head) Cabeza de Sabueso, `pierna_sabueso` (leg) Pata de Sabueso |
| `alquimista` | Alquimista Corrupto | no | 2,3 | `cabeza_alquimista` (head) Cabeza de Alquimista, `brazo_alquimista` (arm) Brazo de Alquimista |
| `cirujano` | Cirujano Demente | no | 2,3 | `brazo_cirujano` (arm) Brazo de Cirujano, `torso_cirujano` (torso) Torso de Cirujano |
| `automata` | Autómata de Latón | yes | 2,3 | `brazo_automata` (arm) Brazo de Autómata, `torso_automata` (torso) Torso de Autómata, `pierna_automata` (leg) Pierna de Autómata |
| `golem` | Gólem de Carne | yes | 2,3 | `torso_golem` (torso) Torso de Gólem, `brazo_golem` (arm) Brazo de Gólem, `pierna_golem` (leg) Pierna de Gólem |
| `maestro` | Maestro Alquimista | boss (guards the exit on floor 3) | 3 | `cabeza_maestro` (head) Cabeza del Maestro, `torso_maestro` (torso) Torso del Maestro |

Flavor: monstrosities (homúnculo, sabueso, gólem, autómata) and corrupt
scientists (alquimista, cirujano, maestro). 24 limbs total; the codex ("Planos
anatómicos") lists all of them, base ones always known.

Traps (`DD.data.traps`): `vapor` (Trampa de vapor: +3 heat on a random intact
limb), `cuchillas` (Suelo de cuchillas: −6 HP), `reloj` (Reloj saboteado: −20
seconds), `acido` (Charco de ácido: +2 heat on every intact limb).

Palettes (`DD.data.palettes`, cosmetics; colors live in sprites.js):

| id | name | price (Ichor) | unlock (blueprints discovered) |
|----|------|---------------|--------------------------------|
| `palido` | Pálido | 0 | 0 |
| `verdoso` | Verdoso | 0 | 6 |
| `cobre` | Cobre | 25 | 0 |
| `ebano` | Ébano | 50 | 0 |

## data.js — `DD.data` (Worker A)

```js
DD.data.limbs = { [id]: { id, name, type, base, source, maxHeat, hpBonus, cards: [cardId, ...], desc } };
DD.data.cards = { [id]: { id, name, cost, heat, desc, fx: { dmg, hits, block, heal, draw, energy, cool, coolAll, weak, vuln } } };
DD.data.enemies = { [id]: { id, name, hp, elite, floors: [1..3], drops: [limbId], pattern: [intent, ...], desc } };
DD.data.traps = { vapor: { id, name, desc }, cuchillas, reloj, acido };
DD.data.palettes = [ { id, name, price, unlock }, ... ];   // table above
DD.data.STUMP_CARD = 'golpe_munon';
```

- `cost` = energy (0-3). `heat` = heat added to the card's limb when played (0-4;
  powerful cards are hot). `maxHeat` ≈ 6-12 depending on the limb.
- `fx` keys (all optional, numbers): `dmg` (per hit), `hits` (default 1), `block`,
  `heal`, `draw`, `energy`, `cool` (cools the card's own limb), `coolAll`
  (cools every limb), `weak` (enemy deals 25% less for N turns), `vuln`
  (enemy takes 25% more for N turns).
- Each limb has 2-3 cards (may repeat ids). `hpBonus` is mostly on torsos.
- The stump card `golpe_munon` ("Golpe de muñón"): cost 1, heat 0, dmg 3.
- Enemy intents cycle through `pattern` in order:
  `{type:'attack', dmg, hits?}` | `{type:'block', amt}` | `{type:'heat', amt}`
  (steam/acid: adds heat to a random intact player limb) | `{type:'weak', turns}` |
  `{type:'heal', amt}`.

## body.js — `DD.body` (Worker A)

```js
DD.body.newBase()                 // -> body object: one random base limb per slot, heat 0
DD.body.maxHp(body)               // -> 30 + sum(hpBonus) of intact limbs
DD.body.deck(body)                // -> [{ cardId, slot }, ...] cards of intact limbs; each stump adds one { cardId: DD.data.STUMP_CARD, slot }
DD.body.fits(slot, limbId)        // -> bool (type matches slot)
DD.body.graft(run, slot, limbId)  // replaces the slot's limb (or stump) with { id, heat: 0 }; recomputes maxHp (hp clamped, keeps the same missing-hp); DD.log('Injertas ...'); DD.audio.sfx('graft')
DD.body.heat(run, slot, amount)   // adds heat; returns true if the limb broke (slot -> null, DD.log(...), DD.audio.sfx('break'), maxHp recomputed)
DD.body.cool(run, amount, slot)   // slot omitted -> all limbs; heat never below 0
DD.body.intact(body)              // -> number of non-null slots
```

## combat.js — `DD.combat` (Worker A) — engine + screen

```js
DD.combat.begin(run, enemyId, { onEnd(result) });  // result = { won: bool, drops: [limbId] }
DD.combat.update(dt);  DD.combat.draw(ctx);
```

Rules:
- Player: 3 energy per turn, draws 5 (hand cap 8), block resets at the start
  of the player's turn. Deck = `DD.body.deck(run.body)` instances get a `uid`.
  Draw pile reshuffles the discard when empty.
- Playing a card: pay energy, apply `fx` (damage to enemy minus enemy block,
  block, heal, draw, energy, cool, weak, vuln), then `DD.body.heat(run, card.slot, card.heat)`.
  If that breaks the limb, remove **every** card of that slot from hand, draw
  and discard immediately (the stump card `golpe_munon` for that slot enters
  the discard pile so the deck can never be empty).
- Passive cooling: at the start of each player turn every intact limb cools 1.
- Enemy: intents cycle through `pattern`; the next intent is always shown
  ("Intención"). `attack` damage reduced by player block; `heat` calls
  `DD.body.heat` on a random intact slot; enemy `block` lasts until its next turn.
- Player HP ≤ 0 → `onEnd({ won: false })`. Enemy HP ≤ 0 → `run.kills++`, harvest
  overlay ("Cosecha"): shows every limb in the enemy's `drops` with its cards;
  the player picks one and a fitting slot (replacing what is there), or skips.
  Every drop shown is pushed to `run.discovered` (blueprint discovered).
  Then `onEnd({ won: true, drops })`.
- The 6-minute clock keeps running during combat (main.js owns it; combat only
  draws the HUD). If time runs out mid-combat main.js handles the death.
- Layout (640×360): HUD strip at the top (`DD.ui.hud`), enemy sprite + HP bar +
  intent on the right half, player body (`DD.ui.drawBody` with heat bars) on the
  left, hand of cards along the bottom (`DD.ui.drawCard`), "Fin de turno" button,
  energy counter, draw/discard counts, short log. Input: click/tap a card to play
  it, keys 1-8 play, Space/Enter ends the turn. Keep it fast: short animations
  (≤ 0.3 s), no blocking waits.

## tower.js — `DD.tower` (Worker B)

```js
DD.tower.floorNames = ['Sótano de Disección', 'Galería de Especímenes', 'Laboratorio Superior'];
DD.tower.generateFloor(index)     // -> floor
DD.tower.cellAt(floor, x, y)      // -> cell | null
DD.tower.neighbors(floor, cell)   // -> cells reachable through cell.doors
DD.tower.mutate(floor)            // re-rolls ALL doors as a fresh connected maze (contents/visited/revealed kept); floor.mutations++
```

```js
floor = { index, name, w: 7, h: 4, cells: [cell...] /* row-major, y*w+x */, px, py /* player cell */, mutations: 0 };
cell  = { x, y, type, enemyId, trapId, visited: false, revealed: false, cleared: false, doors: { n, s, e, w } };
// type: 'start' | 'empty' | 'enemy' | 'elite' | 'vial' | 'coolant' | 'ichor' | 'trap' | 'stairs' | 'exit'
```

- Doors are symmetric (if `a.doors.e` then `b.doors.w`). The maze is always
  connected (spanning tree + a few extra doors).
- `start` at the left column, `stairs` (floors 0-1) or `exit` (last floor) at the
  right column, far from start. The exit cell has `enemyId: 'maestro'` (the guard).
- Per floor roughly: 4-5 `enemy`, 0-1 `elite` (floors 2-3 only), 2-3 resources
  (`vial`, `coolant`, `ichor`), 2 `trap`, rest `empty`. Enemies are chosen among
  `DD.data.enemies` whose `floors` include `index + 1` (non-elite for `enemy`
  cells, elite for `elite` cells).

## explore.js — `DD.explore` (Worker B) — screen

```js
DD.explore.begin(run, { onCombat(enemyId, cell), onEscape() });  // generates floor 0 when run.floor is null and places the player at 'start'
DD.explore.resume(cell, won)      // main.js calls it after a combat started from `cell`: mark cleared; if the cell is the exit and won -> onEscape()
DD.explore.update(dt);  DD.explore.draw(ctx);
```

- Movement: click/tap a neighboring connected cell, or arrow keys / WASD.
  A move takes ~0.2 s. Entering a cell: `visited = true`, its neighbors get
  `revealed = true` (their icon becomes visible so traps can be avoided).
- Entering an uncleared cell triggers it once (then `cleared = true`):
  `vial` +10 HP (max `maxHp`), `coolant` `DD.body.cool(run, 5)`, `ichor`
  +5..10 `run.ichor`, `trap` applies `trapId` (see traps), `enemy`/`elite` →
  `onCombat(cell.enemyId, cell)`, `stairs` → `run.floorIndex++`, new floor,
  player at its start, `DD.audio.sfx('stairs')`, `exit` → `onCombat('maestro', cell)`
  if not cleared, else `onEscape()`.
- Mutation: whenever `run.timeLeft` crosses a multiple of `DD.MUTATE_EVERY`
  (315, 270, 225, ...) call `DD.tower.mutate(run.floor)`, show the banner
  "La torre se retuerce" for ~1.5 s and play `DD.audio.sfx('mutate')`.
- Draw: `DD.ui.background(ctx, 'corridor')`, the grid (cells ~48 px, doors as
  gaps in the walls), icons via `DD.ui.icon` for revealed cells, unexplored
  cells dark, player token (`DD.ui.drawBody` at small scale or `DD.ui.sprite('token')`),
  floor name, `DD.ui.hud`, `DD.ui.log`, and a hint line ("Toca una sala contigua").

## sprites.js, input.js, render.js — Worker C

### `DD.input`
```js
DD.input.init(canvas)             // pointer (mouse + touch) and keyboard listeners; coordinates mapped to logical 640×360 via DD.render.toLogical
DD.input.x, DD.input.y            // logical pointer position
DD.input.down                     // pointer currently pressed
DD.input.clicked                  // true only during the frame in which a click/tap was released
DD.input.keyPressed(code)         // true only during the frame the key went down ('Space','Enter','ArrowLeft','KeyW','Digit1', ...)
DD.input.anyInteraction           // true once the user has clicked or pressed a key (for audio unlock)
DD.input.beginFrame(); DD.input.endFrame();   // called by main.js around update+draw
```

### `DD.render`
```js
DD.render.init(canvas)            // creates the 640×360 offscreen buffer, sizes the visible canvas to fit the window (integer scale when possible, letterboxed), listens to resize
DD.render.ctx                     // 2D context of the offscreen buffer (all drawing goes here)
DD.render.present()               // blits the buffer to the visible canvas, smoothing off
DD.render.toLogical(clientX, clientY) // -> { x, y }
```

### `DD.ui` (all functions take the buffer ctx first)
```js
DD.ui.text(ctx, str, x, y, { size: 1|2, color, align: 'left'|'center'|'right', maxWidth })  // bitmap pixel font (5×7 or similar) with Spanish accents; size 2 = double
DD.ui.textWidth(str, size)
DD.ui.wrap(str, maxWidth, size)   // -> [lines]
DD.ui.button(ctx, x, y, w, h, label, { disabled, small, color })  // draws AND returns true when clicked this frame (immediate mode); plays DD.audio.sfx('click')
DD.ui.panel(ctx, x, y, w, h, { title, color })    // bordered gothic panel
DD.ui.bar(ctx, x, y, w, h, ratio, fg, bg)
DD.ui.sprite(ctx, key, x, y, { scale, flip, palette, tint })
DD.ui.icon(ctx, name, x, y, { scale })            // room/UI icons: 'start','empty','enemy','elite','vial','coolant','ichor','trap','stairs','exit','heat','hp','clock','energy','skull','lock','check'
DD.ui.drawBody(ctx, x, y, body, { scale, palette, showHeat, labels })   // assembled figure anchored bottom-center; stumps drawn as bandaged stubs; heat bars per slot when showHeat
DD.ui.drawEnemy(ctx, enemyId, x, y, { scale, hurt, flip })
DD.ui.drawCard(ctx, cardDef, x, y, { slot, selected, disabled, playable })   // card w/h = DD.ui.CARD_W × DD.ui.CARD_H (≈ 72×96); shows name, cost, heat, desc (wrapped), slot badge color DD.ui.SLOT_COLOR[slot]
DD.ui.hud(ctx, run)               // top strip (y 0-22): HP, floor name, big clock (red + pulsing under 30 s), Ichor
DD.ui.log(ctx, run, x, y, w)      // run.log lines
DD.ui.background(ctx, kind)       // 'title' | 'lab' | 'corridor' | 'table' | 'roof' — gothic alchemical backdrops (stone, pipes, alembics, chains, fire glow), drawn from sprites/procedural tiles
DD.ui.CARD_W, DD.ui.CARD_H, DD.ui.SLOT_COLOR = { head, torso, armL, armR, legL, legR }
```

### `DD.sprites`
Sprite data as arrays of strings (one char per pixel) with a color map;
body-part sprites use color **roles** (`skin`, `skinDark`, `stitch`, `bone`,
`cloth`, `metal`, `glow`, ...) so palettes can recolor them.
`DD.sprites.palettes = { palido: {...}, verdoso: {...}, cobre: {...}, ebano: {...} }`.
Every limb id in the roster has a sprite; every enemy id has a sprite (≈ 24-32
px tall); stumps per slot; icons; card frame; UI ornaments.

## audio.js — `DD.audio` (Worker D)

```js
DD.audio.init()                   // idempotent; creates/resumes the AudioContext (main.js calls it on every user interaction until running)
DD.audio.music(name)              // 'title' | 'explore' | 'combat' | 'death' | 'escape' | 'off' — procedural looping synth score, crossfades
DD.audio.setIntensity(v)          // 0..1, main.js sets 1 - timeLeft/360: tempo/filter/drum layers rise as the clock runs out
DD.audio.sfx(name)                // 'click','card','hit','block','heal','break','graft','growl','death','trap','pickup','step','mutate','tick','escape','heat','stairs','harvest','error'
DD.audio.toggleMute(); DD.audio.muted
```
Everything is synthesized (oscillators, noise buffers, filters, envelopes):
ominous minor-key drones, slow arpeggios, distant bells/percussion; guttural
SFX = pitched-down noise bursts, formant-ish filters, wet crunches for
`break`/`graft`/`harvest`.

## meta.js — `DD.meta` (Worker E)

```js
DD.meta.state = { blueprints: [], ichor: 0, palettesOwned: ['palido'], palette: 'palido', runs: 0, escapes: 0, bestFloor: 0, bestTime: null, muted: false };
DD.meta.load(); DD.meta.save();   // localStorage key 'deadlockdeck.v1'; survives reloads
DD.meta.discover(limbId) -> bool  // true if new (base limbs are not stored; they are always known)
DD.meta.canUsePalette(id) -> bool // owned, or unlock threshold reached
DD.meta.buyPalette(id) -> bool
```

## screens.js — `DD.screens` (Worker E)

Each screen is `{ begin(...), update(dt), draw(ctx) }`:
- `title`: name, subtitle "El Reloj Anatómico", short "cómo jugar" text, buttons
  "Reanimar" (new run), "Planos" (codex), "Cosméticos" (shop), mute toggle, stats.
- `dissection`: "Mesa de disección": the new base body (`DD.ui.drawBody` large),
  the six slots with limb names and their cards, optional "Injertar plano":
  choose a discovered blueprint from `DD.meta.state.blueprints` and a fitting slot
  (one graft only), then "Despertar" → `DD.game.startRun()`.
- `death`: cause ("Has muerto" / "El reloj se detuvo"), floor reached, blueprints
  discovered this run (new ones marked), Ichor banked; buttons "Nueva mesa de
  disección" (→ `DD.game.newRun()`) and "Título".
- `escape`: "Has escapado de la torre", time left, Ichor bonus, buttons.
- `codex`: all 24 blueprints in a grid; discovered ones show sprite, name, cards;
  unknown ones show a silhouette and "???".
- `shop`: palettes with price/unlock, buy/select with Ichor; note that
  microtransactions are simulated with in-game Ichor.

## main.js — `DD.game` (Worker E)

```js
DD.game.newRun()      // DD.run = fresh state with DD.body.newBase(), palette from meta; -> dissection screen
DD.game.startRun()    // meta.runs++, DD.explore.begin(run, { onCombat: DD.game.startCombat, onEscape: DD.game.escape }); music 'explore'
DD.game.startCombat(enemyId, cell)  // DD.combat.begin(run, enemyId, { onEnd }) ; music 'combat'; on end: bank discovered into meta, DD.explore.resume(cell, won) or DD.game.die('Has muerto')
DD.game.die(reason)   // bank ichor/blueprints/stats into meta, music 'death', death screen
DD.game.escape()      // meta.escapes++, bank ichor + bonus, escape screen
```
Loop: `requestAnimationFrame`, `dt` clamped to 0.1 s; `DD.input.beginFrame()`,
`DD.screen.update(dt)`, `DD.screen.draw(DD.render.ctx)`, `DD.input.endFrame()`,
`DD.render.present()`. While a run is active (explore/combat screens):
`run.timeLeft -= dt`; `DD.audio.setIntensity(1 - timeLeft/360)`; `tick` sfx every
second under 10 s; `timeLeft <= 0` → `die('El reloj se detuvo')`; `hp <= 0` → `die(...)`.
`DD.audio.init()` on every frame where `DD.input.anyInteraction` until the
context is running. Boot: `DD.meta.load()`, `DD.render.init`, `DD.input.init`,
title screen, music 'title'.

## Deviations from the contract in the shipped code

- `DD.explore.begin()` and `DD.explore.resume(cell, true)` call `DD.setScreen(DD.explore)`
  themselves; `resume` may call `onEscape()` synchronously, so main.js sets the
  explore music before calling it. Stairs regenerate `run.floor` inside `explore.update`.
- `DD.combat.begin()` does not switch the screen; main.js calls `DD.setScreen(DD.combat)`.
  `onEnd` fires synchronously from combat's `update` or `draw` with the combat state
  already cleared.
- `DD.ui.drawBody` draws the slot/limb labels when `labels` is true even without
  `showHeat`; the `palette` option is a palette id and defaults to `DD.run.palette`.
- `DD.render.fit()` uses an integer scale only when it keeps at least 80 % of the
  available size; otherwise it scales fractionally.
- `DD.input` derives the key code from `event.key` when `event.code` is empty
  (virtual keyboards, synthesized events).
- `DD.audio.muted` is a getter/setter usable before `init()`; `music()` requested
  before the context runs is remembered; `sfx()` is dropped while suspended.
- `DD.data.enemies.maestro.elite` is `'boss'`; tower.js never places the maestro in
  random cells (`e.id !== 'maestro'` and `e.elite === true` filters).
