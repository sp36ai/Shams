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
import auth from '@react-native-firebase/auth';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';

import { storage, KEYS } from '@storage/mmkv';
import { useQuotaStore, type PlanTier } from './quotaStore';
import { useReadingsStore } from './readingsStore';
import { useSettingsStore } from './settingsStore';
import { invalidateQuotaCache } from '@hooks/useQuota';

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

/**
 * Resolves with `promise`'s value, or `undefined` after `ms` — whichever comes
 * first. Some real devices' network stacks let getIdTokenResult() hang
 * indefinitely (no resolve, no reject) rather than time out on their own,
 * which would otherwise leave the app on the Splash screen forever, since
 * nothing downstream ever flips `isLoading` back to false.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
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
          const previousUid = storage.getString(KEYS.AUTH_USER_ID);
          if (previousUid !== undefined && previousUid !== fbUser.uid) {
            useSettingsStore.getState().resetForNewAccount();
          }
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
    set({ isLoading: true, error: null });
    try {
      await auth().signInWithEmailAndPassword(email, password);
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      set({ isLoading: false, error: msg });
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
      set({ isLoading: false, error: msg });
      return err instanceof Error ? err : new Error(msg);
    }
  },

  signInWithGoogle: async (): Promise<Error | null> => {
    set({ isLoading: true, error: null });
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult.data?.idToken ?? (signInResult as { idToken?: string }).idToken;
      if (!idToken) {
        throw new Error('Google sign-in returned no ID token');
      }
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(googleCredential);
      return null;
    } catch (err) {
      // User dismissing the account picker is not a failure — don't surface
      // it as an auth error banner.
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
        set({ isLoading: false });
        return null;
      }
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
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
    await auth().signOut();
    cacheUserLocally(null);
    useQuotaStore.getState().reset();
    useReadingsStore.getState().clearAll();
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
