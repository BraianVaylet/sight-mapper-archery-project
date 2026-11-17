# EmptyState

Estados vacio, error y carga de todo listado. Cubre `EmptyState`, `ErrorState` y `Skeleton`.

- **Vacio**: borde punteado `border`, glifo de la escala en `mark`, titulo `display-md`, texto `body-lg` en `ink-muted` y una accion primaria que resuelve el vacio.
- **Error**: borde solido `danger`, glifo de cruz, `role="alert"` y accion "Reintentar" secundaria.
- **Skeleton**: barras `surface-raised` con un barrido tipo escaner; se congela con `prefers-reduced-motion`. Contenedor con `aria-busy="true"`.

El consumidor provee: titulo, texto y accion ya traducidos.
