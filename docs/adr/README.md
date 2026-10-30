# Architecture Decision Records

> Una decision por archivo. Una ADR aceptada **no se re-litiga**: si cambia el contexto, se escribe
> una nueva que la reemplaza (`Reemplazada por ADR-xxx`) y la vieja se conserva.
> Plantilla: [`TEMPLATE.md`](TEMPLATE.md). Comando: `/adr` (F0-03).

| ADR                                             | Titulo                                                    | Estado     | Fecha      |
| ----------------------------------------------- | --------------------------------------------------------- | ---------- | ---------- |
| [000](000-data-ownership.md)                    | El dueño de los datos es el arquero                       | Aceptada   | 2026-10-29 |
| [001](001-empirical-first.md)                   | Empirico primero: PCHIP, parabola anclada, calculo escalonado | Aceptada | 2026-10-29 |
| [002](002-monorepo-modular-monolith.md)         | Monorepo pnpm + Turborepo y monolito modular              | Aceptada   | 2026-10-29 |
| [003](003-pwa-distribution.md)                  | Distribucion como PWA, sin tiendas                        | Aceptada   | 2026-10-29 |
| [004](004-i18n.md)                              | ES y EN desde el dia uno; la API devuelve claves          | Aceptada   | 2026-10-29 |
| [005](005-canonical-units.md)                   | Unidades canonicas y escala nativa de la mira             | Aceptada   | 2026-10-29 |
| [006](006-client-ids-idempotency.md)            | IDs del cliente, idempotencia y concurrencia desde el dia uno | Aceptada | 2026-10-29 |
| [007](007-auth-better-auth.md)                  | Autenticacion con Better Auth                             | Aceptada   | 2026-10-29 |
| [008](008-setup-model-and-deletion.md)          | Modelo Setup y politica de borrado                        | Aceptada   | 2026-10-29 |
| [009](009-mongodb.md)                           | MongoDB Atlas con replica set y Mongoose                  | Aceptada   | 2026-10-29 |
| [010](010-error-contract.md)                    | Contrato de errores y observabilidad                      | Aceptada   | 2026-10-29 |
| [011](011-maker-own-implementation.md)          | MAKER: implementacion propia, PDF en el cliente           | Propuesta  | 2026-10-29 |
