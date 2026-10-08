import { describe, expect, it } from 'vitest';
import { buildWatchChart } from '../../engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';
import { diagnose } from '../../engine/rkp/diagnosis';
import { classifyQuestion } from '../../engine/kp/rules/questionKeywords';
import type { QuestionType } from '../../engine/kp/rules/houseMatrix';
import { selectRemedyProtocol } from '../remedySelection';
import { toBoundaryPlanetName } from '../../utils/planetBoundaryName';
import { buildReadingContract, type ReadingContract } from '../readingContract';
import { validateNarration } from '../narrationValidator';
import { buildDeterministicFallbackNarration } from '../narrationFallback';
import { validateDiscussionReply } from '../discussionComposer';
import { ORACLE_DISCUSSION_PROMPT } from '../../prompts/oracleDiscussionPrompt';

/**
 * The screenshot's Reading was cast as 'general', before lending questions
 * were classified as lostitem (2026-10-08). The type is pinned so these tests
 * keep rebuilding the reading that was actually shown.
 */
function contractFor(
  moment: string,
  question: string,
  qType: QuestionType = classifyQuestion(question),
): ReadingContract {
  const chart = buildWatchChart(moment);
  const rawVerdict = judgeWatchChart(chart, qType);
  const verdict: DisplayWatchVerdict = {
    ...rawVerdict,
    obstruction: toBoundaryPlanetName(rawVerdict.obstruction),
    targetRuler: toBoundaryPlanetName(rawVerdict.targetRuler),
    lagnaRuler: toBoundaryPlanetName(rawVerdict.lagnaRuler),
  };
  const diagnosis = diagnose(verdict);
  return buildReadingContract({
    readingId: 'r-today',
    computedAt: new Date('2026-10-08T07:30:00.000Z'),
    question,
    verdict,
    diagnosis,
    protocol: selectRemedyProtocol(diagnosis),
  });
}

describe('a question asked about "today" on a reading that says wait', () => {
  const contract = contractFor(
    '2026-10-08T13:00:00+05:30',
    'Will bilal give my laptop today',
    'general',
  );

  it('is the reading from the device screenshot: blocked by Dhanab, wait 45–90 days', () => {
    expect(contract.diagnosis.outcome).toBe('UNFAVOURABLE');
    expect(contract.diagnosis.timingPosture).toBe('WAIT');
    expect(contract.diagnosis.timing).toEqual({ minDays: 45, maxDays: 90 });
  });

  it('rejects narration that answers the question in its own words ("not today")', () => {
    const result = validateNarration(contract, {
      rkp_finding:
        'The door you are knocking on stays shut for now. Bilal will not return the laptop today; Dhanab sits across the matter.',
      interpretation:
        'What you are waiting for is held, not lost, and the hand holding it is not ready to open.',
      recommended_approach: 'Let the matter rest. The window the chart gives is 45 to 90 days.',
      why_this_remedy: null,
      signature: 'The veil lifts in its own time.',
    });
    expect(result.valid).toBe(false);
    expect(result.valid ? [] : result.failures.map(f => f.code)).toContain('TIMING_ALTERATION');
  });
});

describe('the deterministic fallback for that reading', () => {
  const contract = contractFor(
    '2026-10-08T13:00:00+05:30',
    'Will bilal give my laptop today',
    'general',
  );
  const fallback = buildDeterministicFallbackNarration(contract);

  it('shows the seeker no engine tokens', () => {
    for (const text of Object.values(fallback)) {
      expect(text ?? '').not.toMatch(/\b[A-Z]{2,}(?:_[A-Z]+)*\b/);
    }
  });

  it('states the patterns in plain words, and still passes validation', () => {
    expect(fallback.interpretation).toContain('The pattern the chart shows is');
    expect(validateNarration(contract, fallback).valid).toBe(true);
  });
});

describe('a follow-up reply on that reading', () => {
  const contract = contractFor(
    '2026-10-08T13:00:00+05:30',
    'Will bilal give my laptop today',
    'general',
  );

  it('is rejected when it answers "not today" — and a rejected follow-up returns no reply', () => {
    const result = validateDiscussionReply(
      contract,
      'Not today. The chart gives this matter a window of 45 to 90 days.',
    );
    expect(result.valid).toBe(false);
  });

  it('would be rejected for telling a seeker in crisis to get help "today"', () => {
    // Why the discussion prompt's crisis line must not say "today": on a
    // WAIT reading the timing check would swallow the safety message.
    expect(
      validateDiscussionReply(contract, 'Please reach someone who can help you today.').valid,
    ).toBe(false);
    expect(
      validateDiscussionReply(contract, 'Please reach someone who can help you now.').valid,
    ).toBe(true);
  });
});

describe('the discussion prompt', () => {
  it('never itself asks for a word the timing check rejects on a waiting reading', () => {
    const crisisLine = ORACLE_DISCUSSION_PROMPT.split('\n').find(l => l.includes('crisis')) ?? '';
    expect(crisisLine).not.toMatch(/\btoday\b|\btomorrow\b|right now|right away|without delay/i);
  });
});
