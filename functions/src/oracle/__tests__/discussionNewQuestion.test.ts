/**
 * A follow-up the oracle flags as a NEW horary question must not carry a
 * verdict: no reading in the brief was cast for it. The contract check cannot
 * see this when the verdict shares the anchor reading's polarity, so
 * checkNewQuestionReply() rejects any explicit outcome assertion outright.
 */
import { describe, expect, it } from 'vitest';
import { checkNewQuestionReply } from '../discussionComposer';
import { findOutcomeAssertion } from '../narrationValidator';

describe('checkNewQuestionReply', () => {
  it('rejects a positive verdict on a new matter', () => {
    const reply =
      'Your job reading stands as it was. As for the marriage, the answer is yes, it will come.';
    expect(checkNewQuestionReply(reply, true)).toBe('the answer is yes');
  });

  it('rejects a negative verdict on a new matter', () => {
    const reply = 'This reading was cast for your work. The move abroad will not happen this year.';
    expect(checkNewQuestionReply(reply, true)).toBe('will not happen');
  });

  it('accepts a new-question reply that withholds the verdict, as the prompt requires', () => {
    const reply =
      'This reading was cast for your question about work, at a different moment, so it cannot ' +
      'say how the marriage will turn out. The patience it asks of you there may still be worth carrying.';
    expect(checkNewQuestionReply(reply, true)).toBeNull();
  });

  it('leaves an ordinary follow-up to the contract check alone', () => {
    // Restating the standing reading's own verdict is a follow-up's job;
    // whether it matches the reading is checkVerdictConsistency's concern.
    expect(
      checkNewQuestionReply('The answer is yes, though it asks for patience.', false),
    ).toBeNull();
  });
});

describe('findOutcomeAssertion', () => {
  it('matches case-insensitively, in either polarity', () => {
    expect(findOutcomeAssertion('THE ANSWER IS NO.')).toBe('the answer is no');
    expect(findOutcomeAssertion('It will definitely happen.')).toBe('will definitely happen');
  });

  it('returns null for prose with no explicit outcome assertion', () => {
    expect(findOutcomeAssertion('The road is long, and the door is not yet open.')).toBeNull();
  });
});
