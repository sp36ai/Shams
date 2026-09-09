/**
 * Adversarial narration corpus — Phase 4, brief §20.
 * --------------------------------------------------------------------------
 * Fixtures live at __tests__/fixtures/adversarial-narration/*.json — this
 * repository's actual test-colocation convention (no functions/test/
 * directory exists anywhere else in the codebase; every other suite lives
 * in __tests__ next to its subject, so the fixtures follow that pattern
 * rather than introducing a new one).
 *
 * Each fixture is a deterministic, hand-authored adversarial narration —
 * no real user data — paired with the exact ValidationFailureCode(s) it
 * must trigger. Two real, engine-produced contracts back every fixture
 * (PRIMARY: a genuine BLOCKED/UNFAVOURABLE/WAIT reading; SECONDARY: a
 * genuine UNCERTAIN/low-confidence reading, needed only for the
 * certainty-inflation case, whose check requires low confidence or a
 * neutral-polarity outcome — PRIMARY's own confidence is too high to
 * exercise it). Their exact field values were inspected once, by hand,
 * to write correct fixtures — not re-derived at test time — so this suite
 * also pins those two contracts' shape as a regression check in its own
 * right.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import { buildWatchChart } from '../../engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';
import { diagnose } from '../../engine/rkp/diagnosis';
import { classifyQuestion } from '../../engine/kp/rules/questionKeywords';
import { selectRemedyProtocol } from '../remedySelection';
import { toBoundaryPlanetName } from '../../utils/planetBoundaryName';
import { buildReadingContract, type ReadingContract } from '../readingContract';
import { validateNarration, type ValidationFailureCode } from '../narrationValidator';
import type { NarrationFields } from '../responseComposer';

function contractFor(moment: string, question: string, readingId: string): ReadingContract {
  const chart = buildWatchChart(moment);
  const qType = classifyQuestion(question);
  const rawVerdict = judgeWatchChart(chart, qType);
  const verdict: DisplayWatchVerdict = {
    ...rawVerdict,
    obstruction: toBoundaryPlanetName(rawVerdict.obstruction),
    targetRuler: toBoundaryPlanetName(rawVerdict.targetRuler),
    lagnaRuler: toBoundaryPlanetName(rawVerdict.lagnaRuler),
  };
  const diagnosis = diagnose(verdict);
  const protocol = selectRemedyProtocol(diagnosis);
  return buildReadingContract({
    readingId,
    computedAt: new Date('2026-08-15T00:00:00.000Z'),
    question,
    verdict,
    diagnosis,
    protocol,
  });
}

// Inspected once by hand (see file header): UNFAVOURABLE, WAIT, timing
// {45,90}, obstructingAgent 'Dhanab', confidence 0.95, celestialEntities
// ['Mirrikh','Venus','Dhanab'].
const PRIMARY = contractFor(
  '2026-08-15T11:30:00+05:00',
  'Will my new business succeed?',
  'r-adversarial-primary',
);
// Inspected once by hand: UNCERTAIN, confidence 0.2.
const SECONDARY = contractFor(
  '2026-08-15T05:00:00+05:30',
  'Will I pass my upcoming exam?',
  'r-adversarial-secondary',
);

describe('adversarial fixture preconditions (pins the two contracts this suite depends on)', () => {
  it('PRIMARY is a negative-polarity, high-confidence, WAIT reading', () => {
    expect(PRIMARY.diagnosis.outcome).toBe('UNFAVOURABLE');
    expect(PRIMARY.diagnosis.timingPosture).toBe('WAIT');
    expect(PRIMARY.diagnosis.confidence).toBeGreaterThanOrEqual(0.8);
    expect(PRIMARY.celestialEntities).not.toContain('Mushtari');
    expect(PRIMARY.celestialEntities).not.toContain('Jupiter');
  });

  it('SECONDARY is a neutral-polarity, low-confidence reading', () => {
    expect(SECONDARY.diagnosis.outcome).toBe('UNCERTAIN');
    expect(SECONDARY.diagnosis.confidence).toBeLessThan(0.8);
  });
});

interface AdversarialFixture {
  readonly id: string;
  readonly description: string;
  readonly expectedCodes: readonly ValidationFailureCode[];
  readonly contract?: 'primary' | 'secondary';
  readonly narration: NarrationFields;
}

const FIXTURES_DIR = join(__dirname, 'fixtures', 'adversarial-narration');
const fixtureFiles = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json'));

describe('adversarial narration corpus', () => {
  it('has at least the ten required categories', () => {
    expect(fixtureFiles.length).toBeGreaterThanOrEqual(10);
  });

  for (const file of fixtureFiles) {
    const fixture = JSON.parse(
      readFileSync(join(FIXTURES_DIR, file), 'utf8'),
    ) as AdversarialFixture;

    it(`${fixture.id}: ${fixture.description}`, () => {
      const contract = fixture.contract === 'secondary' ? SECONDARY : PRIMARY;
      const result = validateNarration(contract, fixture.narration);

      expect(result.valid).toBe(false);
      if (result.valid) {
        return;
      }
      const codes = result.failures.map(f => f.code);
      const matched = fixture.expectedCodes.some(expected => codes.includes(expected));
      expect(
        matched,
        `expected one of [${fixture.expectedCodes.join(', ')}], got [${codes.join(', ')}]`,
      ).toBe(true);
    });
  }
});
