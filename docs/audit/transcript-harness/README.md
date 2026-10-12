# Oracle transcript harness — Phase 1 status

**Status (2026-10-12): harness built and verified offline. Baseline NOT TESTED: no live run yet.**

No transcript in this repository is evidence of how the Oracle actually sounds until a `--mode=live` run is recorded here. Stub runs use fixed placeholder text and are never committed.

## What it does

`functions/scripts/transcript-harness/` sends 12 scripted conversations through the **production** Oracle path:

- **Opening question:** the same engine call order as `askWatchOracle.ts`, then the unmodified `composeWatchOracleResponse()`. That covers diagnosis, remedy selection, contract, synthesis prompt, validator and deterministic fallback.
- **Follow-ups (3–5 per scenario):** the unmodified `composeDiscussionReply()`. Grounding is built as in `discussReading.ts`, and the turn window as in the client's `discussionTurnsFor()`. Validator rejections and the single rewrite retry run as in production.

The harness touches the pipeline in one place: it wraps `fetch` for the Anthropic Messages endpoint so it can record, replay or stub responses. It never supplies or overrides a verdict. Firestore, auth, App Check, quota and rate limiting are not exercised, because none of them produce prose.

| Mode | Purpose |
|---|---|
| `live` | Calls the real model with `ANTHROPIC_API_KEY` and records `cassette.json`. Headers, including the key, are never written. |
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

- **Languages:** 9 English, 2 Urdu (one typed in Urdu, one typed in English from an Urdu UI) and 1 Hindi.
- **Voice:** 2 scenarios use voice-shaped transcripts (no punctuation, filler words).
- **Follow-up probes:** clarification, pushback, date/weekday traps, remedy/verse traps, guarantee traps, a new-question boundary and a closing.

Moments come from the golden corpus and were re-judged against the current engine. The runner recomputes each verdict live and reports any scenario whose state has drifted. In the 2026-10-12 offline check, none had drifted.

**Gap:** no scenario has `interventionRequired: false`. None of the 111 corpus moments produce it naturally.

## What is measured

Each measurement is either exact or heuristic, and is labelled that way in every report.

- **Exact:** validator acceptance versus fallback; follow-up outcomes (answered, rewritten, no reply); words spoken before the verdict field; dominant script against the seeker's language; reply length; phrases copied from the first reading; repeated openings and closing lines; the model's `is_new_question` and `conversation_complete` flags against each probe.
- **Heuristic flags for a person to review:** verdict cue words, weekdays and months, calendar numbers (house numbers like "10th Ghar" are excluded), certainty language (counted only when not negated), scripture or practice terms missing from the reading's own remedy text, removed-methodology terms, spoken formatting, and generic-assistant phrasing.
- **Not measured automatically:** naturalness and whether the voice is recognisably Shams al-Asrār. These go on `review-sheet.md` and are scored by a person.

No numeric score is produced automatically.

## Offline verification (2026-10-12)

| Check | Result |
|---|---|
| Stub run: all 12 scenarios, 54 model calls | PASS: completed end to end |
| Replay of the stub cassette | PASS: metrics identical to the recording |
| Rejection path: a "YES … on Monday" draft for a BLOCKED reading, plus a "certainly … next Tuesday" follow-up | PASS: the production validator rejected both. The reading showed the deterministic fallback; the follow-up was rejected twice and ended as "no reply". The harness reported both correctly. |
| Metric unit tests (`metrics.test.ts`) | PASS: 9/9 |
| Existing functions suite | PASS: 34 files, 704 tests. No production file changed. |
| Live baseline | **NOT TESTED**: no `ANTHROPIC_API_KEY` in the build environment |

## Static findings: code evidence, not transcript evidence

These four findings come from reading the code. The live baseline will show whether, and how much, they affect what seekers actually see and hear.

1. **Spoken order.** The spoken text is `rkp_finding` + `interpretation` + `recommended_approach` (`responseComposer.ts`, `buildSpeakableText`). The synthesis prompt puts the verdict in the first sentence of `interpretation`, after 2–4 sentences of `rkp_finding`.
2. **First-reading language.** `askWatchOracle` receives `questionLang` but does not pass it to `composeWatchOracleResponse`, and the synthesis prompt has no language instruction. Follow-ups do get `REPLY LANGUAGE`.
3. **Spoken language.** `ChatBubble` speaks the reading with the thread's `questionLang` voice (`ReadingScreen.tsx:729` → `ChatBubble.tsx:307`). An Urdu or Hindi seeker may therefore hear English text read by an Urdu or Hindi voice. This has not been verified on a device.
4. **Closing variety.** The synthesis prompt says "do not use the same closing twice in a row", but no earlier closing line is ever included in the synthesis brief.

## How to record the baseline

From `functions/`:

```sh
ANTHROPIC_API_KEY=… npx vite-node scripts/transcript-harness/run.ts -- --mode=live --label=baseline-YYYY-MM-DD
npx vitest run --config scripts/transcript-harness/vitest.config.ts
```

The output goes to `docs/audit/transcript-harness/<label>/`. An existing label is never overwritten.

After the run:

1. Read `transcripts.md`.
2. Fill in `review-sheet.md`.
3. Commit the whole directory, including `cassette.json`, so the baseline can be re-scored with `--mode=replay` and compared in Phase 3.

The live run uses the production model id (`claude-opus-5`). Its cost is about 54 or more model calls.
