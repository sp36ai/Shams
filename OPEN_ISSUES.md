# Open issues — Shams al-Asrār

Unresolved work, who owns the next step, and the evidence behind each item.
Last updated **2026-10-26**. Update an item's status when it changes and
delete it once it's closed (git history keeps the record).

**Owner** names who acts next: **Owner** = the app owner (Astro Sarfaraz /
repo owner); **Claude** = a Claude Code session, only with the owner's
go-ahead for anything pushed, released or deployed.

**Status:** 🔴 blocking · 🟠 has a deadline · 🟡 open · ⚪ owner decision

---

## Blocking

### 1. GitHub Actions is not starting jobs 🔴

- **Owner:** Owner
- **Since:** 2026-10-25. The last green CI run was on 2026-10-24.
- **Re-checked 2026-10-26:** still blocked. The scheduled run `40298632437`
  (09:19 UTC) got a job with no runner and no steps and failed after 4 s.
- **Evidence:** every job on PR #204 and #205 "fails" ~3 s after starting, with
  no steps, empty check output and job logs returning 404. A docs-only commit and
  the unrelated Security Rules workflow fail the same way.
- **Likely cause:** an account-level Actions block (spending limit, failed
  payment or used-up minutes). The reason is shown on the run page, e.g.
  `actions/runs/40200655305`.
- **Blocks:** CI on every PR and, under the release policy, every Play release.
- **Next:** read the run page's banner, fix billing/settings, then re-run.

### 2. Build 219 rejected by Play: no 16 KB page support 🔴

- **Owner:** Owner (local build + device test), then Claude (CI follow-up)
- **Evidence:** Play Console, bundle 219 (0.1.7): "Memory page size: Does not
  support 16 KB". Only `libcrashlytics*.so` (arm64-v8a, x86_64) are flagged.
- **Cause:** `@react-native-firebase` 19.3.0 pins Firebase BoM 32.8.1, which maps
  `firebase-crashlytics-ndk` to 18.6.4. 16 KB support arrived in 19.0.2.
- **Fix in review:** PR #205 pins BoM 33.16.0, which maps the NDK to 19.4.4.
  Not build-verified.
- **Next:**
  1. `app:dependencies` shows `crashlytics-ndk` 19.4.4.
  2. `bundleRelease` compiles.
  3. The `.so` files are 16 KB-aligned.
  4. On a device: App Check first, then sign-in, an Oracle question by text
     and by voice, and history.
- **Fallback:** if step 2 fails, exclude `firebase-crashlytics-ndk` for this
  release, then upgrade React Native Firebase as its own task.
- **Then:** a pipeline build with versionCode ≥ 220 replaces 219. Set the
  Roll-out percentage in Play Console before saving.

---

## Deadlines

### 3. Guard-test debt expires 2026-11-24 🟠

- **Owner:** Owner (decisions), Claude (code changes once decided)
- After this date, CI fails on **every PR**, hotfixes included, until each of the
  7 remaining debt entries in `guards/allowlist.json` is fixed or re-dated with a
  recorded owner decision.
  - **Closed 2026-10-26 (PR #207, owner decision 2026-10-25):** Sky Clock
    "Nakshatra" / "SIDEREAL (LAHIRI)" / "full KP engine" disclaimer, the Play title
    and changelog 3; their 6 allowlist entries are removed. The **live** Play
    listing title must still be changed by hand in Play Console.
  - **User-facing copy (needs owner wording):**
    - Readings detail: "Significators", "Moon Sub-Lord"
      (`src/screens/ReadingsScreen.tsx`)
    - Istikhārah remedy: "conflicting significators"
      (`functions/src/oracle/remedyLibrary.ts`)
  - **Naming (needs owner OK to rename):**
    - `KP_NAVA_GRAHAS` (`src/astrology/primitives/constants.ts`)
    - The `src/astrology/kp/rules/` → `rkp/lookupTables` rename
  - Most items also have an entry for the generated engine mirror; both go
    together.
- **Next:** plan the copy-fix PR well before 2026-11-24.

### 4. Play Billing Library 8+ requirement 🟠

- **Owner:** Owner
- Google requires Billing Library **8 or later** for new apps and updates from
  2026-08-31. An extension is available to **2026-11-01**.
- **Repo state:** react-native-iap 16.6.2 → openiap-google 3.5.2 →
  `com.android.billingclient:billing:9.1.0`. That reading comes from dependency
  files, not from a build.
- **Next:** confirm with
  `gradlew app:dependencies --configuration releaseRuntimeClasspath | findstr billing`
  (expect 9.1.0). If you're relying on the extension, note that it ends 2026-11-01.

---

## Security

### 5. Rotation of possibly exposed keys is unconfirmed 🟡

- **Owner:** Owner
- **Evidence:** an August rotation is recorded as complete: commit `a62464a`
  (2026-08-15), old GCP key deleted. That record is only on the branch
  `claude/app-service-connections-cfgi5f`, not on `main`. Nothing in the repo
  confirms the October "rotate exposed tooling key" work.
- **Next:** check each key's creation date in its console (Google Cloud,
  Anthropic, GitHub secrets). Rotate any key created before the exposure.

### 6. Live Oracle output is not checked for engine/Sanskrit terms 🟡

- **Owner:** Owner (approve scope)
- **Evidence:** `narrationValidator.ts` blocks RKP/KP but not sub-lord,
  significator, Lahiri, Placidus or Sanskrit terms. CI checks only deterministic
  output (guard G4), and live model output needs the API key.
- **Next:** extending the validator changes production behaviour, so it needs
  its own approved task.

---

## Product / methodology decisions

### 7. OD-5: Ruling Planet count ⚪

- **Owner:** Owner
- CLAUDE.md says exactly 5, with horaLord as a witness only.
  `docs/RKP_RULES_FROM_SARFARAZ.md` §4 says 5 + Hora Lord as a 6th confirmatory
  lord. `getRulingPlanets` returns 6, including horaLord. `allWitnesses` does not
  exist.
- **Next:** decide the rule. Add the owner's source document
  (`shamsi_method.txt`, not in the repo) to `docs/` as provenance. Guard G5 stays
  an `it.todo` until then.

### 8. OD-2: native-script Hindi/Urdu terms ⚪

- **Owner:** Owner
- `hi.ts`/`ur.ts` use लग्न / لگن (lagna) as the Ascendant label, and ग्रह as the
  ordinary word for planet. Guard G4 scans Latin script only.
- **Next:** decide whether native-script terms are banned.

### 9. Other owner decisions carried over from CLAUDE.md §10 ⚪

- **Owner:** Owner
- Location: does the watch engine stay location-free (CLAUDE.md 9e)?
- Legacy readings: keep, relabel or hide the "Significators / Moon Sub-Lord" block.
- Display spellings: Qamar/Zuhrah/Ras–Dhanab vs al-Qamar/Zuhra/Rahu–Ketu.
- Remedy mapping and EN/UR/HI narration wording are still "provisional"
  (rules doc §8).

---

## Reliability / testing

### 10. Oracle "silent failure" (reported August 2026) 🟡

- **Owner:** Owner (device test), Claude (log analysis)
- No commit, log line or device test in the repo records a fix.
- **Next:** a device test plus a Cloud Logging check that requests reach
  `askWatchOracle`, using its stage-tagged diagnostics.

### 11. No owner-approved Oracle regression set 🟡

- **Owner:** Owner (pick questions and acceptable outcomes), Claude (write tests)
- Related coverage exists: 111 golden-corpus cases, ~20 Oracle test files and
  guard G4. None of it is a small set of outputs the owner has signed off.
- **Next:** approve 5–8 fixture questions and their expected outcomes.

### 12. Testing overrides still on 🟡

- **Owner:** Owner
- Free/trial limit is 50/day (`functions/src/config.ts`,
  `src/stores/quotaStore.ts`; revert both together), all themes are unlocked
  (`theme/themes.ts`), and there's a TEMPORARY diagnostic in `src/App.tsx`.
- **Next:** decide when to revert, before a public production release.

### 13. E2E secrets missing (issue #130) 🟡

- **Owner:** Owner
- The settings-signout flow needs the `E2E_TEST_ACCOUNT_*` GitHub secrets.

---

## Housekeeping

### 14. Project instructions are partly stale 🟡

- **Owner:** Owner (merge/approve), Claude (edits)
- The corrected `CLAUDE.md` (#204 merged with #208's version) is in the
  integration PR, not yet on `main`. Billing line and guard rule are now in it.
- 29 `.md` files at the repo root include stale `*_STATUS*`/`PRODUCTION_*`
  reports.
- The KP-era `CLAUDE.md` on `claude/affectionate-ptolemy-q3MVn` must not be
  merged.
- **Next:** a keep / archive / delete list for the root reports, for owner approval.

### 15. Kotlin version to watch 🟡

- **Owner:** Claude (if it appears)
- openiap-google 3.5.2 declares kotlin-stdlib 2.2.0, and the project pins Kotlin
  2.1.20. This normally builds fine. Watch for Kotlin metadata errors in release
  builds.
