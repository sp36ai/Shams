/**
 * PHASE 5I — permanent regression coverage for Finding 5I-1.
 * --------------------------------------------------------------------------
 * `docs/audit/PHASE_5I_HARDENING.md` (workstream 5I-E) reproduced that
 * `PROHIBITED_TERMINOLOGY` covered this app's own internal architecture
 * vocabulary (RKP, watchJudgment, ReadingContract, ...) but had zero
 * coverage for vendor/infrastructure/AI-industry identity terms — narration
 * naming the underlying model or cloud provider would reach the seeker
 * uncaught. Closed by a narrow, evidence-driven addition to the same
 * existing deny-list `checkTerminologyLeakage()` already scans — not a new
 * check, not a general vendor-name scanner.
 */
import { describe, it, expect } from 'vitest';
import { buildWatchChart } from '../../engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';
import { diagnose } from '../../engine/rkp/diagnosis';
import { classifyQuestion } from '../../engine/kp/rules/questionKeywords';
import { selectRemedyProtocol } from '../remedySelection';
import { toBoundaryPlanetName } from '../../utils/planetBoundaryName';
import { buildReadingContract, type ReadingContract } from '../readingContract';
import { validateNarration } from '../narrationValidator';
import { wrapAsAllNarrationFields } from '../responseComposer';

function contractFor(moment: string, question: string, readingId: string): ReadingContract {
  const chart = buildWatchChart(moment);
  const qType = classifyQuestion(question);
  const rawVerdict = judgeWatchChart(chart, qType);
  const verdict: DisplayWatchVerdict = {
    ...rawVerdict,
    obstruction: toBoundaryPlanetName(rawVerdict.obstruction),
    targetRuler: toBoundaryPlanetName(rawVerdict.targetRuler),
    lagnaRuler: toBoundaryPlanetName(rawVerdict.lagnaRuler),
  };
  const diagnosis = diagnose(verdict);
  const protocol = selectRemedyProtocol(diagnosis);
  return buildReadingContract({
    readingId,
    computedAt: new Date('2026-09-09T00:00:00.000Z'),
    question,
    verdict,
    diagnosis,
    protocol,
  });
}

const contract = contractFor(
  '2026-09-09T09:00:00+02:00',
  'Will my marriage proposal be accepted?',
  'r-5i-vendor-terminology',
);

const VENDOR_TERMS = [
  'Claude',
  'Anthropic',
  'OpenAI',
  'GPT',
  'Firebase',
  'Firestore',
  'Cloud Function',
  'large language model',
  'machine learning',
  'neural network',
  'training data',
  'system prompt',
];

describe('PHASE 5I — vendor/infrastructure terminology leakage (Finding 5I-1)', () => {
  it.each(VENDOR_TERMS)('rejects narration naming "%s"', term => {
    const result = validateNarration(
      contract,
      wrapAsAllNarrationFields(`As part of this reading, note that ${term} was involved here.`),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TERMINOLOGY_LEAKAGE')).toBe(true);
    }
  });

  it('genuine mystical narration containing none of these terms remains valid (no over-tightening)', () => {
    const result = validateNarration(
      contract,
      wrapAsAllNarrationFields(
        'The chart speaks of patience; the signs favour a quiet waiting before this matter settles.',
      ),
    );
    expect(result.valid).toBe(true);
  });

  it('case-insensitive: lowercase "claude" and "anthropic" are still caught', () => {
    const result = validateNarration(
      contract,
      wrapAsAllNarrationFields('This answer came from claude, made by anthropic.'),
    );
    expect(result.valid).toBe(false);
  });
});
