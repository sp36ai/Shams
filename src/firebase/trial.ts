/**
 * trial.ts — client wrapper for the activateTrial Cloud Function.
 *
 * Called once when the user first accepts the free trial. The CF is
 * idempotent: calling it again after a reinstall returns the original
 * trial start date so the server clock cannot be reset by the user.
 */

import { regionalFunctions } from './functionsRegion';
import { ensureAppCheckReady } from './appCheck';
import { withTimeout } from '../utils/withTimeout';

export interface ActivateTrialResult {
  startedAt: string;
  expiresAt: string;
  alreadyActive: boolean;
}

// PHASE 6D-4: see appCheck.ts's own doc comment for the cold-start race this
// closes. This function's own client trigger (quotaStore.startTrial()) has
// no caller anywhere in this app today — see
// docs/audit/PHASE_6D_4_RECONNAISSANCE.md §3 and
// docs/audit/PHASE_6D_4_REVIEW.md §4.2 — but the gate is added anyway for
// consistency with every other callable and so it is already correct
// whenever that trigger is wired up.
const APP_CHECK_GATE_TIMEOUT_MS = 8000;

export async function activateTrialOnServer(): Promise<ActivateTrialResult> {
  await withTimeout(ensureAppCheckReady(), APP_CHECK_GATE_TIMEOUT_MS);

  const fn = regionalFunctions().httpsCallable('activateTrial');

  const result = await fn({});
  return result.data as ActivateTrialResult;
}
