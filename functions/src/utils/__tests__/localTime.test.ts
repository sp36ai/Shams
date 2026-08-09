import { describe, it, expect } from 'vitest';

import { localIsoFromOffset } from '../localTime';
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
