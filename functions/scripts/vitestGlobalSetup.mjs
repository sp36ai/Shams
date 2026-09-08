/**
 * vitestGlobalSetup.mjs — PHASE 5B-R
 * ---------------------------------------------------------------------------
 * Runs once, before any test file, for every vitest invocation in this
 * package — `npm test`, `npx vitest`, `npx vitest run`, a single-file run,
 * an IDE's own vitest integration, this project's own CI job. There is no
 * npm-script hook (`pretest` etc.) that a direct `npx vitest` call would
 * skip; this is the one place a check is guaranteed to run no matter how
 * vitest was invoked.
 *
 * Why this exists: functions/src/engine/ is a generated mirror of
 * src/astrology/ (see scripts/sync-engine.mjs's own header). Before this
 * phase, nothing stopped that mirror from silently drifting from its
 * source between commits — and it had (docs/audit/PHASE_5B_REPORT.md
 * finding P5B-1; full remediation record in
 * docs/audit/PHASE_5B_REMEDIATION.md). A test suite run against a stale
 * mirror is not testing the code that ever reaches production (every real
 * deploy re-syncs first — see firebase.json's `predeploy` hook and
 * .github/workflows/deploy-functions.yml) — it is testing a fossil, and a
 * green result from it is misleading. Rather than silently re-syncing
 * (which would fix the tests but hide the fact that a stale commit
 * happened), this fails LOUD and immediately, before a single test runs,
 * so drift is impossible to miss.
 *
 * Auto-heal still exists — `npm run build` (sync-engine + tsc) is what
 * every real build/deploy runs, and a developer hitting this failure fixes
 * it with the one command the error message names.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYNC_SCRIPT = path.resolve(__dirname, 'sync-engine.mjs');

export default function setup() {
  try {
    execFileSync(process.execPath, [SYNC_SCRIPT, '--check'], { stdio: 'inherit' });
  } catch {
    // sync-engine.mjs --check already printed the full drift report to
    // stderr (via console.error) before exiting 1 — execFileSync's own
    // thrown error carries nothing more useful than that exit code, so
    // this rethrows a short, test-runner-shaped message instead of a raw
    // ENOENT-style stack trace.
    throw new Error(
      '[vitest globalSetup] functions/src/engine/ is out of sync with src/astrology/ ' +
        '(see the [sync-engine] report above). Run `npm run sync-engine` in functions/ ' +
        'and commit the result before running tests.',
    );
  }
}
