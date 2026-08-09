import { buildWatchChart } from '@astrology/rkp/watchChart';
import { judgeWatchChart, type WatchVerdict } from '@astrology/rkp/watchJudgment';

import { obstructionLabel, STATE_HEADLINE, timingLabel } from '../RkpWatchCard';

const MOMENT = '2026-08-08T11:13:00+05:30';

function verdictWith(overrides: Partial<WatchVerdict>): WatchVerdict {
  return { ...judgeWatchChart(buildWatchChart(MOMENT), 'legal'), ...overrides };
}

describe('state headlines', () => {
  it('gives every state a plain-language answer', () => {
    const states: Array<WatchVerdict['state']> = [
      'FULFILLED',
      'MOVING',
      'DELAYED',
      'BLOCKED',
      'REVERSING',
      'UNFORMED',
    ];
    for (const state of states) {
      expect(STATE_HEADLINE[state].length).toBeGreaterThan(0);
    }
  });

  it('leads with the answer rather than the machine label', () => {
    // The headline is what the querent reads first — it must not be a token.
    for (const headline of Object.values(STATE_HEADLINE)) {
      expect(headline).not.toMatch(/^[A-Z_]+$/);
    }
  });
});

describe('timing label', () => {
  it('scales the unit to the size of the window', () => {
    expect(timingLabel(verdictWith({ timing: { minDays: 3, maxDays: 7 } }))).toBe('3–7 days');
    expect(timingLabel(verdictWith({ timing: { minDays: 30, maxDays: 60 } }))).toBe('4–9 weeks');
    expect(timingLabel(verdictWith({ timing: { minDays: 90, maxDays: 150 } }))).toBe('3–5 months');
  });

  it('says so plainly when the chart gives no timing', () => {
    expect(timingLabel(verdictWith({ timing: null }))).toBe('Unclear');
  });
});

describe('obstruction label', () => {
  it('names an obstructing planet in the app vocabulary', () => {
    expect(obstructionLabel(verdictWith({ obstruction: 'Saturn' }))).toBe('Zuhal');
    expect(obstructionLabel(verdictWith({ obstruction: 'Mars' }))).toBe('Mirrikh');
    expect(obstructionLabel(verdictWith({ obstruction: 'Rahu' }))).toBe('Ras al-Tinnin');
  });

  it('words an unsettled mind as a state, not as an agent in the way', () => {
    const label = obstructionLabel(verdictWith({ obstruction: 'MoonDisagreement' }));
    expect(label).toMatch(/Qamar/);
    expect(label).toMatch(/unsettled/i);
  });

  it('shows no row at all when nothing obstructs', () => {
    expect(obstructionLabel(verdictWith({ obstruction: 'None' }))).toBeNull();
  });

  it('uses no Sanskrit planet names', () => {
    for (const obstruction of ['Saturn', 'Mars', 'Rahu', 'Ketu'] as const) {
      const label = obstructionLabel(verdictWith({ obstruction }));
      expect(label).not.toMatch(/\b(Shani|Mangal|Rahu|Ketu|Guru|Shukra|Budh)\b/);
    }
  });
});
