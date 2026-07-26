/**
 * functionsRegion — the ONE correct way to get a region-bound Cloud Functions
 * instance in this app.
 *
 * All of our callables are deployed to asia-south1. React Native Firebase v19
 * has **no** `.region()` method on the functions module — the only runtime API
 * for targeting a non-default region is `firebase.app().functions(region)`
 * (see the RNFB type docs: `defaultApp.functions('europe-west1')`). The default
 * region is us-central1.
 *
 * The previous `(functions() as FunctionsWithRegion).region('asia-south1')`
 * pattern called a method that does not exist, so every call threw
 * `TypeError: undefined is not a function`. Because useQuota invokes a callable
 * inside a mount effect, that crash took down OracleScreen the instant it
 * mounted — the "veil trembled" fallback. Centralising the correct call here
 * means there is a single, correct, testable place and no room for the broken
 * pattern to reappear.
 */

import { firebase } from '@react-native-firebase/functions';
import type { FirebaseFunctionsTypes } from '@react-native-firebase/functions';

/** Region every Shams al-Asrar Cloud Function is deployed to. */
export const FUNCTIONS_REGION = 'asia-south1';

/** Cloud Functions instance bound to the app's deployed region. */
export function regionalFunctions(): FirebaseFunctionsTypes.Module {
  return firebase.app().functions(FUNCTIONS_REGION);
}
