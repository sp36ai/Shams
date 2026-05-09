/**
 * readingsStore — local cache of RKP readings.
 * --------------------------------------------------------------------------
 * The shell is local-only. A reading is written to MMKV immediately after
 * judgment so History opens instantly and still works offline.
 */

import { create } from 'zustand';

import type { QuestionType } from '@astrology/kp/rules/houseMatrix';
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
}

export type ReadingFilter = 'all' | VerdictKind;
export type ReadingSort = 'newest' | 'oldest';

const CACHE_LIMIT = 100;

export interface ReadingsState {
  readings: Reading[];
  filter: ReadingFilter;
  sort: ReadingSort;
  addReading: (reading: Reading) => Promise<void>;
  deleteReading: (id: string) => Promise<void>;

  setFilter: (f: ReadingFilter) => void;
  setSort: (s: ReadingSort) => void;
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
  filter: 'all',
  sort: 'newest',

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

  setFilter: (f: ReadingFilter): void => set({ filter: f }),
  setSort: (s: ReadingSort): void => set({ sort: s }),

  clearAll: (): void => {
    storage.delete(KEYS.READINGS_CACHE);
    set({ readings: [], filter: 'all', sort: 'newest' });
  },
}));

/* -------------------------------------------------------------------------- */
/*  Derived selectors                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Apply current filter + sort to the readings list. Memoize the call site
 * with useMemo if rendering large lists, but for v1 the cap of 100 makes
 * this cheap.
 */
export function selectFilteredReadings(s: ReadingsState): Reading[] {
  const filtered = s.filter === 'all' ? s.readings : s.readings.filter(r => r.verdict === s.filter);
  return [...filtered].sort((a, b) =>
    s.sort === 'newest' ? (a.createdAt < b.createdAt ? 1 : -1) : a.createdAt > b.createdAt ? 1 : -1,
  );
}

export const selectIsEmpty = (s: ReadingsState): boolean => s.readings.length === 0;
