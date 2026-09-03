// Manual mock for react-native-safe-area-context.
//
// The package's own shipped jest/mock.tsx (react-native-safe-area-context/jest/mock)
// spreads the REAL module's named exports for everything except
// useSafeAreaInsets/useSafeAreaFrame/SafeAreaProvider — which leaves
// SafeAreaView as the real, native-codegen-backed component. That component
// resolves to `undefined` under Jest (no native/Fabric codegen artifacts
// present in this environment), which crashes every screen render with
// "Element type is invalid" the moment it hits <SafeAreaView>. Every screen
// in this app renders one at its root, so this isn't an edge case — it's
// the very first element. Provide plain-JS stand-ins instead.
const React = require('react');
const { View } = require('react-native');

const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
const MOCK_FRAME = { x: 0, y: 0, width: 320, height: 640 };

function SafeAreaProvider({ children }) {
  return React.createElement(View, { style: { flex: 1 } }, children);
}

const SafeAreaView = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }));

module.exports = {
  SafeAreaProvider,
  SafeAreaView,
  SafeAreaInsetsContext: React.createContext(ZERO_INSETS),
  SafeAreaFrameContext: React.createContext(MOCK_FRAME),
  useSafeAreaInsets: () => ZERO_INSETS,
  useSafeAreaFrame: () => MOCK_FRAME,
  initialWindowMetrics: { frame: MOCK_FRAME, insets: ZERO_INSETS },
};
