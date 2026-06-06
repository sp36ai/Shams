/**
 * remedyRenderer — display-ready remedy objects for the UI layer.
 *
 * The library stores no descriptions — titles come from the library,
 * descriptions are not rendered at this layer (passed to oracle prose pipeline).
 * This module maps selected TaggedRemedy objects to the shape AstroVerdictCard expects.
 */

import { REMEDY_LIBRARY, type TaggedRemedy } from './remedyLibrary';

export interface RenderedRemedy {
  id: string;
  category: string;
  effectDimension: string;
  intensity: 'gentle' | 'moderate' | 'deep';
  themeTags: string[];
}

/** Look up remedy objects by ID, preserving selection order. */
export function renderRemedies(selectedIds: string[]): RenderedRemedy[] {
  return selectedIds
    .map(id => REMEDY_LIBRARY.find(r => r.id === id))
    .filter((r): r is TaggedRemedy => r !== undefined)
    .map(r => ({
      id: r.id,
      category: r.category,
      effectDimension: r.effectDimension,
      intensity: r.intensity,
      themeTags: r.themeTags,
    }));
}

/** Returns true if remedy content is available for this reading context. */
export function hasRemedyContent(selectedIds: string[]): boolean {
  return selectedIds.some(id => REMEDY_LIBRARY.some(r => r.id === id));
}
