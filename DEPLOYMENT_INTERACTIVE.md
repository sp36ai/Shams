# Interactive Deployment Guide — Shams al-Asrār

This is a **hands-on, step-by-step guide** for deploying Shams al-Asrār. Follow each section in order.

**Time estimate**: 30-45 minutes (first time), 5-10 minutes (subsequent deploys)

---

## Phase 1: Prerequisites (5 min)

### Step 1.1: Install Required Tools

```bash
# Install Node.js 22+ (if not already installed)
# https://nodejs.org

# Verify Node.js
node --version  # Should be v22.0.0 or higher

# Install Firebase CLI
npm install -g firebase-tools

# Verify Firebase CLI
firebase --version

# Install Google Cloud CLI (optional but recommended)
# https://cloud.google.com/sdk/docs/install
gcloud --version
```

### Step 1.2: Authenticate

```bash
# Login to Google Cloud
gcloud auth login

# Login to Firebase
firebase login

# Verify authentication
firebase projects:list
```

Expected output: List of your Firebase projects including `shams-app-4d0e7`

---

## Phase 2: Verify Firebase Project (5 min)

### Step 2.1: Check Your Firebase Project

```bash
# List all Firebase projects
firebase projects:list

# Look for: shams-app-4d0e7
```

### Step 2.2: If Project Doesn't Exist

Create it in [Firebase Console](https://console.firebase.google.com):

1. Click **Create Project**
2. Name: `Shams al-Asrar`
3. Enable Google Analytics (optional)
4. Create project

Then set `.firebaserc`:

```json
{
  "projects": {
    "default": "shams-app-4d0e7"
  }
}
```

---

## Phase 3: Deploy Cloud Functions (10 min)

### Step 3.1: Automated Deploy (Recommended)

```bash
# Run the automated deployment script
./scripts/deploy/deploy.sh --project shams-app-4d0e7

# Options:
#   --dry-run     See what would be deployed without deploying
#   --skip-rules  Deploy only Cloud Functions
#   --skip-functions  Deploy only Firestore rules
```

**Expected output:**
```
✓ Node.js v22.x.x
✓ firebase-tools ...
✓ Firebase authenticated
✓ Project shams-app-4d0e7 found
✓ Cloud Functions built
✓ Cloud Functions deployed
✓ Firestore rules and indexes deployed
✓ Health endpoint is accessible
✓ All secrets configured

╔════════════════════════════════════════════╗
║  ✓ Deployment Complete                    ║
╚════════════════════════════════════════════╝
```

### Step 3.2: Manual Deploy (If Automated Fails)

```bash
# Build Cloud Functions
cd functions
npm install
npm run build
cd ..

# Deploy
firebase deploy --only functions,firestore --project shams-app-4d0e7
```

### Step 3.3: Verify Deployment

```bash
# List deployed functions
firebase functions:list --project shams-app-4d0e7

# Test health endpoint
curl https://asia-south1-shams-app-4d0e7.cloudfunctions.net/health

# View recent logs
firebase functions:log --project shams-app-4d0e7 --limit 10
```

---

## Phase 4: Set Up GCP Secrets (10 min)

### Step 4.1: Automated Setup

```bash
chmod +x scripts/deploy/setup-secrets.sh
./scripts/deploy/setup-secrets.sh --project shams-app-4d0e7

# Follow the prompts:
#   - Enter Google Play credentials (or press Enter for test values)
#   - Enter Razorpay credentials (or press Enter for test values)
```

### Step 4.2: Manual Setup (If Needed)

```bash
PROJECT_ID="shams-app-4d0e7"

# Create secrets in GCP Secret Manager
echo "test-client@test.iam.gserviceaccount.com" | \
  gcloud secrets create GOOGLE_PLAY_CLIENT_EMAIL --data-file=- --project=$PROJECT_ID

# Repeat for other secrets:
#   - GOOGLE_PLAY_PRIVATE_KEY
#   - RAZORPAY_KEY_ID
#   - RAZORPAY_KEY_SECRET
#   - RAZORPAY_WEBHOOK_SECRET

# Grant Cloud Functions service account access
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"
gcloud secrets add-iam-policy-binding GOOGLE_PLAY_CLIENT_EMAIL \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID
```

---

## Phase 5: Build Android APK (10 min)

### Step 5.1: Check Android Setup

```bash
# Verify Android SDK
android --version  # Or use Android Studio

# Verify Java
java --version  # Should be 17+

# Check gradle wrapper
./gradlew --version
```

### Step 5.2: Build Debug APK

```bash
# Automated build
chmod +x scripts/deploy/build-android.sh
./scripts/deploy/build-android.sh

# Or manual build
./gradlew assembleDebug
```

**Expected output:**
```
BUILD SUCCESSFUL in Xs

APK built: android/app/build/outputs/apk/debug/app-debug.apk (XX MB)
```

### Step 5.3: Build with Docker (If No Android SDK)

```bash
# Start Docker containers
docker-compose up -d

# Build in Docker
docker-compose exec android-build ./gradlew assembleDebug

# Stop containers
docker-compose down
```

---

## Phase 6: Test Locally (10 min)

### Step 6.1: Start Emulator or Connect Device

**Option A: Android Emulator**
```bash
# List emulators
emulator -list-avds

# Start emulator
emulator -avd Pixel_4_API_31

# Verify device connection
adb devices
```

**Option B: Physical Device**
```bash
# Enable USB debugging on device
# Connect via USB
# Verify connection
adb devices
```

### Step 6.2: Install APK

```bash
# Install debug APK
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Verify installation
adb shell pm list packages | grep shamsalasrar
```

### Step 6.3: Test App Flows

Open the app and test:

- [ ] **Sign In** — Create account with email/password
- [ ] **Ask Oracle** — Ask a question, verify it reaches Cloud Functions
- [ ] **History** — Check that reading is saved
- [ ] **Settings** — Change theme/language
- [ ] **Permissions** — Grant location access

### Step 6.4: Check Logs

```bash
# View app logs
adb logcat | grep "Shams\|RKP\|Firebase\|HTTP"

# View Cloud Functions logs
firebase functions:log --project shams-app-4d0e7 --limit 20
```

---

## Phase 7: Set Up Cloud Build CI/CD (5 min)

### Step 7.1: Enable Required APIs

```bash
PROJECT_ID="shams-app-4d0e7"

gcloud services enable \
  cloudbuild.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudkms.googleapis.com \
  secretmanager.googleapis.com \
  --project=$PROJECT_ID
```

### Step 7.2: Grant Cloud Build Service Account Roles

```bash
PROJECT_ID="shams-app-4d0e7"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/firebase.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/cloudfunctions.developer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### Step 7.3: Create Cloud Build Trigger

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click **Create Trigger**
3. Configure:
   - **Name**: `shams-deploy`
   - **Source**: GitHub (authorize if needed)
   - **Repository**: `sp36ai/Shams`
   - **Branch regex**: `^main$`
   - **Build config file location**: `cloudbuild.yaml`
4. Click **Create**

### Step 7.4: Test the Trigger

```bash
# Push to main branch
git push origin main

# Monitor build in Cloud Console
# https://console.cloud.google.com/cloud-build/builds
```

---

## Troubleshooting

### "Firebase project not found"
```bash
# Verify project exists
firebase projects:list

# Set correct project
firebase use --add
firebase use shams-app-4d0e7
```

### "Permission denied" deploying functions
```bash
# Check IAM roles
gcloud projects get-iam-policy shams-app-4d0e7

# Grant missing role
gcloud projects add-iam-policy-binding shams-app-4d0e7 \
  --member="user:YOUR_EMAIL@gmail.com" \
  --role="roles/firebase.admin"
```

### APK installation fails
```bash
# Uninstall previous version
adb uninstall com.astrosarfaraz.shamsalasrar

# Clear app data
adb shell pm clear com.astrosarfaraz.shamsalasrar

# Reinstall
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Cloud Functions timeout during deployment
```bash
# Increase timeout
firebase deploy --only functions --project shams-app-4d0e7 --timeout=600
```

### Health endpoint not accessible
```bash
# Wait a few seconds, then try again
sleep 10
curl https://asia-south1-shams-app-4d0e7.cloudfunctions.net/health

# Check logs
firebase functions:log --project shams-app-4d0e7 --limit 50
```

---

## Monitoring & Maintenance

### View Cloud Functions Logs

```bash
firebase functions:log --project shams-app-4d0e7 --limit 50
```

Or via [Cloud Logging Console](https://console.cloud.google.com/logs)

### Monitor Firestore Database

Visit [Firestore Console](https://console.firebase.google.com) → Build → Firestore Database

- **Collections**: `readings`, `quotas`, `auditLogs`, `securityEvents`
- **Rules**: Verify deny-by-default (line 112-113)

### Check App Check Status

```bash
# View registered apps
firebase appcheck:list --project shams-app-4d0e7
```

---

## Rollback

If deployment goes wrong:

```bash
# Redeploy previous version
firebase deploy --only functions,firestore --project shams-app-4d0e7 --force

# Or revert git commit and redeploy
git revert HEAD
git push origin main
```

---

## Next Steps

- [ ] Monitor Cloud Functions logs for errors
- [ ] Test payment flows (IAP + Razorpay) with test accounts
- [ ] Set up monitoring/alerting for Cloud Functions
- [ ] Prepare app for public beta testing
- [ ] Plan gradual rollout to play store

---

**Questions?** See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed reference documentation.
