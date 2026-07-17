# Secrets & Config Management — Audit

## Verified sound

- **Secrets via Secret Manager.** All real secrets — `RAZORPAY_WEBHOOK_SECRET`,
  `GOOGLE_PLAY_CLIENT_EMAIL`, `GOOGLE_PLAY_PRIVATE_KEY`, `ANTHROPIC_API_KEY` —
  are `defineSecret()` bindings (Google Secret Manager), never hardcoded and
  never in `.env`. `RATE_LIMIT_PER_MINUTE` is a non-secret `defineInt` param.
- **No secrets in git.** The only tracked `.env` (`functions/.env.shams-app-4d0e7`)
  contains one non-secret line (`RATE_LIMIT_PER_MINUTE=10`) with a header
  stating secrets go through Secret Manager. `.gitignore` covers `*.keystore`,
  `*.jks`, `*.pem`, `.env*`, and the real `google-services.json`, with explicit
  allow-exceptions only for the example/CI-placeholder files. The real
  `google-services.json` is not tracked; `google-services.json.ci` carries
  `CI_PLACEHOLDER_KEY_NOT_FOR_PRODUCTION`.
- **App Check** uses the `debug` provider only under `__DEV__` and **Play
  Integrity** in production, with token auto-refresh enabled — debug attestation
  can never ship in a release build.
- **Certificate pinning is wired** (`network_security_config.xml`):
  `cleartextTrafficPermitted="false"` in the base config, a `pin-set` (2 SHA-256
  pins) over `firestore/firebase/identitytoolkit.googleapis.com`, and a
  debug-only NSC that permits cleartext solely to localhost/emulator IPs and
  lives in `src/debug/` (never in a release AAB).

## Flagged (awareness / maintenance — not changed)

1. **Pin coverage excludes the callable Functions domain.** The pin-set covers
   the Firebase SDK endpoints, but `askOracle`/payments/etc. are v2 callables
   served from `*.run.app` / `cloudfunctions.net`, which are **not pinned**. That
   is the most sensitive app→backend traffic. Extending the pin-set there is a
   deliberate trade-off: Cloud Run uses shared, frequently-rotated Google infra,
   so pinning it raises the risk of bricking the app on a cert rotation. Decide
   consciously; if pinned, include a backup pin and a tight rotation process.
2. **Pins expire 2027-05-01.** Android silently **stops enforcing** an expired
   `pin-set` (falls back to system trust), so this is a hard maintenance
   deadline: re-capture and ship new pins before then. Confirm one of the two
   pins is a backup (intermediate CA) so a leaf-cert rotation doesn't break
   connectivity before an app update can land.

No code change: the configuration is correct, and adding function-domain pins
without verified hashes would risk connectivity. These are operational items.
