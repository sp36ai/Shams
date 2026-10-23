/**
 * The short reference shown on a failed turn ("Ref 3k9x2m1a"): the first 8
 * characters of the requestId this app generated for that question or
 * follow-up. The server stamps the same value as `ref` on every failure log
 * of that request, so a screenshot leads to the stage that failed. The
 * requestId is random and made here, so it says nothing about the seeker,
 * the reading or the server. Keep in step with functions/src/utils/requestRef.ts.
 */
export const REQUEST_REF_LENGTH = 8;

export function requestRef(requestId: string | undefined): string | undefined {
  return requestId === undefined ? undefined : requestId.slice(0, REQUEST_REF_LENGTH);
}
