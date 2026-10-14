/**
 * Default theme — new installs start in Midnight Celestial; anyone with a
 * theme already stored keeps it. ThemeProvider writes the active id to
 * storage on first launch, so every existing install has one stored.
 */
import { storage, KEYS } from '@storage/mmkv';
import { readPersistedThemeId } from '../ThemeProvider';
import { DEFAULT_THEME_ID } from '../themes';

describe('readPersistedThemeId', () => {
  afterEach(() => {
    storage.delete(KEYS.SETTINGS_THEME);
  });

  it('starts a fresh install in Midnight Celestial', () => {
    storage.delete(KEYS.SETTINGS_THEME);
    expect(DEFAULT_THEME_ID).toBe('midnightCelestial');
    expect(readPersistedThemeId()).toBe('midnightCelestial');
  });

  it('keeps an existing user on the theme they already have', () => {
    storage.set(KEYS.SETTINGS_THEME, 'darAlShams');
    expect(readPersistedThemeId()).toBe('darAlShams');
  });

  it('falls back to the default for an unknown stored value', () => {
    storage.set(KEYS.SETTINGS_THEME, 'notATheme');
    expect(readPersistedThemeId()).toBe('midnightCelestial');
  });
});
