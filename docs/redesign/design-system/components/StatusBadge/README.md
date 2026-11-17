# StatusBadge

Estado de una marca. **Medido ≠ estimado**: cada estado tiene forma propia ademas de color.

| kind | forma | color | borde |
|---|---|---|---|
| registered | circulo lleno | `mark` | solido |
| calculated | rombo | `calc` | punteado |
| suspect | triangulo | `warning` | solido |
| inconsistent | cruz | `danger` | solido |

Texto en IBM Plex Mono MAYUSCULAS 12px. `mark` (amarillo) y `warning` (naranja) son cercanos en el oscuro: la forma es la que los distingue, nunca quitarla.

El consumidor provee: `kind` y el texto ya traducido.
