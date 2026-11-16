---
description: Add an entry to docs/BITACORA.md for the work just finished
argument-hint: "Task ids, e.g. F0-12"
allowed-tools: Read, Edit, Bash(git log:*), Bash(git diff:*), Bash(git status:*)
---

Write the log entry for: $ARGUMENTS

1. Read `docs/BITACORA.md` (format at the top) and the task in `docs/ACTION-PLAN.md`.
2. Look at what actually changed: `git log --oneline -10`, `git diff --stat` against the base.
3. Add the entry **at the top** (newest first), in Spanish (es-AR, no accents), with the sections
   of the format: *Que se hizo*, *Decisiones* (link the ADR if there is one), *Verificado* (how it
   was proven, with numbers: tests, coverage, commands; not just "green"), *Pendiente / deuda*.
4. Be honest: what was not verified, what was cut, what broke on the way and how it was found.
5. Update the task status in `docs/ACTION-PLAN.md` (`[x]` only if every acceptance criterion is
   met; otherwise `[~]` and say what is missing) and the phase table.
6. Update the *Estado* paragraph in `CLAUDE.md` if the next step changed.

Do not invent results. If you did not run something, write that you did not.
