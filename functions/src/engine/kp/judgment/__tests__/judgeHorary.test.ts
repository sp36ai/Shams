import { describe, it, expect } from 'vitest';

import { buildChart } from '../../../primitives/chartBuilder';
import { judgeHorary } from '../judgeHorary';
import { classifyQuestion } from '../../rules/questionKeywords';
import type { ClassifiedQuestion } from '../../../types/question';

/**
 * judgeHorary's own module docstring states the invariant this file enforces
 * in code: "No Date.now(), no Math.random(), no unordered Set iteration" —
 * i.e. (chart, question, horaryNumber) fully determines the verdict, forever.
 * That is the specific, load-bearing claim PRODUCTION_AUDIT_2026-08-23.md §6
 * verified by reading the source; this test verifies it by calling the
 * function and checking the output, which a source read alone cannot do
 * (nothing stops a future edit from introducing exactly the kind of
 * nondeterminism this docstring promises isn't there).
 */

function classify(text: string): ClassifiedQuestion {
  return {
    text,
    lang: 'en',
    qType: classifyQuestion(text),
    confidence: 1.0,
    matchedKeywords: [],
  };
}

describe('judgeHorary — determinism', () => {
  const chart = buildChart('2026-08-15T10:30:00.000Z', 34.0837, 74.7973);
  const question = classify('Will I marry the person I love?');

  it('returns byte-identical verdicts for identical (chart, question, horaryNumber)', () => {
    const v1 = judgeHorary(chart, question, 42);
    const v2 = judgeHorary(chart, question, 42);
    expect(JSON.stringify(v1)).toBe(JSON.stringify(v2));
  });

  it('the deterministic id does not depend on the horary witness number', () => {
    // askOracle.ts generates horaryNumber randomly per request specifically
    // so two questions asked seconds apart don't collide (see its comment:
    // "keeps judgeHorary itself pure/deterministic"). deterministicId()
    // in judgeHorary.ts derives from (momentUtc, location, question text,
    // qType) only — confirming that here pins the actual behavior against
    // the comment's claim, not just the claim itself.
    const a = judgeHorary(chart, question, 1);
    const b = judgeHorary(chart, question, 249);
    expect(a.id).toBe(b.id);
  });

  it('a different chart (different location, same instant and question) produces a different verdict object', () => {
    // Sanity check the other direction: this isn't a stub that ignores its
    // inputs — a real input change produces a real output change.
    const otherChart = buildChart('2026-08-15T10:30:00.000Z', -34.6037, -58.3816);
    const v1 = judgeHorary(chart, question, 42);
    const v2 = judgeHorary(otherChart, question, 42);
    expect(JSON.stringify(v1)).not.toBe(JSON.stringify(v2));
  });

  it('produces a verdict with a non-empty reasoning trace, for auditability', () => {
    const v = judgeHorary(chart, question, 42);
    expect(v.reasoning.length).toBeGreaterThan(0);
    expect(['YES', 'NO', 'CONDITIONAL', 'DELAYED', 'UNCLEAR']).toContain(v.verdict);
  });
});
