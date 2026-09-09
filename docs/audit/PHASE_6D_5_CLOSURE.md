# Phase 6D-5 — Formal Closure: Finding 7 Closed, No Code Change

This document formally closes Finding 7 (from `docs/audit/PHASE_6C_1_CLOSURE.md`
§6 / originally `docs/audit/PHASE_6B_CLOSURE.md` §2, corrected at
`docs/audit/PHASE_6B_REVIEW.md` §11), by explicit owner decision: **accept
the per-instance characterization established at reconnaissance; make no
code change.** As with Findings 4 and 5, this is not a
remediation-and-review chain — there is no implementation to ratify. It
exists to give Finding 7 the same explicit closure record every resolved
item in this project's audit trail already has. It is the only file this
closure adds.

## 1. Chain history

| Step | Commit | Outcome |
|---|---|---|
| 6D-5 reconnaissance | `721bb44` | Re-enumerated every `request.data` access across all 11 `onCall` exports and confirmed exactly 3 manual `as {...}` casts exist — `setAdminClaim`, `classifyQuestion`, `inferProfile` — no fourth instance; the other 8 either use the shared `parse()`/Zod pattern or take no meaningful request body. Assessed each of the 3 individually: `setAdminClaim` is gated behind an existing admin claim (lowest exposure of the three reachable at all); `classifyQuestion` re-confirmed dead code from source directly (zero live exposure); `inferProfile` is reachable by any authenticated user and has a concrete, identified sanitization gap relative to this codebase's own `NameSchema` pattern, though its output is independently constrained to a 4-value enum before use. Laid out remediation options per instance without choosing any. No hard-stop found. |
| Closure decision | this document | Owner explicit instruction: *"Close Finding 7 with the per-instance characterization, no code change."* |

## 2. What this closure ratifies

- **The per-instance characterization from `PHASE_6D_5_RECONNAISSANCE.md`
  is the authoritative record of Finding 7 going forward**, superseding
  any earlier framing of the three instances as one undifferentiated
  "uses manual casts instead of Zod" item. Future reference to Finding 7
  should cite the three distinct risk profiles in that document, not a
  single blanket severity.
- **No live exploitation path was demonstrated for any of the three.**
  `setAdminClaim` requires an already-privileged admin account to reach
  its weakly-validated body at all — a threat model this codebase's own
  documentation confines to the Firebase CLI shell, not any client
  flow. `classifyQuestion` has no caller anywhere in the client code.
  `inferProfile`'s weakly-validated input reaches only a fixed prompt
  template whose output is independently constrained to one of four
  enum values before use — no unbounded or uncontrolled effect follows
  from a malformed request.

## 3. Why this closes without a code change

Each of the three has a different reason a fix was not forced here:

- **`setAdminClaim` and `classifyQuestion`** would be mechanical Zod
  conversions with no behavioral ambiguity — but neither has a
  demonstrated live risk to reduce (the first requires a privilege an
  attacker does not have by definition of reaching it; the second is
  unreachable at all). Converting either now would improve code
  consistency, not close a measured exposure.
- **`inferProfile`** is not purely mechanical — its current manual
  validation is deliberately lenient (a malformed `answers` field
  degrades silently rather than rejecting the call), and a `.strict()`
  Zod schema in this codebase's own established style would require an
  explicit design decision about whether to preserve or tighten that
  leniency, which this reconnaissance correctly declined to make
  unilaterally. Forcing that decision now, absent a demonstrated
  exploitation path, is not something this closure authorizes.

This mirrors the reasoning `PHASE_6D_2_CLOSURE.md` (Finding 4) and
`PHASE_6D_3_CLOSURE.md` (Finding 5) already applied: a finding without a
single, unambiguous, risk-justified fix is not forced into one merely to
close it faster.

## 4. What remains explicitly true after this closure

- **No `validate.ts` schema was added** for any of the three functions.
  `admin.ts`, `classifyQuestion.ts`, and `inferProfile.ts` are exactly as
  they were at `721bb44` — unchanged by this closure.
- **The manual validation in all three remains functionally adequate for
  what it currently guards** — none permits an unauthenticated action, a
  cross-user data access, or an unbounded effect — while being less
  structurally consistent than the shared Zod pattern used elsewhere in
  this codebase. That inconsistency is recorded, not hidden.
- **This is a point-in-time assessment, not a permanent guarantee.** If
  `classifyQuestion` is ever wired up to a real client caller, or if
  `inferProfile`'s free-text answers are ever routed anywhere other than
  a fixed prompt template with an independently-validated enum output
  (for example, if raw answer text were ever logged, displayed, or used
  to construct another prompt without the same output constraint), the
  reachability and severity conclusions in
  `PHASE_6D_5_RECONNAISSANCE.md` §3–§4 would need to be re-checked, not
  assumed to still hold.
- **This closure does not declare the application production-ready.** It
  closes Finding 7 specifically, on the evidence gathered.

## 5. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this closure is written against: `721bb44` (the 6D-5
  reconnaissance).
- Working tree: clean before and after this document.
- No production, test, Firestore-rule, CI-workflow, deployment-
  configuration, or dependency file is touched by this closure — the
  only file this phase adds is this document.
- No Phase 5, 6A, 6B, 6C, or 6D-1/6D-2/6D-3/6D-4 document is created or
  modified by this closure.

## 6. Finding 3 (Options A/B) and further Phase 6 work

- **Finding 3's remaining options (A/B)** remain open, unaddressed by
  this closure — the last item in `PHASE_6B_RECONNAISSANCE.md`'s
  original 11-finding set still without a closure record.
- **No further Phase 6 work has begun.** This closure does not scope,
  begin, or authorize any Finding 3 work or any other Phase 6 activity.

---

## Status

**FINDING 7: CLOSED — per-instance characterization accepted, no code change.**

| Layer | Status |
|---|---|
| Phase 5 | ✅ CLOSED |
| 6A | ✅ CLOSED |
| 6B | ✅ CLOSED |
| 6C-1 | ✅ CLOSED |
| 6C-2 | ✅ CLOSED |
| 6D-1 (Finding 3 / Option C) | ✅ CLOSED |
| Finding 4 | ✅ CLOSED |
| Finding 5 | ✅ CLOSED |
| Finding 6 | ✅ CLOSED |
| 6D-5 reconnaissance (Finding 7) | ✅ Complete (`721bb44`) |
| 6D-5 Closure (Finding 7) | ✅ CLOSED (this document) |
| Finding 3 (Options A/B) | 🔲 Undecided — untouched, last open item |
| Production readiness | ❌ Not established |

All seven original Phase 6B findings are now formally closed
(Finding 1 via CI enforcement, Finding 2 via rate limiting, Finding 3
partially via the CI deployment gate with Options A/B still undecided,
Findings 4, 5, and 7 via corrected/refined characterization with no
code change warranted, Finding 6 via the App Check readiness fix).
Awaiting a separate, explicit authorization for the next Phase 6 step.
