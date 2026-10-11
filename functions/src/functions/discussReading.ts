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
 *   and more expensive for us. Discussion is therefore free. It ends when the
 *   oracle judges the conversation has done its work (`conversationComplete`,
 *   owner decision 2026-10-11): that reply is a graceful close, and the
 *   reading's `discussionClosed` is set so later follow-ups are declined.
 *   DISCUSSION_TURN_LIMIT stays only as a cost ceiling, on top of the ordinary
 *   per-minute rate limit — enforced server-side on the reading document.
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
import type { ReadingContract } from '../oracle/readingContract';
import {
  composeDiscussionReply,
  type DiscussionTurn,
  type ReadingGrounding,
} from '../oracle/discussionComposer';

/**
 * A short, server-derived tag for a reading — "the finance reading", never
 * the seeker's own words and never something the model invents. Used only
 * to distinguish readings from each other when more than one is in a brief;
 * see buildDiscussionBrief's multi-reading branch.
 *
 * PHASE 5F-R2: labels for a single call are now assigned together
 * (`labelsFor` below), not one document at a time, so a repeated category
 * across two distinct readings in the same brief (e.g. two separate
 * "finance" readings being compared) can be disambiguated — otherwise
 * `discussionComposer.ts`'s label-based claim attribution
 * (`segmentReplyByGrounding`) would see two identical labels and correctly
 * fall back to anchor-only validation for the whole reply, silently losing
 * the very comparison-reading coverage this phase adds. This function is
 * kept as the single-document primitive `labelsFor` calls internally.
 */
function labelFor(doc: ReadingDoc): string {
  return `the ${doc.category} reading`;
}

/**
 * PHASE 5F-R2: assign every reading in this call (anchor first, then each
 * comparison reading, in the order they will become `groundings`) a label,
 * appending a numeric suffix — " (2)", " (3)", ... — the second and later
 * times a category repeats. The anchor is always index 0, so it is always
 * the FIRST occurrence of its own category and therefore never suffixed;
 * only a later reading that repeats an already-used category gets one.
 * Deterministic and order-only — no randomness, no reliance on document
 * ids or Firestore ordering beyond the order this function is given.
 *
 * Exported for direct testing.
 */
export function labelsFor(docs: readonly ReadingDoc[]): string[] {
  const counts = new Map<string, number>();
  return docs.map(doc => {
    const base = labelFor(doc);
    const seen = (counts.get(base) ?? 0) + 1;
    counts.set(base, seen);
    return seen === 1 ? base : `${base} (${seen})`;
  });
}

/**
 * PHASE 5F-R2: de-duplicate a caller-supplied list of comparison reading
 * ids, first occurrence wins, order preserved. Determinism for the
 * "duplicate comparison ids" case: without this, the same reading document
 * would be read twice inside the transaction below and appear twice in
 * `groundings` with an identical label — exactly the ambiguity
 * `segmentReplyByGrounding()` is built to fall back safely from, but
 * de-duplicating here means that fallback is never even reached for this
 * specific, entirely avoidable case.
 *
 * Exported for direct testing.
 */
export function dedupeIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

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

/**
 * PHASE 5F: narrow a stored `readingContract` field back to a
 * `ReadingContract`, the same way `asComposition` above narrows
 * `watchOracle` — shape-checked, not asserted, since Firestore round-trips
 * are outside TypeScript's own guarantees. `null` for a reading cast
 * before this phase shipped, or whose synthesis failed before a contract
 * was assembled; `composeDiscussionReply()`'s own validation step treats
 * that as "skip validation," not "fail" — see discussionComposer.ts.
 */
function asReadingContract(value: unknown): ReadingContract | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const o = value as Record<string, unknown>;
  if (typeof o.provenance !== 'object' || o.provenance === null) {
    return null;
  }
  if (typeof o.judgment !== 'object' || o.judgment === null) {
    return null;
  }
  if (typeof o.diagnosis !== 'object' || o.diagnosis === null) {
    return null;
  }
  if (typeof o.remedy !== 'object' || o.remedy === null) {
    return null;
  }
  if (!Array.isArray(o.celestialEntities)) {
    return null;
  }
  return value as ReadingContract;
}

export interface DiscussReadingResponse {
  answer: string;
  /** True when the follow-up is really its own horary question. */
  isNewQuestion: boolean;
  /** Follow-ups left on this reading, after this one. */
  turnsRemaining: number;
  /**
   * True when this reply closed the conversation. Later follow-ups on this
   * reading are declined with the same error as an exhausted budget.
   */
  conversationComplete: boolean;
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
      // Other readings the seeker wants compared against this one — read-only
      // context, ownership-checked the same way as the anchor, but never
      // charged a discussion turn of their own: they are not being discussed
      // as their own thread here, they are supporting context for this one.
      // PHASE 5F-R2: de-duplicated — see dedupeIds's own doc comment for why
      // a repeated id must not silently produce two identical groundings.
      const compareIds = dedupeIds(
        (input.compareReadingIds ?? []).filter(id => id !== input.readingId),
      );
      const compareRefs = compareIds.map(id => db.collection('readings').doc(id));

      let doc: ReadingDoc;
      let turnsRemaining: number;
      let compareDocs: ReadingDoc[];

      try {
        ({ doc, turnsRemaining, compareDocs } = await db.runTransaction(async tx => {
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
          if (data.discussionClosed === true || used >= DISCUSSION_TURN_LIMIT) {
            throw new HttpsError(
              'resource-exhausted',
              'This reading has said what it can. Ask your next question as a new Reading.',
            );
          }

          // Best-effort, read-only: a stale or foreign comparison id is
          // dropped rather than failing the seeker's actual question. Same
          // ownership rule as the anchor, just silent instead of thrown.
          const compareSnaps = await Promise.all(compareRefs.map(ref => tx.get(ref)));
          const compare = compareSnaps
            .map(s => (s.exists ? (s.data() as ReadingDoc) : null))
            .filter((d): d is ReadingDoc => d !== null && d.userId === userId);

          tx.update(readingRef, { discussionTurns: FieldValue.increment(1) });
          return {
            doc: data,
            turnsRemaining: DISCUSSION_TURN_LIMIT - used - 1,
            compareDocs: compare,
          };
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

      // PHASE 5F-R2: every reading in this call — anchor first, comparisons
      // after, same order groundings will use — gets both a disambiguated
      // label (labelsFor) and its OWN persisted contract (asReadingContract),
      // not just the anchor. See discussionComposer.ts's header for why
      // this closes the comparison-reading validation gap without a second
      // validator.
      const allDocs = [doc, ...compareDocs];
      const labels = labelsFor(allDocs);

      const toGrounding = (d: ReadingDoc, label: string): ReadingGrounding => ({
        label,
        question: d.question,
        verdict: d.verdict,
        confidence: d.confidence,
        computedAt:
          d.createdAt !== undefined && typeof d.createdAt.toDate === 'function'
            ? d.createdAt.toDate().toISOString()
            : new Date().toISOString(),
        oracle: asComposition(d.watchOracle),
        narration: d.narration?.[input.lang] ?? d.narration?.en ?? null,
        contract: asReadingContract(d.readingContract),
      });

      const groundings: [ReadingGrounding, ...ReadingGrounding[]] = [
        toGrounding(allDocs[0]!, labels[0]!),
        ...allDocs.slice(1).map((d, i) => toGrounding(d, labels[i + 1]!)),
      ];

      const turns: DiscussionTurn[] = (input.turns ?? []).map(turn => ({
        role: turn.role,
        text: turn.text,
      }));

      const reply = await composeDiscussionReply({
        groundings,
        turns,
        message: input.message,
        replyLang: input.lang,
      });

      if (reply === null) {
        // No deterministic fallback exists for a conversational reply — see
        // discussionComposer's header. This is also where a reply that
        // failed PHASE 5F's own validation lands, by design (see that
        // file's header for why it reuses this exact "no reply" outcome
        // rather than inventing a new one). Give the turn back and let the
        // client offer a retry rather than serving invented or ungrounded
        // prose.
        await readingRef.update({ discussionTurns: FieldValue.increment(-1) }).catch(refundErr => {
          logger.warn('discussReading: turn refund failed', {
            err: String(refundErr),
            userId,
          });
        });
        // The claim must not outlive this attempt, same as the load-failure
        // catch above: without this, a seeker who retries under the SAME
        // requestId — exactly what the client's retry button does, and
        // exactly what this error message invites — hits claimRequest's
        // in-flight branch instead of a genuine retry, and is told "already
        // being read" for up to IN_PROGRESS_TIMEOUT_MS even though nothing
        // is running.
        await release();
        throw new HttpsError('unavailable', 'The oracle did not answer. Try again.');
      }

      if (reply.conversationComplete) {
        // The closing reply is still returned if this write fails; the next
        // follow-up is then simply answered (or closed) again — no harm done.
        await readingRef.update({ discussionClosed: true }).catch(closeErr => {
          logger.warn('discussReading: marking discussion closed failed', {
            err: String(closeErr),
            userId,
          });
        });
      }

      const audit: Omit<AuditLogDoc, 'ts'> = {
        userId,
        action: 'discussion_turn',
        questionHash: hashText(input.message),
        source: 'callable',
        readingId: input.readingId,
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
        conversationComplete: reply.conversationComplete,
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
