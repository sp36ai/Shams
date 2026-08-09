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

const PROPERTY_Q: ClassifiedQuestion = {
  text: 'Will the house purchase go through?',
  lang: 'en',
  qType: 'property',
  confidence: 0.95,
  matchedKeywords: ['house', 'property'],
};

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
    expect(verdict.houseLord.direction).toBe('North'); // Scorpio = water = North
  });
});

describe('judgeRKPWatch — Vastu scan', () => {
  test('reports every planet by direction and flags directions holding a malefic', () => {
    // Baseline fixture signs: Sun=Aries(E), Moon=Pisces(N), Mercury=Gemini(W),
    // Venus=Libra(W), Mars=Scorpio(N), Jupiter=Sagittarius(E), Saturn=Capricorn(S),
    // Rahu=Pisces(N), Ketu=Leo(E).
    const chart = makeChart();
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.vastu.occupantsByDirection.East).toEqual(
      expect.arrayContaining(['Sun', 'Jupiter', 'Ketu']),
    );
    expect(verdict.vastu.occupantsByDirection.North).toEqual(
      expect.arrayContaining(['Moon', 'Mars', 'Rahu']),
    );
    expect(verdict.vastu.occupantsByDirection.West).toEqual(
      expect.arrayContaining(['Mercury', 'Venus']),
    );
    expect(verdict.vastu.occupantsByDirection.South).toEqual(['Saturn']);
    // West holds only benefics (Mercury, Venus) — the one clean direction here.
    expect(verdict.vastu.afflictedDirections).toEqual(
      expect.arrayContaining(['East', 'North', 'South']),
    );
    expect(verdict.vastu.afflictedDirections).not.toContain('West');
  });
});

/**
 * The Verdict Triad now drives the native state (rkpTriad.ts). All expected
 * values below were verified empirically against the real engine before
 * being hardcoded — same convention as the rest of this file.
 *
 * On this Aquarius wheel the Lagna lord is always Saturn, so a CAREER
 * question (house 10 = Scorpio, lord Mars) always carries the Saturn/Mars
 * natural enmity the material calls a "hard bureaucratic delay". A PROPERTY
 * question (house 4 = Taurus, lord Venus) is the clean counterpart:
 * Saturn and Venus are natural friends.
 */
describe('judgeRKPWatch — the Verdict Triad drives the native state', () => {
  test('YES_STRONG: friendly rulers, strong target lord, 11th clear, witnesses agree', () => {
    // Sun -> Cancer (h6) and Saturn -> Sagittarius (h11) lift the two aspects
    // that were obstructing Venus, leaving the 4th lord clean in its own sign.
    const chart = makeChart(
      { Sun: 105, Saturn: 260 },
      { Moon: { subLord: 'Jupiter', nakshatraLord: 'Mercury' } },
    );
    const verdict = judgeRKPWatch(chart, PROPERTY_Q, { timezoneOffsetMinutes: 0 });

    expect(verdict.triad.lagna.lord).toBe('Saturn');
    expect(verdict.triad.target.lord).toBe('Venus');
    expect(verdict.triad.fulfilment.lord).toBe('Jupiter');
    expect(verdict.triad.rulerRelation).toBe('friend');
    expect(verdict.triad.target.dignity).toBe('own');
    expect(verdict.triad.target.verdict).toBe('supported');
    expect(verdict.triad.fulfilmentPressure.heavilyAfflicted).toBe(false);
    expect(verdict.triad.outcome).toBe('positive');

    expect(verdict.moonConfirmation.agreement).toBe('agrees');
    expect(verdict.rulingConfirmation.favorableWitnesses.length).toBeGreaterThan(
      verdict.rulingConfirmation.denialWitnesses.length,
    );
    expect(verdict.nativeState).toBe('YES_STRONG');
    expect(verdict.verdict).toBe('YES');
    expect(verdict.timing).toBeDefined();
    // 50 base + 20 (unambiguous) + 15 (agrees) + 15 (2 favorable witnesses ->
    // overlap 2 scores 10) ... verified as 100 (clamped) against the engine.
    expect(verdict.confidence).toBe(100);
    expect(verdict.remedy?.planet).toBe('Venus');
  });

  test('DELAY: enemy rulers (Saturn vs Mars) delay an otherwise strong target lord', () => {
    // The material's signature case: "Enemy Relationship (e.g. Sun vs.
    // Saturn): hard bureaucratic delay, rigid rules, refusal to adjust."
    const chart = makeChart();
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });

    expect(verdict.triad.rulerRelation).toBe('enemy');
    expect(verdict.triad.target.verdict).toBe('supported'); // Mars is in its own sign
    expect(verdict.triad.outcome).toBe('delayed');
    expect(verdict.triad.outcomeReason).toContain('ruler clash');
    expect(verdict.nativeState).toBe('DELAY');
    expect(verdict.verdict).toBe('DELAYED');
    // A strong target lord that nonetheless clashes with the Lagna ruler is
    // a chart disagreeing with itself — the material's "conflicting aspects
    // downgrade confidence" rule costs 10 points here (65 -> 55).
    expect(verdict.confidenceFactors.triadConflict).toBe(-10);
    expect(verdict.confidenceFactors.conflictNotes).toEqual([
      'ruler clash despite a strong target lord',
    ]);
    expect(verdict.confidence).toBe(55);
    expect(verdict.narration.en).toContain('deferred');
  });

  test('DELAY: a retrograde target lord outranks the ruler clash as the reason', () => {
    const chart = makeChart({}, { Mars: { isRetrograde: true } });
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.houseLord.retrograde).toBe(true);
    expect(verdict.triad.outcome).toBe('delayed');
    expect(verdict.triad.outcomeReason).toContain('retrograde');
    expect(verdict.nativeState).toBe('DELAY');
  });

  test('DELAY, not denial: a weak (debilitated) target lord only defers the matter', () => {
    // Explicit regression guard on the material's own wording — "the target
    // house ruler is weak, retrograde, or under the aspect of Saturn. It
    // WILL happen, but only after strict corrections." Denial is reserved
    // for malefic affliction of the target or 11th house.
    const chart = makeChart({ Mars: 105 }); // Mars debilitated in Cancer
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.houseLord.dignity).toBe('debilitated');
    expect(verdict.houseLord.verdict).toBe('obstructed');
    expect(verdict.triad.outcome).toBe('delayed');
    expect(verdict.triad.outcomeReason).toContain('debilitated');
    expect(verdict.nativeState).toBe('DELAY');
    expect(verdict.verdict).toBe('DELAYED');
    expect(verdict.confidence).toBe(95);
    expect(verdict.timing).toBeDefined();
  });

  test('NO_DENIED: Rahu occupying the target house with no benefic on it', () => {
    // "If Rahu, Ketu, or Mars are sitting in or aspecting your 6th house on
    // the clock face, it indicates ... eventual rejection." Jupiter is moved
    // off house 11 so nothing rescues the matter.
    const chart = makeChart({ Rahu: 225, Jupiter: 15 });
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.triad.targetPressure.occupyingMalefics).toContain('Rahu');
    expect(verdict.triad.targetPressure.supportingBenefics).toEqual([]);
    expect(verdict.triad.targetPressure.afflicted).toBe(true);
    expect(verdict.triad.outcome).toBe('blocked');
    expect(verdict.nativeState).toBe('NO_DENIED');
    expect(verdict.verdict).toBe('NO');
    expect(verdict.confidence).toBe(55); // 65, less the ruler-clash conflict
    expect(verdict.timing).toBeUndefined();
  });

  test('a lord sitting in its own house never counts as afflicting it', () => {
    // Mars rules house 10 (Scorpio) and occupies it. Read literally the
    // affliction rule would deny every such chart; classically a lord in its
    // own domain is at its strongest.
    const chart = makeChart();
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.triad.target.lord).toBe('Mars');
    expect(verdict.triad.target.lordHouse).toBe(10);
    expect(verdict.triad.targetPressure.blockingMalefics).not.toContain('Mars');
  });

  test('a single distant malefic aspect is pressure, not heavy affliction', () => {
    // Mars in house 10 casts its 7th aspect onto house 4 (the property
    // house) and nothing else malefic touches it.
    const chart = makeChart();
    const verdict = judgeRKPWatch(chart, PROPERTY_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.triad.targetPressure.blockingMalefics).toEqual(['Mars']);
    expect(verdict.triad.targetPressure.occupyingMalefics).toEqual([]);
    expect(verdict.triad.targetPressure.heavilyAfflicted).toBe(false);
    expect(verdict.triad.outcome).not.toBe('blocked');
  });

  test('polarity profiles: odd Lagna sign = masculine querent, even target sign = feminine controller', () => {
    const chart = makeChart();
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.watch.lagnaSign).toBe(11); // Aquarius, odd
    expect(verdict.triad.querentPolarity).toBe('masculine');
    expect(verdict.triad.target.sign).toBe(8); // Scorpio, even
    expect(verdict.triad.controllerPolarity).toBe('feminine');
  });
});

describe('judgeRKPWatch — condition state (Siddhi/Stambhana/Gati/Vakra/Kshaya/Bija)', () => {
  test('runs alongside nativeState rather than replacing it', () => {
    const chart = makeChart();
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    // The seeker is told DELAY; the mechanism underneath is Gati (in motion).
    expect(verdict.nativeState).toBe('DELAY');
    expect(verdict.conditionState).toBe('Gati');
  });

  test('Kshaya when an eclipse point occupies the house of the matter', () => {
    const chart = makeChart({ Rahu: 225, Jupiter: 15 });
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.conditionState).toBe('Kshaya');
  });

  test('Vakra when a triad ruler is retrograde', () => {
    const chart = makeChart({}, { Mars: { isRetrograde: true } });
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.conditionState).toBe('Vakra');
  });

  test('the reasoning trace records the condition and its cause', () => {
    const chart = makeChart();
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    const condStep = verdict.reasoning.find(r => r.ruleId === 'WATCH_CONDITION');
    expect(condStep).toBeDefined();
    expect(condStep?.description).toContain('Gati');
  });
});

describe('judgeRKPWatch — RKP material remedies', () => {
  test('emits corner direction, planet-keyed objects, and the action window', () => {
    const chart = makeChart();
    const verdict = judgeRKPWatch(chart, PROPERTY_Q, { timezoneOffsetMinutes: 0 });
    const { clock, clearance, window } = verdict.materialRemedy;

    // House 4 is Taurus -> earth -> South, and Mars is the planet bearing on it.
    expect(clearance.direction).toBe('South');
    expect(clearance.afflictingPlanets).toEqual(['Mars']);
    expect(clearance.objects).toEqual(['faulty wiring', 'broken glass']);

    // Lagna is Aquarius -> Saturn -> Saturday.
    expect(window.actionPlanet).toBe('Saturn');
    expect(window.weekday).toBe('Saturday');
    expect(window.fulfilmentPlanet).toBe('Jupiter');

    // Local minute 51 -> 4 minutes remain in the Aquarius segment, so the
    // material's 2-3 minute advance does NOT cross into the next one.
    expect(clock.advanceMinutesMin).toBe(2);
    expect(clock.advanceMinutesMax).toBe(3);
    expect(clock.minutesToNextBucket).toBe(4);
    expect(clock.crossesIntoNextSegment).toBe(false);
  });

  test('falls back to the general clearance list when no keyed malefic bears on the house', () => {
    const chart = makeChart();
    const verdict = judgeRKPWatch(chart, CAREER_Q, { timezoneOffsetMinutes: 0 });
    expect(verdict.materialRemedy.clearance.afflictingPlanets).toEqual([]);
    expect(verdict.materialRemedy.clearance.objects).toContain('dust');
    expect(verdict.materialRemedy.clearance.objects).toContain('stopped electronics');
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
