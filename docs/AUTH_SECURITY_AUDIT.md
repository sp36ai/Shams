# Auth & Session Security — Audit

## Verified sound (no change needed)

- **App Check** is enforced on **every callable** (`enforceAppCheck` gated only
  by the emulator flag). The two HTTP endpoints are correctly exempt: the
  Razorpay webhook is secured by HMAC signature, and `health` is a status probe.
- **`verifyAuth`** requires `request.auth` in production; the `dev-test-user`
  bypass is gated by `FUNCTIONS_EMULATOR`, which is never set in deployed
  functions.
- **`setAdminClaim`** is properly guarded — it requires the caller to already
  have `token.admin === true`, the first admin is bootstrapped via the Firebase
  CLI, and it merges (never clobbers) existing claims. No privilege-escalation
  path.
- **Plan claim is not a trust boundary.** The `plan` / `planExpiry` **custom
  claims** are written on purchase but are **never read for gating** anywhere in
  functions or `firestore.rules`. All entitlement checks use the `quotas/{uid}`
  document, which re-checks `planExpiry` at read time. So a stale plan claim in
  a not-yet-refreshed token cannot grant access. Only the `admin` claim is used
  for authorization (in rules), and that is managed solely by `setAdminClaim`.
- **Email is not an authorization key.** `verifyAuth` returns `email`, but no
  function makes an access decision based on it — authorization is by `uid`
  only. So an unverified/spoofable email cannot be used to escalate.
- **Password reset** uses Firebase's `sendPasswordResetEmail` (secure,
  out-of-band). Account deletion invalidates the session via `auth.deleteUser`.

## Finding — email verification was never sent or enforced

The signup flow created the account and set `displayName` but never called
`sendEmailVerification`, and nothing checks `emailVerified`. Because email is
not an authz key, this is **not a security hole** — but it is an
**abuse/cost surface**: an unverified account immediately gets 3 free readings/
day plus the 7-day trial (5/day), each fanning out to a paid Opus call (see
`docs/COST_CONTROLS_AUDIT.md`). App Check + Auth blunt automated mass signup,
but scripted account creation with valid App Check tokens is still possible.

**Changed:** signup now sends a verification email (non-fatal — signup never
fails if the send hiccups; Google sign-in accounts are already verified). This
establishes `emailVerified` so it can be used as a gate.

**Recommended (product decision — not imposed):** gate the highest-value
abuse target — **trial activation** (`activateTrial`) — behind
`request.auth.token.email_verified === true`. That protects ~35 Opus readings
per fresh account (5/day × 7 days) at the cost of one verification step before
the trial. Free-tier gating (3/day) is optional and higher-friction; decide per
the abuse tolerance.

## Residual notes
- No server-side session-revocation-on-security-event mechanism, and none is
  needed at this scale (deletion + Firebase's own token lifetime suffice).
- Google sign-in path verifies the ID token via Firebase and inherits Google's
  verified email — no extra verification needed there.
