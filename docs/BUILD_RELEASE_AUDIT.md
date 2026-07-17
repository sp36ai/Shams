# Build & Release Pipeline — Audit

## Verified sound

- **Signing** comes entirely from CI secrets: the keystore is base64-decoded
  from `BASE64_KEYSTORE`, store/key passwords + alias from secrets, and the
  keystore file is deleted afterwards with `if: always()`. No signing material
  is committed (`.gitignore` covers `*.jks`/`*.keystore`).
- **Release minification**: `minifyEnabled true` + `shrinkResources true` with
  `proguard-android-optimize.txt` + `proguard-rules.pro` (R8 optimized).
- **Crashlytics** gradle plugin is applied (`firebase-crashlytics-gradle:3.0.2`),
  which auto-uploads the R8 mapping file so Java/Kotlin stack traces
  deobfuscate.
- **Play deploy**: `r0adkll/upload-google-play` with a service-account secret;
  production rolls out **staged at 10%** (`inProgress` / `userFraction 0.1`),
  other tracks complete immediately. `versionCode` = `github.run_number`
  (monotonic). AAB manifest (sdk/version) is verified with bundletool before
  upload, and the AAB is archived for 30 days.
- Fonts are provisioned in CI (not committed) so the AAB ships real fonts.

## Changed

- **Removed the "List keystore aliases (diagnostic)" step.** It ran `keytool`
  with the store password inline on every release — an unnecessary
  secret-handling surface and log noise with no build value. (GitHub masks
  secret values in logs, but the step served no purpose in the pipeline.)

## Flagged (awareness — not changed)

- **Release signing falls back to debug.** `signingConfig hasReleaseSigning ?
  signingConfigs.release : signingConfigs.debug` — a local `./gradlew
  bundleRelease` without the `-P` signing properties produces a *debug-signed*
  "release" AAB. CI always passes them, and Play rejects debug-signed uploads,
  so it's caught downstream — but it's a footgun. Consider failing the release
  build loudly when release signing is absent (except for explicitly local
  builds).
- **Signing passwords are passed as `-P` command-line args.** GitHub masks them,
  but `ORG_GRADLE_PROJECT_SHAMS_*` env vars keep secrets out of the process
  argument list entirely — a cleaner pattern.
- **Native (NDK) symbol upload is not enabled** (`nativeSymbolUploadEnabled`).
  Native crashes would be unsymbolicated; low impact for an RN/Hermes app with
  little custom native code. Enable in a `firebaseCrashlytics { }` release block
  if native crash visibility is needed. JS/Hermes crash symbolication similarly
  needs the Hermes source map uploaded — a known RN gap to revisit if JS crash
  readability matters.
