# Firebase Setup Checklist & Configuration Guide

**Status**: Implementation Ready  
**Created**: April 25, 2026

---

## Pre-Setup: What You'll Need

- [ ] Google account with billing enabled
- [ ] Firebase CLI installed: `npm install -g firebase-tools`
- [ ] Node.js 18+ (for Cloud Functions)
- [ ] Your current Supabase data backed up
- [ ] Estimated setup time: 2-3 hours

---

## Step 1: Create Firebase Project

### 1.1 Go to Firebase Console
```
1. Visit: https://console.firebase.google.com
2. Click "Create a project"
3. Enter project name: "shams-al-asrar"
4. Enable Google Analytics: ☑️ Yes
5. Select Analytics location: USA (or your region)
6. Click "Create project"
```

### 1.2 Enable Required Services

In Firebase Console, under "Build":
- [ ] **Authentication**
  - Click "Authentication"
  - Click "Get started"
  - Enable: Email/Password
  - Enable: Google (optional for social login)
  - Enable: Anonymous (for testing)

- [ ] **Firestore Database**
  - Click "Firestore Database"
  - Click "Create database"
  - Start in: **Production mode** (we'll set RLS rules)
  - Location: **us-central1** (or nearest to your users)
  - Click "Create"

- [ ] **Cloud Functions**
  - Click "Functions"
  - Click "Get started"
  - Confirm billing plan (needed for functions)

---

## Step 2: Initialize Firebase in Your Project

### 2.1 Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login  # Authenticate with Google account
```

### 2.2 Initialize Firebase Project

```bash
cd c:\Users\Sarfaraz\Desktop\shams-al-asrar

# Initialize Firebase
firebase init

# When prompted, select:
# ✓ Firestore
# ✓ Functions
# ✓ Emulators (for local testing)
```

### 2.3 Project Structure After Init

```
c:\Users\Sarfaraz\Desktop\shams-al-asrar\
├── firebase.json          # Firebase config
├── firestore.rules        # Database security rules
├── firestore.indexes.json # Firestore indexes
└── functions/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts        # Main Cloud Functions
    │   └── judgment/
    │       └── judgeHorary.ts
    └── .runtimeconfig.json
```

---

## Step 3: Configure Cloud Functions

### 3.1 Create Main Function File

**File**: `functions/src/index.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Import callable functions
export { judgeHorary, refreshToken, getUserQuota } from './judgment/judgeHorary';
export { submitReading, getReadingHistory } from './readings/readings';
export { verifyAppSignature } from './security/verification';
```

### 3.2 Install Dependencies

```bash
cd functions
npm install
# Dependencies to add:
npm install firebase-functions firebase-admin
npm install --save-dev @types/node typescript
```

### 3.3 TypeScript Configuration

**File**: `functions/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./lib",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "lib"]
}
```

---

## Step 4: Environment Variables

### 4.1 Set Function Configuration

```bash
cd functions

# Set environment variables for functions
firebase functions:config:set judgment.engine_version="1.0.0"
firebase functions:config:set judgment.max_execution_ms=30000
firebase functions:config:set security.certificate_pin_hash="abc123..."
```

### 4.2 Create `.runtimeconfig.json`

**File**: `functions/.runtimeconfig.json`

```json
{
  "judgment": {
    "engine_version": "1.0.0",
    "max_execution_ms": 30000
  },
  "security": {
    "require_cert_pinning": true,
    "allow_jailbroken_devices": false
  }
}
```

---

## Step 5: Firestore Security Rules

### 5.1 Set Database Rules

**File**: `firestore.rules`

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Allow reads/writes only to authenticated users
    function isAuth() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuth() && request.auth.uid == userId;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isOwner(userId);
      allow create: if isOwner(userId) && !('isPremium' in request.resource.data);
      allow update: if isOwner(userId) && 
                       !request.resource.data.diff(resource.data).affectedKeys()
                       .hasAny(['isPremium', 'monthlyQuota', 'admin']);
      allow delete: if isOwner(userId);
    }
    
    // Readings collection (indexed for performance)
    match /readings/{readingId} {
      allow read: if isOwner(resource.data.userId);
      allow create: if isAuth() && 
                       request.resource.data.userId == request.auth.uid &&
                       request.resource.data.createdAt == request.time;
      allow update: if isOwner(resource.data.userId);
      allow delete: if isOwner(resource.data.userId);
    }
    
    // Quotas (read-only for users, write-only for functions)
    match /quotas/{userId} {
      allow read: if isOwner(userId);
      allow write: if false;
    }
    
    // Audit logs (admin only)
    match /auditLogs/{logId} {
      allow read: if request.auth.token.admin == true;
      allow write: if false;
    }
  }
}
```

### 5.2 Deploy Rules

```bash
firebase deploy --only firestore:rules
```

---

## Step 6: Cloud Functions - Judgment Engine

### 6.1 Create Judgment Function File

**File**: `functions/src/judgment/judgeHorary.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const judgeHorary = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https.onCall(async (data, context) => {
    
    // Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const userId = context.auth.uid;
    
    try {
      // Input validation
      const { chartData, questionType, timestamp, latitude, longitude } = data;
      
      if (!chartData || !questionType) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required parameters'
        );
      }

      // Validate coordinates
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid coordinates'
        );
      }

      // Check user quota
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(userId)
        .get();

      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'User document not found'
        );
      }

      const userData = userDoc.data();
      const monthlyQuota = userData?.monthlyQuota || 10;
      const monthlyUsed = userData?.monthlyUsed || 0;

      if (monthlyUsed >= monthlyQuota) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'Monthly quota exceeded. Upgrade to premium to continue.'
        );
      }

      // PROPRIETARY CALCULATION ENGINE (Hidden from client)
      const verdict = performJudgmentCalculation(chartData, questionType);

      // Log the calculation (audit trail)
      const auditData = {
        userId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        questionType,
        verdict: verdict.verdict,
        confidence: verdict.confidence,
        ipAddress: context.rawRequest?.ip || 'unknown',
        userAgent: context.rawRequest?.headers['user-agent'] || 'unknown',
        region: context.region,
      };

      await admin.firestore()
        .collection('auditLogs')
        .add(auditData);

      // Increment monthly usage
      await admin.firestore()
        .collection('users')
        .doc(userId)
        .update({
          monthlyUsed: monthlyUsed + 1,
          lastCalculationTime: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Return verdict (NOT the formula or intermediate calculations)
      return {
        verdict: verdict.verdict,
        confidence: verdict.confidence,
        timing: verdict.timing,
        reasoning: verdict.reasoning,
        calculatedAt: new Date().toISOString(),
        quotaRemaining: monthlyQuota - (monthlyUsed + 1),
      };

    } catch (error) {
      console.error('Judgment calculation error:', error);
      
      // Don't expose internal error details
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        'Calculation failed. Please try again later.'
      );
    }
  });

// Internal function - NOT exported, NEVER callable from client
function performJudgmentCalculation(
  chartData: string,
  questionType: string
): any {
  // Parse chart
  const chart = JSON.parse(chartData);
  
  // YOUR PROPRIETARY ALGORITHM HERE
  // (Copy from src/astrology/kp/judgment/judgeHorary.ts)
  
  // For now, placeholder
  return {
    verdict: 'YES',
    confidence: 0.8,
    timing: { days: 45 },
    reasoning: 'Calculation complete',
  };
}
```

### 6.2 Create Quota Management Function

**File**: `functions/src/quotas/quotas.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

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

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();

    return {
      totalQuota: userData?.monthlyQuota || 10,
      used: userData?.monthlyUsed || 0,
      remaining: (userData?.monthlyQuota || 10) - (userData?.monthlyUsed || 0),
      isPremium: userData?.isPremium || false,
      upgradeUrl: 'https://your-app.com/upgrade',
    };
  });
```

---

## Step 7: Deploy to Firebase

### 7.1 Test Locally

```bash
cd functions
npm run build  # Compile TypeScript

firebase emulators:start --only functions,firestore,auth
```

Visit: `http://localhost:5000`

### 7.2 Deploy to Production

```bash
firebase deploy --only functions,firestore:rules

# Verify deployment
firebase functions:list
```

---

## Step 8: Update React Native App

### 8.1 Install Firebase SDK

```bash
npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
```

### 8.2 Initialize Firebase in App

**File**: `src/supabase/client.ts` → Rename/replace with `src/firebase/client.ts`

```typescript
import { initializeApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { getFunctions } from '@react-native-firebase/functions';

// Your Firebase config (from Firebase Console)
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'shams-al-asrar.firebaseapp.com',
  projectId: 'shams-al-asrar',
  storageBucket: 'shams-al-asrar.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Use emulators in development
if (__DEV__) {
  // connectAuthEmulator(auth, 'http://localhost:9099', { forceNewInstance: true });
  // connectFirestoreEmulator(db, 'localhost', 8080);
  // connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

### 8.3 Call Cloud Function from App

```typescript
import { httpsCallable } from '@react-native-firebase/functions';

const judgeHoraryFunction = httpsCallable(functions, 'judgeHorary');

const submitQuestion = async (chartData: string, questionType: string) => {
  try {
    const result = await judgeHoraryFunction({
      chartData,
      questionType,
      timestamp: new Date().toISOString(),
      latitude: 28.6139,
      longitude: 77.2090,
    });

    console.log('Verdict:', result.data);
    // Handle result.data.verdict, result.data.confidence, etc.
    
  } catch (error) {
    console.error('Error calling function:', error);
    // Handle error
  }
};
```

---

## Step 9: Data Migration (Supabase → Firebase)

### 9.1 Export Supabase Users

```bash
# Use Supabase CLI or API to export users
# Then create script to import to Firebase Auth

firebase auth:import supabase-users.json
```

### 9.2 Migrate Readings Data

```typescript
// functions/src/migration/migrateReadings.ts
import * as admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

export const migrateReadingsData = async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );

  // Get all readings from Supabase
  const { data: readings } = await supabase
    .from('readings')
    .select('*');

  // Write to Firestore
  for (const reading of readings || []) {
    await admin.firestore()
      .collection('readings')
      .add({
        userId: reading.user_id,
        questionType: reading.question_type,
        verdict: reading.verdict,
        createdAt: new Date(reading.created_at),
        // ... other fields
      });
  }
};
```

---

## Step 10: Verification & Testing

### 10.1 Verification Checklist

- [ ] Firebase project created and APIs enabled
- [ ] Cloud Functions deployed and tested
- [ ] Firestore security rules deployed
- [ ] React Native app updated with Firebase SDK
- [ ] Authentication working (login/signup)
- [ ] Calling Cloud Functions from app works
- [ ] Quota system working correctly
- [ ] Audit logs being recorded
- [ ] No errors in Firebase Console

### 10.2 Security Verification

```bash
# Test Firestore rules
firebase emulators:exec "npm run test"

# Check function logs
firebase functions:log

# View audit logs
firebase emulators:exec "db.collection('auditLogs').get()"
```

---

## Cost Tracking

### Monthly Monitoring

```bash
# Check Firebase usage
firebase billing

# Estimated costs with 1000 users:
# - Firestore: ~$15/month
# - Cloud Functions: ~$10/month (with free tier)
# - Authentication: Free
# - Total: ~$25/month
```

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Functions timeout | Increase timeoutSeconds to 60 |
| Firestore rules rejected writes | Check RLS rules match data structure |
| Firebase SDK not importing | Run: `npm install --save @react-native-firebase/*` |
| Functions 404 error | Ensure function deployed: `firebase deploy --only functions` |
| Auth not persisting | Add persistence config in initializeApp |

---

## Next Steps

1. **Complete Firebase Project Setup** (Step 1-2)
2. **Deploy Cloud Functions** (Step 3-7)
3. **Update React Native App** (Step 8)
4. **Migrate Data** (Step 9)
5. **Run Security Audit** (Step 10)
6. **Go Live!**

---

**Questions?** Check Firebase Documentation: https://firebase.google.com/docs
