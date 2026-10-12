import { describe, expect, it } from 'vitest';

import { compare, normaliseWords } from './fidelity';

describe('fidelity', () => {
  it('treats case, punctuation and spacing as the same words', () => {
    const r = compare('Not yet — this is delay, not denial.', 'not yet this is delay not denial');
    expect(r.verbatim).toBe(true);
    expect(r.edits).toBe(0);
  });

  it('fails a take that adds, drops or changes a word, and says where', () => {
    const added = compare('The door is heavy.', 'Well, the door is heavy.');
    expect(added.verbatim).toBe(false);
    expect(added.edits).toBe(1);
    expect(added.firstDivergence?.at).toBe(0);

    const changed = compare('The answer is no for now.', 'The answer is yes for now.');
    expect(changed.verbatim).toBe(false);
    expect(changed.firstDivergence).toMatchObject({
      at: 3,
      expected: 'no for now',
      heard: 'yes for now',
    });

    expect(compare('One two three.', 'One three.').edits).toBe(1);
  });

  it('handles Urdu and Hindi, ignoring Arabic-script diacritics', () => {
    expect(compare('اس میں وقت لگے گا۔', 'اس میں وقت لگے گا').verbatim).toBe(true);
    expect(compare('اِس میں', 'اس میں').verbatim).toBe(true);
    expect(compare('इसमें समय लगेगा।', 'इसमें समय लगेगा').verbatim).toBe(true);
  });

  it('counts an empty transcript as total failure', () => {
    const r = compare('Some words here.', '');
    expect(r.verbatim).toBe(false);
    expect(r.wordErrorRate).toBe(1);
    expect(normaliseWords('')).toEqual([]);
  });
});
