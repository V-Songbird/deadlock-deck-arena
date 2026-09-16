# Deadlock Deck Arena

Five playable browser games built from one identical prompt by five different AI
orchestrator/worker pairings, with a hub that launches any of them or runs several side by side
in the same window.

**[Open the arena →](https://v-songbird.github.io/deadlock-deck-arena/)**

The prompt asked for *Deadlock Deck: El Reloj Anatómico* — a gothic-alchemical roguelike where
your card deck is your body, limbs overheat and break, and you have six real minutes to escape a
burning tower. Nobody intervened while the agents built it. What each pairing handed back is in
this repository, unedited.

## The five builds

| | Orchestrator | Worker | Files | Lines | Rendering |
|---|---|---|---|---|---|
| **A** | DeepSeek | Opus 5 | 44 | 10 957 | one 640×360 canvas |
| **B** | Opus 5 | DeepSeek | 14 | 4 460 | 384×216 canvas inside a DOM HUD |
| **C** | Fable 5.1 | DeepSeek + Opus 5 | 14 | 3 964 | 320×180 canvas, DOM for everything else |
| **D** | Opus 5 | Opus 5 | 17 | 5 206 | one canvas, ES modules |
| **E** | Astra | Astra | 10 | 2 978 | no canvas on the page |

Line counts cover the JS, CSS and HTML files in each folder, measured on 16 September 2026. They
describe size, not quality.

## Play

Open <https://v-songbird.github.io/deadlock-deck-arena/> and pick a build, or tick two or more and
press **Compare**. The URL carries the whole state, so `play.html?g=b,d` is a shareable link to
that exact pairing.

The hub runs in Spanish and English. The switch is in the top bar, and `?lang=en` works on any
page. The games are still Spanish-only.

To run it locally you need any static file server, because the games load their scripts over HTTP.
Opening `index.html` straight from disk will not work for every build.

```bash
python -m http.server 5199
```

Then open <http://localhost:5199/>. There is no build step, no package to install and no network
call at runtime.

## How the experiment was run

All five runs had the same conditions:

- **The same prompt**, word for word. It is reproduced in full on the hub, in the original
  Spanish, and in [docs/experiment.md](docs/experiment.md).
- **Maximum reasoning effort** on every orchestrator: `xhigh`, or DeepSeek's own ceiling.
- **No owner in the loop.** Each orchestrator planned the work, dispatched its workers and
  integrated the result on its own.
- **No dependencies allowed.** Every build came out as plain HTML, CSS and JavaScript.

Only the orchestrator and worker models changed between runs.

## What this does not show

One run per pairing is an anecdote, not a benchmark. The differences you can see — build size,
architecture, how far each one got with the six-minute loop — come from a single sample each, with
no repeats and no controlled scoring. Read it as five concrete artefacts to compare by hand, not
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
docs/experiment.md      method, measurements and the full prompt
docs/provenance/        build history recovered from build B's own git repository
```

Each game folder keeps the README, specification and notes its own agents wrote. They disagree
with each other in places; that is part of the record.

## The as-built tag

Tag [`as-built-2026-09`](https://github.com/V-Songbird/deadlock-deck-arena/releases/tag/as-built-2026-09)
points at the first commit, which holds the five games exactly as the agents delivered them. Every
later change to a game sits in commits after it, so the raw output stays recoverable.

## Contributing

This repository is a record of one experiment, so the game code is not maintained and pull requests
that change gameplay will be declined. Issues pointing out a broken build or a wrong claim in the
hub are welcome.

## License

[MIT](LICENSE).
