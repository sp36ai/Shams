export type DiscussReadingParams = {
  threadId: string;
  question: string;
};

export type DiscussReadingResult =
  | { available: false; reason?: string }
  | { available: true; reading: unknown };

/**
 * discussReading client boundary stub.
 *
 * This function is intentionally a stub while the server-side callable is
 * not implemented. It MUST NOT call askWatchOracle, create readings, or
 * consume quota. It returns { available: false } to indicate the API is
 * currently unavailable; callers should surface a controlled UI state.
 */
export async function discussReading(_params: DiscussReadingParams): Promise<DiscussReadingResult> {
  // Simulate an explicit NOT_IMPLEMENTED / UNAVAILABLE response from server.
  return { available: false, reason: 'NOT_IMPLEMENTED' };
}
