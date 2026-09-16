# Deadlock Deck: El Reloj Anatómico — Contrato técnico

Juego web sin dependencias. ES modules nativos, Canvas 2D, Web Audio API.
Servidor estático propio (`server.mjs`, sólo `node:http`). **Sin tests. Sin build. Sin librerías.**

Todo el texto visible al jugador se **escribe en español**; `src/lang.js` le superpone una capa de inglés
(ver [docs/language-layer.md](language-layer.md)). Código, comentarios e identificadores en **inglés**.

## Resolución y estilo

- Canvas interno **448 x 252** (16:9), escalado a entero, `imageSmoothingEnabled = false`.
- Pixel art dibujado por código (sin assets binarios). Fuente bitmap 4x6 propia.
- Paleta gótico-alquímica fija (exportada por `render.js`, ver abajo).

## Árbol de ficheros y dueño

| Fichero | Contenido |
|---|---|
| `index.html` | shell, canvas, css |
| `server.mjs` | servidor estático `node:http` |
| `src/main.js` | bucle, input, cambio de escena, reloj |
| `src/state.js` | objeto `state` global, meta-progresión, run |
| `src/rng.js` | PRNG con semilla |
| `src/render.js` | canvas, paleta, fuente bitmap, primitivas |
| `src/sprites.js` | pixel art: jugador, enemigos, fondos, iconos |
| `src/cards.js` | DATOS: cartas, planos de extremidad, enemigos |
| `src/body.js` | anatomía, injertos, calor, mazo derivado |
| `src/tower.js` | torre procedural + reordenamiento |
| `src/combat.js` | combate por turnos |
| `src/explore.js` | escena de exploración (lógica + dibujo) |
| `src/ui.js` | HUD, mano de cartas, paneles, pantallas |
| `src/audio.js` | música sintetizada + SFX guturales |
| `src/lang.js` | idioma activo, diccionario ES->EN y `t()` |

## Escenas

`'title' | 'slab' | 'explore' | 'combat' | 'harvest' | 'death' | 'escape'`

El **reloj de 6 minutos (360 s)** corre SÓLO en `explore` y `combat`. `main.js` lo decrementa.

## state.js (contrato)

```js
export const state = {
  scene: 'title',
  meta: { blueprints: {}, runs: 0, escapes: 0, bestTime: null }, // blueprints: { [blueprintId]: true }
  run: null,      // ver newRun
  combat: null,   // ver combat.js
  harvest: null,  // ver combat.js
  input: {        // rellenado por main.js cada frame
    mx: 0, my: 0,          // coords en espacio 448x252
    down: false,           // boton pulsado ahora
    clicked: false,        // click liberado este frame (consumir con consumeClick())
    keys: new Set(),       // teclas mantenidas (e.key en minusculas)
    pressed: new Set(),    // teclas pulsadas este frame
  },
  t: 0,           // segundos desde el arranque (para animaciones)
  toast: null,    // { text, ttl } mensaje flotante
};
export function newRun(seed)            // crea state.run y lo devuelve
export function toast(text, ttl = 2.2)  // mensaje en pantalla
export function consumeClick()          // -> bool, true una sola vez por click
export function hit(x, y, w, h)         // -> bool, raton dentro del rect
export function clickIn(x, y, w, h)     // -> bool, hit() + consumeClick()
export function saveMeta()
export function loadMeta()              // localStorage 'deadlock-deck-meta'
```

`state.run = { seed, rng, tower, roomId, body, hp, maxHp, timeLeft: 360, shuffleAt: 45, elixirs: 0 }`

## rng.js

```js
export function makeRng(seed)  // seed: number
// -> { seed, next(), int(n), range(a,b), chance(p), pick(arr), shuffle(arr) }
```

## render.js

```js
export const W = 448, H = 252;
export const PAL = {
  void:'#0b0a10', ink:'#15121c', grave:'#221c2b', stone:'#332a3d', ash:'#4a3f55',
  bone:'#d9cfb8', pale:'#f2ead9', blood:'#8c1c2b', gore:'#c2354a', flesh:'#a8596b',
  brass:'#b98b3c', copper:'#8a5a2b', rust:'#6b3a24', bile:'#7fa84a', acid:'#b7d94a',
  ichor:'#4ad9a5', arcane:'#8a5cd9', violet:'#5c3d8a', spark:'#d9d24a',
  ember:'#e07a2b', fire:'#f2b03c', cold:'#4a7fd9'
};
export function initCanvas(canvas)               // -> ctx; gestiona escala entera y resize
export function toGame(canvas, clientX, clientY) // -> {x,y} en espacio de juego
export function clear(ctx, color)
export function rect(ctx, x, y, w, h, color)
export function line(ctx, x0, y0, x1, y1, color)
export function frame(ctx, x, y, w, h, border, fill)    // panel 1px con esquinas recortadas
export function text(ctx, str, x, y, color, scale = 1)  // fuente 4x6, avance 5px, \n soportado
export function textW(str, scale = 1)
export function textCenter(ctx, str, cx, y, color, scale = 1)
export function bar(ctx, x, y, w, h, pct, fg, bg)       // pct 0..1
export function dither(ctx, x, y, w, h, color, density) // trama 0..1 para niebla/humo
```

La fuente bitmap cubre `A-Z`, `0-9`, y `. , : ; ! ? ' " - + / % ( ) < > * =` y espacio, además de
acentos españoles (`Á É Í Ó Ú Ñ ¡ ¿`). Las minúsculas se dibujan como mayúsculas. Alto de glifo 6 px.

## cards.js (sólo datos, sin lógica)

```js
export const CARDS = { [id]: {
  id, name,                 // nombre en espanol, <= 16 chars
  type: 'attack'|'skill'|'power',
  ap,                       // coste de accion (0..3)
  heat,                     // calor aplicado a la extremidad de origen (0..5)
  desc,                     // <= 60 chars, espanol
  effects: [ ... ],
} };
```

Efectos soportados (`combat.js` los implementa todos, **no inventar otros**):

- `{ kind:'damage', amount }` daño al enemigo
- `{ kind:'hits', amount, times }` golpes múltiples
- `{ kind:'block', amount }` bloqueo propio este turno
- `{ kind:'heal', amount }` cura hp del jugador
- `{ kind:'cool', amount }` enfría TODAS las extremidades
- `{ kind:'repair', amount }` repara integridad de la extremidad de origen
- `{ kind:'draw', amount }` roba cartas
- `{ kind:'ap', amount }` gana acciones
- `{ kind:'limbDamage', amount }` daña una extremidad del enemigo (facilita cosecha)
- `{ kind:'status', status, amount, to }` status: `'weak'|'frail'|'burn'|'strength'|'thorns'`; to: `'enemy'|'self'`
- `{ kind:'selfHarm', amount }` daño a hp propio
- `{ kind:'exhaust' }` la carta se destruye al usarla

```js
export const LIMBS = { [id]: {
  id, slot: 'head'|'torso'|'arm'|'leg',   // familia
  name,                                   // espanol, <= 18 chars
  desc,                                   // <= 48 chars
  tier: 1|2|3,
  integrity,                              // 5..12
  heatCap,                                // 3..7 (tier 1 -> 4, tier 2 -> 5, tier 3 -> 6)
  hpBonus,                                // solo torso/head; 0 en otros
  cards: [cardId, ...],                   // 2..3 cartas
  color,                                  // clave de PAL para el sprite
} };

export const ENEMIES = { [id]: {
  id, name, tier: 1|2|3, hp,
  limbs: [blueprintId, ...],              // botin de cosecha (2..4)
  moves: [ { name, kind:'attack'|'multi'|'limbstrike'|'block'|'buff'|'debuff', amount, times, weight } ],
  color, quip,
} };
```

Contenido mínimo obligatorio:

- **6 cabezas**, **5 torsos**, **8 brazos**, **6 piernas** (tier 1 básicos → tier 3 raros).
- **>= 40 cartas** distintas, cada plano con sus propias cartas. Nada de cartas huérfanas.
- **6 enemigos**: `injertado`, `aprendiz`, `sabueso`, `cirujano`, `bibliotecario`, `archialquimista`
  (tier 3, guardián de la salida).
- `export const BASIC = { head:[...], torso:[...], arm:[...], leg:[...] }` con ids tier 1 por familia.
- `export const STUMP_CARDS = ['golpeMunon']` carta de muñón (1 ap, 2 daño, 0 calor).

Tono: gótico alquímico, macabro, español. Ej. "Brazo Guillotina", "Torso Caldera", "Cráneo Vidente".

## body.js

```js
export const SLOTS = ['head','torso','armL','armR','legL','legR'];
export function family(slot)              // 'armL' -> 'arm'
export function makeLimb(blueprintId)     // -> { id, blueprint, slot, name, integrity, maxIntegrity, heat, heatCap }
export function makeBody(rng, picks = {}) // picks: { slot: blueprintId }; el resto tier 1 aleatorio
export function deck(body)                // -> [{ cardId, slot }] mazo derivado; munones aportan STUMP_CARDS
export function handSize(body)            // 3 + brazos intactos, min 2, max 6
export function maxHp(body)               // 30 + suma de hpBonus
export function addHeat(body, slot, amount) // -> { overheated, broke } (calor >= heatCap: -4 integridad, calor a 0)
export function coolAll(body, amount)
export function damageLimb(body, slot, amount) // -> { broke }
export function repairLimb(body, slot, amount)
export function graft(body, slot, blueprintId) // -> blueprint sustituido o null
export function stumps(body)              // -> [slot, ...]
export function intact(body)              // -> [limb, ...]
```

Romper una extremidad la pone a `null` en el body (muñón). Sus cartas desaparecen del mazo.
Penalizaciones por muñón: brazo → mano más pequeña; pierna → el enemigo golpea +25% por pierna
perdida; cabeza → -1 ap máximo; torso → -8 hp máximo (vía `maxHp`).

## tower.js

```js
export function generateTower(rng)
// -> { floors: [ { index, rooms: [Room] } ], startRoomId, exitRoomId, shuffles: 0 }
// Room = { id:'f2r3', floor, idx, type, x, y, name, cleared:false, payload, exits:[roomId] }
// type: 'slab' | 'combat' | 'salvage' | 'trap' | 'forge' | 'stairs' | 'exit'
// payload: combat -> { enemyId }; salvage -> { kind:'limb'|'elixir'|'coolant', blueprintId? };
//          trap -> { kind:'blades'|'steam'|'collapse', amount }; resto -> null
export function shuffleTower(tower, rng, currentRoomId)
export function roomById(tower, id)
export function pathExists(tower, fromId, toId)
export function neighbors(tower, roomId)  // -> [Room]
```

4 pisos (index 3 = arriba, laboratorio con `slab`; index 0 = abajo, con `exit`). 5..7 salas por piso,
coordenadas `x,y` en rejilla para el mapa. Cada piso tiene >= 1 `stairs` que enlaza con el piso inferior.
La sala `exit` (piso 0) está guardada por el `archialquimista`: entrar con el guardián vivo inicia ese
combate; al ganar, se escapa.

`shuffleTower` = "laberinto en constante cambio": reenlaza corredores de cada piso. Invariantes: la sala
actual conserva >= 1 salida, y existe camino desde la actual hasta `exit` (verificar con `pathExists`).

## combat.js

```js
export function startCombat(state, enemyId)
// state.combat = { enemy:{ id,name,hp,maxHp,color,limbs:[{blueprint,integrity}],quip },
//   hand:[], drawPile:[], discard:[], ap, apMax, block,
//   self:{weak,frail,burn,strength,thorns}, foe:{weak,frail,burn,strength,thorns},
//   intent:{kind,amount,times,name}, turn:1, phase:'player'|'enemy'|'won'|'lost',
//   log:[string], anim:{ shake:0, flashFoe:0, flashSelf:0 } }
export function playCard(state, handIndex)  // -> { ok, reason? }
export function endTurn(state)
export function tick(state, dt)
export function beginHarvest(state)                   // state.harvest = { limbs:[{blueprint,integrity}], done:false }
export function applyHarvest(state, limbIndex, slot)  // injerta y registra el plano en meta
```

Reglas: `apMax = 3` (-1 si falta cabeza). El bloqueo se pierde al inicio del turno del jugador.
`weak`: -25% daño infligido. `frail`: +25% daño recibido. `burn`: daño al final del turno.
`strength`: +1 daño por punto. `thorns`: devuelve daño al atacante.
El enemigo `limbstrike` daña integridad de una extremidad aleatoria del jugador además de hp.
Jugar una carta aplica su `heat` a la extremidad de origen vía `addHeat`. Si se rompe, sus cartas
restantes se retiran de mano/mazo/descarte, `toast(...)` y `audio.sfx('break')`.
Mazo vacío: se remezcla la descarta. Enfriamiento: **`coolAll(body, 1)` UNA sola vez en `startCombat`**, NO por turno. El calor persiste dentro del combate y entre combates: enfriarlo es cosa de las salas `forge` y `coolant` y de las cartas con efecto `cool`. Sin esto la degradación térmica nunca llega a morder.

## explore.js

```js
export function enterRoom(state, roomId)   // resuelve el tipo de sala
export function update(state, dt)          // reordenamiento de la torre, input de mapa
export function draw(ctx, state)           // mapa del piso, sala actual, backdrop, jugador
```

Navegación: click en sala adyacente del mapa, o teclas `1..6` sobre las adyacentes listadas.
`f` baja por las escaleras si la sala actual es `stairs`.

## ui.js

```js
export function drawHud(ctx, state)
export function drawBody(ctx, state, x, y) // panel anatomico (6 slots, calor + integridad)
export function drawCombat(ctx, state)
export function drawTitle(ctx, state)
export function drawSlab(ctx, state)       // elegir hasta 3 planos descubiertos y despertar
export function drawHarvest(ctx, state)
export function drawDeath(ctx, state)
export function drawEscape(ctx, state)
export function drawToast(ctx, state)
```

Cartas a 72x92 px, hasta 6 en la fila inferior. Estados: normal / sin AP (atenuada) / hover (elevada
4 px). Click en carta = jugarla. Cada pantalla define sus rects y usa `clickIn()`.
El reloj cambia de color: `bone` > 2:00, `fire` < 2:00, `gore` < 0:30, parpadea < 0:10.

## audio.js

```js
export const audio = {
  init(), startMusic(), stopMusic(),
  setTension(t),          // 0..1 (tiempo consumido)
  sfx(name),              // 'card','hit','hurt','graft','break','squelch','trap','step','heat',
                          // 'death','escape','select','deny','enemy'
  toggleMute(), muted: false,
};
```

Sólo osciladores, ruido generado en buffer y filtros. Nada de ficheros. Drone ominoso + arpegio menor
+ latido que acelera con la tensión. SFX guturales: ruido filtrado con envolventes cortas.

## main.js

Bucle `requestAnimationFrame` con `dt` limitado a 0.05 s. Recoge input, decrementa `timeLeft` en
`explore`/`combat`, llama a `audio.setTension(1 - timeLeft/360)`, despacha update/draw por escena,
dibuja HUD + toast. `m` silencia. `timeLeft <= 0` o `hp <= 0` → escena `death`.

## Criterios de terminado

1. `npm start` sirve en `http://localhost:5173` y el juego arranca sin errores de consola.
2. Se puede: despertar, explorar, combatir, cosechar una extremidad, romper una extremidad por calor,
   ver la torre reordenarse, morir por reloj, y escapar venciendo al archialquimista.
3. Cero dependencias en `package.json`. Cero ficheros de test.

## Addenda de integración (autoritativa, escrita por el orquestador)

Ya existen y NO se tocan: `index.html`, `server.mjs`, `package.json`, `src/state.js`, `src/main.js`.

Diferencias reales respecto al borrador de arriba:

1. `state.js` exporta además: `RUN_SECONDS = 360`, `newRun(seed, picks = {})`, `pressed(key)`,
   `discover(blueprintId)` (registra un plano en `meta` y guarda), `toast`, `consumeClick`, `hit`,
   `clickIn`, `saveMeta`, `loadMeta`.
2. `state.run` incluye además `guardAlive: true` (el archialquimista guarda la salida), `kills`, `grafts`,
   y `shuffleAt` cuenta hacia abajo desde 315.
3. **El reordenamiento de la torre lo hace `main.js`**, no `explore.js`. `explore.update` NO debe llamar
   a `shuffleTower` ni tocar `timeLeft`.
4. **Las transiciones de escena de las pantallas las hace `ui.js`**: `drawTitle`, `drawSlab`,
   `drawHarvest`, `drawDeath` y `drawEscape` dibujan Y gestionan su propio input, y asignan
   `state.scene` directamente. `main.js` sólo despacha, lleva el reloj y mata al jugador.
5. `main.js` ya gestiona: ratón, tacto, teclado (`state.input`), `m` para silenciar, el reloj,
   `audio.setTension`, la muerte por reloj o por hp, el `toast` y su caducidad. No lo repliques.
6. `main.js` limpia `state.input.clicked` y `state.input.pressed` al final de cada frame: consume el
   input durante el dibujo de la escena, no después.
7. Si un módulo del que dependes todavía no existe cuando verifiques, otro trabajador lo está
   escribiendo en paralelo: reintenta la lectura cada pocos segundos antes de rendirte, y programa
   contra la API del contrato, no contra lo que veas en el fichero.
8. La escena `escape` se alcanza al vencer al `archialquimista` en la sala `exit`: `combat.js` pone
   `run.guardAlive = false`, `meta.escapes += 1`, `meta.bestTime` y `state.scene = "escape"`.
