/**
 * fixtures.ts — Test chart stubs and question builders
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ARCHITECTURAL DECISION: Strongly-typed stubs
 *
 * This file exports Chart constants as empty objects (cast to any) that will
 * be populated with real, verified JSON data. The test suite is written to the
 * STRUCTURE of these charts, not their specific values.
 *
 * When real charts are available, simply paste the JSON into the stubs below.
 * The test suite will immediately pass because all assertions are written to
 * verify the RKP judgment logic, not the astronomical math.
 *
 * STUB CHARTS TO POPULATE:
 * ════════════════════════════════════════════════════════════════════════════
 * - careerYesChart: Real horary chart for a career question (expected: YES)
 * - marriageConditionalChart: Real horary chart for marriage question (expected: CONDITIONAL)
 * - propertyNoChart: Real horary chart for property question (expected: NO)
 *
 * These can come from:
 *   1. Your Firebase production logs (real readings)
 *   2. Swiss Ephemeris computations
 *   3. Verified case studies from your documentation
 *
 * Once you have them, paste the complete JSON Chart objects into the stubs.
 */

import type { Chart } from '../types/chart';
import type { ClassifiedQuestion } from '../types/question';

// ════════════════════════════════════════════════════════════════════════════
// STUB CHARTS: Replace with real JSON when available
// ════════════════════════════════════════════════════════════════════════════

/**
 * STUB: Career YES Chart
 *
 * Placeholder for a real horary chart where the question is about a job/career
 * and the expected verdict is YES.
 */
export const careerYesChart: Chart = {
  planets: {
    Sun: { longitude: 10.5, signLord: 'Mars', starLord: 'Ketu', subLord: 'Venus', isRetrograde: false },
    Moon: { longitude: 145.2, signLord: 'Sun', starLord: 'Venus', subLord: 'Jupiter', isRetrograde: false },
    Mars: { longitude: 18.2, signLord: 'Mars', starLord: 'Venus', subLord: 'Saturn', isRetrograde: false },
    Mercury: { longitude: 35.8, signLord: 'Venus', starLord: 'Sun', subLord: 'Jupiter', isRetrograde: false },
    Jupiter: { longitude: 325.5, signLord: 'Saturn', starLord: 'Jupiter', subLord: 'Moon', isRetrograde: false },
    Venus: { longitude: 45.3, signLord: 'Venus', starLord: 'Moon', subLord: 'Mercury', isRetrograde: false },
    Saturn: { longitude: 295.4, signLord: 'Saturn', starLord: 'Mars', subLord: 'Jupiter', isRetrograde: false },
    Rahu: { longitude: 155.1, signLord: 'Sun', starLord: 'Sun', subLord: 'Venus', isRetrograde: false },
    Ketu: { longitude: 335.1, signLord: 'Jupiter', starLord: 'Saturn', subLord: 'Moon', isRetrograde: false },
  },
  cusps: [
    { number: 1, longitude: 142.5, signLord: 'Sun', starLord: 'Venus', subLord: 'Jupiter' },
    { number: 2, longitude: 170.1, signLord: 'Mercury', starLord: 'Moon', subLord: 'Venus' },
    { number: 3, longitude: 200.0, signLord: 'Venus', starLord: 'Rahu', subLord: 'Sun' },
    { number: 4, longitude: 225.0, signLord: 'Mars', starLord: 'Saturn', subLord: 'Moon' },
    { number: 5, longitude: 255.0, signLord: 'Jupiter', starLord: 'Ketu', subLord: 'Venus' },
    { number: 6, longitude: 285.4, signLord: 'Saturn', starLord: 'Moon', subLord: 'Mercury' },
    { number: 7, longitude: 322.5, signLord: 'Saturn', starLord: 'Jupiter', subLord: 'Mars' },
    { number: 8, longitude: 350.1, signLord: 'Jupiter', starLord: 'Mercury', subLord: 'Venus' },
    { number: 9, longitude: 20.0, signLord: 'Mars', starLord: 'Venus', subLord: 'Saturn' },
    { number: 10, longitude: 50.0, signLord: 'Saturn', starLord: 'Jupiter', subLord: 'Mars' },
    { number: 11, longitude: 350.2, signLord: 'Jupiter', starLord: 'Mercury', subLord: 'Jupiter' },
    { number: 12, longitude: 30.0, signLord: 'Mars', starLord: 'Ketu', subLord: 'Mercury' },
  ],
  rulingPlanets: ['Sun', 'Venus', 'Jupiter', 'Moon', 'Mercury'],
  momentUtc: '2026-05-01T10:00:00Z',
  location: { latitude: 28.6139, longitude: 77.209, tzOffsetHours: 5.5 },
  engineVersion: '2025.03.01',
  metadata: { horaryNumber: 125 },
} as any as Chart;

/**
 * STUB: Marriage CONDITIONAL Chart
 *
 * Placeholder for a real horary chart where the question is about marriage
 * and the expected verdict is CONDITIONAL.
 */
export const marriageConditionalChart: Chart = {
  planets: {
    Sun: { longitude: 155.2, signLord: 'Sun', starLord: 'Sun', subLord: 'Mercury', isRetrograde: false },
    Moon: { longitude: 210.5, signLord: 'Venus', starLord: 'Jupiter', subLord: 'Saturn', isRetrograde: false },
    Mars: { longitude: 95.4, signLord: 'Moon', starLord: 'Saturn', subLord: 'Venus', isRetrograde: false },
    Mercury: { longitude: 165.3, signLord: 'Mercury', starLord: 'Moon', subLord: 'Mercury', isRetrograde: false },
    Jupiter: { longitude: 45.8, signLord: 'Venus', starLord: 'Moon', subLord: 'Jupiter', isRetrograde: false },
    Venus: { longitude: 180.1, signLord: 'Venus', starLord: 'Mars', subLord: 'Moon', isRetrograde: false },
    Saturn: { longitude: 310.2, signLord: 'Saturn', starLord: 'Rahu', subLord: 'Mars', isRetrograde: true },
    Rahu: { longitude: 10.2, signLord: 'Mars', starLord: 'Ketu', subLord: 'Jupiter', isRetrograde: false },
    Ketu: { longitude: 190.2, signLord: 'Venus', starLord: 'Rahu', subLord: 'Mercury', isRetrograde: false },
  },
  cusps: [
    { number: 1, longitude: 205.1, signLord: 'Venus', starLord: 'Jupiter', subLord: 'Mercury' },
    { number: 2, longitude: 235.4, signLord: 'Mars', starLord: 'Saturn', subLord: 'Venus' },
    { number: 3, longitude: 265.0, signLord: 'Jupiter', starLord: 'Venus', subLord: 'Mars' },
    { number: 4, longitude: 295.0, signLord: 'Saturn', starLord: 'Moon', subLord: 'Sun' },
    { number: 5, longitude: 325.0, signLord: 'Saturn', starLord: 'Jupiter', subLord: 'Mercury' },
    { number: 6, longitude: 355.0, signLord: 'Jupiter', starLord: 'Saturn', subLord: 'Venus' },
    { number: 7, longitude: 25.1, signLord: 'Mars', starLord: 'Ketu', subLord: 'Moon' },
    { number: 8, longitude: 55.0, signLord: 'Venus', starLord: 'Sun', subLord: 'Jupiter' },
    { number: 9, longitude: 85.0, signLord: 'Mercury', starLord: 'Jupiter', subLord: 'Saturn' },
    { number: 10, longitude: 115.0, signLord: 'Moon', starLord: 'Saturn', subLord: 'Mars' },
    { number: 11, longitude: 145.2, signLord: 'Sun', starLord: 'Venus', subLord: 'Jupiter' },
    { number: 12, longitude: 175.0, signLord: 'Mercury', starLord: 'Mars', subLord: 'Sun' },
  ],
  rulingPlanets: ['Venus', 'Moon', 'Saturn', 'Mercury', 'Jupiter'],
  momentUtc: '2026-05-02T15:30:00Z',
  location: { latitude: 19.076, longitude: 72.8777, tzOffsetHours: 5.5 },
  engineVersion: '2025.03.01',
  metadata: { horaryNumber: 42 },
} as any as Chart;

/**
 * STUB: Property NO Chart
 *
 * Placeholder for a real horary chart where the question is about property
 * and the expected verdict is NO.
 */
export const propertyNoChart: Chart = {
  planets: {
    Sun: { longitude: 280.1, signLord: 'Saturn', starLord: 'Moon', subLord: 'Mercury', isRetrograde: false },
    Moon: { longitude: 65.4, signLord: 'Mercury', starLord: 'Rahu', subLord: 'Mars', isRetrograde: false },
    Mars: { longitude: 245.2, signLord: 'Jupiter', starLord: 'Ketu', subLord: 'Mercury', isRetrograde: false },
    Mercury: { longitude: 295.1, signLord: 'Saturn', starLord: 'Mars', subLord: 'Ketu', isRetrograde: false },
    Jupiter: { longitude: 110.2, signLord: 'Moon', starLord: 'Saturn', subLord: 'Saturn', isRetrograde: false },
    Venus: { longitude: 330.4, signLord: 'Jupiter', starLord: 'Jupiter', subLord: 'Sun', isRetrograde: false },
    Saturn: { longitude: 15.5, signLord: 'Mars', starLord: 'Ketu', subLord: 'Venus', isRetrograde: false },
    Rahu: { longitude: 195.8, signLord: 'Venus', starLord: 'Rahu', subLord: 'Moon', isRetrograde: false },
    Ketu: { longitude: 15.8, signLord: 'Mars', starLord: 'Ketu', subLord: 'Venus', isRetrograde: false },
  },
  cusps: [
    { number: 1, longitude: 62.1, signLord: 'Mercury', starLord: 'Mars', subLord: 'Mars' },
    { number: 2, longitude: 92.0, signLord: 'Moon', starLord: 'Jupiter', subLord: 'Saturn' },
    { number: 3, longitude: 122.0, signLord: 'Sun', starLord: 'Ketu', subLord: 'Venus' },
    { number: 4, longitude: 148.5, signLord: 'Sun', starLord: 'Venus', subLord: 'Saturn' },
    { number: 5, longitude: 178.0, signLord: 'Mercury', starLord: 'Mars', subLord: 'Moon' },
    { number: 6, longitude: 208.0, signLord: 'Venus', starLord: 'Rahu', subLord: 'Jupiter' },
    { number: 7, longitude: 242.1, signLord: 'Jupiter', starLord: 'Venus', subLord: 'Mercury' },
    { number: 8, longitude: 272.0, signLord: 'Saturn', starLord: 'Sun', subLord: 'Mars' },
    { number: 9, longitude: 302.0, signLord: 'Saturn', starLord: 'Jupiter', subLord: 'Rahu' },
    { number: 10, longitude: 332.0, signLord: 'Jupiter', starLord: 'Saturn', subLord: 'Sun' },
    { number: 11, longitude: 355.4, signLord: 'Jupiter', starLord: 'Mercury', subLord: 'Mercury' },
    { number: 12, longitude: 25.1, signLord: 'Mars', starLord: 'Venus', subLord: 'Jupiter' },
  ],
  rulingPlanets: ['Mercury', 'Mars', 'Saturn', 'Sun', 'Rahu'],
  momentUtc: '2026-05-03T09:15:00Z',
  location: { latitude: 40.7128, longitude: -74.006, tzOffsetHours: -4 },
  engineVersion: '2025.03.01',
  metadata: { horaryNumber: 201 },
} as any as Chart;

// ════════════════════════════════════════════════════════════════════════════
// QUESTION BUILDERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Build a test question in English.
 */
export function buildQuestion(qType: string, text: string): ClassifiedQuestion {
  return {
    text,
    qType,
    lang: 'en',
  };
}

/**
 * Build a test question in Urdu.
 */
export function buildQuestionUrdu(qType: string, text: string): ClassifiedQuestion {
  return {
    text,
    qType,
    lang: 'ur',
  };
}

/**
 * Build a test question in Hindi.
 */
export function buildQuestionHindi(qType: string, text: string): ClassifiedQuestion {
  return {
    text,
    qType,
    lang: 'hi',
  };
}

// ════════════════════════════════════════════════════════════════════════════
// TEST SCENARIO INTERFACE
// ════════════════════════════════════════════════════════════════════════════

export interface TestScenario {
  readonly name: string;
  readonly description: string;
  readonly chart: Chart;
  readonly question: ClassifiedQuestion;
  readonly expectedVerdictKind?: 'YES' | 'NO' | 'CONDITIONAL' | 'DELAYED' | 'UNCLEAR';
  readonly expectedConfidenceLevel?: 'low' | 'medium' | 'high';
}
