# apps/api — Hono + Mongoose, monolito modular

Contexto raiz en `../../CLAUDE.md`. Aca, lo especifico de la API.

## Forma

```
src/core/       kernel (no es un modulo): http, db, idempotency, concurrency, events, logger,
                config, clock, registry
src/modules/    account · equipment · calculator   (cada uno: domain · application · infrastructure)
src/composition-root.ts   unico lugar que cablea modulos, puertos y eventos
tests/          integracion contra un replica set real (mongodb-memory-server)
migrations/     migrate-mongo; un archivo nuevo por cambio, nunca editar uno viejo
```

Hoy existen `core/`, `modules/account` (perfil, `/me`) y `modules/equipment` (arcos y miras); miras, flechas y `calculator` llegan con F1.

## Reglas de esta app

- **Todo modelo sale de `createBusinessSchema`** (`core/db/base-schema.ts`): trae aislamiento por
  `userId` y soft delete. Una consulta sin `userId` lanza `SM-CORE-500-002`; no la esquives con el
  driver crudo ni con `withDeleted` fuera de papelera y purga.
- **El `userId` sale de `c.get('userId')`**, puesto por el middleware de sesion. Nunca del body,
  la query ni el path.
- **Toda ruta se registra con `registry.register(route, handler, { auth })`**: de ahi salen
  OpenAPI y la suite de aislamiento. Una ruta fuera del registro no existe.
- **Errores:** solo `throw new AppError('SM-...-NNN-NNN', params)` con un codigo declarado en
  `docs/errors.md` (tipo `ErrorCode`). Nada de `try/catch` que trague: se traduce a `AppError` o
  sube. La respuesta lleva claves, nunca prosa ni stack.
- **Escrituras:** POST pasa por `Idempotency-Key` (ya montado bajo `/api/v1`); PATCH/DELETE por
  `If-Match` (`expectedVersion(c)`); actualizar con `updateWithVersion` (404 si no es tuyo, 412 si
  la version es vieja). Un `_id` repetido es `rethrowDuplicateId` → `SM-CORE-409-002`.
- **Respuestas con recurso:** `setEtag(c, recurso)` y el recurso incluye `version`.
- **Reloj inyectado** (`Clock`), nunca `Date`; `Date` solo vive en `core/db/temporal.ts`.
- **Capas de un modulo:** `domain/` sin Mongoose, Hono ni `core/`; `application/` un caso de uso
  por archivo; `infrastructure/` repositorios (reciben `userId` en el constructor) y rutas. Un
  modulo **no importa a otro**: puertos o eventos (ESLint lo verifica).
- **Logs:** Pino, JSON, con redaccion. Nunca `console.*`. Un 5xx se loguea con stack una sola vez
  (en `onError`).
- **Variables de entorno:** se agregan a `core/config/env.ts` (Zod) y a `.env.example` sin valor.

## Jobs

`core/jobs`: un job es `{ name, intervalMs, run }`, **idempotente**, que devuelve solo conteos. Se registra en
`composition-root.ts`. Corre una vez por ventana en todas las instancias (lock en `jobLocks`) y deja su fila en
`jobRuns`. Un job que cruza usuarios usa el driver, no un modelo con aislamiento, y no lee datos de nadie.

## Probar

```
pnpm --filter @sight-mapper/api test:coverage    # umbral 80%
```

**Toda ruta con sesion necesita su ataque** en `tests/isolation.test.ts` (`productionAttacks`): la suite recorre el
registro y falla si una ruta con `auth: 'session'` no tiene uno. Lo escribis en el mismo cambio que la ruta.

Cada ruta con recurso necesita tres tests: aislamiento (B pide lo de A → 404), idempotencia
(misma clave ×3 → un documento) y escritura obsoleta (`If-Match` viejo → 412). Los tests de BD
usan `tests/helpers/mongo.ts`, que fija `mongod` 7.0.24 (ya en cache local; no se descarga).
