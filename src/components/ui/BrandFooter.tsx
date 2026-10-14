/**
 * BrandFooter — the "Powered by Astro Sarfaraz" line at the bottom of every
 * screen, in the active theme's faint ink. Home draws its own (on its
 * midnight panel, beside the Genie); every other screen uses this one.
 */

import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';

const BrandFooter: React.FC = () => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  return (
    <Text
      testID="brand-footer"
      style={[typography('caption'), styles.footer, { color: colors.textFaint }]}
    >
      {t('app.poweredBy')}
    </Text>
  );
};

const styles = StyleSheet.create({
  footer: {
    textAlign: 'center',
    fontSize: 11,
    paddingVertical: 4,
  },
});

export default BrandFooter;
