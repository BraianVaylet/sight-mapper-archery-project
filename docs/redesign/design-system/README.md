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
- Logo: el icono de la app (`assets/Logos/sight-mapper-icon-512.png` y `sight-mapper-icon.svg`, ~~escala con marca amarilla sobre navy~~ [~] escala blanca con media mira amarilla (un semicirculo abierto hacia la escala y un punto sobre ella a mitad de altura) sobre navy; F1-41, 2026-11-18). Es un tile navy propio: se usa igual en ambos temas, sin recolorear.

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
