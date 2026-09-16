# Deadlock Deck: El Reloj Anatómico

Eres una abominación recién reanimada que despierta en la mesa de disección de una torre
alquímica que se está quemando. Tienes **6 minutos reales** (360 segundos) para escapar. La
torre es un laberinto procedural de 5×5 lleno de monstruosidades y científicos corruptos, y tu
única esperanza es arrancar miembros de los cadáveres e injertártelos: cada extremidad cosida
te aporta sus propias cartas, así que tu mazo **es** tu cuerpo. Arde, cose, corta cabezas y
llega al portón antes de que el reloj llegue a 0:00.

## Cómo jugar

Abre `index.html` en un navegador (doble clic; funciona como `file://`). No hay nada que
instalar, compilar ni descargar: el juego son unos pocos archivos de texto y no hace ni una
sola petición de red. Pulsa cualquier tecla o toca la pantalla en la portada para empezar una
partida.

## Controles

| Acción | Teclado | Táctil |
|---|---|---|
| Moverse por la torre | Flechas o `WASD` | Los cuatro botones de dirección |
| Jugar una carta | `1`–`9` | Toca la carta en la mano |
| Terminar el turno | `Espacio` o `Enter` | Botón «Terminar turno» |
| Silenciar el sonido | `M` | Botón ♪ de la barra superior |
| Elegir en un diálogo | `Enter`/`Espacio`, `Esc` para dejarlo | Toca la opción |

Las cartas que no puedes pagar aparecen desactivadas, y los botones de dirección se apagan
cuando no hay salida hacia ese lado.

## Mecánicas

### El cuerpo es el mazo

Seis huecos: `cabeza`, `torso`, `brazo izquierdo`, `brazo derecho`, `pierna izquierda`,
`pierna derecha`. Cada extremidad intacta aporta **dos cartas** a tu mazo (y algunas suben los
PV máximos), y un hueco roto o vacío solo aporta su carta de muñón. Cambiar un brazo cambia por
completo la forma de jugar la pelea; no hay mazo que construir fuera del cuerpo.

### Degradación térmica

Cada extremidad tiene una **integridad**. Jugar una carta calienta la extremidad que la
proporcionó: al llegar al límite, la extremidad **se rompe**. En ese instante sus cartas salen
del mazo, de la mano y del descarte, y en su lugar queda una carta de muñón débil hasta que te
cosas un reemplazo. Al empezar cada turno toda la carne se enfría un punto, y hay cartas
(Purga de Vapor, Bomba Fría) y salas que enfrían de golpe. El panel de anatomía muestra la
barra de calor de cada hueco, y a partir del 70 % las cartas avisan con un borde de peligro.

### Cosecha

Al ganar un combate saqueas el cadáver: se te ofrecen **dos** de sus miembros (o **todos**, si
jugaste una carta con `harvest` como Desollar o Tirón de Injerto), cada uno como «Injertar en
<zona>» para los huecos compatibles, más la opción de dejarlo. Injertar cuesta **4 segundos**
de reloj y apunta el miembro en tus planos anatómicos.

### La torre procedural

Cada partida genera una torre nueva de 5×5 con semilla propia: un recorrido aleatorio que
conecta las 25 salas más unos cuantos atajos, así que el plano cambia en cada ciclo pero
siempre hay camino. Los tipos de sala:

- **Mesa de disección** — donde despiertas; enfría el cuerpo entero cada vez que vuelves.
- **Combate** (6 salas) — monstruos: ayudantes suturados, científicos corruptos, homúnculos,
  perros de ceniza, torsos errantes.
- **Élite** — la Armería de Latón, con un Guardia de Latón.
- **Alacenas** (2) — curan 10 PV, o enfrían todo y reparan una extremidad rota, o guardan un
  plano anatómico que puedes coserte allí mismo.
- **Trampas** (2) — cuestan 12 segundos de reloj o 6 PV, una sola vez.
- **Portón en llamas** — la salida.
- **Vacías** — pasillos desiertos, celdas saqueadas, rincones de ceniza.

En la esquina hay un minimapa con las salas que has visto, sus enlaces, tu posición y la salida
en cuanto la descubres.

### El guardián de la salida

El portón no está solo: lo custodia el **Portero de Latón** (55 PV, 10 de bloqueo, golpes
múltiples y calor). Es el combate más duro de la torre y hay que ganarlo para escapar. Si lo
derribas, la pantalla de escape resume el tiempo que te sobraba, el cuerpo con el que saliste y
los planos que llevas.

### El ciclo de 6 minutos

El reloj corre en tiempo real y **nunca se detiene** mientras juegas: ni explorando, ni
combatiendo, ni eligiendo un injerto. Si llegas a 0:00 o tus PV bajan a 0, la carne se deshace
y despiertas en una mesa nueva con un cuerpo base nuevo y una torre con otra semilla — pero
**conservas los planos anatómicos descubiertos**, así que cada ciclo empieza sabiendo más. Al
principio de cada ciclo, si tienes planos, la mesa te deja coserte uno gratis. Los planos y las
estadísticas se guardan en `localStorage` (clave `dd_save`); tu preferencia de sonido, en
`dd_sound`.

## Mapa de archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Página única: un `<canvas>` y el DOM del HUD. Fija el orden de carga. |
| `src/data.js` | Datos puros: extremidades, cartas, enemigos, efectos, constantes. |
| `src/body.js` | El cuerpo: mazo, calor, rotura, injertos y descripción en español. |
| `src/combat.js` | Reglas del combate por turnos, efectos de carta e intenciones enemigas. |
| `src/tower.js` | Generación procedural de la torre 5×5 y su RNG determinista. |
| `src/render.js` | Todo el dibujo: salas, abominación, enemigos, minimapa, partículas. |
| `src/audio.js` | Música y efectos sintetizados con la Web Audio API. |
| `src/ui.js` | Capa DOM: reloj, PV, panel de anatomía, mano, diálogos y avisos. |
| `src/styles.css` | Piel gótica alquímica, responsiva de móvil a escritorio. |
| `src/game.js` | El pegamento: ciclo de partida, reloj real, entrada y guardado. |

Todo el arte es **pixel art procedural dibujado en un canvas de 384×216** y escalado con
`image-rendering: pixelated`, y todo el audio está **sintetizado con la Web Audio API**: el
juego no incluye ni un solo archivo de imagen, fuente o sonido.
