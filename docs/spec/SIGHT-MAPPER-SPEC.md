# Sight Mapper Archery — Spec

> **Version:** 1.0 · **Fecha:** 2026-10-29 · **Estado:** vigente
>
> **Regla de este documento:** es la fuente de verdad. Si algo queda fuera de spec, **primero se
> actualiza la spec, despues se codea**. Desde la v1.0 los cambios se marcan `[+]` (nuevo) y `[~]`
> (reescrito), y nada se elimina: el texto anterior se conserva tachado. Cada cambio se registra en
> [`../BITACORA.md`](../BITACORA.md).
>
> Deriva de [`../borrador-specs.md`](../borrador-specs.md), que queda como documento historico. Las
> diferencias y su razon estan en §19 y en [`../ANALISIS-INICIAL.md`](../ANALISIS-INICIAL.md).

---

## 1. Resumen

Sight Mapper es una **PWA** para arqueros que usan mira. Registra, por cada combinacion de arco,
mira y set de flechas, **donde va la mira a cada distancia** (la _marca_). Con las marcas que el
arquero midio tirando, calcula las distancias que nunca tiro y detecta marcas que probablemente
esten mal medidas.

**Principio rector — empirico primero:** las marcas salen de las pruebas del arquero, no del
calculo. El modelo pasa **exacto** por cada marca medida; todo lo calculado se muestra **siempre**
como estimado. → [ADR-001](../adr/001-empirical-first.md)

El problema que resuelve:

- El arquero cambia de configuracion seguido y tiene mas de un set de flechas: cada cambio obliga a
  recalibrar.
- La misma mira en otro arco, o el mismo arco con otras flechas, es otra calibracion.
- Hoy se anota en un papel para no cambiar el tape a cada rato. El papel se pierde, se moja y no
  calcula.

### 1.1 Modulos de producto

| Modulo         | Para que                                                           | Donde se usa       | Fase     |
| -------------- | ------------------------------------------------------------------ | ------------------ | -------- |
| **CALCULATOR** | Cargar marcas, ver la regla, calcular intermedias, Mark Doctor     | Movil, en el campo | MVP (F1) |
| **MAKER**      | Diseñar e imprimir el tape a escala real                           | Desktop            | F2       |

## 2. Objetivos y metricas

| Objetivo                                                          | Metrica                                                       | Meta MVP          |
| ----------------------------------------------------------------- | ------------------------------------------------------------- | ----------------- |
| Reemplazar el papelito                                            | Arqueros con ≥ 1 setup y ≥ 2 marcas medidas a los 7 dias      | ≥ 50% de altas    |
| Activacion del calculo                                            | Setups que llegan a 5 marcas medidas (Mark Doctor)            | ≥ 30% de setups   |
| Consulta rapida en el campo                                       | Tiempo de abrir la app a ver la marca (acceso rapido)         | < 3 s en 4G       |
| Detectar marcas mal medidas a tiempo                              | Marcas señaladas por el Doctor que el arquero re-mide         | se mide, sin meta |
| Que pague una suscripcion barata (post-MVP)                       | Conversion trial → pago                                       | fuera del MVP     |

## 3. Usuarios

| Rol     | Sigla | Donde entra | Que hace                                          |
| ------- | ----- | ----------- | ------------------------------------------------- |
| Arquero | AU    | PWA         | Todo: su equipo, sus setups, sus marcas, su cuenta |

No hay super admin ni panel de staff: producto B2C de autoservicio. Perfil objetivo del MVP: arquero
de **compuesto** (target, campo, 3D o caza) que ya calibra su mira a mano.

## 4. Alcance

### 4.1 MVP (Fase 1)

- Cuenta: registro con email + username + password, login con email o username, Google,
  verificacion de email, recupero de contraseña, preferencias, exportar mis datos, pedir la baja.
- Equipo: arcos (**solo compuesto**), miras (escala nativa), sets de flechas. Alta, edicion,
  archivado, borrado protegido.
- Setups: arco + mira + 1..N sets de flechas. Favoritos y acceso rapido.
- Marcas: carga manual, edicion, borrado con deshacer.
- Calculo escalonado: interpolacion (2 marcas), extrapolacion (3), **Mark Doctor** (5).
- Distancias intermedias con paso configurable, consulta de distancia libre, curva.
- **Sistema imperial** (yardas) y metrico, escalas en mm, cm, pulgadas, clicks o escala impresa.
- **i18n ES y EN** completo.
- Tema **dark y light**.
- Listado imprimible de distancias (no es el tape: es la "hoja de papelito").
- PWA instalable, version visible y aviso de nueva version.
- Botones Wind, Weather y la entrada Statistics **visibles y deshabilitados** ("Proximamente").

### 4.2 Despues del MVP (roadmap, §15)

MAKER (tape PDF a escala real), corte por angulo, presets de rondas, correccion por viento/clima y
deriva, recurvo, offline-first, monetizacion, landing, semilla balistica, motor de condiciones,
comparar sets, historial, compartir con coach.

### 4.3 Fuera de alcance, en cualquier fase

- Scoring, planillas de tirada ni bitacora de entrenamiento.
- Torneos, patrullas ni rankings.
- Analisis de forma por video ni IA de tecnica.
- Tienda, venta de equipamiento ni afiliacion.
- Apps nativas de tienda: la distribucion es PWA. → [ADR-003](../adr/003-pwa-distribution.md)
- Red social entre arqueros.
- Copiar o descompilar codigo de la competencia. → [ADR-011](../adr/011-maker-own-implementation.md)

## 5. Modulos

| Modulo (backend) | Submodulos                     | Responsabilidad                                         |
| ---------------- | ------------------------------ | ------------------------------------------------------- |
| `account`        | `profile`, `privacy`           | Preferencias, exportar datos, baja. La identidad es de Better Auth |
| `equipment`      | `bows`, `sights`, `arrows`     | El equipo del arquero                                   |
| `calculator`     | `setups`, `manual`             | Setups y marcas medidas                                 |
| `maker`          | `tape`                         | Diseños de tape y calibracion de impresora (F2)         |

| Paquete puro (`@sight-mapper/domain`) | Responsabilidad                                         |
| ------------------------------------- | ------------------------------------------------------- |
| `calculator/auto`                     | Modelo de marcas: PCHIP + parabola anclada, intermedias |
| `calculator/doctor`                   | Monotonia y residuos leave-one-out                      |
| `calculator/convert`                  | Unidades: distancia, escala de mira, equipo, quantum    |
| `ruler`                               | Geometria de la regla (ticks, densidad, anti-solape)    |
| `maker/tape` (F2)                     | Geometria del tape a escala real                        |

El calculo vive en el paquete de dominio y corre **en el cliente**: la API valida y persiste, no
calcula. → [ARQUITECTURA.md](../ARQUITECTURA.md)

## 6. Requisitos funcionales

Formato: `RF-<MOD>-<NN>`. Los criterios de aceptacion detallados estan en
[FUNCIONAL.md](../FUNCIONAL.md).

### 6.1 Transversales

- **RF-X-01** Toda pantalla que trae datos contempla **cargando, vacio, error y exito**.
- **RF-X-02** Todo lo tocable mide al menos **44×44 px**. Se usa de pie, con guantes, al sol.
- **RF-X-03** La PWA muestra su version (en login y en Perfil) y avisa cuando hay una nueva, con
  boton "Actualizar".
- **RF-X-04** Las acciones sobre marcas son **optimistas**, con deshacer y mensaje de error tipado.
- **RF-X-05** Medido y estimado se distinguen **siempre**, en pantalla y en papel.
- **RF-X-06** Toda entidad muestra su fecha de ultima edicion.
- **RF-X-07** Funcionalidades futuras visibles en el diseño se muestran deshabilitadas con badge
  "Proximamente" y no disparan ninguna accion.

### 6.2 `account`

- **RF-ACC-01** Registro con email, username y contraseña (min. 8, repetida). Envia email de
  verificacion.
- **RF-ACC-02** Login con email **o** username + contraseña, y con Google.
- **RF-ACC-03** Recupero de contraseña por email con enlace de un solo uso que vence.
- **RF-ACC-04** Preferencias: idioma (`es` | `en`), sistema de unidades (`metric` | `imperial`),
  tema (`dark` | `light` | `system`). Cambiar el sistema **no modifica datos**: solo la presentacion.
- **RF-ACC-05** Descargar **todo** lo que se guarda del arquero, en JSON, en el momento.
- **RF-ACC-06** Pedir la baja: se registra con fecha, se ejecuta a los **90 dias** y la pantalla
  explica por que no es inmediata. Se puede cancelar mientras tanto.
- **RF-ACC-07** Cerrar sesion.

### 6.3 `equipment`

- **RF-EQP-01** Alta, edicion, listado y detalle de **arcos** (compuesto). Campos estructurados.
- **RF-EQP-02** Alta, edicion, listado y detalle de **miras**, con su **escala nativa**: unidad
  (`mm` | `cm` | `in` | `click` | `custom`), tamaño de la unidad en mm cuando corresponde, minimo y
  maximo legibles, resolucion (quantum), direccion de la escala y tipo de pin.
- **RF-EQP-03** Alta, edicion, listado y detalle de **sets de flechas**.
- **RF-EQP-04** Todo componente se puede **archivar** y desarchivar. Archivado no aparece en los
  selectores de setups nuevos; los setups que lo usan siguen funcionando.
- **RF-EQP-05** Borrar un componente usado por un setup **se bloquea** e informa cuantos setups y
  marcas dependen de el; se ofrece archivar.
- **RF-EQP-06** Cambiar la escala de una mira con marcas exige elegir una estrategia explicita
  (§7, RN-SGT-04). Reducir el rango dejando marcas afuera se rechaza indicando cuantas.

### 6.4 `calculator/setups`

- **RF-STP-01** Crear un setup eligiendo 1 arco, 1 mira y 1..N sets de flechas, con nombre opcional.
- **RF-STP-02** Home: listado de setups con arco, mira (con tipo de pin), flechas y ultima edicion.
  Favoritos primero.
- **RF-STP-03** Marcar/desmarcar favorito.
- **RF-STP-04** Elegir un setup + set de flechas como **acceso rapido**: al abrir la app se va
  directo a su pantalla de la mira.
- **RF-STP-05** Agregar o quitar sets de flechas de un setup. Quitar uno con marcas se bloquea.
- **RF-STP-06** Borrar un setup lo envia a la papelera con sus marcas; se puede **restaurar durante
  30 dias**.

### 6.5 `calculator/manual` (marcas)

- **RF-MRK-01** Cargar una marca: distancia (en la unidad del arquero) y lectura (en la escala de
  la mira), nota opcional y fecha de medicion (default: ahora).
- **RF-MRK-02** Una distancia repetida para el mismo (setup, set de flechas) es un **conflicto
  explicito**: el arquero elige reemplazar la anterior o cancelar.
- **RF-MRK-03** Editar y borrar marcas; el borrado se puede deshacer.
- **RF-MRK-04** Pantalla de la mira: encabezado (mira, arco), selector de set de flechas, lectura
  grande de la distancia seleccionada, **regla** con las marcas en su posicion exacta, tabla
  distancia → lectura, boton de nueva marca siempre alcanzable con el pulgar.

### 6.6 `calculator/auto` y `calculator/doctor`

- **RF-CAL-01** Calculo escalonado por cantidad de marcas **medidas** del (setup, set de flechas):

  | Marcas | Se desbloquea                                                            |
  | ------ | ------------------------------------------------------------------------ |
  | 0–1    | Solo lo medido. Aviso de progreso                                        |
  | ≥ 2    | Intermedias **dentro** del rango medido (PCHIP) · chequeo de monotonia   |
  | ≥ 3    | Extrapolacion **fuera** del rango (parabola anclada)                     |
  | ≥ 5    | **Mark Doctor** (residuos leave-one-out)                                 |

- **RF-CAL-02** Distancias intermedias entre un minimo y un maximo elegidos por el arquero, con paso
  de 1, 2, 5 o 10 (m o yd). Default: rango medido, paso 5.
- **RF-CAL-03** Consulta de una distancia libre ("Get reading"): devuelve la lectura estimada sin
  sobrescribir nada.
- **RF-CAL-04** Curva distancia → lectura: medido en linea solida con puntos; estimado en linea
  punteada con rombos.
- **RF-CAL-05** **Mark Doctor**: señala la marca que probablemente este mal medida, con su magnitud
  en la escala de la mira y la sugerencia de volver a tirar esa distancia. Nunca corrige ni borra.
- **RF-CAL-06** Chequeo de monotonia: si una distancia mas larga tiene la mira "mas arriba" que una
  mas corta, se avisa en ambas marcas.
- **RF-CAL-07** Las lecturas se muestran redondeadas al **quantum** de la mira (lo que el arquero
  puede fijar), en el formato numerico del idioma.
- **RF-CAL-08** Listado imprimible de distancias: setup, set de flechas, fecha, tabla distancia →
  lectura, con lo estimado marcado (`≈` y nota al pie).

## 7. Reglas de negocio

### 7.1 Datos y unidades

- **RN-UNI-01** Se guarda canonico: **distancias en metros** (redondeadas a 1 mm) y **posiciones
  de la escala en milimetros**. Nunca se guarda un valor convertido a la unidad de presentacion. →
  [ADR-005](../adr/005-canonical-units.md)
- **RN-UNI-02** La lectura de la mira se convierte con `posicionMm = lectura × unitSizeMm`. Para
  `mm`, `cm` e `in` el tamaño es fijo (1, 10, 25.4); para `click` y `custom` lo define el arquero.
- **RN-UNI-03** Una yarda son exactamente 0.9144 m. Una pulgada, exactamente 25.4 mm.
- **RN-UNI-04** Ida y vuelta sin perdida: convertir a la unidad de presentacion y volver da el
  mismo valor redondeado al quantum de presentacion.

### 7.2 Equipo

- **RN-EQP-01** Campos **estructurados**, no un `notes` libre: sin eso no hay semilla balistica ni
  comparacion entre sets. Todos opcionales salvo los marcados en el diccionario.
- **RN-EQP-02** Un componente referenciado por un setup no borrado no se puede borrar (409). Se
  archiva.
- **RN-BOW-01** `bowType` admite solo `compound` en el MVP.
- **RN-SGT-01** `scaleMin < scaleMax`, en la creacion y en toda edicion.
- **RN-SGT-02** `unit = click | custom` exige `unitSizeMm > 0` para habilitar regla a escala y
  tape; sin el, la regla se dibuja proporcional y MAKER queda bloqueado para esa mira.
- **RN-SGT-03** Reducir `[scaleMin, scaleMax]` dejando marcas afuera responde 409 con la cantidad.
- **RN-SGT-04** Cambiar `unit` o `unitSizeMm` de una mira con marcas exige `strategy`:
  `keepReadings` (default: las lecturas que el arquero anoto se conservan y se recalculan los mm) o
  `keepPositions` (la posicion fisica se conserva y cambian las lecturas). Sin `strategy`, 409.

### 7.3 Setups

- **RN-STP-01** Un setup tiene exactamente 1 arco, 1 mira y **1..N** sets de flechas distintos.
- **RN-STP-02** Un mismo arco, mira o set de flechas puede estar en varios setups.
- **RN-STP-03** No puede haber dos setups no borrados con el mismo par (arco, mira): se agregan
  flechas al existente. → 409
- **RN-STP-04** Solo se pueden usar componentes propios y activos (no archivados) al crear o al
  agregar flechas.
- **RN-STP-05** Quitar de un setup un set de flechas que tiene marcas se bloquea (409).
- **RN-STP-06** Borrar un setup hace soft delete del setup y de sus marcas en una transaccion. Se
  restaura dentro de 30 dias; despues, el job de purga lo elimina.
- **RN-STP-07** Acceso rapido: a lo sumo uno por arquero. Si su setup se borra, se limpia.

### 7.4 Marcas

- **RN-MRK-01** `0 < distanceM ≤ 300`.
- **RN-MRK-02** `scaleValueMm ∈ [sight.scaleMinMm, sight.scaleMaxMm]`, verificado leyendo la mira
  en la misma operacion.
- **RN-MRK-03** El `arrowSetId` de la marca pertenece al setup.
- **RN-MRK-04** Unica por `(setupId, arrowSetId, distanceM)` entre las no borradas. Repetida → 409
  con el id existente; el cliente puede reenviar con `replace: true`.
- **RN-MRK-05** `origin` persistido: `measured` (MVP) o `seeded` (F6). Lo calculado **no se
  persiste**: se calcula siempre a partir de lo medido.
- **RN-MRK-06** Para el calculo cuentan solo las marcas `measured` no borradas del par
  (setup, set de flechas).

### 7.5 Calculo

- **RN-CAL-01** `markAt(d_i)` devuelve **exactamente** la marca medida en `d_i`. Sin excepcion.
- **RN-CAL-02** Entre marcas consecutivas el modelo no sobrepasa ni cambia de direccion.
- **RN-CAL-03** Lo extrapolado se marca estimado y, si se aleja mas de 25% del rango medido, se
  muestra con aviso de baja confianza. Mas alla del vertice de la parabola no se extrapola.
- **RN-CAL-04** Una lectura calculada fuera de la escala de la mira se muestra como "fuera de
  escala", nunca recortada en silencio.
- **RN-CAL-05** El Mark Doctor **no decide** por el arquero: señala y sugiere re-tirar.

## 8. Modelo de datos (resumen)

Detalle en [DOMINIO.md](../DOMINIO.md) y [DICCIONARIO.md](../DICCIONARIO.md).

- Toda coleccion de negocio lleva `userId`. **Sin excepcion.**
- Todo documento lleva `createdAt`, `updatedAt`, `deletedAt` (soft delete) y `version`
  (concurrencia optimista).
- IDs: **UUIDv7 generado por el cliente**. → [ADR-006](../adr/006-client-ids-idempotency.md)
- Fechas en UTC con `Temporal`. Nunca `new Date()` fuera del traductor de persistencia.
- Nombres de campos y colecciones en ingles.

Colecciones: `bows`, `sights`, `arrowSets`, `setups`, `marks`, `profiles`, `idempotencyKeys`,
`jobRuns`, `jobLocks` + las de Better Auth (`user`, `session`, `account`, `verification`).

## 9. API (resumen)

REST bajo `/api/v1/*`. Better Auth en `/api/auth/*`. Fuera de prefijo: `/health` (el proceso vive) y
`/ready` (vive **y** Mongo responde). Detalle de endpoints en [TECNICO.md](../TECNICO.md) §5.

- Exito: el recurso; listados `{ items, nextCursor }`. Paginacion por **cursor**, nunca `skip`.
- Error, siempre la misma forma (`SM-<MOD>-<HTTP>-<NNN>`):

  ```json
  {
    "success": false,
    "error": {
      "code": "SM-MARK-422-001",
      "messageKey": "errors.mark.outOfScale",
      "params": { "minMm": 10, "maxMm": 90 },
      "requestId": "019a3c5e-...",
      "timestamp": "2026-10-29T14:03:11.412Z"
    }
  }
  ```

  🔴 **La API no manda prosa.** Manda `messageKey` y `params`; el idioma lo resuelve el cliente. →
  [ADR-004](../adr/004-i18n.md) · [errors.md](../errors.md)

- `Idempotency-Key` obligatoria en todo `POST`. `If-Match: <version>` obligatoria en `PATCH` y
  `DELETE`.

## 10. Requisitos no funcionales

| Id      | Requisito                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------- |
| RNF-01  | **Rendimiento:** LCP < 2.5 s en movil gama media con 4G; guardar una marca se percibe < 100 ms (optimista) |
| RNF-02  | **Calculo:** modelo + intermedias + Doctor para 50 marcas en < 16 ms en el cliente               |
| RNF-03  | **Disponibilidad:** 99.5% mensual de `/ready` en prod                                             |
| RNF-04  | **Compatibilidad:** Chrome Android 2 ultimas, Safari iOS 16.4+, Chrome/Edge/Firefox/Safari desktop |
| RNF-05  | **Accesibilidad:** WCAG 2.2 AA. Teclado, foco visible, contraste, labels. Toda accion de arrastre tiene equivalente |
| RNF-06  | **Responsive:** verificado en 360, 768 y 1440                                                     |
| RNF-07  | **Temas:** dark y light verificados. Light de alto contraste para uso al sol                       |
| RNF-08  | **i18n:** ES y EN completos; ningun string de usuario fuera de los catalogos; claves tipadas      |
| RNF-09  | **Seguridad:** §11                                                                                |
| RNF-10  | **Observabilidad:** logs JSON estructurados, `requestId` de punta a punta, alertas §12           |
| RNF-11  | **Mantenibilidad:** TypeScript `strict`, sin `any`, fronteras de modulo verificadas por ESLint    |
| RNF-12  | **Datos:** backups automaticos con PITR en Atlas; restore probado antes de salir al mercado       |

## 11. Aislamiento, seguridad y privacidad

**El dueño de los datos es el arquero.** → [ADR-000](../adr/000-data-ownership.md)

🔴 **El `userId` sale de la sesion. Nunca del body, nunca de la query, nunca de un parametro.**

Tres capas, porque ninguna alcanza sola:

1. **El repositorio** inyecta el `userId` en toda consulta. Un controller no puede tocar un modelo
   de Mongoose: lo bloquea ESLint.
2. **Un plugin de Mongoose** es la red: una consulta sin contexto de usuario falla en vez de
   devolver datos de todos.
3. **Una suite parametrizada** recorre el registro de rutas y ataca cada una desde otro usuario.

Todo indice compuesto lleva `userId` primero. Un recurso ajeno responde **404**, no 403.

Seguridad de aplicacion:

- Contraseñas con el hashing de Better Auth. Nunca en logs.
- Rate limit en login, registro, recupero y verificacion.
- Zod en el borde de toda entrada. Ningun objeto del usuario va directo a un `find`.
- Headers: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`. CORS por origen explicito.
- Cookies `httpOnly`, `Secure`, `SameSite=Lax`.
- Secretos en Railway, jamas en el repo. Un hook bloquea su escritura.

Privacidad: se guarda email, username, nombre opcional, equipo y marcas. Nada de salud, ubicacion ni
fotos. Las marcas de un arquero **no se usan para nada agregado** sin consentimiento explicito.

## 12. Observabilidad

- Pino JSON con `ts, level, env, service, module, action, requestId, userId, durationMs,
  errorCode, msg, meta`. Nunca contraseñas, tokens ni secretos, ni en `meta`.
- Alertas: 5xx > 1% en 5 min · job fallido · uptime externo sobre `/ready`. Externo: si el servicio
  cae, un monitor interno cae con el.
- Jobs in-process con lock en Mongo, idempotentes, con registro en `jobRuns`:

  | Job                    | Cuando | Que hace                                              |
  | ---------------------- | ------ | ----------------------------------------------------- |
  | `purgeIdempotencyKeys` | diario | Borra claves vencidas (TTL 24 h; respaldo del indice TTL) |
  | `purgeDeletedSetups`   | diario | Elimina setups y marcas en papelera hace mas de 30 dias |
  | `purgeDeletedAccounts` | diario | Purga cuentas con baja pedida hace mas de 90 dias     |

## 13. Testing

Unitarios junto al codigo (`*.test.ts`), integracion en `apps/api/tests/`, e2e en `e2e/`. La
integracion levanta un **replica set en memoria**: sin el no hay transacciones.

**Los siete tests que no se negocian:**

1. **Aislamiento por usuario**, una vez por endpoint, recorriendo el registro de rutas. Una ruta
   nueva sin su fixture rompe el CI.
2. **El modelo pasa exacto por cada marca medida** (y no sobrepasa entre marcas), con tests de
   propiedades.
3. **Idempotencia:** el mismo `POST` con la misma `Idempotency-Key` tres veces produce un solo
   efecto.
4. **Borrado protegido:** un componente con marcas no se borra y no se pierde ninguna marca.
5. **Cambio de escala de mira:** con `keepReadings`, todas las lecturas quedan iguales.
6. **Unidades ida y vuelta sin perdida** en m/yd y en las cinco unidades de escala.
7. **Escritura obsoleta:** un `PATCH` con `version` vieja responde 412; nunca last-write-wins.

Cobertura por criticidad, aplicada por el CI: `@sight-mapper/domain` 95% · marcas, setups, unidades,
auth 85% · equipo, account 80% · UI generica 50% · **global ≥ 80%**.

## 14. UX / UI

- **Mobile-first.** Se usa de pie, con una mano, con guantes, al sol, quizas sin señal.
- **Sensacion de instantaneo.** Frenar el entrenamiento es el peor pecado del producto.
- Tipos de marca distinguidos visualmente: **medida** (punto lleno, linea solida), **calculada**
  (rombo, linea punteada, `≈`), **consultada** (rombo resaltado) y **sospechosa** (anillo de alerta).
- Detalle del sistema visual, pantallas y estados en [UX-UI.md](../UX-UI.md).

## 15. Roadmap

🔴 **Regla de corte:** ninguna fase arranca sin que la anterior este en produccion y usada por gente
real. Se detalla en tareas solo la fase en curso y la siguiente.

| Fase   | Nombre                 | Contenido                                                                                     |
| ------ | ---------------------- | --------------------------------------------------------------------------------------------- |
| **F0** | Fundaciones            | Monorepo, tooling, CI, docs, dominio puro con tests, API y PWA esqueleto, Mongo, auth, Railway |
| **F1** | MVP — Calculator       | Todo §4.1                                                                                     |
| F2     | MAKER                  | Tape PDF a escala real, calibracion de impresora, editor de forma/tamaño (desktop)            |
| F3     | Campo                  | Corte por angulo (inclinometro), presets de rondas, correccion manual viento/clima, deriva, recurvo |
| F4     | Offline-first          | Cola de escritura, sync, deteccion de escritura obsoleta en la UI                             |
| F5     | Monetizacion y landing | Entitlements, pasarelas detras de adaptador, trial, landing con precios                       |
| F6     | Diferenciacion         | Semilla balistica, motor de condiciones aprendido, comparar sets, historial, compartir con coach |
| F7     | Salida al mercado      | Legales, Sentry, analytics cookieless, restore probado, lanzamiento (CBA, liga bahiense, ArcheryTalk, r/Archery) |

Plan de tareas: [ACTION-PLAN.md](../ACTION-PLAN.md).

## 16. Riesgos

| Riesgo                                       | Prob. | Impacto | Mitigacion                                                                         |
| -------------------------------------------- | ----- | ------- | ---------------------------------------------------------------------------------- |
| Activacion baja: pocos llegan a 2–5 marcas   | media | alto    | Escalonado 2/3/5; onboarding guiado; semilla balistica en F6. Se mide desde el dia uno |
| El math se rompe al reescribirlo desde cero  | media | critico | TDD + tests de propiedades + casos de los datos reales del autor como fixtures     |
| Escalas de mira raras no encajan en el modelo| media | medio   | `custom` con `unitSizeMm`; feedback de usuarios reales en F1                        |
| El i18n toca todo                            | media | medio   | Desde F0, claves tipadas: una clave inventada es error de compilacion             |
| Alcance vertical, mercado chico              | alta  | medio   | Decision tomada. Precio bajo, volumen global, ES+EN (nadie mas lo tiene)           |
| Cobrar desde Argentina (F5)                  | alta  | alto    | Adaptador por proveedor; evaluar Merchant of Record antes de F5                    |
| Dependencia de Google OAuth                  | baja  | medio   | Email + password siempre disponible                                               |

## 17. Decisiones abiertas

1. **Dominio y marca final.** "Sight Mapper" confirmado como nombre; falta dominio (afecta cookies,
   CORS y Google OAuth). Bloquea F0-17.
2. **Unidades de presentacion del equipo.** Propuesta: siguen el sistema elegido (imperial: in, lb,
   gr, fps; metrico: cm/mm, kg, g, m/s). Alternativa: siempre unidades de industria (in, lb, gr,
   fps), que es lo que usa el rubro incluso en paises metricos. Se decide en F1-12 con usuarios.
3. **Umbrales del Mark Doctor.** `DOCTOR_K = 3`, minimo absoluto 1 mm o el quantum. Se calibran con
   los datos reales del autor en F0-05/F1-11.
4. **Merchant of Record** (F5): Lemon Squeezy o Paddle vs Stripe + Mercado Pago.
5. **Portugues:** preparado por ADR-004, no abierto. Se decide con datos de trafico.
6. **Reloj o widget:** una PWA no puede. Se evalua despues de F7 si aparece demanda.

## 18. Glosario de estados

```
bow | sight | arrowSet : active | archived
setup                  : active | archived        (+ deletedAt para papelera)
mark.origin            : measured | seeded         (seeded: F6)
profile.deletion       : none | requested          (requested → purga a los 90 dias)
doctor.status          : insufficient | ok | suspect | inconsistent
```

🔴 Los estados cambian **solo** mediante transiciones explicitas y validadas (`archive`,
`unarchive`, `requestDeletion`, `cancelDeletion`, `restore`). Nunca con un `update` libre del campo.

## 19. Trazabilidad con el borrador

| Borrador                                        | Spec v1.0                                     | Por que                                       |
| ----------------------------------------------- | --------------------------------------------- | --------------------------------------------- |
| `@bow-sight/*`, `BS-*`                          | `@sight-mapper/*`, `SM-*`                     | Producto renombrado; arranque desde cero      |
| `SIGHT_CALC_MIN_MARKS = 5`                      | Escalonado 2/3/5                              | Activacion; la matematica lo permite          |
| Escala `cm \| in \| click`                      | `mm \| cm \| in \| click \| custom`           | Miras con tape numerado (UV Slider 1–9)       |
| Cascada vs bloqueo (contradictorio)             | Bloqueo + archivar; papelera 30 dias en setups| Nunca perder meses de datos en silencio       |
| Estado `locked`, billing, webhooks, CRM, leads  | Fuera del MVP (F5) o eliminado (CRM, leads)   | No hay cobro en el MVP; CRM no es del producto |
| Sharing con `share` aceptado                    | F6                                            | No es MVP                                     |
| Unicidad `(sight, arrowSet)`                    | Unicidad `(setup, arrowSet, distance)`        | La calibracion depende del arco tambien       |
| `mark.origin: measured \| computed \| seeded`   | `measured \| seeded`; lo calculado no se guarda | Lo derivado se recalcula; no hay dos verdades |
| Parabola "suelta" fuera del rango               | Parabola **anclada** al borde                 | Sin salto en el borde del rango medido        |
| Residuos contra la parabola total               | Residuos **leave-one-out** + monotonia        | Un outlier no esconde su propio residuo       |
| Tres apps (api, pwa, landing)                   | Dos en el MVP (api, pwa)                      | Landing es F5                                 |
| `Idempotency-Key` solo en cola offline          | En todo `POST` desde F0                       | El wire no cambia cuando llegue offline (F4)  |

## 20. Criterios transversales (DoR / DoD)

**Definition of Ready** — una tarea puede empezar si tiene:

- [ ] Titulo, descripcion y modulo
- [ ] Criterios de aceptacion verificables (Given/When/Then)
- [ ] Ejemplo concreto de uso, con datos reales
- [ ] Puntos y dependencias declaradas
- [ ] Impacto en el modelo de datos identificado
- [ ] **Codigos de error nuevos declarados en `docs/errors.md`**
- [ ] Pantalla con diseño o boceto aprobado (si tiene UI)

**Definition of Done** — una tarea esta terminada si:

- [ ] Cumple todos los criterios de aceptacion
- [ ] Tests unitarios y de integracion pasando, con la cobertura de su criticidad
- [ ] **Test de aislamiento por usuario incluido** (si toca datos de un arquero)
- [ ] Si toca el dominio: **el modelo pasa exacto por las marcas medidas** sigue verde
- [ ] Validacion Zod compartida front/back en `@sight-mapper/schemas`
- [ ] Errores tipados con codigo, registrados en `docs/errors.md`
- [ ] Logs estructurados en las rutas criticas
- [ ] Estados vacio, de carga y de error implementados
- [ ] Accesible: teclado, foco visible, contraste, labels
- [ ] Responsive verificado (360 / 768 / 1440)
- [ ] Dark y light verificados
- [ ] **ES y EN completos** — ningun string hardcodeado
- [ ] Documentacion y OpenAPI actualizados
- [ ] Entrada en `docs/BITACORA.md` con commit/PR
- [ ] Sin `any`, sin `console.log`, sin TODOs sueltos
- [ ] Desplegado en staging y probado a mano
- [ ] Tarjeta movida en el tablero (si hay tablero)

---

_Fin de la spec v1.0 — documento vivo._
