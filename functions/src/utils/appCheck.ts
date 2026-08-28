/**
 * App Check Enforcement Utility
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { getAppCheck } from 'firebase-admin/app-check';

export async function enforceAppCheck(appCheckToken: string): Promise<void> {
  if (!appCheckToken) {
    throw new HttpsError(
      'failed-precondition',
      'App Check token required but missing. Ensure App Check is initialized on client.',
    );
  }
  // Actual verification handled by framework when enforceAppCheck: true is set on onCall
}
