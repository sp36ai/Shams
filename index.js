/**
 * Shams al-Asrār — App entry point
 *
 * Order matters here:
 * 1. URL polyfill must load BEFORE Supabase imports anywhere.
 * 2. Random values polyfill must load before any UUID generation.
 * 3. Gesture handler must load before any react-navigation screen.
 */
import 'react-native-gesture-handler';

import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
