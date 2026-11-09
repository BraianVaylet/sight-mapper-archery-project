// No Zod here on purpose: the PWA imports this on its first screen, and importing a module that
// builds Zod schemas pulls the whole classic API into the initial JS (TECNICO §14).

/** A sign-in identifier that is an email goes to the email endpoint, anything else is a username. */
export const looksLikeEmail = (identifier: string): boolean => identifier.includes('@');
