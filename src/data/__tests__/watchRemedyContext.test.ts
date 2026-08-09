import { buildWatchChart } from '@astrology/rkp/watchChart';
import { judgeWatchChart, type WatchVerdict } from '@astrology/rkp/watchJudgment';
import { ALL_QUESTION_TYPES } from '@astrology/questions/topics';

import { getCandidates } from '../rankCandidates';
import { REMEDY_LIBRARY } from '../remedyLibrary';
import { directionalFocusFor, watchVerdictToRankingContext } from '../watchRemedyContext';

const MOMENT = '2026-08-08T11:13:00+05:30';

/** Build a verdict, then override the fields under test. */
function verdictWith(overrides: Partial<WatchVerdict>): WatchVerdict {
  const base = judgeWatchChart(buildWatchChart(MOMENT), 'legal');
  return { ...base, ...overrides };
}

describe('classification', () => {
  it('treats a completed or moving matter as confirmed', () => {
    for (const state of ['FULFILLED', 'MOVING'] as const) {
      expect(watchVerdictToRankingContext(verdictWith({ state })).oracleClassification).toBe(
        'CONFIRMED',
      );
    }
  });

  it('treats only a blocked matter as denied', () => {
    expect(
      watchVerdictToRankingContext(verdictWith({ state: 'BLOCKED' })).oracleClassification,
    ).toBe('DENIED');
  });

  it('keeps delay and reversal neutral — the matter still stands', () => {
    for (const state of ['DELAYED', 'REVERSING', 'UNFORMED'] as const) {
      expect(watchVerdictToRankingContext(verdictWith({ state })).oracleClassification).toBe(
        'NEUTRAL',
      );
    }
  });
});

describe('severity', () => {
  it('keeps a favourable chart gentle', () => {
    expect(watchVerdictToRankingContext(verdictWith({ state: 'FULFILLED' })).severity).toBe('low');
    expect(watchVerdictToRankingContext(verdictWith({ state: 'MOVING' })).severity).toBe('low');
  });

  it('escalates a blocked matter', () => {
    expect(watchVerdictToRankingContext(verdictWith({ state: 'BLOCKED' })).severity).toBe('high');
  });

  it('weighs a hard obstruction on a delayed matter above mere slowness', () => {
    const heavy = verdictWith({ state: 'DELAYED', obstruction: 'Saturn' });
    const light = verdictWith({ state: 'DELAYED', obstruction: 'None' });
    expect(watchVerdictToRankingContext(heavy).severity).toBe('high');
    expect(watchVerdictToRankingContext(light).severity).toBe('moderate');
  });
});

describe('themes', () => {
  it('carries the obstruction shape into the themes', () => {
    const saturn = watchVerdictToRankingContext(verdictWith({ obstruction: 'Saturn' }));
    expect(saturn.dominantThemes).toEqual(expect.arrayContaining(['DELAY', 'STAGNATION']));

    const mars = watchVerdictToRankingContext(verdictWith({ obstruction: 'Mars' }));
    expect(mars.dominantThemes).toEqual(expect.arrayContaining(['CONFLICT', 'HASTE']));
  });

  it('merges obstruction, state and question-type themes without duplicates', () => {
    const ctx = watchVerdictToRankingContext(
      verdictWith({ state: 'BLOCKED', obstruction: 'Saturn', qType: 'legal' }),
    );
    expect(new Set(ctx.dominantThemes).size).toBe(ctx.dominantThemes.length);
    // OBSTRUCTION arrives from both the obstruction and the state — once only.
    expect(ctx.dominantThemes.filter(t => t === 'OBSTRUCTION')).toHaveLength(1);
  });

  it('produces only tags the remedy library actually uses', () => {
    const known = new Set(REMEDY_LIBRARY.flatMap(r => r.themeTags));
    for (const qType of ALL_QUESTION_TYPES) {
      const ctx = watchVerdictToRankingContext(verdictWith({ qType }));
      for (const tag of ctx.dominantThemes) {
        expect(known).toContain(tag);
      }
    }
  });
});

describe('spiritual state', () => {
  it('lets an unsettled mind outrank the verdict', () => {
    const ctx = watchVerdictToRankingContext(
      verdictWith({ state: 'FULFILLED', obstruction: 'MoonDisagreement' }),
    );
    expect(ctx.spiritualState).toBe('restless');
  });

  it('reads gratitude from fulfilment and hope from movement', () => {
    expect(
      watchVerdictToRankingContext(verdictWith({ state: 'FULFILLED', obstruction: 'None' }))
        .spiritualState,
    ).toBe('grateful');
    expect(
      watchVerdictToRankingContext(verdictWith({ state: 'MOVING', obstruction: 'None' }))
        .spiritualState,
    ).toBe('hopeful');
  });
});

describe('end to end into the existing remedy library', () => {
  it('yields real remedies for every question type', () => {
    const chart = buildWatchChart(MOMENT);
    for (const qType of ALL_QUESTION_TYPES) {
      const verdict = judgeWatchChart(chart, qType);
      const candidates = getCandidates(watchVerdictToRankingContext(verdict));

      expect(candidates.length).toBeGreaterThan(0);
      for (const remedy of candidates) {
        expect(REMEDY_LIBRARY.some(r => r.id === remedy.id)).toBe(true);
      }
    }
  });

  it('never prescribes deep practices for a gentle reading', () => {
    const gentle = verdictWith({ state: 'FULFILLED', obstruction: 'None' });
    for (const remedy of getCandidates(watchVerdictToRankingContext(gentle))) {
      expect(remedy.intensity).toBe('gentle');
    }
  });

  it('is deterministic', () => {
    const verdict = judgeWatchChart(buildWatchChart(MOMENT), 'finance');
    const ctx = watchVerdictToRankingContext(verdict);
    expect(getCandidates(ctx).map(r => r.id)).toEqual(getCandidates(ctx).map(r => r.id));
  });
});

describe('directional focus', () => {
  it('names a physical seat for a planetary obstruction', () => {
    const focus = directionalFocusFor(
      verdictWith({ obstruction: 'Saturn', afflictedDirection: 'South' }),
    );
    expect(focus).not.toBeNull();
    expect(focus!.direction).toBe('South');
    expect(focus!.focus).toMatch(/paperwork|rust|unmoved/i);
  });

  it('returns nothing for an interior obstruction', () => {
    // Qamar's disagreement is a state of mind, not a corner of a room.
    expect(
      directionalFocusFor(
        verdictWith({ obstruction: 'MoonDisagreement', afflictedDirection: null }),
      ),
    ).toBeNull();
  });

  it('returns nothing when the chart names no obstruction', () => {
    expect(
      directionalFocusFor(verdictWith({ obstruction: 'None', afflictedDirection: null })),
    ).toBeNull();
  });
});
