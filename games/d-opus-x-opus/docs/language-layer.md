# Capa de idioma ES/EN

Qué se investigó: cómo añadir inglés a este build sin tocar jugabilidad, balance, layout, arte ni
arquitectura, y sin bundler ni dependencias.

Estado: hecho y verificado en navegador. `src/lang.js` es el único fichero nuevo.

## Contrato del módulo

`src/lang.js` (ES module sin imports, igual que `rng.js`) exporta:

| Export | Qué hace |
|---|---|
| `getLang()` | `'es'` o `'en'`, fijado una vez al cargar |
| `t(plantilla, ...valores)` | traduce la plantilla y sustituye `{0}`, `{1}`... Una clave desconocida vuelve tal cual |
| `setLang(next)` | guarda en `localStorage['dd-lang']` y recarga |

Orden de resolución al cargar: `?lang=` → `localStorage['dd-lang']` → `navigator.language` que empieza
por `es` → `'es'`. El último escalón es español a propósito: sin `?lang=` y sin nada guardado el juego
se comporta exactamente como antes. También fija `document.documentElement.lang`.

`setLang` borra el parámetro `lang` de la URL antes de recargar; si no, un `?lang=en` pegado en la
barra ganaría siempre y el botón ES no haría nada visible.

## Decisión principal: traducir en el punto de dibujo, no en los datos

`cards.js` y `tower.js` **no se tocan**. Sus nombres, descripciones, motes y nombres de sala siguen en
español y se pasan por `t()` allí donde se dibujan o se escriben en el log.

El motivo es de comportamiento, no de estilo: `combat.js` compara nombres de movimiento enemigo para
impedir que el mismo salga tres veces seguidas ([src/combat.js:280](../src/combat.js)), y
`sprites.js` elige silueta por keyword sobre el **id** del plano, no sobre el nombre
([src/sprites.js:248-258](../src/sprites.js)). Traducir los datos de origen habría roto la primera y
dejado la segunda dependiente de la suerte. Con la traducción en el punto de dibujo, `t()` es la
identidad en español y ninguna comparación cambia.

Excepción deliberada: el orden alfabético de la lista de planos de la losa se ordena por `t(name)`
([src/ui.js:686](../src/ui.js)), para que la lista siga alfabética también en inglés.

## Restricción real: la fuente bitmap

`render.js` define 68 glifos: `A-Z`, `0-9`, `. , : ; ! ? ' " - + / % ( ) < > * = [ ] _ #` y los
acentos españoles `Á É Í Ó Ú Ñ Ü ¡ ¿`. Cualquier otro carácter cae al bloque hueco de `FALLBACK`.

Consecuencia para los textos ingleses: **nada de `&`, `—`, comillas tipográficas ni `…`**. El apóstrofo
recto sí existe, así que `ALCHEMIST'S TOWER` se dibuja bien (verificado en pantalla). Los textos
ingleses se eligieron además dentro de los anchos que ya imponía el código: 34 caracteres por línea de
log (`LOG_WIDTH`), 42 de toast, 13x2 para el nombre de carta y 13x5 para su descripción, 24 para el
nombre de sala en la lista de salidas.

## Interpolación

Se traduce la plantilla, nunca la cadena montada. `t('APARECE {0}', nombre)` permite que el inglés
invierta el orden (`'{0} APPEARS'`) sin perder el valor. Hay 41 plantillas con `{n}` en el diccionario.

Comprobación en la página real (consola del navegador, build servido en `http://localhost:5173`):

```
{"lang":"en","htmlLang":"en","C":"H","I":"I","stump":"STUMP",
 "graft":"YOU GRAFT BRASS MASK",
 "blades":"BLADES: -8 HP AND SCALPEL ARM TORN OFF",
 "unknown":"UNA CADENA QUE NO EXISTE","multi":"X3 FOR 5"}
```

La clave `'C'` (Calor) pasa a `'H'` (Heat) y la `'I'` (Integridad/Integrity) se queda igual: son las dos
letras de las barras del panel de anatomía ([src/ui.js:312-318](../src/ui.js)).

## Control ES/EN

`langToggle()` en [src/ui.js:145](../src/ui.js) reutiliza el mismo `button()` que el resto de la
interfaz: dos celdas de 30x18, la activa con borde `PAL.spark`. Se dibuja en dos sitios:

- título, en `(378, 4)`, hueco libre a la derecha de la placa del título (que acaba en x=356);
- losa de disección, en `(8, 231)`, la banda vacía a la izquierda de `[ REANIMAR ]`.

No hay pantalla de pausa en este build. La losa se eligió como segundo sitio porque el título sólo se
ve una vez por sesión: muerte y fuga vuelven a la losa, no al título.

El toggle se dibuja **antes** del bloque de despertar del título, que tiene un `consumeClick()`
comodín. Así el click del idioma se consume en el botón y nunca despierta al cuerpo por accidente.

## Qué queda sin traducir, y por qué

| Literal | Dónde | Motivo |
|---|---|---|
| `combat: enemigo desconocido "..."` | [src/combat.js:485](../src/combat.js) | `console.warn`, no lo ve el jugador |
| `makeLimb: unknown limb blueprint "..."` | [src/body.js:28](../src/body.js) | mensaje de `Error`, ya en inglés |
| `FILLER_WORDS`, `GENERIC_WORDS` | [src/ui.js:51-57](../src/ui.js) | datos de `abbrev()` para acortar nombres **españoles**; los nombres ingleses se eligieron cortos y no los necesitan |
| `'Á'`, `'É'`... en `GLYPHS` | [src/render.js:197-205](../src/render.js) | datos de fuente; deben seguir ahí para que el español se dibuje |
| `DEADLOCK DECK` | [src/ui.js:543](../src/ui.js) | nombre propio del juego |
| `TORSO`, `TR`, `HP`, `TIER`, `INT`, `T`, `HP+` | varios | idénticos en ambos idiomas; pasan por `t()` o son neutros |

## Verificación

- `node --check` en `lang.js`, `main.js`, `combat.js`, `explore.js`, `ui.js`: los cinco en verde.
- Auditoría por script sobre todos los literales de `src/`: 409 claves distintas en el diccionario, 0
  duplicadas, y ningún literal español visible sin envolver fuera de la tabla de arriba.
- Recorrido en navegador con `?lang=en`: título, losa, exploración, combate (cartas, log, intención,
  panel de cosechables) y el HUD, todo en inglés y sin errores de consola. Click en `ES` desde
  `?lang=en`: guarda `dd-lang=es`, limpia la URL, recarga en español y el título vuelve a
  `Deadlock Deck: El Reloj Anatómico`.
- Sin `?lang=` ni `dd-lang`, la pantalla es idéntica a la de antes del cambio.
