import { buildWatchChart } from '@astrology/rkp/watchChart';
import { judgeWatchChart } from '@astrology/rkp/watchJudgment';
import type { WatchReading } from '../../../firebase/watchOracle';
import { speakableTextFor } from '../ChatBubble';

const MOMENT = '2026-08-08T11:13:00+05:30';

function readingWith(overrides: Partial<WatchReading> = {}): WatchReading {
  return {
    readingId: 'r1',
    computedAt: '2026-08-08T05:43:00.000Z',
    localMoment: MOMENT,
    window: { startMinute: 43, endMinute: 48, minute: 43 },
    lagnaSignName: 'Burj Jauza',
    lagnaRulerName: 'Utarid',
    verdict: judgeWatchChart(buildWatchChart(MOMENT), 'legal'),
    ...overrides,
  };
}

describe('speakableTextFor', () => {
  it('joins the narration prose fields when synthesis succeeded', () => {
    const reading = readingWith({
      oracle: {
        narration: {
          rkp_finding: 'Zuhal weighs on the tenth.',
          interpretation: 'The matter moves slowly.',
          recommended_approach: 'Wait before committing.',
          why_this_remedy: null,
          signature: 'Oracle of Shams',
        },
        diagnosis: {
          outcome: 'DELAYED',
          primaryPattern: 'INSTABILITY',
          secondaryPatterns: [],
          timingPosture: 'WAIT',
          confidence: 0.6,
          obstructingAgent: null,
          rationale: [],
        },
        protocol: { interventionRequired: false, guidance: null, steps: [], rationale: [] },
      },
    });

    expect(speakableTextFor(reading)).toBe(
      'Zuhal weighs on the tenth.. The matter moves slowly.. Wait before committing.',
    );
  });

  it('falls back to the plain-language state headline when oracle is absent', () => {
    const reading = readingWith({ oracle: undefined });
    expect(speakableTextFor(reading).length).toBeGreaterThan(0);
    expect(speakableTextFor(reading)).not.toMatch(/^[A-Z_]+$/);
  });
});
