# Shams Al-Asrar: Firebase-Based Security Architecture

**Status**: Updated Architecture Plan  
**Date**: April 25, 2026  
**Focus**: Firebase Cloud Functions for Calculation Engine + Firebase Auth

---

## Architecture Overview: Firebase Serverless

```
┌──────────────────────────────────────┐
│     React Native Client               │
│  (iOS + Android)                      │
│  ├─ Question UI                       │
│  ├─ Results Display                   │
│  └─ Local Cache (MMKV)                │
└──────────────┬───────────────────────┘
               │ HTTPS + Certificate Pinning
               │ Encrypted Payload
               │
┌──────────────▼───────────────────────┐
│     Firebase Cloud Functions          │
│  (Judgment Engine - PROPRIETARY)      │
│  ├─ POST /judge-horary                │
│  ├─ POST /refresh-token               │
│  ├─ GET /user-quota                   │
│  ├─ POST /submit-reading              │
│  └─ Audit Logging                     │
└──────────────┬───────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼──────┐
│ Firestore   │  │ Firebase    │
│ ├─ Users    │  │ Auth        │
│ ├─ Readings │  │             │
│ ├─ Quotas   │  │             │
│ └─ RLS      │  │             │
└─────────────┘  └─────────────┘
       │
       └─ (Alternative: Keep PostgreSQL + Firebase)

Additional Firebase Services:
├─ Realtime Database (optional for live sync)
├─ Firebase Storage (future: user uploads)
├─ Crashlytics (error tracking)
└─ Analytics (app usage metrics)
```

---

## Why Firebase Cloud Functions for Security

### Advantages
✅ **Hidden Backend**: Calculation logic runs server-side, never exposed to client  
✅ **Serverless**: No infrastructure to manage (Google manages security patches)  
✅ **Automatic Scaling**: Handles traffic spikes without intervention  
✅ **Built-in Logging**: Firebase Console logs all invocations (audit trail)  
✅ **Integrated with Auth**: Easy permission enforcement  
✅ **Cost-Effective**: Pay per execution (great for starter app)  
✅ **No Cold Start Penalty**: Cloud Functions 2nd gen has improved performance  

### Disadvantages
⚠️ **Vendor Lock-in**: Tied to Google/Firebase ecosystem  
⚠️ **Execution Limits**: Functions timeout after 9 minutes (usually fine for calculations)  
⚠️ **Memory/CPU Trade-off**: Less control than traditional servers  
⚠️ **Debugging**: Remote debugging more challenging than local backend  
⚠️ **Complex Calculations**: Heavy astrology math might be slower than compiled code  

---

## Cloud Functions Implementation Strategy

### Function 1: `judge-horary()` - Main Calculation Engine

```typescript
// functions/src/judgment/judgeHorary.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import type { Chart } from '../types/chart';
import type { ClassifiedQuestion } from '../types/question';
import type { Verdict } from '../types/verdict';

// CRITICAL: This logic is NEVER exposed to client
export const judgeHorary = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    
    // 1. Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const userId = context.auth.uid;
    
    // 2. Validate user quota
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();
    
    const quota = userDoc.data()?.monthlyQuota || 10;
    const used = userDoc.data()?.monthlyUsed || 0;
    
    if (used >= quota) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Monthly quota exceeded. Upgrade to premium.'
      );
    }

    // 3. Extract and validate input
    const { chartData, questionType, timestamp, latitude, longitude } = data;
    
    if (!chartData || !questionType) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields'
      );
    }

    // 4. PROPRIETARY LOGIC (All server-side, never seen by user)
    try {
      const chart: Chart = JSON.parse(chartData);
      const question: ClassifiedQuestion = {
        qType: questionType,
        timestamp,
        latitude,
        longitude
      };
      
      // Call the actual judgment engine
      const verdict = executeJudgmentEngine(chart, question);
      
      // 5. Log the calculation (audit trail)
      await admin.firestore()
        .collection('auditLogs')
        .add({
          userId,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          questionType,
          verdict: verdict.verdict,
          ipAddress: context.rawRequest.ip,
          userAgent: context.rawRequest.headers['user-agent']
        });
      
      // 6. Increment quota
      await admin.firestore()
        .collection('users')
        .doc(userId)
        .update({
          monthlyUsed: used + 1,
          lastCalculationTime: admin.firestore.FieldValue.serverTimestamp()
        });
      
      // 7. Return ONLY the verdict (not the algorithm details)
      return {
        verdict: verdict.verdict,
        confidence: verdict.confidence,
        timing: verdict.timing,
        reasoning: verdict.reasoning, // High-level only
        calculatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Judgment error:', error);
      // Log error without exposing details to user
      throw new functions.https.HttpsError(
        'internal',
        'Calculation failed. Please try again.'
      );
    }
  });


// Internal function (NOT exported, NEVER called directly from client)
function executeJudgmentEngine(
  chart: Chart,
  question: ClassifiedQuestion
): Verdict {
  
  // STEP 1: Read Moon's sub-lord
  const moon = chart.planets['Moon'];
  const moonSubLord = moon.subLord;
  let reasoning = `[STEP 1] Moon at ${moon.degree}deg sidereal\n`;
  
  // STEP 2: Load question matrix
  const matrix = HOUSE_MATRIX[question.qType];
  const { favorable, denial } = matrix;
  reasoning += `[STEP 2] Question: '${question.qType}' | favorable=${favorable}\n`;
  
  // STEP 3: Score moon's sub-lord house
  let score = 0;
  const moonSubLordHouse = houseOfPlanet(moonSubLord, chart);
  if (favorable.includes(moonSubLordHouse)) {
    score += 2;
    reasoning += `[STEP 3] Moon's Sub-Lord ${moonSubLord} in house ${moonSubLordHouse} (favorable) -> +2\n`;
  }
  
  // STEP 4: Score ruling planets
  for (const rp of chart.rulingPlanets) {
    const rpHouse = houseOfPlanet(rp, chart);
    if (favorable.includes(rpHouse)) {
      score += 1;
      reasoning += `[STEP 4] Ruling Planet ${rp} in house ${rpHouse} -> +1\n`;
    }
  }
  
  // STEP 5: Convert to verdict
  let verdict: 'YES' | 'NO' | 'CONDITIONAL' | 'DELAYED';
  if (score >= 3) verdict = 'YES';
  else if (score <= -2) verdict = 'NO';
  else verdict = 'CONDITIONAL';
  
  reasoning += `[STEP 5] Total score = ${score} -> verdict = ${verdict}\n`;
  
  return {
    verdict,
    confidence: Math.abs(score) / 5,
    reasoning,
    timing: calculateTiming(chart, moonSubLord),
    questionCusp: matrix.cusp
  };
}
```

### Function 2: Token Refresh

```typescript
export const refreshToken = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    }

    // Return a fresh ID token
    const token = await admin.auth().createCustomToken(context.auth.uid);
    
    return { idToken: token };
  });
```

### Function 3: User Quota Check

```typescript
export const getUserQuota = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    }

    const userDoc = await admin.firestore()
      .collection('users')
      .doc(context.auth.uid)
      .get();

    const quota = userDoc.data()?.monthlyQuota || 10;
    const used = userDoc.data()?.monthlyUsed || 0;
    const isPremium = userDoc.data()?.isPremium || false;

    return {
      totalQuota: quota,
      used,
      remaining: quota - used,
      isPremium,
      resetDate: userDoc.data()?.quotaResetDate
    };
  });
```

---

## Security Architecture: Firebase-Specific

### 1. Firebase Authentication Security

```typescript
// Client-side (React Native)
import { initializeAuth, connectAuthEmulator } from 'firebase/auth';
import { getReactNativePersistence } from 'firebase/auth/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Set HTTPS only
auth.useDeviceLanguage();
```

**Security Measures**:
- ✅ Tokens stored securely (AsyncStorage with encryption)
- ✅ Firebase handles password hashing & salting
- ✅ Multi-factor authentication available
- ✅ Automatic session management
- ✅ Device fingerprinting on suspicious logins

### 2. Firestore Security Rules

```javascript
// firestore.rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users can only read/write their own user document
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if request.auth.uid == userId && 
                      !request.resource.data.keys().hasAny(['isPremium', 'monthlyQuota']);
      // Prevent privilege escalation (can't set own premium status)
    }
    
    // Users can only see their own readings
    match /readings/{document=**} {
      allow read: if resource.data.userId == request.auth.uid;
      allow create: if request.auth.uid != null &&
                       request.resource.data.userId == request.auth.uid;
      allow update: if resource.data.userId == request.auth.uid;
      allow delete: if resource.data.userId == request.auth.uid;
    }
    
    // Audit logs: only admins can read
    match /auditLogs/{document=**} {
      allow read: if request.auth.token.admin == true;
      allow create: if false; // Only Cloud Functions can write
      allow write: if false;
    }
    
    // Quotas: read own, can't modify (only Cloud Functions)
    match /userQuotas/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if false; // Only Cloud Functions modify quotas
    }
  }
}
```

**What This Protects**:
- ✅ Users can't access other users' readings
- ✅ Users can't escalate their own premium status
- ✅ Audit logs are admin-only
- ✅ Quotas can't be manipulated from client

### 3. Cloud Functions Security

```typescript
// functions/.env
ALGORITHM_VERSION=1.0.0
MAX_EXECUTION_TIME=30000
```

**Best Practices**:
- ✅ All secrets in Cloud Secret Manager (never in code)
- ✅ Callable functions validate authentication
- ✅ Input sanitization on all parameters
- ✅ Error messages don't expose internal logic
- ✅ Execution time limits enforced
- ✅ Rate limiting via Cloud Armor (if using HTTP)

### 4. Network Security

**Certificate Pinning** (Android):
```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<?xml version="1.0" encoding="utf-8"?>
<domain-config cleartextTrafficPermitted="false">
  <domain includeSubdomains="true">*.firebaseio.com</domain>
  <pin-set>
    <pin digest="SHA-256">base64_cert_hash_here</pin>
  </pin-set>
</domain-config>
```

**iOS**: Use URLSession with certificate pinning
```swift
// In AppDelegate
URLSessionConfiguration.default.waitsForConnectivity = true
```

### 5. API Request Encryption (Optional E2EE)

```typescript
// For highly sensitive calculations, encrypt payload before sending
import crypto from 'crypto';

const encryptPayload = (data: any, publicKey: string) => {
  const encrypted = crypto.publicEncrypt(
    { key: publicKey },
    Buffer.from(JSON.stringify(data))
  );
  return encrypted.toString('base64');
};

// In Cloud Function, decrypt
const decryptPayload = (encryptedData: string, privateKey: string) => {
  const decrypted = crypto.privateDecrypt(
    { key: privateKey },
    Buffer.from(encryptedData, 'base64')
  );
  return JSON.parse(decrypted.toString());
};
```

---

## Firestore vs PostgreSQL Decision

### Current Situation
You're currently using **Supabase PostgreSQL**. Firebase approach requires choosing:

| Aspect | Firestore (NoSQL) | Keep PostgreSQL + Firebase |
|--------|-------------------|---------------------------|
| **Data Model** | Documents & Collections | Tables & Relations |
| **Queries** | Simple filters, good for user data | Complex joins, better for analytics |
| **Cost** | Pay per read/write (~$1 per 100K reads) | Managed database fee (~$15-50/month) |
| **Scalability** | Automatic, unlimited scale | Requires manual scaling |
| **Schema Flexibility** | High (good for evolving app) | Low (schema migrations needed) |
| **Firebase Integration** | Seamless (native) | Via Cloud Functions (slight overhead) |
| **Your Use Case** | User readings, quotas, audit logs | Better for users + readings |

### Recommendation: Hybrid Approach

**Keep PostgreSQL** for:
- Complex user data relationships
- Historical analytics
- Readings with relational queries

**Use Firestore** for:
- Real-time user session state
- Quota tracking (fast reads)
- Caching frequently accessed data

```typescript
// Cloud Function accessing PostgreSQL
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const getReadingHistory = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new Error('Unauthorized');
    
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM readings WHERE user_id = $1 LIMIT 100',
        [context.auth.uid]
      );
      return result.rows;
    } finally {
      client.release();
    }
  });
```

---

## Migration Plan: Supabase → Firebase

### Phase 1: Setup Firebase (Day 1)
```bash
npm install firebase-admin firebase-functions
firebase init functions
```

### Phase 2: Dual Setup (Day 2-3)
- [ ] Create Firebase project in Google Console
- [ ] Enable Authentication (Google, Email/Password)
- [ ] Create Firestore database
- [ ] Deploy initial Cloud Functions
- [ ] Keep Supabase running in parallel

### Phase 3: Migration (Day 4-7)
- [ ] Create Cloud Function to migrate user data
- [ ] Export Supabase users → Firebase Auth
- [ ] Export Supabase readings → Firestore/PostgreSQL
- [ ] Test all functionality with Firebase

### Phase 4: Cutover (Day 8)
- [ ] Switch app to Firebase backend
- [ ] Monitor for errors
- [ ] Keep Supabase as backup for 2 weeks
- [ ] Decommission Supabase if stable

---

## Cost Breakdown: Firebase vs Supabase

### Firebase Pricing (Estimated Monthly)

```
Firestore:
├─ Reads: 1M readings/month @ $0.06 per 100K = $6
├─ Writes: 500K updates/month @ $0.18 per 100K = $0.90
└─ Storage: 1GB @ $0.18/GB = $0.18

Cloud Functions:
├─ Executions: 1M calls @ 2GB-seconds avg
├─ Duration: 1M calls × 2 seconds = 2M GB-seconds
├─ Pricing: First 2M GB-seconds free, then $0.40 per 1M
└─ Estimated: $0 (free tier)

Authentication:
└─ Free (includes up to 50K sign-ins/month)

Storage:
└─ Free (first 5GB)

TOTAL: ~$7-10/month (scales with users)
```

### Supabase Pricing (Current)

```
PostgreSQL Database:
├─ Base: $25/month
├─ Auth: Included
├─ Storage: 5GB included
└─ API: Unlimited calls

TOTAL: ~$25-50/month (depending on storage/compute)
```

**Verdict**: Firebase is significantly cheaper for small-to-medium apps.

---

## Implementation Timeline

### Week 1 (Immediate)
- [ ] Create Firebase project
- [ ] Deploy initial Cloud Functions
- [ ] Implement Firebase Auth
- [ ] Test from React Native client

### Week 2 (Short-term)
- [ ] Complete function deployment
- [ ] Migrate user data
- [ ] Implement audit logging
- [ ] Security audit of Rules

### Week 3 (Medium-term)
- [ ] Production deployment
- [ ] Monitor performance
- [ ] Set up alerts
- [ ] Optimize cold starts

---

## Updated Security Architecture Decisions

| Component | Firebase Solution | Security Notes |
|-----------|-------------------|-----------------|
| **Backend** | Cloud Functions | ✅ Calculation engine hidden |
| **Database** | Firestore + PostgreSQL | ✅ RLS rules enforce data isolation |
| **Auth** | Firebase Auth | ✅ Built-in security best practices |
| **Secrets** | Cloud Secret Manager | ✅ No hardcoded keys |
| **Logging** | Firebase Console + Cloud Logging | ✅ Audit trail automatic |
| **Encryption** | TLS 1.3 + Firestore encryption | ✅ Data in transit & at rest |
| **Network** | Certificate Pinning | ✅ MITM protection |
| **Compliance** | Firestore backup + GDPR | ✅ Automatic backups |

---

## Next Steps

1. **Create Firebase Project**: Go to https://console.firebase.google.com
2. **Initialize Firebase in Project**: `firebase init` in your workspace
3. **Deploy Functions**: Create `functions/src/` with the code samples above
4. **Update React Native App**: Install Firebase SDK and update authentication
5. **Test End-to-End**: Test from app to Cloud Functions to Firestore
6. **Migration**: Move data from Supabase to Firebase

Would you like me to create the detailed implementation files now?
