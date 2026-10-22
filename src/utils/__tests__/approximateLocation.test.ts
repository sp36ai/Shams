/**
 * Approximate location is enough for everything location drives.
 *
 * The app requests only ACCESS_COARSE_LOCATION (owner decision 2026-10-22).
 * Android's approximate location can be a few kilometres from the device.
 * Location drives only the on-device sky display — never a reading — so the
 * question is whether a few kilometres visibly changes any of it:
 *
 *   - planetary hour and day ruler (local solar time: longitude only)
 *   - the countdown to the next planetary hour
 *   - sunrise / sunset
 *   - the Sky Clock chart's ascendant (house frame)
 *
 * Each is compared at a true position and at positions 5 km north, south,
 * east and west of it — more than approximate location's usual error —
 * for five cities from 24°N to 60°N across a year.
 */

import { horaLordAtMoment, msUntilNextHora } from '@astrology/primitives/rulingPlanets';
import { buildChart } from '@astrology/primitives/chartBuilder';
import { computeSunTimes } from '../sunTimes';

const KM = 5;
const CITIES: ReadonlyArray<[string, number, number]> = [
  ['Karachi', 24.86, 67.0],
  ['Lahore', 31.634, 74.3587],
  ['Delhi', 28.61, 77.21],
  ['London', 51.51, -0.13],
  ['Oslo', 59.91, 10.75],
];

/** Positions KM kilometres away in the four compass directions. */
function neighbours(lat: number, lon: number): Array<[number, number]> {
  const dLat = KM / 111.32;
  const dLon = KM / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [
    [lat + dLat, lon],
    [lat - dLat, lon],
    [lat, lon + dLon],
    [lat, lon - dLon],
  ];
}

const START = Date.UTC(2026, 0, 1, 0, 0);
const DAY = 86_400_000;
/** Every 13 days across a year, so samples drift through the seasons. */
const DAYS = Array.from({ length: 28 }, (_, i) => START + i * 13 * DAY);

function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const worst = { horaShiftS: 0, sunShiftS: 0, ascDeg: 0 };

describe(`approximate location (±${KM} km)`, () => {
  afterAll(() => {
    // eslint-disable-next-line no-console
    console.log('[approximate location] worst case', JSON.stringify(worst));
  });

  it.each(CITIES)('%s: planetary-hour boundaries move by seconds, not minutes', (_, lat, lon) => {
    for (const day of DAYS) {
      for (let m = 0; m < 24 * 60; m += 20) {
        const t = day + m * 60_000;
        const base = msUntilNextHora(t, lon);
        for (const [, nLon] of neighbours(lat, lon)) {
          const shiftS = Math.abs(msUntilNextHora(t, nLon) - base) / 1000;
          // Ignore the wrap where one side has just crossed a boundary.
          if (shiftS < 1800) {
            worst.horaShiftS = Math.max(worst.horaShiftS, shiftS);
            expect(shiftS).toBeLessThan(30);
          }
          // Away from a boundary, the ruler itself is unchanged.
          if (base > 30_000 && base < 3_600_000 - 30_000) {
            expect(horaLordAtMoment(t, nLon)).toBe(horaLordAtMoment(t, lon));
          }
        }
      }
    }
  });

  it.each(CITIES)('%s: sunrise and sunset move by under a minute', (_, lat, lon) => {
    for (const day of DAYS) {
      const t = day + 12 * 3_600_000;
      const base = computeSunTimes(t, lat, lon);
      if (base === null) {
        continue;
      }
      for (const [nLat, nLon] of neighbours(lat, lon)) {
        const n = computeSunTimes(t, nLat, nLon);
        expect(n).not.toBeNull();
        const shiftS =
          Math.max(Math.abs(n!.sunriseMs - base.sunriseMs), Math.abs(n!.sunsetMs - base.sunsetMs)) /
          1000;
        worst.sunShiftS = Math.max(worst.sunShiftS, shiftS);
        expect(shiftS).toBeLessThan(60);
      }
    }
  });

  it.each(CITIES)(
    "%s: the Sky Clock chart's ascendant moves by a fraction of a degree",
    (_, lat, lon) => {
      for (const day of DAYS.filter((__, i) => i % 4 === 0)) {
        for (const hour of [3, 9, 15, 21]) {
          const iso = new Date(day + hour * 3_600_000).toISOString();
          const base = buildChart(iso, lat, lon).ascendant.siderealLongitude;
          for (const [nLat, nLon] of neighbours(lat, lon)) {
            const d = angleDiff(buildChart(iso, nLat, nLon).ascendant.siderealLongitude, base);
            worst.ascDeg = Math.max(worst.ascDeg, d);
            expect(d).toBeLessThan(0.5);
          }
        }
      }
    },
  );
});
