import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (getApps().length === 0) {
  initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'shams-app-4d0e7' });
}

export const db = getFirestore();
export const auth = getAuth();
export { FieldValue };
