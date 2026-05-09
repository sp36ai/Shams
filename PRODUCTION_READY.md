# Shams-Al-Asrār — Production Readiness Report

Generated: 2026-05-08 | Auditor: Claude Sonnet 4.6 | Audit: CP-00 through CP-12

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
| **Payments UI**  | **HOLD** | PremiumScreen sends dummy_token; Play Billing SDK not integrated |

**Overall: GO for alpha/beta — HOLD on enabling payments.**

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

### CRITICAL (blocking for real payment launch)

1. **Play Billing SDK integration** — PremiumScreen currently sends `purchaseToken: 'dummy_token'` without `packageName`. The `verifyGooglePlayPurchase` Cloud Function is fully implemented; the client-side billing flow is not. Integrate `react-native-iap` or Google Play Billing to obtain real purchase tokens.

### HIGH (should do before public launch)

2. **google-services.json not in repo** — file is gitignored. CI/CD must provide it via a secret/environment variable. Without it, release builds will fail on any CI system.
3. **No .env.production** — create with `FIREBASE_APP_CHECK_DEBUG_TOKEN_ANDROID` for debug builds. See CP-01.
4. **Native certificate pinning not wired** — `MainApplication.kt` has no OkHttp CertificatePinner. Network security config has the pin scaffold commented out. For Phase 5: uncomment the `<domain-config>` block in `network_security_config.xml` and verify pins against live Google endpoints before enabling.

### MEDIUM (Phase 2 / before scaling)

5. **Week key UTC vs local divergence** — server uses UTC Sunday boundary; client uses local time. Near midnight Saturday, the client may show stale quota. Server is authoritative; impact is cosmetic.
6. **saveReading() in useReadingHistory.ts is dead code** — OracleScreen uses addReading() directly. Delete saveReading() to avoid confusion.
7. **syncReadings called only from dead code** — verify it's still needed or remove.
8. **@react-native-firebase/firestore not in app package.json** — add only if client-side Firestore reads are needed (currently all reads go through Cloud Functions).

### LOW (good hygiene)

9. **HistoryScreen FlatList** — no initialNumToRender / windowSize set. Acceptable for 100-item cap.
10. **OkHttp pinning** — add in Phase 5 for defense-in-depth against MITM.

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

1. [ ] Integrate Google Play Billing SDK (react-native-iap or Google Play Billing directly)
2. [ ] Create .env.production with App Check debug token
3. [ ] Set up CI/CD secret for google-services.json
4. [ ] Run `./gradlew bundleRelease` to produce an AAB for Play Store upload
5. [ ] Upload mapping.txt to Play Console (Release > App bundle explorer > Download > deobfuscation file)
6. [ ] Configure Firebase App Check in Play Integrity mode for the production app fingerprint
7. [ ] Set GOOGLE_PLAY_CLIENT_EMAIL + GOOGLE_PLAY_PRIVATE_KEY in Firebase Secret Manager
8. [ ] Deploy Cloud Functions: `cd functions && npm run deploy`
9. [ ] Deploy Firestore rules: `firebase deploy --only firestore`
10. [ ] Verify health endpoint: `curl https://asia-south1-shams-app-4d0e7.cloudfunctions.net/health`

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
| CP-09 | Cloud Functions      | PASS — week key flag          |
| CP-10 | Test Suite           | PASS — 29/29                  |
| CP-11 | Performance / UX     | PASS                          |
| CP-12 | Final Checklist      | This document                 |
