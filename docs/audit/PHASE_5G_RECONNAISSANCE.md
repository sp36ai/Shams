# Phase 5G — Reconnaissance

## 1. Scope and authorization

Authorized: Phase 5G reconnaissance only, per the exact instruction block
issued after Phase 5F formal closure (`63e6669`). Reconnaissance-only: no
production code, test, engine, or prompt file is modified by this phase.
Objective, as authorized: a fresh, evidence-driven sweep of the current
production system for deterministic-validation gaps, trust-boundary
failures, narration/ground-truth mismatches, alternate response surfaces,
or other ways a model-generated response can violate the established
safety contract, not already closed by Phases 5A–5F — discovered from the
actual current architecture, not assumed from the old roadmap.

All probe scripts used below were written fresh for this reconnaissance,
run from outside the tracked tree, and removed before this report was
written; `git status --porcelain` is clean.

## 2. Exact baseline checkpoint

HEAD at the start of this reconnaissance: `63e6669` ("Phase 5F: formal
closure record"), on `f263745` ("Phase 5F: independent review — PASS"),
on `8eb8d45` ("Phase 5F: extend deterministic validation to the
discussion-reply surface"), on `f84f97d` ("Phase 5F: reconnaissance").
Working tree clean before and after this reconnaissance.

Baseline, independently re-run (not taken from any prior report):

| Check | Result |
|---|---|
| `functions`: `npx tsc --noEmit` | clean |
| `functions`: `npm run lint` | clean |
| `functions`: `npx vitest run` | **390/390**, 17 files |
| app: `npm run typecheck` | clean |
| app: `npm run lint` | clean |
| app: `npm run test` | **304/304**, 27 suites |
| `node functions/scripts/sync-engine.mjs --check` | clean |
| `docs/audit/golden-corpus/cases/` count | **111**, `git diff` against it empty |
| `npx vite-node functions/scripts/replay-check.ts` | **24/24** byte-identical |
| Prohibited-path diff, `f84f97d..HEAD`, all paths at once | empty (engine, `kp/`, `readingContract.ts`, `remedySelection.ts`, `remedyLibrary.ts`, `textSecurity.ts`, `narrationValidator.ts`, prompts, `firestore.rules`, golden corpus, app `src/`) |

No drift since the 5F closure checkpoint.

## 3. Production data-flow map

Read `functions/src/index.ts` directly rather than any prior audit's
description of it — it is the single authoritative list of what is
actually deployed. Ten exported callables/HTTP handlers total:

```
askWatchOracle            — callable — casts + judges + narrates a reading
discussReading             — callable — follow-up conversation on a reading
activateTrial               — callable — no model
getQuota                    — callable — no model
syncReadings, deleteReading — callable — no model
deleteAccount                — callable — no model
verifyGooglePlayPurchase     — callable — no model
razorpayWebhook               — HTTP    — no model
setAdminClaim                 — callable — no model
health                        — HTTP    — no model
classifyQuestion               — callable — model, closed 3-value enum
inferProfile                   — callable — model, closed 4-value enum
```

`selectRemedies` (the former second LLM-driven remedy authority) remains
deleted, confirmed by the same comment in `index.ts` and by its absence
from the file tree — not reopened by this reconnaissance.

Grep for every Anthropic API call site across `functions/src/` (not
`grep`-inferred from a doc — the actual `fetch('https://api.anthropic.com/...')`
call sites) found exactly four files:

```
functions/askWatchOracle.ts   → via oracle/responseComposer.ts
functions/discussReading.ts   → via oracle/discussionComposer.ts
functions/classifyQuestion.ts  → direct
functions/inferProfile.ts      → direct
```

No fifth surface exists. This is the complete, exhaustive model-response
attack surface of the production system as of this checkpoint.

## 4. Model-generated response surfaces examined

### 4.1 `askWatchOracle` → `composeWatchOracleResponse()` (primary narration)

Unchanged since Phase 5F (empty diff, §2). Re-read `responseComposer.ts`
fresh: `narrate()` drafts five `NarrationFields`; on success,
`validateNarration(contract, drafted)` runs (Phase 4, unmodified);
on failure, `narration = buildDeterministicFallbackNarration(contract)` —
a template, not a second model call (confirmed: no `fetch`, no
`Math.random`, no `Date.now` anywhere in `narrationFallback.ts` — every
sentence is a fixed string plus a `ReadingContract` field). The
composition (validated draft or deterministic fallback, never anything
else) is what both the client response and the persisted
`readings/{id}.watchOracle` receive.

A second, legacy field — `readings/{id}.narration: Record<LangCode, string>`
— is populated (`askWatchOracle.ts`) from
`oracleResponse?.narration?.interpretation || verdict.factors.join(' ')`:
either the already-validated `interpretation` field, or, if composition
failed entirely, the engine's own deterministic `factors` array. Neither
branch introduces new, unvalidated model text — this field is a derived
copy, not an independent output.

### 4.2 `discussReading` → `composeDiscussionReply()` (discussion narration)

Unchanged since Phase 5F closure (empty diff). Re-verified per §6 below
with a fresh adversarial battery targeting checks the Phase 5F review's
own battery did not specifically exercise (`checkRemedyConsistency`,
`checkCelestialEntities`).

### 4.3 `classifyQuestion` (question-gate classifier)

Output is constrained to exactly one of three fixed words
(`VALID_HORARY`/`CONVERSATIONAL`/`AMBIGUOUS`), and the raw model output is
checked against `VALID_CLASSES.includes(cls)` — anything else (a longer
string, an injection attempt, an empty response, an HTTP/timeout failure)
silently degrades to `VALID_HORARY`, the permissive default. There is no
free-text field here at all: nothing the model returns can carry an
astrological claim, a fabricated verdict, or leaked internal detail,
because nothing beyond the one enum word is ever read from its response.
Not a narration/ground-truth surface — cleared.

### 4.4 `inferProfile` (onboarding orientation classifier)

Same shape: output constrained to one of four fixed words
(`clarity`/`comfort`/`action`/`surrender`), checked against
`VALID_PROFILES.has(profile)`, with `'clarity'` as the permissive
fallback on any unexpected value, HTTP error, or missing API key. Same
conclusion as 4.3 — cleared.

### 4.5 Non-model surfaces confirmed to have no narration/model path

Read `admin.ts`, `quota.ts`, `activateTrial.ts`, `account.ts`,
`payments/googlePlay.ts`, `readings.ts` directly (not merely trusted from
their names) — none imports `fetch`, references `anthropic`, or calls
into `oracle/`. `readings.ts` (`syncReadings`/`deleteReading`) performs no
narration regeneration of any kind on sync — a synced reading's
`narration`/`watchOracle`/`readingContract` fields are written once, at
`askWatchOracle` cast time, and never rewritten by any other path (see §5).

## 5. Ground-truth / provenance analysis

- **Single write point for `readingContract`**: grepped the entire
  `functions/src/` tree for every reference to the `readingContract`
  field. Exactly one write site exists —
  `askWatchOracle.ts`'s `...(readingContract ? { readingContract } : {})` —
  at cast time, once. No migration, backfill, or regeneration path exists
  anywhere for a legacy reading.
- **Firestore security rules, read fresh** (`firestore.rules:71-78`):
  ```
  match /readings/{readingId} {
    allow read:   if isSignedIn() && resource.data.userId == request.auth.uid;
    allow delete: if isSignedIn() && resource.data.userId == request.auth.uid;
    allow create: if false; // Cloud Functions only
    allow update: if false; // Cloud Functions only
    allow read, delete: if isAdmin();
  }
  ```
  This is evidence the Phase 5F review did not specifically cite: a
  client cannot create or update a `readings/{id}` document AT ALL via
  the Firestore SDK, regardless of field — not merely blocked by
  `DiscussReadingSchema`'s `.strict()` at the callable-input layer, but
  blocked a second, independent way at the database layer itself. Even a
  client that bypassed the callable entirely and talked to Firestore
  directly could not forge, alter, or delete-and-recreate a
  `readingContract` field; the only write path into `/readings/{id}` at
  all is the Admin SDK, from `askWatchOracle.ts`.
- **`AskWatchOracleSchema` is also `.strict()`** (`middleware/validate.ts:63-79`),
  symmetric with `DiscussReadingSchema` — confirmed by direct read, not
  assumed from the discussion-path review.
- **Single computation point re-confirmed**: grepped
  `judgeWatchChart|buildWatchChart|selectRemedyProtocol|diagnose(` across
  every file in `functions/src/functions/` and `functions/src/oracle/`
  (not just the two discussion-path files checked in the 5F review) — the
  only call site for all four is inside `askWatchOracle.ts`'s own
  `composeWatchOracleResponse()` call and the engine/oracle modules that
  implement them. No other callable or composer recomputes judgment.

## 6. Tests and independent probes performed

A fresh battery targeted the two `narrationValidator.ts` checks the Phase
5F review's own adversarial battery did not specifically exercise through
the discussion surface (`checkRemedyConsistency`, `checkCelestialEntities`),
using a real engine-built `ReadingContract` (`r-5g-recon-1`, distinct
`readingId` from every prior test fixture):

| # | Probe | Result |
|---|---|---|
| 1 | Unauthorized remedy name ("Have you tried reciting Ṣalāt al-Istikhārah...") | **rejected** — `REMEDY_SUBSTITUTION` |
| 2 | Remedy-override phrase ("Try this instead: just wait it out...") | **rejected** — `REMEDY_SUBSTITUTION` |
| 3 | Unauthorized celestial entity ("Jupiter is quietly influencing this...", contract's allow-list was `[Zuhal, Mars]`) | **rejected** — `UNAUTHORIZED_CELESTIAL_ENTITY` |
| 4 | Genuine, in-protocol remedy mention (positive control) | **accepted** |

4/4 as expected — both checks apply to the discussion surface identically
to the primary surface, with no gap found. (Two earlier draft probes in
this same run were themselves miswritten — one named a planet outside the
classical nine-graha system this codebase uses at all, "Uranus," which
`checkCelestialEntities` structurally cannot flag since it isn't a member
of the checked `ALL_PLANETS` set to begin with (see Finding 5G-1 below);
the other didn't match `REMEDY_OVERRIDE_PHRASES`'s exact anchor list.
Both were corrected before being counted above — recorded here for
honesty about the process, not as findings against the validator.)

Live Firestore-rules and schema evidence (§5) was read directly, not
re-derived from a probe — rules are declarative and their content is the
evidence.

## 7. Findings, with severity

### Finding 5G-1 (P3 — informational)

`checkCelestialEntities`'s `disallowedEntityNames()` enumerates only
`ALL_PLANETS` — the nine classical grahas this codebase's engine actually
computes (`Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu`).
A narration or discussion reply naming an entity entirely outside that
set (a Western outer planet — Uranus, Neptune, Pluto — or an invented
celestial body) is not checked at all, because the check's disallow-list
is built by walking the known-planet table and excluding whichever of
those this reading's own `celestialEntities` allow, not by walking
narration for arbitrary proper nouns. A reply naming a real graha this
reading did not compute (already covered, confirmed working, §6) is
different from a reply naming something outside the system's vocabulary
altogether, which is unreachable by the check by construction.

This does not currently correspond to a demonstrated harm: the
underlying astrological system this app implements has no concept of
Uranus/Neptune/Pluto to begin with, so a narration naming one would
already be self-evidently outside the app's own register — a different
kind of implausibility than a contradicted fact, and one the existing
`checkPromptInjectionArtifacts`/`checkTerminologyLeakage` checks were not
designed to catch either (they target implementation leakage and
injection-compliance phrasing, not out-of-system proper nouns). No
production reproduction was attempted against the live model (out of
scope for reconnaissance), and no evidence suggests Claude has ever
produced such a claim — this is a structural observation about the
check's own enumerated scope, not a demonstrated bypass.

Classification: **new** (not previously documented in any 5A–5F audit
record reviewed), informational/P3. Does not meet any hard-stop
condition — does not require an engine change, a `ReadingContract`
semantics change, reopening a closed phase, or an architectural decision;
remediation, if any is ever authorized, would be a narrow addition to an
existing, unmodified check's own data table. Not fixed here.

### No P0 findings.
### No P1 findings.
### No P2 findings.

## 8. Exact reproductions for confirmed findings

Finding 5G-1 is a structural/scope observation, not a behavioral bypass
with a positive/negative reproduction pair — see §7 for the direct code
citation (`ALL_PLANETS`, `oracle/narrationValidator.ts:163-172`,
`disallowedEntityNames()`, `oracle/narrationValidator.ts:246-256`) that
constitutes its evidence.

## 9. False-positive analysis

Two probe-authoring errors surfaced during this reconnaissance (§6) were
verified to be errors in the probe's own construction, not in the
validator: probing with "Uranus" cannot trigger `UNAUTHORIZED_CELESTIAL_ENTITY`
because the check's disallow-list is derived from `ALL_PLANETS`, which
does not include Uranus (this is exactly Finding 5G-1's own scope
observation, not a false negative — the check was never designed to
reach an out-of-system name); probing with an override sentence not
matching any string in `REMEDY_OVERRIDE_PHRASES` correctly did not fire,
since that check is intentionally phrase-anchored, matching the same
documented, bounded-detector architecture established across the 5D-R/5E
chain. Both were corrected and re-run to genuine positive results (§6).
No false positive and no false negative was found against any of the 16
checks in this reconnaissance's own probing.

## 10. Previously-known / accepted residuals — explicitly not reopened

Carried forward unchanged, per the 5E and 5F closure records, and not
retested or reopened by this reconnaissance (none of the evidence
gathered here bears on any of them):

- The six residuals accepted at Phase 5E's formal closure.
- Comparison readings (`compareReadingIds`) are not validated against
  their own ground truth in a multi-reading discussion brief — an
  explicit, documented scope boundary from `PHASE_5F_HARDENING.md`,
  reconfirmed still true by this reconnaissance's fresh read of
  `discussReading.ts`'s `toGrounding()` (§4.5's sibling reasoning) but
  not independently re-probed, since doing so would only reconfirm an
  already-accepted, already-documented boundary.
- Legacy readings without a persisted `readingContract` skip discussion
  validation — pre-existing behavior, not a regression, reconfirmed by
  §5's single-write-point evidence (no migration path exists to close
  this gap silently, which would itself have been the concerning case).
- The ground-truth checks' bounded, phrase-anchored detection shape
  (established across the 5E chain) — not a general semantic-claim
  detector. This reconnaissance's own probes (§6, and the corrected
  false starts in that same section) reconfirm this boundary rather than
  finding a new gap within it.

## 11. Out-of-scope observations

- `discussReading`'s `isNewQuestion` boolean is model-supplied and
  unvalidated against any ground truth — but it is a UI routing hint (it
  only ever prompts the client to offer "ask this as a new question,"
  which the seeker must separately trigger and which re-runs the full
  engine pipeline from scratch); it carries no astrological claim and
  cannot itself misstate a chart fact. Not a narration/ground-truth
  surface; out of scope for this phase's authorized objective.
- The `utcOffsetMinutes` trust note already documented in
  `askWatchOracle.ts`'s own header (a client can assert a false offset to
  land in a chosen minute bracket) is a pre-existing, explicitly accepted
  design decision, unrelated to model-generated narration; out of scope.
- Potential concurrent-request races against `discussionTurns`'s per-reading
  cap are an economic/quota concern (bounded by a Firestore transaction
  regardless), not a narration-correctness concern; out of scope for this
  phase's authorized objective.

## 12. Recommended remediation options — not implemented

For Finding 5G-1 only, offered as options, not a recommendation to
proceed with any one of them without your own scope decision:

1. Leave as-is — the check's scope already matches the astrological
   system this app implements; an out-of-system name is already
   self-evidently foreign to the app's own register even without a
   dedicated check.
2. Extend `ALL_PLANETS`'s use in `disallowedEntityNames()` with a small,
   explicit deny-list of common non-system celestial names (Uranus,
   Neptune, Pluto, and any zodiacal/astrological term outside this app's
   own vocabulary) — a narrow, enumerable addition to an existing,
   unmodified check, not a new validator or a semantic detector.
3. Defer indefinitely as an accepted residual, the same way the 5E-chain
   residuals were, if you judge the risk immaterial given the app's own
   register already excludes these names implicitly.

No implementation was attempted for any option.

## 13. Exact regression results

Restated from §2, run at this reconnaissance's own start and unchanged at
its end (no code was modified): functions 390/390; app 304/304; both
typecheck/lint clean; mirror sync clean; golden corpus 111
byte-identical; replay 24/24; working tree clean throughout.

## 14. Prohibited-path verification

`git diff --stat f84f97d..HEAD` against all ten prohibited paths at once
(engine, `kp/`, `readingContract.ts`, `remedySelection.ts`,
`remedyLibrary.ts`, `textSecurity.ts`, `narrationValidator.ts`, prompts,
`firestore.rules`, golden corpus, and the entire app `src/` tree) is
empty — unchanged since §2, since this reconnaissance made no code
changes at all.

## 15. Final recommendation for the next authorization decision

No P0 or P1 finding exists. The model-response attack surface is now
fully enumerated (four call sites total) and, for the two surfaces
capable of emitting free text, uniformly validated by the same
deterministic, unmodified 16-check pipeline this reconnaissance
re-confirmed rather than re-derived from documentation. The provenance
chain — single computation, single write point, no client write path at
the database layer (not merely the schema layer), no migration/backfill
path — holds with no gap found.

The one finding (5G-1) is P3/informational, does not meet any hard-stop
condition, and does not require an architectural decision to remediate
if you choose to. Given the discipline established across this chain
(no scope expansion absent a demonstrated need), my own recommendation
— offered, not decided — is that Phase 5G could reasonably close on this
reconnaissance alone, with Finding 5G-1 recorded as an accepted residual
for a future phase to pick up only if it ever becomes relevant, rather
than authorizing a 5G-R implementation round for a single P3 data-table
addition. That decision, and whether to authorize any 5G-R work at all,
is yours.

This reconnaissance does not implement anything, does not begin 5G-R, and
does not close Phase 5G itself.
