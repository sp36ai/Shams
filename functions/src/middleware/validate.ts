/**
 * validate.ts — Zod input schemas for all callable functions.
 *
 * All schemas are strict (no extra keys pass through).
 * Validation failures throw HttpsError('invalid-argument') so the client
 * receives a structured error, never a raw Zod stack trace.
 */

import { z } from 'zod';
import { HttpsError } from 'firebase-functions/v2/https';

// ── Shared primitives ────────────────────────────────────────────────────────

const LangSchema = z.enum(['en', 'ur', 'hi']);

/**
 * seekerName / motherName are the only user-controlled free-text fields that
 * reach a Claude prompt (see askOracle.ts's buildOracleUserMessage and
 * oracle/responseComposer.ts's buildUserPrompt — both interpolate them
 * directly as `SEEKER_NAME: ${value}`). This does not attempt to be a
 * "prompt injection sanitizer" — no regex reliably detects intent. It only
 * removes the characters a legitimate human name never contains but that
 * carry structural meaning in a prompt (control characters, and the
 * quoting/bracketing/escaping characters a payload would use to try to
 * break out of the `SEEKER_NAME: ` line) — normal names, including
 * hyphenated and apostrophe'd ones across scripts, are unaffected.
 */
function sanitizeName(raw: string): string {
  return raw
    .normalize('NFKC')
    // Unicode "Cc" (control) category — covers newlines/tabs/C0/DEL without
    // spelling out raw control bytes or \u-escaped ranges in the source.
    .replace(/\p{Cc}/gu, '')
    .replace(/[`"{}[\]<>\\|~^]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

const NameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .transform(sanitizeName)
  .pipe(z.string().min(1).max(100));

// ── Function-specific schemas ────────────────────────────────────────────────


/**
 * askWatchOracle input.
 *
 * No lat/lon: the Digital Watch Oracle needs no location (its house frame is
 * watch-derived and planetary positions are location-invariant).
 *
 * `utcOffsetMinutes` names the querent's timezone so the server can derive the
 * minute showing on THEIR watch from its own authoritative instant. Bounded to
 * the real range of civil offsets (-12:00 .. +14:00) and to quarter-hour steps,
 * which covers every zone in use including the :30 and :45 ones.
 */
export const AskWatchOracleSchema = z
  .object({
    question: z.string().trim().min(5).max(500),
    questionLang: LangSchema,
    utcOffsetMinutes: z.number().int().min(-720).max(840).multipleOf(15),
    seekerProfile: z.enum(['clarity', 'comfort', 'action', 'surrender']).optional(),
    seekerName: NameSchema.optional(),
    motherName: NameSchema.optional(),
    /**
     * Client-generated, once per user action and reused on every retry of
     * that action. It is what lets the server tell a retry from a second
     * question — see utils/idempotency.ts. Optional so a client that predates
     * it still works; such a call simply gets no deduplication.
     */
    requestId: z.string().trim().min(8).max(128).optional(),
  })
  .strict();

export type AskWatchOracleInput = z.infer<typeof AskWatchOracleSchema>;

/**
 * discussReading input.
 *
 * Note what is NOT here: no verdict, no diagnosis, no timing. A follow-up
 * names the reading it is about and nothing more — the grounding facts are
 * loaded from Firestore server-side, so the caller cannot present the oracle
 * with a reading it never gave (see discussReading.ts).
 *
 * `turns` is the recent transcript, oldest first, sent so the reply follows
 * the conversation rather than restarting it. It is the seeker's own words
 * and the oracle's own earlier replies, so it carries no authority beyond
 * context; it is capped here and flattened again before it reaches the model.
 */
export const DiscussReadingSchema = z
  .object({
    readingId: z.string().min(1).max(128),
    /**
     * Other readings the seeker is comparing this one against — e.g. "which
     * looks stronger, the business reading or the property one?" Bounded
     * small, same reasoning as `turns` below: a discussion turn is not the
     * place for an open-ended list. Ownership of each id is re-checked
     * server-side in discussReading.ts; an id that fails the check is
     * dropped rather than failing the whole call.
     */
    compareReadingIds: z.array(z.string().min(1).max(128)).max(4).optional(),
    message: z.string().trim().min(1).max(500),
    lang: LangSchema,
    turns: z
      .array(
        z
          .object({
            role: z.enum(['seeker', 'oracle']),
            text: z.string().max(4000),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    /**
     * Client-generated, once per follow-up and reused on every retry of it —
     * same contract as askWatchOracle's. Optional so an older client still
     * works, at the cost of deduplication.
     */
    requestId: z.string().trim().min(8).max(128).optional(),
  })
  .strict();

export type DiscussReadingInput = z.infer<typeof DiscussReadingSchema>;

export const SyncReadingsSchema = z
  .object({
    readings: z
      .array(
        z.object({
          id: z.string().min(1).max(128),
          question: z.string().max(500),
          questionLang: LangSchema,
          category: z.string().max(64),
          verdict: z.enum(['YES', 'NO', 'CONDITIONAL', 'DELAYED', 'UNCLEAR', 'PENDING', 'DENIED']),
          createdAt: z.string().datetime(),
        }),
      )
      .max(100),
  })
  .strict();

export type SyncReadingsInput = z.infer<typeof SyncReadingsSchema>;

export const DeleteReadingSchema = z
  .object({
    readingId: z.string().min(1).max(128),
  })
  .strict();

export type DeleteReadingInput = z.infer<typeof DeleteReadingSchema>;

export const VerifyGooglePlaySchema = z
  .object({
    purchaseToken: z.string().min(1).max(1024),
    productId: z.string().min(1).max(128),
    packageName: z.string().min(1).max(256),
  })
  .strict();

export type VerifyGooglePlayInput = z.infer<typeof VerifyGooglePlaySchema>;

// ── Parser helper ────────────────────────────────────────────────────────────

export function parse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.errors[0];
    const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Invalid input';
    throw new HttpsError('invalid-argument', msg);
  }
  return result.data;
}
