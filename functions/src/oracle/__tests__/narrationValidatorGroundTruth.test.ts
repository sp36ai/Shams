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

/* -------------------------------------------------------------------------- */
/*  PHASE 5E-R2 -- false-positive collision fixes                             */
/*  (docs/audit/PHASE_5E_R_REVIEW_GATE.md Findings 5E-R-Review-1..4)          */
/* -------------------------------------------------------------------------- */

describe('PHASE 5E-R2 — ruler-relation: ordinary human-relationship prose stays VALID', () => {
  // `primary` (employment-001-equivalent): rulerRelation is 'Neutral'.
  it('"a colleague regards them as a friend" (no "ruler") stays VALID — the exact review reproduction', () => {
    const narration = baseNarration({
      interpretation: "The seeker's colleague regards them as a friend, which brings comfort.",
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('near-miss: "many regard them as a friend" (different verb form, no "ruler") stays VALID', () => {
    const narration = baseNarration({
      interpretation: "Many in the seeker's life regard them as a friend and confidant.",
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('near-miss: case variation ("REGARDS...AS A FRIEND", no "ruler") stays VALID', () => {
    const narration = baseNarration({
      interpretation: 'THE COLLEAGUE REGARDS THEM AS A FRIEND IN THIS MATTER.',
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('genuine claim: "the querent\'s ruler regards the matter\'s ruler as an enemy" (contradicts Neutral) still INVALID', () => {
    const narration = baseNarration({
      interpretation: "The querent's ruler regards the matter's ruler as an enemy.",
    });
    const result = validateNarration(primary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'RULER_RELATION_CONTRADICTION')).toBe(true);
    }
  });

  it('genuine claim with punctuation obfuscation ("rul.er") + "ruler" present still INVALID', () => {
    const narration = baseNarration({
      interpretation: "The querent's rul.er regards the matter's ruler as an enemy.",
    });
    expect(validateNarration(primary, narration).valid).toBe(false);
  });
});

describe('PHASE 5E-R2 — retrograde: non-astrological use of the word stays VALID', () => {
  // `secondary` (business-007-equivalent): not retrograde.
  it('"this situation feels retrograde" (no planet/ruler named) stays VALID — the exact review reproduction', () => {
    const narration = baseNarration({
      interpretation: 'This situation feels retrograde compared to last year.',
    });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('near-miss: "a retrograde approach" (no planet/ruler named) stays VALID', () => {
    const narration = baseNarration({
      interpretation: 'A retrograde approach will not help here.',
    });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('near-miss: case variation ("RETROGRADE", no planet/ruler) stays VALID', () => {
    const narration = baseNarration({
      interpretation: 'THIS FEELS RETROGRADE, NOT FORWARD-MOVING.',
    });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('genuine claim naming a planet directly ("Zuhal is retrograde") on a non-retrograde reading still INVALID', () => {
    const narration = baseNarration({
      interpretation: 'Zuhal is currently retrograde, which complicates this matter further.',
    });
    const result = validateNarration(secondary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'RETROGRADE_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('genuine claim using the engine\'s own "ruling planet" phrasing on a non-retrograde reading still INVALID', () => {
    const narration = baseNarration({
      interpretation: 'The ruling planet is retrograde in this matter.',
    });
    expect(validateNarration(secondary, narration).valid).toBe(false);
  });

  it('genuine claim naming a planet, on the GENUINELY retrograde reading (primary), still VALID (ground truth match, unaffected by this fix)', () => {
    const narration = baseNarration({
      interpretation: 'Zuhal is currently retrograde, which complicates this matter further.',
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });
});

describe('PHASE 5E-R2 — reversal: the "reversal of fortune" idiom stays VALID', () => {
  // `secondary` (business-007-equivalent): reversal is 'NONE'.
  it('"a reversal of fortune is possible" stays VALID — the exact review reproduction', () => {
    const narration = baseNarration({
      interpretation: 'A reversal of fortune is possible if effort continues.',
    });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('near-miss: "reversal of fortune" with "remains" instead of "is" stays VALID', () => {
    const narration = baseNarration({ interpretation: 'A reversal of fortune remains possible.' });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('near-miss: case variation ("REVERSAL OF FORTUNE") stays VALID', () => {
    const narration = baseNarration({ interpretation: 'A REVERSAL OF FORTUNE IS POSSIBLE HERE.' });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('genuine claim: "a reversal of this outcome is possible" (not the fortune idiom) still INVALID', () => {
    const narration = baseNarration({ interpretation: 'A reversal of this outcome is possible.' });
    const result = validateNarration(secondary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'REVERSAL_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('genuine claim: the engine\'s own bare phrasing ("reversal remains possible") still INVALID on a NONE reading', () => {
    const narration = baseNarration({ interpretation: 'A reversal remains possible here.' });
    expect(validateNarration(secondary, narration).valid).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  PHASE 5E-R3 -- reversal-of-fortune idiom, reordered ("Fortune's          */
/*  reversal"), docs/audit/PHASE_5E_R2_REVIEW.md Finding 5E-R2-Review-3      */
/* -------------------------------------------------------------------------- */

describe('PHASE 5E-R3 — reversal-of-fortune idiom family, both word orders, stays VALID', () => {
  // `secondary` (business-007-equivalent): reversal is 'NONE'.
  it('"reversal of fortune" (original order) stays VALID', () => {
    const narration = baseNarration({
      interpretation: 'A reversal of fortune is possible if effort continues.',
    });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('"Fortune\'s reversal" (reordered) stays VALID — the exact 5E-R2 review reproduction', () => {
    const narration = baseNarration({ interpretation: "Fortune's reversal is possible." });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('reordered form with "remains" instead of "is" stays VALID', () => {
    const narration = baseNarration({ interpretation: "Fortune's reversal remains possible." });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('capitalization variant (ALL CAPS, reordered) stays VALID', () => {
    const narration = baseNarration({ interpretation: "FORTUNE'S REVERSAL IS POSSIBLE." });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('capitalization variant (Title Case, original order) stays VALID', () => {
    const narration = baseNarration({ interpretation: 'A Reversal Of Fortune Is Possible.' });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('punctuation/whitespace variant (extra spacing, original order) stays VALID', () => {
    const narration = baseNarration({ interpretation: 'A reversal of  fortune  is possible.' });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('punctuation/whitespace variant (extra spacing, reordered) stays VALID', () => {
    const narration = baseNarration({ interpretation: "Fortune's  reversal  remains possible." });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('genuine contract-grounded claim: "a reversal of this outcome is possible" (no "fortune" anywhere) still INVALID', () => {
    const narration = baseNarration({ interpretation: 'A reversal of this outcome is possible.' });
    const result = validateNarration(secondary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'REVERSAL_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('genuine contract-grounded claim: the engine\'s own bare phrasing ("reversal remains possible") still INVALID', () => {
    const narration = baseNarration({ interpretation: 'A reversal remains possible here.' });
    expect(validateNarration(secondary, narration).valid).toBe(false);
  });

  it('genuine contract-grounded claim: "reversal is not possible" (no "fortune") still INVALID on a POSSIBLE reading', () => {
    const narration = baseNarration({
      interpretation: 'A reversal is not possible without real change.',
    });
    const result = validateNarration(primary, narration); // primary: reversal is 'POSSIBLE'
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'REVERSAL_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('ordinary non-reversal prose is unaffected (no "reversal" word at all)', () => {
    const narration = baseNarration({
      interpretation: 'This matter requires patience and careful reflection.',
    });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('"fortune" appearing far from "reversal" (outside the lookback window) does not suppress a genuine claim', () => {
    // "fortune" here is nowhere near "reversal" -- well past the bounded
    // lookback window -- so the genuine claim must still be caught.
    const narration = baseNarration({
      interpretation:
        'Speak plainly of fortune and fate first, then note separately: a reversal of this outcome is possible.',
    });
    const result = validateNarration(secondary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'REVERSAL_CLAIM_CONTRADICTION')).toBe(true);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  PHASE 5E-R4 -- word-boundary anchor on the "fortune" exclusion,          */
/*  docs/audit/PHASE_5E_R3_REVIEW.md's new P1 finding (the "misfortune"     */
/*  substring bypass)                                                       */
/* -------------------------------------------------------------------------- */

describe('PHASE 5E-R4 — the "fortune" exclusion no longer matches inside other words', () => {
  // `secondary` (business-007-equivalent): reversal is 'NONE'.
  it('FIXED: "misfortune" no longer suppresses a genuine reversal claim — the exact review reproduction', () => {
    const narration = baseNarration({
      interpretation: 'Despite past misfortune, a reversal of this outcome is possible.',
    });
    const result = validateNarration(secondary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'REVERSAL_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('FIXED: "misfortunes" (plural) no longer suppresses a genuine reversal claim', () => {
    const narration = baseNarration({
      interpretation: 'Despite recent misfortunes, a reversal of this outcome is possible.',
    });
    const result = validateNarration(secondary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'REVERSAL_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('"fortunate" (never actually contained "fortune" as a substring, but confirmed with a word-boundary anchor too) does not suppress a genuine claim', () => {
    const narration = baseNarration({
      interpretation: 'A fortunate turn aside, a reversal of this outcome is possible.',
    });
    const result = validateNarration(secondary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'REVERSAL_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('"fortunately" does not suppress a genuine claim', () => {
    const narration = baseNarration({
      interpretation: 'Fortunately, a reversal of this outcome is possible.',
    });
    const result = validateNarration(secondary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'REVERSAL_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('the idiom family itself is still recognized: "reversal of fortune" (original order) stays VALID', () => {
    const narration = baseNarration({
      interpretation: 'A reversal of fortune is possible if effort continues.',
    });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('the idiom family itself is still recognized: "Fortune\'s reversal" (reordered) stays VALID', () => {
    const narration = baseNarration({ interpretation: "Fortune's reversal is possible." });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('the idiom family itself is still recognized: capitalization variant stays VALID', () => {
    const narration = baseNarration({ interpretation: 'A REVERSAL OF FORTUNE IS POSSIBLE HERE.' });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('the idiom family itself is still recognized: whitespace variant stays VALID', () => {
    const narration = baseNarration({ interpretation: "Fortune's  reversal  remains possible." });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('the idiom family itself is still recognized: punctuation variant stays VALID', () => {
    const narration = baseNarration({ interpretation: "Fortune's, reversal is possible." });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('boundary: a genuine standalone "fortune" word 11 chars before the match still excludes (inside the 20-char window, unchanged from 5E-R3)', () => {
    const narration = baseNarration({
      interpretation: 'fortune yyyyyyyyyyy reversal is possible.',
    });
    expect(validateNarration(secondary, narration).valid).toBe(true);
  });

  it('boundary: a genuine standalone "fortune" word 12 chars before the match no longer excludes (outside the 20-char window, unchanged from 5E-R3)', () => {
    const narration = baseNarration({
      interpretation: 'fortune yyyyyyyyyyyy reversal is possible.',
    });
    const result = validateNarration(secondary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'REVERSAL_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('multiple standalone "fortune" occurrences do not accidentally suppress a genuine, unrelated claim', () => {
    const narration = baseNarration({
      interpretation:
        'Fortune favors the bold, fortune smiles on the patient, but a reversal of this outcome is possible regardless.',
    });
    const result = validateNarration(secondary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'REVERSAL_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('the previously-accepted residual (5E-R2-Review-4: ZWJ inside "fortune") remains unchanged, not fixed or worsened by this phase', () => {
    const narration = baseNarration({ interpretation: 'A reversal of fort‍une is possible here.' });
    // Documented residual: still INVALID (the ZWJ defeats the word-boundary
    // match on the raw-text fallback tier, same interaction
    // PHASE_5E_R2_REVIEW.md's Finding 5E-R2-Review-4 already recorded).
    expect(validateNarration(secondary, narration).valid).toBe(false);
  });
});

describe('PHASE 5E-R2 — direction: proper nouns containing a direction word stay VALID', () => {
  // `primary` (employment-001-equivalent): direction is 'South'.
  it('"points toward the North Star" stays VALID — the exact review reproduction', () => {
    const narration = baseNarration({
      interpretation:
        'The evidence points toward the North Star as a symbol of steadfastness, not an actual direction claim.',
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('near-miss: "points toward the South Pole" (a different proper noun, same shape) stays VALID even though the reading\'s own direction is South', () => {
    const narration = baseNarration({
      interpretation: 'The metaphor points toward the South Pole, a place of extremes.',
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('near-miss: case variation ("NORTH STAR") stays VALID', () => {
    const narration = baseNarration({
      interpretation: 'THE EVIDENCE POINTS TOWARD THE NORTH STAR AS A SYMBOL.',
    });
    expect(validateNarration(primary, narration).valid).toBe(true);
  });

  it('genuine claim: a bare direction word at the end of the clause still INVALID', () => {
    const narration = baseNarration({
      interpretation: "The matter's energy points toward the North.",
    });
    const result = validateNarration(primary, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'DIRECTION_CLAIM_CONTRADICTION')).toBe(true);
    }
  });

  it('genuine claim: a bare direction word followed by lowercase prose still INVALID', () => {
    const narration = baseNarration({
      interpretation: "The matter's energy points toward the north, quite clearly.",
    });
    expect(validateNarration(primary, narration).valid).toBe(false);
  });

  it('genuine claim: a bare direction word followed by a comma still INVALID', () => {
    const narration = baseNarration({
      interpretation: "The matter's energy points toward the North, unmistakably.",
    });
    expect(validateNarration(primary, narration).valid).toBe(false);
  });
});
