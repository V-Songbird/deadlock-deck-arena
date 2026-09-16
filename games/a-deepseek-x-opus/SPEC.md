# Deadlock Deck: El Reloj Anatómico — FROZEN INTERFACE CONTRACT

This file is the single source of truth for every module. **Do not invent names that are
not written here.** If you need something that is missing, add it in your own file and
register it under your own namespace key — never rename or repurpose a frozen key.

Everything is plain ES5/ES2015 JavaScript. **No ES modules, no `import`, no `export`, no
bundler, no npm packages.** Files are loaded with plain `<script>` tags and must work when
`index.html` is opened directly from `file://`.

---

## 0. Hard rules (violating any of these breaks the build)

1. **No dependencies.** No npm, no CDN, no external assets. Only Canvas 2D, Web Audio,
   `localStorage`, and the DOM.
2. **No ES modules.** No `import`/`export`. Every file is an IIFE:
   ```js
   (function () {
     'use strict';
     var DD = window.DD;
     // ... your code ...
   })();
   ```
   `window.DD` and the sub-namespaces listed below already exist by the time your file
   loads (see script order in `index.html`). Assume `DD`, `DD.Data`, `DD.Pixel`,
   `DD.Audio` exist. Do **not** assign `window.DD` yourself.
3. **Never throw at load time.** Every file must survive being loaded before its
   dependencies. Guard anything optional (`if (!DD.Sprites) return;` inside a function,
   not at top level).
4. **Text is Spanish.** All player-facing strings (names, descriptions, flavour, UI
   labels) are written in Spanish, with correct accents. Code, identifiers, comments and
   this document stay in English.
5. **Canvas text is forbidden.** Never call `ctx.fillText` / `ctx.font`. All text goes
   through `DD.Pixel.text(...)`, which uses the bitmap font in `src/render/font.js`.
6. **Rendering must never crash on a missing sprite.** `DD.Pixel.sprite()` draws a
   magenta placeholder box for an unknown key. Never index sprite data directly.
7. **No `console.log` in normal operation.** Errors may use `console.warn`/`console.error`.
8. Line budget: keep each file focused. No file should exceed ~900 lines.

---

## 1. Virtual screen

- The canvas is **640 x 360** virtual pixels, integer-scaled to the window and letterboxed.
  All drawing uses virtual coordinates. `DD.Canvas.w === 640`, `DD.Canvas.h === 360`.
- Grid tile size is **24** virtual pixels (`DD.TILE = 24`).
- The explore camera is clamped to the map bounds. The ambient background is `#07060a`.

---

## 2. Frozen vocabulary

### 2.1 Body sockets (exactly 6, in this order)
```
head, torso, armL, armR, legL, legR
```
`DD.SOCKETS = ['head','torso','armL','armR','legL','legR']`

### 2.2 Limb slots (where a limb can be grafted)
```
head, torso, arm, leg
```
A limb with slot `arm` fits `armL` and `armR`. Slot `leg` fits `legL` and `legR`.
Mapping helper lives in `src/systems/body.js`:
`DD.Body.socketsFor(slot) -> ['armL','armR']`.

### 2.3 Limb forms (drives the avatar sprite, exactly 5)
```
gaunt, bulky, fleshy, mech, spectral
```
Each limb declares `form` (one of the above) and `palette: [dark, mid, light]`
(three `#rrggbb` strings). The avatar renderer recolours sprite channels 1/2/3 with them.

### 2.4 Card types (exactly 4)
```
attack, block, skill, power
```

### 2.5 Rarities (exactly 3)
```
common, uncommon, rare
```

### 2.6 Status effects (closed set, on player or enemy)
```
bleed, weak, vulnerable, frail, poison, stun
```
Semantics: `bleed` N → lose N HP at end of the owner's turn. `weak` N → owner deals 25%
less damage while N > 0, N decrements each of the owner's turns. `vulnerable` N → owner
takes 50% more damage. `frail` N → owner gains 25% less block. `poison` N → lose N HP at
the start of the owner's turn, then N decrements. `stun` N → owner skips N turns.

### 2.7 Card effect verbs (closed set — the combat engine implements exactly these)
```js
{k:'damage',      v:Number, all:false}   // damage the target (all:every enemy)
{k:'block',       v:Number}              // owner gains block
{k:'draw',        v:Number}
{k:'energy',      v:Number}
{k:'heal',        v:Number}
{k:'heat',        v:Number, socket:null} // add heat to a socket; null = the card's own socket
{k:'cool',        v:Number, socket:null} // remove heat
{k:'integrity',   v:Number, socket:null} // restore limb integrity (clamped to max)
{k:'bleed',       v:Number, all:false}
{k:'weak',        v:Number, all:false}
{k:'vulnerable',  v:Number, all:false}
{k:'frail',       v:Number}
{k:'poison',      v:Number, all:false}
{k:'stun',        v:Number, all:false}
{k:'selfDamage',  v:Number}
{k:'lifesteal',   v:Number}              // heal owner by v
{k:'residue',     v:Number}              // +v alchemical residue
{k:'discardRandom', v:Number}
{k:'exhaustSelf'}                        // this card is removed for the rest of combat
{k:'gainBlockPerHeat', v:Number}         // block = v * (heat of own socket / 25, rounded down)
{k:'damagePerHeat',    v:Number}         // damage = v * (heat of own socket / 25, rounded down)
{k:'damagePerMissingLimb', v:Number}     // damage = v * number of stumps
{k:'scavenge'}                           // enemy drops an extra limb this fight
```

### 2.8 Limb passives (closed set)
```js
{id:'thorns',        v:Number}   // reflect v damage to melee attacker
{id:'regen',         v:Number}   // heal v at end of each of your turns
{id:'drawBonus',     v:Number}   // +v cards drawn per turn
{id:'energyBonus',   v:Number}   // +v energy per turn
{id:'blockBonus',    v:Number}   // +v block whenever you gain block
{id:'heatResist',    v:Number}   // -v heat from every card played
{id:'coolBonus',     v:Number}   // +v cooling at end of turn
{id:'lifesteal',     v:Number}   // heal v whenever you deal damage
{id:'firstStrike',   v:Number}   // +v damage on turn 1 only
{id:'bleedOnHit',    v:Number}   // apply v bleed whenever you deal damage
{id:'maxHpBonus',    v:Number}   // +v max HP
{id:'scavengeBonus', v:Number}   // +v% chance of an extra limb drop
{id:'openingDraw',   v:Number}   // +v cards in your opening hand only
```

### 2.9 Enemy ids (exactly these 12 — art and data both key off them)
```
crawler, leech, homunculus, stitcher, plague_nurse, brute,
hound, widow, alchemist, revenant, golem, harvester
```
`harvester` is the boss (48x48 sprite, all other enemies are 32x32).

### 2.10 Map tile ids
```
0 void, 1 floor, 2 wall, 3 door, 4 stairsUp, 5 exitDoor, 6 grate, 7 blood
```
`DD.TILE_VOID = 0`, `DD.TILE_FLOOR = 1`, `DD.TILE_WALL = 2`, `DD.TILE_DOOR = 3`,
`DD.TILE_STAIRS = 4`, `DD.TILE_EXIT = 5`, `DD.TILE_GRATE = 6`, `DD.TILE_BLOOD = 7`.

### 2.11 Entity kinds on the explore grid
```
enemy, trap, resource, prop, altar
```
`DD.Entity` objects are always `{kind, x, y, id, data, dead, active, timer}`.

### 2.12 Resource ids
```
residue, oil, bandage, shard
```
(`residue` is also a numeric field on the run; the pickup adds to it.)

### 2.13 Run status
```
explore, combat, dead, timedout, escaped
```

---

## 3. Data contracts (the files under `src/data/`)

Each data file ends by self-indexing. Follow this exact pattern:

```js
DD.Data.limbs = [ /* ... */ ];
DD.Data.limbById = {};
for (var i = 0; i < DD.Data.limbs.length; i++) DD.Data.limbById[DD.Data.limbs[i].id] = DD.Data.limbs[i];
```

### 3.1 Limb — `src/data/limbs.js` -> `DD.Data.limbs[]`, `DD.Data.limbById{}`
```js
{
  id: 'gaunt_arm',              // unique kebab-case
  name: 'Brazo Escuálido',      // Spanish
  slot: 'arm',                  // head | torso | arm | leg
  tier: 1,                      // 1..3  (starting body is tier 1/2, drops scale with floor)
  form: 'gaunt',                // see 2.3
  palette: ['#2b2130', '#6b5a7a', '#c9b8d8'],
  integrity: 24,                // max structural integrity (a small pool, 10..60)
  heatCap: 100,                 // 60..140
  coolRate: 6,                  // heat shed per turn, 3..12
  maxHpBonus: 0,                // added to the player's max HP while equipped
  passive: {id:'thorns', v:3},  // or null
  cards: ['bone_spike','x'],    // 3..4 card ids, must all exist in cards.js
  drops: true,                  // can appear as loot
  flavor: 'Un texto corto de sabor en español.'
}
```
Counts: **6 heads, 6 torsos, 8 arms, 6 legs = 26 limbs.** Slots must be filled exactly:
`head` 6, `torso` 6, `arm` 8, `leg` 6. Three of each slot at `tier:1`, two at `tier:2`,
one at `tier:3` (arms: 4/3/1). Tier-3 limbs are the run-defining ones.

### 3.2 Card — `src/data/cards.js` -> `DD.Data.cards[]`, `DD.Data.cardById{}`
```js
{
  id: 'bone_spike',
  name: 'Espina Ósea',           // Spanish
  cost: 1,                       // 0..3
  type: 'attack',                // see 2.4
  rarity: 'common',              // see 2.5
  heat: 5,                       // heat added to the owning socket, 0..30
  desc: 'Inflige 7 de daño.',    // Spanish, must match the effects
  art: 'cicon_bone',             // MUST be one of the frozen cicon_* keys in 4.3
  effects: [ {k:'damage', v:7} ] // see 2.7
}
```
Counts: **~100 cards total** — 3-4 per limb plus the stump cards. Every card id used in
`limbs.js` must exist here, and vice versa (every card must be reachable from some limb,
except the six stump/basic cards).

Stump / basic cards (**must exist with these exact ids**):
`stump_punch`, `stump_guard`, `stump_scrabble`, `stump_lurch`, `stump_screech`, `stump_bite`.
A broken socket contributes `stump_punch` x2 and one other stump card chosen by tier.

### 3.3 Enemy — `src/data/enemies.js` -> `DD.Data.enemies[]`, `DD.Data.enemyById{}`
```js
{
  id: 'crawler',                 // one of the 12 frozen ids
  name: 'Reptador',              // Spanish
  tier: 1,                       // 1..3
  hp: 18,                        // 10..90
  sprite: 'enemy_crawler',       // exactly 'enemy_' + id
  boss: false,                   // true only for harvester
  intentPattern: 'random',       // 'random' | 'cycle'
  intents: [
    {type:'attack', v:6, text:'Muerde'},
    {type:'block',  v:5, text:'Se enrosca'},
    {type:'debuff', status:'weak', v:1, text:'Escupe bilis'}
  ],
  heatAttack: 3,                 // heat added to a random socket when it attacks, 0..12
  drops: ['gaunt_arm','gnawed_legs'], // limb ids from limbs.js, 1..3 entries
  dropChance: 0.55,              // 0.3..0.9
  flavor: '...'                  // Spanish, short
}
```
Sprites must exist for all 12 ids: `enemy_crawler` … `enemy_harvester` (48x48 for the boss).
Intent `type` is one of `attack | block | buff | debuff | heal`.

### 3.4 Trap — `src/data/traps.js` -> `DD.Data.traps[]`, `DD.Data.trapById{}`
```js
{
  id:'spike', name:'Pinchos', sprite:'trap_spike', spriteOn:'trap_spike_on',
  minFloor:0, damage:8, heat:0, integrity:0, cooldown:2.0,
  telegraph:0.45,      // seconds the trap is visibly armed before firing
  destructible:false,  // if true the player can break it for residue
  flavor:'...'
}
```
Slots: traps fire when the player stands on the tile, after `telegraph` seconds of warning.
`cooldown` is in seconds. Effects: `damage` to HP, `heat` to all sockets, `integrity`
damage split across random sockets.

### 3.5 Resource — `src/data/resources.js` -> `DD.Data.resources[]`, `DD.Data.resById{}`
```js
{id:'residue', name:'Residuo Alquímico', sprite:'res_residue', amount:5,
 desc:'+5 de residuo.', weight:40, heal:0, cool:0, integrity:0, shard:0, flavor:'...'}
```
`weight` is the relative spawn weight. `cool` reduces heat on all sockets,
`integrity` restores integrity on the most damaged socket.

### 3.6 Cosmetic — `src/data/cosmetics.js` -> `DD.Data.cosmetics[]`, `DD.Data.cosmeticById{}`
```js
{id:'default', name:'Carne Cruda', cost:0, palette:['#2b2130','#6b5a7a','#c9b8d8'],
 desc:'...', unlockedByDefault:true}
```
8 cosmetics. `cost` is in shards (0 for the default). Purely a recolour of the player's
body palette channels 1/2/3, plus a `tint` colour used for the HUD accent.

---

## 4. Art contracts — `src/render/`

### 4.1 Sprite data format (`DD.Sprites`, `DD.Avatar`)
A sprite is `{ w, h, pal, rows }` where `rows` is an array of `h` strings of `w` chars.
Characters: `.` or ` ` = transparent, `0` = outline (near-black `#0b0a10` by default),
`1`/`2`/`3` = palette channels, `4` = accent/metal, `5` = glow/emissive.
`pal` is a 6-entry array `[outline, c1, c2, c3, accent, glow]` with `#rrggbb` strings.

Registration:
```js
DD.Sprites = DD.Sprites || {};
DD.Sprites.tile_floor = { w:24, h:24, pal:[...], rows:[ ... ] };
```
`DD.Avatar` uses the same format but its palette is **determined at draw time** from the
limb's `palette`, so `DD.Avatar` sprites use `pal` = `[outline, '#808080','#a0a0a0','#c0c0c0', accent, glow]`
and are recoloured with `DD.Pixel.sprite(key, x, y, {palette:[c1,c2,c3]})`.

### 4.2 Frozen sprite keys
**Tiles (24x24)** — `tile_void`, `tile_floor`, `tile_floor_alt`, `tile_wall`,
`tile_wall_top`, `tile_wall_crack`, `tile_door`, `tile_stairs`, `tile_exit`, `tile_grate`,
`tile_blood`, `tile_rune`, `tile_pipe`, `tile_bones`

**Props (24x24)** — `prop_table`, `prop_shelf`, `prop_candle`, `prop_brazier`, `prop_jar`,
`prop_cage`, `prop_book`, `prop_crystal`, `prop_altar`, `prop_coffin`, `prop_chain`,
`prop_tube`

**Traps (24x24)** — `trap_spike`, `trap_spike_on`, `trap_vent`, `trap_vent_on`,
`trap_acid`, `trap_acid_on`

**Resources (16x16)** — `res_residue`, `res_oil`, `res_bandage`, `res_shard`,
`res_limb`, `res_heart`

**Enemies** — `enemy_crawler`, `enemy_leech`, `enemy_homunculus`, `enemy_stitcher`,
`enemy_plague_nurse`, `enemy_brute`, `enemy_hound`, `enemy_widow`, `enemy_alchemist`,
`enemy_revenant`, `enemy_golem` (all 32x32), `enemy_harvester` (48x48)

**UI** — `ui_logo` (128x48), `ui_clock_face` (32x32), `ui_clock_hand` (12x3), `ui_frame`
(24x24, 9-slice source), `ui_selector` (16x16), `ui_skull` (16x16), `ui_button` (16x16),
`ui_corner` (8x8), `ui_drip` (8x16)

**HUD icons (16x16)** — `icon_heat`, `icon_hp`, `icon_clock`, `icon_residue`, `icon_shield`,
`icon_sword`, `icon_skull`, `icon_limb`, `icon_dna`, `icon_shard`, `icon_oil`,
`icon_bandage`, `icon_integrity`, `icon_energy`, `icon_flee`, `icon_map`

**Card frames (48x64)** — `card_frame_attack`, `card_frame_block`, `card_frame_skill`,
`card_frame_power`, `card_back`, `card_frame_stump`

**Playmat / combat background** — `bg_lab` (160x120, tiled/scaled),
`bg_combat` (640x360), `bg_wall` (64x64)

### 4.3 Frozen card art keys (`cicon_*`, 16x16) — exactly these 24
```
cicon_bone, cicon_flame, cicon_frost, cicon_blood, cicon_gear, cicon_eye,
cicon_tendril, cicon_lightning, cicon_venom, cicon_needle, cicon_skull, cicon_heart,
cicon_lung, cicon_brain, cicon_hand, cicon_foot, cicon_spine, cicon_jaw, cicon_crystal,
cicon_steam, cicon_chain, cicon_hook, cicon_serum, cicon_graft
```

### 4.4 Avatar parts (`DD.Avatar`) — form x part x direction
Directions are exactly `down`, `up`, `side`. Sizes: head 16x16 at offset (4,0),
torso 16x16 at offset (4,8), arm 8x12 at offset (0,10) and (16,10), leg 8x8 at offset
(4,24) and (12,24). The assembled avatar box is **24x32**.
Keys: `av_head_<form>_<dir>`, `av_torso_<form>_<dir>`, `av_arm_<form>_<dir>`,
`av_leg_<form>_<dir>` -> 5 forms x 4 parts x 3 dirs = **60 sprites**.
Stumps: `av_stump_arm_<dir>`, `av_stump_leg_<dir>` -> 6 sprites.

Face the same direction on every part. In `down` the face is visible, in `up` the back of
the head, in `side` a profile. `side` is mirrored horizontally for left-facing movement.

---

## 5. Runtime contracts

### 5.1 `DD.Run` (`src/run.js`)
```js
DD.Run.state        // see 5.2, null before newRun()
DD.Run.meta         // persistent meta, see 5.3
DD.Run.newRun(seed)  // builds a fresh body + floor 0 map, resets the clock; sets status 'explore'
DD.Run.nextFloor()   // if last floor -> status 'escaped'; else generate the next floor
DD.Run.shiftFloor()  // procedural re-layout of the current floor, keeps the player position valid
DD.Run.tick(dt)      // advances elapsed/timeLeft; sets status 'timedout' at 0. Never ticks in 'dead'/'timedout'/'escaped'
DD.Run.onDeath()     // status = 'dead'
DD.Run.graft(socket, limbId) // replaces a socket, records the limb in the codex
DD.Run.saveMeta() / DD.Run.loadMeta()
```

### 5.2 Run state shape (frozen — every module reads these exact fields)
```js
{
  runIndex: 1, seed: 0,
  elapsed: 0, timeLeft: 360, timeTotal: 360,
  status: 'explore',
  floor: 0, floorCount: 4,
  shiftTimer: 60,          // seconds until the next procedural shift
  shiftWarn: 0,            // > 0 while the shift warning is showing
  body: { /* DD.Body object, see 5.4 */ },
  hp: 60, maxHp: 60, block: 0,
  residue: 0, oils: 0, bandages: 0, shards: 0,
  map: null,               // DD.Tower map object, see 5.6
  player: { x:0, y:0, dir:'down', anim:0, moving:false, flash:0, invuln:0 },
  encounter: null,         // active DD.Combat state, see 5.5
  stats: { kills:0, grafted:0, lost:0, floors:0, played:0, damage:0, best:0 },
  log: [ /* 5 most recent Spanish strings for the HUD ticker */ ]
}
```

### 5.3 Meta (`localStorage` key `dd.meta.v1`)
```js
{
  codexLimbs:  {},          // limbId -> true   (blueprints survive death; this is the core loop hook)
  codexEnemies:{},          // enemyId -> true
  runs:0, escapes:0, deaths:0, bestTime:null,   // bestTime = seconds remaining on the best escape
  cosmetics: { equipped:'default', unlocked:['default'] },
  seenIntro:false
}
```

### 5.4 `DD.Body` (`src/systems/body.js`)
```js
DD.Body.create(tier)                 // returns a fresh body object
DD.Body.socketsFor(slot)             // 'arm' -> ['armL','armR']
DD.Body.equip(body, socket, limbId)  // returns true on success
DD.Body.breakSocket(body, socket)    // limb destroyed -> socket becomes a stump
DD.Body.isStump(body, socket)
DD.Body.limbOf(body, socket)         // limb object or null (stump)
DD.Body.integrityOf(body, socket)
DD.Body.addHeat(body, socket, amount)
DD.Body.cool(body, dt)               // called every frame with dt; used in explore and combat
DD.Body.coolTurn(body, socket)       // end-of-combat-turn cooling
DD.Body.overheated(body, socket)     // heat >= heatCap
DD.Body.passiveTotals(body)          // -> {thorns:3, regen:1, ...} summed over equipped limbs
DD.Body.missingCount(body)           // number of stumps
DD.Body.maxHpBonus(body)             // sum of limb.maxHpBonus + passive maxHpBonus over equipped limbs
DD.Body.describe(body)               // -> array of {socket, limb, heat, heatFrac, integrity, intact}
```
Body object:
```js
{
  sockets:   { head:'limb_id', torso:null, armL:..., armR:..., legL:..., legR:... },
  integrity: { head:24, torso:0, ... },   // 0 when the socket is a stump
  heat:      { head:0, ... },             // 0 when the socket is a stump
  heatCap:   { head:100, ... },
  coolRate:  { head:6, ... }
}
```

### 5.5 `DD.Combat` (`src/systems/combat.js`)
```js
DD.Combat.start(spec)      // spec = {enemies:['crawler',...], floor:0, boss:false} -> sets DD.Run.state.encounter
DD.Combat.playCard(index)  // -> {ok:true} | {ok:false, reason:'energy'|'target'|'heat'}
DD.Combat.endTurn()
DD.Combat.target          // index of the selected enemy
DD.Combat.selectTarget(i)
DD.Combat.update(dt)       // advances animations/timers; call once per frame
DD.Combat.flee()           // -> true if the escape roll succeeded
```
Encounter state:
```js
{
  turn:1, energy:3, maxEnergy:3, block:0,
  hand:[{uid, id, socket}],   // socket = which body socket owns this card (heat target)
  drawPile:[...], discardPile:[...], exhaustPile:[...],
  enemies:[ {i, id, name, hp, maxHp, block, sprite, intents, intent, status:{}, dead:false,
             anim:{shake:0,lunge:0}, heatAttack, drops, tier} ],
  target:0, over:false, result:null,   // result: 'win' | 'lose' | 'flee'
  log:[...], fx:[...],                  // fx = [{kind:'damage'|'block'|'heat'|'heal', v, t, x, y, target}]
  player:{ shake:0, lunge:0, status:{} }
}
```

### 5.6 `DD.Tower` (`src/world/tower.js`)
```js
DD.Tower.generate(seed, floor, floorCount) -> map
```
```js
map = {
  w: 48, h: 36, tiles: Int8Array(w*h), floor: 0,
  rooms: [ {x,y,w,h,type:'lab'|'hall'|'cell'|'vault'|'exit'} ],
  entities: [ {kind,x,y,id,data,dead:false,active:false,timer:0} ],
  start: {x,y},   // player spawn tile (always walkable, in the first room)
  exit:  {x,y}    // DD.TILE_STAIRS on floors < floorCount-1, DD.TILE_EXIT on the last floor
}
```
Tile access helpers: `DD.Tower.at(map,x,y)` -> tile id (returns `DD.TILE_WALL` out of bounds),
`DD.Tower.walkable(map,x,y)` -> boolean. `DD.Tower.relayout(map, seed)` re-carves the
current map in place (used by `DD.Run.shiftFloor()`), keeping `start`, `exit` and every
living entity on a walkable tile.

### 5.7 `DD.Explore` (`src/world/explore.js`) — pure logic, no drawing
```js
DD.Explore.update(dt)                 // movement, trap timers, pickups, entity collision
DD.Explore.tryMove(dx, dy)
DD.Explore.interact()                 // E / tap on the stairs or an altar
DD.Explore.pickupAt(x, y)
DD.Explore.pendingGraft              // limb id waiting for the graft screen, or null
DD.Explore.messages                  // array of {text, t} floating text to be drawn
```

### 5.8 `DD.Deck` (`src/systems/deck.js`)
```js
DD.Deck.build(body)  // -> [{uid, id, socket}] one entry per copy of every card granted by every equipped limb
DD.Deck.stumpCards(socket) // -> array of card ids contributed by a stump socket
```

### 5.9 `DD.Heat` (`src/systems/heat.js`)
```js
DD.Heat.add(socket, amount)     // applies heatResist, overheat damage, breakage; logs to DD.Run.state.log
DD.Heat.overheatCheck(socket)
DD.Heat.frac(socket)            // 0..1 heat fraction for the HUD
DD.Heat.tier(socket)            // 0 calm, 1 warm, 2 hot, 3 critical
```
Rules: heat is clamped to `heatCap`. On reaching `heatCap`: the limb loses **8 integrity**,
heat drops to `heatCap * 0.5`, the player takes **4 damage**, and `sfx:'overheat'` plays.
On integrity reaching 0: the socket breaks (`DD.Body.breakSocket`), the associated cards
leave the deck, `stats.lost++`, and the socket becomes a stump.

### 5.10 `DD.Progress` (`src/systems/progress.js`)
```js
DD.Progress.discoverLimb(id) / discoverEnemy(id)
DD.Progress.knownLimb(id) / knownEnemy(id)
DD.Progress.unlockCosmetic(id) / equipCosmetic(id)
DD.Progress.cosmetic()          // -> the equipped cosmetic object
DD.Progress.addShards(n)
DD.Progress.recordRun(result)   // 'escaped' | 'dead' | 'timedout'
```

---

## 6. Presentation contracts

### 6.1 `DD.Pixel` (`src/render/pixel.js`) — the only drawing API
```js
DD.Pixel.build()                       // idempotent; builds sprite atlases. Called once at boot.
DD.Pixel.sprite(key, x, y, opts)       // opts: {flip, alpha, scale, palette:[c1,c2,c3], flash:0..1, rot?}
DD.Pixel.hasSprite(key)
DD.Pixel.rect(x,y,w,h,color)
DD.Pixel.frame(x,y,w,h,color)          // 1px outline
DD.Pixel.panel(x,y,w,h,opts)           // opts:{fill,border,accent,title,scale}
DD.Pixel.bar(x,y,w,h,frac,opts)        // opts:{fg,bg,border,vertical}
DD.Pixel.text(str,x,y,opts)            // opts:{scale,color,align:'left'|'center'|'right',shadow,wrap,lineH,max}
DD.Pixel.textW(str,scale)
DD.Pixel.wrap(str,maxW,scale)          // -> [lines]
DD.Pixel.clipPush(x,y,w,h) / DD.Pixel.clipPop()
DD.Pixel.dim(x,y,w,h,alpha,color)      // translucent overlay
DD.Pixel.setColor(c)
```

### 6.2 `DD.Sprites` / `DD.Avatar` / `DD.Font` (data only)
`src/render/sprites.js` fills `DD.Sprites`. `src/render/avatar.js` fills `DD.Avatar` and
`DD.Font`. `DD.Font` is `{char: [7 strings of 5 chars]}` over `A-Z a-z 0-9` plus
`. , : ; ! ? ' " ( ) [ ] { } - + / \ % < > = * # @ & _ ~ ^ |` and
`Á É Í Ó Ú Ü Ñ á é í ó ú ü ñ ¿ ¡ °` and `space`. `'#'` = ink, `'.'` = transparent.

### 6.7 Views (`src/render/`) — frozen API the glue scenes call
`hud.js` creates `var DD.View = DD.View || {hud:{}, explore:{}, combat:{}, ui:{}}`; the other
three view files extend it. Everything draws against `DD.Canvas.ctx` through `DD.Pixel`,
reading game state from `DD.Run.state` directly (no parameters they do not need).
```js
DD.View.hud.draw()                        // clock, HP, energy, residue, body diagram, log ticker
DD.View.hud.drawClock(x, y, secs, warn)   // clock face + hands, warn=true when < 60s
DD.View.hud.drawBody(x, y, opts)          // 6-socket anatomical diagram. opts:{selected, scale, showCards}
DD.View.hud.socketRect(socket, x, y)      // -> {x,y,w,h} hit box of a socket in the diagram
DD.View.hud.ticker()                      // the last log lines

DD.View.explore.draw()                    // map, entities, traps, player, floaters, shift warning
DD.View.explore.drawMinimap(x, y, w, h)
DD.View.explore.camera                    // {x, y} camera offset in world pixels (read-only for others)

DD.View.combat.draw()                     // background, enemies, player, hand, draw/discard piles, intents
DD.View.combat.handRect(i)                // -> {x,y,w,h} of hand slot i, for hit testing
DD.View.combat.drawCard(card, x, y, opts) // one card face. opts:{selected, playable, scale}
DD.View.combat.anim                       // {shake, flash} timers owned by the view

DD.View.ui.bg()                           // dim gothic backdrop for menu-like scenes
DD.View.ui.title(sub)                     // the game logo + optional subtitle
DD.View.ui.menu(items, index, opts)       // vertical menu, returns nothing. opts:{x,y,w,hint}
DD.View.ui.cardFull(card, x, y, opts)     // large card face for the codex / reward screens
DD.View.ui.limbCard(limb, x, y, opts)     // limb blueprint card
DD.View.ui.graft()                        // graft screen; reads DD.Explore.pendingGraft + DD.Run.state.body
DD.View.ui.codex(tab, scroll)             // blueprint codex; tab: 'limbs' | 'enemies' | 'help'
DD.View.ui.shop(selected, scroll)         // cosmetics shop
DD.View.ui.end(result)                    // 'dead' | 'timedout' | 'escaped' full-screen result
DD.View.ui.pause(items, index)            // pause overlay
```
Hit testing for menus is done by the scene with `DD.Input.pointer`; `DD.View.ui.menu`
draws `items` (array of strings) and highlights `index`.

### 6.3 `DD.Audio` (`src/audio/music.js` + `src/audio/sfx.js`)
```js
DD.Audio.init()                    // must be called from a user gesture; safe to call repeatedly
DD.Audio.music.play(track)         // 'menu' | 'explore' | 'combat' | 'death' | 'escape'
DD.Audio.music.stop()
DD.Audio.music.setIntensity(v)     // 0..1, adds layers (used as the clock runs down)
DD.Audio.sfx.play(name, opts)      // opts:{vol, rate}
DD.Audio.setVolume(music, sfx)
DD.Audio.muted
```
SFX names: `step, hit, hit_heavy, block, card, card_play, draw, graft, squish, break,
overheat, growl, death, pickup, trap, door, escape, alarm, ui_move, ui_select, tick,
heartbeat, loot, levelup`.
Music must be **generated with oscillators/noise**, no samples: an ominous synth score.

### 6.4 Scenes (`src/core/scenes.js`)
A scene is `{ transparent:false, enter(p), exit(), update(dt), draw(), key(e), pointer(e) }`.
```js
DD.Scenes.define(name, scene)
DD.Scenes.replace(name, params)   // clears the stack
DD.Scenes.push(name, params)
DD.Scenes.pop()
DD.Scenes.top()                   // the active scene object
DD.Scenes.name                    // active scene name
DD.Scenes.has(name)
```
Only the top scene updates. The top scene draws; if it is `transparent`, the scene below
it draws first.

### 6.5 Scene names (frozen)
```
boot, menu, run, graft, codex, shop, pause, end
```

### 6.6 `DD.Input` (`src/core/input.js`)
```js
DD.Input.axis()                       // {x,y} in -1..1 from WASD / arrows / gamepad / dpad
DD.Input.down(code)                   // held, e.g. 'KeyE'
DD.Input.pressed(code)                // edge this frame
DD.Input.anyPressed()                 // any key/mouse/touch edge
DD.Input.pointer                      // {x,y,down,justDown,justUp}
DD.Input.button(id,x,y,w,h,label)     // on-screen virtual button; true on the frame it is activated. Handles mouse+touch, draws nothing
DD.Input.setVirtualEnabled(bool)      // touch controls on/off (auto-enabled on touch devices)
DD.Input.virtual                      // true when on-screen controls should be drawn
```
Virtual button ids used by the explore scene: `vup, vdown, vleft, vright, vact`.
Keyboard defaults: move `WASD`/arrows, interact `E`, end turn `Space`, pause `Escape`,
codex `Tab`, confirm `Enter`, cancel `Backspace`.

---

## 7. Gameplay numbers (do not change without a reason)

- Clock: **360 seconds** for the whole run, running during exploration *and* combat.
- Floors per run: **4**. Stairs up on floors 0-2, the escape door on floor 3.
- Player: base **60 HP**, 3 energy, 5 cards drawn per turn, hand limit 8.
- Combat: 1-3 enemies, drawn from the enemy pool weighted by floor.
- Procedural shift: every **60 s** the current floor re-lays itself out (`shiftWarn` 3 s
  before, `sfx:'alarm'`, music intensity up). The player keeps their position.
- Starting body: 6 tier-1 limbs, random per run ("a new base body").
- Enemy drops: `dropChance` for one limb, plus one guaranteed limb on the boss.
- Residue is spent at the **altar** (`prop_altar` entity) to repair integrity, cool heat,
  or heal.

---

## 8. File ownership (do not write outside your list)

| Owner | Files |
|---|---|
| core | `index.html`, `styles.css`, `src/core/*.js`, `src/render/pixel.js`, `src/run.js` |
| anatomy | `src/data/limbs.js`, `src/data/cards.js` |
| bestiary | `src/data/enemies.js`, `src/data/traps.js`, `src/data/resources.js`, `src/data/cosmetics.js` |
| systems | `src/systems/body.js`, `deck.js`, `heat.js`, `combat.js`, `progress.js` |
| world | `src/world/tower.js`, `src/world/explore.js` |
| art-world | `src/render/sprites.js` |
| art-avatar | `src/render/avatar.js`, `src/render/font.js` |
| audio | `src/audio/music.js`, `src/audio/sfx.js` |
| view-combat | `src/render/hud.js`, `src/render/scene-combat.js` |
| view-world | `src/render/scene-explore.js`, `src/render/scene-ui.js` |
| glue | `src/scenes/*.js`, `src/main.js` |
