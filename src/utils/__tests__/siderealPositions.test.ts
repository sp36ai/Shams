import { MANAZIL_AL_QAMAR } from '@astrology/manazil';
import { manzilName, nakshatraName } from '@utils/siderealPositions';

// Sky Clock's Moon row shows the lunar mansion (28 equal divisions of
// 360°/28 ≈ 12.857°), not the 27-fold nakshatra split it used to show.
const SPAN = 360 / 28;

describe('manzilName (Sky Clock Moon row, display only)', () => {
  it('starts at mansion 1 at 0° and ends at mansion 28 just below 360°', () => {
    expect(manzilName(0)).toBe(MANAZIL_AL_QAMAR[0]!.name);
    expect(manzilName(359.999)).toBe(MANAZIL_AL_QAMAR[27]!.name);
  });

  it('changes mansion exactly at each 360/28 boundary', () => {
    for (let i = 1; i < 28; i++) {
      const boundary = i * SPAN;
      expect(manzilName(boundary - 1e-6)).toBe(MANAZIL_AL_QAMAR[i - 1]!.name);
      expect(manzilName(boundary + 1e-6)).toBe(MANAZIL_AL_QAMAR[i]!.name);
    }
  });

  it('wraps 360° and negative longitudes into range', () => {
    expect(manzilName(360)).toBe(MANAZIL_AL_QAMAR[0]!.name);
    expect(manzilName(-1e-6)).toBe(MANAZIL_AL_QAMAR[27]!.name);
  });

  it('uses 28 divisions, not the 27 of nakshatraName', () => {
    // 13° is before the first nakshatra boundary (13.333°) but past the
    // first mansion boundary (12.857°).
    expect(nakshatraName(13)).toBe(nakshatraName(0));
    expect(manzilName(13)).toBe(MANAZIL_AL_QAMAR[1]!.name);
  });

  it('always returns one of the 28 mansion names', () => {
    for (let lon = 0; lon < 360; lon += 0.5) {
      expect(MANAZIL_AL_QAMAR.map(m => m.name)).toContain(manzilName(lon));
    }
  });
});
