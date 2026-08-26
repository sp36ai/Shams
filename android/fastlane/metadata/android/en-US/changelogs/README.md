# Play Store release notes — two conventions live in this directory

This directory is read by **two different things that disagree on filenames**.
Getting this wrong fails silently: the release still ships, it just carries no
release notes at all. That is what happened for every release up to and
including run #104 — `.github/workflows/release-play-store.yml` has always
pointed `whatsNewDirectory` here, and this directory has never contained a file
the uploader could see.

## 1. `whatsnew-<locale>` — what actually ships (authoritative)

`r0adkll/upload-google-play`, the action our release workflow uses, reads this
directory and keeps **only** files matching `whatsnew-<locale>`. It then parses
the locale as *everything after the first dash*.

Two rules follow, and both matter:

- **The name must start with `whatsnew-`.** Fastlane-style names (`4.txt`,
  `default.txt`) do not match the filter and are silently skipped.
- **There must be no file extension.** `whatsnew-en-US.txt` *does* pass the
  filter, but the locale then parses as `en-US.txt`, which is not a real Play
  locale — so it fails at the API instead of silently doing nothing.

So the only correct name for US English is exactly:

    whatsnew-en-US

Unlike fastlane's changelogs, this file is **not keyed to a versionCode**. It is
"the notes for whatever release this run produces", so **update it as part of
the change you are shipping**, not afterwards.

Play Store caps release notes at **500 characters** per locale.

### Adding other locales

The app ships English, Urdu and Hindi, but only `whatsnew-en-US` exists here.
Adding `whatsnew-ur` / `whatsnew-hi` would work mechanically — the action reads
every `whatsnew-*` file in this one directory — **but Play rejects a locale that
is not already an active store listing language**, which would fail the upload
step of a release. Confirm the listing languages in Play Console before adding
them.

## 2. `<versionCode>.txt` / `default.txt` — fastlane convention (unused today)

`3.txt` and `4.txt` are the historical fastlane changelogs, kept as a record of
what those releases told users. Nothing in CI reads them right now; they would
only matter if this project later adopts `fastlane supply`.

`default.txt` is kept in sync with `whatsnew-en-US` so the two conventions never
contradict each other. Before this was documented, `default.txt` still advertised
"Toggle between Astronomical and Watch Oracle views anytime" — a mode that has
since been removed from the app.
