# Deadlock Deck: El Reloj Anatómico — build I

Orquestador: Sonnet 5.5 · Trabajadores: Sonnet 5.5 (once agentes en total, ver `docs/build-log.md`).

Juego de navegador en HTML, CSS y JavaScript plano. Sin dependencias, sin paso de compilación, sin red,
sin tests. Abre `index.html` con cualquier servidor estático (`python -m http.server`) o directamente desde disco.

## Cómo se juega

- **Mesa de disección:** cada vida (run) despierta con un **cuerpo base distinto** (la primera siempre es El Jornalero).
  Puedes injertar hasta 3 **planos anatómicos ya descubiertos** antes de pulsar **¡DESPERTAR!**.
- **Torre en llamas, 6:00 de reloj real:** tres pisos de laberinto procedural. Cada ~18 s unas **compuertas de latón**
  se abren o se cierran (con aviso de 2 s; siempre queda camino). El **fuego** avanza más rápido cuanto menos
  tiempo queda. Hay trampas (pinchos, ácido, vapor), recursos (viales de sangre, refrigerante, suturas, Éter) y
  **frascos con extremidades**. La escalera o la salida se ve siempre, aun entre la niebla.
- **Combate por turnos rápido:** tu mazo son las cartas de tus **seis extremidades** (cabeza, torso, 2 brazos,
  2 piernas), 3 por extremidad. Cada carta **calienta** la extremidad que la juega. Al pasar de 100 de calor se
  **sobrecalienta** y pierde integridad; algunas cartas además la desgastan. Con integridad 0 la extremidad
  **se rompe**: pierdes sus cartas y luchas con un **muñón** (una carta débil) hasta injertar un reemplazo.
- **Cosecha:** tras vencer a un monstruo o a un científico corrupto, **injerta** su extremidad (descubres su plano),
  **devórala** (+12 PV y enfría) o **déjala**.
- **Escapar:** cruza la salida del piso 3 antes de las 0:00. Si mueres, te destruyen o se acaba el tiempo, tu
  espíritu despierta en **otra mesa con otro cuerpo base**. Conservas los planos (Códice) y la torre se regenera.
- **Extras:** Códice de 20 planos y tienda del alquimista (pieles, puntadas, ojos y cuerpos base, con Éter ganado
  jugando). El «Paquete del Alquimista» es una **demostración sin pagos reales**.

Controles: flechas/WASD, Enter/Espacio, `1`–`9` para jugar cartas, `E` para terminar turno, `P`/Esc para pausar,
`M` para silenciar. Ratón y táctil: toca las cartas y botones; en exploración mantén pulsado para caminar hacia el
puntero. Mando (Gamepad API): cruceta/stick, A, B, X, Start.

## Contenido

20 extremidades (5 cabezas, 4 torsos, 6 brazos, 5 piernas) con 60 cartas únicas, 10 enemigos (monstruos y
científicos, incluido un élite), 5 cuerpos base (2 se compran), 14 cosméticos, 3 pisos con temas propios,
7 pistas musicales y 36 efectos, todo generado por código (arte pixel art procedural y audio con Web Audio).

## Archivos

| Archivo | Contenido |
|---|---|
| `docs/design.md` | contrato de diseño que escribió el orquestador antes de lanzar a los trabajadores |
| `docs/build-log.md` | cómo se construyó, qué falló y qué se corrigió |
| `js/config.js` | constantes, paleta y utilidades compartidas (orquestador) |
| `js/core.js`, `js/main.js`, `index.html`, `style.css` | fuente de píxeles, UI, entrada, escenas, guardado, bucle |
| `js/run.js` | partida, reloj de 6:00, HUD, pausa y flujo entre escenas |
| `js/data.js`, `js/body.js` | extremidades, cartas, enemigos, cuerpos base, cosméticos y modelo del cuerpo |
| `js/tower.js`, `js/explore.js` | laberinto procedural cambiante y escena de exploración |
| `js/combat.js` | combate por turnos y cosecha |
| `js/meta.js` | título, mesa de disección, Códice, tienda y resultados |
| `js/sprites.js`, `js/chars.js` | pixel art procedural: mundo, iconos, fondos, jugador y enemigos |
| `js/audio.js` | banda sonora y efectos sintetizados |

## Limitaciones conocidas

- Nadie pudo **escuchar** el audio durante la construcción: se verificó por análisis (niveles, espectro, bucles
  sin cortes, sin fugas de nodos), no de oído. Solo se probó en Chromium; no en Safari, Firefox ni móviles reales.
- En vertical el lienzo queda pequeño (se muestra un aviso para girar el dispositivo). El escalado no entero
  deja píxeles de anchos ligeramente desiguales.
- Sin capa de idioma: el juego está solo en español.
- El equilibrio se midió con bots, no con personas: en la primera run ganan ~28–40 %; con muchos planos, mucho más.
