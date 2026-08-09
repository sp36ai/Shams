# Shams al-Asrār — The Sun of Secrets

## What It Is

Shams al-Asrār is a horary oracle — a modern vessel descended from centuries of Muslim scholarly tradition. It is not a horoscope. It is not a personality test. It is celestial counsel — precise, ancient, and deeply serious.

For seekers with real questions. People in transition. Those facing genuine choice-points. Anyone who believes the cosmos speaks, and knows how to listen.

## The Name

**Shams al-Asrār** means "Sun of Secrets." In the horary tradition, the sun is the supreme governor of time. Every hour of every day is ruled by the sun's motion through the heavens. Your question arrives in a specific moment — precise to the second. This oracle reads that moment: the sun's position, the stars' arrangement, what the advancing light of that precise second illuminates about your situation.

Five celestial powers converge at the instant of your question — the cosmic validators. When these forces align, the truth is certain. When they scatter, the answer grows complex — but it is still true.

## Two Oracles

**Digital Watch Oracle (RKP)** — the primary reading. Answers anchored to the moment of asking. Asks nothing of you: no birth details, no location.

**Astronomical Oracle (KP)** — the secondary reading, grounded in the true horizon at your place of asking. Needs your location.

Two separate systems, each answering in its own voice. A reading comes from one or the other — never a blend.

## Subscription Tiers

**Free Trial:** 7 days full access to both oracle modes.

**Mureed (₹249/month):** 3 questions per day, single oracle mode. Perfect for regular seekers. Annual: ₹2,490 (2 months free).

**Khass (₹699/month):** Unlimited questions, both oracle modes, exportable reports, reading archive, direct feedback channel. Annual: ₹6,990 (2 months free).

## The Brand

Built by **Astro Sarfaraz** — a solo developer, owner, and practicing celestial scholar with deep knowledge of horary and mystical traditions. Shams al-Asrār is a labor of spiritual and technical precision.

---

## Architecture

**Frontend**: React Native Android app with local MMKV cache and Zustand state management.  
**Backend**: Cloud Functions (TypeScript) performing server-side chart judgment for both engines.  
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
- **Location**: Capture via GPS during onboarding; fall back to last known location

### Premium (In-App Subscription)
- **Mureed (₹249/month or ₹2,490/year)**: 3 questions/day + full history + remedies
- **Khass (₹699/month or ₹6,990/year)**: Unlimited + confidence breakdown + PDF reports
- **Trial**: 7 days free with 5 questions/day after sign-up

## Backend Endpoints

### User-Facing Callable Functions

- **`askWatchOracle`** — RKP (primary): validates input, enforces quota, builds the watch chart, returns verdict. No location required
- **`askOracle`** — KP (secondary): validates input, enforces quota, builds the astronomical chart, returns verdict
- **`getQuota`** — Returns user's plan, daily usage, and remaining questions
- **`syncReadings`** — Bulk fetch readings from Firestore
- **`deleteReading`** — Delete reading by ID
- **`verifyGooglePlayPurchase`** — IAP verification: contacts Google Play API, updates user plan and custom claims
- **`razorpayWebhook`** — HTTP endpoint for Razorpay subscription events (payment.captured, subscription.activated)

### Admin-Only Functions

- **`setAdminClaim`** — Admin privilege management (admin-only, requires existing admin status)
- **`health`** — Readiness/liveness check (public, no auth required)

## Celestial Engine

The authoritative algorithm documents:

- `docs/RKP_RULES_FROM_SARFARAZ.md` — the KP (secondary) engine's judgment rules
- `src/astrology/kp/judgment/JUDGMENT_ALGORITHM.md` — Implementation details

The engine code:

```
src/astrology/
  ├── primitives/       Ephemeris, ayanamsa, sidereal time, house cusps, sub-lords
  │   └── moshier/      Meeus/VSOP87 sun, moon and planet series
  ├── rkp/              PRIMARY engine — watch-selected house frame, own routing
  ├── kp/               SECONDARY engine — true Ascendant
  │   ├── judgment/     Verdict logic + timing + remedy
  │   └── rules/        House matrix, nakshatras, vimshottari
  ├── questions/        Shared subject vocabulary + classifier (no astrology)
  └── types/            Chart, question and verdict contracts
```

### Two engines, never blended

Shams runs **two independent calculation systems**. A reading comes from one or
the other — there is no hybrid mode and no combining of their rules.

| | **RKP** — primary | **KP** — secondary |
|---|---|---|
| Full name | Ratan Kotamraju Paddhati | Krishnamurti Paddhati |
| Code | `src/astrology/rkp/` | `src/astrology/kp/` |
| Callable | `askWatchOracle` | `askOracle` |
| 1st house from | The 5-minute bracket of the querent's local watch minute | True Ascendant — RAMC, obliquity, latitude (Placidus) |
| House rules | `rkp/houseRouting.ts` | `kp/rules/houseMatrix.ts` |
| Needs birth data | No | No |
| Needs location | **No** | Yes — the horizon is local |
| Vocabulary | Arabic/Urdu — Burj, Ghar, Zuhal | KP terminology |
| Verdicts | FULFILLED / MOVING / DELAYED / BLOCKED / REVERSING / UNFORMED | YES / NO / CONDITIONAL / DELAYED / UNCLEAR |

**RKP is the primary engine** and the app's default. Because its house frame is
watch-derived and planetary positions are location-invariant, an RKP reading
needs nothing at all from the querent — it can run the moment the app opens.

**KP is the secondary engine**, for seekers who want the reading grounded in the
true local horizon. It requires a location fix.

Both read the **same real ephemeris** — Meeus/VSOP87 with heliocentric→geocentric
conversion, Lahiri ayanamsa, genuine retrograde and combustion state. Sharing the
astronomy is not blending the engines: the sky is the sky. What must never be
shared is the *judgment* — each engine owns its own house rules and its own
verdict logic.

The one other shared item is `src/astrology/questions/topics.ts`, the app's
subject vocabulary (career, marriage, finance …). It is a word list with no
houses, planets or judgment in it, so both engines and the readings store can
read it without either depending on the other.

`src/astrology/__tests__/engineIndependence.test.ts` enforces all of this: it
fails the build if either engine ever imports the other.

#### A note on the name "RKP"

In older documents in this repo, "RKP" was also used for the interpretation
layer over the KP core, and for the owner-provided judgment ruleset. **Both of
those usages are retired.** RKP now means one thing only: the Ratan Kotamraju
Paddhati watch engine in `src/astrology/rkp/`. The owner-provided house matrix
is the KP engine's ruleset and is named as such.

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
