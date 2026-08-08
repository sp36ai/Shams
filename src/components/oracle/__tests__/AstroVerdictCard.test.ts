import { buildShareText, buildReasoningShareText } from '../AstroVerdictCard';
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

describe('buildReasoningShareText', () => {
  test('includes chart moment, category, verdict, moon sub-lord, and ruling planets', () => {
    const text = buildReasoningShareText(
      baseResult({
        rulingPlanets: [
          { planet: 'Sun', role: 'dayLord', matching: true },
          { planet: 'Mercury', role: 'ascSignLord', matching: false },
        ],
      }),
    );
    expect(text).toContain('Category: career');
    expect(text).toContain('Chart moment: 2026-08-07T12:00:00.000Z');
    expect(text).toContain('YES (78% confidence)');
    expect(text).toContain("Moon's Sub-Lord: Mars — occupies house 10");
    expect(text).toContain('dayLord=Sun');
    expect(text).toContain('ascSignLord=Mercury');
  });

  test('lists every reasoning step with its rule id and signed weight', () => {
    const text = buildReasoningShareText(
      baseResult({
        reasoning: [
          { ruleId: 'STEP_1', description: "Moon's Sub-Lord Mars occupies house 10", weight: 2 },
          { ruleId: 'STEP_4', description: 'Sun: Favorable Significator', weight: 1 },
          { ruleId: 'STEP_2', description: 'Neutral witness', weight: 0 },
        ],
      }),
    );
    expect(text).toContain("[STEP_1] Moon's Sub-Lord Mars occupies house 10 (+2)");
    expect(text).toContain('[STEP_4] Sun: Favorable Significator (+1)');
    expect(text).toContain('[STEP_2] Neutral witness (0)');
  });

  test('flags when no reasoning trace is attached', () => {
    const text = buildReasoningShareText(baseResult({ reasoning: undefined }));
    expect(text).toContain('(no reasoning trace attached to this reading)');
  });

  test('omits the question line when absent, same as buildShareText', () => {
    const text = buildReasoningShareText(baseResult({ question: undefined }));
    expect(text).not.toContain('Question:');
  });
});
