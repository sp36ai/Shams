/**
 * responseComposer.ts — the communication layer.
 * --------------------------------------------------------------------------
 * Pipeline position:
 *   WatchVerdict → diagnose() → selectRemedyProtocol() → [this file] → reading
 *
 * The division of labour is the point of the whole architecture:
 *   - RKP decides the astrological diagnosis.
 *   - The remedy engine decides the intervention, from a controlled library.
 *   - Claude explains the result in natural language, and nothing more.
 *
 * Enforced structurally rather than by instruction: the model is never asked
 * to name a remedy. Remedy names, instructions and evidence labels are copied
 * verbatim from REMEDY_LIBRARY into the response after the model returns. The
 * model writes prose fields only, so it cannot invent a practice or an RKP
 * finding that the engines did not produce.
 *
 * Because the diagnosis and protocol are deterministic, a synthesis failure
 * degrades to a reading that still carries its full remedy protocol — only the
 * prose is lost.
 *
 * This file sits outside src/engine/, which is a generated mirror of
 * src/astrology/ and is pruned on every build.
 */

import { ANTHROPIC_API_KEY } from '../config';
import { logger } from '../utils/logger';
import { runWatchNarrationSafetyValidator } from '../functions/safetyValidator';
import { WATCH_ORACLE_SYNTHESIS_PROMPT } from '../prompts/watchOracleSynthesisPrompt';
import { diagnose, type RkpDiagnosis } from '../engine/rkp/diagnosis';
import type { DisplayWatchVerdict } from '../engine/rkp/watchJudgment';
import { selectRemedyProtocol, type RemedyProtocol } from './remedySelection';
import type { Tradition } from './remedyLibrary';

// Raised from 25s — Claude Opus 5 thinks by default, so synthesis is slower
// than it was on the non-thinking Opus 4.1. askWatchOracle runs under
// ORACLE_FUNCTION_OPTS (120s), so this stays well inside the function budget.
const SYNTHESIS_TIMEOUT_MS = 40_000;

/** The prose Claude is permitted to write. No remedy content appears here. */
interface NarrationFields {
  rkp_finding: string;
  interpretation: string;
  recommended_approach: string;
  why_this_remedy: string | null;
  signature: string;
}

/** A protocol step as it crosses the wire — library text, never model text. */
export interface OracleProtocolStep {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly evidenceType: string;
  readonly intensity: string;
  readonly duration: string | null;
  readonly explanation: string;
  readonly instructions: readonly string[];
  readonly isEscalation: boolean;
}

export interface WatchOracleComposition {
  /** Model prose. Null throughout when synthesis failed. */
  readonly narration: NarrationFields | null;
  readonly diagnosis: {
    readonly outcome: string;
    readonly primaryPattern: string;
    readonly secondaryPatterns: readonly string[];
    readonly timingPosture: string;
    readonly confidence: number;
    readonly obstructingAgent: string | null;
    readonly rationale: readonly string[];
  };
  readonly protocol: {
    readonly interventionRequired: boolean;
    readonly guidance: string | null;
    readonly steps: readonly OracleProtocolStep[];
    readonly rationale: readonly string[];
  };
}

export interface CompositionInput {
  readonly verdict: DisplayWatchVerdict;
  readonly seekerName?: string;
  readonly motherName?: string;
  readonly traditions?: readonly Tradition[];
  /**
   * The reading document's id, assigned by the caller before this runs.
   * Used only to correlate a safety-validator log entry with the reading it
   * screened (readings/{readingId}/validationLog) — see narrate() below.
   */
  readonly readingId: string;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatTiming(window: { minDays: number; maxDays: number } | null): string {
  if (!window) {
    return 'no usable timing signal';
  }
  if (window.minDays === window.maxDays) {
    return `around ${window.minDays} day${window.minDays === 1 ? '' : 's'}`;
  }
  return `${window.minDays} to ${window.maxDays} days`;
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenced?.[1] ?? trimmed;
}

/**
 * Build the model's brief. It receives the diagnosis and the already-chosen
 * remedies as settled facts to explain — never as options to choose between.
 */
function buildUserPrompt(
  diagnosis: RkpDiagnosis,
  protocol: RemedyProtocol,
  seekerName?: string,
  motherName?: string,
): string {
  const remedyLines = protocol.steps.length
    ? protocol.steps
        .map(
          (s, i) =>
            `  ${i + 1}. ${s.remedy.name} [${s.remedy.category}/${s.remedy.evidenceType}] — ${s.reason}`,
        )
        .join('\n')
    : '  (none — no intervention indicated)';

  return `
RKP DIAGNOSIS (settled — explain, do not revise)
  Outcome:            ${diagnosis.outcome}
  Primary pattern:    ${diagnosis.primaryPattern}
  Secondary patterns: ${diagnosis.secondaryPatterns.join(', ') || 'none'}
  Timing posture:     ${diagnosis.timingPosture}
  Timing window:      ${formatTiming(diagnosis.timing)}
  Confidence:         ${diagnosis.confidence.toFixed(2)}
  Obstructing agent:  ${diagnosis.obstructingAgent ?? 'none'}
  Target house:       ${diagnosis.targetHouse}
  Question type:      ${diagnosis.qType}

CHART RATIONALE (the engine's own reasoning)
${diagnosis.rationale.map(r => `  - ${r}`).join('\n')}

SELECTED INTERVENTIONS (settled — explain why they fit, do not rename or replace)
${remedyLines}

INTERVENTION REQUIRED: ${protocol.interventionRequired ? 'yes' : 'no'}
${protocol.guidance ? `NO-REMEDY GUIDANCE: ${protocol.guidance}` : ''}

SEEKER_NAME: ${seekerName || 'not provided'}
MOTHER_NAME: ${motherName || 'not provided'}
`;
}

/* -------------------------------------------------------------------------- */
/*  Composition                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Run the full RKP → diagnosis → remedy → narration pipeline.
 *
 * Never throws for synthesis problems: the diagnosis and protocol are computed
 * deterministically before Claude is contacted, so a failed or malformed
 * synthesis returns a composition with `narration: null` and everything else
 * intact.
 */
export async function composeWatchOracleResponse(
  input: CompositionInput,
): Promise<WatchOracleComposition> {
  const { verdict, seekerName, motherName, traditions, readingId } = input;

  // ── 1. Diagnosis (deterministic) ─────────────────────────────────────────
  const diagnosis = diagnose(verdict);

  // ── 2. Remedy protocol (deterministic) ───────────────────────────────────
  const protocol = selectRemedyProtocol(diagnosis, { traditions });

  const steps: OracleProtocolStep[] = protocol.steps.map(s => ({
    id: s.remedy.id,
    name: s.remedy.name,
    category: s.remedy.category,
    evidenceType: s.remedy.evidenceType,
    intensity: s.remedy.intensity,
    duration: s.remedy.duration ?? null,
    explanation: s.remedy.explanation,
    instructions: s.remedy.instructions,
    isEscalation: s.remedy.category === 'practical' && s.remedy.escalationFor !== undefined,
  }));

  const base = {
    diagnosis: {
      outcome: diagnosis.outcome,
      primaryPattern: diagnosis.primaryPattern,
      secondaryPatterns: diagnosis.secondaryPatterns,
      timingPosture: diagnosis.timingPosture,
      confidence: diagnosis.confidence,
      obstructingAgent: diagnosis.obstructingAgent,
      rationale: diagnosis.rationale,
    },
    protocol: {
      interventionRequired: protocol.interventionRequired,
      guidance: protocol.guidance,
      steps,
      rationale: protocol.rationale,
    },
  };

  // ── 3. Narration (best effort) ───────────────────────────────────────────
  const narration = await narrate(diagnosis, protocol, readingId, seekerName, motherName);

  return Object.freeze({ narration, ...base });
}

async function narrate(
  diagnosis: RkpDiagnosis,
  protocol: RemedyProtocol,
  readingId: string,
  seekerName?: string,
  motherName?: string,
): Promise<NarrationFields | null> {
  const apiKey = ANTHROPIC_API_KEY.value();
  if (!apiKey) {
    logger.warn('watch oracle narration skipped: ANTHROPIC_API_KEY not bound');
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, SYNTHESIS_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        // Must be a CURRENT Anthropic model id — 'claude-opus-4-1-20250805'
        // reached its retirement date on 2026-08-05 and 404s, which silently
        // dropped narration from every watch reading (narrate() returns null
        // on a non-OK response).
        model: 'claude-opus-5',
        // Opus 5 thinks by default and max_tokens bounds thinking + response
        // together; 1500 was sized for a non-thinking model and would truncate
        // the JSON before the required fields were emitted.
        max_tokens: 4096,
        output_config: { effort: 'low' },
        system: WATCH_ORACLE_SYNTHESIS_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildUserPrompt(diagnosis, protocol, seekerName, motherName),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn('watch oracle narration HTTP error', {
        status: res.status,
        body: body.slice(0, 300),
      });
      return null;
    }

    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const raw = json.content?.find(b => b.type === 'text')?.text ?? '';

    const parsed = JSON.parse(stripJsonFence(raw)) as Partial<NarrationFields>;

    if (
      !parsed.rkp_finding ||
      !parsed.interpretation ||
      !parsed.recommended_approach ||
      !parsed.signature
    ) {
      logger.warn('watch oracle narration missing required fields');
      return null;
    }

    const drafted: NarrationFields = {
      rkp_finding: parsed.rkp_finding,
      interpretation: parsed.interpretation,
      recommended_approach: parsed.recommended_approach,
      // A no-remedy reading must not carry a remedy justification.
      why_this_remedy: protocol.interventionRequired ? (parsed.why_this_remedy ?? null) : null,
      signature: parsed.signature,
    };

    // Second defense layer — independent post-generation re-check of the
    // free-prose fields (medical/financial/legal claims, false-certainty
    // language, fear amplification — see safetyValidator.ts's prompt). The
    // system prompt above is the first layer; this is what askOracle always
    // had and askWatchOracle, the function actually shipping to users, did
    // not. Fail-open on its own errors/timeout — an unreachable validator
    // must not turn a working reading into a broken one.
    try {
      return await runWatchNarrationSafetyValidator(drafted, readingId, apiKey);
    } catch (validatorErr) {
      logger.warn('watch oracle narration: safety validator failed, using unvalidated text', {
        err: String(validatorErr),
      });
      return drafted;
    }
  } catch (err) {
    logger.warn('watch oracle narration failed', { err: String(err) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
