/**
 * validate.ts — Zod schema edge-case regression tests.
 *
 * These schemas are the trust boundary for every client-supplied payload that
 * reaches the engine and the payment path. Each case pins a boundary the
 * input-validation audit verified by reading.
 */

import { describe, it, expect } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';

import { parse, AskOracleSchema, SyncReadingsSchema, VerifyGooglePlaySchema } from '../validate';

const validAsk = {
  question: 'Will I succeed in my career?',
  lat: 24.8607,
  lon: 67.0011,
  questionLang: 'en' as const,
};

describe('AskOracleSchema', () => {
  it('accepts a minimal valid payload and trims the question', () => {
    const out = parse(AskOracleSchema, { ...validAsk, question: '  Will I succeed?  ' });
    expect(out.question).toBe('Will I succeed?');
  });

  it('rejects questions shorter than 5 or longer than 500 chars', () => {
    expect(() => parse(AskOracleSchema, { ...validAsk, question: 'hi?' })).toThrow(HttpsError);
    expect(() => parse(AskOracleSchema, { ...validAsk, question: 'x'.repeat(501) })).toThrow(
      HttpsError,
    );
  });

  it('rejects out-of-range and non-finite coordinates', () => {
    expect(() => parse(AskOracleSchema, { ...validAsk, lat: 91 })).toThrow(HttpsError);
    expect(() => parse(AskOracleSchema, { ...validAsk, lon: -181 })).toThrow(HttpsError);
    expect(() => parse(AskOracleSchema, { ...validAsk, lat: NaN })).toThrow(HttpsError);
    expect(() => parse(AskOracleSchema, { ...validAsk, lon: Infinity })).toThrow(HttpsError);
  });

  it("rejects the removed 'hi' locale (two-language product decision)", () => {
    expect(() => parse(AskOracleSchema, { ...validAsk, questionLang: 'hi' })).toThrow(HttpsError);
  });

  it('rejects unknown extra keys (strict schema)', () => {
    expect(() => parse(AskOracleSchema, { ...validAsk, admin: true })).toThrow(HttpsError);
  });

  it('bounds optional seeker/mother names to 1–100 chars', () => {
    expect(() => parse(AskOracleSchema, { ...validAsk, seekerName: '   ' })).toThrow(HttpsError);
    expect(() => parse(AskOracleSchema, { ...validAsk, motherName: 'x'.repeat(101) })).toThrow(
      HttpsError,
    );
    const ok = parse(AskOracleSchema, { ...validAsk, seekerName: ' Rafiq ' });
    expect(ok.seekerName).toBe('Rafiq');
  });

  it('throws HttpsError with code invalid-argument (never a raw Zod error)', () => {
    try {
      parse(AskOracleSchema, {});
      throw new Error('expected parse to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpsError);
      expect((err as HttpsError).code).toBe('invalid-argument');
    }
  });
});

describe('SyncReadingsSchema', () => {
  const reading = {
    id: 'r1',
    question: 'test question',
    questionLang: 'ur' as const,
    category: 'career',
    verdict: 'YES' as const,
    createdAt: new Date().toISOString(),
  };

  it('accepts a valid batch and rejects more than 100 readings', () => {
    expect(parse(SyncReadingsSchema, { readings: [reading] }).readings).toHaveLength(1);
    const oversized = Array.from({ length: 101 }, (_, i) => ({ ...reading, id: `r${i}` }));
    expect(() => parse(SyncReadingsSchema, { readings: oversized })).toThrow(HttpsError);
  });

  it('rejects a non-ISO createdAt and an unknown verdict', () => {
    expect(() =>
      parse(SyncReadingsSchema, { readings: [{ ...reading, createdAt: 'yesterday' }] }),
    ).toThrow(HttpsError);
    expect(() =>
      parse(SyncReadingsSchema, { readings: [{ ...reading, verdict: 'MAYBE' }] }),
    ).toThrow(HttpsError);
  });
});

describe('VerifyGooglePlaySchema', () => {
  const valid = {
    purchaseToken: 'tok_123',
    productId: 'khass_monthly',
    packageName: 'com.astrosarfaraz.shamsalasrar',
  };

  it('accepts a valid purchase payload', () => {
    expect(parse(VerifyGooglePlaySchema, valid).productId).toBe('khass_monthly');
  });

  it('rejects missing fields, oversized tokens, and extra keys', () => {
    expect(() => parse(VerifyGooglePlaySchema, { ...valid, purchaseToken: undefined })).toThrow(
      HttpsError,
    );
    expect(() =>
      parse(VerifyGooglePlaySchema, { ...valid, purchaseToken: 'x'.repeat(1025) }),
    ).toThrow(HttpsError);
    expect(() => parse(VerifyGooglePlaySchema, { ...valid, plan: 'khass' })).toThrow(HttpsError);
  });
});
