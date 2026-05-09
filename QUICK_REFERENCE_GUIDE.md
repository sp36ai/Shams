# Shams al-Asrār — Quick Reference Guide

**Configuration Summary | April 29, 2026**

---

## At a Glance

| Category             | Value                            |
| -------------------- | -------------------------------- |
| **App Name**         | Shams al-Asrār                   |
| **Platform**         | React Native (Android-only)      |
| **Firebase Project** | `shams-al-asrar-ca95d`           |
| **Firebase Region**  | `asia-south1` (Mumbai)           |
| **React Native**     | 0.74.5                           |
| **React**            | 18.2.0                           |
| **TypeScript**       | 5.0.4                            |
| **Hermes**           | Enabled                          |
| **Min SDK**          | 24 (Android 7.0)                 |
| **Target SDK**       | 34 (Android 14)                  |
| **App ID**           | `com.astrosarfaraz.shamsalasrar` |

---

## Critical Configuration Values

### Firebase Cloud Functions

```
Region:         asia-south1 (Mumbai)
Memory:         512 MB
Timeout:        30 seconds
Build Command:  npm --prefix "$RESOURCE_DIR" run build
```

### Rate Limiting

```
Maximum Requests/Minute:  60 (per user)
Enforcement:              Cloud Functions
Storage:                  /rateLimits/{userId}/{minuteKey} (TTL)
```

### Quota System (Free Tier)

```
Limit:        3 questions per rolling week
Reset Day:    Sunday (UTC 00:00)
Model:        Sunday-anchored ISO weeks
Enforcement:  Client + Server (Cloud Functions)
```

### Premium Plan Tiers

| Tier         | Duration | Limit     | Google Play ID               |
| ------------ | -------- | --------- | ---------------------------- |
| Free         | N/A      | 3/week    | N/A                          |
| Starter      | 7 days   | Unlimited | `shams_starter_weekly`       |
| Premium      | 31 days  | Unlimited | `shams_premium_monthly`      |
| Consultation | 31 days  | Unlimited | `shams_consultation_monthly` |

### Firestore Indexes

```
Readings:     userId + createdAt (DESC)
              userId + verdict + createdAt (DESC)
              userId + category + createdAt (DESC)

Audit Logs:   userId + ts (DESC)
              action + ts (DESC)

TTL Field:    rateLimits[].expiresAt (60 seconds)
```

### Metro Bundler (Release Mode)

```
Minifier:           Terser (metro-minify-terser)
Mangle Identifiers: true (top-level)
Drop Console:       true
Dead Code:          true
Compression Passes: 3
Source Maps:        false
Output Format:      ascii_only
```

### Build Outputs

```
Debug APK:      ~25 MB
Release APK:    ~8-10 MB (minified + ProGuard)
Release Bundle: ~7 MB (compressed AAB for Play Store)
Locales:        en, ur, hi (reduces size)
```

### Supported File Types

**Source Code:**

- TypeScript: `.ts`, `.tsx`
- JavaScript: `.js`, `.jsx`, `.cjs`, `.mjs`
- JSON: `.json`

**Assets:**

- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`
- Fonts: `.ttf`, `.otf`, `.woff`, `.woff2`
- Audio: `.mp3`, `.wav`
- Binary: `.se1`, `.wasm`

### Firebase Emulator Ports (Local Development)

```
Auth:       localhost:9099
Firestore:  localhost:8080
Functions:  localhost:5001
Pub/Sub:    localhost:8085
Storage:    localhost:9199
UI:         localhost:4000
```

---

## Firestore Collections Quick Ref

```
/users/{userId}
├─ displayName (string)
├─ preferences (object)
└─ createdAt (timestamp)

/quotas/{userId}
├─ weekKey (string, Sunday ISO date)
├─ used (number)
├─ limit (number)
├─ planTier (string)
├─ planExpiry (timestamp | null)
└─ lastUpdated (timestamp)

/readings/{readingId}
├─ userId (string) [INDEXED]
├─ question (string)
├─ parameters (object)
├─ verdict (object)
├─ category (string) [INDEXED]
├─ createdAt (timestamp) [INDEXED DESC]
└─ longevity (number)

/auditLogs/{logId}
├─ userId (string) [INDEXED]
├─ action (string) [INDEXED]
├─ ts (timestamp) [INDEXED DESC]
├─ metadata (object)
├─ ipAddress (string)
└─ resolved (boolean)

/securityEvents/{eventId}
├─ type (string)
├─ userId (string)
├─ ts (timestamp)
├─ severity (string)
├─ details (object)
└─ resolved (boolean)

/rateLimits/{userId}/{minuteKey}
├─ count (number)
└─ expiresAt (timestamp) [TTL]
```

---

## Environment & Dependencies

### Required Node Version

```
Node.js >= 18
```

### NPM Scripts Quick Reference

| Command                         | Purpose                            |
| ------------------------------- | ---------------------------------- |
| `npm start`                     | Start Metro bundler                |
| `npm run build:android:debug`   | Build debug APK                    |
| `npm run build:android:release` | Build release APK                  |
| `npm run bundle:android`        | Generate app bundle for Play Store |
| `npm test`                      | Run Jest tests                     |
| `npm run test:coverage`         | Generate code coverage report      |
| `npm run lint`                  | Check code style (0 warnings)      |
| `npm run lint:fix`              | Auto-fix code style                |
| `npm run typecheck`             | TypeScript type checking           |
| `npm run format`                | Format with Prettier               |

### Path Aliases (Babel module-resolver)

```
@/              → ./src
@components/    → ./src/components
@screens/       → ./src/screens
@navigation/    → ./src/navigation
@stores/        → ./src/stores
@theme/         → ./src/theme
@i18n/          → ./src/i18n
@astrology/     → ./src/astrology
@storage/       → ./src/storage
@utils/         → ./src/utils
@assets/        → ./assets
```

### Key Dependencies

**Firebase:**

- `@react-native-firebase/app` v21.0.0
- `@react-native-firebase/auth` v21.0.0
- `@react-native-firebase/app-check` v21.14.0
- `@react-native-google-signin/google-signin` v16.1.2

**Navigation:**

- `@react-navigation/native` v6.1.18
- `@react-navigation/native-stack` v6.11.0
- `@react-navigation/bottom-tabs` v6.6.1

**Storage & State:**

- `react-native-mmkv` v2.12.2 (encrypted local storage)
- `zustand` v4.5.5 (state management)

**UI & Animation:**

- `react-native-reanimated` v3.10.1
- `react-native-gesture-handler` v2.16.2
- `react-native-svg` v15.3.0

---

## Firebase Security Model

### Authentication Flow

1. User opens app (SplashScreen)
2. Firebase app initialized
3. App Check token generated (device attestation)
4. User logs in via:
   - Google Sign-In (preferred)
   - Anonymous login (fallback)
5. Exchange Supabase token → Firebase custom token
6. Access Firestore with token + App Check validation

### Access Control Levels

| Level         | Who                 | Access                                    |
| ------------- | ------------------- | ----------------------------------------- |
| **Owner**     | User (UID matches)  | Read own docs, limited create/update      |
| **Admin**     | Backend (Admin SDK) | Full read/write to all collections        |
| **Anonymous** | Not authenticated   | Firestore access via Cloud Functions only |
| **Untrusted** | Rogue client        | Denied by-default                         |

### Protected Operations (Admin SDK Only)

- Increment `/quotas/{userId}.used`
- Write to `/rateLimits/{userId}/**`
- Create/update `/readings/{readingId}`
- Write audit logs
- Update plan expiry

---

## Deployment Checklist

- [ ] Firebase project `shams-al-asrar-ca95d` accessible
- [ ] Cloud Functions deployed to `asia-south1`
- [ ] Firestore rules & indexes deployed
- [ ] Cloud Secrets configured (Razorpay, Google Play credentials)
- [ ] Release signing keys in `~/.gradle/gradle.properties`
- [ ] Firebase App Check configured
- [ ] Google Sign-In credentials in `google-services.json`
- [ ] Cloud Functions predeploy: `npm run build` works
- [ ] All tests passing: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] Bundle size < 100 MB

---

## Troubleshooting Quick Links

| Issue                      | Solution                                      |
| -------------------------- | --------------------------------------------- |
| Metro won't start          | `npm start --reset-cache`                     |
| Build fails                | `npm run clean:android` then rebuild          |
| Firebase connection fails  | Check emulator ports (firebase-emulator.json) |
| Tests fail with MMKV mock  | Check `__mocks__/react-native-mmkv.js`        |
| TypeScript errors          | `npm run typecheck` for full report           |
| Bundle too large           | Check Metro minification in release build     |
| Quota not incrementing     | Verify Cloud Function deployment + network    |
| Rate limit false positives | Check `rateLimits` TTL cleanup                |

---

## Key Contacts & Resources

- **Firebase Console:** https://console.firebase.google.com/project/shams-al-asrar-ca95d
- **Google Play Console:** https://play.google.com/console
- **Firestore Documentation:** https://firebase.google.com/docs/firestore
- **React Native Docs:** https://reactnative.dev/docs/environment-setup
- **Metro Docs:** https://facebook.github.io/metro/

---

## Performance Targets

| Metric                      | Target        | Current      |
| --------------------------- | ------------- | ------------ |
| **Cold Start Time**         | < 3 seconds   | TBD          |
| **Question Response Time**  | < 5 seconds   | TBD          |
| **APK Size**                | < 15 MB       | ~8-10 MB ✓   |
| **Bundle Size**             | < 20 MB       | ~7 MB ✓      |
| **Firestore Query Latency** | < 500 ms      | TBD          |
| **Function Execution Time** | < 30s timeout | Configured ✓ |
| **Rate Limit Enforcement**  | < 100 ms      | TBD          |

---

**Document Version:** 1.0  
**Last Updated:** April 29, 2026  
**Maintained By:** Development Team  
**Next Review:** After first production release
