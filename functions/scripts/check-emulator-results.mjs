/**
 * check-emulator-results.mjs — proves the emulator suites actually ran.
 *
 * A green vitest run can hide suites that were skipped or never collected.
 * This reads vitest's JSON report and fails unless every suite below ran at
 * least its expected number of tests, every test passed, and nothing was
 * skipped. Removing or skipping one of these tests therefore fails CI; when
 * a test is added deliberately, raise its minimum here in the same change.
 *
 *   node scripts/check-emulator-results.mjs emulator-results.json
 *
 * Run by `npm run test:emulator:suites` (and so by test:emulator:ci in the
 * Functions Quality job of .github/workflows/ci.yml).
 */
import { readFileSync } from 'fs';

const REQUIRED = {
  // deleteAccount and the deletion race on real Firestore semantics
  'src/functions/__tests__/account.emulator.test.ts': 4,
  // the legacy log-field migration on synthetic records, and its CLI
  'src/maintenance/__tests__/stripLegacyLogFields.test.ts': 14,
};

const file = process.argv[2];
if (!file) {
  console.error('usage: check-emulator-results.mjs <vitest json report>');
  process.exit(2);
}

const report = JSON.parse(readFileSync(file, 'utf8'));
const problems = [];

for (const [suffix, minimum] of Object.entries(REQUIRED)) {
  const suite = (report.testResults ?? []).find(r => r.name.replaceAll('\\', '/').endsWith(suffix));
  if (!suite) {
    problems.push(`${suffix}: not in the report — the suite was not collected`);
    continue;
  }
  const tests = suite.assertionResults ?? [];
  const passed = tests.filter(t => t.status === 'passed');
  const notPassed = tests.filter(t => t.status !== 'passed');
  console.log(`${suffix}: ${passed.length}/${tests.length} passed (minimum ${minimum})`);
  for (const t of tests) {
    console.log(
      `  ${t.status === 'passed' ? 'PASS' : t.status.toUpperCase()}  ${t.fullName ?? t.title}`,
    );
  }
  if (tests.length < minimum) {
    problems.push(`${suffix}: ${tests.length} tests ran, expected at least ${minimum}`);
  }
  for (const t of notPassed) {
    problems.push(`${suffix}: "${t.fullName ?? t.title}" ${t.status}`);
  }
}

if (problems.length > 0) {
  console.error(`\nEmulator suites did not fully run:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('\nEmulator suites: every required test ran and passed; none skipped.');
