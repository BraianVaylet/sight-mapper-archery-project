---
description: Continue the retro-futuristic blueprint redesign from its handoff docs
argument-hint: "Optional task id, e.g. R-03"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

Continue the redesign: $ARGUMENTS

1. Read `docs/redesign/README.md`, `docs/redesign/DECISIONES.md` and `docs/redesign/PLAN.md`.
   The visual reference is `docs/redesign/DESIGN-SYSTEM.md` and `docs/redesign/design-system/`
   (one `README.md` + `preview.html` per component, exact measures in `components/bundle.css`,
   renders in `docs/redesign/screenshots/`).
2. If any pending decision D-1..D-8 in `DECISIONES.md` §6 has no answer yet, ask the author before
   touching code that depends on it.
3. Pick the task given in the arguments, or the first `[ ]` task whose dependencies are `[x]`.
   Mark it `[~]` in `docs/redesign/PLAN.md` and in `docs/ACTION-PLAN.md` (F1-23..F1-33).
4. Respect `CLAUDE.md`: spec first (R-01 before any code), no strings in JSX, ES + EN, no `any`,
   no `console.log`, no business logic in components, `@sight-mapper/domain` untouched. The i18n
   catalogs win over the sample copy in the previews.
5. Verify with numbers (unit tests, the e2e specs the task names, contrast) before closing. Never
   change a selector just to make a test pass.
6. Close with `/bitacora <F1-id>`, set `[x]` (or `[~]` with what is missing) in both plans, and
   commit in English (conventional commits).

Report what was verified and what was not.
