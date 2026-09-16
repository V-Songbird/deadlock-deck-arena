# Build log — orchestration of Deadlock Deck: El Reloj Anatómico

What was done, why, and the evidence. Companion to `architecture.md` (the
module contract). Dates are absolute.

## 2026-09-16 — kickoff

Investigated: an empty folder `D:\Projects\fable`, no git, Node 22 on PATH.

Decisions:
- **Stack**: vanilla JS + Canvas 2D + Web Audio, classic `<script>` tags
  sharing a `window.DD` namespace. Reasons: the owner asked for a simple game
  with no tests or complex tooling; `file://` must work (no server, no build);
  a browser game runs on PC and mobile, which is the closest a prototype gets to
  the concept's "PC, consolas, móviles". Every asset (pixel art, music, SFX) is
  generated in code so the repo stays a handful of files.
- **Contract first, then parallel workers**: `docs/architecture.md` fixes the
  file list, load order, the shared `DD.run` shape, every module's public API
  and the roster ids (24 limbs, 7 enemies, 4 traps, 4 palettes) so that four
  Fable workers can build independent modules at the same time without seeing
  each other's code.
- **Concept coverage**: the table "Concept → features" in `architecture.md`
  maps every item of the concept (anatomical deck, thermal degradation, 6-minute
  death loop with retained blueprints, procedural ever-changing tower, explore /
  combat / harvest / escape, gothic pixel art, synthesized ominous score and
  guttural SFX, simulated cosmetic microtransactions and content unlocks) to a
  module. Monetization is simulated with in-game Ichor; no real payments.

Phase 1 (parallel, Fable workers): A = data/body/combat, B = tower/explore,
C = sprites/input/render, D = audio. Phase 2: E = meta/screens/main
(integration) once A-D report. Phase 3: orchestrator verifies in the built-in
browser and dispatches fixes.

## 2026-09-16 — Worker B report (tower.js, explore.js)

- Maze: randomized DFS spanning tree + 2-4 extra doors, always connected;
  start column 0, goal column 6 at the longest BFS distance; stairs/exit cell
  revealed at generation so a run is routable; enemies/elites/traps never on
  cells connected to start. `mutate` re-carves all doors, keeps contents.
- Worker's scratch smoke test: 200 floors × 3 indexes × 5 mutations plus a
  walk through every trigger, 25 136 checks, 0 failures.
- Deviations: `begin()` and `resume(cell, true)` call `DD.setScreen(DD.explore)`
  themselves; `resume` may call `onEscape()` synchronously; stairs regenerate
  `run.floor` inside `update`.
- Layout: title at y 27, grid 48 px cells at x 152-488 / y 40-232, log at
  (152, 240, w 336), hint at y 349.

## 2026-09-16 — Worker A report (data.js, body.js, combat.js)

- 24 limbs, 7 enemies, 59 distinct cards. Energy 3/turn, draw 5, hand cap 8,
  passive cooling 1 per limb per turn, weak/vuln ±25 %. Base limbs maxHeat 8,
  homúnculo 6, alquimista/cirujano 9, autómata/maestro 10, gólem 12.
  Enemy HP 14/18/22/24/36/42/55; heat intents on alquimista (+3), autómata
  (+4), maestro (+4).
- `enemies.maestro.elite = 'boss'`; tower.js already excludes the maestro from
  random cells by id (`src/tower.js:86`), and the elite filter was tightened to
  `e.elite === true` by the orchestrator.
- `onEnd` fires synchronously from `update` or `draw`; combat state is cleared
  before the callback, so switching screens inside it is safe.
- Worker's scratch smoke test (stubbed ui/audio/input): data integrity, body
  helpers, win + harvest + graft, mid-combat limb break, player death: passed.

## 2026-09-16 — Worker D report (audio.js)

- API exactly per contract; `muted` is a getter/setter that ramps the master
  gain, usable before `init()`. Master gain → lowpass 12 kHz → compressor.
- Five procedural tracks in D minor / D phrygian (title 60 bpm, explore 92,
  combat 132, death 46, escape 108), 16th-note sequencer with 0.15 s lookahead
  and 1 s crossfade. Intensity (explore/combat) scales tempo ×(1 + 0.35 v),
  opens the track lowpass and fades in ticking/hats/kick layers.
- 19 SFX synthesized from oscillators, a shared noise buffer, filters and
  envelopes; polyphony cap 96; unknown names ignored.
- Worker's scratch harness: no-Web-Audio environment → silent no-ops; strict
  stub context with rethrowing catch blocks → all tracks and SFX pass.
- Integrator notes: `sfx()` is dropped while the context is suspended, so the
  first unlocking click may be silent; `music()` before init is remembered.

## 2026-09-16 — Worker C report (sprites.js, input.js, render.js)

- API per contract plus extras: `DD.input.keyDown(code)`, `DD.render.fit/scale/buffer`,
  `DD.ui.FONT`, `BODY_W = 22`, `BODY_H = 38`. Figure is 22×38 × scale,
  bottom-center anchored; `sprite`/`icon` are top-left anchored.
- `text` with `maxWidth` wraps and returns the line count; font cell 5×8,
  advance 6, line height 9 (× size); `textWidth = (chars*6 − 1) * size`.
  Glyphs cover ASCII plus áéíóúüñ ÁÉÍÓÚÜÑ ¿ ¡ × →.
- `palette` option is a palette id string defaulting to `DD.run.palette`, so
  screens without a run must pass it explicitly. `drawBody` `showHeat` reads
  `DD.data.limbs` at call time.
- Sprite keys: 24 limb ids, `stump_*`, 7 enemy ids, `icon_<name>` (17),
  `token`, `flame`, `chain`, `torch`, `jar_*`, `alembic`, `gear`.
- Worker's checks: scratch validator for row widths/colour maps/glyph coverage,
  stub-canvas smoke test, and a visual showcase in Edge via a throwaway server.

## 2026-09-16 — Worker E report (meta.js, screens.js, main.js) and fixes

- Worker E wrote `docs/integration-notes.md` (flow wiring, five mismatches,
  node smoke test 29/29, browser click-through). The orchestrator fixed all
  five: `explore.js` mutation bucket uses `Math.ceil` (no mutation on frame
  one; the `main.js` clock workaround was removed), combat log moved to
  x 292 / w 136 so it no longer overlaps the limb labels, "Icor" → "Ichor",
  `input.js` derives the key code from `event.key` when `event.code` is empty,
  `render.js` draws limb labels without `showHeat`.
- Extra polish: `render.fit()` scales fractionally when an integer scale would
  waste more than 20 % of the window; accented capitals (Á É Í Ó Ú Ü Ñ)
  redrawn as one accent row + six-row capital; two card descriptions shortened
  so no word exceeds the card width ("Enfría cada miembro N.").

## 2026-09-16 — Orchestrator verification in the built-in browser

Served `D:\Projects\fable` with a scratchpad static server on port 8765 and
drove the game in the Claude desktop browser pane (Chromium). Console: no
messages at any point. Verified with screenshots and JS state reads:

- Title (gothic tower, stats, mute toggle) → Reanimar → dissection table with a
  random base body and the six slots' cards → Despertar → exploration on
  "Sótano de Disección" with the clock running, stairs revealed, fogged cells.
- Movement by click, coolant pickup, mutation at 315 s re-carving the doors
  ("La torre se retuerce" banner, `floor.mutations` 0 → 1; no mutation on the
  first frame after the fix).
- Combat vs Homúnculo: cards by click and by digit keys, floating damage,
  hurt flash, harvest overlay, graft of Brazo de Homúnculo into Brazo der.,
  blueprints banked to localStorage immediately.
- Stairs → "Galería de Especímenes" (floor 2); vapor trap (+3 heat on Torso).
- Combat vs Cirujano Demente with armL heat forced to 7/8: playing two arm
  cards broke the limb ("¡Brazo de Sepulturero se rompe! Ahora es un muñón."),
  the arm's cards vanished from the hand, the deck holds `golpe_munon` for that
  slot, the figure shows a bandaged stump. Ending the turn at 1 HP → death
  screen ("HAS MUERTO", autopsy report, blueprints marked ¡nuevo!).
- New dissection table: grafting a discovered blueprint (Pierna de Homúnculo →
  Pierna izq.) before waking works and is limited to one graft per table.
- Floor 3 "Laboratorio Superior" via JS: exit guarded by the Maestro Alquimista
  (HP forced to 1 for speed) → harvest → escape screen ("HAS ESCAPADO DE LA
  TORRE", bonus Ichor, best time saved).
- Codex 12/24 known with silhouettes for unknown ones and a card detail
  overlay; shop: bought "Cobre" for 25 Ichor (64 → 39), palette persisted and
  applied to the title body; "Verdoso" shows the 4/6 blueprint unlock.
- Timeout: clock at 0 → "EL RELOJ SE DETUVO" death screen, `die()` once.
- Audio: with `AudioContext.prototype.createOscillator` instrumented, 3 s of
  combat music + growl/break/mutate SFX created 153 oscillators with no errors;
  mute toggle works. Actual sound was not listened to.
- Mobile preset (375×812 portrait, touch UA): canvas 375×210, playable but
  small; landscape phones get ≈1.27× scale. Real touch gestures were not
  exercised (the pane sends mouse clicks).
- Pane quirks (not game bugs): `requestAnimationFrame` only ticks while the pane
  captures a screenshot, and synthesized Space/Enter keys arrive with empty
  `key`/`code`, so those were driven by buttons instead.

Temporary files: only the session scratchpad (server script, worker smoke
tests). `.claude/launch.json` (created for the preview server) was removed.
