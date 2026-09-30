/**
 * quotaStore — setPlan's expiry-clearing guarantee.
 * --------------------------------------------------------------------------
 * setPlan() used to only ever WRITE a truthy expiry, never clear one: a
 * downgrade call (setPlan('free') on sign-out, auth failure, or — since
 * useQuota.ts now reconciles against the server's getQuota response — a
 * confirmed-lapsed subscription) left a prior paid plan's planExpiry sitting
 * in both MMKV and the in-memory store, contradicting plan: 'free' right
 * next to it. No consumer reads planExpiry for gating today (canAsk/
 * consumeOne key off `plan` alone), but the field is public API
 * (QuotaState.planExpiry) and the whole point of this session's server-side
 * getQuota fix was the exact same "stale expiry paired with a corrected
 * plan" defect — this closes the client-side counterpart.
 */

import { useQuotaStore } from '../quotaStore';
import { storage, KEYS } from '@storage/mmkv';

beforeEach(() => {
  useQuotaStore.getState().reset();
});

describe('setPlan — expiry is always fully replaced, never left stale', () => {
  it('stores a provided expiry', () => {
    useQuotaStore.getState().setPlan('khass', '2026-12-31T00:00:00.000Z');
    expect(useQuotaStore.getState().planExpiry).toBe('2026-12-31T00:00:00.000Z');
    expect(storage.getString(KEYS.QUOTA_PLAN_EXPIRY)).toBe('2026-12-31T00:00:00.000Z');
  });

  it('clears a previously-stored expiry when downgrading with no expiry argument', () => {
    useQuotaStore.getState().setPlan('khass', '2026-12-31T00:00:00.000Z');
    useQuotaStore.getState().setPlan('free');

    expect(useQuotaStore.getState().plan).toBe('free');
    expect(useQuotaStore.getState().planExpiry).toBeNull();
    expect(storage.getString(KEYS.QUOTA_PLAN_EXPIRY)).toBeUndefined();
  });

  it('clears a previously-stored expiry when explicitly passed null', () => {
    useQuotaStore.getState().setPlan('mureed', '2026-12-31T00:00:00.000Z');
    useQuotaStore.getState().setPlan('free', null);

    expect(useQuotaStore.getState().planExpiry).toBeNull();
    expect(storage.getString(KEYS.QUOTA_PLAN_EXPIRY)).toBeUndefined();
  });

  it('replaces an old expiry with a new one on a plan change, not merging/keeping the old one', () => {
    useQuotaStore.getState().setPlan('mureed', '2026-06-01T00:00:00.000Z');
    useQuotaStore.getState().setPlan('khass', '2026-12-31T00:00:00.000Z');

    expect(useQuotaStore.getState().plan).toBe('khass');
    expect(useQuotaStore.getState().planExpiry).toBe('2026-12-31T00:00:00.000Z');
  });

  it('reset() also leaves no stale expiry behind', () => {
    useQuotaStore.getState().setPlan('khass', '2026-12-31T00:00:00.000Z');
    useQuotaStore.getState().reset();

    expect(useQuotaStore.getState().plan).toBe('free');
    expect(useQuotaStore.getState().planExpiry).toBeNull();
    expect(storage.getString(KEYS.QUOTA_PLAN_EXPIRY)).toBeUndefined();
  });
});
