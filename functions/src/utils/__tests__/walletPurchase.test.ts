/**
 * creditCoinPurchase — a Google Play coin pack is credited exactly once, to
 * the account that first verifies it. Firestore is faked per collection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

type Doc = Record<string, unknown>;
const store = new Map<string, Doc>(); // key: `${collection}/${id}`
const ledger: Doc[] = [];

vi.mock('../admin', () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        key: `${name}/${id}`,
        get: () =>
          Promise.resolve({
            exists: store.has(`${name}/${id}`),
            data: () => store.get(`${name}/${id}`),
          }),
        collection: () => ({ doc: () => ({ isLedger: true }) }),
      }),
    }),
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: (ref: { get: () => Promise<unknown> }) => ref.get(),
        set: (
          ref: { key?: string; isLedger?: boolean },
          value: Doc,
          opts?: { merge?: boolean },
        ) => {
          if (ref.isLedger === true) {
            ledger.push(value);
            return;
          }
          const prior = store.get(ref.key!);
          store.set(ref.key!, opts?.merge === true ? { ...prior, ...value } : value);
        },
      }),
  },
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));

import { creditCoinPurchase } from '../wallet';

const PACK = { productId: 'shams_coins_30', orderId: 'GPA.1', amountMilli: 30_000 };

beforeEach(() => {
  store.clear();
  ledger.length = 0;
});

describe('creditCoinPurchase', () => {
  it('credits the pack, binds the token and writes a purchase ledger entry', async () => {
    store.set('wallets/u', { balanceMilli: 2_500 });
    const r = await creditCoinPurchase('u', 'hash-1', PACK);
    expect(r).toEqual({ status: 'credited', creditedMilli: 30_000, balanceMilli: 32_500 });
    expect(store.get('purchaseTokens/hash-1')).toMatchObject({
      userId: 'u',
      kind: 'coins',
      productId: 'shams_coins_30',
      creditedMilli: 30_000,
    });
    expect(ledger).toEqual([
      expect.objectContaining({ type: 'purchase', amountMilli: 30_000, balanceAfterMilli: 32_500 }),
    ]);
  });

  it('starts an empty wallet at the pack amount', async () => {
    const r = await creditCoinPurchase('new', 'hash-2', PACK);
    expect(r).toEqual({ status: 'credited', creditedMilli: 30_000, balanceMilli: 30_000 });
  });

  it('never credits the same purchase twice', async () => {
    await creditCoinPurchase('u', 'hash-1', PACK);
    const again = await creditCoinPurchase('u', 'hash-1', PACK);
    expect(again).toEqual({ status: 'already_credited', balanceMilli: 30_000 });
    expect(ledger).toHaveLength(1);
  });

  it('refuses a token already redeemed by another account', async () => {
    await creditCoinPurchase('u', 'hash-1', PACK);
    const other = await creditCoinPurchase('someone-else', 'hash-1', PACK);
    expect(other).toEqual({ status: 'other_account' });
    expect(store.has('wallets/someone-else')).toBe(false);
  });

  it('rejects a non-positive or fractional amount', async () => {
    await expect(creditCoinPurchase('u', 'h', { ...PACK, amountMilli: 0 })).rejects.toThrow();
    await expect(creditCoinPurchase('u', 'h', { ...PACK, amountMilli: 1.5 })).rejects.toThrow();
  });
});
