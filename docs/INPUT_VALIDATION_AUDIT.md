# Input-Validation Completeness — Audit

## Two validation styles

**Strict Zod schemas** (`middleware/validate.ts`, `parse()`): `askOracle`,
`syncReadings`, `deleteReading`, `verifyGooglePlayPurchase`. These are solid —
`.strict()` rejects extra keys, every string is length-bounded, lat/lon are
`z.number().min().max()` (which also reject `NaN`/`Infinity`, since those fail
the comparison), lang is an enum, and failures throw a structured
`invalid-argument`.

**Manual defensive reads** (`request.data` cast + type guards + `.slice()`):
`classifyIntent`, `classifyQuestion`, `inferProfile`, `selectRemedies`,
`setAdminClaim`. These never crash on malformed input (non-strings coerce to
`''`/defaults, arrays are `Array.isArray`-guarded and length-sliced), but some
string fields that flow into LLM prompts were **uncapped**.

## Findings

### Uncapped prompt inputs — FIXED
- **`selectRemedies`**: candidate `title`/`category`/`effectDimension`/
  `intensity`/`themeTags` items, `oracleContext.*`, and `readingId` were
  unbounded. A client could send oversized values that inflate the Sonnet
  selection prompt and Haiku description prompts (cost). Now every field is
  length-capped via a `cap()` helper (title 120, tags ≤12×40, summary 500, …).
- **`classifyIntent`**: each `recentMessages` item and `verdictDirection` were
  unbounded (they feed the classifier prompt). Now capped (500/item, 40).

Impact was minor — self-inflicted per user, and the remedy description already
passes the Islamic guard — but it removes a client-controlled prompt-size/cost
vector.

### Verified safe (no change)
- `getQuota`, `activateTrial`, `deleteAccount` read **no client data** (operate
  on `request.auth.uid` only).
- `classifyQuestion` (text ≤1000, rejects >500) and `inferProfile` (3 answers ×
  ≤200) were already fully bounded.
- `razorpayWebhook` verifies HMAC over `rawBody` before touching fields;
  `setAdminClaim` is admin-gated and checks `targetUid`/`isAdmin` types.
- `z.number()` bounds reject `NaN`/`Infinity` on all coordinate inputs.

## Recommendation (not changed)
Standardize the manual-validation callables on Zod schemas in
`middleware/validate.ts` for consistency (strict extra-key rejection +
structured errors). Lower priority now that the fields are bounded and the reads
are crash-safe.
