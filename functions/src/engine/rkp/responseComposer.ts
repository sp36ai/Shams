/**
 * responseComposer.ts — Orchestrator that transforms WatchVerdict into mystical
 * oracle responses using Claude Opus synthesis.
 *
 * Pipeline:
 *   WatchVerdict → Lookup Spiritual Remedy → Prompt Claude → Return Oracle Response
 *
 * This is the final layer that wraps raw celestial calculation in the mystical voice.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { WATCH_ORACLE_SYNTHESIS_PROMPT } from '../../prompts/watchOracleSynthesisPrompt';
import { REMEDY_MAP } from './spiritualRepository';
import type { WatchVerdict, WatchState, Confidence } from './watchJudgment';
import type { TimingWindow } from './watchJudgment';

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

/**
 * Convert timing window to human-readable string.
 *
 * E.g. { minDays: 3, maxDays: 7 } → "3 to 7 days"
 */
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
 * Compose an oracle response for a watch verdict.
 *
 * Calls Claude Opus to synthesize the watch judgment (factors, state, timing)
 * into the mystical Shams al-Asrār voice.
 *
 * @param input  Verdict + optional seeker/mother names
 * @returns      Oracle response (opening, interpretation, spiritual_layer, signature)
 */
export async function composeWatchOracleResponse(
  input: CompositionInput,
): Promise<OracleResponse> {
  const { verdict, seekerName, motherName } = input;

  // ── 1. Look up spiritual remedy ──────────────────────────────────────────
  const remedy = REMEDY_MAP[verdict.state as WatchState]?.[verdict.confidence as Confidence];
  if (!remedy) {
    throw new Error(
      `No remedy mapped for state=${verdict.state}, confidence=${verdict.confidence}`,
    );
  }

  // ── 2. Format inputs for Claude ──────────────────────────────────────────
  const timingStr = formatTiming(verdict.timing);
  const factorsSummary = verdict.factors.slice(0, 3).join(' '); // First 3 factors

  const userPrompt = `
VERDICT_STATE: ${verdict.state}
CONFIDENCE: ${verdict.confidence}
TIMING: ${timingStr}
FACTORS: ${factorsSummary}
REMEDY_VERSE: ${remedy.quran.english}
REMEDY_ASMA: ${remedy.asma.name}
REMEDY_COUNT: ${remedy.asma.count}
REMEDY_TIMING: ${remedy.asma.timing}
SEEKER_NAME: ${seekerName || 'not provided'}
MOTHER_NAME: ${motherName || 'not provided'}
TARGET_RULER: ${verdict.targetRulerName}
DIRECTION: ${verdict.direction}
OBSTRUCTION: ${typeof verdict.obstruction === 'string' ? verdict.obstruction : 'None'}
CONTROL_PROFILE: ${verdict.controllerProfile}
`;

  // ── 3. Call Claude Opus ──────────────────────────────────────────────────
  const client = new Anthropic();

  let responseText = '';
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 1500,
      system: WATCH_ORACLE_SYNTHESIS_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Extract the text content from the response
    if (response.content && response.content.length > 0) {
      const firstContent = response.content[0];
      if (firstContent.type === 'text') {
        responseText = firstContent.text;
      }
    }
  } catch (err) {
    throw new Error(`Claude synthesis failed: ${String(err)}`);
  }

  // ── 4. Parse JSON response ──────────────────────────────────────────────
  let oracleResponse: OracleResponse;
  try {
    oracleResponse = JSON.parse(responseText) as OracleResponse;
  } catch (err) {
    throw new Error(`Failed to parse Oracle response: ${responseText.slice(0, 200)}`);
  }

  // ── 5. Validate required fields ─────────────────────────────────────────
  if (
    !oracleResponse.opening ||
    !oracleResponse.interpretation ||
    !oracleResponse.spiritual_layer ||
    !oracleResponse.signature
  ) {
    throw new Error(
      `Oracle response missing required fields: ${JSON.stringify(oracleResponse)}`,
    );
  }

  return oracleResponse;
}

/**
 * Compose a batch of oracle responses (for testing/demo).
 *
 * @param inputs Array of composition inputs
 * @returns      Array of oracle responses
 */
export async function composeWatchOracleResponseBatch(
  inputs: CompositionInput[],
): Promise<OracleResponse[]> {
  const responses = await Promise.all(
    inputs.map(input => composeWatchOracleResponse(input)),
  );
  return responses;
}
