import {
  mkdtempSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RATE_BOUNDS,
  checkScorecard,
  runAudition,
  speakingRate,
  type AuditionOptions,
} from './audition';
import { CASES, loadSource } from './cases';
import { completedTake, fakeRealtime } from './fakeRealtime';
import { normaliseWords } from './fidelity';

const KEY = ['sk', 'proj', 'W'.repeat(30)].join('-');

/** A transcript-harness run directory holding fixed, labelled fixture texts. */
function fixtureRun(mode: 'live' | 'stub', overrides: Record<string, unknown> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'tx-run-'));
  const states: Record<string, string> = {
    'yes-startup-en': 'FULFILLED',
    'yes-clear-noremedy-en': 'FULFILLED',
    'no-property-en': 'BLOCKED',
    'no-job-pushback-en': 'BLOCKED',
    'no-job-en-question-ur-ui': 'BLOCKED',
    'wait-scholarship-en': 'DELAYED',
    'wait-job-ur': 'DELAYED',
    'wait-job-voice-hi': 'DELAYED',
    'caution-travel-en': 'REVERSING',
    'unclear-ambiguous-en': 'UNFORMED',
  };
  const records = Object.entries(states).map(([id, state]) => ({
    scenario: { id },
    reading: { state, outcome: 'model', speakableText: `Reading text for ${id}.` },
    turns: [{ outcome: 'answered', answer: `Follow-up reply for ${id}.` }],
    ...((overrides[id] as object) ?? {}),
  }));
  writeFileSync(
    join(dir, 'metrics.json'),
    JSON.stringify({ header: { mode, label: `fixture-${mode}` } }),
  );
  writeFileSync(join(dir, 'records.json'), JSON.stringify(records));
  return dir;
}

function opts(over: Partial<AuditionOptions>): AuditionOptions {
  const out = mkdtempSync(join(tmpdir(), 'audition-'));
  return {
    mode: 'live',
    sourceDir: fixtureRun('live'),
    allowStubSource: false,
    label: 'test',
    outDir: join(out, 'test'),
    model: 'gpt-realtime-2.1-mini',
    voices: ['cedar', 'marin'],
    timeoutMs: 2000,
    apiKey: KEY,
    ...over,
  };
}

describe('loadSource', () => {
  it('takes each case’s exact validated text from the run', () => {
    const src = loadSource(fixtureRun('live'));
    expect(src.cases).toHaveLength(10);
    const ur = src.cases.find(c => c.case.id === 'A07-wait-ur')!;
    expect(ur.text).toBe('Follow-up reply for wait-job-ur.');
    expect(ur.textOrigin).toBe('follow-up');
    expect(src.cases.find(c => c.case.id === 'A10-unclear')!.state).toBe('UNFORMED');
  });

  it('refuses a stub transcript run unless explicitly allowed', () => {
    expect(() => loadSource(fixtureRun('stub'))).toThrow(/STUB transcript run/);
    expect(loadSource(fixtureRun('stub'), { allowStub: true }).mode).toBe('stub');
  });

  it('reports a missing or failed text instead of inventing one', () => {
    const dir = fixtureRun('live', {
      'wait-job-ur': { turns: [{ outcome: 'no-reply', answer: null }] },
      'yes-startup-en': {
        reading: { state: 'FULFILLED', outcome: 'fallback', speakableText: 'Fallback text.' },
      },
    });
    const src = loadSource(dir);
    const ur = src.cases.find(c => c.case.id === 'A07-wait-ur')!;
    expect(ur.text).toBeNull();
    expect(ur.unavailable).toContain('no-reply');
    expect(src.cases.find(c => c.case.id === 'A01-yes')!.textOrigin).toBe('fallback');
  });

  it('covers the five states, three languages and the no-remedy case', () => {
    const src = loadSource(fixtureRun('live'));
    expect(new Set(src.cases.map(c => c.state))).toEqual(
      new Set(['FULFILLED', 'BLOCKED', 'DELAYED', 'REVERSING', 'UNFORMED']),
    );
    expect(new Set(CASES.map(c => c.language))).toEqual(new Set(['en', 'ur', 'hi']));
    expect(CASES.some(c => c.scenario === 'yes-clear-noremedy-en')).toBe(true);
  });
});

describe('runAudition', () => {
  it('writes a WAV per verbatim take, disqualifies a paraphrase, and records evidence without the key', async () => {
    // cedar reads verbatim; marin adds a greeting.
    const { factory } = fakeRealtime(call => {
      const sent = call.sent.find(e => e.type === 'conversation.item.create') as {
        item: { content: Array<{ text: string }> };
      };
      const session = call.sent.find(e => e.type === 'session.update') as {
        session: { audio: { output: { voice: string } } };
      };
      const text = sent.item.content[0]!.text;
      return completedTake(
        session.session.audio.output.voice === 'cedar' ? text : `Peace be upon you. ${text}`,
      );
    });
    const o = opts({ socketFactory: factory });
    const { takes } = await runAudition(o);

    expect(takes).toHaveLength(20);
    expect(takes.filter(t => t.voice === 'cedar').every(t => t.status === 'ok')).toBe(true);
    expect(takes.filter(t => t.voice === 'marin').every(t => t.status === 'not-verbatim')).toBe(
      true,
    );
    expect(readdirSync(join(o.outDir, 'audio'))).toHaveLength(20);

    const manifest = readFileSync(join(o.outDir, 'manifest.json'), 'utf8');
    expect(manifest).not.toContain(KEY);
    const m = JSON.parse(manifest) as {
      model: string;
      api: string;
      performance: Record<string, { spoken: string }>;
    };
    expect(m.model).toBe('gpt-realtime-2.1-mini');
    expect(m.api).toBe('realtime (WebSocket)');
    expect(m.performance.UNFORMED!.spoken).toBe('UNCLEAR');

    const summary = readFileSync(join(o.outDir, 'summary.md'), 'utf8');
    // Voice | takes | usable | not verbatim | incomplete | failed | …
    expect(summary).toContain('| cedar | 10 | 10 | 0 | 0 | 0 |');
    expect(summary).toContain('| marin | 10 | 0 | 10 | 0 | 0 |');
    expect(summary).toContain('## Disqualified — fidelity');
    expect(summary).toContain('heard "peace be upon you"');
    const scorecard = readFileSync(join(o.outDir, 'scorecard.md'), 'utf8');
    expect(scorecard).toContain('## A. Written Oracle');
    expect(scorecard).toContain('## B. Spoken Oracle');
  });

  it('stub mode generates no audio and says so on every page', async () => {
    const o = opts({
      mode: 'stub',
      apiKey: null,
      sourceDir: fixtureRun('stub'),
      allowStubSource: true,
    });
    const { takes } = await runAudition(o);
    expect(takes.every(t => t.status === 'not-run')).toBe(true);
    expect(readdirSync(join(o.outDir, 'audio'))).toHaveLength(0);
    for (const f of ['summary.md', 'scorecard.md']) {
      expect(readFileSync(join(o.outDir, f), 'utf8')).toContain(
        'STUB RUN — NO AUDIO WAS GENERATED',
      );
    }
    expect(readFileSync(join(o.outDir, 'summary.md'), 'utf8')).toContain(
      'SOURCE TEXT IS STUB PLACEHOLDER PROSE',
    );
  });

  it('refuses live mode without a key, an undocumented voice, and an existing label', async () => {
    await expect(runAudition(opts({ apiKey: null }))).rejects.toThrow(/OPENAI_API_KEY/);
    await expect(runAudition(opts({ voices: ['onyx'] }))).rejects.toThrow(
      /not in the documented Realtime voice list/,
    );
    const o = opts({ mode: 'stub', apiKey: null });
    mkdirSync(o.outDir, { recursive: true });
    await expect(runAudition(o)).rejects.toThrow(/never overwritten/);
    expect(existsSync(join(o.outDir, 'manifest.json'))).toBe(false);
  });
});

/** PCM bytes for `seconds` of 24 kHz PCM16 mono audio. */
const pcmFor = (seconds: number) => [Buffer.alloc(Math.round(seconds * 24_000) * 2)];

/** A factory that speaks every text verbatim, with the given audio length and events. */
function verbatimFactory(
  seconds: (text: string) => number,
  opts: { omitAudioDone?: boolean } = {},
) {
  return fakeRealtime(call => {
    const item = call.sent.find(e => e.type === 'conversation.item.create') as {
      item: { content: Array<{ text: string }> };
    };
    const text = item.item.content[0]!.text;
    return completedTake(text, pcmFor(seconds(text)), opts);
  }).factory;
}

/** Seconds that put `text` at `wpm` words per minute. */
const atWpm = (wpm: number) => (text: string) => (normaliseWords(text).length / wpm) * 60;

describe('audio completion', () => {
  it('a response that ends without the audio-finished event is incomplete and disqualified (technical)', async () => {
    const o = opts({
      voices: ['cedar'],
      socketFactory: verbatimFactory(atWpm(130), { omitAudioDone: true }),
    });
    const { takes } = await runAudition(o);
    expect(takes.every(t => t.status === 'incomplete' && t.disqualified === 'technical')).toBe(
      true,
    );
    expect(takes.every(t => t.audioDoneReceived === false)).toBe(true);
    // Audio is kept so a listener can hear what was cut.
    expect(readdirSync(join(o.outDir, 'audio'))).toHaveLength(10);
    // Fidelity is still measured, but the take stays disqualified.
    expect(takes.every(t => t.fidelity?.verbatim === true)).toBe(true);
    const summary = readFileSync(join(o.outDir, 'summary.md'), 'utf8');
    expect(summary).toContain('| cedar | 10 | 0 | 0 | 10 | 0 |');
    expect(summary).toContain('## Disqualified — technical');
    expect(summary).toContain('response ended without response.output_audio.done');
  });

  it('a completed response with the audio-finished event is usable', async () => {
    const o = opts({ voices: ['cedar'], socketFactory: verbatimFactory(atWpm(130)) });
    const { takes } = await runAudition(o);
    expect(
      takes.every(
        t => t.status === 'ok' && t.disqualified === null && t.audioDoneReceived === true,
      ),
    ).toBe(true);
  });
});

describe('speaking rate', () => {
  it('computes words per minute from source words and audio duration', () => {
    expect(speakingRate(150, 60)).toBe(150);
    expect(speakingRate(10, 0)).toBeNull();
  });

  it('flags an implausible rate for review without failing the take', async () => {
    const fast = opts({ voices: ['cedar'], socketFactory: verbatimFactory(atWpm(400)) });
    const { takes } = await runAudition(fast);
    expect(takes.every(t => t.status === 'ok' && t.disqualified === null)).toBe(true);
    expect(takes.every(t => t.reviewFlags.includes('speaking-rate'))).toBe(true);
    expect(takes.every(t => Math.round(t.wordsPerMinute!) >= 390)).toBe(true);
    const summary = readFileSync(join(fast.outDir, 'summary.md'), 'utf8');
    expect(summary).toContain('## Needs listening attention (flags, not failures)');
    expect(summary).toContain(
      `outside ${DEFAULT_RATE_BOUNDS.minWpm}–${DEFAULT_RATE_BOUNDS.maxWpm}`,
    );

    const slow = opts({ voices: ['cedar'], socketFactory: verbatimFactory(atWpm(40)) });
    expect(
      (await runAudition(slow)).takes.every(t => t.reviewFlags.includes('speaking-rate')),
    ).toBe(true);
  });

  it('does not flag a plausible rate, and the range is configurable', async () => {
    const normal = opts({ voices: ['cedar'], socketFactory: verbatimFactory(atWpm(130)) });
    expect((await runAudition(normal)).takes.every(t => t.reviewFlags.length === 0)).toBe(true);

    const strict = opts({
      voices: ['cedar'],
      socketFactory: verbatimFactory(atWpm(130)),
      rateBounds: { minWpm: 140, maxWpm: 180 },
    });
    const { takes } = await runAudition(strict);
    expect(takes.every(t => t.reviewFlags.includes('speaking-rate'))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(strict.outDir, 'manifest.json'), 'utf8')) as {
      rateBounds: unknown;
    };
    expect(manifest.rateBounds).toEqual({ minWpm: 140, maxWpm: 180 });
  });
});

describe('listening scorecard', () => {
  async function scorecard() {
    const o = opts({ voices: ['cedar'], socketFactory: verbatimFactory(atWpm(130)) });
    await runAudition(o);
    return readFileSync(join(o.outDir, 'scorecard.md'), 'utf8');
  }
  const row = (md: string, caseId: string) =>
    md.split('\n').find(l => l.startsWith(`| ${caseId} | cedar |`))!;

  it('requires pauses for every take and Urdu/Hindi pronunciation for Urdu and Hindi takes', async () => {
    const md = await scorecard();
    expect(md).toContain(
      '| Pauses & phrasing at punctuation | Urdu/Hindi pronunciation & intelligibility |',
    );
    expect(row(md, 'A07-wait-ur')).toMatch(/\| required \| required \| \|$/);
    expect(row(md, 'A08-wait-hi')).toMatch(/\| required \| required \| \|$/);
    expect(row(md, 'A01-yes')).toMatch(/\| required \| n\/a \| \|$/);
  });

  it('checkScorecard refuses unfilled or invalid mandatory cells and accepts a completed sheet', async () => {
    const md = await scorecard();
    const blank = checkScorecard(md);
    expect(blank.complete).toBe(false);
    expect(blank.missing).toHaveLength(12); // 10 pauses + Urdu + Hindi
    expect(blank.missing).toContain(
      'A07-wait-ur × cedar: Urdu/Hindi pronunciation & intelligibility',
    );

    // Lookarounds, because adjacent cells share a pipe.
    const filled = md.replace(/(?<=\| )required(?= \|)/g, '8');
    expect(checkScorecard(filled)).toEqual({ complete: true, missing: [], invalid: [] });

    const bad = filled
      .replace('| A01-yes | cedar |', '| A01-yes | cedar |')
      .replace(/(\| A01-yes \| cedar \|[^\n]*?)\| 8 \| n\/a \|/, '$1| 11 | n/a |');
    expect(checkScorecard(bad).invalid).toEqual([
      'A01-yes × cedar: Pauses & phrasing at punctuation = "11"',
    ]);

    const cleared = filled.replace(/(\| A08-wait-hi \| cedar \|[^\n]*?)\| 8 \| 8 \|/, '$1|  | 8 |');
    expect(checkScorecard(cleared).missing).toEqual([
      'A08-wait-hi × cedar: Pauses & phrasing at punctuation',
    ]);
  });
});

describe('checkScorecard on a sheet with no audio', () => {
  it('never reports a stub scorecard as complete', async () => {
    const o = opts({
      mode: 'stub',
      apiKey: null,
      sourceDir: fixtureRun('stub'),
      allowStubSource: true,
    });
    await runAudition(o);
    const r = checkScorecard(readFileSync(join(o.outDir, 'scorecard.md'), 'utf8'));
    expect(r.complete).toBe(false);
    expect(r.missing).toEqual(['no takes with audio — nothing to approve']);
  });
});
