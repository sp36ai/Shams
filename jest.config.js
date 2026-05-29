module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/functions/',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|react-native-mmkv|react-native-reanimated|react-native-svg)',
  ],
  moduleNameMapper: {
    'react-native-mmkv': '<rootDir>/__mocks__/react-native-mmkv.js',
    'swisseph-wasm': '<rootDir>/__mocks__/swisseph-wasm.js',
  },
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node',
  ],
  projects: [
    {
      displayName: 'app',
      testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
      setupFiles: ['<rootDir>/jest.setup.js'],
    },
    {
      displayName: 'firestore',
      testMatch: ['<rootDir>/firestore.rules.test.ts'],
      testEnvironment: 'node',
      setupFiles: [],
    },
  ],
};
