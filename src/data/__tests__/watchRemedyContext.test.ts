import { type WatchVerdict } from '@astrology/rkp/watchJudgment';
import { buildWatchChart } from '@astrology/rkp/watchChart';
import { judgeWatchChart } from '@astrology/rkp/watchJudgment';

import { directionalFocusFor } from '../watchRemedyContext';

const MOMENT = '2026-08-08T11:13:00+05:30';

/** Build a verdict, then override the fields under test. */
function verdictWith(overrides: Partial<WatchVerdict>): WatchVerdict {
  const base = judgeWatchChart(buildWatchChart(MOMENT), 'legal');
  return { ...base, ...overrides };
}

// NOTE (Phase 2B): this file previously also covered watchVerdictToRankingContext
// (classification/severity/themes/spiritual-state/end-to-end describe blocks) —
// the deterministic input builder for the second, LLM-driven remedy path
// (selectRemedies). That path was disconnected in Phase 2B — see
// docs/audit/PHASE_2B_ENGINE_MIGRATION.md — and watchVerdictToRankingContext
// was removed along with it, since ReadingScreen.tsx was its only caller.
// directionalFocusFor is unrelated and unaffected: it feeds RkpWatchCard's
// physical-correspondence display, which Phase 2B did not touch.

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
