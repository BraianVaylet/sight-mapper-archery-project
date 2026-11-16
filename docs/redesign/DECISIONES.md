# Decisiones del rediseño

## 1. El pedido original del autor (2026-11-16, textual)

> Debes mejorar el diseño de este producto.
>
> - Se busca un estilo moderno-retro-futurista. Se debe sentir como una app moderna, pero el usuario
>   debe ver en su diseño aspectos que le hagan pensar en algo retro.
> - Agrega algun fondo diseño en el fondo, como una cuadricula, o algo por el estilo, algo que no
>   moleste a la visualizacion de los datos pero que le de un toque unico.
> - Debe tener modo claro y oscuro.
> - Es una app que se usa principalmente a la interperie, asi que ambos modos (claro y oscuro) deben
>   de tener un buen contraste.
> - Puedes modificar la paleta de colores, aplica la regla de los 3 colores: uno para el fondo (60%
>   de la UI) y es quien crea el ambiente, otro es el de Apoyo (30% de la UI) es quien acompaña, por
>   ultimo el de Acento (10% de la UI) es el que resalta a la vista.
> - Los textos deben ser claros a la vista.
> - Las acciones de configuracion, como idioma, temas, etc deben estar solo en la seccion de
>   configuracion.
> - Debe respetar las mejores reglas de UX/UI.
> - Puedes reacomodar componentes.

Segundo pedido: crear una rama con un plan de accion y toda la documentacion necesaria para seguirlo
desde otra sesion de Claude Code, sin omitir nada.

## 2. Respuestas del autor a las preguntas de aclaracion

| Pregunta | Respuesta | Consecuencia |
| --- | --- | --- |
| Alcance de la primera sesion | **Solo Design System** (sin docs ni codigo) | Se lleno el artefacto Design System; el codigo es este plan. |
| Direccion de paleta | **Navy evolucionado** (oscuro: bg `#0B1B45` · apoyo `#1C3266` · acento `#FFCC00`; claro: bg `#F3F5FA` · apoyo `#D5DDEE` · acento `#10286B`; vibe plano tecnico/blueprint) | Se mantiene la identidad navy + amarillo; valores finales en `DESIGN-SYSTEM.md` (ajustados por contraste: claro bg `#EEF2F9`). |
| Tipografia | **Fuentes propias precacheadas** (mono retro para numeros + sans moderna para UI, woff2 servidas por la PWA, offline) | Cambia la regla "sin web fonts" de `theme.css` → ADR-012 (borrador en `SPEC-CHANGES.md`). |
| Configuracion solo en Ajustes vs invitados | **Ajustes + idioma en login**: todo pasa a Ajustes; en pantallas de invitado queda solo un selector compacto de idioma; el tema sigue al sistema | `LanguageSwitch` solo en rutas de invitado; se elimina `PreferencesBar` del pie. |

Otras opciones que se ofrecieron y **no** se eligieron (para no re-litigar): paleta "Instrumento de
vuelo" (grafito/hueso · acero · naranja seguridad `#FF6B1A`/`#C2410C`), paleta "Fosforo CRT"
(negro verdoso/papel · oliva · ambar `#FFB000`/`#8A5A00`); "Solo fuentes del sistema"; "Estrictamente
solo Ajustes" (sin selector en invitado); alcances "DS + spec" y "DS + tokens en codigo".

## 3. Decisiones de diseño tomadas

1. **Paleta 60/30/10 con la identidad actual.** Fondo navy profundo / papel de plano; apoyo en
   paneles; acento amarillo (oscuro) o navy con texto amarillo (claro). El amarillo sobre blanco da
   1,5:1, por eso en claro el acento pasa a navy y el amarillo vuelve como `on-accent` (9:1).
2. **Lo medido en claro es dorado oscuro `#6B4F00`** (antes `#7D5E00`, se oscurecio para el sol).
3. **Fondo blueprint**: cuadricula de 8 px (`grid`) y 40 px (`grid-major`), fija al scroll,
   contraste 1,1–1,4 con el fondo; marcas de registro en pantallas de invitado. **Ningun dato sobre la
   cuadricula**: todo dato va en superficies opacas.
4. **Tipografia**: Chakra Petch 600/700 (titulos, el guiño retro-futurista), IBM Plex Sans
   400/500/600 (UI), IBM Plex Mono 400/500/600 tabular (lecturas, valores, rotulos). Todas OFL, woff2
   subset latin (incluye ñ y tildes), ~150 KB en total.
5. **Rasgos retro, y solo estos 7**: cuadricula + marcas de registro; rotulos de instrumento
   numerados (`01 — TIRO`); esquinas HUD solo en el panel de lectura; regla analogica con ticks; boton
   primario con canto duro (tecla fisica); tira de estado tipo display de panel; brillo de fosforo
   suave en la lectura medida (solo oscuro). **Prohibido sumar** scanlines, ruido, CRT curvo o
   tipografias pixel: bajan la legibilidad al sol.
6. **Sombras duras sin blur** (`shadow-key`, `shadow-panel`), bordes de 2 px, radios 2/4/8 px.
7. **Tocables de 48 px** (antes 44) y accion principal fija de 56 px: guantes y sol.
8. **Configuracion solo en Ajustes** (`/settings`), agrupada 01 Pantalla · 02 Idioma y unidades ·
   03 Acerca de (version). Se van: boton "Tema/Apariencia" de la cabecera, `PreferencesBar` y el pie.
9. **Cabecera**: logo o Volver · titulo + contexto · solo el boton de menu.
10. **Menu** en dos grupos: 01 — Tiro (Inicio, Arcos, Miras, Flechas, Estadisticas "Pronto") y
    02 — Cuenta (Ajustes, Perfil, Papelera); pie con Cerrar sesion y hora de sincronizacion.
11. **Pantalla de la mira en orden de uso**: cabecera → set de flechas → HUD (distancia + lectura) →
    regla + marcas → barra fija abajo (herramientas, "Agregar marca", tira de estado). Una sola accion
    primaria, en la zona del pulgar.
12. **Home**: saludo + "Tus setups" sobre la cuadricula, tarjetas iguales, "Crear setup" fijo abajo;
    se quita el contador "Sets guardados" del pie (ya esta en el subtitulo de la cabecera).
13. **Medido ≠ estimado se refuerza**: forma + color + borde (solido vs punteado) + `≈`. `mark` y
    `warning` son cercanos en oscuro: los distingue la forma (circulo vs triangulo), nunca quitarla.
14. **Foco**: anillo `focus` 3 px solido, offset 2 px, ≥5:1 sobre toda superficie.

## 4. Observaciones criticas (👀) que el autor ya vio

- **La spec manda**: antes de codear hay que actualizar `docs/UX-UI.md`, FUNCIONAL §1.1 (ruta
  `/settings`, menu, sin pie global) y la regla "sin web fonts". → tarea R-01.
- **El dorado del tema claro** (`#6B4F00`) se ve marron; es el precio del contraste al sol. Si se
  cambia, tiene que seguir siendo oscuro (≥4,5:1 sobre `surface-raised` `#D5DDEE`).
- **Falta la prueba al sol con un telefono real** (ya pendiente en F1-18) y el lector de pantalla
  real (F1-19). Las hace el autor.
- **Takeaway (🚀)**: que cada estado tenga forma propia (circulo, rombo, triangulo, cruz) permite que
  el amarillo y el naranja sean cercanos sin ambiguedad, incluso para daltonicos.
- **Tip de flujo (✨)**: con terminal en la PC del autor, portar tokens y correr `tokens.test.ts` +
  E2E en el mismo paso (es exactamente lo que hacen R-02 y R-10).

## 5. Diferencias entre el design system y la app real (no perder funcionalidad)

El DS es una referencia visual; **la app actual tiene reglas que el DS no muestra y que se mantienen**:

| En la app hoy | En el DS | Que hacer |
| --- | --- | --- |
| Herramientas de la mira: Viento y Clima deshabilitados "Proximamente", Doctor habilitado desde 5 marcas (antes `X/5`), Imprimir desde 1 marca, "Calcular intermedias" aparte | `ActionBar` con 4 herramientas: Intermedias, Viento, Doctor, Imprimir (sin Clima, todas parecen activas) | Mantener las reglas; ver **D-1**. |
| Estrella de favorito en cada tarjeta de Home (`useToggleFavorite`, favoritos primero) | `SetupCard` sin estrella, con chapa "Acceso rapido" | Mantener la estrella (boton `aria-pressed`, `text-mark` encendida) **y** sumar la chapa de acceso rapido. |
| Leyenda bajo la regla (`sight.legend`: ● Registrada ◇ Calculada) | No aparece en `SightRuler` | Mantener la leyenda (UX-UI §4.2 la exige). |
| Direccion de la regla segun `scale.direction` de la mira | La regla del preview va de 1 arriba a 9 abajo | La geometria sigue saliendo de `@sight-mapper/domain/ruler`; solo cambia el estilo. |
| `QuickAccessToggle` ("Abrir siempre aca") en la pantalla de la mira | No aparece | Mantener; restilizar como boton secundario con check. |
| Estado vacio de la mira con checklist ("Todavia falta", escalonado 2/3/5) | `EmptyState` generico | Mantener el contenido; aplicar el estilo de `EmptyState`. |
| Textos de los catalogos ("Iniciar sesion", "Tu primer setup en 4 pasos"…) | Copys ilustrativos ("Ingresar") | Los catalogos mandan; los E2E buscan esos textos. |
| `/settings/appearance` (E2E `imperial.spec.ts`, `tour.ts`) | `/settings` | Nueva ruta + redirect desde la vieja; actualizar los E2E. |
| Rutas `/reset-password` y `/verify-email` fuera del layout `_guest` | Solo se dibujo Ingresar | `LanguageSwitch` tambien en esas dos. |

## 6. Decisiones pendientes con el autor (resolver en R-00, antes de codear)

| Id | Pregunta | Recomendacion |
| --- | --- | --- |
| D-1 | ¿Como entran 5 herramientas (Intermedias, Viento, Clima, Doctor, Imprimir) en 360 px? | Fila de 3 activas (Intermedias, Doctor con `X/5` si falta, Imprimir) + Viento y Clima en una sola chapa "Proximamente" a la derecha o en el menu de la pantalla. Cumple RF-X-07 sin achicar tocables. |
| D-2 | ¿Se acepta el dorado `#6B4F00` del tema claro? | Si (6,8:1 sobre `bg`, 5,6:1 sobre `surface-raised`). |
| D-3 | ¿`ReadingHud`, `SightRuler` y `SetupCard` suben a `@sight-mapper/ui` o quedan en `apps/pwa`? | Subir solo el estilo/markup presentacional (props ya convertidas); la logica sigue en `pwa` + `domain`. `ui` ya depende de `domain`, no es nuevo. |
| D-4 | Se elimina el pie "Setups: 2" de Home (UX-UI §4.1 hoy dice que se mantiene) | Eliminar; el numero esta en el subtitulo de la cabecera. |
| D-5 | `theme-color` y `background_color` del manifest pasan de `#10286B` a `#0B1B45` | Si; en claro se puede sumar `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#EEF2F9">`. |
| D-6 | Brillo de fosforo en la lectura medida (solo oscuro) | Mantener, es decorativo y no baja contraste; quitar si el autor lo ve borroso al sol. |
| D-7 | ¿La cuadricula tambien detras de formularios largos de equipo? | Si (UX-UI §2.4 ya la pedia en formularios); los campos van en `SectionCard` opacas. |
| D-8 | Nombre de la ruta: `/settings` o `/settings/general` | `/settings` con redirect 301-like (`redirect` de TanStack) desde `/settings/appearance`. |
