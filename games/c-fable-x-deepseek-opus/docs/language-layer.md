# Language layer (ES/EN) — Deadlock Deck: El Reloj Anatómico

What was investigated: how to add a Spanish/English layer to this build without touching gameplay,
balance, layout, art or architecture, and without a build step, dependencies or tests. Date: 2026-09-16.

## Conclusion

Spanish stays the source language: it is written literally in the code and passes through
`I18N.t()`, which returns it unchanged unless English is active. English lives in one dictionary
keyed by the exact Spanish string. Every player-facing string in `js/` and the two static Spanish
strings in `index.html` (`<title>` and the canvas `aria-label`) go through that function.
With no `?lang=` and no stored choice the game resolves to `es`, so its behaviour is unchanged.

| Piece | Where |
|---|---|
| `I18N.lang()`, `I18N.t(es, ...args)`, `I18N.set(lang)`, dictionary `I18N.EN` | `js/i18n.js` |
| Load order (first script, before `js/data.js`) | `index.html:14` |
| Blueprint text (cards, limbs, enemies, bodies, resources, shop, slot/type names) | `js/data.js` (199 call sites) |
| Run messages, causes of death, trap and resource text | `js/game.js` |
| Combat log and enemy intents | `js/combat.js` |
| Canvas text, DOM panel, buttons, HUD, help text, endings | `js/ui.js` |
| ES/EN buttons in the footer row, next to the sound toggle | `js/ui.js` (`_langBtn`, `_build`) |

## Design decisions

- **Interpolation**: the *template* is translated, never the assembled string.
  `I18N.t('{0} recibe {1} de daño.', C.enemy.name, total)` fills `{0}`, `{1}`... after lookup, so
  no number or name can be lost and English word order is free to differ.
- **Resolution order** (`I18N._resolve`, `js/i18n.js:63`): `?lang=` in the URL, then
  `localStorage['dd-lang']`, then `navigator.language`. A Spanish locale resolves to `es` and every
  other locale also falls back to `es`, which is the language the game ships in.
- **Setter**: `I18N.set()` stores the code and reloads. A `?lang=` in the URL would outrank the
  store on the way back, so the parameter is stripped from the href before reloading; otherwise the
  in-game buttons would appear dead whenever the game was opened with an explicit `?lang=`.
- **Causes of death stay comparable**: `Game.die(I18N.t('el reloj'))` and the two checks in
  `js/ui.js` (`_sceneDeath`, `_panelDeath`) compare against `I18N.t('el reloj')`, so the
  "clock ran out" ending is picked in both languages. Verified live (see below).
- **Language control**: two `.btn.small` buttons reusing the existing style, with the active one
  `disabled` — the same pattern the shop already uses for an equipped item. They sit in the
  `.row.foot` that `_build()` appends on every screen, so the control is reachable before and
  during a run. Their `title` attributes are the endonyms `Español` / `English`, which are correct
  in either language and therefore not in the dictionary.

## Dictionary size

303 distinct Spanish strings, 303 English entries, 0 keys missing an entry and 0 unused entries
(197 come from `js/data.js`, 106 from `js/ui.js`, `js/game.js`, `js/combat.js` and `index.html`).

## Evidence

`node --check` on every `.js` file in `js/` (audio, body, combat, data, game, i18n, sprites, tower,
ui): all pass.

A throwaway Node script loaded `i18n.js`, `data.js`, `body.js`, `tower.js`, `combat.js` and
`game.js` in a `vm` context with DOM/`localStorage`/`navigator`/`location` stubs and compared every
`I18N.t('...')` key in the source against the dictionary:

```
distinct I18N.t keys in code: 303
dictionary entries: 303
keys without an English entry: 0
dictionary entries never used in code: 0
default lang (no ?lang=, es-ES navigator): es / document.lang=es
?lang=en resolves to: en / title=Deadlock Deck: The Anatomical Clock
--- es ---
log: Rata de sutura recibe 3 de daño.
msg: ¡Una trampa! Pierdes 5 PV.
msg: Vial de vida: recuperas 7 PV.
--- en ---
log: Suture rat hits you for 0.
msg: A trap! You lose 5 HP.
msg: Vial of life: you recover 5 HP.
```

The build was then run in a browser over a throwaway static server. Default load stayed Spanish
(`Despiertas en la mesa. La torre arde. Tienes seis minutos.` / `Sonido: sí`); clicking `EN`
reloaded into English on every screen, with numbers intact:

```
Energy 3/3 / End turn / 1 Tremor Cost 1 Heat 0 ...
You face Head surgeon. / You play Punch. / Head surgeon takes 4 damage. / Head surgeon hits you for 9.
Shop · 0 essence / Simulated purchases: no real money. / Verdigris dye ... 20 essence / Buy
You died: a trap / Floor 1/3 · Enemies: 0 · Grafts: 0 · Essence: 0
The clock ran out | cause=the clock
You escaped the tower! / Time left: 6:00 · Essence: 0 · Escapes: 1
document.documentElement.lang = en, canvas aria-label = "Game scene"
```

Opening `?lang=en` while the store held `es` gave English (the URL outranks the store); clicking
`ES` from there left `http://127.0.0.1:8171/index.html` with no parameter, `dd-lang=es` stored and
the Spanish title back.

## Player-facing text deliberately left unwrapped

- `DEADLOCK DECK` on the title screen (`js/ui.js`): the name of the game, identical in both languages.
- `Español` / `English` button tooltips (`js/ui.js`): endonyms, correct in any locale.
- `` `${name}.` `` in `_enterResource` (`js/game.js`): a resource name plus a full stop, reached only
  by a resource with no effect; it carries no Spanish words.
- `'...'`, `'—'`, `◀ ▶ ▲ ▼` (`js/ui.js`): punctuation and arrow glyphs.
- `index.html` keeps the Spanish `<title>`, `aria-label` and `lang="es"` as the source text;
  `I18N._applyDocument()` translates them at load and sets `document.documentElement.lang`.
