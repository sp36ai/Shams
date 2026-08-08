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
  targetBlockingMalefics?: string[];
  targetSaturnPressure?: boolean;
  rulerRelation?: 'friend' | 'neutral' | 'enemy';
  controllerPolarity?: 'masculine' | 'feminine';
  conditionState?: string;
  lagnaRetrograde?: boolean;
  fulfilmentRetrograde?: boolean;
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
    conditionState: overrides.conditionState ?? 'Gati',
    triad: {
      targetPressure: {
        blockingMalefics: overrides.targetBlockingMalefics ?? [],
        saturnPressure: overrides.targetSaturnPressure ?? false,
      },
      rulerRelation: overrides.rulerRelation ?? 'neutral',
      controllerPolarity: overrides.controllerPolarity ?? 'masculine',
      lagna: { retrograde: overrides.lagnaRetrograde ?? false },
      target: { retrograde: overrides.retrograde ?? false },
      fulfilment: { retrograde: overrides.fulfilmentRetrograde ?? false },
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
    expect(anchors.obstruction).toBe('MOON_DISAGREEMENT');
  });

  it('obstruction collapses a denial ruling witness to the closed enum value', () => {
    // The witness's identity is not one of the four planets the material's
    // enum names, so it reports as DENIAL_WITNESS rather than leaking a
    // name the prompt has no rule for.
    const anchors = deriveOracleAnchors(
      makeVerdict({ moonAgreement: 'neutral', denialWitnesses: ['Venus'] }),
    );
    expect(anchors.obstruction).toBe('DENIAL_WITNESS');
  });

  it('obstruction follows the material Saturn -> Mars -> Rahu -> Ketu order', () => {
    expect(
      deriveOracleAnchors(
        makeVerdict({ targetSaturnPressure: true, targetBlockingMalefics: ['Mars', 'Rahu'] }),
      ).obstruction,
    ).toBe('Saturn');
    expect(
      deriveOracleAnchors(makeVerdict({ targetBlockingMalefics: ['Ketu', 'Mars'] })).obstruction,
    ).toBe('Mars');
    expect(
      deriveOracleAnchors(makeVerdict({ targetBlockingMalefics: ['Ketu', 'Rahu'] })).obstruction,
    ).toBe('Rahu');
  });

  it('an exalted lord on an open matter reads as RAPID_RESOLUTION', () => {
    expect(
      deriveOracleAnchors(makeVerdict({ nativeState: 'YES_STRONG', dignity: 'exalted' }))
        .primaryTheme,
    ).toBe('RAPID_RESOLUTION');
    expect(
      deriveOracleAnchors(makeVerdict({ nativeState: 'YES_STRONG', dignity: 'own' })).primaryTheme,
    ).toBe('STRONG_OPENING');
  });

  it('reversal is POSSIBLE when any triad ruler is retrograde, not just the target', () => {
    expect(deriveOracleAnchors(makeVerdict({ lagnaRetrograde: true })).reversal).toBe('POSSIBLE');
    expect(deriveOracleAnchors(makeVerdict({ fulfilmentRetrograde: true })).reversal).toBe(
      'POSSIBLE',
    );
    expect(deriveOracleAnchors(makeVerdict({ retrograde: true })).reversal).toBe('POSSIBLE');
  });

  it('reversal is IMPOSSIBLE only when a denial has nothing in motion to undo it', () => {
    expect(deriveOracleAnchors(makeVerdict({ nativeState: 'NO_DENIED' })).reversal).toBe(
      'IMPOSSIBLE',
    );
    // A denial with a retrograde ruler can still be overturned on appeal.
    expect(
      deriveOracleAnchors(makeVerdict({ nativeState: 'NO_DENIED', retrograde: true })).reversal,
    ).toBe('POSSIBLE');
    expect(deriveOracleAnchors(makeVerdict({ nativeState: 'WAIT' })).reversal).toBe('NONE');
  });

  it('carries the condition state through untouched', () => {
    expect(deriveOracleAnchors(makeVerdict({ conditionState: 'Kshaya' })).condition).toBe('Kshaya');
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

  it('a malefic on the house of the matter outranks one troubling its lord', () => {
    const anchors = deriveOracleAnchors(
      makeVerdict({
        nativeState: 'NO_DENIED',
        targetBlockingMalefics: ['Rahu'],
        conjunctObstruction: ['Saturn'],
      }),
    );
    expect(anchors.obstruction).toBe('Rahu');
  });

  it('rulerClash maps the natural friendship of the two rulers', () => {
    expect(deriveOracleAnchors(makeVerdict({ rulerRelation: 'enemy' })).rulerClash).toBe('CLASH');
    expect(deriveOracleAnchors(makeVerdict({ rulerRelation: 'friend' })).rulerClash).toBe(
      'ALIGNED',
    );
    expect(deriveOracleAnchors(makeVerdict({ rulerRelation: 'neutral' })).rulerClash).toBe(
      'NEUTRAL',
    );
  });

  it('controllerStyle carries only the behavioural half of the polarity profile', () => {
    expect(
      deriveOracleAnchors(makeVerdict({ controllerPolarity: 'masculine' })).controllerStyle,
    ).toBe('DIRECT_ASSERTIVE');
    expect(
      deriveOracleAnchors(makeVerdict({ controllerPolarity: 'feminine' })).controllerStyle,
    ).toBe('CAUTIOUS_ADMINISTRATIVE');
  });
});
