# Release Readiness — Shams al-Asrār

Consolidated index of the audit engagement on branch
`claude/shams-auth-ui-audit-54yz9g`. Each domain links to its detailed report.

**Test status:** 91 app + 23 functions + 39 Firestore-rules = **153 tests, all
green**; `tsc` + `eslint` clean on both packages.

---

## Audit domains

| Domain | Report | Outcome |
|---|---|---|
| Payments & subscription lifecycle | [PAYMENTS_AUDIT](./PAYMENTS_AUDIT.md) | Fixed Razorpay renewals; Play RTDN documented |
| Rate-limiting & LLM cost | [COST_CONTROLS_AUDIT](./COST_CONTROLS_AUDIT.md) | Added `maxInstances`; circuit-breaker recommended |
| Firestore growth & cost | [FIRESTORE_COST_AUDIT](./FIRESTORE_COST_AUDIT.md) | TTL on operational logs; dropped unused indexes |
| Dependencies / supply-chain | [DEPENDENCY_AUDIT](./DEPENDENCY_AUDIT.md) | Cleared all high/critical from Functions runtime |
| Auth & session security | [AUTH_SECURITY_AUDIT](./AUTH_SECURITY_AUDIT.md) | Sound; added signup verification email |
| Secrets & config | [SECRETS_CONFIG_AUDIT](./SECRETS_CONFIG_AUDIT.md) | Verified sound; cert-pin maintenance flagged |
| Observability & error hygiene | [OBSERVABILITY_AUDIT](./OBSERVABILITY_AUDIT.md) | Fixed PII-in-logs leak |
| Build & release pipeline | [BUILD_RELEASE_AUDIT](./BUILD_RELEASE_AUDIT.md) | Removed keystore diagnostic; footguns flagged |
| KP judgment-rules correctness | [JUDGMENT_RULES_AUDIT](./JUDGMENT_RULES_AUDIT.md) | Faithful to ruleset; locked with conformance test |
| Input-validation completeness | [INPUT_VALIDATION_AUDIT](./INPUT_VALIDATION_AUDIT.md) | Capped client strings feeding LLM prompts |
| Performance & bundle size | [PERFORMANCE_AUDIT](./PERFORMANCE_AUDIT.md) | Removed 2 MB orphaned asset |
| Play data-safety mapping | [PLAY_DATA_SAFETY](./PLAY_DATA_SAFETY.md) | Evidence-based form worksheet |

Earlier in the engagement: auth + UI hardening, account deletion, Hindi removal
+ full en/ur localization + RTL, Islamic-only remedy enforcement, and the
Firestore security-rules test harness (now 39 assertions in CI).

---

## Notable bugs fixed (code, not just documented)

- **Play purchase-token replay** — one valid token could upgrade unlimited
  accounts (sha256→Firestore binding).
- **Raw IP persisted** to audit logs despite the "never raw IP" contract.
- **Oracle prose PII in logs** — seeker/mother names written to Cloud Logging on
  every reading.
- **Razorpay renewals dropped** — paying subscribers downgraded at first renewal.
- **Unbounded autoscaling** — no ceiling on concurrent paid Opus calls.
- **High/critical CVEs** in the deployed Functions runtime (grpc/protobuf/…).
- **Offline errors** mislabeled as the mystical "sealed" message.
- **Uncapped client strings** feeding LLM prompts (cost vector).
- **2 MB orphaned image** asset.
- Full content-policy overhaul: **Hindi removed**, Vedic terms hidden,
  **remedies enforced Islamic-only** with a deterministic guard.

## Verified sound (no change needed)

KP judgment correctness (vs Sarfaraz ruleset), astronomical accuracy (vs
external anchors), auth/session security model, secrets & signing hygiene, and
certificate pinning.

---

## Owner action checklist (cannot be done in code)

**Play Console**
- [ ] Fill the **Data Safety form** to match [PLAY_DATA_SAFETY](./PLAY_DATA_SAFETY.md).
- [ ] Set up **Real-time Developer Notifications** (Pub/Sub) for Google Play
      subscription renewals — see [PAYMENTS_AUDIT](./PAYMENTS_AUDIT.md).

**On-device**
- [ ] Urdu **RTL + TalkBack** walkthrough of the localized screens.
- [ ] **Cold-start / AAB-size** profiling.

**Product decisions**
- [ ] Global daily **cost circuit-breaker** (fallback to non-Opus on breach).
- [ ] Whether to route **free/trial synthesis to a cheaper model**.
- [ ] Whether to **gate trial activation on `email_verified`**.

**Ops / maintenance**
- [ ] Rotate the **cert pins before 2027-05-01** (Android stops enforcing
      expired pin-sets); confirm one is a backup pin.
- [ ] Add **Cloud Monitoring alerts** on `securityEvents` + remedy-guard hits.
- [ ] Schedule **`firebase-admin` ^12→^13 / `firebase-functions` ^5→^6** and
      **`vitest`@4** upgrades (residual moderate/dev advisories).
- [ ] Update **RKP ruleset doc §5/§6** to mention the Kotamraju filter and
      dasha-convergence timing (engine details the pseudocode omits).
