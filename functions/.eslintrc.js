module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-void': 'off',
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': 'error',
    curly: ['error', 'all'],
    eqeqeq: ['error', 'always'],
  },
  env: {
    node: true,
    es2021: true,
  },
  ignorePatterns: [
    'node_modules/',
    'build/',
    'dist/',
    'lib/',
    '*.config.js',
    'vitest.config.ts',
    // Generated mirror of ../src/astrology (see scripts/sync-engine.mjs) —
    // already excluded from tsconfig.json's project. It happened to lint
    // clean before only because some of its files were incidentally pulled
    // into the TS program's import graph via a since-deleted callable
    // (askOracle.ts); anything genuinely unreachable from an in-project
    // root has always failed typed-linting here with a "file not included
    // in the TSConfig" parsing error. Ignoring the whole directory (like
    // tsconfig already does) is correct regardless of which files happen
    // to be transitively reachable at any given moment.
    'src/engine/',
  ],
};
