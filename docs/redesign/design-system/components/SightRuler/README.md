# SightRuler

La escala de la mira junto a la lista de marcas. Es el corazon visual: una regla de instrumento analogico.

- Regla en pozo `sunken`: ticks mayores `ink` 2px con numero, menores `ink-muted` cada 0,25.
- Marca medida: linea solida + punto lleno en `mark`. Calculada: linea punteada + rombo en `calc`. Elegida: linea `accent` (en claro `ink`) con anillo.
- Filas de 60px: glifo de estado, distancia `readout` (Plex Mono 22px), estado en texto, lectura a la derecha. La elegida lleva `aria-current`, fondo `surface-raised` y barra `accent` a la izquierda.
- Sospechosa: triangulo `warning` y texto "Revisar"; la lectura sigue en `mark` porque sigue siendo medida.
- Tocar una fila elige esa distancia; mantener o boton abre la hoja de edicion.

El consumidor provee: rango de la escala, marcas (medidas y calculadas por `domain`), la elegida y los textos de estado.
