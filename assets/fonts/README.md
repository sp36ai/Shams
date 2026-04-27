# Font assets — Shams al-Asrār

This directory holds the four font families the app links into the Android
APK at build time. RN auto-discovers files placed here when `react-native.config.js`
declares `assets: ['./assets/fonts/']` (already configured in this repo).

## Required files

Place these EXACT filenames in this directory before running `npx react-native run-android`:

| Filename | Family / Weight | License | Source |
|---|---|---|---|
| `Cinzel-Regular.ttf` | Cinzel 400 | SIL OFL 1.1 | https://fonts.google.com/specimen/Cinzel |
| `Cinzel-Bold.ttf` | Cinzel 700 | SIL OFL 1.1 | https://fonts.google.com/specimen/Cinzel |
| `CormorantGaramond-Regular.ttf` | Cormorant Garamond 400 | SIL OFL 1.1 | https://fonts.google.com/specimen/Cormorant+Garamond |
| `CormorantGaramond-Italic.ttf` | Cormorant Garamond 400 italic | SIL OFL 1.1 | https://fonts.google.com/specimen/Cormorant+Garamond |
| `CormorantGaramond-SemiBold.ttf` | Cormorant Garamond 600 | SIL OFL 1.1 | https://fonts.google.com/specimen/Cormorant+Garamond |
| `NotoNastaliqUrdu-Regular.ttf` | Noto Nastaliq Urdu 400 | SIL OFL 1.1 | https://fonts.google.com/noto/specimen/Noto+Nastaliq+Urdu |
| `NotoNastaliqUrdu-Bold.ttf` | Noto Nastaliq Urdu 700 | SIL OFL 1.1 | https://fonts.google.com/noto/specimen/Noto+Nastaliq+Urdu |
| `NotoSansDevanagari-Regular.ttf` | Noto Sans Devanagari 400 | SIL OFL 1.1 | https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari |
| `NotoSansDevanagari-Bold.ttf` | Noto Sans Devanagari 700 | SIL OFL 1.1 | https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari |

## Why these specific files?

- **Cinzel**: Carved-stone Roman aesthetic; used for screen headers and the
  app wordmark. Pairs with the spiritual/oracle register.
- **Cormorant Garamond**: Display serif with a literary, contemplative
  personality; used for body text in EN. Italic carries verdict narration.
- **Noto Nastaliq Urdu**: The ONLY high-quality OSS Nastaliq with full
  Urdu glyph coverage. Critical: line-height multiplier MUST be 2.1
  (set in `src/theme/typography.ts`) — Nastaliq is a vertically tall script
  and standard 1.4 line-height clips ascenders/descenders.
- **Noto Sans Devanagari**: Modern sans for Hindi readability across density
  buckets. Used in place of Devanagari serif because the app's UR text is
  already serif-heavy (Nastaliq) and Hindi sans gives visual contrast.

## How to install

### Option A — automated (recommended)

From repo root:

```powershell
pwsh ./scripts/download-fonts.ps1
```

The script downloads all required TTF files from Google Fonts release archives
into this directory.

### Option B — manual

1. Click each Google Fonts link in the table above.
2. Download the ZIP, extract.
3. Copy the matching TTF files into this directory using the EXACT filenames
   from the table.

## How RN picks them up

After files are present, run ONCE per platform:

```sh
npx react-native-asset
```

This rewrites `android/app/src/main/assets/fonts/` symlinks. Then any subsequent
`run-android` invocation links the fonts into the APK.

In code, reference fonts by their Postscript name (already done in
`src/theme/typography.ts`):

```ts
fontFamily: 'CormorantGaramond-Regular'
```

## License compliance

All fonts are SIL Open Font License 1.1. Obligations:

1. ✅ Original copyright notices preserved in the TTF metadata (do not modify the files).
2. ✅ License text shipped with the app (will appear in Settings → Legal → Licenses, Phase 5).
3. ✅ Font files NOT sold separately from the app.

No royalty, attribution required only in the licenses screen (handled in Phase 5).

## What NOT to do

- ❌ Do not commit the TTF files to git. They're in `.gitignore`. Each developer
  runs the download script.
- ❌ Do not rename files. The Postscript names referenced by `typography.ts`
  must match.
- ❌ Do not substitute "similar" fonts. Visual identity is locked; substitutions
  break the design system.
- ❌ Do not subset the fonts to reduce APK size at this stage. Premature
  optimization — Phase 5 will run a one-pass `pyftsubset` after the i18n
  surface is finalized.
