import { describe, it, expect } from 'vitest';

import { MANAZIL_AL_QAMAR, getManzila, getManzilaDisplay } from '../manazil';

/**
 * `manazil.ts` is a mirror of `src/astrology/manazil.ts` (PHASE 5B-R sync
 * invariant) kept only so `verify-engine-sync` has something to compare
 * against — the client screen that actually renders it lives outside
 * `functions/`. These tests aren't exercising a server code path; they
 * pin the data-integrity invariants a mistranscribed station would break
 * (28 stations, ascending non-overlapping degree ranges spanning a full
 * circle) and the two lookup functions Oracle narration composition
 * would call if it ever surfaces this server-side.
 */
describe('MANAZIL_AL_QAMAR data integrity', () => {
  it('has exactly 28 stations, numbered 1..28 in order', () => {
    expect(MANAZIL_AL_QAMAR).toHaveLength(28);
    MANAZIL_AL_QAMAR.forEach((m, i) => {
      expect(m.number).toBe(i + 1);
    });
  });

  it('starts at 0 degrees and each station is 360/28 degrees wide', () => {
    const width = 360 / 28;
    expect(MANAZIL_AL_QAMAR[0]!.startDegree).toBe(0);
    for (let i = 1; i < MANAZIL_AL_QAMAR.length; i++) {
      const expected = width * i;
      expect(MANAZIL_AL_QAMAR[i]!.startDegree).toBeCloseTo(expected, 2);
    }
  });

  it('every station has non-empty name, arabic, stars, and both narration fields', () => {
    for (const m of MANAZIL_AL_QAMAR) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.arabic.length).toBeGreaterThan(0);
      expect(m.stars.length).toBeGreaterThan(0);
      expect(m.oracleDescriptor.length).toBeGreaterThan(0);
      expect(m.oracleVoice.length).toBeGreaterThan(0);
      expect(m.confirmedTheme.length).toBeGreaterThan(0);
      expect(m.deniedTheme.length).toBeGreaterThan(0);
      expect(['benefic', 'malefic', 'mixed']).toContain(m.nature);
      expect(['fire', 'earth', 'air', 'water']).toContain(m.element);
    }
  });
});

describe('getManzila', () => {
  it('returns station 1 at the start of Aries (0°)', () => {
    expect(getManzila(0).number).toBe(1);
  });

  it('returns station 1 just before its upper boundary', () => {
    expect(getManzila(360 / 28 - 0.001).number).toBe(1);
  });

  it('returns station 2 just past its lower boundary', () => {
    // Exactly on the 360/28 boundary is float-imprecision-sensitive
    // (division doesn't round-trip exactly), so this checks just inside
    // station 2's range rather than the boundary itself.
    expect(getManzila(360 / 28 + 0.001).number).toBe(2);
  });

  it('returns the final station (28) just before the circle closes', () => {
    expect(getManzila(359.999).number).toBe(28);
  });

  it('wraps negative longitudes into [0, 360)', () => {
    expect(getManzila(-1).number).toBe(getManzila(359).number);
  });

  it('wraps longitudes past 360 the same as their mod-360 equivalent', () => {
    expect(getManzila(370).number).toBe(getManzila(10).number);
  });
});

describe('getManzilaDisplay', () => {
  it('exposes only display-safe fields, matching the underlying station', () => {
    const full = getManzila(100);
    const display = getManzilaDisplay(100);

    expect(display).toEqual({
      name: full.name,
      arabic: full.arabic,
      descriptor: full.oracleDescriptor,
      number: full.number,
    });
  });

  it('never exposes oracleVoice, confirmedTheme, or deniedTheme', () => {
    const display = getManzilaDisplay(200) as Record<string, unknown>;
    expect(display.oracleVoice).toBeUndefined();
    expect(display.confirmedTheme).toBeUndefined();
    expect(display.deniedTheme).toBeUndefined();
  });
});
