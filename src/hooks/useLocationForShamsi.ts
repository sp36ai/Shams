/**
 * Location Collection Hook for React Native
 * 
 * Handles GPS permission requests and manual location entry fallback.
 */

import { useCallback, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface UseLocationForShamsiResult {
  location: LocationCoordinates | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => Promise<void>;
  requestLocationWithFallback: () => Promise<LocationCoordinates | null>;
}

/**
 * Request fine location permission on Android.
 */
async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    // iOS permissions handled by Info.plist
    return true;
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'Shamsi Logic needs your precise location to calculate horary houses.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.error('Location permission error:', err);
    return false;
  }
}

/**
 * Get current device location via GPS.
 */
function getCurrentLocation(): Promise<LocationCoordinates> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      error => {
        reject(new Error(`Geolocation error: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  });
}

/**
 * React hook for location collection with GPS + manual fallback.
 */
export function useLocationForShamsi(): UseLocationForShamsiResult {
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const permGranted = await requestLocationPermission();
      if (!permGranted) {
        setError('Location permission denied. Please enable in Settings.');
        setLoading(false);
        return;
      }

      const loc = await getCurrentLocation();
      setLocation(loc);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown location error';
      setError(message);
      console.error('Location request error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const requestLocationWithFallback = useCallback(async (): Promise<LocationCoordinates | null> => {
    setLoading(true);
    setError(null);

    try {
      const permGranted = await requestLocationPermission();
      if (!permGranted) {
        // Show manual entry dialog
        return new Promise(resolve => {
          Alert.alert(
            'Location Required',
            'Shamsi Logic requires your location. Please enter manually:',
            [
              {
                text: 'Enter Manually',
                onPress: () => {
                  // TODO: Navigate to manual entry screen or modal
                  resolve(null);
                },
              },
              { text: 'Cancel', onPress: () => resolve(null) },
            ],
          );
        });
      }

      const loc = await getCurrentLocation();
      setLocation(loc);
      return loc;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown location error';
      setError(message);
      console.error('Location request error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { location, loading, error, requestLocation, requestLocationWithFallback };
}
