# @sight-mapper/domain — la matematica de las marcas

Contexto raiz en `../../CLAUDE.md`. Documentos de referencia: `docs/domain/SIGHT-MATH.md` y
`docs/domain/UNIDADES.md`. Este paquete es el activo tecnico del producto.

## Lo que no se toca (SIGHT-MATH §13)

1. `markAt(d_i)` devuelve **exactamente** la marca medida en cada `d_i`.
2. Entre marcas medidas no sobrepasa ni cambia de sentido si los datos no lo hacen.
3. **Puro:** sin I/O, framework, reloj (`Date`, `Temporal.Now`) ni azar (`Math.random`), y sin
   imports de fuera del paquete. ESLint lo exige en `src/`.
4. La regla trabaja en enteros y la grilla se recalcula desde el origen (`from + k·step`).
5. Metros y milimetros adentro; conversiones solo en `convert/`.
6. Lo calculado nunca se presenta como medido (`kind` viaja siempre).

Cambiar el comportamiento de uno de estos requiere un ADR, no solo un test nuevo.

## Convenciones

- Resultados que el arquero puede provocar → union discriminada (`{ ok: false, code, params }`).
  `DomainError` solo para bugs de quien llama (no finito, distancia ≤ 0).
- **Todo bucle acotado** (`MAX_GRID_ROWS`, `MAX_RULER_TICKS`) y todo indice `Number.isSafeInteger`
  cuando se itera con un contador: una entrada enorme no puede colgar ni agotar memoria.
- Cuidado con `-0`, `NaN`, `Infinity` y valores cerca de 2^53; hay tests de cada uno.
- Constantes de calibracion en `src/constants.ts`, con su comentario.
- Un archivo de test al lado de cada modulo; propiedades con `fast-check` para todo lo numerico.
  Los valores de referencia se calculan **a mano** con las formulas del documento (o con una
  herramienta independiente), nunca copiando la salida del propio codigo.

## Probar

```
pnpm --filter @sight-mapper/domain test:coverage    # umbral 95%
```

Cualquier cambio aca deberia pasar por el agente `domain-reviewer` antes de cerrarse.
