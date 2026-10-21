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

  it('names Anthropic, the provider the code actually calls, and no other', () => {
    expect(text).toContain("Anthropic's Claude model");
    expect(text).not.toMatch(/OpenAI/i);
  });
});
