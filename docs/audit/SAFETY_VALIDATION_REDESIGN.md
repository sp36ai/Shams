# Safety Validation Architecture — Redesign Proposal (Phase 2A)

**Status: design only. Nothing in this document has been implemented. The
historical validator has not been restored, in whole or in part, verbatim or
modified.** This inspects the historical file (recovered from git history —
`3db4c65` original, `08aac2b` generalized version) and the current
`responseComposer.ts`, and proposes a future boundary. Implementation is
explicitly out of scope for this phase.

---

## What the historical validator actually did

Recovered in full from git history (`git show 08aac2b:functions/src/functions/safetyValidator.ts`).

| Question | Answer |
|---|---|
| What did it validate? | Free-form prose fields, one at a time. Original (`askOracle`): `hidden_influence`, `spiritual_layer`, `timing`, `warning`. Generalized version (`08aac2b`) added `runWatchNarrationSafetyValidator`, validating `rkp_finding`, `interpretation`, `recommended_approach`, `why_this_remedy` — `signature` deliberately excluded ("a fixed brand line, not free prose"). |
| What input did each field-check receive? | Only the field's own raw text string, in isolation, plus a `readingId` used solely for logging. **It never received the settled verdict, diagnosis, or remedy protocol.** |
| What failures did it catch? | Eight violation categories baked into `VALIDATOR_PROMPT`: medical claims, financial claims, legal claims, dangerous instructions, certainty-claim language ("will happen" → "may"/"could"), dependency risk ("only the oracle knows"), fear amplification, authority overreach. A second LLM (Haiku) read the prose and either approved it verbatim or returned a rewritten `final_text`. |
| What did it not catch? | See the dedicated section below — this is the most important part of the redesign. |
| Structured output or free-form prose? | Free-form prose only, field by field. No structural/schema validation of any kind. |
| Was it deterministic? | **No.** It was itself an LLM call — a second, independent model invocation per field, run in parallel via `Promise.all`. Two runs over identical input text are not guaranteed to return the identical verdict, let alone the identical rewritten text when `status: "modified"`. This is a real property worth stating plainly: the historical "second defense layer" was itself non-deterministic, layered on top of an already-nondeterministic first pass (Opus synthesis). |
| Could it validate verdict consistency? | **No.** It never received `WatchVerdict` or `RkpDiagnosis`. A narration field could state an outcome that contradicts the engine's actual verdict, and this validator had no way to notice — it only ever judged whether a piece of text sounded medically/financially/legally risky or falsely certain, never whether it was *true relative to the diagnosis it was supposed to describe*. |
| Could it validate timing? | Not meaningfully. The old `timing` field was a free-text narration field name, not a check against `RkpDiagnosis.timing`/`TimingPosture`. No cross-reference to the actual computed timing window existed. |
| Could it validate remedies? | No, and it did not need to for *content* (remedy names/instructions/evidence type are copied verbatim from the library by `responseComposer.ts` after the model returns — a separate, structural mechanism, unaffected by this validator either historically or today). But it also could not catch a narration field that describes a *different* remedy than the one actually selected, since it never saw the selected protocol. |
| Could it detect unsupported claims in general? | Only the specific categories in its prompt (certainty language, authority overreach, etc.), judged by a second LLM's own reading of the isolated text — not by comparing the claim against any ground truth. A claim that is *factually wrong relative to the diagnosis* but does not happen to use certainty language or fall into one of the eight named categories would pass. |
| Could it prevent internal-terminology leakage? | **No — not addressed at all.** Nothing in `VALIDATOR_PROMPT` mentions internal system vocabulary (`KP`, `RKP`, `house matrix`, raw internal planet identifiers, etc.). This is a distinct concern from the eight content-safety categories the validator was built for, and it was never in scope for it. |
| Fail-open or fail-closed? | **Fail-open**, explicitly and by design — its own comment states the trade-off: "Haiku instability causing blocked readings is a worse outcome than unvalidated-but-already-guardrailed prose reaching the user." On timeout (6s) or any error, the original unvalidated text passes through unchanged, and the failure is logged to `readings/{id}/validationLog` (best-effort, itself swallowing its own write failures). |

---

## What `responseComposer.ts` already does today (unrelated to the deleted validator)

Re-read in full this pass, unchanged since Phase 0:

- **Structural containment, not content review.** The model's writable surface
  is limited to `NarrationFields` (`rkp_finding`, `interpretation`,
  `recommended_approach`, `why_this_remedy`, `signature`) — it cannot return
  a remedy name, instruction, or brand seal; those are copied verbatim from
  `REMEDY_LIBRARY`/`ORACLE_BRAND_SEAL` after the model returns, regardless of
  what the model wrote. This closes an entire class of problems (invented
  remedies, altered brand attribution) that the historical validator was
  never designed to catch either — the two mechanisms are complementary, not
  redundant.
- **What it does not do:** nothing currently reviews the *content* of
  `rkp_finding`/`interpretation`/`recommended_approach`/`why_this_remedy`
  against the eight violation categories, against the settled diagnosis for
  factual consistency, or against a terminology deny-list. The only
  remaining defense on those four fields is the system prompt's own
  instructions (`watchOracleSynthesisPrompt.ts`) — a single line of defense,
  exactly as `08aac2b`'s own commit message stated it was trying to fix, and
  exactly what has since regressed back to (Phase 0 addendum §1).

---

## Proposed future boundary

```
ENGINE (deterministic)
  → structured judgment (WatchVerdict)
  → structured diagnosis (RkpDiagnosis)
  → structured, library-bound remedy protocol (RemedyProtocol)
      ↓
ALLOWED-CLAIMS SURFACE
  (a synthesis of exactly what the settled facts above license the
   narration to say — see "closing the ground-truth gap" below)
      ↓
AI NARRATION (Claude Opus 5, current responseComposer.ts mechanism,
  unchanged: structurally bounded to NarrationFields, remedy content
  still copied verbatim, never model-authored)
      ↓
VALIDATION  ← the redesigned stage, three sub-stages, not one LLM call:
  1. Deterministic terminology/leakage gate (fast, free, no LLM, no
     nondeterminism)
  2. Deterministic ground-truth cross-check against the settled
     WatchVerdict/RkpDiagnosis/RemedyProtocol (fast, free, no LLM)
  3. Optional semantic re-check for the categories that genuinely need
     judgment rather than pattern-matching (medical/financial/legal
     claims, fear amplification) — this is the one sub-stage that, if
     kept, is necessarily an LLM call and therefore necessarily
     non-deterministic; that trade-off should be made knowingly, not
     inherited silently the way it was before
      ↓
APPROVED OUTPUT → client
```

### 1. Deterministic terminology/leakage gate

A plain string/regex scan over the composed narration text for a maintained
deny-list: `KP`, `Krishnamurti`, `house matrix`, raw internal planet
identifiers where a boundary name is required (`Rahu`/`Ketu` vs. the
boundary-mapped `Ras`/`Dhanab` — mirroring what
`utils/planetBoundaryName.ts` already enforces on structured fields, but
never on prose), and any other implementation-internal term the constitution
this audit operates under calls out ("internal architecture ... must never
be exposed through user-facing output"). Zero LLM calls, zero
nondeterminism, sub-millisecond cost. This is the one sub-stage this report
is most confident belongs in Phase 2B essentially as specified, because it
requires no judgment calls to design — only a maintained list.

### 2. Deterministic ground-truth cross-check

This is the gap the historical validator never closed, named explicitly
above: **nothing has ever compared the narration's claims against the
diagnosis it is supposed to describe.** A minimal version of this needs no
LLM either — e.g., confirming the narration doesn't contain a
`WatchState`/`RkpOutcome` word (FULFILLED/BLOCKED/DELAYED etc., or their
antonyms in plain English) that contradicts `diagnosis.outcome`; confirming
`why_this_remedy` (when present) only references remedy names that are
actually in `protocol.steps`, not some other name. This is necessarily
narrower than a full semantic check, but it is deterministic, and it directly
answers the Phase 2A brief's specific question ("could it validate verdict
consistency?") in the affirmative for the first time in this system's
history — a property the historical validator never had at any point.

### 3. Optional semantic re-check (LLM, non-deterministic — an explicit trade-off)

If the project wants to keep the eight-category content check (medical/
financial/legal claims, dangerous instructions, dependency risk, fear
amplification, authority overreach, certainty-language softening), it should
be re-scoped, not resurrected as-is:

- **Fed the settled diagnosis, not just isolated text** — closing the
  "factually wrong but doesn't sound risky" gap noted above, at least
  partially (an LLM given both the claim and the ground truth can flag a
  mismatch a keyword scan cannot).
- **Fail-open vs. fail-closed is an explicit open question for the project
  owner, not a default to inherit.** The historical validator chose fail-open
  ("a blocked reading is worse than unvalidated prose") as a stated,
  deliberate trade-off — reasonable for its time, but this report does not
  assume it should carry forward unexamined into a "production-grade"
  target, especially for categories like dangerous-instruction detection
  where fail-open means a caught-but-unactioned violation still reaches the
  user. Phase 2B should record the owner's explicit choice here rather than
  defaulting silently.
- **Should not be the only defense**, the way it effectively became the
  entire safety story before its removal — stages 1 and 2 above are meant to
  carry the mechanical, deterministic share of the work so this stage is a
  genuinely supplementary check, not the sole safety net for prose content.

---

## What this document is not

This is a proposal, not a specification ready to implement verbatim, and
definitely not a restoration of `08aac2b`'s file. It does not pick concrete
regex patterns for stage 1, does not fully specify stage 2's rule set beyond
the two examples given, and does not resolve the fail-open/fail-closed
question — those are Phase 2B (or later) design work, informed by an owner
decision this report explicitly does not make. Nothing here has been wired
into `responseComposer.ts` or any other file.
