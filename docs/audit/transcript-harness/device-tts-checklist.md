# On-device speech test: first reading and follow-ups

**Status: NOT TESTED.** This needs a physical Android device running the current build.

## What the code does today (static)

- The first reading's text has no language input. `askWatchOracle` receives `questionLang` but does not pass it to `composeWatchOracleResponse`, and the synthesis prompt has no language instruction. In practice the reading is written in English.
- Follow-up replies are written in `REPLY LANGUAGE`, which is the thread's language.
- Speech plays the first reading and every follow-up in the thread's language voice, through `Tts.setDefaultLanguage`: `en-US`, `ur-PK` or `hi-IN` (`useTextToSpeech.ts:41,281`).
- If the device lacks that voice, the app speaks anyway with whatever voice the engine falls back to. It does not show an error.

A voice does not translate. An Urdu voice reading English text is still English text. Each of the three results below therefore points at a different place to fix:

- **A. Text language** → the first-reading language input: the composer, prompt or pipeline.
- **B. Voice intelligibility** → which voice is chosen for a given text: the client TTS selection.
- **C. Follow-up continuity** → whether the reading and the follow-ups match each other.

The engine is not involved in any of them, and no fix may change a verdict.

## Procedure

Do this once per app language. Use the same question each time, for example "Will I get the job I interviewed for?" (typed in that language where possible).

1. Set the app language. Note the device model, Android version and TTS engine (Settings → Accessibility → Text-to-speech).
2. Note which voice data is installed for en-US, ur-PK and hi-IN.
3. Ask the question and wait for the reading.
4. **Result A:** without playing anything, look at what language the first reading is written in.
5. **Result B:** tap play on the reading. Note whether the voice pronounces it intelligibly. Note whether the voice is the selected locale or a fallback (an obvious accent or voice change).
6. **Result C:** ask one follow-up. Note its written language, then play it. Note whether the language and voice match the reading's.

## Record

| App language | Device / Android / TTS engine | Voice data installed? | A. First reading written in | A. Intended? | B. Voice heard | B. Intelligible? (yes / partly / no) | C. Follow-up written in | C. Follow-up voice | C. Matches reading? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| English (en) | | | | | | | | | | |
| Urdu (ur) | | | | | | | | | | |
| Hindi (hi) | | | | | | | | | | |

Record each result separately; do not merge them into one pass/fail. For example, "A: English (not intended); B: intelligible but accented; C: follow-up in Urdu, so the voice changes between messages" is three findings that point at three different fixes.
