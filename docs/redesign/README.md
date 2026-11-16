# Rediseño retro-futurista "blueprint" — indice

> Paquete de traspaso para seguir el rediseño visual de Sight Mapper desde **otra sesion de Claude
> Code**. Todo lo que se decidio, se diseño y se midio en la sesion de Cowork del 2026-11-16 esta
> aca; no hace falta acceso al artefacto de claude.ai para trabajar.

## Arranque rapido (pegar en la sesion nueva de Claude Code)

```
Lee docs/redesign/README.md, docs/redesign/DECISIONES.md y docs/redesign/PLAN.md.
Segui el plan desde la primera tarea [ ] respetando CLAUDE.md (spec primero, DoD de spec §20).
Antes de tocar codigo, resolve conmigo las decisiones pendientes D-1..D-8 de DECISIONES.md.
```

O, mas corto: `/redesign`, una vez copiado `docs/redesign/redesign-command.md` a `.claude/commands/redesign.md` (lo hace R-00; Cowork no puede escribir en `.claude/`).

## Que hay en esta carpeta

| Archivo / carpeta | Para que |
| --- | --- |
| [DECISIONES.md](DECISIONES.md) | El pedido original del autor, sus respuestas, las decisiones de diseño tomadas, observaciones criticas y lo que queda por decidir (D-1..D-8). **Leer primero.** |
| [PLAN.md](PLAN.md) | Plan de accion: tareas R-00..R-10 con puntos, dependencias, archivos a tocar, criterios Given/When/Then y verificacion. Se integra a `docs/ACTION-PLAN.md` como F1-23..F1-33 en R-00. |
| [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) | La especificacion visual completa: paleta 60/30/10 con valores dark/light y contrastes medidos, tipografia, fondo, espaciado, forma, rasgos retro, iconografia, componentes y **mapeo a los tokens actuales** de `@sight-mapper/ui`. |
| [LAYOUT.md](LAYOUT.md) | Reacomodo de navegacion y pantallas: configuracion solo en Ajustes, cabecera, menu, pantalla de la mira, Home, breakpoints, reglas UX. |
| [SPEC-CHANGES.md](SPEC-CHANGES.md) | Cambios exactos a proponer en `docs/spec/`, `UX-UI.md`, `FUNCIONAL.md`, `TECNICO.md`, `CLAUDE.md` y el borrador del ADR-012 (fuentes). Van **antes** del codigo. |
| [design-system/](design-system/) | El design system tal como se publico en el artefacto: `tokens.json`, `tokens.css` generado, `components/bundle.css`, un `preview.html` + `README.md` por componente, `README.md` (brand book), `layout.md`, fuentes woff2 con sus licencias OFL, el icono, `scripts/check-contrast.mjs` y `preview/index.html` para verlo local. |
| [screenshots/](screenshots/) | Capturas de cada preview en `dark/` y `light/` (render real con Playwright) y comparativas lado a lado (`SightScreen-cmp.png`, `HomeScreen-cmp.png`, `cover-cmp.png`). |

## Estado al traspaso (2026-11-16)

- [x] Design System completo y publicado (artefacto de claude.ai, privado del autor):
  https://claude.ai/artifact/N56r27fiNaqyiGXEDAfaEF — copia fiel en `design-system/`.
- [x] Contraste verificado por script en ambos temas (ver `DESIGN-SYSTEM.md` §2.3).
- [x] Previews renderizados y revisados en dark y light (Playwright, `screenshots/`).
- [ ] Nada de codigo de la app tocado todavia. Nada de la spec tocado todavia.
- [ ] La rama no se pudo crear desde Cowork (sin terminal en la PC del autor y sin permiso de push
  desde la nube). La crea la tarea **R-00**.
- [ ] Sin verificar: render dentro del artefacto, prueba al sol con telefono real, lector de pantalla.

## Como ver el design system en local

```bash
npx serve docs/redesign/design-system   # o cualquier servidor estatico
# abrir http://localhost:3000/preview/  → todos los componentes, boton DARK/LIGHT arriba
node docs/redesign/design-system/scripts/check-contrast.mjs   # contraste de todos los pares, ambos temas
```

## Reglas que siguen valiendo (de CLAUDE.md)

- La spec manda: primero `docs/spec/` + `UX-UI.md` + `FUNCIONAL.md`, despues el codigo (el hook
  pide confirmacion al editar `docs/spec/`).
- Docs en español es-AR **sin tildes**; codigo y commits en ingles; UI ES + EN por catalogos.
- Nada de strings en JSX, nada de `any`/`console.log`/TODOs, nada de logica de negocio en componentes.
- **El rediseño es solo de presentacion**: no toca `@sight-mapper/domain`, ni la API, ni los datos.
- Los textos de los previews son ilustrativos: **los catalogos i18n mandan** (ej. el preview dice
  "Ingresar", el catalogo dice "Iniciar sesion" y los E2E buscan ese texto).
- DoD de spec §20 en cada tarea; entrada en `docs/BITACORA.md` con `/bitacora`.
