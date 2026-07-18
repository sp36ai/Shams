# Theme System — WCAG Contrast Audit

Computed the full WCAG contrast matrix for all 5 themes (14 token/surface pairs
each). Floors: **4.5:1** (AA normal text) for reading-text tokens on the
surfaces they render over; **3:1** (AA large text / UI components) for
accent/status tokens.

## Findings — every theme failed somewhere (all FIXED)

The early audit fixed `textFaint` against `bg` for darAlShams only; against
card `surface`s it was still 4.0–4.4 in **all five** themes. Worse, the light
theme (`subhAlWahy`) had six failures, including **button text at 2.66:1**
(cream on gold — genuinely hard to read) and its brand gold at **2.02:1** on
the cream background.

All fixes are **minimal, hue-preserving lightness nudges** (computed
programmatically — smallest HLS-lightness delta that crosses the floor, so each
theme's character is preserved):

| Theme | Token | Before | After |
|---|---|---|---|
| darAlShams | textFaint | #7E7A70 (4.02) | #878378 (4.55) |
| laylAlBahr | textFaint | #737A8E (4.12) | #7B8194 (4.54) |
| laylAlBahr | textOnPrimary | #E0E8F8 (4.13) | #EEF2FB (4.53) |
| laylAlBahr | negative | #8A4A68 (2.93) | #8D4C6B (3.03) |
| narAlHadid | textFaint | #84796E (4.20) | #8A7F73 (4.56) |
| narAlHadid | accent | #A03028 (2.76) | #AB332B (3.04) |
| subhAlWahy | textFaint | #7B6E55 (3.96) | #70654E (4.55) |
| subhAlWahy | textOnPrimary | #FAF6EF (2.66) | **#3E2E13 (4.57)** — flipped to dark-on-gold, matching darAlShams's button pattern |
| subhAlWahy | accent | #B8943C (2.66) | #AB8938 (3.06) |
| subhAlWahy | goldBright | #D4AA4E (2.02) | #B1872B (3.06) |
| subhAlWahy | positive | #7A9A50 (2.75) | #73924C (3.03) |
| subhAlWahy | caution | #B8943C (2.46) | #A48435 (3.04) |
| zaytunAlHikma | textFaint | #637554 (4.02) | #5B6C4E (4.57) |
| zaytunAlHikma | goldBright | #7EA05C (2.75) | #779757 (3.06) |

Light themes take darker golds/greens (a mid-gold that glows on obsidian
washes out on cream — the darker bronze is the standard light-theme treatment).

## Locked by test

`src/__tests__/themeContrast.test.ts` asserts the full 14-pair matrix for every
theme (70 assertions): text/textMuted/textFaint ≥ 4.5 on bg/surface/
surfaceElevated, textOnPrimary ≥ 4.5 on primary, accent/goldBright ≥ 3.0 on bg,
positive/negative/caution ≥ 3.0 on surface. Any future palette tweak below the
floor fails CI.

Token completeness: all 5 themes define the identical token set (enforced by
the `ThemeColors` interface — a missing token is a compile error).

## Caveat

These are numeric floors, not a visual pass. The nudges are small (most within
a few percent lightness), but the subhAlWahy button flip (dark text on gold) is
a visible change — worth a quick look on device before release.
