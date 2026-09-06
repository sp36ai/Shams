/**
 * Shamsi Store — Zustand state management for Shamsi Logic readings
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ShamsiVerdict, TransitTriggerResult, EventTimeline } from '@engine/rkp/shamsiLogic';
import type { AskShamsiOracleResult } from '@firebase/askShamsiOracle';

export interface ShamsiReading extends AskShamsiOracleResult {
  id: string;
  uid: string;
  savedAt: number;
  isFavorite: boolean;
  tags: string[];
}

export interface ShamsiStoreState {
  // Readings
  readings: ShamsiReading[];
  addReading: (reading: ShamsiReading) => void;
  deleteReading: (readingId: string) => void;
  toggleFavorite: (readingId: string) => void;
  addTags: (readingId: string, tags: string[]) => void;
  getReadingById: (readingId: string) => ShamsiReading | undefined;

  // Location preferences
  savedLocation: { latitude: number; longitude: number } | null;
  setSavedLocation: (location: { latitude: number; longitude: number }) => void;
  clearSavedLocation: () => void;

  // Quota
  quotaRemaining: number;
  setQuotaRemaining: (count: number) => void;

  // UI state
  lastEventTimeline: EventTimeline;
  setLastEventTimeline: (timeline: EventTimeline) => void;
}

export const useShamsiStore = create<ShamsiStoreState>(
  persist(
    set => ({
      // Readings
      readings: [],
      addReading: reading =>
        set(state => ({
          readings: [reading, ...state.readings],
        })),
      deleteReading: readingId =>
        set(state => ({
          readings: state.readings.filter(r => r.id !== readingId),
        })),
      toggleFavorite: readingId =>
        set(state => ({
          readings: state.readings.map(r =>
            r.id === readingId ? { ...r, isFavorite: !r.isFavorite } : r,
          ),
        })),
      addTags: (readingId, tags) =>
        set(state => ({
          readings: state.readings.map(r =>
            r.id === readingId
              ? { ...r, tags: [...new Set([...r.tags, ...tags])] }
              : r,
          ),
        })),
      getReadingById: readingId =>
        // This is a selector, not a state setter — just compute it
        (state: ShamsiStoreState) => state.readings.find(r => r.id === readingId),

      // Location
      savedLocation: null,
      setSavedLocation: location => set({ savedLocation: location }),
      clearSavedLocation: () => set({ savedLocation: null }),

      // Quota
      quotaRemaining: 5, // Default free tier
      setQuotaRemaining: count => set({ quotaRemaining: count }),

      // UI
      lastEventTimeline: 'macro' as EventTimeline,
      setLastEventTimeline: timeline => set({ lastEventTimeline: timeline }),
    }),
    {
      name: 'shamsi-store', // localStorage key
      partialize: state => ({
        savedLocation: state.savedLocation,
        quotaRemaining: state.quotaRemaining,
        lastEventTimeline: state.lastEventTimeline,
        readings: state.readings.slice(0, 50), // Keep last 50 for offline access
      }),
    },
  ),
);
