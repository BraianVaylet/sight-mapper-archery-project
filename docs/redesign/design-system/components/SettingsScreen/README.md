# SettingsScreen

Ajustes: **el unico lugar** con tema, idioma y unidades (antes repartidos entre cabecera, pie y "Apariencia"). Ruta prevista `/settings`.

- Grupos numerados con `SectionCard`: 01 Pantalla (tema), 02 Idioma y unidades, 03 Acerca de (version, que sale del pie).
- Cada ajuste: nombre en negrita, descripcion corta en `ink-muted` y un `Segmented`. El cambio se aplica al instante y se guarda detras.
- El pie global con `PreferencesBar` se elimina de todas las pantallas.
