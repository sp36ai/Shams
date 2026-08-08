/**
 * judgeRKPWatch — unit tests for the clock-based "RKP Watch of Currents" engine.
 *
 * Fixture moment is fixed at 2025-04-27T10:51:00Z with timezoneOffsetMinutes=0
 * so the local minute is exactly 51 — the user's own worked example, which
 * puts Aquarius in house 1 and (per watchChart.test.ts) Scorpio in house 10.
 * Scorpio's lord is Mars, so every scenario below controls Mars's placement
 * (dignity/conjunction/aspect) to drive the career-question house-lord
 * verdict, matching src/astrology/primitives/watchChart.test.ts's confirmed
 * wheel exactly.
 *
 * career house matrix: favorable=[6,10,11], denial=[5,8,12], primary=10.
 */

import { judgeRKPWatch } from '../astrology/kp/judgment/judgeRKPWatch';
import type {
  Chart,
  Planet,
  PlanetPosition,
  HouseCusp,
  HouseIndex,
} from '../astrology/types/chart';
import type { ClassifiedQuestion } from '../astrology/types/question';

jest.setTimeout(15000);

const MOMENT = '2025-04-27T10:51:00Z'; // local minute 51 (tz offset 0) -> Aquarius Lagna

function cusp(house: number, lon: number): HouseCusp {
  return {
    house: house as HouseIndex,
    siderealLongitude: lon,
    sign: (Math.floor(lon / 30) + 1) as HouseCusp['sign'],
    degreeInSign: lon % 30,
    nakshatra: 1,
    nakshatraLord: 'Ketu',
    subLord: 'Mars',
    subSubLord: 'Saturn',
  };
}

function planet(
  name: Planet,
  lon: number,
  overrides: Partial<PlanetPosition> = {},
): PlanetPosition {
  return {
    planet: name,
    siderealLongitude: lon,
    siderealLatitude: 0,
    dailySpeed: 1,
    isRetrograde: false,
    isCombust: false,
    sign: (Math.floor(lon / 30) + 1) as PlanetPosition['sign'],
    degreeInSign: lon % 30,
    nakshatra: 1,
    pada: 1,
    nakshatraLord: 'Ketu',
    subLord: 'Saturn',
    subSubLord: 'Jupiter',
    ...overrides,
  };
}

/**
 * Baseline: every planet parked clear of house4 (Taurus) — the universal
 * 7th-aspect trigger onto house10 (Scorpio) — and clear of house10 itself,
 * so Mars's house-10 lordship analysis starts clean (own sign, no
 * conjunction/aspect noise). Verified empirically against the real engine
 * before being hardcoded here (see PR description / commit for the debug
 * trace) — same convention as judgeKP.test.ts.
 */
function makeChart(
  overrides: Partial<Record<Planet, number>> = {},
  extra: Partial<Record<Planet, Partial<PlanetPosition>>> = {},
): Chart {
  const lons: Record<Planet, number> = {
    Sun: 15, // house3 Aries
    Moon: 345, // house2 Pisces
    Mercury: 75, // house5 Gemini
    Venus: 195, // house9 Libra
    Mars: 225, // house10 Scorpio (own sign)
    Jupiter: 255, // house11 Sagittarius (own sign)
    Saturn: 285, // house12 Capricorn (own sign)
    Rahu: 345, // house2 Pisces
    Ketu: 135, // house7 Leo
    ...overrides,
  };

  const planets = Object.fromEntries(
    (Object.keys(lons) as Planet[]).map(p => [p, planet(p, lons[p], extra[p] ?? {})]),
  ) as Record<Planet, PlanetPosition>;

  const cusps = Array.from({ length: 12 }, (_, i) => cusp(i + 1, i * 30)) as Chart['cusps'];

  return {
    momentUtc: MOMENT,
    julianDayUt: 2460793.916667,
    location: { latitude: 19.076, longitude: 72.877, label: 'Mumbai' },
    ayanamsa: 'lahiri',
    ayanamsaValue: 23.73,
    houseSystem: 'placidus',
    planets,
    cusps,
    ascendant: cusps[0],
    midheaven: cusps[9],
    rulingPlanets: ['Sun', 'Saturn', 'Mercury', 'Jupiter', 'Moon', 'Venus'],
    horaLord: 'Saturn',
    engineVersion: '2.0.0',
  };
}

const CAREER_Q: ClassifiedQuestion = {
  text: 'Will I get the promotion this year?',
  lang: 'en',
  qType: 'career',
  confidence: 0.95,
  matchedKeywords: ['promotion', 'career'],
};

describe('judgeRKPWatch — watch chart wiring', () => {
  test('local minute 51 (tz offset 0) activates Aquarius Lagna, Scorpio/house10', () => {
    const chart = makeChart();
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.watch.lagnaSign).toBe(11); // Aquarius
    expect(verdict.primaryHouse).toBe(10);
    expect(verdict.houseLord.sign).toBe(8); // Scorpio
    expect(verdict.houseLord.lord).toBe('Mars');
  });
});

describe('judgeRKPWatch — house-lord dignity drives the base direction', () => {
  test('YES_STRONG: Mars own-sign, Moon sub-lord agrees, ruling planets favor', () => {
    const chart = makeChart(
      { Saturn: 255, Mercury: 105 },
      {
        Moon: { subLord: 'Jupiter', nakshatraLord: 'Mercury' },
      },
    );
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.houseLord.dignity).toBe('own');
    expect(verdict.houseLord.verdict).toBe('supported');
    expect(verdict.moonConfirmation.agreement).toBe('agrees');
    expect(verdict.rulingConfirmation.favorableWitnesses.length).toBeGreaterThan(
      verdict.rulingConfirmation.denialWitnesses.length,
    );
    expect(verdict.nativeState).toBe('YES_STRONG');
    expect(verdict.verdict).toBe('YES');
    expect(verdict.timing).toBeDefined();
  });

  test('DELAY: same as YES_STRONG but Mars (the house lord) is retrograde', () => {
    const chart = makeChart(
      { Saturn: 255, Mercury: 105 },
      {
        Moon: { subLord: 'Jupiter', nakshatraLord: 'Mercury' },
        Mars: { isRetrograde: true },
      },
    );
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.houseLord.verdict).toBe('supported');
    expect(verdict.houseLord.retrograde).toBe(true);
    expect(verdict.nativeState).toBe('DELAY');
    expect(verdict.verdict).toBe('DELAYED');
  });

  test('NO_DENIED: Mars debilitated in the house-10 sign', () => {
    // Mars debilitated in Cancer (sign 4) instead of its own Scorpio placement.
    const chart = makeChart({ Mars: 105 });
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.houseLord.dignity).toBe('debilitated');
    expect(verdict.houseLord.verdict).toBe('obstructed');
    expect(verdict.nativeState).toBe('NO_DENIED');
    expect(verdict.verdict).toBe('NO');
    expect(verdict.timing).toBeUndefined();
  });
});

describe('judgeRKPWatch — output shape', () => {
  test('reasoning trace is present and WATCH-namespaced', () => {
    const chart = makeChart();
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.reasoning.length).toBeGreaterThan(0);
    expect(verdict.reasoning.every(r => r.ruleId.startsWith('WATCH_'))).toBe(true);
  });

  test('id is a deterministic hash', () => {
    const chart = makeChart();
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.id).toMatch(/^[0-9a-f]{8}-/);
  });
});

describe('judgeRKPWatch — determinism', () => {
  test('same chart + question + options always produces the same verdict', () => {
    const chart = makeChart();
    const a = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    const b = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(a.id).toBe(b.id);
    expect(a.nativeState).toBe(b.nativeState);
    expect(a.reasoning).toEqual(b.reasoning);
  });
});
