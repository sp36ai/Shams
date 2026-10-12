# Anthropic → OpenAI migration (branch `claude/openai-api-migration`)

**Status: implemented and tested with mocks. Live verification BLOCKED. Not merged, not deployed.**

- **Base:** `3b0eb56` on `claude/oracle-transcript-harness`.
- **Not changed:** the judgment engine (`src/astrology/`, `functions/src/engine/`), main, and production secrets.

## What moved

There are four call sites. All of them now go through one adapter, `functions/src/llm/openaiResponses.ts` (OpenAI Responses API, `POST /v1/responses`).

| Call site | File | Model (`config.ts` `OPENAI_MODELS`) | Output | Failure behaviour (unchanged) |
|---|---|---|---|---|
| Narration | `oracle/responseComposer.ts` | `gpt-5.4-mini`, reasoning `low` | strict JSON schema, five fields | no narration; the reading stands on its verdict. The validator still runs, with deterministic fallback on rejection. |
| Follow-up discussion | `oracle/discussionComposer.ts` | `gpt-5.4-mini`, reasoning `low` | strict JSON schema, three fields | null, so the seeker sees "The oracle did not answer". The one validation-driven rewrite is unchanged. |
| Question gate | `functions/classifyQuestion.ts` | `gpt-6-luna`, reasoning `none` | strict schema, `{class: enum}` | `VALID_HORARY` |
| Profile inference | `functions/inferProfile.ts` | `gpt-6-luna`, reasoning `none` | strict schema, `{profile: enum}` | `clarity` |

### Adapter guarantees

- **Never throws.** Each failure comes back as one classified kind: `http`, `timeout`, `network`, `malformed`, `failed`, `incomplete` (truncated), `refusal` or `empty`.
- **No transport retries.** Nothing retried transport failures before the migration either.
- **Text extraction.** Text is joined from every `output_text` part of every `message` item, rather than assuming `output[0]`. A refusal anywhere means the reply is not used.
- **No provider storage.** Requests are sent with `store: false`.
- **Key handling.** The key goes in the `Authorization` header only. Error details are redacted of key-shaped text and capped at 300 characters before logging.
- **No model-written text in logs.** Refusals are logged as a category and count, never their wording. Unparseable output is logged as `invalid-json` with its length, never an excerpt. Validator rejections are logged as failure codes, fields and a count. The quoted wording in each failure's `detail` stays in memory: the follow-up rewrite note uses it to tell the model what was refused, and it is never logged. Either could restate the seeker's question. Regression tests plant a marker in both and check every log channel.
- **Every reply is still validated.** Each caller runs its existing deterministic validation. Schemas guarantee shape only. The gate and profile parsers accept exactly one known key with a known value.

### Prompt changes

The narration and discussion prompts are unchanged. They are sent as `instructions`; discussion's system blocks are joined into it.

The gate and profile prompts changed in two places:

- The "reply with one word" line now asks for the required JSON object.
- Each now states that seeker text is data to classify, not instructions to follow.

`inferProfile` used to interpolate the seeker's three answers into the instruction text. They now travel as JSON in the user turn.

`inferProfile` also gained a 10-second deadline. It previously relied on the 60-second function timeout.

## Model verification (2026-10-12, OpenAI docs)

| Model | Source | Finding |
|---|---|---|
| `gpt-5.4-mini` | developers.openai.com/api/docs/models/gpt-5.4-mini | Supports `v1/responses`. Reasoning effort `none` (default) to `xhigh`. $0.75 / $4.50 per 1M input / output tokens. Snapshot `gpt-5.4-mini-2026-03-17`. Not on the deprecations page. |
| `gpt-5.4-nano` | developers.openai.com/api/docs/deprecations | **Deprecated 2026-10-01, shutdown 2027-04-01**, recommended replacement `gpt-6-luna`. Not used here. |
| `gpt-6-luna` | developers.openai.com/api/docs/models/gpt-6-luna | Supports `v1/responses`. Reasoning effort default `medium` (set to `none` here). $0.10 / $0.50 per 1M tokens. |

These are list prices from the docs, not measured usage; there has been no live call. The docs also list a newer GPT-6 family for heavier work. `gpt-5.4-mini` for narration was the owner's choice and is kept.

`functions/src/__tests__/modelIds.test.ts` enforces the following:

- every configured id is on the allowlist;
- none is deprecated;
- no `model: '…'` literal exists outside config;
- no Anthropic model id remains in runtime code.

## Secrets and configuration

| Location | Change |
|---|---|
| `config.ts` | `ANTHROPIC_API_KEY` replaced by `OPENAI_API_KEY` (`defineSecret`) and `OPENAI_MODELS` |
| Function bindings | `OPENAI_API_KEY` is bound to `askWatchOracle`, `discussReading`, `classifyQuestion` and `inferProfile` only |
| `firebase.json` secrets | `ANTHROPIC_API_KEY` replaced by `OPENAI_API_KEY` |
| `scripts/Verify-Secrets.mjs`, `scripts/Provision-Secrets.ps1` | Now check or provision `OPENAI_API_KEY` |
| React Native app | No key. The only change is a comment in `src/firebase/watchOracle.ts`. |

## Transcript harness

The harness now intercepts the OpenAI endpoint and writes recordings as cassette v2 (`provider: "openai"`, with each exchange stamped by provider and model). It refuses v1 (Anthropic) cassettes rather than reinterpreting them. The scanner now detects OpenAI keys, and the staging, scan, review and promote workflow is unchanged.

Details are in `docs/audit/transcript-harness/README.md`.

## References intentionally kept

| Reference | Why it stays |
|---|---|
| `narrationValidator.ts` vendor terms (`Claude`, `Anthropic`, `OpenAI`, `GPT`, …) and their test | Leak checks, not provider use |
| `modelIds.test.ts` history | Records the previous provider's model-id incidents |
| Harness legacy-cassette refusal and `sk-ant-` scanner pattern | Old recordings and keys must still be recognised |
| `docs/audit/PHASE_*.md`, `PRODUCTION_*AUDIT*.md`, `.claude-context/` | Historical records, left unedited |
| `docs/OWNER_LAUNCH_CHECKLIST.md:127` | About the build sandbox's proxy, unrelated to the app |

## Outstanding before any merge or deploy (owner)

1. **Privacy policy.** Revised on this branch, with all three copies now identical. The changes:
   - names OpenAI and exactly what is sent to it;
   - discloses names, onboarding answers and follow-up messages;
   - corrects the location description;
   - reconciles the deletion and retention text.

   It still needs legal review. It must not be published before this migration deploys, because production still uses Anthropic. Publishing it then, together with the in-app notice that the policy's Section 9 requires for significant changes, is a release requirement. Set "Last Updated" to the go-live date when it is published.
2. **`OPENAI_API_KEY`.** Provision it in Secret Manager for `shams-app-4d0e7`, with a usage limit (`MANUAL_ACTIONS_REQUIRED.md` §3 and §8b).
3. **Live verification.** Run one real call per call site, then the transcript baseline (`--mode=live`), scan and human review. This is blocked here: there is no key, and the environment's network policy denies `*.openai.com`.
4. **Narration quality.** The validator thresholds and prompts were tuned against the previous model. A new model can be rejected more or less often, so check the fallback rate in the live baseline before deciding.
5. **Retire `ANTHROPIC_API_KEY`.** Do this only after the OpenAI deploy is verified: disable its versions first, delete later.
