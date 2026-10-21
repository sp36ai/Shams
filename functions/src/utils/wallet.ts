/**
 * wallet.ts — the seeker's coin balance, in integer millicoins.
 *
 * Firestore:
 *   /wallets/{uid}                 { balanceMilli, updatedAt }
 *   /wallets/{uid}/ledger/{auto}   { type, amountMilli, balanceAfterMilli,
 *                                    readingId?, tokens?, note?, createdAt }
 * Both are server-only (firestore.rules): the client can read its own wallet
 * and ledger and never write either. Every change to a balance writes a
 * ledger entry in the same transaction, so the ledger always explains the
 * balance.
 *
 * Amounts are integers (1 coin = 1000 milli) so no rounding drifts.
 */

import type { Transaction, DocumentReference } from 'firebase-admin/firestore';
import { db, FieldValue } from './admin';
import { TOKENS_PER_MILLICOIN } from '../config';
import { assertAccountActive } from './accountState';

export type LedgerType =
  | 'grant' // added by an admin (testing, goodwill)
  | 'purchase' // bought through Google Play (coin pack)
  | 'spend_question' // an extra question beyond the free one
  | 'spend_discussion' // a discussion reply, priced by tokens
  | 'refund'; // a charge given back because the thing it paid for failed

export interface WalletDoc {
  balanceMilli: number;
}

export function walletRef(userId: string): DocumentReference {
  return db.collection('wallets').doc(userId);
}

/** Balance from a wallet snapshot's data (a missing wallet is an empty one). */
export function balanceOf(data: unknown): number {
  const b = (data as Partial<WalletDoc> | undefined)?.balanceMilli;
  return typeof b === 'number' && Number.isFinite(b) ? b : 0;
}

/**
 * Write a new balance and its ledger entry inside a transaction the caller
 * already holds (and has already read the wallet in).
 */
export function writeBalance(
  tx: Transaction,
  userId: string,
  newBalanceMilli: number,
  entry: {
    type: LedgerType;
    amountMilli: number;
    readingId?: string;
    tokens?: number;
    note?: string;
  },
): void {
  const ref = walletRef(userId);
  tx.set(
    ref,
    { balanceMilli: newBalanceMilli, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  tx.set(ref.collection('ledger').doc(), {
    ...entry,
    balanceAfterMilli: newBalanceMilli,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** Price of a discussion turn that used `tokens` model tokens, in millicoins. */
export function discussionCostMilli(tokens: number): number {
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return 0;
  }
  return Math.ceil(tokens / TOKENS_PER_MILLICOIN);
}

export async function getBalanceMilli(userId: string): Promise<number> {
  const snap = await walletRef(userId).get();
  return snap.exists ? balanceOf(snap.data()) : 0;
}

/**
 * Charge a served discussion reply. Never takes the balance below zero: the
 * turn was only started with at least MIN_DISCUSSION_BALANCE_MILLI, and if a
 * long reply costs more than what is left, the remainder is absorbed rather
 * than leaving the seeker in debt.
 */
export async function chargeDiscussion(
  userId: string,
  readingId: string,
  tokens: number,
): Promise<{ chargedMilli: number; balanceMilli: number }> {
  const cost = discussionCostMilli(tokens);
  return db.runTransaction(async tx => {
    await assertAccountActive(tx, userId);
    const snap = await tx.get(walletRef(userId));
    const balance = snap.exists ? balanceOf(snap.data()) : 0;
    const charged = Math.min(cost, Math.max(0, balance));
    const after = balance - charged;
    if (charged > 0) {
      writeBalance(tx, userId, after, {
        type: 'spend_discussion',
        amountMilli: -charged,
        readingId,
        tokens,
      });
    }
    return { chargedMilli: charged, balanceMilli: after };
  });
}

/** Add coins (admin grant, purchase or refund). `amountMilli` must be positive. */
export async function creditWallet(
  userId: string,
  amountMilli: number,
  type: Extract<LedgerType, 'grant' | 'purchase' | 'refund'>,
  extra: { readingId?: string; note?: string } = {},
): Promise<number> {
  if (!Number.isInteger(amountMilli) || amountMilli <= 0) {
    throw new Error('creditWallet: amount must be a positive integer of millicoins');
  }
  return db.runTransaction(async tx => {
    await assertAccountActive(tx, userId);
    const snap = await tx.get(walletRef(userId));
    const after = (snap.exists ? balanceOf(snap.data()) : 0) + amountMilli;
    writeBalance(tx, userId, after, { type, amountMilli, ...extra });
    return after;
  });
}
