import type { NarrationFields } from '../../src/oracle/responseComposer';

export type ExpectedValidity = 'VALID' | 'INVALID';

export interface GeneratedCase {
  readonly id: string;
  readonly category: string;
  readonly contractId: string;
  readonly narration: NarrationFields;
  /** VALID: the validator must accept this. INVALID: the validator must reject this — a materially contradictory or malformed claim. */
  readonly expected: ExpectedValidity;
  /** Free-form provenance for a finding: which base text, which mutation(s), which axis values produced this case. */
  readonly mutationMeta: Readonly<Record<string, unknown>>;
}
