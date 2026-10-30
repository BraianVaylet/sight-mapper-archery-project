# La matematica de las marcas

> Que hace `@sight-mapper/domain`, por que lo hace asi y que no se puede tocar. Es el activo tecnico
> del producto: no puede vivir solo en el codigo. → [ADR-001](../adr/001-empirical-first.md)
>
> Se implementa **desde cero** (no se porta codigo de proyectos previos), con TDD y tests de
> propiedades. Las lecciones de los proyectos previos estan en
> [ANALISIS-INICIAL.md](../ANALISIS-INICIAL.md) §6.

---

## 1. El problema

El arquero tiro a algunas distancias y anoto donde quedo la mira en cada una. Quiere saber donde va
la mira a las demas.

Dados los puntos medidos `(d_i, m_i)` —distancia en **metros**, posicion de escala en
**milimetros**— construir `m = f(d)` que:

1. pase **exacto** por cada punto medido,
2. sea **monotona** y **no sobrepase** entre puntos medidos,
3. extrapole con criterio y **siempre declarado como estimado**,
4. permita detectar el punto que probablemente este mal medido.

El dominio es agnostico de unidades de presentacion: entra metros y milimetros, sale milimetros.
Convertir a yardas, pulgadas, clicks o a la escala impresa de la mira ocurre afuera
([UNIDADES.md](UNIDADES.md)).

## 2. Por que no balistica ni regresion global

- **Balistica desde specs** (Archer's Advantage, PCA): sirve antes de tirar, pero traslada todo el
  error de entrada al resultado. La queja mas repetida en sus foros: "cargue los datos y todas las
  marcas salieron mal", y usuarios bajando la velocidad a mano para que el tape cierre. Queda como
  **semilla** en F6, nunca como autoridad.
- **Regresion cuadratica global** (Archery Sight Mark Pro): robusta al ruido, pero la curva **no
  pasa por ningun punto medido**. El arquero ve que a 30 m la app dice 2.1 cuando el tiro y anoto
  2.0, y deja de creerle. Con razon.

## 3. Preprocesado

1. Se toman solo las marcas `measured` no borradas del par (setup, set de flechas).
2. Se ordenan por distancia.
3. **Distancias repetidas** (no deberian existir por RN-MRK-04, pero el dominio no confia): se
   colapsan promediando la posicion. Sin eso, PCHIP divide por cero.
4. Valores no finitos o distancias `≤ 0` lanzan `DomainError` (bug de quien llama, no del arquero).

## 4. Calculo escalonado

| `n` marcas | Dentro de `[d_min, d_max]` | Fuera del rango          | Doctor                     |
| ---------- | -------------------------- | ------------------------ | -------------------------- |
| 0          | —                          | —                        | `insufficient`             |
| 1          | solo `d_1` exacto          | —                        | `insufficient`             |
| 2          | PCHIP (lineal con 2 puntos)| — (`SM-CALC-422-002`)    | solo monotonia             |
| 3–4        | PCHIP                      | parabola anclada         | solo monotonia             |
| ≥ 5        | PCHIP                      | parabola anclada         | monotonia + leave-one-out  |

Constantes en `packages/domain/src/constants.ts`:

```ts
export const CALC_MIN_MARKS_INTERPOLATE = 2;
export const CALC_MIN_MARKS_EXTRAPOLATE = 3;
export const CALC_MIN_MARKS_DOCTOR = 5;
export const EXTRAPOLATION_WARN_RATIO = 0.25; // mas alla de 25% del rango medido: baja confianza
export const DOCTOR_K = 3;                    // umbral en desvios robustos
export const DOCTOR_MIN_ABS_MM = 1;           // nunca señalar menos de 1 mm (o el quantum, si es mayor)
export const DOCTOR_ENDPOINT_FACTOR = 1.5;    // los extremos se predicen extrapolando: mas tolerancia
export const MAX_DISTANCE_M = 300;
```

## 5. Dentro del rango: PCHIP

Spline cubico de Hermite por tramos con tangentes de **Fritsch–Carlson** (variante de Fritsch–
Butland, la que usa SciPy en `PchipInterpolator`).

Con `h_k = d_{k+1} − d_k` y `δ_k = (m_{k+1} − m_k) / h_k`:

- **Tangentes interiores** `t_k`, `k = 1..n−2`:
  - si `δ_{k−1} · δ_k ≤ 0` → `t_k = 0` (extremo local: evita el sobrepaso);
  - si no, media armonica ponderada:
    `w1 = 2h_k + h_{k−1}`, `w2 = h_k + 2h_{k−1}`, `(w1 + w2) / t_k = w1/δ_{k−1} + w2/δ_k`.
- **Tangentes de los extremos** (formula de tres puntos, recortada):
  `t_0 = ((2h_0 + h_1)δ_0 − h_0 δ_1) / (h_0 + h_1)`;
  si `sign(t_0) ≠ sign(δ_0)` → `t_0 = 0`;
  si `sign(δ_0) ≠ sign(δ_1)` y `|t_0| > 3|δ_0|` → `t_0 = 3δ_0`. Simetrico en el otro extremo.
- **Con `n = 2`**: `t_0 = t_1 = δ_0`, es decir, interpolacion **lineal**.
- **Evaluacion** en `d ∈ [d_k, d_{k+1}]` con `s = (d − d_k)/h_k` y la base de Hermite:
  `f(d) = h00(s)·m_k + h10(s)·h_k·t_k + h01(s)·m_{k+1} + h11(s)·h_k·t_{k+1}`.

Propiedades garantizadas (y testeadas):

1. `f(d_i) = m_i` **exacto** (se devuelve `m_i` sin evaluar el polinomio cuando `d = d_i`).
2. Si los datos son monotonos, `f` es monotona.
3. En `[d_k, d_{k+1}]`, `f` queda entre `m_k` y `m_{k+1}`.

## 6. Fuera del rango: parabola anclada

1. Ajuste por minimos cuadrados `q(d) = a·d² + b·d + c` sobre **todos** los puntos medidos.
   Para estabilidad numerica se ajusta sobre la variable centrada y escalada
   `x = (d − d̄) / s` (`s` = desvio de las distancias) y se resuelve el sistema normal 3×3 por
   Cramer; con `n = 3` la parabola interpola exacto.
2. **Anclaje** al borde para no saltar (deuda que no se repite del proyecto previo):
   - `d > d_max`: `f(d) = m_max + (q(d) − q(d_max))`
   - `d < d_min`: `f(d) = m_min + (q(d) − q(d_min))`
   `f` es continua en el borde y conserva la **forma** (curvatura) del ajuste global.
3. **Limite fisico:** si la derivada `q'(d)` cambia de signo antes de `d` (la parabola dio la vuelta
   en su vertice), no se extrapola mas alla del vertice: `SM-CALC-422-004`.
4. **Confianza:** si `d` se aleja del rango mas de `EXTRAPOLATION_WARN_RATIO × (d_max − d_min)`, el
   resultado lleva `lowConfidence: true` y la UI lo avisa.

Uso tipico: sala (18 m) por debajo de la marca mas corta de aire libre, y distancias largas.

🔴 **Lo extrapolado se marca estimado, siempre.** En pantalla: punteado y `≈`. En papel: `≈` y nota
al pie.

## 7. Monotonia (desde 2 marcas)

La fisica fija el sentido: a mas distancia, el arco apunta mas arriba y por lo tanto la mira **baja**.
Entonces el sentido esperado de las lecturas sale de la direccion de la escala:

- `scale.direction = 'down'` (numeros crecen hacia abajo) → las lecturas **crecen** con la
  distancia.
- `scale.direction = 'up'` → las lecturas **decrecen** con la distancia.

En milimetros canonicos (`scaleValueMm = lectura × unitSizeMm`) el sentido esperado es el mismo que
el de las lecturas. Cada par consecutivo `(i, i+1)` ordenado por distancia con
`sign(m_{i+1} − m_i) ≠ sentidoEsperado` (incluido igual a cero) produce un hallazgo
`inconsistent` sobre **ambas** marcas. No se corrige nada: el modelo las honra igual (PCHIP pone
tangente cero en el extremo) y la UI avisa.

## 8. Mark Doctor (desde 5 marcas)

### 8.1 Por que leave-one-out

Un residuo contra la parabola ajustada **con** la marca sospechosa subestima el error: la marca mala
tira de la curva hacia si misma y esconde su propio residuo. Por eso cada marca se evalua contra la
tendencia ajustada **sin ella**.

### 8.2 Algoritmo

Para cada marca medida `i`:

1. Ajustar `q₋ᵢ` (parabola de minimos cuadrados) con las otras `n − 1 ≥ 4` marcas.
2. Residuo leave-one-out: `r_i = m_i − q₋ᵢ(d_i)` (mm).

Luego:

3. Escala robusta: `σ = 1.4826 · median(|r − median(r)|)` (MAD).
4. Umbral por marca:
   `τ_i = max(DOCTOR_MIN_ABS_MM, quantumMm, DOCTOR_K · σ) · (i es extremo ? DOCTOR_ENDPOINT_FACTOR : 1)`.
5. Candidatas: `|r_i| ≥ τ_i`. Se reporta **la peor** (mayor `|r_i| / τ_i`) como `suspect`, con su
   magnitud convertida a la escala de la mira y la sugerencia "volver a tirar esa distancia". Las
   demas candidatas se listan como secundarias.
6. Si hay hallazgos de monotonia, el estado es `inconsistent` (prevalece sobre `suspect`).

```ts
type DoctorReport = {
  status: 'insufficient' | 'ok' | 'suspect' | 'inconsistent';
  residuals: { markId: string; residualMm: number; thresholdMm: number }[];
  suspect?: { markId: string; residualMm: number; suggestion: 'reshoot' };
  secondary: string[];               // otros markId sobre el umbral
  monotonicity: { markIds: [string, string] }[];
};
```

### 8.3 Calibracion

`DOCTOR_K`, `DOCTOR_MIN_ABS_MM` y `DOCTOR_ENDPOINT_FACTOR` son **iniciales**. Se calibran en F1 con
los datos reales del autor como fixtures: ningun falso positivo en sets que el autor considera
buenos, y deteccion de errores sinteticos de ±1 unidad de escala inyectados en una marca interior.

## 9. Intermedias y consultas

- **Grilla:** `grid(from, to, step)` en la **unidad del arquero** (m o yd), recalculada desde el
  origen: `d_k = from + k·step`, `k = 0..⌊(to − from)/step⌋`. Nunca se acumula `d += step`. Cada
  `d_k` se convierte a metros y se evalua.
- **Resultado por fila:** `{ distanceM, scaleValueMm, kind, lowConfidence, outOfScale }`, donde
  `kind = 'measured'` si `distanceM` coincide (a 1 mm) con una marca medida.
- **Consulta libre:** la misma evaluacion para una sola distancia; la UI la muestra como rombo
  resaltado.
- **Fuera de escala:** si `scaleValueMm ∉ [scaleMinMm, scaleMaxMm]`, `outOfScale: true` (RN-CAL-04).
  El valor no se recorta.

## 10. La regla (ruler)

Geometria pura en `packages/domain/src/ruler/`; el SVG lo dibuja la PWA.

- **Enteros:** se trabaja en **quanta de tick** enteros. Para cada unidad, tres niveles de tick
  (menor, medio, mayor) expresados como multiplos enteros del tick menor:

  | Unidad   | Menor     | Medio      | Mayor      |
  | -------- | --------- | ---------- | ---------- |
  | `mm`     | 1 mm      | 5 mm       | 10 mm      |
  | `cm`     | 0.1 cm    | 0.5 cm     | 1 cm       |
  | `in`     | 1/16 in   | 1/4 in     | 1 in       |
  | `click`  | 1 click   | 5 clicks   | 10 clicks  |
  | `custom` | 0.1       | 0.5        | 1          |

- **Posicion:** `y = (v − min)/(max − min) · alto` si `direction = 'down'`; invertido si `'up'`.
- **Guarda de densidad:** si dos ticks de un nivel quedarian a menos de 4 px, ese nivel no se
  dibuja. Una regla ilegible es peor que una con menos marcas.
- **Anti-solape:** etiquetas a menos de su alto se empujan; se conserva la posicion real para la
  linea guia. La etiqueta se mueve; el dato no.
- **Escala fisica:** si la mira tiene `unitSizeMm`, la regla puede dibujarse a escala 1:1 (base de
  MAKER). Sin `unitSizeMm`, solo proporcional.

## 11. Corte por angulo (F3)

`distanciaHorizontal = cos(angulo) × distanciaLineaDeVision` y se evalua `f` en esa distancia.
Aproximacion estandar de la industria, buena entre 20 y 40 yd. El angulo entra por inclinometro
(`DeviceOrientationEvent`, con permiso explicito en iOS) o a mano.

## 12. Semilla balistica (F6)

Integracion **RK4** de la trayectoria con arrastre y busqueda binaria sobre el angulo de
lanzamiento hasta que la altura de impacto converge (con arrastre no hay solucion cerrada). Genera
marcas `seeded` que ceden ante cualquier `measured` del mismo tramo.

## 13. Lo que no se toca

1. `markAt(d_i)` devuelve **exactamente** la marca medida en `d_i`.
2. Entre marcas medidas, el modelo no sobrepasa ni cambia de sentido si los datos no lo hacen.
3. El dominio es puro: sin I/O, sin framework, sin reloj, sin azar.
4. La regla trabaja en enteros y la grilla se recalcula desde el origen.
5. Metros y milimetros adentro; conversiones solo en `convert/`.
6. Lo calculado nunca se presenta como medido.

Cada una tiene su test (unitario + propiedades con `fast-check`). Gate de cobertura: **95%**.
Si un test de estos cambia, cambio el comportamiento del producto: requiere ADR.
