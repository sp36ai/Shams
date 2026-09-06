/**
 * ThemeProvider — active theme context with live switching + MMKV persistence.
 * --------------------------------------------------------------------------
 * Why this is separate from I18nProvider:
 *   - Theme changes do NOT require native restart (unlike RTL flip).
 *   - Theme changes do NOT need to be applied before first render (we can
 *     render with default and swap on next paint without flicker IF we read
 *     the persisted id synchronously from MMKV in the initializer).
 *
 * The provider exposes:
 *   - theme           : full Theme object (colors + spacing + radius + ...)
 *   - themeId         : the active id ('teal' | 'midnightGold' | ...)
 *   - setThemeId(id)  : switch + persist
 *   - statusBarStyle  : 'light-content' | 'dark-content' — caller passes to
 *                       <StatusBar /> at the root.
 *
 * Status-bar contrast rule:
 *   All five Phase-1 themes are dark-surface, so status bar content is
 *   light. If we add a light theme later, derive from theme.colors.background
 *   luminance (use a YIQ check) — do NOT add an `isDark` boolean to ThemeColors,
 *   that creates a stale source of truth.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { StatusBarStyle } from 'react-native';

import { storage, KEYS } from '@storage/mmkv';
import { useQuotaStore } from '@stores/quotaStore';

import {
  DEFAULT_THEME_ID,
  getTheme,
  isThemeUnlocked,
  isValidThemeId,
  THEMES,
  type Theme,
  type ThemeId,
} from './themes';

interface ThemeContextValue {
  theme: Theme;
  themeId: ThemeId;
  /** Switch theme and persist. No restart required. */
  setThemeId: (id: ThemeId) => void;
  /** All available themes (for the picker UI in Settings). */
  availableThemes: ReadonlyArray<Theme>;
  /** What the root <StatusBar> should render as for this theme. */
  statusBarStyle: StatusBarStyle;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Read persisted theme id synchronously. Used by initializer so the very first
 * render uses the correct theme (no flicker).
 *
 * Also enforces tier gating at cold start: `useQuotaStore`'s plan is itself
 * rehydrated synchronously from MMKV at module load (see quotaStore.ts), so
 * reading `.getState().plan` here is safe and correct on the very first
 * render. A persisted theme the current plan no longer covers — most often
 * a lapsed Mureed/Khāṣṣ subscription — falls back to the free default rather
 * than rendering a theme the user can no longer access.
 */
export function readPersistedThemeId(): ThemeId {
  const raw = storage.getString(KEYS.SETTINGS_THEME);
  if (!isValidThemeId(raw)) {
    return DEFAULT_THEME_ID;
  }
  const plan = useQuotaStore.getState().plan;
  return isThemeUnlocked(raw, plan) ? raw : DEFAULT_THEME_ID;
}

interface ThemeProviderProps {
  /** Initial theme id. If omitted, reads from MMKV. */
  initialThemeId?: ThemeId;
  children: React.ReactNode;
}

export function ThemeProvider({
  initialThemeId,
  children,
}: ThemeProviderProps): React.ReactElement {
  const [themeId, setThemeIdState] = useState<ThemeId>(
    () => initialThemeId ?? readPersistedThemeId(),
  );

  // Persist whenever theme changes.
  useEffect(() => {
    const stored = storage.getString(KEYS.SETTINGS_THEME);
    if (stored !== themeId) {
      storage.set(KEYS.SETTINGS_THEME, themeId);
    }
  }, [themeId]);

  const setThemeId = useCallback((id: ThemeId): void => {
    setThemeIdState(id);
    storage.set(KEYS.SETTINGS_THEME, id);
  }, []);

  // Live downgrade: a subscription can lapse mid-session (a webhook-driven
  // quotaStore.setPlan happening while the app is open), not only between
  // launches. If that leaves the active theme locked, fall back to the free
  // default immediately rather than leaving the user on a theme their plan
  // no longer covers until next cold start.
  const plan = useQuotaStore(s => s.plan);
  useEffect(() => {
    if (!isThemeUnlocked(themeId, plan)) {
      setThemeId(DEFAULT_THEME_ID);
    }
  }, [plan, themeId, setThemeId]);

  const value = useMemo<ThemeContextValue>(() => {
    const theme = getTheme(themeId);
    return {
      theme,
      themeId,
      setThemeId,
      availableThemes: Object.values(THEMES),
      // Source of truth is themes.ts (designer-controlled per palette),
      // not a runtime luminance computation.
      statusBarStyle: theme.colors.statusBarStyle,
    };
  }, [themeId, setThemeId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error('useTheme() called outside <ThemeProvider>. Wrap your app root.');
  }
  return ctx;
}

/**
 * Convenience hook for the common case of just needing colors.
 * Saves the boilerplate `const { theme: { colors } } = useTheme()`.
 */
export function useColors(): Theme['colors'] {
  return useTheme().theme.colors;
}
