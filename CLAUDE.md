# Sight Mapper — contexto del proyecto

PWA de **marcas de mira** para arqueros (ES + EN). El arquero registra en que punto de la escala va
la mira a cada distancia, por setup (arco + mira + flechas), y la app calcula las que nunca tiro y
señala marcas probablemente mal medidas.

**La spec manda:** `docs/spec/SIGHT-MAPPER-SPEC.md`. Si algo queda fuera de spec, primero se
actualiza la spec, despues se codea. Indice de docs: `docs/README.md`.

Proyecto **desde cero**: `bow-sight-project` y `bv-bow-sight` son solo referencia; no se copia
codigo de ahi.

## Estado

Documentacion completa (2026-10-29). **Fase 0 en curso** (ver `docs/ACTION-PLAN.md`): hechas F0-01,
02, 03, 05, 06, 07, 08, 09, 10, 12, 13, 14, 16, 18 y 21; **F1-01 (preferencias) y F1-02 (arcos) hechas, F1-03 (miras), F1-04 (flechas), F1-05 (setups, Home y papelera), F1-06 (menu), F1-07 (marcas, API), F1-08 (pantalla de la mira), F1-09 (hoja de marca) y F1-10 (intermedias y curva) y F1-11 (Mark Doctor) hechas**; F0-17 (pwa) hecha, salvo el boton de Google (F0-20); casi F0-11 (ui, falta el catalogo visual), F0-15 (auth:
falta probar Google, que necesita F0-20) y F0-19 (CI, sin correr en GitHub). Bloqueadas F0-04 y F0-20. El Mark Doctor (F0-06) esta calibrado con solo 2 sets reales: recalibrar con mas.

Herramientas del repo: `.claude/` (agentes `spec-reviewer`, `domain-reviewer`,
`security-reviewer`, `test-writer`; comandos `/adr`, `/bitacora`, `/new-task`, `/new-module`; hooks
que bloquean secretos, piden confirmacion en `docs/spec/` y `packages/domain/src/`, y formatean).
Un `CLAUDE.md` por app y por el dominio tiene las reglas locales.

## Stack

TypeScript `strict` · React 19 + TanStack (Router/Query/Form/Table) · Tailwind v4 · Zustand ·
Nuqs · Motion · catalogos i18n tipados propios · `vite-plugin-pwa` · Hono · Better Auth · Mongoose 8 + MongoDB Atlas
(replica set) · Zod 4 · Temporal · Pino · Resend · Vitest + fast-check + Testing Library + MSW +
mongodb-memory-server + Playwright · pnpm + Turborepo · Railway.

## Estructura

```
apps/      api · pwa
packages/  domain (math puro) · schemas (Zod) · types · i18n · ui · client · config
```

API = monolito modular: `apps/api/src/modules/<mod>/{domain,application,infrastructure}` + `core/`.
Modulos: `account`, `equipment` (bows, sights, arrows), `calculator` (setups, marks). Se comunican
por puertos o eventos, **nunca** importandose.

## Reglas no negociables

1. **El `userId` sale de la sesion**, nunca del body ni de la query. Repositorio que lo inyecta +
   plugin de Mongoose + suite de aislamiento. Recurso ajeno → **404**. → ADR-000
2. **Empirico primero.** `@sight-mapper/domain` es puro (sin I/O, framework, reloj ni azar). El
   modelo **pasa exacto por cada marca medida**. Lo calculado se muestra siempre como estimado y no
   se persiste. Escalonado 2/3/5. → ADR-001, `docs/domain/SIGHT-MATH.md`
3. **Errores:** `SM-<MOD>-<HTTP>-<NNN>`, envelope `{ success:false, error:{ code, messageKey,
   params, requestId, timestamp } }`. La API manda **claves, nunca prosa**. Codigos declarados en
   `docs/errors.md` antes de codear. → ADR-010
4. **Unidades:** canonico — distancias en **metros**, escala de mira en **milimetros** (via
   `SightScale`). Conversion solo en el borde de presentacion. → ADR-005
5. **Wire:** ids UUIDv7 del cliente · `Idempotency-Key` en todo POST · `If-Match` en PATCH/DELETE ·
   cursor, nunca `skip` · soft delete. → ADR-006
6. **Borrado:** componente usado por un setup → 409 + archivar. Setup → papelera 30 dias. → ADR-008
7. **Estados** solo por transicion explicita (`archive`, `restore`…), nunca `update` libre.
8. **Validacion:** Zod en `@sight-mapper/schemas`, compartido front/back.
9. **Frontera de estado:** Query = servidor · Zustand = UI · Nuqs = URL. Nunca duplicar servidor en
   Zustand.
10. **Idioma:** codigo y commits en ingles; docs en español (es-AR, sin tildes, como el resto);
    UI ES y EN via catalogos tipados.

## Prohibido

`any` · `console.log` · TODOs sueltos · logica de negocio en componentes React · secretos en el
repo · importar entre modulos · `new Date()` fuera del traductor de persistencia · strings de
usuario fuera de catalogos · I/O en `@sight-mapper/domain` · tocar Atlas a mano · copiar codigo de
competidores (ADR-011).

## Definition of Done

Completo en spec §20. Minimo: tests con la cobertura de su zona · aislamiento por usuario · Zod
compartido · error tipado declarado · logs estructurados · estados vacio/carga/error · accesible ·
responsive 360/768/1440 · dark y light · ES y EN · OpenAPI · entrada en `docs/BITACORA.md`.

## Decisiones tomadas — no re-litigar

`docs/adr/000`–`011`. Indice en `docs/adr/README.md`.
