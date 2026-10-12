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
import {
  PCM_SAMPLE_RATE,
  pcmToWav,
  synthesize,
  type SpeechResult,
  type SocketFactory,
} from './realtimeSpeech';

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

/**
 * Plausible speaking-rate range, in words per minute of the SOURCE text over
 * the measured audio duration. Deliberate narration usually sits around
 * 110–160 wpm; the defaults are deliberately wide because Urdu and Hindi
 * word counts differ from English and the Oracle speaks slowly by design.
 *
 * A rate outside the range is a REVIEW FLAG, not a failure: it can point to
 * truncated audio (too fast) or padded silence / extra speech (too slow),
 * but on its own it proves neither. Override with --min-wpm / --max-wpm.
 */
export const DEFAULT_RATE_BOUNDS: RateBounds = Object.freeze({ minWpm: 80, maxWpm: 200 });

export interface RateBounds {
  readonly minWpm: number;
  readonly maxWpm: number;
}

/** Source words per minute of audio; null when there is no measurable audio. */
export function speakingRate(sourceWords: number, audioSeconds: number): number | null {
  return audioSeconds > 0 ? (sourceWords / audioSeconds) * 60 : null;
}

/**
 * Take status. Two kinds of disqualification are kept apart:
 *   technical — 'failed' (no usable response) or 'incomplete' (the response
 *               ended without the documented audio-finished event, so the
 *               audio may be cut short);
 *   fidelity  — 'not-verbatim' (the words spoken were not the validated text).
 * 'ok' still needs a listener: reviewFlags and the mandatory scorecard
 * fields say what to check.
 */
export type TakeStatus =
  | 'ok'
  | 'not-verbatim'
  | 'incomplete'
  | 'failed'
  | 'not-run'
  | 'no-source-text';

export type ReviewFlag = 'speaking-rate';

export interface Take {
  readonly caseId: string;
  readonly voice: string;
  readonly spoken: SpokenVerdict;
  readonly status: TakeStatus;
  /** Why a take cannot be used, if it cannot. */
  readonly disqualified: 'technical' | 'fidelity' | null;
  /** Points a listener must check; never a failure on their own. */
  readonly reviewFlags: readonly ReviewFlag[];
  readonly audioFile: string | null;
  readonly audioSha256: string | null;
  readonly audioSeconds: number | null;
  readonly firstAudioMs: number | null;
  readonly totalMs: number | null;
  readonly fidelity: Fidelity | null;
  readonly transcript: string | null;
  readonly responseStatus: string | null;
  /** null when no response was received at all. */
  readonly audioDoneReceived: boolean | null;
  /** Source words per minute of measured audio; null without audio. */
  readonly wordsPerMinute: number | null;
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
  /** Defaults to DEFAULT_RATE_BOUNDS. */
  readonly rateBounds?: RateBounds;
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

  const bounds = opts.rateBounds ?? DEFAULT_RATE_BOUNDS;
  const takes: Take[] = [];
  for (const sc of source.cases) {
    const { spoken, instructions } = instructionsFor(sc.state);
    for (const voice of opts.voices) {
      const noAudio = {
        caseId: sc.case.id,
        voice,
        spoken,
        reviewFlags: [] as ReviewFlag[],
        audioFile: null,
        audioSha256: null,
        audioSeconds: null,
        wordsPerMinute: null,
        fidelity: null,
        eventTypes: {},
      } as const;
      if (sc.text === null) {
        takes.push({
          ...noAudio,
          status: 'no-source-text',
          disqualified: null,
          firstAudioMs: null,
          totalMs: null,
          transcript: null,
          responseStatus: null,
          audioDoneReceived: null,
          error: sc.unavailable,
        });
        continue;
      }
      if (opts.mode === 'stub') {
        takes.push({
          ...noAudio,
          status: 'not-run',
          disqualified: null,
          firstAudioMs: null,
          totalMs: null,
          transcript: null,
          responseStatus: null,
          audioDoneReceived: null,
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
          ...noAudio,
          status: 'failed',
          disqualified: 'technical',
          firstAudioMs: r.firstAudioMs,
          totalMs: r.totalMs,
          transcript: r.transcript || null,
          responseStatus: r.responseStatus,
          audioDoneReceived: r.audioDoneReceived,
          eventTypes: r.eventTypes,
          error: r.error,
        });
        continue;
      }
      // Audio kept even for a disqualified take: the listener needs it to
      // see what went wrong.
      const wav = pcmToWav(r.pcm);
      const file = `audio/${sc.case.id}__${voice}.wav`;
      writeFileSync(resolve(opts.outDir, file), wav);
      const fidelity = compare(sc.text, r.transcript);
      const audioSeconds = r.pcm.length / 2 / PCM_SAMPLE_RATE;
      const wordsPerMinute = speakingRate(fidelity.sourceWords, audioSeconds);
      const reviewFlags: ReviewFlag[] =
        wordsPerMinute !== null &&
        (wordsPerMinute < bounds.minWpm || wordsPerMinute > bounds.maxWpm)
          ? ['speaking-rate']
          : [];
      let status: TakeStatus;
      let disqualified: Take['disqualified'];
      if (!r.audioDoneReceived) {
        status = 'incomplete';
        disqualified = 'technical';
      } else if (!fidelity.verbatim) {
        status = 'not-verbatim';
        disqualified = 'fidelity';
      } else {
        status = 'ok';
        disqualified = null;
      }
      takes.push({
        caseId: sc.case.id,
        voice,
        spoken,
        status,
        disqualified,
        reviewFlags,
        audioFile: file,
        audioSha256: sha256(wav),
        audioSeconds,
        wordsPerMinute,
        firstAudioMs: r.firstAudioMs,
        totalMs: r.totalMs,
        fidelity,
        transcript: r.transcript,
        responseStatus: r.responseStatus,
        audioDoneReceived: r.audioDoneReceived,
        eventTypes: r.eventTypes,
        error: status === 'incomplete' ? 'response ended without response.output_audio.done' : null,
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
    rateBounds: bounds,
    statusMeaning: {
      ok: 'verbatim and complete — still needs listening review',
      'not-verbatim': 'disqualified (fidelity): spoken words differ from the validated text',
      incomplete: 'disqualified (technical): response ended without response.output_audio.done',
      failed: 'disqualified (technical): no usable response',
      'not-run': 'stub mode — no audio generated',
      'no-source-text': 'the source run has no validated text for this case',
    },
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
  const bounds = opts.rateBounds ?? DEFAULT_RATE_BOUNDS;
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
    `- Speaking-rate review range: ${bounds.minWpm}–${bounds.maxWpm} words per minute (source words over audio duration)`,
    '',
    'A take is usable only if it is **complete** (the audio-finished event arrived) and **verbatim** (the',
    "provider's transcript of its own audio matches the validated text word for word). The transcript is the",
    "provider's account of its audio, so every take is still listened to. Latency is time from sending the",
    'request to the first audio chunk. A speaking-rate flag asks a listener to check; it is not a failure.',
    '',
    '## Per voice',
    '',
    '| Voice | Takes with text | Usable (complete + verbatim) | Not verbatim | Incomplete | Failed | Rate flags | Median first audio (ms) |',
    '|---|---|---|---|---|---|---|---|',
  );
  for (const v of opts.voices) {
    const t = takes.filter(x => x.voice === v && x.status !== 'no-source-text');
    const withAudio = t.filter(x => x.audioFile !== null);
    out.push(
      `| ${v} | ${t.length} | ${t.filter(x => x.status === 'ok').length} | ${
        t.filter(x => x.status === 'not-verbatim').length
      } | ${t.filter(x => x.status === 'incomplete').length} | ${t.filter(x => x.status === 'failed').length} | ${
        t.filter(x => x.reviewFlags.includes('speaking-rate')).length
      } | ${median(withAudio.flatMap(x => (x.firstAudioMs === null ? [] : [x.firstAudioMs]))) ?? '–'} |`,
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
      `| ${c.case.id} | ${c.state} → ${instructionsFor(c.state).spoken} | ${c.case.language} | ${
        c.textOrigin ?? '—'
      } | ${c.unavailable ?? c.case.purpose} |`,
    );
  }

  const technical = takes.filter(t => t.disqualified === 'technical');
  if (technical.length > 0) {
    out.push('', '## Disqualified — technical', '');
    for (const t of technical) {
      out.push(`- ${t.caseId} × ${t.voice}: ${t.status} — ${t.error ?? 'no detail'}`);
    }
  }
  const fidelity = takes.filter(t => t.disqualified === 'fidelity');
  if (fidelity.length > 0) {
    out.push('', '## Disqualified — fidelity (not the validated text)', '');
    for (const t of fidelity) {
      const d = t.fidelity!.firstDivergence;
      out.push(
        `- ${t.caseId} × ${t.voice}: WER ${t.fidelity!.wordErrorRate.toFixed(2)}${
          d
            ? ` — first divergence at word ${d.at}: expected "${d.expected}", heard "${d.heard}"`
            : ''
        }`,
      );
    }
  }
  const flagged = takes.filter(t => t.reviewFlags.length > 0);
  if (flagged.length > 0) {
    out.push('', '## Needs listening attention (flags, not failures)', '');
    for (const t of flagged) {
      out.push(
        `- ${t.caseId} × ${t.voice}: speaking rate ${t.wordsPerMinute!.toFixed(0)} wpm, outside ${bounds.minWpm}–${bounds.maxWpm} — listen for cut-off audio (fast) or padding / extra speech (slow)`,
      );
    }
  }
  out.push('');
  return out.join('\n');
}

/** Scorecard cell values the kit writes for the two mandatory listening fields. */
export const REQUIRED = 'required';
export const NOT_APPLICABLE = 'n/a';

/** Columns a listener must fill (1–10) wherever the kit wrote REQUIRED. */
export const MANDATORY_COLUMNS = [
  'Pauses & phrasing at punctuation',
  'Urdu/Hindi pronunciation & intelligibility',
] as const;

function scorecardMarkdown(
  opts: AuditionOptions,
  cases: readonly SourcedCase[],
  takes: readonly Take[],
): string {
  const language = new Map(cases.map(c => [c.case.id, c.case.language]));
  const out: string[] = [`# Scorecard — ${opts.label}`, ''];
  if (opts.mode === 'stub') {
    out.push(STUB_BANNER);
  }
  out.push(
    'Score 1–10, or leave blank. Written and audio scores are independent: score the writing from',
    'the text alone, before listening.',
    '',
    `Cells marked \`${REQUIRED}\` are **mandatory** and must be replaced with a 1–10 score before any`,
    'voice is approved; `checkScorecard.ts` refuses a scorecard with one left. Pauses and phrasing are',
    'required for every take with audio; Urdu/Hindi pronunciation is required for the Urdu and Hindi',
    `cases (\`${NOT_APPLICABLE}\` for English).`,
    '',
    '## A. Written Oracle (per case, voice-independent)',
    '',
    '| Case | Clarity | Warmth | Gravitas | Emotional restraint | Consistency | Notes |',
    '|---|---|---|---|---|---|---|',
    ...cases.map(c => `| ${c.case.id}${c.text === null ? ' (no text)' : ''} | | | | | | |`),
    '',
    '## B. Spoken Oracle (per case × voice)',
    '',
    'Status, verbatim, first-audio latency, duration and speaking rate are filled in by the kit. A take',
    'that is disqualified (technical or fidelity) cannot be approved whatever it sounds like.',
    '',
    `| Case | Voice | Status | Verbatim | First audio (ms) | Duration (s) | Rate (wpm) | Clarity | Warmth | Gravitas | Pronunciation | Emotional restraint | Consistency | ${MANDATORY_COLUMNS[0]} | ${MANDATORY_COLUMNS[1]} | Notes |`,
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...takes.map(t => {
      const verbatim =
        t.fidelity === null
          ? '–'
          : t.fidelity.verbatim
            ? 'yes'
            : `**no** (WER ${t.fidelity.wordErrorRate.toFixed(2)})`;
      const status = t.disqualified
        ? `**${t.status}** (disqualified: ${t.disqualified})`
        : t.status;
      const rate =
        t.wordsPerMinute === null
          ? '–'
          : `${t.wordsPerMinute.toFixed(0)}${t.reviewFlags.includes('speaking-rate') ? ' ⚑' : ''}`;
      const hasAudio = t.audioFile !== null;
      const pauses = hasAudio ? REQUIRED : '–';
      const lang = language.get(t.caseId);
      const pron = !hasAudio ? '–' : lang === 'ur' || lang === 'hi' ? REQUIRED : NOT_APPLICABLE;
      return `| ${t.caseId} | ${t.voice} | ${status} | ${verbatim} | ${t.firstAudioMs ?? '–'} | ${
        t.audioSeconds?.toFixed(1) ?? '–'
      } | ${rate} | | | | | | | ${pauses} | ${pron} | |`;
    }),
    '',
  );
  return out.join('\n');
}

/**
 * Check a scorecard a listener has filled in: every mandatory cell must hold
 * a whole-number score from 1 to 10. Returns the cells still missing or
 * invalid, as "case × voice: column".
 */
export function checkScorecard(markdown: string): {
  readonly complete: boolean;
  readonly missing: readonly string[];
  readonly invalid: readonly string[];
} {
  const lines = markdown.split('\n');
  const headerAt = lines.findIndex(l => l.includes(`| ${MANDATORY_COLUMNS[0]} |`));
  if (headerAt === -1) {
    return { complete: false, missing: ['scorecard section B not found'], invalid: [] };
  }
  const cells = (l: string) =>
    l
      .split('|')
      .slice(1, -1)
      .map(c => c.trim());
  const header = cells(lines[headerAt]!);
  const cols = MANDATORY_COLUMNS.map(name => header.indexOf(name));
  const missing: string[] = [];
  const invalid: string[] = [];
  let takesWithAudio = 0;
  for (const line of lines.slice(headerAt + 2)) {
    if (!line.startsWith('|')) {
      break;
    }
    const row = cells(line);
    if ((row[cols[0]!] ?? '–') !== '–') {
      takesWithAudio += 1;
    }
    cols.forEach((col, i) => {
      const value = row[col] ?? '';
      const where = `${row[0]} × ${row[1]}: ${MANDATORY_COLUMNS[i]}`;
      // The kit writes REQUIRED, NOT_APPLICABLE or '–' here, never an empty
      // cell — so an empty cell is a required score that was cleared.
      if (value === REQUIRED || value === '') {
        missing.push(where);
      } else if (value !== NOT_APPLICABLE && value !== '–' && !/^(10|[1-9])$/.test(value)) {
        invalid.push(`${where} = "${value}"`);
      }
    });
  }
  // A sheet with no audio (a stub run, or every take failed) has nothing to
  // approve — never "complete".
  if (takesWithAudio === 0) {
    missing.push('no takes with audio — nothing to approve');
  }
  return { complete: missing.length === 0 && invalid.length === 0, missing, invalid };
}
