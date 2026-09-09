/**
 * readingContract.ts / narrationContext.ts — Phase 3 contract tests.
 *
 * Uses the real deterministic engine (diagnose/selectRemedyProtocol/
 * buildWatchChart/judgeWatchChart) to build fixtures, rather than
 * hand-fabricated diagnosis/protocol objects — the point of this contract
 * is to carry real engine truth faithfully, so its tests should exercise
 * real engine output, not an invented shape that happens to typecheck.
 */

import { describe, it, expect } from 'vitest';

import { buildWatchChart } from '../../engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';
import { diagnose } from '../../engine/rkp/diagnosis';
import { classifyQuestion } from '../../engine/kp/rules/questionKeywords';
import { selectRemedyProtocol } from '../remedySelection';
import { toBoundaryPlanetName } from '../../utils/planetBoundaryName';
import {
  buildReadingContract,
  canonicalStringify,
  computeContractFingerprint,
  deepFreeze,
  READING_CONTRACT_VERSION,
} from '../readingContract';
import { toNarrationContext } from '../narrationContext';

function realVerdict(moment: string, question: string): DisplayWatchVerdict {
  const chart = buildWatchChart(moment);
  const qType = classifyQuestion(question);
  const verdict = judgeWatchChart(chart, qType);
  return {
    ...verdict,
    obstruction: toBoundaryPlanetName(verdict.obstruction),
    targetRuler: toBoundaryPlanetName(verdict.targetRuler),
    lagnaRuler: toBoundaryPlanetName(verdict.lagnaRuler),
  };
}

function buildFixtureContract(overrides: { moment?: string; question?: string } = {}) {
  const moment = overrides.moment ?? '2026-08-15T05:00:00+05:30';
  const question = overrides.question ?? 'Will I get the job I interviewed for?';
  const verdict = realVerdict(moment, question);
  const diagnosis = diagnose(verdict);
  const protocol = selectRemedyProtocol(diagnosis);
  return buildReadingContract({
    readingId: 'r-fixture-1',
    computedAt: new Date('2026-08-15T00:00:00.000Z'),
    question,
    verdict,
    diagnosis,
    protocol,
  });
}

describe('buildReadingContract — construction', () => {
  it('same deterministic engine input produces the same contract content', () => {
    const a = buildFixtureContract();
    const b = buildFixtureContract();
    // provenance.computedAt/readingId are supplied identically by the fixture
    // helper too, so a full structural comparison is valid here.
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it('a different question produces a different contract', () => {
    const a = buildFixtureContract({ question: 'Will I get the job I interviewed for?' });
    const b = buildFixtureContract({ question: 'Will my business succeed?' });
    expect(canonicalStringify(a)).not.toBe(canonicalStringify(b));
  });

  it('reuses DisplayWatchVerdict/RkpDiagnosis verbatim rather than restating them', () => {
    const moment = '2026-08-15T05:00:00+05:30';
    const question = 'Will I get the job I interviewed for?';
    const verdict = realVerdict(moment, question);
    const diagnosis = diagnose(verdict);
    const protocol = selectRemedyProtocol(diagnosis);
    const contract = buildReadingContract({
      readingId: 'r1',
      computedAt: new Date(),
      question,
      verdict,
      diagnosis,
      protocol,
    });
    expect(contract.judgment).toEqual(verdict);
    expect(contract.diagnosis).toEqual(diagnosis);
  });

  it('carries explicit contract/engine/rules versions', () => {
    const contract = buildFixtureContract();
    expect(contract.provenance.contractVersion).toBe(READING_CONTRACT_VERSION);
    expect(contract.provenance.engineVersion.length).toBeGreaterThan(0);
    expect(contract.provenance.rulesVersion).toBe(contract.provenance.engineVersion);
  });
});

describe('buildReadingContract — immutability', () => {
  it('is frozen at every level reachable from the contract', () => {
    const contract = buildFixtureContract();
    expect(Object.isFrozen(contract)).toBe(true);
    expect(Object.isFrozen(contract.provenance)).toBe(true);
    expect(Object.isFrozen(contract.judgment)).toBe(true);
    expect(Object.isFrozen(contract.diagnosis)).toBe(true);
    expect(Object.isFrozen(contract.remedy)).toBe(true);
    expect(Object.isFrozen(contract.remedy.steps)).toBe(true);
    if (contract.remedy.steps.length > 0) {
      expect(Object.isFrozen(contract.remedy.steps[0])).toBe(true);
    }
    expect(Object.isFrozen(contract.celestialEntities)).toBe(true);
  });

  it('a downstream mutation attempt does not alter the authoritative value', () => {
    const contract = buildFixtureContract();
    const original = contract.diagnosis.outcome;
    expect(() => {
      // @ts-expect-error — intentionally attempting to write a readonly field
      contract.diagnosis.outcome = 'FAVOURABLE';
    }).toThrow(TypeError);
    expect(contract.diagnosis.outcome).toBe(original);
  });

  it('deepFreeze is idempotent and safe to call on an already-frozen value', () => {
    const contract = buildFixtureContract();
    expect(() => deepFreeze(contract)).not.toThrow();
  });
});

describe('canonicalStringify / computeContractFingerprint', () => {
  it('is stable regardless of source object key order', () => {
    const a = { x: 1, y: 2 };
    const b = { y: 2, x: 1 };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it('same deterministic contract content produces the same fingerprint', () => {
    const a = buildFixtureContract();
    const b = buildFixtureContract();
    expect(computeContractFingerprint(a)).toBe(computeContractFingerprint(b));
  });

  it('fingerprint is insensitive to provenance.readingId/computedAt', () => {
    const moment = '2026-08-15T05:00:00+05:30';
    const question = 'Will I get the job I interviewed for?';
    const verdict = realVerdict(moment, question);
    const diagnosis = diagnose(verdict);
    const protocol = selectRemedyProtocol(diagnosis);
    const a = buildReadingContract({
      readingId: 'reading-A',
      computedAt: new Date('2026-01-01T00:00:00.000Z'),
      question,
      verdict,
      diagnosis,
      protocol,
    });
    const b = buildReadingContract({
      readingId: 'reading-B-entirely-different-id',
      computedAt: new Date('2030-06-15T12:34:56.000Z'),
      question,
      verdict,
      diagnosis,
      protocol,
    });
    expect(computeContractFingerprint(a)).toBe(computeContractFingerprint(b));
  });

  it('a different question type changes the fingerprint', () => {
    const a = buildFixtureContract({ question: 'Will I get the job I interviewed for?' });
    const b = buildFixtureContract({ question: 'Will my business succeed?' });
    expect(computeContractFingerprint(a)).not.toBe(computeContractFingerprint(b));
  });
});

describe('toNarrationContext — source isolation and least privilege', () => {
  it('cannot alter the original contract through the returned context', () => {
    const contract = buildFixtureContract();
    const ctx = toNarrationContext(contract, { seekerName: 'Sarah' });
    expect(() => {
      // @ts-expect-error — intentionally attempting to write a readonly field
      ctx.diagnosis.outcome = 'FAVOURABLE';
    }).not.toThrow(); // ctx.diagnosis is a fresh plain object, not frozen —
    // but mutating it must not touch the contract it was derived from:
    expect(contract.diagnosis.outcome).not.toBe('FAVOURABLE');
  });

  it('exposes no provenance, database, or internal-service fields', () => {
    const contract = buildFixtureContract();
    const ctx = toNarrationContext(contract);
    const keys = Object.keys(ctx);
    expect(keys).not.toContain('provenance');
    expect(keys).not.toContain('readingId');
    expect(keys).not.toContain('computedAt');
    expect(keys).not.toContain('celestialEntities');
    const record = ctx as unknown as Record<string, unknown>;
    expect(record['db']).toBeUndefined();
    expect(record['auth']).toBeUndefined();
  });

  it('carries exactly the diagnosis/remedy fields buildUserPrompt uses, no more', () => {
    const contract = buildFixtureContract();
    const ctx = toNarrationContext(contract);
    expect(Object.keys(ctx.diagnosis).sort()).toEqual(
      [
        'confidence',
        'obstructingAgent',
        'primaryPattern',
        'questionType',
        'rationale',
        'secondaryPatterns',
        'targetHouse',
        'timing',
        'timingPosture',
        'outcome',
      ].sort(),
    );
    expect(Object.keys(ctx.remedy).sort()).toEqual(
      ['guidance', 'interventionRequired', 'steps'].sort(),
    );
    if (ctx.remedy.steps.length > 0) {
      expect(Object.keys(ctx.remedy.steps[0]!).sort()).toEqual(
        ['category', 'evidenceType', 'name', 'reason'].sort(),
      );
    }
  });

  it('defaults seekerName/motherName to null, not undefined, when omitted', () => {
    const contract = buildFixtureContract();
    const ctx = toNarrationContext(contract);
    expect(ctx.seekerName).toBeNull();
    expect(ctx.motherName).toBeNull();
  });
});
