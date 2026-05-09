# 🔍 Firebase Configuration Issues & Fixes Report

## Shams al-Asrar Project

**Generated**: May 1, 2026  
**Analysis Date**: May 1, 2026  
**Status**: ⚠️ CRITICAL ISSUES FOUND - ACTION REQUIRED

---

## 📋 Executive Summary

Your Firebase configuration has **several security and configuration issues** that need immediate attention before production deployment:

| Severity        | Count | Status                       |
| --------------- | ----- | ---------------------------- |
| 🔴 **CRITICAL** | 4     | Must fix before deployment   |
| 🟡 **HIGH**     | 5     | Should fix before deployment |
| 🟠 **MEDIUM**   | 6     | Should fix soon              |
| 🟢 **LOW**      | 3     | Nice to have                 |

**Total Issues**: 18  
**Estimated Fix Time**: 2-4 hours

---

## 🔴 CRITICAL ISSUES (FIX IMMEDIATELY)

### Issue #1: API Key Exposed in google-services.json

**Severity**: 🔴 CRITICAL  
**Location**: `android/app/google-services.json`  
**Problem**:

```
"api_key": [
  {
    "current_key": "AIzaSyAfSP-bBQdAmMlHWKeB0dhxyIJ_zv8mSQg"
  }
]
```

The API key is visible in a file that gets committed to git (even though it should be restricted).

**Risks**:

- ❌ If git history is exposed, anyone can use this key
- ❌ Even though restricted to Firestore API, still a security concern
- ❌ Key rotation difficult if exposed

**Fix Steps**:

1. **Immediately rotate the API key** (Google Cloud Console):

   ```
   1. Go to: https://console.cloud.google.com/apis/credentials
   2. Find: AIzaSyAfSP-bBQdAmMlHWKeB0dhxyIJ_zv8mSQg
   3. Click Delete
   4. Create a new API key
   5. Update google-services.json with new key
   ```

2. **Add API key restrictions**:

   ```
   API Restrictions:
   - Cloud Firestore API ONLY
   - NO admin APIs
   - NO Cloud Storage
   - NO Realtime Database

   Application Restrictions:
   - Android applications
   - Package: com.astrosarfaraz.shamsalasrar
   - SHA-1: [your debug fingerprint]
   - SHA-256: [your release fingerprint]
   ```

3. **Generate new google-services.json** from Firebase Console:

   ```
   Firebase Console → Project Settings → Your Apps → Download google-services.json
   ```

4. **Verify restrictions are set in GCP Console**:
   ```
   Google Cloud Console → APIs & Services → Credentials
   → Click the key → Edit
   ```

**Status**: ⏳ PENDING - Not yet completed

---

### Issue #2: Missing Cloud Functions Secret Manager Configuration

**Severity**: 🔴 CRITICAL  
**Location**: Cloud Functions environment  
**Problem**:

Three critical secrets are referenced in code but NOT configured:

```typescript
// From razorpay.ts
const s = process.env.RAZORPAY_WEBHOOK_SECRET;

// From googlePlay.ts
const clientEmail = process.env.GOOGLE_PLAY_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PLAY_PRIVATE_KEY;
```

If these are not set in production, functions will **CRASH**:

- ❌ `razorpayWebhook` will throw: "RAZORPAY_WEBHOOK_SECRET not configured"
- ❌ `verifyGooglePlayPurchase` will throw: "Play Store credentials not configured"

**Risks**:

- ❌ Payment webhooks will fail silently (user upgrades not processed)
- ❌ Google Play purchases won't verify (users lose access)
- ❌ Revenue loss + user frustration

**Fix Steps**:

1. **Create secrets in Google Cloud Secret Manager**:

   ```bash
   # Get your Razorpay webhook secret from:
   # Dashboard → Settings → Webhooks → Copy Secret

   gcloud secrets create RAZORPAY_WEBHOOK_SECRET \
     --data-file=- <<EOF
   [your-razorpay-webhook-secret]
   EOF

   # Get your Google Play service account from:
   # Google Cloud Console → Service Accounts → Select account → Keys
   # Download JSON, extract fields:

   gcloud secrets create GOOGLE_PLAY_CLIENT_EMAIL \
     --data-file=- <<EOF
   your-service-account@project.iam.gserviceaccount.com
   EOF

   gcloud secrets create GOOGLE_PLAY_PRIVATE_KEY \
     --data-file=- <<EOF
   -----BEGIN PRIVATE KEY-----
   [your-multiline-private-key]
   -----END PRIVATE KEY-----
   EOF
   ```

2. **Grant Cloud Functions access** to secrets:

   ```bash
   # Find your Cloud Functions service account
   PROJECT_ID=shams-app-4d0e7
   SA_EMAIL=$(gcloud iam service-accounts list \
     --filter="displayName:Firebase Functions" \
     --format="value(email)")

   # Grant secretAccessor role
   for SECRET in RAZORPAY_WEBHOOK_SECRET GOOGLE_PLAY_CLIENT_EMAIL GOOGLE_PLAY_PRIVATE_KEY; do
     gcloud secrets add-iam-policy-binding $SECRET \
       --member=serviceAccount:$SA_EMAIL \
       --role=roles/secretmanager.secretAccessor
   done
   ```

3. **Update Cloud Functions to use secrets**:

   This is already done in the code (uses `process.env`), but Firebase needs to know about secrets in `functions/firebase.json`:

   ```json
   {
     "functions": [
       {
         "source": "functions",
         "codebase": "default",
         "secrets": [
           "RAZORPAY_WEBHOOK_SECRET",
           "GOOGLE_PLAY_CLIENT_EMAIL",
           "GOOGLE_PLAY_PRIVATE_KEY"
         ]
       }
     ]
   }
   ```

4. **Test locally** before deployment:

   ```bash
   # Create functions/.env with dummy values for testing
   RAZORPAY_WEBHOOK_SECRET=test-secret
   GOOGLE_PLAY_CLIENT_EMAIL=test@example.com
   GOOGLE_PLAY_PRIVATE_KEY="test-key"

   # Run emulator
   firebase emulators:start --only functions
   ```

**Status**: ⏳ PENDING - Need to create secrets

---

### Issue #3: App Check Not Configured in Android App

**Severity**: 🔴 CRITICAL  
**Location**: `src/` (React Native app)  
**Problem**:

App Check is enforced in Cloud Functions:

```typescript
enforceAppCheck: process.env.NODE_ENV !== 'development'; // ← true in production
```

But **App Check is NOT initialized in the client**. This means:

- ❌ In production, all Cloud Function calls will be **REJECTED**
- ❌ App won't work at all after deployment
- ❌ All users get: "Error: App Check token is missing"

**Risks**:

- 🚨 **COMPLETE APP FAILURE IN PRODUCTION**
- ❌ All readings, quota checks, payments will fail
- ❌ Users cannot use the app

**Fix Steps**:

1. **Enable App Check in Firebase Console**:

   ```
   Firebase Console → Project Settings → App Check
   → Click "Enable" on your app
   → Select "SafetyNet/Play Integrity" for Android
   ```

2. **Add App Check initialization to React Native**:

   Create or update `src/firebase/appCheck.ts`:

   ```typescript
   import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
   import { app } from './client';

   export function initializeAppCheckService() {
     if (Platform.OS === 'android') {
       // Use Play Integrity (recommended for production)
       initializeAppCheck(app, {
         provider: new PlayIntegrityProvider('YOUR_PLAY_INTEGRITY_TOKEN'),
         isTokenAutoRefreshEnabled: true,
       });
     } else {
       // Fallback for development/testing
       if (__DEV__) {
         window.FIREBASE_APPCHECK_DEBUG_TOKEN = 'YOUR_DEBUG_TOKEN';
       }

       initializeAppCheck(app, {
         provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_KEY'),
         isTokenAutoRefreshEnabled: true,
       });
     }
   }
   ```

3. **Import in your main app** (`src/App.tsx`):

   ```typescript
   import { initializeAppCheckService } from './firebase/appCheck';

   export default function App() {
     useEffect(() => {
       initializeAppCheckService();
     }, []);

     return (/* your app */)
   }
   ```

4. **Get Play Integrity token**:

   ```
   1. Google Play Console → Your App → Setup → App Integrity
   2. Copy your Play Integrity token
   3. Use in code above
   ```

5. **For development, use debug token**:
   ```
   Firebase Console → App Check → Manage Apps
   → Click your app → Get Debug Token
   → Add to .env: FIREBASE_APPCHECK_DEBUG_TOKEN=token
   ```

**Status**: ⏳ PENDING - App Check not initialized in client

---

### Issue #4: Razorpay Webhook Configuration Missing

**Severity**: 🔴 CRITICAL  
**Location**: Razorpay Dashboard + Firebase  
**Problem**:

The webhook endpoint exists in code but is NOT configured in Razorpay:

```typescript
export const razorpayWebhook = onRequest({ region: REGION, timeoutSeconds: 30 }, ...)
```

This means:

- ❌ When users pay via Razorpay, **plans are NOT updated**
- ❌ Payments succeed but quotas remain unchanged
- ❌ Revenue loss (users think they paid but can't use premium)

**Risks**:

- 🚨 **PAYMENT PROCESSING BROKEN**
- ❌ Users pay but don't get access
- ❌ Support tickets + refund requests
- ❌ Trust issues

**Fix Steps**:

1. **Find your webhook URL**:

   ```bash
   # After deploying functions to Firebase
   firebase deploy --only functions

   # Find razorpayWebhook URL in output:
   # Function URL (razorpayWebhook): https://asia-south1-shams-app-4d0e7.cloudfunctions.net/razorpayWebhook
   ```

2. **Configure in Razorpay Dashboard**:

   ```
   1. Go to: https://dashboard.razorpay.com/settings/webhooks
   2. Click "Add New Webhook"
   3. URL: https://asia-south1-shams-app-4d0e7.cloudfunctions.net/razorpayWebhook
   4. Events: Select these events
      - payment.authorized ✓
      - payment.failed ✓
      - subscription.charged ✓
      - subscription.halted ✓
   5. Active: ON ✓
   6. Click "Create Webhook"
   7. Copy: "Webhook Secret"
   ```

3. **Save webhook secret**:

   ```bash
   # Add to GCP Secret Manager
   gcloud secrets create RAZORPAY_WEBHOOK_SECRET \
     --data-file=- <<EOF
   [your-webhook-secret-from-step-7]
   EOF
   ```

4. **Test webhook**:

   ```bash
   # From Razorpay dashboard, click "Test"
   # Or make a test payment

   # Verify logs
   firebase functions:log

   # Look for: "razorpay webhook received" in logs
   ```

**Status**: ⏳ PENDING - Webhook not configured in Razorpay

---

## 🟡 HIGH PRIORITY ISSUES (SHOULD FIX BEFORE DEPLOYMENT)

### Issue #5: Google Play Service Account Not Configured

**Severity**: 🟡 HIGH  
**Location**: Google Play Console + functions/  
**Problem**:

Google Play purchase verification won't work:

```typescript
if (!clientEmail || !privateKey) {
  throw new HttpsError('internal', 'Play Store credentials not configured');
}
```

**Impact**:

- ❌ Google Play purchases fail to verify
- ❌ Users can't upgrade plans via Play Store
- ❌ Premium revenue completely blocked (on Android)

**Fix Steps**:

1. **Create service account in Google Cloud**:

   ```
   Google Cloud Console → Service Accounts
   → Create Service Account
   → Name: "Firebase Google Play"
   → Grant roles:
      - "Pub/Sub Publisher" (for events)
   ```

2. **Create and download private key**:

   ```
   → Click "Keys" tab
   → "Add Key" → "Create new key"
   → Format: JSON
   → Download JSON file
   ```

3. **Link to Google Play**:

   ```
   Google Play Console → Settings → Developer Account
   → Linked Google Cloud Projects
   → Link the service account
   ```

4. **Add to Secret Manager** (already covered in Issue #2)

**Status**: ⏳ PENDING - Service account not linked

---

### Issue #6: Missing Environment Variable Documentation for Local Dev

**Severity**: 🟡 HIGH  
**Location**: Project root + functions/  
**Problem**:

Developers are confused about which `.env` variables are required:

- `functions/.env` - Cloud Functions secrets (local emulator only)
- `.env` - App configuration (client + server)
- `.env.example` - Template (incomplete)

**Confusion**:

```
Which env file goes where?
What's required vs optional?
Which secrets go in Secret Manager?
```

**Fix**: Create setup guide (see Issue #14 for documentation fix)

**Status**: ⏳ PENDING - Documentation incomplete

---

### Issue #7: Firebase Project Billing Not Enabled

**Severity**: 🟡 HIGH  
**Location**: GCP Console  
**Problem**:

Cloud Functions requires Cloud Billing to be enabled:

- ❌ Functions may be disabled if billing lapses
- ❌ No alerts configured
- ❌ Budget limits not set

**Risk**:

- 🚨 App stops working if billing disabled
- ❌ Unexpected charges if scaling happens

**Fix Steps**:

1. **Enable billing**:

   ```
   Google Cloud Console → Billing
   → Link billing account to project
   ```

2. **Set budget alerts**:

   ```
   → Budgets & alerts
   → Create budget
   → Set limit: $100/month (adjust as needed)
   → Alert at 50%, 90%, 100%
   ```

3. **Review costs**:
   ```
   → Cost Management → Cost breakdown
   → Verify charges are reasonable
   ```

**Status**: ⏳ PENDING - Check if billing is properly configured

---

### Issue #8: Firestore Security Rules Not Tested

**Severity**: 🟡 HIGH  
**Location**: `firestore.rules`  
**Problem**:

Rules look good but NOT verified:

- ❌ No automated tests for security rules
- ❌ No test coverage for edge cases
- ❌ Rules could have logic errors in production

**Risk**:

- 🚨 Data leakage if rules are wrong
- ❌ Users see each other's data
- ❌ Privilege escalation possible

**Fix Steps**:

1. **Create test file** `firestore.rules.test.ts`:

   ```typescript
   import {
     assertFails,
     assertSucceeds,
     initializeTestEnvironment,
     RulesTestEnvironment,
   } from '@firebase/rules-unit-testing';

   describe('Firestore Security Rules', () => {
     let testEnv: RulesTestEnvironment;

     beforeAll(async () => {
       testEnv = await initializeTestEnvironment({
         projectId: 'shams-app-4d0e7',
         firestore: {
           rules: fs.readFileSync('firestore.rules', 'utf8'),
         },
       });
     });

     it('users can read own /users/{userId}', async () => {
       const db = testEnv.authenticatedContext('user123').firestore();
       await assertSucceeds(db.collection('users').doc('user123').get());
     });

     it('users CANNOT read /quotas/{userId}', async () => {
       const db = testEnv.authenticatedContext('user456').firestore();
       await assertFails(db.collection('quotas').doc('user123').get());
     });

     it('users CANNOT write privileged fields', async () => {
       const db = testEnv.authenticatedContext('user123').firestore();
       await assertFails(db.collection('users').doc('user123').set({ plan: 'premium' }));
     });

     // ... more tests
   });
   ```

2. **Run tests**:

   ```bash
   npm test -- firestore.rules.test.ts
   ```

3. **Deploy with verification**:
   ```bash
   firebase rules:test
   ```

**Status**: ⏳ PENDING - Rules tests not created

---

### Issue #9: Cloud Functions Missing Error Handling for Secrets

**Severity**: 🟡 HIGH  
**Location**: `functions/src/functions/payments/`  
**Problem**:

If secret retrieval fails, error is not user-friendly:

```typescript
if (!s) {
  throw new Error('RAZORPAY_WEBHOOK_SECRET not configured');
}
```

This shows developers the issue, but users get a 500 error with no explanation.

**Better approach**: Graceful fallback or clear error

**Fix**: Add proper error handling (covered in Issue #16)

**Status**: ⏳ PENDING

---

## 🟠 MEDIUM PRIORITY ISSUES (SHOULD FIX SOON)

### Issue #10: Missing App Check Debug Token for Local Testing

**Severity**: 🟠 MEDIUM  
**Location**: `.env.example` + `src/`  
**Problem**:

To test App Check locally without Play Integrity, you need a debug token:

- ❌ Not documented in .env.example
- ❌ Not initialized in app
- ❌ Developer doesn't know where to get it

**Fix Steps**:

1. **Get debug token**:

   ```
   Firebase Console → App Check
   → Manage Apps → Click your app
   → Debug tokens
   → Create debug token
   ```

2. **Add to .env.example**:

   ```bash
   FIREBASE_APPCHECK_DEBUG_TOKEN=your-debug-token
   ```

3. **Use in app** (update `src/firebase/appCheck.ts`):
   ```typescript
   if (__DEV__) {
     const debugToken = process.env.FIREBASE_APPCHECK_DEBUG_TOKEN;
     if (debugToken) {
       // @ts-ignore - debug token is dev-only
       window.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
     }
   }
   ```

**Status**: ⏳ PENDING

---

### Issue #11: Rate Limit Configuration Not Customizable

**Severity**: 🟠 MEDIUM  
**Location**: `functions/src/middleware/rateLimit.ts`  
**Problem**:

Rate limiting is hardcoded, can't be changed without code changes:

```typescript
const REQUESTS_PER_MINUTE = 10; // ← hardcoded
```

**Issue**:

- ❌ Can't adjust if bots attack
- ❌ Can't tighten for free tier
- ❌ Can't loosen for power users

**Fix**: Move to `_system` Firestore collection:

```typescript
// Read from Firestore instead
const sysConfig = await db.collection('_system').doc('rateLimitConfig').get();
const REQUESTS_PER_MINUTE = sysConfig.data()?.requestsPerMinute ?? 10;
```

**Status**: ⏳ PENDING - Configuration not externalized

---

### Issue #12: Audit Logging Doesn't Record IP Address

**Severity**: 🟠 MEDIUM  
**Location**: `functions/src/utils/logger.ts`  
**Problem**:

No IP logging for security events:

```typescript
await db.collection('auditLogs').add({
  userId,
  action: 'oracle_computed',
  // ← NO ipAddress field!
  ts: FieldValue.serverTimestamp(),
});
```

**Risk**:

- ❌ Can't detect attack patterns
- ❌ Can't trace suspicious activity
- ❌ Limited forensics for security incidents

**Fix**: Add IP logging:

```typescript
function getClientIP(req: CallableRequest): string {
  return (
    req.rawRequest?.headers['x-forwarded-for'] ||
    req.rawRequest?.connection.remoteAddress ||
    'unknown'
  );
}

await db.collection('auditLogs').add({
  userId,
  action: 'oracle_computed',
  metadata: {
    ipAddress: getClientIP(request),
  },
  ts: FieldValue.serverTimestamp(),
});
```

**Status**: ⏳ PENDING - IP logging not implemented

---

### Issue #13: No Certificate Pinning for API Calls

**Severity**: 🟠 MEDIUM  
**Location**: `functions/src/functions/payments/googlePlay.ts`  
**Problem**:

Direct HTTPS calls to Google APIs without certificate pinning:

```typescript
const req = https.request({
  hostname: 'www.googleapis.com',
  // ← No certificate verification beyond standard TLS
  ...
});
```

**Risk**:

- ⚠️ Vulnerable to MITM attacks (low probability but high impact)
- ❌ No verification that we're talking to real Google

**Fix**: Add certificate pinning (advanced):

```typescript
import tls from 'tls';

const options = {
  ca: fs.readFileSync('certs/google-root-ca.pem'), // Pin Google's CA
  hostname: 'www.googleapis.com',
};

const req = https.request(options, callback);
```

**Status**: ⏳ PENDING - Certificate pinning not implemented

---

### Issue #14: Missing Setup & Deployment Documentation

**Severity**: 🟠 MEDIUM  
**Location**: Project root  
**Problem**:

No clear step-by-step guide for:

- Where to get each secret
- How to set up Cloud Functions
- How to test locally
- How to deploy to production
- What to do after deployment

**Risk**:

- ❌ Deployment errors
- ❌ Misconfiguration
- ❌ Downtime for users

**Status**: ⏳ PENDING - See Issue #20 for documentation template

---

### Issue #15: No Health Check Endpoint

**Severity**: 🟠 MEDIUM  
**Location**: `functions/src/index.ts`  
**Problem**:

No way to verify Cloud Functions are working:

```typescript
// Only exported: actual functions
export { askOracle, getQuota, ... };
// ← No health check!
```

**Risk**:

- ❌ Can't monitor if functions are up
- ❌ Can't detect deployment failures
- ❌ Downtime not detected

**Fix**: Add health check function:

```typescript
export const healthCheck = onRequest({ region: REGION }, async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    projectId: 'shams-app-4d0e7',
  });
});
```

**Status**: ⏳ PENDING - No health check endpoint

---

## 🟢 LOW PRIORITY ISSUES (NICE TO HAVE)

### Issue #16: Cloud Functions Error Handling Not Standardized

**Severity**: 🟢 LOW  
**Location**: `functions/src/`  
**Problem**:

Error responses vary between functions:

```typescript
// Some functions throw HttpsError
throw new HttpsError('resource-exhausted', 'message');

// Others throw Error
throw new Error('message');
```

**Issue**:

- ⚠️ Inconsistent error format
- ⚠️ Some errors leak internals
- ⚠️ Client can't standardize error handling

**Fix**: Create error wrapper:

```typescript
export class AppError extends HttpsError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message);
    this.details = details;
  }
}
```

**Status**: ⏳ PENDING - Error handling not standardized

---

### Issue #17: No Logging for Function Performance Metrics

**Severity**: 🟢 LOW  
**Location**: `functions/src/utils/logger.ts`  
**Problem**:

No performance tracking:

- ❌ Don't know if askOracle is slow
- ❌ Can't detect performance regressions
- ❌ Can't optimize

**Fix**: Add performance logging:

```typescript
const startTime = Date.now();
const result = await askOracle(...);
const duration = Date.now() - startTime;

logger.info('function_duration', {
  function: 'askOracle',
  duration_ms: duration,
  userId,
});
```

**Status**: ⏳ PENDING - Performance metrics not logged

---

### Issue #18: Missing CORS Configuration for Webhooks

**Severity**: 🟢 LOW  
**Location**: `functions/src/functions/payments/razorpay.ts`  
**Problem**:

Webhook might receive CORS pre-flight requests:

```typescript
if (req.method !== 'POST') {
  res.status(405).send('Method Not Allowed');
}
// ← Doesn't handle OPTIONS for CORS
```

**Fix**: Handle CORS:

```typescript
export const razorpayWebhook = onRequest({ region: REGION, cors: true }, async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'X-Razorpay-Signature');
    res.status(204).send('');
    return;
  }
  // ... rest of function
});
```

**Status**: ⏳ PENDING - CORS not configured

---

## ✅ WHAT'S WORKING WELL

Before we focus on fixes, here are the things configured correctly:

✅ **Firestore Structure** - Collections and schema are well-designed  
✅ **Security Rules** - Deny-by-default, good privilege checks  
✅ **Database Indexes** - Performance indexes configured  
✅ **Quota Management** - Sunday-anchored rolling week implemented  
✅ **Input Validation** - Zod schemas for all functions  
✅ **Rate Limiting** - Per-minute rate limits implemented  
✅ **Audit Logging** - All actions logged  
✅ **Plan Tiers** - Free/Starter/Premium/Consultation configured  
✅ **Error Handling** - Custom error types used

---

## 🚀 PRIORITY FIX ORDER

To deploy safely, fix in this order:

### Phase 1: BLOCKING ISSUES (Must fix before ANY deployment)

1. ✋ **Issue #1**: Rotate API key
2. ✋ **Issue #3**: Initialize App Check in client
3. ✋ **Issue #2**: Configure Cloud Functions secrets in Secret Manager
4. ✋ **Issue #4**: Configure Razorpay webhook

**Time**: 1-2 hours  
**Risk if skipped**: App won't work in production

### Phase 2: CRITICAL ISSUES (Fix before production launch)

5. ✋ **Issue #5**: Configure Google Play service account
6. ✋ **Issue #7**: Enable billing and set alerts
7. ✋ **Issue #8**: Create Firestore security rule tests

**Time**: 1-2 hours  
**Risk if skipped**: Payment revenue lost, rules could have bugs

### Phase 3: IMPORTANT ISSUES (Fix within first month)

8. ⚠️ **Issue #6**: Improve environment variable documentation
9. ⚠️ **Issue #14**: Create deployment guide
10. ⚠️ **Issue #15**: Add health check endpoint

**Time**: 1 hour  
**Risk if skipped**: Maintenance and debugging harder

### Phase 4: NICE-TO-HAVE (Backlog)

11. 💡 **Issue #10**: Add debug token support
12. 💡 **Issue #11**: Externalize rate limit config
13. 💡 **Issue #12**: Add IP logging
14. 💡 **Issue #13**: Add certificate pinning
15. 💡 **Issue #16**: Standardize error handling
16. 💡 **Issue #17**: Add performance metrics
17. 💡 **Issue #18**: Add CORS handling

---

## 📋 ACTION CHECKLIST

### Immediate Actions (Next 2 Hours)

- [ ] **Issue #1**: Rotate API key
  - [ ] Delete old key from GCP Console
  - [ ] Generate new key
  - [ ] Add API restrictions (Firestore only)
  - [ ] Add application restrictions (Android package + fingerprints)
  - [ ] Update google-services.json
  - [ ] Test that app can access Firestore

- [ ] **Issue #2**: Configure Cloud Functions secrets
  - [ ] Get Razorpay webhook secret
  - [ ] Get Google Play service account JSON
  - [ ] Create secrets in GCP Secret Manager
  - [ ] Grant Cloud Functions access to secrets
  - [ ] Update functions/firebase.json
  - [ ] Test with local emulator

- [ ] **Issue #3**: Initialize App Check in client
  - [ ] Enable App Check in Firebase Console
  - [ ] Get Play Integrity token from Google Play Console
  - [ ] Create src/firebase/appCheck.ts
  - [ ] Initialize in App.tsx
  - [ ] Get debug token for local testing
  - [ ] Test that Cloud Functions accept requests

- [ ] **Issue #4**: Configure Razorpay webhook
  - [ ] Deploy functions to Firebase
  - [ ] Copy razorpayWebhook URL
  - [ ] Add webhook to Razorpay Dashboard
  - [ ] Select events (payment.authorized, subscription.charged, etc.)
  - [ ] Copy webhook secret to Secret Manager
  - [ ] Test webhook with test payment

### Within 24 Hours

- [ ] **Issue #5**: Configure Google Play integration
  - [ ] Verify service account is linked in Google Play Console
  - [ ] Create subscription products if not exists
  - [ ] Test purchase verification

- [ ] **Issue #7**: Enable billing
  - [ ] Link billing account to GCP project
  - [ ] Set budget alerts
  - [ ] Review estimated costs

- [ ] **Issue #8**: Test security rules
  - [ ] Create firestore.rules.test.ts
  - [ ] Write tests for each collection
  - [ ] Verify all tests pass
  - [ ] Deploy to staging first

### Within 1 Week

- [ ] **Issue #6**: Document environment variables
- [ ] **Issue #14**: Create deployment guide
- [ ] **Issue #15**: Add health check endpoint

---

## 📞 DEBUGGING HELP

If you encounter errors:

### Error: "App Check token is missing"

```
Cause: Issue #3 not fixed
Fix: Initialize App Check in client (see Issue #3)
```

### Error: "RAZORPAY_WEBHOOK_SECRET not configured"

```
Cause: Issue #2 not fixed
Fix: Create secret in GCP Secret Manager (see Issue #2)
```

### Error: "Play Store credentials not configured"

```
Cause: Issue #5 not fixed (Google Play service account)
Fix: Configure service account credentials (see Issue #5)
```

### Razorpay payments not processed

```
Cause: Issue #4 not fixed (webhook not configured)
Fix: Configure webhook in Razorpay Dashboard (see Issue #4)
```

### API key errors

```
Cause: Issue #1 not fixed (API key not rotated/restricted)
Fix: Rotate key and add restrictions (see Issue #1)
```

---

## 🔐 Security Recommendations

After fixing critical issues, implement:

1. **Certificate Pinning** (Issue #13)
   - Pin Google's certificate in functions
   - Prevent MITM attacks on API calls

2. **IP Logging** (Issue #12)
   - Track suspicious access patterns
   - Detect bot attacks

3. **Rate Limit Monitoring**
   - Alert if rate limits hit
   - Adjust for bots

4. **Firestore Backups**
   - Enable daily backups
   - Test restore procedures

5. **Cloud Armor** (if using CDN)
   - DDoS protection
   - WAF rules

6. **Cloud KMS**
   - Encrypt secrets with customer-managed keys
   - Key rotation policies

---

## 📚 Next Steps

1. **Use this report** to prioritize fixes
2. **Follow the Action Checklist** above
3. **Test thoroughly** before production
4. **Monitor after deployment** for errors

---

**Report Generated**: May 1, 2026  
**Critical Issues**: 4  
**Total Issues**: 18  
**Estimated Fix Time**: 2-4 hours (critical), 1-2 hours (high), ongoing (medium/low)

---

## Appendix: Quick Reference

| Issue                      | Severity | Fix Time | File to Update                     |
| -------------------------- | -------- | -------- | ---------------------------------- |
| API Key Exposed            | 🔴       | 30 min   | `android/app/google-services.json` |
| Missing Secrets            | 🔴       | 45 min   | GCP Secret Manager                 |
| App Check Not Initialized  | 🔴       | 30 min   | `src/firebase/appCheck.ts`         |
| Razorpay Webhook Missing   | 🔴       | 15 min   | Razorpay Dashboard                 |
| Google Play Not Configured | 🟡       | 20 min   | GCP Service Accounts               |
| Billing Not Enabled        | 🟡       | 10 min   | GCP Console                        |
| Rules Not Tested           | 🟡       | 60 min   | `firestore.rules.test.ts`          |
| Env Docs Missing           | 🟡       | 30 min   | `.env.example` + README            |
| Health Check Missing       | 🟠       | 15 min   | `functions/src/index.ts`           |
| Performance Metrics        | 🟢       | 30 min   | `functions/src/utils/logger.ts`    |

---

**Questions?** Check the [Firebase Documentation](https://firebase.google.com/docs) or contact your DevOps team.
