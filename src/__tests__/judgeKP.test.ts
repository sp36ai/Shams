/**
 * judgeKP — unit tests for the classical KP judgment engine.
 *
 * Fixture design mirrors judgeHorary.test.ts (same EVEN_CUSPS/planet/makeChart
 * pattern) so the two engines' test suites stay easy to compare side by side.
 * Deliberately NOT sharing fixture helpers with judgeHorary.test.ts — keeping
 * each engine's test file self-contained means neither can accidentally
 * regress the other via a shared-fixture edit.
 *
 * career house matrix: favorable=[6,10,11], denial=[5,8,12], primary=10
 *   house 6  starts at 150°  → centre = 165°
 *   house 8  starts at 210°  → centre = 225°
 *   house 10 starts at 270°  → centre = 285°
 *   house 11 starts at 300°  → centre = 315°
 *   house 12 starts at 330°  → centre = 345°
 */

import { judgeKP } from '../astrology/kp/judgment/judgeKP';
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

// ── Fixture helpers (self-contained, mirrors judgeHorary.test.ts) ─────────────

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
  rulingPlanets: [Planet, Planet, Planet, Planet, Planet, Planet] = [
    'Sun', // [0] dayLord
    'Saturn', // [1] horaLord — excluded from KP's witness set entirely
    'Mercury', // [2] ascSignLord
    'Jupiter', // [3] ascStarLord
    'Moon', // [4] moonSignLord
    'Venus', // [5] moonStarLord
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

describe('judgeKP — promise layer', () => {
  test('DENIED when the primary cusp sub-lord occupies a denial house', () => {
    // cusp(10,...).subLord is hardcoded 'Mars' by the cusp() fixture helper.
    // Placing Mars in house 8 (denial for career) fails the promise check.
    const chart = makeChart('Mars', { Mars: 8 });
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.verdict).toBe('DENIED');
    expect(verdict.stage).toBe('promise_failed');
    expect(verdict.engine).toBe('KP');
    expect(verdict.remedy).toBeUndefined();
    expect(verdict.confidence).toBe(0);
  });

  test('promise holds when the primary cusp sub-lord is outside denial houses', () => {
    // Mars in house 10 (favorable, primary) — promise passes.
    const chart = makeChart('Mars', { Mars: 10 });
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.stage).toBe('fructification');
    expect(verdict.verdict).not.toBe('DENIED');
  });
});

describe('judgeKP — fructification: majority count, not a weighted score', () => {
  test('confirmedCount > deniedCount → YES', () => {
    // Sun(dayLord)@6 fav, Mercury(ascSignLord)@6 fav, Jupiter(ascStarLord)@11 fav
    // occupy favorable houses (tier-2 significators). Mars@10 keeps the promise held.
    const chart = makeChart('Mars', { Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 });
    const verdict = judgeKP(chart, CAREER_Q);
    const confirmed = verdict.confirmedSignificators?.length ?? 0;
    const denied = verdict.deniedSignificators?.length ?? 0;
    expect(confirmed).toBeGreaterThan(denied);
    expect(verdict.verdict).toBe('YES');
  });

  test('deniedCount > confirmedCount → NO', () => {
    // Sun@5 (tier-2 + tier-4 lord of house 5) and Jupiter (tier-4 lord of
    // house 12, via its cusp sign lord) both survive the Kotamraju filter
    // and land as denial significators; Venus is moved off its default
    // house 5 so the Sun/Venus/Jupiter sub-lord chain doesn't self-filter
    // everything out (see docs/KP_RULES_CLASSICAL.md §4-5 — Kotamraju
    // filters on a witness's OWN computed sub-lord, not the house it
    // occupies, so a naive "just place them in denial houses" fixture can
    // accidentally filter every witness at once).
    const chart = makeChart('Mars', { Mars: 10, Sun: 5, Mercury: 8, Venus: 2 });
    const verdict = judgeKP(chart, CAREER_Q);
    const confirmed = verdict.confirmedSignificators?.length ?? 0;
    const denied = verdict.deniedSignificators?.length ?? 0;
    expect(denied).toBeGreaterThan(confirmed);
    expect(verdict.verdict).toBe('NO');
  });

  test('tie (including 0/0) → CONDITIONAL', () => {
    // No witness placed in any favorable/denial house and no house-lord
    // coincidence with a witness planet — confirmed == denied.
    const chart = makeChart('Saturn', { Mars: 10, Saturn: 7 });
    const verdict = judgeKP(chart, CAREER_Q);
    const confirmed = verdict.confirmedSignificators?.length ?? 0;
    const denied = verdict.deniedSignificators?.length ?? 0;
    expect(confirmed).toBe(denied);
    expect(verdict.verdict).toBe('CONDITIONAL');
  });

  test('verdict has no numeric-score reasoning step (no ≥3/≤−2 thresholds)', () => {
    const chart = makeChart('Mars', { Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 });
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.reasoning.some(r => /≥3|≤−2|Total score/.test(r.description))).toBe(false);
  });
});

describe('judgeKP — 5 Classical Witnesses (no Hora Lord)', () => {
  test('Hora Lord placement never affects the verdict', () => {
    // Same chart, only horaLord (index 1) differs between the two RP tuples.
    const base: [Planet, Planet, Planet, Planet, Planet, Planet] = [
      'Sun',
      'Saturn',
      'Mercury',
      'Jupiter',
      'Moon',
      'Venus',
    ];
    const altHoraLord: [Planet, Planet, Planet, Planet, Planet, Planet] = [
      'Sun',
      'Rahu', // different horaLord — must have zero effect on judgeKP
      'Mercury',
      'Jupiter',
      'Moon',
      'Venus',
    ];
    const chartA = makeChart('Mars', { Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 }, {}, base);
    const chartB = makeChart(
      'Mars',
      { Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 },
      {},
      altHoraLord,
    );
    const a = judgeKP(chartA, CAREER_Q);
    const b = judgeKP(chartB, CAREER_Q);
    expect(a.verdict).toBe(b.verdict);
    expect(a.confidence).toBe(b.confidence);
    expect(a.confirmedSignificators).toEqual(b.confirmedSignificators);
  });

  test("rulingPlanets snapshot has no horaLord key for KP's output", () => {
    const chart = makeChart('Mars', { Mars: 10 });
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.rulingPlanets.horaLord).toBeUndefined();
  });

  test('a chart where Hora Lord alone would flip an RKP-style verdict does not flip KP', () => {
    // Construct a chart where RKP (which scores horaLord-excluded 5 RPs the
    // same as KP's witness set, so this specifically isolates that KP simply
    // never reads chart.horaLord/rulingPlanets[1] at all) still agrees in
    // direction with KP for the same witness placement — proving KP's witness
    // selection genuinely excludes index 1 rather than accidentally using it.
    const chart = makeChart('Mars', { Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 }, {}, [
      'Sun',
      'Jupiter', // horaLord swapped to a planet that IS a favorable significator —
      // if judgeKP accidentally used index 1 as a witness this would change
      // confirmedCount; it must not.
      'Mercury',
      'Jupiter',
      'Moon',
      'Venus',
    ]);
    const withNeutralHora = makeChart('Mars', { Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 }, {}, [
      'Sun',
      'Saturn',
      'Mercury',
      'Jupiter',
      'Moon',
      'Venus',
    ]);
    const a = judgeKP(chart, CAREER_Q);
    const b = judgeKP(withNeutralHora, CAREER_Q);
    expect(a.confirmedSignificators).toEqual(b.confirmedSignificators);
    expect(a.deniedSignificators).toEqual(b.deniedSignificators);
    expect(a.verdict).toBe(b.verdict);
  });
});

describe('judgeKP — retrograde → DELAYED modifier', () => {
  test('DELAYED: verdict would be YES but Jupiter is retrograde', () => {
    const chart = makeChart(
      'Mars',
      { Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 },
      { Jupiter: true },
    );
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.verdict).toBe('DELAYED');
  });

  test('DELAYED: verdict would be YES but Moon Sub-Lord is retrograde', () => {
    const chart = makeChart('Mars', { Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 }, { Mars: true });
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.verdict).toBe('DELAYED');
  });

  test('NO verdict does not trigger DELAYED even with retrogrades', () => {
    const chart = makeChart(
      'Mars',
      { Mars: 10, Sun: 5, Mercury: 8, Venus: 2 },
      { Jupiter: true, Mercury: true },
    );
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.verdict).toBe('NO');
  });
});

describe('judgeKP — remedy (shared with RKP, same Moon-Sub-Lord basis)', () => {
  test.each<['YES' | 'NO' | 'CONDITIONAL' | 'DELAYED', Chart, Planet]>([
    ['YES', makeChart('Mars', { Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 }), 'Mars'],
    ['NO', makeChart('Mars', { Mars: 10, Sun: 5, Mercury: 8, Venus: 2 }), 'Mars'],
    ['CONDITIONAL', makeChart('Saturn', { Mars: 10, Saturn: 7 }), 'Saturn'],
    [
      'DELAYED',
      makeChart('Mars', { Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 }, { Jupiter: true }),
      'Mars',
    ],
  ])(
    'remedy is populated for a %s verdict (planet = Moon Sub-Lord)',
    (_kind, chart, moonSubLord) => {
      const verdict = judgeKP(chart, CAREER_Q);
      expect(verdict.remedy).toBeDefined();
      expect(verdict.remedy?.planet).toBe(moonSubLord);
      expect(verdict.remedy?.action.length).toBeGreaterThan(0);
    },
  );

  test('remedy is absent for a DENIED verdict (promise failed before remedy is computed)', () => {
    const chart = makeChart('Mars', { Mars: 8 });
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.verdict).toBe('DENIED');
    expect(verdict.remedy).toBeUndefined();
  });
});

describe("judgeKP — horary number witness (classical KP's own technique)", () => {
  // Probed: horaryNumber 13 → sub-lord 'Mars' (via getSubLords on the
  // 360°/249 mapping) — 5 → sub-lord 'Rahu'. Neither Mars nor Rahu is one
  // of the 5 Classical Witnesses, so moving them doesn't also change the
  // ordinary STEP 3 witness/significator scoring — a clean, isolated way
  // to test the horary witness's own ±1 contribution to the majority count.

  test('judgeKP accepts (chart, question, horaryNumber?) — horaryNumber is optional', () => {
    // TS `?` params without a default still count toward runtime .length
    // (unlike default-valued params) — 3 here just confirms the parameter
    // exists at all; the real "optional" behavior is exercised by the
    // "omitting horaryNumber" test below.
    expect(judgeKP.length).toBe(3);
  });

  test('omitting horaryNumber leaves output fields untouched', () => {
    const chart = makeChart('Mars', { Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 });
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.horaryNumber).toBeUndefined();
    expect(verdict.horarySubLord).toBeUndefined();
    expect(verdict.horarySubLordHouse).toBeUndefined();
  });

  test('a favorable horary witness tips a CONDITIONAL (tied) chart to YES', () => {
    // Base tie fixture (confirmed=0, denied=0 → CONDITIONAL, per the
    // "fructification" describe block above). Mars already sits at house
    // 10 (favorable) to hold the promise — horaryNumber 13 resolves to
    // Mars too, so its house (10, favorable) becomes a confirm vote.
    const chart = makeChart('Saturn', { Mars: 10, Saturn: 7 });
    const without = judgeKP(chart, CAREER_Q);
    expect(without.verdict).toBe('CONDITIONAL');

    const withWitness = judgeKP(chart, CAREER_Q, 13);
    expect(withWitness.horaryNumber).toBe(13);
    expect(withWitness.horarySubLord).toBe('Mars');
    expect(withWitness.horarySubLordHouse).toBe(10);
    expect(
      withWitness.reasoning.some(r => r.description.includes('Horary №13') && r.weight === 1),
    ).toBe(true);
    expect(withWitness.verdict).toBe('YES');
  });

  test('a denial horary witness tips a CONDITIONAL (tied) chart to NO', () => {
    // Same tie base, Rahu moved to house 8 (denial) — horaryNumber 5
    // resolves to Rahu.
    const chart = makeChart('Saturn', { Mars: 10, Saturn: 7, Rahu: 8 });
    const without = judgeKP(chart, CAREER_Q);
    expect(without.verdict).toBe('CONDITIONAL');

    const withWitness = judgeKP(chart, CAREER_Q, 5);
    expect(withWitness.horarySubLord).toBe('Rahu');
    expect(withWitness.horarySubLordHouse).toBe(8);
    expect(
      withWitness.reasoning.some(r => r.description.includes('Horary №5') && r.weight === -1),
    ).toBe(true);
    expect(withWitness.verdict).toBe('NO');
  });

  test('out-of-range horary numbers are clamped, not thrown', () => {
    const chart = makeChart('Mars', { Mars: 10 });
    expect(() => judgeKP(chart, CAREER_Q, 0)).not.toThrow();
    expect(() => judgeKP(chart, CAREER_Q, 999)).not.toThrow();
    expect(judgeKP(chart, CAREER_Q, 0).horaryNumber).toBe(0); // raw input preserved for display
    expect(judgeKP(chart, CAREER_Q, 0).horarySubLordHouse).toBeDefined(); // clamped internally to 1
  });

  test('DENIED path still passes horaryNumber through (raw), no sub-lord computed', () => {
    const chart = makeChart('Mars', { Mars: 8 });
    const verdict = judgeKP(chart, CAREER_Q, 13);
    expect(verdict.verdict).toBe('DENIED');
    expect(verdict.horaryNumber).toBe(13);
    expect(verdict.horarySubLord).toBeUndefined();
    expect(verdict.horarySubLordHouse).toBeUndefined();
  });
});

describe('judgeKP — determinism', () => {
  test('same chart + question always produces the same id and verdict', () => {
    const chart = makeChart('Mars', { Mars: 10 });
    const a = judgeKP(chart, CAREER_Q);
    const b = judgeKP(chart, CAREER_Q);
    expect(a.id).toBe(b.id);
    expect(a.verdict).toBe(b.verdict);
  });

  test("KP verdict id never collides with RKP's verdict id for the same reading", () => {
    const chart = makeChart('Mars', { Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 });
    const rkp = judgeHorary(chart, CAREER_Q);
    const kp = judgeKP(chart, CAREER_Q);
    expect(kp.id).not.toBe(rkp.id);
    expect(rkp.engine).toBe('RKP');
    expect(kp.engine).toBe('KP');
  });
});

describe('judgeKP — house matrix coverage', () => {
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
    const verdict = judgeKP(chart, q);
    expect(['YES', 'NO', 'CONDITIONAL', 'DELAYED', 'DENIED']).toContain(verdict.verdict);
  });
});

describe('judgeKP — oracle narration language', () => {
  const FORBIDDEN_TERMS = [
    'nakshatra',
    'rashi',
    'dasha',
    'mahadasha',
    'antardasha',
    'lagna',
    'surya',
    'chandra',
    'shani',
    'mangal',
    'budha',
    'ashwini',
    'bharani',
    'rohini',
    'ardra',
    'significator',
    'sub-lord',
    'cusp',
  ];

  test('narration fields contain no Vedic/Sanskrit/KP technical terms', () => {
    const chart = makeChart('Mars', { Mars: 10, Sun: 6, Mercury: 6, Jupiter: 11 });
    const verdict = judgeKP(chart, CAREER_Q);

    const allNarration = [verdict.narration.en, verdict.narration.ur, verdict.narration.hi]
      .join(' ')
      .toLowerCase();

    for (const term of FORBIDDEN_TERMS) {
      expect(allNarration).not.toContain(term);
    }
  });
});
