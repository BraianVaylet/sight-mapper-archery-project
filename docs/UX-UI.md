# UX / UI — Sight Mapper

> Sistema visual derivado de `design/` (hi-fi). Los mockups lo-fi (`mockup/`) son historicos. Las
> pantallas y sus rutas estan en [FUNCIONAL.md](FUNCIONAL.md) §1.1.
>
> ⚠️ El diseño usa la marca "Bow Sight": se reemplaza por **Sight Mapper** (logo, splash, titulos).
> El isotipo (retícula con punto central) se conserva salvo que se rediseñe.

---

## 1. Principios

1. **Al sol, con guantes, con una mano.** Tocables ≥ 44×44 px, accion principal abajo (zona del
   pulgar), contraste alto, numeros grandes.
2. **El numero es el producto.** La lectura de la mira es el elemento mas grande de la pantalla de
   la mira (`50 m → 4.5`).
3. **Medido ≠ estimado, siempre.** Punto lleno + linea solida vs rombo + linea punteada + `≈`.
4. **Instantaneo.** Optimista + deshacer. Nunca un spinner bloqueando la carga de una marca.
5. **No prometer lo que no hay.** Lo futuro se ve deshabilitado con "Proximamente" (RF-X-07).

## 2. Tokens

Valores **aproximados** tomados de los PNG; se reemplazan por los del archivo fuente del diseño
cuando este disponible. Se definen como variables CSS en `@sight-mapper/ui` (Tailwind v4 `@theme`).

### 2.1 Color — tema dark (el del diseño)

| Token                 | Valor aprox. | Uso                                                       |
| --------------------- | ------------ | --------------------------------------------------------- |
| `--color-bg`          | `#10286B`    | Fondo de pantalla (navy)                                  |
| `--color-surface`     | `#24406F`    | Cards, secciones, header                                  |
| `--color-surface-sunken` | `#0B1C4A` | Inputs, regla, grafico                                    |
| `--color-border`      | `#5B74A6`    | Bordes de cards e inputs                                  |
| `--color-text`        | `#FFFFFF`    | Texto principal                                           |
| `--color-text-muted`  | `#A9B9D8`    | Labels secundarios, placeholders                          |
| `--color-accent`      | `#FFCC00`    | CTA primario, lectura grande, marcas medidas, seleccion   |
| `--color-accent-ink`  | `#10286B`    | Texto sobre accent                                        |
| `--color-info`        | `#6EC6E6`    | Links secundarios ("Change", "Show"), marcas calculadas   |
| `--color-danger`      | a definir    | Errores, Doctor `inconsistent`                            |
| `--color-warning`     | a definir    | Doctor `suspect`, baja confianza                          |

### 2.2 Color — tema light (a diseñar, F0-09/F1-18)

Light de **alto contraste** para el sol: fondo casi blanco, texto navy `#10286B`, accent amarillo
solo como relleno de CTA con texto navy (el amarillo sobre blanco no pasa contraste como texto).
Ambos temas verificados con contraste AA (4.5:1 texto, 3:1 componentes).

### 2.3 Tipografia

| Rol              | Familia (a confirmar con el fuente) | Uso                                                |
| ---------------- | ----------------------------------- | -------------------------------------------------- |
| Display / numeros| Serif con numeros tabulares (tipo slab) | Nombres de arco ("PSE Evo NXT 35"), lecturas, distancias |
| UI               | Sans geometrica                     | Titulos ("Sign in"), labels, botones               |

Numeros siempre con `font-variant-numeric: tabular-nums` para que no bailen las columnas.

### 2.4 Espaciado, forma y elevacion

- Grilla de 4 px. Padding de pantalla 16 px.
- Bordes de 1 px; radios chicos (2–4 px): estetica de "instrumento".
- CTA primario con sombra inferior solida (efecto "boton fisico" del diseño).
- Fondo de los formularios de equipo con grilla tipo plano ("blueprint") y encabezados de seccion
  en versalitas con linea punteada y contador de campos (`BOW IDENTITY ----- 2`).

## 3. Componentes (`@sight-mapper/ui`)

| Componente          | Donde aparece en el diseño                           | Notas                                              |
| ------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| `AppHeader`         | Todas                                                | Isotipo + titulo + subtitulo, Theme, Menu          |
| `NavDrawer`         | Navigation drawer                                    | Items con contador, Statistics (proximamente), Profile, Appearance, Log out, "Synced …" |
| `BackLink`          | Forms, pantalla de la mira                           | `‹ Home`                                           |
| `SectionCard`       | Forms de equipo                                      | Encabezado versalitas + contador                   |
| `Field` / `NumberField` | Forms                                            | Label, input, sufijo de unidad, ayuda, error       |
| `PasswordField`     | Login, registro                                      | Boton "Show"                                       |
| `Segmented`         | Cam type, pin type, unidades                         | Opciones grandes, una seleccionada en accent       |
| `Select`            | New set, selector de flechas                         | Con "+ Cargar uno nuevo"                           |
| `Button`            | primario (accent), secundario (outline), link        | 44 px min                                          |
| `ToolButton`        | Wind / Weather / Doctor / Print                      | Icono + label; estado deshabilitado con badge       |
| `SetupCard`         | Home                                                 | Arco (serif), mira · pin (accent), flechas, fecha, favorito |
| `Readout`           | Pantalla de la mira                                  | `50 m → 4.5` + badge de estado                     |
| `StatusBadge`       | "Registered", "Calculated", "Suspect"                | Con icono, no solo color                           |
| `Ruler`             | Pantalla de la mira, intermedias                     | SVG, ver §5                                        |
| `MarksTable`        | Pantalla de la mira                                  | Fila: punto/rombo, distancia, estado, lectura; fila seleccionada resaltada |
| `DistanceCurve`     | Intermedias                                          | Medido solido, calculado punteado, seleccion con guias |
| `Accordion`         | "Calculate custom distances", "Calculate intermediate distances" |                                         |
| `InfoAlert`         | "Calculation needs at least 2 sight marks"           | Variantes info/warning/danger                      |
| `ProgressChecklist` | Estado vacio de la mira ("Still missing")            |                                                    |
| `StatusBar`         | Pie de la pantalla de la mira                        | `SETUP · MIRA      50 M · 4.5`                     |
| `BottomSheet`       | Nueva/editar marca (sin diseño)                      | Teclado numerico, stepper ± quantum                |
| `Toast` + `Undo`    | Acciones optimistas                                  | 8 s                                                |
| `EmptyState` / `ErrorState` / `Skeleton` | Todos los listados             | RF-X-01                                            |
| `UpdatePrompt`      | Global                                               | "Hay una version nueva · Actualizar"               |

## 4. Pantallas: decisiones sobre el diseño

### 4.1 Home (`Home — Your sets.png`)

- "Your sets" → **"Your setups"** / "Tus setups". "Create a set" → "Create a setup".
- Agregar estrella de favorito en cada card (no esta en el diseño) y orden favoritos primero.
- Pie "Sets saved: 2" se mantiene como "Setups: 2".

### 4.2 Pantalla de la mira (`UV slider — *.png`)

- Base: la variante **Full marks** (lectura grande + selector de flechas + herramientas + regla con
  tabla al lado) para movil.
- Herramientas: Wind y Weather deshabilitados con "Proximamente"; Doctor habilitado desde 5 marcas
  (antes, deshabilitado con `X/5`); Print habilitado desde 1 marca.
- Leyenda obligatoria bajo la regla: `● Registered  ◇ Calculated`.
- Direccion de la regla segun `scale.direction` de la mira (el diseño muestra ambas; es correcto
  que varie).
- Agregar accion "Abrir siempre aca" (acceso rapido) en el menu de la pantalla.
- Estado vacio: el de `UV slider — Empty state.png`, con el texto escalonado ("needs at least 2").

### 4.3 Intermedias (`Calculate distances — Curve.png`)

- Arriba: distancia seleccionada y lectura.
- "Calculate custom distances": input de distancia + "Get reading".
- "Calculate intermediate distances": controles `desde`, `hasta`, `paso` (1/2/5/10) + curva + tabla.
- La regla del final se mantiene (mismos numeros que la curva).

### 4.4 Forms de equipo

- **New bow:** se respeta el diseño de 3 secciones. Unidades como sufijo segun sistema (`in`/`cm`,
  `lb`/`kg`, `fps`/`m/s`).
- **New sight:** se reemplaza "Units: mm / inches / clicks / MOA" por `mm / cm / in / clicks /
  custom`; se agregan **minimo**, **maximo**, **direccion** y, para `custom`/`click`, el tamaño de
  unidad (o el largo fisico entre minimo y maximo). "Adjustment range" pasa a ser derivado y se
  muestra como resumen ("Recorrido: 80 mm").
- **New arrow set:** se respeta; campos extra (vanes, nock, peso total, velocidad) en una seccion
  plegable "Mas datos".
- **New set → New setup:** el select de flechas pasa a **multiseleccion** (1..N).

## 5. La regla (componente estrella)

- SVG con geometria de `@sight-mapper/domain/ruler` (ticks enteros, guarda de densidad,
  anti-solape).
- Punto lleno accent = medida; rombo info = calculada; anillo = seleccionada; anillo warning =
  sospechosa (Doctor).
- Tocar un punto selecciona la distancia; con teclado, flechas arriba/abajo recorren las marcas.
- Altura minima util 360 px en movil; si la escala es larga, la regla escala para entrar entera
  (no scroll interno).

## 6. Accesibilidad

- WCAG 2.2 AA en ambos temas. Foco visible con anillo accent de 2 px.
- El estado nunca solo por color: icono + texto ("Registered", "≈ Calculated").
- La regla y la curva tienen alternativa textual: la tabla es la fuente accesible.
- `prefers-reduced-motion` desactiva animaciones de Motion.
- Labels reales en todos los inputs; errores asociados con `aria-describedby`.

## 7. Responsive

| Ancho  | Layout                                                                    |
| ------ | ------------------------------------------------------------------------- |
| 360    | Una columna (diseño actual)                                               |
| 768    | Pantalla de la mira en dos columnas: regla+tabla / lectura+herramientas+curva |
| 1440   | Contenedor maximo 1200 px; listas de equipo en grilla; base para MAKER (F2) |

## 8. Gaps de diseño a cubrir

| Pantalla / estado                      | Tarea   |
| -------------------------------------- | ------- |
| Tema light completo                    | F0-09 / F1-18 |
| Listados de arcos, miras, flechas      | F1-02/03/04 |
| Hoja de nueva/editar marca             | F1-09   |
| Mark Doctor                            | F1-11   |
| Listado imprimible                     | F1-14   |
| Configuracion / Apariencia / Perfil    | F1-01 / F1-16 |
| Forgot / reset password, verify email  | F0-15   |
| Onboarding                             | F1-17   |
| Papelera                               | F1-05   |
| Layout 768 / 1440                      | F1-20   |
