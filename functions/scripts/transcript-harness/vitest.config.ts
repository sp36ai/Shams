// Separate from functions/vitest.config.ts on purpose: the harness is an
// offline evaluation tool, not part of the deployed functions' test gate.
// Run from functions/:  npx vitest run --config scripts/transcript-harness/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/transcript-harness/**/*.test.ts'],
  },
});
