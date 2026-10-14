import 'react-native-gesture-handler';

import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { clampGlobalFontScaling } from './src/utils/fontScaling';
import { applyLayoutDirection, readPersistedLang } from './src/i18n/I18nProvider';

// Pin the layout direction to the saved app language (left-to-right for
// English and Hindi, right-to-left for Urdu) before anything renders, so the
// device's own locale cannot mirror the app. Takes effect from the next
// native launch if it changed. Never allowed to block start-up.
try {
  applyLayoutDirection(readPersistedLang());
} catch {
  // Keep whatever direction the platform chose.
}

// Lock the fixed-dp manuscript layout to its designed type sizes so a large
// system Font size setting cannot scale the UI past the screen. Runs once,
// before the app tree mounts.
clampGlobalFontScaling();

AppRegistry.registerComponent(appName, () => App);
