/**
 * questionScope.ts — is this a question the Oracle should cast a chart for?
 * --------------------------------------------------------------------------
 * Owner decision 2026-10-14: a request that is not about the seeker's own
 * life ("Name two cat breeds", "What is the capital of France?") is gently
 * declined instead of being judged. Before this, such text fell through to
 * the 'general' question type and received a full reading on the 1st Ghar.
 *
 * This is a gate in front of the engine, never a judgment: it decides only
 * whether to cast, and adds nothing to any reading it lets through.
 *
 * Deliberately narrow — a false refusal of a real seeker is worse than a
 * reading cast for trivia (the repo already carries fixes for false
 * rejections in the follow-up path). A question is declined only when ALL
 * of these hold:
 *   1. it matched no question type (classifyQuestion → 'general');
 *   2. it is written in Latin script — Urdu and Hindi questions always pass,
 *      since the patterns below are English;
 *   3. it names no person at all — no I / my / we / he / she / they, no
 *      family member, no friend — and no matter of a life (future, luck,
 *      marriage, job…): "What is babloo's future?" asks about someone's life
 *      even though the name is not a pronoun (owner decision 2026-10-20);
 *   4. it opens like a request for information or a task ("name", "list",
 *      "what is", "who was", "how many", "translate", "tell me a …"), or it
 *      is nothing but a greeting.
 * Anything that opens like a horary question ("Will…", "Should…", "When
 * will…", "Is it…") passes, whoever it names.
 */

import type { QuestionType } from '../engine/kp/rules/houseMatrix';

/** Any letter in a non-Latin script this app supports. */
const NON_LATIN_SCRIPT = /[\p{Script=Arabic}\p{Script=Devanagari}]/u;

/** A person — the seeker or anyone in their life. */
const PERSONAL_REFERENCE =
  /\b(?:i|i'm|im|i've|i'll|me|my|mine|myself|we|us|our|ours|he|she|him|her|his|hers|they|them|their|someone|somebody|anyone|mother|mom|mum|ammi|father|dad|abbu|brother|sister|son|daughter|wife|husband|friend|boyfriend|girlfriend|family|boss|ex)\b/i;

/**
 * A matter of someone's life. A named third party ("babloo") is not caught by
 * PERSONAL_REFERENCE, so without this "What is babloo future" read as trivia.
 */
const LIFE_MATTER =
  /\b(?:future|fate|luck|destiny|fortune|career|job|marriage|wedding|health|business|money|wealth|love|life|relationship|success|children|baby|exam|visa|court|case)\b/i;

/** "tell me …" / "give me …" / "show me …" — the "me" is the request, not the subject. */
const REQUEST_PREFIX = /^(?:please\s+)?(?:tell|give|show)\s+me\b/i;

/** Openings that ask for a fact or a task, not about a matter in one's life. */
const INFORMATION_REQUEST = new RegExp(
  '^(?:please\\s+)?(?:' +
    [
      'name',
      'list',
      'define',
      'explain',
      'describe',
      'translate',
      'calculate',
      'convert',
      'solve',
      'spell',
      'write',
      'summari[sz]e',
      'recommend',
      '(?:tell|give|show)\\s+me',
      "what(?:'s|s|\\s+is|\\s+are|\\s+was|\\s+were)",
      "who(?:'s|\\s+is|\\s+are|\\s+was|\\s+were|\\s+won|\\s+invented|\\s+wrote|\\s+discovered|\\s+made)",
      'which\\s+(?:is|are|was|were)',
      'how\\s+(?:many|much|to)',
      'how\\s+(?:do|does)\\s+(?:a|an|the|you)',
      'when\\s+(?:was|did)',
    ].join('|') +
    ')\\b',
  'i',
);

/** The whole message is a greeting and nothing else. */
const GREETING_ONLY =
  /^(?:hi+|hello+|hey+|salam|salaam|assalam(?:\s*[ou])?\s*alaikum|as-salamu\s+alaykum|namaste|good\s+(?:morning|evening|afternoon|night))[\s!.,?]*$/i;

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * True when the Oracle should decline to cast for this text.
 * Exported for direct testing; see the file header for the exact rule.
 */
export function isOutOfScopeQuestion(text: string, qType: QuestionType): boolean {
  if (qType !== 'general') {
    return false;
  }
  const q = normalize(text);
  if (q.length === 0 || NON_LATIN_SCRIPT.test(q)) {
    return false;
  }
  if (GREETING_ONLY.test(q)) {
    return true;
  }
  if (!INFORMATION_REQUEST.test(q)) {
    return false;
  }
  const subject = q.replace(REQUEST_PREFIX, ' ');
  return !PERSONAL_REFERENCE.test(subject) && !LIFE_MATTER.test(subject);
}
