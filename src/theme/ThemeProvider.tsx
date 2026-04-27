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

import {
  DEFAULT_THEME_ID,
  getTheme,
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
 */
export function readPersistedThemeId(): ThemeId {
  const raw = storage.getString(KEYS.SETTINGS_THEME);
  return isValidThemeId(raw) ? raw : DEFAULT_THEME_ID;
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
