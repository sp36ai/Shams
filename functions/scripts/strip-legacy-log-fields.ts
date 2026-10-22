/**
 * strip-legacy-log-fields.ts — CLI for src/maintenance/stripLegacyLogFields.ts.
 *
 * Prints one JSON line of counts — never a field value — and exits non-zero
 * on any failure.
 *
 *   # 1. preview: counts only, changes nothing
 *   npx vite-node scripts/strip-legacy-log-fields.ts --project <id> [--once]
 *
 *   # 2. apply: refuses unless the data still matches the preview's counts
 *   npx vite-node scripts/strip-legacy-log-fields.ts --project <id> --apply --once \
 *     --expect '<the "counts" object printed by the preview>'
 *
 *   # 3. verify: fails if any targeted field remains
 *   npx vite-node scripts/strip-legacy-log-fields.ts --project <id> --verify
 *
 * With --once, a preview reports `recorded: true` and skips the scan once
 * the migration has completed. Credentials come from the environment
 * (Application Default Credentials, or FIRESTORE_EMULATOR_HOST for the
 * emulator). The project is required and never defaulted. Run by
 * .github/workflows/deploy-functions.yml after a healthy deploy.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  FIELDS,
  countsOf,
  isMigrationRecorded,
  scanLegacyFields,
  stripLegacyFields,
  type LegacyCounts,
} from '../src/maintenance/stripLegacyLogFields';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Parse --expect strictly: exactly the counts a preview prints. */
function parseExpected(raw: string | undefined): LegacyCounts {
  if (raw === undefined || raw.startsWith('--')) {
    throw new Error('--apply needs --expect <counts from the preview>');
  }
  const v: unknown = JSON.parse(raw);
  const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;
  const o = v as Record<string, Record<string, unknown> | unknown>;
  const keysAre = (x: unknown, keys: readonly string[]): x is Record<string, unknown> =>
    typeof x === 'object' &&
    x !== null &&
    Object.keys(x).sort().join() === [...keys].sort().join() &&
    keys.every(k => isCount((x as Record<string, unknown>)[k]));
  if (
    typeof v !== 'object' ||
    v === null ||
    Object.keys(v).sort().join() !== 'collections,documents,fields' ||
    !isCount(o.documents) ||
    !keysAre(o.collections, COLLECTIONS) ||
    !keysAre(o.fields, FIELDS)
  ) {
    throw new Error('--expect is not a counts object printed by the preview');
  }
  return v as LegacyCounts;
}

async function main(): Promise<void> {
  const projectId = arg('--project');
  if (projectId === undefined || projectId.startsWith('--')) {
    throw new Error('--project <id> is required');
  }
  const apply = process.argv.includes('--apply');
  const verify = process.argv.includes('--verify');
  const once = process.argv.includes('--once');
  if (apply && verify) {
    throw new Error('--apply and --verify are separate steps');
  }

  initializeApp({ projectId });
  const db = getFirestore();

  if (apply) {
    const result = await stripLegacyFields(db, { expected: parseExpected(arg('--expect')), once });
    console.log(JSON.stringify({ projectId, mode: 'apply', once, ...result }));
    return;
  }

  if (!verify && once && (await isMigrationRecorded(db))) {
    console.log(JSON.stringify({ projectId, mode: 'preview', recorded: true }));
    return;
  }

  const scan = await scanLegacyFields(db);
  console.log(
    JSON.stringify({
      projectId,
      mode: verify ? 'verify' : 'preview',
      ...(verify ? {} : { recorded: false }),
      scanned: scan.scanned,
      counts: countsOf(scan),
    }),
  );
  if (verify && scan.documents !== 0) {
    throw new Error(`${scan.documents} documents still hold legacy fields`);
  }
}

main().catch((err: unknown) => {
  console.error(`strip-legacy-log-fields failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
