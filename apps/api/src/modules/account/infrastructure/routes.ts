import { createRoute } from '@hono/zod-openapi';
import { detectLocale } from '@sight-mapper/i18n';
import {
  profile,
  putQuickAccess,
  updatePreferences as updatePreferencesBody,
} from '@sight-mapper/schemas';
import type { Locale } from '@sight-mapper/types';
import type { Context } from 'hono';
import { parseLanguages } from '../../../core/auth/auth.js';
import { expectedVersion, setEtag } from '../../../core/concurrency/concurrency.js';
import { AppError } from '../../../core/http/errors.js';
import type { AppBindings } from '../../../core/http/context.js';
import type { RouteRegistry } from '../../../core/registry/registry.js';
import type { PreferencesPatch, Profile, QuickAccess } from '../domain/profile.js';

export type AccountRoutesDeps = {
  readonly ensureProfile: (userId: string, locale: Locale) => Promise<Profile>;
  readonly updatePreferences: (
    userId: string,
    fallbackLocale: Locale,
    patch: PreferencesPatch,
    expectedVersion: number,
  ) => Promise<Profile>;
  readonly setQuickAccess: (
    userId: string,
    fallbackLocale: Locale,
    quickAccess: QuickAccess | null,
    expectedVersion: number,
  ) => Promise<Profile>;
};

const json = <S extends typeof profile | typeof updatePreferencesBody | typeof putQuickAccess>(
  schema: S,
) => ({
  'application/json': { schema },
});

/** The profile as it goes on the wire: ISO instants, no user id (ADR-000: it is the session's). */
function toWire(p: Profile) {
  return {
    locale: p.locale,
    unitSystem: p.unitSystem,
    theme: p.theme,
    quickAccess: p.quickAccess,
    deletionRequestedAt: p.deletionRequestedAt === null ? null : p.deletionRequestedAt.toString(),
    version: p.version,
  };
}

/** Who is calling comes from the session, never from the body, the query or the path. */
function owner(c: Context<AppBindings>): string {
  const userId = c.get('userId');
  if (userId === undefined) throw new AppError('SM-CORE-401-001');
  return userId;
}

/** Only used when a profile has to be created on the spot: the browser's language. */
const browserLocale = (c: Context<AppBindings>): Locale =>
  detectLocale(parseLanguages(c.req.header('accept-language')));

export function registerAccountRoutes(registry: RouteRegistry, deps: AccountRoutesDeps): void {
  registry.register(
    createRoute({
      method: 'get',
      path: '/api/v1/me',
      tags: ['account'],
      summary: 'The signed-in archer: preferences, quick access and deletion status',
      responses: { 200: { description: 'The profile', content: json(profile) } },
    }),
    async (c) => {
      const found = await deps.ensureProfile(owner(c), browserLocale(c));
      setEtag(c, found);
      return c.json(toWire(found), 200);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'patch',
      path: '/api/v1/me/preferences',
      tags: ['account'],
      summary: 'Change language, unit system or theme',
      request: { body: { required: true, content: json(updatePreferencesBody) } },
      responses: { 200: { description: 'The profile, updated', content: json(profile) } },
    }),
    async (c) => {
      const updated = await deps.updatePreferences(
        owner(c),
        browserLocale(c),
        c.req.valid('json'),
        expectedVersion(c),
      );
      setEtag(c, updated);
      return c.json(toWire(updated), 200);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'put',
      path: '/api/v1/me/quick-access',
      tags: ['account'],
      summary: 'Set the setup and arrow set the app opens on, or clear it with null',
      request: { body: { required: true, content: json(putQuickAccess) } },
      responses: { 200: { description: 'The profile, updated', content: json(profile) } },
    }),
    async (c) => {
      const updated = await deps.setQuickAccess(
        owner(c),
        browserLocale(c),
        c.req.valid('json'),
        expectedVersion(c),
      );
      setEtag(c, updated);
      return c.json(toWire(updated), 200);
    },
    { auth: 'session' },
  );
}
