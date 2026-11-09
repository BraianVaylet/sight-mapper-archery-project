# Capturas de referencia

Una captura por pantalla, a 360 px, en el tema **dark** (el del diseño) y en el **light** (alto
contraste, para el sol). Sirven para comparar a ojo antes de cambiar algo visual, y para revisar
un cambio en un PR. Las genera el mismo recorrido que verifica el contraste AA (F1-18):

```bash
SM_SCREENS=1 pnpm --filter @sight-mapper/pwa exec playwright test contrast --project=phone-360
```

- `dark/` y `light/`: misma numeracion y nombre en las dos, en el orden del recorrido.
- Son de pagina entera a escala 1x: lo que esta fijo en pantalla (la barra de abajo, un aviso)
  aparece donde estaba al sacar la captura, no al pie.
- Sin `SM_SCREENS=1` el test solo audita el contraste y no escribe nada.
