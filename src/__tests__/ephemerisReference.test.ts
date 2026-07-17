/**
 * Ephemeris reference test — locks the astronomy engine to EXTERNAL
 * astronomical truth, not just to its own current output.
 *
 * If a future change silently breaks the ephemeris, ayanamsa, sidereal
 * conversion, or house geometry, these anchors fail. Each expectation is
 * justified against a published/derivable value, not reverse-engineered from
 * the code.
 *
 * All positions are Lahiri-sidereal decimal degrees unless noted "tropical".
 */

import { buildChart } from '@astrology/primitives/chartBuilder';
import { ascendant, mcFromRamc, computeHouseCusps } from '@astrology/primitives/houseCusps';

const OBLIQUITY_2000 = 23.4392911; // mean obliquity at J2000, degrees

describe('ayanamsa (Lahiri / Chitrapaksha)', () => {
  it('is ~23.85° at J2000 and ~24.21° in 2025', () => {
    // Lahiri ayanamsa at J2000.0 is 23°51′ ≈ 23.853°; precession ~50.29″/yr.
    const j2000 = buildChart('2000-01-01T12:00:00Z', 0, 0).ayanamsaValue;
    const y2025 = buildChart('2025-01-01T00:00:00Z', 0, 0).ayanamsaValue;
    expect(j2000).toBeGreaterThan(23.84);
    expect(j2000).toBeLessThan(23.87);
    expect(y2025).toBeGreaterThan(24.15);
    expect(y2025).toBeLessThan(24.25);
  });
});

describe('Sun — sidereal solar ingress into Aries (Lahiri Mesha Sankranti)', () => {
  // The Lahiri sidereal Sun entered Aries on 2025-04-14. So at 12:00 UTC the
  // day before it is still in late Pisces (~359°+), and on the 14th it is just
  // past 0° Aries. This brackets the ingress and validates Sun + ayanamsa + time
  // together to within the Sun's ~1°/day motion.
  it('is in late Pisces on 2025-04-13 and just past Aries 0° on 2025-04-14', () => {
    const delhi = [28.6139, 77.209] as const;
    const before = buildChart('2025-04-13T12:00:00Z', ...delhi).planets.Sun.siderealLongitude;
    const after = buildChart('2025-04-14T12:00:00Z', ...delhi).planets.Sun.siderealLongitude;
    expect(before).toBeGreaterThan(359.0);
    expect(before).toBeLessThan(360.0);
    expect(after).toBeGreaterThan(0.0);
    expect(after).toBeLessThan(1.2);
  });
});

describe('J2000.0 geocentric positions (2000-01-01 12:00 UTC)', () => {
  const c = buildChart('2000-01-01T12:00:00Z', 51.4779, 0.0); // Greenwich
  const ayan = c.ayanamsaValue;

  it('Sun tropical ≈ 280.37° (mean 280.46° − equation of centre 0.086°)', () => {
    const sunTropical = c.planets.Sun.siderealLongitude + ayan;
    expect(sunTropical).toBeGreaterThan(280.2);
    expect(sunTropical).toBeLessThan(280.5);
  });

  it('Moon tropical ≈ 223.3° (Meeus Ch.47 truncated ELP2000)', () => {
    const moonTropical = c.planets.Moon.siderealLongitude + ayan;
    expect(moonTropical).toBeGreaterThan(223.0);
    expect(moonTropical).toBeLessThan(223.6);
  });
});

describe('house geometry — analytic identities (ephemeris-independent)', () => {
  it('RAMC = 0 at the equator → ASC = 90° (Cancer 0°), MC = 0° (Aries 0°)', () => {
    // With the vernal point culminating and φ = 0, the eastern horizon rises at
    // the summer solstice point. Pure spherical trig, no ephemeris involved.
    expect(ascendant(0, OBLIQUITY_2000, 0)).toBeCloseTo(90, 4);
    expect(mcFromRamc(0, OBLIQUITY_2000)).toBeCloseTo(0, 4);
  });

  it('opposite cusps are exactly 180° apart, ASC/MC included', () => {
    const { cusps } = computeHouseCusps(123.456, OBLIQUITY_2000, 28.6);
    for (let i = 0; i < 6; i++) {
      const separation = (((cusps[i]! - cusps[i + 6]!) % 360) + 360) % 360;
      expect(Math.abs(separation - 180)).toBeLessThan(1e-6);
    }
  });

  it('falls back to Porphyry beyond the Placidus latitude limit (|φ| > 66.5°)', () => {
    expect(computeHouseCusps(100, OBLIQUITY_2000, 70).system).toBe('Porphyry');
    expect(computeHouseCusps(100, OBLIQUITY_2000, 45).system).toBe('Placidus');
  });
});

describe('determinism', () => {
  it('same (moment, lat, lon) → byte-identical sidereal longitudes', () => {
    const a = buildChart('2025-06-21T06:30:00Z', 28.6139, 77.209);
    const b = buildChart('2025-06-21T06:30:00Z', 28.6139, 77.209);
    for (const p of Object.keys(a.planets) as (keyof typeof a.planets)[]) {
      expect(a.planets[p].siderealLongitude).toBe(b.planets[p].siderealLongitude);
    }
    expect(a.ascendant.siderealLongitude).toBe(b.ascendant.siderealLongitude);
  });
});
