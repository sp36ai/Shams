// Manual mock for src/firebase/functionsRegion.ts, wired in via jest's
// moduleNameMapper (package.json → jest.moduleNameMapper) so every import of
// it — regardless of the relative path a given file uses to reach it —
// resolves here instead of touching the real @react-native-firebase/functions
// native module.
//
// `httpsCallable` is exported directly (not just buried inside
// `regionalFunctions()`'s return value) so tests can reach in and override
// per-callable behavior, e.g.:
//
//   import { httpsCallable } from '../../firebase/functionsRegion';
//   (httpsCallable).mockImplementationOnce(() => () => Promise.reject(...));
//
// Defaults are chosen so a screen mounts in its ordinary, unblocked state
// without every test having to opt in: getQuota reports a healthy remaining
// count (an empty `{}` would otherwise read as `remaining: undefined`, which
// useQuota's `serverRemaining > 0` check treats as exhausted and disables
// every Send/Ask button by default); every other callable degrades to `{}`,
// which each caller in this codebase already treats as "no answer" and
// falls back from (classifyQuestion → VALID_HORARY, classifyIntent →
// UNKNOWN, etc.) — that fallback behavior is real production code, not part
// of this mock.
function defaultImpl(name) {
  if (name === 'getQuota') {
    return jest.fn(() => Promise.resolve({ data: { remaining: 3 } }));
  }
  return jest.fn(() => Promise.resolve({ data: {} }));
}

const httpsCallable = jest.fn(defaultImpl);

// Mirrors __mocks__/react-native-mmkv.js's own beforeEach reset — a test
// that overrides httpsCallable with mockImplementation (not ...Once) must
// not leak that override into the next test file's default-state renders.
beforeEach(() => {
  httpsCallable.mockReset();
  httpsCallable.mockImplementation(defaultImpl);
});

const regionalFunctions = jest.fn(() => ({ httpsCallable }));

module.exports = {
  regionalFunctions,
  httpsCallable,
  FUNCTIONS_REGION: 'asia-south1',
};
