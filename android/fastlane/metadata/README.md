# Play Store listing assets — required before production

The `release-play-store.yml` workflow uploads whatever is present under
`android/fastlane/metadata/android/en-US/`. Text metadata (title, descriptions,
changelogs) is committed. **The visual assets below are NOT committed and must
be added before the listing can go live on the production track** — Google Play
rejects a production listing without a feature graphic and at least two
phone screenshots.

These are genuine captures of the running app; they cannot be generated from
source. Produce them from a signed build on a device/emulator and drop them in
the paths below (all PNG or JPEG, no alpha for the feature graphic).

```
android/fastlane/metadata/android/en-US/images/
├── icon.png                     512×512  (high-res app icon)
├── featureGraphic.png          1024×500  (REQUIRED for production)
├── phoneScreenshots/            REQUIRED — at least 2
│   ├── 1_home.png
│   ├── 2_oracle.png
│   ├── 3_reading.png
│   └── 4_skyclock.png
├── sevenInchScreenshots/        optional — tablet (app supports tablets)
└── tenInchScreenshots/          optional — tablet
```

Screenshot constraints (Play Console): min dimension 320px, max 3840px, aspect
ratio between 1:2 and 2:1. Recommended phone size: 1080×1920 or 1080×2340.

Until these exist, run the release workflow to the **internal** track only, or
complete the listing imagery manually in Play Console.
