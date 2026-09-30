# Build I — registro de construcción

Orquestador: Sonnet 5.5. Trabajadores: Sonnet 5.5 lanzados con el modelo `sonnet` de la herramienta de agentes.
**El «esfuerzo alto» pedido para los trabajadores no se pudo fijar:** la herramienta no expone un parámetro de
esfuerzo por agente, así que solo se les pidió en el texto del encargo que razonaran con cuidado y verificaran.

## Método

1. **Contrato primero.** El orquestador escribió `docs/design.md` (API de cada módulo, roster fijo de ids,
   vocabulario cerrado de efectos, checklist del concepto) y `js/config.js`. Commit previo a cualquier trabajador.
2. **Etapa A (en paralelo):** W1 núcleo/arranque, W2 datos/cuerpo, W6 sprites de mundo, W7 personajes, W8 audio.
3. **Etapa B (en paralelo, contra módulos reales):** W1b `run.js` (el mismo agente que W1), W4 torre+exploración,
   W3 combate+cosecha, W5 pantallas de meta.
4. **Etapa C:** QA1 (partidas completas con bots y equilibrio) y QA2 (conformidad con el concepto y UX).
5. Reglas para todos: sin tests ni hooks de depuración en el repo (los scripts de verificación vivieron en un
   scratchpad fuera del repositorio), un único dueño por archivo, sin commits de los trabajadores, sin leer las
   otras builds del repositorio.

## Decisiones del orquestador durante la obra

- **Calor casi inexistente.** W2 midió ~0,02 sobrecalentamientos por run: la degradación térmica, pilar del concepto,
  no se sentía. Se ralentizó el enfriamiento en `config.js` (`COOL_TURN` 12→8, `COOL_SEC` 3→1,5) y W2 reequilibró
  calor y desgaste (firmas de coste 3 a 44–55 de calor) y añadió contrajuego (cartas que enfrían y reparan).
  Resultado simulado: 1–2 sobrecalentamientos por run voraz. Por eso el calor de carta supera el 40 del contrato
  original y `design.md` §4.2 lo refleja.
- **Mayúsculas acentuadas.** La fuente dibujaba «MUÑÓN» como «MUñóN». Como el título es «EL RELOJ ANATÓMICO», se
  pidió a W1 corregirlo: cuerpo completo y marca sobre la celda (2 px, no 1, porque con 1 px parecía un defecto).
- **Salida siempre visible.** Con niebla y visión de 4 casillas un humano tardaría mucho en encontrar la salida;
  la escalera/salida se marca al entrar al piso y brilla entre la niebla.
- **Contenedor reiniciado.** Un reinicio mató a QA1 a mitad de tarea. Las ediciones parciales sobrevivieron en disco;
  se comprobó la sintaxis, se fijaron en un commit y se relanzó QA1 con contexto y notas.

## Hallazgos de la QA

- QA2: los 16 requisitos de la checklist se cumplen con evidencia (salvo que el audio solo se verificó por análisis).
  Arregló recortes de sprites grandes, el coste de `DD.text` en móviles lentos (de ~10 ms a 1–5 ms por fotograma con
  4× de CPU), `prefers-reduced-motion`, contraste del texto secundario, guardados hostiles (`ether:1e300`,
  `constructor` como plano) y añadió el aviso de girar el dispositivo en vertical.
- QA1: ~230 runs con bot sin excepciones ni bloqueos ni fugas (heap estable ~5,8 MB). Corrigió combates eternos
  (Gólem 7–12 turnos → 4,1), gracia de fuego tras volver de un combate, pausa por `blur`, textos tapados en la cosecha.

| Métrica (bot, primera run, jornalero) | Antes | Después |
|---|---|---|
| Victoria (voraz / cuidadoso) | 50 % / 25 % | 40 % / 28 % |
| Fin por tiempo | 50 % / 75 % | 45 % / 50 % |
| Muertes | 0 % / 0 % | 15 % / 23 % |
| Turnos por combate (pisos 1/2/3) | no medido | 2,9 / 3,5 / 4,3 |

Campaña de 96 runs con las cinco bases: 53 % de victoria. Los bots juegan mejor que una persona media y el
equilibrio no se probó con jugadores reales.

## Tamaño final

~10 100 líneas de JS/CSS/HTML en 14 archivos de código más los documentos.
