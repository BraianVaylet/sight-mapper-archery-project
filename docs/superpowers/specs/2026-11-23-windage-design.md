# F3-D · Deriva — diseño

> **Revision 2026-11-23 (usuario, sobre el PR #8):** la deriva **no es por marca**. Es **una sola
> deriva de base por setup** (`setup.windageMm`), que vale para todas las distancias y sets de
> flechas. Se edita desde la pantalla de la mira (seccion 03, boton "Editar deriva", con deshacer);
> la regla horizontal muestra esa unica marca; el HUD la muestra para cualquier distancia; el
> listado la imprime en el encabezado. Errores `SM-STP-422-003/-004` (reemplazan a los de marca, que
> nunca salieron). Un cambio de `windageScale` reescala la deriva de los setups que usan la mira. Lo
> que sigue y habla de `mark.windageMm` queda como historia de la primera version.

> Estado: listo para aprobar (revisado por un builder; preguntas abiertas respondidas). Fecha: 2026-11-23. Adelanta F3-D (ACTION-PLAN, fases siguientes)
> a antes del cierre del MVP. Antes de codear se actualiza la spec (§4, §15, §19) y el DICCIONARIO.

## Intencion

Cuando el viento obliga a mover la mira en el eje horizontal, el arquero tiene que poder **volver
al valor real** despues. Hoy la app no guarda la deriva en ningun lado, y ese valor se termina
olvidando. La idea es anotar en cada marca donde va la mira en el eje horizontal, igual que hoy se
anota la altura.

## Objetivos

- Toda mira nueva pide **dos escalas**: la vertical (la de hoy) y la horizontal, con la misma forma.
- Cada marca puede guardar su **deriva** (`windageMm`), opcional.
- La pantalla de la mira muestra **dos reglas**: la vertical y una horizontal con la deriva de las
  marcas medidas.
- La deriva se ve donde hoy se ve la lectura de una marca medida: HUD, tabla, regla e impresion.

## No objetivos

- **No se estima la deriva** en distancias sin marca. No hay modelo, ni Doctor, ni intermedias para
  la deriva. Una distancia calculada no muestra deriva.
- No hay correccion por viento ni clima (eso es F3-C). Esta tarea solo guarda el valor de base.
- No hay migracion que invente escalas horizontales para las miras existentes.

## Anti-objetivos

- Que la deriva parezca calculada cuando no lo es, o que un valor calculado se muestre como medido.
- Que guardar una marca sin deriva se vuelva mas lento o pida un campo de mas.
- Que las miras viejas queden inutilizables porque les falta la escala horizontal.

## Restricciones (no negociables del repo)

- Canonico en milimetros (ADR-005): la deriva se persiste como `windageMm`, igual que `scaleValueMm`.
  La conversion a la lectura del arquero queda en el borde de presentacion.
- Zod compartido en `@sight-mapper/schemas`. Errores declarados en `docs/errors.md` antes de codear.
- `@sight-mapper/domain` puro. Las reglas de ADR-001 (lo calculado no se persiste) no se tocan.
- Wire (ADR-006): `If-Match`, `Idempotency-Key`. La deriva se suma a los PATCH existentes.
- Aislamiento: no hay rutas nuevas. Si alguna aparece, lleva su ataque en `isolation.test.ts`.
- DoD completo: ES/EN, dark/light, 360/768/1440, accesible, OpenAPI, bitacora.

## Enfoques considerados

1. **Escala horizontal con la misma forma que la vertical (elegido).** `windageScale` reusa la
   forma de `SightScale` (unidad, tamaño de unidad, min, max, resolucion, direccion). Se reusan:
   `formatReading`, `readingToMm` y `mmToReading`, `scaleBoundsMm`, `buildRuler` y `placeMarks`, el
   reescalado con `keepReadings`/`keepPositions` y la validacion de marcas fuera de rango. Cubre
   perillas en clics, escalas centradas en 0 o no, y tapes propios.
2. **Escala simplificada, ±N alrededor de 0.** Hace el formulario mas corto. Se descarto porque no
   sirve para escalas no centradas ni clics con tamaño propio, y porque duplica conversion y
   reescalado en codigo nuevo.
3. **Numero libre en la marca (lado + valor).** Se descarto porque rompe ADR-005, no valida rango y
   el numero solo lo entiende quien lo anoto.

Lo eligio el usuario: enfoque 1, y "se va a tener dos rulers".

## Diseño

### Datos

- `sight.windageScale`: misma forma que `sight.scale`. Lo unico distinto es la direccion, propia
  del eje: `right` (los numeros crecen hacia la derecha) o `left`. Default `right`.
  - Enum nuevo `WINDAGE_DIRECTIONS = ['right', 'left']` en `@sight-mapper/types`.
  - En la API es opcional: `windageScale: WindageScale | null` en `createSight`, en el recurso `sight`
    y en `sightRef`. Lo obligatorio es el **formulario** de mira nueva en la PWA. Asi las miras
    viejas y `scripts/import-author-data.mjs` (que crea miras por `POST /sights`) siguen andando sin
    cambios. *Llamado propio, por la revision.*
  - En `updateSight`: se puede fijar o cambiar, pero no volver a `null`.
  - **Lado:** no hay concepto de "izquierda/derecha" ni campo de centro. La deriva se muestra como
    la lectura que tiene la perilla, igual que la vertical. Para volver al valor, el arquero
    necesita leer el mismo numero. `direction` dice hacia donde crecen los numeros, **visto por el
    arquero desde atras de la mira**, y solo afecta como se dibuja la regla. *Llamado propio.*
- **Export de cuenta** (`export-data.ts`): suma `windageScale` y `windageMm`, y `schemaVersion` pasa
  a 3. El import acepta las versiones 2 y 3: la 2 entra sin deriva. *Llamado propio.*
- `mark.windageMm`: `number | null`, opcional en create y en update (`null` en el PATCH la borra).
  - Solo se acepta si la mira del setup tiene `windageScale`. Si no la tiene:
    `SM-MARK-422-003` `errors.mark.noWindageScale`.
  - Tiene que caer dentro de `windageScale`. Si no: `SM-MARK-422-004` `errors.mark.windageOutOfScale`,
    params `minMm` y `maxMm`.
- Migracion `migrations/2026112300000-windage.js`: no escribe nada en los documentos (los campos
  nuevos faltan y se leen como `null`). Solo existe si hace falta un indice, y hoy no hace falta.
  **Llamado del builder:** no crear la migracion si no hay nada que migrar. Dejarlo anotado en la
  bitacora.

### Dominio (`@sight-mapper/domain`)

- `SightScale.direction` hoy es `'down' | 'up'`. Hay que generalizar la regla sin tocar la semantica
  vertical. Propuesta: `buildRuler` y `positionOf` reciben la direccion ya normalizada a "crece en el
  sentido del eje" o "decrece". `right` equivale a `down` (el minimo al inicio del eje) y `left` a
  `up`. Una funcion pura `axisDirection(direction)` hace esa traduccion. Formula exacta: llamado del
  builder, con tests.
- El Doctor y el modelo no cambian: siguen usando solo la escala vertical.

### API

- **equipment / sights:** `createSight` y `updateSight` aceptan `windageScale`. El repositorio la
  limpia igual que `scale` (`cleanScale`). OpenAPI actualizado.
- **Cambio de `windageScale` con marcas:** las mismas reglas que la vertical, aplicadas al eje
  horizontal.
  - `SM-SGT-409-003` si cambia el significado y no se manda estrategia.
  - `SM-SGT-409-002` si alguna deriva queda afuera.
  - `rescale` sobre `windageMm`, en la misma transaccion.
  - La estrategia viaja en un campo propio, `windageScaleChangeStrategy`, para poder cambiar las dos
    escalas en un solo PATCH.
  - El puerto `SightMarksPort` suma la variante por eje (`countOutside` y `rescale` con
    `axis: 'vertical' | 'windage'`). Las marcas sin deriva no cuentan.
  - Que `SM-SGT-409-002` y `-003` sumen el param `axis` lo decide el builder. Si se suma, se declara
    en `docs/errors.md`.
- **calculator / marks:** `create-mark` y `update-mark` validan `windageMm` (los dos errores nuevos).
  `mark-checks.ts` ya lee la escala de la mira por puerto, y le suma `windageScale`.
- Tests: create/update de mira con y sin `windageScale`; marca con deriva valida, fuera de rango y
  sin escala; reescalado horizontal; 412 e idempotencia en los PATCH existentes con el campo nuevo.

### PWA

- **Formulario de mira** (`sight-form-screen.tsx` + `.logic.ts`): un segundo bloque "Escala
  horizontal", con los mismos campos y la direccion izquierda/derecha.
  - Obligatorio en mira nueva. **Viene precargado con una copia de la vertical** (unidad, tamaño,
    rango y resolucion, direccion `right`). El arquero confirma o corrige. *Decidido por el usuario.*
  - En una mira vieja sin escala horizontal aparece vacio, con un aviso que explica para que sirve.
  - Si el cambio pide estrategia, sale el mismo dialogo de hoy, pero para el eje horizontal.
- **Hoja de marca** (`mark-sheet.tsx` + `mark-form.logic.ts`): campo opcional "Deriva", leido en
  las unidades de la escala horizontal y con el mismo parseo que la lectura.
  - Si la mira no tiene escala horizontal, el campo no aparece. En su lugar va un link a editar la
    mira.
- **Pantalla de la mira:**
  - HUD: la deriva junto a la lectura, cuando la marca seleccionada es medida y tiene deriva.
  - Tabla: la deriva como segunda linea bajo la lectura, sin columna nueva para que entre en 360 px.
  - Seccion "03 · Deriva": una regla horizontal (`Ruler` con `orientation="horizontal"`) con las
    marcas medidas que tienen deriva, la seleccionada resaltada y teclado igual que la vertical.
    Si la mira no tiene escala horizontal, la seccion muestra el aviso en lugar de la regla.
  - La deriva se muestra como la lectura de la perilla horizontal (`formatReading` con
    `windageScale`), con un rotulo "Deriva" que la distinga de la altura.
- **Impresion:** columna de deriva en la tabla impresa, solo para marcas medidas.
- **Deshacer:** el toast restaura tambien `windageMm`.
- **i18n:** claves nuevas en ES y EN, incluidos los dos errores nuevos.
- **E2E:** se agrega al flujo critico: crear la mira con las dos escalas, cargar una marca con
  deriva y verla en la regla horizontal. El tour de auditorias pasa por la seccion nueva.

### Docs a actualizar antes de codear

- Spec: §4.1 (deriva entra al alcance), §15 (F3-D sale de F3), §19 (motivo).
- `DICCIONARIO.md`: entrada **Deriva** (`windageMm`, sale de F3), `windageScale` y sus filas,
  `WindageDirection` en enums. **Regla**: "vertical" pasa a "vertical u horizontal".
- `DOMINIO.md` y `UX-UI.md`: la segunda regla y el bloque del formulario.
- `errors.md`: `SM-MARK-422-003` y `SM-MARK-422-004`.
- `ACTION-PLAN.md`: tarea nueva F1-42 (deriva por marca), que marca F3-D como adelantada.
  **Va antes de F1-22** (release), que pasa a depender de F1-42. *Decidido por el usuario.* El E2E
  y la importacion contra staging (F1-20, F1-21) se corren con la deriva adentro.
- No hace falta ADR: aplica ADR-005 tal cual.

## Lo que queda al builder

- La formula de `axisDirection` y como `Ruler` dibuja en horizontal (dimensiones, etiquetas sin
  pisarse en 360 px).
- Si `SM-SGT-409-002` y `-003` llevan el param `axis`.
- Si hace falta migracion.
