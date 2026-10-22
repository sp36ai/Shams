/**
 * emulatorGuard — the emulator suites write, clear and delete, so the gate
 * in front of them must refuse anything that is not the local demo project,
 * and in CI must turn "no emulator" into a failure rather than a skip.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { emulatorTarget } from './emulatorGuard';

const KEYS = [
  'GCLOUD_PROJECT',
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'REQUIRE_EMULATOR',
];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
  KEYS.forEach(k => delete process.env[k]);
});
afterEach(() => {
  KEYS.forEach(k => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
});

function set(env: Record<string, string>): void {
  Object.assign(process.env, env);
}

describe('emulatorGuard', () => {
  it('with no emulator and no requirement, the suites skip', () => {
    expect(emulatorTarget(['firestore', 'auth']).on).toBe(false);
  });

  it('runs against local emulators on demo-shams', () => {
    set({
      GCLOUD_PROJECT: 'demo-shams',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8181',
      FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
    });
    expect(emulatorTarget(['firestore', 'auth']).on).toBe(true);
  });

  it.each([['shams-app-4d0e7'], ['demo-other'], ['']])(
    'refuses project "%s" whenever an emulator host is set',
    project => {
      set({ GCLOUD_PROJECT: project, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8181' });
      expect(() => emulatorTarget(['firestore'])).toThrow(/must be "demo-shams"/);
    },
  );

  it.each([['firestore.googleapis.com:443'], ['10.0.0.5:8080'], ['127.0.0.1']])(
    'refuses a non-local emulator host "%s"',
    host => {
      set({ GCLOUD_PROJECT: 'demo-shams', FIRESTORE_EMULATOR_HOST: host });
      expect(() => emulatorTarget(['firestore'])).toThrow(/must be a local emulator/);
    },
  );

  it('with REQUIRE_EMULATOR=1, a missing emulator fails instead of skipping', () => {
    set({
      REQUIRE_EMULATOR: '1',
      GCLOUD_PROJECT: 'demo-shams',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8181',
    });
    expect(() => emulatorTarget(['firestore', 'auth'])).toThrow(
      /FIREBASE_AUTH_EMULATOR_HOST not set/,
    );
  });

  it('with REQUIRE_EMULATOR=1, the project is checked even before any host is set', () => {
    set({ REQUIRE_EMULATOR: '1', GCLOUD_PROJECT: 'shams-app-4d0e7' });
    expect(() => emulatorTarget([])).toThrow(/must be "demo-shams"/);
  });
});
