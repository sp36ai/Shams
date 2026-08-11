import type { RkpOutcome, TimingPosture } from '@astrology/rkp/diagnosis';
import type { EvidenceType, RemedyCategory } from '../../../types/watchOracle';
import {
  CATEGORY_LABEL,
  confidenceLabel,
  EVIDENCE_LABEL,
  OUTCOME_HEADLINE,
  numberSteps,
  OUTCOME_TONE,
  POSTURE_LABEL,
} from '../RemedyProtocolCard';

const OUTCOMES: RkpOutcome[] = [
  'FAVOURABLE',
  'UNFAVOURABLE',
  'DELAYED',
  'UNCERTAIN',
  'CONDITIONAL',
  'PREMATURE',
  'ESCALATING',
  'DECLINING',
];

describe('outcome presentation', () => {
  it('gives every outcome a plain-language headline', () => {
    for (const outcome of OUTCOMES) {
      expect(OUTCOME_HEADLINE[outcome].length).toBeGreaterThan(0);
    }
  });

  it('gives every outcome a tone', () => {
    for (const outcome of OUTCOMES) {
      expect(OUTCOME_TONE[outcome]).toBeDefined();
    }
  });

  it('does not colour an adverse reading as favourable', () => {
    expect(OUTCOME_TONE.UNFAVOURABLE).toBe('mardood');
    expect(OUTCOME_TONE.DECLINING).not.toBe('maqbool');
  });

  it('distinguishes delay from denial in words, not just colour', () => {
    // The single most consequential distinction in the whole reading: seekers
    // hear "not yet" as "no" unless the copy prevents it.
    expect(OUTCOME_HEADLINE.DELAYED).not.toEqual(OUTCOME_HEADLINE.UNFAVOURABLE);
    expect(OUTCOME_HEADLINE.PREMATURE).not.toEqual(OUTCOME_HEADLINE.UNFAVOURABLE);
  });
});

describe('timing posture', () => {
  it('states every posture as an instruction', () => {
    const postures: TimingPosture[] = ['ACT_NOW', 'ACT_SOON', 'WAIT', 'WAIT_LONG', 'UNKNOWN'];
    for (const p of postures) {
      expect(POSTURE_LABEL[p].length).toBeGreaterThan(0);
    }
  });
});

describe('evidence labelling', () => {
  it('labels every evidence type', () => {
    const types: EvidenceType[] = ['scriptural', 'traditional', 'astrological', 'behavioral'];
    for (const t of types) {
      expect(EVIDENCE_LABEL[t].length).toBeGreaterThan(0);
    }
  });

  it('never presents an astrological correspondence as scripture', () => {
    expect(EVIDENCE_LABEL.astrological).not.toEqual(EVIDENCE_LABEL.scriptural);
    expect(EVIDENCE_LABEL.astrological.toLowerCase()).toContain('traditional');
  });

  it('reserves the scriptural label for scripture', () => {
    expect(EVIDENCE_LABEL.scriptural).toMatch(/Qur|Sunnah/);
    expect(EVIDENCE_LABEL.behavioral).not.toMatch(/Qur|Sunnah/);
  });
});

describe('category labelling', () => {
  it('labels all five levels', () => {
    const categories: RemedyCategory[] = [
      'contemplative',
      'devotional',
      'astrological',
      'behavioral',
      'practical',
    ];
    for (const c of categories) {
      expect(CATEGORY_LABEL[c].length).toBeGreaterThan(0);
    }
  });

  it('names the practical level as professional advice', () => {
    expect(CATEGORY_LABEL.practical.toLowerCase()).toContain('professional');
  });
});

describe('confidence phrasing', () => {
  it('maps the engine bands onto phrases', () => {
    expect(confidenceLabel(0.95)).toContain('very high');
    expect(confidenceLabel(0.8)).toContain('high');
    expect(confidenceLabel(0.6)).toContain('moderate');
    expect(confidenceLabel(0.4)).toContain('low');
    expect(confidenceLabel(0.2)).toContain('unsettled');
  });

  it('never claims confidence the chart does not have', () => {
    expect(confidenceLabel(0.2)).not.toContain('high');
  });
});

describe('step numbering', () => {
  it('numbers practices from one when a referral leads the protocol', () => {
    // Counting the referral would start the practices at 2, which reads as a
    // missing first step.
    const numbered = numberSteps([
      { isEscalation: true },
      { isEscalation: false },
      { isEscalation: false },
    ]);
    expect(numbered.map(n => n.index)).toEqual([null, 1, 2]);
  });

  it('numbers a referral-free protocol normally', () => {
    const numbered = numberSteps([{ isEscalation: false }, { isEscalation: false }]);
    expect(numbered.map(n => n.index)).toEqual([1, 2]);
  });
});
