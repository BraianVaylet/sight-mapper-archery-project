# BlueprintGrid

El fondo firma del producto: papel de plano tecnico. Va en el `body` de la app (`sm-blueprint`), nunca dentro de una tarjeta.

- Dos capas de lineas de 1px: menor `grid` cada `grid-step` (8px) y mayor `grid-major` cada `grid-step-major` (40px). Contraste con `bg` de 1,1–1,4: se percibe, no compite.
- `sm-blueprint-reg` agrega dos marcas de registro (cruz) en esquinas opuestas.
- `background-attachment: fixed`: la cuadricula no se mueve al hacer scroll, el contenido se desliza encima como sobre una mesa de dibujo.
- Regla: **ningun dato se apoya directo sobre la cuadricula.** Todo texto de lectura va dentro de `surface` o `sunken` opacos. Titulos de pantalla si pueden ir sobre `bg`.
- Impresion: se quita (fondo blanco).
