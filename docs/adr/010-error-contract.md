# ADR-010 — Contrato de errores y observabilidad

- **Estado:** Aceptada
- **Fecha:** 2026-10-29
- **Relacionadas:** [errors.md](../errors.md), spec §12, ADR-004

## Contexto

La PWA tiene que reaccionar distinto a cada error de negocio (reemplazar marca, archivar, elegir
estrategia de escala) y mostrar mensajes en dos idiomas. En produccion hace falta rastrear un error
desde el toast del arquero hasta la linea de log.

## Decision

1. **Envelope unico** de error: `{ success:false, error:{ code, messageKey, params, requestId,
   timestamp } }`. Exito: el recurso.
2. **Codigos** `SM-<MOD>-<HTTP>-<NNN>`, declarados en `docs/errors.md` y en un catalogo tipado en
   `@sight-mapper/types`. Nunca se reutilizan.
3. Un solo `AppError` + **un** error middleware. Lo no tipado → `SM-CORE-500-001`.
4. **`requestId`** (UUIDv7) por request: header `X-Request-Id`, envelope y todos los logs.
5. **Logs Pino JSON** con `ts, level, env, service, module, action, requestId, userId, durationMs,
   errorCode, msg, meta`. Redaccion de `password`, `token`, `secret`, `authorization`, `cookie`.
6. **Alertas** externas: 5xx > 1% en 5 min, job fallido, uptime de `/ready`. Sentry en F7.

## Alternativas consideradas

| Alternativa                 | Por que no                                                  |
| --------------------------- | ----------------------------------------------------------- |
| RFC 9457 (problem+json)     | Valido, pero manda `title`/`detail` en prosa; se prefiere clave + params. Se puede mapear si hace falta |
| Mensajes en prosa del server| Rompe i18n (ADR-004)                                        |
| Codigos solo numericos      | No dicen modulo ni status a simple vista                    |

## Consecuencias

- Positivas: UI guiada por codigo, trazabilidad completa, soporte con `requestId`.
- Negativas: disciplina de declarar codigos antes de codear (DoR).

## Como se hace cumplir

Tipo `ErrorCode` generado: un codigo no declarado no compila. Test que recorre el catalogo y
verifica claves i18n. Test de redaccion de logs. Revision del agente `security-reviewer` sobre
`params` (no filtrar datos ajenos).
