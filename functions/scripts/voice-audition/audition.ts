/**
 * audition.ts — the voice-audition runner as a library (CLI: run.ts).
 * See run.ts for usage.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadSource, type SourcedCase } from './cases';
import { compare, type Fidelity } from './fidelity';
import { instructionsFor, type SpokenVerdict } from './performance';
import { pcmToWav, synthesize, type SpeechResult, type SocketFactory } from './realtimeSpeech';

export const DEFAULT_MODEL = 'gpt-realtime-2.1-mini';
// Realtime voice list (OpenAI realtime-conversations guide, 2026-10-12):
// alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar.
// Onyx is not among them. OpenAI recommends marin or cedar.
export const DEFAULT_VOICES = ['cedar', 'marin'] as const;
export const REALTIME_VOICES: ReadonlySet<string> = new Set([
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar',
]);

export type AuditionMode = 'live' | 'stub';

export interface Take {
  readonly caseId: string;
  readonly voice: string;
  readonly spoken: SpokenVerdict;
  readonly status: 'ok' | 'not-verbatim' | 'failed' | 'not-run' | 'no-source-text';
  readonly audioFile: string | null;
  readonly audioSha256: string | null;
  readonly audioSeconds: number | null;
  readonly firstAudioMs: number | null;
  readonly totalMs: number | null;
  readonly fidelity: Fidelity | null;
  readonly transcript: string | null;
  readonly responseStatus: string | null;
  readonly eventTypes: Readonly<Record<string, number>>;
  readonly error: string | null;
}

export interface AuditionOptions {
  readonly mode: AuditionMode;
  readonly sourceDir: string;
  readonly allowStubSource: boolean;
  readonly label: string;
  readonly outDir: string;
  readonly model: string;
  readonly voices: readonly string[];
  readonly timeoutMs: number;
  readonly apiKey: string | null;
  readonly socketFactory?: SocketFactory;
}

function sha256(b: Buffer | string): string {
  return createHash('sha256').update(b).digest('hex');
}

export async function runAudition(
  opts: AuditionOptions,
): Promise<{ takes: Take[]; outDir: string }> {
  if (existsSync(opts.outDir)) {
    throw new Error(
      `${opts.outDir} already exists — choose a new --label; audition runs are never overwritten`,
    );
  }
  for (const v of opts.voices) {
    if (!REALTIME_VOICES.has(v)) {
      throw new Error(`voice "${v}" is not in the documented Realtime voice list`);
    }
  }
  if (opts.mode === 'live' && !opts.apiKey) {
    throw new Error('live mode needs OPENAI_API_KEY in the environment');
  }

  const source = loadSource(opts.sourceDir, { allowStub: opts.allowStubSource });
  mkdirSync(resolve(opts.outDir, 'audio'), { recursive: true });

  const takes: Take[] = [];
  for (const sc of source.cases) {
    const { spoken, instructions } = instructionsFor(sc.state);
    for (const voice of opts.voices) {
      const base = { caseId: sc.case.id, voice, spoken, eventTypes: {} } as const;
      if (sc.text === null) {
        takes.push({
          ...base,
          status: 'no-source-text',
          audioFile: null,
          audioSha256: null,
          audioSeconds: null,
          firstAudioMs: null,
          totalMs: null,
          fidelity: null,
          transcript: null,
          responseStatus: null,
          error: sc.unavailable,
        });
        continue;
      }
      if (opts.mode === 'stub') {
        takes.push({
          ...base,
          status: 'not-run',
          audioFile: null,
          audioSha256: null,
          audioSeconds: null,
          firstAudioMs: null,
          totalMs: null,
          fidelity: null,
          transcript: null,
          responseStatus: null,
          error: 'stub mode — no audio generated',
        });
        continue;
      }
      console.warn(`[audition] ${sc.case.id} × ${voice} …`);
      const r: SpeechResult = await synthesize(
        opts.apiKey!,
        { model: opts.model, voice, instructions, text: sc.text, timeoutMs: opts.timeoutMs },
        opts.socketFactory,
      );
      if (!r.ok) {
        takes.push({
          ...base,
          status: 'failed',
          audioFile: null,
          audioSha256: null,
          audioSeconds: null,
          firstAudioMs: r.firstAudioMs,
          totalMs: r.totalMs,
          fidelity: null,
          transcript: r.transcript || null,
          responseStatus: r.responseStatus,
          eventTypes: r.eventTypes,
          error: r.error,
        });
        continue;
      }
      const wav = pcmToWav(r.pcm);
      const file = `audio/${sc.case.id}__${voice}.wav`;
      writeFileSync(resolve(opts.outDir, file), wav);
      const fidelity = compare(sc.text, r.transcript);
      takes.push({
        ...base,
        status: fidelity.verbatim ? 'ok' : 'not-verbatim',
        audioFile: file,
        audioSha256: sha256(wav),
        audioSeconds: r.pcm.length / 2 / 24_000,
        firstAudioMs: r.firstAudioMs,
        totalMs: r.totalMs,
        fidelity,
        transcript: r.transcript,
        responseStatus: r.responseStatus,
        eventTypes: r.eventTypes,
        error: null,
      });
    }
  }

  const manifest = {
    formatVersion: 1,
    label: opts.label,
    mode: opts.mode,
    createdAt: new Date().toISOString(),
    provider: 'openai',
    api: 'realtime (WebSocket)',
    model: opts.model,
    voices: opts.voices,
    audioFormat: 'PCM16 mono 24 kHz, saved as WAV',
    source: { dir: source.dir, mode: source.mode, label: source.label },
    performance: Object.fromEntries(
      (['FULFILLED', 'BLOCKED', 'DELAYED', 'MOVING', 'REVERSING', 'UNFORMED'] as const).map(s => {
        const p = instructionsFor(s);
        return [
          s,
          {
            spoken: p.spoken,
            instructionsSha256: sha256(p.instructions),
            instructions: p.instructions,
          },
        ];
      }),
    ),
    cases: source.cases.map(c => ({
      id: c.case.id,
      scenario: c.case.scenario,
      text: c.case.text,
      language: c.case.language,
      purpose: c.case.purpose,
      state: c.state,
      textOrigin: c.textOrigin,
      unavailable: c.unavailable,
      sourceText: c.text,
    })),
    takes,
  };
  writeFileSync(resolve(opts.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(
    resolve(opts.outDir, 'summary.md'),
    summaryMarkdown(opts, source.mode, source.cases, takes),
  );
  writeFileSync(resolve(opts.outDir, 'scorecard.md'), scorecardMarkdown(opts, source.cases, takes));
  return { takes, outDir: opts.outDir };
}

const STUB_BANNER =
  "> **STUB RUN — NO AUDIO WAS GENERATED.** This checks the kit's wiring only. It is not " +
  'audition evidence and must not be scored or cited as a voice result.\n';
const STUB_SOURCE_BANNER =
  '> **SOURCE TEXT IS STUB PLACEHOLDER PROSE**, not Oracle writing. Nothing here reflects the ' +
  "Oracle's written style.\n";

function median(xs: number[]): number | null {
  if (xs.length === 0) {
    return null;
  }
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function summaryMarkdown(
  opts: AuditionOptions,
  sourceMode: string,
  cases: readonly SourcedCase[],
  takes: readonly Take[],
): string {
  const out: string[] = [`# Voice audition — ${opts.label}`, ''];
  if (opts.mode === 'stub') {
    out.push(STUB_BANNER);
  }
  if (sourceMode === 'stub') {
    out.push(STUB_SOURCE_BANNER);
  }
  out.push(
    `- Mode: **${opts.mode}** · Model: \`${opts.model}\` (Realtime API) · Voices: ${opts.voices.join(', ')}`,
    `- Source transcript run: \`${opts.sourceDir}\` (mode ${sourceMode})`,
    '',
    "A take is usable only if it is **verbatim**: the provider's transcript of its own audio matches the",
    "validated text word for word. The transcript is the provider's account of its audio, so a listener",
    'confirms fidelity during review. Latency is time from sending the request to the first audio chunk.',
    '',
    '## Per voice',
    '',
    '| Voice | Takes with text | Audio produced | Verbatim | Not verbatim | Failed | Median first audio (ms) |',
    '|---|---|---|---|---|---|---|',
  );
  for (const v of opts.voices) {
    const t = takes.filter(x => x.voice === v && x.status !== 'no-source-text');
    const produced = t.filter(x => x.status === 'ok' || x.status === 'not-verbatim');
    out.push(
      `| ${v} | ${t.length} | ${produced.length} | ${t.filter(x => x.status === 'ok').length} | ${
        t.filter(x => x.status === 'not-verbatim').length
      } | ${t.filter(x => x.status === 'failed').length} | ${median(produced.flatMap(x => (x.firstAudioMs === null ? [] : [x.firstAudioMs]))) ?? '–'} |`,
    );
  }
  out.push(
    '',
    '## Cases',
    '',
    '| Case | State → spoken as | Language | Text origin | Note |',
    '|---|---|---|---|---|',
  );
  for (const c of cases) {
    out.push(
      `| ${c.case.id} | ${c.state} → ${instructionsFor(c.state).spoken} | ${c.case.language} | ${c.textOrigin ?? '—'} | ${c.unavailable ?? c.case.purpose} |`,
    );
  }
  const problems = takes.filter(t => t.status === 'failed' || t.status === 'not-verbatim');
  if (problems.length > 0) {
    out.push('', '## Failures and divergences', '');
    for (const t of problems) {
      const d = t.fidelity?.firstDivergence;
      out.push(
        `- ${t.caseId} × ${t.voice}: ${t.status}${t.error ? ` — ${t.error}` : ''}${
          d
            ? ` — first divergence at word ${d.at}: expected "${d.expected}", heard "${d.heard}" (WER ${t.fidelity!.wordErrorRate.toFixed(2)})`
            : ''
        }`,
      );
    }
  }
  out.push('');
  return out.join('\n');
}

function scorecardMarkdown(
  opts: AuditionOptions,
  cases: readonly SourcedCase[],
  takes: readonly Take[],
): string {
  const out: string[] = [`# Scorecard — ${opts.label}`, ''];
  if (opts.mode === 'stub') {
    out.push(STUB_BANNER);
  }
  out.push(
    'Score 1–10, or leave blank. Written and audio scores are independent: score the writing from',
    'the text alone, before listening.',
    '',
    '## A. Written Oracle (per case, voice-independent)',
    '',
    '| Case | Clarity | Warmth | Gravitas | Emotional restraint | Consistency | Notes |',
    '|---|---|---|---|---|---|---|',
    ...cases.map(c => `| ${c.case.id}${c.text === null ? ' (no text)' : ''} | | | | | | |`),
    '',
    '## B. Spoken Oracle (per case × voice)',
    '',
    'Verbatim, first-audio latency and duration are filled in by the kit. A take that is not verbatim',
    'is disqualified whatever it sounds like.',
    '',
    '| Case | Voice | Verbatim | First audio (ms) | Duration (s) | Clarity | Warmth | Gravitas | Pronunciation | Emotional restraint | Consistency | Notes |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...takes.map(t => {
      const verbatim =
        t.status === 'ok'
          ? 'yes'
          : t.status === 'not-verbatim'
            ? `**no** (WER ${t.fidelity!.wordErrorRate.toFixed(2)})`
            : t.status;
      return `| ${t.caseId} | ${t.voice} | ${verbatim} | ${t.firstAudioMs ?? '–'} | ${t.audioSeconds?.toFixed(1) ?? '–'} | | | | | | | |`;
    }),
    '',
  );
  return out.join('\n');
}
