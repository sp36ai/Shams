/**
 * withTimeout — resolves with `promise`'s value, or `undefined` after `ms`,
 * whichever comes first.
 *
 * Some native module calls (Firebase Auth token refresh, App Check token
 * fetch/attestation, ...) let their promise hang indefinitely on real
 * devices — no resolve, no reject — rather than time out on their own. Any
 * `await` on one of those sitting inside a `try/finally` that resets UI
 * state (a loading flag, a re-entrancy guard) means the `finally` never
 * runs if the call hangs, silently freezing the screen forever. Race the
 * call against a timer instead of awaiting it bare.
 *
 * Deliberately resolves rather than rejects on timeout: callers that treat
 * `undefined` as "no answer yet" don't need a second try/catch layer just
 * to handle the timeout case.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise<T | undefined>(resolve => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}
