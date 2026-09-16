# Build log — Deadlock Deck: El Reloj Anatómico

What was investigated: how to turn the one-page concept (6-minute escape, anatomical
deck-building, thermal degradation, death loop, procedural tower, harvest, gothic pixel art,
synthesized sound, simulated shop) into a simple, dependency-free browser game built by
delegated workers under one orchestrator. Date: 2026-09-16.

## Conclusion

The game is complete and playable from `index.html` (PC keyboard/mouse and mobile touch).
Every concept element is present; see the mapping below. No tests, no build step, no
dependencies, no modules, no network.

| Concept element | Where |
|---|---|
| Six-minute clock, death/timeout loop, new base body, blueprints kept, tower regenerated | `js/game.js` (`tick`, `die`, `newRun`, `rise`) |
| Body = deck (head, torso, 2 arms, 2 legs), cards per limb | `js/body.js` (`cardsOf`), `js/data.js` (`limbs`, `cards`) |
| Thermal degradation, limb break → stump card until a graft | `js/body.js` (`addHeat`), `js/combat.js` (`play`) |
| Procedural, constantly shifting labyrinth with traps and resources | `js/tower.js` (`generate`, `shift`, `spawnEnemy`) |
| Fast turn-based card combat with monstrosities and corrupt scientists | `js/combat.js`, `js/data.js` (`enemies`) |
| Harvest limbs from fallen enemies | `js/game.js` (`harvestPick`), harvest screen in `js/ui.js` |
| Gothic alchemical pixel art | `js/sprites.js` (palette, 21 tiles, 28 limb pieces, composed creatures) |
| Ominous synthesized soundtrack and guttural SFX | `js/audio.js` (4 music loops, 18 effects, Web Audio only) |
| Free game with simulated microtransactions (cosmetic tints, blueprint packs) | shop screen, `DATA.cosmetics`, `DATA.unlocks` |
| Persistence of blueprints, essence, purchases | `localStorage['deadlock-deck']` |

Consoles are out of scope for a browser prototype; PC and mobile are covered.

## How it was built

Orchestrator (this session) wrote the contract (`PRODUCT.md`), worker rules (`CLAUDE.md`),
`index.html` and one stub per module with normative JSDoc, then dispatched workers that each
owned disjoint files. No worker touched another worker's file.

| Phase | Worker | Model | Files | Result |
|---|---|---|---|---|
| 1 | DATA | DeepSeek (claude-dsk, max effort) | `js/data.js` | 50 cards, 29 limbs, 8 enemies, 3 base bodies, 4 cosmetics, 2 packs; 450 s |
| 1 | SPRITES | DeepSeek | `js/sprites.js` | 21 tiles, 28 limb pieces, creature composer; 468 s |
| 1 | AUDIO | DeepSeek | `js/audio.js` | loops + 18 SFX, fake-AudioContext harness; 410 s |
| 1 | TOWER | DeepSeek | `js/tower.js` | mazes, shift, population; 50-tower check, 111 292 assertions; 126 s |
| 1 | BODY | Opus (Agent tool) | `js/body.js` | ~40 assertions in a scratch harness; 181 s |
| 1 | COMBAT | Opus | `js/combat.js` | full-combat harness incl. break, reshuffle, statuses; 359 s |
| 2 | GAME | Opus | `js/game.js` | whole-run harness, 12 runs, 170–260 assertions each; 660 s |
| 2 | UI | Opus | `js/ui.js`, `style.css` | live browser pass over every screen; 1016 s |
| 3 | orchestrator QA | — | — | see below |
| 4 | REVIEW | DeepSeek, read-only | — | see "Review" |

Orchestrator-side edits after the workers: shop prices lowered in `js/data.js:207-221`
(cosmetics 20/30/40/60, packs 50/70 essence) so the shop is reachable within a few runs.

## Verification evidence (orchestrator)

Reference checks over the data (`node -e`, `new Function` load of `js/data.js`):
`cards 50 limbs 29 {"head":7,"torso":7,"arm":8,"leg":7} enemies 8 bodies 3 cosm 4 unlocks 2`,
`REFS OK` (every limb sprite key valid, every card referenced exists, enemy limb types match
slots, base bodies tier 0, unlock packs tier 2).

Sprite smoke test under a fake `document`: all 21 tiles and 28 limb icons are 16×16 with
drawn pixels, creatures are 32×40, stump-only creature and every enemy render: `SPRITES OK`.

Browser pass (built-in browser, `http://127.0.0.1:8778/` served from a scratch static server,
console empty throughout):

- title → `Despertar` → table (six slot rows, cycle buttons) → shop (prices, `Volver`) →
  `Levantarse` → explore (fog, clock, floor label, d-pad).
- keyboard `w w d d`: picked up `Vial de vida`; `d`: combat with `Rata de sutura`
  (hand of 5, energy 3/3, intent `Ataca 4`); keys `1 4 5 e`; win → harvest screen listing
  the rat's four limbs; `Injertar` head → back to explore with `Cabeza ratonera` in the strip,
  `meta.discovered = ['cabeza_ratonera']`.
- labyrinth shift forced with `shiftIn = 0.05`: walls changed, message `¡El laberinto se
  retuerce!`, enemy count back to 4 after one kill (spawn works).
- trap: hp 37 → 32, both legs heat 2, message `¡Una trampa! Pierdes 5 PV.`, cell emptied.
- limb break: `brazo_mastin` at heat 5/6 + `Manotazo` → `broken:true`, only the stump card
  left for `armR`, strip shows `Muñón`, creature drawn with a bandaged stub, log
  `¡Tu brazo der. se parte!`.
- stairs → `Piso 2/3` (`Subes al piso 2`), stairs → floor 3, exit → escape screen
  (`meta.escapes = 1`, essence 7 banked).
- `Volver a la mesa` → table options for the head: `['cabeza_difunta', 'cabeza_ratonera']`.
- `rise` + `timeLeft = 1.2` → death screen `El reloj llegó a cero`, `run.cause = 'el reloj'`,
  music mode `off`, AudioContext `running`.
- mobile viewport 375×812: no horizontal scroll (`scrollWidth 375 = clientWidth 375`),
  d-pad `▲` moved the player from (1,6) to (1,5), `Sonido` button muted (master gain 0,
  `meta.muted = true`).
- reload: `meta` restored from storage (`escapes 1, essence 7, runs 3, muted true`).

## Decisions worth knowing

- Enemy block resets at the start of the enemy's own turn (COMBAT worker), so the player can
  actually hit through it; PRODUCT.md §5.3 wording was ambiguous.
- Harvest offers de-duplicated limbs (an enemy with two identical legs shows one row).
- Canvas scale is capped by 60 % of the viewport height so the DOM panel stays on screen on
  tall desktops.
- Shop buy buttons stay enabled when essence is short so the `Esencia insuficiente` message
  is reachable.
- `Sprites.limb()` icons always use the default tint; only the composed creature shows the
  equipped cosmetic.

## Known gaps

- No way back to the title screen during a run (no such control in the spec; `Game.toTitle`
  exists).
- Balance is untuned beyond the worker's tier bands; a full three-floor escape needs routing
  around enemies.
- `file://` could not be exercised in the built-in browser pane (it snapshots local files as
  `data:` URLs); the page uses only relative `<script>` tags, so it is expected to work.

## Review

A read-only DeepSeek REVIEW worker (48 turns, 591 s) read all ten files, ran inline harnesses
(80 randomized fights, 60 end-to-end runs, a static cross-module reference check, a stubbed-DOM
render of all 8 screens) and found no contract mismatch, no reachable runtime error and no
gameplay deviation from PRODUCT.md §6/§7. Three findings, all fixed by the orchestrator:

1. `index.html:5` had `user-scalable=no` (blocks pinch zoom, WCAG 1.4.4) → removed.
2. `Game.escape()` could run with `G.body === null` when called from the table, and the
   escape/explore scenes read `G.body` → guard added at `js/game.js:289`
   (verified: `Game.escape()` from the table leaves the screen on `table`, `escapes` unchanged).
3. The always-owned default tint had no row in the shop, so a bought tint could never be
   reverted → row `Piel de cadáver` with `Equipar`/`Equipado` added in `js/ui.js` (`_panelShop`);
   verified in the browser: buy `tinte_verdigris`, equip, equip default → `meta.tint = 'default'`.

Console stayed empty after the fixes.
