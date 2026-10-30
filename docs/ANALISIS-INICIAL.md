# Analisis inicial — Sight Mapper Archery

> Fecha: 2026-10-29. Insumos: `docs/borrador-specs.md`, `design/` (13 pantallas hi-fi), `mockup/`
> (14 pantallas lo-fi), y como **referencia** (no se porta codigo) los proyectos previos del autor:
> `bow-sight-project` (reescritura con Fase 0 cerrada) y `bv-bow-sight` (app legacy con datos reales).
>
> Este documento explica de donde sale cada decision de la spec. La spec manda:
> [`spec/SIGHT-MAPPER-SPEC.md`](spec/SIGHT-MAPPER-SPEC.md).

---

## 1. El producto en una frase

Un **cuaderno de marcas de mira** para arqueros que no miente: guarda lo que el arquero midio,
calcula lo que nunca tiro (siempre marcado como estimado) y le avisa cuando una de sus marcas
probablemente este mal medida.

## 2. Lo que dicen los insumos

### 2.1 El borrador

- Producto vertical: marcas de mira y tapes. Nada de scoring, torneos ni red social.
- Dos modulos "visibles": **CALCULATOR** (movil, en el campo) y **MAKER** (desktop, tape imprimible).
- Principio rector: **empirico primero**. El calculo es guia; la marca la obtiene el arquero tirando.
- Arrastra secciones de un proyecto anterior que no aplican al MVP: billing, entitlements, estado
  `locked`, CRM/leads, sharing, jobs de cobro, webhooks, landing.

### 2.2 El diseño (`design/`)

| Archivo                            | Pantalla                                | Notas                                                   |
| ---------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| `Splash — Bow Sight.png`           | Splash                                  | Retícula + "B·S". Marca a renombrar (Sight Mapper)      |
| `Sign in — Bow Sight.png`          | Login                                   | Username **o** email, Google, recupero, version `v2.4`  |
| `Create account — Bow Sight.png`   | Registro                                | Email + **username** + password x2 (min 8)              |
| `Home — Your sets.png`             | Home: listado de sets                   | Card: arco, mira·tipo de pin, flechas, ultima edicion   |
| `Navigation drawer — Bow Sight.png`| Menu lateral                            | Contadores, Statistics, Profile, Appearance, "Synced"   |
| `New bow — Full form.png`          | Alta de arco (compuesto)                | 13 campos en 3 secciones                                |
| `New sight — Form.png`             | Alta de mira                            | Tipo de pin, unidad (mm/in/clicks/MOA), resolucion, rango |
| `New arrow set — Form.png`         | Alta de set de flechas                  | 8 campos, "deja vacio lo que no midiste"                |
| `New set — Form.png`               | Alta de set (arco + mira + flechas)     | 3 selects                                               |
| `UV slider — Empty state.png`      | Pantalla de la mira, vacia              | "Calculation needs at least **2** sight marks"          |
| `UV slider — Five marks.png`       | Pantalla de la mira, 5 marcas           | Lectura grande, regla + tabla, distancia seleccionada   |
| `UV slider — Full marks.png`       | Pantalla de la mira, 10 marcas          | Registrada ● vs calculada ◇                             |
| `Calculate distances — Curve.png`  | Distancias intermedias + curva          | Consulta de distancia libre, curva, regla               |

### 2.3 Los mockups (`mockup/`)

Version lo-fi anterior de las mismas pantallas (paleta gris/dorado). Aportan dos cosas que el diseño
hi-fi no muestra: una **barra de progreso** bajo la regla (el `X/5` del borrador) y la regla con
marcas calculadas como circulos huecos. El diseño hi-fi los reemplaza; se usan solo como referencia.

## 3. Inconsistencias encontradas y como se resolvieron

| #   | Tema                       | Borrador dice                              | Diseño dice                              | Resolucion (2026-10-29)                                                         |
| --- | -------------------------- | ------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Nombre                     | "Sight Mapper Archery", paquetes `@bow-sight` | "Bow Sight"                           | **Sight Mapper**. Paquetes `@sight-mapper/*`, errores `SM-*`. → ADR-002         |
| 2   | Codigo previo              | "Portar `@bow-sight/domain`"               | —                                        | **Desde cero.** Los proyectos previos son solo referencia                       |
| 3   | Minimo de marcas           | 5 (`SIGHT_CALC_MIN_MARKS`)                 | 2                                        | **Escalonado 2/3/5**: interpolar / extrapolar / Mark Doctor. → ADR-001          |
| 4   | Unidad de la mira          | mm canonico; `cm \| in \| click`           | mm / in / clicks / **MOA** + escala 1–9  | **Escala nativa con mapeo lineal a mm.** MOA se descarta. → ADR-005             |
| 5   | "Set" vs "Setup"           | Setup = arco + mira + flechas              | "Set" (choca con "Arrow set")            | **Setup** en UI y codigo. 1 arco + 1 mira + 1..N sets de flechas. → ADR-008     |
| 6   | Borrado                    | §5: cascada · §5.2.2: bloqueo 409          | —                                        | **Bloquear y ofrecer archivar.** Borrar un setup: soft delete + 30 dias. → ADR-008 |
| 7   | Tipos de arco              | Compuesto y recurvo                        | Solo campos de compuesto                 | **Solo compuesto en MVP**; `bowType` preparado para recurvo                     |
| 8   | Auth                       | Email + password                           | Username o email, Google, recupero       | **Todo lo del diseño** en MVP. → ADR-007                                        |
| 9   | Tema                       | "Un solo tema" y DoD "dark y light"        | Solo dark navy, boton Theme              | **Dark + light desde MVP** (light de alto contraste para el sol)               |
| 10  | Wind / Weather / Statistics| Correccion por clima (fase tardia)         | Botones visibles                         | **Visibles y deshabilitados**, con badge "Proximamente"                          |
| 11  | Direccion de la escala     | Minimo arriba, crece hacia abajo           | 1 arriba (5 marcas) / 9 arriba (10 marcas) | **Configurable por mira** (`scaleDirection`), default crece hacia abajo        |
| 12  | Alcance de billing         | "Para mas adelante" y a la vez F2 completa | —                                        | Fuera del MVP. Queda como fase posterior; sin estado `locked` en el MVP         |
| 13  | MAKER                      | Ingenieria inversa de Precision Cut Archery | —                                       | **Implementacion propia** inspirada en features publicas. Post-MVP. → ADR-011    |
| 14  | Puertos / apps             | PWA 8080, API 3000, "tres apps"            | —                                        | Dos apps en el MVP: `api` y `pwa`. MAKER vive dentro de la PWA (layout desktop) |
| 15  | Separador decimal          | —                                          | "4,5" y "4.5" mezclados                  | Formato por locale (`es`: coma, `en`: punto). Entrada acepta ambos              |
| 16  | Typos de datos de ejemplo  | —                                          | "SE Evo NXT 35" vs "PSE Evo NXT 35"      | Irrelevante para el producto; se corrige al pasar el diseño a componentes       |

## 4. Lo que el diseño todavia no cubre

Pantallas sin diseño hi-fi (se diseñan dentro de su tarea, siguiendo [UX-UI.md](UX-UI.md)):

- Listados de arcos, miras y flechas, y sus pantallas de detalle/edicion.
- Hoja (bottom sheet) de **agregar/editar marca**.
- **Mark Doctor** (resultado del analisis).
- Configuracion, Perfil (exportar datos, pedir la baja), Apariencia.
- Recupero y reseteo de contraseña, verificacion de email.
- Onboarding de primer uso.
- Listado imprimible de distancias.
- **Tema light** completo.
- Layouts tablet y desktop (768 / 1440).

## 5. Investigacion de producto (resumen)

El borrador ya trae el panorama competitivo (§3). Lo que se agrego:

- **Archer's Advantage** pide, para una mira tipo Hogg, el tipo de mira, la altura del peep y la
  distancia peep-mira, y dos marcas (20 y 60–80 yd) para "sight in". Al imprimir ofrece escalas de
  24 clicks, 32 clicks o metrica. Los usuarios reportan desvios a 60–80 yd y tener que "engañar" al
  programa bajando la velocidad para que el tape cierre: es exactamente el modo de falla de la
  balistica pura que el enfoque empirico evita. Fuente: foros de Rokslide.
- **Precision Cut Archery** destaca: motor offline con sync, impresion a impresoras de etiquetas
  (Brother/Epson por Bluetooth) y PDF, y ajuste por densidad del aire. Es la referencia funcional de
  MAKER; no se copia codigo ni se descompila nada (ADR-011).
- Campos de equipo que piden las apps del rubro y que el MVP adopta como **estructurados y
  opcionales**: ver [DICCIONARIO.md](DICCIONARIO.md) §3.

## 6. Lecciones tomadas de los proyectos previos (sin portar codigo)

1. PCHIP de Fritsch–Carlson para interpolar: pasa exacto por las marcas, es monotono y no sobrepasa.
2. La regla se calcula en **enteros** (quanta), nunca acumulando floats: a los 40 cm un bucle con
   paso 0.1 ya no cae en la marca.
3. La grilla imprimible se recalcula desde el origen (`d = from + i·step`), no se acumula.
4. Deuda que no se repite: el redondeo tiene que respetar el **quantum** real de la mira (lo que el
   arquero puede fijar), no un decimal fijo.
5. Deuda que no se repite: la extrapolacion por parabola "suelta" salta en el borde del rango
   medido. Aca se **ancla** al ultimo punto medido (ADR-001).
6. Mecanizar las reglas (ESLint de fronteras, gate de cobertura, hook de secretos) funciono: se
   mantiene.
