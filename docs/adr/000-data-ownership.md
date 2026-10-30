# ADR-000 — El dueño de los datos es el arquero

- **Estado:** Aceptada
- **Fecha:** 2026-10-29
- **Relacionadas:** spec §11, ADR-009

## Contexto

Producto B2C multi-usuario sobre una sola base. Un error de aislamiento (un arquero que ve marcas de
otro) es el peor incidente posible: destruye la confianza en un producto cuyo valor es "tus datos,
medidos por vos". Ademas, en el futuro habra lectura compartida con un coach (F6).

## Decision

1. Toda coleccion de negocio lleva `userId`. Sin excepcion.
2. **El `userId` sale de la sesion.** Nunca del body, de la query ni de un parametro de ruta.
3. Tres capas independientes:
   - **Repositorio** que recibe el contexto del usuario y lo inyecta en toda consulta.
   - **Plugin de Mongoose** que hace fallar cualquier query sin `userId` (`SM-CORE-500-002`). Solo
     los jobs de sistema pueden desactivarlo, con nombre explicito.
   - **Suite parametrizada** que recorre el registro de rutas y ataca cada una desde otro usuario.
4. Todo indice compuesto empieza por `userId`.
5. Un recurso ajeno responde **404** (no 403): no se confirma su existencia.
6. Las marcas de un arquero no se usan para nada agregado sin consentimiento explicito.
7. El arquero puede descargar todo lo suyo (JSON) y pedir la baja (purga a 90 dias).

## Alternativas consideradas

| Alternativa                         | Por que no                                                         |
| ----------------------------------- | ------------------------------------------------------------------ |
| Una base por usuario                | Costo y operacion desproporcionados para un B2C de precio bajo     |
| Solo filtro en repositorios         | Un solo olvido filtra datos; no hay red de seguridad              |
| 403 para recursos ajenos            | Confirma que el id existe (enumeracion)                            |

## Consecuencias

- Positivas: aislamiento verificable de forma automatica; base lista para compartir con permiso
  explicito (F6) como unica excepcion de lectura.
- Negativas: cada ruta nueva necesita su fixture de ataque; los jobs de sistema son codigo especial.

## Como se hace cumplir

ESLint prohibe importar modelos de Mongoose fuera de `infrastructure/` y desde rutas. El plugin de
aislamiento esta activo en tests. La suite de aislamiento falla si una ruta registrada no tiene
fixture. Test no negociable #1.
