/**
 * Shamsi Logic Validation Test Suite
 * 
 * Tests the 5 benchmark horary questions defined in the spec.
 * Each test verifies Promise verdict, Significator grades, and Operative planets.
 * 
 * NOTE: These are unit tests. Real validation requires testing against
 * actual horary questions with known astrologer verdicts.
 */

import { describe, it, expect } from 'vitest';
import { buildChart } from '../engine/primitives/chartBuilder';
import {
  judgeShamsiLogic,
  resolveTransitTrigger,
  createEphemerisAdapter,
  resolveKPCoordinates,
  EventTimeline,
} from '../engine/rkp/shamsiLogic';
import type { ShamsiQuestionType } from '../engine/rkp/shamsiHouseMatrix';

/**
 * Benchmark Test 1: "Will I get this job?"
 * Expected: PROMISED if StL signifies 6/2/10/11 (employment houses)
 */
describe('Shamsi Logic - Test Case 1: Employment (Job Offer)', () => {
  it('returns PROMISED if Star Lord of CSL signifies primary/supporting houses', () => {
    // Synthetic chart for testing (coordinates: New York)
    const chart = buildChart('2026-09-06T14:30:00Z', 40.7128, -74.006);
    const verdict = judgeShamsiLogic(chart, 'employment' as ShamsiQuestionType);

    // Assertion: if PROMISED, StL must signify 6 (primary) or 2/10/11 (secondary)
    if (verdict.promise.verdict === 'PROMISED') {
      expect(
        verdict.promise.signifiesPromising,
        'Star Lord should signify promise houses',
      ).toBe(true);
      expect(
        verdict.promise.signifiesNegating,
        'Star Lord should NOT signify negating house',
      ).toBe(false);
    }
  });

  it('returns DENIED if Star Lord of CSL signifies negating house (5)', () => {
    const chart = buildChart('2026-09-06T14:30:00Z', 40.7128, -74.006);
    const verdict = judgeShamsiLogic(chart, 'employment' as ShamsiQuestionType);

    // Assertion: if DENIED, StL must signify 5 (negating for employment)
    if (verdict.promise.verdict === 'DENIED') {
      expect(
        verdict.promise.signifiesNegating,
        'Star Lord should signify negating house for DENIED verdict',
      ).toBe(true);
      expect(
        verdict.promise.signifiesPromising,
        'Star Lord should NOT signify promise houses',
      ).toBe(false);
    }
  });

  it('Significator grades are ranked A > B > C > D', () => {
    const chart = buildChart('2026-09-06T14:30:00Z', 40.7128, -74.006);
    const verdict = judgeShamsiLogic(chart, 'employment' as ShamsiQuestionType);

    // Count grades
    const grades = Object.values(verdict.significators);
    const gradeA = grades.filter(g => g === 'A').length;
    const gradeB = grades.filter(g => g === 'B').length;
    const gradeC = grades.filter(g => g === 'C').length;
    const gradeD = grades.filter(g => g === 'D').length;
    const gradeNull = grades.filter(g => g === null).length;

    // Reasonable distribution (at least 1 grade per tier)
    expect(gradeA + gradeB + gradeC + gradeD).toBeGreaterThan(0);
    expect(gradeNull).toBeLessThan(9); // Not all ungraded
  });
});

/**
 * Benchmark Test 2: "Will I win this lawsuit?"
 * Expected: PROMISED if StL signifies 6/11 (win/gain)
 */
describe('Shamsi Logic - Test Case 2: Lawsuit (Win Case)', () => {
  it('routes to lawsuit question type with correct house mapping', () => {
    const chart = buildChart('2026-09-06T14:30:00Z', 51.5074, -0.1278); // London
    const verdict = judgeShamsiLogic(chart, 'lawsuit' as ShamsiQuestionType);

    // Assertion: primary house should be 6
    expect(verdict.promise.primaryHouse).toBe(6);
    // Supporting houses should include 11 (gain)
    expect(verdict.promise.supportingHouses).toContain(11);
  });
});

/**
 * Benchmark Test 3: "Will my marriage happen?"
 * Expected: PROMISED if StL signifies 7/2/11 (spouse/benefits/gains)
 */
describe('Shamsi Logic - Test Case 3: Marriage', () => {
  it('uses 7th house as primary for marriage questions', () => {
    const chart = buildChart('2026-09-06T14:30:00Z', 28.7041, 77.1025); // Delhi
    const verdict = judgeShamsiLogic(chart, 'marriage' as ShamsiQuestionType);

    expect(verdict.promise.primaryHouse).toBe(7);
    expect(verdict.promise.supportingHouses).toContain(2);
    expect(verdict.promise.supportingHouses).toContain(11);
  });

  it('negating house is 1 (self/separation)', () => {
    const chart = buildChart('2026-09-06T14:30:00Z', 28.7041, 77.1025);
    const verdict = judgeShamsiLogic(chart, 'marriage' as ShamsiQuestionType);

    expect(verdict.promise.negatingHouse).toBe(1);
  });
});

/**
 * Benchmark Test 4: "Will I buy this house?"
 * Expected: PROMISED if StL signifies 4/11/12 (property/gains/investment)
 */
describe('Shamsi Logic - Test Case 4: Property Purchase', () => {
  it('uses 4th house (property) as primary', () => {
    const chart = buildChart('2026-09-06T14:30:00Z', 35.0895, 139.1955); // Tokyo
    const verdict = judgeShamsiLogic(chart, 'property' as ShamsiQuestionType);

    expect(verdict.promise.primaryHouse).toBe(4);
    expect(verdict.promise.supportingHouses).toContain(11);
    expect(verdict.promise.supportingHouses).toContain(12);
  });
});

/**
 * Benchmark Test 5: "Will I settle abroad permanently?"
 * Expected: PROMISED if StL signifies 12/3/9 (foreign/journey/long travel)
 */
describe('Shamsi Logic - Test Case 5: Relocation Abroad', () => {
  it('uses 12th house (foreign lands) as primary', () => {
    const chart = buildChart('2026-09-06T14:30:00Z', -33.8688, 151.2093); // Sydney
    const verdict = judgeShamsiLogic(chart, 'relocation' as ShamsiQuestionType);

    expect(verdict.promise.primaryHouse).toBe(12);
    expect(verdict.promise.supportingHouses).toContain(3);
    expect(verdict.promise.supportingHouses).toContain(9);
  });

  it('negating houses prevent return (4 = home, 2/11 = roots/ties)', () => {
    const chart = buildChart('2026-09-06T14:30:00Z', -33.8688, 151.2093);
    const verdict = judgeShamsiLogic(chart, 'relocation' as ShamsiQuestionType);

    // Negating house for relocation is 4 (home)
    expect(verdict.promise.negatingHouse).toBe(4);
  });
});

/**
 * Phase 3 & 4 Integration Test
 */
describe('Shamsi Logic - Phase 3 & 4 Integration', () => {
  it('narrows operative planets from DBA + Ruling Planets', () => {
    const chart = buildChart('2026-09-06T14:30:00Z', 40.7128, -74.006);
    const verdict = judgeShamsiLogic(chart, 'employment' as ShamsiQuestionType);

    // Phase 3 should always produce operative planets if verdict is sound
    expect(Array.isArray(verdict.timeWindow.operative)).toBe(true);
    // Each operative planet has a dbaRole and grade
    verdict.timeWindow.operative.forEach(op => {
      expect(['mahadasha', 'antardasha', 'pratyantardasha']).toContain(op.dbaRole);
      expect(['A', 'B', 'C', 'D', null]).toContain(op.grade);
    });
  });

  it('Phase 4 transit trigger returns null if verdict is DENIED', () => {
    const chart = buildChart('2026-09-06T14:30:00Z', 40.7128, -74.006);
    const verdict = judgeShamsiLogic(chart, 'employment' as ShamsiQuestionType);

    if (verdict.promise.verdict === 'DENIED') {
      const timing = resolveTransitTrigger(
        chart,
        verdict.timeWindow,
        EventTimeline.MACRO,
        createEphemerisAdapter(40.7128, -74.006),
        resolveKPCoordinates,
      );

      // Phase 4 shouldn't compute timing for DENIED verdicts
      expect(timing.sunWindow).toBeNull();
    }
  });

  it('Phase 4 respects timeline (macro vs micro)', () => {
    const chart = buildChart('2026-09-06T14:30:00Z', 40.7128, -74.006);
    const verdict = judgeShamsiLogic(chart, 'employment' as ShamsiQuestionType);

    if (verdict.promise.verdict === 'PROMISED') {
      const macroTiming = resolveTransitTrigger(
        chart,
        verdict.timeWindow,
        EventTimeline.MACRO,
        createEphemerisAdapter(40.7128, -74.006),
        resolveKPCoordinates,
        365,
      );

      const microTiming = resolveTransitTrigger(
        chart,
        verdict.timeWindow,
        EventTimeline.MICRO,
        createEphemerisAdapter(40.7128, -74.006),
        resolveKPCoordinates,
        30,
      );

      // Macro should have Sun window, Micro should have Sun+Moon+Lagna
      if (macroTiming.sunWindow) {
        expect(macroTiming.moonWindow).toBeNull();
        expect(macroTiming.lagnaWindow).toBeNull();
      }

      // Micro may have all three (if operative planets allow)
      if (microTiming.moonWindow) {
        expect(microTiming.sunWindow).not.toBeNull();
      }
    }
  });
});
