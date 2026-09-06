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

export interface DeleteAccountResult {
  deleted: boolean;
  readingsDeleted: number;
}

export async function deleteAccount(): Promise<DeleteAccountResult> {
  const fn = regionalFunctions().httpsCallable('deleteAccount');
  const result = await fn();
  return result.data as DeleteAccountResult;
}
