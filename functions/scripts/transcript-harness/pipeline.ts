/**
 * pipeline.ts — run one scenario through the production Oracle path.
 * --------------------------------------------------------------------------
 * Opening question: the same engine call order askWatchOracle.ts uses
 * (localIsoFromOffset → buildWatchChart → classifyQuestion →
 * judgeWatchChart → boundary planet names), then the unmodified
 * composeWatchOracleResponse() — diagnosis, remedy selection, contract,
 * synthesis, validation and deterministic fallback.
 *
 * Follow-ups: the unmodified composeDiscussionReply(), with the grounding
 * built the way discussReading.ts builds it and the turn window built the way
 * the client's discussionTurnsFor() does (only messages after the reading;
 * the reading itself travels in the brief). Firestore, auth, quota and rate
 * limiting are not exercised — they carry no prose.
 *
 * The harness reads results; it never decides a verdict.
 */

import { buildWatchChart } from '../../src/engine/rkp/watchChart';
import {
  judgeWatchChart,
  type DisplayWatchVerdict,
  type WatchState,
  type WatchVerdict,
} from '../../src/engine/rkp/watchJudgment';
import { classifyQuestion } from '../../src/engine/kp/rules/questionKeywords';
import { localIsoFromOffset } from '../../src/utils/localTime';
import { toBoundaryPlanetName } from '../../src/utils/planetBoundaryName';
import {
  composeWatchOracleResponse,
  type NarrationFields,
  type WatchOracleComposition,
} from '../../src/oracle/responseComposer';
import {
  composeDiscussionReply,
  type DiscussionTurn,
  type ReadingGrounding,
} from '../../src/oracle/discussionComposer';
import { buildDeterministicFallbackNarration } from '../../src/oracle/narrationFallback';
import type { ReadingContract } from '../../src/oracle/readingContract';

import type { Scenario, FollowUp } from './scenarios';
import { modelTextOf, type Transport } from './modelTransport';

// Copies of askWatchOracle.ts's private maps — the values a reading document
// stores and discussReading.ts later passes in the grounding.
const STATE_TO_VERDICT: Readonly<Record<WatchState, string>> = {
  FULFILLED: 'YES',
  MOVING: 'CONDITIONAL',
  DELAYED: 'DELAYED',
  BLOCKED: 'NO',
  REVERSING: 'CONDITIONAL',
  UNFORMED: 'UNCLEAR',
};
const CONFIDENCE_NUMERIC: Readonly<Record<WatchVerdict['confidence'], number>> = {
  VERY_HIGH: 0.95,
  HIGH: 0.8,
  MODERATE: 0.6,
  LOW: 0.4,
  UNCERTAIN: 0.2,
};

export type ReadingOutcome =
  | 'model' // the model's draft passed validation and is what the seeker sees
  | 'fallback' // the draft failed validation — the deterministic fallback was served
  | 'no-narration'; // synthesis failed outright (transport/parse) — verdict card only

export interface ReadingRecord {
  readonly state: WatchState;
  readonly confidence: WatchVerdict['confidence'];
  readonly verdictLabel: string;
  readonly qType: string;
  readonly stateMatchesExpected: boolean;
  /** False only when the scenario expects no remedy and the engine prescribed one. */
  readonly remedyMatchesExpected: boolean;
  readonly timing: { readonly minDays: number; readonly maxDays: number } | null;
  readonly outcome: ReadingOutcome;
  /** What the model drafted, before validation. Null if nothing parseable came back. */
  readonly draft: NarrationFields | null;
  /** What the seeker is actually shown. */
  readonly narration: NarrationFields | null;
  /** What the app actually speaks. */
  readonly speakableText: string | null;
  readonly interventionRequired: boolean;
  /** The remedy library text this reading carries — the only practices it may name. */
  readonly protocolText: string;
  readonly exchangeSeqs: readonly number[];
}

export type TurnOutcome =
  | 'answered' // first draft passed
  | 'answered-after-rewrite' // first draft rejected, rewrite passed
  | 'no-reply' // production would show "The oracle did not answer. Try again."
  | 'not-sent'; // conversation was already closed by the oracle

export interface TurnRecord {
  readonly followUp: FollowUp;
  readonly outcome: TurnOutcome;
  readonly answer: string | null;
  readonly isNewQuestion: boolean;
  readonly conversationComplete: boolean;
  readonly attempts: number;
  /** Rejected first draft's answer text, when a rewrite was needed or the turn failed. */
  readonly rejectedDrafts: readonly string[];
  readonly exchangeSeqs: readonly number[];
}

export interface ScenarioRecord {
  readonly scenario: Scenario;
  readonly reading: ReadingRecord;
  readonly turns: readonly TurnRecord[];
}

function parseDraftNarration(text: string | null): NarrationFields | null {
  if (text === null) {
    return null;
  }
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const p = JSON.parse(cleaned) as Partial<NarrationFields>;
    if (!p.rkp_finding || !p.interpretation || !p.recommended_approach || !p.signature) {
      return null;
    }
    return {
      rkp_finding: p.rkp_finding,
      interpretation: p.interpretation,
      recommended_approach: p.recommended_approach,
      why_this_remedy: p.why_this_remedy ?? null,
      signature: p.signature,
    };
  } catch {
    return null;
  }
}

function draftAnswerOf(text: string | null): string | null {
  if (text === null) {
    return null;
  }
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const p = JSON.parse(cleaned) as { answer?: unknown };
    return typeof p.answer === 'string' ? p.answer : null;
  } catch {
    return null;
  }
}

function sameNarration(a: NarrationFields, b: NarrationFields): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function runScenario(
  scenario: Scenario,
  transport: Transport,
): Promise<ScenarioRecord> {
  const instant = new Date(scenario.utcInstant);
  const chart = buildWatchChart(localIsoFromOffset(instant, scenario.utcOffsetMinutes));
  const qType = classifyQuestion(scenario.question);
  const verdict = judgeWatchChart(chart, qType);
  const publicVerdict: DisplayWatchVerdict = {
    ...verdict,
    obstruction: toBoundaryPlanetName(verdict.obstruction),
    targetRuler: toBoundaryPlanetName(verdict.targetRuler),
    lagnaRuler: toBoundaryPlanetName(verdict.lagnaRuler),
  };

  const before = transport.exchanges.length;
  const { composition, contract } = await composeWatchOracleResponse({
    verdict: publicVerdict,
    question: scenario.question,
    seekerName: scenario.seekerName,
    motherName: scenario.motherName,
    readingId: `harness-${scenario.id}`,
    computedAt: instant,
  });
  const readingExchanges = transport.exchanges.slice(before);
  const draft = parseDraftNarration(
    readingExchanges.length > 0
      ? modelTextOf(readingExchanges[readingExchanges.length - 1]!)
      : null,
  );

  const reading: ReadingRecord = {
    state: verdict.state,
    confidence: verdict.confidence,
    verdictLabel: STATE_TO_VERDICT[verdict.state],
    qType,
    stateMatchesExpected: verdict.state === scenario.expectedState,
    remedyMatchesExpected:
      scenario.expectNoRemedy !== true || !composition.protocol.interventionRequired,
    timing: verdict.timing,
    outcome: readingOutcome(composition, contract),
    draft,
    narration: composition.narration,
    speakableText: composition.speakableText,
    interventionRequired: composition.protocol.interventionRequired,
    protocolText: composition.protocol.steps
      .map(st => [st.name, st.explanation, ...st.instructions].join(' '))
      .join(' '),
    exchangeSeqs: readingExchanges.map(e => e.seq),
  };

  const grounding: ReadingGrounding = {
    label: 'the reading',
    question: scenario.question,
    verdict: STATE_TO_VERDICT[verdict.state],
    confidence: CONFIDENCE_NUMERIC[verdict.confidence],
    computedAt: instant.toISOString(),
    oracle: composition,
    // What askWatchOracle.ts stores as narration.{en,ur,hi}.
    narration: composition.narration?.interpretation || verdict.factors.join(' '),
    contract,
  };

  const turns: TurnRecord[] = [];
  const history: DiscussionTurn[] = [];
  let closed = false;

  for (const followUp of scenario.followUps) {
    if (closed) {
      turns.push({
        followUp,
        outcome: 'not-sent',
        answer: null,
        isNewQuestion: false,
        conversationComplete: false,
        attempts: 0,
        rejectedDrafts: [],
        exchangeSeqs: [],
      });
      continue;
    }
    const turnStart = transport.exchanges.length;
    const reply = await composeDiscussionReply({
      groundings: [grounding],
      turns: history,
      message: followUp.text,
      replyLang: scenario.lang,
      logContext: { harnessScenario: scenario.id },
    });
    const turnExchanges = transport.exchanges.slice(turnStart);
    const drafts = turnExchanges.map(e => draftAnswerOf(modelTextOf(e)));
    const attempts = turnExchanges.length;

    let outcome: TurnOutcome;
    if (reply === null) {
      outcome = 'no-reply';
    } else {
      outcome = attempts > 1 ? 'answered-after-rewrite' : 'answered';
    }
    const rejectedDrafts = (reply === null ? drafts : drafts.slice(0, -1)).filter(
      (d): d is string => d !== null,
    );

    turns.push({
      followUp,
      outcome,
      answer: reply?.answer ?? null,
      isNewQuestion: reply?.isNewQuestion ?? false,
      conversationComplete: reply?.conversationComplete ?? false,
      attempts,
      rejectedDrafts,
      exchangeSeqs: turnExchanges.map(e => e.seq),
    });

    // Client behaviour: a failed oracle turn is not 'sent' and drops out of
    // the window; the harness treats the seeker as not retrying, so the
    // unanswered message drops out with it.
    if (reply !== null) {
      history.push({ role: 'seeker', text: followUp.text });
      history.push({ role: 'oracle', text: reply.answer });
      if (reply.conversationComplete) {
        closed = true;
      }
    }
  }

  return { scenario, reading, turns };
}

function readingOutcome(
  composition: WatchOracleComposition,
  contract: ReadingContract,
): ReadingOutcome {
  if (composition.narration === null) {
    return 'no-narration';
  }
  return sameNarration(composition.narration, buildDeterministicFallbackNarration(contract))
    ? 'fallback'
    : 'model';
}
