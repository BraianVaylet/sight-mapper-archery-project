# Diccionario — Sight Mapper

> Lenguaje ubicuo (§1–2) y diccionario de datos campo por campo (§3–5). Si un termino se usa en el
> codigo, en la UI o en un documento, tiene que estar aca y significar lo mismo en los tres lados.
>
> Convencion: **codigo en ingles**, documentacion en español, UI en ES y EN via catalogos.

---

## 1. Glosario del producto

| Termino (ES)               | UI EN                 | Codigo                | Significado                                                                                          |
| -------------------------- | --------------------- | --------------------- | ---------------------------------------------------------------------------------------------------- |
| **Marca**                  | Sight mark            | `Mark`                | Donde va la mira, en su escala, para una distancia dada con un setup y un set de flechas. El dato central |
| **Marca medida**           | Registered            | `origin: 'measured'`  | Marca que el arquero obtuvo tirando. Es la verdad: el modelo pasa exacto por ella                    |
| **Marca calculada**        | Calculated            | `kind: 'interpolated' \| 'extrapolated'` | Lectura estimada por el modelo. Nunca se guarda; siempre se muestra con `≈`        |
| **Marca consultada**       | Custom distance       | `query`               | Calculada a pedido para una distancia libre. Se resalta, no se guarda                                |
| **Marca sospechosa**       | Suspect               | `DoctorFinding`       | Marca medida que el Mark Doctor señala como probablemente mal medida                                 |
| **Semilla balistica**      | Seeded (F6)           | `origin: 'seeded'`    | Marca generada desde las specs del equipo antes de tirar. Siempre estimada; cede ante cualquier medida |
| **Lectura**                | Sight reading         | `reading`             | El numero que el arquero ve en su mira (en la unidad de la escala)                                   |
| **Posicion de escala**     | —                     | `scaleValueMm`        | La lectura convertida a milimetros fisicos. Canonico de persistencia                                 |
| **Deriva**                 | Windage               | `windageMm`           | ~~Posicion horizontal de la mira. Fuera del MVP~~ [~] Posicion horizontal de la mira en una marca, en mm de su escala horizontal (F1-42). Solo se anota; nunca se estima |
| [+] **Escala horizontal**  | Windage scale         | `windageScale`        | La escala de la perilla horizontal. Misma forma que `SightScale`; direccion `right` \| `left`        |
| **Arco**                   | Bow                   | `Bow`                 | El arco y su configuracion. MVP: compuesto                                                           |
| **Mira**                   | Sight                 | `Sight`               | Mira fisica del arquero con su escala                                                                |
| **Set de flechas**         | Arrow set             | `ArrowSet`            | Un grupo de flechas iguales. Es lo que mas cambia la calibracion                                     |
| **Setup**                  | Setup                 | `Setup`               | 1 arco + 1 mira + 1..N sets de flechas. A el (y a un set de flechas) pertenecen las marcas            |
| **Escala**                 | Sight scale           | `SightScale`          | La regla fisica de la mira: unidad, minimo, maximo, resolucion, direccion                            |
| **Unidad de escala**       | Units                 | `scale.unit`          | `mm`, `cm`, `in`, `click` o `custom` (tape impreso con numeracion propia, ej. 1–9)                   |
| **Tamaño de unidad**       | Unit size             | `scale.unitSizeMm`    | Cuantos mm fisicos mide una unidad de la escala                                                      |
| **Resolucion (quantum)**   | Adjustment resolution | `scale.resolution`    | El paso minimo que el arquero puede fijar. Las lecturas se redondean a el                            |
| **Direccion de escala**    | Scale direction       | `scale.direction`     | `down`: los numeros crecen hacia abajo · `up`: crecen hacia arriba                                   |
| **Recorrido**              | Adjustment range      | derivado              | Largo fisico entre minimo y maximo: `(max − min) × unitSizeMm`                                       |
| **Tipo de pin**            | Pin configuration     | `pinType`             | `monopin`, `dualpin`, `multipin`                                                                     |
| **Regla**                  | Sight scale (pantalla)| `Ruler`               | La regla ~~vertical~~ [~] vertical u horizontal (deriva) en pantalla que imita la escala de la mira. Pantalla estrella                      |
| **Tape**                   | Sight tape            | `Tape` (F2)           | Cinta impresa a escala real que se pega en la mira                                                   |
| **Listado imprimible**     | Print                 | `PrintableList`       | Hoja con la tabla distancia → lectura (el "papelito" impreso). MVP                                    |
| **Distancias intermedias** | Intermediate distances| `intermediateGrid`    | Tabla de distancias entre un minimo y un maximo con paso fijo                                        |
| **Mark Doctor**            | Doctor                | `diagnose`            | Analisis que señala la marca probablemente mal medida                                               |
| **Residuo**                | Residual              | `residual`            | Diferencia entre lo medido y lo que predice la tendencia sin esa marca (leave-one-out)              |
| **Monotonia**              | —                     | `monotonicity`        | A mas distancia, la mira siempre se mueve en el mismo sentido                                        |
| **Acceso rapido**          | Always open here      | `quickAccess`         | Setup + set de flechas que se abre directo al iniciar la app                                         |
| **Favorito**               | Favorite              | `isFavorite`          | Setup fijado arriba en el Home                                                                       |
| **Archivar**               | Archive               | `status: 'archived'`  | Ocultar un componente o setup sin borrarlo                                                           |
| **Papelera**               | Trash                 | `deletedAt`           | Setups borrados, restaurables 30 dias                                                                |
| **Sistema de unidades**    | Units                 | ~~`unitSystem`~~ [~] `units` | [~] `metric` o `imperial` **por seccion**: marcas (m / yd), arco, flechas y mira (RF-ACC-04)   |
| **Corte por angulo**       | Angle cut (F3)        | `angleCut`            | Distancia horizontal = `cos(angulo) × distancia en linea de vision`                                  |
| **Preset de ronda**        | Round preset (F3)     | `RoundPreset`         | Distancias tipicas: WA 70/50, sala 18/25, NFAA Field/Hunter, 3D                                      |
| **Calibracion de impresora** | Printer calibration (F2) | `printScaleFactor` | Factor que corrige el reescalado del navegador, medido sobre una barra de 100 mm                     |

## 2. Glosario tecnico del arco y la flecha

| Termino                | Significado                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| **IBO**                | Velocidad estandar del arco (fps) medida con 70 lb, 30 in de draw y flecha de 350 gr                 |
| **Let-off**            | Porcentaje de reduccion de la fuerza en el muro de un compuesto                                      |
| **Draw length**        | Largo de apertura                                                                                    |
| **Draw weight**        | Libraje real al que esta regulado el arco                                                            |
| **ATA (axle-to-axle)** | Distancia entre ejes de las poleas                                                                   |
| **Brace height**       | Distancia de la cuerda al punto mas profundo del grip, en reposo                                     |
| **Cam type**           | Sistema de poleas: `single`, `hybrid`, `binary`                                                      |
| **Sight radius**       | Distancia del peep (ojo) al pin de la mira, en apertura                                              |
| **Peep height**        | Distancia vertical del peep a la flecha (el diseño lo llama "Peep length")                           |
| **D-loop**             | Lazo de cuerda donde engancha el disparador                                                          |
| **Rest**               | Apoyaflechas                                                                                         |
| **Spine**              | Rigidez del tubo: deflexion en milesimas de pulgada (300, 400...). Menor = mas rigido                |
| **GPI**                | Peso del tubo en granos por pulgada                                                                  |
| **Point / arrowhead**  | Punta                                                                                                |
| **Extra weight**       | Peso agregado: insert, outsert, pesas                                                                |
| **Vanes / nock**       | Plumas y culatin                                                                                     |
| **FOC**                | Porcentaje de peso adelante del centro (F6, derivado)                                                |

## 3. Diccionario de datos

Convenciones de todas las colecciones de negocio:

| Campo        | Tipo                    | Regla                                                         |
| ------------ | ----------------------- | ------------------------------------------------------------- |
| `_id`        | `string` UUIDv7         | Generado por el cliente; validado como UUIDv7 en el borde      |
| `userId`     | `string`                | Sale de la sesion. Primer campo de todo indice compuesto      |
| `version`    | `int ≥ 1`               | Se incrementa en cada escritura. Es el `If-Match`             |
| `createdAt`  | `Date` (UTC)            | `Temporal.Instant` en el dominio; `Date` solo en persistencia |
| `updatedAt`  | `Date` (UTC)            | Se muestra como "ultima edicion"                              |
| `deletedAt`  | `Date \| null`          | `null` explicito al crear (lo necesitan los indices parciales) |

"Pres. metrico / imperial" = unidad en la que se **muestra y se ingresa** segun ~~`unitSystem`~~
[~] el sistema de su seccion (`units.bow` en §3.1, `units.arrows` en §3.3; spec §17.2, cerrada el
2026-11-17). Lo canonico es lo que se guarda.

[+] **Rangos (RN-EQP-03).** Cubren equipo real, de juvenil a caza pesada, mas margen contra errores
de tipeo; la nota de cada campo dice el **motivo**. Solo se ensanchan, nunca se angostan (un dato
guardado tiene que poder volver a guardarse). En el formulario se muestran en la unidad de la
seccion, redondeados hacia adentro con esta precision: in, cm, lb y kg con 1 decimal; mm, fps, m/s,
g y gr enteros. Las notas dan el equivalente imperial; el metrico se calcula igual (kg con
`N_PER_KGF`, UNIDADES §2). Las **fuentes** de cada motivo (catalogos de fabricantes) las agrega
F1-39. Revisados el 2026-11-17: se ensancharon los minimos de
`iboSpeedMps` (60 → 45), `drawLengthMm` (450 → 300), `drawWeightN` (45 → 20) y `cutLengthMm`
(400 → 300), que dejaban afuera arcos y flechas juveniles. [+] En F1-39 (2026-11-17), al buscar las
fuentes, tambien el maximo de `spine` (2000 → 2600): el aluminio juvenil de Easton llega a 2501.

[+] **Fuentes de los motivos** (consultadas el 2026-11-17; las marcas `[F1]`..`[F3]` en las notas):

- **[F1] Arco juvenil, Diamond (Bowtech) Atomic:** 6–29 lb, apertura 12–24", IBO 191 fps (≈ 58 m/s),
  24" eje a eje, brace 6". Es el piso de `drawWeightN`, `drawLengthMm` e `iboSpeedMps`: el minimo
  viejo de IBO (60 m/s ≈ 197 fps) lo dejaba afuera. Ficha en
  [Mike's Archery](https://mikesarchery.com/diamond-archery-atomic-youth-compound-bow-pkg-6-29-rh-green/)
  y [Midwest Archery](https://midwestarchery.com/products/diamond-atomic-youth-compound-bow-rh).
- **[F2] Spine y GPI, tabla de seleccion de Easton (target):** juveniles de 2000 (3.4 gpi) a 1000, y
  aluminio 1214 con spine 2501.
  [Easton Target 2025](https://eastonarchery.com/wp-content/uploads/2024/11/Easton-Target-2025-Small.pdf),
  [tabla de seleccion](https://www.southamptonarcheryclub.org/files/EastonShaftSelector.pdf).
- **[F3] Techo de IBO:** el compuesto de serie mas rapido bien documentado en 2025 es el Mathews
  LIFT XD, ~363 fps (≈ 111 m/s), con margen hasta 135 m/s.
  [AllOutdoor](https://www.alloutdoor.com/2025/09/16/fastest-mathews-bow/).
- El resto de los motivos (brace, eje a eje, radio de mira, peep, D-loop, pesos de punta y total)
  son rangos de uso corriente sin una fuente unica; su margen es contra errores de tipeo.

### 3.1 `bows`

| Campo           | Tipo     | Canonico | Pres. metrico / imperial | Req. | Validacion               | Nota                          |
| --------------- | -------- | -------- | ------------------------ | ---- | ------------------------ | ----------------------------- |
| `bowType`       | enum     | —        | —                        | si   | `compound` (MVP)         | Discriminador                 |
| `nickname`      | string   | —        | —                        | no   | 1–40                     | Si falta: fabricante + modelo |
| `manufacturer`  | string   | —        | —                        | *    | 1–60                     | *al menos uno de los dos      |
| `model`         | string   | —        | —                        | *    | 1–60                     |                               |
| `iboSpeedMps`   | number   | m/s      | m/s / fps                | no   | ~~60–135~~ [~] 45–135    | ≈ 148–442 fps. Motivo: compuestos juveniles (~190 fps) [F1] a los mas rapidos de serie (~363 fps) [F3], con margen |
| `letOffPct`     | number   | %        | %                        | no   | 0–99                     | Motivo: 100% seria peso cero en la pared; reales 65–90% |
| `drawLengthMm`  | number   | mm       | cm / in                  | no   | ~~450–900~~ [~] 300–900  | ≈ 11.9–35.4 in. Motivo: modulos juveniles desde 12 in [F1] hasta ~34 in de adulto alto |
| `drawWeightN`   | number   | N        | kg / lb                  | no   | ~~45–450~~ [~] 20–450    | ≈ 4.5–101.1 lb. Motivo: juveniles desde 6 lb [F1] hasta caza pesada (~90 lb), con margen |
| `camType`       | enum     | —        | —                        | no   | `single \| hybrid \| binary` |                           |
| `axleToAxleMm`  | number   | mm       | cm / in                  | no   | 500–1200                 | ≈ 19.7–47.2 in. Motivo: juveniles (~25 in) a target largos (~41 in) con margen |
| `braceHeightMm` | number   | mm       | mm / in                  | no   | 100–260                  | ≈ 4.0–10.2 in. Imperial admite `6 1/4`. Motivo: compuestos de 5 a 8 in con margen |
| `sightRadiusMm` | number   | mm       | cm / in                  | no   | 400–1200                 | ≈ 15.8–47.2 in. Motivo: caza con mira corta (~22 in) a target con barra larga (~37 in) |
| `peepHeightMm`  | number   | mm       | mm / in                  | no   | 20–250                   | ≈ 0.8–9.8 in. "Peep length" en el diseño. Motivo: altura del peep sobre la flecha, 3–6 in tipico; el minimo es anti-tipeo |
| `dLoopLengthMm` | number   | mm       | mm / in                  | no   | 5–150                    | ≈ 0.2–5.9 in. Motivo: D-loop de 3/8 a 1 in tipico; el maximo es anti-tipeo (no se angosta) |
| `rest`          | string   | —        | —                        | no   | 0–80                     |                               |
| `notes`         | string   | —        | —                        | no   | 0–500                    | Complementa, no reemplaza     |
| `status`        | enum     | —        | —                        | si   | `active \| archived`     | Solo por transicion           |

### 3.2 `sights`

| Campo              | Tipo          | Canonico          | Req. | Validacion                                             | Nota                                   |
| ------------------ | ------------- | ----------------- | ---- | ------------------------------------------------------ | -------------------------------------- |
| `nickname`         | string        | —                 | no   | 1–40                                                   |                                        |
| `manufacturer`     | string        | —                 | *    | 1–60                                                   | *al menos uno con `model`              |
| `model`            | string        | —                 | *    | 1–60                                                   |                                        |
| `pinType`          | enum          | —                 | si   | `monopin \| dualpin \| multipin`                       | Default `monopin`                      |
| `scale.unit`       | enum          | —                 | si   | `mm \| cm \| in \| click \| custom`                    | MOA descartado                         |
| `scale.unitSizeMm` | number\|null  | mm por unidad     | cond.| fijo para mm/cm/in; `> 0` o `null` en click/custom     | `null` ⇒ sin escala fisica, sin tape   |
| `scale.min`        | number        | unidad de escala  | si   | `< max`                                                | Ej. 1                                  |
| `scale.max`        | number        | unidad de escala  | si   | `> min`                                                | Ej. 9                                  |
| `scale.resolution` | number        | unidad de escala  | si   | `> 0`, `≤ max − min`                                   | Ej. 0.5 mm, 1 click, 0.1               |
| `scale.direction`  | enum          | —                 | si   | `down \| up`                                           | Default `down`                         |
| [+] `windageScale` | object\|null  | —                 | no*  | mismas reglas que `scale.*`                            | *el formulario de mira nueva la exige; `null` en miras previas a F1-42 |
| [+] `windageScale.direction` | enum | —               | si   | `right \| left`                                        | Visto desde atras de la mira. Default `right` |
| `notes`            | string        | —                 | no   | 0–500                                                  |                                        |
| `status`           | enum          | —                 | si   | `active \| archived`                                   |                                        |

Derivados (no se guardan): `scaleMinMm`, `scaleMaxMm`, `travelMm`. [+] Igual para la escala horizontal: `windageMinMm`, `windageMaxMm`.

### 3.3 `arrowSets`

| Campo              | Tipo   | Canonico | Pres. metrico / imperial | Req. | Validacion | Nota                                  |
| ------------------ | ------ | -------- | ------------------------ | ---- | ---------- | ------------------------------------- |
| `name`             | string | —        | —                        | si   | 1–40       | "Short name"                          |
| `manufacturer`     | string | —        | —                        | no   | 0–60       |                                       |
| `model`            | string | —        | —                        | no   | 0–60       |                                       |
| `spine`            | number | rating   | rating                   | no   | ~~100–2000~~ [~] 100–2600 | Rating de industria: no se convierte. Motivo: tablas de fabricantes, de ~150 (caza pesada) a 2501 (aluminio juvenil Easton 1214) [F2] |
| `cutLengthMm`      | number | mm       | cm / in                  | no   | ~~400–900~~ [~] 300–900 | ≈ 11.9–35.4 in. Motivo: acompaña al largo de apertura (juvenil a adulto alto) |
| `gpi`              | number | gr/in    | gr/in                    | no   | 2–30       | Rating de industria: no se convierte. Motivo: tubos de 5 a 15 gpi tipicos con margen |
| `pointWeightG`     | number | g        | g / gr                   | no   | 1–30       | ≈ 16–462 gr. Motivo: puntas de 60 a 300 gr tipicas con margen |
| `extraWeightG`     | number | g        | g / gr                   | no   | 0–30       | ≈ 0–462 gr. Insert, outsert, pesas. Motivo: mismo techo que la punta |
| `totalWeightG`     | number | g        | g / gr                   | no   | 10–60      | ≈ 155–925 gr. Medido. Si falta, la UI estima. Motivo: juveniles livianas (~200 gr) a caza pesada (~700 gr) |
| `vanes`            | string | —        | —                        | no   | 0–60       | Modelo                                |
| `vaneCount`        | int    | —        | —                        | no   | 2–6        | Motivo: 3 o 4 tipico; 2 y 6 existen   |
| `vaneColor`        | string | —        | —                        | no   | 0–30       |                                       |
| `nock`             | string | —        | —                        | no   | 0–60       |                                       |
| `measuredSpeedMps` | number | m/s      | m/s / fps                | no   | 30–135     | ≈ 99–442 fps. Con cronografo. Motivo: juveniles lentos (~120 fps) al techo del IBO |
| `notes`            | string | —        | —                        | no   | 0–500      |                                       |
| `status`           | enum   | —        | —                        | si   | `active \| archived` |                             |

### 3.4 `setups`

| Campo         | Tipo       | Req. | Validacion                                    | Nota                                  |
| ------------- | ---------- | ---- | --------------------------------------------- | ------------------------------------- |
| `name`        | string     | no   | 1–60                                          | Si falta: modelo de arco · modelo de mira |
| `bowId`       | UUID       | si   | propio y `active` al crear                    |                                       |
| `sightId`     | UUID       | si   | propio y `active` al crear                    |                                       |
| `arrowSetIds` | UUID[]     | si   | 1..20, sin repetidos, propios y `active` al agregar |                                 |
| `isFavorite`  | boolean    | si   | default `false`                               |                                       |
| `status`      | enum       | si   | `active \| archived`                          |                                       |

### 3.5 `marks`

| Campo          | Tipo      | Canonico | Req. | Validacion                                 | Nota                              |
| -------------- | --------- | -------- | ---- | ------------------------------------------ | --------------------------------- |
| `setupId`      | UUID      | —        | si   | propio, no borrado                         |                                   |
| `arrowSetId`   | UUID      | —        | si   | `∈ setup.arrowSetIds`                      |                                   |
| `distanceM`    | number    | m        | si   | `(0, 300]`, redondeo a 0.001               | Se muestra en m o yd              |
| `scaleValueMm` | number    | mm       | si   | `∈ [scaleMinMm, scaleMaxMm]`               | Se muestra como lectura           |
| [+] `windageMm` | number\|null | mm     | no   | `∈ [windageMinMm, windageMaxMm]`; exige `windageScale` | Se muestra como lectura horizontal. `null` = sin anotar |
| `origin`       | enum      | —        | si   | `measured` (MVP) \| `seeded` (F6)          |                                   |
| `note`         | string    | —        | no   | 0–200                                      | Ej. "con viento cruzado"          |
| `measuredAt`   | Date (UTC)| —        | si   | no futura (+5 min de tolerancia)           | Default: ahora                    |

### 3.6 `profiles`

| Campo                 | Tipo          | Req. | Validacion                              | Nota                          |
| --------------------- | ------------- | ---- | --------------------------------------- | ----------------------------- |
| `userId`              | string        | si   | unico                                   |                               |
| `locale`              | enum          | si   | `es \| en`                              | Default: idioma del navegador |
| ~~`unitSystem`~~      | ~~enum~~      | ~~si~~ | ~~`metric \| imperial`~~              | ~~Default por locale~~ [~] Reemplazado por `units`; migra a `units.marks` |
| [+] `units.marks`     | enum          | si   | `metric \| imperial`                    | Solo distancias (m / yd); las lecturas van en la escala de la mira. Default `metric` |
| [+] `units.bow`       | enum          | si   | `metric \| imperial`                    | Campos del arco. Default `imperial` |
| [+] `units.arrows`    | enum          | si   | `metric \| imperial`                    | Campos de flechas. Default `imperial` |
| [+] `units.sight`     | enum          | si   | `metric \| imperial`                    | Preselecciona `mm` / `in` en una mira nueva y muestra los mm sueltos (tolerancia del Doctor). Default `metric` |
| [+] `doctorToleranceMm` | number\|null | no   | `1–10`, multiplo de 0.5; `null` = default 4 | Tolerancia base del Doctor (RN-CAL-06) |
| `theme`               | enum          | si   | `dark \| light \| system`               | Default `system`              |
| `quickAccess`         | object\|null  | no   | `{ setupId, arrowSetId }` validos       |                               |
| `deletionRequestedAt` | Date\|null    | no   | solo via `requestDeletion`              | Purga a los 90 dias           |

### 3.7 Infraestructura

| Coleccion         | Campos                                                                                    | Nota                                  |
| ----------------- | ----------------------------------------------------------------------------------------- | ------------------------------------- |
| `idempotencyKeys` | `userId, key, method, path, requestHash, statusCode, responseBody, responseHeaders, createdAt, expiresAt`  | Indice TTL sobre `expiresAt` (24 h). Solo se guardan respuestas 2xx. `responseHeaders`: `ETag` y `Location` para el replay |
| `jobRuns`         | `job, startedAt, finishedAt, durationMs, status (ok\|failed), error?, stats`               | Retencion 90 dias                     |
| `jobLocks`        | `_id (job), owner, lockedUntil`                                                           | Lock con vencimiento                  |
| Better Auth       | `user, session, account, verification`                                                    | Gestionadas por Better Auth           |

## 4. Indices

| Coleccion   | Indice                                                         | Tipo                                      |
| ----------- | -------------------------------------------------------------- | ----------------------------------------- |
| `bows`      | `{ userId: 1, status: 1, updatedAt: -1 }`                      | listado                                   |
| `sights`    | `{ userId: 1, status: 1, updatedAt: -1 }`                      | listado                                   |
| `arrowSets` | `{ userId: 1, status: 1, updatedAt: -1 }`                      | listado                                   |
| `setups`    | `{ userId: 1, isFavorite: -1, updatedAt: -1 }`                 | Home                                      |
| `setups`    | `{ userId: 1, bowId: 1, sightId: 1 }` unico parcial `deletedAt: {$type: 'null'}` | RN-STP-03              |
| `setups`    | `{ userId: 1, arrowSetIds: 1 }`, `{ userId: 1, sightId: 1 }`   | uso de componentes                        |
| `setups`    | `{ userId: 1, deletedAt: 1 }`                                  | papelera y purga                          |
| `marks`     | `{ userId: 1, setupId: 1, arrowSetId: 1, distanceM: 1 }` unico parcial `deletedAt: {$type: 'null'}` | RN-MRK-04 y lectura |
| `marks`     | `{ userId: 1, arrowSetId: 1 }`                                 | uso de componentes                        |
| `profiles`  | `{ userId: 1 }` unico                                          |                                           |
| `idempotencyKeys` | `{ userId: 1, key: 1 }` unico · `{ expiresAt: 1 }` TTL   |                                           |

Paginacion por cursor sobre `(updatedAt, _id)`: el cursor es opaco (base64url de ambos valores).

## 5. Enumeraciones

| Enum                | Valores                                            | Donde                    |
| ------------------- | -------------------------------------------------- | ------------------------ |
| `BowType`           | `compound` (MVP), `recurve` (F3), `crossbow` (F6+) | `bows.bowType`           |
| `CamType`           | `single`, `hybrid`, `binary`                       | `bows.camType`           |
| `PinType`           | `monopin`, `dualpin`, `multipin`                   | `sights.pinType`         |
| `ScaleUnit`         | `mm`, `cm`, `in`, `click`, `custom`                | `sights.scale.unit`      |
| `ScaleDirection`    | `down`, `up`                                       | `sights.scale.direction` |
| [+] `WindageDirection` | `right`, `left`                                 | `sights.windageScale.direction` |
| `ComponentStatus`   | `active`, `archived`                               | equipo y setups          |
| `MarkOrigin`        | `measured`, `seeded`                               | `marks.origin`           |
| `ComputedKind`      | `measured`, `interpolated`, `extrapolated`         | dominio (no se guarda)   |
| `DoctorStatus`      | `insufficient`, `ok`, `suspect`, `inconsistent`    | dominio (no se guarda)   |
| `Locale`            | `es`, `en`                                         | `profiles.locale`        |
| `UnitSystem`        | `metric`, `imperial`                               | ~~`profiles.unitSystem`~~ [~] `profiles.units.*` |
| `Theme`             | `dark`, `light`, `system`                          | `profiles.theme`         |
| `ScaleChangeStrategy` | `keepReadings`, `keepPositions`                  | `PATCH /sights/:id`      |
