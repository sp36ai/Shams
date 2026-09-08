/**
 * textSecurity.ts — PHASE 5C-R. The single canonical text-normalization
 * primitive for narrationValidator.ts's internal matching.
 * --------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * Phase 5C's 10,435-case generative/metamorphic fuzzing harness
 * (functions/scripts/adversarial-harness/, docs/audit/PHASE_5C_REPORT.md)
 * proved four related false-negative classes: a zero-width joiner/
 * non-joiner/space, a fullwidth Unicode form, or a combining diacritic
 * mark inserted INSIDE a security-relevant word (a timing-immediacy
 * phrase, a certainty phrase, a prohibited term, a planet name) defeats
 * every check's literal `.includes()`/regex matching, while the text still
 * reads as the identical word to a human. A distinct, narrower fifth gap:
 * the one multi-word deny-list entry ("house matrix") fails to match once
 * its internal single space becomes a double space or a tab.
 *
 * WHAT THIS FUNCTION DOES
 *
 *   1. NFKD decompose — splits any precomposed accented character (e.g.
 *      "ú", U+00FA) into its base letter + combining mark(s), AND converts
 *      Unicode compatibility forms (fullwidth Latin, etc.) to their
 *      ordinary equivalents. Decomposing BEFORE stripping marks is load-
 *      bearing: composing first (NFKC) would leave a legitimately-typed
 *      "ú" untouched by a later "strip combining marks" pass, since a
 *      precomposed character carries no separate Mn codepoint to strip —
 *      confirmed empirically during this phase's reconnaissance before
 *      writing this function (see PHASE_5C_R_REMEDIATION.md).
 *   2. Strips every Unicode "Mn" (Nonspacing_Mark) codepoint — combining
 *      diacritics and variation selectors, whether they arrived already
 *      decomposed or were just produced by step 1.
 *   3. Strips every Unicode "Cf" (Format) codepoint — zero-width joiner/
 *      non-joiner/space, word joiner, and bidi control characters (LRM,
 *      RLM, embedding/override/isolate controls). None of these has any
 *      legitimate role inside a single word in this application's prose.
 *   4. Collapses any run of whitespace (space, tab, newline, ...) to a
 *      single space, and trims. This is the fix for the "house matrix"
 *      double-space/tab gap — unrelated to Unicode obfuscation, but the
 *      same "make literal matching robust to incidental formatting"
 *      motivation.
 *
 * WHAT THIS FUNCTION DELIBERATELY DOES NOT DO
 *
 * It does NOT fold homoglyphs/confusables (e.g. Cyrillic "о" U+043E is
 * never turned into Latin "o" U+006F) and does NOT correct repeated-
 * character padding ("tommorrow") or ASCII punctuation inserted mid-word
 * ("guarant.eed"). Phase 5C-R's reconnaissance confirmed these ARE
 * separate, real bypasses of the current checks — but they are a
 * different mechanism (cross-script substitution / plain ASCII text
 * mangling, not a Unicode category this function's job is to strip), and
 * "do not blindly convert arbitrary Cyrillic/Greek characters into Latin
 * merely to improve detection" was an explicit, deliberate instruction for
 * this phase. They are recorded as open findings in
 * docs/audit/PHASE_5C_R_REMEDIATION.md, not silently folded into this
 * primitive's scope.
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
 * either would make this an implicit content-rewriting layer, which is
 * exactly what this phase was told not to build. Confirmed by
 * narrationValidatorUnicodeSecurity.test.ts's own dedicated
 * non-mutation proof: the `narration` object and `contract` object
 * `validateNarration()` receives are both byte-identical before and after
 * the call.
 */

export function canonicalizeForSecurityMatching(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .replace(/\p{Cf}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
