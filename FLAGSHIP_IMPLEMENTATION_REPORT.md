# Flagship Implementation Report

Branch: `claude/shams-premium-ui-redesign-1hx0ka` (untouched relative to
`main`). Commits: `fd34dc0` (this phase), plus the earlier spike commits
(`4e2dead`, `9f1ffdf`, `1ff539e`, `460beb3`) already on the branch.

---

## Files changed

| File | Change |
|---|---|
| `src/components/material/GlassSurface.tsx` | **New.** Production Level-2 material primitive. |
| `src/components/material/PressDepth.tsx` | **New.** Tactile press-compression primitive. |
| `src/components/material/DimensionalReveal.tsx` | **New.** Verdict-arrival scale+opacity transition. |
| `src/components/oracle/RkpWatchCard.tsx` | Modified — replaced its inline `glassOverlay`/`topHighlight` with `GlassSurface`. All props, exports (`STATE_TONE`, `STATE_HEADLINE`, `obstructionLabel`, `timingLabel`), and defensive-read logic unchanged. |
| `src/components/oracle/RemedyProtocolCard.tsx` | Modified — wrapped in `GlassSurface` (previously flat, no material treatment). Content, exports (`OUTCOME_TONE`, `OUTCOME_HEADLINE`, `POSTURE_LABEL`, `EVIDENCE_LABEL`, `CATEGORY_LABEL`, `numberSteps`) unchanged. |
| `src/components/oracle/GuidanceCard.tsx` | Modified — wrapped in `GlassSurface` (previously flat). Content unchanged. |
| `src/components/oracle/ChatBubble.tsx` | Modified — wrapped the reading-card group in `DimensionalReveal` (`animate={false}`, see below). |
| `src/components/oracle/ChatComposer.tsx` | Modified — replaced the `🎙` emoji mic icon with a drawn SVG glyph; mic button now uses `PressDepth`. |

## Architecture preserved

Confirmed by reading, not assumed: `askWatchOracle`, `readingThreadsStore`,
every field on `DisplayWatchVerdict`/`WatchOracleComposition`, all
Firestore/App Check/auth/payment code paths, and `RemedyCategory`/
`EvidenceType` taxonomy were not opened for this phase. The full jest suite
(356 tests) passed unchanged, including the three test files that exercise
the exact components modified (`RkpWatchCard.test.ts`,
`RemedyProtocolCard.test.ts`, `ChatBubble.test.ts`) — a real business-logic
regression would have shown up there, and none did.

## Components created

`GlassSurface`, `PressDepth`, `DimensionalReveal` — all under
`src/components/material/`, all typechecked and lint-clean, all now
consumed by real production call sites (not just the disposable spike).

## Components rebuilt

None fully rebuilt. `RkpWatchCard`, `RemedyProtocolCard`, and `GuidanceCard`
were **modified in place** — their material treatment now goes through the
shared primitive instead of duplicated inline styles, but each remains its
own component.

## A scoping decision made explicitly, not silently

The master prompt asked for a `ReadingSurface` component merging verdict
through remedy into one envelope, matching §04/§09/§10 of the visual
specification. **That merge was not attempted this phase.**

Why: `RkpWatchCard` + `RemedyProtocolCard` + `GuidanceCard` together render
roughly 20 distinct pieces of real, business-critical content — watch
window, headline, house/ruler relation, timing, obstruction, reversal,
direction, physical correspondence, factor list, diagnosis narration,
no-remedy guidance, a numbered protocol with per-step evidence/category
labels and instructions, a "why this remedy" note, a narration signature,
and a separate Islamic-guidance list with its own category/effect labels.
§10's density ceiling (verdict + unveiling + ≤3 supporting rows + remedy)
is written against a demo reading, not this actual content set. Collapsing
all of it into one envelope, correctly, either requires relaxing that
ceiling as a real product decision or redesigning which fields even surface
in the flagship view — neither is something to decide unilaterally while
also being unable to visually verify the result. Attempting the merge
anyway, under this constraint, risked silently dropping real information a
seeker is currently shown. Flagged here as the one deferred item, not
hidden inside a claimed "PASS."

What *was* done instead — and is real, verifiable progress toward the same
goal — is unifying all three cards' material language (they now render
through the same primitive, with the same tint/highlight/shadow rules) and
wrapping their arrival in one shared `DimensionalReveal`, which is most of
what "read as one coherent surface" actually depends on visually, without
the content-loss risk.

## Dependencies added

None, this phase. (`@react-native-community/blur@4.4.1` was added earlier,
to the isolated spike only, in a prior round — not consumed by any
production component in this phase, consistent with the blur evidence gate
still reading "do not yet accept.")

## Platform differences

Not newly assessed this phase — `TECHNICAL_IMPLEMENTATION_DECISION.md`
(already on this branch) covers the iOS/Android divergence in shadow,
blur, and haptics in detail and nothing here changes those findings.

## Performance results

**NOT TESTED.** No renderer available (see Android/iOS validation below).

## Screenshots / evidence locations

**None produced.** No renderer available to produce them from.

## Android results

**BLOCKED.** Re-confirmed this session: no `adb`, no `emulator`, no
`ANDROID_HOME`, no AVD images, and no `/dev/kvm` (so even installing the
SDK here would not yield a usable emulator). Unchanged from every prior
round.

## iOS results

**BLOCKED — NO MACOS/iOS RUNTIME.** This is a Linux container; an iOS RN
build cannot be produced here under any configuration.

## Voice results

**BLOCKED.** No cloud-neural TTS provider credentials (API keys, service
account, or equivalent) exist in this environment. The bake-off specified
in §20 requires rendering the same 8–10 readings through multiple real
candidate providers — that cannot be simulated, approximated, or
partially run without provider access. No attempt was made to fake a
result. The architecture decision itself (cloud-neural primary, on-device
fallback) stands unchanged from the prior round; nothing about it was
touched in this phase.

## Acceptance criteria

| Criterion | Result |
|---|---|
| Production primitives exist and are consumed by real components | PASS |
| Business logic / domain architecture unmodified | PASS (verified: full test suite green, no judgment/store/auth/payment files opened) |
| `translateZ` avoided in production code | PASS (not used anywhere in this phase's code) |
| Flagship `ReadingSurface` merge (verdict→remedy as one envelope) | **NOT DONE** — see scoping decision above |
| Static compilation (`tsc --noEmit`) | PASS |
| Lint (`eslint`) | PASS |
| Existing test suite | PASS (356/356) |
| Depth reads immediately without explanation (visual) | NOT TESTED |
| Glass reads as material, not dark card (visual) | NOT TESTED |
| Verdict hierarchy dominant (visual) | NOT TESTED |
| No reticle/HUD/spinner reading (visual) | NOT TESTED |
| Typography/icon rendering on-device | NOT TESTED |
| Haptics fire correctly | NOT TESTED (no haptics library installed or wired this phase — out of this pass's scope) |
| Animation smoothness / FPS | NOT TESTED |
| Android device validation | BLOCKED |
| iOS device validation | BLOCKED — no macOS/iOS runtime |
| Voice bake-off | BLOCKED — no provider credentials |

## Remaining defects / open items

1. The `ReadingSurface` merge is not done (scoping decision above) — this
   is the largest remaining Phase 1/2 item.
2. `DimensionalReveal` is mounted with `animate={false}` — no verified
   "this reading just arrived this session" signal is wired from
   `readingThreadsStore` yet. Wiring it incorrectly (e.g. replaying on every
   history reopen) would violate the spec's own rule more visibly than
   leaving it inert for now.
3. Haptic vocabulary (§08), the full icon system beyond the one mic fix,
   loading/skeleton states, and the celestial/environment layers (§01 L1–L2)
   were not built this phase — none of them were claimed as done.
4. Bevel/refraction (`bevelDark` in `GlassSurface`) is a named but
   currently-inert layer (0% opacity) — kept as a structural placeholder
   matching the spec's own layer numbering rather than silently deleted,
   pending either a blur decision or a convincing non-blur bevel technique
   validated on a real device.

## Final flagship decision

🔴 **NOT APPROVED.**

Not because anything failed a test — because most of the criteria that
would justify approval (everything visual, on-device, and the voice
bake-off) are marked NOT TESTED or BLOCKED, not PASS. Per the standing rule
this whole engagement has followed: a criterion with no evidence is not
approved by default, regardless of how much static work surrounds it.

---

## Final status block

```
PREMIUM UI IMPLEMENTATION       = PARTIAL
ANDROID VALIDATION              = BLOCKED
IOS VALIDATION                  = BLOCKED
VOICE BAKE-OFF                  = BLOCKED
FLAGSHIP ORACLE UI              = NOT APPROVED
MAIN / ce536bc                  = UNTOUCHED
INTERNAL TEST AAB               = READY
PRODUCTION APPROVAL             = NOT APPROVED
```

### On `INTERNAL TEST AAB = READY`

Verified via the GitHub Actions API, not assumed: `ce536bc`'s diff from the
last successful `release-play-store.yml` run (`b9c8f943f6...`, run #117,
completed 2026-09-06T11:34:09Z) touches **zero** files under `android/`,
`src/`, `package.json`, or `package-lock.json` — its only change is to
`functions/src/oracle/responseComposer.ts`, which triggers the separate
Cloud Functions deploy workflow, not this one. Run #117's own job log shows
every step — including "Build release AAB," "Verify AAB targetSdkVersion,"
"Upload AAB artifact," and "Deploy to Play Store" — completed successfully.
The app content currently on the Internal Testing track is therefore
already `ce536bc`'s content; no new build or upload is needed to make that
true. This was confirmed by reading real CI run and job data, not inferred
from the workflow's configuration alone.

`TESTING_MODE_ALL_THEMES_UNLOCKED = true` remains set in `main` — per its
own code comment, this is a deliberate, temporary relaxation so internal
testers can see all 8 themes without a live subscription, and is explicitly
intended to be flipped back to `false` before any wider release. Worth
carrying forward as a known, intentional condition of the current internal
build, not a defect to silently fix.
