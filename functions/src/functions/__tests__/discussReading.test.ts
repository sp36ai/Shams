/**
 * PHASE 5F-R2 — permanent regression coverage for discussReading.ts's own
 * pure helpers: `labelsFor` (label disambiguation) and `dedupeIds`
 * (comparison-id de-duplication). Neither needs Firestore or the callable
 * wrapper — both are pure functions, exported for direct testing exactly
 * like discussionComposer.ts's own helpers.
 *
 * These two close the "duplicate comparison IDs" and "two distinct
 * comparison readings sharing one category" determinism requirements from
 * the governing 5F-R2 authorization's test matrix — see
 * discussionComparisonValidation.test.ts for the end-to-end validation
 * coverage these helpers feed into.
 */

import { describe, it, expect } from 'vitest';
import { labelsFor, dedupeIds } from '../discussReading';
import type { ReadingDoc } from '../../types';

function docFor(category: string): ReadingDoc {
  return {
    userId: 'u1',
    question: 'a question',
    questionLang: 'en',
    category,
    verdict: 'DELAYED',
    confidence: 0.6,
    narration: { en: '', ur: '', hi: '' },
    reasoning: [],
    remedy: null,
    createdAt: {
      toDate: () => new Date('2026-08-15T00:00:00.000Z'),
    } as unknown as ReadingDoc['createdAt'],
  } as ReadingDoc;
}

describe('PHASE 5F-R2 — labelsFor', () => {
  it('a single document gets its plain label, unsuffixed', () => {
    expect(labelsFor([docFor('career')])).toEqual(['the career reading']);
  });

  it('distinct categories all stay unsuffixed', () => {
    expect(labelsFor([docFor('career'), docFor('business'), docFor('property')])).toEqual([
      'the career reading',
      'the business reading',
      'the property reading',
    ]);
  });

  it('a repeated category is disambiguated from its second occurrence onward, anchor (index 0) never suffixed', () => {
    expect(labelsFor([docFor('finance'), docFor('business'), docFor('finance')])).toEqual([
      'the finance reading',
      'the business reading',
      'the finance reading (2)',
    ]);
  });

  it('three occurrences of the same category number sequentially', () => {
    expect(labelsFor([docFor('finance'), docFor('finance'), docFor('finance')])).toEqual([
      'the finance reading',
      'the finance reading (2)',
      'the finance reading (3)',
    ]);
  });

  it('is deterministic — same input, same output, across repeated calls', () => {
    const docs = [docFor('career'), docFor('career'), docFor('business')];
    expect(labelsFor(docs)).toEqual(labelsFor(docs));
  });
});

describe('PHASE 5F-R2 — dedupeIds', () => {
  it('preserves a list with no duplicates, in order', () => {
    expect(dedupeIds(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('drops a later duplicate, keeping the first occurrence position', () => {
    expect(dedupeIds(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
  });

  it('handles an empty list', () => {
    expect(dedupeIds([])).toEqual([]);
  });

  it('collapses a fully-duplicated list to one entry', () => {
    expect(dedupeIds(['x', 'x', 'x'])).toEqual(['x']);
  });
});
