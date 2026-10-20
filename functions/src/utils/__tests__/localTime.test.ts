import { describe, it, expect } from 'vitest';

import { CLIENT_CLOCK_TOLERANCE_MS, chooseAskedInstant, localIsoFromOffset } from '../localTime';
import { watchWindowFromIso } from '../../engine/rkp/watchGrid';

describe('localIsoFromOffset', () => {
  it('renders the offset in the standard form', () => {
    const instant = new Date('2026-08-08T05:43:00Z');
    expect(localIsoFromOffset(instant, 330)).toBe('2026-08-08T11:13:00+05:30');
    expect(localIsoFromOffset(instant, 0)).toBe('2026-08-08T05:43:00+00:00');
  });

  it('handles the half- and quarter-hour zones', () => {
    const instant = new Date('2026-08-08T06:00:00Z');
    expect(localIsoFromOffset(instant, 345)).toBe('2026-08-08T11:45:00+05:45'); // Nepal
    expect(localIsoFromOffset(instant, -210)).toBe('2026-08-08T02:30:00-03:30'); // Newfoundland
  });

  it('handles the extremes of the civil offset range', () => {
    const instant = new Date('2026-08-08T12:00:00Z');
    expect(localIsoFromOffset(instant, -720)).toBe('2026-08-08T00:00:00-12:00');
    expect(localIsoFromOffset(instant, 840)).toBe('2026-08-09T02:00:00+14:00');
  });

  it('rolls the date when the offset crosses midnight', () => {
    expect(localIsoFromOffset(new Date('2026-08-08T20:00:00Z'), 330)).toBe(
      '2026-08-09T01:30:00+05:30',
    );
    expect(localIsoFromOffset(new Date('2026-01-01T02:00:00Z'), -300)).toBe(
      '2025-12-31T21:00:00-05:00',
    );
  });
});

describe('the minute the engine actually selects on', () => {
  /**
   * The whole point of the offset round-trip. The server's own UTC minute is 43;
   * the querent in IST is looking at :13. Reading the server's clock directly
   * would select bracket 8 (Burj Qaus) instead of bracket 2 (Burj Jauza).
   */
  it("selects on the querent's watch minute, not the server's UTC minute", () => {
    const instant = new Date('2026-08-08T05:43:00Z');
    expect(instant.getUTCMinutes()).toBe(43);

    const window = watchWindowFromIso(localIsoFromOffset(instant, 330));
    expect(window.minute).toBe(13);
    expect(window.bracket).toBe(2);
    expect(window.lagnaSign).toBe(3); // Jauza

    // What reading the server clock directly would have given.
    const wrong = watchWindowFromIso(localIsoFromOffset(instant, 0));
    expect(wrong.lagnaSign).toBe(9); // Qaus — a different reading entirely
  });

  it('gives two querents in different zones different frames at one instant', () => {
    const instant = new Date('2026-08-08T05:43:00Z');
    const india = watchWindowFromIso(localIsoFromOffset(instant, 330));
    const nepal = watchWindowFromIso(localIsoFromOffset(instant, 345));

    expect(india.minute).toBe(13);
    expect(nepal.minute).toBe(28);
    expect(india.lagnaSign).not.toBe(nepal.lagnaSign);
  });

  it('produces a string the grid can always parse', () => {
    for (let offset = -720; offset <= 840; offset += 15) {
      const iso = localIsoFromOffset(new Date('2026-08-08T05:43:00Z'), offset);
      expect(() => watchWindowFromIso(iso)).not.toThrow();
    }
  });
});

describe('chooseAskedInstant (owner decision OD-002, S1)', () => {
  // 11:13 on the server; a phone in +05:30 shows 11:13 as well.
  const serverNow = new Date('2026-08-08T05:43:30Z');

  it("uses the phone's tap-Send minute when it is close to the server clock", () => {
    // Tapped at 05:43:50 local-equivalent; the request reached the server 20 s later, at 05:44:10.
    const tapped = new Date('2026-08-08T05:43:50Z').getTime();
    const received = new Date('2026-08-08T05:44:10Z');
    const asked = chooseAskedInstant(received, tapped);
    expect(asked.getTime()).toBe(tapped);
    expect(watchWindowFromIso(localIsoFromOffset(asked, 330)).minute).toBe(13);
    // The server's own minute (14) would have been the same bracket here, but
    // a tap at :29:50 delivered at :30:10 must stay in the earlier bracket:
    const tappedAt29 = new Date('2026-08-08T05:29:50Z').getTime();
    const receivedAt30 = new Date('2026-08-08T05:30:10Z');
    expect(
      watchWindowFromIso(localIsoFromOffset(chooseAskedInstant(receivedAt30, tappedAt29), 0))
        .minute,
    ).toBe(29);
    expect(watchWindowFromIso(localIsoFromOffset(receivedAt30, 0)).minute).toBe(30);
  });

  it('accepts exactly the tolerance and rejects anything beyond it', () => {
    const edge = serverNow.getTime() - CLIENT_CLOCK_TOLERANCE_MS;
    expect(chooseAskedInstant(serverNow, edge).getTime()).toBe(edge);
    const tooFar = serverNow.getTime() - CLIENT_CLOCK_TOLERANCE_MS - 1;
    expect(chooseAskedInstant(serverNow, tooFar)).toBe(serverNow);
    const future = serverNow.getTime() + CLIENT_CLOCK_TOLERANCE_MS + 1;
    expect(chooseAskedInstant(serverNow, future)).toBe(serverNow);
  });

  it('falls back to the server time when the phone sends nothing usable', () => {
    expect(chooseAskedInstant(serverNow, undefined)).toBe(serverNow);
    expect(chooseAskedInstant(serverNow, Number.NaN)).toBe(serverNow);
    expect(chooseAskedInstant(serverNow, Number.POSITIVE_INFINITY)).toBe(serverNow);
  });

  it('a wrong device clock or a hand-picked minute cannot move the bracket by more than the tolerance', () => {
    const wrongClock = serverNow.getTime() + 60 * 60_000; // an hour fast
    expect(chooseAskedInstant(serverNow, wrongClock)).toBe(serverNow);
  });
});
