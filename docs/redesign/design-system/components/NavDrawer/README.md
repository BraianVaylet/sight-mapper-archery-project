# NavDrawer

Menu lateral (cubre `NavDrawer` y `NavItem`). 320px, panel `surface` con sombra dura `shadow-panel`; atrapa el foco y cierra con Esc.

- Agrupado con rotulos de instrumento: **01 — Tiro** (Inicio, Arcos, Miras, Flechas, Estadisticas) y **02 — Cuenta** (Ajustes, Perfil, Papelera).
- `NavItem`: icono 20px + etiqueta + contador (`sm-nav__count`, Plex Mono). El actual lleva `aria-current="page"`, fondo `surface-raised` y barra izquierda `accent` de 4px.
- Lo que viene lleva la chapa "Pronto" y `aria-disabled`.
- Pie: Cerrar sesion (secundario) y la hora de la ultima sincronizacion.
- **Ajustes** reemplaza a "Apariencia": es el unico lugar con tema, idioma y unidades.

El consumidor provee: los items traducidos, contadores, el destino actual y las acciones.
