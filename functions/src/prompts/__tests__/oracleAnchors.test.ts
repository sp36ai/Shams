import { describe, it, expect } from 'vitest';
import { confidenceBand, deriveOracleAnchors } from '../oracleAnchors';
import type { WatchVerdict } from '../../engine/types/watchVerdict';

// Minimal fixture: deriveOracleAnchors() only reads a specific subset of
// WatchVerdict fields, so the fixture only needs those populated — cast
// through `unknown` since the rest of the real shape (chart, watch, etc.)
// is irrelevant to this pure translation function.
function makeVerdict(overrides: {
  nativeState?: WatchVerdict['nativeState'];
  confidence?: number;
  dignity?: 'exalted' | 'own' | 'debilitated' | 'neutral';
  conjunctObstruction?: string[];
  aspectObstruction?: string[];
  direction?: string;
  retrograde?: boolean;
  moonAgreement?: 'agrees' | 'disagrees' | 'neutral';
  denialWitnesses?: string[];
  afflictedDirections?: string[];
  timing?: { window: string; range: { min: number; max: number } };
}): WatchVerdict {
  return {
    nativeState: overrides.nativeState ?? 'YES_STRONG',
    confidence: overrides.confidence ?? 80,
    houseLord: {
      dignity: overrides.dignity ?? 'own',
      conjunctObstruction: overrides.conjunctObstruction ?? [],
      aspectObstruction: overrides.aspectObstruction ?? [],
      direction: overrides.direction ?? 'North',
      retrograde: overrides.retrograde ?? false,
    },
    moonConfirmation: {
      agreement: overrides.moonAgreement ?? 'agrees',
    },
    rulingConfirmation: {
      denialWitnesses: overrides.denialWitnesses ?? [],
    },
    vastu: {
      afflictedDirections: overrides.afflictedDirections ?? [],
    },
    timing: overrides.timing,
  } as unknown as WatchVerdict;
}

describe('confidenceBand', () => {
  it.each([
    [100, 'VERY_HIGH'],
    [75, 'VERY_HIGH'],
    [74, 'HIGH'],
    [50, 'HIGH'],
    [49, 'MODERATE'],
    [25, 'MODERATE'],
    [24, 'LOW'],
    [10, 'LOW'],
    [9, 'UNCERTAIN'],
    [0, 'UNCERTAIN'],
  ])('confidence %i -> %s', (confidence, band) => {
    expect(confidenceBand(confidence)).toBe(band);
  });
});

describe('deriveOracleAnchors', () => {
  it('YES_STRONG with own-sign lord -> STRONG_OPENING, no obstruction', () => {
    const anchors = deriveOracleAnchors(
      makeVerdict({ nativeState: 'YES_STRONG', dignity: 'own', confidence: 100 }),
    );
    expect(anchors.verdict).toBe('YES_STRONG');
    expect(anchors.confidence).toBe('VERY_HIGH');
    expect(anchors.primaryTheme).toBe('STRONG_OPENING');
    expect(anchors.obstruction).toBe('NONE');
    expect(anchors.reversal).toBe('NONE');
  });

  it('NO_DENIED with debilitated lord -> STRUCTURAL_BLOCKAGE', () => {
    const anchors = deriveOracleAnchors(
      makeVerdict({ nativeState: 'NO_DENIED', dignity: 'debilitated', confidence: 95 }),
    );
    expect(anchors.primaryTheme).toBe('STRUCTURAL_BLOCKAGE');
  });

  it('NO_DENIED with neutral dignity (conjunction/aspect obstruction) -> OBSTRUCTION, names the blocker', () => {
    const anchors = deriveOracleAnchors(
      makeVerdict({
        nativeState: 'NO_DENIED',
        dignity: 'neutral',
        conjunctObstruction: ['Saturn'],
      }),
    );
    expect(anchors.primaryTheme).toBe('OBSTRUCTION');
    expect(anchors.obstruction).toBe('Saturn');
  });

  it('DELAY -> primaryTheme DELAY, reversal POSSIBLE when the lord is retrograde', () => {
    const anchors = deriveOracleAnchors(makeVerdict({ nativeState: 'DELAY', retrograde: true }));
    expect(anchors.primaryTheme).toBe('DELAY');
    expect(anchors.reversal).toBe('POSSIBLE');
  });

  it('WAIT -> AMBIGUITY; INCONCLUSIVE -> UNCLEAR_SIGNAL', () => {
    expect(deriveOracleAnchors(makeVerdict({ nativeState: 'WAIT' })).primaryTheme).toBe(
      'AMBIGUITY',
    );
    expect(deriveOracleAnchors(makeVerdict({ nativeState: 'INCONCLUSIVE' })).primaryTheme).toBe(
      'UNCLEAR_SIGNAL',
    );
  });

  it('obstruction falls back to INNER_HESITATION when Moon disagrees and no planet blocks', () => {
    const anchors = deriveOracleAnchors(makeVerdict({ moonAgreement: 'disagrees' }));
    expect(anchors.obstruction).toBe('INNER_HESITATION');
  });

  it('obstruction falls back to a denial ruling witness when Moon is neutral', () => {
    const anchors = deriveOracleAnchors(
      makeVerdict({ moonAgreement: 'neutral', denialWitnesses: ['Mars'] }),
    );
    expect(anchors.obstruction).toBe('Mars');
  });

  it('secondaryTheme is ENVIRONMENTAL_FRICTION when the activated house direction is afflicted', () => {
    const anchors = deriveOracleAnchors(
      makeVerdict({ direction: 'East', afflictedDirections: ['East', 'North'] }),
    );
    expect(anchors.secondaryTheme).toBe('ENVIRONMENTAL_FRICTION');
    expect(anchors.direction).toBe('East');
  });

  it('secondaryTheme is INNER_CONFLICT when Moon disagrees and direction is clear', () => {
    const anchors = deriveOracleAnchors(
      makeVerdict({ moonAgreement: 'disagrees', direction: 'West', afflictedDirections: [] }),
    );
    expect(anchors.secondaryTheme).toBe('INNER_CONFLICT');
  });

  it('secondaryTheme is NONE when nothing complicates the reading', () => {
    const anchors = deriveOracleAnchors(makeVerdict({}));
    expect(anchors.secondaryTheme).toBe('NONE');
  });

  it('timing renders the window string when present, UNCLEAR when absent', () => {
    const withTiming = deriveOracleAnchors(
      makeVerdict({ timing: { window: 'months', range: { min: 1, max: 6 } } }),
    );
    expect(withTiming.timing).toBe('1-6 months');

    const withoutTiming = deriveOracleAnchors(makeVerdict({ timing: undefined }));
    expect(withoutTiming.timing).toBe('UNCLEAR');
  });
});
