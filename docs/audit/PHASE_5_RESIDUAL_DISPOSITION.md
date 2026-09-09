# Phase 5 — Residual Disposition Gate

A decision/documentation record only. No production code, test, or
existing audit document was modified in producing this file. This gate
answers one question for every residual carried forward across
5A–5I: **is there anything remaining that prevents Phase 5 from being
honestly closed?**

Each item below is classified into exactly one of three dispositions:

- **ACCEPT** — a deliberately accepted residual risk, with a rationale
  for why closing Phase 5 without fixing it is honest.
- **DEFER TO PHASE 6** — a valid concern, but one that belongs to
  Phase 6's own scope (production infrastructure verification) rather
  than Phase 5's (the oracle/adversarial-integrity layer).
- **REMEDIATE BEFORE PHASE 5 CLOSURE** — requires its own, separately
  authorized, narrowly scoped remediation phase before Phase 5 can
  close. This document does not perform that remediation; it only
  flags the need for it.

Audit-trail backfill (the missing 5B closure record, the missing 5C-R
dedicated review, the missing 5D-R closure record) is a separate,
already-identified bucket of work and is **not** dispositioned here —
it is documentation debt about how prior phases were recorded, not a
residual *risk* carried by the running system.

---

## 1. 5A — 8 P3 findings

**Finding:** Eight informational/robustness observations from the
Phase 5A reconnaissance (`docs/audit/PHASE_5A_REPORT.md` §K),
individually:

| # | Finding | Category |
|---|---|---|
| P5A-1 | Two unrelated functions share the name `classifyQuestion` (the deterministic KP-keyword matcher `askWatchOracle` actually uses, vs. an unrelated, separately deployed AI-based Cloud Function of the same name) | Documentation/audit debt |
| P5A-2 | The AI-based `classifyQuestion` callable is deployed but unreferenced by the app — a live, currently-dead attack/cost surface (spends `ANTHROPIC_API_KEY` budget) never wired to any judgment path | Architectural/product decision |
| P5A-3 | `seekerProfile` is accepted and transmitted but never read server-side — a dead field, not a vulnerability | Documentation/audit debt |
| P5A-4 | `sanitizeQuestion()` doesn't strip `<`/`>`/braces, unlike `sanitizeName()` — no live exploitation path found (no HTML-rendering context exists) | Accepted coverage boundary |
| P5A-5 | Zero-width/fullwidth characters inside a keyword defeat `classifyQuestion`'s matching, falling through to `'general'` — a matching false-negative, not a judgment bypass (classification only selects a house-matrix lookup) | Accepted coverage boundary |
| P5A-6 | `enforceRateLimit()` runs after Zod validation, so malformed payloads aren't rate-limited — still requires Auth + App Check regardless | Accepted coverage boundary |
| P5A-7 | `buildWatchChart()` doesn't reject a calendar-invalid, ISO-shaped date string — not reachable from user input in the current production path | Accepted coverage boundary (unreachable) |
| P5A-8 | A stale comment in `narrate()` misdescribes when post-generation validation runs | Documentation/audit debt |

**Severity:** P3 (informational) for all eight, as originally classified;
none reproduced as P0/P1/P2 by any later phase.

**Evidence:** `docs/audit/PHASE_5A_REPORT.md` §K, live-reproduced against
real source at the time (5A reconnaissance), never revisited since.

**Current protection:** None of these bear on the deterministic
judgment/narration-safety boundary Phase 5's later chains (5C–5I)
actually hardened — none is on the `ReadingContract` → narration →
validator → client path. P5A-4/5/6/7 each have an explicit "no live
exploitation path" or "not reachable" finding already recorded.

**Risk:** Low across all eight. P5A-2 (the dead AI-callable cost
surface) is the only one with a live, currently-exploitable dimension
(a valid, authenticated, App-Check-passing caller can spend API budget
on an unused function) — but it never touches judgment or narration
integrity.

**Disposition:**
- P5A-1, P5A-3, P5A-8 (naming collision, dead field, stale comment): **ACCEPT.** Pure documentation/audit debt; fixing them is a cleanup task with zero security value, not a Phase 5 closure blocker.
- P5A-4, P5A-5, P5A-6, P5A-7 (sanitizer asymmetry, Unicode keyword matching, rate-limit ordering, calendar-invalid date): **ACCEPT.** Each already carries its own "not reachable" or "no live exploitation path" finding from 5A itself; no later phase's own adversarial work (5C's 11,923-case harness included) ever demonstrated a live path through any of them.
- P5A-2 (dead AI-callable cost/attack surface): **DEFER TO PHASE 6.** This is a live infrastructure exposure (an unused, deployed Cloud Function consuming budget under valid auth), not a judgment or narration-integrity defect — it belongs with the Phase 6 objective ("Firebase/Functions... quotas... final forensic production audit"), where deployed-function inventory and cost-surface review are already in scope, not with Phase 5's oracle-integrity boundary.

**Rationale:** None of the eight bears on the specific boundary Phase 5
was scoped to hardened (deterministic judgment, contract provenance,
narration/TTS validation). Seven are pure documentation debt or
already-proven-unreachable; one (P5A-2) is a real but purely
infrastructure-shaped concern that Phase 6 is explicitly designed to
catch.

---

## 2. 5B — stale-document/comment P3 (P5B-3)

**Finding:** `docs/audit/PHASE_5B_REPORT.md` records five stale
doc-comments across the repository still pointing at a deleted module
(the old KP/astronomical judgment system, removed before this project's
audit trail begins).

**Severity:** P3.

**Evidence:** `PHASE_5B_REPORT.md` §… ("P5B-3… stale doc comments
reference a deleted module") — reproduced by direct grep at the time,
never revisited since.

**Current protection:** N/A — this is a comment-accuracy issue, not a
code-behavior issue. The deleted module itself was confirmed gone
(nothing imports it, nothing resurrects it) as part of this project's
own standing constraint against ever reintroducing KP judgment logic.

**Risk:** None to running behavior. The only risk is a future engineer
or auditor being misled by a comment that references dead
infrastructure — a maintainability concern, not a security one.

**Disposition: ACCEPT.**

**Rationale:** A stale comment carries zero runtime risk and does not
touch any judgment, contract, validation, or narration path. Fixing it
is legitimate cleanup, but it is not a defect that makes Phase 5's
closure dishonest.

---

## 3. Repeated-character padding — P2

**Finding:** Text with characters repeated (padded) inside a flagged
phrase bypasses `checkTerminologyLeakage`/similar deny-list checks in
141/372 (37.9%) of Phase 5D's own generated attack cases. Deferred at
5D reconnaissance, explicitly untouched by 5D-R (only confusable
substitution and mid-word ASCII punctuation were authorized for that
phase), reconfirmed still open and untouched at 5E-CLOSURE.

**Severity:** P2, as originally and consistently classified across
every phase that has touched it.

**Evidence:** `PHASE_5D_RECONNAISSANCE.md` §B: "141/372 bypass (37.9%)";
its own severity table explicitly notes the mechanism is "real and
reproducible, but structurally bounded (interior-position-only, 37.9%
overall) **and produces a visibly misspelled word to any human
reader** — a materially weaker practical threat than the other two"
(confusable substitution and punctuation insertion, both since closed).
That same reconnaissance recommended this residual for **Category D
(accepted, documented risk)** at the time it was first found — not
Category B (a bounded detector worth building) — specifically because
the reconnaissance's own testing showed the "obvious normalization"
fix (collapsing repeated characters) is itself unsafe (it can corrupt
legitimate repeated-letter content), and no safer detection design was
identified.

**Current protection:** None specific to repeated-character padding.
The three-tier canonicalization (confusable folding, mid-word
punctuation bridging, Unicode-noise stripping) does not collapse
repeated characters in any tier, by design — this is the one open
mechanism from the original three 5C-R-discovered bypasses.

**Risk:** Low-to-moderate in theory (37.9% bypass rate against a
generated attack corpus), but the reconnaissance's own finding that the
resulting text is "visibly misspelled" to a human reader materially
reduces real-world exploitability — a seeker reading garbled narration
prose is itself a strong, human-visible signal something is wrong,
independent of any automated check.

**Disposition: ACCEPT.**

**Rationale:** This residual has now been examined and reconfirmed at
three separate phases (5D reconnaissance, 5D-R, 5E-CLOSURE) without its
assessment changing: no safe fix design exists yet (the naive
normalization is demonstrably unsafe), and the practical threat is
self-limiting (the bypass text is visibly corrupted, not a clean
substitution like the confusable/punctuation classes that were fixed).
Continuing to defer it a fourth time without a new design idea would be
scope drift, not diligence — accepting it as documented residual risk,
consistent with the reconnaissance's own original recommendation, is
the honest disposition. This is not a Phase 6 concern either, since it
is squarely inside Phase 5's own validator architecture; it is a
genuine, accepted security residual against a specific attack class of
narrow practical severity.

---

## 4. Residual punctuation-insertion classes

**Finding:** `bridgeMidWordPunctuation()` (5D-R) only bridges exactly
`. - _` between two letters. Apostrophe, comma, colon, parenthesis, and
slash insertion were not included, and remain open bypass classes —
confirmed still open at the 5D-R independent Review Gate.

**Severity:** Originally part of the same P1 "ASCII punctuation
insertion" mechanism 5D reconnaissance found at 99.6% bypass overall;
the fixed subset (`. - _`) closed the large majority of that bypass
class. The narrower residual (the five excluded punctuation marks) has
not been independently re-measured for its own bypass rate.

**Evidence:** `PHASE_5D_R_REVIEW_GATE.md` §11: "apostrophe/comma/colon/
parenthesis/slash punctuation insertion... confirmed genuinely open,
not silently folded into this phase's closure." `PHASE_5D_R_HARDENING.md`
§ (unit-test section) explicitly tests that legitimate contractions
(`it's`, `don't`) and comma/colon/parenthesized prose are correctly
**not** bridged — i.e., the exclusion is a deliberate false-positive
guard, not an oversight: apostrophes, commas, colons, and parentheses
appear constantly in ordinary, legitimate narration prose (contractions,
clauses, asides), unlike `.`/`-`/`_`, which essentially never appear
mid-word in genuine narration text.

**Current protection:** The three closed mechanisms (confusable
substitution, `.`/`-`/`_` mid-word bridging, Unicode-noise stripping)
still apply; only insertion using the five excluded punctuation marks
specifically is unaddressed.

**Risk:** Low. Bridging these five marks in the way `.`/`-`/`_` are
bridged would very plausibly reintroduce false positives against
ordinary prose the way the three-way choice already deliberately
avoided (an interior apostrophe or comma is common in legitimate text;
an interior period, hyphen, or underscore essentially is not). No
demonstrated live exploitation of these five specific marks exists in
any harness run to date (11,923-case corpus: 0 false negatives at every
phase since 5D-R).

**Disposition: ACCEPT.**

**Rationale:** This is a deliberate, evidence-based scope boundary, not
an oversight — the punctuation marks that were included were chosen
specifically because they are structurally distinguishable from
legitimate prose, and the ones excluded were excluded because
generalizing the same technique to them would trade a narrow bypass
residual for a broad false-positive class against ordinary,
non-adversarial narration. No later phase's adversarial testing
(11,923-case corpus, every regression run since) has surfaced a live
exploitation of this residual. Closing Phase 5 without fixing it is
honest, given the fix's own known cost.

---

## 5. Cyrillic → Armenian confusable pair (`n → ո`)

**Finding:** The Phase 5D reconnaissance's own homoglyph table included
a Cyrillic/Armenian `n → ո` mapping alongside the 8 Cyrillic mappings
that were ultimately authorized and closed in 5D-R. This one mapping
was deliberately excluded from `CONFUSABLE_MAP`, flagged by the
reconnaissance's own source comment as "weaker evidence," and confirmed
excluded — the primitive-level probe at the 5D-R Review Gate directly
confirmed `canonicalizeForSecurityMatching()` does **not** fold this
mapping (`U+0578` survives unchanged).

**Severity:** Narrower than the 8 closed mappings — never independently
assigned its own severity beyond being explicitly excluded from the P1
mechanism that was fixed.

**Evidence:** `PHASE_5D_R_REVIEW_GATE.md` §3/§4/§10 (multiple confirming
passes); the exclusion rationale originates in the reconnaissance's own
`HOMOGLYPHS` table comment, not a later phase's decision.

**Current protection:** The 8 higher-confidence Cyrillic confusable
mappings are closed; this one specific glyph pair is not.

**Risk:** Very low. A single excluded glyph substitution, in a single
target word position, is a narrow bypass; the same 11,923-case harness
that would need to exercise it to demonstrate real impact has shown 0
false negatives at every run since 5D-R, and the reconnaissance's own
evidence for this specific pair's visual confusability was already
weaker than the 8 that were included.

**Disposition: ACCEPT.**

**Rationale:** This was excluded deliberately, on weaker visual-
confusability evidence than the mappings that were included, and
remains untouched by design rather than by oversight. Its narrow scope
(one glyph pair) and the absence of any demonstrated live exploitation
make this an honest, low-cost residual to accept rather than a Phase 5
closure blocker.

---

## 6. 5F — comparison-reading validation boundary

**Finding:** Discussion-reply validation (`validateDiscussionReply()`)
only validates against the anchor reading (`groundings[0]`)'s
`ReadingContract`; comparison readings referenced via
`compareReadingIds` in a multi-reading discussion are not independently
validated against their own contracts.

**Severity:** Not assigned a CVE-style severity in `PHASE_5F_HARDENING.md`
or `PHASE_5F_CLOSURE.md` — recorded as an explicit, deliberate scope
boundary of the Phase 5F design, not a discovered defect.

**Evidence:** `PHASE_5F_HARDENING.md` §8 (residual risks); restated
unchanged at `PHASE_5F_CLOSURE.md` §… ("carried forward, not reopened").

**Current protection:** The anchor reading — the primary subject of
the discussion thread — is fully validated. A reply's claims about a
*comparison* reading's own contract fields are not cross-checked.

**Risk:** Moderate in shape, narrow in practice: the discussion feature
is explicitly a follow-up conversation about a already-cast, already-
validated primary reading; comparison readings are a secondary,
optional feature of that conversation. A fabricated claim specifically
about a comparison reading's own contract fields (not the anchor's)
would not be caught by the current check. This is a real, demonstrated-
by-design gap, not yet adversarially probed for actual exploitation
depth.

**Disposition: REMEDIATE BEFORE PHASE 5 CLOSURE.**

**Rationale:** Unlike the accepted residuals above, this is not a
narrow edge case with weak practical reach or an explicit false-
positive tradeoff — it is a structural gap in the same
validation architecture Phase 5F was specifically scoped to build
("every reply the seeker sees is deterministically checked against the
grounding it claims to describe"), for a feature (multi-reading
comparison discussion) that is live in production today. Closing Phase
5 while a reply about a comparison reading can state a fabricated,
contract-contradicting claim with zero validation would be inconsistent
with what Phase 5F itself claimed to establish. This does not need to
be fixed in this document — it needs its own narrowly scoped
remediation authorization (extending `validateDiscussionReply()`'s
grounding lookup to check a reply's claims against whichever
`ReadingContract` — anchor or comparison — the claim is actually about,
or, if that's not cleanly separable per-claim, validating against the
union of all referenced contracts) before Phase 5 can honestly close.

---

## 7. 5F — legacy readings without persisted contracts

**Finding:** Readings cast before Phase 5F shipped have no persisted
`readingContract` field. `validateDiscussionReply()` correctly detects
its absence and skips validation entirely for discussion threads on
those readings, rather than rejecting every reply.

**Severity:** Not a defect — explicitly documented as pre-existing
behavior at 5F closure.

**Evidence:** `PHASE_5F_HARDENING.md` §8: "Legacy readings... cannot be
validated — `readingContract` is absent on them... This is not a
regression: those readings had zero validation before this phase too;
this phase does not make them worse, it simply cannot yet make them
better." `PHASE_5F_CLOSURE.md` reconfirms no migration/backfill path
exists (`askWatchOracle.ts`'s cast-time write is the only writer of
this field, ever).

**Current protection:** None for legacy threads — by design, matching
their pre-5F state exactly.

**Risk:** Bounded and naturally shrinking: `DISCUSSION_TURN_LIMIT`-
bounded threads on legacy readings age out over time as new readings
(all with a persisted contract, post-5F) replace them in active use. No
new legacy reading can ever be created going forward.

**Disposition: ACCEPT.**

**Rationale:** This is not a regression Phase 5F introduced — it is the
honest, explicitly-chosen alternative to a worse option (silently
backfilling or reconstructing a contract for old data, which would
itself be an unvalidated, retroactively-computed judgment — precisely
the kind of shortcut this project's standing discipline prohibits). The
risk is self-bounding and does not grow. Accepting it is more honest
than inventing a backfill mechanism nobody asked for.

---

## 8. 5G — nine-graha celestial-entity boundary

**Finding:** `checkCelestialEntities` validates narration against only
the 9 grahas (celestial bodies) the RKP engine currently represents
(Finding 5G-1).

**Severity:** P3, as originally classified.

**Evidence:** `docs/audit/PHASE_5G_RECONNAISSANCE.md` / `PHASE_5G_CLOSURE.md`
§9 ("expansion would require an explicit semantic/product decision, not
taken here").

**Current protection:** Full coverage for every celestial entity the
engine can actually compute or reference; no coverage for any entity
outside that set, because none can appear in a genuine, contract-
grounded claim in the first place.

**Risk:** None demonstrated. This is a coverage boundary defined by
the engine's own represented domain, not a gap within it — narration
cannot fabricate a claim about a celestial body the engine doesn't
model without that already being caught by the existing
`checkCelestialEntities` grounding check (any named entity not in the
engine's own set is, by construction, not grounded).

**Disposition: ACCEPT.**

**Rationale:** This is an architectural/product-scope boundary, not a
security gap — the engine represents 9 grahas by design (per the app's
own RKP methodology), and the validator's coverage exactly matches that
design. Expanding the engine's own astronomical model is a product
decision entirely outside Phase 5's remaining objective (adversarial
integrity of the existing judgment/narration layer), and closing Phase
5 without making that unrelated product decision is honest.

---

## 9. 5I — disclosed claim-surface coverage boundary

**Finding:** Phase 5I did not build a new, from-scratch exhaustive
claim-surface matrix beyond the coverage already established across the
seven Phase 5E ground-truth fields plus the pre-existing verdict/
timing/remedy/diagnosis/certainty checks.

**Severity:** Not a defect — an explicitly disclosed scope boundary of
what Phase 5I's own adversarial pass covered.

**Evidence:** `PHASE_5I_HARDENING.md` §9; independently reaffirmed at
the Phase 5I Review Gate (`PHASE_5I_REVIEW.md` §4).

**Current protection:** The seven ground-truth claim families
established across the 5E chain (house, supporting-house, sign,
direction, retrograde, ruler-relation, reversal), plus verdict, timing,
remedy, diagnosis, and certainty checks — all independently hardened
and reviewed across their own dedicated chains.

**Risk:** Speculative — no specific untested claim family was
identified as exploitable; this is a statement of testing scope, not a
demonstrated gap.

**Disposition: ACCEPT.**

**Rationale:** This boundary was disclosed, not discovered — it
describes what Phase 5I's adversarial pass re-verified (the existing,
already-hardened surface) versus what it would take to prove there is
no seventh, eighth, or ninth undiscovered claim family (an open-ended,
unbounded search). Every phase in this project's discipline has held
that reconnaissance/hardening work closes when it demonstrates the
specific, evidence-backed findings it set out to find — not when every
conceivable future finding has been pre-emptively ruled out. No
specific reproducible gap exists to remediate.

---

## 10. 5I — existing rather than newly rebuilt full-pipeline harness

**Finding:** Phase 5I re-ran the existing 11,923-case adversarial
harness rather than building a new, standalone full-pipeline harness of
its own.

**Severity:** Not a defect — a disclosed methodology choice.

**Evidence:** `PHASE_5I_HARDENING.md` §9; reaffirmed at
`PHASE_5I_REVIEW.md` §4 ("the existing 11,923-case harness and
permanent unit-test suites already exercise the same categories and
were re-run clean, not rebuilt").

**Current protection:** The existing harness (11 generator categories,
11,923 cases) continues to run clean (0 FN/FP/exceptions) at every
phase, including 5I's own implementation and review.

**Risk:** None demonstrated. A second, independently-designed harness
could in principle surface different cases than the existing one's
generators produce, but no specific coverage gap in the existing
generators has been identified.

**Disposition: ACCEPT.**

**Rationale:** The existing harness is itself a Phase 5C-R-era
deliverable that has been extended (widened Unicode axis coverage) and
re-run, unmodified in its core design, at every single phase since —
it is exactly the kind of permanent regression instrument this
project's discipline was built around reusing, not rebuilding at each
phase. Building a second, parallel harness with no specific
motivating gap would be scope expansion without an evidenced need,
which this project's standing discipline explicitly disfavors.

---

## 11. 5I — prompt-injection vocabulary coverage boundary

**Finding:** Phase 5I did not individually phrase-test the full
prompt-injection vocabulary the original 5I authorization enumerated,
relying instead on (a) the structural proof that the verdict/judgment
is fixed and frozen before narration is ever drafted, so no phrasing in
a user's question can retroactively alter it, and (b) the existing
35-case `injection-artifacts` harness category.

**Severity:** Not a defect — a disclosed methodology choice.

**Evidence:** `PHASE_5I_HARDENING.md` §9; reaffirmed at
`PHASE_5I_REVIEW.md` §4.

**Current protection:** Structural: `judgeWatchChart()` computes the
verdict from the chart and question *type* (a bounded classification)
before any narration is drafted from Claude, and `ReadingContract` is
frozen before narration begins — no code path allows narration
generation to feed back into or alter the already-computed judgment.
This was independently traced, not merely asserted, at the Phase 5I
implementation stage. The 35-case harness category additionally
exercises specific known injection phrasings against the full pipeline.

**Risk:** Low. The structural proof is a stronger guarantee than
phrase-enumeration could ever be — it holds for *any* phrasing,
including ones nobody has thought to test, because the vulnerability
class (narration influencing judgment) is architecturally foreclosed
rather than merely undetected per-phrase.

**Disposition: ACCEPT.**

**Rationale:** A structural proof that closes an entire vulnerability
*class* (judgment cannot be retroactively altered by any phrasing,
because it is computed and frozen before narration exists) is stronger
evidence than an incomplete enumeration of that class's known instances
would be. Phrase-by-phrase testing remains useful for catching
*narration-content* leakage triggered by injection attempts (which the
35-case harness category and the terminology/internal-data-leakage
checks already cover), not for proving judgment integrity, which the
architecture itself guarantees. No specific bypass of this structural
guarantee has ever been demonstrated at any phase.

---

## Summary table

| # | Residual | Origin | Severity | Disposition |
|---|---|---|---|---|
| 1a | P5A-1, P5A-3, P5A-8 (naming collision, dead field, stale comment) | 5A | P3 | ACCEPT |
| 1b | P5A-4, P5A-5, P5A-6, P5A-7 (sanitizer asymmetry, Unicode keyword matching, rate-limit ordering, calendar-invalid date) | 5A | P3 | ACCEPT |
| 1c | P5A-2 (dead AI-callable cost surface) | 5A | P3 | **DEFER TO PHASE 6** |
| 2 | 5B stale-document comments (P5B-3) | 5B | P3 | ACCEPT |
| 3 | Repeated-character padding | 5D | P2 | ACCEPT |
| 4 | Residual punctuation-insertion classes | 5D-R | (subset of former P1) | ACCEPT |
| 5 | Cyrillic→Armenian `n → ո` confusable | 5D-R | narrow, unrated | ACCEPT |
| 6 | Comparison-reading validation boundary | 5F | unrated, structural gap | **REMEDIATE BEFORE PHASE 5 CLOSURE** |
| 7 | Legacy readings skip discussion validation | 5F | not a defect | ACCEPT |
| 8 | Nine-graha celestial-entity boundary (5G-1) | 5G | P3 | ACCEPT |
| 9 | Disclosed claim-surface coverage boundary | 5I | not a defect | ACCEPT |
| 10 | Existing vs. rebuilt full-pipeline harness | 5I | not a defect | ACCEPT |
| 11 | Prompt-injection vocabulary coverage boundary | 5I | not a defect | ACCEPT |

**9 of 11 items: ACCEPT.** These are genuinely bounded — either
documentation/audit debt, deliberately-scoped false-positive
tradeoffs, architectural/product-scope boundaries, or previously
re-examined and reconfirmed security residuals of narrow practical
severity. None of them makes Phase 5's closure dishonest.

**1 item DEFER TO PHASE 6:** the dead AI-callable cost/attack surface
(P5A-2) — a live infrastructure concern squarely inside Phase 6's own
stated objective, not Phase 5's.

**1 item REMEDIATE BEFORE PHASE 5 CLOSURE:** the comparison-reading
discussion-validation boundary (item 6) — a structural gap in the same
architecture Phase 5F was built to establish, for a feature that is
live in production today. This is the one item that genuinely blocks
an honest Phase 5 closure as things currently stand.

---

## Conclusion

Phase 5 is **not yet closure-ready**. Of the eleven residuals this gate
was authorized to inventory, ten have a clean disposition (nine
ACCEPT, one DEFER TO PHASE 6) that does not require further engineering
before closure. One — the comparison-reading discussion-validation
boundary carried forward from Phase 5F — requires its own narrowly
scoped remediation before Phase 5 can honestly be said to have closed
the boundary it set out to close.

This document does not perform that remediation, does not create
`PHASE_5_CLOSURE.md`, and does not authorize Phase 6. It stops at the
disposition itself, per its own governing authorization, and awaits a
separate, narrowly scoped remediation authorization for item 6 before
Phase 5 closure can be reconsidered.
