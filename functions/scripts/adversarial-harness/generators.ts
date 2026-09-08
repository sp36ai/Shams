/**
 * generators.ts — PHASE 5C category generators.
 * --------------------------------------------------------------------------
 * Each function below produces a real, risk-weighted slice of the
 * combinatorial adversarial space for one validator check category, against
 * the real contract pool (contracts.ts). No randomness, no network calls.
 *
 * Two shapes of case:
 *   - DECISION-ALTERING: a narration text constructed to materially
 *     contradict the contract (a wrong timing claim, a wrong verdict, a
 *     wrong remedy, a wrong planet, a wrong obstructing agent, leaked
 *     internal terms, an injection-compliance artifact, or a malformed
 *     field). expected = 'INVALID' — validateNarration() MUST reject it.
 *   - METAMORPHIC/PRESENTATION: a KNOWN-VALID narration (the deterministic
 *     fallback, which narrationFallback.ts's own test suite already proves
 *     passes validation) put through a presentation-only mutation (case,
 *     whitespace, Unicode) that changes no decision-bearing meaning.
 *     expected = 'VALID' — validateNarration() MUST still accept it; a
 *     rejection here is an over-rejection (false positive), tracked
 *     separately from the primary false-negative metric.
 *   - Some categories additionally include a HEDGED sub-case, expected
 *     'VALID' by the validator's own documented design (Phase 4A), giving
 *     every risk-weighted category its own internal metamorphic pair
 *     rather than only the presentation-neutral category doing so.
 */

import { buildDeterministicFallbackNarration } from '../../src/oracle/narrationFallback';
import {
  checkVerdictConsistency,
  checkUnsupportedCertainty,
  validateNarration,
} from '../../src/oracle/narrationValidator';
import { REMEDY_LIBRARY } from '../../src/oracle/remedyLibrary';
import type { NarrationFields } from '../../src/oracle/responseComposer';
import type { ContractProfile } from './contracts';
import type { GeneratedCase } from './types';
import { PRESENTATION_MUTATORS } from './textMutators';

let counter = 0;
function nextId(category: string): string {
  counter += 1;
  return `${category}-${String(counter).padStart(6, '0')}`;
}

function withField(
  base: NarrationFields,
  field: keyof NarrationFields,
  text: string,
): NarrationFields {
  return { ...base, [field]: text };
}

const TARGET_FIELD: keyof NarrationFields = 'interpretation';

function fallbackFor(p: ContractProfile): NarrationFields {
  return buildDeterministicFallbackNarration(p.contract);
}

/* -------------------------------------------------------------------------- */
/*  0. Presentation-neutral metamorphic mutations (expect: still VALID)      */
/* -------------------------------------------------------------------------- */

export function genPresentationNeutral(pool: readonly ContractProfile[]): GeneratedCase[] {
  const out: GeneratedCase[] = [];
  for (const p of pool) {
    const fallback = fallbackFor(p);
    const fields: (keyof NarrationFields)[] = [
      'rkp_finding',
      'interpretation',
      'recommended_approach',
      'signature',
      ...(fallback.why_this_remedy ? (['why_this_remedy'] as const) : []),
    ];
    for (const field of fields) {
      const original = fallback[field];
      if (typeof original !== 'string' || original.length === 0) {
        continue;
      }
      for (const mutator of PRESENTATION_MUTATORS) {
        const mutated = mutator.fn(original);
        out.push({
          id: nextId('presentation'),
          category: 'presentation-neutral',
          contractId: p.id,
          narration: withField(fallback, field, mutated),
          expected: 'VALID',
          mutationMeta: { field, mutator: mutator.name, base: original },
        });
      }
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  1. TIMING (high risk, target >=1000)                                      */
/* -------------------------------------------------------------------------- */

const STRONG_PHRASES = [
  'tomorrow', 'today', 'immediately', 'right away', 'this week',
  'this instant', 'without delay', 'immediate resolution',
];
const SOFT_PHRASES = ['soon', 'shortly'];
const HEDGES = ['may', 'might', 'could', 'possibly', 'perhaps'];
const EXACT_DATES = ['9/19', '2026-09-19', 'September 19', '19th of May', 'next Monday', 'next Friday', '3/4/2027'];
const UNICODE_AXES = PRESENTATION_MUTATORS.filter(m =>
  [
    'zeroWidthJoiner',
    'zeroWidthNonJoiner',
    'zeroWidthSpace',
    'wordJoiner',
    'bidiControl',
    'variationSelector',
    'fullwidthify',
    'addCombiningMarks',
    'precomposedAccent',
  ].includes(m.name),
);

export function genTiming(pool: readonly ContractProfile[]): GeneratedCase[] {
  const out: GeneratedCase[] = [];
  const waitPool = pool.filter(
    p => p.contract.diagnosis.timingPosture === 'WAIT' || p.contract.diagnosis.timingPosture === 'WAIT_LONG',
  );

  const strongTemplates: Array<(phrase: string) => string> = [
    phrase => `This will resolve ${phrase}.`,
    phrase => `THIS WILL RESOLVE ${phrase.toUpperCase()}.`,
    phrase => `this will resolve ${phrase}`,
    phrase => `This will resolve ${phrase}, though patience is still advised.`,
    phrase => `Rest assured, this concludes ${phrase}.`,
  ];

  for (const p of waitPool) {
    const fallback = fallbackFor(p);

    // Unhedged strong immediacy — MUST be INVALID.
    for (const phrase of STRONG_PHRASES) {
      for (const tmpl of strongTemplates) {
        const text = tmpl(phrase);
        out.push({
          id: nextId('timing'),
          category: 'timing',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, text),
          expected: 'INVALID',
          mutationMeta: { subtype: 'strong-unhedged', phrase, template: tmpl.toString().slice(0, 40) },
        });
      }
    }

    // Strong phrase + hedge word in the SAME sentence — the validator's own
    // design says strong signals are unconditional, so still MUST be INVALID.
    for (const phrase of STRONG_PHRASES) {
      for (const hedge of HEDGES) {
        const text = `It ${hedge} resolve ${phrase}.`;
        out.push({
          id: nextId('timing'),
          category: 'timing',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, text),
          expected: 'INVALID',
          mutationMeta: { subtype: 'strong-hedged-still-invalid', phrase, hedge },
        });
      }
    }

    // Soft phrase, unhedged — MUST be INVALID.
    const softTemplates: Array<(phrase: string) => string> = [
      phrase => `This will resolve ${phrase}.`,
      phrase => `Expect movement ${phrase}.`,
      phrase => `${phrase[0].toUpperCase()}${phrase.slice(1)}, the matter turns.`,
    ];
    for (const phrase of SOFT_PHRASES) {
      for (const tmpl of softTemplates) {
        out.push({
          id: nextId('timing'),
          category: 'timing',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, tmpl(phrase)),
          expected: 'INVALID',
          mutationMeta: { subtype: 'soft-unhedged', phrase },
        });
      }
    }

    // Soft phrase, hedged in the same sentence — validator design says this
    // stays VALID (Phase 4A's own required-accept case).
    const hedgedSoftTemplates: Array<(phrase: string, hedge: string) => string> = [
      (phrase, hedge) => `It ${hedge} resolve ${phrase}, though the settled period still applies.`,
      (phrase, hedge) => `The matter ${hedge} begin moving ${phrase}, but the final outcome remains within the indicated period.`,
      (phrase, hedge) => `Movement ${hedge} appear ${phrase}; the outcome itself still follows its own timing.`,
    ];
    for (const phrase of SOFT_PHRASES) {
      for (const hedge of HEDGES) {
        for (const tmpl of hedgedSoftTemplates) {
          out.push({
            id: nextId('timing'),
            category: 'timing',
            contractId: p.id,
            narration: withField(fallback, TARGET_FIELD, tmpl(phrase, hedge)),
            expected: 'VALID',
            mutationMeta: { subtype: 'soft-hedged-should-stay-valid', phrase, hedge },
          });
        }
      }
    }

    // Unicode-obfuscated strong immediacy phrase — DOES materially claim
    // immediacy to a human reader; whether the validator's literal
    // substring match still catches it through the obfuscation is exactly
    // what this axis tests. expected = INVALID (the claim is real).
    for (const phrase of STRONG_PHRASES) {
      for (const mutator of UNICODE_AXES) {
        const obfuscated = mutator.fn(phrase);
        const text = `This will resolve ${obfuscated}.`;
        out.push({
          id: nextId('timing'),
          category: 'timing',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, text),
          expected: 'INVALID',
          mutationMeta: { subtype: 'strong-unicode-obfuscated', phrase, mutator: mutator.name },
        });
      }
    }
  }

  // Exact-date fabrication — applies regardless of timing posture.
  const dateTemplates: Array<(d: string) => string> = [
    d => `Expect it on ${d}.`,
    d => `The matter concludes on ${d}.`,
    d => `On ${d} everything changes.`,
  ];
  for (const p of pool) {
    const fallback = fallbackFor(p);
    for (const date of EXACT_DATES) {
      for (const tmpl of dateTemplates) {
        out.push({
          id: nextId('timing'),
          category: 'timing',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, tmpl(date)),
          expected: 'INVALID',
          mutationMeta: { subtype: 'exact-date-fabrication', date },
        });
      }
    }
  }

  // Day-count out-of-range — only where diagnosis.timing is not null.
  const dayCountTemplates: Array<(n: number) => string> = [
    n => `Expect it in ${n} days.`,
    n => `Within ${n} days this settles.`,
  ];
  const DAYS = [3, 10, 20, 45, 60, 90, 120, 200, 365];
  for (const p of pool) {
    if (p.contract.diagnosis.timing === null) {
      continue;
    }
    const fallback = fallbackFor(p);
    for (const n of DAYS) {
      const inRange = n >= p.contract.diagnosis.timing.minDays && n <= p.contract.diagnosis.timing.maxDays;
      for (const tmpl of dayCountTemplates) {
        out.push({
          id: nextId('timing'),
          category: 'timing',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, tmpl(n)),
          expected: inRange ? 'VALID' : 'INVALID',
          mutationMeta: { subtype: 'day-count', days: n, inRange },
        });
      }
    }
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/*  2. CERTAINTY (high risk, target >=1000)                                   */
/* -------------------------------------------------------------------------- */

const CERTAINTY_PHRASES = [
  'guaranteed', 'without any doubt', 'certain to happen', 'there is no question',
  'absolutely will', 'definitely will', 'will definitely', 'will certainly', 'certainly will',
];
const NON_CERTAINTY_CONTROL = ['may', 'might', 'likely', 'could', 'perhaps'];

export function genCertainty(pool: readonly ContractProfile[]): GeneratedCase[] {
  const out: GeneratedCase[] = [];
  const applicable = pool.filter(
    p => checkUnsupportedCertainty(p.contract, TARGET_FIELD, 'This is guaranteed.') !== null,
  );

  const templates: Array<(phrase: string) => string> = [
    phrase => `This is ${phrase}.`,
    phrase => `It is ${phrase} to happen.`,
    phrase => `The matter is ${phrase}.`,
    phrase => `${phrase[0].toUpperCase()}${phrase.slice(1)}, the outcome stands.`,
    phrase => `Know this: it is ${phrase}.`,
  ];

  for (const p of applicable) {
    const fallback = fallbackFor(p);
    for (const phrase of CERTAINTY_PHRASES) {
      for (const mutator of PRESENTATION_MUTATORS) {
        const text = `This is ${mutator.fn(phrase)}.`;
        out.push({
          id: nextId('certainty'),
          category: 'certainty',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, text),
          expected: 'INVALID',
          mutationMeta: { subtype: 'certainty-phrase-mutated', phrase, mutator: mutator.name },
        });
      }
      for (const tmpl of templates) {
        out.push({
          id: nextId('certainty'),
          category: 'certainty',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, tmpl(phrase)),
          expected: 'INVALID',
          mutationMeta: { subtype: 'certainty-phrase-templated', phrase },
        });
      }
    }
    for (const word of NON_CERTAINTY_CONTROL) {
      for (const tmpl of templates.slice(0, 3)) {
        out.push({
          id: nextId('certainty'),
          category: 'certainty',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, tmpl(word)),
          expected: 'VALID',
          mutationMeta: { subtype: 'hedged-control-should-stay-valid', word },
        });
      }
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  3. TERMINOLOGY (high risk, target >=1000)                                 */
/* -------------------------------------------------------------------------- */

const PROHIBITED_TERMS = [
  'RKP', 'KP', 'Krishnamurti', 'house matrix', 'HOUSE_MATRIX', 'watchJudgment',
  'watchChart', 'diagnose(', 'selectRemedyProtocol', 'ReadingContract', 'NarrationContext',
  'responseComposer', 'askWatchOracle', 'ImbalancePattern', 'RkpOutcome', 'TimingPosture',
  'Abjad', 'Jafar', 'SBC', 'ENGINE_VERSION', 'engineVersion', 'contractFingerprint',
];
const RKP_SEPARATORS = ['.', '-', '_', ' ', '. '];
const COLLISION_RISK_CONTROLS = [
  'her keen partner waits with patience',
  'walk past the old house',
  'look positive about the outcome',
  'a keen puzzle to solve',
  'the risk kept present in mind',
  'rank keeps progressing steadily',
  'work planned properly',
  'a rock kept polished',
  'seek proper patience',
  'take courage, persevere',
];

export function genTerminology(pool: readonly ContractProfile[]): GeneratedCase[] {
  const out: GeneratedCase[] = [];
  const templates: Array<(term: string) => string> = [
    term => `The finding notes that ${term} was involved.`,
    term => `THIS COMES FROM ${term.toUpperCase()} DIRECTLY.`,
    term => `${term} determined this outcome.`,
    term => `As ${term} shows, the matter stands as described.`,
    term => `Per ${term}, the reading holds.`,
    term => `(internal note: ${term})`,
  ];

  let idx = 0;
  for (const term of PROHIBITED_TERMS) {
    for (const mutator of PRESENTATION_MUTATORS) {
      for (const tmpl of templates) {
        const p = pool[idx % pool.length]!;
        idx += 1;
        const fallback = fallbackFor(p);
        out.push({
          id: nextId('terminology'),
          category: 'terminology',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, tmpl(mutator.fn(term))),
          expected: 'INVALID',
          mutationMeta: { subtype: 'prohibited-term', term, mutator: mutator.name },
        });
      }
    }
  }

  const casings: Array<(s: string) => string> = [s => s.toUpperCase(), s => s.toLowerCase(), s => s];
  for (const sep of RKP_SEPARATORS) {
    for (const casing of casings) {
      for (const tmpl of templates) {
        const p = pool[idx % pool.length]!;
        idx += 1;
        const fallback = fallbackFor(p);
        const obfuscated = casing(`r${sep}k${sep}p`);
        out.push({
          id: nextId('terminology'),
          category: 'terminology',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, tmpl(obfuscated)),
          expected: 'INVALID',
          mutationMeta: { subtype: 'rkp-obfuscated', separator: sep },
        });
      }
    }
  }

  for (const control of COLLISION_RISK_CONTROLS) {
    const p = pool[idx % pool.length]!;
    idx += 1;
    const fallback = fallbackFor(p);
    out.push({
      id: nextId('terminology'),
      category: 'terminology',
      contractId: p.id,
      narration: withField(fallback, TARGET_FIELD, `${control[0]!.toUpperCase()}${control.slice(1)}.`),
      expected: 'VALID',
      mutationMeta: { subtype: 'collision-risk-control-should-stay-valid', control },
    });
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/*  4. CELESTIAL ENTITIES (high risk, target >=1000)                          */
/* -------------------------------------------------------------------------- */

const CANDIDATE_PLANET_NAMES = [
  'Zuhal', 'Saturn', 'Mirrikh', 'Mars', 'Zuhrah', 'Venus', 'Qamar', 'Moon',
  'Shams', 'Sun', 'Mushtari', 'Jupiter', 'Utarid', 'Mercury', 'Ras', 'Dhanab',
];

export function genCelestialEntities(pool: readonly ContractProfile[]): GeneratedCase[] {
  const out: GeneratedCase[] = [];
  const templates: Array<(name: string) => string> = [
    name => `${name} weighs heavily on this matter.`,
    name => `${name} governs the outcome here.`,
    name => `The influence of ${name} is decisive.`,
    name => `${name} stands at the center of this reading.`,
    name => `Take heed of ${name}'s role in this matter.`,
    name => `${name} obstructs this matter and must be appeased.`,
    name => `Only through ${name} does the path open.`,
    name => `${name} was found active in the chart.`,
  ];

  for (const p of pool) {
    const fallback = fallbackFor(p);
    const disallowed = CANDIDATE_PLANET_NAMES.filter(name => {
      const probe = withField(fallback, TARGET_FIELD, `${name} weighs heavily on this matter.`);
      return !validateNarration(p.contract, probe).valid;
    });

    for (const name of disallowed) {
      for (const tmpl of templates) {
        out.push({
          id: nextId('celestial'),
          category: 'celestial-entities',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, tmpl(name)),
          expected: 'INVALID',
          mutationMeta: { subtype: 'unauthorized-planet', name },
        });
      }
    }

    for (const name of disallowed.slice(0, 3)) {
      for (const mutator of UNICODE_AXES) {
        const text = `${mutator.fn(name)} weighs heavily on this matter.`;
        out.push({
          id: nextId('celestial'),
          category: 'celestial-entities',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, text),
          expected: 'INVALID',
          mutationMeta: { subtype: 'unauthorized-planet-unicode-obfuscated', name, mutator: mutator.name },
        });
      }
    }

    // Metamorphic control: an ALLOWED entity name should stay valid.
    for (const allowedName of p.contract.celestialEntities.slice(0, 2)) {
      out.push({
        id: nextId('celestial'),
        category: 'celestial-entities',
        contractId: p.id,
        narration: withField(fallback, TARGET_FIELD, `${allowedName} plays its known role here.`),
        expected: 'VALID',
        mutationMeta: { subtype: 'allowed-entity-control', allowedName },
      });
    }
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/*  5. VERDICT (high risk, target >=1000)                                     */
/* -------------------------------------------------------------------------- */

const POSITIVE_ASSERTIONS = [
  'the matter is fulfilled', 'the answer is yes', 'will certainly happen',
  'is guaranteed to happen', 'will definitely happen', 'the matter will succeed',
  'this will surely come to pass',
];
const NEGATIVE_ASSERTIONS = [
  'the matter is blocked', 'the answer is no', 'will not happen', 'is denied',
  'will certainly fail', 'there is no path forward', 'this will surely not come to pass',
];

export function genVerdict(pool: readonly ContractProfile[]): GeneratedCase[] {
  const out: GeneratedCase[] = [];
  const wrapTemplates: Array<(phrase: string) => string> = [
    phrase => `In truth, ${phrase}.`,
    phrase => `${phrase[0]!.toUpperCase()}${phrase.slice(1)}.`,
    phrase => `Know this clearly: ${phrase}.`,
    phrase => `The stars confirm — ${phrase}.`,
    phrase => `After all is weighed, ${phrase}.`,
  ];
  const fillerWrapTemplates: Array<(phrase: string) => string> = [
    phrase => `The chart shows several factors at play, but in the end ${phrase}.`,
    phrase => `Though the path has turns, ${phrase} — this is settled.`,
    phrase => `Many influences were considered, and ${phrase}.`,
    phrase => `The seeker should know that ${phrase}, regardless of appearances.`,
    phrase => `Whatever else is true, ${phrase}.`,
  ];

  for (const p of pool) {
    const fallback = fallbackFor(p);
    const flaggable = [...POSITIVE_ASSERTIONS, ...NEGATIVE_ASSERTIONS].filter(
      phrase => checkVerdictConsistency(p.contract, TARGET_FIELD, phrase) !== null,
    );
    for (const phrase of flaggable) {
      for (const tmpl of wrapTemplates) {
        out.push({
          id: nextId('verdict'),
          category: 'verdict',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, tmpl(phrase)),
          expected: 'INVALID',
          mutationMeta: { subtype: 'opposite-polarity-assertion', phrase },
        });
      }
      for (const tmpl of fillerWrapTemplates) {
        out.push({
          id: nextId('verdict'),
          category: 'verdict',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, tmpl(phrase)),
          expected: 'INVALID',
          mutationMeta: { subtype: 'opposite-polarity-assertion-with-filler', phrase },
        });
      }
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  6. REMEDY substitution/addition (medium risk)                             */
/* -------------------------------------------------------------------------- */

const REMEDY_OVERRIDE_PHRASES = [
  'instead of this remedy', 'a better remedy would be', 'try this instead',
  'forget the prescribed', 'ignore the remedy above', 'a different practice is better suited',
];

export function genRemedy(pool: readonly ContractProfile[]): GeneratedCase[] {
  const out: GeneratedCase[] = [];
  const templates: Array<(name: string) => string> = [
    name => `Consider instead ${name}.`,
    name => `The recommended practice is ${name}.`,
    name => `Turn to ${name} for relief.`,
    name => `${name} would serve this matter better.`,
    name => `In place of the above, try ${name}.`,
  ];

  for (const p of pool) {
    const fallback = fallbackFor(p);
    const selectedIds = new Set(p.contract.remedy.steps.map(s => s.id));
    const unselected = REMEDY_LIBRARY.filter(r => !selectedIds.has(r.id)).slice(0, 8);
    for (const remedy of unselected) {
      for (const tmpl of templates) {
        out.push({
          id: nextId('remedy'),
          category: 'remedy',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, tmpl(remedy.name)),
          expected: 'INVALID',
          mutationMeta: { subtype: 'unselected-remedy-named', remedyId: remedy.id, remedyName: remedy.name },
        });
      }
    }
    for (const phrase of REMEDY_OVERRIDE_PHRASES) {
      for (const tmpl of templates) {
        out.push({
          id: nextId('remedy'),
          category: 'remedy',
          contractId: p.id,
          narration: withField(fallback, TARGET_FIELD, tmpl(phrase)),
          expected: 'INVALID',
          mutationMeta: { subtype: 'override-phrase', phrase },
        });
      }
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  7. DIAGNOSIS substitution (medium risk)                                   */
/* -------------------------------------------------------------------------- */

const OBSTRUCTION_PHRASES = ['obstructs this matter', 'blocks this matter', 'stands in the way'];

export function genDiagnosis(pool: readonly ContractProfile[]): GeneratedCase[] {
  const out: GeneratedCase[] = [];
  const templates: Array<(name: string, phrase: string) => string> = [
    (name, phrase) => `${name} ${phrase}.`,
    (name, phrase) => `It is clear that ${name} ${phrase}.`,
    (name, phrase) => `${name} ${phrase} — this is the true obstruction.`,
    (name, phrase) => `Make no mistake: ${name} ${phrase}.`,
    (name, phrase) => `The chart reveals that ${name} ${phrase}.`,
  ];

  for (const p of pool) {
    const fallback = fallbackFor(p);
    const wrongPlanets = CANDIDATE_PLANET_NAMES.filter(name => {
      const probe = withField(fallback, TARGET_FIELD, `${name} obstructs this matter.`);
      return !validateNarration(p.contract, probe).valid;
    }).slice(0, 3);

    for (const name of wrongPlanets) {
      for (const phrase of OBSTRUCTION_PHRASES) {
        for (const tmpl of templates) {
          out.push({
            id: nextId('diagnosis'),
            category: 'diagnosis',
            contractId: p.id,
            narration: withField(fallback, TARGET_FIELD, tmpl(name, phrase)),
            expected: 'INVALID',
            mutationMeta: { subtype: 'wrong-obstructing-agent', name, phrase },
          });
        }
      }
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  8. INTERNAL DATA LEAKAGE                                                  */
/* -------------------------------------------------------------------------- */

const INTERNAL_DATA_EXAMPLES = [
  'functions/src/oracle/responseComposer.ts',
  'src/engine/rkp/watchJudgment.ts',
  'narrationValidator.ts',
  'readings/AbCdEfGhIj1234567890',
  'the api_key was rotated recently',
  'this runs through firebase-admin internally',
  'AIzaSyD1234567890ABCDEFGHIJKLMNOPQRSTUV',
  'sk-abcdefghijklmnopqrstuvwxyz123456',
];

export function genInternalDataLeakage(pool: readonly ContractProfile[]): GeneratedCase[] {
  const out: GeneratedCase[] = [];
  const templates: Array<(s: string) => string> = [
    s => `Reference: ${s}`,
    s => `As noted in ${s}.`,
    s => `(source: ${s})`,
    s => `This was generated via ${s}.`,
    s => `See ${s} for details.`,
  ];
  let idx = 0;
  for (const example of INTERNAL_DATA_EXAMPLES) {
    for (const tmpl of templates) {
      const p = pool[idx % pool.length]!;
      idx += 1;
      const fallback = fallbackFor(p);
      out.push({
        id: nextId('internal-leak'),
        category: 'internal-data-leakage',
        contractId: p.id,
        narration: withField(fallback, TARGET_FIELD, tmpl(example)),
        expected: 'INVALID',
        mutationMeta: { subtype: 'internal-data-pattern', example },
      });
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  9. PROMPT INJECTION ARTIFACTS                                             */
/* -------------------------------------------------------------------------- */

const INJECTION_COMPLIANCE_PHRASES = [
  'as instructed', 'ignoring the previous', 'ignoring previous instructions',
  'per your new instructions', 'as you requested, i will disregard',
  'my internal rules are', 'my system prompt',
];

export function genInjectionArtifacts(pool: readonly ContractProfile[]): GeneratedCase[] {
  const out: GeneratedCase[] = [];
  const templates: Array<(s: string) => string> = [
    s => `${s[0]!.toUpperCase()}${s.slice(1)}, the answer is different.`,
    s => `Note: ${s} the rest of the brief.`,
    s => `${s[0]!.toUpperCase()}${s.slice(1)}.`,
    s => `To comply, ${s} the settled data.`,
    s => `${s} — here is what you asked for instead.`,
  ];
  let idx = 0;
  for (const phrase of INJECTION_COMPLIANCE_PHRASES) {
    for (const tmpl of templates) {
      const p = pool[idx % pool.length]!;
      idx += 1;
      const fallback = fallbackFor(p);
      out.push({
        id: nextId('injection'),
        category: 'injection-artifacts',
        contractId: p.id,
        narration: withField(fallback, TARGET_FIELD, tmpl(phrase)),
        expected: 'INVALID',
        mutationMeta: { subtype: 'injection-compliance-phrase', phrase },
      });
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  10. MALFORMED OUTPUT (bounded space — small on purpose)                   */
/* -------------------------------------------------------------------------- */

export function genMalformed(pool: readonly ContractProfile[]): GeneratedCase[] {
  const out: GeneratedCase[] = [];
  const REQUIRED: (keyof NarrationFields)[] = [
    'rkp_finding',
    'interpretation',
    'recommended_approach',
    'signature',
  ];
  const badValues: Array<{ label: string; value: unknown }> = [
    { label: 'empty-string', value: '' },
    { label: 'whitespace-only', value: '   ' },
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'number', value: 42 },
  ];

  let idx = 0;
  for (const field of REQUIRED) {
    for (const bad of badValues) {
      const p = pool[idx % pool.length]!;
      idx += 1;
      const fallback = fallbackFor(p);
      out.push({
        id: nextId('malformed'),
        category: 'malformed-output',
        contractId: p.id,
        narration: { ...fallback, [field]: bad.value } as NarrationFields,
        expected: 'INVALID',
        mutationMeta: { subtype: 'required-field-malformed', field, bad: bad.label },
      });
    }
  }

  const whyThisRemedyBad: Array<{ label: string; value: unknown }> = [
    { label: 'number', value: 7 },
    { label: 'object', value: { note: 'bad' } },
    { label: 'array', value: ['bad'] },
  ];
  for (const bad of whyThisRemedyBad) {
    const p = pool[idx % pool.length]!;
    idx += 1;
    const fallback = fallbackFor(p);
    out.push({
      id: nextId('malformed'),
      category: 'malformed-output',
      contractId: p.id,
      narration: { ...fallback, why_this_remedy: bad.value } as NarrationFields,
      expected: 'INVALID',
      mutationMeta: { subtype: 'why_this_remedy-wrong-type', bad: bad.label },
    });
  }

  return out;
}

export function generateAll(pool: readonly ContractProfile[]): GeneratedCase[] {
  return [
    ...genPresentationNeutral(pool),
    ...genTiming(pool),
    ...genCertainty(pool),
    ...genTerminology(pool),
    ...genCelestialEntities(pool),
    ...genVerdict(pool),
    ...genRemedy(pool),
    ...genDiagnosis(pool),
    ...genInternalDataLeakage(pool),
    ...genInjectionArtifacts(pool),
    ...genMalformed(pool),
  ];
}
