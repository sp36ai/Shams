// swisseph-wasm is mapped to __mocks__/swisseph-wasm.js via moduleNameMapper.
// src/firebase/functionsRegion.ts is mapped to __mocks__/functionsRegion.js
// via moduleNameMapper — see that file for the default httpsCallable() shape.

require('react-native-gesture-handler/jestSetup');

jest.mock('@react-native-firebase/functions', () => {
  return () => ({
    httpsCallable: jest.fn(() => () => Promise.resolve({ data: {} })),
  });
});

jest.mock('@react-native-firebase/crashlytics', () => {
  const instance = { recordError: jest.fn(), log: jest.fn() };
  const crashlytics = jest.fn(() => instance);
  return { __esModule: true, default: crashlytics };
});

jest.mock('@react-native-firebase/auth', () => {
  const authInstance = {
    currentUser: null,
    onAuthStateChanged: jest.fn(callback => {
      // Fire once with "no cached user", like a fresh install — bootstrap()
      // awaits exactly this first emission.
      callback(null);
      return jest.fn(); // unsubscribe
    }),
    signOut: jest.fn(() => Promise.resolve()),
    signInWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: {} })),
    createUserWithEmailAndPassword: jest.fn(() =>
      Promise.resolve({ user: { updateProfile: jest.fn(() => Promise.resolve()) } }),
    ),
    signInWithCredential: jest.fn(() => Promise.resolve({ user: {} })),
  };
  const auth = jest.fn(() => authInstance);
  auth.GoogleAuthProvider = { credential: jest.fn(() => ({})) };
  return { __esModule: true, default: auth };
});

jest.mock('@react-native-firebase/app-check', () => {
  const appCheckInstance = {
    setTokenAutoRefreshEnabled: jest.fn(),
    newReactNativeFirebaseAppCheckProvider: jest.fn(() => ({ configure: jest.fn() })),
    initializeAppCheck: jest.fn(() => Promise.resolve()),
    getToken: jest.fn(() => Promise.resolve({ token: 'mock-app-check-token' })),
  };
  return { firebase: { appCheck: jest.fn(() => appCheckInstance) } };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ data: { idToken: 'mock-id-token' } })),
  },
  isErrorWithCode: jest.fn(() => false),
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));

jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  getCurrentPosition: jest.fn(success => {
    success({ coords: { latitude: 31.634, longitude: 74.3587 } });
  }),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
}));

// react-native-safe-area-context is auto-mocked from
// __mocks__/react-native-safe-area-context.js (a node_modules package with a
// manual mock at <rootDir>/__mocks__/<name>.js is applied automatically, no
// jest.mock() call needed — see that file for why the package's own shipped
// mock doesn't work here).

// react-navigation hooks are mocked wholesale rather than standing up a real
// NavigationContainer/navigator tree for every screen test: useNavigation()
// return value is a jest.fn() so each test controls it directly (e.g.
// asserting navigate('Ask') was called), useFocusEffect() runs its effect
// immediately (as if the screen were always focused, matching how
// useTimingStrip/useHoraCountdown/useSkyExtras/StarfieldBackground all key
// their refresh loops off it), and useIsFocused() defaults to true.
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return {
    ...actual,
    useNavigation: jest.fn(() => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => false),
      replace: jest.fn(),
      push: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    })),
    // NOT a bare alias to React.useEffect — that has no deps array, so it
    // would re-run on every render, and a callback whose body calls a state
    // setter (useTimingStrip/useHoraCountdown/useSkyExtras all do) would
    // infinite-loop. Real call sites wrap their callback in useCallback(),
    // so keying off the callback's own referential identity reproduces
    // useFocusEffect's actual "re-run only when the focus-effect's own deps
    // change" contract.
    useFocusEffect: callback => React.useEffect(callback, [callback]),
    useIsFocused: jest.fn(() => true),
  };
});

jest.setTimeout(15000);
