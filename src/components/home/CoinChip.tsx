/**
 * CoinChip — the gold coin and balance at the top-right of Home. Tapping it
 * opens the wallet sheet.
 *
 * Shows only what the server reported (walletStore): the balance with one
 * decimal, or a dash while it is not known. Colours follow the theme's Home
 * palette.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { useTypography } from '@theme/useTypography';
import { RADIUS, type HomePalette } from '@theme/themes';
import { useTranslation } from '@i18n/I18nProvider';
import { formatCoins, useWalletStore } from '@stores/walletStore';
import { useHomeStyle } from './homeStyle';

/** An embossed gold coin with an eight-pointed star. */
export const GoldCoin: React.FC<{ size?: number }> = ({ size = 20 }) => {
  const c = size / 2;
  const r = c - 0.5;
  // Eight-pointed star: two overlapping squares.
  const s = r * 0.42;
  const sq = (rot: number): string => {
    const pts = [0, 1, 2, 3].map(i => {
      const a = ((rot + i * 90) * Math.PI) / 180;
      return `${(c + s * Math.cos(a)).toFixed(2)},${(c + s * Math.sin(a)).toFixed(2)}`;
    });
    return `M${pts.join(' L')} Z`;
  };
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id="coinFace" cx="35%" cy="30%" rx="75%" ry="75%">
          <Stop offset="0%" stopColor="#FFF1C2" />
          <Stop offset="45%" stopColor="#E3B45A" />
          <Stop offset="100%" stopColor="#8A5E22" />
        </RadialGradient>
      </Defs>
      <Circle cx={c} cy={c} r={r} fill="url(#coinFace)" />
      <Circle cx={c} cy={c} r={r * 0.78} fill="none" stroke="#7A5220" strokeWidth={0.8} />
      <Path d={sq(45)} fill="#9A6A26" />
      <Path d={sq(0)} fill="#9A6A26" />
      <Circle cx={c} cy={c} r={s * 0.38} fill="#F6D98E" />
    </Svg>
  );
};

const CoinChip: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const typography = useTypography();
  const t = useTranslation();
  const { palette: P } = useHomeStyle();
  const styles = useMemo(() => makeStyles(P), [P]);
  const balanceMilli = useWalletStore(s => s.balanceMilli);
  const shown = balanceMilli === null ? '—' : formatCoins(balanceMilli);

  return (
    <Pressable
      testID="coin-chip"
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.chip, { opacity: pressed ? 0.75 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={t('wallet.coinsA11y', { coins: shown })}
    >
      <GoldCoin size={20} />
      <Text style={[typography('label'), styles.value]} numberOfLines={1}>
        {shown}
      </Text>
    </Pressable>
  );
};

const makeStyles = (P: HomePalette) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingStart: 5,
      paddingEnd: 11,
      paddingVertical: 5,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: P.antiqueGold + '99',
      backgroundColor: P.deepTeal,
    },
    value: {
      color: P.champagne,
      fontSize: 14,
      fontVariant: ['tabular-nums'],
    },
  });

export default CoinChip;
