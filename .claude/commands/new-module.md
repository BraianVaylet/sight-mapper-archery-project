---
description: Scaffold a new API module with its layers and boundaries
argument-hint: "module-name"
allowed-tools: Read, Edit, Write, Bash(pnpm lint:*), Bash(pnpm typecheck:*), Grep
---

Create the API module `$ARGUMENTS` (lowercase, one word).

A module is `apps/api/src/modules/<name>/{domain,application,infrastructure}` (ARQUITECTURA §4).
Before creating it, confirm it is in the spec and `docs/ARQUITECTURA.md`; if not, update those
first and ask.

1. Create the three folders, each with an `index.ts` that exports only what other layers may use.
2. **Boundaries.** Add the name to `apiModules` in `eslint.config.js`, so no module can import
   it and it cannot import another. Cross-module needs go through a port (declared by the
   consumer, implemented by the owner) or an event; add the port to `ARQUITECTURA.md` §4.2 and
   the event to `core/events/bus.ts` (`EventMap`).
3. **Layers.** `domain/` imports nothing from Mongoose, Hono or `core/`. `application/` holds one
   use case per file and takes its repositories and clock as arguments. `infrastructure/` holds
   the Mongoose models (built with `createBusinessSchema`), repositories that receive `userId`
   in the constructor, and the Hono routes (registered through the route registry).
4. **Wiring.** Register it in `composition-root.ts`. Declare its error codes in `docs/errors.md`
   first, then run `pnpm --filter @sight-mapper/types generate`, then add the ES and EN keys.
5. Add the module's collections to the migration (a new file in `apps/api/migrations/`, never an
   edit of an old one) with `userId` leading every index.
6. Write the isolation, idempotency and stale-write tests before the routes (see the
   `test-writer` agent). Add one attack per session route to `productionAttacks` in
   `apps/api/tests/isolation.test.ts`: the suite fails a session route without one.

Finish by running `pnpm lint` and `pnpm typecheck`, and by trying to import the new module from
another one to see the lint rule fail. Do not finish with the rule unproven.
