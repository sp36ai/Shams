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
import { classifyQuestion } from '../../engine/kp/rules/questionKeywords';
import { selectRemedyProtocol } from '../remedySelection';
import { toBoundaryPlanetName } from '../../utils/planetBoundaryName';
import { buildReadingContract, type ReadingContract } from '../readingContract';
import {
  composeDiscussionReply,
  rejectedPhrases,
  rewriteNote,
  type ReadingGrounding,
} from '../discussionComposer';

vi.mock('../../config', () => ({
  ANTHROPIC_API_KEY: { value: () => 'test-key' },
  FUNCTION_OPTS: {},
  ORACLE_FUNCTION_OPTS: {},
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const QUESTION = 'When will this app will be launched successfully';

function launchContract(): ReadingContract {
  const raw = judgeWatchChart(
    buildWatchChart('2026-10-10T16:28:00+05:30'),
    classifyQuestion(QUESTION),
  );
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
    json: () =>
      Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify({ answer, is_new_question: false }) }],
      }),
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

function systemOf(call: unknown): string {
  const body = JSON.parse(((call as unknown[])[1] as { body: string }).body) as {
    system: Array<{ text: string }>;
  };
  return body.system.map(b => b.text).join('\n');
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
