import { describe, expect, it } from 'vitest';

import { scanText } from './outputScan';

// Built at runtime so no key-shaped literal sits in the repository.
const fakeKey = ['sk', 'ant', 'api03', 'Z'.repeat(24)].join('-');

const kinds = (text: string, extra: string[] = []) => scanText('f', text, extra).map(f => f.kind);

describe('outputScan', () => {
  it('flags credentials and never echoes them in full', () => {
    const findings = scanText('f', `"x-api-key": "${fakeKey}"`);
    expect(findings.map(f => f.kind)).toEqual(
      expect.arrayContaining(['anthropic-key', 'api-key-header']),
    );
    expect(findings.every(f => !f.masked.includes(fakeKey))).toBe(true);
  });

  it('flags the literal environment key however it is embedded', () => {
    expect(kinds('prefix-abcdefgh1234-suffix', ['abcdefgh1234'])).toContain(
      'environment-secret-value',
    );
  });

  it('flags contact details', () => {
    expect(kinds('write to seeker@example.com')).toContain('email');
    expect(kinds('call +92 300 1234567')).toContain('phone-number');
  });

  it('does not flag what every harness output legitimately contains', () => {
    const benign = [
      '"recordedAt": "2026-10-12T17:46:19.396Z"',
      '"key": "3f9a0c4e5b7d2a1c9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d"',
      'The 10th Ghar is supported. The window is 42–63 days.',
      '"utcOffsetMinutes": 330, "ms": 1834',
    ].join('\n');
    expect(kinds(benign)).toEqual([]);
  });
});
