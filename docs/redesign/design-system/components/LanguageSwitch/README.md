# LanguageSwitch

Selector compacto de idioma. **Solo en pantallas de invitado** (ingresar, crear cuenta, recuperar contraseña), arriba a la derecha: quien todavia no tiene cuenta necesita poder leer la app.

- Con sesion, el idioma se cambia unicamente en Ajustes (`Segmented`). Ninguna otra pantalla muestra tema ni idioma.
- El tema en pantallas de invitado sigue al sistema; no hay selector.
- Codigos ES / EN en Plex Mono; el elegido en `accent`. `aria-pressed` y `lang` en cada opcion.

El consumidor provee: el idioma actual y el cambio.
