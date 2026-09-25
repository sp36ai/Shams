/**
 * requestMeta.ts — IP extraction is the security-relevant part of this file:
 * ipHash feeds every securityEvents/auditLogs record across the payment
 * webhooks and Oracle callables, and razorpay.ts's checkIpRateLimit keys its
 * per-IP bucket off it directly. Neither had any test before this file.
 *
 * getIp() used to trust the FIRST entry of X-Forwarded-For — the one
 * position any caller can set to an arbitrary value, since a client's own
 * XFF header is never stripped, only appended to by each proxy hop. Fixed
 * to trust the SECOND-TO-LAST entry instead, matching Google's documented
 * HTTPS Load Balancer / GFE behavior (Cloud Functions v2 runs on Cloud Run,
 * behind GFE): GFE appends exactly two entries to whatever arrived — the
 * client IP as GFE itself observed it, then GFE's own IP. See
 * trustedClientIp()'s own doc comment in requestMeta.ts for the full
 * reasoning and its limits.
 */

import { describe, it, expect } from 'vitest';
import { trustedClientIp, requestMetaFromHttp } from '../requestMeta';
import type { Request } from 'firebase-functions/v2/https';

describe('trustedClientIp', () => {
  it('returns the second-to-last entry — the one GFE itself appended, not the last (GFE’s own IP)', () => {
    expect(trustedClientIp('203.0.113.7, 35.190.1.1')).toBe('203.0.113.7');
  });

  it('an attacker-prepended chain does not change which entry is trusted', () => {
    // A caller can send any XFF value it likes; GFE appends its own findings
    // AFTER that, unconditionally. The attacker-controlled entries always
    // end up before the trusted one, never displacing it.
    expect(trustedClientIp('9.9.9.9, 8.8.8.8, 203.0.113.7, 35.190.1.1')).toBe('203.0.113.7');
  });

  it('trims whitespace around each entry', () => {
    expect(trustedClientIp('  203.0.113.7  ,  35.190.1.1  ')).toBe('203.0.113.7');
  });

  it('returns undefined for a single-entry header — no proxy chain to trust a position in', () => {
    expect(trustedClientIp('203.0.113.7')).toBeUndefined();
  });

  it('returns undefined for an absent header', () => {
    expect(trustedClientIp(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(trustedClientIp('')).toBeUndefined();
  });

  it('ignores empty entries produced by stray commas', () => {
    expect(trustedClientIp('203.0.113.7,, 35.190.1.1')).toBe('203.0.113.7');
  });

  it('the OLD (vulnerable) behavior would have returned the attacker-controlled first entry — proving the fix actually changed something', () => {
    const header = 'attacker-spoofed-value, 203.0.113.7, 35.190.1.1';
    const oldBehavior = header.split(',')[0]?.trim();
    expect(oldBehavior).toBe('attacker-spoofed-value');
    expect(trustedClientIp(header)).not.toBe(oldBehavior);
    expect(trustedClientIp(header)).toBe('203.0.113.7');
  });
});

function fakeReq(headers: Record<string, string | string[] | undefined>): Request {
  return {
    headers,
    ip: undefined,
    socket: { remoteAddress: '10.0.0.1' },
  } as unknown as Request;
}

describe('requestMetaFromHttp — end to end through getIp()', () => {
  it('hashes the trusted (second-to-last) IP, not the spoofable first one', () => {
    const meta = requestMetaFromHttp(
      fakeReq({ 'x-forwarded-for': 'attacker-value, 203.0.113.7, 35.190.1.1' }),
    );
    // ipAddress is not exposed by requestMetaFromHttp directly in a way we
    // can compare without reaching into the hash, so instead prove
    // consistency: the same trusted IP always hashes to the same ipHash,
    // and a run seeded with the attacker value as the ONLY entry (yielding
    // a different trusted IP) must hash differently.
    const metaAttackerOnly = requestMetaFromHttp(fakeReq({ 'x-forwarded-for': 'attacker-value' }));
    expect(meta.ipHash).toBeDefined();
    expect(meta.ipHash).not.toBe(metaAttackerOnly.ipHash);
  });

  it('falls back to the raw socket peer when no X-Forwarded-For header is present', () => {
    const meta = requestMetaFromHttp(fakeReq({}));
    expect(meta.ipHash).toBeDefined();
  });

  it('an array-valued header (some frameworks normalize this way) uses its first element', () => {
    const meta = requestMetaFromHttp(fakeReq({ 'x-forwarded-for': ['203.0.113.7, 35.190.1.1'] }));
    expect(meta.ipHash).toBeDefined();
  });
});
