/**
 * The short reference a seeker sees on a failed turn ("Ref 3k9x2m1a"): the
 * first 8 characters of the requestId the app generated for that question
 * or follow-up. Every failure log for the request carries it as `ref`, so a
 * screenshot leads straight to the stage that failed. The requestId is
 * random and client-made, so the reference says nothing about the seeker,
 * the reading or the server. Keep in step with src/utils/requestRef.ts.
 */
export const REQUEST_REF_LENGTH = 8;

export function requestRef(requestId: string | undefined): string | undefined {
  return requestId === undefined ? undefined : requestId.slice(0, REQUEST_REF_LENGTH);
}
