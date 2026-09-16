# Deadlock Deck — orchestrated build and QA record

What was investigated: whether the game described in the concept brief could be built end to end
by parallel DeepSeek workers under a written contract, and whether the result actually plays.

What was concluded: yes. Nine `claude-dsk` worker runs produced a playable game with every
mechanic from the concept present and verified in a real browser. One high-severity bug survived
the workers' own self-checks and was caught by a read-only review worker.

## Build shape

| Phase | Workers | Files produced |
|---|---|---|
| 0 Contract | orchestrator | `PRODUCT.md`, `CLAUDE.md`, `index.html`, stubs |
| 1 Core | DATA ∥ BODY ∥ COMBAT ∥ TOWER ∥ ART ∥ AUDIO | `src/data.js`, `body.js`, `combat.js`, `tower.js`, `render.js`, `audio.js` |
| 2 Shell | UI ∥ GAME | `src/ui.js`, `styles.css`, `game.js` |
| 3 QA | orchestrator | browser pass on a local static server |
| 4 Review | REVIEW (`-Mode default`) ∥ DOCS | findings report, `README.md` |
| 5 Fix | FIX | 6 curated items applied |

All workers ran at `CLAUDE_CODE_EFFORT_LEVEL=max` on `deepseek-flash[1m]`. Total worker time was
about 48 minutes across nine runs; the longest single run was ART at 850 s / 111 turns.

`PRODUCT.md` §5 held every cross-module signature, the state shape and the event list. No worker
edited a file it did not own, and no worker changed `index.html` — checked with `git status` after
each phase.

## Architecture as built

No dependencies, no build step, no ES modules: eight classic scripts attach to a global `DD`
namespace in the fixed order set by [index.html:60](../index.html:60). Nothing uses `fetch`, XHR
or ES modules, so opening `index.html` straight from `file://` works by construction; the QA pass
below ran over HTTP because the browser pane cannot load a real `file://` page.

| File | Global | Role |
|---|---|---|
| [src/data.js](../src/data.js) | `DD.DATA` | 17 limbs, 38 cards, 7 enemies, declarative effects and intents |
| [src/body.js](../src/body.js) | `DD.Body` | six slots, heat, breaking, grafting, deck assembly |
| [src/combat.js](../src/combat.js) | `DD.Combat` | turn loop, effect resolution, mid-combat limb purge |
| [src/tower.js](../src/tower.js) | `DD.Tower` | seeded 5×5 procedural floor |
| [src/render.js](../src/render.js) | `DD.Render` | procedural pixel art on a 384×216 canvas |
| [src/audio.js](../src/audio.js) | `DD.Audio` | Web Audio synthesis, no asset files |
| [src/ui.js](../src/ui.js) | `DD.UI` | DOM hud, anatomy panel, hand, dialogs |
| [src/game.js](../src/game.js) | `DD.Game` | clock, run lifecycle, persistence, input |

## Browser QA evidence

Served from a throwaway static server on port 5178 and driven in the built-in browser.

- Modules load clean: all eight `DD.*` globals present, no console errors at any point.
- Tower generation matches the spec census exactly: `slab 1, exit 1, combat 6, elite 1, cache 2,
  trap 2, empty 12` over 25 rooms.
- Combat: heat routed to the source limb per card, e.g. `Calor +2 en torso` after `Espasmo`.
- **Thermal degradation confirmed live.** `armL` (`arm_withered`, integrity 6) broke during a
  real fight; the anatomy panel switched to `Brazo izq. Muñón — ROTA`, the in-combat deck lost
  exactly that limb's two cards and gained `stump_flail`, and `armR`'s identical copies stayed.
- Harvest offered `Cosecha: Torso Errante` with one graft option per compatible slot plus
  `Dejar`. Grafting swapped the deck's torso cards, raised `maxHp` 30 → 36 and cost 4.3 s.
- Death loop: clock froze at `phase: 'dead'` (0 s drift over 1.2 s), restart produced cycle 2
  with a fresh base body, a new tower seed and blueprints kept in `localStorage.dd_save`.
- Escape: reached `phase: 'escaped'` with `stats {escapes: 1, kills: 5, bestTimeLeft: 337.4}`.
- Audio is real: with a spy wrapped around `AudioContext`, one context was created and resumed,
  and 22 oscillators, 7 buffer sources and 29 node starts fired within ~2.4 s of starting a run.
  All 14 sfx names plus an unknown name, and `setTension` at `0, 0.3, 0.9, 1, 1.5, -1, NaN`,
  raised no exception.
- Responsive: 1440×900 gives an integer 2× canvas (768×432); 390×780 keeps the canvas at 378×216
  with a horizontally scrollable hand, 44 px targets and no page scroll in either axis.

## The bug the workers missed

Every phase-1 worker self-verified and reported green. A read-only REVIEW worker still found a
high-severity defect none of them could see, because it spanned two files:

> A heal **subtracted** HP after a limb with `hpBonus` broke.

`body.js` marked a slot broken without resyncing the stored `body.maxHp`, so
`DD.Body.maxHp(body)` returned 30 while `body.hp` was still 38; `combat.js` then clamped a heal
to the live maximum, dropping HP by 8. Reproduced in the browser with the production API before
ordering the fix:

```
before      { hp: 38, maxHp: 38, live: 38 }
afterBreak  { hp: 38, storedMaxHp: 38, liveMaxHp: 30, broken: true }
heal 7      -> hp 30        // a heal that damages you
```

Fixed in both places: `applyHeat` now resyncs `maxHp` and clamps `hp` at break time, and the
heal op can no longer lower HP. Verified after the fix: `afterBreak 30/30 live=30`, and a heal
from 26 leaves 30.

Five smaller items were curated from the same review and applied: the escape screen now prints
the body that escaped, the clock drains on real wall-clock time so a hidden tab cannot pause it,
the opening hand emits its `draw` event, the title screen shows `MEJOR ESCAPE`, and the HUD no
longer flashes `0:00` before the first render.

## Lesson for the next orchestration

Worker self-verification is thorough inside a file and blind across files. Budget one read-only
review run per project; it cost 173 s and found the only defect that reached the player.

## Spanish/English language layer

Added after the build as `src/i18n.js`, a ninth classic script loaded **before** `src/data.js`
so the data tables translate their own names while they are being constructed. It exposes
`DD.I18N.lang()`, `DD.I18N.t(spanish, args)` and `DD.I18N.set('es'|'en')`, plus the call-site
shorthand `DD.T`. Dictionary keys are the exact Spanish strings as written in the code;
`{0}`/`{1}` placeholders keep numbers and names out of the translated text, and an unknown key
passes through unchanged, so Spanish needs no entries of its own.

Resolution at load: `?lang=` → `localStorage['dd-lang']` → `navigator.language` starting with
`es` → `es`. Spanish is both the shipped language and the fallback, so an untouched URL renders
byte-identically to the pre-i18n build. `document.documentElement.lang` is set from the same
value. `set()` stores the choice and reloads; when a `?lang=` is present it rewrites that
parameter instead, because the URL outranks storage and the click is the newer choice.

The ES/EN control is `#btn-lang` in `index.html`, next to `#btn-sound`, styled with the same
brass-plate rule in `src/styles.css`. It shows the language it switches *to* and is present on
every screen, before and during a run.

### Pixel-font constraint

`src/render.js` draws with a 5x5 font whose `GLYPHS` table (line 106) covers `A-Z`, `0-9` and
`: . , ! - / + ?` only; anything else renders as `?`. Every English string that can reach the
canvas — the title/death/escape screens, enemy names, the death messages and everything
`DD.Body.describe()` assembles — was checked against that table. Widest English canvas line is
`THE ANATOMICAL CLOCK HITS 0:00 AND YOUR FLESH FALLS APART.` at 58 chars = 347 px on a 384 px
screen. Apostrophes are avoided throughout (`Scholar Skull`, not `Scholar's Skull`).

### Verification

`node --check` passes on all nine files. 261 dictionary entries; 232 `DD.T(` call sites
(data 124, combat 32, game 30, render 14, body 13, tower 9, ui 9). Driven in a browser over a
throwaway static server: a full run in `?lang=en` produced `Ash Hound blocks your way!` /
`You play Dry Blow.` / `5 damage to the enemy.` in the log, `Harvest: Ash Hound` with
`Graft onto the head` options, the toast `You graft Hound Head onto the head. -4 s of clock.`,
and the death screen `YOU HAVE DIED` with no missing glyphs. Toggling back restored Spanish and
left `dd-lang=es` in storage.

Known gap: `DD.Body.pluralOf()` still falls back to the Spanish `-s`/`-es` rule for a limb with
no entry in `PLURALS`. Unreachable with the shipped data — only arms and legs can repeat in
adjacent slots and all of them are listed, and the stump case returns before it — so it was left
alone rather than guarded.
