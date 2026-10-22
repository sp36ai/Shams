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

### 3. Enable Billing

Firestore requires billing to be enabled:

```bash
# Check billing status
gcloud billing projects describe shams-app-4d0e7

# Link billing account if needed
gcloud billing projects link shams-app-4d0e7 \
  --billing-account=BILLING_ACCOUNT_ID
```

### 4. Enable Required APIs

```bash
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com \
  iap.googleapis.com \
  cloudlogging.googleapis.com \
  secretmanager.googleapis.com
```

### 5. Local Tools

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
   - **Billing**: Requires billing enabled (see step 3 above)
3. Do NOT use Firestore in Datastore mode (use Native mode)

#### TTL policies — `idempotencyKeys`, rate-limit `minutes`, `deletedAccounts` (required)

Three kinds of short-lived records carry an `expiresAt` timestamp, and Firestore
only deletes them once a TTL policy names that field:

- `idempotencyKeys` — `askWatchOracle` and `discussReading` record each
  submission's `requestId`, with the full response, so a retry replays the
  original reading instead of casting and charging for a second one.
  `expiresAt` is 24 hours out.
- `rateLimits/{uid}/minutes/*` — per-minute request counters. `expiresAt` is
  2 minutes out. The TTL policy must name the `minutes` collection group (the
  subcollection the counters live in), not `rateLimits`.
- `deletedAccounts/{uid}` — the marker `deleteAccount` writes first, so no
  in-flight request can add data after deletion (`utils/accountState.ts`).
  Holds only the uid and timestamps; `expiresAt` is 24 hours out.

All three policies are declared in `firestore.indexes.json` (`fieldOverrides`) and
are created by `firebase deploy --only firestore:indexes`, which the functions
deploy workflow runs after every deploy (non-interactive, without `--force`, so
it never deletes an index or override that exists only in the console). Afterwards, confirm
all three appear under **Build → Firestore Database → Time-to-live (TTL)**. If an
older `rateLimits` policy exists there from before, it can be removed — no
documents in that group carry `expiresAt`.

Skipping this is not a correctness problem — deduplication and rate limiting
still work — but both collections then grow without bound. Account deletion
removes a user's records in both regardless (`functions/account.ts`).

### Cloud Functions

1. Go to **Build → Functions**
2. Verify region is `asia-south1` (matches functions/firebase.json)
3. Ensure Cloud Build API is enabled (should be automatic)

#### Secret — `LOG_HASH_KEY` (required before deploying)

Audit and security records carry keyed correlation codes instead of question
text and IP addresses (`functions/src/utils/keyedHash.ts`, HMAC-SHA-256).
`askWatchOracle`, `discussReading`, `verifyGooglePlayPurchase` and `razorpayWebhook`
bind this secret, so deployment fails until it exists. The functions deploy
workflow (`.github/workflows/deploy-functions.yml`, step "Ensure LOG_HASH_KEY
secret exists") creates it on the first deploy that needs it, with a random
value that is never printed, and leaves it unchanged afterwards. It creates
the key only on an explicit `NOT_FOUND`; any other error (such as a missing
Secret Manager permission on the deploy service account) stops the deploy.
To create it by hand instead:

```bash
openssl rand -hex 32 | tr -d '\n' | firebase functions:secrets:set LOG_HASH_KEY --data-file=-
```

- Do not store the key in source, Firestore or `.env` files, and do not log it.
- If the key is ever unavailable at runtime the codes are omitted, never
  replaced with an unkeyed hash.
- Transition: new codes are `h1:` + 32 hex. Older records hold unkeyed
  values (8-hex FNV question codes, 16-hex SHA-256 IP codes) that never match
  the new ones, so correlation does not span the switch. They cannot be
  re-keyed, because these records never held the question text, and the raw IPs
  that were stored are being removed (below).

#### Legacy log fields: what was stored, what is removed, what is not

What older code wrote into Firestore, established from every writer in git
history (owner decisions 2026-10-21 and 2026-10-22):

| Field          | Content                                    | Written to                                                                         | Period                                                                                                                                       |
| -------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `ipAddress`    | the caller's **raw IP address**            | `auditLogs` — the old `askOracle` (`oracle_computed`) and Razorpay `plan_upgraded` | 2026-05-10 to 2026-08-25 (askOracle), 2026-05-10 to 2026-06-27 (Razorpay), per `main`; actual dates depend on when each version was deployed |
| `ipHash`       | unsalted SHA-256 prefix of the IP (16 hex) | `auditLogs`, `securityEvents`                                                      | until the keyed-code deploy                                                                                                                  |
| `questionHash` | bare 32-bit FNV-1a of the question (8 hex) | `auditLogs`                                                                        | until the keyed-code deploy                                                                                                                  |

No other collection ever received these fields, and no other raw-IP field
name was ever used. Razorpay also logged the raw IP to Cloud Logging
(`logger.info('plan upgraded')`).

**The migration** (`functions/src/maintenance/stripLegacyLogFields.ts`, run
by `.github/workflows/deploy-functions.yml` after a healthy deploy) removes
exactly those three fields from `auditLogs` and `securityEvents`: `ipAddress`
whenever present, the two codes only in their unkeyed format (`h1:` codes are
untouched). It never deletes a document or any other field. Three steps, each
printing counts only, never a value:

1. **Preview**: counts the documents and fields it would remove.
2. **Apply**: refuses, changing nothing, unless a fresh scan matches the
   preview's counts; removes the fields in batches of at most 400 updates;
   fails if it removed anything other than what the preview counted; records
   `_system/migration-strip-legacy-log-fields-v1` (counts only). Later
   deploys see the record and skip all three steps.
3. **Verify**: a fresh scan; the deploy fails if any targeted field remains.

Any failure exits non-zero and leaves no completion record. Rerunning is
safe: a field already removed is neither counted nor touched. If a run
fails, start again from the preview. By hand (counts only):

```bash
cd functions
npx vite-node scripts/strip-legacy-log-fields.ts --project <id>              # preview
npx vite-node scripts/strip-legacy-log-fields.ts --project <id> --apply --once \
  --expect '<the "counts" object the preview printed>'
npx vite-node scripts/strip-legacy-log-fields.ts --project <id> --verify
```

Tested against synthetic records on the Firestore emulator
(`npm run test:emulator`): each field alone and together, keyed codes,
records with no target fields, a nested `ipAddress` that must survive,
1,050 records across three pages, an out-of-scope collection, a refused
apply, a failed batch, a write during the run, and the CLI sequence above.

**What the migration does not reach**, and what a zero from step 3 does not
prove:

- **Cloud Logging**: entries written before the deploy may contain the raw IP
  (Razorpay, above) or the unkeyed codes. They are not changed and are
  deleted when the log bucket's retention ends (the policy states the
  retention, read from the `_Default` bucket at hosting deploy).
- **Firestore backups and exports**: not changed. `BACKUP_AND_DISASTER_RECOVERY.md`
  records no backups as of 2026-08-23; check
  `gcloud firestore backups schedules list --project=shams-app-4d0e7`. Any
  backup taken before the migration keeps these fields until it expires.
- A verify result of zero means only that the scan finds none in the two
  collections at that moment; it is not evidence about any other copy.

- Rotating the key breaks correlation the same way; it would need a new
  version prefix (`h2:`) in `keyedHash.ts`.

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
gcloud functions describe askWatchOracle --region=asia-south1 --gen2
gcloud functions logs read askWatchOracle --region=asia-south1 --limit=50
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
# Test askWatchOracle via Firestore emulator
```

### App Check Mismatch

If app fails with "App Check failed", ensure:

1. Android app is registered in Firebase Console
2. `google-services.json` has correct SHA-1
3. App Check debug token is set (local dev only)

## Post-Deployment

1. **Monitor logs** for errors (see Cloud Logging section above)
2. **Test payment flows** (IAP + Razorpay) with test accounts
3. **Run security audit** before public release
4. **Announce beta** to test users
5. **Collect feedback** on app store / user surveys

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Cloud Functions Guide](https://cloud.google.com/functions/docs)
- [Firestore Rules Guide](https://firebase.google.com/docs/firestore/security/start)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [GitHub Actions × Firebase](https://github.com/marketplace/actions/deploy-to-firebase)

---

**Status**: This guide covers Firebase project setup and Cloud Functions deployment. For Android app release to Play Store, consult [Android App Publishing Guide](https://developer.android.com/distribute/console/answer/9859455) or contact your release manager.
