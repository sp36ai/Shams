# Font assets — Shams al-Asrār

This directory holds the font families the app links into the Android APK at
build time. **Fonts are not committed to git** — they are provisioned by
`scripts/download-fonts.mjs`, which also mirrors them into
`android/app/src/main/assets/fonts/` so the Android Gradle Plugin bundles them
into the APK/AAB.

> **Source of truth:** the exact families are whatever `src/theme/typography.ts`
> (and the design system, `docs/DAR_AL_SHAMS_DESIGN_SYSTEM.md`) reference. The
> download manifest in `scripts/download-fonts.mjs` MUST stay in lockstep with
> that file. A family referenced in code with no file here ships as the system
> default font — a silent, app-wide brand regression.

## Required files (provisioned automatically)

| Filename                          | Family / Weight          | License     |
| --------------------------------- | ------------------------ | ----------- |
| `Cinzel-SemiBold.ttf`             | Cinzel (display)         | SIL OFL 1.1 |
| `Cinzel-Bold.ttf`                 | Cinzel (display bold)    | SIL OFL 1.1 |
| `Spectral-Regular.ttf`            | Spectral 400 (body)      | SIL OFL 1.1 |
| `Spectral-Medium.ttf`             | Spectral 500             | SIL OFL 1.1 |
| `Spectral-SemiBold.ttf`           | Spectral 600             | SIL OFL 1.1 |
| `Spectral-Italic.ttf`             | Spectral 400 italic      | SIL OFL 1.1 |
| `Amiri-Regular.ttf`               | Amiri 400 (Arabic)       | SIL OFL 1.1 |
| `Amiri-Bold.ttf`                  | Amiri 700 (Arabic)       | SIL OFL 1.1 |

## Why these specific families

- **Cinzel**: Carved-stone Roman aesthetic; screen headers, wordmark, engraved
  uppercase labels.
- **Spectral**: Literary, contemplative display serif; body text (EN) and
  verdict narration (italic). This replaced Cormorant Garamond — the design
  system and all runtime code use Spectral.
- **Amiri**: Quranic, reverent, highly legible Arabic (UR). Line-height
  multiplier MUST be 2.1 (see `src/theme/typography.ts`).

## How to install

From the repo root (works on Linux, macOS, Windows — requires Node 18+):

```sh
npm run fonts
```

or directly:

```sh
node scripts/download-fonts.mjs          # download missing
node scripts/download-fonts.mjs --force  # re-download all
```

Windows users may still run `pwsh ./scripts/download-fonts.ps1`; it just
delegates to the Node script.

CI runs `npm run fonts` before the Android build (see
`.github/workflows/release-play-store.yml`), so release AABs always ship with
the real fonts.

## License compliance

All fonts are SIL Open Font License 1.1:

1. Original copyright notices are preserved in the TTF metadata (files are never
   modified).
2. License text ships with the app (Settings → Legal → Licenses).
3. Font files are not sold separately from the app.

## What NOT to do

- ❌ Do not commit the TTF files (they are gitignored — provisioned at build).
- ❌ Do not rename files. The filenames are the PostScript names RN resolves
  `fontFamily` against on Android.
- ❌ Do not add a `fontFamily` in code without adding the matching file to the
  manifest in `scripts/download-fonts.mjs` — it will silently fall back to the
  system font.
