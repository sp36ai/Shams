# Shams-Al-Asrār — Claude Session Handoff

**READ THIS FIRST every session. UPDATE the "Current Session" section before ending.**

---

## Project at a Glance

- **App**: Shams-Al-Asrār — Islamic/Vedic horary astrology oracle (React Native + Firebase)
- **Package**: `com.astrosarfaraz.shamsalasrar`
- **Firebase project**: `shams-app-4d0e7` (region: `asia-south1`)
- **Working branch**: `claude/shams-before-after-file-0zdw2h`
- **Main branch**: `main` (push to working branch, PRs into main)

---

## What Was Completed (Full Audit CP-00 → CP-12)

All 12 audit checkpoints passed. Full details in `AUDIT_PROGRESS.md` and `PRODUCTION_READY.md`.

**Verdict: GO for alpha/beta. HOLD on payments.**

### Bugs Fixed During Audit
| ID | Description |
|----|-------------|
| BUG-01 CRITICAL | Onboarding completion didn't trigger navigation (stuck loop) — fixed via settingsStore |
| BUG-02 HIGH | RootNavigator created second MMKV instance — removed |
| BUG-03 HIGH | Sign-out didn't clear readings from MMKV — fixed |
| BUG-04 MEDIUM | 6555 ESLint CRLF errors — fixed |
| BUG-05 MEDIUM | 3 no-explicit-any violations — fixed |
| BUG-06 MEDIUM | Stale useCallback dep in OnboardingScreen — fixed |
| BUG-07 LOW | SkyClockScreen useMemo dep warning — suppressed correctly |
| BUG-08 LOW | Stale Supabase comments across codebase — all updated |

---

## Remaining Human-Action Items (Not Claude's to do alone)

### CRITICAL — blocks payment launch
1. **Integrate Google Play Billing SDK** (`react-native-iap` or native) — PremiumScreen currently sends `dummy_token`. The cloud function is ready; the client billing flow is not.

### HIGH — before public launch
2. **`google-services.json` not in repo** — provide via CI/CD secret.
3. **No `.env.production`** — create with `FIREBASE_APP_CHECK_DEBUG_TOKEN_ANDROID`.
4. **OkHttp CertificatePinner not wired** in `MainApplication.kt` — Phase 5 task.

### MEDIUM — Phase 2
5. UTC vs local week-boundary mismatch in quota display (server is authoritative; cosmetic only).
6. `saveReading()` in `useReadingHistory.ts` is dead code — delete it.
7. `syncReadings` called only from dead code — verify or remove.
8. `@react-native-firebase/firestore` not in app `package.json` — add if client Firestore reads are needed.

---

## Architecture Quick Reference

| Layer | Tech |
|-------|------|
| Mobile | React Native 0.74.5, Hermes, New Arch OFF |
| State | Zustand + react-native-mmkv |
| Auth | Firebase Auth (email/password + Google) |
| Backend | Firebase Cloud Functions (asia-south1) |
| Rules | Firestore deny-by-default (no client writes) |
| Security | App Check (enforced in prod), Zod validation, R8 full mode |

**Navigation**: Splash → Auth → LocationPermission (first launch) → Main tabs (Oracle | History | Settings)  
SkyClockScreen is a root stack screen, not a tab.

**No Firestore client reads** — all data goes through Cloud Functions. Local cache via MMKV (max 100 readings).

---

## Key File Locations

| What | Where |
|------|-------|
| Cloud functions | `functions/src/` |
| Engine (server-only) | `functions/src/engine/` |
| Stores | `src/store/` |
| Screens | `src/screens/` |
| Navigation | `src/navigation/RootNavigator.tsx` |
| Permissions util | `src/utils/permissions.ts` |
| Storage singleton | `src/storage/mmkv.ts` |
| Android build | `android/app/build.gradle` |
| ProGuard rules | `android/app/proguard-rules.pro` |
| Firestore rules | `firestore.rules` |

---

## Commands

```bash
# TypeScript check
npx tsc --noEmit

# Lint
npx eslint src/ --ext .ts,.tsx

# Tests (29/29 should pass)
npx jest --testPathPattern="src/__tests__"

# Functions TypeScript check
cd functions && npx tsc --noEmit

# Android release build
cd android && ./gradlew assembleRelease
```

---

## Current Session

**Date**: 2026-06-23  
**Branch**: `claude/shams-before-after-file-0zdw2h`  
**Status**: Created this CLAUDE.md handoff file. No code changes yet this session.

**Last completed work**: Full audit CP-00 → CP-12 (all passed). App is GO for alpha/beta.

**What to work on next** (pick one):
- [ ] Delete dead code: `saveReading()` in `src/hooks/useReadingHistory.ts`
- [ ] Delete or verify `syncReadings` usage
- [ ] Start Google Play Billing SDK integration in PremiumScreen
- [ ] Any new feature or bug the user brings up

---

## How to Use This File

**At the START of a session**: Tell Claude "read CLAUDE.md" or just start — Claude reads it automatically.  
**At the END of a session**: Ask Claude to update the "Current Session" section with what was done and what's next.
