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
