# Deadlock Deck: El Reloj Anatómico — construcción y hallazgos

Qué se investigó: cómo llevar el concepto de diseño a un prototipo jugable, y en particular si la
mecánica central de **degradación térmica** llegaba a notarse en una partida real de 6 minutos.

Estado: juego completo y jugable. `npm start` sirve en `http://localhost:5173`.

## Qué se construyó

Juego web sin dependencias: ES modules nativos, Canvas 2D y Web Audio API. Cero librerías, cero
build, cero tests, cero assets binarios. El servidor estático usa sólo `node:http`
([server.mjs](server.mjs)).

| Fichero | Papel |
|---|---|
| [src/main.js](src/main.js) | bucle, input, reloj de 360 s, reordenamiento de la torre, cambio de escena |
| [src/state.js](src/state.js) | estado global, meta-progresión en `localStorage`, helpers de click |
| [src/cards.js](src/cards.js) | datos: 58 cartas, 25 planos anatómicos, 6 enemigos |
| [src/body.js](src/body.js) | anatomía: injertos, calor, integridad, mazo derivado del cuerpo |
| [src/combat.js](src/combat.js) | combate por turnos, cosecha, injerto |
| [src/tower.js](src/tower.js) | torre procedural de 4 pisos y su reordenamiento |
| [src/explore.js](src/explore.js) | exploración, salas, trampas, botín, fragua |
| [src/ui.js](src/ui.js) | HUD, mano de cartas y las 6 pantallas |
| [src/sprites.js](src/sprites.js) | pixel art dibujado por código (1630 líneas) |
| [src/render.js](src/render.js) | canvas, paleta, fuente bitmap 4x6 de 68 glifos |
| [src/audio.js](src/audio.js) | drone, arpegio, latido y 14 SFX sintetizados |
| [src/rng.js](src/rng.js) | mulberry32 con semilla |

Resolución interna 448x252, escalado a entero. Contrato completo en [docs/spec.md](docs/spec.md).

## Hallazgo principal: la degradación térmica nacía inerte

El concepto dice que usar cartas potentes desgasta las extremidades hasta romperlas. En la primera
integración eso **no ocurría nunca**.

Medición inicial, sobre 2280 combates simulados con el mazo real:

| escenario | roturas/combate | roturas/run |
|---|---|---|
| juego repartido + injerto tras cada victoria | 0.001 | 0.005 |
| foco en una extremidad, sin injertos | 0.002 | 0.010 |

Causa, en tres capas acumuladas:

1. **Enfriamiento pasivo por turno.** El borrador enfriaba 1 punto al empezar cada turno del jugador,
   mientras una carta tier 1 aportaba 0.5–1.5 de calor. El depósito nunca subía. Medición del
   trabajador de `body.js`: 8 de los 9 planos tier 1 no se sobrecalentaban jamás.
2. **`heatCap` demasiado alto.** Con topes de 5..12 y ~1 punto de calor por extremidad y combate,
   romper una tier 1 exigía ~30 de calor acumulado. Una run tiene ~5 combates.
3. **Castigo por sobrecalentamiento demasiado suave.** Con `integrity` 7..12 y −2 por
   sobrecalentamiento, hacían falta 4–6 ciclos sobre la MISMA extremidad. Con 1.86 sobrecalentamientos
   por combate repartidos entre 6 huecos salían ~14 combates por rotura.

Correcciones aplicadas, en ese orden:

- Se elimina el enfriamiento por turno. Queda `coolAll(body, 1)` una sola vez en `startCombat`
  ([src/combat.js](src/combat.js)). El calor persiste dentro del combate y entre combates; enfriarlo
  pasa a ser cosa de las salas `forge` y del botín `coolant`.
- `heatCap` se retiera a 4 / 5 / 6 por tier (±1 por sabor, rango 3..7) y el `heat` de carta sube a
  bandas por coste: ap 0 → 0..1, ap 1 → 1..2, ap 2 → 2..3, ap 3 → 3..5
  ([src/cards.js](src/cards.js)).
- `OVERHEAT_DAMAGE` pasa de 2 a 4 de integridad ([src/body.js:82](src/body.js:82)). Se eligió esta
  palanca en vez de bajar `integrity` porque es una línea y no obliga a revisar 25 planos.

Resultado final, 980 combates simulados en el escenario realista (juego repartido, injerto tras cada
victoria):

- **0.437 roturas por combate**, dentro del objetivo 0.2–1.0.
- **2.14 roturas por run** de 4.90 combates.
- Histograma por run: `0:30 1:42 2:52 3:35 4:30 5:9 6:2` → el 85% de las partidas pierde al menos
  una extremidad y la mitad pierde dos o más.
- Muñones al final de la run, ya contando los injertos de reemplazo: media 1.925. Ninguna run llegó
  a los 6 muñones.
- 1.716 sobrecalentamientos por combate, calor medio 0.354 del tope.

Es decir: el jugador cosecha pero no da abasto, que es exactamente el bucle que pide el concepto.

## Otros hallazgos de integración

- **Orden de argumentos cruzado.** `ui.js` llamaba `drawAbomination(ctx, body, x, y, t)` cuando la
  firma real es `drawAbomination(ctx, x, y, body, t, opts)`. El sprite del jugador se dibujaba en
  (0,0) y parecía ausente en título, mesa y combate. Lo detectó el trabajador de `explore.js` leyendo
  el fichero ajeno, no el de `ui.js` leyendo el suyo.
- **La mano de cartas pisaba el botón de fin de turno.** Error del contrato inicial: mano desde x=4
  con cartas de 70+3 y botón en x 344..444 no caben en 448 px. El botón se mudó a x 246..326, y
  126..148, dentro de la zona del enemigo, y la mano pasó a ocupar el ancho completo.
- **Legibilidad frente a atmósfera.** Con `drawBackdrop` a pantalla completa, el texto gris sobre
  ladrillo con trama era ilegible. Todos los bloques de texto llevan ahora una placa opaca de
  `PAL.ink` detrás.
- **Coste de la trama.** La primera versión de `drawBackdrop` gastaba 98073 `fillRect` por frame a
  pantalla completa. Se acotó a 12143 limitando cada `dither` a 6000 px escaneados.
- **`initCanvas` se apodera del layout.** `render.js` posiciona el canvas con `position: fixed` y
  escala entera propia, así que el centrado por flex de `index.html` quedaba muerto. `index.html` se
  simplificó para no competir con él.

## Verificación

Cada módulo se verificó con un arnés propio en el scratchpad de sesión, ya borrado:

- `tower.js`: 300 semillas x 20 reordenamientos = 6000 barajados. En todas, 4 pisos, `slab` arriba,
  `exit` abajo, pisos conexos, enlaces simétricos y camino garantizado hasta la salida.
- `explore.js`: 150 pasos automáticos por 50 semillas. **50 de 50 alcanzan el piso 0.** Las 7 clases
  de sala producen su efecto y ninguna lanza.
- `combat.js`: 2236 + 980 combates simulados, 0 errores y 0 cuelgues, con las 14 pruebas de robustez
  en verde.
- `body.js`, `cards.js`, `render.js`, `sprites.js`, `ui.js`, `audio.js`: arneses de no-lanzar y de
  consistencia de datos. `cards.js` sin cartas huérfanas ni planos inexistentes en el botín enemigo.

Verificación real en el navegador, con el juego servido en `http://localhost:5173`: recorrido
completo título → mesa de disección → exploración → combate → cosecha con injerto → muerte por reloj
→ fuga venciendo al archialquimista. Sin errores de consola en ninguna pantalla. El injerto quedó
registrado en `meta.blueprints`, `meta.escapes` subió a 1 y `meta.bestTime` se guardó.

## Límites conocidos

- `meta.bestTime` guarda el tiempo EMPLEADO en escapar, no el restante; por eso la pantalla de fuga lo
  etiqueta `MEJOR FUGA`. Esa línea y `TIEMPO EN LA TORRE` pueden diferir en 1 s por redondeo.
- El reloj se para en `slab`, `harvest`, `death` y `escape`. Es una decisión de diseño, no un fallo:
  el jugador puede pensar el injerto sin presión.
- La simulación de equilibrio sólo cuenta los injertos posteriores a victoria. Las salas `salvage` de
  tipo `limb` también reponen extremidades, así que la partida real es algo más benévola que los
  0.437 medidos.
