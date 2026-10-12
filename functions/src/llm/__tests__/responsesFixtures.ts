/**
 * Test fixtures shaped like OpenAI Responses API bodies — the one shape
 * every model call site now receives. Not a test file itself.
 */

/** A completed response whose single message carries `text` as output_text. */
export function responsesBody(text: string): Record<string, unknown> {
  return {
    id: 'resp_test',
    object: 'response',
    status: 'completed',
    output: [
      { type: 'reasoning', id: 'rs_test', summary: [] },
      {
        type: 'message',
        id: 'msg_test',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text, annotations: [] }],
      },
    ],
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      output_tokens_details: { reasoning_tokens: 10 },
    },
  };
}

/** A minimal `fetch` Response stand-in for a 200 with `body` as JSON. */
export function okJson(body: unknown): {
  ok: true;
  status: 200;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
} {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

/** The parsed JSON body of a mocked fetch call. */
export function requestBodyOf(call: unknown[]): {
  model: string;
  instructions: string;
  input: Array<{ role: string; content: string }>;
  [k: string]: unknown;
} {
  const init = call[1] as { body: string };
  return JSON.parse(init.body) as ReturnType<typeof requestBodyOf>;
}
