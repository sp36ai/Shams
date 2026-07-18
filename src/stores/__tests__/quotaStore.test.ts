/**
 * quotaStore — quota, plan, and trial-window regression tests.
 *
 * This store gates the ask path (who may ask, how many per day) and mirrors
 * the server's trial clock. The MMKV mock resets between tests; the zustand
 * singleton is reset via reset() + setState in beforeEach.
 */

import { storage, KEYS } from '@storage/mmkv';
import {
  useQuotaStore,
  selectQuestionsLeft,
  selectIsUnlimited,
  FREE_DAILY_LIMIT,
  TRIAL_DAILY_LIMIT,
} from '../quotaStore';

jest.mock('../../firebase/trial', () => ({
  activateTrialOnServer: jest.fn().mockResolvedValue({
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    alreadyActive: false,
  }),
}));

const daysAgoIso = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString();

beforeEach(() => {
  useQuotaStore.getState().reset();
});

describe('free-plan quota', () => {
  it('allows exactly FREE_DAILY_LIMIT questions, then refuses', () => {
    const s = useQuotaStore.getState();
    for (let i = 0; i < FREE_DAILY_LIMIT; i++) {
      expect(useQuotaStore.getState().canAsk()).toBe(true);
      expect(s.consumeOne()).toBe(true);
    }
    expect(useQuotaStore.getState().questionsToday).toBe(FREE_DAILY_LIMIT);
    expect(useQuotaStore.getState().canAsk()).toBe(false);
    expect(s.consumeOne()).toBe(false);
    expect(useQuotaStore.getState().questionsToday).toBe(FREE_DAILY_LIMIT);
  });

  it('persists the consumed count and day key to MMKV', () => {
    useQuotaStore.getState().consumeOne();
    expect(storage.getNumber(KEYS.QUOTA_COUNT)).toBe(1);
    expect(storage.getString(KEYS.QUOTA_WEEK)).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe('trial quota', () => {
  it('raises the daily limit to TRIAL_DAILY_LIMIT while the trial is active', () => {
    useQuotaStore.setState({ trialActive: true });
    const s = useQuotaStore.getState();
    for (let i = 0; i < TRIAL_DAILY_LIMIT; i++) {
      expect(s.consumeOne()).toBe(true);
    }
    expect(s.consumeOne()).toBe(false);
    expect(useQuotaStore.getState().questionsToday).toBe(TRIAL_DAILY_LIMIT);
  });

  it('startTrial sets today as the start and is idempotent', () => {
    useQuotaStore.getState().startTrial();
    const first = useQuotaStore.getState().trialStartDate;
    expect(first).toBe(new Date().toISOString().slice(0, 10));
    expect(useQuotaStore.getState().trialActive).toBe(true);
    useQuotaStore.getState().startTrial(); // second call must not reset the clock
    expect(useQuotaStore.getState().trialStartDate).toBe(first);
  });
});

describe('reconcileTrialFromServer — server clock is authoritative', () => {
  it('an expired server start date flips the local trial to expired', () => {
    useQuotaStore.setState({
      trialStartDate: new Date().toISOString().slice(0, 10),
      trialActive: true,
      trialExpired: false,
    });
    useQuotaStore.getState().reconcileTrialFromServer(daysAgoIso(10));
    const s = useQuotaStore.getState();
    expect(s.trialActive).toBe(false);
    expect(s.trialExpired).toBe(true);
  });

  it('ignores an unparseable server date (no state change)', () => {
    const before = useQuotaStore.getState().trialStartDate;
    useQuotaStore.getState().reconcileTrialFromServer('not-a-date');
    expect(useQuotaStore.getState().trialStartDate).toBe(before);
  });

  it('persists the reconciled day to MMKV', () => {
    useQuotaStore.getState().reconcileTrialFromServer(daysAgoIso(2));
    expect(storage.getString(KEYS.TRIAL_START)).toBe(daysAgoIso(2).slice(0, 10));
    expect(useQuotaStore.getState().trialActive).toBe(true);
  });
});

describe('paid plans', () => {
  it('unlimited plans bypass the quota without incrementing the counter', () => {
    useQuotaStore.getState().setPlan('khass', daysAgoIso(-30));
    const s = useQuotaStore.getState();
    for (let i = 0; i < 20; i++) {
      expect(s.canAsk()).toBe(true);
      expect(s.consumeOne()).toBe(true);
    }
    expect(useQuotaStore.getState().questionsToday).toBe(0);
    expect(selectIsUnlimited(useQuotaStore.getState())).toBe(true);
    expect(selectQuestionsLeft(useQuotaStore.getState())).toBe(Infinity);
  });

  it('setPlan persists plan and expiry to MMKV', () => {
    const expiry = daysAgoIso(-30);
    useQuotaStore.getState().setPlan('mureed', expiry);
    expect(storage.getString(KEYS.QUOTA_PLAN)).toBe('mureed');
    expect(storage.getString(KEYS.QUOTA_PLAN_EXPIRY)).toBe(expiry);
  });
});

describe('reset — sign-out / account-deletion teardown', () => {
  it('zeroes quota, drops the plan to free, and clears the trial clock', () => {
    useQuotaStore.getState().setPlan('khass', daysAgoIso(-30));
    useQuotaStore.getState().startTrial();
    useQuotaStore.getState().reset();
    const s = useQuotaStore.getState();
    expect(s.plan).toBe('free');
    expect(s.planExpiry).toBeNull();
    expect(s.questionsToday).toBe(0);
    expect(s.trialStartDate).toBeNull();
    expect(s.trialActive).toBe(false);
    expect(s.trialExpired).toBe(false);
    expect(storage.getString(KEYS.TRIAL_START)).toBeUndefined();
    expect(storage.getString(KEYS.QUOTA_PLAN)).toBe('free');
  });
});

describe('selectors', () => {
  it('selectQuestionsLeft counts down from the free limit and floors at 0', () => {
    expect(selectQuestionsLeft(useQuotaStore.getState())).toBe(FREE_DAILY_LIMIT);
    useQuotaStore.getState().consumeOne();
    expect(selectQuestionsLeft(useQuotaStore.getState())).toBe(FREE_DAILY_LIMIT - 1);
    useQuotaStore.setState({ questionsToday: 99 });
    expect(selectQuestionsLeft(useQuotaStore.getState())).toBe(0);
  });
});
