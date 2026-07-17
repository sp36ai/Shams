# Rate-limiting & LLM Cost Controls — Audit

## Per-reading LLM fan-out

The engine (buildChart/judgeHorary/classifyQuestion) is deterministic and
**free** — question classification in `askOracle` is a keyword matcher, not an
LLM. The Anthropic spend per reading:

| Call | Model | Notes |
|---|---|---|
| Oracle synthesis (`askOracle`) | **claude-opus-4-7**, max_tokens 4096 | the cost driver |
| Safety validation ×4 fields | claude-haiku | cheap |
| `selectRemedies` (client-initiated) | 1× claude-sonnet + up to 3× haiku | cheap-ish |
| `classifyIntent` (per follow-up) | claude-haiku | cheap |
| `inferProfile` (one-time onboarding) | claude-haiku | cheap |

≈ **1 Opus + up to ~8 small calls per reading**. Opus dominates: ~4K-token
system prompt in + up to 4K out ≈ **$0.2–0.4 per reading**.

## Existing controls (verified)

- **Per-user rate limit**: 10 req/min, atomic Firestore transaction. ✓
- **Daily quota**: free 3/day, trial 5/day, paid unlimited — atomic
  check-and-decrement. ✓
- **App Check + Auth** on every callable — blocks anonymous/mass scripted abuse. ✓
- **All Anthropic calls are timeout-bounded** (5–25 s). ✓

## Findings

### 1. No autoscaling ceiling — FIXED
No `maxInstances` was set, so a spike or abuse burst could spawn unbounded
concurrent instances — and therefore unbounded concurrent **paid Opus calls**
(cost blow-up + Anthropic 429 cascades). Added `maxInstances` to
`FUNCTION_OPTS` (50) and a tighter ceiling on the Opus-bearing oracle function
(`ORACLE_FUNCTION_OPTS` = 20). Both are well above launch-scale demand and are
tunable per observed load. This bounds worst-case burst spend.

### 2. No global daily spend ceiling — OPEN (recommend)
Per-user quota caps one user, but nothing caps **aggregate** daily Opus volume.
Cost scales linearly with signups; a sign-up spike or many-accounts abuse (each
new account gets 3 free + 5 trial = 8 Opus readings) has no circuit breaker.
Recommended: a per-UTC-day counter doc (`_system/costMeter/{dayKey}`) incremented
in `askOracle` before synthesis, with a configurable `defineInt` ceiling. On
breach, serve the existing non-Opus `ORACLE_FALLBACK` (still a valid reading)
and log a `cost_ceiling_hit` audit event. At launch scale a single counter doc
is fine; shard if sustained write rate exceeds ~1/s. Not implemented here
because "silently drop to the non-Opus voice" is a product decision — decide the
desired degradation before wiring it.

### 3. Free tier uses the most expensive model — product decision
Free and trial users receive the full **Opus 4.7** synthesis. That's ~$0.2–0.4
of unrecovered cost per free reading (up to ~8/day/free-user during trial).
Consider routing free/trial synthesis to a cheaper model (e.g. Sonnet) and
reserving Opus for paid tiers — a config/product choice, not a bug.

## Residual notes
- `rateLimits` docs carry `expiresAt` for Firestore TTL cleanup (see the
  Firestore-cost audit for TTL-policy verification).
- The 10/min rate limit does not meaningfully cap cost on its own (10 Opus/min
  is already large); the daily quota is the real per-user cost cap.
