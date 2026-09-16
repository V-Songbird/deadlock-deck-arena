# Architecture

## What this is

A browser game with **no dependencies, no build step and no asset files**. `index.html` loads
~40 plain `<script>` tags in a fixed order and the game runs from `file://` or any static
server. The whole thing is Canvas 2D, Web Audio and `localStorage`.

## The one rule that makes the parallel build work

`SPEC.md` in the repository root is a **frozen interface contract**. Every name, key,
enum value and data shape that crosses a module boundary is written down there, and no module
invents one. That is what let eleven modules be written concurrently against the same spine.

The other rules that keep it loadable: every file is an IIFE, no file uses `import`/`export`,
only `src/core/lang.js` and `src/core/ns.js` assign `window.DD` (lang.js creates it, ns.js
creates the namespaces on it), and no file does work at load time that could throw.

## Layers

```
core        lang.js    the ES/EN dictionary and DD.t(); loaded first, see localization.md
            ns.js      vocabulary: sockets, tile ids, palette, the 360-second clock
            util.js    seeded RNG (mulberry32), maths, colour
            host.js    virtual canvas + scaling, input (keyboard/gamepad/pointer/touch), storage
            flow.js    scene stack + the single requestAnimationFrame loop
            run.js     the live run and the meta that outlives it

data        limbs.js cards.js enemies.js traps.js resources.js cosmetics.js
                       pure data, each file self-indexing into DD.Data.<x>ById

systems     body.js deck.js heat.js combat.js progress.js
                       the rules. No drawing, no input.

world        tower.js  procedural floor generation, relocation, line of sight
            explore.js movement, traps, pickups, altars, starting fights

render      pixel.js   the only drawing API: sprite blitting, bitmap text, panels, bars, clip
            sprites.js avatar.js font.js    hand-authored pixel data
            hud.js scene-explore.js scene-combat.js scene-ui.js   views

audio       sfx.js music.js   live synthesis, no samples

scenes      boot menu run graft codex shop pause end   the flow between the screens
```

Dependencies point one way: `scenes` -> `render` -> `systems`/`world` -> `data`. Nothing in
`data` or `systems` knows a view exists. Views never mutate game state except through the
frozen entry points (`DD.Combat.playCard`, `DD.Combat.selectTarget`, `DD.Explore.interact`).

## The spine: `DD.Run`

`src/run.js` owns one object, `DD.Run.state`, and every module reads the same shape out of it
(SPEC.md 5.2). It holds the clock, the floor, the body, the map, the player's tile, the live
encounter and the run's running stats. `DD.Run.meta` is the part that survives death: the
blueprint codex, run counters, best escape time, shards and cosmetics — persisted under
`localStorage` key `dd.meta.v1`.

## Turn flow of a run

1. `DD.Run.newRun(seed)` builds a random tier-1 body (`DD.Body.create`) and generates floor 0.
2. `src/scenes/run.js` ticks `DD.Run.tick(dt)` — one real-time clock, running during
   exploration *and* combat — then hands off to `DD.Explore.update` or `DD.View.combat.update`.
3. `DD.Explore.update` moves the player, arms and fires traps, collects resources, walks
   enemies toward the player and calls `DD.Combat.start` when one reaches them.
4. `DD.Combat` runs the turn-based fight: draw 5, 3 energy, play cards, end turn.
5. `DD.Combat` writes dropped limbs into `state.pendingLoot`; `DD.Explore` turns them into
   pickups and stamps `DD.Explore.pendingGraft`; `src/scenes/graft.js` opens the graft table.
6. Stairs (`DD.TILE_STAIRS`) advance the floor; the gate (`DD.TILE_EXIT`) on the last floor
   ends the run as an escape.
7. Death or the clock running out ends the run and keeps the codex.

## Two details worth knowing

- **The tower rearranges itself.** Every 60 seconds `Run.shiftFloor` calls
  `DD.Tower.relayout`, which re-carves the *same* `Int8Array` in place with a new seed and then
  walks every living entity and the player to the nearest walkable tile. Nothing is ever left
  inside a wall.
- **The player's body is drawn, not described.** Both views stack six socket sprites chosen by
  each equipped limb's `form`, recoloured with that limb's `palette`. A grafted arm changes the
  silhouette and the colour of the arm you are looking at, in the same frame.
