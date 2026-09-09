# Phase 6D-2 — Reconnaissance: Finding 4 (App-Root Dependency Audit)

Read-only reconnaissance on **Finding 4** from `docs/audit/PHASE_6C_1_CLOSURE.md`
§6 / originally `docs/audit/PHASE_6B_CLOSURE.md` §2: *"App-root
dependency audit: 33 vulnerabilities (1 critical, 11 high, 20
moderate, 1 low), all tracing to `xmldom` via `@expo/plist` via
`@react-native-voice/voice` — confirmed build-tooling-only chain."*
Baseline: `49e6ee0`. **No repository file is modified by this
document.**

## 1. Headline correction — the "all tracing to one chain" characterization does not hold

Every prior phase back to the original 6B reconnaissance described
Finding 4 as a single dependency chain
(`@react-native-voice/voice` → `@expo/config-plugins` → `@expo/plist`
→ `xmldom`). **This reconnaissance re-ran `npm audit --omit=dev`
with full JSON output and enumerated every one of the 32 distinct
package entries it reports (33 individual advisories, matching the
same total this audit has recorded since Phase 6B) — the single-chain
description is not accurate.** The count (33: 1 critical, 11 high, 20
moderate, 1 low) is re-confirmed exactly; **what those 33 advisories
trace to is not one chain, it is at least five independent ones.**
This is disclosed and corrected here, not glossed over — consistent
with this audit's own precedent (`PHASE_6B_REVIEW.md` already modified
Findings 5 and 7 for similar reasons).

```
$ npm audit --omit=dev
33 vulnerabilities (1 low, 20 moderate, 11 high, 1 critical)
```

Exact figure unchanged. Root-cause breakdown, independently traced via
`npm ls <package>` for every one of the 32 named entries in the audit's
own JSON output:

| # | Root chain | Packages covered | Category |
|---|---|---|---|
| 1 | `@react-native-voice/voice@3.2.4` → `@expo/config-plugins@2.0.4` → `@expo/plist@0.0.13` → `xmldom@0.5.0` | `xmldom` (critical), `@expo/plist`, `@expo/config-plugins`, `@react-native-voice/voice` itself, `xcode`, `uuid`, one `brace-expansion` instance | Expo config-plugin tooling — the chain every prior phase already named |
| 2 | `@react-native-firebase/auth@19.3.0` → `plist@3.1.1` → `@xmldom/xmldom@0.9.10` | `@xmldom/xmldom` (high) | **Newly identified this reconnaissance** — a second, independent Expo-config-plugin chain, not part of chain 1 |
| 3 | `@react-native-community/cli@15.0.1` and its sub-packages (`cli-config`, `cli-doctor`, `cli-platform-android`, `cli-platform-apple`, `cli-platform-ios`) | `joi`, `fast-xml-parser`, `@react-native-community/cli*` | React Native's own developer CLI (`react-native start`/`doctor`/etc.) |
| 4 | `react-native@0.78.3` → `@react-native/community-cli-plugin` | `@react-native/community-cli-plugin` | RN's own dev-server CLI plugin |
| 5 | `@react-native/metro-config` → `metro-config` → `metro` → `image-size`; and → `cosmiconfig` → `js-yaml` | `metro`, `metro-config`, `metro-transform-worker`, `image-size`, `js-yaml` (one of two instances) | Metro bundler — build/dev-server tooling |
| 6 | `@babel/core`/`@babel/preset-env` → `browserslist` | `browserslist` | Babel transpilation target resolution |
| 7 | `@react-navigation/native@7.3.8` → `@react-navigation/core@7.21.5` → `@react-navigation/routers` → `nanoid@3.3.15`; and → `query-string@7.1.3` → `decode-uri-component@0.2.2` | `nanoid`, `query-string`, `decode-uri-component`, `@react-navigation/*` | **The only chain rooted in a genuinely on-device, always-loaded runtime dependency** — examined in detail in §3 |

Chain 1 alone (the previously-reported "whole" finding) accounts for
roughly a third of the 33 advisories. Chains 2–6 were not previously
enumerated by name anywhere in this audit's own record.

## 2. Chains 1–6 — re-confirmed build-tooling-only, and in this project doubly unreachable

### 2.1 Chain 1 (the previously-known chain) — reachability re-confirmed more precisely than before

- This project has **no `ios/` directory at all** —
  `ls -d ios` fails; only `android/` exists. Confirmed via direct
  directory listing, not inferred.
- `expo prebuild`/`expo-cli`/`npx expo` never appears anywhere in
  `package.json`, `.github/workflows/`, or `scripts/` — confirmed via
  `grep`, zero matches.
- `package.json` has **zero** references to `expo` anywhere, direct or
  dev — confirmed via case-insensitive `grep`.
- `@react-native-voice/voice`'s own `@expo/config-plugins` dependency
  exists specifically to support Expo's config-plugin system
  (auto-injecting iOS permission strings during `expo prebuild`) — a
  build step this project's own toolchain never invokes, for a
  platform (`ios/`) this project does not even have a native project
  for.

**Reachability conclusion, stronger than any prior phase's own
framing: this chain is not merely "build-tooling, therefore lower
risk" — it is provably inert in this specific repository. There is no
code path, CI step, or build command anywhere in this project that
ever exercises `@expo/config-plugins`, `@expo/plist`, or `xmldom` at
all.**

### 2.2 Chain 2 (`@xmldom/xmldom` via `@react-native-firebase/auth`) — newly found, same conclusion

```
$ npm ls @xmldom/xmldom
`-- @react-native-firebase/auth@19.3.0
  `-- plist@3.1.1
    `-- @xmldom/xmldom@0.9.10
```

Traced the exact call site: `plist` is required only from
`node_modules/@react-native-firebase/auth/plugin/build/ios/urlTypes.js`
— itself inside that package's `plugin/` directory, i.e. **this is also
an Expo config plugin** (registering iOS custom URL types during
`expo prebuild`), not runtime JS shipped in the app bundle. Same
conclusion as §2.1 applies for the same two independent reasons: no
`ios/` target exists, and `expo prebuild` is never invoked by this
project.

### 2.3 Chains 3–6 — developer/build tooling, never shipped to a device

- **Chain 3** (`@react-native-community/cli*`): the CLI package used to
  run `react-native start`/`doctor`/`run-android` from a developer's or
  CI machine. Runs on the machine invoking the command; never bundled
  into the app that ships to end users.
- **Chain 4** (`@react-native/community-cli-plugin`): a plugin *for*
  that same CLI, bundled alongside `react-native` itself but likewise
  a dev-server-time package, not runtime bridge/JS-engine code.
- **Chain 5** (Metro: `metro`/`metro-config`/`metro-transform-worker`/
  `image-size`, plus `cosmiconfig`'s `js-yaml`): Metro is the JS
  bundler — it runs when building/bundling the app (`npx react-native
  bundle`, or the Metro dev server), producing the JS bundle that ships
  inside the app. Metro's own code, including its `image-size`
  dependency (used to size static image assets during bundling), does
  not itself ship inside that bundle or run again once built.
- **Chain 6** (`browserslist` via Babel): resolves browser/target
  compatibility lists during Babel transpilation at build time; not
  present in the transpiled output.

None of chains 3–6 is Expo-specific (unlike 1–2) — their
build-tooling-only status does not depend on this project's lack of an
iOS target, only on the general fact that a CLI tool, a bundler, and a
transpiler all run before the app exists as a shippable artifact, not
after.

## 3. Chain 7 — the one genuinely on-device runtime dependency chain, examined without dismissal

`@react-navigation` is a core, always-loaded navigation library in
this app (`isDirect: true` in the audit output for both
`@react-navigation/native` and `@react-navigation/bottom-tabs`/
`native-stack`) — unlike chains 1–6, this one runs on the user's
device as part of the shipped app, and deserves scrutiny on its own
terms rather than a blanket "it's a dependency chain, therefore
build-tooling" assumption.

### 3.1 `nanoid` (high) — vulnerable precondition confirmed not met by this app's own call pattern

The advisory covers two scenarios: a non-secure generator called with
a negative `size`, or a *custom* generator called with `size === 0`.
Every call site in `@react-navigation/routers` (the only place this
app's dependency tree calls `nanoid`) was read directly:

```
$ grep -n "nanoid" node_modules/@react-navigation/routers/src/*.tsx
BaseRouter.tsx:      key: `${route.name}-${nanoid()}`
DrawerRouter.tsx:     key: `drawer-${nanoid()}`
StackRouter.tsx:      key: `stack-${nanoid()}` / `${route.key || ...}-${nanoid()}`
```

Every call is `nanoid()` with **zero arguments** — the default
generator, the default fixed positive size, never a custom generator,
never an explicit negative or zero size. The advisory's own
precondition is not met by how this library actually calls the
function. **Confirmed by reading the exact call sites, not assumed.**

### 3.2 `decode-uri-component`/`query-string` (moderate) — the one item this reconnaissance flags most distinctly, not folded into "build tooling"

`query-string` is used by `@react-navigation/core` in exactly two
files:

- `getPathFromState.tsx` — serializes the app's own, internally-
  generated navigation state into a URL path. Input here is always
  app-controlled state, never external text.
- `getStateFromPath.tsx` — the reverse: **parses an incoming URL
  string into navigation state.** This is the function React Navigation
  uses to handle deep links, and it is the one call site in this whole
  audit where the vulnerable package (`decode-uri-component`, a DoS via
  exponential decoding of malformed percent-encoded input) could
  plausibly receive attacker-influenced input, if this app ever fed an
  externally-supplied URL into it.

**This app does not.** Confirmed directly:

```
$ grep -rln "getStateFromPath\|LinkingOptions\|linking:" src/
(no output)
```

This app's `NavigationContainer` is never configured with a `linking`
prop anywhere in `src/` — deep linking is not wired up at all, which
is the only mechanism by which `getStateFromPath` (and therefore
`query-string`'s vulnerable parsing) would ever receive external input.
`getStateFromPath` is loaded as part of the library, but this app never
calls it with anything but its own internally-generated values (if it
is called at all in this configuration).

**This is disclosed as the most substantive finding in this whole
reconnaissance, and it is explicitly not the same conclusion as
chains 1–6.** It is not "this code never runs at all" (chains 1–6's
conclusion) — it is "this code is loaded and is part of a genuinely
runtime, on-device library, but the specific vulnerable code path
requires a capability (deep-link URL parsing) this app's current
configuration does not use." If deep linking is ever added to this
app in the future, this specific dependency (`decode-uri-component`
via `query-string` via `@react-navigation/core`) would need to be
re-assessed at that time, not assumed still-inert.

## 4. What a real remediation would require — corrected from the prior "single fix" framing

Prior phases' language ("fix available via `npm audit fix --force`,
would install `@react-native-voice/voice@3.1.5`") implied a single
available fix. **This is only true for chain 1** — `npm audit fix
--force`'s own suggested downgrade (`@react-native-voice/voice`
3.2.4 → 3.1.5, a `isSemVerMajor: true` breaking change) removes chain
1's `@expo/config-plugins` dependency entirely (confirmed: `npm view
@react-native-voice/voice@3.1.5 dependencies` shows only `invariant`,
no `@expo/config-plugins` at all — the 3.2.x line added that
dependency; 3.1.x never had it). It does not touch chains 2–7 at all,
which come from entirely different dependency roots
(`@react-native-firebase/auth`, `@react-native-community/cli`,
`metro`, `@babel/*`, `@react-navigation/*`) that `npm audit fix` has no
single suggested resolution for.

**Not evaluated by this reconnaissance, and not recommended as a
default** — each would need its own separate scoping if pursued:

- **Chain 1**: downgrading `@react-native-voice/voice` to 3.1.5 is
  npm's own suggested path; whether the JS-API surface this app
  actually uses (`src/hooks/useSpeechToText.ts`) is unaffected by that
  downgrade was not verified by this reconnaissance (would require
  diffing the two published tarballs or the upstream changelog — a
  step for an implementation authorization, not recon). An alternative,
  narrower option exists: an npm `overrides` entry aliasing `xmldom` to
  the maintained fork (`"xmldom": "npm:@xmldom/xmldom@^0.9.0"`), which
  would not require touching `@react-native-voice/voice`'s own pinned
  version at all — not tested or committed to by this reconnaissance.
- **Chain 2**: the same aliasing technique could apply to
  `@react-native-firebase/auth`'s `plist`→`@xmldom/xmldom@0.9.10`
  dependency, bumping to the latest `@xmldom/xmldom@0.9.12` if that
  patches this specific advisory (not checked).
- **Chains 3–6**: would require version bumps to `@react-native-community/cli`,
  `react-native`/Metro, and Babel's own toolchain — several of these
  are pinned to versions this app's current React Native 0.78.3 target
  is compatible with; a bump could be a much larger undertaking than a
  narrow security fix and was not assessed for compatibility risk here.
- **Chain 7**: no code or dependency change is indicated by this
  reconnaissance's own findings — §3 concludes the vulnerable
  preconditions are not met by this app's current usage. If a future
  change to this app ever adds deep-link handling via `getStateFromPath`,
  that would be the moment to revisit `query-string`'s own patch status
  (or whether a `linking.config.screens` custom parser could avoid the
  vulnerable path entirely), not now.

**This reconnaissance takes no position on whether any of this is worth
doing.** Every chain traced in §2 is confirmed inert in this project's
actual build and runtime; §3's chain is confirmed loaded but not
exercised under this app's current configuration. There is no
demonstrated live exploitation path anywhere in this dependency tree
today.

## 5. Hard-stop determination

**No hard-stop condition was triggered.** Checked explicitly:

- No P0/P1 vulnerability was found. Every chain in §2 is confirmed
  unreachable in this project's own build/runtime (no iOS target, no
  Expo tooling invoked, or genuinely build-time-only code). Chain 7
  (§3) is loaded but its specific vulnerable precondition (deep-link
  URL parsing) is confirmed not exercised by this app's current
  configuration.
- The correction to Finding 4's own characterization (§1) is a
  documentation-accuracy finding about a prior phase's own
  description, not a newly discovered live security defect.
- Nothing in this reconnaissance required stopping before completion.

## 6. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this reconnaissance is written against: `49e6ee0` (the
  6D-1 Closure).
- Working tree: clean before and after this document — confirmed via
  `git status --porcelain` at the start of this reconnaissance and
  immediately before this document was written.
- No production, test, Firestore-rule, CI-workflow, or
  deployment-configuration file is touched — the only file this phase
  adds is this document.
- No implementation occurred. No dependency version was changed. No
  `overrides` entry was added or tested against the real tree.

---

## Status

**PHASE 6D-2 RECONNAISSANCE (Finding 4): COMPLETE.**

| Layer | Status |
|---|---|
| Phase 6D-1 | ✅ CLOSED (`49e6ee0`) |
| 6D-2 reconnaissance (Finding 4) | ✅ Complete (this document) |
| 6D-2 implementation | 🔲 Not yet authorized |
| 6D-2 Review / Closure | 🔲 Not applicable until implementation is scoped |
| Findings 5–7 | ⛔ Untouched |
| Production readiness | ❌ Not established |

Awaiting a separate, explicit authorization for whichever remediation
(if any) the owner wants pursued among §4's un-evaluated options, or a
decision to close Finding 4 with its corrected characterization and no
further code change.
