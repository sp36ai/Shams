/**
 * account.ts — client wrapper for the deleteAccount Cloud Function.
 *
 * Deletes the caller's account and personal data server-side (readings, quota,
 * trial, and the Firebase Auth user). The caller is responsible for clearing
 * local state and signing out afterwards — see authStore.deleteAccount.
 */

import functions, { type FirebaseFunctionsTypes } from '@react-native-firebase/functions';

type FunctionsWithRegion = FirebaseFunctionsTypes.Module & {
  region(r: string): FirebaseFunctionsTypes.Module;
};

export async function deleteAccountOnServer(): Promise<void> {
  const fn = (functions() as FunctionsWithRegion)
    .region('asia-south1')
    .httpsCallable('deleteAccount');
  await fn({});
}
