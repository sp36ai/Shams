/**
 * chartBuilder — compose all ephemeris primitives into a Chart object.
 * --------------------------------------------------------------------------
 * This is the single public entry point for the Phase 2 astronomy engine.
 * All inputs are UTC; all outputs are Lahiri-sidereal decimal degrees.
 *
 * Input contract:
 *   iso8601  — UTC timestamp string, e.g. "2025-01-15T14:30:00Z"
 *   lat      — geographic latitude, decimal degrees, North positive
 *   lon      — geographic longitude, decimal degrees, East positive
 *
 * Output: immutable Chart object (see types/chart.ts)
 *
 * Determinism guarantee:
 *   Same (iso8601, lat, lon) → identical Chart. No random, no clock.
 *
 * Pipeline order (must not be reordered — each step feeds the next):
 *   1. Time scales: ISO → JDut → JDtt → T
 *   2. Obliquity ε(T) — Meeus 22.3
 *   3. Ayanamsa: Lahiri(JDtt)
 *   4. RAMC: LMST(JDut, lon) in degrees
 *   5. House cusps: Placidus(RAMC, ε, lat)
 *   6. Planet positions (tropical) → subtract ayanamsa → sidereal
 *   7. Per-planet: sign, nakshatra, sub-lord, sub-sub-lord, combust, retrograde
 *   8. Ruling planets
 *   9. Hora lord
 *  10. Assemble Chart record
 */

import { resolveTimeScales } from './julianDay';
import { lahiriAyanamsa, tropicalToSidereal } from './ayanamsa';
import { ramc } from './siderealTime';
import { computeHouseCusps } from './houseCusps';
import { getSubLords } from './subLord';
import { getRulingPlanets, horaLordAtMoment } from './rulingPlanets';
import { normalize360 } from './angles';
import { OBLIQUITY_J2000_DEG, COMBUSTION_THRESHOLD_DEG, PlanetIndex } from './constants';

import { sunPosition } from './moshier/sun';
import { moonPosition } from './moshier/moon';
import {
  mercuryPosition,
  venusPosition,
  marsPosition,
  jupiterPosition,
  saturnPosition,
  rahuPosition,
  ketuPosition,
} from './moshier/planets';

import type {
  Chart,
  GeoLocation,
  HouseCusp,
  PlanetPosition,
  Planet,
  HouseIndex,
  NakshatraIndex,
  SignIndex,
  Pada,
} from '../types/chart';
import type { JDtt } from './julianDay';

export const ENGINE_VERSION = '2.0.0-moshier';

// ────────────────────────────────────────────────────────────────────────────
// Obliquity
// ────────────────────────────────────────────────────────────────────────────

/**
 * Mean obliquity of the ecliptic ε (degrees) at time T.
 * Meeus eq. 22.3 — IAU 1980 series.
 * Accurate to < 1" for 1900–2100.
 */
function obliquity(T: number): number {
  const U = T / 100;
  return (
    OBLIQUITY_J2000_DEG +
    U *
      (-4680.93 / 3600 +
        U *
          (-1.55 / 3600 +
            U *
              (1999.25 / 3600 +
                U *
                  (-51.38 / 3600 +
                    U *
                      (-249.67 / 3600 +
                        U *
                          (-39.05 / 3600 +
                            U *
                              (7.12 / 3600 +
                                U * (27.87 / 3600 + U * (5.79 / 3600 + U * (2.45 / 3600))))))))))
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Daily speed (degrees/day) — finite difference over ±12h
// ────────────────────────────────────────────────────────────────────────────

type PositionFn = (jdtt: JDtt) => { longitude: number };

function dailySpeed(positionFn: PositionFn, jdtt: JDtt): number {
  const ahead = positionFn((jdtt + 0.5) as JDtt);
  const behind = positionFn((jdtt - 0.5) as JDtt);
  let diff = ahead.longitude - behind.longitude;
  // Unwrap across 0°/360° boundary
  if (diff > 180) {
    diff -= 360;
  }
  if (diff < -180) {
    diff += 360;
  }
  return diff;
}

// ────────────────────────────────────────────────────────────────────────────
// Combust check
// ────────────────────────────────────────────────────────────────────────────

function isCombust(
  planetSiderealLon: number,
  sunSiderealLon: number,
  planetIndex: PlanetIndex,
  isRetrograde: boolean,
): boolean {
  const threshold = COMBUSTION_THRESHOLD_DEG[planetIndex];
  if (threshold === undefined) {
    return false;
  }

  // Mercury/Venus have tighter retrograde thresholds (classical rule)
  let effectiveThreshold = threshold;
  if (planetIndex === PlanetIndex.Mercury && isRetrograde) {
    effectiveThreshold = 12;
  }
  if (planetIndex === PlanetIndex.Venus && isRetrograde) {
    effectiveThreshold = 8;
  }

  const diff = Math.abs(normalize360(planetSiderealLon - sunSiderealLon + 180) - 180);
  return diff < effectiveThreshold;
}

// ────────────────────────────────────────────────────────────────────────────
// House occupancy — which house does a sidereal longitude fall in?
// ────────────────────────────────────────────────────────────────────────────

export function houseForLongitude(
  siderealLon: number,
  siderealCusps: readonly number[],
): HouseIndex {
  for (let i = 0; i < 12; i++) {
    const cuspStart = siderealCusps[i] as number;
    const cuspEnd = siderealCusps[(i + 1) % 12] as number;
    // Handle wrap-around at 0°/360°
    const inHouse =
      cuspEnd > cuspStart
        ? siderealLon >= cuspStart && siderealLon < cuspEnd
        : siderealLon >= cuspStart || siderealLon < cuspEnd;
    if (inHouse) {
      return (i + 1) as HouseIndex;
    }
  }
  return 1 as HouseIndex;
}

// ────────────────────────────────────────────────────────────────────────────
// Assemble PlanetPosition from raw data
// ────────────────────────────────────────────────────────────────────────────

function buildPlanetPosition(
  planet: Planet,
  tropicalLon: number,
  latitude: number,
  speed: number,
  jdtt: JDtt,
  sunSiderealLon: number,
  planetIndex: PlanetIndex,
): PlanetPosition {
  const siderealLon = tropicalToSidereal(tropicalLon, jdtt);
  const isRetrograde = speed < 0;

  const subLordInfo = getSubLords(siderealLon);

  return {
    planet,
    siderealLongitude: siderealLon,
    siderealLatitude: latitude,
    dailySpeed: speed,
    isRetrograde,
    isCombust: isCombust(siderealLon, sunSiderealLon, planetIndex, isRetrograde),
    sign: (Math.floor(siderealLon / 30) + 1) as SignIndex,
    degreeInSign: siderealLon % 30,
    nakshatra: (subLordInfo.nakshatraIndex + 1) as NakshatraIndex,
    pada: Math.min(4, Math.floor(subLordInfo.posInNakshatra / (13.333333 / 4)) + 1) as Pada,
    nakshatraLord: subLordInfo.nakshatraLord as Planet,
    subLord: subLordInfo.subLord as Planet,
    subSubLord: subLordInfo.subSubLord as Planet,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Hora lord
// ────────────────────────────────────────────────────────────────────────────

// horaLord is now computed by rulingPlanets.horaLordAtMoment (sunrise-anchored)

// ────────────────────────────────────────────────────────────────────────────
// Build HouseCusp from tropical cusp longitude
// ────────────────────────────────────────────────────────────────────────────

function buildHouseCusp(houseNumber: HouseIndex, tropicalCuspLon: number, jdtt: JDtt): HouseCusp {
  const siderealLon = tropicalToSidereal(tropicalCuspLon, jdtt);
  const subLordInfo = getSubLords(siderealLon);

  return {
    house: houseNumber,
    siderealLongitude: siderealLon,
    sign: (Math.floor(siderealLon / 30) + 1) as SignIndex,
    degreeInSign: siderealLon % 30,
    nakshatra: (subLordInfo.nakshatraIndex + 1) as NakshatraIndex,
    nakshatraLord: subLordInfo.nakshatraLord as Planet,
    subLord: subLordInfo.subLord as Planet,
    subSubLord: subLordInfo.subSubLord as Planet,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build a complete KP horary chart for the given moment and location.
 *
 * @param iso8601  UTC timestamp string (trailing Z required)
 * @param lat      Geographic latitude, decimal degrees, North positive
 * @param lon      Geographic longitude, decimal degrees, East positive
 * @returns        Immutable Chart object
 */
export function buildChart(iso8601: string, lat: number, lon: number): Chart {
  // Step 1: Time scales
  const { jdut, jdtt, T } = resolveTimeScales(iso8601);

  // Step 2: Obliquity
  const eps = obliquity(T);

  // Step 3: Ayanamsa
  const ayanamsaValue = lahiriAyanamsa(jdtt);

  // Step 4: RAMC
  const ramcDeg = ramc(jdut, lon);

  // Step 5: House cusps (tropical)
  const cuspResult = computeHouseCusps(ramcDeg, eps, lat);

  // Step 6: Planet tropical positions
  const sunPos = sunPosition(jdtt);
  const moonPos = moonPosition(jdtt);

  const sunSidLon = tropicalToSidereal(sunPos.longitude, jdtt);

  const planetData: Array<{
    planet: Planet;
    index: PlanetIndex;
    tropical: number;
    lat: number;
    speed: number;
  }> = [
    {
      planet: 'Sun',
      index: PlanetIndex.Sun,
      tropical: sunPos.longitude,
      lat: 0,
      speed: dailySpeed(sunPosition, jdtt),
    },
    {
      planet: 'Moon',
      index: PlanetIndex.Moon,
      tropical: moonPos.longitude,
      lat: moonPos.latitude,
      speed: dailySpeed(moonPosition, jdtt),
    },
    {
      planet: 'Mars',
      index: PlanetIndex.Mars,
      tropical: marsPosition(jdtt).longitude,
      lat: 0,
      speed: dailySpeed(marsPosition, jdtt),
    },
    {
      planet: 'Mercury',
      index: PlanetIndex.Mercury,
      tropical: mercuryPosition(jdtt).longitude,
      lat: 0,
      speed: dailySpeed(mercuryPosition, jdtt),
    },
    {
      planet: 'Jupiter',
      index: PlanetIndex.Jupiter,
      tropical: jupiterPosition(jdtt).longitude,
      lat: 0,
      speed: dailySpeed(jupiterPosition, jdtt),
    },
    {
      planet: 'Venus',
      index: PlanetIndex.Venus,
      tropical: venusPosition(jdtt).longitude,
      lat: 0,
      speed: dailySpeed(venusPosition, jdtt),
    },
    {
      planet: 'Saturn',
      index: PlanetIndex.Saturn,
      tropical: saturnPosition(jdtt).longitude,
      lat: 0,
      speed: dailySpeed(saturnPosition, jdtt),
    },
    {
      planet: 'Rahu',
      index: PlanetIndex.Rahu,
      tropical: rahuPosition(jdtt).longitude,
      lat: 0,
      speed: -0.053,
    },
    {
      planet: 'Ketu',
      index: PlanetIndex.Ketu,
      tropical: ketuPosition(jdtt).longitude,
      lat: 0,
      speed: -0.053,
    },
  ];

  // Step 7: Build planet positions
  const planetsRecord = {} as Record<Planet, PlanetPosition>;
  for (const pd of planetData) {
    planetsRecord[pd.planet] = buildPlanetPosition(
      pd.planet,
      pd.tropical,
      pd.lat,
      pd.speed,
      jdtt,
      sunSidLon,
      pd.index,
    );
  }

  // Build house cusps
  const houseObjects = cuspResult.cusps.map((tropLon, i) =>
    buildHouseCusp((i + 1) as HouseIndex, tropLon, jdtt),
  ) as [
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
  ];

  // Step 8: Ruling planets (5 Classical Witnesses per KP spec)
  const momentMs = new Date(iso8601).getTime();

  const rp = getRulingPlanets({
    momentUtc: new Date(iso8601),
    lonDeg: lon,
    ascendantLon: houseObjects[0].siderealLongitude,
    moonLon: planetsRecord.Moon.siderealLongitude,
  });

  // Step 9: Hora (sunrise-anchored)
  const hora = horaLordAtMoment(momentMs, lon);

  // Step 10: Assemble Chart
  const location: GeoLocation = { latitude: lat, longitude: lon };

  return Object.freeze({
    momentUtc: iso8601,
    julianDayUt: jdut,
    location,
    ayanamsa: 'lahiri',
    ayanamsaValue,
    houseSystem: cuspResult.system === 'Porphyry' ? 'porphyry' : 'placidus',
    planets: Object.freeze(planetsRecord),
    cusps: Object.freeze(houseObjects) as Chart['cusps'],
    ascendant: houseObjects[0],
    midheaven: houseObjects[9],
    rulingPlanets: rp.set as Planet[],
    horaLord: hora,
    engineVersion: ENGINE_VERSION,
  } satisfies Chart);
}
