# Shams al-Asrār — The Sun of Secrets

## What It Is

Shams al-Asrār is a horary oracle — a modern vessel descended from centuries of Muslim scholarly tradition. It is not a horoscope. It is not a personality test. It is celestial counsel — precise, ancient, and deeply serious.

For seekers with real questions. People in transition. Those facing genuine choice-points. Anyone who believes the cosmos speaks, and knows how to listen.

## The Name

**Shams al-Asrār** means "Sun of Secrets." In the horary tradition, the sun is the supreme governor of time. Every hour of every day is ruled by the sun's motion through the heavens. Your question arrives in a specific moment — precise to the second. This oracle reads that moment: the sun's position, the stars' arrangement, what the advancing light of that precise second illuminates about your situation.

Five celestial powers converge at the instant of your question — the cosmic validators. When these forces align, the truth is certain. When they scatter, the answer grows complex — but it is still true.

## The Oracle

**Digital Watch Oracle** — the app's sole oracle mode. Answers anchored to your precise timestamp: the house frame comes from the 5-minute bracket of the exact watch-minute you ask in, not a horoscope's local horizon. No location or birth data needed — it can answer the instant you open the app.

An earlier location-based **Astronomical Oracle** mode (a true-Ascendant chart via Placidus houses) was retired from the client — see "Celestial Engine" below for what remains of it in the codebase.

## Subscription Tiers

**Free Trial:** 7 days full access.

**Mureed (₹249/month):** 3 questions per day. Perfect for regular seekers. Annual: ₹2,490 (2 months free).

**Khass (₹699/month):** Unlimited questions, exportable reports, reading archive, direct feedback channel. Annual: ₹6,990 (2 months free).

## The Brand

Built by **Astro Sarfaraz** — a solo developer, owner, and practicing celestial scholar with deep knowledge of horary and mystical traditions. Shams al-Asrār is a labor of spiritual and technical precision.

---

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

- **Ask**: Capture question → build celestial chart for the current watch-minute (no location needed) → server judgment → narrated verdict with timing/remedy/reasoning
- **Intents**: Follow-up questions (timing, remedy, why) repurpose the chart without recalculating
- **Confidence**: Verdict confidence level with detailed breakdown by judgment phase

### Data & History

- **Local cache**: MMKV stores last N readings for offline access
- **Firestore sync**: Readings automatically sync to user account; deletable on-device or via server
- **History browse**: Filter/sort/detail modal with full reading metadata

### Customization

- **Theme**: Light/dark + 5 aesthetic themes (Shams, Falak, Dasha, Maqbool, Mardood)
- **Language**: EN (English), UR (اردو) actively maintained; HI (हिन्दी) frozen — see Roadmap
- **Location**: Capture via GPS during onboarding; fall back to last known location

### Premium (In-App Subscription)

- **Mureed (₹249/month or ₹2,490/year)**: 3 questions/day + full history + remedies
- **Khass (₹699/month or ₹6,990/year)**: Unlimited + confidence breakdown + PDF reports
- **Trial**: 7 days free with 5 questions/day after sign-up

## Backend Endpoints

### User-Facing Callable Functions

- **`askWatchOracle`** — the live judgment endpoint: validates input, enforces quota, builds the watch-frame chart, calls the RKP celestial engine, returns verdict + remedy composition
- **`discussReading`** — the follow-up conversation endpoint: answers questions *about* a reading already given. Loads the reading server-side (ownership enforced), so the reply is grounded in the verdict that was actually issued and can never revise it. Spends no quota — a reading is the unit charged, and understanding it is part of what was bought — and is bounded instead at 12 follow-up turns per reading. A follow-up that is really a new horary question is flagged rather than answered, and the app offers to ask it as a fresh reading
- **`classifyQuestion`** / **`classifyIntent`** — Layer-1 question gate and follow-up intent classification (Claude Haiku)
- **`getQuota`** — Returns user's plan, daily usage, and remaining questions
- **`syncReadings`** — Bulk fetch readings from Firestore
- **`deleteReading`** — Delete reading by ID
- **`verifyGooglePlayPurchase`** — IAP verification: contacts Google Play API, updates user plan and custom claims
- **`razorpayWebhook`** — HTTP endpoint for Razorpay subscription events (payment.captured, subscription.activated)

### Admin-Only Functions

- **`setAdminClaim`** — Admin privilege management (admin-only, requires existing admin status)
- **`health`** — Readiness/liveness check (public, no auth required)

## Celestial Engine

The authoritative algorithm document:

- `docs/RKP_RULES_FROM_SARFARAZ.md` — Judgment rules and horary methodology

The engine code:

```
src/astrology/
  ├── primitives/       Ephemeris, ayanamsa, sidereal time, house cusps, sub-lords
  │   └── moshier/      Meeus/VSOP87 sun, moon and planet series
  ├── kp/
  │   └── rules/        House matrix, nakshatras, vimshottari, keywords — shared
  │                      with the RKP engine below, not KP-exclusive
  ├── rkp/              Digital Watch Oracle — the only judgment engine that ships
  └── types/            Chart, question and verdict contracts
```

### One engine, ever since the astronomical (KP) path was deleted

The client ships a single oracle mode — the **Digital Watch Oracle**
(`rkp/watchChart.ts`). Its house frame comes from the 5-minute bracket of the
querent's local watch minute, not a horoscope's local horizon — a
**moment-selected** house frame, of the same class as KP's 1–249 number
method, where a querent-chosen number rather than the local horizon fixes
the Ascendant. It is not a horizon computation and must never be described
as one. See the header of `src/astrology/rkp/watchGrid.ts`.

Because the watch frame replaces the cusps and planetary positions are
location-invariant, a Watch reading needs nothing from the querent — no birth
data, and no location either. It can run the moment the app opens.

An earlier **Astronomical Oracle** mode — a true-Ascendant chart built by
`primitives/chartBuilder.ts` (RAMC, obliquity, latitude, Placidus houses,
location required) — was retired from the ask screen's `runEngine()`
first (it needed a location the watch frame doesn't, and running both per
question would have double-charged the querent's quota for one question),
then deleted outright once confirmed unreachable: the `judgeHorary()`
judgment function and its helpers (`kp/judgment/`), the `askOracle` Cloud
Function, and its dedicated LLM synthesis prompt are gone. `AstroVerdictCard`
and the `AstroVerdictResult`/`SignificatorSets` types in `types/verdict.ts`
are kept — deliberately, not an oversight — purely to render readings taken
before the migration; nothing live produces that shape anymore. The
`kp/rules/` tables (house matrix, nakshatras, vimshottari, question
keywords) and the whole `primitives/` layer survive because the RKP engine
itself depends on them — they were never KP-exclusive.

The engine reads a real ephemeris —
Meeus/VSOP87 series with heliocentric→geocentric conversion, Lahiri
ayanamsa, genuine retrograde and combustion state — and feeds the remedy
layer — the 38 tagged practices in
`src/data/remedyLibrary.ts` (salawat, dua, istikhara, sadaqa, fasting, Qur'an,
dhikr, charity, night prayer, silence, tawbah). `src/data/watchRemedyContext.ts`
translates a watch verdict into the ranker's vocabulary: the obstructing planet
describes the _shape_ of the difficulty, which is what selects an apt response.

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
│   │   ├── engine/        Shared celestial engine (symlinked from src/)
│   │   ├── functions/     Callable and HTTP endpoints
│   │   └── utils/         Firebase admin, validation, logging
│   └── firebase.json      Functions config (region: asia-south1)
├── src/                   React Native app (TypeScript)
│   ├── __tests__/         Jest tests
│   ├── astrology/         Celestial engine (shared with functions/)
│   ├── components/        Reusable UI (buttons, cards, modals)
│   ├── hooks/             React hooks (purchase, quota, classifier, timing)
│   ├── i18n/              Translations (EN, UR, HI)
│   ├── navigation/        React Navigation stack and tabs
│   ├── screens/           App screens (auth, splash, Reading, Your Readings, etc.)
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
- **Localization**: EN complete, UR interface complete and actively maintained
- **Hindi (hi) is frozen, not removed**: as the product focuses on its Urdu/Arabic-speaking
  audience, `hi` is no longer backfilled with new strings. It remains a valid language —
  persisted `hi` still loads and renders, new keys fall back to English, and users already on
  Hindi keep a working picker control (and a way to switch away). New users are not offered it.
  To resume support, flip `status` back to `'active'` in `src/i18n/types.ts` and backfill
  `src/i18n/strings/hi.ts`; no other code changes are needed.

---

**Status**: Private beta with production-style backend controls. Production launch pending full test coverage and final security audit.
