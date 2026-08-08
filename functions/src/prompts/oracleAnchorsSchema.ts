/**
 * oracleAnchorsSchema — the runtime validation layer between calculation
 * and text generation.
 * --------------------------------------------------------------------------
 * Source (RKP material): *"you should place this schema as a JSON validation
 * layer (JSON Schema or Pydantic model) right between the raw planetary
 * transit data input and your final text generation block ... If any
 * calculation error or data mutation happens in the transit feed, Pydantic
 * throws an immediate runtime error instead of passing bad data down the
 * pipeline."*
 *
 * This is the TypeScript equivalent. `deriveOracleAnchors()` is already
 * statically typed, so this layer exists for what the type system CANNOT
 * catch at runtime:
 *
 *   - an engine change that silently starts emitting an out-of-range value
 *   - a malformed timing string that would otherwise reach the prompt
 *   - a future refactor that widens a union without updating the prompt
 *
 * ── FAIL-OPEN, DELIBERATELY ────────────────────────────────────────────────
 * The material calls for a hard runtime error. This layer instead LOGS and
 * continues, matching the existing fail-open posture of safetyValidator.ts:
 * a seeker who has already spent quota should get their reading even if one
 * anchor is malformed, and every anchor has a safe textual fallback in the
 * prompt. The violation is logged with full detail so it surfaces in
 * monitoring rather than in the seeker's face. Use `parseOracleAnchors()`
 * if a hard throw is ever wanted instead.
 */

import { z } from 'zod';
import { logger } from '../utils/logger';
import type { OracleAnchors } from './oracleAnchors';

/**
 * A timing anchor is either the literal UNCLEAR or a "<min>-<max> <window>"
 * string — the only two shapes deriveOracleAnchors() can produce. Validating
 * the shape stops a malformed range ("NaN-NaN months") reaching the prompt,
 * where it would become a fabricated date in the seeker's reading.
 */
const TimingSchema = z
  .string()
  .refine(v => v === 'UNCLEAR' || /^\d+-\d+ (days|weeks|months|years)$/.test(v), {
    message: 'timing must be UNCLEAR or "<min>-<max> <days|weeks|months|years>"',
  });

export const OracleAnchorsSchema = z.object({
  verdict: z.enum(['YES_STRONG', 'YES_CONDITIONAL', 'DELAY', 'WAIT', 'NO_DENIED', 'INCONCLUSIVE']),
  confidence: z.enum(['VERY_HIGH', 'HIGH', 'MODERATE', 'LOW', 'UNCERTAIN']),
  condition: z.enum(['Siddhi', 'Stambhana', 'Gati', 'Vakra', 'Kshaya', 'Bija']),
  primaryTheme: z.enum([
    'STRONG_OPENING',
    'RAPID_RESOLUTION',
    'OPENING',
    'DELAY',
    'AMBIGUITY',
    'OBSTRUCTION',
    'STRUCTURAL_BLOCKAGE',
    'UNCLEAR_SIGNAL',
  ]),
  obstruction: z.enum([
    'Saturn',
    'Mars',
    'Rahu',
    'Ketu',
    'MOON_DISAGREEMENT',
    'DENIAL_WITNESS',
    'NONE',
  ]),
  secondaryTheme: z.enum(['ENVIRONMENTAL_FRICTION', 'INNER_CONFLICT', 'NONE']),
  timing: TimingSchema,
  direction: z.enum(['North', 'South', 'East', 'West']),
  reversal: z.enum(['POSSIBLE', 'IMPOSSIBLE', 'NONE']),
  rulerClash: z.enum(['CLASH', 'ALIGNED', 'NEUTRAL']),
  controllerStyle: z.enum(['DIRECT_ASSERTIVE', 'CAUTIOUS_ADMINISTRATIVE']),
});

export type ValidatedOracleAnchors = z.infer<typeof OracleAnchorsSchema>;

/** Strict parse — throws on any violation. */
export function parseOracleAnchors(anchors: unknown): ValidatedOracleAnchors {
  return OracleAnchorsSchema.parse(anchors);
}

/**
 * Validate before handing the anchors to the language model. Logs and
 * returns the anchors unchanged on failure (see the fail-open note above).
 *
 * @returns true when the anchors passed validation.
 */
export function validateOracleAnchors(anchors: OracleAnchors, readingId: string): boolean {
  const result = OracleAnchorsSchema.safeParse(anchors);
  if (result.success) {
    return true;
  }
  logger.error('oracle anchors failed validation — passing through to synthesis anyway', {
    readingId,
    issues: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
  });
  return false;
}
