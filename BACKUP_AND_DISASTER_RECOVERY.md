# Backup & Disaster Recovery — Shams al-Asrār

**Status as of 2026-08-23:** No backup policy exists. This document was written to
close that gap — see `PRODUCTION_AUDIT_2026-08-23.md` §16 for how the gap was found
(a repo-wide search for "backup"/"RPO"/"RTO" across 20+ docs turned up nothing but one
manual, undocumented `firebase auth:export` command in `MANUAL_ACTIONS_REQUIRED.md`).

**This document defines the policy and the exact steps to implement it. It does not
implement it** — enabling backups requires GCP project-owner/editor access to
`shams-app-4d0e7`, which the session that wrote this document does not have. Whoever
holds that access should work through §2–§4 below, then update the Status line above.

---

## 1. Recovery targets

Proposed, not yet ratified — the actual numbers are a business decision (how much data
loss and how much downtime the product can tolerate), not a purely technical one. These
are defensible defaults for an early-stage app (current `versionCode` is 4) with paid
subscriptions and no current backup coverage at all; revisit them as the user base and
revenue grow.

| | Target | Rationale |
|---|---|---|
| **RPO** (Recovery Point Objective — how much data can be lost) | **≤ 24 hours**, tightening to **≤ 1 hour** once paid-subscriber volume justifies the added cost of continuous Point-in-Time Recovery (§2) | A day of lost readings/quota state is a bad-but-survivable incident today. A day of lost *payment/entitlement* state is not — this is the strongest argument for moving to PITR sooner rather than later once there's real subscription revenue to protect. |
| **RTO** (Recovery Time Objective — how long restoring takes) | **≤ 4 hours** to a restored, verified, cut-over database | Firestore restores are not instant (§4) — budget real time for the restore operation itself, verification, and the app-side steps in §4.4. |

## 2. Enable backups (do this first — it's the actual gap)

Firestore's native scheduled-backup feature is the right tool here: no Cloud Scheduler
job or custom export function to build and maintain, backups are stored redundantly by
Google independent of the live database, and restoring creates a **new** database rather
than overwriting the live one (important — see §4).

```bash
# Confirm the exact command syntax first — `gcloud firestore backups` is an actively
# evolving surface; run --help before relying on the exact flags below.
gcloud firestore backups schedules create --help

# Daily backups, retained 7 days — the RPO=24h target from §1. Adjust
# --project if the Firestore database is not in the default project context.
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=daily \
  --retention=7d \
  --project=shams-app-4d0e7

# Weekly backups, retained longer (90d) — cheap insurance against a slow-to-
# notice corruption that a 7-day daily retention window has already rolled
# past by the time someone spots it.
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=weekly \
  --retention=90d \
  --project=shams-app-4d0e7
```

Verify both schedules are active:

```bash
gcloud firestore backups schedules list --database='(default)' --project=shams-app-4d0e7
```

**Firebase Auth** has no equivalent native scheduled-backup feature. Until one is
scripted (a small Cloud Scheduler + Cloud Function pair, or a scheduled CI job, running
`firebase auth:export`), run this manually on a monthly cadence at minimum, and store the
output somewhere access-controlled (not committed to this repo — it contains real user
records):

```bash
firebase auth:export auth-backup-$(date +%Y-%m-%d).json --project shams-app-4d0e7
```

A Firebase Auth loss is a materially smaller RPO concern than Firestore: it changes far
less often (new sign-ups only) and every currently-active user's session/credentials are
also cached client-side, so a same-day restore from a monthly export loses only sign-ups
from that window, not active users' ability to use the app immediately.

## 3. Point-in-Time Recovery (upgrade path, once justified)

If §1's tightened RPO target (≤ 1 hour) becomes the actual requirement, enable Firestore
PITR instead of (or alongside) scheduled backups — it allows recovery to any minute
within a rolling 7-day window, not just the last daily/weekly snapshot:

```bash
gcloud firestore databases update '(default)' \
  --enable-point-in-time-recovery \
  --project=shams-app-4d0e7
```

This has an ongoing storage cost proportional to write volume — confirm current pricing
before enabling; it is not a drop-in free upgrade over scheduled backups.

## 4. Restore procedure

**A backup that has never been restored is not a proven backup.** §5 is the drill that
proves this procedure actually works — do not treat this section as sufficient on its
own until §5 has been run at least once.

### 4.1 — Identify what needs restoring

Before touching anything: what's the actual failure? "Firestore mistake, data deleted"
(the audit's own framing) covers a wide range — a single collection accidentally wiped
by a bad script, a bad deploy that corrupted documents, or a full database-level
disaster. The scope of the restore should match the scope of the failure; a full-database
restore for a single-collection problem is riskier and slower than it needs to be.

### 4.2 — Restore into a NEW database, never over the live one

```bash
gcloud firestore backups list --project=shams-app-4d0e7
# copy the backup name from the output, then:

gcloud firestore databases restore \
  --source-backup=<BACKUP_NAME_FROM_ABOVE> \
  --destination-database='shams-restore-verify' \
  --project=shams-app-4d0e7
```

Restoring into a fresh, separate database (not overwriting `(default)`) means the live
app keeps running against real (if incomplete/corrupted) data while the restored copy is
verified — an unverified restore that turns out to be from a bad backup should never be
what a user-facing incident depends on sight-unseen.

### 4.3 — Verify before cutover

- Spot-check a sample of `/users`, `/quotas`, `/readings` documents in the restored
  database against what's expected for that point in time.
- Confirm `/purchaseTokens` bindings are intact — a restore that silently drops these
  reopens the token-replay window §5 of `payments/googlePlay.ts`'s design closes.
- Run `firestore.rules.test.ts` against the restored database's emulator config if
  feasible, as a sanity check that the data shape itself is intact.

### 4.4 — Cut over

1. Point Cloud Functions' Firestore client at the restored database (requires a
   config/env change — `functions/src/utils/admin.ts` currently initializes against the
   default database; this is the one piece of code that would need a database-id
   parameter added if a non-default-name cutover is ever needed for real, not just
   during a drill against a throwaway verification database).
2. Confirm `askOracle`/`askWatchOracle`/payment webhooks are healthy against the restored
   data (call `health` — see `functions/src/functions/health.ts`).
3. Communicate the incident and the actual data-loss window (whatever the gap is between
   the failure and the backup's timestamp) to affected users if the RPO target in §1 was
   missed for this incident.
4. Once confirmed stable, decommission the old (broken) database and rename/promote the
   restored one, or repoint config permanently — exact mechanics depend on which failure
   mode triggered this.

## 5. The restore drill (do this — an unproven backup is not a backup)

Schedule this quarterly, not just once:

1. Trigger an on-demand backup export (or wait for the next scheduled one).
2. Run the full restore procedure in §4 against a throwaway verification database name.
3. Time it — this is where the RTO target in §1 gets validated against reality, not
   assumed.
4. Verify per §4.3.
5. **Delete the verification database** when done (it's a live Firestore database and
   costs money to leave running, and is a second copy of user data to keep secured).
6. Record the drill date, duration, and outcome somewhere durable (this file, or wherever
   the team tracks operational runbooks) — the record is what makes "we test our
   backups" a checkable claim instead of an assertion.

| Drill date | Duration | Outcome | Notes |
|---|---|---|---|
| _(none yet — first drill still pending)_ | | | |
