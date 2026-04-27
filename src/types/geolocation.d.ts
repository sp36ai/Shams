/**
 * W3C Geolocation API shim for React Native.
 * React Native exposes navigator.geolocation globally but @types/react-native
 * doesn't type it. We don't include the DOM lib (causes ViewProps conflicts
 * with react-native-svg), so we declare only what we actually use here.
 */

interface GeolocationCoordinates {
  readonly latitude: number;
  readonly longitude: number;
  readonly altitude: number | null;
  readonly accuracy: number;
  readonly altitudeAccuracy: number | null;
  readonly heading: number | null;
  readonly speed: number | null;
}

interface GeolocationPosition {
  readonly coords: GeolocationCoordinates;
  readonly timestamp: number;
}

interface GeolocationPositionError {
  readonly code: number;
  readonly message: string;
  readonly PERMISSION_DENIED: 1;
  readonly POSITION_UNAVAILABLE: 2;
  readonly TIMEOUT: 3;
}

interface PositionOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

interface Geolocation {
  getCurrentPosition(
    successCallback: (position: GeolocationPosition) => void,
    errorCallback?: (error: GeolocationPositionError) => void,
    options?: PositionOptions,
  ): void;
  watchPosition(
    successCallback: (position: GeolocationPosition) => void,
    errorCallback?: (error: GeolocationPositionError) => void,
    options?: PositionOptions,
  ): number;
  clearWatch(id: number): void;
}

// In a script-context .d.ts (no import/export), top-level declarations are
// already global — no `declare global {}` wrapper needed.
interface Navigator {
  readonly geolocation: Geolocation;
}

declare var navigator: Navigator;
