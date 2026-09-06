/**
 * authStore — authentication state and session lifecycle.
 * --------------------------------------------------------------------------
 * Backed by Firebase Auth. The persistent onAuthStateChanged listener
 * runs once in bootstrap() and keeps state in sync for the app lifetime.
 *
 * Plan tier is stored in Firebase Auth custom claims ({ plan, planExpiry })
 * and synced here via getIdTokenResult() on sign-in. It drives
 * quotaStore.setPlan() so quota limits are always consistent with the
 * active subscription.
 *
 * Offline resilience: Firebase Auth persists the user session natively on
 * Android (via SharedPreferences). The onAuthStateChanged callback fires
 * synchronously with the cached user on cold start — no MMKV needed for
 * session storage.
 */

import { create } from 'zustand';
import crashlytics from '@react-native-firebase/crashlytics';
import auth from '@react-native-firebase/auth';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

import { storage, KEYS } from '@storage/mmkv';
import { useQuotaStore, type PlanTier } from './quotaStore';
import { useReadingsStore } from './readingsStore';
import { useSettingsStore } from './settingsStore';
import { invalidateQuotaCache } from '@hooks/useQuota';
import { withTimeout } from '@utils/withTimeout';

// Web client ID from Firebase Console → Authentication → Google → Web SDK configuration
export const GOOGLE_WEB_CLIENT_ID =
  '347578830449-1uogokloffhn2c9nh060003rsvm1vu6n.apps.googleusercontent.com';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface AuthState {
  /** Firebase user — null when signed out. */
  user: FirebaseAuthTypes.User | null;
  /** True during any auth network operation. */
  isLoading: boolean;
  /** Last auth error message, or null. */
  error: string | null;
  /**
   * Epoch ms until which sign-in is locally locked out after too many failed
   * attempts, or null. Client-side defense-in-depth on top of Firebase's own
   * server-side throttling — gives the UI a concrete countdown to show.
   */
  lockoutUntil: number | null;

  /** Call once at app startup to install the auth state listener. */
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<Error | null>;
  signUp: (email: string, password: string, name: string) => Promise<Error | null>;
  signInWithGoogle: () => Promise<Error | null>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

let _authUnsubscribe: (() => void) | null = null;

const AUTH_TOKEN_TIMEOUT_MS = 8000;
// GoogleSignin.hasPlayServices()/signIn() drive native UI (an account picker,
// a Play Services update dialog) that legitimately waits on a human, so this
// is generous on purpose — it exists only to guarantee isLoading (and every
// button gated on it, across AuthScreen and Settings' sign-out) eventually
// unlocks if the native call itself hangs (never resolves/rejects) rather
// than the user simply taking their time to pick an account.
const GOOGLE_SIGNIN_TIMEOUT_MS = 120_000;

/** After this many consecutive failed sign-ins, lock the button locally. */
const MAX_SIGNIN_ATTEMPTS = 5;
/** How long the local lockout lasts once triggered. */
const SIGNIN_LOCKOUT_MS = 30_000;

function readLockoutUntil(): number | null {
  const v = storage.getNumber(KEYS.AUTH_LOCKOUT_UNTIL);
  return v !== undefined && v > Date.now() ? v : null;
}

/* -------------------------------------------------------------------------- */
/*  Local profile cache (name / email written at sign-in for offline display) */
/* -------------------------------------------------------------------------- */

function cacheUserLocally(user: FirebaseAuthTypes.User | null): void {
  if (user === null) {
    storage.delete(KEYS.AUTH_USER_ID);
    storage.delete(KEYS.AUTH_USER_NAME);
    storage.delete(KEYS.AUTH_USER_EMAIL);
    return;
  }
  storage.set(KEYS.AUTH_USER_ID, user.uid);
  const name = user.displayName ?? '';
  const email = user.email ?? '';
  if (name) {
    storage.set(KEYS.AUTH_USER_NAME, name);
  }
  if (email) {
    storage.set(KEYS.AUTH_USER_EMAIL, email);
  }
}

/* -------------------------------------------------------------------------- */
/*  Store factory                                                             */
/* -------------------------------------------------------------------------- */

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  isLoading: false,
  error: null,
  lockoutUntil: readLockoutUntil(),

  bootstrap: async (): Promise<void> => {
    _authUnsubscribe?.();
    _authUnsubscribe = null;
    set({ isLoading: true });
    // Await the first emission of onAuthStateChanged so the navigator
    // never flashes the Auth screen before the cached user resolves.
    await new Promise<void>(resolve => {
      let resolved = false;
      _authUnsubscribe = auth().onAuthStateChanged(async fbUser => {
        if (fbUser) {
          // A different uid than last session means a different account signed
          // in on this device — per-account onboarding/location flags must not
          // leak from whoever used the device before.
          //
          // We compare against AUTH_LAST_UID (not AUTH_USER_ID): the latter is
          // the display cache and is cleared on sign-out, which would make this
          // check see `undefined` after every explicit sign-out and therefore
          // never fire. AUTH_LAST_UID deliberately survives sign-out so the
          // "different account signed in" reset actually triggers.
          const previousUid = storage.getString(KEYS.AUTH_LAST_UID);
          if (previousUid !== undefined && previousUid !== fbUser.uid) {
            useSettingsStore.getState().resetForNewAccount();
          }
          storage.set(KEYS.AUTH_LAST_UID, fbUser.uid);
          try {
            const tokenResult = await withTimeout(fbUser.getIdTokenResult(), AUTH_TOKEN_TIMEOUT_MS);
            const plan = (tokenResult?.claims.plan as PlanTier | undefined) ?? 'free';
            const expiry = tokenResult?.claims.planExpiry as string | undefined;
            useQuotaStore.getState().setPlan(plan, expiry);
          } catch {
            useQuotaStore.getState().setPlan('free');
          }
          cacheUserLocally(fbUser);
        } else {
          cacheUserLocally(null);
          useQuotaStore.getState().setPlan('free');
        }
        set({ user: fbUser, isLoading: false });
        if (!resolved) {
          resolved = true;
          resolve();
        }
      });
    });
  },

  // signIn/signUp/signInWithGoogle only perform the Firebase call and surface
  // errors. They deliberately do NOT set `user`/plan/cache themselves —
  // onAuthStateChanged above fires for every one of these and is the single
  // place that syncs user, custom-claim plan, and local cache. Duplicating
  // that here raced two independent getIdTokenResult() calls against each
  // other and could leave isLoading/user set from whichever finished last.
  signIn: async (email: string, password: string): Promise<Error | null> => {
    // Refuse immediately while locally locked out — don't even hit the network.
    const activeLockout = readLockoutUntil();
    if (activeLockout !== null) {
      set({ lockoutUntil: activeLockout, isLoading: false });
      return new Error('auth/too-many-requests (locked)');
    }

    set({ isLoading: true, error: null });
    try {
      await auth().signInWithEmailAndPassword(email, password);
      // Success clears the failure counter and any lockout.
      storage.delete(KEYS.AUTH_FAILED_ATTEMPTS);
      storage.delete(KEYS.AUTH_LOCKOUT_UNTIL);
      set({ lockoutUntil: null });
      return null;
    } catch (err) {
      const attempts = (storage.getNumber(KEYS.AUTH_FAILED_ATTEMPTS) ?? 0) + 1;
      let nextLockout: number | null = null;
      if (attempts >= MAX_SIGNIN_ATTEMPTS) {
        nextLockout = Date.now() + SIGNIN_LOCKOUT_MS;
        storage.set(KEYS.AUTH_LOCKOUT_UNTIL, nextLockout);
        storage.set(KEYS.AUTH_FAILED_ATTEMPTS, 0); // reset — the lockout is the penalty now
      } else {
        storage.set(KEYS.AUTH_FAILED_ATTEMPTS, attempts);
      }
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      // AuthScreen's normaliseAuthError() deliberately discards this raw
      // message in production ([auth/<code>] ...) once none of its known
      // substrings match, showing only a generic "unexpected error" — which
      // means an unrecognized/new Firebase Auth error code would otherwise
      // vanish with no record anywhere. Crashlytics is the only place it
      // survives to be diagnosed from.
      crashlytics().recordError(err instanceof Error ? err : new Error(msg));
      set({ isLoading: false, error: msg, lockoutUntil: nextLockout });
      return err instanceof Error ? err : new Error(msg);
    }
  },

  signUp: async (email: string, password: string, name: string): Promise<Error | null> => {
    set({ isLoading: true, error: null });
    try {
      const cred = await auth().createUserWithEmailAndPassword(email, password);
      if (name) {
        // The account already exists at this point — a displayName write
        // failing (e.g. a network blip right after signup) must not be
        // reported as "signup failed", since the user is in fact signed in.
        try {
          await cred.user.updateProfile({ displayName: name });
        } catch {
          /* non-fatal — displayName can be set later from Settings */
        }
      }
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign up failed';
      crashlytics().recordError(err instanceof Error ? err : new Error(msg));
      set({ isLoading: false, error: msg });
      return err instanceof Error ? err : new Error(msg);
    }
  },

  signInWithGoogle: async (): Promise<Error | null> => {
    set({ isLoading: true, error: null });
    try {
      // Bounded (see GOOGLE_SIGNIN_TIMEOUT_MS) so a native call that hangs
      // instead of settling can't leave isLoading — and therefore every
      // sign-in/sign-out button in the app — stuck disabled forever.
      await withTimeout(
        GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }),
        GOOGLE_SIGNIN_TIMEOUT_MS,
      );
      const signInResult = await withTimeout(GoogleSignin.signIn(), GOOGLE_SIGNIN_TIMEOUT_MS);
      if (signInResult === undefined) {
        throw new Error('Google sign-in timed out');
      }
      const idToken = signInResult.data?.idToken ?? (signInResult as { idToken?: string }).idToken;
      if (!idToken) {
        throw new Error('Google sign-in returned no ID token');
      }
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      // On real success, onAuthStateChanged (registered once in bootstrap())
      // is what actually flips isLoading back to false, decoupled from this
      // call stack — so if signInWithCredential() itself hangs at the native
      // level, that listener never fires for this attempt either, and no
      // amount of wrapping this specific await fixes that. What this timeout
      // DOES guarantee: this function itself always returns, so the caller
      // isn't left awaiting forever — and treating a timeout as a failure
      // (rather than silently assuming success) puts isLoading back in the
      // catch block's hands below instead of leaving it stuck on the hope
      // that onAuthStateChanged eventually shows up.
      const signInOutcome = await withTimeout(
        auth().signInWithCredential(googleCredential),
        AUTH_TOKEN_TIMEOUT_MS,
      );
      if (signInOutcome === undefined) {
        throw new Error('Google credential sign-in timed out');
      }
      return null;
    } catch (err) {
      // User dismissing the account picker is not a failure — don't surface
      // it as an auth error banner.
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
        set({ isLoading: false });
        return null;
      }
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      crashlytics().recordError(err instanceof Error ? err : new Error(msg));
      set({ isLoading: false, error: msg });
      return err instanceof Error ? err : new Error(msg);
    }
  },

  signOut: async (): Promise<void> => {
    // Deliberately does NOT unsubscribe the onAuthStateChanged listener —
    // bootstrap() only ever runs once per app launch, so tearing it down here
    // left it permanently dead for the rest of the session: any sign-in or
    // signup attempted after a sign-out (without restarting the app) would
    // update Firebase Auth successfully but nothing would ever flip `user`/
    // `isLoading` back, leaving the app stuck on Splash/loading forever.
    set({ isLoading: true });
    invalidateQuotaCache();
    // auth().signOut() is a native round-trip with no SDK-level timeout
    // guarantee — same failure class as the App Check/ID-token probes this
    // file already guards. Bound it, and clear local state unconditionally
    // afterward (previously this call had no try/finally at all: any
    // rejection, not just a hang, skipped every line below it, leaving
    // `isLoading` stuck true and the Sign Out / Sign In buttons across the
    // app dead for the rest of the session). Treating the querent as signed
    // out locally even if the native call stalls or fails is the safer
    // failure mode — a live but unreachable server session is far less
    // costly than a permanently frozen auth UI.
    await withTimeout(auth().signOut(), AUTH_TOKEN_TIMEOUT_MS);
    cacheUserLocally(null);
    useQuotaStore.getState().reset();
    useReadingsStore.getState().clearAll();
    // NOTE: per-account onboarding flags + seeker identity/profile are NOT wiped
    // here. They are cleared lazily by bootstrap() only when a *different* uid
    // signs in (see AUTH_LAST_UID sentinel below), so the SAME user signing back
    // in keeps their onboarding, while a different user on a shared device gets a
    // clean slate. The sentinel survives sign-out, which is what makes that work.
    set({ user: null, isLoading: false, error: null });
  },

  clearError: (): void => set({ error: null }),
}));

/* -------------------------------------------------------------------------- */
/*  Selectors                                                                 */
/* -------------------------------------------------------------------------- */

export const selectIsAuthenticated = (s: AuthState): boolean => s.user !== null;
export const selectUserName = (s: AuthState): string =>
  s.user?.displayName ?? storage.getString(KEYS.AUTH_USER_NAME) ?? 'Guest';
export const selectUserEmail = (s: AuthState): string =>
  s.user?.email ?? storage.getString(KEYS.AUTH_USER_EMAIL) ?? '';
