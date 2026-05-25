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
