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
| `OracleChatScreen` | `src/screens/ReadingScreen.tsx`, `components/oracle/ChatBubble.tsx`, `ChatComposer.tsx` | ⚠️ **frame name is stale** — see *Screens renamed by #99* |
| ↳ `RkpWatchCard` (inside the Oracle turn) | `src/components/oracle/RkpWatchCard.tsx` | ✅ rebuilt from source |
| `HistoryScreen` | `src/screens/ReadingsScreen.tsx` | ⚠️ **frame name is stale** — see *Screens renamed by #99* |
| `SkyClockScreen — Al-Falak` | `src/screens/SkyClockScreen.tsx` | ✅ rebuilt from source |
| `SettingsScreen` | `src/screens/SettingsScreen.tsx` | ✅ rebuilt from source |
| `PremiumScreen` | `src/screens/PremiumScreen.tsx` | ✅ rebuilt from source |
| `SplashScreen` | `src/screens/SplashScreen.tsx` | ✅ rebuilt from source |
| `OnboardingScreen` | `src/screens/OnboardingScreen.tsx` | ✅ rebuilt from source |
| `LocationPermissionScreen` | `src/screens/LocationPermissionScreen.tsx` | ✅ rebuilt from source |
| `AuthScreen` | `src/screens/AuthScreen.tsx` | ✅ rebuilt from source |
| `OracleChatScreen — Urdu (RTL)` | same, with `lang === 'ur'` | ✅ built from `ur.ts` + `typography.ts` — see *Localisation gap* |

#### Screens renamed by #99

PR #99 ("Make the Reading the domain object") reorganised the two screens the Figma file
calls `OracleChatScreen` and `HistoryScreen`:

| Figma frame (unchanged) | Was | Is now |
|---|---|---|
| `OracleChatScreen` | `src/screens/OracleChatScreen.tsx` | `src/screens/ReadingScreen.tsx` (route `Reading`) |
| `HistoryScreen` | `src/screens/HistoryScreen.tsx` | `src/screens/ReadingsScreen.tsx` (tab `Readings`) |

The frames were **not** renamed in Figma, and the rows above are therefore mapped by
source path, not by name. This is a naming drift, not a layout drift: the layouts were
verified against the old files and #99 did not restructure them, but a Reading now carries
a follow-up conversation and a title, neither of which the frames show. Renaming the frames
and drawing the follow-up turns is outstanding design work, not a code defect.

Also new on `main` and **not** in the Figma file at all:

- `src/components/home/HomeAskComposer.tsx` — asking straight from the home screen.
- `src/components/ScreenErrorBoundary.tsx` — the per-screen boundary from #100. It has no
  frame because it only renders on failure; its fallback is unstyled by design.

### Components page

| Component set | Mirrors | Notes |
|---|---|---|
| `Verdict Badge` (5 variants) | `verdictBadgeFor()` + `verdictColorFor()` in `ReadingsScreen.tsx` | Maqbool=YES, Mardood=NO/DENIED, Mashroot=CONDITIONAL, Takheer=DELAYED, GhayrWazeh=UNCLEAR/PENDING. **Used by History rows only** — `RkpWatchCard` has no badge. |
| `Tab Bar Item` (Tab × State) | `src/navigation/MainTabs.tsx` | Home / Al-Falak / Readings, Active+Inactive. The third tab was `History` when the frames were drawn; #99 renamed it to `Readings` — variant names updated to match, and the missing `activeBar` indicator added. See *Tab Bar — premium assembly added*. |
| `Tab Bar` (assembly) | `src/navigation/MainTabs.tsx` | New — the three-instance assembled bar with the real upward shadow. |
| `Button` | `src/components/ui/Button.tsx` | Adopted, not mirrored — see *The Button component — adopted* below. |

---

## TOKEN PARITY

Figma variables were generated **from** `src/theme/themes.ts` and `src/theme/typography.ts`,
so they are derived, not independently authored.

- **Colour** — one collection, **eight** modes named for the eight `ThemeId`s (the original
  six, plus `qutbAlAnwar`/`kanzAlAsrar` — see *Tier-gated theming* below). 20 semantic tokens
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

These are hardcoded constants in the source and must stay identical across all eight modes.
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
| Settings was missing whole sections, and its subscription card had a gold-tinted fill | All seven sections present (Appearance / Seeker Identity / Profile / Subscription / Reading Stats / Account / Location), each header carrying its trailing 20%-gold `sectionLine`; the subscription card is `surface`-filled and only turns `amber`-bordered on a paid plan |
| A Figma `Button` was instanced into four screens with no code equivalent | Resolved by adoption, not correction — see *The Button component — adopted* below |
| Premium drawn with the two plans **stacked** | `styles.cardsRow` puts them **side by side**, Khass at `flex: 1.05` with a `KHASS_GOLD` border and glow; plus the real back-arrow header copy, the *BEGIN WITH 7 DAYS FREE* banner, the selection dot and the *Restore previous purchase* link |
| Onboarding drawn with a skip button, gold eyebrow and radio-selected choices | Centred slide with the `✦ BISMILLAH ✦` header, Amiri wordmark and ornament row; eyebrow is `textFaint`; choice cards are plain and centred with **no selection state** (tapping advances); no skip button exists |
| Location permission drawn with a *Not now* secondary button | Only the primary button is rendered. The file's own header comment still describes a secondary "Not now" — the comment is stale, the code is not |
| Auth drawn with filled pill tabs | Real tabs are **underline** tabs (`borderBottomWidth: 2` in `goldBright`), over a bordered form card with 52px-min input rows |
| Splash drawn with a one-line wordmark, line–diamond–line rule and muted tagline | Two-line `SHAMS\nAL-ASRĀR` at `typography('hero')`, a single `❖` divider, and the tagline at `typography('subheading')` in `colors.text` |

---

## KP REMNANT FOUND AND REMOVED

Mirroring `AuthScreen` surfaced the last user-facing reference to the retired KP engine:
the wordmark's subtitle was a hardcoded `'✦  KP HORARY ORACLE  ✦'`, shown to every seeker on
the sign-in screen. A `grep` for user-facing KP strings hits that line and nothing else —
the remaining matches are code comments, not UI.

Replaced with the app's own `app.tagline` ("The Horary Oracle of Divine Guidance"), which
already existed, was already translated into Urdu and Hindi, and was already rendered by
`SplashScreen`. No new copy invented. That also fixed a second defect at the same site: the
KP string was hardcoded English and did not localise at all.

**Still open (owner decision):** that subtitle applies `letterSpacing: 2.5`, and
`typography.ts` is explicit that Nastaliq must never be letter-spaced. `SplashScreen` already
letter-spaces this same tagline at 1.6, so the problem predates the change and affects both
screens. It was left alone rather than folded into a KP removal.

Two stale code comments also claim the Oracle "uses the full KP engine"
(`SkyClockScreen.tsx`, `components/home/CosmicClock.tsx`). They are comments, not behaviour,
but they contradict the RKP-only architecture and are worth correcting.

---

## BUG FOUND AND FIXED WHILE MIRRORING

Mirroring `RkpWatchCard` meant reproducing its row labels exactly, which surfaced a live
defect: both the card and `watchJudgment.ts` interpolated `${house}th Ghar` directly, so any
question whose primary house is 1, 2 or 3 rendered **"1th Ghar" / "2th Ghar"**. From
`HOUSE_MATRIX` the reachable cases are `health` and `general` (primary 1) and `finance` and
`lostitem` (primary 2) — common categories, not edge cases. It appeared both on the card's row
label and in the engine's factor prose under *How the chart reads*.

`nomenclature.ts` already exported `gharLabel()` with the correct st/nd/rd/th suffixes, and
nothing called it. Fixed by wiring the existing helper into the six variable-house sites, with
regression tests that were verified to fail against the old interpolation. Presentation only —
no scores, states, timings or confidence bands changed.

The Figma frames show `4th Ghar` (a `property` question, primary 4), which is correct either
way; the bug is only visible on houses 1–3.

---

## THE BUTTON COMPONENT — ADOPTED

**This is the one place in this file where Figma led and code followed**, by explicit
request. Every other frame in this file mirrors code that already existed; `Button` did not
exist in either, so there was nothing for Figma to mirror until a design was actually made.

Before: no shared Button in `src/`. `src/components/` had `BackgroundLattice`,
`ErrorBoundary`, `GlowView`, `ShimmerOverlay`, `StarfieldBackground`, `TabIcon` and
`ThemeSwitcher` — no Button. Counted across `src/screens/*.tsx` and
`src/components/oracle/*.tsx`: **26 distinct button/chip/pill style keys** across **35
`Pressable` usages in 11 files**, including three different primary-CTA treatments alone
(`AuthScreen.submitBtn`: 56px fixed height, `RADIUS.xl`; `OnboardingScreen.cta`: `radius: 20`;
`PremiumScreen.cta`: `radius: 16`) — three different corner radii and three different shadow
recipes for what is visually the same button.

**Now:** `src/components/ui/Button.tsx` — `Style=Primary|Secondary|Ghost` ×
`Size=Large(56)|Medium(48)` × live `Pressed`/`Disabled`/`Loading` states (driven from
Pressable's own `pressed` prop and the `disabled`/`loading` props, not separate variants to
pick between). Figma's `Button` component set (Components page) holds the full 24-cell
static reference matrix these live states are drawn from, fully variable-bound —
`elevation/glow` effect style, `radius/xl`+`radius/lg`, `spacing/xxl`+`spacing/xl` — with
`Label` exposed as a component text property.

**Correctness fix made during the build, not a style choice:** the first draft bound
`Button`'s fill to `color/gold`/`color/textOnGold`. That's wrong — `colors.gold` and
`colors.primary` diverge in **Layl al-Baḥr** (`#6AAAC8` vs `#4A6FA8`) and **Sirr al-Banafsaj**
(`#A78BFA` vs `#7C3AED`), the same two themes flagged earlier for the gold/border Accent
mismatch, and all four real screens already bound their CTAs to `colors.primary`. Rebound to
`color/primary`/`color/textOnPrimary` before implementing in code, so the component and the
screens agree in every theme, not just the four where gold and primary happen to be equal.

**One legitimate divergence, kept as an escape hatch, not a special case:** Premium's Khāṣṣ
tier uses a fixed `KHASS_GOLD` (`#B8952A`) brand accent that is deliberately constant across
all eight themes — it is not a theme token and never has been (it also colors the tier's border,
label and selection dot elsewhere on the same screen). `Button` exposes an optional `tint`
prop for exactly this case; every other call site leaves it unset and gets the normal
per-theme `colors.primary` behaviour.

**Applied to all four screens that had a bespoke CTA:** `AuthScreen` (submit), `PremiumScreen`
(purchase CTA, via `tint`), `OnboardingScreen` (`Enter Shams al-Asrār`), and
`LocationPermissionScreen` (grant/open-settings). Each screen's now-dead style block
(`submitBtn`'s fixed height/radius, `cta`'s padding/radius/shadow, `primaryButton`) was
trimmed to only what `Button` doesn't own (margin, in `AuthScreen`; nothing left to keep in
the other three). `ActivityIndicator` and `Pressable` imports were removed where the swap
left them unused (`LocationPermissionScreen`).

`Verdict Badge` and `Tab Bar Item` remain ordinary mirrors, of
`verdictBadgeFor()`/`verdictColorFor()` and of `MainTabs.tsx` respectively — code led, Figma
followed, same as everywhere else in this file.

---

## TAB BAR — premium assembly added

The Components page had `Tab Bar Item` (the six individual tab states) but no assembled bar,
and its `Tab=History` variant name was stale — #99 renamed the code's third tab from
`History` to `Readings` (see *Screens renamed by #99* above) and the frame never followed.
Both fixed: the six variants are now `Tab=Home|Al-Falak|Readings, State=Active|Inactive`, and
a new `Tab Bar` component assembles three instances (Home active, the other two inactive) on
a 390×64 `color/surfaceElevated` ground with the same upward shadow `MainTabs.tsx` renders
(`offset: (0,-8), radius: 24, opacity: .14`).

Building the assembly also surfaced a gap in the individual `Tab Bar Item` variants
themselves: the Active variants had the accent-glow `activeHalo` ellipse but were missing the
`goldBright` `activeBar` — the 24×2.5 indicator bar `MainTabs.tsx` renders beneath the icon.
Added to all three Active variants, bound to `color/goldBright`.

---

## PREMIUM VISUAL PASS — real defects found and fixed across the app

A second pass, after Button/Tab Bar, went looking for the same class of gap in the four
highest-traffic surfaces: the Reading card, the Readings list, Settings, and Premium. Two of
the four had real, evidence-based defects; two were already at a premium bar and were left
alone deliberately, not skipped.

### `RkpWatchCard` had zero elevation

The single most-viewed surface in the app — the verdict card rendered on every question — was
a flat bordered box: `borderWidth: hairline`, no shadow at all, while `Button` (this file,
above) already carries `ELEVATION.glow` and Readings rows already carry a verdict-tinted left
stripe. Fixed in `RkpWatchCard.tsx`: `ELEVATION.rest` spread onto the card, plus a 3px
state-tone left stripe reusing the exact pattern already established in `ReadingsScreen.tsx`
(`borderLeftWidth: 3` / `borderLeftColor: vColor`) — not a new pattern, the existing one
finally applied to the surface that most needed it. Mirrored onto all 7 `RkpWatchCard` frames
in Figma (6 themes + the Urdu RTL reference), each stripe/shadow bound to whichever of
`color/positive`/`negative`/`caution`/`textMuted` that instance's actual `WatchState` resolves
to — read from the frame's own headline-text binding, not assumed.

### The Figma `Verdict Badge` component had a real bug, not just a stale mirror

While bumping the badge label off its undersized 9px (below), a closer look at the Figma
component turned up something the earlier "rebuilt from source" pass had missed: **all five
variants' fill, stroke, and label were bound to the same `color/textMuted` variable at full
opacity** — meaning the pill's background and its own text were painted the same colour (the
label was invisible against its background), and none of the five variants differed from each
other regardless of verdict. This was a defect in the Figma file, not in the app —
`verdictColorFor()` in `ReadingsScreen.tsx` was and is correct (`YES→positive`,
`NO→negative`, `CONDITIONAL`/`DELAYED→caution`, default→`textMuted`). Rebound each variant to
match: fill at 8% opacity (mirrors code's `vColor + '14'` hex-alpha suffix), stroke and label
at full opacity, each to its own verdict's variable.

### Three undersized captions, same anti-pattern, found by grep and fixed where safe

A repo-wide scan for `fontSize` literals below 10 in screen/component styles surfaced several
hits. Each was checked individually rather than bulk-edited — some are legitimate (SkyClock's
planet-table column headers and TimingPill labels at 8px are dense data-table chrome in a
fixed-width layout; enlarging them risks breaking that table and the confidence they're a
defect, rather than a deliberate density choice, is low). Two were not defensible and were
fixed:

- **`ReadingsScreen`'s list-row verdict pill** — `typography('label')` (13px) overridden down
  to `fontSize: 9`, the smallest text anywhere in the type system. Bumped to 11px,
  `letterSpacing` 0.8→0.6, pill `minWidth` 84→96 to fit `GHAYR WAZEH` without wrapping. Mirrored
  in the Figma `Verdict Badge` component alongside the bug fix above.
- **`SettingsScreen`'s Reading-Stats `StatCard` label** and **`GuidanceCard`'s `effectPill`
  label** — the same `typography('caption'|'label')` → `fontSize: 9` override, in an isolated
  stat card and a `alignSelf: 'flex-start'` pill respectively (neither has a fixed-width
  overflow risk). Both bumped to 11px.

### One dead style found, removed

`SettingsScreen`'s row style carried a hardcoded `backgroundColor: '#FFFFFF06'` that every
call site overrides with `colors.surface` — dead code with zero visual effect, a leftover from
before the row became theme-aware. Removed.

### Settings and Premium: no action taken, and why

Settings' rows already have real elevation (`shadowOpacity: 0.04`, deliberately subtle for a
list of many rows, the same restraint `ReadingsScreen` uses) and a gold section-divider
treatment. Premium's plan cards already differentiate the Khāṣṣ tier with a tuned glow
(`shadowOpacity: 0.45`, `shadowRadius: 14`, gold-tinted) against the standard tier's
(`0.1`/`4`, neutral) — exactly the kind of state-differentiated elevation this pass was adding
elsewhere. Redesigning either would have been churn without a defect to justify it, so neither
was touched.

## TIER-GATED THEMING — two new Khāṣṣ themes, free/Mureed/Khāṣṣ split

Until this pass, theme choice was completely open — all 6 colour variants, free for every
user, no gating at all. That changed by explicit product decision:

- **Free** (no subscription): one fixed default, `darAlShams`. No picker shown as unlocked.
- **Mureed**: unlocks the original five colour variants (`laylAlBahr`, `narAlHadid`,
  `subhAlWahy`, `zaytunAlHikma`, `sirrAlBanafsaj`) — themes that already existed, now gated
  rather than redesigned.
- **Khāṣṣ**: unlocks two **new** themes, designed fresh for this tier rather than repurposing
  anything that existed — `qutbAlAnwar` and `kanzAlAsrar`.

### The two new themes

Both dark, both built by the same formula every existing theme already follows (one accent
hex drives `gold`/`accent`/`primary`/`sacredGlow`/`starfield`/`celestialDust`/`jaliStroke`/
`sealGradient[0]`; a second, brighter stop drives `goldBright`/`amber`/`candlelight`/
`sealGradient[1]`; `maqbool`/`mardood`/`caution` are independent semantic accents; `lunarReflection`
is an independent cool accent) — new palette, same internal logic as the six themes that
predate them, not a special case.

- **Quṭb al-Anwār** ("Axis of Lights") — platinum/silver-white accent (`#D6DAE2` →
  `#F2F4F8`) on near-black. The one accent hue none of the original six use (they run
  gold/blue/red-orange/mustard-olive/violet) — chosen so a Khāṣṣ theme reads as visually
  distinct at a glance, not just "one more gold variant."
- **Kanz al-Asrār** ("Treasure of Secrets") — rose-gold accent (`#D9A066` → `#F0BE8A`) on
  near-black emerald, with emerald `maqbool` and ruby `mardood`. Jewel-toned, distinct from
  `darAlShams`'s warm gold and from Quṭb al-Anwār's cool platinum.

Both were verified the same way the original elevation/stripe work was verified in this file
(*Premium visual pass*, above): the fully variable-bound `RkpWatchCard` reference frame was
cloned into each new Color-collection mode and screenshotted. Every value — background,
state-tone stripe, elevation glow, text — resolved correctly with zero additional binding
work, which is the actual payoff of having bound every value to a variable in the first
place rather than hardcoding colours per frame.

**Scope boundary, stated plainly:** only `RkpWatchCard` has a dedicated reference frame for
the two new themes. A full mirror — all ten screens × 2 new themes, the way the original six
were built out — was not attempted here; that is a much larger effort and wasn't asked for.
`Button`, `Verdict Badge` and `Tab Bar` are equally variable-bound and would resolve correctly
under the new modes on the same evidence, but that has not been individually screenshotted
and confirmed the way `RkpWatchCard` was.

### Enforcement — where gating actually lives

- **`src/theme/themes.ts`** — `THEME_TIER: Record<ThemeId, PlanTier>` maps every theme to its
  minimum tier; `tierMeetsRequirement()`/`isThemeUnlocked()` do the rank comparison
  (`free` < `mureed` < `khass`). Covered by `src/theme/__tests__/themeTiers.test.ts` (30
  cases: every theme × every tier).
- **`src/theme/ThemeProvider.tsx`** — `readPersistedThemeId()` checks the persisted theme
  against `useQuotaStore.getState().plan` (read synchronously — quotaStore's own plan field
  is itself MMKV-rehydrated at module load, so this is safe on the very first render) and
  falls back to `DEFAULT_THEME_ID` if it's no longer covered. A second effect does the same
  check live, so a subscription that lapses mid-session (not just between app launches) can't
  leave the user on a theme their plan no longer covers.
- **`src/components/ThemeSwitcher.tsx`** — a locked card is dimmed (opacity 0.55), shows the
  required tier (`✦ MUREED` / `✦ KHĀṢṢ`) instead of the DARK/LIGHT badge, and tapping it opens
  Premium instead of switching — propose the upgrade, don't just disable, the same pattern
  the rest of the app already uses for paywalled actions.

### TEMPORARY — all themes unlocked for internal testing

`isThemeUnlocked()` in `themes.ts` currently short-circuits to `true` for every theme
regardless of plan (`TESTING_MODE_ALL_THEMES_UNLOCKED = true`), by explicit request during
internal testing — a tester saw the two Khāṣṣ themes correctly rendered as locked cards and
wanted them explorable without needing a live Khāṣṣ subscription on the test account.

`THEME_TIER` and `tierMeetsRequirement()` are untouched and still fully covered by
`themeTiers.test.ts`'s "real per-tier gating decision" suite (the same 30 cases as before,
now exercised directly rather than through `isThemeUnlocked()`). Reverting is a **one-line
flip** — `TESTING_MODE_ALL_THEMES_UNLOCKED = false` — with a second test block in the same
file (`"isThemeUnlocked — TEMPORARY testing-mode override"`) that should be deleted at the
same time, since at that point `isThemeUnlocked()` and the real-decision helper are identical
again and testing the override separately stops meaning anything.

Alongside this: `FREE_DAILY_LIMIT`/`TRIAL_DAILY_LIMIT` in `quotaStore.ts` and
`FREE_LIMIT`/`TRIAL_DAILY_LIMIT` in `functions/src/config.ts` were raised from 3/5 to 50/50,
same rationale (don't paywall-block testers), same revert instruction in both files' comments.

### What this section does NOT cover

- **Premium's marketing copy does not yet advertise theme unlocking as a plan benefit.**
  `PremiumScreen.tsx`'s plan cards list other benefits; adding "unlock N themes" to that copy
  is a product/marketing decision, not made here.
- **Whether a currently-active Mureed/Khāṣṣ subscriber who downgrades keeps their in-progress
  reading history styled the way they last saw it** — no, by design (the live-downgrade
  effect above reverts immediately) — but this has not been manually verified end-to-end
  against a real Play Store subscription-lapse webhook, only against `quotaStore.setPlan()`
  called directly.

---

## FOLLOW-UP CONVERSATION — already built; one discoverability gap found and fixed

`discussReading` (Cloud Function) → `oracleDiscussion.ts` (client) → `ReadingScreen.tsx`
(`runDiscuss`, `isFollowUp` branching) is a complete, tested, working follow-up-conversation
pipeline — it shipped in #99, well before this pass. If a seeker reports being unable to keep
talking to the Oracle after a reading, the first thing to check is **which build they're
running**, not the feature's existence.

What this pass found and fixed: **the composer's placeholder text
(`oracleChat.placeholderDiscuss`, "Ask about this reading…") was the only discoverability
signal**, and it's unfocused grey text at the bottom of what can be a long scrolling thread —
easy to miss when attention is naturally on the verdict card above, not the input below.

The fix reuses copy that already existed but was never wired to anything:
`oracleChat.modeDiscuss` ("💬 Discuss this reading") was defined in `en.ts` alongside
`modeNewQuestion`, and neither string was referenced by any component — dead strings, not a
missing-translation gap. `ReadingScreen.tsx` now renders `modeDiscuss` as a small label
directly above the composer whenever `isDiscussMode` is true (the same condition that already
switches the composer's placeholder and its `onSend` target), so the invitation to keep
talking sits exactly where the seeker's eyes land next, not scrolled away above older
messages. `modeNewQuestion` remains unwired — `handleAskAsNewReading`'s existing UI already
covers that path (see `ChatBubble`'s `onAskAsNewQuestion`), so there was nothing to connect it
to.

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

1. **All ten screens have now been rebuilt from source**, so nothing in the frame map is
   provisional any more. What is *not* covered: the frames show one representative state per
   screen. Auth shows the Sign In tab only (not Sign Up, field errors, or the locked/loading
   button); Onboarding shows question one only (not the Q3 completion state); Location shows
   the idle state (not denied or blocked); Premium shows the pre-trial-expiry copy. The
   corrections table is the record of what drifted when frames were drawn from a brief.
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
6. **`Button` and the premium visual pass (`RkpWatchCard` elevation/stripe, `Verdict Badge`
   fix, the three caption bumps) are unverified on-device.** Typecheck, lint and the full Jest
   suite pass with all of them in place, but no test renders any of them and asserts on
   output, and none has been screenshotted on a real simulator/device across the six themes —
   only in Figma, where each render is a static reference showing one theme's resolved token
   values, not the running app.

---

## CHANGING THINGS

- **Changing a colour/spacing/type value:** edit `src/theme/themes.ts` (or `typography.ts`)
  first, then update the matching Figma variable. Never the other way round.
- **Changing what a screen shows:** that is a product change to the source file. Update the
  code, then re-mirror the Figma frame so this document stays true.
- **Adding a screen to Figma:** read the source file first and build from it. The corrections
  table above is what happens when that step is skipped.
