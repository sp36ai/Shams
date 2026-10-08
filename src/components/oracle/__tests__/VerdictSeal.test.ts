import { buildWatchChart } from '@astrology/rkp/watchChart';
import { judgeWatchChart, type WatchVerdict } from '@astrology/rkp/watchJudgment';

import { verdictSubline } from '../VerdictSeal';

const MOMENT = '2026-08-08T11:13:00+05:30';

function verdictWith(overrides: Partial<WatchVerdict>): WatchVerdict {
  return { ...judgeWatchChart(buildWatchChart(MOMENT), 'legal'), ...overrides };
}

const diagnosis = {
  outcome: 'UNFAVOURABLE',
  primaryPattern: 'UNCERTAINTY',
  secondaryPatterns: [],
  timingPosture: 'WAIT',
  confidence: 0.8,
  obstructingAgent: 'Dhanab',
  rationale: [],
} as never;

describe('verdict subline', () => {
  it('says what to do, when, and how sure — once', () => {
    const v = verdictWith({ timing: { minDays: 45, maxDays: 90 }, confidence: 'HIGH' });
    expect(verdictSubline(v, diagnosis)).toBe(
      'Wait before committing  ·  2–3 months  ·  high confidence',
    );
  });

  it('leaves out what the reading does not carry rather than guessing', () => {
    const v = verdictWith({ timing: null, confidence: 'HIGH' });
    expect(verdictSubline(v, null)).toBe('high confidence');
  });
});
