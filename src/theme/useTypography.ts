/**
 * useTypography — language-aware typography resolver hook.
 * --------------------------------------------------------------------------
 * Bridges the pure `resolveVariant(variantId, lang)` function in typography.ts
 * to the React tree by reading the active language from I18nProvider.
 *
 * Usage:
 *   const type = useTypography();
 *   <Text style={type('title')}>...</Text>
 *   <Text style={[type('body'), { color: colors.text }]}>...</Text>
 *
 * Why a function-returning-style instead of pre-built objects:
 *   - Lazy: only the variants you actually render are computed.
 *   - Stable: the returned function is memoized per language change, so
 *     downstream useMemo dependencies stay clean.
 *   - Cheap: resolveVariant is pure and small; computing on render is fine.
 *
 * NEVER use this for static styles (StyleSheet.create at module scope) — those
 * cannot react to language changes. Inline the call or use a useMemo.
 */

import { useCallback } from 'react';
import type { TextStyle } from 'react-native';

import { useI18n } from '@i18n/I18nProvider';

import { resolveVariant, type TypographyVariantId } from './typography';

export type TypographyResolver = (variantId: TypographyVariantId) => TextStyle;

export function useTypography(): TypographyResolver {
  const { lang } = useI18n();
  return useCallback(
    (variantId: TypographyVariantId): TextStyle => resolveVariant(variantId, lang),
    [lang],
  );
}
