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
    // Generated mirror of src/astrology (produced by sync-engine). It is still
    // type-checked by `tsc --noEmit` above, and linted authoritatively at its
    // source in the app's own lint job — re-linting the copy under functions'
    // stricter type-aware rules only flags source-style choices in generated code.
    'src/engine/',
  ],
};
