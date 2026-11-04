# Release del MVP (F1-22)

> Para el dia en que existan staging y prod (F0-20). Cada paso dice como se verifica. Lo que esta
> entre `<>` se completa en el momento. Contexto: TECNICO §11–12 (pipeline y deploy), spec §2
> (metricas), ADR-000 (aislamiento).

## 1. Antes de promover

| Paso | Como se verifica |
| ---- | ---------------- |
| `main` verde en CI, incluido el job `e2e` | GitHub Actions: los tres jobs en verde para el commit a promover |
| Staging desplegado con ese mismo commit | `GET https://<staging-api>/ready` → 200 y la version de la PWA en el pie coincide con el commit |
| El flujo critico contra staging | `critical-flow.spec.ts` con `baseURL` de staging y un buzon de prueba para los links (pendiente F1-20) |
| Migraciones nuevas revisadas | `pnpm --filter @sight-mapper/api exec migrate-mongo status` contra staging: ninguna `PENDING` despues del deploy |
| Backup reciente de prod | Atlas → cluster `prod` → Backup: snapshot de menos de 24 h y PITR activo |

## 2. Promover a prod

1. Railway → servicio `api` → promover el deploy verificado de staging a `prod` (el mismo build, no uno nuevo).
2. Las migraciones corren como paso de release, antes del arranque (TECNICO §12). Si fallan, el deploy no arranca: no hay estado a medias.
3. `GET https://<prod-api>/ready` → 200.
4. Mismo procedimiento para `pwa`. La PWA instalada ofrece la version nueva ("Actualizar"): no se fuerza.
5. Humo manual (2 minutos): entrar, abrir un setup, ver la lectura de una distancia, cerrar sesion.

**Si algo sale mal:** Railway → redeploy del deploy anterior. Una migracion ya aplicada **no se
deshace a mano** en Atlas: se escribe una migracion nueva que corrige (CLAUDE.md, "tocar Atlas a
mano" esta prohibido).

## 3. Probar un restore de backup (en staging)

Un backup que nunca se restauro no es un backup. Se prueba **en staging**, nunca en prod.

1. Atlas → cluster `prod` → Backup → elegir un snapshot → **Restore** → destino: cluster `staging`.
2. Esperar a que termine; anotar cuanto tardo (es el tiempo real de recuperacion).
3. Verificar:
   - `GET https://<staging-api>/ready` → 200.
   - `MONGODB_URI=<staging-readonly> node scripts/metrics.mjs` da los mismos conteos que en prod al momento del snapshot.
   - Un usuario de prueba entra y ve sus setups y marcas.
4. Anotar en la BITACORA: fecha, snapshot usado, duracion y resultado.

## 4. Metricas (spec §2), a los 14 dias

```bash
MONGODB_URI='<usuario de solo lectura de prod>' node scripts/metrics.mjs --since <fecha del release>
```

- Solo conteos y porcentajes: ningun id, email ni lectura sale del script.
- Usar un usuario de Atlas **de solo lectura**: el script no escribe, y asi no puede.
- Metas: activacion a 7 dias ≥ 50 % de las altas; setups con 5 marcas ≥ 30 %. "Marcas re-medidas" es
  una aproximacion (cambios de lectura despues de guardar): el Doctor no guarda lo que señalo.
- El tiempo de abrir la app a ver la marca (< 3 s en 4G) se mide en el campo, con un telefono.

## 5. Prueba con arqueros

- 5–10 arqueros (CBA, liga bahiense), cada uno con su arco y su mira reales.
- Les toca: crear la cuenta, seguir la guia, cargar sus marcas de una sesion, y usar la app en la
  siguiente salida al campo.
- Preguntas despues de la salida: ¿la lectura que mostro era la que fijaste? ¿algo te freno? ¿que
  te falto?
- Canal de feedback: **pendiente de decidir** (correo, grupo de WhatsApp o issues).
- Cada comentario se tria en `docs/ACTION-PLAN.md`: bug (a la fase actual), mejora (a la epica que
  corresponda) o descartado (con el motivo en la BITACORA).
