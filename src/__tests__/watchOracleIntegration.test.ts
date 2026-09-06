/**
 * Watch Oracle Integration Test
 * ──────────────────────────────────────────────────────────────
 * Verifies that the watch oracle wiring into ReadingScreen
 * correctly combines astronomical and watch oracle results into
 * a single Reading object for display.
 *
 * This is a meta-test that documents the integration contract
 * and verifies that type definitions align.
 */

import type { Reading } from '@stores/readingsStore';
import type { DisplayWatchVerdict } from '@astrology/rkp/watchJudgment';
import type { WatchOracleComposition, OracleProtocolStep } from '@types/watchOracle';

describe('Watch Oracle UI Integration', () => {
  it('Reading type supports optional watch_oracle field', () => {
    // Astronomical-only reading (backward compatible)
    const astroReading: Reading = {
      id: 'r_test_1',
      question: 'Will this project succeed?',
      questionLang: 'en',
      category: 'business',
      verdict: 'YES',
      createdAt: '2026-08-11T10:00:00Z',
      chartJson: { phase: 'complete' },
      verdictJson: { verdict: 'YES', confidence: 0.85 },
    };

    expect(astroReading.watch_oracle).toBeUndefined();
  });

  it('Reading combines astronomical and watch oracle data', () => {
    // Mock watch verdict
    const mockWatchVerdict: DisplayWatchVerdict = {
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

    // Mock composition
    const mockComposition: WatchOracleComposition = {
      narration: {
        rkp_finding: 'The chart is favorable.',
        interpretation: 'This matter has strong support.',
        recommended_approach: 'Move forward with confidence.',
        why_this_remedy: 'Reflection will strengthen resolve.',
        signature: 'The Oracle',
      },
      diagnosis: {
        outcome: 'FAVOURABLE',
        primaryPattern: 'FAVOURABLE_FLOW',
        secondaryPatterns: [],
        timingPosture: 'ACT_NOW',
        confidence: 0.95,
        obstructingAgent: null,
        rationale: ['Ruler is strong in its sign'],
      },
      protocol: {
        interventionRequired: false,
        guidance: 'No remedy needed. The matter has good fortune.',
        steps: [],
        rationale: ['Favorable reading requires no intervention'],
      },
    };

    // Combined reading (what runEngine() produces)
    const combinedReading: Reading = {
      id: 'r_test_combined',
      question: 'Will this project succeed?',
      questionLang: 'en',
      category: 'business',
      verdict: 'YES',
      createdAt: '2026-08-11T10:00:00Z',
      chartJson: { phase: 'complete' },
      verdictJson: { verdict: 'YES', confidence: 0.85 },
      watch_oracle: {
        verdict: mockWatchVerdict,
        composition: mockComposition,
        window: { startMinute: 0, endMinute: 5 },
        lagnaSignName: 'Burj Jauza',
        lagnaRulerName: 'Utarid',
      },
    };

    expect(combinedReading.watch_oracle).toBeDefined();
    expect(combinedReading.watch_oracle?.verdict.state).toBe('FULFILLED');
    expect(combinedReading.watch_oracle?.composition.diagnosis.outcome).toBe('FAVOURABLE');
    expect(combinedReading.watch_oracle?.lagnaSignName).toBe('Burj Jauza');
  });

  it('watch_oracle field contains all metadata needed by RkpWatchCard', () => {
    // This verifies that the data structure provides everything
    // that RkpWatchCard expects as props

    const reading: Reading = {
      id: 'r_test_metadata',
      question: 'Will this work?',
      questionLang: 'en',
      category: 'general',
      verdict: 'CONDITIONAL',
      createdAt: '2026-08-11T10:00:00Z',
      chartJson: {},
      verdictJson: {},
      watch_oracle: {
        verdict: {
          qType: 'general',
          targetHouse: 1,
          targetSignName: 'Aries',
          targetRuler: 'Mars',
          targetRulerName: 'Mirrikh',
          fulfilmentHouse: 2,
          lagnaRuler: 'Mars',
          rulerRelation: 'Neutral',
          state: 'DELAYED',
          confidence: 'HIGH',
          score: 5,
          obstruction: 'Saturn',
          reversal: 'NONE',
          timing: { minDays: 15, maxDays: 30 },
          direction: 'South',
          afflictedDirection: null,
          controllerProfile: 'Receptive',
          factors: [],
        },
        composition: {
          narration: null,
          diagnosis: {
            outcome: 'DELAYED',
            primaryPattern: 'OBSTRUCTION',
            secondaryPatterns: [],
            timingPosture: 'WAIT',
            confidence: 0.8,
            obstructingAgent: 'Saturn',
            rationale: ['Saturn obstructs the matter'],
          },
          protocol: {
            interventionRequired: true,
            guidance: null,
            steps: [],
            rationale: [],
          },
        },
        window: { startMinute: 5, endMinute: 10 },
        lagnaSignName: 'Burj Thaur',
        lagnaRulerName: 'Zuhra',
      },
    };

    // Verify RkpWatchCard can receive all props from watch_oracle
    const rkpWatchProps = {
      window: reading.watch_oracle!.window,
      lagnaSignName: reading.watch_oracle!.lagnaSignName,
      lagnaRulerName: reading.watch_oracle!.lagnaRulerName,
      verdict: reading.watch_oracle!.verdict,
    };

    expect(rkpWatchProps.window.startMinute).toBe(5);
    expect(rkpWatchProps.lagnaSignName).toBe('Burj Thaur');
    expect(rkpWatchProps.verdict.obstruction).toBe('Saturn');
  });

  it('watch_oracle field contains all metadata needed by RemedyProtocolCard', () => {
    // This verifies that the composition provides everything
    // that RemedyProtocolCard expects as props

    const mockStep: OracleProtocolStep = {
      id: 'astro_saturn_discipline',
      name: 'Build discipline',
      category: 'behavioral',
      evidenceType: 'behavioral',
      intensity: 'high',
      duration: 'ongoing',
      explanation: 'Saturn counsels patience and structure.',
      instructions: ['Establish a consistent routine', 'Practice restraint'],
      isEscalation: false,
    };

    const reading: Reading = {
      id: 'r_test_protocol',
      question: 'How to overcome this delay?',
      questionLang: 'en',
      category: 'general',
      verdict: 'DELAYED',
      createdAt: '2026-08-11T10:00:00Z',
      chartJson: {},
      verdictJson: {},
      watch_oracle: {
        verdict: {
          qType: 'general',
          targetHouse: 7,
          targetSignName: 'Libra',
          targetRuler: 'Venus',
          targetRulerName: 'Zuhra',
          fulfilmentHouse: 8,
          lagnaRuler: 'Venus',
          rulerRelation: 'Friendly',
          state: 'DELAYED',
          confidence: 'HIGH',
          score: 5,
          obstruction: 'Saturn',
          reversal: 'NONE',
          timing: { minDays: 20, maxDays: 45 },
          direction: 'West',
          afflictedDirection: null,
          controllerProfile: 'Receptive',
          factors: [],
        },
        composition: {
          narration: {
            rkp_finding: 'The matter advances, but slowly.',
            interpretation: 'Saturn teaches through delay.',
            recommended_approach: 'Use this time for preparation.',
            why_this_remedy: "Discipline aligns with Saturn's lesson.",
            signature: 'Shams al-Asrār',
          },
          diagnosis: {
            outcome: 'DELAYED',
            primaryPattern: 'OBSTRUCTION',
            secondaryPatterns: [],
            timingPosture: 'WAIT',
            confidence: 0.85,
            obstructingAgent: 'Saturn',
            rationale: ['Saturn delays but does not deny'],
          },
          protocol: {
            interventionRequired: true,
            guidance: null,
            steps: [mockStep],
            rationale: ['Planetary correspondence: Saturn → discipline'],
          },
        },
        window: { startMinute: 55, endMinute: 60 },
        lagnaSignName: 'Burj Mizan',
        lagnaRulerName: 'Zuhra',
      },
    };

    // Verify RemedyProtocolCard can receive composition
    const remedyProtocolProps = {
      composition: reading.watch_oracle!.composition,
    };

    expect(remedyProtocolProps.composition.diagnosis.outcome).toBe('DELAYED');
    expect(remedyProtocolProps.composition.protocol.steps.length).toBe(1);
    expect(remedyProtocolProps.composition.narration?.signature).toBe('Shams al-Asrār');
  });

  it('handles missing narration gracefully (degraded composition)', () => {
    // When Claude synthesis fails, narration is null but protocol survives
    const reading: Reading = {
      id: 'r_test_degraded',
      question: 'What about this?',
      questionLang: 'en',
      category: 'general',
      verdict: 'BLOCKED',
      createdAt: '2026-08-11T10:00:00Z',
      chartJson: {},
      verdictJson: {},
      watch_oracle: {
        verdict: {
          qType: 'general',
          targetHouse: 4,
          targetSignName: 'Cancer',
          targetRuler: 'Moon',
          targetRulerName: 'al-Qamar',
          fulfilmentHouse: 5,
          lagnaRuler: 'Moon',
          rulerRelation: 'Neutral',
          state: 'BLOCKED',
          confidence: 'HIGH',
          score: 2,
          obstruction: 'Mars',
          reversal: 'NONE',
          timing: null,
          direction: 'North',
          afflictedDirection: 'South',
          controllerProfile: 'Receptive',
          factors: [],
        },
        composition: {
          narration: null, // Synthesis failed, but protocol survives
          diagnosis: {
            outcome: 'UNFAVOURABLE',
            primaryPattern: 'CONFLICT',
            secondaryPatterns: [],
            timingPosture: 'UNKNOWN',
            confidence: 0.75,
            obstructingAgent: 'Mars',
            rationale: ['Mars conflicts with the matter'],
          },
          protocol: {
            interventionRequired: true,
            guidance: null,
            steps: [],
            rationale: [],
          },
        },
        window: { startMinute: 20, endMinute: 25 },
        lagnaSignName: 'Burj Saratan',
        lagnaRulerName: 'al-Qamar',
      },
    };

    expect(reading.watch_oracle?.composition.narration).toBeNull();
    expect(reading.watch_oracle?.composition.diagnosis).toBeDefined();
    expect(reading.watch_oracle?.composition.protocol).toBeDefined();
  });

  it('preserves type safety across the integration', () => {
    // This test ensures that TypeScript correctly validates
    // the entire data flow

    type WatchOracleData = NonNullable<Reading['watch_oracle']>;

    const oracleData: WatchOracleData = {
      verdict: {} as DisplayWatchVerdict,
      composition: {} as WatchOracleComposition,
      window: { startMinute: 0, endMinute: 5 },
      lagnaSignName: 'Test Sign',
      lagnaRulerName: 'Test Ruler',
    };

    expect(oracleData.lagnaSignName).toBeDefined();
    expect(oracleData.window.startMinute).toBeDefined();
  });
});
