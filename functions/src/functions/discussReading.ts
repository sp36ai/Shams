/**
 * discussReading — the follow-up conversation callable.
 *
 * Sibling of askWatchOracle, and deliberately NOT a second way to get one.
 * askWatchOracle casts a chart and judges it; this answers questions about a
 * chart that was already cast and judged. Nothing here touches the engine.
 *
 * Pipeline:
 *   1. Firebase App Check  — enforced by runtime
 *   2. Firebase Auth       — request.auth UID verified by the runtime
 *   3. Input validation    — Zod, strict
 *   4. Rate limit          — shared limiter, per user
 *   5. Idempotency claim   — claimRequest(), so one follow-up spends one turn
 *                            even if the app dies mid-call and is retried
 *   6. Load the reading    — /readings/{id}, ownership enforced here
 *   7. Turn budget         — atomic increment, capped per reading
 *   8. Compose the reply   — Claude, over the STORED reading only
 *   9. Record the response — against the requestId, so a retry replays it
 *  10. Audit log           — no PII
 *
 * WHY THIS DOES NOT CHARGE A QUOTA SLOT
 *   The unit the app sells is a reading — a chart cast for a moment. Charging
 *   again to ask "what does that mean?" would price the seeker out of
 *   understanding the answer they already paid for, and would push them to
 *   re-ask the same question as a fresh reading, which is both worse for them
 *   and more expensive for us. Discussion is therefore free, and bounded
 *   instead: DISCUSSION_TURN_LIMIT turns per reading, enforced server-side on
 *   the reading document, on top of the ordinary per-minute rate limit.
 *
 * WHY THE GROUNDING IS LOADED, NOT ACCEPTED
 *   The client sends a readingId and the recent transcript — never the verdict.
 *   Everything the model is allowed to state about the chart is read out of
 *   Firestore here, so no follow-up can present the oracle with a reading it
 *   never gave.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../utils/admin';
import { verifyAuth } from '../middleware/auth';
import { enforceRateLimit } from '../middleware/rateLimit';
import { parse, DiscussReadingSchema } from '../middleware/validate';
import { measure } from '../middleware/telemetry';
import { logger, hashText } from '../utils/logger';
import { ORACLE_FUNCTION_OPTS, ANTHROPIC_API_KEY, DISCUSSION_TURN_LIMIT } from '../config';
import { claimRequest, completeRequest, releaseRequest } from '../utils/idempotency';
import type { AuditLogDoc, ReadingDoc } from '../types';
import type { WatchOracleComposition } from '../oracle/responseComposer';
import {
  composeDiscussionReply,
  type DiscussionTurn,
  type ReadingGrounding,
} from '../oracle/discussionComposer';

/**
 * Narrow a stored `watchOracle` field back to a composition.
 *
 * ReadingDoc types it as unknown on purpose (see types.ts), and the value has
 * been through Firestore since it was written, so the shape is checked rather
 * than asserted: a reading written before the composition existed, or one
 * whose synthesis failed, simply discusses from its stored narration instead.
 */
function asComposition(value: unknown): WatchOracleComposition | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const o = value as Record<string, unknown>;
  if (typeof o.diagnosis !== 'object' || o.diagnosis === null) {
    return null;
  }
  if (typeof o.protocol !== 'object' || o.protocol === null) {
    return null;
  }
  return value as WatchOracleComposition;
}

export interface DiscussReadingResponse {
  answer: string;
  /** True when the follow-up is really its own horary question. */
  isNewQuestion: boolean;
  /** Follow-ups left on this reading, after this one. */
  turnsRemaining: number;
}

export const discussReading = onCall(
  {
    ...ORACLE_FUNCTION_OPTS,
    secrets: [ANTHROPIC_API_KEY],
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
  },
  async (request): Promise<DiscussReadingResponse> => {
    const { userId } = verifyAuth(request);

    return measure('discussReading', userId, async () => {
      const input = parse(DiscussReadingSchema, request.data);

      await enforceRateLimit(userId);

      // ── Idempotency, BEFORE the turn is counted ──────────────────────────
      //
      // Lower stakes than askWatchOracle — a follow-up costs a turn, not a
      // quota slot — but the same hole: if this function answered and the app
      // died before the reply landed, the seeker's retry would spend a second
      // turn from this reading's budget and never see the first answer.
      const { requestId } = input;
      if (requestId !== undefined) {
        const { replay } = await claimRequest<DiscussReadingResponse>(userId, requestId);
        if (replay !== null) {
          return replay;
        }
      }

      const release = async (): Promise<void> => {
        if (requestId !== undefined) {
          await releaseRequest(userId, requestId);
        }
      };

      const readingRef = db.collection('readings').doc(input.readingId);

      // ── Load + ownership + turn budget, atomically ───────────────────────
      //
      // The read and the increment share a transaction so two composers
      // firing at once cannot both see the last free turn. The turn is
      // counted BEFORE the model call, and given back below if the call
      // produced no reply — the same claim/refund shape askWatchOracle uses
      // for a quota slot, and for the same reason: a turn the seeker never
      // received must not be one they paid for.
      let doc: ReadingDoc;
      let turnsRemaining: number;

      try {
        ({ doc, turnsRemaining } = await db.runTransaction(async tx => {
          const snap = await tx.get(readingRef);
          if (!snap.exists) {
            throw new HttpsError('not-found', 'That reading is no longer available.');
          }
          const data = snap.data() as ReadingDoc;
          if (data.userId !== userId) {
            // Deliberately the same error a missing reading gets: a caller
            // must not be able to probe which reading ids exist.
            throw new HttpsError('not-found', 'That reading is no longer available.');
          }

          const used = data.discussionTurns ?? 0;
          if (used >= DISCUSSION_TURN_LIMIT) {
            throw new HttpsError(
              'resource-exhausted',
              'This reading has been discussed as far as it goes. Ask a new question.',
            );
          }

          tx.update(readingRef, { discussionTurns: FieldValue.increment(1) });
          return { doc: data, turnsRemaining: DISCUSSION_TURN_LIMIT - used - 1 };
        }));
      } catch (err) {
        // No turn was spent — a missing reading, a foreign one, an exhausted
        // budget, a failed read. The claim must not outlive the attempt, or
        // the seeker's next try is refused for the wrong reason.
        await release();
        if (err instanceof HttpsError) {
          throw err;
        }
        logger.error('discussReading: reading load failed', { err: String(err), userId });
        throw new HttpsError('internal', 'Could not open that reading.');
      }

      const grounding: ReadingGrounding = {
        question: doc.question,
        verdict: doc.verdict,
        confidence: doc.confidence,
        computedAt:
          doc.createdAt !== undefined && typeof doc.createdAt.toDate === 'function'
            ? doc.createdAt.toDate().toISOString()
            : new Date().toISOString(),
        oracle: asComposition(doc.watchOracle),
        narration: doc.narration?.[input.lang] ?? doc.narration?.en ?? null,
      };

      const turns: DiscussionTurn[] = (input.turns ?? []).map(turn => ({
        role: turn.role,
        text: turn.text,
      }));

      const reply = await composeDiscussionReply({
        grounding,
        turns,
        message: input.message,
        replyLang: input.lang,
      });

      if (reply === null) {
        // No deterministic fallback exists for a conversational reply — see
        // discussionComposer's header. Give the turn back and let the client
        // offer a retry rather than serving invented prose.
        await readingRef.update({ discussionTurns: FieldValue.increment(-1) }).catch(refundErr => {
          logger.warn('discussReading: turn refund failed', {
            err: String(refundErr),
            userId,
          });
        });
        throw new HttpsError('unavailable', 'The oracle did not answer. Try again.');
      }

      const audit: Omit<AuditLogDoc, 'ts'> = {
        userId,
        action: 'discussion_turn',
        questionHash: hashText(input.message),
        source: 'callable',
      };
      try {
        await db.collection('auditLogs').add({ ...audit, ts: new Date() });
      } catch (err) {
        logger.warn('discussReading: audit log write failed', { err: String(err) });
      }

      const response: DiscussReadingResponse = {
        answer: reply.answer,
        isNewQuestion: reply.isNewQuestion,
        turnsRemaining,
      };

      // Stored, so a retry replays THIS answer rather than spending another
      // turn to generate a different one.
      if (requestId !== undefined) {
        await completeRequest(userId, requestId, response);
      }

      return response;
    });
  },
);
