# Shams al-Asrār voice audition kit

**Status (2026-10-12): kit built and tested offline. NO AUDIO GENERATED. The live audition has NOT RUN.**

Running it needs three things:

- an `OPENAI_API_KEY`;
- network access to `api.openai.com`, which this build environment's policy denies;
- a reviewed live transcript baseline, which supplies the source text.

Completing the kit is not voice approval. The voice choice depends on real audio, auditioned in English, Urdu and Hindi.

Branch: `claude/oracle-voice-audition`, based on `claude/openai-api-migration`. Code is in `functions/scripts/voice-audition/`. No production code is changed.

## Owner decisions this implements (2026-10-12)

| Decision | How the kit applies it |
|---|---|
| Replacement-first model | Uses `gpt-realtime-2.1-mini` through the **Realtime API**. The retiring TTS models are not a dependency. |
| Start with Cedar and Marin | These are the default voices. A voice not in the documented Realtime list is refused, and that list does not include Onyx. |
| UNFORMED stays distinct | `performance.ts` maps UNFORMED to UNCLEAR, which has its own delivery. It is never WAIT. |
| Delivery is set by the engine state, not a model | A fixed table maps state to spoken verdict to performance line. Nothing reads the prose to pick a tone. |
| One validated text | Each case's text is the post-validation text from a transcript-harness run. The kit writes no text of its own. |
| Cloud speech ships only with or after the OpenAI migration | The kit is offline evaluation only. Nothing is wired into the app. |

## Verified against OpenAI documentation (2026-10-12)

- **The speech endpoint is not an option.** `POST /v1/audio/speech` accepts only `tts-1`, `tts-1-hd`, `gpt-4o-mini-tts` and `gpt-4o-mini-tts-2025-12-15` (API reference). All four are deprecated, with shutdown on **2027-01-06** and `gpt-realtime-2.1-mini` as the recommended replacement (deprecations page).
- **The replacement is a realtime model.** `gpt-realtime-2.1-mini` takes input "over WebRTC, WebSocket, or SIP connections". Audio comes back as `response.output_audio.delta` events carrying base64 PCM, not as a file. Its model page lists every endpoint name without marking which are supported, so it cannot be read as evidence of speech-endpoint support. The kit uses the WebSocket interface.
- **Realtime voices** are alloy, ash, ballad, coral, echo, sage, shimmer, verse, **marin** and **cedar**. OpenAI recommends marin or cedar.
- **AI-voice disclosure.** OpenAI's usage policies require "a clear disclosure to end users that the TTS voice they are hearing is AI-generated". This becomes a UI requirement when cloud speech ships.

## The main risk this kit measures: verbatim fidelity

A realtime model is a conversational model, not a text reader, and OpenAI documents no verbatim-reading mode for it. It might greet the user, answer, paraphrase, or skip words. The kit therefore:

1. tells the model, in its instructions, to read the supplied text exactly and do nothing else;
2. compares the API's transcript of its own spoken audio against the source text, word by word (`fidelity.ts`). The comparison normalises case, punctuation and Arabic-script diacritics;
3. **disqualifies any take that is not verbatim**, whatever it sounds like.

The transcript is the provider's own account of its audio, so a listener still confirms fidelity during review. If the replacement cannot read verbatim reliably, it cannot be the Oracle's voice under the one-text rule. That is the first thing the live run will show.

## The ten cases

| Case | Scenario | Text | Covers |
|---|---|---|---|
| A01 | yes-startup-en | first reading | YES, the ceremonial reading |
| A02 | yes-clear-noremedy-en | first reading | YES with no remedy |
| A03 | no-property-en | first reading | NO, with the seeker's and mother's names |
| A04 | no-job-pushback-en | follow-up 1 | NO held under pushback, conversational register |
| A05 | no-job-en-question-ur-ui | first reading | English text for an Urdu-UI seeker (the language-mismatch finding) |
| A06 | wait-scholarship-en | first reading | WAIT |
| A07 | wait-job-ur | follow-up 1 | WAIT, **Urdu** |
| A08 | wait-job-voice-hi | follow-up 1 | WAIT, **Hindi** |
| A09 | caution-travel-en | first reading | CAUTION |
| A10 | unclear-ambiguous-en | first reading | UNCLEAR |

Notes on coverage:

- **Urdu and Hindi come from follow-ups.** First readings are written in English today, because no language input reaches the narration prompt. That is a documented finding the audition does not hide.
- **Missing text is reported, not filled in.** If a case's text is missing in the source run (the synthesis failed or a follow-up got no reply), the case is listed with the reason, and no substitute text is invented.

## Running it

From `functions/`. The source must be a live or replayed transcript-harness run; a stub run is refused unless `--allow-stub-source` is passed, for wiring checks only.

```sh
OPENAI_API_KEY=… npx vite-node scripts/voice-audition/run.ts -- --mode=live \
  --source=../docs/audit/transcript-harness/baseline-2026-10-12 --label=voice-2026-10-12
# options: --voices=cedar,marin  --model=gpt-realtime-2.1-mini  --timeout-ms=60000
```

### Output

Output goes to `docs/audit/voice-audition/_unreviewed/<label>/`, which is git-ignored. An existing label is never overwritten.

| File | Contents |
|---|---|
| `audio/<case>__<voice>.wav` | PCM16 mono, 24 kHz. Live mode only. |
| `manifest.json` | Model, API, voices, audio format, the source run, and the full instructions for every state with their sha256. For every take: status, fidelity, transcript, first-audio time, total time, response status, the server event types seen, and any error. Never the key. |
| `summary.md` | Per-voice counts (verbatim, not verbatim, failed, median first audio) and every divergence. |
| `scorecard.md` | **A. Written Oracle**, scored per case from the text alone, and **B. Spoken Oracle**, scored per case and voice. Verbatim status, first-audio time and duration are filled in automatically. |

Stub mode makes no network calls and generates no audio. Every page it writes says so.

### Before anything is committed

1. Run `scanOutput.ts` on the run folder. It now scans text output only (`.md`, `.json`, `.txt`, `.csv`, `.html`); the WAV files hold only the validated source text, which `manifest.json` carries and the scan covers.
2. Listen to every take. Confirm fidelity by ear, then fill in the scorecard.
3. Move the folder out of `_unreviewed/` and commit it.

## Verification done here (offline)

| Check | Result |
|---|---|
| Audition tests: performance 4, fidelity 4, Realtime adapter 7, end to end 7 | PASS, 22/22 |
| Transcript-harness tests (same config) | PASS, 23/23 |
| Real Node `WebSocket` against a local scripted Realtime server | PASS. The upgrade carried `Authorization` and `?model=gpt-realtime-2.1-mini`; the client sent `session.update`, `conversation.item.create` and `response.create`; audio and transcript were collected; status `completed`. |
| CLI: stub source refused by default; stub audition writes no audio and carries both banners; live mode without a key refused; output git-ignored | PASS |
| Live audio against OpenAI | **NOT RUN.** No key, and the network policy denies `*.openai.com`. |

### Not yet verified

These need the first live run:

- **The exact Realtime session schema.** The kit sends `session.type: "realtime"`, `output_modalities: ["audio"]`, and `audio.output.voice` / `format` (`audio/pcm`, 24 kHz), as read from the GA documentation. If the service rejects a field, the take fails with the service's error message and the event types seen are recorded.
- **That `gpt-realtime-2.1-mini` accepts these voices** and that its transcript events arrive as documented.
- **Whether it reads verbatim at all**, the central question.
