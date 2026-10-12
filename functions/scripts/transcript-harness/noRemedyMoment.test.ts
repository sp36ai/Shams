/**
 * Pins the harness's only no-remedy scenario to the engine.
 *
 * The chart is a function of time, so this asserts the outcome for the one
 * fixed instant the scenario uses — not for the question in general (the
 * same question at the corpus moments in scenarios.ts does get a remedy).
 * Every stage of the no-intervention contract is checked separately, so a
 * failure names which one moved: the watch judgment, diagnose()'s
 * no-intervention test, or selectRemedyProtocol()'s no-remedy result.
 *
 * If an intentional engine change makes this fail, the scenario no longer
 * covers the no-remedy path: find a new moment (README §no-remedy) rather
 * than editing the contract or relaxing these assertions.
 */
import { describe, expect, it } from 'vitest';

import { buildWatchChart } from '../../src/engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../../src/engine/rkp/watchJudgment';
import { classifyQuestion } from '../../src/engine/kp/rules/questionKeywords';
import { diagnose } from '../../src/engine/rkp/diagnosis';
import { localIsoFromOffset } from '../../src/utils/localTime';
import { toBoundaryPlanetName } from '../../src/utils/planetBoundaryName';
import { selectRemedyProtocol } from '../../src/oracle/remedySelection';

import { SCENARIOS } from './scenarios';

const scenario = SCENARIOS.find(s => s.id === 'yes-clear-noremedy-en')!;

function judge() {
  const instant = new Date(scenario.utcInstant);
  const verdict = judgeWatchChart(
    buildWatchChart(localIsoFromOffset(instant, scenario.utcOffsetMinutes)),
    classifyQuestion(scenario.question),
  );
  const display: DisplayWatchVerdict = {
    ...verdict,
    obstruction: toBoundaryPlanetName(verdict.obstruction),
    targetRuler: toBoundaryPlanetName(verdict.targetRuler),
    lagnaRuler: toBoundaryPlanetName(verdict.lagnaRuler),
  };
  const diagnosis = diagnose(display);
  return { verdict, diagnosis, protocol: selectRemedyProtocol(diagnosis) };
}

describe('yes-clear-noremedy-en — fixed instant 2026-12-06T03:02Z (+05:30)', () => {
  it('is the scenario the harness actually runs', () => {
    expect(scenario.expectNoRemedy).toBe(true);
    expect(scenario.utcInstant).toBe('2026-12-06T03:02:00.000Z');
    expect(scenario.utcOffsetMinutes).toBe(330);
  });

  it('judges clean: FULFILLED, no obstruction, no reversal, high confidence', () => {
    const { verdict } = judge();
    expect(verdict.state).toBe('FULFILLED');
    expect(verdict.obstruction).toBe('None');
    expect(verdict.reversal).toBe('NONE');
    expect(['HIGH', 'VERY_HIGH']).toContain(verdict.confidence);
  });

  it('diagnoses no intervention', () => {
    const { diagnosis } = judge();
    expect(diagnosis.outcome).toBe('FAVOURABLE');
    expect(diagnosis.interventionNeeded).toBe(false);
  });

  it('prescribes nothing — no steps, no escalation', () => {
    const { protocol } = judge();
    expect(protocol.interventionRequired).toBe(false);
    expect(protocol.steps).toHaveLength(0);
    expect(protocol.escalation).toBeNull();
  });
});
