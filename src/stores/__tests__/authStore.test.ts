/**
 * authStore — sign-in no longer depends solely on onAuthStateChanged.
 * --------------------------------------------------------------------------
 * signIn/signUp/signInWithGoogle used to perform only the Firebase call and
 * leave setting `user` to the onAuthStateChanged listener. On the CI
 * emulator that listener never fires, so a valid sign-in stayed on the Auth
 * screen with no error. Each sign-in path now applies the user itself via
 * the same sync the listener uses, sharing one in-flight sync per uid.
 */

import auth from '@react-native-firebase/auth';

import { useAuthStore } from '../authStore';
import { useQuotaStore } from '../quotaStore';
import { useReadingThreadsStore } from '../readingThreadsStore';
import { useReadingsStore } from '../readingsStore';
import { storage, KEYS } from '@storage/mmkv';

type Listener = (user: unknown) => void | Promise<void>;

const authInstance = (auth as unknown as jest.Mock)() as {
  currentUser: unknown;
  onAuthStateChanged: jest.Mock;
  signInWithEmailAndPassword: jest.Mock;
  createUserWithEmailAndPassword: jest.Mock;
  signInWithCredential: jest.Mock;
  signOut: jest.Mock;
};

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function makeUser(uid: string, plan?: string, tokenPromise?: Promise<unknown>) {
  return {
    uid,
    displayName: `Name ${uid}`,
    email: `${uid}@example.com`,
    getIdTokenResult: jest.fn(
      () => tokenPromise ?? Promise.resolve({ claims: plan ? { plan } : {} }),
    ),
    updateProfile: jest.fn(() => Promise.resolve()),
  };
}

let listener: Listener | null = null;

/** Runs bootstrap() with a listener that emits "signed out" once on subscribe. */
async function bootstrapSignedOut(): Promise<void> {
  authInstance.onAuthStateChanged.mockImplementationOnce((cb: Listener) => {
    listener = cb;
    void cb(null);
    return jest.fn();
  });
  await useAuthStore.getState().bootstrap();
}

beforeEach(() => {
  listener = null;
  authInstance.currentUser = null;
  // Default: the listener is captured but never fires, as on the CI emulator.
  authInstance.onAuthStateChanged.mockImplementation((cb: Listener) => {
    listener = cb;
    return jest.fn();
  });
  useAuthStore.setState({ user: null, isLoading: false, error: null, lockoutUntil: null });
  useQuotaStore.getState().reset();
});

afterAll(() => {
  authInstance.onAuthStateChanged.mockImplementation((cb: Listener) => {
    cb(null);
    return jest.fn();
  });
});

describe('bootstrap', () => {
  it('keeps the cached user restored by the first emission', async () => {
    const user = makeUser('u0', 'khass');
    authInstance.currentUser = user;
    authInstance.onAuthStateChanged.mockImplementationOnce((cb: Listener) => {
      void cb(user);
      return jest.fn();
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await useAuthStore.getState().bootstrap();

    expect(useAuthStore.getState().user).toBe(user);
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('signIn applies the user without the listener', () => {
  it('sets user, plan and local cache when onAuthStateChanged never fires', async () => {
    const user = makeUser('u1', 'khass');
    authInstance.signInWithEmailAndPassword.mockResolvedValueOnce({ user });

    const error = await useAuthStore.getState().signIn('a@b.co', 'password1');

    expect(error).toBeNull();
    expect(useAuthStore.getState().user).toBe(user);
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useQuotaStore.getState().plan).toBe('khass');
    expect(storage.getString(KEYS.AUTH_USER_ID)).toBe('u1');
    expect(storage.getString(KEYS.AUTH_LAST_UID)).toBe('u1');
  });

  it('leaves user null when Firebase rejects the credentials', async () => {
    authInstance.signInWithEmailAndPassword.mockRejectedValueOnce(
      new Error('[auth/invalid-credential] bad'),
    );

    const error = await useAuthStore.getState().signIn('a@b.co', 'password1');

    expect(error).toBeInstanceOf(Error);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('signUp and signInWithGoogle also apply the user', async () => {
    const signedUp = makeUser('u2');
    authInstance.createUserWithEmailAndPassword.mockResolvedValueOnce({ user: signedUp });
    await useAuthStore.getState().signUp('a@b.co', 'password1', 'Name');
    expect(useAuthStore.getState().user).toBe(signedUp);

    const google = makeUser('u3');
    authInstance.signInWithCredential.mockResolvedValueOnce({ user: google });
    await useAuthStore.getState().signInWithGoogle();
    expect(useAuthStore.getState().user).toBe(google);
  });
});

describe('listener and sign-in share one sync', () => {
  it('fetches the ID token once when both apply the same uid concurrently', async () => {
    await bootstrapSignedOut();
    const token = deferred<unknown>();
    const user = makeUser('u4', undefined, token.promise);
    authInstance.signInWithEmailAndPassword.mockImplementationOnce(async () => {
      // Listener fires mid sign-in, as it does on a real device.
      void listener?.(user);
      return { user };
    });

    const pending = useAuthStore.getState().signIn('a@b.co', 'password1');
    await Promise.resolve();
    token.resolve({ claims: { plan: 'mureed' } });
    await pending;

    expect(user.getIdTokenResult).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toBe(user);
    expect(useQuotaStore.getState().plan).toBe('mureed');
  });

  it('discards an in-flight sync that finishes after sign-out', async () => {
    const token = deferred<unknown>();
    const user = makeUser('u5', undefined, token.promise);
    authInstance.signInWithEmailAndPassword.mockResolvedValueOnce({ user });

    const pending = useAuthStore.getState().signIn('a@b.co', 'password1');
    await Promise.resolve();
    await useAuthStore.getState().signOut();
    token.resolve({ claims: { plan: 'khass' } });
    await pending;

    expect(useAuthStore.getState().user).toBeNull();
    expect(useQuotaStore.getState().plan).toBe('free');
  });

  it('ignores a late signed-out emission while Firebase still has a current user', async () => {
    await bootstrapSignedOut();
    const user = makeUser('u6');
    authInstance.signInWithEmailAndPassword.mockResolvedValueOnce({ user });
    await useAuthStore.getState().signIn('a@b.co', 'password1');
    authInstance.currentUser = user;

    await listener?.(null);

    expect(useAuthStore.getState().user).toBe(user);
  });

  it('still applies a real sign-out emission', async () => {
    await bootstrapSignedOut();
    const user = makeUser('u7');
    authInstance.signInWithEmailAndPassword.mockResolvedValueOnce({ user });
    await useAuthStore.getState().signIn('a@b.co', 'password1');
    authInstance.currentUser = null;

    await listener?.(null);

    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe("another account's Readings", () => {
  function seedReadings(): void {
    useReadingThreadsStore.getState().createThread({
      id: 't_prev',
      requestId: 'req_prev',
      question: 'Will the sale complete?',
      questionLang: 'en',
    });
    useReadingsStore.setState({
      readings: [{ id: 'r_prev' }] as unknown as ReturnType<
        typeof useReadingsStore.getState
      >['readings'],
    });
  }

  it('are cleared from the device when a different account signs in', async () => {
    storage.set(KEYS.AUTH_LAST_UID, 'previous-user');
    seedReadings();
    authInstance.signInWithEmailAndPassword.mockResolvedValueOnce({ user: makeUser('new-user') });

    await useAuthStore.getState().signIn('a@b.co', 'password1');

    expect(useReadingThreadsStore.getState().threads).toEqual([]);
    expect(useReadingsStore.getState().readings).toEqual([]);
  });

  it('are kept when the same account signs back in', async () => {
    storage.set(KEYS.AUTH_LAST_UID, 'same-user');
    seedReadings();
    authInstance.signInWithEmailAndPassword.mockResolvedValueOnce({ user: makeUser('same-user') });

    await useAuthStore.getState().signIn('a@b.co', 'password1');

    expect(useReadingThreadsStore.getState().threads).toHaveLength(1);
    expect(useReadingsStore.getState().readings).toHaveLength(1);
  });
});
