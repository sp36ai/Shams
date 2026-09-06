# RN Visual Feasibility Spike — Report

Spike source: `src/_rnSpike/` in `sp36ai/Shams` (isolated, disposable, not
imported by any navigator or screen — see its own `README.md`). Verified by
`tsc --noEmit` (clean, project-wide) and `eslint` (clean). **Never rendered —
see the verification-gap note before section D.**

---

## A. Browser → RN mapping

| V7 concept | Browser technique | RN implementation (spike) | Fidelity | Risk |
|---|---|---|---|---|
| Glass fill (§01 L3) | `background: rgba(...)` + `backdrop-filter: blur(22px)` | `backgroundColor: rgba(...)` only — **no blur**. `@react-native-community/blur` is not installed | Approximate | High — this is the exact "RN-approximation vs real-blur" gap §01's own hero comparison already named; the spike confirms it's still unresolved, not new information but now proven against real code |
| Inner highlight (§01 L4) | 1px inset box-shadow, top edge only | Absolutely-positioned 1px `View` along the top edge | Faithful | Low |
| Bevel / chamfer | Stacked inset box-shadows (multiple edges) | `borderWidth` + tint `View` overlay; RN has no inset-shadow primitive at all | Approximate | Medium |
| Contact + glow shadow (§01 L5) | Two independent CSS `box-shadow` layers | iOS: `shadowColor/Offset/Opacity/Radius` (single shadow, no second independent glow layer). Android: single `elevation` value only | Approximate, and **diverges by platform** | High — iOS and Android cannot use the same code path to approximate this; §26's "iOS/Android parity" row was already flagged as untested, this is why |
| Verdict glow (§05) | `text-shadow: 0 0 14px ...` (soft, unclipped) | `textShadowColor/Offset/Radius` — a hard-edged single shadow copy, historically clipped to the text's own bounding box on Android | Approximate | Medium |
| Far/mid/surface Z-separation (§12, §22) | `perspective` + `translateZ` inside `transform-style: preserve-3d` | **`translateZ` does not exist in this RN version's transform type at all** (confirmed by `tsc`, not inferred) — substituted with `scale` + opacity only | Substituted technique, not ported | High — see the dedicated note below |
| Specular sweep (one-shot) | Animated `linear-gradient` band via keyframes | Not attempted in this spike — no native gradient library (`react-native-linear-gradient`) is installed; would need a new dependency | Not implemented | Medium |
| Press-depth (§19) | CSS `:active` scale transform | `Pressable` + Reanimated `withSpring` scale | Faithful | Low |
| Verdict/remedy content stagger (§07 Reveal) | CSS transition-delay-free JS class toggles | Reanimated `withTiming` shared values, same technique family | Faithful | Low |

### The translateZ finding, in full
This project's installed RN (`0.78.3`) style types
(`node_modules/react-native/Libraries/StyleSheet/StyleSheetTypes.d.ts`)
define `perspective`, `rotateX/Y/Z`, and the `scale`/`translateX`/`translateY`
family — **and nothing else in the 3D-transform family**. `translateZ` isn't
partially supported or flaky, it's absent from the type surface, and using it
is a compile error. There's also no RN equivalent of `transform-style:
preserve-3d`, so even where `perspective`/`rotateX` exist, sibling views
don't automatically composite into one shared 3D space the way three CSS
`div`s under one `preserve-3d` parent do.

This is not a reason to worry about V7's own conclusion — it's independent
confirmation of it. V7 already committed to **2.5D (scale/opacity/shadow
illusion), not true 3D**, for visual reasons. This finding shows RN could not
have supported literal Z-axis translation for this purpose regardless — the
2.5D decision and the platform's actual capability line up, which is a better
outcome than discovering they didn't.

---

## B. Material assessment

| Material cue | RN-reproducible as specified? |
|---|---|
| Translucent glass (real diffusion of what's behind it) | **No**, without adding `@react-native-community/blur` as a new dependency — confirmed absent from `package.json` |
| Background diffusion | Same — depends entirely on the same missing blur library |
| Edge highlight | Yes — a positioned hairline `View`, faithful |
| Bevel/thickness cue | Partial — achievable via layered tint views and border color, but RN has no inset-shadow primitive, so the CSS technique doesn't port directly; a visually comparable result is plausible but unverified |
| Contact shadow | Yes on iOS (native shadow props); Android collapses to `elevation`, which cannot independently express a second gold-tinted glow layered on top — this is a real platform divergence, not a workaround gap |
| Atmospheric depth / spatial separation | Substituted (scale + opacity), not ported — see the translateZ finding above |

## C. Performance assessment

Grounded in what's actually installed and documented, not measured (no
renderer available to measure with):

- **Animation smoothness**: Reanimated 3.19.5 runs its shared-value updates
  on the UI thread via worklets — this is the right tool for the job and is
  already used elsewhere in this codebase's `StarfieldBackground` with
  `useNativeDriver`-class practice. No architectural reason to expect jank
  from the animation approach itself.
- **Blur cost**: not assessable — no blur library is installed, so there is
  no blur cost to measure yet. Adding one is itself the first performance
  question to answer, not something this spike could pre-empt.
- **Shadow cost**: Android's `elevation` is a cheap, GPU-composited native
  primitive; iOS's layered `shadow*` props are also native and generally
  cheap for a small, bounded number of surfaces — consistent with §27's
  "one active blurred surface, contact+glow shadow pair" budget, which this
  spike's structure doesn't exceed.
- **Simultaneous depth layers**: the spike mirrors §27's 3-layer ceiling
  exactly (far/mid/surface) — no more, no fewer.
- **Memory concerns**: nothing in this spike allocates anything unusual
  (no images, no video, no large offscreen buffers) — no expected concern
  from the code as written, though this too is a static read, not a
  measurement.
- **Android-specific concern**: the elevation-only shadow path and the
  historically inconsistent `perspective`/View-clipping behavior noted
  above are the two concrete, named risks — not "Android is generally
  riskier" as a vague hedge.
- **iOS-specific concern**: none identified beyond the general note that
  this container cannot build or test iOS at all (Linux, no Xcode) —
  which is a testing-capability gap, not a code finding.

---

## D. Freeze-frame assessment — VERIFICATION GAP, STATED PLAINLY

**This spike has never been rendered.** This environment has no Android
emulator, no iOS simulator, and no physical device (confirmed absent: `adb`,
`emulator`, `xcrun`). iOS specifically is categorically unreachable from this
container regardless of any tool installed, because RN's iOS build requires
macOS.

Producing a PASS/FAIL/PARTIAL table for six visual states with no way to see
any of them would be exactly the fabrication the previous device-validation
round was explicit about refusing to do. So, per state:

| State | Result |
|---|---|
| Idle | **UNVERIFIED — not renderable in this environment** |
| Thinking | **UNVERIFIED** |
| Depth Build | **UNVERIFIED** |
| Verdict Reveal | **UNVERIFIED** |
| Unveiling | **UNVERIFIED** |
| Remedy | **UNVERIFIED** |

What *is* known without rendering: the code compiles, follows the same
state-machine structure as the browser prototype exactly (same six state
names, same content-reveal-by-shared-value approach), and uses only
primitives that are confirmed to exist in this RN version's type surface —
which is the honest ceiling of what static analysis alone can establish.

## E. Fidelity verdict

**RN FAITHFUL WITH CONSTRAINTS — PROVISIONAL, PENDING VISUAL VERIFICATION.**

This is a qualified, not a confident, call. It rests on real findings (the
translateZ absence and its 2.5D-compatible substitution, the confirmed
missing blur dependency, the iOS/Android shadow divergence) rather than on
having seen the result — because nothing in this environment can produce
that sight. Choosing a stronger verdict (plain "RN FAITHFUL," or the reverse,
"NOT FEASIBLE") would both overstate what a typecheck can tell you about
what something looks like.

## F. Production readiness

Not declared, and not implied by anything above. This is a feasibility
experiment only.

---

## What would resolve the open question

The single remaining gap is the same one for both this spike and the earlier
real-device gate: **something has to actually render this code and someone
has to look at it.** Three ways to close it, in increasing cost:

1. Run this spike (`VerdictSpike`) in whatever RN dev environment exists
   outside this sandboxed container — even a developer's own machine with
   an Android emulator would answer sections D and, informally, the
   Android side of C.
2. Add `@react-native-community/blur` to the spike specifically (not to
   production) to test whether the actual missing-material-cue gap in B can
   be closed cheaply, before deciding whether to bring that dependency into
   Phase 1.
3. Treat this report's confirmed findings (translateZ absence, missing blur
   lib, shadow-platform-divergence) as inputs to the Phase 1 design-token
   work directly, and fold the six-state visual verification into Phase 4's
   own real-device acceptance criteria (§26/§31) rather than gating on a
   second isolated spike round.

Stopping here, as instructed. No further code was written beyond this spike,
no other screens were touched, and no production wiring was added.
