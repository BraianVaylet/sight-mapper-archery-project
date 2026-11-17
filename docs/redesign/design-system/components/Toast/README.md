# Toast

Confirma una accion optimista y ofrece deshacer durante 8 s (`TOAST_DURATION_MS`). Cubre tambien `UpdatePrompt` (version nueva de la PWA: se ofrece, no se impone).

- Panel `surface` con borde `border` y sombra dura `shadow-panel` (retro, sin blur).
- Barra de tiempo restante de 3px en `accent` debajo; decorativa (`aria-hidden`).
- `role="status"` + `aria-live="polite"`: se anuncia sin robar el foco.
- Fijo abajo, por encima de la barra de acciones, max 448px de ancho.

El consumidor provee: `message`, `actionLabel` + `onAction` opcionales, `dismissLabel`, `onDismiss`.
