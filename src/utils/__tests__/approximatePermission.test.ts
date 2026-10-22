/**
 * The app asks for approximate location only (owner decision 2026-10-22).
 *
 * Location drives only the on-device sky display — never a reading — and
 * approximate accuracy is enough for it (approximateLocation.test.ts). So:
 *   - the manifest declares ACCESS_COARSE_LOCATION and strips any
 *     ACCESS_FINE_LOCATION a library manifest would merge in;
 *   - the runtime request asks for COARSE alone, never FINE;
 *   - acquisition never asks for a high-accuracy (GPS) fix, and a missing
 *     fix resolves to null rather than hanging or throwing.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {
  checkLocationPermission,
  isLocationUsable,
  requestLocationPermission,
} from '../permissions';
import { acquireLocation } from '../acquireLocation';

const COARSE = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
const FINE = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const { GRANTED, DENIED, NEVER_ASK_AGAIN } = PermissionsAndroid.RESULTS;

describe('AndroidManifest', () => {
  const manifest = readFileSync(
    join(__dirname, '../../../android/app/src/main/AndroidManifest.xml'),
    'utf8',
  );
  const permissions = [...manifest.matchAll(/<uses-permission\b[^>]*>/g)].map(m => m[0]);

  it('declares approximate location', () => {
    expect(permissions).toContainEqual(expect.stringContaining('ACCESS_COARSE_LOCATION'));
  });

  it('never grants precise location, even from a merged library manifest', () => {
    const fine = permissions.filter(p => p.includes('ACCESS_FINE_LOCATION'));
    expect(fine).toHaveLength(1);
    expect(fine[0]).toContain('tools:node="remove"');
    expect(manifest).not.toMatch(/ACCESS_BACKGROUND_LOCATION/);
  });
});

describe('runtime permission', () => {
  const originalOS = Platform.OS;
  let request: jest.SpyInstance;
  let requestMultiple: jest.SpyInstance;
  let check: jest.SpyInstance;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
    request = jest.spyOn(PermissionsAndroid, 'request');
    requestMultiple = jest.spyOn(PermissionsAndroid, 'requestMultiple');
    check = jest.spyOn(PermissionsAndroid, 'check');
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { get: () => originalOS, configurable: true });
    jest.restoreAllMocks();
  });

  it.each([
    [GRANTED, 'granted', true],
    [DENIED, 'denied', false],
    [NEVER_ASK_AGAIN, 'never-ask', false],
  ])('asks for approximate location only (%s → %s)', async (result, status, usable) => {
    request.mockResolvedValue(result);
    const r = await requestLocationPermission();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(COARSE);
    expect(request).not.toHaveBeenCalledWith(FINE);
    expect(requestMultiple).not.toHaveBeenCalled();
    expect(r.status).toBe(status);
    expect(isLocationUsable(r.status)).toBe(usable);
  });

  it('a thrown request is "unavailable", not a crash', async () => {
    request.mockRejectedValue(new Error('no activity'));
    expect((await requestLocationPermission()).status).toBe('unavailable');
  });

  it('checks approximate location only', async () => {
    check.mockResolvedValue(true);
    expect((await checkLocationPermission()).status).toBe('granted');
    expect(check).toHaveBeenCalledWith(COARSE);
    expect(check).not.toHaveBeenCalledWith(FINE);
  });
});

describe('acquisition', () => {
  const getCurrentPosition = Geolocation.getCurrentPosition as jest.Mock;
  const watchPosition = Geolocation.watchPosition as jest.Mock;

  afterEach(() => {
    jest.useRealTimers();
    getCurrentPosition.mockClear();
    watchPosition.mockClear();
  });

  it('returns the approximate fix without ever asking for high accuracy', async () => {
    await expect(acquireLocation()).resolves.toEqual({ lat: 31.634, lon: 74.3587 });
    for (const call of getCurrentPosition.mock.calls) {
      expect(call[2]).toMatchObject({ enableHighAccuracy: false });
    }
  });

  it('resolves null when no location provider answers (GPS/network off)', async () => {
    jest.useFakeTimers();
    getCurrentPosition.mockImplementationOnce((_ok, fail) => fail({ code: 2 }));
    watchPosition.mockImplementationOnce(() => 7);
    const pending = acquireLocation();
    await jest.advanceTimersByTimeAsync(20_000);
    await expect(pending).resolves.toBeNull();
    expect(Geolocation.clearWatch).toHaveBeenCalledWith(7);
    for (const call of [...getCurrentPosition.mock.calls, ...watchPosition.mock.calls]) {
      expect(call[2]).toMatchObject({ enableHighAccuracy: false });
    }
  });
});
