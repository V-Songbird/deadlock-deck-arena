# Localization (ES / EN)

## What was investigated

Whether this build's player-facing text could be served in English without touching gameplay,
balance, layout, art or architecture, and what it takes to keep interpolated strings intact.

## What was concluded

Spanish stays the source language. `src/core/lang.js` holds one dictionary keyed by the exact
Spanish literal as written in the code; every player-facing literal is wrapped in `DD.t(...)`
at its call site. A string the dictionary does not know is returned unchanged, so a missed
literal degrades to Spanish rather than to a blank.

Because `DD.setLang()` reloads, the tables only need translating once, at load. That is why
`src/core/lang.js` is the first `<script>` in `index.html` — before `src/core/ns.js`, which is
itself now a `DD.t()` caller (`DD.SOCKET_LABEL`), and before the six `src/data/*.js` files,
which call `DD.t()` while they build their arrays.

## The module

`src/core/lang.js` exposes, on the existing `DD` global:

| Name | Behaviour |
|---|---|
| `DD.lang()` | `'es'` or `'en'` |
| `DD.t(text)` | exact Spanish literal in, active language out; unknown string passes through |
| `DD.setLang(code)` | writes `localStorage['dd-lang']`, then reloads |
| `DD.LANGS` | `['es', 'en']`, the order the on-screen toggle draws |

Resolution at load, first hit wins: `?lang=` in the URL, then `localStorage['dd-lang']`, then
`navigator.language` starting with `es`, else `'es'`. The resolved code is also written to
`document.documentElement.lang`. With no `?lang=` and nothing stored, the result is always
`'es'`, so the default experience is byte-identical to before.

`DD.setLang` rewrites an existing `?lang=` in the URL instead of reloading into it, otherwise a
query param would outrank the choice the player just made.

## Interpolation

Templates are translated, never the assembled string, so no number or name is ever lost:

- `src/run.js:122` — `DD.t('Piso ') + (st.floor + 1) + DD.t('. El aire huele a formol.')`
- `src/systems/combat.js:176` — `DD.plural(n, DD.t('enemigo'), DD.t('enemigos'))`
- `src/render/scene-combat.js:432` — card-face tokens such as `v + DD.t(' daño')`
- `src/systems/heat.js:30` — `DD.t('¡') + label(socket) + DD.t(' se sobrecalienta! Pierdes ') + n + DD.t(' de vida.')`

The lone `'¡'` maps to the empty string in English, which drops the Spanish opening
exclamation mark from the three log lines that carry one.

The help screen is the one place the wrap is not at the literal: `codexHelp` builds each body
as one sentence concatenated over three source lines, so `helpBlock` (`src/render/scene-ui.js`)
calls `DD.t()` on its `title` and `body` arguments and the assembled sentence is the key.

## The on-screen control

`DD.View.ui.langToggle(x, y)` in `src/render/scene-ui.js` draws two `DD.Pixel.panel` cells
labelled ES and EN, gold accent on the active one, and reads `DD.Input.button` for the tap —
the same idiom `src/render/scene-explore.js` uses for its touch pad. It is called from:

- `src/scenes/menu.js` — bottom left of the lobby, at `(16, 330)`
- `DD.View.ui.pause` — centred inside the pause panel

## Files touched

`index.html`, `src/core/lang.js` (new), `src/core/ns.js`, `src/run.js`, the six `src/data/*.js`,
`src/render/{hud,scene-ui,scene-combat,scene-explore}.js`,
`src/systems/{combat,heat}.js`, `src/world/explore.js`,
`src/scenes/{boot,menu,run,graft,pause,end,shop}.js`, `docs/architecture.md`.

## Evidence

```
$ for f in $(find src -name "*.js"); do node --check "$f"; done
(no output: 39 files parse)

$ node verify.js
DD.t() call sites: 586
distinct strings wrapped: 557
dictionary entries: 566
wrapped but NOT in dictionary (pass through): 5
  src/core/ns.js  "Torso"
  src/render/scene-combat.js  " integ."
  src/render/scene-combat.js  " vuln."
  src/render/scene-combat.js  " resid."
  src/render/scene-ui.js  "Torso"
dictionary entries never used by a DD.t() call: 13   (the 7 help titles + 6 help bodies,
                                                      which go through helpBlock)

$ node verify-help.js
helpBlock calls: 7
every help title and body resolves to a dictionary entry
```

The five pass-throughs are deliberate: `Torso`, ` integ.`, ` vuln.` and ` resid.` read the same
in both languages, so they are wrapped but carry no entry.

Browser check, `python -m http.server` over the build folder, Chromium, console clean on every
screen:

| URL | Result |
|---|---|
| `/` with empty `localStorage` | Spanish throughout — `Cuerpo`, `Piso 1/4`, `PAUSA`, `CONTINUAR`, `El reloj no se detiene - quedan 05:59`, card tokens `7 daño` / `-8 calor` / `+3 robo` |
| `/?lang=en` | English throughout — `NEW GAME`, `ANATOMICAL CODEX`, the seven help blocks, `Duct Crawler` / `Ward Leech` with intents `Claws the ankles` / `Drinks the blood`, cards `Tendon Lash` / `Flesh Feast` with `7 dmg` / `+3 leech`, `Draw` / `Discard`, `Turn 2.` |
| clicking EN on the lobby toggle | page reloads into English and `localStorage['dd-lang'] === 'en'` |

Numbers survived every switch: `05:59`, `69/78`, `16/16`, `Floor 1/4`, `Turn 2.`, `0/26`.

## Known gap

`DD.View.hud.ticker` clips each log line to 108 px and appends `.` (`clipText`,
`src/render/hud.js:105`). Long English lines are truncated there exactly as long Spanish ones
already were — pre-existing behaviour, not introduced here.
