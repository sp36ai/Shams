/**
 * Jest configuration for Firestore Rules unit tests.
 * Separate config to avoid jest.setup.js mocks interfering with firestore-unit-testing.
 */

module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/firestore.rules.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native)',
  ],
};
