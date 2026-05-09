# Shams al-Asrār — Architecture & Flow Diagrams Report

**Generated: April 29, 2026**

---

## System Architecture Overview

### High-Level Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SHAMS AL-ASRĀR APPLICATION                          │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │  React Native   │
                              │   App (0.74.5)  │
                              │  TypeScript 5.0 │
                              └────────┬────────┘
                                       │
                 ┌─────────────────────┼─────────────────────┐
                 │                     │                     │
                 ▼                     ▼                     ▼
        ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
        │  Metro Bundler   │  │  Firebase Auth   │  │   Navigation     │
        │  (Terser + RN)   │  │  (Supabase +     │  │   (Bottom Tabs)  │
        │                  │  │   Firebase Auth) │  │                  │
        │ • Mangle IDs     │  │                  │  │  • Oracle Screen │
        │ • Strip Console  │  │                  │  │  • History Tab   │
        │ • 3-Pass Compress│  │                  │  │  • Settings      │
        │ • No Source Maps │  │                  │  │  • Premium       │
        └────────┬─────────┘  └─────────┬────────┘  └────────┬─────────┘
                 │                     │                    │
                 └─────────────────────┼────────────────────┘
                                       │
                  ┌────────────────────┴────────────────────┐
                  │   Firebase SDK (@react-native-firebase)│
                  │  • App Core                              │
                  │  • Authentication                        │
                  │  • App Check                             │
                  │  • Google Sign-In                        │
                  └────────────────────┬────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │   Firebase Backend (GCP)            │
                    │   Project: shams-al-asrar-ca95d     │
                    └──────────────────┬──────────────────┘
                                       │
             ┌─────────────────────────┼─────────────────────────┐
             │                         │                         │
             ▼                         ▼                         ▼
    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
    │  Firestore DB    │    │ Cloud Functions  │    │ Cloud Storage    │
    │  (asia-south1)   │    │ (asia-south1)    │    │ (for certs/logs) │
    │                  │    │                  │    │                  │
    │ Collections:     │    │ 30s timeout      │    │                  │
    │ • users          │    │ 512 MiB memory   │    │                  │
    │ • quotas         │    │                  │    │                  │
    │ • readings       │    │ Functions:       │    │                  │
    │ • rateLimits     │    │ • askOracle      │    │                  │
    │ • auditLogs      │    │ • verifyPayment  │    │                  │
    │ • securityEvents │    │ • checkQuota     │    │                  │
    └──────────────────┘    └──────────────────┘    └──────────────────┘
             │
             ▼
    ┌──────────────────────────┐
    │   Security Rules Layer   │
    │   Firestore Rules        │
    │                          │
    │ • Deny-by-default        │
    │ • Role-based access      │
    │ • Client = untrusted     │
    │ • Admin SDK = trusted    │
    └──────────────────────────┘
```

---

## Data Flow: Question to Oracle Answer

```
USER ACTION
    │
    ▼
┌──────────────────────────────┐
│  Frontend (OracleScreen)     │
│  • Collect question & params │
│  • Validate local quota      │
│  • Check rate limits         │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Client-side Checks          │
│  • Is free tier & at limit?  │
│  • Is premium expired?       │
│  • Rate limit (60 req/min)?  │
└──────────┬───────────────────┘
           │
        YES (allowed)
           │
           ▼
┌──────────────────────────────┐
│  Call askOracle Function     │
│  (Cloud Function)            │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Server-side Validation      │
│  • Verify authentication     │
│  • Check Firebase App Check  │
│  • Validate Google Play      │
│    subscription status       │
└──────────┬───────────────────┘
           │
        VALID
           │
           ▼
┌──────────────────────────────┐
│  Rate Limiting Check         │
│  (rateLimits collection)     │
│  • Read last minute count    │
│  • Increment if under 60     │
│  • Reject if at limit        │
└──────────┬───────────────────┘
           │
        OK
           │
           ▼
┌──────────────────────────────┐
│  Quota Increment             │
│  (quotas collection)         │
│  • Read current week usage   │
│  • Increment by 1            │
│  • Check if free tier breach │
└──────────┬───────────────────┘
           │
        OK
           │
           ▼
┌──────────────────────────────┐
│  Calculate Horary Judgment   │
│  Deterministic Engine        │
│  • KP system calculation     │
│  • Judgment logic            │
│  • Result object             │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Store Reading               │
│  (readings collection)       │
│  • userId                    │
│  • question + params         │
│  • verdict + analysis        │
│  • createdAt timestamp       │
│  • indexes for querying      │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Audit Log                   │
│  (auditLogs collection)      │
│  • action: "QUESTION_ASKED"  │
│  • userId                    │
│  • timestamp                 │
│  • metadata                  │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Return Result to Client     │
│  • Verdict                   │
│  • Analysis                  │
│  • Remaining quota           │
│  • Plan status               │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Frontend Display            │
│  • Show reading & judgment   │
│  • Update quota display      │
│  • Cache reading locally     │
│  • Enable history access     │
└──────────────────────────────┘
```

---

## Firebase Firestore Collections & Relationships

```
FIRESTORE DOCUMENT HIERARCHY
═══════════════════════════════════════════════════════════════════════════

/users/{userId}
├── displayName: string
├── preferences: object
├── createdAt: timestamp
└── [No quota/plan data — stored separately]

/quotas/{userId}
├── weekKey: string (YYYY-MM-DD, Sunday-anchored)
├── used: number (incremented by Cloud Functions)
├── limit: number (3 for free, unlimited for paid)
├── planTier: 'free' | 'starter' | 'premium' | 'consultation'
├── planExpiry: timestamp (null for free/never)
└── lastUpdated: timestamp

/readings/{readingId}
├── userId: string (indexed)
├── question: string
├── parameters: object
├── verdict: object
│   ├── result: string
│   ├── confidence: number
│   └── reasoning: string
├── category: string (indexed)
├── createdAt: timestamp (indexed, descending)
├── longevity: number (hours)
└── [Indexes: userId+createdAt, userId+verdict+createdAt, userId+category+createdAt]

/quotas/{userId}/... ← TTL indexed
├── expiresAt: timestamp (TTL field — auto-delete)

/auditLogs/{logId}
├── userId: string (indexed)
├── action: string (indexed)
│   • QUESTION_ASKED
│   • READING_DELETED
│   • PLAN_PURCHASED
│   • PLAN_EXPIRED
│   • PAYMENT_FAILED
├── ts: timestamp (indexed, descending)
├── metadata: object
├── ipAddress: string (for fraud detection)
└── [Indexes: userId+ts, action+ts]

/securityEvents/{eventId}
├── type: string
│   • EXCESSIVE_REQUESTS
│   • QUOTA_BREACH
│   • SUSPICIOUS_LOGIN
│   • INVALID_APP_CHECK
├── userId: string
├── ts: timestamp
├── severity: 'LOW' | 'MEDIUM' | 'HIGH'
├── details: object
└── resolved: boolean

/rateLimits/{userId}/{minuteKey}
├── count: number
├── expiresAt: timestamp (60 seconds after creation — TTL)
└── [Locked to Cloud Functions only]
```

---

## Metro Bundler Processing Pipeline

```
SOURCE CODE
    │
    ├─ *.ts, *.tsx ─────┐
    ├─ *.js, *.jsx ─────┤
    ├─ *.json ──────────┤ Babel Transform
    ├─ *.cjs, *.mjs ────┤ (@react-native/babel-preset)
    └─ Custom plugins ──┤ module-resolver aliasing
                       │
                       ▼
              ┌─────────────────┐
              │ AST Transform   │
              │ with Babel      │
              │ Plugins         │
              └────────┬────────┘
                       │
            ┌──────────┴──────────┐
            │                     │
        DEV MODE            PROD MODE (NODE_ENV=production)
            │                     │
            │                     ▼
            │            ┌─────────────────────┐
            │            │ Terser Minification │
            │            │                     │
            │            │ • Mangle vars      │
            │            │ • Drop console     │
            │            │ • Dead code        │
            │            │ • Compress (3x)    │
            │            │ • Strip comments   │
            │            │ • ASCII-only       │
            │            │ • NO source maps   │
            │            └────────┬────────────┘
            │                     │
            └──────────┬──────────┘
                       │
                       ▼
            ┌──────────────────────────┐
            │  Metro Bundling          │
            │  • Resolve dependencies  │
            │  • Create module index   │
            │  • Wrap in runtime       │
            └────────────┬─────────────┘
                         │
                         ▼
            ┌──────────────────────────┐
            │  Platform-Specific Bundles
            │  • Android (Hermes)      │
            │  • iOS (.jsbundle)       │
            └────────────┬─────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   DEV BUNDLE      HERMES BYTECODE   SOURCE MAP*
   (~8 MB)         (~3 MB, release)   (*DEV ONLY)
   Debug mode      Production app
   Readable code   Obfuscated code
                   (Cannot reverse-engineer)
```

---

## Firebase Authentication & App Check Flow

```
USER OPENS APP
    │
    ▼
┌─────────────────────────────────┐
│  App Startup (SplashScreen)     │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Initialize Firebase            │
│  (@react-native-firebase/app)   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Enable App Check               │
│  (@react-native-firebase/       │
│   app-check)                    │
│                                 │
│  • Custom provider or Play      │
│    Integrity API (Android)      │
│  • Device attestation token     │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  App Check Token Validation     │
│  (Firebase backend)             │
│                                 │
│  VALID → Firebase token issued  │
│  INVALID → Request denied       │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  User Logged In?                │
│  (Check authStore.ts)           │
└────────┬────────────────────────┘
         │
    NO   │   YES
        │    │
        ▼    ▼
   ┌────────────────────────────┐
   │  AuthScreen               │
   │  (Login/Register)         │
   │                           │
   │  1. Google Sign-In        │
   │  2. Continue Anonymously  │
   │                           │
   │  → Get Supabase token     │
   │  → Exchange for Firebase  │
   │    custom token           │
   └────────┬───────────────────┘
            │
            ▼
   ┌─────────────────────────────┐
   │  User Authenticated         │
   │  (Firebase Auth + App Check)│
   │                             │
   │  token = xxxxxxxxxx         │
   │  uid = user_12345           │
   └────────┬────────────────────┘
            │
            ▼
   ┌─────────────────────────────┐
   │  Access Firestore           │
   │  All requests include:      │
   │  • Firebase token           │
   │  • App Check token          │
   │  • UID in security rules    │
   └─────────────────────────────┘
```

---

## Quota System Lifecycle

```
WEEKLY QUOTA CYCLE
═══════════════════════════════════════════════════════════════════════════

┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│  SUN    │  MON    │  TUE    │  WED    │  THU    │  FRI    │  SAT    │
│ Week 1  │         │         │         │         │         │         │
│ Start   │         │         │         │         │         │         │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘

QUOTA TRACKING (Free Tier = 3 questions/week):
┌───────────────────────────────────────────────────────────────────────┐
│ weekKey = "2026-04-26" (Sunday ISO date)                              │
│ used = 0, limit = 3                                                   │
└───────────────────────────────────────────────────────────────────────┘

FRIDAY, 11:30 AM:
┌───────────────────────────────────────────────────────────────────────┐
│ User asks question 1                                                  │
│ Cloud Function increments: used = 1 ✓                                 │
│ Remaining quota for this user: 2                                      │
└───────────────────────────────────────────────────────────────────────┘

FRIDAY, 2:00 PM:
┌───────────────────────────────────────────────────────────────────────┐
│ User asks question 2                                                  │
│ Cloud Function increments: used = 2 ✓                                 │
│ Remaining quota: 1                                                    │
└───────────────────────────────────────────────────────────────────────┘

SATURDAY, 10:00 AM:
┌───────────────────────────────────────────────────────────────────────┐
│ User asks question 3                                                  │
│ Cloud Function increments: used = 3 ✓                                 │
│ Remaining quota: 0                                                    │
└───────────────────────────────────────────────────────────────────────┘

SATURDAY, 11:00 AM:
┌───────────────────────────────────────────────────────────────────────┐
│ User tries to ask question 4                                          │
│ Cloud Function reads: used = 3, limit = 3                             │
│ Check: used >= limit? YES ✗                                           │
│ Response: "Quota exceeded. Try next Sunday at 00:00 UTC"              │
│ Feature: Show premium tier CTA                                        │
└───────────────────────────────────────────────────────────────────────┘

SUNDAY, 00:00 UTC (Start of new week):
┌───────────────────────────────────────────────────────────────────────┐
│ Weekly quota automatically resets                                     │
│ (Handled by Cloud Function or scheduled task)                         │
│ New weekKey = "2026-05-03" (next Sunday)                              │
│ used = 0, limit = 3                                                   │
│ User can ask 3 more questions                                         │
└───────────────────────────────────────────────────────────────────────┘

PREMIUM USER CASE (Starter tier = 7 days):
┌───────────────────────────────────────────────────────────────────────┐
│ Purchase: shams_starter_weekly on Friday                              │
│ planTier = 'starter'                                                  │
│ planExpiry = Friday + 7 days = next Friday 2026-05-03                 │
│ used = unlimited, limit = unlimited ✓                                 │
│ Friday, 11:00 AM → User asks unlimited questions                      │
│ Friday 2026-05-03, 23:59 → Plan expires                               │
│ planTier reset to 'free', limit reset to 3                            │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Rate Limiting Mechanism

```
RATE LIMIT: 60 requests per minute (per user)
═════════════════════════════════════════════════════════════════════════

IMPLEMENTATION:
┌────────────────────────────────────────────────────────────────────────┐
│ Collection: /rateLimits/{userId}/{minuteKey}                           │
│ minuteKey = "2026-04-29_14:35" (current minute in UTC)                 │
│                                                                        │
│ Document:                                                              │
│ ├── count: number (incremented per request)                           │
│ ├── expiresAt: timestamp (current + 61 seconds, TTL field)            │
│ └── [Auto-deleted after 1 minute by Firestore TTL]                   │
└────────────────────────────────────────────────────────────────────────┘

FLOW PER REQUEST:
┌──────────────────────────┐
│ User makes request       │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│ Cloud Function calculates minuteKey      │
│ = floor(timestamp / 60000) in UTC        │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│ Query /rateLimits/{userId}/{minuteKey}   │
└────────────┬─────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌────────────┐   ┌──────────────────────┐
│ Exists?    │   │ Not exists yet       │
│ YES        │   │                      │
│            │   │ Create new doc:      │
│ Read: count│   │ count = 1            │
│            │   │ expiresAt = now+60s  │
└────────────┘   └──────────────────────┘
    │
    ▼
┌──────────────────────────┐
│ count < 60?              │
└────────────┬─────────────┘
             │
        YES  │  NO
            │   │
            ▼   ▼
        ┌──────────────┐
        │ Allow request│  │ Reject request  │
        │ Increment    │  │ Return 429      │
        │ count        │  │ Too Many Reqs   │
        │              │  │                 │
        │ count++      │  │ Exponential back│
        └──────────────┘  │ off recommended │
                          └─────────────────┘
```

---

## Build & Release Pipeline

```
SOURCE CODE
    │
    ├─ TypeScript source (src/**/*.ts)
    ├─ Jest tests (__tests__/**/*)
    └─ Configuration files

    ▼
┌──────────────────────────────┐
│ Run Tests & Lint             │
│ npm test                     │
│ npm run lint                 │
│ npm run typecheck            │
└────────┬─────────────────────┘
         │
    ✓ All pass
         │
         ▼
┌──────────────────────────────┐
│ Build Android Debug          │
│ npm run build:android:debug  │
│ → assembleDebug              │
│                              │
│ Output: app-debug.apk (~25MB)│
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Release Build                │
│ npm run build:android:release│
│                              │
│ 1. Gradle: assembleRelease   │
│ 2. ProGuard minification      │
│ 3. APK signing               │
│                              │
│ Output: app-release.apk      │
│ Size: ~8-10 MB (minified)    │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Generate App Bundle          │
│ npm run bundle:android       │
│ → bundleRelease              │
│                              │
│ Output: app-release.aab      │
│ Size: ~7 MB (compressed)     │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Sign Bundle                  │
│ Keys from ~/.gradle/         │
│ gradle.properties:           │
│                              │
│ SHAMS_UPLOAD_STORE_FILE      │
│ SHAMS_UPLOAD_STORE_PASSWORD  │
│ SHAMS_UPLOAD_KEY_ALIAS       │
│ SHAMS_UPLOAD_KEY_PASSWORD    │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Upload to Google Play Store  │
│ • Console manual upload OR   │
│ • CI/CD automation           │
│                              │
│ Internal test track → Beta   │
│ → Production rollout         │
└─────────────────────────────┘
```

---

## Key Configuration Files Map

```
PROJECT ROOT
│
├── firebase.json
│   ├── projectId: shams-al-asrar-ca95d
│   ├── functions: [{ source: "functions", region: "asia-south1" }]
│   ├── firestore: { rules, indexes }
│   └── emulators: { functions, firestore, ui, pubsub, storage, auth }
│
├── firestore.rules
│   ├── /users/{userId}
│   ├── /quotas/{userId} [RW locked to Admin SDK]
│   ├── /readings/{readingId}
│   ├── /rateLimits/{userId}/** [RW locked to Admin SDK]
│   ├── /auditLogs/{logId}
│   └── /securityEvents/{eventId}
│
├── firestore.indexes.json
│   ├── readings: userId+createdAt, userId+verdict+createdAt, userId+category+createdAt
│   └── auditLogs: userId+ts, action+ts
│
├── metro.config.js
│   ├── resolver: [ts, tsx, js, jsx, json, cjs, mjs + assets]
│   └── transformer: Terser (release) with mangle/drop-console/3-pass-compress
│
├── babel.config.js
│   ├── preset: @react-native/babel-preset
│   ├── plugins: module-resolver (@/src), reanimated
│   └── aliases: @components, @screens, @stores, @navigation, etc.
│
├── react-native.config.js
│   ├── android: { sourceDir: "./android" }
│   └── assets: ["./assets/fonts/"]
│
├── android/app/build.gradle
│   ├── minSdk: 24, targetSdk: 34, NDK
│   ├── namespace: com.astrosarfaraz.shamsalasrar
│   ├── Hermes: enabled
│   ├── ProGuard: enabled (release)
│   ├── Signing: debug.keystore, release from ~/.gradle/
│   └── Locales: en, ur, hi (APK size reduction)
│
├── package.json
│   ├── dependencies: react-native, zustand, @react-navigation, Firebase, MMKV
│   ├── devDependencies: TypeScript, Jest, ESLint, Prettier, Babel
│   ├── jest: react-native preset + module mocks
│   └── scripts: start, build:android:*, bundle:android, test, lint
│
├── tsconfig.json
│   ├── target: ES2020
│   ├── module: ESNext
│   └── strict: true
│
└── functions/
    ├── src/config.ts
    │   ├── PlanTier: free | starter | premium | consultation
    │   ├── FREE_LIMIT: 3 questions/week
    │   ├── REGION: asia-south1
    │   ├── FUNCTION_OPTS: { region, timeoutSeconds: 30, memory: 512MiB }
    │   └── PLAY_PRODUCT_MAP: { shams_starter_weekly, shams_premium_monthly, shams_consultation_monthly }
    │
    └── firebase.json (Cloud Functions settings)
        └── predeploy: npm run build
```

---

**End of Architecture Report**
