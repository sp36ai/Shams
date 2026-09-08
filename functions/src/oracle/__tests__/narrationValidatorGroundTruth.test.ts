/**
 * PHASE 5E-R — permanent regression coverage for the ground-truth
 * structural/relational claim checks.
 * --------------------------------------------------------------------------
 * Covers exactly what Phase 5E-R was authorized to fix: Finding 5E-1
 * (house/sign/direction/retrograde/ruler-relation/reversal/supporting-house
 * claim fabrication — `docs/audit/PHASE_5E_RECONNAISSANCE.md` §7) and
 * Finding 5E-2 (the "the Nth house" / timing-detector collision, same
 * document). Diagnostic-cause claims (`diagnosis.rationale`) are NOT
 * covered here — see `docs/audit/PHASE_5E_R_HARDENING.md` for why that
 * eighth category was documented rather than implemented.
 *
 * Reproduces two of the same real, engine-produced contracts
 * `scripts/adversarial-harness/contracts.ts`'s pool uses (`employment-001`,
 * `business-007` — same question/moment, so the identical engine output),
 * built locally via the same `buildWatchChart` → `judgeWatchChart` →
 * `diagnose` → `selectRemedyProtocol` → `buildReadingContract` chain, in
 * the same style `narrationValidatorUnicodeSecurity.test.ts` already
 * established — that script directory sits outside `functions/src`'s
 * `rootDir` and cannot be imported from a compiled test file.
 */

import { describe, it, expect } from 'vitest';

import { buildWatchChart } from '../../engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';
import { diagnose } from '../../engine/rkp/diagnosis';
import { classifyQuestion } from '../../engine/kp/rules/questionKeywords';
import { selectRemedyProtocol } from '../remedySelection';
import { toBoundaryPlanetName } from '../../utils/planetBoundaryName';
import { buildReadingContract, type ReadingContract } from '../readingContract';
import { validateNarration } from '../narrationValidator';
import type { NarrationFields } from '../responseComposer';

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

function baseNarration(overrides: Partial<NarrationFields> = {}): NarrationFields {
  return {
    rkp_finding: 'The chart shows a specific configuration for this matter.',
    interpretation: 'This is a matter still finding its shape.',
    recommended_approach: 'Patience is the counsel here.',
    why_this_remedy: null,
    signature: 'The path is not yet clear.',
    ...overrides,
  };
}

// Same question/moment as scripts/adversarial-harness/contracts.ts's
// employment-001/business-007 seeds -- the real engine chain is
// deterministic, so this reproduces the identical contract.
const primary = contractFor(
  '2026-08-15T11:00:00+04:00',
  'Will I get the job I interviewed for?',
  'r-5er-employment-001',
); // genuinely retrograde -- see precondition test below
const secondary = contractFor(
  '2026-08-15T11:37:00+05:00',
  'Should I close my failing business?',
  'r-5er-business-007',
);

/* -------------------------------------------------------------------------- */
/*  Preconditions -- confirm the fixtures this suite depends on               */
/* -------------------------------------------------------------------------- */

describe('PHASE 5E-R fixture preconditions', () => {
  it('employment-001 is genuinely retrograde (both factors and rationale say so)', () => {
    expect(primary.judgment.factors.some(f => /retrograde/i.test(f))).toBe(true);
    expect(primary.diagnosis.rationale.some(r => /retrograde/i.test(r))).toBe(true);
  });

  it('business-007 is NOT retrograde -- a clean control for the false-positive fix', () => {
    expect(secondary.judgment.factors.some(f => /retrograde/i.test(f))).toBe(false);
    expect(secondary.diagnosis.rationale.some(r => /retrograde/i.test(r))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  Finding 5E-1 -- one describe block per claim category                     */
/* -------------------------------------------------------------------------- */

describe('PHASE 5E-R — house-number claims', () => {
  const actual = primary.judgment.targetHouse;
  const wrong = (actual % 12) + 1;

  it('correct house claim → VALID', () => {
    const narration = baseNarration({
      interpretation: `House number ${actual} governs this matter.`,
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('contradictory house claim → INVALID', () => {
    const narration = baseNarration({
      interpretation: `House number ${wrong} governs this matter.`,
    });
    const result = validateNarration(primary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'HOUSE_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('omitted house claim → VALID', () => {
    const narration = baseNarration({ interpretation: 'This matter requires patience.' });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('correct claim with Unicode obfuscation (ZWJ) → VALID', () => {
    const narration = baseNarration({
      interpretation: `House n‍umber ${actual} governs this matter.`,
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('wrong claim with Unicode obfuscation (ZWJ) → INVALID', () => {
    const narration = baseNarration({
      interpretation: `House n‍umber ${wrong} governs this matter.`,
    });
    expect(validateNarration(primary, narration).valid).toBe(false);
  });

  it('wrong claim combined with 5D-R punctuation mechanism (mid-word period) → INVALID', () => {
    const narration = baseNarration({
      interpretation: `House num.ber ${wrong} gove.rns this matter.`,
    });
    expect(validateNarration(primary, narration).valid).toBe(false);
  });

  it('wrong claim combined with 5D-R confusable mechanism (Cyrillic o) → INVALID', () => {
    const narration = baseNarration({
      interpretation: `House number ${wrong} gоverns this matter.`,
    });
    expect(validateNarration(primary, narration).valid).toBe(false);
  });

  it('case variation ("HOUSE NUMBER n GOVERNS THIS MATTER") is still recognized', () => {
    const narration = baseNarration({
      interpretation: `HOUSE NUMBER ${wrong} GOVERNS THIS MATTER.`,
    });
    expect(validateNarration(primary, narration).valid).toBe(false);
  });

  it('"Nth house" phrasing (ordinal form) is recognized, not just "house number N"', () => {
    const suffix = wrong === 1 ? 'st' : wrong === 2 ? 'nd' : wrong === 3 ? 'rd' : 'th';
    const narration = baseNarration({
      interpretation: `The ${wrong}${suffix} house governs this matter.`,
    });
    expect(validateNarration(primary, narration).valid).toBe(false);
  });

  it('multiple claims in one narration: one correct field, one contradictory house claim → INVALID', () => {
    const narration = baseNarration({
      rkp_finding: `The chart shows an obstruction to this matter.`,
      interpretation: `House number ${wrong} governs this matter.`,
    });
    expect(validateNarration(primary, narration).valid).toBe(false);
  });
});

describe('PHASE 5E-R — supporting-house claims', () => {
  const supporting = primary.diagnosis.supportingHouses;
  const notSupporting = ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const).find(
    h => !supporting.includes(h) && !primary.diagnosis.obstructingHouses.includes(h),
  )!;

  it('correct supporting-house claim → VALID', () => {
    if (supporting.length === 0) {
      return;
    } // nothing to assert positively for this contract
    const narration = baseNarration({
      interpretation: `House number ${supporting[0]} actively supports this outcome.`,
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('contradictory supporting-house claim → INVALID', () => {
    const narration = baseNarration({
      interpretation: `House number ${notSupporting} actively supports this outcome.`,
    });
    const result = validateNarration(primary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'SUPPORTING_HOUSE_CONTRADICTION')).toBe(true);
    }
  });

  it('omitted supporting-house claim → VALID', () => {
    expect(validateNarration(primary, baseNarration()).valid).toBe(true);
  });
});

describe('PHASE 5E-R — sign claims', () => {
  it('correct sign claim → VALID', () => {
    const narration = baseNarration({
      interpretation: `This matter is ruled through the sign of ${primary.judgment.targetSignName}.`,
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('contradictory sign claim (a different real sign) → INVALID', () => {
    const narration = baseNarration({
      interpretation: 'This matter is ruled through the sign of Aries.',
    });
    // guard: only meaningful if the real sign isn't already Aries/Hamal
    expect(primary.judgment.targetSignName.toLowerCase()).not.toContain('hamal');
    const result = validateNarration(primary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'SIGN_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('omitted sign claim → VALID', () => {
    expect(validateNarration(primary, baseNarration()).valid).toBe(true);
  });

  it('the classical name (no "Burj" prefix, no English gloss) is also recognized as correct', () => {
    const classicalOnly = primary.judgment.targetSignName.replace(/^Burj\s+/i, '');
    const narration = baseNarration({
      interpretation: `This matter is ruled through the sign of ${classicalOnly}.`,
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('wrong sign claim combined with 5D-R obfuscation (mid-word period) → INVALID', () => {
    const narration = baseNarration({
      interpretation: 'This matter is ruled thro.ugh the sign of Aries.',
    });
    expect(validateNarration(primary, narration).valid).toBe(false);
  });
});

describe('PHASE 5E-R — direction claims', () => {
  const wrongDirection = (['East', 'South', 'West', 'North'] as const).find(
    d => d !== primary.judgment.direction,
  )!;

  it('correct direction claim → VALID', () => {
    const narration = baseNarration({
      interpretation: `The matter's energy points toward the ${primary.judgment.direction}.`,
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('contradictory direction claim → INVALID', () => {
    const narration = baseNarration({
      interpretation: `The matter's energy points toward the ${wrongDirection}.`,
    });
    const result = validateNarration(primary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'DIRECTION_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('omitted direction claim → VALID', () => {
    expect(validateNarration(primary, baseNarration()).valid).toBe(true);
  });

  it('contradictory direction claim combined with a Cyrillic confusable → INVALID', () => {
    const narration = baseNarration({
      interpretation: `The matter's energy pоints toward the ${wrongDirection}.`,
    });
    expect(validateNarration(primary, narration).valid).toBe(false);
  });
});

describe('PHASE 5E-R — retrograde claims (ground-truth cross-check, not a blanket deny-list)', () => {
  it('a genuinely retrograde reading (employment-001) narrating that fact stays VALID', () => {
    const narration = baseNarration({
      interpretation: 'The ruling planet is retrograde in this matter.',
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('a NON-retrograde reading (business-007) narrating a retrograde claim is INVALID', () => {
    const narration = baseNarration({
      interpretation: 'The ruling planet is retrograde in this matter.',
    });
    const result = validateNarration(secondary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'RETROGRADE_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('omitted retrograde claim → VALID (on both a retrograde and non-retrograde reading)', () => {
    expect(validateNarration(primary, baseNarration()).valid).toBe(true);
    expect(validateNarration(secondary, baseNarration()).valid).toBe(true);
  });

  it('unsupported retrograde claim combined with a mid-word punctuation obfuscation → INVALID', () => {
    const narration = baseNarration({
      interpretation: 'The ruling planet is retro.grade in this matter.',
    });
    expect(validateNarration(secondary, narration).valid).toBe(false);
  });
});

describe('PHASE 5E-R — ruler-relation claims', () => {
  const wrongRelation = primary.judgment.rulerRelation === 'Friend' ? 'enemy' : 'friend';

  it('correct ruler-relation claim → VALID', () => {
    const narration = baseNarration({
      interpretation: `The querent's ruler regards the matter's ruler as a ${primary.judgment.rulerRelation.toLowerCase()}.`,
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('contradictory ruler-relation claim → INVALID', () => {
    const narration = baseNarration({
      interpretation: `The querent's ruler regards the matter's ruler as a ${wrongRelation}.`,
    });
    const result = validateNarration(primary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'RULER_RELATION_CONTRADICTION')).toBe(true);
    }
  });

  it('omitted ruler-relation claim → VALID', () => {
    expect(validateNarration(primary, baseNarration()).valid).toBe(true);
  });
});

describe('PHASE 5E-R — reversal-likelihood claims', () => {
  const wrongWord = primary.judgment.reversal === 'POSSIBLE' ? 'none' : 'possible';

  it('correct reversal claim → VALID', () => {
    const claimed = primary.judgment.reversal === 'POSSIBLE' ? 'possible' : 'none';
    const narration = baseNarration({
      interpretation: `A reversal of this outcome is ${claimed}.`,
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('contradictory reversal claim → INVALID', () => {
    const narration = baseNarration({
      interpretation: `A reversal of this outcome is ${wrongWord}.`,
    });
    const result = validateNarration(primary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'REVERSAL_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('omitted reversal claim → VALID', () => {
    expect(validateNarration(primary, baseNarration()).valid).toBe(true);
  });

  it('the engine\'s own phrasing ("reversal remains possible") is recognized', () => {
    // Grounded in diagnosis.ts's real rationale text, not an invented phrasing.
    const isPossible = primary.judgment.reversal === 'POSSIBLE';
    const narration = baseNarration({
      interpretation: isPossible
        ? 'A reversal remains possible given the retrograde influence.'
        : 'A reversal remains unlikely given the current alignment.',
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  Finding 5E-2 -- the ordinal/date collision fix                            */
/* -------------------------------------------------------------------------- */

describe('PHASE 5E-R — Finding 5E-2: ordinal/date collision fix', () => {
  it('"the 10th house" no longer triggers TIMING_FABRICATION', () => {
    const narration = baseNarration({
      interpretation: 'The matter is governed by the 10th house.',
    });
    const result = validateNarration(secondary, narration);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TIMING_FABRICATION')).toBe(false);
    }
  });

  it('"10th house" (no leading "the") — already never collided, still fine', () => {
    const narration = baseNarration({ interpretation: 'This concerns 10th house matters.' });
    const result = validateNarration(secondary, narration);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TIMING_FABRICATION')).toBe(false);
    }
  });

  it('"10th ghar" is also excluded from the date collision', () => {
    const narration = baseNarration({ interpretation: 'The 10th ghar plays a role here.' });
    const result = validateNarration(secondary, narration);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TIMING_FABRICATION')).toBe(false);
    }
  });

  it('multiple house references in one sentence are all excluded', () => {
    const narration = baseNarration({
      interpretation: 'Consider the 5th house and the 9th house together.',
    });
    const result = validateNarration(secondary, narration);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TIMING_FABRICATION')).toBe(false);
    }
  });

  it('a genuine bare-ordinal date reference is still caught (fix is narrow, not a disabling)', () => {
    const narration = baseNarration({ interpretation: 'Revisit this matter on the 21st.' });
    const result = validateNarration(secondary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TIMING_FABRICATION')).toBe(true);
    }
  });

  it('a genuine date containing a month name is still caught', () => {
    const narration = baseNarration({ interpretation: 'This will resolve on September 19th.' });
    const result = validateNarration(secondary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TIMING_FABRICATION')).toBe(true);
    }
  });

  it('a malformed but date-shaped string is still caught (unchanged, conservative existing behavior)', () => {
    const narration = baseNarration({ interpretation: 'Mark your calendar for 13/45/2026.' });
    const result = validateNarration(secondary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TIMING_FABRICATION')).toBe(true);
    }
  });

  it('KNOWN RESIDUAL, documented not fixed: an ordinal referring to neither a house nor a date is still a false positive', () => {
    // "the 3rd point" has nothing to do with houses or dates. The fix is
    // scoped exactly to the demonstrated house/ghar collision, not to
    // every non-date ordinal use -- see textSecurity/narrationValidator's
    // own comment on DATE_LIKE_PATTERN and PHASE_5E_R_HARDENING.md.
    const narration = baseNarration({ interpretation: 'Consider the 3rd point carefully.' });
    const result = validateNarration(secondary, narration);
    expect(result.valid).toBe(false); // still a false positive, unchanged from before this phase
  });
});
