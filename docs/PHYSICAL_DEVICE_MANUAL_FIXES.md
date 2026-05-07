# Physical Device Manual Fixes (Release Critical)

These items cannot be fully completed by source-code edits and must be done on real devices / cloud consoles before production rollout.

## 1) App Check and Play Integrity

1. In Firebase Console, keep Android App Check provider as `Play Integrity` for production.
2. For every QA physical device using debug builds, register the emitted App Check debug token in Firebase Console.
3. Verify callable functions reject invalid App Check tokens on a physical device network (mobile data and Wi-Fi).

## 2) Certificate Pinning Activation

1. Extract real SHA-256 SPKI pins for `asia-south1-shams-app-4d0e7.cloudfunctions.net` (primary + backup).
2. Replace placeholders in [`src/utils/certificatePinning.ts`](/c:/Users/Sarfaraz/Desktop/shams-al-asrar/src/utils/certificatePinning.ts).
3. Set:
   - `enabled: true`
   - `failOnPinMismatch: true`
4. Run physical-device validation against:
   - normal network
   - hostile proxy/MITM setup (must fail closed)

## 3) Release Signing

1. Generate/import production upload keystore (never debug keystore).
2. Add release signing secrets to `~/.gradle/gradle.properties` on release build machine:
   - `SHAMS_UPLOAD_STORE_FILE`
   - `SHAMS_UPLOAD_STORE_PASSWORD`
   - `SHAMS_UPLOAD_KEY_ALIAS`
   - `SHAMS_UPLOAD_KEY_PASSWORD`
3. Build and verify signed `release` artifact installs and launches on physical ARM64 device.

## 4) Google Sign-In and Billing Real-Device Validation

1. Validate Google Sign-In end-to-end with production SHA-1/SHA-256 fingerprints registered in Firebase/Google Cloud.
2. Validate Play Billing flow on internal testing track (purchase, restore, cancel, grace period behavior).

## 5) Final Device Smoke Pass

1. Validate startup on Android 13/14 physical devices.
2. Validate location permissions and push notification permission flows.
3. Validate offline/online transitions and callable function retries.
4. Collect release `logcat` and confirm no sensitive payloads (tokens, user questions, coordinates) are printed.
