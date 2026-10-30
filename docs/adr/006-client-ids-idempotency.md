# ADR-006 — IDs del cliente, idempotencia y concurrencia desde el dia uno

- **Estado:** Aceptada
- **Fecha:** 2026-10-29
- **Relacionadas:** TECNICO §4, spec §9, roadmap F4

## Contexto

El offline-first completo (cola de escritura) es F4, pero la app se usa con señal intermitente
desde el MVP. Si el formato del wire cambia al llegar F4, hay que migrar clientes y datos. Las
acciones sobre marcas son optimistas: la UI necesita el id antes de que responda el servidor.

## Decision

1. **IDs UUIDv7 generados por el cliente** para todo recurso creado por el arquero. Ordenan por
   tiempo sin indice extra y permiten referenciar un recurso antes de sincronizarlo.
2. **`Idempotency-Key` obligatoria en todo `POST`**. Misma clave + mismo cuerpo → misma respuesta
   guardada; mismo clave + otro cuerpo → `SM-CORE-409-001`. TTL 24 h (indice TTL + job de purga).
3. **Concurrencia optimista** con `version` entero: respuestas con `ETag`, `PATCH`/`DELETE` con
   `If-Match` obligatorio. Version vieja → `SM-CORE-412-001`. **Nunca last-write-wins silencioso.**
4. F4 agrega la cola persistida en el cliente sin cambiar el contrato.

## Alternativas consideradas

| Alternativa                         | Por que no                                                     |
| ----------------------------------- | -------------------------------------------------------------- |
| ObjectId generado por el servidor   | La cola offline tendria que reescribir ids y referencias       |
| UUIDv4                              | No ordena por tiempo                                           |
| Idempotencia solo en F4             | Cambia el wire; el doble-tap con mala señal ya duplica en el MVP |
| Last-write-wins                     | Pierde datos en silencio entre dos dispositivos                |

## Consecuencias

- Positivas: optimismo trivial, reintentos seguros, F4 sin migracion de contrato.
- Negativas: el cliente tiene que mandar headers extra; la API valida ids ajenos (formato, que no
  esten en el futuro lejano).

## Como se hace cumplir

`@sight-mapper/client` agrega `Idempotency-Key` e `If-Match` automaticamente; la API responde
`SM-CORE-428-001` si faltan. Tests no negociables #3 (idempotencia) y #7 (escritura obsoleta).
