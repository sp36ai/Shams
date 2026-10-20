/**
 * Rafiq–Nusrat regression case (owner request, 2026-10-20).
 *
 * Question: "Rafiq is asking what Nusrat's step is or what her plan is."
 * Judgment: DELAYED (shown to the seeker as WAIT), Zuhal obstructing,
 * 42–63 days, asked 20 October 2026 at 13:57 IST.
 *
 * What these tests can prove: the composer keeps the engine's verdict, writes
 * the window as the correct dates, tells the model not to claim the other
 * person's intentions, rejects a draft that names a calendar date itself,
 * and makes card and voice carry the same dates. What they cannot prove:
 * how the live model actually writes — that needs a live run (see
 * liveStructuredOutputs.live.test.ts).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config', () => ({
  ANTHROPIC_API_KEY: { value: () => 'test-key' },
  FUNCTION_OPTS: {},
  ORACLE_FUNCTION_OPTS: {},
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  buildSpeakableText,
  composeWatchOracleResponse,
  type NarrationFields,
} from '../responseComposer';
import { WATCH_ORACLE_SYNTHESIS_PROMPT } from '../../prompts/watchOracleSynthesisPrompt';
import { diagnose } from '../../engine/rkp/diagnosis';
import type { DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';

const QUESTION = "Rafiq is asking what Nusrat's step is or what her plan is.";
/** 13:57 IST on 20 October 2026. */
const ASKED_AT = new Date('2026-10-20T08:27:00Z');
const IST = 330;

const VERDICT = {
  qType: 'general',
  targetHouse: 1,
  targetSignName: 'Burj Hamal',
  targetRuler: 'Mars',
  targetRulerName: 'Mirrikh',
  fulfilmentHouse: 11,
  lagnaRuler: 'Mars',
  rulerRelation: 'Friend',
  state: 'DELAYED',
  confidence: 'MODERATE',
  score: 0,
  obstruction: 'Saturn',
  reversal: 'NONE',
  timing: { minDays: 42, maxDays: 63 },
  direction: 'North',
  afflictedDirection: 'West',
  controllerProfile: 'Assertive',
  factors: ['Zuhal casts its gaze on the matter — friction and delay.'],
} as unknown as DisplayWatchVerdict;

/** The kind of answer the owner asked for: honest about Nusrat's mind. */
const GOOD_DRAFT: NarrationFields = {
  rkp_finding:
    'Rafiq, this has not settled yet, and it will not settle quickly. Zuhal, the star of delay, is holding the matter back without closing it, and the chart puts the next real movement within 42 to 63 days.',
  interpretation:
    'A delay is not a refusal. But this reading speaks to how the matter stands, not to what is in Nusrat’s mind, so it cannot tell you her plan. What she actually does will show that far more truly than any reading.',
  recommended_approach:
    'Keep your own decisions reversible for now, and watch what she does rather than guessing at what she intends.',
  why_this_remedy:
    'This is a slow matter, not a closed one, so what is counselled builds patience while it unfolds.',
  signature: 'Slow is not the same as no.',
};

function mockModelReply(draft: NarrationFields): void {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: JSON.stringify(draft) }] }),
    }),
  ) as unknown as typeof fetch;
}

function sentRequest(): { system: string; user: string } {
  const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  const init = fetchMock.mock.calls[0]?.[1] as { body: string };
  const body = JSON.parse(init.body) as { system: string; messages: { content: string }[] };
  return { system: body.system, user: body.messages[0]!.content };
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockModelReply(GOOD_DRAFT);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function compose(overrides: { utcOffsetMinutes?: number } = { utcOffsetMinutes: IST }) {
  return composeWatchOracleResponse({
    verdict: VERDICT,
    question: QUESTION,
    seekerName: 'Rafiq',
    readingId: 'rafiq-nusrat',
    computedAt: ASKED_AT,
    ...overrides,
  });
}

describe('Rafiq–Nusrat regression', () => {
  it('preserves the engine verdict: a long wait under Zuhal, not a refusal', async () => {
    const { composition } = await compose();
    const engine = diagnose(VERDICT);
    expect(composition.diagnosis.outcome).toBe('DELAYED');
    expect(composition.diagnosis.timingPosture).toBe('WAIT_LONG');
    expect(composition.diagnosis.obstructingAgent).toBe('Saturn');
    expect(composition.diagnosis.outcome).toBe(engine.outcome);
    expect(composition.diagnosis.confidence).toBe(engine.confidence);
  });

  it('writes the 42–63 day window as 1–22 December 2026', async () => {
    const { composition } = await compose();
    expect(composition.timingWindow).toEqual({
      minDays: 42,
      maxDays: 63,
      startDate: '2026-12-01',
      endDate: '2026-12-22',
      label: '1–22 December 2026',
    });
  });

  it('keeps a well-formed draft and speaks the same dates the card shows', async () => {
    const { composition } = await compose();
    expect(composition.narration).toEqual(GOOD_DRAFT);
    expect(composition.speakableText).toBe(
      `${buildSpeakableText(GOOD_DRAFT)} By the calendar, that window runs 1 to 22 December 2026.`,
    );
  });

  it('briefs the model with the question and the settled window, and forbids it dates', async () => {
    await compose();
    const { system, user } = sentRequest();
    expect(user).toContain(QUESTION);
    expect(user).toContain('Timing window:      42 to 63 days');
    expect(user).toContain('Obstructing agent:  Zuhal');
    expect(user).not.toMatch(/December/);
    expect(system).toContain('never write a date or a month name for the window');
  });

  it('tells the model it cannot know or predict the other person’s intentions', () => {
    expect(WATCH_ORACLE_SYNTHESIS_PROMPT).toContain('WHEN THE QUESTION IS ABOUT ANOTHER PERSON');
    expect(WATCH_ORACLE_SYNTHESIS_PROMPT).toContain(
      'Never state or imply what the other person intends, plans, feels, thinks, wants or has decided',
    );
    expect(WATCH_ORACLE_SYNTHESIS_PROMPT).toContain(
      'Never predict that the other person will contact, call, message, return',
    );
    // The earlier example itself asserted a third party's intent.
    expect(WATCH_ORACLE_SYNTHESIS_PROMPT).not.toContain('The buyer is not walking away');
  });

  it('rejects a draft that names a calendar date itself, and the fallback still says WAIT', async () => {
    mockModelReply({
      ...GOOD_DRAFT,
      rkp_finding: 'Rafiq, Nusrat will reach out to you on December 1.',
    });
    const { composition } = await compose();
    expect(composition.narration?.rkp_finding).not.toContain('December');
    expect(composition.narration?.rkp_finding).toMatch(/^Not yet\./);
    expect(composition.narration?.interpretation).toContain('This is a delay, not a refusal.');
    expect(composition.narration?.rkp_finding).not.toMatch(/Nusrat/);
    // The deterministic dates survive the fallback, on card and voice alike.
    expect(composition.timingWindow?.label).toBe('1–22 December 2026');
    expect(composition.speakableText).toMatch(/1 to 22 December 2026\.$/);
  });

  it('rejects a draft that shrinks the window', async () => {
    mockModelReply({ ...GOOD_DRAFT, rkp_finding: 'Rafiq, this moves within 10 days.' });
    const { composition } = await compose();
    expect(composition.narration?.rkp_finding).not.toContain('10 days');
  });

  it('shows no dates, and speaks none, when no timezone was supplied', async () => {
    const { composition } = await compose({});
    expect(composition.timingWindow).toBeNull();
    expect(composition.speakableText).toBe(buildSpeakableText(GOOD_DRAFT));
  });

  it('shows no dates when the engine gave no window', async () => {
    const { composition } = await composeWatchOracleResponse({
      verdict: { ...VERDICT, timing: null } as DisplayWatchVerdict,
      question: QUESTION,
      computedAt: ASKED_AT,
      utcOffsetMinutes: IST,
    });
    expect(composition.timingWindow).toBeNull();
  });

  it('keeps the dates but speaks nothing when synthesis fails outright', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('') }),
    ) as unknown as typeof fetch;
    const { composition } = await compose();
    expect(composition.narration).toBeNull();
    expect(composition.speakableText).toBeNull();
    expect(composition.timingWindow?.label).toBe('1–22 December 2026');
    expect(composition.diagnosis.outcome).toBe('DELAYED');
  });
});
