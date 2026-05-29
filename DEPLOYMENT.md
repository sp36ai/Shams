# Deployment Guide — Shams al-Asrar

This guide covers deploying the app (React Native Android) and backend (Cloud Functions + Firestore) to production.

## Prerequisites

### 1. GCP Project

If you don't have a GCP project yet:

```bash
# Create project
gcloud projects create shams-app-4d0e7

# Enable billing
gcloud billing accounts list
gcloud billing projects link shams-app-4d0e7 \
  --billing-account=BILLING_ACCOUNT_ID

# Set default project
gcloud config set project shams-app-4d0e7
```

### 2. Firebase Project

```bash
# Create Firebase project from GCP project
firebase projects:addfirebase shams-app-4d0e7

# Or via Firebase Console: https://console.firebase.google.com
```

### 3. Enable Required APIs

```bash
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com \
  iap.googleapis.com
```

### 4. Local Tools

```bash
# Node.js 22+
node --version

# Firebase CLI
npm install -g firebase-tools
firebase login

# (Optional) GCloud CLI
gcloud --version
```

## Firebase Console Setup

Follow these steps in [Firebase Console](https://console.firebase.google.com):

### Authentication

1. Go to **Build → Authentication**
2. Enable **Email/Password**
3. Enable **Google** (required: Google Web Client ID in app config)
4. Enable **Google Play Games** (optional, for future game features)
5. Set password policy (minimum 8 chars recommended)

### Firestore Database

1. Go to **Build → Firestore Database**
2. Create database:
   - **Mode**: Production (security rules are strict)
   - **Region**: `us-central1` (or nearest region)
3. Do NOT use Firestore in Datastore mode

### Cloud Functions

1. Go to **Build → Functions**
2. Verify region is `asia-south1` (matches functions/firebase.json)
3. Ensure Cloud Build API is enabled (should be automatic)

### Security Rules

Deploy Firestore rules locally:

```bash
firebase deploy --only firestore --project shams-app-4d0e7
```

Rules file: `firestore.rules`  
Indexes file: `firestore.indexes.json`

### App Check (Mobile Only)

1. Go to **Build → App Check**
2. Register Android app:
   - Package name: `com.astrosarfaraz.shamsalasrar`
   - SHA-1 fingerprint: Get from `./android/app/build.gradle` or `keytool -list -v -keystore ~/.android/debug.keystore`
3. Enable **Play Integrity API**
4. Set debug token for local testing (if needed)

## Cloud Build Deployment

### 1. Grant IAM Roles to Cloud Build

The Cloud Build service account needs:

```bash
PROJECT_ID="shams-app-4d0e7"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# Firebase Admin
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com \
  --role=roles/firebase.admin

# Cloud Functions Developer
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com \
  --role=roles/cloudfunctions.developer

# Service Account User
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com \
  --role=roles/iam.serviceAccountUser
```

### 2. Connect GitHub to Cloud Build

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Create trigger:
   - **Source**: GitHub
   - **Repository**: `sp36ai/Shams`
   - **Branch**: `main`
   - **Build config file location**: `cloudbuild.yaml`
3. Authorize GitHub connection if prompted

### 3. Manual Trigger (Optional)

```bash
gcloud builds submit --config=cloudbuild.yaml
```

### 4. Monitor Build

Go to Cloud Build console or:

```bash
gcloud builds list --limit=5
gcloud builds log BUILD_ID  # Replace BUILD_ID with actual build
```

## GitHub Actions Deployment (Alternative)

If you prefer GitHub Actions over Cloud Build:

### 1. Create Firebase Token

```bash
firebase login:ci
# Saves token to ~/.config/firebase/tokens.json
# Copy the output token
```

### 2. Add GitHub Secret

1. Go to repo → **Settings → Secrets and variables → Actions**
2. Create new secret:
   - **Name**: `FIREBASE_TOKEN`
   - **Value**: (paste token from above)

### 3. Trigger

Push to `main` branch:

```bash
git push origin main
```

Workflow file: `.github/workflows/deploy-functions.yml`

Monitor: **Actions** tab in GitHub

## Manual Deployment

For local testing or emergency hotfixes:

```bash
# Build and test locally
npm install
npm run lint
npm test

cd functions
npm install
npm run build
npm test
cd ..

# Deploy
firebase deploy --only functions,firestore --project shams-app-4d0e7
```

## Environment Variables & Secrets

Cloud Functions require GCP Secret Manager integration. These are configured in `functions/src/functions/payments/googlePlay.ts` and `razorpay.ts`:

- `GOOGLE_PLAY_CLIENT_EMAIL` — Google Play service account email
- `GOOGLE_PLAY_PRIVATE_KEY` — Google Play service account private key (JSON format)
- `RAZORPAY_KEY_ID` — Razorpay API key
- `RAZORPAY_KEY_SECRET` — Razorpay API secret
- `RAZORPAY_WEBHOOK_SECRET` — Razorpay webhook signature secret

**To set secrets** (one-time setup):

```bash
# Google Play credentials
gcloud secrets create GOOGLE_PLAY_CLIENT_EMAIL --data-file=-
gcloud secrets create GOOGLE_PLAY_PRIVATE_KEY --data-file=-

# Razorpay
gcloud secrets create RAZORPAY_KEY_ID --data-file=-
gcloud secrets create RAZORPAY_KEY_SECRET --data-file=-
gcloud secrets create RAZORPAY_WEBHOOK_SECRET --data-file=-

# Grant Cloud Functions service account access
gcloud secrets add-iam-policy-binding GOOGLE_PLAY_CLIENT_EMAIL \
  --member=serviceAccount:shams-app-4d0e7@appspot.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

# Repeat for other secrets...
```

## Verification Checklist

After deployment:

```bash
# 1. Check Cloud Functions deployed
firebase functions:list --project shams-app-4d0e7

# 2. Test health endpoint
curl https://asia-south1-shams-app-4d0e7.cloudfunctions.net/health

# 3. Verify Firestore rules
firebase test:firestore --project shams-app-4d0e7

# 4. Check custom claims format
firebase auth:export users.json --project shams-app-4d0e7
# Look for sample user with { plan: "mureed", planExpiry: "..." }

# 5. App Check
firebase appcheck:simulate  # For local testing
```

See [DEPLOYMENT_VERIFICATION_CHECKLIST.md](./DEPLOYMENT_VERIFICATION_CHECKLIST.md) for full post-deployment testing.

## Rollback

If a deployment goes wrong:

```bash
# Redeploy previous version (Cloud Build auto-creates each deployment)
firebase deploy --only functions,firestore --project shams-app-4d0e7

# Or manually rollback via Firebase Console → Functions
# (Select previous deploy and promote)
```

## Monitoring

### Cloud Functions Logs

```bash
gcloud functions describe askOracle --region=asia-south1 --gen2
gcloud functions logs read askOracle --region=asia-south1 --limit=50
```

Or via [Cloud Logging Console](https://console.cloud.google.com/logs)

### Firestore

Monitor:
- Quota checks (quotas collection)
- Failed payment verifications (audit logs)
- Abuse patterns (rate limit collection)

Via [Firestore Console](https://console.firebase.google.com) → Data tab

## Troubleshooting

### Cloud Build Fails: "firebase-tools not found"

**Fix**: Ensure `npm install -g firebase-tools` runs before `firebase deploy`. The pipeline already does this with `npx firebase-tools` in the deploy step.

### Cloud Functions Deploy Fails: "Permission denied"

**Fix**: Verify Cloud Build service account has `roles/firebase.admin`. See "Grant IAM Roles" section above.

### Firestore Rules Validation Fails

**Fix**: Ensure `firestore.rules` is valid:

```bash
firebase validate-rules firestore.rules
```

### Payment Verification Fails

**Check**:
1. Are secrets set in GCP Secret Manager?
2. Is the service account granted `secretmanager.secretAccessor` role?
3. Do Google Play/Razorpay credentials work locally?

```bash
# Local test
cd functions
npm run serve  # Start emulator
# Test askOracle via Firestore emulator
```

### App Check Mismatch

If app fails with "App Check failed", ensure:
1. Android app is registered in Firebase Console
2. `google-services.json` has correct SHA-1
3. App Check debug token is set (local dev only)

## Post-Deployment

1. **Monitor logs** for errors
2. **Test payment flows** (IAP + Razorpay)
3. **Run security audit** (see SECURITY_AUDIT.md if available)
4. **Announce beta** to test users
5. **Collect feedback** on app store / user surveys

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Cloud Functions Guide](https://cloud.google.com/functions/docs)
- [Firestore Rules Guide](https://firebase.google.com/docs/firestore/security/start)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [GitHub Actions × Firebase](https://github.com/marketplace/actions/deploy-to-firebase)

---

**Status**: This guide covers Firebase project setup through Cloud Build/GitHub Actions. For Android app release to Play Store, see [RELEASE_GUIDE.md](./RELEASE_GUIDE.md) (if available) or consult Android documentation.
