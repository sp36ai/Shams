/**
 * LIVE check — real Anthropic API, real key. Skipped unless LIVE_ANTHROPIC=1.
 *
 * The mocked tests only prove what the composers SEND. This proves the API
 * ACCEPTS it: one real narration request and one real discussion request,
 * each must come back HTTP 200 with stop_reason "end_turn" and a text block
 * that parses as JSON carrying every required key.
 *
 *   cd functions
 *   LIVE_ANTHROPIC=1 ANTHROPIC_API_KEY=<key> npx vitest run liveStructuredOutputs
 *
 * Costs two model calls. Never runs in CI (the env var is not set there).
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

import { buildWatchChart } from '../../engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';
import { diagnose } from '../../engine/rkp/diagnosis';
import { classifyQuestion } from '../../engine/kp/rules/questionKeywords';
import { selectRemedyProtocol } from '../remedySelection';
import { toBoundaryPlanetName } from '../../utils/planetBoundaryName';
import { buildReadingContract, type ReadingContract } from '../readingContract';
import { composeWatchOracleResponse } from '../responseComposer';
import { composeDiscussionReply } from '../discussionComposer';

vi.mock('../../config', () => ({
  ANTHROPIC_API_KEY: { value: () => process.env.ANTHROPIC_API_KEY ?? '' },
  FUNCTION_OPTS: {},
  ORACLE_FUNCTION_OPTS: {},
}));

// Surface the composers' own warnings (missing fields, HTTP error, parse failure).
vi.mock('firebase-functions/v2', () => ({
  logger: {
    warn: (...args: unknown[]) => console.warn('[logger.warn]', ...args),
    error: (...args: unknown[]) => console.error('[logger.error]', ...args),
    info: () => undefined,
    debug: () => undefined,
  },
}));

const LIVE = process.env.LIVE_ANTHROPIC === '1';

function contractFor(moment: string, question: string, readingId: string): ReadingContract {
  const chart = buildWatchChart(moment);
  const rawVerdict = judgeWatchChart(chart, classifyQuestion(question));
  const verdict: DisplayWatchVerdict = {
    ...rawVerdict,
    obstruction: toBoundaryPlanetName(rawVerdict.obstruction),
    targetRuler: toBoundaryPlanetName(rawVerdict.targetRuler),
    lagnaRuler: toBoundaryPlanetName(rawVerdict.lagnaRuler),
  };
  const diagnosis = diagnose(verdict);
  return buildReadingContract({
    readingId,
    computedAt: new Date('2026-08-15T00:00:00.000Z'),
    question,
    verdict,
    diagnosis,
    protocol: selectRemedyProtocol(diagnosis),
  });
}

interface Observed {
  status: number;
  stopReason: string | undefined;
  text: string;
  error: string | undefined;
}

/** Wraps the real fetch so the raw API response can be inspected. */
const realFetch = globalThis.fetch;
let observed: Observed[] = [];

beforeAll(() => {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const res = await realFetch(input, init);
    const body = (await res
      .clone()
      .json()
      .catch(() => ({}))) as {
      stop_reason?: string;
      content?: Array<{ type: string; text?: string }>;
      error?: { message?: string };
    };
    observed.push({
      status: res.status,
      stopReason: body.stop_reason,
      text: body.content?.find(b => b.type === 'text')?.text ?? '',
      error: body.error?.message,
    });
    return res;
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

function expectAccepted(call: Observed | undefined, keys: string[]): void {
  console.warn('[live]', JSON.stringify(call, null, 2));
  expect(call?.error).toBeUndefined();
  expect(call?.status).toBe(200);
  expect(call?.stopReason).toBe('end_turn');
  const parsed = JSON.parse(call?.text ?? '') as Record<string, unknown>;
  expect(Object.keys(parsed).sort()).toEqual([...keys].sort());
}

describe.skipIf(!LIVE)('LIVE — Anthropic API accepts the structured-output requests', () => {
  const contract = contractFor(
    '2026-08-15T11:00:00+04:00',
    'Will I get the job I interviewed for?',
    'r-live-structured-outputs',
  );

  it('narration: HTTP 200, end_turn, all five keys', async () => {
    observed = [];
    await composeWatchOracleResponse({
      verdict: contract.judgment,
      question: 'Will I get the job I interviewed for?',
      readingId: contract.provenance.readingId,
      computedAt: new Date('2026-08-15T00:00:00.000Z'),
    });
    expectAccepted(observed[0], [
      'rkp_finding',
      'interpretation',
      'recommended_approach',
      'why_this_remedy',
      'signature',
    ]);
  }, 120_000);

  it('discussion: HTTP 200, end_turn, all three keys', async () => {
    observed = [];
    await composeDiscussionReply({
      groundings: [
        {
          label: 'the career reading',
          question: 'Will I get the job I interviewed for?',
          verdict: 'DELAYED',
          confidence: 0.6,
          computedAt: '2026-08-15T00:00:00.000Z',
          oracle: null,
          narration: null,
          contract,
        },
      ],
      turns: [],
      message: 'What should I do while I wait?',
      replyLang: 'en',
    });
    expectAccepted(observed[0], ['answer', 'is_new_question', 'conversation_complete']);
  }, 120_000);
});
