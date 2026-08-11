import { diagnose } from '@astrology/rkp/diagnosis';
import type { DisplayWatchVerdict } from '@astrology/rkp/watchJudgment';

/** A clean, strongly favourable business reading with nothing across it. */
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
  factors: ['ruler strong', 'fulfilment supported'],
};

const verdict = (over: Partial<DisplayWatchVerdict>): DisplayWatchVerdict => ({
  ...CLEAN,
  ...over,
});

describe('outcome classification', () => {
  it('reads a clean fulfilled chart as favourable', () => {
    expect(diagnose(CLEAN).outcome).toBe('FAVOURABLE');
  });

  it('downgrades a supported matter to conditional when something obstructs', () => {
    // The distinction the whole remedy layer turns on: supported-but-blocked
    // is not the same as supported.
    expect(diagnose(verdict({ obstruction: 'Saturn' })).outcome).toBe('CONDITIONAL');
  });

  it('reads a long-horizon delay as prematurity rather than obstruction', () => {
    const d = diagnose(verdict({ state: 'DELAYED', timing: { minDays: 60, maxDays: 90 } }));
    expect(d.outcome).toBe('PREMATURE');
    expect(d.timingPosture).toBe('WAIT_LONG');
  });

  it('keeps a short delay as a delay', () => {
    expect(diagnose(verdict({ state: 'DELAYED' })).outcome).toBe('DELAYED');
  });

  it('maps the remaining states onto their outcome classes', () => {
    expect(diagnose(verdict({ state: 'BLOCKED' })).outcome).toBe('UNFAVOURABLE');
    expect(diagnose(verdict({ state: 'REVERSING' })).outcome).toBe('DECLINING');
    expect(diagnose(verdict({ state: 'UNFORMED' })).outcome).toBe('UNCERTAIN');
    expect(diagnose(verdict({ state: 'MOVING' })).outcome).toBe('ESCALATING');
  });
});

describe('imbalance profile', () => {
  it('reads the obstructing agent as a shape of difficulty, not a culprit', () => {
    expect(diagnose(verdict({ obstruction: 'Saturn' })).primaryPattern).toBe('OBSTRUCTION');
    expect(diagnose(verdict({ obstruction: 'Mars' })).primaryPattern).toBe('CONFLICT');
  });

  it('recognises the shadow nodes under their boundary names', () => {
    // The server renames Rahu/Ketu before the verdict leaves it, so the
    // diagnosis must read both spellings identically.
    expect(diagnose(verdict({ obstruction: 'Ras' })).primaryPattern).toBe(
      diagnose(verdict({ obstruction: 'Rahu' })).primaryPattern,
    );
  });

  it('notes external opposition when the rulers are enemies', () => {
    const d = diagnose(verdict({ state: 'BLOCKED', rulerRelation: 'Enemy' }));
    expect([d.primaryPattern, ...d.secondaryPatterns]).toContain('EXTERNAL_OPPOSITION');
  });

  it('notes instability when a reversal is possible', () => {
    const d = diagnose(verdict({ reversal: 'POSSIBLE' }));
    expect([d.primaryPattern, ...d.secondaryPatterns]).toContain('INSTABILITY');
  });
});

describe('no-remedy condition', () => {
  it('asks for no intervention on a clean, confident, unobstructed chart', () => {
    expect(diagnose(CLEAN).interventionNeeded).toBe(false);
  });

  it('asks for intervention once anything obstructs', () => {
    expect(diagnose(verdict({ obstruction: 'Saturn' })).interventionNeeded).toBe(true);
  });

  it('asks for intervention when confidence is low, even if favourable', () => {
    expect(diagnose(verdict({ confidence: 'LOW' })).interventionNeeded).toBe(true);
  });

  it('asks for intervention when a reversal is possible', () => {
    expect(diagnose(verdict({ reversal: 'POSSIBLE' })).interventionNeeded).toBe(true);
  });
});

describe('auditability', () => {
  it('records why it reached the diagnosis', () => {
    const d = diagnose(verdict({ obstruction: 'Saturn' }));
    expect(d.rationale.length).toBeGreaterThan(0);
    expect(d.rationale.join(' ')).toContain('Saturn');
  });

  it('is deterministic', () => {
    expect(diagnose(CLEAN)).toEqual(diagnose(CLEAN));
  });
});
