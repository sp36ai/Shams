/**
 * judgeHorary — unit tests for the 5-step RKP verdict engine.
 *
 * Fixture design:
 *   Cusps evenly spaced at 30° intervals so house membership is trivial:
 *     house N contains longitudes [(N-1)*30, N*30)
 *   To place a planet in house N → set siderealLongitude = (N-1)*30 + 15
 *
 * career house matrix: favorable=[6,10,11], denial=[5,8,12]
 *   house 6  starts at 150°  → centre = 165°
 *   house 8  starts at 210°  → centre = 225°
 *   house 10 starts at 270°  → centre = 285°
 *   house 11 starts at 300°  → centre = 315°
 *   house 12 starts at 330°  → centre = 345°
 */

import { judgeHorary } from '../astrology/kp/judgment/judgeHorary';
import type {
  Chart,
  Planet,
  PlanetPosition,
  HouseCusp,
  HouseIndex,
} from '../astrology/types/chart';
import type { ClassifiedQuestion } from '../astrology/types/question';

jest.setTimeout(15000);

// ── Fixture helpers ───────────────────────────────────────────────────────────

const MOMENT = '2025-04-27T10:00:00Z';

function cusp(house: number, lon: number): HouseCusp {
  const h = house as HouseIndex;
  return {
    house: h,
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

const EVEN_CUSPS = Array.from({ length: 12 }, (_, i) => cusp(i + 1, i * 30)) as [
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

function makeChart(
  moonSubLord: Planet,
  planetHouses: Partial<Record<Planet, number>>,
  retrogrades: Partial<Record<Planet, boolean>> = {},
  rulingPlanets: [Planet, Planet, Planet, Planet, Planet] = [
    'Sun',
    'Mercury',
    'Jupiter',
    'Moon',
    'Venus',
  ],
): Chart {
  const houseToLon = (h: number) => (h - 1) * 30 + 15;

  const planets: Record<Planet, PlanetPosition> = {
    Sun: planet('Sun', houseToLon(planetHouses.Sun ?? 1)),
    Moon: planet('Moon', houseToLon(planetHouses.Moon ?? 1), { subLord: moonSubLord }),
    Mars: planet('Mars', houseToLon(planetHouses.Mars ?? 3), {
      isRetrograde: retrogrades.Mars ?? false,
    }),
    Mercury: planet('Mercury', houseToLon(planetHouses.Mercury ?? 2), {
      isRetrograde: retrogrades.Mercury ?? false,
    }),
    Jupiter: planet('Jupiter', houseToLon(planetHouses.Jupiter ?? 4), {
      isRetrograde: retrogrades.Jupiter ?? false,
    }),
    Venus: planet('Venus', houseToLon(planetHouses.Venus ?? 5), {
      isRetrograde: retrogrades.Venus ?? false,
    }),
    Saturn: planet('Saturn', houseToLon(planetHouses.Saturn ?? 7), {
      isRetrograde: retrogrades.Saturn ?? false,
    }),
    Rahu: planet('Rahu', houseToLon(planetHouses.Rahu ?? 9)),
    Ketu: planet('Ketu', houseToLon(planetHouses.Ketu ?? 3)),
  };

  return {
    momentUtc: MOMENT,
    julianDayUt: 2460793.916667,
    location: { latitude: 19.076, longitude: 72.877, label: 'Mumbai' },
    ayanamsa: 'lahiri',
    ayanamsaValue: 23.73,
    houseSystem: 'placidus',
    planets,
    cusps: EVEN_CUSPS,
    ascendant: EVEN_CUSPS[0],
    midheaven: EVEN_CUSPS[9],
    rulingPlanets,
    horaLord: rulingPlanets[1],
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('judgeHorary — scoring and verdict', () => {
  test('YES: Moon Sub-Lord in favorable house + all RPs in favorable houses', () => {
    // Moon Sub-Lord = Mars → house 10 (favorable for career) → +2
    // Day/Hora/Minute lords: Sun→6, Mercury→6, Jupiter→11  → +3
    // Total: +5 → YES, no retrogrades
    const chart = makeChart('Mars', { Moon: 1, Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 }, {}, [
      'Sun',
      'Mercury',
      'Jupiter',
    ]);
    const verdict = judgeHorary(chart, CAREER_Q);
    expect(verdict.verdict).toBe('YES');
  });

  test('NO: Moon Sub-Lord in denial house + RPs in denial houses', () => {
    // Moon Sub-Lord = Venus → house 12 (denial for career) → -2
    // Day/Hora/Minute lords: Sun→5, Mercury→8, Jupiter→12 → -3
    // Total: -5 → NO
    const chart = makeChart('Venus', { Moon: 1, Venus: 12, Sun: 5, Mercury: 8, Jupiter: 12 }, {}, [
      'Sun',
      'Mercury',
      'Jupiter',
    ]);
    const verdict = judgeHorary(chart, CAREER_Q);
    expect(verdict.verdict).toBe('NO');
  });

  test('CONDITIONAL: neutral Moon Sub-Lord + mixed RPs → score in [-1,+2]', () => {
    // Moon Sub-Lord = Saturn → house 7 (neutral for career) → 0
    // Day lord Sun→6 (+1), Hora lord Mercury→3 (neutral, 0), Minute lord Jupiter→5 (denial, -1)
    // Total: 0 → CONDITIONAL
    const chart = makeChart('Saturn', { Moon: 1, Saturn: 7, Sun: 6, Mercury: 3, Jupiter: 5 }, {}, [
      'Sun',
      'Mercury',
      'Jupiter',
    ]);
    const verdict = judgeHorary(chart, CAREER_Q);
    expect(verdict.verdict).toBe('CONDITIONAL');
  });

  test('DELAYED: score ≥3 but Jupiter is retrograde', () => {
    // Same high-YES chart as first test but Jupiter retrograde → DELAYED
    const chart = makeChart(
      'Mars',
      { Moon: 1, Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 },
      { Jupiter: true },
      ['Sun', 'Mercury', 'Jupiter'],
    );
    const verdict = judgeHorary(chart, CAREER_Q);
    expect(verdict.verdict).toBe('DELAYED');
  });

  test('DELAYED: score ≥3 but Moon Sub-Lord is retrograde', () => {
    const chart = makeChart(
      'Mars',
      { Moon: 1, Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 },
      { Mars: true },
      ['Sun', 'Mercury', 'Jupiter'],
    );
    const verdict = judgeHorary(chart, CAREER_Q);
    expect(verdict.verdict).toBe('DELAYED');
  });

  test('NO verdict does not trigger DELAYED even with retrogrades', () => {
    const chart = makeChart(
      'Venus',
      { Moon: 1, Venus: 12, Sun: 5, Mercury: 8, Jupiter: 12 },
      { Jupiter: true, Venus: true },
      ['Sun', 'Mercury', 'Jupiter'],
    );
    const verdict = judgeHorary(chart, CAREER_Q);
    expect(verdict.verdict).toBe('NO');
  });
});

describe('judgeHorary — output shape', () => {
  test('returns required Verdict fields', () => {
    const chart = makeChart('Mars', { Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 });
    const verdict = judgeHorary(chart, CAREER_Q);

    expect(verdict).toMatchObject({
      verdict: expect.stringMatching(/^(YES|NO|CONDITIONAL|DELAYED|UNCLEAR)$/),
      confidence: expect.any(Number),
    });
    expect(verdict.id).toMatch(/^[0-9a-f]{8}-/);
    expect(verdict.reasoning).toBeInstanceOf(Array);
    expect(verdict.reasoning.length).toBeGreaterThan(0);
  });

  test('reasoning steps are numbered 1–5 in order', () => {
    const chart = makeChart('Mars', { Mars: 10, Sun: 6, Mercury: 11 });
    const verdict = judgeHorary(chart, CAREER_Q);
    const stepNums = verdict.reasoning
      .filter(r => /^\[STEP \d\]/.test(r.description))
      .map(r => parseInt(r.description.match(/\[STEP (\d)\]/)![1], 10));
    expect(stepNums[0]).toBe(1);
    expect(Math.max(...stepNums)).toBeGreaterThanOrEqual(5);
  });
});

describe('judgeHorary — determinism', () => {
  test('same chart + question always produces the same id and verdict', () => {
    const chart = makeChart('Mars', { Mars: 10 });
    const a = judgeHorary(chart, CAREER_Q);
    const b = judgeHorary(chart, CAREER_Q);
    expect(a.id).toBe(b.id);
    expect(a.verdict).toBe(b.verdict);
  });
});

describe('judgeHorary — house matrix coverage', () => {
  const qTypes: Array<ClassifiedQuestion['qType']> = [
    'marriage',
    'finance',
    'health',
    'property',
    'travel',
    'legal',
    'education',
    'business',
  ];

  test.each(qTypes)('produces a valid verdict for %s questions', qType => {
    const chart = makeChart('Mars', { Mars: 10, Sun: 6, Mercury: 11 });
    const q: ClassifiedQuestion = {
      ...CAREER_Q,
      qType,
      text: `Test question for ${qType}`,
    };
    const verdict = judgeHorary(chart, q);
    expect(['YES', 'NO', 'CONDITIONAL', 'DELAYED', 'UNCLEAR']).toContain(verdict.verdict);
  });
});
