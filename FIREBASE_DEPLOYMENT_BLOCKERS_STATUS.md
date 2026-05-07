# Firebase Deployment Blockers Status (May 3, 2026)

This status reflects the current repo after applying code/config fixes on **May 3, 2026**.

## Critical

- `API key exposed in android/app/google-services.json` -> **manual action still required**
  - Rotate the key in Google Cloud Console.
  - Restrict it to Android app + required Firebase APIs only.
  - Download a fresh `google-services.json` after rotation.

- `Cloud Functions secrets missing` -> **repo-side fix added; secret creation still required**
  - Code now binds secrets via Firebase v2 `defineSecret` and function-level `secrets`.
  - Helper script added:
    - [Setup-FirebaseSecrets.ps1](C:/Users/Sarfaraz/Desktop/shams-al-asrar/scripts/Setup-FirebaseSecrets.ps1)
  - Required secrets:
    - `RAZORPAY_WEBHOOK_SECRET`
    - `GOOGLE_PLAY_CLIENT_EMAIL`
    - `GOOGLE_PLAY_PRIVATE_KEY`

- `App Check not initialized` -> **fixed in app code**
  - App Check is initialized in `src/App.tsx`.
  - Debug token is no longer hardcoded; optional env support added:
    - `FIREBASE_APP_CHECK_DEBUG_TOKEN_ANDROID`

- `Razorpay webhook not configured in dashboard` -> **repo-side fix added; dashboard registration still required**
  - Helper script added:
    - [Get-RazorpayWebhookConfig.ps1](C:/Users/Sarfaraz/Desktop/shams-al-asrar/scripts/Get-RazorpayWebhookConfig.ps1)
  - Deploy functions, then register webhook URL in Razorpay Dashboard:
    - `https://asia-south1-shams-app-4d0e7.cloudfunctions.net/razorpayWebhook`

## High Priority

- `Google Play service account not configured` -> **manual action required**
  - Create service account key and set the two secrets above.

- `Firebase billing not verified` -> **manual action required**
  - Confirm Blaze plan and budget alerts in Firebase/GCP billing console.

- `Firestore security rules not tested` -> **partially improved**
  - Local API test script now includes a health endpoint smoke check.
  - Full Firestore rules emulator tests should still be added before production launch.

- `Environment variable documentation incomplete` -> **improved**
  - Updated:
    - `functions/.env.example`
    - `.env.example`

## Medium Priority

- `No debug token support for local testing` -> **fixed**
  - Added env-driven App Check debug token support.

- `Rate limiting hardcoded` -> **fixed**
  - Added configurable `RATE_LIMIT_PER_MINUTE` parameter.

- `IP address not logged in audit trails` -> **fixed (privacy-safe)**
  - Added hashed IP (`ipHash`) + `userAgent` + request `source` metadata in key audit logs.

- `No health check endpoint` -> **fixed**
  - Added HTTP function: `health`.

- `No certificate pinning for API calls` -> **still pending**
  - Existing pinning config in `src/utils/certificatePinning.ts` still contains placeholder fingerprints.
  - Add production SPKI pins before enabling strict pin enforcement.

## Low Priority

- `No performance metrics logging` -> **partially improved**
  - Added `durationMs` to key success/failure logs for callable/payment paths.

- `Missing CORS configuration` -> **improved**
  - Explicit CORS options added to HTTP functions:
    - `health` (`cors: true`)
    - `razorpayWebhook` (`cors: false`)

- `Inconsistent error handling` -> **still pending**
  - There is still no shared cross-function error wrapper yet.

## New Verification Commands

```powershell
# 1) Set required Firebase secrets
powershell -File scripts/Setup-FirebaseSecrets.ps1

# 2) Run strict Firebase predeploy validation
powershell -File scripts/Validate-FirebasePredeploy.ps1

# 3) Build functions (type + compile)
npm --prefix functions run build

# 4) Deploy functions and rules
firebase deploy --only functions,firestore:rules

# 5) Print Razorpay webhook URL + registration instructions
powershell -File scripts/Get-RazorpayWebhookConfig.ps1

# 6) Run local API smoke tests (now includes /health)
powershell -File scripts/test-local-apis-curl.ps1
```
