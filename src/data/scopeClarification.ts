/**
 * scopeClarification.ts — is this text a question ABOUT a refusal?
 * --------------------------------------------------------------------------
 * After the Oracle declines an out-of-scope question (askWatchOracle,
 * reason 'out_of_scope') the thread holds no reading. A follow-up such as
 * "Why not of others?" is then the seeker asking about the refusal, not
 * putting a new matter to the chart — casting for it would spend a quota slot
 * on a verdict nobody asked for. Such text is answered with the fixed scope
 * explanation instead. No judgment is made or invented here: the client only
 * decides which fixed text to show, and anything that is not unmistakably a
 * question about the refusal goes through the Oracle as before.
 *
 * Deliberately narrow, like the server gate: "Why is everything going wrong?"
 * is a real question and must reach the chart.
 */

const NON_LATIN_SCRIPT = /[\p{Script=Arabic}\p{Script=Devanagari}]/u;

const CLARIFICATION =
  /^(?:but\s+|and\s+|so\s+)?(?:why\s+(?:not|only|can'?t|won'?t|don'?t|do\s+you\s+(?:not|refuse|decline)|did\s+you\s+(?:refuse|decline))|how\s+come|what\s+do\s+you\s+mean|what\s+does\s+that\s+mean|can'?t\s+you|can\s+you\s+not|you\s+can'?t|so\s+you\s+can'?t)\b/i;

const MAX_LENGTH = 80;

export function isScopeClarification(text: string): boolean {
  const q = text.trim().replace(/\s+/g, ' ');
  if (q.length === 0 || q.length > MAX_LENGTH || NON_LATIN_SCRIPT.test(q)) {
    return false;
  }
  return CLARIFICATION.test(q);
}
