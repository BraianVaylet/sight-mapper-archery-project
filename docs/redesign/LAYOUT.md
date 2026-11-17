# Layout y navegacion

Reacomodo de la app para uso en la linea de tiro. Lo que cambia respecto de hoy y por que.

## Configuracion solo en Ajustes

- **Ajustes** (`/settings`, reemplaza "Apariencia") es el unico lugar con tema, idioma y unidades. Agrupado: 01 Pantalla · 02 Idioma y unidades · 03 Acerca de (version).
- Se eliminan: el boton "Tema"/"Apariencia" de la cabecera y el `PreferencesBar` del pie global (y el pie entero: la version pasa a Ajustes).
- Unica excepcion: `LanguageSwitch` compacto en las pantallas de invitado (ingresar, crear cuenta, recuperar, verificar), porque sin cuenta no hay Ajustes. Ahi el tema sigue al sistema.
- Impacto en spec: actualizar `docs/UX-UI.md` y FUNCIONAL §1.1 (ruta `/settings`, menu) antes de codear.

## Cabecera

- Izquierda: logo (Inicio) o Volver (pantallas internas). Centro: titulo + contexto. Derecha: solo el menu.
- Sin acciones de configuracion ni duplicados del menu.

## Menu

- Dos grupos rotulados: **01 — Tiro** (Inicio, Arcos, Miras, Flechas, Estadisticas "Pronto") y **02 — Cuenta** (Ajustes, Perfil, Papelera).
- Cerrar sesion y hora de sincronizacion al pie del menu.

## Pantalla de la mira (orden de uso)

1. Cabecera (mira, setup, marcas).
2. Set de flechas.
3. `ReadingHud`: distancia + lectura. Lo que se mira entre tiro y tiro, arriba y grande.
4. `SightRuler`: regla + lista; tocar una fila elige la distancia.
5. `ActionBar` fija abajo: herramientas (Intermedias, Viento, Doctor, Imprimir), "Agregar marca" y tira de estado.

Antes las herramientas estaban arriba del titulo, lejos del pulgar, y la accion primaria compartia peso visual con "Calcular intermedias". Ahora: una sola primaria, abajo.

## Inicio

- Saludo + "Tus setups" sobre la cuadricula, `SetupCard` iguales entre si, "Crear setup" fijo abajo.
- Se quita el contador "Sets guardados" del pie (ya esta en el subtitulo de la cabecera).

## Breakpoints

- **360**: una columna, `ActionBar` fija, margen `space-4`.
- **768**: en la mira, HUD a la izquierda y escala a la derecha; herramientas como barra sobre la escala; la primaria sigue visible sin scroll.
- **1440**: contenido max `content-max` (1200px) centrado; el menu pasa a riel lateral fijo de 320px; la cuadricula ocupa todo el viewport.

## Reglas UX

- Una accion primaria por vista, en la zona del pulgar.
- Guardar una marca no bloquea: toast con Deshacer 8 s.
- Estados vacio / carga / error en todo listado.
- Destructivo: papelera 30 dias y deshacer antes que confirmaciones modales.
