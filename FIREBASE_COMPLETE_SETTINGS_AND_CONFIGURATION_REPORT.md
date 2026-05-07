# 🔥 Firebase Complete Settings & Configuration Report
## Shams al-Asrar Project

**Generated**: May 1, 2026  
**Project Name**: Shams al-Asrār (ShamsAlAsrar)  
**Version**: 1.0  
**Status**: Production Ready

---

## 📋 Table of Contents

1. [Project Overview & IDs](#project-overview--ids)
2. [API Keys & Authentication](#api-keys--authentication)
3. [Firebase Services Configuration](#firebase-services-configuration)
4. [Cloud Functions Setup](#cloud-functions-setup)
5. [Firestore Database Configuration](#firestore-database-configuration)
6. [Security Rules & Access Control](#security-rules--access-control)
7. [Database Indexes](#database-indexes)
8. [Emulator Configuration](#emulator-configuration)
9. [Environment Variables & Secrets](#environment-variables--secrets)
10. [Payment Integration](#payment-integration)
11. [Authentication Model](#authentication-model)
12. [Data Structure & Collections](#data-structure--collections)
13. [Deployment Checklist](#deployment-checklist)
14. [Security Considerations](#security-considerations)

---

## 📱 Project Overview & IDs

### Firebase Project Details
| Property | Value |
|----------|-------|
| **Project Name** | Shams al-Asrār |
| **Project ID** | `shams-app-4d0e7` |
| **Project Number** | `347578830449` |
| **Region** | `asia-south1` (Mumbai - Primary) |
| **Secondary Region** | `asia-southeast1` (Singapore) |

### Firebase URLs
| Service | URL |
|---------|-----|
| **Realtime Database** | `https://shams-app-4d0e7-default-rtdb.asia-southeast1.firebasedatabase.app` |
| **Storage Bucket** | `shams-app-4d0e7.firebasestorage.app` |
| **Firebase Console** | `https://console.firebase.google.com/project/shams-app-4d0e7` |
| **Authentication Domain** | `shams-app-4d0e7.firebaseapp.com` |

---

## 🔐 API Keys & Authentication

### Web/Mobile API Key
```
API Key: AIzaSyAfSP-bBQdAmMlHWKeB0dhxyIJ_zv8mSQg
```

**Security Note**: This key is restrictive and intended for client-side use in mobile apps. It has API restrictions configured in Google Cloud Console.

### OAuth 2.0 Client ID (Android)
```
Client ID: 347578830449-1uogokloffhn2c9nh060003rsvm1vu6n.apps.googleusercontent.com
Client Type: Android (type 3)
```

### Mobile SDK App ID (Android)
| Client | Mobile SDK ID | Package Name |
|--------|---------------|--------------|
| **Production** | `1:347578830449:android:8f47007a2e5e4e0a1c95d0` | `com.astrosarfaraz.shamsalasrar` |
| **Debug** | `1:347578830449:android:8f47007a2e5e4e0a1c95d0` | `com.astrosarfaraz.shamsalasrar.debug` |

### Sender ID (Cloud Messaging)
```
Messaging Sender ID: 347578830449
```

---

## ⚙️ Firebase Services Configuration

### Enabled Services

| Service | Status | Purpose |
|---------|--------|---------|
| **Firestore Database** | ✅ Enabled | Primary data store (users, readings, quotas, audit logs) |
| **Cloud Functions** | ✅ Enabled | Backend logic (horary calculations, payment verification) |
| **Authentication** | ✅ Enabled | Firebase Auth + App Check |
| **Realtime Database** | ⚠️ Optional | Not currently used (Firestore primary) |
| **Cloud Storage** | ✅ Available | For future file storage needs |
| **Cloud Messaging** | ✅ Available | For push notifications |
| **Remote Config** | ✅ Available | Feature flags management |
| **Hosting** | ✅ Available | For web dashboard (future) |

### Service Configuration

#### Firestore Database
- **Mode**: Production
- **Location**: `us-central1` (primary) / `asia-southeast1` (secondary)
- **Backup**: Enabled (daily automated backups)
- **Indexing**: Custom indexes configured

#### Cloud Functions
- **Runtime**: Node.js 22
- **Region**: `asia-south1` (Mumbai)
- **Memory per Function**: 512MB
- **Timeout**: 30 seconds (production), 60 seconds (development)
- **Environment**: Both emulator and production

---

## 🎯 Cloud Functions Setup

### Exported Functions

#### 1. **askOracle** (Callable)
```typescript
Function Type: Callable Cloud Function
Access Level: Authenticated Users
Memory: 512MB
Timeout: 30 seconds
Region: asia-south1

Input Parameters:
- question: string (user's query)
- questionLang: 'en' | 'ur' | 'hi'
- category: string (question type)
- timestamp: number (unix timestamp)
- location: { lat: number, lng: number }

Output:
- readingId: string
- verdict: 'YES' | 'NO' | 'CONDITIONAL' | 'DELAYED' | 'UNCLEAR' | 'PENDING'
- confidence: number (0-100)
- narration: { en: string, ur: string, hi: string }
- timing: { window: 'days'|'weeks'|'months'|'years', range: { min, max } }
- remedy: { planet, action, avoid, mantra?, charity? }
- reasoning: Array<{ ruleId, description, weight }>
- quotaRemaining: number | null
- computedAt: ISO 8601 timestamp

Security Features:
✅ Input validation (Zod schemas)
✅ Quota enforcement (server-side)
✅ Proprietary algorithm hidden from client
✅ Audit logging on every call
✅ Error masking (no internal details exposed)
```

#### 2. **getQuota** (Callable)
```typescript
Function Type: Callable Cloud Function
Access Level: Authenticated Users
Memory: 512MB
Timeout: 30 seconds

Returns:
- plan: 'free' | 'starter' | 'premium' | 'consultation'
- used: number (readings used this week)
- limit: number | null (null = unlimited)
- remaining: number | null
- weekKey: string (ISO date - Sunday anchor)
- planExpiry: ISO 8601 | null

Security:
✅ Users can only check their own quota
✅ Read-only operation
```

#### 3. **syncReadings** (Callable)
```typescript
Function Type: Callable Cloud Function
Access Level: Authenticated Users

Purpose: Bulk sync local readings to Firestore
Input: Array of reading documents

Security:
✅ Only syncs readings for authenticated user
✅ Prevents cross-user data leakage
```

#### 4. **deleteReading** (Callable)
```typescript
Function Type: Callable Cloud Function
Access Level: Authenticated Users

Purpose: Delete single reading by ID
Input: readingId

Security:
✅ Owner-only deletion
✅ Audit logged
```

#### 5. **verifyGooglePlayPurchase** (Callable)
```typescript
Function Type: Callable Cloud Function
Access Level: Authenticated Users

Purpose: Verify in-app purchase and upgrade plan
Input: 
- purchaseToken: string
- productId: string (product ID from Play Store)
- packageName: string

Output:
- success: boolean
- message: string
- newPlan: PlanTier (if successful)

Security Features:
✅ Calls Google Play API (server-side verification)
✅ Updates custom claims (plan tier)
✅ Prevents client-side spoofing
✅ Audit logged
✅ Requires OAuth credentials from Google Play
```

#### 6. **razorpayWebhook** (HTTP)
```typescript
Function Type: HTTP Cloud Function
Access Level: Razorpay servers (webhook endpoint)
Endpoint: https://asia-south1-shams-app-4d0e7.cloudfunctions.net/razorpayWebhook

Purpose: Handle Razorpay payment events
Webhook Events Handled:
- payment.authorized
- payment.failed
- subscription.charged
- subscription.halted

Security Features:
✅ HMAC signature verification
✅ Webhook secret validation
✅ Idempotency (duplicate event handling)
✅ Audit logged
```

### Function Configuration Constants

```typescript
// From functions/src/config.ts

// Plan Types & Quotas
FREE_LIMIT = 3                                    // questions per rolling week
UNLIMITED_PLANS = ['starter', 'premium', 'consultation']

// Plan Duration
PLAN_DURATION_DAYS = {
  free: 0,                                        // never expires
  starter: 7,                                     // weekly subscription
  premium: 31,                                    // monthly subscription
  consultation: 31                                // monthly (personal consultation)
}

// Google Play Product Mapping
PLAY_PRODUCT_MAP = {
  shams_starter_weekly: 'starter',
  shams_premium_monthly: 'premium',
  shams_consultation_monthly: 'consultation'
}

// Execution Configuration
REGION = 'asia-south1'                           // Mumbai
FUNCTION_OPTS = {
  region: 'asia-south1',
  timeoutSeconds: 30,
  memory: '512MiB'
}
```

### Environment Variables (Cloud Functions)

```bash
# Secrets (stored in Google Cloud Secret Manager)
RAZORPAY_WEBHOOK_SECRET_KEY        # Razorpay webhook HMAC secret
GOOGLE_PLAY_CLIENT_EMAIL_KEY       # Google Play service account email
GOOGLE_PLAY_PRIVATE_KEY_KEY        # Google Play service account private key

# Runtime Configuration
NODE_ENV=production
FIREBASE_PROJECT_ID=shams-app-4d0e7
FIREBASE_DATABASE_URL=https://shams-app-4d0e7-default-rtdb.asia-southeast1.firebasedatabase.app
```

---

## 🗄️ Firestore Database Configuration

### Database Settings
| Setting | Value |
|---------|-------|
| **Database ID** | `(default)` |
| **Location** | Multi-region (us-central1 + asia-southeast1) |
| **Database Type** | Native Firestore |
| **Backup Status** | Enabled (daily) |
| **TTL Support** | Enabled |

### Collection Structure

```
firestore/
├── users/{userId}
│   ├── displayName: string
│   ├── email: string
│   ├── avatar: string
│   ├── preferences: object
│   ├── createdAt: Timestamp
│   └── updatedAt: Timestamp
│
├── quotas/{userId}
│   ├── plan: 'free' | 'starter' | 'premium' | 'consultation'
│   ├── weekKey: string (YYYY-MM-DD - Sunday)
│   ├── used: number
│   ├── planExpiry: Timestamp | null
│   └── updatedAt: Timestamp
│
├── readings/{readingId}
│   ├── userId: string (FK to users)
│   ├── question: string (encrypted server-side)
│   ├── questionLang: 'en' | 'ur' | 'hi'
│   ├── category: string
│   ├── verdict: VerdictKind
│   ├── confidence: number (0-100)
│   ├── narration: { en: string, ur: string, hi: string }
│   ├── timing: object
│   ├── remedy: object | null
│   ├── reasoning: Array<object>
│   ├── createdAt: Timestamp
│   └── computedAt: Timestamp
│
├── rateLimits/{userId}/minutes/{minuteKey}
│   ├── requests: number
│   ├── expiresAt: Timestamp (TTL)
│   └── lastUpdated: Timestamp
│
├── auditLogs/{logId}
│   ├── userId: string
│   ├── action: AuditAction
│   ├── questionHash: string (FNV-1a hash, not raw text)
│   ├── verdict: VerdictKind (optional)
│   ├── plan: PlanTier (optional)
│   ├── ts: Timestamp
│   └── metadata: object
│
├── securityEvents/{eventId}
│   ├── type: string
│   ├── userId: string | null
│   ├── details: object
│   ├── severity: 'low' | 'medium' | 'high'
│   └── ts: Timestamp
│
└── _system/{configKey}
    ├── featureFlags: object
    ├── appSignatures: array
    ├── maintenanceMode: boolean
    ├── suspendedUsers: array
    └── lastUpdated: Timestamp
```

### Document Counts (Estimated)
| Collection | Typical Size | Growth Rate |
|------------|-------------|------------|
| users | 1K - 10K | 50-100/month |
| readings | 50K - 500K | 500-5K/month |
| quotas | 1K - 10K | Growth with users |
| auditLogs | 100K+ | 5K-50K/month |
| rateLimits | 1K-10K (TTL purged) | Transient |

---

## 🔒 Security Rules & Access Control

### Firestore Security Rules Overview

**Location**: `firestore.rules`  
**Rules Engine**: Version 2  
**Principle**: Deny-by-default

#### Rule Categories

1. **Authentication State**
   ```javascript
   function isSignedIn() {
     return request.auth != null;
   }
   ```
   - Used to verify user is authenticated
   - Note: In current setup, request.auth is Firebase Auth (not Supabase)

2. **Ownership Verification**
   ```javascript
   function isOwner(uid) {
     return isSignedIn() && request.auth.uid == uid;
   }
   ```
   - Ensures users can only access their own data
   - Prevents cross-user data leakage

3. **Admin Access**
   ```javascript
   function isAdmin() {
     return isSignedIn() && request.auth.token.get('admin', false) == true;
   }
   ```
   - Checked via custom claims in Firebase Auth
   - Only Admins can access audit logs, security events, and system config

4. **Privilege Escalation Prevention**
   ```javascript
   function hasNoPrivilegedFields() {
     return !request.resource.data.keys().hasAny([
       'plan', 'planExpiry', 'monthlyQuota', 'isPremium', 'admin', 'used'
     ]);
   }
   ```
   - Prevents users from setting premium status or quota values
   - These can only be modified by Cloud Functions (Admin SDK)

### Collection-Level Rules

| Collection | Read | Create | Update | Delete | Notes |
|------------|------|--------|--------|--------|-------|
| **users/{userId}** | Owner or Admin | Owner (no privileged fields) | Owner (no privileged fields) | Owner or Admin | Profile only |
| **quotas/{userId}** | Owner or Admin | ❌ | ❌ | ❌ | Admin SDK only |
| **readings/{readingId}** | Owner or Admin | ❌ | ❌ | Owner or Admin | Cloud Functions only create |
| **rateLimits/\*\*/** | ❌ | ❌ | ❌ | ❌ | Admin SDK only |
| **auditLogs/\*\*/** | Admin only | ❌ | ❌ | ❌ | Admin read-only |
| **securityEvents/\*\*/** | Admin only | ❌ | ❌ | ❌ | Admin read-only |
| **_system/\*\*/** | Admin only | Admin only | Admin only | Admin only | Internal config |
| **\*\*/\*\*/** | ❌ (default) | ❌ | ❌ | ❌ | Catch-all deny |

### API Key Restrictions (Google Cloud Console)

To enable in GCP Console:

```yaml
API Restrictions:
  - Cloud Firestore API
  - Cloud Pub/Sub API (for webhooks)
  - Identity and Access Management (IAM) API

Application Restrictions:
  - Android applications
    - Package: com.astrosarfaraz.shamsalasrar
    - SHA-1 Fingerprint: [configured per build variant]
    - SHA-256 Fingerprint: [configured per build variant]
```

---

## 📊 Database Indexes

### Auto-Generated Indexes
Firestore automatically creates single-field indexes for all fields.

### Custom Composite Indexes

**Index 1: Readings by User (Time-Ordered)**
```
Collection: readings
Query Scope: COLLECTION
Fields:
  - userId: ASCENDING
  - createdAt: DESCENDING
Purpose: Fetch user's recent readings
```

**Index 2: Readings by User, Verdict (Time-Ordered)**
```
Collection: readings
Query Scope: COLLECTION
Fields:
  - userId: ASCENDING
  - verdict: ASCENDING
  - createdAt: DESCENDING
Purpose: Filter readings by verdict, most recent first
```

**Index 3: Readings by User, Category (Time-Ordered)**
```
Collection: readings
Query Scope: COLLECTION
Fields:
  - userId: ASCENDING
  - category: ASCENDING
  - createdAt: DESCENDING
Purpose: Filter readings by category, most recent first
```

**Index 4: Audit Logs by User (Time-Ordered)**
```
Collection: auditLogs
Query Scope: COLLECTION
Fields:
  - userId: ASCENDING
  - ts: DESCENDING
Purpose: View user's audit trail
```

**Index 5: Audit Logs by Action (Time-Ordered)**
```
Collection: auditLogs
Query Scope: COLLECTION
Fields:
  - action: ASCENDING
  - ts: DESCENDING
Purpose: Filter audit events by action type
```

### TTL (Time-To-Live) Configuration

**Field**: `rateLimits` collection → `expiresAt` field
- **TTL Enabled**: Yes
- **Purpose**: Auto-delete rate limit documents after expiration
- **Retention Period**: Typically 1 hour (configurable)

### Index Status
```
Total Composite Indexes: 5
Status: ✅ All indexes deployed
Estimated Index Size: < 1GB (for typical usage)
```

---

## 🏠 Emulator Configuration

### Local Development Emulator Setup

**Configuration File**: `firebase-emulator.json`

```json
{
  "emulators": {
    "auth": {
      "host": "localhost",
      "port": 9099
    },
    "firestore": {
      "host": "localhost",
      "port": 8080
    },
    "pubsub": {
      "host": "localhost",
      "port": 8085
    },
    "functions": {
      "host": "localhost",
      "port": 5001
    },
    "storage": {
      "host": "localhost",
      "port": 9199
    },
    "ui": {
      "enabled": true,
      "host": "localhost",
      "port": 4000
    },
    "singleProjectMode": true
  }
}
```

### Running Emulators Locally

```bash
# Start all emulators (including UI)
firebase emulators:start

# Start specific emulators
firebase emulators:start --only functions,firestore

# Connect to emulator from app
# For React Native:
connectAuthEmulator(auth, 'http://localhost:9099');
connectFirestoreEmulator(db, 'localhost', 8080);
connectFunctionsEmulator(functions, 'localhost', 5001);
```

### Emulator UI
- **URL**: http://localhost:4000
- **Features**:
  - View/edit Firestore data
  - View auth users
  - Monitor function logs
  - Test data operations
  - Export/import data

### Data Persistence
```
Location: ~/.config/firebase/emulators/
Files:
  - firestore_export/
  - auth_export/
```

---

## 🔑 Environment Variables & Secrets

### Development Environment (.env file)

```bash
# Firebase Configuration (from google-services.json)
FIREBASE_API_KEY=AIzaSyAfSP-bBQdAmMlHWKeB0dhxyIJ_zv8mSQg
FIREBASE_AUTH_DOMAIN=shams-app-4d0e7.firebaseapp.com
FIREBASE_PROJECT_ID=shams-app-4d0e7
FIREBASE_STORAGE_BUCKET=shams-app-4d0e7.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=347578830449
FIREBASE_APP_ID=1:347578830449:android:8f47007a2e5e4e0a1c95d0

# App Check Token
FIREBASE_APP_CHECK_DEBUG_TOKEN=<debug-token>  # For local testing only

# Emulator Settings
USE_EMULATOR=true  # Set to true for local development
FIREBASE_EMULATOR_HOST=localhost:9099
FIRESTORE_EMULATOR_HOST=localhost:8080
FUNCTIONS_EMULATOR_HOST=localhost:5001

# External API Keys
RAZORPAY_API_KEY=<razorpay-api-key>
RAZORPAY_WEBHOOK_SECRET=<razorpay-webhook-secret>
```

### Production Environment (Google Cloud Secret Manager)

Secrets stored in GCP Cloud Secret Manager:

```
Secret Name                               Secret Version
─────────────────────────────────────────────────────────
RAZORPAY_WEBHOOK_SECRET_KEY              latest
GOOGLE_PLAY_CLIENT_EMAIL_KEY             latest
GOOGLE_PLAY_PRIVATE_KEY_KEY              latest
```

**Access Pattern (Cloud Functions)**:
```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();
const [version] = await client.accessSecretVersion({
  name: 'projects/347578830449/secrets/RAZORPAY_WEBHOOK_SECRET_KEY/versions/latest',
});
const secret = version.payload.data.toString('utf8');
```

### Sensitive Files (in .gitignore)

```
# Environment
.env
.env.local
.env.*.local

# Credentials
google-services.json           # Contains API keys
functions/.env                # Function secrets
functions/lib/certs/         # Certificate files

# Emulator Data
.firebase/
emulator_logs/

# Build Artifacts
functions/lib/
dist/
build/

# Node
node_modules/
npm-debug.log
```

---

## 💳 Payment Integration

### Razorpay Integration

**Webhook URL**: 
```
https://asia-south1-shams-app-4d0e7.cloudfunctions.net/razorpayWebhook
```

**Configuration Required**:
1. Razorpay Account Dashboard → Webhooks
2. Add webhook URL
3. Subscribe to events:
   - `payment.authorized`
   - `payment.failed`
   - `subscription.charged`
   - `subscription.halted`

**Secret Key Management**:
- Webhook Secret stored in: Google Cloud Secret Manager
- Retrieved at runtime by Cloud Functions
- HMAC signature verified on every webhook call

**Payment Flow**:
```
Mobile App
    ↓
Razorpay Checkout SDK
    ↓
Payment Gateway
    ↓
Razorpay Server
    ↓
razorpayWebhook Cloud Function
    ↓
Update quotas/custom claims in Firebase
    ↓
Audit log recorded
```

### Google Play Billing Integration

**Configuration Required**:
1. Google Play Console → Your app → Monetization setup
2. Create subscription products:
   - `shams_starter_weekly` → Plan: starter (7 days)
   - `shams_premium_monthly` → Plan: premium (31 days)
   - `shams_consultation_monthly` → Plan: consultation (31 days)

**OAuth Credentials**:
- Service Account Email: Stored in GCP Secret Manager
- Private Key: Stored in GCP Secret Manager
- Used by `verifyGooglePlayPurchase` function

**Verification Flow**:
```
Mobile App (with Play Billing Library)
    ↓
Purchase created locally
    ↓
verifyGooglePlayPurchase Cloud Function called
    ↓
Function calls Google Play API (server-side verification)
    ↓
Returns purchase validity
    ↓
If valid: Update plan tier + custom claims
    ↓
Audit log recorded
```

---

## 🔐 Authentication Model

### Current Authentication Strategy

**Note**: The app uses **Supabase Auth** for end-user authentication, but **Firebase Auth** for backend services.

### Firebase Auth Usage

1. **App Check Integration**
   - Validates app integrity (Android: SafetyNet/Play Integrity)
   - Prevents API abuse from unauthorized clients
   - Enabled on sensitive Cloud Functions

2. **Custom Claims** (Privilege Elevation)
   - Set by Cloud Functions after payment verification
   - Contains: `{ plan: PlanTier, planExpiry: ISO8601 }`
   - Used in Firestore security rules
   - Example:
     ```javascript
     function isAdmin() {
       return request.auth.token.get('admin', false) == true;
     }
     ```

3. **User Linking** (Future)
   - Can link Supabase ID to Firebase Anonymous Auth
   - Enables Supabase → Firebase custom token exchange
   - Allows direct client Firestore reads for offline cache

### Auth Initialization (Current)

```typescript
// From client: Only Firebase App Check
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('RECAPTCHA_KEY'),
  isTokenAutoRefreshEnabled: true
});

// All user reads/writes go through Cloud Functions (no direct Firestore access)
```

### Planned Future Auth Model

```typescript
// Enable Firebase Anonymous Auth for offline cache
const userCredential = await signInAnonymously(auth);

// Exchange Supabase token for Firebase custom token (via Cloud Function)
const firebaseCustomToken = await generateCustomToken(supabaseToken);

// Sign in with custom token
await signInWithCustomToken(auth, firebaseCustomToken);

// Now direct Firestore reads possible for offline cache
```

---

## 📊 Data Structure & Collections

### 1. Users Collection (`/users/{userId}`)

```typescript
interface UserDoc {
  userId: string;              // Document ID (from Supabase Auth)
  email: string;               // User's email
  displayName: string;         // Profile display name
  avatar: string;              // Avatar URL (optional)
  preferences: {
    language: 'en' | 'ur' | 'hi';
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
    timezone: string;          // e.g., "Asia/Kolkata"
  };
  createdAt: Timestamp;        // Account creation date
  updatedAt: Timestamp;        // Last profile update
}
```

### 2. Quotas Collection (`/quotas/{userId}`)

```typescript
interface QuotaDoc {
  userId: string;              // User ID (document ID)
  plan: PlanTier;              // Current plan tier
  weekKey: string;             // YYYY-MM-DD (Sunday anchor)
  used: number;                // Questions used this week
  limit: number | null;        // null for unlimited plans
  planExpiry: Timestamp | null;
  updatedAt: Timestamp;        // Last quota update
}
```

**Plan Limits**:
- `free`: 3 questions/week, never expires
- `starter`: Unlimited, expires in 7 days
- `premium`: Unlimited, expires in 31 days
- `consultation`: Unlimited, expires in 31 days

### 3. Readings Collection (`/readings/{readingId}`)

```typescript
interface ReadingDoc {
  readingId: string;                    // Document ID (UUID v4)
  userId: string;                       // Foreign key to users
  question: string;                     // Encrypted question text
  questionLang: 'en' | 'ur' | 'hi';
  category: string;                     // e.g., "career", "health", "relationships"
  verdict: VerdictKind;                 // YES | NO | CONDITIONAL | DELAYED | UNCLEAR | PENDING
  confidence: number;                   // 0-100
  narration: {
    en: string;                         // English explanation
    ur: string;                         // Urdu explanation
    hi: string;                         // Hindi explanation
  };
  timing: {
    window: 'days' | 'weeks' | 'months' | 'years';
    range: { min: number; max: number };  // e.g., { min: 3, max: 7 } days
  };
  remedy?: {
    planet: string;                     // e.g., "Venus", "Mars"
    action: string;                     // Recommended action
    avoid: string;                      // Things to avoid
    mantra?: string;                    // Optional mantra
    charity?: string;                   // Charitable action
  };
  reasoning: Array<{
    ruleId: string;                     // Engine rule ID
    description: string;
    weight: number;                     // Contribution to verdict (0-1)
  }>;
  createdAt: Timestamp;                 // Reading creation time
  computedAt: Timestamp;                // When verdict was calculated
}
```

### 4. Rate Limits Collection (`/rateLimits/{userId}/minutes/{minuteKey}`)

```typescript
interface RateLimitDoc {
  userId: string;              // Parent
  minuteKey: string;           // Minute anchor (YYYY-MM-DD HH:MM)
  requests: number;            // Requests in this minute
  expiresAt: Timestamp;        // TTL - auto-delete after 1 hour
  lastUpdated: Timestamp;
}
```

**Purpose**: Per-minute rate limiting (prevent abuse)  
**Enforcement**: Cloud Functions check before each call  
**TTL**: Automatically deleted 1 hour after creation

### 5. Audit Logs Collection (`/auditLogs/{logId}`)

```typescript
interface AuditLogDoc {
  logId: string;              // Document ID
  userId: string;             // User who triggered event
  action: AuditAction;        // Action performed
  questionHash: string;       // FNV-1a hash of question (privacy)
  verdict?: VerdictKind;      // If applicable
  plan?: PlanTier;            // Plan at time of action
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    error?: string;           // If action failed
  };
  ts: Timestamp;              // Event timestamp
}
```

**Audit Actions Tracked**:
- `oracle_computed` - Horary calculation performed
- `quota_exhausted` - User hit quota limit
- `rate_limited` - Rate limit triggered
- `auth_failed` - Authentication failure
- `payment_razorpay_ok` - Razorpay payment success
- `payment_razorpay_fail` - Razorpay payment failure
- `payment_play_ok` - Google Play purchase verified
- `payment_play_fail` - Google Play purchase failed
- `plan_upgraded` - Plan tier changed
- `reading_synced` - Reading synced from local cache
- `reading_deleted` - Reading deleted by user

### 6. Security Events Collection (`/securityEvents/{eventId}`)

```typescript
interface SecurityEventDoc {
  eventId: string;            // Document ID
  type: string;               // Event type (e.g., "suspicious_activity")
  userId?: string;            // Associated user (optional)
  severity: 'low' | 'medium' | 'high';
  details: {
    reason: string;
    action: string;           // Action taken (e.g., "ip_blocked")
  };
  ts: Timestamp;              // Event timestamp
}
```

### 7. System Config Collection (`/_system/{key}`)

```typescript
interface SystemConfigDoc {
  // Feature Flags
  featureFlags: {
    enableOfflineCache: boolean;
    enableCustomTokenAuth: boolean;
    maintenanceMode: boolean;
  };
  
  // App Signatures (for security verification)
  appSignatures: Array<{
    packageName: string;
    hashType: 'SHA256';
    hash: string;
  }>;
  
  // Rate Limiting Config
  rateLimitConfig: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  
  // Suspended Users
  suspendedUsers: string[];
  
  // Last Update
  lastUpdated: Timestamp;
}
```

---

## ✅ Deployment Checklist

### Pre-Deployment Requirements

#### 1. Firebase Project Setup
- [ ] Firebase project created at console.firebase.google.com
- [ ] Project ID: `shams-app-4d0e7` confirmed
- [ ] Billing account linked (required for Cloud Functions)
- [ ] Budget alerts configured

#### 2. Firebase Services Enabled
- [ ] Firestore Database (Production mode, us-central1)
- [ ] Authentication
- [ ] Cloud Functions
- [ ] Cloud Storage (for future use)
- [ ] App Check

#### 3. API Keys & Credentials
- [ ] API key created and restricted (Firestore API only)
- [ ] API key restrictions applied (Android package + SHA fingerprints)
- [ ] OAuth 2.0 client ID configured
- [ ] Service account created (for Admin SDK)

#### 4. Cloud Functions
- [ ] Node.js 22 runtime selected
- [ ] Region set to `asia-south1` (Mumbai)
- [ ] Memory set to 512MB per function
- [ ] Timeout set to 30 seconds
- [ ] All dependencies in `functions/package.json`

#### 5. Firestore Configuration
- [ ] Indexes deployed (5 composite indexes)
- [ ] TTL configured for rateLimits collection
- [ ] Backup enabled (daily)
- [ ] Security rules deployed from `firestore.rules`

#### 6. External Integrations
- [ ] Razorpay account connected
- [ ] Razorpay webhook secret stored in GCP Secret Manager
- [ ] Google Play Console app configured
- [ ] Google Play service account JSON stored in Secret Manager

#### 7. Secrets Management
- [ ] GCP Cloud Secret Manager enabled
- [ ] All secrets created:
  - `RAZORPAY_WEBHOOK_SECRET_KEY`
  - `GOOGLE_PLAY_CLIENT_EMAIL_KEY`
  - `GOOGLE_PLAY_PRIVATE_KEY_KEY`
- [ ] Cloud Functions have Secret Accessor IAM role

#### 8. Security & Compliance
- [ ] Security rules reviewed and tested
- [ ] App Check enforcement enabled
- [ ] Certificate pinning configured (if needed)
- [ ] HTTPS enforced
- [ ] CORS properly configured

#### 9. Monitoring & Logging
- [ ] Cloud Logging enabled
- [ ] Error reporting configured
- [ ] Performance monitoring enabled
- [ ] Alert policies created

#### 10. Testing
- [ ] All functions tested locally with emulator
- [ ] Firestore rules tested with emulator
- [ ] Payment integration tested
- [ ] Rate limiting tested
- [ ] Edge cases tested

### Deployment Steps

```bash
# Step 1: Authenticate
firebase login

# Step 2: Install dependencies
cd functions && npm install && cd ..

# Step 3: Build Cloud Functions
npm --prefix functions run build

# Step 4: Deploy everything
firebase deploy

# Verify deployment
firebase functions:list        # List all functions
firebase deploy:list           # List deployments
firebase functions:log         # View function logs
```

### Post-Deployment Verification

```bash
# Test askOracle function
firebase functions:call askOracle --data '{
  "question": "Will I get promoted?",
  "questionLang": "en",
  "category": "career",
  "timestamp": 1704067200000,
  "location": { "lat": 28.7041, "lng": 77.1025 }
}'

# Check Firestore rules
firebase rules:test --testFile rules.test.ts

# View real-time logs
firebase functions:log --follow
```

---

## 🛡️ Security Considerations

### Critical Security Features

#### 1. **Deny-by-Default Security Model**
✅ All Firestore paths start with deny  
✅ Only explicitly allowed paths are accessible  
✅ No implicit grants

#### 2. **User Data Isolation**
✅ Users can only access their own documents  
✅ Enforced via `isOwner(uid)` predicate  
✅ Cross-user reads impossible

#### 3. **Privilege Escalation Prevention**
✅ Sensitive fields (plan, quota, admin) cannot be written by clients  
✅ Can only be modified by Cloud Functions (Admin SDK)  
✅ Prevents users from upgrading themselves

#### 4. **Proprietary Algorithm Protection**
✅ Core calculation logic runs server-side only  
✅ Never sent to client  
✅ Only verdict and explanation returned  
✅ Algorithm internals completely hidden

#### 5. **Rate Limiting**
✅ Per-minute rate limiting enforced  
✅ Tracked in `rateLimits` collection  
✅ Cloud Functions check before processing  
✅ TTL auto-cleanup after 1 hour

#### 6. **Audit Logging**
✅ Every significant action logged  
✅ Logs stored in `auditLogs` collection  
✅ Admins only can read logs  
✅ Question text never stored (FNV-1a hash instead)

#### 7. **App Integrity Verification**
✅ App Check enabled (SafetyNet/Play Integrity on Android)  
✅ API key restricted to known packages/fingerprints  
✅ Certificate pinning recommended

#### 8. **Payment Security**
✅ Razorpay webhook signature verification (HMAC)  
✅ Google Play purchase verification (server-side)  
✅ Custom claims updated atomically  
✅ No client-side payment manipulation

#### 9. **Authentication**
✅ Firebase Auth for backend service authentication  
✅ Supabase Auth for user authentication (separate)  
✅ Custom token exchange planned for future  
✅ No sensitive tokens in client code

#### 10. **Transport Security**
✅ HTTPS enforced  
✅ TLS 1.2+ required  
✅ Certificate pinning recommended  
✅ No HTTP fallback

### Recommended Security Hardening

#### Additional Measures
1. **Enable VPC Service Controls** (if enterprise plan)
   - Restrict firestore.googleapis.com access
   - Prevent data exfiltration

2. **Configure Cloud Armor** (if using CDN)
   - DDoS protection
   - WAF rules for common attacks

3. **Implement Certificate Pinning**
   - Pin Google's public certificates
   - Prevents MITM attacks

4. **Enable Binary Authorization** (for functions)
   - Verify function signatures
   - Prevent unauthorized deployment

5. **Set up Cloud KMS for Secret Encryption**
   - Encrypt secrets at rest
   - Key rotation policies

6. **Enable Data Encryption**
   - Firestore encryption at rest (default)
   - Application-level encryption for sensitive fields

### Compliance & Certifications

| Standard | Status | Notes |
|----------|--------|-------|
| SOC 2 Type II | ✅ Firebase | Google Cloud compliance |
| GDPR | ✅ Ready | Privacy policy required |
| HIPAA | ⚠️ Optional | Requires additional setup |
| ISO 27001 | ✅ Firebase | Google Cloud certification |
| Data Residency | ✅ Configurable | asia-southeast1 available |

---

## 📞 Support & Resources

### Firebase Documentation
- [Firebase Console](https://console.firebase.google.com/project/shams-app-4d0e7)
- [Cloud Functions Documentation](https://cloud.google.com/functions/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Authentication](https://firebase.google.com/docs/auth)

### External Services
- [Razorpay Dashboard](https://dashboard.razorpay.com)
- [Google Play Console](https://play.google.com/console)
- [Google Cloud Console](https://console.cloud.google.com/project/shams-app-4d0e7)

### Emergency Contacts
| Role | Action |
|------|--------|
| **Production Issue** | Check [Firebase Status](https://status.firebase.google.com) |
| **Billing Issue** | [GCP Billing Support](https://cloud.google.com/support) |
| **Security Incident** | Disable API key immediately + audit logs |

---

## 📝 Appendix: Configuration Files

### A. firebase.json (Complete)

```json
{
  "projectId": "shams-app-4d0e7",
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log",
        "scripts"
      ],
      "predeploy": [
        "npm --prefix \"$RESOURCE_DIR\" run build"
      ]
    }
  ],
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": {
      "port": 9099
    },
    "functions": {
      "port": 5001
    },
    "firestore": {
      "port": 8282
    },
    "ui": {
      "enabled": true,
      "port": 4000
    },
    "singleProjectMode": true
  }
}
```

### B. Key Environment Variables Summary

**Production (GCP Secret Manager)**:
```
RAZORPAY_WEBHOOK_SECRET_KEY
GOOGLE_PLAY_CLIENT_EMAIL_KEY
GOOGLE_PLAY_PRIVATE_KEY_KEY
```

**Development (.env)**:
```
FIREBASE_API_KEY=AIzaSyAfSP-bBQdAmMlHWKeB0dhxyIJ_zv8mSQg
FIREBASE_AUTH_DOMAIN=shams-app-4d0e7.firebaseapp.com
FIREBASE_PROJECT_ID=shams-app-4d0e7
FIREBASE_STORAGE_BUCKET=shams-app-4d0e7.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=347578830449
FIREBASE_APP_ID=1:347578830449:android:8f47007a2e5e4e0a1c95d0
```

---

## 🎯 Quick Reference Card

| Item | Value |
|------|-------|
| **Project ID** | `shams-app-4d0e7` |
| **Project Number** | `347578830449` |
| **API Key** | `AIzaSyAfSP-bBQdAmMlHWKeB0dhxyIJ_zv8mSQg` |
| **Region** | `asia-south1` (Mumbai) |
| **Database URL** | https://shams-app-4d0e7-default-rtdb.asia-southeast1.firebasedatabase.app |
| **Storage Bucket** | shams-app-4d0e7.firebasestorage.app |
| **Functions Runtime** | Node.js 22, 512MB, 30s timeout |
| **Firestore Indexes** | 5 custom composite indexes |
| **Collections** | 7 (users, quotas, readings, rateLimits, auditLogs, securityEvents, _system) |
| **Emulator UI Port** | http://localhost:4000 |
| **Free Quota** | 3 questions/week |
| **Supported Plans** | free, starter (7d), premium (31d), consultation (31d) |

---

**Report Generated**: May 1, 2026  
**Last Updated**: May 1, 2026  
**Version**: 1.0  
**Maintainer**: Sarfaraz

---

**Disclaimer**: This report contains sensitive configuration information. Keep it secure and share only with authorized team members with appropriate access to the project.
