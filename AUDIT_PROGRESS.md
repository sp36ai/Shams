# Shams-Al-Asrār — Master Production Audit Progress

## Status
LAST_COMPLETED: CP-01
NEXT: CP-02

## CP-00 — Permissions Audit (COMPLETE)

### PERMISSIONS_DECLARED (final)
- android.permission.INTERNET
- android.permission.ACCESS_FINE_LOCATION
- android.permission.ACCESS_COARSE_LOCATION
- com.android.vending.BILLING
- android.permission.POST_NOTIFICATIONS
- android.permission.ACCESS_NETWORK_STATE

### PERMISSIONS_REMOVED
- android.permission.READ_MEDIA_IMAGES — orphaned (wallpaper feature removed)
- android.permission.SET_WALLPAPER — orphaned (wallpaper feature removed)

### PERMISSIONS_ADDED
- None

### GPS_DEGRADATION: VERIFIED
- `runEngine()` in OracleScreen returns verdict=UNCLEAR + locationRequiredText message when lat/lon is null.
- No crash. No silent fail. No engine call attempted without coordinates.
- Watch engine computation is server-side; client types-only (src/engine/watchEngine.ts).

### NOTIFICATIONS: NOT_PRESENT
- @react-native-firebase/messaging not in package.json.
- POST_NOTIFICATIONS declared for Phase 5 (forward-declared, no runtime request yet — correct, FCM not wired).

### RUNTIME_PERMISSION_PATTERN: VERIFIED
- PermissionsAndroid.requestMultiple([FINE, COARSE]) in src/utils/permissions.ts
- Requested in LocationPermissionScreen (onboarding), not on cold launch.
- Skip path: markLocationPrompted() without capturing coords — RootNavigator advances cleanly.
- NEVER/BLOCKED path: redirects to Settings via Linking.openSettings().

### RATIONALE: VERIFIED
- Rationale displayed in LocationPermissionScreen UI before OS dialog is triggered.
- Text: "RKP horary depends on the exact moment and place of the question. Without location,
  the house cusps cannot be set correctly and the judgment cannot be trusted."
- Specific, Play Store compliant.

### GOOGLE_SERVICES_JSON: VERIFIED
- package_name: com.astrosarfaraz.shamsalasrar (release) + .debug variant
- project_id: shams-app-4d0e7
- Valid JSON, no duplicate entries.

### NOTES
- RECEIVE_BOOT_COMPLETED: not added (no background services in this app).
- VIBRATE / WAKE_LOCK: not added (FCM not wired).
- allowBackup="false" confirmed in manifest.
- android:usesCleartextTraffic="false" confirmed.

---

## CP-01 — Project Structure Verification (COMPLETE)

### PACKAGE_JSON
- react-native 0.74.5 ✅
- @react-navigation/native + native-stack + bottom-tabs ✅
- @react-native-firebase/app + auth + functions + app-check ✅
- zustand + react-native-mmkv ✅
- @react-native-firebase/firestore: ABSENT — src/ has zero Firestore imports.
  App is local-first (MMKV). Cloud functions have own package.json.
  FLAG: If server-side reading sync is added, install in app package.json.
- zod: ABSENT from app package.json — zero usage in src/.
  Used only in functions/ (own deps). Not a blocker.

### BUILD_GRADLE
- applicationId: com.astrosarfaraz.shamsalasrar ✅
- minSdkVersion: 24 ✅
- targetSdkVersion: 34 ✅
- versionCode: 1 ✅
- versionName: "0.1.0" ✅
- signingConfig release block: present (SHAMS_UPLOAD_STORE_FILE from ~/.gradle/gradle.properties) ✅

### GOOGLE_SERVICES_JSON: VERIFIED (see CP-00)

### ENV_FILES
- No .env or .env.production found in project root.
- FLAG (HUMAN): Create .env.production with FIREBASE_APP_CHECK_DEBUG_TOKEN_ANDROID.

### API_KEYS_IN_SOURCE
- Zero matches for "AIzaSy" in src/ — CLEAN ✅

### NAVIGATION
- Audit spec says 5 tabs (Home, Oracle, SkyClock, History, Profile).
- Current: 3 tabs (Oracle, History, Settings). SkyState is a root stack screen.
- This was an intentional design change accepted in a prior session. NOT reverting.

### FLAGS_FOR_HUMAN
1. @react-native-firebase/firestore not in package.json — add if client Firestore access is needed
2. No .env.production — create with FIREBASE_APP_CHECK_DEBUG_TOKEN_ANDROID
