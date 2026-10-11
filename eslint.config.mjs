// Import boundaries and purity rules from docs/05-tech-stack.md section 4.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const restrict = (paths, patterns = []) => ['error', { paths, patterns }];

const ENGINE = {
  group: ['@dbay/engine', '@dbay/engine/*'],
  message: 'Only room-core may use the engine.',
};
const ROOM_CORE = {
  group: ['@dbay/room-core', '@dbay/room-core/*'],
  message: 'Only apps/server may use room-core.',
};
const SERVER_APP = { group: ['**/apps/server/**'], message: 'apps/server is not importable.' };
const WEB_APP = { group: ['**/apps/web/**'], message: 'apps/web is not importable.' };
const CONTENT_FULL = {
  name: '@dbay/content',
  message: 'The full content entry holds hidden actual values. Use @dbay/content/public.',
};

// Pure packages must never read the clock or Math.random; time and seeds are passed in.
const purity = {
  'no-restricted-properties': [
    'error',
    {
      object: 'Date',
      property: 'now',
      message: 'Pass `now` in; only apps/server reads the clock.',
    },
    { object: 'Math', property: 'random', message: 'Use the seeded RNG streams (01 R6).' },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: "NewExpression[callee.name='Date']",
      message: 'Pass `now` in; only apps/server reads the clock.',
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.wrangler/**',
      '**/next-env.d.ts',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['packages/protocol/**'],
    rules: {
      'no-restricted-imports': restrict(
        [],
        [{ group: ['@dbay/*'], message: 'protocol imports zod only.' }],
      ),
    },
  },
  {
    files: ['packages/content/**'],
    rules: {
      'no-restricted-imports': restrict([], [ENGINE, ROOM_CORE, SERVER_APP, WEB_APP]),
      ...purity,
    },
  },
  {
    files: ['packages/engine/**'],
    rules: { 'no-restricted-imports': restrict([], [ROOM_CORE, SERVER_APP, WEB_APP]), ...purity },
  },
  {
    files: ['packages/room-core/**'],
    rules: {
      'no-restricted-imports': restrict(
        [{ name: 'partyserver', message: 'room-core is platform-free.' }],
        [
          {
            group: ['@dbay/content', '@dbay/content/*'],
            message: 'room-core reaches content only via the engine.',
          },
          { group: ['cloudflare:*'], message: 'room-core is platform-free.' },
          SERVER_APP,
          WEB_APP,
        ],
      ),
      ...purity,
    },
  },
  {
    files: ['apps/server/**'],
    rules: { 'no-restricted-imports': restrict([], [ENGINE, WEB_APP]) },
  },
  {
    files: ['apps/web/**'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-restricted-imports': restrict(
        [CONTENT_FULL, { name: 'partyserver', message: 'Server-only library.' }],
        [
          ENGINE,
          ROOM_CORE,
          SERVER_APP,
          { group: ['@dbay/content/src/*'], message: 'Use @dbay/content/public.' },
          {
            group: ['**/packages/engine/**', '**/packages/room-core/**', '**/packages/content/**'],
            message: 'Import workspace packages by name; relative paths bypass the boundaries.',
          },
        ],
      ),
    },
  },
);
