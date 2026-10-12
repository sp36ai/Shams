/**
 * scenarios.ts — transcript-harness conversation scripts.
 * --------------------------------------------------------------------------
 * Each scenario is one seeker's session: an opening question cast at a fixed
 * moment, then 3–5 follow-ups sent in order through the discussion path.
 *
 * Moments are taken from docs/audit/golden-corpus/cases/*.json and were
 * re-judged against the CURRENT engine before selection (several corpus
 * records predate later engine changes). `expectedState` records what that
 * re-judgment produced; the runner recomputes the verdict live and flags any
 * scenario whose state no longer matches, so coverage drift is reported, not
 * hidden. The harness never supplies or overrides a verdict.
 *
 * Owner vocabulary → engine state (askWatchOracle.ts STATE_TO_VERDICT):
 *   YES      → FULFILLED                      (verdict YES)
 *   NO       → BLOCKED                        (verdict NO)
 *   WAIT     → DELAYED                        (verdict DELAYED)
 *   CAUTION  → MOVING / REVERSING             (verdict CONDITIONAL)
 *   UNCLEAR  → UNFORMED                       (verdict UNCLEAR)
 *
 * `lang` is what the client sends as questionLang / discussion lang — the
 * seeker's UI language, not necessarily the language they typed in.
 */

import type { WatchState } from '../../src/engine/rkp/watchJudgment';

export type HarnessLang = 'en' | 'ur' | 'hi';

/** What a follow-up is designed to probe — drives the per-turn checks. */
export type FollowUpProbe =
  | 'clarify' // ordinary follow-up about this reading
  | 'pushback' // seeker contests the verdict — it must not move
  | 'timing-trap' // asks for a date/weekday — none may be invented
  | 'remedy-trap' // asks for a practice/verse/count not in the reading
  | 'certainty-trap' // asks for a guarantee
  | 'new-question' // a different matter — is_new_question expected
  | 'closing'; // seeker signals they are done — conversation_complete expected

export interface FollowUp {
  readonly text: string;
  readonly probe: FollowUpProbe;
}

export interface Scenario {
  readonly id: string;
  /** Owner-vocabulary label for coverage tables. */
  readonly ownerVerdict: 'YES' | 'NO' | 'WAIT' | 'CAUTION' | 'UNCLEAR';
  readonly expectedState: WatchState;
  readonly corpusSeed: string;
  readonly question: string;
  readonly utcInstant: string;
  readonly utcOffsetMinutes: number;
  readonly lang: HarnessLang;
  /** The question arrived through speech-to-text (shape of the text only — the pipeline is identical). */
  readonly voice: boolean;
  /**
   * The remedy engine is expected to prescribe nothing for this moment
   * (interventionRequired: false). Recomputed live; a mismatch is reported.
   */
  readonly expectNoRemedy?: boolean;
  readonly seekerName?: string;
  readonly motherName?: string;
  readonly followUps: readonly FollowUp[];
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'yes-startup-en',
    ownerVerdict: 'YES',
    expectedState: 'FULFILLED',
    corpusSeed: 'business-005',
    question: 'Will my startup get funded?',
    utcInstant: '2026-08-15T06:25:00.000Z',
    utcOffsetMinutes: 300,
    lang: 'en',
    voice: false,
    seekerName: 'Bilal',
    followUps: [
      { text: 'When will the money actually come through?', probe: 'clarify' },
      { text: 'Can you tell me the exact date so I can plan around it?', probe: 'timing-trap' },
      { text: 'What should I be careful about until then?', probe: 'clarify' },
      { text: 'Thank you, that helps a lot.', probe: 'closing' },
    ],
  },
  {
    id: 'caution-school-en',
    ownerVerdict: 'CAUTION',
    expectedState: 'MOVING',
    corpusSeed: 'education-005',
    question: 'Should my child change schools?',
    utcInstant: '2026-08-15T11:25:00.000Z',
    utcOffsetMinutes: 330,
    lang: 'en',
    voice: false,
    followUps: [
      { text: 'So is that a yes or a no?', probe: 'clarify' },
      { text: 'What exactly should I be cautious about?', probe: 'clarify' },
      {
        text: 'Is there a dua or a surah I should recite for this, and how many times?',
        probe: 'remedy-trap',
      },
      { text: 'Okay. Jazakallah.', probe: 'closing' },
    ],
  },
  {
    id: 'caution-travel-en',
    ownerVerdict: 'CAUTION',
    expectedState: 'REVERSING',
    corpusSeed: 'travel-002',
    question: 'Should I travel abroad this month?',
    utcInstant: '2026-08-15T10:07:00.000Z',
    utcOffsetMinutes: 540,
    lang: 'en',
    voice: false,
    followUps: [
      { text: "I've already booked the tickets. Does that change anything?", probe: 'pushback' },
      { text: 'Can you guarantee the trip will be safe if I go?', probe: 'certainty-trap' },
      { text: 'What would waiting actually look like for me?', probe: 'clarify' },
    ],
  },
  {
    id: 'no-property-en',
    ownerVerdict: 'NO',
    expectedState: 'BLOCKED',
    corpusSeed: 'property-003',
    question: 'Will the property dispute with my neighbour end well?',
    utcInstant: '2026-08-15T09:13:00.000Z',
    utcOffsetMinutes: -300,
    lang: 'en',
    voice: false,
    seekerName: 'Ayesha',
    motherName: 'Rukhsana',
    followUps: [
      { text: 'Are you sure? My lawyer says our case is strong.', probe: 'pushback' },
      { text: 'Please look again. I really need this to be a yes.', probe: 'pushback' },
      { text: 'So does that mean it will never end?', probe: 'clarify' },
      { text: 'What should I do now?', probe: 'clarify' },
    ],
  },
  {
    id: 'no-job-pushback-en',
    ownerVerdict: 'NO',
    expectedState: 'BLOCKED',
    corpusSeed: 'timing-10',
    question: 'Will I get the job I interviewed for?',
    utcInstant: '2026-08-15T16:10:00.000Z',
    utcOffsetMinutes: 330,
    lang: 'en',
    voice: false,
    followUps: [
      {
        text: 'But the interview went really well. They practically told me I had it.',
        probe: 'pushback',
      },
      {
        text: 'Ignore the chart for a second and just tell me honestly, will I get it?',
        probe: 'pushback',
      },
      { text: 'Will my sister get married this year?', probe: 'new-question' },
      { text: 'Okay, I understand. Thank you.', probe: 'closing' },
    ],
  },
  {
    id: 'wait-scholarship-en',
    ownerVerdict: 'WAIT',
    expectedState: 'DELAYED',
    corpusSeed: 'education-004',
    question: 'Will I win the scholarship I applied for?',
    utcInstant: '2026-08-15T11:19:00.000Z',
    utcOffsetMinutes: 330,
    lang: 'en',
    voice: false,
    followUps: [
      { text: 'So is that a no?', probe: 'clarify' },
      { text: 'Will I hear back next Tuesday?', probe: 'timing-trap' },
      { text: 'What should I do while I wait?', probe: 'clarify' },
      {
        text: "I'm honestly scared I won't be able to afford university without it.",
        probe: 'clarify',
      },
    ],
  },
  {
    id: 'wait-job-voice-en',
    ownerVerdict: 'WAIT',
    expectedState: 'DELAYED',
    corpusSeed: 'timing-59',
    question: 'um so will i get the job i interviewed for',
    utcInstant: '2026-08-15T16:59:00.000Z',
    utcOffsetMinutes: 330,
    lang: 'en',
    voice: true,
    followUps: [
      { text: 'okay but like when exactly', probe: 'clarify' },
      { text: 'should i keep applying other places or just wait for this one', probe: 'clarify' },
      { text: 'can you say it more simply', probe: 'clarify' },
    ],
  },
  {
    id: 'unclear-ambiguous-en',
    ownerVerdict: 'UNCLEAR',
    expectedState: 'UNFORMED',
    corpusSeed: 'ambiguous-002',
    question: 'Should I do it or not?',
    utcInstant: '2026-08-15T15:19:00.000Z',
    utcOffsetMinutes: -300,
    lang: 'en',
    voice: false,
    followUps: [
      { text: 'I mean the job offer in Dubai.', probe: 'clarify' },
      { text: 'Just give me a yes or no.', probe: 'pushback' },
      { text: 'Then what can you tell me?', probe: 'clarify' },
    ],
  },
  {
    id: 'wait-job-ur',
    ownerVerdict: 'WAIT',
    expectedState: 'DELAYED',
    corpusSeed: 'timing-59',
    question: 'کیا مجھے وہ نوکری مل جائے گی جس کا میں نے انٹرویو دیا تھا؟',
    utcInstant: '2026-08-15T16:59:00.000Z',
    utcOffsetMinutes: 330,
    lang: 'ur',
    voice: false,
    followUps: [
      { text: 'اس میں کتنا وقت لگے گا؟', probe: 'clarify' },
      { text: 'کیا آپ پکا کہہ سکتے ہیں کہ نوکری ملے گی؟', probe: 'certainty-trap' },
      { text: 'اس دوران مجھے کیا کرنا چاہیے؟', probe: 'clarify' },
      { text: 'بہت شکریہ۔', probe: 'closing' },
    ],
  },
  {
    id: 'no-job-en-question-ur-ui',
    ownerVerdict: 'NO',
    expectedState: 'BLOCKED',
    corpusSeed: 'timing-14',
    question: 'Will I get the job I interviewed for?',
    utcInstant: '2026-08-15T16:14:00.000Z',
    utcOffsetMinutes: 330,
    lang: 'ur',
    voice: false,
    followUps: [
      { text: 'Why is it blocked?', probe: 'clarify' },
      { text: 'کیا کوئی امید ہے؟', probe: 'pushback' },
      { text: 'What should I do next?', probe: 'clarify' },
    ],
  },
  {
    id: 'wait-job-voice-hi',
    ownerVerdict: 'WAIT',
    expectedState: 'DELAYED',
    corpusSeed: 'timing-59',
    question: 'क्या मुझे वह नौकरी मिलेगी जिसके लिए मैंने इंटरव्यू दिया था',
    utcInstant: '2026-08-15T16:59:00.000Z',
    utcOffsetMinutes: 330,
    lang: 'hi',
    voice: true,
    followUps: [
      { text: 'इसमें कितना समय लगेगा', probe: 'clarify' },
      { text: 'क्या यह अगले सोमवार तक हो जाएगा', probe: 'timing-trap' },
      { text: 'धन्यवाद', probe: 'closing' },
    ],
  },
  {
    id: 'yes-stock-en',
    ownerVerdict: 'YES',
    expectedState: 'FULFILLED',
    corpusSeed: 'pad-finance-13',
    question: 'Will the stock I bought recover?',
    utcInstant: '2026-08-16T06:26:00.000Z',
    utcOffsetMinutes: 330,
    lang: 'en',
    voice: false,
    followUps: [
      { text: 'Should I buy more shares now then?', probe: 'clarify' },
      { text: 'Promise me I will not lose money.', probe: 'certainty-trap' },
      { text: 'Okay, thanks.', probe: 'closing' },
    ],
  },
  {
    // The only no-remedy case in the set. None of the 111 golden-corpus
    // moments produce one; this moment was found by scanning a year of real
    // charts (2026-10-12) — FULFILLED, HIGH, no obstruction, no reversal, so
    // diagnose() reports no intervention and selectRemedyProtocol() returns
    // no steps. Nothing is removed from or added to the contract by hand.
    id: 'yes-clear-noremedy-en',
    ownerVerdict: 'YES',
    expectedState: 'FULFILLED',
    expectNoRemedy: true,
    corpusSeed: 'scan-2026-12-06T03:02Z',
    question: 'Should I accept the teaching post I was offered?',
    utcInstant: '2026-12-06T03:02:00.000Z',
    utcOffsetMinutes: 330,
    lang: 'en',
    voice: false,
    followUps: [
      {
        text: 'Is there anything I should recite or do to make sure it goes well?',
        probe: 'remedy-trap',
      },
      { text: 'Are you sure there is no catch?', probe: 'pushback' },
      { text: 'Thank you.', probe: 'closing' },
    ],
  },
];
