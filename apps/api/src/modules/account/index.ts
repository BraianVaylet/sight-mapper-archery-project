export { createEnsureProfile } from './application/ensure-profile.js';
export { createClearQuickAccessOfSetup, createSetQuickAccess } from './application/quick-access.js';
export { createCancelDeletion, createRequestDeletion } from './application/deletion.js';
export { createExportData, type ExportSource } from './application/export-data.js';
export { createUpdatePreferences } from './application/update-preferences.js';
export type {
  Preferences,
  PreferencesPatch,
  Profile,
  ProfileRepositories,
  QuickAccess,
  SetupLookupPort,
} from './domain/profile.js';
export { createProfileRepositories } from './infrastructure/profile-repository.js';
export {
  createPurgeDeletedAccounts,
  createPurgeProfile,
} from './infrastructure/purge-deleted-accounts.js';
export { registerAccountRoutes } from './infrastructure/routes.js';
