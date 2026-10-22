/**
 * LocationPermissionScreen — every way out, and what each one records.
 *
 * Location is optional: readings never use it (askWatchOracle sends no
 * coordinates). So every outcome must let the seeker through — the gate in
 * RootNavigator opens on onboardingLocationPrompted — and only an actual
 * grant may store a location or mark permission granted.
 */
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Geolocation from '@react-native-community/geolocation';
import { renderScreen } from '../../test-utils/renderScreen';
import LocationPermissionScreen from '../LocationPermissionScreen';
import { useSettingsStore } from '@stores/settingsStore';
import { requestLocationPermission } from '@utils/permissions';
import { acquireLocation } from '@utils/acquireLocation';
import { en } from '../../i18n/strings/en';

jest.mock('@utils/permissions', () => ({
  ...jest.requireActual('@utils/permissions'),
  requestLocationPermission: jest.fn(),
}));
jest.mock('@utils/acquireLocation', () => ({
  ...jest.requireActual('@utils/acquireLocation'),
  acquireLocation: jest.fn(),
}));

const requestMock = requestLocationPermission as jest.Mock;
const acquireMock = acquireLocation as jest.Mock;

function state() {
  const s = useSettingsStore.getState();
  return {
    prompted: s.onboardingLocationPrompted,
    granted: s.onboardingPermissionGranted,
    location: s.lastLocation,
  };
}

beforeEach(() => {
  requestMock.mockReset();
  acquireMock.mockReset().mockResolvedValue({ lat: 31.634, lon: 74.3587 });
  useSettingsStore.getState().clearLocation();
  useSettingsStore.setState({
    onboardingLocationPrompted: false,
    onboardingPermissionGranted: false,
  });
});

it('discloses the optional, on-device purpose — not a requirement', async () => {
  await renderScreen(<LocationPermissionScreen />);
  expect(screen.getByText(en.permission.locationTitle)).toBeTruthy();
  expect(screen.getByText(en.permission.locationRationale)).toBeTruthy();
  expect(screen.getByTestId('location-not-now-btn')).toBeTruthy();
});

it('Allow: stores the fix, records the grant, and lets the seeker through', async () => {
  requestMock.mockResolvedValue({ status: 'granted' });
  await renderScreen(<LocationPermissionScreen />);
  fireEvent.press(screen.getByTestId('location-grant-btn'));
  await waitFor(() => expect(state().prompted).toBe(true));
  expect(state().granted).toBe(true);
  expect(state().location).toMatchObject({ lat: 31.634, lon: 74.3587 });
});

it('Allow but GPS finds no fix: still lets the seeker through, with no location', async () => {
  requestMock.mockResolvedValue({ status: 'granted' });
  acquireMock.mockResolvedValue(null);
  await renderScreen(<LocationPermissionScreen />);
  fireEvent.press(screen.getByTestId('location-grant-btn'));
  await waitFor(() => expect(state().prompted).toBe(true));
  expect(state().location).toBeNull();
});

it.each(['denied', 'never-ask', 'unavailable'])(
  "Don't allow (%s): lets the seeker through, stores nothing",
  async status => {
    requestMock.mockResolvedValue({ status });
    await renderScreen(<LocationPermissionScreen />);
    fireEvent.press(screen.getByTestId('location-grant-btn'));
    await waitFor(() => expect(state().prompted).toBe(true));
    expect(state().granted).toBe(false);
    expect(state().location).toBeNull();
    expect(acquireMock).not.toHaveBeenCalled();
  },
);

it('Not now: lets the seeker through without ever opening the system prompt', async () => {
  await renderScreen(<LocationPermissionScreen />);
  fireEvent.press(screen.getByTestId('location-not-now-btn'));
  await waitFor(() => expect(state().prompted).toBe(true));
  expect(requestMock).not.toHaveBeenCalled();
  expect(acquireMock).not.toHaveBeenCalled();
  expect(state().granted).toBe(false);
  expect(state().location).toBeNull();
});

it('the background location fetch is configured never to ask for permission', async () => {
  const actual =
    jest.requireActual<typeof import('@utils/acquireLocation')>('@utils/acquireLocation');
  await actual.acquireLocation().catch(() => null);
  expect(Geolocation.setRNConfiguration).toHaveBeenCalledWith(
    expect.objectContaining({ skipPermissionRequests: true }),
  );
});
