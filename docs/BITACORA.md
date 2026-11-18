# Bitacora — Sight Mapper

> Registro cronologico de lo que se hizo, se decidio y quedo pendiente. La entrada mas nueva va
> arriba. Toda tarea cerrada deja su entrada (DoD). Comando: `/bitacora` (F0-03).

## Formato de entrada

```
## YYYY-MM-DD — <titulo en imperativo: que cambio para el producto>

**Tareas:** F0-xx, F1-yy · **Commit/PR:** <hash o link> · **Tarjeta:** <link>

### Que se hizo
### Decisiones (con link a ADR si corresponde)
### Verificado (como se probo, no solo "tests verdes")
### Pendiente / deuda
```

---

## 2026-11-18 — La verificacion por email se puede apagar para probar en Railway

**Tareas:** F0-20 (preparacion) · **Commit/PR:** `fix/optional-email-verification` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- Variable `AUTH_REQUIRE_EMAIL_VERIFICATION` (default `true`). En `false`: Better Auth no pide
  verificacion ni manda el email al registrarse, y `parseEnv` deja arrancar fuera de local sin
  `RESEND_API_KEY`/`EMAIL_FROM` (reset por log).
- La PWA: si el registro devuelve sesion (`token`), entra directo a Home en vez de "revisa tu email".

### Decisiones

- Interruptor temporal, no cambio de ADR-007: el default sigue exigiendo verificacion.

### Verificado

- `env.test.ts` (default, `false` en staging sin Resend, valor invalido) y un test de integracion
  en `auth.test.ts`: con el interruptor apagado el registro devuelve token y cookie, `get-session`
  trae al arquero y no sale ningun email. API 419/419; PWA typecheck/lint/test verdes.

### Pendiente / deuda

- Volver a `true` (o borrar la variable) cuando haya dominio y Resend (F0-20).

---

## 2026-11-18 — El logo pasa a ser la regla con media mira

**Tareas:** F1-41 (cierra F1-34..F1-41) · **Commit/PR:** PR #4 (`feat/units-ranges-doctor`) · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `apps/pwa/scripts/make-icons.mjs` dibuja el icono nuevo segun el mockup del autor: tile navy
  `#10286b` y regla blanca de siempre; en lugar del pin amarillo, media mira `#ffcc00` (semicirculo
  abierto hacia la regla, con las puntas contra sus extremos, y un punto sobre la regla a mitad de
  altura). Regenera `pwa-192`, `pwa-512` (tambien maskable), `apple-touch-icon` y `favicon-32`, y
  ahora tambien `sight-mapper-icon-512.png` y `sight-mapper-icon.svg` del design system.
- Descripcion del logo actualizada en `Logos/README.md`, `DESIGN-SYSTEM.md` y
  `design-system/README.md`. Capturas de `docs/screens/` regeneradas (dark y light), con la pantalla
  Doctor nueva (`19-doctor-tolerance`); el menu pasa a `20-menu`.

### Verificado (como se probo, no solo "tests verdes")

- El dibujo llega a 0,763 del medio lado, medido sobre los pixeles del PNG: dentro de la zona segura
  maskable (0,8). Revisado a 512 px y a 32 px (favicon y cabecera): la media mira se reconoce.
- E2E de instalacion (manifest, iconos, service worker) 8/8; contraste con capturas 4/4.

### Pendiente / deuda

- El mockup del autor sigue solo en el chat; la referencia del repo es el SVG generado.
- Prueba al sol del icono en un telefono real (manual, con la de F1-33).

## 2026-11-18 — El Doctor explica su umbral y el arquero ajusta la tolerancia

**Tareas:** F1-40 · **Commit/PR:** PR #3 (`feat/post-redesign-adjustments`) · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `@sight-mapper/domain`: `DoctorOptions.toleranceMm` (opcional; sin el, `DOCTOR_MIN_ABS_MM`) y
  constantes `DOCTOR_TOLERANCE_MIN_MM/MAX_MM/STEP_MM` (1, 10, 0.5). Fuera de rango o de paso es
  `DomainError`. Umbral: `max(base, quantum)`, ×2.5 en los extremos (sin cambio de regla).
- Schemas y API (`account`): `profiles.doctorToleranceMm` (`null` = default), en el `PATCH` de
  preferencias, el perfil y el export; un perfil viejo sin el campo se lee como `null`.
- PWA: pantalla `/doctor` (entrada "Doctor" en el grupo 01 del menu) con la explicacion del
  calculo, un ejemplo con la tolerancia actual, el selector de 1 a 10 mm, las pulgadas si la seccion
  mira es imperial, aviso a 1 mm y "Volver al valor por defecto". Elegir 4 mm guarda `null`, asi
  una recalibracion llega al arquero. El diagnostico de cada setup usa la tolerancia del perfil.
- SIGHT-MATH §8.3 precisado (ver Verificado).

### Decisiones (con link a ADR si corresponde)

- [ADR-013](adr/013-doctor-tolerance-per-archer.md). El dominio valida el rango, no solo Zod: un
  valor extremo daba umbrales infinitos o la sospechosa equivocada.

### Verificado (como se probo, no solo "tests verdes")

- `domain-reviewer`: residuos recalculados a mano con minimos cuadrados exactos (Hunter 2.5, -0.864,
  -0.167, 1.045, -2.75; Pierce 0, -0.318, 1.167, -0.955, 1.75). Sus 7 hallazgos aplicados: rango en
  el dominio, `-0`/`-Infinity` en los invalidos, propiedades sobre sets arbitrarios (default = 4 mm,
  piso del quantum, "mas tolerancia nunca señala mas y lo ok sigue ok"), test de que el default es
  elegible, y la correccion de §8.3: entre 1.10 y 1.16 mm los dos sets se separarian, pero con pasos
  de 0.5 mm no se puede elegir; a 1 mm el bueno se señala por su 60 m (2.75 / 2.5).
- Dominio 258/258 (cobertura 99,75 %), schemas 135/135, API 417/417, PWA 422/422; lint y typecheck.
- E2E axe, contraste y desbordes con `/doctor` en el recorrido, flujo critico y mira, a 360 y 1440:
  pasan (un locator de `sight.spec` se ajusto: el riel ahora tambien tiene "Doctor"). Capturas de
  `/doctor` a 360 (claro) y 1440 (oscuro).

## 2026-11-17 — Los rangos de arco y flechas se ven en tu unidad y con su motivo

**Tareas:** F1-39 · **Commit/PR:** PR #3 (`feat/post-redesign-adjustments`) · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `@sight-mapper/schemas`: `BOW_RANGES` y `ARROW_RANGES` como datos (los campos se arman de ahi);
  minimos ensanchados: IBO 60 → 45 m/s, apertura 450 → 300 mm, libraje 45 → 20 N, largo de flecha
  400 → 300 mm; y maximo de spine 2000 → 2600 (aparecio al buscar fuentes: aluminio juvenil Easton
  1214 = 2501).
- PWA: `showRange` (redondeo hacia adentro; in, lb y kg con 1 decimal, el resto entero). Cada campo
  numerico muestra "Entre 148–442 fps" como ayuda, y un valor fuera de rango dice "Fuera de rango: va
  de 4,5–101,1 lb." en la unidad de su seccion. Antes el error decia el limite canonico de Zod
  ("como minimo 45", en newtons): esa era la confusion que reporto el autor.
- DICCIONARIO §3: equivalentes rehechos y seccion de fuentes [F1]..[F3] (Diamond Atomic, tabla de
  Easton, Mathews LIFT XD).

### Verificado (como se probo, no solo "tests verdes")

- Schemas 133/133 (bordes nuevos y test "solo se ensancha": los minimos viejos siguen validos).
- `units.test.ts`: rangos calculados a mano en metrico e imperial, y una propiedad: los dos extremos
  mostrados, leidos de vuelta, caen dentro del rango canonico en los dos sistemas.
- PWA 410/410 (ayuda y error en libras, arco juvenil de 15 lb y 16 in aceptado); API de equipo
  50/50; lint y typecheck.
- E2E a11y, contraste, imperial, ingles, setups y teclado a 360 y 1440: 16 pasan, 2 skip por diseño.

### Pendiente / deuda

- Los motivos sin fuente unica (brace, eje a eje, radio, peep, D-loop, pesos) quedan como rangos de
  uso corriente con margen anti-tipeo.

## 2026-11-17 — La version de la app sale del package.json

**Tareas:** F1-38 · **Commit/PR:** PR #3 (`feat/post-redesign-adjustments`) · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `apps/pwa/build/app-version.ts`: `appVersion` (pura) arma la version del `package.json` raiz,
  sola en produccion y con `+<sha corto>` en el resto; `buildAppVersion` toma el sha de
  `RAILWAY_GIT_COMMIT_SHA`, `GITHUB_SHA` o `git`, y produccion de `RAILWAY_ENVIRONMENT_NAME`.
- `vite.config.ts` la inyecta en `__APP_VERSION__`; se quita `VITE_APP_VERSION` (env, Dockerfile,
  `.env.example`). El Dockerfile declara los dos `ARG` de Railway (la imagen se arma sin `.git`).
- `package.json` raiz a `0.1.0`. Runbook de release: paso "Version subida".

### Verificado (como se probo, no solo "tests verdes")

- Tests de `build/` 6/6 (produccion, sha, sin sha, sha invalido, prioridad de las fuentes, git
  local); Ajustes 10/10; lint y typecheck de la PWA.
- Build real: `0.1.0+30c9df9` en local y `0.1.0` con `RAILWAY_ENVIRONMENT_NAME=production`, leido
  del bundle de Ajustes.

### Pendiente / deuda

- Confirmar en Railway (F0-20) que pasa `RAILWAY_GIT_COMMIT_SHA` y `RAILWAY_ENVIRONMENT_NAME` como
  build args.

## 2026-11-17 — Cada seccion tiene su propio sistema de unidades

**Tareas:** F1-37 · **Commit/PR:** PR #3 (`feat/post-redesign-adjustments`) · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `@sight-mapper/schemas`: `units` (`marks`, `bow`, `arrows`, `sight`), `DEFAULT_UNITS`
  (metrico, imperial, imperial, metrico) y `PATCH /me/preferences` con `units` parcial (una seccion
  por vez; `{}` y el viejo `unitSystem` se rechazan con `SM-CORE-400-001`). Export a
  `schemaVersion: 2`.
- API (`account`): el perfil guarda `units`; un patch escribe solo `units.<seccion>`. Las unidades
  ya no dependen del idioma del navegador. Migracion `20261117000000-profile-units.js`
  (`unitSystem` → `units.marks`, el resto por defecto; idempotente, con `down`).
- PWA: Ajustes muestra un selector por seccion con su descripcion; `useUnits()` reemplaza a
  `useUnitSystem()`. Distancias y errores con distancia usan `marks`; el form del arco `bow`; el de
  flechas `arrows`; una mira nueva arranca en `mm` o `in` segun `sight` (antes en `cm`) y espera al
  perfil. El script de importacion acepta las dos formas.

### Decisiones (con link a ADR si corresponde)

- [ADR-013](adr/013-doctor-tolerance-per-archer.md). El cambio optimista del perfil fusiona solo la
  seccion tocada (`withPatch`).

### Verificado (como se probo, no solo "tests verdes")

- API 414/414 (perfil con `units`, patch de una seccion, rechazo de la forma vieja, export v2,
  migracion contra mongod real: imperial, metrico, sin valor y ya migrado, dos corridas, `down`).
- PWA 397/397 (Ajustes con cuatro secciones y defaults, patch de una sola seccion, mira nueva en
  `in` con la seccion imperial, una mira guardada conserva su unidad).
- E2E completo a 360 y 1440: 42 pasan y 7 fallaban por supuestos viejos (ingles = yardas, mira
  nueva en `cm`, export v1); corregidos, los 4 specs afectados pasan (10/10). Lint y typecheck.

### Pendiente / deuda

- La migracion corre en el job de release (TECNICO §6); en produccion se verifica con F0-20.

## 2026-11-17 — El menu pasa a la derecha

**Tareas:** F1-36 · **Commit/PR:** PR #3 (`feat/post-redesign-adjustments`) · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `NavDrawer` entra desde la derecha (`right-0`, borde izquierdo); el `BottomSheet` no cambia.
- `AppFrame` desde 1440 px: grilla `minmax(0,1fr) 320px` con el contenido **primero en el DOM** y el
  riel despues, asi el orden de lectura y de foco coincide con el visual sin `order` de CSS.

### Verificado (como se probo, no solo "tests verdes")

- Unit `ui` 26/26 (test nuevo del lado del cajon), lint y typecheck de ui y pwa.
- E2E `a11y` (axe y desbordes a 360, 768 y 1440), `keyboard` (flujo entero solo con teclado),
  `onboarding` y `setups`: 16 pasan, 2 skip por diseño.
- Capturas del menu a 360 (cajon), 768 (cajon) y 1440 (riel), oscuro y claro, con un spec temporal
  borrado antes del commit: riel a la derecha, cajon desde la derecha, nada tapado.

## 2026-11-17 — El logo de la cabecera vuelve al Home

**Tareas:** F1-35 · **Commit/PR:** PR #3 (`feat/post-redesign-adjustments`) · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `AppHeader` (`@sight-mapper/ui`) acepta `brandLink`: un render prop que envuelve logo, titulo y
  subtitulo en el link de la app, con las clases de un objetivo de 48 px; `ui` sigue sin depender
  del router.
- `AppFrame` lo usa con el `Link` de TanStack a `/`, nombre accesible "Sight Mapper: ir al inicio" /
  "Sight Mapper: go to home" (`menu.homeLink`; contiene el texto visible, WCAG 2.5.3) y cierra el
  cajon. `GuestFrame` no cambia: sin sesion el logo no es link (RF-X-08).
- CI del PR: `pnpm audit --prod` fallaba por GHSA-fc5q-39xc-vjpf (picomatch ≤ 4.0.7, sin version
  corregida publicada). Llega a prod solo por `vitest`, peer opcional de `better-auth`; se ignora en
  `auditConfig.ignoreGhsas` con el motivo y la condicion para sacarlo (decidido por el autor).

### Verificado (como se probo, no solo "tests verdes")

- Unit `ui` (25/25, test nuevo del link: href, 48 px, logo y textos adentro), i18n 27/27, lint y
  typecheck de ui, i18n y pwa.
- E2E `setups` (ahora vuelve de la mira al Home tocando el logo), `a11y` y `keyboard` a 360 y
  1440 px: 8 pasan, 2 skip por diseño. Una primera corrida fallo entera porque habia un
  `dev:local` viejo ocupando 5173 sin el archivo de mails; se freno con el OK del autor.

### Pendiente / deuda

- Sacar el ignore de picomatch cuando salga 4.0.8.

## 2026-11-17 — La spec define los ajustes post-rediseño antes de codearlos

**Tareas:** F1-34 · **Commit/PR:** rama `feat/redesign-blueprint` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- Spec: RF-X-03 (version del `package.json` raiz, `+sha` fuera de produccion), RF-X-08 (logo →
  Home), RF-ACC-04 (unidades por seccion: marcas, arco, flechas, mira), RF-MRK-01, RF-CAL-09 y
  RN-CAL-06 (tolerancia del Doctor 1–10 mm, default 4), RN-EQP-03 (rangos con motivo, solo se
  ensanchan, hint redondeado hacia adentro), §14 (menu a la derecha, logo nuevo), §17.2 y §17.3.
- FUNCIONAL (ruta `/doctor`, HU-ACC-04 reescrita, HU-CAL-06, HU-NAV-01, rangos en HU-BOW-01 y
  HU-ARW-01), UX-UI (§3, §4.4, §4.5, §4.7, §7), TECNICO (preferencias, version, migracion de
  perfiles con `migrate-mongo`), DOMINIO, DICCIONARIO (rangos con motivo y equivalente imperial,
  `units.*`, `doctorToleranceMm`), SIGHT-MATH, UNIDADES, errors.md (sin codigos nuevos; mapeo de
  params por seccion), runbook de release, README de `AppHeader`, `apps/pwa/CLAUDE.md`.
- ADR-013: tolerancia del Doctor por arquero y unidades por seccion; reemplaza ADR-001 punto 5 (que
  seguia hablando de MAD) y la consecuencia de ADR-005 sobre el sistema unico.

### Decisiones (con link a ADR si corresponde)

- [ADR-013](adr/013-doctor-tolerance-per-archer.md). Minimos ensanchados: IBO 60 → 45 m/s, apertura
  450 → 300 mm, libraje 45 → 20 N, largo de flecha 400 → 300 mm (juveniles). El logo esta en todas
  las pantallas con sesion: la cabecera nunca tuvo "Volver". `units.marks` cubre solo distancias;
  `units.sight` preselecciona la escala de una mira nueva y muestra la tolerancia del Doctor. El
  export sigue canonico y pasa a `schemaVersion: 2`.

### Verificado (como se probo, no solo "tests verdes")

- `spec-reviewer`: 31 hallazgos (contradicciones, 5 conversiones redondeadas hacia afuera, marcas
  `[~]` faltantes, huecos de F1-37..F1-40), todos corregidos. Conversiones rehechas a mano. Prettier
  y `test:scripts` (75/75) verdes.

### Pendiente / deuda

- F1-39 agrega las fuentes (catalogos de fabricantes) de cada motivo de rango.
- El mockup del logo vive solo en el chat; F1-41 lo guarda en `assets/Logos/`.

## 2026-11-17 — El rediseño blueprint queda verificado entero y listo para revisar

**Tareas:** F1-33 (cierra F1-23..F1-32) · **Commit/PR:** rama `feat/redesign-blueprint` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- Verificacion completa del monorepo y de la PWA en los dos tamaños de los E2E, capturas de
  referencia regeneradas (`docs/screens/`, 19 por tema; se borro `18-appearance`, ahora
  `18-settings`), Lighthouse CI sobre el build final y PR a `main`.

### Decisiones (con link a ADR si corresponde)

- El PR incluye el commit de infraestructura de F0-20 (`296f2db`, Railway, Docker y Caddy) porque la
  rama salio de `feat/f0-railway-config`, que nunca se pusheo ni se mergeo.

### Verificado (como se probo, no solo "tests verdes")

- `pnpm lint`, `pnpm typecheck` y `pnpm test` del monorepo en verde: domain 247, types 29,
  schemas 130, client 78, i18n 27, ui 172, api 410, pwa 393 (1486 tests).
- Cobertura: `ui` 97,97 % sentencias / 98,49 % lineas; `pwa` 92,99 % / 93,82 %.
- E2E completo (`pnpm --filter @sight-mapper/pwa exec playwright test`, 360 y 1440): 49 pasan, 3
  saltados por diseño de proyecto, 0 fallas, en la primera corrida.
- Lighthouse CI (`/sign-in`, 3 corridas): JS inicial 178 136 B (~174 KB, gate 180 KB: pasa, pero
  subio de ~171 KB y quedan ~6 KB de margen); accesibilidad 1,0; buenas practicas 1,0;
  rendimiento 0,94; LCP 3,05 s (aviso aceptado por el autor el 2026-11-17).
- Capturas de `docs/screens/` revisadas contra `docs/redesign/screenshots/`.

### Pendiente / deuda

- **Lo hace el autor:** prueba al sol con un telefono real en los dos temas y pasada con un
  lector de pantalla real (TalkBack / VoiceOver / NVDA).
- ~~CI del PR en GitHub~~: la primera corrida fallo en `pnpm test:scripts` (el test de `/adr`
  tenia fijo el 012 como proximo ADR, y el 012 ya existe); se corrigio para que lea el numero del
  repo (2712a11). Segunda corrida: los 4 jobs en verde (lint/tests/build, E2E 360 y 1440,
  Lighthouse, dependencias).
- Margen del gate de JS (~6 KB): lo proximo que sume JS al arranque tiene que medirse.
- A 1440 la barra fija de la mira no se alinea con la columna del contenido junto al riel.
- El paso a Distancias en frio a 360 fallo por tiempo en corridas anteriores (en esta paso).

## 2026-11-17 — Todas las pantallas hablan el mismo idioma visual

**Tareas:** F1-32 · **Commit/PR:** rama `feat/redesign-blueprint` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **Titulos:** un solo tamaño de `h1` (display 30 px, negrita) en las 14 pantallas que quedaban,
  incluida "no encontrada". La cabecera ya no queda pegada al titulo a 360.
- **Secciones numeradas** (`01`, `02`, `03`) en los formularios de arco, mira, flechas y setup, en
  Cuenta, Intermedias, Mark Doctor y el listado imprimible. Las listas de equipo y la papelera no
  se numeran: cada tarjeta es un item, no un paso.
- **Bordes de 2 px** en el panel de distancia elegida, el del Doctor, "Mas datos" de flechas y la
  seleccion de sets del setup; divisores de tabla en `line`.
- **Ingreso, registro, recupero, reset y verificacion:** logo y titulo sobre la cuadricula, el
  formulario en una tarjeta opaca (UX-UI §4.6: ningun dato sobre la cuadricula).
- **Intermedias:** el panel de lectura y la tabla en mono, la fila elegida en `raised`; en la
  curva, numeros en mono y el rombo calculado igual que en la regla.
- **Volver** con icono y 48 px en Intermedias, Doctor e Imprimir, como en la mira.
- "No encontrada" en tarjeta opaca.

### Decisiones (con link a ADR si corresponde)

- El listado imprimible no cambia de estilo en papel: sigue en blanco y negro (UX-UI §6).

### Verificado (como se probo, no solo "tests verdes")

- PWA 393/393, lint y typecheck limpios, sin cambios en tests.
- Capturas reales de las 19 pantallas del recorrido a 360 (spec temporal con `tourEveryScreen`),
  revisadas: Nueva mira, Intermedias y Crear cuenta, entre otras.
- E2E en 360 y 1440 (`auth`, `english`, `profile`, `print`, `setups`, `a11y`, `contrast`,
  `critical-flow`, `catalog`): 29/29 en verde a la primera (3 saltados por diseño de proyecto).
  Esta vez el flujo en ingles a 360 paso.

### Pendiente / deuda

- La marca de registro de abajo a la derecha se dibuja por encima del borde de la tarjeta del
  formulario cuando este llega al fondo de la pantalla (registro): decorativa, no tapa datos.


## 2026-11-17 — La Home muestra cada setup como una ficha tecnica y deja una sola accion a mano

**Tareas:** F1-31 · **Commit/PR:** rama `feat/redesign-blueprint` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **SetupCard** (`@sight-mapper/ui`, D-3): nombre en display, estrella de favorito (se mantiene,
  `aria-pressed`), bloque tecnico hundido con Arco, Mira (en `mark`) y Flechas rotulados, chapa
  "Acceso rapido" con pin en el setup que abre la app, marcas y ultima edicion en mono, "Abrir"
  (secundario con chevron) y "Editar". Todas las tarjetas iguales.
- **Home:** "Setups guardados: N" como rotulo arriba del titulo (D-4: se va el pie), titulo grande
  sobre la cuadricula, "+ Nuevo setup" fijo abajo a 56 px como unica accion principal.
- **Guia de primer uso:** pasos numerados 01–04 en mono, el actual con fondo `raised` y barra de
  acento; sus links pasan a secundarios para que la vista tenga una sola accion principal.
- `LinkButtonClass` con borde de 2 px y canto `shadow-key` (lo usan 16 links de la PWA); nuevos
  `LinkButtonLargeClass` y `LinkButtonSecondaryClass`.
- i18n: `quickAccess.badge`, `setups.home.countLabel`.

### Decisiones (con link a ADR si corresponde)

- La tarjeta no es un link entero, como en el DS: adentro hay un boton (la estrella) y otro link
  (Editar), y un elemento interactivo no puede ir dentro de otro. "Abrir" es el link al setup.
- El numero de setups va como rotulo sobre el titulo y no en el subtitulo de la cabecera: la
  cabecera es la misma en todas las pantallas.

### Verificado (como se probo, no solo "tests verdes")

- `ui` 172/172 (nuevo `setup-card.test.tsx`: region nombrada, rotulos, mira en `mark`, nota de
  archivado, estrella y 48 px, chapa solo en el setup de acceso rapido); PWA 393/393 (nuevo: la
  Home marca con "Acceso rapido" solo el setup que abre la app). Lint y typecheck limpios. Los
  tests de Home existentes pasan sin cambios.
- Capturas reales: Home vacia (guia) a 360 y Home con un setup favorito y de acceso rapido a 360
  (claro) y 1440 (oscuro).
- E2E en 360 y 1440 (`setups`, `quick-access`, `onboarding`, `critical-flow`, `a11y`, `contrast`):
  20/20 en verde en la primera corrida (2 saltados por diseño de proyecto), incluidos los dos
  flujos criticos (ES/metrico y EN/imperial).

### Pendiente / deuda

- Como en el resto, el titulo de la pantalla queda pegado a la cabecera a 360: F1-32.


## 2026-11-17 — La pantalla de la mira se lee como un instrumento y se maneja con el pulgar

**Tareas:** F1-30 · **Commit/PR:** rama `feat/redesign-blueprint` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **Orden de uso** (UX-UI §4.2): volver, nombre y resumen → set de flechas → **ReadingHud**
  (distancia y lectura en mono grande, medido en `mark` con brillo de fosforo solo en oscuro,
  estimado en `info` con `≈`, esquinas HUD) → marcas y regla → **ActionBar** fija abajo.
- **ActionBar** (D-1): Intermedias, Doctor (`X/5` hasta tener 5), Imprimir (desde 1) y una sola
  celda "Viento · Clima / Pronto", deshabilitada y anunciada (RF-X-07); "+ Agregar marca" de 56 px
  a lo ancho; tira de estado (setup · mira, lectura viva) oculta al lector porque repite el HUD.
  Se oculta con una hoja abierta y no se imprime. El toast con "Deshacer" se muestra arriba de la
  barra (`notice`), nunca tapando la accion principal.
- **Tabla de marcas:** filas de 60 px, distancia en mono, lectura en `mark`, fila elegida con fondo
  `raised` y barra `accent`; "Editar" pasa a un boton de icono con el mismo nombre accesible ("Editar
  la marca de 30 m") para que las cuatro columnas entren en 360 px.
- **Regla:** pozo `sunken`, ticks mayores en tinta, numeros en mono, la marca elegida con linea y
  anillo `accent`. La geometria sigue saliendo de `@sight-mapper/domain/ruler`.
- **768+:** HUD (con el set de flechas y "Abrir siempre aca") a la izquierda, fijo al hacer scroll;
  marcas y regla a la derecha.
- `@sight-mapper/ui` (D-3): `ReadingHud`, `ActionBar`, `ActionToolUnavailable`,
  `ACTION_TOOL_CLASS`, icono `edit`, `Toast` con `inline` y la regla `.sm-glow` en `tokens.css`.
  i18n: `sight.soonShort`, `sight.rulerTitle`.

### Decisiones (con link a ADR si corresponde)

- La tabla va antes que la regla: en 360 es la lista que se toca y la que lee el lector de
  pantalla; la regla la acompaña debajo (en 768+ ambas a la derecha del HUD).
- Las herramientas quedan en la barra fija tambien en 768+, en lugar de "sobre la regla" como
  decia el plan: la accion principal y las herramientas estan siempre en el mismo lugar.
- `ReadingHud` y `ActionBar` subieron a `ui` como piezas de presentacion (D-3); la regla se quedo
  en la PWA porque toda su logica es geometria del dominio.

### Verificado (como se probo, no solo "tests verdes")

- `ui` 169/169 (nuevos: `ReadingHud` medido/estimado/vacio, `ActionBar`), PWA 392/392. En
  `imperial.test.tsx` la busqueda de la unidad "yd" se acoto a la hoja: ahora el HUD tambien la
  muestra. Lint y typecheck limpios.
- Capturas reales con 5 marcas (spec temporal): a 360 en claro y oscuro se ven, sin scroll, el HUD
  y "+ Agregar marca"; el toast queda arriba de la barra; a 1440 HUD a la izquierda, marcas y regla
  a la derecha, riel del menu. La primera tanda mostro tres problemas que se corrigieron: el toast
  tapaba la barra, "Intermedias" se cortaba y la tabla no entraba en 360.
- E2E en 360 y 1440 (`sight`, `critical-flow`, `keyboard`, `quick-access`, `imperial`, `print`,
  `a11y`, `contrast`): la primera corrida dio 44 verdes y 5 fallos, con **dos bugs reales**:
  - Teclado (los dos tamaños): al cerrar la hoja con Escape el foco no volvia a "+ Agregar marca",
    porque la barra se desmontaba con la hoja abierta.
  - Imperial: con la hoja abierta, el toast de respaldo (fijo, por encima) tapaba "Guardar".
  Arreglo: la barra queda montada y se oculta con `hidden`; el toast vive siempre en ella. Los
  otros dos fallos (contraste en claro y fuente ancha) fueron por tiempo. Re-corrida de `keyboard`,
  `imperial`, `contrast` y `a11y` con un worker: 12/12 en verde.

### Pendiente / deuda

- A 1440 la barra fija se centra en el ancho de contenido y no se alinea con la columna a la
  derecha del riel del menu. Se ve bien, pero revisarlo en F1-33.
- Prueba al sol del HUD y del brillo de fosforo con un telefono real (autor).


## 2026-11-17 — La configuracion vive solo en Ajustes y el menu se ordena por tareas

**Tareas:** F1-29 · **Commit/PR:** rama `feat/redesign-blueprint` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **Ajustes** (`/settings`, RF-ACC-04): 01 Pantalla (tema), 02 Idioma y unidades, 03 Acerca de
  (version). Cada ajuste con nombre, descripcion de lo que cambia y `Segmented`; reutiliza
  `usePreferenceActions` sin cambios de logica. `/settings/appearance` redirige a `/settings`.
- **Sin pie global:** se borraron `AppFooter` y `PreferencesBar`; la version sale de Cuenta y queda
  en Ajustes.
- **Invitado:** `GuestFrame` suma el `LanguageSwitch` (ES/EN, `aria-pressed`, `lang` por opcion)
  arriba a la derecha en ingresar, registro, recupero, reset y verificacion. Sin selector de tema.
- **Menu:** grupos "01 — Tiro" (Inicio, Arcos, Miras, Flechas, Estadisticas) y "02 — Cuenta"
  (Ajustes, Cuenta, Papelera) con iconos; cerrar sesion y hora de sincronizacion al pie. La
  cabecera muestra el icono real de la app.
- **1440 px:** el menu pasa a riel lateral fijo de 320 px (`useMediaQuery`), sin boton de menu. El
  arbol es el mismo en los dos layouts, asi una pantalla no pierde su estado al cruzar el ancho.
- `@sight-mapper/ui`: `Icon` (20 iconos de linea del DS), `LanguageSwitch` y `hint` en `Segmented`
  (`aria-describedby`).
- i18n ES y EN: `settings.*` reemplaza a `appearance.*`; `menu.settings`, `menu.groupShooting`,
  `menu.groupAccount`; se borraron `menu.appearance`, `screens.appearance`, `app.version` y
  `profile.version`.

### Decisiones (con link a ADR si corresponde)

- El riel se dibuja solo cuando `matchMedia('(min-width: 1440px)')` coincide, en vez de ocultarlo
  con CSS: riel y drawer nunca conviven (un solo juego de botones del menu para el lector de
  pantalla) y los tests en jsdom, sin media queries, siguen viendo el drawer.
- El grupo del menu se llama "Cuenta" como en el DS, aunque el item del perfil tambien se llama
  "Cuenta" (es el titulo que ya usa la pantalla y buscan los tests).

### Verificado (como se probo, no solo "tests verdes")

- `ui` 164/164 (nuevos: `LanguageSwitch`, cada icono, `hint`), `i18n` 27/27 (ES y EN con las
  mismas claves), PWA 392/392. Lint y typecheck limpios.
- Tests cambiados porque cambio el comportamiento por spec (no para esquivarlos): los del pie de
  `routing.test.tsx` pasan a exigir que no haya pie, que sin sesion se pueda cambiar el idioma y
  que no haya selector de tema; `profile.test.tsx` exige que la version ya no este; `settings.test`
  (antes `appearance.test`) suma grupos, descripcion, version, unicidad y el redirect;
  `menu.test.tsx` suma los grupos.
- Capturas reales con Playwright (spec temporal, no commiteado): Ajustes a 360 en oscuro y claro,
  menu como riel a 1440, ingreso con el selector ES/EN y las marcas de registro.
- E2E en 360 y 1440 (`imperial`, `english`, `a11y`, `contrast`). Primera corrida: 7 pasan y
  5 fallan. axe encontro un problema real: el boton del selector mostraba "ES" pero se llamaba
  "Español" (`label-content-name-mismatch`, WCAG 2.5.3). Ahora se llama "ES Español" / "EN English".
  Una segunda corrida no dio resultado: el servidor no levanto y Windows aborto los workers
  (0xC0000142). En la tercera, con un worker: `a11y` (axe y desbordes a 360, 768, 1440 y con fuente
  ancha) y `english` a 1440 pasan, incluido cerrar sesion desde el riel. `contrast` e `imperial`
  pasaron en la primera.
- **No verificado:** `english` a 360. Fallo 3 veces en el mismo paso: tras "Intermediates", la
  pantalla de Distancias seguia en el splash a los 5 s (snapshot). Solo falla en el primer proyecto,
  con el servidor de desarrollo en frio compilando la ruta perezosa; F1-29 no toca esa pantalla.

### Pendiente / deuda

- El paso a Distancias en frio (`english.spec.ts` y `critical-flow.spec.ts` a 360): esperar la
  carga de la ruta perezosa o precalentar el servidor; revisarlo antes de F1-33.

- A 360 px el titulo de cada pantalla queda pegado a la cabecera (sin separacion): F1-32.

## 2026-11-17 — Las primitivas de la interfaz tienen la forma del instrumento

**Tareas:** F1-28 · **Commit/PR:** rama `feat/redesign-blueprint` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `Button`: borde de 2 px, canto `shadow-key` que la presion hunde (`translate-y-0.5`), variantes
  nuevas `ghost` y `danger`, `size="lg"` (56 px) y `block`.
- `Field` / `NumberField` / `PasswordField` / `Select`: borde de 2 px; `NumberField` en mono
  tabular; error con cruz ademas del color; `Select` con flecha propia; sufijo de unidad en mono.
- `Segmented`: pista hundida con borde y un cuadrado indicador en la opcion elegida (forma, no solo
  color).
- `StatusBadge`: mono MAYUSCULAS, `calculated` con borde punteado. `InfoAlert`: borde de 2 px y
  `title` opcional. `Toast`: `shadow-panel` y barra de tiempo `accent` de 3 px que se vacia
  (decorativa). `UpdatePrompt`: `shadow-panel`. `EmptyState` / `ErrorState`: glifo de escala y
  marco (punteado / `danger`). `Skeleton`: barrido de escaner (`sm-scan`), anulado por
  `prefers-reduced-motion`.
- `SectionCard`: prop `index` ("01") en `mark` mono, titulo en mono, regla punteada `line`.
  `AppHeader`: `bg-raised`, borde de 2 px, titulo en display. `NavDrawer` / `BottomSheet`:
  `shadow-panel`, bordes de 2 px; la hoja con `rounded-t-lg`, asa y `safe-area`. `NavGroup` nuevo
  (`01 — TIRO`); `NavItem` con `icon` y barra izquierda `accent` de 4 px en el actual.
- El foco de cada primitiva queda en el `:focus-visible` global (3 px `focus`), sin anillos propios.
- `/sandbox` muestra las variantes nuevas (claves i18n ES y EN).

### Decisiones (con link a ADR si corresponde)

- El logo real en `AppHeader`, los iconos de linea y los grupos del menu de la app se conectan en
  F1-29 (menu y Ajustes), F1-30/31 y F1-32: aca quedan las primitivas listas (`logo`, `icon`,
  `NavGroup`).

### Verificado (como se probo, no solo "tests verdes")

- `ui`: 140/140 (8 nuevos: variantes y tamaños de `Button`, barra del toast, titulo de
  `InfoAlert`, `NavGroup`, indice de `SectionCard`). Lint y typecheck limpios; `i18n` 27/27.
- `/sandbox` a 420 px en oscuro y claro, comparado con `docs/redesign/screenshots/`: botones,
  campos, segmentado, chapas, avisos, estados, toast, menu (grupo, item actual, chapa) y hoja.
- PWA: 385/385 unit tests.
- E2E a 360 (26 specs): 21 pasaron y 3 fallaron en la primera corrida. Al investigarlos:
  - `a11y` con fuente ancha (Verdana forzada): la mira, el Doctor y la hoja de marca se pasaban
    12–16 px. Un probe temporal mostro la causa: las tablas de marcas y del Doctor, ensanchadas
    por la chapa en mayusculas y el boton "Editar" con borde de 2 px. Las dos tablas ahora tienen
    su propio scroll horizontal (`overflow-x-auto`); R-07 rehace la de la mira.
  - Flujo critico en ingles: falto un heading por tiempo con la suite en paralelo; corrido con un
    worker, pasa.
  - `setups`: fallaba por el limite total de 30 s, en pasos distintos cada vez. En el commit de
    F1-27 tarda 22,7 s y con F1-28 entre 23,8 y 24,1 s (2 de 2 en verde). Se le dio
    `setTimeout(90_000)`, como ya tienen las otras pruebas de flujo largo.
  - Re-corrida de `a11y` y del flujo critico (ES y EN) con un worker: 4/4 en verde.

### Pendiente / deuda

- `setups.spec.ts` con 90 s de limite: es un flujo de 4 cargas completas. Si en CI sigue
  lento, mirar el arranque del servidor de desarrollo.
- Logo real, iconos y grupos del menu en la app: F1-29.


## 2026-11-17 — Toda la app se dibuja sobre papel de plano

**Tareas:** F1-27 · **Commit/PR:** rama `feat/redesign-blueprint` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `styles.css`: cuadricula blueprint en el `body` (linea menor cada 8 px en `grid`, mayor cada
  40 px en `grid-major`, fija al scroll). `Shell` deja de pintar `bg-bg` opaco para que se vea.
- `GuestFrame` (`app/guest-frame.tsx`): marcas de registro en dos esquinas, decorativas
  (`aria-hidden`, sin eventos de puntero, respetan el `safe-area`), en `_guest`, `/reset-password`
  y `/verify-email`. R-06 le suma el `LanguageSwitch`.
- Impresion: el fondo blanco ya anulaba la imagen; las marcas se ocultan. `print.spec.ts` ahora
  exige `background-image: none` en papel.
- `.claude/launch.json`: configuracion `dev-local` para ver pantallas con API en el panel.

### Decisiones (con link a ADR si corresponde)

- La cuadricula es una regla de base en la PWA y no un componente de `ui`: es el fondo de la pagina,
  no algo que se compone.

### Verificado (como se probo, no solo "tests verdes")

- Navegador a 375 px, `/sign-in` en oscuro y claro: cuadricula visible y tenue, marcas en las
  esquinas, titulo ya en Chakra Petch.
- PWA: lint, typecheck y 385/385 unit tests.
- E2E a 360: `contrast` (oscuro y claro), `a11y` (axe y desbordes a 360 y fuente ancha) y `print`
  en verde (5 pasan; el de 768 se salta en el proyecto de 360 por diseño). `print` vuelto a correr
  con el assert nuevo: 1/1.

### Pendiente / deuda

- El criterio "ningun dato sobre la cuadricula" todavia no se cumple en todas las pantallas: el
  formulario de ingreso, sus links y el pie de preferencias apoyan texto directo sobre el fondo. Lo
  resuelven R-06 (se va el pie) y R-09 (formularios en `SectionCard`); se revisa en R-10.

## 2026-11-17 — La app habla con su propia tipografia, tambien sin señal

**Tareas:** F1-26 · **Commit/PR:** rama `feat/redesign-blueprint` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- 8 woff2 (Chakra Petch 600/700, IBM Plex Sans 400/500/600, IBM Plex Mono 400/500/600; 144 KB) y
  sus licencias OFL en `packages/ui/src/fonts/`; `fonts.css` con un `@font-face` por archivo
  (`swap`, `unicode-range` latin, URL relativa) exportado como `@sight-mapper/ui/fonts.css` e
  importado en la PWA antes de los tokens.
- `theme.css`: `--font-display`, `--font-ui` y `--font-mono` con la fuente propia primero y el
  sistema de respaldo.
- `workbox.globPatterns` suma `woff2`.
- Tests nuevos: `packages/ui/src/fonts.test.ts` (8 caras, archivos que existen, `swap`, licencias,
  ningun host externo, stacks) y en `e2e/installable.spec.ts` el precache de las tres familias.

### Decisiones (con link a ADR si corresponde)

- [ADR-012](adr/012-own-fonts-precached.md). Vite empaqueta las fuentes con hash en `/assets/`
  (cache inmutable de Caddy); la CSP no cambia (`font-src 'self'`).

### Verificado (como se probo, no solo "tests verdes")

- `ui`: 132/132. Lint de `ui` y `pwa` limpio. `scripts/csp.test.mjs`: 3/3.
- Build: los 8 woff2 salen con hash en `dist/assets/` y los 8 estan en el precache de `sw.js`
  (75 entradas, 893 KiB).
- E2E a 360 (`installable` + `contrast`): 6/6, incluido el precache de fuentes y el contraste AA
  de todas las pantallas en oscuro y claro.
- Lighthouse CI (3 corridas, `/sign-in`): JS, accesibilidad y buenas practicas pasan. **LCP:
  3,07–3,10 s** con fuentes contra **2,41–2,49 s** sin ellas (mismo arbol, medido en el commit de
  F1-25). El elemento LCP es un `<p>` en Plex Sans. Se probo `preload` de Plex Sans 400 (2,81–3,10 s)
  y `font-display: optional` (3,07–3,10 s): ninguno mueve el numero, porque la simulacion de
  Lighthouse pone las descargas de fuentes antes del texto. Se dejo `swap` sin `preload`.
- **No verificado:** el render real de las fuentes offline en un telefono (DevTools → Rendered
  fonts) a mano.

### Pendiente / deuda

- ~~**Decision del autor:** el aviso de LCP paso de ~2,5 s a ~3,1 s. Opciones: aceptarlo (es aviso,
  no gate), recortar pesos (por ejemplo sin Plex Sans 500 ni Chakra 600) o medirlo en campo antes
  de decidir.~~ **Decidido (2026-11-17): se acepta** el aviso de ~3,1 s; no se recortan pesos.

## 2026-11-16 — La app ya usa la paleta blueprint y tocables de 48 px

**Tareas:** F1-25 · **Commit/PR:** rama `feat/redesign-blueprint` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `tokens.css`: valores finales de los dos temas (DESIGN-SYSTEM §2.1) en los tres bloques, con los
  nombres de siempre y los nuevos `surface-raised`, `line`, `grid`, `grid-major`, `focus`,
  `shadow-key`, `shadow-panel`, `size-touch-lg` (56), `grid-step` (8) y `grid-step-major` (40).
  En claro el acento pasa a navy `#10286b` con tinta amarilla; lo medido a `#6b4f00`.
- `theme.css`: utilidades `raised`, `line`, `grid`, `grid-major`, `focus`, `shadow-key`,
  `shadow-panel`, `radius-lg` y `font-mono`.
- Tocables 44 → 48 px: `TOUCH_TARGET_PX`, `LinkButtonClass`, las herramientas de la mira y cuatro
  `style` con `44` a mano en la PWA (ahora usan `touchTarget`/`TOUCH_TARGET_PX`).
- Foco con `--sm-focus`; `theme-color` y manifest a `#0b1b45`, mas un `theme-color` claro
  `#eef2f9` por media query. El script inline del tema no se toco (su hash esta en la CSP).

### Decisiones (con link a ADR si corresponde)

- El canto del boton primario se mide contra `bg` (≥3:1) y no contra `accent`: en claro el navy del
  acento y el canto casi negro son parecidos, y lo que tiene que verse es la tecla sobre la pagina.
- Los 9 asserts `'44px'` de los tests de `ui` pasan a `${TOUCH_TARGET_PX}px`: el requisito cambio
  por spec (RF-X-02), no es esquivar un test.

### Verificado (como se probo, no solo "tests verdes")

- `tokens.test.ts` reescrito con los criterios de R-02: texto ≥7 y el resto ≥4,5 sobre `bg`,
  `surface`, `surface-raised` y `surface-sunken`; `accent-ink` sobre `accent` ≥7; `border` y
  `focus` ≥3; cuadricula entre 1,1 y 1,5 sobre `bg`; sombras armadas con los colores del tema;
  bloque `system` identico a `light`. `ui`: 120/120.
- `pnpm lint` y `pnpm typecheck` en verde. `pnpm test` del monorepo: todo verde salvo un test de
  `pwa/test/sight.test.tsx` ("invites the archer to measure the first mark") que fallo una vez con
  toda la suite en paralelo y paso 3 de 3 corriendo solo (tambien sin estos cambios): flaky por
  tiempo, no por los tokens.
- `scripts/csp.test.mjs` en verde.
- `/sandbox` en el navegador, dark y light: el acento claro es navy con texto amarillo, lo medido
  dorado oscuro, lo calculado cian. La consola solo muestra 502 de `/api` (solo corria `vite`, sin
  API), de la carga inicial de `/` y no de los estilos.
- **No corrido:** E2E de contraste y axe (quedan para F1-33, o antes si algun paso los rompe).

### Pendiente / deuda

- El flaky de `sight.test.tsx` bajo carga: mirar si necesita un `findBy` con mas tiempo.
- F1-26 (fuentes) y F1-27 (fondo).

## 2026-11-16 — La spec ya describe el rediseño blueprint: configuracion solo en Ajustes y fuentes propias

**Tareas:** F1-23, F1-24 · **Commit/PR:** rama `feat/redesign-blueprint` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- F1-23: traspaso del rediseño commiteado (`docs/redesign/`), comando `/redesign`, decisiones
  D-1..D-8 aceptadas por el autor (todas las recomendaciones) y tareas F1-23..F1-33 en el plan
  (F1 pasa a 33 tareas / 119 puntos; F1-22 depende ahora del rediseño). El plan se contrasto con el
  repo y se corrigio: ruta del `Caddyfile`, 9 asserts de `44px` en los tests de `ui`, riel lateral
  de 1440 que ninguna tarea cubria, ubicacion de `QuickAccessToggle`.
- F1-24 (spec primero): RF-ACC-04 (solo en Ajustes, idioma en invitado y donde se guarda), RF-X-02
  (48 px), RF-X-03 (version en Ajustes), §14 con 4 puntos nuevos; `UX-UI.md` con los tokens finales
  de ambos temas, tipografia, forma, rasgos retro, componentes nuevos, §4.5 Ajustes y §4.6 invitado;
  `FUNCIONAL.md` (`/settings`, redirect, criterios de HU-ACC-04); `TECNICO.md` §14 (fuentes y LCP);
  ADR-012; `CLAUDE.md` (estado, stack, ADRs) y `docs/README.md`.

### Decisiones (con link a ADR si corresponde)

- [ADR-012](adr/012-own-fonts-precached.md): Chakra Petch + IBM Plex Sans/Mono, woff2 propias y
  precacheadas; reemplaza la regla "sin web fonts".
- Marca sospechosa: triangulo en chapa y tabla, anillo en la regla (la spec decia anillo; se
  conserva en la regla y se suma la forma en la chapa).
- Idioma elegido sin sesion: se guarda en el navegador y gana sobre el del navegador; con sesion
  manda `profile.locale`.

### Verificado (como se probo, no solo "tests verdes")

- `spec-reviewer` sobre los docs: cubre SPEC-CHANGES §1–§8 y los 4 criterios de R-01. Marco 15
  puntos; se corrigieron todos menos el de alcance (codigo de R-02 en el arbol), que se resolvio
  separando los commits.
- Sin codigo en este paso: no corresponde correr tests.

### Pendiente / deuda

- F1-25 en adelante. La prueba al sol y el lector de pantalla siguen siendo del autor (F1-18/F1-19).

## 2026-11-16 — La configuracion de despliegue vive en el repo, lista para Railway

**Tareas:** F0-20 (parcial: lo que no necesita cuentas) · **Commit/PR:** rama `feat/f0-railway-config` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- PR #1 mergeado a `main` (cd18b18) con la CI entera en verde.
- **API:** `apps/api/railway.json` con Railpack, build de turbo, `preDeployCommand` con las migraciones (TECNICO §12: si fallan, no arranca), healthcheck `/ready` y reinicio ante falla.
- **PWA:**
  - `apps/pwa/railway.json` y `apps/pwa/Dockerfile`: build en Node 22 con `VITE_API_URL` como argumento de build, servido con Caddy.
  - `apps/pwa/Caddyfile`: fallback de SPA, cache inmutable de `/assets/*`, `no-cache` para `index.html`, `sw.js` y el manifest, compresion, HSTS, `nosniff`, `X-Frame-Options`, `Permissions-Policy` y una **CSP estricta** (sin `unsafe-inline` ni `unsafe-eval`; el script del tema entra por hash).
- `scripts/csp.test.mjs`: falla si un script inline de `index.html` cambia sin actualizar su hash, si queda un hash viejo o si la CSP pierde `frame-ancestors`, `form-action` u `object-src`.
- `.dockerignore`: ni `node_modules`, ni builds, ni `.env`, ni los datos reales del autor entran a la imagen.

### Decisiones (con link a ADR si corresponde)

- La PWA en Docker + Caddy (lo que dice TECNICO §12) y la API con Railpack: la API no necesita mas que Node.
- `style-src 'self'` sin `unsafe-inline`: React y Motion escriben estilos por CSSOM, que la CSP no bloquea.

### Verificado (como se probo, no solo "tests verdes")

- `node --test scripts/csp.test.mjs` (3).
- El build servido con la CSP de produccion, en el navegador:
  - el login se dibuja;
  - el script del tema corre (`data-theme=dark` desde `localStorage`);
  - el CSS carga;
  - ninguna violacion de CSP en la consola.
- El service worker no registra en el panel del navegador, con o sin CSP: es el panel. Playwright si lo registra (`installable.spec.ts`).
- **Sin probar:** el `Dockerfile`, el `Caddyfile` real y los `railway.json`. No hay Docker ni Caddy en esta maquina, ni proyecto en Railway.

### Pendiente / deuda

- Todo lo de afuera de F0-20: dominio, proyecto Railway (staging y prod), clusters Atlas con backups y PITR, Google OAuth, DNS y monitor de uptime.
- El primer despliegue a staging prueba estos archivos de verdad.

---
 de 184 a 171 KB y vuelve a ser gate

**Tareas:** F0-19 (presupuestos de TECNICO §14) · **Commit/PR:** [PR #1](https://github.com/BraianVaylet/sight-mapper-archery-project/pull/1) · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **Decision del autor:** el "4G" de RNF-01 es el "4G lento" de Lighthouse; a recortar JS.
- **zod clasico fuera del arranque** (era ~25 KB gzip y no se recorta por tree-shaking):
  - `@sight-mapper/client` (envelope y paginas) y la PWA (sesion, `validateSearch` de las rutas, `redirect.ts`, `after-save.ts`) usan `zod/mini`.
  - `http.ts` acepta cualquier schema con `safeParse`, sin importar zod.
  - Los formularios publicos cargan los schemas compartidos **al enviar** (`formSchemas()`, `onSubmitAsync`); validan igual, solo cambia cuando se baja el codigo.
  - `profile.ts` carga el schema del perfil en la primera llamada.
  - `looksLikeEmail` pasa a `identifier.ts` (sin zod), con subrutas `@sight-mapper/schemas/identifier` y `/issues`.
- **Pantallas publicas sin dividir** en chunks y **librerias en un solo `vendor`**: 10 pedidos de JS en vez de 19.
- **Servidor de Lighthouse:** una URL mal formada tumbaba el proceso (`decodeURIComponent`; lo marco la revision de seguridad). Ahora da 404 o el fallback, con try/catch en el handler, y escucha solo en loopback.

### Decisiones (con link a ADR si corresponde)

- **El peso del JS vuelve a ser gate** (171 KB < 180). **El LCP sigue como aviso:** ~2,6 s contra 2,5.
- Medido y descartado:
  - un solo idioma por arranque mas no esperar la sesion: 2,55 s, todavia arriba;
  - cargar el idioma con `import()` suma un viaje de red y empeora.
- El piso es el stack: React, TanStack Router, Query y Form son ~130 KB gzip. Bajar del 2,5 con margen pide **prerenderizar las pantallas publicas** (HTML estatico que pinta antes del JS) o cambiar el stack. **Decision del autor.**

### Verificado (como se probo, no solo "tests verdes")

- Lighthouse local (3 corridas, mediana): LCP 2,90 → **2,62 s**; JS 184 → **171 KB**; zod clasico: 0 archivos en el arranque.
- Lint y tipos en verde.
- Unit: PWA 385, client 78, schemas 130, API 410.
- E2E completo con `CI=true`.
- Servidor de Lighthouse probado a mano: una URL mal formada y un intento de salir de `dist` caen en el fallback de la SPA; el servidor no se cae.

### Pendiente / deuda

- LCP < 2,5 s en "4G lento": **decidido (2026-11-16) dejarlo como aviso**, sin prerender por ahora. La CI del PR #1 sobre 8184191 paso entera, Lighthouse incluido.

---
 y suma Lighthouse con los presupuestos de la PWA

**Tareas:** F0-19 · **Commit/PR:** [PR #1](https://github.com/BraianVaylet/sight-mapper-archery-project/pull/1) · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- Los tres jobs del PR #1 en verde en GitHub (verify, seguridad, E2E de 16 min) despues de los arreglos de la entrada anterior.
- **Lighthouse CI** (lo que le faltaba a F0-19): job `lighthouse` en el PR, `pnpm --filter @sight-mapper/pwa test:lighthouse`, config en `apps/pwa/lighthouserc.cjs`. Mide `/sign-in` del build (3 corridas, emulacion movil por defecto) servido por `apps/pwa/scripts/lighthouse-server.mjs`: gzip, fallback de SPA y una API que contesta "nadie logueado". Sin esa respuesta el chequeo de sesion recibia el HTML, reintentaba y Lighthouse media los reintentos. Los reportes quedan como artefacto 14 dias.
- Asserts: accesibilidad ≥ 0,95 y buenas practicas ≥ 0,9 **cortan**; LCP < 2,5 s, JS ≤ 180 KB y performance ≥ 0,9 **avisan**.

### Decisiones (con link a ADR si corresponde)

- LCP y peso del JS como aviso y no como gate, por ahora. Medido en local:
  - **Observado sin limitar:** FCP 0,18 s, el formulario (LCP) a 0,37 s.
  - **Simulado con el "4G lento" de Lighthouse** (1,6 Mbps, RTT 150 ms, CPU 4x): LCP ~2,9 s, JS 184 KB gzip en 19 pedidos (159,8 KB del arranque + el chunk de la ruta). Performance 0,95, accesibilidad 1, buenas practicas 1.
  - Probado y descartado como causa: esperar la sesion (sin esperarla, mismo LCP) y el code-splitting (sin dividir, 2,7 s pero 206 KB). El costo es bajar y ejecutar el JS en un telefono lento.
  - RNF-01 dice "4G"; el perfil de Lighthouse es mas lento que un 4G tipico. **Decision del autor:** tomar ese perfil como el "4G" y recortar JS (por ejemplo, cargar un solo idioma), o fijar un perfil 4G propio. Hasta entonces, aviso.

### Verificado (como se probo, no solo "tests verdes")

- `gh pr checks 1` con los tres jobs en verde sobre 0ddddc6.
- `pnpm test:lighthouse` en local con el Chromium de Playwright: termina en 0 con los dos avisos esperados.

### Pendiente / deuda

- Decidir el perfil de "4G" y, segun eso, recortar JS para que LCP y peso vuelvan a ser gate.
- Correr el job `lighthouse` en GitHub (lo hace este push).

---
 (PR #1) y se arreglan sus dos fallas

**Tareas:** F0-19 · **Commit/PR:** [PR #1](https://github.com/BraianVaylet/sight-mapper-archery-project/pull/1) · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **Licencias:** `check-licenses.mjs` rechazaba MIT-0 (`@csstools/*`) y MPL-2.0 (`lightningcss`). MIT-0 entra a la lista (es MIT sin la condicion de atribucion). `lightningcss` queda **exento por nombre, con el motivo escrito**: es el minificador de CSS de Vite y solo aparece en el arbol de produccion porque better-auth declara vitest como peer opcional y pnpm enlaza el del workspace; ningun codigo del servidor lo carga. Cualquier otro paquete MPL sigue fallando.
- **Hook de rutas:** en Linux `docs\spec\x.md` no se reconocia como `docs/spec` (la barra invertida es un caracter comun en POSIX). Ahora se lee como separador en todos lados, asi que pide confirmacion igual que en Windows.
- **Segunda corrida:**
  - **gitleaks** encontro 3 "claves" en el historial (commit ad44c74): son `key-0001-abcdefgh`, una Idempotency-Key inventada de los tests de la API. Van a `.gitleaksignore` **por huella** (commit, archivo, regla y linea), nunca por archivo ni por regla. El historial no se reescribe.
  - El **E2E** no llego a arrancar: `dev:local` no estuvo listo en 240 s en un runner limpio, y como su progreso va a stdout el log no decia por que. Ahora la CI hace `pnpm build` antes de Playwright y el servidor de desarrollo muestra su salida (`stdout: 'pipe'`).
- **Tercera corrida:** con la salida visible, `dev:local` se quedaba en `migrate-mongo up`. Causa probable: las migraciones corrian con `spawnSync`, que bloquea el event loop mientras mongod (hijo del mismo proceso) escribe su log a un pipe que solo ese loop vacia; en Linux el pipe se llena (64 KB), mongod se frena y la migracion espera para siempre. Ahora corren con `spawn` y se espera su salida. En Windows ya andaba; en Linux lo confirma la proxima corrida.
- **Cuarta corrida:** el arranque quedo resuelto (45 de 48 pasan en Linux). Fallo un desborde real: a 360 px la **tabla de marcas** de la pantalla de la mira quedaba 3 px mas ancha que la pantalla. La app usa la fuente del sistema y en el runner es DejaVu, mucho mas ancha que Segoe UI; en un telefono con fuente ancha pasaria lo mismo. Las celdas pasan de `pr-3` a `pr-2` y el boton "Editar" de la tabla tiene menos relleno lateral (8 px). Nuevo test en `a11y.spec.ts`: el recorrido entero a 360 px **con Verdana** (metricas de DejaVu, todavia mas ancha), para que Windows vea lo que antes solo veia Linux. Con Verdana y sin el arreglo, la tabla desbordaba; con el arreglo, nada desborda.
- **Quinta corrida:** el property test de la regla del dominio ("nunca junta ticks a menos del minimo") tardo 5,4 s con cobertura en el runner y supero el limite por defecto de Vitest (5 s); en la corrida anterior habia pasado. `testTimeout: 30_000` en la config de Vitest del dominio: los property tests hacen miles de asserts a proposito, y el limite es para detectar cuelgues, no lentitud. No cambia ningun test ni codigo del dominio.

### Decisiones (con link a ADR si corresponde)

- Excepciones de licencia por paquete y con motivo, nunca por licencia: una dependencia nueva con MPL en el runtime tiene que fallar.

### Verificado (como se probo, no solo "tests verdes")

- Local: `node scripts/check-licenses.mjs` pasa (201 dependencias); `pnpm test:scripts` 72/72. La prueba real es la corrida de GitHub sobre este commit.

### Pendiente / deuda

- Ver que el job `e2e` (que dependia de los otros dos) pase en GitHub.

---

## 2026-11-08 — El catalogo visual de componentes queda verificado en los dos temas

**Tareas:** F0-11 · **Commit/PR:** rama `feat/f0-ui-catalog` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- El catalogo de `/sandbox` (solo en desarrollo, existia desde F0-17) suma `PasswordField`, la unica primitiva que faltaba: ahora estan todas las de F0-11.
- `e2e/catalog.spec.ts`: el catalogo pasa **axe** (sin hallazgos serios), **contraste AA** con los colores que pinta el navegador y **sin desbordes**, en **dark y light**, a 360 y 1440.
- Los helpers de axe y desbordes pasan de `a11y.spec.ts` a `e2e/audits.ts`, compartidos por el recorrido de pantallas y el catalogo.
- Tabla de estado del plan al dia (decia F1 "sin iniciar").

### Decisiones (con link a ADR si corresponde)

- Sin decisiones nuevas: el catalogo sigue siendo una pagina de desarrollo, en un build es un 404.

### Verificado (como se probo, no solo "tests verdes")

- Vitest del sandbox (10): el campo de contraseña aparece y "Mostrar" lo revela.
- Playwright con `CI=true`: `catalog.spec.ts` (4) y `a11y.spec.ts` (3 + 1 salteado) en verde, en los dos proyectos.

### Pendiente / deuda

- Nada de F0-11. En F0 quedan F0-15 (Google, necesita F0-20), F0-19 (correr la CI en GitHub) y las bloqueadas F0-04 y F0-20.

---

## 2026-11-06 — Preparado el release del MVP: metricas desde la base y el runbook de produccion

**Tareas:** F1-22 (parcial: lo que no necesita infraestructura) · **Commit/PR:** rama `feat/f1-release-prep` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **`scripts/metrics.mjs`**: las metricas del MVP (spec §2) agregadas desde la base, **solo lectura** y sin tracking de terceros:
  - **activacion a 7 dias** (setup + 2 marcas medidas en los primeros 7 dias; solo cuentan las altas que ya tuvieron sus 7 dias; meta ≥ 50 %),
  - **setups que llegan a 5 marcas** (alcance del Doctor, con marcas vivas de algun set; meta ≥ 30 %),
  - **marcas re-medidas** (aproximacion: lectura cambiada despues de guardar; el Doctor no guarda lo que señalo).
  Solo conteos y porcentajes; lee unicamente los campos que necesita (ni nombres ni notas ni lecturas). `--since` mira una cohorte, `--json` para guardar el resultado.
- **`docs/runbooks/release-mvp.md`**: antes de promover (CI, staging con el mismo commit, migraciones, backup reciente), promover a prod y como volver atras, **probar un restore de backup en staging**, correr
  las metricas a los 14 dias con un usuario de solo lectura, y como hacer y triar la prueba con 5–10 arqueros.

### Decisiones (con link a ADR si corresponde)

- Las metricas salen de lo que el producto ya guarda: no hace falta analitica de terceros para el MVP. El tiempo de abrir la app (< 3 s en 4G) no sale de la base: se mide en el campo.
- "Re-medidas" queda como aproximacion declarada, no como dato exacto: guardar lo que el Doctor señalo iria contra ADR-001 (lo calculado no se persiste).

### Verificado (como se probo, no solo "tests verdes")

- `node --test` (7): activacion dentro y fuera de los 7 dias, cohorte que todavia no los cumplio, `--since`, setups con 5 marcas vivas (una borrada no cuenta), re-medidas (las sembradas no cuentan),
  ningun id ni lectura en el resultado, y la lectura real contra un **mongod de prueba**: no trae nombres ni notas y da los mismos numeros.

### Pendiente / deuda

- **Todo lo que depende de F0-20**: staging, prod y Atlas para promover, probar el restore y correr las metricas.
- **Canal de feedback**: decidido, issues de GitHub con la plantilla `archer-feedback.yml` (sin contraseñas ni sesion). Ojo: los arqueros necesitan cuenta de GitHub, o se los carga el autor a mano.
- **La prueba con 5–10 arqueros** y las metricas a los 14 dias.

---

## 2026-11-06 — Los datos reales del autor entran por la API, con su sesion y todas las reglas

**Tareas:** F1-21 · **Commit/PR:** rama `feat/f1-author-import` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **`scripts/import-author-data.mjs`**: lee un archivo de datos (equipo, setups y marcas en las unidades del arquero) y lo carga **por la API publica** con la sesion del arquero: es un cliente mas, asi que
  valen el aislamiento, la validacion, la idempotencia y una marca por distancia.
  - **Por defecto es un simulacro**: lee y muestra que haria; escribe solo con `--apply`.
  - **Se puede repetir**: reusa lo que ya existe (arco y mira por fabricante + modelo, flechas por nombre, setup por el par arco + mira, marca por distancia) y agrega al setup los sets que le falten.
  - **No pisa nada**: una distancia con otra lectura en la app es un conflicto informado (codigo 3); se reemplaza solo con `--replace`.
  - Las unidades las convierte el **paquete de dominio** (metros, milimetros de escala), no el script.
  - La cookie de sesion llega por `SM_SESSION_COOKIE`, la pega el arquero: el script nunca pide, guarda ni muestra una contraseña ni el token. Una sesion invalida corta con un mensaje claro.
- **`scripts/data/author-sets.example.json`**: los dos sets reales del 31/10 (Ultraview Side 1, escala en cm 0–10; Gold Tip Hunter 400 y Pierce 400), de `packages/domain/test/fixtures/real-sets.json`. El arco no
  esta en esas notas: queda como `COMPLETAR` y el script se niega a importar hasta que se complete. Los archivos de datos reales (`scripts/data/*.json`) los ignora git; solo el ejemplo se versiona.
- **`scripts/data/README.md`**: los pasos para el autor y el cuidado con la cookie (es una credencial).

### Decisiones (con link a ADR si corresponde)

- Los proyectos previos solo tenian datos de demo de desarrollo (y una contraseña de seed, que no se copio): la fuente real son las notas del 31/10 que el autor ya habia pasado.
- Por la API y no por la base: el criterio es que "respeta todas las reglas", y la base no las aplica sola.

### Verificado (como se probo, no solo "tests verdes")

- Unidad (`node --test`, 6): el ejemplo valido una vez completado, el ejemplo tal cual rechazado, claves desconocidas, distancia repetida, escala invalida, 1,6 cm → 16 mm, 50 yd → 45,72 m.
- **E2E en la pila real**: sesion invalida rechazada; simulacro sin escribir; `--apply` → la app muestra **exactamente** 0,3 / 0,8 / 1,6 / 2,6 / 3,6 (Hunter) y 0,4 / 1,0 / 1,8 / 2,5 / 3,5 (Pierce); repetir no duplica
  (sigue en 5 marcas); un 40 m cambiado a 1,7 queda como conflicto y la app conserva 1,8; con `--replace` pasa a 1,7.

### Pendiente / deuda

- **Correrlo contra produccion** cuando exista (F0-04/F0-20), con el arco completado: lo hace el autor con su sesion.

---

## 2026-11-06 — El flujo critico entero, en los dos idiomas y los dos sistemas, como test de punta a punta y en CI

**Tareas:** F1-20 · **Commit/PR:** rama `feat/f1-critical-e2e` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **`e2e/critical-flow.spec.ts`**: el recorrido que la spec llama critico, de una sola vez y como lo vive un arquero nuevo: alta → correo → equipo por la guia → setup (lo cargado viene elegido) → **5 marcas**
  (40 anotada 0,8 fuera) → **intermedias** (grilla en la unidad del arquero, lo medido sin `≈`, consulta libre de 45) → **Doctor** (señala 40 y dice cuanto se aparta) → **listado imprimible** (10 filas, solo la
  hoja en medio `print`, **una pagina A4**). Dos veces: **español y metros**, e **ingles y yardas** (lo decide el idioma del navegador, como a un arquero real), en **360 y 1440**.
- **CI:** job `e2e` en `ci.yml`, despues de `verify`: instala Chromium con sus dependencias, guarda el navegador y el mongod en cache, y corre la suite entera contra `pnpm dev:local` y el build de produccion.
  Mismas acciones fijadas por SHA que el resto del workflow (sin agregar ninguna nueva).
- **Playwright en CI:** `forbidOnly` (un `test.only` olvidado hace fallar la corrida en vez de saltear el resto) y servidores siempre frescos (`reuseExistingServer` solo fuera de CI).

### Decisiones (con link a ADR si corresponde)

- El flujo critico es **un** test largo por idioma, no la suma de los specs por pantalla: lo que se rompe entre pantallas (lo que una deja y la otra lee) solo se ve recorriendolo entero.
- Contra `dev:local` y no contra staging: staging no existe todavia, y en staging los links de los correos llegan a un buzon real; hace falta un buzon de prueba (pendiente).

### Verificado (como se probo, no solo "tests verdes")

- El flujo critico: 4/4 (ES/metrico y EN/imperial, en 360 y 1440). La suite entera con `CI=true` como la correria GitHub: 41/41 (mas 1 que se salta a proposito), 10,3 min.

### Pendiente / deuda

- **Correrlo en GitHub** (F0-19: el workflow nunca corrio alla) y **contra staging** (F0-04/F0-20), con un buzon de prueba para los correos.
- Sin subida del reporte de Playwright como artefacto: la accion se agrega fijada por SHA cuando se pueda verificar ese SHA.

---

## 2026-11-06 — Accesible y responsive: axe sin violaciones serias, el flujo entero con teclado, y 360/768/1440 sin desbordes

**Tareas:** F1-19 · **Commit/PR:** rama `feat/f1-a11y` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **axe-core** (WCAG 2.0–2.2 A y AA) en E2E sobre las 19 pantallas y estados del recorrido comun (`e2e/tour.ts`, el mismo de la auditoria de contraste), a **360, 768 y 1440**: 0 violaciones serias o criticas.
  Ademas, ninguna pagina mas ancha que la pantalla. `axe-core` se agrego como devDependency desde el store local (`--offline`): ya estaba, sin descarga nueva.
- **Lo que encontro axe:** la tarjeta de setup del Home era un `<dl>` con solo `<dd>`: ahora cada valor tiene su termino (`<dt>` oculto a la vista: "Arco", "Mira", "Sets de flechas") para el lector de pantalla.
- **El flujo critico solo con teclado** (`e2e/keyboard.spec.ts`, sin un solo clic): alta de la cuenta, link del correo, la guia (arco, mira, flechas), el setup, la primera marca, una segunda con el stepper, la tabla
  recorrida con flechas y la hoja cerrada con Escape. En cada parada se comprueba que **el foco se ve**.
- **Lo que encontro el teclado, dos bugs del `useFocusTrap`:**
  1. La hoja de marca abria con el foco en "Cerrar" en vez de la distancia: la trampa pisaba el `autoFocus`. Ahora lo respeta (solo mete el foco si nada adentro lo tiene).
  2. En desarrollo (`StrictMode`, que corre los efectos dos veces) la limpieza devolvia el foco al boton y el segundo montaje lo llevaba a "Cerrar". La limpieza ahora solo devuelve el foco cuando el dialogo
     de verdad salio del documento, y quien abrio el dialogo se recuerda al renderizar (antes, con `autoFocus`, al cerrar el foco no volvia al boton). Tres tests de ui nuevos, que fallan sin el arreglo.
- **El E2E fallaba en racimo** despues de los recorridos pesados: el limite **global** de Better Auth (100 pedidos por minuto por IP, `get-session` incluido) cortaba a la suite, que carga cientos de
  paginas desde una sola IP. Se levanta solo en `pnpm dev:local` (`globalLimit`, con test), como ya pasaba con el de los endpoints sensibles; en todo ambiente hosteado y bajo test sigue en 100.
- **Responsive (UX-UI §7):** el contenedor llega a **1200 px**; las listas (Home, arcos, miras, flechas, papelera) son una grilla de 1, 2 o 3 columnas; los formularios, el perfil y la apariencia se quedan en un ancho
  legible (`max-w-2xl`); la pantalla de la mira ya tenia regla y tabla en dos columnas desde 768; el aviso flotante no ocupa todo el ancho en escritorio.

### Decisiones (con link a ADR si corresponde)

- axe para lo que mide bien (nombres, roles, estructura, ARIA) y la auditoria propia para el contraste compuesto y los graficos SVG (F1-18): las dos corren sobre el mismo recorrido.
- Los formularios no se estiran a 1200 px: una columna de campos de 1200 px es mas dificil de leer que de 672.

### Verificado (como se probo, no solo "tests verdes")

- axe 0 serias en 360/768/1440 y sin desbordes; teclado completo en 360 y 1440; ui 101 tests (los tres del foco fallan sin el arreglo); PWA 384; API 410; E2E 37/37 en la pila real
  (mas 1 que se salta a proposito: el de 768 corre una sola vez); lint y typecheck limpios.

### Pendiente / deuda

- **Pasada con un lector de pantalla real** (TalkBack en Android, VoiceOver en iOS o NVDA): la tiene que hacer el autor. Lo automatico verifica nombres y roles, no como suena.
- Las violaciones de impacto "moderado" o "menor" de axe no estan en el criterio; no se revisaron una por una.

---

## 2026-11-06 — El tema claro se lee al sol: contraste AA verificado en cada pantalla, con capturas de referencia

**Tareas:** F1-18 (y un arreglo de F1-17 que pidio la revision de seguridad) · **Commit/PR:** rama `feat/f1-light-theme` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **Auditoria de contraste en las pantallas reales** (`e2e/contrast.ts`): dentro del navegador, sin librerias, mide cada texto visible contra lo que de verdad tiene detras (el primer fondo opaco hacia arriba,
  con las capas translucidas y la opacidad de los ancestros compuestas), 4.5:1 y 3:1 para texto grande; y los **graficos que llevan significado** (puntos, rombos y lineas de la regla y la curva, WCAG 1.4.11,
  3:1). Recorre 19 pantallas y estados (ingreso, alta, guia, mira con 5 marcas, hoja de marca con errores, Home, equipo, setup nuevo, distancias, Doctor, imprimir, papelera, perfil, apariencia, menu) en
  **dark y light**.
- **Lo que encontro:** en light, todo lo "medido" se pintaba con el amarillo del acento como **tinta** sobre blanco: el badge "Registrada" (y "Coherente" en el Doctor) a 1,51:1, y los puntos y lineas de
  la regla y la curva. Los tests de tokens ya decian que en light el acento es solo relleno; el codigo lo usaba igual. Token nuevo **`--sm-mark`** (lo medido como tinta): el mismo `#FFCC00` en dark y
  `#7D5E00` en light (6:1 sobre blanco, 5:1 sobre el hundido). Lo usan el badge, la regla, la curva, la estrella de favorito y el resaltado de la guia. El acento sigue para botones y la opcion elegida.
- **Capturas de referencia** dark/light por pantalla en `docs/screens/` (360 px, 1x, 1,5 MB), regenerables con `SM_SCREENS=1` (ver su README).
- Las cabeceras de las tablas de la mira y de distancias quedaban pegadas a 360 px: tienen aire.
- **Revision de seguridad (F1-17):** la preseleccion del form de setup contaba un id de la URL como elegido mientras la lista cargaba. Ahora falla cerrado: hasta que la lista esta, no hay nada elegido. No era
  explotable (la API rechaza un componente ajeno), pero la asimetria quedo cerrada.

### Decisiones (con link a ADR si corresponde)

- `mark` y no "amarillo mas oscuro en todos lados": el acento como boton es la identidad del diseño y pasa en ambos temas (tinta navy sobre amarillo); solo cambia el uso como tinta.
- La auditoria es propia y no `axe-core`: sin una dependencia nueva, mide graficos SVG (que axe no mide) y sirve como base de F1-19.

### Verificado (como se probo, no solo "tests verdes")

- La auditoria **tiene dientes**: con `--sm-mark` claro vuelto al amarillo encuentra 25 puntos, 20 lineas y 16 badges por debajo de AA; con el token nuevo, 0 en dark y 0 en light.
- ui 98 tests (contraste de `mark` en las tres superficies de ambos temas), PWA 384, E2E 32/32 en la pila real (360 y 1440), lint y typecheck limpios.

### Pendiente / deuda

- **Prueba al sol con un telefono real** (criterio de F1-18): la tiene que hacer el autor; lo automatico no reemplaza el brillo de una pantalla a mediodia.
- Los disabled quedan fuera de la auditoria (WCAG los exime); si alguno se tiene que leer al sol, se mira en F1-19.

---

## 2026-11-06 — Onboarding: un arquero nuevo llega a su primera marca sin salir de la guia

**Tareas:** F1-17 · **Commit/PR:** rama `feat/f1-onboarding` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **La guia** (`FirstSetupGuide`) reemplaza al estado vacio del Home cuando no hay setups: "Tu primer setup en 4 pasos" (FUNCIONAL §2.1), una lista de pasos, no un wizard. Cada paso hecho se tacha con
  lo que se cargo ("Hoyt Alpha") y el primero que falta lleva el acento y su boton; los siguientes no son botones hasta que les toque. Un arquero que ya tiene equipo salta los pasos cumplidos y arranca en
  "Crear setup". Desaparece cuando existe el primer setup.
- **Volver a la guia al guardar:** los formularios de arco, mira y flechas aceptan `?next=home` (vuelve al Home, con el paso tachado) o `?next=setup` (sigue al setup nuevo con lo recien cargado elegido). Es una
  lista cerrada (`home` | `setup`), no una ruta libre: la URL no puede mandar a nadie a otro lado, y un valor que no se conoce se ignora. Editar equipo vuelve a su lista como siempre.
- **Lo recien cargado viene elegido** (form de setup nuevo): llega por `?bow=`, `?sight=`, `?arrowSet=` desde los formularios, o por ser **la unica opcion que hay** (un arquero nuevo carga exactamente una de cada una, asi
  que guardar es todo lo que falta). Lo que el arquero elija o desmarque manda; un id de la URL que no es suyo no elige nada ni se envia. Con varias opciones y sin id en la URL no viene nada elegido, como antes.
- Los enlaces "+ Cargar un arco/mira/flechas nuevo" del form de setup llevan `?next=setup`.

### Decisiones (con link a ADR si corresponde)

- La preseleccion automatica es solo para **la unica opcion**: elegir "la ultima creada" entre varias podria equivocar a quien ya tiene equipo; lo recien cargado entre varias se pasa explicito por la URL.
- El estado de la guia sale de las listas activas (arcos, miras, flechas) que la app ya consulta: no hay ninguna bandera de "onboarding hecho" guardada. Si el arquero borra su unico setup, vuelve a verla con los pasos de equipo tachados.

### Verificado (como se probo, no solo "tests verdes")

- PWA (+14 tests, 384): la guia sin nada, con el arco hecho, con todo el equipo, sin guia con un setup; arco nuevo con `next=home` vuelve a la guia con el arco tachado, flechas con `next=setup` sigue al setup con todo elegido,
  sin `next` o con uno desconocido va a su lista, editar vuelve a la lista; preseleccion del unico, desmarcar el unico, preseleccion por URL, ninguna con varios y un id ajeno ignorado; la guia tambien en ingles.
- E2E 28/28 en la pila real (360 y 1440): alta → guia → arco → mira → flechas → setup con todo elegido → pantalla de la mira vacia → primera marca, y la guia ya no esta; y el orden no se fuerza (mira primero).
  Captura de la guia revisada a 360 px.

### Pendiente / deuda

- La guia no mide por si sola cuantos llegan a la primera marca (spec §16, riesgo de activacion): esa medicion es de analitica, que no esta en la fase 1.
- F1-18 (tema light verificado), F1-19 (accesibilidad y responsive), F1-20 (E2E del flujo critico), F1-21 (importar los datos reales del autor, opcional) y F1-22 (release del MVP) son lo que sigue.

---

## 2026-11-05 — Perfil: el arquero baja todos sus datos y puede pedir la baja de la cuenta, que se cumple a los 90 dias

**Tareas:** F1-16 · **Commit/PR:** rama `feat/f1-profile` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **API (`account`):**
  - `GET /me/export` (HU-ACC-05): perfil, arcos, miras, flechas, setups y marcas **incluido lo archivado y lo de la papelera**, en unidades canonicas, con `schemaVersion: 1` y `exportedAt`; sin `userId`,
    `_id` ni `__v`; `Content-Disposition: attachment` y `Cache-Control: no-store`. Cada modulo entrega lo suyo por una fuente (`ExportSource`): la cuenta no lee sus colecciones. La lectura va por el driver con el
    filtro `userId` escrito en un solo lugar (`core/db/export.ts`), porque los modelos aislados esconden lo borrado.
  - `POST /me/deletion-request` (HU-ACC-06): registra el pedido; el perfil trae `purgeAt` (+90 dias, `DELETION_DAYS`). Pedirlo dos veces: `SM-ACC-409-001` con la fecha del primero. No se borra nada ahora.
  - `DELETE /me/deletion-request`: lo retira (`SM-ACC-404-001` si no hay).
  - **Job `purgeDeletedAccounts`** (diario, reloj inyectado): por cada baja de 90 dias o mas publica `AccountPurged`; equipment y calculator borran lo suyo (incluida la papelera), el nucleo borra la **identidad**
    (usuario, sesiones, cuentas vinculadas y links pendientes de Better Auth) y las claves de idempotencia, y el perfil va **ultimo**: si algo falla a mitad, el perfil sigue y la proxima corrida termina. Idempotente.
- **PWA:** pantalla `/profile` (ultimo placeholder, que se borra): usuario, email y version; **"Descargar mis datos"** (descarga real de un `.json` con la fecha del servidor en el nombre); baja de la cuenta
  con la explicacion de por que no es inmediata, confirmacion escribiendo el usuario (o el email si no tiene), y despues "Pediste la baja… se eliminan el {fecha}" con **"Cancelar la baja"**.

### Decisiones (con link a ADR si corresponde)

- **Cancelar la baja no lleva `If-Match`** (decision que ya estaba en `main.ts`: `ifMatchExempt`): la salida de algo que el arquero pidio tiene que funcionar aunque el perfil haya cambiado (el tema, en otra pestaña).
  La exencion pasa a vivir en la **raiz de composicion**, no en `main.ts`: antes los tests corrian sin ella y la produccion con ella, y por eso un test pasaba y el E2E real daba 428.
- La confirmacion por username es de la UI; el servidor no conoce el username (es de Better Auth). El pedido sigue siendo reversible 90 dias.
- `purgeAt` sale de la API (`purgeAtOf`), no se calcula en el cliente: una sola regla de fechas.

### Verificado (como se probo, no solo "tests verdes")

- API (+21 tests, 408 en total): exportacion con todo (archivado, papelera, marca borrada sola), sin userId ni basura del driver, sin datos de otro, vacia para quien no tiene nada; pedir, 409 con la fecha del primero, nada se borra
  al pedir; cancelar (404 si no hay, sin If-Match aunque el perfil cambio); purga: a los 89 dias no, a los 90 si, la papelera tambien, quien cancelo a tiempo se queda, segunda corrida no hace nada, una falla a mitad conserva el
  perfil y la siguiente corrida termina. **Contra Better Auth real:** usuario, sesiones, cuentas y verificaciones desaparecen, la sesion vieja da 401, el login falla, el otro arquero queda igual y el mismo email puede registrarse
  de nuevo. Tres ataques de aislamiento nuevos.
- PWA (+11 tests, 370): datos de la cuenta, descarga (archivo, contenido y nombre), error de descarga, confirmacion exacta, pedido con fecha, cancelar, 409, sin username, error de carga.
- E2E 24/24 en la pila real (360 y 1440): descarga un archivo de verdad y se lee, pedir la baja, recargar, la app sigue andando, cancelar. Captura revisada a 360 px.

### Bug de otra capa que aparecio

- **`useFocusTrap` reiniciaba el foco en cada render del padre** (dependia de la identidad de `onEscape`): escribir en un campo dentro de un `BottomSheet` cuyo padre se re-renderizaba por tecla perdia letras. Ahora guarda el
  handler en un ref; test que falla sin el arreglo (ui, 96 tests).

### Pendiente / deuda

- La purga contra Atlas real (indices, tiempos con muchos datos) no se probo; solo contra el replica set de pruebas.
- Un correo de aviso antes de la baja (D-30, D-7) no esta en la spec: por ahora el unico aviso es la pantalla.
- F1-17 (onboarding) es lo que sigue en la fase 1.

---

## 2026-11-05 — Acceso rapido: la app abre directo en la mira de siempre, y si el setup se borra, abre en el Home

**Tareas:** F1-15 · **Commit/PR:** rama `feat/f1-quick-access` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **API (`account`):** `PUT /api/v1/me/quick-access` con `{ setupId, arrowSetId }` o `null` para limpiar. El setup tiene que ser un setup **vivo del arquero** (si es ajeno, inexistente o esta en la
  papelera: 404 `SM-CORE-404-002`, igual que cualquier recurso ajeno) y el set de flechas uno **de ese setup** (`SM-ACC-422-001`). Es uno por arquero (RN-STP-07): elegir otro reemplaza.
  La cuenta le pregunta al calculador por un puerto (`SetupLookupPort`, implementado por `createSetupLookup`); no se importan.
- **Limpieza por evento:** el calculador publica `SetupDeleted` **dentro de la transaccion** que manda el setup y sus marcas a la papelera; la cuenta escucha (`bus.on` en la raiz de composicion) y limpia
  el acceso rapido si apuntaba a ese setup, con el `version` del perfil subido. Restaurar el setup no lo devuelve.
- **PWA:** boton **"Abrir siempre acá"** en la pantalla de la mira (`aria-pressed`, con tilde ademas del color; "Se abre siempre acá" cuando esta activo; tocarlo de nuevo lo limpia), con guardado
  optimista y reversion si el servidor lo rechaza. Comparte `scope` con las preferencias: las dos cambian el mismo perfil y cada una lleva la version de la anterior.
- **Al abrir la app:** el guard de `_app` redirige a `/setups/:id?arrowSet=` **solo la primera vez** que se llega a `/` tras la sesion (tambien despues de iniciar sesion): volver al Home luego, o entrar
  por un link a otra pantalla, no redirige. Una precarga (pasar el mouse por un link) no gasta ese "primer arranque". Si el perfil no llega en 2,5 s, o falla, abre en el Home.
- **`If-Match` tambien en `PUT`** (guard, spec, TECNICO §4, CLAUDE.md): el perfil es un recurso versionado y un PUT que lo reemplaza no puede ser last-write-wins silencioso (ADR-006).

### Decisiones (con link a ADR si corresponde)

- La limpieza va por evento sincronico dentro de la transaccion (DOMINIO §5, `SetupDeleted`), no por un chequeo al leer: asi el perfil nunca queda apuntando a un setup que no existe.
- Un acceso rapido cuyo set de flechas ya no esta en el setup (se saco despues) abre igual el setup, en su primer set: la pantalla ya cae al primero cuando el de la URL no existe.

### Verificado (como se probo, no solo "tests verdes")

- API (+14 tests, 387 en total): poner, reemplazar, limpiar con `null`, set ajeno al setup 422, setup ajeno / inexistente / en la papelera 404, 412 y 428, validacion del body, sesion; la papelera limpia el
  acceso rapido (y solo el que apuntaba ahi), restaurar no lo devuelve, y el perfil de otro arquero no se toca. Ataque de aislamiento nuevo para la ruta (B apunta a un setup de A → 404).
- PWA (+11 tests, 359): boton activo / inactivo / limpiar / reemplazar / rechazo con reversion; arranque directo a la mira con el set, Home sin acceso rapido, volver al Home no redirige, link a otra pantalla no
  redirige, despues de iniciar sesion, perfil ilegible abre el Home, set que ya no esta.
- E2E 22/22 en la pila real (360 y 1440): marcar, abrir la app → cae en la mira, recargar, volver al Home, borrar el setup → abre en el Home, restaurar → no vuelve.

### Pendiente / deuda

- Si el set de flechas del acceso rapido se quita del setup, el servidor no limpia nada (no hay evento de eso): la PWA lo tolera, y el siguiente "Abrir siempre acá" lo reemplaza.
- F1-16 (perfil: exportar datos y baja) es lo que sigue en `account`; `/profile` sigue siendo el unico placeholder.

---

## 2026-11-04 — El listado imprimible: la hoja de papelito sale en una pagina, en blanco y negro

**Tareas:** F1-14 · **Commit/PR:** rama `feat/f1-print` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **Pantalla `/setups/$setupId/print`** (`?arrowSet=`, `step`, `from`, `to`): arriba, lo que no es papel (volver, set de flechas, desde / hasta / paso, boton **Imprimir** que abre el dialogo del
  navegador, aviso de "Guardar como PDF"); abajo, la hoja: titulo, nombre del setup, arco, mira, flechas, fecha, unidad y paso, la tabla distancia → lectura y las notas al pie.
- **Blanco y negro:** lo medido va en negrita y sin simbolo; lo calculado lleva `≈`; lo que conviene confirmar en el campo (poca confianza o fuera de la escala) lleva `*`. Las notas al pie
  explican solo los simbolos que la hoja usa. Una distancia que las marcas no permiten estimar **no se imprime como adivinanza**: se deja afuera y la hoja dice cuantas.
- **CSS de impresion** (`styles.css`): solo sale la hoja; fuera cabecera, pie, menu, dialogos, controles y todo lo flotante; pagina blanca con tinta negra aunque el tema sea oscuro; una fila
  no se parte entre paginas y el encabezado de la tabla se repite.
- **Rango compartido:** `useRange` y `RangeFields` (desde / hasta / paso con su estado en la URL) salen de la pantalla de distancias y las comparten las dos.
- **Desde la mira:** "Imprimir" se habilita con 1 marca y conserva el set de flechas; antes muestra `0/1`.

### Decisiones (con link a ADR si corresponde)

- La fecha de la hoja es la del dispositivo al abrir la pantalla (`device-time.ts`), no la de la ultima marca: es el dia en que se imprimio.
- Sin acordeon ni vista previa aparte: la hoja que se ve en pantalla es la que sale en papel.

### Verificado (como se probo, no solo "tests verdes")

- Logica (6 tests): medidas exactas, estimadas con `≈`, `*`, omitidas contadas, rango invertido.
- Pantalla (14 tests): encabezado, filas, notas al pie solo con lo usado, paso y rango en la URL, boton que llama a `window.print`, controles fuera de la hoja, sin marcas, rango sin sentido, yardas.
- E2E en la pila real (360 y 1440): con medio `print` emulado el pie, la cabecera, el boton y los controles desaparecen y el cuerpo es blanco con tinta negra; **PDF de Chromium en A4 y en
  Letter: 1 pagina** con 9 filas, y mas de una con 41 (el contador no es decorativo). Captura de la hoja revisada. PWA 348 tests; lint y typecheck limpios.

### Pendiente / deuda

- "Guardar como PDF" en Safari no se probo (solo Chromium); el CSS es estandar (`@media print`, `break-inside`).
- Imprimir el **tape** a escala real es F2 (MAKER); esto es la hoja de papelito.

---

## 2026-11-04 — La app entera se puede usar en ingles: una sola ortografia, ningun texto en español y emails marcados por idioma

**Tareas:** F1-13 · **Commit/PR:** rama `feat/f1-english` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **Auditoria:** el catalogo EN no tenia español (todo falso positivo). Lo que si estaba mal era la **ortografia mezclada**: britanica (colour, favourite, metres, catalogue) en un producto cuyo
  publico de ingles usa yardas, libras y fps. Se unifica en **ingles americano** (color, favorite, meters, millimeters, catalog) y se ajustan terminos poco naturales: "Sign out" junto a "Sign in" (era
  "Log out"), "off the trend" / "Off trend" en el Doctor (era "strays").
- **Emails:** ya salian en el idioma del arquero (ADR-004); ahora el HTML lleva `<div lang="en|es">` (lectores de pantalla y correctores) y el mismo test lo verifica.
- **Manifest y meta description:** la PWA es una sola, no puede tener manifest por idioma: la descripcion pasa a ser bilingue ("Marcas de mira para arqueros · Sight marks for archers"),
  en lugar de ingles suelto con `lang: es`.
- **Guardas permanentes** en el test de paridad: ni ortografia britanica ni letras o signos solo-españoles en el catalogo EN.

### Decisiones (con link a ADR si corresponde)

- Ingles americano, no britanico: coherente con `Intl` `en` y con el publico imperial. Si aparece beta del Reino Unido, un `en-GB` es un catalogo nuevo (ADR-004 lo permite).
- El selector de idioma muestra "Español" en español aunque la pantalla este en ingles: es el nombre del idioma en si mismo, y es correcto.

### Verificado (como se probo, no solo "tests verdes")

- Test que renderiza **las 19 pantallas privadas y las 5 publicas** con perfil `en` (y la hoja de marca con sus errores): ningun texto, `aria-label`, `title` ni `placeholder` con palabras o signos de
  español, ningun `{{…}}`, `<html lang="en">` y punto decimal (0.3, no 0,3). 26 tests.
- E2E en la pila real (360 y 1440) con un navegador en en-US: alta, correo (link), equipo, setup, 5 marcas en yardas con punto decimal, dialogo de reemplazo, intermedias, Doctor, cerrar sesion y error
  de credenciales, escaneando español en cada pantalla. 18/18 en total.
- PWA 328 tests, i18n 27, API (auth) 38; lint y typecheck limpios.

### Pendiente / deuda

- El perfil nuevo toma el idioma del `Accept-Language` y en ingles arranca imperial: es la regla de `defaultPreferences` (spec); no se cambio.
- Revision de tono por una persona de habla inglesa: el texto es mio, no de un nativo. Pendiente para la beta.

---

## 2026-11-03 — El flujo critico funciona entero en yardas y pulgadas, y los errores de la API ya no muestran llaves sin reemplazar

**Tareas:** F1-12 · **Commit/PR:** rama `feat/f1-imperial` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **Auditoria del flujo en imperial** (preferencia → arco con `6 1/4` → mira → flechas → setup → marcas → intermedias → Doctor). Los formularios de equipo ya estaban (F1-02..04); las
  pantallas de la mira, distancias y Doctor mostraban las distancias en yardas pero con tres formatos distintos (la mira siempre con un decimal: "20,0 yd").
  Ahora un solo `formatDistance`: yardas enteras sin decimal (`20 yd`), con un decimal si no lo son (`21,9 yd`, para 20 m).
- **Bug de fondo, tambien en metrico:** la API manda los params en unidades canonicas (`distanceM`, `minMm`, `maxMm`, `maxDistanceM`, `purgeAt`) y las plantillas usan `{{distance}}`,
  `{{min}}`, `{{max}}`, `{{maxDistance}}`; nadie los convertia, asi que el mensaje salia con `{{distance}}` literal (y, de haberse reemplazado, en metros aunque el arquero use yardas).
  `describeError` y `displayParams` aceptan ahora las unidades del arquero (`system`, `locale`, la escala de la mira en pantalla) y convierten: distancias a m/yd, limites de lectura a la
  unidad de la mira (o a mm/in si no hay mira a mano), instantes a fecha. Tambien los motivos de fallo del calculo (`SM-CALC-*`) en las pantallas de la mira y de distancias.
- **Decision §17.2 (unidades de equipo por sistema):** cerrada **provisoriamente** con la propuesta ya implementada (siguen el sistema elegido). No se consulto a 2–3 arqueros como pedia
  la tarea: queda escrito en la spec, ADR-005, DICCIONARIO y UNIDADES, y se reabre si la beta lo pide.

### Decisiones (con link a ADR si corresponde)

- La unidad de la escala de la mira (cm, mm, in, clicks) es la de la mira, no del sistema: no cambia con la preferencia (UNIDADES §1).
- Un error de la API sobre una longitud sin mira a mano (`SM-SGT-409-002`) se muestra en mm o in segun el sistema.

### Verificado (como se probo, no solo "tests verdes")

- Test exhaustivo: **todo codigo de `ERROR_CATALOG`**, con params de muestra, en es y en, metrico e imperial, no deja ningun `{{…}}` (encontro `maxDistance`).
- Pantallas en imperial (9 tests): marcas, distancia tipada en yardas que viaja en metros (50 yd → 45,72 m), steppers, duplicado y rechazo de la API en yardas y lecturas, intermedias sobre
  yardas enteras, consulta libre, Doctor, y ninguna distancia en metros en pantalla. PWA 302 tests.
- E2E 16/16 en la pila real (360 y 1440): imperial de punta a punta con recarga (20/30/40 yd vuelven como se tiparon).

### Pendiente / deuda

- Consultar a arqueros por §17.2 cuando haya beta.
- Las fracciones de pulgada solo se aceptan en longitudes de equipo (F1-02) y en lecturas de miras en `in`; la distancia en yardas es decimal.

---

## 2026-11-03 — El Mark Doctor tiene pantalla: señala la marca mal medida, dice cuanto se aparta y no toca nada

**Tareas:** F1-11 · **Commit/PR:** rama `feat/f1-doctor` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **Pantalla `/setups/$setupId/doctor`** (`?arrowSet=`): veredicto arriba ("Tus marcas son consistentes", "Una marca se aparta de la tendencia" o "Hay marcas que se
  mueven en sentido contrario"), "Volve a tirar {distancia}: se aparta {x} cm de la tendencia" con la magnitud **en la unidad de la mira** (no en mm), enlace "Ir a la marca de
  {distancia}" que lleva a la pantalla de la mira con esa marca elegida (ahi se edita y se reemplaza), las otras marcas que tambien se apartan, la tabla con el desvio firmado y la
  tolerancia de cada marca, y la regla con anillo de advertencia en las señaladas.
- **`doctor.logic.ts`:** pasa el informe del dominio (mm) a lo que lee el arquero (unidades de la escala), por marca: desvio, tolerancia y estado (`ok`, `suspect`, `secondary`,
  `inconsistent`). Desde 2 marcas revisa el sentido de las lecturas y lo dice; la tendencia (leave-one-out) recien desde 5, y la pantalla lo avisa ("Con menos de 5 marcas…").
- **Desde la mira:** el boton Doctor se habilita con 5 marcas y conserva el set de flechas; antes muestra `n/5`.
- **`WithSetup`:** el envoltorio de carga/error del setup, comun a las pantallas de herramientas (distancias y Doctor lo usan).

### Decisiones (con link a ADR si corresponde)

- El desvio se muestra con un digito mas que la resolucion de la mira (0,98 cm, no 1,0): uno de 0,04 no puede leerse como 0,0.
- El Doctor solo lee: ninguna llamada de escritura; corregir es ir a la mira y reemplazar la marca (flujo ya hecho en F1-09).

### Verificado (como se probo, no solo "tests verdes")

- Logica (6 tests): conjunto consistente, marca 0,8 cm fuera de tendencia, entrada intacta, sentido contrario con 3 marcas, orden.
- Pantalla (8 tests): umbral, consistente, señalada con su magnitud, solo GET, salto a la marca, sentido contrario con aviso de alcance, acceso desde la mira (con y sin 5 marcas).
- E2E 14/14 en la pila real: 3 → 5 marcas, Doctor "consistente", se falsea el 50 m a 3,5 y el Doctor la señala; captura revisada a 360 px.

### Pendiente / deuda

- Con un error grande el modelo (parabola sin una marca) tambien pone "Se aparta" a varias marcas sanas, lejos de la mala; la principal sale bien arriba. Es de la calibracion del dominio
  (F0-06, solo 2 sets reales): recalibrar con mas sets antes de afinar el texto de las secundarias.
- Imprimir (F1-14) sigue siendo placeholder.

---

## 2026-11-03 — Intermedias, curva y consulta libre: el arquero ve la lectura de cualquier distancia sin tocar sus marcas

**Tareas:** F1-10 · **Commit/PR:** rama `feat/f1-distances` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **Pantalla `/setups/$setupId/distances`:** distancia elegida y su lectura arriba (con `≈`, "Calculada", baja confianza y fuera de escala), consulta libre
  ("Ver lectura"), controles desde / hasta / paso (1, 2, 5, 10 en la unidad del arquero), curva, tabla y la regla de la mira al final con los mismos numeros.
  Estado en la URL: `arrowSet`, `d` (metros), `step`, `from`, `to` (en la unidad del arquero).
- **Grilla** (`distances.logic.ts`): `from + k * step` en la unidad del arquero (en yardas: 25, 30, 35 yd, no metros convertidos), cada fila preguntada al modelo.
  Una distancia que las marcas no permiten (2 marcas, fuera de rango: `SM-CALC-422-002`) sale en su fila con el motivo, no como un hueco. Rango invertido o de mas de
  200 filas: aviso, sin tabla. El rango por defecto va de la marca mas cercana a la mas lejana, en unidades enteras.
- **Curva** (`DistanceCurve`, SVG): medida = punto lleno sobre linea solida; calculada = rombo sobre linea punteada (nunca solo color); la consulta libre es un
  rombo aparte que no es una marca; guias punteadas a los ejes en la distancia elegida; la tabla es la alternativa accesible. La geometria (escalas, ticks "redondos",
  cortes donde no hay respuesta) es aritmetica pura y esta testeada.
- **Desde la mira:** boton "Intermedias" en las herramientas (de 2 marcas en adelante, con `n/2` antes), conserva el set de flechas. `useSightData` comparte entre
  ambas pantallas la unidad, el set, las marcas y el analisis.

### Decisiones (con link a ADR si corresponde)

- Sin acordeones: las secciones son `SectionCard` siempre abiertas (el celular las lee de corrido y no hay estado que recordar). Si el diseño final los pide, es un cambio de presentacion.
- `from`/`to` en la unidad del arquero y `d` en metros canonicos: un link compartido entre un arquero metrico y uno imperial muestra el mismo numero de la tabla pero no la misma distancia fisica. Aceptado: el rango es una preferencia de vista, la distancia elegida si es fisica.

### Verificado (como se probo, no solo "tests verdes")

- Logica (20 tests, con el set real "Hunter"): grilla en m y yd, tier con 2 marcas, consulta libre que no cambia ninguna marca, geometria y ticks.
- Pantalla (14 tests): umbral de 2 marcas, medidas exactas como se cargaron y estimadas con `≈`, linea solida vs punteada, paso y rango en la URL, yardas, motivo por fila, consulta libre
  solo con GET (ninguna escritura), validaciones, acceso desde la mira. PWA 274 tests; lint y typecheck limpios.
- E2E 14/14 en la pila real (360 y 1440): desde la mira → intermedias → consulta de 33 m → recarga → vuelta con las marcas intactas. Captura revisada a 360 px.

### Pendiente / deuda

- El boton "Imprimir" (F1-14) y el Doctor (F1-11) siguen siendo placeholders.
- El selector de paso en 360 px usa solo el numero (la unidad va en la etiqueta del grupo) porque "5 m" partia en dos lineas.

---

## 2026-11-03 — La pantalla de la mira: se ven las marcas, se lee la estimacion y se cargan, editan y borran con deshacer

**Tareas:** F1-08, F1-09 · **Commit/PR:** rama `feat/f1-sight-screen` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **Pantalla (`/setups/$setupId`):** nombre del setup, selector de flechas, herramientas (Viento y Clima "Proximamente" como botones `aria-disabled`,
  Doctor con `n/5` hasta tener 5 marcas, Imprimir desde la primera), lectura grande de la distancia elegida (`≈` y "Calculada" si no es medida),
  `Ruler` SVG y tabla de marcas sincronizadas (clic en la marca de la regla o en la fila; flechas arriba/abajo en la tabla), leyenda, estado vacio con
  los dos pasos, barra de estado y boton "+ Agregar marca". El estado vive en la URL: `?arrowSet=` y `?d=` (en metros).
- **Hoja de marca:** `BottomSheet` con distancia en la unidad del arquero y lectura en la escala de la mira, steppers ± de una resolucion (la
  distancia de a 1), teclado numerico, nota y fecha. Valida en el cliente lo mismo que la API (0 < d <= 300 m, lectura dentro de la escala, nota <= 200).
- **Guardado optimista** (`marks.ts`): la marca entra en la lista antes de que conteste el servidor, el toast ofrece "Deshacer" (alta → borra, edicion →
  vuelve al valor anterior, borrado → restaura); si falla, la lista vuelve como estaba y la hoja reabre con lo que el arquero habia escrito y el motivo.
  `SM-MARK-409-001` abre el dialogo "¿Reemplazar la marca?" y confirma con `replace: true`.
- **`apps/pwa/src/app/device-time.ts`:** unico archivo de la PWA que construye un `Date` (reloj y zona del dispositivo), con su excepcion en ESLint, como el
  traductor de persistencia de la API.
- **Regla en la API (solo laptop):** el limite de 5 altas/ingresos cada 15 min por IP se levanta con `APP_ENV=local` y `NODE_ENV≠test` (`sensitiveLimit`,
  con test); sin eso el E2E, que da de alta un arquero por prueba desde una sola IP, se bloquea solo. En todo ambiente hosteado y bajo test sigue en 5.

### Decisiones (con link a ADR si corresponde)

- **Sin Nuqs:** el router ya valida y tipa los search params (`validateSearch` con Zod), asi que una segunda capa sobre lo mismo no aporta. La frontera de
  estado no cambia. Actualizados `ARQUITECTURA.md §5.1` y `apps/pwa/CLAUDE.md`.
- La version para `If-Match` sale de la cache, pero se **lee antes de mutar** (ver bugs).

### Verificado (como se probo, no solo "tests verdes")

- Logica pura con el set real "Hunter" del autor (20 m 0,3 · 30 m 0,8 · 40 m 1,6…); 50 marcas calculadas en < 16 ms (RNF-02, con test).
- Pantalla y hoja con un servidor falso con estado que **exige `If-Match`** como el real (13 tests); PWA 240, API 372, i18n 25; lint y typecheck limpios.
- E2E en la pila real (Mongo temporal, API, build de produccion) en 360 y 1440: 14/14, con el flujo completo cargar 3 marcas → estimacion en 35 m →
  reemplazo por 409 → recarga → borrar → Deshacer.

### Bugs que el E2E encontro y los tests unitarios no

1. **Guardar una marca en una distancia ya usada rompia la pantalla** ("Marks must have unique distances"): el guardado optimista metia el duplicado en la
   cache y el modelo lo rechaza. Ahora un alta sin `replace` en una distancia ocupada no escribe nada optimista; el 409 abre el dialogo.
2. **Borrar una marca salia sin `If-Match`** (428): el `onMutate` la sacaba de la cache antes de que `mutationFn` leyera su version. La version viaja ahora
   en las variables. El servidor falso del test ahora tambien lo exige.
3. El E2E de setups buscaba el titulo "Mira", que ya no existe: guardar un setup aterriza en su pantalla de la mira.

### Pendiente / deuda

- F1-10 (intermedias, curva y consulta libre), F1-11 (pantalla del Doctor), F1-14 (imprimir) y F1-15 (acceso rapido, con limpieza al borrar un setup).
- Cobertura de `features/sight` 89 % lineas: faltan ramas de teclado de la tabla y el 412 de la hoja de edicion (la API ya lo cubre).
- Las herramientas Viento/Clima son solo el boton; no hay spec de esas pantallas todavia.

---

## 2026-11-03 — Las marcas existen: se cargan, editan, borran y deshacen, y el resto del sistema las ve

**Tareas:** F1-07, y cierra la parte transaccional de F1-03 y de F1-05 · **Commit/PR:** rama `feat/f1-menu-marks` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **API (`calculator`):** `POST /marks`, `PATCH /marks/{id}`, `DELETE /marks/{id}`, `POST /marks/{id}/restore` y `GET /setups/{id}/marks?arrowSetId=`
  (el par completo, mas cercana primero, tope 500, sin paginar). Reglas: el setup es del arquero y esta vivo (404); el set de flechas es del setup
  (`SM-MARK-422-002`); la lectura cae dentro de la escala **de la mira leida en ese momento** (`SM-MARK-422-001` con minMm/maxMm; los extremos valen);
  distancia unica por par (`SM-MARK-409-001` con el id de la existente) y `replace: true` hace que la existente tome la nueva lectura (200, queda una sola);
  fecha no futura con 5 minutos de tolerancia; editar no cambia setup ni set de flechas, mover a una distancia ocupada es 409 salvo `replace`
  (que manda la otra a la papelera); borrar es blando y **deshacer** vale 30 dias (`SM-MARK-410-001`) y falla si la distancia se volvio a tomar.
- **Transacciones de verdad** (`core/db/transaction.ts`, `transactionAsyncLocalStorage`): lo que se escribe por los repositorios dentro de `transact(...)`
  confirma junto o no confirma, sin pasar sesiones por todos lados. Se usan en: alta con reemplazo, edicion con `replace`, **mandar un setup a la papelera
  con sus marcas y restaurarlo (RN-STP-06)** y **cambiar la escala de una mira con sus marcas (HU-SGT-02)**.
- **Puertos reales:** el conteo de marcas del Home, la regla RN-STP-05 (quitar un set con marcas), el uso de componentes (cuantas marcas pierde borrar un arco,
  una mira o un set; solo las de ese set de flechas) y el cambio de escala de una mira ya no son simulaciones: salen de la coleccion `marks`.
  `keepReadings` mueve cada posicion por `nuevoTamaño / viejoTamaño` en una sola actualizacion; `keepPositions` no toca nada; si algo quedaria fuera de la
  escala nueva se rechaza entero (`SM-SGT-409-002`).
- **Cascada y purga:** al restaurar un setup vuelven solo las marcas que se fueron con el (`deletedWithSetup`): una borrada antes por su cuenta sigue borrada.
  `purgeDeletedSetups` tambien elimina las marcas borradas hace mas de 30 dias.

### Decisiones

- `replace: true` conserva el id de la marca existente (sube su version) en vez de crear una nueva: asi queda una sola y el cliente toma la respuesta.
- El texto de "la fecha es futura" es la clave `validation.mark.measuredAtFuture` (ES/EN) sobre el campo `measuredAt`.

### Verificado

- API: **369 tests** (44 de marcas contra el replica set real, sin simular nada: alta, idempotencia ×3, extremos de la escala, 404/422/400 por campo, reemplazo,
  412/428, deshacer, cascada de papelera, uso de componentes, RN-STP-05, cambio de escala con `keepReadings`/`keepPositions`/rechazo, purga, aislamiento de las
  cinco rutas; mas 3 de la transaccion con rollback) con cobertura 96 %. E2E real 12/12 con la API nueva; lint y typecheck limpios.

### Pendiente / deuda

- La lectura de la escala y la escritura de la marca no son una sola operacion aislada: entre ambas otro dispositivo podria cambiar la escala de la mira (ventana de
  milisegundos; el cambio de escala, a su vez, revalida y reescribe las marcas que ya existen).
- Falta toda la interfaz de marcas: pantalla de la mira, regla, tabla y hoja de nueva marca (F1-08, F1-09).

---

## 2026-11-03 — El menu lateral: contadores, navegacion y cerrar sesion

**Tareas:** F1-06 · **Commit/PR:** rama `feat/f1-menu-marks` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `AppFrame` envuelve toda pantalla con sesion: encabezado con el boton del menu (44 px, siempre visible) y `NavDrawer`. El menu lista Tus
  setups, Arcos, Miras y Flechas **con su contador**, Estadisticas (deshabilitada, con "Proximamente": se anuncia como inactiva y no navega),
  Papelera, Apariencia, Cuenta, Cerrar sesion y la hora de la ultima sincronizacion. Marca la pantalla actual con `aria-current`.
- Foco atrapado y cierre con Escape vienen del `NavDrawer` de `@sight-mapper/ui` (ya probado ahi); aca se prueba el uso real.
- **Cerrar sesion:** `POST /api/auth/sign-out`, se olvida la sesion, se navega a sign-in y **despues** se vacia la cache de Query, para que ningun dato
  de un arquero quede en memoria para el siguiente en el mismo dispositivo. Si falla, el menu sigue abierto y lo dice.
- El estado "menu abierto" es Zustand (`ui-store.ts`): UI efimera, nada del servidor.

### Decisiones

- Los contadores son la cantidad de activos de cada lista (hasta 100): no hay un endpoint de totales y no hace falta para el MVP.
- Vaciar la cache va despues de navegar: hacerlo antes dejaba a las consultas del propio encabezado volver a pedir datos.

### Verificado

- 9 tests del menu (cerrado por defecto, contadores 2/1/3, Estadisticas inactiva, Escape y foco, navegacion y `aria-current`, cuenta y apariencia,
  cerrar sesion completo y su falla, ingles); PWA 190 tests; E2E real 12/12; lint y typecheck limpios.

### Pendiente / deuda

- `/profile` sigue siendo un placeholder (F1-16: exportar datos y baja).

---

## 2026-11-02 — El arquero arma setups, los ve en el Home y los manda a la papelera

**Tareas:** F1-05 · **Commit/PR:** rama `feat/f1-setups` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **API (`calculator`, segundo modulo con negocio):** `GET/POST /setups`, `GET/PATCH/DELETE /setups/{id}`, `archive`/`unarchive`,
  `GET /setups/trash` y `POST /setups/{id}/restore`. Un setup junta 1 arco, 1 mira y 1..N sets de flechas del arquero y **activos**
  (`SM-STP-422-001`, con el tipo y el id que fallo); el par (arco, mira) es unico entre los vivos (`SM-STP-409-001`, con el setup que lo tiene);
  editar admite nombre, favorito y flechas (agregar exige activas; quitar una con marcas se rechaza, `SM-STP-409-002`; arco y mira nunca cambian).
  El Home ordena favoritos primero y luego la ultima edicion, con cursor propio. Cada setup sale con su arco, su mira (con escala), sus
  flechas y la cantidad de marcas.
- **Papelera:** borrar manda a la papelera (soft delete, `If-Match`), `/trash` dice cuando se elimina (+30 dias), restaurar dentro de los 30 dias
  o `SM-STP-410-001`, y si otro setup tomo el par mientras tanto la restauracion falla con `SM-STP-409-001`. El job diario
  `purgeDeletedSetups` borra de verdad lo que lleva mas de 30 dias (cruza arqueros por el driver, idempotente).
- **Puertos reales:** `EquipmentReadPort` (el calculador lee equipo) y el conteo de uso (equipo le pregunta al calculador) se cablean en
  `composition-root.ts` sin que ningun modulo importe al otro. Con eso el borrado protegido de arcos, miras y flechas **ya ve los setups**:
  responde 409 con cuantos setups y marcas dependen del componente (un setup archivado sigue contando; uno en la papelera, no).
- **PWA:** Home (`/`) con tarjetas y estrella optimista, `/setups/new` (select de arco y mira, casillas de flechas, "+ Cargar uno nuevo",
  oferta de agregar las flechas al setup existente), `/setups/{id}/edit` (par fijo, nombre, flechas, archivar, mandar a la papelera) y `/trash`.

### Decisiones

- Las marcas llegan en F1-07: `SetupMarksPort` responde "ninguna" hoy, y las reglas que dependen de ellas ya preguntan a traves del puerto
  (conteo del Home, RN-STP-05, uso de componentes). La cascada de papelera a marcas (RN-STP-06) y su purga quedan para esa tarea.
- La estrella serializa los cambios (`scope`) y toma la version de la cache cuando le toca, para no chocar con su propia version.

### Verificado

- API: 322 tests (33 nuevos: crear con equipo real, ordenes del Home y paginado con favoritos, 409/422/412/428, borrado protegido contra setups
  reales, papelera con 30 dias, job de purga, aislamiento de las nueve rutas = test no negociable #4) con cobertura 96 %.
- PWA: 181 tests; **E2E real, 12 de 12 en 360 y 1440**, incluido el flujo nuevo: registrarse, cargar arco, mira y flechas, armar el setup,
  favorito, par repetido rechazado, arco en uso que no se borra, papelera y restaurar.

### Encontrado por el E2E (no lo veian los tests con `fetch` falso)

- Un **POST sin cuerpo** (archivar, desarchivar, restaurar) contra el servidor real daba `SM-CORE-415-001`: Node entrega siempre un stream para
  un POST y el middleware lo tomaba por un cuerpo sin tipo. Ahora un `Content-Length: 0` cuenta como "sin cuerpo". Afectaba a **todas** las
  acciones de archivar desde que se hicieron; hay un test que falla sin el arreglo.

### Pendiente / deuda

- `SM-STP-422-002` (quedar sin flechas) no se emite: el schema compartido ya lo rechaza como 400 antes de llegar al caso de uso.
- El acceso rapido (RN-STP-07, "si su setup se borra, se limpia") entra con F1-15.
- Falta la pantalla de la mira (`/setups/{id}`, hoy placeholder) y el menu lateral con el acceso a miras/arcos/flechas (F1-06).

---

## 2026-11-02 — Arcos y miras pasan a las piezas comunes del equipo

**Tareas:** refactor de F1-02, F1-03 y F1-04 · **Commit/PR:** rama `refactor/equipment-shared` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- Arcos y miras dejan de tener su propio repositorio, listar/leer/archivar/borrar y siete rutas: usan `createComponentRepositories`,
  `createComponentUseCases` y `registerComponentRoutes`, igual que los sets de flechas. Cada tipo conserva solo lo suyo: los campos, el alta y
  la edicion (arco: solo compuesto y nunca sin nombre; mira: la escala y la estrategia de cambio).
- El repositorio generico aprendio una sola cosa: `store`, un gancho para dar forma a un valor antes de guardarlo (la escala de la mira se
  guarda sin `null`).
- Se borran 8 archivos de casos de uso y se achican repositorios y rutas: **126 lineas nuevas, 875 borradas**.

### Decisiones

- Sin cambios de comportamiento ni de contrato: los 289 tests de API pasan **sin editar ninguno**, incluida la suite de aislamiento y las rutas
  de OpenAPI.

### Verificado

- API: 289 tests, cobertura 97 %; lint y typecheck limpios. La PWA no se toca.

### Pendiente / deuda

- `ComponentUsagePort`, `SightUsagePort` y `ArrowSetUsagePort` son tres puertos casi iguales: F1-05 los junta cuando el calculador los implemente.

---

## 2026-11-02 — El arquero carga sus sets de flechas y el equipo comparte sus piezas

**Tareas:** F1-04 · **Commit/PR:** rama `feat/f1-arrows` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **API (`/api/v1/arrow-sets`):** las siete rutas del equipo (listado por cursor, alta idempotente, detalle con `usage`, PATCH con
  `If-Match`, archivar/desarchivar, borrado blando protegido por `SM-ARW-409-001`). Solo el nombre es obligatorio; el resto es
  "dejá vacío lo que no mediste", y `null` en un PATCH borra el campo (el nombre no se puede borrar).
- **Piezas compartidas, escritas una sola vez** (ya se habia copiado dos veces con arcos y miras): `ComponentRepository` y
  `createComponentRepositories` (persistencia plana con cursor, version y soft delete), `createComponentUseCases` (leer, listar, archivar,
  borrar protegido) y `registerComponentRoutes` (las siete rutas con su OpenAPI). Un set solo agrega sus campos y su alta/edicion.
- **PWA:** `/arrows`, `/arrows/new`, `/arrows/{id}`. Formulario con los datos principales y pesos a la vista y "Más datos" plegable
  (vanes, nock, velocidad medida, notas). Unidades por sistema: g / mm / m·s⁻¹ o gr / in / fps (con fracciones de pulgada); spine, GPI y
  cantidad de vanes no se convierten. `units.ts` junta la conversion que antes vivia dentro del formulario de arcos, que ahora la usa.

### Decisiones

- Los arcos y las miras ya usan las piezas genericas del API (migrados en `refactor/equipment-shared`; los tests de
  arcos y miras son 56 y no se tocaron).
- Pesos en metrico: **g**; imperial: **gr** (UNIDADES §1, propuesta inicial; spec §17.2 sigue abierta).

### Verificado

- API: 289 tests (21 nuevos de sets: solo nombre, medidas opcionales, idempotencia ×3, 409/400 por campo, paginado, 412/428, nulos, archivar,
  borrado protegido y blando, aislamiento) con cobertura 97 %.
- PWA: 162 tests (10 de la logica con conversiones a mano — 29 1/8 in = 739,775 mm, 100 gr = 6,4799 g, 270 fps = 82,296 m/s — y 11 de pantallas).

### Pendiente / deuda

- ~~Migrar bows y sights a las piezas genericas~~: hecho en la entrada siguiente de arriba.
- Falta correrlo a mano en el navegador y un E2E que cargue arco, mira y flechas.
- Siguiente: F1-05 (setups, Home y papelera), que da la implementacion real de `ComponentUsagePort`.

---

## 2026-11-02 — El arquero carga su mira con su escala real y la cambia sin perder marcas

**Tareas:** F1-03 · **Commit/PR:** rama `feat/f1-sights` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **API (`equipment`):** las miras con el mismo patron que los arcos (listado por cursor, alta idempotente, detalle con `usage`, PATCH con
  `If-Match`, archivar/desarchivar, borrado blando protegido por `SM-SGT-409-001`) mas la escala. Un cambio de unidad o de tamaño de
  unidad en una mira con marcas pide `scaleChangeStrategy` (`keepReadings` / `keepPositions`, `SM-SGT-409-003`); un cambio que deja marcas
  fuera de la escala se rechaza entero (`SM-SGT-409-002`, con cuantas y el nuevo rango en mm). Cambiar solo rango, resolucion o direccion no
  pide nada. La escala se guarda y se reemplaza como un valor entero.
- **`SightMarksPort`** (`count`, `countOutside`, `rescale`) lo declara `equipment` y hoy no ve marcas; `createContainer` lo recibe inyectado.
- **PWA:** `/sights`, `/sights/new`, `/sights/{id}`. El formulario tiene unidad (mm, cm, in, clicks, personalizada), minimo, maximo, paso, direccion,
  tipo de pin; para click/personalizada, el tamaño de una unidad **o** el largo fisico entre minimo y maximo (1 a 9 sobre 80 mm = 10 mm),
  el recorrido en mm, el aviso "sin tamaño de unidad" y la **vista previa de la regla** (el mismo `Ruler` del dominio). Si la API pide estrategia,
  abre una hoja con las dos opciones y reenvia.

### Decisiones

- `SM-SGT-422-001` (fijar tamaño en mm/cm/in) queda sin uso: lo cubre el schema compartido, que lo rechaza como 400 en el campo `unitSizeMm` antes de
  llegar al caso de uso. Hay que decidir si se borra el codigo de errors.md o si el schema pasa a 422.
- `scaleMeaningChanged` mira unidad y tamaño efectivo: pasar de `cm` a `mm` cambia el significado de una lectura aunque el rango sea el mismo.

### Verificado

- API: 268 tests (27 nuevos: escala custom/click/direccion, validaciones por campo, idempotencia ×3, estrategia, marcas fuera de rango sin escribir nada,
  412/428, borrado protegido, aislamiento) con cobertura 97 %.
- PWA: 141 tests (20 de la logica del formulario con valores a mano, 13 de pantallas); lint y typecheck limpios.

### Pendiente / deuda

- **El cambio de escala y la reescritura de marcas todavia no son una sola transaccion:** no hay marcas hasta F1-07. Cuando existan, `updateSight` y
  `rescale` deben correr en una transaccion y el test no negociable #5 (HU-SGT-02) debe probarlo con marcas reales.
- Falta correrlo a mano en el navegador y un E2E de arco + mira.
- El patron de `equipment` ya se copio dos veces: al llegar a las flechas (F1-04) conviene extraer repositorio, rutas y casos de uso genericos.

---

## 2026-11-02 — El arquero carga, edita, archiva y borra sus arcos

**Tareas:** F1-02 · **Commit/PR:** rama `feat/f1-bows` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **API (`equipment`, primer modulo con negocio):** `GET/POST /bows`, `GET/PATCH/DELETE /bows/{id}`, `POST /bows/{id}/archive|unarchive`.
  Listado paginado por cursor opaco `(updatedAt, _id)` (`core/db/cursor.ts`), `active` por defecto y el mas reciente primero; alta
  idempotente con `id` del cliente; PATCH con `If-Match` (`null` borra un campo; dejar sin fabricante *y* sin modelo es 400);
  archivar/desarchivar como transiciones; borrado blando que un arco usado por setups rechaza con `SM-BOW-409-001` (con
  `setups` y `marks`). Solo compuesto por ahora (`SM-BOW-422-001`).
- **`ComponentUsagePort`** lo declara `equipment` y hoy responde cero; `createContainer` lo recibe inyectado, asi que cuando
  exista `calculator` (F1-05) solo cambia el cableado.
- **Aislamiento:** los siete endpoints tienen su ataque (`tests/attacks/bows.ts`) y `tests/attacks/index.ts` junta los de todos los
  modulos para que el registro completo se verifique contra el contenedor real.
- **PWA:** `/bows` (activos/archivados, estado vacio, carga y error, archivar desde la lista), `/bows/new` y `/bows/{id}` (formulario en tres
  secciones, unidades por sistema: mm/kg/m·s⁻¹ o in/lb/fps con fracciones `6 1/4`, validado con el mismo schema que la API, borrar con
  confirmacion y, si hay setups, `Archivar en su lugar`). El formulario espera al perfil para no cambiar de unidad bajo los dedos.

### Decisiones

- Unidades de equipo: metrico en **mm / kg / m·s⁻¹**, imperial en **in / lb / fps** (la propuesta inicial de UNIDADES §1; sigue abierta en spec §17.2).
- La logica del formulario (`bow-form.logic.ts`) es pura y se prueba aparte: texto → canonico (`toCanonical`/`parseImperial`) → schema compartido.
- Borrar un arco no tiene "Deshacer": no hay `restore` para equipo en la API; el borrado pide confirmacion y lo usado se archiva.

### Verificado

- API: 241 tests (29 nuevos de arcos: alta, idempotencia ×3, 409/422/400 por campo, paginado sin repetir ni saltear, 412/428, nulos, archivar,
  borrado protegido y blando, aislamiento) con cobertura 97 %.
- PWA: 108 tests (16 de la logica del formulario con valores calculados a mano, 13 de pantallas); lint y typecheck limpios.

### Pendiente / deuda

- Probar el flujo en el navegador y con el E2E real (no se corrio en esta tarea).
- El formulario no muestra aun el aviso "Alguien lo cambio antes" con los datos nuevos en pantalla: el 412 refresca la cache y el error se ve arriba.
- Faltan sets de miras y flechas (F1-03, F1-04): el patron de `equipment` esta listo para repetirse.

---

## 2026-11-02 — El arquero elige tema, idioma y unidades, y la eleccion lo sigue a otro dispositivo

**Tareas:** F1-01 · **Commit/PR:** ramas `feat/f1-preferences` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **API (`account`):** `GET /api/v1/me` devuelve el perfil (preferencias, acceso rapido, baja pedida, `version`) y lo crea
  en la primera lectura con el idioma del navegador (es → metrico, en → imperial); `PATCH /api/v1/me/preferences` cambia solo
  lo enviado, exige `If-Match` (412 con la version actual si quedo vieja, 428 si falta) y responde con el `ETag` nuevo.
  Las dos rutas entran en la suite de aislamiento (`tests/attacks/account.ts`) y se prueban contra un replica set real.
- **PWA:** pantalla *Apariencia* (`/settings/appearance`) con tema, idioma y unidades, y el pie de pagina tambien guarda en el
  perfil cuando hay sesion. El cambio se ve al instante (cache optimista de Query), se guarda detras con la version que
  tiene la cache, los cambios rapidos van en serie (`scope`) para no chocar con su propia version, y si falla vuelve
  atras y explica por que. `ProfileSync` toma tema e idioma del perfil al entrar (ADR-004).

### Decisiones

- El perfil no lleva `id` ni `userId` en el cable: es el de la sesion (ADR-000), y por eso el cliente usa hooks propios y no
  `createResourceHooks`.
- `PreferencesPatch` admite `undefined` por clave (`exactOptionalPropertyTypes`) y el repositorio descarta esas claves: Mongo no
  guarda nulls por accidente.

### Verificado

- API: 212 tests (14 nuevos de `/me`: defaults por idioma, un perfil por arquero, 412/428/400, sin sesion → 401, aislamiento).
- PWA: 79 tests (7 nuevos: preferencias del perfil mandan sobre el dispositivo, cambio al instante, idioma sin recargar,
  unidades, dos cambios seguidos con versiones 1 y 2, rollback con error, pie de pagina).

### Pendiente / deuda

- Las unidades todavia no cambian ningun numero en pantalla: eso es F1-12 (sistema imperial completo).
- `minClientVersion` de `GET /me` (TECNICO §9) no esta; entra cuando haya un criterio para forzar actualizar.

---

## 2026-11-01 — La PWA tiene esqueleto y pantallas de auth: tema, idioma, rutas con guard y service worker

**Tareas:** F0-17 · **Commit/PR:** rama `feat/f0-pwa` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `apps/pwa` con Vite 8 + React 19 + Tailwind v4 (tokens y tema de `@sight-mapper/ui`), TanStack Router file-based
  (todas las rutas de FUNCIONAL §1.1 como placeholders con su titulo), TanStack Query + `ClientProvider`.
- **Guard por sesion:** `_app` exige sesion (`GET /api/auth/get-session` via Query, una consulta por sesion de uso) y manda a
  `/sign-in?redirect=`; `_guest` saca de sign-in/sign-up a quien ya entro. `safeRedirect` solo admite rutas de la app (no hay open
  redirect). Un 401 de la API invalida la sesion y re-corre los guards.
- **Tema** dark/light/sistema (Zustand + `localStorage` con `try/catch`; script en `index.html` aplica el tema antes del primer
  pintado) e **idioma** ES/EN, ambos desde un pie siempre visible, tambien antes de entrar. Version visible.
- **PWA:** `vite-plugin-pwa` con `registerType: 'prompt'`, manifest, iconos generados por `scripts/make-icons.mjs` (sin
  dependencias), `UpdateBanner` ("Hay una version nueva · Actualizar"), `/api/*` nunca sale del cache.
- Errores: `RouteError` por ruta (mensaje traducido desde `messageKey`, reintentar que re-corre los guards, `requestId`),
  `NotFound`, `Splash` (la primera carga no deja pantalla en blanco mientras el guard consulta).
- Claves ES/EN nuevas: `app`, `theme`, `language`, `screens`, `auth`, `validation.auth.*`.
- **Pantallas de auth** (TanStack Form + Zod compartido): sign-in (email **o** usuario, mostrar/ocultar clave, `?redirect=`), sign-up (errores
  409 en el campo que corresponde), forgot (misma respuesta exista o no el email), reset (token del enlace, enlace muerto → "Pedir otro"),
  verify (con sesion = verificado; `?error=` = enlace fallido + reenviar). `@sight-mapper/schemas` suma `signUpForm`, `signInForm`,
  `emailForm`, `resetPasswordForm` (mismas cotas que la API); `toValidationIssues` ahora acepta una clave `validation.*` como mensaje de
  cualquier chequeo, no solo de `custom`.
- Los enlaces de los emails abren la API, que verifica y redirige a `/verify-email` (con la sesion ya abierta) o a `/reset-password?token=`
  (`?error=` si fallo): `callbackURL`/`redirectTo` salen del origen de la PWA.

### Decisiones

- **i18n propio, no `react-i18next`:** `@sight-mapper/i18n` ya da claves y params tipados y `translateKey`; un `I18nProvider` de 30
  lineas lo expone. Una libreria mas no sumaba nada. Se actualizo TECNICO §1 (esto cierra la nota "react-i18next en F0-17").
- `/api` por el proxy de Vite en desarrollo: mismo origen, la cookie de sesion no necesita CORS.

### Verificado

- 72 tests de la PWA (guard con y sin sesion, redirect seguro, reintento, 404, pie con tema e idioma, banner de
  actualizacion y los cinco flujos de auth con `fetch` falso, en ES y EN) con cobertura 98 % lineas; lint, typecheck y `vite build` limpios (SW con 41 entradas precacheadas).
- Dev server en el navegador integrado: splash, y error traducido con "Reintentar" cuando la API esta apagada.

### Pendiente / deuda

- Etapa 3 hecha: `pnpm dev:local` (Mongo temporal + migraciones + API + PWA; imprime los links de los emails) y `/sandbox` (solo en desarrollo: regla SVG con los dos sets reales, tabla, Mark Doctor y catalogo de componentes, visto en el navegador). El flujo real registro → link → verificado se probo a mano contra la API.
- **E2E con Playwright** (Chromium descargado con permiso; 360 y 1440): registro → link del email (`dev:local` lo escribe en `SM_DEV_MAIL_FILE`) → verificado → Home → login por usuario, y clave mala sin decir que parte fallo. **Instalable:** Lighthouse 13 ya no tiene categoria PWA, asi que se le pregunta a Chrome (`Page.getInstallabilityErrors`) sobre el build: sin errores, manifest standalone con iconos maskable, SW activo y `/api/*` fuera del cache. 10 tests, pasan.
- Queda fuera de F0-17 el boton "Entrar con Google": depende de la consola de Google (F0-20).
- Corregido de paso: el script `migrate` del API usaba una opcion inexistente de migrate-mongo 14 y nunca habia corrido.
- Falta el boton "Entrar con Google": necesita la consola de Google (F0-20) y saber si el proveedor esta activo.
- Lighthouse instalable y E2E de registro → verificacion → login necesitan Chrome/Playwright (descarga, pedir permiso).

---

## 2026-11-01 — Suite de aislamiento sobre el registro de rutas y scheduler con lock por ventana

**Tareas:** F0-16 · **Commit/PR:** rama `feat/f0-isolation-jobs` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- **Suite de aislamiento** (test no negociable #1): `checkIsolation` recorre el registro de rutas; toda ruta con
  `auth: session` necesita un *ataque* (el arquero B intenta alcanzar lo que hizo A). Una ruta sin ataque, un ataque
  de una ruta que no existe y un ataque que revienta son violaciones. `expectForeign404` exige 404 `SM-CORE-404-002`:
  ni 403 ni el dato. `productionAttacks` esta vacio hoy (no hay rutas de negocio) y cada modulo suma los suyos.
- **API de ejemplo** con las cinco formas de ruta (crear, listar, leer, editar, borrar) en dos versiones: `scoped` y
  `leaky` (una tabla para todos). Prueba que la suite detecta el error clasico.
- **Scheduler** `core/jobs`: `runDue()` (un tick), `start()` / `stop()`, lock por job en `jobLocks` y fila en
  `jobRuns`. Primer job: `purgeIdempotencyKeys` (cada hora, devuelve cuantas borro). Cableado en el contenedor y en
  `main.ts` (arranca con el servidor, se detiene al apagar, `unref` para no retenerlo).

### Decisiones

- **El lock dura hasta el fin de la ventana**, no hasta que el job termina: es una sola escritura atomica que solo
  coincide con un lock vencido, y insertar sobre uno vivo choca con la unicidad de `_id`, que significa "lo tiene otro".
  Asi corre una vez por ventana aunque termine rapido, y una instancia mas lenta no lo repite. Si el dueño cae, la
  ventana siguiente lo corre otra vez: por eso los jobs son idempotentes. TECNICO §13 actualizado.
- `jobRuns.error` guarda el mensaje, no el stack: la coleccion se puede consultar; el stack va al log.
- `purgeIdempotencyKeys` usa el driver y cruza usuarios a proposito (borra por vencimiento, no lee nada de nadie). El
  indice TTL ya hace lo mismo cada minuto sin dejar rastro; el job lo hace visible y sirve donde el monitor TTL este apagado.

### Verificado

- 198 tests de API (95.6% de lineas, 88% de ramas; umbral 80%). Criterios del plan: una ruta de sesion sin fixture hace
  fallar la suite (y la unica ruta sin ataque es la que se nombra); con dos instancias el job corre **una sola vez** por
  ventana, y con cinco compitiendo tambien (contra Mongo real).
- La ventana abre exactamente cuando vence el lock (59.999 s no, 60 s si); cada job tiene su lock; un job que falla se
  registra con su mensaje, no frena a los demas y no se reintenta dentro de la ventana; `start()` dos veces no crea dos
  timers y `stop()` detiene los ticks.
- La suite pasa sobre la API `scoped` y marca las cinco rutas de la `leaky`; el job borra las llaves vencidas de todos
  los arqueros, conserva las vivas y la que vence justo ahora, y es idempotente.

### Pendiente / deuda

- Sin rutas de negocio la suite todavia no prueba nada real en produccion: se vuelve exigente con F1-02 en adelante.
- La suite no comprueba "sin sesion = 401" por ruta; eso lo cubre el test del middleware (`auth.test.ts`).
- Falta el resto de los jobs de la spec §12 (`purgeDeletedSetups`, `purgeDeletedAccounts`, retencion de `jobRuns`): llegan con F1.

---

## 2026-11-01 — Autenticacion: registro, verificacion, login por email o usuario, reset y sesion

**Tareas:** F0-15 (parcial: Google configurado pero sin probar) · **Commit/PR:** rama `feat/f0-auth` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `core/auth`: Better Auth 1.7 sobre Mongo (adaptador con transacciones): email + contraseña (minimo 8),
  plugin `username` (3–30, `[a-z0-9._]`), **verificacion obligatoria** antes de la primera sesion, reset por
  enlace de un solo uso de 1 h que revoca las demas sesiones, cookie `httpOnly` `SameSite=Lax`, limite de
  intentos (5 en 15 min por IP en login, registro, recupero y reenvio), Google si estan las dos variables.
- `/api/auth/*` responde en nuestro envelope: los errores de Better Auth pasan a `SM-AUTH-*` o `SM-CORE-*`
  (`toAuthError`), sin prosa del proveedor; los exitos (cookies, redirecciones) pasan tal cual.
- `sessionMiddleware`: la cookie se vuelve `ctx.userId` bajo `/api/v1/*`, y es el unico lugar donde entra una
  identidad. Sin sesion, `SM-CORE-401-001` (salvo `openapi.json`).
- Emails ES/EN (`email.*` en los catalogos) con un puerto `EmailSender`: Resend por HTTP en staging y prod; en
  local sin clave, el enlace se escribe en el log.
- `modules/account`: `UserRegistered` → `ensureProfile` (idempotente, con la carrera resuelta por el indice
  unico). Locale del navegador → metrico para `es`, imperial para `en`; tema `system`.
- Variables nuevas validadas al arrancar (`BETTER_AUTH_SECRET` ≥ 32, `BETTER_AUTH_URL`, Google, Resend, `EMAIL_FROM`):
  fuera de `local` el email real es obligatorio. Segunda migracion con los indices de `user`, `session`, `account`
  y `verification` (username unico solo si existe, TTL de sesiones y verificaciones).
- `api` ahora depende de `i18n` (grafo, ARQUITECTURA §3.1 y ESLint actualizados primero).

### Decisiones

- **Registrar un email que ya existe devuelve exito generico** (Better Auth lo hace y hashea la contraseña igual,
  para que ni el tiempo delate la cuenta). Mi test esperaba un 409 y lo corregi: es mejor que mi diseño.
  `SM-AUTH-409-001` queda sin emitirse con verificacion obligatoria (nota en errors.md y ADR-007).
- El limite es por IP y ruta (lo que ofrece Better Auth, ADR-007), no por identificador como decia TECNICO §4.
- El email se envia **sin esperarlo**: un servidor de correo lento no delata que direcciones existen. Un fallo se
  loguea y el arquero puede pedirlo de nuevo.
- Los logs de Better Auth (traen emails en info) pasan por Pino con redaccion, solo warn y error.
- El perfil se crea por evento pero **no es obligatorio que el evento funcione**: `ensureProfile` es idempotente y se
  vuelve a llamar donde haga falta, asi un fallo al registrarse no deja una cuenta sin perfil para siempre.

### Verificado

- 172 tests de API. Criterios del plan: registro valido → `user`, `profile` y un email (verificado en la base);
  login por email y por username funcionan, sin verificar da `SM-AUTH-403-001`; con 5 fallos el siguiente es
  `SM-CORE-429-001` con `retryAfterS` (y ni la clave correcta pasa, y otra IP no se ve afectada); ningun log
  contiene contraseñas, token de sesion ni token del enlace, a lo largo de un ciclo completo de cuenta.
- La sesion: sin cookie 401; cookie falsa 401; con cookie el id es el del arquero aunque el path y el query traigan
  otro `userId`; dos arqueros, dos ids; cerrar sesion la invalida; reset revoca las sesiones previas y el enlace es
  de un solo uso.
- **Arranque real** (`dist/main.js`, Mongo temporal, HTTP de verdad): 401 sin sesion → registro → enlace en el log →
  login antes de verificar da 403 → verificar (302 al callback) → login por email y por usuario → cookie
  `httpOnly` y `SameSite=Lax` → `get-session` → perfil en la base → la contraseña no aparece en el log.
- Bugs que cazaron los tests: `BY_CODE[constructor]` resolvia por la cadena de prototipos (ahora `Object.hasOwn`);
  el hook de secretos bloqueo mi propio literal de prueba (se arma en runtime).

### Pendiente / deuda

- **Google** esta cableado pero **sin probar**: necesita la consola de OAuth y el dominio (F0-20).
- Rate limit en memoria: con mas de una instancia cada una cuenta aparte; si se escala, pasar a base de datos.
- `X-Forwarded-For` se confia tal cual: vale solo detras del proxy de Railway.
- El enlace de verificacion apunta a la API y redirige al `callbackURL` de la PWA; las pantallas son F0-17.
- `GET /me` y las preferencias (F1-01) usaran `ensureProfile`.

---

## 2026-10-31 — Mark Doctor calibrado con datos reales: el desvio estimado de los datos no servia

**Tareas:** F0-06, F0-21 · **Commit/PR:** rama `feat/f0-doctor` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `@sight-mapper/domain/doctor` ([SIGHT-MATH.md](domain/SIGHT-MATH.md) §7–8): `diagnose(marks, { direction, quantumMm })`.
  Monotonia desde 2 marcas (cada par fuera de sentido o igual es `inconsistent` sobre **ambas**) y residuos
  leave-one-out contra una parabola ajustada sin la marca, desde 5. Devuelve `status`, `level`
  (`none` / `monotonicity` / `full`), residuo y umbral de cada marca, la peor (`suspect`, "volver a tirar"),
  las secundarias y los pares rotos.
- Fixtures reales del autor (F0-21): `packages/domain/test/fixtures/real-sets.json` — Gold Tip Hunter 400
  (bueno) y Gold Tip Pierce 400 (dudoso), mira de 0 a 10 cm, paso de 1 mm, 20–60 m. Solo distancia, lectura y escala.

### Decisiones

- **Umbral absoluto, no derivado de los datos.** La spec preveia `K·σ` con MAD de los propios residuos. Con 5
  marcas no hay `K` que sirva (medido): con `K ≤ 1` acusa casi todo (338 de 402 sets limpios con `K = 0.5`) y con
  `K ≥ 1.5` no detecta ni un error de ±1 unidad: la marca mala arrastra las otras cuatro, el desvio estimado
  sube y tapa al error. Se descarto `DOCTOR_K`; queda `DOCTOR_MIN_ABS_MM = 4` (o el quantum) y
  `DOCTOR_ENDPOINT_FACTOR = 2.5`. La spec (§8, decision abierta 3) se actualizo primero.
- **Tolerancia fisica en mm:** un set muy ruidoso señala varias marcas, en vez de volver el umbral relativo a un ruido que no se puede medir bien.
- **Pierce: el autor duda de la marca de 40 m, y el Doctor no puede señalarla.** Es la mas desviada de las interiores
  (1.17 mm), pero casi igual que la de 50 m del set bueno (1.05 mm): ninguna tolerancia las separa sin acusar tambien
  al set bueno. El test lo fija asi: estado `ok`, el ranking apunta a 40 m, y el desvio esta bajo la tolerancia.
- Distancias e ids repetidos en el Doctor son `DomainError` (bug de quien llama).

### Verificado

- 247 tests de domain (99.7% lineas). Criterios del plan: el set bueno da `ok` con todos los residuos bajo su
  umbral; `±10 mm` inyectado en cada marca interior de Hunter → esa marca es `suspect` y la peor (6 de 6),
  ±5 mm en la del medio tambien, y ±1/±2 mm no se acusan; una marca mas lejana con lectura menor, con
  `direction = down`, da `inconsistent` con ambas marcas.
- Barrido de calibracion con ruido uniforme de ±1.5 mm (602 sets): 2 falsos positivos con 4 mm / ×2.5; deteccion
  interior 12/12 con ±10 mm, 10/12 con ±5, 6/12 con ±4, 2/12 con ±3.
- Propiedades con fast-check: datos exactamente sobre una parabola creciente nunca se acusan; con ±1 mm de ruido
  y pendiente realista tampoco; el informe es coherente para cualquier entrada.
- Una propiedad encontro que con pasos menores que el ruido el orden se invierte y la monotonia acusa con razon:
  el generador se acoto a pasos reales (≥ 8 mm por 10 m).

### Pendiente / deuda

- **Solo 2 sets de 5 marcas.** Recalibrar con mas sets, sobre todo uno con un error evidente (y con mas de 5 marcas,
  donde un desvio estimado podria volver a servir).
- Los extremos casi no se pueden juzgar por residuo con 5 marcas: un error grande ahi lo detecta la monotonia.
- Un error de 1–2 mm con 5 marcas no se distingue del ruido normal; para esos casos hace falta mas informacion
  (mas marcas, o repetir el tiro de esa distancia).
- La pantalla del Doctor es F1-11.

---

## 2026-10-31 — Herramientas del repo para Claude: agentes, comandos, hooks y CLAUDE.md locales

**Tareas:** F0-03 (y dos fixes del review de seguridad: cliente y CI) · **Commit/PR:** rama `feat/f0-claude-config` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `.claude/hooks/guard-write.mjs` (PreToolUse sobre Write/Edit/MultiEdit): **bloquea** el contenido con
  forma de secreto (AWS, clave privada, Google, GitHub, Slack, Stripe, Resend, credenciales en una URL de
  conexion, asignaciones `SECRET=...`) y **pide confirmacion** antes de tocar `docs/spec/` y
  `packages/domain/src/`. `.claude/hooks/format.mjs` (PostToolUse) corre Prettier sobre lo escrito.
- Agentes de rol cerrado: `spec-reviewer`, `domain-reviewer`, `security-reviewer` (solo lectura) y
  `test-writer`. Comandos: `/adr`, `/bitacora`, `/new-task`, `/new-module`.
- `scripts/new-adr.mjs`: lo que hace `/adr` (numera, crea desde la plantilla, agrega al indice).
- `CLAUDE.md` en `apps/api`, `apps/pwa` y `packages/domain` con las reglas de cada zona.
- `pnpm test:scripts` (tests del script y de los hooks) y su paso en el CI.
- Fixes del review automatico: cliente (ids y acciones codificados en la ruta, rutas con `..`, `?`, `#`
  rechazadas; `ApiError` guarda el status HTTP real, un 401 sin envelope dispara `onUnauthenticated` y un
  4xx sin envelope no se reintenta) y CI (todas las acciones fijadas por SHA de commit).

### Decisiones

- El guard de secretos **no tiene archivos exentos**: ni tests, ni docs, ni `.env.example`. Los tests arman
  las claves falsas en tiempo de ejecucion (`AKIA + ...`) para que el literal no exista. El mensaje nunca
  repite lo encontrado.
- **Segunda pasada (review automatico de los hooks).** El guard de escritura es una comodidad del editor, no
  la barrera: un comando de shell, un IDE o un pegado escriben sin pasar por el. La barrera real es
  `scripts/scan-staged-secrets.mjs` en el pre-commit (mira solo las lineas agregadas del diff y reporta
  archivo y linea, nunca el texto) mas gitleaks en el CI. El guard ahora mira el **archivo resultante**
  (aplica `old_string`/`new_string` y MultiEdit) y bloquea solo secretos **nuevos**, asi un secreto partido
  en dos ediciones no pasa y un archivo que ya tenia uno no queda inutilizable; las rutas se resuelven contra
  el proyecto (`..`, `./`, barras, mayusculas) antes de comparar; el formateo no sale del proyecto.
- Un hook que no puede leer su entrada **deja pasar**: un hook roto no debe trabar el editor.
- Un secreto en `docs/spec` o en el dominio se **bloquea**, no se pregunta.
- `/trello-sync` no se crea: no hay tablero (F0-04 bloqueada).
- ESLint permite `Date` en `scripts/` y `.claude/` (la fecha de un ADR); en codigo de app sigue prohibido.

### Verificado

- 59 tests de tooling (41 + 18 de la segunda pasada: secretos partidos, rutas, formateo acotado, escaner de diff;
  ademas se probo a mano: un secreto falso en staging hace salir al escaner con 1 y la limpieza con 0). Primera version, 41 tests: 10 del script de ADR (numeracion, slug sin acentos, plantilla, indice, en un
  directorio temporal que no toca el repo) y 31 de los hooks (cada patron de secreto bloquea con salida 2
  sin repetir el valor; contenido normal, placeholders y URLs con `${...}` pasan; las rutas sensibles
  devuelven `permissionDecision: ask`; entrada ilegible no bloquea). Criterios del plan: un string con forma
  de API key bloquea la escritura; `/adr "titulo"` crea `docs/adr/NNN-titulo.md` y lo indexa.
- **No** se probo en vivo dentro de Claude Code que el `settings.json` cargue los hooks (se leen al iniciar
  la sesion): hay que abrir una sesion nueva y escribir una clave falsa para ver el bloqueo.

### Pendiente / deuda

- Probar los hooks y los comandos en una sesion nueva.
- El patron de asignacion (`SECRET = "..."`) puede dar falsos positivos con ejemplos largos: ajustar con uso.
- `/trello-sync` cuando F0-04 se desbloquee.

---

## 2026-10-30 — CI en GitHub Actions con gates de cobertura, auditoria, licencias y secretos

**Tareas:** F0-19 (parcial: sin Lighthouse y sin correr en GitHub) · **Commit/PR:** rama `feat/f0-ci` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `.github/workflows/ci.yml`, dos jobs en cada PR y en `main`: **verify** (`install --frozen-lockfile`,
  lint, typecheck, format, `test:coverage`, build) y **security** (`pnpm audit --prod` nivel alto,
  chequeo de licencias, gitleaks sobre el historial).
- `scripts/check-licenses.mjs`: falla si una dependencia de produccion tiene una licencia fuera de
  una lista permisiva (MIT, ISC, BSD, Apache-2.0, 0BSD, BlueOak, CC0, Unlicense). Hoy: 52 paquetes, todos permitidos.
- `.github/pull_request_template.md` con el checklist del DoD (spec §20).

### Decisiones

- Los gates de cobertura por zona viven en el `vitest.config` de cada paquete (domain 95%, schemas 85%,
  api 80%, i18n/types 80%, client 80%, ui 50%): el CI solo corre `test:coverage` y un umbral incumplido
  corta con codigo distinto de cero. Un solo lugar por zona, el mismo comando local y en CI.
- El `mongod` 7.0.24 de los tests se cachea entre corridas (`~/.cache/mongodb-binaries`).
- Node sale de `.nvmrc` y pnpm de `packageManager`: una sola fuente de version.
- Permisos minimos (`contents: read`) y cancelacion de corridas viejas de la misma rama.

### Verificado

- Localmente: el chequeo de licencias pasa, y con una lista recortada rechaza ISC y Apache-2.0 nombrando
  los paquetes (salida 1); `vitest --coverage` con un umbral inalcanzable sale con codigo 1, que es lo que
  corta el job (criterio: bajar `domain` a 94% falla el CI); el YAML pasa Prettier.
- **No** se pudo correr el workflow en GitHub (no hay remoto ni el conector de GitHub funciona), asi que
  los pasos con acciones de terceros no estan probados: `pnpm/action-setup`, `actions/cache`, `gitleaks`.

### Pendiente / deuda

- Lighthouse CI: cuando exista la PWA (F0-17).
- E2E en PR y en `main` (F1-20), escaneo de dependencias de desarrollo, y fijar las acciones por SHA.
- Si el repo pasa a una organizacion, `gitleaks-action` pide licencia.

---

## 2026-10-30 — Cliente HTTP tipado: errores sin prosa, reintentos con criterio y escrituras versionadas

**Tareas:** F0-18 · **Commit/PR:** rama `feat/f0-client` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `@sight-mapper/client`: `createHttpClient` (`fetch` con cookie de sesion, `Idempotency-Key` en todo POST,
  `If-Match` cuando se le da la version, timeout de 10 s, `navigator.onLine`), `ApiError`
  (`code`, `messageKey`, `params`, `requestId`), lector del envelope de error, `shouldRetry` /
  `retryDelay`, `ClientProvider` + `useHttp` + `queryClientConfig`, y `createResourceHooks`
  (list, detail, create, update, remove, action) sobre TanStack Query.

### Decisiones

- Toda falla es un `ApiError`: envelope valido → su codigo; respuesta sin envelope (un 502 de proxy en HTML)
  → `SM-NET-500-001` con el status; sin red → `SM-NET-503-001`; 10 s → `SM-NET-504-001`. Un codigo que
  este build no conoce (servidor mas nuevo) se conserva como `SM-CORE-500-001` con la `messageKey` del servidor.
- Reintentos (errors.md §6.2): nunca en 4xx; hasta 2 con backoff en 5xx, `SM-NET-*` y 429, que espera
  `retryAfterS` (tope 30 s). Un abort no es un `ApiError` y no se reintenta.
- Las mutaciones no se reintentan solas: un reintento tiene que reusar la `Idempotency-Key`, y el hook la
  crea **una vez por accion del usuario** (`create`, `run`), no por intento.
- `If-Match` sale de la version en el cache (detalle o cualquier lista); si el cache nunca vio el recurso,
  lo pide primero. Un 412 deja el cache con la copia nueva para mostrar "alguien lo cambio antes".
- Actualizar es optimista con rollback; las acciones de estado son `POST /:id/<accion>`, nunca un PATCH.
- Una señal ya abortada falla antes de salir a la red, como hace `fetch`.
- `401` llama a `onUnauthenticated` antes de lanzar, para redirigir al login.

### Verificado

- 64 tests (98% lineas). Criterios del plan: un 409 con envelope lanza `ApiError` con `code` y `params`;
  con la red caida da `SM-NET-503-001`. Contra un servidor falso que aplica el contrato (clave de
  idempotencia, `If-Match`, 412): el cliente manda la version cacheada, hace rollback y recarga ante un 412.
- Un test mio fallaba por TanStack: solo re-renderiza por lo que se lee durante el render. No era un bug
  del cliente; quedo comentado en el test.

### Pendiente / deuda

- Optimismo para crear y borrar dentro de listas paginadas (hoy: invalidar y recargar): F1.
- Cola offline de mutaciones (F4) reutilizara estas claves de idempotencia.

---

## 2026-10-30 — Design system: tokens dark/light con contraste AA y 17 primitivas accesibles

**Tareas:** F0-11 (parcial: falta el catalogo visual) · **Commit/PR:** rama `feat/f0-ui` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `@sight-mapper/ui`: `tokens.css` (dark del diseno, light de alto contraste, "system" = el del SO,
  `prefers-reduced-motion`) y `theme.css` (mapeo a Tailwind v4 con `@theme inline`: cambiar
  `data-theme` no recompila). Sin fuentes web: nada que bajar antes del primer pintado.
- Primitivas: `Button`, `Field`, `NumberField`, `PasswordField`, `Select`, `Segmented`, `SectionCard`,
  `AppHeader`, `NavDrawer` (+ `NavItem`), `BottomSheet`, `Toast` con deshacer, `InfoAlert`,
  `StatusBadge`, `EmptyState`, `ErrorState`, `Skeleton`, `UpdatePrompt`, y `useFocusTrap`.

### Decisiones

- Ningun componente trae texto: labels, hints, errores y "Mostrar/Ocultar" llegan por props ya
  traducidos (lo hace cumplir `i18next/no-literal-string`). El numero decimal y su parseo viven fuera.
- 44 px **inline** (`touchTarget`), no solo con clases: la garantia vale sin hoja de estilos y se
  puede testear en jsdom, que no calcula layout.
- Estado nunca solo por color: seleccion de `Segmented` con tilde, `StatusBadge` con forma distinta por
  tipo (circulo lleno, rombo, triangulo, cruz), `InfoAlert` con icono por variante.
- Un item "Proximamente" del drawer sigue enfocable y se anuncia deshabilitado (`aria-disabled`), para que
  un lector de pantalla sepa que existe y por que no hace nada (RF-X-07).
- Colores nuevos a definir en UX-UI §2.1: danger `#ff8a8a` / `#b3261e`, warning `#ffb84d` / `#7a4f00`;
  el borde dark subio de `#5b74a6` (2.2:1 sobre surface) a `#7a92c4` para pasar 3:1.
- El amarillo en light es solo relleno (1.4:1 sobre blanco): el boton lleva borde navy.

### Verificado

- 95 tests (97% lineas). Criterios del plan: toda primitiva interactiva mide >= 44x44 (test por
  componente); en ambos temas los pares texto/fondo pasan AA (>= 4.5:1 texto, >= 3:1 bordes) por un
  test que parsea el CSS real.
- Drawer y sheet: foco al abrir, Tab y Shift+Tab atrapados, Escape cierra y devuelve el foco.

### Pendiente / deuda

- **Catalogo visual** (sandbox en la PWA en dev): depende de F0-17, no existe la app todavia.
- No se compilo Tailwind sobre estas clases: se valida cuando la PWA las consuma (F0-17). Tampoco hay
  axe ni prueba al sol (F1-18, F1-19).
- Faltan `Ruler`, `MarksTable`, `SetupCard`, `Readout`, `StatusBar`, `DistanceCurve`: llegan con las
  pantallas de F1.
- F0-15 (Better Auth) se hace junto con F0-20 (Railway, dominio y Google OAuth).

---

## 2026-10-30 — Reintentos seguros y escrituras obsoletas rechazadas

**Tareas:** F0-14 · **Commit/PR:** rama `feat/f0-idempotency` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `core/idempotency`: middleware `Idempotency-Key` para todo POST bajo `/api/v1` y su store en Mongo
  (`idempotencyKeys`, TTL 24 h). Misma clave y mismo pedido repiten la respuesta guardada (con
  `ETag` y `Location`) y la marcan `Idempotent-Replay: true`; misma clave y otro pedido es `SM-CORE-409-001`.
- `core/concurrency`: `ETag` fuerte (`"3"`), guarda `If-Match` para PATCH y DELETE (428 si falta, 412
  si no coincide) y la lista de acciones exentas.
- `core/db/versioned`: `updateWithVersion` (filtro `{ _id, userId, version }` + `$inc`) y
  `rethrowDuplicateId` (`_id` repetido es `SM-CORE-409-002`).
- Un UUID mal formado solo en un campo `id` / `fooId` / `fooIds` es `SM-CORE-400-002` con el campo.
- `createHttpApp` monta, bajo `/api/v1/*`: sesion (F0-15) → idempotencia → `If-Match`.

### Decisiones

- Solo se guardan respuestas 2xx: un fallo tiene que poder reintentarse con la misma clave.
- El hash del pedido es sobre metodo, ruta y JSON canonico (orden de claves y espacios no cuentan).
  La misma clave en otra ruta es un desajuste.
- Dos pedidos identicos en carrera no se serializan: gana el `_id` unico (`409-002`) y el reintento
  repite la respuesta. Evita un lock distribuido.
- Un `If-Match` que no es un ETag nuestro (`*`, `W/"1"`, texto) cuenta como escritura obsoleta (412).
- `DICCIONARIO` §3.7: se agrego `responseHeaders` a `idempotencyKeys` (spec primero, despues codigo).
- Un documento ajeno o borrado es 404, nunca 412: no se revela que existe.

### Verificado

- 99 tests de API (97% lineas). Criterios del plan: el mismo POST con la misma clave ×3 deja un documento
  y devuelve tres respuestas iguales; misma clave con otro cuerpo da `SM-CORE-409-001`; PATCH con
  version vieja da 412 con `currentVersion`, sin `If-Match` da 428.
- Contra Mongo real: dos escritores concurrentes con la misma version, uno gana y el otro recibe 412;
  `updateWithVersion` dentro de una transaccion; el store nunca encuentra la clave de otro usuario.

### Pendiente / deuda

- Enchufar la sesion real (`ctx.userId`) en F0-15; hoy los tests usan una sesion falsa por header.
- Poner `Idempotency-Key` y `If-Match` automaticos en `@sight-mapper/client` (F0-18).

---

## 2026-10-30 — Mongo con aislamiento por usuario forzado y migraciones idempotentes

**Tareas:** F0-13 · **Commit/PR:** rama `feat/f0-mongo` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `apps/api/src/core/db`: `connection` (Mongoose, `withTransaction`, `mongoReadiness` con ping < 1 s),
  `isolation` (plugin), `soft-delete` (plugin), `base-schema` (`createBusinessSchema`: unica forma de
  armar un modelo), `temporal` (traductor `Temporal.Instant` / `Date`, unico lugar con `Date`).
- `migrate-mongo` con `migrations/20261030000000-initial-indexes.js`: todos los indices del
  DICCIONARIO §4 (unicos parciales con `deletedAt: { $type: null }`, TTL de idempotencia y de `jobRuns`).
- `main.ts` conecta a Mongo y `/ready` usa el ping real.

### Decisiones

- El plugin de aislamiento falla fuerte (`SM-CORE-500-002`) ante cualquier consulta sin `userId` o con
  `userId` undefined/null (que matchearia todo); cubre find, update, delete, count, distinct,
  aggregate (primer `$match`), save, `insertMany` y rechaza `estimatedDocumentCount`.
- La validacion de `save` va en el hook `validate`: si no, Mongoose tira su propio `ValidationError`
  antes y el bug de aislamiento sale disfrazado.
- Timestamps y `version` los pone el repositorio con el reloj inyectado, no Mongoose (`timestamps: false`).
- `mongodb-memory-server` con `allowBuilds: false`: su `postinstall` descarga un binario; los tests
  usan el `mongod` 7.0.24 que ya esta en el cache local (`MONGOMS_VERSION` lo cambia en CI).

### Verificado

- 17 tests contra un replica set real: consultas sin `userId` rechazadas, usuario B nunca ve datos
  de A, soft delete (`deletedAt` null explicito y `withDeleted`), commit y rollback de transacciones,
  ping con timeout, round trip de Temporal.
- Criterios del plan: dos marcas con la misma `(userId, setupId, arrowSetId, distanceM)` con una
  borrada conviven y dos activas dan E11000; igual para arco+mira de un setup; `up` dos veces no
  hace nada la segunda; `down` deja solo `_id_`.
- Dos bugs que salieron al correr contra Mongo: un hook `insertMany` con `next` en la firma colgaba si no
  se lo llamaba, y `create` con sesion exige `ordered: true`.

### Pendiente / deuda

- CI: cachear o fijar el binario de `mongod` (F0-19).
- `SM-CORE-500-002` deberia disparar una alerta inmediata (F7-C).
- Los modelos de cada coleccion nacen con su modulo (F1).

---

## 2026-10-30 — El nucleo HTTP de la API: errores sin prosa, request id y registro de rutas

**Tareas:** F0-12 · **Commit/PR:** rama `feat/f0-api-core` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `apps/api/src/core`: `config/env` (Zod, reporta todos los problemas sin mostrar valores, rechaza
  `CORS_ORIGINS` con comodin), `http/errors` (`AppError` con codigo tipado), `http/app` (Hono +
  `@hono/zod-openapi`), `logger` (Pino con redaccion), `events/bus` (bus en proceso tipado),
  `registry` (lista unica de rutas), `clock` (reloj inyectable con Temporal).
- Cadena de middleware: request id (el del cliente si es UUID, si no UUIDv7), log por request,
  headers de seguridad, CORS explicito con credenciales, limite de body de 64 KB, solo JSON.
- `/health` (vive) y `/ready` (usa un puerto `Readiness`; Mongo se enchufa en F0-13), OpenAPI en
  `/api/v1/openapi.json` salvo en prod. `composition-root.ts` y `main.ts` con apagado ordenado.

### Decisiones

- Un unico `onError`: todo lo que no es `AppError` sale como `SM-CORE-500-001` sin mensaje ni stack;
  el stack solo va al log, con el `requestId`. 401 y 404 se loguean en info, otros 4xx en warn, 5xx en error.
- Un fallo de Zod en cualquier ruta es `SM-CORE-400-001` con un issue por campo (`toValidationIssues`);
  un JSON mal formado tambien.
- El body se detecta con `req.raw.body`, no con `content-length`: un POST de accion sin body (archive,
  restore) pasa, y un body chunked no esquiva el chequeo de tipo.
- Variables de auth, Google y email se agregan al esquema en F0-15, no antes.

### Verificado

- 36 tests de integracion y unitarios (96% lineas). Criterios del plan: una ruta que lanza `Error`
  responde `SM-CORE-500-001` sin stack y el log `error` trae stack y `requestId`; con Mongo caido
  `/health` da 200 y `/ready` 503 `SM-CORE-503-001` sin filtrar la causa; un body de 100 KB da
  `SM-CORE-413-001`.
- Un test descubrio que `app.request` no manda `content-length`: el chequeo 415 original no corria.

### Pendiente / deuda

- Enchufar Mongo a `/ready` (F0-13), la sesion y `ctx.userId` (F0-15), idempotencia y `If-Match` (F0-14).
- `pino-pretty` solo se usa en local; no se probo el transporte (no hay test para `main.ts`).

---

## 2026-10-30 — Catalogos ES/EN tipados y traductor sin React

**Tareas:** F0-10 (y un segundo fix de seguridad de F0-08) · **Commit/PR:** rama `feat/f0-i18n` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `@sight-mapper/i18n`: `locales/es.ts` (fuente de la forma) y `locales/en.ts` (tipado como la misma
  forma: una clave de mas o de menos no compila). Namespaces `common`, `validation` y `errors` con
  los 47 `messageKey` del catalogo de errores y las 14 claves `validation.*` de los schemas.
- `createTranslator(locale)`: `t(clave)` tipado; si el mensaje tiene `{{params}}`, el compilador los
  exige (se infieren del texto). Sirve tambien en el servidor para los emails (ADR-004).
- `translateKey(locale, messageKey, params)` para claves que llegan como string (la API): una clave
  desconocida cae en `errors.core.unexpected`, nunca se muestra una clave cruda.
- `detectLocale`, `decimalSeparator`, `formatNumber`, `formatDate` / `formatDateTime` con `Intl`.
- Fix de F0-08: contador entero y limite de enteros seguros en `buildRuler` (con indices cerca de
  2^53, `i += step` dejaba de avanzar y el tope de ticks no frenaba el bucle).

### Decisiones

- Catalogos en TS y no `.json` (TECNICO §9 actualizado): paridad por compilador y params inferidos.
- Los placeholders son valores de **presentacion** (`{{maxDistance}}`, `{{min}}`): el cliente convierte
  los params canonicos (m, mm) a la unidad del arquero antes de interpolar.
- Voseo es-AR con tildes en la UI (la regla de "sin tildes" es solo para docs). Hay un test contra el tuteo.
- Fallback de idioma: `es` (mercado principal) cuando el navegador no ofrece ES ni EN.
- i18n no importa `schemas` (grafo): el test lee los fuentes de `schemas` para verificar que cada
  clave `validation.*` que emiten tenga traduccion.

### Verificado

- 25 tests, 100% lineas. Criterios del plan: una clave que esta en `es` y no en `en` rompe
  (compilador y test de paridad); `t(no.existe)` no compila (`@ts-expect-error`); todo codigo de
  error tiene su clave en ambos idiomas y no sobran mensajes huerfanos.

### Pendiente / deuda

- Los namespaces `auth`, `equipment`, `setups`, `sight`, `doctor`, `account` se llenan con cada pantalla.
- Integracion con `react-i18next` en F0-17 usando `catalogs` como `resources`.
- Posible: acotar `min`/`max` de `sightScale` (p. ej. ±1e6) en el diccionario y en los schemas.

---

## 2026-10-30 — Enums, catalogo de errores y schemas Zod compartidos

**Tareas:** F0-09 (y un fix de F0-08) · **Commit/PR:** rama `feat/f0-types-schemas` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `@sight-mapper/types`: los 13 enums del DICCIONARIO §5 y el catalogo de 50 errores **generado de
  `docs/errors.md`** (`pnpm --filter @sight-mapper/types generate`). `ErrorCode` es una union:
  un codigo no declarado no compila. Test de deriva: falla si el catalogo generado no coincide con
  el markdown.
- `@sight-mapper/schemas` (Zod 4): arcos, miras (con `SightScale`), sets de flechas, setups,
  marcas, perfil, preferencias, acceso rapido, paginacion y `toValidationIssues` (Zod a
  `{ path, messageKey, params }` para `SM-CORE-400-001`).
- Fix de seguridad en F0-08 (`buildRuler` sin tope de ticks), commit aparte.

### Decisiones

- Los refinements propios devuelven claves `validation.*` como mensaje, nunca prosa; F0-10 debe
  traducirlas.
- Campos opcionales aceptan `null` para borrarlos en un PATCH.
- Los defaults viven solo en el alta: `.partial()` conserva los defaults de Zod y un PATCH sin
  `pinType` lo habria pisado con `monopin` (bug detectado por un test).
- `bowType` acepta todo el enum; rechazar lo que no sea `compound` es `SM-BOW-422-001` del caso de uso.
- `schemas` no importa `domain` (grafo de dependencias): el tamano fijo de `mm`/`cm`/`in` esta
  repetido y comentado.

### Verificado

- Criterio del plan: `scale.min >= scale.max` falla con issue en `scale.max`; un codigo
  inexistente no compila (`@ts-expect-error` en test).
- 29 tests en types y 110 en schemas (100% lineas); lint, typecheck, build y format verdes.

### Pendiente / deuda

- Traducciones ES/EN de `validation.*` y `errors.*` (F0-10).
- Validar que `measuredAt` no sea futura (+5 min) requiere reloj: va en el caso de uso.

---

## 2026-10-30 — La regla de la mira se calcula en enteros y no se pisa

**Tareas:** F0-08 · **Commit/PR:** rama `feat/f0-ruler` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `packages/domain/src/ruler/` ([SIGHT-MATH.md](domain/SIGHT-MATH.md) §10): `buildRuler` (ticks por
  unidad, posicion segun `direction`, guarda de densidad), `positionOf` (pixel de una lectura, sin
  recortar) y `placeMarks` (anti-solape de etiquetas).
- Niveles por unidad como multiplos enteros del tick menor: `mm` 1/5/10, `cm` y `custom`
  0.1/0.5/1, `in` 1/16, 1/4 y 1, `click` 1/5/10.

### Decisiones

- El indice del tick es un entero; el valor es `i / ticksPerUnit` y la posicion es
  `largo × (i − min) / span`. Nunca se suma `+= 0.1`, asi que el ultimo tick cae exacto.
- La guarda de densidad se decide por nivel (4 px por defecto, ajustable): si el menor no entra se
  omite, y asi con el medio; un nivel mas grueso siempre se conserva si entra.
- Solo los ticks mayores llevan etiqueta.
- `placeMarks` empuja las etiquetas hacia abajo y, si el grupo se pasa del fondo, lo sube; la
  posicion real (`positionPx`) nunca cambia.

### Verificado

- 209 tests, 100% de cobertura. Criterios del plan: `mm` 0–120 en 600 px da mayores cada 10 mm
  exactos y el ultimo en 600 px sin deriva; 240 px para 0–120 mm no genera ticks de 1 mm; dos
  marcas a 2 px separan sus etiquetas conservando su `y` real.
- Propiedades con `fast-check`: ticks ordenados, dentro de `[0, largo]` y nunca a menos de la
  distancia minima dentro de un nivel; las etiquetas nunca se solapan ni mueven el dato.
- Un bug real salio de los tests: `Math.ceil(-1e-9)` daba `-0` y el primer tick se llamaba `-0`.

### Pendiente / deuda

- La escala fisica 1:1 (MAKER, F2) se resuelve con `unitSizeMm` fuera de este modulo.
- El alto de etiqueta lo decide la PWA; el dominio solo recibe el numero.

---

## 2026-10-30 — Las unidades se convierten en el borde y vuelven sin perdida

**Tareas:** F0-07 · **Commit/PR:** rama `feat/f0-units` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `packages/domain/src/convert/` ([UNIDADES.md](domain/UNIDADES.md)):
  - `constants`: M/yd, mm/in, g/gr, m/s por fps, N por lbf y N por kgf, exactas.
  - `quantity`: `toCanonical` / `fromCanonical` tipados por cantidad (distancia, largo, masa,
    velocidad, fuerza); la distancia canonica se redondea a 1 mm.
  - `quantum`: `roundToQuantum`, `decimalsForQuantum` y `formatDecimal` en aritmetica entera
    de quanta, con separador decimal inyectado.
  - `scale`: `SightScale`, `readingToMm` / `mmToReading`, `scaleBoundsMm`,
    `unitSizeFromLength`, `hasPhysicalScale`, `roundReading` / `formatReading`.
  - `parse`: `parseDecimal` (coma o punto) y `parseImperial` (decimal, fraccion, mixto); devuelven
    `null`, nunca lanzan, porque es entrada del usuario.

### Decisiones

- `mm`, `cm` e `in` tienen tamano fijo (1, 10, 25.4) aunque `unitSizeMm` diga otra cosa; solo
  `click` y `custom` usan lo que cargo el arquero (nominal 1 si es `null`).
- Sin separador de miles: `1.234,5` es ambiguo y se rechaza.
- El separador decimal lo recibe la funcion; el dominio no usa `Intl` ni conoce locales.
- `tidy` (12 cifras significativas) limpia ruido de punto flotante en cada conversion.

### Verificado

- 176 tests, 100% de cobertura. Criterios del plan: `20 yd` da `18.288 m` exacto; `custom` 1–9 con
  10 mm: `3.5` va a `35 mm` y vuelve a `3.5`; `"6 1/4"` es `6.25 in` y `158.75 mm`.
- Test no negociable #6 con `fast-check`: los 300 000 mm canonicos pasan por yardas y vuelven
  iguales; toda lectura en la grilla del quantum sobrevive a las cinco unidades de escala; el resto
  de cantidades vuelve dentro de 1e-6.

### Pendiente / deuda

- Las unidades de equipo por sistema (spec §17.2) siguen siendo la propuesta inicial; se cierran
  en F1-12.
- La regla de ticks (F0-08) reutiliza `roundToQuantum` y `scaleBoundsMm`.

---

## 2026-10-30 — El dominio calcula marcas: pasa exacto por las medidas y extrapola anclado

**Tareas:** F0-05 · **Commit/PR:** rama `feat/f0-domain-model` · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- `@sight-mapper/domain` (TDD, [SIGHT-MATH.md](domain/SIGHT-MATH.md) §3–6 y §9): `preprocess`
  (orden y colapso de distancias repetidas), `createPchip` (Fritsch–Carlson), `fitParabola`
  (minimos cuadrados centrada y escalada, Cramer), `createMarkModel` (escalonado 2/3/5,
  extrapolacion anclada, limite de vertice, baja confianza), `gridDistances` / `queryDistance` /
  `calculateGrid` (grilla desde el origen, snap a 1 mm, `outOfScale`).
- Resultados discriminados `{ ok: false, code, params }` para lo que el arquero puede provocar
  (`SM-CALC-422-001/002/004`); `DomainError` solo para bugs de quien llama.
- Constantes en `constants.ts`; gate de cobertura 95% en `vitest.config.ts`.

### Decisiones

- El dominio recibe solo marcas `measured` y no borradas: filtrar es del caso de uso, no del dominio
  (no conoce `origin` ni `deletedAt`).
- Vertice: si cae *dentro* del rango medido, extrapolar se aleja de el y no hay giro; solo se
  rechaza cuando el vertice queda entre el borde y la distancia pedida.
- Curvatura menor a 1e-9 mm por desvio² se trata como recta (sin vertice).
- `outOfScale` es un campo de la fila (`SM-CALC-422-005` queda como aviso para la UI, no se emite
  como falla).

### Verificado

- 62 tests, 100% de cobertura (statements, branches, funciones, lineas). Criterios del plan: las
  cinco marcas del ejemplo devuelven su valor exacto; con 2 marcas fuera de rango da
  `SM-CALC-422-002`; con 3+ el modelo es continuo en `d_max` y `kind = extrapolated`; propiedades
  con `fast-check` (exactitud, monotonia, acotado entre marcas consecutivas).
- Los valores de referencia de PCHIP se calcularon **a mano** con las formulas de §5 (no hay SciPy
  en el entorno); una primera version con valores "de SciPy" estaba mal y se descarto.

### Pendiente / deuda

- Contrastar PCHIP contra SciPy real cuando haya Python con scipy.
- `SM-CALC-422-003` y el Doctor llegan con F0-06 (necesita los fixtures de F0-21).

---

## 2026-10-30 — Monorepo y tooling listos: el repo compila, testea y lintea

**Tareas:** F0-01, F0-02 · **Commit/PR:** sin commit todavia · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- pnpm workspaces + Turborepo 2 (`build`, `dev`, `lint`, `typecheck`, `test`, `test:coverage`),
  catalogo de versiones en `pnpm-workspace.yaml`, `.nvmrc` (22), `.npmrc`, `.gitignore`,
  `.gitattributes` (LF), `.env.example`.
- Esqueletos de `apps/{api,pwa}` y `packages/{domain,schemas,types,i18n,ui,client,config}` con
  scripts uniformes. Los paquetes compilan a `dist` con `tsc` y los consumen los demas via `exports`.
- `@sight-mapper/config`: tsconfig `base`/`lib`/`node`/`react` con `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- ESLint flat en la raiz con reglas mecanizadas: grafo de dependencias entre workspaces
  (ARQUITECTURA §3.1), modulos de la API sin importarse entre si (ADR-002), `domain` puro (sin
  imports externos, `Date`, `Math.random`, `Temporal.Now`, I/O), sin `any`, sin `console`,
  `new Date()` solo en `apps/api/src/core/db`, `i18next/no-literal-string` en JSX.
- Prettier, husky (`pre-commit` con lint-staged, `commit-msg` con commitlint y los scopes de
  TECNICO §3).

### Decisiones

- TypeScript fijado en **~6.0** y Vitest en **~4.1**: `typescript-eslint` 8 declara soporte
  `<6.1` (TS 7 es el port nativo) y TECNICO §1 pide Vitest 4. Subir cuando el ecosistema alcance.
- ESLint de la raiz en vez de `packages/config`: una sola config, sin dependencias implicitas.
- Prettier ignora `*.md` y `docs/`: reformatear rompe tablas y saltos de linea de los docs.

### Verificado

- Desde cero: `pnpm format:check`, `lint`, `typecheck`, `test:coverage` y `build` en verde (14/14 y
  8/8 tareas de Turbo).
- Con archivos descartables: importar `modules/equipment` desde `modules/calculator` falla lint;
  `new Date()`, `Math.random()`, `any` y `console.log` en `domain` fallan lint; un texto literal en
  JSX de `ui` falla lint; `feat(foo): x` lo rechaza commitlint y `feat(domain): x` pasa.

### Pendiente / deuda

- Probar el hook `pre-commit` en el primer commit real.
- Las reglas de capas de modulo (rutas sin Mongoose, repos con `userId`) llegan con F0-12/F0-13.
- `i18next/no-literal-string` ignora constantes en MAYUSCULAS y todo lo exportado inline
  (`export const X = ...`): revisar en F0-11 si hace falta endurecerlo.

---

## 2026-10-29 — Arrancar el proyecto con la documentacion completa y las decisiones cerradas

**Tareas:** previas a F0 · **Commit/PR:** sin commit todavia · **Tarjeta:** sin tablero (F0-04)

### Que se hizo

- Analisis del borrador (`docs/borrador-specs.md`), las 13 pantallas de `design/` y las 14 de
  `mockup/`, y de los proyectos previos del autor como referencia (`bow-sight-project`,
  `bv-bow-sight`). Resultado en [ANALISIS-INICIAL.md](ANALISIS-INICIAL.md): 16 inconsistencias
  detectadas y resueltas.
- Investigacion breve de competencia (Archer's Advantage, Precision Cut Archery) para los campos de
  equipo y MAKER.
- Documentacion creada:
  - [spec/SIGHT-MAPPER-SPEC.md](spec/SIGHT-MAPPER-SPEC.md) v1.0 (fuente de verdad)
  - [FUNCIONAL.md](FUNCIONAL.md), [TECNICO.md](TECNICO.md), [ARQUITECTURA.md](ARQUITECTURA.md)
  - [DOMINIO.md](DOMINIO.md), [DICCIONARIO.md](DICCIONARIO.md), [errors.md](errors.md)
  - [domain/SIGHT-MATH.md](domain/SIGHT-MATH.md), [domain/UNIDADES.md](domain/UNIDADES.md)
  - [UX-UI.md](UX-UI.md)
  - [adr/](adr/README.md) 000–011
  - [ACTION-PLAN.md](ACTION-PLAN.md): F0 (21 tareas, 80 pts) y F1 (22 tareas, 85 pts) detalladas
  - `CLAUDE.md` y `README.md` en la raiz

### Decisiones (sesion de preguntas con el autor)

| Tema                    | Decision                                                                 | ADR       |
| ----------------------- | ------------------------------------------------------------------------ | --------- |
| Codigo previo           | **Desde cero**; los proyectos previos son solo referencia                | —         |
| Nombre                  | **Sight Mapper**, paquetes `@sight-mapper/*`, errores `SM-*`             | 002, 010  |
| Alcance MVP             | Cuenta + equipo + setups + marcas + intermedias + **Mark Doctor** + **imperial** + **EN** | spec §4 |
| Fuera del MVP           | MAKER (F2) y offline-first (F4)                                          | spec §15  |
| MAKER                   | **Diseño propio**, sin ingenieria inversa                                | 011       |
| Lectura de la mira      | **Escala nativa → mm** (mm, cm, in, click, custom); MOA descartado       | 005       |
| Minimo de marcas        | **Escalonado 2/3/5**                                                     | 001       |
| Modelo                  | **Setup** = arco + mira + 1..N flechas; marcas por (setup, flechas)      | 008       |
| Borrado                 | **Bloquear + archivar**; setups a papelera 30 dias                       | 008       |
| Tipos de arco           | **Solo compuesto** en MVP                                                | spec §7.2 |
| Auth                    | **Todo el diseño**: email o username, Google, verificacion, recupero     | 007       |
| Wind / Weather / Stats  | **Visibles con "Proximamente"**                                          | spec RF-X-07 |
| Tema                    | **Dark + light** desde el MVP                                            | spec RNF-07 |

Decisiones tecnicas tomadas por defecto (del borrador, sin objecion): stack completo (Hono,
Mongoose/Atlas, Better Auth, React 19 + TanStack, Railway), PWA sin tiendas, i18n con claves, ids de
cliente + idempotencia + `If-Match` desde F0, calculo en el cliente, parabola **anclada** y Doctor
**leave-one-out** (mejoras sobre el enfoque previo).

### Pendiente / decisiones abiertas

- Dominio de produccion (bloquea F0-20 y Google OAuth).
- Tablero de tareas: ¿Trello? (F0-04, bloqueada hasta aprobar).
- Unidades de presentacion del equipo por sistema (spec §17.2, se cierra en F1-12).
- Calibracion de umbrales del Doctor con datos reales (F0-06).
- Fuente tipografica y tokens exactos del archivo fuente del diseño (F0-11).
- Diseños faltantes listados en [UX-UI.md](UX-UI.md) §8.
