import { deviceUtcOffsetMinutes, newRequestId } from '../firebase/watchOracle';

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

/**
 * newRequestId — identifies one act of asking.
 *
 * It only has to be unique within a single user's own history and carry
 * nothing about them; these two properties are the whole contract.
 */
describe('newRequestId', () => {
  it('is long enough that two submissions never collide in practice', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newRequestId()));
    expect(ids.size).toBe(2000);
    for (const id of ids) {
      expect(id.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('carries nothing but randomness', () => {
    expect(newRequestId()).toMatch(/^[a-z0-9]+$/);
  });
});
