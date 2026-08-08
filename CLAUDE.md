# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Shams al-Asrār ("Sun of Secrets") is a React Native (Android-only, TypeScript) horary-astrology
app. A user asks a question; the app builds a celestial chart for the moment asked and a Cloud
Function runs a deterministic RKP (Krishnamurti Paddhati) judgment engine to return a verdict with
timing, remedy, and confidence. It is a monorepo-style single repo: the RN app lives at the root
(`src/`), and Firebase Cloud Functions live in `functions/`.

## Commands

### App (root)

```bash
npm install
npm start                       # Metro bundler
npm run android                 # build & run on device/emulator (adb devices first)

npm run lint                    # eslint --max-warnings=0
npm run typecheck               # tsc --noEmit
npm run format                  # prettier --write .

npm test                        # jest (excludes firestore.rules.test.ts and functions/)
npm test -- path/to/file.test.ts       # single file
npm test -- -t "test name"             # single test by name
npm run test:watch
npm run test:coverage
npm run test:rules              # firestore.rules.test.ts, needs Firebase emulator (auto-started)
npm run test:e2e                # Maestro flows in .maestro/
npm run check:orphans           # madge — fails CI if dead/unreachable files exist under src/
```

### Cloud Functions (`functions/`)

```bash
cd functions
npm install
npm run build                   # runs sync-engine, then tsc
npm run serve                   # build + firebase emulators:start --only functions,firestore
npm run lint                    # tsc --noEmit + eslint --max-warnings=0
npm test                        # vitest --passWithNoTests
npm test -- path/to/file.test.ts
npm run test:coverage           # v8 coverage, thresholds are 95% for src/engine/**
npm run deploy                  # firebase deploy --only functions,firestore
```

### Root-level Firebase deploy

```bash
firebase deploy --only functions,firestore --project shams-app-4d0e7
```

CI (`.github/workflows/ci.yml`) runs, per push/PR to `main`/`master`: root lint + typecheck +
`npm test -- --runInBand` + `check:orphans`; and in `functions/`: lint (tsc + eslint) + build +
`vitest --run`. A separate job builds a debug APK and runs Maestro E2E. Both the app and functions
quality gates must be green — match that locally before considering work done.

## Architecture

### Two runtimes share one engine, via a build-time file copy — not a symlink

The judgment engine is authored **once**, under `src/astrology/`, and used by both the RN app
(imported as `@astrology/*`) and the Cloud Functions (imported as `@engine/*`). There is no
symlink and no shared npm package: `functions/scripts/sync-engine.mjs` copies
`src/astrology/**/*.ts` into `functions/src/engine/`, rewriting `@astrology/...` imports to
relative paths and replacing `@i18n/types` with a local shim (`functions/src/shims/i18nTypes.ts`)
since the Functions build has no i18n system.

**Consequence for editing engine code: always edit under `src/astrology/`, never under
`functions/src/engine/`** — the latter is regenerated (and stale files pruned) every time
`npm run build` runs in `functions/` (`sync-engine` runs first). Editing the synced copy directly
will be silently overwritten.

Engine layout (mirrored in both locations):

```
src/astrology/
├── primitives/       chart/house-cusp construction, ruling planets
├── kp/
│   ├── judgment/      judgeHorary (verdict logic), significators, significations, timing
│   └── rules/         RKP rule tables
├── types/             Question/Verdict domain types
└── manazil.ts         lunar mansions data
```

The authoritative rule references are `docs/RKP_RULES_FROM_SARFARAZ.md` (methodology) and
`src/astrology/kp/judgment/JUDGMENT_ALGORITHM.md` (implementation notes) — read these before
changing judgment logic, since the rules encode specific astrological doctrine, not arbitrary
business logic.

### Client (`src/`)

- **State**: Zustand stores in `src/stores/` (`authStore`, `quotaStore`, `readingsStore`,
  `settingsStore`) — one store per domain concern, not one global store.
- **Local persistence**: MMKV (`src/storage/`) caches the last N readings for offline access;
  Firestore is the source of truth and syncs in the background.
- **Navigation**: React Navigation — `src/navigation/RootNavigator.tsx` (stack) wraps
  `MainTabs.tsx` (bottom tabs); screens live flat in `src/screens/`.
- **i18n**: `src/i18n/` supports `en`, `ur`, `hi` via `I18nProvider`; UR/HI are interface-only
  (not full content translations per README).
- **Theming**: `src/theme/` — light/dark plus five aesthetic themes (Shams, Falak, Dasha, Maqbool,
  Mardood).
- **Path aliases**: `@/*`, `@components`, `@screens`, `@navigation`, `@stores`, `@hooks`,
  `@theme`, `@i18n`, `@astrology`, `@storage`, `@utils`, `@assets` — defined in both
  `tsconfig.json` (type resolution) and `babel.config.js` (runtime resolution via
  `module-resolver`; must stay in sync when adding a new alias). The `react-native-reanimated`
  Babel plugin must remain last in the plugins list.
- Firebase client SDK glue lives in `src/firebase/`.

### Server (`functions/src/`)

`functions/src/index.ts` is the single entry point exporting every Cloud Function; it's the
fastest way to see the full server API surface. Callable functions receive `request.auth` from
the Firebase Auth SDK; App Check is enforced per-function in production.

- `functions/` — one file per callable/HTTP endpoint (`askOracle`, `activateTrial`, `getQuota`,
  `readings` [`syncReadings`/`deleteReading`], `payments/googlePlay`, `payments/razorpay`,
  `health`, `admin` [`setAdminClaim`], `classifyQuestion`, `classifyIntent`, `inferProfile`,
  `selectRemedies`).
- `middleware/` — `auth.ts`, `rateLimit.ts`, `telemetry.ts`, `validate.ts` (Zod-based request
  validation) — cross-cutting concerns applied to endpoints, not per-endpoint boilerplate.
- `engine/` — **generated**, see above. `utils/admin.ts` (Firebase Admin init, imported first in
  `index.ts` for side effects), `utils/logger.ts`, `utils/requestMeta.ts`.
- Plan tier (`plan`, `planExpiry`) is stored in Firebase Auth **custom claims**, set by
  `verifyGooglePlayPurchase`/`razorpayWebhook`/`setAdminClaim` — not read from a Firestore
  document by the client.

### Data & security model (Firestore)

`firestore.rules` is deny-by-default: the file ends in a catch-all deny, and every collection is
explicitly opened above it (`users`, `quotas`, `readings`, `trials`, `rateLimits`, `auditLogs`,
`securityEvents`, `_system`). Two rules matter most when touching data flow:

1. **Quota, plan, and reading-creation writes are Cloud-Functions-only** (Admin SDK bypasses
   rules) — never add client-side writes to those fields; add a callable function instead.
2. **Owner isolation**: rules gate on `request.auth.uid == resource` owner field — there are no
   cross-user reads.

`firestore.rules.test.ts` (root) exercises these rules directly against the emulator via
`npm run test:rules` — when changing `firestore.rules`, run this rather than relying on unit tests.

## Conventions

- TypeScript strict mode everywhere (`strict`, `noUncheckedIndexedAccess`,
  `noUnusedLocals/Parameters`, etc. — see `tsconfig.json`); `@typescript-eslint/no-explicit-any`
  is an error, not a warning.
- ESLint config extends `@react-native` + `eslint-config-prettier`; Prettier violations are
  ESLint errors (`prettier/prettier: error`), so `npm run format` (or `lint:fix`) before committing.
- `console.log` is disallowed by lint (`no-console`, only `warn`/`error` allowed) — use the
  logger utilities instead of ad hoc `console.log`.
- Input crossing the client→Functions boundary is validated with Zod schemas
  (`functions/src/middleware/validate.ts`); add/extend a schema when adding a new callable
  parameter rather than trusting client input.
- Commit message format: `type(scope): description` (e.g. `feat(oracle): add confidence
  breakdown`). Branch naming: `feature/*`, `fix/*`, `refactor/*`.
