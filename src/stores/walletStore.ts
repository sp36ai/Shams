/**
 * walletStore — the coin economy as the server last reported it.
 *
 * Display only. Every value here comes from the server (getQuota, and the
 * balance a paid discussion reply returns); the client never computes a
 * balance or decides a price. `null` means "not known yet" — the UI shows a
 * dash, never a made-up number.
 *
 * mode: 'coins' when the server applies the coin economy to this seeker,
 * 'legacy' when it still applies the older daily-quota rules, null before the
 * first answer (or from a server that predates the coin economy).
 */

import { create } from 'zustand';

export type MonetizationMode = 'legacy' | 'coins';

export interface WalletState {
  mode: MonetizationMode | null;
  /** Coins in millicoins (1 coin = 1000 = ₹10). */
  balanceMilli: number | null;
  /** Free plan, coins mode: when the next free question is available (null = now). */
  nextFreeAt: string | null;
  /** Free plan, coins mode: price of an extra question, in millicoins. */
  questionCostMilli: number | null;
  update: (partial: Partial<Omit<WalletState, 'update' | 'reset'>>) => void;
  reset: () => void;
}

const EMPTY = {
  mode: null,
  balanceMilli: null,
  nextFreeAt: null,
  questionCostMilli: null,
} as const;

export const useWalletStore = create<WalletState>(set => ({
  ...EMPTY,
  update: partial => set(partial),
  reset: () => set({ ...EMPTY }),
}));

/** Millicoins as a coin amount with one decimal, e.g. 12300 → "12.3". */
export function formatCoins(milli: number): string {
  const coins = Math.floor(milli / 100) / 10; // round down: never show more than is there
  return coins.toFixed(1);
}
