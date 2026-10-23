# CLAUDE.md — Shams al-Asrār (Astro Sarfaraz)

## 1. Project identity

- **Shams al-Asrār — The Hidden Sun of Mystical Astrology.** Brand: Astro Sarfaraz. Android package `com.astrosarfaraz.shamsalasrar`.
- A horary oracle with an Islamic mystical identity for Urdu/Hindi markets (UI languages: en/ur/hi). The seeker asks a question; the server casts an RKP "watch" chart at the server's own instant and returns a verdict, remedy protocol and narration.
- **This is an existing production app. Never treat it as a generic astrology app and never rebuild it.** Read the real code before changing anything.
- Stack: React Native 0.79.7 (React 19, Hermes), TypeScript 5.5, Zustand + react-native-mmkv, React Navigation 7, @react-native-firebase 19 (Auth, App Check, Firestore, Functions, Crashlytics), react-native-iap 16 (Play Billing 8), react-native-tts, @react-native-voice/voice. Backend: Firebase Cloud Functions v2 (Node 22, region `asia-south1`, firebase-functions 7.4, Zod), Firestore, Anthropic (server-side only). Firebase project `shams-app-4d0e7`.

## 2. Core principle

The **RKP Watch Engine is the ONLY authoritative calculation and judgment system.**

Canonical flow:
`Oracle UI → askWatchOracle (callable) → server-side RKP Watch Engine → RKP judgment → responseComposer → Firestore reading + audit log → client → MMKV history`

**RKP calculates. Oracle composes. UI displays. Audio speaks. Client never invents judgment.**

- Engine source of truth is `src/astrology/`. `functions/scripts/sync-engine.mjs` mirrors it into `functions/src/engine/` (run by `npm run build` in functions/; CI runs `verify-engine-sync`). **Edit `src/astrology/`, then sync. Never hand-edit `functions/src/engine/`.**
- The client may import engine *display* tables (`rkp/nomenclature`, `rkp/rules.dignityOf` for Sky Clock) and types only. It must never call `judgeWatchChart`/`buildWatchChart` at runtime.

## 3. Non-negotiable rules

- **Voice = text.** Voice → speech-to-text (`useSpeechToText`) → question text → the same `sendMessage` → `askWatchOracle`. The `'voice' | 'text'` kind is display-only. Voice has no astrology logic.
- **Audio only speaks composed Oracle text.** RKP result → composed text → TTS (`useTextToSpeech`) → playback. Audio never produces a judgment.
- **Sky Clock** (`SkyClockScreen`, `CosmicClock`, `useTimingStrip`, `useHoraCountdown`, `utils/siderealPositions`) is a local/live display. Never a judgment engine.
- **KP and the old astronomical judgment system are intentionally removed** (`askOracle` and `judgeHorary` no longer exist). Never resurrect them via imports, fallbacks, prompts, chart builders, services, types or hidden paths. Keep the shared math primitives (`src/astrology/primitives/`) and provenance docs.
- **Preserve production backend infrastructure:** Auth, App Check (`enforceAppCheck`), Zod validation (`middleware/validate.ts`), rate limiting, quota (`utils/quotaSlots.ts`), idempotency (`utils/idempotency.ts`), Firestore security/ownership rules, reading persistence, audit logs, Google Play verification (`verifyGooglePlayPurchase`), Razorpay webhook.
- **Never invent undocumented RKP rules.** If behavior is unclear, record it as an **OWNER DECISION** (section 10) and stop. Do not change methodology.
  - The owner's definition of RKP ("Shamsi Logic") is `shamsi_method.txt`, which supersedes older framings. **It is NOT in this repo** (see 10). Until it is, the in-repo authority is `docs/RKP_RULES_FROM_SARFARAZ.md` plus owner decisions recorded there.
  - Exactly **5 Ruling Planets**. `horaLord` is only an extended witness, never a 6th RP. (Code currently conflicts: see Known Issues.)
- **User-facing text never uses:** RKP, KP, Ratan Kotamraju Paddhati, sub-lord, significator, Lahiri, Placidus, or Sanskrit astrological terms (nakshatra, lagna, dasha, rashi, bhava…). Use Arabic celestial names and "Shams al-Asrār". Internal code may use engine terms.
  - Display names in code today (`src/astrology/rkp/nomenclature.ts`): Shams, Qamar, Mirrikh, Utarid, Mushtari, Zuhrah, Zuhal, Ras al-Tinnin, Dhanab al-Tinnin. Boundary short forms for the nodes: Ras / Dhanab.
- **Translation boundary (engine → display terms) is server-side:** `functions/src/utils/planetBoundaryName.ts` (structured planet fields leaving the server) + `nomenclature.ts` (display names), enforced on narration by `functions/src/oracle/narrationValidator.ts` (`PROHIBITED_TERMINOLOGY`). Do not add translation elsewhere.
- **No secrets** in the repo or this file. Never print, log or commit keys. Secrets live in Secret Manager (`firebase.json` → `secrets`). Anthropic calls are server-side only (`responseComposer.ts`, `discussionComposer.ts`).
- Remedy practices come only from `functions/src/oracle/remedyLibrary.ts`; the model writes prose, never practices.

## 4. Evidence standard

- Static verification (tests, typecheck, lint) does NOT prove live production correctness.
- Always report three buckets separately: **verified statically** / **verified in production or on device** / **unverified**.
- Never claim something works without naming the evidence: command + result, log line, Firestore doc id, or device test.

## 5. Debugging protocol

- Preserve the stage-tagged diagnostics in `askWatchOracle.ts` (`stage = 'local-time' | 'chart-build' | 'classify-question' | 'judge-chart' | 'oracle-composition' | 'reading-doc-assembly' | 'firestore-write'`). Find the exact failing stage in Cloud Logging before touching engine logic.
- Client-side failures: check App Check gate (`firebase/appCheck.ts`), region (`firebase/functionsRegion.ts`), timeouts (`utils/withTimeout.ts`, 45 s callable deadline) and `errorMessageFor()` in `ReadingScreen.tsx`.
- No shotgun debugging, no rewriting working systems, no duplicated calculations. Smallest evidence-based change, with a regression test that fails without the fix.

## 6. Workflow rules

- Use plan mode and list the files you will touch BEFORE editing: the Oracle pipeline, RKP engine (`src/astrology/`), auth, quota, billing, Firestore rules, or Cloud Functions.
- Definition of done, every task: files changed; commands run with results; what remains unverified; the manual device/production check the owner should do.
- Release policy: Play Store releases come only from `main` with green CI (`release-play-store.yml` triggers on a completed CI run on `main`).
- Current priority: a premium WhatsApp-style conversational Oracle — text + voice questions, Oracle replies, audio playback, continuation (follow-ups via `discussReading`), history, loading/error/retry states — with the RKP engine isolated and authoritative.
- Do not create PRs, deploy, or push to `main` unless asked.

## 7. Repo map (confirmed paths)

```
src/
  App.tsx                         app root (contains a TEMPORARY diagnostic, see 9)
  navigation/RootNavigator.tsx    Splash → Auth → LocationPermission → Onboarding → MainTabs
  navigation/MainTabs.tsx         bottom tabs
  screens/OracleScreen.tsx        Oracle home (ask composer, voice entry)
  screens/ReadingScreen.tsx       chat thread: sendMessage → askWatchOracle / discussReading, retry, voice
  screens/ReadingsScreen.tsx      history / reading detail
  screens/SkyClockScreen.tsx      live sky display (display only)
  screens/PremiumScreen.tsx       paywall
  components/oracle/              ChatBubble, ChatComposer, RkpWatchCard, RemedyProtocolCard, VerdictSeal, …
  components/home/                CosmicClock, HomeAskComposer, HoraBadge, ManzilEmblem, …
  firebase/watchOracle.ts         ONLY client caller of askWatchOracle
  firebase/functionsRegion.ts     regionalFunctions() — asia-south1; use for every callable
  firebase/oracleDiscussion.ts    discussReading client
  hooks/usePurchase.ts            react-native-iap 16 → verifyGooglePlayPurchase
  hooks/useQuota.ts               getQuota sync (plan/planExpiry/remaining)
  hooks/useSpeechToText.ts        STT (@react-native-voice/voice)
  hooks/useTextToSpeech.ts        TTS (react-native-tts, patched)
  stores/                         authStore, quotaStore, settingsStore, readingsStore, readingThreadsStore
  storage/mmkv.ts                 single MMKV instance + KEYS registry (history lives here)
  theme/themes.ts                 8 themes + tier gating; theme/typography.ts fonts
  i18n/strings/{en,ur,hi}.ts      all user-facing copy
  astrology/rkp/                  RKP watch engine: watchGrid, watchChart, watchJudgment, diagnosis, rules, nomenclature
  astrology/primitives/           shared math: ephemeris (moshier), ayanamsa, cusps, subLord, rulingPlanets, chartBuilder
  astrology/kp/rules/             houseMatrix + questionKeywords (still used by RKP; name is legacy)
  astrology/manazil.ts            lunar mansions
functions/src/
  index.ts                        exports all functions
  config.ts                       region, limits, secrets bindings
  functions/askWatchOracle.ts     the Oracle callable (stage-tagged)
  functions/discussReading.ts     follow-up turns (free, capped at DISCUSSION_TURN_LIMIT=12)
  functions/payments/             googlePlay.ts, razorpay.ts
  oracle/responseComposer.ts      composes verdict + remedy + narration (Anthropic)
  oracle/remedyLibrary.ts         remedy library (authoritative practices)
  oracle/narrationValidator.ts    forbidden-term / leakage gate
  prompts/watchOracleSynthesisPrompt.ts, prompts/oracleDiscussionPrompt.ts
  engine/                         GENERATED mirror of src/astrology — do not edit
  middleware/                     auth, rateLimit, validate (Zod), telemetry
firestore.rules, firestore.rules.test.ts, firebase.json
.github/workflows/                ci.yml, release-play-store.yml, deploy-functions.yml, firestore-rules-tests.yml, …
.maestro/ci/                      E2E flows
docs/RKP_RULES_FROM_SARFARAZ.md   in-repo RKP rules + owner decisions
docs/audit/                       phase audit history (provenance)
.claude-context/                  cross-session notes (current-task, session-log, …)
```

Needs owner review: empty files `dasha.ts` (root) and `docs/timing.ts`; ~25 stale status reports at repo root (`*_STATUS*.md`, `PRODUCTION_*.md`, …); `context-server.js`.

## 8. Commands (PowerShell, from repo root)

| Task | Command | Status |
|---|---|---|
| Install app deps | `npm ci` | ✅ ran |
| Install functions deps | `npm --prefix functions ci` | ✅ ran |
| Metro | `npm start` (`npm run start:reset` to clear cache) | not run |
| Run on Android | `npm run android` | not run |
| Typecheck | `npm run typecheck` | ✅ 0 errors |
| Lint | `npm run lint` | ✅ 0 warnings |
| Jest (app) | `npm test -- --runInBand` | ✅ 32 suites / 348 tests |
| Orphan check | `npm run check:orphans` | not run |
| Firestore rules tests (needs Java) | `npm run test:rules` | not run |
| Engine mirror check | `npm --prefix functions run verify-engine-sync` | ✅ in sync |
| Functions lint (tsc + eslint) | `npm --prefix functions run lint` | ✅ |
| Vitest (functions) | `npm --prefix functions test -- --run` | ✅ 32 files / 673 tests |
| Functions build (sync + tsc) | `npm --prefix functions run build` | ✅ tsc only |
| Emulators | `.\Start-Dev.ps1` | not run |
| Deploy functions + rules | `npm --prefix functions run deploy` — only when asked | not run |
| Android debug APK | `Set-Location android; .\gradlew.bat assembleDebug; Set-Location ..` | not run |
| Android release AAB | `Set-Location android; .\gradlew.bat bundleRelease; Set-Location ..` | not run |

`npm run build:android:*` use `./gradlew`, which may not resolve under Windows `cmd`; prefer the `gradlew.bat` form above.

## 9. Known issues (verified 2026-10-08 against `main` @ 643f899)

a. **Oracle silent failure** — [NOT REPRODUCED/STALE statically; production UNVERIFIED]. The callable is `askWatchOracle` (`askOracle` is gone). Client uses `regionalFunctions()` → `asia-south1`, matching `functions/src/config.ts`. Submit gate in `ReadingScreen.tsx` is synchronous (`canAsk`/`consumeOne`); it does not await `usePurchase`/`useQuota`. App Check wait is bounded (8 s), call deadline is 45 s with a mapped error bubble. Needs a device test + Cloud Logging check that POSTs reach the function.
b. **Billing** — [CONFIRMED different from older notes]. `usePurchase.ts` is a real implementation using **react-native-iap 16.6.2** (Play Billing 8, PR #123), not expo-iap and not a stub. Kotlin pinned to 2.1.20 in `android/build.gradle`; no expo-iap present. Remaining chain is [UNVERIFIED]: Play Console SKUs (`mureed_monthly`, `mureed_annual`, `khass_monthly`, `khass_annual`) → service-account secrets → real purchase on device → `verifyGooglePlayPurchase`.
c. **Crash on login (late July 2026)** — [UNVERIFIED]. Later auth fixes exist (#169 "apply the signed-in user directly", bootstrap timeouts); no device evidence in repo.
d. **Naming leftovers** — [CONFIRMED], owner decision, do not rename/delete:
   - Shared math primitive (legitimate): `primitives/subLord.ts`, `rulingPlanets.ts`, `chartBuilder.ts`, `constants.ts`, `types/chart.ts`, `types/verdict.ts` (KP-era types for legacy readings).
   - Naming/provenance only: `astrology/kp/rules/*` (houseMatrix, questionKeywords used by RKP), code comments in `watchGrid.ts`, `themes.ts`, `favoredQuestion.ts`, `watchReadingRecord.ts`, `permissions.ts`, `askWatchOracle.ts`, `quotaSlots.ts`, `quota.ts`; stale reference to non-existent `judgeHorary.ts` in `planetBoundaryName.ts`.
   - No `KpChartGrid.tsx` or "Kotamraju" found. No active KP judgment path found.
   - **User-visible violations:** `SkyClockScreen.tsx` shows "Nakshatra", "SIDEREAL (LAHIRI)", and a disclaimer "Horary judgment uses the full KP engine on the server" (also factually wrong); `ReadingsScreen.tsx` renders "Significators" / "Moon Sub-Lord" for legacy readings with `moonSubLord`; `CosmicClock.tsx` and `siderealPositions.ts` comments say "full KP engine".
e. **Location** — [CONFIRMED not wired to judgment]. `LocationPermissionScreen` + `utils/acquireLocation.ts` exist, but `askWatchOracle` deliberately sends **no lat/lon**; the watch engine discards cusps (`watchChart.ts` uses inert coordinates). No cuspal sub-lord math runs in the live path. Conflicts with the "collect real location for cuspal sub-lord math" decision → owner decision.
f. **Play Console** — Target SDK 36 [CONFIRMED in `android/app/build.gradle`]. Data Safety disclosure for server-side AI use, developer verification: [UNVERIFIED — owner action]; `docs/OWNER_LAUNCH_CHECKLIST.md` does not cover them.
g. **Performance notes (sub-lord memoization, RP × significator loops)** — [NOT REPRODUCED/STALE]: the live watch judgment uses neither sub-lords nor significator loops.
h. **Ruling planets conflict** — [CONFIRMED]. `primitives/rulingPlanets.ts#getRulingPlanets` returns a 6-tuple including `horaLord`, and `docs/RKP_RULES_FROM_SARFARAZ.md §4` lists "Hora Lord (Confirmatory)" as #6. `types/verdict.ts` says 5. Not used by watch judgment today. Owner decision; do not "fix" silently.
i. **Rules doc vs engine** — [CONFIRMED]. `RKP_RULES_FROM_SARFARAZ.md §1, §5` describes a Lahiri/Placidus Moon-sub-lord 5-step flow; the live engine is the watch-frame weighted judgment (`watchJudgment.ts`). Doc is partly stale.
j. **Testing overrides still on** — [CONFIRMED]: free/trial limit 50/day (`functions/src/config.ts`, `src/stores/quotaStore.ts`, both TEMPORARY, revert to 3/5 together); all themes unlocked (`theme/themes.ts` TEMPORARY flag); TEMPORARY diagnostic in `src/App.tsx` (PR #118).
k. **E2E** — [CONFIRMED per `.claude-context/current-task.md`]: settings-signout needs `E2E_TEST_ACCOUNT_*` secrets (issue #130); signup-journey flakes from runner CPU starvation.
l. **Emulator port mismatch** — `Start-Dev.ps1` prints Firestore `:8282`; `firebase.json` uses `8080`. Minor.
m. No skipped/only tests found (`.skip`, `.only`, `xit`).

## 10. Owner decisions pending

- [ ] Provide `shamsi_method.txt` (not in repo) and confirm it supersedes `docs/RKP_RULES_FROM_SARFARAZ.md`; which sections of that doc are stale (9i)?
- [ ] Ruling planets: confirm exactly 5 and that horaLord is a witness only; then align `getRulingPlanets` and rules doc §4 (9h).
- [ ] Location: does the watch engine stay location-free, or should real querent location feed a cuspal/sub-lord layer? If the latter, which rules? (9e)
- [ ] Sky Clock copy: replace "Nakshatra", "SIDEREAL (LAHIRI)", "full KP engine" with approved Arabic/neutral wording (9d).
- [ ] Legacy readings: keep, relabel, or hide the "Significators / Moon Sub-Lord" block in `ReadingsScreen` (9d).
- [ ] Rename `astrology/kp/rules/` → RKP naming? (touches engine sync + imports)
- [ ] Moon/Venus/node display spellings: code uses Qamar / Zuhrah / Ras al-Tinnin–Dhanab al-Tinnin (boundary: Ras/Dhanab); brief requested al-Qamar / Zuhra / Rahu / Ketu. Which is canonical?
- [ ] When to revert testing overrides (limits 50→3/5, theme unlock, App.tsx diagnostic).
- [ ] Remedy mapping and EN/UR/HI narration wording are still "provisional" per rules doc §8.
- [ ] Empty `dasha.ts`, `docs/timing.ts`, and stale root status reports: delete or archive?

## 11. Maintenance

Keep this file short. Update Known Issues and Repo Map when they change. Move long details to docs/ and link them.
