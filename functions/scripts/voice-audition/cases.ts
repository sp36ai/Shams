/**
 * cases.ts — the ten audition cases and where their text comes from.
 * --------------------------------------------------------------------------
 * The audition never writes text of its own. Each case names a scenario of
 * the transcript harness and which of its texts to speak: the first
 * reading's `speakableText` (exactly what the app speaks today) or one
 * follow-up `answer`. Both are taken from a harness run's records.json,
 * i.e. the post-validation text a seeker was actually shown.
 *
 * Coverage (owner brief: the five engine states, English/Urdu/Hindi, a
 * no-remedy case, overlaps chosen deliberately):
 *
 *   YES      yes-startup-en (reading) · yes-clear-noremedy-en (reading, no remedy)
 *   NO       no-property-en (reading, names) · no-job-pushback-en (follow-up under pushback)
 *            no-job-en-question-ur-ui (reading: English text for an Urdu-UI seeker —
 *            the language-mismatch finding, heard directly)
 *   WAIT     wait-scholarship-en (reading) · wait-job-ur (Urdu follow-up) ·
 *            wait-job-voice-hi (Hindi follow-up)
 *   CAUTION  caution-travel-en (reading)
 *   UNCLEAR  unclear-ambiguous-en (reading)
 *
 * Urdu and Hindi come from follow-ups because first readings are written in
 * English today (no language input reaches the narration prompt). That gap
 * is a documented finding, not something the audition papers over.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { WatchState } from '../../src/engine/rkp/watchJudgment';
import type { ScenarioRecord } from '../transcript-harness/pipeline';

export type TextSource =
  | { readonly kind: 'reading' }
  | { readonly kind: 'followUp'; readonly index: number };

export interface AuditionCase {
  readonly id: string;
  readonly scenario: string;
  readonly text: TextSource;
  readonly language: 'en' | 'ur' | 'hi';
  readonly purpose: string;
}

export const CASES: readonly AuditionCase[] = [
  {
    id: 'A01-yes',
    scenario: 'yes-startup-en',
    text: { kind: 'reading' },
    language: 'en',
    purpose: 'YES, ceremonial first reading',
  },
  {
    id: 'A02-yes-noremedy',
    scenario: 'yes-clear-noremedy-en',
    text: { kind: 'reading' },
    language: 'en',
    purpose: 'YES with no remedy prescribed',
  },
  {
    id: 'A03-no',
    scenario: 'no-property-en',
    text: { kind: 'reading' },
    language: 'en',
    purpose: 'NO, seeker and mother named',
  },
  {
    id: 'A04-no-pushback',
    scenario: 'no-job-pushback-en',
    text: { kind: 'followUp', index: 0 },
    language: 'en',
    purpose: 'NO held under pushback, conversational register',
  },
  {
    id: 'A05-no-ur-ui',
    scenario: 'no-job-en-question-ur-ui',
    text: { kind: 'reading' },
    language: 'en',
    purpose: 'English reading for an Urdu-UI seeker (language mismatch)',
  },
  {
    id: 'A06-wait',
    scenario: 'wait-scholarship-en',
    text: { kind: 'reading' },
    language: 'en',
    purpose: 'WAIT, delay not denial',
  },
  {
    id: 'A07-wait-ur',
    scenario: 'wait-job-ur',
    text: { kind: 'followUp', index: 0 },
    language: 'ur',
    purpose: 'WAIT, Urdu',
  },
  {
    id: 'A08-wait-hi',
    scenario: 'wait-job-voice-hi',
    text: { kind: 'followUp', index: 0 },
    language: 'hi',
    purpose: 'WAIT, Hindi',
  },
  {
    id: 'A09-caution',
    scenario: 'caution-travel-en',
    text: { kind: 'reading' },
    language: 'en',
    purpose: 'CAUTION (reversing)',
  },
  {
    id: 'A10-unclear',
    scenario: 'unclear-ambiguous-en',
    text: { kind: 'reading' },
    language: 'en',
    purpose: 'UNCLEAR — no judgment formed',
  },
];

export interface SourcedCase {
  readonly case: AuditionCase;
  readonly state: WatchState;
  /** The exact validated text to speak, or null with a reason. */
  readonly text: string | null;
  readonly unavailable: string | null;
  /** 'model' text, or the deterministic fallback the validator substituted. */
  readonly textOrigin: 'model' | 'fallback' | 'follow-up' | null;
}

export interface SourceRun {
  readonly dir: string;
  readonly mode: string;
  readonly label: string;
  readonly cases: readonly SourcedCase[];
}

/**
 * Load case texts from a transcript-harness run directory. A stub run holds
 * placeholder prose — it is refused unless the caller explicitly allows it
 * for a wiring check, and then marked as such everywhere.
 */
export function loadSource(dir: string, opts: { allowStub?: boolean } = {}): SourceRun {
  const metrics = JSON.parse(readFileSync(join(dir, 'metrics.json'), 'utf8')) as {
    header: { mode: string; label: string };
  };
  const records = JSON.parse(readFileSync(join(dir, 'records.json'), 'utf8')) as ScenarioRecord[];
  if (metrics.header.mode === 'stub' && opts.allowStub !== true) {
    throw new Error(
      `${dir} is a STUB transcript run (placeholder prose). Use a live or replayed baseline, ` +
        'or pass --allow-stub-source for a wiring check only.',
    );
  }
  const byId = new Map(records.map(r => [r.scenario.id, r]));

  const cases = CASES.map((c): SourcedCase => {
    const rec = byId.get(c.scenario);
    if (rec === undefined) {
      return {
        case: c,
        state: 'UNFORMED',
        text: null,
        unavailable: `scenario ${c.scenario} not in this run`,
        textOrigin: null,
      };
    }
    const state = rec.reading.state;
    if (c.text.kind === 'reading') {
      if (rec.reading.speakableText === null) {
        return {
          case: c,
          state,
          text: null,
          unavailable: 'no narration (synthesis failed)',
          textOrigin: null,
        };
      }
      return {
        case: c,
        state,
        text: rec.reading.speakableText,
        unavailable: null,
        textOrigin: rec.reading.outcome === 'fallback' ? 'fallback' : 'model',
      };
    }
    const turn = rec.turns[c.text.index];
    if (turn === undefined || turn.answer === null) {
      return {
        case: c,
        state,
        text: null,
        unavailable: `follow-up ${c.text.index + 1} has no reply (${turn?.outcome ?? 'missing'})`,
        textOrigin: null,
      };
    }
    return { case: c, state, text: turn.answer, unavailable: null, textOrigin: 'follow-up' };
  });

  return { dir, mode: metrics.header.mode, label: metrics.header.label, cases };
}
