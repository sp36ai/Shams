import { formatCoins, useWalletStore } from '../walletStore';

describe('formatCoins', () => {
  it('shows coins with one decimal', () => {
    expect(formatCoins(12_300)).toBe('12.3');
    expect(formatCoins(3000)).toBe('3.0');
    expect(formatCoins(0)).toBe('0.0');
  });
  it('rounds down, so it never shows more than the wallet holds', () => {
    expect(formatCoins(999)).toBe('0.9');
    expect(formatCoins(1099)).toBe('1.0');
  });
});

describe('useWalletStore', () => {
  it('starts unknown and takes server values', () => {
    useWalletStore.getState().reset();
    expect(useWalletStore.getState().balanceMilli).toBeNull();
    useWalletStore.getState().update({ mode: 'coins', balanceMilli: 4200 });
    expect(useWalletStore.getState()).toMatchObject({ mode: 'coins', balanceMilli: 4200 });
  });
});
