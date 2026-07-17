# Observability & Error Hygiene — Audit

## Finding — PII leaked into server logs (FIXED)

`askOracle` logged the full synthesised `oracle` object at info level on **every
reading**:

```
logger.info('oracle synthesis', { userId, oracle });
```

The oracle prose deliberately **weaves in the seeker's name and mother's name**
(per `oracleSynthesisPrompt.ts`), so this wrote raw PII into Cloud Logging —
directly violating this logger's own "never log raw PII" contract, and
inconsistent with the rest of the pipeline (question text is FNV-1a hashed, IPs
are hashed). **Fixed:** it now logs only non-PII shape metadata
(`hasOracleVoice`, `remedyReplaced`).

## Verified clean

- `oracle computed` logs only metadata (verdict, confidence, significators,
  plan, durationMs, `ipHash`) — no prose, no names, no raw IP.
- Question text is FNV-1a hashed before logging (`hashText`); raw IP is never
  logged (only `ipHash`, fixed in an earlier pass).
- **Crashlytics**: render-tree errors are reported via `ErrorBoundary`
  (`recordError`); native crashes and unhandled JS errors are auto-captured by
  `@react-native-firebase/crashlytics`. No `setUserId` is set — crashes aren't
  correlated to a user, which is privacy-positive.

## Flagged (awareness / recommend — not changed)

- **Parse-failure diagnostic** (`oracle synthesis JSON parse failed`) logs
  `rawText.slice(0, 200)`. This is a rare error path and the payload is usually
  malformed/non-prose JSON, but it could in principle include a woven name.
  Acceptable as truncated error-path diagnostics; tighten only if log-privacy
  requirements harden.
- **No alerting** on `securityEvents` (e.g. razorpay_invalid_signature) or the
  new cost/abuse signals (`remedy guard` replacements, quota exhaustion). Add
  **log-based metrics + Cloud Monitoring alerts** (e.g. alert on a spike in
  invalid signatures or remedy-guard hits) — an infra/console step, no code.
- Consider a lightweight structured field (already present: `durationMs`) driving
  a latency SLO alert on `askOracle`.
