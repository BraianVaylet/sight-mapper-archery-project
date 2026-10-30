# ADR-002 — Monorepo pnpm + Turborepo y monolito modular

- **Estado:** Aceptada
- **Fecha:** 2026-10-29
- **Relacionadas:** [ARQUITECTURA.md](../ARQUITECTURA.md)

## Contexto

Un desarrollador (con asistencia de IA), dos apps en el MVP (API y PWA) que comparten dominio,
validaciones, tipos y catalogos. Se espera crecer a MAKER (F2), billing (F5) y landing (F5). El
producto se llama **Sight Mapper**; el arranque es desde cero.

## Decision

1. **Monorepo** con pnpm workspaces y Turborepo 2. Paquetes con scope **`@sight-mapper/*`**:
   `domain`, `schemas`, `types`, `i18n`, `ui`, `client`, `config`. Apps: `api`, `pwa`.
2. **Monolito modular** en la API: `modules/<mod>/{domain,application,infrastructure}` + `core/`.
   Modulos MVP: `account`, `equipment`, `calculator`.
3. Un modulo **no importa nada** de otro: se comunica por **puertos** (declarados por quien los
   necesita, implementados por quien tiene el dato, cableados en `composition-root.ts`) o por
   **eventos de dominio** in-process.
4. `domain/` de cada modulo no conoce Mongoose, Hono ni Better Auth.
5. Codigos de error con prefijo `SM-`.

## Alternativas consideradas

| Alternativa                 | Por que no                                                           |
| --------------------------- | -------------------------------------------------------------------- |
| Repos separados             | Versionado cruzado de schemas y dominio; friccion sin beneficio      |
| Microservicios              | Costo operativo absurdo para el tamaño; transacciones distribuidas   |
| Monolito sin fronteras      | Se degrada rapido; impide extraer `billing` o `maker` mas adelante   |
| Nx                          | Mas pesado que Turborepo para lo que se necesita                     |

## Consecuencias

- Positivas: un deploy por app, refactors atomicos, Zod y dominio compartidos, fronteras
  verificables.
- Negativas: los puertos agregan indireccion; hay que mantener el grafo de dependencias.

## Como se hace cumplir

ESLint (`boundaries` / `no-restricted-imports`) bloquea imports entre modulos, de infraestructura en
`domain/` y de apps en paquetes. Turborepo falla si hay ciclos. El agente `spec-reviewer` valida
estructura en PRs.
