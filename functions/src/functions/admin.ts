/**
 * admin.ts — Administrative utility functions for Shams al-Asrār.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { auth } from '../utils/admin';
import { FUNCTION_OPTS } from '../config';
import { logger } from '../utils/logger';

/**
 * setAdminClaim — Set administrative privileges for a user.
 *
 * Security:
 * 1. Only existing admins can call this function (enforced via request.auth.token.admin).
 * 2. Enforces App Check in production to prevent unauthorized API probing.
 *
 * Note: To set the VERY FIRST admin, use the Firebase CLI:
 * firebase functions:shell
 * > setAdminClaim({ targetUid: 'YOUR_UID', isAdmin: true })
 */
export const setAdminClaim = onCall(
  {
    ...FUNCTION_OPTS,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
  },
  async request => {
    // 1. Authorization check: Only existing admins can manage administrative claims.
    if (!request.auth || request.auth.token.admin !== true) {
      throw new HttpsError(
        'permission-denied',
        'Unauthorized: Only admins can manage administrative claims.',
      );
    }

    const { targetUid, isAdmin } = request.data as { targetUid: string; isAdmin: boolean };

    if (!targetUid || typeof isAdmin !== 'boolean') {
      throw new HttpsError(
        'invalid-argument',
        'Required fields missing: targetUid (string) and isAdmin (boolean).',
      );
    }

    try {
      // Get existing claims to avoid overwriting subscription plan info
      const user = await auth.getUser(targetUid);
      const currentClaims = user.customClaims || {};

      // Update custom claims
      await auth.setCustomUserClaims(targetUid, {
        ...currentClaims,
        admin: isAdmin,
      });

      return {
        success: true,
        message: `Admin claim for user ${targetUid} successfully set to ${isAdmin}.`,
      };
    } catch (error) {
      logger.error('Error setting admin claim', { err: String(error) });
      throw new HttpsError('internal', 'Failed to update custom claims.');
    }
  },
);
