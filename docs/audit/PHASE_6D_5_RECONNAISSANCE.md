# Phase 6D-5 — Reconnaissance: Finding 7 (Zod Validation Bypass)

Read-only reconnaissance on **Finding 7** from `docs/audit/PHASE_6C_1_CLOSURE.md`
§6 / originally `docs/audit/PHASE_6B_CLOSURE.md` §2, corrected at
`docs/audit/PHASE_6B_REVIEW.md` §11: *"`setAdminClaim`, `inferProfile`,
and `classifyQuestion` use manual `request.data as {...}` casts instead
of the shared Zod `parse()` pattern every other input-taking callable
uses."* Baseline: `5130577`. **No repository file is modified by this
document.**

## 1. The shared pattern this finding is about, re-read in full

`functions/src/middleware/validate.ts` defines `parse<T>(schema,
data)`: a `z.ZodSchema.safeParse()` wrapper that throws
`HttpsError('invalid-argument', ...)` on failure, used by
`askWatchOracle`, `discussReading`, `syncReadings`, `deleteReading`,
and `verifyGooglePlayPurchase` — 5 of the codebase's 11 `onCall`
exports. Every one of those 5 schemas is `.strict()` (rejects unknown
keys) and bounds every field's type, length, and shape explicitly.

## 2. The exact scope — re-enumerated exhaustively, not just the 3 named functions

```
$ grep -rn "request.data as\|request\.data\?" functions/src/functions/ functions/src/functions/payments/
admin.ts:40            const { targetUid, isAdmin } = request.data as {...};
askWatchOracle.ts:161  parse(AskWatchOracleSchema, request.data)      — shared pattern
discussReading.ts:194  parse(DiscussReadingSchema, request.data)      — shared pattern
classifyQuestion.ts:31 const inputData = request.data as {...} | null;
inferProfile.ts:19     const d = request.data as {...} | null;
payments/googlePlay.ts:208  parse(VerifyGooglePlaySchema, request.data) — shared pattern
readings.ts:89         parse(SyncReadingsSchema, request.data)        — shared pattern
readings.ts:149        parse(DeleteReadingSchema, request.data)       — shared pattern
```

**Exactly 3 manual casts exist, and only these 3** — confirmed by
searching every `onCall` export for any form of reading `request.data`.
The remaining 3 exports (`deleteAccount`, `activateTrial`, `getQuota`)
take no meaningful request body at all (re-confirmed: `deleteAccount`
and `activateTrial` are called with `{}`/no arguments client-side,
`getQuota` likewise) — correctly excluded from this finding, not an
oversight. The finding's own scope, as corrected at the 6B review, is
exhaustively confirmed accurate: `admin.ts`, `classifyQuestion.ts`,
`inferProfile.ts` — no fourth instance exists.

## 3. Each of the 3 — read in full, assessed individually rather than as one undifferentiated group

### 3.1 `setAdminClaim` (`admin.ts`)

```ts
const { targetUid, isAdmin } = request.data as { targetUid: string; isAdmin: boolean };
if (!targetUid || typeof isAdmin !== 'boolean') {
  throw new HttpsError('invalid-argument', 'Required fields missing: ...');
}
```

Not "no validation" — a manual runtime check does follow the cast,
rejecting a missing/falsy `targetUid` or a non-boolean `isAdmin`. What
it lacks relative to the shared pattern: no length/format bound on
`targetUid` (a Firebase Auth uid is normally a short fixed-format
string, but nothing here enforces that), no `.strict()` rejection of
extra keys, and the validation logic itself is bespoke rather than
declared once in `validate.ts` alongside every other schema.

**Reachability**: this callable is gated by an admin-only check
(`request.auth.token.admin !== true` → reject) that runs *before* the
manual cast — re-confirmed by reading the function top-to-bottom, the
order established and re-verified across Phase 6C-2's own work on this
same file. **A caller must already hold the `admin` custom claim to
reach the weakly-validated body at all.** This narrows the exposure
significantly relative to the other two: the threat model is not "any
authenticated user," it is "an already-privileged admin account,"
matching this codebase's `firebase.predeploy.json`-documented, deploy
console-only method of granting that very first admin claim.

### 3.2 `inferProfile` (`inferProfile.ts`)

```ts
const d = request.data as { answers?: unknown } | null;
const raw = Array.isArray(d?.answers) ? (d.answers as unknown[]) : [];
const answers = raw.slice(0, 3).map(a => (typeof a === 'string' ? a.slice(0, 200) : ''));
```

More defensive than a bare cast: non-array `answers` degrades to `[]`
rather than throwing; each element is length-capped to 200 characters;
a non-string element becomes an empty string rather than being passed
through. **Reachable by any authenticated user** — this is the one of
the three with the least-restrictive caller gate (only `verifyAuth()` +
the rate limit, no admin check, no dead-code status).

Traced what the (weakly-typed) input actually reaches: `answers` are
interpolated directly into a fixed prompt template
(`Answer 1 (Intent): "${a1}"` etc.) sent to the Anthropic API, and the
**output** is independently validated against a fixed 4-value enum
(`VALID_PROFILES`) before being returned — an invalid or unexpected
model response already degrades to `'clarity'`, not passed through
raw. Unlike `AskWatchOracleSchema`'s `NameSchema`, there is no
character-level sanitization of the free-text answers before they
reach the prompt (no control-character strip, no
quoting/bracketing-character removal) — the same category of concern
`validate.ts`'s own `sanitizeName()` comment describes for
`seekerName`/`motherName`, not present here. This is a **structural
input-hardening gap consistent with the finding's own framing** — not
a new, separate defect this reconnaissance is inventing, but a concrete
illustration of exactly what "not using the shared pattern" costs in
practice for this specific function.

### 3.3 `classifyQuestion` (`classifyQuestion.ts`)

```ts
const inputData = request.data as { text?: unknown } | null;
const text = typeof inputData?.text === 'string' ? inputData.text.slice(0, 1000) : '';
```

Same shape of manual, defensive-but-unstructured validation. **Re-confirmed
dead code**, independently, from the source this reconnaissance itself
inspected rather than merely citing the 6B review's own finding:

```
$ grep -rn "httpsCallable.*classifyQuestion\|classifyQuestion.*httpsCallable" src/
(no output)
```

The only client-side match for the string `classifyQuestion` at all is
`src/astrology/kp/rules/questionKeywords.ts:370`, which defines its
own, entirely unrelated function of the same name (a deterministic
client-side keyword matcher) — confirmed by reading that line directly,
not a caller of this Cloud Function. **Zero live exposure.**

## 4. Severity — re-assessed per instance, not as one blanket item

None of the three represents a P0/P1. Distinguished more precisely than
prior phases stated:

- `setAdminClaim`: **lowest exposure of the three that are reachable at
  all** — gated behind an existing admin claim, a privilege this
  codebase's own documentation says is granted exclusively via the
  Firebase CLI shell outside the app, not through any client flow.
- `inferProfile`: **the one genuinely worth hardening if this finding
  is ever remediated** — reachable by any authenticated user, and the
  one place a `NameSchema`-style sanitization gap is concretely
  identifiable, not merely theoretical.
- `classifyQuestion`: **no live exposure** — remediating it is a
  code-consistency exercise, not a risk-reduction one.

## 5. What a remediation would require — laid out, not chosen

- **`setAdminClaim`**: the most mechanical of the three to convert — a
  `.strict()` Zod object (`targetUid: z.string().min(1).max(128)`,
  `isAdmin: z.boolean()`) dropped in exactly where the current manual
  check sits, using the exact same `parse()` helper every other
  callable already uses. The pre-existing admin-authorization check
  itself (Finding 11's own, separately-tracked subject) would need to
  stay entirely untouched — this finding is about the request body,
  not the authorization gate.
- **`inferProfile`**: **not purely mechanical.** The current code is
  deliberately lenient (a non-array `answers`, a missing element, or a
  non-string element all degrade silently rather than reject the call)
  — a `.strict()` Zod schema in this codebase's own established style
  would need an explicit decision about whether to preserve that
  leniency (via `.optional()`/`.default()`/per-element `.catch()`) or
  tighten it to reject malformed input outright the way every other
  schema in `validate.ts` does. Adding `NameSchema`-style character
  sanitization to the three free-text answers, closing the gap
  identified in §3.2, would be a natural companion change but is a
  distinct decision from "use Zod instead of a manual cast" and was not
  evaluated for prompt/output-shape compatibility by this
  reconnaissance.
- **`classifyQuestion`**: mechanically identical to `setAdminClaim`'s
  conversion, lowest priority given confirmed dead-code status — worth
  doing only for codebase consistency, not to reduce any measured risk.

**This reconnaissance takes no position on whether to remediate one,
two, or all three, or in what order.**

## 6. Hard-stop determination

**No hard-stop condition was triggered.** Checked explicitly:

- No P0/P1 vulnerability was found. `setAdminClaim` requires an
  existing admin claim to reach at all; `classifyQuestion` has no live
  caller; `inferProfile`'s weakly-validated input only reaches a
  prompt whose output is independently constrained to a 4-value enum
  before use — none of the three permits an unauthenticated action, a
  cross-user data access, or an unbounded/uncontrolled effect.
- The `NameSchema`-sanitization gap identified for `inferProfile` (§3.2)
  is a concrete illustration of the finding's own stated risk, not a
  newly discovered, separate defect requiring its own hard-stop
  treatment.
- Nothing in this reconnaissance required stopping before completion.

## 7. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this reconnaissance is written against: `5130577` (the
  6D-4 Closure / Finding 6 closure).
- Working tree: clean before and after this document.
- No production, test, Firestore-rule, CI-workflow, or
  deployment-configuration file is touched — the only file this phase
  adds is this document.
- No implementation occurred. No `validate.ts` schema was added.

---

## Status

**PHASE 6D-5 RECONNAISSANCE (Finding 7): COMPLETE.**

| Layer | Status |
|---|---|
| Finding 6 | ✅ CLOSED (`5130577`) |
| 6D-5 reconnaissance (Finding 7) | ✅ Complete (this document) |
| 6D-5 implementation | 🔲 Not yet authorized |
| 6D-5 Review / Closure | 🔲 Not applicable until implementation is scoped |
| Finding 3 (Options A/B) | 🔲 Undecided — untouched |
| Production readiness | ❌ Not established |

Awaiting a separate, explicit authorization for whichever remediation
(if any, and for which of the 3 instances) the owner wants pursued
among §5's options, or a decision to close Finding 7 with this
per-instance characterization and no further code change.
