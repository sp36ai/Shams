import { buildShareText } from '../AstroVerdictCard';
import type { AstroVerdictResult } from '../../../types/verdict';

function baseResult(overrides: Partial<AstroVerdictResult> = {}): AstroVerdictResult {
  return {
    mode: 'astro',
    verdict: 'YES',
    confidence: 78,
    subLord: 'Mars',
    subLordHouse: 10,
    houses: [],
    rulingPlanets: [],
    narrative: 'The celestial witnesses favor your matter.',
    createdAt: '2026-08-07T12:00:00.000Z',
    category: 'career',
    ...overrides,
  };
}

describe('buildShareText', () => {
  test('includes verdict, confidence, and narrative', () => {
    const text = buildShareText(baseResult());
    expect(text).toContain('YES');
    expect(text).toContain('78% confidence');
    expect(text).toContain('The celestial witnesses favor your matter.');
    expect(text).toContain('Shams al-Asrār');
  });

  test('includes the question when present, omits the line when absent', () => {
    const withQ = buildShareText(baseResult({ question: 'Will I get the promotion?' }));
    expect(withQ).toContain('Question: Will I get the promotion?');

    const withoutQ = buildShareText(baseResult({ question: undefined }));
    expect(withoutQ).not.toContain('Question:');
  });

  test('includes timing when present', () => {
    const text = buildShareText(
      baseResult({
        timing: { window: 'weeks', range: { min: 1, max: 3 }, activeDasha: 'Venus' },
      }),
    );
    expect(text).toContain('Timing: within 3 weeks');
  });

  test('includes remedy action when present', () => {
    const text = buildShareText(
      baseResult({
        remedy: { planet: 'Venus', action: 'Recite Surah Al-Room on Friday', avoid: 'Excess' },
      }),
    );
    expect(text).toContain('Remedy: Recite Surah Al-Room on Friday');
  });

  test('prefers oracle.interpretation over narrative when both present', () => {
    const text = buildShareText(
      baseResult({
        narrative: 'plain narrative',
        oracle: {
          opening: '',
          interpretation: 'oracle voice interpretation',
          spiritual_layer: '',
          hidden_influence: '',
          remedy: {},
          signature: 'Custom signature',
        },
      }),
    );
    expect(text).toContain('oracle voice interpretation');
    expect(text).not.toContain('plain narrative');
    expect(text).toContain('— Custom signature');
  });

  test('falls back to the default signature when oracle is absent', () => {
    const text = buildShareText(baseResult());
    expect(text).toContain('Oracle of Shams al-Asrār (by Astro Sarfaraz)');
  });
});
