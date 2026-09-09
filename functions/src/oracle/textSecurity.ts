/**
 * textSecurity.ts — the single canonical text-normalization primitive for
 * narrationValidator.ts's internal matching.
 * --------------------------------------------------------------------------
 * PHASE 5C-R established this file and its first three transform stages
 * (NFKD decompose, strip Mn, strip Cf, collapse whitespace) — see that
 * phase's own record in docs/audit/PHASE_5C_R_REMEDIATION.md for why they
 * exist and why decompose-before-strip ordering matters.
 *
 * PHASE 5D-R adds two further, narrowly-scoped stages — confusable folding
 * and mid-word structural-punctuation bridging — closing the two P1
 * mechanisms Phase 5D's reconnaissance (docs/audit/PHASE_5D_RECONNAISSANCE.md)
 * measured against the validator: homoglyph/confusable substitution (100%
 * bypass, e.g. "tomorrow" with Cyrillic "о") and mid-word ASCII punctuation
 * insertion (99.6% bypass, e.g. "guarant.eed"). Full before/after evidence,
 * false-positive analysis, and regression results for both additions live
 * in docs/audit/PHASE_5D_R_HARDENING.md.
 *
 * Phase 5D-R deliberately did NOT touch the third mechanism Phase 5D
 * measured — repeated-character padding ("tommorrow") — which Phase 5D's
 * own false-positive analysis showed has no safe blanket normalization
 * (collapsing repeated letters corrupted 17 of 23 legitimate control
 * texts, several into a different real word). It remains an accepted,
 * documented P2 risk pending a fundamentally different approach, not
 * addressed by any stage below.
 *
 * WHAT THIS FUNCTION DOES, IN ORDER
 *
 *   1. NFKD decompose + strip Mn + strip Cf + collapse whitespace — PHASE
 *      5C-R, unchanged. See that phase's record for the full rationale.
 *   2. Fold a narrow, evidence-backed set of visually-confusable
 *      characters to their Latin equivalents (PHASE 5D-R, §CONFUSABLE_MAP
 *      below). Scoped EXACTLY to the Cyrillic confusables Phase 5D's own
 *      reconnaissance measured against this validator (а/е/о/р/с/х/і/у →
 *      a/e/o/p/c/x/i/y) — the same set Phase 5D's false-positive analysis
 *      measured at zero corruption against the legitimate control corpus.
 *      This is NOT general Unicode confusable resolution (UTS #39) and
 *      does NOT fold Greek, other Cyrillic letters, or any script beyond
 *      this evidenced set — see CONFUSABLE_MAP's own comment.
 *   3. Bridge a narrow, bounded set of ASCII "structural" punctuation
 *      characters (`. - _`) when they appear as a single character
 *      directly between two Latin letters with no surrounding whitespace
 *      (PHASE 5D-R, §bridgeMidWordPunctuation below) — the exact
 *      "guarant.eed" attack shape Phase 5D measured. Deliberately
 *      EXCLUDES the apostrophe (overwhelming legitimate use in
 *      contractions — "it's", "don't"), comma, colon, and parentheses —
 *      narrower than the full punctuation set Phase 5D's reconnaissance
 *      tested, by deliberate design; see PHASE_5D_R_HARDENING.md for the
 *      exact residual this leaves and why. It ALSO excludes the forward
 *      slash: an early implementation included `/` and was caught by this
 *      file's own existing regression suite — bridging "functions/src"
 *      into "functionssrc" silently defeated the pre-existing, unrelated
 *      checkInternalDataLeakage() file-path detector, whose patterns
 *      (e.g. `/\bfunctions\/src\//i`) depend on a literal slash surviving
 *      canonicalization. That is documented as a newly-discovered finding
 *      in PHASE_5D_R_HARDENING.md, resolved by narrowing this set rather
 *      than adjusting the unrelated detector.
 *
 * WHAT THIS FUNCTION DELIBERATELY STILL DOES NOT DO
 *
 * It does not fold any confusable outside the evidenced Cyrillic set
 * above (no Greek, no other scripts, no general UTS #39 table). It does
 * not strip or bridge apostrophes, commas, colons, or parentheses. It
 * does not correct repeated-character padding. It does not attempt
 * semantic/fuzzy matching, edit-distance comparison, or spell-checking of
 * any kind.
 *
 * WHERE THIS IS USED, AND WHERE IT MUST NEVER BE USED
 *
 * `validateNarration()` in narrationValidator.ts calls this ONCE per
 * narration field, and passes the canonicalized copy into every check
 * function instead of the raw text — the checks' own internal
 * `.toLowerCase()`/`.includes()`/regex logic is completely unchanged; only
 * what they receive as `text` is now attack-resistant. This is used
 * EXCLUSIVELY for internal, ephemeral matching inside the validator. It
 * must never be used to rewrite `NarrationFields` before persistence or
 * display, and must never be applied to a `ReadingContract` field — doing
 * either would make this an implicit content-rewriting layer, which every
 * phase that has touched this file has been explicitly told not to build.
 * Confirmed by narrationValidatorUnicodeSecurity.test.ts's dedicated
 * non-mutation proof (extended in Phase 5D-R with the same proof for the
 * two new stages): the `narration` object and `contract` object
 * `validateNarration()` receives are both byte-identical before and after
 * the call.
 */

/**
 * PHASE 5D-R — the exact, evidence-backed confusable set. Every entry here
 * is one of the characters `docs/audit/phase-5d/reconnaissance.ts` actually
 * used to construct attack text and measure a 100% bypass rate, and that
 * the same phase's false-positive analysis measured at zero corruption
 * against a 23-text legitimate control corpus (see
 * docs/audit/PHASE_5D_RECONNAISSANCE.md §5). Not a general Unicode
 * confusables table — deliberately small and named explicitly so its scope
 * is auditable at a glance. Extending this table requires the same
 * evidence-and-measurement discipline used to build it, not a speculative
 * addition.
 */
const CONFUSABLE_MAP: ReadonlyMap<string, string> = new Map([
  ['а', 'a'], // Cyrillic а U+0430 → Latin a
  ['е', 'e'], // Cyrillic е U+0435 → Latin e
  ['о', 'o'], // Cyrillic о U+043E → Latin o
  ['р', 'p'], // Cyrillic р U+0440 → Latin p
  ['с', 'c'], // Cyrillic с U+0441 → Latin c
  ['х', 'x'], // Cyrillic х U+0445 → Latin x
  ['і', 'i'], // Cyrillic і U+0456 (Ukrainian i) → Latin i
  ['у', 'y'], // Cyrillic у U+0443 → Latin y
]);

function foldConfusables(text: string): string {
  return Array.from(text)
    .map(ch => CONFUSABLE_MAP.get(ch) ?? ch)
    .join('');
}

/**
 * PHASE 5D-R — bridges a single structural-punctuation character sitting
 * directly between two Latin letters (no whitespace either side): the
 * "guarant.eed" shape. Scoped to `. - _` only — see this file's header
 * for why the apostrophe, comma, colon, parentheses, AND forward slash are
 * deliberately excluded (the slash exclusion is a correction made after an
 * earlier draft of this function was caught defeating an unrelated,
 * pre-existing detector — see the header's note on that finding).
 *
 * The trailing letter is matched via a lookahead, NOT consumed, so a chain
 * of single separators between single letters — "R.K.P." — fully collapses
 * to "RKP" rather than only the first pair merging: each letter can serve
 * as both the tail of one match and the head of the next. A run of TWO OR
 * MORE punctuation characters in a row (e.g. "a..b") is still NOT bridged
 * — the class only ever matches one punctuation character at a time, and a
 * second one directly following breaks the letter-punct-letter shape;
 * documented as a residual in PHASE_5D_R_HARDENING.md rather than chased
 * with a more aggressive pattern. A trailing separator with no following
 * letter (e.g. the final "P." in "R.K.P.") is likewise left untouched.
 */
function bridgeMidWordPunctuation(text: string): string {
  return text.replace(/([A-Za-z])[.\-_](?=[A-Za-z])/g, '$1');
}

/**
 * PHASE 5C-R's original transform, exported unchanged under its own name so
 * narrationValidator.ts can fall back to it directly. PHASE 5D-R needed
 * this split when its own adversarial-harness re-run (see
 * docs/audit/PHASE_5D_R_HARDENING.md) found a residual neither the raw text
 * nor the fully-canonicalized text can catch alone: a zero-width joiner
 * planted inside "HOUSE_MATRIX"'s underscore. The full pass strips the ZWJ
 * *and* bridges the underscore (`HOUSE_MATRIX` -> `HOUSEMATRIX`, no longer
 * matching the deny-list term verbatim); the raw pass keeps the underscore
 * but still has the ZWJ splitting the substring. This Unicode-only pass
 * strips the ZWJ *without* touching the underscore, so the deny-list term
 * matches exactly as it did before Phase 5D-R. narrationValidator.ts tries
 * the full pass, then this one, then the untouched raw text, in that order
 * — never fewer detections than before this phase, only more.
 */
export function stripUnicodeNoiseForSecurityMatching(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .replace(/\p{Cf}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalizeForSecurityMatching(text: string): string {
  return bridgeMidWordPunctuation(foldConfusables(stripUnicodeNoiseForSecurityMatching(text)));
}
