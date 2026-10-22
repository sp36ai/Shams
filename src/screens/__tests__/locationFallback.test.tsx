/**
 * The two screens that use the last GPS fix must render without one — it is
 * cleared on sign-out and account deletion (authStore.signOut), and may never
 * have been granted. Both fall back to a default location for the local sky
 * display; nothing sent to the server depends on it.
 */
import React from 'react';
import { screen } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import { renderScreen } from '../../test-utils/renderScreen';
import OracleScreen from '../OracleScreen';
import SkyClockScreen from '../SkyClockScreen';
import { useSettingsStore } from '@stores/settingsStore';
import { acquireLocation } from '@utils/acquireLocation';

// Home tries to re-acquire a fix on mount when none is saved; each test says
// whether GPS answers.
jest.mock('@utils/acquireLocation', () => ({ acquireLocation: jest.fn() }));
const acquireMock = acquireLocation as jest.Mock;

const FIX = { lat: 31.634, lon: 74.3587, label: null, capturedAt: Date.now() };

beforeEach(() => {
  (useNavigation as jest.Mock).mockReturnValue({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => false),
    replace: jest.fn(),
    push: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  });
  useSettingsStore.getState().clearLocation();
  acquireMock.mockReset().mockResolvedValue(null);
});

describe('with no saved location', () => {
  it('Home renders without one when GPS is unavailable', async () => {
    await renderScreen(<OracleScreen />);
    expect(acquireMock).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().lastLocation).toBeNull();
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/°N|°S/);
  });

  it('Home re-acquires a fix on mount when GPS answers (e.g. after sign-out)', async () => {
    acquireMock.mockResolvedValue({ lat: FIX.lat, lon: FIX.lon });
    await renderScreen(<OracleScreen />);
    expect(useSettingsStore.getState().lastLocation).toMatchObject({
      lat: FIX.lat,
      lon: FIX.lon,
    });
  });

  it('the Sky Clock renders on its default location', async () => {
    await renderScreen(<SkyClockScreen />);
    expect(screen.toJSON()).not.toBeNull();
  });
});

describe('with a saved location', () => {
  it('Home shows it as a coordinate readout', async () => {
    useSettingsStore.getState().setLastLocation(FIX);
    await renderScreen(<OracleScreen />);
    expect(JSON.stringify(screen.toJSON())).toContain('31.63°N 74.36°E');
  });

  it('the Sky Clock renders', async () => {
    useSettingsStore.getState().setLastLocation(FIX);
    await renderScreen(<SkyClockScreen />);
    expect(screen.toJSON()).not.toBeNull();
  });
});
