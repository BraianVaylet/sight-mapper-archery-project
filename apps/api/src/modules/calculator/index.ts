export { createCheckComponents } from './application/check-components.js';
export { createComponentUsage } from './application/component-usage.js';
export { createCreateSetup } from './application/create-setup.js';
export { createSetupUseCases } from './application/setup-use-cases.js';
export { createSetupViews } from './application/setup-views.js';
export { createUpdateSetup } from './application/update-setup.js';
export type {
  EquipmentReadPort,
  Setup,
  SetupMarksPort,
  SetupRepositories,
} from './domain/setup.js';
export { createSetupRepositories } from './infrastructure/setup-repository.js';
export { registerSetupRoutes } from './infrastructure/setup-routes.js';
export { purgeDeletedSetups } from './infrastructure/purge-deleted-setups.js';
