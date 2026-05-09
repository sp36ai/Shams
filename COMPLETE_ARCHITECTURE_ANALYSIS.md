# Shams al-Asrar: Complete Application Architecture Analysis

**Generated: May 9, 2026**

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Vital Components](#vital-components)
3. [Application Servers & Compute](#application-servers--compute)
4. [APIs & Communication](#apis--communication)
5. [Middleware & Security Pipeline](#middleware--security-pipeline)
6. [Memory/Persistence Layer (Database)](#memorypersistence-layer-database)
7. [Functional Organs (Core Modules)](#functional-organs-core-modules)
8. [Architecture Models](#architecture-models)
9. [Data Flow Diagrams](#data-flow-diagrams)

---

# SYSTEM OVERVIEW

**Application Type:** React Native Mobile App + Firebase Backend  
**Target Platform:** Android (iOS ready)  
**Runtime:** React Native 0.74.5, TypeScript 5.5.4  
**Architecture Pattern:** Client-Server (Distributed)  
**Security Model:** Zero-Trust + Deny-by-Default  
**Deployment:** Google Cloud Platform (GCP)

**Purpose:** Deterministic RKP (Krishnamurti Paddhati) horary judgment engine with local-only functionality, user authentication, quota management, and premium subscriptions.

---

# VITAL COMPONENTS

## 🎯 Core Application (Frontend)

### 1. **React Native Application Shell**

- **Framework:** React Native 0.74.5
- **Language:** TypeScript 5.5.4
- **Bundle Size Optimization:** Metro Bundler with Terser compression
  - Mangled identifiers
  - Stripped console logs
  - 3-pass compression
  - No source maps (production)

### 2. **Root Navigation System**

**File:** `src/navigation/RootNavigator.tsx`

- **Type:** Bottom Tab Navigation (React Navigation 6.1)
- **Tabs:**
  - **Oracle Screen** → User query interface (horary judgment)
  - **History Tab** → Saved readings viewer
  - **Settings Tab** → Configuration (theme, language, location)
  - **Premium Tab** → Subscription management

### 3. **Gesture & Animated Components**

- **Gesture Handler** (2.16.2) → Touch event processing
- **Reanimated** (3.16.7) → Smooth UI animations
- **SVG Renderer** (15.3.0) → Vector graphics (starfield, charts)

---

## 🔐 Core Security Foundation

### 4. **Firebase App Check**

```
Entry Point: App.tsx (lines 10-37)
Purpose: Runtime integrity verification before any Firebase service access
```

**Android Configuration:**

- **Dev Mode:** Debug tokens (Firebase Console registered)
- **Production:** Play Integrity API attestation
- **Auto-refresh:** Every 1 hour

**iOS Configuration:**

- **Dev Mode:** Debug tokens
- **Production:** App Attestation (primary) + Device Check (fallback)

**Web Configuration:**

- reCAPTCHA v3 (unused in mobile build)

### 5. **Security Checks Module**

```
File: src/utils/security.ts
```

- Runtime integrity verification
- Binary tampering detection
- Root/jailbreak detection
- Emulator detection
- Execution environment validation

**Hard-Fail Behavior:** Blank black screen + generic error message (no specific check named)

---

## 📍 Onboarding & Permission Management

### 6. **Location Permission Screen**

```
File: src/screens/LocationPermissionScreen.tsx
```

- Requests fine location access on first app launch
- Required for horary chart calculation (latitude/longitude)
- One-time permission flow
- Navigation gate before Oracle access

### 7. **Authentication System**

```
Files: src/screens/AuthScreen.tsx, src/stores/authStore.ts
```

- **Auth Methods:**
  - Firebase Authentication (email/password, social)
  - Google Sign-In (Google Identity Services SDK v16.1.2)
  - Provider-agnostic auth store (Zustand)

---

# APPLICATION SERVERS & COMPUTE

## 🚀 Backend Compute Layer

### **Google Cloud Functions (asia-south1 region)**

#### Server Specification:

- **Memory:** 512 MB default
- **Timeout:** 30 seconds per invocation
- **Scaling:** Automatic (horizontal)
- **Concurrency:** Per-function configuration
- **Environment:** Node.js 20 LTS runtime

#### Deployed Functions:

| Function                     | Type     | Timeout | Purpose                                          |
| ---------------------------- | -------- | ------- | ------------------------------------------------ |
| **askOracle**                | Callable | 30s     | Horary judgment (chart build + engine + scoring) |
| **getQuota**                 | Callable | 30s     | Retrieve user quota status & plan info           |
| **syncReadings**             | Callable | 30s     | Bulk sync local readings to Firestore            |
| **deleteReading**            | Callable | 30s     | Delete single reading (owner only)               |
| **verifyGooglePlayPurchase** | Callable | 30s     | Verify IAP, set custom JWT claims                |
| **razorpayWebhook**          | HTTP     | 30s     | Razorpay payment event handler                   |
| **health**                   | HTTP     | 30s     | Readiness/liveness check                         |

---

### **Firebase Firestore Database (asia-south1)**

- **Mode:** Cloud Firestore (NoSQL document store)
- **Throughput:** Provisioned capacity (regional multi-region)
- **Backup:** Automated daily snapshots

---

### **Cloud Storage (asia-south1)**

- **Purpose:** Certificate storage, audit logs (long-term archive)
- **Lifecycle Policies:** Auto-delete logs after 90 days

---

# APIs & COMMUNICATION

## 🔗 Client-Server API Layer

### **Firebase Cloud Functions Callable API**

#### Endpoint: `askOracle`

```typescript
// Request Payload
{
  question: string;           // User's horary question
  questionLang: 'en' | 'ur' | 'hi';  // Language code
  lat: number;                // Latitude (−90 to 90)
  lon: number;                // Longitude (−180 to 180)
}

// Response Payload
{
  reading: {
    id: string;
    verdict: 'YES' | 'NO' | 'CONDITIONAL';  // Judgment result
    confidence: number;        // 0–100
    category: string;          // Question classification
    narration: {               // Localized explanation
      en: string;
      ur: string;
      hi: string;
    };
    timing?: {
      window: string;
      range: { min: number; max: number };
      activeDasha?: string;
      activeAntardasha?: string;
    };
    // ... chart details (planets, cusps, ruling planets)
  };
  quotaRemaining: number | null;  // null = unlimited
  computedAt: string;        // ISO timestamp
}
```

#### Endpoint: `getQuota`

```typescript
// Response
{
  plan: 'free' | 'pro' | 'premium' | 'lifetime';
  remaining: number | null;
  weekStart: string; // Sunday ISO date
  resetDate: string;
}
```

#### Endpoint: `syncReadings`

```typescript
// Request: Batch of local readings
{
  readings: ReadingDoc[];
}

// Response
{
  synced: number;
  failed: number;
  nextSyncToken?: string;
}
```

#### Endpoint: `verifyGooglePlayPurchase`

```typescript
// Request
{
  packageName: string;
  productId: string;
  purchaseToken: string;
}

// Response
{
  plan: string;
  planExpiry: string;
  customClaims: {
    plan: string;
    planExpiry: string;
  }
}
```

### **HTTP Webhooks**

#### Razorpay Webhook Endpoint

```
POST /razorpayWebhook
Purpose: Handle Razorpay payment confirmations
```

---

## 📡 Client-Side API Wrappers

**File:** `src/firebase/oracle.ts`

```typescript
async function askOracle(args: AskOracleInput): Promise<AskOracleResult> {
  const fn = functions().httpsCallable('askOracle');
  return fn(args);
}
```

**Note:** Client NEVER builds charts or runs engine logic. All computation is server-side.

---

# MIDDLEWARE & SECURITY PIPELINE

## 🛡️ Request Processing Pipeline (in order)

### **Layer 1: Firebase App Check Enforcement**

```
File: functions/src/middleware/appCheck.ts
Status: Enforced globally on production
```

- Verifies device integrity certificate
- Rejects requests from emulators, rooted devices, tampered apps
- Automatic token refresh

### **Layer 2: Firebase Authentication Verification**

```
File: functions/src/middleware/auth.ts
```

- Validates JWT token (request.auth UID)
- Extracts user identity from Firebase Auth
- Populates custom claims (plan tier, plan expiry)
- **Function:** `verifyAuth()`

### **Layer 3: Input Validation**

```
File: functions/src/middleware/validate.ts
Schema: Zod (TypeScript-first runtime validation)
```

- **AskOracleSchema:**
  - question: string (100–500 chars)
  - lat: number (−90 to 90)
  - lon: number (−180 to 180)
  - questionLang: enum ['en', 'ur', 'hi']
- Type coercion & strict bounds checking
- **Function:** `parse()`

### **Layer 4: Rate Limiting**

```
File: functions/src/middleware/rateLimit.ts
Limit: 10 requests per minute per user
Storage: Firestore collection 'rateLimits'
```

- **Algorithm:** Token bucket (sliding window)
- **Transactional:** Atomic Firestore operation
- **Function:** `enforceRateLimit(userId)`

### **Layer 5: Quota Management**

```
File: functions/src/config.ts
Free tier: 5 readings/week (Sunday rollover)
```

| Plan     | Weekly Limit | Monthly Limit |
| -------- | ------------ | ------------- |
| free     | 5            | ~20           |
| pro      | 30           | ~120          |
| premium  | 100          | ~400          |
| lifetime | Unlimited    | Unlimited     |

- **Transactional check + decrement** (same batch as reading insert)
- **Function:** `claimQuotaSlot(userId)`

---

## 🔒 Security Rules (Firestore)

**File:** `firestore.rules`

### **Deny-by-Default Policy**

```
All collections/documents are DENY unless explicitly allowed
```

### **Role-Based Access Control**

#### Users Collection

```
/users/{userId}
  Read: Only owner + admin
  Write: Only owner
```

#### Readings Collection

```
/readings/{readingId}
  Read: Only owner
  Write: Server (cloud functions) only
  Delete: Owner can delete
```

#### Quotas Collection

```
/quotas/{userId}
  Read: Owner + functions
  Write: Functions only
```

#### Audit Logs Collection

```
/auditLogs/{logId}
  Read: Admin only
  Write: Functions only
```

---

# MEMORY/PERSISTENCE LAYER (DATABASE)

## 💾 Data Storage Architecture

### **Primary: Cloud Firestore (NoSQL)**

**Region:** asia-south1 (India region for low latency)

#### Collection: `users`

```typescript
/users/{userId}
{
  displayName: string;
  email: string;
  photoURL?: string;
  locale: 'en' | 'ur' | 'hi';
  theme: 'light' | 'dark';
  locationConsent: boolean;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  metadata: {
    platform: 'android' | 'ios' | 'web';
    appVersion: string;
    installationId: string;
  };
}
```

#### Collection: `quotas`

```typescript
/quotas/{userId}
{
  userId: string;
  plan: 'free' | 'pro' | 'premium' | 'lifetime';
  planExpiry: Timestamp | null;
  weekStart: Date;  // Sunday
  currentWeekUsage: number;
  usageHistory: {
    [week: string]: number;  // e.g., "2026-W18": 5
  };
  rateLimitCounter: number;  // Per-minute rolling
  lastRateLimitReset: Timestamp;
  updatedAt: Timestamp;
}
```

#### Collection: `readings`

```typescript
/readings/{readingId}
{
  userId: string;
  question: string;
  questionLang: 'en' | 'ur' | 'hi';
  questionCategory: string;  // e.g., 'career', 'love'

  // Chart data
  chartDate: Timestamp;
  chartLatitude: number;
  chartLongitude: number;
  chartTimezone: string;

  // Judgment result
  verdict: 'YES' | 'NO' | 'CONDITIONAL';
  confidence: number;
  reasoning: Array<{
    ruleId: string;
    description: string;
    weight: number;
  }>;

  // Engine internals (for archive only)
  planetDegrees: Record<string, number>;
  cuspDegrees: Record<number, number>;
  rulingPlanets: {
    dayLord: string;
    ascSignLord: string;
    moonSignLord: string;
  };

  // Remedy & timing
  remedy?: {
    planet: string;
    action: string;
    charity?: string;
  };
  timing?: {
    window: string;
    range: { min: number; max: number };
    activeDasha?: string;
  };

  // Localized narration
  narration: Record<'en' | 'ur' | 'hi', string>;
  oracle?: {
    opening: string;
    interpretation: string;
    spiritual_layer: string;
    hidden_influence: string;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
  archived: boolean;
}
```

#### Collection: `auditLogs`

```typescript
/auditLogs/{logId}
{
  userId: string;
  action: 'QUESTION_ASKED' | 'READING_DELETED' | 'PLAN_UPGRADED' | 'PAYMENT_VERIFIED';
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  statusCode: number;
  errorMessage?: string;
  metadata: Record<string, any>;
  createdAt: Timestamp;
  ttl: Timestamp;  // Auto-delete after 90 days
}
```

#### Collection: `securityEvents`

```typescript
/securityEvents/{eventId}
{
  userId?: string;
  eventType: 'APP_CHECK_FAILURE' | 'RATE_LIMIT_EXCEEDED' | 'QUOTA_EXHAUSTED' | 'AUTH_FAILED';
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  ipAddress: string;
  deviceId: string;
  timestamp: Timestamp;
}
```

### **Secondary: Local Storage (MMKV)**

**Library:** react-native-mmkv v2.12.2

#### Storage Keys

```typescript
// Theme preference
'@theme_id': string  // 'light' | 'dark'

// Language preference
'@language_code': string  // 'en' | 'ur' | 'hi'

// Location consent
'@location_consent': boolean

// Cached readings (local)
'@readings': string  // JSON array of Reading objects

// Auth token cache (optional, not recommended)
'@auth_token': string | undefined

// Settings
'@settings': JSON  // {
                   //   soundEnabled: boolean;
                   //   notificationsEnabled: boolean;
                   //   lastSyncTime: number;
                   // }
```

---

# FUNCTIONAL ORGANS (CORE MODULES)

## 🧠 The Astrology Engine

### **Module: `src/astrology/kp/`**

#### **1. Chart Builder (Ephemeris)**

**File:** `src/astrology/primitives/chartBuilder.ts`  
**Purpose:** Construct astrological chart for given location & datetime

- Computes planetary positions (sidereal zodiac)
- Calculates house cusps (Placidus or Krishnamurti)
- Determines nakshatra (lunar mansion) lords
- Computes sub-lords & sub-sub-lords
- Identifies retrograde planets

**Key Functions:**

- `buildChart(lat, lon, timestamp): Chart`
- `houseForLongitude(longitude): HouseNumber`
- `nakshatraLordAt(longitude): Planet`
- `subLordAt(longitude): Planet`

#### **2. Question Classification Engine**

```
File: src/astrology/kp/rules/questionKeywords.ts
Purpose: Classify user question into judgment category
```

- Keyword matching (multi-language)
- Maps questions to house matrices
- Categories: career, love, health, finance, travel, legal, family, general

**Function:** `classifyQuestion(text: string, lang: string): QuestionCategory`

#### **3. House Matrix (Judgment Rules)**

```
File: src/astrology/kp/rules/houseMatrix.ts
Purpose: Define favorable vs. denial houses per question type
```

**Example: Career Question**

```typescript
HOUSE_MATRIX['career'] = {
  favorable: [6, 10, 11], // 6th = service, 10th = career, 11th = gains
  denial: [5, 8, 12], // 5th = speculation, 8th = loss, 12th = hidden enemies
  primary: 10, // Most important house
};
```

#### **4. Horary Judgment Engine (5-Step Algorithm)**

```
File: src/astrology/kp/judgment/judgeHorary.ts
Purpose: Core verdict computation (deterministic)
```

**Algorithm:**

```
STEP 1: Read Moon's sub-lord
  moon = chart.planets['Moon']
  moonSubLord = moon.subLord

STEP 2: Load question matrix
  matrix = HOUSE_MATRIX[question.category]
  favorable_houses = matrix.favorable
  denial_houses = matrix.denial

STEP 3: Score Moon's sub-lord house
  moonSubLordHouse = houseForPlanet(moonSubLord, chart)
  if (moonSubLordHouse in favorable_houses): score += 2
  else if (moonSubLordHouse in denial_houses): score -= 2

STEP 4: Score 5 Ruling Planets (Witnesses)
  [Day, AscSign, AscStar, MoonSign, MoonStar] from chart.rulingPlanets
  for each ruling_planet:
    planet_house = houseForPlanet(ruling_planet, chart)
    if (planet_house in favorable): score += 1
    else if (planet_house in denial): score -= 1

STEP 5: Convert score to verdict
  if (score >= 3): verdict = 'YES'
  else if (score <= -2): verdict = 'NO'
  else: verdict = 'CONDITIONAL'

  Retrograde Modifier:
    if (verdict == 'YES' && (moonSubLord.retrograde OR Jupiter.retrograde)):
      verdict = 'DELAY'  // Execution delayed
```

**Function:** `judgeHorary(chart: Chart, question: ClassifiedQuestion): Verdict`

---

### **Module: `src/astrology/types/`**

```typescript
// Chart structure
type Chart = {
  timestamp: number; // Unix ms
  latitude: number;
  longitude: number;
  timezone: string;
  planets: Record<
    Planet,
    {
      longitude: number; // 0–360 degrees (sidereal)
      latitude: number;
      isRetrograde: boolean;
      nakshatra: Nakshatra;
      nakshatraLord: Planet;
      subLord: Planet;
      subSubLord: Planet;
      signLord: Planet;
      house: number; // 1–12
    }
  >;
  cusps: Record<
    number,
    {
      // Houses 1–12
      longitude: number;
      sign: ZodiacSign;
      signLord: Planet;
      subLord: Planet;
    }
  >;
  rulingPlanets: [Planet, Planet, Planet, Planet, Planet]; // 5 Classical Witnesses
  horaLord: Planet;
};

type Verdict = {
  kind: 'YES' | 'NO' | 'CONDITIONAL' | 'DELAY';
  confidence: number; // 0–100
  explanation: string;
  remedy?: Remedy;
  timing?: TimingWindow;
};
```

---

## 🎨 UI Component Library

### **Module: `src/components/`**

#### **Core Components**

| Component               | Purpose                              |
| ----------------------- | ------------------------------------ |
| **GlowView**            | Glowing background for visual depth  |
| **ShimmerOverlay**      | Loading skeleton (shimmer animation) |
| **StarfieldBackground** | Animated starfield (SVG-based)       |
| **TabIcon**             | Tab navigation icons                 |

#### **Component Hierarchy: Oracle Screen**

```
OracleScreen (root)
├── StarfieldBackground
├── QuestionInput (TextInput)
├── LocationDisplay (lat/lon)
├── SubmitButton
├── ResultsPanel
│   ├── VerdictBadge (YES/NO/CONDITIONAL)
│   ├── ConfidenceBar
│   ├── NarrationText (localized)
│   ├── RemedyCard (if applicable)
│   └── TimingWindow
└── QuotaIndicator
```

---

## 🗂️ State Management

### **Module: `src/stores/`** (Zustand)

#### **authStore.ts**

```typescript
{
  userId: string | null;
  email: string | null;
  isLoading: boolean;
  error: Error | null;

  login(email, password): Promise<void>;
  logout(): void;
  refreshToken(): Promise<void>;
}
```

#### **readingsStore.ts**

```typescript
{
  readings: Reading[];
  currentReading: Reading | null;
  isLoading: boolean;

  loadReadings(): Promise<void>;
  addReading(reading): void;
  deleteReading(id): Promise<void>;
  syncToCloud(): Promise<void>;
}
```

#### **quotaStore.ts**

```typescript
{
  plan: 'free' | 'pro' | 'premium' | 'lifetime';
  remaining: number | null;
  weekStart: Date;

  updateQuota(plan, remaining): void;
  decrementQuota(): void;
}
```

#### **settingsStore.ts**

```typescript
{
  theme: 'light' | 'dark';
  language: 'en' | 'ur' | 'hi';
  locationConsent: boolean;

  setTheme(theme): void;
  setLanguage(lang): void;
  setLocationConsent(bool): void;
}
```

---

## 🌍 Internationalization (I18n)

### **Module: `src/i18n/`**

**File:** `I18nProvider.tsx`

- **Supported Languages:** English (en), Urdu (ur), Hindi (hi)
- **RTL Support:** Automatic layout direction for Urdu
- **String Management:** Lazy-loaded string dictionaries
- **Fallback:** English defaults if string key missing

```typescript
function readPersistedLang(): 'en' | 'ur' | 'hi' {
  /* ... */
}
function applyLayoutDirection(lang): void {
  /* ... */
}
```

---

## 🎨 Theming System

### **Module: `src/theme/`**

**File:** `ThemeProvider.tsx`

- **Themes:** Light, Dark (customizable)
- **Persistence:** MMKV local storage
- **Colors:** Semantic tokens (primary, secondary, surface, error)
- **Typography:** Predefined scales (heading, body, caption)

---

## 🔍 Utilities & Cross-Cutting Concerns

### **Module: `src/utils/`**

| File               | Purpose                                                     |
| ------------------ | ----------------------------------------------------------- |
| **security.ts**    | Runtime integrity checks (tamper detection, root/jailbreak) |
| **permissions.ts** | Location, camera permission handlers                        |
| **logger.ts**      | Structured logging with redaction                           |

---

# ARCHITECTURE MODELS

## 🏗️ Model 1: Layered/N-Tier Architecture

```
┌────────────────────────────────────────────────────────────┐
│           PRESENTATION LAYER (React Native UI)            │
│   [Screens: Oracle, History, Settings, Premium]           │
│   [Components: GlowView, StarfieldBackground]             │
└────────────────┬─────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────┐
│         APPLICATION LOGIC LAYER (Stores + Utils)          │
│  [Zustand Stores: auth, readings, quota, settings]       │
│  [Firebase API Wrapper: oracle.ts]                        │
└────────────────┬─────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────┐
│            PERSISTENCE LAYER (MMKV + Auth)               │
│  [Local Storage: readings, preferences, tokens]          │
│  [Firebase Auth: token management]                       │
└────────────────┬─────────────────────────────────────────┘
                 │
          ┌──────▼──────┐
          │   Firebase  │
          │   Services  │
          └──────┬──────┘
                 │
┌────────────────▼─────────────────────────────────────────┐
│        BACKEND SERVICES (Cloud Functions + Firestore)    │
│  [Callable: askOracle, getQuota, syncReadings]           │
│  [Middleware: auth, rateLimit, validate]                 │
│  [Engine: Chart builder, horary judgment]                │
│  [Database: Firestore collections]                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🏗️ Model 2: Microservices-Inspired Backend

```
┌─────────────────────────────────────────────────────────────┐
│                   Firebase Backend Cluster                  │
└─────────────────────────────────────────────────────────────┘
       │                      │                      │
       ▼                      ▼                      ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────────┐
│  Oracle     │      │  Auth &     │      │  Payments       │
│  Service    │      │  Quota      │      │  & Subscriptions│
│             │      │  Service    │      │                 │
│ askOracle   │      │             │      │ verifyGooglePlay│
│ Function    │      │ getQuota    │      │ razorpayWebhook │
│             │      │ syncReadings│      │                 │
└──────┬──────┘      └──────┬──────┘      └────────┬────────┘
       │                    │                      │
       └────────────────────┼──────────────────────┘
                            │
                   ┌────────▼────────┐
                   │ Firestore       │
                   │ (Shared Data)   │
                   │                 │
                   │ • readings      │
                   │ • quotas        │
                   │ • users         │
                   │ • auditLogs     │
                   │ • securityEvents│
                   └─────────────────┘
```

---

## 🏗️ Model 3: Security-Onion Defense Layers

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Transport Security (TLS 1.2+)                │
│           (All Firebase connections encrypted)          │
└─────────────┬───────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────┐
│  Layer 2: Firebase App Check (Device Integrity)        │
│           (Play Integrity API on Android)               │
└─────────────┬───────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────┐
│  Layer 3: Firebase Authentication (User Identity)      │
│           (JWT + custom claims for plan tier)           │
└─────────────┬───────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────┐
│  Layer 4: Input Validation (Zod schemas)               │
│           (Strict type coercion & bounds checking)      │
└─────────────┬───────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────┐
│  Layer 5: Rate Limiting (Token bucket, 10 req/min)    │
│           (Per-user Firestore transaction)              │
└─────────────┬───────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────┐
│  Layer 6: Quota Enforcement (Plan-based limits)        │
│           (Atomic Firestore multi-document transaction) │
└─────────────┬───────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────┐
│  Layer 7: Firestore Security Rules (RBAC)              │
│           (Deny-by-default, role-based document access)│
└─────────────────────────────────────────────────────────┘
```

---

## 🏗️ Model 4: Event-Driven Observable Pattern

```
USER ASKS QUESTION
        │
        ▼
┌──────────────────────────┐
│ OracleScreen Component   │─── (Subject/Observable)
│ Emits: "askOracle" Event │
└──────────┬───────────────┘
           │
┌──────────▼──────────────┐
│ readingsStore.addLoading  │
│ (state update)          │
└──────────┬───────────────┘
           │
┌──────────▼──────────────┐
│ Call askOracle()        │
│ (firebase/oracle.ts)    │
└──────────┬───────────────┘
           │
        (async HTTP)
           │
┌──────────▼──────────────┐
│ Cloud Function receives │
└──────────┬───────────────┘
           │
   (Engine executes)
           │
┌──────────▼──────────────┐
│ Return reading result   │
└──────────┬───────────────┘
           │
┌──────────▼──────────────┐
│ readingsStore.addReading│
│ quotaStore.decrement    │
│ (state updates)         │
└──────────┬───────────────┘
           │
┌──────────▼──────────────┐
│ UI re-renders with      │
│ result + updated quota  │
└──────────────────────────┘
```

---

## 🏗️ Model 5: Command Query Responsibility Segregation (CQRS)-Inspired

```
WRITE SIDE (State Changes)        READ SIDE (Queries)
─────────────────────────────────────────────────────

askOracle                          getQuota
  ↓ creates                          ↓ reads
/readings                          /quotas
  ↓ updates                          ↓
/quotas                            Returns plan + remaining
  ↓ logs
/auditLogs

verifyGooglePlayPurchase
  ↓ sets
Custom Claims (JWT)
  ↓ updates
/quotas
  ↓ logs
/auditLogs
```

---

# DATA FLOW DIAGRAMS

## Flow 1: Complete Question-to-Answer Pipeline

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         USER ASKS A QUESTION                             │
│                  "Will I get the promotion?"                            │
│                     (Horary judgment request)                           │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
                             ▼
                  ┌────────────────────┐
                  │  Location Check    │
                  │  Device Location   │
                  │  (lat, lon)        │
                  └────────┬───────────┘
                           │
                           ▼
                  ┌────────────────────┐
                  │  Prepare Payload   │
                  │  • question: string│
                  │  • lat, lon        │
                  │  • language: 'en'  │
                  │  • token: JWT      │
                  └────────┬───────────┘
                           │
                      [NETWORK]
                           │
        ┌──────────────────▼──────────────────┐
        │   askOracle Cloud Function          │
        │   Triggered (asia-south1)           │
        └──────────────────┬───────────────────┘
                           │
    ┌──────────────────────▼──────────────────────┐
    │         SECURITY CHECKS (Sequential)        │
    ├──────────────────────────────────────────────┤
    │ 1. App Check ✓ → Device Integrity OK        │
    │ 2. Auth ✓ → JWT valid, user: sarfaraz       │
    │ 3. Validate Input ✓ → Question 150 chars    │
    │ 4. Rate Limit ✓ → 3 req/min, under 10      │
    │ 5. Quota ✓ → Free tier, 3 remaining        │
    └──────────────────┬───────────────────────────┘
                       │ ALL PASSED
                       ▼
        ┌──────────────────────────────────┐
        │  Build Ephemeris Chart (Server)  │
        │                                  │
        │  Now: 2026-05-09 14:30 GMT+5    │
        │  Loc: Karachi (24.86°N, 67.01°E) │
        │                                  │
        │  Compute:                        │
        │  • Planetary positions (sidereal)│
        │  • House cusps (Placidus)        │
        │  • Ruling planets (3)            │
        │  • Moon's sub-lord               │
        └──────────────────┬───────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │  Classify Question                   │
        │                                      │
        │  Keyword: "promotion"               │
        │  → Category: career                 │
        │                                      │
        │  Load Matrix:                       │
        │  • Favorable: houses [6,10,11]     │
        │  • Denial: houses [5,8,12]         │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │  Execute Judgment Algorithm         │
        │  (5-step horary engine)             │
        │                                      │
        │  STEP 1: Moon sub-lord = Mars      │
        │  STEP 2: favorable=[6,10,11]       │
        │  STEP 3: Mars in house 10 → +2     │
        │  STEP 4: Ruling planets:           │
        │    • Day Lord (Fri) = Venus        │
        │      → House 11 → +1               │
        │    • Hora Lord = Mercury           │
        │      → House 9 → 0                 │
        │    • Minute Lord = Sun             │
        │      → House 12 → -1               │
        │                                      │
        │  FINAL SCORE: 2 + 1 + 0 - 1 = 2   │
        │  Verdict: score < 3 → CONDITIONAL  │
        │  Confidence: 62%                    │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │  Save Reading to Firestore         │
        │                                      │
        │  /readings/{readingId}             │
        │  {                                  │
        │    userId: 'user_001',             │
        │    question: 'Will I get...?',     │
        │    verdict: 'CONDITIONAL',         │
        │    confidence: 62,                 │
        │    rulingPlanets: { ... },         │
        │    narration: {                    │
        │      en: 'The response is...',     │
        │      ur: 'جواب یہ ہے...'           │
        │    },                              │
        │    createdAt: 2026-05-09T14:30Z    │
        │  }                                  │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │  Decrement Quota (same batch)      │
        │                                      │
        │  /quotas/{userId}                 │
        │  currentWeekUsage: 3 → 4           │
        │  remaining: 2                       │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │  Create Audit Log                  │
        │                                      │
        │  /auditLogs/{logId}                │
        │  {                                  │
        │    userId: 'user_001',             │
        │    action: 'QUESTION_ASKED',       │
        │    readingId: 'reading_456',       │
        │    category: 'career',             │
        │    verdict: 'CONDITIONAL',         │
        │    timestamp: 2026-05-09T14:30Z    │
        │  }                                  │
        └──────────────────┬──────────────────┘
                           │
                      [NETWORK]
                           │
                           ▼
                  ┌────────────────────────────┐
                  │  Return OracleResponse     │
                  │  {                         │
                  │    reading: { ... },       │
                  │    quotaRemaining: 2,      │
                  │    computedAt: ISO date    │
                  │  }                         │
                  └────────────────────────────┘
                             │
                             ▼
                  ┌────────────────────────────┐
                  │  Update readingsStore      │
                  │  • addReading()            │
                  │  • cache locally (MMKV)    │
                  └────────┬───────────────────┘
                           │
                           ▼
                  ┌────────────────────────────┐
                  │  Update quotaStore         │
                  │  remaining: 2              │
                  └────────┬───────────────────┘
                           │
                           ▼
                  ┌────────────────────────────┐
                  │  UI Re-renders             │
                  │  • Shows: CONDITIONAL      │
                  │  • Explains: 62% confident │
                  │  • Displays remedy advice  │
                  │  • Shows 2 readings left   │
                  └────────────────────────────┘
```

---

## Flow 2: Firebase Authentication Pipeline

```
LOGIN REQUEST
      │
      ▼
┌─────────────────────────────┐
│ User enters email + password│
│ OR clicks "Google Sign-In"  │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Firebase Auth SDK           │
│ (client-side)               │
│                             │
│ • Email/password → verify   │
│ • Google ID Token → trade   │
│   for Firebase Auth token   │
└────────┬────────────────────┘
         │ (if auth successful)
         ▼
┌─────────────────────────────┐
│ Firebase Issues JWT         │
│ (uid + custom claims)       │
│                             │
│ Payload:                    │
│ {                           │
│   uid: "user_123",          │
│   plan: "free",             │
│   planExpiry: null,         │
│   iat: 1620000000,          │
│   exp: 1620003600           │
│ }                           │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Store JWT locally           │
│ (Firebase SDK caches)       │
│                             │
│ Also stored in:             │
│ • React Native secureStore  │
│ • Zustand authStore         │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Create User Doc in Firestore│
│                             │
│ /users/{uid}                │
│ {                           │
│   displayName: "Sarfaraz",  │
│   email: "s@example.com",   │
│   locale: "en",             │
│   plan: "free",             │
│   createdAt: NOW            │
│ }                           │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Create Quota Doc            │
│                             │
│ /quotas/{uid}               │
│ {                           │
│   plan: "free",             │
│   currentWeekUsage: 0,      │
│   remaining: 5              │
│ }                           │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Set authStore state         │
│ • userId: "user_123"        │
│ • email: "s@example.com"    │
│ • isLoading: false          │
│ • error: null               │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Navigate to App (past Auth) │
└─────────────────────────────┘
```

---

## Flow 3: Data Synchronization (Local ↔ Cloud)

```
LOCAL (React Native App)          ↔           REMOTE (Firestore)
─────────────────────────────────────────────────────────────────

MMKV Storage                              Firestore Collections
  readingsStore                                  /readings
  settingsStore                                  /quotas
  (local cache)                                  /settings
                                                 /users

         syncReadings() called
              │
              ▼
    ┌──────────────────┐
    │ readingsStore    │
    │ .getSyncPending()│
    │ (dirty items)    │
    └────────┬─────────┘
             │
        [Network]
             │
             ▼
    ┌──────────────────────────┐
    │ Cloud Function           │
    │ syncReadings()           │
    │                          │
    │ For each reading:        │
    │ • Verify ownership       │
    │ • Merge with server copy │
    │ • Update timestamps      │
    └────────┬─────────────────┘
             │
             ▼
    ┌──────────────────────────┐
    │ Firestore Batch Write    │
    │ • Insert new readings    │
    │ • Update existing        │
    └────────┬─────────────────┘
             │
        [Network]
             │
             ▼
    ┌──────────────────────────┐
    │ Response: synced count   │
    │ { synced: 3, failed: 0 } │
    └────────┬─────────────────┘
             │
        [Network]
             │
             ▼
    ┌──────────────────────────┐
    │ readingsStore.clearSyncP │
    │ endingFlag()             │
    │ (mark synced)            │
    └──────────────────────────┘
```

---

## Architecture Summary Table

| Layer                  | Component            | Technology                    | Purpose                          |
| ---------------------- | -------------------- | ----------------------------- | -------------------------------- |
| **Presentation**       | React Native UI      | React Native 0.74.5           | User interface (Android app)     |
| **State**              | Zustand Stores       | zustand 4.5.5                 | Client-side state management     |
| **Local Persistence**  | MMKV Storage         | react-native-mmkv 2.12.2      | Offline-first local caching      |
| **API Gateway**        | Firebase SDK         | @react-native-firebase 19.3.0 | Client-server communication      |
| **Security**           | App Check + Auth     | Firebase App Check, Auth      | Device integrity + user identity |
| **Middleware**         | Functions Middleware | Node.js                       | Rate limiting, validation, auth  |
| **Business Logic**     | Astrology Engine     | TypeScript/Node.js            | Horary judgment computation      |
| **Remote Persistence** | Firestore            | Cloud Firestore (NoSQL)       | Persistent data store            |
| **Compute**            | Cloud Functions      | Firebase Functions (Node.js)  | Serverless backend services      |
| **Auth Backend**       | Firebase Auth        | Firebase Authentication       | OAuth2 + JWT                     |

---

# DEPLOYMENT ARCHITECTURE

```
┌───────────────────────────────────────────────────────────────────┐
│                   Google Cloud Platform (GCP)                     │
│                      Region: asia-south1                          │
└───────────────────────────────────────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Firebase Auth    │  │ Cloud Firestore  │  │ Cloud Functions  │
│ (Multi-region)   │  │ (asia-south1)    │  │ (asia-south1)    │
│                  │  │                  │  │                  │
│ • Email/password │  │ • 9 collections  │  │ • 7 functions    │
│ • Google OAuth   │  │ • Rules engine   │  │ • Node.js runtime│
│ • Custom claims  │  │ • Backup enabled │  │ • 512 MB memory  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

**END OF ARCHITECTURE ANALYSIS**
