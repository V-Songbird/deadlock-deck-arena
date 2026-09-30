# Deadlock Deck: El Reloj Anatómico — contrato de diseño (build I)

Escrito por el orquestador (Sonnet 5.5) antes de lanzar a los trabajadores (Sonnet 5.5). **Todos los trabajadores
lo siguen al pie de la letra.** Si algo es ambiguo, eliges lo más simple que respete este texto y lo dejas anotado
en tu informe. Si algo del contrato es inviable, lo dices en el informe; no lo cambias por tu cuenta.

## 0. Reglas del trabajo

1. **Sencillo.** Código directo y legible. Sin frameworks, sin dependencias, sin paso de compilación, sin red,
   sin clases innecesarias, sin abstracciones "por si acaso". JavaScript plano (ES5/ES2015 sin módulos),
   scripts clásicos sobre el espacio de nombres global `window.DD`.
2. **Sin tests en el repositorio.** Nada de `test/`, specs ni runners dentro de `games/i-sonnet-x-sonnet/`.
   Para verificar tu trabajo SÍ puedes escribir scripts desechables, pero solo en tu carpeta de scratchpad (te la
   indica el orquestador), nunca en el repositorio.
3. **Solo tocas tus archivos.** Cada archivo tiene un único dueño (§2). No edites `js/config.js` ni archivos de otros.
   No hagas `git commit`, `git add` ni `git push`: lo hace el orquestador.
4. **Independencia del experimento.** Este repositorio contiene otras builds del mismo juego (`games/a-…` a `games/h-…`)
   y un hub. **No las leas ni copies nada de ellas.** Esta build se hace solo con este contrato.
5. **Idioma.** Todo el texto visible del juego en español (con tildes, ¡ y ¿). Comentarios de código en español, pocos.
6. **Estilo de código.** Cada archivo es una IIFE `(function(){ 'use strict'; var DD = window.DD; … })();`
   que cuelga su API de `DD`. Comentarios solo donde el porqué no sea evidente. Sin `console.log` en el código final.
7. **Robustez básica.** Un fallo en un módulo no debe congelar el bucle: `main.js` captura excepciones por fotograma
   y las muestra una vez en consola.
8. **Tu informe final** (lo único que lee el orquestador) es corto: archivos entregados con nº de líneas, cómo
   verificaste, desviaciones del contrato, problemas conocidos y cualquier API extra que hayas añadido.

### Verificación (permitida y recomendada)

Chromium + Playwright están instalados. Receta (en tu scratchpad):

```js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('console', m => console.log('console:', m.text())); p.on('pageerror', e => console.log('PAGEERROR:', e.message));
await p.goto('file:///home/user/deadlock-deck-arena/games/i-sonnet-x-sonnet/index.html');   // o tu propia página de pruebas en scratchpad
await p.screenshot({ path: 'shot.png' });      // luego lo miras con la herramienta Read (muestra imágenes)
```

Mira tus capturas de verdad: el texto, el arte y la maquetación deben verse bien, no solo "cargar sin errores".
`node --check archivo.js` para sintaxis. Para lógica pura (datos, torre) puedes usar `node` con `vm`.
Como los demás módulos pueden no existir aún, crea **stubs mínimos en tu scratchpad** según este contrato.

## 1. El juego, en una página

Eres una **abominación recién reanimada** en un laboratorio alquímico al borde del colapso. La **torre arde** y tienes
**exactamente 6:00** de reloj real para escapar. La torre tiene **3 pisos** (laberintos procedurales que **cambian
constantemente**: compuertas de latón que se abren y cierran) llenos de **monstruosidades y científicos corruptos**.

Tu **mazo es tu cuerpo**: seis extremidades (cabeza, torso, 2 brazos, 2 piernas); cada una aporta su propio conjunto
de 3 cartas. Derrotas enemigos en **combate por turnos rápido**, **cosechas** sus extremidades y las **injertas** para
cambiar tu estilo. Usar cartas potentes **calienta** la extremidad que las juega; al sobrecalentar se **desgasta**; con
integridad 0 **se rompe**: pierdes sus cartas y luchas con un **muñón** hasta encontrar reemplazo.

Si mueres o se acaba el tiempo, tu espíritu despierta en **otra mesa de disección con un cuerpo base nuevo**. **Conservas
los planos anatómicos descubiertos**; la **torre se regenera** proceduralmente. Si llegas a la salida del piso 3 antes
del 0:00, escapas.

### Checklist del concepto (nada se omite) → quién lo cumple

| # | Requisito del concepto | Implementa |
|---|---|---|
| 1 | Abominación reanimada, laboratorio alquímico, torre en llamas (fuego que avanza y daña) | explore (fuego), sprites, meta |
| 2 | Exactamente 6 minutos de reloj; al llegar a 0 la run termina | run.js |
| 3 | Laberinto procedural en constante cambio | tower.js (compuertas que cambian), explore |
| 4 | Monstruosidades **y** científicos corruptos como enemigos | data.js (`kind`), chars.js |
| 5 | Mazo = cuerpo: cabeza, torso, 2 brazos, 2 piernas; cartas únicas por extremidad; cambiar extremidades cambia el estilo | data.js, body.js, combat.js |
| 6 | Degradación térmica: cartas potentes calientan y desgastan; extremidad rota ⇒ pierdes sus cartas ⇒ muñón hasta reemplazo | body.js, combat.js, run.js (barra anatómica) |
| 7 | Combate rápido por turnos con cartas de las extremidades | combat.js |
| 8 | Cosechar: derrotar enemigos y recolectar/injertar sus extremidades | combat.js (escena `harvest`) |
| 9 | Explorar pasillos procedurales, recoger recursos, evitar trampas | tower.js, explore.js |
| 10 | Escapar: llegar a la salida antes de las 6:00 | explore.js, run.js |
| 11 | Bucle muerte/tiempo ⇒ nueva mesa con nuevo cuerpo base; se retienen planos; torre regenerada | run.js, meta.js, core.js (guardado) |
| 12 | Planos anatómicos descubiertos (Códice) y variedad de extremidades/cartas | data.js, meta.js |
| 13 | Estética gótico-alquímica / steampunk en pixel art | sprites.js, chars.js, core.js (fuente) |
| 14 | Banda sonora sintetizada ominosa (electrónica + orquestal) y efectos guturales | audio.js |
| 15 | PC, consola (mando) y móvil (táctil), pantalla adaptable | core.js, main.js, style.css |
| 16 | Gratis con microtransacciones cosméticas y desbloqueo de contenido (simulado, sin cobros reales) | meta.js (tienda), data.js |

## 2. Archivos, dueños y orden de carga

Carpeta: `games/i-sonnet-x-sonnet/`. Orden de `<script>` en `index.html`:

```
js/config.js   (orquestador — ya escrito)
js/core.js     W1  texto con fuente de píxeles, UI, entrada, escenas, guardado, efectos
js/data.js     W2  extremidades, cartas, enemigos, cuerpos base, cosméticos, pisos
js/body.js     W2  modelo del cuerpo
js/sprites.js  W6  tiles, recursos, iconos, fondos
js/chars.js    W7  jugador, enemigos, iconos de extremidades
js/audio.js    W8  música y efectos sintetizados
js/run.js      W1b estado de la partida, reloj, HUD, pausa, flujo entre escenas
js/tower.js    W4  generación procedural y cambios del laberinto
js/explore.js  W4  escena de exploración
js/combat.js   W3  escenas de combate y de cosecha
js/meta.js     W5  escenas título, mesa de disección, códice, tienda, resultados
js/main.js     W1  arranque y bucle principal
```

`index.html` (W1): un `<canvas id="screen" width="640" height="360">`, `style.css` (W1). Sin nada más en la página salvo
un `<noscript>`. Los módulos **solo leen en tiempo de ejecución** lo que otros módulos exponen (nunca en la carga
del script), de modo que el orden entre módulos no importa salvo que `config.js` va primero y `main.js` el último.

## 3. Convenciones compartidas

- **Lienzo lógico 640×360.** Todas las coordenadas son de ese lienzo. `ctx.imageSmoothingEnabled = false` siempre.
  Usa coordenadas enteras al dibujar.
- **Zona segura de escena:** `y ∈ [24, 320)`. Arriba (0–24) el HUD dibuja reloj/vida/piso/Éter/botones; abajo (320–360)
  dibuja la barra anatómica. Las escenas de partida (`explore`, `combat`, `harvest`) no ponen nada importante fuera
  de la zona segura. Las escenas de meta (título, mesa, códice, tienda, resultados) usan los 640×360 completos.
- **Paleta:** `DD.C` (config.js). El arte y la UI se ciñen a esa paleta más sombras/tintes derivados.
- **Ids ASCII** en minúscula con guion bajo, sin tildes (los nombres visibles sí llevan tildes).
- **Cuerpo = JSON plano** (§5); se puede copiar con `JSON.parse(JSON.stringify(x))`.
- **Identificadores de hueco (slot):** `'head' | 'torso' | 'armL' | 'armR' | 'legL' | 'legR'` (`DD.SLOTS`).
  **Tipo de extremidad:** `'head' | 'torso' | 'arm' | 'leg'` (`DD.SLOT_TYPE[slot]`). Un brazo encaja en `armL` o `armR`;
  una pierna en `legL` o `legR`.

## 4. Datos (`data.js`, W2)

Todo se expone en `DD`. Números enteros.

### 4.1 Extremidades — `DD.LIMBS[id]`

```js
{ id:'bra_sierra', name:'Brazo de Sierra', type:'arm', tier:2, integ:45,
  passive:{ dmg:1 },               // claves posibles: hp, energy, draw, cool, dmg, block, speed, vision, fireRes (aditivas)
  cards:['bra_sierra_1','bra_sierra_2','bra_sierra_3'],   // EXACTAMENTE 3 ids de DD.CARDS
  flavor:'Zumba como una colmena furiosa.' }
```

- `integ` = integridad máxima (30–60; tier 1: 30–40, tier 2: 40–50, tier 3: 50–60).
- Pasivas (sumadas de las extremidades **intactas**): `hp` (+vida máx.), `energy` (+energía/turno),
  `draw` (+cartas en mano), `cool` (+calor disipado/turno), `dmg` (+daño plano a cada golpe), `block` (+bloqueo plano a cada
  carta de bloqueo), `speed` (fracción: 0.1 = +10 % velocidad de movimiento), `vision` (+casillas de visión),
  `fireRes` (fracción de daño de fuego/ácido/vapor que se evita, 0.2 = −20 %). Cada extremidad tiene 0–2 pasivas pequeñas y distintivas
  (p. ej. piernas → `speed`; cabezas → `vision`/`draw`; torsos → `hp`/`cool`/`energy`/`block`; brazos → `dmg`).
  Límites: `energy` total ≤ 5, mano ≤ 8 (los aplica `Body.stats`).
- **Roster fijo de ids (20). No añadas, quites ni renombres ids; W6/W7/W8 dibujan contra esta lista:**

| Tipo | ids |
|---|---|
| head (5) | `cab_cosido` (inicial, equilibrada), `cab_sabueso`, `cab_relojero`, `cab_quimera`, `cab_plaga` |
| torso (4) | `tor_remendado` (inicial), `tor_caldera`, `tor_costillar`, `tor_alambique` |
| arm (6) | `bra_muerto` (inicial), `bra_sierra`, `bra_golem`, `bra_tijera`, `bra_piston`, `bra_tentaculo` |
| leg (5) | `pie_muerta` (inicial), `pie_sabueso`, `pie_resorte`, `pie_arana`, `pie_pesada` |

  Nombres visibles sugeridos: Cabeza Cosida, Cabeza de Sabueso, Cabeza de Relojero, Cabeza de Quimera, Máscara de la Plaga;
  Torso Remendado, Torso de Caldera, Costillar de Hierro, Alambique Vivo; Brazo de Cadáver, Brazo de Sierra, Puño de Gólem,
  Tenazas de Cirujano, Brazo de Pistón, Tentáculo Alquímico; Pierna de Cadáver, Patas de Sabueso, Piernas de Resorte,
  Patas de Araña, Botas de Hierro.
- **Identidad de juego** (cada extremidad debe jugar distinto; cambiar piezas cambia el estilo):
  Sabueso = golpes rápidos baratos + vulnerabilidad; Relojero = robo de cartas/energía; Quimera = fuego (quemar) con mucho calor;
  Plaga = debilitar/bloqueo; Caldera = mucho bloqueo/energía pero calor; Costillar = bloqueo pesado; Alambique = curación/enfriar/reparar;
  Sierra = daño alto con desgaste (`wear`); Gólem = puñetazos pesados y bloqueo; Tenazas = vulnerabilidad/precisión; Pistón = multi-golpe con calor;
  Tentáculo = debilitar/quemar; Resorte = golpes + energía/bloqueo; Araña = multi-golpe barato + debilitar; Pesada = bloqueo, patada pesada, aturdir.
- Cada limb debe ser **obtenible**: aparece en `drops` de ≥1 enemigo (las iniciales también). Además los tarros de extremidades pueden dar cualquiera.

### 4.2 Cartas — `DD.CARDS[id]`

```js
{ id:'bra_sierra_1', limb:'bra_sierra', name:'Corte Dentado', cost:1, heat:12, wear:0,
  fx:[{t:'dmg', v:7}], flavor:'…' }       // flavor opcional
```

- `cost` 0–3. `heat` (0–40): calor que la carta añade **a la extremidad dueña (el hueco que la juega)**. `wear` (0–8): integridad que
  pierde esa extremidad al jugar la carta (desgaste directo). Guía: coste 1 → daño 5–8 o bloqueo 5–7, calor 8–16, wear 0;
  coste 2 → daño 10–15 (o combos), calor 18–28, wear 0–3; coste 3 → daño 18–26 (o combos grandes), calor 30–42, wear 2–6.
  Cada extremidad: una carta barata, una media y una "firma" (la más potente, más calor/desgaste). Las iniciales: sin desgaste, poco calor.
- **Vocabulario cerrado de efectos** (`fx` es un array; se resuelven en orden):

| `t` | Campos | Efecto |
|---|---|---|
| `dmg` | `v`, `n`=1 | `n` golpes de daño `v` al enemigo |
| `block` | `v` | el jugador gana `v` de bloqueo |
| `heal` | `v` | el jugador recupera `v` PV |
| `draw` | `v` | roba `v` cartas |
| `energy` | `v` | gana `v` de energía |
| `burn` | `v` | el enemigo gana `v` cargas de quemadura |
| `vuln` | `v` | el enemigo queda vulnerable `v` turnos |
| `weak` | `v` | el enemigo queda débil `v` turnos |
| `stun` | — | el enemigo pierde su próxima acción |
| `cool` | `v`, `all`? | quita `v` de calor a la extremidad dueña (o a todas si `all:true`) |
| `repair` | `v` | devuelve `v` de integridad a la extremidad dueña |
| `selfdmg` | `v` | el jugador pierde `v` PV (ignora bloqueo) |

- **Reglas de combate** (las implementa `combat.js`, las usa `data.js` para el texto):
  - Daño infligido = `floor((v + stats.dmg) × (débil ? 0.75 : 1) × (objetivo vulnerable ? 1.5 : 1))`, mínimo 0. El bloqueo del objetivo se consume primero.
  - Bloqueo ganado = `v + stats.block`. El bloqueo del jugador se pierde al empezar su turno; el del enemigo al empezar el suyo.
  - **Quemadura** (cargas): al empezar el turno del portador recibe daño = cargas (ignora bloqueo) y las cargas bajan en 1.
    **Vulnerable / débil**: duran N turnos, bajan 1 al acabar el turno del portador. **Aturdido**: el enemigo se salta su próxima acción.
  - **Calor:** al jugar una carta, `Body.addHeat(body, slot, card.heat)`. Si supera `HEAT_MAX` ⇒ **sobrecalentamiento**: la extremidad pierde `OVERHEAT_DMG`
    de integridad y su calor baja a `OVERHEAT_RESET`. Además se aplica `card.wear` a la integridad. Con integridad ≤ 0 la extremidad **se rompe** (queda muñón).
  - Al acabar el turno del jugador cada extremidad pierde `stats.cool` de calor.
- **Muñones** — `DD.STUMP_CARDS[type]` para `head|torso|arm|leg`: una carta débil y sin calor por cada hueco vacío
  (mismo formato; `limb:null`; ids `stump_head`, `stump_torso`, `stump_arm`, `stump_leg`). Ej.: brazo `Golpe de Muñón` coste 1, daño 3;
  pierna `Tropiezo` bloqueo 3; cabeza `Cabezazo Torpe` daño 2 + selfdmg 1; torso `Respirar Hondo` bloqueo 2. Son más flojas que cualquier carta real.
- `DD.cardText(card)` → string en español generado desde `fx` (p. ej. `"Inflige 7 de daño."`, `"Gana 6 de bloqueo. Quita 10 de calor a todas."`),
  para que el texto nunca discrepe del efecto. Concisa: la carta es pequeña (≈16 caracteres por línea).
- `DD.STATUS_INFO = { burn:{name:'Quemadura', desc:'…'}, vuln:{…}, weak:{…}, stun:{…} }` (desc corta).

### 4.3 Enemigos — `DD.ENEMIES[id]`

```js
{ id:'sabueso', name:'Sabueso Cosido', kind:'monster',      // 'monster' | 'scientist'
  floors:[0,1],                 // pisos (0-based, inclusive) en los que aparece
  hp:[22,30], ether:[4,8], speed:1.1, sight:6,    // speed = factor de velocidad al explorar; sight = radio (casillas) en el que persigue
  elite:false, dropCount:1,     // dropCount: nº de opciones de extremidad al cosechar (1, o 2 para el élite)
  drops:['cab_sabueso','pie_sabueso'],
  moves:[ {name:'Mordisco', t:'attack', v:6}, {name:'Aullido', t:'debuff', status:'weak', v:2}, {name:'Desgarro', t:'limb', v:8} ],
  flavor:'…' }
```

- **Tipos de movimiento** (`moves` se repite en orden, en bucle; la intención siguiente se muestra al jugador):
  `attack` (`v` daño, `n`=1 golpes) · `block` (`v`) · `buff` (`v`: +`v` a sus ataques el resto del combate) ·
  `limb` (`v` de daño **a la integridad** de una extremidad intacta al azar, ignora bloqueo) ·
  `heat` (`v` de calor a una extremidad al azar, o a todas con `all:true`) · `debuff` (`status:'weak'|'vuln'|'burn'`, `v` turnos/cargas) · `heal` (`v`).
- **Roster fijo de ids (10). No cambies ids:**

| id | Nombre | kind | floors | Notas |
|---|---|---|---|---|
| `sabueso` | Sabueso Cosido | monster | 0–1 | rápido, mordiscos |
| `ayudante` | Ayudante Enloquecido | scientist | 0–1 | débil, suelta extremidades básicas |
| `golem` | Gólem de Retazos | monster | 0–2 | mucha vida, golpes lentos y fuertes |
| `alquimista` | Alquimista Corrupto | scientist | 1–2 | debilita, quema |
| `arana` | Araña de Engranajes | monster | 1–2 | multi-golpe, desgarra extremidades |
| `cirujano` | Cirujano Demente | scientist | 1–2 | `limb` (corta extremidades) |
| `automata` | Autómata de Latón | monster | 1–2 | bloquea, `heat` |
| `quimera` | Quimera Ardiente | monster | 2–2 | fuego: `debuff burn`, `heat all` |
| `relojero` | Relojero Fanático | scientist | 2–2 | buffs y golpes fuertes |
| `vivisector` | Vivisector | scientist | 2–2 | `elite:true`, `dropCount:2`, el más duro |

  Vida orientativa: piso 0 → 22–34; piso 1 → 34–50; piso 2 → 48–70 (élite hasta 85). Daño de ataque orientativo: piso 0 → 4–8; piso 1 → 6–11; piso 2 → 8–14.
  Un combate debe durar ~3–5 turnos. `ether` = rango de Éter que suelta (piso 0: 3–8, piso 1: 6–12, piso 2: 9–16).
  `drops`: lista de ids de `DD.LIMBS`; reparte las 20 extremidades entre los 10 enemigos de modo coherente con su temática (sabueso→cab/pie de sabueso, golem→puño de gólem/costillar,
  cirujano→tenazas/sierra, alquimista→máscara/tentáculo/alambique, arana→patas de araña/cabeza de relojero, relojero→pistón/resorte/cabeza de relojero, quimera→cabeza de quimera/caldera,
  automata→caldera/botas/costillar/pistón, ayudante→las cuatro iniciales, vivisector→sierra/tentáculo/quimera/araña). Lo coherente gana sobre esta lista.

### 4.4 Cuerpos base — `DD.BASES[id]` y orden `DD.BASE_ORDER`

```js
{ id:'jornalero', name:'El Jornalero', flavor:'…', hpBonus:0,
  limbs:{ head:'cab_cosido', torso:'tor_remendado', armL:'bra_muerto', armR:'bra_muerto', legL:'pie_muerta', legR:'pie_muerta' },
  locked:false, price:0 }
```

Ids fijos (5): `jornalero` (libre, equilibrado), `vigia` (libre, más visión/cartas), `bruto` (libre, `hpBonus:10`, tiene algún brazo/torso pesado),
`saltadora` (`locked:true`, `price:120`, piernas ágiles), `centinela` (`locked:true`, `price:200`, torso de caldera y extremidades potentes).
Cada cuerpo usa solo ids de `DD.LIMBS` (los tres libres usan solo extremidades de tier 1–2). Los bloqueados se compran en la tienda.

### 4.5 Cosméticos — `DD.COSMETICS`

Tres categorías: `skin` (piel), `stitch` (puntadas), `eyes` (ojos). Lista de `{id, name, price, c}`; el primero de cada lista es el por defecto (`price:0`).
`skin.c = [base, sombra, luz]` (3 colores hex); `stitch.c = [color]`; `eyes.c = [color, brillo]`.
Mínimo: 4 pieles (pálida, verdigris, ceniza, ascua), 3 puntadas (rojas, doradas, cian), 4 ojos (verdes, ámbar, violeta, cian). Precios 40–90 Éter.
`chars.js` lee estos colores; nadie más tiene que interpretarlos.

### 4.6 Pisos — `DD.FLOORS[0..2]`

```js
{ name:'Sótano de Disección', sub:'Donde despiertan los cuerpos', enemies:['sabueso','ayudante','golem'] }
```
Pisos: 0 Sótano de Disección · 1 Biblioteca Alquímica · 2 Observatorio del Reloj. `enemies` = pool de ids (debe coincidir con `floors` de cada enemigo).

## 5. Cuerpo (`body.js`, W2) — `DD.Body`

```js
body = { base:'jornalero',
         slots:{ head:{id:'cab_cosido', integ:35, heat:0}, torso:{…}, armL:{…}, armR:{…}, legL:{…}, legR:{…} } }
// Un muñón es un hueco con id:null  ( {id:null, integ:0, heat:0} )
```

| Función | Descripción |
|---|---|
| `DD.Body.create(baseId, extraGrafts?)` | Cuerpo con las extremidades del cuerpo base, integridad completa, calor 0. |
| `DD.Body.limbAt(body, slot)` | Definición (`DD.LIMBS[id]`) o `null` si es muñón. |
| `DD.Body.integMax(body, slot)` | Integridad máxima de la extremidad del hueco (0 si muñón). |
| `DD.Body.graft(body, slot, limbId, frac)` | Coloca la extremidad (integridad `ceil(max × frac)`, mínimo 1; calor 0). `frac` por defecto `DD.CFG.GRAFT_FRAC`. Devuelve el id reemplazado o `null`. Comprueba el tipo (`DD.SLOT_TYPE`), lanza `Error` si no encaja. |
| `DD.Body.hurtLimb(body, slot, n)` | Resta `n` de integridad. Si llega a 0 ⇒ **se rompe**: `id=null` (muñón). Devuelve `{broke:bool, lost:limbId|null}`. |
| `DD.Body.addHeat(body, slot, n)` | Suma calor (solo si no es muñón). Si supera `HEAT_MAX`: aplica `OVERHEAT_DMG` (vía `hurtLimb`), calor = `OVERHEAT_RESET`. Devuelve `{overheated:bool, broke:bool, lost:limbId|null}`. |
| `DD.Body.coolAll(body, n)` | Resta `n` calor a todas (mínimo 0). `DD.Body.coolSlot(body, slot, n)` para una. |
| `DD.Body.repairSlot(body, slot, n)` | Suma integridad sin pasar del máximo. `DD.Body.repairWorst(body, n)` repara la extremidad intacta con más daño relativo y devuelve su hueco (o `null`). |
| `DD.Body.stats(body)` | `{hpMax, energy, hand, cool, dmg, block, speed, vision, fireRes}` (ver fórmulas abajo). |
| `DD.Body.deck(body)` | Array de `{card, slot}`: por cada hueco, las 3 cartas de su extremidad, o la carta de muñón del tipo (1 por hueco vacío). Es el mazo de combate. |
| `DD.Body.intactSlots(body)` | Huecos con extremidad (no muñón). `DD.Body.stumpSlots(body)` los vacíos. |
| `DD.Body.hottest(body)` | `{slot, heat}` del hueco más caliente. |

`stats`: `hpMax = HP_BASE + base.hpBonus + Σhp`; `energy = min(5, ENERGY + Σenergy)`; `hand = min(8, HAND + Σdraw)`; `cool = COOL_TURN + Σcool`;
`dmg = Σdmg`; `block = Σblock`; `speed = 1 + Σspeed`; `vision = VISION + Σvision`; `fireRes = clamp(ΣfireRes, 0, 0.75)`. Σ = suma de pasivas de extremidades **intactas**.

## 6. Núcleo (`core.js`, W1)

### 6.1 Texto con fuente de píxeles propia
`DD.text(ctx, str, x, y, opt)` — `opt:{color, size:1|2|3, align:'left'|'center'|'right', shadow:color|null, alpha}`. Celda de carácter a tamaño 1 = **6×8 px**
(glifo 5×7 + 1 de separación); `x,y` = esquina superior izquierda de la celda (con `align` el ancla horizontal cambia). `\n` salta de línea.
`DD.textWidth(str, size)` · `DD.wrap(str, maxW, size)` → array de líneas (corta por palabras).
Fuente propia en mapa de bits, generada a un atlas en el arranque. **Debe cubrir:** `A–Z a–z 0–9`, `á é í ó ú ü ñ Á É Í Ó Ú Ñ ¡ ¿`,
y `. , : ; ! ? - + ( ) / % ' " · … × → ← ↑ ↓ [ ] = < > * _ #`. Carácter desconocido ⇒ recuadro, nunca excepción.
Legible a 640×360 escalado; las minúsculas deben distinguirse bien.

### 6.2 UI de modo inmediato
- `DD.ui.panel(ctx, x, y, w, h, opt)` — marco gótico-steampunk (borde de latón con remaches, fondo `DD.C.panel`); `opt:{title, fill, border, alpha}`.
- `DD.ui.button(ctx, x, y, w, h, label, opt)` → `true` el fotograma en que se activa por clic/toque. `opt:{disabled, selected, hotkey, size, color}`.
  Dibuja estados (normal, hover/selected, pulsado, deshabilitado).
- `DD.ui.bar(ctx, x, y, w, h, frac, color, bg)` — barra rellena con borde.
- `DD.ui.hit(x, y, w, h)` → ratón/dedo dentro del rectángulo. `DD.ui.tooltip` no hace falta.

### 6.3 Entrada — `DD.Input`
Acciones lógicas: `up down left right ok back endTurn pause mute`.
Teclado: flechas/WASD → direcciones; Enter/Espacio → `ok`; Backspace → `back` (Esc → `back` **y** `pause`); E → `endTurn`; P → `pause`; M → `mute`.
Mando (Gamepad API): stick izq./cruceta → direcciones; A → `ok`; B → `back`; X → `endTurn`; Start → `pause`.
- `DD.Input.pressed(a)` (flanco, un fotograma) · `DD.Input.down(a)` (mantenida).
- `DD.Input.num()` → 1–9 si se pulsó esa tecla numérica este fotograma, si no 0.
- `DD.Input.mouse = {x, y, down, clicked, moved}` en **coordenadas del lienzo lógico** (ya escaladas). Toque y ratón se unifican (un puntero).
  `clicked` es verdadero solo el fotograma del clic/toque.
- `DD.Input.anyPressed()` → alguna tecla/clic/toque este fotograma.
- `DD.Input.lock(bool)` — con bloqueo activo `pressed/down/num/clicked/anyPressed` devuelven falso/0 (lo usa main para dibujar la escena bajo la pausa sin que consuma clics).
- `DD.Input.endFrame()` — lo llama main al final de cada fotograma.
El primer gesto del usuario (tecla/clic/toque) debe llamar a `DD.Audio.init()`.

### 6.4 Escenas
```js
DD.scenes.nombre = { enter(params), update(dt), draw(ctx), exit(), run:true|false }
DD.setScene(name, params)   // llama exit() de la anterior y enter(params) de la nueva; DD.scene = objeto, DD.sceneName = nombre
```
`run:true` en `explore`, `combat`, `harvest` (el reloj corre, se dibuja el HUD, se puede pausar). Las demás: `run` falso/ausente.
Escenas: `title`, `table`, `codex`, `shop`, `results` (W5) · `explore` (W4) · `combat`, `harvest` (W3).
`DD.setScene` hace un fundido breve (≈0.2 s) a negro entre escenas (opcional pero deseable; no debe bloquear la entrada más de 0.3 s).

### 6.5 Guardado — `DD.save`
Clave `DD.CFG.SAVE_KEY` en `localStorage` (tolerante a que no exista/falle: todo en `try/catch`, el juego funciona sin él).
```js
DD.save = { blueprints:{ limbId:true }, ether:0, runs:0, escapes:0, bestTime:null /*seg. restantes máx. al escapar*/, bestFloor:0,
            kills:0, owned:{ id:true }, equip:{ skin:'…', stitch:'…', eyes:'…' }, mute:false }
```
`DD.loadSave()` (tras cargar `data.js`; rellena por defecto: planos de los cuerpos base libres, cosméticos por defecto `owned` y equipados, ajustes) ·
`DD.saveNow()` · `DD.resetSave()`. `owned` contiene ids de cosméticos y de cuerpos base comprados.

### 6.6 Efectos — `DD.fx`
`DD.fx.shake(mag, dur)` · `DD.fx.flash(color, dur)` (los aplica/dibuja `main.js`). Tiempo global: `DD.time` (segundos de reloj de pared acumulados, para animaciones).

## 7. Partida (`run.js`, W1b) — `DD.Run` y `DD.run`

### 7.1 Estado `DD.run`
```js
DD.run = { n:/*nº de run*/, seed, base:'jornalero', body:/*Body*/, hp, hpMax, time:/*segundos restantes*/, floor:/*0..2*/,
           ether:/*ganado en esta run*/, kills, grafts, newBlueprints:[/*ids*/], started:false, paused:false, world:null /*lo usa explore*/ }
```

### 7.2 API
| Función | Descripción |
|---|---|
| `DD.Run.begin()` | Nueva run: incrementa `save.runs`; elige el cuerpo base (la run 1 siempre `jornalero`; después al azar entre los disponibles = libres + comprados); crea el cuerpo; descubre los planos de ese cuerpo; `hp=hpMax`; `time=RUN_TIME` (el reloj aún NO corre); semilla nueva; `DD.setScene('table')`. |
| `DD.Run.launch()` | La mesa despierta al jugador: `started=true`, `floor=0`, música de exploración, `DD.setScene('explore',{new:true})`. A partir de aquí corre el reloj. |
| `DD.Run.tick(dt)` | La llama main cada fotograma mientras la escena actual tenga `run:true` y no haya pausa: resta `time`, ajusta `DD.Audio.setTension`, suena el aviso a 60/30/10 s y cuenta atrás final. Si `time<=0` ⇒ `DD.Run.end('time')`. |
| `DD.Run.fireLevel()` | 0..1 según el tiempo transcurrido (`1 - time/RUN_TIME`); explore lo usa para la velocidad del fuego. |
| `DD.Run.refreshStats()` | Recalcula `hpMax` desde `Body.stats`; si sube, `hp` sube lo mismo; si baja, `hp=min(hp,hpMax)`. Llamar tras cualquier cambio de cuerpo. |
| `DD.Run.hurt(n, src)` | Quita `n` PV (ya sin bloqueo). Si `hp<=0` ⇒ `DD.Run.end('death', src)`. Devuelve `true` si murió. Sacude/flash de pantalla. |
| `DD.Run.heal(n)` | Cura hasta `hpMax`. |
| `DD.Run.addEther(n)` | Suma a `run.ether` (se ingresa en `save.ether` al acabar la run). |
| `DD.Run.discover(limbId)` | Marca el plano en `save.blueprints`; si era nuevo lo añade a `run.newBlueprints`. Guarda. |
| `DD.Run.startCombat(entity)` | `entity = {id: enemyId, …, dead:false}`. Guarda la escena, música de combate, `DD.setScene('combat', {enemy: entity})`. |
| `DD.Run.combatWon(entity)` | Marca `entity.dead=true`, `kills++`, suma Éter del enemigo (`DD.ENEMIES[id].ether`), elige 1 o `dropCount` opciones distintas de `drops` y abre `DD.setScene('harvest', {options:[…], source:'enemy', label:enemy.name})`. |
| `DD.Run.startHarvest(options, label)` | Abre la cosecha con extremidades dadas (tarros de extremidades): `{options, source:'jar', label}`. |
| `DD.Run.backToExplore()` | Vuelve: `DD.setScene('explore', {resume:true})`, música de exploración. |
| `DD.Run.nextFloor()` | `floor++`; si supera el último ⇒ `end('victory')`; si no, `DD.setScene('explore',{new:true})`. |
| `DD.Run.end(reason, cause?)` | `reason ∈ 'death'|'time'|'victory'|'quit'`. Ingresa Éter (+`ETHER_ESCAPE_BONUS` si victoria), actualiza `save` (runs ya contados, escapes, bestTime, bestFloor, kills), guarda y abre `DD.setScene('results', summary)` con `summary={reason, cause, floor, timeLeft, kills, grafts, newBlueprints, ether, bonus}`. Pone `started=false`. Idempotente. |
| `DD.Run.drawHUD(ctx)` | HUD (ver §7.3). Main lo llama tras dibujar la escena si `scene.run`. |
| `DD.Run.updatePause(dt)` / `DD.Run.drawPause(ctx)` | Pausa: menú `Continuar / Sonido: sí|no / Abandonar (termina la run, reason 'quit')`; resumen de controles. Main gestiona la tecla `pause` y el botón de pausa del HUD: `DD.run.paused`. Durante la pausa el reloj no corre. |

El reloj **corre** en `explore`, `combat` y `harvest`; **no** corre en título, mesa, códice, tienda, resultados ni en pausa.

### 7.3 HUD
- **Barra superior** (y 0–24, fondo `DD.C.bg2` con borde inferior de latón): reloj `M:SS` a tamaño 2 (parpadea en rojo < 60 s y late < 30 s), barra de vida con número `hp/hpMax`, etiqueta `PISO n/3`,
  Éter de la run, botones de 16×16: **pausa** y **sonido** (clicables/tocables).
- **Barra inferior** (y 320–360): **seis celdas** de ~106 px, una por hueco, en orden cabeza, torso, brazo izq., brazo der., pierna izq., pierna der.:
  icono (16×16, `drawLimbIcon` o `drawStumpIcon`), nombre corto, barra de **calor** (naranja→rojo, parpadeo cuando ≥ `HEAT_HOT`) y barra de **integridad** (verde→rojo). Muñón = celda apagada con la etiqueta `MUÑÓN`.

## 8. Sprites (`sprites.js` W6, `chars.js` W7) — `DD.Sprites`

Todo procedural (sin imágenes externas): se dibuja con `fillRect`/píxeles a canvases fuera de pantalla en `DD.Sprites.init()` (se llama una vez en el arranque),
o en vivo si es más simple. Pixel art gótico-alquímico/steampunk: latón, cobre, vidrio verde, sangre, hueso, cuero, engranajes, tubos, llamas. Paleta `DD.C`.

### 8.1 `sprites.js` (W6)
```
DD.Sprites.init()
DD.Sprites.setTheme(floorIndex)           // 0 sótano (piedra azulada fría), 1 biblioteca (madera/ladrillo cálido, verde alquímico), 2 observatorio (latón, rojo)
DD.Sprites.draw(ctx, key, x, y, opt)      // x,y = esquina sup. izq.; opt:{frame, flip, alpha}
DD.Sprites.frames(key)                    // nº de fotogramas de animación (1 si estático)
DD.Sprites.backdrop(ctx, key, t)          // fondo completo 640×360 animado (t = DD.time); claves abajo
```
Claves de `draw` (16×16 salvo iconos 8×8), fotogramas entre paréntesis:
- **Tiles:** `floor` (2 variantes: `floor`, `floorB`), `wall`, `gateClosed` (compuerta de latón, bloquea), `gateOpen`, `gateWarn` (2; parpadeo de aviso antes de cambiar), `stairs` (escalera al siguiente piso, 2),
  `exit` (puerta de salida de la torre, 2, brillante), `fire` (4), `spikes` (2: 0 retraídos, 1 fuera), `acid` (3), `steam` (3: 0 reposo, 1 acumulando, 2 chorro), `torch` (3; antorcha de pared, decoración), `start` (mesa de disección vacía/cama de partida).
- **Recursos:** `vial` (vial de sangre), `coolant` (refrigerante azul), `suture` (carrete de suturas), `ether` (cristal), `jar` (frasco con extremidad en líquido, 2).
- **Iconos 8×8** (prefijo `i_`): `i_attack i_block i_buff i_debuff i_limb i_heat i_heal i_burn i_vuln i_weak i_stun i_energy i_hp i_clock i_ether i_skull i_sound i_mute i_pause`.
- **Fondos** (`backdrop`): `title` (torre en llamas de noche, engranajes, chispas), `table` (mesa de disección, laboratorio), `combat` (interior según `setTheme`), `harvest` (mesa/estantería oscura),
  `codex` (pergaminos/planos), `shop` (vitrina de alquimista), `death` (oscuro, ascuas), `win` (amanecer tras la torre). Que el área central quede legible para UI encima (no muy contrastados).

### 8.2 `chars.js` (W7)
Extiende `DD.Sprites`. El cuerpo es el de §5; lee cosméticos de `DD.save.equip` + `DD.COSMETICS` (con valores por defecto si faltan).
```
DD.Sprites.drawPlayer(ctx, body, x, y, opt)        // 16×16 (exploración). opt:{dir:1|-1, frame:0..3, flash:0..1}
DD.Sprites.drawEnemy(ctx, id, x, y, opt)           // 16×16 (exploración). opt:{frame:0..3, flip, flash}
DD.Sprites.drawPlayerBig(ctx, body, cx, by, opt)   // ≈48×88, centrado en cx, pies en by. opt:{frame:0..3, flip, flash:0..1, pose:'idle'|'attack'|'hurt'|'dead', heat:{slot:0..1}}
DD.Sprites.drawEnemyBig(ctx, id, cx, by, opt)      // ≤64×64, centrado en cx, pies en by. opt:{frame:0..3, flip, flash:0..1, pose:'idle'|'attack'|'hurt'|'dead'}
DD.Sprites.drawLimbIcon(ctx, limbId, x, y, opt)    // 16×16. opt:{alpha, silhouette:true (plano no descubierto: silueta "???")}
DD.Sprites.drawStumpIcon(ctx, type, x, y)          // 16×16 muñón vendado del tipo head|torso|arm|leg
```
- `drawPlayerBig` muestra **cada hueco con el aspecto de su extremidad concreta** (20 aspectos distintos: patas de sabueso, sierra, pistón, tentáculo, caldera…), los **muñones vendados** cuando están rotos, y un **resplandor rojo/naranja** por hueco según `opt.heat[slot]`.
  Cosméticos: piel, color de puntadas (las costuras se ven), ojos. Tiene animación de respiración/idle por `frame`.
- Enemigos: 10 ids del §4.3. Científicos = humanoides con bata/gafas/máscara/cuchillos; monstruos = criaturas cosidas/mecánicas. Cada uno inconfundible. Id desconocido ⇒ silueta genérica (nunca excepción).
- `flash` = pinta el sprite de blanco/rojo ese porcentaje (golpe recibido).

## 9. Audio (`audio.js` W8) — `DD.Audio`

Todo sintetizado con Web Audio (osciladores, ruido, filtros, envolventes, retardo/reverb simple). **Sin archivos de audio.**
```
DD.Audio.init()            // crea/reanuda el AudioContext; seguro llamarlo muchas veces (se llama en el primer gesto del usuario)
DD.Audio.music(name)       // 'title'|'table'|'explore'|'combat'|'harvest'|'death'|'win'|null. Mismo nombre = no reiniciar. Transición suave.
DD.Audio.setTension(x)     // 0..1 (lo fija Run.tick según el tiempo restante): sube tempo/capas en explore y combat
DD.Audio.sfx(name, vol)    // vol 0..1 opcional
DD.Audio.setMuted(b); DD.Audio.toggleMute() -> bool; DD.Audio.muted   // persiste en DD.save.mute (sin llamar a saveNow; el HUD guarda)
```
- **Banda sonora:** ominosa, **electrónica + orquestal sintetizada**: drones graves, pads/cuerdas de sierra filtradas, coros de órgano/«metales» sintetizados,
  percusión de timbal y golpes metálicos, arpegios de sinte secuenciados, reloj/tic-tac y engranajes en las pistas de partida. Escalas menores/frigias. Cada pista distinta y con bucle sin cortes:
  `title` (solemne), `table` (goteo, tensión baja), `explore` (pulso constante, crece con la tensión), `combat` (percusivo, agresivo), `harvest` (grave, carnal), `death` (corta, descendente), `win` (alivio sombrío → luz).
- **Efectos guturales y viscerales** (graves, húmedos, con ruido): `step hit hitHeavy block card cardHot overheat break graft devour pickup vial coolant suture ether jar trap fire gate gateWarn stairs enemyAttack enemyDie heal burn stun buff debuff ui uiBack error tick timeWarn death victory explosion`.
  `overheat` = vapor + metal crujiendo; `break` = hueso/metal que cruje; `graft` = costura húmeda + pulso; `devour` = masticado húmedo; `enemyDie` = gorgoteo grave.
- Volumen general moderado (sin saturar; `DynamicsCompressor` al final). Límite de voces simultáneas para no saturar la CPU. Música más baja que los efectos.
- Nunca lanza excepciones aunque no haya AudioContext (en ese caso todo son no-ops).

## 10. Exploración (`tower.js` + `explore.js`, W4)

### 10.1 Torre (`DD.Tower`, lógica pura, testeable sin navegador)
- `DD.Tower.generate(floorIndex, rng)` → mundo del piso: rejilla `CFG.MAP_W × CFG.MAP_H` (31×17) de casillas de 16 px. Laberinto perfecto (backtracker recursivo sobre 15×8 celdas)
  + **bucles** (quitar algunos muros) + 2–4 **salas pequeñas** (p. ej. 5×3). Inicio de jugador lejos de la salida. `stairs` (o `exit` en el piso 2) en el punto más lejano por camino (BFS).
- **Laberinto en constante cambio:** cada ~18 s (con un aviso visible y sonoro ~2 s antes: `gateWarn` parpadea) un conjunto de **compuertas de latón** (10–16 por piso, en pasillos/bucles) se abren o cierran.
  Las compuertas cerradas bloquean a jugador y enemigos. Garantía: tras cada cambio **existe camino** desde el jugador a la salida/escalera (se valida con BFS; un cierre que desconectaría se cancela) y nunca se cierra una compuerta con alguien encima.
  Además cada piso nuevo es un laberinto nuevo (semilla distinta cada run ⇒ **la torre se regenera**).
- Contenido por piso: enemigos (piso 0: 4–5, piso 1: 5–6, piso 2: 6–7; tipos de `DD.FLOORS[f].enemies`), trampas (6–10 de `spikes` cíclicos, `acid`, `steam` cíclico), recursos
  (vial ×3–4, refrigerante ×2–3, suturas ×2–3, Éter ×4–6, **tarros de extremidades ×1–2**), nunca encima del inicio/salida.
- Nada de esto depende del DOM: `generate` y el cambio de compuertas son funciones sobre datos.

### 10.2 Escena `explore`
- `enter({new:true})`: genera el piso `DD.run.floor` con la semilla de la run, `DD.Sprites.setTheme(floor)`, coloca al jugador. `enter({resume:true})`: continúa el mundo guardado en `DD.run.world`
  (el mundo no avanza mientras dura un combate, el reloj global sí). Música `explore`.
- El mapa se dibuja centrado en `MAP_X, MAP_Y` (caben los 31×17 enteros; no hay cámara). **Niebla de guerra:** casillas vistas (radio `stats.vision`) se recuerdan atenuadas; los enemigos/recursos solo se ven dentro del radio.
- Movimiento libre suave (colisión con muros y compuertas cerradas), velocidad base ≈ 58 px/s × `stats.speed`. Teclado/mando/ratón: con el puntero pulsado en el área de juego, el jugador avanza hacia él (táctil).
- **Fuego:** la torre arde; aparecen casillas de fuego (nunca en inicio/salida/escalera ni en un radio de 3 del jugador al entrar), se extienden más rápido cuanto mayor sea `DD.Run.fireLevel()` (tope ≈ 18 % del piso).
  Pisar fuego: ~4 de daño (con cooldown corto) + calor a las piernas; `fireRes` reduce el daño.
- **Trampas:** `spikes` (daño al salir), `acid` (daño + desgasta una extremidad), `steam` (calor a todas). Visibles, con cooldown tras impactar. `fireRes` reduce su daño.
- **Enemigos:** deambulan y persiguen al jugador a `sight` casillas si hay camino (BFS), a `speed` × velocidad base del mundo; respetan compuertas. Tocarlos ⇒ `DD.Run.startCombat(entity)`. Tras un combate el jugador tiene ~1.5 s de invulnerabilidad de contacto.
  Los enemigos muertos (`entity.dead`) desaparecen al reanudar.
- **Recursos** (se aplican al recogerlos): vial +`VIAL_HEAL` PV · refrigerante −`COOLANT_COOL` calor a todas · suturas `Body.repairWorst(body, SUTURE_REPAIR)` · Éter `+3..8` · **tarro** ⇒ `DD.Run.startHarvest([limbId aleatorio de cualquier extremidad, ponderado por piso], 'Frasco de extremidad')`.
- **Calor fuera de combate:** cada extremidad pierde `COOL_SEC` por segundo.
- **Salida:** tocar `stairs` ⇒ `DD.Run.nextFloor()`; tocar `exit` (piso 2) ⇒ `DD.Run.nextFloor()` (que termina con victoria).
- Pequeños extras de ambiente: antorchas, partículas de brasas, vibración cuando cambian las compuertas. Sonidos: `step`, `pickup`/`vial`/`coolant`/`suture`/`ether`/`jar`, `trap`, `fire`, `gateWarn`, `gate`, `stairs`.

## 11. Combate y cosecha (`combat.js`, W3)

### 11.1 Escena `combat` (`enter({enemy: entity})`)
Turnos rápidos. Mazo = `DD.Body.deck(DD.run.body)` (cada elemento `{card, slot}`), barajado al empezar. Al inicio de cada turno del jugador: se pierde el bloqueo, se aplican quemaduras,
se roba `stats.hand` cartas (al agotarse el mazo se baraja el descarte), energía = `stats.energy`. Jugar una carta: cuesta energía, resuelve `fx` en orden (§4.2), aplica calor/desgaste al `slot` dueño
(si es muñón no hay calor), va al descarte. `endTurn` (tecla E / botón «Terminar turno»): al acabar se enfrían todas las extremidades `stats.cool`, el descarte recibe la mano y el enemigo ejecuta su movimiento (§4.3).
- **El enemigo** se elige de `DD.ENEMIES[entity.id]`, vida aleatoria en `hp`. Muestra su **intención** (icono `i_*` + valor + nombre) antes de actuar; barras de vida/bloqueo/estados con iconos.
- **Interfaz:** jugador grande a la izquierda (`drawPlayerBig` con `opt.heat` y animaciones `pose`), enemigo grande a la derecha (`drawEnemyBig`), mano de cartas abajo en la zona segura (hasta 8 cartas,
  cada una ≈ 72–92 px de ancho, con nombre, coste, icono de la extremidad dueña, texto `DD.cardText`, y **barra de calor de su extremidad**; en rojo y con aviso `¡SOBRECALIENTA!` si jugarla superaría `HEAT_MAX`;
  atenuada si no hay energía). Indicadores de energía, mazo y descarte. Números flotantes de daño/curación. Mensajes cortos («¡Brazo roto!», «¡Sobrecalentada!»).
  Seleccionar con ratón/táctil (clic en la carta la juega), teclas `1–9`, o ←/→ + `ok`. Botón de terminar turno con `endTurn`.
- **Rotura en combate:** si una extremidad se rompe (por desgaste, sobrecalentamiento o un `limb` enemigo) se quitan inmediatamente sus cartas de mano, mazo y descarte, se añade la carta de muñón del tipo al descarte, se anuncia y se llama `DD.Run.refreshStats()`.
  Puede cambiar la mano máxima/energía: aplica desde el turno siguiente.
- **Fin:** enemigo a 0 ⇒ animación de muerte, `DD.Run.combatWon(entity)`. Jugador a 0 PV (vía `DD.Run.hurt`) ⇒ la run termina (`Run.hurt` ya lo gestiona; la escena debe parar de actuar). El tiempo sigue corriendo (lo gestiona Run); si `DD.run.started` pasa a falso la escena deja de actualizar.
- Sonidos: `card`, `cardHot`, `hit`, `hitHeavy`, `block`, `overheat`, `break`, `heal`, `burn`, `stun`, `buff`, `debuff`, `enemyAttack`, `enemyDie`, `ui`. Sacudidas con `DD.fx.shake`.

### 11.2 Escena `harvest` (`enter({options, source, label})`)
Cosechar: muestra 1 o 2 extremidades caídas (`options`, ids de `DD.LIMBS`) con su ficha (icono grande, nombre, tipo, integridad, pasivas en texto claro, y las **3 cartas** con `DD.cardText`).
Para cada una, el jugador ve su cuerpo actual y elige: **Injertar** (si el tipo tiene dos huecos, elige cuál; se muestra qué extremidad se sustituye y que se pierde; los muñones se rellenan sin perder nada) ·
**Devorar** (`+DEVOUR_HEAL` PV vía `Run.heal`, `Body.coolAll(DEVOUR_COOL)`; no descubre el plano) · **Dejar**. Si hay 2 opciones, se elige una sola.
Injertar: `Body.graft(slot, limbId, GRAFT_FRAC)`, `DD.Run.discover(limbId)`, `run.grafts++`, `DD.Run.refreshStats()`, sonido `graft`, y `DD.Run.backToExplore()`.
Esta escena corre con el reloj en marcha: hay prisa. Teclado, ratón y táctil completos.

## 12. Pantallas de meta (`meta.js`, W5)

Todas a 640×360 completos, con `DD.Sprites.backdrop`, `DD.ui.*`, teclado/ratón/táctil/mando (navegación con flechas + `ok`, `back` vuelve). Música acorde (`title`, `table`…).
- **`title`:** título «DEADLOCK DECK» grande y «EL RELOJ ANATÓMICO» debajo (fuente propia, brillo/chispas); pulsar cualquier cosa arranca audio. Menú: **Despertar** (`DD.Run.begin()`), **Códice**, **Tienda**, **Cómo se juega** (panel con sinopsis y controles),
  **Sonido sí/no**. Muestra récords (escapes, mejor tiempo, runs, planos x/20, Éter).
- **`table` — Mesa de disección** (la run ya existe en `DD.run`, creada por `Run.begin`): muestra el **cuerpo base nuevo** (nombre, frase), el cuerpo grande (`drawPlayerBig`), los seis huecos con su extremidad (icono, nombre, integridad), el resumen de cartas por extremidad y las pasivas totales.
  Permite **injertar planos ya descubiertos** (máx. `TABLE_GRAFTS` injertos, cada uno a `GRAFT_FRAC` de integridad): eliges hueco → lista de planos descubiertos de ese tipo → injertar. Botón **¡DESPERTAR!** ⇒ `DD.Run.launch()`.
  Breve recordatorio del objetivo: «Tienes 6:00 para escapar de la torre en llamas». Si viene de una run anterior muestra un mensaje de reencarnación.
- **`codex` — Códice de planos:** cuadrícula con las 20 extremidades; las no descubiertas son silueta «???»; filtro por tipo (todas/cabeza/torso/brazo/pierna); al seleccionar una muestra su ficha completa (como en cosecha) con cartas y pasivas. Contador «Planos x/20».
- **`shop` — Tienda del alquimista:** saldo de Éter (`save.ether`). Pestañas: Pieles, Puntadas, Ojos, Cuerpos base. Cada artículo: vista previa (cuerpo con el cosmético), nombre, precio; **Comprar** (resta Éter) / **Equipar** / «Equipado». Cuerpos base bloqueados: Comprar = desbloquear.
  Sección «Paquete del Alquimista (DEMO)»: un botón que muestra un precio simulado y, si se pulsa, da Éter de prueba, con una nota clara «Demostración: no se cobra nada ni hay pagos reales». Guarda con `DD.saveNow()`.
- **`results`:** según `summary.reason`: «¡ESCAPASTE!» (win), «TE DESTRUYERON» (death, con `cause`), «EL RELOJ LLEGÓ A 0:00» (time), «ABANDONASTE» (quit). Estadísticas: piso alcanzado, tiempo restante/usado, enemigos, injertos, planos nuevos (con iconos), Éter ganado (+bono).
  Botones: **Nueva mesa de disección** (`DD.Run.begin()`), **Códice**, **Tienda**, **Título**. Música `death` o `win`.

## 13. Arranque y bucle (`main.js`, W1)

1. Al cargar el DOM: obtener el canvas, `ctx`, `DD.loadSave()`, `DD.Sprites.init()`, `DD.Audio` (sin iniciar hasta gesto), registrar entrada, `DD.setScene('title')`.
2. Bucle `requestAnimationFrame` con `dt = min(0.05, delta)`; `DD.time += dt` (incluida la pausa). Por fotograma: atajos globales (`mute`, `pause` si `scene.run`) → si pausa: `DD.Input.lock(true)`; dibujar escena; `lock(false)`; `Run.updatePause`/`Run.drawPause`; si no: `Run.tick(dt)` (solo si `scene.run` y `DD.run.started`), `scene.update(dt)`, `scene.draw(ctx)`, `Run.drawHUD(ctx)` si `scene.run && DD.run && DD.run.started`.
   Aplicar `DD.fx` (sacudida/destello). `DD.Input.endFrame()`. Excepciones por fotograma capturadas (se informan una sola vez).
3. **Lienzo adaptable:** CSS centra el canvas manteniendo 16:9, tan grande como quepa (`image-rendering: pixelated`), fondo oscuro, sin barras de desplazamiento; `touch-action: none`; evita el menú contextual y el zoom táctil; atiende `resize`/`orientationchange`.
   Las coordenadas de ratón/toque se convierten al lienzo lógico 640×360 (con la caja real del canvas).
4. `visibilitychange`: al ocultarse la pestaña en una run activa se activa la pausa.

## 14. Notas de equilibrio (orientativas)

Jugador: ~60–75 PV, 3 de energía, mano de 5. Una run competente de 6 min cruza 3 pisos (≈ 2 min por piso) con 3–5 combates y algún injerto.
La presión: fuego creciente, enemigos que persiguen, extremidades que se calientan y se rompen, reloj. Los recursos deben bastar para sobrevivir si no se despilfarra el calor.
La primera run debe poder ganarse con juego razonable pero no trivial; el piso 3 es el más duro.
