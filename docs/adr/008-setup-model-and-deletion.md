# ADR-008 — Modelo Setup y politica de borrado

- **Estado:** Aceptada
- **Fecha:** 2026-10-29
- **Relacionadas:** [DOMINIO.md](../DOMINIO.md) §2.4–2.5 y §4, spec §7.3–7.4

## Contexto

La calibracion depende de los tres componentes: la misma mira en otro arco, o el mismo arco con
otras flechas, es otra calibracion. El borrador habla de "Setup" (arco + mira + 1..N flechas) y
pide unicidad de marcas por `(sight, arrowSet)`, lo cual ignora el arco. El diseño lo llama "Set",
que choca con "Arrow set". Sobre el borrado, el borrador se contradice (cascada en §5, bloqueo en
§5.2.2).

## Decision

1. **`Setup`** (nombre en UI y codigo) = 1 arco + 1 mira + **1..N** sets de flechas.
2. Las **marcas pertenecen a (setup, set de flechas)**. Unicidad:
   `(userId, setupId, arrowSetId, distanceM)` entre las no borradas.
3. Los componentes son **reutilizables** entre setups. No puede haber dos setups no borrados con el
   mismo par (arco, mira): se agregan flechas al existente.
4. `Mark` es un **agregado propio** (no un array dentro de `Setup`): alta frecuencia de escritura y
   concurrencia independiente.
5. **Borrado de componentes protegido:** si un setup no borrado lo usa → 409 con conteo de setups y
   marcas, y la UI ofrece **archivar**. Archivar oculta de los selectores sin afectar setups.
6. **Borrar un setup** → papelera: soft delete del setup y sus marcas en una transaccion; se
   restaura dentro de **30 dias**; despues lo purga un job.
7. Quitar de un setup un set de flechas con marcas → 409.
8. Borrar una marca → soft delete con deshacer.

## Alternativas consideradas

| Alternativa                                     | Por que no                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| Marcas por `(sight, arrowSet)`                  | Mover la mira a otro arco mezclaria calibraciones distintas      |
| Componentes exclusivos (un arco en un solo setup)| Realista fisicamente, pero obliga a duplicar equipo para comparar |
| Cascada de componentes a marcas                 | Un toque equivocado borra meses de datos                         |
| Marcas embebidas en el setup                    | Documentos que crecen y conflictos de version por cada marca     |
| Mantener "Set" en la UI                         | Ambiguo con "Arrow set"                                          |

## Consecuencias

- Positivas: nunca se pierden datos en silencio; modelo fiel a la fisica; comparar sets (F6) es
  natural (mismo setup, distintos sets de flechas).
- Negativas: el arquero tiene que archivar en lugar de borrar equipo usado; hace falta papelera y
  job de purga.

## Como se hace cumplir

Indices unicos parciales en Mongo. Test no negociable #4 (borrado protegido). Tests de integracion
de papelera (borrar, restaurar, vencer) con reloj inyectado.
