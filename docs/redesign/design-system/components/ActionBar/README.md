# ActionBar

Barra fija inferior de la pantalla de la mira, en la zona del pulgar. Reemplaza la fila de botones que estaba arriba del todo.

- Fila de herramientas (`sm-tool`, 56px, icono + texto): Intermedias, Viento, Doctor, Imprimir. Secundarias, iguales entre si.
- Debajo, la accion primaria de bloque `touch-lg`: "Agregar marca".
- Debajo, la tira de estado (`sm-strip`): setup a la izquierda y lectura viva a la derecha con punto `mark`, en Plex Mono MAYUSCULAS sobre `sunken`. Display de panel retro; `aria-hidden` porque repite el HUD.
- Respeta `safe-area-inset-bottom`. Se oculta al imprimir.

El consumidor provee: las herramientas disponibles y sus textos, la accion primaria y el resumen de la tira.
