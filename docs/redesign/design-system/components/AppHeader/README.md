# AppHeader

Cabecera de toda pantalla con sesion. Fondo `surface-raised`, borde inferior `border`, 64px de alto.

- Izquierda: el icono de la app (`assets/Logos/sight-mapper-icon-512.png`, 40px) ~~en Inicio; boton Volver (`ghost`, icono) en pantallas internas~~. [~] En todas las pantallas, y junto con el titulo es un link al Home (RF-X-08, 2026-11-17); no hay Volver en la cabecera.
- Centro: titulo `display-sm` (Chakra Petch) y subtitulo `label` con el contexto (setup, cantidad de marcas). Ambos truncan con elipsis.
- Derecha: **solo** el boton de menu. Tema, idioma y unidades NO van en la cabecera: viven en Ajustes.

El consumidor provee: `title`, `subtitle`, `logo` o accion de volver, y la accion de menu.
