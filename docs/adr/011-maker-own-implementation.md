# ADR-011 — MAKER: implementacion propia, PDF en el cliente

- **Estado:** Propuesta (se acepta al iniciar F2)
- **Fecha:** 2026-10-29
- **Relacionadas:** spec §1.1 y §15, [SIGHT-MATH.md](../domain/SIGHT-MATH.md) §10

## Contexto

MAKER genera el tape que se pega en la mira. El borrador proponia hacer ingenieria inversa de
Precision Cut Archery con una "libreria REA". El dolor mas documentado del rubro es que el
navegador reescala en silencio y el tape sale mal. Se decidio (2026-10-29) un **diseño propio**.

## Decision

1. **No** se copia, descompila ni reutiliza codigo, assets ni formatos propietarios de
   competidores. PCA y Archer's Advantage son referencia **funcional** (features y UX publicas).
2. Geometria del tape en `@sight-mapper/domain/maker` (pura): posiciones en mm desde las marcas
   medidas y calculadas, con la misma distincion medido/estimado.
3. **PDF generado en el cliente** (libreria open source con licencia permisiva, a elegir en F2: p.
   ej. `pdf-lib`), mm → puntos con `72 / 25.4`.
4. **Calibracion de impresora:** el PDF incluye una barra de **100 mm**; el arquero la mide y
   reporta; el factor se guarda por usuario (y por impresora si hace falta) y se aplica a los
   siguientes tapes.
5. Editor de forma y tamaño (ancho, largo, tipografia, margenes) que **nunca altera la escala**.
6. Requiere mira con `unitSizeMm` conocido (RN-SGT-02).
7. Vive en la PWA con layout desktop (no es otra app).

## Alternativas consideradas

| Alternativa                          | Por que no                                                  |
| ------------------------------------ | ----------------------------------------------------------- |
| Ingenieria inversa de un competidor  | Riesgo legal (copyright, terminos de uso) y dependencia de un producto ajeno |
| PDF en el servidor                   | Innecesario: el dominio ya corre en el cliente; costo de servidor |
| Impresion directa a etiquetadora (Bluetooth) | Web Bluetooth limitado en iOS; se evalua despues de F2 |

## Consecuencias

- Positivas: propiedad intelectual limpia; tape coherente con el modelo empirico.
- Negativas: hay que resolver la calibracion de impresion por cuenta propia (es el corazon de F2).

## Como se hace cumplir

Revision de licencias de dependencias en CI. Test de geometria: una marca en `x` mm sale en `x`
mm en el PDF (a factor 1) y en `x · factor` con calibracion.
