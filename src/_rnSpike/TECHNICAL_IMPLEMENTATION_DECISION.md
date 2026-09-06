# Technical Implementation Decision — Material, Depth, Platform, Validation

Scope: the four unresolved areas only, per instruction. No production code
touched beyond the existing isolated `src/_rnSpike/`. No Phase 1 started.

```
RN FEASIBILITY               = PROVISIONAL
VISUAL REAL-DEVICE VALIDATION = NOT TESTED
FLAGSHIP                     = NOT APPROVED
PRODUCTION UI IMPLEMENTATION = BLOCKED
```

---

## 1. Material / blur

### What's actually true today, confirmed not assumed
- No blur library is installed (`package.json` has no `@react-native-community/blur`, no `expo-blur` — and `expo-blur` isn't viable regardless, this is a bare RN app, not Expo).
- `android/gradle.properties` has `newArchEnabled=false` — this app runs the **old architecture (Paper)**, not Fabric. Any library evaluated has to work under Paper today, whenever it's actually installed.
- Production already ships a real, working fallback pattern: `RkpWatchCard.tsx`'s `glassOverlay`/`topHighlight` (tinted `backgroundColor` + a highlight line, no blur) is the exact "RN approximation" §01 already names — this isn't a hypothetical fallback, it's running in production right now.

### Candidate comparison

| Option | iOS | Android | Verdict |
|---|---|---|---|
| **`@react-native-community/blur`** (current release `4.4.1`, confirmed via its `package.json`) | Wraps `UIVisualEffectView` — native, cheap, well-established | Historically implemented via `RenderScript`-class real-time blur, which has a documented performance cost that scales with blur radius and view size; more recent releases have moved toward `RenderEffect`/renderer-backed approaches on newer Android, but the exact behavior on this app's actual `minSdk` (24, per this codebase's own `useTextToSpeech.ts` comment) needs confirming against the library's current Android-version floor — not asserted here as verified | The strongest real-blur candidate; peer-dependency is permissive (`react-native: *`), and the package ships codegen config, suggesting current releases target both architectures — but Paper-mode behavior on this exact RN version should be smoke-tested before committing, not assumed from the package metadata alone |
| **Skia-based blur** (`@shopify/react-native-skia`, not installed) | Consistent custom rendering, but a large new dependency for one effect | Same | Rejected for this stage — pulling in a full Skia renderer to solve one blur is exactly the "don't introduce a heavy rendering engine for a superficial effect" rule §19 already sets; revisit only if `@react-native-community/blur` fails its own test |
| **No blur — tuned tint only** (current production pattern) | Cheap, consistent, already proven in this codebase | Cheap, consistent, already proven | The safe fallback, not the target — this is what §01 calls the "RN-approximation," explicitly named as the thing to close, not settle for |

### Decision
Evaluate `@react-native-community/blur` first, in an isolated spike install
(not `sp36ai/Shams` production dependencies) scoped to exactly one question:
does it render acceptably and stay within §27's performance budget on a
real mid-range Android device at this app's `minSdk`. **Do not install it
into production yet.** If it fails that test, the existing tint-only
approximation remains the shipped fallback — not a failure state, an
accepted, already-proven degradation path consistent with §27's own tiering.

---

## 2. 2.5D depth — the production `DimensionalReveal` model

Confirmed unavailable: `translateZ` (see the spike's own finding — absent
from this RN version's transform type entirely). The production model uses
only what's confirmed to exist: `perspective`, `rotateX`, `scale`,
`translateX`/`translateY`, and `opacity`.

**The model, restated in RN-native terms, preserving V7's spatial hierarchy
rather than its literal CSS values:**

| V7 concept | Production RN primitive |
|---|---|
| Far plane recedes | `scale` down + `opacity` down together (never one alone — §01's own atmospheric-falloff rule: recede and dim together) |
| Near/orbit plane recedes during Depth Build | `scale` down + `opacity` down, on a faster timing curve than the far plane, so the two visibly diverge rather than moving in lockstep (this is what made the v6→v7 correction actually work — two independently-timed changes, not one) |
| Surface emerges forward | `scale` up from ~0.92→1 + `opacity` 0→1, with a **shadow-intensity ramp** (`shadowOpacity`/`elevation` animated alongside scale) standing in for "coming toward the viewer," since RN has no Z-translation to do that literally |
| Verdict floats above its own surface | A `translateY` of a few px **plus** a stronger `textShadowRadius`/color intensity than the surface beneath it — depth communicated by contrast and light, not by an actual forward Z-offset RN can't express |
| Off-center glow patches (v7's anti-reticle fix) | Positioned `View`s with `borderRadius: 9999` and a radial-gradient-equivalent (RN has no native radial gradient either — approximated with a soft-edged tinted circle plus opacity falloff, or a small `react-native-svg` `RadialGradient`, since `react-native-svg` **is** already an installed dependency this codebase uses elsewhere) |

**The restraint instruction, carried through explicitly:** this model must
read as *presence and weight*, not as a demonstration of technique. Every
transform above is doing the same job §01/§19 always specified — hierarchy,
atmosphere, an illuminated manuscript coming forward from darkness — using
the primitives RN actually has, not fewer effects layered to compensate for
the ones that don't exist, and not more effects added because the honest
RN version looks quieter than the CSS one.

---

## 3. Cross-platform rendering — explicit iOS vs Android treatment

No "same CSS everywhere" assumption, per instruction. Per surface:

| Dimension | iOS | Android |
|---|---|---|
| **Blur** | Native `UIVisualEffectView` via the blur library once evaluated — likely the platform where real blur is safe first | Tint-only fallback until the library is proven at §27's performance budget on real mid-range hardware; do not ship the same blur radius on both platforms by default — Android's is the one that needs the performance gate |
| **Shadows** | Native `shadowColor/Offset/Opacity/Radius` — can express the contact + glow shadow pair as specified | `elevation` only expresses one shadow; the gold-tinted glow needs a **second, separately-elevated view** behind the surface (a common Android pattern: a blurred/tinted clone view sitting slightly behind, at lower elevation) rather than assuming one shadow prop can do both jobs |
| **Opacity / perspective / rotateX / scale** | Fully supported, no divergence | Fully supported, no divergence — these are the primitives that actually port cleanly; the divergence is concentrated in blur and shadow, not motion |
| **Typography** | Font rendering is generally reliable across weights | This codebase already has an **open, documented bug**: Cinzel is a variable font provisioned identically for "Bold" and "SemiBold," likely rendering as the same weight on Android — the standing §05 acceptance test (a real Android screenshot showing them differ) is unresolved and is not part of this document's scope to fix, only to flag as still blocking typography sign-off regardless of the material work above |
| **Haptics** | Taptic Engine gives fine-grained impact/notification feedback matching §08's vocabulary directly | Android's vibration API is coarser; a wrapper library (e.g. `react-native-haptic-feedback`, not yet installed) is needed to get comparable "light/medium impact" semantics rather than one raw vibration pattern standing in for all of them — this is a Phase 3/5 dependency decision, not decided here |

---

## 4. Real-device validation plan

**Device classes** (three, matching §26 exactly):
1. A recent iPhone (mid-tier or better)
2. A mid-range Android device
3. A high-end Android device

**Capture method:** the tiny RN visual proof (see recommended next step
below) ports the same six named freeze buttons from the HTML prototype and
this spike (`idle / thinking / depth / verdict / unveil / remedy`) so a
tester can jump to and hold each state on-device, exactly as was done in the
browser — screen-recorded via each platform's native recorder, with a still
frame extracted per state for side-by-side comparison against the browser
prototype's own screenshots.

**FPS expectation:** 60fps sustained through the verdict-reveal sequence;
§27's floor of 45fps before the tier automatically degrades (per the
already-specified degradation contract, not a new rule invented here).

**Failure criteria — reused, not reinvented:**
- §19's freeze-frame dimensionality test, run for real this time: pause on
  each state, judge whether depth reads without motion or explanation.
- §16's 16-item checklist, scored against the on-device recording.
- The four v6→v7 corrections specifically re-checked on-device: does
  Thinking still read as a generic spinner, does Depth Build still read as
  brightness-only, does Verdict Reveal read as a HUD/reticle, does Remedy
  still compete with Timing/Guidance. A regression on any of these on a real
  device — even though all four passed in the browser — is a real, reportable
  finding, not assumed fixed by inheritance from the prototype.
- Material specifically: does the chosen blur approach (or its tint fallback)
  actually read as glass at arm's length on each device class, not just in a
  screenshot viewed at zoom.

---

## Recommended next step (not started here)

Per your corrected sequencing — **material/blur decision → tiny RN visual
proof → real-device validation** — the next concrete piece of work is a
small, still-isolated RN visual proof: take the existing `src/_rnSpike/`
components, install `@react-native-community/blur` into that isolated spike
only (not production dependencies), wire it into `GlassSurface` in place of
the tint-only approximation, and get it in front of an actual device or
emulator somewhere outside this container. That is the first point real
visual evidence becomes possible — nothing before it can honestly produce
a PASS.

Status unchanged, as instructed:

```
RN FEASIBILITY               = PROVISIONAL
VISUAL REAL-DEVICE VALIDATION = NOT TESTED
FLAGSHIP                     = NOT APPROVED
PRODUCTION UI IMPLEMENTATION = BLOCKED
```

Stopping here. `ReadingScreen`, `RkpWatchCard`, `ChatBubble`, `ChatComposer`,
themes, and navigation were not opened for editing. The voice track was not
touched — it remains separately gated behind the cloud-neural bake-off
(§20), unaffected by anything in this document.
