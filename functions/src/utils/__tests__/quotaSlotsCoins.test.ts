/**
 * quotaSlots — coins mode (owner decision 2026-10-14).
 *
 * Free seekers: one question per FREE_QUESTION_INTERVAL_DAYS, then
 * EXTRA_QUESTION_COST_MILLI from the wallet. Paid plans: PAID_DAILY_FAIR_USE
 * per UTC day. Refunds give back exactly what was charged. And the switch:
 * with no `_system/monetization` document, nothing changes (legacy rules).
 *
 * Firestore is faked at the module boundary, as in quotaSlots.test.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EXTRA_QUESTION_COST_MILLI,
  FREE_LIMIT,
  FREE_QUESTION_INTERVAL_DAYS,
  PAID_DAILY_FAIR_USE,
  todayKey,
} from '../../config';

type Doc = Record<string, unknown>;
const stores: Record<string, Map<string, Doc>> = {};
const ledger: Doc[] = [];
function store(name: string): Map<string, Doc> {
  stores[name] ??= new Map();
  return stores[name];
}

function makeRef(name: string, id: string) {
  const s = store(name);
  return {
    id,
    store: s,
    get: () => Promise.resolve({ exists: s.has(id), data: () => s.get(id) }),
    set: (value: Doc, opts?: { merge?: boolean }) => {
      s.set(id, opts?.merge === true ? { ...s.get(id), ...value } : value);
      return Promise.resolve();
    },
    collection: (sub: string) => ({
      doc: () => ({ id: `${sub}-${ledger.length}`, isLedger: true }),
    }),
  };
}

vi.mock('../admin', () => ({
  db: {
    collection: (name: string) => ({ doc: (id: string) => makeRef(name, id) }),
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: (ref: { get: () => Promise<unknown> }) => ref.get(),
        set: (
          ref: { id: string; store?: Map<string, Doc>; isLedger?: boolean },
          value: Doc,
          opts?: { merge?: boolean },
        ) => {
          if (ref.isLedger === true) {
            ledger.push(value);
            return;
          }
          const prior = ref.store!.get(ref.id);
          ref.store!.set(ref.id, opts?.merge === true ? { ...prior, ...value } : value);
        },
      }),
  },
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));

import { claimQuotaSlot, refundQuotaSlot, nextFreeAt } from '../quotaSlots';
import { resetMonetizationCache } from '../monetization';

const UID = 'seeker-1';
const DAY = 24 * 60 * 60 * 1000;

function coinsModeFor(...testers: string[]): void {
  store('_system').set('monetization', { mode: 'legacy', testers });
}
function balance(): number {
  return (store('wallets').get(UID)?.balanceMilli as number | undefined) ?? 0;
}

beforeEach(() => {
  for (const k of Object.keys(stores)) {
    delete stores[k];
  }
  ledger.length = 0;
  resetMonetizationCache();
});

describe('the switch', () => {
  it('without a monetization document, legacy rules apply (daily free limit)', async () => {
    const r = await claimQuotaSlot(UID);
    expect(r.mode).toBe('legacy');
    expect(r.remaining).toBe(FREE_LIMIT - 1);
    expect(r.charge).toEqual({ kind: 'daily' });
  });

  it('a tester gets coins mode while everyone else stays legacy', async () => {
    coinsModeFor(UID);
    expect((await claimQuotaSlot(UID)).mode).toBe('coins');
    resetMonetizationCache();
    expect((await claimQuotaSlot('someone-else')).mode).toBe('legacy');
  });
});

describe('coins mode — free plan', () => {
  beforeEach(() => coinsModeFor(UID));

  it('the first question is the free one, and starts the 7-day clock', async () => {
    const r = await claimQuotaSlot(UID);
    expect(r.charge).toEqual({ kind: 'free_weekly', previousLastFreeAt: null });
    expect(typeof store('quotas').get(UID)?.lastFreeAt).toBe('string');
    expect(balance()).toBe(0);
  });

  it('a second question in the same week with no coins is refused, saying when the next free one is', async () => {
    await claimQuotaSlot(UID);
    await expect(claimQuotaSlot(UID)).rejects.toMatchObject({
      code: 'resource-exhausted',
      details: { reason: 'free_used', questionCostMilli: EXTRA_QUESTION_COST_MILLI },
    });
  });

  it('a second question in the same week is paid with 3 coins when the wallet has them', async () => {
    await claimQuotaSlot(UID);
    store('wallets').set(UID, { balanceMilli: 5000 });
    const r = await claimQuotaSlot(UID);
    expect(r.charge).toEqual({ kind: 'coins', amountMilli: EXTRA_QUESTION_COST_MILLI });
    expect(balance()).toBe(5000 - EXTRA_QUESTION_COST_MILLI);
    expect(ledger.at(-1)).toMatchObject({
      type: 'spend_question',
      amountMilli: -EXTRA_QUESTION_COST_MILLI,
      balanceAfterMilli: 2000,
    });
  });

  it('a new free question is available 7 days after the last free one', async () => {
    const eightDaysAgo = new Date(
      Date.now() - (FREE_QUESTION_INTERVAL_DAYS + 1) * DAY,
    ).toISOString();
    store('quotas').set(UID, { lastFreeAt: eightDaysAgo });
    const r = await claimQuotaSlot(UID);
    expect(r.charge).toEqual({ kind: 'free_weekly', previousLastFreeAt: eightDaysAgo });
  });

  it('refunding a failed free question restores the free question', async () => {
    const r = await claimQuotaSlot(UID);
    await refundQuotaSlot(UID, r.charge);
    expect(store('quotas').get(UID)?.lastFreeAt).toBeNull();
    expect((await claimQuotaSlot(UID)).charge.kind).toBe('free_weekly');
  });

  it('refunding a failed paid-for question gives the coins back, with a ledger entry', async () => {
    await claimQuotaSlot(UID);
    store('wallets').set(UID, { balanceMilli: 3000 });
    const r = await claimQuotaSlot(UID);
    expect(balance()).toBe(0);
    await refundQuotaSlot(UID, r.charge);
    expect(balance()).toBe(3000);
    expect(ledger.at(-1)).toMatchObject({ type: 'refund', amountMilli: 3000 });
  });
});

describe('coins mode — paid plan', () => {
  beforeEach(() => coinsModeFor(UID));

  it(`allows ${PAID_DAILY_FAIR_USE} questions a day, then refuses with the fair-use reason`, async () => {
    const future = new Date(Date.now() + 10 * DAY).toISOString();
    store('quotas').set(UID, { plan: 'khass', planExpiry: future });
    for (let i = 0; i < PAID_DAILY_FAIR_USE; i++) {
      const r = await claimQuotaSlot(UID);
      expect(r.charge).toEqual({ kind: 'daily' });
      expect(r.remaining).toBe(PAID_DAILY_FAIR_USE - i - 1);
    }
    await expect(claimQuotaSlot(UID)).rejects.toMatchObject({
      code: 'resource-exhausted',
      details: { reason: 'fair_use', limit: PAID_DAILY_FAIR_USE },
    });
    expect(store('quotas').get(UID)?.dayKey).toBe(todayKey());
  });

  it('an expired plan is treated as free (and downgraded)', async () => {
    const past = new Date(Date.now() - DAY).toISOString();
    store('quotas').set(UID, { plan: 'mureed', planExpiry: past });
    const r = await claimQuotaSlot(UID);
    expect(r.plan).toBe('free');
    expect(r.charge.kind).toBe('free_weekly');
    expect(store('quotas').get(UID)?.plan).toBe('free');
  });
});

describe('nextFreeAt', () => {
  it('is null when no free question has been used', () => {
    expect(nextFreeAt(null)).toBeNull();
  });
  it('is exactly 7 days after the last free question while that is in the future', () => {
    const now = Date.parse('2026-10-14T10:00:00Z');
    expect(nextFreeAt('2026-10-12T09:00:00.000Z', now)).toBe('2026-10-19T09:00:00.000Z');
  });
  it('is null once those 7 days have passed', () => {
    const now = Date.parse('2026-10-20T10:00:00Z');
    expect(nextFreeAt('2026-10-12T09:00:00.000Z', now)).toBeNull();
  });
});
