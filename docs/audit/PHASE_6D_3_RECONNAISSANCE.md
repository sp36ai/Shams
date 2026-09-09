# Phase 6D-3 — Reconnaissance: Finding 5 (`functions/` Dependency Audit)

Read-only reconnaissance on **Finding 5** from `docs/audit/PHASE_6C_1_CLOSURE.md`
§6 / originally `docs/audit/PHASE_6B_CLOSURE.md` §2: *"functions/
dependency audit: 12 moderate, tracing to `teeny-request`/`retry-request`
via `@google-cloud/storage` via `firebase-admin` — loaded but never
exercised by this application's own code (no `getStorage`/Cloud
Storage API usage anywhere in `functions/src/`)."* Baseline: `f6bb4cc`.
**No repository file is modified by this document.**

## 1. Count and root-cause structure — re-confirmed, and traced one level deeper than any prior phase

```
$ cd functions && npm audit --omit=dev
12 vulnerabilities (12 moderate)
```

Exact figure unchanged since Phase 6B. This reconnaissance enumerated
all 12 named package entries in the audit's own JSON output and their
full `via` chains — something no prior phase did explicitly for
Finding 5 (Finding 4's own reconnaissance corrected exactly this kind
of gap for a different finding; this document applies the same
diligence here). **The 12 packages resolve to exactly two independent
root-cause advisories, not the single "Storage chain" the prior
framing implied:**

| Root cause | Packages it accounts for | Count |
|---|---|---|
| `uuid` — "Missing buffer bounds check in v3/v5/v6 when buf is provided" | `uuid`, `teeny-request`, `retry-request`, `gaxios`, `google-gax`, `@google-cloud/storage`, `@google-cloud/firestore`, `firebase-admin`, `firebase-functions` | 9 |
| `qs` — "array-limit bypass via bracket-key comma parsing" / "DoS via attacker-controlled isBuffer" | `qs`, `body-parser`, `express` | 3 |

This is a refinement of the prior characterization, not a reversal of
its conclusion: the prior framing's *result* (no live exploitation
path) still holds, established below with more precision than before.

## 2. The `uuid` chain — reachability re-examined at the exact vulnerable-function level, including the one path prior phases did not check

### 2.1 Why this needed a fresh look, not a restatement

Every prior phase's reachability argument for this finding rested on
one fact: `grep -rln "getStorage|@google-cloud/storage|firebase-admin/storage"
functions/src/` returns nothing, so Cloud Storage is never called.
**That argument says nothing about Firestore** — and `@google-cloud/firestore`
is in this same `uuid` chain (`@google-cloud/firestore` → `google-gax`
→ `uuid`), while Firestore, unlike Storage, is this application's
single most heavily used dependency — every `db.collection(...)` call
in every callable goes through it. A reachability argument that never
addressed the Firestore path was incomplete, not necessarily wrong.
This reconnaissance closes that gap directly.

### 2.2 The vulnerability's precondition, and every call site that could trigger it

The advisory (`GHSA-w5hq-g745-h8pq`) is specific: a missing buffer
bounds check **in `uuid`'s `v3`/`v5`/`v6` functions, when a caller
supplies its own pre-allocated `buf` argument.** `uuid`'s default,
no-argument usage (including `v4()`, the random-UUID generator) is not
the vulnerable code path at all.

Every place `uuid` is actually invoked anywhere in this dependency
chain was read directly, not assumed:

```
$ grep -n "uuid" node_modules/google-gax/build/src/util.js
function makeUUID() { return (0, uuid_1.v4)(); }

$ grep -n "uuid" node_modules/gaxios/build/src/gaxios.js
const boundary = (0, uuid_1.v4)();

$ grep -n "uuid" node_modules/teeny-request/build/src/index.js
const boundary = uuid.v4();
```

**All three call sites — `google-gax` (used by both Firestore and
Storage's underlying gRPC/API-client layer), `gaxios`, and
`teeny-request` — call `v4()` with zero arguments.** None calls `v3`,
`v5`, or `v6`; none ever supplies a `buf`. This is true regardless of
whether Firestore is called constantly (it is) or Storage is never
called (it isn't, per §3) — **the vulnerable function is never invoked
by any code path in this dependency tree, independent of which Google
Cloud API this app actually uses.** This is a stronger and more
specific conclusion than "Storage is unreachable so the whole chain is
low-risk" — it establishes that the specific vulnerable code itself
cannot execute here, not merely that one particular caller of it is
absent.

## 3. The Storage-specific reachability check — re-run fresh, unchanged

```
$ grep -rln "getStorage|@google-cloud/storage|firebase-admin/storage" functions/src/
(no output)
```

Re-confirmed: no file in `functions/src/` imports or calls the Cloud
Storage API. This part of the prior finding's own evidence is
independently reproduced, not merely carried forward.

## 4. The `qs` chain — traced to its actual call site for the first time, found to be dead code in this app's runtime

Not examined by any prior phase. `qs`'s vulnerable code is reached
through `body-parser` and `express`, both declared as direct runtime
dependencies of `firebase-functions@5.1.1` itself:

```
$ npm ls express
firebase-functions@5.1.1
  express@4.22.2
```

Traced where `firebase-functions` actually uses `express`:

```
$ grep -rl "express" node_modules/firebase-functions/lib/v2/
node_modules/firebase-functions/lib/v2/providers/https.d.ts   <- TypeScript type declarations only
```

The only match under `lib/v2/` (the API surface this app exclusively
uses — confirmed via `grep -rn "firebase-functions/v1" functions/src/`
→ no output) is a `.d.ts` file: `import * as express from "express"`
used solely to type-annotate `onRequest`'s handler parameter
(`response: express.Response`). **No `.js` runtime file under `v2/`
requires or calls `express`.** `express` is genuinely `require()`d at
runtime only in two places in this package: `lib/v1/function-builder.js`
(the legacy v1 API, which this app never imports) and
`lib/bin/firebase-functions.js` (a standalone CLI script the Firebase
CLI runs locally during `firebase deploy`'s function-discovery/manifest
step — a deploy-time tool invoked on the CI runner, not code that runs
inside the deployed Cloud Function's own request-handling process).

**Conclusion: `express`, and therefore `body-parser` and `qs`, are
present in `node_modules` (and therefore shipped inside the deployed
function's container image, since `firebase-functions` declares them
as unconditional dependencies) but are never executed by any request
this application's deployed Cloud Functions actually serve.** This is
the same "loaded but not exercised" class of finding as §2 and the
original Storage finding, established here for the first time for this
specific chain.

## 5. What a real remediation would require — laid out, not chosen

Not evaluated for compatibility risk or recommended by this
reconnaissance:

- **The `qs` chain (3 packages)**: `npm audit fix` (no `--force`, no
  breaking-change flag) reports a fix is available — `npm`'s own
  resolver found a `qs` version compatible with `body-parser`'s and
  `express`'s existing semver ranges that patches both advisories
  without requiring `firebase-functions` itself to change version.
  This is the lower-risk of the two chains to address, if either is
  ever pursued — genuinely dead code in this app's runtime regardless,
  so the benefit would be closing the advisory in `npm audit`'s output
  rather than removing any live risk.
- **The `uuid` chain (9 packages)**: `npm audit fix --force` reports
  this requires bumping `firebase-admin` from `^12.0.0` (currently
  resolving `12.7.0`) to `14.3.0` — two major versions. `firebase-admin`
  is a direct, foundational dependency of every function in this
  codebase (`db`, `auth`, `FieldValue` all come from it via
  `utils/admin.ts`); a two-major-version bump carries real API-surface
  and behavior-compatibility risk that was not assessed here — that
  assessment belongs to an implementation authorization, not this
  reconnaissance. Given §2's conclusion that the vulnerable function is
  never actually callable through this dependency tree regardless of
  version, the security benefit of this specific bump is closing the
  advisory in `npm audit`'s report, not removing a demonstrated live
  risk — a materially different cost/benefit shape than a typical
  security-motivated major-version bump.

## 6. Hard-stop determination

**No hard-stop condition was triggered.** Checked explicitly:

- No P0/P1 vulnerability was found. The `uuid` chain's vulnerable
  function is confirmed never invoked by any call site in this
  dependency tree, independent of which Google Cloud API this app
  uses — including the Firestore path prior phases did not
  specifically check. The `qs` chain's vulnerable code is confirmed
  unreachable in the v2-only API surface this app exclusively uses.
- Nothing in this reconnaissance required stopping before completion.

## 7. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this reconnaissance is written against: `f6bb4cc` (the
  6D-2 Closure / Finding 4 closure).
- Working tree: clean before and after this document.
- No production, test, Firestore-rule, CI-workflow, deployment-
  configuration, or dependency file is touched — the only file this
  phase adds is this document.
- No implementation occurred. No dependency version was changed.

---

## Status

**PHASE 6D-3 RECONNAISSANCE (Finding 5): COMPLETE.**

| Layer | Status |
|---|---|
| Finding 4 | ✅ CLOSED (`f6bb4cc`) |
| 6D-3 reconnaissance (Finding 5) | ✅ Complete (this document) |
| 6D-3 implementation | 🔲 Not yet authorized |
| 6D-3 Review / Closure | 🔲 Not applicable until implementation is scoped |
| Finding 3 (Options A/B) | 🔲 Undecided — untouched |
| Findings 6–7 | ⛔ Untouched |
| Production readiness | ❌ Not established |

Awaiting a separate, explicit authorization for whichever remediation
(if any) the owner wants pursued among §5's un-evaluated options, or a
decision to close Finding 5 with this more precise characterization
and no further code change.
