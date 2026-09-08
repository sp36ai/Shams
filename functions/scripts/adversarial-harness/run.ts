/**
 * run.ts — PHASE 5C adversarial-harness runner.
 * --------------------------------------------------------------------------
 * Offline, deterministic, no network/API calls. Generates the full
 * combinatorial adversarial case set (generators.ts) against the real
 * contract pool (contracts.ts), executes every case through the real,
 * unmodified validateNarration(), and reports full metrics — not just a
 * pass/fail count.
 *
 * Run with:  npx vite-node scripts/adversarial-harness/run.ts   (from functions/)
 *
 * CRITICAL METRIC: false negatives (a materially contradictory narration
 * the validator accepted as VALID) must be zero for PHASE 5C to PASS.
 *
 * This script also verifies, for a sample of executed cases, that the
 * contract object passed in is unchanged afterward (Object.isFrozen at
 * every level already guarantees this structurally — Phase 5B already
 * proved that; this is a redundant, cheap runtime confirmation specific to
 * this harness's own inputs, not a re-litigation of that proof) and
 * captures any thrown exception as its own reportable class of finding.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildContractPool } from './contracts';
import { generateAll } from './generators';
import { validateNarration } from '../../src/oracle/narrationValidator';
import type { GeneratedCase } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../../../docs/audit/phase-5c');

interface CaseResult {
  readonly id: string;
  readonly category: string;
  readonly contractId: string;
  readonly expected: 'VALID' | 'INVALID';
  readonly actualValid: boolean | null; // null if it threw
  readonly threw: string | null;
  readonly failureCodes: readonly string[];
  readonly outcome:
    | 'CAUGHT' // expected INVALID, actually invalid — correct
    | 'ACCEPTED' // expected VALID, actually valid — correct
    | 'FALSE_NEGATIVE' // expected INVALID, actually valid — BYPASS
    | 'FALSE_POSITIVE' // expected VALID, actually invalid — over-rejection
    | 'EXCEPTION'; // validator threw
  readonly mutationMeta: Readonly<Record<string, unknown>>;
}

function classify(gc: GeneratedCase, valid: boolean | null, threw: string | null): CaseResult['outcome'] {
  if (threw !== null) {
    return 'EXCEPTION';
  }
  if (gc.expected === 'INVALID') {
    return valid ? 'FALSE_NEGATIVE' : 'CAUGHT';
  }
  return valid ? 'ACCEPTED' : 'FALSE_POSITIVE';
}

function main(): void {
  const pool = buildContractPool();
  const byId = new Map(pool.map(p => [p.id, p]));
  const cases = generateAll(pool);

  const results: CaseResult[] = [];
  let exceptions = 0;
  let contractMutations = 0;

  for (const gc of cases) {
    const profile = byId.get(gc.contractId);
    if (!profile) {
      throw new Error(`generated case references unknown contract id: ${gc.contractId}`);
    }
    const contractFingerprintBefore = JSON.stringify(profile.contract);

    let valid: boolean | null = null;
    let threw: string | null = null;
    let codes: string[] = [];
    try {
      const result = validateNarration(profile.contract, gc.narration);
      valid = result.valid;
      codes = result.valid ? [] : result.failures.map(f => f.code);
    } catch (err) {
      threw = String(err);
    }

    const contractFingerprintAfter = JSON.stringify(profile.contract);
    if (contractFingerprintBefore !== contractFingerprintAfter) {
      contractMutations += 1;
    }

    if (threw !== null) {
      exceptions += 1;
    }

    results.push({
      id: gc.id,
      category: gc.category,
      contractId: gc.contractId,
      expected: gc.expected,
      actualValid: valid,
      threw,
      failureCodes: codes,
      outcome: classify(gc, valid, threw),
      mutationMeta: gc.mutationMeta,
    });
  }

  const generated = cases.length;
  const executed = results.length;
  const expectedInvalid = results.filter(r => r.expected === 'INVALID').length;
  const expectedValid = results.filter(r => r.expected === 'VALID').length;
  const caught = results.filter(r => r.outcome === 'CAUGHT').length;
  const accepted = results.filter(r => r.outcome === 'ACCEPTED').length;
  const falseNegatives = results.filter(r => r.outcome === 'FALSE_NEGATIVE');
  const falsePositives = results.filter(r => r.outcome === 'FALSE_POSITIVE');
  const exceptionResults = results.filter(r => r.outcome === 'EXCEPTION');

  const byCategory = new Map<string, { total: number; falseNeg: number; falsePos: number; exceptions: number }>();
  for (const r of results) {
    const entry = byCategory.get(r.category) ?? { total: 0, falseNeg: 0, falsePos: 0, exceptions: 0 };
    entry.total += 1;
    if (r.outcome === 'FALSE_NEGATIVE') entry.falseNeg += 1;
    if (r.outcome === 'FALSE_POSITIVE') entry.falsePos += 1;
    if (r.outcome === 'EXCEPTION') entry.exceptions += 1;
    byCategory.set(r.category, entry);
  }

  // Unique bypass classes: group false negatives by (category, subtype).
  const bypassClasses = new Map<string, CaseResult[]>();
  for (const r of falseNegatives) {
    const subtype = (r.mutationMeta as { subtype?: string }).subtype ?? 'unknown';
    const key = `${r.category}::${subtype}`;
    const arr = bypassClasses.get(key) ?? [];
    arr.push(r);
    bypassClasses.set(key, arr);
  }

  const summary = {
    generated,
    executed,
    expectedInvalid,
    expectedValid,
    caught,
    accepted,
    falseNegativeCount: falseNegatives.length,
    falsePositiveCount: falsePositives.length,
    exceptionCount: exceptionResults.length,
    contractMutations,
    uniqueBypassClassCount: bypassClasses.size,
    byCategory: Object.fromEntries(byCategory),
  };

  console.log(JSON.stringify(summary, null, 2));

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  writeFileSync(
    resolve(OUT_DIR, 'false-negatives.json'),
    JSON.stringify(falseNegatives, null, 2),
  );
  writeFileSync(
    resolve(OUT_DIR, 'false-positives-sample.json'),
    JSON.stringify(falsePositives.slice(0, 200), null, 2),
  );
  writeFileSync(
    resolve(OUT_DIR, 'exceptions.json'),
    JSON.stringify(exceptionResults, null, 2),
  );
  writeFileSync(
    resolve(OUT_DIR, 'bypass-classes.json'),
    JSON.stringify(
      Array.from(bypassClasses.entries()).map(([key, arr]) => ({
        key,
        count: arr.length,
        sample: arr.slice(0, 3),
      })),
      null,
      2,
    ),
  );

  if (falseNegatives.length > 0 || exceptionResults.length > 0 || contractMutations > 0) {
    process.exitCode = 1;
  }
}

main();
