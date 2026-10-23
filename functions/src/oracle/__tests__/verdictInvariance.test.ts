/**
 * Engine authority: nothing the model returns can change the judgment.
 *
 * composeWatchOracleResponse() receives a settled verdict from the RKP engine
 * and asks Claude only for prose. This suite feeds it every shape of model
 * output (good prose, adversarial prose, injected verdict/remedy fields,
 * malformed JSON, an HTTP error, a timeout) for the SAME verdict and asserts
 * the structured judgment that reaches the client and Firestore is identical
 * every time. Audit 2026-10-15.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config', () => ({
  ANTHROPIC_API_KEY: { value: () => 'test-key' },
  FUNCTION_OPTS: {},
  ORACLE_FUNCTION_OPTS: {},
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { buildWatchChart } from '../../engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';
import { classifyQuestion } from '../../engine/kp/rules/questionKeywords';
import { toBoundaryPlanetName } from '../../utils/planetBoundaryName';
import { composeWatchOracleResponse } from '../responseComposer';

const QUESTION = 'Will I get married this year?';
// The moment of the reading the owner reported on 14 Oct 2026 (23:02 IST).
const MOMENT = '2026-10-14T23:02:00+05:30';

function verdictFor(moment: string, question: string): DisplayWatchVerdict {
  const raw = judgeWatchChart(buildWatchChart(moment), classifyQuestion(question));
  return {
    ...raw,
    obstruction: toBoundaryPlanetName(raw.obstruction),
    targetRuler: toBoundaryPlanetName(raw.targetRuler),
    lagnaRuler: toBoundaryPlanetName(raw.lagnaRuler),
  };
}

const okProse = {
  rkp_finding: 'Not this way, not yet. The matter is held back for now.',
  interpretation: 'This is a delay to wait through, not a door to force.',
  recommended_approach: 'Step back and let the matter settle before you press it.',
  why_this_remedy: 'What is counselled steadies you while the matter is held.',
  signature: 'Patience.',
};

type ModelBehaviour =
  | { kind: 'json'; body: unknown }
  | { kind: 'text'; text: string }
  | { kind: 'http'; status: number }
  | { kind: 'throw' };

function stubModel(behaviour: ModelBehaviour): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      if (behaviour.kind === 'throw') {
        return Promise.reject(new Error('aborted'));
      }
      if (behaviour.kind === 'http') {
        return Promise.resolve(new Response('upstream error', { status: behaviour.status }));
      }
      const text = behaviour.kind === 'json' ? JSON.stringify(behaviour.body) : behaviour.text;
      return Promise.resolve(
        new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 }),
      );
    }),
  );
}

async function composeWith(behaviour: ModelBehaviour) {
  stubModel(behaviour);
  const verdict = verdictFor(MOMENT, QUESTION);
  const { composition, contract } = await composeWatchOracleResponse({
    verdict,
    question: QUESTION,
    readingId: 'r-invariance',
    computedAt: new Date('2026-10-14T17:32:00Z'),
  });
  return { verdict, composition, contract };
}

/** Everything about a reading that the engine, not the model, decides. */
function engineFields(r: Awaited<ReturnType<typeof composeWith>>) {
  return {
    state: r.verdict.state,
    score: r.verdict.score,
    timing: r.verdict.timing,
    diagnosis: r.composition.diagnosis,
    protocol: r.composition.protocol,
    suggestedQuestions: r.composition.suggestedQuestions,
    fingerprint: r.composition.contractFingerprint,
    contractDiagnosis: r.contract.diagnosis,
    contractRemedy: r.contract.remedy,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('model output can never change the engine judgment', () => {
  const behaviours: Record<string, ModelBehaviour> = {
    'well-formed prose': { kind: 'json', body: okProse },
    'prose asserting the opposite verdict': {
      kind: 'json',
      body: {
        ...okProse,
        rkp_finding: 'The answer is yes. The matter is fulfilled and will certainly happen.',
      },
    },
    'injected verdict, diagnosis and remedy fields': {
      kind: 'json',
      body: {
        ...okProse,
        verdict: 'YES',
        state: 'FULFILLED',
        diagnosis: { outcome: 'FAVOURABLE' },
        protocol: { steps: [{ id: 'invented-remedy', name: 'Invented remedy' }] },
        timing: { minDays: 1, maxDays: 1 },
      },
    },
    'malformed JSON': { kind: 'text', text: '{"rkp_finding": "unterminated' },
    'upstream HTTP 500': { kind: 'http', status: 500 },
    'timeout / network failure': { kind: 'throw' },
  };

  it('keeps every engine-owned field identical across all model behaviours', async () => {
    const results = [];
    for (const behaviour of Object.values(behaviours)) {
      results.push(engineFields(await composeWith(behaviour)));
    }
    for (const r of results.slice(1)) {
      expect(r).toEqual(results[0]);
    }
  });

  it('copies remedies only from the library, never from the model', async () => {
    const r = await composeWith(behaviours['injected verdict, diagnosis and remedy fields']!);
    expect(r.composition.protocol.steps.map(s => s.id)).not.toContain('invented-remedy');
    expect(JSON.stringify(r.composition)).not.toContain('Invented remedy');
  });

  it('replaces prose that contradicts the verdict with the deterministic fallback', async () => {
    const r = await composeWith(behaviours['prose asserting the opposite verdict']!);
    expect(r.verdict.state).not.toBe('FULFILLED');
    expect(r.composition.narration?.rkp_finding).not.toMatch(/the answer is yes/i);
  });

  it('never fabricates prose when the model fails outright', async () => {
    for (const name of ['malformed JSON', 'upstream HTTP 500', 'timeout / network failure']) {
      const r = await composeWith(behaviours[name]!);
      expect(r.composition.narration, name).toBeNull();
      expect(r.composition.speakableText, name).toBeNull();
      // The judgment still stands on its own.
      expect(r.composition.diagnosis.outcome, name).toBeTruthy();
    }
  });
});

describe('the engine itself is deterministic', () => {
  it('judges identical inputs identically', () => {
    const a = verdictFor(MOMENT, QUESTION);
    const b = verdictFor(MOMENT, QUESTION);
    expect(b).toEqual(a);
  });

  it('keeps the verdict for the whole 5-minute watch bracket and only there', () => {
    const inBracket = ['2026-10-14T23:00:00+05:30', '2026-10-14T23:04:59+05:30'].map(m =>
      verdictFor(m, QUESTION),
    );
    expect(inBracket[1]).toMatchObject({
      targetHouse: inBracket[0]!.targetHouse,
      targetSignName: inBracket[0]!.targetSignName,
    });
    const next = verdictFor('2026-10-14T23:05:00+05:30', QUESTION);
    expect(next.targetSignName).not.toBe(inBracket[0]!.targetSignName);
  });

  it('selects the frame from the querent’s own wall-clock minute, not UTC', () => {
    // 23:02 in India is 17:32 UTC: a UTC minute would pick a different bracket.
    const ist = verdictFor('2026-10-14T23:02:00+05:30', QUESTION);
    const utcSameInstant = verdictFor('2026-10-14T17:32:00Z', QUESTION);
    expect(ist.targetSignName).not.toBe(utcSameInstant.targetSignName);
  });
});
