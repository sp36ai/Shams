# Manual Actions Required — Shams al-Asrar

These items CANNOT be fixed with code. Each must be done in the respective console/dashboard.
Revisit this file before every production release.

---

## 1. Google Cloud Console — Restrict Firebase API Key

**Key:** `AIzaSyB-c1iC5716lyvonB8N6wGyI4SRgaPCH5U`

**Steps:**
1. Go to https://console.cloud.google.com → APIs & Services → Credentials
2. Click the key → Application restrictions → Android apps
3. Add package `com.astrosarfaraz.shamsalasrar` + SHA-1 fingerprint of upload key
4. API restrictions → Restrict to: Firebase APIs only (Firebase Auth, Firestore, Cloud Storage)
5. Save

**Why:** Without restriction, anyone can use this key against your Firebase project quota.

---

## 2. Firebase Console — Enable App Check (Play Integrity)

**Steps:**
1. Go to Firebase Console → App Check
2. Register the Android app with Play Integrity provider
3. Enable enforcement for: Authentication, Firestore, Cloud Functions
4. Test with a real device before enforcing (debug token for dev)

**Why:** Without this, any app (not just yours) can call your Cloud Functions.

---

## 3. Firebase Console — Provision ANTHROPIC_API_KEY Secret

**Steps:**
1. Go to Google Cloud Console → Secret Manager → Create secret
2. Name: `ANTHROPIC_API_KEY`, Value: (your Anthropic key)
3. Grant `roles/secretmanager.secretAccessor` to the Functions service account
4. Redeploy functions: `firebase deploy --only functions`

**Why:** The Cloud Functions (`askOracle`, `classifyQuestion`, etc.) need this secret at runtime.

---

## 4. Google Play Console — Service Account for CI/CD

**Steps:**
1. Create a service account in Google Play Console → Setup → API access
2. Grant it "Release Manager" permissions
3. Export JSON key → store as GitHub Secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

**Why:** `release-play-store.yml` CI workflow deploys to Play Store using this account.

---

## 5. Razorpay Dashboard — Register Webhook URL

**Steps:**
1. Log in to Razorpay Dashboard → Settings → Webhooks
2. Add endpoint: `https://asia-south1-shams-app-4d0e7.cloudfunctions.net/razorpayWebhook`
3. Select events: `payment.captured`, `subscription.activated`, `subscription.charged`
4. Copy the webhook secret → store as GitHub Secret `RAZORPAY_WEBHOOK_SECRET`
   and Firebase Secret `RAZORPAY_WEBHOOK_SECRET`

**Why:** Payment upgrades won't work without this.

---

## 6. Certificate Pins — Capture + Add Backup Pin

**Steps:**
1. Capture the current Google API backup pin:
   ```
   openssl s_client -connect firestore.googleapis.com:443 2>/dev/null \
     | openssl x509 -pubkey -noout \
     | openssl pkey -pubin -outform der \
     | openssl dgst -sha256 -binary | base64
   ```
2. Add second pin to `android/app/src/main/res/xml/network_security_config.xml`
3. Set a calendar reminder 90 days before `expiration="2027-05-01"`

**Why:** Without a backup pin, any Google TLS certificate rotation bricks the app.

---

## 7. GitHub Secrets — Verify All Are Set

Required secrets for CI/CD:
- [ ] `GOOGLE_SERVICES_JSON` — base64-encoded google-services.json ✅ (already done)
- [ ] `SHAMS_UPLOAD_KEYSTORE` — base64-encoded upload keystore (.jks)
- [ ] `SHAMS_UPLOAD_STORE_PASSWORD`
- [ ] `SHAMS_UPLOAD_KEY_ALIAS`
- [ ] `SHAMS_UPLOAD_KEY_PASSWORD`
- [ ] `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- [ ] `RAZORPAY_WEBHOOK_SECRET`
- [ ] `ANTHROPIC_API_KEY` (for E2E tests in ci.yml)

---

*Last updated: 2026-06-27*
