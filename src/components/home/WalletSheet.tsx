/**
 * WalletSheet — what the gold coin opens: the balance, when the next free
 * question comes, and how coins are spent. Values come from the server
 * (walletStore); prices are the server's published rules, shown as text.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { RADIUS } from '@theme/themes';
import { useI18n, useTranslation } from '@i18n/I18nProvider';
import { formatCoins, useWalletStore } from '@stores/walletStore';
import HomeDetailSheet from './HomeDetailSheet';
import { GoldCoin } from './CoinChip';

const DATE_LOCALE = { en: 'en-GB', ur: 'ur-PK', hi: 'hi-IN' } as const;

interface WalletSheetProps {
  visible: boolean;
  onClose: () => void;
  onSeePremium: () => void;
}

const WalletSheet: React.FC<WalletSheetProps> = ({ visible, onClose, onSeePremium }) => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const { lang } = useI18n();
  const { mode, balanceMilli, nextFreeAt, questionCostMilli } = useWalletStore();

  const body = [typography('body'), { color: colors.text, lineHeight: 22 }];
  const muted = [typography('caption'), { color: colors.textMuted, lineHeight: 19 }];

  const nextFreeText =
    nextFreeAt === null
      ? t('wallet.freeAvailable')
      : t('wallet.nextFree', {
          date: new Date(nextFreeAt).toLocaleString(DATE_LOCALE[lang], {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
          }),
        });

  return (
    <HomeDetailSheet title={visible ? t('wallet.title') : null} onClose={onClose}>
      <View style={styles.balanceRow} testID="wallet-balance">
        <GoldCoin size={40} />
        <Text style={[typography('heading'), { color: colors.goldBright, fontSize: 30 }]}>
          {balanceMilli === null ? '—' : formatCoins(balanceMilli)}
        </Text>
      </View>
      <Text style={[...muted, styles.centre]}>{t('wallet.rate')}</Text>

      {mode !== 'coins' ? (
        <Text style={[...body, styles.gap]}>{t('wallet.unknown')}</Text>
      ) : (
        <View style={styles.gap}>
          <Text style={body}>{nextFreeText}</Text>
          {questionCostMilli !== null && (
            <Text style={[...body, styles.line]}>
              {t('wallet.priceQuestion', { coins: formatCoins(questionCostMilli) })}
            </Text>
          )}
        </View>
      )}

      <Text style={[...muted, styles.gap]}>{t('wallet.priceDiscussion')}</Text>
      <Text style={[...muted, styles.line]}>{t('wallet.premium')}</Text>

      <View style={[styles.soon, { borderColor: colors.border }]}>
        <Text style={muted}>{t('wallet.buySoon')}</Text>
      </View>

      <Pressable
        testID="wallet-see-premium"
        onPress={onSeePremium}
        style={({ pressed }) => [
          styles.premiumBtn,
          { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
        ]}
        accessibilityRole="button"
      >
        <Text style={[typography('button'), { color: colors.textOnPrimary }]}>
          {t('wallet.seePremium')}
        </Text>
      </Pressable>
    </HomeDetailSheet>
  );
};

const styles = StyleSheet.create({
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  centre: {
    textAlign: 'center',
    marginTop: 4,
  },
  gap: {
    marginTop: 16,
  },
  line: {
    marginTop: 6,
  },
  soon: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  premiumBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
  },
});

export default WalletSheet;
