import { withTimeout } from '../withTimeout';

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves with the value when the promise settles before the timeout', async () => {
    const promise = Promise.resolve('answered');
    const resultPromise = withTimeout(promise, 8000);
    jest.advanceTimersByTime(1000);
    await expect(resultPromise).resolves.toBe('answered');
  });

  it('resolves with undefined once the timeout elapses on a promise that never settles', async () => {
    // Simulates the real-world failure this guards against: a native module
    // call (App Check getToken, ID token refresh) that neither resolves nor
    // rejects on some devices.
    const neverSettles = new Promise<string>(() => {
      /* deliberately never resolve/reject */
    });

    const resultPromise = withTimeout(neverSettles, 8000);
    jest.advanceTimersByTime(8000);
    await expect(resultPromise).resolves.toBeUndefined();
  });

  it('resolves with undefined (not a rejection) when the promise rejects', async () => {
    const rejecting = Promise.reject(new Error('native call failed'));
    const resultPromise = withTimeout(rejecting, 8000);
    jest.advanceTimersByTime(1000);
    await expect(resultPromise).resolves.toBeUndefined();
  });

  it('does not resolve before the timeout for a still-pending promise', async () => {
    const stillPending = new Promise<string>(() => {
      /* pending */
    });

    let settled = false;
    withTimeout(stillPending, 8000).then(() => {
      settled = true;
    });

    jest.advanceTimersByTime(7999);
    await Promise.resolve(); // flush microtasks
    expect(settled).toBe(false);

    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(settled).toBe(true);
  });
});
