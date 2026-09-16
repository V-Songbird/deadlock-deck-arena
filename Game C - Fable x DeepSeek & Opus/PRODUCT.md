# Deadlock Deck: El Reloj Anatómico — product brief and contract

This file is the contract every worker builds against. Read it whole before touching code.

## 1. What we are building

A small browser game: vanilla JavaScript, HTML5 canvas for pixel art, DOM for cards/buttons,
Web Audio for synthesized sound. **No build step, no dependencies, no tests, no ES modules,
no network.** `index.html` must work when opened straight from disk (`file://`) on PC
(keyboard + mouse) and on mobile (touch). Code, comments and identifiers are English;
every player-facing string is Spanish.

Concept (all of it must exist in the game):

- You are a freshly reanimated abomination in a collapsing alchemical laboratory. You have
  exactly **6 minutes** to escape the burning tower.
- **Anatomical deck-building.** The deck is your body: head, torso, two arms, two legs. Each
  grafted limb brings its own cards. Changing limbs changes the deck.
- **Thermal degradation.** Powerful cards overheat the limb that plays them. A limb that reaches
  its heat limit breaks: its cards leave the deck and you fight with a stump until you graft a
  replacement.
- **6-minute death loop.** Die or run out of time and your spirit wakes on a new dissection
  table with a new base body. Discovered anatomical blueprints are kept; the tower is generated
  again procedurally.
- Objectives: **explore** the procedural corridors (resources, traps), **fight** fast turn-based
  card combats, **harvest** limbs from fallen enemies (monstrosities and corrupt scientists),
  **escape** through the exit before the clock hits zero.
- Style: gothic alchemical pixel art. Sound: ominous synthesized soundtrack, guttural SFX.
- Platforms: PC and mobile through the browser (console builds are out of scope for this
  prototype). Monetization: free game with a **simulated** in-game shop (no real money) selling
  cosmetics and content unlocks, paid with essence earned in runs.

## 2. Files and ownership

| File | Global | Owner | Purpose |
|---|---|---|---|
| `index.html` | — | orchestrator (UI may edit) | shell, script order |
| `style.css` | — | UI | all styling |
| `js/data.js` | `DATA` | DATA | constants, cards, limbs (blueprints), enemies, base bodies, resources, shop items |
| `js/sprites.js` | `Sprites` | SPRITES | procedural pixel art, creature composition, tints |
| `js/audio.js` | `Snd` | AUDIO | synthesized music loops and SFX |
| `js/body.js` | `Body` | BODY | body = deck; heat, breaking, grafting |
| `js/tower.js` | `Tower` | TOWER | procedural floors, mazes, shifting, population |
| `js/combat.js` | `Combat` | COMBAT | turn-based card combat engine |
| `js/game.js` | `Game` | GAME | state machine, clock, death loop, harvest, shop, persistence |
| `js/ui.js` | `UI` | UI | canvas rendering, DOM panel, keyboard/mouse/touch input |

Load order (plain `<script>` tags, already in `index.html`): data, sprites, audio, body, tower,
combat, game, ui. Each file declares exactly one top-level `const` with the global's name.
Dependencies point only leftwards in that list; `Game` never calls `UI`; `UI` reads `Game.G`
and calls `Game.*` actions.

Every stub in `js/` already carries the exported names, signatures and JSDoc. **Keep every name
and signature; replace the bodies.** You may add private helpers inside your own file.

## 3. Shared constants (in `DATA`)

```
RUN_SECONDS 360   SHIFT_SECONDS 45   HAND_SIZE 5   ENERGY 3   BASE_HP 30
TRAP_DAMAGE 5     TRAP_HEAT 2        COOL_PER_TURN 1
FLOORS 3          FLOOR_W 7          FLOOR_H 7
SLOTS ['head','torso','armL','armR','legL','legR']      slotType(slot) -> 'head'|'torso'|'arm'|'leg'
STUMP_CARD 'munon'
ROOM { EMPTY:'empty', START:'start', ENEMY:'enemy', RESOURCE:'resource', TRAP:'trap', STAIRS:'stairs', EXIT:'exit' }
FLOOR_POP [{enemies:4,resources:3,traps:2},{enemies:5,resources:3,traps:3},{enemies:6,resources:3,traps:3}]
```

## 4. Data shapes (`js/data.js`)

### 4.1 Card `DATA.cards[id]`

```
{ id, name, desc, cost (0..3 energy), heat (0..3), fx }
fx (every key optional, non-negative integers):
  dmg      damage to the enemy            hits    times dmg is dealt (default 1)
  block    block gained by the player     heal    HP restored to the player
  draw     cards drawn                    energy  energy gained this turn
  cool     heat removed from EVERY limb (99 = cool fully)
  vuln     turns of Vulnerable on the enemy (takes +50%)
  weak     turns of Weak on the enemy (deals -50%)
  poison   poison stacks added to the enemy
  stun     turns the enemy skips
  selfDmg  HP the player loses (ignores block)
```

`DATA.cards.munon` is the stump card: `{cost:1, heat:0, fx:{dmg:2}}`. Stumps never overheat.

### 4.2 Limb (anatomical blueprint) `DATA.limbs[id]`

```
{ id, name, type:'head'|'torso'|'arm'|'leg', desc, cards:[cardId, ...] (2 or 3, duplicates allowed),
  maxHeat (4..9), hp (extra max HP; torsos 5..15, everything else 0..3), sprite, tier: 0|1|2 }
```

`sprite` must be one of `DATA.SPRITE_KEYS[type]`. Tier 0 = base cadaver parts (weak, 0 heat
cards mostly); tier 1 = common enemy parts; tier 2 = rare parts (strong cards with heat 2..3).

### 4.3 Enemy `DATA.enemies[id]`

```
{ id, name, hp (10..40), limbs:{head,torso,armL,armR,legL,legR} (limb ids; a slot may be null),
  intents:[ {kind:'attack', value, hits?} | {kind:'block', value} | {kind:'heal', value}
          | {kind:'poison', value} | {kind:'weak', value} ],   // cycled in order, one per turn
  essence (3..10), floorMin (0..2) }
```

Harvesting a defeated enemy offers its non-null limbs.

### 4.4 Other tables

```
DATA.baseBodies   [ { name, slots:{head,torso,armL,armR,legL,legR} } ]  tier-0 limbs only, >= 3 bodies
DATA.resources    { vial_vida:{fx:{heal:8}}, vial_frio:{fx:{cool:99}}, esencia:{fx:{essence:5}}, pergamino:{fx:{blueprint:1}} }
                  each: { id, name, desc, fx, weight }   (weight = spawn weight)
DATA.cosmetics    { id: { id, name, desc, price, tint } }   tint is a Sprites.TINTS key; 'default' is owned from the start
DATA.unlocks      { id: { id, name, desc, price, limbs:[limbIds] } }   buying adds those limbs to the discovered blueprints
DATA.SPRITE_KEYS  { head:[...], torso:[...], arm:[...], leg:[...] }   see §9
```

## 5. Module contracts

The JSDoc in each stub is normative. Summary of the state objects:

### 5.1 Body (`Body.create(slots)`)

```
body = { slots: { head: limb|null, torso: ..., armL, armR, legL, legR }, hp, maxHp }
limb = { id, heat, broken }        // broken:true = stump that still shows the old limb name
```

- `maxHp = DATA.BASE_HP + sum(hp of healthy limbs)`.
- `graft(body, slot, limbId)`: new limb with heat 0, `broken:false`; `maxHp` recomputed; `hp` moves
  by the same difference and stays >= 1; returns the removed limb (or null).
- `cardsOf(body)`: `[{cardId, slot}]` — every healthy limb's `cards`, plus one `{cardId:DATA.STUMP_CARD, slot}` per
  stump slot (null or broken).
- `addHeat(body, slot, amount)`: returns `{broke, heat, max}`; sets `broken:true` when `heat >= maxHeat`;
  stumps ignore heat and return `broke:false`.
- `cool(body, amount)`: healthy limbs only, floor at 0.
- `spriteSlots(body)`: `{slot: limbId|null}` with null for stumps (input for `Sprites.creature`).
- `heatRatio(body, slot)`: `heat / maxHeat` clamped 0..1, 0 for stumps.

### 5.2 Tower (`Tower.generate()`)

```
tower = { floors: [F, F, F] }
F     = { index, w, h, cells: cells[y][x], start:{x,y}, exit:{x,y} }
cell  = { x, y, type: DATA.ROOM.*, walls:{n,e,s,w} (true = wall), content: enemyId|resourceId|null,
          visited:false, seen:false }
```

- Perfect maze per floor by recursive backtracker, then remove ~15% of the remaining inner walls
  to create loops. `start` is a random cell on the bottom row (type START); the cell with the
  greatest BFS distance from start is STAIRS (floors 0..FLOORS-2) or EXIT (last floor).
- Population from `DATA.FLOOR_POP[index]` on random EMPTY cells: enemies via `pickEnemy(index)`
  (content = enemy id), resources by `DATA.resources[*].weight` (content = resource id),
  traps (content null).
- `canMove(F, x, y, dir)`: target inside bounds and no wall on that side.
- `reveal(F, x, y)`: cell visited; every cell within Chebyshev distance 1 gets `seen:true`.
- `shift(F)`: carve a brand-new maze into the same cells (walls only). Types, contents, visited,
  seen, start and exit are untouched. A perfect maze keeps every cell reachable.
- `spawnEnemy(F, px, py)`: random EMPTY, unvisited cell that is not (px,py) becomes ENEMY with
  `pickEnemy(F.index)`; returns the cell or null.

### 5.3 Combat (`Combat.start(body, enemyId)`)

```
C = { body,                                   // the player's Body object, mutated in place (hp, heat, breaks)
      enemy: { id, name, hp, maxHp, block, status:{vuln,weak,poison,stun}, limbs, intents, step },
      player: { block, energy, status:{vuln,weak,poison,stun} },
      deck:[], hand:[], discard:[],           // entries { uid, cardId, slot }
      turn, phase:'player'|'won'|'lost', loot:[limbIds], essence, log:[string] }
```

- `start`: deck = shuffled `Body.cardsOf(body)`, energy = `DATA.ENERGY`, draw `DATA.HAND_SIZE`.
- `canPlay(C, i)`: phase is 'player', hand[i] exists, `cost <= energy`.
- `play(C, i)`: pay cost, move the entry to discard, apply `fx` in this order: dmg×hits,
  block, heal, draw, energy, cool, vuln, weak, poison, stun, selfDmg. Then
  `Body.addHeat(body, entry.slot, card.heat)`; on `broke`: remove every deck/hand/discard entry
  with that slot, push `{cardId:DATA.STUMP_CARD, slot}` into discard, event `break`.
  Enemy hp <= 0 → phase 'won', `loot` = enemy's non-null limb ids, `essence` = enemy essence.
  Player hp <= 0 (selfDmg) → 'lost'. Returns an array of events.
- `endTurn(C)`: discard the hand. Enemy turn: poison ticks on the enemy (hp -= poison, poison -= 1);
  if enemy hp <= 0 → 'won'. If `stun > 0`: stun -= 1, no action; else apply intent `step`
  (attack: `damage(value, enemy, player)` per hit minus player block; block: enemy block += value;
  heal: hp up to maxHp; poison: player poison += value; weak: player weak += value) and advance
  `step` cyclically. Enemy `vuln`/`weak` -= 1 (floor 0). Player hp <= 0 → 'lost'.
  Then the new player turn: player block = 0, player poison ticks, `Body.cool(body, DATA.COOL_PER_TURN)`,
  energy = `DATA.ENERGY`, player `vuln`/`weak` -= 1, draw `DATA.HAND_SIZE` (reshuffle discard into
  the deck when it runs dry), enemy block = 0 at the start of the enemy's own next turn, turn += 1.
- `damage(base, attacker, target)`: `floor(base * (attacker.status.weak > 0 ? 0.5 : 1) * (target.status.vuln > 0 ? 1.5 : 1))`.
  Block absorbs first; the rest hits hp.
- `intent(C)`: `{kind, value, hits, text}` with Spanish `text`: `Ataca 7`, `Ataca 3×2`, `Se protege 5`,
  `Se cose 4`, `Envenena 3`, `Debilita 2`.
- Events: `{type:'play', cardId, slot}`, `{type:'hit', target:'enemy'|'player', amount}`,
  `{type:'block', target}`, `{type:'heal', amount}`, `{type:'cool'}`, `{type:'break', slot, limbId}`,
  `{type:'enemyAct', kind, value}`, `{type:'won'}`, `{type:'lost'}`. `C.log` keeps the last 8
  Spanish lines describing what happened (for the UI).

### 5.4 Game state `Game.G`

```
G = {
  screen: 'title'|'table'|'shop'|'explore'|'combat'|'harvest'|'death'|'escape',
  meta: { discovered:[limbIds], essence, cosmetics:['default', ...], unlocks:[ids], tint:'default',
          escapes, runs, muted },                          // persisted in localStorage key 'deadlock-deck'
  table: { baseName, slots:{slot: limbId}, options:{slot: [limbIds]} } | null,
  body, tower, floor, pos:{x,y},
  timeLeft (seconds, float), shiftIn (seconds, float),
  combat: C | null,
  harvest: { limbs:[limbIds], essence, enemyName } | null,
  run: { essence, kills, grafts, cause },
  message: { text, ttl } | null
}
```

Actions (all on `Game`): `init`, `newRun`, `tableCycle(slot, dir)`, `rise`, `move(dir)`,
`tick(dt)`, `playCard(i)`, `endTurn`, `harvestPick(limbId, slot)`, `harvestSkip`, `openShop`,
`closeShop`, `buy(id)`, `equip(cosmeticId)`, `toTitle`, `afterEnd`, `toggleMute`, `say(text, ttl)`,
`save`, `die(cause)`, `escape`. `Game` is the only module that calls `Snd.music` / `Snd.sfx`
(except `Snd.sfx('click')` from UI buttons).

## 6. Rules

### 6.1 Dissection table (`newRun`)
- A random `DATA.baseBodies` entry becomes `table.slots`; `table.baseName` is its name.
- `table.options[slot]` = `[base limb id, ...meta.discovered limbs of that slot type]`
  (no duplicates). `tableCycle(slot, ±1)` moves `slots[slot]` through that list.
- `rise()`: `body = Body.create(table.slots)`, `tower = Tower.generate()`, `floor = 0`,
  `pos = floor 0 start`, `Tower.reveal`, `timeLeft = DATA.RUN_SECONDS`, `shiftIn = DATA.SHIFT_SECONDS`,
  `run` reset, `meta.runs += 1`, screen `explore`, `Snd.music('explore')`.

### 6.2 Exploration (`move(dir)`)
- Only on screen `explore`; `Tower.canMove` must be true, else `Snd.sfx('click')` and nothing.
- Enter the cell, `Tower.reveal`, `Snd.sfx('step')`, then by cell type:
  - ENEMY: `combat = Combat.start(body, content)`, screen `combat`, `Snd.music('combat')`.
  - RESOURCE: apply fx (`heal` → hp up to maxHp; `cool` → `Body.cool`; `essence` → `run.essence`;
    `blueprint` → a random undiscovered limb (tier >= 1) joins `meta.discovered`, or +10 essence when
    none is left); cell becomes EMPTY; `say` what happened; `Snd.sfx('pickup')`.
  - TRAP: `hp -= DATA.TRAP_DAMAGE`, `Body.addHeat` `DATA.TRAP_HEAT` on legL and legR (breaks are
    possible and announced); cell becomes EMPTY; `Snd.sfx('trap')`; hp <= 0 → `die('una trampa')`.
  - STAIRS: `floor += 1`, `pos` = that floor's start, reveal, `say('Subes al piso N')`, `Snd.sfx('stairs')`.
  - EXIT: `escape()`.

### 6.3 The clock (`tick(dt)`)
- Clamp `dt` to 0.1 s. `timeLeft` runs down on screens `explore`, `combat`, `harvest`; at 0 →
  `die('el reloj')`. `Snd.sfx('tick')` once per whole second while `timeLeft < 30`.
- On `explore` only: `shiftIn -= dt`; at 0 → `Tower.shift(current floor)`, `Tower.spawnEnemy`,
  `say('¡El laberinto se retuerce!')`, `Snd.sfx('shift')`, `shiftIn = DATA.SHIFT_SECONDS`.
- `message.ttl -= dt`; drop it at 0.

### 6.4 Combat (`playCard`, `endTurn`)
- Delegate to `Combat`; map events to SFX: play → `card`, hit on enemy → `hit`, hit on player →
  `hurt`, enemyAct attack → `growl`, break → `break`, heal → `heal`, cool → `cool`.
- Phase `won`: `run.kills += 1`, `run.essence += essence`, the cell becomes EMPTY,
  `harvest = {limbs, essence, enemyName}`, screen `harvest`. Phase `lost`: `die(enemy name)`.

### 6.5 Harvest
- `harvestPick(limbId, slot)`: `slot` must match the limb type; `Body.graft`; `run.grafts += 1`;
  add `limbId` to `meta.discovered` if new; `Snd.sfx('graft')`; screen `explore`, `Snd.music('explore')`.
- `harvestSkip()`: screen `explore`.

### 6.6 Death and escape
- `die(cause)`: `run.cause = cause`, `meta.essence += run.essence`, save, screen `death`,
  `Snd.sfx('death')`, `Snd.music('off')`.
- `escape()`: `meta.escapes += 1`, `meta.essence += run.essence`, save, screen `escape`,
  `Snd.sfx('escape')`, `Snd.music('title')`.
- `afterEnd()`: from `death`/`escape` → `newRun()` (new base body, blueprints kept, tower regenerated).

### 6.7 Shop (simulated purchases)
- `openShop` from `table` → screen `shop`; `closeShop` → `table` (options refreshed, since unlocks may
  have added blueprints). `buy(id)`: enough essence → subtract, add to `meta.cosmetics` or apply the
  unlock's limbs to `meta.discovered` + `meta.unlocks`, save, `Snd.sfx('buy')`; otherwise `say('Esencia insuficiente')`.
- `equip(cosmeticId)`: only owned; sets `meta.tint`.

### 6.8 Persistence
`save()` writes `meta` as JSON to `localStorage['deadlock-deck']`; `init()` reads it (missing or
corrupt → defaults). Wrap storage access in try/catch.

## 7. UI (`js/ui.js`, `style.css`)

- `<canvas id="scene" width="320" height="180">` is the pixel scene; scale it with CSS to the
  widest integer multiple that fits the viewport width (min 1×), `image-rendering: pixelated`,
  `ctx.imageSmoothingEnabled = false`. Below it, `<div id="panel">` holds DOM controls. Layout is a
  flex column that works in portrait phone widths (min 360 px) and on desktop. Dark gothic theme:
  near-black background, bone/verdigris/brass accents, monospace font.
- `UI.start()`: binds keyboard (`WASD`/arrows move, `1..5` play card, `E`/`Space` end turn,
  `Enter` confirm/primary button, `M` mute), pointer events on DOM buttons, first
  `pointerdown`/`keydown` calls `Snd.init()`. rAF loop: `Game.tick(dt)` then `UI.render()`.
  Rebuild the panel DOM only when screen or relevant state changes (keep a signature string) so
  buttons stay tappable.
- Per screen:
  - **title**: canvas title art (flames, the creature on a table), game name, `Despertar`
    (`Game.newRun`), runs/escapes, mute button.
  - **table**: canvas shows `Sprites.creature(table.slots, meta.tint)` on the dissection table;
    panel lists the six slots (`DATA.SLOT_NAMES`), limb name, its cards, `◀`/`▶` buttons
    (`Game.tableCycle`), the base body name, `Levantarse` (`Game.rise`), `Tienda` (`Game.openShop`).
  - **shop**: essence balance, subtitle `Compras simuladas: sin dinero real.`, cosmetics with
    `Comprar`/`Equipar`/`Equipado`, unlocks with `Comprar`/`Desbloqueado`, `Volver`.
  - **explore**: canvas draws the floor map (16 px tiles; unseen cells as fog; seen cells show
    walls, traps, resources, enemy markers, stairs/exit; the player creature drawn small on its
    cell), the anatomical clock (analog face with a bone hand plus `mm:ss`), floor `Piso N/3`,
    HP, essence, and a flame border whose intensity grows as `timeLeft` falls (pulsing red under
    30 s). Panel: d-pad buttons for touch, body strip (six slots with heat bars; stumps labelled
    `Muñón`), the `message`, mute.
  - **combat**: canvas draws the player creature left, the enemy creature right
    (`Sprites.creature(enemy.limbs, 'default')`), HP/block numbers, status icons, the enemy intent
    text, the clock. Panel: hand as card buttons (name, cost, heat, desc, slot colour; disabled when
    not playable), energy, `Terminar turno`, body strip, last log lines.
  - **harvest**: `Cosecha de <enemy>`: one row per offered limb (limb icon, name, type, cards,
    maxHeat), `Injertar` (arms/legs: `Izq`/`Der`) → `Game.harvestPick`, `Seguir sin injertar`.
  - **death**: `Has muerto: <cause>` or `El reloj llegó a cero`, run stats, `Volver a la mesa`.
  - **escape**: `¡Has escapado de la torre!`, time left, essence, `Volver a la mesa`.
- Buttons are real `<button>` elements with visible focus; minimum touch size 40 px.

## 8. Content spec for DATA

- ≥ 45 cards, ≥ 26 limbs (heads ≥ 6, torsos ≥ 5, arms ≥ 8, legs ≥ 7) across tiers 0/1/2,
  8 enemies (`floorMin` 0: 3, 1: 3, 2: 2), 3 base bodies, 4 resources, 4 cosmetics (`verdigris`,
  `ash`, `blood`, `gold` tints), 2 unlock packs of 3 tier-2 limbs each.
- Enemies are built from limbs in the table, e.g. `rata_sutura`, `homunculo`, `cientifico`,
  `perro_quirurgico`, `alquimista`, `golem_carne`, `cuervo_mecanico`, `cirujano_mayor`.
- Ids: lowercase ASCII with underscores, no accents. Names/descs: Spanish, gothic-alchemical flavour.
- Balance: base-body cards cost 1 with heat 0–1 and 3–5 dmg / block; tier 1 heat 1–2; tier 2
  heat 2–3 with big effects (10+ dmg, stun, cool). Every tier-0 limb has maxHeat ≥ 6.

## 9. Sprites spec (`js/sprites.js`)

- Palette `Sprites.PAL` (char → colour), gothic alchemical: near-black, dark purple, bone,
  sickly skin, blood, verdigris, brass, fire orange/yellow, iron grey, acid green.
- `Sprites.TINTS`: `default`, `verdigris`, `ash`, `blood`, `gold` — each replaces the two skin
  colours used by limb pieces.
- `Sprites.get(name)` 16×16 canvases: `floor`, `wall`, `fog`, `start`, `stairs`, `exit`, `trap`,
  `fire`, `vial_vida`, `vial_frio`, `esencia`, `pergamino`, `enemy`, `heart`, `heat`, `energy`,
  `clock`, `skull`, `stump`, `card`, `table`.
- `Sprites.limb(spriteKey)` 16×16 icon for lists; `Sprites.creature(slots, tint)` 32×40 canvas
  composed from the limb pieces (`DATA.limbs[id].sprite`), stumps drawn as bandaged stubs. Both
  cached by key.
- `DATA.SPRITE_KEYS` (draw all of them):
  - head: `head_skull head_crow head_jar head_helm head_hound head_scholar head_rat`
  - torso: `torso_stitch torso_brass torso_barrel torso_ribcage torso_robe torso_fur`
  - arm: `arm_bone arm_claw arm_saw arm_tentacle arm_brass arm_needle arm_scholar arm_paw`
  - leg: `leg_bone leg_hoof leg_spring leg_wheel leg_hound leg_scholar leg_rat`

## 10. Audio spec (`js/audio.js`)

- `Snd.init()` creates/resumes one `AudioContext` (must be called from a user gesture; safe to
  call again). Everything is synthesized: no files.
- `Snd.music(mode)`: `title`, `table`, `explore`, `combat`, `off`. Ominous loops: low detuned
  drone, slow minor arpeggio, filtered noise swells, a sparse percussive pulse (faster and
  louder in `combat`). Switching modes stops the previous loop within ~1 s.
- `Snd.sfx(name)`: `click`, `card`, `hit`, `hurt`, `growl`, `break`, `graft`, `pickup`, `trap`,
  `step`, `stairs`, `tick`, `shift`, `death`, `escape`, `buy`, `heal`, `cool`. Guttural: growls,
  crunches and squelches from low oscillators with pitch drops, waveshaper distortion and
  filtered noise bursts.
- `Snd.setMuted(flag)` silences everything (master gain 0) without stopping the clock.

## 11. Definition of done (every worker)

1. `node --check js/<your file>.js` passes for every file you own.
2. Pure-logic files (body, tower, combat, game) were exercised with a throwaway node script that
   concatenates `js/data.js` and your file(s) and calls the API, e.g.
   `node -e "const fs=require('fs');eval(['js/data.js','js/body.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n')+';console.log(Body.create({}))')"`.
   Delete the script afterwards; no test files in the repo.
3. Every stub name and signature still exists; no new globals; no dependencies; no modules.
4. Final message is a report: files changed, commands run and their results, decisions taken
   (anything PRODUCT.md left open), known gaps.
