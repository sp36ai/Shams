/**
 * renderScreen — shared render helper for screen-level tests.
 * --------------------------------------------------------------------------
 * Every screen in this app reads from ThemeProvider and I18nProvider via
 * hooks that throw if no provider is mounted above them ("useTheme() called
 * outside <ThemeProvider>") — real screens only ever exist under
 * RootNavigator, which sits under both. Tests render a screen in isolation
 * (not the full navigation tree — see jest.setup.js's @react-navigation/
 * native mock for why), so this wrapper supplies the same two providers
 * every real mount gets, using their real implementations (no native deps
 * beyond the already-mocked MMKV).
 */
import React from 'react';
import { render, type RenderResult } from '@testing-library/react-native';
import { ThemeProvider } from '@theme/ThemeProvider';
import { I18nProvider } from '@i18n/I18nProvider';

export function renderScreen(ui: React.ReactElement): Promise<RenderResult> {
  return render(
    <ThemeProvider>
      <I18nProvider initialLang="en">{ui}</I18nProvider>
    </ThemeProvider>,
  );
}
