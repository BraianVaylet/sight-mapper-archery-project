# Design System — Sight Mapper (retro-futurista blueprint)

> Fuente: el artefacto Design System publicado el 2026-11-16
> (https://claude.ai/artifact/N56r27fiNaqyiGXEDAfaEF). Los archivos fieles estan en
> [design-system/](design-system/). Este documento junta todo en un solo lugar para portarlo.

## 1. Brand book (texto del artefacto)

Sight Mapper es un instrumento de bolsillo para arqueros: se usa parado en la linea de tiro, a pleno sol o con poca luz, con una mano y a veces con guantes. El estilo es **retro-futurista de plano tecnico**: una app moderna (limpia, plana, accesible) que se lee como un instrumento analogico de los 70–80 dibujado sobre papel de blueprint.

Primero la legibilidad, despues el caracter. Todo rasgo retro es decorativo y nunca se apoya debajo de un dato.

## Contenido y tono

- Español rioplatense (vos): "Agregá la primera marca", "¿No tenés cuenta?". Ingles en EN con el mismo tono directo.
- Verbo primero en acciones: "Agregar marca", "Crear setup", "Reintentar". Sin signos de exclamacion, sin emoji.
- Mayusculas solo en rotulos de instrumento (`label`): "DISTANCIA", "01 — TIRO". El resto en oracion.
- Numeros siempre con la unidad y el separador decimal del arquero: `4,5` en ES, `4.5` en EN; `50 m`, `55 yd`.
- Lo estimado se dice estimado: `≈2,75` + "Calculada". Nunca presentar un calculo como medido.

## Color: regla 60 / 30 / 10

Dos temas con la misma identidad navy + amarillo. **Oscuro (noche)** es el primero y el de referencia; **Claro (sol)** invierte para pleno sol.

| rol | % de la UI | oscuro | claro | tokens |
|---|---|---|---|---|
| Fondo — crea el ambiente | 60 | navy profundo con cuadricula | papel de plano con cuadricula | `bg`, `grid`, `grid-major` |
| Apoyo — acompaña | 30 | paneles navy medio | paneles blancos y azul niebla | `surface`, `surface-raised`, `sunken`, `border`, `line` |
| Acento — resalta | 10 | amarillo señal | navy tinta (con texto amarillo) | `accent`, `on-accent`, `accent-edge` |

- Usa `accent` solo para: la accion primaria (una por vista), la opcion elegida de un `Segmented`, el item actual del menu y la fila elegida. Si mas de un 10% de la pantalla es acento, sobra acento.
- En claro el acento pasa a navy porque el amarillo sobre blanco da 1,5:1 y al sol desaparece; el amarillo vuelve como texto `on-accent` sobre ese navy (9:1).
- Texto: `ink` para todo lo que se lee, `ink-muted` para rotulos y metadatos. Ambos superan 6:1 sobre `bg`, `surface`, `surface-raised` y `sunken` en los dos temas (objetivo exterior: AAA en cuerpo de texto).
- **Medido vs estimado** tiene color Y forma: `mark` + circulo lleno + linea solida para lo medido; `calc` + rombo + punteado + `≈` para lo calculado. `warning` (triangulo) y `danger` (cruz) para marcas sospechosas e inconsistentes. Nunca distinguir solo por color.
- `line` es decorativo (divisores); bordes de controles siempre `border` (≥3:1).
- Foco de teclado: `focus` 3px solido con offset 2px, ≥5:1 sobre todas las superficies.

## Fondo: cuadricula blueprint

- El `body` lleva `sm-blueprint`: cuadricula menor cada `grid-step` (8px) en `grid` y mayor cada `grid-step-major` (40px) en `grid-major`, fija al hacer scroll. Pantallas de invitado suman marcas de registro (`sm-blueprint-reg`).
- Contraste de la cuadricula con `bg` de 1,1 a 1,4: se ve, no compite.
- Ningun dato sobre la cuadricula: lecturas, listas y formularios van en `surface` o `sunken` opacos. Solo titulos de pantalla y saludos van directo sobre `bg`.

## Tipografia

Tres familias, servidas como woff2 propias (`fonts/`) y precacheadas por la PWA: funcionan offline y no dependen de Google.

- `display` — **Chakra Petch** 600/700: titulos de pantalla y nombres (`display-lg`, `display-md`, `display-sm`). Angulos rectos con esquinas cortadas: el guiño retro-futurista.
- `sans` — **IBM Plex Sans** 400/500/600: todo el texto de interfaz (`body-lg`, `body`, `body-strong`, `small`). Minimo 16px para cualquier texto que el arquero deba leer; `small` (14px) solo para ayudas y metadatos.
- `mono` — **IBM Plex Mono** 400/500/600, numeros tabulares: lecturas (`readout-xl` 72px, `readout` 22px), valores tecnicos (`data`) y rotulos de instrumento (`label`, 12px MAYUSCULAS con tracking .12em).
- Todo numero de tiro va en `mono` tabular para que las columnas alineen y `1` no se confunda con `l`.

## Espaciado, forma y profundidad

- Escala de 4px: `space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-5` 24 · `space-6` 40. Margen de pantalla en movil `space-4`.
- Radios chicos de instrumento: `radius-sm` 2px (controles), `radius-md` 4px (tarjetas), `radius-lg` 8px solo arriba de la `BottomSheet`.
- Bordes de 2px en controles y paneles: se ven con reflejo de sol.
- Sombras **duras, sin blur**: `shadow-key` bajo el boton primario (tecla fisica), `shadow-panel` 4px/4px en lo que flota (toast, hoja, menu). Nada de sombras difusas ni degradados.
- Tocables de `touch` (48px) minimo; accion principal fija abajo de `touch-lg` (56px).

## Rasgos retro (y donde)

1. Cuadricula blueprint y marcas de registro — fondo.
2. Rotulos de instrumento numerados (`01 — TIRO`) — encabezados de seccion, menu.
3. Esquinas HUD (`sm-hud`) — solo el `ReadingHud`.
4. Regla analogica con ticks — `SightRuler`.
5. Tecla con canto duro — boton primario.
6. Tira de estado tipo display de panel (`sm-strip`) — pie de la pantalla de la mira.
7. Brillo de fosforo suave en la lectura medida — solo tema oscuro.

No agregar mas: scanlines, ruido, CRT curvo o tipografias pixel bajan la legibilidad al sol.

## Iconografia

- SVG inline de 20px (16 en chapas), trazo 2px, terminaciones cuadradas, `currentColor`, `aria-hidden="true"`. Dibujo geometrico simple: menu, volver, mas, chevron, viento, doctor, imprimir, curva, arco, mira, flecha, papelera, ajustes (deslizadores), perfil, pin, salir.
- Las formas de estado de marca (circulo, rombo, triangulo, cruz) son parte del sistema y no se reemplazan por iconos.
- Logo: el icono de la app (`assets/Logos/sight-mapper-icon-512.png`, escala con marca amarilla sobre navy). Es un tile navy propio: se usa igual en ambos temas, sin recolorear.

## Movimiento

- Corto y funcional: 80–120 ms en presion de botones y cambio de fondo; el skeleton barre como escaner. Todo se anula con `prefers-reduced-motion`.

## Accesibilidad

- AA es el piso, AAA el objetivo en texto de cuerpo. Responsive 360 / 768 / 1440. Dark y light verificados en cada componente.
- Ningun estado depende solo del color (forma, texto o patron de borde siempre).
- Impresion: sin cuadricula, blanco con tinta negra.

## Componentes

Los de `@sight-mapper/ui` (Button, Field, Segmented, StatusBadge, InfoAlert, Toast, EmptyState, SectionCard, AppHeader, NavDrawer, BottomSheet) restilizados, mas adiciones intencionales:

- **BlueprintGrid** — el fondo firma.
- **ReadingHud**, **SightRuler**, **SetupCard** — piezas de dominio que hoy viven en `apps/pwa` y conviene subir a `ui` para fijar su estilo.
- **ActionBar** — mueve las acciones de la mira a la zona del pulgar.
- **LanguageSwitch** — idioma en pantallas de invitado.
- Pantallas de referencia: SightScreen, HomeScreen, SettingsScreen, SignInScreen.

Las clases viven en `components/bundle.css` con prefijo `sm-`. La estructura de navegacion y la regla de Ajustes estan en la seccion "Layout y navegacion".


## 2. Tokens

### 2.1 Color (tema `dark` = noche, primero y de referencia; `light` = sol)

| Token | Oscuro | Claro | Uso |
| --- | --- | --- | --- |
| `bg` | `#0b1b45` | `#eef2f9` | Fondo de la app (60%). Lleva la cuadricula blueprint encima. Crea el ambiente: navy de noche, papel de plano de dia. |
| `grid` | `#14275a` | `#dde4f1` | Linea menor de la cuadricula (cada 8px). Decorativa: nunca transmite informacion, nunca bajo texto suelto. |
| `grid-major` | `#1d356f` | `#c9d4e9` | Linea mayor de la cuadricula (cada 40px) y marcas de registro. |
| `surface` | `#13285f` | `#ffffff` | Apoyo (30%): tarjetas, paneles, hojas. Opaco, tapa la cuadricula para que los datos se lean limpios. |
| `surface-raised` | `#1c3266` | `#d5ddee` | Apoyo elevado: cabecera, fila seleccionada, encabezado de tabla, items activos del menu. |
| `sunken` | `#07122f` | `#e3e9f4` | Campos de texto, pozo de la regla de mira, barra de estado inferior. |
| `line` | `#2c4682` | `#b9c5de` | Separadores y divisores dentro de un panel. Decorativo (no cumple 3:1, no usar como borde de control). |
| `border` | `#7a92c4` | `#5f719c` | Borde de controles y tarjetas. >=3:1 sobre bg, surface y sunken en ambos temas. |
| `ink` | `#f4f6fc` | `#0b1b45` | Texto principal sobre bg, surface, surface-raised y sunken (>=11:1 en ambos temas). |
| `ink-muted` | `#aebddc` | `#3b4c78` | Texto secundario, etiquetas, metadatos; sobre bg, surface, surface-raised y sunken (>=6:1). |
| `accent` | `#ffcc00` | `#10286b` | Acento (10%): relleno de la accion principal, opcion elegida, foco de marca. Una accion primaria por vista. |
| `on-accent` | `#0b1b45` | `#ffcc00` | Texto e iconos sobre un relleno accent (11:1 dark, 9:1 light). Nunca blanco. |
| `accent-edge` | `#8a6d00` | `#050d24` | Canto duro bajo el boton primario (sombra sin blur, efecto tecla fisica). |
| `mark` | `#ffcc00` | `#6b4f00` | Lo MEDIDO dibujado como tinta: punto de marca registrada, linea de la regla, valor de lectura. Sobre bg, surface, surface-raised y sunken. |
| `calc` | `#6ec6e6` | `#0b5c8a` | Lo CALCULADO/estimado (rombo + punteado + aproximado), links y tinta cian del plano. Sobre todas las superficies. |
| `warning` | `#ff9f43` | `#8a4200` | Marca sospechosa (triangulo) y avisos. Siempre con icono: no se distingue de mark solo por color. |
| `danger` | `#ff8a8a` | `#b3261e` | Errores, marca inconsistente (cruz), acciones destructivas. Siempre con icono o texto. |
| `focus` | `#6ec6e6` | `#0b5c8a` | Anillo de foco de teclado: 3px solido, offset 2px. >=5:1 sobre todas las superficies. |

### 2.2 Tipografia

| Estilo | Familia | Tamaño / interlineado | Peso | Tracking | Uso |
| --- | --- | --- | --- | --- | --- |
| `display-lg` | display | 32px / 36px | 700 | 0.01em | Titulo de pantalla (h1). Uno por vista. |
| `display-md` | display | 24px / 28px | 600 | — | Nombre del arco en la tarjeta de setup, titulo de hoja. |
| `display-sm` | display | 18px / 24px | 600 | — | Titulo de panel, nombre de la app en la cabecera. |
| `body-lg` | sans | 18px / 26px | 400 | — | Texto de estados vacios y onboarding: se lee a un brazo de distancia. |
| `body` | sans | 16px / 24px | 400 | — | Texto corriente, valores de formulario. Minimo para cualquier texto que el arquero deba leer. |
| `body-strong` | sans | 16px / 24px | 600 | — | Botones, items de menu, enfasis. |
| `small` | sans | 14px / 20px | 400 | — | Ayudas de campo, metadatos. Nunca para datos de tiro. |
| `readout-xl` | mono | 72px / 72px | 600 | -0.02em | Lectura de mira y distancia elegida en el HUD. Numeros tabulares. |
| `readout` | mono | 22px / 28px | 500 | — | Distancias y lecturas en filas, regla y listados. |
| `label` | mono | 12px / 16px | 600 | 0.12em | Etiquetas de instrumento en MAYUSCULAS: encabezados de seccion, columnas, barra de estado. |
| `data` | mono | 16px / 24px | 500 | — | Valores tecnicos en linea (libraje, largo, spine). |

Familias: `display` = "Chakra Petch", ui-sans-serif, system-ui, sans-serif · `sans` = "IBM Plex
Sans", ui-sans-serif, system-ui, "Segoe UI", sans-serif · `mono` = "IBM Plex Mono", ui-monospace,
"SF Mono", Consolas, monospace. Archivos: `design-system/fonts/*.woff2` (subset latin de
`@fontsource/*` 5.3.0) + licencias OFL en `design-system/fonts/licenses/`. Numeros siempre con
`font-variant-numeric: tabular-nums` (y `slashed-zero` en mono).

### 2.3 Contraste medido (`node design-system/scripts/check-contrast.mjs`)

Minimos usados: texto principal ≥7 (AAA), resto del texto ≥4,5 (AA), bordes y foco ≥3.

```
== dark
ink        (>=7) bg 15.46 | surface 12.99 | surface-raised 11.45 | sunken 17.10
ink-muted  (>=4.5) bg 8.84 | surface 7.43 | surface-raised 6.55 | sunken 9.78
mark       (>=4.5) bg 11.05 | surface 9.28 | surface-raised 8.18 | sunken 12.22
calc       (>=4.5) bg 8.66 | surface 7.27 | surface-raised 6.41 | sunken 9.58
warning    (>=4.5) bg 8.19 | surface 6.88 | surface-raised 6.06 | sunken 9.06
danger     (>=4.5) bg 7.36 | surface 6.18 | surface-raised 5.45 | sunken 8.14
border     (>=3) bg 5.36 | surface 4.50 | surface-raised 3.97 | sunken 5.93
focus      (>=3) bg 8.66 | surface 7.27 | surface-raised 6.41 | sunken 9.58
on-accent  (>=7) accent 11.05
grid/bg 1.17 · grid-major/bg 1.42 (decorativo, objetivo 1.1-1.5)

== light
ink        (>=7) bg 14.88 | surface 16.71 | surface-raised 12.26 | sunken 13.71
ink-muted  (>=4.5) bg 7.51 | surface 8.43 | surface-raised 6.18 | sunken 6.92
mark       (>=4.5) bg 6.82 | surface 7.65 | surface-raised 5.62 | sunken 6.28
calc       (>=4.5) bg 6.42 | surface 7.21 | surface-raised 5.29 | sunken 5.92
warning    (>=4.5) bg 6.54 | surface 7.34 | surface-raised 5.39 | sunken 6.02
danger     (>=4.5) bg 5.82 | surface 6.54 | surface-raised 4.80 | sunken 5.36
border     (>=3) bg 4.32 | surface 4.85 | surface-raised 3.56 | sunken 3.98
focus      (>=3) bg 6.42 | surface 7.21 | surface-raised 5.29 | sunken 5.92
on-accent  (>=7) accent 9.03
grid/bg 1.14 · grid-major/bg 1.33 (decorativo, objetivo 1.1-1.5)
```

### 2.4 Espaciado, radios, sombras, tamaños

| Token | Valor | Uso |
| --- | --- | --- |
| `space-1` | `4px` | Icono-texto, separacion minima. |
| `space-2` | `8px` | Paso de la cuadricula menor. Gap entre chips y filas compactas. |
| `space-3` | `12px` | Padding de campo y de fila. |
| `space-4` | `16px` | Padding de tarjeta, margen de pantalla en movil. |
| `space-5` | `24px` | Separacion entre grupos dentro de una pantalla. |
| `space-6` | `40px` | Paso de la cuadricula mayor; separacion entre secciones en 768+. |
| `radius-sm` | `2px` | Botones, campos, chips: look de instrumento. |
| `radius-md` | `4px` | Tarjetas, paneles, hojas. |
| `radius-lg` | `8px` | Solo la hoja inferior (BottomSheet) en su borde superior. |
| `shadow-key` | `0 3px 0 0 #8a6d00 / 0 3px 0 0 #050d24` | Canto de tecla del boton primario (sin blur). |
| `shadow-panel` | `4px 4px 0 0 #07122f / 4px 4px 0 0 #c9d4e9` | Sombra offset dura de paneles flotantes (toast, hoja, drawer). Retro, sin desenfoque. |
| `touch` | `48px` | Alto minimo de todo control tocable (con guantes, al sol). Supera los 44px de WCAG. |
| `touch-lg` | `56px` | Accion principal fija abajo (Agregar marca, Crear setup). |
| `grid-step` | `8px` | Paso de la cuadricula de fondo. |
| `grid-step-major` | `40px` | Paso de la cuadricula mayor. |
| `content-max` | `1200px` | Ancho maximo del contenido en 1440. |

## 3. Mapeo a los tokens actuales de `@sight-mapper/ui`

| Token DS | Variable actual (`tokens.css`) | Utilidad Tailwind (`theme.css`) | Cambio |
| --- | --- | --- | --- |
| `bg` | `--sm-bg` | `bg` | valor |
| `grid` | `--sm-grid` | `grid` | **nuevo** |
| `grid-major` | `--sm-grid-major` | `grid-major` | **nuevo** |
| `surface` | `--sm-surface` | `surface` | valor |
| `surface-raised` | `--sm-surface-raised` | `raised` | **nuevo** |
| `sunken` | `--sm-surface-sunken` | `sunken` | valor |
| `line` | `--sm-line` | `line` | **nuevo** |
| `border` | `--sm-border` | `border` | igual en dark; claro igual |
| `ink` | `--sm-text` | `text` | valor (se conserva el nombre) |
| `ink-muted` | `--sm-text-muted` | `muted` | valor |
| `accent` | `--sm-accent` | `accent` | **claro pasa de amarillo a navy `#10286B`** |
| `on-accent` | `--sm-accent-ink` | `accent-ink` | **claro pasa de navy a amarillo `#FFCC00`** |
| `accent-edge` | `--sm-accent-edge` | `accent-edge` | claro `#050D24` |
| `mark` | `--sm-mark` | `mark` | claro `#6B4F00` |
| `calc` | `--sm-info` | `info` | igual (se conserva el nombre) |
| `warning` | `--sm-warning` | `warning` | dark `#FF9F43`, claro `#8A4200` |
| `danger` | `--sm-danger` | `danger` | igual |
| `focus` | `--sm-focus` | `focus` | **nuevo** (hoy el foco usa `--sm-info`) |
| `shadow-key` / `shadow-panel` | `--sm-shadow-key` / `--sm-shadow-panel` | `shadow-key` / `shadow-panel` | **nuevos** (hoy el canto esta inline en `button.tsx`) |
| `touch` / `touch-lg` | `--sm-size-touch` / `--sm-size-touch-lg` | — | 44 → **48**; 56 nuevo. `TOUCH_TARGET_PX` en `touch.ts` pasa a 48 |
| `grid-step` / `grid-step-major` | `--sm-grid-step` / `--sm-grid-step-major` | — | **nuevos** |
| `radius-sm/md/lg` | — | `--radius-sm/md/lg` | 2 / 4 / **8 (nuevo)** |
| `font-display/sans/mono` | — | `--font-display` / `--font-ui` / `--font-mono` | Chakra Petch / IBM Plex Sans / **IBM Plex Mono (nuevo)** |

Se conservan los nombres actuales (`text`, `muted`, `info`, `accent-ink`, `surface-sunken`) para no
tocar cada componente: el DS usa nombres semanticos (`ink`, `calc`, `on-accent`) pero el valor es el
mismo. `tokens.css` mantiene sus **tres bloques** (`:root` dark, `:root[data-theme='light']` y el
`@media (prefers-color-scheme: light) :root:not([data-theme])`), que es lo que lee `tokens.test.ts`.

## 4. Componentes

| Componente | Origen | Archivo de referencia | Notas para portar |
| --- | --- | --- | --- |
| Button | `ui` | `design-system/components/Button/` | variantes nuevas `ghost`, `danger`; modificadores `lg` (56 px) y `block`; borde 2 px; canto `shadow-key` |
| Field (+NumberField, PasswordField, Select) | `ui` | `Field/` | borde 2 px, `NumberField` en mono tabular, error con icono |
| Segmented | `ui` | `Segmented/` | cuadrado indicador en la opcion elegida (no solo color) |
| StatusBadge | `ui` | `StatusBadge/` | mono MAYUSCULAS, `calculated` con borde punteado |
| InfoAlert | `ui` | `InfoAlert/` | borde 2 px, titulo opcional |
| Toast (+UpdatePrompt) | `ui` | `Toast/` | `shadow-panel`, barra de tiempo `accent` 3 px |
| EmptyState (+ErrorState, Skeleton) | `ui` | `EmptyState/` | glifo de escala, barrido tipo escaner |
| SectionCard | `ui` | `SectionCard/` | prop nueva `index` (`01`) en `mark` |
| AppHeader | `ui` | `AppHeader/` | logo = icono real; solo accion de menu; `surface-raised` |
| NavDrawer (+NavItem) | `ui` | `NavDrawer/` | grupos rotulados, iconos, barra `accent` en el actual |
| BottomSheet | `ui` | `BottomSheet/` | `radius-lg` arriba, `shadow-panel` |
| BlueprintGrid | **adicion** | `BlueprintGrid/` | clase de fondo para `body` |
| ReadingHud | **adicion** (hoy dentro de `sight-screen.tsx`) | `ReadingHud/` | esquinas HUD, `readout-xl` 72 px |
| SightRuler (+MarksTable) | **adicion** (hoy `ruler.tsx` + tabla) | `SightRuler/` | solo estilo; geometria de `domain/ruler`; mantener leyenda |
| SetupCard | **adicion** (hoy dentro de `home-screen.tsx`) | `SetupCard/` | mantener estrella de favorito |
| ActionBar (+StatusStrip) | **adicion** | `ActionBar/` | fija abajo, `safe-area-inset-bottom`, ver D-1 |
| LanguageSwitch | **adicion** | `LanguageSwitch/` | solo rutas de invitado |
| SightScreen, HomeScreen, SettingsScreen, SignInScreen | pantallas de referencia | `components/<X>Screen/` | composicion a 360 px |

Todas las clases de referencia estan en `design-system/components/bundle.css` con prefijo `sm-`.
**No se copia ese CSS tal cual**: la app usa Tailwind v4 con utilidades sobre los tokens; el CSS es
la especificacion exacta de medidas, bordes y estados para traducir a clases de los componentes.

## 5. Iconos usados en los previews (SVG 24, trazo 2, `stroke-linecap="square"`)

menu, close, plus, chev, back, wind, doctor, print, curve, home, bow, sight, arrow, trash, settings,
user, stats, pin, logout, eye. Los paths estan en `design-system/components/*/preview.html` (ver por
ejemplo `NavDrawer/preview.html` y `ActionBar/preview.html`). Formas de estado de marca: circulo
lleno, rombo, triangulo, cruz (las mismas de `feedback.tsx`).

## 6. Cover del sistema

`design-system/components/Cover/preview.html`: bloques acento (con 13 ticks de escala calados en
`on-accent`), tinta (con grilla de cruces de 40 px calada), `calc` y `border`; nombre "Sight
Mapper" en Chakra Petch 96 px. Captura: `screenshots/cover-cmp.png`.
