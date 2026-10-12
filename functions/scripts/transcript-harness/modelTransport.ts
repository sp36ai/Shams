/**
 * modelTransport.ts — the only seam the harness opens in the pipeline.
 * --------------------------------------------------------------------------
 * responseComposer.ts and discussionComposer.ts call the OpenAI Responses
 * API through src/llm/openaiResponses.ts, which uses the global `fetch`. The
 * harness wraps that one function and nothing else: prompts, briefs,
 * validation, fallback and the rewrite retry all run as production code,
 * unmodified.
 *
 * Modes
 *   live    — passes each call through to the real API (needs
 *             OPENAI_API_KEY in the environment, exactly the secret the
 *             composers already read) and records request body + response
 *             text to a cassette. The key itself is never recorded: headers
 *             are not written anywhere.
 *   replay  — serves responses from a previously recorded cassette, keyed by
 *             a hash of the exact request body. A request the cassette does
 *             not hold is an error — a replay never silently goes live. This
 *             is how a baseline is re-scored after the metrics change.
 *   stub    — returns fixed placeholder JSON so the wiring can be exercised
 *             without a key. Stub output is NOT a transcript of the Oracle
 *             and must never be reported as one; every stub report says so.
 *
 * Cassette format
 *   v2 (current) — `formatVersion: 2`, `provider: 'openai'`, and each
 *                  exchange stamped with provider + model. OpenAI Responses
 *                  API bodies.
 *   v1 (legacy)  — no formatVersion; Anthropic Messages API bodies, recorded
 *                  before the 2026-10 provider migration. Refused on replay
 *                  with an explicit error: its requests can never match the
 *                  current pipeline's, and its responses must not be
 *                  reinterpreted as another provider's output. Kept on disk
 *                  as historical evidence only.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { OPENAI_RESPONSES_URL, extractResponseText } from '../../src/llm/openaiResponses';

export type TransportMode = 'live' | 'replay' | 'stub';
export type CallKind = 'synthesis' | 'discussion';

export const CASSETTE_FORMAT_VERSION = 2;
export const CASSETTE_PROVIDER = 'openai';

export interface Exchange {
  readonly seq: number;
  readonly key: string;
  readonly kind: CallKind;
  readonly provider: typeof CASSETTE_PROVIDER;
  readonly model: string;
  /** The JSON body as sent — model, instructions, brief and input. Never headers. */
  readonly requestBody: unknown;
  readonly status: number;
  /** Raw response body text, exactly as the composer received it. */
  readonly responseText: string;
  readonly ms: number;
  readonly error: string | null;
}

export interface Cassette {
  readonly formatVersion: typeof CASSETTE_FORMAT_VERSION;
  readonly provider: typeof CASSETTE_PROVIDER;
  readonly recordedAt: string;
  readonly mode: TransportMode;
  readonly exchanges: readonly Exchange[];
}

export interface Transport {
  readonly mode: TransportMode;
  readonly exchanges: Exchange[];
  restore(): void;
}

function requestKey(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

interface SentBody {
  model?: unknown;
  text?: { format?: { name?: unknown } };
}

function kindOf(parsed: SentBody): CallKind {
  // Each composer names its structured-output schema.
  return parsed.text?.format?.name === 'oracle_discussion_reply' ? 'discussion' : 'synthesis';
}

const STUB_SYNTHESIS = JSON.stringify({
  rkp_finding: '[stub] placeholder finding.',
  interpretation: '[stub] placeholder interpretation.',
  recommended_approach: '[stub] placeholder approach.',
  why_this_remedy: null,
  signature: '[stub] placeholder signature.',
});

const STUB_DISCUSSION = JSON.stringify({
  answer: '[stub] placeholder reply.',
  is_new_question: false,
  conversation_complete: false,
});

/** A completed Responses API body carrying `text` as its only output_text. */
function apiEnvelope(text: string): string {
  return JSON.stringify({
    object: 'response',
    status: 'completed',
    output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }],
  });
}

/**
 * Parse a cassette file and refuse anything that is not current-format
 * OpenAI. Exported for testing.
 */
export function loadCassette(text: string, path = 'cassette'): Cassette {
  const raw = JSON.parse(text) as Partial<Cassette> & {
    formatVersion?: unknown;
    provider?: unknown;
  };
  if (raw.formatVersion === undefined) {
    throw new Error(
      `${path} is a legacy (v1) cassette recorded against the Anthropic Messages API, before the ` +
        'OpenAI migration. It cannot be replayed through the current pipeline and is not ' +
        'reinterpreted as OpenAI output. Keep it as historical evidence; record a new run with --mode=live.',
    );
  }
  if (raw.formatVersion !== CASSETTE_FORMAT_VERSION || raw.provider !== CASSETTE_PROVIDER) {
    throw new Error(
      `${path}: unsupported cassette (formatVersion ${String(raw.formatVersion)}, provider ` +
        `${String(raw.provider)}). This harness replays formatVersion ${CASSETTE_FORMAT_VERSION}, ` +
        `provider ${CASSETTE_PROVIDER}.`,
    );
  }
  for (const ex of raw.exchanges ?? []) {
    if (ex.provider !== CASSETTE_PROVIDER) {
      throw new Error(`${path}: exchange ${ex.seq} is stamped provider ${String(ex.provider)}`);
    }
  }
  return raw as Cassette;
}

export function installTransport(mode: TransportMode, cassettePath?: string): Transport {
  const realFetch = globalThis.fetch;
  const exchanges: Exchange[] = [];

  const replayQueues = new Map<string, Exchange[]>();
  if (mode === 'replay') {
    if (cassettePath === undefined) {
      throw new Error('replay mode needs --cassette=<path>');
    }
    const cassette = loadCassette(readFileSync(cassettePath, 'utf8'), cassettePath);
    for (const ex of cassette.exchanges) {
      const q = replayQueues.get(ex.key) ?? [];
      q.push(ex);
      replayQueues.set(ex.key, q);
    }
  }
  if (mode === 'live' && !process.env.OPENAI_API_KEY) {
    throw new Error('live mode needs OPENAI_API_KEY in the environment');
  }
  if (mode !== 'live' && !process.env.OPENAI_API_KEY) {
    // The composers skip the call entirely without a key. Offline modes
    // answer every call from here, so a placeholder lets the call happen;
    // it never leaves the process.
    process.env.OPENAI_API_KEY = 'harness-offline-placeholder';
  }

  const wrapped: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url !== OPENAI_RESPONSES_URL) {
      return realFetch(input, init);
    }
    const bodyText = typeof init?.body === 'string' ? init.body : '';
    const parsed = JSON.parse(bodyText) as SentBody;
    const key = requestKey(bodyText);
    const kind = kindOf(parsed);
    const model = typeof parsed.model === 'string' ? parsed.model : 'unknown';
    const started = Date.now();
    const stamp = { key, kind, provider: CASSETTE_PROVIDER, model, requestBody: parsed } as const;

    let status = 200;
    let responseText = '';

    if (mode === 'live') {
      try {
        const res = await realFetch(input, init);
        status = res.status;
        responseText = await res.text();
      } catch (err) {
        // Recorded, then rethrown so the composer sees the same failure it
        // would in production (the adapter turns it into a classified failure).
        exchanges.push({
          seq: exchanges.length,
          ...stamp,
          status: 0,
          responseText: '',
          ms: Date.now() - started,
          error: String(err),
        });
        throw err;
      }
    } else if (mode === 'replay') {
      const recorded = replayQueues.get(key)?.shift();
      if (recorded === undefined) {
        throw new Error(
          `replay: no recorded response for this ${kind} request (key ${key.slice(0, 12)}). ` +
            'The request differs from the recording — a prompt, brief, model or scenario changed.',
        );
      }
      status = recorded.status;
      responseText = recorded.responseText;
    } else {
      responseText = apiEnvelope(kind === 'synthesis' ? STUB_SYNTHESIS : STUB_DISCUSSION);
    }

    exchanges.push({
      seq: exchanges.length,
      ...stamp,
      status,
      responseText,
      ms: Date.now() - started,
      error: null,
    });
    return new Response(responseText, { status, headers: { 'content-type': 'application/json' } });
  };

  globalThis.fetch = wrapped;
  return {
    mode,
    exchanges,
    restore() {
      globalThis.fetch = realFetch;
    },
  };
}

/** The model's answer text from a recorded response — extracted exactly as production does — or null. */
export function modelTextOf(ex: Exchange): string | null {
  try {
    const result = extractResponseText(JSON.parse(ex.responseText));
    return result.ok ? result.text : null;
  } catch {
    return null;
  }
}
