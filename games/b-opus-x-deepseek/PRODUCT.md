# Deadlock Deck: El Reloj Anatómico — product brief

Single source of truth for every worker. Read this file completely before writing code.
Nobody will answer questions. When something is ambiguous, pick the option most consistent
with this document and list the decision in your final report.

## 1. Concept (do not drop any of this)

You are a freshly reanimated abomination in an alchemical laboratory tower that is burning
down. You have exactly **6 minutes** to escape. The tower is a shifting, procedurally
generated maze full of monstrosities and corrupt scientists. Your only hope is to harvest
body parts from fallen enemies and graft them onto yourself to gain new abilities and escape
before the clock runs out.

Mandatory mechanics, all of which must exist in the shipped game:

1. **Anatomical deck building** — the deck is the body. Six slots: `head`, `torso`, `armL`,
   `armR`, `legL`, `legR`. Each grafted limb contributes its own cards. Changing limbs
   changes the play style.
2. **Thermal degradation** — playing powerful cards overheats the limb that provided them.
   When a limb's heat reaches its integrity it **breaks**: its cards leave the deck
   immediately (deck, hand and discard) and a weak stump card replaces them until the player
   grafts a replacement.
3. **6-minute death/reset loop** — real-time 360 s countdown. On death or timeout the spirit
   wakes on a new dissection slab with a new base body. **Discovered anatomical blueprints
   are kept** (persisted in `localStorage`); the tower regenerates procedurally with a new
   seed.
4. **Explore** — navigate the procedural halls, find caches, avoid traps.
5. **Fight** — fast turn-based card combat driven by the equipped limbs.
6. **Harvest** — defeat enemies, take their limbs, upgrade the deck.
7. **Escape** — reach the exit and defeat its guardian before the clock hits 0:00.

Visual style: **alchemical gothic pixel art** — dark, atmospheric, gothic horror + alchemy +
steampunk. All art is drawn procedurally on a 384×216 canvas scaled up with
`image-rendering: pixelated`. No external image files.

Audio: **ominous synthesized soundtrack** (electronic + orchestral colour) and **guttural
sound effects**, all synthesized with the Web Audio API. No external audio files.

Platforms: it must run in a browser on desktop **and** mobile. Keyboard and touch must both
work. The page must open by double-clicking `index.html` (`file://`), so **classic scripts
and a global namespace only — no ES modules, no bundler, no dependencies, no network calls.**

Target audience: fans of deck builders, roguelikes and survival games.

## 2. Hard constraints

- Stack: plain HTML + CSS + JavaScript (ES2020), one `<canvas>`, DOM for HUD and cards.
- **Zero dependencies.** Never run `npm install`, never add a package, never `fetch()`.
- **No tests, no build step, no framework.** Do not create test files.
- Code, comments and identifiers in **English**. All text the player sees is in **Spanish**.
- Every file attaches to the single global `window.DD` namespace. Load order is fixed by
  `index.html` and must not be changed.
- `index.html` is a contract file. **No worker edits it.** The DOM ids listed in §7 are fixed.
- Touch only the files you own. Never rename or change an exported name defined here.
- Keep it simple. Prefer the shortest code that fully implements the spec.

## 3. Files and ownership

| File | Owner | Global |
|---|---|---|
| `index.html` | orchestrator (nobody edits) | — |
| `PRODUCT.md`, `CLAUDE.md` | orchestrator | — |
| `src/data.js` | DATA worker | `DD.DATA` |
| `src/body.js` | BODY worker | `DD.Body` |
| `src/combat.js` | COMBAT worker | `DD.Combat` |
| `src/tower.js` | TOWER worker | `DD.Tower` |
| `src/render.js` | ART worker | `DD.Render` |
| `src/audio.js` | AUDIO worker | `DD.Audio` |
| `src/ui.js`, `src/styles.css` | UI worker | `DD.UI` |
| `src/game.js` | GAME worker | `DD.Game` |

## 4. Shared state shape

```js
// DD.state — created and owned by game.js, read by everyone.
{
  phase: 'title'|'explore'|'combat'|'harvest'|'slab'|'dead'|'escaped',
  timeLeft: 360,          // seconds, float, counts down in real time, always
  runIndex: 1,            // cycle number, 1-based
  body: Body,
  tower: Tower,
  posId: 'r_2_3',         // current room id
  combat: CombatState|null,
  blueprints: ['arm_cleaver', ...],  // limb ids ever harvested, persisted
  stats: { escapes: 0, bestTimeLeft: 0, kills: 0 },
  message: ''             // short Spanish status line
}

// Body
{
  hp: 30, maxHp: 30,
  slots: {
    head:  { limbId: 'head_vacant'|null, heat: 0, broken: false },
    torso: { ... }, armL: { ... }, armR: { ... }, legL: { ... }, legR: { ... }
  }
}
// broken:true or limbId:null both mean "stump": the slot contributes only its stump card.

// CombatState
{
  enemy: { id, name, hp, maxHp, block, bleed, vulnerable, weak,
           intentIndex, intent /* the resolved intent object for this turn */ },
  energy: 3, maxEnergy: 3,
  block: 0, bleed: 0, vulnerable: 0, weak: 0,   // player statuses (turn counters)
  deck: [Slot], hand: [Slot], discard: [Slot],  // Slot = { cardId, source }
  turn: 1,
  log: [],                 // last ~6 Spanish lines
  over: false,
  result: null,            // 'win' | 'lose'
  harvestAll: false        // set by the `harvest` effect: offer every drop instead of two
}
// Slot.source is the body slot key ('head','armL',...) that provided the card, or null for
// a card with no limb behind it. Heat from a card always goes to Slot.source.
```

## 5. Module contracts

### 5.1 `src/data.js` → `DD.DATA` (pure data, no logic)

```js
DD.DATA = {
  SLOTS: ['head','torso','armL','armR','legL','legR'],
  SLOT_KIND: { head:'head', torso:'torso', armL:'arm', armR:'arm', legL:'leg', legR:'leg' },
  BASE_BODY: { head:'head_vacant', torso:'torso_sewn', armL:'arm_withered',
               armR:'arm_withered', legL:'leg_limping', legR:'leg_limping' },
  BASE_HP: 30,
  RUN_SECONDS: 360,
  LIMBS: { [limbId]: { id, kind:'head'|'torso'|'arm'|'leg', name, integrity, cards:[cardId,cardId],
                       hpBonus:0, tint:'#rrggbb', desc } },
  CARDS: { [cardId]: { id, name, cost, heat, text, effects:[Effect] } },
  STUMPS: { head:'stump_stare', torso:'stump_lurch', arm:'stump_flail', leg:'stump_drag' },
  ENEMIES: { [enemyId]: { id, name, hp, tint, drops:[limbId], intents:[Intent], desc } },
  GUARDIAN: 'brass_porter'   // enemy id that blocks the exit room
}
```

`Effect` is declarative data resolved by `combat.js`. Allowed ops, nothing else:

| op | fields | meaning |
|---|---|---|
| `damage` | `amount` | damage the enemy (after weak/vulnerable modifiers) |
| `block` | `amount` | add player block |
| `heal` | `amount` | heal body hp, capped at `maxHp` |
| `draw` | `amount` | draw cards |
| `energy` | `amount` | gain energy this turn |
| `cool` | `amount` | remove that much heat from **every** limb |
| `bleed` | `amount` | apply bleed stacks to the enemy |
| `vulnerable` | `amount` | apply vulnerable turns to the enemy |
| `weak` | `amount` | apply weak turns to the enemy |
| `stun` | — | enemy skips its next action |
| `harvest` | — | set `harvestAll = true` for this combat |
| `time` | `amount` | give the player back that many seconds of clock |

`Intent` (what an enemy telegraphs and then does):

| type | fields |
|---|---|
| `attack` | `amount` |
| `multi` | `amount`, `times` |
| `block` | `amount` |
| `heat` | `amount` — forces heat onto one random intact player limb |
| `bleed` | `amount` — applies bleed to the player |
| `weak` | `amount` — applies weak to the player |

Enemies cycle `intents` in order, starting at `intentIndex 0`.

**Exact content to implement** (names are the Spanish player-facing strings; ids are fixed):

Limbs — `id | kind | name | integrity | cards`

- `head_vacant | head | Cabeza Vacía | 6 | mirada_turbia, gemido`
- `head_scholar | head | Cráneo del Erudito | 8 | memoria_robada, silaba_prohibida`
- `head_furnace | head | Cabeza-Horno | 12 | sobrepresion, purga_de_vapor`
- `head_hound | head | Testa de Sabueso | 7 | olfato_de_ceniza, dentellada`
- `torso_sewn | torso | Torso Cosido | 8 | costura_tensa, espasmo`
- `torso_brass | torso | Caja Torácica de Latón | 14 | baluarte, pistones` (hpBonus 8)
- `torso_alembic | torso | Torso Alambique | 9 | transmutar, flor_de_acido` (hpBonus 4)
- `torso_wretch | torso | Torso Errante | 10 | retorcerse, tiron_de_injerto` (hpBonus 6)
- `arm_withered | arm | Brazo Marchito | 6 | golpe_seco, agarre`
- `arm_cleaver | arm | Brazo Cuchilla | 8 | tajo, desollar`
- `arm_bellows | arm | Brazo Fuelle | 10 | rafaga, bomba_fria`
- `arm_needle | arm | Brazo Aguja | 7 | sutura, inyeccion`
- `arm_gauntlet | arm | Guantelete de Latón | 12 | martillo, parada`
- `leg_limping | leg | Pierna Renqueante | 6 | patada, paso_torpe`
- `leg_hound | leg | Zanca de Sabueso | 7 | zarpazo, carrera`
- `leg_piston | leg | Pierna de Pistón | 11 | pisoton, impulso_de_vapor`
- `leg_root | leg | Pierna Raíz | 9 | anclaje, raiz_sedienta`

Cards — `id | name | cost | heat | effects`

- `mirada_turbia | Mirada Turbia | 0 | 1 | draw 1`
- `gemido | Gemido | 1 | 2 | damage 4`
- `memoria_robada | Memoria Robada | 1 | 2 | draw 2, energy 1`
- `silaba_prohibida | Sílaba Prohibida | 2 | 4 | damage 9, vulnerable 2`
- `sobrepresion | Sobrepresión | 1 | 5 | damage 11`
- `purga_de_vapor | Purga de Vapor | 0 | 0 | cool 4`
- `olfato_de_ceniza | Olfato de Ceniza | 0 | 1 | draw 1, time 3`
- `dentellada | Dentellada | 1 | 3 | damage 5, bleed 2`
- `costura_tensa | Costura Tensa | 1 | 1 | block 6`
- `espasmo | Espasmo | 1 | 2 | damage 4, block 3`
- `baluarte | Baluarte | 1 | 2 | block 10`
- `pistones | Pistones | 2 | 5 | damage 7, block 7`
- `transmutar | Transmutar | 1 | 3 | heal 7`
- `flor_de_acido | Flor de Ácido | 2 | 4 | damage 4, bleed 4`
- `retorcerse | Retorcerse | 0 | 2 | block 4, draw 1`
- `tiron_de_injerto | Tirón de Injerto | 2 | 4 | damage 8, harvest`
- `golpe_seco | Golpe Seco | 1 | 1 | damage 5`
- `agarre | Agarre | 1 | 2 | damage 3, weak 2`
- `tajo | Tajo | 1 | 2 | damage 8`
- `desollar | Desollar | 2 | 4 | damage 6, harvest`
- `rafaga | Ráfaga | 1 | 3 | damage 7`
- `bomba_fria | Bomba Fría | 0 | 0 | cool 3, energy 1`
- `sutura | Sutura | 1 | 2 | heal 4, block 3`
- `inyeccion | Inyección | 1 | 3 | damage 4, bleed 3`
- `martillo | Martillo | 2 | 5 | damage 13`
- `parada | Parada | 1 | 1 | block 8`
- `patada | Patada | 1 | 2 | damage 4`
- `paso_torpe | Paso Torpe | 0 | 1 | block 3`
- `zarpazo | Zarpazo | 1 | 3 | damage 6, energy 1`
- `carrera | Carrera | 0 | 2 | time 5`
- `pisoton | Pisotón | 2 | 4 | damage 9, stun`
- `impulso_de_vapor | Impulso de Vapor | 1 | 3 | time 8`
- `anclaje | Anclaje | 1 | 2 | block 9`
- `raiz_sedienta | Raíz Sedienta | 1 | 3 | damage 4, heal 4`

Stump cards (cost 0, heat 0, never break):

- `stump_stare | Muñón: Mirada Vacía | block 1, draw 1`
- `stump_lurch | Muñón: Bamboleo | block 2`
- `stump_flail | Muñón: Manotazo | damage 2`
- `stump_drag | Muñón: Arrastre | block 2`

Every card's `text` is a short Spanish description built from its effects, e.g.
`"Inflige 9. Aplica Vulnerable 2."`.

Enemies — `id | name | hp | drops | intents`

- `assistant | Ayudante Suturado | 24 | arm_cleaver, arm_needle, torso_sewn | attack 7, block 5, attack 9`
- `scientist | Científico Corrupto | 20 | head_scholar, arm_needle, torso_alembic | heat 3, attack 6, weak 2, attack 8`
- `homunculus | Homúnculo de Vapor | 30 | head_furnace, arm_bellows, leg_piston | attack 8, heat 4, multi 4×3`
- `ash_hound | Perro de Cenizas | 18 | head_hound, leg_hound | multi 3×2, bleed 3, attack 7`
- `wretch | Torso Errante | 26 | torso_wretch, leg_root | attack 9, block 6, bleed 2`
- `brass_guard | Guardia de Latón | 40 | torso_brass, arm_gauntlet | block 8, attack 12, multi 5×3`
- `brass_porter | Portero de Latón | 55 | torso_brass, arm_gauntlet, leg_piston | attack 11, heat 5, multi 6×3, block 10`

### 5.2 `src/body.js` → `DD.Body`

```js
DD.Body.create(limbIds)            // limbIds: {head, torso, armL, armR, legL, legR}; returns Body
DD.Body.maxHp(body)                // BASE_HP + sum of hpBonus of intact limbs
DD.Body.buildDeck(body)            // -> [{cardId, source}] for every intact limb (2 cards each)
                                   //    and the matching stump card for every broken/empty slot
DD.Body.applyHeat(body, slotKey, amount)  // -> { broken: bool }  clamps heat at integrity
DD.Body.cool(body, amount)         // remove heat from every slot, floor 0; never un-breaks
DD.Body.graft(body, slotKey, limbId) // -> { replaced: limbId|null }  resets heat, clears broken
DD.Body.isStump(body, slotKey)     // broken || limbId === null
DD.Body.limbOf(body, slotKey)      // -> DD.DATA.LIMBS entry or null
DD.Body.intactSlots(body)          // -> [slotKey] of non-stump slots
DD.Body.heatRatio(body, slotKey)   // 0..1, 0 when stump
DD.Body.compatibleSlots(limbId)    // -> [slotKey] where that limb can be grafted
DD.Body.describe(body)             // -> short Spanish one-line summary of the current body
```

Grafting a limb whose `hpBonus` differs adjusts `maxHp` and clamps `hp`.

### 5.3 `src/combat.js` → `DD.Combat`

```js
DD.Combat.start(body, enemyId, rng)        // -> CombatState (shuffles deck, draws 5)
DD.Combat.playCard(state, body, handIndex) // -> { ok: bool, events: [Event] }
DD.Combat.endTurn(state, body)             // -> { events: [Event] } enemy acts, then new player turn
DD.Combat.canPlay(state, handIndex)        // -> bool (enough energy)
DD.Combat.cardOf(slot)                     // -> DD.DATA.CARDS entry for a Slot
```

Rules:

- Player turn: `block` resets to 0, energy resets to `maxEnergy` (3), draw 5, every intact
  limb cools by 1.
- Deck runs out → shuffle the discard back in. Cards from a limb that breaks are purged from
  deck, hand and discard at that instant, and the slot's stump card is added to the discard.
- Playing a card: check energy, pay it, apply effects in order, apply `card.heat` to
  `slot.source` (stump cards have `source: null` and generate no heat), move the card to
  discard.
- Damage to the enemy: `+50%` if enemy is vulnerable, `-33%` if the player is weak; enemy
  block absorbs first. Round down, minimum 0.
- Bleed on the enemy ticks at the start of the enemy's turn and loses one stack.
- Enemy turn: if stunned, skip and clear the stun; else resolve `intent` and advance
  `intentIndex` (wrapping). Enemy block resets at the start of its own action.
- Enemy damage hits player block first, then `body.hp`. Player bleed ticks at the start of
  the player's turn.
- `state.over` with `result:'win'` when the enemy reaches 0 hp, `'lose'` when `body.hp <= 0`.
- Every action pushes a short Spanish line onto `state.log` (keep the last 6).

Events (consumed by `game.js` for audio, screen shake and the clock):

```js
{ type:'damage', target:'enemy'|'player', amount }
{ type:'block',  target:'enemy'|'player', amount }
{ type:'heal',   amount }
{ type:'heat',   slot, amount }
{ type:'break',  slot, limbId }
{ type:'time',   amount }
{ type:'draw',   amount }
{ type:'status', name, target, amount }
{ type:'end',    result:'win'|'lose' }
```

### 5.4 `src/tower.js` → `DD.Tower`

```js
DD.Tower.rng(seed)                  // -> deterministic () => [0,1) (mulberry32 or similar)
DD.Tower.generate(seed)             // -> Tower
DD.Tower.neighbors(tower, roomId)   // -> [{ dir:'n'|'s'|'e'|'w', id }] only through open links
DD.Tower.roomAt(tower, x, y)        // -> Room|null
DD.Tower.reveal(tower, roomId)      // mark visited and reveal its neighbours on the minimap

// Tower
{ seed, w: 5, h: 5, startId, exitId,
  rooms: { 'r_2_3': { id, x, y, type, enemyId, loot, cleared, visited, seen, links: [roomId] } } }
```

- Grid 5×5. Rooms are connected by a random spanning walk plus ~4 extra links, so every room
  is reachable and the layout differs per seed.
- `startId` is a random room; `exitId` is the reachable room with the greatest Manhattan
  distance from the start.
- Types: start room `slab`; exit room `exit` (its `enemyId` is `DD.DATA.GUARDIAN`); then
  6 `combat` (random enemy id excluding `brass_guard` and `brass_porter`), 1 `elite`
  (`brass_guard`), 2 `cache`, 2 `trap`, the rest `empty`.
- `cache.loot` is one of `{kind:'heal', amount:10}`, `{kind:'cool'}` (resets all heat and
  repairs one broken limb into a fresh base limb), `{kind:'blueprint', limbId}` (a random
  limb id — grafting it there and then is offered by `game.js`).
- `trap.loot` is `{kind:'time', amount:-12}` or `{kind:'hp', amount:-6}` — resolved once, then
  `cleared: true`.
- `seen` means "drawn on the minimap"; `visited` means "the player has stood there".

### 5.5 `src/render.js` → `DD.Render`

All drawing is procedural pixel art on the 384×216 backing canvas. Never load an image.

```js
DD.Render.init(canvas)          // grab ctx, set imageSmoothingEnabled = false
DD.Render.resize()              // integer-scale the canvas CSS size to fit its container
DD.Render.draw(state)           // one entry point, dispatches on state.phase, called each frame
DD.Render.shake(strength)       // screen shake, decays on its own
DD.Render.spark(kind)           // 'hit' | 'break' | 'heal' | 'steam' | 'harvest' particle burst
```

Requirements:

- Alchemical gothic palette: bone `#d9cdb4`, rot green `#3f5c46`, verdigris `#4e8c7a`, brass
  `#b08d3f`, ember `#d8622b`, blood `#7a1f22`, void `#0d0b12`, arcane violet `#5b3a72`.
- Explore view: a dark vaulted laboratory room whose props change with `room.type` (slab,
  braziers, cages, pipes, the burning exit gate), flickering light, floating ash particles,
  plus a minimap of the 5×5 grid in a corner showing `seen` rooms, links, the player and the
  exit once seen.
- Combat view: the enemy sprite on the right (procedurally drawn from `enemy.tint` and id,
  with a hp bar, block shield and an intent icon + number above it), the player abomination on
  the left drawn **from the equipped limbs** — each slot uses its limb's `tint`, a broken slot
  is drawn as a bleeding stump, and a hot limb glows toward ember as `heatRatio` rises.
- An anatomy panel is DOM, not canvas (see `DD.UI`), so do not draw heat bars on the canvas.
- Title, death and escape screens: heavy vignette, drifting ash, the game title in a gothic
  block-pixel font drawn from rectangles (no web fonts).
- When `state.timeLeft < 60` push the whole scene toward ember red and increase the flicker.
- Keep the whole file under ~600 lines; helpers over copy-paste.

### 5.6 `src/audio.js` → `DD.Audio`

Web Audio API only. The context must be created/resumed on the first user gesture.

```js
DD.Audio.init()                 // build context + master gain (called from a user gesture)
DD.Audio.setEnabled(on)         // mute toggle; remembers in localStorage key 'dd_sound'
DD.Audio.isEnabled()
DD.Audio.startMusic()           // ominous loop; safe to call twice
DD.Audio.stopMusic()
DD.Audio.setTension(t)          // 0..1 from the clock; raises tempo, adds a heartbeat/pulse
DD.Audio.sfx(name)              // see list; unknown names are ignored, never throw
```

`sfx` names: `hit`, `heavy`, `block`, `hurt`, `heal`, `break`, `steam`, `harvest`, `card`,
`step`, `trap`, `death`, `escape`, `ui`.

Sound design: guttural and wet — noise bursts through a low-pass with fast pitch drops for
flesh impacts, detuned square/saw stabs for brass, filtered noise sweeps for steam. Music:
a slow minor drone with a detuned saw pad, a sparse arpeggio, and a low pulse that speeds up
with tension. Nothing may throw if the browser blocks audio.

### 5.7 `src/ui.js` + `src/styles.css` → `DD.UI`

DOM layer. Owns everything in `index.html` except the canvas. Do not edit `index.html`.

```js
DD.UI.init(handlers)   // handlers: { onPlayCard(i), onEndTurn(), onMove(dir), onToggleSound(),
                       //             onDialogPick(value), onPrimary() }
DD.UI.render(state)    // full refresh of hud, anatomy, hand, energy, bars; called on change
DD.UI.showDialog({ title, body, options: [{ value, label, sub }], cancel })  // options are buttons
DD.UI.hideDialog()
DD.UI.toast(text)      // brief Spanish message
DD.UI.setMode(phase)   // toggles which bars are visible: 'explore' | 'combat' | other
```

- HUD: the clock as `M:SS`, red and pulsing under 60 s; hp bar; cycle number; sound button.
- Anatomy panel: six slots, each showing the limb name, a **heat bar** (`heatRatio`) and a
  broken/stump marker. This is the thermal-degradation readout and must be visible in combat.
- Hand: one button per card showing name, cost, heat and Spanish text. Unaffordable cards look
  disabled. Cards from a hot limb (`heatRatio >= 0.7`) get a warning border. Tap or click
  plays a card; keys `1`–`9` also play, `Espacio`/`Enter` ends the turn.
- Explore bar: four direction buttons for touch, disabled when no link leads that way.
- CSS: alchemical gothic — the §5.5 palette, a dark parchment/iron frame, `image-rendering:
  pixelated` on the canvas, a pixel-ish system font stack (no web fonts). Fully responsive:
  usable at 360×640 portrait and at 1920×1080. Respect `prefers-reduced-motion`. Tap targets
  at least 44 px. Never let the page scroll horizontally.

### 5.8 `src/game.js` → `DD.Game`

The glue: run lifecycle, the real-time clock, input, persistence.

```js
DD.Game.boot()    // called on DOMContentLoaded (game.js registers this itself)
DD.Game.state     // the shared state object from §4
```

Behaviour:

- Title screen first. Any key/tap starts a run and initializes audio (browser gesture rule).
- `requestAnimationFrame` loop: subtract real elapsed seconds from `timeLeft` **in every
  phase except `title`, `dead` and `escaped`**, call `DD.Render.draw(state)`, and push
  `DD.Audio.setTension(1 - timeLeft/360)`.
- `timeLeft <= 0` → death by clock. `body.hp <= 0` → death by damage. Both go to the `dead`
  screen (Spanish flavour text), then a new cycle: `runIndex + 1`, fresh base body, fresh
  tower seed, `timeLeft = 360`, blueprints kept.
- Blueprint persistence: `localStorage` key `dd_save`, JSON `{ blueprints, stats }`. Reading
  or writing it must never throw (wrap in try/catch — `file://` and private windows can fail).
- Entering an uncleared `combat`/`elite`/`exit` room starts combat. Winning marks the room
  cleared and opens harvest.
- **Harvest**: on a win, offer 2 of the enemy's drops (all of them when
  `combat.harvestAll`), each as "graft into <slot>" choices for compatible slots, plus a
  "dejar" option. Grafting adds the limb id to `blueprints` and costs **4 seconds** of clock.
- **Slab room**: at the start of a run, if blueprints exist, let the player graft one
  discovered limb for free. Re-entering the slab room later cools all limbs.
- Cache and trap rooms resolve their `loot` once and show a toast.
- Winning in the `exit` room → `escaped` screen showing the remaining time, the body that
  escaped, and the blueprints collected. Then a new cycle on a keypress.
- Input: arrows/WASD to move, `1`–`9` to play a card, `Espacio`/`Enter` to end the turn or
  confirm, `M` mutes. Every one of these also has a touch control.
- Handle events from `DD.Combat`: `damage`→`sfx('hit')` + `shake`, `break`→`sfx('break')` +
  `spark('break')`, `time`→ add to `timeLeft` (cap at 360), etc.

## 6. Definition of done (per worker)

1. Your files exist, implement everything assigned to you, and change no other file.
2. `node --check <each js file you own>` passes. (No test framework — do not add one.)
3. Every exported name in §5 exists with the documented signature, and nothing you own
   throws when called with the documented arguments.
4. No `import`/`export`/`require`, no network calls, no external assets, no dependencies.
5. Final message is a report: files changed, commands run with results, decisions taken,
   known gaps. Be honest — "blocked" is a valid, useful report.

## 7. `index.html` DOM contract (fixed ids)

```
#app
  header#hud       > #clock-value, #hp-fill, #hp-text, #cycle-text, #btn-sound
  main#stage       > canvas#scene (384x216), #vignette
  section#anatomy  (UI fills it with six .slot children)
  section#combat-bar > #energy-text, #hand, #btn-end-turn, #combat-log
  nav#explore-bar  > #btn-n, #btn-s, #btn-e, #btn-w, #room-label
  #dialog[hidden]  > #dialog-title, #dialog-body, #dialog-options
  #toast[hidden]
```

Script load order in `index.html` (fixed): `data, body, combat, tower, render, audio, ui, game`.
