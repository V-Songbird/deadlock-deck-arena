# Deadlock Deck: El Reloj Anatómico

Juego de construcción de mazos anatómica en el navegador: eres una abominación recién reanimada con 6 minutos para escapar de una torre alquímica en llamas. Tu mazo es tu cuerpo (cabeza, torso, dos brazos, dos piernas); las cartas potentes sobrecalientan tus miembros hasta romperlos, y cosechas las extremidades de los enemigos para injertarlas.

## Jugar

Abre `index.html` en un navegador moderno (doble clic funciona; también sirve cualquier servidor estático). Sin dependencias ni instalación.

- **Teclado**: flechas o WASD para moverte, `1`–`9` para jugar cartas, `E`/Enter para terminar el turno, Enter para los botones principales, Esc para salir de Planos/Tienda.
- **Táctil**: desliza o toca el mapa para moverte, toca las cartas y los botones. Mejor en horizontal.
- El sonido se activa con la primera pulsación o toque.
- **Idioma**: botón `ES`/`EN` en el título y en las pantallas de victoria y muerte; también `?lang=en` / `?lang=es` en la URL. La elección se guarda en `localStorage` (`dd-lang`). Sin parámetro ni elección guardada, el juego sale en español.

## Estructura

- `js/i18n.js` capa de texto español/inglés (diccionario, `?lang=`, `localStorage`).
- `js/core.js` lienzo, entrada, interfaz inmediata, guardado.
- `js/sprites.js` todo el pixel art definido a mano.
- `js/data.js` planos anatómicos, cartas, enemigos, recursos, trampas, cosméticos.
- `js/sound.js` banda sonora y efectos sintetizados con Web Audio.
- `js/tower.js` generación procedural y mutación de los pisos.
- `js/combat.js` combate por turnos con degradación térmica.
- `js/game.js` máquina de estados, reloj de 6 minutos, bucle de muerte, cosecha, tienda y códice.

Documentación de diseño y pruebas en `docs/`.
