# Deadlock Deck: El Reloj Anatómico — build H

Orquestador: Opus 5.5 · Trabajadores: Sonnet 5.5 (cinco agentes).

Juego de navegador en HTML, CSS y JavaScript plano. No usa dependencias, paso de compilación ni red.
Abre `index.html` desde cualquier servidor estático o directamente desde disco.

## Cómo se juega

- **Mesa de disección:** eliges un cuerpo base (cada bucle te toca uno al azar) e injertas planos
  anatómicos ya descubiertos. Pulsa **¡DESPERTAR!**.
- **Torre:** tres pisos procedurales en llamas. El fuego se extiende más rápido cuanto menos
  tiempo queda. Cada ~20 s la torre se reconfigura y los muros de latón se abren o cierran. Hay
  trampas de pinchos, ácido y vapor. Los recursos son viales de sangre, refrigerante, suturas,
  Éter y frascos con extremidades.
- **Combate por turnos:** tu mazo son las cartas de tus seis extremidades (cabeza, torso, 2
  brazos, 2 piernas). Cada carta calienta su extremidad. Al llegar a 100 de calor se sobrecalienta
  y pierde integridad, y algunas cartas la desgastan directamente. Con integridad 0 la extremidad
  se rompe: pierdes sus cartas y luchas con un muñón.
- **Cosecha:** tras vencer, injerta una extremidad del enemigo (así descubres su plano), devórala
  (+8 PV) o déjala.
- **Escapa:** en el piso 3, derrota al Rector Carnicero y cruza la salida antes de que el reloj
  llegue a 0:00. Si mueres o se acaba el tiempo, tu espíritu despierta en una nueva mesa. Conservas
  los planos y la torre se regenera.
- **Extras:** el Códice de planos y una tienda de cosméticos y cuerpos base que se paga con Éter
  ganado jugando. El paquete "premium" es una demo sin pagos reales.

Controles: WASD/flechas, Enter/Espacio, 1–9 para jugar cartas, E para terminar el turno, P/Esc
para pausar. Ratón y táctil: haz clic y mantén pulsado para avanzar. También funciona con mando
(Gamepad API).

## Archivos

| Archivo | Autor | Contenido |
|---|---|---|
| `docs/design.md` | orquestador | contrato de diseño que siguieron todos los trabajadores |
| `index.html`, `style.css`, `js/core.js`, `js/meta.js`, `js/main.js` | W1 | API común, flujo de partida, reloj, HUD, menús, tienda, códice |
| `js/data.js`, `js/body.js`, `js/combat.js` | W2 | extremidades, cartas, enemigos, modelo del cuerpo, combate y cosecha |
| `js/tower.js`, `js/explore.js` | W3 | generación procedural y exploración |
| `js/sprites.js`, `js/audio.js` | W4 | pixel art procedural y audio sintetizado con WebAudio |
| (todos) | W5 | QA de integración y pulido |

El historial de construcción está en `docs/build-log.md`.
