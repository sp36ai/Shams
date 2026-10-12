/**
 * Narration over the OpenAI Responses API: what is sent, and what happens
 * when the provider does not return a usable answer. The verdict, diagnosis
 * and remedy protocol are computed before the call and must survive every
 * provider failure untouched; only the prose may be lost.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config', async () => ({
  ...(await vi.importActual<typeof import('../../config')>('../../config')),
  OPENAI_API_KEY: { value: () => 'test-key' },
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { OPENAI_MODELS } from '../../config';
import { composeWatchOracleResponse } from '../responseComposer';
import { WATCH_ORACLE_SYNTHESIS_PROMPT } from '../../prompts/watchOracleSynthesisPrompt';
import type { DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';
import { okJson, requestBodyOf, responsesBody } from '../../llm/__tests__/responsesFixtures';
import { logger } from '../../utils/logger';

const VERDICT = {
  qType: 'career',
  targetHouse: 10,
  targetSignName: 'Burj Jauza',
  targetRuler: 'Mercury',
  targetRulerName: 'Utarid',
  fulfilmentHouse: 11,
  lagnaRuler: 'Venus',
  rulerRelation: 'Friend',
  state: 'DELAYED',
  confidence: 'HIGH',
  score: 2,
  obstruction: 'Saturn',
  reversal: 'NONE',
  timing: { minDays: 30, maxDays: 60 },
  direction: 'North',
  afflictedDirection: 'West',
  controllerProfile: 'Assertive',
  factors: ['Utarid rules the 10th Ghar.'],
} as unknown as DisplayWatchVerdict;

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function respond(body: unknown) {
  const fn = vi.fn(() => Promise.resolve(okJson(body)));
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

const GOOD = {
  rkp_finding: 'Something slow sits across this matter.',
  interpretation: 'Not yet — this is delay, not denial.',
  recommended_approach: 'Let the window arrive rather than forcing it.',
  why_this_remedy: 'Delay is met with patience.',
  signature: 'The door is heavy, not locked.',
};

describe('narration request', () => {
  it('sends the unchanged synthesis prompt as instructions, with the configured model and the five-field schema', async () => {
    const fetchMock = respond(responsesBody(JSON.stringify(GOOD)));
    await composeWatchOracleResponse({ verdict: VERDICT, question: 'Will I get the job?' });
    const body = requestBodyOf(fetchMock.mock.calls[0] as unknown[]);
    expect(body.model).toBe(OPENAI_MODELS.narration);
    expect(body.instructions).toBe(WATCH_ORACLE_SYNTHESIS_PROMPT);
    expect(body.store).toBe(false);
    const format = (
      body.text as { format: { name: string; strict: boolean; schema: { required: string[] } } }
    ).format;
    expect(format.strict).toBe(true);
    expect(format.schema.required.sort()).toEqual(
      [
        'interpretation',
        'recommended_approach',
        'rkp_finding',
        'signature',
        'why_this_remedy',
      ].sort(),
    );
  });
});

describe('provider failures leave the judgment intact and drop only the prose', () => {
  async function composeWith(body: unknown) {
    respond(body);
    return composeWatchOracleResponse({ verdict: VERDICT, question: 'Will I get the job?' });
  }

  it.each([
    [
      'a refusal',
      {
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }],
      },
    ],
    [
      'a truncated answer',
      {
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
        output: [
          { type: 'message', content: [{ type: 'output_text', text: '{"rkp_finding":"half' }] },
        ],
      },
    ],
    ['an empty output', { status: 'completed', output: [] }],
    ['output that is not the JSON shape', responsesBody('The oracle says yes.')],
    ['JSON missing a field', responsesBody(JSON.stringify({ ...GOOD, signature: '' }))],
  ])('%s → no narration, same diagnosis and protocol', async (_label, body) => {
    const baseline = await composeWith(responsesBody(JSON.stringify(GOOD)));
    const { composition } = await composeWith(body);
    expect(composition.narration).toBeNull();
    expect(composition.speakableText).toBeNull();
    expect(composition.diagnosis).toEqual(baseline.composition.diagnosis);
    expect(composition.protocol).toEqual(baseline.composition.protocol);
  });

  it('an HTTP error → no narration, same diagnosis', async () => {
    const baseline = await composeWith(responsesBody(JSON.stringify(GOOD)));
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 429, text: () => Promise.resolve('rate limited') }),
    ) as unknown as typeof fetch;
    const { composition } = await composeWatchOracleResponse({
      verdict: VERDICT,
      question: 'Will I get the job?',
    });
    expect(composition.narration).toBeNull();
    expect(composition.diagnosis).toEqual(baseline.composition.diagnosis);
  });
});

describe('model-written text never reaches operational logs', () => {
  // Node's JSON.parse error quotes the first 10 characters of the bad text,
  // so the marker is exactly that long and leads every malformed output.
  const PLANTED = 'Lahore7f3a my brother';

  function captureLogs(): () => string {
    const calls: unknown[][] = [];
    for (const level of ['info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(logger, level).mockImplementation((...args: unknown[]) => {
        calls.push(args);
      });
    }
    for (const level of ['log', 'info', 'warn', 'error'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        calls.push(args);
      });
    }
    return () => JSON.stringify(calls);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [
      'a refusal quoting the seeker',
      {
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'refusal', refusal: `No: ${PLANTED}` }] }],
      },
    ],
    ['malformed output quoting the seeker', responsesBody(`${PLANTED} — not JSON at all`)],
    ['truncated JSON quoting the seeker', responsesBody(`{"rkp_finding":"${PLANTED}`)],
  ])('%s → logged by category only', async (_label, body) => {
    const logs = captureLogs();
    respond(body);
    const { composition } = await composeWatchOracleResponse({
      verdict: VERDICT,
      question: 'Will I get the job?',
    });
    expect(composition.narration).toBeNull();
    expect(logs()).toContain('watch oracle narration');
    expect(logs()).not.toContain('Lahore7f3a');
  });
});
