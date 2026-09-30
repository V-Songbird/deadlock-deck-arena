# Deadlock Deck: El Reloj Anatómico

A pixel-art roguelike deckbuilder for the browser. You are a reanimated abomination with six minutes to escape a burning alchemical tower, and your limbs are your deck. The game text is in Spanish (Mexico).

## How it plays

- **Explore** a tower of three floors. The labyrinth shifts every 35 seconds, fire spreads, and traps wait in the corridors.
- **Fight** in fast turn-based combat. Each limb you wear (head, torso, two arms, two legs) gives you its own cards.
- **Overheat:** strong cards heat their limb. Heat past the limb's limit wears it down, and a broken limb leaves a stump with weak cards.
- **Harvest** limbs from fallen enemies and graft them onto your body.
- **Escape** through the exit, past the boss, before the clock reaches zero.
- If you die or time runs out, you wake on a new dissection table with a new base body. You keep the anatomical blueprints you discovered, and the tower is generated again.

## Requirements

A current browser with canvas and WebAudio, such as Edge, Chrome, Firefox or Safari. There is nothing to install and no build step. It was tested in Edge.

## Run it

1. Open `index.html` in your browser. Double-clicking the file works; any static file server works too.
2. Press any key or tap the screen once to unlock the sound.

Expected result: the title screen shows the game logo over a burning tower, with the menu JUGAR, PLANOS, GABINETE, AJUSTES and CÓMO JUGAR. Choose JUGAR to reach the dissection table, then DESPERTAR to start the six-minute clock.

If the screen stays black, check that JavaScript is enabled and open the browser console for the error message.

## Controls

| Input | Move | Confirm | Back | Pause | Other |
|---|---|---|---|---|---|
| Keyboard | Arrows or WASD | Enter, Space or Z | X or Backspace | Esc or P | M mutes, F toggles fullscreen |
| Gamepad | D-pad or left stick | A | B | Start | |
| Touch | On-screen d-pad | Tap buttons and cards | | On-screen pause button | |

Progress (blueprints, essence, skins, settings) is saved in the browser's local storage.

## Where to go next

- [Architecture and rules](docs/knowledge/architecture.md): module layout, data shapes and game rules.
- [Original game brief](docs/knowledge/game-concept.md): the concept this build implements.
- Bugs and questions: the project has no issue tracker or support channel yet.
- License: the project has no license file yet.
