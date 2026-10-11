import { describe, expect, it } from 'vitest';
import { buildWatchChart } from '../../engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';
import { diagnose } from '../../engine/rkp/diagnosis';
import { selectRemedyProtocol } from '../remedySelection';
import { toBoundaryPlanetName } from '../../utils/planetBoundaryName';
import { buildReadingContract, type ReadingContract } from '../readingContract';
import { validateDiscussionReply } from '../discussionComposer';
import { ORACLE_DISCUSSION_PROMPT } from '../../prompts/oracleDiscussionPrompt';
import { WATCH_ORACLE_SYNTHESIS_PROMPT } from '../../prompts/watchOracleSynthesisPrompt';

/**
 * Both prompts ask the model for the same signature turns of phrase. If the
 * validator rejected any of them, a model that followed the prompt would
 * have every reading replaced by the deterministic fallback, and every
 * follow-up refused — so each phrase is checked here against a real reading
 * whose timing posture is WAIT, the posture with the strictest wording rules.
 */
function waitingContract(): ReadingContract {
  const chart = buildWatchChart('2026-10-08T13:00:00+05:30');
  const rawVerdict = judgeWatchChart(chart, 'general');
  const verdict: DisplayWatchVerdict = {
    ...rawVerdict,
    obstruction: toBoundaryPlanetName(rawVerdict.obstruction),
    targetRuler: toBoundaryPlanetName(rawVerdict.targetRuler),
    lagnaRuler: toBoundaryPlanetName(rawVerdict.lagnaRuler),
  };
  const diagnosis = diagnose(verdict);
  return buildReadingContract({
    readingId: 'r-voice',
    computedAt: new Date('2026-10-08T07:30:00.000Z'),
    question: 'Will my business improve this month?',
    verdict,
    diagnosis,
    protocol: selectRemedyProtocol(diagnosis),
  });
}

const SIGNATURE_PHRASES = [
  'The indication is that this matter asks for patience.',
  'There is another layer to this matter.',
  'The path appears delayed, not necessarily closed.',
  'The signs do not yet give a clear answer.',
  'While this unfolds, the matter within your control is how you prepare.',
  'Place your trust in Allah, and take the means available to you.',
  'Sabr, patience, is the posture this reading counsels, with tawakkul, trust in Allah.',
];

describe('the oracle voice phrases', () => {
  const contract = waitingContract();

  it('are built on a reading that says wait', () => {
    expect(contract.diagnosis.timingPosture).toBe('WAIT');
  });

  it.each(SIGNATURE_PHRASES)('passes validation: %s', phrase => {
    expect(validateDiscussionReply(contract, phrase).valid).toBe(true);
  });

  it('are asked for by both prompts', () => {
    for (const prompt of [WATCH_ORACLE_SYNTHESIS_PROMPT, ORACLE_DISCUSSION_PROMPT]) {
      expect(prompt).toContain('The path appears delayed, not necessarily closed.');
      expect(prompt).toContain('Place your trust in Allah, and take the means available to you.');
    }
  });
});
