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
