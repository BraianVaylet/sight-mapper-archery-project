# Unidades

> Como se guardan, se convierten, se redondean y se muestran las magnitudes. →
> [ADR-005](../adr/005-canonical-units.md). Implementacion: `packages/domain/src/convert/`.

---

## 1. Regla de oro

**Se guarda canonico. Se convierte solo en el borde de presentacion. Nunca se guarda un valor
convertido a la unidad de presentacion.**

| Magnitud             | Canonico           | Presentacion metrico | Presentacion imperial |
| -------------------- | ------------------ | -------------------- | --------------------- |
| Distancia al blanco  | m (a 0.001)        | m                    | yd                    |
| Posicion de escala   | mm                 | unidad de la mira    | unidad de la mira     |
| Longitudes de equipo | mm                 | cm o mm              | in (admite fracciones)|
| Masas                | g                  | g                    | gr (granos)           |
| Velocidad            | m/s                | m/s                  | fps                   |
| Libraje              | N                  | kg                   | lb                    |
| Ratings (spine, GPI) | rating de industria| igual                | igual                 |
| Porcentajes          | %                  | %                    | %                     |
| Instantes            | UTC (`Temporal.Instant`) | zona del dispositivo | zona del dispositivo |

La unidad de presentacion del **equipo** por sistema es decision abierta (spec §17.2): la tabla de
arriba es la propuesta inicial.

## 2. Constantes exactas

```ts
export const M_PER_YD = 0.9144;          // exacta por definicion
export const MM_PER_IN = 25.4;           // exacta
export const G_PER_GR = 0.06479891;      // exacta
export const MPS_PER_FPS = 0.3048;       // exacta
export const N_PER_LBF = 4.4482216152605;// exacta
export const N_PER_KGF = 9.80665;        // exacta
```

## 3. La escala de la mira

La mira define como se lee su escala (`SightScale`, ver [DOMINIO.md](../DOMINIO.md) §2.2):

```
posicionMm = lectura × unitSizeMm
lectura    = posicionMm / unitSizeMm
```

| `unit`   | `unitSizeMm`        | Ejemplo de mira                                 |
| -------- | ------------------- | ----------------------------------------------- |
| `mm`     | 1 (fijo)            | Escala milimetrada                               |
| `cm`     | 10 (fijo)           | Escala en cm con decimales                       |
| `in`     | 25.4 (fijo)         | Escala en pulgadas                               |
| `click`  | el arquero lo carga | Micro-ajuste por clicks (ej. 0.5 mm/click)       |
| `custom` | el arquero lo carga | Tape impreso numerado 1–9 (ej. 10 mm por unidad) |

Para `custom`, la UI pide **minimo, maximo y el largo fisico entre ambos** (medido con calibre), y
calcula `unitSizeMm = largoMm / (max − min)`. Sin `unitSizeMm`, la mira funciona para calcular
(se usa factor nominal 1) pero no hay regla a escala real ni tape.

No hay offset: el origen de la escala es abstracto y no hace falta para el calculo ni para el tape.

## 4. Quantum y redondeo

El **quantum** es el paso que el arquero puede fijar (`scale.resolution`, en unidades de escala).

- Toda lectura **mostrada** se redondea al quantum: `round(lectura / q) · q`, calculado en enteros
  de quantum para no acumular error de punto flotante.
- Los decimales mostrados salen del quantum (`0.5` → 1 decimal, `0.25` → 2, `1` → 0).
- Lo **guardado** no se redondea al quantum: es la lectura convertida a mm, tal como la ingreso el
  arquero.
- El separador decimal sale del locale (`es`: coma, `en`: punto). La entrada acepta ambos.

## 5. Distancias

- Canonico en metros, redondeado a 0.001 m (1 mm). `20 yd = 18.288 m` exacto.
- En imperial, la grilla de intermedias se arma en **yardas** (20, 25, 30 yd) y se convierte cada
  punto a metros: nunca metros redondos convertidos a yardas.
- La unicidad de una marca (RN-MRK-04) compara `distanceM` canonico a 0.001.

## 6. Entrada de valores

- Numeros con coma o punto decimal.
- Imperial: fracciones `6 1/4`, `6-1/4`, `1/16` y mixtos; se normalizan a decimal.
- Validacion de rango **en la unidad canonica** (los rangos del [DICCIONARIO](../DICCIONARIO.md)
  estan en canonico), con el mensaje de error en la unidad de presentacion (`params` incluye
  `min`, `max` y `unit` ya convertidos por el cliente).

## 7. Ida y vuelta sin perdida

Test obligatorio (#6 de la spec): para todo valor `v` canonico en rango y toda unidad `u`,
`fromDisplay(toDisplay(v, u), u)` redondeado al quantum de presentacion de `u` es igual a `v`
redondeado al mismo quantum. Se prueba con `fast-check` sobre m↔yd y sobre las cinco unidades de
escala.
