# Segmented

Eleccion unica entre 2 a 4 opciones cortas (tema, unidades, idioma en Ajustes). `role="radiogroup"` con flechas de teclado.

- Pista `sunken` con borde `border`; la opcion elegida es un relleno `accent` con texto `on-accent` y un cuadrado indicador, asi no depende solo del color.
- Alto de opcion 42px dentro de una pista de 48px.
- Mas de 4 opciones o etiquetas largas: usar `Select`.

El consumidor provee: `label`, `options` (`value`, `label` traducido), `value` y `onChange`.
