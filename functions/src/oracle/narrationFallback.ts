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
 * `narrationFallback.test.ts`'s determinism test).
 */

import type { ReadingContract } from './readingContract';
import type { NarrationFields } from './responseComposer';

const OUTCOME_LABEL: Readonly<Record<ReadingContract['diagnosis']['outcome'], string>> =
  Object.freeze({
    FAVOURABLE: 'The chart supports this matter.',
    UNFAVOURABLE: 'The chart does not support this matter as it stands.',
    DELAYED: 'The matter may materialise, though not on the timeline hoped for.',
    UNCERTAIN: 'The chart has not settled on this matter; the signal is mixed.',
    CONDITIONAL: 'The matter is supported, but with a condition still to be met.',
    PREMATURE: 'The matter is sound, but the timing is not yet ready for it.',
    ESCALATING: 'The matter is gathering strength.',
    DECLINING: 'The opportunity in this matter is weakening.',
  });

/**
 * The diagnosis's imbalance patterns, as the seeker reads them. The engine's
 * own `rationale` names these as tokens ("indicates UNCERTAINTY +
 * INSTABILITY") — it is an audit record, not prose — so the fallback states
 * the patterns from this table instead of repeating it.
 */
const PATTERN_LABEL: Readonly<Record<ReadingContract['diagnosis']['primaryPattern'], string>> =
  Object.freeze({
    OBSTRUCTION: 'obstruction',
    UNCERTAINTY: 'uncertainty',
    CONFLICT: 'conflict between the parties',
    INSTABILITY: 'instability',
    ATTACHMENT: 'attachment that is hard to release',
    HASTE: 'haste',
    POOR_TIMING: 'timing that does not yet fit',
    EXTERNAL_OPPOSITION: 'opposition from another party',
    NEEDS_PATIENCE: 'a need for patience',
    NEEDS_DECISIVE_ACTION: 'a need for decisive action',
    FAVOURABLE_FLOW: 'a favourable flow',
  });

/** An engine token anywhere in a sentence: BLOCKED, UNFAVOURABLE, POOR_TIMING. */
const ENGINE_TOKEN = /\b[A-Z]{2,}(?:_[A-Z]+)*\b/;

function joinLabels(labels: readonly string[]): string {
  return labels.length <= 1
    ? (labels[0] ?? '')
    : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/**
 * The interpretation: the patterns in plain words, then whichever lines of
 * the engine's rationale are already plain prose. Lines carrying an engine
 * token are left out — what they say is either the outcome (rkp_finding
 * already states it) or the patterns (stated here from PATTERN_LABEL).
 */
function interpretationFor(diagnosis: ReadingContract['diagnosis']): string {
  const patterns = [diagnosis.primaryPattern, ...diagnosis.secondaryPatterns]
    .filter((p, i, all) => all.indexOf(p) === i)
    .map(p => PATTERN_LABEL[p])
    .filter((label): label is string => label !== undefined);
  const sentences: string[] = [];
  if (patterns.length > 0) {
    sentences.push(`The pattern the chart shows is ${joinLabels(patterns)}.`);
  }
  sentences.push(...diagnosis.rationale.filter(line => !ENGINE_TOKEN.test(line)));
  return sentences.length > 0 ? sentences.join(' ') : `This reading concerns ${diagnosis.qType}.`;
}

const TIMING_POSTURE_LABEL: Readonly<
  Record<ReadingContract['diagnosis']['timingPosture'], string>
> = Object.freeze({
  ACT_NOW: 'Act on this without delay.',
  ACT_SOON: 'A near window is open — act within it.',
  WAIT: 'Wait before acting further.',
  WAIT_LONG: 'A longer wait is indicated before this settles.',
  UNKNOWN: 'The chart gives no clear timing signal here.',
});

function timingWindowSentence(timing: { minDays: number; maxDays: number } | null): string {
  if (timing === null) {
    return '';
  }
  return timing.minDays === timing.maxDays
    ? ` The window is around ${timing.minDays} day${timing.minDays === 1 ? '' : 's'}.`
    : ` The window is ${timing.minDays} to ${timing.maxDays} days.`;
}

/**
 * Builds a complete, valid `NarrationFields` object using only contract
 * data. Deliberately plain rather than an attempt at the mystical register
 * — reproducing that voice deterministically from a template would itself
 * risk reading as a fabricated claim; honest and unadorned is the safer
 * choice for a safety fallback specifically.
 */
export function buildDeterministicFallbackNarration(contract: ReadingContract): NarrationFields {
  const { diagnosis, remedy } = contract;

  const rkp_finding = `${OUTCOME_LABEL[diagnosis.outcome]}${diagnosis.obstructingAgent ? ` ${diagnosis.obstructingAgent} is the obstructing influence.` : ''}`;

  const interpretation = interpretationFor(diagnosis);

  const recommended_approach = `${TIMING_POSTURE_LABEL[diagnosis.timingPosture]}${timingWindowSentence(diagnosis.timing)}`;

  const why_this_remedy =
    remedy.interventionRequired && remedy.steps.length > 0
      ? `${remedy.steps.map(s => s.name).join(', ')} ${remedy.steps.length === 1 ? 'is' : 'are'} indicated for this reading.`
      : remedy.guidance;

  return {
    rkp_finding,
    interpretation,
    recommended_approach,
    why_this_remedy,
    signature: 'This reading stands as the chart has cast it.',
  };
}
