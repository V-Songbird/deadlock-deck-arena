# Build log — Deadlock Deck: El Reloj Anatómico

What was investigated / decided while building the game, with evidence. The design contract is in [design-spec.md](design-spec.md).

## Orchestration decisions (2026-09-16)

- **Stack**: vanilla JavaScript + Canvas 2D + Web Audio, classic `<script>` tags, no dependencies, no build, no tests. Reason: the request asks for a simple game that covers PC and mobile; one HTML file opened from `file://` covers both, and parallel workers can own one file each without a bundler.
- **Module split** (one global per file, load order fixed in `index.html`): `Core` (canvas/input/UI helpers), `Sprites` (all pixel art as string rows), `Data` (blueprints, cards, enemies), `Sound` (synthesized music/SFX), `Tower` (procedural floors), `Combat` (turn-based card combat), `Game` (state machine, clock, meta-progression, shop, codex).
- **Worker plan**: phase 1 = P1 core, P2 sprites, P3 data, P4 sound, P5 tower in parallel (independent given the spec); phase 2 = P6 combat + P7 game in parallel; phase 3 = P8 QA/integration in a browser.
- **Worker model**: `general-purpose` subagents with `model: opus`. A custom agent definition (`.claude/agents/opus-max.md`, `model: opus`, `effort: max`) was written but the Agent tool does not load new agent types mid-session ("Agent type 'opus-max' not found"), so the effort setting could only be requested in the prompt. The definition stays for future sessions.
- **Concept-to-feature mapping**: table in design-spec.md section 1 (every bullet of the concept has a feature, including the free-to-play cosmetics shop as an in-game-currency demo with no real payments).

## Phase results

- **Phase 1 (parallel)**: `js/core.js` (445 lines), `js/sprites.js` (1369 lines, 73 validated sprites), `js/data.js` (431 lines: 32 blueprints, 65 cards, 6 enemies), `js/sound.js` (398 lines), `js/tower.js` (286 lines; 300 generated floors + 900 mutations validated by the worker's harness). All pass `node --check`.
- **Phase 2 (parallel)**: `js/combat.js` (560 lines; 200 simulated combats: 178 win / 8 lose / 14 fled, 72 limb breaks, no failures) and `js/game.js` (866 lines; scripted harness walked 3 floors, harvest, death, victory, shop, codex).
- **First integration check by the orchestrator** (headless Edge via Playwright `channel: 'msedge'`, scratchpad only): the built-in browser pane is hidden in this session so `requestAnimationFrame` never fires there; a static server on `127.0.0.1:8642` plus headless Edge was used instead. Title, table, explore and combat render; flee works. Defects found and handed to QA: 54-px cards clip card text with the 8-px font, "Fin turno [E]" overflows its button, the player body in combat ignores the cosmetic tint, and the canvas scale is computed only once at init.
- **Phase 3**: single QA/integration worker owning every file, running spec section 7 (definition of done) end to end, including an autoplayer for time feasibility. Its findings go to `docs/qa-report.md`.

## Phase 3 results and closing state

- **QA worker** (see [qa-report.md](qa-report.md)): 15 fixes across `js/combat.js`, `js/core.js`, `js/game.js`, `js/data.js`; every item of the definition of done passed in headless Edge (desktop 960×540 and touch 800×360), including `file://`. Autoplayer: 5/5 beeline escapes with 342–371 s left, 3/5 thorough runs (losses by HP on floor 3, never by the clock); no balance values changed. Frame time 6.9 ms average at full fire intensity.
- **Follow-up fix worker**: the Quimera now gates the exit on floor 3 (`js/game.js`: stepping on the exit while the guardian lives starts that combat, with the toast "¡La Quimera bloquea la salida!"; a hint toast fires when floor 3 is entered). Verified with 15 assertions headlessly.
- **Orchestrator edits**: `js/core.js` uses a fractional canvas scale between 1× and 2× (phones fill the screen: 800×360 viewport → 640×360 canvas; 1920×1080 → 4×), spec section 3 and 5.6 updated to match the shipped layout, `README.md` added.
- **Final regression by the orchestrator** (`scratchpad/qa/final.js`, headless Edge): title → table → explore → combat (alquimista) → harvest graft (blueprint `alquimista_head` discovered) → floors 2 and 3 → exit blocked by the Quimera → win → victory (escapes 1, ichor 57, best time 350.9 s) → title → new run → death by time (loops 1, blueprints kept) → new table with a different body → `file://` load; zero page errors and zero console errors apart from the favicon 404.
- **Not applied**: the requested "max effort" setting for workers could only be asked for in prompts; the Agent tool has no effort parameter and the `.claude/agents/opus-max.md` definition is not loaded mid-session. Consoles are out of scope for a browser build (touch + keyboard/mouse only); the shop is a demo with in-game currency, no payments.
- **Temporary files**: everything lives in the session scratchpad (`serve.js`, `qa/` with Playwright, driver scripts and screenshots, worker validation harnesses). The project tree contains only the game, `README.md`, `docs/` and `.claude/agents/opus-max.md`.
