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
