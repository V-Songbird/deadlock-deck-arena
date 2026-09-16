# QA report — Deadlock Deck: El Reloj Anatómico

Full definition-of-done pass (design-spec.md section 7) driven with Playwright + headless
Microsoft Edge (`chromium.launch({ channel: 'msedge', headless: true })`) against a static
server at `http://127.0.0.1:8642/index.html`. Every check below was executed against the real
page: real `KeyboardEvent`s, real mouse/touch input and real `requestAnimationFrame` timing.
Driver scripts and screenshots live in the session scratchpad
(`.../scratchpad/qa/`), never in the project.

Console/page-error policy: a run fails on any `pageerror` or `console.error`. The only error
observed on any run is `GET /favicon.ico 404` (the static server has no favicon), which is
excluded by the protocol.

## 1. Defects found and fixed

### `js/combat.js`

| # | Defect | Fix |
|---|---|---|
| 1 | Hand unreadable: 54 px cards clipped names and texts with the 8 px pixel font (`Aguantar` → `Aguanta`, `Huyes del combate` overflowed). | Cards are now 88×78. ≤ 5 cards: spacing 92 from `x = 8`. > 5 cards: spacing `(464 - 88) / (n - 1)` so the row still ends at x = 464 and later cards overlap earlier ones. Name/text wrap at `maxWidth` 84, `lineHeight` 9. Cost/heat icons stay on the top row, the mini part sprite moved to the bottom-right corner (`x + CARD_W - 18, y + CARD_H - 22`). |
| 2 | Hit-testing scanned the hand front-to-back, so in an overlapping hand a click landed on the card *underneath*. | `hoverIndex()` iterates from the last card backwards: the topmost (later-drawn) card wins. |
| 3 | The hovered card was raised 6 px but still drawn under the following cards, so in an 8-card hand it stayed unreadable. | `drawHand` skips the hovered index in the main pass and draws it last, raised. |
| 4 | `Fin turno [E]` (13 glyphs = 104 px) overflowed its 72 px button. | Button moved to `(362, 160, 110, 20)`; `BTN_X/BTN_W` drive both the drawing and the pointer hit-test, so both moved together. |
| 5 | The player body and the card part sprites in combat ignored the equipped cosmetic. | `drawPlayer` and `drawCard` pass `tint: (window.Game && Game.tint()) \|\| null` (runtime lookup — `Game` exists by then). Verified visually: crimson skin turns the combat body and the card mini-sprites red (`47-combat-skin.png`). |
| 6 | Long log lines (`¡Se rompe: Pierna izq. (Pierna de tendones cosidos)!`, 51 glyphs = 408 px) ran under the end-turn button. | `clipLog()` trims log lines to 44 glyphs (352 px, ending at x = 360). |
| 7 | The heat-intent log read `Calor +5 en Brazo der..` (double period, `SLOT_NAMES` already ends in `.`). | Trailing `'.'` dropped from that one log call. |

### `js/core.js`

| # | Defect | Fix |
|---|---|---|
| 8 | The canvas scale was computed once in `init()`; a window resize before the first frame left the canvas at 480 px. | `resize()` is re-run on the first frame of the loop, and `document.body` is observed with `ResizeObserver` when available (guarded, optional). |
| 9 | Toasts were drawn full width, centred at x = 240: long ones (`Ácido alquímico: Añade 5 de calor a un miembro al azar; puede romperlo.`, 70 glyphs) spilled past the panel **and** covered the run clock at `(384, 4)` — the clock must be visible at all times on run screens (spec §1). | Toast text is trimmed to the panel width with an ellipsis, the panel is capped at 372 px and centred at x = 190, so it always ends left of x = 380. |

### `js/game.js`

| # | Defect | Fix |
|---|---|---|
| 10 | Table initial-graft button: `Injertar` (8 glyphs) needs 72 px, the button was 68×12. | 76×14. |
| 11 | Shop: `Desbloquear (60)` (16 glyphs) needs 136 px, the button was 132 px **and** at x = 344 it overflowed the 8..472 row panel. | All shop row buttons are `(336, y + 10, 136, 18)`; the row description wrap narrowed 280 → 270 so it does not run into them. |
| 12 | Harvest offer panel: the card list was capped with `cy < py + 100` *before* drawing an entry, so a 2-line entry ran into the `Actual:`/`I:…D:…` comparison line and the graft buttons (see the pre-fix screenshot: `14 de daño.` overprinting `I:Brazo de sepulturero D:…`). | Panel grown to `py = 64, h = 168`; the `+N PV` and `Calor máx. … · Enfría …` lines were compacted to one line each; each card entry is only started when 30 px of room remain, and its text is clipped to 50 glyphs (at 204 px wrap width that is at most 2 lines), so an entry can never exceed its reserved 30 px. Comparison line at `py + 124`, buttons at `py + 134` / `py + 152`. |
| 13 | Codex cells wrapped the blueprint name at 60 px with `lineHeight` 8. Single words longer than 7 glyphs (`homúnculo`, `relojería`, `enmascarada`) overflowed into the next column, and 3–4 line names overflowed into the next row (rows are 44 px apart, the name box started 22 px into the cell). | New `cellLines()` renders at most two 7-glyph lines (first meaningful word + last word, `de/del/la` dropped): `Cabeza / enmasc…`, `Cráneo / homúnc…`. Fits the 66 px column and the 44 px row. |
| 14 | Explore sidebar heat bars were invisible at heat 0 (`PAL.ink` track on the `PAL.ink` background) and a stump was indistinguishable from a cool limb. | Track is `PAL.panel`; a stump draws a solid `PAL.blood` bar. |

### `js/data.js`

| # | Defect | Fix |
|---|---|---|
| 15 | `pack_quimera.desc` (67 chars) wrapped to 3 lines and spilled out of the 38 px shop row panel and off the bottom of the canvas. | Shortened to `Desbloquea los cuatro planos de la Quimera en la mesa.` (2 lines). |

All other buttons and labels on every screen were measured against the `glyphs × 8 + 8` rule
(title, table, explore sidebar and hint, combat, harvest, codex, shop, death, victory, mute) and
already had enough room.

**Intentional deviations from the spec text** (both requested to fix readability): the hand uses
88×78 cards with 92 px / overlapping spacing instead of the spec's "54×78 spaced 58 px", and the
end-turn button is `(362, 160, 110, 20)` instead of "x ≈ 400, y ≈ 160, 72×20". No API was renamed.

## 2. Protocol results

| Item | Result | Evidence |
|---|---|---|
| a. Title → table → run start, no console errors | PASS | `01-title`, `02-table`, `03-explore`. Only error anywhere: `favicon.ico` 404. |
| b. Exploration | PASS | Keyboard movement moves one tile per press; `seen` grows 49 → 68 on six steps. All four resources applied correctly: coolant heat 3 → 0, suture hp 22 → 34, clockwork 358.6 → 378.4 s, ichor 0 → 8, each with the right toast/log. Spikes hp 22 → 16. Acid on a limb at `maxHeat - 1` broke it (`limbs.armL === null`, log `¡Se rompe: Brazo izq. (Brazo de sepulturero)!`, HUD shows the stump — `10-explore-stump`). Mutation from `mutateTimer = 29.9`: `tiles` changed, `seen` reset to the fog radius, toast `El laboratorio se reconfigura…`, exit and all 7 entities still reachable via `Tower.reachable`. Stairs to floor 2 and 3 with the right toasts. Guardian Manhattan distance to the exit = 1 on floor 3. |
| c. Combat | PASS | Fights started against all six enemy types through `movePlayer` (guardian via the real floor-3 entity, `20-combat-quimera`). Cards played by click and by number key (`hand 5→4, energy 3→2`); end turn by button click (turn 1→2) and by `e` (2→3). `intentIndex` cycles `0,1,2,3,0` / `0..4,0`. Intents verified individually: attack 9 → −9 hp; weak halves it (9 → 4, `weak` decremented once); stun skips the action and clears; heat +5 on a random non-stump limb; block +8; heal 20 → 26; poison +3 then ticks on the player turn. Card effects: poison 4, weaken 2, stun, heal, block. Limb break mid-combat: `armR` cards (1 hand + 3 draw) removed from every pile and exactly one stump card pushed to the discard. Flee returned the player to `prevPos` with the enemy entity still on the floor. Defeat → death screen with `reason: 'killed'`, `meta.loops` incremented. Win → harvest. |
| d. Harvest | PASS | `23-harvest`, `31-harvest-stump-labels`. Grafted into head and torso (`maxHp` 42 → 50), into `armL`/`armR` and `legL`/`legR` by side, and onto stumps (`Der. (muñón)` labels). `meta.blueprints` grew to 4, `localStorage.deadlock_meta` matched exactly, survived a reload, the codex marked them discovered and the table offered the initial graft, which changed the head slot and set `initialGraftUsed`. |
| e. Deaths | PASS | `timeLeft = 0.5` → death (`reason: 'time'`, loops 1, `meta.ichor += run ichor`). Spike trap at 3 hp → death (`reason: 'killed'`, loops 2). Both returned to the table with a different random body and a different floor layout; blueprints kept. |
| f. Victory | PASS | Quimera beaten on floor 3, then the exit: `escapes 0 → 1`, `bonus = floor(timeLeft / 10)`, `meta.ichor += run.ichor + bonus` (18 + 35 + 8 = 61), `bestTime` set. `42-victory`. |
| g. Shop | PASS | With `meta.ichor = 200`, bought `skin_brass` (−20), `skin_ichor` (−20), `skin_crimson` (−35) and `pack_quimera` (−60); the pack added the four `quimera_*` blueprints to the codex (counter 8/32 → 12/32). Equip/Equipado states switch, everything persisted to `localStorage`. Tint visible on the title body and in combat (`45-title-crimson`, `47-combat-skin`). |
| h. Codex | PASS | `46-codex`, `72-v-codex`. Counter `Planos: 12/32` and `14/32` matched the computed value; no name spills after fix 13. |
| i. Sound | PASS | After a synthetic click on the title button the `AudioContext` is `running` and 9 oscillators + 10 gains were created (the drone), confirming `Sound.music` actually started from a real gesture. `unlock()`, all 6 `music()` modes, `urgency` over `[-1, 0, .25, .5, .9, 1, 2, NaN]`, all 20 spec-4.5 `sfx` names and two `toggleMute()` calls: zero exceptions, `Sound.muted` toggles `false → true → false`. Node counters rose 9 → 57 oscillators / 0 → 18 noise sources during the sweep. Clicking the on-screen mute button silences SFX (0 new oscillators) and unmuting restores them (verified with a 300 ms gap, needed because `Sound.sfx` throttles to one start per name per 30 ms). |
| j. Mobile (800×360, touch) | PASS | `50-m-title` … `57-m-death`. Tapped every button on title, codex, shop, table, explore (mute), combat (card + end turn), harvest (side graft + continue) and death. Tap-to-move works; all four swipe directions move exactly when the target tile is walkable. Nothing is cut off. Note: at 800×360 the scale is `floor(min(800/480, 360/270)) = 1`, so the canvas renders 1:1 with letterboxing — that is what spec §3 prescribes ("integer scale when ≥ 1"). |
| k. Balance / time feasibility | PASS — no tuning applied | See section 3. |
| l. Performance | PASS | Fire overlay pinned at intensity 0.997 (clock held at 1.2 s) with the red vignette pulsing and the per-second tick SFX firing: explore `avg 6.94 ms, p95 7.10 ms, max 7.10 ms` over 288 frames; combat with an 8-card hand and the Quimera `avg 6.94 ms, p95 7.10 ms, max 7.40 ms`. Both well under the 16 ms budget. |

## 3. Balance numbers (autoplayer)

Autoplayer: BFS over walkable tiles to the nearest enemy/resource, then to the exit; fights play
the affordable attack card whose source limb has the lowest heat ratio, prefer the biggest
affordable block when the enemy's next attack is ≥ 8 and hp < 40 %, otherwise a non-flee utility
card, then end the turn; harvest grafts an offer when its slot is a stump or (torso) when it
grants more hp. Movement uses `Game._debug.moveTo` but the driver still burns the real walking
time — one tile per 0.14 s, the game's own key-repeat rate — so the 360 s clock is honest.
Fights and harvest run through the real UI code paths (number keys, `e`, real clicks).

Two policies, 5 complete runs each, real time flowing:

| Policy | Escapes | Kills / run | Time left at the end | Fights | Avg fight (wall) |
|---|---|---|---|---|---|
| Beeline (take resources within 6 tiles, fight enemies within 4) | **5/5** | 1–6 | 342–371 s | 12 | 1.8 s (max 3.6 s) |
| Thorough (clear every enemy and resource on all 3 floors) | **3/5** | 11–15 | 298–386 s | 72 | 2.1 s (max 5.4 s) |

Both thorough losses were deaths by HP on floor 3 (0/50 and 0/48 hp) after 14–15 kills, never by
the clock. Escaping in 6 minutes is comfortably feasible — the binding constraint is HP, not
time — so **no balance value was changed**. (The autoplayer has full map knowledge, which a real
player behind a 4-tile fog radius does not; even so the ~300 s of slack leaves a very large
margin for exploration.)

Player turns per fight (5 samples each, same policy, measured through `Combat`):

| Body | homúnculo | alquimista | ghoul | autómata | cirujano | quimera |
|---|---|---|---|---|---|---|
| Base (42 hp) | 1.6 | 2.0 | 2.8 | 3.6 | 2.6 | 4.2 |
| Grafted (50 hp, automata/cirujano arms, ghoul torso) | 1.4 | 1.4 | 2.0 | 3.0 | 2.0 | 3.4 |

Observation (not fixed): the spec's own numbers make the "3–6 player turns" target unreachable
for the early enemies. With `energy = 3`, 1-cost attacks in the 4–6 damage band and `homunculo.hp
= 12` / `alquimista.hp = 16` — all three pinned by spec §5.3 — a good draw kills a floor-1 enemy
in one or two turns by construction. Reaching 3 turns would require raising enemy HP or lowering
card damage below the spec's bands, which the tuning mandate does not allow (it is gated on
escaping being infeasible, and it is not). Recorded here as a design tension rather than a bug.

## 4. Remaining known limitations

1. **Mobile letterboxing.** On an 800×360 landscape phone the integer-scale rule gives scale 1, so
   the game occupies 480×270 of the screen with black bars. Spec-compliant (§3) but small; a
   half-step scale (1.5× via fractional scaling above 1) would fill the screen if the contract ever
   changes.
2. **Overlapping hand.** With 6–8 cards the spacing shrinks to ~54 px and only the hovered/tapped
   card is fully readable; the others show their cost, heat and the first ~5 glyphs of the name.
   This is the requested design for a hand that must stay on one row. Very long single words
   (`Aniquilación`, 12 glyphs = 96 px) still exceed the 84 px wrap width by a few pixels because
   `Core.gfx.wrap` never splits a word.
3. **Toasts.** They are capped at 372 px and centred at x = 190 to keep the clock clear, so the
   longest resource/trap descriptions are truncated with an ellipsis; the full text is also written
   to the run log at the bottom of the explore screen.
4. **Guardian is not a gate.** Entities never occupy the exit tile, so on floor 3 a player can walk
   around the Quimera to the exit whenever another walkable neighbour of the exit exists. The spec
   describes the exit as "guarded by the Quimera" but specifies no mechanical block; the autoplayer
   in beeline mode frequently skips it.
5. **Debug hooks are live in the shipped build.** `Game._debug` and `Combat._play/_endTurn` are
   reachable from the console. `Game._debug.setState('combat')` without going through `movePlayer`
   leaves `run.enemyDef === null` and makes `endCombat` throw (`Cannot read properties of null
   (reading 'ichor')`, `js/game.js:303`). Not reachable through normal play — every real entry into
   combat sets `run.enemyDef` first — and the hooks were required by the QA brief, so this was left
   as is.
6. **Base-family codex cells** still show the two variants as one shortened word each
   (`sepult…` / `estiba…`), which is the pre-existing rendering for shared sprites.
