# Verification

What was checked, how, and what the numbers were. Everything below was measured on this
machine on 2026-09-16; nothing is an estimate.

## 1. Structural harness — `node`

A stub-browser sandbox (`vm` with a fake `window`, `document`, canvas 2D context,
`localStorage` and no `AudioContext`) loads every script from `index.html` in order and then
checks the data against the contract, plays a full fight, breaks a limb, grafts one back,
climbs every floor and drives every scene. It also enforces two of the project's hard rules
by construction: the canvas stub **throws** on `ctx.fillText`, and every sprite definition is
checked for `rows.length === h` and `row.length === w`.

Latest result: **no problems**.

```
  data: 26 limbs, 100 cards, 12 enemies, 6 traps, 5 resources, 8 cosmetics
  sprites: 108 world + 66 avatar, glyphs: 110
  starting body: Cráneo de Válvulas, Coraza de Caldera, Brazo de Pistón, ...
  starting deck: 19 cards
  explore: 400 successful steps
  combat: 2 enemies, hand 5, deck 14
  combat: resolved after 16 actions, 13 cards played, result=win, hp=68
  thermal: socket head after 40 overheat events -> BROKEN (stump)
  thermal: deck 19 -> 18, 3 stump cards now at head (stump_punch,stump_punch,stump_guard)
  graft: Garra Ósea fitted to armL
  tower: reached floor 3, status escaped
  scenes registered: boot, menu, run, graft, codex, shop, pause, end
```

## 2. Real-browser check — Edge headless over the DevTools protocol

A static server plus installed Edge in `--headless=new`, driven through CDP. It collects
`Runtime.exceptionThrown` and console errors, evaluates probes that drive real transitions,
and screenshots every screen.

Latest result: **0 exceptions**, and the only console entries are two `favicon.ico` 404s.

Screens checked visually: title card, menu, explore (spawn and after a long walk), combat with
three enemies, the resolved fight, the graft table, the codex, the shop, a tower shift, and
both end screens.

## 3. Balance — an autopilot playing 40 whole runs

A bot that plays the game the way a person would: it moves at the player's own speed cap
(about 6 tiles per second, enforced in the probe so it cannot outrun a human), explores toward
the nearest tile it has not seen, beelines to the stairs the moment they fall inside its line
of sight, fights with a greedy policy, and grafts every limb it picks up onto the weakest
socket that fits.

```
  runs            40
  escaped         19  (48%)
  died            19  (48%)
  ran out of time  2  (5%)
  seconds used    avg 160 / median 138 / max 360  of 360
  fights per run  avg 5.5 / max 11
  kills per run   avg 5.3
  floor reached   avg 3.7 of 4
  limbs grafted   avg 3.2 / broken 0.1 / runs that grafted at all 39/40
  moves per run   avg 725
```

Reading: a run is a coin flip between escaping and dying, five or six fights long, and it takes
about two and a half minutes of the six available. The clock is a real threat but not the
typical cause of failure, because combat is. The anatomical loop runs end to end in 39 of 40
runs — limbs are torn off enemies, picked up, and sewn on.

## 4. Defects this found and that were fixed

| Found by | Defect | Fix |
|---|---|---|
| Browser check | `DD.Heat.overheated` was called but never defined, so any card that pushed a limb to its heat cap threw and the fight died | `src/systems/heat.js` now calls `DD.Body.overheated`, the frozen owner of that rule |
| Structural harness | Trap sprites resolved from the trap *id* (`steam_vent`), which is not a sprite key, so traps drew as magenta placeholders | `src/render/scene-explore.js` resolves the sprite through `DD.data.trapById[id].sprite` |
| Scene harness | `DD.Scenes.update` wrote the pre-update scene object back onto the top stack entry, so any scene that pushed, popped or replaced from its own `update` left the old scene on top and the game froze on the title card | `src/core/flow.js` no longer writes the entry back; the stack is read fresh each frame |
| Screenshot review | Card text overflowed its frame and collided with the neighbouring card | Hand cards are 60x80, a compact effect line replaces the full description on the face, and the full text moved into a hover tooltip |
| Screenshot review | Enemy intent panels overlapped with two or three enemies | Panels are sized to their own content and hard-capped to the enemy's column |
| Screenshot review | The graft screen's CARTAS row showed three blank card backs | It draws the limb's real cards now |
| Screenshot review | The exploration view was too dark to read a room's shape | Ambient falloff lifted and a per-surface light pool added; a lit floor is about `#433950` against a black void |
| Balance probe | The minimap revealed the entire floor and the stairs from the first frame, so a run was a four-second walk and the tower was never explored | The minimap now shows only tiles the player has seen |

## 5. What is not verified

- **Audio has never been heard.** The synthesis engine was verified structurally (no leftover
  sources, no non-finite automation, all 24 sounds and 5 tracks driven through a stubbed Web
  Audio context), but no one has listened to it. Treat the score as unproven.
- **Touch controls have not been exercised on a real touch device.** The code path exists and
  the buttons are drawn and hit-tested, but a mouse click in the harness is not a finger.
- **Gamepad support has not been exercised with a physical pad.**
- The balance figure comes from a bot, not from people. It is a sanity check, not a playtest.
