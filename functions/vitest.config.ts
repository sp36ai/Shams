import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/engine/**/*.ts'],
      exclude: ['src/engine/__tests__/**'],
      lines: 95,
      functions: 95,
      branches: 95,
      statements: 95,
    },
  },
  resolve: {
    alias: {
      '@engine': resolve(__dirname, './src/engine'),
      '@types': resolve(__dirname, './src/types'),
    },
  },
});
