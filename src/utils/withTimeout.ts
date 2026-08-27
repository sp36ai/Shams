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

/**
 * withDeadline — like withTimeout, but preserves the failure.
 *
 * withTimeout above resolves `undefined` for BOTH a timeout and a rejection,
 * which is right for a fire-and-forget gate (an App Check token that never
 * arrives) and wrong for a call whose error the caller must act on: a Firebase
 * callable carries its meaning in `.code`, and collapsing 'resource-exhausted'
 * and 'aborted' into "no answer" tells the seeker their question timed out
 * when in fact they are out of questions, or the reading is already running.
 *
 * So this one rejects with the original error, and rejects with `onTimeout()`
 * only when the deadline actually passes — which is the case the raw promise
 * cannot report, because a hung native call never settles at all.
 */
export function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => Error,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
