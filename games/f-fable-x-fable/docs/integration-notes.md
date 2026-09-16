# Integration notes (Worker E: meta.js, screens.js, main.js)

Investigated: wiring `src/meta.js`, `src/screens.js` and `src/main.js` against the other ten
modules as they are actually written (not only against `architecture.md`), plus an end-to-end
run of the whole game in node stubs and in a real Chromium browser.

## Flow wiring (main.js)

- Boot (`window` load): `DD.meta.load()` → `DD.audio.muted = meta.muted` → `DD.render.init(canvas)` →
  `DD.input.init(canvas)` → title screen + `DD.audio.music('title')` → `requestAnimationFrame` loop.
- Frame: `DD.audio.init()` once `DD.input.anyInteraction` → `DD.input.beginFrame()` → clock
  (`run.timeLeft -= dt`, `setIntensity`, `tick` sfx under 10 s; only while `DD.game.running`) →
  `DD.screen.update(dt)` → death checks (`timeLeft <= 0` → "El reloj se detuvo", `hp <= 0` →
  "Has muerto"; `die()` is a no-op unless `running`, so a death reported by combat's callback in the
  same frame is not doubled) → `DD.screen.draw(DD.render.ctx)` → `endFrame()` → `present()`.
- `newRun()` → dissection (clock stopped, drawn static at 6:00). `startRun()` → `meta.runs++`,
  music 'explore', `DD.explore.begin(run, { onCombat: startCombat, onEscape: escape })`.
- `startCombat(id, cell)` → music 'combat', `DD.combat.begin(run, id, { onEnd })`, `DD.setScreen(DD.combat)`.
  `onEnd`: bank `run.discovered` into meta (every combat end, so blueprints survive a crash);
  won → music 'explore' then `DD.explore.resume(cell, true)` (which may call `onEscape` synchronously);
  lost → `die('Has muerto')`.
- `die(reason)` / `escape()` bank Ichor, blueprints, `bestFloor`, `bestTime` (escape bonus =
  30 + floor(timeLeft / 10)) and show the death / escape screens with the blueprints that were new.

## Bugs and mismatches found in other modules (not edited)

1. `src/explore.js:25` + `:41-42` — `prevBucket = floor(timeLeft / 45)` is 8 at exactly 360 s, so the
   first clock tick (359.98 → bucket 7) counts as a threshold crossing: the tower mutates, rumbles and
   shows "LA TORRE SE RETUERCE" on the first frame of every run (8 mutations instead of 7).
   Fix: use `Math.ceil` in both places (or seed `prevBucket` from `timeLeft - 1e-6`).
   Worked around in `main.js` `startRun()` by starting the clock at `RUN_SECONDS - 0.01`
   (`DD.fmtTime` still shows 6:00). Verified in the browser: `floor.mutations === 0` after the first frames.
2. `src/combat.js:254` — `ui.log(ctx, run, 236, 100, 168)` overlaps the limb-name column that
   `ui.drawBody(..., { labels: true })` draws at x ≈ 157-280 (render.js:286-295). Visible in the
   combat screenshot ("Cabeza de Ahorcado" over "Despiertas en la mesa…"). Fix: move the log to
   x ≥ 290 (width ≤ 150) or drop `labels`.
3. `src/explore.js:77` — the pickup message says "Icor" while every other string (HUD icon name,
   concept, screens) uses "Ichor".
4. `src/input.js:37` — keys are identified by `e.code` only; synthesized keyboard events whose
   `code` is empty (CDP `Input.dispatchKeyEvent` without `code`, some virtual keyboards) are
   ignored. Optional fallback: derive the code from `e.key` when `e.code === ''`.
5. `src/render.js:285-301` vs the task brief — `drawBody` draws slot labels only when `showHeat` is
   true, so "labels true, showHeat false" renders no labels; the dissection screen lists the slots
   in its own panel instead.

## Verification

- `node --check src/meta.js src/screens.js src/main.js`: OK.
- `node scratchpad/smoke-e.js` (loads the 13 scripts in `index.html` order under `window`/`document`/
  `localStorage`/`requestAnimationFrame` stubs with a Proxy 2D context, then drives boot → title →
  Reanimar → graft → Despertar → keyboard move → combat (3 turns to a kill) → harvest "Descartar" →
  explore resume → escape → new table → Enter → hp 0 death → clock 0 death (die() called exactly
  once) → codex detail → shop purchase → mute toggle → load/merge, corrupt and invalid saves):
  29/29 checks OK, no exceptions in any module.
- Real browser (Claude Browser pane, Chromium 152, served with `python -m http.server 8765`):
  title → Reanimar → Despertar → click-move through 3 rooms (coolant pickup) → Sabueso combat
  (card played, enemy turn) → harvest → resume → escape screen → new table with 2 blueprints →
  graft Cabeza de Sabueso → Despertar → death screen → title → codex + detail → shop → title.
  `read_console_messages`: no console output at all. localStorage `deadlockdeck.v1` held
  `{runs: 2, escapes: 1, ichor: 65, blueprints: [cabeza_sabueso, pierna_sabueso], bestFloor: 3, …}`.
  Pane quirks (not game bugs): `requestAnimationFrame` only fires while the pane captures a
  screenshot, and its synthesized key events carry an empty `e.code` (see bug 4), so movement was
  verified with mouse clicks and the fight was finished through `DD.combat.update` with latched keys.
- Not verified: Playwright is not installed (`require('playwright')` fails), so no scripted Edge
  run or saved screenshot files; screenshots were inspected inline. Touch input and the audio
  output were not exercised (no audio context in node; the pane's audio was not audited).
