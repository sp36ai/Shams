import { type CallableRequest, HttpsError } from 'firebase-functions/v2/https';

export interface AuthContext {
  userId: string;
  email: string;
}

export function verifyAuth(request: CallableRequest): AuthContext {
  // DEV MODE: Allow unauthenticated requests for testing
  if (process.env.NODE_ENV === 'development' && !request.auth) {
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
    email: (request.auth.token.email as string | undefined) ?? '',
  };
}
