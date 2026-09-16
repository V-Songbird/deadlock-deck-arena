# Deadlock Deck: El Reloj Anatómico

Prototipo jugable en el navegador: una abominación recién reanimada tiene **6 minutos** para
escapar de una torre alquímica en llamas. Tu mazo es tu cuerpo: cada extremidad injertada aporta
sus cartas, las cartas potentes sobrecalientan la extremidad que las juega, y una extremidad rota
se convierte en un muñón hasta que cosechas un reemplazo de un enemigo caído. Si mueres o el reloj
llega a cero, despiertas en una nueva mesa de disección con un cuerpo base nuevo; conservas los
planos anatómicos descubiertos y la torre se regenera.

## Jugar

Abre `index.html` en un navegador moderno (doble clic funciona: no hay build, dependencias ni
red). Funciona en PC y en móvil.

| Acción | Teclado | Táctil |
|---|---|---|
| Moverse por la torre | WASD / flechas | cruceta en pantalla |
| Jugar carta 1..5 | `1`..`5` | tocar la carta |
| Terminar turno | `E` / espacio | botón `Terminar turno` |
| Botón principal | `Enter` | tocar |
| Silenciar | `M` | botón `Sonido` |

## Bucle de juego

1. **Mesa de disección**: cuerpo base aleatorio; cambia cada extremidad por un plano descubierto.
   La tienda (compras simuladas con esencia, sin dinero real) vende tintes y packs de planos.
2. **Explorar**: 3 pisos de laberinto procedural con enemigos, recursos y trampas. Cada 45 s el
   laberinto se retuerce (nuevas paredes) y aparece un enemigo más.
3. **Combatir**: combate por turnos con las cartas de tus extremidades. El calor rompe extremidades.
4. **Cosechar**: al vencer, injerta una extremidad del enemigo y descubre su plano.
5. **Escapar**: alcanza la salida del piso 3 antes de que el reloj marque 0:00.

## Código

Vanilla JavaScript en `js/` (un módulo por archivo, cargados en orden desde `index.html`):
`data` (planos, cartas, enemigos), `sprites` (pixel art procedural), `audio` (música y efectos
sintetizados con Web Audio), `body`, `tower`, `combat`, `game`, `ui`. El contrato completo está en
`PRODUCT.md`; el registro de construcción, en `docs/build-log.md`.
