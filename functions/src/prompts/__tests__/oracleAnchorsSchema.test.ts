import { describe, it, expect, vi } from 'vitest';
import {
  OracleAnchorsSchema,
  parseOracleAnchors,
  sanitiseOracleAnchors,
  validateOracleAnchors,
} from '../oracleAnchorsSchema';
import type { OracleAnchors } from '../oracleAnchors';

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const VALID: OracleAnchors = {
  verdict: 'DELAY',
  confidence: 'HIGH',
  condition: 'Stambhana',
  primaryTheme: 'DELAY',
  obstruction: 'Saturn',
  secondaryTheme: 'ENVIRONMENTAL_FRICTION',
  timing: '1-6 months',
  direction: 'South',
  reversal: 'POSSIBLE',
  rulerClash: 'CLASH',
  controllerStyle: 'CAUTIOUS_ADMINISTRATIVE',
};

describe('OracleAnchorsSchema', () => {
  it('accepts a well-formed anchor set', () => {
    expect(OracleAnchorsSchema.safeParse(VALID).success).toBe(true);
  });

  it('accepts UNCLEAR timing', () => {
    expect(OracleAnchorsSchema.safeParse({ ...VALID, timing: 'UNCLEAR' }).success).toBe(true);
  });

  it.each(['days', 'weeks', 'months', 'years'])('accepts a %s window', unit => {
    expect(OracleAnchorsSchema.safeParse({ ...VALID, timing: `2-9 ${unit}` }).success).toBe(true);
  });

  it('rejects a malformed timing string that would become a fabricated date', () => {
    for (const bad of ['NaN-NaN months', 'soon', '3 months', '1-6', '1-6 fortnights', '']) {
      expect(OracleAnchorsSchema.safeParse({ ...VALID, timing: bad }).success).toBe(false);
    }
  });

  it('rejects an obstruction outside the closed enum', () => {
    // The Sun is a natural malefic in this engine but has no slot in the
    // material's enum — the schema must catch it if one ever leaks through.
    expect(OracleAnchorsSchema.safeParse({ ...VALID, obstruction: 'Sun' }).success).toBe(false);
  });

  it('rejects an unknown condition state', () => {
    expect(OracleAnchorsSchema.safeParse({ ...VALID, condition: 'Moksha' }).success).toBe(false);
  });

  it('rejects an eight-point compass direction', () => {
    expect(OracleAnchorsSchema.safeParse({ ...VALID, direction: 'North-East' }).success).toBe(
      false,
    );
  });

  it('parseOracleAnchors throws on a violation', () => {
    expect(() => parseOracleAnchors({ ...VALID, reversal: 'MAYBE' })).toThrow();
  });
});

describe('validateOracleAnchors — fail-open guard', () => {
  it('returns true for valid anchors', () => {
    expect(validateOracleAnchors(VALID, 'reading-1')).toBe(true);
  });

  it('returns false but does not throw for invalid anchors', () => {
    const bad = { ...VALID, timing: 'sometime soon' } as OracleAnchors;
    expect(() => validateOracleAnchors(bad, 'reading-2')).not.toThrow();
    expect(validateOracleAnchors(bad, 'reading-2')).toBe(false);
  });
});

describe('sanitiseOracleAnchors — fail-SAFE repair', () => {
  it('passes valid anchors through untouched, repairing nothing', () => {
    const { anchors, repaired } = sanitiseOracleAnchors(VALID, 'r1');
    expect(repaired).toEqual([]);
    expect(anchors).toEqual(VALID);
  });

  it('repairs only the offending field and keeps every good one', () => {
    const bad = { ...VALID, timing: 'NaN-NaN months' } as OracleAnchors;
    const { anchors, repaired } = sanitiseOracleAnchors(bad, 'r2');
    expect(repaired).toEqual(['timing']);
    expect(anchors.timing).toBe('UNCLEAR');
    // Everything else survives — one bad anchor costs one sentence, not the
    // whole reading.
    expect(anchors.verdict).toBe('DELAY');
    expect(anchors.obstruction).toBe('Saturn');
    expect(anchors.direction).toBe('South');
  });

  it('repairs several fields at once', () => {
    const bad = {
      ...VALID,
      verdict: 'MAYBE',
      obstruction: 'Sun',
      reversal: 'PERHAPS',
    } as unknown as OracleAnchors;
    const { anchors, repaired } = sanitiseOracleAnchors(bad, 'r3');
    expect([...repaired].sort()).toEqual(['obstruction', 'reversal', 'verdict']);
    expect(anchors.verdict).toBe('INCONCLUSIVE');
    expect(anchors.obstruction).toBe('NONE');
    expect(anchors.reversal).toBe('NONE');
    expect(anchors.confidence).toBe('HIGH'); // untouched
  });

  it('never repairs a verdict into a confident yes or no', () => {
    for (const junk of ['YES', 'NO', '', null, undefined, 42]) {
      const { anchors } = sanitiseOracleAnchors(
        { ...VALID, verdict: junk } as unknown as OracleAnchors,
        'r4',
      );
      expect(anchors.verdict).toBe('INCONCLUSIVE');
      expect(anchors.confidence).not.toBe('VERY_HIGH');
    }
  });

  it('always returns something the schema accepts, even from total garbage', () => {
    const { anchors } = sanitiseOracleAnchors({} as unknown as OracleAnchors, 'r5');
    expect(OracleAnchorsSchema.safeParse(anchors).success).toBe(true);
    expect(anchors.verdict).toBe('INCONCLUSIVE');
    expect(anchors.timing).toBe('UNCLEAR');
  });

  it('does not throw on malformed input', () => {
    expect(() => sanitiseOracleAnchors(null as unknown as OracleAnchors, 'r6')).not.toThrow();
  });
});
