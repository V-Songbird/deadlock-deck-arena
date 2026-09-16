# Deadlock Deck: El Reloj Anatómico

A gothic-alchemical roguelike deckbuilder in which **your deck is your body**. You are a
freshly reanimated abomination on a dissection table, and you have exactly six minutes to get
out of a burning tower that rearranges itself while you are inside it.

Every card you play overheats the limb it belongs to. Push a limb too far and it cooks, then
it tears off, and its cards leave your deck until you cut a replacement off something that was
trying to kill you and sew it on.

## Play it

Open `index.html` in a browser. That is the whole install — no build step, no dependencies, no
asset files, no network access. Double-clicking the file works; any static server works too.

```
python -m http.server 8080      # or:  npx serve .
```

## Controls

| | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | `WASD` / arrows | left stick | on-screen d-pad |
| Interact, stairs, exit, altar | `E` | X | ACTUAR |
| Play a card | `1`-`9` or click | — | tap the card |
| End turn | `Space` | — | END TURN |
| Select target | `A` / `D` / arrows | — | tap the enemy |
| Flee a fight | `F` | — | — |
| Blueprint codex | `Tab` | Y | — |
| Pause | `Esc` | B | — |
| Confirm / cancel | `Enter` / `Backspace` | A / B | tap |

Audio starts on your first keypress or tap, because browsers require a gesture before a page
may make sound.

## The loop

1. **Explore** the procedural floor: collect residue, oil, bandages and shards, and avoid the
   traps, which telegraph for half a second before they fire.
2. **Fight** in fast turns. Enemies show their next move above their head.
3. **Harvest** the limb they drop, and open the graft table to choose which of your six
   sockets takes it. The clock keeps running while you decide.
4. **Escape.** Reach the gate before the clock reaches zero.

Die, or run out of time, and your spirit wakes on a new dissection table in a new body. The
tower regenerates. The anatomical blueprints you discovered stay in your codex forever.

## What is in here

```
index.html          the whole game, forty script tags
SPEC.md             the frozen interface contract every module was written against
docs/               architecture, verification, and a concept-coverage map
src/core/           vocabulary, RNG, canvas, input, storage, scene stack, the loop, the run
src/data/           26 limbs, 100 cards, 12 enemies, 6 traps, 5 resources, 8 cosmetics
src/systems/        body, deck, heat, combat, progression — the rules
src/world/          procedural tower generation and exploration
src/render/         the pixel renderer, 174 hand-authored sprites, a 110-glyph bitmap font, the views
src/audio/          24 synthesised sound effects and a five-track score, generated live
src/scenes/         boot, menu, run, graft, codex, shop, pause, end
```

Nothing in `src/data` or `src/systems` knows a view exists, and nothing anywhere loads a file
from the network.
