/**
 * trial.ts — client wrapper for the activateTrial Cloud Function.
 *
 * Called once when the user first accepts the free trial. The CF is
 * idempotent: calling it again after a reinstall returns the original
 * trial start date so the server clock cannot be reset by the user.
 */

import { regionalFunctions } from './functionsClient';

export interface ActivateTrialResult {
  startedAt: string;
  expiresAt: string;
  alreadyActive: boolean;
}

export async function activateTrialOnServer(): Promise<ActivateTrialResult> {
  const fn = regionalFunctions().httpsCallable('activateTrial');

  const result = await fn({});
  return result.data as ActivateTrialResult;
}
