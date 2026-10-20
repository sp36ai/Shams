/**
 * LIVE Rafiq–Nusrat check — real Anthropic API, real key. Skipped unless
 * LIVE_ANTHROPIC=1. The staging-gate companion to rafiqNusratNarration.test.ts:
 * that file proves what the composer sends and how it treats a given draft;
 * this one records what the real model actually writes.
 *
 *   cd functions
 *   LIVE_ANTHROPIC=1 ANTHROPIC_API_KEY=<staging key> npx vitest run rafiqNusrat.live
 *
 * Prints the full transcript (card timing row, every field, spoken text) for
 * line-by-line human review, and fails on the checks that can be mechanical:
 * verdict kept, dates correct, narration not rejected into the fallback,
 * card and voice carrying the same dates, and no plain claim of Nusrat's
 * plan or of her contacting Rafiq. Passing it is necessary, not sufficient —
 * the honesty of the prose is still a reader's judgment. Costs one model call.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config', () => ({
  ANTHROPIC_API_KEY: { value: () => process.env.ANTHROPIC_API_KEY ?? '' },
  FUNCTION_OPTS: {},
  ORACLE_FUNCTION_OPTS: {},
}));

const warnings: string[] = [];
vi.mock('firebase-functions/v2', () => ({
  logger: {
    warn: (message: string, ...rest: unknown[]) => {
      warnings.push(message);
      console.warn('[logger.warn]', message, ...rest);
    },
    error: (...args: unknown[]) => console.error('[logger.error]', ...args),
    info: () => undefined,
    debug: () => undefined,
  },
}));

import { composeWatchOracleResponse } from '../responseComposer';
import type { DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';

const LIVE = process.env.LIVE_ANTHROPIC === '1';

const QUESTION = "Rafiq is asking what Nusrat's step is or what her plan is.";

/** The owner-supplied judgment: WAIT under Zuhal, 42–63 days. */
const VERDICT = {
  qType: 'general',
  targetHouse: 1,
  targetSignName: 'Burj Hamal',
  targetRuler: 'Mars',
  targetRulerName: 'Mirrikh',
  fulfilmentHouse: 11,
  lagnaRuler: 'Mars',
  rulerRelation: 'Friend',
  state: 'DELAYED',
  confidence: 'MODERATE',
  score: 0,
  obstruction: 'Saturn',
  reversal: 'NONE',
  timing: { minDays: 42, maxDays: 63 },
  direction: 'North',
  afflictedDirection: 'West',
  controllerProfile: 'Assertive',
  factors: ['Zuhal casts its gaze on the matter — friction and delay.'],
} as unknown as DisplayWatchVerdict;

/** Plain claims about Nusrat's mind or actions. Narrow on purpose. */
const INTENTION_CLAIMS: readonly RegExp[] = [
  /\b(she|nusrat)\s+(will|is going to|is about to|plans to|intends to)\s+(contact|call|message|text|reach out|return|come back|propose|refuse|leave)/i,
  /\b(her|nusrat['’]s)\s+plan\s+is\b/i,
  /\bshe\s+(is|has been)\s+planning\b/i,
];

describe.skipIf(!LIVE)('LIVE — Rafiq–Nusrat staging transcript', () => {
  it('real narration keeps the verdict, the dates and the honesty rule', async () => {
    warnings.length = 0;
    const { composition } = await composeWatchOracleResponse({
      verdict: VERDICT,
      question: QUESTION,
      seekerName: 'Rafiq',
      readingId: 'live-rafiq-nusrat',
      // 13:57 IST, 20 October 2026.
      computedAt: new Date('2026-10-20T08:27:00Z'),
      utcOffsetMinutes: 330,
    });

    const n = composition.narration;
    console.warn(
      [
        '──────── RAFIQ–NUSRAT LIVE TRANSCRIPT ────────',
        `Question:        ${QUESTION}`,
        `Outcome:         ${composition.diagnosis.outcome} / ${composition.diagnosis.timingPosture}`,
        `Card timing row: 42–63 days · ${composition.timingWindow?.label ?? '(none)'}`,
        `Fallback used:   ${warnings.some(w => w.includes('fallback'))}`,
        '',
        `rkp_finding:          ${n?.rkp_finding ?? '(null)'}`,
        `interpretation:       ${n?.interpretation ?? '(null)'}`,
        `recommended_approach: ${n?.recommended_approach ?? '(null)'}`,
        `why_this_remedy:      ${n?.why_this_remedy ?? '(null)'}`,
        `signature:            ${n?.signature ?? '(null)'}`,
        `remedy steps:         ${composition.protocol.steps.map(s => s.name).join(' | ')}`,
        '',
        `SPOKEN: ${composition.speakableText ?? '(null)'}`,
        '──────────────────────────────────────────────',
      ].join('\n'),
    );

    // Verdict and timing — deterministic, must hold whatever the model wrote.
    expect(composition.diagnosis.outcome).toBe('DELAYED');
    expect(composition.diagnosis.timingPosture).toBe('WAIT_LONG');
    expect(composition.timingWindow?.label).toBe('1–22 December 2026');

    // The model's own text was used, not the deterministic fallback.
    expect(warnings.filter(w => w.includes('fallback') || w.includes('narration'))).toEqual([]);
    expect(n).not.toBeNull();

    // Card and voice carry the same dates.
    expect(composition.speakableText).toMatch(/1 to 22 December 2026\.$/);

    // No plain claim about Nusrat's plan or actions, in anything shown or spoken.
    const everything = [
      n!.rkp_finding,
      n!.interpretation,
      n!.recommended_approach,
      n!.why_this_remedy ?? '',
      n!.signature,
    ].join(' ');
    for (const claim of INTENTION_CLAIMS) {
      expect(everything).not.toMatch(claim);
    }
  }, 120_000);
});
