/**
 * acquireLocation — resilient device-location acquisition.
 * --------------------------------------------------------------------------
 * The on-device sky display (planetary hours, sunrise/sunset, Sky Clock)
 * uses a lat/lon; readings never do. The app holds only the approximate
 * location permission (ACCESS_COARSE_LOCATION), so a precise GPS request
 * cannot do better than a network fix — and approximate location is enough
 * for everything location drives (src/utils/__tests__/approximateLocation.test.ts).
 *
 * This helper tries two strategies and only returns null when both fail:
 *   1. one-shot  (network)  — Wi-Fi + cell, resolves fast indoors
 *   2. watch     (any)      — keeps listening for the first fix a one-shot
 *                             getCurrentPosition often misses on a cold start
 *
 * Every stage has a JS-side backstop because some OEM location stacks never
 * invoke either callback (no fix, no error), which would otherwise hang the
 * promise forever.
 */

import Geolocation from '@react-native-community/geolocation';

export interface AcquiredCoords {
  lat: number;
  lon: number;
}

// Configure the native module once. locationProvider 'auto' prefers Google
// Play Services fused location (far more reliable for a cold fix than the
// legacy Android LocationManager) and falls back to it when Play Services is
// unavailable. skipPermissionRequests: the app runs its own permission flow.
let configured = false;
function ensureConfigured(): void {
  if (configured) {
    return;
  }
  configured = true;
  try {
    Geolocation.setRNConfiguration({
      skipPermissionRequests: true,
      authorizationLevel: 'whenInUse',
      locationProvider: 'auto',
    });
  } catch {
    /* setRNConfiguration is best-effort; getCurrentPosition still works. */
  }
}

function oneShot(timeoutMs: number, maximumAgeMs: number): Promise<AcquiredCoords | null> {
  return new Promise<AcquiredCoords | null>(resolve => {
    let settled = false;
    const finish = (value: AcquiredCoords | null): void => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    // Backstop for OEM stacks that never call back. Slightly longer than the
    // native timeout so the real error callback wins when it does fire.
    const backstop = setTimeout(() => finish(null), timeoutMs + 1500);

    try {
      Geolocation.getCurrentPosition(
        pos => {
          clearTimeout(backstop);
          finish({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => {
          clearTimeout(backstop);
          finish(null);
        },
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: maximumAgeMs },
      );
    } catch {
      clearTimeout(backstop);
      finish(null);
    }
  });
}

// Keep a watch open until the first position arrives or the timeout elapses.
// watchPosition catches slow cold fixes that a single getCurrentPosition gives
// up on, and returns the moment any provider produces a location.
function watchForFix(timeoutMs: number): Promise<AcquiredCoords | null> {
  return new Promise<AcquiredCoords | null>(resolve => {
    let settled = false;
    let watchId: number | null = null;
    const finish = (value: AcquiredCoords | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (watchId !== null) {
        try {
          Geolocation.clearWatch(watchId);
        } catch {
          /* already cleared */
        }
      }
      resolve(value);
    };

    const backstop = setTimeout(() => finish(null), timeoutMs);

    try {
      watchId = Geolocation.watchPosition(
        pos => {
          clearTimeout(backstop);
          finish({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => {
          /* ignore individual errors — wait for a fix or the backstop */
        },
        { enableHighAccuracy: false, distanceFilter: 0, interval: 2000, fastestInterval: 1000 },
      );
    } catch {
      clearTimeout(backstop);
      finish(null);
    }
  });
}

/**
 * Resolve the device's approximate coordinates, or null if no fix could be
 * obtained.
 */
export async function acquireLocation(): Promise<AcquiredCoords | null> {
  ensureConfigured();

  const fix = await oneShot(8000, 120000);
  if (fix !== null) {
    return fix;
  }

  // Last resort: keep listening for a cold first fix.
  return watchForFix(15000);
}
