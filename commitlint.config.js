// Scopes: docs/TECNICO.md §3.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [2, 'never'],
    'scope-enum': [
      2,
      'always',
      [
        'repo',
        'docs',
        'domain',
        'schemas',
        'types',
        'i18n',
        'ui',
        'client',
        'api',
        'pwa',
        'account',
        'equipment',
        'calculator',
        'ci',
        'infra',
        'e2e',
      ],
    ],
  },
};
