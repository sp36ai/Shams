# Phase 5B-R2 — Golden Corpus Baseline Reconciliation

**Date:** 2026-09-08
**Question this phase answers, and only this question:** do the
golden-corpus differences produced by the Phase 5B-R engine-mirror fix
represent a legitimate canonical-engine baseline correction with
identical decision-bearing data, or did the mirror correction alter
engine behavior?

**Answer, proven field-by-field across all 111 cases: the corpus
differences are exclusively presentation-only. Zero decision-bearing
field changed in any case.** Regeneration is therefore authorized by the
evidence and was performed.

---

## A. Baseline identity

| Item | Value |
|---|---|
| HEAD (start of this phase) | `7e42a5a33bfb43435dac4cffb709315c222885c9` |
| Branch | `claude/shams-phase-0-baseline-lnlmy6` |
| Old golden-corpus commit | `9c3fff7` ("Phase 1: authority matrix, remedy-authority analysis, duplicate map, golden corpus") |
| Canonical engine source commit (`src/astrology/rkp/watchJudgment.ts`) | `9db63fc` ("fix: use gharLabel() so house ordinals read 1st/2nd/3rd, not 1th/2th/3th") |
| Functions engine mirror commit (`functions/src/engine/rkp/watchJudgment.ts`), pre-5B-R | `7d05087` (predates `9db63fc` — this is the drift Phase 5B found and Phase 5B-R fixed) |
| `ENGINE_VERSION` (both canonical and mirror) | `2.0.0-moshier` — unchanged by this phase or by 5B-R |
| Working tree at start of this phase | clean (`git status --porcelain` empty) |
| Old corpus content hash (sha256 of sorted per-file sha256 list) | `088ed56fddc68f0ceb2b35a31239cafb5b32a130cbf71f89996f1886600f7037` |
| New corpus content hash (same method, post-regeneration) | `3201d2ae940e2408c689b5f1ac45488319498f70a9d8900318dba4800be493a5` |

The old baseline was not duplicated into a second on-disk directory in
this repository — it remains fully reproducible from git itself
(`git show 9c3fff7:docs/audit/golden-corpus` or `git checkout 7e42a5a --
docs/audit/golden-corpus/`), which is the traceability mechanism this
phase relies on rather than committing a second 111-file copy.

**Correction to Phase 5B-R's own count:** `docs/audit/PHASE_5B_REPORT.md`
and `PHASE_5B_REMEDIATION.md` both stated "44 of 111" cases differ. A
rigorous, scripted re-count this phase performed (§B) found **45**, not
44 — the earlier number came from a `diff -rq` file count read off
manually rather than machine-counted, and was off by one. This is
corrected here and does not change any conclusion (the finding that the
differences are presentation-only holds for all 45, not just 44) — it is
recorded because the brief explicitly warns against summarizing rather
than accounting for every case, and this off-by-one is exactly the kind
of thing that check catches.

---

## B. 44 → 45-case inventory

All 111 cases were compared programmatically (not sampled). **111
compared, 66 unchanged (byte-identical), 45 changed, 0 missing/added.**
Every changed case, its decision-projection result, and its
presentation-projection result:

| # | Case | Decision projection | Presentation projection | Changed factor lines | Classification |
|---|---|---|---|---|---|
| 1 | ambiguous-002 | IDENTICAL | CHANGED | 1 | PRESENTATION-ONLY |
| 2 | ambiguous-003 | IDENTICAL | CHANGED | 4 | PRESENTATION-ONLY |
| 3 | business-002 | IDENTICAL | CHANGED | 1 | PRESENTATION-ONLY |
| 4 | business-003 | IDENTICAL | CHANGED | 1 | PRESENTATION-ONLY |
| 5 | disputes-005 | IDENTICAL | CHANGED | 4 | PRESENTATION-ONLY |
| 6 | employment-003 | IDENTICAL | CHANGED | 3 | PRESENTATION-ONLY |
| 7 | employment-005 | IDENTICAL | CHANGED | 4 | PRESENTATION-ONLY |
| 8 | family-003 | IDENTICAL | CHANGED | 3 | PRESENTATION-ONLY |
| 9 | family-004 | IDENTICAL | CHANGED | 1 | PRESENTATION-ONLY |
| 10 | finance-001 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 11 | finance-002 | IDENTICAL | CHANGED | 3 | PRESENTATION-ONLY |
| 12 | finance-003 | IDENTICAL | CHANGED | 1 | PRESENTATION-ONLY |
| 13 | finance-004 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 14 | finance-005 | IDENTICAL | CHANGED | 4 | PRESENTATION-ONLY |
| 15 | general-001 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 16 | general-002 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 17 | health-001 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 18 | health-002 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 19 | lostitem-001 | IDENTICAL | CHANGED | 4 | PRESENTATION-ONLY |
| 20 | marriage-004 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 21 | marriage-006 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 22 | marriage-007 | IDENTICAL | CHANGED | 1 | PRESENTATION-ONLY |
| 23 | marriage-008 | IDENTICAL | CHANGED | 3 | PRESENTATION-ONLY |
| 24 | multiintent-002 | IDENTICAL | CHANGED | 4 | PRESENTATION-ONLY |
| 25 | multiintent-003 | IDENTICAL | CHANGED | 4 | PRESENTATION-ONLY |
| 26 | pad-business-07 | IDENTICAL | CHANGED | 3 | PRESENTATION-ONLY |
| 27 | pad-disputes-23 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 28 | pad-disputes-24 | IDENTICAL | CHANGED | 4 | PRESENTATION-ONLY |
| 29 | pad-education-19 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 30 | pad-education-20 | IDENTICAL | CHANGED | 1 | PRESENTATION-ONLY |
| 31 | pad-employment-11 | IDENTICAL | CHANGED | 3 | PRESENTATION-ONLY |
| 32 | pad-family-21 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 33 | pad-family-22 | IDENTICAL | CHANGED | 4 | PRESENTATION-ONLY |
| 34 | pad-finance-12 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 35 | pad-finance-13 | IDENTICAL | CHANGED | 4 | PRESENTATION-ONLY |
| 36 | pad-general-27 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 37 | pad-general-28 | IDENTICAL | CHANGED | 3 | PRESENTATION-ONLY |
| 38 | pad-lostitem-26 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 39 | pad-relationship-02 | IDENTICAL | CHANGED | 1 | PRESENTATION-ONLY |
| 40 | pad-relationship-04 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 41 | pad-spiritual-25 | IDENTICAL | CHANGED | 2 | PRESENTATION-ONLY |
| 42 | property-003 | IDENTICAL | CHANGED | 1 | PRESENTATION-ONLY |
| 43 | property-004 | IDENTICAL | CHANGED | 1 | PRESENTATION-ONLY |
| 44 | spiritual-001 | IDENTICAL | CHANGED | 3 | PRESENTATION-ONLY |
| 45 | spiritual-002 | IDENTICAL | CHANGED | 1 | PRESENTATION-ONLY |

Example, full detail (`business-002`):
```
Full output:            CHANGED
Decision projection:    IDENTICAL
Presentation projection: CHANGED
Changed presentation field: verdict.factors[…] ("2th Ghar" → "2nd Ghar")
Classification:          PRESENTATION-ONLY
```
The same shape holds for every row above — old/new full factor-array text
per case is in the machine-readable diff retained for this phase's own
record (not committed, per "never commit temporary probes" — the
committed evidence is this table plus §C/§F below, which fully
reconstruct the classification without needing the raw dump).

---

## C. Field-level diff

The comparison inspected the corpus's **actual** fixture schema (read
directly from `docs/audit/golden-corpus/cases/finance-001.json` and
`functions/scripts/generate-golden-corpus.ts`, not assumed from this
phase's own brief) — `input`, `derived`, `verdict`, `diagnosis`,
`remedyProtocol`, `narration`, `id`, `coverageLabel` — and classified
every leaf path:

**DECISION-BEARING** (34 paths checked per case, all engine-authoritative
values): `input.question`, `derived.normalizedQuestionType`,
`derived.chartFingerprint`, `derived.localMoment`, `verdict.qType`,
`verdict.targetHouse`, `verdict.targetSignName`, `verdict.targetRuler`,
`verdict.targetRulerName`, `verdict.fulfilmentHouse`,
`verdict.lagnaRuler`, `verdict.rulerRelation`, `verdict.state`,
`verdict.confidence`, `verdict.score`, `verdict.obstruction`,
`verdict.reversal`, `verdict.timing`, `verdict.direction`,
`verdict.afflictedDirection`, `verdict.controllerProfile`,
`diagnosis.outcome`, `diagnosis.primaryPattern`,
`diagnosis.secondaryPatterns`, `diagnosis.timingPosture`,
`diagnosis.confidence`, `diagnosis.interventionNeeded`,
`diagnosis.obstructingAgent`, `diagnosis.qType`, `diagnosis.targetHouse`,
`diagnosis.supportingHouses`, `diagnosis.obstructingHouses`,
`diagnosis.timing`, `remedyProtocol.interventionRequired`,
`remedyProtocol.guidance`, `remedyProtocol.stepIds`.

**Result: zero differences across all 45 changed cases, across all 34
decision-bearing paths.** (Confirmed programmatically — see §F.)

**PRESENTATION-ONLY** (3 paths — natural-language strings the deterministic
engine also returns, but which are display/audit text, never re-parsed
as data by anything downstream — confirmed by source read of
`readingContract.ts`, `narrationContext.ts`, and `narrationValidator.ts`:
none of them consume `verdict.factors`, `diagnosis.rationale`, or
`remedyProtocol.rationale` as anything but opaque strings passed through
to the Claude prompt / audit log): `verdict.factors`,
`diagnosis.rationale`, `remedyProtocol.rationale`.

**Result: only `verdict.factors` changed, in all 45 cases. Neither
`diagnosis.rationale` nor `remedyProtocol.rationale` changed in any
case** — this was not assumed; both were explicitly checked against
every one of the 45 changed cases (§F, `presentationDiffs` per case
lists exactly one entry, path `verdict.factors`, in all 45).

**PROVENANCE**: `id`, `coverageLabel`, `narration` (always `null` in this
corpus — narration is explicitly out of scope for the generator, per its
own header). **Result: zero differences** — none of `id`, `coverageLabel`,
or `narration` changed in any case (checked explicitly, not assumed to
be safe).

**No unclassified/"other" field changed anywhere** — every top-level key
present in the fixture schema was checked; zero hits outside the two
categories above.

---

## D. Source trace

Traced, not merely string-compared:

```
src/astrology/rkp/watchJudgment.ts          (canonical, commit 9db63fc)
  — already used gharLabel(targetHouse)/gharLabel(rulerPos.house)
  for the 6 factor-string templates (lines ~166,171,199,203,227,232)
        ↓  functions/scripts/sync-engine.mjs (Phase 5B-R's real sync run)
functions/src/engine/rkp/watchJudgment.ts   (corrected mirror)
  — now matches canonical byte-for-byte (node scripts/sync-engine.mjs
    --check exits 0)
        ↓  judgeWatchChart(chart, qType) — no other function touches
           the `factors` array; it is built exclusively inside
           watchJudgment.ts's own scoring logic
verdict.factors (WatchVerdict, then DisplayWatchVerdict)
        ↓  generate-golden-corpus.ts's contractFor()-equivalent case
           builder, which calls judgeWatchChart directly (same call
           askWatchOracle.ts itself makes) and serializes the full
           return value verbatim
docs/audit/golden-corpus/cases/<id>.json's verdict.factors
```

The one and only code change anywhere in this repository between the old
committed corpus and the regenerated one is the mirror-sync content
correction to `functions/src/engine/rkp/watchJudgment.ts` performed under
Phase 5B-R (`git diff` for that commit shows exactly the `gharLabel()`
substitution, 14 lines, nothing else) — confirmed by `git diff --stat`
across every other engine/oracle/prompt/app path being empty for that
commit and for this one (§I).

---

## E. Corpus-purpose analysis

Inspected the actual consumers, not the filename:

- **The generator's own header** (`functions/scripts/generate-golden-corpus.ts`):
  "exists solely to CAPTURE the current authoritative engine's output for
  a fixed set of inputs, so Phase 2 can diff against it... Output:
  `docs/audit/golden-corpus/cases/<id>.json`." It calls the exact
  deterministic functions `askWatchOracle.ts` calls and serializes their
  full return values — narration is the one thing explicitly excluded by
  design (non-deterministic). Nothing in the generator itself
  distinguishes "decision" fields from "presentation" fields within what
  it captures; it snapshots everything the deterministic call chain
  returns, including natural-language rationale strings, because that is
  part of the real, deterministic output of `judgeWatchChart`/`diagnose`/
  `selectRemedyProtocol`.
- **`replay-check.ts`** performs a live double-invocation determinism
  check (does the SAME engine, called twice, agree with itself) — it does
  not read the committed corpus files at all, so it is unaffected by this
  reconciliation regardless of the corpus-purpose answer.
- **Historical usage** (`docs/audit/PHASE_2B_ENGINE_MIGRATION.md`, §A):
  "111-case regeneration vs. the Phase 2A-committed baseline:
  **byte-identical** (`diff -rq` → zero differences)." This is the
  project's own established practice — the corpus has, in fact, been
  used and verified as an exact-output, byte-identical golden file, not
  merely a decision-field regression check, on at least one prior phase.
- **No test file or CI job reads `docs/audit/golden-corpus/` automatically**
  — it is exercised only by manually running `generate-golden-corpus.ts`
  and diffing, exactly as this and prior phases have done. It is audit
  tooling, not a wired-in CI gate.

**Honest answer: this corpus is, by its own design and by this
project's own prior practice, an exact-serialized-output snapshot** —
not a corpus that was ever scoped to "decision fields only." That is
precisely why this phase does not wave away the 45-case difference as
automatically fine — the byte-identity guarantee genuinely changes, and
that is exactly the kind of change the "STOP unless proven" framing in
the Phase 5B-R2 brief exists to catch. What this phase adds beyond that
existing byte-identity check is the field-by-field proof (§C, §F) that,
within the exact-output change, every altered byte traces to a single,
already-authorized, already-verified-correct source: the mirror-sync
correction, and touches no field any downstream consumer (contract,
validator, Firestore, client) treats as anything other than
opaque display prose.

---

## F. Decision projection — proof

Executed via a dedicated comparison script (not summarized from
memory), covering all 111 cases:

```
Total files compared: 111
Changed files: 45
Missing-in-new: 0

[for every one of the 45 changed cases:]
  decision-bearing diffs: 0
  presentation diffs: 1        (always path: verdict.factors)
  other/unclassified diffs: 0
```

A second, independent verification normalized every changed factor-line
pair by stripping ordinal suffixes (`\d+(st|nd|rd|th)` → the bare
number) and re-comparing:

```
Total factor-line pairs inspected across all changed cases: 273
Lines that changed AND reduce to identical text after stripping
  ordinal suffixes: 107
Anomalies (non-ordinal differences or structural mismatches): 0
```

107 matches the `git diff --stat` line count exactly (`45 files
changed, 107 insertions(+), 107 deletions(-)`) — an independent
cross-check that the scripted comparison and the raw file diff agree on
the same number.

**No decision-bearing field differed in any of the 111 cases. No
anomalous (non-ordinal) text difference was found anywhere in the full
diff.** §D traces every one of those 107 line changes to the single
`gharLabel()` mirror-sync correction.

---

## G. Migration decision

**REGENERATED.** All 45 changed cases proved presentation-only per §C-F;
the Step 9 hard-stop condition (any decision-bearing field changed) did
not trigger for any case. The corpus at
`docs/audit/golden-corpus/cases/*.json` (111 files) and
`docs/audit/golden-corpus/index.json` now reflect the output of the
corrected, canonical-source-synchronized engine — the same engine every
real deploy builds from (confirmed via `node
functions/scripts/sync-engine.mjs --check` passing immediately before
generation, per Step 10's instruction to generate from the actual
production-aligned engine, not an ad-hoc copy).

Regeneration was itself verified deterministic: running the generator
twice in immediate succession, from the same synchronized engine state,
produced byte-identical output both times (`diff -rq` → zero
differences).

Migration record:
- Old corpus hash: `088ed56fddc68f0ceb2b35a31239cafb5b32a130cbf71f89996f1886600f7037`
- New corpus hash: `3201d2ae940e2408c689b5f1ac45488319498f70a9d8900318dba4800be493a5`
- Changed cases: 45 of 111
- Changed fields: 107 individual `verdict.factors` array-element strings, across those 45 cases
- Decision-bearing fields changed: **0**
- Reason: stale `functions/src/engine/` mirror (predating the `gharLabel()` ordinal fix, commit `9db63fc`) corrected to canonical `src/astrology/` engine source, under Phase 5B-R
- Old baseline recovery: `git show 9c3fff7:docs/audit/golden-corpus` (or `git checkout <pre-5B-R2 commit> -- docs/audit/golden-corpus/`)

---

## H. Regression results

| Check | Result |
|---|---|
| `node functions/scripts/sync-engine.mjs --check` | exit 0, "matches src/astrology/" |
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **189/189 passed, 14 files** |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm run test` (app root, Jest) | **304/304 passed, 27 suites** |
| `npx vite-node functions/scripts/generate-golden-corpus.ts`, run twice from the synchronized engine | **111/111 identical between the two runs** (determinism of the new baseline itself) |
| `npx vite-node functions/scripts/replay-check.ts` | **24/24 identical**, 0 non-identical |

All numbers match the acceptance criteria exactly: 111/111, 24/24, full
test/typecheck/lint matrix green on both packages.

---

## I. Remaining risks (scoped to this reconciliation only)

- The corpus's byte-identity guarantee, as established practice (§E), now
  has one recorded, deliberate exception point in its history (this
  migration) — future audits comparing against a pre-Phase-5B-R2 archive
  must know to expect this specific, documented 45-case/107-line
  presentation-only delta, not treat it as unexplained drift. This
  document and the dated addenda in `PHASE_5B_REMEDIATION.md` and
  `PHASE_5B_REPORT.md` are the record for that.
- The old baseline is not duplicated on disk in this repository (§A) —
  its recovery depends on git history remaining intact for commit
  `9c3fff7`/`7e42a5a`. This is treated as acceptable given git is already
  this repository's system of record for every other audit trail in this
  project.
- This phase's own field classification (`DECISION_PATHS` /
  `PRESENTATION_PATHS` in the comparison script) is scoped to this
  corpus's actual current schema, read directly from a real fixture and
  the generator source. If the corpus schema changes in the future, a
  similarly rigorous re-derivation — not a copy-paste of this phase's
  path lists — would be needed for any future reconciliation.
