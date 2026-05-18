/**
 * Quota selectors — pure function tests (no MMKV / native modules needed).
 */

import {
  FREE_LIMIT,
  selectQuestionsLeft,
  selectIsUnlimited,
  type QuotaState,
  type PlanTier,
} from '../stores/quotaStore';

function makeState(plan: PlanTier, usedThisWeek: number): QuotaState {
  return {
    plan,
    usedThisWeek,
    canAsk: () => false,
    consumeOne: () => false,
    setPlan: () => undefined,
    reset: () => undefined,
  };
}

describe('FREE_LIMIT', () => {
  test('is 100', () => {
    expect(FREE_LIMIT).toBe(100);
  });
});

describe('selectIsUnlimited', () => {
  test('free plan is NOT unlimited', () => {
    expect(selectIsUnlimited(makeState('free', 0))).toBe(false);
  });

  test.each<PlanTier>(['starter', 'premium', 'consultation'])('%s plan IS unlimited', plan => {
    expect(selectIsUnlimited(makeState(plan, 0))).toBe(true);
  });
});

describe('selectQuestionsLeft', () => {
  test('free plan with 0 used → 3 left', () => {
    expect(selectQuestionsLeft(makeState('free', 0))).toBe(3);
  });

  test('free plan with 1 used → 2 left', () => {
    expect(selectQuestionsLeft(makeState('free', 1))).toBe(2);
  });

  test('free plan with 3 used → 0 left (exhausted)', () => {
    expect(selectQuestionsLeft(makeState('free', 3))).toBe(0);
  });

  test('free plan over limit clamps to 0 (no negative)', () => {
    expect(selectQuestionsLeft(makeState('free', 99))).toBe(0);
  });

  test.each<PlanTier>(['starter', 'premium', 'consultation'])(
    '%s plan → Infinity left regardless of usage',
    plan => {
      expect(selectQuestionsLeft(makeState(plan, 999))).toBe(Infinity);
    },
  );
});
