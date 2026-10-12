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

import { runAudition, type AuditionOptions } from './audition';
import { CASES, loadSource } from './cases';
import { completedTake, fakeRealtime } from './fakeRealtime';

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
    expect(summary).toContain('| cedar | 10 | 10 | 10 | 0 | 0 |');
    expect(summary).toContain('| marin | 10 | 10 | 0 | 10 | 0 |');
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
