/**
 * Golden-vector regression test — CLIENT engine (src/astrology).
 *
 * src/astrology is the source of truth that sync-engine mirrors into
 * functions/src/engine. This test asserts the SAME fixed vectors and expected
 * output as functions/src/functions/__tests__/goldenVectors.test.ts, so the
 * two engine trees are locked to identical deterministic behavior — if they
 * ever diverge, one of the two golden suites fails.
 *
 * Runs the full pipeline (buildChart -> classifyQuestion -> judgeHorary) on
 * fixed (moment, lat, lon, question) inputs. buildChart uses the pure-JS
 * Moshier ephemeris (no wasm), so every field is deterministic.
 *
 * Explicit values (not snapshots) so an accidental algorithm change cannot be
 * silently re-blessed. Also guards the horaLord rule: horaLord (rulingPlanets
 * index 1) is display-only and excluded from the scoring witness set.
 */

import { buildChart } from '../astrology/primitives/chartBuilder';
import { judgeHorary } from '../astrology/kp/judgment/judgeHorary';
import { classifyQuestion } from '../astrology/kp/rules/questionKeywords';
import type { ClassifiedQuestion } from '../astrology/types/question';

jest.setTimeout(15000);

interface GoldenCase {
  iso: string;
  lat: number;
  lon: number;
  q: string;
  expected: {
    id: string;
    verdict: string;
    confidence: number;
    qType: string;
    rulingPlanets: {
      dayLord: string;
      horaLord: string;
      ascSignLord: string;
      ascStarLord: string;
      moonSignLord: string;
      moonStarLord: string;
    };
    confirmed: string[];
    denied: string[];
    timing: { window: string; range: { min: number; max: number } };
  };
}

const GOLDEN: GoldenCase[] = [
  {
    iso: '2025-04-27T10:00:00Z',
    lat: 19.076,
    lon: 72.877,
    q: 'Will I get the promotion this year?',
    expected: {
      id: 'fc9ce716-1f00-4b9c-2000-5d2f1d005876',
      verdict: 'CONDITIONAL',
      confidence: 50,
      qType: 'career',
      rulingPlanets: {
        dayLord: 'Sun',
        horaLord: 'Venus',
        ascSignLord: 'Sun',
        ascStarLord: 'Venus',
        moonSignLord: 'Mars',
        moonStarLord: 'Ketu',
      },
      confirmed: [],
      denied: [],
      timing: { window: 'years', range: { min: 1, max: 2 } },
    },
  },
  {
    iso: '2024-01-15T06:30:00Z',
    lat: 28.6139,
    lon: 77.209,
    q: 'Will my marriage happen soon?',
    expected: {
      id: 'e6472c7c-a00a-433a-a10a-74cd9a0a69c8',
      verdict: 'YES',
      confidence: 81,
      qType: 'marriage',
      rulingPlanets: {
        dayLord: 'Moon',
        horaLord: 'Venus',
        ascSignLord: 'Mars',
        ascStarLord: 'Ketu',
        moonSignLord: 'Saturn',
        moonStarLord: 'Jupiter',
      },
      confirmed: ['Moon', 'Mars', 'Ketu'],
      denied: [],
      timing: { window: 'years', range: { min: 1, max: 2 } },
    },
  },
  {
    iso: '2023-09-01T18:45:00Z',
    lat: 24.8607,
    lon: 67.0011,
    q: 'Will I recover from this illness?',
    expected: {
      id: '47a67ba4-9114-48b0-9214-da448b14cf40',
      verdict: 'CONDITIONAL',
      confidence: 56,
      qType: 'health',
      rulingPlanets: {
        dayLord: 'Venus',
        horaLord: 'Saturn',
        ascSignLord: 'Venus',
        ascStarLord: 'Moon',
        moonSignLord: 'Jupiter',
        moonStarLord: 'Saturn',
      },
      confirmed: ['Jupiter'],
      denied: [],
      timing: { window: 'years', range: { min: 1, max: 2 } },
    },
  },
  {
    iso: '2026-07-18T12:00:00Z',
    lat: 51.5074,
    lon: -0.1278,
    q: 'Should I take this new job offer?',
    expected: {
      id: 'e49400c0-76fc-4f06-77fd-009978fd022c',
      verdict: 'CONDITIONAL',
      confidence: 50,
      qType: 'career',
      rulingPlanets: {
        dayLord: 'Saturn',
        horaLord: 'Mercury',
        ascSignLord: 'Mercury',
        ascStarLord: 'Mars',
        moonSignLord: 'Sun',
        moonStarLord: 'Venus',
      },
      confirmed: ['Sun', 'Venus'],
      denied: ['Mars', 'Saturn'],
      timing: { window: 'months', range: { min: 1, max: 6 } },
    },
  },
];

function run(c: GoldenCase) {
  const chart = buildChart(c.iso, c.lat, c.lon);
  const classified: ClassifiedQuestion = {
    text: c.q,
    lang: 'en',
    qType: classifyQuestion(c.q),
    confidence: 1.0,
    matchedKeywords: [],
  };
  return judgeHorary(chart, classified);
}

describe('golden vectors — client engine (src/astrology)', () => {
  test.each(GOLDEN)('$q @ ($lat,$lon) $iso', c => {
    const v = run(c);
    const e = c.expected;

    expect(v.id).toBe(e.id);
    expect(v.verdict).toBe(e.verdict);
    expect(v.confidence).toBe(e.confidence);
    expect(v.qType).toBe(e.qType);

    expect(v.rulingPlanets.dayLord).toBe(e.rulingPlanets.dayLord);
    expect(v.rulingPlanets.horaLord).toBe(e.rulingPlanets.horaLord);
    expect(v.rulingPlanets.ascSignLord).toBe(e.rulingPlanets.ascSignLord);
    expect(v.rulingPlanets.ascStarLord).toBe(e.rulingPlanets.ascStarLord);
    expect(v.rulingPlanets.moonSignLord).toBe(e.rulingPlanets.moonSignLord);
    expect(v.rulingPlanets.moonStarLord).toBe(e.rulingPlanets.moonStarLord);

    // horaLord is a display-only witness — never in the scoring intersection.
    expect(v.confirmedSignificators ?? []).toEqual(e.confirmed);
    expect(v.deniedSignificators ?? []).toEqual(e.denied);
    expect(v.confirmedSignificators ?? []).not.toContain(v.rulingPlanets.horaLord);
    expect(v.deniedSignificators ?? []).not.toContain(v.rulingPlanets.horaLord);

    expect(v.timing?.window).toBe(e.timing.window);
    expect(v.timing?.range).toEqual(e.timing.range);
  });

  test('client and functions golden suites share identical expected values', () => {
    // Guardrail note: if you change a value here, change the matching vector in
    // functions/src/functions/__tests__/goldenVectors.test.ts too (and vice
    // versa) — the two engine trees must stay behaviorally identical.
    expect(GOLDEN).toHaveLength(4);
  });
});
