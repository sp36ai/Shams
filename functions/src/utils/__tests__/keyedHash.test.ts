/**
 * keyedHash — the correlation codes that replace unkeyed question/IP hashes.
 */

import { createHash, createHmac } from 'crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const key = vi.hoisted(() => ({ value: 'test-key-one' }));
vi.mock('../../config', () => ({ LOG_HASH_KEY: { value: () => key.value } }));

const warn = vi.hoisted(() => vi.fn());
vi.mock('../logger', () => ({ logger: { warn, info: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  key.value = 'test-key-one';
  warn.mockClear();
  vi.resetModules();
});

async function load() {
  return (await import('../keyedHash')).keyedHash;
}

describe('keyedHash', () => {
  it('is a versioned 128-bit HMAC-SHA-256 code', async () => {
    const keyedHash = await load();
    const code = keyedHash('question', 'Will I get the job?');
    expect(code).toMatch(/^h1:[0-9a-f]{32}$/);
    const expected = createHmac('sha256', 'test-key-one')
      .update('question\u0000Will I get the job?')
      .digest('hex')
      .slice(0, 32);
    expect(code).toBe(`h1:${expected}`);
  });

  it('is stable for the same input, so records can still be correlated', async () => {
    const keyedHash = await load();
    expect(keyedHash('ip', '203.0.113.7')).toBe(keyedHash('ip', '203.0.113.7'));
    expect(keyedHash('ip', '203.0.113.7')).not.toBe(keyedHash('ip', '203.0.113.8'));
  });

  it('keeps purposes apart: a question code never equals an IP code', async () => {
    const keyedHash = await load();
    expect(keyedHash('question', '203.0.113.7')).not.toBe(keyedHash('ip', '203.0.113.7'));
  });

  it('cannot be reproduced without the key', async () => {
    const withKeyOne = (await load())('question', 'Will I marry?');
    key.value = 'a-different-key';
    vi.resetModules();
    const withKeyTwo = (await load())('question', 'Will I marry?');
    expect(withKeyOne).not.toBe(withKeyTwo);
    // Nor matches the old unkeyed constructions it replaces.
    const oldIp = createHash('sha256').update('Will I marry?').digest('hex').slice(0, 16);
    expect(withKeyOne).not.toContain(oldIp);
  });

  it('never contains the input or the key', async () => {
    const keyedHash = await load();
    const code = keyedHash('question', 'secret question text')!;
    expect(code).not.toContain('secret question text');
    expect(code).not.toContain('test-key-one');
  });

  it('omits the code — never an unkeyed fallback — when no key is bound, and warns once', async () => {
    key.value = '';
    const keyedHash = await load();
    expect(keyedHash('question', 'Will I get the job?')).toBeUndefined();
    expect(keyedHash('ip', '203.0.113.7')).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Will I get the job?');
  });
});
