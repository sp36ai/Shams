// swisseph-wasm is mapped to __mocks__/swisseph-wasm.js via moduleNameMapper.

jest.mock('@react-native-firebase/functions', () => {
  return () => ({
    httpsCallable: jest.fn(() => () => Promise.resolve({ data: {} }))
  });
});

jest.setTimeout(15000);
