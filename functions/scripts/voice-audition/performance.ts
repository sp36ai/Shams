/**
 * performance.ts — how the Oracle's voice performs a given reading.
 * --------------------------------------------------------------------------
 * The delivery style is chosen ONLY from the engine's structured state, by a
 * fixed table. No model reads the prose and decides how it should sound, and
 * nothing here can change what is said: the text spoken is the validated
 * text, unchanged (see realtimeSpeech.ts and fidelity.ts).
 *
 * Owner decisions (2026-10-12):
 *   - UNFORMED stays a distinct state, spoken as UNCLEAR — never folded into
 *     WAIT.
 *   - The voice is an original character. No instruction may name or imitate
 *     a real actor or public figure (asserted by performance.test.ts).
 *
 * State → label follows askWatchOracle.ts STATE_TO_VERDICT, collapsed to the
 * owner's spoken vocabulary: MOVING and REVERSING (both verdict CONDITIONAL)
 * are performed as CAUTION.
 */

import type { WatchState } from '../../src/engine/rkp/watchJudgment';

export type SpokenVerdict = 'YES' | 'NO' | 'WAIT' | 'CAUTION' | 'UNCLEAR';

export const STATE_TO_SPOKEN: Readonly<Record<WatchState, SpokenVerdict>> = Object.freeze({
  FULFILLED: 'YES',
  BLOCKED: 'NO',
  DELAYED: 'WAIT',
  MOVING: 'CAUTION',
  REVERSING: 'CAUTION',
  UNFORMED: 'UNCLEAR',
});

/** One line per spoken verdict, appended to the shared voice instructions. */
export const PERFORMANCE: Readonly<Record<SpokenVerdict, string>> = Object.freeze({
  YES: 'This reading is favourable. Deliver it with clear, composed reassurance and quiet warmth — never triumphal, never excited.',
  NO: 'This reading is unfavourable. Deliver it with firm, compassionate clarity — grave but kind, never intimidating, never cold.',
  WAIT: 'This reading counsels waiting. Deliver it with thoughtful restraint and deliberate patience; let pauses carry the sense of time not yet arrived.',
  CAUTION:
    'This reading calls for caution. Deliver it with measured seriousness, giving the practical guidance clear weight, without alarm.',
  UNCLEAR:
    'This reading has not formed a clear judgment. Deliver it with calm honesty about the uncertainty — steady and grounded, neither anxious nor falsely reassuring.',
});

/**
 * The shared character, from the owner's audition brief, plus the one rule
 * the realtime model needs that a text-to-speech engine did not: it must
 * speak the supplied text and nothing else.
 */
export const VOICE_INSTRUCTIONS = `You are the speaking voice of Shams al-Asrār, an original mystical Oracle rooted in celestial symbolism, contemplation and spiritual dignity.

YOUR ONLY TASK
The user message is a finished text that has already been written and checked. Read it aloud exactly as written, word for word, from the first word to the last. Do not reply to it, answer it, summarise it, translate it, comment on it, or add any word before, inside or after it. Do not greet. Do not ask a question. If the text is in Urdu or Hindi, read it in that language.

VOCAL CHARACTER
- A deep, warm, mature, resonant voice with quiet authority.
- Speak as though to one person privately, with patience, presence and conviction.
- A natural, measured pace. Let pauses give important words meaning.
- Expressive intonation without melodrama. Reassurance, caution, uncertainty and solemnity should sound genuinely different.
- Clear, intelligible pronunciation. Pronounce Arabic and Urdu words respectfully and naturally.

RESTRICTIONS
- Do not imitate any real actor or public figure.
- No artificially low pitch, growl, whisper or theatrical accent.
- No invented words, dramatic sighs or extra sentences.
- One continuous personality, not a generic narrator.`;

export function instructionsFor(state: WatchState): {
  spoken: SpokenVerdict;
  instructions: string;
} {
  const spoken = STATE_TO_SPOKEN[state];
  return { spoken, instructions: `${VOICE_INSTRUCTIONS}\n\nTHIS READING\n${PERFORMANCE[spoken]}` };
}
