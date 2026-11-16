# Button

Boton de 48px minimo de alto y ancho (`touch`), pensado para usarse con guantes y al sol.

- **primary**: relleno `accent` con texto `on-accent` y canto duro `shadow-key` (efecto tecla). Una sola por vista: la accion para la que existe la pantalla. Al presionar baja 2px.
- **secondary** (por defecto): borde `border` 2px, fondo transparente.
- **ghost**: sin borde; para acciones de cabecera y herramientas con icono.
- **link**: tinta `calc` subrayada; navegacion secundaria dentro de un texto o formulario.
- **danger**: borde y texto `danger`, siempre con icono; solo para acciones destructivas que tienen confirmacion o deshacer.
- `sm-btn--lg` (56px, `touch-lg`) + `sm-btn--block` para la accion principal fija abajo en movil.
- Boton de solo icono: `sm-btn--icon` y `aria-label` obligatorio.

El consumidor provee: el texto ya traducido (verbo primero, "Agregar marca"), el icono opcional (SVG 20px, `currentColor`) y `type` (por defecto `button`).
