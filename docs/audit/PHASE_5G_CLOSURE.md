# Phase 5G — Formal Closure Record

This is a documentation-only closure. No production code, test, engine,
prompt, or UI file is modified by this record.

## 1. Phase 5G authorization

Phase 5G was authorized in two steps, matching the discipline used
throughout the 5C-R–5F chain: first a reconnaissance-only authorization
(no implementation), then this closure authorization following
acceptance of that reconnaissance's findings. No 5G-R remediation phase
was authorized or performed — the reconnaissance found no P0/P1 finding
requiring one.

## 2. Reconnaissance checkpoint

| Commit | Stage |
|---|---|
| `63e6669` | Phase 5F formal closure (prior checkpoint) |
| `9041e6c` | Phase 5G reconnaissance — `docs/audit/PHASE_5G_RECONNAISSANCE.md` |
| (this commit) | Phase 5G formal closure |

Working tree was clean at the start of this closure, and no production,
test, or engine file was touched during it.

## 3. Scope examined

Per the reconnaissance report: the complete, exhaustively-enumerated
production model-response attack surface (grepped directly, not taken
from any prior doc) — every Anthropic API call site in `functions/src/`,
every exported callable/HTTP handler in `functions/src/index.ts`, the
provenance chain from engine judgment through `ReadingContract`
persistence to client response, and the Firestore security-rules layer
governing `/readings/{id}` independent of the callable schema layer.

## 4. Principal findings

Four reachable Anthropic call sites total, exhaustively mapped:

- `askWatchOracle` (primary narration) and `discussReading` (discussion
  reply) — both free-text surfaces, both validated by the identical,
  unmodified 16-check `narrationValidator.ts` pipeline.
- `classifyQuestion` and `inferProfile` — closed-enum classifiers (3 and
  4 fixed words respectively), allowlist-checked, permissive-fallback on
  any unexpected output; structurally incapable of carrying a claim.

Provenance re-confirmed end to end: single `readingContract` write point
(`askWatchOracle.ts`, cast time, once — no migration/backfill path
anywhere), and new evidence beyond the 5F review's own schema-layer
analysis — `firestore.rules` blocks client `create`/`update` on
`readings/{id}` entirely, independent of and in addition to
`DiscussReadingSchema`'s/`AskWatchOracleSchema`'s `.strict()` mode.

## 5. No P0/P1 findings

Explicitly stated: the Phase 5G reconnaissance discovered **no P0
finding and no P1 finding**. Nothing in this closure changes that
conclusion — the invariant re-verification below reconfirms the same
architecture holds unchanged at the current HEAD.

## 6. Finding 5G-1 — accepted P3 residual

**5G-1 (P3 / Informational):** `checkCelestialEntities` validates
against the nine celestial entities currently represented by the engine
(`Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu`). A
narration naming an entity outside that vocabulary (a Western outer
planet, or any invented celestial body) is not detected by this specific
check — its disallow-list is built by walking the known-planet table,
not by scanning narration text for arbitrary proper nouns.

This is accepted as a residual, not remediated. No production component
— the validator, the celestial vocabulary, the engine, the contract, any
prompt, taxonomy, or UI — is modified to address it. The three
remediation options already recorded in
`docs/audit/PHASE_5G_RECONNAISSANCE.md` §12 (leave as-is; extend the
deny-list narrowly; defer indefinitely) are preserved as future decision
material only, not acted on here.

## 7. Why 5G-R is not being opened

Unlike the Phase 5E chain, this reconnaissance found no P0/P1 finding
requiring a remediation implementation round. The reconnaissance itself
demonstrated the reachable model-generated response architecture is
already covered end to end:

```
Claude call → free-text/enum classification → authoritative server data
→ deterministic validation → client response
```

Both free-text surfaces share one validator; the other two model calls
are constrained to closed enums with no claim surface at all. 5G-1 is a
narrow, bounded, P3 data-table observation about one check's own
enumerated scope — it does not represent an architectural gap, a trust-
boundary failure, or a validation bypass, and does not meet any of the
hard-stop conditions the reconnaissance authorization defined (no engine
change, no `ReadingContract` semantics change, no closed-phase reopening,
no prompt/UI/taxonomy/remedy crossing, no architectural decision
required to remediate it). Opening a 5G-R round for it would be scope
expansion without a demonstrated need — the exact discipline this chain
has held since 5C-R.

## 8. Closure invariants and verification results

All independently re-run at the current HEAD, not restated from the
reconnaissance report:

| Invariant | Result |
|---|---|
| `functions`: `npx tsc --noEmit` | clean |
| `functions`: `npm run lint` | clean |
| `functions`: `npx vitest run` | **390/390**, 17 files |
| app: `npm run typecheck` | clean |
| app: `npm run lint` | clean |
| app: `npm run test` | **304/304**, 27 suites |
| `node functions/scripts/sync-engine.mjs --check` | clean — engine mirror matches |
| Golden corpus integrity | 111 case files present; `git diff` against `docs/audit/golden-corpus/` empty |
| Replay determinism | `npx vite-node functions/scripts/replay-check.ts` → 24/24 byte-identical across two in-process invocations |
| Prohibited-path diff (`f84f97d..HEAD`, all ten paths at once) | empty |
| Working-tree cleanliness | `git status --porcelain` empty, before and after this closure |
| `textSecurity.ts` unchanged since 5F closure | `git diff --stat 63e6669..HEAD` on this file — empty |
| `narrationValidator.ts` unchanged since 5F closure | `git diff --stat 63e6669..HEAD` on this file — empty |
| Engine unchanged | covered by the same all-paths-at-once prohibited-path diff above — empty |
| `ReadingContract` semantics unchanged | `readingContract.ts` covered by the same diff — empty |
| `kp/` untouched | no `kp/` diff under `functions/src/engine/` |
| Remedy library/selection untouched | `remedyLibrary.ts`/`remedySelection.ts` covered by the same diff — empty |
| Prompt architecture untouched | `functions/src/prompts/` covered by the same diff — empty |
| UI/app behavior untouched | entire app `src/` tree covered by the same diff — empty |
| No client path can forge the persisted `ReadingContract` | re-confirmed both ways: `firestore.rules:71-78` — `allow create: if false; allow update: if false;` on `/readings/{readingId}`, Cloud Functions only; and `DiscussReadingSchema`/`AskWatchOracleSchema` both still `.strict()` (`middleware/validate.ts`, six `.strict()` call sites present) |
| No second judgment computation on the discussion path | grep for `judgeWatchChart\|buildWatchChart\|selectRemedyProtocol\|diagnose(` across `discussReading.ts` and `discussionComposer.ts` — zero matches |
| 5C-R/5D-R protections intact | `textSecurity.ts` empty-diffed (above); it is the sole home of the canonicalization/confusable-folding/punctuation-bridging mechanisms both phases established |

All invariants hold. No drift found anywhere.

## 9. Previously accepted residuals — explicitly separated

Carried forward unchanged by this closure, none reopened:

- The six residuals accepted at Phase 5E's formal closure.
- Comparison readings (`compareReadingIds`) not validated against their
  own ground truth in a multi-reading discussion brief — accepted at
  Phase 5F closure.
- Legacy readings without a persisted `readingContract` skip discussion
  validation, without migration — accepted at Phase 5F closure.
- The ground-truth checks' bounded, phrase-anchored detection shape
  (established across the 5E chain), not a general semantic detector —
  reconfirmed, not reopened, by the 5G reconnaissance's own probing.
- **New at this closure: Finding 5G-1** (§6 above) — celestial-entity
  validation bounded to the nine grahas the engine currently represents;
  expansion would require an explicit semantic/product decision, not
  taken here.

## 10. Exact final repository state

- HEAD: this closure commit, on `9041e6c` (Phase 5G reconnaissance), on
  `63e6669` (Phase 5F formal closure).
- Working tree: clean.
- Regression: functions 390/390; app 304/304; both typecheck/lint clean;
  mirror sync clean; golden corpus 111 byte-identical; replay 24/24.
- No production, test, engine, prompt, or UI file changed by Phase 5G in
  either its reconnaissance or this closure — the only two files Phase 5G
  added to the repository are `docs/audit/PHASE_5G_RECONNAISSANCE.md`
  and this document.

## 11. Phase 5H remains unauthorized

This closure does not authorize, scope, or begin any Phase 5H work.
Phase 5H is to be designed from the current, freshly-verified checkpoint
once separately and explicitly authorized — not assumed from any prior
roadmap.

---

## Status

**PHASE 5G: CLOSED.**

| Phase | Status |
|---|---|
| 5C-R | ✅ CLOSED / PASS |
| 5D-R | ✅ CLOSED / PASS |
| 5E | ✅ CLOSED |
| 5F | ✅ CLOSED |
| 5G | ✅ CLOSED (reconnaissance-only; 5G-1 accepted as a P3 residual, no 5G-R performed) |
| 5H | 🔒 FROZEN / NOT AUTHORIZED |
