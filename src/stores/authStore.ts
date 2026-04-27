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
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import auth from '@react-native-firebase/auth';

import { storage, KEYS } from '@storage/mmkv';
import { useQuotaStore, type PlanTier } from './quotaStore';

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
  signOut: () => Promise<void>;
  clearError: () => void;
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
    set({ isLoading: true });
    // Await the first emission of onAuthStateChanged so the navigator
    // never flashes the Auth screen before the cached user resolves.
    await new Promise<void>(resolve => {
      let resolved = false;
      auth().onAuthStateChanged(async fbUser => {
        if (fbUser) {
          try {
            const tokenResult = await fbUser.getIdTokenResult();
            const plan = (tokenResult.claims.plan as PlanTier | undefined) ?? 'free';
            useQuotaStore.getState().setPlan(plan);
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

  signIn: async (email: string, password: string): Promise<Error | null> => {
    set({ isLoading: true, error: null });
    try {
      const cred = await auth().signInWithEmailAndPassword(email, password);
      const tokenResult = await cred.user.getIdTokenResult();
      const plan = (tokenResult.claims.plan as PlanTier | undefined) ?? 'free';
      useQuotaStore.getState().setPlan(plan);
      cacheUserLocally(cred.user);
      set({ user: cred.user, isLoading: false });
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
        await cred.user.updateProfile({ displayName: name });
      }
      useQuotaStore.getState().setPlan('free');
      cacheUserLocally(cred.user);
      set({ user: cred.user, isLoading: false });
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign up failed';
      set({ isLoading: false, error: msg });
      return err instanceof Error ? err : new Error(msg);
    }
  },

  signOut: async (): Promise<void> => {
    set({ isLoading: true });
    await auth().signOut();
    cacheUserLocally(null);
    useQuotaStore.getState().reset();
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
