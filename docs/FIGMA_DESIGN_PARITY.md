# FIGMA ↔ CODE PARITY

**Figma file:** [Shams al-Asrār — Oracle UI](https://www.figma.com/design/tTXUtJW6NyANy5qYFsSL2F)

Companion to [`DAR_AL_SHAMS_DESIGN_SYSTEM.md`](./DAR_AL_SHAMS_DESIGN_SYSTEM.md) (the visual
philosophy) and [`COMPONENT_IMPLEMENTATION_GUIDE.md`](./COMPONENT_IMPLEMENTATION_GUIDE.md)
(how components are built). This file records only one thing: **which Figma frame corresponds
to which source file, and how far each has actually been verified against the code.**

---

## THE AUTHORITY RULE

**Code is the source of truth. Figma mirrors it.**

The Figma file is a mirror of what the app already renders — it is not a spec to implement
against, and it never overrides the engine. Specifically:

- **RKP calculates, Oracle composes, UI displays.** No Figma frame introduces a field, label,
  or verdict vocabulary that `askWatchOracle` does not actually return. Where a mock needs a
  value it uses a real one from the codebase's own tables (`HOUSE_META`, `PLANET_NAME`,
  `STATE_HEADLINE`, `verdictBadgeFor`).
- When Figma and code disagree, **the code is right and the Figma file is the bug.**
- A visual change ships only when a human decides it should — not because a Figma frame
  looks different.

This rule exists because it was violated once already; see *Corrections applied* below.

---

## FRAME → SOURCE MAP

Pages in the Figma file: `Cover`, `Foundations`, `Components`, `Oracle Flow`, `Auth Stack`,
`Settings & Premium`. Each screen page holds the Dār al-Shams original in the top row and one
clone per remaining theme below it (variable-mode switched, not hand-recoloured).

| Figma frame | Source | Verified against code |
|---|---|---|
| `OracleScreen — Home` | `src/screens/OracleScreen.tsx` | ✅ rebuilt from source |
| `OracleChatScreen` | `src/screens/OracleChatScreen.tsx`, `components/oracle/ChatBubble.tsx`, `ChatComposer.tsx` | ✅ rebuilt from source |
| ↳ `RkpWatchCard` (inside the Oracle turn) | `src/components/oracle/RkpWatchCard.tsx` | ✅ rebuilt from source |
| `HistoryScreen` | `src/screens/HistoryScreen.tsx` | ✅ rebuilt from source |
| `SkyClockScreen — Al-Falak` | `src/screens/SkyClockScreen.tsx` | ✅ rebuilt from source |
| `SettingsScreen` | `src/screens/SettingsScreen.tsx` | ⚠️ partial |
| `PremiumScreen` | `src/screens/PremiumScreen.tsx` | ⚠️ partial — plan data is real (`PLANS`) |
| `SplashScreen` | `src/screens/SplashScreen.tsx` | ⚠️ partial |
| `OnboardingScreen` | `src/screens/OnboardingScreen.tsx` | ⚠️ partial — question/choice copy is real (`QUESTIONS`) |
| `LocationPermissionScreen` | `src/screens/LocationPermissionScreen.tsx` | ⚠️ partial |
| `AuthScreen` | `src/screens/AuthScreen.tsx` | ⚠️ partial |
| `OracleChatScreen — Urdu (RTL)` | same, with `lang === 'ur'` | ✅ built from `ur.ts` + `typography.ts` — see *Localisation gap* |

### Components page

| Component set | Mirrors | Notes |
|---|---|---|
| `Verdict Badge` (5 variants) | `verdictBadgeFor()` + `verdictColorFor()` in `HistoryScreen.tsx` | Maqbool=YES, Mardood=NO/DENIED, Mashroot=CONDITIONAL, Takheer=DELAYED, GhayrWazeh=UNCLEAR/PENDING. **Used by History rows only** — `RkpWatchCard` has no badge. |
| `Tab Bar Item` (Tab × State) | `src/navigation/MainTabs.tsx` | Oracle / Al-Falak / History, Active+Inactive. |
| `Button` (Primary / Secondary) | generic | Instances carry per-screen overrides (see *Deliberate deviations*). |

---

## TOKEN PARITY

Figma variables were generated **from** `src/theme/themes.ts` and `src/theme/typography.ts`,
so they are derived, not independently authored.

- **Colour** — one collection, six modes named for the six `ThemeId`s. 20 semantic tokens
  (`color/bg`, `color/surface`, `color/gold`, `color/positive`, …) matching `ThemeColors`.
- **Spacing / Radius** — `SPACING` and `RADIUS` from `themes.ts`.
- **Type styles** — the `TYPOGRAPHY_VARIANTS` ramp (hero → button).
- **Effect styles** — `ELEVATION` (rest / floating / glow).

Two things to know when editing:

1. **Cinzel has no SemiBold in Figma's font set.** `typography.ts` asks for `Cinzel-SemiBold`
   for the `display` role; Figma substitutes `Cinzel Bold`. Display headings therefore read
   very slightly heavier in Figma than on device.
2. **`chatShamsBg` is an rgba in `themes.ts`**, and is stored in Figma with its true alpha
   (e.g. `rgba(201,169,97,0.07)`), not as a flattened hex.

### Colours that are intentionally NOT themed

These are hardcoded constants in the source and must stay identical across all six modes.
Do not "fix" them to a theme token:

| Constant | Where | Why |
|---|---|---|
| `STATUS_RETROGRADE`, `STATUS_COMBUST` | `SkyClockScreen.tsx` | Motion status is an observatory reading, not brand chrome. |
| `DIGNITY_EXALTED` … `DIGNITY_DEBILITATED` | `SkyClockScreen.tsx` | Dignity is a second, independent axis from motion; its palette is fixed. |
| `KHASS_GOLD` (`#B8952A`) | `PremiumScreen.tsx` | Premium tier accent, deliberately theme-invariant. |

---

## CORRECTIONS APPLIED

The first pass of this file was drawn from a written brief rather than from the source, and
drifted from the real data model. What it got wrong, and what it now shows:

| Was (wrong) | Is now (matches code) |
|---|---|
| `RkpWatchCard` showed a **“MAQBOOL” badge** and invented `Sun/Moon degreeInSign` rows | Real card: `WATCH WINDOW` line, plain-language `STATE_HEADLINE` in the state's tone colour, `STATE · confidence`, then Ghar / Ruled by / Timing / Held by / Reversal / Direction rows, directional-focus block, and the `How the chart reads` factor list |
| Verdict vocabulary `MAQBOOL / CAUTION / MARDOOD` everywhere | `RkpWatchCard` uses the six `WatchState`s (`FULFILLED`…`UNFORMED`); History uses the five Arabic badges from `verdictBadgeFor()` |
| Oracle audio drawn as a **waveform scrubber with elapsed time** | Real TTS control: a 28px ▶/⏸ button plus a status caption (`Listen to the verdict` / `Speaking` / `Paused`) |
| User chat bubble drawn on `surface` | Real bubble is filled with `colors.accent`, text in `textOnPrimary`, `borderBottomRightRadius: 4` |
| Composer drawn as input → mic → gradient arrow | Real order is **mic (left) → input → `SEND` text pill (right)** |
| Gradient CTA buttons throughout | The app uses flat token colours; gradients were a Figma invention and are gone. Every colour in the screen frames is now variable-bound, so theme clones re-theme with no manual recolouring |
| History rows had an invented **confidence bar** | Real row: 3px verdict-coloured left stripe, question, `{Hora} · CATEGORY · relative-time` meta, verdict pill. Confidence appears only in the detail modal |
| Only a happy-path frame per screen | Oracle chat now also shows the real `sending` (spinner + *Reading the chart…*) and `failed` (message + ↻ Retry) states |
| Screen backgrounds were hardcoded dark | Bound to `color/bg`, so the two light themes (Ṣubḥ al-Waḥy, Zaytūn al-Ḥikma) render correctly |
| Tab bar drawn with uppercase `ORACLE` labels on `surface` with a top border | Sentence-case `nav.homeTab`/`nav.alFalakTab`/`nav.historyTab` (**Home**, not "Oracle") at `typography('caption')`, on `surfaceElevated` with a transparent top border and the accent@20% active halo |
| Al-Falak header had a left-aligned title and subtitle; timing shown as six separate chips; clock drawn collapsed | Centred `AL-FALAK` over a live running clock with *Live Sky Clock* italic on the right; one bordered TimingBar of pills separated by hairline dividers (Hora/Day/Moon/Nakshatra/LST/Phase); `CELESTIAL CLOCK` **expanded by default** (`clockExpanded` initialises to `true`) |
| Planet table had no zebra striping, sign in muted text, and no dignity legend | Alternating `surfaceElevated` rows, sign in `colors.accent`, dignity note row beneath non-neutral placements, and the five-badge dignity legend below the table |

---

## LOCALISATION GAP — the Oracle result cards are not translated

Found while building the Urdu frame, and worth an owner decision:

**None of `RkpWatchCard.tsx`, `RemedyProtocolCard.tsx` or `GuidanceCard.tsx` imports
`useTranslation` or calls `t()`.** Every string they render is hardcoded English —
`STATE_HEADLINE` ("The matter completes"), the row labels (`Ruled by`, `Timing`, `Held by`,
`Reversal`, `Direction`), `timingLabel()`'s "days / weeks / months", `obstructionLabel()`'s
"Qamar disagrees — the mind behind the question is unsettled", and the `How the chart reads`
factor list.

So for an Urdu or Hindi seeker the app renders Urdu chrome — header, bubbles, composer, TTS
caption, all correctly from `ur.ts` — wrapped around an **English verdict card**. The only
language-aware part of the result is `reading.oracle.narration`, which is composed
server-side.

The `OracleChatScreen — Urdu (RTL)` frame is drawn that way deliberately: it shows what
ships today, not an idealised translation, so the gap is visible rather than hidden.

Two decisions belong to the owner here:

1. Should the verdict card be localised at all? These are RKP terms of art
   (`Ghar`, `Bait-ul-Arz`, `Qamar`) that may be intended to stay in their classical forms —
   in which case only the connective English ("Ruled by", "which your ruler … counts
   friendly") needs translating, not the vocabulary.
2. If it is localised, `STATE_HEADLINE` and `timingLabel()` are judgment-adjacent phrasing.
   Their wording is the engine's voice, so new translations are a methodology question, not
   a copy question.

### What the Urdu frame does demonstrate

`typography.ts`'s Nastaliq rules applied faithfully: Amiri throughout, `letterSpacing: 0`,
`lineHeight = round(fontSize × 2.1)`, and the per-variant size bumps (+2 body, +1
caption/label, +3 subheading/heading). RTL mirroring is drawn as the platform would resolve
it — the back chevron flips to the right, the user bubble's `flex-end` resolves to the left,
the bubble's cut corner mirrors to `bottomLeft`, and the composer reads send → input → mic.

---

## DELIBERATE DEVIATIONS

Cases where Figma cannot express what the code does, and the workaround chosen:

- **`Button` instance overrides.** `PremiumScreen`'s CTA overrides the fill to fixed
  `KHASS_GOLD`; `SettingsScreen`'s Sign Out overrides stroke and label to `color/negative`
  (a destructive action, not an accent one). Geometry and type still come from the component.
- **Verdict left stripe.** A Figma frame has one stroke colour, so RN's
  `borderLeftWidth: 3 / borderLeftColor: vColor` over a hairline border is drawn as a 3px
  child rectangle inside a clipped row.
- **Figma API quirk:** `createInstance()` and `clone()` drop a paint's `opacity` when the
  paint is bound to a variable. Translucent fills (verdict pills at 8%, dignity badges at 15%)
  must have their opacity re-asserted after either operation, or they render fully opaque and
  the label becomes invisible.

---

## NOT YET VERIFIED

Open, in rough priority order. None of these are claimed as done:

1. **Settings / Premium / Auth-stack frames** were built from the screens' documented
   structure, not line-by-line from source like the Oracle flow and Al-Falak were. They are
   directionally right but unaudited — treat their detail as provisional. The corrections
   table shows what tends to be wrong when a frame is drawn this way.
2. **RTL / Devanagari coverage is one screen deep.** `OracleChatScreen — Urdu (RTL)` exists;
   the other nine screens are Latin/English only, and Hindi is not drawn at all (Noto Sans
   Devanagari is available in Figma, so it is buildable). Note that RTL correctness cannot be
   fully judged from Figma — mirroring there is drawn by hand, whereas on device it comes
   from `I18nManager`. The frame is a design reference, not proof the app mirrors correctly.
3. **Accessibility is unverified.** No contrast audit, tap-target check, or screen-reader
   label pass was done on the Figma frames. `themes.ts` already carries WCAG-tuned
   `textFaint` values with explicit ratio comments — that bar has not been re-checked here.
4. **One viewport only** (390×844). No tablet, small-Android, notch/safe-area, or
   keyboard-open composer state.
5. **`useCyclingCaption`** — referenced in the original design brief as cycling RKP stage
   names every 5s during the wait, but **it does not exist anywhere in `src/`**. The real
   pending state is a static `ActivityIndicator` + `oracleChat.readingChart`. Owner decision
   needed: build it, or drop it from the brief.

---

## CHANGING THINGS

- **Changing a colour/spacing/type value:** edit `src/theme/themes.ts` (or `typography.ts`)
  first, then update the matching Figma variable. Never the other way round.
- **Changing what a screen shows:** that is a product change to the source file. Update the
  code, then re-mirror the Figma frame so this document stays true.
- **Adding a screen to Figma:** read the source file first and build from it. The corrections
  table above is what happens when that step is skipped.
