# Field

Campo etiquetado con ayuda, error y unidad opcional. Cubre `Field`, `NumberField`, `PasswordField` y `Select` del codigo.

- Fondo `sunken`, borde `border` 2px, texto `ink`; alto `touch` (48px).
- **NumberField**: `sm-input--num` (IBM Plex Mono tabular) e `inputmode="decimal"`, tipo texto para que `6,25` y `6 1/4` sigan siendo tipeables. La unidad va como sufijo en `sm-field__suffix` (`m`, `yd`, `lb`, `in`).
- Error: `aria-invalid="true"`, borde `danger` y mensaje con icono de cruz en `danger`, enlazado por `aria-describedby`. Nunca solo color.
- La etiqueta siempre visible arriba (nunca placeholder como etiqueta).
- **Select**: nativo, por soporte de teclado, lector y picker del telefono.

El consumidor provee: `label`, `hint` y `error` ya traducidos, el valor y la unidad del arquero.
