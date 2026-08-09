/**
 * currentReading — unit tests for RKP's "Watch of Currents" layer.
 *
 * computeCurrentReading() is a pure function over already-computed
 * judgeHorary() data, so these tests construct that input directly —
 * no chart fixtures needed. Each test targets one of the seven canonical
 * symbolic outputs from the module docstring.
 */

import { computeCurrentReading, type CurrentReadingInput } from '../currentReading';
import type { VerdictTiming } from '../../../types/verdict';

function timing(overrides: Partial<VerdictTiming> = {}): VerdictTiming {
  return {
    window: 'months',
    range: { min: 1, max: 6 },
    activeDasha: 'Jupiter',
    activeAntardasha: 'Jupiter',
    activePratyantardasha: 'Jupiter',
    transitTriggers: [],
    ...overrides,
  };
}

function baseInput(overrides: Partial<CurrentReadingInput> = {}): CurrentReadingInput {
  return {
    verdict: 'YES',
    stage: 'fructification',
    moonSubLord: 'Mercury',
    confirmedSignificators: [],
    deniedSignificators: [],
    retrogradeFlags: [],
    combustFlags: [],
    ...overrides,
  };
}

describe('computeCurrentReading — structural block', () => {
  test('promise_failed → "current is blocked", structural=true, no live current', () => {
    const reading = computeCurrentReading(
      baseInput({ verdict: 'DENIED', stage: 'promise_failed' }),
    );
    expect(reading.flow).toBe('blocked');
    expect(reading.structural).toBe(true);
    expect(reading.label).toBe('current is blocked');
    expect(reading.interference).toHaveLength(0);
  });
});

describe('computeCurrentReading — base flows', () => {
  test('YES, no timing, no interference → "current is open"', () => {
    const reading = computeCurrentReading(baseInput({ verdict: 'YES' }));
    expect(reading.flow).toBe('open');
    expect(reading.structural).toBe(false);
    expect(reading.drift).toBe('steady');
    expect(reading.label).toBe('current is open');
  });

  test('NO, no timing → "current is blocked" (fructification-level, not structural)', () => {
    const reading = computeCurrentReading(baseInput({ verdict: 'NO' }));
    expect(reading.flow).toBe('blocked');
    expect(reading.structural).toBe(false);
    expect(reading.label).toBe('current is blocked');
  });

  test('CONDITIONAL, no timing → "current is unstable"', () => {
    const reading = computeCurrentReading(baseInput({ verdict: 'CONDITIONAL' }));
    expect(reading.flow).toBe('unstable');
    expect(reading.label).toBe('current is unstable');
  });
});

describe('computeCurrentReading — drift and turning', () => {
  test('NO, but near-term dasha (PD) trends favorable → "current is turning"', () => {
    const reading = computeCurrentReading(
      baseInput({
        verdict: 'NO',
        confirmedSignificators: ['Venus'],
        deniedSignificators: ['Saturn'],
        timing: timing({ activeDasha: 'Saturn', activePratyantardasha: 'Venus' }),
      }),
    );
    expect(reading.drift).toBe('strengthening');
    expect(reading.flow).toBe('turning');
    expect(reading.label).toBe('current is turning');
  });

  test('CONDITIONAL with a favorable-trending PD is also promoted to "turning"', () => {
    const reading = computeCurrentReading(
      baseInput({
        verdict: 'CONDITIONAL',
        confirmedSignificators: ['Venus'],
        deniedSignificators: [],
        timing: timing({ activeDasha: 'Mars', activePratyantardasha: 'Venus' }),
      }),
    );
    expect(reading.flow).toBe('turning');
  });

  test('YES, but near-term dasha (PD) trends toward denial → weakens after initial movement', () => {
    const reading = computeCurrentReading(
      baseInput({
        verdict: 'YES',
        confirmedSignificators: ['Jupiter'],
        deniedSignificators: ['Saturn'],
        timing: timing({ activeDasha: 'Jupiter', activePratyantardasha: 'Saturn' }),
      }),
    );
    expect(reading.drift).toBe('weakening');
    expect(reading.flow).toBe('open'); // drift doesn't downgrade the verdict-derived flow
    expect(reading.label).toBe('current weakens after initial movement');
  });

  test('MD and PD both favorable → steady drift, no promotion', () => {
    const reading = computeCurrentReading(
      baseInput({
        verdict: 'YES',
        confirmedSignificators: ['Jupiter'],
        timing: timing({ activeDasha: 'Jupiter', activePratyantardasha: 'Jupiter' }),
      }),
    );
    expect(reading.drift).toBe('steady');
    expect(reading.label).toBe('current is open');
  });
});

describe('computeCurrentReading — interference', () => {
  test('YES with Jupiter retrograde → "current is favorable but delayed"', () => {
    const reading = computeCurrentReading(
      baseInput({ verdict: 'DELAYED', retrogradeFlags: ['Jupiter'] }),
    );
    expect(reading.flow).toBe('open');
    expect(reading.interference).toContain('Jupiter');
    expect(reading.label).toBe('current is favorable but delayed');
  });

  test('NO with retrograde Moon Sub-Lord → "current is pressured by interference"', () => {
    const reading = computeCurrentReading(
      baseInput({ verdict: 'NO', moonSubLord: 'Venus', retrogradeFlags: ['Venus'] }),
    );
    expect(reading.flow).toBe('blocked');
    expect(reading.interference).toContain('Venus');
    expect(reading.label).toBe('current is pressured by interference');
  });

  test('combustion only counts as interference when the planet is an active significator witness', () => {
    const irrelevant = computeCurrentReading(
      baseInput({ verdict: 'CONDITIONAL', combustFlags: ['Mars'] }),
    );
    expect(irrelevant.interference).toHaveLength(0);
    expect(irrelevant.label).toBe('current is unstable');

    const relevant = computeCurrentReading(
      baseInput({
        verdict: 'CONDITIONAL',
        deniedSignificators: ['Mars'],
        combustFlags: ['Mars'],
      }),
    );
    expect(relevant.interference).toContain('Mars');
    expect(relevant.label).toBe('current is pressured by interference');
  });

  test('retrograde outside the three decisive witnesses is not interference', () => {
    const reading = computeCurrentReading(
      baseInput({ verdict: 'YES', retrogradeFlags: ['Saturn'] }),
    );
    expect(reading.interference).toHaveLength(0);
    expect(reading.label).toBe('current is open');
  });
});

describe('computeCurrentReading — determinism', () => {
  test('identical input always produces an identical reading', () => {
    const input = baseInput({
      verdict: 'DELAYED',
      confirmedSignificators: ['Jupiter'],
      retrogradeFlags: ['Jupiter'],
      timing: timing(),
    });
    const a = computeCurrentReading(input);
    const b = computeCurrentReading(input);
    expect(a).toEqual(b);
  });
});
