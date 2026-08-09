import { deviceUtcOffsetMinutes } from '../firebase/watchOracle';

/**
 * getTimezoneOffset reports minutes to ADD to local time to reach UTC, which is
 * the opposite sign from the offset written in an ISO string. A sign error here
 * is silent and would select a bracket from the wrong side of UTC entirely, so
 * it is pinned.
 */
describe('deviceUtcOffsetMinutes', () => {
  function at(getTimezoneOffset: number): Date {
    return { getTimezoneOffset: () => getTimezoneOffset } as unknown as Date;
  }

  it('flips the sign of getTimezoneOffset', () => {
    // IST is +05:30, and getTimezoneOffset() returns -330 there.
    expect(deviceUtcOffsetMinutes(at(-330))).toBe(330);
    // New York in winter is -05:00, where getTimezoneOffset() returns 300.
    expect(deviceUtcOffsetMinutes(at(300))).toBe(-300);
  });

  it('leaves UTC at zero', () => {
    expect(deviceUtcOffsetMinutes(at(0))).toBe(0);
  });

  it('stays inside the range the server accepts', () => {
    for (const tzOffset of [-840, -330, -345, 0, 300, 720]) {
      const offset = deviceUtcOffsetMinutes(at(tzOffset));
      expect(offset).toBeGreaterThanOrEqual(-720);
      expect(offset).toBeLessThanOrEqual(840);
      // JS remainder takes the dividend's sign, so -300 % 15 is -0. Compare magnitude.
      expect(Math.abs(offset % 15)).toBe(0);
    }
  });
});
