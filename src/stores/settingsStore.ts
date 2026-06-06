/**
 * settingsStore — non-theme, non-i18n preferences.
 * --------------------------------------------------------------------------
 * Why so small:
 *   - Theme lives in ThemeProvider (its own context, MMKV-persisted).
 *   - Language lives in I18nProvider (same).
 *
 * What's left:
 *   - Onboarding flags (location prompt seen, location permission status known).
 *   - Last-known-location cache (used as fallback when GPS is slow on cold start
 *     so the chart construction doesn't block on a 5–10s permission round-trip).
 *
 * All values persist via MMKV synchronously.
 */

import { create } from 'zustand';

import { storage, KEYS } from '@storage/mmkv';

export type SeekerProfile = 'clarity' | 'comfort' | 'action' | 'surrender';

export interface Coords {
  lat: number;
  lon: number;
  /** Human label e.g. "Mumbai, IN". Optional — derived via reverse geocode later. */
  label: string | null;
  /** When this fix was taken (ms epoch). */
  capturedAt: number;
}

export interface SettingsState {
  /** True after the user completes the 4-slide onboarding flow. */
  hasSeenOnboarding: boolean;
  /** True after user has seen the LocationPermission screen at least once. */
  onboardingLocationPrompted: boolean;
  /** True if the OS reported permission as granted last time we checked. */
  onboardingPermissionGranted: boolean;
  /** Last known device location, or null if never captured. */
  lastLocation: Coords | null;
  /** Haiku-inferred seeker profile. null until onboarding completes. */
  seekerProfile: SeekerProfile | null;
  /** Raw onboarding answers for audit. null until onboarding completes. */
  onboardingAnswers: [string, string, string] | null;

  markOnboardingComplete: () => void;
  markLocationPrompted: () => void;
  setPermissionGranted: (granted: boolean) => void;
  setLastLocation: (coords: Coords) => void;
  clearLocation: () => void;
  setSeekerProfile: (profile: SeekerProfile, answers: [string, string, string]) => void;
}

/* -------------------------------------------------------------------------- */
/*  Rehydration                                                               */
/* -------------------------------------------------------------------------- */

function readBool(key: string, fallback: boolean): boolean {
  const v = storage.getBoolean(key);
  return v === undefined ? fallback : v;
}

function readSeekerProfile(): SeekerProfile | null {
  const v = storage.getString(KEYS.ONBOARDING_SEEKER_PROFILE);
  if (v === 'clarity' || v === 'comfort' || v === 'action' || v === 'surrender') return v;
  return null;
}

function readOnboardingAnswers(): [string, string, string] | null {
  const raw = storage.getString(KEYS.ONBOARDING_ANSWERS);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 3) return parsed as [string, string, string];
  } catch { /* ignore */ }
  return null;
}

function readLastLocation(): Coords | null {
  const lat = storage.getNumber(KEYS.LOCATION_LAST_LAT);
  const lon = storage.getNumber(KEYS.LOCATION_LAST_LON);
  const ts = storage.getNumber(KEYS.LOCATION_LAST_TIMESTAMP);
  if (lat === undefined || lon === undefined || ts === undefined) {
    return null;
  }
  const label = storage.getString(KEYS.LOCATION_LAST_LABEL);
  return {
    lat,
    lon,
    label: label ?? null,
    capturedAt: ts,
  };
}

/* -------------------------------------------------------------------------- */
/*  Store factory                                                             */
/* -------------------------------------------------------------------------- */

export const useSettingsStore = create<SettingsState>(set => ({
  hasSeenOnboarding: readBool(KEYS.ONBOARDING_SEEN, false),
  onboardingLocationPrompted: readBool(KEYS.ONBOARDING_LOCATION_PROMPTED, false),
  onboardingPermissionGranted: readBool(KEYS.ONBOARDING_PERMISSION_GRANTED, false),
  lastLocation: readLastLocation(),
  seekerProfile: readSeekerProfile(),
  onboardingAnswers: readOnboardingAnswers(),

  markOnboardingComplete: (): void => {
    storage.set(KEYS.ONBOARDING_SEEN, true);
    set({ hasSeenOnboarding: true });
  },

  markLocationPrompted: (): void => {
    storage.set(KEYS.ONBOARDING_LOCATION_PROMPTED, true);
    set({ onboardingLocationPrompted: true });
  },

  setPermissionGranted: (granted: boolean): void => {
    storage.set(KEYS.ONBOARDING_PERMISSION_GRANTED, granted);
    set({ onboardingPermissionGranted: granted });
  },

  setLastLocation: (coords: Coords): void => {
    storage.set(KEYS.LOCATION_LAST_LAT, coords.lat);
    storage.set(KEYS.LOCATION_LAST_LON, coords.lon);
    storage.set(KEYS.LOCATION_LAST_TIMESTAMP, coords.capturedAt);
    if (coords.label === null) {
      storage.delete(KEYS.LOCATION_LAST_LABEL);
    } else {
      storage.set(KEYS.LOCATION_LAST_LABEL, coords.label);
    }
    set({ lastLocation: coords });
  },

  setSeekerProfile: (profile: SeekerProfile, answers: [string, string, string]): void => {
    storage.set(KEYS.ONBOARDING_SEEKER_PROFILE, profile);
    storage.set(KEYS.ONBOARDING_ANSWERS, JSON.stringify(answers));
    set({ seekerProfile: profile, onboardingAnswers: answers });
  },

  clearLocation: (): void => {
    storage.delete(KEYS.LOCATION_LAST_LAT);
    storage.delete(KEYS.LOCATION_LAST_LON);
    storage.delete(KEYS.LOCATION_LAST_LABEL);
    storage.delete(KEYS.LOCATION_LAST_TIMESTAMP);
    set({ lastLocation: null });
  },
}));

/* -------------------------------------------------------------------------- */
/*  Selectors                                                                 */
/* -------------------------------------------------------------------------- */

export const selectHasLocation = (s: SettingsState): boolean => s.lastLocation !== null;
export const selectLocationStale = (s: SettingsState, maxAgeMs = 24 * 60 * 60 * 1000): boolean => {
  if (s.lastLocation === null) {
    return true;
  }
  return Date.now() - s.lastLocation.capturedAt > maxAgeMs;
};
