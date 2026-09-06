/**
 * Suggested Questions — the "what to ask next" layer.
 * --------------------------------------------------------------------------
 * Input:  an RkpDiagnosis and the question's domain (never a raw chart)
 * Output: 2–4 candidate follow-up questions, or none
 *
 * Same discipline as remedySelection.ts, deliberately: wholly deterministic,
 * so a seeker never sees a suggestion the diagnosis doesn't actually support.
 * These are doors into a NEW watch reading, not answers — a tap only fills
 * the seeker's message box (see SuggestedQuestionsRow.tsx and ChatBubble.tsx)
 * and the existing ask-as-new-question / discussReading routing decides what
 * happens next, exactly as it does for anything the seeker types by hand.
 *
 * Templates are keyed by question domain first, then filtered by what the
 * diagnosis actually shows — a finance reading that is already FAVOURABLE
 * and ACT_NOW has nothing to say about "what is causing the delay?", so that
 * template never surfaces for it.
 */

import type { QuestionType } from '../engine/kp/rules/houseMatrix';
import type { RkpDiagnosis } from '../engine/rkp/diagnosis';

// `diagnosis.qType` already carries the domain — see RkpDiagnosis.qType.

/** Ceiling on what's shown — beyond this it stops reading as a short list. */
const MAX_SUGGESTIONS = 4;

interface Candidate {
  readonly text: string;
  /** True when the diagnosis actually supports asking this. */
  readonly applies: (d: RkpDiagnosis) => boolean;
}

const isDelayed = (d: RkpDiagnosis): boolean =>
  d.timingPosture === 'WAIT' || d.timingPosture === 'WAIT_LONG';

const isAdverse = (d: RkpDiagnosis): boolean =>
  d.outcome === 'UNFAVOURABLE' || d.outcome === 'DECLINING';

const isObstructed = (d: RkpDiagnosis): boolean =>
  d.primaryPattern === 'OBSTRUCTION' ||
  d.primaryPattern === 'EXTERNAL_OPPOSITION' ||
  d.secondaryPatterns.includes('OBSTRUCTION') ||
  d.secondaryPatterns.includes('EXTERNAL_OPPOSITION');

const hasAgent = (d: RkpDiagnosis): boolean => d.obstructingAgent !== null;

const isUnsettled = (d: RkpDiagnosis): boolean =>
  d.outcome === 'UNCERTAIN' || d.primaryPattern === 'UNCERTAINTY';

const isConditional = (d: RkpDiagnosis): boolean =>
  d.outcome === 'CONDITIONAL' || d.outcome === 'PREMATURE';

const always = (): boolean => true;

/**
 * Candidate bank per domain. Order is preference, not guarantee — filtering
 * by `applies` can drop any entry, and the first MAX_SUGGESTIONS survivors
 * are kept.
 */
const BANK: Readonly<Record<QuestionType, readonly Candidate[]>> = Object.freeze({
  finance: [
    { text: 'Where is the money likely to come from?', applies: always },
    { text: 'When does the stronger financial movement begin?', applies: isDelayed },
    { text: 'What is causing the delay?', applies: isDelayed },
    { text: 'What should I avoid financially right now?', applies: isAdverse },
    { text: 'Is there a way through the obstruction?', applies: isObstructed },
  ],
  business: [
    { text: 'Is my business connected to this?', applies: always },
    { text: 'Is this the right time to expand?', applies: always },
    { text: 'What is standing in the way?', applies: isObstructed },
    { text: 'Should I wait before committing further?', applies: isDelayed },
  ],
  property: [
    { text: 'When is the strongest period to sell?', applies: always },
    { text: 'Is waiting beneficial here?', applies: isDelayed },
    { text: 'What is obstructing the sale?', applies: isObstructed },
    { text: 'Should I accept the next serious offer?', applies: isConditional },
  ],
  marriage: [
    { text: 'Will communication resume?', applies: always },
    { text: 'What is causing the distance?', applies: isObstructed },
    { text: 'Is reconciliation genuinely possible?', applies: always },
    { text: 'What should I do — and what should I avoid?', applies: always },
  ],
  career: [
    { text: 'When is the stronger movement in this?', applies: isDelayed },
    { text: 'Is this the right opportunity to pursue?', applies: isConditional },
    { text: 'What is holding this back?', applies: isObstructed },
    { text: 'Should I stay or look elsewhere?', applies: isUnsettled },
  ],
  legal: [
    { text: 'What is the likely timing of a resolution?', applies: always },
    { text: 'What should I prepare in the meantime?', applies: always },
    { text: 'What is working against a favourable outcome?', applies: isAdverse },
  ],
  health: [
    { text: 'What does the timing suggest for recovery?', applies: isDelayed },
    { text: 'What should I be watchful of?', applies: always },
  ],
  travel: [
    { text: 'Is this the right time to travel?', applies: always },
    { text: 'What could delay or disrupt the journey?', applies: isObstructed },
  ],
  education: [
    { text: 'Is this the right path to pursue?', applies: always },
    { text: 'What is causing the uncertainty?', applies: isUnsettled },
  ],
  children: [
    { text: 'What does the timing suggest here?', applies: isDelayed },
    { text: 'What should I be attentive to?', applies: always },
  ],
  lostitem: [
    { text: 'Is recovery still possible?', applies: always },
    { text: 'Through whom might it return?', applies: hasAgent },
  ],
  enemies: [
    { text: 'What is the source of this opposition?', applies: hasAgent },
    { text: 'What should I do to protect this matter?', applies: isAdverse },
  ],
  spiritual: [
    { text: 'What does this pattern want me to understand?', applies: always },
    { text: 'What practice would suit this moment?', applies: always },
  ],
  general: [
    { text: 'What is the strongest factor here?', applies: always },
    { text: 'What should I watch for next?', applies: always },
  ],
});

/**
 * Choose 2–4 follow-up questions this diagnosis actually supports.
 *
 * Never invents a question the diagnosis has no basis for — an empty result
 * is a valid and honest answer for a reading with nothing further to open.
 */
export function selectSuggestedQuestions(diagnosis: RkpDiagnosis): readonly string[] {
  const bank = BANK[diagnosis.qType] ?? BANK.general;
  return bank
    .filter(c => c.applies(diagnosis))
    .slice(0, MAX_SUGGESTIONS)
    .map(c => c.text);
}
