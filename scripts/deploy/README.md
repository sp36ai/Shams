# Deployment Scripts — Shams al-Asrār

Complete toolkit for deploying Shams al-Asrār to Firebase and Google Cloud.

## Quick Start

```bash
# 1. Deploy Cloud Functions + Firestore
./scripts/deploy/deploy.sh --project shams-app-4d0e7

# 2. Set up GCP secrets
./scripts/deploy/setup-secrets.sh --project shams-app-4d0e7

# 3. Build Android APK
./scripts/deploy/build-android.sh

# 4. Verify deployment
./scripts/deploy/test-deployment.sh --project shams-app-4d0e7
```

---

## Scripts Overview

### `deploy.sh` — Firebase Deployment

Automates Cloud Functions and Firestore rules deployment.

**Usage:**
```bash
./scripts/deploy/deploy.sh [options]

Options:
  --dry-run              Show what would be deployed (don't deploy)
  --skip-functions       Deploy only Firestore rules
  --skip-rules           Deploy only Cloud Functions
  --project PROJECT_ID   Override GCP project ID
  --region REGION        Cloud Functions region (default: asia-south1)
  --help                 Show help message
```

**Examples:**
```bash
# Deploy everything
./scripts/deploy/deploy.sh

# Dry run (see what would happen)
./scripts/deploy/deploy.sh --dry-run

# Deploy only functions (skip rules)
./scripts/deploy/deploy.sh --skip-rules

# Custom project
./scripts/deploy/deploy.sh --project my-project-id
```

**What it does:**
1. ✅ Verifies Node.js, firebase-tools, gcloud are installed
2. ✅ Checks Firebase authentication
3. ✅ Verifies Firebase project exists
4. ✅ Builds Cloud Functions (npm install + tsc)
5. ✅ Deploys functions to asia-south1 region
6. ✅ Deploys Firestore rules and indexes
7. ✅ Tests health endpoint
8. ✅ Configures secret manager access

---

### `setup-secrets.sh` — GCP Secret Manager

Interactively creates secrets for payment verification.

**Usage:**
```bash
./scripts/deploy/setup-secrets.sh [--project PROJECT_ID]
```

**Examples:**
```bash
# Default project
./scripts/deploy/setup-secrets.sh

# Custom project
./scripts/deploy/setup-secrets.sh --project shams-app-4d0e7
```

**What it does:**
1. ✅ Prompts for credentials (Google Play, Razorpay)
2. ✅ Creates secrets in GCP Secret Manager
3. ✅ Grants Cloud Functions service account access
4. ✅ Documents secret names for reference

**Secrets created:**
- `GOOGLE_PLAY_CLIENT_EMAIL` — Google Play service account email
- `GOOGLE_PLAY_PRIVATE_KEY` — Google Play private key (JSON)
- `RAZORPAY_KEY_ID` — Razorpay API key
- `RAZORPAY_KEY_SECRET` — Razorpay API secret
- `RAZORPAY_WEBHOOK_SECRET` — Razorpay webhook signature secret

---

### `build-android.sh` — Android Build

Builds debug or release APKs.

**Usage:**
```bash
./scripts/deploy/build-android.sh [--release] [--docker]

Options:
  --release    Build release APK (requires signing setup)
  --docker     Build inside Docker container
```

**Examples:**
```bash
# Build debug APK (default)
./scripts/deploy/build-android.sh

# Build release APK
./scripts/deploy/build-android.sh --release

# Build in Docker (no Android SDK needed)
./scripts/deploy/build-android.sh --docker
```

**What it does:**
1. ✅ Checks Java, Android SDK, gradle
2. ✅ Runs `./gradlew assembleDebug` (or `assembleRelease`)
3. ✅ Reports APK location and size
4. ✅ Suggests next steps (install on device)

---

### `test-deployment.sh` — Verification

Comprehensive deployment verification.

**Usage:**
```bash
./scripts/deploy/test-deployment.sh [--project PROJECT_ID]
```

**Examples:**
```bash
# Test default project
./scripts/deploy/test-deployment.sh

# Test custom project
./scripts/deploy/test-deployment.sh --project shams-app-4d0e7
```

**What it checks:**
1. ✅ Cloud Functions are deployed
2. ✅ Health endpoint is accessible
3. ✅ Firestore rules are valid
4. ✅ Firestore indexes exist
5. ✅ Cloud Functions logs are accessible
6. ✅ Secret Manager is configured

---

## Prerequisites

### Required Tools

```bash
# Node.js 22+
node --version

# Firebase CLI
npm install -g firebase-tools
firebase --version

# Google Cloud SDK (optional but recommended)
gcloud --version

# Android SDK (for building APKs)
# Or use --docker flag to build in Docker
```

### Authentication

```bash
# Login to Google Cloud
gcloud auth login

# Login to Firebase
firebase login
```

### GCP Project

Create a Firebase project if you don't have one:

```bash
# Via CLI
firebase projects:addfirebase GCP_PROJECT_ID

# Or via Firebase Console
# https://console.firebase.google.com
```

---

## Complete Deployment Flow

### 1. One-Time Setup

```bash
# Install tools
npm install -g firebase-tools

# Authenticate
gcloud auth login
firebase login

# Create Firebase project (if needed)
firebase projects:addfirebase shams-app-4d0e7
```

### 2. Deploy Backend

```bash
# Deploy Cloud Functions + Firestore
./scripts/deploy/deploy.sh --project shams-app-4d0e7

# Wait for health endpoint to be ready
sleep 10

# Verify deployment
./scripts/deploy/test-deployment.sh --project shams-app-4d0e7
```

### 3. Set Up Payments (Optional)

```bash
# Create secrets for payment verification
./scripts/deploy/setup-secrets.sh --project shams-app-4d0e7
```

### 4. Build Mobile App

```bash
# Build Android APK
./scripts/deploy/build-android.sh

# Or build in Docker
./scripts/deploy/build-android.sh --docker
```

### 5. Test on Device

```bash
# Install APK on device/emulator
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# View logs
adb logcat | grep Shams
firebase functions:log --project shams-app-4d0e7 --follow
```

---

## Docker-Based Deployment

### Prerequisites

```bash
docker --version
docker-compose --version
```

### Start Services

```bash
# Start all services (Firebase emulator, Android build, Postgres)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f firebase
```

### Build APK in Docker

```bash
# Build debug APK
docker-compose exec android-build ./gradlew assembleDebug

# Build release APK
docker-compose exec android-build ./gradlew assembleRelease
```

### Stop Services

```bash
docker-compose down
```

---

## Troubleshooting

### "Command not found: firebase"

```bash
npm install -g firebase-tools
```

### "Not authenticated to Firebase"

```bash
firebase login
firebase use --add
firebase use shams-app-4d0e7
```

### "Permission denied" deploying functions

```bash
# Check IAM role
gcloud projects get-iam-policy shams-app-4d0e7

# Grant missing role
gcloud projects add-iam-policy-binding shams-app-4d0e7 \
  --member="user:YOUR_EMAIL@gmail.com" \
  --role="roles/firebase.admin"
```

### "APK installation fails"

```bash
# Uninstall previous version
adb uninstall com.astrosarfaraz.shamsalasrar

# Clear cache
adb shell pm clear com.astrosarfaraz.shamsalasrar

# Reinstall
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### "Health endpoint not accessible"

```bash
# Wait a few seconds (first deploy takes time)
sleep 30

# Try again
curl https://asia-south1-shams-app-4d0e7.cloudfunctions.net/health

# Check logs
firebase functions:log --project shams-app-4d0e7 --limit 20
```

---

## Interactive Guide

For a more detailed, step-by-step walkthrough:

```bash
cat DEPLOYMENT_INTERACTIVE.md
```

---

## Further Reference

- [DEPLOYMENT.md](../DEPLOYMENT.md) — Comprehensive deployment reference
- [DEPLOYMENT_INTERACTIVE.md](../DEPLOYMENT_INTERACTIVE.md) — Interactive step-by-step guide
- [README.md](../README.md) — Project overview
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Firebase Documentation](https://firebase.google.com/docs)

---

## FAQ

**Q: Can I use these scripts on Windows?**
A: Yes, use WSL2 (Windows Subsystem for Linux) or Git Bash.

**Q: Do I need to run `setup-secrets.sh` before deploying?**
A: No, it's optional. Cloud Functions will work without secrets (payment verification will fail gracefully). Run it when you have real credentials.

**Q: Can I deploy without Docker?**
A: Yes, if you have Android SDK and Java 17+ installed locally.

**Q: How often should I redeploy?**
A: Whenever you push to the `main` branch (via Cloud Build trigger). Manual deploys are optional for testing.

**Q: What if a deployment fails midway?**
A: Run the script again. It's idempotent — it will retry failed steps.

---

**Need help?** See [DEPLOYMENT_INTERACTIVE.md](../DEPLOYMENT_INTERACTIVE.md) for step-by-step troubleshooting.
