import 'react-native-gesture-handler';

import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { clampGlobalFontScaling } from './src/utils/fontScaling';

// Lock the fixed-dp manuscript layout to its designed type sizes so a large
// system Font size setting cannot scale the UI past the screen. Runs once,
// before the app tree mounts.
clampGlobalFontScaling();

AppRegistry.registerComponent(appName, () => App);
