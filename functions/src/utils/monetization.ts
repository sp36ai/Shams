/**
 * monetization.ts — which pricing rules apply to a seeker.
 *
 * Two modes:
 *   legacy  the rules in force before the coin economy: daily question quota
 *           (FREE_LIMIT / TRIAL_DAILY_LIMIT), paid plans unlimited, discussion
 *           free (bounded by DISCUSSION_TURN_LIMIT).
 *   coins   the owner's coin economy (decision 2026-10-14):
 *             - free: one question per 7 days (counted from the last free
 *               question), verdict only; an extra question costs
 *               EXTRA_QUESTION_COST_MILLI from the wallet;
 *             - paid plan: unlimited questions under a fair-use cap of
 *               PAID_DAILY_FAIR_USE per UTC day;
 *             - discussion is paid for everyone, by tokens
 *               (TOKENS_PER_MILLICOIN), and needs at least
 *               MIN_DISCUSSION_BALANCE_MILLI to start a turn.
 *
 * The switch lives in Firestore at `_system/monetization`:
 *   { mode: 'legacy' | 'coins', testers: string[] }
 * `mode` applies to everyone; uids in `testers` get 'coins' even while the
 * global mode is 'legacy', so the economy can be tested on the live server
 * without touching anyone else. A missing or unreadable document means
 * 'legacy' — deploying this code changes nothing until the owner flips it.
 */

import { db } from './admin';
import { logger } from './logger';

export type MonetizationMode = 'legacy' | 'coins';

interface MonetizationConfig {
  mode: MonetizationMode;
  testers: readonly string[];
}

const LEGACY: MonetizationConfig = Object.freeze({ mode: 'legacy', testers: [] });
const CACHE_MS = 60_000;

let cached: { at: number; config: MonetizationConfig } | null = null;

function parseConfig(raw: unknown): MonetizationConfig {
  if (raw === null || typeof raw !== 'object') {
    return LEGACY;
  }
  const r = raw as { mode?: unknown; testers?: unknown };
  const mode: MonetizationMode = r.mode === 'coins' ? 'coins' : 'legacy';
  const testers = Array.isArray(r.testers)
    ? r.testers.filter((t): t is string => typeof t === 'string')
    : [];
  return { mode, testers };
}

async function loadConfig(now = Date.now()): Promise<MonetizationConfig> {
  if (cached !== null && now - cached.at < CACHE_MS) {
    return cached.config;
  }
  try {
    const snap = await db.collection('_system').doc('monetization').get();
    const config = snap.exists ? parseConfig(snap.data()) : LEGACY;
    cached = { at: now, config };
    return config;
  } catch (err) {
    // Never let a config read failure change anyone's pricing: fall back to
    // the rules that were in force before the coin economy existed.
    logger.warn('monetization: config read failed — using legacy', { err: String(err) });
    return LEGACY;
  }
}

/** The pricing rules that apply to this seeker right now. */
export async function monetizationModeFor(userId: string): Promise<MonetizationMode> {
  const config = await loadConfig();
  if (config.mode === 'coins' || config.testers.includes(userId)) {
    return 'coins';
  }
  return 'legacy';
}

/** Test hook: forget the cached switch. */
export function resetMonetizationCache(): void {
  cached = null;
}
