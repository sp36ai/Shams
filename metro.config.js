const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration — Shams al-Asrār
 * --------------------------------------------------------------------------
 * Security hardening (release builds only):
 *   - Terser with identifier mangling: variable/function names replaced with
 *     single-letter tokens before Hermes compiles to bytecode.
 *   - console.* stripped: no diagnostic strings in the release bundle.
 *   - Source maps NOT generated for release (no --sourcemap-output flag
 *     in the release Gradle task).
 *
 * @type {import('metro-config').MetroConfig}
 */

const IS_RELEASE = process.env.NODE_ENV === 'production';

const config = {
  resolver: {
    sourceExts: ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs', 'mjs'],
    assetExts: [
      'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
      'ttf', 'otf', 'woff', 'woff2',
      'mp3', 'wav',
      'se1', 'wasm',
    ],
  },

  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),

    ...(IS_RELEASE && {
      minifierPath: 'metro-minify-terser',
      minifierConfig: {
        mangle: {
          toplevel: true,
          keep_classnames: false,
          keep_fnames: false,
        },
        compress: {
          drop_console: true,
          dead_code: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
          evaluate: true,
          passes: 3,
        },
        output: {
          comments: false,
          ascii_only: true,
        },
        sourceMap: false,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
