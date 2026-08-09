/**
 * watchOracle.ts — client wrapper for the askWatchOracle Cloud Function.
 *
 * This is the app's only oracle entry point. The judgment engine runs
 * exclusively on the server, and this file is the only place in the client
 * that talks to it. The APK contains no engine logic — `src/astrology/rkp/`
 * is authored here but executed on the server, where
 * functions/scripts/sync-engine copies it at build time.
 *
 * Two things this call does NOT send, both deliberate:
 *   - No lat/lon. The watch frame replaces the house cusps and planetary
 *     positions are location-invariant, so the reading needs no location. This
 *     is what lets it run the moment the app opens.
 *   - No timestamp. The server takes its own instant, so a reading cannot be
 *     replayed or hand-picked. Only the timezone OFFSET travels, because only
 *     the device knows which zone its owner is standing in.
 */

import { regionalFunctions } from './functionsRegion';
import type { Reading } from '@stores/readingsStore';
import type { WatchVerdict } from '@astrology/rkp/watchJudgment';

export interface AskWatchOracleInput {
  question: string;
  questionLang: 'en' | 'ur' | 'hi';
  seekerProfile?: 'clarity' | 'comfort' | 'action' | 'surrender';
  seekerName?: string;
  motherName?: string;
}

/**
 * The shape stored in `Reading.verdictJson` for a watch reading. `verdictJson`
 * itself stays `unknown` in the store (engine-agnostic), but every reader in
 * this app (OracleChatScreen, HistoryScreen) casts to this shape.
 */
export interface WatchVerdictJson {
  verdict: WatchVerdict;
  window: { startMinute: number; endMinute: number; minute: number };
  /** e.g. "Burj Jauza". */
  lagnaSignName: string;
  /** e.g. "Utarid". */
  lagnaRulerName: string;
  /** Plain-language fallback narration, one string per language. */
  narration: Record<'en' | 'ur' | 'hi', string>;
  manzila?: {
    number: number;
    name: string;
    arabic: string;
    nature: 'benefic' | 'malefic' | 'mixed';
    element: 'fire' | 'earth' | 'air' | 'water';
    oracleDescriptor: string;
  };
  oracle?: {
    opening: string;
    interpretation: string;
    spiritual_layer: string;
    hidden_influence: string;
    timing?: string | null;
    warning?: string;
    remedy: {
      quran_verse?: string;
      asma?: string;
      dua?: string;
      zikr?: string;
      sadaqah?: string;
    };
    signature: string;
  };
}

export interface AskWatchOracleResult {
  reading: Reading;
  quotaRemaining: number | null;
}

/**
 * The device's current offset from UTC, in minutes, in the sign convention the
 * server expects (+05:30 → 330).
 *
 * `Date.prototype.getTimezoneOffset` reports the opposite sign — minutes to ADD
 * to local time to reach UTC — so it is negated here. Getting this backwards
 * would silently select a bracket up to 28 hours away from the querent's own.
 */
export function deviceUtcOffsetMinutes(now: Date = new Date()): number {
  const offset = -now.getTimezoneOffset();
  // Negating zero yields -0, which compares unequal to 0 under Object.is and
  // reads oddly in logs. Normalise it; UTC is +00:00, not -00:00.
  return offset === 0 ? 0 : offset;
}

/** Maps the six watch states to the app-wide verdict vocabulary History/HomeScreen filter on. */
const STATE_TO_VERDICT: Record<WatchVerdict['state'], Reading['verdict']> = {
  FULFILLED: 'YES',
  MOVING: 'CONDITIONAL',
  DELAYED: 'DELAYED',
  BLOCKED: 'NO',
  REVERSING: 'CONDITIONAL',
  UNFORMED: 'UNCLEAR',
};

export async function askWatchOracle(args: AskWatchOracleInput): Promise<AskWatchOracleResult> {
  const fn = regionalFunctions().httpsCallable('askWatchOracle');

  const payload: Record<string, unknown> = {
    question: args.question,
    questionLang: args.questionLang,
    utcOffsetMinutes: deviceUtcOffsetMinutes(),
    ...(args.seekerProfile !== undefined ? { seekerProfile: args.seekerProfile } : {}),
  };
  if (args.seekerName) {
    payload.seekerName = args.seekerName;
  }
  if (args.motherName) {
    payload.motherName = args.motherName;
  }

  const result = await fn(payload);
  const data = result.data as {
    readingId: string;
    computedAt: string;
    localMoment: string;
    window: { startMinute: number; endMinute: number; minute: number };
    lagnaSignName: string;
    lagnaRulerName: string;
    verdict: WatchVerdict;
    quotaRemaining: number | null;
    manzila?: WatchVerdictJson['manzila'];
    oracle?: WatchVerdictJson['oracle'];
  };

  const narration = data.verdict.factors.join(' ');
  const verdictJson: WatchVerdictJson = {
    verdict: data.verdict,
    window: data.window,
    lagnaSignName: data.lagnaSignName,
    lagnaRulerName: data.lagnaRulerName,
    narration: { en: narration, ur: narration, hi: narration },
    manzila: data.manzila,
    oracle: data.oracle,
  };

  const reading: Reading = {
    id: data.readingId,
    question: args.question,
    questionLang: args.questionLang,
    category: data.verdict.qType,
    verdict: STATE_TO_VERDICT[data.verdict.state],
    createdAt: data.computedAt,
    chartJson: {},
    verdictJson,
  };

  return { reading, quotaRemaining: data.quotaRemaining };
}
