import { describe, expect, it } from 'vitest';
import { buildWatchChart } from '../../engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';
import { diagnose } from '../../engine/rkp/diagnosis';
import { selectRemedyProtocol } from '../remedySelection';
import { toBoundaryPlanetName } from '../../utils/planetBoundaryName';
import { buildReadingContract, type ReadingContract } from '../readingContract';
import { checkNewQuestionReply, validateDiscussionReply } from '../discussionComposer';
import { validateNarration, type ValidationResult } from '../narrationValidator';
import { REMEDY_LIBRARY } from '../remedyLibrary';
import type { NarrationFields } from '../responseComposer';
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

type Outcome = ReadingContract['diagnosis']['outcome'];

/** The same real reading, with its settled outcome replaced. */
function withOutcome(contract: ReadingContract, outcome: Outcome): ReadingContract {
  return { ...contract, diagnosis: { ...contract.diagnosis, outcome } };
}

/** The failure codes a result carries — empty when it passed. */
function codesOf(result: ValidationResult): string[] {
  return result.valid ? [] : result.failures.map(f => f.code);
}

/** A reading in the new voice, opening with the given indication. */
function voiced(opening: string, overrides: Partial<NarrationFields> = {}): NarrationFields {
  return {
    rkp_finding: `${opening} Beneath your question sits a worry about what you have already given to this matter.`,
    interpretation:
      'There is another layer to this matter: what feels like silence is the pace of the current, not its end.',
    recommended_approach:
      'While this unfolds, the matter within your control is how you prepare. Place your trust in Allah, and take the means available to you.',
    why_this_remedy:
      'The counsel given with this reading answers a pattern that asks for sabr, patience, rather than force.',
    signature: 'The page turns slowly, and the scroll is not yet closed.',
    ...overrides,
  };
}

/**
 * One opening per outcome class, written the way the synthesis prompt now
 * asks: the indication first, in the class's own sense — a delay stays a
 * delay, an unsettled chart is said to be unsettled.
 */
const OPENING_FOR: Readonly<Record<Outcome, string>> = {
  FAVOURABLE: 'The indication is that the path is open to you.',
  ESCALATING: 'The indication is that this matter is gathering strength.',
  UNFAVOURABLE: 'The indication is that this door does not open to you.',
  DECLINING: 'The indication is that this matter is losing its footing.',
  DELAYED: 'The path appears delayed, not necessarily closed.',
  UNCERTAIN: 'The signs do not yet give a clear answer.',
  CONDITIONAL: 'The indication is that the matter can stand, but only through change.',
  PREMATURE: 'The indication is that this was asked before its time had ripened.',
};

const POSITIVE: readonly Outcome[] = ['FAVOURABLE', 'ESCALATING'];
const NEGATIVE: readonly Outcome[] = ['UNFAVOURABLE', 'DECLINING'];
const ALL_OUTCOMES = Object.keys(OPENING_FOR) as Outcome[];

describe('a voiced first reading, for every outcome class', () => {
  const base = waitingContract();

  it.each(ALL_OUTCOMES)('%s: an opening true to the class passes', outcome => {
    expect(
      codesOf(validateNarration(withOutcome(base, outcome), voiced(OPENING_FOR[outcome]))),
    ).toEqual([]);
  });

  it.each(ALL_OUTCOMES.filter(o => !POSITIVE.includes(o)))(
    '%s: an indication that turns it into a yes is rejected',
    outcome => {
      const result = validateNarration(
        withOutcome(base, outcome),
        voiced('The indication is plain: the answer is yes.'),
      );
      expect(codesOf(result)).toContain('VERDICT_CONTRADICTION');
    },
  );

  it.each(ALL_OUTCOMES.filter(o => !NEGATIVE.includes(o)))(
    '%s: an indication that turns it into a refusal is rejected',
    outcome => {
      const result = validateNarration(
        withOutcome(base, outcome),
        voiced('The indication is that the matter is blocked.'),
      );
      expect(codesOf(result)).toContain('VERDICT_CONTRADICTION');
    },
  );

  it.each(['DELAYED', 'UNCERTAIN', 'CONDITIONAL', 'PREMATURE'] as Outcome[])(
    '%s: a qualified reading spoken with certainty is rejected',
    outcome => {
      const result = validateNarration(
        withOutcome(base, outcome),
        voiced('The indication is that this will certainly come to you.'),
      );
      expect(codesOf(result)).toContain('UNSUPPORTED_CERTAINTY');
    },
  );
});

describe("the voice's religious and celestial vocabulary", () => {
  const base = waitingContract();
  // No planet in the reading at all, so every planet name is unlisted.
  const noPlanets: ReadingContract = { ...base, celestialEntities: [] };

  it('accepts sabr, tawakkul and a generic duʿāʾ with no planet named', () => {
    const result = validateNarration(
      noPlanets,
      voiced('The indication is that this asks for sabr, patience.', {
        why_this_remedy:
          'The duʿāʾ given with this reading is a supplication of tawakkul, trust in Allah, not a lever on the outcome.',
      }),
    );
    expect(codesOf(result)).toEqual([]);
  });

  it('accepts the oracle naming itself as Shams al-Asrār', () => {
    const result = validateNarration(
      noPlanets,
      voiced('The indication, as Shams al-Asrār reads it, is that this asks for patience.'),
    );
    expect(codesOf(result)).toEqual([]);
  });

  it.each(['Shams', 'Qamar', 'Zuhal'])('rejects %s when the reading does not name it', name => {
    const result = validateNarration(
      noPlanets,
      voiced(`The indication is that ${name} watches over this matter.`),
    );
    expect(codesOf(result)).toContain('UNAUTHORIZED_CELESTIAL_ENTITY');
  });

  it('rejects a remedy this reading did not select, named as its duʿāʾ', () => {
    const selected = new Set(base.remedy.steps.map(s => s.id));
    const other = REMEDY_LIBRARY.find(r => !selected.has(r.id));
    expect(other).toBeDefined();
    const result = validateNarration(
      base,
      voiced('The indication is that this asks for patience.', {
        why_this_remedy: `The supplication given with this reading is ${other!.name}.`,
      }),
    );
    expect(codesOf(result)).toContain(
      base.remedy.steps.length > 0 ? 'REMEDY_SUBSTITUTION' : 'REMEDY_ADDITION',
    );
  });

  it('accepts a reading with no remedy justification, why_this_remedy null', () => {
    const result = validateNarration(
      base,
      voiced(OPENING_FOR[base.diagnosis.outcome], { why_this_remedy: null }),
    );
    expect(codesOf(result)).toEqual([]);
  });

  it('rejects a voiced reading with a required field left empty', () => {
    const result = validateNarration(base, voiced('', { interpretation: '' }));
    expect(codesOf(result)).toContain('MALFORMED_OUTPUT');
  });
});

describe('a voiced follow-up', () => {
  const base = waitingContract();

  it('may refer back to the standing reading and its own window', () => {
    const reply =
      'Then the heart of your concern is money already given and not yet returned. The reading you hold speaks of a path delayed, not necessarily closed, and the indicated window is 45 to 90 days.';
    expect(validateDiscussionReply(base, reply).valid).toBe(true);
  });

  it('may not give that reading a window it does not carry', () => {
    const reply =
      'The path appears delayed, not necessarily closed; the indicated window is 10 to 20 days.';
    expect(validateDiscussionReply(base, reply).valid).toBe(false);
  });

  it('may meet a shifted concern without judging it, when flagged as a new question', () => {
    const reply =
      'Then the heart of your concern is not new business but money already earned and not yet returned. This reading was cast for a different matter, so it cannot give a verdict on recovering those payments.';
    expect(validateDiscussionReply(base, reply).valid).toBe(true);
    expect(checkNewQuestionReply(reply, true)).toBeNull();
  });

  it('may not give a verdict on the shifted concern it flagged as new', () => {
    const reply =
      'Then the heart of your concern is money not yet returned, and the answer is yes: it will come back.';
    expect(checkNewQuestionReply(reply, true)).toBe('the answer is yes');
  });
});
