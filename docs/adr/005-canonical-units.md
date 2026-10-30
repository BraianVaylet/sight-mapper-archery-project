# ADR-005 — Unidades canonicas y escala nativa de la mira

- **Estado:** Aceptada
- **Fecha:** 2026-10-29
- **Relacionadas:** [UNIDADES.md](../domain/UNIDADES.md), spec §7.1, RN-SGT-04

## Contexto

El arquero mide distancias en metros o yardas y lee su mira en escalas muy distintas: milimetros,
pulgadas, clicks de micro-ajuste o un tape numerado (el UV Slider del diseño usa 1–9). El borrador
pedia canonico en mm con `cm | in | click`; el diseño agregaba MOA. Para imprimir un tape a escala
real (F2) hace falta la posicion **fisica**.

## Decision

1. **Canonico:** distancias en **metros** (a 0.001), posiciones de escala en **milimetros**,
   longitudes de equipo en mm, masas en g, velocidades en m/s, libraje en N. Ratings de industria
   (spine, GPI) se guardan como rating. Nunca se guarda un valor convertido a presentacion.
2. **Escala nativa por mira** (`SightScale`): `unit ∈ {mm, cm, in, click, custom}`, `unitSizeMm`
   (fijo para mm/cm/in; definido por el arquero para click/custom, o `null` si no lo sabe), `min`,
   `max`, `resolution` (quantum) y `direction`. Conversion lineal sin offset:
   `posicionMm = lectura × unitSizeMm`.
3. **MOA se descarta**: es angular y no aplica a la escala lineal de una mira de arco.
4. **Redondeo solo al mostrar**, al quantum de la mira, con aritmetica entera de quanta.
5. **Cambio de escala con marcas** exige estrategia explicita: `keepReadings` (default) o
   `keepPositions`, aplicada en una transaccion sobre la mira y todas sus marcas.
6. La conversion vive en `@sight-mapper/domain/convert` y ocurre solo en el borde de presentacion.

## Alternativas consideradas

| Alternativa                              | Por que no                                                           |
| ---------------------------------------- | -------------------------------------------------------------------- |
| Guardar la lectura tal cual (sin mm)     | Sin posicion fisica no hay regla a escala ni tape                    |
| Solo `mm \| in \| click`                 | Deja afuera las miras con tape numerado                              |
| Guardar valor + unidad tal como se ingreso | Dos verdades; comparaciones y calculo con conversiones por todos lados |
| Canonico en unidades de industria (in, gr, fps) | Distancias y escala necesitan metrico para el calculo; mezclar sistemas complica |

## Consecuencias

- Positivas: un solo sistema adentro; cambiar de metrico a imperial no toca datos; base directa
  para el tape (F2).
- Negativas: el cambio de `unitSizeMm` con marcas requiere migracion explicita; la presentacion del
  equipo por sistema queda como decision abierta (spec §17.2).
- Riesgo: errores de punto flotante en ida y vuelta. Mitigacion: test no negociable #6 con
  propiedades.

## Como se hace cumplir

Schemas Zod nombran el campo con su unidad (`distanceM`, `scaleValueMm`, `drawWeightN`). Test de ida
y vuelta con `fast-check`. ESLint impide importar `convert/` desde `apps/api` en rutas de escritura
(la API recibe y guarda canonico).
