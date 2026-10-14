/**
 * wallet — discussion pricing (1 coin per 10,000 tokens) and the rule that a
 * charge never takes the balance below zero; every change writes a ledger
 * entry. Firestore is faked at the module boundary.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

type Doc = Record<string, unknown>;
const wallets = new Map<string, Doc>();
const ledger: Doc[] = [];

vi.mock('../admin', () => ({
  db: {
    collection: () => ({
      doc: (id: string) => ({
        id,
        get: () => Promise.resolve({ exists: wallets.has(id), data: () => wallets.get(id) }),
        collection: () => ({ doc: () => ({ isLedger: true }) }),
      }),
    }),
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: (ref: { get: () => Promise<unknown> }) => ref.get(),
        set: (ref: { id?: string; isLedger?: boolean }, value: Doc, opts?: { merge?: boolean }) => {
          if (ref.isLedger === true) {
            ledger.push(value);
            return;
          }
          const prior = wallets.get(ref.id!);
          wallets.set(ref.id!, opts?.merge === true ? { ...prior, ...value } : value);
        },
      }),
  },
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));

import { chargeDiscussion, creditWallet, discussionCostMilli } from '../wallet';
import { tokensFromUsage } from '../../oracle/discussionComposer';

beforeEach(() => {
  wallets.clear();
  ledger.length = 0;
});

describe('discussionCostMilli', () => {
  it('prices 10,000 tokens at exactly 1 coin', () => {
    expect(discussionCostMilli(10_000)).toBe(1000);
  });
  it('rounds part-millicoins up and charges nothing for no tokens', () => {
    expect(discussionCostMilli(7_001)).toBe(701);
    expect(discussionCostMilli(0)).toBe(0);
    expect(discussionCostMilli(Number.NaN)).toBe(0);
  });
});

describe('tokensFromUsage', () => {
  it('adds input, output and cache tokens from the API usage object', () => {
    expect(
      tokensFromUsage({
        input_tokens: 5000,
        output_tokens: 1200,
        cache_read_input_tokens: 300,
        cache_creation_input_tokens: 0,
      }),
    ).toBe(6500);
  });
  it('is 0 for a missing or malformed usage object', () => {
    expect(tokensFromUsage(undefined)).toBe(0);
    expect(tokensFromUsage({ input_tokens: 'many' })).toBe(0);
  });
});

describe('chargeDiscussion', () => {
  it('charges the tokens used and records it in the ledger', async () => {
    wallets.set('u', { balanceMilli: 5000 });
    const r = await chargeDiscussion('u', 'reading-1', 7000);
    expect(r).toEqual({ chargedMilli: 700, balanceMilli: 4300 });
    expect(ledger).toEqual([
      expect.objectContaining({
        type: 'spend_discussion',
        amountMilli: -700,
        balanceAfterMilli: 4300,
        readingId: 'reading-1',
        tokens: 7000,
      }),
    ]);
  });

  it('never takes the balance below zero', async () => {
    wallets.set('u', { balanceMilli: 400 });
    const r = await chargeDiscussion('u', 'reading-1', 9000);
    expect(r).toEqual({ chargedMilli: 400, balanceMilli: 0 });
  });
});

describe('creditWallet', () => {
  it('adds coins with a ledger entry', async () => {
    expect(await creditWallet('u', 10_000, 'grant', { note: 'tester' })).toBe(10_000);
    expect(ledger[0]).toMatchObject({
      type: 'grant',
      amountMilli: 10_000,
      balanceAfterMilli: 10_000,
    });
  });
  it('refuses a non-positive or fractional amount', async () => {
    await expect(creditWallet('u', 0, 'grant')).rejects.toThrow();
    await expect(creditWallet('u', 1.5, 'grant')).rejects.toThrow();
  });
});
