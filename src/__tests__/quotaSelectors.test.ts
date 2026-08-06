/**
 * Quota selectors — pure function tests (no MMKV / native modules needed).
 */

import {
  FREE_DAILY_LIMIT,
  selectQuestionsLeft,
  selectIsUnlimited,
  type QuotaState,
  type PlanTier,
} from '../stores/quotaStore';

function makeState(plan: PlanTier, questionsToday: number): QuotaState {
  return {
    plan,
    planExpiry: null,
    questionsToday,
    trialStartDate: null,
    trialActive: false,
    trialExpired: false,
    FREE_DAILY_LIMIT,
    canAsk: () => false,
    consumeOne: () => false,
    setPlan: () => undefined,
    startTrial: () => undefined,
    checkTrial: () => ({ active: false, daysRemaining: 0, expired: false }),
    reset: () => undefined,
  };
}

describe('FREE_DAILY_LIMIT', () => {
  // TEMP (internal testing): quotaStore.ts raised this to 50 while the oracle
  // engine is being debugged — see the REVERT comment there. This assertion
  // tracks the same TEMP value on purpose, as a tripwire: when the constant
  // is reverted to 3 before public launch, this test should be updated back
  // to 3 in the same change, not left silently out of sync.
  test('is 50 (TEMP internal-testing value — see quotaStore.ts REVERT comment)', () => {
    expect(FREE_DAILY_LIMIT).toBe(50);
  });
});

describe('selectIsUnlimited', () => {
  test('free plan is NOT unlimited', () => {
    expect(selectIsUnlimited(makeState('free', 0))).toBe(false);
  });

  test.each<PlanTier>(['mureed', 'khass'])('%s plan IS unlimited', plan => {
    expect(selectIsUnlimited(makeState(plan, 0))).toBe(true);
  });
});

describe('selectQuestionsLeft', () => {
  test('free plan with 0 used → FREE_DAILY_LIMIT left', () => {
    expect(selectQuestionsLeft(makeState('free', 0))).toBe(FREE_DAILY_LIMIT);
  });

  test('free plan with 1 used → FREE_DAILY_LIMIT - 1 left', () => {
    expect(selectQuestionsLeft(makeState('free', 1))).toBe(FREE_DAILY_LIMIT - 1);
  });

  test('free plan at limit → 0 left', () => {
    expect(selectQuestionsLeft(makeState('free', FREE_DAILY_LIMIT))).toBe(0);
  });

  test('free plan over limit clamps to 0 (no negative)', () => {
    expect(selectQuestionsLeft(makeState('free', FREE_DAILY_LIMIT + 50))).toBe(0);
  });

  test.each<PlanTier>(['mureed', 'khass'])('%s plan → Infinity left regardless of usage', plan => {
    expect(selectQuestionsLeft(makeState(plan, 999))).toBe(Infinity);
  });
});
