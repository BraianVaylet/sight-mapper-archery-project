// Used by `pnpm migrate` (run as a release step before the API starts, TECNICO §12).
export default {
  mongodb: {
    url: process.env.MONGODB_URI ?? '',
    options: {},
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  migrationFileExtension: '.js',
  moduleSystem: 'esm',
};
