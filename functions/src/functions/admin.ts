/**
 * admin.ts — Administrative utility functions for Shams al-Asrār.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { auth } from '../utils/admin';
import { creditWallet } from '../utils/wallet';
import { enforceRateLimit } from '../middleware/rateLimit';
import { parse, SetAdminClaimSchema, GrantCoinsSchema } from '../middleware/validate';
import { FUNCTION_OPTS, MILLI_PER_COIN } from '../config';
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

    // PHASE 6C-2: rate-limit by the calling admin's own uid — request.auth
    // is already confirmed non-null above.
    await enforceRateLimit(request.auth.uid);

    const { targetUid, isAdmin } = parse(SetAdminClaimSchema, request.data);

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

/**
 * grantCoins — add coins to a seeker's wallet (admin only).
 *
 * For testing the coin economy before Google Play coin packs exist, and for
 * goodwill credits. Every grant is a ledger entry ('grant', with the calling
 * admin's uid in the note), never a silent balance edit.
 */
export const grantCoins = onCall(
  {
    ...FUNCTION_OPTS,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
  },
  async request => {
    if (!request.auth || request.auth.token.admin !== true) {
      throw new HttpsError('permission-denied', 'Unauthorized: only admins can grant coins.');
    }
    await enforceRateLimit(request.auth.uid);

    const { targetUid, coins, note } = parse(GrantCoinsSchema, request.data);
    try {
      await auth.getUser(targetUid); // a grant must land on a real account
      const balanceMilli = await creditWallet(targetUid, coins * MILLI_PER_COIN, 'grant', {
        note: `by ${request.auth.uid}${note ? `: ${note}` : ''}`,
      });
      logger.info('grantCoins', { targetUid, coins, by: request.auth.uid });
      return { success: true, balanceMilli };
    } catch (error) {
      logger.error('Error granting coins', { err: String(error) });
      throw new HttpsError('internal', 'Failed to grant coins.');
    }
  },
);
