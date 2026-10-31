---
description: Create a new ADR from the template and add it to the index
argument-hint: "Decision title"
allowed-tools: Bash(node scripts/new-adr.mjs:*), Read, Edit
---

Create the ADR: !`node scripts/new-adr.mjs "$ARGUMENTS"`

The command printed the path of the new file (state `Propuesta`, already listed in
`docs/adr/README.md`). Now fill it in, in Spanish (es-AR, no accents, like the rest of the docs),
following the template sections:

1. **Contexto**: the problem and the forces in tension. What is known and what is not.
2. **Decision**: what was decided, in the present tense, unambiguous.
3. **Alternativas consideradas**: at least two, with why not.
4. **Consecuencias**: positive, negative, risks.
5. **Como se hace cumplir**: the mechanical rule (lint, test, CI, hook) that protects it.

Rules: an accepted ADR is never edited to change its meaning; a new one replaces it and the old
one says `Reemplazada por ADR-xxx`. Do not mark it `Aceptada` yourself; that is the author's call.
If a decision is still open, say so in Contexto and ask before writing a Decision.
