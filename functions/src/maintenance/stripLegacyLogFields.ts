/**
 * stripLegacyLogFields — one-off removal of the privacy-sensitive fields
 * that older code wrote into Firestore audit records (owner decisions
 * 2026-10-21 and 2026-10-22).
 * --------------------------------------------------------------------------
 * Three fields, established from every historical writer in git history:
 *
 *   ipAddress     the caller's raw IP. Written to /auditLogs by the old
 *                 askOracle (2026-05-10 – 2026-08-25) and by Razorpay's
 *                 plan_upgraded record (2026-05-10 – 2026-06-27). Removed
 *                 whenever present, whatever its value.
 *   ipHash        an unsalted SHA-256 prefix of the IP (16 hex).
 *   questionHash  a bare 32-bit FNV-1a of the question (8 hex).
 *
 * The two unkeyed codes can be reversed by guessing and cannot be re-keyed
 * (the raw inputs are not kept), so they are removed; keyed codes ("h1:…",
 * utils/keyedHash.ts) are not touched. No other field is ever changed and no
 * document is deleted.
 *
 * Scope: /auditLogs and /securityEvents, the only collections any version
 * ever wrote these fields to. It cannot reach Cloud Logging entries,
 * backups or exports.
 *
 * Three steps, each separately callable:
 *   scanLegacyFields   counts only, changes nothing (the preview, and the
 *                      final verification).
 *   stripLegacyFields  refuses to start unless a fresh scan matches the
 *                      counts from the recorded preview; removes the fields
 *                      in pages of at most PAGE updates per batch (Firestore
 *                      allows 500); fails if it removed anything other than
 *                      what the preview counted, or if a rescan still finds
 *                      any; only then records the completion marker.
 * Any failure throws, so the caller exits non-zero and no marker is written.
 * Rerunning is safe: a field that is already gone is not counted or touched.
 *
 * Must run after the new code is deployed, or older instances still running
 * can write fresh legacy values behind it. Results carry counts only — never
 * a field value. Not part of any deployed function; called only by
 * scripts/strip-legacy-log-fields.ts.
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export const MIGRATION_ID = 'migration-strip-legacy-log-fields-v1';

export const COLLECTIONS = ['auditLogs', 'securityEvents'] as const;
export const FIELDS = ['ipAddress', 'ipHash', 'questionHash'] as const;
export const PAGE = 400;

type Collection = (typeof COLLECTIONS)[number];
type Field = (typeof FIELDS)[number];

/** A stored code in the pre-keyed format: any string not "h1:"-prefixed. */
export function isLegacyCode(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && !value.startsWith('h1:');
}

/** Whether a document's field is one this migration removes. */
export function isTarget(field: Field, data: FirebaseFirestore.DocumentData): boolean {
  if (field === 'ipAddress') {
    return Object.prototype.hasOwnProperty.call(data, 'ipAddress');
  }
  return isLegacyCode(data[field]);
}

/** Documents that hold at least one target field, per collection and per field. */
export interface LegacyCounts {
  readonly documents: number;
  readonly collections: Readonly<Record<Collection, number>>;
  readonly fields: Readonly<Record<Field, number>>;
}

export interface ScanResult extends LegacyCounts {
  readonly scanned: number;
}

export type StripResult =
  | { readonly skipped: true }
  | {
      readonly skipped: false;
      readonly preview: LegacyCounts;
      readonly removed: LegacyCounts;
      readonly remaining: number;
    };

export class MigrationRefusedError extends Error {}

function zero(): {
  documents: number;
  collections: Record<Collection, number>;
  fields: Record<Field, number>;
} {
  return {
    documents: 0,
    collections: { auditLogs: 0, securityEvents: 0 },
    fields: { ipAddress: 0, ipHash: 0, questionHash: 0 },
  };
}

/** Only the comparable counts, in a fixed key order. */
export function countsOf(c: LegacyCounts): LegacyCounts {
  return {
    documents: c.documents,
    collections: {
      auditLogs: c.collections.auditLogs,
      securityEvents: c.collections.securityEvents,
    },
    fields: {
      ipAddress: c.fields.ipAddress,
      ipHash: c.fields.ipHash,
      questionHash: c.fields.questionHash,
    },
  };
}

function same(a: LegacyCounts, b: LegacyCounts): boolean {
  return JSON.stringify(countsOf(a)) === JSON.stringify(countsOf(b));
}

/**
 * Walk every document of both collections in name order, PAGE at a time.
 * With `apply`, each page's target fields are removed in one batch before
 * the next page is read.
 */
async function walk(db: Firestore, apply: boolean): Promise<ScanResult> {
  const counts = zero();
  let scanned = 0;
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
          if (isTarget(field, data)) {
            update[field] = FieldValue.delete();
            counts.fields[field] += 1;
          }
        }
        if (Object.keys(update).length > 0) {
          counts.documents += 1;
          counts.collections[name] += 1;
          batch.update(doc.ref, update);
          pending += 1;
        }
      }
      if (apply && pending > 0) {
        await batch.commit();
      }
      last = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE) {
        break;
      }
    }
  }
  return { scanned, ...counts };
}

export async function isMigrationRecorded(db: Firestore): Promise<boolean> {
  return (await db.collection('_system').doc(MIGRATION_ID).get()).exists;
}

/** Count target fields. Changes nothing. */
export function scanLegacyFields(db: Firestore): Promise<ScanResult> {
  return walk(db, false);
}

/**
 * Remove the target fields, but only if the data still matches `expected`
 * (the counts from the preview the caller recorded).
 */
export async function stripLegacyFields(
  db: Firestore,
  opts: { readonly expected: LegacyCounts; readonly once?: boolean },
): Promise<StripResult> {
  if (opts.once === true && (await isMigrationRecorded(db))) {
    return { skipped: true };
  }

  const preview = await walk(db, false);
  if (!same(preview, opts.expected)) {
    throw new MigrationRefusedError(
      `refusing to apply: the data no longer matches the recorded preview ` +
        `(expected ${JSON.stringify(countsOf(opts.expected))}, found ${JSON.stringify(countsOf(preview))}); ` +
        `nothing was changed — run a new preview`,
    );
  }

  const removed = await walk(db, true);
  if (!same(removed, preview)) {
    throw new Error(
      `removed ${JSON.stringify(countsOf(removed))} but the preview counted ` +
        `${JSON.stringify(countsOf(preview))}: legacy fields were written during the run — investigate, then run a new preview`,
    );
  }

  const after = await walk(db, false);
  if (after.documents !== 0) {
    throw new Error(`${after.documents} documents still hold legacy fields after the removal`);
  }

  if (opts.once === true) {
    await db
      .collection('_system')
      .doc(MIGRATION_ID)
      .set({
        completedAt: FieldValue.serverTimestamp(),
        removed: countsOf(removed),
        scannedAfter: after.scanned,
      });
  }
  return { skipped: false, preview: countsOf(preview), removed: countsOf(removed), remaining: 0 };
}
