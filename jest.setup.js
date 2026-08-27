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

// @react-native-voice/voice and react-native-tts are native modules with no
// bridge in the Jest environment (no NativeEventEmitter backing, no device).
// Mocked as plain objects whose event "handlers" are settable properties
// (Voice) or an addEventListener returning a removable subscription (Tts),
// matching each library's real shape closely enough for useSpeechToText/
// useTextToSpeech's own tests to drive them directly.
jest.mock('@react-native-voice/voice', () => ({
  __esModule: true,
  default: {
    start: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
    cancel: jest.fn(() => Promise.resolve()),
    destroy: jest.fn(() => Promise.resolve()),
    removeAllListeners: jest.fn(),
    isAvailable: jest.fn(() => Promise.resolve(1)),
    onSpeechStart: undefined,
    onSpeechEnd: undefined,
    onSpeechError: undefined,
    onSpeechResults: undefined,
    onSpeechPartialResults: undefined,
  },
}));

// The `removeEventListener` throw below is not pedantry — it is what the real
// module does under RN 0.78. react-native-tts still ships the method, but it
// delegates to NativeEventEmitter#removeListener, deleted in RN 0.72. The
// previous mock stubbed it as a harmless jest.fn(), so the hook's unmount
// cleanup passed every test while throwing on device: leaving Oracle Chat
// rendered the ErrorBoundary instead of returning to Home. Mirror the real
// failure here so re-introducing the call fails the suite, not the seeker.
jest.mock('react-native-tts', () => ({
  __esModule: true,
  default: {
    getInitStatus: jest.fn(() => Promise.resolve('success')),
    setDefaultLanguage: jest.fn(() => Promise.resolve('success')),
    speak: jest.fn(),
    stop: jest.fn(() => Promise.resolve(true)),
    pause: jest.fn(() => Promise.resolve(true)),
    resume: jest.fn(() => Promise.resolve(true)),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    removeEventListener: jest.fn(() => {
      throw new TypeError('this.removeListener is not a function');
    }),
  },
}));

jest.setTimeout(15000);
