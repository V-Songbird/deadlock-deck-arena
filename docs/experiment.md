# Deadlock Deck Arena — method, measurements and hub design

What was investigated: how five orchestrator/worker agent pairings differ when they are given one
identical game brief, and how to present the five results so a visitor can compare them.

Everything below is recorded from the repository itself. Commands are reproducible from the
repository root.

## 1. The experiment

Five runs of the same prompt, each producing a complete browser game. The only variable was the
model pairing.

| Build | Orchestrator | Worker | Folder |
|---|---|---|---|
| A | DeepSeek | Opus 5 | `games/a-deepseek-x-opus/` |
| B | Opus 5 | DeepSeek | `games/b-opus-x-deepseek/` |
| C | Fable 5.1 | DeepSeek + Opus 5 | `games/c-fable-x-deepseek-opus/` |
| D | Opus 5 | Opus 5 | `games/d-opus-x-opus/` |
| E | Astra | Astra | `games/e-astra/` |

Constant across all five runs:

- the same prompt, word for word (reproduced in §5);
- the orchestrator at maximum reasoning effort — `xhigh`, or DeepSeek's own ceiling;
- fully autonomous operation, with no owner input during the build;
- no dependencies, no build step, no tests.

### What this does not establish

One run per pairing. No repeats, no controlled scoring, no held-out rubric. The measurements below
describe five artefacts; they do not rank five models.

## 2. Measurements

Command:

```bash
for g in a-deepseek-x-opus b-opus-x-deepseek c-fable-x-deepseek-opus d-opus-x-opus e-astra; do
  files=$(find "games/$g" -type f | wc -l)
  loc=$(find "games/$g" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) \
        -not -name 'Deadlock-Deck.html' -exec cat {} + | wc -l)
  echo "$g files=$files loc=$loc"
done
```

Result, 16 September 2026:

| Build | Files | Code files | Lines (JS/CSS/HTML) |
|---|---|---|---|
| A | 44 | 39 | 10 957 |
| B | 14 | 10 | 4 460 |
| C | 14 | 10 | 3 964 |
| D | 17 | 13 | 5 206 |
| E | 10 | 7 | 2 978 |

Build E's single-file bundle `Deadlock-Deck.html` is excluded from the line count because it
duplicates the rest of that folder.

The spread is the most visible result: build A is about 3.7× the size of build E for the same
brief.

## 3. Structural differences

Verified by reading the entry points.

| Build | Evidence | Approach |
|---|---|---|
| A | [index.html:12](../games/a-deepseek-x-opus/index.html) | One `<canvas id="screen" width="640" height="360">`; the whole UI is drawn on it. 25 classic `<script>` tags on a global `DD` namespace. |
| B | [index.html:23](../games/b-opus-x-deepseek/index.html) | A 384×216 canvas for the scene only; the clock, health bar and six anatomy slots are real DOM elements. |
| C | [index.html:11](../games/c-fable-x-deepseek-opus/index.html), [js/sprites.js:28](../games/c-fable-x-deepseek-opus/js/sprites.js) | A 320×180 canvas for the scene, DOM for the rest; sprites are generated into offscreen canvases at boot. |
| D | [index.html:38](../games/d-opus-x-opus/index.html), [server.mjs:1](../games/d-opus-x-opus/server.mjs) | The only build on ES modules (`<script type="module">`), and the only one shipping its own static server. |
| E | [src/art.js:11](../games/e-astra/src/art.js) | No `<canvas>` in the page at all; sprites are built offscreen and the interface is a dark serif layout, not pixel art. |

Build E is the only one that did not follow the prompt's "Pixel Art" instruction at the page level.

## 4. Provenance recovered from build B

`games/b-opus-x-deepseek/` arrived with its own nested `.git` directory holding five commits and
no remote:

```text
e07f380 2026-09-16 Add build and QA findings doc
7283ab7 2026-09-16 Phase 3: review fixes and README
b06a1f8 2026-09-15 Phase 2: UI layer and game loop
c500e87 2026-09-15 Phase 1: data, body, combat, tower, render, audio modules
130321c 2026-09-15 Contract: PRODUCT.md, CLAUDE.md, index.html, stubs
```

A nested repository cannot be committed as ordinary files, and GitHub Pages will not publish a
submodule's contents. The history was bundled before the nested `.git` was moved aside:

```bash
git -C "games/b-opus-x-deepseek" bundle create docs/provenance/game-b-build-history.bundle --all
git bundle verify docs/provenance/game-b-build-history.bundle
# The bundle records a complete history.
```

Restore it with:

```bash
git clone docs/provenance/game-b-build-history.bundle build-b-history
```

That history shows build B's orchestrator working in phases: a written contract first, then data
and systems, then the UI layer, then a review pass. None of the other four builds left a comparable
record.

## 5. The prompt

Reproduced verbatim on the hub, inside the **Read the full prompt** panel on
[index.html](../index.html), in whichever language the page is set to.

The Spanish text is the evidence: it is what the five agents actually received, and it is what the
Spanish side of the panel shows, unedited. The English side is a reading translation, labelled as
one, with a link back to the original. The two are never presented as interchangeable, because the
prompt is the experiment's input and a translated input would be a different experiment.

## 6. Hub design

### Decisions

**Two pages, state in the URL.** `index.html` lists the builds; `play.html?g=b,d` runs them.
Nothing is stored in a custom history stack, so browser back, forward and a copied link all behave
correctly, and a specific comparison is shareable. An overlay on the hub was rejected because it
would need manual history handling and could not be linked.

**Static HTML first.** The five cards, their play links and the five-way compare link are plain
markup. Scripting adds the compare tray, the language switch and the pixel headline; with
scripting off the page still reads and every game is still one click away.

**Both languages in the DOM.** Each string ships as `<span lang="es">` and `<span lang="en">`, and
`html[data-lang]` hides one of them in CSS ([assets/hub.css:49](../assets/hub.css)). An inline
script in `<head>` sets `data-lang` from `?lang=`, then `localStorage`, then `navigator.language`,
before first paint, so the page never flashes the wrong language. A `display: none` copy is not
announced by screen readers, and each fragment keeps a correct `lang` attribute.

**The 6:00 clock does not count down.** It is the game's emblem, and a live countdown on an index
page would manufacture urgency with no task behind it. The real clock starts inside a game.

**The footer's six limb slots carry real links** — repository, prompt, conditions, method, as-built
tag, licence — so the chrome that echoes the game's anatomy bar is also the site's navigation.

**Unique accessible names.** Five cards each with a control named "Play" is a screen-reader
problem, so every card control carries a visually hidden build letter: "Play build A", "Compare
build A", "Source of build A".

**The headline uses the games' own font.** The 5×5 glyph table in
[assets/pixel-font.js:7](../assets/pixel-font.js) is copied verbatim from build B's renderer
([src/render.js:106](../games/b-opus-x-deepseek/src/render.js)), so the hub's title is drawn with
the same letterforms the game draws with. The palette, button bevels, slot borders and focus ring
come from the same stylesheet.

### Verified by operating the pages

Checked against a local `python -m http.server` in a Chromium browser:

| Claim | Result |
|---|---|
| `?lang=en` and `?lang=es` select the language before paint | verified |
| The language switch rewrites internal links so a copied URL keeps the language | verified — links read `play.html?g=a&lang=en` after switching |
| Ticking two cards shows the tray with the right target | verified — `play.html?g=a,b&lang=es`, label "ABRIR 2 LADO A LADO" |
| Each card's compare control has a unique accessible name | verified — label text reads "Comparar la construcción A" |
| All five games load and run at once in `play.html?g=a,b,c,d,e` | verified at 1440×860, 3+2 grid |
| No console errors on the hub or the player | verified |
| Mobile layout at 375×812 | verified — cards stack, health bar hides, targets stay ≥44 px |

Not verified: behaviour with a real screen reader, and behaviour on iOS Safari. The games
themselves are canvas-driven and are not keyboard- or screen-reader-accessible; the hub around them
is.

## 7. Bilingual games

The five games shipped Spanish-only. A language layer was added afterwards, one agent per build, so
each game resolves its language from `?lang=`, then `localStorage['dd-lang']`, then falls back to
Spanish, and exposes its own ES/EN control. The hub passes the visitor's choice into the game it
launches. This is the only change made to the delivered code, and it sits in commits after the
`as-built-2026-09` tag.

Each build got the shape that fitted it, not one shared module:

| Build | Module | Dictionary | Control |
|---|---|---|---|
| A | [src/core/lang.js](../games/a-deepseek-x-opus/src/core/lang.js) | 566 entries | two canvas cells on the menu and the pause screen |
| B | [src/i18n.js](../games/b-opus-x-deepseek/src/i18n.js) | 261 entries | a DOM button beside the sound toggle |
| C | [js/i18n.js](../games/c-fable-x-deepseek-opus/js/i18n.js) | 303 entries | two `.btn.small` buttons in the footer row |
| D | [src/lang.js](../games/d-opus-x-opus/src/lang.js) | 409 entries | two canvas cells on the title and the slab |
| E | [src/i18n.js](../games/e-astra/src/i18n.js) | 519 entries | two header buttons, mirrored in the intro modal |

Three decisions are worth recording because they are not obvious:

- **Build D translates at the point of drawing, not in its data tables.** Its combat code compares
  enemy move *names* to stop the same move repeating three times in a row
  ([src/combat.js:280](../games/d-opus-x-opus/src/combat.js)). Translating `cards.js` and
  `tower.js` would have broken that rule.
- **Canvas builds needed a glyph audit.** Builds A, B and D draw text with a fixed pixel font that
  has no lowercase and a short punctuation set. English wordings were checked against each font's
  glyph table so nothing renders as `?`; build B's audit covered the 52 strings that can reach its
  renderer.
- **Build E ships the game twice.** `Deadlock-Deck.html` turned out to be a byte-identical
  concatenation of `src/*.js`, so the single-file copy was regenerated from the modular one and
  each block compared back.

### Verified by operating each build

Loaded from a local static server in a fresh Chromium profile, at `?lang=en` and with no parameter
at all:

| Build | `?lang=en` | Default (no parameter) |
|---|---|---|
| A | title, warning screen, menu and help in English; document title swapped | Spanish, unchanged |
| B | canvas title screen, HUD and all six anatomy slots in English | Spanish, unchanged |
| C | intro, button, stats and key hints in English | Spanish, unchanged |
| D | title plate, intro panel and control list in English | Spanish, unchanged |
| E | header, anatomy panel, tower panel and intro modal in English | Spanish, unchanged |

No console errors in any build, in either language.

Known limitation, inherited from build E's architecture: it stores log lines as rendered text, so
switching language mid-run leaves earlier log entries in the previous language. New entries use the
new language.
