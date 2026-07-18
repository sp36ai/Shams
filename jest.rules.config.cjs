/**
 * Dedicated Jest config for Firestore security-rules tests.
 *
 * These tests run in a NODE environment against the Firestore emulator, so they
 * must NOT use the react-native preset (whose transformIgnorePatterns leave the
 * Firebase ESM packages untransformed → "Cannot use import statement outside a
 * module"). Run via:
 *
 *   npm run test:rules      # boots the emulator and runs this config
 *
 * The emulator is provided by `firebase emulators:exec` (see package.json).
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/firestore.rules.test.ts'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript',
        ],
      },
    ],
  },
  // Firebase SDK ships ESM that must be transformed; do not ignore it.
  transformIgnorePatterns: ['/node_modules/(?!(@firebase|firebase|@babel/runtime)/)'],
};
