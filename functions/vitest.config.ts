import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // PHASE 5B-R: fails the whole run, loudly, before any test file starts,
    // if functions/src/engine/ (a generated mirror of src/astrology/) has
    // drifted from its source — see scripts/vitestGlobalSetup.mjs's own
    // header and docs/audit/PHASE_5B_REMEDIATION.md.
    globalSetup: ['./scripts/vitestGlobalSetup.mjs'],
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/engine/**/*.ts'],
      exclude: ['src/engine/__tests__/**'],
      // Thresholds must live under `thresholds` for Vitest 1.x -- the
      // previous flat lines/functions/branches/statements keys directly
      // under `coverage` are not a key this version recognizes, so they
      // were silently never checked at all (confirmed: `vitest --coverage`
      // exited 0 even against a file at 0% coverage). Never wired into CI
      // either (CI ran plain `vitest --run`, not `--coverage`), so this
      // gate has never once actually run.
      //
      // Set as a ratchet at today's real baseline (measured via
      // `npm run test:coverage`, ~1-2 points of margin below the actual
      // numbers to absorb minor non-determinism), not the originally
      // declared 95% -- real coverage is currently ~87% statements/lines,
      // ~86% branches, ~74% functions, with manazil.ts at 0%. Enforcing
      // 95% today would fail every CI run until manazil.ts and a few other
      // low-coverage files get real tests written. This blocks any future
      // regression below today's level; raise it as coverage improves.
      thresholds: {
        lines: 85,
        functions: 70,
        branches: 84,
        statements: 85,
      },
    },
  },
  resolve: {
    alias: {
      '@engine': resolve(__dirname, './src/engine'),
      '@types': resolve(__dirname, './src/types'),
    },
  },
});
