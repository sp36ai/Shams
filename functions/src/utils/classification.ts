/**
 * Question Classification Utility
 * 
 * Classifies user questions into Shamsi Logic question types:
 * employment, career, lawsuit, marriage, property, relocation
 */

import type { ShamsiQuestionType } from '../engine/rkp/shamsiHouseMatrix';

/**
 * Classify a question into a Shamsi Logic question type using keyword matching.
 * 
 * In production, this could use Claude Haiku or rule-based logic.
 * Current implementation uses simple keyword heuristics.
 */
export async function classifyQuestionAsType(
  question: string,
  lang: 'en' | 'ur' | 'hi',
): Promise<ShamsiQuestionType> {
  const q = question.toLowerCase();

  // Employment keywords
  if (
    q.includes('job') ||
    q.includes('interview') ||
    q.includes('hired') ||
    q.includes('position') ||
    q.includes('hire') ||
    q.includes('employment') ||
    q.includes('offer')
  ) {
    return 'employment';
  }

  // Career keywords
  if (
    q.includes('promotion') ||
    q.includes('promoted') ||
    q.includes('career') ||
    q.includes('business') ||
    q.includes('success') ||
    q.includes('achievement') ||
    q.includes('status')
  ) {
    return 'career';
  }

  // Lawsuit keywords
  if (q.includes('lawsuit') || q.includes('court') || q.includes('legal') || q.includes('win')) {
    return 'lawsuit';
  }

  // Marriage keywords
  if (
    q.includes('marriage') ||
    q.includes('marry') ||
    q.includes('wedding') ||
    q.includes('spouse') ||
    q.includes('relationship') ||
    q.includes('wedding')
  ) {
    return 'marriage';
  }

  // Property keywords
  if (
    q.includes('house') ||
    q.includes('property') ||
    q.includes('home') ||
    q.includes('buy') ||
    q.includes('sell') ||
    q.includes('real estate') ||
    q.includes('apartment')
  ) {
    return 'property';
  }

  // Relocation keywords
  if (
    q.includes('move') ||
    q.includes('relocation') ||
    q.includes('abroad') ||
    q.includes('foreign') ||
    q.includes('travel') ||
    q.includes('settle')
  ) {
    return 'relocation';
  }

  // Default to employment if no clear match
  return 'employment';
}
