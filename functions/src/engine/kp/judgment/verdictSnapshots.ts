/**
 * verdictSnapshots — shared builders for Verdict sub-objects and ids.
 * --------------------------------------------------------------------------
 * Used by BOTH judgment engines (RKP: judgeHorary.ts, classical KP:
 * judgeKP.ts) so verdicts for the same (chart, question) pair share
 * identical field shapes but get distinct, deterministic ids per engine.
 *
 * `deterministicId`'s `engineTag` is OPTIONAL and, when omitted, reproduces
 * the exact seed RKP has always used — existing RKP ids are unaffected by
 * this extraction. Only judgeKP.ts passes a tag ('KP'), giving it a
 * distinct id space so the two engines' verdicts for one reading never
 * collide.
 */

import type { Chart, Planet, HouseIndex } from '../../types/chart';
import type { ClassifiedQuestion } from '../../types/question';
import type { MoonSubLordSnapshot, QuestionCuspDetail } from '../../types/verdict';

// ── Deterministic ID (no Math.random — determinism spec) ──────────────────────

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    // eslint-disable-next-line no-bitwise
    h ^= s.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function deterministicId(
  chart: Chart,
  question: ClassifiedQuestion,
  engineTag?: string,
): string {
  const base = `${chart.momentUtc}|${chart.location.latitude}|${chart.location.longitude}|${question.text}|${question.qType}`;
  const seed = engineTag === undefined ? base : `${base}|${engineTag}`;
  const a = fnv1a(seed);
  const b = fnv1a(seed + 'b');
  const c = fnv1a(seed + 'c');
  const d = fnv1a(seed + 'd');
  return `${a}-${b.slice(0, 4)}-4${b.slice(5, 8)}-${c.slice(0, 4)}-${c.slice(4)}${d.slice(0, 8)}`;
}

// ── QuestionCuspDetail ─────────────────────────────────────────────────────────

export function buildQuestionCuspDetail(
  primaryHouseIdx: HouseIndex,
  chart: Chart,
): QuestionCuspDetail {
  const cusp = chart.cusps[primaryHouseIdx - 1];
  if (cusp === undefined) {
    throw new RangeError(`[verdictSnapshots] cusp[${primaryHouseIdx - 1}] undefined`);
  }
  return {
    house: cusp.house,
    sign: cusp.sign,
    degreeInSign: cusp.degreeInSign,
    nakshatra: cusp.nakshatra,
    nakshatraLord: cusp.nakshatraLord,
    subLord: cusp.subLord,
    subSubLord: cusp.subSubLord,
    pada: 1,
  };
}

// ── MoonSubLordSnapshot ─────────────────────────────────────────────────────────

export function buildMoonSubLordSnapshot(
  moonSubLord: Planet,
  moonSubLordHouse: HouseIndex,
  favHits: readonly HouseIndex[],
  denHits: readonly HouseIndex[],
  chart: Chart,
): MoonSubLordSnapshot {
  const planetData = chart.planets[moonSubLord];
  return {
    planet: moonSubLord,
    nakshatraLord: planetData.nakshatraLord,
    subLord: planetData.subLord,
    subSubLord: planetData.subSubLord, // Precision Layer
    occupiedHouse: moonSubLordHouse,
    signifiedHouses: [moonSubLordHouse],
    favHits,
    denHits,
  };
}
