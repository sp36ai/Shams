/**
 * responseValidator.ts — post-generation quality gate for narration.
 * --------------------------------------------------------------------------
 * After Claude produces the narration, this validates it against the
 * Shams al-Asrār production standard:
 *
 * 1. Outcome clarity: verdict not buried in poetry
 * 2. Internal terminology: no machinery leakage
 * 3. Voice consistency: sounds like oracle, not report
 * 4. No fabrication: remedies/timing only from brief
 * 5. Mystical register: proper tone and imagery
 *
 * This is NOT a rewrite layer. Invalid responses still pass through
 * (narration is best-effort). This layer flags issues for logging/monitoring.
 */

import { logger } from '../utils/logger';

export interface NarrationFields {
  rkp_finding: string;
  interpretation: string;
  recommended_approach: string;
  why_this_remedy: string | null;
  signature: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  severity: 'critical' | 'warning' | 'info';
}

// ──────────────────────────────────────────────────────────────────────────
// Pattern lists for validation
// ──────────────────────────────────────────────────────────────────────────

const INTERNAL_TERMINOLOGY = [
  // Engine names
  /\bRKP\b/gi,
  /\bwatch oracle\b/gi,
  /\bhorary\b/gi,
  /\bSBC\b/gi,
  /\bAbjad\b/gi,
  /\bJafar\b/gi,

  // Calculation/methodology
  /scoring\s*(?:system|mechanism|framework)/gi,
  /algorithm\b/gi,
  /calculation\s*engine/gi,
  /judgment\s*rule/gi,
  /engine\s*(?:output|result|verdict)/gi,
  /diagnostic\s*pipeline/gi,

  // Implementation details
  /Cloud Functions/gi,
  /Firestore/gi,
  /Claude\s*(?:Opus|model)/gi,
  /API\s*(?:call|response)/gi,
  /database/gi,
  /server-side/gi,
  /timestamp/gi,
  /milliseconds/gi,
];

const OUTCOME_KEYWORDS = [
  'YES',
  'NO',
  'WAIT',
  'DELAY',
  'CAUTION',
  'UNFAVOURABLE',
  'FAVOURABLE',
  'CONDITIONAL',
  'BLOCKED',
  'OPEN',
  'CLEAR',
];

const GENERIC_AI_PHRASES = [
  /as an AI/gi,
  /as a language model/gi,
  /I apologize/gi,
  /I\'m unable to/gi,
  /I can\'t determine/gi,
  /as a disclaimer/gi,
  /to clarify/gi,
  /however, it\'s important to note/gi,
  /ultimately, only you can decide/gi,
];

const MYSTICAL_IMAGERY = [
  'veil',
  'threshold',
  'door',
  'road',
  'river',
  'current',
  'lamp',
  'light',
  'dawn',
  'shadow',
  'mirror',
  'letter',
  'silence',
  'turning',
  'season',
  'path',
  'opening',
  'closure',
  'weight',
  'chamber',
  'gatekeeper',
  'scroll',
];

// ──────────────────────────────────────────────────────────────────────────
// Validation checks
// ──────────────────────────────────────────────────────────────────────────

function checkInternalTerminology(text: string): string[] {
  const issues: string[] = [];
  for (const pattern of INTERNAL_TERMINOLOGY) {
    if (pattern.test(text)) {
      const match = text.match(pattern)?.[0];
      if (match) {
        issues.push(`Internal terminology exposed: "${match}"`);
      }
    }
  }
  return issues;
}

function checkOutcomeClarity(finding: string, interpretation: string): string[] {
  const issues: string[] = [];

  // Check if interpretation starts with a clear outcome
  const firstSentence = (interpretation.split(/[.!?]/)[0] ?? '').trim();
  const hasOutcomeStart = OUTCOME_KEYWORDS.some(keyword =>
    firstSentence.toUpperCase().includes(keyword),
  );

  if (!hasOutcomeStart) {
    issues.push('Outcome keyword not in first sentence of interpretation');
  }

  // Check if finding is unreasonably long (might bury outcome)
  if (finding.split(/[.!?]/).length > 6) {
    issues.push('rkp_finding contains more than 6 sentences (outcome might be buried)');
  }

  return issues;
}

function checkGenericAIPhrasing(text: string): string[] {
  const issues: string[] = [];
  for (const pattern of GENERIC_AI_PHRASES) {
    if (pattern.test(text)) {
      issues.push(`Generic AI phrasing: "${text.match(pattern)?.[0]}"`);
    }
  }
  return issues;
}

function checkMysticalTone(text: string): string[] {
  const issues: string[] = [];

  const lowerText = text.toLowerCase();
  const imageryCount = MYSTICAL_IMAGERY.filter(img =>
    lowerText.includes(img.toLowerCase()),
  ).length;

  // Should have at least 1-2 mystical images in the narration
  if (imageryCount === 0) {
    issues.push('No mystical imagery detected (veil, threshold, door, river, etc.)');
  }

  return issues;
}

function checkForFabrication(
  interpretation: string,
  recommendedApproach: string,
  whyThisRemedy: string | null,
): string[] {
  const issues: string[] = [];
  const combined = [interpretation, recommendedApproach, whyThisRemedy].join(' ').toLowerCase();

  // Check for ungrounded promises
  if (/will definitely|guaranteed|certain that/i.test(combined)) {
    issues.push('Ungrounded promise or certainty claim');
  }

  // Check for invented practices
  if (/you must|you should|you need to|do this and|perform|recite|repeat/i.test(recommendedApproach)) {
    // This is actually OK if it's describing the remedy, not inventing one
    // But flag if it appears without justification in why_this_remedy
    if (!whyThisRemedy || whyThisRemedy.length < 20) {
      issues.push('Prescribed action without adequate justification in why_this_remedy');
    }
  }

  return issues;
}

function checkSignatureQuality(signature: string): string[] {
  const issues: string[] = [];

  if (signature.length < 20) {
    issues.push('Signature too brief (should be a meaningful line)');
  }

  if (signature.length > 200) {
    issues.push('Signature too long (should be one line)');
  }

  // Signature should not end with exclamation marks or close statements
  if (signature.endsWith('!') || signature.includes('goodbye') || signature.includes('farewell')) {
    issues.push('Signature sounds like a sign-off (should leave door open)');
  }

  return issues;
}

// ──────────────────────────────────────────────────────────────────────────
// Main validation function
// ──────────────────────────────────────────────────────────────────────────

export function validateNarrationResponse(narration: NarrationFields): ValidationResult {
  const issues: string[] = [];

  // Concatenate all prose for holistic checks
  const fullText = [
    narration.rkp_finding,
    narration.interpretation,
    narration.recommended_approach,
    narration.why_this_remedy,
    narration.signature,
  ]
    .filter(Boolean)
    .join(' ');

  // Run all checks
  issues.push(...checkInternalTerminology(fullText));
  issues.push(...checkOutcomeClarity(narration.rkp_finding, narration.interpretation));
  issues.push(...checkGenericAIPhrasing(fullText));
  issues.push(...checkMysticalTone(fullText));
  issues.push(...checkForFabrication(
    narration.interpretation,
    narration.recommended_approach,
    narration.why_this_remedy,
  ));
  issues.push(...checkSignatureQuality(narration.signature));

  // Classify severity
  const hasCritical = issues.some(
    issue =>
      issue.includes('Internal terminology') ||
      issue.includes('Generic AI') ||
      issue.includes('ungrounded promise'),
  );

  const severity = hasCritical ? 'critical' : issues.length > 0 ? 'warning' : 'info';

  // Log if issues found
  if (issues.length > 0) {
    logger.warn('Narration validation issues detected', {
      severity,
      issueCount: issues.length,
      issues,
    });
  }

  return {
    isValid: severity !== 'critical',
    issues,
    severity,
  };
}
