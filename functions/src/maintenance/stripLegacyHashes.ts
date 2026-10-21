/**
 * stripLegacyHashes — one-off removal of the unkeyed correlation codes
 * written before utils/keyedHash.ts (owner decision 2026-10-21).
 * --------------------------------------------------------------------------
 * Records written before the keyed-hash change carry `questionHash` as a
 * bare 32-bit FNV-1a (8 hex) and `ipHash` as an unsalted SHA-256 prefix
 * (16 hex). Both can be reversed by guessing, and they cannot be re-keyed
 * because the raw inputs were never stored — so they are deleted. Keyed
 * codes ("h1:…") are left exactly as they are, as is every other field.
 *
 * Scope: /auditLogs and /securityEvents, the only collections that store
 * these fields. Deletes fields, never documents.
 *
 * Safe to run any number of times: a value is only touched if it is in the
 * legacy format, so a second run finds nothing. With `once`, a completed run
 * records /_system/migration-strip-legacy-hashes-v1 and later runs skip the
 * scan entirely. Must run after the keyed-hash code is deployed, or older
 * instances still running can write fresh legacy values behind it.
 *
 * Not part of any deployed function — called only by
 * scripts/strip-legacy-hashes.ts.
 */

import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export const MIGRATION_ID = 'migration-strip-legacy-hashes-v1';
const COLLECTIONS = ['auditLogs', 'securityEvents'] as const;
const FIELDS = ['questionHash', 'ipHash'] as const;
const PAGE = 400;

/** A stored code in the pre-keyed format: any string not "h1:"-prefixed. */
export function isLegacyCode(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && !value.startsWith('h1:');
}

export interface StripResult {
  readonly skipped: boolean;
  readonly scanned: number;
  /** Documents that had at least one legacy field (would be / were updated). */
  readonly documents: number;
  readonly fields: Readonly<Record<(typeof FIELDS)[number], number>>;
  readonly applied: boolean;
}

export async function stripLegacyHashes(
  db: Firestore,
  opts: { readonly apply: boolean; readonly once?: boolean },
): Promise<StripResult> {
  const markerRef = db.collection('_system').doc(MIGRATION_ID);
  if (opts.once === true && (await markerRef.get()).exists) {
    return {
      skipped: true,
      scanned: 0,
      documents: 0,
      fields: { questionHash: 0, ipHash: 0 },
      applied: false,
    };
  }

  let scanned = 0;
  let documents = 0;
  const fields = { questionHash: 0, ipHash: 0 };

  for (const name of COLLECTIONS) {
    let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let query = db.collection(name).orderBy('__name__').limit(PAGE);
      if (last !== undefined) {
        query = query.startAfter(last);
      }
      const snap = await query.get();
      if (snap.empty) {
        break;
      }
      const batch = db.batch();
      let pending = 0;
      for (const doc of snap.docs) {
        scanned += 1;
        const data = doc.data();
        const update: Record<string, FirebaseFirestore.FieldValue> = {};
        for (const field of FIELDS) {
          if (isLegacyCode(data[field])) {
            update[field] = FieldValue.delete();
            fields[field] += 1;
          }
        }
        if (Object.keys(update).length > 0) {
          documents += 1;
          batch.update(doc.ref, update);
          pending += 1;
        }
      }
      if (opts.apply && pending > 0) {
        await batch.commit();
      }
      last = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE) {
        break;
      }
    }
  }

  if (opts.apply && opts.once === true) {
    await markerRef.set({
      completedAt: FieldValue.serverTimestamp(),
      scanned,
      documents,
    });
  }

  return { skipped: false, scanned, documents, fields, applied: opts.apply };
}
