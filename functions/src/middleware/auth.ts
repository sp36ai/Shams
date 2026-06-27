import { type CallableRequest, HttpsError } from 'firebase-functions/v2/https';

export interface AuthContext {
  userId: string;
  email: string;
}

export function verifyAuth(request: CallableRequest): AuthContext {
  // Emulator-only bypass — FUNCTIONS_EMULATOR is set automatically by Firebase
  // and is never true in deployed Cloud Functions.
  if (process.env.FUNCTIONS_EMULATOR === 'true' && !request.auth) {
    return {
      userId: 'dev-test-user',
      email: 'dev@test.com',
    };
  }

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  return {
    userId: request.auth.uid,
    email: request.auth.token.email ?? '',
  };
}
