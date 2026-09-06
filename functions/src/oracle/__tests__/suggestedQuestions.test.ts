import { describe, it, expect } from 'vitest';

import { diagnose, type RkpDiagnosis } from '../../engine/rkp/diagnosis';
import type { DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';
import { selectSuggestedQuestions } from '../suggestedQuestions';

const CLEAN: DisplayWatchVerdict = {
  qType: 'finance',
  targetHouse: 2,
  targetSignName: 'Hamal',
  targetRuler: 'Mars',
  targetRulerName: 'Mirrikh',
  fulfilmentHouse: 11,
  lagnaRuler: 'Sun',
  rulerRelation: 'Neutral',
  state: 'FULFILLED',
  confidence: 'VERY_HIGH',
  score: 6,
  obstruction: 'None',
  reversal: 'NONE',
  timing: { minDays: 3, maxDays: 7 },
  direction: 'East',
  afflictedDirection: null,
  controllerProfile: 'Receptive',
  factors: ['ruler strong'],
};

const questionsFor = (over: Partial<DisplayWatchVerdict>) =>
  selectSuggestedQuestions(diagnose({ ...CLEAN, ...over }));

describe('selectSuggestedQuestions', () => {
  it('never exceeds four, and never invents anything outside the bank', () => {
    const qs = questionsFor({ qType: 'finance', obstruction: 'Saturn' });
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.length).toBeLessThanOrEqual(4);
  });

  it('offers the domain-general question even on a clean, unobstructed chart', () => {
    const qs = questionsFor({ qType: 'finance' });
    expect(qs).toContain('Where is the money likely to come from?');
  });

  it('only offers delay-specific questions when the timing actually shows delay', () => {
    const clean = questionsFor({ qType: 'finance' });
    expect(clean).not.toContain('What is causing the delay?');

    const delayed = questionsFor({
      qType: 'finance',
      state: 'DELAYED',
      obstruction: 'Saturn',
      // Past the imminent threshold (14 days) so timingPosture lands on
      // WAIT rather than ACT_SOON — see diagnosis.ts's timingPostureFor.
      timing: { minDays: 20, maxDays: 30 },
    });
    expect(delayed).toContain('What is causing the delay?');
  });

  it('only offers the caution question on an adverse outcome', () => {
    const favourable = questionsFor({ qType: 'finance' });
    expect(favourable).not.toContain('What should I avoid financially right now?');

    const adverse = questionsFor({ qType: 'finance', state: 'BLOCKED' });
    expect(adverse).toContain('What should I avoid financially right now?');
  });

  it('falls back to the general bank for a qType the bank has no entry for', () => {
    // qType is a closed enum end to end in production (diagnose() itself
    // rejects an unknown one via HOUSE_MATRIX), but selectSuggestedQuestions
    // is defensive on its own input — a diagnosis with a qType the bank
    // doesn't recognise must degrade to `general`, not throw.
    const base: RkpDiagnosis = diagnose(CLEAN);
    const qs = selectSuggestedQuestions({
      ...base,
      qType: 'unmapped' as RkpDiagnosis['qType'],
    });
    expect(qs).toContain('What is the strongest factor here?');
  });

  it('is a pure function of the diagnosis — same input, same output', () => {
    const a = questionsFor({ qType: 'property', state: 'DELAYED' });
    const b = questionsFor({ qType: 'property', state: 'DELAYED' });
    expect(a).toEqual(b);
  });
});
