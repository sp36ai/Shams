# CLAUDE.md

## Production roadmap — read first
The active plan for taking this app to production is
`docs/PRODUCTION_ROADMAP.md`. At the start of every session:
1. Read it and re-verify the current state (CI on `main`, latest
   `Deploy Cloud Functions` run, open issues) before trusting it.
2. Work the next open item in Part B (critical path) unless the owner
   directs otherwise.
3. When an item changes state, update the tracker in the same change,
   citing evidence (commit SHA, CI run number, PR/issue). Add a line to
   its change log.

Items marked 👤 need the owner (credentials, console access, decisions).
Ask for them rather than working around them.

## Non-negotiable architecture rules
- RKP Watch Engine is the **only** calculation and judgment authority.
  Flow: Oracle UI → `askWatchOracle` → server RKP engine → judgment →
  responseComposer → Firestore/audit log → client → MMKV history.
- Voice = speech-to-text → the same `askWatchOracle`. Audio = TTS of the
  composed text only. Sky Clock is display only. The client never invents
  a judgment.
- KP / Krishnamurti Paddhati has been removed on purpose. Never
  reintroduce it (imports, fallbacks, prompts, services, types).
- Preserve Auth, App Check, Zod validation, rate limiting, quota,
  Firestore rules, audit logs, Play verification and Razorpay webhooks.
- Don't invent RKP rules. Where methodology is unclear, flag it as an
  owner decision.
- Passing tests/typecheck/lint is not production evidence. Keep the two
  separate in any claim.
- Keep the stage-tagged `askWatchOracle` diagnostics. Trace the failing
  stage before changing engine logic.
