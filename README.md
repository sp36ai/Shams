# Shams al-Asrār — The Sun of Secrets

## What It Is

Shams al-Asrār is a horary oracle — a modern vessel descended from centuries of Muslim scholarly tradition. It is not a horoscope. It is not a personality test. It is celestial counsel — precise, ancient, and deeply serious.

For seekers with real questions. People in transition. Those facing genuine choice-points. Anyone who believes the cosmos speaks, and knows how to listen.

## The Name

**Shams al-Asrār** means "Sun of Secrets." In the horary tradition, the sun is the supreme governor of time. Every hour of every day is ruled by the sun's motion through the heavens. Your question arrives in a specific moment — precise to the second. This oracle reads that moment: the sun's position, the stars' arrangement, what the advancing light of that precise second illuminates about your situation.

Five celestial powers converge at the instant of your question — the cosmic validators. When these forces align, the truth is certain. When they scatter, the answer grows complex — but it is still true.

## The Engine: New RKP

Shams al-Asrār speaks through a single oracle: the **Digital Watch Oracle** — New RKP.
Your question arrives at a precise moment, and the 5-minute bracket of your own
watch face at that instant fixes the 1st Ghar (house). The twelve signs rotate
from there, and the real planets — genuine sidereal positions, real retrograde
and combustion state — drop into that frame. No birth data, no location, no
waiting: the reading can run the second the app opens.

## Subscription Tiers

**Free Trial:** 7 days full access.

**Mureed (₹249/month):** 3 questions per day. Perfect for regular seekers. Annual: ₹2,490 (2 months free).

**Khass (₹699/month):** Unlimited questions, exportable reports, reading archive, direct feedback channel. Annual: ₹6,990 (2 months free).

## The Brand

Built by **Astro Sarfaraz** — a solo developer, owner, and practicing celestial scholar with deep knowledge of horary and mystical traditions. Shams al-Asrār is a labor of spiritual and technical precision.

---

## Architecture

**Frontend**: React Native Android app with local MMKV cache and Zustand state management.  
**Backend**: Cloud Functions (TypeScript) performing server-side New RKP chart judgment.  
**Database**: Firestore with deny-by-default security rules and user-scoped data isolation.  
**Auth**: Firebase Authentication (email/password, Google sign-in).  
**Quotas**: Server-enforced daily limits (free: 100/day, mureed: unlimited, khass: unlimited).  
**Payments**: Google Play IAP subscription with server verification + Razorpay webhook support.  
**Security**: App Check enforcement (outside dev), certificate pinning on Android, input validation via Zod.

## Features

### Judgment (Oracle)
- **Ask**: Capture question → build celestial chart for current moment/saved location → server judgment → narrated verdict with timing/remedy/reasoning
- **Intents**: Follow-up questions (timing, remedy, why) repurpose the chart without recalculating
- **Confidence**: Verdict confidence level with detailed breakdown by judgment phase

### Data & History
- **Local cache**: MMKV stores last N readings for offline access
- **Firestore sync**: Readings automatically sync to user account; deletable on-device or via server
- **History browse**: Filter/sort/detail modal with full reading metadata

### Customization
- **Theme**: Light/dark + 5 aesthetic themes (Shams, Falak, Dasha, Maqbool, Mardood)
- **Language**: EN (English), UR (اردو) actively maintained; HI (हिन्दी) frozen — see Roadmap

### Premium (In-App Subscription)
- **Mureed (₹249/month or ₹2,490/year)**: 3 questions/day + full history + remedies
- **Khass (₹699/month or ₹6,990/year)**: Unlimited + confidence breakdown + PDF reports
- **Trial**: 7 days free with 5 questions/day after sign-up

## Backend Endpoints

### User-Facing Callable Functions

- **`askWatchOracle`** — New RKP horary judgment: validates input, enforces quota, builds the watch chart, judges it, synthesizes the oracle voice, returns verdict
- **`getQuota`** — Returns user's plan, daily usage, and remaining questions
- **`syncReadings`** — Bulk fetch readings from Firestore
- **`deleteReading`** — Delete reading by ID
- **`verifyGooglePlayPurchase`** — IAP verification: contacts Google Play API, updates user plan and custom claims
- **`razorpayWebhook`** — HTTP endpoint for Razorpay subscription events (payment.captured, subscription.activated)

### Admin-Only Functions

- **`setAdminClaim`** — Admin privilege management (admin-only, requires existing admin status)
- **`health`** — Readiness/liveness check (public, no auth required)

## Celestial Engine — New RKP

The engine code:

```
src/astrology/
  ├── primitives/       Ephemeris, ayanamsa, sidereal time, house cusps, sub-lords
  │   └── moshier/      Meeus/VSOP87 sun, moon and planet series
  ├── rules/            House matrix, nakshatras, vimshottari, question keywords
  ├── rkp/              New RKP — the Digital Watch Oracle engine
  │   ├── watchGrid.ts     The 5-minute watch-selected house frame
  │   ├── watchChart.ts    Real planets placed into that frame
  │   ├── watchJudgment.ts Verdict logic — dignity, rulership, aspects, obstruction
  │   ├── rules.ts          Dignities and aspect tables
  │   └── nomenclature.ts   Classical Arabic/Urdu names for planets, houses, signs
  └── types/            Chart, question and verdict contracts
```

### How a reading is judged

New RKP reads the **real ephemeris** — Meeus/VSOP87 series with
heliocentric→geocentric conversion, Lahiri ayanamsa, genuine retrograde and
combustion state — the same primitives layer every part of the app's sky
display uses. Its house frame is **moment-selected**: the hour is divided into
twelve 5-minute brackets, and the bracket containing the moment of asking fixes
the 1st Ghar; the remaining eleven signs follow in zodiacal order. This is not
a horizon computation (it does not use Placidus cusps), and it needs no
location or birth data — planetary positions are location-invariant, so a
reading can run the instant the app opens. See the header of
`src/astrology/rkp/watchGrid.ts` for the full mechanism.

The verdict itself weighs: the strength (dignity) of the ruler of the question's
own Ghar, how the querent's own ruler regards that ruler, which planets sit on
or aspect the question's Ghar and the 11th Ghar of fulfilment, and retrograde/
combustion state — see `src/astrology/rkp/watchJudgment.ts`.

Every reading feeds the **same remedy layer** — the 38 tagged practices in
`src/data/remedyLibrary.ts` (salawat, dua, istikhara, sadaqa, fasting, Qur'an,
dhikr, charity, night prayer, silence, tawbah). `src/data/watchRemedyContext.ts`
translates a watch verdict into the ranker's vocabulary: the obstructing planet
describes the *shape* of the difficulty, which is what selects an apt response.
The same Claude-synthesized "oracle voice" prose layer (`functions/src/functions/oracleVoice.ts`)
narrates every verdict in Shams al-Asrār's voice, regardless of question type.

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
npm test                    # Jest: quotaSelectors, watch engine (rkp/)
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
│   │   ├── engine/        Celestial engine, generated from src/astrology/ by scripts/sync-engine.mjs
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
- **Localization**: EN complete, UR interface complete and actively maintained
- **Hindi (hi) is frozen, not removed**: as the product focuses on its Urdu/Arabic-speaking
  audience, `hi` is no longer backfilled with new strings. It remains a valid language —
  persisted `hi` still loads and renders, new keys fall back to English, and users already on
  Hindi keep a working picker control (and a way to switch away). New users are not offered it.
  To resume support, flip `status` back to `'active'` in `src/i18n/types.ts` and backfill
  `src/i18n/strings/hi.ts`; no other code changes are needed.

---

**Status**: Private beta with production-style backend controls. Production launch pending full test coverage and final security audit.
