import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (getApps().length === 0) {
  initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'shams-app-4d0e7' });
}

export const db = getFirestore();
// Omit `undefined` fields instead of throwing on write. Reading/quota/audit
// docs legitimately carry optional fields (e.g. a verdict with no timing sets
// `timing: undefined`); without this the Admin SDK throws "Cannot use
// 'undefined' as a Firestore value", which surfaced as askOracle failing every
// call with an `internal` error AFTER the quota slot was already claimed.
// Must be set before the first Firestore operation — safe here as this module
// is the single Firestore entry point, imported before any handler runs.
db.settings({ ignoreUndefinedProperties: true });
export const auth = getAuth();
export { FieldValue };
