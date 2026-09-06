/**
 * readingsStore — the local archive of cast readings.
 * --------------------------------------------------------------------------
 * A reading is written to MMKV immediately after judgment, so the archive
 * opens instantly and still works offline.
 *
 * Scope, since a second store now exists: this one holds the READING as the
 * engine produced it — verdict, confidence, composition — one entry per cast.
 * readingThreadsStore holds the Reading as the seeker experiences it: the
 * question, its moment, and the conversation about it. The two are written
 * together and this one is what pre-thread entries live in, which is why
 * Your Readings reads both.
 *
 * Filter and sort state used to live here for the old History screen's chips.
 * Both are gone: Your Readings is searched and grouped by recency instead,
 * and dead store state outlives the memory of why it was there.
 */

import { create } from 'zustand';

import type { QuestionType } from '@astrology/kp/rules/houseMatrix';
import type { DisplayWatchVerdict } from '@astrology/rkp/watchJudgment';
import type { WatchOracleComposition } from '../types/watchOracle';
import { storage, KEYS } from '@storage/mmkv';

/**
 * Catalog of question categories the engine supports.
 *
 * SOURCE OF TRUTH: `QuestionType` in `@astrology/kp/rules/houseMatrix`,
 * which is the owner-provided RKP rule set from Astro Sarfaraz. We import
 * it once and alias as `QuestionCategory` so the readings cache and filter
 * UI stay locked to the engine's category vocabulary — any new category
 * added to the RKP rules automatically propagates to TS checks across the
 * app. The alias is also exported so screens (History, Oracle) can import
 * `QuestionCategory` from this store without reaching into the engine module.
 *
 * Drift policy: NEVER define category strings outside houseMatrix.ts.
 */
export type QuestionCategory = QuestionType;

/** Mirrors Verdict.verdict from the master-prompt output contract. */
export type VerdictKind =
  | 'YES'
  | 'NO'
  | 'CONDITIONAL'
  | 'DELAYED'
  | 'UNCLEAR'
  | 'PENDING'
  | 'DENIED';

export interface Reading {
  /** Stable local id, derived at creation time. */
  id: string;
  /** Original question text as the user wrote it. */
  question: string;
  /** Detected language of the question. */
  questionLang: 'en' | 'ur' | 'hi';
  category: QuestionCategory;
  verdict: VerdictKind;
  /** ISO timestamp of when the question was asked (also the chart moment). */
  createdAt: string;
  /**
   * Full chart JSON as returned by the engine. Opaque here; History screen
   * passes through to a detail view. Phase 3 will type this as `Chart`.
   */
  chartJson: unknown;
  /**
   * Full verdict JSON (verdict, confidence, reasoning, timing, remedy, narration…).
   * Phase 3 will type this as `Verdict`.
   */
  verdictJson: unknown;
  /**
   * Watch oracle composition (diagnosis, protocol, and narration) when
   * available. Absent when askWatchOracle could not compose one — the
   * verdict still stands, only the prose/protocol layer is missing.
   */
  watch_oracle?: {
    /** The raw watch verdict from the 5-minute bracket judgment. */
    verdict: DisplayWatchVerdict;
    /** Diagnosis, protocol, and optional narration. */
    composition: WatchOracleComposition;
    /** The 5-minute bracket the question fell in. */
    window: { readonly startMinute: number; readonly endMinute: number };
    /** e.g. "Burj Jauza" — the sign on the 1st Ghar. */
    lagnaSignName: string;
    /** e.g. "Utarid" — classical name of the querent's own ruler. */
    lagnaRulerName: string;
  };
}

const CACHE_LIMIT = 100;

export interface ReadingsState {
  readings: Reading[];
  addReading: (reading: Reading) => Promise<void>;
  deleteReading: (id: string) => Promise<void>;
  clearAll: () => void;
}

/* -------------------------------------------------------------------------- */
/*  MMKV cache I/O                                                            */
/* -------------------------------------------------------------------------- */

function readCache(): Reading[] {
  const raw = storage.getString(KEYS.READINGS_CACHE);
  if (raw === undefined) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Cheap shape validation — only accept entries with required string fields.
    return parsed.filter((r): r is Reading => {
      if (typeof r !== 'object' || r === null) {
        return false;
      }
      const o = r as Record<string, unknown>;
      return (
        typeof o.id === 'string' &&
        typeof o.question === 'string' &&
        typeof o.createdAt === 'string'
      );
    });
  } catch {
    storage.delete(KEYS.READINGS_CACHE);
    return [];
  }
}

function writeCache(readings: Reading[]): void {
  // Truncate to limit, sorted newest-first to evict the oldest first.
  const sorted = [...readings].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const trimmed = sorted.slice(0, CACHE_LIMIT);
  storage.set(KEYS.READINGS_CACHE, JSON.stringify(trimmed));
}

/* -------------------------------------------------------------------------- */
/*  Store factory                                                             */
/* -------------------------------------------------------------------------- */

export const useReadingsStore = create<ReadingsState>((set, get) => ({
  readings: readCache(),

  addReading: async (reading: Reading): Promise<void> => {
    const next = [reading, ...get().readings.filter(r => r.id !== reading.id)];
    writeCache(next);
    set({ readings: next });
  },

  deleteReading: async (id: string): Promise<void> => {
    const next = get().readings.filter(r => r.id !== id);
    writeCache(next);
    set({ readings: next });
  },

  clearAll: (): void => {
    storage.delete(KEYS.READINGS_CACHE);
    set({ readings: [] });
  },
}));

/* -------------------------------------------------------------------------- */
/*  Derived selectors                                                         */
/* -------------------------------------------------------------------------- */

export const selectIsEmpty = (s: ReadingsState): boolean => s.readings.length === 0;
