# ReadingHud

El panel de lectura de la pantalla de la mira: lo primero que el arquero busca. Dos celdas: distancia elegida y lectura de mira.

- Numeros `readout-xl` (IBM Plex Mono 72px tabular): legibles a un brazo de distancia y al sol.
- Lectura medida en `mark`; estimada en `calc` precedida de `≈` y con badge de rombo. En oscuro, la lectura medida tiene un brillo de fosforo suave (decorativo).
- Esquinas HUD (`sm-hud`): dos escuadras en `mark` en esquinas opuestas. Solo en este panel: es lo que lo distingue como "instrumento vivo".
- Unidad en `ink-muted` 22px junto al numero.

El consumidor provee: distancia y lectura ya convertidas a la unidad y separador del arquero, y el estado (`registered` | `calculated`).
