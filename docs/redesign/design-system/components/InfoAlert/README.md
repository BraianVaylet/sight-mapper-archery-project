# InfoAlert

Mensaje dentro del flujo de la pagina. Borde 2px e icono en el color de la variante; el texto siempre en `ink` sobre `surface` para que se lea al sol.

- `info` (`calc`, circulo con i), `warning` (`warning`, triangulo), `danger` (`danger`, circulo con cruz). Formas distintas por variante.
- `danger` usa `role="alert"`; las demas `role="status"`.
- Titulo opcional en negrita (`sm-alert__title`) cuando el mensaje tiene dos partes.

El consumidor provee: `variant` y el contenido ya traducido.
