# UX / UI — Sight Mapper

> ~~Sistema visual derivado de `design/` (hi-fi).~~
> [~] Sistema visual del rediseño retro-futurista blueprint (2026-11). Referencia completa:
> [redesign/DESIGN-SYSTEM.md](redesign/DESIGN-SYSTEM.md) y `docs/redesign/design-system/`. Los PNG de
> `design/` (hi-fi) y los mockups lo-fi (`mockup/`) quedan como historicos. Las
> pantallas y sus rutas estan en [FUNCIONAL.md](FUNCIONAL.md) §1.1.
>
> ⚠️ El diseño usa la marca "Bow Sight": se reemplaza por **Sight Mapper** (logo, splash, titulos).
> El isotipo (retícula con punto central) se conserva salvo que se rediseñe.

---

## 1. Principios

1. **Al sol, con guantes, con una mano.** Tocables ~~≥ 44×44 px~~ [~] ≥ 48×48 px (accion principal fija 56 px), accion principal abajo (zona del
   pulgar), contraste alto, numeros grandes.
2. **El numero es el producto.** La lectura de la mira es el elemento mas grande de la pantalla de
   la mira (`50 m → 4.5`).
3. **Medido ≠ estimado, siempre.** Punto lleno + linea solida vs rombo + linea punteada + `≈`.
4. **Instantaneo.** Optimista + deshacer. Nunca un spinner bloqueando la carga de una marca.
5. **No prometer lo que no hay.** Lo futuro se ve deshabilitado con "Proximamente" (RF-X-07).
6. [+] **Retro decorativo, datos limpios.** La cuadricula y los rasgos retro nunca van debajo de un
   dato.
7. [+] **La configuracion vive en Ajustes** (RF-ACC-04). [+] Excepcion: la tolerancia del Doctor,
   en su pantalla (RF-CAL-09).

## 2. Tokens

[~] Valores **finales** del rediseño blueprint, verificados por script en ambos temas
(`docs/redesign/design-system/scripts/check-contrast.mjs` y `packages/ui/src/tokens.test.ts`).
Variables CSS en `@sight-mapper/ui` (`tokens.css` + Tailwind v4 `@theme` en `theme.css`).

**Regla 60/30/10:** fondo (`bg` + cuadricula, crea el ambiente) 60% · apoyo (`surface`,
`surface-raised`, `sunken`, `border`, `line`) 30% · acento (`accent`) 10%: la accion primaria
(una por vista), la opcion elegida, el item actual del menu y la fila elegida.

### 2.1 Color — oscuro (noche, el de referencia) y claro (sol)

| Token DS | Variable CSS | Oscuro | Claro | Uso |
| --- | --- | --- | --- | --- |
| `bg` | `--sm-bg` | `#0b1b45` | `#eef2f9` | Fondo (60%), lleva la cuadricula |
| `grid` | `--sm-grid` | `#14275a` | `#dde4f1` | Linea menor de la cuadricula (8 px), decorativa |
| `grid-major` | `--sm-grid-major` | `#1d356f` | `#c9d4e9` | Linea mayor (40 px) y marcas de registro |
| `surface` | `--sm-surface` | `#13285f` | `#ffffff` | Tarjetas, paneles, hojas (opaco) |
| `surface-raised` | `--sm-surface-raised` | `#1c3266` | `#d5ddee` | Cabecera, fila elegida, encabezado de tabla |
| `sunken` | `--sm-surface-sunken` | `#07122f` | `#e3e9f4` | Campos, pozo de la regla, tira de estado |
| `line` | `--sm-line` | `#2c4682` | `#b9c5de` | Divisores (decorativo, no es borde de control) |
| `border` | `--sm-border` | `#7a92c4` | `#5f719c` | Borde de controles y tarjetas (>=3:1) |
| `ink` | `--sm-text` | `#f4f6fc` | `#0b1b45` | Texto principal (>=11:1) |
| `ink-muted` | `--sm-text-muted` | `#aebddc` | `#3b4c78` | Texto secundario (>=6:1) |
| `accent` | `--sm-accent` | `#ffcc00` | `#10286b` | Accion primaria, opcion elegida |
| `on-accent` | `--sm-accent-ink` | `#0b1b45` | `#ffcc00` | Texto sobre `accent` (11:1 / 9:1) |
| `accent-edge` | `--sm-accent-edge` | `#8a6d00` | `#050d24` | Canto duro del boton primario |
| `mark` | `--sm-mark` | `#ffcc00` | `#6b4f00` | Lo **medido** como tinta |
| `calc` | `--sm-info` | `#6ec6e6` | `#0b5c8a` | Lo **calculado**, links |
| `warning` | `--sm-warning` | `#ff9f43` | `#8a4200` | Marca sospechosa (triangulo en chapa y tabla; anillo en la regla, §5), avisos |
| `danger` | `--sm-danger` | `#ff8a8a` | `#b3261e` | Errores, inconsistente (cruz) |
| `focus` | `--sm-focus` | `#6ec6e6` | `#0b5c8a` | Anillo de foco (>=5:1) |

Se conservan los nombres CSS actuales (`text`, `muted`, `info`, `accent-ink`, `surface-sunken`);
el mapeo completo esta en [redesign/DESIGN-SYSTEM.md](redesign/DESIGN-SYSTEM.md) §3.

### 2.2 Historico (reemplazado por 2.1)

Valores **aproximados** tomados de los PNG; se reemplazan por los del archivo fuente del diseño
cuando este disponible. Se definen como variables CSS en `@sight-mapper/ui` (Tailwind v4 `@theme`).

#### Historico: tema dark derivado de los PNG

| Token                 | Valor aprox. | Uso                                                       |
| --------------------- | ------------ | --------------------------------------------------------- |
| `--color-bg`          | `#10286B`    | Fondo de pantalla (navy)                                  |
| `--color-surface`     | `#24406F`    | Cards, secciones, header                                  |
| `--color-surface-sunken` | `#0B1C4A` | Inputs, regla, grafico                                    |
| `--color-border`      | `#7A92C4`    | Bordes de cards e inputs                                  |
| `--color-text`        | `#FFFFFF`    | Texto principal                                           |
| `--color-text-muted`  | `#A9B9D8`    | Labels secundarios, placeholders                          |
| `--color-accent`      | `#FFCC00`    | CTA primario, lectura grande, marcas medidas, seleccion   |
| `--color-accent-ink`  | `#10286B`    | Texto sobre accent                                        |
| `--color-mark`        | `#FFCC00` (light `#7D5E00`) | Lo **medido** como tinta: badge "Registrada", puntos y lineas de la regla y la curva, estrella de favorito |
| `--color-info`        | `#6EC6E6`    | Links secundarios ("Change", "Show"), marcas calculadas   |
| `--color-danger`      | `#FF8A8A` (light `#B3261E`) | Errores, Doctor `inconsistent`                            |
| `--color-warning`     | `#FFB84D` (light `#7A4F00`) | Doctor `suspect`, baja confianza                          |

#### Historico: tema light (F1-18)

Light de **alto contraste** para el sol: fondo casi blanco, texto navy `#10286B`, accent amarillo
solo como relleno de CTA con texto navy (el amarillo sobre blanco no pasa contraste como texto).
Lo medido, que en dark es amarillo como tinta, en light es dorado oscuro (`--color-mark`, F1-18).
Ambos temas verificados con contraste AA (4.5:1 texto, 3:1 componentes).

### 2.3 Tipografia

[~] ~~Serif con numeros tabulares (tipo slab) / Sans geometrica~~ → fuentes propias woff2
precacheadas (ADR-012):

| Rol | Familia | Pesos | Uso |
| --- | --- | --- | --- |
| `display` | Chakra Petch | 600/700 | Titulos de pantalla, nombre del arco, titulo de hoja |
| `sans` | IBM Plex Sans | 400/500/600 | Todo el texto de interfaz (minimo 16 px para leer) |
| `mono` | IBM Plex Mono | 400/500/600 | Lecturas (`readout-xl` 72 px, `readout` 22 px), valores, rotulos `label` 12 px MAYUSCULAS |

Escala completa de estilos en [redesign/DESIGN-SYSTEM.md](redesign/DESIGN-SYSTEM.md) §2.2.

Numeros siempre con `font-variant-numeric: tabular-nums` para que no bailen las columnas.

### 2.4 Espaciado, forma y elevacion

- Grilla de 4 px. Padding de pantalla 16 px.
- ~~Bordes de 1 px~~ [~] Bordes de 2 px en controles y paneles; radios 2 / 4 / 8 px (8 solo arriba de la
  `BottomSheet`): estetica de "instrumento".
- CTA primario con sombra inferior solida (efecto "boton fisico" del diseño). [+] Sombras duras sin
  blur: `shadow-key` (canto del primario) y `shadow-panel` 4/4 px (toast, hoja, menu).
- ~~Fondo de los formularios de equipo con grilla tipo plano~~ [~] Cuadricula blueprint de fondo en
  **toda la app** (8/40 px, fija al scroll, contraste 1,1–1,4 con `bg`); ningun dato sobre ella: los
  datos van en superficies opacas. Encabezados de seccion en versalitas con linea punteada y
  contador de campos (`BOW IDENTITY ----- 2`), ahora numerados (`01`).
- [+] Rasgos retro permitidos (solo estos 7): cuadricula + marcas de registro; rotulos de instrumento
  numerados (`01 — TIRO`); esquinas HUD solo en el panel de lectura; regla analogica con ticks;
  boton primario con canto duro; tira de estado tipo display; brillo de fosforo suave en la lectura
  medida (solo oscuro). **Prohibidos:** scanlines, ruido, CRT curvo, tipografias pixel.

## 3. Componentes (`@sight-mapper/ui`)

| Componente          | Donde aparece en el diseño                           | Notas                                              |
| ------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| `AppHeader`         | Todas                                                | ~~Isotipo + titulo + subtitulo, Theme, Menu~~ [~] Logo o Volver + titulo + contexto + Menu (sin Theme). [+] Con sesion, logo + nombre son un link al Home (RF-X-08) |
| `NavDrawer`         | Navigation drawer                                    | [~] Grupos "01 — Tiro" (Inicio, Arcos, Miras, Flechas, Estadisticas "Proximamente") y "02 — Cuenta" (**Ajustes**, Perfil, Papelera); pie con Cerrar sesion y "Synced …". [+] Entra desde la **derecha**; "Doctor" se suma al grupo 01 |
| `BackLink`          | Forms, pantalla de la mira                           | `‹ Home`                                           |
| `SectionCard`       | Forms de equipo                                      | Encabezado versalitas + contador                   |
| `Field` / `NumberField` | Forms                                            | Label, input, sufijo de unidad, ayuda, error       |
| `PasswordField`     | Login, registro                                      | Boton "Show"                                       |
| `Segmented`         | Cam type, pin type, unidades                         | Opciones grandes, una seleccionada en accent       |
| `Select`            | New set, selector de flechas                         | Con "+ Cargar uno nuevo"                           |
| `Button`            | primario (accent), secundario (outline), link        | ~~44 px~~ [~] 48 px min; `lg` 56 px; variantes `ghost` y `danger` |
| `ToolButton`        | Wind / Weather / Doctor / Print                      | Icono + label; estado deshabilitado con badge. [~] Parte de `ActionBar` |
| `SetupCard`         | Home                                                 | Arco (~~serif~~ [~] display), mira · pin (~~accent~~ [~] `mark`), flechas, fecha, favorito; [+] chapa "Acceso rapido" |
| `Readout`           | Pantalla de la mira                                  | `50 m → 4.5` + badge de estado. [~] Pasa a `ReadingHud` (esquinas HUD) |
| `StatusBadge`       | "Registered", "Calculated", "Suspect"                | Con icono, no solo color                           |
| `Ruler`             | Pantalla de la mira, intermedias                     | SVG, ver §5                                        |
| `MarksTable`        | Pantalla de la mira                                  | Fila: punto/rombo, distancia, estado, lectura; fila seleccionada resaltada |
| `DistanceCurve`     | Intermedias                                          | Medido solido, calculado punteado, seleccion con guias |
| `Accordion`         | "Calculate custom distances", "Calculate intermediate distances" |                                         |
| `InfoAlert`         | "Calculation needs at least 2 sight marks"           | Variantes info/warning/danger                      |
| `ProgressChecklist` | Estado vacio de la mira ("Still missing")            |                                                    |
| `StatusBar`         | Pie de la pantalla de la mira                        | `SETUP · MIRA      50 M · 4.5`. [~] Tira de estado de `ActionBar` |
| `BottomSheet`       | Nueva/editar marca (sin diseño)                      | Teclado numerico, stepper ± quantum                |
| `Toast` + `Undo`    | Acciones optimistas                                  | 8 s                                                |
| `EmptyState` / `ErrorState` / `Skeleton` | Todos los listados             | RF-X-01                                            |
| `UpdatePrompt`      | Global                                               | "Hay una version nueva · Actualizar"               |
| [+] `BlueprintGrid` | Fondo de toda la app | Cuadricula 8/40 px; marcas de registro en invitado |
| [+] `ActionBar` | Pantalla de la mira | Fija abajo: herramientas, "Agregar marca", tira de estado |
| [+] `LanguageSwitch` | Pantallas de invitado | ES/EN compacto, `aria-pressed` |
| [+] `SettingsList` | Ajustes | Nombre + descripcion + `Segmented` por ajuste |

## 4. Pantallas: decisiones sobre el diseño

### 4.1 Home (`Home — Your sets.png`)

- "Your sets" → **"Your setups"** / "Tus setups". "Create a set" → "Create a setup".
- Agregar estrella de favorito en cada card (no esta en el diseño) y orden favoritos primero.
- ~~Pie "Sets saved: 2" se mantiene como "Setups: 2".~~ [~] Se elimina; el numero va en el subtitulo
  de la cabecera (D-4).
- [+] "Crear setup" fijo abajo; chapa "Acceso rapido" en la tarjeta que abre la app; la estrella de
  favorito se mantiene.

### 4.2 Pantalla de la mira (`UV slider — *.png`)

- Base: la variante **Full marks** (lectura grande + selector de flechas + herramientas + regla con
  tabla al lado) para movil.
- Herramientas: Wind y Weather deshabilitados con "Proximamente"; Doctor habilitado desde 5 marcas
  (antes, deshabilitado con `X/5`); Print habilitado desde 1 marca.
- Leyenda obligatoria bajo la regla: `● Registered  ◇ Calculated`.
- Direccion de la regla segun `scale.direction` de la mira (el diseño muestra ambas; es correcto
  que varie).
- [+] Seccion "03 · Deriva" bajo la regla vertical (F1-42): una **regla horizontal** (`Ruler`
  con `orientation="horizontal"`, direccion segun `windageScale.direction`) con la deriva de base
  del setup (una sola marca) y un boton "Editar deriva" que abre una hoja con el campo. La deriva va
  tambien en el `ReadingHud` (vale para cualquier distancia). Sin escala horizontal, la seccion
  muestra un aviso con link a editar la mira. El formulario de mira suma el bloque "Escala
  horizontal", precargado con una copia de la vertical en una mira nueva.
- Agregar accion "Abrir siempre aca" (acceso rapido) en el menu de la pantalla.
- Estado vacio: el de `UV slider — Empty state.png`, con el texto escalonado ("needs at least 2").
- [~] Orden: cabecera → set de flechas → `ReadingHud` → regla + tabla + leyenda → `ActionBar` fija
  (Intermedias, Doctor con `X/5` si falta, Imprimir; Viento y Clima juntos en una chapa
  "Proximamente" (D-1); "Agregar marca"; tira de estado). Las reglas de habilitacion no cambian.

### 4.3 Intermedias (`Calculate distances — Curve.png`)

- Arriba: distancia seleccionada y lectura.
- "Calculate custom distances": input de distancia + "Get reading".
- "Calculate intermediate distances": controles `desde`, `hasta`, `paso` (1/2/5/10) + curva + tabla.
- La regla del final se mantiene (mismos numeros que la curva).

### 4.4 Forms de equipo

- **New bow:** se respeta el diseño de 3 secciones. Unidades como sufijo segun ~~sistema~~ [~] el sistema de la seccion arco (`in`/`cm`,
  `lb`/`kg`, `fps`/`m/s`).
- [+] Todo campo numerico de arco y flechas lleva su rango valido como ayuda (`hint`, asociada con
  `aria-describedby`), en la unidad de la seccion y redondeado hacia adentro (RN-EQP-03).
- **New sight:** se reemplaza "Units: mm / inches / clicks / MOA" por `mm / cm / in / clicks /
  custom`; se agregan **minimo**, **maximo**, **direccion** y, para `custom`/`click`, el tamaño de
  unidad (o el largo fisico entre minimo y maximo). "Adjustment range" pasa a ser derivado y se
  muestra como resumen ("Recorrido: 80 mm").
- **New arrow set:** se respeta ([+] unidades segun la seccion flechas); campos extra (vanes, nock, peso total, velocidad) en una seccion
  plegable "Mas datos".
- **New set → New setup:** el select de flechas pasa a **multiseleccion** (1..N).

### 4.5 [+] Ajustes (`/settings`)

- 01 Pantalla (tema) · 02 Idioma y unidades · 03 Acerca de (version).
- [+] En 02, un `Segmented` metrico/imperial por seccion: marcas, arco, flechas, mira, cada uno con
  su descripcion (la de mira aclara que solo preselecciona la unidad de una mira nueva).
- [+] La version es la del `package.json` raiz (RF-X-03).
- Cada ajuste: nombre, descripcion corta y `Segmented`; aplica al instante.

### 4.6 [+] Pantallas de invitado

- Logo + `LanguageSwitch` arriba, marcas de registro en el fondo, sin pie de preferencias. El tema
  sigue al sistema.

### 4.7 [+] Doctor (`/doctor`)

- Explicacion del umbral (RN-CAL-06) con un ejemplo numerico y un dibujo de la regla con la banda
  de tolerancia; debajo, la tolerancia base con un control de pasos de 0.5 mm (1–10 mm), el valor por
  defecto marcado y "Volver al valor por defecto". Aplica al instante, como Ajustes.
- Con la seccion mira en imperial, al lado de los mm va el equivalente en pulgadas con 3 decimales
  (0.5 mm ≈ 0.020 in). Bajo ~1.2 mm, aviso: "Puede señalar marcas bien medidas".

## 5. La regla (componente estrella)

- SVG con geometria de `@sight-mapper/domain/ruler` (ticks enteros, guarda de densidad,
  anti-solape).
- Punto lleno ~~accent~~ [~] `mark` = medida; rombo info = calculada; anillo = seleccionada; anillo warning =
  sospechosa (Doctor).
- Tocar un punto selecciona la distancia; con teclado, flechas arriba/abajo recorren las marcas.
- Altura minima util 360 px en movil; si la escala es larga, la regla escala para entrar entera
  (no scroll interno).

## 6. Accesibilidad

- WCAG 2.2 AA en ambos temas. ~~Foco visible con anillo accent de 2 px.~~ [~] Foco visible con anillo
  `focus` 3 px solido, offset 2 px, ≥3:1 (medido ≥5:1) sobre toda superficie.
- [+] Objetivo AAA (7:1) en el texto principal.
- El estado nunca solo por color: icono + texto ("Registered", "≈ Calculated").
- La regla y la curva tienen alternativa textual: la tabla es la fuente accesible.
- `prefers-reduced-motion` desactiva animaciones de Motion.
- Labels reales en todos los inputs; errores asociados con `aria-describedby`.

## 7. Responsive

| Ancho  | Layout                                                                    |
| ------ | ------------------------------------------------------------------------- |
| 360    | Una columna (diseño actual)                                               |
| 768    | Pantalla de la mira en dos columnas: regla+tabla / lectura+herramientas+curva |
| 1440   | Contenedor maximo 1200 px; listas de equipo en grilla; base para MAKER (F2). [+] Menu como riel lateral fijo de 320 px ([+] a la derecha del contenido); la cuadricula ocupa todo el viewport |

## 8. Gaps de diseño a cubrir

| Pantalla / estado                      | Tarea   |
| -------------------------------------- | ------- |
| Tema light completo                    | F0-09 / F1-18 |
| Listados de arcos, miras, flechas      | F1-02/03/04 |
| Hoja de nueva/editar marca             | F1-09   |
| Mark Doctor                            | F1-11   |
| Listado imprimible                     | F1-14   |
| Configuracion / Apariencia / Perfil    | F1-01 / F1-16 ([~] Apariencia → Ajustes, F1-29) |
| Forgot / reset password, verify email  | F0-15   |
| Onboarding                             | F1-17   |
| Papelera                               | F1-05   |
| Layout 768 / 1440                      | F1-20   |
| [+] Rediseño blueprint (todas las pantallas) | F1-23..F1-33 |
