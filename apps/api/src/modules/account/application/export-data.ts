import { EXPORT_SCHEMA_VERSION, type AccountExport } from '@sight-mapper/schemas';
import type { Locale } from '@sight-mapper/types';
import type { Clock, Profile } from '../domain/profile.js';

/** What a module adds to the export: its own rows, under the names it chooses. */
export type ExportSource = (userId: string) => Promise<Record<string, readonly unknown[]>>;

export type ExportDeps = {
  readonly ensureProfile: (userId: string, locale: Locale) => Promise<Profile>;
  /** One per module that stores something of the archer; the account never reads their collections. */
  readonly sources: readonly ExportSource[];
  readonly clock: Clock;
};

/**
 * `GET /me/export` (HU-ACC-05): everything stored about the archer, in canonical units, at this
 * moment: the profile and what every module hands over, archived and trashed included.
 */
export function createExportData(deps: ExportDeps) {
  return async function exportData(userId: string, fallbackLocale: Locale): Promise<AccountExport> {
    const profile = await deps.ensureProfile(userId, fallbackLocale);
    const parts = await Promise.all(deps.sources.map((source) => source(userId)));
    const data = Object.assign({}, ...parts) as Record<string, readonly unknown[]>;
    return {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: deps.clock.now().toString(),
      profile: {
        locale: profile.locale,
        unitSystem: profile.unitSystem,
        theme: profile.theme,
        quickAccess: profile.quickAccess,
        deletionRequestedAt:
          profile.deletionRequestedAt === null ? null : profile.deletionRequestedAt.toString(),
      },
      bows: (data['bows'] ?? []) as AccountExport['bows'],
      sights: (data['sights'] ?? []) as AccountExport['sights'],
      arrowSets: (data['arrowSets'] ?? []) as AccountExport['arrowSets'],
      setups: (data['setups'] ?? []) as AccountExport['setups'],
      marks: (data['marks'] ?? []) as AccountExport['marks'],
    };
  };
}
