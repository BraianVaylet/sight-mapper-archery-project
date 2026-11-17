# ADR-013 — Tolerancia del Doctor por arquero y unidades por seccion

- **Estado:** Aceptada
- **Fecha:** 2026-11-17
- **Decide:** autor
- **Relacionadas:** ADR-001 (punto 5), ADR-005 (consecuencias), spec RF-ACC-04, RF-CAL-09, RN-CAL-06,
  §17.2 y §17.3, SIGHT-MATH §8.3

## Contexto

ADR-001 punto 5 describe el umbral del Mark Doctor como "robusto (MAD) con minimo absoluto". La
calibracion del 2026-10-31 (SIGHT-MATH §8.3) ya lo habia cambiado por un umbral **absoluto** de 4 mm
(o el quantum), ×2.5 en los extremos, porque con 5 marcas el MAD tapa al error. Ese valor sale de 2
sets reales, y el arquero no tiene forma de verlo ni de adaptarlo a su mira y su manera de medir.

ADR-005 dejo la presentacion del equipo siguiendo un unico sistema elegido (spec §17.2,
provisoria). El autor pide equipo en imperial (lo que usa el rubro) y distancias en metrico.

## Decision

1. **Umbral del Doctor:** `τ_i = max(base, quantumMm) · (extremo ? 2.5 : 1)`, absoluto. Reemplaza
   la mencion al MAD de ADR-001 punto 5; el resto de ADR-001 sigue vigente.
2. **`base` es del arquero:** `profiles.doctorToleranceMm`, de 1 a 10 mm en pasos de 0.5, global
   para todos sus setups; `null` = el default calibrado (`DOCTOR_MIN_ABS_MM = 4`). `diagnose()` la
   recibe como opcion; el dominio sigue puro. El factor de los extremos no se configura.
3. **Unidades por seccion:** `profiles.unitSystem` se reemplaza por `units: { marks, bow, arrows,
   sight }`, cada uno `metric | imperial` (defaults `metric`, `imperial`, `imperial`, `metric`).
   Reemplaza la consecuencia de ADR-005 "la presentacion del equipo sigue el sistema elegido"; lo
   canonico de ADR-005 no cambia.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por que no |
| ----------- | ------- | --------- | ---------- |
| Tolerancia fija, solo explicada | Nada que configurar | El arquero no puede adaptarla a su mira | El autor la quiere ajustable |
| Tolerancia por setup | Mas precisa | Mas UI y mas estado; una mira suele medirse igual en todos los setups | Global alcanza para el MVP |
| Presets (estricto / normal / laxo) | Simple | Esconde el numero que la pantalla explica | El numero en mm es lo que el arquero entiende |
| Un sistema por equipo y otro por distancias (2 en vez de 4) | Menos opciones | No cubre la preseleccion de la escala de la mira | El autor pidio cuatro secciones |

## Consecuencias

- Positivas: el arquero ve y ajusta el umbral; recalibrar con mas sets cambia solo el default;
  equipo y distancias se leen en las unidades del rubro.
- Negativas / costos: una migracion de perfiles (`migrate-mongo`, TECNICO §6); el export pasa a
  `schemaVersion: 2`; cada pantalla elige con que seccion convierte.
- Riesgos: con una tolerancia baja (1 a ~1.2 mm) se señalan marcas bien medidas; la pantalla lo
  advierte (UX-UI §4.7).

## Como se hace cumplir

Zod compartido acota `doctorToleranceMm` (1–10, multiplo de 0.5) y `units`. Tests de propiedades en
`@sight-mapper/domain` para el nuevo parametro (con el default, el resultado es igual al de hoy).
Test de la migracion contra mongodb-memory-server. `domain-reviewer` sobre F1-40.
