/**
 * PHASE 5H-R — permanent regression coverage for the TTS artifact boundary.
 * --------------------------------------------------------------------------
 * Covers Finding 5H-1 (`docs/audit/PHASE_5H_RECONNAISSANCE.md`): the string
 * `ChatBubble.speakableTextFor()` built for text-to-speech joined three of
 * the five `NarrationFields` client-side, after per-field validation had
 * already run — a claim could be split across the `rkp_finding` /
 * `interpretation` boundary so that neither field alone tripped a check,
 * while the join a seeker actually heard did. Closed by moving the join
 * server-side (`buildSpeakableText()`) and validating its exact output
 * before it is ever included in a composition — see
 * `responseComposer.ts`'s own comments on `speakableText`,
 * `buildSpeakableText()` and `wrapAsAllNarrationFields()`, and
 * `docs/audit/PHASE_5H_R_HARDENING.md`.
 *
 * Three tiers, matching this codebase's established pattern:
 *   1. `buildSpeakableText()` unit tests — the exact transformation
 *      semantics, reproduced against the real production function (not a
 *      hand-written approximation).
 *   2. Direct `validateNarration()` probes against the wrapped join — fast,
 *      deterministic, proves the check itself fires/doesn't fire.
 *   3. `composeWatchOracleResponse()` integration tests, with `fetch`
 *      mocked — proves the wiring: a failing TTS-artifact check actually
 *      changes what the composition returns, not just that the check would
 *      say so in isolation.
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
import { diagnose } from '../../engine/rkp/diagnosis';
import { classifyQuestion } from '../../engine/kp/rules/questionKeywords';
import { selectRemedyProtocol } from '../remedySelection';
import { toBoundaryPlanetName } from '../../utils/planetBoundaryName';
import { buildReadingContract, type ReadingContract } from '../readingContract';
import { validateNarration } from '../narrationValidator';
import {
  buildSpeakableText,
  wrapAsAllNarrationFields,
  composeWatchOracleResponse,
  type NarrationFields,
} from '../responseComposer';

function contractFor(moment: string, question: string, readingId: string): ReadingContract {
  const chart = buildWatchChart(moment);
  const qType = classifyQuestion(question);
  const rawVerdict = judgeWatchChart(chart, qType);
  const verdict: DisplayWatchVerdict = {
    ...rawVerdict,
    obstruction: toBoundaryPlanetName(rawVerdict.obstruction),
    targetRuler: toBoundaryPlanetName(rawVerdict.targetRuler),
    lagnaRuler: toBoundaryPlanetName(rawVerdict.lagnaRuler),
  };
  const diagnosis = diagnose(verdict);
  const protocol = selectRemedyProtocol(diagnosis);
  return buildReadingContract({
    readingId,
    computedAt: new Date('2026-08-15T00:00:00.000Z'),
    question,
    verdict,
    diagnosis,
    protocol,
  });
}

// employment-001-equivalent: reversal is genuinely POSSIBLE, retrograde ruler.
const possibleReversal = contractFor(
  '2026-08-15T11:00:00+04:00',
  'Will I get the job I interviewed for?',
  'r-5hr-possible-reversal',
);
// business-007-equivalent: reversal is NONE — the 5H-1 attack contract.
const noneReversal = contractFor(
  '2026-08-15T11:37:00+05:00',
  'Should I close my failing business?',
  'r-5hr-none-reversal',
);

/* -------------------------------------------------------------------------- */
/*  A. buildSpeakableText — exact transformation semantics                    */
/* -------------------------------------------------------------------------- */

describe('PHASE 5H-R — buildSpeakableText: exact production transformation', () => {
  // Verified during pre-implementation reconnaissance against the real,
  // then-still-client-side speakableTextFor() before this change moved it
  // here — every case below reproduces that verification's own results.
  it('joins all three fields with ". " when all are populated', () => {
    const fields: NarrationFields = {
      rkp_finding: 'A.',
      interpretation: 'B.',
      recommended_approach: 'C.',
      why_this_remedy: 'D.',
      signature: 'S.',
    };
    expect(buildSpeakableText(fields)).toBe('A.. B.. C.');
  });

  it('drops an empty middle field without leaving an extra separator', () => {
    const fields: NarrationFields = {
      rkp_finding: 'A.',
      interpretation: '',
      recommended_approach: 'C.',
      why_this_remedy: null,
      signature: 'S.',
    };
    expect(buildSpeakableText(fields)).toBe('A.. C.');
  });

  it('returns a single field unjoined when only one is populated', () => {
    const fields: NarrationFields = {
      rkp_finding: 'Only this.',
      interpretation: '',
      recommended_approach: '',
      why_this_remedy: null,
      signature: 'S.',
    };
    expect(buildSpeakableText(fields)).toBe('Only this.');
  });

  it('returns an empty string when all three are empty', () => {
    const fields: NarrationFields = {
      rkp_finding: '',
      interpretation: '',
      recommended_approach: '',
      why_this_remedy: null,
      signature: 'S.',
    };
    expect(buildSpeakableText(fields)).toBe('');
  });

  it('preserves Unicode and punctuation verbatim', () => {
    const fields: NarrationFields = {
      rkp_finding: 'Zuḥal — retrograde؟',
      interpretation: 'नमस्ते, यह जारी है।',
      recommended_approach: 'Wait…',
      why_this_remedy: null,
      signature: 'S.',
    };
    expect(buildSpeakableText(fields)).toBe('Zuḥal — retrograde؟. नमस्ते, यह जारी है।. Wait…');
  });

  it('does not treat a whitespace-only field as empty (matches the real filter: s.length > 0)', () => {
    const fields: NarrationFields = {
      rkp_finding: 'A.',
      interpretation: '   ',
      recommended_approach: 'C.',
      why_this_remedy: null,
      signature: 'S.',
    };
    expect(buildSpeakableText(fields)).toBe('A..    . C.');
  });

  it('excludes why_this_remedy and signature, exactly like the transformation it replaced', () => {
    const fields: NarrationFields = {
      rkp_finding: 'F.',
      interpretation: 'I.',
      recommended_approach: 'R.',
      why_this_remedy: 'THIS MUST NOT APPEAR',
      signature: 'THIS MUST NOT APPEAR EITHER',
    };
    const spoken = buildSpeakableText(fields);
    expect(spoken).not.toContain('THIS MUST NOT APPEAR');
    expect(spoken).toBe('F.. I.. R.');
  });
});

/* -------------------------------------------------------------------------- */
/*  B. The 5H-1 reproduction, directly against validateNarration            */
/* -------------------------------------------------------------------------- */

describe('PHASE 5H-R — 5H-1 reproduction: split-field claim reaches the TTS artifact', () => {
  it('passes per-field validation but the TTS artifact contains a rejectable claim', () => {
    const fields: NarrationFields = {
      rkp_finding:
        'The chart shows real difficulty here, and I want to be honest: there may be a reversal',
      interpretation: 'remains possible, though nothing about this is settled yet.',
      recommended_approach: 'Patience is called for while this plays out.',
      why_this_remedy: 'The remedy addresses the underlying obstruction directly.',
      signature: 'May clarity come to you soon.',
    };

    // Exactly what composeWatchOracleResponse() itself checks per field.
    const perField = validateNarration(noneReversal, fields);
    expect(perField.valid).toBe(true);

    // Exactly what it now additionally checks — the artifact this reading's
    // TTS button would actually speak.
    const speakable = buildSpeakableText(fields);
    const ttsResult = validateNarration(noneReversal, wrapAsAllNarrationFields(speakable));
    expect(ttsResult.valid).toBe(false);
    if (!ttsResult.valid) {
      expect(ttsResult.failures.some(f => f.code === 'REVERSAL_CLAIM_CONTRADICTION')).toBe(true);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  C/D/E. composeWatchOracleResponse() integration — the actual wiring      */
/* -------------------------------------------------------------------------- */

function mockDraft(fields: NarrationFields): void {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: JSON.stringify(fields) }] }),
    }),
  ) as unknown as typeof fetch;
}

const SPLIT_REVERSAL_ATTACK: NarrationFields = {
  rkp_finding:
    'The chart shows real difficulty here, and I want to be honest: there may be a reversal',
  interpretation: 'remains possible, though nothing about this is settled yet.',
  recommended_approach: 'Patience is called for while this plays out.',
  why_this_remedy: 'The remedy addresses the underlying obstruction directly.',
  signature: 'May clarity come to you soon.',
};

describe('PHASE 5H-R — composeWatchOracleResponse: the TTS artifact check is wired in', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('E. normal, genuine narration: speakableText equals buildSpeakableText(narration), TTS not blocked', async () => {
    const genuine: NarrationFields = {
      rkp_finding: 'The tenth house carries this matter, and the signs favour patience.',
      interpretation: 'This is not a denial, only a delay while things settle.',
      recommended_approach: 'Hold steady and revisit this in the coming weeks.',
      why_this_remedy: 'A grounding practice supports steadiness through the wait.',
      signature: 'The door opens slowly, but it opens.',
    };
    mockDraft(genuine);

    const { composition } = await composeWatchOracleResponse({
      verdict: noneReversal.judgment,
      question: 'Should I close my failing business?',
      readingId: noneReversal.provenance.readingId,
      computedAt: new Date('2026-08-15T00:00:00.000Z'),
    });

    expect(composition.narration).toEqual(genuine);
    expect(composition.speakableText).toBe(buildSpeakableText(genuine));
  });

  it('B. the split-field reversal claim (5H-1) triggers the deterministic fallback, not the raw draft', async () => {
    mockDraft(SPLIT_REVERSAL_ATTACK);

    const { composition } = await composeWatchOracleResponse({
      verdict: noneReversal.judgment,
      question: 'Should I close my failing business?',
      readingId: noneReversal.provenance.readingId,
      computedAt: new Date('2026-08-15T00:00:00.000Z'),
    });

    // The raw drafted text must not survive into the composition at all —
    // neither in narration nor, critically, in speakableText (the artifact
    // this finding is specifically about).
    expect(composition.narration).not.toEqual(SPLIT_REVERSAL_ATTACK);
    expect(composition.speakableText).not.toBeNull();
    expect(composition.speakableText).not.toContain('there may be a reversal');
    expect(composition.speakableText).not.toContain('remains possible');

    // speakableText must still be internally consistent with whatever
    // narration WAS used (the deterministic fallback) — never orphaned from
    // it.
    expect(composition.narration).not.toBeNull();
    if (composition.narration !== null) {
      expect(composition.speakableText).toBe(buildSpeakableText(composition.narration));
    }

    // And the fallback itself must not re-trip the very check that caused
    // it — otherwise a reading could be un-narratable.
    if (composition.speakableText !== null) {
      const refCheck = validateNarration(
        noneReversal,
        wrapAsAllNarrationFields(composition.speakableText),
      );
      expect(refCheck.valid).toBe(true);
    }
  });

  it('C. the SAME split-field shape is accepted when the contract genuinely supports it (positive control)', async () => {
    // Identical field split, identical wording — the only difference is the
    // contract: possibleReversal.judgment.reversal === 'POSSIBLE', so this
    // claim is TRUE. Must not be rejected — a false positive here would be
    // exactly the kind of harm this whole review chain has repeatedly
    // guarded against re-introducing.
    mockDraft(SPLIT_REVERSAL_ATTACK);

    const { composition } = await composeWatchOracleResponse({
      verdict: possibleReversal.judgment,
      question: 'Will I get the job I interviewed for?',
      readingId: possibleReversal.provenance.readingId,
      computedAt: new Date('2026-08-15T00:00:00.000Z'),
    });

    expect(composition.narration).toEqual(SPLIT_REVERSAL_ATTACK);
    expect(composition.speakableText).toBe(buildSpeakableText(SPLIT_REVERSAL_ATTACK));
  });

  it('D. adversarial re-composition through the actual artifact: confusable substitution across the same boundary', async () => {
    // Cyrillic а (U+0430) in place of Latin a inside "reversal" — the exact
    // 5D-R confusable-folding mechanism, now attacking the TTS artifact
    // rather than a single field.
    const obfuscated: NarrationFields = {
      ...SPLIT_REVERSAL_ATTACK,
      rkp_finding: SPLIT_REVERSAL_ATTACK.rkp_finding.replace('reversal', 'reversаl'),
    };
    mockDraft(obfuscated);

    const { composition } = await composeWatchOracleResponse({
      verdict: noneReversal.judgment,
      question: 'Should I close my failing business?',
      readingId: noneReversal.provenance.readingId,
      computedAt: new Date('2026-08-15T00:00:00.000Z'),
    });

    expect(composition.narration).not.toEqual(obfuscated);
    expect(composition.speakableText).not.toContain('remains possible');
  });

  it('D. adversarial re-composition through the actual artifact: mid-word punctuation across the same boundary', async () => {
    const obfuscated: NarrationFields = {
      ...SPLIT_REVERSAL_ATTACK,
      rkp_finding: SPLIT_REVERSAL_ATTACK.rkp_finding.replace('reversal', 'rever.s.al'),
    };
    mockDraft(obfuscated);

    const { composition } = await composeWatchOracleResponse({
      verdict: noneReversal.judgment,
      question: 'Should I close my failing business?',
      readingId: noneReversal.provenance.readingId,
      computedAt: new Date('2026-08-15T00:00:00.000Z'),
    });

    expect(composition.narration).not.toEqual(obfuscated);
    expect(composition.speakableText).not.toContain('remains possible');
  });

  it('D. adversarial re-composition through the actual artifact: combined ZWJ + confusable across the boundary', async () => {
    const combined: NarrationFields = {
      ...SPLIT_REVERSAL_ATTACK,
      rkp_finding: SPLIT_REVERSAL_ATTACK.rkp_finding.replace(
        'reversal',
        'r‍eversaаl'.replace('aаl', 'аl'),
      ),
    };
    mockDraft(combined);

    const { composition } = await composeWatchOracleResponse({
      verdict: noneReversal.judgment,
      question: 'Should I close my failing business?',
      readingId: noneReversal.provenance.readingId,
      computedAt: new Date('2026-08-15T00:00:00.000Z'),
    });

    expect(composition.narration).not.toEqual(combined);
    expect(composition.speakableText).not.toContain('remains possible');
  });

  it('E. a per-field failure (not a TTS-boundary one) still falls back exactly as before — no regression', async () => {
    const wrongVerdict: NarrationFields = {
      rkp_finding: 'Rest assured, the matter will succeed and nothing stands in the way now.',
      interpretation: 'Confidence is warranted here.',
      recommended_approach: 'Proceed without hesitation.',
      why_this_remedy: 'A supportive practice reinforces this outcome.',
      signature: 'The path is clear.',
    };
    mockDraft(wrongVerdict);

    const { composition } = await composeWatchOracleResponse({
      verdict: noneReversal.judgment,
      question: 'Should I close my failing business?',
      readingId: noneReversal.provenance.readingId,
      computedAt: new Date('2026-08-15T00:00:00.000Z'),
    });

    expect(composition.narration).not.toEqual(wrongVerdict);
    expect(composition.speakableText).not.toBeNull();
    expect(composition.speakableText).not.toContain('the matter will succeed');
  });

  it('E. synthesis failure (no draft at all): speakableText is null, exactly like narration', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.reject(new Error('network down')),
    ) as unknown as typeof fetch;

    const { composition } = await composeWatchOracleResponse({
      verdict: noneReversal.judgment,
      question: 'Should I close my failing business?',
      readingId: noneReversal.provenance.readingId,
      computedAt: new Date('2026-08-15T00:00:00.000Z'),
    });

    expect(composition.narration).toBeNull();
    expect(composition.speakableText).toBeNull();
  });
});
