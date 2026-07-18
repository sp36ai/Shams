/**
 * settingsStore — identity/location/onboarding persistence regression tests.
 *
 * The critical contract is resetForNewAccount: on account deletion (or a
 * different uid signing in on a shared device) it must leave NO personal data
 * behind — names, onboarding profile, and the cached precise location.
 */

import { storage, KEYS } from '@storage/mmkv';
import { useSettingsStore } from '../settingsStore';

beforeEach(() => {
  useSettingsStore.getState().resetForNewAccount();
});

describe('seeker identity', () => {
  it('setSeekerIdentity trims and persists both names', () => {
    useSettingsStore.getState().setSeekerIdentity('  Mohammad Rafiq ', ' Mymoona ');
    const s = useSettingsStore.getState();
    expect(s.seekerName).toBe('Mohammad Rafiq');
    expect(s.motherName).toBe('Mymoona');
    expect(storage.getString(KEYS.SEEKER_NAME)).toBe('Mohammad Rafiq');
    expect(storage.getString(KEYS.MOTHER_NAME)).toBe('Mymoona');
  });

  it('empty / null names delete the stored keys', () => {
    useSettingsStore.getState().setSeekerIdentity('Rafiq', 'Mymoona');
    useSettingsStore.getState().setSeekerIdentity('  ', null);
    const s = useSettingsStore.getState();
    expect(s.seekerName).toBeNull();
    expect(s.motherName).toBeNull();
    expect(storage.getString(KEYS.SEEKER_NAME)).toBeUndefined();
    expect(storage.getString(KEYS.MOTHER_NAME)).toBeUndefined();
  });
});

describe('location', () => {
  it('setLastLocation persists coordinates; clearLocation removes them', () => {
    useSettingsStore
      .getState()
      .setLastLocation({ lat: 24.8607, lon: 67.0011, capturedAt: 1700000000000, label: 'Karachi' });
    expect(useSettingsStore.getState().lastLocation?.lat).toBe(24.8607);
    expect(storage.getNumber(KEYS.LOCATION_LAST_LAT)).toBe(24.8607);
    expect(storage.getNumber(KEYS.LOCATION_LAST_LON)).toBe(67.0011);

    useSettingsStore.getState().clearLocation();
    expect(useSettingsStore.getState().lastLocation).toBeNull();
    expect(storage.getNumber(KEYS.LOCATION_LAST_LAT)).toBeUndefined();
  });
});

describe('onboarding profile', () => {
  it('setSeekerProfile stores the profile and raw answers', () => {
    useSettingsStore.getState().setSeekerProfile('surrender', ['a1', 'a2', 'a3']);
    const s = useSettingsStore.getState();
    expect(s.seekerProfile).toBe('surrender');
    expect(s.onboardingAnswers).toEqual(['a1', 'a2', 'a3']);
    expect(storage.getString(KEYS.ONBOARDING_SEEKER_PROFILE)).toBe('surrender');
  });
});

describe('resetForNewAccount — deletion / account-switch teardown', () => {
  it('wipes identity, onboarding, and the cached precise location', () => {
    const s = useSettingsStore.getState();
    s.setSeekerIdentity('Rafiq', 'Mymoona');
    s.setSeekerProfile('clarity', ['x', 'y', 'z']);
    s.setLastLocation({ lat: 24.8607, lon: 67.0011, capturedAt: 1700000000000 });
    s.markOnboardingComplete();

    useSettingsStore.getState().resetForNewAccount();

    const after = useSettingsStore.getState();
    expect(after.seekerName).toBeNull();
    expect(after.motherName).toBeNull();
    expect(after.seekerProfile).toBeNull();
    expect(after.onboardingAnswers).toBeNull();
    expect(after.hasSeenOnboarding).toBe(false);
    expect(after.lastLocation).toBeNull();

    // No personal data may survive in MMKV either.
    expect(storage.getString(KEYS.SEEKER_NAME)).toBeUndefined();
    expect(storage.getString(KEYS.MOTHER_NAME)).toBeUndefined();
    expect(storage.getString(KEYS.ONBOARDING_SEEKER_PROFILE)).toBeUndefined();
    expect(storage.getString(KEYS.ONBOARDING_ANSWERS)).toBeUndefined();
    expect(storage.getNumber(KEYS.LOCATION_LAST_LAT)).toBeUndefined();
    expect(storage.getNumber(KEYS.LOCATION_LAST_LON)).toBeUndefined();
    expect(storage.getNumber(KEYS.LOCATION_LAST_TIMESTAMP)).toBeUndefined();
    expect(storage.getString(KEYS.LOCATION_LAST_LABEL)).toBeUndefined();
  });
});
