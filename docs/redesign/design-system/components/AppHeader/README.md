# AppHeader

Cabecera de toda pantalla con sesion. Fondo `surface-raised`, borde inferior `border`, 64px de alto.

- Izquierda: el icono de la app (`assets/Logos/sight-mapper-icon-512.png`, 40px) en Inicio; boton Volver (`ghost`, icono) en pantallas internas.
- Centro: titulo `display-sm` (Chakra Petch) y subtitulo `label` con el contexto (setup, cantidad de marcas). Ambos truncan con elipsis.
- Derecha: **solo** el boton de menu. Tema, idioma y unidades NO van en la cabecera: viven en Ajustes.

El consumidor provee: `title`, `subtitle`, `logo` o accion de volver, y la accion de menu.
