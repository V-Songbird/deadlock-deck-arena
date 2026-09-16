# Deadlock Deck: El Reloj Anatómico

Un roguelike de cartas en el que **tu cuerpo es tu mazo**. Has despertado en una torre alquímica en llamas. Tienes **seis minutos reales** para cosechar extremidades, reconstruirte y escapar.

## Jugar

Abre `index.html` en un navegador que permita ejecutar JavaScript. No necesitas instalar paquetes, compilar ni iniciar un servidor.

La entrega también incluye `Deadlock-Deck.html`: una versión autocontenida con todo el juego dentro de un solo archivo. Puedes guardarla y abrirla directamente en tu navegador de escritorio.

Pulsa **Reanimar**. El audio se habilita al interactuar. La ayuda puede leerse antes de empezar, sin consumir tiempo del intento.

El juego está en español y en inglés. Los botones **ES / EN** de la cabecera cambian el idioma antes y durante el intento; la elección se guarda en `localStorage` bajo `dd-lang`. También puedes forzarlo con `?lang=es` o `?lang=en` en la dirección. Sin ninguna de las dos cosas, el juego arranca en español.

Para alojar la versión web, publica esta carpeta en un alojamiento estático conservando sus rutas. En móviles, usa un navegador, no un visor de archivos que bloquee JavaScript. No hay servicios externos, cuentas, analítica ni solicitudes de pago.

## El juego

### Tu anatomía es tu mazo

Tienes seis ranuras: cabeza, torso, brazo izquierdo, brazo derecho, pierna izquierda y pierna derecha. Cada injerto intacto aporta dos cartas.

La bolsa permite elegir la ranura de destino. El injerto sustituido vuelve a la bolsa con su calor e integridad actuales. Sus cartas se eliminan inmediatamente de mano, mazo y descarte. En combate, injertar cuesta una energía; fuera de combate es gratuito.

Hay **18 planos anatómicos**, **36 cartas de injerto** y **4 cartas de muñón**. Los cuerpos iniciales, enemigos y recursos permiten combinar daño directo, defensa, curación, robo de cartas, energía, quemadura, debilidad y aturdimiento.

### Calor y desgaste

Cada carta indica su coste, efecto, calor y desgaste. A **100 grados** o **cero de integridad**, la extremidad se rompe. Pierdes sus cartas y recibes la carta débil del muñón correspondiente. El refrigerante no reconstruye miembros rotos: necesitas un reemplazo.

A partir de 75 grados, cada uso causa siete puntos adicionales de desgaste. Terminar turno enfría 12 grados; desplazarte a otra sala, siete. Subir de piso enfría 15 grados.

Los sueros recuperan hasta 28 de vida. El refrigerante reduce 38 grados y repara 12 puntos de integridad en cada injerto intacto. En una estación puedes reparar 40 puntos de integridad y enfriar por completo tus piezas intactas a cambio de ocho de chatarra.

### Combates rápidos por turnos

Empiezas cada combate con cinco cartas y tres de energía. Juega cartas pulsándolas. La intención del enemigo muestra su siguiente acción: ataque, golpe brutal, defensa o vapor que recalienta un injerto.

Al terminar turno se resuelve la quemadura y la intención enemiga, descartas la mano, desaparece tu defensa de ese turno, recuperas tres de energía y robas cinco cartas. El descarte se baraja cuando se agota el mazo. La mano admite hasta siete cartas.

Los enemigos derrotados dejan un injerto, chatarra y cinco de vida. La extremidad se recoge en la bolsa y su plano se descubre de forma permanente. El último guardián es **el Rector de Carne**.

### La torre y los seis minutos

La torre tiene tres pisos: Laboratorios de sutura, Fundición de los réprobos y Observatorio del Rector. Cada piso tiene 16 salas conectadas mediante un laberinto procedural. Puedes encontrar enemigos, suministros, archivos, trampas y estaciones de injertos.

La escalera de los dos primeros pisos y la salida del tercero están marcadas al noreste del plano. Solo puedes desplazarte por pasillos conectados. Las salas se descubren al acercarte y se resuelven una sola vez.

A los dos y cuatro minutos, la torre cambia algunos pasillos. El generador conserva una conexión válida entre todas las salas. El reloj no se pausa en combates, menús, al cambiar de pestaña ni al recargar.

Tras vencer al Rector, todavía debes pulsar **Escapar de la torre** antes de que el reloj llegue a cero.

### Muerte y reinicio

La muerte por daño y el agotamiento de los seis minutos terminan el intento. Tu espíritu vuelve a una mesa de disección. **Reanimar otro cuerpo** empieza un intento nuevo con otro cuerpo base y una torre regenerada.

Los planos, ecos, apariencias, contenido desbloqueado y estadísticas sobreviven. Los injertos, sueros, refrigerante y chatarra del cuerpo anterior no se trasladan al nuevo.

El juego guarda automáticamente en `localStorage`, dentro del navegador y origen donde lo abras. También conserva la hora límite del intento: recargar no devuelve tiempo. Si el navegador bloquea el almacenamiento, puedes jugar, pero el progreso no se conserva al cerrar. No hay sincronización entre dispositivos.

## Controles

| Acción | Teclado / ratón | Táctil / mando estándar |
| --- | --- | --- |
| Explorar | WASD, flechas o plano | Botones de dirección / cruceta o stick |
| Jugar una carta | Clic o teclas 1–7 | Tocar / elegir y confirmar con A |
| Terminar turno | Espacio | Botón / RB |
| Usar suero | Q | Panel Cuerpo / X |
| Usar refrigerante | E | Panel Cuerpo / Y |
| Abrir injertos | I | Botón Injertos |
| Abrir plano | M | Botón Mapa |
| Cerrar un panel | Esc | Botón de cierre / B |
| Abrir ajustes | Esc, sin otro panel abierto | Engranaje / Start |

El mando utiliza los controles que el navegador exponga a través de Gamepad API. No se ha validado con hardware físico de consola. En los menús, la cruceta mueve el foco; A confirma. El volumen también puede ajustarse con izquierda y derecha sobre su deslizador.

## Arte y sonido

El pixel art se dibuja en Canvas a baja resolución, sin imágenes remotas. Cada ranura modifica el aspecto del cuerpo; los injertos calientes muestran puntos incandescentes. Hay laboratorios, vitrales, tuberías, calderas, llamas, partículas y variantes visuales de los enemigos.

La banda sonora y los efectos se sintetizan con Web Audio. Incluyen capas graves, arpegios, pulsos, tic-tac, impactos, gruñidos sintéticos, válvulas e injertos. La música se acelera en combate y durante el último minuto. Son sonidos sintetizados, no grabaciones de estudio.

Puedes ajustar el volumen, desactivar los efectos, reducir las animaciones y alternar pantalla completa cuando el navegador lo permita.

## Relicario y alcance de esta entrega

El relicario incluye cuatro apariencias y el desbloqueo de **El ala prohibida**, que añade los encuentros del Archivista de ceniza y su plano con dos cartas. Se usa únicamente la moneda ganada al terminar intentos: **no hay cobros reales, pasarela de pago ni microtransacciones conectadas**.

Esta entrega es un **prototipo jugable de navegador**, con interfaz de escritorio y móvil y entrada de mando implementada. No incluye binarios nativos para PC, móviles o consolas, publicación en tiendas ni certificación de consolas. El potencial de monetización del concepto está representado por el relicario, no por una tienda comercial activa.

## Código

```text
index.html        Punto de entrada de la versión en carpeta
styles.css        Interfaz, adaptación móvil y estados visuales
favicon.svg       Icono original
src/
  i18n.js         Idioma activo y diccionario español / inglés
  data.js         Extremidades, cartas, enemigos, pisos y cosméticos
  engine.js       Reglas, reloj, generación de la torre y guardado
  art.js          Entornos y sprites de pixel art
  audio.js        Música y efectos sintetizados
  ui.js           Pantallas e interacción con ratón, teclado, táctil y mando
```

Para modificar el contenido o equilibrio, empieza por `src/data.js`. Las reglas del combate, calor y generación están en `src/engine.js`. La versión autocontenida es una copia de entrega: los cambios posteriores en estos archivos no la actualizan automáticamente.

El proyecto no utiliza bibliotecas externas, backend, gestores de paquetes ni archivos de pruebas.
