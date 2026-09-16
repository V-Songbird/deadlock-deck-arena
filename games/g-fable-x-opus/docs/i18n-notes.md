# Spanish/English text layer — what was investigated and decided

Adds an English layer on top of the shipped Spanish build without touching gameplay, balance,
layout, art or architecture. The design contract is in [design-spec.md](design-spec.md); the
readability rules this layer had to respect come from [qa-report.md](qa-report.md).

## 1. What was added

| File | Change |
|---|---|
| `js/i18n.js` (new, 387 lines) | `window.I18N = { lang(), t(str, args), set(lang) }` in the same `var` + `'use strict'` IIFE style as the other modules. Holds the whole ES→EN dictionary. |
| `index.html:15` | `<script src="js/i18n.js"></script>` inserted before `js/core.js`, so every later module can translate while it loads. |
| `js/data.js` | `var T = I18N.t` (line 5). `card()` translates `name`/`text`, `limb()` translates `name`; `FAMILIES`, `SLOT_NAMES`, `ENEMIES`, `STUMP_CARD`, `RESOURCES`, `TRAPS`, `COSMETICS`, `PACKS` translate their own `name`/`desc` literals. |
| `js/combat.js` | `var T = I18N.t` (line 5). Every log line, status tag, heat label and the end-turn button. |
| `js/game.js` | `var T = I18N.t` (line 5). Every screen, toast, log line, HUD label and button, plus `langButton()` (line 114). |

Nothing outside `games/g-fable-x-opus/` was touched. No dependency, no build step, no test file.

### Resolution and persistence

`js/i18n.js:352` — `var lang = fromQuery() || fromStorage() || DEFAULT_LANG;` with `DEFAULT_LANG = 'es'`.
There is deliberately **no** `navigator.language` fallback (the sibling build `b-opus-x-deepseek`
has one): the brief requires that a bare URL with empty storage render exactly as the Spanish
build always has.

`set(next)` writes `localStorage['dd-lang']` and then reloads. When the URL already carries a
`?lang=`, that parameter outranks storage on the next load, so `set` rewrites the parameter
instead of reloading into the language the player just left (`js/i18n.js:373-378`). Storage
access is wrapped in `try/catch` because `file://` and private windows throw.

`document.documentElement.lang` is always set; the `<title>` is only rewritten when the language
is English, so the Spanish page keeps the exact markup it ships with.

### Why the data tables translate themselves

`card()` and `limb()` are the only constructors for the 65 cards and 32 blueprints, so wrapping
`name`/`text` inside the helper (`js/data.js:65,69` and `js/data.js:176`) translates 162 literals
with two `T(...)` calls and makes it impossible to miss one. Because `js/i18n.js` loads before
`js/data.js`, the tables are already in the active language by the time `Combat` and `Game` read
them, and no call site has to re-translate a name.

### The ES/EN control

`Game.langButton(x, y)` (`js/game.js:114-117`) draws a 24x20 `Core.ui.button` showing the language
it switches to, exactly like the existing mute button next to it. Placed on:

- title — `js/game.js:436`, at (428, 246), left of the mute button;
- victory — `js/game.js:728`, at (448, 232);
- death — `js/game.js:744`, at (448, 240).

The build has no pause screen (design-spec.md §5.7: *"Escape key on any run screen: no pause"*).
Title covers "before a run"; victory and death cover "after a run" — and the death screen is the
only way out of a lost run, since its button goes to the table, not to the title. Both outcome
screens call `saveMeta()` before they are entered (`js/game.js:297,308`), so the reload loses
nothing.

## 2. Text metrics: what each box allows

Checked before choosing any English wording.

- `Core.gfx.text` sets `ctx.font = size + 'px "Press Start 2P", monospace'` (`js/core.js:138`).
  Measured in the live page: `ctx.measureText('MMMMMMMMMM').width / 10 === 8` at size 8, so the
  pixel font is exactly **8 px per glyph** (16 px at size 16) and `glyphs x 8` is the true width.
- `Core.gfx.wrap` (`js/core.js:181-196`) breaks on spaces only and **never splits a word**, so any
  single word wider than `maxWidth` overflows its box.
- `Core.ui.button` (`js/core.js:262-275`) centres the label inside the rect with a 1 px frame, so
  the hard limit is `width - 2`; `qa-report.md` uses the safer `glyphs x 8 + 8 <= width`.
- `Core.toast` trims to a 372 px panel with an ellipsis (`js/core.js:338,347-349`).

| Box | Limit | Source |
|---|---|---|
| Combat card name / text | wrap 84 px (10 glyphs), name at `y + 12`, card 88x78 | `js/combat.js:504-505` |
| Combat end-turn button | 110 px | `js/combat.js:11` |
| Combat heat slot label | 136 -> 232 px = 96 px | `js/combat.js:14` |
| Combat `muñón` tag | 232 -> 300 px (enemy body) | `js/combat.js:14,471` |
| Combat enemy name | x 300 -> 480 = 180 px | `js/combat.js:440` |
| Combat log line | clipped to 44 glyphs | `js/combat.js:480` |
| Explore log line | clipped to 46 glyphs | `js/game.js:634-635` |
| Explore heat label | 388 -> 414 px = 26 px (3 glyphs) | `js/game.js:614,617` |
| Harvest limb name | clip 21 glyphs, wrap 168 px, 2 lines | `js/game.js:659` |
| Harvest card name | clip 13 glyphs + ` xN` | `js/game.js:669` |
| Harvest card text | clip 50 glyphs, wrap 204 px, 2 lines | `js/game.js:673` |
| Harvest side button | 104 px | `js/game.js:685-686` |
| Shop row button | 136 px | `js/game.js:816-819` |
| Shop row description | wrap 270 px, 2 lines inside a 38 px row | `js/game.js:813` |
| Codex family header | clip 7 glyphs (66 px column) | `js/game.js:797` |
| Codex cell name | `cellLines()` — 2 lines of 7 glyphs | `js/game.js:761-766` |
| Table slot line | x 176 -> 480 = 38 glyphs | `js/game.js:467` |

Consequences for the English wordings:

- Every card name and text keeps its words at 10 glyphs or fewer (`Transfusión` became
  `Transfuse`, not `Transfusion`, which would be 11).
- `'{0} (muñón)'` maps to `'{0} stump'`, not `'{0} (stump)'`: `Right (stump)` is 13 glyphs = 104 px
  and would not fit the 104 px harvest button (limit 102).
- The combat status tags shorten to `Blk / Psn / Wk / Stun` so the right-aligned tag row stays
  clear of the enemy HP text at x = 300.
- `HEAT_LABEL` becomes `Hd / Tr / L.A / R.A / L.L / R.L` for the 26 px explore sidebar column.
- Base-family blueprints are named `Head of the Hanged`, `Torso of Patches`, `Arm of the Digger`,
  `Leg of the Vagrant` (and the `b` variants) because the codex renders those two variants through
  `shortName()`, which keeps only the **last** word — `Hanged Head` / `Lunatic Head` would both
  render as `Head`.

## 3. Verification

### `node --check`

```
$ node --check js/i18n.js   -> OK
$ node --check js/data.js   -> OK
$ node --check js/combat.js -> OK
$ node --check js/game.js   -> OK
```

### Dictionary size and coverage

A scratchpad script extracted every `T('...')` key from the three modules plus the `card()` /
`limb()` arguments and diffed them against the `EN` table:

```
call-site keys seen: 280
dictionary keys: 281
-- call-site keys with NO English entry (0):
-- dictionary entries never reached from a call site (1):
   "Deadlock Deck: El Reloj Anatómico"      (used by i18n.js itself for <title>)
== duplicate keys: none
```

**281 distinct Spanish strings** are in the dictionary.

### Untranslated Spanish literals that remain

A scan of all seven `js/*.js` files for string literals containing Spanish accents or Spanish
function words, excluding comments and anything reaching `I18N.t`, leaves:

| Count | What | Why |
|---|---|---|
| 32 | `LIMBS[*].desc` (`js/data.js:188-263`, 5th argument of `limb()`) | Never drawn. `grep -rn "\.desc" js/` returns only `RESOURCES`/`TRAPS` (`js/game.js:209,210,220,221`) and `COSMETICS`/`PACKS` (`js/game.js:813,833`); the codex, table and harvest screens all render `name`. |
| 7 | `FAMILIES[*].desc` (`js/data.js:23-29`) | Never drawn. `Data.FAMILIES` is read only at `js/game.js:795-797`, which uses `fam.name`. |
| 4 | `'en'`, `'de'`, `'del'`, `'la'` | Code, not prose: a language code (`js/game.js:115`) and the article filter inside `cellLines()` (`js/game.js:762`). |
| 0 | anything else | — |

`js/core.js`, `js/sprites.js`, `js/sound.js` and `js/tower.js` contain no player-facing Spanish:
`grep -n "[áéíóúñÁÉÍÓÚÑ¿¡ü…×·]" tower.js sound.js sprites.js` returns nothing, and the only
string `Sprites.logo` draws is the proper name `'DEADLOCK DECK'` (`js/sprites.js:1348`).

### Browser pass

Static server on `http://127.0.0.1:8642` (scratchpad `serve.js`), Browser pane at 800x450 so the
480x270 canvas scales exactly 1.667x.

`?lang=en` — walked title -> codex -> shop -> table -> initial-graft side prompt -> explore ->
combat (homúnculo, played cards, ended turns, won) -> harvest (including a forced limb break for
the stump labels) -> victory -> death. Everything rendered in English inside its box:

- title `The Anatomical Clock`, `Awaken [Enter]`, `Plans`, `Shop`,
  `Tap or press a key to turn on sound`, `Escapes: 0 · Loops: 0 · Best: —`;
- codex `Anatomical plans` / `Plans: 10/32`, headers `Base Homunc… Labora… Corrup… Brass …
  Hereti… Chimera` (the same truncation pattern Spanish ships: `Cuerpo… Homúnc… Ghoul …`),
  base cells `Hanged/Lunatic`, `Patches/Grave`, `Digger/Docker`, `Vagrant/Pilgrim`;
- shop: all five row descriptions fit two lines, `Buy (20)` / `Unlock (60)` / `Equipped` fit;
- table `Dissection Table`, the intro wraps to 4 lines above the body (same as Spanish),
  `First graft`, `Which arm?` / `Left` / `Right` / `Cancel`, `Get up [Enter]`;
- explore `Floor 1/3`, `HP 42/42`, `Hd Tr L.A R.A L.L R.L`,
  log `Grafted: Injector Arm (Left arm)`, hint `Arrows/WASD or swipe · Reach the exit`;
- combat `Heat`, `Head`…`Right leg`, `End turn [E]`, cards `Clumsy Guard / Block 5.`,
  `Acid Vial / Poison 4.`, log `You face Homunculus.` -> `You play Clumsy Guard.` ->
  `Your block holds.` -> `Homunculus hits you for 4.` -> `Homunculus falls!`;
- harvest `Harvest: Homunculus`, `Max heat 7 · Cools 3`, `L:stump R:stump`,
  `Left stump` / `Right stump`, `Now: Head of the Hanged`, `Continue [Enter]`, toast
  `Broken: Left leg!`, log `Broken: Left leg (Leg of the Vagrant)!`;
- victory `You escaped` / `the tower`, `Time left: 3:32`, `Ichor: 48 (+21 bonus)`;
- death `You died`, `The clock struck six. The tower collapses on you.` (2 lines),
  `Kills: 7 · Ichor: 5 · Loops: 0`, `New table [Enter]`.

Clicking `ES` on the death screen rewrote the URL `?lang=en` -> `?lang=es` (not a plain reload),
stored `dd-lang = "es"`, and reloaded with `document.title === 'Deadlock Deck: El Reloj Anatómico'`
and `documentElement.lang === 'es'`.

No parameter, `dd-lang` removed — `I18N.lang() === 'es'`, `Data.SLOT_NAMES.armL === 'Brazo izq.'`,
`Data.CARDS.ba_strike` = `'Golpe seco' / '5 de daño.'`, `Data.ENEMIES.quimera.name === 'Quimera'`,
title screen pixel-identical to the shipped build apart from the added `EN` button.
`read_console_messages(onlyErrors)` returned **no console logs** on any load.

### Measurement harness

Every card, button, shop row, limb name, enemy name and fixed-position string was measured in the
live page against the table in section 2. English: **0 problems**. The same harness run against
Spanish reports 9 **pre-existing** overflows, which confirms it is not passing trivially:

```
CARD ho_swarm      overflow=["Pensamiento"]
CARD gh_crush      overflow=["Aplastamiento"]
CARD al_vapor      overflow=["refrescante"]
CARD al_step       overflow=["refrigerado"]
CARD au_calibrate  overflow=["Calibración"]
CARD ci_diagnose   overflow=["Diagnóstico"]
CARD ci_transfuse  overflow=["Transfusión"]
CARD qu_annihilate overflow=["Aniquilación"]
OVERFLOW x=180 "Ya has usado el injerto de este bucle." -> 484
```

The eight card words are qa-report.md §4 known limitation 2 (`Core.gfx.wrap` never splits a word).
The table line runs 4 px past the 480 px canvas. Both are untouched: this task changes no Spanish
text. The English strings for all nine fit.
