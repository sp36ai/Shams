/**
 * Golden-vector regression test for the deterministic judgment pipeline.
 *
 * Runs the FULL server pipeline — buildChart (pure-JS Moshier ephemeris) →
 * classifyQuestion → judgeHorary — on fixed (moment, lat, lon, question)
 * inputs and asserts the exact output. Because the ephemeris takes an explicit
 * ISO timestamp (no Date.now), every field is deterministic.
 *
 * Purpose: lock the engine's behavior end-to-end so ANY change to the
 * ephemeris, sub-lord chain, ruling-planet witness set, scoring, or timing
 * shifts these values and fails CI. In particular this guards the rule that
 * the horaLord (rulingPlanets index 1) is a display-only witness and is
 * EXCLUDED from the scoring set — reverting that would change the confirmed/
 * denied significators and confidence of these vectors.
 *
 * If a change to these values is intentional, regenerate them deliberately
 * (do not blindly "update" — treat a diff here as a red flag to review).
 */

import { describe, it, expect } from 'vitest';
import { buildChart } from '../../engine/primitives/chartBuilder';
import { judgeHorary } from '../../engine/kp/judgment/judgeHorary';
import { classifyQuestion } from '../../engine/kp/rules/questionKeywords';

interface GoldenCase {
  iso: string;
  lat: number;
  lon: number;
  q: string;
  expect: {
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
    expect: {
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
    expect: {
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
    expect: {
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
    expect: {
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
  const classified = {
    text: c.q,
    lang: 'en' as const,
    qType: classifyQuestion(c.q),
    confidence: 1.0,
    matchedKeywords: [] as string[],
  };
  return judgeHorary(chart, classified);
}

describe('golden vectors — deterministic judgment pipeline', () => {
  it.each(GOLDEN)('$q @ ($lat,$lon) $iso', c => {
    const v = run(c);
    const e = c.expect;

    expect(v.id).toBe(e.id);
    expect(v.verdict).toBe(e.verdict);
    expect(v.confidence).toBe(e.confidence);
    expect(v.qType).toBe(e.qType);

    // Ruling planets — includes horaLord as a display field; the scoring set
    // (which drives confirmed/denied/confidence below) excludes it.
    expect(v.rulingPlanets.dayLord).toBe(e.rulingPlanets.dayLord);
    expect(v.rulingPlanets.horaLord).toBe(e.rulingPlanets.horaLord);
    expect(v.rulingPlanets.ascSignLord).toBe(e.rulingPlanets.ascSignLord);
    expect(v.rulingPlanets.ascStarLord).toBe(e.rulingPlanets.ascStarLord);
    expect(v.rulingPlanets.moonSignLord).toBe(e.rulingPlanets.moonSignLord);
    expect(v.rulingPlanets.moonStarLord).toBe(e.rulingPlanets.moonStarLord);

    // Witness intersection — horaLord must NEVER appear here even when it is a
    // ruling planet, because it is excluded from the scoring set.
    expect(v.confirmedSignificators ?? []).toEqual(e.confirmed);
    expect(v.deniedSignificators ?? []).toEqual(e.denied);
    expect(v.confirmedSignificators ?? []).not.toContain(v.rulingPlanets.horaLord);
    expect(v.deniedSignificators ?? []).not.toContain(v.rulingPlanets.horaLord);

    expect(v.timing?.window).toBe(e.timing.window);
    expect(v.timing?.range).toEqual(e.timing.range);
  });

  it('is stable across repeated runs (same id + verdict)', () => {
    const a = run(GOLDEN[0]!);
    const b = run(GOLDEN[0]!);
    expect(a.id).toBe(b.id);
    expect(a.verdict).toBe(b.verdict);
    expect(a.confidence).toBe(b.confidence);
  });
});
