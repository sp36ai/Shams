/**
 * PHASE 4A — surgical hardening regression tests.
 * --------------------------------------------------------------------------
 * Covers exactly the bypasses demonstrated in docs/audit/PHASE_4_REVIEW_GATE.md
 * plus the required accept/reject matrix from the Phase 4A brief. Kept as a
 * separate file from narrationValidator.test.ts so the Phase 4A diff is
 * self-contained and this file's own history documents what changed and why
 * — narrationValidator.test.ts itself was not rewritten.
 */

import { describe, it, expect } from 'vitest';

import {
  checkTimingConsistency,
  checkUnsupportedCertainty,
  checkTerminologyLeakage,
  checkCelestialEntities,
} from '../narrationValidator';
import type { ReadingContract } from '../readingContract';

const WAIT_CONTRACT = {
  diagnosis: {
    outcome: 'UNFAVOURABLE',
    timing: { minDays: 45, maxDays: 90 },
    timingPosture: 'WAIT',
    confidence: 0.9,
    obstructingAgent: null,
  },
} as unknown as ReadingContract;

describe('PHASE 4A — timing: the demonstrated "tomorrow" bypass and required matrix', () => {
  it('MUST REJECT: "This will resolve tomorrow."', () => {
    const r = checkTimingConsistency(
      WAIT_CONTRACT,
      'recommended_approach',
      'This will resolve tomorrow.',
    );
    expect(r?.code).toBe('TIMING_ALTERATION');
  });

  it('MUST REJECT: "You will definitely see the result this week."', () => {
    const r = checkTimingConsistency(
      WAIT_CONTRACT,
      'recommended_approach',
      'You will definitely see the result this week.',
    );
    expect(r?.code).toBe('TIMING_ALTERATION');
  });

  it('MUST REJECT (materially inconsistent): "Immediate resolution is indicated."', () => {
    const r = checkTimingConsistency(
      WAIT_CONTRACT,
      'recommended_approach',
      'Immediate resolution is indicated.',
    );
    expect(r?.code).toBe('TIMING_ALTERATION');
  });

  it('SHOULD ACCEPT: "Do not rush the matter; the indicated period is later."', () => {
    const r = checkTimingConsistency(
      WAIT_CONTRACT,
      'recommended_approach',
      'Do not rush the matter; the indicated period is later.',
    );
    expect(r).toBeNull();
  });

  it('SHOULD ACCEPT: "Movement may begin before the final outcome." (also regression-guards the "may"/"May" month-name collision found while verifying this fix)', () => {
    const r = checkTimingConsistency(
      WAIT_CONTRACT,
      'recommended_approach',
      'Movement may begin before the final outcome.',
    );
    expect(r).toBeNull();
  });

  it('SHOULD ACCEPT: hedged "soon" alongside the correct settled period', () => {
    const r = checkTimingConsistency(
      WAIT_CONTRACT,
      'recommended_approach',
      'The matter may begin moving soon, but the final outcome remains within the indicated period.',
    );
    expect(r).toBeNull();
  });

  it('MUST REJECT: unhedged "soon" with no qualifying language', () => {
    const r = checkTimingConsistency(
      WAIT_CONTRACT,
      'recommended_approach',
      'This will resolve soon.',
    );
    expect(r?.code).toBe('TIMING_ALTERATION');
  });

  it('MUST REJECT: "right away"', () => {
    const r = checkTimingConsistency(
      WAIT_CONTRACT,
      'recommended_approach',
      'Expect this right away.',
    );
    expect(r?.code).toBe('TIMING_ALTERATION');
  });

  it('MUST REJECT: unhedged "shortly"', () => {
    const r = checkTimingConsistency(
      WAIT_CONTRACT,
      'recommended_approach',
      'This resolves shortly.',
    );
    expect(r?.code).toBe('TIMING_ALTERATION');
  });

  it('MUST REJECT: "today"', () => {
    const r = checkTimingConsistency(WAIT_CONTRACT, 'recommended_approach', 'Expect this today.');
    expect(r?.code).toBe('TIMING_ALTERATION');
  });
});

describe('PHASE 4A — exact-date fabrication regression (must still all be caught)', () => {
  const cases: Array<[string, string]> = [
    ['numeric date', 'Expect it on 9/19.'],
    ['ISO date', 'Expect it on 2026-09-19.'],
    ['month + day', 'September 19 is the exact day.'],
    ['day + "of" + month', 'Expect it on the 19th of May.'],
    ['next weekday', 'Expect it next Monday.'],
  ];
  for (const [label, text] of cases) {
    it(`MUST REJECT: ${label} ("${text}")`, () => {
      const r = checkTimingConsistency(WAIT_CONTRACT, 'recommended_approach', text);
      expect(r?.code).toBe('TIMING_FABRICATION');
    });
  }

  it('MUST NOT REJECT: a bare month reference with no day number ("since September the matter has waited")', () => {
    const r = checkTimingConsistency(
      WAIT_CONTRACT,
      'recommended_approach',
      'Since September the matter has waited.',
    );
    expect(r).toBeNull();
  });

  it('relative-day fabrication ("in 3 days") is still caught as an out-of-range day count', () => {
    const r = checkTimingConsistency(WAIT_CONTRACT, 'recommended_approach', 'Expect it in 3 days.');
    expect(r?.code).toBe('TIMING_ALTERATION');
  });
});

describe('PHASE 4A — certainty: word-order regression', () => {
  const LOW_CONF = {
    diagnosis: { outcome: 'UNCERTAIN', confidence: 0.2 },
  } as unknown as ReadingContract;

  it('"will definitely" (the demonstrated gap)', () => {
    const r = checkUnsupportedCertainty(LOW_CONF, 'interpretation', 'It will definitely resolve.');
    expect(r?.code).toBe('UNSUPPORTED_CERTAINTY');
  });

  it('"definitely will" (already worked, regression-guarded)', () => {
    const r = checkUnsupportedCertainty(LOW_CONF, 'interpretation', 'It definitely will resolve.');
    expect(r?.code).toBe('UNSUPPORTED_CERTAINTY');
  });

  it('"will certainly"', () => {
    const r = checkUnsupportedCertainty(LOW_CONF, 'interpretation', 'It will certainly resolve.');
    expect(r?.code).toBe('UNSUPPORTED_CERTAINTY');
  });

  it('"guaranteed" (regression-guarded)', () => {
    const r = checkUnsupportedCertainty(LOW_CONF, 'interpretation', 'This is guaranteed.');
    expect(r?.code).toBe('UNSUPPORTED_CERTAINTY');
  });

  it('"may" is not flagged', () => {
    expect(checkUnsupportedCertainty(LOW_CONF, 'interpretation', 'It may resolve.')).toBeNull();
  });

  it('"likely" is not flagged', () => {
    expect(
      checkUnsupportedCertainty(LOW_CONF, 'interpretation', 'It is likely to resolve.'),
    ).toBeNull();
  });

  it('conditional wording is not flagged', () => {
    expect(
      checkUnsupportedCertainty(
        LOW_CONF,
        'interpretation',
        'It could go either way, depending on effort.',
      ),
    ).toBeNull();
  });
});

describe('PHASE 4A — terminology: obfuscation regression', () => {
  const cases: Array<[string, string]> = [
    ['bare uppercase', 'this uses RKP internally.'],
    ['dotted', 'this uses R.K.P. internally.'],
    ['dotted lowercase', 'this uses r.k.p. internally.'],
    ['hyphenated', 'this uses R-K-P internally.'],
    ['spaced', 'this uses R K P internally.'],
  ];
  for (const [label, text] of cases) {
    it(`MUST REJECT: ${label} ("${text}")`, () => {
      const r = checkTerminologyLeakage('interpretation', text);
      expect(r?.code).toBe('TERMINOLOGY_LEAKAGE');
    });
  }

  it('does not false-positive on ordinary prose with no obfuscated term', () => {
    expect(
      checkTerminologyLeakage('interpretation', 'The reading rests on a river of quiet light.'),
    ).toBeNull();
  });

  it('does not false-positive on a plausible word-boundary collision ("her keen partner")', () => {
    expect(
      checkTerminologyLeakage('interpretation', 'Her keen partner waits with patience.'),
    ).toBeNull();
  });
});

describe('PHASE 4A — celestial transliteration: investigated, no repository evidence, no change made', () => {
  it('documents that "Zohal" (an unattested alternate spelling) is not recognized as an alias of "Zuhal" — deliberate, not an oversight (see PHASE_4A_HARDENING.md)', () => {
    const contract = {
      celestialEntities: ['Venus', 'Mars'],
      remedy: { steps: [] },
    } as unknown as ReadingContract;
    // Zuhal (canonical) is correctly caught when disallowed:
    expect(
      checkCelestialEntities(contract, 'interpretation', 'Zuhal weighs on this matter.')?.code,
    ).toBe('UNAUTHORIZED_CELESTIAL_ENTITY');
    // "Zohal" is a spelling with zero precedent anywhere in this repository
    // (grep-confirmed) — not added as an alias, per "do not invent aliases
    // without repository evidence." The existing prompt-level defense
    // (Claude is instructed to use only the exact name given in the brief)
    // is the mitigation for this specific gap, not a code change here.
    expect(
      checkCelestialEntities(contract, 'interpretation', 'Zohal weighs on this matter.'),
    ).toBeNull();
  });
});
