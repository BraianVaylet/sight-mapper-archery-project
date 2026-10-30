# ADR-007 — Autenticacion con Better Auth

- **Estado:** Aceptada
- **Fecha:** 2026-10-29
- **Relacionadas:** TECNICO §7, spec §6.2

## Contexto

El diseño pide login con **username o email**, registro con username, **Google** y recupero de
contraseña. El borrador pedia solo email + password con Better Auth. Se decidio incluir todo lo del
diseño en el MVP.

## Decision

1. **Better Auth** montado en `/api/auth/*`, con su adaptador de MongoDB sobre la misma base.
2. Email + password (min. 8), **plugin `username`** (login por email o username), **Google** como
   proveedor social.
3. Verificacion de email obligatoria (Resend), reset por enlace de un solo uso (1 h) que revoca
   las demas sesiones.
4. Sesion por cookie `httpOnly`, `Secure`, `SameSite=Lax`; PWA y API en el mismo sitio.
5. Rate limit de Better Auth en login, registro, recupero y verificacion.
6. Los errores del proveedor se traducen a `SM-AUTH-*` (sin prosa).
7. Alta de usuario → evento `UserRegistered` → `Profile` en `account`.

## Alternativas consideradas

| Alternativa                 | Por que no                                                          |
| --------------------------- | ------------------------------------------------------------------- |
| Auth.js                     | Menos integrado con Hono; plugins de username menos directos        |
| Clerk / Auth0 / Supabase Auth | Costo por MAU, dependencia de tercero para el dato mas sensible    |
| Auth propio                 | Riesgo de seguridad innecesario                                     |
| Magic link sin password     | El diseño pide password; con mala señal en el campo es peor         |

## Consecuencias

- Positivas: todas las piezas del diseño cubiertas por una libreria; datos de identidad en la
  propia base.
- Negativas: configurar Google Cloud (consola OAuth) y dominio antes de produccion; dependencia de
  la evolucion de Better Auth.

## Como se hace cumplir

Tests de integracion de auth (registro, login por email y por username, verificacion, reset,
rate limit). Ningun log contiene contraseñas ni tokens (test sobre el serializer de Pino).
