# Deadlock Deck: El Reloj Anatómico — Design and Module Spec

This file is the contract between all modules. Every worker reads it fully before writing code and implements the interfaces exactly as written. If something is not specified, choose the simplest thing that works and leave a one-line comment.

Single-page browser game: vanilla JavaScript (ES2020), HTML5 Canvas 2D, Web Audio API. No dependencies, no build step, no tests, no modules/imports. Runs from `file://` or any static server. Desktop (keyboard + mouse) and mobile (touch). All player-facing text is in Spanish with correct accents (UTF-8). Code, identifiers and comments are in English.

## 1. Concept coverage (every point below must exist in the game)

| Concept point | Implementation |
|---|---|
| Recently reanimated abomination in a collapsing alchemical lab | Title + dissection table screen ("Mesa de disección"); gothic-alchemical palette |
| Exactly 6 minutes to escape the burning tower | Real-time clock `Data.CONFIG.startTime = 360` s, always visible on run screens; fire overlay grows as time runs out |
| Ever-changing maze | `Tower.mutate` re-carves the current floor every `Data.CONFIG.mutateEvery` seconds ("El laboratorio se reconfigura") |
| Monstrosities and corrupt scientists | Enemy families with `kind: 'monstruosidad'` or `'cientifico'` |
| Collect body parts of fallen enemies and graft them | Harvest screen after each won combat ("Cosecha") |
| Anatomical deck-building: the deck is the body (head, torso, 2 arms, 2 legs) | Deck = union of the cards of the 6 slots; each blueprint (limb) has its own cards |
| Thermal degradation: strong cards overheat and wear limbs; broken limb = lose its cards, fight with a stump | Per-limb `heat`/`maxHeat`/`cool`; on break the slot becomes `null` (stump) and its cards vanish; a stump only gives the card "Muñonazo" |
| Death loop / 6-minute reset: die or time out → new dissection table, new base body; keep discovered blueprints; tower regenerates procedurally | `Game` death state → table with `Data.newBaseBody`, new seed; `meta.blueprints` persisted in localStorage |
| Explore procedural corridors, collect resources, avoid traps | `Tower.generate` (rooms + corridors), resources and visible traps as entities, fog of war |
| Fast turn-based combat with limb-based cards | `Combat` module, small numbers, 5-card hand, 3 energy |
| Harvest enemy limbs to improve the deck | 2 offers per win, graft into matching slot |
| Escape: reach the exit before the clock hits 6 minutes | 3 floors, exit on the last floor guarded by the Quimera; victory screen |
| Gothic-alchemical pixel art | All graphics are hand-defined pixel sprites drawn with nearest-neighbour scaling |
| Ominous synthesized soundtrack + guttural SFX | `Sound` module, 100% Web Audio synthesis, urgency rises with the clock |
| PC, consoles, mobile | Keyboard/mouse + touch (swipe, tap) in one build; gamepad is out of scope |
| Free-to-play with cosmetics and content unlocks | Mock shop screen ("Tienda") using in-game currency "Icor"; clearly labelled demo, no real payments |
| Blueprint codex | "Planos" screen listing all blueprints, discovered vs. unknown |

## 2. Files, load order, globals

`index.html` loads, in this order, classic `<script>` tags:

| File | Global | Owner |
|---|---|---|
| `js/core.js` | `Core` | P1 |
| `js/sprites.js` | `Sprites` | P2 |
| `js/data.js` | `Data` | P3 |
| `js/sound.js` | `Sound` | P4 |
| `js/tower.js` | `Tower` | P5 |
| `js/combat.js` | `Combat` | P6 |
| `js/game.js` | `Game` (calls `Game.init()` at the end of the file) | P7 |

Each file defines exactly one global with `window.Name = (function () { ... return api; })();`. A module may only call globals loaded before it, except: `Core.init` may call `Sound.unlock()` if `window.Sound` exists (checked at call time), and `Core` draws toasts/shake itself.

`index.html` (owner P1): `<meta charset="utf-8">`, viewport `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`, `<title>Deadlock Deck: El Reloj Anatómico</title>`, Google Fonts link for `Press Start 2P` (fallback monospace — the game must still work offline), `<canvas id="game" width="480" height="270">`, `style.css`, scripts in the order above. `style.css`: black background, canvas centered with `image-rendering: pixelated`, `touch-action: none`, `user-select: none`, no scrollbars.

## 3. Shared conventions

- Logical resolution: `Core.W = 480`, `Core.H = 270`. The canvas backing store is exactly 480×270; CSS scales it (integer scale when ≥ 2, otherwise fractional to fit so phones fill the screen) and centers it on black. All coordinates in the game are logical.
- Font: `"Press Start 2P", monospace`. Only two sizes: 8 (all text) and 16 (titles).
- Slot keys (player body): `head, torso, armL, armR, legL, legR`. Slot types (blueprints): `head, torso, arm, leg`. `Data.slotType('armL') === 'arm'`.
- Limb instance (what the player carries in a slot): `{ id: <blueprint id>, heat: <number> }` or `null` (stump).
- Player object (owned by `Game`, mutated in place by `Combat`):
  ```js
  player = {
    hp, maxHp,
    limbs: { head, torso, armL, armR, legL, legR },  // limb instances or null
    block: 0, poison: 0,     // combat-only, reset by Combat.start
    ichor: 0                 // collected during this run
  }
  ```
- Family map for drawing a body: `fams = { head, torso, armL, armR, legL, legR }`, each a family id string or `null` (stump). `Game` derives it from `Data.LIMBS[limb.id].family`.
- RNG: `Core.rng(seed)` returns a function `() => number in [0,1)` (mulberry32). All procedural generation takes an `rnd` function argument, never `Math.random`.
- Colors: always `Core.PAL.*` (section 5.1). Sprites embed hex colors but must use the exact hex strings from `Core.PAL` where a named color exists (skin, stitch, brass, etc.).
- Time: `Core.init` calls `update(dt)` with `dt` in seconds (clamped to 0.1) and then `draw(ctx)`, every animation frame.

## 4. Content catalog (fixed IDs)

### 4.1 Families

| id | Name (ES) | kind | Look and archetype |
|---|---|---|---|
| `base` | Cuerpo base | `base` | Grey-green cadaver flesh, visible sutures. Weak generic cards |
| `homunculo` | Homúnculo | `monstruosidad` | Small pinkish thing with big eyes and claws. Cheap frantic cards, multi-hits, draw; low maxHeat, fast cooling |
| `ghoul` | Ghoul de laboratorio | `monstruosidad` | Bulky purple-grey rotten brute, chains. Heavy damage, high heat, slow cooling, regeneration |
| `alquimista` | Alquimista corrupto | `cientifico` | Pale scientist, stained coat, goggles, glowing green vials. Heat manipulation, poison, cooling |
| `automata` | Autómata de latón | `monstruosidad` | Brass/copper clockwork body with gears and steam. Very high maxHeat, strong block, slow cooling, overcharge |
| `cirujano` | Cirujano hereje | `cientifico` | Blood-stained surgeon, mask, scalpel arm. Precise damage, healing, draw/energy |
| `quimera` | Quimera | `monstruosidad` | Exit guardian: mixed beast (fangs, wing stubs, mismatched limbs), red/bone. Strongest cards in every slot |

### 4.2 Blueprints (limbs)

Ids are `<family>_<slotType>`: `homunculo_head, homunculo_torso, homunculo_arm, homunculo_leg`, same for `ghoul, alquimista, automata, cirujano, quimera` (24). The base family has two variants per slot: `base_head_a, base_head_b, base_torso_a, base_torso_b, base_arm_a, base_arm_b, base_leg_a, base_leg_b` (8). Total 32. Arm blueprints fit either arm slot; leg blueprints fit either leg slot. Base variants share the base sprite.

### 4.3 Enemies

Enemy ids equal family ids (no `base`): `homunculo, alquimista, ghoul, automata, cirujano, quimera`. `quimera` is only placed as the exit guardian on the last floor.

### 4.4 Resources, traps, cosmetics, packs

- Resources: `coolant` (Vial de refrigerante: −6 heat on every limb), `suture` (Suturas: +12 HP, capped at maxHp), `clockwork` (Engranaje de reloj: +20 s on the clock), `ichor` (Icor: +8 ichor).
- Traps (visible on the map): `spikes` (Púas: −6 HP, unblockable), `acid` (Ácido alquímico: +5 heat to a random non-stump limb, may break it).
- Cosmetics (tints, see 5.2): `skin_default` (Piel cadavérica, 0 Icor), `skin_brass` (Suturas de latón, 20), `skin_ichor` (Suturas de icor, 20), `skin_crimson` (Carne carmesí, 35).
- Content pack: `pack_quimera` (Planos de la Quimera, 60 Icor) adds the 4 `quimera_*` blueprints to `meta.blueprints`.

### 4.5 Tiles, icons, tokens, SFX names

- Tiles (16×16, `Sprites.tiles`): `floor, floor2, floor3, wall, exit, stairs, chest, coolant, suture, clockwork, ichor, spikes, acid, fire0, fire1, table, alembic, shelf`.
- Icons (8×8, `Sprites.icons`): `heart, bolt, flame, clock, skull, card, ichor, lock, sound, mute, check, cross, arrowU, arrowD, arrowL, arrowR`.
- Map tokens (16×16, `Sprites.tokens`): `player, homunculo, ghoul, alquimista, automata, cirujano, quimera`.
- SFX names (`Sound.sfx`): `click, card, hit, block, growl, graft, break, overheat, step, pickup, trap, tick, alarm, shift, death, victory, heal, poison, flee, unlock`.

## 5. Module APIs

### 5.1 Core (`js/core.js`)

```js
Core.W = 480; Core.H = 270;
Core.PAL = {
  ink: '#080508', bg: '#0b0710', panel: '#160e1f', wall: '#2a1b3d', wallLit: '#3d2a55',
  floor: '#1a1226', floor2: '#1f1630', brass: '#b08d57', copper: '#8c4a2f', blood: '#7a1f2b',
  bone: '#e8dcc8', text: '#e8dcc8', dim: '#8a7f8f', sick: '#6fbf3f', poison: '#9c4dcc',
  fire1: '#ff9a2a', fire2: '#ff3b1f', fire3: '#ffd25a', heat: '#ff5a36', hp: '#c0392b',
  energy: '#ffd25a', skin: '#9aa77a', skinDark: '#5f6b4a', stitch: '#d9c9a5', white: '#ffffff',
  black: '#000000'
};
Core.ctx;        // CanvasRenderingContext2D of the 480x270 canvas
Core.time;       // seconds since start
Core.init({ update(dt), draw(ctx) });
// Creates scaling, input listeners, waits for the pixel font (max 2 s), starts requestAnimationFrame loop.
// Each frame: update(dt); ctx.save(); apply shake; draw(ctx); ctx.restore(); draw toasts; clear per-frame input.
// On the first pointerdown/keydown calls window.Sound && Sound.unlock().

Core.input.down(key)      // bool, key held. key = KeyboardEvent.key; letters are lowercased ('a'), others as-is ('ArrowLeft','Enter',' ','Escape')
Core.input.pressed(key)   // bool, pressed this frame
Core.input.pointer        // { x, y, down, justDown, justUp } logical coords; x = y = -1 when no pointer
Core.input.swipe          // 'up'|'down'|'left'|'right'|null on the frame a swipe (>= 20 px) ends
Core.input.dir()          // 'up'|'down'|'left'|'right'|null from arrows/WASD pressed this frame, or swipe
Core.input.consume()      // clears pressed/justDown/justUp/swipe for this frame

Core.gfx.clear(color)
Core.gfx.rect(x, y, w, h, color)
Core.gfx.frame(x, y, w, h, color)                  // 1 px outline inside the rect
Core.gfx.panel(x, y, w, h, { fill = PAL.panel, border = PAL.brass } = {})
Core.gfx.text(str, x, y, { color = PAL.text, size = 8, align = 'left'|'center'|'right' } = {})   // y = top of the glyph box
Core.gfx.wrap(str, x, y, maxWidth, { color, size = 8, lineHeight = 10 } = {})  // word wrap, returns number of lines drawn
Core.gfx.bar(x, y, w, h, ratio, fg, bg)            // ratio clamped 0..1
Core.gfx.sprite(spr, x, y, { scale = 1, flip = false, tint = null, alpha = 1 } = {})
// spr = { w, h, rows: [string], pal: { char: '#hex' } }; '.' is transparent. Rendered through a cached offscreen canvas keyed by spr object + tint.
// tint = { '#fromHex': '#toHex' } exact color remap applied when rasterizing.
Core.gfx.icon(name, x, y)                          // Core.gfx.sprite(Sprites.icons[name], x, y)

Core.ui.button(x, y, w, h, label, { key = null, disabled = false, color = null, active = false } = {})
// Draws a panel-style button with centered 8 px text; returns true when clicked this frame (pointer.justDown inside) or when `key` was pressed.
// disabled: dimmed and never returns true. active: highlighted border (for toggles / selection).

Core.save(key, obj); Core.load(key, fallback)     // localStorage JSON, try/catch, fallback on any error
Core.rng(seed) -> rnd; Core.rand() -> number; Core.pick(arr, rnd = Math.random); Core.shuffle(arr, rnd = Math.random) (in place, returns arr); Core.irange(rnd, min, max) (inclusive)
Core.shake(intensity = 3, seconds = 0.3)
Core.toast(text, seconds = 2)                      // queued messages drawn top-center by Core after draw()
```

### 5.2 Sprites (`js/sprites.js`)

Sprite format: `{ w, h, rows, pal }` where `rows` is an array of `h` strings of length `w`, `pal` maps each char to a hex color, `'.'` is transparent. All pixel art is defined by hand in this file (no image files). Style: 1-px dark outlines, 3–5 shades per material, gothic-alchemical palette (dark purples, sickly greens, brass/copper, blood, bone). Every body part of every family includes at least a few `Core.PAL.stitch` pixels (visible sutures/seams), and the `base` family and stumps use `Core.PAL.skin` / `Core.PAL.skinDark` for flesh. That makes cosmetics (tint remaps of those colors) visible on any body.

```js
Sprites.FAMILIES = ['base','homunculo','ghoul','alquimista','automata','cirujano','quimera'];
Sprites.parts[family] = { head: 12x12, torso: 16x20, arm: 8x16 (drawn as the LEFT arm, hanging, hand at bottom), leg: 8x14 (LEFT leg) };
Sprites.stumps = { head: 12x12, torso: 16x20, arm: 8x16, leg: 8x14 };   // bandaged, bloody stumps
Sprites.BODY = { w: 40, h: 48, head: [14, 2], torso: [12, 14], armL: [4, 16], armR: [28, 16], legL: [12, 33], legR: [20, 33] };  // offsets inside the 40x48 body box
Sprites.drawBody(fams, x, y, { scale = 1, flip = false, tint = null, bob = 0 } = {})
// Draw order: legL, legR, torso, armL, armR, head. armR/legR are the family part drawn flipped horizontally. null → stump. bob = vertical pixel offset for idle animation.
Sprites.drawPart(family | null, slotType, x, y, { scale = 1, flip = false, tint = null } = {})
Sprites.tiles = { ... };   // 4.5, all 16x16; `stairs` = way up between floors, `exit` = glowing final door, `chest` = generic crate (unused by default)
Sprites.icons = { ... };   // 4.5, all 8x8
Sprites.tokens = { ... };  // 4.5, all 16x16 map tokens (full tiny figures)
Sprites.fireOverlay(intensity, t)
// Animated pixel flames along the bottom edge (and creeping up the sides at high intensity). intensity 0..1 controls height (0 → ~4 px, 1 → ~40 px) and density. Uses Core.gfx.rect blocks of 4x4/2x2 with PAL.fire1/fire2/fire3. Must be cheap (< 200 rects).
Sprites.logo(x, y)          // draws the title "DEADLOCK DECK" as pixel text/blocks (may simply use Core.gfx.text size 16 with a drop shadow) plus a small pixel ornament (alembic / clock)
```

### 5.3 Data (`js/data.js`)

```js
Data.CONFIG = { startTime: 360, floors: 3, mutateEvery: 30, fogRadius: 4, handSize: 5, energy: 3, baseHp: 30, harvestOffers: 2, endCombatCoolMult: 2 };
Data.FAMILIES = [ { id, name, kind, desc } ];   // section 4.1 order
Data.SLOTS = ['head','torso','armL','armR','legL','legR'];
Data.SLOT_NAMES = { head: 'Cabeza', torso: 'Torso', armL: 'Brazo izq.', armR: 'Brazo der.', legL: 'Pierna izq.', legR: 'Pierna der.' };
Data.slotType(slotKey)  // 'head'|'torso'|'arm'|'leg'
Data.LIMBS = { [id]: { id, family, slot: 'head'|'torso'|'arm'|'leg', name, desc, maxHeat, cool, hp, cards: [ { id, count } ] } };
// hp: extra max HP granted (torso 8–24; other slots 0). 32 entries (section 4.2).
Data.CARDS = { [id]: { id, name, cost, heat, type: 'attack'|'skill', text, exhaust: false, effects: [ { kind, value, times } ] } };
// Effect kinds (Combat implements exactly these):
//   damage {value, times=1}   deal value to the enemy (block first), repeated times
//   block {value}             player gains block
//   heal {value}              player heals (cap maxHp)
//   draw {value}              draw cards
//   energy {value}            gain energy this turn
//   cool {value}              remove heat from the card's source limb (stump source: no-op)
//   coolAll {value}           remove heat from every limb
//   poison {value}            enemy poison stacks += value
//   weaken {value}            enemy's next `value` attacks deal half damage (floor)
//   stun {}                   enemy skips its next action
//   flee {}                   combat ends with result 'fled' (only leg cards)
//   selfDamage {value}        player loses value HP, unblockable
Data.ENEMIES = { [id]: { id, family, name, kind, hp, ichor, intents: [ intent ], drops: [ limbIds ] } };
// intent kinds: attack {value, times=1} | block {value} | heat {value} (adds heat to a random non-stump player limb) | poison {value} | heal {value}
// intents cycle in order, one per enemy turn.
Data.FLOOR_ENEMIES = [ ['homunculo','alquimista'], ['homunculo','ghoul','automata','cirujano'], ['ghoul','automata','cirujano','alquimista'] ];
Data.GUARDIAN = 'quimera';
Data.FLOOR_COUNTS = [ { enemies: 4, resources: 4, traps: 3 }, { enemies: 5, resources: 4, traps: 4 }, { enemies: 5, resources: 5, traps: 5 } ];   // last floor: enemies excludes the guardian
Data.RESOURCES = { coolant: { id, name, desc, tile: 'coolant', effect: { kind: 'coolAll', value: 6 } }, suture: { ..., tile: 'suture', effect: { kind: 'heal', value: 12 } }, clockwork: { ..., tile: 'clockwork', effect: { kind: 'time', value: 20 } }, ichor: { ..., tile: 'ichor', effect: { kind: 'ichor', value: 8 } } };
Data.TRAPS = { spikes: { id, name, desc, tile: 'spikes', effect: { kind: 'damage', value: 6 } }, acid: { id, name, desc, tile: 'acid', effect: { kind: 'heat', value: 5 } } };
Data.COSMETICS = [ { id, name, desc, price, tint } ];   // tint uses exact Core.PAL hex keys, e.g. { [Core.PAL.stitch]: Core.PAL.brass }
Data.PACKS = [ { id: 'pack_quimera', name, desc, price: 60, blueprints: ['quimera_head','quimera_torso','quimera_arm','quimera_leg'] } ];
Data.BASE_POOL = { head: ['base_head_a','base_head_b'], torso: [...], arm: [...], leg: [...] };
Data.newBaseBody(rnd)   // -> limbs object with random base blueprints per slot (arms/legs may differ L/R), heat 0
Data.maxHp(limbs)       // CONFIG.baseHp + sum of LIMBS[limb.id].hp over non-null slots
Data.STUMP_CARD = { id: 'stump', name: 'Muñonazo', cost: 1, heat: 0, type: 'attack', text: '3 de daño. Golpe torpe de muñón.', exhaust: false, effects: [ { kind: 'damage', value: 3 } ] };
Data.familyOf(limbId)   // LIMBS[id].family
```

Balance targets (P3 tunes within these):
- Player: baseHp 30 + torso hp (base 12, homunculo 8, alquimista 12, cirujano 14, ghoul 20, automata 18, quimera 24). Energy 3, hand 5.
- Each blueprint contributes 3–5 cards (2–3 distinct card ids). A full body ≈ 22–28 cards. Deck contents per slot type: head = utility (draw, energy, cool, weaken, stun); torso = block/heal; arm = attacks (most heat); leg = kicks, block/dodge and the only `flee` cards (each leg blueprint has exactly one flee card: cost 1–2, heat 2–4, exhaust).
- Heat: attacks heat 2–4 (big attacks 5–8); skills 0–2; cards that `cool` have heat 0. maxHeat: base 8–9, homunculo 7, ghoul 10, alquimista 10, cirujano 9, quimera 12, automata 16. cool per turn: homunculo 3, base/alquimista/cirujano 2, ghoul/automata/quimera 1 (alquimista head and torso may cool 3).
- Damage: 1-cost attacks 4–6, 2-cost 8–10, 3-cost 12–15. Enemy HP: homunculo 12, alquimista 16, cirujano 20, ghoul 24, automata 26, quimera 42. Enemy attacks: floor-1 enemies 3–5, floor-2 6–8, quimera 8–10 (with one heat intent of 5). Ichor per enemy 5–15.
- A full combat should last 3–6 player turns.

### 5.4 Sound (`js/sound.js`)

100% synthesized with Web Audio (oscillators, noise buffers, filters, envelopes). No audio files.

```js
Sound.unlock()          // creates/resumes the AudioContext; safe to call many times; must be called from a user gesture (Core does it)
Sound.music(mode)       // 'title' | 'run' | 'combat' | 'death' | 'victory' | 'off'; idempotent; crossfade or hard switch within 0.5 s
// title: slow ominous drone (low detuned saws through a lowpass, slow LFO, sparse minor-key bell notes).
// run: drone + slow pulsing bass + occasional dissonant stabs; tempo and pitch follow urgency.
// combat: run + synthesized percussion (kick/noise snare) at the same tempo.
// death: descending dissonant chord, then silence. victory: brighter resolved chord with bells.
Sound.urgency(u)        // 0..1, raises tempo (1x → 1.8x), filter cutoff, adds tremolo; called every frame by Game
Sound.sfx(name)         // names in 4.5. Guttural feel: growl/hit/death use noise + pitch-dropping oscillators through lowpass; graft = wet squelch (filtered noise bursts); break = snap (short noise burst + low thud); overheat = hiss; tick/alarm = short clicks/beeps; shift = low rumble
Sound.toggleMute() -> muted; Sound.muted
```
All functions are no-ops (no exceptions) before `unlock()` or when Web Audio is unavailable.

### 5.5 Tower (`js/tower.js`)

Pure logic, no drawing. Uses `Data` only.

```js
Tower.W = 24; Tower.H = 14;
Tower.T = { WALL: 0, FLOOR: 1, EXIT: 2 };
Tower.generate(rnd, floorIndex) -> floor
// floor = { w, h, tiles: number[w*h], seen: boolean[w*h], decor: number[w*h] (0..2 floor variant), start: {x,y}, exit: {x,y}, entities: [ ent ], floorIndex }
// ent = { type: 'enemy'|'resource'|'trap', id, x, y }
// Rooms + corridors (5–8 rooms of 3x3..7x5 on a 24x14 grid, connected with L-shaped corridors, plus 1–2 extra loops). Outer ring is WALL.
// start = a floor tile in the first room; exit = a FLOOR-reachable tile in the room farthest (BFS distance) from start; tiles[exit] = EXIT.
// Entities on distinct FLOOR tiles, never on start/exit, enemies at BFS distance >= 4 from start. Counts from Data.FLOOR_COUNTS[floorIndex]; enemy ids from Data.FLOOR_ENEMIES[floorIndex]; resources weighted (coolant 35%, suture 30%, ichor 25%, clockwork 10%); traps from Data.TRAPS. On the last floor (floorIndex === Data.CONFIG.floors - 1) add the guardian enemy Data.GUARDIAN on a walkable tile adjacent to the exit.
// Guarantee: BFS path start → exit exists; every entity is reachable.
Tower.mutate(floor, rnd, playerPos) -> floor   // same object, mutated
// Re-carves the level: new rooms/corridors, but the player tile, the exit tile and every entity tile stay walkable and reachable from the player (carve extra corridors if needed). Clears `seen`, then reveals around the player.
Tower.idx(x, y); Tower.get(floor, x, y) (WALL outside bounds); Tower.walkable(floor, x, y)
Tower.entityAt(floor, x, y) -> ent | null; Tower.removeEntity(floor, ent)
Tower.reveal(floor, x, y, radius)     // seen = true for tiles within Euclidean radius (no line of sight)
Tower.reachable(floor, from, to) -> bool   // BFS over walkable tiles
```

### 5.6 Combat (`js/combat.js`)

```js
Combat.start(player, enemyDef, rnd)   // player: section 3 object (mutated in place). enemyDef: Data.ENEMIES entry.
Combat.update(dt)                     // input + timers. Uses Core.input. Player input: click/tap a card to play it; keys '1'..'9' play hand index; End turn button, key 'e' or 'Enter'.
Combat.draw(ctx)                      // draws the full combat screen; keep the top-right 100x22 region free (Game draws the clock there).
Combat.result                         // null while running, then 'win' | 'lose' | 'fled'
Combat.state                          // { enemy: { def, hp, maxHp, block, poison, weak, stunned, intentIndex }, hand, drawPile, discard, energy, turn, log: string[], busy }
```

Rules:
1. `start`: `player.block = 0; player.poison = 0`. Deck = for each slot in `Data.SLOTS`: if limb → `count` copies of each card with `source = slotKey`; if stump → one `Data.STUMP_CARD` with `source = slotKey` and `stump = true`. Shuffle with `rnd`. `energy = Data.CONFIG.energy`, draw `handSize`. Enemy `hp = maxHp = def.hp`, `intentIndex = 0`. `Sound.music('combat')`, `Sound.sfx('growl')`.
2. Card instance: `{ uid, def, source, stump }`. Playing: requires `energy >= def.cost`; `energy -= cost`; apply effects in order (5.3 list); then if the source slot holds a limb, `limb.heat += def.heat`; if `limb.heat >= Data.LIMBS[limb.id].maxHeat` → **break**: `player.limbs[source] = null`, remove every card whose `source` is that slot from hand/drawPile/discard, push one stump card for that slot into the discard, log `¡Se rompe: <Slot name> (<limb name>)!`, `Sound.sfx('break')`, `Core.shake(4, 0.4)`. Heat ≥ 75% of maxHeat plays `Sound.sfx('overheat')` once per turn per limb. `exhaust` cards are removed for the rest of the combat; others go to discard. `Sound.sfx('card')` / `'hit'` / `'block'` / `'heal'` / `'poison'` as appropriate.
3. Damage to the enemy: `block` absorbs first. Enemy hp ≤ 0 → `Sound.sfx('death')`, result `'win'` after ~0.4 s. `flee` → `Sound.sfx('flee')`, result `'fled'`.
4. End turn: enemy turn: `enemy.block = 0`; if `poison > 0`: `hp -= poison; poison--`. If `stunned`: skip action, `stunned = false`; else execute `intents[intentIndex]`, `intentIndex = (intentIndex + 1) % intents.length`. `attack`: each hit `dmg = value` (if `weak > 0`: `dmg = floor(dmg / 2)`, `weak--` once per intent); block absorbs; `player.hp -= rest`. `heat`: add value to a random non-stump limb, break check as in rule 2. `poison`: `player.poison += value`. `heal`: `hp = min(maxHp, hp + value)`. `block`: `enemy.block += value`.
5. Player turn start: `player.block = 0`; if `player.poison > 0`: `hp -= poison; poison--`; every non-null limb `heat = max(0, heat - LIMBS.cool)`; `energy = Data.CONFIG.energy`; discard the hand; draw `handSize` (reshuffle discard into drawPile when empty). `player.hp <= 0` at any moment → result `'lose'`.
6. Intent preview above the enemy: icon (`skull` for attack, `flame` for heat, `skull` in PAL.poison for poison, `heart` for heal, `check` for block) + number (`value×times`).
7. Layout (480×270): enemy body via `Sprites.drawBody` scale 2 at right (≈ x 300–400, y 40–140) with HP bar + block + poison/weak/stun tags above; player body scale 2 at left (x ≈ 40–120) with HP bar, block, and six small heat bars labelled by slot (bar color goes `PAL.sick` → `PAL.fire3` → `PAL.heat` as heat rises; stumps show "muñón"). Hand at the bottom (y ≈ 186–266): up to 8 cards of 88×78, spacing 92 px for ≤ 5 cards and `(464 − 88) / (n − 1)` (overlapping, topmost card wins the click) for more, each showing cost (bolt icon), heat (flame icon), name (wrapped), text (wrapped, size 8), and a mini part sprite of its source (Sprites.drawPart). Unaffordable cards dimmed. End-turn button at (362, 160, 110×20) ("Fin turno [E]"). Energy display near the hand (bolt icon + "3/3"). Log: last 2 lines at y ≈ 150–170 left. Keep the region x ≥ 380, y ≤ 22 empty.
8. Feel: hit flash on the target (white sprite tint/alpha for 0.1 s), small shake on big hits, all animations ≤ 0.3 s and never block input for more than 0.4 s. Whole combat should be playable in 20–40 seconds.

### 5.7 Game (`js/game.js`)

```js
Game.init()      // loads meta, sets state 'title', Core.init({ update, draw })
Game.state       // 'title' | 'table' | 'explore' | 'combat' | 'harvest' | 'victory' | 'death' | 'codex' | 'shop'
Game.meta        // persisted as localStorage key 'deadlock_meta':
// { blueprints: string[], ichor: number, cosmetics: string[] (owned, always includes 'skin_default'), skin: string, packs: string[], escapes: number, loops: number, bestTime: number|null }
Game.run         // { seed, rnd, floorIndex, floor, player, pos: {x,y}, prevPos, timeLeft, mutateTimer, log: string[], kills, initialGraftUsed }
```

Screens (all Spanish UI):
- **title**: `Sprites.logo`, subtitle "El Reloj Anatómico", a body drawn with the current skin, buttons "Despertar" (→ table; key Enter), "Planos" (→ codex), "Tienda" (→ shop), sound toggle icon (`Sound.toggleMute`). Fire overlay at low intensity. `Sound.music('title')`. Stats line: escapes / loops / best time.
- **table** (Mesa de disección): text "Despiertas sobre una mesa de disección. Nuevo cuerpo. Mismo reloj.", the table tile row under the body, the body (scale 2), the six slots with limb names and card summaries. If `meta.blueprints` has entries: panel "Injerto inicial" listing discovered non-base blueprints (scrollable via arrow buttons if > 6) with an "Injertar" button: replaces the matching slot (arms/legs: asks "Izq." / "Der."), once per loop. Button "Levántate [Enter]" → starts the run: `run.seed = Date.now()`, `rnd = Core.rng(seed)`, `timeLeft = CONFIG.startTime`, `floorIndex = 0`, `floor = Tower.generate`, `pos = floor.start`, reveal, `Sound.music('run')`, state 'explore'. `meta.loops++` happens on death, not here.
- **explore**: map 24×14 tiles at (0,0) with 16 px tiles. Unseen tiles black; seen-but-not-in-radius tiles drawn at ~50% (draw normally then overlay `PAL.ink` with alpha 0.55 via `ctx.globalAlpha`); tiles in `fogRadius` full brightness. Entities drawn with `Sprites.tokens` (enemies) or `Sprites.tiles` (resources/traps). Player token `Sprites.tokens.player` with a 2-frame bob. Right column (x 384–480): the clock (see HUD), "Piso 1/3", HP bar with numbers, the body composite at scale 1 (x ≈ 412, y ≈ 88) with the current skin tint, six 2-px heat bars under it, ichor count, mute button (456, 246, 20×20). Bottom strip (y 224–270): last 2 log lines, hint "Flechas/WASD o desliza · Llega a la salida".
  Movement: `Core.input.dir()` moves 1 tile; holding a direction key repeats every 0.14 s; tapping/clicking on the map moves one tile toward the tap along the dominant axis (only if the tap is > 8 px from the player's center). Moving onto: WALL → nothing; enemy → `prevPos = pos`, `Combat.start(player, Data.ENEMIES[ent.id], rnd)`, state 'combat'; resource → apply effect (`coolAll`, `heal`, `time` → `timeLeft += value`, `ichor` → `player.ichor += value`), remove, toast, `Sound.sfx('pickup')`; trap → apply (`damage` unblockable, `heat` random non-stump limb with break handling identical to combat rule 2 — implement a shared `Game.breakCheck(slot)` here), remove, `Sound.sfx('trap')`, shake; `EXIT` → if `floorIndex < CONFIG.floors - 1`: `floorIndex++`, new floor, `pos = start`, toast "Subes al piso N", `Sound.sfx('step')`; else → victory. Every step `Sound.sfx('step')` and `Tower.reveal(floor, x, y, fogRadius)`.
  Clock: `timeLeft -= dt` in explore/combat/harvest. `Sound.urgency(1 - timeLeft / startTime)`. `timeLeft <= 0` → death (reason 'time'). Mutation: `mutateTimer += dt` in explore; when `>= CONFIG.mutateEvery`: `mutateTimer = 0`, `Tower.mutate(floor, rnd, pos)`, `Tower.reveal`, toast "El laboratorio se reconfigura…", `Sound.sfx('shift')`, `Core.shake(3, 0.5)`.
- **combat**: `Combat.update(dt); Combat.draw(ctx)`, then HUD. On `Combat.result`: `'win'` → `run.kills++`, end-of-combat cooling (`heat = max(0, heat - cool * endCombatCoolMult)`), remove the enemy entity, `player.ichor += def.ichor`, state 'harvest'; `'lose'` → death (reason 'killed'); `'fled'` → `pos = prevPos`, `Sound.music('run')`, state 'explore'.
- **harvest** (Cosecha): title "Cosecha: <enemy name>", the enemy body at scale 2 tinted darker (dead), `CONFIG.harvestOffers` offers = random distinct-slot blueprints from `def.drops`. Each offer panel: part sprite, name, slot, maxHeat/cool, hp bonus, its cards (name · cost · heat · text, wrapped), buttons "Injertar" (arms/legs: two buttons "Brazo izq." / "Brazo der." or "Pierna izq." / "Pierna der."; a stump slot is labelled with "(muñón)") and the current occupant name shown for comparison. Grafting: `player.limbs[slot] = { id, heat: 0 }`, `player.maxHp = Data.maxHp(limbs)` (hp capped), `Sound.sfx('graft')`, offer consumed; if the blueprint is new: `meta.blueprints.push(id)`, save, toast "¡Nuevo plano anatómico: <name>!", `Sound.sfx('unlock')`. Button "Continuar [Enter]" → `Sound.music('run')`, state 'explore'. The clock keeps running here.
- **victory**: "Has escapado de la torre" with time left, kills, ichor earned (+ bonus `floor(timeLeft / 10)`), `meta.escapes++`, `meta.bestTime = max`, `meta.ichor += player.ichor + bonus`, save, `Sound.music('victory')`, `Sound.sfx('victory')`. Button "Volver" → title.
- **death**: reason text: time → "El reloj marcó las seis. La torre se derrumba sobre ti."; killed → "Tu cuerpo cae. La torre sigue ardiendo."; then "Tu espíritu se transporta a una nueva mesa de disección. La torre se regenera. Conservas tus planos." `meta.loops++`, `meta.ichor += player.ichor`, save, `Sound.music('death')`, `Sound.sfx('death')`. Button "Nueva mesa [Enter]" → table (new body, new seed).
- **codex** (Planos anatómicos): all `Data.LIMBS` grouped by family (7 columns or a paged list), discovered (base blueprints are always known; others when in `meta.blueprints`) show part sprite + name + cards summary; unknown show a dark silhouette + "???". Counter "Planos: X/32". Button "Volver [Esc]".
- **shop** (Tienda — demo): disclaimer "Demo gratuita: sin pagos reales. El Icor se gana jugando.", ichor balance, one row per cosmetic (preview: the base body with the tint) with "Comprar (N)" / "Equipar" / "Equipado", the pack with "Desbloquear (N)" / "Desbloqueado". Purchase deducts `meta.ichor`, saves. Button "Volver [Esc]".
- **HUD** (drawn by `Game.drawHud` on explore/combat/harvest, after the screen): clock text "M:SS" at (384, 4) size 16, color `PAL.bone` → `PAL.fire3` (< 120 s) → `PAL.heat` (< 60 s, blinking); fire overlay `Sprites.fireOverlay(max(0.1, 1 - timeLeft/startTime), Core.time)`; under 60 s a pulsing red vignette (`PAL.blood`, alpha 0.05–0.2) and `Sound.sfx('tick')` once per second (`'alarm'` at 30 s and 10 s).
- Skin: `Game.tint()` returns the tint of `meta.skin`; passed to every player body draw.
- Escape key on any run screen: no pause (the concept has none); Esc only leaves codex/shop.

## 6. Work packages

| Package | Files | Depends on |
|---|---|---|
| P1 core | `index.html`, `style.css`, `js/core.js` | — |
| P2 sprites | `js/sprites.js` | Core.PAL hex values (from this spec) |
| P3 data | `js/data.js` | Core.PAL hex values (tints), this spec |
| P4 sound | `js/sound.js` | — |
| P5 tower | `js/tower.js` | Data (ids only), Core.rng contract |
| P6 combat | `js/combat.js` | P1–P5 finished |
| P7 game | `js/game.js` | P1–P5 finished; Combat API from this spec |
| P8 QA | all | P6–P7 finished; plays the game in a browser and fixes bugs |

Workers only touch their own files. Every worker runs `node --check` on each JS file they wrote before reporting.

## 7. Definition of done (for QA)

1. `index.html` opens from `file://` without console errors; title screen renders with logo, buttons, flames and music after the first click.
2. Table shows a random base body; "Levántate" starts the 6:00 clock.
3. Exploration: movement with keys, swipe and tap; fog of war; resources, traps, stairs, exit; the floor mutates every 30 s with a message.
4. Combat: cards from limbs, heat bars rise, a limb breaks at maxHeat and its cards disappear, stump card appears, enemy intents, win/lose/flee all work.
5. Harvest: grafting replaces a limb, breaks are repaired by grafting a new limb, new blueprints are announced and persist after reload.
6. Death by time and by HP both return to the table with a new body and a regenerated tower; blueprints kept.
7. Victory on floor 3 after the Quimera; ichor awarded; shop purchases work and the skin tint is visible on the body; codex marks discovered blueprints.
8. Sound: music per state, urgency rises, SFX on card/hit/break/graft/pickup/trap/shift; mute toggle.
9. Works on a phone-sized landscape viewport (touch) and desktop.
