# ADR-003 — Distribucion como PWA, sin tiendas

- **Estado:** Aceptada
- **Fecha:** 2026-10-29
- **Relacionadas:** spec §4.3, TECNICO §8

## Contexto

La app se usa en el campo (movil) y en casa (desktop, MAKER). Las tiendas cobran 15–30% y demoran
actualizaciones. La competencia es nativa y solo en ingles.

## Decision

1. Una sola **PWA** instalable (React 19 + `vite-plugin-pwa`), mobile-first, con layout desktop.
2. Actualizacion con aviso explicito (`registerType: 'prompt'`) y version visible. La API puede
   forzar una version minima (`minClientVersion`).
3. MVP: el service worker cachea el shell y las lecturas (`StaleWhileRevalidate`) para **consultar**
   sin señal. La **escritura** offline es F4 (ADR-006 deja el wire preparado).
4. Sin apps de tienda en ninguna fase planificada.

## Alternativas consideradas

| Alternativa             | Por que no                                                            |
| ----------------------- | --------------------------------------------------------------------- |
| Nativa (Swift/Kotlin)   | Dos codebases, comision de tienda, ciclo de release lento             |
| React Native / Expo     | Tienda igual; MAKER (desktop + PDF) encaja mejor en la web            |
| Capacitor envolviendo la PWA | Posible a futuro si aparece demanda de tienda; no ahora          |

## Consecuencias

- Positivas: 0% comision, actualizaciones instantaneas, un solo codigo para movil y desktop.
- Negativas: sin widgets ni reloj (Smart Sights los tiene); permisos de sensores en iOS mas
  restrictivos (inclinometro en F3 requiere gesto del usuario); instalacion en iOS menos visible.

## Como se hace cumplir

Lighthouse CI exige criterios de PWA instalable. E2E verifica el `UpdatePrompt`.
