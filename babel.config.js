module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        alias: {
          '@': './src',
          '@components': './src/components',
          '@screens': './src/screens',
          '@navigation': './src/navigation',
          '@stores': './src/stores',
          '@hooks': './src/hooks',
          '@theme': './src/theme',
          '@i18n': './src/i18n',
          '@astrology': './src/astrology',
          '@storage': './src/storage',
          '@utils': './src/utils',
          '@assets': './assets',
        },
      },
    ],
    // Reanimated plugin MUST be last
    'react-native-reanimated/plugin',
  ],
};
