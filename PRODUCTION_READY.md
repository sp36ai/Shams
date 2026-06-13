# Shams-Al-Asrār — Production Readiness Report

Generated: 2026-05-08 | Auditor: Claude Sonnet 4.6 | Audit: CP-00 through CP-12
Updated: 2026-06-13 | All original blockers resolved — see revision notes at bottom

---

## GO / NO-GO VERDICT

| Area             | Status   | Notes                                                            |
| ---------------- | -------- | ---------------------------------------------------------------- |
| Android Build    | **GO**   | 34.5 MB APK, release-signed, debuggable=false                    |
| TypeScript       | **GO**   | tsc --noEmit: 0 errors                                           |
| ESLint           | **GO**   | 0 problems                                                       |
| Test Suite       | **GO**   | 29/29 pass                                                       |
| Permissions      | **GO**   | 6 declared, 2 orphaned removed                                   |
| Firestore Rules  | **GO**   | Deny-by-default, client writes blocked                           |
| Auth Flow        | **GO**   | Sign-in/up/Google/forgot-password all wired                      |
| Engine Integrity | **GO**   | Chart built server-side, client has zero algorithm code          |
| Quota            | **GO**   | Atomic Firestore transaction, plan expiry check                  |
| Rate Limit       | **GO**   | Firestore transaction, 10 req/min per user                       |
| App Check        | **GO**   | enforceAppCheck=true in production                               |
| Security (input) | **GO**   | Zod strict schemas on all endpoints                              |
| Onboarding Flow  | **GO**   | Bug fixed: completion now triggers navigation                    |
| Sign-out Privacy | **GO**   | Readings cleared on sign-out                                     |
| Payment Verify   | **GO**   | Real Google Play Developer API call, not stub                    |
| Network Security | **GO**   | HTTPS-only, user CAs not trusted                                 |
| ProGuard / R8    | **GO**   | Full mode, log stripping, mapping.txt excluded                   |
| **Payments UI**  | **GO**   | usePurchase.ts uses react-native-iap requestSubscription — real tokens |

**Overall: GO for production — all blockers resolved.**

---

## Bugs Fixed During Audit

| ID     | Severity | Description                                                                                                                    | Fix                                                                             |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| BUG-01 | CRITICAL | OnboardingScreen.handleFinish wrote MMKV directly; RootNavigator read it only once at mount → user stuck on Onboarding forever | Moved hasSeenOnboarding into settingsStore with markOnboardingComplete() action |
| BUG-02 | HIGH     | RootNavigator instantiated a second MMKV instance instead of using the shared singleton                                        | Removed; now reads via settingsStore subscription                               |
| BUG-03 | HIGH     | Sign-out did not clear readings from MMKV — readings visible to next sign-in                                                   | Added useReadingsStore.getState().clearAll() in authStore.signOut()             |
| BUG-04 | MEDIUM   | 6555 ESLint CRLF errors (Windows git autocrlf vs Prettier endOfLine:'lf')                                                      | npx eslint --fix                                                                |
| BUG-05 | MEDIUM   | 3 no-explicit-any violations in OracleScreen, PremiumScreen, authStore                                                         | Typed casts applied                                                             |
| BUG-06 | MEDIUM   | OnboardingScreen.handleRequestLocation had stale useCallback dep on handleNext                                                 | Inlined logic with functional setActiveIndex(prev => prev + 1)                  |
| BUG-07 | LOW      | SkyClockScreen useMemo dep warning (focused as intentional trigger)                                                            | eslint-disable-next-line                                                        |
| BUG-08 | LOW      | Stale Supabase comments in firestore.rules, askOracle.ts, network_security_config.xml, proguard-rules.pro                      | All updated to Firebase Auth/Google APIs                                        |

---

## Flags for Human Action (Before Production)

### CRITICAL

~~1. **Play Billing SDK integration**~~ — **RESOLVED**: `usePurchase.ts` uses `react-native-iap` `requestSubscription` / `finishTransaction` to get real purchase tokens and verifies them server-side via `verifyGooglePlayPurchase`.

### HIGH

2. **google-services.json not in repo** — file is gitignored. CI/CD provides it via `GOOGLE_SERVICES_JSON` GitHub secret (base64-encoded). ✅
3. ~~**No .env.production**~~ — **RESOLVED**: `.env.production` created with `APP_ENV=production`, `APP_LOG_LEVEL=info`. App Check debug token wired via env var in `appCheck.ts` when present; empty in production (Play Integrity auto-selected).
4. ~~**Native certificate pinning not wired**~~ — **RESOLVED**: `MainApplication.kt` has OkHttp `CertificatePinner` for `firestore.googleapis.com`, `firebase.googleapis.com`, `identitytoolkit.googleapis.com`. `network_security_config.xml` has matching `<pin-set>` with expiry 2027-05-01.

### MEDIUM

5. ~~**Week key UTC vs local divergence**~~ — **RESOLVED**: `todayKey()` in `quotaStore.ts` now uses local date (user's local midnight). `KEYS.QUOTA_DAY` renamed from `QUOTA_WEEK` for clarity; storage key string `quota.week.v1` unchanged (no migration needed).
6. ~~**saveReading() dead code**~~ — **RESOLVED**: removed (no match in codebase).
7. ~~**syncReadings dead code**~~ — **RESOLVED**: removed (no match in codebase).
8. **@react-native-firebase/firestore not in app package.json** — acceptable; all reads go through Cloud Functions.

### LOW

9. **HistoryScreen FlatList** — no `initialNumToRender`/`windowSize`. Acceptable for 100-item cap.
10. **OkHttp pinning** — already added in `MainApplication.kt`. ✅

---

## Build Artifacts Verified

| Artifact             | Location                                              | Status                  |
| -------------------- | ----------------------------------------------------- | ----------------------- |
| Release APK          | android/app/build/outputs/apk/release/                | 34.5 MB, release-signed |
| Signing key          | ~/.gradle/gradle.properties (SHAMS_UPLOAD_STORE_FILE) | Not in repo ✅          |
| mapping.txt          | android/app/mapping.txt (gitignored)                  | Upload to Play Console  |
| google-services.json | android/app/google-services.json (gitignored)         | Provide via CI secret   |

---

## Next Steps for Play Store Submission

1. [x] Integrate Google Play Billing SDK — done via react-native-iap in usePurchase.ts
2. [x] Create .env.production with App Check config
3. [x] Set up CI/CD secret for google-services.json (GOOGLE_SERVICES_JSON GitHub secret)
4. [ ] Run `./gradlew bundleRelease` to produce an AAB for Play Store upload
5. [ ] Upload mapping.txt to Play Console (Release > App bundle explorer > deobfuscation file)
6. [ ] Configure Firebase App Check in Play Integrity mode for production app fingerprint
7. [ ] Set GOOGLE_PLAY_CLIENT_EMAIL + GOOGLE_PLAY_PRIVATE_KEY in Firebase Secret Manager
8. [ ] Deploy Cloud Functions: `cd functions && npm run deploy`
9. [ ] Deploy Firestore rules: `firebase deploy --only firestore`
10. [ ] Verify health endpoint: `curl https://asia-south1-shams-app-4d0e7.cloudfunctions.net/health`
11. [ ] Trigger CI release workflow → internal track → test on device → promote to alpha/beta

---

## Checkpoint Summary

| CP    | Name                 | Result                        |
| ----- | -------------------- | ----------------------------- |
| CP-00 | Permissions Audit    | PASS — 2 orphaned removed     |
| CP-01 | Project Structure    | PASS — 2 flags for human      |
| CP-02 | TypeScript + ESLint  | PASS — 0 errors after fixes   |
| CP-03 | Firebase Config      | PASS — signOut privacy fix    |
| CP-04 | Engine Integrity     | PASS                          |
| CP-05 | Screen Completeness  | PASS — critical nav bug fixed |
| CP-06 | State Management     | PASS — 3 flags for human      |
| CP-07 | Security Audit       | PASS — stale comments fixed   |
| CP-08 | Android Build Config | PASS                          |
| CP-09 | Cloud Functions      | PASS — week key resolved      |
| CP-10 | Test Suite           | PASS — 29/29                  |
| CP-11 | Performance / UX     | PASS                          |
| CP-12 | Final Checklist      | This document                 |

---

## Revision Notes (2026-06-13)

All original blockers from the CP-00–CP-12 audit have been resolved:

| Item | Resolution |
|------|------------|
| Play Billing (CRITICAL) | `usePurchase.ts` — real `requestSubscription` + server verification |
| `.env.production` (HIGH) | Created with `APP_ENV=production`; debug token wired via env var |
| Certificate pinning (HIGH) | `MainApplication.kt` OkHttp pinner + `network_security_config.xml` pin-set |
| UTC day boundary (MEDIUM) | `todayKey()` now uses local date; `KEYS.QUOTA_DAY` renamed for clarity |
| Dead code saveReading/syncReadings (MEDIUM) | Removed from codebase |

**Status: PRODUCTION READY — trigger CI release workflow to ship.**
