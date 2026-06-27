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

const LatSchema = z.number().min(-90).max(90);
const LonSchema = z.number().min(-180).max(180);
const LangSchema = z.enum(['en', 'ur', 'hi']);

// ── Function-specific schemas ────────────────────────────────────────────────

export const AskOracleSchema = z
  .object({
    question: z.string().trim().min(5).max(500),
    lat: LatSchema,
    lon: LonSchema,
    questionLang: LangSchema,
  })
  .strict();

export type AskOracleInput = z.infer<typeof AskOracleSchema>;

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
