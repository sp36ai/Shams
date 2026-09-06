/**
 * readingTitle — the handle a Reading is recognised by, weeks later.
 *
 * The rule that matters most is the one about invention: this function only
 * ever removes words. A title that names a subject the seeker did not is worse
 * than a plain one.
 */

import { readingTitleFor } from '../readingTitle';

describe('readingTitleFor', () => {
  it('strips the opener and keeps the subject', () => {
    expect(readingTitleFor('Should I accept this business opportunity?')).toBe(
      'Accept business opportunity',
    );
    expect(readingTitleFor('Should I leave my current job?')).toBe('Leave current job');
    expect(readingTitleFor('Will this marriage proposal work out?')).toBe(
      'Marriage proposal work out',
    );
  });

  it('never invents a word the seeker did not write', () => {
    const question = 'Should I buy this property?';
    const title = readingTitleFor(question);
    const asked = question.toLowerCase().replace(/[?]/g, '');
    for (const word of title.toLowerCase().split(' ')) {
      expect(asked).toContain(word);
    }
  });

  it('keeps titles short', () => {
    const title = readingTitleFor(
      'Should I accept the teaching post I was offered at the school near my house or wait?',
    );
    expect(title.split(' ').length).toBeLessThanOrEqual(4);
    expect(title.length).toBeLessThanOrEqual(42);
  });

  it('degrades to the seeker own words for a script it has no rules for', () => {
    expect(readingTitleFor('کیا یہ سودا مکمل ہوگا؟')).toBe('کیا یہ سودا مکمل');
  });

  it('never returns an empty title', () => {
    expect(readingTitleFor('???')).toBe('Reading');
    expect(readingTitleFor('   ')).toBe('Reading');
    expect(readingTitleFor('should i')).not.toHaveLength(0);
  });

  it('takes a caller fallback for a genuinely empty question', () => {
    expect(readingTitleFor('', 'New Reading')).toBe('New Reading');
  });
});
