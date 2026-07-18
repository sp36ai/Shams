# Google Play — Data Safety mapping

Evidence-based mapping of what the app actually collects, stores, and shares,
to guide the **Play Console → App content → Data safety** form. Every row is
grounded in code; update this file whenever data flows change.

Package: `com.astrosarfaraz.shamsalasrar`

> This is an internal worksheet, not a legal document. The user-facing policy is
> `hosting/privacy-policy.html`; deletion instructions are
> `hosting/data-deletion.html`.

---

## 1. Data the app collects / transmits off the device

| Data type | Collected? | Stored server-side? | Linked to user | Purpose | Evidence |
|---|---|---|---|---|---|
| **Email address** | Yes | Yes (Firebase Auth) | Yes | Account management | Firebase Auth (email/password + Google sign-in) |
| **Precise location** (lat/lon) | Yes | Yes (`/readings`: `lat`, `lon`, `chartAt`) | Yes | App functionality — casts the horary chart | `askOracle.ts` reading doc |
| **User content — question text** | Yes | Yes (`/readings.question`, raw) | Yes | App functionality — the reading | `askOracle.ts`; audit log stores only a hash |
| **Name** (seeker + mother's name) | Yes (transmitted) | **No** (device-only) | Yes | App functionality — personalises the reading voice | Stored in MMKV only; sent transiently to the AI provider, never persisted server-side |
| **Purchase history** | Yes | Yes (`/playPurchaseTokens`, token hash) | Yes | App functionality + fraud prevention | Google Play Billing; `googlePlay.ts` |
| **Crash logs & diagnostics** | Yes | Yes (Crashlytics) | Pseudonymous | Stability / diagnostics | `ErrorBoundary.tsx` → Crashlytics |
| **IP address** | Transient only | **No raw IP** — only a truncated SHA-256 hash | Pseudonymous | Security / rate limiting | `requestMeta.ts`; audit logs store `ipHash` only |
| **App activity** (verdict, timestamps, user-agent) | Yes | Yes (`/auditLogs`, opaque userId) | Pseudonymous | Security / abuse detection | `askOracle.ts` audit log |

Notes:
- **Names are never stored server-side.** They live in on-device MMKV and are
  cleared on account deletion; they are sent to the AI provider only for the
  duration of a request.
- **Raw IP is never persisted** — the audit log keeps a truncated hash
  (`ipHash`) for correlation; the raw address is used in-memory for rate
  limiting and discarded.

---

## 2. Data sharing (third parties / processors)

| Recipient | Data received | Role | Notes |
|---|---|---|---|
| **Google Firebase** (Auth, Firestore, Functions, Crashlytics, App Check) | Email, location, question text, purchase-token hash, crash logs | Infrastructure processor | Google is the backend platform |
| **Anthropic (Claude API)** | Sanitised seeker/mother name (reading synthesis) + question text (follow-up intent classification) | AI processor | `askOracle.ts`, `classifyIntent.ts`; used to generate text, not to profile the user |

The app does **not** sell data and does **not** share data for advertising.

---

## 3. Security & user controls (Data safety "Security practices")

- **Encrypted in transit:** Yes — all traffic is HTTPS/TLS; the app talks only
  to Firebase and the Anthropic API over TLS.
- **Users can request data deletion:** Yes — in-app (Settings → Account →
  Delete account, `deleteAccount` Cloud Function) and via a public URL
  (`hosting/data-deletion.html`). Declare this URL in the Play Console.
- **Users can request that data be deleted:** in-app deletion removes readings,
  quota, trial, on-device profile/location, and the Auth account. A minimal,
  pseudonymous fraud/abuse trail (opaque userId, no readable personal content)
  is retained.

---

## 4. Suggested Play Console answers (summary)

- Does your app collect or share any of the required user data types? **Yes.**
- Is all user data encrypted in transit? **Yes.**
- Do you provide a way for users to request that their data be deleted?
  **Yes** — in-app + `https://shams-app-4d0e7.web.app/data-deletion.html`.
- Data types to declare as **collected**: Email, Precise location,
  User-generated content (questions), Name, Purchase history, Crash logs,
  Diagnostics, App interactions.
- Data types to declare as **shared**: the subset sent to Anthropic
  (Name, User-generated content) — declare as processing by a service provider.
- Advertising / marketing use: **None.**
