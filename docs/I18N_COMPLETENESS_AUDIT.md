# i18n Completeness — Audit

## Structural parity: guaranteed by the type system

Both `en.ts` and `ur.ts` must satisfy the `StringTable` interface, so a key
missing from either table is a **compile error** — parity cannot silently
drift. The remaining risks are *stale values* (English text left in the Urdu
table) and *hardcoded strings* that never went through `t()`.

## Stale-value scan: clean

Scanned every string value in `ur.ts` for values with no Arabic-script
characters, plus a blunt English-word check. **Zero stale entries** — the Urdu
table is fully translated.

## Hardcoded strings in components

- **Fixed — `AstroVerdictCard`** (main-flow verdict card): the three
  `confidencePhrase` sentences and the 14 `effectDimension` fallback
  descriptions (shown when the server-generated remedy description is absent)
  were hardcoded English. Now a `verdictCard` StringTable section (18 keys,
  en + ur) resolved through `t()`.
- **Deliberate, unchanged — expert-register labels**: the terse technical
  badges in the chart-detail views (`HoraryChartWheel` tab labels
  "Celestial Chain/Witnesses/Celestial Powers", SigRow "Favorable/Denial/
  Neutral/Confirmed/Opposing", `WatchVerdictCard` "STRONG/MODERATE/WEAK/
  CONFLICTED", role tags "Day/Hora/Asc♈"). These sit alongside untranslated
  planet names and the transliterated brand verdicts (MAQBOOL/MARDOOD/…) in a
  deliberately technical register — same policy as the verdict badges. If the
  product later wants these localized, they are enumerated here as the scope.
- **Architectural constraint, unchanged — `ErrorBoundary`** ("The veil
  trembled"): the boundary mounts *above* `I18nProvider`, so `t()` is
  unavailable by design; a crash screen must not depend on the possibly-crashed
  provider tree. English-only fallback is accepted.

## Verified along the way

- `t()` falls back to English and warns in dev on a missing key — the UI can
  never render a blank.
- The dot-path `TranslationKey` type rejects typo'd keys at compile time
  (dynamic lookups, e.g. effect dimensions, go through typed key maps).
