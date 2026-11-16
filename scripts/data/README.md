# Importar tus datos reales (F1-21)

`scripts/import-author-data.mjs` carga equipo, setups y marcas **por la API publica**, con tu
propia sesion: valen todas las reglas de la app (cada cosa es tuya, se valida, una marca por
distancia). Es para usar una vez, cuando produccion exista.

## Pasos

1. Copia `author-sets.example.json` a `author-sets.json` (git lo ignora) y completa lo que dice
   `COMPLETAR` (el arco no figura en tus notas del 31/10). Revisa nombres, escala y marcas.
2. Entra a la app en el navegador con tu cuenta.
3. Copia la cookie de sesion: herramientas de desarrollador → Aplicacion → Cookies → el dominio de
   la app → `better-auth.session_token` (nombre y valor).
4. Primero, sin escribir nada (muestra que haria):

   ```bash
   SM_SESSION_COOKIE='better-auth.session_token=VALOR' node scripts/import-author-data.mjs --file scripts/data/author-sets.json --api https://LA-APP
   ```

5. Si esta bien, lo mismo con `--apply`. Se puede repetir: lo que ya esta no se duplica.
6. Si una distancia ya tiene otra lectura en la app, **no se pisa**: queda en "conflicts" y el
   script termina con codigo 3. Para reemplazarla, `--replace`.

## Cuidado

- **La cookie es una credencial:** quien la tiene entra como vos hasta que la sesion vence. No la
  pegues en ningun lado mas que en tu terminal, no la guardes en un archivo del repo, y al terminar
  cerra la sesion en la app (eso la invalida).
- El script nunca pide, guarda ni muestra una contraseña ni el token.
- Las distancias del archivo van en `m` o `yd` (`distanceUnit`); las lecturas en la unidad de la
  escala de la mira. El script convierte con el mismo dominio que la app (metros y milimetros).
