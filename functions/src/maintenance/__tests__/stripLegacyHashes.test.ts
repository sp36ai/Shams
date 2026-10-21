/**
 * stripLegacyHashes — the format rule (always), and the real migration on
 * the Firestore emulator (when pointed at one, demo- project only).
 *
 *   cd functions && npm run test:emulator   (serial: suites share one database)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { isLegacyCode, MIGRATION_ID } from '../stripLegacyHashes';

describe('isLegacyCode', () => {
  it('treats the old unkeyed formats as legacy', () => {
    expect(isLegacyCode('a1b2c3d4')).toBe(true); // FNV-1a, 8 hex
    expect(isLegacyCode('0123456789abcdef')).toBe(true); // SHA-256 prefix, 16 hex
  });

  it('leaves keyed codes, empties and non-strings alone', () => {
    expect(isLegacyCode('h1:0123456789abcdef0123456789abcdef')).toBe(false);
    expect(isLegacyCode('')).toBe(false);
    expect(isLegacyCode(undefined)).toBe(false);
    expect(isLegacyCode(42)).toBe(false);
  });
});

const PROJECT = process.env.GCLOUD_PROJECT ?? '';
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const ON_EMULATOR = FS_HOST !== '';
if (ON_EMULATOR && !PROJECT.startsWith('demo-')) {
  throw new Error(`refusing to run: GCLOUD_PROJECT must be a demo- project, got "${PROJECT}"`);
}

describe.skipIf(!ON_EMULATOR)('EMULATOR — stripLegacyHashes on real Firestore', () => {
  const KEYED = 'h1:0123456789abcdef0123456789abcdef';

  async function deps() {
    const { db } = await import('../../utils/admin');
    const { stripLegacyHashes } = await import('../stripLegacyHashes');
    return { db, stripLegacyHashes };
  }

  beforeEach(async () => {
    await fetch(`http://${FS_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
      method: 'DELETE',
    });
    const { db } = await deps();
    // 450 audit entries: more than one 400-document page.
    for (let start = 0; start < 450; start += 150) {
      const b = db.batch();
      for (let i = start; i < start + 150; i++) {
        const legacy = i % 3 === 0;
        b.set(db.doc(`auditLogs/a${String(i).padStart(4, '0')}`), {
          userId: `u${i}`,
          action: 'oracle_computed',
          questionHash: legacy ? 'a1b2c3d4' : KEYED,
          ...(i % 5 === 0 ? { ipHash: '0123456789abcdef' } : {}),
          resultHash: 'deadbeef', // a verdict digest — not personal, must survive
        });
      }
      await b.commit();
    }
    await db.doc('securityEvents/s1').set({ type: 'x', userId: 'u1', ipHash: '0123456789abcdef' });
    await db.doc('securityEvents/s2').set({ type: 'x', userId: 'u2', ipHash: KEYED });
  });

  it('a dry run counts everything and changes nothing', async () => {
    const { db, stripLegacyHashes } = await deps();
    const r = await stripLegacyHashes(db, { apply: false });
    expect(r).toMatchObject({
      skipped: false,
      applied: false,
      scanned: 452,
      fields: { questionHash: 150, ipHash: 91 },
    });
    expect((await db.doc('auditLogs/a0000').get()).data()?.questionHash).toBe('a1b2c3d4');
  });

  it('apply removes only legacy values and leaves every other field', async () => {
    const { db, stripLegacyHashes } = await deps();
    await stripLegacyHashes(db, { apply: true });

    const all = (await db.collection('auditLogs').get()).docs.map(d => d.data());
    expect(all).toHaveLength(450);
    expect(all.filter(d => d.questionHash !== undefined && d.questionHash !== KEYED)).toEqual([]);
    expect(all.filter(d => d.questionHash === KEYED)).toHaveLength(300);
    expect(all.filter(d => d.ipHash !== undefined)).toEqual([]);
    expect(all.every(d => d.resultHash === 'deadbeef' && typeof d.userId === 'string')).toBe(true);

    expect((await db.doc('securityEvents/s1').get()).data()).toEqual({ type: 'x', userId: 'u1' });
    expect((await db.doc('securityEvents/s2').get()).data()?.ipHash).toBe(KEYED);
  });

  it('a second run finds nothing left', async () => {
    const { db, stripLegacyHashes } = await deps();
    await stripLegacyHashes(db, { apply: true });
    const again = await stripLegacyHashes(db, { apply: true });
    expect(again).toMatchObject({ documents: 0, fields: { questionHash: 0, ipHash: 0 } });
  });

  it('with once, a completed run is recorded and later runs skip the scan', async () => {
    const { db, stripLegacyHashes } = await deps();
    await stripLegacyHashes(db, { apply: true, once: true });
    expect((await db.doc(`_system/${MIGRATION_ID}`).get()).exists).toBe(true);
    await db.doc('auditLogs/late').set({ userId: 'u', questionHash: 'a1b2c3d4' });
    const skipped = await stripLegacyHashes(db, { apply: true, once: true });
    expect(skipped.skipped).toBe(true);
  });

  it('a dry run never writes the completion marker', async () => {
    const { db, stripLegacyHashes } = await deps();
    await stripLegacyHashes(db, { apply: false, once: true });
    expect((await db.doc(`_system/${MIGRATION_ID}`).get()).exists).toBe(false);
  });
});
