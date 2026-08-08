/**
 * rkpConditionState — the six-condition classification (Siddhi, Stambhana,
 * Gati, Vakra, Kshaya, Bija).
 *
 * These exercise the precedence ladder directly with hand-built TriadAnalysis
 * fixtures, so each rung can be isolated. End-to-end coverage against the
 * real engine lives in src/__tests__/judgeRKPWatch.test.ts.
 */

import { classifyCondition } from '../rkpConditionState';
import type { TriadAnalysis, HousePressure, TriadOutcome } from '../rkpTriad';
import type { HouseLordAnalysis } from '@astrology/types/watchVerdict';
import type { Planet } from '@astrology/types/chart';

function lord(overrides: Partial<HouseLordAnalysis> = {}): HouseLordAnalysis {
  return {
    house: 10,
    sign: 8,
    direction: 'North',
    lord: 'Mars',
    lordHouse: 10,
    dignity: 'neutral',
    conjunctSupport: [],
    conjunctObstruction: [],
    aspectSupport: [],
    aspectObstruction: [],
    retrograde: false,
    combust: false,
    supportScore: 0,
    verdict: 'mixed',
    ...overrides,
  };
}

function pressure(overrides: Partial<HousePressure> = {}): HousePressure {
  return {
    house: 10,
    blockingMalefics: [],
    occupyingMalefics: [],
    rescuingBenefics: [],
    supportingBenefics: [],
    saturnPressure: false,
    heavilyAfflicted: false,
    afflicted: false,
    ...overrides,
  };
}

function triad(overrides: {
  outcome?: TriadOutcome;
  target?: Partial<HouseLordAnalysis>;
  lagna?: Partial<HouseLordAnalysis>;
  fulfilment?: Partial<HouseLordAnalysis>;
  targetPressure?: Partial<HousePressure>;
  fulfilmentPressure?: Partial<HousePressure>;
}): TriadAnalysis {
  return {
    lagna: lord({ house: 1, lord: 'Saturn', ...overrides.lagna }),
    target: lord(overrides.target),
    fulfilment: lord({ house: 11, lord: 'Jupiter', ...overrides.fulfilment }),
    rulerRelation: 'neutral',
    targetPressure: pressure(overrides.targetPressure),
    fulfilmentPressure: pressure({ house: 11, ...overrides.fulfilmentPressure }),
    querentPolarity: 'masculine',
    controllerPolarity: 'feminine',
    outcome: overrides.outcome ?? 'mixed',
    outcomeReason: 'test fixture',
  };
}

describe('classifyCondition — the precedence ladder', () => {
  test('Stambhana: Saturn bearing on the house of the matter', () => {
    const r = classifyCondition(triad({ targetPressure: { saturnPressure: true } }));
    expect(r.state).toBe('Stambhana');
    expect(r.reason).toContain('Saturn');
  });

  test('Stambhana: a blocked triad, even without Saturn', () => {
    expect(classifyCondition(triad({ outcome: 'blocked' })).state).toBe('Stambhana');
  });

  test('Kshaya: a Rahu/Ketu eclipse point on the house of the matter', () => {
    const r = classifyCondition(
      triad({ targetPressure: { blockingMalefics: ['Rahu' as Planet] } }),
    );
    expect(r.state).toBe('Kshaya');
    expect(r.reason).toContain('eclipse');
  });

  test('Kshaya: severe debilitation of the ruler', () => {
    const r = classifyCondition(triad({ target: { dignity: 'debilitated' } }));
    expect(r.state).toBe('Kshaya');
    expect(r.reason).toContain('debilitated');
  });

  test('Kshaya: Mars bearing on the house of the matter', () => {
    expect(
      classifyCondition(triad({ targetPressure: { blockingMalefics: ['Mars' as Planet] } })).state,
    ).toBe('Kshaya');
  });

  test('Saturn outranks Mars/Rahu, matching the reference precedence', () => {
    const r = classifyCondition(
      triad({
        targetPressure: { saturnPressure: true, blockingMalefics: ['Rahu' as Planet] },
      }),
    );
    expect(r.state).toBe('Stambhana');
  });

  test('Vakra: any of the three triad rulers retrograde', () => {
    expect(classifyCondition(triad({ target: { retrograde: true } })).state).toBe('Vakra');
    expect(classifyCondition(triad({ lagna: { retrograde: true } })).state).toBe('Vakra');
    expect(classifyCondition(triad({ fulfilment: { retrograde: true } })).state).toBe('Vakra');
  });

  test('Vakra names the retrograde ruler, without duplicates', () => {
    const r = classifyCondition(
      triad({ lagna: { lord: 'Saturn', retrograde: true }, target: { retrograde: true } }),
    );
    expect(r.reason).toContain('Saturn');
    expect(r.reason).toContain('Mars');
  });

  test('Siddhi: positive triad, dignified ruler, nothing malefic on either house', () => {
    const r = classifyCondition(
      triad({ outcome: 'positive', target: { dignity: 'exalted', verdict: 'supported' } }),
    );
    expect(r.state).toBe('Siddhi');
    expect(r.reason).toContain('connectivity');
  });

  test('Gati: positive but not cleanly connected (ruler undignified)', () => {
    expect(classifyCondition(triad({ outcome: 'positive' })).state).toBe('Gati');
  });

  test('Gati: a delayed matter is still in motion', () => {
    expect(classifyCondition(triad({ outcome: 'delayed' })).state).toBe('Gati');
  });

  test('Siddhi requires the 11th to be clear too', () => {
    const r = classifyCondition(
      triad({
        outcome: 'positive',
        target: { dignity: 'exalted', verdict: 'supported' },
        fulfilmentPressure: { blockingMalefics: ['Ketu' as Planet] },
      }),
    );
    expect(r.state).toBe('Gati');
  });

  test('Bija: nothing has formed — the terminal case', () => {
    const r = classifyCondition(triad({ outcome: 'mixed' }));
    expect(r.state).toBe('Bija');
    expect(r.reason).toContain('no condition has formed');
  });
});
