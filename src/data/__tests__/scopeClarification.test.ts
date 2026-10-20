import { isScopeClarification } from '../scopeClarification';

describe('isScopeClarification', () => {
  it('recognises a question about the refusal', () => {
    for (const q of [
      'Why not of others?',
      'why not others',
      'But why only me?',
      "Why can't you tell about him?",
      'How come?',
      'What do you mean?',
    ]) {
      expect(isScopeClarification(q)).toBe(true);
    }
  });

  it('lets a real question through to the chart', () => {
    for (const q of [
      'Why is everything going wrong?',
      'Why did my business fail?',
      'Will I get the job?',
      'What is babloo future',
      'بلی کی دو نسلیں بتائیں',
      '',
    ]) {
      expect(isScopeClarification(q)).toBe(false);
    }
  });
});
