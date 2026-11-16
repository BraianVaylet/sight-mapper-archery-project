import js from '@eslint/js';
import i18next from 'eslint-plugin-i18next';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Workspace dependency graph (docs/ARQUITECTURA.md §3.1). Anything not listed is forbidden.
const allowedWorkspaceImports = {
  domain: [],
  types: [],
  schemas: ['types'],
  i18n: ['types'],
  ui: ['domain', 'types'],
  client: ['schemas', 'types'],
  api: ['domain', 'schemas', 'types', 'i18n'],
  pwa: ['domain', 'schemas', 'types', 'i18n', 'ui', 'client'],
};
const workspaceNames = [...Object.keys(allowedWorkspaceImports), 'config'];

const workspaceDirs = (name) =>
  ['api', 'pwa'].includes(name) ? `apps/${name}` : `packages/${name}`;

const workspaceBoundaries = Object.entries(allowedWorkspaceImports).map(([name, allowed]) => {
  const forbidden = workspaceNames.filter((other) => other !== name && !allowed.includes(other));
  return {
    files: [`${workspaceDirs(name)}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: `^@sight-mapper/(${forbidden.join('|')})(/|$)`,
              message: `@sight-mapper/${name} must not depend on this workspace (ARQUITECTURA §3.1).`,
            },
          ],
        },
      ],
    },
  };
});

// API modules never import each other: they talk through ports and events (ADR-002).
const apiModules = ['account', 'equipment', 'calculator'];
const moduleBoundaries = apiModules.map((name) => {
  const others = apiModules.filter((other) => other !== name);
  return {
    files: [`apps/api/src/modules/${name}/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: `(^|/)(${others.join('|')})(/|$)`,
              message: `Module "${name}" must not import another module; use a port or an event (ADR-002).`,
            },
          ],
        },
      ],
    },
  };
});

const dateMessage =
  'Time is injected (now: () => Temporal.Instant). Only the persistence translator may build a Date.';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.turbo/**'] },

  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.es2023 } },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: dateMessage,
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: dateMessage,
        },
      ],
    },
  },

  // Persistence translator is the single place allowed to touch Date.
  {
    files: ['apps/api/src/core/db/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  ...workspaceBoundaries,
  ...moduleBoundaries,

  // Module domain layer: pure, no framework, no core (ARQUITECTURA §4.1).
  {
    files: ['apps/api/src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(mongoose|hono|@hono/.*|better-auth|better-auth/.*)$',
              message: 'Module domain must not import frameworks.',
            },
            {
              regex: '(^|/)core(/|$)',
              message: 'Module domain must not import core/.',
            },
          ],
        },
      ],
    },
  },

  // @sight-mapper/domain is pure: no I/O, framework, clock or randomness (ADR-001).
  {
    files: ['packages/domain/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.{1,2}/)',
              message: '@sight-mapper/domain has no dependencies: only relative imports.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'fetch',
          'process',
          'window',
          'document',
          'localStorage',
          'setTimeout',
          'setInterval',
        ].map((name) => ({ name, message: '@sight-mapper/domain must not perform I/O.' })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'domain is pure: no Date; use Temporal values passed in.',
        },
        {
          selector: "CallExpression[callee.object.name='Date']",
          message: 'domain is pure: no Date; use Temporal values passed in.',
        },
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: 'domain is pure: no randomness.',
        },
        {
          selector: "MemberExpression[object.name='Temporal'][property.name='Now']",
          message: 'domain is pure: no clock; receive instants as arguments.',
        },
      ],
    },
  },

  // The one place of the PWA that reads the device clock and zone.
  {
    files: ['apps/pwa/src/app/device-time.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // User-facing strings live in catalogs (CLAUDE.md, regla 10).
  {
    files: ['apps/pwa/**/*.tsx', 'packages/ui/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
    },
  },

  // Repo tooling (scripts, hooks) is not app code: it may read the clock (the ADR date).
  {
    files: ['scripts/**', '.claude/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // Tooling files run in Node.
  {
    files: [
      '*.config.{js,ts}',
      '**/*.config.{js,ts}',
      '**/scripts/**/*.mjs',
      '.claude/**/*.mjs',
      '**/migrate-mongo-config.js',
      '**/migrations/**/*.js',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
);
