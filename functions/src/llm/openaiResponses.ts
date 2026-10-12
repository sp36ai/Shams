/**
 * openaiResponses.ts — the one place this backend talks to a language model.
 * --------------------------------------------------------------------------
 * A small typed adapter over the OpenAI Responses API (POST /v1/responses),
 * used by every model call site: narration (responseComposer.ts), follow-up
 * discussion (discussionComposer.ts), the question gate
 * (classifyQuestion.ts) and onboarding profile inference (inferProfile.ts).
 *
 * The model is a language layer only. Nothing here — and nothing a caller
 * builds on top of this — decides a verdict, a timing or a remedy; those are
 * settled by the RKP engine before any call is made, and every caller still
 * runs its own deterministic validation on what comes back.
 *
 * Contract: `createResponse()` NEVER throws. Every transport, HTTP, parsing,
 * refusal, truncation and empty-output case comes back as a classified
 * failure, so each caller keeps its existing fallback path (deterministic
 * fallback narration, "no reply" for a discussion turn, VALID_HORARY,
 * 'clarity') exactly as before. There is no transport retry here: no call
 * site retried transport failures under the previous provider either, and
 * the discussion composer's one validation-driven rewrite stays where it is.
 *
 * Request shape and output extraction follow OpenAI's Responses API
 * documentation (structured-outputs guide, checked 2026-10-12):
 *   - `instructions` carries the system-level prompt; `input` carries the
 *     conversation. Seeker text only ever travels in `input`.
 *   - `text.format = { type: 'json_schema', name, schema, strict: true }`.
 *   - A truncated answer is `status: 'incomplete'` with
 *     `incomplete_details.reason` (e.g. 'max_output_tokens').
 *   - `output` is an array of items; text lives in `message` items as
 *     `output_text` parts, a safety refusal as a `refusal` part. Reasoning
 *     items carry no answer text. Every `output_text` part of every message
 *     item is joined — no fixed `output[0]` assumption.
 *   - `store: false`, so seeker questions and readings are not retained as
 *     stored responses on the provider side.
 */

export const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export interface ResponsesMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface ResponsesRequest {
  readonly model: string;
  /** System-level instructions. Never contains seeker text the caller has not already sanitised into a brief. */
  readonly instructions: string;
  /** The conversation (or a single user turn). Seeker text belongs here. */
  readonly input: string | readonly ResponsesMessage[];
  /** Upper bound on output tokens, reasoning tokens included. */
  readonly maxOutputTokens: number;
  readonly reasoningEffort: ReasoningEffort;
  /** When set, the reply must be JSON matching this schema (strict structured output). */
  readonly jsonSchema?: {
    readonly name: string;
    readonly schema: Readonly<Record<string, unknown>>;
  };
  readonly timeoutMs: number;
}

export type ResponsesFailureKind =
  | 'http' // non-2xx status
  | 'timeout' // our own deadline fired
  | 'network' // fetch itself failed
  | 'malformed' // 2xx but not a parseable Responses object
  | 'failed' // the provider reported status 'failed' or an error object
  | 'incomplete' // truncated — status 'incomplete'
  | 'refusal' // the model refused instead of answering
  | 'empty'; // no output_text at all

export interface ResponsesUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly reasoningTokens: number | null;
}

export type ResponsesResult =
  | { readonly ok: true; readonly text: string; readonly usage: ResponsesUsage | null }
  | {
      readonly ok: false;
      readonly kind: ResponsesFailureKind;
      /** HTTP status when there was one. */
      readonly status: number | null;
      /** Safe for logs: secrets redacted, length-capped. Never seeker-facing. */
      readonly detail: string;
    };

const DETAIL_MAX = 300;

/**
 * Remove anything key-shaped before a provider message reaches a log line.
 * A 401 body can echo a (partially masked) key; an Authorization header
 * value should never appear at all, but is masked too if it ever does.
 */
export function redactSecrets(text: string): string {
  return text
    .replace(/\bsk-[A-Za-z0-9_*-]{6,}/g, 'sk-[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/*-]+/gi, 'Bearer [redacted]')
    .slice(0, DETAIL_MAX);
}

export function buildRequestBody(req: ResponsesRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model,
    instructions: req.instructions,
    input: typeof req.input === 'string' ? req.input : req.input.map(m => ({ ...m })),
    max_output_tokens: req.maxOutputTokens,
    reasoning: { effort: req.reasoningEffort },
    store: false,
  };
  if (req.jsonSchema) {
    body.text = {
      format: {
        type: 'json_schema',
        name: req.jsonSchema.name,
        schema: req.jsonSchema.schema,
        strict: true,
      },
    };
  }
  return body;
}

interface RawContentPart {
  type?: unknown;
  text?: unknown;
  refusal?: unknown;
}
interface RawOutputItem {
  type?: unknown;
  content?: unknown;
}
interface RawResponse {
  status?: unknown;
  error?: unknown;
  incomplete_details?: { reason?: unknown } | null;
  output?: unknown;
  usage?: {
    input_tokens?: unknown;
    output_tokens?: unknown;
    output_tokens_details?: { reasoning_tokens?: unknown } | null;
  } | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function usageOf(json: RawResponse): ResponsesUsage | null {
  if (!json.usage || typeof json.usage !== 'object') {
    return null;
  }
  return {
    inputTokens: num(json.usage.input_tokens),
    outputTokens: num(json.usage.output_tokens),
    reasoningTokens: num(json.usage.output_tokens_details?.reasoning_tokens),
  };
}

/**
 * Pull the answer text out of a parsed Responses object. Exported so the
 * transcript harness and tests extract text exactly the way production does.
 */
export function extractResponseText(json: unknown): ResponsesResult {
  if (json === null || typeof json !== 'object') {
    return { ok: false, kind: 'malformed', status: null, detail: 'response is not an object' };
  }
  const r = json as RawResponse;

  if (r.status === 'failed' || (r.error !== null && r.error !== undefined)) {
    const message =
      typeof r.error === 'object' && r.error !== null && 'message' in r.error
        ? String((r.error as { message: unknown }).message)
        : 'provider reported failure';
    return { ok: false, kind: 'failed', status: null, detail: redactSecrets(message) };
  }
  if (r.status === 'incomplete') {
    const reason =
      typeof r.incomplete_details?.reason === 'string' ? r.incomplete_details.reason : 'unknown';
    return { ok: false, kind: 'incomplete', status: null, detail: `incomplete: ${reason}` };
  }
  if (!Array.isArray(r.output)) {
    return { ok: false, kind: 'malformed', status: null, detail: 'missing output array' };
  }

  const texts: string[] = [];
  const refusals: string[] = [];
  for (const item of r.output as RawOutputItem[]) {
    if (
      item === null ||
      typeof item !== 'object' ||
      item.type !== 'message' ||
      !Array.isArray(item.content)
    ) {
      continue;
    }
    for (const part of item.content as RawContentPart[]) {
      if (part === null || typeof part !== 'object') {
        continue;
      }
      if (part.type === 'output_text' && typeof part.text === 'string') {
        texts.push(part.text);
      } else if (part.type === 'refusal') {
        refusals.push(typeof part.refusal === 'string' ? part.refusal : '');
      }
    }
  }

  // A refusal anywhere means the model did not answer the task. Partial
  // text alongside a refusal is not trusted. The refusal's own wording is
  // never carried into `detail`: it is model-written and can restate the
  // seeker's question, and `detail` goes to operational logs.
  if (refusals.length > 0) {
    return {
      ok: false,
      kind: 'refusal',
      status: null,
      detail: `model refused (${refusals.length} refusal part${refusals.length === 1 ? '' : 's'})`,
    };
  }
  const text = texts.join('').trim();
  if (text.length === 0) {
    return { ok: false, kind: 'empty', status: null, detail: 'no output_text' };
  }
  return { ok: true, text, usage: usageOf(r) };
}

/** One call. Never throws — see the file header. */
export async function createResponse(
  apiKey: string,
  req: ResponsesRequest,
): Promise<ResponsesResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, req.timeoutMs);

  try {
    let res: Response;
    try {
      res = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(buildRequestBody(req)),
        signal: controller.signal,
      });
    } catch (err) {
      return timedOut
        ? {
            ok: false,
            kind: 'timeout',
            status: null,
            detail: `no response within ${req.timeoutMs}ms`,
          }
        : { ok: false, kind: 'network', status: null, detail: redactSecrets(String(err)) };
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, kind: 'http', status: res.status, detail: redactSecrets(body) };
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return timedOut
        ? {
            ok: false,
            kind: 'timeout',
            status: res.status,
            detail: `body not received within ${req.timeoutMs}ms`,
          }
        : { ok: false, kind: 'malformed', status: res.status, detail: 'body is not JSON' };
    }
    return extractResponseText(json);
  } finally {
    clearTimeout(timer);
  }
}
