/**
 * watchReadingRecord — maps a WatchReading (askWatchOracle's response) onto
 * the Reading shape readingsStore/HistoryScreen already know how to render.
 * --------------------------------------------------------------------------
 * Deliberately lives outside OracleChatScreen: the screen calls this and
 * moves on, it does not itself reason about RkpOutcome/WatchState. Nothing
 * here recomputes or reinterprets the chart — every value is read straight
 * off the server's own response.
 *
 * Two fields readingsStore's `Reading` expects have no equivalent on
 * WatchReading, both handled honestly rather than invented:
 *
 *   - `category` (a classical KP question domain — marriage/career/health/…):
 *     the Watch Engine doesn't classify by domain, so this is always
 *     'general'. Never guessed from the question text here — that would be
 *     exactly the kind of chart/classification logic this mapper exists to
 *     avoid duplicating client-side.
 *
 *   - `verdict` (History's coarse YES/NO/CONDITIONAL/UNCLEAR filter): bucketed
 *     from the reading's own `oracle.diagnosis.outcome` using the SAME
 *     favourable/caution/unfavourable/uncertain grouping RemedyProtocolCard
 *     already uses to color that outcome (OUTCOME_TONE) — not a new
 *     judgment, just reusing the engine's own published grouping for a
 *     coarser list filter. When the server could not compose a diagnosis at
 *     all (`oracle` absent), this honestly reports 'UNCLEAR' rather than
 *     guessing from the raw WatchState.
 */

import type { Reading, VerdictKind } from '@stores/readingsStore';
import type { WatchReading } from '../firebase/watchOracle';
import { OUTCOME_TONE } from '@components/oracle/RemedyProtocolCard';

const TONE_TO_VERDICT: Readonly<Record<'maqbool' | 'caution' | 'mardood' | 'muted', VerdictKind>> =
  Object.freeze({
    maqbool: 'YES',
    mardood: 'NO',
    caution: 'CONDITIONAL',
    muted: 'UNCLEAR',
  });

function verdictFor(reading: WatchReading): VerdictKind {
  if (reading.oracle === undefined) {
    return 'UNCLEAR';
  }
  return TONE_TO_VERDICT[OUTCOME_TONE[reading.oracle.diagnosis.outcome]];
}

export interface ToReadingRecordInput {
  id: string;
  question: string;
  questionLang: 'en' | 'ur' | 'hi';
  createdAt: string;
  reading: WatchReading;
}

export function toReadingRecord(input: ToReadingRecordInput): Reading {
  const { id, question, questionLang, createdAt, reading } = input;
  const verdict = verdictFor(reading);

  return {
    id,
    question,
    questionLang,
    category: 'general',
    verdict,
    createdAt,
    chartJson: null,
    verdictJson: {
      verdict,
      confidence:
        reading.oracle !== undefined ? Math.round(reading.oracle.diagnosis.confidence * 100) : 0,
    },
    watch_oracle:
      reading.oracle !== undefined
        ? {
            verdict: reading.verdict,
            composition: reading.oracle,
            window: reading.window,
            lagnaSignName: reading.lagnaSignName,
            lagnaRulerName: reading.lagnaRulerName,
            transitCoordinates: reading.transitCoordinates,
          }
        : undefined,
  };
}
