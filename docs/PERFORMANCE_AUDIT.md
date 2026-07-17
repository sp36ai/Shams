# Performance & Bundle Size — Audit (static)

Static analysis only — true runtime profiling (cold start, frame rate, memory,
APK size breakdown) needs a device + profiler and is out of scope here.

## Change — removed a 2 MB orphaned asset

`assets/images/sky-clock-disk.png` (2.0 MB) was referenced **nowhere** in the
codebase, and `react-native.config.js` registers only `assets/fonts/` as an
asset source (not `assets/images/`), so it was never `require()`d or linked —
dead weight in the repo. Removed. (It was almost certainly not in the shipped
APK either, since Metro only bundles referenced assets, but this eliminates the
ambiguity and shrinks the repo.) It was by far the largest tracked asset; the
next-largest tracked files are just lockfiles and the gradle wrapper.

## Verified sound (no change)

- **Lists are virtualized.** `HistoryScreen` and `OracleScreen` use `FlatList`.
  The `.map()` calls that remain are over bounded, small collections (filter
  chips, a single reading's reasoning steps in a modal) — not long lists.
- **Timers are focus-gated.** `CosmicClock`'s `setInterval` runs only when the
  Sky-Clock screen is focused *and* the clock is expanded; `SkyClockScreen`'s
  timing `setInterval` lives inside `useFocusEffect`. No always-on JS timers.
- **Animations use the native driver.** `StarfieldBackground` sets
  `useNativeDriver: true` on every loop, so its continuous animation runs on the
  UI thread and keeps the JS thread clear (and RN pauses it when the app is
  backgrounded).
- **The judgment engine is server-side** — the client does no heavy ephemeris
  or scoring work on the main thread for a reading. `CosmicClock`'s client-side
  ephemeris is display-only and interval-throttled behind focus+expand.
- `react-native-reanimated` / `react-native-svg` are heavy libraries but are
  genuinely used (animations, the horary chart wheel) — not removable.

## Recommend (needs a device)

- Profile **cold start** and first-frame time; measure the AAB size breakdown
  (`bundletool`) per ABI.
- One minor optional win: `StarfieldBackground`'s native-driver loop is not
  focus-gated, so it keeps animating on mounted-but-off-screen screens. Native-
  driver cost is low, but gating it behind `useIsFocused` would save a little
  GPU/battery on multi-screen navigation. Left out to avoid destabilising the
  animation lifecycle without on-device verification.
