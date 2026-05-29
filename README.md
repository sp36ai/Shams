# Shams al-Asrar

Deterministic RKP horary oracle with Firebase backend and in-app subscriptions.

## Architecture

**Frontend**: React Native Android app with local MMKV cache and Zustand state management.  
**Backend**: Cloud Functions (TypeScript) performing server-side RKP chart judgment.  
**Database**: Firestore with deny-by-default security rules and user-scoped data isolation.  
**Auth**: Firebase Authentication (email/password, Google sign-in).  
**Quotas**: Server-enforced daily limits (free: 100/day, mureed: unlimited, khass: unlimited).  
**Payments**: Google Play IAP subscription with server verification + Razorpay webhook support.  
**Security**: App Check enforcement (outside dev), certificate pinning on Android, input validation via Zod.

## Features

### Judgment (Oracle)
- **Ask**: Capture question → build RKP chart for current moment/saved location → server judgment → narrated verdict with timing/remedy/reasoning
- **Intents**: Follow-up questions (timing, remedy, why) repurpose the chart without recalculating
- **Confidence**: Verdict confidence level with detailed breakdown by judgment phase

### Data & History
- **Local cache**: MMKV stores last N readings for offline access
- **Firestore sync**: Readings automatically sync to user account; deletable on-device or via server
- **History browse**: Filter/sort/detail modal with full reading metadata

### Customization
- **Theme**: Light/dark + 5 aesthetic themes (Shams, Falak, Dasha, Maqbool, Mardood)
- **Language**: EN (English), UR (اردو), HI (हिन्दी)
- **Location**: Capture via GPS during onboarding; fall back to last known location

### Premium (In-App Subscription)
- **Mureed (₹249/month or ₹2,490/year)**: 3 questions/day + full history + remedies
- **Khass (₹699/month or ₹6,990/year)**: Unlimited + confidence breakdown + PDF reports
- **Trial**: 7 days free with 5 questions/day after sign-up

## Backend Endpoints

### User-Facing Callable Functions

- **`askOracle`** — Horary judgment: validates input, enforces quota, builds chart, calls RKP engine, returns verdict
- **`getQuota`** — Returns user's plan, daily usage, and remaining questions
- **`syncReadings`** — Bulk fetch readings from Firestore
- **`deleteReading`** — Delete reading by ID
- **`verifyGooglePlayPurchase`** — IAP verification: contacts Google Play API, updates user plan and custom claims
- **`razorpayWebhook`** — HTTP endpoint for Razorpay subscription events (payment.captured, subscription.activated)

### Admin-Only Functions

- **`setAdminClaim`** — Admin privilege management (admin-only, requires existing admin status)
- **`health`** — Readiness/liveness check (public, no auth required)

## RKP Engine

The authoritative algorithm documents:

- `docs/RKP_RULES_FROM_SARFARAZ.md` — Judgment rules and KP terminology
- `src/astrology/kp/judgment/JUDGMENT_ALGORITHM.md` — Implementation details

The engine code:

```
src/astrology/
  ├── engine/           Core RKP calculations
  ├── kp/
  │   ├── judgment/     Verdict logic + timing + remedy
  │   └── charts/       Chart construction, aspects, yoga
  └── utils/            Ephemeris, coordinates, time math
```

## Build & Run

### Local Development

```bash
npm install
npm start
npm run android
```

Set up emulator or connected device first:

```bash
adb devices
npm run android
```

### Build Release APK

```bash
npm run build
cd android && ./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

### Environment

Copy `.env.example` to `.env.local` and fill:

```env
FIREBASE_PROJECT_ID=shams-app-4d0e7
FIREBASE_API_KEY=...
FIREBASE_ANDROID_API_KEY=...
GOOGLE_PLAY_CLIENT_EMAIL=...
GOOGLE_PLAY_PRIVATE_KEY=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
FIREBASE_EMULATOR_HOST=localhost:9099  # For local dev only
```

## Deployment

**See [DEPLOYMENT.md](./DEPLOYMENT.md)** for end-to-end setup:

- Firebase project creation
- Cloud Build or GitHub Actions CI/CD
- GCP IAM and API prerequisites
- Credential management
- Verification steps

Quick summary:

```bash
firebase deploy --only functions,firestore --project shams-app-4d0e7
```

## Testing

### Client Tests

```bash
npm test                    # Jest: quotaSelectors, judgeHorary
npm run test:rules         # Firestore rules: ~59 suites, needs emulator
```

### Cloud Functions Tests

```bash
cd functions
npm test                    # Vitest (currently minimal coverage)
```

## Directory Structure

```
.
├── .github/               GitHub Actions workflows
├── android/               Android project (gradle, manifests, resources)
├── functions/             Cloud Functions (TypeScript)
│   ├── src/
│   │   ├── engine/        Shared RKP engine (symlinked from src/)
│   │   ├── functions/     Callable and HTTP endpoints
│   │   └── utils/         Firebase admin, validation, logging
│   └── firebase.json      Functions config (region: asia-south1)
├── src/                   React Native app (TypeScript)
│   ├── __tests__/         Jest tests
│   ├── astrology/         RKP engine (shared with functions/)
│   ├── components/        Reusable UI (buttons, cards, modals)
│   ├── hooks/             React hooks (purchase, quota, classifier, timing)
│   ├── i18n/              Translations (EN, UR, HI)
│   ├── navigation/        React Navigation stack and tabs
│   ├── screens/           App screens (auth, splash, ask, history, etc.)
│   ├── storage/           MMKV instance and key registry
│   ├── stores/            Zustand stores (auth, quota, readings, settings)
│   ├── theme/             Theme provider and typography
│   ├── types/             TypeScript ambient declarations
│   └── utils/             Permissions, logging, validators
├── docs/                  Design docs and algorithm explanations
├── cloudbuild.yaml        Cloud Build pipeline (GCP)
├── firestore.rules        Firestore security rules
├── firestore.indexes.json Firestore composite indexes
├── firebase.json          Firebase config (emulator, deploy targets)
├── .firebaserc            Firebase project alias
├── DEPLOYMENT.md          Deployment guide
├── DEPLOYMENT_VERIFICATION_CHECKLIST.md
├── package.json
└── tsconfig.json
```

## Architecture Diagrams

See [ARCHITECTURE_AND_FLOWS_REPORT.md](./ARCHITECTURE_AND_FLOWS_REPORT.md) for:

- Auth flow (sign-in → custom claims → quota sync)
- Ask flow (question → cloud judgment → verdict narration → history)
- Payment flow (IAP purchase → verification → plan upgrade)
- Data sync (Firestore ↔ MMKV cache)

## Security

- **Deny-by-default**: Firestore rules start with explicit deny; only whitelisted paths/operations are allowed
- **Owner checks**: Users can only read/write their own data
- **Cloud Functions privilege**: Quota/plan/reading writes are Cloud Functions only, never from client
- **Input validation**: Zod schemas validate all client → Functions inputs
- **App Check**: Enabled in production; blocks non-mobile clients
- **Certificate pinning**: Android OkHttp pins Firestore, Firebase, and Identity Toolkit domains
- **Audit logging**: All privileged operations logged to `auditLogs` collection (admin-only read)

## Contributing

### Code Style

- TypeScript strict mode
- ESLint + Prettier via pre-commit hooks (if configured)
- Zustand for state, React Navigation for routing, React Native MMKV for local storage

### Git Workflow

- Branch naming: `feature/*`, `fix/*`, `refactor/*`
- Commit message format: `type(scope): description` (e.g., `feat(oracle): add confidence breakdown`)
- All commits must pass TypeScript and ESLint

## Roadmap / Known Limitations

- **Web client**: Not yet implemented (React Native Android only)
- **iOS**: Not yet implemented
- **Offline verdict**: Not yet implemented (Cloud Functions required)
- **Cloud Functions tests**: Minimal coverage (PR welcome)
- **Localization**: Partial (EN complete, UR/HI interface only)

---

**Status**: Private beta with production-style backend controls. Production launch pending full test coverage and final security audit.
