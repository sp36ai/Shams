import { describe, expect, it } from 'vitest';

import { PERFORMANCE, STATE_TO_SPOKEN, VOICE_INSTRUCTIONS, instructionsFor } from './performance';

const STATES = ['FULFILLED', 'BLOCKED', 'DELAYED', 'MOVING', 'REVERSING', 'UNFORMED'] as const;

describe('verdict → performance mapping', () => {
  it('maps every engine state, deterministically', () => {
    expect(STATES.map(s => STATE_TO_SPOKEN[s])).toEqual([
      'YES',
      'NO',
      'WAIT',
      'CAUTION',
      'CAUTION',
      'UNCLEAR',
    ]);
    for (const s of STATES) {
      expect(instructionsFor(s)).toEqual(instructionsFor(s));
    }
  });

  it('keeps UNFORMED distinct from WAIT (owner decision)', () => {
    expect(instructionsFor('UNFORMED').spoken).toBe('UNCLEAR');
    expect(instructionsFor('UNFORMED').instructions).not.toBe(
      instructionsFor('DELAYED').instructions,
    );
    expect(PERFORMANCE.UNCLEAR).not.toBe(PERFORMANCE.WAIT);
  });

  it('requires verbatim reading and forbids additions', () => {
    expect(VOICE_INSTRUCTIONS).toContain('Read it aloud exactly as written, word for word');
    expect(VOICE_INSTRUCTIONS).toContain('Do not reply to it');
  });

  it('names no real person, and forbids imitation', () => {
    for (const s of STATES) {
      expect(instructionsFor(s).instructions).not.toMatch(/morgan|freeman/i);
    }
    expect(VOICE_INSTRUCTIONS).toContain('Do not imitate any real actor or public figure');
  });
});
