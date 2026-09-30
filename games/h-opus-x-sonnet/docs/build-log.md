# Build log — build H

1. **Orquestador:** escribió `docs/design.md`, el contrato con las API globales (`DD.*`), los
   ids de enemigos fijos, los formatos de datos y el reparto de archivos.
2. **W1–W4:** cuatro trabajadores Sonnet 5.5 construyeron sus módulos en paralelo contra ese
   contrato, sin ver el código de los demás.
3. **Orquestador:** envió a W4 las convenciones de coordenadas y los ids que ya usaban los otros
   módulos. Luego hizo una prueba de humo en Chromium: título → mesa → exploración → combate →
   cosecha, sin errores de consola.
4. **W5 (QA, Sonnet 5.5):** jugó todos los flujos con entrada real en Chromium: mesa, exploración,
   trampas, fuego, muros cambiantes, combate, rotura de extremidades, cosecha, jefe, victoria,
   muerte, tiempo agotado, pausa, tienda, códice y táctil.
   - **Corregido:** un fallo al pulsar "Fin de turno" con el ratón.
   - **Pulido:** la legibilidad del combate, la del códice y la del minimapa.
   - **Ajustado:** la ruta hasta las escaleras es más larga y hay un enemigo más por piso.
   - **Sin verificar:** la salida real de audio y un mando físico.
