/**
 * Controlled remedy library for the RKP path.
 * --------------------------------------------------------------------------
 * Every intervention Shams can offer lives here. The selection engine may only
 * choose from this file — nothing downstream, and certainly not the language
 * model, may invent a remedy at request time.
 *
 * Five levels, in ascending order of claim:
 *   1 contemplative — lowest-risk; asks only for attention
 *   2 devotional    — practices within the seeker's tradition
 *   3 astrological  — traditional correspondences, labelled as such
 *   4 behavioral    — concrete action or deliberate inaction
 *   5 practical     — escalation to a qualified human professional
 *
 * `evidenceType` is carried on every entry and surfaced to the seeker so a
 * traditional correspondence is never presented with the authority of a
 * scriptural one.
 *
 * Deviation from the original schema sketch: `targetConditions`, `suitableFor`
 * and `avoidFor` are typed unions rather than string[]. A mistyped condition
 * in a plain string array would silently never match; the union makes it a
 * compile error.
 */

import type { QuestionType } from '../engine/rules/houseMatrix';
import type { ImbalancePattern, RkpOutcome } from '../engine/rkp/diagnosis';

export type RemedyCategory =
  | 'contemplative'
  | 'devotional'
  | 'astrological'
  | 'behavioral'
  | 'practical';

/**
 * 'universal' remedies carry no religious claim and are offered to everyone;
 * 'islamic' remedies are offered when the seeker's tradition admits them.
 */
export type Tradition = 'universal' | 'islamic';

export type EvidenceType = 'scriptural' | 'traditional' | 'astrological' | 'behavioral';

export type RemedyIntensity = 'low' | 'moderate' | 'high';

export interface Remedy {
  readonly id: string;
  readonly name: string;
  readonly category: RemedyCategory;
  readonly traditions: readonly Tradition[];
  /** Imbalance patterns this intervention is aimed at. */
  readonly targetConditions: readonly ImbalancePattern[];
  readonly planetaryCorrespondences?: readonly string[];
  readonly houseCorrespondences?: readonly number[];
  readonly suitableFor: readonly RkpOutcome[];
  readonly avoidFor?: readonly RkpOutcome[];
  readonly intensity: RemedyIntensity;
  readonly duration?: string;
  readonly evidenceType: EvidenceType;
  /** Why this intervention answers this condition. Shown as "why this remedy". */
  readonly explanation: string;
  readonly instructions: readonly string[];
  /**
   * Present only on level-5 entries. When the question is of one of these
   * types, the safety filter promotes this remedy ahead of everything else.
   */
  readonly escalationFor?: readonly QuestionType[];
}

const ALL_OUTCOMES: readonly RkpOutcome[] = [
  'FAVOURABLE',
  'UNFAVOURABLE',
  'DELAYED',
  'UNCERTAIN',
  'CONDITIONAL',
  'PREMATURE',
  'ESCALATING',
  'DECLINING',
];

export const REMEDY_LIBRARY: readonly Remedy[] = Object.freeze([
  /* ── Level 1 — Contemplative ─────────────────────────────────────────── */
  {
    id: 'contemplative_pause',
    name: 'Deliberate Pause',
    category: 'contemplative',
    traditions: ['universal'],
    targetConditions: ['HASTE', 'POOR_TIMING', 'NEEDS_PATIENCE'],
    suitableFor: ['DELAYED', 'PREMATURE', 'CONDITIONAL', 'UNCERTAIN'],
    avoidFor: ['DECLINING'],
    intensity: 'low',
    duration: 'Until the indicated window opens',
    evidenceType: 'behavioral',
    explanation:
      'The reading indicates pressure to move before conditions are ready. A defined pause converts that pressure into a decision you control.',
    instructions: [
      'Name the single decision you feel pressed to make.',
      'Set a specific date before which you will not make it.',
      'Record what would have to change for the answer to be obvious.',
    ],
  },
  {
    id: 'contemplative_silence',
    name: 'Period of Silence',
    category: 'contemplative',
    traditions: ['universal'],
    targetConditions: ['CONFLICT', 'UNCERTAINTY', 'EXTERNAL_OPPOSITION'],
    suitableFor: ['UNFAVOURABLE', 'UNCERTAIN', 'CONDITIONAL', 'DECLINING'],
    intensity: 'low',
    duration: 'Three days',
    evidenceType: 'behavioral',
    explanation:
      'Where the chart shows friction with another party, withdrawing speech for a set period removes the fuel without conceding the matter.',
    instructions: [
      'For three days, say nothing further about this matter to anyone involved.',
      'Note what you wanted to say and why, without sending it.',
    ],
  },
  {
    id: 'contemplative_journal',
    name: 'Written Examination',
    category: 'contemplative',
    traditions: ['universal'],
    targetConditions: ['UNCERTAINTY', 'ATTACHMENT'],
    suitableFor: ['UNCERTAIN', 'CONDITIONAL', 'DELAYED', 'PREMATURE'],
    intensity: 'low',
    duration: 'One sitting',
    evidenceType: 'behavioral',
    explanation:
      'Conflicting indications in the chart usually mirror a question that has not been stated precisely. Writing it out separates what you know from what you fear.',
    instructions: [
      'Write the question in one sentence, without qualifiers.',
      'List separately: what you know, what you assume, what you fear.',
      'Mark which assumptions could be checked this week.',
    ],
  },
  {
    id: 'contemplative_detachment',
    name: 'Releasing the Outcome',
    category: 'contemplative',
    traditions: ['universal'],
    targetConditions: ['ATTACHMENT', 'HASTE'],
    suitableFor: ['DELAYED', 'PREMATURE', 'CONDITIONAL', 'UNFAVOURABLE'],
    intensity: 'moderate',
    duration: 'Daily, one week',
    evidenceType: 'behavioral',
    explanation:
      'The reading shows the matter held tightly. Attachment to a particular result narrows what you can notice about the actual situation.',
    instructions: [
      'Each day, write one sentence describing an acceptable outcome that is not the one you want.',
      'At week end, reread them and note which has become tolerable.',
    ],
  },
  {
    id: 'contemplative_decision_review',
    name: 'Structured Decision Review',
    category: 'contemplative',
    traditions: ['universal'],
    targetConditions: ['UNCERTAINTY', 'NEEDS_DECISIVE_ACTION'],
    suitableFor: ['ESCALATING', 'CONDITIONAL', 'UNCERTAIN', 'FAVOURABLE'],
    intensity: 'low',
    duration: 'One sitting',
    evidenceType: 'behavioral',
    explanation:
      'The indications support movement but do not choose for you. A structured review turns a favourable reading into an actual plan.',
    instructions: [
      'List the options, including doing nothing.',
      'For each, write the worst credible outcome and whether you could absorb it.',
      'Choose the option whose worst case you can carry.',
    ],
  },
  {
    id: 'contemplative_gratitude',
    name: 'Gratitude Inventory',
    category: 'contemplative',
    traditions: ['universal'],
    targetConditions: ['FAVOURABLE_FLOW', 'ATTACHMENT'],
    suitableFor: ['FAVOURABLE', 'ESCALATING'],
    intensity: 'low',
    duration: 'One sitting',
    evidenceType: 'behavioral',
    explanation:
      'When conditions are already supportive, the useful work is noticing what is in place rather than seeking further intervention.',
    instructions: ['Name three things about this matter that are already settled in your favour.'],
  },

  /* ── Level 2 — Devotional ────────────────────────────────────────────── */
  {
    id: 'devotional_istikhara',
    name: 'Ṣalāt al-Istikhārah',
    category: 'devotional',
    traditions: ['islamic'],
    targetConditions: ['UNCERTAINTY', 'NEEDS_DECISIVE_ACTION'],
    suitableFor: ['UNCERTAIN', 'CONDITIONAL', 'ESCALATING', 'DELAYED'],
    intensity: 'moderate',
    duration: 'Before the decision, repeated as needed',
    evidenceType: 'scriptural',
    explanation:
      'The prayer of seeking guidance is the established practice when a permissible choice remains genuinely open — which is what conflicting significators describe.',
    instructions: [
      'Pray two rakʿahs outside the obligatory prayers.',
      'Recite the duʿā of istikhārah, naming the matter plainly.',
      'Proceed with what settles in your heart, without expecting a dream.',
    ],
  },
  {
    id: 'devotional_dua_ease',
    name: 'Duʿā for Ease',
    category: 'devotional',
    traditions: ['islamic'],
    targetConditions: ['OBSTRUCTION', 'NEEDS_PATIENCE'],
    suitableFor: ['UNFAVOURABLE', 'DELAYED', 'PREMATURE', 'CONDITIONAL'],
    intensity: 'low',
    duration: 'Daily until the matter resolves',
    evidenceType: 'scriptural',
    explanation:
      'Where the reading shows a path narrowed rather than closed, the traditional response is to ask for the narrowing to ease.',
    instructions: [
      'Recite: Allāhumma lā sahla illā mā jaʿaltahu sahlan.',
      '("O Allah, there is no ease except what You make easy.")',
      'Say it once each morning while the matter is pending.',
    ],
  },
  {
    id: 'devotional_istighfar',
    name: 'Seeking Forgiveness',
    category: 'devotional',
    traditions: ['islamic'],
    targetConditions: ['CONFLICT', 'OBSTRUCTION'],
    suitableFor: ['UNFAVOURABLE', 'DECLINING', 'CONDITIONAL'],
    intensity: 'low',
    duration: '100 times daily, seven days',
    evidenceType: 'scriptural',
    explanation:
      'Istighfār is prescribed in connection with relief from constraint and is appropriate where the obstruction pattern is persistent.',
    instructions: ['Recite Astaghfirullāh 100 times daily for seven days.'],
  },
  {
    id: 'devotional_sadaqa',
    name: 'Charity Given Quietly',
    category: 'devotional',
    traditions: ['islamic'],
    targetConditions: ['OBSTRUCTION', 'EXTERNAL_OPPOSITION'],
    suitableFor: ['UNFAVOURABLE', 'DELAYED', 'CONDITIONAL', 'DECLINING'],
    intensity: 'low',
    duration: 'Once, or weekly while pending',
    evidenceType: 'scriptural',
    explanation:
      'Charity is the established response to a matter under strain, and giving it without announcement keeps the act from becoming part of the pressure.',
    instructions: [
      'Give what you can afford without calculation.',
      'Tell no one you have given it.',
    ],
  },
  {
    id: 'devotional_quran_patience',
    name: 'Qurʾānic Contemplation on Patience',
    category: 'devotional',
    traditions: ['islamic'],
    targetConditions: ['NEEDS_PATIENCE', 'POOR_TIMING'],
    suitableFor: ['DELAYED', 'PREMATURE', 'UNFAVOURABLE'],
    intensity: 'low',
    duration: 'Daily while waiting',
    evidenceType: 'scriptural',
    explanation:
      'A delayed reading asks for endurance rather than force. Sitting with the verses on hardship and ease reframes the wait as something with a shape.',
    instructions: [
      'Read Sūrah al-Sharḥ (94) slowly, once daily.',
      'Sit briefly with the repetition: with hardship comes ease.',
    ],
  },
  {
    id: 'devotional_dhikr_steadiness',
    name: 'Dhikr for Steadiness',
    category: 'devotional',
    traditions: ['islamic'],
    targetConditions: ['INSTABILITY', 'UNCERTAINTY'],
    suitableFor: ['DECLINING', 'UNCERTAIN', 'CONDITIONAL'],
    intensity: 'low',
    duration: '33 times, morning and evening',
    evidenceType: 'scriptural',
    explanation:
      'Where the chart shows the matter liable to turn, the practice sought is steadiness in the seeker rather than control of the outcome.',
    instructions: ['Recite Lā ḥawla wa lā quwwata illā billāh 33 times, morning and evening.'],
  },
  {
    id: 'devotional_tahajjud',
    name: 'Night Prayer',
    category: 'devotional',
    traditions: ['islamic'],
    targetConditions: ['OBSTRUCTION', 'EXTERNAL_OPPOSITION'],
    suitableFor: ['UNFAVOURABLE', 'DECLINING'],
    intensity: 'high',
    duration: 'Last third of the night, as able',
    evidenceType: 'scriptural',
    explanation:
      'A heavily obstructed reading is the classical occasion for the night prayer. It is offered as a high-commitment practice, not a routine one.',
    instructions: [
      'Rise in the last third of the night and pray two rakʿahs.',
      'Ask plainly for what you need, in your own words.',
    ],
  },
  {
    id: 'devotional_shukr',
    name: 'Prayer of Thanks',
    category: 'devotional',
    traditions: ['islamic'],
    targetConditions: ['FAVOURABLE_FLOW'],
    suitableFor: ['FAVOURABLE', 'ESCALATING'],
    intensity: 'low',
    duration: 'Once',
    evidenceType: 'scriptural',
    explanation:
      'Where the indication is already favourable, thanksgiving is the fitting response — not a further request.',
    instructions: ['Pray two rakʿahs of thanks once the matter settles.'],
  },

  /* ── Level 3 — Astrological / traditional ────────────────────────────── */
  {
    id: 'astro_saturn_discipline',
    name: 'Zuhal Observance of Discipline',
    category: 'astrological',
    traditions: ['universal', 'islamic'],
    targetConditions: ['OBSTRUCTION', 'NEEDS_PATIENCE'],
    planetaryCorrespondences: ['Saturn'],
    houseCorrespondences: [6, 8, 12],
    suitableFor: ['DELAYED', 'PREMATURE', 'UNFAVOURABLE', 'CONDITIONAL'],
    intensity: 'moderate',
    duration: 'Weekly, while the matter is pending',
    evidenceType: 'astrological',
    explanation:
      'A traditional correspondence: where Zuhal carries the obstruction, the classical response is sustained, unglamorous consistency rather than force. Offered as inherited practice, not as an established mechanism.',
    instructions: [
      'Choose one small obligation connected to this matter and discharge it fully each week.',
      'Keep the same day and the same hour.',
    ],
  },
  {
    id: 'astro_mars_restraint',
    name: 'Mirrikh Restraint',
    category: 'astrological',
    traditions: ['universal', 'islamic'],
    targetConditions: ['CONFLICT', 'HASTE'],
    planetaryCorrespondences: ['Mars'],
    houseCorrespondences: [6, 7],
    suitableFor: ['UNFAVOURABLE', 'CONDITIONAL', 'DECLINING'],
    intensity: 'moderate',
    duration: 'Until the friction subsides',
    evidenceType: 'astrological',
    explanation:
      'Where Mirrikh carries the obstruction the difficulty reads as heat rather than weight, and the traditional counsel is to withhold the confrontation you feel entitled to.',
    instructions: [
      'Identify the confrontation you are preparing.',
      'Postpone it by one full week and reassess whether it is still required.',
    ],
  },
  {
    id: 'astro_node_clarification',
    name: 'Shadow-Node Clarification',
    category: 'astrological',
    traditions: ['universal', 'islamic'],
    targetConditions: ['UNCERTAINTY', 'ATTACHMENT'],
    planetaryCorrespondences: ['Rahu', 'Ras', 'Ketu', 'Dhanab'],
    houseCorrespondences: [8, 12],
    suitableFor: ['UNCERTAIN', 'CONDITIONAL', 'DECLINING'],
    intensity: 'moderate',
    duration: 'One sitting, repeated if the picture shifts',
    evidenceType: 'astrological',
    explanation:
      'The shadow nodes traditionally describe a matter seen indistinctly — appetite mistaken for direction. The corresponding practice is to separate what is actually on offer from what is imagined.',
    instructions: [
      'Write what you have been promised, in the exact words used.',
      'Write separately what you have inferred but not been told.',
      'Treat only the first list as real until the second is confirmed.',
    ],
  },
  {
    id: 'astro_moon_settling',
    name: 'Qamar Settling',
    category: 'astrological',
    traditions: ['universal', 'islamic'],
    targetConditions: ['INSTABILITY', 'UNCERTAINTY'],
    planetaryCorrespondences: ['Moon'],
    suitableFor: ['UNCERTAIN', 'DECLINING', 'CONDITIONAL'],
    intensity: 'low',
    duration: 'Three nights',
    evidenceType: 'astrological',
    explanation:
      'An unsettled Qamar traditionally indicates a reading taken while the seeker is in motion. The counsel is to let the mind settle before treating any impression as a signal.',
    instructions: [
      'Do not act on this matter for three nights.',
      'On the third night, note whether your reading of it has changed.',
    ],
  },
  {
    id: 'astro_favourable_window',
    name: 'Acting Within the Indicated Window',
    category: 'astrological',
    traditions: ['universal', 'islamic'],
    targetConditions: ['FAVOURABLE_FLOW', 'NEEDS_DECISIVE_ACTION', 'POOR_TIMING'],
    suitableFor: ['FAVOURABLE', 'ESCALATING', 'DELAYED'],
    intensity: 'low',
    evidenceType: 'astrological',
    explanation:
      'The chart carries a timing indication. The traditional counsel is to move within it rather than ahead of it.',
    instructions: [
      'Note the window given in this reading.',
      'Schedule the decisive step inside it, not before.',
    ],
  },

  /* ── Level 4 — Behavioral ────────────────────────────────────────────── */
  {
    id: 'behavioral_defer_irreversible',
    name: 'Defer the Irreversible Decision',
    category: 'behavioral',
    traditions: ['universal'],
    targetConditions: ['POOR_TIMING', 'HASTE', 'NEEDS_PATIENCE'],
    suitableFor: ['DELAYED', 'PREMATURE', 'UNFAVOURABLE', 'UNCERTAIN', 'DECLINING'],
    avoidFor: ['FAVOURABLE'],
    intensity: 'moderate',
    duration: 'Until the unfavourable period passes',
    evidenceType: 'behavioral',
    explanation:
      'The reading does not support commitment at this moment. The most useful intervention is simply not to bind yourself yet.',
    instructions: [
      'Identify which step in this matter cannot be undone.',
      'Do not take that step during the period indicated.',
      'Reversible preparation may continue.',
    ],
  },
  {
    id: 'behavioral_verify',
    name: 'Verify the Outstanding Conditions',
    category: 'behavioral',
    traditions: ['universal'],
    targetConditions: ['UNCERTAINTY', 'ATTACHMENT'],
    suitableFor: ['UNCERTAIN', 'CONDITIONAL', 'DELAYED', 'PREMATURE'],
    intensity: 'moderate',
    duration: 'Before committing',
    evidenceType: 'behavioral',
    explanation:
      'Conflicting indications generally track something genuinely unverified. Checking it converts an ambiguous reading into a decidable one.',
    instructions: [
      'List every claim this decision depends on that you have not independently confirmed.',
      'Confirm the two that would cost you most if false.',
    ],
  },
  {
    id: 'behavioral_direct_conversation',
    name: 'Hold the Direct Conversation',
    category: 'behavioral',
    traditions: ['universal'],
    targetConditions: ['CONFLICT', 'EXTERNAL_OPPOSITION'],
    suitableFor: ['CONDITIONAL', 'UNFAVOURABLE', 'UNCERTAIN', 'DECLINING'],
    intensity: 'high',
    duration: 'Once, before proceeding',
    evidenceType: 'behavioral',
    explanation:
      'The reading indicates another party materially shaping the outcome. One direct conversation resolves more of that than any indirect measure.',
    instructions: [
      'Identify the one person whose position actually decides this.',
      'Ask them directly, and ask for their answer in plain terms.',
    ],
  },
  {
    id: 'behavioral_reduce_exposure',
    name: 'Reduce Your Exposure',
    category: 'behavioral',
    traditions: ['universal'],
    targetConditions: ['INSTABILITY', 'POOR_TIMING'],
    suitableFor: ['DECLINING', 'UNFAVOURABLE', 'PREMATURE'],
    intensity: 'high',
    duration: 'Immediately',
    evidenceType: 'behavioral',
    explanation:
      'A weakening indication argues for limiting what is at risk while the position is still yours to adjust.',
    instructions: [
      'Determine the most you could lose if this reverses.',
      'Reduce that figure to one you could absorb without hardship.',
    ],
  },
  {
    id: 'behavioral_written_terms',
    name: 'Get the Terms in Writing',
    category: 'behavioral',
    traditions: ['universal'],
    targetConditions: ['EXTERNAL_OPPOSITION', 'UNCERTAINTY'],
    suitableFor: ['CONDITIONAL', 'UNCERTAIN', 'ESCALATING', 'DELAYED'],
    intensity: 'moderate',
    duration: 'Before committing',
    evidenceType: 'behavioral',
    explanation:
      'Where the controlling party is not you, the ordinary protection is a written record of what was actually agreed.',
    instructions: [
      'Put the agreed terms in writing and send them to the other party.',
      'Ask them to confirm in writing before you proceed.',
    ],
  },
  {
    id: 'behavioral_second_opinion',
    name: 'Seek an Independent Opinion',
    category: 'behavioral',
    traditions: ['universal'],
    targetConditions: ['UNCERTAINTY', 'ATTACHMENT'],
    suitableFor: ['UNCERTAIN', 'CONDITIONAL', 'DECLINING', 'PREMATURE'],
    intensity: 'moderate',
    duration: 'Before committing',
    evidenceType: 'behavioral',
    explanation:
      'An unsettled reading paired with strong personal investment is the situation in which an outside view is worth most.',
    instructions: [
      'Choose someone with no stake in the outcome.',
      'Present the facts without saying what you hope to hear.',
    ],
  },
  {
    id: 'behavioral_commit',
    name: 'Commit and Execute',
    category: 'behavioral',
    traditions: ['universal'],
    targetConditions: ['NEEDS_DECISIVE_ACTION', 'FAVOURABLE_FLOW'],
    suitableFor: ['FAVOURABLE', 'ESCALATING'],
    avoidFor: ['UNFAVOURABLE', 'DECLINING', 'PREMATURE'],
    intensity: 'moderate',
    duration: 'Within the indicated window',
    evidenceType: 'behavioral',
    explanation:
      'The indications support the matter. Further deliberation past this point costs more than it protects.',
    instructions: [
      'Fix the date of the decisive step.',
      'Complete the preparation it requires and take it.',
    ],
  },

  /* ── Level 5 — Practical escalation ──────────────────────────────────── */
  {
    id: 'practical_medical',
    name: 'Consult a Medical Professional',
    category: 'practical',
    traditions: ['universal'],
    targetConditions: [],
    suitableFor: ALL_OUTCOMES,
    intensity: 'high',
    duration: 'As soon as practicable',
    evidenceType: 'behavioral',
    explanation:
      'This question concerns health. A reading may describe how a matter feels, but it cannot diagnose or treat, and should not delay care.',
    instructions: [
      'Consult a qualified medical practitioner about this matter.',
      'Do not defer investigation or treatment on the basis of any reading.',
    ],
    escalationFor: ['health'],
  },
  {
    id: 'practical_legal',
    name: 'Consult a Qualified Lawyer',
    category: 'practical',
    traditions: ['universal'],
    targetConditions: [],
    suitableFor: ALL_OUTCOMES,
    intensity: 'high',
    duration: 'Before any filing or signature',
    evidenceType: 'behavioral',
    explanation:
      'This question concerns a legal matter, where deadlines and drafting have consequences no reading can offset.',
    instructions: [
      'Obtain advice from a qualified lawyer in the relevant jurisdiction.',
      'Confirm any limitation period that may apply before acting.',
    ],
    escalationFor: ['legal'],
  },
  {
    id: 'practical_financial',
    name: 'Consult an Independent Financial Adviser',
    category: 'practical',
    traditions: ['universal'],
    targetConditions: [],
    suitableFor: ALL_OUTCOMES,
    intensity: 'high',
    duration: 'Before committing funds',
    evidenceType: 'behavioral',
    explanation:
      'This question involves a significant financial commitment. An independent adviser can assess exposure in a way a reading cannot.',
    instructions: [
      'Have the numbers reviewed by an adviser with no stake in the transaction.',
      'Do not commit funds you could not absorb losing.',
    ],
    escalationFor: ['finance', 'business', 'property'],
  },
  {
    id: 'practical_safety',
    name: 'Contact Appropriate Support Services',
    category: 'practical',
    traditions: ['universal'],
    targetConditions: [],
    suitableFor: ALL_OUTCOMES,
    intensity: 'high',
    duration: 'Immediately',
    evidenceType: 'behavioral',
    explanation:
      'Where a question touches personal safety or coercion, the appropriate response is qualified human support, not a spiritual practice.',
    instructions: [
      'Contact local support services or a trusted person who can act.',
      'If you are in immediate danger, contact emergency services.',
    ],
    escalationFor: ['enemies'],
  },
  {
    id: 'practical_counselling',
    name: 'Consider Relationship Counselling',
    category: 'practical',
    traditions: ['universal'],
    targetConditions: ['CONFLICT', 'EXTERNAL_OPPOSITION'],
    suitableFor: ['UNFAVOURABLE', 'DECLINING', 'CONDITIONAL'],
    intensity: 'moderate',
    duration: 'Ongoing',
    evidenceType: 'behavioral',
    explanation:
      'A sustained pattern of friction between people is generally better served by a trained third party than by a reading.',
    instructions: ['Consider a qualified counsellor or mediator with both parties present.'],
    escalationFor: ['marriage'],
  },
]);

export const REMEDY_COUNT = REMEDY_LIBRARY.length;

/** Question types for which a level-5 escalation must always be surfaced. */
export const MANDATORY_ESCALATION_TYPES: readonly QuestionType[] = Object.freeze([
  'health',
  'legal',
]);
