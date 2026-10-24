/**
 * quotaSlots.ts — atomic quota claim/refund, shared across oracle callables.
 * --------------------------------------------------------------------------
 * This is the sole quota gate the app's one live Oracle path (askWatchOracle)
 * depends on to charge — or not overcharge — a seeker for a reading, and it
 * had zero direct test coverage before this file: askWatchOracle.ts itself
 * has no test of its own, and quota.ts's own tests (quota.test.ts) exercise
 * getQuota's read path, never claimQuotaSlot/refundQuotaSlot.
 *
 * Firestore is faked at the module boundary, same discipline as
 * idempotency.test.ts and readings.test.ts — the transaction semantics that
 * matter (get-then-conditionally-write inside one transaction) are the
 * contract this file depends on, not something worth an emulator for.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FREE_LIMIT, TRIAL_DAILY_LIMIT, todayKey } from '../../config';

interface StoredDoc {
  [key: string]: unknown;
}

const quotas = new Map<string, StoredDoc>();
const trials = new Map<string, StoredDoc>();

function makeRef(store: Map<string, StoredDoc>, id: string) {
  return {
    id,
    // Carries its own store rather than making the transaction's `set`
    // guess which collection a ref belongs to — trials is read-only in
    // quotaSlots.ts today, but a fake that infers the target from map
    // membership would silently keep "working" even if that ever changed
    // and a write went to the wrong collection.
    store,
    get: () =>
      Promise.resolve({
        exists: store.has(id),
        data: () => store.get(id),
      }),
  };
}

vi.mock('../admin', () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => {
        if (name === 'quotas') {
          return makeRef(quotas, id);
        }
        if (name === 'trials') {
          return makeRef(trials, id);
        }
        throw new Error(`unexpected collection: ${name}`);
      },
    }),
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: (ref: { get: () => Promise<unknown> }) => ref.get(),
        set: (
          ref: { id: string; store: Map<string, StoredDoc> },
          value: StoredDoc,
          opts?: { merge?: boolean },
        ) => {
          const prior = ref.store.get(ref.id);
          ref.store.set(ref.id, opts?.merge === true ? { ...prior, ...value } : value);
        },
      }),
  },
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));

import { claimQuotaSlot, refundQuotaSlot } from '../quotaSlots';

beforeEach(() => {
  quotas.clear();
  trials.clear();
});

describe('claimQuotaSlot — free plan', () => {
  it('a first-ever claim succeeds with the full daily limit minus one remaining', async () => {
    const { plan, remaining, trialActive } = await claimQuotaSlot('u1');
    expect(plan).toBe('free');
    expect(trialActive).toBe(false);
    expect(remaining).toBe(FREE_LIMIT - 1);
    expect(quotas.get('u1')).toMatchObject({ dayKey: todayKey(), used: 1 });
  });

  it('throws resource-exhausted once the daily limit is reached, without incrementing past it', async () => {
    quotas.set('u1', { dayKey: todayKey(), used: FREE_LIMIT, plan: 'free' });

    await expect(claimQuotaSlot('u1')).rejects.toMatchObject({ code: 'resource-exhausted' });
    expect(quotas.get('u1')?.used).toBe(FREE_LIMIT);
  });

  it('resets the count when the stored dayKey is from an earlier day', async () => {
    quotas.set('u1', { dayKey: '2020-01-01', used: FREE_LIMIT, plan: 'free' });

    const { remaining } = await claimQuotaSlot('u1');

    expect(remaining).toBe(FREE_LIMIT - 1);
    expect(quotas.get('u1')).toMatchObject({ dayKey: todayKey(), used: 1 });
  });

  it('a second claim the same day increments from the stored count, not from zero', async () => {
    await claimQuotaSlot('u1');
    const { remaining } = await claimQuotaSlot('u1');

    expect(remaining).toBe(FREE_LIMIT - 2);
    expect(quotas.get('u1')?.used).toBe(2);
  });
});

describe('claimQuotaSlot — trial', () => {
  it('an active trial uses the trial daily limit, not the free one', async () => {
    trials.set('u1', {
      userId: 'u1',
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    quotas.set('u1', { dayKey: todayKey(), used: TRIAL_DAILY_LIMIT - 1, plan: 'free' });

    const { remaining, trialActive } = await claimQuotaSlot('u1');

    expect(trialActive).toBe(true);
    expect(remaining).toBe(0);
  });

  it('an expired trial falls back to the free limit, not the trial one', async () => {
    trials.set('u1', {
      userId: 'u1',
      startedAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    });

    const { trialActive, remaining } = await claimQuotaSlot('u1');

    expect(trialActive).toBe(false);
    expect(remaining).toBe(FREE_LIMIT - 1);
  });
});

describe('claimQuotaSlot — paid plans', () => {
  it('an unlimited plan reports remaining=null and never writes a used count', async () => {
    quotas.set('u1', { plan: 'mureed', dayKey: todayKey(), used: 0 });

    const { plan, remaining } = await claimQuotaSlot('u1');

    expect(plan).toBe('mureed');
    expect(remaining).toBeNull();
    // The transaction's early return for unlimited plans must skip the
    // tx.set entirely — a paid seeker's `used` counter must never move.
    expect(quotas.get('u1')?.used).toBe(0);
  });

  it('an expired paid plan reverts to free — and free limits then apply', async () => {
    quotas.set('u1', {
      plan: 'khass',
      planExpiry: new Date(Date.now() - 1000).toISOString(),
      dayKey: todayKey(),
      used: 0,
    });

    const { plan, remaining } = await claimQuotaSlot('u1');

    expect(plan).toBe('free');
    expect(remaining).toBe(FREE_LIMIT - 1);
    expect(quotas.get('u1')?.plan).toBe('free');
  });

  it('a still-valid paid plan expiry keeps the unlimited plan active', async () => {
    quotas.set('u1', {
      plan: 'khass',
      planExpiry: new Date(Date.now() + 86_400_000).toISOString(),
      dayKey: todayKey(),
      used: 0,
    });

    const { plan, remaining } = await claimQuotaSlot('u1');

    expect(plan).toBe('khass');
    expect(remaining).toBeNull();
  });
});

describe('refundQuotaSlot', () => {
  it('gives back exactly one slot claimed earlier today', async () => {
    quotas.set('u1', { dayKey: todayKey(), used: 3, plan: 'free' });

    await refundQuotaSlot('u1');

    expect(quotas.get('u1')?.used).toBe(2);
  });

  it('no-ops when no quota doc exists yet — nothing was ever claimed', async () => {
    await expect(refundQuotaSlot('u1')).resolves.toBeUndefined();
    expect(quotas.has('u1')).toBe(false);
  });

  it('no-ops when the day has rolled over since the claim — refunding into today would be wrong', async () => {
    quotas.set('u1', { dayKey: '2020-01-01', used: 5, plan: 'free' });

    await refundQuotaSlot('u1');

    // Untouched: a refund against a stale day must not silently reset it,
    // and must not decrement a count that belongs to a different day.
    expect(quotas.get('u1')).toMatchObject({ dayKey: '2020-01-01', used: 5 });
  });

  it('never goes negative when used is already zero', async () => {
    quotas.set('u1', { dayKey: todayKey(), used: 0, plan: 'free' });

    await refundQuotaSlot('u1');

    expect(quotas.get('u1')?.used).toBe(0);
  });
});
