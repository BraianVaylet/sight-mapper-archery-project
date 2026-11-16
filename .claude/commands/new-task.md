---
description: Add a task to docs/ACTION-PLAN.md with its Definition of Ready checked
argument-hint: "Phase and short title, e.g. F1 Importar marcas"
allowed-tools: Read, Edit, Grep
---

Add a task to the plan: $ARGUMENTS

1. Read `docs/ACTION-PLAN.md` (format of a task, current numbering) and the spec section it
   serves. Pick the next free id in the phase (`Fx-NN`).
2. Write the task in the plan's format: module, points (Fibonacci, 1 ≈ half a day), depends on,
   a description in Spanish (es-AR, no accents), **Given/When/Then acceptance criteria**, new
   errors and data.
3. **Definition of Ready.** Do not add it as ready unless all hold. Otherwise mark it `[!]` and
   say what is missing:
   - the spec covers it (if not, the spec changes first);
   - every new error code is already declared in `docs/errors.md`;
   - new fields are in `docs/DICCIONARIO.md`;
   - the criteria are testable, with numbers;
   - dependencies exist.
4. Update the phase table (task and point counts) and the dependency diagram if it moves the
   critical path.

Ask before splitting or merging existing tasks. Never renumber an existing id.
