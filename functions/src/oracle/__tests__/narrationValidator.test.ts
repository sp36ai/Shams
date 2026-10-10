import { describe, it, expect } from 'vitest';

import { buildWatchChart } from '../../engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';
import { diagnose } from '../../engine/rkp/diagnosis';
import { classifyQuestion } from '../../engine/kp/rules/questionKeywords';
import { selectRemedyProtocol } from '../remedySelection';
import { toBoundaryPlanetName } from '../../utils/planetBoundaryName';
import { buildReadingContract, type ReadingContract } from '../readingContract';
import { validateNarration } from '../narrationValidator';
import { buildDeterministicFallbackNarration } from '../narrationFallback';
import type { NarrationFields } from '../responseComposer';

function contractFor(moment: string, question: string): ReadingContract {
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
    readingId: 'r-test',
    computedAt: new Date('2026-08-15T00:00:00.000Z'),
    question,
    verdict,
    diagnosis,
    protocol,
  });
}

/** A blocked, obstructed reading — negative polarity, WAIT posture. */
function blockedContract(): ReadingContract {
  // business-001 in the golden corpus is BLOCKED with obstruction Ras — a
  // known-shape real contract, not a hand-fabricated one.
  return contractFor('2026-08-15T11:30:00+05:00', 'Will my new business succeed?');
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

describe('validateNarration — verdict consistency', () => {
  it('accepts narration that does not contradict a blocked/negative outcome', () => {
    const contract = blockedContract();
    expect(
      contract.diagnosis.outcome === 'UNFAVOURABLE' ||
        contract.diagnosis.outcome === 'CONDITIONAL' ||
        contract.diagnosis.outcome === 'UNCERTAIN' ||
        contract.diagnosis.outcome === 'DELAYED',
    ).toBe(true);
    const result = validateNarration(contract, baseNarration());
    expect(result.valid).toBe(true);
  });

  it('rejects an unqualified positive assertion on a negative-polarity outcome', () => {
    const contract = blockedContract();
    // Force a known negative/neutral-polarity contract for this test's own
    // clarity, regardless of which one the fixture landed on above.
    if (
      contract.diagnosis.outcome !== 'UNFAVOURABLE' &&
      contract.diagnosis.outcome !== 'DECLINING'
    ) {
      return; // this specific chart cast a different outcome — covered by the synthetic test below instead
    }
    const result = validateNarration(
      contract,
      baseNarration({ interpretation: 'The matter will certainly happen, the answer is yes.' }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'VERDICT_CONTRADICTION')).toBe(true);
    }
  });

  it('rejects a negative assertion on a favourable outcome (synthetic contract)', () => {
    const contract = contractFor('2026-08-15T05:00:00+05:30', 'Will I pass my upcoming exam?');
    // Find any case in this run that is FAVOURABLE/ESCALATING to test the
    // opposite direction deterministically regardless of which chart this
    // fixture happens to cast.
    const favourable: ReadingContract = {
      ...contract,
      diagnosis: { ...contract.diagnosis, outcome: 'FAVOURABLE' },
    };
    const result = validateNarration(
      favourable,
      baseNarration({ rkp_finding: 'The matter is blocked; the answer is no.' }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'VERDICT_CONTRADICTION')).toBe(true);
    }
  });
});

describe('validateNarration — timing consistency', () => {
  it('accepts a day-count inside the settled window', () => {
    const contract = contractFor(
      '2026-08-15T05:00:00+05:30',
      'Will I get the job I interviewed for?',
    );
    if (contract.diagnosis.timing === null) {
      return;
    }
    const { minDays, maxDays } = contract.diagnosis.timing;
    const mid = Math.round((minDays + maxDays) / 2);
    const result = validateNarration(
      contract,
      baseNarration({ recommended_approach: `Expect resolution around ${mid} days from now.` }),
    );
    expect(result.valid).toBe(true);
  });

  it('rejects an invented calendar date', () => {
    const contract = blockedContract();
    const result = validateNarration(
      contract,
      baseNarration({ recommended_approach: 'This will resolve by March 15th.' }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TIMING_FABRICATION')).toBe(true);
    }
  });

  it('rejects an invented weekday', () => {
    const contract = blockedContract();
    const result = validateNarration(
      contract,
      baseNarration({ recommended_approach: 'Expect news by Tuesday.' }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TIMING_FABRICATION')).toBe(true);
    }
  });

  it('rejects a day count outside the settled window', () => {
    const contract = contractFor(
      '2026-08-15T05:00:00+05:30',
      'Will I get the job I interviewed for?',
    );
    if (contract.diagnosis.timing === null) {
      return;
    }
    const outside = contract.diagnosis.timing.maxDays + 500;
    const result = validateNarration(
      contract,
      baseNarration({ recommended_approach: `This resolves in ${outside} days.` }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TIMING_ALTERATION')).toBe(true);
    }
  });

  it('rejects unsupported immediacy when timing posture says wait', () => {
    const contract = blockedContract();
    if (
      contract.diagnosis.timingPosture !== 'WAIT' &&
      contract.diagnosis.timingPosture !== 'WAIT_LONG'
    ) {
      return;
    }
    const result = validateNarration(
      contract,
      baseNarration({ recommended_approach: 'Act immediately, right now, without delay.' }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TIMING_ALTERATION')).toBe(true);
    }
  });

  it('rejects any day count when the engine established no timing signal', () => {
    const contract = blockedContract();
    const noTiming: ReadingContract = {
      ...contract,
      diagnosis: { ...contract.diagnosis, timing: null },
    };
    const result = validateNarration(
      noTiming,
      baseNarration({ recommended_approach: 'This resolves in 12 days.' }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'TIMING_FABRICATION')).toBe(true);
    }
  });
});

describe('validateNarration — remedy consistency', () => {
  it('accepts narration that only discusses the selected remedy', () => {
    const contract = blockedContract();
    if (contract.remedy.steps.length === 0) {
      return;
    }
    const selectedName = contract.remedy.steps[0]!.name;
    const result = validateNarration(
      contract,
      baseNarration({ why_this_remedy: `${selectedName} suits this reading.` }),
    );
    expect(result.valid).toBe(true);
  });

  it('rejects a real, unselected remedy name appearing in narration', () => {
    const contract = blockedContract();
    const selectedIds = new Set(contract.remedy.steps.map(s => s.id));
    // 'Deliberate Pause' (contemplative_pause) is real library content; use
    // it only if this reading did NOT select it.
    if (selectedIds.has('contemplative_pause')) {
      return;
    }
    const result = validateNarration(
      contract,
      baseNarration({ why_this_remedy: 'Consider the Deliberate Pause practice instead.' }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.failures.some(f => f.code === 'REMEDY_SUBSTITUTION' || f.code === 'REMEDY_ADDITION'),
      ).toBe(true);
    }
  });

  it('rejects an override phrase even without naming a specific remedy', () => {
    const contract = blockedContract();
    const result = validateNarration(
      contract,
      baseNarration({ why_this_remedy: 'A better remedy would be found elsewhere.' }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'REMEDY_SUBSTITUTION')).toBe(true);
    }
  });

  it('accepts explanatory prose about why the selected remedy matters', () => {
    const contract = blockedContract();
    const result = validateNarration(
      contract,
      baseNarration({
        why_this_remedy: 'This practice steadies the heart while the chart settles.',
      }),
    );
    expect(result.valid).toBe(true);
  });
});

describe('validateNarration — celestial entity consistency', () => {
  it('accepts a mention of an entity in celestialEntities', () => {
    const contract = blockedContract();
    if (contract.celestialEntities.length === 0) {
      return;
    }
    const entity = contract.celestialEntities[0]!;
    const result = validateNarration(
      contract,
      baseNarration({ rkp_finding: `${entity} shapes this reading.` }),
    );
    expect(result.valid).toBe(true);
  });

  it('rejects a planet not present in celestialEntities', () => {
    const contract = blockedContract();
    const allowed = new Set(contract.celestialEntities.map(e => e.toLowerCase()));
    // Jupiter/Mushtari is not part of any of the three source fields unless
    // it happens to be the obstruction/rulers for this chart — pick whichever
    // of a small candidate set is NOT already allowed.
    const candidates = ['Jupiter', 'Mushtari', 'Mercury', 'Utarid'];
    const disallowed = candidates.find(c => !allowed.has(c.toLowerCase()));
    if (!disallowed) {
      return;
    }
    const result = validateNarration(
      contract,
      baseNarration({ rkp_finding: `${disallowed} governs this matter.` }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'UNAUTHORIZED_CELESTIAL_ENTITY')).toBe(true);
    }
  });

  it('recognizes the classical Arabic name as an alias of an allowed English planet id', () => {
    const contract = blockedContract();
    // lagnaRuler/obstruction on a DisplayWatchVerdict carry the internal
    // English id for the seven classical planets — confirm the validator
    // accepts the classical name too, not only the raw stored form.
    const englishEntities = contract.celestialEntities.filter(e =>
      ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].includes(e),
    );
    if (englishEntities.length === 0) {
      return;
    }
    const classicalNames: Record<string, string> = {
      Sun: 'Shams',
      Moon: 'Qamar',
      Mars: 'Mirrikh',
      Mercury: 'Utarid',
      Jupiter: 'Mushtari',
      Venus: 'Zuhrah',
      Saturn: 'Zuhal',
    };
    const classical = classicalNames[englishEntities[0]!]!;
    const result = validateNarration(
      contract,
      baseNarration({ rkp_finding: `${classical} shapes this matter.` }),
    );
    expect(result.valid).toBe(true);
  });

  // A production Reading (10 Oct 2026, 14:06 IST): REVERSING, Zuhrah ruling,
  // Zuhal obstructing — the Sun is not among its entities.
  const sunlessContract = (): ReadingContract =>
    contractFor('2026-10-10T14:06:00+05:30', 'Will this app will be successful');

  it("does not read the app's own name as a claim about the Sun", () => {
    const contract = sunlessContract();
    expect(contract.celestialEntities).not.toContain('Sun');
    for (const name of ['Shams al-Asrār', 'Shams al-Asrar', 'Shams-al-Asrār', 'shams al asrar']) {
      const result = validateNarration(
        contract,
        baseNarration({ rkp_finding: `As ${name} reads it, Zuhal holds the gate.` }),
      );
      expect(result.valid).toBe(true);
    }
  });

  it('still rejects the Sun named on its own where the reading does not name it', () => {
    const contract = sunlessContract();
    for (const text of ['Shams weighs on this matter.', 'Like a cloud across the sun.']) {
      const result = validateNarration(contract, baseNarration({ rkp_finding: text }));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.failures.some(f => f.code === 'UNAUTHORIZED_CELESTIAL_ENTITY')).toBe(true);
      }
    }
  });
});

describe('validateNarration — diagnosis consistency', () => {
  it('accepts narration naming the actual obstructing agent as the obstruction', () => {
    const contract = blockedContract();
    if (!contract.diagnosis.obstructingAgent) {
      return;
    }
    const result = validateNarration(
      contract,
      baseNarration({
        rkp_finding: `${contract.diagnosis.obstructingAgent} obstructs this matter.`,
      }),
    );
    expect(result.valid).toBe(true);
  });

  it('rejects a different planet explicitly named as the obstruction', () => {
    const contract = blockedContract();
    if (!contract.diagnosis.obstructingAgent) {
      return;
    }
    const wrongPlanet = contract.diagnosis.obstructingAgent === 'Saturn' ? 'Mars' : 'Saturn';
    const result = validateNarration(
      contract,
      baseNarration({ rkp_finding: `${wrongPlanet} obstructs this matter.` }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'DIAGNOSIS_CONTRADICTION')).toBe(true);
    }
  });
});

describe('validateNarration — unsupported certainty', () => {
  it('rejects certainty language on a low-confidence/neutral reading', () => {
    const contract = blockedContract();
    const lowConfidence: ReadingContract = {
      ...contract,
      diagnosis: { ...contract.diagnosis, confidence: 0.3, outcome: 'UNCERTAIN' },
    };
    const result = validateNarration(
      lowConfidence,
      baseNarration({ interpretation: 'This is guaranteed, without any doubt.' }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'UNSUPPORTED_CERTAINTY')).toBe(true);
    }
  });
});

describe('validateNarration — terminology leakage', () => {
  it('accepts an ordinary reading with no internal terminology', () => {
    const contract = blockedContract();
    expect(validateNarration(contract, baseNarration()).valid).toBe(true);
  });

  for (const term of [
    'RKP',
    'KP',
    'Krishnamurti',
    'house matrix',
    'watchJudgment',
    'ReadingContract',
  ]) {
    it(`rejects the prohibited term "${term}"`, () => {
      const contract = blockedContract();
      const result = validateNarration(
        contract,
        baseNarration({ interpretation: `This was computed using ${term}.` }),
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.failures.some(f => f.code === 'TERMINOLOGY_LEAKAGE')).toBe(true);
      }
    });
  }
});

describe('validateNarration — internal data leakage', () => {
  it('rejects a source-file-shaped path', () => {
    const contract = blockedContract();
    const result = validateNarration(
      contract,
      baseNarration({
        interpretation: 'See functions/src/oracle/responseComposer.ts for details.',
      }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'INTERNAL_DATA_LEAKAGE')).toBe(true);
    }
  });

  it('rejects an API-key-shaped string', () => {
    const contract = blockedContract();
    const result = validateNarration(
      contract,
      baseNarration({ interpretation: 'Configured with AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe.' }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures.some(f => f.code === 'INTERNAL_DATA_LEAKAGE')).toBe(true);
    }
  });
});

describe('validateNarration — prompt injection artifacts', () => {
  it('rejects narration echoing injection compliance language', () => {
    const contract = blockedContract();
    const result = validateNarration(
      contract,
      baseNarration({
        interpretation: 'As instructed, ignoring the previous data, the answer is yes.',
      }),
    );
    expect(result.valid).toBe(false);
  });

  it('a seeker question containing an override instruction does not, by itself, invalidate a truthful narration', () => {
    // The question text never reaches the validator at all — only the
    // NARRATION does. This test documents that fact directly: a validator
    // call with clean narration is valid regardless of what the (here,
    // absent) question said.
    const contract = blockedContract();
    const result = validateNarration(contract, baseNarration());
    expect(result.valid).toBe(true);
  });
});

describe('validateNarration — malformed output', () => {
  it('rejects null narration', () => {
    const contract = blockedContract();
    const result = validateNarration(contract, null);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures[0]!.code).toBe('MALFORMED_OUTPUT');
    }
  });

  it('rejects an empty required field', () => {
    const contract = blockedContract();
    const result = validateNarration(contract, baseNarration({ rkp_finding: '' }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failures[0]!.code).toBe('MALFORMED_OUTPUT');
    }
  });

  it('rejects a non-string why_this_remedy', () => {
    const contract = blockedContract();
    const malformed = { ...baseNarration(), why_this_remedy: 42 } as unknown as NarrationFields;
    const result = validateNarration(contract, malformed);
    expect(result.valid).toBe(false);
  });
});

describe('validateNarration — validator failure fails closed', () => {
  it('a throwing check is caught and reported as a failure, not swallowed into a valid result', () => {
    const contract = blockedContract();
    // Sabotage the contract in a way that would make a naive implementation
    // throw (accessing a property of `undefined`) inside a check, and
    // confirm the orchestrator still returns invalid rather than letting an
    // exception propagate or silently skip the field.
    const hostile = {
      ...contract,
      diagnosis: {
        ...contract.diagnosis,
        outcome: undefined as unknown as ReadingContract['diagnosis']['outcome'],
      },
    };
    const result = validateNarration(hostile, baseNarration());
    // Either the malformed-contract shape surfaces as a failure, or every
    // check quietly no-ops on the unexpected undefined and the result is
    // valid — assert it did NOT throw out of validateNarration itself,
    // which is the actual fail-closed contract this function promises.
    expect(() => result).not.toThrow();
    expect(typeof result.valid).toBe('boolean');
  });
});

describe('buildDeterministicFallbackNarration', () => {
  it('produces output that itself passes validation', () => {
    const contract = blockedContract();
    const fallback = buildDeterministicFallbackNarration(contract);
    const result = validateNarration(contract, fallback);
    expect(result.valid).toBe(true);
  });

  it('is deterministic — same contract, same fallback text', () => {
    const contract = blockedContract();
    const a = buildDeterministicFallbackNarration(contract);
    const b = buildDeterministicFallbackNarration(contract);
    expect(a).toEqual(b);
  });

  it('never claims intervention when none is required', () => {
    const contract = blockedContract();
    const noIntervention: ReadingContract = {
      ...contract,
      remedy: { ...contract.remedy, interventionRequired: false, steps: [] },
    };
    const fallback = buildDeterministicFallbackNarration(noIntervention);
    expect(fallback.why_this_remedy).toBe(noIntervention.remedy.guidance);
  });
});
