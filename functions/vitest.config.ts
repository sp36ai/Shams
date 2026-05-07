import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/engine/**/*.ts'],
      exclude: ['src/engine/__tests__/**'],
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
  },
  resolve: {
    alias: {
      '@engine': resolve(__dirname, './src/engine'),
      '@types': resolve(__dirname, './src/types'),
    },
  },
});
