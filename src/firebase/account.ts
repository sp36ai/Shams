/**
 * account.ts — client wrapper for the deleteAccount Cloud Function.
 *
 * Deletes the caller's account and every reading/quota/trial record
 * server-side (see functions/src/functions/account.ts for exactly what is
 * and isn't deleted, and why). This file does not touch local state itself
 * — the caller (SettingsScreen) is responsible for signing out and clearing
 * local stores once this resolves, the same division of responsibility
 * authStore.signOut() already follows for its own local cleanup.
 */

import { regionalFunctions } from './functionsRegion';
import { ensureAppCheckReady } from './appCheck';
import { withTimeout } from '../utils/withTimeout';

export interface DeleteAccountResult {
  deleted: boolean;
  readingsDeleted: number;
}

// PHASE 6D-4: see appCheck.ts's own doc comment for the cold-start race this
// closes — a fast launch into an already-authenticated session can fire this
// callable before App Check has attached a token at all. Bounded head start,
// proceeds either way; matches the pattern already used by
// watchOracle.ts/oracleDiscussion.ts.
const APP_CHECK_GATE_TIMEOUT_MS = 8000;

export async function deleteAccount(): Promise<DeleteAccountResult> {
  await withTimeout(ensureAppCheckReady(), APP_CHECK_GATE_TIMEOUT_MS);

  const fn = regionalFunctions().httpsCallable('deleteAccount');
  const result = await fn();
  return result.data as DeleteAccountResult;
}
