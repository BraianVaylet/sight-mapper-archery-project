# apps/pwa — React 19 + TanStack + Tailwind v4

Contexto raiz en `../../CLAUDE.md`. Hoy existen el esqueleto (providers, tema, i18n, router con
guard, service worker) y las rutas de FUNCIONAL §1.1 como placeholders (F0-17).

## Forma prevista (ARQUITECTURA §5)

```
src/app/        providers (Query, i18n, tema, router), layout, UpdatePrompt
src/routes/     TanStack Router, file-based (rutas en FUNCIONAL §1.1)
src/features/   auth · setups · sight · distances · doctor · print · equipment · account
```

## Reglas de esta app

- **Sin logica de negocio en componentes.** Los calculos viven en `@sight-mapper/domain`; los
  componentes llaman y muestran. El numero que ve el arquero es siempre
  `domain` → `convert/` → texto.
- **Frontera de estado:** TanStack Query = servidor · Zustand = UI efimera · Nuqs = URL (la
  distancia y el set de flechas elegidos viven en la URL). Nunca copiar datos del servidor a Zustand.
- **Datos por `@sight-mapper/client`:** `createResourceHooks` ya manda `Idempotency-Key` y
  `If-Match`; no hacer `fetch` a mano. Todo componente que trae datos acepta un cliente inyectable
  (`ClientProvider`) para poder probarlo.
- **Textos:** ninguno en el JSX. Todo por `t('clave')` de `@sight-mapper/i18n` (ES y EN a la vez;
  ESLint `i18next/no-literal-string` lo exige). Un error de la API se muestra con
  `translateKey(locale, error.messageKey, params)` con los params canonicos ya convertidos a la
  unidad del arquero.
- **Unidades:** la API habla metros y milimetros; la conversion es solo en el borde de
  presentacion, con `convert/` del dominio y el separador decimal del locale.
- **Medido ≠ estimado:** punto lleno + linea solida vs rombo + punteado + `≈`. `StatusBadge`
  nunca depende solo del color.
- **UI:** primitivas de `@sight-mapper/ui` (tocables ≥ 44 px, dark y light, AA). Importar
  `tokens.css` y `theme.css` despues de `tailwindcss`. Estados vacio / carga / error en todo
  listado (`EmptyState`, `Skeleton`, `ErrorState`).
- **Optimista:** guardar una marca no bloquea con spinner; toast con "Deshacer" (8 s).
- **PWA:** `registerType: 'prompt'`; la version nueva se ofrece, no se impone.

## Probar

Vitest + Testing Library + MSW (o `ClientProvider` con un `fetch` falso). Consultar por rol y
nombre accesible; probar teclado y los dos idiomas donde el texto importe. E2E con Playwright en
360 y 1440 (F1-20).
