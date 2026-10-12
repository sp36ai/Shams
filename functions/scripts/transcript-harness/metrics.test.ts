import { describe, expect, it } from 'vitest';

import {
  answerFirst,
  dominantScript,
  foldTransliteration,
  restatementRatio,
  scan,
  sentences,
} from './metrics';

const checks = (text: string, allowed = '') =>
  scan(text, allowed)
    .filter(f => !f.negated)
    .map(f => f.check);

describe('dominantScript', () => {
  it('identifies each supported language by script', () => {
    expect(dominantScript('The door is heavy.').script).toBe('latin');
    expect(dominantScript('دروازہ بھاری ہے، Zuhal').script).toBe('arabic');
    expect(dominantScript('दरवाज़ा भारी है').script).toBe('devanagari');
    expect(dominantScript('… 123').script).toBe('none');
  });
});

describe('sentences', () => {
  it('splits on Latin, Urdu and Devanagari terminators', () => {
    expect(sentences('One. Two? Three!')).toHaveLength(3);
    expect(sentences('ایک۔ دو۔')).toHaveLength(2);
    expect(sentences('एक। दो।')).toHaveLength(2);
  });
});

describe('answerFirst', () => {
  const base = {
    why_this_remedy: null,
    signature: 'x',
    recommended_approach: 'Let the window arrive.',
  };

  it('counts the words spoken before the interpretation field', () => {
    const a = answerFirst(
      {
        ...base,
        rkp_finding: 'A quiet weight sits here. Zuhal stands at the threshold.',
        interpretation: 'Not yet — wait.',
      },
      'DELAYED',
    );
    expect(a.wordsBeforeVerdictField).toBe(10);
    expect(a.sentencesBeforeVerdictField).toBe(2);
    expect(a.firstCueSentence).toBe(2);
    expect(a.firstCueWords).toBe(10);
  });

  it('reports a verdict cue in the first sentence when the answer leads', () => {
    const a = answerFirst(
      { ...base, rkp_finding: 'Yes, the path is open.', interpretation: 'It stands.' },
      'YES',
    );
    expect(a.firstCueSentence).toBe(0);
  });
});

describe('scan', () => {
  it('flags weekdays, months and calendar numbers but not house numbers', () => {
    expect(checks('It comes on Tuesday.')).toContain('weekday');
    expect(checks('क्या यह सोमवार तक')).toContain('weekday');
    expect(checks('Expect news in March.')).toContain('month-name');
    expect(checks('By the 14th it settles.')).toContain('calendar-number');
    expect(checks('The 10th Ghar is supported, as is the 10th and 11th Ghar.')).not.toContain(
      'calendar-number',
    );
  });

  it('shows certainty under a negation but does not count it', () => {
    expect(checks('I cannot guarantee the outcome.')).not.toContain('certainty');
    expect(checks('I guarantee it will happen.')).toContain('certainty');
  });

  it('allows a practice the reading itself carries, flags one it does not', () => {
    expect(checks('Recite Surah Yasin 41 times.')).toEqual(
      expect.arrayContaining(['scripture-or-practice']),
    );
    expect(checks('Keep your dua steady.', 'Morning dua for steadiness')).not.toContain(
      'scripture-or-practice',
    );
  });

  it('flags removed-methodology terms and spoken formatting', () => {
    expect(checks('The sub-lord of the cusp agrees.')).toContain('internal-terminology');
    expect(checks('There is a 70% chance.')).toContain('spoken-formatting');
  });
});

describe('restatementRatio', () => {
  it('is 1 for a verbatim copy and 0 for new wording', () => {
    const reading = 'the door is not locked it is heavy and it opens slowly';
    expect(restatementRatio(reading, reading)).toBe(1);
    expect(restatementRatio('patience will serve you while the answer forms', reading)).toBe(0);
  });
});

describe('scripture/practice check — transliteration variants', () => {
  it.each([
    ['Make your duʿāʾ tonight.', "du'a"],
    ['Make your du’a tonight.', "du'a"],
    ['Recite from the Qurʾān.', "Qur'an"],
    ['Read Sūrah Yā Sīn.', 'Surah'],
    ['Call upon Yā Laṭīf.', 'Ya Latif'],
  ])('flags %j as the plain spelling would be', (text, match) => {
    const flags = scan(text).filter(f => f.check === 'scripture-or-practice');
    expect(flags.map(f => f.match)).toContain(match);
  });

  it.each(['Quran is not mentioned here.', 'Dua at night.', 'Surah reading.'])(
    'flags a capitalised plain spelling: %j',
    text => {
      expect(scan(text).some(f => f.check === 'scripture-or-practice')).toBe(true);
    },
  );

  it('still allows a practice the reading carries, whichever spelling either side uses', () => {
    const carried = (t: string, allowed: string) =>
      scan(t, allowed)
        .filter(f => f.check === 'scripture-or-practice' && !f.negated)
        .map(f => f.match);
    expect(carried('Keep your duʿāʾ steady.', 'Morning dua for steadiness')).toEqual([]);
    expect(carried('Keep your dua steady.', 'Morning duʿāʾ for steadiness')).toEqual([]);
    expect(carried('Keep your duʿāʾ steady.', 'Evening dhikr')).toEqual(["du'a"]);
  });

  it('still treats a negated mention as negated', () => {
    const f = scan('I will not give you a duʿāʾ for this.').find(
      x => x.check === 'scripture-or-practice',
    );
    expect(f).toMatchObject({ match: "du'a", negated: true });
  });

  it('leaves Urdu, Hindi and the other checks untouched', () => {
    expect(foldTransliteration('इसमें समय लगेगा')).toBe('इसमें समय लगेगा'.normalize('NFD'));
    expect(foldTransliteration('اس میں وقت لگے گا')).toBe('اس میں وقت لگے گا'.normalize('NFD'));
    expect(checks('क्या यह सोमवार तक')).toContain('weekday');
    expect(checks('sabr and tawakkul')).toEqual([]);
  });
});
