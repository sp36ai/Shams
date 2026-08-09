/**
 * responseComposer.ts — turns a WatchVerdict into the mystical oracle voice.
 *
 * Pipeline:
 *   WatchVerdict → look up spiritual remedy → Claude synthesis → OracleResponse
 *
 * This file lives outside `src/engine/` on purpose. Everything under engine/ is
 * a generated mirror of `src/astrology/` (see functions/scripts/sync-engine.mjs)
 * and is pruned on every build; server-only code must not live there.
 *
 * The Anthropic key comes from the shared Secret Manager binding in ../config.
 * Any function calling this must declare `secrets: [ANTHROPIC_API_KEY]`, or
 * `.value()` resolves empty at runtime.
 */

import { ANTHROPIC_API_KEY } from '../config';
import { logger } from '../utils/logger';
import { WATCH_ORACLE_SYNTHESIS_PROMPT } from '../prompts/watchOracleSynthesisPrompt';
import { REMEDY_MAP } from './spiritualRepository';
import type { WatchVerdict, TimingWindow } from '../engine/rkp/watchJudgment';

/** Matches the ceiling askOracle allows for its own synthesis call. */
const SYNTHESIS_TIMEOUT_MS = 25_000;

export interface OracleResponse {
  opening: string;
  interpretation: string;
  spiritual_layer: string;
  signature: string;
}

export interface CompositionInput {
  verdict: WatchVerdict;
  seekerName?: string;
  motherName?: string;
}

/** E.g. { minDays: 3, maxDays: 7 } → "3 to 7 days". */
function formatTiming(window: TimingWindow | null): string {
  if (!window) {
    return 'UNCLEAR';
  }
  if (window.minDays === window.maxDays) {
    return `around ${window.minDays} day${window.minDays === 1 ? '' : 's'}`;
  }
  return `${window.minDays} to ${window.maxDays} days`;
}

/**
 * Claude is asked for bare JSON, but models routinely wrap it in a fenced
 * block. Strip the fence before parsing rather than failing the whole reading.
 */
function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenced?.[1] ?? trimmed;
}

/**
 * Compose an oracle response for a watch verdict.
 *
 * @throws when the remedy lookup, the Anthropic call, or the parse fails.
 *         Callers treat composition as optional — the reading still stands
 *         on its verdict alone.
 */
export async function composeWatchOracleResponse(input: CompositionInput): Promise<OracleResponse> {
  const { verdict, seekerName, motherName } = input;

  // ── 1. Look up spiritual remedy ──────────────────────────────────────────
  const remedy = REMEDY_MAP[verdict.state]?.[verdict.confidence];
  if (!remedy) {
    throw new Error(
      `No remedy mapped for state=${verdict.state}, confidence=${verdict.confidence}`,
    );
  }

  // ── 2. Format inputs for Claude ──────────────────────────────────────────
  const userPrompt = `
VERDICT_STATE: ${verdict.state}
CONFIDENCE: ${verdict.confidence}
TIMING: ${formatTiming(verdict.timing)}
FACTORS: ${verdict.factors.slice(0, 3).join(' ')}
REMEDY_VERSE: ${remedy.quran.english}
REMEDY_ASMA: ${remedy.asma.name}
REMEDY_COUNT: ${remedy.asma.count}
REMEDY_TIMING: ${remedy.asma.timing}
SEEKER_NAME: ${seekerName || 'not provided'}
MOTHER_NAME: ${motherName || 'not provided'}
TARGET_RULER: ${verdict.targetRulerName}
DIRECTION: ${verdict.direction}
OBSTRUCTION: ${verdict.obstruction}
CONTROL_PROFILE: ${verdict.controllerProfile}
`;

  // ── 3. Call Claude ───────────────────────────────────────────────────────
  const apiKey = ANTHROPIC_API_KEY.value();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not bound to this function');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, SYNTHESIS_TIMEOUT_MS);

  let responseText = '';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 1500,
        system: WATCH_ORACLE_SYNTHESIS_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn('watch oracle synthesis HTTP error', {
        status: res.status,
        body: body.slice(0, 300),
      });
      throw new Error(`Anthropic returned ${res.status}`);
    }

    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    responseText = json.content?.find(b => b.type === 'text')?.text ?? '';
  } finally {
    clearTimeout(timer);
  }

  // ── 4. Parse and validate ───────────────────────────────────────────────
  let oracleResponse: OracleResponse;
  try {
    oracleResponse = JSON.parse(stripJsonFence(responseText)) as OracleResponse;
  } catch {
    throw new Error(`Failed to parse oracle response: ${responseText.slice(0, 200)}`);
  }

  if (
    !oracleResponse.opening ||
    !oracleResponse.interpretation ||
    !oracleResponse.spiritual_layer ||
    !oracleResponse.signature
  ) {
    throw new Error('Oracle response missing required fields');
  }

  return oracleResponse;
}
