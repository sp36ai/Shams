/**
 * narrationValidator.ts — the deterministic Oracle safety boundary.
 * --------------------------------------------------------------------------
 * PHASE 4. See docs/audit/PHASE_4_SAFETY_VALIDATION_IMPLEMENTATION.md for
 * the full architecture record, docs/audit/PHASE_4_HISTORICAL_VALIDATOR_ANALYSIS.md
 * for why the deleted safetyValidator.ts was not restored, and
 * docs/audit/PHASE_3_CLAIM_SURFACE.md for the Allowed/Derived/Forbidden
 * categories this file enforces.
 *
 * ABSOLUTE RULE, stated in code as well as in the docs: this file makes NO
 * network call, calls NO model, and asks NOTHING to judge itself. Every
 * check below is a plain comparison between narration text and a specific
 * `ReadingContract` field, computed synchronously, in memory. If a claim
 * cannot be checked this way, it is not checked — see each function's own
 * comment for what it deliberately does not attempt, rather than silently
 * pretending coverage that doesn't exist.
 *
 * This file does not compute a judgment, diagnosis, or remedy, and does not
 * modify `ReadingContract` — every function here is `(contract, text) =>
 * result`, never `(contract) => contract`.
 */

import type { ReadingContract } from './readingContract';
import type { NarrationFields } from './responseComposer';
import { REMEDY_LIBRARY } from './remedyLibrary';
import { PLANET_NAME, PLANET_NAME_SHORT, SIGN_META } from '../engine/rkp/nomenclature';
import type { Direction } from '../engine/rkp/nomenclature';
import type { SignIndex } from '../engine/types/chart';
import type { Planet } from '../engine/types/chart';
import {
  canonicalizeForSecurityMatching,
  stripUnicodeNoiseForSecurityMatching,
} from './textSecurity';

/* -------------------------------------------------------------------------- */
/*  Result types                                                              */
/* -------------------------------------------------------------------------- */

export type ValidationFailureCode =
  | 'VERDICT_CONTRADICTION'
  | 'TIMING_FABRICATION'
  | 'TIMING_ALTERATION'
  | 'REMEDY_SUBSTITUTION'
  | 'REMEDY_ADDITION'
  | 'UNAUTHORIZED_CELESTIAL_ENTITY'
  | 'DIAGNOSIS_CONTRADICTION'
  | 'UNSUPPORTED_CERTAINTY'
  | 'TERMINOLOGY_LEAKAGE'
  | 'INTERNAL_DATA_LEAKAGE'
  | 'PROMPT_INJECTION_ARTIFACT'
  | 'MALFORMED_OUTPUT'
  // PHASE 5E-R — deterministic ground-truth claim checks. See §F2 below and
  // docs/audit/PHASE_5E_R_HARDENING.md for the full field-provenance and
  // claim-recognition-strategy record.
  | 'HOUSE_CLAIM_CONTRADICTION'
  | 'SUPPORTING_HOUSE_CONTRADICTION'
  | 'SIGN_CLAIM_CONTRADICTION'
  | 'DIRECTION_CLAIM_CONTRADICTION'
  | 'RETROGRADE_CLAIM_CONTRADICTION'
  | 'RULER_RELATION_CONTRADICTION'
  | 'REVERSAL_CLAIM_CONTRADICTION';

export interface ValidationFailure {
  readonly code: ValidationFailureCode;
  /** Which NarrationFields key triggered this — for logs, never shown to the user. */
  readonly field: keyof NarrationFields | 'unknown';
  /** Human-readable detail — for logs/audit only. Never sent to the client. */
  readonly detail: string;
}

export type ValidationResult =
  | { readonly valid: true; readonly checkedFields: readonly (keyof NarrationFields)[] }
  | {
      readonly valid: false;
      readonly failures: readonly ValidationFailure[];
      readonly fallbackRequired: true;
    };

const NARRATION_FIELDS: readonly (keyof NarrationFields)[] = Object.freeze([
  'rkp_finding',
  'interpretation',
  'recommended_approach',
  'why_this_remedy',
  'signature',
]);

/* -------------------------------------------------------------------------- */
/*  Terminology / internal-data leakage — deterministic deny-lists           */
/* -------------------------------------------------------------------------- */

/**
 * Internal implementation vocabulary that must never reach the seeker.
 * Case-insensitive whole-word/phrase match. Not exhaustive of every
 * conceivable internal term — a narrow, maintained list, per this phase's
 * own "don't build a giant regex monster" instruction. Extend this list
 * deliberately if a real leak is found; do not widen it speculatively.
 */
const PROHIBITED_TERMINOLOGY: readonly string[] = Object.freeze([
  'RKP',
  'KP',
  'Krishnamurti',
  'house matrix',
  'HOUSE_MATRIX',
  'watchJudgment',
  'watchChart',
  'diagnose(',
  'selectRemedyProtocol',
  'ReadingContract',
  'NarrationContext',
  'responseComposer',
  'askWatchOracle',
  'ImbalancePattern',
  'RkpOutcome',
  'TimingPosture',
  'Abjad',
  'Jafar',
  'SBC',
  'ENGINE_VERSION',
  'engineVersion',
  'contractFingerprint',
]);

/**
 * Patterns suggesting internal/database identifiers, file paths, or
 * credential-shaped strings leaking into prose. Deliberately narrow: this
 * is not a general secrets scanner, and does not attempt to enumerate every
 * sensitive Firestore field name (see this file's header on scope).
 */
const INTERNAL_DATA_PATTERNS: readonly RegExp[] = Object.freeze([
  /\bfunctions\/src\//i,
  /\bsrc\/(engine|oracle|astrology)\//i,
  /\.ts\b/,
  /\breadings\/[A-Za-z0-9_-]{10,}/, // a Firestore-doc-id-shaped path
  /\bapi[_-]?key\b/i,
  /\bfirebase-admin\b/i,
  /\bAIza[0-9A-Za-z_-]{20,}/, // Google API key shape
  /\bsk-[A-Za-z0-9]{20,}/, // generic secret-key shape
]);

function scanForDenyList(text: string, list: readonly string[]): string | null {
  const lower = text.toLowerCase();
  for (const term of list) {
    if (lower.includes(term.toLowerCase())) {
      return term;
    }
  }
  return null;
}

function scanForPatterns(text: string, patterns: readonly RegExp[]): RegExp | null {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return pattern;
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Celestial entity allow-list resolution                                    */
/* -------------------------------------------------------------------------- */

const ALL_PLANETS: readonly Planet[] = Object.freeze([
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
  'Rahu',
  'Ketu',
]);

/**
 * Every surface form `contract.celestialEntities` might contain, or that
 * narration might legitimately use to refer to the SAME planet, resolved
 * from the repository's own existing naming tables
 * (nomenclature.ts's PLANET_NAME/PLANET_NAME_SHORT) — not invented here.
 * `obstruction`/`lagnaRuler` on a DisplayWatchVerdict carry the internal
 * English Planet id for the seven classical planets and the boundary short
 * name ('Ras'/'Dhanab') for the two nodes (see utils/planetBoundaryName.ts);
 * `targetRulerName` carries the full classical Arabic name (e.g. 'Zuhrah').
 * A validator that only recognized the exact raw string first stored in
 * `celestialEntities` would false-positive on any narration using the
 * mystical register's own classical names for the other two fields — this
 * table exists to prevent that, not to expand what counts as "in the
 * reading."
 */
const PLANET_ALIASES: Readonly<Record<Planet, readonly string[]>> = Object.freeze(
  Object.fromEntries(
    ALL_PLANETS.map(p => [p, Array.from(new Set([p, PLANET_NAME[p], PLANET_NAME_SHORT[p]]))]),
  ) as unknown as Record<Planet, readonly string[]>,
);

/** Reverse lookup: any known surface form → the Planet it names, or null. */
function resolvePlanet(name: string): Planet | null {
  for (const planet of ALL_PLANETS) {
    if (PLANET_ALIASES[planet].some(alias => alias.toLowerCase() === name.toLowerCase())) {
      return planet;
    }
  }
  return null;
}

/**
 * Expand `contract.celestialEntities` into the full set of surface forms
 * narration may legitimately use. `'MoonDisagreement'` (a real possible
 * value of `verdict.obstruction`, not a planet name — see Obstruction's own
 * type) resolves to the Moon's own alias set, since it names an affliction
 * OF the Moon, not a separate entity. Any other non-planet string (there
 * are none in practice today, since celestialEntities' own construction —
 * reviewed and closed in Phase 3 — only ever draws from
 * targetRulerName/lagnaRuler/obstruction) passes through as its own literal
 * allowed form, conservatively, rather than being dropped.
 */
function expandAllowedEntityNames(celestialEntities: readonly string[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const raw of celestialEntities) {
    if (raw === 'MoonDisagreement') {
      for (const alias of PLANET_ALIASES.Moon) {
        out.add(alias.toLowerCase());
      }
      continue;
    }
    const planet = resolvePlanet(raw);
    if (planet) {
      for (const alias of PLANET_ALIASES[planet]) {
        out.add(alias.toLowerCase());
      }
    } else {
      out.add(raw.toLowerCase());
    }
  }
  return out;
}

/**
 * Every OTHER planet's surface forms — the ones NOT in this reading's
 * allow-list. A narration mention of one of these, in a context asserting
 * it as part of THIS reading, is exactly what `celestialEntities` exists to
 * catch. Deliberately conservative about "in a context asserting it as
 * part of this reading" — see `checkCelestialEntities`'s own comment for
 * the boundary this stops short of.
 */
function disallowedEntityNames(allowed: ReadonlySet<string>): ReadonlySet<string> {
  const out = new Set<string>();
  for (const planet of ALL_PLANETS) {
    for (const alias of PLANET_ALIASES[planet]) {
      if (!allowed.has(alias.toLowerCase())) {
        out.add(alias);
      }
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  A. Verdict consistency                                                    */
/* -------------------------------------------------------------------------- */

type Polarity = 'positive' | 'negative' | 'neutral';

const OUTCOME_POLARITY: Readonly<Record<ReadingContract['diagnosis']['outcome'], Polarity>> =
  Object.freeze({
    FAVOURABLE: 'positive',
    ESCALATING: 'positive',
    UNFAVOURABLE: 'negative',
    DECLINING: 'negative',
    DELAYED: 'neutral',
    UNCERTAIN: 'neutral',
    CONDITIONAL: 'neutral',
    PREMATURE: 'neutral',
  });

/**
 * Explicit, unambiguous polarity assertions — not a general sentiment
 * detector. Deliberately narrow: catches a model stating the OPPOSITE
 * outcome outright, not every possible phrasing of it. Per this phase's
 * own instruction ("do not use vague semantic similarity"), a narrower
 * check that never false-positives on legitimate mystical prose was
 * chosen over a broader one that would.
 */
const POSITIVE_ASSERTIONS: readonly string[] = Object.freeze([
  'the matter is fulfilled',
  'the answer is yes',
  'will certainly happen',
  'is guaranteed to happen',
  'will definitely happen',
  'the matter will succeed',
  'this will surely come to pass',
]);

const NEGATIVE_ASSERTIONS: readonly string[] = Object.freeze([
  'the matter is blocked',
  'the answer is no',
  'will not happen',
  'is denied',
  'will certainly fail',
  'there is no path forward',
  'this will surely not come to pass',
]);

/**
 * Checks narration text against the settled outcome's polarity. Does NOT
 * attempt to confirm the narration correctly states the outcome — only
 * that it does not assert the OPPOSITE polarity outright. A neutral/
 * conditional outcome is checked against both lists, since neither
 * unconditional polarity is supported by a CONDITIONAL/UNCERTAIN/DELAYED/
 * PREMATURE diagnosis.
 */
export function checkVerdictConsistency(
  contract: ReadingContract,
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  const polarity = OUTCOME_POLARITY[contract.diagnosis.outcome];
  const lower = text.toLowerCase();

  if (polarity !== 'positive') {
    const hit = POSITIVE_ASSERTIONS.find(p => lower.includes(p));
    if (hit) {
      return {
        code: 'VERDICT_CONTRADICTION',
        field,
        detail: `asserted "${hit}" but diagnosis.outcome is ${contract.diagnosis.outcome}`,
      };
    }
  }
  if (polarity !== 'negative') {
    const hit = NEGATIVE_ASSERTIONS.find(p => lower.includes(p));
    if (hit) {
      return {
        code: 'VERDICT_CONTRADICTION',
        field,
        detail: `asserted "${hit}" but diagnosis.outcome is ${contract.diagnosis.outcome}`,
      };
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  B. Timing consistency                                                     */
/* -------------------------------------------------------------------------- */

/**
 * PHASE 4A: found while verifying the timing fixes below, not previously
 * documented — a real, material false-positive bug distinct from the
 * review gate's own findings. The original bare-word MONTH_NAMES list
 * included "may", which collides with the modal verb "may" ("Movement MAY
 * begin before the final outcome" — the review gate's own required-accept
 * example) and flagged it as a fabricated date. Fixed by requiring a month
 * name to be ADJACENT to a day number to count as a date (a bare month
 * mention like "since September" isn't naming a specific day either, so
 * this is a correctness improvement, not just a workaround for "may").
 * "march" and "august" carry the same lower-grade risk (real English
 * words) and get the same treatment for consistency, not because either
 * was separately demonstrated to collide.
 */
const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const MONTH_PATTERN_SOURCE = MONTH_NAMES.join('|');
/** A month name adjacent to a 1-2 digit day number, either order — "September 19", "19 September", "May 15th". */
const MONTH_DATE_PATTERN = new RegExp(
  `\\b(${MONTH_PATTERN_SOURCE})\\b[\\s,]*\\d{1,2}(st|nd|rd|th)?\\b|\\b\\d{1,2}(st|nd|rd|th)?[\\s,]*(of\\s+)?\\b(${MONTH_PATTERN_SOURCE})\\b`,
  'i',
);
const WEEKDAY_NAMES = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];
/**
 * Matches "the 15th", "on 3/4", "2026-08-15" — anything shaped like a real
 * calendar date.
 *
 * PHASE 5E-R: the bare-ordinal alternative (`the 15th`) originally matched
 * unconditionally, with no requirement that a date be plausibly meant at
 * all — `docs/audit/PHASE_5E_RECONNAISSANCE.md` §7 (Finding 5E-2)
 * demonstrated this rejects "the 10th house," a claim
 * `docs/audit/PHASE_3_CLAIM_SURFACE.md` explicitly lists as Allowed
 * ("Which house governs the matter"), and even ordinal text with no house
 * or date meaning at all ("Consider the 3rd point carefully"). Fixed
 * narrowly, not generally: a negative lookahead excludes only the
 * demonstrated collision — an ordinal directly followed by "house" or
 * "ghar" (this codebase's own two words for a chart house; see
 * `engine/rkp/nomenclature.ts`'s `gharLabel()` and `HOUSE_META`, and the
 * golden corpus's own "2nd Ghar" phrasing). It does NOT exempt every
 * ordinal that isn't a date (e.g. "the 3rd point" still matches, unchanged
 * from before this phase) — that would require guessing the referent of
 * an arbitrary noun following an ordinal, which is exactly the kind of
 * generic natural-language interpretation this phase was instructed not to
 * build. Recorded as a known, pre-existing, out-of-scope residual in
 * `docs/audit/PHASE_5E_R_HARDENING.md`, not silently expanded past the
 * one demonstrated collision.
 */
const DATE_LIKE_PATTERN =
  /\b\d{1,4}[/-]\d{1,2}([/-]\d{1,4})?\b|\bthe\s+\d{1,2}(st|nd|rd|th)\b(?!\s+(?:house|ghar)\b)/i;

/**
 * PHASE 4A: split into two tiers, per the review gate's demonstrated
 * "tomorrow"/"soon"/"this week" bypass (docs/audit/PHASE_4_REVIEW_GATE.md
 * §4). STRONG signals name a specific, concrete near-term point (a day
 * name, "today", "immediately") and are flagged unconditionally on a
 * WAIT/WAIT_LONG reading — hedging language does not make "this will
 * resolve tomorrow" a faithful presentation of a 45-90 day window. SOFT
 * signals ("soon", "shortly") are vaguer and commonly used even in
 * genuinely cautious prose (see the review gate's own "may begin moving
 * soon, but the final outcome remains within the indicated period"
 * example) — flagged only when NOT accompanied by a hedge word
 * (HEDGE_QUALIFIERS) in the same sentence. This is the smallest
 * deterministic distinction that passes the review gate's required
 * matrix without over-rejecting genuinely hedged prose — not a general
 * sentiment/certainty model.
 */
const STRONG_IMMEDIACY_SIGNALS: readonly string[] = Object.freeze([
  'immediately',
  'immediate resolution',
  'right now',
  'right away',
  'today',
  'tomorrow',
  'this instant',
  'this week',
  'without delay',
]);

const SOFT_IMMEDIACY_SIGNALS: readonly string[] = Object.freeze(['soon', 'shortly']);

/** Same list `checkUnsupportedCertainty` treats as legitimate hedges — kept
 *  local rather than imported to avoid coupling the two checks' internals;
 *  both lists exist for the same reason and are intentionally short. */
const HEDGE_QUALIFIERS: readonly string[] = Object.freeze([
  'may',
  'might',
  'could',
  'possibly',
  'perhaps',
]);

/** Extracts every "N day(s)"-shaped number mentioned in the text. */
function extractDayCounts(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+)\s*day/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(Number(m[1]));
  }
  return out;
}

/**
 * Does NOT attempt full semantic timing comprehension — see this phase's
 * own instruction on that. Three narrow, structural checks: (1) a
 * calendar-date-shaped token, which the engine never produces regardless
 * of the reading (see PHASE_3 doc's "Do not invent dates when the engine
 * does not produce dates"); (2) an immediacy claim when the diagnosis's own
 * timing posture says to wait; (3) a day-count number that falls outside
 * the settled window, when one exists, or any day-count at all when the
 * engine established none (`timing === null`).
 */
export function checkTimingConsistency(
  contract: ReadingContract,
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  const lower = text.toLowerCase();

  const monthDateMatch = MONTH_DATE_PATTERN.exec(text);
  const weekdayHit = WEEKDAY_NAMES.find(d => lower.includes(d));
  const dateMatch = DATE_LIKE_PATTERN.exec(text);
  if (monthDateMatch || weekdayHit || dateMatch) {
    return {
      code: 'TIMING_FABRICATION',
      field,
      detail: `narration names a specific calendar date/day ("${monthDateMatch?.[0] ?? weekdayHit ?? dateMatch?.[0]}"), which the engine never produces`,
    };
  }

  const { timing, timingPosture } = contract.diagnosis;

  if (timingPosture === 'WAIT' || timingPosture === 'WAIT_LONG') {
    const strongHit = STRONG_IMMEDIACY_SIGNALS.find(s => lower.includes(s));
    if (strongHit) {
      return {
        code: 'TIMING_ALTERATION',
        field,
        detail: `asserted immediacy ("${strongHit}") but timingPosture is ${timingPosture}`,
      };
    }
    const softHit = SOFT_IMMEDIACY_SIGNALS.find(s => lower.includes(s));
    if (softHit) {
      const sentence = findSentenceContaining(text, softHit).toLowerCase();
      const hedged = HEDGE_QUALIFIERS.some(h => sentence.includes(h));
      if (!hedged) {
        return {
          code: 'TIMING_ALTERATION',
          field,
          detail: `asserted immediacy ("${softHit}") but timingPosture is ${timingPosture}`,
        };
      }
    }
  }

  const dayCounts = extractDayCounts(text);
  if (dayCounts.length > 0) {
    if (timing === null) {
      return {
        code: 'TIMING_FABRICATION',
        field,
        detail: `narration states a day count (${dayCounts.join(', ')}) but diagnosis.timing is null`,
      };
    }
    const outOfRange = dayCounts.find(d => d < timing.minDays || d > timing.maxDays);
    if (outOfRange !== undefined) {
      return {
        code: 'TIMING_ALTERATION',
        field,
        detail: `narration states ${outOfRange} days, outside the settled window [${timing.minDays}, ${timing.maxDays}]`,
      };
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*  C. Remedy consistency                                                     */
/* -------------------------------------------------------------------------- */

const REMEDY_OVERRIDE_PHRASES: readonly string[] = Object.freeze([
  'instead of this remedy',
  'a better remedy would be',
  'try this instead',
  'forget the prescribed',
  'ignore the remedy above',
  'a different practice is better suited',
]);

/**
 * PHASE 5C-R: `REMEDY_LIBRARY` name, canonicalized once at module load
 * (the library is a static, frozen constant — never worth recomputing per
 * call) and lowercased, keyed by remedy id. See `checkRemedyConsistency`'s
 * own comment for why this side of the comparison must be canonicalized
 * too, not just the incoming narration text.
 */
const CANONICAL_REMEDY_NAMES: ReadonlyMap<string, string> = new Map(
  REMEDY_LIBRARY.map(r => [r.id, canonicalizeForSecurityMatching(r.name).toLowerCase()]),
);

/**
 * Structural check first: does the narration name a REAL remedy (matched
 * against the full REMEDY_LIBRARY by exact name) that this reading did NOT
 * select? An exact name match against real library content is unambiguous
 * evidence of substitution/addition, not a guess. Second, a narrow
 * override-phrase check for the "do this instead" pattern even when no
 * specific remedy name is used. Neither check attempts to catch every
 * possible phrasing — see this phase's own instruction on not confusing
 * explanatory prose ("here is why this remedy matters") with an override.
 */
export function checkRemedyConsistency(
  contract: ReadingContract,
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  const selectedIds = new Set(contract.remedy.steps.map(s => s.id));
  const lower = text.toLowerCase();

  for (const remedy of REMEDY_LIBRARY) {
    if (selectedIds.has(remedy.id)) {
      continue;
    }
    // PHASE 5C-R: `text` (renamed to `lower` above) already arrives
    // canonicalized (see validateNarration's call site) — a handful of
    // REMEDY_LIBRARY names carry legitimate diacritics ("Ṣalāt
    // al-Istikhārah", "Duʿā for Ease", "Qurʾānic Contemplation on
    // Patience", "Dhikr of Yā Laṭīf"). Canonicalizing this side of the
    // comparison too keeps matching symmetric: a canonicalized mention of
    // one of these names (with or without its diacritics — both reduce to
    // the same canonical form) is still correctly recognized, rather than
    // silently stopping to match once the incoming text side lost its
    // diacritics to canonicalization. Verified this does not change
    // behavior for any non-diacritic remedy name (canonicalization of
    // plain ASCII is a no-op).
    if (lower.includes(CANONICAL_REMEDY_NAMES.get(remedy.id)!)) {
      return {
        code: contract.remedy.steps.length > 0 ? 'REMEDY_SUBSTITUTION' : 'REMEDY_ADDITION',
        field,
        detail: `narration names "${remedy.name}" (id ${remedy.id}), which this reading did not select`,
      };
    }
  }

  const phraseHit = REMEDY_OVERRIDE_PHRASES.find(p => lower.includes(p));
  if (phraseHit) {
    return {
      code: 'REMEDY_SUBSTITUTION',
      field,
      detail: `override phrase "${phraseHit}" found`,
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*  D. Celestial entity validation                                            */
/* -------------------------------------------------------------------------- */

/**
 * Flags a mention of a planet NOT in `contract.celestialEntities`'s
 * expanded allow-list. Deliberately does not attempt to distinguish "the
 * narration asserts this planet is part of the reading" from "the
 * narration uses the word in an unrelated, generic sense" (e.g. a stock
 * mystical turn of phrase that happens to name a planet) — per this
 * phase's brief ("do not accidentally prohibit harmless general language
 * unless it creates a reading-specific factual claim"), this is exactly
 * the boundary a keyword scanner cannot safely draw, so this check is
 * scoped narrowly: it only flags a *disallowed planet name appearing at
 * all*, which is a conservative, fail-closed choice for a genuinely
 * high-value claim category, stated here rather than left implicit.
 *
 * The allow-list is also widened, for this check only, to include any
 * planet named inside the deterministic names of THIS reading's own
 * selected remedy steps (`contract.remedy.steps[].name`) — e.g. "Zuhal
 * Observance of Discipline" can be selected on `targetConditions`/pattern
 * grounds alone, independent of whether Zuhal/Saturn is this reading's
 * `obstructingAgent` (real behavior of the deterministic
 * `selectRemedyProtocol()`, confirmed by a test in
 * narrationValidator.test.ts that caught this as a false positive before
 * this widening was added). This is not an expansion of
 * `celestialEntities` itself (untouched, still exactly Phase 3's reviewed
 * construction) — it recognizes that a remedy's own already-authoritative,
 * deterministic name is not narration invention when repeated verbatim.
 */
export function checkCelestialEntities(
  contract: ReadingContract,
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  const allowed = new Set(expandAllowedEntityNames(contract.celestialEntities));
  for (const step of contract.remedy.steps) {
    for (const planet of ALL_PLANETS) {
      if (
        PLANET_ALIASES[planet].some(alias => step.name.toLowerCase().includes(alias.toLowerCase()))
      ) {
        for (const alias of PLANET_ALIASES[planet]) {
          allowed.add(alias.toLowerCase());
        }
      }
    }
  }
  const disallowed = disallowedEntityNames(allowed);

  for (const name of disallowed) {
    const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i');
    if (re.test(text)) {
      return {
        code: 'UNAUTHORIZED_CELESTIAL_ENTITY',
        field,
        detail: `narration names "${name}", not present in this reading's celestialEntities allow-list`,
      };
    }
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* -------------------------------------------------------------------------- */
/*  E. Diagnosis consistency                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Checks a narrower, higher-confidence claim than "does the prose fully
 * agree with the diagnosis" (that would require real language
 * understanding this file deliberately does not attempt — see this file's
 * header). It checks one structural fact: if the narration explicitly
 * names an obstructing agent by a planet's surface form, that planet must
 * be `diagnosis.obstructingAgent` (or, when there is none, no planet
 * should be blamed as an obstruction at all via an explicit "X obstructs"/
 * "X blocks this" phrase).
 */
export function checkDiagnosisConsistency(
  contract: ReadingContract,
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  const { obstructingAgent } = contract.diagnosis;
  const lower = text.toLowerCase();

  const OBSTRUCTION_PHRASES = ['obstructs this matter', 'blocks this matter', 'stands in the way'];
  const phraseHit = OBSTRUCTION_PHRASES.find(p => lower.includes(p));
  if (!phraseHit) {
    return null;
  }

  // Which planet, if any, is named in the same sentence as the obstruction phrase?
  const sentenceMatch = findSentenceContaining(text, phraseHit);
  const namedPlanet = ALL_PLANETS.find(p =>
    PLANET_ALIASES[p].some(alias => sentenceMatch.toLowerCase().includes(alias.toLowerCase())),
  );

  if (namedPlanet === undefined) {
    return null; // no specific planet named — nothing to contradict
  }

  const expectedAliases = obstructingAgent
    ? new Set(
        (resolvePlanet(obstructingAgent)
          ? PLANET_ALIASES[resolvePlanet(obstructingAgent)!]
          : [obstructingAgent]
        ).map(a => a.toLowerCase()),
      )
    : new Set<string>();

  const namedMatches = PLANET_ALIASES[namedPlanet].some(a => expectedAliases.has(a.toLowerCase()));
  if (!namedMatches) {
    return {
      code: 'DIAGNOSIS_CONTRADICTION',
      field,
      detail: `narration names ${namedPlanet} as the obstruction, but diagnosis.obstructingAgent is ${obstructingAgent ?? 'none'}`,
    };
  }
  return null;
}

function findSentenceContaining(text: string, needle: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx === -1) {
    return '';
  }
  const start = Math.max(0, text.lastIndexOf('.', idx) + 1);
  const end = text.indexOf('.', idx);
  return text.slice(start, end === -1 ? text.length : end + 1);
}

/* -------------------------------------------------------------------------- */
/*  E2. Ground-truth structural/relational claim checks (PHASE 5E-R)          */
/* -------------------------------------------------------------------------- */

/**
 * PHASE 5E-R. `docs/audit/PHASE_5E_RECONNAISSANCE.md` (Finding 5E-1) showed
 * `judgment.targetHouse`, `.targetSignName`, `.direction`, `.rulerRelation`,
 * `.reversal`, and `diagnosis.supportingHouses` are structured facts the
 * contract already carries, verbatim from the engine, that narration could
 * contradict with zero detection — the same "ground-truth cross-check" gap
 * `docs/audit/SAFETY_VALIDATION_REDESIGN.md` named and Phase 4/4A only
 * partially closed (verdict polarity, timing posture, one obstruction
 * phrase). Every check below follows that same, already-established idiom:
 * a small, named phrase list (or a single bounded regex) anchors on a
 * specific claim SHAPE, `findSentenceContaining()` narrows to the sentence
 * making it, a small bounded extractor reads the claimed value out of that
 * sentence, and the result is compared against one specific
 * `ReadingContract` field. None of this derives a new judgment — every
 * comparison is against a value `judgeWatchChart()`/`diagnose()` already
 * computed and the contract already carries frozen. See
 * `docs/audit/PHASE_5E_R_HARDENING.md` for the full field-provenance trace,
 * why each detector is scoped exactly this narrowly, and why the eighth
 * category Finding 5E-1 named — "invented diagnostic cause"
 * (`diagnosis.rationale`'s free-text content) — is NOT implemented here:
 * recognizing an arbitrary narrated "because X" clause well enough to
 * compare it against a free-text rationale array reliably would require
 * exactly the generic natural-language interpretation this phase was
 * instructed not to build, so it is documented as an open finding instead
 * of a fragile keyword heuristic.
 */

/**
 * Extracts a 1-12 house number from "house number N" / "house N" / "house
 * #N", or "Nth house" / "Nth ghar" (this codebase's own two words for a
 * chart house — see `engine/rkp/nomenclature.ts`'s `gharLabel()`/
 * `HOUSE_META`). Deliberately two fixed shapes, not a general number
 * parser — a sentence with neither shape yields no claim, not a guess.
 */
const HOUSE_NUMBER_PATTERN =
  /\bhouse\s*(?:number|#)?\s*(\d{1,2})\b|\b(\d{1,2})(?:st|nd|rd|th)\s+(?:house|ghar)\b/gi;

function extractHouseNumbers(sentence: string): number[] {
  const found: number[] = [];
  for (const match of sentence.matchAll(HOUSE_NUMBER_PATTERN)) {
    const raw = match[1] ?? match[2];
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    if (n >= 1 && n <= 12) {
      found.push(n);
    }
  }
  return found;
}

/**
 * Target-house claim: does narration say a specific house "governs"/"rules"
 * this matter, and if so, does the number match `judgment.targetHouse`?
 * Bounded to this one claim shape — restating a house number in any other
 * sentence structure is simply not checked, per this phase's explicit
 * instruction to prefer an explicit, bounded detector over a generic parser.
 */
const TARGET_HOUSE_PHRASES: readonly string[] = Object.freeze([
  'governs this matter',
  'rules this matter',
  'is the house of this matter',
]);

export function checkHouseClaims(
  contract: ReadingContract,
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  const lower = text.toLowerCase();
  const phraseHit = TARGET_HOUSE_PHRASES.find(p => lower.includes(p));
  if (!phraseHit) {
    return null;
  }
  const claimed = extractHouseNumbers(findSentenceContaining(text, phraseHit));
  const actual = contract.judgment.targetHouse;
  const wrong = claimed.find(h => h !== actual);
  if (wrong !== undefined) {
    return {
      code: 'HOUSE_CLAIM_CONTRADICTION',
      field,
      detail: `narration claims house ${wrong} governs this matter, but judgment.targetHouse is ${actual}`,
    };
  }
  return null;
}

/**
 * Supporting-house claim: does narration say a specific house "supports"/
 * "favors" this outcome, and if so, is that house actually in
 * `diagnosis.supportingHouses`? Same bounded shape as the target-house
 * check above, against the sibling field.
 */
const SUPPORTING_HOUSE_PHRASES: readonly string[] = Object.freeze([
  'supports this outcome',
  'actively supports',
  'favors this outcome',
  'favours this outcome',
]);

export function checkSupportingHouseClaims(
  contract: ReadingContract,
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  const lower = text.toLowerCase();
  const phraseHit = SUPPORTING_HOUSE_PHRASES.find(p => lower.includes(p));
  if (!phraseHit) {
    return null;
  }
  const claimed = extractHouseNumbers(findSentenceContaining(text, phraseHit));
  const supporting = new Set(contract.diagnosis.supportingHouses);
  const wrong = claimed.find(h => !supporting.has(h));
  if (wrong !== undefined) {
    return {
      code: 'SUPPORTING_HOUSE_CONTRADICTION',
      field,
      detail: `narration claims house ${wrong} supports this outcome, but diagnosis.supportingHouses is [${contract.diagnosis.supportingHouses.join(', ')}]`,
    };
  }
  return null;
}

/**
 * Sign claim: does narration say the matter is ruled "through"/"in"/"under"
 * the sign of a NAMED sign, and if so, does that sign match
 * `judgment.targetSignName`? Compares against every known alias of every
 * sign (classical name, "Burj <name>", and the English gloss —
 * `SIGN_META`'s own three name fields, the same alias breadth
 * `PLANET_ALIASES` already gives planets below) so narration using any of
 * this reading's own legitimate naming registers for the CORRECT sign is
 * never flagged; only a DIFFERENT sign's name in this exact claim shape is.
 */
const SIGN_PHRASES: readonly string[] = Object.freeze([
  'through the sign of',
  'in the sign of',
  'under the sign of',
]);

const ALL_SIGN_INDICES: readonly SignIndex[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function signAliases(index: SignIndex): readonly string[] {
  const meta = SIGN_META[index];
  return [meta.name, `Burj ${meta.name}`, meta.englishName];
}

/** `judgment.targetSignName` is already `"Burj <name>"` (see watchChart.ts) — resolve it back to its index. */
function resolveTargetSignIndex(targetSignName: string): SignIndex | null {
  const lower = targetSignName.toLowerCase();
  return (
    ALL_SIGN_INDICES.find(idx => `burj ${SIGN_META[idx].name}`.toLowerCase() === lower) ?? null
  );
}

export function checkSignClaims(
  contract: ReadingContract,
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  const lower = text.toLowerCase();
  const phraseHit = SIGN_PHRASES.find(p => lower.includes(p));
  if (!phraseHit) {
    return null;
  }
  const sentence = findSentenceContaining(text, phraseHit);
  const actualIndex = resolveTargetSignIndex(contract.judgment.targetSignName);
  for (const idx of ALL_SIGN_INDICES) {
    if (idx === actualIndex) {
      continue;
    }
    const hit = signAliases(idx).find(alias =>
      new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i').test(sentence),
    );
    if (hit) {
      return {
        code: 'SIGN_CLAIM_CONTRADICTION',
        field,
        detail: `narration claims the sign "${hit}", but judgment.targetSignName is ${contract.judgment.targetSignName}`,
      };
    }
  }
  return null;
}

/**
 * Direction claim: does narration say the matter's direction is a NAMED
 * cardinal direction, and if so, does it match `judgment.direction`? The
 * engine only ever produces one of the four cardinal directions (see
 * `Direction` in nomenclature.ts) — no intercardinal claim ("Northeast")
 * is even representable by the contract, so none is checked against; a
 * narration using one would simply not match any of the four names below
 * and would pass through unflagged, same as any other unrecognized claim
 * shape.
 */
const DIRECTION_PHRASES: readonly string[] = Object.freeze([
  'points toward the',
  'points to the',
  'energy points toward',
  'direction of this matter is',
]);
const DIRECTIONS: readonly Direction[] = ['East', 'South', 'West', 'North'];

export function checkDirectionClaims(
  contract: ReadingContract,
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  const lower = text.toLowerCase();
  const phraseHit = DIRECTION_PHRASES.find(p => lower.includes(p));
  if (!phraseHit) {
    return null;
  }
  const sentence = findSentenceContaining(text, phraseHit);
  const claimed = DIRECTIONS.find(d => new RegExp(`\\b${d}\\b`, 'i').test(sentence));
  if (claimed && claimed !== contract.judgment.direction) {
    return {
      code: 'DIRECTION_CLAIM_CONTRADICTION',
      field,
      detail: `narration claims direction "${claimed}", but judgment.direction is ${contract.judgment.direction}`,
    };
  }
  return null;
}

/**
 * Retrograde claim: does narration assert a planet is retrograde, and if
 * so, does the ENGINE'S OWN output actually say so? `WatchVerdict` carries
 * no standalone retrograde boolean — but `judgment.factors` and
 * `diagnosis.rationale` are both engine-generated, verbatim text arrays
 * that DO contain a literal "is retrograde" sentence, and ONLY when
 * `rulerPos.isRetrograde` is genuinely true (confirmed by reading
 * `watchJudgment.ts`'s own `factors.push(...)` call site, gated by
 * `if (rulerPos.isRetrograde)`, and the equivalent gate in `diagnosis.ts`).
 * This is therefore a genuine ground-truth cross-check, not a blanket
 * deny-list on the word "retrograde" — an earlier draft of this check
 * rejected the word unconditionally, which `docs/audit/PHASE_5E_R_HARDENING.md`
 * records finding a real false-positive against: contract `employment-001`
 * in the existing real 11-contract pool genuinely has a retrograde ruler,
 * and its own `factors`/`rationale` say so — narration accurately
 * reflecting that must stay VALID, and only a retrograde claim UNSUPPORTED
 * by the contract's own text is a contradiction.
 */
export function checkRetrogradeClaims(
  contract: ReadingContract,
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  if (!/\bretrograde\b/i.test(text)) {
    return null;
  }
  const engineAssertsRetrograde =
    contract.judgment.factors.some(f => /\bretrograde\b/i.test(f)) ||
    contract.diagnosis.rationale.some(r => /\bretrograde\b/i.test(r));
  if (!engineAssertsRetrograde) {
    return {
      code: 'RETROGRADE_CLAIM_CONTRADICTION',
      field,
      detail:
        'narration asserts retrograde status, but neither judgment.factors nor diagnosis.rationale supports it for this reading',
    };
  }
  return null;
}

/**
 * Ruler-relation claim: does narration say the querent's ruler "regards"
 * the matter's ruler "as a friend/enemy/neutral", and if so, does it match
 * `judgment.rulerRelation`? One bounded regex, not a phrase list, because
 * the claimed word itself needs to be captured, not just detected.
 */
const RULER_RELATION_PATTERN =
  /\bregards?\b[\s\S]{0,60}?\bas\s+(?:an?\s+)?(friend|enemy|neutral)\b/i;

export function checkRulerRelationClaims(
  contract: ReadingContract,
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  const match = RULER_RELATION_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  const claimed = match[1]!.toLowerCase();
  const actual = contract.judgment.rulerRelation;
  if (claimed !== actual.toLowerCase()) {
    return {
      code: 'RULER_RELATION_CONTRADICTION',
      field,
      detail: `narration claims the ruler relation is "${claimed}", but judgment.rulerRelation is ${actual}`,
    };
  }
  return null;
}

/**
 * Reversal-likelihood claim: does narration say a reversal "is"/"remains" a
 * specific likelihood word, and if so, does it match `judgment.reversal`
 * ('POSSIBLE'/'NONE')? "Remains" is included alongside "is" because that is
 * the engine's own phrasing in `diagnosis.ts`'s real rationale text ("A
 * ruling planet is retrograde — reversal remains possible") — grounding the
 * detector's shape in genuine engine-produced language, not an invented
 * phrasing.
 */
const REVERSAL_CLAIM_PATTERN =
  /\breversal\b[\s\S]{0,40}?\b(?:is|remains)\s+(none|not\s+possible|unlikely|possible|likely|a\s+real\s+possibility)\b/i;
const REVERSAL_POSSIBLE_WORDS = new Set(['possible', 'likely', 'a real possibility']);
const REVERSAL_NONE_WORDS = new Set(['none', 'not possible', 'unlikely']);

export function checkReversalClaims(
  contract: ReadingContract,
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  const match = REVERSAL_CLAIM_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  const claimed = match[1]!.toLowerCase().replace(/\s+/g, ' ');
  const { reversal } = contract.judgment;
  const claimsPossible = REVERSAL_POSSIBLE_WORDS.has(claimed);
  const claimsNone = REVERSAL_NONE_WORDS.has(claimed);
  if ((claimsPossible && reversal !== 'POSSIBLE') || (claimsNone && reversal !== 'NONE')) {
    return {
      code: 'REVERSAL_CLAIM_CONTRADICTION',
      field,
      detail: `narration claims reversal "${claimed}", but judgment.reversal is ${reversal}`,
    };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  F. Unsupported certainty                                                  */
/* -------------------------------------------------------------------------- */

/**
 * PHASE 4A: added the natural "will definitely"/"will certainly" word
 * order alongside the original "definitely will"/"absolutely will" —
 * the review gate demonstrated the original list was order-sensitive
 * (docs/audit/PHASE_4_REVIEW_GATE.md §8). Smallest possible fix: two
 * literal additions, not a normalization engine.
 */
const CERTAINTY_PHRASES: readonly string[] = Object.freeze([
  'guaranteed',
  'without any doubt',
  'certain to happen',
  'there is no question',
  'absolutely will',
  'definitely will',
  'will definitely',
  'will certainly',
  'certainly will',
]);

/**
 * Flags unconditional-certainty language on a reading whose own confidence/
 * outcome does not support it. Confidence is the engine's own 0-1 scalar
 * (`diagnosis.confidence`); this check does not invent a new threshold
 * beyond "is this reading anything other than confidently settled" —
 * MODERATE/LOW/UNCERTAIN-confidence bands (below the existing HIGH/
 * VERY_HIGH mapping — see engine/rkp/diagnosis.ts's CONFIDENCE_SCALAR) or a
 * neutral/conditional outcome are both grounds to reject unconditional
 * certainty language, using the engine's own existing scale, not a new one.
 */
export function checkUnsupportedCertainty(
  contract: ReadingContract,
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  const { confidence, outcome } = contract.diagnosis;
  const polarity = OUTCOME_POLARITY[outcome];
  const lowConfidence = confidence < 0.8; // below the engine's own HIGH threshold
  if (polarity === 'neutral' || lowConfidence) {
    const lower = text.toLowerCase();
    const hit = CERTAINTY_PHRASES.find(p => lower.includes(p));
    if (hit) {
      return {
        code: 'UNSUPPORTED_CERTAINTY',
        field,
        detail: `asserted "${hit}" but outcome is ${outcome} at confidence ${confidence.toFixed(2)}`,
      };
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  G/H. Terminology and internal-data leakage                                */
/* -------------------------------------------------------------------------- */

/**
 * PHASE 4A: the review gate demonstrated "R.K.P."/"R-K-P"/"R K P" bypass
 * the plain substring scan below (docs/audit/PHASE_4_REVIEW_GATE.md §9).
 * Fixed narrowly, not generally: a separator-tolerant pattern for "RKP"
 * specifically (the one demonstrated bypass), not a general fuzzy matcher
 * over the whole PROHIBITED_TERMINOLOGY list. Deliberately NOT applied to
 * "KP" — a 2-letter pair is common enough at ordinary word boundaries
 * ("walk past", "look positive") that a separator-tolerant pattern for it
 * would false-positive on legitimate prose; "RKP"'s three letters make
 * that collision implausible (the pattern requires each letter to be
 * followed by ONLY whitespace/punctuation before the next, which real
 * word boundaries essentially never satisfy three letters in a row for
 * "r", "k", "p" specifically). Also not applied to multi-word terms like
 * "house matrix" — this obfuscation shape (single letters separated by
 * punctuation) only makes sense for acronyms.
 */
const RKP_OBFUSCATED_PATTERN = /r[\s.\-_]+k[\s.\-_]+p\b/i;

export function checkTerminologyLeakage(
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  const hit = scanForDenyList(text, PROHIBITED_TERMINOLOGY);
  if (hit) {
    return { code: 'TERMINOLOGY_LEAKAGE', field, detail: `prohibited term "${hit}" found` };
  }
  if (RKP_OBFUSCATED_PATTERN.test(text)) {
    return {
      code: 'TERMINOLOGY_LEAKAGE',
      field,
      detail: 'prohibited term "RKP" found (separator-obfuscated form)',
    };
  }
  return null;
}

export function checkInternalDataLeakage(
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  const hit = scanForPatterns(text, INTERNAL_DATA_PATTERNS);
  if (hit) {
    return { code: 'INTERNAL_DATA_LEAKAGE', field, detail: `matched pattern ${hit.source}` };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  I. Prompt-injection artifacts                                             */
/* -------------------------------------------------------------------------- */

/**
 * This is NOT the primary injection defense — the primary defense is that
 * every other check above compares narration against `ReadingContract`
 * regardless of why the narration said what it said, so an injected
 * instruction that successfully changed the verdict/timing/remedy/entity
 * claims is caught by those checks on its EFFECT, not by recognizing the
 * injection attempt itself. This check is a narrow, secondary signal for
 * the case an injection attempt visibly succeeded at making the model talk
 * ABOUT the injection rather than produce a contradictory claim — e.g. the
 * model echoing compliance language ("as instructed, ignoring...", "per
 * your new instructions"). A real answer to an injected question, containing
 * none of these phrases, is not caught here — it is caught (if it actually
 * contradicts the contract) by the checks above, which is the correct
 * layer for it.
 */
const INJECTION_COMPLIANCE_PHRASES: readonly string[] = Object.freeze([
  'as instructed',
  'ignoring the previous',
  'ignoring previous instructions',
  'per your new instructions',
  'as you requested, i will disregard',
  'my internal rules are',
  'my system prompt',
]);

export function checkPromptInjectionArtifacts(
  field: keyof NarrationFields,
  text: string,
): ValidationFailure | null {
  const hit = scanForDenyList(text, INJECTION_COMPLIANCE_PHRASES);
  if (hit) {
    return { code: 'PROMPT_INJECTION_ARTIFACT', field, detail: `compliance phrase "${hit}" found` };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Malformed output                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Structural shape check — every REQUIRED field non-empty, no unexpected
 * types. Distinct from the JSON-parse-and-required-field check
 * `responseComposer.ts`'s `narrate()` already performs before this
 * validator ever runs (a malformed/missing-field response returns `null`
 * there and never reaches this file at all) — this is a second, defense-
 * in-depth check for the case this validator is ever called directly with
 * a hand-built or otherwise-sourced NarrationFields value.
 */
export function checkWellFormed(
  narration: NarrationFields | null | undefined,
): ValidationFailure | null {
  if (narration === null || narration === undefined) {
    return { code: 'MALFORMED_OUTPUT', field: 'unknown', detail: 'narration is null/undefined' };
  }
  for (const field of [
    'rkp_finding',
    'interpretation',
    'recommended_approach',
    'signature',
  ] as const) {
    const value = narration[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      return { code: 'MALFORMED_OUTPUT', field, detail: `required field is empty/non-string` };
    }
  }
  if (narration.why_this_remedy !== null && typeof narration.why_this_remedy !== 'string') {
    return { code: 'MALFORMED_OUTPUT', field: 'why_this_remedy', detail: 'must be string or null' };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Orchestration                                                             */
/* -------------------------------------------------------------------------- */

const CHECKS: readonly ((
  contract: ReadingContract,
  field: keyof NarrationFields,
  text: string,
) => ValidationFailure | null)[] = Object.freeze([
  checkVerdictConsistency,
  checkTimingConsistency,
  checkRemedyConsistency,
  checkCelestialEntities,
  checkDiagnosisConsistency,
  checkHouseClaims,
  checkSupportingHouseClaims,
  checkSignClaims,
  checkDirectionClaims,
  checkRetrogradeClaims,
  checkRulerRelationClaims,
  checkReversalClaims,
  checkUnsupportedCertainty,
  (_contract, field, text) => checkTerminologyLeakage(field, text),
  (_contract, field, text) => checkInternalDataLeakage(field, text),
  (_contract, field, text) => checkPromptInjectionArtifacts(field, text),
]);

/**
 * Run every check against every prose field. Runs independently of Claude
 * and of any model — see this file's header. Never throws on well-formed
 * input; a malformed `narration` is caught by `checkWellFormed` first and
 * reported as a single `MALFORMED_OUTPUT` failure rather than reaching the
 * per-field checks at all. Any unexpected exception from an individual
 * check is caught and converted into a failure — this function itself
 * never throws (see `validateNarration`'s caller in responseComposer.ts
 * for the outer fail-closed boundary this backs up).
 */
export function validateNarration(
  contract: ReadingContract,
  narration: NarrationFields | null | undefined,
): ValidationResult {
  const malformed = checkWellFormed(narration);
  if (malformed) {
    return { valid: false, failures: [malformed], fallbackRequired: true };
  }
  const fields = narration as NarrationFields;

  const failures: ValidationFailure[] = [];
  for (const field of NARRATION_FIELDS) {
    const text = fields[field];
    if (typeof text !== 'string' || text.length === 0) {
      continue; // why_this_remedy may legitimately be null
    }
    // PHASE 5C-R: every check receives a canonicalized copy of the text,
    // never the raw string — see textSecurity.ts's own header for exactly
    // what this strips and why, and for the explicit boundary (this is
    // matching-only; `narration`/`fields` above, and everything returned
    // from this function, stay untouched — see this file's non-mutation
    // test in narrationValidatorUnicodeSecurity.test.ts).
    const canonicalText = canonicalizeForSecurityMatching(text);
    // PHASE 5D-R: the Unicode-only pass (Phase 5C-R's original transform,
    // without the new confusable fold / punctuation bridge) — see below.
    const unicodeOnlyText = stripUnicodeNoiseForSecurityMatching(text);
    for (const check of CHECKS) {
      try {
        // PHASE 5D-R: try the fully-canonicalized text first, then fall
        // back through progressively less-transformed text, down to the
        // untouched raw string. Discovered necessary during 5D-R's own
        // testing: the mid-word punctuation bridge and confusable fold,
        // applied to narration text only (never to the deny-lists/patterns
        // being compared against), can incidentally strip or fold a
        // character that a pre-existing, unrelated detector depends on
        // literally —
        //   - "HOUSE_MATRIX" bridging to "HOUSEMATRIX" (the deny-list term
        //     itself keeps its underscore): caught by the raw-text fallback.
        //   - "narrationValidator.ts" bridging to "...torts"
        //     (INTERNAL_DATA_PATTERNS' `/\.ts\b/` depends on the literal
        //     period): also caught by the raw-text fallback.
        //   - a zero-width joiner planted inside "HOUSE_MATRIX"'s own
        //     underscore: the full pass strips the ZWJ *and* bridges the
        //     underscore (losing the exact term); the raw pass keeps the
        //     underscore but still has the ZWJ splitting the substring.
        //     Neither alone catches it — only the Unicode-only middle tier
        //     does, since it removes the ZWJ without touching the
        //     underscore.
        // Each earlier tier is a strict specialization of a later one for
        // this purpose (full text obfuscation-closure > Unicode-noise
        // closure > exact pre-5C-R matching), so trying them in this order
        // never produces fewer detections than any single tier alone, and
        // the raw tier is exactly this validator's pre-5C-R behavior, so
        // it introduces no new false positive. See
        // docs/audit/PHASE_5D_R_HARDENING.md's "newly discovered findings"
        // section for the concrete regressions this closed and the
        // adversarial-harness evidence.
        const failure =
          check(contract, field, canonicalText) ??
          check(contract, field, unicodeOnlyText) ??
          check(contract, field, text);
        if (failure) {
          failures.push(failure);
        }
      } catch (err) {
        failures.push({
          code: 'MALFORMED_OUTPUT',
          field,
          detail: `validator check threw: ${String(err)}`,
        });
      }
    }
  }

  if (failures.length > 0) {
    return { valid: false, failures, fallbackRequired: true };
  }
  return { valid: true, checkedFields: NARRATION_FIELDS };
}
