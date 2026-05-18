/**
 * Verdict types — Shams al-Asrār
 * --------------------------------------------------------------------------
 * The OUTPUT contract of the KP judgment layer. Every reading produces
 * exactly this shape; the UI Verdict card renders it; the History store
 * persists it; Phase 4 PDF export reads it.
 *
 * Shape mirrors the contract specified in the master build prompt
 * ("Output Contract — What the Engine Returns") and is FROZEN as of
 * Phase 1. Additive changes (new optional fields) are allowed in later
 * phases; renames/removals require a major engineVersion bump.
 */

import type { Chart, HouseIndex, Planet, Pada, NakshatraIndex, SignIndex } from './chart';
import type { ClassifiedQuestion, QuestionType } from './question';
import type { SignificatorSets } from '../kp/judgment/significators';
import type { LangCode } from '@i18n/types';

// ── Verdict enum ───────────────────────────────────────────────────────────

/**
 * Five canonical verdicts. RKP rule: never invent additional categories
 * (no "MAYBE", no "WAIT-AND-SEE"). If the chain is unreadable, return
 * UNCLEAR — the user must rephrase or wait for a clearer planetary moment.
 */
export type VerdictKind = 'YES' | 'NO' | 'CONDITIONAL' | 'DELAYED' | 'UNCLEAR' | 'DENIED';

// ── Significator chain ─────────────────────────────────────────────────────

/**
 * Snapshot of the Moon's Sub-Lord — the decisive signal in the current
 * 5-step RKP engine.
 */
export interface MoonSubLordSnapshot {
  /** The Moon's sub-lord planet itself. */
  readonly planet: Planet;

  /** Nakshatra lord of the Moon's sub-lord, used for timing. */
  readonly nakshatraLord: Planet;

  /** The sub-lord of the Moon's sub-lord (proportional division). */
  readonly subLord: Planet;

  /** The sub-sub-lord for precision timing. */
  readonly subSubLord: Planet;

  /** Placidus house occupied by the Moon's sub-lord. */
  readonly occupiedHouse: HouseIndex;

  /** Houses signified by the runtime engine. Currently just the occupied house. */
  readonly signifiedHouses: readonly HouseIndex[];

  /** Subset of signifiedHouses that match the question's favorable matrix. */
  readonly favHits: readonly HouseIndex[];

  /** Subset of signifiedHouses that match the question's denial matrix. */
  readonly denHits: readonly HouseIndex[];
}

// ── Primary cusp detail ────────────────────────────────────────────────────

/**
 * Detailed view of the matter-specific cusp kept for context and traceability.
 * The current engine does not base the verdict on this cusp's sub-lord.
 */
export interface QuestionCuspDetail {
  readonly house: HouseIndex;
  readonly sign: SignIndex;
  readonly degreeInSign: number;
  readonly nakshatra: NakshatraIndex;
  readonly nakshatraLord: Planet;
  readonly subLord: Planet;
  readonly subSubLord: Planet;
  readonly pada: Pada;
}

// ── Ruling planets snapshot ────────────────────────────────────────────────

/**
 * RKP uses 5 Ruling Planets for confidence:
 *   1. Day Lord      — planet ruling the weekday
 *   2. ASC Sign Lord — classical sign lord of the Ascendant
 *   3. ASC Star Lord — nakshatra lord of the Ascendant
 *   4. Moon Sign Lord — classical sign lord of Moon's sign
 *   5. Moon Star Lord — nakshatra lord of Moon's position
 *
 * horaLord is retained from chart computation for traceability.
 * agreementScore = count of 5 RPs that agree with the verdict direction.
 */
export interface RulingPlanetsSnapshot {
  readonly dayLord: Planet;
  readonly horaLord?: Planet;
  readonly ascSignLord: Planet;
  readonly ascStarLord: Planet;
  readonly moonSignLord: Planet;
  readonly moonStarLord: Planet;
  /** Count of the 5 RPs that agree with the verdict direction. */
  readonly agreementScore: number;
}

// ── Timing ─────────────────────────────────────────────────────────────────

export type TimingWindow = 'days' | 'weeks' | 'months' | 'years';

export interface TransitTrigger {
  readonly planet: Planet;
  /** ISO 8601 UTC of the projected transit hit. */
  readonly date: string;
}

export interface DoubleTransitSignal {
  readonly active: boolean;
  readonly planets: readonly Planet[];
  readonly detail: string;
}

export interface VerdictTiming {
  readonly window: TimingWindow;
  /** Inclusive range of `window` units until the event. */
  readonly range: { readonly min: number; readonly max: number };
  readonly activeDasha: Planet;
  readonly activeAntardasha: Planet;
  readonly activePratyantardasha: Planet;
  /** Up to 3 transit windows that activate the significators. */
  readonly transitTriggers: readonly TransitTrigger[];
  readonly doubleTransitSignal?: DoubleTransitSignal;
}

// ── Remedy ─────────────────────────────────────────────────────────────────

/**
 * Remedy guidance is OPTIONAL on the engine output. Absence indicates the
 * RKP rules did not produce an unambiguous remedy planet for this chart.
 * UI hides the remedy card when undefined.
 */
export interface VerdictRemedy {
  /** Planet whose energy is to be supported (favorable significator). */
  readonly planet: Planet;
  /** Islamic action recommendation (recitation, sadaqah, dua). */
  readonly action: string;
  /** What to avoid or be mindful of. */
  readonly avoid: string;
  readonly zikr?: string;
  readonly charity?: string;
}

// ── Narration ──────────────────────────────────────────────────────────────

/**
 * Three SEPARATE narration templates per verdict. NEVER machine-translated.
 * Each is composed by `narration.ts` from RKP rule hits + cultural register
 * appropriate to the language.
 */
export interface VerdictNarration {
  readonly en: string;
  readonly ur: string;
  readonly hi: string;
}

// ── Reasoning trace ────────────────────────────────────────────────────────

/**
 * One entry per RKP rule hit that contributed to the verdict. Order matches
 * evaluation order so a reviewer can replay the decision.
 *
 * `ruleId` is a stable identifier ("MOON_SUB_FAV_HIT", "RP_AGREEMENT_HIGH",
 * "RETROGRADE_DENIAL") — UI groups by this for the "Why" section.
 *
 * `weight` is the contribution to the verdict, signed:
 *   positive => moves toward YES
 *   negative => moves toward NO
 *   zero     => informational only (e.g. retrograde flag)
 */
export interface ReasoningStep {
  readonly ruleId: string;
  readonly description: string;
  readonly weight: number;
  /** Optional structured payload for renderers (e.g. planet names involved). */
  readonly meta?: Readonly<Record<string, string | number | boolean>>;
}

// ── The verdict itself ─────────────────────────────────────────────────────

/**
 * Complete verdict — everything the UI/history/PDF needs to render.
 *
 * `chart` is embedded by reference (the full Chart object). This makes
 * History records self-contained: a saved reading retains the exact chart
 * that produced it, even if the engine version updates later.
 */
export interface Verdict {
  /** Stable id assigned at creation (UUID v4). */
  readonly id: string;

  /** ISO 8601 UTC of when the verdict was computed (= question moment). */
  readonly computedAt: string;

  /** Snapshot of the question that triggered this verdict. */
  readonly question: ClassifiedQuestion;

  /** Question category — duplicated for filter/index convenience. */
  readonly qType: QuestionType;

  /** The Prashna chart. Self-contained for replay. */
  readonly chart: Chart;

  /** Houses the RKP rules treat as favorable for this question type. */
  readonly favorableHouses: readonly HouseIndex[];

  /** Houses the RKP rules treat as denial for this question type. */
  readonly denialHouses: readonly HouseIndex[];

  /** Detail of the matter-specific cusp (usually 1st or matter-specific house). */
  readonly questionCusp: QuestionCuspDetail;

  /** Decisive Moon-sub-lord snapshot used by the runtime engine. */
  readonly moonSubLord: MoonSubLordSnapshot;

  /** Ruling Planets snapshot at chart moment. */
  readonly rulingPlanets: RulingPlanetsSnapshot;

  /** The verdict itself. */
  readonly verdict: VerdictKind;

  /** Confidence in the verdict, [0, 100]. */
  readonly confidence: number;

  /** Stage of evaluation that produced the verdict. */
  readonly stage: 'promise_failed' | 'fructification';

  /** Ordered trace of rules that produced the verdict. */
  readonly reasoning: readonly ReasoningStep[];

  /** Timing information — when (if YES/CONDITIONAL/DELAYED). Absent for DENIED. */
  readonly timing?: VerdictTiming;

  /** Remedy guidance (optional — see VerdictRemedy doc). */
  readonly remedy?: VerdictRemedy;

  /** Per-language narration. Always all three present. */
  readonly narration: VerdictNarration;

  /** KP significator sets for this question (Phase B). */
  readonly significators?: SignificatorSets;

  /** Ruling planets that are also favorable significators — decisive witnesses. */
  readonly confirmedSignificators?: readonly Planet[];

  /** Ruling planets that are also denial significators — opposing witnesses. */
  readonly deniedSignificators?: readonly Planet[];

  /** Planets currently retrograde at chart moment. */
  readonly retrogradeFlags: readonly Planet[];

  /** Planets currently combust at chart moment. */
  readonly combustFlags: readonly Planet[];

  /** Engine version that produced this verdict. */
  readonly engineVersion: string;
}

/**
 * Lightweight summary used in History list rows where rendering the full
 * Verdict (with embedded Chart) would be wasteful.
 */
export interface VerdictSummary {
  readonly id: string;
  readonly computedAt: string;
  readonly questionText: string;
  readonly qType: QuestionType;
  readonly verdict: VerdictKind;
  readonly confidence: number;
  readonly lang: LangCode;
}
