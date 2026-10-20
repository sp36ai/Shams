/**
 * keyedHash — the correlation codes stored in audit/security records and
 * logs, in place of question text and IP addresses (owner decision
 * 2026-10-20).
 * --------------------------------------------------------------------------
 * Replaces two unkeyed hashes that could be reversed by guessing: a 32-bit
 * FNV-1a of question text (a common question matches its code) and an
 * unsalted SHA-256 of the IP (all of IPv4 can be enumerated). With HMAC-
 * SHA-256 under LOG_HASH_KEY, a guess cannot be checked without the key.
 * That reduces guessing risk; it does not make the records anonymous —
 * anyone holding the key can still match a guess, and equal inputs still
 * produce equal codes, which is the point of a correlation code.
 *
 * - Domain separation: the purpose is part of the MAC input, so a question
 *   code and an IP code can never be compared with each other.
 * - Versioned: codes are "h1:" + 32 hex chars (128 bits). Records written
 *   before this change carry bare FNV (8 hex) or SHA-256 prefix (16 hex)
 *   values; the prefix tells them apart and the two never match, so
 *   correlation does not reach across the switch. Rotating the key needs
 *   a new prefix for the same reason.
 * - No key, no code: if LOG_HASH_KEY is not available (an emulator run
 *   without it), the field is omitted. It never falls back to an unkeyed
 *   hash, and the key is never logged.
 */

import { createHmac } from 'crypto';
import { LOG_HASH_KEY } from '../config';
import { logger } from './logger';

export type HashPurpose = 'question' | 'ip';

const VERSION = 'h1';

let warnedMissingKey = false;

function key(): string | null {
  let value = '';
  try {
    value = LOG_HASH_KEY.value();
  } catch {
    value = '';
  }
  if (value.length === 0) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      logger.warn('LOG_HASH_KEY not available — correlation codes omitted');
    }
    return null;
  }
  return value;
}

/** A keyed correlation code for `value`, or undefined when no key is bound. */
export function keyedHash(purpose: HashPurpose, value: string): string | undefined {
  const k = key();
  if (k === null) {
    return undefined;
  }
  const mac = createHmac('sha256', k).update(`${purpose}\u0000${value}`).digest('hex');
  return `${VERSION}:${mac.slice(0, 32)}`;
}
