/**
 * I18nProvider — single source of truth for active language across the app.
 * --------------------------------------------------------------------------
 * Responsibilities:
 *   1. Hold the active LangCode in React state, synced to MMKV.
 *   2. Apply I18nManager.forceRTL() when language flips to/from Urdu.
 *   3. Expose t(path, params?) and switchLanguage(lang) via React context.
 *
 * RTL caveat (read this before "fixing" anything):
 *   React Native's I18nManager.forceRTL() takes effect only after a NATIVE
 *   reload. JS-only re-render is not enough — native View layout direction
 *   is set at activity creation. We mitigate by:
 *     (a) Reading persisted lang BEFORE first render in App.tsx and applying
 *         I18nManager.forceRTL synchronously.
 *     (b) On runtime switch, calling I18nManager.forceRTL + a soft-reload
 *         via DevSettings.reload() in dev or RNRestart in release. For Phase
 *         1 we accept "language switch from Urdu → English requires app
 *         restart" as a documented limitation; the in-app picker shows a
 *         toast asking the user to restart. RN 0.74 has no clean way around
 *         this without react-native-restart, which we add in Phase 1 §1.11.
 *
 * Translation function:
 *   t('oracle.welcomeMessage')                → string
 *   t('oracle.quotaRemaining', { count: 2 })  → interpolates {{count}}
 *   Missing key in strict mode → throws in __DEV__, returns key path in prod.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';

import { storage, KEYS } from '@storage/mmkv';

import en from './strings/en';
import ur from './strings/ur';
import hi from './strings/hi';
import { DEFAULT_LANG, isValidLang, LANG_META, type LangCode, type StringTable } from './types';

const TABLES: Readonly<Record<LangCode, StringTable>> = Object.freeze({
  en,
  ur,
  hi,
});

/**
 * Dot-path of a leaf in StringTable. Computed at TYPE level so t() autocompletes
 * every valid key and rejects typos at compile time.
 */
type DotPath<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? P extends ''
      ? K
      : `${P}.${K}`
    : T[K] extends object
      ? DotPath<T[K], P extends '' ? K : `${P}.${K}`>
      : never;
}[keyof T & string];

export type TranslationKey = DotPath<StringTable>;

export type TranslateFn = (
  key: TranslationKey,
  params?: Readonly<Record<string, string | number>>,
) => string;

interface I18nContextValue {
  lang: LangCode;
  isRTL: boolean;
  /** Translate. Throws on missing key in __DEV__, returns key path in production. */
  t: TranslateFn;
  /**
   * Switch language. Persists to MMKV and updates React state immediately.
   * If the new language has different layout direction than current, a native
   * reload is required for RTL flip — caller (Settings screen) must surface
   * this to the user.
   * @returns true if a native restart is needed for RTL flip, false otherwise.
   */
  switchLanguage: (next: LangCode) => boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/* -------------------------------------------------------------------------- */
/*  Lookup helpers                                                            */
/* -------------------------------------------------------------------------- */

function lookup(table: StringTable, key: string): string | undefined {
  const segments = key.split('.');
  let cursor: unknown = table;
  for (const segment of segments) {
    if (cursor !== null && typeof cursor === 'object' && segment in (cursor as object)) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

function interpolate(template: string, params?: Readonly<Record<string, string | number>>): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    const value = params[name];
    return value === undefined ? `{{${name}}}` : String(value);
  });
}

/* -------------------------------------------------------------------------- */
/*  Bootstrap helpers                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Read persisted language from MMKV. Safe to call before React mounts.
 * Used by App.tsx to apply I18nManager.forceRTL synchronously on cold start.
 */
export function readPersistedLang(): LangCode {
  const raw = storage.getString(KEYS.SETTINGS_LANG);
  return isValidLang(raw) ? raw : DEFAULT_LANG;
}

/**
 * Apply I18nManager direction for the given language.
 * Idempotent — only calls forceRTL when direction actually differs.
 * Returns true if a direction flip occurred (i.e. native restart needed).
 */
export function applyLayoutDirection(lang: LangCode): boolean {
  const targetRTL = LANG_META[lang].isRTL;
  if (I18nManager.isRTL === targetRTL) {
    return false;
  }
  I18nManager.allowRTL(targetRTL);
  I18nManager.forceRTL(targetRTL);
  return true;
}

/* -------------------------------------------------------------------------- */
/*  Provider                                                                  */
/* -------------------------------------------------------------------------- */

interface I18nProviderProps {
  /** Initial language. If omitted, reads from MMKV. */
  initialLang?: LangCode;
  children: React.ReactNode;
}

export function I18nProvider({ initialLang, children }: I18nProviderProps): React.ReactElement {
  const [lang, setLang] = useState<LangCode>(() => initialLang ?? readPersistedLang());

  // Persist to MMKV whenever lang changes (including initial mount if not yet stored).
  useEffect(() => {
    const stored = storage.getString(KEYS.SETTINGS_LANG);
    if (stored !== lang) {
      storage.set(KEYS.SETTINGS_LANG, lang);
    }
  }, [lang]);

  const t = useCallback<TranslateFn>(
    (key, params) => {
      const table = TABLES[lang];
      const found = lookup(table, key);
      if (found !== undefined) {
        return interpolate(found, params);
      }

      // Fallback to English so the UI never shows blank.
      const fallback = lookup(en, key);
      if (fallback !== undefined) {
        if (__DEV__) {
          console.warn(`[i18n] Missing key "${key}" in lang "${lang}", using English fallback.`);
        }
        return interpolate(fallback, params);
      }

      if (__DEV__) {
        throw new Error(`[i18n] Unknown translation key: "${key}"`);
      }
      return key;
    },
    [lang],
  );

  const switchLanguage = useCallback(
    (next: LangCode): boolean => {
      if (next === lang) {
        return false;
      }
      const directionChanged = LANG_META[next].isRTL !== LANG_META[lang].isRTL;
      setLang(next);
      // Persist immediately so a native restart picks up the new lang.
      storage.set(KEYS.SETTINGS_LANG, next);
      if (directionChanged) {
        applyLayoutDirection(next);
      }
      return directionChanged;
    },
    [lang],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      isRTL: LANG_META[lang].isRTL,
      t,
      switchLanguage,
    }),
    [lang, t, switchLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/* -------------------------------------------------------------------------- */
/*  Hook                                                                      */
/* -------------------------------------------------------------------------- */

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx === null) {
    throw new Error('useI18n() called outside <I18nProvider>. Wrap your app root.');
  }
  return ctx;
}

/** Convenience hook when the caller only needs t(). */
export function useTranslation(): TranslateFn {
  return useI18n().t;
}
