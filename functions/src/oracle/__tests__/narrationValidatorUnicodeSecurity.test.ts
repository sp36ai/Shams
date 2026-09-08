/**
 * PHASE 5C-R — permanent regression coverage for the Unicode/obfuscation
 * validator-bypass remediation.
 * --------------------------------------------------------------------------
 * Covers exactly what Phase 5C-R was authorized to fix: the four
 * demonstrated P5C bypass classes (timing, certainty, terminology,
 * celestial entities), the symmetric-diacritic remedy-name correctness
 * case the fix's own design required, and a dedicated non-mutation proof.
 *
 * This is deliberately a compact, hand-selected set — not a replay of all
 * 11,923 generated cases (that full-scale, generative/metamorphic
 * exploration lives in functions/scripts/adversarial-harness/, re-runnable
 * via `npx vite-node scripts/adversarial-harness/run.ts`, the same
 * two-tier pattern this codebase already uses for the golden corpus:
 * a small permanent vitest suite plus a larger standalone script for full
 * combinatorial verification).
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
import { canonicalizeForSecurityMatching } from '../textSecurity';
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

/** Real, engine-produced BLOCKED/WAIT contract — same shape as adversarialNarration.test.ts's PRIMARY. */
function waitContract(): ReadingContract {
  return contractFor('2026-08-15T11:30:00+05:00', 'Will my new business succeed?', 'r-5cr-wait');
}

/** Real, engine-produced UNCERTAIN/low-confidence contract — exercises checkUnsupportedCertainty. */
function uncertainContract(): ReadingContract {
  return contractFor(
    '2026-08-15T05:00:00+05:30',
    'Will I pass my upcoming exam?',
    'r-5cr-uncertain',
  );
}

function baseNarration(overrides: Partial<NarrationFields> = {}): NarrationFields {
  return {
    rkp_finding: 'The chart shows an obstruction to this matter.',
    interpretation: 'This is a matter still finding its shape.',
    recommended_approach: 'Patience is the counsel here.',
    why_this_remedy: null,
    signature: 'The path is not yet clear.',
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/*  Unit tests for the primitive itself                                       */
/* -------------------------------------------------------------------------- */

describe('canonicalizeForSecurityMatching', () => {
  it('is a no-op on plain ASCII prose', () => {
    const s = 'This will resolve within the settled period.';
    expect(canonicalizeForSecurityMatching(s)).toBe(s);
  });

  it('strips a zero-width joiner inserted inside a word', () => {
    expect(canonicalizeForSecurityMatching('tom‍orrow')).toBe('tomorrow');
  });

  it('strips a zero-width non-joiner inserted inside a word', () => {
    expect(canonicalizeForSecurityMatching('guar‌anteed')).toBe('guaranteed');
  });

  it('strips a zero-width space inserted inside a word', () => {
    expect(canonicalizeForSecurityMatching('Krishn​amurti')).toBe('Krishnamurti');
  });

  it('strips a word joiner (U+2060)', () => {
    expect(canonicalizeForSecurityMatching('tom⁠orrow')).toBe('tomorrow');
  });

  it('strips a bidi control character (LRM, U+200E)', () => {
    expect(canonicalizeForSecurityMatching('tom‎orrow')).toBe('tomorrow');
  });

  it('strips a variation selector (U+FE0F)', () => {
    expect(canonicalizeForSecurityMatching('guarant️eed')).toBe('guaranteed');
  });

  it('reduces fullwidth Latin forms to their ASCII equivalents', () => {
    expect(canonicalizeForSecurityMatching('Zuhrａh')).toBe('Zuhrah');
  });

  it('strips a decomposed combining mark (base + U+0301)', () => {
    expect(canonicalizeForSecurityMatching('gu' + 'á' + 'ranteed')).toBe('guaranteed');
  });

  it('strips diacritics from an already-precomposed character the same as a decomposed one', () => {
    // "á" U+00E1, single codepoint -- proves NFKD-before-strip ordering,
    // not merely "strip Mn," is what makes this work (see textSecurity.ts's
    // own header for why composing first would miss this).
    expect(canonicalizeForSecurityMatching('guáranteed')).toBe('guaranteed');
  });

  it('collapses a double space to one', () => {
    expect(canonicalizeForSecurityMatching('house  matrix')).toBe('house matrix');
  });

  it('collapses a tab to a space', () => {
    expect(canonicalizeForSecurityMatching('house\tmatrix')).toBe('house matrix');
  });

  it('does NOT fold a homoglyph/confusable to its Latin look-alike (explicitly out of scope)', () => {
    // Cyrillic о (U+043E) is not touched -- this function's own header
    // documents this is a deliberate boundary, not an oversight.
    const withCyrillic = 'tomоrrow';
    expect(canonicalizeForSecurityMatching(withCyrillic)).toBe(withCyrillic);
  });

  it('is idempotent', () => {
    const once = canonicalizeForSecurityMatching('tom‍orrow  house\tmatrix');
    expect(canonicalizeForSecurityMatching(once)).toBe(once);
  });
});

/* -------------------------------------------------------------------------- */
/*  The four original P5C bypasses, permanently regressed                     */
/* -------------------------------------------------------------------------- */

describe('PHASE 5C-R — the four original P5C bypass strings, through the real validateNarration() path', () => {
  it('P5C-1 (timing): "tom‍orrow" on a WAIT contract is now caught', () => {
    const contract = waitContract();
    expect(
      contract.diagnosis.timingPosture === 'WAIT' ||
        contract.diagnosis.timingPosture === 'WAIT_LONG',
    ).toBe(true);
    const narration = baseNarration({ interpretation: 'This will resolve tom‍orrow.' });
    const result = validateNarration(contract, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TIMING_ALTERATION')).toBe(true);
    }
  });

  it('P5C-2 (certainty): "guar‌anteed" on a low-confidence/neutral contract is now caught', () => {
    const contract = uncertainContract();
    expect(contract.diagnosis.outcome).toBe('UNCERTAIN');
    const narration = baseNarration({ interpretation: 'This is guar‌anteed.' });
    const result = validateNarration(contract, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'UNSUPPORTED_CERTAINTY')).toBe(true);
    }
  });

  it('P5C-3 (terminology): "Krishn​amurti" is now caught', () => {
    const contract = waitContract();
    const narration = baseNarration({
      interpretation: 'This finding comes from Krishn​amurti directly.',
    });
    const result = validateNarration(contract, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TERMINOLOGY_LEAKAGE')).toBe(true);
    }
  });

  it('P5C-3b (terminology, multi-word gap): "house  matrix" (double space) is now caught', () => {
    const contract = waitContract();
    const narration = baseNarration({
      interpretation: 'This comes from the house  matrix directly.',
    });
    const result = validateNarration(contract, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TERMINOLOGY_LEAKAGE')).toBe(true);
    }
  });

  it('P5C-4 (celestial entities): "Mush‍tari" is now caught', () => {
    const contract = waitContract();
    // Confirm the precondition rather than assume it: this reading's
    // allow-list — WIDENED to include any planet named inside this
    // reading's own selected remedy steps, per checkCelestialEntities's
    // own documented behavior — must NOT already permit Mushtari/Jupiter,
    // or the case below would prove nothing. (An earlier draft of this
    // test picked "Zuhal," which turned out to be exactly such a
    // remedy-widened exception for this specific contract — caught by
    // this same precondition check before it could hide a false pass.)
    expect(contract.celestialEntities).not.toContain('Mushtari');
    expect(contract.celestialEntities).not.toContain('Jupiter');
    expect(contract.remedy.steps.some(s => s.name.includes('Mushtari'))).toBe(false);
    const narration = baseNarration({
      interpretation: 'Mush‍tari weighs heavily on this matter.',
    });
    const result = validateNarration(contract, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'UNAUTHORIZED_CELESTIAL_ENTITY')).toBe(true);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Expanded metamorphic table — one security phrase, many transformations    */
/* -------------------------------------------------------------------------- */

describe('PHASE 5C-R — expanded metamorphic coverage per mutation category', () => {
  const mutate = {
    original: (w: string) => w,
    upper: (w: string) => w.toUpperCase(),
    zeroWidthJoiner: (w: string) => {
      const mid = Math.floor(w.length / 2);
      return w.slice(0, mid) + '‍' + w.slice(mid);
    },
    zeroWidthNonJoiner: (w: string) => {
      const mid = Math.floor(w.length / 2);
      return w.slice(0, mid) + '‌' + w.slice(mid);
    },
    zeroWidthSpace: (w: string) => {
      const mid = Math.floor(w.length / 2);
      return w.slice(0, mid) + '​' + w.slice(mid);
    },
    wordJoiner: (w: string) => {
      const mid = Math.floor(w.length / 2);
      return w.slice(0, mid) + '⁠' + w.slice(mid);
    },
    bidiControl: (w: string) => {
      const mid = Math.floor(w.length / 2);
      return w.slice(0, mid) + '‎' + w.slice(mid);
    },
    variationSelector: (w: string) => {
      const mid = Math.floor(w.length / 2);
      return w.slice(0, mid) + '️' + w.slice(mid);
    },
    combiningMark: (w: string) => w.replace(/[aeiou]/g, ch => ch + '́'),
    precomposedAccent: (w: string) =>
      w.replace(/[aeiou]/g, ch => ({ a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' })[ch] ?? ch),
  };

  const timingContract = waitContract();
  for (const [name, fn] of Object.entries(mutate)) {
    it(`timing: "tomorrow" -> ${name} -> still caught`, () => {
      const narration = baseNarration({ interpretation: `This will resolve ${fn('tomorrow')}.` });
      const result = validateNarration(timingContract, narration);
      expect(result.valid).toBe(false);
    });
  }

  const certaintyContract = uncertainContract();
  for (const [name, fn] of Object.entries(mutate)) {
    it(`certainty: "guaranteed" -> ${name} -> still caught`, () => {
      const narration = baseNarration({ interpretation: `This is ${fn('guaranteed')}.` });
      const result = validateNarration(certaintyContract, narration);
      expect(result.valid).toBe(false);
    });
  }

  for (const [name, fn] of Object.entries(mutate)) {
    it(`terminology: "RKP" -> ${name} -> still caught`, () => {
      const narration = baseNarration({ interpretation: `This uses ${fn('RKP')} internally.` });
      const result = validateNarration(timingContract, narration);
      expect(result.valid).toBe(false);
    });
  }
});

/* -------------------------------------------------------------------------- */
/*  Symmetric-diacritic remedy-name regression                                */
/* -------------------------------------------------------------------------- */

describe('PHASE 5C-R — symmetric canonicalization does not break or over-widen diacritic remedy-name matching', () => {
  function remedyStep(id: string, name: string): ReadingContract['remedy']['steps'][number] {
    return {
      id,
      name,
      category: 'devotional',
      evidenceType: 'traditional',
      intensity: 'moderate',
      duration: null,
      explanation: 'x',
      instructions: [],
      isEscalation: false,
      reason: 'x',
    };
  }

  function contractWithSelectedRemedy(id: string, name: string): ReadingContract {
    const base = waitContract();
    return {
      ...base,
      remedy: {
        ...base.remedy,
        interventionRequired: true,
        steps: [remedyStep(id, name)],
      },
    };
  }

  const SELECTED_ID = 'devotional_istikhara';
  const SELECTED_NAME = 'Ṣalāt al-Istikhārah';
  const UNSELECTED_NAME = 'Duʿā for Ease';

  it('mentioning the SELECTED diacritic remedy, clean, stays VALID', () => {
    const contract = contractWithSelectedRemedy(SELECTED_ID, SELECTED_NAME);
    const narration = baseNarration({
      why_this_remedy: `${SELECTED_NAME} is offered because the matter calls for patient surrender.`,
    });
    const result = validateNarration(contract, narration);
    expect(result.valid).toBe(true);
  });

  it('mentioning the SELECTED diacritic remedy, Unicode-decomposed, stays VALID', () => {
    const contract = contractWithSelectedRemedy(SELECTED_ID, SELECTED_NAME);
    // Decompose the name's own diacritics into base+combining-mark form —
    // the "security-canonical equivalent" the acceptance gate asks for.
    const decomposedName = SELECTED_NAME.normalize('NFD');
    const narration = baseNarration({
      why_this_remedy: `${decomposedName} is offered because the matter calls for patient surrender.`,
    });
    const result = validateNarration(contract, narration);
    expect(result.valid).toBe(true);
  });

  it('mentioning a DIFFERENT, unselected diacritic remedy, clean, is caught (REMEDY_SUBSTITUTION/ADDITION)', () => {
    const contract = contractWithSelectedRemedy(SELECTED_ID, SELECTED_NAME);
    const narration = baseNarration({
      recommended_approach: `Consider instead ${UNSELECTED_NAME}.`,
    });
    const result = validateNarration(contract, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.failures.some(f => f.code === 'REMEDY_SUBSTITUTION' || f.code === 'REMEDY_ADDITION'),
      ).toBe(true);
    }
  });

  it('mentioning a DIFFERENT, unselected diacritic remedy, Unicode-decomposed, is STILL caught — proves the symmetric fix does not create a new bypass', () => {
    const contract = contractWithSelectedRemedy(SELECTED_ID, SELECTED_NAME);
    const decomposedUnselected = UNSELECTED_NAME.normalize('NFD');
    const narration = baseNarration({
      recommended_approach: `Consider instead ${decomposedUnselected}.`,
    });
    const result = validateNarration(contract, narration);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.failures.some(f => f.code === 'REMEDY_SUBSTITUTION' || f.code === 'REMEDY_ADDITION'),
      ).toBe(true);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Non-mutation proof                                                        */
/* -------------------------------------------------------------------------- */

describe('PHASE 5C-R — canonicalization never mutates its inputs', () => {
  it('the narration object passed in is byte-identical (deep) before and after validateNarration()', () => {
    const contract = waitContract();
    const narration = baseNarration({
      interpretation: 'This will resolve tom‍orrow, guar‌anteed, per Krishn​amurti.',
    });
    const before = JSON.stringify(narration);
    validateNarration(contract, narration);
    const after = JSON.stringify(narration);
    expect(after).toBe(before);
  });

  it('the ReadingContract passed in is byte-identical (deep) before and after validateNarration(), across a VALID case', () => {
    const contract = waitContract();
    const before = JSON.stringify(contract);
    const narration = baseNarration();
    const result = validateNarration(contract, narration);
    const after = JSON.stringify(contract);
    expect(after).toBe(before);
    expect(result.valid).toBe(true);
  });

  it('the ReadingContract passed in is byte-identical (deep) before and after validateNarration(), across an INVALID/obfuscated case', () => {
    const contract = waitContract();
    const before = JSON.stringify(contract);
    const narration = baseNarration({ interpretation: 'This will resolve tom‍orrow.' });
    const result = validateNarration(contract, narration);
    const after = JSON.stringify(contract);
    expect(after).toBe(before);
    expect(result.valid).toBe(false);
  });

  it('the contract remains frozen (Object.isFrozen) after validation, at every level touched by the checks', () => {
    const contract = waitContract();
    const narration = baseNarration({ interpretation: 'This will resolve tom‍orrow.' });
    validateNarration(contract, narration);
    expect(Object.isFrozen(contract)).toBe(true);
    expect(Object.isFrozen(contract.diagnosis)).toBe(true);
    expect(Object.isFrozen(contract.remedy)).toBe(true);
    expect(Object.isFrozen(contract.celestialEntities)).toBe(true);
  });
});
