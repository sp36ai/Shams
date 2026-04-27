import { type CallableRequest, HttpsError } from 'firebase-functions/v2/https';

export interface AuthContext {
  userId: string;
  email: string;
}

export function verifyAuth(request: CallableRequest): AuthContext {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  return {
    userId: request.auth.uid,
    email: (request.auth.token.email as string | undefined) ?? '',
  };
}
