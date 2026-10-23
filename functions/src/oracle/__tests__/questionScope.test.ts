import { describe, expect, it } from 'vitest';
import { classifyQuestion } from '../../engine/kp/rules/questionKeywords';
import { isOutOfScopeQuestion } from '../questionScope';

const outOfScope = (q: string): boolean => isOutOfScopeQuestion(q, classifyQuestion(q));

describe('isOutOfScopeQuestion (owner decision 2026-10-14)', () => {
  it('declines trivia, tasks and bare greetings', () => {
    for (const q of [
      'Name two cat breeds',
      'What is the capital of France?',
      "What's the tallest mountain?",
      'Who won the world cup in 2022?',
      'How many legs does a spider have?',
      'Translate hello into French',
      'Write a poem about rain',
      'Tell me a joke',
      'Hello',
      'Assalam o alaikum',
    ]) {
      expect(outOfScope(q), q).toBe(true);
    }
  });

  it('never declines a question about the seeker or someone in their life', () => {
    for (const q of [
      'Will I get married this year?',
      'Will things get better?',
      'Will my wish come true?',
      'Should I accept the offer?',
      'What is my future?',
      'Tell me about my future',
      'Who is the right person for me?',
      'Is it a good time to move?',
      'Why is everything going wrong?',
      'Can you tell me if the deal will close?',
      'Will it rain on the wedding?',
      'Hi, will things get better?',
      'Name the best time for my business',
      'What is my ex thinking?',
    ]) {
      expect(outOfScope(q), q).toBe(false);
    }
  });

  it('never declines Urdu or Hindi questions, or a question that matched a type', () => {
    expect(outOfScope('بلی کی دو نسلیں بتائیں')).toBe(false);
    expect(outOfScope('बिल्ली की दो नस्लें बताओ')).toBe(false);
    expect(isOutOfScopeQuestion('What is the best job?', 'career')).toBe(false);
  });
});
