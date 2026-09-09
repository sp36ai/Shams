/**
 * PHASE 5D reconnaissance — offline, deterministic, no network/API calls.
 * --------------------------------------------------------------------------
 * Investigates the three bypass mechanisms Phase 5C-R explicitly left open:
 *   A. cross-script homoglyph/confusable substitution
 *   B. repeated-character padding / small spelling distortion
 *   C. ASCII punctuation inserted inside a sensitive term
 *
 * Read-only with respect to production code: imports and calls the real,
 * unmodified validateNarration()/canonicalizeForSecurityMatching(), and
 * reuses the real Phase 5C contract pool (functions/scripts/
 * adversarial-harness/contracts.ts) rather than fabricating new contracts.
 * Writes evidence under docs/audit/phase-5d/. Does not modify
 * narrationValidator.ts, textSecurity.ts, or any other production file.
 *
 * Run with (from functions/):
 *   npx vite-node ../docs/audit/phase-5d/reconnaissance.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';

import {
  buildContractPool,
  type ContractProfile,
} from '../../../functions/scripts/adversarial-harness/contracts';
import { validateNarration } from '../../../functions/src/oracle/narrationValidator';
import { canonicalizeForSecurityMatching } from '../../../functions/src/oracle/textSecurity';
import { buildDeterministicFallbackNarration } from '../../../functions/src/oracle/narrationFallback';
import { REMEDY_LIBRARY } from '../../../functions/src/oracle/remedyLibrary';
import type { NarrationFields } from '../../../functions/src/oracle/responseComposer';

const OUT_DIR = '/home/user/Shams/docs/audit/phase-5d';
mkdirSync(OUT_DIR, { recursive: true });

const pool = buildContractPool();
const TARGET_FIELD: keyof NarrationFields = 'interpretation';

function fallbackFor(p: ContractProfile): NarrationFields {
  return buildDeterministicFallbackNarration(p.contract);
}
function withField(
  base: NarrationFields,
  field: keyof NarrationFields,
  text: string,
): NarrationFields {
  return { ...base, [field]: text };
}

/* -------------------------------------------------------------------------- */
/*  STEP 1 — exact current validator check table                              */
/* -------------------------------------------------------------------------- */

interface CheckDescriptor {
  readonly name: string;
  readonly inputField: string;
  readonly mechanism: 'substring' | 'regex' | 'word-boundary-regex' | 'structural';
  readonly listsOrPatterns: string;
  readonly matchType: string;
  readonly normalizationPath: string;
  readonly knownBypassMechanisms: string;
}

// Verified against functions/src/oracle/narrationValidator.ts, current HEAD,
// read in full immediately before writing this table — not inferred from
// prior reports.
const CHECK_TABLE: readonly CheckDescriptor[] = [
  {
    name: 'checkVerdictConsistency',
    inputField: 'text (per NarrationFields field)',
    mechanism: 'substring',
    listsOrPatterns: 'POSITIVE_ASSERTIONS (7), NEGATIVE_ASSERTIONS (7) — multi-word phrases',
    matchType: 'lower.includes(phrase)',
    normalizationPath: 'canonicalizeForSecurityMatching() (5C-R) then .toLowerCase()',
    knownBypassMechanisms:
      'homoglyph, repeated-char, ASCII punctuation inside any word of the phrase',
  },
  {
    name: 'checkTimingConsistency (date fabrication)',
    inputField: 'text',
    mechanism: 'regex',
    listsOrPatterns: 'MONTH_DATE_PATTERN, WEEKDAY_NAMES (7), DATE_LIKE_PATTERN',
    matchType: 'regex.exec / lower.includes',
    normalizationPath: 'canonicalizeForSecurityMatching() then .toLowerCase()',
    knownBypassMechanisms:
      'homoglyph/repeated-char/punctuation inside a weekday name defeats WEEKDAY_NAMES; MONTH_DATE_PATTERN/DATE_LIKE_PATTERN are numeric/structural, largely unaffected',
  },
  {
    name: 'checkTimingConsistency (immediacy)',
    inputField: 'text',
    mechanism: 'substring',
    listsOrPatterns:
      'STRONG_IMMEDIACY_SIGNALS (9), SOFT_IMMEDIACY_SIGNALS (2), HEDGE_QUALIFIERS (5)',
    matchType: 'lower.includes(phrase)',
    normalizationPath: 'canonicalizeForSecurityMatching() then .toLowerCase()',
    knownBypassMechanisms: 'homoglyph, repeated-char, ASCII punctuation inside the phrase',
  },
  {
    name: 'checkTimingConsistency (day count)',
    inputField: 'text',
    mechanism: 'regex',
    listsOrPatterns: '/(\\d+)\\s*day/gi',
    matchType: 'regex.exec',
    normalizationPath: 'canonicalizeForSecurityMatching()',
    knownBypassMechanisms: 'none of the three mechanisms apply — purely numeric',
  },
  {
    name: 'checkRemedyConsistency (structural remedy-name match)',
    inputField: 'text',
    mechanism: 'substring',
    listsOrPatterns: 'REMEDY_LIBRARY names (33), CANONICAL_REMEDY_NAMES map',
    matchType: 'lower.includes(canonicalRemedyName)',
    normalizationPath: 'canonicalizeForSecurityMatching() on both sides (5C-R)',
    knownBypassMechanisms: 'homoglyph, repeated-char, ASCII punctuation inside a remedy name',
  },
  {
    name: 'checkRemedyConsistency (override phrases)',
    inputField: 'text',
    mechanism: 'substring',
    listsOrPatterns: 'REMEDY_OVERRIDE_PHRASES (6)',
    matchType: 'lower.includes(phrase)',
    normalizationPath: 'canonicalizeForSecurityMatching() then .toLowerCase()',
    knownBypassMechanisms: 'homoglyph, repeated-char, ASCII punctuation',
  },
  {
    name: 'checkCelestialEntities',
    inputField: 'text',
    mechanism: 'word-boundary-regex',
    listsOrPatterns:
      "disallowedEntityNames() — PLANET_ALIASES for all 9 planets, minus this reading's allow-list (widened by remedy-step names)",
    matchType: "new RegExp('\\\\b'+escapeRegExp(name)+'\\\\b','i').test(text)",
    normalizationPath: 'canonicalizeForSecurityMatching()',
    knownBypassMechanisms: 'homoglyph, repeated-char, ASCII punctuation inside a planet name',
  },
  {
    name: 'checkDiagnosisConsistency',
    inputField: 'text',
    mechanism: 'substring',
    listsOrPatterns:
      'OBSTRUCTION_PHRASES (3) + PLANET_ALIASES, sentence-scoped via findSentenceContaining',
    matchType: 'lower.includes(phrase), then substring for planet name inside the matched sentence',
    normalizationPath: 'canonicalizeForSecurityMatching() then .toLowerCase()',
    knownBypassMechanisms:
      'homoglyph/repeated-char/punctuation could defeat the OBSTRUCTION_PHRASES match itself (lower severity: if the phrase itself is not recognized, the check no-ops entirely rather than mis-attributing)',
  },
  {
    name: 'checkUnsupportedCertainty',
    inputField: 'text',
    mechanism: 'substring',
    listsOrPatterns: 'CERTAINTY_PHRASES (9)',
    matchType: 'lower.includes(phrase)',
    normalizationPath: 'canonicalizeForSecurityMatching() then .toLowerCase()',
    knownBypassMechanisms: 'homoglyph, repeated-char, ASCII punctuation inside the phrase',
  },
  {
    name: 'checkTerminologyLeakage (deny-list)',
    inputField: 'text',
    mechanism: 'substring',
    listsOrPatterns: 'PROHIBITED_TERMINOLOGY (22 entries, 1 multi-word: "house matrix")',
    matchType: 'lower.includes(term.toLowerCase())',
    normalizationPath: 'canonicalizeForSecurityMatching() then .toLowerCase()',
    knownBypassMechanisms: 'homoglyph, repeated-char, ASCII punctuation inside any term',
  },
  {
    name: 'checkTerminologyLeakage (RKP-obfuscated pattern)',
    inputField: 'text',
    mechanism: 'regex',
    listsOrPatterns: 'RKP_OBFUSCATED_PATTERN = /r[\\s.\\-_]+k[\\s.\\-_]+p\\b/i',
    matchType: 'pattern.test(text)',
    normalizationPath: 'canonicalizeForSecurityMatching()',
    knownBypassMechanisms:
      'ASCII punctuation is ALREADY tolerated by design (the pattern IS the punctuation-tolerant fix); homoglyph substitution of r/k/p themselves is not covered',
  },
  {
    name: 'checkInternalDataLeakage',
    inputField: 'text',
    mechanism: 'regex',
    listsOrPatterns: 'INTERNAL_DATA_PATTERNS (8) — file paths, API-key shapes',
    matchType: 'pattern.test(text)',
    normalizationPath: 'canonicalizeForSecurityMatching()',
    knownBypassMechanisms:
      'the three mechanisms are largely irrelevant here (these are structural/shape patterns, not natural-language phrases)',
  },
  {
    name: 'checkPromptInjectionArtifacts',
    inputField: 'text',
    mechanism: 'substring',
    listsOrPatterns: 'INJECTION_COMPLIANCE_PHRASES (7)',
    matchType: 'lower.includes(phrase)',
    normalizationPath: 'canonicalizeForSecurityMatching() then .toLowerCase()',
    knownBypassMechanisms: 'homoglyph, repeated-char, ASCII punctuation inside the phrase',
  },
  {
    name: 'checkWellFormed',
    inputField: 'whole NarrationFields object (structural, not text content)',
    mechanism: 'structural',
    listsOrPatterns: 'n/a — type/emptiness checks only',
    matchType: 'typeof / trim().length',
    normalizationPath: 'none — runs before per-field canonicalization',
    knownBypassMechanisms: 'not applicable — no text-matching involved',
  },
];

/* -------------------------------------------------------------------------- */
/*  Mutation families                                                          */
/* -------------------------------------------------------------------------- */

// A small, well-known set of visually-confusable substitutions for common
// Latin letters, drawn from Unicode's own confusables list (not invented) —
// used ONLY to construct attack text for measurement, never to build a
// folding/normalization function that would touch production code.
const HOMOGLYPHS: Readonly<Record<string, string>> = {
  a: 'а', // Cyrillic а U+0430
  e: 'е', // Cyrillic е U+0435
  o: 'о', // Cyrillic о U+043E
  p: 'р', // Cyrillic р U+0440
  c: 'с', // Cyrillic с U+0441
  x: 'х', // Cyrillic х U+0445
  i: 'і', // Cyrillic і U+0456 (Ukrainian i)
  y: 'у', // Cyrillic у U+0443
  // Greek, where visually close and distinct from the Cyrillic set above.
  n: 'ո', // Armenian o (visually close to n in some fonts) -- included as a
  //         second-script example distinct from Cyrillic, per instruction's
  //         "Greek/Latin substitutions where applicable" -- kept small and
  //         explicit rather than a large invented table.
};

function homoglyphSubstituteOne(word: string, letterIndex: number): string | null {
  const chars = Array.from(word);
  const target = chars[letterIndex]?.toLowerCase();
  if (target === undefined || !(target in HOMOGLYPHS)) {
    return null;
  }
  chars[letterIndex] = HOMOGLYPHS[target]!;
  return chars.join('');
}

function homoglyphSubstituteAll(word: string): string {
  return Array.from(word)
    .map(ch => HOMOGLYPHS[ch.toLowerCase()] ?? ch)
    .join('');
}

function repeatCharAt(word: string, index: number, times: number): string {
  const chars = Array.from(word);
  if (index < 0 || index >= chars.length) {
    return word;
  }
  const rep = chars[index]!.repeat(times);
  return chars.slice(0, index).join('') + rep + chars.slice(index + 1).join('');
}

const PUNCT_CHARS = ['.', '-', '_', '/', ',', ':', "'", '(', ')'];

function insertPunctAt(word: string, index: number, punct: string): string {
  const chars = Array.from(word);
  if (index <= 0 || index >= chars.length) {
    return word;
  }
  return chars.slice(0, index).join('') + punct + chars.slice(index).join('');
}

/* -------------------------------------------------------------------------- */
/*  Target terms per category — the validator's own literal lists            */
/* -------------------------------------------------------------------------- */

const TIMING_TERMS = ['tomorrow', 'immediately', 'today', 'shortly'];
const CERTAINTY_TERMS = ['guaranteed', 'definitely'];
const TERMINOLOGY_TERMS = ['Krishnamurti', 'engineVersion', 'ReadingContract'];
const CELESTIAL_TERMS = ['Mushtari', 'Utarid', 'Zuhal']; // resolved disallowed per-contract at runtime
const VERDICT_TERMS = ['fulfilled', 'guaranteed']; // substrings of POSITIVE_ASSERTIONS phrases
const REMEDY_TERM = REMEDY_LIBRARY[5]!.name; // a mid-list remedy name, non-diacritic

interface AttackCase {
  readonly id: string;
  readonly mechanism: 'homoglyph' | 'repeated-char' | 'ascii-punctuation' | 'combined';
  readonly category: string;
  readonly target: string;
  readonly mutationDetail: string;
  readonly contractId: string;
  readonly originalText: string;
  readonly mutatedText: string;
  readonly expected: 'INVALID'; // every base case here is a genuine contradiction
  readonly actualValid: boolean;
  readonly outcome: 'CAUGHT' | 'FALSE_NEGATIVE';
}

const results: AttackCase[] = [];
let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${String(counter).padStart(5, '0')}`;
}

function run(
  mechanism: AttackCase['mechanism'],
  category: string,
  target: string,
  mutationDetail: string,
  contractId: string,
  narration: NarrationFields,
  originalText: string,
  mutatedText: string,
): void {
  const p = pool.find(c => c.id === contractId)!;
  const result = validateNarration(p.contract, narration);
  results.push({
    id: nextId(mechanism),
    mechanism,
    category,
    target,
    mutationDetail,
    contractId,
    originalText,
    mutatedText,
    expected: 'INVALID',
    actualValid: result.valid,
    outcome: result.valid ? 'FALSE_NEGATIVE' : 'CAUGHT',
  });
}

/* -------------------------------------------------------------------------- */
/*  STEP 2/3 — systematic attack matrix per mechanism                         */
/* -------------------------------------------------------------------------- */

const waitPool = pool.filter(
  p =>
    p.contract.diagnosis.timingPosture === 'WAIT' ||
    p.contract.diagnosis.timingPosture === 'WAIT_LONG',
);
const certaintyApplicablePool = pool.filter(
  p =>
    p.contract.diagnosis.confidence < 0.8 ||
    !['FAVOURABLE', 'ESCALATING', 'UNFAVOURABLE', 'DECLINING'].includes(
      p.contract.diagnosis.outcome,
    ),
);

function sentenceFor(term: string): string {
  return `This will resolve ${term}.`;
}
function certaintySentence(term: string): string {
  return `This is ${term}.`;
}
function terminologySentence(term: string): string {
  return `This finding comes from ${term} directly.`;
}
function celestialSentence(term: string): string {
  return `${term} weighs heavily on this matter.`;
}
function remedySentence(term: string): string {
  return `Consider instead ${term}.`;
}

// --- A. Homoglyph ---
for (const p of waitPool) {
  const fallback = fallbackFor(p);
  for (const term of TIMING_TERMS) {
    for (let i = 0; i < term.length; i++) {
      const mutated = homoglyphSubstituteOne(term, i);
      if (mutated === null) {
        continue;
      }
      const text = sentenceFor(mutated);
      run(
        'homoglyph',
        'timing',
        term,
        `single-char@${i}`,
        p.id,
        withField(fallback, TARGET_FIELD, text),
        sentenceFor(term),
        text,
      );
    }
    const allMutated = homoglyphSubstituteAll(term);
    if (allMutated !== term) {
      const text = sentenceFor(allMutated);
      run(
        'homoglyph',
        'timing',
        term,
        'all-chars',
        p.id,
        withField(fallback, TARGET_FIELD, text),
        sentenceFor(term),
        text,
      );
    }
  }
}
for (const p of certaintyApplicablePool) {
  const fallback = fallbackFor(p);
  for (const term of CERTAINTY_TERMS) {
    for (let i = 0; i < term.length; i++) {
      const mutated = homoglyphSubstituteOne(term, i);
      if (mutated === null) {
        continue;
      }
      const text = certaintySentence(mutated);
      run(
        'homoglyph',
        'certainty',
        term,
        `single-char@${i}`,
        p.id,
        withField(fallback, TARGET_FIELD, text),
        certaintySentence(term),
        text,
      );
    }
  }
}
for (const p of pool) {
  const fallback = fallbackFor(p);
  for (const term of TERMINOLOGY_TERMS) {
    for (let i = 0; i < term.length; i++) {
      const mutated = homoglyphSubstituteOne(term, i);
      if (mutated === null) {
        continue;
      }
      const text = terminologySentence(mutated);
      run(
        'homoglyph',
        'terminology',
        term,
        `single-char@${i}`,
        p.id,
        withField(fallback, TARGET_FIELD, text),
        terminologySentence(term),
        text,
      );
    }
  }
  for (const term of CELESTIAL_TERMS) {
    const probe = withField(fallback, TARGET_FIELD, celestialSentence(term));
    if (validateNarration(p.contract, probe).valid) {
      continue;
    } // already allowed for this contract -- skip, not a bypass target
    for (let i = 0; i < term.length; i++) {
      const mutated = homoglyphSubstituteOne(term, i);
      if (mutated === null) {
        continue;
      }
      const text = celestialSentence(mutated);
      run(
        'homoglyph',
        'celestial',
        term,
        `single-char@${i}`,
        p.id,
        withField(fallback, TARGET_FIELD, text),
        celestialSentence(term),
        text,
      );
    }
  }
}

// --- B. Repeated character ---
for (const p of waitPool) {
  const fallback = fallbackFor(p);
  for (const term of TIMING_TERMS) {
    for (const pos of [0, Math.floor(term.length / 2), term.length - 1]) {
      for (const times of [2, 3]) {
        const mutated = repeatCharAt(term, pos, times);
        const text = sentenceFor(mutated);
        run(
          'repeated-char',
          'timing',
          term,
          `pos${pos}x${times}`,
          p.id,
          withField(fallback, TARGET_FIELD, text),
          sentenceFor(term),
          text,
        );
      }
    }
  }
}
for (const p of certaintyApplicablePool) {
  const fallback = fallbackFor(p);
  for (const term of CERTAINTY_TERMS) {
    for (const pos of [0, Math.floor(term.length / 2), term.length - 1]) {
      const mutated = repeatCharAt(term, pos, 2);
      const text = certaintySentence(mutated);
      run(
        'repeated-char',
        'certainty',
        term,
        `pos${pos}x2`,
        p.id,
        withField(fallback, TARGET_FIELD, text),
        certaintySentence(term),
        text,
      );
    }
  }
}
for (const p of pool) {
  const fallback = fallbackFor(p);
  for (const term of TERMINOLOGY_TERMS) {
    for (const pos of [0, Math.floor(term.length / 2), term.length - 1]) {
      const mutated = repeatCharAt(term, pos, 2);
      const text = terminologySentence(mutated);
      run(
        'repeated-char',
        'terminology',
        term,
        `pos${pos}x2`,
        p.id,
        withField(fallback, TARGET_FIELD, text),
        terminologySentence(term),
        text,
      );
    }
  }
}
{
  const p = pool[0]!;
  const fallback = fallbackFor(p);
  for (const pos of [0, Math.floor(REMEDY_TERM.length / 2), REMEDY_TERM.length - 1]) {
    const mutated = repeatCharAt(REMEDY_TERM, pos, 2);
    const text = remedySentence(mutated);
    run(
      'repeated-char',
      'remedy',
      REMEDY_TERM,
      `pos${pos}x2`,
      p.id,
      withField(fallback, TARGET_FIELD, text),
      remedySentence(REMEDY_TERM),
      text,
    );
  }
}

// --- C. ASCII punctuation insertion ---
for (const p of waitPool) {
  const fallback = fallbackFor(p);
  for (const term of TIMING_TERMS) {
    for (const pos of [1, Math.floor(term.length / 2), term.length - 1]) {
      for (const punct of PUNCT_CHARS) {
        const mutated = insertPunctAt(term, pos, punct);
        if (mutated === term) {
          continue;
        }
        const text = sentenceFor(mutated);
        run(
          'ascii-punctuation',
          'timing',
          term,
          `pos${pos}"${punct}"`,
          p.id,
          withField(fallback, TARGET_FIELD, text),
          sentenceFor(term),
          text,
        );
      }
    }
  }
}
for (const p of certaintyApplicablePool) {
  const fallback = fallbackFor(p);
  for (const term of CERTAINTY_TERMS) {
    for (const pos of [1, Math.floor(term.length / 2), term.length - 1]) {
      for (const punct of PUNCT_CHARS) {
        const mutated = insertPunctAt(term, pos, punct);
        if (mutated === term) {
          continue;
        }
        const text = certaintySentence(mutated);
        run(
          'ascii-punctuation',
          'certainty',
          term,
          `pos${pos}"${punct}"`,
          p.id,
          withField(fallback, TARGET_FIELD, text),
          certaintySentence(term),
          text,
        );
      }
    }
  }
}
for (const p of pool) {
  const fallback = fallbackFor(p);
  for (const term of TERMINOLOGY_TERMS) {
    for (const pos of [1, Math.floor(term.length / 2), term.length - 1]) {
      for (const punct of PUNCT_CHARS) {
        const mutated = insertPunctAt(term, pos, punct);
        if (mutated === term) {
          continue;
        }
        const text = terminologySentence(mutated);
        run(
          'ascii-punctuation',
          'terminology',
          term,
          `pos${pos}"${punct}"`,
          p.id,
          withField(fallback, TARGET_FIELD, text),
          terminologySentence(term),
          text,
        );
      }
    }
  }
  for (const term of CELESTIAL_TERMS) {
    const probe = withField(fallback, TARGET_FIELD, celestialSentence(term));
    if (validateNarration(p.contract, probe).valid) {
      continue;
    }
    for (const pos of [1, Math.floor(term.length / 2), term.length - 1]) {
      for (const punct of PUNCT_CHARS) {
        const mutated = insertPunctAt(term, pos, punct);
        if (mutated === term) {
          continue;
        }
        const text = celestialSentence(mutated);
        run(
          'ascii-punctuation',
          'celestial',
          term,
          `pos${pos}"${punct}"`,
          p.id,
          withField(fallback, TARGET_FIELD, text),
          celestialSentence(term),
          text,
        );
      }
    }
  }
}
{
  const p = pool[0]!;
  const fallback = fallbackFor(p);
  for (const pos of [1, Math.floor(REMEDY_TERM.length / 2), REMEDY_TERM.length - 1]) {
    for (const punct of ['.', '-']) {
      const mutated = insertPunctAt(REMEDY_TERM, pos, punct);
      if (mutated === REMEDY_TERM) {
        continue;
      }
      const text = remedySentence(mutated);
      run(
        'ascii-punctuation',
        'remedy',
        REMEDY_TERM,
        `pos${pos}"${punct}"`,
        p.id,
        withField(fallback, TARGET_FIELD, text),
        remedySentence(REMEDY_TERM),
        text,
      );
    }
  }
}
for (const p of pool) {
  const fallback = fallbackFor(p);
  for (const term of VERDICT_TERMS) {
    // Use the exact POSITIVE_ASSERTIONS phrase this term is drawn from.
    const phrase = term === 'fulfilled' ? 'the matter is fulfilled' : 'is guaranteed to happen';
    const probe = withField(
      fallback,
      TARGET_FIELD,
      phrase.charAt(0).toUpperCase() + phrase.slice(1) + '.',
    );
    const probeResult = validateNarration(p.contract, probe);
    if (probeResult.valid) {
      continue;
    } // outcome polarity already permits this phrase -- not a bypass target
    for (const pos of [1, Math.floor(term.length / 2)]) {
      const mutatedTerm = insertPunctAt(term, pos, '.');
      if (mutatedTerm === term) {
        continue;
      }
      const mutatedPhrase = phrase.replace(term, mutatedTerm);
      const text = mutatedPhrase.charAt(0).toUpperCase() + mutatedPhrase.slice(1) + '.';
      run(
        'ascii-punctuation',
        'verdict',
        term,
        `pos${pos}"."`,
        p.id,
        withField(fallback, TARGET_FIELD, text),
        probe.interpretation,
        text,
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  STEP 4 — combined attacks                                                 */
/* -------------------------------------------------------------------------- */

const combinedResults: AttackCase[] = [];
function runCombined(
  category: string,
  target: string,
  detail: string,
  contractId: string,
  narration: NarrationFields,
  originalText: string,
  mutatedText: string,
): void {
  const p = pool.find(c => c.id === contractId)!;
  const result = validateNarration(p.contract, narration);
  combinedResults.push({
    id: nextId('combined'),
    mechanism: 'combined',
    category,
    target,
    mutationDetail: detail,
    contractId,
    originalText,
    mutatedText,
    expected: 'INVALID',
    actualValid: result.valid,
    outcome: result.valid ? 'FALSE_NEGATIVE' : 'CAUGHT',
  });
}

for (const p of waitPool) {
  const fallback = fallbackFor(p);
  for (const term of ['tomorrow', 'guaranteed']) {
    // homoglyph + punctuation
    const hg = homoglyphSubstituteOne(term, 1) ?? term;
    const hgPunct = insertPunctAt(hg, Math.floor(hg.length / 2), '.');
    let text = term === 'guaranteed' ? certaintySentence(hgPunct) : sentenceFor(hgPunct);
    runCombined(
      'timing-or-certainty',
      term,
      'homoglyph+punctuation',
      p.id,
      withField(fallback, TARGET_FIELD, text),
      term,
      text,
    );

    // homoglyph + repetition
    const hgRep = repeatCharAt(hg, 0, 2);
    text = term === 'guaranteed' ? certaintySentence(hgRep) : sentenceFor(hgRep);
    runCombined(
      'timing-or-certainty',
      term,
      'homoglyph+repetition',
      p.id,
      withField(fallback, TARGET_FIELD, text),
      term,
      text,
    );

    // punctuation + repetition
    const punctRep = repeatCharAt(insertPunctAt(term, Math.floor(term.length / 2), '-'), 0, 2);
    text = term === 'guaranteed' ? certaintySentence(punctRep) : sentenceFor(punctRep);
    runCombined(
      'timing-or-certainty',
      term,
      'punctuation+repetition',
      p.id,
      withField(fallback, TARGET_FIELD, text),
      term,
      text,
    );

    // homoglyph + punctuation + repetition
    const triple = repeatCharAt(insertPunctAt(hg, Math.floor(hg.length / 2), '-'), 0, 2);
    text = term === 'guaranteed' ? certaintySentence(triple) : sentenceFor(triple);
    runCombined(
      'timing-or-certainty',
      term,
      'homoglyph+punctuation+repetition',
      p.id,
      withField(fallback, TARGET_FIELD, text),
      term,
      text,
    );

    // homoglyph + the already-fixed 5C-R Unicode mechanism (zero-width joiner)
    // -- does composing with the FIXED mechanism defeat canonicalization?
    const zwjInHg =
      hg.slice(0, Math.floor(hg.length / 2)) + '‍' + hg.slice(Math.floor(hg.length / 2));
    text = term === 'guaranteed' ? certaintySentence(zwjInHg) : sentenceFor(zwjInHg);
    runCombined(
      'timing-or-certainty',
      term,
      'homoglyph+zero-width-joiner',
      p.id,
      withField(fallback, TARGET_FIELD, text),
      term,
      text,
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  STEP 5 — false-positive analysis against candidate mitigations            */
/* -------------------------------------------------------------------------- */

// Legitimate control corpus: fallback narrations (known-valid), the Phase 4A
// "SHOULD ACCEPT" examples, legitimate remedy/celestial mentions, and a
// sample of ordinary prose with apostrophes/hyphens/foreign transliteration.
const LEGITIMATE_TEXTS: readonly string[] = [
  ...pool.map(p => fallbackFor(p).interpretation),
  'Do not rush the matter; the indicated period is later.',
  'Movement may begin before the final outcome.',
  'The matter may begin moving soon, but the final outcome remains within the indicated period.',
  "It's a matter still finding its shape, and the seeker's own patience matters.",
  'A well-known remedy is the Deliberate Pause practice.',
  'Since September the matter has waited, and Duʿā for Ease may bring comfort.',
  'Her keen partner waits with patience -- an ordinary word-boundary collision, not a leak.',
  'The Zuhal Observance of Discipline is offered here, since Saturn governs this matter.',
  'Consult an Independent Financial Adviser before proceeding further.',
  'Bismillah, the seeker walks past uncertainty toward a settled outcome.',
  "A rock-solid foundation isn't built overnight; take the well-worn path.",
  'The matter is co-created between effort and timing, not a single fixed point.',
];

interface MitigationConcept {
  readonly name: string;
  readonly description: string;
  readonly transform: (s: string) => string;
}

// These candidate transforms exist ONLY inside this reconnaissance script,
// to MEASURE their effect -- none is applied to production code.
const CANDIDATE_MITIGATIONS: readonly MitigationConcept[] = [
  {
    name: 'homoglyph-fold-common-cyrillic',
    description:
      'Fold the same small Cyrillic confusable set used to construct attacks back to Latin before matching.',
    transform: (s: string) => {
      const reverseMap: Record<string, string> = {};
      for (const [latin, confusable] of Object.entries(HOMOGLYPHS)) {
        reverseMap[confusable] = latin;
      }
      return Array.from(s)
        .map(ch => reverseMap[ch] ?? ch)
        .join('');
    },
  },
  {
    name: 'collapse-repeated-letters',
    description:
      'Collapse any run of 2+ identical letters down to 1 before matching (naive de-duplication).',
    transform: (s: string) => s.replace(/([a-zA-Z])\1+/g, '$1'),
  },
  {
    name: 'strip-mid-word-ascii-punctuation',
    description: 'Strip ./-/_ characters that sit between two letters (mid-word) before matching.',
    transform: (s: string) => s.replace(/([a-zA-Z])[.\-_/,:'()]+(?=[a-zA-Z])/g, '$1'),
  },
];

interface MitigationMeasurement {
  readonly concept: string;
  readonly attackCasesNowCaught: number;
  readonly attackCasesTotal: number;
  readonly legitimateTextsAltered: number;
  readonly legitimateTextsTotal: number;
  readonly alteredExamples: readonly { original: string; transformed: string }[];
}

const mitigationMeasurements: MitigationMeasurement[] = [];
for (const concept of CANDIDATE_MITIGATIONS) {
  // How many of the false-negative attack cases would this concept's
  // transform, applied on top of the EXISTING canonicalizeForSecurityMatching
  // output, turn into a literal match against the (also-transformed) target
  // term? We approximate this narrowly: does transform(mutatedText) contain
  // transform(originalText's key term)? This is intentionally a rough,
  // conservative measurement -- good enough to rank concepts, not a claim
  // about exact validator behavior if implemented.
  const falseNegatives = [...results, ...combinedResults].filter(
    r => r.outcome === 'FALSE_NEGATIVE',
  );
  let caught = 0;
  for (const fn of falseNegatives) {
    const canonMutated = canonicalizeForSecurityMatching(fn.mutatedText).toLowerCase();
    const transformedMutated = concept.transform(canonMutated);
    const transformedTarget = concept.transform(fn.target.toLowerCase());
    if (transformedMutated.includes(transformedTarget)) {
      caught += 1;
    }
  }

  const altered: { original: string; transformed: string }[] = [];
  for (const legit of LEGITIMATE_TEXTS) {
    const canonLegit = canonicalizeForSecurityMatching(legit).toLowerCase();
    const transformedLegit = concept.transform(canonLegit);
    if (transformedLegit !== canonLegit) {
      altered.push({ original: canonLegit, transformed: transformedLegit });
    }
  }

  mitigationMeasurements.push({
    concept: concept.name,
    attackCasesNowCaught: caught,
    attackCasesTotal: falseNegatives.length,
    legitimateTextsAltered: altered.length,
    legitimateTextsTotal: LEGITIMATE_TEXTS.length,
    alteredExamples: altered.slice(0, 5),
  });
}

/* -------------------------------------------------------------------------- */
/*  Aggregate + write evidence                                                */
/* -------------------------------------------------------------------------- */

function summarize(cases: readonly AttackCase[]): Record<string, unknown> {
  const total = cases.length;
  const falseNeg = cases.filter(c => c.outcome === 'FALSE_NEGATIVE').length;
  const byMechanism: Record<string, { total: number; falseNeg: number }> = {};
  for (const c of cases) {
    const e = byMechanism[c.mechanism] ?? { total: 0, falseNeg: 0 };
    e.total += 1;
    if (c.outcome === 'FALSE_NEGATIVE') {
      e.falseNeg += 1;
    }
    byMechanism[c.mechanism] = e;
  }
  const byCategory: Record<string, { total: number; falseNeg: number }> = {};
  for (const c of cases) {
    const e = byCategory[c.category] ?? { total: 0, falseNeg: 0 };
    e.total += 1;
    if (c.outcome === 'FALSE_NEGATIVE') {
      e.falseNeg += 1;
    }
    byCategory[c.category] = e;
  }
  return {
    total,
    falseNeg,
    falseNegRate: total > 0 ? falseNeg / total : 0,
    byMechanism,
    byCategory,
  };
}

const summary = {
  primaryMatrix: summarize(results),
  combinedAttacks: summarize(combinedResults),
  mitigationMeasurements,
};

console.warn(JSON.stringify(summary, null, 2));

writeFileSync(`${OUT_DIR}/check-table.json`, JSON.stringify(CHECK_TABLE, null, 2));
writeFileSync(`${OUT_DIR}/attack-matrix.json`, JSON.stringify(results, null, 2));
writeFileSync(`${OUT_DIR}/combined-attacks.json`, JSON.stringify(combinedResults, null, 2));
writeFileSync(
  `${OUT_DIR}/mitigation-measurements.json`,
  JSON.stringify(mitigationMeasurements, null, 2),
);
writeFileSync(`${OUT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
writeFileSync(`${OUT_DIR}/legitimate-corpus.json`, JSON.stringify(LEGITIMATE_TEXTS, null, 2));
