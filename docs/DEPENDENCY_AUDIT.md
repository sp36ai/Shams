# Dependency / Supply-chain — Audit

Distinction that matters for a mobile app: **what actually ships or runs** vs.
**build/test tooling**. A vulnerability in dev tooling is not exploitable by an
app user or a server client.

## Shipped Android app (APK runtime) — clean
The app's runtime `dependencies` (react-native, `@react-native-firebase/*`,
react-navigation, zustand, mmkv, iap, svg, reanimated, gesture-handler,
safe-area, screens) have **no reported vulnerabilities**.

The 16 root-package advisories are all **dev/build tooling, not bundled in the
APK**:
- `@react-native-community/cli*` → `fast-xml-parser` — RN build tooling.
- `firebase` (JS SDK) → `undici` (1 high) — used only for the Firestore
  **rules tests** and the web harness; the mobile app ships native
  `@react-native-firebase/*`, which does not use `undici`.

Non-breaking fixes are **not available** for these (they'd require major RN CLI
/ firebase-JS bumps that risk the build and rules-test harness). Left as-is —
not runtime-exploitable. Revisit on an RN upgrade.

## Cloud Functions (deployed server runtime) — fixed the high/critical
Production deps are just `firebase-admin`, `firebase-functions`, `zod`; the
vulnerabilities were transitive.

**`npm audit fix` (non-breaking) applied.** Deployed-runtime advisories
(`--omit=dev`) went from **18 (4 high, 1 critical)** to **9 (all moderate, zero
high/critical)**. Cleared from the runtime tree: `@grpc/grpc-js` (server-crash),
`protobufjs` (code injection), `form-data` (CRLF), `fast-xml-builder`,
`websocket-driver` (resource-limit bypass). Only `functions/package-lock.json`
changed; `tsc` clean and all 23 tests pass.

Remaining:
- **9 moderate** in the deployed tree — transitive in `firebase-admin`/
  `firebase-functions` with no non-breaking fix yet. Clear by bumping
  `firebase-admin` (^12→^13) and `firebase-functions` (^5→^6) on a maintenance
  window (majors — test the deploy).
- The remaining **criticals in the full functions audit are `vitest`/`vite`** —
  dev test tooling, **not deployed**. Fix is a `vitest@4` major upgrade; do it
  when convenient (verify the 2 test files still run).

## Recommendations
- Add `npm audit --omit=dev --audit-level=high` as a non-blocking CI step for
  both packages to catch new **runtime** highs early.
- Schedule the `firebase-admin`/`firebase-functions` major bumps and the
  `vitest@4` upgrade as maintenance tasks.
