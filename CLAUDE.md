# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Shams al-Asrar** is a React Native horary astrology app implementing the Krishnamurti Paddhati (KP) system. It combines a deterministic astronomical/astrological judgment engine with Firebase backend services and a multi-language UI (English, Urdu, Hindi).

## Commands

### Mobile App (root)

```bash
npm install                        # Install dependencies
npm start                          # Start Metro bundler
npm start:reset                    # Start with cache reset
npm run android                    # Launch Android app on device/emulator

# Build
npm run build:android:debug        # Debug APK
npm run build:android:release      # Release APK
npm run bundle:android             # AAB for Play Store
npm run clean:android              # Clean Android build cache

# Code quality (all must pass with zero warnings/errors)
npm run lint                       # ESLint (--max-warnings=0, strict)
npm run lint:fix                   # Auto-fix linting issues
npm run typecheck                  # TypeScript type checking
npm run format                     # Prettier formatting

# Tests
npm test                           # Jest unit tests
npm run test:watch                 # Watch mode
npm run test:coverage              # Coverage report
npm run test:rules                 # Firestore security rules tests
npm run check:orphans              # Find unused modules
```

### Cloud Functions (`/functions`)

```bash
cd functions
npm run build                      # Compile TypeScript
npm run serve                      # Start Firebase Emulators (functions + firestore)
npm run deploy                     # Deploy to Firebase
npm run lint                       # Lint functions
npm run test                       # Vitest unit tests
npm run test:ui                    # Vitest UI dashboard
```

## Architecture

### Core Data Flow

1. **Horary Chart Cast:** User enters a question in `OracleScreen` → device location + timestamp are captured → `src/astrology/primitives/chartBuilder.ts` computes chart using Swiss Ephemeris → `judgeHorary` engine applies KP rules → verdict displayed and persisted.

2. **Cloud Sync:** Request hits `askOracle` Cloud Function → middleware validates (auth, App Check, rate limit, quota) → deterministic KP engine runs server-side → LLM synthesizes a natural language answer → result returned to client.

3. **Security Pipeline:** `App.tsx` runs `runSecurityChecks()` before UI mounts → Firebase App Check validates device integrity → all Cloud Functions enforce App Check tokens → Firestore rules gate all data access.

### Key Directories

| Path | Purpose |
|------|---------|
| `src/astrology/` | KP horary engine: astronomical calculations, house cusps, sub-lords, ruling planets, lunar mansions |
| `src/astrology/kp/` | KP judgment logic and verdict derivation |
| `src/screens/` | UI screens (Splash → Auth → Location → Oracle/History/Settings/SkyClock) |
| `src/navigation/` | React Navigation state machine; `RootNavigator` drives app flow, `MainTabs` handles bottom tabs |
| `src/stores/` | Zustand stores: `authStore`, `readingsStore`, `settingsStore`, `quotaStore` |
| `src/firebase/` | Firebase client initialization, App Check, and Cloud Functions client (`oracle.ts`) |
| `src/i18n/` | Internationalization: `strings/` holds EN/UR/HI translations |
| `src/theme/` | Design system: themes, typography, `ThemeProvider` |
| `functions/src/` | Firebase Cloud Functions backend |
| `functions/src/functions/` | Individual callable functions: `askOracle`, `quota`, `readings`, `admin`, `health` |
| `functions/src/middleware/` | Reusable function middleware: validation, auth, rate limiting, telemetry |
| `docs/` | Architecture docs, KP rules reference, security strategy guides |

### State Management

All persistent state uses Zustand stores backed by MMKV. Stores are in `src/stores/`:
- `authStore` — Firebase Auth session and user identity
- `readingsStore` — Local horary chart history (never uploaded by default)
- `settingsStore` — User preferences (locale, theme, saved location)
- `quotaStore` — Daily/weekly usage limits and trial/subscription status

### Navigation State Machine

`RootNavigator` enforces a linear flow: `Splash → Auth → LocationPermission → Main`. Users cannot reach the main app without completing auth and granting location. The main app uses bottom tabs (Oracle | SkyClock | History | Settings) defined in `MainTabs`.

### TypeScript Path Aliases

`@/*` maps to `src/*` (configured in `tsconfig.json` and `babel.config.js`). Always use `@/` imports for src-rooted paths.

## Code Standards

- **TypeScript strict mode** — `noImplicitAny`, `noUnusedLocals`, `strictNullChecks` are all on. The `@typescript-eslint/no-explicit-any` rule is set to `error`.
- **ESLint zero warnings** — `npm run lint` uses `--max-warnings=0`; all lint issues are blocking.
- **Prettier** — 2-space indent, single quotes, 100-char line width, trailing commas.
- **Reanimated plugin** — The Reanimated Babel plugin must remain the **last** entry in `babel.config.js`.
- **Environment variables** — Secrets (App Check debug token, Razorpay keys, Sentry DSN) go in `.env`, modeled after `.env.example`. Never commit `.env`.

## KP Astrology Engine

The judgment engine in `src/astrology/` is deterministic and well-documented. The authoritative rules are in `docs/RKP_RULES_FROM_SARFARAZ.md`. When modifying judgment logic:
- Changes to `primitives/` affect all calculations globally
- The `kp/` layer translates raw chart data to verdicts using house significations
- Unit tests in `src/__tests__/judgeHorary.test.ts` cover core verdict logic — run them after any engine change

## Testing Notes

- **Frontend tests**: Jest, configured in `package.json`. Tests live in `src/__tests__/`.
- **Functions tests**: Vitest, configured in `functions/vitest.config.ts`. Tests live in `functions/src/__tests__/`.
- **Firestore rules tests**: TypeScript, run with `npm run test:rules` from root.
- Run a single Jest test file: `npx jest src/__tests__/judgeHorary.test.ts`
- Run a single Vitest test file: `cd functions && npx vitest run src/__tests__/<file>`

## Shams al-Asrār — Product Identity
- App name: Shams al-Asrār | Brand: Astro Sarfaraz
- App ID: com.astrosarfaraz.shamsalasrar
- Target markets: India, Pakistan, Bangladesh (Urdu/Hindi speakers)
- Positioning: symbolic destiny engine wrapped inside an Islamic mystical oracle experience
- NOT a horoscope / zodiac / tarot / chatbot app
- Soul pillars: hidden timing, destiny intersections, karmic echoes, celestial pressure waves, spiritual remedies

## RKP Engine (NEVER surface to users)
- Internal engine: RKP (Ratan Kotamraju Paddhati) — refined horary built on KP
- Ephemeris: Moshier | Ayanamsa: Lahiri | Houses: Placidus
- KP 4-level chain: sign lord → star lord → sub lord → sub-sub lord
- Kotamraju filter: strips false significators whose own sub-lord points to denial houses
- Sub-lord of primary cusp = verdict bearer
- 5 Ruling Planets: day lord, Asc sign lord, Asc star lord, Moon sign lord, Moon star lord
- horaLord is NOT a 6th RP — appended separately as extended witness at judgment time
- NO Vimshottari Dasha, NO birth chart, NO natal native — horary only
- Timing: 3-condition RP intersection, not confirmedSignificators[0] shortcut
- Verdict kinds: CONFIRMED (HIGH/MEDIUM/LOW), DENIED (HIGH/MEDIUM/LOW)

## Arabic Terminology Rules (Strict)
- 28 lunar stations = Al-Manāzil al-Qamar → functions/src/engine/manazil.ts
- Arabic-only celestial names in ALL user-facing output: Shams, al-Qamar, Zuhal, Mushtari, Zuhra, al-Mirrikh, Utarid
- FORBIDDEN in user-facing text: Sanskrit planet names, nakshatra names, dasha terminology, house numbers, engine/mode names, formula values, raw sublord chains
- Column header: Manzil Lord (NOT Nak Lord) in HoraryChartWheel.tsx

## Oracle Modes
- WatchVerdictCard: Digital Watch RKP mode
- AstroVerdictCard: Astronomical RKP mode (HoraryChartWheel + KpChartGrid toggle)
- Both route through OracleScreen with Zustand-backed useReadingHistory
- Claude model: claude-opus-4-5 | max_tokens: 1024
- Defensive JSON parse fallback: render Āyat al-Kursī on failure

## Oracle Response Structure
1. Cosmic introduction
2. Unveiling / outcome
3. Quranic verse
4. Dua
5. Asma al-Husna recommendation
6. Practical remedy (Quranic verse → Asma al-Husna → Dua → Zikr → Sadaqah)
7. Closing: "✨ These words are unveiled under the banner of Shams al-Asrār, by Astro Sarfaraz."

## Monetization
- Tiers: free | mureed | khass
- Mureed: ₹249/month, ₹2490/year — 3 questions/day
- Khass: ₹699/month, ₹6990/year — unlimited + both oracle modes + PDF reports
- 7-day free trial, hard paywall on day 8 | Quota: daily (not weekly rolling)
- SKUs: mureed_monthly, mureed_annual, khass_monthly, khass_annual

## Design Tokens
- Fonts: Cinzel-Regular, Cinzel-SemiBold, CormorantGaramond-Regular, CormorantGaramond-Italic
- Confirmed: #4CAF82 | Denied: #E05A5A | Theme: deep-space SVG, gold/navy
- All colors from src/theme/colors.ts — zero hardcoded hex in components

## Current Blocker (Update after resolution)
Play Console: SKUs not yet created (mureed_monthly, mureed_annual, khass_monthly, khass_annual)
  → GCP: Confirm service account has Play Developer API access
    → Claude Code: Install react-native-iap, wire usePurchase.ts, update PLAY_PRODUCT_MAP
      → Firebase: Verify verifyGooglePlayPurchase function receives + writes correctly
