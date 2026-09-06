# RN Visual Feasibility Spike — DISPOSABLE, NOT PRODUCTION CODE

This directory answers exactly one question, per the owner-approved instruction
that commissioned it:

> Can the V7 Shams al-Asrār material/depth language (specified and demonstrated
> as an HTML/CSS browser prototype) actually survive translation into React
> Native, without collapsing into "flat card + glow"?

## This is not Phase 1

- Nothing here is imported by any navigator, screen, or production entry point.
- No business logic, judgment engine, Firestore, auth, or voice code is touched.
- No existing component (`RkpWatchCard`, `RemedyProtocolCard`, `ChatComposer`, etc.)
  is modified.
- The whole `src/_rnSpike/` directory can be deleted with zero effect on the
  running app — verified by the fact that nothing outside this directory
  references it.
- No new dependency was installed to build it — see the mapping report for
  which dependencies (`@react-native-community/blur`, most notably) this spike
  had to work around rather than use, precisely because that's real information
  about the gap between what V7's browser prototype used and what ships today.

## What's here

- `GlassSurface.tsx` — the Level-2 material primitive (§01)
- `ReadingSurface.tsx` — the single verdict→remedy envelope (§04, §09, §10)
- `DimensionalReveal.tsx` — the far/mid/surface plane composition and the six
  freeze states (§12, §19, §22)
- `PressDepth.tsx` — tactile press-compression primitive (§19)
- `VerdictSpike.tsx` — composes the above into the same six-state sequence the
  browser prototype demonstrates, with a manual state switcher (no navigation
  wiring) so each freeze state can be inspected independently

## What this spike could NOT verify

**This environment has no Android emulator, no iOS simulator, and no physical
device attached — confirmed by checking for `adb`, `emulator`, and `xcrun`,
all absent.** iOS specifically cannot be tested from this environment under
any circumstance, regardless of tooling installed, because RN's iOS build
requires macOS/Xcode and this is a Linux container.

That means this spike has been **typechecked and lint-checked only.** It has
never been rendered. Every claim in `RN_VISUAL_FEASIBILITY_SPIKE.md` about
what it looks like is a technical prediction grounded in RN/Android platform
facts (documented dependencies, known engine behavior), not a visual
observation — and the report says so at every point that distinction matters,
rather than presenting a predicted result as an observed one.
