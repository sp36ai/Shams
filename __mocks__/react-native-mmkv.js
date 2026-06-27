// In-memory mock for react-native-mmkv (native module — can't run in Jest).
let _store = {};

beforeEach(() => {
  _store = {};
});

class MMKV {
  getString(key) {
    const v = _store[key];
    return typeof v === 'string' ? v : undefined;
  }
  getNumber(key) {
    const v = _store[key];
    return typeof v === 'number' ? v : undefined;
  }
  getBoolean(key) {
    const v = _store[key];
    return typeof v === 'boolean' ? v : undefined;
  }
  set(key, value) {
    _store[key] = value;
  }
  delete(key) {
    delete _store[key];
  }
  clearAll() {
    Object.keys(_store).forEach(k => delete _store[k]);
  }
}

module.exports = { MMKV };
