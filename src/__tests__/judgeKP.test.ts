/**
 * judgeKP — unit tests for the classical KP verdict engine.
 *
 * Deliberately self-contained (does not share fixtures with
 * judgeHorary.test.ts) so the two suites can never accidentally couple KP's
 * behaviour to RKP's. See judgeKP.ts module docstring for the algorithm.
 *
 * Fixture design: same convention as judgeHorary.test.ts —
 *   cusps evenly spaced at 30° intervals so house membership is trivial:
 *     house N contains longitudes [(N-1)*30, N*30)
 *   houseToLon(N) = (N-1)*30 + 15 places a planet at house N's centre.
 *
 * career house matrix: favorable=[6,10,11], denial=[5,8,12], primary=10.
 * Career house (sign) lords: 6→Mercury, 10→Saturn, 11→Saturn, 5→Sun,
 * 8→Mars, 12→Jupiter (SIGN_LORDS cycle, see rulingPlanets.ts).
 *
 * All 9 planets are parked in NEUTRAL houses (1,2,3,4,7,9 — never 5,6,8,
 * 10,11,12) so the significator sets come purely from house LORDSHIP, not
 * occupancy. That keeps favorable significators = {Mercury, Saturn} and
 * denial significators = {Sun, Mars, Jupiter} exactly, with no accidental
 * neutral-cancellation or Kotamraju-filter surprises — verified empirically
 * against the real sub-lord engine before being hardcoded here.
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

const MOMENT = '2025-04-27T10:00:00Z';
const houseToLon = (h: number) => (h - 1) * 30 + 15;

function cusp(house: number, lon: number, subLord: Planet = 'Mars'): HouseCusp {
  return {
    house: house as HouseIndex,
    siderealLongitude: lon,
    sign: (Math.floor(lon / 30) + 1) as HouseCusp['sign'],
    degreeInSign: lon % 30,
    nakshatra: 1,
    nakshatraLord: 'Ketu',
    subLord,
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

/** Every planet parked in a neutral house — see module docstring. */
const NEUTRAL_HOUSES: Record<Planet, number> = {
  Sun: 1,
  Moon: 2,
  Mars: 3,
  Mercury: 4,
  Jupiter: 7,
  Venus: 9,
  Saturn: 2,
  Rahu: 4,
  Ketu: 7,
};

interface ChartSpec {
  retrogrades?: Partial<Record<Planet, boolean>>;
  /** Sub-lord override for the primary (10th) cusp — decides the promise check. */
  primaryCuspSubLord?: Planet;
  /** [dayLord, horaLord, ascSignLord, ascStarLord, moonSignLord, moonStarLord] */
  rulingPlanets?: [Planet, Planet, Planet, Planet, Planet, Planet];
}

function makeChart(spec: ChartSpec): Chart {
  const {
    retrogrades = {},
    primaryCuspSubLord = 'Mars',
    rulingPlanets = ['Sun', 'Saturn', 'Mercury', 'Jupiter', 'Moon', 'Venus'],
  } = spec;

  const planets = Object.fromEntries(
    (Object.keys(NEUTRAL_HOUSES) as Planet[]).map(p => [
      p,
      planet(p, houseToLon(NEUTRAL_HOUSES[p]), { isRetrograde: retrogrades[p] ?? false }),
    ]),
  ) as Record<Planet, PlanetPosition>;

  const cusps = Array.from({ length: 12 }, (_, i) => {
    const house = i + 1;
    return cusp(house, i * 30, house === 10 ? primaryCuspSubLord : 'Mars');
  }) as Chart['cusps'];

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

describe('judgeKP — promise layer', () => {
  test('DENIED: primary cusp sub-lord is not a favorable significator', () => {
    // 'Mars' is a DENIAL significator here (house 8's lord) — the promise
    // layer stops before fructification ever runs.
    const chart = makeChart({ primaryCuspSubLord: 'Mars' });
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.verdict).toBe('DENIED');
    expect(verdict.stage).toBe('promise_failed');
    expect(verdict.promise.promised).toBe(false);
    expect(verdict.strength).toBe('none');
    expect(verdict.timing).toBeUndefined();
  });

  test('KP and RKP are independent: KP denies outright where RKP still scores a verdict', () => {
    // Same chart, same question, two different algorithms. judgeKP() has a
    // hard promise-layer stop that judgeHorary() does not — RKP has no
    // promise/fructification separation at all, so it proceeds straight to
    // scoring and lands on a verdict of its own regardless of KP's promise
    // check. This is the whole point of keeping the two engines separate.
    const chart = makeChart({
      primaryCuspSubLord: 'Mars',
      rulingPlanets: ['Mercury', 'Saturn', 'Mercury', 'Saturn', 'Moon', 'Venus'],
    });
    const kp = judgeKP(chart, CAREER_Q);
    const rkp = judgeHorary(chart, CAREER_Q);
    expect(kp.verdict).toBe('DENIED');
    expect(kp.stage).toBe('promise_failed');
    expect(rkp.stage).toBe('fructification');
    expect(rkp.verdict).not.toBe('DENIED');
  });
});

describe('judgeKP — fructification', () => {
  test('YES: promise holds and confirmed significators outnumber denied ones', () => {
    const chart = makeChart({
      primaryCuspSubLord: 'Saturn', // favorable significator → promise holds
      rulingPlanets: ['Mercury', 'Saturn', 'Mercury', 'Saturn', 'Moon', 'Venus'],
    });
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.promise.promised).toBe(true);
    expect(verdict.verdict).toBe('YES');
    expect(verdict.confirmedSignificators).toEqual(expect.arrayContaining(['Mercury', 'Saturn']));
    expect(verdict.deniedSignificators).toHaveLength(0);
  });

  test('NO: promise holds but denied significators outnumber confirmed ones', () => {
    const chart = makeChart({
      primaryCuspSubLord: 'Saturn',
      rulingPlanets: ['Sun', 'Saturn', 'Mars', 'Jupiter', 'Moon', 'Venus'],
    });
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.promise.promised).toBe(true);
    expect(verdict.verdict).toBe('NO');
    expect(verdict.confirmedSignificators).toHaveLength(0);
    expect(verdict.deniedSignificators).toEqual(expect.arrayContaining(['Sun', 'Mars', 'Jupiter']));
  });

  test('CONDITIONAL: confirmed and denied significators tie', () => {
    const chart = makeChart({
      primaryCuspSubLord: 'Saturn',
      rulingPlanets: ['Sun', 'Saturn', 'Mercury', 'Moon', 'Venus', 'Rahu'],
    });
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.promise.promised).toBe(true);
    expect(verdict.verdict).toBe('CONDITIONAL');
    expect(verdict.confirmedSignificators).toEqual(['Mercury']);
    expect(verdict.deniedSignificators).toEqual(['Sun']);
  });

  test('DELAYED: YES demoted because Jupiter is retrograde', () => {
    const chart = makeChart({
      primaryCuspSubLord: 'Saturn',
      rulingPlanets: ['Mercury', 'Saturn', 'Mercury', 'Saturn', 'Moon', 'Venus'],
      retrogrades: { Jupiter: true },
    });
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.verdict).toBe('DELAYED');
  });
});

describe('judgeKP — output shape', () => {
  test('has no numeric confidence, no remedy, no narration (RKP-only fields)', () => {
    const chart = makeChart({ primaryCuspSubLord: 'Saturn' });
    const verdict = judgeKP(chart, CAREER_Q) as unknown as Record<string, unknown>;
    expect(verdict.confidence).toBeUndefined();
    expect(verdict.remedy).toBeUndefined();
    expect(verdict.narration).toBeUndefined();
    expect(verdict.horaryNumber).toBeUndefined();
  });

  test('id is a deterministic hash', () => {
    const chart = makeChart({ primaryCuspSubLord: 'Saturn' });
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.id).toMatch(/^[0-9a-f]{8}-/);
  });

  test('reasoning trace is non-empty and ruleIds are KP-namespaced', () => {
    const chart = makeChart({ primaryCuspSubLord: 'Saturn' });
    const verdict = judgeKP(chart, CAREER_Q);
    expect(verdict.reasoning.length).toBeGreaterThan(0);
    expect(verdict.reasoning.every(r => r.ruleId.startsWith('KP_'))).toBe(true);
  });
});

describe('judgeKP — determinism', () => {
  test('same chart + question always produces the same verdict', () => {
    const chart = makeChart({ primaryCuspSubLord: 'Saturn' });
    const a = judgeKP(chart, CAREER_Q);
    const b = judgeKP(chart, CAREER_Q);
    expect(a.id).toBe(b.id);
    expect(a.verdict).toBe(b.verdict);
    expect(a.reasoning).toEqual(b.reasoning);
  });

  test('KP id namespace never collides with an RKP id for the same chart', () => {
    const chart = makeChart({ primaryCuspSubLord: 'Saturn' });
    const kp = judgeKP(chart, CAREER_Q);
    const rkp = judgeHorary(chart, CAREER_Q);
    expect(kp.id).not.toBe(rkp.id);
  });
});
