# Documentacion — Sight Mapper

> Por donde empezar segun lo que necesites. La [spec](spec/SIGHT-MAPPER-SPEC.md) manda sobre todo
> lo demas.

| Necesito…                                   | Documento                                              |
| ------------------------------------------- | ------------------------------------------------------ |
| Saber que es el producto y sus reglas       | [spec/SIGHT-MAPPER-SPEC.md](spec/SIGHT-MAPPER-SPEC.md) |
| Entender por que se decidio cada cosa       | [ANALISIS-INICIAL.md](ANALISIS-INICIAL.md) · [adr/](adr/README.md) |
| Ver flujos, pantallas y criterios de aceptacion | [FUNCIONAL.md](FUNCIONAL.md)                       |
| Ver la estructura del sistema               | [ARQUITECTURA.md](ARQUITECTURA.md)                     |
| Saber como se construye (stack, API, CI)    | [TECNICO.md](TECNICO.md)                               |
| Entender el modelo (agregados, estados)     | [DOMINIO.md](DOMINIO.md)                               |
| Buscar un termino o un campo                | [DICCIONARIO.md](DICCIONARIO.md)                       |
| Declarar o manejar un error                 | [errors.md](errors.md)                                 |
| Entender la matematica                      | [domain/SIGHT-MATH.md](domain/SIGHT-MATH.md)           |
| Convertir unidades                          | [domain/UNIDADES.md](domain/UNIDADES.md)               |
| Implementar UI                              | [UX-UI.md](UX-UI.md) · `../design/`                    |
| Saber que sigue                             | [ACTION-PLAN.md](ACTION-PLAN.md)                       |
| Saber que paso                              | [BITACORA.md](BITACORA.md)                             |
| Ver el borrador original                    | [borrador-specs.md](borrador-specs.md) (historico)     |

## Reglas de la documentacion

1. **Spec primero:** si algo no esta en la spec, se actualiza la spec y despues se codea.
2. Cambios en la spec marcados `[+]` / `[~]`; nada se borra.
3. Una decision de arquitectura = un ADR. Las aceptadas no se re-litigan: se reemplazan.
4. Codigos de error se declaran en `errors.md` **antes** de empezar la tarea (DoR).
5. Toda tarea cerrada deja entrada en la bitacora (DoD).
6. Documentacion en español (es-AR); codigo, campos y commits en ingles.
