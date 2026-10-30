# Documento tecnico — Sight Mapper

> Como se construye. Estructura y fronteras en [ARQUITECTURA.md](ARQUITECTURA.md); reglas en la
> [spec](spec/SIGHT-MAPPER-SPEC.md); errores en [errors.md](errors.md).

---

## 1. Stack

| Capa          | Eleccion                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------- |
| Lenguaje      | TypeScript `strict` (+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)           |
| Runtime       | Node 22 LTS                                                                               |
| API           | Hono · `@hono/node-server` · `@hono/zod-openapi` (OpenAPI desde el registro de rutas)     |
| Auth          | Better Auth (email+password, plugin `username`, Google, verificacion, reset, rate limit)   |
| Persistencia  | MongoDB Atlas (replica set) · Mongoose 8 · `migrate-mongo`                                |
| Validacion    | Zod 4 en `@sight-mapper/schemas`                                                          |
| Tiempo        | `Temporal` (polyfill `@js-temporal/polyfill` hasta que sea nativo)                        |
| IDs           | UUIDv7 (`uuid` v7) generado en el cliente                                                 |
| Logs          | Pino (JSON) · `pino-pretty` solo en dev                                                   |
| Email         | Resend                                                                                    |
| Front         | React 19 · TanStack Router / Query / Form / Table · Tailwind v4 · Zustand · Nuqs · Motion |
| i18n          | i18next + react-i18next, claves tipadas                                                   |
| PWA           | `vite-plugin-pwa` (Workbox), `registerType: 'prompt'`                                     |
| Graficos      | SVG propio para la regla; curva con SVG propio (sin libreria de charts en el MVP)         |
| Testing       | Vitest 4 · Testing Library · MSW · `mongodb-memory-server` (replset) · Playwright · fast-check |
| Tooling       | pnpm + Turborepo 2 · ESLint (flat) + Prettier · husky + lint-staged · commitlint          |
| Infra         | Railway (un servicio por app, `staging` y `prod`) · MongoDB Atlas · GitHub Actions        |

## 2. Configuracion y entornos

| Entorno   | Donde                         | Datos                                    |
| --------- | ----------------------------- | ---------------------------------------- |
| `local`   | `pnpm dev`                    | Mongo en memoria (replset) o Atlas dev   |
| `test`    | Vitest / CI                   | `mongodb-memory-server` replset          |
| `staging` | Railway                       | Atlas cluster `staging`                  |
| `prod`    | Railway                       | Atlas cluster `prod` (backups + PITR)    |

Variables de entorno (validadas con Zod al arrancar; si falta una, el proceso no levanta):

| Variable                 | App  | Ejemplo / nota                                   |
| ------------------------ | ---- | ------------------------------------------------ |
| `NODE_ENV`               | api  | `production`                                     |
| `APP_ENV`                | api  | `local \| staging \| prod`                       |
| `PORT`                   | api  | `3000`                                           |
| `MONGODB_URI`            | api  | secreto                                          |
| `BETTER_AUTH_SECRET`     | api  | secreto, 32+ bytes                               |
| `BETTER_AUTH_URL`        | api  | URL publica de la API                            |
| `GOOGLE_CLIENT_ID`       | api  |                                                  |
| `GOOGLE_CLIENT_SECRET`   | api  | secreto                                          |
| `RESEND_API_KEY`         | api  | secreto                                          |
| `EMAIL_FROM`             | api  | `Sight Mapper <no-reply@…>`                      |
| `CORS_ORIGINS`           | api  | lista separada por comas, sin comodines          |
| `LOG_LEVEL`              | api  | `info`                                           |
| `VITE_API_URL`           | pwa  | URL publica de la API                            |
| `VITE_APP_VERSION`       | pwa  | inyectada en build desde `package.json`          |

Secretos solo en Railway y en GitHub Actions secrets. `.env.example` sin valores reales. El hook de
pre-escritura bloquea patrones de secretos.

## 3. Convenciones de codigo

- Codigo, identificadores, commits y nombres de campos en **ingles**; docs en español; UI por
  catalogo.
- Prohibido: `any`, `console.log`, TODOs sueltos, `new Date()` fuera del traductor de persistencia,
  logica de negocio en componentes React, strings de usuario fuera de catalogos, `skip` para
  paginar, importar entre modulos.
- El reloj se **inyecta**: `now: () => Temporal.Instant`.
- Todo componente que trae datos acepta un cliente inyectable.
- Commits convencionales; scopes: `repo, docs, domain, schemas, types, i18n, ui, client, api,
  pwa, account, equipment, calculator, ci, infra, e2e`.
- Ramas: `main` protegida; trabajo en `feat/…`, `fix/…`, `docs/…`; PR con template y CI verde.

## 4. Convenciones de la API

| Tema               | Regla                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Prefijo            | `/api/v1/*` · Better Auth en `/api/auth/*` · `/health`, `/ready` fuera de prefijo          |
| Formato            | JSON UTF-8. Nombres de campo `camelCase`                                                   |
| Exito              | El recurso (`200`/`201`). Listado: `{ items: T[], nextCursor: string \| null }`            |
| Error              | Envelope unico (ver [errors.md](errors.md)). Sin prosa                                     |
| Paginacion         | `?limit=` (1–100, default 25) y `?cursor=` opaco. Nunca `skip`                             |
| IDs                | UUIDv7 del cliente en el body de `POST` (`id`). Se valida version y timestamp razonable    |
| Idempotencia       | `Idempotency-Key` **obligatoria** en `POST`; misma clave + mismo cuerpo → misma respuesta; misma clave + otro cuerpo → `SM-CORE-409-001`. TTL 24 h |
| Concurrencia       | Respuestas incluyen `version` y header `ETag: "<version>"`. `PATCH`/`DELETE` exigen `If-Match` (`SM-CORE-428-001` si falta, `SM-CORE-412-001` si no coincide) |
| Recurso ajeno      | `404` (`SM-CORE-404-002`), nunca `403`                                                     |
| Soft delete        | `DELETE` marca `deletedAt`; las lecturas lo excluyen salvo endpoints de papelera           |
| Transiciones       | Endpoints de accion: `POST /:id/archive`, `/unarchive`, `/restore`. Nunca `PATCH { status }` |
| Request id         | Header `X-Request-Id` de entrada (si es UUID valido) o generado; devuelto en respuesta     |
| Rate limit         | Auth: 5 intentos / 15 min por IP+identificador. API: 300 req / 5 min por usuario           |
| OpenAPI            | Generado del registro de rutas en `/api/v1/openapi.json` (no publico en prod)              |

## 5. Endpoints (MVP)

### 5.1 Salud y auth

| Metodo | Ruta                      | Descripcion                                    |
| ------ | ------------------------- | ---------------------------------------------- |
| GET    | `/health`                 | El proceso vive                                |
| GET    | `/ready`                  | Vive y Mongo responde (`ping` < 1 s)           |
| *      | `/api/auth/*`             | Better Auth: sign-up, sign-in (email/username), social Google, verify, forgot/reset, sign-out, session |

### 5.2 Account

| Metodo | Ruta                              | Descripcion                          | Errores                       |
| ------ | --------------------------------- | ------------------------------------ | ----------------------------- |
| GET    | `/api/v1/me`                      | Perfil + preferencias + version app minima | —                       |
| PATCH  | `/api/v1/me/preferences`          | `locale`, `unitSystem`, `theme`      | CORE-400                      |
| PUT    | `/api/v1/me/quick-access`         | `{ setupId, arrowSetId } \| null`    | ACC-422-001                   |
| GET    | `/api/v1/me/export`               | JSON con todos los datos             | —                             |
| POST   | `/api/v1/me/deletion-request`     | Pide la baja                         | ACC-409-001                   |
| DELETE | `/api/v1/me/deletion-request`     | Cancela la baja                      | ACC-404-001                   |

### 5.3 Equipment (patron igual para `bows`, `sights`, `arrow-sets`)

| Metodo | Ruta                                 | Descripcion                               | Errores                        |
| ------ | ------------------------------------ | ----------------------------------------- | ------------------------------ |
| GET    | `/api/v1/bows?status=&cursor=&limit=`| Listado (default `active`)                | —                              |
| POST   | `/api/v1/bows`                       | Alta                                      | CORE-400, BOW-422-001          |
| GET    | `/api/v1/bows/:id`                   | Detalle + `usage: { setups, marks }`      | CORE-404-002                   |
| PATCH  | `/api/v1/bows/:id`                   | Edicion parcial                           | CORE-400/412/428               |
| POST   | `/api/v1/bows/:id/archive`           | Archivar                                  | —                              |
| POST   | `/api/v1/bows/:id/unarchive`         | Desarchivar                               | —                              |
| DELETE | `/api/v1/bows/:id`                   | Borrado (soft) protegido                  | BOW-409-001                    |

Particularidad de `sights`: `PATCH /api/v1/sights/:id` con cambio de `scale.unit` o
`scale.unitSizeMm` y marcas existentes exige `scaleChangeStrategy` (`SGT-409-003`); reducir rango
con marcas afuera → `SGT-409-002`.

### 5.4 Calculator

| Metodo | Ruta                                          | Descripcion                                       | Errores                              |
| ------ | --------------------------------------------- | ------------------------------------------------- | ------------------------------------ |
| GET    | `/api/v1/setups?status=&cursor=`              | Home: con resumen de arco, mira, flechas, conteo de marcas | —                           |
| POST   | `/api/v1/setups`                              | Alta                                              | STP-409-001, STP-422-001/002         |
| GET    | `/api/v1/setups/:id`                          | Detalle expandido (bow, sight con escala, arrowSets) | CORE-404-002                      |
| PATCH  | `/api/v1/setups/:id`                          | `name`, `isFavorite`, `arrowSetIds`               | STP-409-002, STP-422-001             |
| POST   | `/api/v1/setups/:id/archive` · `/unarchive`   |                                                   |                                      |
| DELETE | `/api/v1/setups/:id`                          | A la papelera (cascada soft)                      |                                      |
| GET    | `/api/v1/setups/trash`                        | Papelera                                          |                                      |
| POST   | `/api/v1/setups/:id/restore`                  | Restaurar (≤ 30 dias)                             | STP-410-001                          |
| GET    | `/api/v1/setups/:id/marks?arrowSetId=`        | Todas las marcas del par (tope 500, sin paginar)  | MARK-422-002                         |
| POST   | `/api/v1/marks`                               | Alta; `replace: true` para reemplazar duplicada   | MARK-409-001, MARK-422-001/002       |
| PATCH  | `/api/v1/marks/:id`                           | Edicion                                           | MARK-409-001, MARK-422-001           |
| DELETE | `/api/v1/marks/:id`                           | Soft delete                                       |                                      |
| POST   | `/api/v1/marks/:id/restore`                   | Deshacer (≤ 30 dias)                              | MARK-410-001                         |

Ejemplo `POST /api/v1/marks`:

```http
POST /api/v1/marks
Idempotency-Key: 019a3c5f-7b1e-7c2a-9d40-5f1f3e2a8b10
Content-Type: application/json

{
  "id": "019a3c5f-7b1d-7e55-8f0e-0c4c1b9f2a77",
  "setupId": "019a2f10-...",
  "arrowSetId": "019a2f0c-...",
  "distanceM": 40,
  "scaleValueMm": 35,
  "measuredAt": "2026-10-29T15:20:00Z",
  "note": null
}
```

`201` → la marca con `version: 1`. El cliente ya convirtio `3.5` (escala `custom`, 10 mm/unidad) a
`35` mm.

## 6. Persistencia

- Un modelo Mongoose por coleccion, **solo** en `infrastructure/` de su modulo.
- `_id: String` (UUIDv7). `versionKey: false`; `version` propio, incrementado en el `update` con
  filtro `{ _id, userId, version }` (si no matchea → 412).
- **Plugin de aislamiento** global: toda query (`find*`, `update*`, `delete*`, `aggregate`,
  `countDocuments`) sin `userId` en el filtro lanza `IsolationViolationError` (500 + alerta). Solo
  los jobs de sistema lo desactivan explicitamente con `{ bypassIsolation: 'job:<nombre>' }`.
- Soft delete: los repositorios agregan `deletedAt: null` por defecto.
- Indices: definidos en migraciones (`migrate-mongo`), **no** con `autoIndex` en prod. Lista en
  [DICCIONARIO.md](DICCIONARIO.md) §4. Verificar en F0-11 que `partialFilterExpression` con
  `{ deletedAt: { $type: 'null' } }` funcione en la version de Atlas usada.
- Migraciones: corren **antes** del deploy desde un solo lugar (job de release de Railway). Prohibido
  tocar Atlas a mano.
- Traductor de persistencia: `Temporal.Instant ⇄ Date` en el borde del repositorio.

## 7. Autenticacion (Better Auth)

- Adaptador MongoDB de Better Auth sobre la misma base.
- Email + password (min 8), plugin `username` (login por email **o** username; username unico,
  3–30, `[a-z0-9._]`), Google (`socialProviders.google`).
- `requireEmailVerification: true`; emails via Resend con plantillas ES/EN segun el locale del
  navegador al registrarse.
- Reset: token de un solo uso, 1 h; al cambiar la contraseña se revocan las demas sesiones.
- Cookies `httpOnly`, `Secure`, `SameSite=Lax`. PWA y API en el **mismo sitio** (subdominios del
  mismo dominio) para que Lax funcione: depende de la decision abierta de dominio (spec §17.1).
- Hook `user.create.after` → emite `UserRegistered` (crea `Profile`).
- Los errores de Better Auth se mapean a codigos `SM-AUTH-*` en un adaptador (la PWA nunca ve
  mensajes en prosa del proveedor).

## 8. PWA

- **Service worker** con `vite-plugin-pwa`:
  - precache del shell (HTML, JS, CSS, fuentes, iconos);
  - runtime `StaleWhileRevalidate` para `GET /api/v1/*` de lectura → con el cache poblado, la
    pantalla de la mira se puede **consultar** sin señal (escritura offline: F4);
  - `registerType: 'prompt'` → `UpdatePrompt` "Hay una version nueva · Actualizar".
- Version visible: `VITE_APP_VERSION` en login y Perfil. `GET /api/v1/me` devuelve
  `minClientVersion`; si la PWA es menor, fuerza actualizar.
- **Acceso rapido:** al boot, si `profile.quickAccess` existe, el router redirige a
  `/setups/:id?arrowSet=`.
- **Optimismo:** `useMutation` con `onMutate` (escribe en cache), `onError` (rollback + toast con
  `t(messageKey, params)`), `onSettled` (invalida). Toast con "Deshacer" llama al endpoint inverso
  (`restore` o `DELETE`).
- **Formateo:** `Intl.NumberFormat(locale)` + quantum; parser propio que acepta coma/punto y
  fracciones.
- **Impresion (MVP):** ruta `/setups/:id/print` con CSS `@media print`; el navegador genera el PDF.
  El tape a escala real (MAKER, F2) usara PDF generado en el cliente con factor `72/25.4` y
  calibracion.

## 9. i18n

- `@sight-mapper/i18n`: `es.json` y `en.json` con la misma forma; tipos generados para que una clave
  inexistente sea **error de compilacion**. Test que verifica paridad de claves ES/EN.
- Namespaces: `common`, `auth`, `equipment`, `setups`, `sight`, `calc`, `doctor`, `account`,
  `errors`.
- La API devuelve `messageKey` (`errors.<modulo>.<clave>`) y `params`; el cliente traduce. →
  [ADR-004](adr/004-i18n.md)

## 10. Testing

| Nivel        | Herramienta                          | Donde                         | Que cubre                                         |
| ------------ | ------------------------------------ | ----------------------------- | ------------------------------------------------- |
| Unitario     | Vitest (+ fast-check en `domain`)    | `*.test.ts` junto al codigo   | dominio, schemas, casos de uso con repos fake     |
| Integracion  | Vitest + `mongodb-memory-server` replset | `apps/api/tests/`         | rutas reales contra Mongo real, transacciones     |
| Componentes  | Vitest + Testing Library + MSW       | `apps/pwa/src/**/*.test.tsx`  | features con cliente inyectado                    |
| E2E          | Playwright                           | `e2e/`                        | flujo critico del MVP en movil (360) y desktop    |

Los **siete tests no negociables** y la cobertura por zona estan en la spec §13. El CI falla si
baja la cobertura de una zona.

Suite de aislamiento: recorre `core/registry`, y para cada ruta con `:id` crea el recurso con el
usuario A y lo pide con el B esperando 404; para listados verifica que B no vea nada de A. Una ruta
registrada sin fixture de ataque rompe el test.

## 11. CI/CD

GitHub Actions en cada PR y en `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint` · `pnpm typecheck` · `pnpm format:check`
3. `pnpm test:coverage` (gates por zona)
4. `pnpm build`
5. `pnpm test:e2e` (smoke en PR, completo en `main`)
6. Escaneo de dependencias y secretos

Deploy: Railway despliega `main` a **staging** automaticamente; **prod** por promocion manual del
mismo build tras verificar staging. Migraciones como paso de release previo al arranque.

## 12. Deploy en Railway

| Servicio      | Build                                  | Start                         | Healthcheck |
| ------------- | -------------------------------------- | ----------------------------- | ----------- |
| `api`         | `pnpm turbo build --filter=api...`     | `node apps/api/dist/main.js`  | `/ready`    |
| `pwa`         | `pnpm turbo build --filter=pwa...`     | servidor estatico (Caddy) con headers de seguridad y fallback SPA | `/` |

Cada servicio con su `railway.json`. Healthcheck en `/ready`, no en `/health`: un servicio que
responde pero no puede leer nada no esta listo.

## 13. Jobs

Scheduler in-process (`core/jobs`), un tick por minuto, lock por job en `jobLocks` con
`lockedUntil` (si hay varias instancias, corre una). Cada job es idempotente y escribe `jobRuns`.
Lista en la spec §12.

## 14. Presupuestos de rendimiento

| Recurso                         | Presupuesto          |
| ------------------------------- | -------------------- |
| JS inicial de la PWA (gzip)     | ≤ 180 KB             |
| LCP movil 4G                    | < 2.5 s              |
| p95 API (lecturas)              | < 150 ms             |
| p95 API (escrituras de marcas)  | < 250 ms             |
| Calculo completo 50 marcas      | < 16 ms (un frame)   |

Se mide con Lighthouse CI en PR (PWA) y con `durationMs` de los logs (API).
