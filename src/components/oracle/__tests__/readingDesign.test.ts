import { pipsForConfidence } from '../readingDesign';
import { REVEAL_WINDOW_MS, isFreshVerdict } from '../ChatBubble';

describe('strength pips', () => {
  it('fill from the engine’s own confidence band, nothing re-judged', () => {
    expect(pipsForConfidence('VERY_HIGH')).toBe(3);
    expect(pipsForConfidence('HIGH')).toBe(3);
    expect(pipsForConfidence('MODERATE')).toBe(2);
    expect(pipsForConfidence('LOW')).toBe(1);
    expect(pipsForConfidence('UNCERTAIN')).toBe(1);
  });

  it('show nothing for a confidence a cached reading never stored', () => {
    expect(pipsForConfidence(undefined)).toBe(0);
    expect(pipsForConfidence('SOMETHING_NEW')).toBe(0);
  });
});

describe('verdict reveal', () => {
  const now = Date.parse('2026-11-16T12:00:00.000Z');

  it('plays for a verdict that has just arrived', () => {
    expect(isFreshVerdict('2026-11-16T11:59:30.000Z', now)).toBe(true);
  });

  it('does not replay when a Reading is opened later', () => {
    const later = new Date(now - REVEAL_WINDOW_MS - 1000).toISOString();
    expect(isFreshVerdict(later, now)).toBe(false);
  });

  it('does not play for a corrupted or future timestamp', () => {
    expect(isFreshVerdict('corrupted', now)).toBe(false);
    expect(isFreshVerdict('2026-11-16T12:05:00.000Z', now)).toBe(false);
  });
});
