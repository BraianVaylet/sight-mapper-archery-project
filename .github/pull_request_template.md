## Que cambia y por que

<!-- Una o dos lineas. Tarea del plan: F0-xx / F1-xx. -->

## Definition of Done (spec §20)

- [ ] Cumple los criterios de aceptacion de la tarea
- [ ] Tests con la cobertura de su zona (domain 95% · marcas, setups, unidades, auth 85% · equipo, account 80% · UI generica 50%)
- [ ] **Aislamiento por usuario**: un test prueba que otro usuario no ve ni toca el recurso (si toca datos)
- [ ] Si toca `@sight-mapper/domain`: el modelo pasa exacto por las marcas medidas sigue verde
- [ ] Validacion Zod compartida en `@sight-mapper/schemas`
- [ ] Errores tipados declarados en `docs/errors.md` (y claves ES/EN)
- [ ] Logs estructurados, sin datos sensibles
- [ ] Estados vacio / carga / error, accesible, responsive 360 / 768 / 1440
- [ ] Dark y light, ES y EN
- [ ] OpenAPI actualizado (si toca la API)
- [ ] Entrada en `docs/BITACORA.md` y tarea marcada en `docs/ACTION-PLAN.md`

## Verificado

<!-- Como lo probaste, no solo "tests verdes": comandos, pantallas, casos limite. -->

## Pendiente o deuda

<!-- Lo que quedo afuera a proposito. -->
