/**
 * The privacy policy must say what the code does, in every copy.
 *
 * hosting/privacy-policy.html is the one published (firebase.json serves
 * hosting/); the root and docs/ copies must be byte-identical so no stale
 * version can be read anywhere. The log-retention figure is not written by
 * hand: the hosting deploy reads it from Cloud Logging and fills the
 * {{LOG_RETENTION_DAYS}} token (.github/workflows/deploy-firebase-hosting.yml).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';

const ROOT = join(__dirname, '../../..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

const served = read('hosting/privacy-policy.html');
const text = served.replace(/\s+/g, ' ');

describe('privacy policy copies', () => {
  it('root and docs/ copies are identical to the served one', () => {
    expect(read('privacy-policy.html')).toBe(served);
    expect(read('docs/privacy-policy.html')).toBe(served);
  });

  it('carries exactly one placeholder, the log retention the deploy fills in', () => {
    expect(served.match(/\{\{[A-Z_]+\}\}/g)).toEqual(['{{LOG_RETENTION_DAYS}}']);
    const workflow = read('.github/workflows/deploy-firebase-hosting.yml');
    expect(workflow).toContain('s/{{LOG_RETENTION_DAYS}}/${days}/g');
    expect(workflow).toContain("--format='value(retentionDays)'");
  });
});

describe('privacy policy matches behaviour', () => {
  it('"about a day" for the deleted-account marker matches its TTL', () => {
    expect(text).toContain('is kept for about a day');
    expect(read('functions/src/utils/accountState.ts')).toContain(
      'const MARKER_TTL_MS = 24 * 60 * 60 * 1000;',
    );
  });

  it('describes immediate deletion, not the old 30-day promise', () => {
    expect(text).toContain('immediately and permanently deletes');
    expect(text).not.toContain('permanently deleted within 30 days');
  });

  it('does not call the correlation codes anonymous or one-way', () => {
    expect(text).toContain('made with a secret key');
    expect(text).toContain('they are not anonymous');
    expect(text).not.toMatch(/one-way hash/i);
    expect(read('functions/src/utils/keyedHash.ts')).toContain("createHmac('sha256'");
  });

  it('discloses that request logs carry IP addresses', () => {
    expect(text).toContain('including your IP address');
  });

  it('discloses the raw IPs and unkeyed codes older audit records held, and that only those fields are removed', () => {
    expect(text).toContain(
      'Audit records written before this version of the policy could also hold your IP address itself, or older codes made without a secret key; we remove those fields from our audit and security records and keep the rest of each record.',
    );
    const migration = read('functions/src/maintenance/stripLegacyLogFields.ts');
    expect(migration).toContain(
      "export const FIELDS = ['ipAddress', 'ipHash', 'questionHash'] as const;",
    );
    expect(migration).toContain(
      "export const COLLECTIONS = ['auditLogs', 'securityEvents'] as const;",
    );
    expect(migration).not.toMatch(/batch\.delete\(|\.ref\.delete\(|recursiveDelete/);
    const deploy = read('.github/workflows/deploy-functions.yml');
    for (const step of ['--once)', '--apply --once --expect "$EXPECTED"', '--verify']) {
      expect(deploy).toContain(step);
    }
  });

  it('does not claim legacy data is already erased everywhere: backups and old logs expire on their own schedule', () => {
    expect(text).toContain('Any copies in database backups are not changed');
    expect(text).toContain(
      'Logs written before this version of the policy may also contain your IP address itself or the older codes',
    );
    expect(text).not.toMatch(
      /(have|has) been (removed|deleted|erased)|all (historical|old|legacy) (data|records)/i,
    );
  });

  it('names Anthropic, the provider the code actually calls, and no other', () => {
    expect(text).toContain("Anthropic's Claude model");
    expect(text).not.toMatch(/OpenAI/i);
  });

  it('describes location as on-device only, and not used for readings', () => {
    expect(text).toContain('never sent to our servers');
    expect(text).toContain('Readings are unaffected');
    expect(text).not.toContain('disable chart generation');
    // True by construction: the reading request schema is strict and has no
    // coordinates, so the server rejects any request that carries them.
    const validate = read('functions/src/middleware/validate.ts');
    const start = validate.indexOf('export const AskWatchOracleSchema');
    const block = validate.slice(start, validate.indexOf('.strict();', start));
    expect(start).toBeGreaterThan(-1);
    expect(block).not.toMatch(/\b(lat|lon|latitude|longitude)\b\s*:/);
  });

  it('says the saved location and local data are cleared on sign-out and deletion, as the app does', () => {
    expect(text).toContain('until you sign out or delete your account');
    expect(text).toContain(
      "On the device you delete it from, it also removes your saved readings, location, name, mother's name and onboarding answers",
    );
    const authStore = read('src/stores/authStore.ts');
    const signOut = authStore.slice(authStore.indexOf('signOut: async'));
    expect(signOut.slice(0, signOut.indexOf('auth().signOut()'))).toContain('clearLocation()');
    const settings = read('src/screens/SettingsScreen.tsx');
    const handler = settings.slice(settings.indexOf('const handleDeleteAccount'));
    expect(handler).toMatch(/resetForNewAccount\(\);[\s\S]*await signOut\(\);/);
    const reset = read('src/stores/settingsStore.ts');
    const resetBody = reset.slice(reset.indexOf('resetForNewAccount: (): void =>'));
    for (const key of ['SEEKER_NAME', 'MOTHER_NAME', 'ONBOARDING_ANSWERS']) {
      expect(resetBody.slice(0, resetBody.indexOf('set({'))).toContain(
        `storage.delete(KEYS.${key})`,
      );
    }
  });
});
