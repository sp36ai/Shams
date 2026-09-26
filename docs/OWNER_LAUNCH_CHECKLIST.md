# Owner Launch Checklist — Nov 1 Play Store Deadline

Four items block launch that no commit can complete — each needs your
credentials or console access. This is the exact, turnkey sequence for each.
None of these steps are run from this environment; do them from your own
machine/network.

---

## 1. Real `google-services.json` (Priority 1)

**Why it blocks launch:** `android/app/google-services.json.ci` is a
structure-valid placeholder (`CI_PLACEHOLDER_KEY_NOT_FOR_PRODUCTION`,
project number `000000000000`) used only so CI can compile. A release build
must use the real file or Firebase Auth/Firestore/App Check calls fail for
every real user.

**Steps:**
1. [Firebase Console](https://console.firebase.google.com) → project
   `shams-app-4d0e7` → ⚙️ Project settings → your apps → the Android app
   (`com.astrosarfaraz.shamsalasrar`) → **Download `google-services.json`**.
2. Save it to `android/app/google-services.json` **locally only** — this
   path is gitignored (`.gitignore` excludes `google-services.json`, keeps
   the `.ci` placeholder). Never commit the real file.
3. Verify it has real values, not zeros:
   ```bash
   grep -q '"project_number": "000000000000"' android/app/google-services.json && \
     echo "STILL A PLACEHOLDER — download failed or wrong file" || \
     echo "OK — looks like the real file"
   ```
4. Build a release bundle locally to confirm it compiles against the real
   config (see §2 below for the signing half of this same build):
   ```bash
   npm run bundle:android
   ```

---

## 2. Play Store upload keystore (Priority 2)

**Why it blocks launch:** `android/app/build.gradle`'s release
`signingConfig` (lines ~78-98) now hard-fails any `assembleRelease`/
`bundleRelease` task unless `SHAMS_UPLOAD_STORE_FILE`,
`SHAMS_UPLOAD_STORE_PASSWORD`, `SHAMS_UPLOAD_KEY_ALIAS`,
`SHAMS_UPLOAD_KEY_PASSWORD` are set — by design, so a real release can
never silently fall back to debug signing. You need a real keystore to
supply those.

**Steps:**
1. Generate the keystore (do this once, ever — losing it means you can
   never update the app again under the same listing):
   ```bash
   keytool -genkeypair -v \
     -keystore shams-upload.p12 \
     -storetype PKCS12 \
     -alias shams-upload \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
   You'll be prompted for a store password, your name/org details, and a
   key password (can be the same as the store password for PKCS12).
2. **Back it up immediately**, in at least two places outside this repo —
   e.g. a password manager's file storage and a private cloud drive.
   Google Play's "Play App Signing" also lets you upload this once and
   have Google manage the actual signing key thereafter, which is the
   safer long-term option; either way, this upload key is still required
   at least once and must never be lost before then.
3. Add to `~/.gradle/gradle.properties` (create it if it doesn't exist —
   this file lives outside the repo, never commit it):
   ```properties
   SHAMS_UPLOAD_STORE_FILE=/absolute/path/to/shams-upload.p12
   SHAMS_UPLOAD_STORE_PASSWORD=<your store password>
   SHAMS_UPLOAD_KEY_ALIAS=shams-upload
   SHAMS_UPLOAD_KEY_PASSWORD=<your key password>
   ```
4. Build and verify it's really release-signed, not debug:
   ```bash
   npm run bundle:android
   # AAB lands at android/app/build/outputs/bundle/release/app-release.aab
   jarsigner -verify -verbose -certs \
     android/app/build/outputs/bundle/release/app-release.aab | head -20
   # Confirm the signer CN is yours, not "Android Debug"
   ```

---

## 3. Firestore TTL policy on `idempotencyKeys` (Priority 3)

**Why it matters:** every `askWatchOracle` call (a paid reading) writes a
dedup record to `idempotencyKeys` so a retry after a dropped connection
replays the original result instead of charging and casting twice
(`functions/src/utils/idempotency.ts`). Each record carries `expiresAt`
24h out, but Firestore only acts on it once a TTL policy names that field.
Without it, the collection just grows forever — not a correctness bug on
its own, but worth closing before real payment volume.

**Steps:**
1. [Firebase Console](https://console.firebase.google.com) → Firestore
   Database → **Time-to-live (TTL)** tab → **Create policy**:
   - Collection group: `idempotencyKeys`
   - Timestamp field: `expiresAt`
2. **Test the actual payment/idempotency flow** (do this against a real or
   emulated environment, with a real or test payment account):
   - Ask the Oracle a question once. Confirm exactly one reading is
     created and exactly one quota slot/charge is deducted.
   - Immediately retry the *same* client action (e.g. re-tap submit before
     the response returns, or kill/relaunch the app mid-request and let it
     retry with the same `requestId`). Confirm: no second charge, no
     second reading, and the *original* response is replayed.
   - In Firestore, confirm the `idempotencyKeys` document for that
     `requestId` shows `status: "done"` and has an `expiresAt` ~24h out.
   - (Optional, once TTL is live) confirm documents older than 24h are
     actually being swept — TTL deletion can take up to 24h after
     expiration to actually execute, so this is a "days later" check, not
     a launch-blocking one.

---

## 4. Certificate pin refresh (Priority 4)

**Why this needs a real network:** `android/app/src/main/res/xml/network_security_config.xml`
pins `firestore.googleapis.com`, `firebase.googleapis.com`, and
`identitytoolkit.googleapis.com` to two SHA-256 public-key hashes,
expiring 2027-05-01 (`scripts/check-cert-pin-expiry.mjs` now fails CI 90
days before that date so it can't be silently forgotten). These hashes
must be regenerated from a real, unproxied network — **not** from inside
this Claude Code session, whose outbound traffic here goes through
Anthropic's own TLS-terminating egress proxy and would produce hashes for
that proxy's certificate, not Google's.

**Steps (run from your own machine):**
1. For each pinned domain, fetch the current leaf cert's public-key hash:
   ```bash
   for domain in firestore.googleapis.com firebase.googleapis.com identitytoolkit.googleapis.com; do
     echo "=== $domain ==="
     openssl s_client -connect "$domain:443" -servername "$domain" </dev/null 2>/dev/null \
       | openssl x509 -pubkey -noout \
       | openssl pkey -pubin -outform der \
       | openssl dgst -sha256 -binary \
       | openssl enc -base64
   done
   ```
2. Also capture the **intermediate CA's** hash (one level up the chain) as
   a backup pin — this is what actually gives resilience against Google
   rotating the leaf cert before 2027, since intermediates change far less
   often:
   ```bash
   openssl s_client -connect firestore.googleapis.com:443 -showcerts </dev/null 2>/dev/null \
     | awk 'BEGIN{c=0} /BEGIN CERT/{c++} {print > ("cert"c".pem")}'
   openssl x509 -in cert2.pem -pubkey -noout \
     | openssl pkey -pubin -outform der \
     | openssl dgst -sha256 -binary \
     | openssl enc -base64
   ```
3. Compare against the two hashes already in
   `network_security_config.xml`. If they've already rotated, update the
   `<pin>` entries and bump `<pin-set expiration="...">` forward (12 months
   out is reasonable); if they still match, no code change is needed —
   just note the verification date somewhere (e.g. a comment in the file).
4. Re-run `npm run check:cert-pin-expiry` locally to confirm the check
   still passes after any change.

---

## What NOT to do

- Never commit `google-services.json` (real one), the `.p12`/`.jks`
  keystore, or `~/.gradle/gradle.properties` to this repo.
- Never paste passwords, key aliases, or the keystore file itself into a
  chat message to this or any AI assistant.
- Production Cloud Functions deploys (`firebase deploy --only functions`)
  and the actual Play Store upload are separate, explicit steps — not
  something that happens as a side effect of merging a PR to `main`.
