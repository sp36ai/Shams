import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  OPENAI_RESPONSES_URL,
  buildRequestBody,
  createResponse,
  extractResponseText,
  redactSecrets,
  type ResponsesRequest,
} from '../openaiResponses';
import { okJson, requestBodyOf, responsesBody } from './responsesFixtures';

// Built at runtime so no key-shaped literal sits in the repository.
const KEY = ['sk', 'proj', 'T'.repeat(30)].join('-');

const REQ: ResponsesRequest = {
  model: 'gpt-5.4-mini',
  instructions: 'SYSTEM',
  input: [{ role: 'user', content: 'seeker text' }],
  maxOutputTokens: 100,
  reasoningEffort: 'low',
  jsonSchema: { name: 'thing', schema: { type: 'object' } },
  timeoutMs: 1000,
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.useRealTimers();
});

function mockFetch(impl: (...args: unknown[]) => unknown) {
  const fn = vi.fn(impl);
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('extractResponseText', () => {
  it('returns the output_text of a completed response, with usage', () => {
    const r = extractResponseText(responsesBody('hello'));
    expect(r).toEqual({
      ok: true,
      text: 'hello',
      usage: { inputTokens: 100, outputTokens: 50, reasoningTokens: 10 },
    });
  });

  it('joins every output_text part of every message item, skipping reasoning items', () => {
    const r = extractResponseText({
      status: 'completed',
      output: [
        { type: 'reasoning', summary: [] },
        { type: 'message', content: [{ type: 'output_text', text: '{"a":' }] },
        { type: 'message', content: [{ type: 'output_text', text: '1}' }, { type: 'other' }] },
      ],
    });
    expect(r).toMatchObject({ ok: true, text: '{"a":1}' });
  });

  it('treats reasoning-only or text-less output as empty', () => {
    expect(
      extractResponseText({ status: 'completed', output: [{ type: 'reasoning' }] }),
    ).toMatchObject({
      ok: false,
      kind: 'empty',
    });
    expect(
      extractResponseText({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: '  ' }] }],
      }),
    ).toMatchObject({ ok: false, kind: 'empty' });
  });

  it('reports a refusal and does not trust partial text beside it', () => {
    const r = extractResponseText({
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [
            { type: 'output_text', text: 'partial' },
            { type: 'refusal', refusal: 'no' },
          ],
        },
      ],
    });
    expect(r).toMatchObject({ ok: false, kind: 'refusal' });
  });

  it('reports truncation with its reason', () => {
    const r = extractResponseText({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{"half' }] }],
    });
    expect(r).toEqual({
      ok: false,
      kind: 'incomplete',
      status: null,
      detail: 'incomplete: max_output_tokens',
    });
  });

  it('reports provider failure and malformed bodies', () => {
    expect(extractResponseText({ status: 'failed', error: { message: 'boom' } })).toMatchObject({
      ok: false,
      kind: 'failed',
    });
    expect(extractResponseText({ status: 'completed' })).toMatchObject({
      ok: false,
      kind: 'malformed',
    });
    expect(extractResponseText('nope')).toMatchObject({ ok: false, kind: 'malformed' });
    expect(extractResponseText(null)).toMatchObject({ ok: false, kind: 'malformed' });
  });
});

describe('buildRequestBody', () => {
  it('puts the prompt in instructions, the seeker turn in input, and asks for strict JSON without storage', () => {
    const body = buildRequestBody(REQ);
    expect(body).toEqual({
      model: 'gpt-5.4-mini',
      instructions: 'SYSTEM',
      input: [{ role: 'user', content: 'seeker text' }],
      max_output_tokens: 100,
      reasoning: { effort: 'low' },
      store: false,
      text: {
        format: { type: 'json_schema', name: 'thing', schema: { type: 'object' }, strict: true },
      },
    });
  });

  it('omits text.format when no schema is requested', () => {
    expect(buildRequestBody({ ...REQ, jsonSchema: undefined })).not.toHaveProperty('text');
  });
});

describe('createResponse', () => {
  it('posts to the Responses endpoint with a bearer key that never enters the body', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(okJson(responsesBody('{"ok":true}'))));
    const r = await createResponse(KEY, REQ);
    expect(r).toMatchObject({ ok: true, text: '{"ok":true}' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe(OPENAI_RESPONSES_URL);
    expect(init.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(init.body).not.toContain(KEY);
    expect(requestBodyOf(fetchMock.mock.calls[0] as unknown[]).model).toBe('gpt-5.4-mini');
  });

  it.each([400, 401, 403, 429, 500, 503])(
    'classifies HTTP %i, once, without retrying',
    async status => {
      const fetchMock = mockFetch(() =>
        Promise.resolve({
          ok: false,
          status,
          text: () => Promise.resolve('{"error":{"message":"x"}}'),
        }),
      );
      const r = await createResponse(KEY, REQ);
      expect(r).toMatchObject({ ok: false, kind: 'http', status });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('redacts a key echoed in an error body', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(`Incorrect API key provided: ${KEY}. Authorization: Bearer ${KEY}`),
      }),
    );
    const r = await createResponse(KEY, REQ);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain(KEY);
    expect(JSON.stringify(r)).not.toContain('TTTTTT');
  });

  it('classifies a network failure', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')));
    expect(await createResponse(KEY, REQ)).toMatchObject({ ok: false, kind: 'network' });
  });

  it('times out by aborting the request', async () => {
    let signal: AbortSignal | undefined;
    mockFetch((...args: unknown[]) => {
      signal = (args[1] as { signal: AbortSignal }).signal;
      return new Promise((_resolve, reject) => {
        signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    });
    const r = await createResponse(KEY, { ...REQ, timeoutMs: 20 });
    expect(r).toMatchObject({ ok: false, kind: 'timeout' });
    expect(signal?.aborted).toBe(true);
  });

  it('classifies a 2xx body that is not JSON as malformed', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('bad')),
      }),
    );
    expect(await createResponse(KEY, REQ)).toMatchObject({ ok: false, kind: 'malformed' });
  });

  it('never throws, whatever fetch does', async () => {
    mockFetch(() => {
      throw new Error('sync throw');
    });
    await expect(createResponse(KEY, REQ)).resolves.toMatchObject({ ok: false });
  });
});

describe('redactSecrets', () => {
  it('masks key-shaped text and bearer values, and caps length', () => {
    const out = redactSecrets(`a ${KEY} b Bearer abc.def-ghi ${'x'.repeat(500)}`);
    expect(out).not.toContain(KEY);
    expect(out).toContain('sk-[redacted]');
    expect(out).toContain('Bearer [redacted]');
    expect(out.length).toBeLessThanOrEqual(300);
  });
});
