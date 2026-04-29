# Shams al-Asrār — Settings & Configuration Report
**Generated: April 29, 2026**

---

## Table of Contents
1. [Firebase Configuration](#firebase-configuration)
2. [Metro Configuration](#metro-configuration)
3. [JavaScript Bundle Settings](#javascript-bundle-settings)
4. [Build Configuration](#build-configuration)
5. [Firebase Emulator Settings](#firebase-emulator-settings)
6. [Summary & Recommendations](#summary--recommendations)

---

## Firebase Configuration

### Project Details
- **Project ID:** `shams-al-asrar-ca95d`
- **Region:** `asia-south1` (Mumbai — closest to primary user base)

### Cloud Functions Configuration
```json
{
  "source": "functions",
  "codebase": "default",
  "region": "asia-south1",
  "timeoutSeconds": 30,
  "memory": "512MiB",
  "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
}
```

**Ignored Files During Deploy:**
- node_modules
- .git
- firebase-debug.log
- firebase-debug.*.log
- scripts

### Firestore Configuration
- **Rules File:** `firestore.rules`
- **Indexes File:** `firestore.indexes.json`

#### Security Model
- **Auth Provider:** Supabase Auth (primary); Firebase Auth for App Check only
- **Access Control:** Deny-by-default with explicit allowlists
- **Privileged Operations:** Cloud Functions only (Admin SDK bypasses rules)

#### Firestore Collections

| Collection | Purpose | Access Rules |
|-----------|---------|--------------|
| `/users/{userId}` | User profile & preferences | Owner/Admin read; Qualified create/update; No privileged fields allowed |
| `/quotas/{userId}` | Question quota state | Owner/Admin read; Cloud Functions write only |
| `/readings/{readingId}` | Oracle readings (horary judgments) | Owner read/delete; Cloud Functions create/update only |
| `/rateLimits/{userId}/**` | Rate limiting state | Cloud Functions only (no client access) |
| `/auditLogs/{logId}` | Security audit trail | Admin read; Cloud Functions write only |
| `/securityEvents/{eventId}` | Security incident tracking | Admin only |

#### Firestore Indexes

**Index 1: readings by userId & createdAt**
```
userId (ASCENDING) → createdAt (DESCENDING)
```

**Index 2: readings by userId, verdict & createdAt**
```
userId (ASCENDING) → verdict (ASCENDING) → createdAt (DESCENDING)
```

**Index 3: readings by userId, category & createdAt**
```
userId (ASCENDING) → category (ASCENDING) → createdAt (DESCENDING)
```

**Index 4: auditLogs by userId & timestamp**
```
userId (ASCENDING) → ts (DESCENDING)
```

**Index 5: auditLogs by action & timestamp**
```
action (ASCENDING) → ts (DESCENDING)
```

**TTL Field:** `rateLimits.expiresAt` (auto-delete after expiry)

### Plan Tiers & Quotas

| Tier | Duration | Quota | Type |
|------|----------|-------|------|
| `free` | Never expires | 3 questions/week (Sunday-anchored) | Client-side throttling |
| `starter` | 7 days | Unlimited | Google Play: `shams_starter_weekly` |
| `premium` | 31 days | Unlimited | Google Play: `shams_premium_monthly` |
| `consultation` | 31 days | Unlimited | Google Play: `shams_consultation_monthly` |

### Quota System Details
- **Model:** Sunday-anchored rolling week (ISO UTC dates)
- **Reset:** Every Sunday (UTC)
- **Free Tier Limit:** 3 questions per rolling week
- **Synchronized:** Matches `quotaStore.ts` on client and `config.ts` in functions

### Google Play Integration
- **Product Mapping:** Configured in Cloud Functions (`PLAY_PRODUCT_MAP`)
- **Secrets Managed By:**
  - `RAZORPAY_WEBHOOK_SECRET_KEY` (for payment verification)
  - `GOOGLE_PLAY_CLIENT_EMAIL_KEY` (service account)
  - `GOOGLE_PLAY_PRIVATE_KEY_KEY` (service account)

---

## Metro Configuration

### Overview
**File:** `metro.config.js`

Metro is the JavaScript bundler for React Native. Shams al-Asrār uses security hardening in release builds.

### Resolver Configuration

**Supported Source Extensions:**
- TypeScript: `.ts`, `.tsx`
- JavaScript: `.js`, `.jsx`
- CommonJS: `.cjs`, `.mjs`
- JSON: `.json`

**Supported Asset Extensions:**
- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`
- Fonts: `.ttf`, `.otf`, `.woff`, `.woff2`
- Audio: `.mp3`, `.wav`
- Binary: `.se1`, `.wasm`

### Transformer Configuration

**Standard Options:**
```javascript
experimentalImportSupport: false
inlineRequires: true
```

### Release Build Security Hardening

**Enabled When:** `NODE_ENV === 'production'`

**Minifier:** Terser (`metro-minify-terser`)

**Terser Configuration:**

| Option | Value | Purpose |
|--------|-------|---------|
| **Mangle** | | |
| · toplevel | `true` | Rename all identifiers to single letters |
| · keep_classnames | `false` | Replace class names (disable debugging) |
| · keep_fnames | `false` | Replace function names (disable debugging) |
| **Compress** | | |
| · drop_console | `true` | Strip console.* statements |
| · dead_code | `true` | Remove unreachable code |
| · drop_debugger | `true` | Remove debugger statements |
| · pure_funcs | `console.log`, `console.info`, `console.debug`, `console.warn` | Treat as side-effect-free |
| · evaluate | `true` | Pre-compute constant expressions |
| · passes | `3` | Run compression 3 times |
| **Output** | | |
| · comments | `false` | Strip all comments |
| · ascii_only | `true` | Safe for all character sets |
| **Source Maps** | `false` | No source maps in production |

**Security Impact:**
- Identifies replaced with single characters: reduces binary size & obscures logic
- `console.*` statements stripped: no debug information leaks in production
- No source maps: prevents reverse engineering from stack traces
- 3 compression passes: maximum optimization

---

## JavaScript Bundle Settings

### Build Scripts

| Script | Purpose |
|--------|---------|
| `start` | Start Metro bundler for development |
| `start:reset` | Start bundler with cache cleared |
| `build:android:debug` | Build debug APK |
| `build:android:release` | Build release APK |
| `bundle:android` | Generate app bundle for Play Store |
| `android` | Run on connected Android device |
| `lint` | Check code style (max 0 warnings) |
| `lint:fix` | Auto-fix code style |
| `typecheck` | Type check with TypeScript |
| `format` | Format code with Prettier |
| `test` | Run Jest tests |
| `test:watch` | Run tests in watch mode |
| `test:coverage` | Generate coverage report |

### Bundle Configuration

**Release Bundle Command:**
```bash
cd android && gradlew bundleRelease
```

This generates an App Bundle (`.aab`) optimized for Google Play distribution.

### Babel Configuration

**File:** `babel.config.js`

**Presets:**
- `@react-native/babel-preset` (React Native 0.74.87)

**Plugins:**

1. **module-resolver:** Path aliasing
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

2. **react-native-reanimated/plugin** (must be last)

---

## Build Configuration

### React Native Version & Architecture

| Setting | Value |
|---------|-------|
| **React Native** | 0.74.5 |
| **React** | 18.2.0 |
| **Hermes Engine** | Enabled (ON) |
| **New Architecture** | Disabled (OFF) |
| **Kotlin** | Enabled |
| **TypeScript** | 5.0.4 |

### Android Build Configuration

**File:** `android/app/build.gradle`

#### Target Specifications
- **Min SDK:** 24 (Android 7.0)
- **Target SDK:** 34 (Android 14)
- **Build Tools:** (from `rootProject.ext.buildToolsVersion`)
- **NDK Version:** (from `rootProject.ext.ndkVersion`)
- **Namespace:** `com.astrosarfaraz.shamsalasrar`

#### App Identifiers
- **Application ID:** `com.astrosarfaraz.shamsalasrar`
- **Debug ID:** `com.astrosarfaraz.shamsalasrar.debug`
- **Version Code:** 1
- **Version Name:** 0.1.0

#### Localization
```
resourceConfigurations += ["en", "ur", "hi"]
```
**Effect:** APK only includes English, Urdu, and Hindi resources → reduced APK size

#### ABI Configuration
```
ABI Splits: DISABLED (disabled via Gradle)
App Bundle: Handles per-ABI delivery in production
Supported ABIs: armeabi-v7a, arm64-v8a, x86, x86_64
```

#### Signing Configuration

**Debug Signing:**
```
Keystore: debug.keystore
Alias: androiddebugkey
Password: android
```

**Release Signing:**
Located in `~/.gradle/gradle.properties` (not in VCS):
```
SHAMS_UPLOAD_STORE_FILE=<path>
SHAMS_UPLOAD_STORE_PASSWORD=<password>
SHAMS_UPLOAD_KEY_ALIAS=<alias>
SHAMS_UPLOAD_KEY_PASSWORD=<key-password>
```

#### Build Types
- **Debug Build:** Signed with debug keystore, app ID suffix `.debug`, version name suffix `-debug`
- **Release Build:** Signed with release keystore from gradle.properties, ProGuard minification enabled

#### Minification
- **ProGuard:** Enabled in release builds (`enableProguardInReleaseBuilds = true`)
- **Java Bytecode:** Minified to reduce APK size
- **Identifier Renaming:** Obfuscated for security

### React Native Config

**File:** `react-native.config.js`

```javascript
{
  project: {
    android: {
      sourceDir: './android'
    }
  },
  assets: ['./assets/fonts/']
}
```

**Effect:** Fonts in `./assets/fonts/` are automatically linked to Android build.

### Dependencies

#### Core Runtime Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 18.2.0 | UI framework |
| `react-native` | 0.74.5 | Native platform bindings |
| `zustand` | ^4.5.5 | State management |

#### Navigation & UI
| Package | Version | Purpose |
|---------|---------|---------|
| `@react-navigation/native` | ^6.1.18 | Navigation framework |
| `@react-navigation/native-stack` | ^6.11.0 | Stack navigator |
| `@react-navigation/bottom-tabs` | ^6.6.1 | Bottom tabs navigator |
| `react-native-gesture-handler` | 2.16.2 | Gesture handling |
| `react-native-reanimated` | 3.10.1 | Animations & transitions |
| `react-native-safe-area-context` | ^4.10.9 | Safe area (notches) |
| `react-native-screens` | ^3.34.0 | Native screen components |

#### Firebase & Security
| Package | Version | Purpose |
|---------|---------|---------|
| `@react-native-firebase/app` | ^21.0.0 | Firebase SDK core |
| `@react-native-firebase/auth` | ^21.0.0 | Firebase Authentication |
| `@react-native-firebase/app-check` | ^21.14.0 | App Check (token validation) |
| `@react-native-google-signin/google-signin` | ^16.1.2 | Google Sign-In |

#### Storage & Graphics
| Package | Version | Purpose |
|---------|---------|---------|
| `react-native-mmkv` | ^2.12.2 | Encrypted key-value storage |
| `react-native-svg` | 15.3.0 | SVG rendering |

#### Dev Dependencies
- **TypeScript Tools:** `@react-native/typescript-config`, `typescript`
- **Linting:** `eslint`, `@react-native/eslint-config`, `eslint-config-prettier`, `eslint-plugin-prettier`
- **Testing:** `jest`, `@types/jest`, `babel-jest`, `react-test-renderer`
- **Formatting:** `prettier`
- **Patching:** `patch-package`

#### Node & Engine Requirements
```json
{
  "engines": {
    "node": ">=18"
  }
}
```

### Testing Configuration (Jest)

**Preset:** `react-native`

**Transform Ignore Patterns:** (Allow these to be transformed instead of skipped)
```
- jest-?react-native
- @react-native
- @react-navigation
- react-native-mmkv
- react-native-reanimated
- react-native-svg
```

**Module Mocks:**
```
react-native-mmkv → __mocks__/react-native-mmkv.js
```

**Supported File Extensions:**
```
ts, tsx, js, jsx, json, node
```

---

## Firebase Emulator Settings

### Local Development Emulator Suite

**File:** `firebase-emulator.json`

| Service | Host | Port | Purpose |
|---------|------|------|---------|
| **Auth** | localhost | 9099 | Firebase Authentication emulation |
| **Firestore** | localhost | 8080 | Firestore database emulation |
| **Cloud Functions** | localhost | 5001 | Cloud Functions emulation |
| **Cloud Pub/Sub** | localhost | 8085 | Pub/Sub message queue emulation |
| **Cloud Storage** | localhost | 9199 | File storage emulation |
| **Emulator UI** | localhost | 4000 | Web dashboard for monitoring |

### Emulator Suite Modes
- **Single Project Mode:** `true` (unified project ID across all services)
- **Workstation Config:** Empty (uses defaults)

### Development Workflow
```bash
# Start emulator suite (all services)
firebase emulators:start

# Access dashboard
http://localhost:4000
```

---

## Summary & Recommendations

### Key Strengths

✅ **Security**
- Deny-by-default Firestore rules with explicit allowlists
- Client-side quota enforcement + server-side validation
- Cloud Functions enforce privileged operations
- Release builds: minified, mangled, console-stripped, no source maps

✅ **Performance**
- Hermes bytecode engine enabled (faster cold starts, smaller memory)
- ProGuard minification in release builds
- 3-pass Terser compression for JavaScript
- Localization limited to 3 languages (en, ur, hi)

✅ **Architecture**
- Monolithic Firestore schema with clear role-based access
- Sunday-anchored quota system aligned across client & server
- Multi-tier IAM (free, starter, premium, consultation)
- Integrated Google Play billing

✅ **Developer Experience**
- Path aliases for clean imports
- TypeScript throughout
- Jest + React Test Renderer for testing
- Firebase Emulator Suite for local development

### Recommendations

⚠️ **Configuration Management**
- [ ] Verify `gradle.properties` is in `.gitignore` (contains signing secrets)
- [ ] Document Firebase secret setup in deployment guide
- [ ] Add environment-specific Firebase project configs (staging vs. production)

⚠️ **Monitoring & Logging**
- [ ] Set up Firebase Cloud Logging for function errors
- [ ] Configure Firestore usage alerts (read/write quotas)
- [ ] Monitor Hermes bytecode compilation cache

⚠️ **Testing**
- [ ] Increase test coverage (currently not at 100%)
- [ ] Add integration tests with Firebase Emulator
- [ ] Test quota system edge cases (week boundaries, plan expiry)

⚠️ **Release Pipeline**
- [ ] Verify app bundle size < 100 MB (uncompressed)
- [ ] Set up automated Play Store releases
- [ ] Document manual rollback procedures

### Next Steps

1. **Deploy to Firebase:** Ensure `.env` variables are loaded in Cloud Functions
2. **Test Locally:** `firebase emulators:start` + manual client testing
3. **Monitor Production:** Set up Firebase Alerts for quota/rate-limit abuses
4. **Iterate:** A/B test free tier limits & premium pricing

---

**End of Report**
