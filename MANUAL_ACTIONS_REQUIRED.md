# Manual Actions Required — Shams al-Asrar

These items CANNOT be fixed with code. Each must be done in the respective console/dashboard.
Revisit this file before every production release.

---

## 1. Google Cloud Console — Restrict Firebase API Key

**Key:** `AIzaSyB-c1iC5716lyvonB8N6wGyI4SRgaPCH5U`

**Steps:**

1. Go to https://console.cloud.google.com → APIs & Services → Credentials
2. Click the key → Application restrictions → Android apps
3. Add package `com.astrosarfaraz.shamsalasrar` + SHA-1 fingerprint of upload key
4. API restrictions → Restrict to: Firebase APIs only (Firebase Auth, Firestore, Cloud Storage)
5. Save

**Why:** Without restriction, anyone can use this key against your Firebase project quota.

---

## 2. Firebase Console — Enable App Check (Play Integrity)

**Steps:**

1. Go to Firebase Console → App Check
2. Register the Android app with Play Integrity provider
3. Enable enforcement for: Authentication, Firestore, Cloud Functions
4. Test with a real device before enforcing (debug token for dev)

**Why:** Without this, any app (not just yours) can call your Cloud Functions.

---

## 3. Firebase Console — Provision ANTHROPIC_API_KEY Secret

**Steps:**

1. Go to Google Cloud Console → Secret Manager → Create secret
2. Name: `ANTHROPIC_API_KEY`, Value: (your Anthropic key)
3. Grant `roles/secretmanager.secretAccessor` to the Functions service account
4. Redeploy functions: `firebase deploy --only functions`

**Why:** The Cloud Functions (`askOracle`, `classifyQuestion`, etc.) need this secret at runtime.

---

## 4. Google Play Console — Service Account for CI/CD

**Steps:**

1. Create a service account in Google Play Console → Setup → API access
2. Grant it "Release Manager" permissions
3. Export JSON key → store as GitHub Secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

**Why:** `release-play-store.yml` CI workflow deploys to Play Store using this account.

---

## 5. Razorpay Dashboard — Register Webhook URL

**Steps:**

1. Log in to Razorpay Dashboard → Settings → Webhooks
2. Add endpoint: `https://asia-south1-shams-app-4d0e7.cloudfunctions.net/razorpayWebhook`
3. Select events: `payment.captured`, `subscription.activated`, `subscription.charged`
4. Copy the webhook secret → store as GitHub Secret `RAZORPAY_WEBHOOK_SECRET`
   and Firebase Secret `RAZORPAY_WEBHOOK_SECRET`

**Why:** Payment upgrades won't work without this.

---

## 6. Certificate Pins — Capture + Add Backup Pin

**Steps:**

1. Capture the current Google API backup pin:
   ```
   openssl s_client -connect firestore.googleapis.com:443 2>/dev/null \
     | openssl x509 -pubkey -noout \
     | openssl pkey -pubin -outform der \
     | openssl dgst -sha256 -binary | base64
   ```
2. Add second pin to `android/app/src/main/res/xml/network_security_config.xml`
3. Set a calendar reminder 90 days before `expiration="2027-05-01"`

**Why:** Without a backup pin, any Google TLS certificate rotation bricks the app.

---

## 7. GitHub Secrets — Verify All Are Set

Required secrets for CI/CD:

- [ ] `GOOGLE_SERVICES_JSON` — base64-encoded google-services.json ✅ (already done)
- [ ] `SHAMS_UPLOAD_KEYSTORE` — base64-encoded upload keystore (.jks).
      The release workflow also accepts the older name `BASE64_KEYSTORE`;
      set **one** of the two. If neither is set the workflow now fails fast
      with an explicit message instead of building an unsigned bundle.
- [ ] `SHAMS_UPLOAD_STORE_PASSWORD`
- [ ] `SHAMS_UPLOAD_KEY_ALIAS` — must be an alias that actually exists in the
      keystore; the workflow verifies this before building.
- [ ] `SHAMS_UPLOAD_KEY_PASSWORD`
- [ ] `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- [ ] `RAZORPAY_WEBHOOK_SECRET`
- [ ] `ANTHROPIC_API_KEY` (for E2E tests in ci.yml)

> **Secret Manager is separate from GitHub Secrets.** The runtime keys the
> deployed Cloud Functions read (`ANTHROPIC_API_KEY`, `GOOGLE_PLAY_CLIENT_EMAIL`,
> `GOOGLE_PLAY_PRIVATE_KEY`, `RAZORPAY_WEBHOOK_SECRET`) are bound via
> `defineSecret` in `functions/src/config.ts` and must exist in **GCP Secret
> Manager** (steps 3 and 5 above). Setting them only as GitHub Secrets leaves
> the deployed functions without them — `askOracle` will serve its canned
> fallback text rather than a real reading.

---

## 8. Runbook — exact commands

Project: `shams-app-4d0e7` · Package: `com.astrosarfaraz.shamsalasrar` · Region: `asia-south1`

### 8a. Generate the upload keystore (step 7)

`android/app/build.gradle` declares `storeType "PKCS12"`. **PKCS12 does not support a
key password that differs from the store password** — use the same value for both
`SHAMS_UPLOAD_STORE_PASSWORD` and `SHAMS_UPLOAD_KEY_PASSWORD`, or signing fails.

```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore shams-upload-key.jks \
  -alias shams-upload \
  -keyalg RSA -keysize 4096 -validity 10000
```

Store it somewhere durable and backed up. **If this file is lost you can no longer
ship updates to the same Play listing** (recoverable only via Play App Signing key
reset, which Google must approve).

Then set the GitHub secrets (`gh auth login` first):

```bash
# Linux. On macOS use: base64 -i shams-upload-key.jks
base64 -w0 shams-upload-key.jks | gh secret set SHAMS_UPLOAD_KEYSTORE

gh secret set SHAMS_UPLOAD_STORE_PASSWORD   # same value ...
gh secret set SHAMS_UPLOAD_KEY_PASSWORD     # ... as this one
gh secret set SHAMS_UPLOAD_KEY_ALIAS        # "shams-upload" if you used the command above
gh secret set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON < play-service-account.json
```

Record the SHA-1 — step 1 (API key restriction) and Google Sign-In both need it:

```bash
keytool -list -v -storetype PKCS12 -keystore shams-upload-key.jks -alias shams-upload | grep SHA1
```

### 8b. Create the GCP Secret Manager secrets (steps 3 and 5)

These are the **runtime** secrets the deployed functions read via `defineSecret`.
They are *not* GitHub Secrets, and all four are declared in `firebase.json`.

Use `printf '%s'`, not `echo` — a trailing newline is part of the secret value and
will corrupt an API key.

```bash
gcloud config set project shams-app-4d0e7

printf '%s' 'sk-ant-...'                  | gcloud secrets create ANTHROPIC_API_KEY        --data-file=-
printf '%s' 'play-sa@...gserviceaccount.com' | gcloud secrets create GOOGLE_PLAY_CLIENT_EMAIL --data-file=-
printf '%s' 'rzp-webhook-secret'          | gcloud secrets create RAZORPAY_WEBHOOK_SECRET   --data-file=-

# Private key: feed the PEM straight from the service-account JSON.
# Either the raw PEM or the \n-escaped form works (googlePlay.ts un-escapes).
jq -r .private_key play-service-account.json | gcloud secrets create GOOGLE_PLAY_PRIVATE_KEY --data-file=-
```

Rotating later is `versions add`, not `create`:

```bash
printf '%s' 'sk-ant-NEW' | gcloud secrets versions add ANTHROPIC_API_KEY --data-file=-
```

Deploy — the Firebase CLI grants `secretAccessor` to the runtime service account:

```bash
firebase deploy --only functions,firestore
```

Verify each one resolves (prints a prefix only):

```bash
for s in ANTHROPIC_API_KEY GOOGLE_PLAY_CLIENT_EMAIL GOOGLE_PLAY_PRIVATE_KEY RAZORPAY_WEBHOOK_SECRET; do
  printf '%s: ' "$s"
  gcloud secrets versions access latest --secret="$s" | head -c 8; echo '…'
done
```

### 8c. Post-deploy smoke test (do not skip)

App Check (step 2) and the Secret Manager values both fail **silently or totally**
at runtime while every CI check stays green — the same failure shape as the retired
model id that was serving canned fallback text. Confirm on a real device from the
`internal` track:

1. Ask one question and read the result. If it opens *"The scrolls of this moment
   have not opened their seal…"* the synthesis call failed — `ANTHROPIC_API_KEY` is
   missing from Secret Manager, or the model id is wrong again. A real reading is
   unique prose referencing the chart.
2. Watch the function logs while you do it:
   ```bash
   firebase functions:log --only askOracle
   ```
   `oracle synthesis HTTP error` with `status: 404` means the model id; `401` means
   the key. An App Check rejection fails the whole call before it reaches synthesis.
3. Confirm a reading appears in History (Firestore write path) and that a
   subscription purchase in a Play test track flips the plan.

---

_Last updated: 2026-08-13_
