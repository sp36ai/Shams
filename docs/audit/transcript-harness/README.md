# Oracle transcript harness — Phase 1 status

| Item | Status (2026-10-12) |
|---|---|
| Harness implementation | PASS (accepted provisionally by the owner) |
| Regression protection | PASS |
| Live Oracle baseline (`baseline-2026-10-12`) | **BLOCKED**: needs a live run with an owner-controlled API key, a clean output scan, then human review |
| No-remedy scenario | Added from a real chart moment; pinned by `noRemedyMoment.test.ts` |
| TTS language mismatch | Confirmed in code; **NOT TESTED** on a device ([checklist](device-tts-checklist.md)) |
| Phase 2 prompt changes | On hold |

No transcript in this repository is evidence of how the Oracle actually sounds until a `--mode=live` run is recorded here. Stub runs use fixed placeholder text and are never committed.

## What it does

`functions/scripts/transcript-harness/` sends 12 scripted conversations through the **production** Oracle path:

- **Opening question:** the same engine call order as `askWatchOracle.ts`, then the unmodified `composeWatchOracleResponse()`. That covers diagnosis, remedy selection, contract, synthesis prompt, validator and deterministic fallback.
- **Follow-ups (3–5 per scenario):** the unmodified `composeDiscussionReply()`. Grounding is built as in `discussReading.ts`, and the turn window as in the client's `discussionTurnsFor()`. Validator rejections and the single rewrite retry run as in production.

The harness touches the pipeline in one place: it wraps `fetch` for the OpenAI Responses endpoint (`https://api.openai.com/v1/responses`) so it can record, replay or stub responses. It never supplies or overrides a verdict. Firestore, auth, App Check, quota and rate limiting are not exercised, because none of them produce prose.

| Mode | Purpose |
|---|---|
| `live` | Calls the real model with `OPENAI_API_KEY` and records `cassette.json`. Headers, including the key, are never written. |
| `replay` | Re-scores a recorded cassette with no model calls. If a request differs from the recording, the run errors. It never falls back to a live call. |
| `stub` | Wiring check only. Placeholder output; every report it writes carries a banner saying so. |

## Coverage

| Owner verdict | Engine state | Scenarios |
|---|---|---|
| YES | FULFILLED | `yes-startup-en`, `yes-stock-en` |
| CAUTION | MOVING / REVERSING | `caution-school-en`, `caution-travel-en` |
| NO | BLOCKED | `no-property-en`, `no-job-pushback-en`, `no-job-en-question-ur-ui` |
| WAIT | DELAYED | `wait-scholarship-en`, `wait-job-voice-en`, `wait-job-ur`, `wait-job-voice-hi` |
| UNCLEAR | UNFORMED | `unclear-ambiguous-en` |
| YES, no remedy | FULFILLED, no intervention | `yes-clear-noremedy-en` |

- **Languages:** 10 English, 2 Urdu (one typed in Urdu, one typed in English from an Urdu UI) and 1 Hindi.
- **Voice:** 2 scenarios use voice-shaped transcripts (no punctuation, filler words).
- **Follow-up probes:** clarification, pushback, date/weekday traps, remedy/verse traps, guarantee traps, a new-question boundary and a closing.

Moments come from the golden corpus and were re-judged against the current engine. The runner recomputes each verdict live and reports any scenario whose state has drifted. In the 2026-10-12 offline check, none had drifted.

### The no-remedy scenario

The production pipeline does support a reading with no remedy. `diagnose()` reports no intervention when all of these hold:

- the outcome is FAVOURABLE;
- nothing obstructs;
- confidence is at least 0.8;
- there is no reversal.

`selectRemedyProtocol()` then returns no steps. The exception is a safety referral (for example, health), which is still prescribed.

Such moments are rare:

- None of the 111 corpus moments produce one.
- A two-week scan (6,204 moment/question pairs) found none. All 129 FULFILLED results in it carried an obstruction, which turns them CONDITIONAL.
- A one-year scan (34,810 pairs, stopped at 12 matches) found 12, clustered on 5–6 Dec 2026.

`yes-clear-noremedy-en` uses one of those 12: "Should I accept the teaching post I was offered?" at 2026-12-06T03:02Z (+05:30). The engine classifies the question as `general`.

The contract is not edited by hand and no remedy is invented.

`noRemedyMoment.test.ts` pins that fixed instant, not the question, because the chart depends on time and the same question at the corpus moments does get a remedy. It asserts each stage separately, so a failure names the stage that changed: the judgment (FULFILLED, no obstruction, no reversal, HIGH or VERY_HIGH confidence), `diagnose()` (FAVOURABLE, no intervention needed) and `selectRemedyProtocol()` (no steps, no escalation).

Raising the confidence threshold in `diagnose()` from 0.8 to 0.96 made the diagnosis and protocol assertions fail; restoring it made them pass. If an intentional engine change breaks this test, pick a new moment. Do not relax the assertions.

During a run, the harness also reports `remedyMismatches` if the engine prescribes a remedy for this moment. The stub run confirmed that both the synthesis brief and the discussion brief carry `INTERVENTION REQUIRED: no`.

## What is measured

Each measurement is either exact or heuristic, and is labelled that way in every report.

- **Exact:** validator acceptance versus fallback; follow-up outcomes (answered, rewritten, no reply); words spoken before the verdict field; dominant script against the seeker's language; reply length; phrases copied from the first reading; repeated openings and closing lines; the model's `is_new_question` and `conversation_complete` flags against each probe.
- **Heuristic flags for a person to review:** verdict cue words, weekdays and months, calendar numbers (house numbers like "10th Ghar" are excluded), certainty language (counted only when not negated), scripture or practice terms missing from the reading's own remedy text (matched case-insensitively and with transliteration folded, so "duʿāʾ", "du’a" and "Dua" all count as "dua", and "Qurʾān" as "Quran"), removed-methodology terms, spoken formatting, and generic-assistant phrasing.
- **Not measured automatically:** naturalness and whether the voice is recognisably Shams al-Asrār. These go on `review-sheet.md` and are scored by a person.

No numeric score is produced automatically.

## Offline verification (2026-10-12)

| Check | Result |
|---|---|
| Stub run: all 13 scenarios, 58 model calls (54 before the no-remedy scenario) | PASS: completed end to end |
| Replay of the stub cassette | PASS: metrics identical to the recording |
| Rejection path: a "YES … on Monday" draft for a BLOCKED reading, plus a "certainly … next Tuesday" follow-up | PASS: the production validator rejected both. The reading showed the deterministic fallback; the follow-up was rejected twice and ended as "no reply". The harness reported both correctly. |
| Harness tests: metrics 9, pinned no-remedy moment 4, output scanner 4 | PASS: 17/17 |
| Existing functions suite | PASS: 34 files, 704 tests. No production file changed. |
| Live baseline | **NOT TESTED**: no model API key in the build environment (Anthropic at the time; OpenAI since the migration) |

## Static findings: code evidence, not transcript evidence

These four findings come from reading the code. The live baseline will show whether, and how much, they affect what seekers actually see and hear.

1. **Spoken order.** The spoken text is `rkp_finding` + `interpretation` + `recommended_approach` (`responseComposer.ts`, `buildSpeakableText`). The synthesis prompt puts the verdict in the first sentence of `interpretation`, after 2–4 sentences of `rkp_finding`.
2. **First-reading language.** `askWatchOracle` receives `questionLang` but does not pass it to `composeWatchOracleResponse`, and the synthesis prompt has no language instruction. Follow-ups do get `REPLY LANGUAGE`.
3. **Spoken language.** `ChatBubble` speaks the reading with the thread's `questionLang` (`ReadingScreen.tsx:729` → `ChatBubble.tsx:307`). `useTextToSpeech.ts:281` sets the engine to `ur-PK` or `hi-IN`, or falls back silently when that locale is not installed, and then speaks the English reading text. Follow-up replies are spoken in the same locale but are written in that language, so the mismatch affects the first reading only.

   **Owner decision pending:** on-device playback in en, ur and hi decides where the fix belongs: the prompt, the response composer, or language selection in the pipeline.

   Device test to run:
   1. Ask the same question with the app set to English, Urdu and Hindi.
   2. Tap play on the reading and on one follow-up in each.
   3. Note whether the English reading is intelligible in the ur-PK and hi-IN voices, and whether either locale is missing on the device (a silent fallback).
4. **Closing variety.** The synthesis prompt says "do not use the same closing twice in a row", but no earlier closing line is ever included in the synthesis brief.

## Provider migration (2026-10-12, branch `claude/openai-api-migration`)

The pipeline's model calls moved from the Anthropic Messages API to the OpenAI Responses API. The harness moved with them.

- **Endpoint:** live, stub and replay intercept `https://api.openai.com/v1/responses`. Stub responses are Responses-shaped. Recorded text is extracted with production's own `extractResponseText()`.
- **Recording format:** cassettes are now `formatVersion: 2`, `provider: "openai"`, and every exchange is stamped with its provider and model.
- **Older recordings:** a cassette without `formatVersion` is a v1 Anthropic recording. Replay refuses it with an explicit error and never reinterprets it as OpenAI output. No v1 cassette was ever committed, because the Anthropic baseline was never recorded, so no historical evidence is affected.
- **Scanner:** it now also flags OpenAI-shaped keys (`sk-…`, `sk-proj-…`) and `authorization` fields, and checks the literal value of `OPENAI_API_KEY` as well as `ANTHROPIC_API_KEY`.
- **Live verification:** BLOCKED. There is no `OPENAI_API_KEY`, and this build environment's network policy denies `*.openai.com`.

## How to record the baseline

From `functions/`:

```sh
npx vitest run --config scripts/transcript-harness/vitest.config.ts   # 17 tests, incl. the pinned no-remedy moment
OPENAI_API_KEY=… npx vite-node scripts/transcript-harness/run.ts -- --mode=live --label=baseline-2026-10-12
```

The live run uses the production model ids from `functions/src/config.ts` (`OPENAI_MODELS`: `gpt-5.4-mini` for narration and follow-ups). It makes 58 or more model calls: one per opening reading, at least one per follow-up, and a second attempt whenever the validator forces a rewrite. Check cost and usage limits before starting.

### Before anything is committed

Every run is written to `docs/audit/transcript-harness/_unreviewed/<label>/`. That folder is git-ignored, so a raw recording cannot be committed by accident. A run leaves it only after all of these:

1. **The key is never recorded.** The key is read from the environment only, and the transport records request bodies and response text, never headers.
2. **The scan is clean.** The run scans its own output automatically. Re-run the scan in the same shell, with the key still set, because it also searches for the key's literal value:
   ```sh
   npx vite-node scripts/transcript-harness/scanOutput.ts -- ../docs/audit/transcript-harness/_unreviewed/baseline-2026-10-12
   ```
   Exit 1 means do not commit. The scanner looks for OpenAI, Anthropic, Google and Razorpay keys, `authorization` header fields, bearer tokens, private keys, the literal environment key, email addresses and phone numbers. Matches are printed masked. The seeker names in the scenarios are fictional fixtures.
3. **A person has read it.** Read all of `transcripts.md`, including the rejected drafts, for anything the scan cannot recognise. Then fill in `review-sheet.md`. Heuristic flags point the reviewer at text; they are never turned into scores.
4. **Then move it into place.** Move the folder to `docs/audit/transcript-harness/baseline-2026-10-12/` and commit it, including `cassette.json`, so Phase 3 can re-score it with `--mode=replay` and compare against identical model responses.

## On-device speech test

The device check is recorded separately, in [device-tts-checklist.md](device-tts-checklist.md). It records three independent results: text language, voice intelligibility and follow-up continuity.
