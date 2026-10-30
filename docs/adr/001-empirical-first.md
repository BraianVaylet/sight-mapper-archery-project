# ADR-001 — Empirico primero: PCHIP, parabola anclada y calculo escalonado

- **Estado:** Aceptada
- **Fecha:** 2026-10-29
- **Relacionadas:** [SIGHT-MATH.md](../domain/SIGHT-MATH.md), spec §6.6 y §7.5

## Contexto

Hay tres familias de solucion en el mercado: balistica desde specs (falla si un dato de entrada
esta mal, que es la queja mas comun en foros), regresion global (no pasa por las marcas medidas: el
arquero deja de creerle) y tablas manuales (no calculan). El borrador pedia 5 marcas antes de
calcular; el diseño, 2. Desde cero, sin portar codigo previo.

## Decision

1. **Lo medido es la verdad.** El modelo pasa **exacto** por cada marca medida.
2. **Dentro del rango medido:** PCHIP (Hermite cubico, tangentes de Fritsch–Carlson): monotono, sin
   sobrepaso. Con 2 marcas degenera en lineal.
3. **Fuera del rango:** parabola de minimos cuadrados sobre todas las marcas, **anclada** al punto
   medido del borde (`f(d) = m_borde + q(d) − q(d_borde)`), sin extrapolar mas alla de su vertice y
   con aviso de baja confianza a mas de 25% del rango.
4. **Calculo escalonado:** 2 marcas → intermedias; 3 → extrapolacion; 5 → Mark Doctor.
5. **Mark Doctor:** residuos **leave-one-out** contra la parabola sin la marca evaluada, umbral
   robusto (MAD) con minimo absoluto; monotonia verificada desde 2 marcas usando la direccion de la
   escala. Señala; nunca corrige.
6. **Lo calculado se muestra siempre como estimado** y **no se persiste**.
7. El calculo vive en `@sight-mapper/domain`, puro, y corre en el cliente.
8. La balistica entra en F6 solo como **semilla** (`origin: seeded`), que cede ante lo medido.

## Alternativas consideradas

| Alternativa                          | Por que no                                                          |
| ------------------------------------ | ------------------------------------------------------------------- |
| Balistica como autoridad             | Traslada todo el error de entrada; requiere cronografo              |
| Regresion global                     | No pasa por lo medido                                               |
| Spline cubico natural                | Pasa por los puntos pero sobrepasa entre marcas                     |
| Parabola sin anclar fuera del rango  | Salta en el borde del rango (deuda del proyecto previo)             |
| Residuos contra el ajuste total      | La marca mala esconde su propio residuo                             |
| Minimo unico de 5 marcas             | Peor activacion; la matematica permite dar valor antes              |
| Minimo unico de 2 para todo          | Extrapolar con 2 puntos (lineal) es poco fiable                     |

## Consecuencias

- Positivas: el arquero ve sus numeros tal cual; valor desde la segunda marca; diferenciador
  (Doctor) que nadie tiene; funciona sin red.
- Negativas: sin marcas no hay nada que mostrar hasta F6; umbrales del Doctor a calibrar con datos
  reales.
- Riesgo: reescribir el math desde cero. Mitigacion: TDD, tests de propiedades, fixtures de datos
  reales, cobertura 95%.

## Como se hace cumplir

Tests no negociables #2 (exactitud y no sobrepaso, con `fast-check`). ESLint bloquea imports de I/O,
framework, `Date`, `Math.random` y `Temporal.Now` en `packages/domain`. Escribir en
`packages/domain/src/**` pide confirmacion (hook). Cobertura 95% en CI. El agente `domain-reviewer`
revisa todo PR que toque el paquete.
