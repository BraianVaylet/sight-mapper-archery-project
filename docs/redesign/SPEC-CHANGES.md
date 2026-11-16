# Cambios de documentacion (van antes del codigo — tarea R-01)

> Regla del repo: si algo no esta en la spec, primero se actualiza la spec y despues se codea.
> Cambios marcados `[+]` (nuevo) / `[~]` (modificado); **nada se borra** (spec, regla 2 de
> `docs/README.md`): lo reemplazado se tacha o se anota "reemplazado por".
> Editar `docs/spec/` dispara la confirmacion del hook `guard-write.mjs`: es esperado.

## 1. `docs/spec/SIGHT-MAPPER-SPEC.md`

### §6.2 `account` — RF-ACC-04

```
- **RF-ACC-04** Preferencias: idioma (`es` | `en`), sistema de unidades (`metric` | `imperial`),
  tema (`dark` | `light` | `system`). Cambiar el sistema **no modifica datos**: solo la presentacion.
  [+] Se cambian **solo en Ajustes** (`/settings`). Unica excepcion: un selector compacto de idioma
  en las pantallas sin sesion (ingresar, registro, recupero, verificacion); ahi el tema sigue al
  sistema.
```

### §14 UX / UI — agregar al final de la lista

```
- [+] **Legible a la intemperie.** Dos temas, oscuro (noche) y claro (sol), con texto principal
  ≥7:1 y secundario ≥4,5:1 sobre todas las superficies; bordes de controles y foco ≥3:1.
- [+] **Paleta 60/30/10:** fondo (ambiente) 60%, apoyo (paneles) 30%, acento 10%. Una accion
  primaria por vista, en la zona del pulgar.
- [+] **Estilo retro-futurista de plano tecnico:** cuadricula blueprint de fondo que nunca queda
  debajo de un dato; los rasgos retro son decorativos y no restan legibilidad.
- [+] **Configuracion solo en Ajustes** (RF-ACC-04).
```

## 2. `docs/UX-UI.md`

- Encabezado: `[~]` "Sistema visual derivado de `design/` (hi-fi)" → "Sistema visual del rediseño
  retro-futurista blueprint (2026-11). Referencia completa: `docs/redesign/DESIGN-SYSTEM.md` y
  `docs/redesign/design-system/`. Los PNG de `design/` quedan como historicos."
- **§1 Principios** `[~]` 1: "Tocables ≥ 44×44 px" → "≥ 48×48 px (accion principal fija 56 px)".
  `[+]` 6: "**Retro decorativo, datos limpios.** La cuadricula y los rasgos retro nunca van debajo de
  un dato." `[+]` 7: "**La configuracion vive en Ajustes.**"
- **§2 Tokens** `[~]` reemplazar las tablas 2.1/2.2 por la de `DESIGN-SYSTEM.md` §2.1 (valores
  finales, ya no "aproximados") + la regla 60/30/10 + el mapeo §3 (nombres CSS que se conservan).
- **§2.3 Tipografia** `[~]` "Serif con numeros tabulares (tipo slab)" / "Sans geometrica" →
  Chakra Petch (display) · IBM Plex Sans (UI) · IBM Plex Mono (numeros, rotulos), woff2 propias
  precacheadas (ADR-012). Tabla de estilos de `DESIGN-SYSTEM.md` §2.2.
- **§2.4 Espaciado, forma y elevacion** `[~]` "Bordes de 1 px" → "2 px en controles y paneles";
  radios 2/4/8; sombras duras `shadow-key` / `shadow-panel`; `[~]` la grilla blueprint pasa de "fondo
  de los formularios de equipo" a **fondo de toda la app** (8/40 px, fija al scroll). `[+]` lista de
  los 7 rasgos retro permitidos y los prohibidos.
- **§3 Componentes** `[~]` `AppHeader`: "Isotipo + titulo + subtitulo, Theme, Menu" → "Logo o
  Volver + titulo + contexto + Menu (sin Theme)". `NavDrawer`: "…Profile, Appearance, Log out…" →
  grupos "01 — Tiro" / "02 — Cuenta" con **Ajustes**. `ToolButton` → parte de `ActionBar`.
  `Readout` → `ReadingHud` (esquinas HUD). `StatusBar` → tira de estado de `ActionBar`.
  `[+]` `BlueprintGrid`, `ActionBar`, `LanguageSwitch`, `SettingsList`.
- **§4.1 Home** `[~]` "Pie 'Sets saved: 2' se mantiene como 'Setups: 2'" → "se elimina; el
  numero va en el subtitulo de la cabecera" (D-4). `[+]` "Crear setup" fijo abajo; chapa
  "Acceso rapido" en la tarjeta que abre la app; la estrella de favorito se mantiene.
- **§4.2 Pantalla de la mira** `[~]` orden: cabecera → set de flechas → `ReadingHud` → regla +
  tabla + leyenda → `ActionBar` fija (herramientas segun D-1, "Agregar marca", tira de estado).
  Las reglas de habilitacion (Viento/Clima "Proximamente", Doctor desde 5, Imprimir desde 1) no
  cambian.
- **§4.5** `[+]` **Ajustes** (`/settings`): 01 Pantalla (tema) · 02 Idioma y unidades · 03 Acerca de
  (version). Cada ajuste: nombre, descripcion corta, `Segmented`; aplica al instante.
- **§4.6** `[+]` **Pantallas de invitado**: logo + `LanguageSwitch` arriba, marcas de registro en el
  fondo, sin pie de preferencias.
- **§6 Accesibilidad** `[~]` "Foco visible con anillo accent de 2 px" → "anillo `focus` 3 px
  solido, offset 2 px, ≥3:1 (medido ≥5:1) sobre toda superficie". `[+]` objetivo AAA (7:1) en texto
  principal.
- **§7 Responsive** `[+]` 1440: el menu puede pasar a riel lateral fijo de 320 px; la cuadricula
  ocupa todo el viewport.
- **§8 Gaps** `[+]` fila "Rediseño blueprint (todas las pantallas)" → F1-23..F1-33.

## 3. `docs/FUNCIONAL.md`

- **§1 Mapa** `[~]` `appearance[Apariencia]` → `settings[Ajustes]`.
- **§1.1 Rutas** `[~]` `/settings/appearance` → `/settings` "Ajustes: tema, idioma, unidades,
  version" (diseño: `docs/redesign/design-system/components/SettingsScreen`). `[+]` nota:
  "`/settings/appearance` redirige a `/settings`". `[~]` `/profile`: "Cuenta, exportar, baja,
  version" → "Cuenta, exportar, baja" (la version pasa a Ajustes).
- **HU-ACC-04** `[+]` criterio: "Given estoy en cualquier pantalla con sesion, Then no veo controles
  de tema ni idioma fuera de Ajustes." `[+]` "Given no tengo sesion, When toco EN en el selector de
  idioma, Then la pantalla cambia a ingles sin recargar y la eleccion se recuerda."

## 4. `docs/TECNICO.md` §14

`[+]` parrafo: "Fuentes propias (ADR-012): 8 woff2 subset latin (~150 KB) con
`font-display: swap`, servidas con hash desde `/assets/` (cache inmutable de Caddy) y precacheadas por
el service worker (`globPatterns` incluye `woff2`). No cuentan para el gate de JS. Vigilar el aviso
de LCP (~2,6 s): si sube, precargar solo Plex Sans 400 y Chakra Petch 700 o recortar pesos."

## 5. `docs/README.md`

`[+]` fila: "| Seguir el rediseño visual | [redesign/README.md](redesign/README.md) |".

## 6. `CLAUDE.md` (raiz)

- **Estado** `[+]` "Rediseño retro-futurista blueprint en curso (F1-23..F1-33, rama
  `feat/redesign-blueprint`); traspaso en `docs/redesign/`."
- **Stack** `[~]` agregar "fuentes propias Chakra Petch + IBM Plex (woff2, precache)".
- **Decisiones tomadas** `[~]` `docs/adr/000`–`012`.

## 7. `packages/ui/src/styles/theme.css`

El comentario "No web fonts: nothing to download before the first paint, and it works offline." se
reemplaza por la referencia al ADR-012 (las fuentes funcionan offline por el precache).

## 8. Borrador ADR-012 (crear con `/adr`)

```
# ADR-012 — Tipografia propia precacheada

- Estado: aceptada (2026-11-16, decision del autor)
- Reemplaza: la regla "sin web fonts" de theme.css (no era ADR)

## Contexto
El rediseño retro-futurista necesita una voz tipografica propia: titulos con caracter de
instrumento y numeros tabulares que no se confundan al sol. Las fuentes del sistema varian por
dispositivo (Roboto, SF, Segoe) y no dan esa voz. La app se usa sin señal: nada puede depender de la red.

## Decision
Chakra Petch 600/700 (titulos), IBM Plex Sans 400/500/600 (UI) e IBM Plex Mono 400/500/600 (numeros
y rotulos), licencia OFL, subset latin woff2 (~150 KB), servidas por la propia PWA (hash en
/assets/, font-src 'self' ya permitido por la CSP) y precacheadas por el service worker.
font-display: swap con fallbacks del sistema.

## Consecuencias
+ Identidad consistente en todos los dispositivos; numeros tabulares garantizados; offline.
- ~150 KB extra en la primera visita (no cuentan para el gate de JS de 180 KB).
- Riesgo sobre el aviso de LCP (~2,6 s): se mide en Lighthouse CI; mitigacion: precargar solo
  2 archivos o recortar pesos.
- Licencias OFL a conservar junto a los archivos.

## Alternativas descartadas
- Solo fuentes del sistema (ui-monospace + system-ui): cero costo, sin identidad retro.
- Google Fonts por CDN: rompe offline y la CSP (font-src 'self').
```
