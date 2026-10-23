/**
 * The deterministic fallback speaks in the seeker's language, not the
 * engine's, for every reading the engine can produce. Audit 2026-10-15:
 * the old template said "Mars is the obstructing influence" and could say
 * "MoonDisagreement is the obstructing influence".
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config', () => ({
  ANTHROPIC_API_KEY: { value: () => 'test-key' },
  FUNCTION_OPTS: {},
  ORACLE_FUNCTION_OPTS: {},
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { buildWatchChart } from '../../engine/rkp/watchChart';
import { judgeWatchChart } from '../../engine/rkp/watchJudgment';
import { diagnose } from '../../engine/rkp/diagnosis';
import { classifyQuestion } from '../../engine/kp/rules/questionKeywords';
import { toBoundaryPlanetName } from '../../utils/planetBoundaryName';
import { selectRemedyProtocol } from '../remedySelection';
import { buildReadingContract } from '../readingContract';
import { validateNarration } from '../narrationValidator';
import { buildDeterministicFallbackNarration } from '../narrationFallback';
import { agentGlossedName, agentShortName } from '../agentNames';

const QUESTIONS = [
  'Will I get married this year?',
  'Will I get the job?',
  'Will my shop do well?',
  'Will I recover from this illness?',
  'Will I travel abroad?',
  'Will things get better?',
];

function contractAt(moment: string, question: string) {
  const raw = judgeWatchChart(buildWatchChart(moment), classifyQuestion(question));
  const verdict = {
    ...raw,
    obstruction: toBoundaryPlanetName(raw.obstruction),
    targetRuler: toBoundaryPlanetName(raw.targetRuler),
    lagnaRuler: toBoundaryPlanetName(raw.lagnaRuler),
  };
  const diagnosis = diagnose(verdict);
  return buildReadingContract({
    readingId: 'r-fallback',
    computedAt: new Date(moment),
    question,
    verdict,
    diagnosis,
    protocol: selectRemedyProtocol(diagnosis, {}),
  });
}

/** Every 5-minute bracket of one day: all twelve watch frames, every hour. */
const MOMENTS = Array.from({ length: 24 * 12 }, (_, i) => {
  const h = String(Math.floor(i / 12)).padStart(2, '0');
  const m = String((i % 12) * 5).padStart(2, '0');
  return `2026-10-14T${h}:${m}:00+05:30`;
});

const ENGLISH_PLANET =
  /\b(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu|MoonDisagreement)\b/;
const ENGINE_TOKEN = /\b[A-Z]{2,}(?:_[A-Z]+)*\b/;
const ENGINE_JARGON = /querent|ruling planet|ruler of the matter|Ghar|retrograde/i;

describe('deterministic fallback, every bracket of a day × six questions', () => {
  const cases = MOMENTS.flatMap(moment => QUESTIONS.map(q => [moment, q] as const));

  it('always passes the same validator the model must pass', () => {
    const failures: string[] = [];
    for (const [moment, q] of cases) {
      const contract = contractAt(moment, q);
      const result = validateNarration(contract, buildDeterministicFallbackNarration(contract));
      if (!result.valid) {
        failures.push(`${moment} ${q}: ${result.failures.map(f => f.code).join(',')}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('never shows English planet names, engine tokens or chart jargon', () => {
    for (const [moment, q] of cases) {
      const fallback = buildDeterministicFallbackNarration(contractAt(moment, q));
      for (const text of Object.values(fallback)) {
        expect(text ?? '', `${moment} ${q}`).not.toMatch(ENGLISH_PLANET);
        expect(text ?? '', `${moment} ${q}`).not.toMatch(ENGINE_TOKEN);
        expect(text ?? '', `${moment} ${q}`).not.toMatch(ENGINE_JARGON);
      }
    }
  });

  it('states a timing window only when the engine gave one', () => {
    for (const [moment, q] of cases) {
      const contract = contractAt(moment, q);
      const text = Object.values(buildDeterministicFallbackNarration(contract)).join(' ');
      if (contract.diagnosis.timing === null) {
        expect(text, `${moment} ${q}`).not.toMatch(/\d+\s*day/);
      } else {
        expect(text).toContain(`${contract.diagnosis.timing.maxDays}`);
      }
    }
  });
});

describe('agent names', () => {
  it('speaks classical names, never the raw engine identifier', () => {
    expect(agentShortName('Saturn')).toBe('Zuhal');
    expect(agentShortName('Mars')).toBe('Mirrikh');
    expect(agentShortName('Dhanab')).toBe('Dhanab');
    expect(agentShortName('MoonDisagreement')).toBe('Qamar');
    expect(agentShortName(null)).toBeNull();
    expect(agentGlossedName('Saturn')).toBe('Zuhal, the star of delay');
    expect(agentGlossedName('Ras')).toBe('Ras, the shadow point of illusion');
  });
});
