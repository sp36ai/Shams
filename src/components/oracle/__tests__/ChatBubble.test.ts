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

/**
 * PHASE 5H-R: `speakableTextFor` no longer reconstructs the TTS string from
 * `narration`'s own fields (that reconstruction was Finding 5H-1 —
 * docs/audit/PHASE_5H_RECONNAISSANCE.md — an unvalidated three-field join).
 * It now relays the server-computed, server-validated `oracle.speakableText`
 * field directly. These tests cover that relay and its two distinct
 * fallback cases; the actual join transformation and its validation are
 * covered server-side in
 * functions/src/oracle/__tests__/speakableTextValidation.test.ts.
 */
describe('speakableTextFor', () => {
  it('speaks oracle.speakableText verbatim when synthesis succeeded', () => {
    const reading = readingWith({
      oracle: {
        narration: {
          rkp_finding: 'Zuhal weighs on the tenth.',
          interpretation: 'The matter moves slowly.',
          recommended_approach: 'Wait before committing.',
          why_this_remedy: null,
          signature: 'Oracle of Shams',
        },
        speakableText:
          'Zuhal weighs on the tenth.. The matter moves slowly.. Wait before committing.',
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

  it('falls back to the plain-language state headline when speakableText is absent (a reading composed before this field existed) — never reconstructs the join itself', () => {
    const reading = readingWith({
      oracle: {
        narration: {
          rkp_finding: 'Zuhal weighs on the tenth.',
          interpretation: 'The matter moves slowly.',
          recommended_approach: 'Wait before committing.',
          why_this_remedy: null,
          signature: 'Oracle of Shams',
        },
        // speakableText intentionally omitted — the pre-5H-R shape.
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

    const spoken = speakableTextFor(reading);
    expect(spoken.length).toBeGreaterThan(0);
    // Must be the deterministic headline, not a reconstruction of narration —
    // it must not contain any of the narration prose that would result from
    // rejoining the fields client-side.
    expect(spoken).not.toContain('Zuhal weighs on the tenth');
    expect(spoken).not.toContain('The matter moves slowly');
  });

  it('falls back to the plain-language state headline when speakableText is explicitly null (synthesis produced no narration to speak)', () => {
    const reading = readingWith({
      oracle: {
        narration: null,
        speakableText: null,
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

    expect(speakableTextFor(reading).length).toBeGreaterThan(0);
    expect(speakableTextFor(reading)).not.toMatch(/^[A-Z_]+$/);
  });
});
