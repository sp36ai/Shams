/**
 * stripLegacyLogFields — the field rules (always), and the real migration on
 * the Firestore emulator against synthetic records (when pointed at one,
 * demo- project only).
 *
 *   cd functions && npm run test:emulator:ci   (starts and stops the emulators itself)
 *
 * Every assertion about what changed compares each document with its seeded
 * original, so "removes only the targeted fields" is checked field by field,
 * not inferred from counts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { spawnSync } from 'child_process';
import { join } from 'path';
import {
  isLegacyCode,
  isTarget,
  MIGRATION_ID,
  PAGE,
  type LegacyCounts,
} from '../stripLegacyLogFields';
import { emulatorTarget } from '../../__tests__/emulatorGuard';

describe('field rules', () => {
  it('treats the old unkeyed code formats as legacy', () => {
    expect(isLegacyCode('a1b2c3d4')).toBe(true); // FNV-1a, 8 hex
    expect(isLegacyCode('0123456789abcdef')).toBe(true); // SHA-256 prefix, 16 hex
  });

  it('leaves keyed codes, empties and non-strings alone', () => {
    expect(isLegacyCode('h1:0123456789abcdef0123456789abcdef')).toBe(false);
    expect(isLegacyCode('')).toBe(false);
    expect(isLegacyCode(undefined)).toBe(false);
    expect(isLegacyCode(42)).toBe(false);
  });

  it('targets a raw IP whenever the field exists, whatever its value', () => {
    expect(isTarget('ipAddress', { ipAddress: '203.0.113.7' })).toBe(true);
    expect(isTarget('ipAddress', { ipAddress: null })).toBe(true);
    expect(isTarget('ipAddress', { ipAddress: '' })).toBe(true);
    expect(isTarget('ipAddress', { userId: 'u' })).toBe(false);
    expect(isTarget('ipAddress', { meta: { ipAddress: '203.0.113.7' } })).toBe(false);
  });

  it('targets only legacy-format codes', () => {
    expect(isTarget('ipHash', { ipHash: '0123456789abcdef' })).toBe(true);
    expect(isTarget('ipHash', { ipHash: 'h1:0123456789abcdef0123456789abcdef' })).toBe(false);
    expect(isTarget('questionHash', { questionHash: 'a1b2c3d4' })).toBe(true);
    expect(isTarget('questionHash', {})).toBe(false);
  });

  it('pages stay inside Firestore’s 500-write batch limit', () => {
    expect(PAGE).toBeLessThanOrEqual(500);
  });
});

// Throws unless the project is demo-shams and the host is local; with
// REQUIRE_EMULATOR=1 a missing emulator throws instead of skipping.
const TARGET = emulatorTarget(['firestore']);
const PROJECT = TARGET.project;
const FS_HOST = TARGET.hosts.firestore;
const ON_EMULATOR = TARGET.on;

type Doc = Record<string, unknown>;

const KEYED = 'h1:0123456789abcdef0123456789abcdef';
const FNV = 'a1b2c3d4';
const SHA = '0123456789abcdef';
/** RFC 5737 documentation addresses: synthetic, never a real person's. */
const ip = (i: number): string => `203.0.113.${i % 250}`;

/**
 * Seven record shapes, cycled: each target field alone, all three together,
 * keyed codes only, no target fields, and a null raw-IP field. Every record
 * also carries fields that must survive, including a nested `ipAddress`,
 * which is not a top-level legacy field.
 */
function auditRecord(i: number): Doc {
  const base: Doc = {
    userId: `u${i}`,
    action: 'oracle_computed',
    resultHash: 'deadbeef',
    userAgent: 'okhttp/4.12',
    meta: { ipAddress: 'nested-not-a-target', n: i },
  };
  switch (i % 7) {
    case 0:
      return { ...base, ipAddress: ip(i) };
    case 1:
      return { ...base, ipHash: SHA };
    case 2:
      return { ...base, questionHash: FNV };
    case 3:
      return { ...base, ipAddress: ip(i), ipHash: SHA, questionHash: FNV };
    case 4:
      return { ...base, ipHash: KEYED, questionHash: KEYED };
    case 5:
      return base;
    default:
      return { ...base, ipAddress: null, questionHash: KEYED };
  }
}

const AUDIT = 1050; // three pages of PAGE (400)
const SECURITY: Record<string, Doc> = {
  s1: { type: 'x', userId: 'u1', ipHash: SHA },
  s2: { type: 'x', userId: 'u2', ipHash: KEYED },
  s3: { type: 'x', userId: 'u3', ipAddress: ip(3), ipHash: KEYED },
  s4: { type: 'x', userId: 'u4' },
};
/** Out of scope: must come through byte-for-byte unchanged. */
const OTHER: Record<string, Doc> = {
  'readings/r1': { userId: 'u1', ipAddress: ip(9), questionHash: FNV },
  '_system/other': { ipHash: SHA },
};

const TARGETS = ['ipAddress', 'ipHash', 'questionHash'] as const;

/** What a record must look like after the migration. */
function stripped(d: Doc): Doc {
  const out = { ...d };
  if ('ipAddress' in out) {
    delete out.ipAddress;
  }
  for (const f of ['ipHash', 'questionHash'] as const) {
    if (typeof out[f] === 'string' && !out[f].startsWith('h1:')) {
      delete out[f];
    }
  }
  return out;
}

function expectedCounts(): LegacyCounts {
  const fields = { ipAddress: 0, ipHash: 0, questionHash: 0 };
  const collections = { auditLogs: 0, securityEvents: 0 };
  const tally = (coll: keyof typeof collections, d: Doc) => {
    const s = stripped(d);
    const hit = TARGETS.filter(f => f in d && !(f in s));
    hit.forEach(f => (fields[f] += 1));
    if (hit.length > 0) {
      collections[coll] += 1;
    }
  };
  for (let i = 0; i < AUDIT; i++) {
    tally('auditLogs', auditRecord(i));
  }
  Object.values(SECURITY).forEach(d => tally('securityEvents', d));
  return { documents: collections.auditLogs + collections.securityEvents, collections, fields };
}

const auditId = (i: number): string => `a${String(i).padStart(4, '0')}`;

describe.skipIf(!ON_EMULATOR)('EMULATOR — stripLegacyLogFields on synthetic records', () => {
  async function deps() {
    const { db } = await import('../../utils/admin');
    const m = await import('../stripLegacyLogFields');
    return { db, ...m };
  }

  async function snapshot(): Promise<Record<string, Doc>> {
    const { db } = await deps();
    const out: Record<string, Doc> = {};
    for (const coll of ['auditLogs', 'securityEvents', 'readings', '_system']) {
      for (const d of (await db.collection(coll).get()).docs) {
        out[`${coll}/${d.id}`] = d.data();
      }
    }
    return out;
  }

  function seeded(): Record<string, Doc> {
    const out: Record<string, Doc> = {};
    for (let i = 0; i < AUDIT; i++) {
      out[`auditLogs/${auditId(i)}`] = auditRecord(i);
    }
    for (const [id, d] of Object.entries(SECURITY)) {
      out[`securityEvents/${id}`] = d;
    }
    return { ...out, ...OTHER };
  }

  function afterMigration(): Record<string, Doc> {
    const out: Record<string, Doc> = {};
    for (const [path, d] of Object.entries(seeded())) {
      out[path] = path in OTHER ? d : stripped(d);
    }
    return out;
  }

  beforeEach(async () => {
    await fetch(`http://${FS_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
      method: 'DELETE',
    });
    const { db } = await deps();
    const entries = Object.entries(seeded());
    for (let start = 0; start < entries.length; start += 400) {
      const b = db.batch();
      for (const [path, d] of entries.slice(start, start + 400)) {
        b.set(db.doc(path), d);
      }
      await b.commit();
    }
  });

  it('the preview counts every targeted field and changes nothing', async () => {
    const { db, scanLegacyFields, countsOf } = await deps();
    const r = await scanLegacyFields(db);
    expect(r.scanned).toBe(AUDIT + Object.keys(SECURITY).length);
    expect(countsOf(r)).toEqual(expectedCounts());
    expect(await snapshot()).toEqual(seeded());
  });

  it('removes exactly the targeted fields, keeps every document and every other field', async () => {
    const { db, stripLegacyFields } = await deps();
    const r = await stripLegacyFields(db, { expected: expectedCounts() });
    expect(r).toMatchObject({ skipped: false, removed: expectedCounts(), remaining: 0 });
    expect(await snapshot()).toEqual(afterMigration());
  });

  it('refuses to apply, changing nothing, when the data no longer matches the preview', async () => {
    const { db, scanLegacyFields, stripLegacyFields, countsOf, MigrationRefusedError } =
      await deps();
    const preview = countsOf(await scanLegacyFields(db));
    await db.doc('auditLogs/late').set({ userId: 'u', ipAddress: ip(1) });
    const before = await snapshot();
    await expect(stripLegacyFields(db, { expected: preview })).rejects.toBeInstanceOf(
      MigrationRefusedError,
    );
    expect(await snapshot()).toEqual(before);
  });

  it('a second application is a no-op that changes nothing and succeeds', async () => {
    const { db, stripLegacyFields, scanLegacyFields, countsOf } = await deps();
    await stripLegacyFields(db, { expected: expectedCounts() });
    const after = await snapshot();
    const zero = countsOf(await scanLegacyFields(db));
    expect(zero.documents).toBe(0);
    await expect(stripLegacyFields(db, { expected: zero })).resolves.toMatchObject({
      remaining: 0,
    });
    expect(await snapshot()).toEqual(after);
  });

  it('with once: records completion with counts only, and later runs skip', async () => {
    const { db, stripLegacyFields } = await deps();
    await stripLegacyFields(db, { expected: expectedCounts(), once: true });
    const marker = (await db.doc(`_system/${MIGRATION_ID}`).get()).data();
    expect(marker?.removed).toEqual(expectedCounts());
    expect(JSON.stringify(marker)).not.toMatch(/203\.0\.113|a1b2c3d4|0123456789abcdef/);
    await db.doc('auditLogs/late').set({ userId: 'u', questionHash: FNV });
    await expect(
      stripLegacyFields(db, { expected: expectedCounts(), once: true }),
    ).resolves.toEqual({ skipped: true });
  });

  /** The real db, with batch commits intercepted. */
  async function interceptCommits(onCommit: (n: number) => Promise<void>) {
    const { db } = await deps();
    let n = 0;
    return new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === 'batch') {
          return () => {
            const b = target.batch();
            const commit = b.commit.bind(b);
            b.commit = async () => {
              n += 1;
              await onCommit(n);
              return commit();
            };
            return b;
          };
        }
        const v: unknown = Reflect.get(target, prop, receiver);
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
      },
    });
  }

  it('a failed batch fails the run without a marker; a fresh run then completes', async () => {
    const { db, stripLegacyFields, scanLegacyFields, countsOf } = await deps();
    const failing = await interceptCommits(n =>
      n === 2 ? Promise.reject(new Error('simulated commit failure')) : Promise.resolve(),
    );
    await expect(
      stripLegacyFields(failing, { expected: expectedCounts(), once: true }),
    ).rejects.toThrow('simulated commit failure');
    expect((await db.doc(`_system/${MIGRATION_ID}`).get()).exists).toBe(false);

    const partial = countsOf(await scanLegacyFields(db));
    expect(partial.documents).toBeGreaterThan(0);
    expect(partial.documents).toBeLessThan(expectedCounts().documents);
    await stripLegacyFields(db, { expected: partial, once: true });
    expect((await db.doc(`_system/${MIGRATION_ID}`).get()).exists).toBe(true);
    const all = await snapshot();
    delete all[`_system/${MIGRATION_ID}`];
    expect(all).toEqual(afterMigration());
  });

  it('fails, without a marker, when legacy fields are written during the run', async () => {
    const { db, stripLegacyFields } = await deps();
    const racing = await interceptCommits(async n => {
      if (n === 1) {
        await db.doc('auditLogs/zzzz').set({ userId: 'u', ipHash: SHA });
      }
    });
    await expect(
      stripLegacyFields(racing, { expected: expectedCounts(), once: true }),
    ).rejects.toThrow(/written during the run/);
    expect((await db.doc(`_system/${MIGRATION_ID}`).get()).exists).toBe(false);
  });

  interface CliOutput {
    mode: string;
    recorded?: boolean;
    counts: LegacyCounts;
    removed?: LegacyCounts;
    remaining?: number;
  }

  /** The deploy workflow's exact sequence, through the real CLI. */
  function cli(...args: string[]): { status: number | null; json: CliOutput | null; out: string } {
    const r = spawnSync(
      'npx',
      ['vite-node', 'scripts/strip-legacy-log-fields.ts', '--project', PROJECT, ...args],
      { cwd: join(__dirname, '../../..'), env: process.env, encoding: 'utf8' },
    );
    const out = `${r.stdout}${r.stderr}`;
    // Counts only: no synthetic IP, legacy code or keyed code ever printed.
    expect(out).not.toMatch(/203\.0\.113|a1b2c3d4|0123456789abcdef/);
    return {
      status: r.status,
      json: r.status === 0 ? (JSON.parse(r.stdout.trim().split('\n').pop()!) as CliOutput) : null,
      out,
    };
  }

  it('CLI: preview → apply with the preview’s counts → verify; then a preview with --once skips', () => {
    const preview = cli('--once');
    expect(preview.status).toBe(0);
    expect(preview.json).toMatchObject({
      mode: 'preview',
      recorded: false,
      counts: expectedCounts(),
    });

    const counts = preview.json!.counts;
    const tampered = { ...counts, documents: counts.documents + 1 };
    const refused = cli('--apply', '--once', '--expect', JSON.stringify(tampered));
    expect(refused.status).toBe(1);
    expect(refused.out).toMatch(/refusing to apply/);

    const applied = cli('--apply', '--once', '--expect', JSON.stringify(counts));
    expect(applied.status).toBe(0);
    expect(applied.json).toMatchObject({ mode: 'apply', removed: expectedCounts(), remaining: 0 });

    const verified = cli('--verify');
    expect(verified.status).toBe(0);
    expect(verified.json?.counts.documents).toBe(0);

    expect(cli('--once').json).toMatchObject({ mode: 'preview', recorded: true });
  }, 120_000);

  it('CLI: verify fails while legacy fields remain; apply without --expect is refused', () => {
    expect(cli('--verify').status).toBe(1);
    expect(cli('--apply', '--once').status).toBe(1);
    expect(cli('--apply', '--expect', '{"documents":1}').status).toBe(1);
  }, 60_000);
});
