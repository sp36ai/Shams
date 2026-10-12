/**
 * fidelity.ts — did the voice say exactly the validated text?
 * --------------------------------------------------------------------------
 * The realtime model is a conversational model, not a text reader: OpenAI
 * documents no verbatim-reading mode for it. So every take is checked by
 * comparing the transcript the Realtime API returns for its own spoken
 * audio (`response.output_audio_transcript.*`) against the source text.
 *
 * The comparison is word-level after normalisation (case, punctuation,
 * whitespace, Unicode form). Any inserted, dropped or changed word fails the
 * take: one authoritative text is a hard rule, not a quality score.
 *
 * Limitation, stated in every report: the transcript is the provider's own
 * account of its audio. A human listener still confirms fidelity during
 * review.
 */

export function normaliseWords(text: string): string[] {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, '') // Arabic-script diacritics vary in transcripts
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

export interface Fidelity {
  readonly verbatim: boolean;
  readonly sourceWords: number;
  readonly spokenWords: number;
  /** Word-level edit distance (insertions + deletions + substitutions). */
  readonly edits: number;
  /** edits / sourceWords — 0 is verbatim. */
  readonly wordErrorRate: number;
  /** First point of divergence, for the reviewer. Words only, short. */
  readonly firstDivergence: {
    readonly at: number;
    readonly expected: string;
    readonly heard: string;
  } | null;
}

export function compare(source: string, spoken: string): Fidelity {
  const a = normaliseWords(source);
  const b = normaliseWords(spoken);
  // Levenshtein over words, two rows.
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  const edits = prev[b.length]!;
  let firstDivergence: Fidelity['firstDivergence'] = null;
  const n = Math.max(a.length, b.length);
  for (let k = 0; k < n; k += 1) {
    if (a[k] !== b[k]) {
      firstDivergence = {
        at: k,
        expected: a.slice(k, k + 4).join(' ') || '(end)',
        heard: b.slice(k, k + 4).join(' ') || '(end)',
      };
      break;
    }
  }
  return {
    verbatim: edits === 0,
    sourceWords: a.length,
    spokenWords: b.length,
    edits,
    wordErrorRate: a.length === 0 ? (b.length === 0 ? 0 : 1) : edits / a.length,
    firstDivergence,
  };
}
