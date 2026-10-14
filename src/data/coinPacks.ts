/**
 * Coin packs sold through Google Play as consumable in-app products (owner
 * decision 2026-10-14): ₹10 per coin, no bonuses. Must match COIN_PACKS in
 * functions/src/config.ts, which decides what is credited.
 */

export interface CoinPack {
  sku: string;
  coins: number;
}

export const COIN_PACKS: readonly CoinPack[] = [
  { sku: 'shams_coins_10', coins: 10 },
  { sku: 'shams_coins_30', coins: 30 },
  { sku: 'shams_coins_100', coins: 100 },
];

export const COIN_SKUS: readonly string[] = COIN_PACKS.map(p => p.sku);

export function isCoinSku(sku: string): boolean {
  return COIN_SKUS.includes(sku);
}
