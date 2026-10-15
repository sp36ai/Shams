/**
 * narrationFallback.ts — the deterministic response used when narration
 * fails validation.
 * --------------------------------------------------------------------------
 * PHASE 4. See docs/audit/PHASE_4_SAFETY_VALIDATION_IMPLEMENTATION.md.
 *
 * Not a second AI call, not a retry, not a "repair" of the rejected text —
 * a template filled in exclusively from `ReadingContract` fields already
 * settled before narration ever ran. Every sentence below is built from a
 * fixed string plus a contract value; nothing here is invented, and nothing
 * here can vary between two readings with the identical contract (verified:
 * narrationValidator.test.ts's determinism test).
 *
 * Voice (audit 2026-10-15): the same warm, direct, answer-first register as
 * watchOracleSynthesisPrompt.ts, still deliberately plain — no imagery, no
 * claim the contract does not hold. The earlier template leaked engine terms
 * to seekers ("Mars is the obstructing influence", "MoonDisagreement", "the
 * querent's ruler regards the ruler of the matter as an enemy") and read
 * remedy names as a broken sentence ("Consider Relationship Counselling, …
 * are indicated").
 */

import type { ReadingContract } from './readingContract';
import type { NarrationFields } from './responseComposer';
import { agentGlossedName } from './agentNames';

type Outcome = ReadingContract['diagnosis']['outcome'];
type Pattern = ReadingContract['diagnosis']['primaryPattern'];
type Posture = ReadingContract['diagnosis']['timingPosture'];

/** The answer, first, in plain words. */
const OUTCOME_ANSWER: Readonly<Record<Outcome, string>> = Object.freeze({
  FAVOURABLE: 'Yes, the way is open for this.',
  UNFAVOURABLE: 'Not as things stand. The chart does not support this in its present form.',
  DELAYED: 'Not yet. This can still come, but later than you hoped.',
  UNCERTAIN: 'The chart has not settled on this yet. The signal is mixed.',
  CONDITIONAL: 'Yes, but only once something gives way first.',
  PREMATURE: 'The matter is sound, but its time has not come yet.',
  ESCALATING: 'This is gathering strength.',
  DECLINING: 'The opening in this matter is fading.',
});

/** What the outcome means for the seeker's decision. */
const OUTCOME_MEANING: Readonly<Record<Outcome, string>> = Object.freeze({
  FAVOURABLE: 'Nothing in the reading is holding this back.',
  UNFAVOURABLE: 'Pushing harder now is unlikely to change it.',
  DELAYED: 'This is a delay, not a refusal. Do not read the wait as a no.',
  UNCERTAIN: 'It is worth asking again later, once things have moved.',
  CONDITIONAL: 'The matter can stand, but not until that condition is met.',
  PREMATURE: 'This is about timing, not about the matter itself.',
  ESCALATING: 'What you put into it now is likely to build.',
  DECLINING: 'If you act, act on what is already in front of you.',
});

const PATTERN_LABEL: Readonly<Record<Pattern, string>> = Object.freeze({
  OBSTRUCTION: 'something standing across the path',
  UNCERTAINTY: 'uncertainty',
  CONFLICT: 'conflict between the people involved',
  INSTABILITY: 'instability',
  ATTACHMENT: 'an attachment that is hard to let go of',
  HASTE: 'haste',
  POOR_TIMING: 'timing that does not fit yet',
  EXTERNAL_OPPOSITION: 'opposition from someone else',
  NEEDS_PATIENCE: 'a need for patience',
  NEEDS_DECISIVE_ACTION: 'a need for a clear decision',
  FAVOURABLE_FLOW: 'a favourable flow',
});

const POSTURE_ADVICE: Readonly<Record<Posture, string>> = Object.freeze({
  ACT_NOW: 'Act on this while the way is open.',
  ACT_SOON: 'A near window is open. Act within it.',
  WAIT: 'Hold back for now, and do not force the next step.',
  WAIT_LONG: 'This needs a longer wait before it settles. Keep every step reversible.',
  UNKNOWN: 'The reading gives no clear timing here, so move carefully.',
});

const OUTCOME_SIGNATURE: Readonly<Record<Outcome, string>> = Object.freeze({
  FAVOURABLE: 'A good door. Walk through it.',
  UNFAVOURABLE: 'Not this door, not now.',
  DELAYED: 'Slow, but not closed.',
  UNCERTAIN: 'Ask again when the water has settled.',
  CONDITIONAL: 'Open, once the knot is loosened.',
  PREMATURE: 'Right matter, early hour.',
  ESCALATING: 'It is building.',
  DECLINING: 'Take what is in reach.',
});

function finding(diagnosis: ReadingContract['diagnosis']): string {
  const agent = agentGlossedName(diagnosis.obstructingAgent);
  return agent === null
    ? OUTCOME_ANSWER[diagnosis.outcome]
    : `${OUTCOME_ANSWER[diagnosis.outcome]} ${agent}, is what holds it back.`;
}

/** At most the two leading patterns: the reading's character, not its audit trail. */
function interpretationFor(diagnosis: ReadingContract['diagnosis']): string {
  const patterns = [diagnosis.primaryPattern, ...diagnosis.secondaryPatterns]
    .filter((p, i, all) => all.indexOf(p) === i)
    .map(p => PATTERN_LABEL[p])
    .filter((label): label is string => label !== undefined)
    .slice(0, 2);
  const shape =
    patterns.length === 0
      ? ''
      : `What the reading shows around this is ${patterns.join(' and ')}. `;
  return `${shape}${OUTCOME_MEANING[diagnosis.outcome]}`;
}

function timingWindowSentence(timing: { minDays: number; maxDays: number } | null): string {
  if (timing === null) {
    return '';
  }
  return timing.minDays === timing.maxDays
    ? ` The window is around ${timing.minDays} day${timing.minDays === 1 ? '' : 's'}.`
    : ` The window is ${timing.minDays} to ${timing.maxDays} days.`;
}

/**
 * Deterministic fallback narration, built entirely from contract data. Plain
 * by design: a template must not imitate inspiration it does not have, so it
 * speaks the settled reading simply and claims nothing beyond it.
 */
export function buildDeterministicFallbackNarration(contract: ReadingContract): NarrationFields {
  const { diagnosis, remedy } = contract;

  const why_this_remedy =
    remedy.interventionRequired && remedy.steps.length > 0
      ? remedy.steps.length === 1
        ? 'The step counselled below is what the tradition offers for this pattern.'
        : `The ${remedy.steps.length} steps counselled below are what the tradition offers for this pattern.`
      : remedy.guidance;

  return {
    rkp_finding: finding(diagnosis),
    interpretation: interpretationFor(diagnosis),
    recommended_approach: `${POSTURE_ADVICE[diagnosis.timingPosture]}${timingWindowSentence(diagnosis.timing)}`,
    why_this_remedy,
    signature: OUTCOME_SIGNATURE[diagnosis.outcome],
  };
}
