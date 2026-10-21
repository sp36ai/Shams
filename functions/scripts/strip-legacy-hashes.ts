/**
 * strip-legacy-hashes.ts — CLI for src/maintenance/stripLegacyHashes.ts.
 *
 * Dry run by default: reports counts, changes nothing. Prints counts only —
 * never a field value.
 *
 *   npx vite-node scripts/strip-legacy-hashes.ts --project <id>                 # dry run
 *   npx vite-node scripts/strip-legacy-hashes.ts --project <id> --apply --once  # remove
 *
 * Credentials come from the environment (Application Default Credentials,
 * or FIRESTORE_EMULATOR_HOST for the emulator). The project is required and
 * never defaulted, so the target is always stated explicitly. Run by
 * .github/workflows/deploy-functions.yml after a healthy deploy.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { stripLegacyHashes } from '../src/maintenance/stripLegacyHashes';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const projectId = arg('--project');
  if (projectId === undefined || projectId.startsWith('--')) {
    throw new Error('--project <id> is required');
  }
  const apply = process.argv.includes('--apply');
  const once = process.argv.includes('--once');

  initializeApp({ projectId });
  const result = await stripLegacyHashes(getFirestore(), { apply, once });
  console.log(
    JSON.stringify({ projectId, mode: apply ? 'apply' : 'dry-run', once, ...result }),
  );
}

main().catch((err: unknown) => {
  console.error(`strip-legacy-hashes failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
