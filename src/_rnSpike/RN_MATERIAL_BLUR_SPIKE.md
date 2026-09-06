# RN Material / Blur Spike — Report

Spike source: `src/_rnSpike/MaterialBlurSpike.tsx` (isolated, disposable, not
imported by any screen or navigator). `@react-native-community/blur@4.4.1`
was installed as a real dependency — into this spike's evaluation only, per
the explicit approval to do "what is strictly required for the disposable
spike." No production screen, theme, or navigation file was touched.

```
RN FEASIBILITY               = PROVISIONAL
REAL-DEVICE VALIDATION       = NOT TESTED
FLAGSHIP                     = NOT APPROVED
PRODUCTION UI IMPLEMENTATION = BLOCKED
```

---

## What was built

Three deterministic, freeze-inspectable states in one spike component:

- **FALLBACK** — the existing production technique exactly: tint background +
  top-edge highlight + native shadow/elevation. No blur.
- **BLUR** — identical geometry, background token, border, and shadow as
  FALLBACK, with a real `<BlurView blurType="dark" blurAmount={14}>` added
  underneath the content, plus the same faint tint layered on top of it so
  the comparison isn't biased by one card being tinted and the other not.
- **STRESS** — the BLUR surface placed over an actual busy background (offset
  glow blobs + horizontal stripes) rather than a flat void, so the presence
  or absence of real diffusion has something to diffuse.

---

## Findings, by category

### TECHNICALLY INTEGRATED — **PASS**
`@react-native-community/blur@4.4.1` installs cleanly. Its own
`android/build.gradle` reads `rootProject.hasProperty("newArchEnabled")` and
branches its Java source set between `src/oldarch/` and `src/newarch/`
accordingly. This project's `android/gradle.properties` sets
`newArchEnabled=false` — the library's old-architecture path applies
directly, confirmed by reading its build script, not assumed from its
version number or changelog. Its iOS podspec branches the same way for
`RCT_NEW_ARCH_ENABLED`. No integration blocker found for either platform's
architecture setting as this project has it configured today.

### STATICALLY VERIFIED — **PASS**
- `npx tsc --noEmit` — clean, project-wide, zero errors.
- `npx eslint src/_rnSpike` — clean after one formatting auto-fix pass
  (`prettier/prettier` only — no logic or type findings).

### VISUAL QUALITY — **UNVERIFIED**
No Android emulator, iOS simulator, or physical device exists in this
environment (confirmed absent: `adb`, `emulator`, `xcrun`) — the same
blocker as every prior device-validation round, restated rather than
worked around. None of the acceptance criteria requested — perceived glass
thickness, background diffusion, foreground/background separation, edge
definition, depth perception, premium perception, verdict-typography
readability, visual stability — can be honestly scored without a render.
No score is given for any of them. This is the deciding gap, not a detail.

### PERFORMANCE — **UNVERIFIED (measured numbers), with two identified static risk factors**
No FPS or memory measurement is possible without a running app on a device.
Two concrete, code-level facts are worth carrying into that eventual test
rather than discovering them cold:
1. The library **hard-caps `blurRadius` at 25** and throws if exceeded
   (`BlurView.android.tsx`) — the visual target (§01's `20–32px` blur range)
   sits right at or above this ceiling, so the achievable Android blur may
   be visibly weaker than the browser prototype's `backdrop-filter:
   blur(22px)` even before any performance tradeoff is made.
2. `autoUpdate` is not forced off by default at the JS layer — left
   unset, it defers to the native default, which for a real-time blur
   library typically means continuous re-sampling of what's behind the view
   on every frame it changes. For a *static* reading surface (the state this
   material spends nearly all its time in, per §11's Completion state — "an
   absence of further motion is the signal") continuous sampling is
   unnecessary cost. The spike does not yet set `autoUpdate={false}`
   deliberately for the settled state; this is a concrete, cheap
   optimization to carry forward rather than a performance finding that
   blocks anything.

### PLATFORM RISK — **PARTIAL**
`BlurViewManagerImpl.createViewInstance` (Android) wires the blur to the
Activity's `decorView` and blurs whatever is rendered behind it in the
actual window — a real-time sample of the window's content, via the
`eightbitlab/blurview` library. This is a materially different model from
CSS `backdrop-filter`, which is scoped to its own local stacking context.
In practice, since this app's screens compose within one window/decorView
regardless, it should still functionally blur whatever sits behind the
glass surface on screen — but "should, by reading the source" is not the
same claim as "does, observed." This is exactly the kind of thing that
looks correct in code and behaves surprisingly on a real layout (z-order,
overlapping siblings, the celestial background's own rendering layer) —
flagged as a real, specific risk to check first on-device, not a generic
disclaimer.

### FALLBACK QUALITY — **PASS**
The existing tint-only approach (`RkpWatchCard`'s `glassOverlay`/
`topHighlight` pattern, reproduced identically in the spike's `FALLBACK`
state) is already shipping in production today. It is a genuine, acceptable
result on its own — not a placeholder waiting to be replaced. If BLUR is
rejected, this is not a fallback in the sense of "second best forced by
necessity" — it is the current production standard, unaffected by anything
in this spike.

### RECOMMENDATION — **DO NOT YET ACCEPT — INSUFFICIENT EVIDENCE**

Not a rejection of `@react-native-community/blur`, and not an acceptance.
The library integrates correctly for this project's architecture, compiles
cleanly, and its API surface is usable — none of that answers the actual
question posed: *does it materially improve the visual language enough to
justify becoming part of the production material system?* That question is
about what it looks like, and nothing available in this environment can
answer it. Claiming PASS on visual quality from source-reading alone would
be exactly the fabrication this entire validation chain has been built to
prevent.

**What would resolve it:** the same answer as the last two rounds — get this
spike (now including the working `MaterialBlurSpike` A/B/C comparison) in
front of any real Android device or emulator outside this container. Until
then, the two static risk factors above (the 25px radius ceiling, and
`autoUpdate` defaulting to continuous) are worth fixing in the spike before
that test happens, since both are cheap, known, and would otherwise
contaminate a real visual judgment with an avoidable performance or fidelity
problem.

---

## Status, unchanged

```
RN FEASIBILITY               = PROVISIONAL
REAL-DEVICE VALIDATION       = NOT TESTED
FLAGSHIP                     = NOT APPROVED
PRODUCTION UI IMPLEMENTATION = BLOCKED
```

Not touched: `ReadingScreen`, `RkpWatchCard`, `ChatBubble`, `ChatComposer`,
`themes.ts`, navigation, voice architecture, any production UI. Stopping
after the isolated spike, as instructed.
