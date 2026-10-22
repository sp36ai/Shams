/**
 * emulatorGuard — the gate every emulator suite passes before it touches
 * Firestore or Auth.
 *
 * utils/admin.ts falls back to the production project id when none is set,
 * so a suite that writes, clears or deletes must be certain where it points:
 *
 *   - the project must be exactly `demo-shams` (a demo- project never reaches
 *     a real backend);
 *   - every emulator host must be on this machine;
 *   - with REQUIRE_EMULATOR=1 (CI, `npm run test:emulator:ci`), a missing
 *     emulator is an error, not a skip — a green run then means the suites
 *     actually ran.
 *
 * Without REQUIRE_EMULATOR and without emulator hosts, `on` is false and the
 * suite skips, so plain `npm test` stays fast and offline.
 */

export const EMULATOR_PROJECT = 'demo-shams';

type Emulator = 'firestore' | 'auth';

const HOST_VAR: Record<Emulator, string> = {
  firestore: 'FIRESTORE_EMULATOR_HOST',
  auth: 'FIREBASE_AUTH_EMULATOR_HOST',
};

const LOOPBACK = /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/;

export interface EmulatorTarget {
  readonly on: boolean;
  readonly project: string;
  readonly hosts: Readonly<Record<Emulator, string>>;
}

export function emulatorTarget(needs: readonly Emulator[]): EmulatorTarget {
  const project = process.env.GCLOUD_PROJECT ?? '';
  const hosts = {
    firestore: process.env[HOST_VAR.firestore] ?? '',
    auth: process.env[HOST_VAR.auth] ?? '',
  };
  const required = process.env.REQUIRE_EMULATOR === '1';
  const missing = needs.filter(e => hosts[e] === '');
  const anySet = needs.some(e => hosts[e] !== '');

  if (required && missing.length > 0) {
    throw new Error(
      `REQUIRE_EMULATOR=1 but ${missing.map(e => HOST_VAR[e]).join(', ')} not set: the emulator suites would be skipped`,
    );
  }
  if (anySet || required) {
    if (project !== EMULATOR_PROJECT) {
      throw new Error(
        `refusing to run: GCLOUD_PROJECT must be "${EMULATOR_PROJECT}", got "${project}"`,
      );
    }
    for (const e of needs) {
      if (hosts[e] !== '' && !LOOPBACK.test(hosts[e])) {
        throw new Error(
          `refusing to run: ${HOST_VAR[e]} must be a local emulator, got "${hosts[e]}"`,
        );
      }
    }
  }
  return { on: missing.length === 0, project, hosts };
}
