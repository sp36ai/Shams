# Firestore Growth, Indexes & Cost — Audit

## Indexes vs. actual queries

Server queries in the codebase:
- `readings.where(userId ==).limit(400)` — account deletion paging (single-field
  `userId`, served by the automatic index).
- `auditLogs.where(razorpayPaymentId ==).limit(1)` — Razorpay idempotency
  (single-field, automatic index).
- Doc get/set by id everywhere else.

The client keeps reading history **entirely local (MMKV)** — it never queries
the `readings` collection in Firestore.

**Change:** removed the two `readings` composite indexes on
`userId+verdict+createdAt` and `userId+category+createdAt`. Nothing — server or
client — filters readings by verdict or category, so they only added
write-amplification on every reading insert. Kept `userId+createdAt` (the
natural "list my readings newest-first" index) as a conservative allowance for a
future/admin listing. Restoring an index is a one-line redeploy if ever needed.

## Retention / unbounded growth

| Collection | Growth | TTL | Verdict |
|---|---|---|---|
| `rateLimits` | 1 doc/user/minute | **✅ `expiresAt` TTL** (fieldOverride) | self-cleans |
| `auditLogs` — `oracle_computed` | 1/reading (dominant) | **✅ now 90-day `expiresAt`** | fixed here |
| `auditLogs` — payment/security/deletion | low volume | none (deliberate) | fraud/financial trail, retained |
| `securityEvents` | abuse events only | none | low volume; optional TTL |
| `readings` (server copy) | 1/reading, per user, forever | none | see below |
| `playPurchaseTokens` | 1/purchase token | none (deliberate) | replay defense, bounded |
| `quotas` / `trials` | 1/user | n/a | bounded |

**Change — auditLogs TTL:** the high-volume operational log (`oracle_computed`,
one per reading) now carries a 90-day `expiresAt`, and `firestore.indexes.json`
declares the TTL fieldOverride. Firestore TTL only deletes docs that *have* the
field, so the payment/security/deletion audit entries (which omit it) are
retained indefinitely — matching the fraud/financial-record stance in
`docs/PLAY_DATA_SAFETY.md`. This caps the dominant growth driver.

## Open (recommend, not changed)

- **Server `readings` grow unbounded** — every reading is persisted server-side
  forever, for every user including free. The client only caches `CACHE_LIMIT`
  locally. If the "full archive" is a paid feature, consider a retention cap for
  free/expired accounts (e.g. TTL on free-tier readings, or trim beyond N).
  Left as a product decision — deleting a user's readings changes a
  user-visible feature.
- **`securityEvents`** could take the same `expiresAt` TTL treatment if its
  volume ever grows; currently negligible.

## Verified fine
- `rateLimits` TTL correctly declared and keyed by UTC-minute (old docs never
  read).
- No unbounded/unindexed scans; the two `.where` queries are single-field and
  auto-indexed.
