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
  ignorePatterns: ['node_modules/', 'build/', 'dist/', 'lib/', '*.config.js'],
};
