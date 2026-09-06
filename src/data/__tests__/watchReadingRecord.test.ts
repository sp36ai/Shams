import { buildWatchChart } from '@astrology/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '@astrology/rkp/watchJudgment';
import { diagnose } from '@astrology/rkp/diagnosis';
import type { WatchOracleComposition } from '../../types/watchOracle';
import type { WatchReading } from '../../firebase/watchOracle';
import { toReadingRecord } from '../watchReadingRecord';

const MOMENT = '2026-08-08T11:13:00+05:30';

function verdictWith(overrides: Partial<DisplayWatchVerdict> = {}): DisplayWatchVerdict {
  return { ...judgeWatchChart(buildWatchChart(MOMENT), 'legal'), ...overrides };
}

function compositionFor(verdict: DisplayWatchVerdict): WatchOracleComposition {
  return {
    narration: null,
    diagnosis: diagnose(verdict),
    protocol: { interventionRequired: false, guidance: 'All is well.', steps: [], rationale: [] },
  };
}

function readingWith(overrides: Partial<WatchReading> = {}): WatchReading {
  const verdict = verdictWith();
  return {
    readingId: 'r1',
    computedAt: '2026-08-08T05:43:00.000Z',
    localMoment: MOMENT,
    window: { startMinute: 43, endMinute: 48, minute: 43 },
    lagnaSignName: 'Burj Jauza',
    lagnaRulerName: 'Utarid',
    verdict,
    oracle: compositionFor(verdict),
    ...overrides,
  };
}

describe('toReadingRecord', () => {
  it('carries the question fields straight through', () => {
    const record = toReadingRecord({
      id: 'r1',
      question: 'Will I get the job?',
      questionLang: 'en',
      createdAt: '2026-08-08T05:43:00.000Z',
      reading: readingWith(),
    });

    expect(record.id).toBe('r1');
    expect(record.question).toBe('Will I get the job?');
    expect(record.questionLang).toBe('en');
    expect(record.createdAt).toBe('2026-08-08T05:43:00.000Z');
  });

  it('never invents a question domain — always general', () => {
    const record = toReadingRecord({
      id: 'r1',
      question: 'Will I get the job?',
      questionLang: 'en',
      createdAt: '2026-08-08T05:43:00.000Z',
      reading: readingWith(),
    });
    expect(record.category).toBe('general');
  });

  it('attaches watch_oracle and a rounded confidence percentage when oracle is present', () => {
    const reading = readingWith();
    const record = toReadingRecord({
      id: 'r1',
      question: 'Q',
      questionLang: 'en',
      createdAt: reading.computedAt,
      reading,
    });

    expect(record.watch_oracle).toBeDefined();
    expect(record.watch_oracle?.verdict).toBe(reading.verdict);
    expect(record.watch_oracle?.composition).toBe(reading.oracle);
    const vj = record.verdictJson as { confidence: number };
    expect(vj.confidence).toBe(Math.round(reading.oracle!.diagnosis.confidence * 100));
  });

  it('degrades honestly to UNCLEAR with no watch_oracle when synthesis failed entirely', () => {
    const reading = readingWith({ oracle: undefined });
    const record = toReadingRecord({
      id: 'r1',
      question: 'Q',
      questionLang: 'en',
      createdAt: reading.computedAt,
      reading,
    });

    expect(record.verdict).toBe('UNCLEAR');
    expect(record.watch_oracle).toBeUndefined();
    expect((record.verdictJson as { confidence: number }).confidence).toBe(0);
  });

  it('buckets FULFILLED (favourable) as YES', () => {
    const verdict = verdictWith({ state: 'FULFILLED', obstruction: 'None' });
    const reading = readingWith({ verdict, oracle: compositionFor(verdict) });
    const record = toReadingRecord({
      id: 'r1',
      question: 'Q',
      questionLang: 'en',
      createdAt: reading.computedAt,
      reading,
    });
    expect(record.verdict).toBe('YES');
  });

  it('buckets BLOCKED (unfavourable) as NO', () => {
    const verdict = verdictWith({ state: 'BLOCKED' });
    const reading = readingWith({ verdict, oracle: compositionFor(verdict) });
    const record = toReadingRecord({
      id: 'r1',
      question: 'Q',
      questionLang: 'en',
      createdAt: reading.computedAt,
      reading,
    });
    expect(record.verdict).toBe('NO');
  });

  it('buckets UNFORMED (uncertain) as UNCLEAR', () => {
    const verdict = verdictWith({ state: 'UNFORMED' });
    const reading = readingWith({ verdict, oracle: compositionFor(verdict) });
    const record = toReadingRecord({
      id: 'r1',
      question: 'Q',
      questionLang: 'en',
      createdAt: reading.computedAt,
      reading,
    });
    expect(record.verdict).toBe('UNCLEAR');
  });
});
