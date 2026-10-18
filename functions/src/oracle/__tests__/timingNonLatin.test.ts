/**
 * The timing check must read day counts written in Urdu and Hindi.
 *
 * Follow-ups are written in the seeker's language (discussionComposer's
 * REPLY LANGUAGE) and pass through the same validateNarration(). Before
 * this, extractDayCounts() matched only ASCII digits followed by "day", so
 * "۴۵ دن" (Urdu) or "४५ दिन" (Hindi) was never compared with the settled
 * window and an out-of-window timing claim passed silently.
 */

import { describe, it, expect } from 'vitest';

import { buildWatchChart } from '../../engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';
import { diagnose } from '../../engine/rkp/diagnosis';
import { classifyQuestion } from '../../engine/kp/rules/questionKeywords';
import { selectRemedyProtocol } from '../remedySelection';
import { toBoundaryPlanetName } from '../../utils/planetBoundaryName';
import { buildReadingContract, type ReadingContract } from '../readingContract';
import { checkTimingConsistency, validateNarration } from '../narrationValidator';

function contractFor(moment: string, question: string): ReadingContract {
  const chart = buildWatchChart(moment);
  const rawVerdict = judgeWatchChart(chart, classifyQuestion(question));
  const verdict: DisplayWatchVerdict = {
    ...rawVerdict,
    obstruction: toBoundaryPlanetName(rawVerdict.obstruction),
    targetRuler: toBoundaryPlanetName(rawVerdict.targetRuler),
    lagnaRuler: toBoundaryPlanetName(rawVerdict.lagnaRuler),
  };
  const diagnosis = diagnose(verdict);
  return buildReadingContract({
    readingId: 'r-timing-non-latin',
    computedAt: new Date('2026-08-15T00:00:00.000Z'),
    question,
    verdict,
    diagnosis,
    protocol: selectRemedyProtocol(diagnosis),
  });
}

const contract = contractFor('2026-08-15T11:00:00+04:00', 'Will I get the job I interviewed for?');
const timing = contract.diagnosis.timing;

/** Writes a number in the given digit set (0-9 code points starting at `zero`). */
function digits(n: number, zero: number): string {
  return String(n).replace(/\d/g, d => String.fromCodePoint(zero + Number(d)));
}
const URDU_ZERO = 0x06f0; // Extended Arabic-Indic ۰
const ARABIC_ZERO = 0x0660; // Arabic-Indic ٠
const DEVANAGARI_ZERO = 0x0966; // Devanagari ०

describe('timing check reads Urdu and Hindi day counts', () => {
  it('the fixture has a settled timing window', () => {
    expect(timing).not.toBeNull();
  });

  const outside = (timing?.maxDays ?? 0) + 100;
  const inside = timing?.minDays ?? 0;

  const outOfWindow: Array<[string, string]> = [
    ['Urdu digits + دن', `یہ معاملہ ${digits(outside, URDU_ZERO)} دن میں طے ہوگا۔`],
    ['Arabic-Indic digits + دن', `یہ معاملہ ${digits(outside, ARABIC_ZERO)} دن میں طے ہوگا۔`],
    ['ASCII digits + دن', `یہ معاملہ ${outside} دن میں طے ہوگا۔`],
    ['Urdu digits + روز', `یہ معاملہ ${digits(outside, URDU_ZERO)} روز میں طے ہوگا۔`],
    ['Devanagari digits + दिन', `यह मामला ${digits(outside, DEVANAGARI_ZERO)} दिन में तय होगा।`],
    ['ASCII digits + दिन', `यह मामला ${outside} दिनों में तय होगा।`],
  ];

  for (const [label, text] of outOfWindow) {
    it(`flags an out-of-window count: ${label}`, () => {
      const failure = checkTimingConsistency(contract, 'interpretation', text);
      expect(failure?.code).toBe('TIMING_ALTERATION');
    });
  }

  it('accepts an in-window count in Urdu digits', () => {
    const text = `یہ معاملہ ${digits(inside, URDU_ZERO)} دن میں طے ہو سکتا ہے۔`;
    expect(checkTimingConsistency(contract, 'interpretation', text)).toBeNull();
  });

  it('accepts an in-window count in Devanagari digits', () => {
    const text = `यह मामला ${digits(inside, DEVANAGARI_ZERO)} दिन में तय हो सकता है।`;
    expect(checkTimingConsistency(contract, 'interpretation', text)).toBeNull();
  });

  it('counts plural forms ("دنوں", "दिनों")', () => {
    expect(checkTimingConsistency(contract, 'interpretation', `${outside} دنوں میں`)?.code).toBe(
      'TIMING_ALTERATION',
    );
    expect(checkTimingConsistency(contract, 'interpretation', `${outside} दिनों में`)?.code).toBe(
      'TIMING_ALTERATION',
    );
  });

  it('does not read longer words that start with a day word as day counts', () => {
    // روزگار = employment, دنیا = world: "2 job opportunities", "in 2 worlds".
    expect(
      checkTimingConsistency(contract, 'interpretation', `${outside} روزگار کے مواقع ہیں۔`),
    ).toBeNull();
    expect(checkTimingConsistency(contract, 'interpretation', `${outside} دنیاؤں میں`)).toBeNull();
  });

  it('still ignores day words with no number ("ہر روز", "हर दिन")', () => {
    expect(checkTimingConsistency(contract, 'interpretation', 'ہر روز صبر کریں۔')).toBeNull();
    expect(checkTimingConsistency(contract, 'interpretation', 'हर दिन धैर्य रखें।')).toBeNull();
  });

  it('end to end: validateNarration rejects an out-of-window Urdu follow-up', () => {
    const fields = {
      rkp_finding: 'یہ معاملہ آہستہ آگے بڑھ رہا ہے۔',
      interpretation: 'تاخیر انکار نہیں ہے۔',
      recommended_approach: 'صبر سے کام لیں۔',
      why_this_remedy: null,
      signature: 'اللہ آسانی فرمائے۔',
    };
    // Control: the same reply without a day count passes.
    expect(validateNarration(contract, fields).valid).toBe(true);

    const result = validateNarration(contract, {
      ...fields,
      interpretation: `یہ معاملہ ${digits(outside, URDU_ZERO)} دن میں طے ہوگا۔`,
    });
    expect(result.valid).toBe(false);
    expect(result.valid ? [] : result.failures.map(f => f.code)).toContain('TIMING_ALTERATION');
  });
});
