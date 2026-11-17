# ADR-012 — Tipografia propia precacheada

- **Estado:** Aceptada
- **Fecha:** 2026-11-16
- **Decide:** el autor
- **Relacionadas:** ADR-003, spec §14, `docs/UX-UI.md` §2.3, `docs/redesign/DESIGN-SYSTEM.md` §2.2.
  Reemplaza la regla "sin web fonts" de `packages/ui/src/styles/theme.css` (no era ADR).

## Contexto

El rediseño retro-futurista necesita una voz tipografica propia: titulos con caracter de
instrumento y numeros tabulares que no se confundan al sol. Las fuentes del sistema varian por
dispositivo (Roboto, SF, Segoe) y no dan esa voz. La app se usa sin señal: nada puede depender de la
red.

## Decision

Chakra Petch 600/700 (titulos), IBM Plex Sans 400/500/600 (UI) e IBM Plex Mono 400/500/600 (numeros
y rotulos), licencia OFL, subset latin woff2 (~150 KB), servidas por la propia PWA (hash en
`/assets/`, `font-src 'self'` ya permitido por la CSP) y precacheadas por el service worker.
`font-display: swap` con fallbacks del sistema.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por que no |
| ----------- | ------- | --------- | ---------- |
| Solo fuentes del sistema (`ui-monospace` + `system-ui`) | Cero costo, cero riesgo de LCP | Sin identidad, varia por dispositivo | El rediseño pide una voz retro consistente |
| Google Fonts por CDN | Facil | Rompe offline y la CSP (`font-src 'self'`) | La app se usa sin señal |

## Consecuencias

- Positivas: identidad consistente en todos los dispositivos; numeros tabulares garantizados;
  funciona offline.
- Negativas / costos: ~150 KB extra en la primera visita (no cuentan para el gate de JS de 180 KB);
  licencias OFL a conservar junto a los archivos.
- Riesgos: el aviso de LCP (~2,6 s). Se mide en Lighthouse CI; mitigacion: precargar solo 2
  archivos o recortar pesos.

## Como se hace cumplir

- `workbox.globPatterns` incluye `woff2` (precache); `e2e/installable.spec.ts` verifica que los
  woff2 esten en el precache (F1-26).
- La CSP de `apps/pwa/Caddyfile` sigue con `font-src 'self'`: cualquier fuente externa falla.
- Lighthouse CI en cada PR mide el JS inicial (gate) y el LCP (aviso).
