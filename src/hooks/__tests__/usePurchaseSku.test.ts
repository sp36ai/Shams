/**
 * The plan → Play product mapping. premium_monthly is the one plan sold
 * (₹299/month); the older SKUs stay so existing subscribers still restore.
 */

import { SKU_MAP } from '../usePurchase';

describe('SKU_MAP', () => {
  it('sells Premium as the shams_premium_monthly product', () => {
    expect(SKU_MAP.premium_monthly).toBe('shams_premium_monthly');
  });

  it('keeps the legacy subscription products', () => {
    expect(SKU_MAP).toMatchObject({
      mureed_monthly: 'mureed_monthly',
      khass_monthly: 'khass_monthly',
    });
  });
});
