/**
 * VSOP87 heliocentric position → geocentric ecliptic-of-date, for Venus/Mars.
 * --------------------------------------------------------------------------
 * Closes the low-precision-series truncation residual the RKP audit Pass 3
 * measured at Venus's and Mars's own conjunction/opposition instants
 * (~0.94°/~0.46° after the separate mean-anomaly bug fix in planets.ts) —
 * fixing that bug closed the WRONG constant; this closes the remaining gap
 * that was never a bug, just this engine's equation-of-center-only series
 * running out of precision. VSOP87 (Bureau des Longitudes; term data in
 * vsop87VenusMarsData.ts) carries 30-50x more terms for Venus/Mars.
 *
 * The pipeline, each step a faithful, verified port (not a re-derivation
 * from formula memory) of Astronomy Engine by Don Cross
 * (https://github.com/cosinekitty/astronomy, MIT), cross-checked directly
 * against its own computed output — see vsop87Geocentric.test.ts:
 *
 *   1. Evaluate the VSOP87 L/B/R series → heliocentric spherical, mean
 *      ecliptic and equinox of J2000.0. NOTE: T here is in MILLENNIA from
 *      J2000.0 TT, not centuries — a real gotcha this module's own tests
 *      guard against.
 *   2. Spherical → rectangular, still ecliptic J2000.
 *   3. Rotate by the FIXED J2000 mean obliquity (this engine's own
 *      OBLIQUITY_J2000_DEG constant) to rectangular equatorial J2000.
 *   4. Apply the IAU 2006 four-angle precession rotation (psi_A, omega_A,
 *      chi_A, epsilon_0 — Capitaine et al.), J2000 → mean-of-date, in
 *      rectangular equatorial coordinates. This is the step a scalar
 *      "precession in longitude" shortcut would have skipped real
 *      3D-rotation terms from — ported verbatim rather than approximated,
 *      since this is exactly where a subtle new bug could hide.
 *   5. Rotate by the MEAN OBLIQUITY OF DATE (this engine's own existing
 *      Meeus-eq.-22.3 formula, duplicated here rather than imported, to
 *      avoid a circular import back through chartBuilder.ts → planets.ts)
 *      to rectangular ecliptic of date.
 *   6. Rectangular → spherical: heliocentric ecliptic-of-date longitude
 *      and latitude, ready for the same geocentric vector subtraction
 *      (against Earth's own already-validated heliocentric position, from
 *      earthHeliocentricXYZ in planets.ts) used everywhere else in this
 *      module.
 *
 * Nutation (mean-of-date → true-of-date, ≤ ~17″ ≈ 0.0047°) is deliberately
 * skipped: two orders of magnitude below what this fix is closing, and
 * consistent with the rest of this codebase's low-precision treatment.
 */

import { degToRad, radToDeg, normalize360 } from '../angles';
import { OBLIQUITY_J2000_DEG } from '../constants';
import type { JDtt } from '../julianDay';
import {
  VENUS_VSOP_L,
  VENUS_VSOP_B,
  VENUS_VSOP_R,
  MARS_VSOP_L,
  MARS_VSOP_B,
  MARS_VSOP_R,
} from './vsop87VenusMarsData';

export interface HeliocentricSpherical {
  readonly lonDeg: number;
  readonly latDeg: number;
  readonly r: number;
}

type Vec3 = readonly [number, number, number];
type VsopSeries = readonly (readonly Vec3[])[];

const DAYS_PER_MILLENNIUM = 365250;

/** Σ_k T^k · Σ_i amplitude_ki · cos(phase_ki + frequency_ki · T). T in millennia. */
function vsopFormula(series: VsopSeries, t: number): number {
  let tpower = 1;
  let coord = 0;
  for (const group of series) {
    let sum = 0;
    for (const [ampl, phase, freq] of group) {
      sum += ampl * Math.cos(phase + t * freq);
    }
    coord += tpower * sum;
    tpower *= t;
  }
  return coord;
}

function sphericalToRect(lonRad: number, latRad: number, r: number): Vec3 {
  const rCosLat = r * Math.cos(latRad);
  return [rCosLat * Math.cos(lonRad), rCosLat * Math.sin(lonRad), r * Math.sin(latRad)];
}

function rectToSpherical(v: Vec3): { lonRad: number; latRad: number; r: number } {
  const [x, y, z] = v;
  const r = Math.sqrt(x * x + y * y + z * z);
  return { lonRad: Math.atan2(y, x), latRad: Math.atan2(z, Math.sqrt(x * x + y * y)), r };
}

/** Fixed rotation: ecliptic J2000 rectangular → equatorial J2000 rectangular. */
function eclipticJ2000ToEquatorialJ2000(v: Vec3): Vec3 {
  const eps = degToRad(OBLIQUITY_J2000_DEG);
  const cosEps = Math.cos(eps);
  const sinEps = Math.sin(eps);
  const [x, y, z] = v;
  return [x, y * cosEps - z * sinEps, y * sinEps + z * cosEps];
}

const ASEC2RAD = degToRad(1 / 3600);

/**
 * IAU 2006 four-angle precession rotation, J2000 equatorial → mean-of-date
 * equatorial. Faithful port of Astronomy Engine's precession_rot(), the
 * "From2000" direction only (that is all this module needs) — see the file
 * header for why this is ported rather than approximated.
 */
function precessionFrom2000EquatorialJ2000ToDate(v: Vec3, tCenturiesTT: number): Vec3 {
  const t = tCenturiesTT;
  let eps0 = 84381.406;
  let psia = (((((-0.0000000951 * t + 0.000132851) * t - 0.00114045) * t - 1.0790069) * t +
    5038.481507) *
    t) as number;
  let omegaa = (((((0.0000003337 * t - 0.000000467) * t - 0.00772503) * t + 0.0512623) * t -
    0.025754) *
    t +
    eps0) as number;
  let chia = (((((-0.056e-6 * t + 0.170663e-3) * t - 0.00121197) * t - 2.3814292) * t + 10.556403) *
    t) as number;

  eps0 *= ASEC2RAD;
  psia *= ASEC2RAD;
  omegaa *= ASEC2RAD;
  chia *= ASEC2RAD;

  const sa = Math.sin(eps0);
  const ca = Math.cos(eps0);
  const sb = Math.sin(-psia);
  const cb = Math.cos(-psia);
  const sc = Math.sin(-omegaa);
  const cc = Math.cos(-omegaa);
  const sd = Math.sin(chia);
  const cd = Math.cos(chia);

  const xx = cd * cb - sb * sd * cc;
  const yx = cd * sb * ca + sd * cc * cb * ca - sa * sd * sc;
  const zx = cd * sb * sa + sd * cc * cb * sa + ca * sd * sc;
  const xy = -sd * cb - sb * cd * cc;
  const yy = -sd * sb * ca + cd * cc * cb * ca - sa * cd * sc;
  const zy = -sd * sb * sa + cd * cc * cb * sa + ca * cd * sc;
  const xz = sb * sc;
  const yz = -sc * cb * ca - sa * cc;
  const zz = -sc * cb * sa + cc * ca;

  // "From2000" direction: rot = [[xx,xy,xz],[yx,yy,yz],[zx,zy,zz]], applied
  // via Astronomy Engine's rotate() convention — see this file's header.
  const [inX, inY, inZ] = v;
  return [
    xx * inX + yx * inY + zx * inZ,
    xy * inX + yy * inY + zy * inZ,
    xz * inX + yz * inY + zz * inZ,
  ];
}

/**
 * Mean obliquity of the ecliptic (degrees) at time T (Julian centuries from
 * J2000 TT). Meeus eq. 22.3 — the exact same formula as chartBuilder.ts's
 * private `obliquity()`, duplicated here (not imported) to avoid a
 * circular import: chartBuilder.ts already imports from planets.ts, which
 * imports this file.
 */
function meanObliquityOfDateDeg(T: number): number {
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

/**
 * Rotate equatorial-of-date rectangular → ecliptic-of-date rectangular.
 * Same rotation FORM as eclipticJ2000ToEquatorialJ2000 run in reverse
 * (rotation matrices are orthogonal, so the inverse is the transpose —
 * negate the mixing terms), but at the OF-DATE obliquity, not J2000's.
 */
function equatorialOfDateToEclipticOfDate(v: Vec3, tCenturiesTT: number): Vec3 {
  const eps = degToRad(meanObliquityOfDateDeg(tCenturiesTT));
  const cosEps = Math.cos(eps);
  const sinEps = Math.sin(eps);
  const [x, y, z] = v;
  return [x, y * cosEps + z * sinEps, -y * sinEps + z * cosEps];
}

function vsopHeliocentricEclipticOfDate(
  lonSeries: VsopSeries,
  latSeries: VsopSeries,
  radSeries: VsopSeries,
  jdtt: JDtt,
): HeliocentricSpherical {
  const tMillennia = (jdtt - 2451545.0) / DAYS_PER_MILLENNIUM;
  const tCenturiesTT = (jdtt - 2451545.0) / 36525.0;

  const lonRad = vsopFormula(lonSeries, tMillennia);
  const latRad = vsopFormula(latSeries, tMillennia);
  const r = vsopFormula(radSeries, tMillennia);

  const eclJ2000 = sphericalToRect(lonRad, latRad, r);
  const equJ2000 = eclipticJ2000ToEquatorialJ2000(eclJ2000);
  const equOfDate = precessionFrom2000EquatorialJ2000ToDate(equJ2000, tCenturiesTT);
  const eclOfDate = equatorialOfDateToEclipticOfDate(equOfDate, tCenturiesTT);

  const spherical = rectToSpherical(eclOfDate);
  return {
    lonDeg: normalize360(radToDeg(spherical.lonRad)),
    latDeg: radToDeg(spherical.latRad),
    r: spherical.r,
  };
}

export function venusHeliocentricEclipticOfDate(jdtt: JDtt): HeliocentricSpherical {
  return vsopHeliocentricEclipticOfDate(VENUS_VSOP_L, VENUS_VSOP_B, VENUS_VSOP_R, jdtt);
}

export function marsHeliocentricEclipticOfDate(jdtt: JDtt): HeliocentricSpherical {
  return vsopHeliocentricEclipticOfDate(MARS_VSOP_L, MARS_VSOP_B, MARS_VSOP_R, jdtt);
}
