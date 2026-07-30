/**
 * acquireLocation — resilient device-location acquisition.
 * --------------------------------------------------------------------------
 * The oracle needs a lat/lon to cast a chart. The naive path — a single
 * getCurrentPosition({ enableHighAccuracy: true }) with a short timeout —
 * fails constantly in the field: a precise GPS (satellite) fix routinely
 * times out indoors and on the first fix after launch, and when it fails the
 * app was left with no coordinates at all, showing "location is required"
 * even though permission was granted.
 *
 * This helper tries a precise fix first, then falls back to a coarse / network
 * fix (Wi-Fi + cell), which resolves in a second or two indoors where GPS
 * cannot. It only returns null when BOTH stages fail. Each stage also has a
 * JS-side backstop because some OEM location stacks never invoke either
 * callback (no fix, no error), which would otherwise hang the promise forever.
 */

import Geolocation from '@react-native-community/geolocation';

export interface AcquiredCoords {
  lat: number;
  lon: number;
}

function attempt(
  enableHighAccuracy: boolean,
  timeoutMs: number,
  maximumAgeMs: number,
): Promise<AcquiredCoords | null> {
  return new Promise<AcquiredCoords | null>(resolve => {
    let settled = false;
    const finish = (value: AcquiredCoords | null): void => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    // Backstop: guarantee this stage resolves even if the native module never
    // calls back (observed on some OEM stacks). Slightly longer than the
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
        { enableHighAccuracy, timeout: timeoutMs, maximumAge: maximumAgeMs },
      );
    } catch {
      clearTimeout(backstop);
      finish(null);
    }
  });
}

/**
 * Resolve the device's coordinates, or null if no fix could be obtained.
 *
 * @param preferHighAccuracy start with a precise GPS fix (pass the "fine"
 *        permission result). Set false to skip straight to the coarse fix.
 */
export async function acquireLocation(preferHighAccuracy = true): Promise<AcquiredCoords | null> {
  if (preferHighAccuracy) {
    const precise = await attempt(true, 8000, 30000);
    if (precise !== null) {
      return precise;
    }
  }
  // Coarse / network fallback — fast indoors, accepts a slightly older fix.
  return attempt(false, 8000, 120000);
}
