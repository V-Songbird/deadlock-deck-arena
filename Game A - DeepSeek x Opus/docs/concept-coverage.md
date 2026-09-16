# Concept coverage — Deadlock Deck: El Reloj Anatómico

Every element the design brief names, and where it lives in the build. Written so a
reader can check the brief against the code without reading the whole tree.

## Sinopsis

| Brief | Where |
|---|---|
| Abominación recién reanimada en un laboratorio alquímico | `src/scenes/boot.js` (title card carries the warning + the six-minute rule), `src/data/limbs.js` (`DD.Body.create(1)` assembles a random tier-1 body — "un cuerpo base nuevo" every run) |
| Exactamente 6 minutos para escapar | `src/core/ns.js` `DD.RUN_SECONDS = 360`, `src/run.js` `Run.tick` |
| La torre en llamas | `src/render/sprites.js` (`bg_combat`, `prop_brazier`, `tile_rune`), edge lighting in `src/render/scene-explore.js` |
| Laberinto en constante cambio | `src/world/tower.js` `DD.Tower.relayout`, driven by `Run.shiftFloor` every `DD.SHIFT_SECONDS = 60` with a 3-second warning |
| Monstruosidades y científicos corruptos | `src/data/enemies.js` — 12 enemies including `alchemist`, `plague_nurse`, `stitcher` |
| Recolectar partes y injertarlas | `src/systems/combat.js` writes `DD.Run.state.pendingLoot`; `src/world/explore.js` spawns the limbs; `src/scenes/graft.js` + `DD.Run.graft` sew them on |

## Mecánicas principales

### Construcción de mazos anatómica
- Six sockets, frozen in `src/core/ns.js`: `head, torso, armL, armR, legL, legR`.
- 26 blueprints in `src/data/limbs.js` (6 heads, 6 torsos, 8 arms, 6 legs). Each declares
  `form` (one of `gaunt, bulky, fleshy, mech, spectral`), a three-colour `palette`, its own
  integrity, heat capacity, cooling rate and passive.
- 100 cards in `src/data/cards.js`, three to four per limb.
- The deck **is** the body: `src/systems/deck.js` `DD.Deck.build(body)` returns one entry per
  copy of every card granted by every equipped limb, each tagged with the socket that owns it.
  Change a limb and the deck changes on the next fight.
- Visible, not just mechanical: `src/render/avatar.js` holds 60 part sprites (5 forms x 4
  parts x 3 directions) plus 6 stumps, and both views assemble the player from them using the
  equipped limb's form and palette. `DD.View.hud.drawBody` shows the same body as a diagram.

### Degradación térmica
- `src/systems/heat.js`: every card adds its `heat` to the socket that owns it.
- Reaching `heatCap` costs 8 integrity, resets heat to half, and deals 4 damage to the player;
  `sfx('overheat')` and a Spanish log line.
- Integrity reaching zero breaks the limb: `DD.Body.breakSocket` turns the socket into a stump,
  its cards leave the draw and discard piles, `stats.lost` increments and the socket starts
  contributing `stump_punch` x2 plus one more stump card (`DD.Deck.stumpCards`).
- Cooling runs every frame in `DD.Body.cool`, three times faster while exploring.
- The HUD shows a per-socket heat bar coloured by `DD.Heat.tier` (0 calm, 3 critical) and the
  explore view draws a heat shimmer on any socket at tier 3.

### Bucle de muerte y reinicio de 6 minutos
- `src/run.js`: `Run.die`, `Run.timeout`, `Run.escape`, all funnelling into `Run.recordRun`.
- `src/systems/progress.js` + `DD.Run.meta` (persisted under `localStorage` key `dd.meta.v1`)
  keep `codexLimbs` and `codexEnemies` across deaths — the discovered blueprints survive.
- A new run gets a new body (`DD.Body.create`) and a procedurally regenerated tower
  (`DD.Run.loadFloor` seeds `DD.Tower.generate` from the run seed and the floor index).
- `src/scenes/end.js` offers exactly one action: wake at a new dissection table.

## Objetivos del jugador

| Objetivo | Where |
|---|---|
| **Explorar** pasillos procesales, recursos, trampas | `src/world/tower.js` (room-and-corridor generation, 9-14 rooms, extra loop connections), `src/world/explore.js` (movement, trap arming and firing, pickups, altars) |
| **Combatir** rápido y por turnos | `src/systems/combat.js` — 3 energy, 5 cards, 1-3 enemies, telegraphed intents |
| **Cosechar** extremidades | `src/data/enemies.js` `drops`, `combat.js` `pendingLoot`, `explore.js` spawns the pickup, `DD.Run.graft` + `src/scenes/graft.js` fit it |
| **Escapar** antes de 6 minutos | `DD.TILE_STAIRS` on floors 0-2, `DD.TILE_EXIT` on floor 3, `Run.nextFloor` / `Run.escape` |

## Estilo visual

- **Gótico alquímico**: the shared palette in `src/core/ns.js` (`DD.C`) — ink `#0b0a10`, blood
  `#a81c2c`, bile `#7fc23a`, bone `#ded3b8`, rust, gold. Used by every view.
- **Pixel art detallado y expresivo**: 108 world sprites in `src/render/sprites.js`
  (14 tiles, 12 props, 6 traps with lit variants, 6 resources, 12 enemies with a 48x48 boss,
  9 UI pieces, 16 HUD icons, 6 card frames, 3 backgrounds, 24 card icons) plus 66 avatar parts.
- All of it is hand-authored pixel data — no external image files anywhere. The renderer is
  `src/render/pixel.js`, and the bitmap font in `src/render/font.js` carries 110 glyphs
  including `Á É Í Ó Ú Ü Ñ á é í ó ú ü ñ ¿ ¡ °`.

## Sonido

- **Banda sonora sintetizada ominosa**: `src/audio/music.js` — five tracks (`menu` 60 BPM
  aeolian, `explore` 84 phrygian, `combat` 140 harmonic minor, `death` 52 aeolian, `escape`
  120 dorian), each built from detuned saw pads, a triangle bass, sine bells and filtered
  noise percussion, sent through a generated convolver impulse. `DD.Audio.music.setIntensity`
  opens the pad filter and adds a percussion layer as the clock runs down.
- **Efectos guturales**: `src/audio/sfx.js` — 24 named sounds. The wet, organic ones are a
  noise burst through a downward-sweeping lowpass plus a detuned low saw with a pitch glide,
  saturated through a waveshaper. `graft` is the signature: a squelch resolving into a hum.
- Everything is generated live through the Web Audio API. No samples, no audio files.

## Plataformas

PC, consoles, mobile — the game is one HTML file with no dependencies and no build step, so it
runs in any browser on every one of those platforms.

- **PC**: keyboard (`WASD`/arrows, `E`, `Space`, `Tab`, `Escape`, `1`-`9`, `F`).
- **Consolas**: the Gamepad API, mapped in `src/core/host.js` `Input.poll` (A confirm, B cancel,
  X interact, Y codex, plus the left stick through `Input.axis`).
- **Móviles**: an on-screen d-pad and an ACTUAR button, drawn and hit-tested by
  `src/render/scene-explore.js` through `DD.Input.button`; `DD.Input.virtual` turns them on
  automatically on a touch device.

## Público objetivo

Fans of deck-builders, roguelikes and survival games. The build targets that audience directly:
a run is short and lethal, the meta-progression is a codex rather than a power curve, and the
deck is the body you are assembling.

## Monetización

The brief asks for a free game with cosmetic microtransactions. The prototype ships the
**cosmetics shop** the concept describes — eight skins in `src/data/cosmetics.js`, bought with
shards earned by escaping, equipped through `DD.Progress.unlockCosmetic` / `equipCosmetic` — and
no payment path at all. The shop screen states in Spanish that it is a prototype and that no
real money is involved. A cosmetic recolours the player's body palette channels 1/2/3 and the
HUD accent, which is exactly what the concept specifies.

## Pasos siguientes del desarrollo

| Brief | Status |
|---|---|
| 1. Prototipo de combate | `src/systems/combat.js` — 23 card verbs, intents, statuses, telegraphing |
| 2. Planos anatómicos y cartas | `src/data/limbs.js` (26), `src/data/cards.js` (100) |
| 3. Torre procesal | `src/world/tower.js` — rooms, corridors, loops, relocation, entity placement |
| 4. Sistema de tiempo | `src/run.js` — one real-time clock across exploration and combat |
| 5. Arte y sonido | `src/render/sprites.js`, `src/render/avatar.js`, `src/render/font.js`, `src/audio/*` |
