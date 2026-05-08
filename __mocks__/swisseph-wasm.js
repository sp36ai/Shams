// Deterministic stub for swisseph-wasm in Jest.
// The real WASM binary is backend-only (Cloud Functions).
// No production mobile code imports this directly.

const stub = {
  swe_calc_ut: jest.fn(() => ({ longitude: 0, latitude: 0, distance: 0 })),
  swe_get_ayanamsa_ut: jest.fn(() => 24),
  swe_set_ephe_path: jest.fn(),
  swe_close: jest.fn(),
};

module.exports = jest.fn().mockImplementation(() => stub);
