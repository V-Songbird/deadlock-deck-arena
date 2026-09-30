---
type: knowledge
summary: "Module layout, runtime contract (APIs, data shapes, content roster) and game rules for Deadlock Deck; read before writing or changing any file in js/ or index.html."
related_files: [index.html, js/data.js, js/art.js, js/art_body.js, js/art_enemies.js, js/audio.js, js/core.js, js/tower.js, js/explore.js, js/combat.js, js/ui.js, js/main.js]
---

# Deadlock Deck — architecture and contract

This document is the single contract between modules. Modules are written in parallel by different authors, so **follow the names, signatures and shapes here exactly**. Read `game-concept.md` for the original brief.

## 1. Stack and conventions

- Plain browser JavaScript (ES2017), HTML5 canvas, WebAudio. **No build step, no npm, no libraries, no external assets or URLs, no tests, no modules (`import`/`export`).** The game must run by opening `index.html` (also from `file://`) and from any static server.
- One global namespace: `window.DD`. Every file is `(function () { ... })();` and starts with `window.DD = window.DD || {};`, then assigns its module(s) (`DD.Data`, `DD.Art`, ...). `art_body.js` and `art_enemies.js` **extend** `DD.Art` (`Object.assign(DD.Art, {...})`).
- Modules talk to each other **at call time only** (inside functions). Never read another module's fields at load time, except `DD.Core.registerScene(...)` which scene modules call when they load (`core.js` loads before them).
- Logical resolution **384×216** (16:9), one `<canvas id="game">`. `ctx.imageSmoothingEnabled = false`. Draw with integer coordinates. Core scales the canvas to the window with CSS (`image-rendering: pixelated`).
- Identifiers, comments and file names in English. **Player-facing text in Spanish (Mexico)**, written in normal case in data; the bitmap font renders it uppercase. Accents supported by the font: `Á É Í Ó Ú Ü Ñ ¡ ¿`.
- Time is in seconds (floats). Positions and sizes are logical pixels unless a name says `tile`.
- Randomness: `DD.Core.rng(seed)` for anything that must be reproducible (tower); `Math.random()` is fine elsewhere.
- Code style: small, readable, boring. No speculative abstractions, no dead code, no `console.log` noise. Keep each file under ~900 lines.
- Each author writes **only the files they own** (section 2). If the contract is missing something, make the smallest reasonable local assumption and list it under "Contract gaps" in the final report; do not edit other files.
- Syntax-check your files with `node --check <file>` (node is on PATH). Do not try to run the game; integration happens afterwards. Temporary files go in the scratchpad directory, never in the project.

## 2. Files, owners and load order

`index.html` loads the scripts in exactly this order:

| # | File | Exports | Notes |
|---|------|---------|-------|
| 1 | `js/data.js` | `DD.Data` | all content and tuning (limbs, cards, enemies, items, skins) |
| 2 | `js/art.js` | `DD.Art` | palette, bitmap font, icons, tiles, items, traps, backgrounds, logo, fx |
| 3 | `js/art_body.js` | extends `DD.Art` | player paper-doll, player world sprite, limb icons |
| 4 | `js/art_enemies.js` | extends `DD.Art` | enemy sprites |
| 5 | `js/audio.js` | `DD.Audio` | synthesized music and SFX |
| 6 | `js/core.js` | `DD.Core` | loop, scenes, input, save, run state, shared rules |
| 7 | `js/tower.js` | `DD.Tower` | procedural tower |
| 8 | `js/explore.js` | scene `explore` | exploration |
| 9 | `js/combat.js` | scene `combat` | turn-based card combat |
| 10 | `js/ui.js` | `DD.UI` + scenes `title table graft codex cosmetics settings help end pause` | menus and shared widgets |
| 11 | `js/main.js` | — | `DD.Core.boot();` |

`index.html` (page shell, CSS, touch overlay DOM), `core.js` and `main.js` belong to the Core author. `tower.js` and `explore.js` belong to the Explore author.

## 3. Game rules (source of truth)

### 3.1 Run loop

1. Title → PLAY → `Core.newRun()` → scene `table` (dissection table) → AWAKEN → `Core.startRun()` → scene `explore`.
2. The tower has **3 floors**: floor index 0 is the top (start), 2 is the ground floor with the exit. Each floor is a labyrinth of rooms and corridors. The exit is guarded by the boss `clockmaker`; the exit only works once the boss is dead.
3. The run clock is **360 s** (`Data.CONST.RUN_SECONDS`). It runs in every scene that has `ticksClock: true` (explore, combat, graft) and stops while the `pause` overlay is open.
4. The run ends with `Core.endRun(reason)`: `'death'` (HP ≤ 0), `'timeout'` (clock ≤ 0) or `'escape'` (stepped on the exit after the boss died). Scene `end` shows the summary; REINCARNATE → `Core.newRun()` → `table` again. A new run always gets a new random base body and a **newly generated tower** (new seed). The `meta` save (discovered blueprints, essence, skins, stats) is kept.

### 3.2 Body, limbs and deck

- Slots: `head`, `torso`, `armL`, `armR`, `legL`, `legR`. Slot → type: `head→head`, `torso→torso`, `armL/armR→arm`, `legL/legR→leg`.
- Each equipped limb is a **LimbInst** (`{uid, bp, integrity, maxIntegrity, heat}`) of a blueprint (**plano anatómico**). Each blueprint carries 2 cards (torso: 3) and optional passive stats.
- **The deck is the body:** `Core.buildDeck()` = every card of every equipped limb, tagged with its slot, plus one **stump card** (`Data.STUMP_CARD[type]`) for every empty slot. A broken limb leaves an empty slot (a stump); graft a new limb of the same type to fill it.
- Player stats (`Core.getStats()`): base from `Data.CONST` plus the passives of equipped limbs: `maxHp`, `energy`, `draw` (cards per turn), `speed` (walk multiplier, base 1.0; each **empty leg slot −0.2**, minimum 0.4), `startBlock`, `coolBonus`.

### 3.3 Thermal degradation (core mechanic)

- Every card has a `heat` value (0–4). Powerful cards carry more heat and cost more.
- Each limb has `heat` (starts every combat at 0) and `heatMax` (blueprint, 4–9) and `cool` (heat removed from that limb at the end of each player turn, default 1, plus `coolBonus`).
- **Playing a card adds `card.heat` to the limb it came from** (`Core.heatLimb(slot, n)`). Heat up to `heatMax` is safe. Every point **above `heatMax` is lost as wear**: the limb's `integrity` drops by that amount and its heat stays at `heatMax` (it is now *overheated*: every further hot card wears it out). `integrity` is permanent for the run (only repairs restore it).
- When `integrity` reaches 0 the limb **breaks** (`Core.breakLimb(slot)`): the slot becomes empty, its cards leave the combat immediately (hand, draw pile, discard) and one stump card for that slot type is shuffled into the discard pile. Max HP drops if the limb had a `maxHp` passive.
- Integrity is restored only by `thread` pickups, cards with the `repair` effect and (optionally) rest props; heat resets to 0 when combat starts and ends.
- Traps and enemies can also add heat/wear (steam vents, fire, enemy `heat` moves, `burn` on the player).

### 3.4 Combat (fast, turn-based, one enemy)

- Started by touching an enemy on the map. Clock keeps running. No fleeing.
- Player: HP is persistent for the run. Energy `getStats().energy` per turn. Hand: discard the old hand, draw `getStats().draw` cards (reshuffle the discard pile into the draw pile when empty). Block resets at the start of the player's turn (then `startBlock` is applied).
- A card is playable if `cost ≤ energy`. Playing: pay energy, apply `effects` in order, add `card.heat` to its source limb, card goes to the discard pile. The end-of-turn step: cool limbs, discard hand, enemy acts, statuses tick, next turn.
- The enemy shows its next **intent** (icon + number) during the player's turn. Enemy moves are chosen by `pattern` (`'cycle'` or `'random'`) from `moves`.
- Statuses (closed set, `Data.STATUS`): `burn` (target takes `v` damage at the start of its own turn, ignores block, `v` decreases by 1; on the **player** it also adds 1 heat to a random limb), `weak` (deals 25% less damage, `v` turns), `vulnerable` (takes 50% more damage, `v` turns), `stun` (enemy skips its next action, `v` turns), `strength` (+`v` damage on every attack, permanent for the combat). Turn-based statuses decrement at the end of the owner's turn.
- Damage: `floor((base + strength) × (weak ? 0.75 : 1) × (target vulnerable ? 1.5 : 1))`, absorbed by block first. `selfdamage` and `burn` ignore block.
- Victory: enemy HP ≤ 0. The player keeps HP, limb integrity and gets `enemy.essence` essence (`run.essence`), `run.kills++`. Drops come from `Core.rollDrops(enemyId)` (harvested limbs). Defeat: `Core.endRun('death')`.

### 3.5 Exploration

- Real-time, top-down, tile map (16 px tiles), 4-direction movement with smooth pixel motion. The walk speed is `70 px/s × getStats().speed`.
- **Pickups** (consumed on contact): `elixir` (+10 HP), `thread` (+2 integrity on every equipped limb), `gear` (+12 s clock), `essence` (+5 meta essence, added to `run.essence`), `blueprint` (discovers a random undiscovered blueprint via `Core.discoverRandom()`).
- **Traps** (avoid them): `spikes` (toggle on/off on a 3 s cycle with a 0.6 s warning; 4 damage), `steam` (periodic burst with warning; 2 damage + 3 heat on a random limb). **Fire:** the tower is burning; fire tiles spawn over time on floor tiles (rate grows with `run.time`), never on stairs/exit/start; standing in fire costs 2 HP and 1 heat (random limb) per second.
- **Constant change:** every `Data.CONST.SHIFT_EVERY` seconds the labyrinth **shifts** (`Tower.shift`): some walls open and some floor tiles close, with a 1.5 s telegraph (rumble, toast, `shift` SFX). Connectivity from the player to the stairs/exit is always preserved.
- Enemies wander/patrol; one that senses the player (`sense` tiles, line of sight not required) walks toward them at `enemy.speed`. Touching one starts combat. Guards (boss) do not move.
- Stairs tile: stepping on `STAIRS_DOWN` moves to the next floor (spawn on that floor's `start`). Exit tile: if the boss is dead → `Core.endRun('escape')`; otherwise toast "LA SALIDA ESTÁ SELLADA".
- After a combat win the drops (if any) go to scene `graft`.

### 3.6 Harvest, graft, meta

- `Core.rollDrops(enemyId)` returns LimbInst[] at 60–100% integrity. Scene `graft` lists them; the player grafts one into a slot of the same type (the replaced limb is discarded) or discards it. **Every limb offered is recorded as a discovered blueprint** (`Core.discover(bp)`), shown as NEW the first time.
- **Meta save** (`localStorage`, key `deadlockdeck.meta.v1`): `blueprints` (discovered ids), `essence`, `skins` (owned), `skin` (equipped), `runs`, `escapes`, `bestTime`, `volumes`, `muted`. Essence earned in a run (`run.essence`, plus `Data.CONST.ESCAPE_BONUS` on escape) is added to `meta.essence` in `endRun`.
- **Dissection table** (scene `table`): shows the new base body (random **common** blueprints, integrity 100%). With the retained blueprints the player can **print** a discovered blueprint into a matching slot by paying essence (`Data.CONST.PRINT_COST[rarity]`, `Core.printLimb(slot, bpId)`).
- **Codex** (scene `codex`): all blueprints; undiscovered ones are silhouettes marked `???`.
- **Cosmetics cabinet** (scene `cosmetics`): skins (recolor of the body) unlocked with essence, equipped with `Core.equipSkin(id)`. A disabled "PREMIUM" tab states that microtransactions are not enabled in this build (hook for the free-to-play plan; no real payments are implemented).

## 4. Shared data shapes

```js
// LimbInst  (created by Core.makeLimb)
{ uid: 12, bp: 'arm_bone', integrity: 9, maxIntegrity: 12, heat: 0 }

// run  (Core.run, null outside a run)
{
  seed, time: 0 /* elapsed s */, timeLeft: 360, floor: 0,
  player: { hp, maxHp, block: 0, limbs: { head: LimbInst|null, torso, armL, armR, legL, legR } },
  essence: 0, kills: 0, found: [/* blueprint ids discovered this run */],
  tower: null /* set by startRun */, bossDead: false
}

// Tower
{ seed, floors: [Floor, Floor, Floor] }

// Floor  (tile coordinates are integers; tiles[y * w + x])
{
  index, name, w, h, tiles: Uint8Array,            // codes in Data.TILE
  start: {x,y}, stairsDown: {x,y}|null, stairsUp: {x,y}|null, exit: {x,y}|null,
  rooms: [{x,y,w,h}],
  entities: [
    { kind: 'enemy',  enemyId, x, y, guard?: true },
    { kind: 'pickup', item, x, y },
    { kind: 'trap',   trap: 'spikes'|'steam', x, y, phase: 0.0 /* seconds offset */ }
  ],
  fires: [ {x,y} ]          // filled at runtime by Explore
}

// Summary passed to scene 'end'
{ reason, timeUsed, floor, kills, essenceGained, bonus, newBlueprints: [ids], limbs: {slot: bpId|null} }
```

Explore adds runtime fields to its own copies of entities (`px, py, alive, taken`, ...). Those are private to Explore.

## 5. Module APIs

### 5.1 `DD.Data` (`js/data.js`)

```js
DD.Data = {
  CONST: { RUN_SECONDS: 360, FLOORS: 3, TILE: 16, BASE_HP: 20, BASE_ENERGY: 3, BASE_DRAW: 5,
           SHIFT_EVERY: 35, PRINT_COST: [0, 8, 20], ESCAPE_BONUS: 25 },
  SLOTS: ['head','torso','armL','armR','legL','legR'],
  SLOT_TYPE: { head:'head', torso:'torso', armL:'arm', armR:'arm', legL:'leg', legR:'leg' },
  SLOT_NAME: { head:'Cabeza', torso:'Torso', armL:'Brazo izq.', armR:'Brazo der.', legL:'Pierna izq.', legR:'Pierna der.' },
  TYPE_NAME: { head:'Cabeza', torso:'Torso', arm:'Brazo', leg:'Pierna' },
  TILE: { WALL:0, FLOOR:1, STAIRS_DOWN:2, STAIRS_UP:3, EXIT:4 },
  FLOOR_NAME: ['Laboratorio', 'Galería de Engranajes', 'Vestíbulo en Llamas'],
  RARITY: [ {name:'Común', color:'bone'}, {name:'Raro', color:'verdi2'}, {name:'Épico', color:'flame2'} ], // color = Art.PAL key
  STATUS: { burn:{name,icon,text}, weak:{...}, vulnerable:{...}, stun:{...}, strength:{...} },
  PASSIVE_LABEL: { maxHp:'Vida máx.', energy:'Energía', draw:'Robo', speed:'Velocidad', startBlock:'Bloqueo inicial', coolBonus:'Enfriamiento' },
  LIMBS:   { [id]: Blueprint },   // exactly the ids in section 6.1
  CARDS:   { [id]: Card },
  ENEMIES: { [id]: EnemyDef },    // exactly the ids in section 6.2
  ITEMS:   { elixir, thread, gear, essence, blueprint },   // {name, text, icon}
  TRAPS:   { spikes, steam },                              // {name, text}
  SKINS:   { [id]: { name, cost, colors: { skin, skinDark, stitch, eye } } },  // ids in section 6.4
  STUMP_CARD: { head:'stump_head', torso:'stump_torso', arm:'stump_arm', leg:'stump_leg' },

  limbsOfType(type),         // -> Blueprint[]
  commonLimbs(type),         // -> Blueprint[] with rarity 0
  cardsOfLimb(bpId),         // -> Card[]
  describePassive(bp),       // -> string like "+10 Vida máx., +1 Robo" ('' if none)
  cardText(card),            // -> Spanish rules text generated from card.effects (also stored in card.text at load)
  describeMove(move)         // -> short Spanish text for an enemy move, e.g. "Ataca 6"
};
```

**Blueprint**: `{ id, type:'head'|'torso'|'arm'|'leg', name, origin, rarity:0|1|2, style, accent, integrity, heatMax, cool, cards:[cardId, ...], passive:{maxHp?, energy?, draw?, speed?, startBlock?, coolBonus?}, desc }`.
`style` ∈ `flesh | beast | bone | stone | brass | chem` (drives the sprite look); `accent` is a `#rrggbb` accent color. `integrity` 8–16, `heatMax` 4–9, `cool` usually 1 (2 for cooling-themed limbs). Heads/torsos carry the energy/draw/maxHp passives; legs carry `speed`; keep passives small and each limb's identity clear (glass-cannon limbs have high-heat strong cards and low `heatMax`; sturdy limbs the opposite).

**Card**: `{ id, name, cost:0..3, heat:0..4, icon, effects:[...], text }` — `icon` is one of the names in section 6.5. Every card has a **unique id**, belongs to exactly one limb, and its `heat` reflects power (cost 0–1 cards: heat 0–1; cost 2: heat 1–3; cost 3: heat 3–4). Effects (closed set, combat implements exactly these):

| `k` | fields | meaning |
|-----|--------|---------|
| `damage` | `v`, `hits` (default 1) | damage to the enemy, `hits` times |
| `block` | `v` | player block |
| `heal` | `v` | player HP |
| `draw` | `v` | draw cards now |
| `energy` | `v` | gain energy now |
| `status` | `status`, `v`, `target:'enemy'|'self'` | apply a status |
| `cool` | `v`, `scope:'self'|'all'` | remove heat from the source limb / every limb |
| `repair` | `v`, `scope:'self'|'all'` | restore integrity on the source limb / every limb |
| `selfdamage` | `v` | player loses HP, ignores block |

Stump cards (`stump_head`, `stump_torso`, `stump_arm`, `stump_leg`): cost 1, heat 0, deliberately weak (e.g. arm: 3 damage; leg: 3 block; head: 2 damage; torso: 2 block).

**EnemyDef**: `{ id, name, kind:'monster'|'scientist'|'elite'|'boss', hp, floors:[minFloor, maxFloor], weight, speed /*px/s on the map*/, sense /*tiles*/, pattern:'cycle'|'random', moves:[Move,...], drops:[{limb:bpId, chance:0..1}], essence, flavor }`.
**Move**: `{ name, intent:'attack'|'defend'|'buff'|'debuff'|'heat', dmg?, hits?, block?, status?:{status, v, target:'player'|'self'}, heat? }` — any combination of `dmg`/`block`/`status`/`heat` may be present; `intent` only selects the icon. Regular enemies: hp 12–40, damage 3–9 per hit; elites hp 45–60; boss hp 90–110. Drops: each enemy drops the limbs listed in section 6.2 with chance 0.5–1.0 (boss: 1.0).

### 5.2 `DD.Core` (`js/core.js`)

```js
DD.Core = {
  W: 384, H: 216, canvas, ctx,
  boot(),                               // create canvas/ctx, input, audio unlock, load meta, scene 'title', start loop
  registerScene(name, scene),
  go(name, params),                     // clear the stack, exit old scenes, enter `name`
  push(name, params),                   // overlay/child scene on top (only the top updates; all draw bottom→top)
  pop(),                                // exit top, then call below.resume() if defined
  sceneName(),                          // name of the top scene

  input: { held(a), pressed(a), repeat(a) },   // actions: 'up','down','left','right','confirm','cancel','menu'
  pointer: { x, y, down, pressed, released },  // logical coords; pressed/released are true for one frame

  meta,                                 // persisted object (section 3.6); never null after boot
  saveMeta(),
  discover(bpId),                       // -> true if newly discovered (saves)
  discoverRandom(),                     // discovers a random undiscovered blueprint -> bpId|null
  spendEssence(n),                      // -> true if paid (saves)
  equipSkin(id),                        // equips an owned skin; buySkin(id) -> bool

  run,                                  // current run or null
  newRun(),                             // builds run with a random common base body; does NOT start the tower
  startRun(),                           // Tower.generate(run.seed), go('explore', {floor:0})
  endRun(reason),                       // 'death'|'timeout'|'escape' -> updates meta, go('end', summary)

  rng(seed),                            // -> { next(), int(a,b) /*inclusive*/, pick(arr), chance(p), shuffle(arr) /*in place*/ }
  makeLimb(bpId, frac /*integrity fraction, default 1*/),  // -> LimbInst
  rollBaseBody(),                       // -> limbs object of LimbInst, random common blueprint per slot
  rollDrops(enemyId),                   // -> LimbInst[]
  printLimb(slot, bpId),                // table: pay PRINT_COST[rarity] essence, replace slot -> bool
  graft(slot, limbInst),                // replace slot, recalc stats; returns the replaced LimbInst|null
  getStats(),                           // { maxHp, energy, draw, speed, startBlock, coolBonus }
  buildDeck(),                          // -> [{ card: cardId, slot }]

  damagePlayer(n, ignoreBlock),         // applies block first unless ignoreBlock; returns actual HP lost; triggers endRun('death') at 0
  healPlayer(n),
  addTime(sec),                         // run.timeLeft += sec
  heatLimb(slot, n),                    // thermal rule 3.3 -> { overheated, wear, broken }; plays 'overheat'/'limb_break' SFX, toasts
  wearLimb(slot, n),                    // integrity -= n, breaks at 0 -> bool broken
  breakLimb(slot),                      // empties slot, recalcs stats, returns old LimbInst
  coolLimbs(amount, slot),              // slot omitted = all limbs; Infinity = full reset
  repairLimbs(amount, slot),            // slot omitted = all limbs
  randomLimbSlot(),                     // random slot that currently holds a limb, or null

  fmtTime(sec),                         // "M:SS" (rounds up, never negative)
  toast(text, colorKey),                // floating message near the top, ~2 s, drawn above everything
  shake(mag, secs)                      // screen shake
};
```

Core loop rules: `dt` clamped to 0.05. Each frame: poll input/gamepad, `update(dt)` of the top scene, then — if a run exists and the top scene has `ticksClock` — `run.time += dt; run.timeLeft -= dt`, `Audio.setTension(run.time / 360)`, `Audio.sfx('bell')` on every whole-minute crossing, `endRun('timeout')` at 0. `menu` pressed on a `ticksClock` scene pushes scene `pause`. Then draw the stack, toasts and shake. Keyboard: arrows/WASD move, Enter/Space/Z confirm, Esc/P menu, X/Backspace cancel, `M` mute, `F` fullscreen; gamepad (standard mapping): d-pad/left stick, A confirm, B cancel, Start menu; touch: an on-screen d-pad (only while the top scene has `touchPad: true`) and a pause button (while `ticksClock`), plus plain taps via `pointer`. Audio is unlocked on the first user gesture (`DD.Audio.init()`).

**Scene object**: `{ ticksClock?: bool, touchPad?: bool, enter(params), exit(), update(dt), draw(ctx), resume?() }`. Scenes read `DD.Core.input` / `DD.Core.pointer` inside `update`.

### 5.3 `DD.Tower` (`js/tower.js`)

```js
DD.Tower = {
  generate(seed),             // -> Tower; 3 floors, each ~40×26 tiles, deterministic for a seed
  shift(floor, rng, playerTile)  // mutate floor.tiles: open/close some walls; returns [{x,y,to}] (tile codes). Never touches stairs/exit/start,
                                 // tiles with entities, or tiles within 3 tiles of playerTile; always keeps playerTile connected to stairsDown/exit.
};
```

Generation requirements: rooms joined by winding corridors with some loops (so `shift` has alternatives); border is wall; `start` in a room; `stairsDown` far from `start`; floors 1 and 2 also have `stairsUp` (= the spawn of that floor, equal to its `start`); floor 2 has `exit` far from `start`, with one `guard` entity `clockmaker` next to it. Entities per floor: 4–7 enemies chosen from `Data.ENEMIES` by `floors` range and `weight` (at most 1 elite on floors 1–2, none on floor 0), 6–8 pickups (mix of all five items, `essence` and `elixir` most common), 6–10 traps (`spikes`/`steam`, placed in corridors and rooms, never within 4 tiles of `start`, stairs or exit). Every entity on a floor tile reachable from `start`.

### 5.4 Scene `explore` (`js/explore.js`)

`enter({ floor })` loads `run.tower.floors[floor]`, sets `run.floor`, places the player on `start`; `ticksClock: true`, `touchPad: true`. Uses `DD.UI.drawHud(ctx, { limbs: true })`, draws a small minimap (fog of war, 2 px per tile) at the right under the HUD's top-right text, keeps the camera centered on the player (clamped to the map). Starts combat with `Core.push('combat', { enemyId, onDone(result) })` where `result = { won:true, enemyId, drops:[LimbInst], essence }`. On a win: remove the enemy (boss: `run.bossDead = true`), then if `drops.length` → `Core.push('graft', { offers: drops, onDone })`. `resume()` restores music (`Audio.music('explore')`). Uses `Core.damagePlayer`, `Core.heatLimb`, `Core.healPlayer`, `Core.repairLimbs`, `Core.addTime`, `Core.discoverRandom`, `Core.toast`, `Core.shake`, `Core.endRun('escape')`.

### 5.5 Scene `combat` (`js/combat.js`)

`Core.push('combat', { enemyId, onDone })`; `ticksClock: true`. Layout suggestion: enemy sprite (`Art.enemySprite(id,'big')`, drawn at ×2 or ×3) top-center with name, HP bar, statuses and **intent**; the player paper-doll (`Art.drawBody`) left with per-limb gauges (`UI.drawLimbGauge`) using `Art.bodySlotAnchors`; energy, draw/discard counts, the hand of cards (`UI.drawCard`) along the bottom and a FIN DE TURNO button. Selection is one row: cards left→right and then END TURN (`left/right` move, `confirm` plays/ends); pointer: tap a card to play it, tap the button to end the turn. Floating damage numbers, hit flashes (`Art.silhouetteOf`), overheat feedback and limb-break feedback are required because the thermal rule is the core mechanic. Music: `'combat'`, or `'boss'` if `kind==='boss'`. On victory: short "COSECHA" banner (~0.8 s), `Core.pop()`, then `onDone(result)`. On defeat: `Core.endRun('death')` (do not call `onDone`). Calls `Core.buildDeck/getStats/heatLimb/coolLimbs/repairLimbs/healPlayer/damagePlayer/rollDrops/breakLimb`, `Audio.sfx(...)`. At the start and end of combat: `Core.coolLimbs(Infinity)` and `run.player.block = 0`.

### 5.6 `DD.UI` (`js/ui.js`)

Shared widgets (all draw at logical coordinates):

```js
DD.UI = {
  drawPanel(ctx, x, y, w, h, title),                      // gothic brass-framed panel, optional title strip
  drawButton(ctx, label, x, y, w, h, state),              // state: { selected, disabled, pressed }
  drawBar(ctx, x, y, w, h, frac, colorKey),               // colorKey = Art.PAL key
  drawCard(ctx, card, x, y, w, h, opts),                  // opts: { selected, disabled, limbHeat, limbHeatMax, slot, hot }; min size 56×64
  drawLimbGauge(ctx, slot, limbInst, x, y, w, h),         // limb icon (or stump icon when null) + integrity bar + heat bar; w ≥ 40, h default 18
  drawHud(ctx, opts)   // opts: { clock, hp, limbs, essence, floor } (all default true)
                       //   HP bar top-left (4,4,100 wide) · clock top-center (M:SS, red + blinking under 60 s) ·
                       //   essence + floor name right-aligned at x=380, y=4.. · limb gauges bottom-left row starting (4, 194)
};
```

Scenes registered by `ui.js` and their params:

| scene | params | behavior |
|-------|--------|----------|
| `title` | — | logo, menu: JUGAR (`Core.newRun(); go('table')`), PLANOS (`codex`), GABINETE (`cosmetics`), AJUSTES (`settings`), CÓMO JUGAR (`help`); music `'title'` |
| `table` | — | dissection table: show the body, per-limb stats and cards; print discovered blueprints into slots (`Core.printLimb`); DESPERTAR → `Core.startRun()`; music `'table'` |
| `graft` | `{ offers: LimbInst[], onDone() }` | `ticksClock: true`; shows each offer (name, origin, stats, cards, NEW tag, what it would replace); graft into a matching slot (`Core.graft`) or discard; may graft several offers; finishing → `Core.pop(); onDone && onDone()` |
| `codex` | — | browse all blueprints by type; discovered show full info, others are silhouettes `???`; shows count discovered/total |
| `cosmetics` | — | skins list with cost, preview on the body, buy/equip; disabled PREMIUM tab note |
| `settings` | — | master/music/SFX volume, mute; persist in `meta.volumes`/`meta.muted`; apply with `Audio.setVolumes` / `Audio.mute` |
| `help` | — | short pages: goal, controls (keyboard / gamepad / touch), combat, thermal rule, time |
| `end` | `summary` (section 4) | title by reason (`death`: "HAS MUERTO", `timeout`: "SE ACABÓ EL TIEMPO", `escape`: "¡ESCAPASTE!"), stats, discovered blueprints, essence gained; REENCARNAR → `Core.newRun(); Core.go('table')`; MENÚ → `title`; music `'death'`/`'win'` |
| `pause` | — | overlay pushed by Core: CONTINUAR (`Core.pop()`), AJUSTES (volumes inline or scene push), ABANDONAR CICLO (`Core.endRun('death')`) |

All menus work with keyboard/gamepad (`up/down/left/right`, `confirm`, `cancel`) **and** pointer taps (hit-test the drawn rectangles).

### 5.7 `DD.Art` (`js/art.js`, `js/art_body.js`, `js/art_enemies.js`)

`js/art.js` defines:

```js
DD.Art = {
  W: 384, H: 216, TILE: 16,
  PAL: { ink:'#0d0a12', night:'#1a1424', stone:'#2b2236', stone2:'#3d3149', mist:'#5b4d6b', bone:'#e8dcc0', parch:'#c9b98f',
         brass:'#b8892e', brass2:'#e0b84a', copper:'#a4532c', blood:'#8c1c2b', blood2:'#c8323f', flame:'#f07a1e', flame2:'#ffc23a',
         verdi:'#2f7d6d', verdi2:'#58c2a0', acid:'#9be04a', flesh:'#b07a6a', flesh2:'#7d4f52', ice:'#7fb8d6' },

  // bitmap font 5×7 (+1 px spacing), uppercase only (lowercase is mapped to uppercase), accents supported
  text(ctx, str, x, y, color /*hex or PAL key*/, scale, align /*'left'|'center'|'right'*/, shadow /*hex|PAL key|null*/),
  textWidth(str, scale),
  wrap(str, maxWidth, scale),            // -> string[] (lines)

  ICONS: [...names in 6.5...],
  icon(ctx, name, x, y, scale),          // 8×8 icon drawn at scale (default 1)

  tile(ctx, code, px, py, seed, t),      // 16×16 tile for Data.TILE codes; `seed` = tile x*131+y*17 for variation; t = time for animated bits
  item(ctx, itemId, x, y, t),            // 16×16 pickup with a small bobbing/glow animation
  trap(ctx, trapId, x, y, state, t),     // state: 'idle'|'warn'|'active'
  fire(ctx, x, y, t),                    // animated fire tile overlay

  drawBackground(ctx, name, t, opts),    // 'title','table','combat','codex','end_death','end_timeout','end_win'; opts.floor 0..2 tints 'combat'
  drawLogo(ctx, cx, y, t),               // "DEADLOCK DECK" + "EL RELOJ ANATÓMICO" with a gear motif
  embers(ctx, t),                        // drifting ember particles overlay (cheap)
  vignette(ctx),                         // dark edge vignette
  silhouetteOf(canvas, color)            // cached solid-color silhouette (hit flash / undiscovered); returns canvas
};
```

`js/art_body.js` adds:

```js
  drawBody(ctx, cx, bottomY, limbs, opts),   // paper-doll abomination 32×48 at scale 1, facing right. limbs = run.player.limbs (null slot → stump).
                                             // opts: { scale:1, flip:false, t:0, hurt:0..1, skin: skinId (default Core.meta.skin), highlight: slot|null }
  bodySlotAnchors(cx, bottomY, scale),       // -> { head:{x,y,w,h}, torso, armL, armR, legL, legR } rectangles (logical px)
  drawPlayerWorld(ctx, x, y, dir, step, limbs), // 16×16 overworld sprite, dir 0..3 = down,left,right,up, step = walk animation phase (float)
  limbIcon(ctx, bpId, x, y, scale),          // 16×16 icon of a blueprint (look from bp.style + bp.accent + type)
  stumpIcon(ctx, type, x, y, scale),         // 16×16 icon of an empty slot (stump)
  silhouetteIcon(ctx, type, x, y, scale)     // 16×16 dark silhouette for undiscovered blueprints
```

`js/art_enemies.js` adds:

```js
  enemySprite(enemyId, size)                 // size 'big' → 32×32 canvas (combat), 'small' → 16×16 canvas (map); cached
```

The body is drawn by slot type × `bp.style` (6 styles, with `bp.accent` as a detail color) and recolored with `Data.SKINS[skin].colors` (`skin`, `skinDark`, `stitch`, `eye`) for flesh parts. Stumps are short bandaged ends. All sprites are authored as pixel-art string grids (or small generators) inside the files — no image files.

### 5.8 `DD.Audio` (`js/audio.js`)

```js
DD.Audio = {
  init(),                          // create/resume the AudioContext (called on first user gesture); safe to call repeatedly
  sfx(name, opts),                 // opts: { vol, pitch } optional; unknown names are ignored silently
  music(mode),                     // 'none'|'title'|'table'|'explore'|'combat'|'boss'|'death'|'win'; crossfades; same mode again = no restart
  setTension(t),                   // 0..1 (elapsed/360): faster clock ticks, louder heartbeat/dissonance near 1, only in explore/combat/boss
  setVolumes({ master, music, sfx }), getVolumes(),   // 0..1
  mute(flag), isMuted()
};
```

Music is fully synthesized and procedural (no samples): dark drones, slow minor arpeggios, a ticking clock, brass-like detuned saws, occasional bell tolls; combat is more rhythmic and aggressive; boss adds low pulsing; `death` and `win` are short stingers/loops. Keep the CPU light (a scheduler with look-ahead, few oscillators).

**SFX names** (all must exist; flesh/bone/steam/clockwork themed, guttural): UI `click confirm back error` · explore `step pickup elixir gear essence blueprint stairs shift spikes steam fire_hit door` · combat `card draw hit hit_big block heal burn buff debuff enemy_attack enemy_die player_hurt turn_end overheat limb_break graft harvest growl` · clock `tick tock bell heartbeat` · endings `death win timeout`.

## 6. Content roster (fixed ids)

### 6.1 Blueprints (33)

Rarity 0 = common (base body pool), 1 = rare, 2 = epic. Styles in parentheses.

- **heads (9):** `head_stitched` (R0, flesh) · `head_rat` (R0, beast) · `head_ghoul` (R0, flesh) · `head_hound` (R1, beast) · `head_homunculus` (R1, chem) · `head_alchemist` (R1, chem) · `head_inquisitor` (R2, brass) · `head_chimera` (R2, beast) · `head_clockmaker` (R2, brass)
- **torsos (7):** `torso_stitched` (R0, flesh) · `torso_ghoul` (R0, flesh) · `torso_bone` (R1, bone) · `torso_gargoyle` (R1, stone) · `torso_boiler` (R1, brass) · `torso_chimera` (R2, beast) · `torso_clockwork` (R2, brass)
- **arms (10):** `arm_stitched` (R0, flesh) · `arm_ghoul` (R0, flesh) · `arm_bone` (R1, bone) · `arm_gargoyle` (R1, stone) · `arm_alchemist` (R1, chem) · `arm_surgeon` (R1, chem) · `arm_piston` (R1, brass) · `arm_clockwork` (R1, brass) · `arm_chimera` (R2, beast) · `arm_inquisitor` (R2, brass)
- **legs (7):** `leg_stitched` (R0, flesh) · `leg_rat` (R0, beast) · `leg_ghoul` (R0, flesh) · `leg_hound` (R1, beast) · `leg_spider` (R1, brass) · `leg_steam` (R1, brass) · `leg_clockwork` (R2, brass)

Design hints: stitched = balanced and boring; ghoul = poison-like `burn`/vulnerable and self-damage; rat = cheap fast cards, low integrity; hound = draw/speed; bone = block and durability; gargoyle = heavy block, slow cards, high `heatMax`; alchemist = burn, heat-heavy fire cards, `cool` tricks; surgeon = `repair`, precise damage, `selfdamage`; piston/steam/boiler = big hot hits, energy, high heat; clockwork = energy/draw/stun, cooling; inquisitor = weak/vulnerable + strong attacks; chimera = best raw damage but very hot; homunculus = draw + cheap utility. Each limb should make a build choice interesting (trade-off between power and heat).

### 6.2 Enemies (13) and what they drop

| id | name | kind | floors | drops (blueprints) |
|----|------|------|--------|--------------------|
| `rat_swarm` | Enjambre de Ratas | monster | 0–2 | `head_rat`, `leg_rat` |
| `ghoul` | Necrófago | monster | 0–2 | `head_ghoul`, `arm_ghoul`, `torso_ghoul`, `leg_ghoul` |
| `flesh_hound` | Sabueso de Carne | monster | 0–2 | `head_hound`, `leg_hound` |
| `homunculus` | Homúnculo | monster | 0–1 | `head_homunculus` |
| `clockwork_spider` | Araña de Relojería | monster | 1–2 | `leg_spider`, `arm_clockwork` |
| `bone_golem` | Gólem de Huesos | monster | 1–2 | `torso_bone`, `arm_bone` |
| `gargoyle` | Gárgola de Hollín | monster | 1–2 | `torso_gargoyle`, `arm_gargoyle` |
| `alchemist` | Alquimista Corrupto | scientist | 0–2 | `head_alchemist`, `arm_alchemist` |
| `surgeon` | Cirujano Desquiciado | scientist | 0–2 | `arm_surgeon`, `head_stitched`, `torso_stitched` |
| `engineer` | Ingeniero de Vapor | scientist | 1–2 | `leg_steam`, `arm_piston`, `torso_boiler` |
| `chimera` | Quimera Abrasada | elite | 1–2 | `head_chimera`, `torso_chimera`, `arm_chimera` |
| `inquisitor` | Inquisidor Rojo | elite | 1–2 | `head_inquisitor`, `arm_inquisitor` |
| `clockmaker` | El Relojero Mayor | boss | 2 (guard at exit) | `head_clockmaker`, `torso_clockwork`, `leg_clockwork`, `arm_clockwork` |

Every blueprint id in 6.1 must be dropped by at least one enemy (`arm_stitched`, `leg_stitched` are base-body only and may also drop from `surgeon`/`ghoul` — the author decides).

### 6.3 Items and traps

Items: `elixir` Elixir Vital, `thread` Hilo de Sutura, `gear` Engranaje Temporal, `essence` Esencia, `blueprint` Plano Anatómico. Traps: `spikes` Púas, `steam` Vapor. Fire is not an entity kind; it is a runtime tile overlay (`Art.fire`).

### 6.4 Skins

`classic` (free, default), `verdigris`, `ash`, `brass`, `crimson`. Each has `colors` with the four keys `skin`, `skinDark`, `stitch`, `eye` and a `cost` in essence (classic 0, others 15–40).

### 6.5 Icon names (`Art.ICONS`)

`sword shield flame heart bolt gear skull snow wrench hourglass essence scroll cards weak vulnerable stun strength arrow lock check star broken boot eye brain fist bone drop`

Mapping used across modules: statuses → icons `burn→flame`, `weak→weak`, `vulnerable→vulnerable`, `stun→stun`, `strength→strength`; enemy intents → `attack→sword`, `defend→shield`, `buff→strength`, `debuff→weak`, `heat→flame`; card effects pick their `icon` from this list (attack cards `sword`/`fist`/`bone`, defense `shield`, heal `heart`, cooling `snow`, repair `wrench`, draw `cards`/`brain`, energy `bolt`, time/stun `hourglass`/`stun`, fire `flame`).

## 7. As-built notes (where the code refines or differs from sections 1–6)

- **Meta shapes:** `meta.blueprints` is an array of ids; `meta.skins` is a map `{ [skinId]: true }`. `Core.lastRun` keeps the finished run (`Core.run` is `null` after `endRun`). `summary.essenceGained` is `run.essence` without the escape `bonus`; the total is the sum. `bestTime` is the fastest escape (0 if none). `run.found` excludes the starting body. `Core.buySkin` on an owned skin returns true; `Core.healPlayer` returns the amount healed; rule functions are no-ops while `run` is `null`. Overheated means `heat >= heatMax`.
- **Touch overlay:** the d-pad and pause button are DOM elements fixed to the window corners (safe-area aware), shown only after a touch / `pointer: coarse`, hidden again on keyboard or gamepad use. The canvas scale is computed in JS.
- **Data:** leg `speed` passives add to the base 1.0 (0.15 = +15%). The boss has `weight 0`, `speed 0`, `sense 0` and is placed only by the tower generator. `stun` is only ever applied to enemies. Card names and card text words are at most 8 characters so they fit the 56 px combat cards.
- **Art:** `Art.ICONS` has 28 names (the list in 6.5). `drawBackground('title')` already draws embers. Characters with no glyph render as `?`. `enemySprite(id, 'small')` returns 16×16; any other size value returns 32×32. `bodySlotAnchors` accepts an optional 4th argument `limbs` (defaults to the run's limbs) so anchors follow the legless stance; `drawBody` and `limbIcon` also accept a blueprint id where a LimbInst is expected.
- **Audio:** `mute()` without arguments toggles. The clock tick/tock and heartbeat run on the music bus. `clank` is an extra internal SFX.
- **Tower/Explore:** extra export `Tower.distances(floor, x, y, out)` (BFS used to steer chasers). Movement may be diagonal with sliding. Fire also spreads from existing fires; floors 1 and 2 start with some. Steam cycles every 4 s (`phase` 0–3 s). A shift changes 4–14 tiles and never touches fire tiles. Every `resume()` restarts the 2 s enemy grace.
- **Combat:** hand capped at 10 cards; no key-hint line (no room). Enemy block resets when the enemy's turn starts.
- **UI:** `pause` opens `settings` with `Core.push`; `title` opens codex/cosmetics/settings/help with `push`/`pop`; `graft` closes itself once every offer is handled.
- **Balance (random-input bot, indicative only):** with the starting body, regular enemies are beaten (elites and the boss are not); with a mid-tier body (rare limbs) the boss is not; with an all-epic body the boss falls about two thirds of the time.
