/**
 * Validates the VSOP87 heliocentric pipeline (vsop87Geocentric.ts) directly
 * against Astronomy Engine (https://github.com/cosinekitty/astronomy, MIT),
 * an independent, widely-used implementation of the same VSOP87 theory —
 * not against this codebase's own prior output, which would only prove
 * self-consistency, not correctness.
 *
 * Ground truth values below were computed by running Astronomy Engine
 * directly (`Ecliptic(HelioVector(body, date))`) at the exact instants this
 * file's sibling, ephemerisReferenceCases.test.ts, already uses as real
 * astronomical reference cases (Venus's inferior conjunction, Mars's
 * opposition) — reusing the same instants ties this unit-level check back
 * to the same real events rather than an arbitrary date.
 *
 * The small residual expected here (a few hundredths of an arcsecond to
 * ~1 arcsecond) is exactly what this module's header documents skipping:
 * nutation and the ICRS frame-bias terms, both far below the precision
 * this fix targets.
 */
import { isoToJD, jdutToJdtt } from '@astrology/primitives/julianDay';
import {
  venusHeliocentricEclipticOfDate,
  marsHeliocentricEclipticOfDate,
} from '@astrology/primitives/moshier/vsop87Geocentric';
import { angularDistance } from '@astrology/primitives/angles';

function jdttFromUtc(iso: string) {
  return jdutToJdtt(isoToJD(iso));
}

// Arcseconds of tolerance — generous relative to the ~1" actually measured,
// tight enough to catch a real regression (a wrong term, a units mixup, a
// dropped rotation step) many times over.
const TOLERANCE_DEG = 5 / 3600;

describe('Venus heliocentric ecliptic-of-date, vs. Astronomy Engine ground truth', () => {
  it('matches at the 2025-03-23 01:00 UTC inferior conjunction instant', () => {
    const jdtt = jdttFromUtc('2025-03-23T01:00:00Z');
    const helio = venusHeliocentricEclipticOfDate(jdtt);
    // Astronomy Engine: Ecliptic(HelioVector('Venus', new Date('2025-03-23T01:00:00Z')))
    expect(angularDistance(helio.lonDeg, 182.65228180872717)).toBeLessThan(TOLERANCE_DEG);
    expect(Math.abs(helio.latDeg - 3.2675684468466417)).toBeLessThan(TOLERANCE_DEG);
    expect(Math.abs(helio.r - 0.7202165770675388)).toBeLessThan(1e-6);
  });
});

describe('Mars heliocentric ecliptic-of-date, vs. Astronomy Engine ground truth', () => {
  it('matches at the 2025-01-16 01:10 UTC opposition instant', () => {
    const jdtt = jdttFromUtc('2025-01-16T01:10:00Z');
    const helio = marsHeliocentricEclipticOfDate(jdtt);
    // Astronomy Engine: Ecliptic(HelioVector('Mars', new Date('2025-01-16T01:10:00Z')))
    expect(angularDistance(helio.lonDeg, 116.1847070387107)).toBeLessThan(TOLERANCE_DEG);
    expect(Math.abs(helio.latDeg - 1.6954952934074583)).toBeLessThan(TOLERANCE_DEG);
    expect(Math.abs(helio.r - 1.626213226189547)).toBeLessThan(1e-6);
  });
});
