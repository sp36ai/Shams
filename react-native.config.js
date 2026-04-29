                                                                                     /**
 * React Native CLI configuration.
 *
 * - Tells the CLI where to find native projects (we don't ship iOS folder).
 * - Registers `assets/fonts/` as the asset source so `react-native-asset`
 *   (or RN 0.74's built-in `link-assets`) can copy fonts into the Android APK.
 */
module.exports = {
  project: {
    android: {
      sourceDir: './android',
    },
  },
  assets: ['./assets/fonts/'],
};
