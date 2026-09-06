/**
 * terminologyFilter.ts — removes internal machinery terminology from narration.
 * --------------------------------------------------------------------------
 * Before narration is returned to the client, this filters out any references
 * to internal implementation, calculation methodology, or system names.
 *
 * This is a safety net over the system prompt — the prompt tells Claude
 * not to mention these terms, but this filter ensures none slip through.
 *
 * Rules:
 * - Never expose: RKP, engine names, calculation framework, implementation details
 * - Preserve: Legitimate Arabic/Urdu names, astrological terminology, traditional language
 * - Strategy: Remove mentions, replace context-specific, or rephrase slightly
 */

export interface NarrationFields {
  rkp_finding: string;
  interpretation: string;
  recommended_approach: string;
  why_this_remedy: string | null;
  signature: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Terminology patterns to filter
// ──────────────────────────────────────────────────────────────────────────

interface FilterRule {
  pattern: RegExp;
  replacement: string | ((match: string) => string);
  description: string;
}

const FILTER_RULES: FilterRule[] = [
  // Engine and system names
  {
    pattern: /\bRKP\s*(?:engine|system|calculation|verdict|judgment|reading)?/gi,
    replacement: 'the reading',
    description: 'RKP engine name',
  },
  {
    pattern: /\bwatch\s*oracle\s*(?:engine|system)?/gi,
    replacement: 'the chart',
    description: 'Watch Oracle system name',
  },
  {
    pattern: /\b(?:horary|horary\s*astrology)\b/gi,
    replacement: 'this moment',
    description: 'Horary term (keep Islamic/RKP only)',
  },
  {
    pattern: /\bdigital\s*watch/gi,
    replacement: 'the watch',
    description: 'Digital watch terminology',
  },

  // Calculation/methodology terms
  {
    pattern: /\b(?:scoring|score)\s*(?:system|mechanism|framework|value|result)?/gi,
    replacement: 'the indication',
    description: 'Scoring system reference',
  },
  {
    pattern: /\balgorithm\b/gi,
    replacement: 'the reading',
    description: 'Algorithm reference',
  },
  {
    pattern: /\bcalculation\s*(?:engine|framework|pipeline)?/gi,
    replacement: 'the examination',
    description: 'Calculation engine reference',
  },
  {
    pattern: /\b(?:judgment|diagnostic)\s*(?:rule|engine|pipeline|logic)/gi,
    replacement: 'the understanding',
    description: 'Judgment rule/engine reference',
  },
  {
    pattern: /\b(?:engine|computational)\s*(?:output|result|verdict|logic)/gi,
    replacement: 'the indication',
    description: 'Engine output reference',
  },

  // Implementation/technical details
  {
    pattern: /\bCloud\s*Functions?/gi,
    replacement: 'the server',
    description: 'Cloud Functions reference',
  },
  {
    pattern: /\bFirestore/gi,
    replacement: 'the records',
    description: 'Firestore reference',
  },
  {
    pattern: /\bClaude\s*(?:Opus|model|API|system)/gi,
    replacement: 'the oracle',
    description: 'Claude/model reference',
    },
  {
    pattern: /\b(?:API|HTTP)\s*(?:call|response|request|endpoint)/gi,
    replacement: 'the consultation',
    description: 'API/HTTP reference',
  },
  {
    pattern: /database\b/gi,
    replacement: 'the archive',
    description: 'Database reference',
  },
  {
    pattern: /server-side/gi,
    replacement: 'the backend',
    description: 'Server-side reference',
  },
  {
    pattern: /\btimestamp\b/gi,
    replacement: 'the moment',
    description: 'Timestamp reference',
  },
  {
    pattern: /milliseconds?/gi,
    replacement: 'moments',
    description: 'Milliseconds reference',
  },

  // Internal names/codes
  {
    pattern: /\b(?:SBC|Abjad|Jafar)\b/gi,
    replacement: '',
    description: 'Internal system codes',
  },

  // Phrases that expose machinery
  {
    pattern: /the model (?:says|finds|determines|calculates)/gi,
    replacement: 'the reading shows',
    description: 'Model language exposure',
  },
  {
    pattern: /according to the (?:engine|algorithm|system|calculation)/gi,
    replacement: 'the reading',
    description: 'System reference phrase',
  },
  {
    pattern: /the (?:RKP |watch oracle |digital )?chart (?:indicates|shows) that/gi,
    replacement: 'what appears is',
    description: 'Chart indicates phrasing (OK to keep "chart" but not the machinery)',
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Filtering logic
// ──────────────────────────────────────────────────────────────────────────

function applyFilterRules(text: string): string {
  let filtered = text;

  for (const rule of FILTER_RULES) {
    if (rule.pattern.test(filtered)) {
      if (typeof rule.replacement === 'string') {
        filtered = filtered.replace(rule.pattern, rule.replacement);
      } else {
        filtered = filtered.replace(rule.pattern, rule.replacement);
      }
    }
  }

  return filtered;
}

function cleanupWhitespace(text: string): string {
  // Remove double spaces
  return text
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .replace(/\s+,/g, ',')
    .trim();
}

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────

/**
 * Filter a single text field.
 * Returns the cleaned text.
 */
export function filterText(text: string): string {
  let filtered = applyFilterRules(text);
  filtered = cleanupWhitespace(filtered);
  return filtered;
}

/**
 * Filter all narration fields.
 * Returns a new narration object with filtered text.
 */
export function filterNarration(narration: NarrationFields): NarrationFields {
  return {
    rkp_finding: filterText(narration.rkp_finding),
    interpretation: filterText(narration.interpretation),
    recommended_approach: filterText(narration.recommended_approach),
    why_this_remedy: narration.why_this_remedy ? filterText(narration.why_this_remedy) : null,
    signature: filterText(narration.signature),
  };
}
