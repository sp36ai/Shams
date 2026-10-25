# Shams al-Asrār — instructions for AI assistants

Read this first. It outranks the status and audit reports elsewhere in the repo.

## What is authoritative

1. **The code on `main`** and the checks CI runs on it.
2. **This file.**
3. `.claude-context/oracle-decisions.md`: standing Oracle decisions.

Everything else is a **dated snapshot**, not current instructions. That covers the
`*_STATUS*.md`, `*_READY*.md`, `*_AUDIT*.md`, `*_REPORT*.md` and `*_SUMMARY*.md`
files at the repo root, `.claude-context/current-task.md`, `session-log.md` and
`code-changes.md`. Use them for history. Before acting on any claim in them, check it
against the code. `RKP_KP_FORENSIC_AUDIT.md` describes the removed KP engine and is
not a to-do list.

## Architecture rules

- **The RKP Watch Engine is the only calculation and judgment system.** Flow:
  Oracle UI → `askWatchOracle` → server-side RKP Watch Engine → RKP judgment →
  `responseComposer` → Firestore/audit log → client → MMKV history.
- **Voice** goes speech-to-text → question text → the same `askWatchOracle` call.
  **Audio** is TTS of the composed Oracle text. Neither has its own astrology logic.
- **Sky Clock** is a local/live RKP display, not a judgment engine.
- **KP / the Astronomical judgment engine was deleted in #92** (`judgeHorary`,
  `kp/judgment/`, `askOracle`, `oracleSynthesisPrompt`, `safetyValidator`). Never
  restore it as an import, fallback, prompt or hidden path. The shared tables in
  `src/astrology/kp/rules/` and `primitives/` stay: RKP uses them.
- `functions/src/engine/` is a generated mirror of `src/astrology/`. Edit the source
  and run `npm run sync-engine` in `functions/`.
- Preserve the production backend: Auth, App Check, Zod validation, rate limiting,
  quota, Firestore rules, reading persistence, audit logs, Play verification, and
  Razorpay webhooks.
- Don't invent RKP rules. If the methodology is unclear, flag it as an owner decision.

## Enforced by CI (`.github/workflows/ci.yml`)

| Rule | Check |
| --- | --- |
| No retired KP engine code | `npm run check:retired-kp` |
| No secrets in new commits | Secret Scan job (gitleaks, `.gitleaks.toml`) |
| Engine mirror in sync | `npm run verify-engine-sync` (in `functions/`) |
| No unused files in `src/` | `npm run check:orphans` |
| Cert pins not expiring | `npm run check:cert-pin-expiry` |
| User-facing narration leaks no internals or forbidden terms | `functions/src/oracle/narrationValidator.ts` (runtime) and its tests |

Passing CI is static evidence. It doesn't prove production behaves correctly.

## Secrets

Never commit or paste credentials. Server secrets live in Firebase/Secret Manager
(see `scripts/Provision-Secrets.ps1`, `.env.example`). `google-services.json` and
`functions/.env` are gitignored.
