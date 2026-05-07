jest.mock('swisseph-wasm', () => {
  return jest.fn().mockImplementation(() => {
    return {
      swe_calc_ut: jest.fn(() => ({ longitude: 0, latitude: 0, distance: 0 })),
      swe_get_ayanamsa_ut: jest.fn(() => 24),
    };
  });
});

jest.mock('@react-native-firebase/functions', () => {
  return () => ({
    httpsCallable: jest.fn(() => () => Promise.resolve({ data: {} }))
  });
});

jest.setTimeout(15000);
