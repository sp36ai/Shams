/**
 * functionsClient — the ONE way to obtain a Cloud Functions instance.
 * --------------------------------------------------------------------------
 * All callables are deployed in asia-south1 (Mumbai). RNFB v19 selects the
 * region via `firebase.app().functions(region)` — the module instance has NO
 * `.region()` method. The previous pattern
 *
 *     (functions() as FunctionsWithRegion).region('asia-south1')
 *
 * type-cast a method into existence and threw
 * `TypeError: functions().region is not a function` at runtime on every
 * server call (quota, oracle, trial, purchases, classifiers). Because
 * useQuota invoked it inside a useEffect on OracleScreen mount, entering the
 * Oracle crashed straight into the ErrorBoundary ("The veil trembled").
 *
 * Always use this helper. Never cast a region method onto the module.
 */

import { firebase, type FirebaseFunctionsTypes } from '@react-native-firebase/functions';

export const FUNCTIONS_REGION = 'asia-south1';

export function regionalFunctions(): FirebaseFunctionsTypes.Module {
  return firebase.app().functions(FUNCTIONS_REGION);
}
