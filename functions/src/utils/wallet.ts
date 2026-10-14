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

export type CoinPurchaseCredit =
  | { status: 'credited'; creditedMilli: number; balanceMilli: number }
  | { status: 'already_credited'; balanceMilli: number }
  | { status: 'other_account' };

/**
 * Credit a Google Play coin pack exactly once. The purchase token (hashed) is
 * bound to the buyer in /purchaseTokens in the same transaction as the
 * credit, so verifying the same purchase again — a retry, a reinstall, the
 * app's recovery of an unfinished purchase — never credits twice, and a
 * token can never be redeemed by a second account.
 */
export async function creditCoinPurchase(
  userId: string,
  tokenHash: string,
  purchase: { productId: string; orderId: string; amountMilli: number },
): Promise<CoinPurchaseCredit> {
  if (!Number.isInteger(purchase.amountMilli) || purchase.amountMilli <= 0) {
    throw new Error('creditCoinPurchase: amount must be a positive integer of millicoins');
  }
  const tokenRef = db.collection('purchaseTokens').doc(tokenHash);
  return db.runTransaction(async tx => {
    const tokenSnap = await tx.get(tokenRef);
    const walletSnap = await tx.get(walletRef(userId));
    const balance = walletSnap.exists ? balanceOf(walletSnap.data()) : 0;
    if (tokenSnap.exists) {
      const boundUserId = (tokenSnap.data() as { userId?: unknown } | undefined)?.userId;
      return boundUserId === userId
        ? { status: 'already_credited', balanceMilli: balance }
        : { status: 'other_account' };
    }
    tx.set(tokenRef, {
      userId,
      kind: 'coins',
      productId: purchase.productId,
      orderId: purchase.orderId,
      creditedMilli: purchase.amountMilli,
      boundAt: FieldValue.serverTimestamp(),
    });
    const after = balance + purchase.amountMilli;
    writeBalance(tx, userId, after, {
      type: 'purchase',
      amountMilli: purchase.amountMilli,
      note: `${purchase.productId} ${purchase.orderId}`,
    });
    return { status: 'credited', creditedMilli: purchase.amountMilli, balanceMilli: after };
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
    const snap = await tx.get(walletRef(userId));
    const after = (snap.exists ? balanceOf(snap.data()) : 0) + amountMilli;
    writeBalance(tx, userId, after, { type, amountMilli, ...extra });
    return after;
  });
}
