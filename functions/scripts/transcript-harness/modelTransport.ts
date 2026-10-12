/**
 * modelTransport.ts — the only seam the harness opens in the pipeline.
 * --------------------------------------------------------------------------
 * responseComposer.ts and discussionComposer.ts each call the Anthropic
 * Messages API with the global `fetch`. The harness wraps that one function
 * and nothing else: prompts, briefs, validation, fallback and the rewrite
 * retry all run as production code, unmodified.
 *
 * Modes
 *   live    — passes each call through to the real API (needs
 *             ANTHROPIC_API_KEY in the environment, exactly the secret the
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
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export type TransportMode = 'live' | 'replay' | 'stub';
export type CallKind = 'synthesis' | 'discussion';

const API_URL = 'https://api.anthropic.com/v1/messages';

export interface Exchange {
  readonly seq: number;
  readonly key: string;
  readonly kind: CallKind;
  /** The JSON body as sent — model, system prompt, brief and messages. Never headers. */
  readonly requestBody: unknown;
  readonly status: number;
  /** Raw response body text, exactly as the composer received it. */
  readonly responseText: string;
  readonly ms: number;
  readonly error: string | null;
}

export interface Cassette {
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

function kindOf(parsed: { system?: unknown }): CallKind {
  // Synthesis sends `system` as one string; discussion sends text blocks.
  return Array.isArray(parsed.system) ? 'discussion' : 'synthesis';
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

function apiEnvelope(text: string): string {
  return JSON.stringify({ content: [{ type: 'text', text }] });
}

export function installTransport(mode: TransportMode, cassettePath?: string): Transport {
  const realFetch = globalThis.fetch;
  const exchanges: Exchange[] = [];

  const replayQueues = new Map<string, Exchange[]>();
  if (mode === 'replay') {
    if (cassettePath === undefined) {
      throw new Error('replay mode needs --cassette=<path>');
    }
    const cassette = JSON.parse(readFileSync(cassettePath, 'utf8')) as Cassette;
    for (const ex of cassette.exchanges) {
      const q = replayQueues.get(ex.key) ?? [];
      q.push(ex);
      replayQueues.set(ex.key, q);
    }
  }
  if (mode === 'live' && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('live mode needs ANTHROPIC_API_KEY in the environment');
  }
  if (mode !== 'live' && !process.env.ANTHROPIC_API_KEY) {
    // The composers skip the call entirely without a key. Offline modes
    // answer every call from here, so a placeholder lets the call happen;
    // it never leaves the process.
    process.env.ANTHROPIC_API_KEY = 'harness-offline-placeholder';
  }

  const wrapped: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url !== API_URL) {
      return realFetch(input, init);
    }
    const bodyText = typeof init?.body === 'string' ? init.body : '';
    const parsed = JSON.parse(bodyText) as { system?: unknown };
    const key = requestKey(bodyText);
    const kind = kindOf(parsed);
    const started = Date.now();

    let status = 200;
    let responseText = '';
    let error: string | null = null;

    if (mode === 'live') {
      try {
        const res = await realFetch(input, init);
        status = res.status;
        responseText = await res.text();
      } catch (err) {
        // Recorded, then rethrown so the composer sees the same failure it
        // would in production (its own catch turns it into a null draft).
        error = String(err);
        exchanges.push({
          seq: exchanges.length,
          key,
          kind,
          requestBody: parsed,
          status: 0,
          responseText: '',
          ms: Date.now() - started,
          error,
        });
        throw err;
      }
    } else if (mode === 'replay') {
      const recorded = replayQueues.get(key)?.shift();
      if (recorded === undefined) {
        throw new Error(
          `replay: no recorded response for this ${kind} request (key ${key.slice(0, 12)}). ` +
            'The request differs from the recording — a prompt, brief or scenario changed.',
        );
      }
      status = recorded.status;
      responseText = recorded.responseText;
    } else {
      responseText = apiEnvelope(kind === 'synthesis' ? STUB_SYNTHESIS : STUB_DISCUSSION);
    }

    exchanges.push({
      seq: exchanges.length,
      key,
      kind,
      requestBody: parsed,
      status,
      responseText,
      ms: Date.now() - started,
      error,
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

/** The model's text block from a recorded response, or null. */
export function modelTextOf(ex: Exchange): string | null {
  try {
    const json = JSON.parse(ex.responseText) as {
      content?: Array<{ type: string; text?: string }>;
    };
    return json.content?.find(b => b.type === 'text')?.text ?? null;
  } catch {
    return null;
  }
}
