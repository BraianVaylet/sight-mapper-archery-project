# ADR-009 — MongoDB Atlas con replica set y Mongoose

- **Estado:** Aceptada
- **Fecha:** 2026-10-29
- **Relacionadas:** TECNICO §6, ADR-000

## Contexto

Datos por usuario, documentos de forma variable (equipo con campos opcionales y por tipo de arco),
volumen bajo por usuario y operaciones que tocan varios documentos (cambio de escala, papelera). El
borrador elige MongoDB Atlas + Mongoose y Railway para las apps.

## Decision

1. **MongoDB Atlas** con **replica set** (transacciones multi-documento), un cluster por entorno
   (`staging`, `prod`), backups automaticos y PITR en prod.
2. **Mongoose 8** solo en `infrastructure/`; modelos con `_id: String` (UUIDv7), `version` propio.
3. Indices y cambios de esquema por **`migrate-mongo`**, ejecutadas antes de cada deploy desde un
   solo lugar. `autoIndex` apagado en prod. **Prohibido tocar Atlas a mano.**
4. Tests de integracion con `mongodb-memory-server` en modo **replset**.
5. Plugin global de aislamiento (ADR-000) y de soft delete.

## Alternativas consideradas

| Alternativa              | Por que no                                                              |
| ------------------------ | ----------------------------------------------------------------------- |
| PostgreSQL (+ Prisma/Drizzle) | Valido; se prefiere Mongo por forma variable del equipo y experiencia previa del autor |
| SQLite (como la app legacy) | Sin multi-usuario serio ni backups gestionados                      |
| Mongo standalone         | Sin transacciones                                                       |

## Consecuencias

- Positivas: esquema flexible para tipos de arco; transacciones donde importan; operacion
  gestionada.
- Negativas: integridad referencial a mano (puertos + transacciones); indices parciales con
  `deletedAt: null` explicito.

## Como se hace cumplir

Healthcheck `/ready` hace `ping`. CI corre migraciones contra el replset en memoria. ESLint impide
`mongoose` fuera de `infrastructure/` y `core/db`.
