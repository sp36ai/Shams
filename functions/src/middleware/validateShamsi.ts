/**
 * Validation Schemas for Shamsi Logic Cloud Functions
 * 
 * All schemas are strict (no extra keys pass through).
 * Validation failures throw HttpsError('invalid-argument').
 */

import { z } from 'zod';
import { HttpsError } from 'firebase-functions/v2/https';

const LangSchema = z.enum(['en', 'ur', 'hi']);

/**
 * askShamsiOracle input schema.
 * 
 * Requires real latitude/longitude for Placidus cusp calculation.
 * eventTimeline: 'macro' for years/months events, 'micro' for weeks/days.
 */
export const AskShamsiOracleSchema = z
  .object({
    question: z.string().trim().min(5).max(500),
    questionLang: LangSchema,
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    eventTimeline: z.enum(['macro', 'micro']).optional().default('macro'),
  })
  .strict();

export type AskShamsiOracleInput = z.infer<typeof AskShamsiOracleSchema>;

/**
 * Parse input with Zod schema. Throw structured HttpsError on validation failure.
 */
export function parse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.errors[0];
    const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Invalid input';
    throw new HttpsError('invalid-argument', msg);
  }
  return result.data;
}
