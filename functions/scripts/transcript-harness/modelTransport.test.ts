import { afterEach, describe, expect, it } from 'vitest';

import { OPENAI_RESPONSES_URL } from '../../src/llm/openaiResponses';
import {
  CASSETTE_FORMAT_VERSION,
  installTransport,
  loadCassette,
  modelTextOf,
  type Transport,
} from './modelTransport';

let transport: Transport | null = null;
afterEach(() => {
  transport?.restore();
  transport = null;
});

const discussionBody = JSON.stringify({
  model: 'gpt-5.4-mini',
  instructions: 'x',
  input: [{ role: 'user', content: 'hi' }],
  text: {
    format: { type: 'json_schema', name: 'oracle_discussion_reply', schema: {}, strict: true },
  },
});
const synthesisBody = JSON.stringify({
  model: 'gpt-5.4-mini',
  instructions: 'y',
  input: [{ role: 'user', content: 'brief' }],
  text: { format: { type: 'json_schema', name: 'oracle_narration', schema: {}, strict: true } },
});

async function post(body: string): Promise<string> {
  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    body,
    headers: { authorization: 'Bearer secret-value' },
  });
  return res.text();
}

describe('stub transport', () => {
  it('answers each composer with Responses-shaped placeholders, stamped provider and model, never recording headers', async () => {
    transport = installTransport('stub');
    await post(synthesisBody);
    await post(discussionBody);
    const [a, b] = transport.exchanges;
    expect(a).toMatchObject({ kind: 'synthesis', provider: 'openai', model: 'gpt-5.4-mini' });
    expect(b).toMatchObject({ kind: 'discussion', provider: 'openai' });
    expect(modelTextOf(a!)).toContain('[stub]');
    expect(JSON.parse(modelTextOf(b!)!)).toMatchObject({ is_new_question: false });
    expect(JSON.stringify(transport.exchanges)).not.toContain('secret-value');
  });
});

describe('cassettes', () => {
  it('refuses a legacy (Anthropic, v1) cassette instead of reinterpreting it', () => {
    const legacy = JSON.stringify({ recordedAt: 'x', mode: 'live', exchanges: [] });
    expect(() => loadCassette(legacy)).toThrow(/legacy \(v1\).*Anthropic/);
  });

  it('refuses another provider or format version, and a mis-stamped exchange', () => {
    expect(() =>
      loadCassette(JSON.stringify({ formatVersion: 2, provider: 'other', exchanges: [] })),
    ).toThrow(/unsupported/);
    expect(() =>
      loadCassette(JSON.stringify({ formatVersion: 3, provider: 'openai', exchanges: [] })),
    ).toThrow(/unsupported/);
    expect(() =>
      loadCassette(
        JSON.stringify({
          formatVersion: 2,
          provider: 'openai',
          exchanges: [{ seq: 0, provider: 'anthropic' }],
        }),
      ),
    ).toThrow(/stamped provider anthropic/);
  });

  it('replays a v2 recording exactly, and errors on a request it does not hold', async () => {
    transport = installTransport('stub');
    const recorded = await post(synthesisBody);
    const cassette = {
      formatVersion: CASSETTE_FORMAT_VERSION,
      provider: 'openai',
      recordedAt: 'now',
      mode: 'stub',
      exchanges: transport.exchanges,
    };
    transport.restore();

    const { writeFileSync, mkdtempSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const path = join(mkdtempSync(join(tmpdir(), 'cassette-')), 'c.json');
    writeFileSync(path, JSON.stringify(cassette));

    transport = installTransport('replay', path);
    expect(await post(synthesisBody)).toBe(recorded);
    await expect(post(discussionBody)).rejects.toThrow(/no recorded response/);
  });
});
