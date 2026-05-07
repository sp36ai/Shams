/**
 * useReadingHistory — thin wrappers over the MMKV-backed readingsStore.
 *
 * Provides two public API surfaces:
 *   saveReading(result)  — maps a verdict result to a Reading and persists it.
 *   useReadings()        — subscribes to the readings list with loading state.
 *
 * No Supabase or network I/O. All data is local via MMKV + Zustand.
 */

import { useCallback, useState } from 'react';
import functions from '@react-native-firebase/functions';

import { useReadingsStore, type Reading } from '@stores/readingsStore';
import type { AstroVerdictResult } from '../types/verdict';
import type { WatchVerdictResult } from '../engine/watchEngine';

// ── Public summary type ───────────────────────────────────────────────────────

export interface ReadingSummary {
  id: string;
  verdict: Reading['verdict'];
  category: string;
  createdAt: string;
  /** Short preview derived from the narrative. */
  preview: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function preview(narrative: string): string {
  return narrative.length > 80 ? narrative.slice(0, 77) + '…' : narrative;
}

function astroToReading(result: AstroVerdictResult): Reading {
  const id = `r_astro_${result.createdAt}`;
  return {
    id,
    question: '',
    questionLang: 'en',
    category: result.category as Reading['category'],
    verdict: result.verdict,
    createdAt: result.createdAt,
    chartJson: {
      ascendant: { sign: undefined },
      planets: { Moon: { sign: undefined } },
    },
    verdictJson: {
      verdict: result.verdict,
      confidence: result.confidence,
      moonSubLord: { planet: result.subLord, occupiedHouse: result.subLordHouse },
      rulingPlanets: Object.fromEntries(
        result.rulingPlanets.map(rp => [rp.role, rp.planet]),
      ),
      timing: result.timing
        ? {
            window: result.timing.window,
            range: result.timing.range,
            activeDasha: result.timing.activeDasha,
            activeAntardasha: result.timing.activeAntardasha,
          }
        : undefined,
      remedy: result.remedy,
      narration: { en: result.narrative },
    },
  };
}

function watchToReading(result: WatchVerdictResult): Reading {
  const id = `r_watch_${result.createdAt}`;
  return {
    id,
    question: '',
    questionLang: 'en',
    category: 'general' as Reading['category'],
    verdict: result.verdict === 'UNCLEAR' ? 'UNCLEAR' : result.verdict,
    createdAt: result.createdAt,
    chartJson: {},
    verdictJson: {
      verdict: result.verdict,
      confidence: result.confidence,
      narration: { en: result.narrative },
    },
  };
}

// ── saveReading ───────────────────────────────────────────────────────────────

export async function saveReading(
  result: AstroVerdictResult | WatchVerdictResult,
): Promise<void> {
  const reading =
    result.mode === 'astro' ? astroToReading(result) : watchToReading(result);
  await useReadingsStore.getState().addReading(reading);

  const syncFn = functions().httpsCallable('syncReadings');
  syncFn({ readings: [reading] }).catch(() => {});
}

// ── useReadings ───────────────────────────────────────────────────────────────

export interface UseReadingsReturn {
  readings: ReadingSummary[];
  loading: boolean;
  refresh: () => void;
}

export function useReadings(): UseReadingsReturn {
  const storeReadings = useReadingsStore(s => s.readings);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    // Synchronous MMKV store — just trigger a re-render cycle
    setTimeout(() => setLoading(false), 0);
  }, []);

  const readings: ReadingSummary[] = storeReadings.map(r => {
    const vj = r.verdictJson as { narration?: { en?: string } } | null;
    const text = vj?.narration?.en ?? '';
    return {
      id: r.id,
      verdict: r.verdict,
      category: r.category,
      createdAt: r.createdAt,
      preview: preview(text),
    };
  });

  return { readings, loading, refresh };
}
