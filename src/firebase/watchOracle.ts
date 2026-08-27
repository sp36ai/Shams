/**
 * watchOracle.ts — client wrapper for the askWatchOracle Cloud Function.
 *
 * Sibling of oracle.ts, and holds to the same rule: the judgment engine runs
 * exclusively on the server, and this file is the only place in the client that
 * talks to it. The APK contains no watch-engine logic — `src/astrology/rkp/` is
 * authored here but executed on the server, where functions/scripts/sync-engine
 * copies it at build time.
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
import { withTimeout } from '../utils/withTimeout';
import { ensureAppCheckReady } from './appCheck';
import type { DisplayWatchVerdict } from '@astrology/rkp/watchJudgment';
import type { WatchOracleComposition } from '../types/watchOracle';

/**
 * How long to give App Check a chance to attach a token before firing
 * anyway. Not a correctness gate — the call proceeds regardless of whether
 * this resolves, times out, or App Check itself rejects; existing
 * server-side error handling already turns a genuinely missing/invalid
 * token into a proper "seal of verification is absent" bubble. This exists
 * only to close the common case: a fast cold start where Play Integrity's
 * first token exchange (slower than Auth's, typically already cached)
 * hasn't completed yet by the time the querent taps Ask.
 */
const APP_CHECK_GATE_TIMEOUT_MS = 8000;

/**
 * The server itself allows up to 120s (Anthropic synthesis ~25s + cold-start
 * headroom) — see ORACLE_FUNCTION_OPTS in functions/src/config.ts. This is
 * deliberately looser than that ceiling: it exists only to recover from a
 * native callable invocation that hangs instead of ever resolving/rejecting
 * (App Check/attestation round-trips are the known culprit — see
 * withTimeout()'s docstring), not to race a normal, slower-than-usual
 * response. Without this, that hang leaves `sendMessage()` awaiting forever
 * with no spinner having ever had the chance to clear and no bubble ever
 * rendered.
 */
const ASK_WATCH_ORACLE_TIMEOUT_MS = 45000;

class AskWatchOracleTimeoutError extends Error {
  code = 'deadline-exceeded';
  constructor() {
    super('askWatchOracle: no response within the client-side timeout');
    this.name = 'AskWatchOracleTimeoutError';
  }
}

export interface AskWatchOracleInput {
  question: string;
  questionLang: 'en' | 'ur' | 'hi';
  seekerProfile?: 'clarity' | 'comfort' | 'action' | 'surrender';
}

export interface WatchReading {
  readingId: string;
  /** Server instant, UTC. */
  computedAt: string;
  /** The querent's local moment, as used to select the bracket. */
  localMoment: string;
  window: { startMinute: number; endMinute: number; minute: number };
  /** e.g. "Burj Jauza". */
  lagnaSignName: string;
  /** e.g. "Utarid". */
  lagnaRulerName: string;
  verdict: DisplayWatchVerdict;
  /**
   * Diagnosis, remedy protocol and narration. Absent only if the server could
   * not compose one at all; `oracle.narration` being null is the ordinary
   * degraded case, where the protocol is intact but the prose is missing.
   */
  oracle?: WatchOracleComposition;
}

export interface AskWatchOracleResult {
  reading: WatchReading;
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

export async function askWatchOracle(args: AskWatchOracleInput): Promise<AskWatchOracleResult> {
  // Give App Check a bounded head start before firing — see
  // APP_CHECK_GATE_TIMEOUT_MS above for why. Proceeds either way.
  await withTimeout(ensureAppCheckReady(), APP_CHECK_GATE_TIMEOUT_MS);

  const fn = regionalFunctions().httpsCallable('askWatchOracle');

  const payload: Record<string, unknown> = {
    question: args.question,
    questionLang: args.questionLang,
    utcOffsetMinutes: deviceUtcOffsetMinutes(),
    ...(args.seekerProfile !== undefined ? { seekerProfile: args.seekerProfile } : {}),
  };

  const result = await withTimeout(fn(payload), ASK_WATCH_ORACLE_TIMEOUT_MS);
  if (result === undefined) {
    // Surfaces as `.code === 'deadline-exceeded'`, which ReadingScreen's
    // error handler already maps to "the channel to the oracle is
    // interrupted" — no separate handling needed at the call site.
    throw new AskWatchOracleTimeoutError();
  }
  const data = result.data as WatchReading & { quotaRemaining: number | null };

  return {
    reading: {
      readingId: data.readingId,
      computedAt: data.computedAt,
      localMoment: data.localMoment,
      window: data.window,
      lagnaSignName: data.lagnaSignName,
      lagnaRulerName: data.lagnaRulerName,
      verdict: data.verdict,
      ...(data.oracle !== undefined ? { oracle: data.oracle } : {}),
    },
    quotaRemaining: data.quotaRemaining,
  };
}
