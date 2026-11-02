export { createEnsureProfile } from './application/ensure-profile.js';
export { createUpdatePreferences } from './application/update-preferences.js';
export type {
  Preferences,
  PreferencesPatch,
  Profile,
  ProfileRepositories,
} from './domain/profile.js';
export { createProfileRepositories } from './infrastructure/profile-repository.js';
export { registerAccountRoutes } from './infrastructure/routes.js';
