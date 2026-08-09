import { describe, it, expect } from 'vitest';

import { diagnose } from '../../engine/rkp/diagnosis';
import type { DisplayWatchVerdict } from '../../engine/rkp/watchJudgment';
import { REMEDY_LIBRARY } from '../remedyLibrary';
import { selectRemedyProtocol } from '../remedySelection';

const CLEAN: DisplayWatchVerdict = {
  qType: 'business',
  targetHouse: 10,
  targetSignName: 'Hamal',
  targetRuler: 'Mars',
  targetRulerName: 'Mirrikh',
  fulfilmentHouse: 11,
  lagnaRuler: 'Sun',
  rulerRelation: 'Neutral',
  state: 'FULFILLED',
  confidence: 'VERY_HIGH',
  score: 6,
  obstruction: 'None',
  reversal: 'NONE',
  timing: { minDays: 3, maxDays: 7 },
  direction: 'East',
  afflictedDirection: null,
  controllerProfile: 'Receptive',
  factors: ['ruler strong'],
};

const protocolFor = (over: Partial<DisplayWatchVerdict>) =>
  selectRemedyProtocol(diagnose({ ...CLEAN, ...over }));

describe('no-remedy result', () => {
  it('prescribes nothing for a clean chart', () => {
    const p = protocolFor({ qType: 'general' });
    expect(p.interventionRequired).toBe(false);
    expect(p.steps).toHaveLength(0);
    expect(p.guidance).toMatch(/no specific remedy/i);
  });

  it('prescribes something once the chart is obstructed', () => {
    const p = protocolFor({ obstruction: 'Saturn' });
    expect(p.interventionRequired).toBe(true);
    expect(p.steps.length).toBeGreaterThan(0);
  });
});

describe('safety escalation', () => {
  it('always refers health questions to a professional, even on a good reading', () => {
    const p = protocolFor({ qType: 'health' });
    expect(p.escalation?.remedy.id).toBe('practical_medical');
    expect(p.steps[0]?.remedy.id).toBe('practical_medical');
  });

  it('always refers legal questions to a professional', () => {
    expect(protocolFor({ qType: 'legal' }).escalation?.remedy.id).toBe('practical_legal');
  });

  it('treats a referral as an intervention even when no remedy applies', () => {
    // Otherwise the narration is told "nothing to do" while a referral is shown.
    expect(protocolFor({ qType: 'health' }).interventionRequired).toBe(true);
  });

  it('does not refer a routine favourable financial question', () => {
    expect(protocolFor({ qType: 'finance' }).escalation).toBeNull();
  });

  it('refers a financial question once the reading turns adverse', () => {
    const p = protocolFor({ qType: 'finance', state: 'BLOCKED', confidence: 'HIGH' });
    expect(p.escalation?.remedy.id).toBe('practical_financial');
  });

  it('places the referral ahead of every scored practice', () => {
    const p = protocolFor({ qType: 'legal', state: 'BLOCKED', confidence: 'HIGH' });
    expect(p.steps[0]?.remedy.category).toBe('practical');
  });
});

describe('selection quality', () => {
  it('never repeats a category within one protocol', () => {
    const p = protocolFor({ state: 'BLOCKED', confidence: 'HIGH', obstruction: 'Saturn' });
    const scored = p.steps.filter(s => s !== p.escalation).map(s => s.remedy.category);
    expect(new Set(scored).size).toBe(scored.length);
  });

  it('honours contraindications', () => {
    // behavioral_commit is marked avoidFor UNFAVOURABLE and must never surface.
    const p = protocolFor({ state: 'BLOCKED', confidence: 'HIGH' });
    expect(p.steps.map(s => s.remedy.id)).not.toContain('behavioral_commit');
  });

  it('prefers a remedy corresponding to the obstructing agent', () => {
    const p = protocolFor({ state: 'DELAYED', confidence: 'HIGH', obstruction: 'Saturn' });
    expect(p.steps.map(s => s.remedy.id)).toContain('astro_saturn_discipline');
  });

  it('filters remedies outside the seeker’s traditions', () => {
    const d = diagnose({ ...CLEAN, state: 'BLOCKED', confidence: 'HIGH', obstruction: 'Saturn' });
    const p = selectRemedyProtocol(d, { traditions: ['universal'] });
    expect(p.steps.every(s => s.remedy.traditions.includes('universal'))).toBe(true);
  });

  it('gives every selection a stated reason', () => {
    const p = protocolFor({ obstruction: 'Saturn' });
    expect(p.steps.every(s => s.reason.length > 0)).toBe(true);
  });
});

describe('determinism and serialisation', () => {
  it('produces the same protocol for the same diagnosis', () => {
    const d = diagnose({ ...CLEAN, obstruction: 'Saturn' });
    expect(JSON.stringify(selectRemedyProtocol(d))).toBe(
      JSON.stringify(selectRemedyProtocol(d)),
    );
  });

  it('scores every step as a finite number', () => {
    // Firestore rejects non-finite numbers, and Infinity serialises to null.
    const p = protocolFor({ qType: 'health', state: 'BLOCKED', confidence: 'HIGH' });
    expect(p.steps.every(s => Number.isFinite(s.score))).toBe(true);
  });
});

describe('library integrity', () => {
  it('has unique ids', () => {
    const ids = REMEDY_LIBRARY.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every remedy an explanation and at least one instruction', () => {
    for (const r of REMEDY_LIBRARY) {
      expect(r.explanation.length, r.id).toBeGreaterThan(0);
      expect(r.instructions.length, r.id).toBeGreaterThan(0);
    }
  });

  it('covers all five levels', () => {
    const categories = new Set(REMEDY_LIBRARY.map(r => r.category));
    expect(categories).toEqual(
      new Set(['contemplative', 'devotional', 'astrological', 'behavioral', 'practical']),
    );
  });

  it('labels every astrological remedy as traditional rather than scriptural', () => {
    for (const r of REMEDY_LIBRARY.filter(x => x.category === 'astrological')) {
      expect(r.evidenceType, r.id).toBe('astrological');
    }
  });
});
