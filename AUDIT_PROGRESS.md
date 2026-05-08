# Shams-Al-Asrār — Master Production Audit Progress

## Status
LAST_COMPLETED: CP-00
NEXT: CP-01

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
