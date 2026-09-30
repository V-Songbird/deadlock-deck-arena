# Deadlock Deck Arena

Ten playable browser games built from one identical prompt by ten different AI
orchestrator/worker pairings, with a hub that launches any of them or runs several side by side
in the same window.

**[Open the arena →](https://v-songbird.github.io/deadlock-deck-arena/)**

The prompt asked for *Deadlock Deck: El Reloj Anatómico* — a gothic-alchemical roguelike where
your card deck is your body, limbs overheat and break, and you have six real minutes to escape a
burning tower. Nobody intervened while the agents built it. What each pairing handed back is in
this repository, unedited apart from the language layer described below.

## The ten builds

| | Orchestrator | Worker | Files | Lines | Rendering |
|---|---|---|---|---|---|
| **A** | DeepSeek-V4.1-Flash | Opus 5 | 44 | 10 957 | one 640×360 canvas |
| **B** | Opus 5 | DeepSeek-V4.1-Flash | 14 | 4 460 | 384×216 canvas inside a DOM HUD |
| **C** | Fable 5.1 | DeepSeek-V4.1-Flash + Opus 5 | 14 | 3 964 | 320×180 canvas, DOM for everything else |
| **D** | Opus 5 | Opus 5 | 17 | 5 206 | one canvas, ES modules |
| **E** | Astra 6 Pro (Web) | Astra 6 Pro (Web) | 10 | 2 978 | no canvas on the page |
| **F** | Fable 5.1 | Fable 5.1 | 17 | 3 524 | one 640×360 canvas |
| **G** | Fable 5.1 | Opus 5 | 13 | 4 466 | one 480×270 canvas |
| **H** | Opus 5.5 | Sonnet 5.5 | 15 | 7 415 | one 640×360 canvas |
| **I** | Sonnet 5.5 | Sonnet 5.5 | 18 | 10 098 | one 640×360 canvas |
| **J** | Sonnet 5.5 | Opus 5.5 | 16 | 6 285 | one 384×216 canvas |

Line counts cover the JS, CSS and HTML files in each folder, measured on 16 September 2026
(builds H to J on 30 September). They describe size, not quality.

## Play

Open <https://v-songbird.github.io/deadlock-deck-arena/> and pick a build, or tick two or more and
press **Compare**. The URL carries the whole state, so `play.html?g=b,d` is a shareable link to
that exact pairing.

The hub and builds A to G run in Spanish and English. The switch is in the top bar, and each of
those games carries its own ES/EN control. Builds H to J have no language layer yet and play in
Spanish whatever the switch says. `?lang=en` works on any page, and the hub passes your choice
into the game it launches.

To run it locally you need any static file server, because the games load their scripts over HTTP.
Opening `index.html` straight from disk will not work for every build.

```bash
python -m http.server 5199
```

Then open <http://localhost:5199/>. There is no build step, no package to install and no network
call at runtime.

## How the experiment was run

All ten runs had the same conditions:

- **The same prompt**, word for word. It is reproduced in full on the hub, in the original
  Spanish, and in [docs/experiment.md](docs/experiment.md).
- **Maximum reasoning effort** on every orchestrator: `xhigh`, or DeepSeek-V4.1-Flash's own ceiling.
  The orchestrator effort of builds H to J was not recorded, and build J asked its workers for
  `medium` effort.
- **No owner in the loop.** Each orchestrator planned the work, dispatched its workers and
  integrated the result on its own.
- **No dependencies allowed.** Every build came out as plain HTML, CSS and JavaScript.

Only the orchestrator and worker models changed between runs. Builds F and G share an
orchestrator and differ only in the worker. Builds H and I share a worker and differ only in the
orchestrator. Builds I and J share an orchestrator and differ only in the worker, though J's
workers ran at a lower effort. H and J swap the same two models between the roles.

## What this does not show

One run per pairing is an anecdote, not a benchmark. The differences you can see — build size,
architecture, how far each one got with the six-minute loop — come from a single sample each, with
no repeats and no controlled scoring. Read it as ten concrete artefacts to compare by hand, not
as a ranking.

## Repository layout

```text
index.html              the hub
play.html               the player: one game, or several side by side
assets/                 hub stylesheet, scripts, title font, screenshots
games/a-deepseek-x-opus/        build A
games/b-opus-x-deepseek/        build B
games/c-fable-x-deepseek-opus/  build C
games/d-opus-x-opus/            build D
games/e-astra/                  build E
games/f-fable-x-fable/          build F
games/g-fable-x-opus/           build G
games/h-opus-x-sonnet/          build H
games/i-sonnet-x-sonnet/        build I
games/j-sonnet-x-opus/          build J
docs/experiment.md      method, measurements and the full prompt
docs/provenance/        build history recovered from build B's own git repository
```

Each game folder keeps the README, specification and notes its own agents wrote. They disagree
with each other in places; that is part of the record.

## The as-built tag

Tag [`as-built-2026-09`](https://github.com/V-Songbird/deadlock-deck-arena/releases/tag/as-built-2026-09)
points at the first commit, which holds the first five games exactly as the agents delivered them.
Builds F and G arrived later and are tagged separately. Builds H to J have no tag yet; their raw
output ends at commits [`278f0a5`](https://github.com/V-Songbird/deadlock-deck-arena/commit/278f0a5),
[`14bdc54`](https://github.com/V-Songbird/deadlock-deck-arena/commit/14bdc54) and
[`b1d3b16`](https://github.com/V-Songbird/deadlock-deck-arena/commit/b1d3b16). Every
later change to a game — currently only the Spanish/English layer — sits in commits after it, so
the raw output stays recoverable.

## Contributing

This repository is a record of one experiment, so the game code is not maintained and pull requests
that change gameplay will be declined. Issues pointing out a broken build or a wrong claim in the
hub are welcome.

## License

[MIT](LICENSE).
