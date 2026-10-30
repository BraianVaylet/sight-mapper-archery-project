# Errores — diccionario y manejo

> **Declarar los codigos nuevos aca es parte del Definition of Ready**: una tarea no arranca sin sus
> codigos. Un codigo **nunca se reutiliza** ni cambia de significado; si queda obsoleto se marca
> `deprecated`. → [ADR-010](adr/010-error-contract.md)

---

## 1. Formato del codigo

`SM-<MODULE>-<HTTP>-<NNN>`

- `MODULE`: prefijo del modulo (tabla §3).
- `HTTP`: status con el que responde la API. Para errores que nacen en el cliente (dominio, red) se
  usa el status semantico equivalente (`422`, `503`) para mantener un solo formato.
- `NNN`: correlativo de 3 digitos **por modulo**.

## 2. Respuesta de error unificada

```json
{
  "success": false,
  "error": {
    "code": "SM-MARK-409-001",
    "messageKey": "errors.mark.duplicateDistance",
    "params": { "existingMarkId": "019a…", "distanceM": 40 },
    "requestId": "019a3c5e-…",
    "timestamp": "2026-10-29T14:03:11.412Z"
  }
}
```

- 🔴 **Sin prosa.** `messageKey` + `params`; el idioma lo resuelve el cliente.
- `params` lleva **valores canonicos** (metros, mm); el cliente los convierte a la unidad del
  arquero antes de interpolarlos en el mensaje.
- Errores de validacion agregan `params.issues: { path: string[], messageKey: string, params }[]`
  para marcar cada campo del form.
- Nunca se incluye stack, query, nombre de coleccion ni dato de otro usuario.

## 3. Modulos

| Prefijo | Modulo                     | Origen          |
| ------- | -------------------------- | --------------- |
| `CORE`  | Transversal (HTTP, infra)  | API             |
| `AUTH`  | Identidad (Better Auth)    | API             |
| `ACC`   | `account`                  | API             |
| `BOW`   | `equipment/bows`           | API             |
| `SGT`   | `equipment/sights`         | API             |
| `ARW`   | `equipment/arrows`         | API             |
| `STP`   | `calculator/setups`        | API             |
| `MARK`  | `calculator/manual`        | API             |
| `CALC`  | `@sight-mapper/domain`     | Cliente         |
| `NET`   | Red / cliente HTTP         | Cliente         |
| `MKR`   | `maker` (F2)               | API y cliente   |

## 4. Diccionario

### 4.1 `CORE`

| Codigo            | HTTP | messageKey                         | params                    | Cuando                                                  |
| ----------------- | ---- | ---------------------------------- | ------------------------- | ------------------------------------------------------- |
| `SM-CORE-400-001` | 400  | `errors.core.validation`           | `issues[]`                | Zod rechazo el body, query o params                     |
| `SM-CORE-400-002` | 400  | `errors.core.invalidId`            | `field`                   | Un id no es UUIDv7 valido                               |
| `SM-CORE-401-001` | 401  | `errors.core.unauthenticated`      | —                         | Sin sesion o sesion vencida                             |
| `SM-CORE-404-001` | 404  | `errors.core.routeNotFound`        | —                         | Ruta inexistente                                        |
| `SM-CORE-404-002` | 404  | `errors.core.notFound`             | `resource`                | No existe **o no es tuyo** (nunca 403)                  |
| `SM-CORE-409-001` | 409  | `errors.core.idempotencyMismatch`  | —                         | Misma `Idempotency-Key` con otro cuerpo                 |
| `SM-CORE-409-002` | 409  | `errors.core.idAlreadyExists`      | `resource`                | `POST` con un `id` ya usado (y sin clave coincidente)   |
| `SM-CORE-412-001` | 412  | `errors.core.staleWrite`           | `currentVersion`          | `If-Match` no coincide con la version actual            |
| `SM-CORE-413-001` | 413  | `errors.core.payloadTooLarge`      | `maxBytes`                | Body > 64 KB                                            |
| `SM-CORE-415-001` | 415  | `errors.core.unsupportedMediaType` | —                         | No es `application/json`                                |
| `SM-CORE-428-001` | 428  | `errors.core.preconditionRequired` | `header`                  | Falta `If-Match` o `Idempotency-Key`                    |
| `SM-CORE-429-001` | 429  | `errors.core.rateLimited`          | `retryAfterS`             | Rate limit                                              |
| `SM-CORE-500-001` | 500  | `errors.core.unexpected`           | —                         | Cualquier error no tipado (se loguea con stack)         |
| `SM-CORE-500-002` | 500  | `errors.core.isolationViolation`   | —                         | Query sin `userId` (bug; alerta inmediata)              |
| `SM-CORE-503-001` | 503  | `errors.core.notReady`             | —                         | Mongo no responde                                       |

### 4.2 `AUTH`

| Codigo            | HTTP | messageKey                         | params        | Cuando                                                 |
| ----------------- | ---- | ---------------------------------- | ------------- | ------------------------------------------------------ |
| `SM-AUTH-400-001` | 400  | `errors.auth.weakPassword`         | `minLength`   | Contraseña < 8                                          |
| `SM-AUTH-400-002` | 400  | `errors.auth.invalidOrExpiredToken`| —             | Token de verificacion o reset invalido, vencido o usado |
| `SM-AUTH-400-003` | 400  | `errors.auth.invalidUsername`      | `pattern`     | Username fuera de `[a-z0-9._]{3,30}`                    |
| `SM-AUTH-401-001` | 401  | `errors.auth.invalidCredentials`   | —             | Email/username o contraseña incorrectos (no dice cual)  |
| `SM-AUTH-403-001` | 403  | `errors.auth.emailNotVerified`     | —             | Login sin verificar el email                            |
| `SM-AUTH-409-001` | 409  | `errors.auth.emailTaken`           | —             | Email ya registrado                                     |
| `SM-AUTH-409-002` | 409  | `errors.auth.usernameTaken`        | —             | Username ya usado                                       |
| `SM-AUTH-502-001` | 502  | `errors.auth.oauthProvider`        | `provider`    | Falla de Google                                         |

### 4.3 `ACC`

| Codigo           | HTTP | messageKey                           | params              | Cuando                                    |
| ---------------- | ---- | ------------------------------------ | ------------------- | ----------------------------------------- |
| `SM-ACC-404-001` | 404  | `errors.account.noDeletionRequest`   | —                   | Cancelar una baja que no existe           |
| `SM-ACC-409-001` | 409  | `errors.account.deletionAlreadyRequested` | `purgeAt`      | Pedir la baja dos veces                   |
| `SM-ACC-422-001` | 422  | `errors.account.invalidQuickAccess`  | —                   | El set de flechas no pertenece al setup   |

### 4.4 `BOW`, `SGT`, `ARW`

| Codigo           | HTTP | messageKey                          | params                     | Cuando                                                  |
| ---------------- | ---- | ----------------------------------- | -------------------------- | ------------------------------------------------------- |
| `SM-BOW-409-001` | 409  | `errors.equipment.inUse`            | `setups`, `marks`          | Borrar un arco usado por setups                         |
| `SM-BOW-422-001` | 422  | `errors.bow.unsupportedType`        | `bowType`                  | `bowType` distinto de `compound` (MVP)                  |
| `SM-SGT-409-001` | 409  | `errors.equipment.inUse`            | `setups`, `marks`          | Borrar una mira usada por setups                        |
| `SM-SGT-409-002` | 409  | `errors.sight.marksOutOfRange`      | `count`, `minMm`, `maxMm`  | Cambio de escala que deja marcas afuera                 |
| `SM-SGT-409-003` | 409  | `errors.sight.scaleChangeNeedsStrategy` | `marks`                | Cambio de unidad/tamaño con marcas y sin `strategy`     |
| `SM-SGT-422-001` | 422  | `errors.sight.fixedUnitSize`        | `unit`, `unitSizeMm`       | Se intento fijar `unitSizeMm` en `mm`, `cm` o `in`       |
| `SM-ARW-409-001` | 409  | `errors.equipment.inUse`            | `setups`, `marks`          | Borrar un set de flechas usado por setups               |

### 4.5 `STP`

| Codigo           | HTTP | messageKey                          | params                     | Cuando                                                    |
| ---------------- | ---- | ----------------------------------- | -------------------------- | --------------------------------------------------------- |
| `SM-STP-409-001` | 409  | `errors.setup.duplicateBowSight`    | `existingSetupId`          | Ya hay un setup con ese arco y esa mira                   |
| `SM-STP-409-002` | 409  | `errors.setup.arrowSetHasMarks`     | `arrowSetId`, `marks`      | Quitar del setup un set de flechas con marcas             |
| `SM-STP-410-001` | 410  | `errors.setup.restoreExpired`       | `deletedAt`                | Restaurar despues de 30 dias                              |
| `SM-STP-422-001` | 422  | `errors.setup.componentUnavailable` | `kind`, `id`               | Componente inexistente, ajeno o archivado                 |
| `SM-STP-422-002` | 422  | `errors.setup.noArrowSets`          | —                          | Quedaria sin sets de flechas                              |

### 4.6 `MARK`

| Codigo            | HTTP | messageKey                         | params                           | Cuando                                           |
| ----------------- | ---- | ---------------------------------- | -------------------------------- | ------------------------------------------------ |
| `SM-MARK-409-001` | 409  | `errors.mark.duplicateDistance`    | `existingMarkId`, `distanceM`    | Ya hay marca a esa distancia (usar `replace`)    |
| `SM-MARK-410-001` | 410  | `errors.mark.restoreExpired`       | `deletedAt`                      | Deshacer despues de 30 dias                      |
| `SM-MARK-422-001` | 422  | `errors.mark.outOfScale`           | `minMm`, `maxMm`                 | Lectura fuera de la escala de la mira            |
| `SM-MARK-422-002` | 422  | `errors.mark.arrowSetNotInSetup`   | `arrowSetId`                     | El set de flechas no es del setup                |

### 4.7 `CALC` (cliente, desde `@sight-mapper/domain`)

No son excepciones: el dominio devuelve resultados discriminados y la UI los traduce.

| Codigo            | messageKey                       | params                 | Cuando                                               |
| ----------------- | -------------------------------- | ---------------------- | ---------------------------------------------------- |
| `SM-CALC-422-001` | `errors.calc.needMarksInterpolate` | `have`, `need: 2`    | Menos de 2 marcas                                    |
| `SM-CALC-422-002` | `errors.calc.needMarksExtrapolate` | `have`, `need: 3`    | Distancia fuera del rango con menos de 3 marcas      |
| `SM-CALC-422-003` | `errors.calc.needMarksDoctor`    | `have`, `need: 5`      | Doctor con menos de 5 marcas                         |
| `SM-CALC-422-004` | `errors.calc.beyondVertex`       | `maxDistanceM`         | Extrapolacion mas alla del vertice de la parabola    |
| `SM-CALC-422-005` | `errors.calc.outOfScale`         | `valueMm`, `minMm`, `maxMm` | Resultado fuera de la escala (aviso, no bloqueo) |

### 4.8 `NET` (cliente)

| Codigo           | messageKey                 | Cuando                                             |
| ---------------- | -------------------------- | -------------------------------------------------- |
| `SM-NET-503-001` | `errors.net.offline`       | Sin conexion (`navigator.onLine === false` o fetch fallo) |
| `SM-NET-504-001` | `errors.net.timeout`       | Timeout de 10 s                                    |
| `SM-NET-500-001` | `errors.net.badResponse`   | Respuesta no parseable o sin envelope              |

## 5. Manejo en el backend

```ts
// core/http/errors.ts
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,          // union tipada generada desde este diccionario
    readonly params: Record<string, unknown> = {},
  ) { super(code); }
  get status(): number { return Number(this.code.split('-')[2]); }
  get messageKey(): string { return ERROR_CATALOG[this.code].messageKey; }
}
```

1. **Dominio y casos de uso** lanzan `AppError` con codigo del catalogo (`@sight-mapper/types`). Un
   codigo que no esta en el catalogo no compila.
2. **Zod** en el borde → `SM-CORE-400-001` con `issues` (path + messageKey por campo).
3. **Better Auth** → adaptador que mapea sus errores a `SM-AUTH-*`.
4. **Mongo**: `E11000` sobre un indice unico conocido → su 409 de negocio; cualquier otro error de
   driver → `SM-CORE-500-001`.
5. **Error middleware** unico: arma el envelope, agrega `requestId` y `timestamp`, y loguea:

   | Status            | Nivel de log | Stack |
   | ----------------- | ------------ | ----- |
   | 401, 404          | `info`       | no    |
   | otros 4xx         | `warn`       | no    |
   | 5xx               | `error`      | si    |

6. Nada de `try/catch` que trague errores: o se traduce a `AppError`, o se deja subir.

## 6. Manejo en el cliente (PWA)

1. `@sight-mapper/client` convierte toda respuesta no-2xx en `ApiError { code, messageKey, params,
   requestId }`; si no hay envelope → `SM-NET-500-001`; sin red → `SM-NET-503-001`.
2. **Reintentos** (TanStack Query): nunca en 4xx; hasta 2 con backoff en 5xx, `NET-*` y 429
   (respetando `retryAfterS`).
3. **Mutaciones optimistas**: `onError` revierte el cache y muestra toast `t(messageKey, params)`.
4. **Forms**: `issues` de `SM-CORE-400-001` se mapean a los campos por `path`; los 409/422 de negocio
   con `params` conocidos se muestran en el campo relacionado (ej. `SM-MARK-422-001` en "lectura").
5. **Flujos guiados por codigo**:

   | Codigo             | Respuesta de la UI                                             |
   | ------------------ | -------------------------------------------------------------- |
   | `SM-MARK-409-001`  | Dialogo "¿Reemplazar?" → reenvia con `replace: true`           |
   | `SM-*-409-001` (inUse) | Dialogo con conteos + boton "Archivar"                     |
   | `SM-SGT-409-003`   | Dialogo de estrategia `keepReadings` / `keepPositions`         |
   | `SM-STP-409-001`   | Enlace "Agregar flechas al setup existente"                    |
   | `SM-CORE-412-001`  | Recarga el recurso y muestra "Alguien lo cambio antes" con diff |
   | `SM-CORE-401-001`  | Redirige a login conservando la ruta                           |
   | `SM-AUTH-403-001`  | Pantalla "Verifica tu email" con reenvio                       |

6. **Error boundary** por ruta: `ErrorState` con "Reintentar" y el `requestId` copiable (para
   soporte). Nunca pantalla en blanco.
7. Los mensajes viven en `errors.*` de los catalogos ES/EN. Test: todo codigo del catalogo tiene
   su clave en ambos idiomas.

## 7. Como agregar un codigo

1. Elegir modulo y siguiente `NNN` libre de ese modulo.
2. Agregar fila aca (codigo, HTTP, messageKey, params, cuando).
3. Agregar la entrada al catalogo tipado en `@sight-mapper/types` y las claves ES/EN en
   `@sight-mapper/i18n`.
4. Test que lo provoque (integracion para API, unitario para dominio).
