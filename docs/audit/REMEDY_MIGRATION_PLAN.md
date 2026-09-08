# Remedy Migration Plan — Phase 2A

**Status: trace and plan only. No remedy code, library, or callable was
modified, removed, or consolidated. Both Path A and Path B remain live and
unchanged.**

This extends `REMEDY_AUTHORITY_ANALYSIS.md` (Phase 1) with a complete,
consumer-by-consumer trace, closing the one item that document left
explicitly unverified: whether Path B's output is persisted.

---

## A. What Path A owns

`functions/src/oracle/remedySelection.ts` (`selectRemedyProtocol`) +
`functions/src/oracle/remedyLibrary.ts`:

- The **intervention** the RKP diagnosis prescribes: `interventionRequired`,
  `guidance` (no-remedy case), `rationale`, and up to N `steps` (each a
  library entry with `id`, `name`, `category`, `evidenceType`, `intensity`,
  `duration`, `explanation`, `instructions`, `isEscalation`).
- Deterministic — a pure function of `RkpDiagnosis` (confirmed by execution:
  Phase 1's 111-case golden corpus, byte-identical on two-process and
  in-process replay).
- Persisted to `/readings/{id}.watchOracle.protocol` by `askWatchOracle.ts`,
  as part of the same Firestore write that saves the verdict and diagnosis.
- Reaches the client in the `askWatchOracle` callable's own response —
  no second round trip.
- Rendered by `RemedyProtocolCard.tsx`.

## B. What Path B owns

`functions/src/functions/selectRemedies.ts` (LLM callable) +
`src/data/remedySelector.ts`/`rankCandidates.ts`/`remedyLibrary.ts`:

- A **seeker-tailored devotional-practice suggestion** — per
  `GuidanceCard.tsx`'s own header comment, explicitly framed as answering a
  different question than Path A ("which practice suits this seeker now,"
  not "what the chart prescribes").
- The candidate *ranking* (`getCandidates`/`rankCandidates`, up to 8
  candidates) is deterministic, client-side, and does not call any LLM.
- The final **1-3 pick** and the per-remedy prose description are LLM-driven
  (`selectRemedies` Cloud Function, `SELECTION_PROMPT` / `generateDescription`).

## C. Complete trace — every current consumer of Path B

Starting from `ReadingScreen.tsx` exactly as the brief specifies, followed
all the way through:

```
ReadingScreen.tsx runAsk() success path
  → runGuidanceSelection(targetThreadId, oracleMessageId, question, result.reading)
      [fires unconditionally, NOT awaited by the ask path, fire-and-forget
       .then()/.catch() — a slow or failed Path B call never blocks or
       fails the reading the seeker already has]
      → watchVerdictToRankingContext(reading.verdict, seekerProfile)
          src/data/watchRemedyContext.ts — deterministic, maps the verdict's
          obstruction/state/qType into RankingContext.dominantThemes/
          spiritualState/severity via fixed lookup tables
      → selectRemedies(ctx)                          src/data/remedySelector.ts
          1. getCandidates(rankingCtx) → top 8         deterministic, local
          2. calls the `selectRemedies` Cloud Function  functions/src/functions/selectRemedies.ts
             - SELECTION_PROMPT: LLM picks 1-3 of the 8 candidate ids
             - generateDescription: LLM writes a 1-2 line description per pick
             - NEITHER call is pinned to temperature 0 in the prompt file —
               not independently re-verified against the live API this pass,
               since doing so is a real production call, out of scope here
          3. ON ANY FAILURE (network error, empty/invalid response, the
             callable throwing) — CONFIRMED BY READING THE CODE, not
             inferred: falls back to a purely deterministic client-side
             pick, `top8.slice(0, 3)` — the top 3 by rank score, no LLM
             involved. Path B therefore ALWAYS returns something; it never
             silently produces nothing once candidates exist.
      → .then(result => updateMessage(targetThreadId, oracleMessageId,
                                        { selectedRemedies: result.selectedRemedies }))
          src/stores/readingThreadsStore.ts
      → GuidanceCard.tsx renders message.selectedRemedies when present,
        alongside RemedyProtocolCard.tsx (Path A's card) in the same
        ChatBubble.tsx
```

### Every consumer, named explicitly:

| Consumer | Touches Path B output? | Evidence |
|---|---|---|
| `GuidanceCard.tsx` | **Yes — the only rendering consumer.** | `ChatBubble.tsx:274-276` |
| `RemedyProtocolCard.tsx` | No — renders `reading.oracle` (Path A) exclusively | `ChatBubble.tsx:273` |
| TTS (`useTextToSpeech.ts`) | **No.** Re-checked this pass: the hook's `speak()`/`toggle()` calls in `ChatBubble.tsx` are wired to narration text (`reading.oracle.narration` / discussion message text), never to `message.selectedRemedies` or anything derived from `GuidanceCard`. `GuidanceCard.tsx` has no TTS control of its own. | `grep` for `selectedRemedies`/`useTextToSpeech` co-occurrence in `ChatBubble.tsx`: none found |
| Analytics | **None found.** No analytics/telemetry call site references `selectedRemedies`, `GuidanceCard`, or the `selectRemedies` callable's result, in either `src/` or `functions/src/`. | repo-wide `grep`, no hits |
| Subscription / entitlement / quota | **No.** `selectRemedies`'s own callable enforces `verifyAuth` + `enforceRateLimit` — the same access-control pattern every callable uses — but does **not** call `claimQuotaSlot`/`refundQuotaSlot`. Confirmed by reading `functions/src/functions/selectRemedies.ts` in full: no import of `utils/quotaSlots.ts`. **Path B does not spend or check the daily reading quota — it rides for free on the quota slot Path A's own `askWatchOracle` call already charged.** This is a real, previously-unstated fact: retiring Path B would not free or change any quota accounting, because it was never part of it. |
| Any other backend process | **None found.** No Cloud Function, scheduled job, or webhook handler reads `selectedRemedies`, `GuidanceCard`, or the `selectRemedies` callable's Firestore writes (it makes none — see §D). |

## D. Whether Path B output is persisted — resolved (was "unverified" in Phase 1)

**Path B's `selectedRemedies` are persisted to on-device MMKV only, via
`readingThreadsStore.ts`'s `updateMessage()` — never to Firestore.**

This is stated directly in `readingThreadsStore.ts`'s own module doc
comment, re-read in full this pass: *"PERSISTENCE: MMKV, like every other
store in this app. Firestore holds the server's own copy of each reading
(written by askWatchOracle) but the client has never read from it, and this
store does not change that."* `selectedRemedies` lives on `ReadingMessage`,
a member of this MMKV-backed store — no Firestore write path for it exists
anywhere in `functions/src/functions/selectRemedies.ts` (confirmed by
reading the full file: it returns `{selectedIds, selectionReason,
descriptions}` over the wire and performs no `db.collection(...)` write of
its own).

**Consequences, made explicit because they matter for a consolidation
decision:**

1. Survives app restarts on the **same device** (MMKV persists across app
   launches).
2. Does **not** sync across a seeker's devices.
3. Is **not** part of `/readings/{id}` — an admin, a support investigation,
   or any future cross-device history feature reading from Firestore would
   never see Path B's picks, only Path A's protocol.
4. **Uninstalling the app, clearing app storage, or (per Phase 0's account-
   deletion trace) a `deleteAccount` call all discard it permanently and
   irrecoverably** — there is no server copy to fall back to.
5. A `ReadingMessage` created before this trace and one created after carry
   the same shape; nothing about Path B's persistence changed by writing
   this document.

## E. Whether Path B output is spoken

**No.** See the TTS row in §C. Directly re-confirmed by reading
`useTextToSpeech.ts` and every `speak`/`toggle` call site in
`ChatBubble.tsx` in full this pass — none references `GuidanceCard` or
`selectedRemedies`.

## F. Whether Path B output affects future requests

**No feedback loop found.** `selectRemedies`'s inputs
(`oracleContext`/`candidates`/`questionText`/`readingId`) are derived fresh
from the current reading's verdict each time `runGuidanceSelection` fires;
nothing reads a *previous* `selectedRemedies` result back in as input to a
later `askWatchOracle`, `selectRemedies`, or `inferProfile` call. `readingId`
is passed to the callable but — confirmed by reading
`functions/src/functions/selectRemedies.ts` in full — used only inside the
LLM prompt context, not persisted or read back.

## G. Whether removing Path B changes user-visible behavior

**Yes, directly:** the `GuidanceCard` currently rendered on effectively
every successful reading (it fires unconditionally, and even on Cloud
Function failure falls back to a deterministic pick rather than disappearing
— see §C) would stop appearing. Whether that is an acceptable or desirable
change is a product decision this report does not make. What is newly
established in this pass, and should weigh into that decision: removing
Path B would **not** touch quota accounting (§C), would **not** affect any
Firestore-backed history or admin view (§D), and would **not** affect audio
playback (§E) — its blast radius is genuinely confined to
`GuidanceCard.tsx`'s presence in the chat bubble and to whatever product
value the seeker-tailored suggestion itself provides.

## H. Migration strategy (not implemented — sequencing options for Phase 2B, pending owner decision)

This report continues to recommend, but not decide (per
`REMEDY_AUTHORITY_ANALYSIS.md`'s Phase 1 recommendation, unchanged): **Path A
becomes sole remedy authority.** Three sequencing options for how Phase 2B
could get there, laid out for the owner to pick from — none started here:

1. **Clean retirement.** Remove `runGuidanceSelection`'s call site, the
   `selectRemedies` Cloud Function export, and `GuidanceCard.tsx`'s render
   branch. Archive (do not silently discard) `src/data/remedyLibrary.ts`'s
   38 entries and `inferProfile`'s seeker-profile mechanism, in case the
   "seeker-tailored suggestion" product value is wanted again in a
   redesigned form later. Simplest, but loses the feature outright until
   redesigned.
2. **Fold into Path A.** Extend `oracle/remedySelection.ts`'s deterministic
   selection to also consider seeker-profile tailoring (`SeekerProfile`
   already exists and is already plumbed to the client) as an additional,
   still-deterministic input dimension — preserving the "tailored to this
   seeker" value without a second LLM call or a second library. Highest
   effort, but the only option that fully satisfies "one engine authority"
   while keeping the feature.
3. **Re-scope Path B to prose-only, mirroring `responseComposer.ts`'s
   existing narration/fact separation.** Keep the deterministic candidate
   ranking and Path A's own selection, but let an LLM write supplementary
   description text about a remedy Path A already chose — never let it pick
   *which* remedy. Middle ground: keeps an LLM role, removes its decision
   authority.

Whichever option is chosen, this trace establishes the concrete
pre-conditions any of them need: confirm no other feature is quietly relying
on `selectedRemedies` being ephemeral/local-only (per §D's consequences,
which are a real behavior change surface of their own, independent of which
migration option is picked), and treat `src/data/remedyLibrary.ts`'s content
as a real editorial asset to be explicitly archived or merged, not deleted
by accident as a side effect of removing its call site.
