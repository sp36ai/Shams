/**
 * readingTitle — the short name a Reading is recognised by.
 * --------------------------------------------------------------------------
 * A Reading needs a handle the seeker can pick out of a list weeks later.
 * "Should I accept this business opportunity?" is the question; "Business
 * opportunity" is the title.
 *
 * Derived on the device, deterministically, from the seeker's own words. That
 * is a deliberate choice over a model call:
 *
 *   - a title is needed the instant the Reading is created, before the chart
 *     has even been cast, so the list is never populated with "New Reading";
 *   - it must exist offline and when synthesis fails;
 *   - it costs nothing and cannot hallucinate a subject the seeker did not
 *     name — this function only ever removes words, never invents them.
 *
 * The rules are English-first but degrade honestly: for Urdu or Hindi input
 * nothing matches the stop lists, so the result is simply the first few words
 * of the question, which is still a usable handle. Nothing here parses meaning
 * or classifies a domain — that is the engine's job, not a list label's.
 */

/**
 * Openers that carry no subject. Stripped from the front, repeatedly, so
 * "should i accept…" and "do you think i should accept…" both reach "accept".
 */
const LEADING_STOPWORDS: ReadonlySet<string> = new Set([
  'should',
  'shall',
  'will',
  'would',
  'could',
  'can',
  'do',
  'does',
  'did',
  'is',
  'are',
  'am',
  'was',
  'were',
  'have',
  'has',
  'had',
  'i',
  'we',
  'my',
  'me',
  'you',
  'your',
  'he',
  'she',
  'they',
  'it',
  'the',
  'a',
  'an',
  'this',
  'that',
  'these',
  'those',
  'there',
  'if',
  'when',
  'what',
  'which',
  'who',
  'whom',
  'whose',
  'where',
  'why',
  'how',
  'please',
  'tell',
  'think',
  'know',
  'want',
  'need',
  'ask',
  'about',
  'regarding',
  'to',
  'be',
  'get',
  'go',
  'going',
  'ever',
  'really',
  'ya',
  'kya',
]);

/** Words never worth spending one of the title's few slots on. */
const FILLER: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'this',
  'that',
  'these',
  'those',
  'my',
  'our',
  'your',
  'his',
  'her',
  'their',
  'its',
  'of',
  'in',
  'on',
  'at',
  'for',
  'with',
  'from',
  'into',
  'and',
  'or',
  'but',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'am',
  'i',
  'we',
  'me',
  'us',
  'it',
  'to',
]);

const MAX_WORDS = 4;
const MAX_CHARS = 42;

/** Capitalise the first word only — a title, not a headline. */
function sentenceCase(words: readonly string[]): string {
  const [first, ...rest] = words;
  if (first === undefined) {
    return '';
  }
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

/**
 * A short, factual title for a Reading, derived from its question.
 *
 * Never returns an empty string: a question that survives none of the rules
 * (all stopwords, punctuation only) falls back to the trimmed question itself,
 * and only a genuinely empty question yields the caller's fallback.
 */
export function readingTitleFor(question: string, fallback = 'Reading'): string {
  const cleaned = question
    .replace(/\s+/g, ' ')
    .replace(/[?!.,;:"'`()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length === 0) {
    return fallback;
  }

  const words = cleaned.split(' ').filter(w => w.length > 0);

  // Strip meaningless openers, but never strip the question away entirely.
  let start = 0;
  while (start < words.length - 1) {
    const word = words[start];
    if (word === undefined || !LEADING_STOPWORDS.has(word.toLowerCase())) {
      break;
    }
    start += 1;
  }

  const body = words.slice(start);
  const kept: string[] = [];
  for (const word of body) {
    if (kept.length >= MAX_WORDS) {
      break;
    }
    // Filler is skipped mid-title, but a title cannot start with nothing:
    // the first surviving word is always taken as-is.
    if (kept.length > 0 && FILLER.has(word.toLowerCase())) {
      continue;
    }
    kept.push(word);
  }

  const title = sentenceCase(kept.length > 0 ? kept : body.slice(0, MAX_WORDS));
  if (title.length === 0) {
    return cleaned.slice(0, MAX_CHARS) || fallback;
  }
  return title.length > MAX_CHARS ? title.slice(0, MAX_CHARS).trimEnd() : title;
}
