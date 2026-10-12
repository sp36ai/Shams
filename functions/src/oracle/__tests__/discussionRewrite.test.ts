/**
 * A follow-up reply rejected by validation is rewritten once, with the
 * refused wording named in a system block, before the seeker is told the
 * oracle did not answer. Built on a production Reading (10 Oct 2026, 16:28
 * IST, "When will this app will be launched successfully"): DELAYED, so
 * phrases from both polarity lists are refused.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

import { buildWatchChart } from '../../engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';
import { diagnose } from '../../engine/rkp/diagnosis';
import { selectRemedyProtocol } from '../remedySelection';
import { toBoundaryPlanetName } from '../../utils/planetBoundaryName';
import { buildReadingContract, type ReadingContract } from '../readingContract';
import {
  composeDiscussionReply,
  rejectedPhrases,
  rewriteNote,
  type ReadingGrounding,
} from '../discussionComposer';
import { logger } from '../../utils/logger';
import { responsesBody } from '../../llm/__tests__/responsesFixtures';

vi.mock('../../config', async () => ({
  ...(await vi.importActual<typeof import('../../config')>('../../config')),
  OPENAI_API_KEY: { value: () => 'test-key' },
  FUNCTION_OPTS: {},
  ORACLE_FUNCTION_OPTS: {},
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const QUESTION = 'When will this app will be launched successfully';

function launchContract(): ReadingContract {
  // Replayed as cast: "general". The question would classify as business
  // since "app" became a business keyword (owner decision 2026-10-10).
  const raw = judgeWatchChart(buildWatchChart('2026-10-10T16:28:00+05:30'), 'general');
  const verdict: DisplayWatchVerdict = {
    ...raw,
    obstruction: toBoundaryPlanetName(raw.obstruction),
    targetRuler: toBoundaryPlanetName(raw.targetRuler),
    lagnaRuler: toBoundaryPlanetName(raw.lagnaRuler),
  };
  const diagnosis = diagnose(verdict);
  return buildReadingContract({
    readingId: 'r-launch',
    computedAt: new Date('2026-10-10T10:58:00.000Z'),
    question: QUESTION,
    verdict,
    diagnosis,
    protocol: selectRemedyProtocol(diagnosis),
  });
}

function groundings(): [ReadingGrounding, ...ReadingGrounding[]] {
  return [
    {
      label: 'the launch reading',
      question: QUESTION,
      verdict: 'DELAYED',
      confidence: 0.6,
      computedAt: '2026-10-10T10:58:00.000Z',
      oracle: null,
      narration: null,
      contract: launchContract(),
    },
  ];
}

const REFUSED = 'Watch the unfinished work Zuhal is holding. For now, the answer is no.';
const ACCEPTED = 'Watch the unfinished work Zuhal is holding; it is held for now, not closed.';

function answerResponse(answer: string): Response {
  return {
    ok: true,
    json: () => Promise.resolve(responsesBody(JSON.stringify({ answer, is_new_question: false }))),
  } as unknown as Response;
}

function mockAnswers(...answers: string[]) {
  const fetchMock = vi.fn();
  for (const answer of answers) {
    fetchMock.mockResolvedValueOnce(answerResponse(answer));
  }
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

/** The system-level text of a request — the Responses API `instructions`. */
function systemOf(call: unknown): string {
  const body = JSON.parse(((call as unknown[])[1] as { body: string }).body) as {
    instructions: string;
  };
  return body.instructions;
}

const ask = () =>
  composeDiscussionReply({
    groundings: groundings(),
    turns: [],
    message: 'What should I watch for next?',
    replyLang: 'en',
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('composeDiscussionReply — one rewrite after a rejected draft', () => {
  it('returns the rewrite when the first draft is refused and the second passes', async () => {
    const fetchMock = mockAnswers(REFUSED, ACCEPTED);
    const reply = await ask();
    expect(reply?.answer).toBe(ACCEPTED);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The refused wording reaches the model through the system prompt.
    expect(systemOf(fetchMock.mock.calls[1])).toContain('"the answer is no"');
    expect(systemOf(fetchMock.mock.calls[0])).not.toContain('NOT SHOWN TO THE SEEKER');
  });

  it('returns null when the rewrite is refused too — checks are not loosened', async () => {
    const fetchMock = mockAnswers(REFUSED, REFUSED);
    expect(await ask()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('makes one call when the first draft passes', async () => {
    const fetchMock = mockAnswers(ACCEPTED);
    expect((await ask())?.answer).toBe(ACCEPTED);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a transport failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 529,
      text: () => Promise.resolve('overloaded'),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect(await ask()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a provider refusal — no reply, one call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'completed',
          output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'cannot help' }] }],
        }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect(await ask()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips the rewrite when the first draft used up the budget', async () => {
    const start = 1_000_000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(start);
    const fetchMock = vi.fn().mockImplementationOnce(() => {
      now.mockReturnValue(start + 25_000);
      return Promise.resolve(answerResponse(REFUSED));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect(await ask()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('rejectedPhrases / rewriteNote', () => {
  it('names the refused wording without codes or contract fields', () => {
    const phrases = rejectedPhrases([
      '[the launch reading] VERDICT_CONTRADICTION: asserted "is denied" but diagnosis.outcome is DELAYED',
      '[the launch reading] VERDICT_CONTRADICTION: asserted "is denied" but diagnosis.outcome is DELAYED',
      '[the launch reading] TIMING_FABRICATION: narration names a specific calendar date/day ("the 14th"), which the engine never produces',
    ]);
    expect(phrases).toEqual(['is denied', 'the 14th']);
    const note = rewriteNote(phrases);
    expect(note).toContain('"is denied", "the 14th"');
    expect(note).not.toMatch(/VERDICT_CONTRADICTION|diagnosis\.outcome/);
  });

  it('still asks for a rewrite when a failure quotes nothing', () => {
    expect(rejectedPhrases(['HOUSE_CLAIM_CONTRADICTION: narration claims house 5'])).toEqual([]);
    expect(rewriteNote([])).toContain('does not support');
  });
});

describe('composeDiscussionReply — conversation_complete', () => {
  function mockRaw(body: Record<string, unknown>) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responsesBody(JSON.stringify(body))),
    }) as unknown as typeof fetch;
  }

  it('carries the close through', async () => {
    mockRaw({ answer: ACCEPTED, is_new_question: false, conversation_complete: true });
    expect((await ask())?.conversationComplete).toBe(true);
  });

  it('defaults to open when the key is missing', async () => {
    mockRaw({ answer: ACCEPTED, is_new_question: false });
    expect((await ask())?.conversationComplete).toBe(false);
  });

  it('never closes a reply that points to a new question', async () => {
    mockRaw({ answer: ACCEPTED, is_new_question: true, conversation_complete: true });
    const reply = await ask();
    expect(reply?.isNewQuestion).toBe(true);
    expect(reply?.conversationComplete).toBe(false);
  });
});

describe('composeDiscussionReply — failure logs carry the reference', () => {
  const logContext = { ref: '3k9x2m1a', readingId: 'r-launch' };
  const askWithRef = () =>
    composeDiscussionReply({
      groundings: groundings(),
      turns: [],
      message: 'What should I watch for next?',
      replyLang: 'en',
      logContext,
    });

  it('stamps both validation logs of a refused follow-up', async () => {
    vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    mockAnswers(REFUSED, REFUSED);
    expect(await askWithRef()).toBeNull();
    expect(logger.info).toHaveBeenCalledWith(
      'oracle discussion reply failed validation — rewriting once',
      expect.objectContaining({ ...logContext, attempt: 1 }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'oracle discussion reply failed validation — no reply returned',
      expect.objectContaining({ ...logContext, attempt: 2 }),
    );
  });

  it('stamps a transport failure', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 529,
      text: () => Promise.resolve('overloaded'),
    }) as unknown as typeof fetch;
    expect(await askWithRef()).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'oracle discussion HTTP error',
      expect.objectContaining({ ...logContext, status: 529 }),
    );
  });
});

describe('composeDiscussionReply — model-written text never reaches operational logs', () => {
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
    return () => JSON.stringify(calls);
  }

  it.each([
    [
      'a refusal quoting the seeker',
      {
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'refusal', refusal: `No: ${PLANTED}` }] }],
      },
    ],
    [
      'malformed output quoting the seeker',
      {
        status: 'completed',
        output: [
          { type: 'message', content: [{ type: 'output_text', text: `${PLANTED} — not JSON` }] },
        ],
      },
    ],
  ])('%s → no reply, logged by category only', async (_label, body) => {
    const logs = captureLogs();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(body),
    }) as unknown as typeof fetch;
    expect(await ask()).toBeNull();
    expect(logs()).toContain('oracle discussion failed');
    expect(logs()).not.toContain('Lahore7f3a');
  });
});
