/**
 * oracleDiscussion.ts — client wrapper for the discussReading Cloud Function.
 *
 * Sibling of watchOracle.ts. That file asks for a reading; this one talks
 * about one that already exists. The same rule holds in both: no judgment
 * logic lives in the APK, and this is the only place in the client that
 * speaks to the discussion endpoint.
 *
 * What this call deliberately does NOT send: the verdict, the diagnosis, the
 * timing, or anything else about the reading. It sends the reading's ID and
 * the recent transcript; the server loads the reading itself, ownership
 * included. A client cannot present the oracle with a reading it never gave.
 */

import { regionalFunctions } from './functionsRegion';
import { withTimeout, withDeadline } from '../utils/withTimeout';
import { ensureAppCheckReady } from './appCheck';

/** Same bounded head start the ask path gives App Check — see watchOracle.ts. */
const APP_CHECK_GATE_TIMEOUT_MS = 8000;

/**
 * Tighter than the ask path's 45s: a discussion reply is short prose over an
 * already-settled reading (the server bounds its own model call at 25s), and
 * the seeker is sitting in a live conversation waiting for it. As with the
 * ask path, this exists to recover from a native callable that hangs instead
 * of resolving, not to race a merely slow response.
 */
const DISCUSS_READING_TIMEOUT_MS = 35000;

class DiscussReadingTimeoutError extends Error {
  code = 'deadline-exceeded';
  constructor() {
    super('discussReading: no response within the client-side timeout');
    this.name = 'DiscussReadingTimeoutError';
  }
}

/** One prior turn of this discussion, as the server expects it. */
export interface DiscussionTurn {
  role: 'seeker' | 'oracle';
  text: string;
}

export interface DiscussReadingInput {
  readingId: string;
  message: string;
  lang: 'en' | 'ur' | 'hi';
  /**
   * Other readings the seeker is comparing this one against — e.g. from a
   * thread's `relatedReadingIds`. Capped server-side at 4; ownership of each
   * is re-checked there too, and any that fails is dropped silently rather
   * than failing the call. Omit when there's no lineage to offer.
   */
  compareReadingIds?: readonly string[];
  /** Recent transcript, oldest first. Capped server-side at 20 turns. */
  turns: DiscussionTurn[];
  /**
   * Identifies this follow-up, and is reused on every retry of it. Same
   * contract as askWatchOracle's requestId and for the same reason: a
   * follow-up costs a turn from the reading's budget, and a retry after the
   * app was killed must replay the original answer rather than spend a
   * second turn on a different one.
   */
  requestId?: string;
}

export interface DiscussReadingResult {
  answer: string;
  /**
   * True when the oracle judged the follow-up to be its own horary question —
   * a new matter needs a chart cast for the moment it is asked, so the screen
   * offers to re-send it through the ask path instead of answering it here.
   */
  isNewQuestion: boolean;
  /** Follow-ups left on this reading. */
  turnsRemaining: number;
}

/** Turns the server accepts in one call — matches DiscussReadingSchema. */
export const MAX_DISCUSSION_TURNS_SENT = 20;

export async function discussReading(args: DiscussReadingInput): Promise<DiscussReadingResult> {
  await withTimeout(ensureAppCheckReady(), APP_CHECK_GATE_TIMEOUT_MS);

  const fn = regionalFunctions().httpsCallable('discussReading');

  // withDeadline preserves the callable's own error code — 'resource-exhausted'
  // here means this reading's follow-up budget is spent, not that the seeker
  // is out of questions, and the screen says something different for each.
  const result = await withDeadline(
    fn({
      readingId: args.readingId,
      message: args.message,
      lang: args.lang,
      turns: args.turns.slice(-MAX_DISCUSSION_TURNS_SENT),
      ...(args.compareReadingIds !== undefined && args.compareReadingIds.length > 0
        ? { compareReadingIds: args.compareReadingIds }
        : {}),
      ...(args.requestId !== undefined ? { requestId: args.requestId } : {}),
    }),
    DISCUSS_READING_TIMEOUT_MS,
    () => new DiscussReadingTimeoutError(),
  );

  const data = result.data as {
    answer: string;
    isNewQuestion: boolean;
    turnsRemaining: number;
  };

  return {
    answer: data.answer,
    isNewQuestion: data.isNewQuestion === true,
    turnsRemaining: data.turnsRemaining,
  };
}
